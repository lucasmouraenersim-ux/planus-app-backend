'use server';

import { initializeAdmin } from '@/lib/firebase/admin';
import admin from 'firebase-admin';
import { subWeeks } from 'date-fns';

export async function processOldWithdrawals(): Promise<{ success: boolean; message: string; count: number }> {
  try {
    const adminDb = await initializeAdmin();
    const withdrawalsRef = adminDb.collection('withdrawal_requests');

    // Calculate the date one week ago
    const oneWeekAgo = subWeeks(new Date(), 1);
    const oneWeekAgoTimestamp = admin.firestore.Timestamp.fromDate(oneWeekAgo);

    // Query for pending withdrawals older than one week
    const q = withdrawalsRef
      .where('status', '==', 'pendente')
      .where('requestedAt', '<=', oneWeekAgoTimestamp);
      
    const querySnapshot = await q.get();

    if (querySnapshot.empty) {
      return { success: true, message: 'Nenhuma solicitação de saque antiga e pendente encontrada para processar.', count: 0 };
    }

    const batch = adminDb.batch();
    const now = admin.firestore.Timestamp.now();

    querySnapshot.docs.forEach(doc => {
      batch.update(doc.ref, { 
        status: 'concluido',
        processedAt: now,
        adminNotes: 'Processado automaticamente via sistema.' 
      });
    });

    await batch.commit();

    const count = querySnapshot.size;
    return {
      success: true,
      message: `${count} solicitação(ões) de saque foram marcadas como 'concluído'.`,
      count: count,
    };

  } catch (error) {
    console.error('[PROCESS_OLD_WITHDRAWALS] Critical error:', error);
    const errorMessage = error instanceof Error ? error.message : "Ocorreu um erro desconhecido no servidor.";
    return {
      success: false,
      message: `Falha ao processar saques antigos: ${errorMessage}`,
      count: 0,
    };
  }
}
