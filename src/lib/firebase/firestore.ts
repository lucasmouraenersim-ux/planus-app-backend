
// src/lib/firebase/firestore.ts
import type { LeadDocumentData, LeadWithId, ChatMessage as ChatMessageType, StageId } from '@/types/crm';
import type { WithdrawalRequestData, WithdrawalRequestWithId, PixKeyType, WithdrawalStatus, WithdrawalType } from '@/types/wallet';
import type { AppUser, FirestoreUser, UserType } from '@/types/user';
import { Timestamp, collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, where, orderBy, arrayUnion, getDoc, writeBatch, getCountFromServer } from 'firebase/firestore';
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
    // --- ADICIONADO NOVOS CAMPOS ---
    unitPrice: leadData.unitPrice || undefined,
    injectedEnergyMUC: leadData.injectedEnergyMUC || 0,
    injectedEnergyOUC: leadData.injectedEnergyOUC || 0,
    gdEligibility: leadData.gdEligibility || 'padrao',
    // -----------------------------------
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


export async function updateCrmLeadDetails(
  leadId: string,
  updates: Partial<Omit<LeadDocumentData, 'id' | 'createdAt' | 'lastContact' | 'userId'>>,
  photoFile?: File,
  billFile?: File,
  legalRepresentativeDocumentFile?: File,
  otherDocumentsFile?: File,
  feedbackAttachmentFile?: File
): Promise<void> {
  const leadRef = doc(db, "crm_leads", leadId);
  const finalUpdates: { [key: string]: any } = { ...updates };

  const leadDoc = await getDoc(leadRef);
  if (!leadDoc.exists()) {
    throw new Error("Lead não encontrado para atualização.");
  }
  const existingData = leadDoc.data() as LeadDocumentData;

  // Determine if a recalculation is needed
  const kwhChanged = 'kwh' in updates && updates.kwh !== existingData.kwh;
  const valueAfterDiscountChanged = 'valueAfterDiscount' in updates && updates.valueAfterDiscount !== existingData.valueAfterDiscount;
  const discountPercentageChanged = 'discountPercentage' in updates && updates.discountPercentage !== existingData.discountPercentage;
  
  // Only recalculate if kwh or valueAfterDiscount changes, but NOT if only discountPercentage changes.
  if (kwhChanged || valueAfterDiscountChanged) {
      const kwh = 'kwh' in updates ? (updates.kwh ?? 0) : (existingData.kwh ?? 0);
      const valueAfterDiscount = 'valueAfterDiscount' in updates ? (updates.valueAfterDiscount ?? 0) : (existingData.valueAfterDiscount ?? 0);

      const originalValue = kwh * KWH_TO_REAIS_FACTOR;
      finalUpdates.value = originalValue;

      // If valueAfterDiscount was the field that changed, calculate the new discount percentage
      if (valueAfterDiscountChanged && originalValue > 0) {
          const newDiscountPercentage = (1 - (valueAfterDiscount / originalValue)) * 100;
          finalUpdates.discountPercentage = newDiscountPercentage;
      } 
      // If kwh changed, recalculate valueAfterDiscount based on the existing or newly provided discount percentage
      else if (kwhChanged) {
          const discount = 'discountPercentage' in updates ? (updates.discountPercentage ?? 0) : (existingData.discountPercentage ?? 0);
          const newValueAfterDiscount = originalValue * (1 - (discount / 100));
          finalUpdates.valueAfterDiscount = newValueAfterDiscount;
      }
  }
  // If only the discount percentage was changed, we just save it without recalculating other values.
  else if (discountPercentageChanged) {
     finalUpdates.discountPercentage = updates.discountPercentage;
  }

  if (updates.phone) {
    finalUpdates.phone = updates.phone.replace(/\D/g, '');
  }
  
  if (updates.signedAt && typeof updates.signedAt === 'string') {
    finalUpdates.signedAt = Timestamp.fromDate(new Date(updates.signedAt));
  }
  if (updates.completedAt && typeof updates.completedAt === 'string') {
    finalUpdates.completedAt = Timestamp.fromDate(new Date(updates.completedAt));
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
  if (feedbackAttachmentFile) {
    const feedbackPath = `crm_lead_feedback/${leadId}/feedback_${Date.now()}_${feedbackAttachmentFile.name}`;
    finalUpdates.feedbackAttachmentUrl = await uploadFile(feedbackAttachmentFile, feedbackPath);
    finalUpdates.hasFeedbackAttachment = true;
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

export async function assignLeadToSeller(leadId: string, seller: { uid: string; name: string }, limit: number): Promise<void> {
  const activeStages: StageId[] = ['contato', 'fatura', 'proposta', 'contrato', 'conformidade', 'para-validacao'];
  const leadsRef = collection(db, "crm_leads");
  
  const q = query(
    leadsRef,
    where("userId", "==", seller.uid),
    where("stageId", "in", activeStages),
    where("hasFeedbackAttachment", "!=", true)
  );

  const snapshot = await getCountFromServer(q);
  const activeLeadCount = snapshot.data().count;

  if (activeLeadCount >= limit) {
    throw new Error(`Limite de ${limit} leads ativos atingido. Forneça feedback (com anexo) em um lead existente para liberar espaço.`);
  }


  const leadRef = doc(db, "crm_leads", leadId);
  const leadDoc = await getDoc(leadRef);

  if (!leadDoc.exists() || (leadDoc.data().stageId !== 'para-atribuir')) {
    throw new Error("Este lead não está mais disponível para atribuição.");
  }
  
  await updateDoc(leadRef, {
    userId: seller.uid,
    sellerName: seller.name,
    stageId: 'contato',
    lastContact: Timestamp.now(),
  });
}

export async function updateCrmLeadStage(leadId: string, newStageId: StageId): Promise<void> {
  const leadRef = doc(db, "crm_leads", leadId);
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error("Usuário não autenticado.");

  const userDocRef = doc(db, "users", currentUser.uid);
  const userDocSnap = await getDoc(userDocRef);
  const userType = userDocSnap.exists() ? (userDocSnap.data() as FirestoreUser).type : null;
  
  let finalStageId = newStageId;
  const updates: any = {
    lastContact: Timestamp.now(),
  };

  // Rule: If a non-admin tries to move to 'finalizado', move to 'conformidade' for approval instead.
  if (newStageId === 'finalizado' && userType !== 'admin' && userType !== 'superadmin') {
    finalStageId = 'conformidade';
    updates.needsAdminApproval = true;
  }
  
  updates.stageId = finalStageId;
  await updateDoc(leadRef, updates);
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

export async function approveFinalizedLead(leadId: string): Promise<void> {
  const leadRef = doc(db, "crm_leads", leadId);
  await updateDoc(leadRef, {
    stageId: 'finalizado',
    needsAdminApproval: false,
    correctionReason: '',
    completedAt: Timestamp.now(),
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
export async function updateUser(userId: string, updates: Partial<Omit<FirestoreUser, 'uid'>>): Promise<void> {
  if (!userId) throw new Error("User ID is required.");
  const userRef = doc(db, "users", userId);
  
  const finalUpdates: { [key: string]: any } = { ...updates };

  if (updates.phone !== undefined) {
    finalUpdates.phone = String(updates.phone).replace(/\D/g, '');
  }

  if ('uid' in finalUpdates) {
    delete finalUpdates.uid;
  }
  
  // This logic is now removed from here, as level should not be manually set.
  // It will be calculated dynamically on the client based on the upline chain.
  if ('mlmLevel' in finalUpdates) {
    delete finalUpdates.mlmLevel;
  }

  const cleanUpdates = Object.fromEntries(Object.entries(finalUpdates).filter(([_, value]) => value !== undefined));
  
  if (Object.keys(cleanUpdates).length > 0) {
    await updateDoc(userRef, cleanUpdates);
  }
}


// --- Wallet / Commission Functions ---
export async function requestWithdrawal(userId: string, userEmail: string, userName: string, amount: number, pixKeyType: PixKeyType, pixKey: string, withdrawalType: WithdrawalType): Promise<string | null> {
  const newRequest: Omit<WithdrawalRequestData, 'requestedAt'> & { requestedAt: Timestamp } = { userId, userEmail, userName, amount, pixKeyType, pixKey, withdrawalType, status: 'pendente', requestedAt: Timestamp.now() };
  const docRef = await addDoc(collection(db, "withdrawal_requests"), newRequest);
  return docRef.id;
}
