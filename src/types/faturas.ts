
// src/types/faturas.ts
import type { Timestamp } from 'firebase/firestore';

export interface UnidadeConsumidora {
  id: string; // Unique ID for the unit within the client
  consumoKwh: string;
  valorTotal?: string; // Novo: Para simular TUSD/TE e salvar o valor extraído pela IA
  precoUnitario?: number; // Novo: Para salvar o preço unitário extraído pela IA
  temGeracao: boolean;
  arquivoFaturaUrl: string | null; // URL from Firebase Storage
  nomeArquivo: string | null; // Original name of the uploaded file
}

export interface Contato {
  id: string; // Unique ID for the contact within the client
  nome: string;
  telefone: string;
}

export type FaturaStatus = 'Nenhum' | 'Contato?' | 'Proposta' | 'Fechamento' | 'Fechado';

export type TensaoType = 'alta' | 'baixa' | 'b_optante' | 'baixa_renda';

export interface FaturaCliente {
  id: string; // Document ID from Firestore
  nome: string;
  tipoPessoa: 'pf' | 'pj' | '';
  tensao: TensaoType;
  unidades: UnidadeConsumidora[];
  contatos: Contato[];
  createdAt: Timestamp | string; // Use string on client for serializability
  // New feedback fields
  status: FaturaStatus;
  feedbackNotes?: string;
  feedbackAttachmentUrl?: string | null;
  lastUpdatedBy?: {
    uid: string;
    name: string;
  };
  lastUpdatedAt?: Timestamp | string;
}
