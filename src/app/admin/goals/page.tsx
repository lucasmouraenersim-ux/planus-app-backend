
// src/app/admin/goals/page.tsx
"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Target, DollarSign, Zap, Edit, Check, Users, TrendingUp, Calendar as CalendarIcon, Rocket } from 'lucide-react';
import { format, startOfMonth, endOfMonth, isWithinInterval, parseISO, getDaysInMonth, addMonths, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { LeadWithId, StageId } from '@/types/crm';
import { updateCrmLeadDetails } from '@/lib/firebase/firestore';
import { useToast } from '@/hooks/use-toast';

const KWH_TO_REAIS_FACTOR = 1.093113;

interface CompanyGoal {
  id: 'fit_energia' | 'bc' | 'origo' | 'bowe';
  name: string;
  targetValue: number; // in Reais (R$)
  kwhTarget: number;
  clientTarget: number;
  avgKwhPerClient: number;
}

interface ClientDataRow {
  name: string;
  consumption: number;
  discount: number;
  commission: number;
  recurrence: number;
  isPlaceholder: boolean;
  leadId?: string;
}

const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
const formatKwh = (value: number) => `${new Intl.NumberFormat('pt-BR').format(Math.round(value))} kWh`;
const formatNumber = (value: number) => new Intl.NumberFormat('pt-BR').format(Math.round(value));

const initialCompanyGoalsData: Omit<CompanyGoal, 'targetValue' | 'kwhTarget'>[] = [
  { id: 'fit_energia', name: 'Fit Energia', clientTarget: 100, avgKwhPerClient: 500 },
  { id: 'bc', name: 'BC', clientTarget: 105, avgKwhPerClient: 700 },
  { id: 'origo', name: 'Origo', clientTarget: 73, avgKwhPerClient: 500 },
  { id: 'bowe', name: 'Bowe', clientTarget: 90, avgKwhPerClient: 600 },
];


export default function GoalsPage() {
  const { fetchAllCrmLeadsGlobally } = useAuth();
  const { toast } = useToast();
  const [allLeads, setAllLeads] = useState<LeadWithId[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [companyGoals, setCompanyGoals] = useState<CompanyGoal[]>(initialCompanyGoalsData.map(g => ({
      ...g,
      targetValue: 50000, // Initial default value
      kwhTarget: (50000 / KWH_TO_REAIS_FACTOR),
  })));

  const [tempGoals, setTempGoals] = useState<Record<CompanyGoal['id'], number>>({
      fit_energia: 50000,
      bc: 80000,
      origo: 40000,
      bowe: 60000,
  });
  
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);

  useEffect(() => {
     // Set initial tempGoals from the main companyGoals state
     const initialTemps = companyGoals.reduce((acc, goal) => {
        acc[goal.id] = goal.targetValue;
        return acc;
     }, {} as Record<CompanyGoal['id'], number>);
     setTempGoals(initialTemps);
  }, [companyGoals]);
  
  const mainGoal = useMemo(() => companyGoals.reduce((sum, goal) => sum + goal.targetValue, 0), [companyGoals]);
  
  const [selectedMonth, setSelectedMonth] = useState(new Date());

  const getCompanyGoalById = useCallback((id: CompanyGoal['id']) => companyGoals.find(g => g.id === id)!, [companyGoals]);

  useEffect(() => {
    const loadLeads = async () => {
      setIsLoading(true);
      const leads = await fetchAllCrmLeadsGlobally();
      setAllLeads(leads);
      setIsLoading(false);
    };
    loadLeads();
  }, [fetchAllCrmLeadsGlobally]);

  const monthlyLeads = useMemo(() => {
    const start = startOfMonth(selectedMonth);
    const end = endOfMonth(selectedMonth);
    const stagesToInclude: StageId[] = ['contrato', 'conformidade', 'assinado', 'finalizado'];
    return allLeads.filter(lead => {
      const relevantDateStr = lead.completedAt || lead.signedAt || lead.lastContact;
      const relevantDate = parseISO(relevantDateStr);
      return stagesToInclude.includes(lead.stageId) && isWithinInterval(relevantDate, { start, end });
    });
  }, [allLeads, selectedMonth]);

  const assignedLeads = useMemo(() => {
    const assigned: { [key in CompanyGoal['id']]?: LeadWithId[] } = {};
    for (const goal of companyGoals) {
        assigned[goal.id] = monthlyLeads.filter(lead => lead.assignedToCompanyGoal === goal.id);
    }
    return assigned;
  }, [monthlyLeads, companyGoals]);

  const unassignedCommissionLeads = useMemo(() => {
    return monthlyLeads.filter(lead => !lead.assignedToCompanyGoal);
  }, [monthlyLeads]);
  
  const companyProgress = useMemo(() => {
    const progress: { [key in CompanyGoal['id']]: number } = { bc: 0, origo: 0, fit_energia: 0, bowe: 0 };
    for (const companyId in assignedLeads) {
        const leadsForCompany = assignedLeads[companyId as CompanyGoal['id']];
        if (leadsForCompany) {
            progress[companyId as CompanyGoal['id']] = leadsForCompany.reduce((sum, lead) => sum + (lead.valueAfterDiscount || 0), 0);
        }
    }
    return progress;
  }, [assignedLeads]);

  const totalProgress = Object.values(companyProgress).reduce((sum, progress) => sum + progress, 0);

  const handleSaveGoals = () => {
      setCompanyGoals(prevGoals => prevGoals.map(goal => ({
          ...goal,
          targetValue: tempGoals[goal.id],
          kwhTarget: tempGoals[goal.id] / KWH_TO_REAIS_FACTOR,
      })));
      setIsGoalModalOpen(false);
      toast({ title: "Metas Atualizadas", description: "As metas das empresas e a meta global foram salvas." });
  };
  
  const PacingMetricsCard = ({ companyId }: { companyId: CompanyGoal['id'] }) => {
    const company = getCompanyGoalById(companyId);
    const assignedLeadsForCompany = assignedLeads[companyId] || [];
    
    const kwhProgress = useMemo(() => assignedLeadsForCompany.reduce((sum, lead) => sum + (lead.kwh || 0), 0), [assignedLeadsForCompany]);
    const clientCount = useMemo(() => assignedLeadsForCompany.length, [assignedLeadsForCompany]);

    const pacingMetrics = useMemo(() => {
      const now = new Date();
      const isCurrentMonth = selectedMonth.getMonth() === now.getMonth() && selectedMonth.getFullYear() === now.getFullYear();
      const daysInMonth = getDaysInMonth(selectedMonth);
      const currentDay = isCurrentMonth ? now.getDate() : daysInMonth; 
      const progressOfMonth = currentDay / daysInMonth;

      return {
        expectedKwh: company.kwhTarget * progressOfMonth,
        actualKwh: kwhProgress,
        expectedClients: company.clientTarget * progressOfMonth,
        actualClients: clientCount,
      };
    }, [kwhProgress, clientCount, company, selectedMonth]);

    return (
       <Card className="bg-card/70 backdrop-blur-lg border">
        <CardHeader>
          <CardTitle>Indicadores Estratégicos - {company.name}</CardTitle>
          <CardDescription>Acompanhe o ritmo de fechamento para atingir a meta mensal.</CardDescription>
        </CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-6">
          <Card className="bg-background/50">
            <CardHeader><CardTitle className="text-base font-semibold flex items-center text-primary"><Users className="mr-2 h-4 w-4" />Ritmo de Clientes</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div>
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>Previsto: {formatNumber(pacingMetrics.expectedClients)}</span>
                  <span>Meta: {formatNumber(company.clientTarget)}</span>
                </div>
                <Progress value={(pacingMetrics.actualClients / company.clientTarget) * 100} />
                <div className="text-right text-sm font-bold mt-1 text-primary">{formatNumber(pacingMetrics.actualClients)}</div>
              </div>
              <div>
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>Ritmo Atual vs. Esperado</span>
                  <span className={`${pacingMetrics.actualClients >= pacingMetrics.expectedClients ? 'text-green-500' : 'text-red-500'}`}>{((pacingMetrics.actualClients / pacingMetrics.expectedClients) * 100 || 0).toFixed(1)}%</span>
                </div>
                <Progress value={(pacingMetrics.actualClients / pacingMetrics.expectedClients) * 100 || 0} indicatorClassName={`${pacingMetrics.actualClients >= pacingMetrics.expectedClients ? 'bg-green-500' : 'bg-red-500'}`} />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-background/50">
            <CardHeader><CardTitle className="text-base font-semibold flex items-center text-primary"><Zap className="mr-2 h-4 w-4" />Ritmo de KWh</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div>
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>Previsto: {formatKwh(pacingMetrics.expectedKwh)}</span>
                  <span>Meta: {formatKwh(company.kwhTarget)}</span>
                </div>
                <Progress value={(pacingMetrics.actualKwh / company.kwhTarget) * 100} />
                <div className="text-right text-sm font-bold mt-1 text-primary">{formatKwh(pacingMetrics.actualKwh)}</div>
              </div>
              <div>
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>Ritmo Atual vs. Esperado</span>
                  <span className={`${pacingMetrics.actualKwh >= pacingMetrics.expectedKwh ? 'text-green-500' : 'text-red-500'}`}>{((pacingMetrics.actualKwh / pacingMetrics.expectedKwh) * 100 || 0).toFixed(1)}%</span>
                </div>
                <Progress value={(pacingMetrics.actualKwh / pacingMetrics.expectedKwh) * 100 || 0} indicatorClassName={`${pacingMetrics.actualKwh >= pacingMetrics.expectedKwh ? 'bg-green-500' : 'bg-red-500'}`} />
              </div>
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    );
  };
  
  const KpiTable = ({ companyId }: { companyId: CompanyGoal['id'] }) => {
    const company = getCompanyGoalById(companyId);

    const handleAssignmentChange = async (newLeadId: string, currentLeadId?: string) => {
        try {
            if (currentLeadId) {
                await updateCrmLeadDetails(currentLeadId, { assignedToCompanyGoal: undefined });
            }
            if (newLeadId !== 'placeholder') {
                await updateCrmLeadDetails(newLeadId, { assignedToCompanyGoal: companyId });
            }
            toast({ title: "Sucesso", description: "Atribuição salva com sucesso!" });
            const leads = await fetchAllCrmLeadsGlobally();
            setAllLeads(leads);
        } catch (error) {
            console.error("Failed to update lead assignment:", error);
            toast({ title: "Erro", description: "Não foi possível salvar a atribuição.", variant: "destructive" });
        }
    };

    const tableData = useMemo((): ClientDataRow[] => {
      let rows: ClientDataRow[] = [];
      const companyAssignedLeads = assignedLeads[company.id] || [];

      companyAssignedLeads.forEach(assignedLead => {
          const proposta = assignedLead.valueAfterDiscount || 0;
          const desagil = assignedLead.discountPercentage || 0;
          let commission = 0;
          let recurrence = 0;
          
          if (company.id === 'fit_energia') {
              commission = proposta;
              if (desagil < 25) {
                  recurrence = proposta * ((25 - desagil) / 100);
              }
          } else if (company.id === 'bc') {
              commission = proposta * 1.6;
          } else if (company.id === 'origo') {
              commission = proposta * 1.5;
          } else if (company.id === 'bowe') {
              commission = proposta * 0.6;
          }

          rows.push({
            leadId: assignedLead.id,
            name: assignedLead.name,
            consumption: assignedLead.kwh || 0,
            discount: desagil,
            commission: commission,
            recurrence: recurrence,
            isPlaceholder: false,
          });
      });

      const placeholderCount = company.clientTarget - rows.length;
      for (let i = 0; i < placeholderCount; i++) {
          rows.push({
            name: `Cliente ${String(i + 1).padStart(2, '0')}/${format(selectedMonth, 'MM')}`,
            consumption: company.avgKwhPerClient,
            discount: 15,
            commission: 0,
            recurrence: 0,
            isPlaceholder: true,
          });
      }
      
      return rows;
    }, [company, assignedLeads, selectedMonth]);

    const avgDiscount = useMemo(() => {
      const realLeadsInTable = tableData.filter(row => !row.isPlaceholder);
      if (realLeadsInTable.length === 0) return 0;
      const totalDiscount = realLeadsInTable.reduce((sum, row) => sum + row.discount, 0);
      return totalDiscount / realLeadsInTable.length;
    }, [tableData]);

    return (
      <Card className="bg-card/70 backdrop-blur-lg border">
        <CardHeader>
          <CardTitle>KPIs de Atingimento - {company.name}</CardTitle>
          <div className="flex items-center gap-4 text-sm">
            <p>Meta de Consumo: <span className="font-semibold text-primary">{formatKwh(company.kwhTarget)}</span></p>
            <p>Meta Desconto Médio: <span className="font-semibold text-primary">15%</span></p>
            <p>Desconto Médio Atual: <span className={`font-semibold ${avgDiscount > 15.5 ? 'text-red-500' : 'text-green-500'}`}>{avgDiscount.toFixed(2)}%</span></p>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Cliente</TableHead><TableHead>Consumo (KWh)</TableHead><TableHead>Deságio (%)</TableHead><TableHead>Comissão Total</TableHead><TableHead>Recorrência</TableHead></TableRow></TableHeader>
            <TableBody>
              {tableData.map((row, index) => (
                <TableRow key={row.leadId || `placeholder-${index}`} className={row.isPlaceholder ? 'opacity-60' : 'font-semibold'}>
                  <TableCell>
                     <Select onValueChange={(value) => handleAssignmentChange(value, row.leadId)} value={row.leadId || 'placeholder'}>
                        <SelectTrigger className="w-[200px] h-8 text-xs">
                            <SelectValue placeholder={row.name} />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="placeholder">-- Vazio --</SelectItem>
                             {row.leadId && !row.isPlaceholder && (
                                <SelectItem key={row.leadId} value={row.leadId}>{row.name}</SelectItem>
                            )}
                            {unassignedCommissionLeads.map(lead => (
                                <SelectItem key={lead.id} value={lead.id}>{lead.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>{formatKwh(row.consumption)}</TableCell>
                  <TableCell>{row.discount.toFixed(2)}%</TableCell>
                  <TableCell>{formatCurrency(row.commission)}</TableCell>
                  <TableCell>{formatCurrency(row.recurrence)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="container mx-auto p-4 md:p-8 space-y-6">
      <header className="text-center">
        <Target className="w-12 h-12 text-primary mx-auto mb-4" />
        <h1 className="text-4xl font-bold text-primary">Painel de Metas</h1>
        <p className="text-muted-foreground mt-2">Acompanhe o progresso mensal da equipe e os KPIs.</p>
      </header>
      
       <div className="flex justify-center items-center gap-4">
            <Button variant="outline" size="icon" onClick={() => setSelectedMonth(subMonths(selectedMonth, 1))}>
                <CalendarIcon className="h-4 w-4" />
            </Button>
            <h2 className="text-2xl font-semibold text-center text-primary">
                {format(selectedMonth, "MMMM 'de' yyyy", { locale: ptBR })}
            </h2>
            <Button variant="outline" size="icon" onClick={() => setSelectedMonth(addMonths(selectedMonth, 1))}>
                <CalendarIcon className="h-4 w-4" />
            </Button>
        </div>
      
      <Card className="bg-primary/10 border-primary shadow-lg">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="text-2xl text-primary">Meta Mensal Global</CardTitle>
            <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-primary">{formatCurrency(mainGoal)}</span>
                <Dialog open={isGoalModalOpen} onOpenChange={setIsGoalModalOpen}>
                    <DialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8"><Edit className="h-4 w-4" /></Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Editar Metas por Empresa</DialogTitle>
                            <DialogDescription>A meta global será a soma das metas individuais.</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            {companyGoals.map(goal => (
                                <div key={goal.id} className="grid grid-cols-2 items-center gap-4">
                                    <Label htmlFor={`goal-${goal.id}`}>{goal.name}</Label>
                                    <Input 
                                        id={`goal-${goal.id}`} 
                                        type="number" 
                                        value={tempGoals[goal.id]} 
                                        onChange={(e) => setTempGoals(prev => ({...prev, [goal.id]: Number(e.target.value)}))}
                                        className="text-right"
                                    />
                                </div>
                            ))}
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsGoalModalOpen(false)}>Cancelar</Button>
                            <Button onClick={handleSaveGoals}><Check className="mr-2 h-4 w-4"/>Salvar Metas</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
              </div>
          </div>
          <CardDescription>Progresso total em relação à meta principal do mês.</CardDescription>
        </CardHeader>
        <CardContent>
          <Progress value={(totalProgress / mainGoal) * 100} className="h-4" />
          <div className="flex justify-between mt-2 text-sm font-medium">
            <span className="text-primary">{formatCurrency(totalProgress)}</span>
            <span className="text-muted-foreground">{((totalProgress / mainGoal) * 100 || 0).toFixed(1)}%</span>
          </div>
        </CardContent>
        <CardFooter>
            <Button asChild>
                <Link href="/crm">
                    <Rocket className="mr-2 h-4 w-4" />
                    Atribuir Empresas no CRM
                </Link>
            </Button>
        </CardFooter>
      </Card>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
        {companyGoals.map(goal => (
          <Card key={goal.id} className="bg-card/70 backdrop-blur-lg border">
            <CardHeader><CardTitle className="text-lg font-semibold">{goal.name}</CardTitle><CardDescription>Meta: {formatCurrency(goal.targetValue)}</CardDescription></CardHeader>
            <CardContent>
              <Progress value={(companyProgress[goal.id] / goal.targetValue) * 100 || 0} />
              <div className="flex justify-between mt-1 text-xs">
                <span>{formatCurrency(companyProgress[goal.id])}</span>
                <span>{((companyProgress[goal.id] / goal.targetValue) * 100 || 0).toFixed(1)}%</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      
      <Tabs defaultValue="fit_energia" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          {companyGoals.map(company => (
            <TabsTrigger key={company.id} value={company.id}>{company.name}</TabsTrigger>
          ))}
        </TabsList>
        {companyGoals.map(company => (
          <TabsContent key={company.id} value={company.id} className="mt-4 space-y-6">
            <PacingMetricsCard companyId={company.id} />
            <KpiTable companyId={company.id} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
