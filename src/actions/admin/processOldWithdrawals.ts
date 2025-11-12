
'use server';

import { initializeAdmin } from '@/lib/firebase/admin';
import admin from 'firebase-admin';
import { subWeeks } from 'date-fns';

export async function processOldWithdrawals(): Promise<{ success: boolean; message: string; count: number }> {
  try {
    const { db: adminDb } = await initializeAdmin();
    const withdrawalsRef = adminDb.collection('withdrawal_requests');

    // Calculate the date one week ago
    const oneWeekAgo = subWeeks(new Date(), 1);

    // Query for pending withdrawals, then filter by date in code to avoid composite index requirement
    const q = withdrawalsRef.where('status', '==', 'pendente');
    const querySnapshot = await q.get();

    if (querySnapshot.empty) {
      return { success: true, message: 'Nenhuma solicitação de saque pendente encontrada para processar.', count: 0 };
    }

    const batch = adminDb.batch();
    const now = admin.firestore.Timestamp.now();
    let count = 0;

    querySnapshot.docs.forEach(doc => {
      const data = doc.data();
      // Manual date filtering
      if (data.requestedAt && (data.requestedAt as admin.firestore.Timestamp).toDate() <= oneWeekAgo) {
          batch.update(doc.ref, { 
            status: 'concluido',
            processedAt: now,
            adminNotes: 'Processado automaticamente via sistema.' 
          });
          count++;
      }
    });

    if (count === 0) {
        return { success: true, message: 'Nenhuma solicitação de saque antiga e pendente encontrada para processar.', count: 0 };
    }

    await batch.commit();

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
