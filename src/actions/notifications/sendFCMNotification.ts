
'use server';
/**
 * @fileOverview A server action to send FCM push notifications.
 */

import { z } from 'zod';
import { initializeAdmin, admin } from '@/lib/firebase/admin';
import type { FirestoreUser, UserType } from '@/types/user';

// Zod schema for input validation
const UserTypeEnum = z.enum(['admin', 'superadmin', 'vendedor', 'prospector', 'user', 'pending_setup', 'advogado']);

const SendFCMNotificationInputSchema = z.object({
  title: z.string().min(1, "O título é obrigatório."),
  body: z.string().min(1, "O corpo da mensagem é obrigatório."),
  targetRole: z.union([UserTypeEnum, z.array(UserTypeEnum)]),
});
export type SendFCMNotificationInput = z.infer<typeof SendFCMNotificationInputSchema>;

const SendFCMNotificationOutputSchema = z.object({
  success: z.boolean(),
  successCount: z.number(),
  failureCount: z.number(),
  error: z.string().optional(),
});
export type SendFCMNotificationOutput = z.infer<typeof SendFCMNotificationOutputSchema>;

export async function sendFCMNotification(input: SendFCMNotificationInput): Promise<SendFCMNotificationOutput> {
  try {
    console.log('[FCM] Initializing admin...');
    const adminDb = await initializeAdmin();
    
    console.log('[FCM] Getting messaging instance...');
    const messaging = admin.messaging();

    const rolesToTarget = Array.isArray(input.targetRole) ? input.targetRole : [input.targetRole];
    
    console.log('[FCM] Fetching users with roles:', rolesToTarget);

    if (rolesToTarget.length === 0) {
        return { success: false, successCount: 0, failureCount: 0, error: "Nenhum tipo de usuário alvo foi especificado." };
    }

    const usersRef = adminDb.collection("users");
    // As 'in' queries are limited to 30 values, but for roles it should be fine.
    const q = usersRef.where("type", "in", rolesToTarget);

    const usersSnapshot = await q.get();

    if (usersSnapshot.empty) {
      return { success: true, successCount: 0, failureCount: 0, error: "Nenhum usuário encontrado com o(s) tipo(s) especificado(s)." };
    }

    const tokens = usersSnapshot.docs
      .map(doc => doc.data() as FirestoreUser)
      .filter(user => user.fcmToken && typeof user.fcmToken === 'string')
      .map(user => user.fcmToken!);

    if (tokens.length === 0) {
      return { success: true, successCount: 0, failureCount: 0, error: "Nenhum usuário com o(s) tipo(s) especificado(s) possui um token de notificação." };
    }
    
    // FCM can send to up to 500 tokens at once. If you expect more, you would need to chunk this.
    const message = {
      notification: {
        title: input.title,
        body: input.body,
      },
      tokens: tokens,
    };
    
    console.log(`[FCM] Attempting to send notification to ${tokens.length} tokens for roles: ${rolesToTarget.join(', ')}`);
    const response = await messaging.sendEachForMulticast(message);
    console.log(`[FCM] Sent. Success: ${response.successCount}, Failure: ${response.failureCount}`);
    
    if (response.failureCount > 0) {
      const failedTokens: string[] = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          failedTokens.push(tokens[idx]);
          console.error(`[FCM] Failed to send to token: ${tokens[idx]}. Error:`, resp.error);
        }
      });
    }
    
    return {
      success: response.failureCount === 0,
      successCount: response.successCount,
      failureCount: response.failureCount,
      error: response.failureCount > 0 ? `Falha ao enviar ${response.failureCount} notificação(ões).` : undefined,
    };

  } catch (error: any) {
    console.error("[SEND_FCM_NOTIFICATION] Erro crítico:", error);
    return { 
        success: false, 
        successCount: 0, 
        failureCount: 0,
        error: `Erro inesperado no servidor: ${error.message}`
    };
  }
}
