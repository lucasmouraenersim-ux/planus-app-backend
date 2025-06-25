
// src/lib/firebase/firestore.ts
import type { LeadDocumentData, LeadWithId, ChatMessage as ChatMessageType, StageId } from '@/types/crm';
import type { WithdrawalRequestData, WithdrawalRequestWithId, PixKeyType, WithdrawalStatus, WithdrawalType } from '@/types/wallet';
import type { FirestoreUser } from '@/types/user';
import { Timestamp, collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, where, orderBy, arrayUnion, getDoc, writeBatch } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { uploadFile } from './storage';

// --- Leads ---

export async function createCrmLead(
  leadData: Omit<LeadDocumentData, 'id' | 'createdAt' | 'lastContact' | 'userId' | 'signedAt'>,
  photoDocumentFile?: File, 
  billDocumentFile?: File
): Promise<LeadWithId> {
  const userId = auth.currentUser?.uid;
  if (!userId) throw new Error("Usuário não autenticado para criar o lead.");

  const fullLeadData: Omit<LeadDocumentData, 'photoDocumentUrl' | 'billDocumentUrl' | 'signedAt'> = {
    ...leadData,
    phone: leadData.phone ? leadData.phone.replace(/\D/g, '') : undefined, // Normalize phone on creation
    userId,
    createdAt: Timestamp.now(),
    lastContact: Timestamp.now(),
    needsAdminApproval: leadData.needsAdminApproval ?? true, // Require approval for manual creation too
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

export async function updateCrmLeadStage(leadId: string, newStageId: StageId): Promise<void> {
  const leadRef = doc(db, "crm_leads", leadId);
  await updateDoc(leadRef, {
    stageId: newStageId,
    lastContact: Timestamp.now(),
  });
}

export async function updateCrmLeadDetails(
  leadId: string,
  updates: Partial<Omit<LeadDocumentData, 'createdAt' | 'userId'>> & { lastContactIso: string }
): Promise<void> {
  console.log("Placeholder: updateCrmLeadDetails called for lead:", leadId, "with updates:", updates);
  const { lastContactIso, ...otherUpdates } = updates;
  // Normalize phone number if it's being updated
  if (otherUpdates.phone) {
    otherUpdates.phone = otherUpdates.phone.replace(/\D/g, '');
  }
  const leadRef = doc(db, "crm_leads", leadId);
  await updateDoc(leadRef, {
    ...otherUpdates,
    lastContact: Timestamp.fromDate(new Date(lastContactIso)),
  });
}


export async function deleteCrmLead(leadId: string): Promise<void> {
  console.log(`Attempting to delete lead ${leadId} and associated data.`);
  const leadRef = doc(db, "crm_leads", leadId);
  const chatDocRef = doc(db, "crm_lead_chats", leadId);
  
  const batch = writeBatch(db);

  batch.delete(leadRef);
  batch.delete(chatDocRef);
  
  // Note: This does not delete associated files from Storage, which would require
  // listing files under the lead's folder and deleting them one by one.
  // This can be added later if necessary.
  
  await batch.commit();
  console.log(`Successfully deleted lead ${leadId} and its chat history.`);
}

// --- Lead Approval Flow ---

export async function approveCrmLead(leadId: string): Promise<void> {
  const leadRef = doc(db, "crm_leads", leadId);
  await updateDoc(leadRef, {
    stageId: 'assinado', // Move to 'signed' stage
    needsAdminApproval: false,
    correctionReason: '', // Clear correction reason
    signedAt: Timestamp.now(), // Set the signature date to now
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

export async function updateCrmLeadSignedAt(leadId: string, newSignedAtIso: string): Promise<void> {
  const leadRef = doc(db, "crm_leads", leadId);
  await updateDoc(leadRef, {
    signedAt: Timestamp.fromDate(new Date(newSignedAtIso)),
    lastContact: Timestamp.now(),
  });
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
