
// src/lib/firebase/firestore.ts
import type { LeadDocumentData, LeadWithId, ChatMessage as ChatMessageType, StageId } from '@/types/crm';
import type { WithdrawalRequestData, WithdrawalRequestWithId, PixKeyType, WithdrawalStatus, WithdrawalType } from '@/types/wallet';
import type { AppUser, FirestoreUser, UserType } from '@/types/user';
import { Timestamp, collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, where, orderBy, arrayUnion, getDoc, writeBatch } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { uploadFile } from './storage';

// --- Leads ---

export async function createCrmLead(
  leadData: Omit<LeadDocumentData, 'id' | 'createdAt' | 'lastContact' | 'userId' | 'signedAt'>,
  photoDocumentFile?: File, 
  billDocumentFile?: File,
  legalRepresentativeDocumentFile?: File,
  otherDocumentsFile?: File
): Promise<LeadWithId> {
  const userId = auth.currentUser?.uid;
  if (!userId) throw new Error("Usuário não autenticado para criar o lead.");

  // Prepare data, excluding file URLs which are added later
  const baseLeadData: Omit<LeadDocumentData, 'id' | 'signedAt' | 'photoDocumentUrl' | 'billDocumentUrl' | 'legalRepresentativeDocumentUrl' | 'otherDocumentsUrl'> = {
    ...leadData,
    phone: leadData.phone ? leadData.phone.replace(/\D/g, '') : undefined, // Normalize phone on creation
    userId,
    createdAt: Timestamp.now(),
    lastContact: Timestamp.now(),
    needsAdminApproval: leadData.needsAdminApproval ?? true, // Require approval for manual creation
  };

  // Create document in Firestore to get an ID
  const docRef = await addDoc(collection(db, "crm_leads"), baseLeadData);
  
  // Handle file uploads
  const updates: Partial<LeadDocumentData> = {};
  if (photoDocumentFile) {
    const photoPath = `crm_lead_documents/${docRef.id}/photo_${photoDocumentFile.name}`;
    updates.photoDocumentUrl = await uploadFile(photoDocumentFile, photoPath);
  }
  if (billDocumentFile) {
    const billPath = `crm_lead_documents/${docRef.id}/bill_${billDocumentFile.name}`;
    updates.billDocumentUrl = await uploadFile(billDocumentFile, billPath);
  }
  if (legalRepresentativeDocumentFile) {
    const legalRepDocPath = `crm_lead_documents/${docRef.id}/legal_rep_doc_${legalRepresentativeDocumentFile.name}`;
    updates.legalRepresentativeDocumentUrl = await uploadFile(legalRepresentativeDocumentFile, legalRepDocPath);
  }
  if (otherDocumentsFile) {
    const otherDocsPath = `crm_lead_documents/${docRef.id}/other_docs_${otherDocumentsFile.name}`;
    updates.otherDocumentsUrl = await uploadFile(otherDocumentsFile, otherDocsPath);
  }

  // Update the document with file URLs if any were uploaded
  if (Object.keys(updates).length > 0) {
    await updateDoc(docRef, updates);
  }

  // Ensure returned object matches client-side type (string dates)
  const createdAtStr = (baseLeadData.createdAt as Timestamp).toDate().toISOString();
  const lastContactStr = (baseLeadData.lastContact as Timestamp).toDate().toISOString();

  return { 
    id: docRef.id,
    ...(baseLeadData as Omit<LeadDocumentData, 'id' | 'signedAt' | 'createdAt' | 'lastContact'>),
    ...updates,
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
  updates: Partial<Omit<LeadDocumentData, 'id' | 'createdAt' | 'lastContact' | 'userId'>>,
  photoFile?: File,
  billFile?: File,
  legalRepresentativeDocumentFile?: File,
  otherDocumentsFile?: File
): Promise<void> {
  const leadRef = doc(db, "crm_leads", leadId);
  const finalUpdates: { [key: string]: any } = { ...updates };

  if (updates.phone) {
    finalUpdates.phone = updates.phone.replace(/\D/g, '');
  }
  
  if (photoFile) {
    const photoPath = `crm_lead_documents/${leadId}/photo_${photoFile.name}`;
    finalUpdates.photoDocumentUrl = await uploadFile(photoFile, photoPath);
  }

  if (billFile) {
    const billPath = `crm_lead_documents/${leadId}/bill_${billFile.name}`;
    finalUpdates.billDocumentUrl = await uploadFile(billFile, billPath);
  }

  if (legalRepresentativeDocumentFile) {
    const legalRepDocPath = `crm_lead_documents/${leadId}/legal_rep_doc_${legalRepresentativeDocumentFile.name}`;
    finalUpdates.legalRepresentativeDocumentUrl = await uploadFile(legalRepresentativeDocumentFile, legalRepDocPath);
  }
  if (otherDocumentsFile) {
    const otherDocsPath = `crm_lead_documents/${leadId}/other_docs_${otherDocumentsFile.name}`;
    finalUpdates.otherDocumentsUrl = await uploadFile(otherDocumentsFile, otherDocsPath);
  }

  // Always update lastContact timestamp on any edit
  finalUpdates.lastContact = Timestamp.now();
  
  // FIX: Remove properties with undefined values before sending to Firestore
  const cleanUpdates = Object.entries(finalUpdates).reduce((acc, [key, value]) => {
    if (value !== undefined) {
      (acc as any)[key] = value;
    }
    return acc;
  }, {});
  
  await updateDoc(leadRef, cleanUpdates);
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

// --- Lead Assignment & Approval Flow ---

export async function assignLeadToSeller(leadId: string, seller: { uid: string; name: string }): Promise<void> {
  const leadRef = doc(db, "crm_leads", leadId);
  // Optional: Check if the lead is still unassigned before updating to prevent race conditions
  const leadSnap = await getDoc(leadRef);
  if (leadSnap.exists() && leadSnap.data().stageId === 'para-atribuir') {
    await updateDoc(leadRef, {
      userId: seller.uid,
      sellerName: seller.name,
      stageId: 'contato',
      lastContact: Timestamp.now(),
    });
  } else {
    throw new Error("Lead não está mais disponível para atribuição.");
  }
}

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

// --- User Management ---
export async function updateUser(userId: string, updates: Partial<Pick<FirestoreUser, 'displayName' | 'phone' | 'type' | 'canViewLeadPhoneNumber' | 'canViewCareerPlan' | 'canViewCrm'>>): Promise<void> {
  if (!userId) throw new Error("User ID is required.");
  const userRef = doc(db, "users", userId);
  
  const finalUpdates: { [key: string]: any } = {};

  if (updates.displayName !== undefined) {
    finalUpdates.displayName = updates.displayName;
  }
  if (updates.phone !== undefined) {
    finalUpdates.phone = String(updates.phone).replace(/\D/g, '');
  }
  if (updates.type !== undefined) {
    finalUpdates.type = updates.type;
  }
  if (updates.canViewLeadPhoneNumber !== undefined) {
    finalUpdates.canViewLeadPhoneNumber = updates.canViewLeadPhoneNumber;
  }
  if (updates.canViewCareerPlan !== undefined) {
    finalUpdates.canViewCareerPlan = updates.canViewCareerPlan;
  }
  if (updates.canViewCrm !== undefined) {
    finalUpdates.canViewCrm = updates.canViewCrm;
  }

  if (Object.keys(finalUpdates).length > 0) {
    await updateDoc(userRef, finalUpdates);
  }
  
  // Note: Updating displayName in Firebase Auth for another user
  // requires the Admin SDK and should be done in a secure backend environment.
  // This update only affects the Firestore DB.
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
