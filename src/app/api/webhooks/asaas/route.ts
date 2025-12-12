import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase/admin'; // Use Admin SDK on server
import { doc, updateDoc, increment, addDoc, collection, Timestamp, getDoc } from 'firebase/firestore';

export async function POST(req: Request) {
  try {
    // 1. Validar Token de Segurança do Asaas (para ninguém forjar pagamento)
    const token = req.headers.get('asaas-access-token');
    if (token !== process.env.ASAAS_WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const event = await req.json();

    // 2. Filtrar evento: Apenas pagamentos CONFIRMADOS
    if (event.event !== 'PAYMENT_RECEIVED' && event.event !== 'PAYMENT_CONFIRMED') {
      return NextResponse.json({ received: true }); // Ignora outros eventos
    }

    const payment = event.payment;
    // O ID do usuário deve ter sido enviado no campo 'externalReference' na hora de criar o pagamento
    const userId = payment.externalReference; 
    const value = payment.value;
    
    // 3. Lógica de Créditos (Exemplo simples)
    // Você pode mapear o valor pago para a quantidade de créditos
    let creditsToAdd = 0;
    
    if (value === 97) creditsToAdd = 20;   // Plano Starter
    else if (value === 197) creditsToAdd = 50; // Plano Pro
    else if (value === 30) creditsToAdd = 10;  // Pack 10
    else if (value === 125) creditsToAdd = 50; // Pack 50
    // ... etc

    if (userId && creditsToAdd > 0) {
        const userRef = doc(db, 'users', userId);
        
        // Adiciona Créditos
        await updateDoc(userRef, {
            credits: increment(creditsToAdd),
            subscriptionStatus: 'active' // Se for assinatura, ativa
        });

        // Grava no Extrato
        await addDoc(collection(db, 'transactions'), {
            userId,
            type: 'purchase', // Compra
            amount: creditsToAdd,
            moneyValue: value,
            description: `Pagamento Confirmado via Asaas (ID: ${payment.id})`,
            createdAt: Timestamp.now()
        });

        console.log(`💰 Pagamento processado: ${creditsToAdd} créditos para ${userId}`);
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error("Webhook Error:", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
