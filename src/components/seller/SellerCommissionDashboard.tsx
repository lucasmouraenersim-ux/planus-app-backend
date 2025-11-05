
// src/components/seller/SellerCommissionDashboard.tsx
"use client";

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { format, parseISO, addMonths, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import type { AppUser } from '@/types/user';
import type { LeadWithId, StageId } from '@/types/crm';
import { STAGES_CONFIG } from '@/config/crm-stages';
import { useAuth } from '@/contexts/AuthContext';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DollarSign, Users, Zap, LineChart, Network, Briefcase, Loader2, Target as TargetIcon, CalendarIcon } from 'lucide-react';
import { Progress } from '../ui/progress';

interface SellerCommissionDashboardProps {
  loggedInUser: AppUser;
  leads: LeadWithId[];
  isLoading: boolean;
}

export default function SellerCommissionDashboard({ loggedInUser, leads, isLoading }: SellerCommissionDashboardProps) {
  const { allFirestoreUsers } = useAuth();
  const [selectedMonth, setSelectedMonth] = useState(new Date());

  const formatCurrency = (value: number | undefined) => value?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) || "R$ 0,00";

  const { performanceMetrics, costAssistance } = useMemo(() => {
    const getMonthKey = (date: Date) => format(date, 'yyyy-MM');
    const currentMonthKey = getMonthKey(selectedMonth); // Use selectedMonth

    let activeLeads = 0;
    let finalizedThisMonthCount = 0;
    let valueFinalizedThisMonth = 0;
    let personalGainsThisMonth = 0;
    let networkGainsThisMonth = 0;
    let personalFinalizedKwhAllTime = 0;

    const commissionRates: { [key: number]: number } = { 1: 0.05, 2: 0.03, 3: 0.02, 4: 0.01 };
    
    const downlineLevelMap = new Map<string, number>();
    const buildDownlineMap = (uplineId: string, level = 1) => {
      if (level > 4) return;
      allFirestoreUsers
        .filter(u => u.uplineUid === uplineId && u.mlmEnabled)
        .forEach(u => {
          downlineLevelMap.set(u.uid, level);
          buildDownlineMap(u.uid, level + 1);
        });
    };
    if (loggedInUser) buildDownlineMap(loggedInUser.uid);

    const loggedInSellerNameLower = (loggedInUser.displayName || '').trim().toLowerCase();

    leads.forEach(l => {
      if (!['assinado', 'finalizado', 'perdido', 'cancelado'].includes(l.stageId)) {
        activeLeads++;
      }
      
      const leadSellerNameLower = (l.sellerName || '').trim().toLowerCase();

      if (l.stageId === 'finalizado') {
        const completedDate = l.completedAt ? parseISO(l.completedAt) : null;
        
        if (leadSellerNameLower === loggedInSellerNameLower) {
            personalFinalizedKwhAllTime += (l.kwh || 0);
        }

        if (completedDate && getMonthKey(completedDate) === currentMonthKey) {
          finalizedThisMonthCount++;
          valueFinalizedThisMonth += (l.valueAfterDiscount || 0);
          
          if (leadSellerNameLower === loggedInSellerNameLower) {
            const userCommissionRate = loggedInUser.commissionRate || (l.value > 20000 ? 50 : 40);
            personalGainsThisMonth += (l.valueAfterDiscount || 0) * (userCommissionRate / 100);
          } else {
            const sellerLevel = downlineLevelMap.get(l.userId);
            if (sellerLevel && commissionRates[sellerLevel]) {
              networkGainsThisMonth += (l.valueAfterDiscount || 0) * commissionRates[sellerLevel];
            }
          }
        }
      }
    });

    const totalGoalKwh = 20000;
    const progressPercentage = Math.min((personalFinalizedKwhAllTime / totalGoalKwh) * 100, 100);
    const milestonesReached = Math.floor(personalFinalizedKwhAllTime / 5000);
    const unlockedAmount = milestonesReached * 500;
    
    const costAssistance = {
        totalGoalKwh,
        currentKwh: personalFinalizedKwhAllTime,
        progressPercentage,
        unlockedAmount,
        milestones: [
            { kwh: 5000, reward: 500, reached: personalFinalizedKwhAllTime >= 5000 },
            { kwh: 10000, reward: 1000, reached: personalFinalizedKwhAllTime >= 10000 },
            { kwh: 15000, reward: 1500, reached: personalFinalizedKwhAllTime >= 15000 },
            { kwh: 20000, reward: 2000, reached: personalFinalizedKwhAllTime >= 20000 },
        ]
    };

    return { 
      performanceMetrics: { activeLeads, finalizedThisMonth: finalizedThisMonthCount, valueFinalizedThisMonth, personalGainsThisMonth, networkGainsThisMonth },
      costAssistance
    };
  }, [leads, loggedInUser, allFirestoreUsers, selectedMonth]);
  
  const getStageBadgeStyle = (stageId: StageId) => {
    const stageConfig = STAGES_CONFIG.find(s => s.id === stageId);
    return stageConfig ? `${stageConfig.colorClass} text-white` : 'bg-gray-500 text-white';
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-[calc(100vh-150px)]">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center">
        <div className="flex items-center mb-4 md:mb-0">
          <Avatar className="h-12 w-12 mr-3 border-2 border-primary">
            <AvatarImage src={loggedInUser.photoURL || undefined} alt={loggedInUser.displayName || "User"} data-ai-hint="user avatar" />
            <AvatarFallback>{loggedInUser.displayName?.charAt(0).toUpperCase() || 'U'}</AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold text-foreground">
              Painel do Vendedor
            </h1>
            <p className="text-muted-foreground">{loggedInUser.displayName || loggedInUser.email}</p>
          </div>
        </div>
         <Link href="/carteira">
            <Button variant="outline" className="bg-accent hover:bg-accent/90 text-accent-foreground">
                <DollarSign className="mr-2 h-4 w-4" /> Ver Minha Carteira
            </Button>
        </Link>
      </header>

      {/* Month Selector */}
      <div className="flex justify-center items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => setSelectedMonth(subMonths(selectedMonth, 1))}>
          <CalendarIcon className="h-4 w-4" />
        </Button>
        <h2 className="text-2xl font-semibold text-center text-primary capitalize">
          {format(selectedMonth, "MMMM 'de' yyyy", { locale: ptBR })}
        </h2>
        <Button variant="outline" size="icon" onClick={() => setSelectedMonth(addMonths(selectedMonth, 1))}>
          <CalendarIcon className="h-4 w-4" />
        </Button>
      </div>

      {/* Resumo de Comissões e Saldos */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-card/70 backdrop-blur-lg border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium text-primary">Saldo Pessoal</CardTitle><DollarSign className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent><div className="text-2xl font-bold">{formatCurrency((loggedInUser.personalBalance || 0) + costAssistance.unlockedAmount)}</div></CardContent>
        </Card>
        <Card className="bg-card/70 backdrop-blur-lg border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium text-primary">Saldo de Rede (MLM)</CardTitle><Network className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent><div className="text-2xl font-bold">{formatCurrency(loggedInUser.mlmBalance)}</div></CardContent>
        </Card>
        <Card className="bg-card/70 backdrop-blur-lg border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium text-primary">Ganhos Pessoais (Mês)</CardTitle><LineChart className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent><div className="text-2xl font-bold">{formatCurrency(performanceMetrics.personalGainsThisMonth)}</div></CardContent>
        </Card>
         <Card className="bg-card/70 backdrop-blur-lg border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium text-primary">Ganhos Rede (Mês)</CardTitle><Users className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent><div className="text-2xl font-bold">{formatCurrency(performanceMetrics.networkGainsThisMonth)}</div></CardContent>
        </Card>
      </div>
      
      {/* Ajuda de Custo */}
      <Card className="bg-card/70 backdrop-blur-lg border">
        <CardHeader>
          <CardTitle className="text-primary flex items-center">
            <TargetIcon className="mr-2 h-5 w-5"/>
            Ajuda de Custo
          </CardTitle>
          <CardDescription>Atinga metas de kWh em vendas finalizadas para desbloquear bônus.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
             <div className="flex justify-between text-sm">
                <span className="font-medium text-muted-foreground">Progresso</span>
                <span className="font-bold text-primary">{costAssistance.currentKwh.toLocaleString('pt-BR')} / {costAssistance.totalGoalKwh.toLocaleString('pt-BR')} kWh</span>
            </div>
            <Progress value={costAssistance.progressPercentage} className="h-4" />
            <div className="relative h-4 -mt-4">
                {costAssistance.milestones.map((milestone, index) => (
                    <div 
                        key={index} 
                        className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
                        style={{ left: `${(milestone.kwh / costAssistance.totalGoalKwh) * 100}%`}}
                    >
                        <div className={`w-3 h-3 rounded-full ${milestone.reached ? 'bg-primary' : 'bg-muted'}`}></div>
                    </div>
                ))}
            </div>
             <div className="flex justify-between text-xs text-muted-foreground">
                {costAssistance.milestones.map((milestone, index) => (
                     <div key={index} className="text-center" style={{ width: '25%' }}>
                        <span>{milestone.kwh / 1000}k kWh</span>
                    </div>
                ))}
            </div>
            <div className="text-center pt-4">
                <p className="text-lg">Ajuda de custo desbloqueada:</p>
                <p className="text-3xl font-bold text-green-500">{formatCurrency(costAssistance.unlockedAmount)}</p>
                <p className="text-xs text-muted-foreground">(Valor adicionado ao seu Saldo Pessoal)</p>
            </div>
          </div>
        </CardContent>
      </Card>


      {/* Desempenho de Vendas e Leads */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-card/70 backdrop-blur-lg border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium text-primary">Leads Ativos (Equipe)</CardTitle><Briefcase className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent><div className="text-2xl font-bold">{performanceMetrics.activeLeads}</div></CardContent>
        </Card>
        <Card className="bg-card/70 backdrop-blur-lg border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium text-primary">Finalizados (Equipe/Mês)</CardTitle><Zap className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent><div className="text-2xl font-bold">{performanceMetrics.finalizedThisMonth}</div></CardContent>
        </Card>
        <Card className="bg-card/70 backdrop-blur-lg border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium text-primary">Valor Finalizado (Equipe/Mês)</CardTitle><DollarSign className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent><div className="text-2xl font-bold">{formatCurrency(performanceMetrics.valueFinalizedThisMonth)}</div></CardContent>
        </Card>
      </div>
      
      {/* Meus Leads */}
      <Card className="bg-card/70 backdrop-blur-lg border">
        <CardHeader>
            <CardTitle className="text-primary">Leads da Equipe</CardTitle>
            <CardDescription>Acompanhe o progresso dos seus leads e da sua equipe.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Nome do Lead</TableHead><TableHead>Vendedor</TableHead><TableHead>Valor (c/ desc.)</TableHead><TableHead>KWh</TableHead><TableHead>Estágio</TableHead><TableHead>Último Contato</TableHead></TableRow></TableHeader>
            <TableBody>
              {leads.length > 0 ? (
                  leads.slice(0, 5).map(lead => (
                    <TableRow key={lead.id}>
                      <TableCell className="font-medium">{lead.name}</TableCell>
                      <TableCell>{lead.sellerName === loggedInUser.displayName ? "Você" : lead.sellerName}</TableCell>
                      <TableCell>{formatCurrency(lead.valueAfterDiscount)}</TableCell>
                      <TableCell>{lead.kwh} kWh</TableCell>
                      <TableCell><span className={`px-2 py-0.5 text-xs rounded-full ${getStageBadgeStyle(lead.stageId)}`}>{STAGES_CONFIG.find(s=>s.id === lead.stageId)?.title || lead.stageId}</span></TableCell>
                      <TableCell>{lead.lastContact ? format(parseISO(lead.lastContact), "dd/MM/yy HH:mm", {locale: ptBR}) : 'N/A'}</TableCell>
                    </TableRow>
                  ))
              ) : (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-10">Nenhum lead encontrado para você ou sua equipe.</TableCell></TableRow>
              )}
            </TableBody>
             <TableCaption>
                <Link href="/crm">
                    <Button variant="link" className="text-primary">Ver todos os leads no CRM</Button>
                </Link>
            </TableCaption>
          </Table>
        </CardContent>
      </Card>

      {/* Placeholder Seção Rede MLM */}
      <Card className="bg-card/70 backdrop-blur-lg border">
        <CardHeader><CardTitle className="text-primary">Minha Rede MLM</CardTitle><CardDescription>Visualize sua downline e comissões de rede.</CardDescription></CardHeader>
        <CardContent className="h-32 flex items-center justify-center">
            {/* TODO: Add a table or visual representation of the downline */}
            <p className="text-muted-foreground">Funcionalidade em desenvolvimento.</p>
        </CardContent>
      </Card>
    </div>
  );
}
