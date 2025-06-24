
'use server';
/**
 * @fileOverview A flow to fetch the chat history for a specific lead.
 * This flow now uses the Firebase Admin SDK to bypass Firestore security rules.
 *
 * - fetchChatHistory - Fetches the chat messages for a given lead ID.
 * - FetchChatHistoryInput - The input type for the function.
 * - FetchChatHistoryOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import type { Timestamp } from 'firebase-admin/firestore';
import type { ChatMessage } from '@/types/crm';
import { adminDb } from '@/lib/firebase/admin';

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

export async function fetchChatHistory(input: FetchChatHistoryInput): Promise<FetchChatHistoryOutput> {
  return fetchChatHistoryFlow(input);
}

const fetchChatHistoryFlow = ai.defineFlow(
  {
    name: 'fetchChatHistoryFlow',
    inputSchema: FetchChatHistoryInputSchema,
    outputSchema: FetchChatHistoryOutputSchema,
  },
  async (leadId) => {
    if (!leadId) {
      console.log("[FETCH_CHAT_FLOW] No leadId provided.");
      return [];
    }

    try {
      const chatDocRef = adminDb.collection("crm_lead_chats").doc(leadId);
      const chatDoc = await chatDocRef.get();

      if (!chatDoc.exists) {
        console.log(`[FETCH_CHAT_FLOW] No chat document found for lead ${leadId}.`);
        return [];
      }

      const messagesData = chatDoc.data()?.messages || [];
      // Ensure all timestamps are converted correctly before sorting
      const formattedMessages = messagesData.map((msg: any) => ({
        ...msg,
        timestamp: (msg.timestamp as Timestamp).toDate().toISOString(),
      })).sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      
      console.log(`[FETCH_CHAT_FLOW] Successfully fetched ${formattedMessages.length} messages for lead ${leadId}.`);
      return formattedMessages;

    } catch (error) {
      console.error(`[FETCH_CHAT_FLOW] Error fetching chat history for lead ${leadId}:`, error);
      // Return empty array on error to prevent the UI from breaking.
      // The error is logged on the server for debugging.
      return [];
    }
  }
);
