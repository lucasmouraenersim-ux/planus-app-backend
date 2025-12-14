
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
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { 
    Award, Filter, Crown, UserCircle, ListOrdered, Zap, Loader2, CalendarIcon, 
    Trophy, TrendingUp, Sparkles, Flame, Star, Hexagon
} from 'lucide-react';
import type { LeadWithId } from '@/types/crm';
import type { FirestoreUser, UserType } from '@/types/user';
import { cn } from "@/lib/utils";

// --- VISUAL ASSETS & EFFECTS ---

// Fundo com Grid em movimento e Luzes
const CinematicBackground = () => (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden bg-[#020617]">
        {/* Grid Pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]"></div>
        
        {/* Spotlights */}
        <div className="absolute top-[-10%] left-[20%] w-[600px] h-[600px] bg-purple-600/10 rounded-full blur-[120px] animate-pulse" style={{ animationDuration: '8s' }} />
        <div className="absolute top-[10%] right-[10%] w-[500px] h-[500px] bg-cyan-600/10 rounded-full blur-[100px] animate-pulse" style={{ animationDuration: '10s' }} />
        <div className="absolute bottom-[-10%] left-[30%] w-[800px] h-[400px] bg-blue-600/10 rounded-full blur-[120px]" />
    </div>
);

// Efeito de partículas de ouro para o #1
const GoldParticles = () => (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {[...Array(8)].map((_, i) => (
            <div 
                key={i} 
                className="absolute w-1 h-1 bg-yellow-300 rounded-full animate-float-up opacity-0"
                style={{
                    left: `${Math.random() * 100}%`,
                    bottom: '-10px',
                    animationDelay: `${Math.random() * 2}s`,
                    animationDuration: `${3 + Math.random() * 2}s`
                }}
            />
        ))}
        <style jsx>{`
            @keyframes float-up {
                0% { transform: translateY(0) scale(0); opacity: 0; }
                50% { opacity: 0.8; }
                100% { transform: translateY(-100px) scale(1); opacity: 0; }
            }
            .animate-float-up { animation: float-up infinite ease-out; }
        `}</style>
    </div>
);

// --- TYPES & CONSTANTS ---

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
  { value: 'monthly_current', label: 'Ciclo Atual' },
  { value: 'all_time', label: 'Todo o Período' },
  { value: 'custom', label: 'Personalizado' },
];

const CRITERIA_OPTIONS = [
  { value: 'totalSalesValue', label: 'Volume (R$)' },
  { value: 'numberOfSales', label: 'Vendas (Qtd)' },
  { value: 'totalKwh', label: 'Energia (kWh)' },
];

const STAGE_FILTER_OPTIONS = [
    { value: 'finalizado', label: 'Finalizados' },
    { value: 'assinado_finalizado', label: 'Assinados + Finalizados' },
];

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

  // --- DATA PROCESSING LOGIC (MANTIDA IGUAL) ---
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
        mainScoreDisplay: selectedCriteria === 'totalSalesValue' ? formatValueForDisplay(metrics.totalSalesValue, 'currency') : (selectedCriteria === 'numberOfSales' ? `${formatValueForDisplay(metrics.numberOfSales, 'plain')}` : formatValueForDisplay(metrics.totalKwh, 'kwh')),
        detailScore1Label: selectedCriteria === 'totalSalesValue' ? "Vendas" : "Volume",
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

  // --- SUB-COMPONENTS ---

  const PodiumCard = ({ entry, rank, delay }: { entry: RankingDisplayEntry, rank: 1 | 2 | 3, delay: string }) => {
    const isGold = rank === 1;
    const isSilver = rank === 2;
    const isBronze = rank === 3;
    
    const config = isGold 
        ? { h: 'h-[360px] md:h-[420px]', w: 'w-full md:w-[320px] z-20', gradient: 'from-yellow-500/20 via-yellow-900/5 to-slate-950', border: 'border-yellow-500', glow: 'shadow-yellow-500/20', text: 'text-yellow-400', ring: 'ring-yellow-400', icon: '👑' }
        : isSilver 
            ? { h: 'h-[300px] md:h-[350px]', w: 'w-full md:w-[280px] z-10 mt-12', gradient: 'from-slate-400/20 via-slate-800/5 to-slate-950', border: 'border-slate-400', glow: 'shadow-slate-400/20', text: 'text-slate-300', ring: 'ring-slate-300', icon: '🥈' }
            : { h: 'h-[280px] md:h-[320px]', w: 'w-full md:w-[280px] z-0 mt-20', gradient: 'from-orange-700/20 via-orange-900/5 to-slate-950', border: 'border-orange-600', glow: 'shadow-orange-600/20', text: 'text-orange-500', ring: 'ring-orange-600', icon: '🥉' };

    return (
        <div className={`relative flex flex-col items-center justify-end ${config.w} ${config.h} group transition-all duration-500 hover:-translate-y-2 animate-in fade-in slide-in-from-bottom-12 fill-mode-both`} style={{ animationDelay: delay }}>
            
            {/* Spotlight behind card */}
            <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[50%] rounded-full blur-[60px] opacity-0 group-hover:opacity-40 transition-opacity duration-700 bg-current ${config.text}`}></div>

            {/* Avatar Floating */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/3 z-30">
                <div className={`relative rounded-full p-1 bg-gradient-to-b from-white/20 to-transparent backdrop-blur-sm ${config.glow} shadow-2xl`}>
                    <Avatar className={`w-24 h-24 md:w-32 md:h-32 border-4 ${config.border} shadow-xl`}>
                        <AvatarImage src={entry.userPhotoUrl} className="object-cover" />
                        <AvatarFallback className="text-2xl font-black bg-slate-900 text-white">{entry.userName.substring(0,2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    {/* Badge Icon */}
                    <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-slate-950 rounded-full flex items-center justify-center text-2xl border border-white/10 shadow-lg animate-bounce" style={{ animationDuration: '3s' }}>
                        {config.icon}
                    </div>
                </div>
            </div>

            {/* Card Body */}
            <div className={`w-full h-full rounded-3xl border-t border-x border-b-0 ${config.border} bg-gradient-to-b ${config.gradient} backdrop-blur-xl flex flex-col items-center pt-24 pb-6 px-4 relative overflow-hidden`}>
                {isGold && <GoldParticles />}
                
                {/* Shine Effect */}
                <div className="absolute inset-0 bg-gradient-to-tr from-white/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

                <div className="text-center z-10 space-y-1">
                    <h3 className="text-2xl font-black text-white uppercase tracking-tight leading-none drop-shadow-md">
                        {entry.userName.split(' ')[0]}
                    </h3>
                    <p className="text-xs font-bold uppercase tracking-widest opacity-60 text-white">
                        {entry.userName.split(' ').slice(1).join(' ')}
                    </p>
                </div>

                <div className="mt-auto w-full text-center z-10">
                    <p className="text-xs text-slate-400 uppercase tracking-widest font-medium mb-1">Performance</p>
                    <div className={`text-2xl md:text-3xl font-black ${config.text} drop-shadow-lg`}>
                        {entry.mainScoreDisplay}
                    </div>
                    
                    {/* Secondary Metrics Pill */}
                    <div className="mt-4 flex justify-center gap-3">
                        {entry.detailScore1Value && (
                            <div className="px-3 py-1 rounded-full bg-black/40 border border-white/5 text-[10px] text-slate-300 backdrop-blur-sm">
                                {entry.detailScore1Label}: <span className="text-white font-bold">{formatValueForDisplay(entry.detailScore1Value, entry.detailScore1Type || 'plain')}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Rank Number Watermark */}
                <div className="absolute bottom-[-20px] left-1/2 -translate-x-1/2 text-[120px] font-black text-white/5 select-none pointer-events-none z-0">
                    {rank}
                </div>
            </div>

            {/* Neon Base */}
            <div className={`absolute bottom-0 w-[80%] h-[2px] ${config.text} bg-current shadow-[0_0_20px_2px_currentColor] rounded-full`}></div>
        </div>
    );
  };

  const RankingRow = ({ entry }: { entry: RankingDisplayEntry }) => {
    const isMe = entry.userId === appUser?.uid;
    return (
        <div className={`group relative flex items-center gap-4 p-4 md:p-5 rounded-2xl border transition-all duration-300 ${isMe ? 'bg-cyan-950/30 border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.1)]' : 'bg-slate-900/40 border-white/5 hover:bg-slate-800/60 hover:border-white/10'}`}>
            <div className="w-10 text-center">
                <span className={`text-xl font-black ${isMe ? 'text-cyan-400' : 'text-slate-600 group-hover:text-white transition-colors'}`}>
                    #{entry.rankPosition}
                </span>
            </div>
            
            <div className="relative">
                <Avatar className={`h-12 w-12 border-2 ${isMe ? 'border-cyan-500' : 'border-slate-700 group-hover:border-slate-500'} transition-colors`}>
                    <AvatarImage src={entry.userPhotoUrl} />
                    <AvatarFallback className="bg-slate-900 text-slate-300 text-xs font-bold">{entry.userName.substring(0,2).toUpperCase()}</AvatarFallback>
                </Avatar>
                {entry.isOuro && <div className="absolute -top-1 -right-1 text-xs bg-yellow-500 text-black rounded-full p-0.5" title="Ouro">💎</div>}
            </div>
            
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <p className={`font-bold truncate text-base ${isMe ? 'text-white' : 'text-slate-300 group-hover:text-white'}`}>
                        {entry.userName}
                    </p>
                    {entry.hasEverHit30kInAMonth && <Flame className="w-4 h-4 text-orange-500 fill-orange-500 animate-pulse" />}
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                     <span className="flex items-center gap-1"><Hexagon className="w-3 h-3"/> {entry.detailScore1Label}: <span className="text-slate-300 font-medium">{formatValueForDisplay(entry.detailScore1Value, entry.detailScore1Type || 'plain')}</span></span>
                     <span className="hidden sm:inline-flex items-center gap-1">• {entry.detailScore2Label}: <span className="text-slate-300 font-medium">{formatValueForDisplay(entry.detailScore2Value, entry.detailScore2Type || 'plain')}</span></span>
                </div>
            </div>
            
            <div className="text-right">
                <p className={`text-lg md:text-xl font-black tracking-tight ${isMe ? 'text-cyan-400' : 'text-white'}`}>
                    {entry.mainScoreDisplay}
                </p>
            </div>
        </div>
    );
  };

  if (isLoading || !appUser) {
    return (
      <div className="flex flex-col justify-center items-center h-screen bg-slate-950 text-cyan-500 relative overflow-hidden">
        <CinematicBackground />
        <div className="relative z-10 flex flex-col items-center">
            <Loader2 className="animate-spin h-14 w-14 mb-4 text-cyan-400 opacity-80" />
            <p className="text-cyan-400/60 animate-pulse tracking-[0.2em] uppercase text-xs font-bold">Calculando Performance...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans relative overflow-x-hidden pb-32 selection:bg-cyan-500/30">
      <CinematicBackground />

      <div className="container max-w-6xl mx-auto px-4 py-8 relative z-10">
        
        {/* HERO SECTION */}
        <div className="text-center mb-12 space-y-4 animate-in fade-in slide-in-from-top-10 duration-1000">
            <div className="inline-flex items-center justify-center p-3 bg-gradient-to-b from-yellow-500/10 to-transparent rounded-2xl border border-yellow-500/20 shadow-[0_0_40px_rgba(234,179,8,0.1)] mb-2 group cursor-default">
                <Trophy className="w-8 h-8 text-yellow-400 group-hover:scale-110 transition-transform duration-300" />
            </div>
            <h1 className="text-5xl md:text-7xl font-black text-white tracking-tighter drop-shadow-2xl">
                Hall da <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 via-yellow-400 to-yellow-600">Fama</span>
            </h1>
            <p className="text-slate-400 max-w-lg mx-auto text-sm md:text-base font-medium">
                Os líderes que estão definindo o futuro da energia na Planus.
            </p>
        </div>

        {/* CONTROLS BAR */}
        <div className="flex flex-wrap gap-2 md:gap-4 justify-center mb-16 animate-in fade-in duration-1000 delay-300">
             <div className="p-1.5 bg-slate-900/60 border border-white/10 rounded-2xl backdrop-blur-xl flex flex-wrap gap-2 shadow-2xl">
                <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                    <SelectTrigger className="w-[140px] md:w-[180px] bg-white/5 border-0 text-slate-200 focus:bg-white/10 h-10 rounded-xl transition-all"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">{PERIOD_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>

                {selectedPeriod === 'custom' && (
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="ghost" className="bg-white/5 border-0 text-slate-200 hover:bg-white/10 h-10 rounded-xl px-4 gap-2">
                                <CalendarIcon className="w-4 h-4 text-cyan-400" />
                                {date?.from ? (date.to ? `${format(date.from, "dd/MM")} - ${format(date.to, "dd/MM")}` : format(date.from, "dd/MM")) : <span>Datas</span>}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 bg-slate-900 border-slate-800" align="center">
                            <Calendar initialFocus mode="range" defaultMonth={date?.from} selected={date} onSelect={setDate} numberOfMonths={1} className="text-slate-200" />
                        </PopoverContent>
                    </Popover>
                )}

                <div className="w-px h-6 bg-white/10 my-auto hidden sm:block"></div>

                <Select value={selectedCriteria} onValueChange={setSelectedCriteria}>
                    <SelectTrigger className="w-[140px] md:w-[180px] bg-white/5 border-0 text-slate-200 focus:bg-white/10 h-10 rounded-xl transition-all"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">{CRITERIA_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>

                <Select value={selectedStageFilter} onValueChange={setSelectedStageFilter}>
                    <SelectTrigger className="w-[140px] md:w-[180px] bg-white/5 border-0 text-slate-200 focus:bg-white/10 h-10 rounded-xl transition-all"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">{STAGE_FILTER_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
            </div>
        </div>

        {/* TEAM TOTAL KPI */}
        <div className="flex justify-center mb-20 animate-in zoom-in duration-700 delay-200">
            <div className="relative group cursor-default">
                <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-500"></div>
                <div className="relative px-8 py-4 bg-slate-950/80 rounded-2xl border border-cyan-500/30 flex items-center gap-5 backdrop-blur-xl">
                    <div className="p-3 bg-cyan-500/10 rounded-xl text-cyan-400">
                        <Zap className="w-6 h-6 fill-current" />
                    </div>
                    <div>
                        <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400 font-bold mb-0.5">Performance do Time</p>
                        <p className="text-3xl font-black text-white tabular-nums tracking-tight">
                            {totalKwhSoldInPeriod.toLocaleString('pt-BR')} <span className="text-lg font-bold text-slate-500">kWh</span>
                        </p>
                    </div>
                </div>
            </div>
        </div>

        {/* PODIUM AREA */}
        {podium.length > 0 && (
            <div className="flex flex-col md:flex-row justify-center items-end gap-6 md:gap-4 mb-24 px-4 min-h-[450px]">
                {/* 2nd Place */}
                <div className="order-2 md:order-1 w-full md:w-auto flex justify-center">
                    {podium[1] && <PodiumCard entry={podium[1]} rank={2} delay="200ms" />}
                </div>
                
                {/* 1st Place */}
                <div className="order-1 md:order-2 w-full md:w-auto flex justify-center -mt-10 md:mt-0 z-20">
                    {podium[0] && <PodiumCard entry={podium[0]} rank={1} delay="0ms" />}
                </div>
                
                {/* 3rd Place */}
                <div className="order-3 md:order-3 w-full md:w-auto flex justify-center">
                    {podium[2] && <PodiumCard entry={podium[2]} rank={3} delay="400ms" />}
                </div>
            </div>
        )}

        {/* LEADERBOARD LIST */}
        <div className="max-w-4xl mx-auto animate-in slide-in-from-bottom-20 fade-in duration-1000 delay-500">
            <div className="flex items-center justify-between mb-6 px-2">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <ListOrdered className="w-5 h-5 text-cyan-500" /> 
                    Ranking Geral
                </h3>
                {loggedInUserRank && (
                    <div className="text-xs font-medium text-slate-400 bg-white/5 px-3 py-1 rounded-full border border-white/5">
                        Sua posição: <span className="text-white font-bold">#{loggedInUserRank.rankPosition}</span>
                    </div>
                )}
            </div>

            <div className="space-y-3">
                {ranking.length > 0 ? (
                    ranking.slice(3).map((entry) => (
                        <RankingRow key={entry.userId} entry={entry} />
                    ))
                ) : (
                    <div className="text-center py-20 border border-dashed border-slate-800 rounded-3xl bg-slate-900/30">
                        <Filter className="w-12 h-12 text-slate-700 mx-auto mb-4" />
                        <p className="text-slate-500 font-medium">Nenhum resultado encontrado.</p>
                    </div>
                )}
                
                {ranking.length <= 3 && ranking.length > 0 && (
                    <div className="text-center py-10">
                        <p className="text-slate-600 text-sm">Apenas o pódio pontuou neste filtro.</p>
                    </div>
                )}
            </div>
        </div>

      </div>
    </div>
  );
}

export default function RankingPage() {
  return (
    <Suspense fallback={
        <div className="h-screen bg-slate-950 flex items-center justify-center">
            <Loader2 className="w-10 h-10 text-cyan-500 animate-spin"/>
        </div>
    }>
      <RankingPageContent />
    </Suspense>
  );
}