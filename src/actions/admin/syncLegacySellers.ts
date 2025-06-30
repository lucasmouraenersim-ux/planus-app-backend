
'use server';

import { initializeAdmin } from '@/lib/firebase/admin';
import type { FirestoreUser } from '@/types/user';
import type { LeadDocumentData } from '@/types/crm';
import admin from 'firebase-admin';

// Helper function to normalize names for comparison (case-insensitive, accent-insensitive)
function normalizeName(name: string | null | undefined): string {
  if (!name) return '';
  return name
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
}


export async function syncLegacySellers(): Promise<{ success: boolean; message: string }> {
  try {
    const adminDb = await initializeAdmin();
    const leadsRef = adminDb.collection('crm_leads');
    const usersRef = adminDb.collection('users');
    let leadsReattributedLucas = 0;
    let leadsReattributedSuperFacil = 0;
    let usersCreated = 0;
    let leadsSynced = 0;
    const BATCH_SIZE = 450;

    // --- Pre-fetch all users to create a map for lookups ---
    const allUsersSnapshot = await usersRef.get();
    const userMapByNormalizedName = new Map<string, string>(); // Map from normalized displayName -> uid
    let karattyUid: string | undefined;
    let superFacilEnergiaUid: string | undefined;
    let superFacilEnergiaOriginalName = 'SuperFacil Energia';

    allUsersSnapshot.forEach(doc => {
        const user = doc.data() as FirestoreUser;
        if (user.displayName) {
            const normalized = normalizeName(user.displayName);
            userMapByNormalizedName.set(normalized, doc.id);

            if (normalized === 'KARATTY VICTORIA') {
                karattyUid = doc.id;
            }
            if (normalized === 'SUPERFACIL ENERGIA') {
                superFacilEnergiaUid = doc.id;
                superFacilEnergiaOriginalName = user.displayName.trim();
            }
        }
    });

    // --- Fetch ALL leads once to avoid case-sensitivity issues with queries ---
    const allLeadsSnapshot = await leadsRef.get();
    const allLeadDocs = allLeadsSnapshot.docs;

    // --- Step 1A: Re-attribute leads from "Lucas de Moura" to "Karatty Victoria" ---
    const lucasLeadsToUpdate = allLeadDocs.filter(doc => {
        const sellerName = doc.data().sellerName;
        return normalizeName(sellerName) === 'LUCAS DE MOURA';
    });

    if (lucasLeadsToUpdate.length > 0) {
        const updatePayload: { sellerName: string; userId?: string } = { sellerName: 'Karatty Victoria' };
        if (karattyUid) {
            updatePayload.userId = karattyUid;
        }
        for (let i = 0; i < lucasLeadsToUpdate.length; i += BATCH_SIZE) {
            const batch = adminDb.batch();
            const chunk = lucasLeadsToUpdate.slice(i, i + BATCH_SIZE);
            chunk.forEach(doc => batch.update(doc.ref, updatePayload));
            await batch.commit();
        }
        leadsReattributedLucas = lucasLeadsToUpdate.length;
    }

    // --- Step 1B: Re-attribute leads from "Super Facil Solar" variations to "SuperFacil Energia" ---
    const superFacilVariations = ['SUPER FACIL SOLAR', 'SUPERFACIL SOLAR'];
    const superFacilLeadsToUpdate = allLeadDocs.filter(doc => {
        const sellerName = doc.data().sellerName;
        return superFacilVariations.includes(normalizeName(sellerName));
    });
    
    if (superFacilLeadsToUpdate.length > 0) {
        const updatePayload: { sellerName: string; userId?: string } = { sellerName: superFacilEnergiaOriginalName };
        if (superFacilEnergiaUid) {
            updatePayload.userId = superFacilEnergiaUid;
        }
        for (let i = 0; i < superFacilLeadsToUpdate.length; i += BATCH_SIZE) {
            const batch = adminDb.batch();
            const chunk = superFacilLeadsToUpdate.slice(i, i + BATCH_SIZE);
            chunk.forEach(doc => batch.update(doc.ref, updatePayload));
            await batch.commit();
        }
        leadsReattributedSuperFacil = superFacilLeadsToUpdate.length;
    }

    // --- Step 2: Create missing user documents from unique seller names in ALL leads ---
    const sellerNamesFromLeads = new Map<string, string>(); // Map of normalizedName -> originalCaseName
    // We re-fetch all leads AFTER re-attribution to get the latest names for this step
    const currentLeadsSnapshot = await leadsRef.get();
    currentLeadsSnapshot.forEach(doc => {
      const sellerName = doc.data().sellerName;
      if (sellerName && typeof sellerName === 'string' && sellerName.trim() !== '') {
        const trimmedName = sellerName.trim();
        const normalized = normalizeName(trimmedName);
        if (!sellerNamesFromLeads.has(normalized)) {
            sellerNamesFromLeads.set(normalized, trimmedName);
        }
      }
    });
    
    const sellersToCreate = Array.from(sellerNamesFromLeads.keys()).filter(
      normalizedName => !userMapByNormalizedName.has(normalizedName)
    );

    if (sellersToCreate.length > 0) {
      const creationBatch = adminDb.batch();
      for (const normalizedName of sellersToCreate) {
        const originalName = sellerNamesFromLeads.get(normalizedName)!;
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
          canViewCrm: true,
          canViewCareerPlan: true,
        };
        creationBatch.set(newUserRef, newUserForFirestore);
        userMapByNormalizedName.set(normalizedName, newUserRef.id);
      }
      await creationBatch.commit();
      usersCreated = sellersToCreate.length;
    }
    
    // --- Step 3: Sync ALL leads with their correct user ID (using the already fetched leads) ---
    const leadsToSync: { ref: admin.firestore.DocumentReference; userId: string }[] = [];
    // Use the most current snapshot again
    const finalLeadsSnapshot = await leadsRef.get();

    for (const doc of finalLeadsSnapshot.docs) {
        const lead = doc.data();
        if (lead.sellerName && typeof lead.sellerName === 'string') {
            const normalizedSellerName = normalizeName(lead.sellerName);
            if (userMapByNormalizedName.has(normalizedSellerName)) {
                const correctUserId = userMapByNormalizedName.get(normalizedSellerName)!;
                if (!lead.userId || lead.userId !== correctUserId) {
                    leadsToSync.push({ ref: doc.ref, userId: correctUserId });
                }
            }
        }
    }
    
    leadsSynced = leadsToSync.length;

    if (leadsSynced > 0) {
        for (let i = 0; i < leadsSynced; i += BATCH_SIZE) {
            const batch = adminDb.batch();
            const chunk = leadsToSync.slice(i, i + BATCH_SIZE);
            for (const { ref, userId } of chunk) {
                batch.update(ref, { userId: userId });
            }
            await batch.commit();
        }
    }
    
    // --- Construct the summary message ---
    let summaryParts: string[] = [];
    if (leadsReattributedLucas > 0) {
      summaryParts.push(`${leadsReattributedLucas} lead(s) de 'Lucas de Moura' foram reatribuídos para 'Karatty Victoria'.`);
    }
    if (leadsReattributedSuperFacil > 0) {
        summaryParts.push(`${leadsReattributedSuperFacil} lead(s) de variações de 'Super Facil Solar' foram reatribuídos para '${superFacilEnergiaOriginalName}'.`);
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
