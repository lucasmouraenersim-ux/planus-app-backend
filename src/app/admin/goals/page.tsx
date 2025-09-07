
// src/app/admin/goals/page.tsx
"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Target, DollarSign, Zap, Edit, Check, Users, TrendingUp } from 'lucide-react';
import { format, startOfMonth, endOfMonth, isWithinInterval, parseISO, getDaysInMonth } from 'date-fns';
import type { LeadWithId } from '@/types/crm';

const KWH_TO_REAIS_FACTOR = 1.093113;

interface CompanyGoal {
  id: 'bc' | 'origo' | 'fit_energia';
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
}

const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
const formatKwh = (value: number) => `${new Intl.NumberFormat('pt-BR').format(Math.round(value))} kWh`;
const formatNumber = (value: number) => new Intl.NumberFormat('pt-BR').format(Math.round(value));

const companyGoalsData: CompanyGoal[] = [
  { id: 'fit_energia', name: 'Fit Energia', targetValue: 50000, kwhTarget: 50000 / KWH_TO_REAIS_FACTOR, clientTarget: 100, avgKwhPerClient: 500 },
  { id: 'bc', name: 'BC', targetValue: 80000, kwhTarget: 80000 / KWH_TO_REAIS_FACTOR, clientTarget: 105, avgKwhPerClient: 700 },
  { id: 'origo', name: 'Origo', targetValue: 40000, kwhTarget: 40000 / KWH_TO_REAIS_FACTOR, clientTarget: 73, avgKwhPerClient: 500 },
];

const getCompanyGoalById = (id: CompanyGoal['id']) => companyGoalsData.find(g => g.id === id)!;


export default function GoalsPage() {
  const { fetchAllCrmLeadsGlobally } = useAuth();
  const [allLeads, setAllLeads] = useState<LeadWithId[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [mainGoal, setMainGoal] = useState(170000);
  const [isEditingMainGoal, setIsEditingMainGoal] = useState(false);
  const [tempMainGoal, setTempMainGoal] = useState(mainGoal);

  useEffect(() => {
    const loadLeads = async () => {
      setIsLoading(true);
      const leads = await fetchAllCrmLeadsGlobally();
      setAllLeads(leads);
      setIsLoading(false);
    };
    loadLeads();
  }, [fetchAllCrmLeadsGlobally]);

  const currentMonthLeads = useMemo(() => {
    const now = new Date();
    const start = startOfMonth(now);
    const end = endOfMonth(now);
    return allLeads.filter(lead => 
      lead.stageId === 'finalizado' && 
      lead.completedAt && 
      isWithinInterval(parseISO(lead.completedAt), { start, end })
    );
  }, [allLeads]);
  
  const companyProgress = useMemo(() => {
    const progress = { bc: 0, origo: 0, fit_energia: 0 };
    currentMonthLeads.forEach(lead => {
      const value = lead.valueAfterDiscount || 0;
      if (lead.empresa === 'BC') progress.bc += value;
      else if (lead.empresa === 'Origo') progress.origo += value;
      else if (lead.empresa === 'Fit Energia') progress.fit_energia += value;
    });
    return progress;
  }, [currentMonthLeads]);

  const totalProgress = companyProgress.bc + companyProgress.origo + companyProgress.fit_energia;

  const handleSaveMainGoal = () => {
    setMainGoal(tempMainGoal);
    setIsEditingMainGoal(false);
  };
  
  const PacingMetricsCard = ({ companyId }: { companyId: CompanyGoal['id'] }) => {
    const company = getCompanyGoalById(companyId);
    const companyLeads = useMemo(() => currentMonthLeads.filter(l => l.empresa === company.name), [currentMonthLeads, company.name]);
    const kwhProgress = useMemo(() => companyLeads.reduce((sum, lead) => sum + (lead.kwh || 0), 0), [companyLeads]);
    const clientCount = useMemo(() => companyLeads.length, [companyLeads]);

    const pacingMetrics = useMemo(() => {
      const now = new Date();
      const daysInMonth = getDaysInMonth(now);
      const currentDay = now.getDate();
      const progressOfMonth = currentDay / daysInMonth;

      return {
        expectedKwh: company.kwhTarget * progressOfMonth,
        actualKwh: kwhProgress,
        expectedClients: company.clientTarget * progressOfMonth,
        actualClients: clientCount,
      };
    }, [kwhProgress, clientCount, company]);

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
    const companyLeads = useMemo(() => currentMonthLeads.filter(l => l.empresa === company.name), [currentMonthLeads, company.name]);
    
    const tableData = useMemo((): ClientDataRow[] => {
      const realClientRows: ClientDataRow[] = companyLeads.map(lead => ({
        name: lead.name,
        consumption: lead.kwh || 0,
        discount: lead.discountPercentage || 0,
        commission: (lead.valueAfterDiscount || 0) * 0.4, // Simplified, adjust if needed
        recurrence: 0,
        isPlaceholder: false,
      }));

      const requiredClients = company.clientTarget;
      const placeholderCount = Math.max(0, requiredClients - realClientRows.length);
      
      const placeholderRows: ClientDataRow[] = Array.from({ length: placeholderCount }, (_, i) => {
        const clientIndex = realClientRows.length + i + 1;
        return {
          name: `Cliente ${String(clientIndex).padStart(2, '0')}/${format(new Date(), 'MM')}`,
          consumption: company.avgKwhPerClient,
          discount: 15,
          commission: 0,
          recurrence: 0,
          isPlaceholder: true,
        };
      });

      return [...realClientRows, ...placeholderRows];
    }, [companyLeads, company]);

    const avgDiscount = useMemo(() => {
      if (companyLeads.length === 0) return 0;
      const totalDiscount = companyLeads.reduce((sum, lead) => sum + (lead.discountPercentage || 0), 0);
      return totalDiscount / companyLeads.length;
    }, [companyLeads]);

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
                <TableRow key={index} className={row.isPlaceholder ? 'opacity-50' : 'font-semibold'}>
                  <TableCell>{row.name}</TableCell>
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
      
      <Card className="bg-primary/10 border-primary shadow-lg">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="text-2xl text-primary">Meta Mensal Global</CardTitle>
            {isEditingMainGoal ? (
              <div className="flex items-center gap-2">
                <Input type="number" value={tempMainGoal} onChange={(e) => setTempMainGoal(Number(e.target.value))} className="w-40 h-8" />
                <Button size="sm" onClick={handleSaveMainGoal}><Check className="h-4 w-4" /></Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-primary">{formatCurrency(mainGoal)}</span>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setTempMainGoal(mainGoal); setIsEditingMainGoal(true); }}><Edit className="h-4 w-4" /></Button>
              </div>
            )}
          </div>
          <CardDescription>Progresso total em relação à meta principal do mês.</CardDescription>
        </CardHeader>
        <CardContent>
          <Progress value={(totalProgress / mainGoal) * 100} className="h-4" />
          <div className="flex justify-between mt-2 text-sm font-medium">
            <span className="text-primary">{formatCurrency(totalProgress)}</span>
            <span className="text-muted-foreground">{((totalProgress / mainGoal) * 100).toFixed(1)}%</span>
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-3 gap-6">
        {companyGoalsData.map(goal => (
          <Card key={goal.id} className="bg-card/70 backdrop-blur-lg border">
            <CardHeader><CardTitle className="text-lg font-semibold">{goal.name}</CardTitle><CardDescription>Meta: {formatCurrency(goal.targetValue)}</CardDescription></CardHeader>
            <CardContent>
              <Progress value={(companyProgress[goal.id] / goal.targetValue) * 100} />
              <div className="flex justify-between mt-1 text-xs">
                <span>{formatCurrency(companyProgress[goal.id])}</span>
                <span>{((companyProgress[goal.id] / goal.targetValue) * 100).toFixed(1)}%</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      
      <Tabs defaultValue="fit_energia" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          {companyGoalsData.map(company => (
            <TabsTrigger key={company.id} value={company.id}>{company.name}</TabsTrigger>
          ))}
        </TabsList>
        {companyGoalsData.map(company => (
          <TabsContent key={company.id} value={company.id} className="mt-4 space-y-6">
            <PacingMetricsCard companyId={company.id} />
            <KpiTable companyId={company.id} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
