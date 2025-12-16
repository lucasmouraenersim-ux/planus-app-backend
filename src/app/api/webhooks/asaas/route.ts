
import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase/admin'; 
import { doc, updateDoc, increment, addDoc, collection, getDoc, Timestamp } from 'firebase/firestore';

// Configuração de Comissão (Ex: 10% sobre o valor LÍQUIDO pago)
const COMISSAO_PERCENTUAL = 0.10; 

export async function POST(req: Request) {
  try {
    const token = req.headers.get('asaas-access-token');
    if (token !== process.env.ASAAS_WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const event = await req.json();
    
    // Aceita pagamento único OU pagamento de assinatura
    if (event.event !== 'PAYMENT_RECEIVED' && event.event !== 'PAYMENT_CONFIRMED') {
        return NextResponse.json({ received: true });
    }

    const payment = event.payment;
    const userId = payment.externalReference; 
    const valorPago = payment.value; 

    if (!userId) {
      console.warn("Pagamento sem ID de usuário (externalReference):", payment.id);
      return NextResponse.json({ error: 'No user ID' }, { status: 400 });
    }

    const isSdrPlan = payment.description?.includes('Plano SDR');

    try {
        // 1. Liberação de Créditos
        let creditsToAdd = 0;
        
        if (isSdrPlan) {
            creditsToAdd = 300;
            await updateDoc(doc(db, 'users', userId), { plan: 'sdr_pro', subscriptionId: payment.subscription });
        } else {
            // Lógica anterior de pacotes avulsos
            if (valorPago >= 900) creditsToAdd = 500;
            else if (valorPago >= 200) creditsToAdd = 100;
            else if (valorPago >= 125) creditsToAdd = 50;
            else if (valorPago >= 30) creditsToAdd = 10;
        }

        if(creditsToAdd > 0) {
            await updateDoc(doc(db, 'users', userId), { credits: increment(creditsToAdd) });
        }

        // 2. SISTEMA DE AFILIADOS (COMISSIONAMENTO)
        const userRef = doc(db, 'users', userId);
        const userDoc = await getDoc(userRef);
        const userData = userDoc.data();

        if (userData?.referredBy) {
            const afiliadoId = userData.referredBy;
            const comissao = valorPago * COMISSAO_PERCENTUAL;

            if (comissao > 0) {
                // No Firestore Admin SDK, use 'FieldValue.increment'
                const { FieldValue } = await import('firebase-admin/firestore');
                await updateDoc(doc(db, 'users', afiliadoId), {
                    mlmBalance: FieldValue.increment(comissao)
                });

                // Registra histórico
                await addDoc(collection(db, 'commissions'), {
                    affiliateId: afiliadoId,
                    fromUser: userId,
                    amount: comissao,
                    baseAmount: valorPago,
                    createdAt: Timestamp.now(),
                    status: 'paid'
                });
                
                console.log(`💰 Comissão de R$ ${comissao} paga para ${afiliadoId}`);
            }
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Webhook processing error:", error);
        return NextResponse.json({ error: 'Erro interno ao processar webhook' }, { status: 500 });
    }

  } catch (error: any) {
    console.error("Webhook Error:", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
