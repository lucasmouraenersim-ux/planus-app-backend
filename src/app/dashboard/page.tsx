
"use client";

import { useState, useEffect, Suspense, useMemo } from 'react';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableCaption,
} from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Wallet, Landmark, Send, History, DollarSign, Users, Info, Loader2, FileSignature, Check, CircleDotDashed, Network } from 'lucide-react';
import type { WithdrawalRequestWithId, PixKeyType, WithdrawalType, WithdrawalStatus } from '@/types/wallet';
import type { LeadWithId } from '@/types/crm';
import type { FirestoreUser } from '@/types/user';
import { PIX_KEY_TYPES, WITHDRAWAL_TYPES } from '@/types/wallet';
import { requestWithdrawal, updateLeadCommissionStatus } from '@/lib/firebase/firestore'; 
import { useAuth } from '@/contexts/AuthContext';
import { collection, onSnapshot, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getWithdrawalHistoryForUser } from '@/actions/user/getWithdrawalHistory';


const withdrawalFormSchema = z.object({
  amount: z.preprocess(
    (val) => parseFloat(String(val).replace(",", ".")),
    z.number().positive("O valor deve ser positivo.")
  ),
  withdrawalType: z.enum(WITHDRAWAL_TYPES, {
    required_error: "Selecione a origem do saldo.",
  }),
  pixKeyType: z.enum(PIX_KEY_TYPES, {
    required_error: "Selecione o tipo de chave PIX.",
  }),
  pixKey: z.string().min(1, "A chave PIX é obrigatória."),
});

type WithdrawalFormData = z.infer<typeof withdrawalFormSchema>;

interface ContractToReceive {
    leadId: string;
    clientName: string;
    kwh: number;
    valueAfterDiscount: number;
    commission: number;
    recurrence?: number;
    isPaid: boolean;
}

interface MlmCommission {
    leadId: string;
    clientName: string;
    downlineSellerName: string;
    downlineLevel: number;
    valueAfterDiscount: number;
    commission: number;
}

function WalletPageContent() {
  const { toast } = useToast();
  const { appUser, userAppRole, isLoadingAuth, allFirestoreUsers, fetchAllCrmLeadsGlobally } = useAuth();
  const [isWithdrawalDialogOpen, setIsWithdrawalDialogOpen] = useState(false);
  const [withdrawalHistory, setWithdrawalHistory] = useState<WithdrawalRequestWithId[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [allLeads, setAllLeads] = useState<LeadWithId[]>([]);
  const [isLoadingLeads, setIsLoadingLeads] = useState(true);

  const form = useForm<WithdrawalFormData>({
    resolver: zodResolver(withdrawalFormSchema),
    defaultValues: {
      amount: 0,
      withdrawalType: undefined,
      pixKeyType: undefined,
      pixKey: "",
    },
  });

  useEffect(() => {
    if (!appUser) return;
    
    const fetchHistory = async () => {
        setIsLoadingHistory(true);
        try {
            const history = await getWithdrawalHistoryForUser(appUser.uid);
            setWithdrawalHistory(history);
        } catch (error) {
            console.error("Error fetching withdrawal history via action:", error);
            toast({ title: "Erro", description: "Não foi possível carregar o histórico de saques.", variant: "destructive" });
        } finally {
            setIsLoadingHistory(false);
        }
    };
    
    fetchHistory();
  }, [appUser, toast]);

  useEffect(() => {
    if (!appUser || !allFirestoreUsers.length) return;
  
    const fetchLeads = async () => {
        setIsLoadingLeads(true);
        
        try {
            // CORREÇÃO: Usar a mesma estratégia da página de Ranking
            // Busca TODOS os leads e filtra por sellerName (nome do vendedor)
            const leads = await fetchAllCrmLeadsGlobally();
            
            console.log('🔍 ===== DEBUG CARTEIRA =====');
            console.log('👤 appUser.uid:', appUser.uid);
            console.log('👤 appUser.displayName:', appUser.displayName);
            console.log('👤 userAppRole:', userAppRole);
            console.log('📊 Total de leads carregados:', leads.length);
            
            let filteredLeads = leads;
            
            // Admins veem todos, vendedores filtram por nome
            if (userAppRole !== 'admin' && userAppRole !== 'superadmin') {
                const sellerNameLower = (appUser.displayName || '').trim().toLowerCase();
                filteredLeads = leads.filter(lead => 
                    lead.sellerName?.trim().toLowerCase() === sellerNameLower
                );
                console.log('👤 Filtrando para vendedor:', sellerNameLower);
                console.log('📊 Leads após filtro por nome:', filteredLeads.length);
            }
            
            const finalizedLeads = filteredLeads.filter(l => l.stageId === 'finalizado');
            console.log('📊 Leads finalizados (total):', finalizedLeads.length);
            
            // Log detalhado de TODOS os leads finalizados
            console.log('📋 LEADS FINALIZADOS DETALHADOS:');
            finalizedLeads.forEach((lead, index) => {
                console.log(`\n  Lead ${index + 1}:`, {
                    id: lead.id,
                    name: lead.name,
                    sellerName: lead.sellerName,
                    stageId: lead.stageId,
                    value: lead.value,
                    valueAfterDiscount: lead.valueAfterDiscount,
                    kwh: lead.kwh,
                    commissionPaid: lead.commissionPaid,
                });
            });
            
            console.log('🔍 ===========================');
            
            setAllLeads(filteredLeads);
  
        } catch (error) {
            console.error("Error fetching leads for wallet:", error);
            toast({ title: "Erro ao carregar dados", description: "Não foi possível buscar os contratos da equipe.", variant: "destructive" });
        } finally {
            setIsLoadingLeads(false);
        }
    };
  
    fetchLeads();
  }, [appUser, userAppRole, allFirestoreUsers, toast, fetchAllCrmLeadsGlobally]);


  const contractsToReceive = useMemo((): ContractToReceive[] => {
    if (!appUser || !allLeads.length || !allFirestoreUsers.length) {
        console.log('⚠️ Condições não atendidas para calcular comissões:', {
            hasAppUser: !!appUser,
            leadsCount: allLeads.length,
            usersCount: allFirestoreUsers.length
        });
        return [];
    }
  
    // Filtrar apenas leads finalizados (os leads já vêm filtrados por vendedor no useEffect)
    const finalizedLeads = allLeads.filter(lead => lead.stageId === 'finalizado');
    
    console.log('\n💰 ===== CALCULANDO COMISSÕES =====');
    console.log('💰 Total de leads finalizados:', finalizedLeads.length);
  
    const contracts = finalizedLeads.map(lead => {
      // Buscar o vendedor por nome
      const sellerNameLower = (lead.sellerName || '').trim().toLowerCase();
      const seller = allFirestoreUsers.find(u => 
        u.displayName?.trim().toLowerCase() === sellerNameLower
      );
      
      let commissionRate = 40; // Default Bronze
      if (seller?.commissionRate) {
        commissionRate = seller.commissionRate;
      }
      
      // Melhor tratamento para valores undefined/null/0
      let baseValueForCommission = 0;
      
      if (lead.valueAfterDiscount != null && lead.valueAfterDiscount > 0) {
        baseValueForCommission = lead.valueAfterDiscount;
      } 
      else if (lead.value != null && lead.value > 0) {
        baseValueForCommission = lead.value;
      }
      
      const commission = baseValueForCommission * (commissionRate / 100);
      
      console.log(`💰 Lead ${lead.id} (${lead.name}):`);
      console.log(`   - sellerName: ${lead.sellerName}`);
      console.log(`   - seller: ${seller?.displayName || 'N/A'}`);
      console.log(`   - valueAfterDiscount: ${lead.valueAfterDiscount}`);
      console.log(`   - value: ${lead.value}`);
      console.log(`   - baseValueForCommission: ${baseValueForCommission}`);
      console.log(`   - commissionRate: ${commissionRate}`);
      console.log(`   - commission: ${commission}`);
      console.log(`   - isPaid: ${lead.commissionPaid}`);
      
      const recurrence = userAppRole === 'superadmin' ? (lead.valueAfterDiscount || 0) * ((seller?.recurrenceRate || 0) / 100) : undefined;
      
      return {
        leadId: lead.id,
        clientName: lead.name,
        kwh: lead.kwh || 0,
        valueAfterDiscount: baseValueForCommission,
        commission,
        recurrence,
        isPaid: lead.commissionPaid || false,
      };
    }).filter((c): c is NonNullable<typeof c> => c !== null && c.commission > 0);
    
    console.log('💰 Total de contratos com comissões válidas:', contracts.length);
    console.log('💰 ==================================\n');
    
    return contracts;
  }, [allLeads, allFirestoreUsers, appUser, userAppRole]);

  // Calcular o total de comissões pessoais pendentes (a receber)
  const totalPersonalCommissionToReceive = useMemo(() => {
    console.log('💵 ===== CALCULANDO SALDO PESSOAL =====');
    console.log(`💵 contractsToReceive.length: ${contractsToReceive.length}`);
    
    if (contractsToReceive.length === 0) {
      console.log('💵 ❌ NENHUM CONTRATO PARA CALCULAR!');
      console.log('💵 ==========================');
      return 0;
    }
    
    const pendingContracts = contractsToReceive.filter(contract => !contract.isPaid);
    const paidContracts = contractsToReceive.filter(contract => contract.isPaid);
    
    console.log(`💵 Total de contratos: ${contractsToReceive.length}`);
    console.log(`💵 Contratos pendentes: ${pendingContracts.length}`);
    console.log(`💵 Contratos pagos: ${paidContracts.length}`);
    
    const total = pendingContracts.reduce((sum, contract) => {
      console.log(`   + R$ ${contract.commission.toFixed(2)} - ${contract.clientName} (PENDENTE)`);
      return sum + contract.commission;
    }, 0);
    
    console.log(`💵 TOTAL SALDO PESSOAL: R$ ${total.toFixed(2)}`);
    console.log('💵 ==========================');
    
    return total;
  }, [contractsToReceive]);

  const { mlmCommissionsToReceive, totalMlmCommissionToReceive } = useMemo((): { mlmCommissionsToReceive: MlmCommission[], totalMlmCommissionToReceive: number } => {
    if (!appUser || !allLeads.length || !allFirestoreUsers.length) return { mlmCommissionsToReceive: [], totalMlmCommissionToReceive: 0 };
  
    const findDownline = (uplineId: string, level = 1, maxLevel = 4): { user: FirestoreUser, level: number }[] => {
      if (level > maxLevel) return [];
      const directDownline = allFirestoreUsers.filter(u => u.uplineUid === uplineId && u.mlmEnabled);
      let allDownline: { user: FirestoreUser, level: number }[] = directDownline.map(u => ({ user: u, level }));
      directDownline.forEach(u => {
        allDownline = [...allDownline, ...findDownline(u.uid, level + 1)];
      });
      return allDownline;
    };
    
    const downlineWithLevels = findDownline(appUser.uid);
    
    // Buscar leads finalizados da downline usando sellerName
    const downlineFinalizedLeads = allLeads.filter(lead => {
      if (lead.stageId !== 'finalizado' || !lead.sellerName || lead.commissionPaid) return false;
      
      const sellerNameLower = lead.sellerName.trim().toLowerCase();
      return downlineWithLevels.some(d => 
        d.user.displayName?.trim().toLowerCase() === sellerNameLower
      );
    });
  
    const commissionRates: { [key: number]: number } = { 1: 0.05, 2: 0.03, 3: 0.02, 4: 0.01 };
  
    const commissions = downlineFinalizedLeads.map(lead => {
      const sellerNameLower = lead.sellerName.trim().toLowerCase();
      const downlineMember = downlineWithLevels.find(d => 
        d.user.displayName?.trim().toLowerCase() === sellerNameLower
      );
      
      if (!downlineMember) return null;
        
      const levelForCommission = downlineMember.level;
      const commissionRate = commissionRates[levelForCommission];
        
      if (!commissionRate) return null;
      
      const baseValue = (lead.valueAfterDiscount != null && lead.valueAfterDiscount > 0) 
        ? lead.valueAfterDiscount 
        : (lead.value || 0);
  
      const commission = baseValue * commissionRate;
      if (commission <= 0) return null;
  
      return {
        leadId: lead.id,
        clientName: lead.name,
        downlineSellerName: downlineMember.user.displayName || 'N/A',
        downlineLevel: levelForCommission,
        valueAfterDiscount: baseValue,
        commission
      };
    }).filter((c): c is NonNullable<typeof c> => c !== null);
  
    const total = commissions.reduce((sum, item) => sum + item.commission, 0);
    return { mlmCommissionsToReceive: commissions, totalMlmCommissionToReceive: total };
  
  }, [allLeads, allFirestoreUsers, appUser]);

  const onSubmitWithdrawal = async (data: WithdrawalFormData) => {
    if (!appUser) {
      toast({ title: "Erro", description: "Usuário não autenticado.", variant: "destructive" });
      return;
    }

    const selectedBalance = data.withdrawalType === 'personal' ? totalPersonalCommissionToReceive : totalMlmCommissionToReceive;
    if (data.amount > selectedBalance) {
      form.setError("amount", {
        type: "manual",
        message: `Valor solicitado excede o saldo de ${data.withdrawalType === 'personal' ? 'Pessoal' : 'Rede MLM'} disponível.`,
      });
      return;
    }

    try {
      const requestId = await requestWithdrawal(
        appUser.uid,
        appUser.email || 'Não informado',
        appUser.displayName || 'Não informado',
        data.amount,
        data.pixKeyType,
        data.pixKey,
        data.withdrawalType
      );

      if (requestId) {
        toast({
          title: "Solicitação de Saque Enviada",
          description: "Sua solicitação foi registrada e será processada em breve.",
        });
        setIsWithdrawalDialogOpen(false);
        form.reset();
        
        const newEntry: WithdrawalRequestWithId = {
            id: requestId,
            userId: appUser.uid,
            userEmail: appUser.email || 'Não informado',
            userName: appUser.displayName || 'Não informado',
            ...data,
            status: 'pendente',
            requestedAt: new Date().toISOString(),
        };
        setWithdrawalHistory(prev => [newEntry, ...prev]);

      } else {
        toast({
          title: "Erro na Solicitação",
          description: "Não foi possível registrar sua solicitação. Tente novamente.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Erro ao solicitar saque:", error);
      toast({
        title: "Erro Inesperado",
        description: "Ocorreu um erro. Por favor, contate o suporte.",
        variant: "destructive",
      });
    }
  };

  const formatCurrency = (value: number | undefined | null) => {
    if (value === undefined || value === null || isNaN(value)) return "R$ 0,00";
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const getStatusBadgeVariant = (status: WithdrawalStatus): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case 'concluido': return 'default';
      case 'processando': return 'secondary';
      case 'pendente': return 'outline';
      case 'falhou': return 'destructive';
      default: return 'secondary';
    }
  };
  
  if (isLoadingAuth || !appUser) {
      return (
        <div className="flex flex-col justify-center items-center h-screen bg-transparent text-primary">
            <Loader2 className="animate-spin rounded-full h-12 w-12 text-primary mb-4" />
            <p className="text-lg font-medium">Carregando dados da carteira...</p>
        </div>
      );
  }

  return (
    <div className="relative flex flex-col h-[calc(100vh-56px)] overflow-y-auto p-4 md:p-6 space-y-6">
      <header className="flex justify-between items-center">
        <h1 className="text-2xl md:text-3xl font-semibold text-foreground flex items-center">
          <Wallet className="w-7 h-7 mr-3 text-primary" />
          Minha Carteira
        </h1>
      </header>

      <Card className="bg-card/70 backdrop-blur-lg border shadow-xl">
        <CardHeader>
          <CardTitle className="text-xl text-primary flex items-center">
            <DollarSign className="w-6 h-6 mr-2" />
            Saldo Disponível
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-lg">
          <div className="flex justify-between items-center p-3 bg-background/50 rounded-md">
            <span className="text-muted-foreground">Saldo Pessoal (Disponível):</span>
            <span className="font-semibold text-foreground">{formatCurrency(totalPersonalCommissionToReceive)}</span>
          </div>
          <div className="flex justify-between items-center p-3 bg-background/50 rounded-md">
            <span className="text-muted-foreground">Saldo de Rede (Disponível):</span>
            <span className="font-semibold text-foreground">{formatCurrency(totalMlmCommissionToReceive)}</span>
          </div>
          <div className="flex justify-between items-center p-3 bg-primary/10 rounded-md mt-2">
            <span className="font-bold text-primary">SALDO TOTAL DISPONÍVEL:</span>
            <span className="font-bold text-primary text-xl">{formatCurrency(totalPersonalCommissionToReceive + totalMlmCommissionToReceive)}</span>
          </div>
        </CardContent>
        <CardFooter>
          <Dialog open={isWithdrawalDialogOpen} onOpenChange={setIsWithdrawalDialogOpen}>
            <DialogTrigger asChild>
              <Button className="w-full md:w-auto bg-accent hover:bg-accent/90 text-accent-foreground">
                <Landmark className="w-5 h-5 mr-2" />
                Solicitar Saque
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[525px] bg-card/80 backdrop-blur-xl border text-foreground">
              <DialogHeader>
                <DialogTitle className="text-primary">Solicitar Saque</DialogTitle>
                <DialogDescription>
                  Preencha os dados para solicitar o saque dos seus saldos.
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmitWithdrawal)} className="space-y-4 py-4">
                  <FormField control={form.control} name="amount" render={({ field }) => ( <FormItem> <FormLabel>Valor do Saque (R$)</FormLabel> <FormControl> <Input type="number" placeholder="Ex: 100,50" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} /> </FormControl> <FormMessage /> </FormItem> )} />
                  <FormField control={form.control} name="withdrawalType" render={({ field }) => ( <FormItem> <FormLabel>Origem do Saldo</FormLabel> <Select onValueChange={field.onChange} defaultValue={field.value}> <FormControl> <SelectTrigger> <SelectValue placeholder="Selecione a origem do saldo" /> </SelectTrigger> </FormControl> <SelectContent> <SelectItem value="personal" disabled={totalPersonalCommissionToReceive <= 0}> Pessoal (Disponível: {formatCurrency(totalPersonalCommissionToReceive)}) </SelectItem> <SelectItem value="mlm" disabled={totalMlmCommissionToReceive <= 0}> Rede MLM (Disponível: {formatCurrency(totalMlmCommissionToReceive)}) </SelectItem> </SelectContent> </Select> <FormMessage /> </FormItem> )} />
                  <FormField control={form.control} name="pixKeyType" render={({ field }) => ( <FormItem> <FormLabel>Tipo de Chave PIX</FormLabel> <Select onValueChange={field.onChange} defaultValue={field.value}> <FormControl> <SelectTrigger> <SelectValue placeholder="Selecione o tipo da chave" /> </SelectTrigger> </FormControl> <SelectContent> {PIX_KEY_TYPES.map(type => ( <SelectItem key={type} value={type}>{type}</SelectItem> ))} </SelectContent> </Select> <FormMessage /> </FormItem> )} />
                  <FormField control={form.control} name="pixKey" render={({ field }) => ( <FormItem> <FormLabel>Chave PIX</FormLabel> <FormControl> <Input placeholder="Digite sua chave PIX" {...field} /> </FormControl> <FormMessage /> </FormItem> )} />
                  <DialogFooter className="pt-4">
                    <Button type="button" variant="outline" onClick={() => setIsWithdrawalDialogOpen(false)}> Cancelar </Button>
                    <Button type="submit" disabled={form.formState.isSubmitting}> {form.formState.isSubmitting ? "Enviando..." : "Confirmar Solicitação"} <Send className="w-4 h-4 ml-2" /> </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </CardFooter>
      </Card>

       <Card className="bg-card/70 backdrop-blur-lg border shadow-xl">
        <CardHeader>
          <CardTitle className="text-xl text-primary flex items-center">
            <FileSignature className="w-6 h-6 mr-2" />
            Comissões de Vendas Diretas a Receber
          </CardTitle>
          <CardDescription>Comissões geradas por contratos finalizados.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingLeads ? (
            <div className="flex justify-center items-center h-32">
              <Loader2 className="animate-spin rounded-full h-8 w-8 text-primary" />
              <p className="ml-3 text-muted-foreground">Carregando contratos...</p>
            </div>
          ) : contractsToReceive.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
                <Info size={48} className="mx-auto mb-4 opacity-50" />
                <p>Nenhum contrato finalizado encontrado.</p>
                <p className="text-sm">Quando você finalizar um contrato, a comissão aparecerá aqui.</p>
            </div>
          ) : (
            <Table>
              <TableCaption>Suas comissões de contratos finalizados.</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Consumo (KWh)</TableHead>
                  <TableHead>Valor Base</TableHead>
                  <TableHead>Sua Comissão</TableHead>
                  {userAppRole === 'superadmin' && <TableHead>Recorrência</TableHead>}
                  <TableHead className="text-center">Status Pagto.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contractsToReceive.map((contract) => (
                  <TableRow key={contract.leadId}>
                    <TableCell className="font-medium">{contract.clientName}</TableCell>
                    <TableCell>{contract.kwh.toLocaleString('pt-BR')} kWh</TableCell>
                    <TableCell>{formatCurrency(contract.valueAfterDiscount)}</TableCell>
                    <TableCell className="font-semibold text-green-500">{formatCurrency(contract.commission)}</TableCell>
                    {userAppRole === 'superadmin' && <TableCell>{formatCurrency(contract.recurrence)}</TableCell>}
                    <TableCell className="text-center">
                      <Badge variant={contract.isPaid ? 'default' : 'outline'} className={cn("h-7 px-2", contract.isPaid && "bg-green-600")}>
                         {contract.isPaid ? <Check className="w-4 h-4 mr-1.5"/> : <CircleDotDashed className="w-4 h-4 mr-1.5"/>}
                         {contract.isPaid ? 'Pago' : 'Pendente'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      
      <Card className="bg-card/70 backdrop-blur-lg border shadow-xl">
        <CardHeader>
          <CardTitle className="text-xl text-primary flex items-center">
            <Network className="w-6 h-6 mr-2" />
            Comissões de Rede a Receber (Pendente)
          </CardTitle>
          <CardDescription>Comissões geradas pela sua equipe, pendentes de pagamento. Total: <span className="font-bold text-foreground">{formatCurrency(totalMlmCommissionToReceive)}</span></CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingLeads ? (
            <div className="flex justify-center items-center h-32"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>
          ) : mlmCommissionsToReceive.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
                <Info size={48} className="mx-auto mb-4 opacity-50" />
                <p>Nenhuma comissão de rede encontrada.</p>
                <p className="text-sm">Quando sua equipe finalizar contratos, as comissões aparecerão aqui.</p>
            </div>
          ) : (
            <Table>
              <TableCaption>Comissões de sua rede de vendedores.</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente Final</TableHead>
                  <TableHead>Vendedor da Rede</TableHead>
                  <TableHead>Nível</TableHead>
                  <TableHead>Valor Base</TableHead>
                  <TableHead>Sua Comissão</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mlmCommissionsToReceive.map((item) => (
                  <TableRow key={item.leadId}>
                    <TableCell className="font-medium">{item.clientName}</TableCell>
                    <TableCell>{item.downlineSellerName}</TableCell>
                    <TableCell><Badge variant="secondary">Nível {item.downlineLevel}</Badge></TableCell>
                    <TableCell>{formatCurrency(item.valueAfterDiscount)}</TableCell>
                    <TableCell className="font-semibold text-green-500">{formatCurrency(item.commission)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>


      <Card className="bg-card/70 backdrop-blur-lg border shadow-xl">
        <CardHeader>
          <CardTitle className="text-xl text-primary flex items-center">
            <History className="w-6 h-6 mr-2" />
            Histórico de Saques
          </CardTitle>
          <CardDescription>Acompanhe suas solicitações de saque.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingHistory ? (
            <div className="flex justify-center items-center h-32">
              <Loader2 className="animate-spin rounded-full h-8 w-8 text-primary" />
              <p className="ml-3 text-muted-foreground">Carregando histórico...</p>
            </div>
          ) : withdrawalHistory.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
                <Info size={48} className="mx-auto mb-4 opacity-50" />
                <p>Nenhuma solicitação de saque encontrada.</p>
                <p className="text-sm">Quando você solicitar um saque, ele aparecerá aqui.</p>
            </div>
          ) : (
            <Table>
              <TableCaption>Seu histórico de solicitações de saque.</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[150px]">Data Solic.</TableHead>
                  <TableHead>Valor (R$)</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Chave PIX</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Processado em</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {withdrawalHistory.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell>{format(parseISO(String(request.requestedAt)), "dd/MM/yy HH:mm", { locale: ptBR })}</TableCell>
                    <TableCell className="font-medium">{formatCurrency(request.amount)}</TableCell>
                    <TableCell>{request.withdrawalType === 'personal' ? 'Pessoal' : 'Rede MLM'}</TableCell>
                    <TableCell className="truncate max-w-[150px]" title={request.pixKey}>{request.pixKeyType}: {request.pixKey}</TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(request.status)} className="capitalize">
                        {request.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {request.processedAt ? format(parseISO(String(request.processedAt)), "dd/MM/yy HH:mm", { locale: ptBR }) : 'N/A'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


export default function CarteiraPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col justify-center items-center h-screen bg-transparent text-primary">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
        <p className="text-lg font-medium">Carregando Carteira...</p>
      </div>
    }>
      <WalletPageContent />
    </Suspense>
  );
}