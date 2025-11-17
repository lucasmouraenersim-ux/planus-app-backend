// src/types/faturas.ts
import type { Timestamp } from 'firebase/firestore';

export interface UnidadeConsumidora {
  id: string; // Unique ID for the unit within the client
  consumoKwh: string;
  temGeracao: boolean;
  arquivoFaturaUrl: string | null; // URL from Firebase Storage
  nomeArquivo: string | null; // Original name of the uploaded file
}

export interface Contato {
  id: string; // Unique ID for the contact within the client
  nome: string;
  telefone: string;
}

export interface FaturaCliente {
  id: string; // Document ID from Firestore
  nome: string;
  tipoPessoa: 'pf' | 'pj' | '';
  unidades: UnidadeConsumidora[];
  contatos: Contato[];
  createdAt: Timestamp; // To sort by creation time if needed
}
