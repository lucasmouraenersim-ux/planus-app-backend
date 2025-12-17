
import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, query, where, getDocs, updateDoc } from 'firebase/firestore';

const ASAAS_API_URL = process.env.ASAAS_ENV === 'sandbox' 
  ? 'https://sandbox.asaas.com/api/v3' 
  : 'https://www.asaas.com/api/v3';
const ASAAS_API_KEY = process.env.ASAAS_API_KEY;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { userId, itemId, couponCode } = body;

    if (!userId || !itemId) {
      return NextResponse.json({ error: 'User ID and Item ID are required' }, { status: 400 });
    }

    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    const userData = userSnap.data();

    // TRAVA DE DATA: Verifica se já passou do Natal (25/12/2025)
    const hoje = new Date();
    const dataVirada = new Date('2025-12-26T00:00:00-03:00'); // Fuso horário Brasil
    const isPrecoNovo = hoje >= dataVirada;

    let price = 0;
    let description = '';
    let isSubscription = false;
    let cycle: 'MONTHLY' | 'QUARTERLY' | null = null;

    switch (itemId) {
        case 'pack_mini': // Antigo pack_10
            price = isPrecoNovo ? 99.90 : 30.00; 
            description = isPrecoNovo ? 'Pacote 20 Créditos' : 'Pacote 10 Créditos (Promo Natal)';
            break;

        case 'pack_medio': // Antigo pack_50
            price = isPrecoNovo ? 199.90 : 125.00; 
            description = 'Pacote 50 Créditos'; 
            break;

        case 'pack_pro': // Antigo pack_100
            price = isPrecoNovo ? 299.90 : 200.00; 
            description = 'Pacote 100 Créditos'; 
            break;
        
        case 'pack_whale': 
            price = 900; 
            description = '500 Créditos (Atacado)'; 
            break;

        case 'plan_bt_pro': // Antigo plan_sdr_quarterly
            price = isPrecoNovo ? 399.90 : 200.00;
            cycle = 'MONTHLY';
            description = isPrecoNovo ? 'Plano Mensal Pro' : 'Plano Empresarial (200 Créditos/mês) - Promo Natal';
            isSubscription = true;
            break;
            
        default: return NextResponse.json({ error: 'Item inválido' }, { status: 400 });
    }

    let finalPrice = price;
    let discountMetadata = '';

    if (couponCode && !isSubscription) {
        const q = query(collection(db, 'coupons'), where('code', '==', couponCode.toUpperCase()), where('active', '==', true));
        const snap = await getDocs(q);
        
        if (!snap.empty) {
            const coupon = snap.docs[0].data();
            if (price >= (coupon.minPurchase || 0)) {
                if (coupon.type === 'percent') {
                    finalPrice = price - (price * (coupon.value / 100));
                } else {
                    finalPrice = Math.max(0, price - coupon.value);
                }
                discountMetadata = ` | Cupom: ${couponCode}`;
            }
        }
    }

    let cpfCnpj = (userData.cpf || userData.documento || '').replace(/\D/g, '');
    if (cpfCnpj.length !== 11 && cpfCnpj.length !== 14) {
        console.warn(`⚠️ Usuário ${userId} sem doc válido. Usando CNPJ de fallback.`);
        cpfCnpj = '47960950000121';
    }
    
    let asaasCustomerId = userData.asaasCustomerId;
    if (!asaasCustomerId) {
      const createRes = await fetch(`${ASAAS_API_URL}/customers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'access_token': ASAAS_API_KEY! },
        body: JSON.stringify({ name: userData.displayName || 'Cliente Sent', email: userData.email, cpfCnpj, externalReference: userId, notificationDisabled: true })
      });
      const customerData = await createRes.json();
      if (customerData.id) {
        asaasCustomerId = customerData.id;
        await updateDoc(userRef, { asaasCustomerId });
      } else {
        if (customerData.errors?.[0]?.code === 'CUSTOMER_ALREADY_EXISTS') {
             return NextResponse.json({ error: 'Cliente já existe no Asaas com outro vínculo. Contate o suporte.' }, { status: 400 });
        }
        return NextResponse.json({ error: 'Erro ao criar cliente Asaas', details: customerData }, { status: 400 });
      }
    }

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
        payload.nextDueDate = new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    } else {
        payload.dueDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    }

    const response = await fetch(`${ASAAS_API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'access_token': ASAAS_API_KEY! },
        body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (data.id) {
        const paymentUrl = data.invoiceUrl || data.bankSlipUrl || `https://www.asaas.com/c/${data.id}`;
        return NextResponse.json({ paymentUrl });
    } else {
        return NextResponse.json({ error: 'Erro no Asaas', details: data }, { status: 400 });
    }

  } catch (error: any) {
    console.error("Checkout Error:", error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
