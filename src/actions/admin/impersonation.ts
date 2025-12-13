
'use server';

import { z } from 'zod';
import { initializeAdmin } from '@/lib/firebase/admin';
import { headers } from 'next/headers';
import admin from 'firebase-admin';

const ImpersonationInputSchema = z.object({
  adminUserId: z.string().min(1, 'Admin User ID é obrigatório.'),
  targetUserId: z.string().min(1, 'Target User ID é obrigatório.'),
});

type ImpersonationInput = z.infer<typeof ImpersonationInputSchema>;

const ImpersonationOutputSchema = z.object({
  success: z.boolean(),
  customToken: z.string().optional(),
  message: z.string(),
});

type ImpersonationOutput = z.infer<typeof ImpersonationOutputSchema>;

export async function generateImpersonationToken(
  input: ImpersonationInput
): Promise<ImpersonationOutput> {
  try {
    const { auth: adminAuth } = await initializeAdmin();
    const { adminUserId, targetUserId } = input;

    // --- CRUCIAL: Verificação de Permissão do Chamador ---
    const adminUserRecord = await adminAuth.getUser(adminUserId);
    const adminClaims = adminUserRecord.customClaims || {};

    if (adminClaims.role !== 'admin' && adminClaims.role !== 'superadmin') {
      return { success: false, message: "Permissão negada. Apenas administradores podem personificar usuários." };
    }
    
    console.log(`[IMPERSONATION] Admin '${adminUserRecord.displayName}' (UID: ${adminUserId}) is attempting to impersonate UID: ${targetUserId}`);

    // Garante que um admin não pode personificar outro admin/superadmin
    const targetUserRecord = await adminAuth.getUser(targetUserId);
    const targetClaims = targetUserRecord.customClaims || {};
    if (targetClaims.role === 'admin' || targetClaims.role === 'superadmin') {
      // Allow superadmin to impersonate admin, but not the other way around
      if (adminClaims.role !== 'superadmin') {
        return { success: false, message: "Administradores não podem personificar outros administradores." };
      }
    }
    
    // Gera o token customizado para o UID alvo
    const customToken = await adminAuth.createCustomToken(targetUserId);

    return {
      success: true,
      customToken: customToken,
      message: 'Token de personificação gerado com sucesso.',
    };

  } catch (error: any) {
    console.error('[IMPERSONATION_ACTION] Erro Crítico:', error);
    let message = 'Ocorreu um erro inesperado ao tentar personificar o usuário.';
    
    if (error.code === 'auth/user-not-found') {
      message = 'O usuário alvo ou o administrador não foi encontrado.';
    }

    return { success: false, message };
  }
}
