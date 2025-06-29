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
  leadData: Omit<LeadDocumentData, 'id' | 'createdAt' | 'lastContact' | 'userId' | 'signedAt'>,
  photoDocumentFile?: File, 
  billDocumentFile?: File,
  legalRepresentativeDocumentFile?: File,
  otherDocumentsFile?: File
): Promise<LeadWithId> {
  const userId = auth.currentUser?.uid;
  if (!userId) throw new Error("Usuário não autenticado para criar o lead.");

  // Calculate valueAfterDiscount
  const valueAfterDiscount = (leadData.kwh * KWH_TO_REAIS_FACTOR) * (1 - ((leadData.discountPercentage || 0) / 100));

  // Prepare data, excluding file URLs which are added later
  const baseLeadData: Omit<LeadDocumentData, 'id' | 'signedAt' | 'photoDocumentUrl' | 'billDocumentUrl' | 'legalRepresentativeDocumentUrl' | 'otherDocumentsUrl'> = {
    ...leadData,
    valueAfterDiscount,
    phone: leadData.phone ? leadData.phone.replace(/\D/g, '') : undefined, // Normalize phone on creation
    userId,
    createdAt: Timestamp.now(),
    lastContact: Timestamp.now(),
    needsAdminApproval: leadData.needsAdminApproval ?? true, // Require approval for manual creation
    commissionPaid: false, // Default to not paid
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
    updates.billDocumentUrl = await uploadFile(billFile, billPath);
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

  // Recalculate valueAfterDiscount if kwh or discountPercentage changes
  if (updates.kwh !== undefined || updates.discountPercentage !== undefined) {
    const leadDoc = await getDoc(leadRef);
    const existingData = leadDoc.data() as LeadDocumentData;
    const kwh = updates.kwh ?? existingData.kwh;
    const discount = updates.discountPercentage ?? existingData.discountPercentage;
    finalUpdates.valueAfterDiscount = (kwh * KWH_TO_REAIS_FACTOR) * (1 - ((discount || 0) / 100));
  }

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

  finalUpdates.lastContact = Timestamp.now();
  
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

export async function updateCrmLeadSignedAt(leadId: string, newSignedAtIso: string): Promise<void> {
  const leadRef = doc(db, "crm_leads", leadId);
  await updateDoc(leadRef, {
    signedAt: Timestamp.fromDate(new Date(newSignedAtIso)),
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

export async function fetchWithdrawalHistory(userId: string): Promise<WithdrawalRequestWithId[]> {
  const q = query(collection(db, "withdrawal_requests"), where("userId", "==", userId), orderBy("requestedAt", "desc"));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(docSnap => {
    const data = docSnap.data() as WithdrawalRequestData;
    return {
      id: docSnap.id,
      ...data,
      requestedAt: (data.requestedAt as Timestamp).toDate().toISOString(),
      processedAt: data.processedAt ? (data.processedAt as Timestamp).toDate().toISOString() : undefined,
    };
  });
}