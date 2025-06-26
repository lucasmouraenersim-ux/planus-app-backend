
'use server';
/**
 * @fileOverview A server action to save a chat message and send it via WhatsApp.
 */
import admin from 'firebase-admin';
import { z } from 'zod';
import type { Timestamp } from 'firebase-admin/firestore';
import { sendWhatsappMessage } from '@/actions/whatsapp/sendWhatsappMessage';
import type { ChatMessage } from '@/types/crm';
import { initializeAdmin } from '@/lib/firebase/admin';

const SendChatMessageInputSchema = z.object({
  leadId: z.string(),
  phone: z.string().optional(),
  text: z.string(), // Caption for media, text for text messages
  sender: z.enum(['user', 'lead']),
  type: z.enum(['text', 'image', 'audio']).default('text'),
  mediaUrl: z.string().url().optional(),
});
export type SendChatMessageInput = z.infer<typeof SendChatMessageInputSchema>;

const ChatMessageSchema = z.object({
  id: z.string(),
  text: z.string(),
  sender: z.enum(['user', 'lead']),
  timestamp: z.string(),
  type: z.enum(['text', 'button', 'interactive', 'image', 'audio']).optional(),
  mediaUrl: z.string().url().optional(),
});
const SendChatMessageOutputSchema = z.object({
    success: z.boolean(),
    message: z.string().optional(),
    chatMessage: ChatMessageSchema.optional(),
});
export type SendChatMessageOutput = z.infer<typeof SendChatMessageOutputSchema>;


export async function sendChatMessage({ leadId, phone, text, sender, type = 'text', mediaUrl }: SendChatMessageInput): Promise<SendChatMessageOutput> {
  const adminDb = await initializeAdmin();
  console.log(`[SEND_CHAT_ACTION] Initiated for leadId: '${leadId}' of type '${type}' with text: "${text}"`);

  const leadRef = adminDb.collection("crm_leads").doc(leadId);
  
  try {
    const leadDoc = await leadRef.get();
    if (!leadDoc.exists) {
      console.error(`[SEND_CHAT_ACTION] Lead with ID '${leadId}' not found.`);
      return { success: false, message: `Lead not found with ID: ${leadId}` };
    }
  } catch (error: any) {
     console.error(`[SEND_CHAT_ACTION] CRITICAL ERROR checking for lead existence for lead ${leadId}:`, error);
     return { success: false, message: `A server error occurred while trying to access the database. Please ensure the server has the correct permissions and project configuration. Details: ${error.message}` };
  }
  
  const batch = adminDb.batch();
  const chatDocRef = adminDb.collection("crm_lead_chats").doc(leadId);

  const newMessage: Omit<ChatMessage, 'timestamp'> & { timestamp: Timestamp } = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      text,
      sender,
      type: type,
      ...(mediaUrl && { mediaUrl: mediaUrl }),
      timestamp: admin.firestore.Timestamp.now(),
  };
  
  batch.set(chatDocRef, { messages: admin.firestore.FieldValue.arrayUnion(newMessage) }, { merge: true });
  batch.update(leadRef, { lastContact: admin.firestore.Timestamp.now() });

  try {
      await batch.commit();
      console.log(`[SEND_CHAT_ACTION] Successfully committed message to Firestore for lead ${leadId}.`);
  } catch (error: any) {
      console.error(`[SEND_CHAT_ACTION] Firestore batch commit error for lead ${leadId}:`, error);
      return { success: false, message: `Failed to save message to database: ${error.message}` };
  }

  const savedChatMessage: ChatMessage = {
      ...newMessage,
      timestamp: newMessage.timestamp.toDate().toISOString(),
  };

  if (sender === 'user') {
      if (!phone || phone.trim() === '') {
          console.log(`[SEND_CHAT_ACTION] Message for ${leadId} saved to history, but lead has no phone number. Not sending to WhatsApp.`);
          return { success: true, message: 'Message saved, but lead has no phone number to send to.', chatMessage: savedChatMessage };
      }
      
      console.log(`[SEND_CHAT_ACTION] Attempting to send WhatsApp message to ${phone}.`);
      
      let messagePayload: any;
      if (type === 'image' && mediaUrl) {
          messagePayload = { image: { link: mediaUrl, caption: text } };
      } else if (type === 'audio' && mediaUrl) {
          messagePayload = { audio: { link: mediaUrl } };
      } else {
          messagePayload = { text };
      }

      const whatsappResult = await sendWhatsappMessage({
          to: phone,
          message: messagePayload,
      });

      if (!whatsappResult.success) {
          console.error(`[SEND_CHAT_ACTION] WhatsApp send failed for ${leadId}:`, whatsappResult.error);
          return { success: false, message: `Failed to send WhatsApp message: ${whatsappResult.error}`, chatMessage: savedChatMessage };
      }
      console.log(`[SEND_CHAT_ACTION] WhatsApp message sent successfully for lead ${leadId}.`);
  }
  
  return { success: true, message: 'Message sent and saved successfully.', chatMessage: savedChatMessage };
}
