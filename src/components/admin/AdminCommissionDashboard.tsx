
// src/components/admin/AdminCommissionDashboard.tsx
"use client";

import { useState, useEffect, useMemo } from 'react';
import { format, parseISO, startOfMonth, endOfMonth, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import Papa from 'papaparse';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { cn } from "@/lib/utils";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip as RechartsTooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { STAGES_CONFIG } from '@/config/crm-stages';


import type { AppUser, FirestoreUser, UserType } from '@/types/user';
import type { LeadWithId, StageId } from '@/types/crm';
import type { WithdrawalRequestWithId, WithdrawalStatus } from '@/types/wallet';
import { USER_TYPE_FILTER_OPTIONS, USER_TYPE_ADD_OPTIONS, WITHDRAWAL_STATUSES_ADMIN } from '@/config/admin-config';
import { updateUser } from '@/lib/firebase/firestore';
import { createUser } from '@/actions/admin/createUser';
import { deleteUser } from '@/actions/admin/deleteUser';
import { syncLegacySellers } from '@/actions/admin/syncLegacySellers';
import { processOldWithdrawals } from '@/actions/admin/processOldWithdrawals';
import { useAuth } from '@/contexts/AuthContext'; 

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { 
    CalendarIcon, Filter, Users, UserPlus, DollarSign, Settings, RefreshCw, 
    ExternalLink, ShieldAlert, WalletCards, Activity, BarChartHorizontalBig, PieChartIcon, 
    Loader2, Search, Download, Edit2, Trash2, Eye, Rocket, UsersRound as CrmIcon, Percent, Network, Shuffle, Banknote, TrendingUp, ArrowRight, ClipboardList
} from 'lucide-react';
import type { DateRange } from "react-day-picker";

const MOCK_WITHDRAWALS: WithdrawalRequestWithId[] = [
  { id: 'wd1', userId: 'user1', userEmail: 'vendedor1@example.com', userName: 'Vendedor Um', amount: 500, pixKeyType: 'CPF/CNPJ', pixKey: '111.111.111-11', status: 'pendente', requestedAt: new Date(Date.now() - 86400000).toISOString(), withdrawalType: 'personal' },
  { id: 'wd2', userId: 'user2', userEmail: 'vendedor2@example.com', userName: 'Vendedor Dois', amount: 200, pixKeyType: 'Email', pixKey: 'vendedor2@example.com', status: 'concluido', requestedAt: new Date(Date.now() - 86400000 * 2).toISOString(), processedAt: new Date(Date.now() - 86400000).toISOString(), withdrawalType: 'mlm', adminNotes: 'Pago.' },
];

const addUserFormSchema = z.object({
  displayName: z.string().optional(),
  email: z.string().email("Email inválido."),
  password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres."),
  phone: z.string().optional(),
  cpf: z.string().min(11, "CPF deve ter 11 dígitos.").max(14, "Formato de CPF inválido.").regex(/^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$|^\d{11}$/, "Formato de CPF inválido."),
  type: z.enum(USER_TYPE_ADD_OPTIONS.map(opt => opt.value) as [Exclude<UserType, 'pending_setup' | 'user'>, ...Exclude<UserType, 'pending_setup' | 'user'>[]], { required_error: "Tipo de usuário é obrigatório." }),
});
type AddUserFormData = z.infer<typeof addUserFormSchema>;

const editUserFormSchema = z.object({
  displayName: z.string().min(2, "Nome deve ter no mínimo 2 caracteres."),
  phone: z.string().optional(),
  type: z.enum(USER_TYPE_ADD_OPTIONS.map(opt => opt.value) as [Exclude<UserType, 'pending_setup' | 'user'>, ...Exclude<UserType, 'pending_setup' | 'user'>[]], { required_error: "Tipo de usuário é obrigatório." }),
  commissionRate: z.preprocess(
    (val) => (val === 'none' || val === '' || val === null || val === undefined ? undefined : Number(val)),
    z.number().optional()
  ),
  mlmEnabled: z.boolean().default(false),
  uplineUid: z.string().optional(),
  mlmLevel: z.preprocess(
    (val) => (val === 'none' || val === '' || val === null || val === undefined ? undefined : Number(val)),
    z.number().int().min(1).max(4).optional()
  ),
  recurrenceRate: z.preprocess(
    (val) => (val === 'none' || val === '' || val === null || val === undefined ? undefined : Number(val)),
    z.number().optional()
  ),
  canViewLeadPhoneNumber: z.boolean().default(false),
  canViewCrm: z.boolean().default(false),
  canViewCareerPlan: z.boolean().default(false),
  assignmentLimit: z.preprocess(
    (val) => (val === 'none' || val === '' || val === null || val === undefined ? undefined : Number(val)),
    z.number().int().optional()
  ),
});
type EditUserFormData = z.infer<typeof editUserFormSchema>;


const updateWithdrawalFormSchema = z.object({
  status: z.enum(WITHDRAWAL_STATUSES_ADMIN as [WithdrawalStatus, ...WithdrawalStatus[]], { required_error: "Status é obrigatório." }),
  adminNotes: z.string().optional(),
});
type UpdateWithdrawalFormData = z.infer<typeof updateWithdrawalFormSchema>;

interface AdminCommissionDashboardProps {
  loggedInUser: AppUser;
  initialUsers: FirestoreUser[];
  isLoadingUsersProp: boolean;
  refreshUsers: () => Promise<void>;
}

export default function AdminCommissionDashboard({ loggedInUser, initialUsers, isLoadingUsersProp, refreshUsers }: AdminCommissionDashboardProps) {
  const { toast } = useToast();
  const { userAppRole, fetchAllCrmLeadsGlobally } = useAuth();
  const [dateRange, setDateRange] = useState<DateRange | undefined>({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) });
  
  const [allLeads, setAllLeads] = useState<LeadWithId[]>([]);
  const [isLoadingLeads, setIsLoadingLeads] = useState(true);

  const [withdrawalRequests, setWithdrawalRequests] = useState<WithdrawalRequestWithId[]>(MOCK_WITHDRAWALS);

  const [userSearchTerm, setUserSearchTerm] = useState("");
  const [userTypeFilter, setUserTypeFilter] = useState<UserType | 'all'>('all');

  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [isUpdateWithdrawalModalOpen, setIsUpdateWithdrawalModalOpen] = useState(false);
  const [isEditUserModalOpen, setIsEditUserModalOpen] = useState(false);
  const [isResetPasswordModalOpen, setIsResetPasswordModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  
  const [selectedUser, setSelectedUser] = useState<FirestoreUser | null>(null);
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<WithdrawalRequestWithId | null>(null);
  const [userToDelete, setUserToDelete] = useState<FirestoreUser | null>(null);

  const [isSubmittingUser, setIsSubmittingUser] = useState(false);
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isProcessingWithdrawals, setIsProcessingWithdrawals] = useState(false);
  
  const addUserForm = useForm<AddUserFormData>({ 
    resolver: zodResolver(addUserFormSchema), 
    defaultValues: { type: 'vendedor', cpf: '', displayName: '', email: '', password: '', phone: '' } 
  });
  const editUserForm = useForm<EditUserFormData>({ resolver: zodResolver(editUserFormSchema) });
  const updateWithdrawalForm = useForm<UpdateWithdrawalFormData>({ resolver: zodResolver(updateWithdrawalFormSchema) });

  const canEdit = useMemo(() => userAppRole === 'superadmin' || userAppRole === 'admin', [userAppRole]);
  
  useEffect(() => {
    async function loadLeads() {
      setIsLoadingLeads(true);
      const leads = await fetchAllCrmLeadsGlobally();
      setAllLeads(leads);
      setIsLoadingLeads(false);
    }
    loadLeads();
  }, [fetchAllCrmLeadsGlobally]);

  const handleOpenEditModal = (user: FirestoreUser) => {
    setSelectedUser(user);
    editUserForm.reset({
      displayName: user.displayName || '',
      phone: user.phone || '',
      type: user.type,
      commissionRate: user.commissionRate,
      mlmEnabled: user.mlmEnabled || false,
      uplineUid: user.uplineUid,
      mlmLevel: user.mlmLevel,
      recurrenceRate: user.recurrenceRate,
      canViewLeadPhoneNumber: user.canViewLeadPhoneNumber || false,
      canViewCrm: user.canViewCrm || false,
      canViewCareerPlan: user.canViewCareerPlan || false,
      assignmentLimit: user.assignmentLimit,
    });
    setIsEditUserModalOpen(true);
  };

  const handleUpdateUser = async (data: EditUserFormData, refreshFn: () => Promise<void>) => {
    if (!selectedUser) return;
    setIsSubmittingAction(true);
    try {
      await updateUser(selectedUser.uid, {
        displayName: data.displayName,
        phone: data.phone,
        type: data.type,
        commissionRate: data.commissionRate,
        mlmEnabled: data.mlmEnabled,
        uplineUid: data.uplineUid,
        mlmLevel: data.mlmLevel,
        recurrenceRate: data.recurrenceRate,
        canViewLeadPhoneNumber: data.canViewLeadPhoneNumber,
        canViewCrm: data.canViewCrm,
        canViewCareerPlan: data.canViewCareerPlan,
        assignmentLimit: data.assignmentLimit,
      });
      await refreshFn();
      toast({ title: "Sucesso", description: `Usuário ${data.displayName} atualizado.` });
      setIsEditUserModalOpen(false);
    } catch (error) {
      console.error("Error updating user:", error);
      toast({ title: "Erro", description: "Não foi possível atualizar o usuário.", variant: "destructive" });
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const handleOpenResetPasswordModal = (user: FirestoreUser) => {
    setSelectedUser(user);
    setIsResetPasswordModalOpen(true);
  };
  
  const handleConfirmResetPassword = async () => {
    if (!selectedUser || !selectedUser.email) return;
    setIsSubmittingAction(true);
    try {
      await sendPasswordResetEmail(auth, selectedUser.email);
      toast({ title: "Email Enviado", description: `Um email de redefinição de senha foi enviado para ${selectedUser.email}.` });
    } catch (error) {
      toast({ title: "Erro", description: "Não foi possível enviar o email de redefinição de senha.", variant: "destructive" });
    } finally {
      setIsSubmittingAction(false);
      setIsResetPasswordModalOpen(false);
      setSelectedUser(null);
    }
  };

  const handleOpenDeleteModal = (user: FirestoreUser) => {
    setUserToDelete(user);
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!userToDelete) return;
    setIsSubmittingAction(true);
    try {
        const result = await deleteUser(userToDelete.uid);
        if (result.success) {
            toast({ title: "Usuário Excluído", description: result.message });
            await refreshUsers();
        } else {
            toast({ title: "Erro ao Excluir", description: result.message, variant: "destructive" });
        }
    } catch (error) {
        console.error("Error deleting user:", error);
        toast({ title: "Erro", description: "Não foi possível excluir o usuário.", variant: "destructive" });
    } finally {
        setIsSubmittingAction(false);
        setIsDeleteDialogOpen(false);
        setUserToDelete(null);
    }
  };

  const filteredUsers = useMemo(() => {
    return initialUsers.filter(user => {
      const searchTermLower = userSearchTerm.toLowerCase();
      const matchesSearch = 
        (user.displayName?.toLowerCase().includes(searchTermLower)) ||
        (user.email?.toLowerCase().includes(searchTermLower)) ||
        ((user.cpf?.replace(/\D/g, '') ?? '').includes(searchTermLower.replace(/\D/g, '')));
      const matchesType = userTypeFilter === 'all' || user.type === userTypeFilter;
      return matchesSearch && matchesType;
    });
  }, [initialUsers, userSearchTerm, userTypeFilter]);

  const handleAddUser = async (data: AddUserFormData) => {
    setIsSubmittingUser(true);
    try {
      const result = await createUser(data);

      if (result.success) {
        await refreshUsers();
        toast({ title: "Usuário Criado", description: result.message });
        setIsAddUserModalOpen(false);
        addUserForm.reset({ type: 'vendedor', cpf: '', displayName: '', email: '', password: '', phone: '' });
      } else {
        toast({
          title: "Erro ao Criar Usuário",
          description: result.message,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("CRITICAL ERROR adding user:", error);
      toast({
        title: "Erro de Rede",
        description: "Não foi possível conectar ao servidor para criar o usuário.",
        variant: "destructive",
      });
    } finally {
      setIsSubmittingUser(false);
    }
  };

  const handleOpenUpdateWithdrawalModal = (withdrawal: WithdrawalRequestWithId) => {
    setSelectedWithdrawal(withdrawal);
    updateWithdrawalForm.reset({ status: withdrawal.status, adminNotes: withdrawal.adminNotes || '' });
    setIsUpdateWithdrawalModalOpen(true);
  };

  const handleUpdateWithdrawal = async (data: UpdateWithdrawalFormData) => {
    if (!selectedWithdrawal) return;
    setIsSubmittingAction(true);
    setTimeout(() => {
        setWithdrawalRequests(prev => prev.map(w => w.id === selectedWithdrawal.id ? {...w, ...data, processedAt: (data.status === 'concluido' || data.status === 'falhou') ? new Date().toISOString() : w.processedAt} : w));
        toast({ title: "Status de Saque Atualizado", description: "Solicitação atualizada (simulado)." });
        setIsUpdateWithdrawalModalOpen(false);
        setIsSubmittingAction(false);
    }, 1000);
  };

  const handleExportUsersCSV = () => {
    if (filteredUsers.length === 0) {
      toast({ title: "Nenhum usuário para exportar", description: "A seleção atual de filtros não retornou usuários." });
      return;
    }
    const dataToExport = filteredUsers.map(user => ({ 'UID': user.uid, 'Nome': user.displayName || 'N/A', 'Email': user.email || 'N/A', 'CPF': user.cpf || 'N/A', 'Telefone': user.phone || 'N/A', 'Tipo': user.type || 'N/A', 'Saldo Pessoal (R$)': (user.personalBalance || 0).toFixed(2).replace('.', ','), 'Saldo MLM (R$)': (user.mlmBalance || 0).toFixed(2).replace('.', ','), 'Data de Criação': user.createdAt ? format(parseISO(user.createdAt as string), "yyyy-MM-dd HH:mm:ss") : 'N/A', 'Último Acesso': user.lastSignInTime ? format(parseISO(user.lastSignInTime as string), "yyyy-MM-dd HH:mm:ss") : 'N/A' }));
    const csv = Papa.unparse(dataToExport);
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `usuarios_planus_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
    toast({ title: "Exportação Iniciada", description: `${filteredUsers.length} usuários exportados.` });
  };
  
  const handleSyncSellers = async () => {
      setIsSyncing(true);
      const result = await syncLegacySellers();
      toast({
          title: result.success ? "Sincronização Concluída" : "Erro na Sincronização",
          description: result.message,
          variant: result.success ? "default" : "destructive",
          duration: 9000,
      });
      if (result.success) {
          await refreshUsers();
      }
      setIsSyncing(false);
  };

  const handleProcessOldWithdrawals = async () => {
    setIsProcessingWithdrawals(true);
    const result = await processOldWithdrawals();
    toast({
        title: result.success ? "Processamento Concluído" : "Erro no Processamento",
        description: result.message,
        variant: result.success ? "default" : "destructive",
        duration: 9000,
    });
    // Here you would typically re-fetch withdrawal data.
    // For this example, we'll just show the toast.
    setIsProcessingWithdrawals(false);
  };

  const formatCurrency = (value: number | undefined) => value?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) || "R$ 0,00";

  const filteredLeads = useMemo(() => {
    return allLeads.filter(lead => {
      if (!dateRange || !dateRange.from) return true; // Show all if no date range
      const createdAt = new Date(lead.createdAt);
      const inRange = createdAt >= dateRange.from && (!dateRange.to || createdAt <= dateRange.to);
      return inRange;
    });
  }, [allLeads, dateRange]);

  const aggregatedMetrics = useMemo(() => {
    const paidCommissions = withdrawalRequests.filter(w => w.status === 'concluido').reduce((sum, w) => sum + w.amount, 0);
    const pendingCommissions = withdrawalRequests.filter(w => w.status === 'pendente').reduce((sum, w) => sum + w.amount, 0);
    const finalizedLeadsValue = filteredLeads.filter(l => l.stageId === 'finalizado').reduce((sum, l) => sum + (l.value || 0), 0);
    return { paidCommissions, pendingCommissions, finalizedLeadsValue };
  }, [withdrawalRequests, filteredLeads]);

  const funnelMetrics = useMemo(() => {
    const funnelOrder: StageId[] = ['contato', 'fatura', 'proposta', 'contrato', 'assinado', 'finalizado'];
    const stageIndices = funnelOrder.reduce((acc, stage, index) => {
        acc[stage] = index;
        return acc;
    }, {} as Record<string, number>);

    const leadsPassingThrough = funnelOrder.map(stageId => {
        const stageIndex = stageIndices[stageId];
        const count = filteredLeads.filter(lead => {
            const leadStageIndex = stageIndices[lead.stageId];
            return leadStageIndex !== undefined && leadStageIndex >= stageIndex;
        }).length;
        return { 
            name: STAGES_CONFIG.find(s => s.id === stageId)?.title || stageId, 
            value: count 
        };
    });
    
    return funnelOrder.map((stageId, index) => {
        const currentStage = leadsPassingThrough.find(s => s.name === (STAGES_CONFIG.find(conf => conf.id === stageId)?.title || stageId));
        const prevStageCount = index > 0 ? leadsPassingThrough[index - 1].value : (currentStage?.value || 0);
        const conversionRate = prevStageCount > 0 ? ((currentStage?.value || 0) / prevStageCount) * 100 : 100;
        
        return {
            name: currentStage?.name || 'N/A',
            value: currentStage?.value || 0,
            conversion: conversionRate.toFixed(1) + '%',
        };
    }).filter(d => d.value > 0);
  }, [filteredLeads]);


  const leadSourceMetrics = useMemo(() => {
    const finalizedLeads = filteredLeads.filter(l => l.stageId === 'finalizado');
    const sourceCounts = finalizedLeads.reduce((acc, lead) => {
        const source = lead.leadSource || 'Não Informado';
        acc[source] = (acc[source] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    return Object.entries(sourceCounts).map(([name, value]) => ({ name, value }));
  }, [filteredLeads]);
  

  const sellerPerformanceMetrics = useMemo(() => {
    return filteredUsers
      .map(user => {
        const userLeads = filteredLeads.filter(lead => lead.userId === user.uid);
        if (userLeads.length === 0) return null;

        const finalizedLeads = userLeads.filter(l => l.stageId === 'finalizado' && l.completedAt && l.createdAt);
        const totalTimeToClose = finalizedLeads.reduce((sum, l) => sum + differenceInDays(parseISO(l.completedAt!), parseISO(l.createdAt)), 0);
        
        return {
          uid: user.uid,
          name: user.displayName || user.email || 'N/A',
          totalLeads: userLeads.length,
          finalizedLeads: finalizedLeads.length,
          conversionRate: finalizedLeads.length > 0 ? ((finalizedLeads.length / userLeads.length) * 100).toFixed(1) + '%' : '0.0%',
          avgTimeToClose: finalizedLeads.length > 0 ? (totalTimeToClose / finalizedLeads.length).toFixed(1) + ' dias' : 'N/A',
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((a, b) => b.finalizedLeads - a.finalizedLeads);
  }, [filteredLeads, filteredUsers]);


  const CHART_COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#0088FE', '#00C49F'];

  const getUserTypeBadgeStyle = (type?: UserType) => {
    if (!type) return 'bg-gray-500/20 text-gray-400';
    switch (type) {
      case 'superadmin': return 'bg-yellow-500/20 text-yellow-400';
      case 'admin': return 'bg-red-500/20 text-red-400';
      case 'vendedor': return 'bg-blue-500/20 text-blue-400';
      case 'prospector': return 'bg-purple-500/20 text-purple-400';
      case 'user': return 'bg-green-500/20 text-green-400';
      case 'pending_setup': return 'bg-orange-500/20 text-orange-400';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center">
        <h1 className="text-2xl md:text-3xl font-semibold text-foreground flex items-center">
          <ShieldAlert className="w-8 h-8 mr-3 text-primary" />
          Painel do Administrador
        </h1>
        <div className="flex items-center space-x-2 mt-4 md:mt-0">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-[280px] justify-start text-left font-normal">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateRange?.from ? (dateRange.to ? `${format(dateRange.from, "dd/MM/yy")} - ${format(dateRange.to, "dd/MM/yy")}` : format(dateRange.from, "dd/MM/yy")) : (<span>Selecione o período</span>)}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end"><Calendar mode="range" selected={dateRange} onSelect={setDateRange} initialFocus locale={ptBR} /></PopoverContent>
          </Popover>
          <Button variant="outline" size="icon" disabled><Filter className="w-4 h-4" /></Button>
          <Button variant="outline" size="icon" onClick={refreshUsers} disabled={isLoadingUsersProp}><RefreshCw className={cn("w-4 h-4", isLoadingUsersProp && "animate-spin")} /></Button>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-card/70 backdrop-blur-lg border"><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium text-primary">Comissões Pagas</CardTitle><DollarSign className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{formatCurrency(aggregatedMetrics.paidCommissions)}</div></CardContent></Card>
        <Card className="bg-card/70 backdrop-blur-lg border"><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium text-primary">Saques Pendentes</CardTitle><WalletCards className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{formatCurrency(aggregatedMetrics.pendingCommissions)}</div></CardContent></Card>
        <Card className="bg-card/70 backdrop-blur-lg border"><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium text-primary">Leads Finalizados (Período)</CardTitle><DollarSign className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{formatCurrency(aggregatedMetrics.finalizedLeadsValue)}</div><p className="text-xs text-muted-foreground">{filteredLeads.filter(l=>l.stageId === 'finalizado').length} leads</p></CardContent></Card>
        <Card className="bg-card/70 backdrop-blur-lg border"><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium text-primary">Total de Usuários</CardTitle><Users className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{initialUsers.length}</div></CardContent></Card>
      </div>

      <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
          <Card className="bg-card/70 backdrop-blur-lg border">
              <CardHeader>
                  <CardTitle className="text-primary flex items-center"><TrendingUp className="mr-2 h-5 w-5"/>Funil de Vendas</CardTitle>
                  <CardDescription>Conversão de leads entre estágios no período selecionado.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                  {funnelMetrics.length > 0 ? (
                      funnelMetrics.map((stage, index) => (
                          <div key={stage.name} className="flex items-center">
                              <div className="flex-1 space-y-1">
                                  <div className="flex justify-between">
                                      <p className="font-medium">{stage.name}</p>
                                      <p className="font-semibold text-foreground">{stage.value} Leads</p>
                                  </div>
                                  <div className="h-2 w-full bg-muted rounded-full">
                                      <div className="h-2 bg-primary rounded-full" style={{ width: `${(stage.value / funnelMetrics[0].value) * 100}%` }}></div>
                                  </div>
                              </div>
                              {index > 0 && (
                                  <div className="text-center w-24 flex-shrink-0">
                                      <ArrowRight className="h-4 w-4 mx-auto text-muted-foreground" />
                                      <p className="text-xs font-semibold text-green-500">{stage.conversion}</p>
                                  </div>
                              )}
                          </div>
                      ))
                  ) : (
                      <p className="text-center text-muted-foreground py-10">Nenhum dado para o funil neste período.</p>
                  )}
              </CardContent>
          </Card>
          <Card className="bg-card/70 backdrop-blur-lg border">
              <CardHeader>
                  <CardTitle className="text-primary flex items-center"><PieChartIcon className="mr-2 h-5 w-5"/>Origem dos Leads Convertidos</CardTitle>
                  <CardDescription>Distribuição de fontes para leads finalizados no período.</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px]">
                  {leadSourceMetrics.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                              <Pie data={leadSourceMetrics} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} labelLine={false} label={({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => { const radius = innerRadius + (outerRadius - innerRadius) * 1.2; const x = cx + radius * Math.cos(-midAngle * (Math.PI / 180)); const y = cy + radius * Math.sin(-midAngle * (Math.PI / 180)); return (<text x={x} y={y} fill="currentColor" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" className="text-xs fill-muted-foreground">{`${(percent * 100).toFixed(0)}%`}</text>);}}>
                                  {leadSourceMetrics.map((entry, index) => <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}
                              </Pie>
                              <RechartsTooltip formatter={(value: number) => `${value} leads`} />
                              <Legend />
                          </PieChart>
                      </ResponsiveContainer>
                  ) : (
                      <p className="text-center text-muted-foreground pt-10">Nenhum lead convertido no período para exibir.</p>
                  )}
              </CardContent>
          </Card>
      </div>

      <Card className="bg-card/70 backdrop-blur-lg border">
          <CardHeader>
              <CardTitle className="text-primary flex items-center"><BarChartHorizontalBig className="mr-2 h-5 w-5"/>Relatório de Performance por Vendedor</CardTitle>
              <CardDescription>Análise detalhada do desempenho da equipe no período.</CardDescription>
          </CardHeader>
          <CardContent>
              {sellerPerformanceMetrics.length > 0 ? (
                  <Table>
                      <TableHeader><TableRow><TableHead>Vendedor</TableHead><TableHead>Leads Trabalhados</TableHead><TableHead>Leads Finalizados</TableHead><TableHead>Taxa de Conversão</TableHead><TableHead>Tempo Médio de Fechamento</TableHead></TableRow></TableHeader>
                      <TableBody>
                          {sellerPerformanceMetrics.map(seller => (
                              <TableRow key={seller.uid}>
                                  <TableCell className="font-medium">{seller.name}</TableCell>
                                  <TableCell>{seller.totalLeads}</TableCell>
                                  <TableCell className="font-semibold text-primary">{seller.finalizedLeads}</TableCell>
                                  <TableCell>{seller.conversionRate}</TableCell>
                                  <TableCell>{seller.avgTimeToClose}</TableCell>
                              </TableRow>
                          ))}
                      </TableBody>
                  </Table>
              ) : (
                  <p className="text-center text-muted-foreground py-10">Nenhum dado de performance para exibir no período selecionado.</p>
              )}
          </CardContent>
      </Card>

      <Card className="bg-card/70 backdrop-blur-lg border">
        <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div><CardTitle className="text-primary flex items-center"><Users className="mr-2 h-5 w-5" />Gerenciamento de Usuários</CardTitle><CardDescription>Adicione e gerencie usuários e suas comissões.</CardDescription></div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button onClick={handleProcessOldWithdrawals} size="sm" variant="outline" disabled={isProcessingWithdrawals}>
              {isProcessingWithdrawals ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Banknote className="mr-2 h-4 w-4" />}
              Processar Saques Antigos
            </Button>
            <Button onClick={handleSyncSellers} size="sm" variant="outline" disabled={isSyncing}>
              {isSyncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Shuffle className="mr-2 h-4 w-4" />}
                Sincronizar Vendedores
            </Button>
            <Button onClick={handleExportUsersCSV} size="sm" variant="outline"><Download className="mr-2 h-4 w-4" /> Exportar</Button>
            {canEdit && <Button onClick={() => setIsAddUserModalOpen(true)} size="sm"><UserPlus className="mr-2 h-4 w-4" /> Adicionar Usuário</Button>}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <div className="relative flex-1"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Buscar por nome, email ou CPF..." className="pl-8" value={userSearchTerm} onChange={(e) => setUserSearchTerm(e.target.value)} /></div>
            <Select value={userTypeFilter} onValueChange={(value) => setUserTypeFilter(value as UserType | 'all')}><SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Filtrar por tipo" /></SelectTrigger><SelectContent>{USER_TYPE_FILTER_OPTIONS.map(option => (<SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>))}</SelectContent></Select>
          </div>
          {isLoadingUsersProp ? (<div className="flex justify-center items-center h-40"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>) : filteredUsers.length === 0 ? (<p className="text-center text-muted-foreground py-4">Nenhum usuário encontrado com os filtros atuais.</p>) : (
            <Table>
              <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Email</TableHead><TableHead>CPF</TableHead><TableHead>Telefone</TableHead><TableHead>Tipo</TableHead><TableHead>Último Acesso</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
              <TableBody>
                {filteredUsers.map(user => (
                  <TableRow key={user.uid}>
                    <TableCell className="font-medium"><div className="flex items-center gap-2"><Avatar className="h-8 w-8"><AvatarImage src={user.photoURL || undefined} alt={user.displayName || 'User'} /><AvatarFallback>{(user.displayName || user.email || 'U').charAt(0).toUpperCase()}</AvatarFallback></Avatar>{user.displayName || user.email?.split('@')[0] || 'N/A'}</div></TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>{user.cpf ? `${user.cpf.slice(0,3)}.${user.cpf.slice(3,6)}.${user.cpf.slice(6,9)}-${user.cpf.slice(9,11)}` : 'N/A'}</TableCell>
                    <TableCell>{user.phone || 'N/A'}</TableCell>
                    <TableCell><span className={`px-2 py-1 text-xs rounded-full ${getUserTypeBadgeStyle(user.type)}`}>{USER_TYPE_FILTER_OPTIONS.find(opt => opt.value === user.type)?.label || user.type}</span></TableCell>
                    <TableCell>{user.lastSignInTime ? format(parseISO(user.lastSignInTime as string), "dd/MM/yy HH:mm") : 'Nunca'}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><Settings className="h-4 w-4" /><span className="sr-only">Ações</span></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Ações</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onSelect={() => handleOpenEditModal(user)}>
                            <Edit2 className="h-4 w-4 mr-2" />
                            Ver / Editar Detalhes
                          </DropdownMenuItem>
                          {canEdit && <DropdownMenuSeparator />}
                          {canEdit && (<DropdownMenuItem className="text-destructive focus:text-destructive-foreground focus:bg-destructive" onSelect={() => handleOpenResetPasswordModal(user)}>
                            <ShieldAlert className="mr-2 h-4 w-4" />
                            Redefinir Senha
                          </DropdownMenuItem>)}
                          {canEdit && (
                            <DropdownMenuItem className="text-destructive focus:text-destructive-foreground focus:bg-destructive" onSelect={() => handleOpenDeleteModal(user)}>
                                <Trash2 className="mr-2 h-4 w-4" />
                                Excluir Usuário
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="bg-card/70 backdrop-blur-lg border">
        <CardHeader><CardTitle className="text-primary">Solicitações de Saque</CardTitle></CardHeader>
        <CardContent>
          <Input placeholder="Buscar por usuário ou chave PIX..." className="mb-4" />
          <Table>
            <TableHeader><TableRow><TableHead>Usuário</TableHead><TableHead>Valor</TableHead><TableHead>Tipo</TableHead><TableHead>Chave PIX</TableHead><TableHead>Solicitado em</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
            <TableBody>
              {withdrawalRequests.map(req => (
                <TableRow key={req.id}>
                  <TableCell>{req.userName || req.userEmail}</TableCell><TableCell>{formatCurrency(req.amount)}</TableCell>
                  <TableCell>{req.withdrawalType === 'personal' ? 'Pessoal' : 'Rede MLM'}</TableCell><TableCell title={req.pixKey} className="truncate max-w-[150px]">{req.pixKeyType}: {req.pixKey}</TableCell>
                  <TableCell>{req.requestedAt ? format(parseISO(req.requestedAt as string), "dd/MM/yy HH:mm") : 'N/A'}</TableCell>
                  <TableCell><span className={`px-2 py-1 text-xs rounded-full ${req.status === 'concluido' ? 'bg-green-500/20 text-green-400' : req.status === 'pendente' ? 'bg-yellow-500/20 text-yellow-400' : req.status === 'falhou' ? 'bg-red-500/20 text-red-400' : 'bg-gray-500/20 text-gray-400'}`}>{req.status}</span></TableCell>
                  <TableCell className="text-right"><Button variant="outline" size="sm" onClick={() => handleOpenUpdateWithdrawalModal(req)}><ExternalLink className="h-3 w-3 mr-1"/>Detalhes</Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Modals */}
      <Dialog open={isAddUserModalOpen} onOpenChange={setIsAddUserModalOpen}><DialogContent className="sm:max-w-[425px] bg-card/80 backdrop-blur-xl border text-foreground"><DialogHeader><DialogTitle className="text-primary">Adicionar Novo Usuário</DialogTitle><DialogDescription>Crie uma nova conta de usuário para o sistema.</DialogDescription></DialogHeader><Form {...addUserForm}><form onSubmit={addUserForm.handleSubmit(handleAddUser)} className="space-y-4 py-3"><FormField control={addUserForm.control} name="displayName" render={({ field }) => (<FormItem><FormLabel>Nome Completo (Opcional)</FormLabel><FormControl><Input placeholder="Ex: João da Silva" {...field} /></FormControl><FormMessage /></FormItem>)} /><FormField control={addUserForm.control} name="email" render={({ field }) => (<FormItem><FormLabel>Email*</FormLabel><FormControl><Input type="email" placeholder="Ex: joao.silva@example.com" {...field} /></FormControl><FormMessage /></FormItem>)} /><FormField control={addUserForm.control} name="phone" render={({ field }) => (<FormItem><FormLabel>Telefone (Opcional)</FormLabel><FormControl><Input placeholder="(XX) XXXXX-XXXX" {...field} /></FormControl><FormMessage /></FormItem>)} /><FormField control={addUserForm.control} name="password" render={({ field }) => (<FormItem><FormLabel>Senha*</FormLabel><FormControl><Input type="password" placeholder="Mínimo 6 caracteres" {...field} /></FormControl><FormMessage /></FormItem>)} /><FormField control={addUserForm.control} name="cpf" render={({ field }) => (<FormItem><FormLabel>CPF*</FormLabel><FormControl><Input placeholder="Ex: 000.000.000-00" {...field} /></FormControl><FormMessage /></FormItem>)} /><FormField control={addUserForm.control} name="type" render={({ field }) => (<FormItem><FormLabel>Tipo de Usuário*</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Selecione o tipo" /></SelectTrigger></FormControl><SelectContent>{USER_TYPE_ADD_OPTIONS.map(opt => (<SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>)} /><DialogFooter><Button type="button" variant="outline" onClick={() => { setIsAddUserModalOpen(false); addUserForm.reset(); }} disabled={isSubmittingUser}>Cancelar</Button><Button type="submit" disabled={isSubmittingUser}>{isSubmittingUser ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : null}Adicionar</Button></DialogFooter></form></Form></DialogContent></Dialog>
      
      {selectedUser && (
        <Dialog open={isEditUserModalOpen} onOpenChange={setIsEditUserModalOpen}>
          <DialogContent className="sm:max-w-md bg-card/80 backdrop-blur-xl border text-foreground">
            <DialogHeader>
              <DialogTitle className="text-primary">Ver / Editar Usuário</DialogTitle>
              <DialogDescription>
                {canEdit ? 'Altere os dados, permissões e comissões do usuário.' : 'Você está visualizando os detalhes do usuário.'}
              </DialogDescription>
            </DialogHeader>
            <Form {...editUserForm}>
              <form onSubmit={editUserForm.handleSubmit((data) => handleUpdateUser(data, refreshUsers))} className="space-y-4 py-3">
                
                {/* User Info */}
                <Card><CardHeader className="p-3"><CardTitle className="text-base">Informações Pessoais</CardTitle></CardHeader><CardContent className="p-3 space-y-3">
                    <FormField control={editUserForm.control} name="displayName" render={({ field }) => (<FormItem><FormLabel>Nome Completo</FormLabel><FormControl><Input {...field} disabled={!canEdit || isSubmittingAction} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={editUserForm.control} name="phone" render={({ field }) => (<FormItem><FormLabel>Telefone</FormLabel><FormControl><Input {...field} disabled={!canEdit || isSubmittingAction} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={editUserForm.control} name="type" render={({ field }) => (<FormItem><FormLabel>Tipo de Usuário</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value} disabled={!canEdit || isSubmittingAction}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent>{USER_TYPE_ADD_OPTIONS.map(opt => (<SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>)} />
                </CardContent></Card>
                
                {/* Permissions */}
                <Card><CardHeader className="p-3"><CardTitle className="text-base">Permissões da Plataforma</CardTitle></CardHeader><CardContent className="p-3 space-y-3">
                    <FormField control={editUserForm.control} name="canViewCrm" render={({ field }) => (<FormItem className="flex items-center justify-between"><div className="space-y-0.5"><FormLabel>Acesso ao CRM</FormLabel></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} disabled={!canEdit || isSubmittingAction} /></FormControl></FormItem>)} />
                    <FormField control={editUserForm.control} name="canViewCareerPlan" render={({ field }) => (<FormItem className="flex items-center justify-between"><div className="space-y-0.5"><FormLabel>Ver Plano de Carreira</FormLabel></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} disabled={!canEdit || isSubmittingAction} /></FormControl></FormItem>)} />
                    <FormField control={editUserForm.control} name="canViewLeadPhoneNumber" render={({ field }) => (<FormItem className="flex items-center justify-between"><div className="space-y-0.5"><FormLabel>Ver Telefone dos Leads</FormLabel></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} disabled={!canEdit || isSubmittingAction} /></FormControl></FormItem>)} />
                    <FormField
                      control={editUserForm.control}
                      name="assignmentLimit"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center"><ClipboardList className="mr-2 h-4 w-4" />Limite de Leads Ativos</FormLabel>
                          <Select 
                            onValueChange={(value) => field.onChange(value === 'none' ? undefined : Number(value))} 
                            value={field.value !== undefined ? String(field.value) : '2'} // Default to 2 if undefined
                            disabled={!canEdit || isSubmittingAction}
                          >
                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent>
                              <SelectItem value="2">2 (Padrão)</SelectItem>
                              <SelectItem value="5">5</SelectItem>
                              <SelectItem value="10">10</SelectItem>
                              <SelectItem value="20">20</SelectItem>
                              <SelectItem value="50">50</SelectItem>
                              <SelectItem value="9999">Ilimitado</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormDescription className="text-xs">Máximo de leads sem feedback que o vendedor pode ter.</FormDescription>
                        </FormItem>
                      )}
                    />
                </CardContent></Card>

                {/* Commissions */}
                <Card><CardHeader className="p-3"><CardTitle className="text-base">Configurações de Comissão</CardTitle></CardHeader><CardContent className="p-3 space-y-3">
                    <FormField control={editUserForm.control} name="commissionRate" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center"><Percent className="mr-2 h-4 w-4"/>Comissão Direta</FormLabel>
                        <Select 
                          onValueChange={(value) => field.onChange(value === 'none' ? undefined : Number(value))} 
                          value={field.value !== undefined ? String(field.value) : 'none'} 
                          disabled={!canEdit || isSubmittingAction}
                        >
                          <FormControl><SelectTrigger><SelectValue placeholder="Padrão (40%/50%)" /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="none">Padrão do Nível</SelectItem>
                            <SelectItem value="40">40%</SelectItem>
                            <SelectItem value="50">50%</SelectItem>
                            <SelectItem value="60">60%</SelectItem>
                            <SelectItem value="80">80%</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )} />
                    <FormField control={editUserForm.control} name="recurrenceRate" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center"><RefreshCw className="mr-2 h-4 w-4"/>Recorrência</FormLabel>
                          <Select 
                            onValueChange={(value) => field.onChange(value === 'none' ? undefined : Number(value))}
                            value={field.value !== undefined && field.value !== null ? String(field.value) : 'none'}
                            disabled={!canEdit || isSubmittingAction}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Sem Recorrência" /></SelectTrigger></FormControl>
                            <SelectContent>
                              <SelectItem value="none">Sem Recorrência</SelectItem>
                              <SelectItem value="0.5">0.5%</SelectItem>
                              <SelectItem value="1">1%</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormItem>
                    )} />
                    <FormField control={editUserForm.control} name="mlmEnabled" render={({ field }) => (<FormItem className="flex items-center justify-between"><FormLabel className="flex items-center"><Network className="mr-2 h-4 w-4"/>Ativar Multinível</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} disabled={!canEdit || isSubmittingAction} /></FormControl></FormItem>)} />
                    {editUserForm.watch("mlmEnabled") && (<>
                        <FormField control={editUserForm.control} name="uplineUid" render={({ field }) => (<FormItem><FormLabel>Upline (Líder Direto)</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value} disabled={!canEdit || isSubmittingAction}><FormControl><SelectTrigger><SelectValue placeholder="Selecione o upline" /></SelectTrigger></FormControl><SelectContent>{initialUsers.filter(u => u.uid !== selectedUser.uid).map(u => <SelectItem key={u.uid} value={u.uid}>{u.displayName}</SelectItem>)}</SelectContent></Select></FormItem>)} />
                        <FormField control={editUserForm.control} name="mlmLevel" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nível de Override</FormLabel>
                            <Select 
                              onValueChange={(value) => field.onChange(value === 'none' ? undefined : Number(value))}
                              value={field.value !== undefined ? String(field.value) : 'none'}
                              disabled={!canEdit || isSubmittingAction}>
                              <FormControl><SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger></FormControl>
                              <SelectContent>
                                <SelectItem value="none">Nenhum</SelectItem>
                                <SelectItem value="1">Nível 1 (5%)</SelectItem>
                                <SelectItem value="2">Nível 2 (3%)</SelectItem>
                                <SelectItem value="3">Nível 3 (2%)</SelectItem>
                                <SelectItem value="4">Nível 4 (1%)</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )} />
                    </>)}
                </CardContent></Card>


                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsEditUserModalOpen(false)} disabled={isSubmittingAction}>
                    {canEdit ? 'Cancelar' : 'Fechar'}
                  </Button>
                  {canEdit && (
                    <Button type="submit" disabled={isSubmittingAction}>
                      {isSubmittingAction && <Loader2 className="animate-spin mr-2 h-4 w-4" />}
                      Salvar Alterações
                    </Button>
                  )}
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      )}

      {selectedWithdrawal && (<Dialog open={isUpdateWithdrawalModalOpen} onOpenChange={setIsUpdateWithdrawalModalOpen}><DialogContent className="sm:max-w-md bg-card/80 backdrop-blur-xl border text-foreground"><DialogHeader><DialogTitle className="text-primary">Processar Solicitação de Saque</DialogTitle><DialogDescription>ID: {selectedWithdrawal.id}</DialogDescription></DialogHeader><div className="py-2 text-sm"><p><strong>Usuário:</strong> {selectedWithdrawal.userName || selectedWithdrawal.userEmail}</p><p><strong>Valor:</strong> {formatCurrency(selectedWithdrawal.amount)} ({selectedWithdrawal.withdrawalType})</p><p><strong>PIX:</strong> {selectedWithdrawal.pixKeyType} - {selectedWithdrawal.pixKey}</p><p><strong>Solicitado em:</strong> {selectedWithdrawal.requestedAt ? format(parseISO(selectedWithdrawal.requestedAt as string), "dd/MM/yyyy HH:mm") : 'N/A'}</p></div><Form {...updateWithdrawalForm}><form onSubmit={updateWithdrawalForm.handleSubmit(handleUpdateWithdrawal)} className="space-y-4 pt-2"><FormField control={updateWithdrawalForm.control} name="status" render={({ field }) => (<FormItem><FormLabel>Novo Status</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Selecione o status" /></SelectTrigger></FormControl><SelectContent>{WITHDRAWAL_STATUSES_ADMIN.map(status => (<SelectItem key={status} value={status}>{status.charAt(0).toUpperCase() + status.slice(1)}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>)} /><FormField control={updateWithdrawalForm.control} name="adminNotes" render={({ field }) => (<FormItem><FormLabel>Notas do Admin (Opcional)</FormLabel><FormControl><Input placeholder="Ex: Pagamento efetuado" {...field} /></FormControl><FormMessage /></FormItem>)} /><DialogFooter><Button type="button" variant="outline" onClick={() => setIsUpdateWithdrawalModalOpen(false)} disabled={isSubmittingAction}>Cancelar</Button><Button type="submit" disabled={isSubmittingAction}>{isSubmittingAction ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : null}Atualizar Status</Button></DialogFooter></form></Form></DialogContent></Dialog>)}
      
      <AlertDialog open={isResetPasswordModalOpen} onOpenChange={setIsResetPasswordModalOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Confirmar Redefinição de Senha</AlertDialogTitle><AlertDialogDescription>Um email será enviado para <strong>{selectedUser?.email}</strong> com instruções para criar uma nova senha. O usuário será desconectado de todas as sessões ativas. Deseja continuar?</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={isSubmittingAction}>Cancelar</AlertDialogCancel><AlertDialogAction onClick={handleConfirmResetPassword} disabled={isSubmittingAction}>{isSubmittingAction && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Enviar Email</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
      
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
            <AlertDialogTitle>Tem certeza que deseja excluir?</AlertDialogTitle>
            <AlertDialogDescription>
                Esta ação não pode ser desfeita. Isso excluirá permanentemente o usuário{' '}
                <strong className="text-foreground">{userToDelete?.displayName}</strong> ({userToDelete?.email}) e
                reatribuirá todos os seus leads para "Sistema".
            </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setUserToDelete(null)} disabled={isSubmittingAction}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
                className="bg-destructive hover:bg-destructive/90"
                onClick={handleConfirmDelete}
                disabled={isSubmittingAction}
            >
                {isSubmittingAction && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Sim, Excluir Usuário
            </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
