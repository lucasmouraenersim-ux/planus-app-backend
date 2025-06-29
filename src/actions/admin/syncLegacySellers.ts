
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

    // --- Step 1: Re-attribute leads from "LUCAS DE MOURA" to "Karatty Victoria" ---
    const lucasLeadsQuery = leadsRef.where('sellerName', '==', 'LUCAS DE MOURA');
    const lucasLeadsSnapshot = await lucasLeadsQuery.get();

    if (!lucasLeadsSnapshot.empty) {
      const batch = adminDb.batch();
      lucasLeadsSnapshot.docs.forEach(doc => {
        batch.update(doc.ref, { sellerName: 'Karatty Victoria' });
      });
      await batch.commit();
      leadsReattributed = lucasLeadsSnapshot.size;
    }

    // --- Step 2: Sync all seller names from leads to user documents ---
    const allLeadsSnapshot = await leadsRef.get();
    const uniqueSellerNames = new Set<string>();
    allLeadsSnapshot.forEach(doc => {
      const sellerName = doc.data().sellerName;
      if (sellerName && typeof sellerName === 'string' && sellerName.trim() !== '') {
        uniqueSellerNames.add(sellerName.trim());
      }
    });

    const existingUsersSnapshot = await usersRef.get();
    const existingUserDisplayNames = new Set<string>();
    existingUsersSnapshot.forEach(doc => {
      const displayName = doc.data().displayName;
      if (displayName) {
        existingUserDisplayNames.add(displayName.trim());
      }
    });

    const sellersToCreate = Array.from(uniqueSellerNames).filter(
      name => !existingUserDisplayNames.has(name)
    );

    if (sellersToCreate.length > 0) {
      const creationBatch = adminDb.batch();
      for (const sellerName of sellersToCreate) {
        const newUserRef = usersRef.doc(); // Let Firestore generate a new UID
        const newUserForFirestore: Omit<FirestoreUser, 'uid'> = {
          displayName: sellerName,
          email: null, // No email/login
          cpf: '', // No CPF
          phone: '',
          type: 'vendedor',
          createdAt: admin.firestore.Timestamp.now(),
          photoURL: `https://placehold.co/40x40.png?text=${sellerName.charAt(0).toUpperCase()}`,
          personalBalance: 0,
          mlmBalance: 0,
          canViewLeadPhoneNumber: false,
          canViewCrm: false,
          canViewCareerPlan: false,
        };
        creationBatch.set(newUserRef, newUserForFirestore);
      }
      await creationBatch.commit();
      usersCreated = sellersToCreate.length;
    }
    
    // --- Construct the summary message ---
    let summaryParts: string[] = [];
    if (leadsReattributed > 0) {
      summaryParts.push(`${leadsReattributed} lead(s) de LUCAS DE MOURA foram reatribuídos para Karatty Victoria.`);
    }
    if (usersCreated > 0) {
      summaryParts.push(`${usersCreated} novo(s) usuário(s) de vendedor foram criados a partir dos leads.`);
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
