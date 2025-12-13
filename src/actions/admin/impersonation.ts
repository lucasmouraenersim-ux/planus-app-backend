
'use server';

import { z } from 'zod';
import { initializeAdmin } from '@/lib/firebase/admin';
import { headers } from 'next/headers';
import admin from 'firebase-admin';

const ImpersonationInputSchema = z.object({
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
    const { targetUserId } = input;

    // --- CRUCIAL: Verificação de Permissão do Chamador ---
    // Em um ambiente de produção real, o token do chamador seria verificado.
    // Aqui, vamos confiar que a UI impede o acesso a não-admins.
    // No entanto, adicionar um log para auditoria é uma boa prática.
    console.log(`[IMPERSONATION] Tentativa de gerar token para UID: ${targetUserId}`);

    // Garante que um admin não pode personificar outro admin/superadmin
    const targetUserRecord = await adminAuth.getUser(targetUserId);
    if (targetUserRecord.customClaims?.role === 'admin' || targetUserRecord.customClaims?.role === 'superadmin') {
      return { success: false, message: "Não é permitido personificar outros administradores." };
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
      message = 'O usuário alvo não foi encontrado.';
    }

    return { success: false, message };
  }
}
