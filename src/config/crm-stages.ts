
import type { Stage, StageId } from '@/types/crm';

export const STAGES_CONFIG: Stage[] = [
  {
    id: 'para-validacao',
    title: 'Para Validação',
    colorClass: 'bg-gray-400',
  },
  {
    id: 'para-atribuir',
    title: 'Para Atribuir',
    colorClass: 'bg-slate-500',
  },
  {
    id: 'contato',
    title: 'Contato Inicial',
    colorClass: 'bg-sky-500',
  },
  {
    id: 'fatura',
    title: 'Fatura em Análise',
    colorClass: 'bg-blue-500',
  },
  {
    id: 'proposta',
    title: 'Proposta Enviada',
    colorClass: 'bg-indigo-500',
  },
  {
    id: 'contrato',
    title: 'Contrato Enviado',
    colorClass: 'bg-purple-500',
  },
  {
    id: 'conformidade',
    title: 'Conformidade',
    colorClass: 'bg-violet-500',
  },
  {
    id: 'assinado',
    title: 'Assinado ✅',
    colorClass: 'bg-green-500',
  },
  {
    id: 'finalizado',
    title: 'Finalizado 🏆',
    colorClass: 'bg-emerald-600',
  },
  {
    id: 'cancelado',
    title: 'Cancelado ❌',
    colorClass: 'bg-rose-500',
  },
  {
    id: 'perdido',
    title: 'Perdido ⛔',
    colorClass: 'bg-red-600',
  },
];

export const getStageById = (id: StageId): Stage | undefined => {
  return STAGES_CONFIG.find(stage => stage.id === id);
};
