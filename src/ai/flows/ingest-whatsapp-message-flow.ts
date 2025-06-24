
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
import { admin, adminDb } from '@/lib/firebase/admin';
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

// --- Internal Helper Functions ---

async function findLeadByPhoneNumber(phoneNumber: string): Promise<LeadWithId | null> {
    const normalizedPhone = phoneNumber.replace(/\D/g, '');
    const leadsRef = adminDb.collection("crm_leads");
    const q = leadsRef.where("phone", "==", normalizedPhone);
    
    try {
        const querySnapshot = await q.get();
        if (!querySnapshot.empty) {
            const leadDoc = querySnapshot.docs[0];
            const leadData = leadDoc.data() as LeadDocumentData;
            console.log(`[INGEST_FLOW] Lead encontrado para ${phoneNumber}: ID ${leadDoc.id}`);
            return {
                id: leadDoc.id,
                ...leadData,
                createdAt: (leadData.createdAt as Timestamp).toDate().toISOString(),
                lastContact: (leadData.lastContact as Timestamp).toDate().toISOString(),
                signedAt: leadData.signedAt ? (leadData.signedAt as Timestamp).toDate().toISOString() : undefined,
            };
        }
        console.log(`[INGEST_FLOW] Nenhum lead encontrado para o número ${phoneNumber}`);
        return null;
    } catch (error) {
        console.error(`[INGEST_FLOW] Erro ao buscar lead por telefone ${phoneNumber}:`, error);
        return null; 
    }
}

async function saveLeadMessage(leadId: string, messageText: string, sender: 'lead' | 'user'): Promise<void> {
    const batch = adminDb.batch();
    const chatDocRef = adminDb.collection("crm_lead_chats").doc(leadId);
    const leadRef = adminDb.collection("crm_leads").doc(leadId);
    
    const newMessage: Omit<ChatMessage, 'timestamp'> & { timestamp: Timestamp } = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        text: messageText,
        sender: sender,
        timestamp: admin.firestore.Timestamp.now(),
    };
    
    // Using FieldValue.arrayUnion to append to the messages array atomically.
    batch.set(chatDocRef, { messages: admin.firestore.FieldValue.arrayUnion(newMessage) }, { merge: true });
    batch.update(leadRef, { lastContact: admin.firestore.Timestamp.now() });

    await batch.commit();
    console.log(`[INGEST_FLOW] Mensagem salva e lastContact atualizado para o lead ${leadId}.`);
}

async function findOrCreateLeadFromWhatsapp(contactName: string, phoneNumber: string, firstMessageText: string): Promise<string | null> {
  const existingLead = await findLeadByPhoneNumber(phoneNumber);
  
  if (existingLead) {
    console.log(`[INGEST_FLOW] Lead ${existingLead.id} já existe. Adicionando mensagem ao histórico.`);
    if (firstMessageText) {
      await saveLeadMessage(existingLead.id, firstMessageText, 'lead');
    }
    return existingLead.id;
  }

  console.log(`[INGEST_FLOW] Criando novo lead para ${phoneNumber}.`);
  const DEFAULT_ADMIN_UID = "QV5ozufTPmOpWHFD2DYE6YRfuE43"; 
  const DEFAULT_ADMIN_EMAIL = "lucasmoura@sentenergia.com";
  const now = admin.firestore.Timestamp.now();

  const leadData: Omit<LeadDocumentData, 'id' | 'signedAt'> = {
    name: contactName || phoneNumber,
    phone: phoneNumber.replace(/\D/g, ''),
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

  try {
    const docRef = await adminDb.collection("crm_leads").add(leadData);
    console.log(`[INGEST_FLOW] Novo lead criado com ID: ${docRef.id}`);

    if (firstMessageText) {
      await saveLeadMessage(docRef.id, firstMessageText, 'lead');
    }
    return docRef.id;
  } catch (error) {
    console.error("[INGEST_FLOW] Erro ao criar lead no Firestore:", error);
    return null;
  }
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

        if (value?.messages?.[0]) {
            const message = value.messages[0];
            const from = message.from;
            const contactName = value.contacts?.[0]?.profile?.name || from;
            const messageText = message.text?.body;

            if (messageText) {
                console.log(`[INGEST_FLOW] MENSAGEM DE TEXTO: De '${contactName}' (${from}). Conteúdo: "${messageText}"`);
                const leadId = await findOrCreateLeadFromWhatsapp(contactName, from, messageText);
                if (leadId) {
                    return { success: true, message: "Mensagem processada e salva.", leadId: leadId };
                } else {
                    return { success: false, message: `FALHA: Não foi possível criar ou encontrar lead para ${from}.` };
                }
            } else {
                 console.log("[INGEST_FLOW] Ignorando notificação sem texto (ex: status, mídia).");
                 return { success: true, message: "Notificação sem texto ignorada." };
            }
        } else if (value?.statuses?.[0]) {
            const statusInfo = value.statuses[0];
            if (statusInfo.status === 'failed') {
                 console.error(`[INGEST_FLOW_STATUS] ERRO: A mensagem para ${statusInfo.recipient_id} falhou. Causa:`, statusInfo.errors?.[0]);
            } else {
                 console.log(`[INGEST_FLOW_STATUS] Status da mensagem para ${statusInfo.recipient_id}: ${statusInfo.status}`);
            }
            return { success: true, message: "Status processado." };
        } else {
            console.log('[INGEST_FLOW] Payload não continha uma mensagem de usuário ou status válido. Ignorando.');
            return { success: true, message: "Payload irrelevante ignorado." };
        }
    } catch (error) {
        console.error('[INGEST_FLOW] ERRO CRÍTICO no processamento do flow:', error);
        const errorMessage = error instanceof Error ? error.message : "Erro desconhecido.";
        return { success: false, message: `Erro crítico no flow: ${errorMessage}` };
    }
  }
);
