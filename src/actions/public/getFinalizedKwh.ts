"use server";

import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function getFinalizedKwh(): Promise<{ success: boolean; totalKwh?: number; error?: string }> {
  try {
    const leadsCollection = collection(db, "crm_leads");
    const q = query(leadsCollection, where("stageId", "==", "finalizado"));
    const querySnapshot = await getDocs(q);

    let totalKwh = 0;
    querySnapshot.forEach((doc) => {
      const lead = doc.data();
      if (typeof lead.kwh === 'number') {
        totalKwh += lead.kwh;
      }
    });

    return { success: true, totalKwh };
  } catch (error) {
    console.error("Error fetching finalized kWh:", error);
    return { success: false, error: "Failed to fetch finalized kWh." };
  }
}
