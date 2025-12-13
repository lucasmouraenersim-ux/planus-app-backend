'use server';

import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, increment, addDoc, collection, Timestamp, arrayUnion } from 'firebase/firestore';
import { sendTelegramNotification } from '@/lib/telegram'; // <--- IMPORTAR

// Custo por lead (para quem não é admin)
const COST_PER_LEAD = 5;

interface UnlockResult {
    success: boolean;
    message: string;
    alreadyUnlocked?: boolean;
}

export async function unlockContactAction(userId: string, leadId: string): Promise<UnlockResult> {
  if (!userId || !leadId) {
    return { success: false, message: 'ID do usuário ou do lead não fornecido.' };
  }
  try {
    const userRef = doc(db, 'users', userId);
    const leadRef = doc(db, 'faturas_clientes', leadId); // Referência do Lead

    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      return { success: false, message: 'Usuário não encontrado.' };
    }

    const userData = userSnap.data();
    const role = userData.type || 'user';
    const credits = userData.credits || 0;
    const unlockedLeads = userData.unlockedLeads || [];

    // 1. Verifica se já está desbloqueado
    if (unlockedLeads.includes(leadId)) {
      return { success: true, message: 'Contato já disponível.', alreadyUnlocked: true };
    }

    // 2. Verifica se é Admin (Isenção de custo)
    const isAdmin = role === 'admin' || role === 'superadmin';

    if (!isAdmin) {
      // 3. Se for mortal, verifica saldo
      if (credits < COST_PER_LEAD) {
        return { success: false, message: `Saldo insuficiente. Necessário: ${COST_PER_LEAD}, Atual: ${credits}` };
      }

      // 4. Desconta Créditos
      await updateDoc(userRef, {
        credits: increment(-COST_PER_LEAD)
      });

      // 5. Gera Log de Transação (Auditoria)
      await addDoc(collection(db, 'transactions'), {
        userId,
        type: 'usage',
        description: `Desbloqueio de Lead: ${leadId}`,
        amount: -COST_PER_LEAD,
        createdAt: Timestamp.now()
      });
    }

    // 6. Salva que este usuário possui este lead (para não cobrar de novo)
    await updateDoc(userRef, {
      unlockedLeads: arrayUnion(leadId)
    });
    
    // --- APÓS O SUCESSO DO DESBLOQUEIO (Antes do return) ---

    // 1. Buscar dados para a notificação
    const leadSnap = await getDoc(leadRef);
    const leadData = leadSnap.data();
    const userSnapAfterUnlock = await getDoc(userRef); // Recarrega para garantir dados frescos
    const userDataAfterUnlock = userSnapAfterUnlock.data();

    // 2. Montar Mensagem
    const message = `
🔓 <b>Lead Desbloqueado!</b>

👤 <b>Comprador:</b> ${userDataAfterUnlock?.displayName || 'Usuário'}
🏢 <b>Empresa Revelada:</b> ${leadData?.nome || 'Desconhecida'}
📍 <b>Local:</b> ${leadData?.unidades?.[0]?.cidade || 'N/A'} - ${leadData?.unidades?.[0]?.estado || ''}
💰 <b>Saldo Restante:</b> ${userDataAfterUnlock?.credits} créditos

<i>Monitoramento de Leads - Planus</i>
    `;

    // 3. Enviar
    sendTelegramNotification(message);

    return { success: true, message: isAdmin ? 'Acesso Admin: Liberado.' : 'Contato comprado com sucesso!' };

  } catch (error) {
    console.error("Erro ao desbloquear:", error);
    return { success: false, message: 'Erro interno ao processar.' };
  }
}