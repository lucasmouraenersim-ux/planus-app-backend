
import type { Timestamp } from 'firebase/firestore';

export type StageId =
  | 'para-atribuir'    // New unassigned leads
  | 'contato'          // Initial contact or lead generation
  | 'fatura'           // Bill collected, under analysis
  | 'proposta'         // Proposal sent to lead
  | 'contrato'         // Contract sent, awaiting signature
  | 'conformidade'     // Contract signed, under compliance review
  | 'assinado'         // Contract signed and approved (deal won)
  | 'cancelado'        // Lead or client cancelled
  | 'perdido';         // Deal lost to competitor or other reasons

export const STAGE_IDS: StageId[] = [
  'para-atribuir',
  'contato',
  'fatura',
  'proposta',
  'contrato',
  'conformidade',
  'assinado',
  'cancelado',
  'perdido',
];


export type LeadSource =
  | 'Tráfego Pago'
  | 'Disparo de E-mail'
  | 'Porta a Porta (PAP)'
  | 'Indicação'
  | 'WhatsApp'
  | 'Outro';

export const LEAD_SOURCES: LeadSource[] = [
  'Tráfego Pago',
  'Disparo de E-mail',
  'Porta a Porta (PAP)',
  'Indicação',
  'WhatsApp',
  'Outro',
];

export interface LeadDocumentData {
  name: string; // Nome do lead/cliente ou razão social - Obrigatório
  company?: string; // Nome da empresa, se aplicável
  value: number; // Valor estimado do contrato/lead em R$ - Obrigatório
  kwh: number; // Consumo médio mensal em KWh - Obrigatório
  stageId: StageId; // Obrigatório
  sellerName: string; // Email ou identificador único do vendedor responsável - Obrigatório
  leadSource?: LeadSource;
  phone?: string; // Número de telefone do lead, normalizado
  email?: string; // Email do lead
  correctionReason?: string; // Texto explicando o motivo se um admin solicitou correção no lead
  needsAdminApproval?: boolean; // Default: false. true se o lead está em um estágio que requer aprovação
  photoDocumentUrl?: string; // URL do Firebase Storage para o documento de foto/identidade
  billDocumentUrl?: string; // URL do Firebase Storage para a fatura de energia
  naturality?: string; // Naturalidade do cliente
  maritalStatus?: string; // Estado civil
  profession?: string; // Profissão
  createdAt: Timestamp | string; // Obrigatório - Timestamp for Firestore, string for client
  lastContact: Timestamp | string; // Obrigatório - Timestamp for Firestore, string for client
  userId: string; // UID do Firebase Auth do vendedor/usuário que criou o lead - Obrigatório
  signedAt?: Timestamp | string; // Data de assinatura do contrato
}

export interface LeadWithId extends Omit<LeadDocumentData, 'createdAt' | 'lastContact' | 'signedAt'> {
  id: string;
  createdAt: string; // Always string on client
  lastContact: string; // Always string on client
  signedAt?: string; // Always string on client
}

export interface OutboundLead {
  id: string;
  name: string;
  phone: string;
  consumption: number;
  company?: string;
}

export interface ChatMessage {
  id: string; // ID único para a mensagem
  text: string; // Conteúdo da mensagem
  sender: 'user' | 'lead'; // 'user' (vendedor/sistema), 'lead' (cliente)
  timestamp: Timestamp | string; // Timestamp na criação, string no cliente
}

export interface Stage {
  id: StageId;
  title: string;
  colorClass: string; // Tailwind color class for the stage header/accent
}

export interface RankingDisplayEntry {
  rankPosition: number;
  userId: string;
  userName: string;
  userPhotoUrl?: string;
  mainScoreDisplay: string; // Ex: "R$ 150.000,00" ou "75 Vendas"
  mainScoreValue: number; // Raw numeric value for sorting
  detailScore1Label?: string;
  detailScore1Value?: string | number;
  detailScore2Label?: string;
  detailScore2Value?: string | number;
  periodIdentifier: string; // e.g., "monthly_current", "all_time"
  criteriaIdentifier: string; // e.g., "totalSalesValue", "numberOfSales"
}
