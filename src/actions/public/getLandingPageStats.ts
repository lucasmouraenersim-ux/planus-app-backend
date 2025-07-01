'use server';

import { initializeAdmin } from '@/lib/firebase/admin';

type Stats = {
  totalKwh: number;
  pfCount: number;
  pjCount: number;
};

type ActionResult = {
  success: boolean;
  stats?: Stats;
  error?: string;
};

export async function getLandingPageStats(): Promise<ActionResult> {
  try {
    const adminDb = await initializeAdmin();
    const leadsRef = adminDb.collection("crm_leads");
    const snapshot = await leadsRef.where('stageId', 'in', ['assinado', 'finalizado']).get();

    if (snapshot.empty) {
      return { success: true, stats: { totalKwh: 0, pfCount: 0, pjCount: 0 } };
    }

    let totalKwh = 0;
    let pfCount = 0;
    let pjCount = 0;

    snapshot.forEach(doc => {
      const lead = doc.data();
      totalKwh += lead.kwh || 0;
      if (lead.customerType === 'pf') {
        pfCount++;
      } else if (lead.customerType === 'pj') {
        pjCount++;
      }
    });

    return {
      success: true,
      stats: {
        totalKwh,
        pfCount,
        pjCount,
      },
    };
  } catch (error) {
    console.error("Error fetching landing page stats:", error);
    return { success: false, error: "Failed to fetch stats." };
  }
}
