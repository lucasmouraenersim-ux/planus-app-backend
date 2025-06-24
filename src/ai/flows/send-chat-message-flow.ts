
'use server';
/**
 * @fileOverview A flow to save a chat message and send it via WhatsApp using the Admin SDK.
 * This ensures the operation has sufficient permissions regardless of Firestore rules.
 */
import { firebaseAi as ai } from '@/ai/firebase-genkit'; // Use the clean Firebase-only instance
import { z } from 'zod';
import * as admin from 'firebase-admin';
import type { Timestamp } from 'firebase-admin/firestore';
import { sendWhatsappMessage } from './send-whatsapp-message-flow';
import type { ChatMessage } from '@/types/crm';

// Use a robust, idempotent initialization for serverless environments
try {
  if (!admin.apps.length) {
    admin.initializeApp();
    console.log('[SEND_CHAT_FLOW] Firebase Admin SDK initialized.');
  }
} catch (e: any) {
  if (e.code !== 'app/duplicate-app') {
    console.error('[SEND_CHAT_FLOW] CRITICAL: Firebase admin initialization error.', e);
  }
}
const adminDb = admin.firestore();


const SendChatMessageInputSchema = z.object({
  leadId: z.string(),
  phone: z.string().optional(),
  text: z.string(),
  sender: z.enum(['user', 'lead']),
});
export type SendChatMessageInput = z.infer<typeof SendChatMessageInputSchema>;

const ChatMessageSchema = z.object({
  id: z.string(),
  text: z.string(),
  sender: z.enum(['user', 'lead']),
  timestamp: z.string(),
});
const SendChatMessageOutputSchema = z.object({
    success: z.boolean(),
    message: z.string().optional(),
    chatMessage: ChatMessageSchema.optional(),
});
export type SendChatMessageOutput = z.infer<typeof SendChatMessageOutputSchema>;


export async function sendChatMessage(input: SendChatMessageInput): Promise<SendChatMessageOutput> {
  return sendChatMessageFlow(input);
}

const sendChatMessageFlow = ai.defineFlow(
  {
    name: 'sendChatMessageFlow',
    inputSchema: SendChatMessageInputSchema,
    outputSchema: SendChatMessageOutputSchema,
  },
  async ({ leadId, phone, text, sender }) => {
    
    // 1. Save the message to Firestore using Admin SDK
    const batch = adminDb.batch();
    const chatDocRef = adminDb.collection("crm_lead_chats").doc(leadId);
    const leadRef = adminDb.collection("crm_leads").doc(leadId);

    const newMessage: Omit<ChatMessage, 'timestamp'> & { timestamp: Timestamp } = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        text,
        sender,
        timestamp: admin.firestore.Timestamp.now(),
    };
    
    // Add message to the chat subcollection and update the lastContact on the lead
    batch.set(chatDocRef, { messages: admin.firestore.FieldValue.arrayUnion(newMessage) }, { merge: true });
    batch.update(leadRef, { lastContact: admin.firestore.Timestamp.now() });

    try {
        await batch.commit();
        console.log(`[CHAT_FLOW] Message for lead ${leadId} saved to Firestore.`);
    } catch (error: any) {
        console.error(`[CHAT_FLOW] Firestore error for lead ${leadId}:`, error);
        return { success: false, message: `Failed to save message to database: ${error.message}` };
    }

    // Prepare the message object to be returned to the client
    const savedChatMessage: ChatMessage = {
        ...newMessage,
        timestamp: newMessage.timestamp.toDate().toISOString(),
    };

    // 2. If sender is 'user', send the message via WhatsApp
    if (sender === 'user') {
        if (!phone || phone.trim() === '') {
            console.log(`[CHAT_FLOW] Message for ${leadId} saved to history, but lead has no phone number.`);
            return { success: true, message: 'Message saved, but lead has no phone number to send to.', chatMessage: savedChatMessage };
        }

        const whatsappResult = await sendWhatsappMessage({
            to: phone,
            message: { text },
        });

        if (!whatsappResult.success) {
            console.error(`[CHAT_FLOW] WhatsApp send failed for ${leadId}:`, whatsappResult.error);
            return { success: false, message: `Failed to send WhatsApp message: ${whatsappResult.error}`, chatMessage: savedChatMessage };
        }
    }
    
    return { success: true, message: 'Message sent and saved successfully.', chatMessage: savedChatMessage };
  }
);
