'use server';
/**
 * @fileOverview A server action to fetch the chat history for a specific lead.
 * This function now uses the Firebase Admin SDK directly without being a Genkit flow
 * to avoid authentication conflicts.
 *
 * - fetchChatHistory - Fetches the chat messages for a given lead ID.
 * - FetchChatHistoryInput - The input type for the function.
 * - FetchChatHistoryOutput - The return type for the function.
 */

import { z } from 'zod';
import * as admin from 'firebase-admin';
import type { Timestamp } from 'firebase-admin/firestore';
import type { ChatMessage } from '@/types/crm';

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
  // Use a robust, idempotent initialization for serverless environments
  try {
    if (!admin.apps.length) {
      admin.initializeApp();
      console.log('[FETCH_CHAT_ACTION] Firebase Admin SDK initialized.');
    }
  } catch (e: any) {
    if (e.code !== 'app/duplicate-app') {
      console.error('[FETCH_CHAT_ACTION] CRITICAL: Firebase admin initialization error.', e);
      return []; // Stop execution if init fails
    }
  }
  const adminDb = admin.firestore();
  
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

    // Ensure all timestamps are converted correctly before sorting
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
