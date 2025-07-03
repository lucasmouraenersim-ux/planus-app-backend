
// src/lib/firebase/firestore.ts
import type { LeadDocumentData, LeadWithId, ChatMessage as ChatMessageType, StageId } from '@/types/crm';
import type { WithdrawalRequestData, WithdrawalRequestWithId, PixKeyType, WithdrawalStatus, WithdrawalType } from '@/types/wallet';
import type { AppUser, FirestoreUser, UserType } from '@/types/user';
import { Timestamp, collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, where, orderBy, arrayUnion, getDoc, writeBatch } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { uploadFile } from './storage';

// --- Leads ---

const KWH_TO_REAIS_FACTOR = 1.093113;

export async function createCrmLead(
  leadData: Omit<LeadDocumentData, 'id' | 'createdAt' | 'lastContact' | 'userId' | 'signedAt' | 'value' | 'valueAfterDiscount'> & { kwh?: number | null; discountPercentage?: number | null },
  photoDocumentFile?: File, 
  billDocumentFile?: File,
  legalRepresentativeDocumentFile?: File,
  otherDocumentsFile?: File
): Promise<LeadWithId> {
  const userId = auth.currentUser?.uid;
  if (!userId) throw new Error("Usuário não autenticado para criar o lead.");

  // Calculate value and valueAfterDiscount
  const kwh = leadData.kwh || 0;
  const discount = leadData.discountPercentage || 0;
  const originalValue = kwh * KWH_TO_REAIS_FACTOR;
  const valueAfterDiscount = originalValue * (1 - (discount / 100));

  // Prepare data, excluding file URLs which are added later
  const baseLeadData: Omit<LeadDocumentData, 'id' | 'signedAt' | 'photoDocumentUrl' | 'billDocumentUrl' | 'legalRepresentativeDocumentUrl' | 'otherDocumentsUrl'> = {
    ...leadData,
    kwh: kwh,
    value: originalValue,
    valueAfterDiscount,
    phone: leadData.phone ? leadData.phone.replace(/\D/g, '') : undefined, // Normalize phone on creation
    userId,
    createdAt: Timestamp.now(),
    lastContact: Timestamp.now(),
    needsAdminApproval: leadData.needsAdminApproval ?? true, // Require approval for manual creation
    commissionPaid: false, // Default to not paid
  };

  // Clean the object for Firestore to remove 'undefined' values
  const firestoreData = Object.fromEntries(Object.entries(baseLeadData).filter(([, v]) => v !== undefined));

  // Create document in Firestore to get an ID
  const docRef = await addDoc(collection(db, "crm_leads"), firestoreData);
  
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


export async function updateCrmLeadStage(leadId: string, newStageId: StageId): Promise<void> {
  const leadRef = doc(db, "crm_leads", leadId);
  const updates: { [key: string]: any } = {
    stageId: newStageId,
    lastContact: Timestamp.now(),
  };

  if (newStageId === 'finalizado') {
    updates.completedAt = Timestamp.now();
  }
  
  await updateDoc(leadRef, updates);
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

  // Fetch existing data to ensure we have a complete picture for calculations.
  const leadDoc = await getDoc(leadRef);
  if (!leadDoc.exists()) {
    throw new Error("Lead não encontrado para atualização.");
  }
  const existingData = leadDoc.data() as LeadDocumentData;

  // Determine the definitive KWh and discount percentage for calculation.
  // Use the value from 'updates' if it exists (even if null), otherwise use existing data.
  // Default to 0 if neither exists.
  const kwh = 'kwh' in updates ? (updates.kwh ?? 0) : (existingData.kwh ?? 0);
  const discount = 'discountPercentage' in updates ? (updates.discountPercentage ?? 0) : (existingData.discountPercentage ?? 0);

  // Always recalculate value and valueAfterDiscount for consistency.
  const originalValue = kwh * KWH_TO_REAIS_FACTOR;
  const valueAfterDiscount = originalValue * (1 - (discount / 100));

  finalUpdates.value = originalValue;
  finalUpdates.valueAfterDiscount = valueAfterDiscount;

  // If KWh or discount were part of the updates, make sure they are in finalUpdates.
  if ('kwh' in updates) {
    finalUpdates.kwh = updates.kwh;
  }
  if ('discountPercentage' in updates) {
    finalUpdates.discountPercentage = updates.discountPercentage;
  }

  // Normalize phone number if present in updates
  if (updates.phone) {
    finalUpdates.phone = updates.phone.replace(/\D/g, '');
  }
  
  // Handle date string to Timestamp conversion for specific fields
  if (updates.signedAt && typeof updates.signedAt === 'string') {
    finalUpdates.signedAt = Timestamp.fromDate(new Date(updates.signedAt));
  }
  if (updates.completedAt && typeof updates.completedAt === 'string') {
    finalUpdates.completedAt = Timestamp.fromDate(new Date(updates.completedAt));
  }
  
  // Handle file uploads
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

  // Always update the last contact timestamp
  finalUpdates.lastContact = Timestamp.now();
  
  // Clean out any keys with 'undefined' values before sending to Firestore
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
  
  await batch.commit();
  console.log(`Successfully deleted lead ${leadId} and its chat history.`);
}

export async function assignLeadToSeller(leadId: string, seller: { uid: string; name: string }): Promise<void> {
  const leadRef = doc(db, "crm_leads", leadId);
  const leadDoc = await getDoc(leadRef);

  // Check if the lead is available to be assigned.
  if (!leadDoc.exists() || (leadDoc.data().stageId !== 'para-atribuir')) {
    throw new Error("Este lead não está mais disponível para atribuição.");
  }
  
  await updateDoc(leadRef, {
    userId: seller.uid,
    sellerName: seller.name,
    stageId: 'contato', // Move to 'contato' stage after assignment
    lastContact: Timestamp.now(),
  });
}

export async function approveCrmLead(leadId: string): Promise<void> {
  const leadRef = doc(db, "crm_leads", leadId);
  await updateDoc(leadRef, {
    stageId: 'assinado', 
    needsAdminApproval: false,
    correctionReason: '',
    signedAt: Timestamp.now(), 
    lastContact: Timestamp.now(),
  });
}

export async function requestCrmLeadCorrection(leadId: string, reason: string): Promise<void> {
  const leadRef = doc(db, "crm_leads", leadId);
  await updateDoc(leadRef, {
    stageId: 'contato',
    correctionReason: reason,
    needsAdminApproval: false, 
    lastContact: Timestamp.now(),
  });
}

export async function updateLeadCommissionStatus(leadId: string, isPaid: boolean): Promise<void> {
    const leadRef = doc(db, "crm_leads", leadId);
    await updateDoc(leadRef, {
        commissionPaid: isPaid,
        lastContact: Timestamp.now()
    });
}

// --- User Management ---
export async function updateUser(userId: string, updates: Partial<FirestoreUser>): Promise<void> {
  if (!userId) throw new Error("User ID is required.");
  const userRef = doc(db, "users", userId);
  
  const finalUpdates: { [key: string]: any } = { ...updates };

  if (updates.phone !== undefined) {
    finalUpdates.phone = String(updates.phone).replace(/\D/g, '');
  }

  // Remove UID from the update object if it exists to avoid errors
  if ('uid' in finalUpdates) {
    delete finalUpdates.uid;
  }

  // Ensure only valid, non-undefined fields are sent
  const cleanUpdates = Object.entries(finalUpdates).reduce((acc, [key, value]) => {
    if (value !== undefined) {
      (acc as any)[key] = value;
    }
    return acc;
  }, {});
  
  if (Object.keys(cleanUpdates).length > 0) {
    await updateDoc(userRef, cleanUpdates);
  }
}


// --- Wallet / Commission Functions ---
export async function requestWithdrawal(userId: string, userEmail: string, userName: string, amount: number, pixKeyType: PixKeyType, pixKey: string, withdrawalType: WithdrawalType): Promise<string | null> {
  const newRequest: WithdrawalRequestData = { userId, userEmail, userName, amount, pixKeyType, pixKey, withdrawalType, status: 'pendente', requestedAt: Timestamp.now() };
  const docRef = await addDoc(collection(db, "withdrawal_requests"), newRequest);
  return docRef.id;
}
