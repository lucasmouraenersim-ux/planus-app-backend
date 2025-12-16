
import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase'; // Certifique-se que este import está apontando para o firebase ADMIN ou CLIENT corretamente. O ideal aqui é firebase-admin se for server-side puro, mas o client SDK funciona se as regras permitirem.
import { doc, getDoc, updateDoc } from 'firebase/firestore';

// Define a URL base
const ASAAS_API_URL = process.env.ASAAS_ENV === 'sandbox' 
  ? 'https://sandbox.asaas.com/api/v3' 
  : 'https://www.asaas.com/api/v3';

// ⚠️ IMPORTANTE: Coloque essa chave no seu arquivo .env.local como ASAAS_API_KEY
const ASAAS_API_KEY = process.env.ASAAS_API_KEY || "$aact_prod_000MzkwODA2MWY2OGM3MWRlMDU2NWM3MzJlNzZmNGZhZGY6OjZmMjU1NzMzLWI0MmQtNDg2MS1iOGI5LTY5NDEzNWY3NGMxOTo6JGFhY2hfNGIyZjUxMWEtNTY2ZC00YWVmLTk4ZWEtYTExZmVmOWYxMjk2";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { userId, itemId } = body;

    if (!userId) return NextResponse.json({ error: 'Faltou ID do usuário' }, { status: 400 });

    // 1. Busca Usuário no Firebase
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
    }
    const userData = userSnap.data();

    // 2. Define o Preço e Descrição
    let price = 0;
    let description = '';
    
    // Tabela de Preços (Sincronize com o Modal)
    switch (itemId) {
        case 'pack_10': price = 30; description = 'Pacote 10 Créditos'; break;
        case 'pack_50': price = 125; description = 'Pacote 50 Créditos'; break;
        case 'pack_100': price = 200; description = 'Pacote 100 Créditos'; break;
        case 'starter_monthly': price = 97; description = 'Assinatura Starter'; break;
        case 'pro_monthly': price = 197; description = 'Assinatura Pro'; break;
        default: return NextResponse.json({ error: 'Pacote inválido' }, { status: 400 });
    }

    // 3. Validação de CPF/CNPJ (Lógica de Fallback para Testes)
    let cpfCnpj = (userData.cpf || userData.documento || '').replace(/\D/g, '');
    
    // Fallback apenas se não tiver documento válido
    if (cpfCnpj.length !== 11 && cpfCnpj.length !== 14) {
        console.warn(`⚠️ Usuário ${userId} sem doc válido. Usando CPF de fallback.`);
        cpfCnpj = '47960950000121'; // CNPJ Genérico para passar no Asaas (Cuidado em produção)
    }

    // 4. Gestão do Cliente no Asaas
    let asaasCustomerId = userData.asaasCustomerId;

    if (!asaasCustomerId) {
      // Cria cliente no Asaas
      const createRes = await fetch(`${ASAAS_API_URL}/customers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'access_token': ASAAS_API_KEY },
        body: JSON.stringify({
          name: userData.displayName || 'Cliente Planus',
          email: userData.email,
          cpfCnpj: cpfCnpj,
          externalReference: userId,
          notificationDisabled: true
        })
      });
      
      const customerData = await createRes.json();
      
      if (customerData.id) {
        asaasCustomerId = customerData.id;
        await updateDoc(userRef, { asaasCustomerId });
      } else {
        // Tenta recuperar se já existe (Erro comum: customer already exists)
        if (customerData.errors?.[0]?.code === 'CUSTOMER_ALREADY_EXISTS') {
            // Lógica simplificada: pede para o usuário verificar o cadastro ou busca por email (complexo para implementar aqui agora)
             return NextResponse.json({ error: 'Cliente já existe no Asaas com outro vínculo. Contate o suporte.' }, { status: 400 });
        }
        return NextResponse.json({ error: 'Erro ao criar cliente Asaas', details: customerData }, { status: 400 });
      }
    }

    // 5. Gera a Cobrança
    const billingRes = await fetch(`${ASAAS_API_URL}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'access_token': ASAAS_API_KEY },
      body: JSON.stringify({
        customer: asaasCustomerId,
        billingType: 'UNDEFINED', // Deixa o usuário escolher (Pix/Boleto/Cartão) no link
        value: price,
        dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        description: `Recarga Planus - ${description}`,
        externalReference: userId
      })
    });

    const billingData = await billingRes.json();

    if (billingData.invoiceUrl) {
      return NextResponse.json({ paymentUrl: billingData.invoiceUrl });
    } else {
      return NextResponse.json({ error: 'Falha ao gerar link', details: billingData }, { status: 400 });
    }

  } catch (error: any) {
    console.error("Erro Checkout:", error);
    return NextResponse.json({ error: 'Erro interno', message: error.message }, { status: 500 });
  }
}
