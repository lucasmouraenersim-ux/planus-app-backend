"use client";

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DollarSign, Users, FileSignature, Loader2, TrendingUp, Award, Target, Calendar } from 'lucide-react';
import type { AppUser } from '@/types/user';
import type { LeadWithId } from '@/types/crm';
import type { FirestoreUser } from '@/types/user';

interface SellerCommissionDashboardProps {
  loggedInUser: AppUser;
  leads: LeadWithId[];
  isLoading: boolean;
}

interface ContractToReceive {
  leadId: string;
  clientName: string;
  kwh: number;
  valueAfterDiscount: number;
  commission: number;
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

export default function SellerCommissionDashboard({ 
  loggedInUser, 
  leads, 
  isLoading 
}: SellerCommissionDashboardProps) {
  
  // Calcular comissões pessoais (mesma lógica da Carteira)
  const contractsToReceive = useMemo((): ContractToReceive[] => {
    if (!loggedInUser || !leads || !leads.length) {
      console.log('⚠️ SellerDashboard: Condições não atendidas para calcular comissões:', {
        hasLoggedInUser: !!loggedInUser,
        leadsCount: leads ? leads.length : 'undefined'
      });
      return [];
    }
  
    // Filtrar apenas leads finalizados
    const finalizedLeads = leads.filter(lead => lead.stageId === 'finalizado');
    
    console.log('💰 ===== CALCULANDO COMISSÕES (PAINEL) =====');
    console.log('💰 Total de leads finalizados:', finalizedLeads.length);
  
    const contracts = finalizedLeads.map(lead => {
      // Buscar o vendedor por nome (mesmo método da Carteira)
      const sellerNameLower = (lead.sellerName || '').trim().toLowerCase();
      
      // Como não temos allFirestoreUsers aqui, vamos usar rate padrão de 40%
      // Ou você pode passar allFirestoreUsers como prop se necessário
      let commissionRate = 40; // Default Bronze
      
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
      console.log('   - sellerName:', lead.sellerName);
      console.log('   - valueAfterDiscount:', lead.valueAfterDiscount);
      console.log('   - value:', lead.value);
      console.log('   - baseValueForCommission:', baseValueForCommission);
      console.log('   - commissionRate:', commissionRate);
      console.log('   - commission:', commission);
      console.log('   - isPaid:', lead.commissionPaid);
      
      return {
        leadId: lead.id,
        clientName: lead.name,
        kwh: lead.kwh || 0,
        valueAfterDiscount: baseValueForCommission,
        commission,
        isPaid: lead.commissionPaid || false,
      };
    }).filter((c): c is NonNullable<typeof c> => c !== null && c.commission > 0);
    
    console.log('💰 Total de contratos com comissões válidas:', contracts.length);
    console.log('💰 ===========================================\n');
    
    return contracts;
  }, [leads, loggedInUser]);

  // Calcular totais
  const totalPersonalCommission = useMemo(() => {
    const total = contractsToReceive
      .filter(contract => !contract.isPaid) // Apenas comissões pendentes
      .reduce((sum, contract) => sum + contract.commission, 0);
    
    console.log('💵 ===== SALDO PESSOAL (PAINEL) =====');
    console.log('💵 Total de contratos:', contractsToReceive.length);
    console.log('💵 Contratos pendentes:', contractsToReceive.filter(c => !c.isPaid).length);
    console.log('💵 Contratos pagos:', contractsToReceive.filter(c => c.isPaid).length);
    console.log('💵 TOTAL SALDO PESSOAL:', total);
    console.log('💵 ===================================');
    
    return total;
  }, [contractsToReceive]);

  // Calcular estatísticas do mês atual
  const currentMonthStats = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    if (!leads) {
      return {
        finalizedCount: 0,
        totalValue: 0,
        totalCommission: 0
      };
    }
    
    const thisMonthLeads = leads.filter(lead => {
      if (!lead.completedAt) return false;
      const leadDate = new Date(lead.completedAt);
      return leadDate.getMonth() === currentMonth && leadDate.getFullYear() === currentYear;
    });
    
    const finalizedThisMonth = thisMonthLeads.filter(lead => lead.stageId === 'finalizado');
    const totalValueThisMonth = finalizedThisMonth.reduce((sum, lead) => {
      const value = lead.valueAfterDiscount || lead.value || 0;
      return sum + value;
    }, 0);
    
    const totalCommissionThisMonth = finalizedThisMonth.reduce((sum, lead) => {
      const baseValue = lead.valueAfterDiscount || lead.value || 0;
      return sum + (baseValue * 0.40); // 40% default
    }, 0);
    
    return {
      finalizedCount: finalizedThisMonth.length,
      totalValue: totalValueThisMonth,
      totalCommission: totalCommissionThisMonth
    };
  }, [leads]);

  // Calcular leads ativos da equipe
  const teamActiveLeads = useMemo(() => {
    if (!leads) return 0;
    return leads.filter(lead => 
      lead.stageId !== 'finalizado' && 
      lead.stageId !== 'perdido' && 
      lead.stageId !== 'assinado'
    ).length;
  }, [leads]);

  const formatCurrency = (value: number | undefined | null) => {
    if (value === undefined || value === null || isNaN(value)) return "R$ 0,00";
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  if (isLoading) {
    return (
      <div className="flex flex-col justify-center items-center h-64 bg-transparent text-primary">
        <Loader2 className="animate-spin rounded-full h-12 w-12 text-primary mb-4" />
        <p className="text-lg font-medium">Carregando dados do painel...</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-foreground">
          Painel do Vendedor
        </h1>
        <Badge variant="secondary" className="text-sm">
          {loggedInUser.displayName}
        </Badge>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Saldo Pessoal */}
        <Card className="bg-card/70 backdrop-blur-lg border shadow-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
              <DollarSign className="w-4 h-4 mr-2" />
              Saldo Pessoal
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {formatCurrency(totalPersonalCommission)}
            </div>
            <p className="text-xs text-muted-foreground">
              Comissões pendentes
            </p>
          </CardContent>
        </Card>

        {/* Saldo de Rede MLM */}
        <Card className="bg-card/70 backdrop-blur-lg border shadow-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
              <Users className="w-4 h-4 mr-2" />
              Saldo de Rede (MLM)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              R$ 0,00
            </div>
            <p className="text-xs text-muted-foreground">
              Comissões da equipe
            </p>
          </CardContent>
        </Card>

        {/* Ganhos Pessoais do Mês */}
        <Card className="bg-card/70 backdrop-blur-lg border shadow-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
              <TrendingUp className="w-4 h-4 mr-2" />
              Ganhos Pessoais (Mês)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {formatCurrency(currentMonthStats.totalCommission)}
            </div>
            <p className="text-xs text-muted-foreground">
              {currentMonthStats.finalizedCount} contratos finalizados
            </p>
          </CardContent>
        </Card>

        {/* Ganhos Rede do Mês */}
        <Card className="bg-card/70 backdrop-blur-lg border shadow-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
              <Award className="w-4 h-4 mr-2" />
              Ganhos Rede (Mês)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              R$ 0,00
            </div>
            <p className="text-xs text-muted-foreground">
              Comissões da equipe
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Cards de Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Leads Ativos da Equipe */}
        <Card className="bg-card/70 backdrop-blur-lg border shadow-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
              <Target className="w-4 h-4 mr-2" />
              Leads Ativos (Equipe)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {teamActiveLeads}
            </div>
            <p className="text-xs text-muted-foreground">
              Em andamento
            </p>
          </CardContent>
        </Card>

        {/* Finalizados do Mês */}
        <Card className="bg-card/70 backdrop-blur-lg border shadow-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
              <Calendar className="w-4 h-4 mr-2" />
              Finalizados (Equipe/Mês)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {currentMonthStats.finalizedCount}
            </div>
            <p className="text-xs text-muted-foreground">
              Este mês
            </p>
          </CardContent>
        </Card>

        {/* Valor Finalizado do Mês */}
        <Card className="bg-card/70 backdrop-blur-lg border shadow-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
              <FileSignature className="w-4 h-4 mr-2" />
              Valor Finalizado (Equipe/Mês)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {formatCurrency(currentMonthStats.totalValue)}
            </div>
            <p className="text-xs text-muted-foreground">
              Valor total dos contratos
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabela de Leads da Equipe */}
      <Card className="bg-card/70 backdrop-blur-lg border shadow-xl">
        <CardHeader>
          <CardTitle className="text-xl text-primary flex items-center">
            <FileSignature className="w-6 h-6 mr-2" />
            Leads da Equipe
          </CardTitle>
        </CardHeader>
        <CardContent>
          {leads.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileSignature size={48} className="mx-auto mb-4 opacity-50" />
              <p>Nenhum lead encontrado.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome do Lead</TableHead>
                  <TableHead>Vendedor</TableHead>
                  <TableHead>Valor (c/desc.)</TableHead>
                  <TableHead>KWh</TableHead>
                  <TableHead>Estágio</TableHead>
                  <TableHead>Último Contato</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leads.slice(0, 10).map((lead) => (
                  <TableRow key={lead.id}>
                    <TableCell className="font-medium">{lead.name}</TableCell>
                    <TableCell>{lead.sellerName}</TableCell>
                    <TableCell>{formatCurrency(lead.valueAfterDiscount || lead.value)}</TableCell>
                    <TableCell>{lead.kwh?.toLocaleString('pt-BR') || 0} kWh</TableCell>
                    <TableCell>
                      <Badge 
                        variant={
                          lead.stageId === 'finalizado' ? 'default' :
                          lead.stageId === 'perdido' ? 'destructive' :
                          'secondary'
                        }
                        className="capitalize"
                      >
                        {lead.stageId}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {lead.lastContact ? 
                        new Date(lead.lastContact).toLocaleDateString('pt-BR') : 
                        'N/A'
                      }
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Botão para Carteira */}
      <div className="flex justify-center">
        <a 
          href="/dashboard" 
          className="inline-flex items-center px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
        >
          <DollarSign className="w-5 h-5 mr-2" />
          Ver Minha Carteira
        </a>
      </div>
    </div>
  );
}
