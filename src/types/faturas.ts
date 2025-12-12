// src/types/faturas.ts
import type { Timestamp } from 'firebase/firestore';

export interface UnidadeConsumidora {
  id: string;
  consumoKwh: string;
  valorTotal?: string;
  mediaConsumo?: string;
  precoUnitario?: number;
  temGeracao: boolean;
  arquivoFaturaUrl: string | null;
  nomeArquivo: string | null;
  endereco?: string;
  cidade?: string;
  estado?: string;
  latitude?: number;
  longitude?: number;
}

export interface Contato {
  id: string;
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
