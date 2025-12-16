import { db } from "@/lib/firebase"; // Ajustado para o import correto do projeto
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

export type EventType = 
  | 'LEAD_CREATED' 
  | 'LEAD_VIEWED' 
  | 'INVOICE_PROCESSED' 
  | 'LEAD_UNLOCKED';

interface TrackEventParams {
  eventType: EventType;
  user: { id: string; name: string; email: string };
  metadata?: Record<string, any>;
  page?: string;
}

export const trackEvent = async ({ eventType, user, metadata = {}, page = '' }: TrackEventParams) => {
  // Não rastrear se não houver usuário (ex: em ambiente de build)
  if (!user || !user.id) {
    return;
  }
  
  try {
    const pageToLog = page || (typeof window !== "undefined" ? window.location.pathname : '');
    await addDoc(collection(db, "user_events"), {
      eventType,
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      metadata,
      page: pageToLog,
      timestamp: serverTimestamp(),
    });
  } catch (error) {
    console.error("Erro ao rastrear evento:", error);
  }
};
