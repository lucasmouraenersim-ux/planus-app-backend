'use server';

import { initializeAdmin } from '@/lib/firebase/admin';
import type { LeadDocumentData } from '@/types/crm';
import type admin from 'firebase-admin';

export async function getLandingPageStats(): Promise<{ success: boolean; stats?: { totalKwh: number; pfCount: number; pjCount: number; }; message?: string; }> {
  try {
    const adminDb = await initializeAdmin();
    const leadsRef = adminDb.collection('crm_leads');
    
    // Query for 'assinado' and 'finalizado' leads separately and merge them.
    const assinadoSnapshot = await leadsRef.where('stageId', '==', 'assinado').get();
    const finalizadoSnapshot = await leadsRef.where('stageId', '==', 'finalizado').get();

    const allDocs: admin.firestore.QueryDocumentSnapshot[] = [...assinadoSnapshot.docs, ...finalizadoSnapshot.docs];
    
    if (allDocs.length === 0) {
      console.log('No relevant leads found for landing page stats.');
      return { success: true, stats: { totalKwh: 0, pfCount: 0, pjCount: 0 } };
    }

    let totalKwh = 0;
    let pfCount = 0;
    let pjCount = 0;
    const processedIds = new Set<string>();

    allDocs.forEach(doc => {
      // Avoid double counting if a lead somehow matched both (shouldn't happen)
      if (processedIds.has(doc.id)) return;
      processedIds.add(doc.id);
      
      const lead = doc.data() as LeadDocumentData;
      
      // Ensure kwh is treated as a number
      const kwhValue = Number(lead.kwh) || 0;
      totalKwh += kwhValue;
      
      if (lead.customerType === 'pf') {
        pfCount++;
      } else if (lead.customerType === 'pj') {
        pjCount++;
      }
    });

    return {
      success: true,
      stats: { totalKwh, pfCount, pjCount },
    };

  } catch (error) {
    console.error('[GET_LANDING_STATS] Error fetching stats:', error);
    return {
      success: false,
      message: 'Failed to fetch landing page statistics.',
    };
  }
}
