
'use server';

import { initializeAdmin } from '@/lib/firebase/admin';
import type { FirestoreUser } from '@/types/user';
import admin from 'firebase-admin';

export async function syncLegacySellers(): Promise<{ success: boolean; message: string }> {
  try {
    const adminDb = await initializeAdmin();
    const leadsRef = adminDb.collection('crm_leads');
    const usersRef = adminDb.collection('users');
    let leadsReattributedLucas = 0;
    let leadsReattributedSuperFacil = 0;
    let usersCreated = 0;
    let leadsSynced = 0;

    // --- Pre-fetch all users to create a map for lookups ---
    const allUsersSnapshot = await usersRef.get();
    const userMapByName = new Map<string, string>(); // Map from displayName.toUpperCase() -> uid
    let karattyUid: string | undefined;
    let superFacilEnergiaUid: string | undefined;

    allUsersSnapshot.forEach(doc => {
        const user = doc.data() as FirestoreUser;
        if (user.displayName) {
            const upperCaseName = user.displayName.trim().toUpperCase();
            userMapByName.set(upperCaseName, doc.id);
            if (upperCaseName === 'KARATTY VICTORIA') {
                karattyUid = doc.id;
            }
            if (upperCaseName === 'SUPERFACIL ENERGIA') {
                superFacilEnergiaUid = doc.id;
            }
        }
    });

    // --- Step 1A: Re-attribute leads from "Lucas de Moura" to "Karatty Victoria" ---
    const lucasNameVariations = ['LUCAS DE MOURA', 'Lucas de Moura'];
    const lucasReattributionPromises = lucasNameVariations.map(name => 
        leadsRef.where('sellerName', '==', name).get()
    );
    const lucasReattributionSnapshots = await Promise.all(lucasReattributionPromises);
    const lucasLeadsToUpdate = new Map<string, admin.firestore.QueryDocumentSnapshot>();
    lucasReattributionSnapshots.forEach(snapshot => {
        snapshot.docs.forEach(doc => {
            if (!lucasLeadsToUpdate.has(doc.id)) {
                lucasLeadsToUpdate.set(doc.id, doc);
            }
        });
    });

    if (lucasLeadsToUpdate.size > 0) {
        const reattributionBatch = adminDb.batch();
        const updatePayload: { sellerName: string; userId?: string } = { sellerName: 'Karatty Victoria' };
        if (karattyUid) {
            updatePayload.userId = karattyUid;
        }
        lucasLeadsToUpdate.forEach(doc => {
            reattributionBatch.update(doc.ref, updatePayload);
        });
        await reattributionBatch.commit();
        leadsReattributedLucas = lucasLeadsToUpdate.size;
    }

    // --- Step 1B: Re-attribute leads from "Super Facil Solar" variations to "SuperFacil Energia" ---
    const superFacilNameVariations = ['Super Facil solar', 'SuperFacil Solar'];
    const superFacilReattributionPromises = superFacilNameVariations.map(name => 
        leadsRef.where('sellerName', '==', name).get()
    );
    const superFacilReattributionSnapshots = await Promise.all(superFacilReattributionPromises);
    const superFacilLeadsToUpdate = new Map<string, admin.firestore.QueryDocumentSnapshot>();
    superFacilReattributionSnapshots.forEach(snapshot => {
        snapshot.docs.forEach(doc => {
            if (!superFacilLeadsToUpdate.has(doc.id)) {
                superFacilLeadsToUpdate.set(doc.id, doc);
            }
        });
    });

    if (superFacilLeadsToUpdate.size > 0) {
        const reattributionBatch = adminDb.batch();
        const newSellerName = 'SuperFacil Energia';
        const updatePayload: { sellerName: string; userId?: string } = { sellerName: newSellerName };
        if (superFacilEnergiaUid) {
            updatePayload.userId = superFacilEnergiaUid;
        }
        superFacilLeadsToUpdate.forEach(doc => {
            reattributionBatch.update(doc.ref, updatePayload);
        });
        await reattributionBatch.commit();
        leadsReattributedSuperFacil = superFacilLeadsToUpdate.size;
    }


    // --- Step 2: Create missing user documents from unique seller names ---
    const allLeadsSnapshot = await leadsRef.get();
    const sellerNamesFromLeads = new Map<string, string>(); // Map of upperCaseName -> originalCaseName
    allLeadsSnapshot.forEach(doc => {
      const sellerName = doc.data().sellerName;
      if (sellerName && typeof sellerName === 'string' && sellerName.trim() !== '') {
        const trimmedName = sellerName.trim();
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
          canViewCrm: true,
          canViewCareerPlan: true,
        };
        creationBatch.set(newUserRef, newUserForFirestore);
        userMapByName.set(upperCaseName, newUserRef.id);
      }
      await creationBatch.commit();
      usersCreated = sellersToCreate.length;
    }
    
    // --- Step 3: Sync ALL leads with their correct user ID (with batching) ---
    const allLeadsForSyncSnapshot = await leadsRef.get();
    const leadsToSync: { ref: admin.firestore.DocumentReference; userId: string }[] = [];

    for (const doc of allLeadsForSyncSnapshot.docs) {
        const lead = doc.data();
        if (lead.sellerName && typeof lead.sellerName === 'string') {
            const sellerNameUpper = lead.sellerName.trim().toUpperCase();
            if (userMapByName.has(sellerNameUpper)) {
                const correctUserId = userMapByName.get(sellerNameUpper)!;
                if (!lead.userId || lead.userId !== correctUserId) {
                    leadsToSync.push({ ref: doc.ref, userId: correctUserId });
                }
            }
        }
    }
    
    leadsSynced = leadsToSync.length;

    if (leadsSynced > 0) {
        const batchSize = 450;
        for (let i = 0; i < leadsSynced; i += batchSize) {
            const batch = adminDb.batch();
            const chunk = leadsToSync.slice(i, i + batchSize);
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
        summaryParts.push(`${leadsReattributedSuperFacil} lead(s) de 'Super Facil Solar' foram reatribuídos para 'SuperFacil Energia'.`);
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
