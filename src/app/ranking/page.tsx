
"use client";

import { useState, useEffect, useMemo, Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/contexts/AuthContext';
import { format, parseISO, startOfMonth, endOfMonth } from 'date-fns';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Award, TrendingUp, Filter, Crown, UserCircle, DollarSign, Hash, ListOrdered, Zap, X, Loader2 } from 'lucide-react';
import type { LeadWithId } from '@/types/crm';
import type { FirestoreUser, UserType } from '@/types/user';

interface RankingDisplayEntry {
  rankPosition: number;
  userId: string;
  userName: string;
  userPhotoUrl?: string;
  mainScoreDisplay: string; 
  mainScoreValue: number; 
  detailScore1Label?: string; 
  detailScore1Value?: string | number;
  detailScore1Type?: 'currency' | 'kwh' | 'plain';
  detailScore2Label?: string;
  detailScore2Value?: string | number;
  detailScore2Type?: 'currency' | 'kwh' | 'plain';
  kwh: number;
  totalKwhAllTime: number;
  kwhThisSalesCycle: number;
  hasEverHit30kInAMonth: boolean;
  isOuro: boolean;
}

const PERIOD_OPTIONS = [
  { value: 'monthly_current', label: 'Mensal (Ciclo de Vendas)' },
  { value: 'all_time', label: 'Todo o Período' },
];

const CRITERIA_OPTIONS = [
  { value: 'totalSalesValue', label: 'Volume de Vendas (R$)' },
  { value: 'numberOfSales', label: 'Número de Vendas' },
  { value: 'totalKwh', label: 'Total de KWh' },
];

const getMedalForSeller = (entry: RankingDisplayEntry): string => {
  if (entry.isOuro) return '🥇';
  if (entry.hasEverHit30kInAMonth) return '🥇'; 
  if (entry.totalKwhAllTime >= 20000 && entry.kwhThisSalesCycle >= 20000) return '🥈';
  return '🥉';
};

const formatValueForDisplay = (value: string | number | undefined, type: 'currency' | 'kwh' | 'plain'): string => {
    if (value === undefined || value === null || (typeof value === 'number' && isNaN(value))) {
        return type === 'currency' ? 'R$ 0,00' : (type === 'kwh' ? '0 kWh' : '0');
    }

    const numValue = Number(value);
    if (isNaN(numValue)) return String(value);

    if (type === 'currency') {
        return numValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }
    if (type === 'kwh') {
        return `${numValue.toLocaleString('pt-BR')} kWh`;
    }
    return numValue.toLocaleString('pt-BR');
};


function RankingPageContent() {
  const { appUser, allFirestoreUsers, fetchAllCrmLeadsGlobally } = useAuth();
  const [allLeads, setAllLeads] = useState<LeadWithId[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<string>(PERIOD_OPTIONS[0].value);
  const [selectedCriteria, setSelectedCriteria] = useState<string>(CRITERIA_OPTIONS[0].value);
  const [isLoading, setIsLoading] = useState(true);
  const [showNotification, setShowNotification] = useState(true);
  const [showSecondNotification, setShowSecondNotification] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const leads = await fetchAllCrmLeadsGlobally();
        setAllLeads(leads);
      } catch (error) {
        console.error("Failed to load leads for ranking:", error);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, [fetchAllCrmLeadsGlobally]);
  
  const processedData = useMemo(() => {
    if (isLoading || allFirestoreUsers.length === 0) {
      return { ranking: [], totalKwhSoldInPeriod: 0, podium: [] };
    }
  
    const commissionRateOverrides: Record<string, number> = {
      'karatty victoria': 60,
      'diogo rodrigo bottona': 60,
      'francisco gregorio da silva filho': 60,
      'valeria da silva': 60,
      'valeria da silva pereira': 60, // Added variation
      'daniel reveles costa': 60,
    };
    const ouroSellers = Object.keys(commissionRateOverrides);
    const sellersToExclude = ['lucas de moura', 'eduardo w', 'eduardo henrique wiegert'];
  
    const userMapByUid = new Map<string, FirestoreUser>();
    const userMapByName = new Map<string, FirestoreUser>();
    allFirestoreUsers.forEach(user => {
      userMapByUid.set(user.uid, user);
      if (user.displayName) {
        userMapByName.set(user.displayName.trim().toLowerCase(), user);
      }
    });
  
    const getPeriodBounds = (period: string) => {
      const today = new Date();
      if (period === 'monthly_current') {
        const dayOfMonth = today.getDate();
        const currentMonth = today.getMonth();
        const currentYear = today.getFullYear();
        if (dayOfMonth < 21) {
          return { start: new Date(currentYear, currentMonth - 1, 21), end: new Date(currentYear, currentMonth, 21) };
        } else {
          return { start: new Date(currentYear, currentMonth, 21), end: new Date(currentYear, currentMonth + 1, 21) };
        }
      }
      return { start: null, end: null };
    };
  
    const finalizedLeads = allLeads.filter(lead => lead.stageId === 'finalizado');
    const { start, end } = getPeriodBounds(selectedPeriod);
    const periodLeads = (start && end)
      ? finalizedLeads.filter(l => l.completedAt && new Date(l.completedAt) >= start && new Date(l.completedAt) < end)
      : finalizedLeads;
  
    const totalKwhSoldInPeriod = periodLeads.reduce((sum, lead) => sum + (Number(lead.kwh) || 0), 0);
  
    const sellerMetrics = new Map<string, { 
      totalSalesValue: number; 
      numberOfSales: number; 
      totalKwh: number; 
      user: FirestoreUser | { uid: string; displayName: string; photoURL?: string; type: UserType };
    }>();

    // Initialize metrics for all known sellers so they appear even if they have 0 sales
    allFirestoreUsers.forEach(user => {
      if ((user.type === 'vendedor' || user.type === 'superadmin' || user.type === 'admin') && !sellersToExclude.includes((user.displayName || '').toLowerCase())) {
        sellerMetrics.set(user.uid, {
          totalSalesValue: 0,
          numberOfSales: 0,
          totalKwh: 0,
          user,
        });
      }
    });

    periodLeads.forEach(lead => {
      if (!lead.sellerName) return;

      const sellerNameForDisplay = lead.sellerName.trim();
      const sellerNameLower = sellerNameForDisplay.toLowerCase();
      if (sellersToExclude.includes(sellerNameLower)) return;

      let sellerId: string | undefined;
      let seller = userMapByName.get(sellerNameLower);
      if (seller) {
        sellerId = seller.uid;
      } else if (lead.userId && lead.userId !== 'unassigned') {
        sellerId = lead.userId;
        const userById = userMapByUid.get(lead.userId);
        if(userById) seller = userById;
      }

      const metricKey = sellerId || sellerNameLower;
      
      if (!sellerMetrics.has(metricKey)) {
        sellerMetrics.set(metricKey, {
          totalSalesValue: 0,
          numberOfSales: 0,
          totalKwh: 0,
          user: seller || { uid: metricKey, displayName: sellerNameForDisplay, type: 'vendedor' }
        });
      }

      const metrics = sellerMetrics.get(metricKey)!;
      const commissionRate = commissionRateOverrides[sellerNameLower] || 40;
      const commissionValue = (Number(lead.valueAfterDiscount) || 0) * (commissionRate / 100);
      const kwh = Number(lead.kwh) || 0;

      metrics.totalSalesValue += commissionValue;
      metrics.numberOfSales += 1;
      metrics.totalKwh += kwh;
    });

    const allTimeKwhMetrics: Record<string, number> = {};
    const monthlySalesByUser: Record<string, Record<string, number>> = {};
    finalizedLeads.forEach(lead => {
        let sellerId;
        if (lead.userId && lead.userId !== 'unassigned') {
          sellerId = lead.userId;
        } else if(lead.sellerName) {
            const user = userMapByName.get(lead.sellerName.trim().toLowerCase());
            if (user) sellerId = user.uid;
        }
        
        const metricKey = sellerId || lead.sellerName?.trim().toLowerCase();

        if (metricKey) {
            allTimeKwhMetrics[metricKey] = (allTimeKwhMetrics[metricKey] || 0) + (Number(lead.kwh) || 0);

            if (lead.completedAt) {
                 const monthKey = format(parseISO(lead.completedAt), 'yyyy-MM');
                 if (!monthlySalesByUser[metricKey]) monthlySalesByUser[metricKey] = {};
                 monthlySalesByUser[metricKey][monthKey] = (monthlySalesByUser[metricKey][monthKey] || 0) + (Number(lead.value) || 0);
            }
        }
    });
    const hasEverHit30kMap: Record<string, boolean> = {};
    Object.keys(monthlySalesByUser).forEach(userId => {
        if (Object.values(monthlySalesByUser[userId]).some(monthlyTotal => monthlyTotal >= 30000)) {
            hasEverHit30kMap[userId] = true;
        }
    });
    
    const { start: cycleStart, end: cycleEnd } = getPeriodBounds('monthly_current');
    const salesCycleLeads = finalizedLeads.filter(l => l.completedAt && cycleStart && cycleEnd && new Date(l.completedAt) >= cycleStart && new Date(l.completedAt) < cycleEnd);
    const userSalesCycleKwh = salesCycleLeads.reduce((acc, lead) => {
      let sellerId;
      if (lead.userId && lead.userId !== 'unassigned') {
          sellerId = lead.userId;
      } else if(lead.sellerName) {
          const user = userMapByName.get(lead.sellerName.trim().toLowerCase());
          if (user) sellerId = user.uid;
      }
      
      const metricKey = sellerId || lead.sellerName?.trim().toLowerCase();
      if (metricKey) {
        acc[metricKey] = (acc[metricKey] || 0) + (Number(lead.kwh) || 0);
      }
      return acc;
    }, {} as Record<string, number>);
  
    const unsortedRanking = Array.from(sellerMetrics.values())
      .map(metrics => {
        let mainScoreValue = 0;
        if (selectedCriteria === 'totalSalesValue') mainScoreValue = metrics.totalSalesValue;
        else if (selectedCriteria === 'numberOfSales') mainScoreValue = metrics.numberOfSales;
        else mainScoreValue = metrics.totalKwh;
        
        const sellerNameLower = (metrics.user.displayName || '').toLowerCase();
        const metricKey = metrics.user.uid;

        return {
          userId: metricKey,
          userName: metrics.user.displayName || 'N/A',
          userPhotoUrl: metrics.user.photoURL || undefined,
          mainScoreValue,
          mainScoreDisplay: selectedCriteria === 'totalSalesValue' ? formatValueForDisplay(metrics.totalSalesValue, 'currency') : (selectedCriteria === 'numberOfSales' ? `${formatValueForDisplay(metrics.numberOfSales, 'plain')} Vendas` : formatValueForDisplay(metrics.totalKwh, 'kwh')),
          detailScore1Label: selectedCriteria === 'totalSalesValue' ? "Nº Vendas" : "Volume (R$)",
          detailScore1Value: selectedCriteria === 'totalSalesValue' ? metrics.numberOfSales : metrics.totalSalesValue,
          detailScore1Type: selectedCriteria === 'totalSalesValue' ? 'plain' : 'currency',
          detailScore2Label: selectedCriteria === 'numberOfSales' ? "Total KWh" : (selectedCriteria === 'totalKwh' ? "Nº Vendas" : "Total KWh"),
          detailScore2Value: selectedCriteria === 'numberOfSales' ? metrics.totalKwh : (selectedCriteria === 'totalKwh' ? metrics.numberOfSales : metrics.totalKwh),
          detailScore2Type: selectedCriteria === 'numberOfSales' ? 'kwh' : (selectedCriteria === 'totalKwh' ? 'plain' : 'kwh'),
          kwh: metrics.totalKwh,
          totalKwhAllTime: allTimeKwhMetrics[metricKey] || 0,
          kwhThisSalesCycle: userSalesCycleKwh[metricKey] || 0,
          hasEverHit30kInAMonth: hasEverHit30kMap[metricKey] || false,
          isOuro: ouroSellers.includes(sellerNameLower),
        };
      });
  
    const finalRanking = unsortedRanking
      .sort((a, b) => b.mainScoreValue - a.mainScoreValue)
      .map((entry, index) => ({ ...entry, rankPosition: index + 1 }));
  
    return { ranking: finalRanking, totalKwhSoldInPeriod, podium: finalRanking.slice(0, 3) };
  }, [allLeads, allFirestoreUsers, selectedPeriod, selectedCriteria, isLoading]);


  const { ranking, totalKwhSoldInPeriod, podium } = processedData;
  const criteriaLabel = useMemo(() => CRITERIA_OPTIONS.find(c => c.value === selectedCriteria)?.label || "Performance", [selectedCriteria]);
  const loggedInUserRank = useMemo(() => ranking.find(entry => entry.userId === appUser?.uid), [ranking, appUser]);

  const getPodiumBorderColor = (index: number) => {
    if (index === 0) return 'border-yellow-400 shadow-yellow-400/30';
    if (index === 1) return 'border-slate-400 shadow-slate-400/30';
    if (index === 2) return 'border-yellow-600 shadow-yellow-600/30';
    return 'border-border';
  };
  
  const getPodiumTextColor = (index: number) => {
    if (index === 0) return 'text-yellow-400';
    if (index === 1) return 'text-slate-400';
    if (index === 2) return 'text-yellow-600';
    return 'text-foreground';
  };
  
  if (isLoading || !appUser) {
    return (
      <div className="flex flex-col justify-center items-center h-screen bg-transparent text-primary">
        <Loader2 className="animate-spin rounded-full h-12 w-12 text-primary mb-4" />
        <p className="text-lg font-medium">Carregando ranking...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 text-foreground">
      {showNotification && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 flex items-center justify-center p-4 animate-in fade-in-50">
          <Card className="relative max-w-2xl w-full bg-card/90 border-primary shadow-2xl">
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 h-8 w-8 rounded-full z-50 text-muted-foreground hover:bg-muted/80 hover:text-foreground"
              onClick={() => {
                setShowNotification(false);
                setShowSecondNotification(true);
              }}
            >
              <X className="h-5 w-5" />
              <span className="sr-only">Fechar</span>
            </Button>
            <CardContent className="p-0">
              <Image
                src="https://raw.githubusercontent.com/LucasMouraChaser/campanhassent/e2ace5e621fa15e3ebfb6cd3ed9fed3122e8928e/ChatGPT%20Image%2023%20de%20jun.%20de%202025%2C%2015_38_04.png"
                alt="Notificação da Campanha de Ranking"
                width={1024}
                height={576}
                className="rounded-lg object-contain"
                data-ai-hint="trophy award announcement"
              />
            </CardContent>
          </Card>
        </div>
      )}

      {showSecondNotification && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 flex items-center justify-center p-4 animate-in fade-in-50">
          <Card className="relative max-w-2xl w-full bg-card/90 border-primary shadow-2xl">
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 h-8 w-8 rounded-full z-50 text-muted-foreground hover:bg-muted/80 hover:text-foreground"
              onClick={() => setShowSecondNotification(false)}
            >
              <X className="h-5 w-5" />
              <span className="sr-only">Fechar</span>
            </Button>
            <CardContent className="p-0">
              <Image
                src="https://raw.githubusercontent.com/LucasMouraChaser/campanhassent/dd366bf807b2e9135fe42625f3557bb90738f7e7/ChatGPT%20Image%2026%20de%20jun.%20de%202025%2C%2016_37_58.png"
                alt="Notificação da Segunda Campanha de Ranking"
                width={1024}
                height={576}
                className="rounded-lg object-contain"
                data-ai-hint="business presentation graph"
              />
            </CardContent>
          </Card>
        </div>
      )}

      <header className="text-center mb-12">
        <Award className="w-16 h-16 text-primary mx-auto mb-4" />
        <h1 className="text-4xl md:text-5xl font-headline font-bold text-primary tracking-tight">
          Ranking de Performance
        </h1>
        <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
          Acompanhe os top performers e sua posição na equipe Planus Energia.
        </p>
      </header>

      <Card className="mb-8 bg-primary/10 border-primary shadow-xl text-center">
        <CardHeader>
          <CardTitle className="text-xl font-medium text-primary flex items-center justify-center">
            <Zap className="w-6 h-6 mr-2" />
            Total de KWh Vendido (Time)
          </CardTitle>
          <CardDescription>Performance total da equipe no período selecionado.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-6xl font-bold text-foreground">{totalKwhSoldInPeriod.toLocaleString('pt-BR')} <span className="text-2xl text-muted-foreground">kWh</span></p>
        </CardContent>
      </Card>

      <Card className="mb-8 bg-card/70 backdrop-blur-lg border shadow-xl">
        <CardHeader>
          <CardTitle className="text-xl text-primary flex items-center">
            <Filter className="mr-2 h-5 w-5" />
            Filtros do Ranking
          </CardTitle>
        </CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="period-select" className="block text-sm font-medium text-muted-foreground mb-1">Período</label>
            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
              <SelectTrigger id="period-select"><SelectValue placeholder="Selecione o período" /></SelectTrigger>
              <SelectContent>
                {PERIOD_OPTIONS.map(option => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label htmlFor="criteria-select" className="block text-sm font-medium text-muted-foreground mb-1">Critério</label>
            <Select value={selectedCriteria} onValueChange={setSelectedCriteria}>
              <SelectTrigger id="criteria-select"><SelectValue placeholder="Selecione o critério" /></SelectTrigger>
              <SelectContent>
                {CRITERIA_OPTIONS.map(option => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
      
      {isLoading ? (
         <div className="flex flex-col justify-center items-center h-64 bg-transparent text-primary">
            <Loader2 className="animate-spin rounded-full h-12 w-12 text-primary mb-4" />
            <p className="text-lg font-medium">Carregando ranking...</p>
        </div>
      ) : ranking.length > 0 ? (
        <>
          {podium.length > 0 && (
            <section className="mb-12">
              <h2 className="text-3xl font-semibold text-center text-foreground mb-8">Pódio dos Campeões <Crown className="inline-block text-yellow-400 ml-2 h-7 w-7" /></h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {podium.map((entry, index) => (
                  <Card key={entry.userId} className={`bg-card/80 backdrop-blur-xl border-2 ${getPodiumBorderColor(index)} shadow-lg text-center p-6 flex flex-col items-center hover:shadow-2xl transition-all duration-300 ease-in-out transform hover:-translate-y-1`}>
                    <div className={`text-5xl font-black mb-3 ${getPodiumTextColor(index)}`}>
                      {entry.rankPosition}º
                    </div>
                    <div className="relative">
                      <Avatar className="w-24 h-24 mb-4 border-4 border-primary/50">
                        <AvatarImage src={entry.userPhotoUrl} alt={entry.userName} data-ai-hint="user avatar" />
                        <AvatarFallback className="text-2xl">{entry.userName.substring(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="absolute -bottom-2 -right-1 text-4xl bg-card p-0.5 rounded-full shadow-lg">
                        {getMedalForSeller(entry)}
                      </div>
                    </div>
                    <h3 className="text-xl font-semibold text-primary mb-1 truncate max-w-full mt-2">{entry.userName}</h3>
                    <p className="text-2xl font-bold text-foreground">{entry.mainScoreDisplay}</p>
                    <p className="text-xs text-muted-foreground">{criteriaLabel}</p>
                  </Card>
                ))}
              </div>
            </section>
          )}

          {loggedInUserRank && (
            <Card className="my-8 bg-primary/10 border-primary/50 border-2 shadow-xl p-6">
              <CardHeader className="p-0 pb-3 text-center md:text-left">
                <CardTitle className="text-2xl text-primary flex items-center justify-center md:justify-start">
                  <UserCircle className="mr-3 h-7 w-7" /> Minha Posição no Ranking
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 flex flex-col md:flex-row items-center justify-around text-center md:text-left space-y-4 md:space-y-0 md:space-x-4">
                <div className="text-center">
                  <p className="text-5xl font-bold text-primary">{loggedInUserRank.rankPosition}º</p>
                  <p className="text-muted-foreground">Sua Posição</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-semibold text-foreground">{loggedInUserRank.mainScoreDisplay}</p>
                  <p className="text-muted-foreground">{criteriaLabel}</p>
                </div>
                {loggedInUserRank.detailScore1Label && (
                   <div className="text-center hidden sm:block">
                    <p className="text-2xl font-semibold text-foreground">{formatValueForDisplay(loggedInUserRank.detailScore1Value, loggedInUserRank.detailScore1Type || 'plain')}</p>
                    <p className="text-muted-foreground">{loggedInUserRank.detailScore1Label}</p>
                  </div>
                )}
                 {loggedInUserRank.detailScore2Label && (
                   <div className="text-center hidden md:block">
                    <p className="text-2xl font-semibold text-foreground">{formatValueForDisplay(loggedInUserRank.detailScore2Value, loggedInUserRank.detailScore2Type || 'plain')}</p>
                    <p className="text-muted-foreground">{loggedInUserRank.detailScore2Label}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Card className="bg-card/70 backdrop-blur-lg border shadow-xl">
            <CardHeader>
              <CardTitle className="text-2xl text-primary">Classificação Completa</CardTitle>
              <CardDescription>Desempenho da equipe para {PERIOD_OPTIONS.find(p=>p.value === selectedPeriod)?.label || selectedPeriod} por {criteriaLabel.toLowerCase()}.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]"><Hash className="h-4 w-4 text-muted-foreground"/></TableHead>
                    <TableHead>Consultor</TableHead>
                    <TableHead className="text-right">{selectedCriteria === 'totalSalesValue' ? <DollarSign className="h-4 w-4 inline-block mr-1 text-muted-foreground"/> : <ListOrdered className="h-4 w-4 inline-block mr-1 text-muted-foreground"/>} {criteriaLabel}</TableHead>
                    {ranking[0]?.detailScore1Label && <TableHead className="text-right hidden md:table-cell">{ranking[0].detailScore1Label}</TableHead>}
                    {ranking[0]?.detailScore2Label && <TableHead className="text-right hidden lg:table-cell">{ranking[0].detailScore2Label}</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ranking.map((entry) => (
                    <TableRow key={entry.userId} className={entry.userId === appUser?.uid ? 'bg-primary/10 hover:bg-primary/20' : 'hover:bg-muted/50'}>
                      <TableCell className="font-bold text-lg text-center">{entry.rankPosition}</TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-3">
                          <div className="relative inline-block">
                             <Avatar className="h-9 w-9">
                              <AvatarImage src={entry.userPhotoUrl} alt={entry.userName} data-ai-hint="user avatar" />
                              <AvatarFallback>{entry.userName.substring(0, 2).toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <div className="absolute -bottom-1.5 -right-1.5 text-lg bg-card p-0.5 rounded-full shadow">
                              {getMedalForSeller(entry)}
                            </div>
                          </div>
                          <span className="font-medium">{entry.userName}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-semibold text-primary">{entry.mainScoreDisplay}</TableCell>
                      {entry.detailScore1Label && <TableCell className="text-right hidden md:table-cell">{formatValueForDisplay(entry.detailScore1Value, entry.detailScore1Type || 'plain')}</TableCell>}
                      {entry.detailScore2Label && <TableCell className="text-right hidden lg:table-cell">{formatValueForDisplay(entry.detailScore2Value, entry.detailScore2Type || 'plain')}</TableCell>}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      ) : (
        <Card className="bg-card/70 backdrop-blur-lg border shadow-xl mt-8">
          <CardContent className="p-10 text-center">
            <ListOrdered className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
            <p className="text-xl text-muted-foreground">Nenhum dado de ranking encontrado para os filtros selecionados.</p>
            <p className="text-sm text-muted-foreground mt-2">Tente ajustar o período ou critério, ou finalize mais leads!</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}


export default function RankingPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col justify-center items-center h-screen bg-transparent text-primary">
        <Loader2 className="animate-spin rounded-full h-12 w-12 text-primary mb-4" />
        <p className="text-lg font-medium">Carregando Ranking...</p>
      </div>
    }>
      <RankingPageContent />
    </Suspense>
  );
}
