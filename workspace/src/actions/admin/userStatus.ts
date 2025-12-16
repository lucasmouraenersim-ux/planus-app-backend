
'use server';
/**
 * @fileOverview A server action for an administrator to enable or disable a user in Firebase Authentication.
 */

import { initializeAdmin } from '@/lib/firebase/admin';

/**
 * Updates the disabled status of a user in Firebase Authentication.
 * @param uid The UID of the user to update.
 * @param disabled The new disabled status (true to disable, false to enable).
 * @returns An object indicating the success or failure of the operation.
 */
export async function updateUserStatus(uid: string, disabled: boolean): Promise<{ success: boolean; message: string }> {
  if (!uid) {
    return { success: false, message: 'User ID is required.' };
  }

  try {
    const { auth: adminAuth } = await initializeAdmin();
    await adminAuth.updateUser(uid, { disabled });
    
    const status = disabled ? 'desativado' : 'ativado';
    console.log(`[USER_STATUS_ACTION] User ${uid} has been successfully ${status}.`);
    
    return { success: true, message: `Usuário ${status} com sucesso.` };
  } catch (error: any) {
    console.error(`[USER_STATUS_ACTION] Error updating user ${uid}:`, error);
    return { success: false, message: `Falha ao atualizar o status do usuário: ${error.message || 'Erro desconhecido'}.` };
  }
}
