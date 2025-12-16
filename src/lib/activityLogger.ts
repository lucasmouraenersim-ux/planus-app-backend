// src/lib/activityLogger.ts
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

export type ActionType = 
  | 'PAGE_VIEW' 
  | 'TIME_ON_PAGE' 
  | 'UNLOCK_LEAD' 
  | 'CREATE_LEAD' 
  | 'UPLOAD_INVOICE' 
  | 'OPEN_CREDIT_MODAL';

interface LogData {
  userId: string;
  userName: string;
  userRole: string;
  action: ActionType;
  details?: any; // Objeto livre para guardar ID do lead, valor gasto, etc.
}

export const logUserActivity = async (data: LogData) => {
  if (typeof window === 'undefined' || !data.userId) return; // Don't run on server or if no user
  
  try {
    await addDoc(collection(db, 'system_activity_logs'), {
      ...data,
      timestamp: serverTimestamp(),
      userAgent: window.navigator.userAgent, // Útil para saber se é mobile/desktop
    });
  } catch (error) {
    console.error("Erro silencioso ao logar atividade:", error);
    // Não estouramos erro para não travar a experiência do usuário
  }
};
