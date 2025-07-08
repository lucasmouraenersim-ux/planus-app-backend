'use server';
/**
 * @fileOverview A server action for an administrator to delete a user.
 * This action handles both Firebase Authentication user deletion and
 * the corresponding Firestore document deletion. It also reassigns any
 * leads owned by the deleted user.
 */

import { z } from 'zod';
import admin from 'firebase-admin';
import { initializeAdmin } from '@/lib/firebase/admin';

const DeleteUserInputSchema = z.string().min(1, "User ID is required.");
export type DeleteUserInput = z.infer<typeof DeleteUserInputSchema>;

const DeleteUserOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});
export type DeleteUserOutput = z.infer<typeof DeleteUserOutputSchema>;

export async function deleteUser(userId: DeleteUserInput): Promise<DeleteUserOutput> {
  try {
    const adminDb = await initializeAdmin();
    const adminAuth = admin.auth();

    // 1. Delete user from Firebase Authentication
    await adminAuth.deleteUser(userId);
    console.log(`[DELETE_USER_ACTION] Successfully deleted user from Auth: ${userId}`);

    // 2. Delete user document from Firestore
    const userDocRef = adminDb.collection("users").doc(userId);
    await userDocRef.delete();
    console.log(`[DELETE_USER_ACTION] Successfully deleted user document from Firestore: ${userId}`);

    // 3. Reassign leads from the deleted user to an 'unassigned' state
    const leadsRef = adminDb.collection("crm_leads");
    const q = leadsRef.where("userId", "==", userId);
    const querySnapshot = await q.get();

    if (!querySnapshot.empty) {
        const batch = adminDb.batch();
        querySnapshot.forEach(doc => {
            batch.update(doc.ref, { 
                userId: 'unassigned',
                sellerName: 'Sistema',
                stageId: 'para-atribuir' // Move back to unassigned pool
            });
        });
        await batch.commit();
        console.log(`[DELETE_USER_ACTION] Reassigned ${querySnapshot.size} leads from deleted user ${userId}.`);
    }

    return {
      success: true,
      message: "Usuário e dados associados foram excluídos com sucesso.",
    };

  } catch (error: any) {
    console.error(`[DELETE_USER_ACTION] Critical error deleting user ${userId}:`, error);
    let message = "Ocorreu um erro inesperado ao excluir o usuário.";
    
    // If the user is already deleted from Auth but not Firestore
    if (error.code === 'auth/user-not-found') {
      message = "Usuário não encontrado na autenticação. Tentando limpar apenas os dados do Firestore.";
      try {
        const adminDb = await initializeAdmin();
        const userDocRef = adminDb.collection("users").doc(userId);
        await userDocRef.delete();
        message += " Documento do Firestore foi excluído."
      } catch (dbError) {
          console.error(`[DELETE_USER_ACTION] Firestore cleanup failed for ${userId}:`, dbError);
          message += " Falha ao limpar dados do Firestore."
      }
    }

    return { success: false, message };
  }
}
