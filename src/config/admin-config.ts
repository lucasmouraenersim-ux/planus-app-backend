// src/config/admin-config.ts
import type { UserType } from '@/types/user';
import type { WithdrawalStatus, PixKeyType } from '@/types/wallet';

// Updated USER_TYPES to include all specified roles
export const USER_TYPES: UserType[] = ['admin', 'superadmin', 'vendedor', 'user', 'prospector', 'pending_setup', 'advogado'];

export const USER_TYPE_FILTER_OPTIONS: { value: UserType | 'all'; label: string }[] = [
    { value: 'all', label: 'Todos os Tipos' },
    { value: 'admin', label: 'Admin' },
    { value: 'superadmin', label: 'Super Admin' },
    { value: 'vendedor', label: 'Vendedor' },
    { value: 'prospector', label: 'Prospector' },
    { value: 'advogado', label: 'Advogado' },
    { value: 'user', label: 'Usuário (Cliente)' },
    { value: 'pending_setup', label: 'Configuração Pendente' },
];

export const USER_TYPE_ADD_OPTIONS: { value: Exclude<UserType, 'pending_setup' | 'user'>; label: string }[] = [
    { value: 'admin', label: 'Admin' },
    { value: 'superadmin', label: 'Super Admin' },
    { value: 'vendedor', label: 'Vendedor' },
    { value: 'prospector', label: 'Prospector' },
    { value: 'advogado', label: 'Advogado' },
];


export const WITHDRAWAL_STATUSES_ADMIN: WithdrawalStatus[] = ['pendente', 'processando', 'concluido', 'falhou'];

export const PIX_KEY_TYPES_ADMIN: PixKeyType[] = ['CPF/CNPJ', 'Celular', 'Email', 'Aleatória'];
