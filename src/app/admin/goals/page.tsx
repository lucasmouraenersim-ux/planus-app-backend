
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
import { Target, DollarSign, Zap, Edit, Check, Users, TrendingUp } from 'lucide-react';
import { format, startOfMonth, endOfMonth, isWithinInterval, parseISO, getDaysInMonth } from 'date-fns';
import type { LeadWithId } from '@/types/crm';

interface CompanyGoal {
  id: 'bc' | 'origo' | 'fit_energia';
  name: string;
  targetValue: number;
}

interface PlaceholderClient {
  name: string;
  consumption: number;
  discount: number;
  commission: number;
  recurrence: number;
  isPlaceholder: true;
}

interface RealClientData {
  name: string;
  consumption: number;
  discount: number;
  commission: number;
  recurrence: number;
  isPlaceholder: false;
}

type FitEnergiaRow = PlaceholderClient | RealClientData;

const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
const formatKwh = (value: number) => `${new Intl.NumberFormat('pt-BR').format(value)} kWh`;
const formatNumber = (value: number) => new Intl.NumberFormat('pt-BR').format(value);

export default function GoalsPage() {
  const { fetchAllCrmLeadsGlobally } = useAuth();
  const [allLeads, setAllLeads] = useState<LeadWithId[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [mainGoal, setMainGoal] = useState(170000);
  const [isEditingMainGoal, setIsEditingMainGoal] = useState(false);
  const [tempMainGoal, setTempMainGoal] = useState(mainGoal);

  const companyGoals: CompanyGoal[] = [
    { id: 'bc', name: 'Meta BC', targetValue: 80000 },
    { id: 'origo', name: 'Meta Origo', targetValue: 40000 },
    { id: 'fit_energia', name: 'Meta Fit Energia', targetValue: 50000 },
  ];

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
    const progress = {
      bc: 0,
      origo: 0,
      fit_energia: 0,
    };
    currentMonthLeads.forEach(lead => {
      const value = lead.valueAfterDiscount || 0;
      if (lead.empresa === 'BC') progress.bc += value;
      if (lead.empresa === 'Origo') progress.origo += value;
      if (lead.empresa === 'Fit Energia') progress.fit_energia += value;
    });
    return progress;
  }, [currentMonthLeads]);

  const totalProgress = companyProgress.bc + companyProgress.origo + companyProgress.fit_energia;

  const fitLeads = useMemo(() => currentMonthLeads.filter(l => l.empresa === 'Fit Energia'), [currentMonthLeads]);
  const fitKwhProgress = useMemo(() => fitLeads.reduce((sum, lead) => sum + (lead.kwh || 0), 0), [fitLeads]);
  const fitClientCount = useMemo(() => fitLeads.length, [fitLeads]);

  const pacingMetrics = useMemo(() => {
    const now = new Date();
    const daysInMonth = getDaysInMonth(now);
    const currentDay = now.getDate();
    const progressOfMonth = currentDay / daysInMonth;

    const fitTargetKwh = 50000;
    const fitTargetClients = 100;

    return {
      expectedKwh: fitTargetKwh * progressOfMonth,
      actualKwh: fitKwhProgress,
      expectedClients: fitTargetClients * progressOfMonth,
      actualClients: fitClientCount,
    };
  }, [fitKwhProgress, fitClientCount]);

  const fitEnergiaTableData = useMemo((): FitEnergiaRow[] => {
    const realClientRows: RealClientData[] = fitLeads.map(lead => ({
      name: lead.name,
      consumption: lead.kwh || 0,
      discount: lead.discountPercentage || 0,
      commission: (lead.valueAfterDiscount || 0) * 0.4, // Simplified, adjust if needed
      recurrence: 0, // Placeholder for recurrence logic
      isPlaceholder: false,
    }));

    const fitTargetKwh = 50000;
    const avgConsumption = 500;
    const requiredClients = fitTargetKwh / avgConsumption;
    const placeholderCount = Math.max(0, requiredClients - realClientRows.length);
    
    const placeholderRows: PlaceholderClient[] = Array.from({ length: placeholderCount }, (_, i) => {
      const clientIndex = realClientRows.length + i + 1;
      return {
        name: `Cliente ${String(clientIndex).padStart(2, '0')}/${format(new Date(), 'MM')}`,
        consumption: avgConsumption,
        discount: 15, // Target average discount
        commission: 0, // No commission for placeholders
        recurrence: 0,
        isPlaceholder: true,
      };
    });

    return [...realClientRows, ...placeholderRows];
  }, [fitLeads]);

  const fitEnergiaAvgDiscount = useMemo(() => {
    if (fitLeads.length === 0) return 0;
    const totalDiscount = fitLeads.reduce((sum, lead) => sum + (lead.discountPercentage || 0), 0);
    return totalDiscount / fitLeads.length;
  }, [fitLeads]);

  const handleSaveMainGoal = () => {
    setMainGoal(tempMainGoal);
    setIsEditingMainGoal(false);
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
                <Input
                  type="number"
                  value={tempMainGoal}
                  onChange={(e) => setTempMainGoal(Number(e.target.value))}
                  className="w-40 h-8"
                />
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
        {companyGoals.map(goal => (
          <Card key={goal.id} className="bg-card/70 backdrop-blur-lg border">
            <CardHeader>
              <CardTitle className="text-lg font-semibold">{goal.name}</CardTitle>
              <CardDescription>Meta: {formatCurrency(goal.targetValue)}</CardDescription>
            </CardHeader>
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
      
      {/* Indicadores Estratégicos */}
      <Card className="bg-card/70 backdrop-blur-lg border">
        <CardHeader>
          <CardTitle>Indicadores Estratégicos - Fit Energia</CardTitle>
          <CardDescription>Acompanhe o ritmo de fechamento para atingir a meta mensal.</CardDescription>
        </CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-6">
          <Card className="bg-background/50">
            <CardHeader>
              <CardTitle className="text-base font-semibold flex items-center text-primary"><Users className="mr-2 h-4 w-4" />Ritmo de Clientes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>Meta de Clientes (Previsto): {formatNumber(Math.round(pacingMetrics.expectedClients))}</span>
                  <span>Meta Total: 100</span>
                </div>
                <Progress value={(pacingMetrics.actualClients / 100) * 100} />
                <div className="text-right text-sm font-bold mt-1 text-primary">
                  {formatNumber(pacingMetrics.actualClients)}
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>Ritmo Atual vs. Esperado</span>
                  <span className={`${pacingMetrics.actualClients >= pacingMetrics.expectedClients ? 'text-green-500' : 'text-red-500'}`}>
                    {((pacingMetrics.actualClients / pacingMetrics.expectedClients) * 100 || 0).toFixed(1)}%
                  </span>
                </div>
                <Progress value={(pacingMetrics.actualClients / pacingMetrics.expectedClients) * 100 || 0} indicatorClassName={`${pacingMetrics.actualClients >= pacingMetrics.expectedClients ? 'bg-green-500' : 'bg-red-500'}`} />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-background/50">
            <CardHeader>
              <CardTitle className="text-base font-semibold flex items-center text-primary"><Zap className="mr-2 h-4 w-4" />Ritmo de KWh</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>Meta de KWh (Previsto): {formatKwh(Math.round(pacingMetrics.expectedKwh))}</span>
                  <span>Meta Total: 50.000 kWh</span>
                </div>
                <Progress value={(pacingMetrics.actualKwh / 50000) * 100} />
                <div className="text-right text-sm font-bold mt-1 text-primary">
                   {formatKwh(pacingMetrics.actualKwh)}
                </div>
              </div>
               <div>
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>Ritmo Atual vs. Esperado</span>
                   <span className={`${pacingMetrics.actualKwh >= pacingMetrics.expectedKwh ? 'text-green-500' : 'text-red-500'}`}>
                    {((pacingMetrics.actualKwh / pacingMetrics.expectedKwh) * 100 || 0).toFixed(1)}%
                  </span>
                </div>
                <Progress value={(pacingMetrics.actualKwh / pacingMetrics.expectedKwh) * 100 || 0} indicatorClassName={`${pacingMetrics.actualKwh >= pacingMetrics.expectedKwh ? 'bg-green-500' : 'bg-red-500'}`} />
              </div>
            </CardContent>
          </Card>
        </CardContent>
      </Card>


      <Card className="bg-card/70 backdrop-blur-lg border">
        <CardHeader>
          <CardTitle>KPIs de Atingimento - Fit Energia</CardTitle>
          <div className="flex items-center gap-4 text-sm">
            <p>Meta de Consumo: <span className="font-semibold text-primary">{formatKwh(50000)}</span></p>
            <p>Meta Desconto Médio: <span className="font-semibold text-primary">15%</span></p>
            <p>Desconto Médio Atual: <span className={`font-semibold ${fitEnergiaAvgDiscount > 15.5 ? 'text-red-500' : 'text-green-500'}`}>{fitEnergiaAvgDiscount.toFixed(2)}%</span></p>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Consumo (KWh)</TableHead>
                <TableHead>Deságio (%)</TableHead>
                <TableHead>Comissão Total</TableHead>
                <TableHead>Recorrência</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fitEnergiaTableData.map((row, index) => (
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
    </div>
  );
}

