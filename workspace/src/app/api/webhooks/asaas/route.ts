
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

    const isSdrPlan = payment.description?.includes('Plano Empresarial') || payment.description?.includes('Plano Mensal Pro') || payment.description?.includes('SDR');

    try {
        const { FieldValue } = await import('firebase-admin/firestore');
        let creditsToAdd = 0;
        
        if (isSdrPlan) {
            // Se for plano, entrega 200 créditos (tanto no preço de 200 quanto de 399)
            creditsToAdd = 200; 
            await updateDoc(doc(db, 'users', userId), { plan: 'sdr_pro', subscriptionId: payment.subscription });
        } else {
            // LÓGICA DE ENTREGA AVULSA (Híbrida)
            // Se pagou valor alto (Tabela Nova)
            if (valorPago >= 290) creditsToAdd = 100;      // R$ 299,90
            else if (valorPago >= 190) creditsToAdd = 50;  // R$ 199,90
            else if (valorPago >= 90) creditsToAdd = 20;   // R$ 99,90
            
            // Se pagou valor baixo (Tabela Natal - Fallback)
            else if (valorPago >= 120) creditsToAdd = 50;  // R$ 125,00
            else if (valorPago >= 25) creditsToAdd = 10;   // R$ 30,00
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
