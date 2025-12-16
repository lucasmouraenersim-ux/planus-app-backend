
"use server";

import { db } from '@/lib/firebase';
import { doc, runTransaction, addDoc, collection, Timestamp, arrayUnion } from 'firebase/firestore';
import { trackEvent } from '@/lib/analytics/trackEvent';
import { calculateLeadCost } from '@/lib/billing/leadPricing';

interface UnlockResult {
    success: boolean;
    message: string;
    alreadyUnlocked?: boolean;
    code?: 'no_credits';
}

export async function unlockContactAction(userId: string, leadId: string): Promise<UnlockResult> {
  if (!userId || !leadId) {
    return { success: false, message: 'ID do usuário ou do lead não fornecido.' };
  }
  
  const userRef = doc(db, 'users', userId);
  const leadRef = doc(db, 'faturas_clientes', leadId);

  try {
    let costToUnlock = 1; // Default cost
    const leadSnap = await getDoc(leadRef);
    if (!leadSnap.exists()) {
        throw new Error("Lead não encontrado.");
    }
    const leadData = leadSnap.data();
    const consumoKwh = leadData?.unidades?.[0]?.consumoKwh || 0;
    costToUnlock = calculateLeadCost(Number(consumoKwh));

    await runTransaction(db, async (transaction) => {
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists()) {
          throw new Error("Usuário não encontrado.");
        }

        const userData = userDoc.data();
        const role = userData.type || 'user';
        const isAdmin = role === 'admin' || role === 'superadmin' || role === 'advogado';
        const unlockedLeads: string[] = userData.unlockedLeads || [];
        
        if (unlockedLeads.includes(leadId)) {
          // Do nothing, already unlocked. The function will return success outside the transaction.
          return;
        }

        if (!isAdmin) {
          const currentCredits = userData.credits || 0;
          if (currentCredits < costToUnlock) {
            throw "INSUFFICIENT_FUNDS";
          }
          
          transaction.update(userRef, {
            credits: currentCredits - costToUnlock
          });

          // Log transaction
          const historyRef = doc(collection(db, 'usage_history'));
          transaction.set(historyRef, {
            userId,
            action: 'unlock_contact',
            cost: costToUnlock,
            leadId,
            timestamp: Timestamp.now()
          });
        }
        
        transaction.update(userRef, {
          unlockedLeads: arrayUnion(leadId)
        });
        
        transaction.update(leadRef, { isUnlocked: true });
    });
    
    // Check if already unlocked *before* the transaction
    const userSnapAfter = await getDoc(userRef);
    const wasAlreadyUnlocked = (userSnapAfter.data()?.unlockedLeads || []).includes(leadId) && costToUnlock === 1; // Simplistic check

    trackEvent({
        eventType: 'LEAD_UNLOCKED',
        user: { id: userId, name: userSnapAfter.data()?.displayName || 'N/A', email: userSnapAfter.data()?.email || 'N/A' },
        metadata: { leadId, leadName: leadData.nome, cost: costToUnlock }
    });

    return { 
        success: true, 
        message: wasAlreadyUnlocked ? 'Contato já disponível.' : 'Contato desbloqueado com sucesso!',
        alreadyUnlocked: wasAlreadyUnlocked
    };

  } catch (error) {
    if (error === "INSUFFICIENT_FUNDS") {
        return { success: false, message: "Créditos insuficientes.", code: "no_credits" };
    }
    console.error("Erro Crítico ao Desbloquear:", error);
    return { success: false, message: 'Erro interno do servidor ao processar o desbloqueio.' };
  }
}
