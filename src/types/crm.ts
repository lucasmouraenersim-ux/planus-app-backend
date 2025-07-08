import type { Timestamp } from 'firebase/firestore';

export type StageId =
  | 'para-validacao'   // New leads from non-trigger messages
  | 'para-atribuir'    // New unassigned leads from trigger message
  | 'contato'          // Initial contact or lead generation
  | 'fatura'           // Bill collected, under analysis
  | 'proposta'         // Proposal sent to lead
  | 'contrato'         // Contract sent, awaiting signature
  | 'conformidade'     // Contract signed, under compliance review
  | 'assinado'         // Contract signed and approved (deal won)
  | 'finalizado'       // Lead finalized, commissions are calculated from this stage
  | 'cancelado'        // Lead or client cancelled
  | 'perdido';         // Deal lost to competitor or other reasons

export const STAGE_IDS: StageId[] = [
  'para-validacao',
  'para-atribuir',
  'contato',
  'fatura',
  'proposta',
  'contrato',
  'conformidade',
  'assinado',
  'finalizado',
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
  naturality?: string; // Naturalidade do cliente PF
  maritalStatus?: string; // Estado civil do cliente PF
  profession?: string; // Profissão do cliente PF
  createdAt: Timestamp | string; // Obrigatório - Timestamp for Firestore, string for client
  lastContact: Timestamp | string; // Obrigatório - Timestamp for Firestore, string for client
  userId: string; // UID do Firebase Auth do vendedor/usuário que criou o lead - Obrigatório
  signedAt?: Timestamp | string; // Data de assinatura do contrato
  customerType?: 'pf' | 'pj'; // New: Pessoa Física ou Jurídica
  cpf?: string; // New: CPF para Pessoa Física
  cnpj?: string; // New: CNPJ para Pessoa Jurídica
  stateRegistration?: string; // New: Inscrição Estadual para PJ

  // Fields for Import/Export
  codigoClienteInstalacao?: string; // 'Instalação' from CSV
  concessionaria?: string; // 'Concessionária' from CSV
  plano?: string; // 'Plano' from CSV
  completedAt?: Timestamp | string; // 'Finalizado em' from CSV
  saleReferenceDate?: string; // 'Data Referencia Venda' from CSV

  // Legal Representative Fields (for PJ)
  legalRepresentativeName?: string;
  legalRepresentativeCpf?: string;
  legalRepresentativeRg?: string;
  legalRepresentativeAddress?: string;
  legalRepresentativeEmail?: string;
  legalRepresentativePhone?: string;
  legalRepresentativeMaritalStatus?: string;
  legalRepresentativeBirthDate?: string;
  legalRepresentativeProfession?: string;
  legalRepresentativeNationality?: string;
  legalRepresentativeDocumentUrl?: string; // For the "Documento(s)" file
  otherDocumentsUrl?: string; // For "Demais documentos"

  // New Commission Fields
  discountPercentage?: number; // Percentual de desconto negociado
  valueAfterDiscount?: number; // Valor da conta após o desconto
  commissionPaid?: boolean; // Se a comissão deste contrato já foi paga
  
  // New Feedback Fields
  sellerNotes?: string;
  feedbackAttachmentUrl?: string;
  hasFeedbackAttachment?: boolean;
  showPhoneNumber?: boolean;

  // AI Fields
  leadScore?: number;
  scoreJustification?: string;
  nextActionSuggestion?: string;
  lastAnalyzedAt?: Timestamp | string;
}

export interface LeadWithId extends Omit<LeadDocumentData, 'createdAt' | 'lastContact' | 'signedAt' | 'completedAt' | 'lastAnalyzedAt'> {
  id: string;
  createdAt: string; // Always string on client
  lastContact: string; // Always string on client
  signedAt?: string; // Always string on client
  completedAt?: string; // Always string on client
  lastAnalyzedAt?: string; // Always string on client
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
  text: string; // Conteúdo da mensagem ou legenda da mídia
  sender: 'user' | 'lead'; // 'user' (vendedor/sistema), 'lead' (cliente)
  timestamp: Timestamp | string; // Timestamp na criação, string no cliente
  type?: 'text' | 'button' | 'interactive' | 'image' | 'audio' | 'document'; // Tipo da mensagem
  mediaUrl?: string; // URL para imagem ou áudio
  transcription?: string; // Transcrição do áudio
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
