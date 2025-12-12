import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase/admin';
import { doc, updateDoc, increment, addDoc, collection, Timestamp, getDocs, query, where } from 'firebase/firestore';

export async function POST(req: Request) {
  try {
    // 1. Segurança: Verifica se a senha bate com a que você criou no painel do Asaas
    const token = req.headers.get('asaas-access-token');
    if (token !== process.env.ASAAS_WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const event = await req.json();

    // 2. Filtra apenas pagamentos confirmados
    if (event.event !== 'PAYMENT_RECEIVED' && event.event !== 'PAYMENT_CONFIRMED') {
      return NextResponse.json({ received: true });
    }

    const payment = event.payment;
    // O ID do usuário (uid do firebase) deve vir no campo externalReference
    const userId = payment.externalReference; 
    const value = payment.value;

    if (!userId) {
      console.warn("Pagamento sem ID de usuário (externalReference):", payment.id);
      return NextResponse.json({ error: 'No user ID' }, { status: 400 });
    }

    // 3. Define quantos créditos dar baseado no valor pago
    let creditsToAdd = 0;
    
    // Regras de negócio (Ajuste conforme seus preços reais)
    if (value >= 200) creditsToAdd = 100;      // Ex: Pacote Grande
    else if (value >= 125) creditsToAdd = 50;  // Ex: Pacote Médio
    else if (value >= 97) creditsToAdd = 20;   // Ex: Assinatura Starter
    else if (value >= 30) creditsToAdd = 10;   // Ex: Pacote Pequeno
    else creditsToAdd = Math.floor(value / 3); // Regra genérica (1 crédito = R$ 3)

    if (creditsToAdd > 0) {
        const userRef = doc(db, 'users', userId);
        
        // Atualiza o saldo do usuário
        await updateDoc(userRef, {
            credits: increment(creditsToAdd),
            subscriptionStatus: 'active'
        });

        // Salva no histórico de transações
        await addDoc(collection(db, 'transactions'), {
            userId,
            type: 'purchase',
            amount: creditsToAdd,
            moneyValue: value,
            description: `Recarga via Asaas (Ref: ${payment.id})`,
            paymentMethod: payment.billingType,
            createdAt: Timestamp.now()
        });

        console.log(`✅ Sucesso: ${creditsToAdd} créditos adicionados para ${userId}`);
    }

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error("Webhook Error:", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}