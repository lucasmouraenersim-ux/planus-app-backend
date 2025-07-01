'use server';
/**
 * @fileOverview A server action to fetch aggregated statistics for the landing page.
 */
import { initializeAdmin } from '@/lib/firebase/admin';
import type { LeadDocumentData } from '@/types/crm';
import { z } from 'zod';

const LandingPageStatsSchema = z.object({
  totalKwh: z.number(),
  pfCount: z.number(),
  pjCount: z.number(),
});
export type LandingPageStats = z.infer<typeof LandingPageStatsSchema>;

const GetLandingPageStatsOutputSchema = z.object({
  success: z.boolean(),
  stats: LandingPageStatsSchema.optional(),
  error: z.string().optional(),
});
export type GetLandingPageStatsOutput = z.infer<typeof GetLandingPageStatsOutputSchema>;

export async function getLandingPageStats(): Promise<GetLandingPageStatsOutput> {
  console.log('[GET_STATS_ACTION] Starting to fetch landing page stats...');
  try {
    const adminDb = await initializeAdmin();
    const leadsRef = adminDb.collection("crm_leads");

    // Use a 'where-in' query for efficiency. This is the correct way to query for multiple values in a field.
    const q = leadsRef.where('stageId', 'in', ['assinado', 'finalizado']);
    const querySnapshot = await q.get();

    if (querySnapshot.empty) {
      console.log('[GET_STATS_ACTION] No leads found in "assinado" or "finalizado" stages.');
      return {
        success: true,
        stats: { totalKwh: 0, pfCount: 0, pjCount: 0 },
      };
    }

    console.log(`[GET_STATS_ACTION] Found ${querySnapshot.size} relevant leads.`);

    let totalKwh = 0;
    let pfCount = 0;
    let pjCount = 0;

    querySnapshot.forEach(doc => {
      const lead = doc.data() as LeadDocumentData;
      totalKwh += Number(lead.kwh) || 0;
      if (lead.customerType === 'pf') {
        pfCount++;
      } else if (lead.customerType === 'pj') {
        pjCount++;
      }
    });
    
    console.log(`[GET_STATS_ACTION] Calculated Stats: kWh=${totalKwh}, PF=${pfCount}, PJ=${pjCount}`);

    return {
      success: true,
      stats: { totalKwh, pfCount, pjCount },
    };

  } catch (error: any) {
    console.error('[GET_LANDING_PAGE_STATS] CRITICAL Error fetching stats:', error);
    return {
      success: false,
      error: `Failed to fetch stats: ${error.message}`,
    };
  }
}
