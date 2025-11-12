
'use server';

import { initializeAdmin } from '@/lib/firebase/admin';
import type { FirestoreUser } from '@/types/user';
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
    const { db: adminDb } = await initializeAdmin();
    const leadsRef = adminDb.collection('crm_leads');
    const usersRef = adminDb.collection('users');
    let leadsReattributedSuperFacil = 0;
    const BATCH_SIZE = 450;

    // --- Pre-fetch all users to create a map for lookups ---
    const allUsersSnapshot = await usersRef.get();
    let targetSellerUid: string | undefined;
    let targetSellerOriginalName = 'SuperFácil Energia'; // Default to the correct name
    const targetSellerNormalizedName = 'SUPERFACIL ENERGIA';

    allUsersSnapshot.forEach(doc => {
        const user = doc.data() as FirestoreUser;
        if (user.displayName) {
            const normalized = normalizeName(user.displayName);
            // Find the target seller, "SuperFácil Energia"
            if (normalized === targetSellerNormalizedName) {
                targetSellerUid = doc.id;
                targetSellerOriginalName = user.displayName.trim();
            }
        }
    });

    if (!targetSellerUid) {
        return {
            success: false,
            message: `Erro: O vendedor de destino "SuperFácil Energia" não foi encontrado. Por favor, crie este usuário primeiro.`
        };
    }

    // --- Fetch ALL leads once to find ones to re-attribute ---
    const allLeadsSnapshot = await leadsRef.get();
    
    // --- Re-attribute leads from "Super Facil Solar" variations to "SuperFácil Energia" ---
    const sourceSellerVariations = ['SUPER FACIL SOLAR', 'SUPERFACIL SOLAR'];
    const leadsToUpdate = allLeadsSnapshot.docs.filter(doc => {
        const sellerName = doc.data().sellerName;
        const normalizedSellerName = normalizeName(sellerName);
        return sourceSellerVariations.includes(normalizedSellerName);
    });
    
    if (leadsToUpdate.length > 0) {
        const updatePayload = { 
            sellerName: targetSellerOriginalName, // Use the correctly cased name from the user profile
            userId: targetSellerUid 
        };
        for (let i = 0; i < leadsToUpdate.length; i += BATCH_SIZE) {
            const batch = adminDb.batch();
            const chunk = leadsToUpdate.slice(i, i + BATCH_SIZE);
            chunk.forEach(doc => batch.update(doc.ref, updatePayload));
            await batch.commit();
        }
        leadsReattributedSuperFacil = leadsToUpdate.length;
    }
    
    // --- Construct the summary message ---
    let summary = `Sincronização concluída. ${leadsReattributedSuperFacil} lead(s) de variações de 'Super Facil Solar' foram reatribuídos para '${targetSellerOriginalName}'.`;
    if (leadsReattributedSuperFacil === 0) {
      summary = "Sincronização concluída. Nenhum lead de 'Super Facil Solar' foi encontrado para reatribuir. Se o problema persistir, verifique se existem outras variações de nome nos leads.";
    }

    return {
      success: true,
      message: summary,
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
