
// src/app/api/whatsapp/webhook/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { Timestamp, collection, addDoc, getDocs, doc, updateDoc, query, where, writeBatch, arrayUnion } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { LeadDocumentData, LeadWithId, ChatMessage } from '@/types/crm';
import { sendWhatsappMessage } from '@/ai/flows/send-whatsapp-message-flow';

const VERIFY_TOKEN = "testeapi";

async function findLeadByPhoneNumber(phoneNumber: string): Promise<LeadWithId | null> {
    const normalizedPhone = phoneNumber.replace(/\D/g, '');
    const leadsRef = collection(db, "crm_leads");
    const q = query(leadsRef, where("phone", "==", normalizedPhone));
    
    try {
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
            const leadDoc = querySnapshot.docs[0];
            const leadData = leadDoc.data() as LeadDocumentData;
            console.log(`[WHATSAPP_WEBHOOK] Lead encontrado para ${phoneNumber}: ID ${leadDoc.id}`);
            return {
                id: leadDoc.id,
                ...leadData,
                createdAt: (leadData.createdAt as Timestamp).toDate().toISOString(),
                lastContact: (leadData.lastContact as Timestamp).toDate().toISOString(),
            };
        }
        console.log(`[WHATSAPP_WEBHOOK] Nenhum lead encontrado para o número ${phoneNumber}`);
        return null;
    } catch (error) {
        console.error(`[WHATSAPP_WEBHOOK] Erro ao buscar lead por telefone ${phoneNumber}:`, error);
        return null; // Return null on error to allow graceful handling
    }
}

async function saveLeadMessage(leadId: string, messageText: string): Promise<void> {
    const batch = writeBatch(db);
    const chatDocRef = doc(db, "crm_lead_chats", leadId);
    const leadRef = doc(db, "crm_leads", leadId);
    
    const newMessage: Omit<ChatMessage, 'timestamp'> & { timestamp: Timestamp } = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        text: messageText,
        sender: 'lead',
        timestamp: Timestamp.now(),
    };
    
    batch.set(chatDocRef, { messages: arrayUnion(newMessage) }, { merge: true });
    batch.update(leadRef, { lastContact: Timestamp.now() });

    await batch.commit();
    console.log(`[WHATSAPP_WEBHOOK] Mensagem salva e lastContact atualizado para o lead ${leadId}.`);
}


async function findOrCreateLeadFromWhatsapp(contactName: string, phoneNumber: string, firstMessageText: string): Promise<string | null> {
  const existingLead = await findLeadByPhoneNumber(phoneNumber);
  
  if (existingLead) {
    console.log(`[WHATSAPP_WEBHOOK] Lead ${existingLead.id} já existe. Adicionando mensagem ao histórico.`);
    if (firstMessageText) {
      await saveLeadMessage(existingLead.id, firstMessageText);
    }
    return existingLead.id;
  }

  // Se não existir, criar um novo lead
  console.log(`[WHATSAPP_WEBHOOK] Criando novo lead para ${phoneNumber}.`);
  const DEFAULT_ADMIN_UID = "QV5ozufTPmOpWHFD2DYE6YRfuE43"; 
  const DEFAULT_ADMIN_EMAIL = "lucasmoura@sentenergia.com";
  const now = Timestamp.now();

  const leadData: Omit<LeadDocumentData, 'id'> = {
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
    needsAdminApproval: true, // Requires admin approval/assignment
    correctionReason: ''
  };

  try {
    const docRef = await addDoc(collection(db, "crm_leads"), leadData);
    console.log(`[WHATSAPP_WEBHOOK] Novo lead criado com ID: ${docRef.id}`);

    if (firstMessageText) {
      await saveLeadMessage(docRef.id, firstMessageText);
    }
    return docRef.id;
  } catch (error) {
    console.error("[WHATSAPP_WEBHOOK] Erro ao criar lead no Firestore:", error);
    return null;
  }
}


export async function GET(request: NextRequest) {
  console.log('[WHATSAPP_VERIFY] INICIANDO verificação de webhook.');
  const mode = request.nextUrl.searchParams.get('hub.mode');
  const token = request.nextUrl.searchParams.get('hub.verify_token');
  const challenge = request.nextUrl.searchParams.get('hub.challenge');

  console.log(`[WHATSAPP_VERIFY] Modo: ${mode}, Token: ${token ? 'presente' : 'ausente'}, Challenge: ${challenge ? 'presente' : 'ausente'}`);

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('[WHATSAPP_VERIFY] SUCESSO! Token e modo são válidos. Respondendo com o challenge.');
    return new Response(challenge, { status: 200 });
  } else {
    console.error('[WHATSAPP_VERIFY] FALHA na verificação. Token ou modo inválidos.');
    return new Response('Forbidden', { status: 403 });
  }
}

export async function POST(request: NextRequest) {
    console.log('--- [WHATSAPP_WEBHOOK] Nova requisição POST recebida ---');
    try {
        const body = await request.json();
        console.log('[WHATSAPP_WEBHOOK] Payload completo recebido:', JSON.stringify(body, null, 2));

        const entry = body.entry?.[0];
        const change = entry?.changes?.[0];
        const value = change?.value;

        if (value?.messages?.[0]) {
            const message = value.messages[0];
            const from = message.from;
            const contactName = value.contacts?.[0]?.profile?.name || from;
            const messageText = message.text?.body;

            if (messageText) {
                console.log(`[WHATSAPP_WEBHOOK] MENSAGEM DE TEXTO: De '${contactName}' (${from}). Conteúdo: "${messageText}"`);
                const leadId = await findOrCreateLeadFromWhatsapp(contactName, from, messageText);
                if (!leadId) {
                     console.error(`[WHATSAPP_WEBHOOK] FALHA: Não foi possível criar ou encontrar lead para ${from}.`);
                }
            } else {
                 console.log("[WHATSAPP_WEBHOOK] Ignorando notificação sem texto (ex: status, mídia).");
            }
        } else if (value?.statuses?.[0]) {
            const statusInfo = value.statuses[0];
            if (statusInfo.status === 'failed') {
                 console.error(`[WHATSAPP_WEBHOOK_STATUS] ERRO: A mensagem para ${statusInfo.recipient_id} falhou. Causa:`, statusInfo.errors?.[0]);
            } else {
                 console.log(`[WHATSAPP_WEBHOOK_STATUS] Status da mensagem para ${statusInfo.recipient_id}: ${statusInfo.status}`);
            }
        } else {
            console.log('[WHATSAPP_WEBHOOK] Payload não continha uma mensagem de usuário ou status válido. Ignorando.');
        }

        return NextResponse.json({ status: "success" }, { status: 200 });

    } catch (error) {
        console.error('[WHATSAPP_WEBHOOK] ERRO CRÍTICO no processamento do webhook:', error);
        return NextResponse.json({ message: "Erro interno no servidor, mas a notificação foi recebida." }, { status: 200 });
    }
}
