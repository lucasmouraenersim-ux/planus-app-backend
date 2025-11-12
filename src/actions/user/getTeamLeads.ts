
'use server';

import { initializeAdmin } from '@/lib/firebase/admin';
import type { LeadWithId } from '@/types/crm';
import { Timestamp } from 'firebase-admin/firestore'; // Import Timestamp as a value
import { getTeamForUser } from './getTeam';

// Helper to convert Firestore Timestamps in leads to ISO strings for client compatibility
const convertLeadTimestamps = (lead: any): LeadWithId => {
  const convertedLead = { ...lead };
  for (const key of ['createdAt', 'lastContact', 'signedAt', 'completedAt']) {
    if (convertedLead[key] && convertedLead[key] instanceof Timestamp) {
      convertedLead[key] = convertedLead[key].toDate().toISOString();
    }
  }
  return convertedLead as LeadWithId;
};

/**
 * Fetches all leads for a specific user and their entire downline team.
 * This runs on the server with admin privileges.
 * @param userId The UID of the user (leader) whose team's leads should be fetched.
 * @returns A promise that resolves to an array of LeadWithId objects.
 */
export async function getLeadsForTeam(userId: string): Promise<LeadWithId[]> {
    if (!userId) {
        return [];
    }

    try {
        const { db: adminDb } = await initializeAdmin();
        const team = await getTeamForUser(userId); // Fetches downline

        // Include the leader themselves in the list of UIDs to query
        const allTeamUids = [userId, ...team.map(u => u.uid)];
        
        if (allTeamUids.length === 0) {
            return [];
        }
        
        const leadsData: LeadWithId[] = [];
        const leadsRef = adminDb.collection("crm_leads");
        
        // Firestore 'in' queries are limited to 30 items in the array.
        // We must chunk the requests.
        for (let i = 0; i < allTeamUids.length; i += 30) {
            const chunk = allTeamUids.slice(i, i + 30);
            if (chunk.length > 0) {
                const q = leadsRef.where("userId", "in", chunk);
                const querySnapshot = await q.get();
                querySnapshot.forEach(docSnap => {
                    const data = docSnap.data();
                    leadsData.push(convertLeadTimestamps({ id: docSnap.id, ...data }));
                });
            }
        }
        
        return leadsData;

    } catch (error) {
        console.error(`[GET_TEAM_LEADS] Error fetching leads for user ${userId} and team:`, error);
        return [];
    }
}
