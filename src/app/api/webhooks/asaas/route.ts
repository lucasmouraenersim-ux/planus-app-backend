
import { NextResponse } from 'next/server';
import { initializeAdmin } from '@/lib/firebase/admin'; 
import { doc, updateDoc, getDoc, collection, addDoc, Timestamp } from 'firebase/firestore';

const COMISSAO_PERCENTUAL = 0.10; 

export async function POST(req: Request) {
  const { db } = await initializeAdmin(); 

  try {
    const token = req.headers.get('asaas-access-token');
    if (token !== process.env.ASAAS_WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const event = await req.json();
    
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

    const isSdrPlan = payment.description?.includes('Plano Empresarial');

    try {
        const { FieldValue } = await import('firebase-admin/firestore');
        let creditsToAdd = 0;
        
        if (isSdrPlan) {
            creditsToAdd = 200; // Entrega 200 créditos todo mês que pagar
            await updateDoc(doc(db, 'users', userId), { plan: 'sdr_pro', subscriptionId: payment.subscription });
        } else {
            // Lógica anterior de pacotes avulsos
            if (valorPago >= 200) creditsToAdd = 100;
            else if (valorPago >= 125) creditsToAdd = 50;
            else if (valorPago >= 30) creditsToAdd = 10;
        }

        if(creditsToAdd > 0) {
            await updateDoc(doc(db, 'users', userId), { credits: FieldValue.increment(creditsToAdd) });
        }

        const userRef = doc(db, 'users', userId);
        const userDoc = await getDoc(userRef);
        const userData = userDoc.data();

        if (userData?.referredBy) {
            const afiliadoId = userData.referredBy;
            const comissao = valorPago * COMISSAO_PERCENTUAL;

            if (comissao > 0) {
                await updateDoc(doc(db, 'users', afiliadoId), {
                    mlmBalance: FieldValue.increment(comissao)
                });

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
