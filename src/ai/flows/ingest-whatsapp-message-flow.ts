
'use server';
/**
 * @fileOverview A flow to ingest and process incoming WhatsApp messages from the Meta webhook.
 *
 * - ingestWhatsappMessage - Processes a webhook payload to find or create a lead and save the message.
 * - IngestWhatsappMessageInput - The input type for the function.
 * - IngestWhatsappMessageOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { getFirebaseAdmin, getAdminFirestore } from '@/lib/firebase/admin';
import type { LeadDocumentData, LeadWithId, ChatMessage } from '@/types/crm';
import type { Timestamp } from 'firebase-admin/firestore';

// We use z.any() because the webhook payload is complex and we only care about a few fields.
const IngestWhatsappMessageInputSchema = z.any();
export type IngestWhatsappMessageInput = z.infer<typeof IngestWhatsappMessageInputSchema>;

const IngestWhatsappMessageOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  leadId: z.string().optional(),
});
export type IngestWhatsappMessageOutput = z.infer<typeof IngestWhatsappMessageOutputSchema>;

// This helper function can remain separate as it's a self-contained batch operation.
async function saveLeadMessage(leadId: string, messageText: string, sender: 'lead' | 'user'): Promise<void> {
    const admin = getFirebaseAdmin();
    const adminDb = getAdminFirestore();
    const batch = adminDb.batch();
    const chatDocRef = adminDb.collection("crm_lead_chats").doc(leadId);
    const leadRef = adminDb.collection("crm_leads").doc(leadId);
    
    const newMessage: Omit<ChatMessage, 'timestamp'> & { timestamp: Timestamp } = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        text: messageText,
        sender: sender,
        timestamp: admin.firestore.Timestamp.now(),
    };
    
    batch.set(chatDocRef, { messages: admin.firestore.FieldValue.arrayUnion(newMessage) }, { merge: true });
    batch.update(leadRef, { lastContact: admin.firestore.Timestamp.now() });

    await batch.commit();
    console.log(`[INGEST_FLOW] Message saved and lastContact updated for lead ${leadId}.`);
}


// --- Main Flow ---

export async function ingestWhatsappMessage(input: IngestWhatsappMessageInput): Promise<IngestWhatsappMessageOutput> {
  return ingestWhatsappMessageFlow(input);
}

const ingestWhatsappMessageFlow = ai.defineFlow(
  {
    name: 'ingestWhatsappMessageFlow',
    inputSchema: IngestWhatsappMessageInputSchema,
    outputSchema: IngestWhatsappMessageOutputSchema,
  },
  async (payload) => {
    try {
        const entry = payload.entry?.[0];
        const change = entry?.changes?.[0];
        const value = change?.value;

        // Handle user text messages
        if (value?.messages?.[0]) {
            const message = value.messages[0];
            const from = message.from;
            const contactName = value.contacts?.[0]?.profile?.name || from;
            const messageText = message.text?.body;

            if (!messageText) {
                console.log("[INGEST_FLOW] Ignoring notification without text (e.g., status, media).");
                return { success: true, message: "Notification without text ignored." };
            }
            
            console.log(`[INGEST_FLOW] TEXT MESSAGE: From '${contactName}' (${from}). Content: "${messageText}"`);
            
            const adminDb = getAdminFirestore();
            const normalizedPhone = from.replace(/\D/g, '');
            const leadsRef = adminDb.collection("crm_leads");
            
            // 1. Find existing lead
            console.log(`[INGEST_FLOW] Searching for lead with phone: ${normalizedPhone}`);
            const q = leadsRef.where("phone", "==", normalizedPhone);
            const querySnapshot = await q.get();
            let leadId: string | null = null;
            
            if (!querySnapshot.empty) {
                const leadDoc = querySnapshot.docs[0];
                leadId = leadDoc.id;
                console.log(`[INGEST_FLOW] Found existing lead for ${from}: ID ${leadId}`);
                await saveLeadMessage(leadId, messageText, 'lead');
            } else {
                // 2. Create new lead if not found
                console.log(`[INGEST_FLOW] No lead found. Creating new lead for ${from}.`);
                const admin = getFirebaseAdmin();
                const DEFAULT_ADMIN_UID = "QV5ozufTPmOpWHFD2DYE6YRfuE43"; 
                const DEFAULT_ADMIN_EMAIL = "lucasmoura@sentenergia.com";
                const now = admin.firestore.Timestamp.now();

                const leadData: Omit<LeadDocumentData, 'id' | 'signedAt'> = {
                    name: contactName || from,
                    phone: normalizedPhone,
                    email: '',
                    company: '',
                    stageId: 'contato',
                    sellerName: DEFAULT_ADMIN_EMAIL,
                    userId: DEFAULT_ADMIN_UID,
                    leadSource: 'WhatsApp',
                    value: 0,
                    kwh: 0,
                    createdAt: now,
                    lastContact: now,
                    needsAdminApproval: true,
                    correctionReason: ''
                };
                
                const docRef = await adminDb.collection("crm_leads").add(leadData);
                leadId = docRef.id;
                console.log(`[INGEST_FLOW] New lead created with ID: ${leadId}`);
                await saveLeadMessage(leadId, messageText, 'lead');
            }
            
            if (leadId) {
                return { success: true, message: "Message processed and saved.", leadId: leadId };
            } else {
                // This case should theoretically not be reached with the logic above
                return { success: false, message: `CRITICAL FAILURE: Could not create or find lead for ${from}.` };
            }

        // Handle message status updates
        } else if (value?.statuses?.[0]) {
            const statusInfo = value.statuses[0];
            if (statusInfo.status === 'failed') {
                 console.error(`[INGEST_FLOW_STATUS] ERROR: Message to ${statusInfo.recipient_id} failed. Cause:`, statusInfo.errors?.[0]);
            } else {
                 console.log(`[INGEST_FLOW_STATUS] Message status for ${statusInfo.recipient_id}: ${statusInfo.status}`);
            }
            return { success: true, message: "Status processed." };
        
        // Handle irrelevant payloads
        } else {
            console.log('[INGEST_FLOW] Payload did not contain a valid user message or status. Ignoring.');
            return { success: true, message: "Irrelevant payload ignored." };
        }
    } catch (error) {
        console.error('[INGEST_FLOW] CRITICAL ERROR in flow processing:', error);
        const errorMessage = error instanceof Error ? error.message : "Unknown error.";
        return { success: false, message: `Critical flow error: ${errorMessage}` };
    }
  }
);
