'use server';

import { initializeAdmin } from '@/lib/firebase/admin';
import type { FirestoreUser } from '@/types/user';
import admin from 'firebase-admin';

export async function syncLegacySellers(): Promise<{ success: boolean; message: string }> {
  try {
    const adminDb = await initializeAdmin();
    const leadsRef = adminDb.collection('crm_leads');
    const usersRef = adminDb.collection('users');
    let leadsReattributed = 0;
    let usersCreated = 0;
    let leadsSynced = 0;

    // --- Pre-fetch all users to create a map for lookups ---
    const allUsersSnapshot = await usersRef.get();
    const userMapByName = new Map<string, string>(); // Map from displayName.toUpperCase() -> uid
    let karattyUid: string | undefined;

    allUsersSnapshot.forEach(doc => {
        const user = doc.data() as FirestoreUser;
        if (user.displayName) {
            const upperCaseName = user.displayName.trim().toUpperCase();
            userMapByName.set(upperCaseName, doc.id);
            if (upperCaseName === 'KARATTY VICTORIA') {
                karattyUid = doc.id;
            }
        }
    });

    // --- Step 1: Re-attribute leads from "Lucas de Moura" to "Karatty Victoria" ---
    const nameVariations = ['LUCAS DE MOURA', 'Lucas de Moura'];
    const reattributionPromises = nameVariations.map(name => 
        leadsRef.where('sellerName', '==', name).get()
    );
    
    const reattributionSnapshots = await Promise.all(reattributionPromises);
    const leadsToUpdate = new Map<string, admin.firestore.QueryDocumentSnapshot>();
    reattributionSnapshots.forEach(snapshot => {
        snapshot.docs.forEach(doc => {
            if (!leadsToUpdate.has(doc.id)) {
                leadsToUpdate.set(doc.id, doc);
            }
        });
    });

    if (leadsToUpdate.size > 0) {
        const reattributionBatch = adminDb.batch();
        const updatePayload: { sellerName: string; userId?: string } = { sellerName: 'Karatty Victoria' };
        if (karattyUid) {
            updatePayload.userId = karattyUid;
        }
        leadsToUpdate.forEach(doc => {
            reattributionBatch.update(doc.ref, updatePayload);
        });
        await reattributionBatch.commit();
        leadsReattributed = leadsToUpdate.size;
    }

    // --- Step 2: Create missing user documents from unique seller names ---
    const allLeadsSnapshot = await leadsRef.get();
    const sellerNamesFromLeads = new Map<string, string>(); // Map of upperCaseName -> originalCaseName
    allLeadsSnapshot.forEach(doc => {
      const sellerName = doc.data().sellerName;
      if (sellerName && typeof sellerName === 'string' && sellerName.trim() !== '') {
        const trimmedName = sellerName.trim();
        // Only add if not already present to keep the first encountered casing
        if (!sellerNamesFromLeads.has(trimmedName.toUpperCase())) {
            sellerNamesFromLeads.set(trimmedName.toUpperCase(), trimmedName);
        }
      }
    });
    
    const sellersToCreate = Array.from(sellerNamesFromLeads.keys()).filter(
      upperCaseName => !userMapByName.has(upperCaseName)
    );

    if (sellersToCreate.length > 0) {
      const creationBatch = adminDb.batch();
      for (const upperCaseName of sellersToCreate) {
        const originalName = sellerNamesFromLeads.get(upperCaseName)!;
        const newUserRef = usersRef.doc();
        const newUserForFirestore: Omit<FirestoreUser, 'uid'> = {
          displayName: originalName,
          email: null,
          cpf: '',
          phone: '',
          type: 'vendedor',
          createdAt: admin.firestore.Timestamp.now(),
          photoURL: `https://placehold.co/40x40.png?text=${originalName.charAt(0).toUpperCase()}`,
          personalBalance: 0,
          mlmBalance: 0,
          canViewLeadPhoneNumber: false,
          canViewCrm: true, // Default to true for new sellers
          canViewCareerPlan: true, // Default to true
        };
        creationBatch.set(newUserRef, newUserForFirestore);
        userMapByName.set(upperCaseName, newUserRef.id);
      }
      await creationBatch.commit();
      usersCreated = sellersToCreate.length;
    }
    
    // --- Step 3: Sync ALL leads with their correct user ID ---
    const syncBatch = adminDb.batch();
    // Re-fetch all leads in case any were re-attributed in step 1
    const allLeadsForSyncSnapshot = await leadsRef.get(); 

    allLeadsForSyncSnapshot.docs.forEach(doc => {
        const lead = doc.data();
        if (lead.sellerName && typeof lead.sellerName === 'string') {
            const sellerNameUpper = lead.sellerName.trim().toUpperCase();
            if (userMapByName.has(sellerNameUpper)) {
                const correctUserId = userMapByName.get(sellerNameUpper)!;
                if (!lead.userId || lead.userId !== correctUserId) {
                    syncBatch.update(doc.ref, { userId: correctUserId });
                    leadsSynced++;
                }
            }
        }
    });

    if (leadsSynced > 0) {
        await syncBatch.commit();
    }
    
    // --- Construct the summary message ---
    let summaryParts: string[] = [];
    if (leadsReattributed > 0) {
      summaryParts.push(`${leadsReattributed} lead(s) de 'Lucas de Moura' foram reatribuídos para 'Karatty Victoria'.`);
    }
    if (usersCreated > 0) {
      summaryParts.push(`${usersCreated} novo(s) usuário(s) de vendedor foram criados.`);
    }
    if (leadsSynced > 0) {
      summaryParts.push(`${leadsSynced} lead(s) foram sincronizados com o ID de usuário correto.`);
    }
    
    if (summaryParts.length === 0) {
      summaryParts.push("Nenhuma alteração necessária. Vendedores e leads já estão sincronizados.");
    }

    return {
      success: true,
      message: summaryParts.join(' '),
    };

  } catch (error) {
    console.error('[SYNC_LEGACY_SELLERS] Critical error:', error);
    const errorMessage = error instanceof Error ? error.message : "Ocorreu um erro desconhecido no servidor.";
    return {
      success: false,
      message: `Falha na sincronização: ${errorMessage}`,
    };
  }
}
