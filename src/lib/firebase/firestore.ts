
// src/lib/firebase/firestore.ts
import type { LeadDocumentData, LeadWithId, ChatMessage as ChatMessageType, StageId } from '@/types/crm';
import type { WithdrawalRequestData, WithdrawalRequestWithId, PixKeyType, WithdrawalStatus, WithdrawalType } from '@/types/wallet';
import type { FirestoreUser } from '@/types/user';
import { Timestamp, collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, where, orderBy, arrayUnion, getDoc, writeBatch } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { uploadFile } from './storage';

// --- Leads ---

export async function createCrmLead(
  leadData: Omit<LeadDocumentData, 'id' | 'createdAt' | 'lastContact' | 'userId'>,
  photoDocumentFile?: File, 
  billDocumentFile?: File
): Promise<LeadWithId> {
  const userId = auth.currentUser?.uid;
  if (!userId) throw new Error("Usuário não autenticado para criar o lead.");

  const fullLeadData: Omit<LeadDocumentData, 'photoDocumentUrl' | 'billDocumentUrl'> = {
    ...leadData,
    userId,
    createdAt: Timestamp.now(),
    lastContact: Timestamp.now(),
    needsAdminApproval: leadData.needsAdminApproval ?? false,
  };

  const docRef = await addDoc(collection(db, "crm_leads"), fullLeadData);
  
  let photoUrl, billUrl;
  const updates: Partial<LeadDocumentData> = {};

  if (photoDocumentFile) {
    photoUrl = await uploadFile(photoDocumentFile, `crm_lead_documents/${docRef.id}/photo_document/${photoDocumentFile.name}`);
    updates.photoDocumentUrl = photoUrl;
  }
  if (billDocumentFile) {
    billUrl = await uploadFile(billDocumentFile, `crm_lead_documents/${docRef.id}/bill_document/${billDocumentFile.name}`);
    updates.billDocumentUrl = billUrl;
  }

  if (photoUrl || billUrl) {
    await updateDoc(docRef, updates);
  }

  // Ensure createdAt and lastContact are strings for the return type
  const createdAtStr = (fullLeadData.createdAt as Timestamp).toDate().toISOString();
  const lastContactStr = (fullLeadData.lastContact as Timestamp).toDate().toISOString();

  return { 
    ...(fullLeadData as LeadDocumentData), // Cast to include potential urls in type
    ...updates,
    id: docRef.id, 
    createdAt: createdAtStr,
    lastContact: lastContactStr,
  };
}


export async function fetchCrmLeads(
  // currentUser: AppUser
): Promise<LeadWithId[]> {
  // This is a placeholder as the component using it is mocked.
  // In a real scenario, you'd implement logic based on the currentUser role.
  console.log("Placeholder: fetchCrmLeads called");
  return MOCK_SELLER_LEADS_FIRESTORE;
}

export async function updateCrmLeadStage(
  leadId: string, 
  newStageId: StageId, 
  newLastContactIso: string, 
  updates?: Partial<LeadDocumentData>
): Promise<void> {
  console.log("Placeholder: updateCrmLeadStage called for lead:", leadId, "to stage:", newStageId, "with updates:", updates);
  const leadRef = doc(db, "crm_leads", leadId);
  await updateDoc(leadRef, {
    stageId: newStageId,
    lastContact: Timestamp.fromDate(new Date(newLastContactIso)),
    ...updates
  });
}

export async function updateCrmLeadDetails(
  leadId: string,
  updates: Partial<Omit<LeadDocumentData, 'createdAt' | 'userId'>> & { lastContactIso: string }
): Promise<void> {
  console.log("Placeholder: updateCrmLeadDetails called for lead:", leadId, "with updates:", updates);
  const { lastContactIso, ...otherUpdates } = updates;
  const leadRef = doc(db, "crm_leads", leadId);
  await updateDoc(leadRef, {
    ...otherUpdates,
    lastContact: Timestamp.fromDate(new Date(lastContactIso)),
  });
}


export async function deleteCrmLead(leadId: string): Promise<void> {
  console.log("Placeholder: deleteCrmLead called for lead:", leadId);
  const leadRef = doc(db, "crm_leads", leadId);
  // Optionally delete associated files from Storage and chat document
  await deleteDoc(leadRef);
}

// --- Lead Approval Flow ---

export async function approveCrmLead(leadId: string): Promise<void> {
  const leadRef = doc(db, "crm_leads", leadId);
  await updateDoc(leadRef, {
    stageId: 'contato', // Move to the first active stage after approval
    needsAdminApproval: false,
    correctionReason: '', // Clear correction reason
    lastContact: Timestamp.now(),
  });
}

export async function requestCrmLeadCorrection(leadId: string, reason: string): Promise<void> {
  const leadRef = doc(db, "crm_leads", leadId);
  await updateDoc(leadRef, {
    stageId: 'contato', // Revert to a previous stage to be handled by seller
    correctionReason: reason,
    needsAdminApproval: false, 
    lastContact: Timestamp.now(),
  });
}


// --- Chat ---

export async function fetchChatHistory(leadId: string): Promise<ChatMessageType[]> {
  const chatDocRef = doc(db, "crm_lead_chats", leadId);
  const chatDoc = await getDoc(chatDocRef);
  if (chatDoc.exists()) {
    const messages = (chatDoc.data().messages || []) as any[]; // Use any[] to handle Firestore Timestamps
    return messages
      .map(msg => ({
        ...msg,
        // Ensure timestamp is a string for the client
        timestamp: (msg.timestamp as Timestamp).toDate().toISOString() 
      }))
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }
  return [];
}

export async function saveChatMessage(
  leadId: string, 
  messageData: { text: string; sender: 'user' | 'lead' }
): Promise<ChatMessageType> {
  const batch = writeBatch(db);
  
  // 1. Reference to the chat document
  const chatDocRef = doc(db, "crm_lead_chats", leadId);
  const newMessage: Omit<ChatMessageType, 'timestamp'> & { timestamp: Timestamp } = {
    id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    ...messageData,
    timestamp: Timestamp.now(),
  };
  // Add the new message to the chat document, creating it if it doesn't exist.
  batch.set(chatDocRef, { messages: arrayUnion(newMessage) }, { merge: true });

  // 2. Reference to the lead document to update lastContact
  const leadRef = doc(db, "crm_leads", leadId);
  batch.update(leadRef, { lastContact: Timestamp.now() });

  // 3. Commit both operations atomically
  await batch.commit();

  return {
    ...newMessage,
    timestamp: newMessage.timestamp.toDate().toISOString() 
  };
}


// --- WhatsApp Integration Helpers ---

export async function findLeadByPhoneNumber(phoneNumber: string): Promise<LeadWithId | null> {
  const q = query(collection(db, "crm_leads"), where("phone", "==", phoneNumber));
  const querySnapshot = await getDocs(q);
  if (!querySnapshot.empty) {
    const docSnap = querySnapshot.docs[0];
    const data = docSnap.data() as LeadDocumentData;
    return { 
      id: docSnap.id, 
      ...data,
      createdAt: (data.createdAt as Timestamp).toDate().toISOString(),
      lastContact: (data.lastContact as Timestamp).toDate().toISOString(),
    } as LeadWithId;
  }
  return null;
}

export async function createLeadFromWhatsapp(contactName: string, phoneNumber: string, firstMessageText: string): Promise<string | null> {
  const DEFAULT_ADMIN_UID = "QV5ozufTPmOpWHFD2DYE6YRfuE43"; 
  const DEFAULT_ADMIN_EMAIL = "lucasmoura@sentenergia.com";

  const now = Timestamp.now();

  const leadData: Omit<LeadDocumentData, 'id'> = {
    name: contactName || phoneNumber,
    phone: phoneNumber,
    email: '',
    company: '',
    stageId: 'contato', // Start in 'contato', but approval is needed
    sellerName: DEFAULT_ADMIN_EMAIL, // Assign to a default seller/admin
    userId: DEFAULT_ADMIN_UID,
    leadSource: 'WhatsApp',
    value: 0, 
    kwh: 0,
    createdAt: now,
    lastContact: now,
    needsAdminApproval: true, // New leads from WhatsApp require approval
    correctionReason: ''
  };

  try {
    const docRef = await addDoc(collection(db, "crm_leads"), leadData);
    console.log(`[Firestore] Lead document created successfully with ID: ${docRef.id}`);

    // Save the first message to the chat history for this new lead
    if (firstMessageText) {
      await saveChatMessage(docRef.id, { text: firstMessageText, sender: 'lead' });
    }

    return docRef.id;
  } catch (error) {
    console.error("[Firestore] Error creating lead from WhatsApp:", error);
    return null;
  }
}

// --- Wallet / Commission Functions (Placeholders) ---

export async function requestWithdrawal(userId: string, userEmail: string, userName: string | undefined, amount: number, pixKeyType: PixKeyType, pixKey: string, withdrawalType: WithdrawalType): Promise<string | null> {
  const newRequest: WithdrawalRequestData = { userId, userEmail, userName, amount, pixKeyType, pixKey, withdrawalType, status: 'pendente', requestedAt: Timestamp.now() };
  const docRef = await addDoc(collection(db, "withdrawal_requests"), newRequest);
  return docRef.id;
}

export async function fetchWithdrawalHistory(userId: string): Promise<WithdrawalRequestWithId[]> {
  const q = query(collection(db, "withdrawal_requests"), where("userId", "==", userId), orderBy("requestedAt", "desc"));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => {
    const data = doc.data() as WithdrawalRequestData;
    return {
      id: doc.id,
      ...data,
      requestedAt: (data.requestedAt as Timestamp).toDate().toISOString(),
      processedAt: data.processedAt ? (data.processedAt as Timestamp).toDate().toISOString() : undefined,
    };
  });
}

// --- Mock Data (for components not yet fully integrated) ---
const MOCK_SELLER_LEADS_FIRESTORE: LeadWithId[] = [
    { id: 'slead1', name: 'Loja de Roupas Elegance', company: 'Elegance Modas LTDA', value: 3500, kwh: 1200, stageId: 'proposta', sellerName: 'vendedor1@example.com', createdAt: new Date(Date.now() - 86400000 * 2).toISOString(), lastContact: new Date().toISOString(), userId: 'user1', needsAdminApproval: false, leadSource: "Indicação" },
    { id: 'slead2', name: 'Restaurante Sabor Caseiro', value: 8000, kwh: 3000, stageId: 'assinado', sellerName: 'vendedor1@example.com', createdAt: new Date(Date.now() - 86400000 * 15).toISOString(), lastContact: new Date(Date.now() - 86400000 * 1).toISOString(), userId: 'user1', needsAdminApproval: false, leadSource: "Tráfego Pago" },
    { id: 'slead3', name: 'Oficina Mecânica Rápida', value: 1500, kwh: 600, stageId: 'fatura', sellerName: 'vendedor1@example.com', createdAt: new Date().toISOString(), lastContact: new Date().toISOString(), userId: 'user1', needsAdminApproval: false, leadSource: "Porta a Porta (PAP)" },
];
