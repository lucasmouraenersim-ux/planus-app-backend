
"use client";

import { useState, useEffect, useMemo, Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/contexts/AuthContext';
import { format, parseISO, startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear } from 'date-fns';
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
import type { FirestoreUser } from '@/types/user';

interface RankingDisplayEntry {
  rankPosition: number;
  userId: string;
  userName: string;
  userPhotoUrl?: string;
  mainScoreDisplay: string; 
  mainScoreValue: number; 
  detailScore1Label?: string; 
  detailScore1Value?: string | number;
  detailScore2Label?: string;
  detailScore2Value?: string | number;
  kwh: number;
  totalKwhAllTime: number;
  kwhThisSalesCycle: number;
  hasEverHit30kInAMonth: boolean;
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

const formatDisplayValue = (value: string | number | undefined, criteria: string): string => {
  if (value === undefined) return 'N/A';
  if (criteria === 'totalSalesValue') {
    const num = Number(String(value).replace(/[^0-9,.-]+/g,"").replace('.', '').replace(',', '.'));
    return isNaN(num) ? String(value) : num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }
   if (criteria === 'totalKwh') {
      return `${Number(value).toLocaleString('pt-BR')} kWh`;
   }
  return Number(value).toLocaleString('pt-BR');
};

const getMedalForSeller = (entry: RankingDisplayEntry): string => {
  if (entry.hasEverHit30kInAMonth) return '🥇'; 
  if (entry.totalKwhAllTime >= 20000 && entry.kwhThisSalesCycle >= 20000) return '🥈';
  return '🥉';
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
  
  const finalizedLeads = useMemo(() => allLeads.filter(lead => lead.stageId === 'finalizado'), [allLeads]);

  const periodLeads = useMemo(() => {
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
      return { start: null, end: null }; // all_time
    };
    const { start, end } = getPeriodBounds(selectedPeriod);
    if (start && end) {
      return finalizedLeads.filter(l => l.completedAt && new Date(l.completedAt) >= start && new Date(l.completedAt) < end)
    }
    return finalizedLeads;
  }, [finalizedLeads, selectedPeriod]);

  const totalKwhSoldInPeriod = useMemo(() => {
    return periodLeads.reduce((sum, lead) => sum + (lead.kwh || 0), 0);
  }, [periodLeads]);

  const rankingData = useMemo(() => {
    if (allFirestoreUsers.length === 0 || finalizedLeads.length === 0) {
      return [];
    }
    
    // --- All-time metrics calculation for medals ---
    const userAllTimeMetrics: Record<string, { totalKwh: number; monthlySales: Record<string, number> }> = {};

    finalizedLeads.forEach(lead => {
        const seller = allFirestoreUsers.find(u => u.uid === lead.userId || u.displayName === lead.sellerName);
        if (!seller || !lead.completedAt) return;
        
        const userId = seller.uid;

        if (!userAllTimeMetrics[userId]) {
            userAllTimeMetrics[userId] = { totalKwh: 0, monthlySales: {} };
        }
        userAllTimeMetrics[userId].totalKwh += lead.kwh || 0;
        
        const monthKey = format(parseISO(lead.completedAt), 'yyyy-MM');
        if (!userAllTimeMetrics[userId].monthlySales[monthKey]) {
            userAllTimeMetrics[userId].monthlySales[monthKey] = 0;
        }
        // Medal logic is based on raw sales value, not commission
        userAllTimeMetrics[userId].monthlySales[monthKey] += lead.value || 0;
    });

    const usersWhoHit30k = new Set<string>();
    Object.keys(userAllTimeMetrics).forEach(userId => {
        const monthlySales = userAllTimeMetrics[userId].monthlySales;
        for (const month in monthlySales) {
            if (monthlySales[month] >= 30000) {
                usersWhoHit30k.add(userId);
                break;
            }
        }
    });

    const getSalesCycleBounds = () => {
      const today = new Date();
      const dayOfMonth = today.getDate();
      const currentMonth = today.getMonth();
      const currentYear = today.getFullYear();
      if (dayOfMonth < 21) {
          return { start: new Date(currentYear, currentMonth - 1, 21), end: new Date(currentYear, currentMonth, 21) };
      } else {
          return { start: new Date(currentYear, currentMonth, 21), end: new Date(currentYear, currentMonth + 1, 21) };
      }
    };

    const { start: cycleStart, end: cycleEnd } = getSalesCycleBounds();
    const salesCycleLeads = cycleStart && cycleEnd
        ? finalizedLeads.filter(l => l.completedAt && new Date(l.completedAt) >= cycleStart && new Date(l.completedAt) < cycleEnd)
        : [];
    
    const userSalesCycleKwh: Record<string, number> = {};
    salesCycleLeads.forEach(lead => {
        const seller = allFirestoreUsers.find(u => u.uid === lead.userId || u.displayName === lead.sellerName);
        if (!seller) return;
        
        const userId = seller.uid;
        if (!userSalesCycleKwh[userId]) userSalesCycleKwh[userId] = 0;
        userSalesCycleKwh[userId] += lead.kwh || 0;
    });
    
    // --- Period-specific metrics ---
    const userMetrics = new Map<string, {
      totalSalesValue: number, // This will be commission value
      numberOfSales: number,
      totalKwh: number,
    }>();

    periodLeads.forEach(lead => {
      const seller = allFirestoreUsers.find(u => u.uid === lead.userId || u.displayName === lead.sellerName);
      if (!seller) return;

      if (!userMetrics.has(seller.uid)) {
        userMetrics.set(seller.uid, { totalSalesValue: 0, numberOfSales: 0, totalKwh: 0 });
      }
      const metrics = userMetrics.get(seller.uid)!;
      
      const commissionRate = seller.commissionRate || 40;
      const commissionValue = (lead.value || 0) * (commissionRate / 100);

      metrics.totalSalesValue += commissionValue; // Storing commission as sales value
      metrics.numberOfSales += 1;
      metrics.totalKwh += lead.kwh || 0;
    });
    
    const calculatedRanking = allFirestoreUsers
      .filter(user => user.type === 'vendedor' || user.type === 'admin') // Exclude 'superadmin'
      .map(user => {
        const metrics = userMetrics.get(user.uid) || { totalSalesValue: 0, numberOfSales: 0, totalKwh: 0 };
        
        let mainScoreValue = 0;
        let mainScoreDisplay = "";
        let detailScore1Label = "";
        let detailScore1Value: string | number | undefined = "";
        let detailScore2Label = "";
        let detailScore2Value: string | number | undefined = "";

        if (selectedCriteria === 'totalSalesValue') {
          mainScoreValue = metrics.totalSalesValue;
          mainScoreDisplay = formatDisplayValue(metrics.totalSalesValue, 'totalSalesValue');
          detailScore1Label = "Nº Vendas";
          detailScore1Value = formatDisplayValue(metrics.numberOfSales, 'numberOfSales');
          detailScore2Label = "Total KWh";
          detailScore2Value = formatDisplayValue(metrics.totalKwh, 'totalKwh');
        } else if (selectedCriteria === 'numberOfSales') {
          mainScoreValue = metrics.numberOfSales;
          mainScoreDisplay = `${formatDisplayValue(metrics.numberOfSales, 'numberOfSales')} Vendas`;
          detailScore1Label = "Volume (R$)";
          detailScore1Value = formatDisplayValue(metrics.totalSalesValue, 'totalSalesValue');
          detailScore2Label = "Total KWh";
          detailScore2Value = formatDisplayValue(metrics.totalKwh, 'totalKwh');
        } else { // totalKwh
          mainScoreValue = metrics.totalKwh;
          mainScoreDisplay = formatDisplayValue(metrics.totalKwh, 'totalKwh');
          detailScore1Label = "Volume (R$)";
          detailScore1Value = formatDisplayValue(metrics.totalSalesValue, 'totalSalesValue');
          detailScore2Label = "Nº Vendas";
          detailScore2Value = formatDisplayValue(metrics.numberOfSales, 'numberOfSales');
        }
        
        return {
          userId: user.uid,
          userName: user.displayName || user.email || 'N/A',
          userPhotoUrl: user.photoURL || undefined,
          mainScoreValue,
          mainScoreDisplay,
          detailScore1Label,
          detailScore1Value,
          detailScore2Label,
          detailScore2Value,
          kwh: metrics.totalKwh,
          totalKwhAllTime: userAllTimeMetrics[user.uid]?.totalKwh || 0,
          kwhThisSalesCycle: userSalesCycleKwh[user.uid] || 0,
          hasEverHit30kInAMonth: usersWhoHit30k.has(user.uid),
        } as Omit<RankingDisplayEntry, 'rankPosition'>;
      })
      .sort((a, b) => b.mainScoreValue - a.mainScoreValue)
      .map((entry, index) => ({ ...entry, rankPosition: index + 1 }));

    return calculatedRanking;

  }, [finalizedLeads, periodLeads, allFirestoreUsers, selectedCriteria]);
  
  const criteriaLabel = useMemo(() => CRITERIA_OPTIONS.find(c => c.value === selectedCriteria)?.label || "Performance", [selectedCriteria]);
  const loggedInUserRank = useMemo(() => rankingData.find(entry => entry.userId === appUser?.uid), [rankingData, appUser]);
  const podiumData = useMemo(() => rankingData.slice(0, 3), [rankingData]);

  const getPodiumBorderColor = (index: number) => {
    if (index === 0) return 'border-yellow-400 shadow-yellow-400/30'; // Gold
    if (index === 1) return 'border-slate-400 shadow-slate-400/30'; // Silver
    if (index === 2) return 'border-yellow-600 shadow-yellow-600/30'; // Bronze
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
      ) : rankingData.length > 0 ? (
        <>
          {podiumData.length > 0 && (
            <section className="mb-12">
              <h2 className="text-3xl font-semibold text-center text-foreground mb-8">Pódio dos Campeões <Crown className="inline-block text-yellow-400 ml-2 h-7 w-7" /></h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {podiumData.map((entry, index) => (
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
                    <p className="text-2xl font-semibold text-foreground">{formatDisplayValue(loggedInUserRank.detailScore1Value, 'default')}</p>
                    <p className="text-muted-foreground">{loggedInUserRank.detailScore1Label}</p>
                  </div>
                )}
                 {loggedInUserRank.detailScore2Label && (
                   <div className="text-center hidden md:block">
                    <p className="text-2xl font-semibold text-foreground">{formatDisplayValue(loggedInUserRank.detailScore2Value, 'totalKwh')}</p>
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
                    {rankingData[0]?.detailScore1Label && <TableHead className="text-right hidden md:table-cell">{rankingData[0].detailScore1Label}</TableHead>}
                    {rankingData[0]?.detailScore2Label && <TableHead className="text-right hidden lg:table-cell">{rankingData[0].detailScore2Label}</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rankingData.map((entry) => (
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
                      {entry.detailScore1Label && <TableCell className="text-right hidden md:table-cell">{formatDisplayValue(entry.detailScore1Value, 'default')}</TableCell>}
                      {entry.detailScore2Label && <TableCell className="text-right hidden lg:table-cell">{formatDisplayValue(entry.detailScore2Value, 'totalKwh')}</TableCell>}
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
