// src/components/seller/SellerCommissionDashboard.tsx
"use client";

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import type { AppUser } from '@/types/user';
import type { LeadWithId, StageId } from '@/types/crm';
import { STAGES_CONFIG } from '@/config/crm-stages';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DollarSign, Users, Zap, LineChart, Network, Briefcase, Badge } from 'lucide-react'; // Added Briefcase & Badge

// Placeholder for actual Firebase functions
// import { fetchCrmLeads } from '@/lib/firebase/firestore';

const MOCK_SELLER_LEADS: LeadWithId[] = [
  { id: 'slead1', name: 'Loja de Roupas Elegance', company: 'Elegance Modas LTDA', value: 3500, kwh: 1200, stageId: 'proposta', sellerName: 'vendedor1@example.com', createdAt: new Date(Date.now() - 86400000 * 2).toISOString(), lastContact: new Date().toISOString(), userId: 'user1', needsAdminApproval: false, leadSource: "Indicação" },
  { id: 'slead2', name: 'Restaurante Sabor Caseiro', value: 8000, kwh: 3000, stageId: 'finalizado', sellerName: 'vendedor1@example.com', createdAt: new Date(Date.now() - 86400000 * 15).toISOString(), lastContact: new Date(Date.now() - 86400000 * 1).toISOString(), userId: 'user1', needsAdminApproval: false, leadSource: "Tráfego Pago" },
  { id: 'slead3', name: 'Oficina Mecânica Rápida', value: 1500, kwh: 600, stageId: 'fatura', sellerName: 'vendedor1@example.com', createdAt: new Date().toISOString(), lastContact: new Date().toISOString(), userId: 'user1', needsAdminApproval: false, leadSource: "Porta a Porta (PAP)" },
];

interface SellerCommissionDashboardProps {
  loggedInUser: AppUser;
}

export default function SellerCommissionDashboard({ loggedInUser }: SellerCommissionDashboardProps) {
  const [leads, setLeads] = useState<LeadWithId[]>(MOCK_SELLER_LEADS);

  useEffect(() => {
    // const loadLeads = async () => {
    //   if (loggedInUser) {
    //     setLeads(await fetchCrmLeads(loggedInUser) || MOCK_SELLER_LEADS);
    //   }
    // };
    // loadLeads();
  }, [loggedInUser]);

  const formatCurrency = (value: number | undefined) => value?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) || "R$ 0,00";

  const performanceMetrics = useMemo(() => {
    const activeLeads = leads.filter(l => !['assinado', 'finalizado', 'perdido', 'cancelado'].includes(l.stageId)).length;
    const finalizedThisMonth = leads.filter(l => l.stageId === 'finalizado' && new Date(l.lastContact).getMonth() === new Date().getMonth()).length;
    const valueFinalizedThisMonth = leads.filter(l => l.stageId === 'finalizado' && new Date(l.lastContact).getMonth() === new Date().getMonth()).reduce((sum, l) => sum + l.value, 0);
    return { activeLeads, finalizedThisMonth, valueFinalizedThisMonth };
  }, [leads]);
  
  const getStageBadgeStyle = (stageId: StageId) => {
    const stageConfig = STAGES_CONFIG.find(s => s.id === stageId);
    return stageConfig ? `${stageConfig.colorClass} text-white` : 'bg-gray-500 text-white';
  };


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
          <CardContent><div className="text-2xl font-bold">{formatCurrency(550.20)}</div><p className="text-xs text-muted-foreground">+10% vs mês anterior</p></CardContent>
        </Card>
         <Card className="bg-card/70 backdrop-blur-lg border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium text-primary">Ganhos Rede (Mês)</CardTitle><Users className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent><div className="text-2xl font-bold">{formatCurrency(120.75)}</div><p className="text-xs text-muted-foreground">+5% vs mês anterior</p></CardContent>
        </Card>
      </div>

      {/* Desempenho de Vendas e Leads */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-card/70 backdrop-blur-lg border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium text-primary">Leads Ativos</CardTitle><Briefcase className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent><div className="text-2xl font-bold">{performanceMetrics.activeLeads}</div></CardContent>
        </Card>
        <Card className="bg-card/70 backdrop-blur-lg border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium text-primary">Finalizados (Mês)</CardTitle><Zap className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent><div className="text-2xl font-bold">{performanceMetrics.finalizedThisMonth}</div></CardContent>
        </Card>
        <Card className="bg-card/70 backdrop-blur-lg border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium text-primary">Valor Finalizado (Mês)</CardTitle><DollarSign className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent><div className="text-2xl font-bold">{formatCurrency(performanceMetrics.valueFinalizedThisMonth)}</div></CardContent>
        </Card>
      </div>
      
      {/* Meus Leads */}
      <Card className="bg-card/70 backdrop-blur-lg border">
        <CardHeader>
            <CardTitle className="text-primary">Meus Leads</CardTitle>
            <CardDescription>Acompanhe o progresso dos seus leads.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Nome do Lead</TableHead><TableHead>Empresa</TableHead><TableHead>Valor (R$)</TableHead><TableHead>KWh</TableHead><TableHead>Estágio</TableHead><TableHead>Último Contato</TableHead></TableRow></TableHeader>
            <TableBody>
              {leads.slice(0, 5).map(lead => ( // Show first 5 for brevity
                <TableRow key={lead.id}>
                  <TableCell className="font-medium">{lead.name}</TableCell>
                  <TableCell>{lead.company || 'N/A'}</TableCell>
                  <TableCell>{formatCurrency(lead.value)}</TableCell>
                  <TableCell>{lead.kwh} kWh</TableCell>
                  <TableCell><span className={`px-2 py-0.5 text-xs rounded-full ${getStageBadgeStyle(lead.stageId)}`}>{STAGES_CONFIG.find(s=>s.id === lead.stageId)?.title || lead.stageId}</span></TableCell>
                  <TableCell>{lead.lastContact ? format(parseISO(lead.lastContact), "dd/MM/yy HH:mm", {locale: ptBR}) : 'N/A'}</TableCell>
                </TableRow>
              ))}
               {leads.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Nenhum lead encontrado.</TableCell></TableRow>
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
        <CardHeader><CardTitle className="text-primary">Minha Rede MLM (Em Breve)</CardTitle><CardDescription>Visualize sua downline e comissões de rede.</CardDescription></CardHeader>
        <CardContent className="h-32 flex items-center justify-center"><Network className="w-12 h-12 text-muted-foreground/50"/></CardContent>
      </Card>
    </div>
  );
}
