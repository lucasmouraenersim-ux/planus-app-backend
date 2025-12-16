
'use server';

import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, increment, addDoc, collection, Timestamp, arrayUnion } from 'firebase/firestore';
import { sendTelegramNotification } from '@/lib/telegram';
import { trackEvent } from '@/lib/analytics/trackEvent';

// Custo para desbloquear um lead
const COST_PER_UNLOCK = 5; 

interface UnlockResult {
    success: boolean;
    message: string;
    alreadyUnlocked?: boolean;
}

export async function unlockContactAction(userId: string, leadId: string): Promise<UnlockResult> {
  if (!userId || !leadId) {
    return { success: false, message: 'ID do usuário ou do lead não fornecido.' };
  }
  
  const userRef = doc(db, 'users', userId);
  const leadRef = doc(db, 'faturas_clientes', leadId);

  try {
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      return { success: false, message: 'Usuário não encontrado.' };
    }

    const userData = userSnap.data();
    const role = userData.type || 'user';
    const credits = userData.credits || 0;
    const unlockedLeads: string[] = userData.unlockedLeads || [];
    
    const isAdmin = role === 'admin' || role === 'superadmin' || role === 'advogado';

    // 1. Verifica se já está desbloqueado
    if (unlockedLeads.includes(leadId)) {
      console.log(`[UNLOCK] Lead ${leadId} já desbloqueado para usuário ${userId}`);
      return { success: true, message: 'Contato já disponível.', alreadyUnlocked: true };
    }

    // 2. Se não for admin, verifica saldo e cobra
    if (!isAdmin) {
      if (credits < COST_PER_UNLOCK) {
        return { success: false, message: `Saldo insuficiente. Necessário: ${COST_PER_UNLOCK} créditos, você tem: ${credits}.` };
      }
      
      // Desconta Créditos e registra transação
      await updateDoc(userRef, {
        credits: increment(-COST_PER_UNLOCK)
      });
      await addDoc(collection(db, 'transactions'), {
        userId,
        type: 'usage',
        description: `Desbloqueio do lead: ${leadId}`,
        amount: -COST_PER_UNLOCK,
        createdAt: Timestamp.now()
      });
    }

    // 3. Salva que este usuário possui este lead
    await updateDoc(userRef, {
      unlockedLeads: arrayUnion(leadId)
    });
    
    // 4. Marca o lead como desbloqueado (para a UI)
    await updateDoc(leadRef, { isUnlocked: true });

    // --- Notificações e Analytics ---
    const leadSnap = await getDoc(leadRef);
    const leadData = leadSnap.data();
    
    trackEvent({
        eventType: 'LEAD_UNLOCKED',
        user: { id: userId, name: userData?.displayName, email: userData?.email },
        metadata: { leadId, leadName: leadData?.nome }
    });

    const message = `
🔓 <b>Lead Desbloqueado!</b>

👤 <b>Comprador:</b> ${userData?.displayName || 'Usuário'}
🏢 <b>Empresa Revelada:</b> ${leadData?.nome || 'Desconhecida'}
📍 <b>Local:</b> ${leadData?.unidades?.[0]?.cidade || 'N/A'} - ${leadData?.unidades?.[0]?.estado || ''}
💰 <b>Saldo Restante:</b> ${isAdmin ? 'Ilimitado' : (credits - COST_PER_UNLOCK)} créditos
    `;
    sendTelegramNotification(message);

    return { success: true, message: isAdmin ? 'Acesso Admin: Contato liberado sem custo.' : 'Contato desbloqueado com sucesso!' };

  } catch (error) {
    console.error("Erro Crítico ao Desbloquear:", error);
    return { success: false, message: 'Erro interno do servidor ao processar o desbloqueio.' };
  }
}
