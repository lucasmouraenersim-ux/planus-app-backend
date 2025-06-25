'use server';
/**
 * @fileOverview A server action to fetch the chat history for a specific lead.
 */

import { z } from 'zod';
import type { Timestamp } from 'firebase-admin/firestore';
import type { ChatMessage } from '@/types/crm';
import { initializeAdmin } from '@/lib/firebase/admin';

const ChatMessageSchema = z.object({
  id: z.string(),
  text: z.string(),
  sender: z.enum(['user', 'lead']),
  timestamp: z.string(),
});

const FetchChatHistoryInputSchema = z.string().describe('The ID of the lead to fetch chat history for.');
export type FetchChatHistoryInput = z.infer<typeof FetchChatHistoryInputSchema>;

const FetchChatHistoryOutputSchema = z.array(ChatMessageSchema);
export type FetchChatHistoryOutput = z.infer<typeof FetchChatHistoryOutputSchema>;

export async function fetchChatHistory(leadId: FetchChatHistoryInput): Promise<FetchChatHistoryOutput> {
  const adminDb = await initializeAdmin();
  console.log(`[FETCH_CHAT_ACTION] Initiated with leadId: '${leadId}'`);

  if (!leadId) {
    console.log("[FETCH_CHAT_ACTION] ABORTING: No leadId provided.");
    return [];
  }

  try {
    const chatDocRef = adminDb.collection("crm_lead_chats").doc(leadId);
    console.log(`[FETCH_CHAT_ACTION] Attempting to get document at path: ${chatDocRef.path}`);
    const chatDoc = await chatDocRef.get();

    if (!chatDoc.exists) {
      console.log(`[FETCH_CHAT_ACTION] Document does not exist for lead ${leadId}. Returning empty array.`);
      return [];
    }
    
    console.log(`[FETCH_CHAT_ACTION] Document found for lead ${leadId}.`);
    const docData = chatDoc.data();
    console.log(`[FETCH_CHAT_ACTION] Document data:`, JSON.stringify(docData, null, 2));

    const messagesData = docData?.messages || [];
    
    if (messagesData.length === 0) {
        console.log(`[FETCH_CHAT_ACTION] Document exists but 'messages' array is empty. Returning empty array.`);
        return [];
    }

    const formattedMessages = messagesData.map((msg: any) => ({
      ...msg,
      timestamp: (msg.timestamp as Timestamp).toDate().toISOString(),
    })).sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    
    console.log(`[FETCH_CHAT_ACTION] Successfully formatted and fetched ${formattedMessages.length} messages for lead ${leadId}.`);
    return formattedMessages;

  } catch (error) {
    console.error(`[FETCH_CHAT_ACTION] CRITICAL ERROR fetching chat history for lead ${leadId}:`, error);
    return [];
  }
}
