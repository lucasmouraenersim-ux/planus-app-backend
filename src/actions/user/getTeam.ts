
'use server';

import { initializeAdmin } from '@/lib/firebase/admin';
import type { FirestoreUser } from '@/types/user';
import type { Timestamp } from 'firebase-admin/firestore';

// Helper to convert Firestore Timestamps to ISO strings for client compatibility
const convertTimestamps = (user: any): FirestoreUser => {
  return {
    ...user,
    createdAt: (user.createdAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
    lastSignInTime: (user.lastSignInTime as Timestamp)?.toDate().toISOString() || undefined,
    termsAcceptedAt: (user.termsAcceptedAt as Timestamp)?.toDate().toISOString() || undefined,
  }
}

/**
 * Fetches all users in a specific user's downline hierarchy.
 * This runs on the server with admin privileges.
 * @param userId The UID of the user whose team should be fetched.
 * @returns A promise that resolves to an array of FirestoreUser objects in the downline.
 */
export async function getTeamForUser(userId: string): Promise<FirestoreUser[]> {
    if (!userId) {
        return [];
    }

    try {
        const { db: adminDb } = await initializeAdmin();
        const usersSnapshot = await adminDb.collection('users').get();
        
        const allUsersByUid = new Map<string, FirestoreUser>();
        usersSnapshot.forEach(doc => {
            const data = doc.data();
            const userWithIsoDates = convertTimestamps({ uid: doc.id, ...data });
            allUsersByUid.set(doc.id, userWithIsoDates);
        });

        const team: FirestoreUser[] = [];
        const queue: string[] = [userId]; // Start with the leader to find their direct downline
        const visited = new Set<string>();

        while (queue.length > 0) {
            const currentUplineId = queue.shift()!;
            if (visited.has(currentUplineId)) {
                continue;
            }
            visited.add(currentUplineId);

            // Find users whose upline is the current user being processed
            for (const user of allUsersByUid.values()) {
                if (user.uplineUid === currentUplineId) {
                    team.push(user);
                    queue.push(user.uid);
                }
            }
        }
        
        return team;

    } catch (error) {
        console.error(`[GET_TEAM_ACTION] Critical error fetching team for user ${userId}:`, error);
        // In case of an error, return an empty array to prevent client-side crashes.
        return [];
    }
}
