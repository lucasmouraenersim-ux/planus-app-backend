import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, query, where, getDocs, updateDoc } from 'firebase/firestore';

// Pega a chave e limpa barras invertidas extras ou espaços
const rawKey = process.env.ASAAS_TOKEN || '';
const ASAAS_API_KEY = rawKey.replace(/\\/g, '').trim(); 

const ASAAS_API_URL = process.env.ASAAS_ENV === 'production' 
  ? 'https://www.asaas.com/api/v3'
  : 'https://sandbox.asaas.com/api/v3';

export async function POST(req: Request) {
  try {
    console.log("--- DEBUG CHECKOUT ---");
    console.log("Chave carregada (tamanho):", ASAAS_API_KEY.length);
    console.log("Começa com $aact?", ASAAS_API_KEY.startsWith('$aact'));
    console.log("Ambiente:", process.env.ASAAS_ENV);
    console.log("URL da API:", ASAAS_API_URL);
    
    if (!ASAAS_API_KEY || ASAAS_API_KEY.length < 10) {
      return NextResponse.json({ error: 'Configuração de pagamento ausente (API Key)' }, { status: 500 });
    }

    const body = await req.json();
    const { userId, itemId, couponCode } = body;

    if (!userId || !itemId) {
      return NextResponse.json({ error: 'Usuário ou Item não informados' }, { status: 400 });
    }

    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
    const userData = userSnap.data();

    // Lógica de Preços
    let price = 0;
    let description = '';
    let isSubscription = false;
    let cycle: 'MONTHLY' | 'QUARTERLY' | null = null;

    switch (itemId) {
        case 'pack_10': price = 30; description = 'Pacote 10 Créditos'; break;
        case 'pack_50': price = 125; description = 'Pacote 50 Créditos'; break;
        case 'pack_100': price = 200; description = 'Pacote 100 Créditos'; break;
        case 'plan_sdr_quarterly': 
            price = 200; cycle = 'MONTHLY'; 
            description = 'Plano Empresarial (200 Créditos/mês)'; 
            isSubscription = true; 
            break;
        default: return NextResponse.json({ error: 'Item inválido' }, { status: 400 });
    }

    let finalPrice = price;
    let discountMetadata = '';

    // Lógica de Cupom
    if (couponCode && !isSubscription) {
        const q = query(collection(db, 'coupons'), where('code', '==', couponCode.toUpperCase()), where('active', '==', true));
        const snap = await getDocs(q);
        if (!snap.empty) {
            const coupon = snap.docs[0].data();
            if (price >= (coupon.minPurchase || 0)) {
                finalPrice = coupon.type === 'percent' ? price - (price * (coupon.value / 100)) : Math.max(0, price - coupon.value);
                discountMetadata = ` | Cupom: ${couponCode}`;
            }
        }
    }

    let cpfCnpj = (userData.cpf || userData.documento || '').replace(/\D/g, '');
    if (cpfCnpj.length !== 11 && cpfCnpj.length !== 14) cpfCnpj = '47960950000121'; // Fallback
    
    // 2. Criar ou Obter Cliente no Asaas
    let asaasCustomerId = userData.asaasCustomerId;
    if (!asaasCustomerId) {
      const createRes = await fetch(`${ASAAS_API_URL}/customers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'access_token': ASAAS_API_KEY },
        body: JSON.stringify({ name: userData.displayName || 'Cliente', email: userData.email, cpfCnpj, externalReference: userId, notificationDisabled: true })
      });
      
      const customerText = await createRes.text();
      console.log("Resposta Asaas (criar cliente):", customerText);
      let customerData;
      try {
        customerData = JSON.parse(customerText);
      } catch (e) {
        return NextResponse.json({ error: 'Resposta inválida ao criar cliente', details: customerText }, { status: 500 });
      }
      
      if (customerData.id) {
        asaasCustomerId = customerData.id;
        await updateDoc(userRef, { asaasCustomerId });
      } else {
        // Retorna erro detalhado
        const errorMsg = customerData.errors?.[0]?.description || customerData.message || JSON.stringify(customerData);
        return NextResponse.json({ error: `Erro ao criar cliente: ${errorMsg}`, details: customerData }, { status: 400 });
      }
    }

    // 3. Gerar Cobrança
    const endpoint = isSubscription ? '/subscriptions' : '/payments';
    const payload: any = {
        customer: asaasCustomerId,
        billingType: 'UNDEFINED',
        value: finalPrice,
        description: `${description}${discountMetadata}`,
        externalReference: userId,
    };

    if (isSubscription) {
        payload.cycle = cycle;
        payload.nextDueDate = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    } else {
        payload.dueDate = new Date(Date.now() + 172800000).toISOString().split('T')[0];
    }

    const response = await fetch(`${ASAAS_API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'access_token': ASAAS_API_KEY },
        body: JSON.stringify(payload)
    });

    // TRATAMENTO SEGURO DE JSON
    const responseText = await response.text();
    let data;
    try {
        data = JSON.parse(responseText);
    } catch (e) {
        return NextResponse.json({ error: 'Resposta inválida do Asaas', details: responseText }, { status: 500 });
    }

    if (data.id) {
        const paymentUrl = data.invoiceUrl || data.bankSlipUrl || `https://www.asaas.com/c/${data.id}`;
        return NextResponse.json({ paymentUrl });
    } else {
        // Retorna erro detalhado
        const errorMsg = data.errors?.[0]?.description || data.message || JSON.stringify(data);
        console.log("Erro Asaas (pagamento):", data);
        return NextResponse.json({ error: `Erro no Asaas: ${errorMsg}`, details: data }, { status: 400 });
    }

  } catch (error: any) {
    console.error("Checkout Error:", error);
    return NextResponse.json({ error: error.message || 'Erro interno no servidor' }, { status: 500 });
  }
}