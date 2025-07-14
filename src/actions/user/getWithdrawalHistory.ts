
'use server';

import { initializeAdmin } from '@/lib/firebase/admin';
import type { WithdrawalRequestWithId } from '@/types/wallet';
import type { Timestamp } from 'firebase-admin/firestore';

/**
 * Fetches the withdrawal history for a specific user.
 * This runs on the server with admin privileges to bypass client-side security rules.
 * @param userId The UID of the user whose withdrawal history should be fetched.
 * @returns A promise that resolves to an array of WithdrawalRequestWithId objects.
 */
export async function getWithdrawalHistoryForUser(userId: string): Promise<WithdrawalRequestWithId[]> {
  if (!userId) {
    return [];
  }

  try {
    const adminDb = await initializeAdmin();
    const q = adminDb.collection('withdrawal_requests').where('userId', '==', userId).orderBy('requestedAt', 'desc');
    const querySnapshot = await q.get();

    if (querySnapshot.empty) {
      return [];
    }

    const requests = querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        requestedAt: (data.requestedAt as Timestamp).toDate().toISOString(),
        processedAt: data.processedAt ? (data.processedAt as Timestamp).toDate().toISOString() : undefined,
      } as WithdrawalRequestWithId;
    });

    return requests;
  } catch (error) {
    console.error(`[GET_WITHDRAWAL_HISTORY] Error fetching history for user ${userId}:`, error);
    return [];
  }
}
