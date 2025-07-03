// src/components/seller/SellerCommissionDashboard.tsx
"use client";

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { format, parseISO, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import type { AppUser, FirestoreUser } from '@/types/user';
import type { LeadWithId, StageId } from '@/types/crm';
import { STAGES_CONFIG } from '@/config/crm-stages';
import { useAuth } from '@/contexts/AuthContext';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DollarSign, Users, Zap, LineChart, Network, Briefcase, Badge, Loader2 } from 'lucide-react'; 

interface SellerCommissionDashboardProps {
  loggedInUser: AppUser;
}

export default function SellerCommissionDashboard({ loggedInUser }: SellerCommissionDashboardProps) {
  const { fetchAllCrmLeadsGlobally, allFirestoreUsers } = useAuth();
  const [leads, setLeads] = useState<LeadWithId[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadLeads = async () => {
      if (loggedInUser && allFirestoreUsers.length > 0) {
        setIsLoading(true);
        try {
          const getFullDownlineUids = (startUplineId: string): string[] => {
            const allDownlineUids = new Set<string>();
            const queue: string[] = [startUplineId];
            const visited = new Set<string>();
            while (queue.length > 0) {
              const currentUplineId = queue.shift()!;
              if (visited.has(currentUplineId)) continue;
              visited.add(currentUplineId);
              const directDownline = allFirestoreUsers
                .filter(u => u.uplineUid === currentUplineId && u.mlmEnabled)
                .map(u => u.uid);
              for (const uid of directDownline) {
                if (!allDownlineUids.has(uid)) {
                  allDownlineUids.add(uid);
                  queue.push(uid);
                }
              }
            }
            return Array.from(allDownlineUids);
          };

          const downlineUids = getFullDownlineUids(loggedInUser.uid);
          const teamUids = [loggedInUser.uid, ...downlineUids];
          
          const allLeads = await fetchAllCrmLeadsGlobally();
          const teamLeads = allLeads.filter(lead => lead.userId && teamUids.includes(lead.userId));
          setLeads(teamLeads);
        } catch (error) {
          console.error("Failed to load seller/team leads:", error);
          setLeads([]);
        } finally {
          setIsLoading(false);
        }
      } else if (!loggedInUser) {
        setIsLoading(false);
      }
    };

    if (allFirestoreUsers.length > 0) {
       loadLeads();
    } else {
        // Wait for allFirestoreUsers to be populated by the context
        setIsLoading(true);
    }
  }, [loggedInUser, fetchAllCrmLeadsGlobally, allFirestoreUsers]);

  const formatCurrency = (value: number | undefined) => value?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) || "R$ 0,00";

  const performanceMetrics = useMemo(() => {
      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();

      const getMonthKey = (date: Date) => format(date, 'yyyy-MM');
      const currentMonthKey = getMonthKey(now);

      let activeLeads = 0;
      let finalizedThisMonthCount = 0;
      let valueFinalizedThisMonth = 0;
      let personalGainsThisMonth = 0;
      let networkGainsThisMonth = 0;

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

      leads.forEach(l => {
        if (!['assinado', 'finalizado', 'perdido', 'cancelado'].includes(l.stageId)) {
          activeLeads++;
        }

        if (l.stageId === 'finalizado' && l.completedAt) {
          const completedDate = parseISO(l.completedAt);
          if (getMonthKey(completedDate) === currentMonthKey) {
            finalizedThisMonthCount++;
            valueFinalizedThisMonth += (l.valueAfterDiscount || 0); // Use value with discount for finalized value
            
            // Calculate gains
            if (l.userId === loggedInUser.uid) {
              const userCommissionRate = loggedInUser.commissionRate || 40; // Defaulting to 40 for simplicity
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

      return { activeLeads, finalizedThisMonth: finalizedThisMonthCount, valueFinalizedThisMonth, personalGainsThisMonth, networkGainsThisMonth };
  }, [leads, loggedInUser, allFirestoreUsers]);
  
  const getStageBadgeStyle = (stageId: StageId) => {
    const stageConfig = STAGES_CONFIG.find(s => s.id === stageId);
    return stageConfig ? `${stageConfig.colorClass} text-white` : 'bg-gray-500 text-white';
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-96">
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

      {/* Resumo de Comissões e Saldos */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-card/70 backdrop-blur-lg border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium text-primary">Saldo Pessoal</CardTitle><DollarSign className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent><div className="text-2xl font-bold">{formatCurrency(loggedInUser.personalBalance)}</div></CardContent>
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
                      <TableCell>{lead.userId === loggedInUser.uid ? "Você" : lead.sellerName}</TableCell>
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
