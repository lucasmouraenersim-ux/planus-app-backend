"use client";

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { DateRange } from "react-day-picker";

import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { 
    Award, Filter, Crown, UserCircle, DollarSign, Hash, 
    ListOrdered, Zap, Loader2, CalendarIcon, Trophy, Sparkles, Medal, TrendingUp 
} from 'lucide-react';
import type { LeadWithId } from '@/types/crm';
import type { FirestoreUser, UserType } from '@/types/user';
import { cn } from "@/lib/utils";

// --- HELPERS ---

// Confetti Effect Component (CSS puro para não instalar deps)
const ConfettiRain = () => (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden opacity-30">
        {[...Array(20)].map((_, i) => (
            <div 
                key={i} 
                className="absolute top-0 w-1 h-1 bg-yellow-400 rounded-full animate-fall"
                style={{
                    left: `${Math.random() * 100}%`,
                    animationDuration: `${Math.random() * 3 + 2}s`,
                    animationDelay: `${Math.random() * 2}s`
                }}
            />
        ))}
        <style jsx>{`
            @keyframes fall {
                0% { transform: translateY(-10vh) rotate(0deg); opacity: 1; }
                100% { transform: translateY(110vh) rotate(360deg); opacity: 0; }
            }
            .animate-fall { animation: fall linear infinite; }
        `}</style>
    </div>
);

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
  { value: 'monthly_current', label: 'Ciclo Atual (21 a 20)' },
  { value: 'all_time', label: 'Todo o Período' },
  { value: 'custom', label: 'Personalizado' },
];

const CRITERIA_OPTIONS = [
  { value: 'totalSalesValue', label: 'Volume de Vendas (R$)' },
  { value: 'numberOfSales', label: 'Quantidade de Vendas' },
  { value: 'totalKwh', label: 'Volume de Energia (kWh)' },
];

const STAGE_FILTER_OPTIONS = [
    { value: 'finalizado', label: 'Apenas Finalizados' },
    { value: 'assinado_finalizado', label: 'Assinados + Finalizados' },
];

const getMedalForSeller = (entry: RankingDisplayEntry): string => {
  if (entry.isOuro) return '💎'; // Diamante para Ouro/VIP
  if (entry.hasEverHit30kInAMonth) return '🔥'; // Fogo para High Performer
  if (entry.totalKwhAllTime >= 20000 && entry.kwhThisSalesCycle >= 20000) return '⭐';
  return '';
};

const formatValueForDisplay = (value: string | number | undefined, type: 'currency' | 'kwh' | 'plain'): string => {
    if (value === undefined || value === null || (typeof value === 'number' && isNaN(value))) {
        return type === 'currency' ? 'R$ 0,00' : (type === 'kwh' ? '0 kWh' : '0');
    }
    const numValue = Number(value);
    if (isNaN(numValue)) return String(value);
    if (type === 'currency') return numValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    if (type === 'kwh') return `${numValue.toLocaleString('pt-BR')} kWh`;
    return numValue.toLocaleString('pt-BR');
};

function RankingPageContent() {
  const { appUser, allFirestoreUsers, fetchAllCrmLeadsGlobally } = useAuth();
  const [allLeads, setAllLeads] = useState<LeadWithId[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<string>(PERIOD_OPTIONS[0].value);
  const [selectedCriteria, setSelectedCriteria] = useState<string>(CRITERIA_OPTIONS[0].value);
  const [selectedStageFilter, setSelectedStageFilter] = useState<string>(STAGE_FILTER_OPTIONS[0].value);
  const [date, setDate] = useState<DateRange | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);

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
    if (isLoading) return { ranking: [], totalKwhSoldInPeriod: 0, podium: [] };
  
    const commissionRateOverrides: Record<string, number> = {
      'karatty victoria': 60, 'diogo rodrigo bottona': 60, 'francisco gregorio da silva filho': 60,
      'valeria da silva': 60, 'valeria da silva pereira': 60, 'daniel reveles costa': 60,
    };
    const ouroSellers = Object.keys(commissionRateOverrides);
    const sellersToExclude = ['lucas de moura', 'eduardo w', 'eduardo henrique wiegert'];
    const targetStages = selectedStageFilter === 'assinado_finalizado' ? ['finalizado', 'assinado'] : ['finalizado'];
    
    const leadsForRanking = allLeads.filter(lead => targetStages.includes(lead.stageId));
    const allFinalizedLeads = allLeads.filter(lead => lead.stageId === 'finalizado');
  
    const sellerMetrics = new Map<string, { totalSalesValue: number; numberOfSales: number; totalKwh: number; user: FirestoreUser | { uid: string; displayName: string; photoURL?: string; type: UserType }; }>();
    const userMapByName = new Map<string, FirestoreUser>();
    
    allFirestoreUsers.forEach(user => {
      if (user.displayName) userMapByName.set(user.displayName.trim().toLowerCase(), user);
      if ((user.type === 'vendedor' || user.type === 'superadmin' || user.type === 'admin') && !sellersToExclude.includes((user.displayName || '').toLowerCase())) {
        sellerMetrics.set(user.uid, { totalSalesValue: 0, numberOfSales: 0, totalKwh: 0, user });
      }
    });

    leadsForRanking.forEach(lead => {
      if (lead.sellerName && !sellersToExclude.includes(lead.sellerName.trim().toLowerCase())) {
        const sellerNameLower = lead.sellerName.trim().toLowerCase();
        if (!userMapByName.has(sellerNameLower) && !sellerMetrics.has(sellerNameLower)) {
          sellerMetrics.set(sellerNameLower, { totalSalesValue: 0, numberOfSales: 0, totalKwh: 0, user: { uid: sellerNameLower, displayName: lead.sellerName.trim(), type: 'vendedor' } });
        }
      }
    });

    const getPeriodBounds = (period: string, customRange?: DateRange) => {
      const today = new Date();
      if (period === 'custom' && customRange?.from) {
        const endDate = customRange.to ? new Date(customRange.to.setHours(23, 59, 59, 999)) : new Date(customRange.from.setHours(23, 59, 59, 999));
        return { start: customRange.from, end: endDate };
      }
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
    const { start, end } = getPeriodBounds(selectedPeriod, date);
    
    const periodLeads = (start && end)
      ? leadsForRanking.filter(l => {
          const relevantDateStr = l.stageId === 'finalizado' ? l.completedAt : l.signedAt;
          if (!relevantDateStr) return false;
          const relevantDate = new Date(relevantDateStr);
          return relevantDate >= start && relevantDate < end;
      })
      : (selectedPeriod === 'all_time' ? leadsForRanking : leadsForRanking.filter(l => {
          const {start: cycleStart, end: cycleEnd} = getPeriodBounds('monthly_current');
          const relevantDateStr = l.stageId === 'finalizado' ? l.completedAt : l.signedAt;
          if (!relevantDateStr || !cycleStart || !cycleEnd) return false;
          const relevantDate = new Date(relevantDateStr);
          return relevantDate >= cycleStart && relevantDate < cycleEnd;
      }));
    
    const totalKwhSoldInPeriod = periodLeads.reduce((sum, lead) => sum + (Number(lead.kwh) || 0), 0);
  
    periodLeads.forEach(lead => {
      if (!lead.sellerName || sellersToExclude.includes(lead.sellerName.trim().toLowerCase())) return;
      const sellerNameLower = lead.sellerName.trim().toLowerCase();
      const userByDisplayName = userMapByName.get(sellerNameLower);
      const metricKey = userByDisplayName ? userByDisplayName.uid : sellerNameLower;

      if (metricKey && sellerMetrics.has(metricKey)) {
        const metrics = sellerMetrics.get(metricKey)!;
        const commissionRate = commissionRateOverrides[sellerNameLower] || 40;
        metrics.totalSalesValue += (Number(lead.valueAfterDiscount) || 0) * (commissionRate / 100);
        metrics.numberOfSales += 1;
        metrics.totalKwh += (Number(lead.kwh) || 0);
      }
    });

    const allTimeKwhMetrics: Record<string, number> = {};
    const monthlySalesByUser: Record<string, Record<string, number>> = {};
    
    allFinalizedLeads.forEach(lead => {
      if (!lead.sellerName || sellersToExclude.includes(lead.sellerName.trim().toLowerCase())) return;
      const sellerNameLower = lead.sellerName.trim().toLowerCase();
      const userByDisplayName = userMapByName.get(sellerNameLower);
      const metricKey = userByDisplayName ? userByDisplayName.uid : sellerNameLower;

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
        if (Object.values(monthlySalesByUser[userId]).some(monthlyTotal => monthlyTotal >= 30000)) hasEverHit30kMap[userId] = true;
    });
    
    const { start: cycleStart, end: cycleEnd } = getPeriodBounds('monthly_current');
    const salesCycleLeads = allFinalizedLeads.filter(l => l.completedAt && cycleStart && cycleEnd && new Date(l.completedAt) >= cycleStart && new Date(l.completedAt) < cycleEnd);
    const userSalesCycleKwh = salesCycleLeads.reduce((acc, lead) => {
        if (!lead.sellerName || sellersToExclude.includes(lead.sellerName.trim().toLowerCase())) return acc;
        const sellerNameLower = lead.sellerName.trim().toLowerCase();
        const userByDisplayName = userMapByName.get(sellerNameLower);
        const metricKey = userByDisplayName ? userByDisplayName.uid : sellerNameLower;
        if (metricKey) acc[metricKey] = (acc[metricKey] || 0) + (Number(lead.kwh) || 0);
        return acc;
    }, {} as Record<string, number>);
  
    const unsortedRanking = Array.from(sellerMetrics.values()).map(metrics => {
      let mainScoreValue = 0;
      if (selectedCriteria === 'totalSalesValue') mainScoreValue = metrics.totalSalesValue;
      else if (selectedCriteria === 'numberOfSales') mainScoreValue = metrics.numberOfSales;
      else mainScoreValue = metrics.totalKwh;
      
      const metricKey = metrics.user.uid;
      const sellerNameLower = (metrics.user.displayName || '').toLowerCase();

      return {
        userId: metricKey, userName: metrics.user.displayName || 'N/A', userPhotoUrl: metrics.user.photoURL || undefined,
        mainScoreValue,
        mainScoreDisplay: selectedCriteria === 'totalSalesValue' ? formatValueForDisplay(metrics.totalSalesValue, 'currency') : (selectedCriteria === 'numberOfSales' ? `${formatValueForDisplay(metrics.numberOfSales, 'plain')} Vendas` : formatValueForDisplay(metrics.totalKwh, 'kwh')),
        detailScore1Label: selectedCriteria === 'totalSalesValue' ? "Vendas" : "Volume (R$)",
        detailScore1Value: selectedCriteria === 'totalSalesValue' ? metrics.numberOfSales : metrics.totalSalesValue,
        detailScore1Type: selectedCriteria === 'totalSalesValue' ? 'plain' : 'currency',
        detailScore2Label: selectedCriteria === 'numberOfSales' ? "KWh" : (selectedCriteria === 'totalKwh' ? "Vendas" : "KWh"),
        detailScore2Value: selectedCriteria === 'numberOfSales' ? metrics.totalKwh : (selectedCriteria === 'totalKwh' ? metrics.numberOfSales : metrics.totalKwh),
        detailScore2Type: selectedCriteria === 'numberOfSales' ? 'kwh' : (selectedCriteria === 'totalKwh' ? 'plain' : 'kwh'),
        kwh: metrics.totalKwh,
        totalKwhAllTime: allTimeKwhMetrics[metricKey] || 0,
        kwhThisSalesCycle: userSalesCycleKwh[metricKey] || 0,
        hasEverHit30kInAMonth: hasEverHit30kMap[metricKey] || false,
        isOuro: ouroSellers.includes(sellerNameLower),
      };
    });
  
    const finalRanking = unsortedRanking.sort((a, b) => b.mainScoreValue - a.mainScoreValue).map((entry, index) => ({ ...entry, rankPosition: index + 1 }));
    return { ranking: finalRanking, totalKwhSoldInPeriod, podium: finalRanking.slice(0, 3) };
  }, [allLeads, allFirestoreUsers, selectedPeriod, selectedCriteria, selectedStageFilter, isLoading, date]);

  const { ranking, totalKwhSoldInPeriod, podium } = processedData;
  const loggedInUserRank = ranking.find(entry => entry.userId === appUser?.uid);

  // --- PODIUM COMPONENT ---
  const PodiumSpot = ({ entry, rank, delay }: { entry: RankingDisplayEntry, rank: 1 | 2 | 3, delay: string }) => {
    const isGold = rank === 1;
    const isSilver = rank === 2;
    const isBronze = rank === 3;
    
    // Alturas e cores baseadas no rank
    const heightClass = isGold ? "h-64" : isSilver ? "h-52" : "h-44";
    const bgGradient = isGold 
        ? "bg-gradient-to-t from-yellow-600/20 to-yellow-400/10 border-yellow-500/50" 
        : isSilver 
            ? "bg-gradient-to-t from-slate-400/20 to-slate-300/10 border-slate-400/50"
            : "bg-gradient-to-t from-orange-700/20 to-orange-500/10 border-orange-500/50";
    
    const ringColor = isGold ? "ring-yellow-400" : isSilver ? "ring-slate-300" : "ring-orange-600";
    const textColor = isGold ? "text-yellow-400" : isSilver ? "text-slate-300" : "text-orange-500";
    const medalIcon = isGold ? "🥇" : isSilver ? "🥈" : "🥉";

    return (
        <div className={`flex flex-col items-center justify-end animate-in fade-in slide-in-from-bottom-8 duration-1000 fill-mode-both`} style={{ animationDelay: delay }}>
            <div className="relative mb-4 group">
                <div className={`absolute inset-0 rounded-full blur-xl opacity-50 ${isGold ? 'bg-yellow-400' : isSilver ? 'bg-slate-300' : 'bg-orange-500'}`}></div>
                <Avatar className={`w-20 h-20 md:w-28 md:h-28 ring-4 ${ringColor} shadow-2xl z-10 relative group-hover:scale-105 transition-transform duration-300`}>
                    <AvatarImage src={entry.userPhotoUrl} alt={entry.userName} />
                    <AvatarFallback className="text-xl font-bold bg-slate-900 text-white">{entry.userName.substring(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="absolute -top-3 -right-3 text-3xl animate-bounce" style={{ animationDuration: '3s' }}>{medalIcon}</div>
            </div>
            
            <div className={`w-full ${heightClass} ${bgGradient} backdrop-blur-md rounded-t-3xl border-t border-x flex flex-col items-center justify-start pt-6 px-4 relative overflow-hidden`}>
                <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none"></div>
                <h3 className="font-bold text-white text-center text-sm md:text-lg leading-tight mb-1">{entry.userName.split(' ')[0]}</h3>
                <p className={`text-xs md:text-sm font-bold opacity-80 mb-2`}>{entry.userName.split(' ').slice(1).join(' ')}</p>
                <div className={`text-xl md:text-3xl font-black ${textColor} mt-auto mb-4 tracking-tighter`}>
                    {entry.mainScoreDisplay}
                </div>
                {getMedalForSeller(entry) && <div className="absolute bottom-2 right-2 text-xl" title="High Performer">{getMedalForSeller(entry)}</div>}
            </div>
        </div>
    );
  };

  // --- LIST ROW COMPONENT ---
  const RankingRow = ({ entry }: { entry: RankingDisplayEntry }) => (
    <div className={`group relative flex items-center gap-4 p-4 rounded-xl border border-white/5 bg-slate-900/40 hover:bg-white/5 transition-all duration-300 ${entry.userId === appUser?.uid ? 'ring-1 ring-cyan-500 bg-cyan-900/10' : ''}`}>
        <div className="w-8 text-center font-bold text-slate-500 text-lg group-hover:text-white transition-colors">
            #{entry.rankPosition}
        </div>
        
        <Avatar className="h-10 w-10 md:h-12 md:w-12 border border-white/10 group-hover:border-cyan-500/50 transition-colors">
            <AvatarImage src={entry.userPhotoUrl} />
            <AvatarFallback className="bg-slate-800 text-xs">{entry.userName.substring(0,2).toUpperCase()}</AvatarFallback>
        </Avatar>
        
        <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
                <p className="font-bold text-slate-200 truncate group-hover:text-cyan-400 transition-colors">{entry.userName}</p>
                {getMedalForSeller(entry) && <span className="text-xs" title="Badge de Honra">{getMedalForSeller(entry)}</span>}
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-500 mt-0.5">
                {entry.detailScore1Label && <span>{entry.detailScore1Label}: <span className="text-slate-300">{formatValueForDisplay(entry.detailScore1Value, entry.detailScore1Type || 'plain')}</span></span>}
                {entry.detailScore2Label && <span className="hidden sm:inline">• {entry.detailScore2Label}: <span className="text-slate-300">{formatValueForDisplay(entry.detailScore2Value, entry.detailScore2Type || 'plain')}</span></span>}
            </div>
        </div>
        
        <div className="text-right">
            <p className="text-lg md:text-xl font-bold text-white tracking-tight">{entry.mainScoreDisplay}</p>
        </div>
    </div>
  );

  if (isLoading || !appUser) {
    return (
      <div className="flex flex-col justify-center items-center h-screen bg-slate-950 text-cyan-500">
        <Loader2 className="animate-spin h-12 w-12 mb-4" />
        <p className="text-slate-400 animate-pulse tracking-widest uppercase text-sm">Carregando Leaderboard...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans relative overflow-hidden pb-20">
      <ConfettiRain />
      
      {/* Background Ambience */}
      <div className="fixed inset-0 pointer-events-none">
          <div className="absolute top-[-10%] left-[20%] w-[500px] h-[500px] bg-purple-900/20 rounded-full blur-[120px]" />
          <div className="absolute bottom-[-10%] right-[10%] w-[500px] h-[500px] bg-cyan-900/10 rounded-full blur-[120px]" />
      </div>

      <div className="container max-w-5xl mx-auto px-4 py-8 relative z-10">
        
        {/* Header */}
        <div className="text-center mb-10 space-y-2">
            <div className="inline-flex items-center justify-center p-3 bg-gradient-to-br from-yellow-500/20 to-orange-500/20 rounded-2xl mb-4 border border-yellow-500/30 shadow-lg shadow-yellow-500/10">
                <Trophy className="w-8 h-8 text-yellow-400" />
            </div>
            <h1 className="text-4xl md:text-6xl font-black text-white tracking-tight">
                Hall da Fama
            </h1>
            <p className="text-slate-400 max-w-xl mx-auto text-sm md:text-base">
                Celebre os consultores que estão transformando o mercado de energia.
            </p>
        </div>

        {/* Global KPI */}
        <div className="mb-10 text-center animate-in zoom-in duration-500">
            <div className="inline-block relative group">
                <div className="absolute inset-0 bg-cyan-500/20 blur-xl rounded-full group-hover:bg-cyan-500/30 transition-all duration-500"></div>
                <div className="relative bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-full px-8 py-4 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-cyan-500/10 flex items-center justify-center">
                        <Zap className="w-5 h-5 text-cyan-400 fill-cyan-400" />
                    </div>
                    <div className="text-left">
                        <p className="text-xs text-slate-400 uppercase tracking-widest font-bold">Total do Time</p>
                        <p className="text-2xl md:text-3xl font-black text-white">{totalKwhSoldInPeriod.toLocaleString('pt-BR')} <span className="text-sm font-medium text-slate-500">kWh</span></p>
                    </div>
                </div>
            </div>
        </div>

        {/* Filters Bar */}
        <div className="flex flex-wrap gap-3 justify-center mb-12 p-1.5 bg-slate-900/50 border border-white/5 rounded-2xl backdrop-blur-md max-w-4xl mx-auto">
            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                <SelectTrigger className="w-[160px] bg-transparent border-0 text-slate-300 hover:text-white hover:bg-white/5 h-10"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">{PERIOD_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
            </Select>
            <div className="w-px h-6 bg-white/10 my-auto hidden sm:block"></div>
            {selectedPeriod === 'custom' && (
                <Popover>
                    <PopoverTrigger asChild>
                        <Button variant="ghost" className="text-slate-300 hover:text-white hover:bg-white/5 gap-2 font-normal h-10">
                            <CalendarIcon className="w-4 h-4" />
                            {date?.from ? (date.to ? `${format(date.from, "dd/MM")} - ${format(date.to, "dd/MM")}` : format(date.from, "dd/MM")) : <span>Datas</span>}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 bg-slate-900 border-slate-800" align="center">
                        <Calendar initialFocus mode="range" defaultMonth={date?.from} selected={date} onSelect={setDate} numberOfMonths={1} className="text-slate-200" />
                    </PopoverContent>
                </Popover>
            )}
            <Select value={selectedCriteria} onValueChange={setSelectedCriteria}>
                <SelectTrigger className="w-[180px] bg-transparent border-0 text-slate-300 hover:text-white hover:bg-white/5 h-10"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">{CRITERIA_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
            </Select>
             <div className="w-px h-6 bg-white/10 my-auto hidden sm:block"></div>
             <Select value={selectedStageFilter} onValueChange={setSelectedStageFilter}>
                <SelectTrigger className="w-[180px] bg-transparent border-0 text-slate-300 hover:text-white hover:bg-white/5 h-10"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">{STAGE_FILTER_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
            </Select>
        </div>

        {/* Podium Section */}
        {podium.length > 0 && (
            <div className="flex justify-center items-end gap-2 md:gap-6 mb-16 h-[340px]">
                {podium[1] && <PodiumSpot entry={podium[1]} rank={2} delay="200ms" />}
                {podium[0] && <PodiumSpot entry={podium[0]} rank={1} delay="0ms" />}
                {podium[2] && <PodiumSpot entry={podium[2]} rank={3} delay="400ms" />}
            </div>
        )}

        {/* My Position Card */}
        {loggedInUserRank && (
            <div className="mb-8 animate-in slide-in-from-bottom-4 fade-in duration-700 delay-500">
                <div className="relative overflow-hidden rounded-xl border border-cyan-500/30 bg-gradient-to-r from-cyan-950/40 to-slate-900/40 p-1">
                    <div className="absolute top-0 left-0 w-1 h-full bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.8)]"></div>
                    <div className="flex items-center justify-between p-4 px-6">
                        <div className="flex items-center gap-4">
                            <div className="flex flex-col items-center justify-center w-12">
                                <span className="text-xs text-cyan-400 font-bold uppercase tracking-wider mb-1">Rank</span>
                                <span className="text-2xl font-black text-white">#{loggedInUserRank.rankPosition}</span>
                            </div>
                            <Avatar className="h-12 w-12 border-2 border-cyan-500/50">
                                <AvatarImage src={loggedInUserRank.userPhotoUrl} />
                                <AvatarFallback className="bg-cyan-900 text-cyan-200 font-bold">{loggedInUserRank.userName.substring(0,2).toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <div>
                                <p className="font-bold text-white text-lg">Você</p>
                                <p className="text-cyan-400 text-sm">{loggedInUserRank.mainScoreDisplay}</p>
                            </div>
                        </div>
                        <div className="hidden md:block text-right">
                             <p className="text-xs text-slate-400">Próximo nível</p>
                             <div className="flex items-center gap-1 text-emerald-400 font-bold text-sm">
                                <TrendingUp className="w-3 h-3" /> Continue acelerando
                             </div>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* Full List */}
        <div className="space-y-3 animate-in slide-in-from-bottom-10 fade-in duration-1000 delay-300">
            <h3 className="text-lg font-bold text-slate-400 mb-4 flex items-center gap-2">
                <ListOrdered className="w-5 h-5" /> Classificação Geral
            </h3>
            
            {ranking.length > 0 ? (
                ranking.slice(3).map((entry) => (
                    <RankingRow key={entry.userId} entry={entry} />
                ))
            ) : (
                <div className="text-center py-20 border border-dashed border-slate-800 rounded-2xl">
                    <Filter className="w-12 h-12 text-slate-700 mx-auto mb-4" />
                    <p className="text-slate-500">Nenhum resultado para este filtro.</p>
                </div>
            )}
            
            {ranking.length <= 3 && ranking.length > 0 && (
                <p className="text-center text-slate-600 py-8 text-sm">Apenas os campeões pontuaram neste período.</p>
            )}
        </div>

      </div>
    </div>
  );
}

export default function RankingPage() {
  return (
    <Suspense fallback={<div className="h-screen bg-slate-950 flex items-center justify-center"><Loader2 className="w-10 h-10 text-cyan-500 animate-spin"/></div>}>
      <RankingPageContent />
    </Suspense>
  );
}