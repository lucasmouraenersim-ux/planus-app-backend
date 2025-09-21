
'use server';
/**
 * @fileOverview A server action to send FCM push notifications.
 */

import { z } from 'zod';
import admin from 'firebase-admin';
import { initializeAdmin } from '@/lib/firebase/admin';
import type { FirestoreUser, UserType } from '@/types/user';

const SendFCMNotificationInputSchema = z.object({
  title: z.string().min(1, "O título é obrigatório."),
  body: z.string().min(1, "O corpo da mensagem é obrigatório."),
  targetRole: z.union([z.nativeEnum(require('@/types/user').UserType), z.array(z.nativeEnum(require('@/types/user').UserType))]),
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
    const adminDb = await initializeAdmin();
    const messaging = admin.messaging();

    const rolesToTarget = Array.isArray(input.targetRole) ? input.targetRole : [input.targetRole];

    const usersRef = adminDb.collection("users");
    // As 'in' queries are limited to 10 values, we must query for each role if there are many.
    // For a few roles like 'admin' and 'superadmin', this is fine.
    const q = usersRef.where("type", "in", rolesToTarget);

    const usersSnapshot = await q.get();

    if (usersSnapshot.empty) {
      return { success: true, successCount: 0, failureCount: 0, error: "Nenhum usuário encontrado com o(s) tipo(s) especificado(s)." };
    }

    const tokens: string[] = [];
    usersSnapshot.forEach(doc => {
      const user = doc.data() as FirestoreUser;
      if (user.fcmToken) {
        tokens.push(user.fcmToken);
      }
    });

    if (tokens.length === 0) {
      return { success: true, successCount: 0, failureCount: 0, error: "Nenhum usuário com o(s) tipo(s) especificado(s) possui um token de notificação." };
    }

    const message = {
      notification: {
        title: input.title,
        body: input.body,
      },
      tokens: tokens,
    };
    
    const response = await messaging.sendEachForMulticast(message);
    
    if (response.failureCount > 0) {
      const failedTokens: string[] = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          failedTokens.push(tokens[idx]);
        }
      });
      console.error('Falha ao enviar para os seguintes tokens:', failedTokens);
    }
    
    return {
      success: response.failureCount === 0,
      successCount: response.successCount,
      failureCount: response.failureCount,
      error: response.failureCount > 0 ? `Falha ao enviar ${response.failureCount} notificações.` : undefined,
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
