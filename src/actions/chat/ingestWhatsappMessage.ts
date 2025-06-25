'use server';
/**
 * @fileOverview A server action to ingest and process incoming WhatsApp messages.
 */

import { z } from 'zod';
import admin from 'firebase-admin';
import type { LeadDocumentData, ChatMessage } from '@/types/crm';
import type { Timestamp } from 'firebase-admin/firestore';
import { initializeAdmin } from '@/lib/firebase/admin';


const IngestWhatsappMessageInputSchema = z.any();
export type IngestWhatsappMessageInput = z.infer<typeof IngestWhatsappMessageInputSchema>;

const IngestWhatsappMessageOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  leadId: z.string().optional(),
});
export type IngestWhatsappMessageOutput = z.infer<typeof IngestWhatsappMessageOutputSchema>;

// --- Main Server Action ---

export async function ingestWhatsappMessage(payload: IngestWhatsappMessageInput): Promise<IngestWhatsappMessageOutput> {
  const adminDb = await initializeAdmin();

  try {
      const entry = payload.entry?.[0];
      const change = entry?.changes?.[0];
      const value = change?.value;
      
      if (value?.messages?.[0]) {
          const message = value.messages[0];
          const from = message.from;
          const contactName = value.contacts?.[0]?.profile?.name || from;
          const messageText = message.text?.body;

          if (!messageText) {
              console.log("[INGEST_ACTION] Ignoring notification without text (e.g., status, media).");
              return { success: true, message: "Notification without text ignored." };
          }
          
          console.log(`[INGEST_ACTION] TEXT MESSAGE: From '${contactName}' (${from}). Content: "${messageText}"`);
          
          const normalizedPhone = from.replace(/\D/g, '');
          const leadsRef = adminDb.collection("crm_leads");
          
          let leadId: string | null = null;
          let leadDoc;
          
          console.log(`[INGEST_ACTION] Searching for lead with phone: ${normalizedPhone}`);
          
          try {
            const q = leadsRef.where("phone", "==", normalizedPhone).limit(1);
            const querySnapshot = await q.get();

            if (!querySnapshot.empty) {
                leadDoc = querySnapshot.docs[0];
                leadId = leadDoc.id;
                console.log(`[INGEST_ACTION] Found existing lead for ${from}: ID ${leadId}`);
            } else {
                console.log(`[INGEST_ACTION] No lead found for phone ${normalizedPhone}. Will create a new one.`);
            }
          } catch (error: any) {
            console.error(`[INGEST_ACTION] ADMIN SDK FAILED to query by phone ${normalizedPhone}:`, error);
            return { success: false, message: `Admin SDK query failed: ${error.message}` };
          }
          
          if (!leadId) {
              console.log(`[INGEST_ACTION] Creating new unassigned lead for ${from}.`);
              const now = admin.firestore.Timestamp.now();

              const leadData: Omit<LeadDocumentData, 'id' | 'signedAt'> = {
                  name: contactName || from,
                  phone: normalizedPhone,
                  email: '',
                  company: '',
                  stageId: 'para-atribuir', // New leads go to the unassigned stage
                  sellerName: 'Sistema', // Placeholder for unassigned
                  userId: 'unassigned', // Placeholder for unassigned
                  leadSource: 'WhatsApp',
                  value: 0,
                  kwh: 0,
                  createdAt: now,
                  lastContact: now,
                  needsAdminApproval: false, // Unassigned leads don't need approval yet
                  correctionReason: ''
              };
              
              const docRef = await adminDb.collection("crm_leads").add(leadData);
              leadId = docRef.id;
              console.log(`[INGEST_ACTION] New unassigned lead created with ID: ${leadId}`);
          }

          if (leadId) {
              const batch = adminDb.batch();
              const chatDocRef = adminDb.collection("crm_lead_chats").doc(leadId);
              const leadRefToUpdate = adminDb.collection("crm_leads").doc(leadId);
              
              const newMessage: Omit<ChatMessage, 'id' | 'timestamp'> & { timestamp: Timestamp } = {
                  text: messageText,
                  sender: 'lead',
                  timestamp: admin.firestore.Timestamp.now(),
              };
              
              const finalMessage = {
                  ...newMessage,
                  id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              };
              
              batch.set(chatDocRef, { messages: admin.firestore.FieldValue.arrayUnion(finalMessage) }, { merge: true });
              batch.update(leadRefToUpdate, { lastContact: admin.firestore.Timestamp.now() });

              await batch.commit();
              console.log(`[INGEST_ACTION] Message saved and lastContact updated for lead ${leadId}.`);
              return { success: true, message: "Message processed and saved.", leadId: leadId };
          } else {
              throw new Error(`CRITICAL FAILURE: Could not create or find lead for ${from}.`);
          }

      } else if (value?.statuses?.[0]) {
          const statusInfo = value.statuses[0];
          if (statusInfo.status === 'failed') {
               console.error(`[INGEST_ACTION_STATUS] ERROR: Message to ${statusInfo.recipient_id} failed. Cause:`, statusInfo.errors?.[0]);
          } else {
               console.log(`[INGEST_ACTION_STATUS] Message status for ${statusInfo.recipient_id}: ${statusInfo.status}`);
          }
          return { success: true, message: "Status processed." };
      
      } else {
          console.log('[INGEST_ACTION] Payload did not contain a valid user message or status. Ignoring.');
          return { success: true, message: "Irrelevant payload ignored." };
      }
  } catch (error) {
      console.error('[INGEST_ACTION] CRITICAL ERROR processing:', error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error.";
      return { success: false, message: `Critical action error: ${errorMessage}` };
  }
}
