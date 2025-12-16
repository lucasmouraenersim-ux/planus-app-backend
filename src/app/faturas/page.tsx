
"use client";

import * as React from "react";
import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  FileText, PlusCircle, Trash2, Upload, Eye, Loader2,
  TrendingUp, TrendingDown, Minus, LayoutGrid, List,
  Map as MapIcon, X, MapPin, LocateFixed, Check, 
  Flame, Lock, Unlock, Coins, Phone, Search, Sun, Zap, MoreHorizontal, ArrowUpRight, Award
} from 'lucide-react';
import { collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc, Timestamp, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { uploadFile } from '@/lib/firebase/storage';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { GoogleMap, useJsApiLoader, OverlayView, HeatmapLayer } from '@react-google-maps/api';
import { unlockContactAction } from '@/actions/unlockContact';
import { TermsModal } from '@/components/TermsModal';
import { CreditPurchaseModal } from '@/components/billing/CreditPurchaseModal';
import { registerInvoiceAction } from '@/actions/registerInvoice';
import { calculateLeadCost, getLeadTierName } from '@/lib/billing/leadPricing';
import { Badge } from "@/components/ui/badge";

// --- CONFIG ---
const libraries: ("visualization" | "places" | "drawing" | "geometry" | "localContext")[] = ["visualization"];
const mapStyles = [
  { elementType: "geometry", stylers: [{ color: "#1e293b" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#1e293b" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#94a3b8" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#334155" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0f172a" }] },
];

// --- TIPOS ---
export type TensaoType = 'baixa' | 'alta' | 'b_optante' | 'baixa_renda';
export type FaturaStatus = 'Nenhum' | 'Contato?' | 'Proposta' | 'Fechamento' | 'Fechado';

export interface UnidadeConsumidora {
  id: string;
  consumoKwh: string;
  valorTotal?: string;
  mediaConsumo?: string;
  temGeracao: boolean;
  arquivoFaturaUrl: string | null;
  nomeArquivo: string | null;
  endereco?: string;
  cidade?: string;
  estado?: string;
  latitude?: number;
  longitude?: number;
  tarifaUnit?: string;        
  injetadaMUC?: string;       
  injetadaOUC?: string;       
  gdEligibility?: 'elegivel' | 'inelegivel' | 'oportunidade' | 'padrao';
}

export interface FaturaCliente {
  id: string;
  nome: string;
  tipoPessoa: 'pf' | 'pj';
  tensao: TensaoType;
  unidades: UnidadeConsumidora[];
  contatos: { id: string, nome: string, telefone: string, email?: string }[];
  status?: FaturaStatus;
  feedbackNotes?: string;
  isUnlocked?: boolean; 
  unlockedLeads?: string[];
  credits?: number;
  createdAt: string | Timestamp; 
}

// --- HELPERS ---
const formatKwh = (val: string | number) => {
    const num = Number(val);
    if (!num) return '0';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
    return num.toString();
};

const getStatusStyle = (status?: FaturaStatus) => {
  switch (status) {
    case 'Contato?': return { badge: 'bg-sky-500/10 text-sky-400 border-sky-500/20', border: 'border-l-sky-500' };
    case 'Proposta': return { badge: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20', border: 'border-l-indigo-500' };
    case 'Fechamento': return { badge: 'bg-purple-500/10 text-purple-400 border-purple-500/20', border: 'border-l-purple-500' };
    case 'Fechado': return { badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', border: 'border-l-emerald-500' };
    default: return { badge: 'bg-slate-800 text-slate-400 border-slate-700', border: 'border-l-transparent' };
  }
};

const getTensaoColors = (tensao: TensaoType) => {
  switch (tensao) {
    case 'alta': return { gradient: 'from-blue-600 to-cyan-400', text: 'text-blue-400', bg: 'bg-blue-500', pinColor: 'bg-blue-600' };
    case 'baixa': return { gradient: 'from-emerald-500 to-teal-400', text: 'text-emerald-400', bg: 'bg-emerald-500', pinColor: 'bg-emerald-600' };
    case 'b_optante': return { gradient: 'from-orange-500 to-amber-400', text: 'text-orange-400', bg: 'bg-orange-500', pinColor: 'bg-orange-600' };
    case 'baixa_renda': return { gradient: 'from-yellow-500 to-lime-400', text: 'text-yellow-400', bg: 'bg-yellow-500', pinColor: 'bg-yellow-600' };
    default: return { gradient: 'from-slate-500 to-slate-400', text: 'text-slate-400', bg: 'bg-slate-500', pinColor: 'bg-slate-600' };
  }
};

// --- KPI CARD ---
const KPICard = ({ title, value, unit, color, icon: Icon, trend, trendValue }: any) => {
  const styles = getTensaoColors(color === 'blue' ? 'alta' : color === 'emerald' ? 'baixa' : color === 'orange' ? 'b_optante' : 'baixa_renda');
  return (
    <div className={`bg-slate-900/40 border border-white/5 p-6 rounded-2xl relative overflow-hidden group hover:border-${color}-500/30 transition-all`}>
      <div className={`absolute top-0 right-0 p-16 ${styles.bg} opacity-5 blur-[60px] rounded-full`}></div>
      <div className="relative z-10">
        <div className="flex justify-between items-start mb-4">
            <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">{title}</p>
                <h3 className="text-3xl font-black text-white">{value.toLocaleString('pt-BR')} <span className="text-sm font-medium text-slate-500">{unit}</span></h3>
            </div>
            <div className={`p-2.5 rounded-xl bg-white/5 border border-white/5 ${styles.text}`}><Icon className="w-6 h-6" /></div>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
            {trend === 'up' ? <ArrowUpRight className="w-4 h-4 text-emerald-400" /> : <Minus className="w-4 h-4 text-slate-500" />}
            <span className={trend === 'up' ? 'text-emerald-400 font-bold' : 'text-slate-400'}>{trendValue}</span> vs mês anterior
        </div>
      </div>
    </div>
  );
};

export default function FaturasPage() {
  const { toast } = useToast();
  const [clientes, setClientes] = useState<FaturaCliente[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { appUser, updateAppUser } = useAuth();
  
  // UI States
  const [isCreditModalOpen, setIsCreditModalOpen] = useState(false);
  const [selectedClienteId, setSelectedClienteId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'kanban' | 'map'>('list');
  const [mapLayer, setMapLayer] = useState<'pins' | 'heat'>('pins');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTensao, setFilterTensao] = useState<TensaoType | 'all'>('all');
  const [filterCidade, setFilterCidade] = useState<string>('all');
  const [loadingUnlock, setLoadingUnlock] = useState<string | null>(null);

  const { isLoaded: isMapLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || '',
    libraries,
  });

  // Load Data
  useEffect(() => {
    const q = query(collection(db, 'faturas_clientes'), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setClientes(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any)));
      setIsLoading(false);
    });
    return () => unsub();
  }, []);

  const handleUnlockLead = async (clienteId: string) => {
      if (!appUser) return;
      setLoadingUnlock(clienteId);

      const result = await unlockContactAction(appUser.uid, clienteId);

      if (result.success) {
          if (result.alreadyUnlocked !== true) {
            const lead = clientes.find(c => c.id === clienteId);
            const cost = calculateLeadCost(Number(lead?.unidades?.[0]?.consumoKwh || 0));
            updateAppUser({ 
                credits: (appUser.credits || 0) - cost, 
                unlockedLeads: [...(appUser.unlockedLeads || []), clienteId] 
            });
          }
          setClientes(prev => prev.map(c => c.id === clienteId ? { ...c, isUnlocked: true } : c));
          toast({ title: "Sucesso", description: result.message, className: "bg-emerald-500 text-white" });
      } else {
          toast({ title: "Erro", description: result.message, variant: "destructive" });
          if(result.code === 'no_credits') {
            setIsCreditModalOpen(true);
          }
      }
      setLoadingUnlock(null);
  };
  
  const handleManualGeocode = async (clienteId: string, unidadeId: string, address: string) => {
    if(!address || !process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY) return;
    toast({ title: "Buscando...", description: "Consultando Google Maps..." });
    try {
        const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY}`);
        const data = await response.json();
        if(data.results && data.results.length > 0) {
            const loc = data.results[0].geometry.location;
            const cliente = clientes.find(c => c.id === clienteId);
            if(!cliente) return;
            const novasUnidades = cliente.unidades.map(u => u.id === unidadeId ? { ...u, latitude: loc.lat, longitude: loc.lng, endereco: address } : u);
            await updateDoc(doc(db, 'faturas_clientes', clienteId), { unidades: novasUnidades });
            toast({ title: "Encontrado!", description: "Localização atualizada." });
        } else { toast({ title: "Não encontrado", variant: "destructive" }); }
    } catch(e) { toast({ title: "Erro", variant: "destructive" }); }
  };

  const handleAddCliente = async () => {
    try {
        const docRef = await addDoc(collection(db, 'faturas_clientes'), {
            nome: 'Novo Lead', tipoPessoa: 'pj', tensao: 'baixa',
            unidades: [{ id: crypto.randomUUID(), consumoKwh: '', temGeracao: false, arquivoFaturaUrl: null }],
            contatos: [{ id: crypto.randomUUID(), nome: 'Decisor', telefone: '(65) 99999-8888', email: 'contato@empresa.com' }],
            createdAt: Timestamp.now(), status: 'Nenhum', isUnlocked: false
        });
        setSelectedClienteId(docRef.id);
    } catch(e) { toast({ title: "Erro", variant: "destructive" }); }
  };

  const handleUpdateField = async (id: string, field: string, value: any) => {
      await updateDoc(doc(db, 'faturas_clientes', id), { [field]: value, lastUpdatedAt: Timestamp.now() });
  };

  const handleFileUpload = async (clienteId: string, unidadeId: string | null, file: File | null) => {
    if (!file || !appUser) return;
    toast({ title: "🤖 Analisando Fatura...", description: "IA identificando consumo, tarifas e GD..." });
    
    try {
        const formData = new FormData(); formData.append('file', file);
        const res = await fetch('/api/process-fatura', { method: 'POST', body: formData });
        let dadosIA: any = {};
        
        if (res.ok) {
            dadosIA = await res.json();
            if (dadosIA.gdEligibility === 'inelegivel') toast({ title: "Atenção: GD Existente", description: "Cliente já gera energia e sobra pouco saldo.", variant: "destructive", duration: 6000 });
            else if (dadosIA.gdEligibility === 'oportunidade') toast({ title: "Oportunidade GD (oUC)", description: "Cliente recebe energia de fora. Pode migrar.", className: "bg-blue-600 text-white", duration: 6000 });
            else if (dadosIA.gdEligibility === 'elegivel') toast({ title: "Lead Qualificado!", description: "Mesmo com GD, sobra saldo para vender!", className: "bg-emerald-600 text-white", duration: 6000 });

            if (dadosIA.tensaoType) {
                await updateDoc(doc(db, 'faturas_clientes', clienteId), { tensao: dadosIA.tensaoType });
                toast({ title: "Classificação Atualizada", description: `IA detectou: ${dadosIA.tensaoType.toUpperCase().replace('_', ' ')}` });
            }
        }

        const path = `faturas/${clienteId}/${unidadeId}/${file.name}`;
        const url = await uploadFile(file, path);

        if (unidadeId) {
            const cliente = clientes.find(c => c.id === clienteId);
            if (!cliente) return;
            
            const safeStr = (val: any) => (val !== undefined && val !== null) ? String(val) : '';
            const novasUnidades = cliente.unidades.map(u => u.id === unidadeId ? { ...u, arquivoFaturaUrl: url, nomeArquivo: file.name, consumoKwh: safeStr(dadosIA.consumoKwh) || u.consumoKwh || '', valorTotal: safeStr(dadosIA.valorTotal) || u.valorTotal || '', mediaConsumo: safeStr(dadosIA.mediaConsumo) || u.mediaConsumo || '', tarifaUnit: safeStr(dadosIA.unitPrice) || u.tarifaUnit || '', injetadaMUC: safeStr(dadosIA.injectedEnergyMUC) || u.injetadaMUC || '', injetadaOUC: safeStr(dadosIA.injectedEnergyOUC) || u.injetadaOUC || '', gdEligibility: dadosIA.gdEligibility || u.gdEligibility || 'padrao', endereco: safeStr(dadosIA.enderecoCompleto) || u.endereco || '', cidade: safeStr(dadosIA.cidade) || u.cidade || '', estado: safeStr(dadosIA.estado) || u.estado || '', latitude: dadosIA.latitude ?? u.latitude ?? null, longitude: dadosIA.longitude ?? u.longitude ?? null } : u);

            await updateDoc(doc(db, 'faturas_clientes', clienteId), { unidades: novasUnidades });
            const updates: any = {};
            const isNewLead = cliente.nome === 'Novo Lead' || cliente.nome === 'Novo Cliente';
            if (isNewLead && dadosIA.nomeCliente) updates.nome = dadosIA.nomeCliente;
            if (Object.keys(updates).length > 0) await updateDoc(doc(db, 'faturas_clientes', clienteId), updates);
            await registerInvoiceAction({ leadId: clienteId, leadName: updates.nome || cliente.nome, isNewLead, unidades: novasUnidades, user: { uid: appUser!.uid, name: appUser!.displayName || 'Usuário', role: appUser!.type }, aiData: dadosIA });
            toast({ title: "Sucesso!", description: "Dados atualizados com inteligência." });
        }
    } catch(e: any) { console.error(e); toast({ title: "Erro", description: "Falha no processo.", variant: "destructive" }); }
  };

  const { filteredClientes, kpiData, cidadesDisponiveis } = useMemo(() => {
    let result = [...clientes];
    const totals = { alta: 0, baixa: 0, b_optante: 0, baixa_renda: 0 };
    const cidades = new Set<string>();

    clientes.forEach(c => {
        c.unidades.forEach(u => {
             if(u.cidade) cidades.add(u.cidade);
             const consumoBruto = Number(u.consumoKwh) || 0;
             const injetadaMUC = Number(u.injetadaMUC) || 0;
             const consumoLiquido = Math.max(0, consumoBruto - injetadaMUC);
             if (totals[c.tensao] !== undefined) totals[c.tensao] += consumoLiquido;
        });
    });

    if (searchTerm) result = result.filter(c => c.nome.toLowerCase().includes(searchTerm.toLowerCase()));
    if (filterTensao !== 'all') result = result.filter(c => c.tensao === filterTensao);
    if (filterCidade !== 'all') result = result.filter(c => c.unidades.some(u => u.cidade === filterCidade));

    return { filteredClientes: result, kpiData: totals, cidadesDisponiveis: Array.from(cidades) };
  }, [clientes, searchTerm, filterTensao, filterCidade]);

  const heatmapData = useMemo(() => {
    if (!isMapLoaded || !window.google) return [];
    return filteredClientes.flatMap(c => c.unidades.filter(u => u.latitude && u.longitude).map(u => ({ location: new window.google.maps.LatLng(u.latitude!, u.longitude!), weight: Number(u.consumoKwh) || 1 })));
  }, [filteredClientes, isMapLoaded]);

  const selectedCliente = useMemo(() => clientes.find(c => c.id === selectedClienteId), [clientes, selectedClienteId]);
  const canSeeEverything = appUser?.type === 'superadmin' || appUser?.type === 'admin' || appUser?.type === 'advogado';
  const currentBalance = appUser?.credits || 0;

  if (isLoading) return <div className="h-screen bg-slate-950 flex items-center justify-center"><Loader2 className="animate-spin text-cyan-500 w-10 h-10" /></div>;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-300 font-sans relative overflow-hidden">
      <TermsModal />
      <CreditPurchaseModal isOpen={isCreditModalOpen} onClose={() => setIsCreditModalOpen(false)} />
      <style jsx global>{` .glass-panel { background: rgba(15, 23, 42, 0.6); backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.05); } ::-webkit-scrollbar { width: 6px; } ::-webkit-scrollbar-thumb { background: #334155; border-radius: 3px; } `}</style>

      <header className="h-20 shrink-0 flex items-center justify-between px-8 border-b border-white/5 bg-slate-900/50 backdrop-blur-md">
          <div className="flex items-center gap-3"><div className="p-2 bg-gradient-to-tr from-cyan-500 to-blue-600 rounded-lg shadow-lg"><FileText className="h-5 w-5 text-white" /></div><h2 className="text-xl font-bold text-white">Faturas Inteligentes</h2></div>
          <div className="flex items-center gap-6">
             <button onClick={() => setIsCreditModalOpen(true)} className="hidden md:flex items-center gap-2 bg-slate-800/80 px-4 py-2 rounded-full border border-yellow-500/20 shadow-lg shadow-yellow-900/10 hover:bg-slate-800 hover:border-yellow-500/50 hover:scale-105 transition-all group">
                <Coins className="w-4 h-4 text-yellow-400 group-hover:animate-bounce" />
                <span className="text-sm font-bold text-yellow-100">{canSeeEverything ? "Ilimitado" : `${currentBalance} Créditos`}</span>
                {!canSeeEverything && <PlusCircle className="w-4 h-4 text-yellow-500 ml-1" />}
             </button>
             <div className={`relative transition-all duration-300 ${searchOpen ? 'w-64' : 'w-10'}`}><button onClick={() => setSearchOpen(!searchOpen)} className="absolute left-0 top-0 h-10 w-10 flex items-center justify-center text-slate-400 hover:text-white"><Search className="w-5 h-5" /></button><Input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Buscar..." className={`h-10 bg-slate-800/80 border-white/10 rounded-full pl-10 pr-4 text-sm text-white ${searchOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} /></div>
          </div>
      </header>

      <div className="p-6 pb-20 overflow-y-auto h-[calc(100vh-80px)]">
         <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <KPICard title="Baixa Tensão" value={kpiData.baixa} unit="kWh" color="emerald" icon={Sun} trend="up" trendValue="+8%" />
            <KPICard title="Alta Tensão" value={kpiData.alta} unit="kWh" color="blue" icon={Zap} trend="stable" trendValue="0%" />
            <KPICard title="B Optante" value={kpiData.b_optante} unit="kWh" color="orange" icon={Flame} trend="up" trendValue="+3%" />
            <KPICard title="Baixa Renda" value={kpiData.baixa_renda} unit="kWh" color="yellow" icon={Minus} trend="down" trendValue="-1%" />
         </div>
         <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
            <div className="flex items-center gap-2">
                <div className="bg-slate-900/50 p-1.5 rounded-xl border border-white/5 backdrop-blur-sm flex"><button onClick={() => setViewMode('list')} className={`p-2 rounded-lg ${viewMode === 'list' ? 'bg-cyan-600 text-white' : 'text-slate-500'}`}><List className="w-4 h-4" /></button><button onClick={() => setViewMode('kanban')} className={`p-2 rounded-lg ${viewMode === 'kanban' ? 'bg-cyan-600 text-white' : 'text-slate-500'}`}><LayoutGrid className="w-4 h-4" /></button><button onClick={() => setViewMode('map')} className={`p-2 rounded-lg ${viewMode === 'map' ? 'bg-cyan-600 text-white' : 'text-slate-500'}`}><MapIcon className="w-4 h-4" /></button></div>
                <Select value={filterTensao} onValueChange={(v:any) => setFilterTensao(v)}><SelectTrigger className="w-[140px] h-10 bg-slate-900/50 border-white/10 text-xs text-slate-300"><SelectValue placeholder="Tensão" /></SelectTrigger><SelectContent className="bg-slate-900 border-slate-800 text-slate-300"><SelectItem value="all">Todas</SelectItem>{TENSAO_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select>
                <Select value={filterCidade} onValueChange={setFilterCidade}><SelectTrigger className="w-[140px] h-10 bg-slate-900/50 border-white/10 text-xs text-slate-300"><SelectValue placeholder="Cidades" /></SelectTrigger><SelectContent className="bg-slate-900 border-slate-800 text-slate-300"><SelectItem value="all">Todas</SelectItem>{cidadesDisponiveis.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
            </div>
            <Button onClick={handleAddCliente} className="bg-cyan-600 hover:bg-cyan-500 text-white h-10 px-6 shadow-lg"><PlusCircle className="w-4 h-4 mr-2" /> Novo Lead</Button>
         </div>
         {viewMode === 'list' && (
            <div className="glass-panel rounded-2xl overflow-hidden animate-in fade-in duration-500">
               <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-900/50 text-xs uppercase text-slate-500 font-bold border-b border-white/5">
                     <tr><th className="p-5">Cliente</th><th className="p-5">Consumo Líquido</th><th className="p-5">Local</th><th className="p-5">Status</th><th className="p-5 text-right"></th></tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                     {filteredClientes.map((c) => {
                        const total = c.unidades.reduce((acc, u) => acc + Math.max(0, (Number(u.consumoKwh)||0) - (Number(u.injetadaMUC)||0)), 0);
                        const style = getTensaoColors(c.tensao);
                        return (
                           <tr key={c.id} onClick={() => setSelectedClienteId(c.id)} className={`group hover:bg-white/[0.02] cursor-pointer border-l-[3px] ${getStatusStyle(c.status).border} ${selectedClienteId === c.id ? 'bg-white/[0.03]' : ''}`}>
                              <td className="p-5"><div className="flex items-center gap-4"><div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${style.gradient} flex items-center justify-center text-white font-bold shadow-lg text-sm`}>{c.nome.substring(0, 1).toUpperCase()}</div><div><p className="font-semibold text-white text-sm">{c.nome}</p><span className="text-[10px] px-1.5 rounded bg-slate-800 text-slate-400 border border-slate-700 uppercase">{c.tipoPessoa}</span></div></div></td>
                              <td className="p-5"><div className="flex flex-col gap-1"><span className="text-white font-medium text-sm">{total.toLocaleString('pt-BR')} kWh</span><div className="w-24 h-1 bg-slate-800 rounded-full overflow-hidden"><div className={`h-full rounded-full bg-gradient-to-r ${style.gradient}`} style={{width: `${Math.min(total/500, 100)}%`}}></div></div></div></td>
                              <td className="p-5"><div className="flex items-center gap-2 text-slate-400 text-xs"><MapPin className="w-3 h-3" /> {c.unidades[0]?.cidade || '-'}</div></td>
                              <td className="p-5"><span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusStyle(c.status).badge}`}>{c.status || 'Nenhum'}</span></td>
                              <td className="p-5 text-right"><Button variant="ghost" size="icon" className="text-slate-500 hover:text-white"><MoreHorizontal className="w-4 h-4" /></Button></td>
                           </tr>
                        );
                     })}
                  </tbody>
               </table>
            </div>
         )}
         {viewMode === 'map' && (
             <div className="w-full h-[650px] bg-slate-900 rounded-2xl border border-white/10 overflow-hidden relative animate-in fade-in duration-500 shadow-2xl">
                <div className="absolute top-4 right-4 z-10 bg-slate-900/90 backdrop-blur p-1 rounded-lg border border-white/10 flex gap-1 shadow-xl"><button onClick={() => setMapLayer('pins')} className={`px-3 py-1.5 rounded text-xs font-medium flex items-center gap-2 ${mapLayer === 'pins' ? 'bg-cyan-600 text-white' : 'text-slate-400'}`}>Pinos</button><button onClick={() => setMapLayer('heat')} className={`px-3 py-1.5 rounded text-xs font-medium flex items-center gap-2 ${mapLayer === 'heat' ? 'bg-orange-600 text-white' : 'text-slate-400'}`}>Calor</button></div>
                {isMapLoaded ? <GoogleMap mapContainerStyle={{ width: '100%', height: '100%' }} center={{ lat: -15.601, lng: -56.097 }} zoom={11} options={{ styles: mapStyles, disableDefaultUI: true }}>{mapLayer === 'heat' && (<HeatmapLayer data={heatmapData} options={{ radius: 40, opacity: 0.8 }} />)}{mapLayer === 'pins' && filteredClientes.map(c => { const uc = c.unidades.find(u => u.latitude && u.longitude); if (!uc?.latitude) return null; const style = getTensaoColors(c.tensao); const isUnlocked = c.isUnlocked || (appUser && appUser.unlockedLeads?.includes(c.id)) || canSeeEverything; const pinClass = isUnlocked ? style.pinColor : 'bg-slate-600'; return (<OverlayView key={c.id} position={{ lat: uc.latitude, lng: uc.longitude! }} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}><div className="absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer group z-10 hover:z-50" onClick={() => setSelectedClienteId(c.id)}><div className={`flex items-center justify-center rounded-full border-2 border-white/80 shadow-2xl transition-all duration-300 group-hover:scale-125 ${pinClass}`} style={{ width: `32px`, height: `32px` }}><span className="text-[8px] font-bold text-white drop-shadow-md">{formatKwh(Number(uc.consumoKwh))}</span></div></div></OverlayView>);})}</GoogleMap> : <div className="flex items-center justify-center h-full text-slate-500"><Loader2 className="animate-spin w-8 h-8 mr-2 text-cyan-500" /></div>}
             </div>
         )}
         {viewMode === 'kanban' && (
            <div className="flex gap-4 overflow-x-auto pb-4 h-full animate-in fade-in duration-500">
               {['Nenhum', 'Contato?', 'Proposta', 'Fechamento', 'Fechado'].map(status => (
                  <div key={status} className="min-w-[300px] bg-slate-900/40 rounded-2xl border border-white/5 p-4 flex flex-col gap-4 backdrop-blur-sm">
                     <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase px-1"><span className="flex items-center gap-2"><div className={`w-2 h-2 rounded-full ${getStatusStyle(status as FaturaStatus).border.replace('border-l-', 'bg-')}`}></div>{status}</span><span className="bg-slate-800 px-2 py-0.5 rounded-full text-white font-mono">{filteredClientes.filter(c => (c.status||'Nenhum') === status).length}</span></div>
                     <div className="flex-1 space-y-3 overflow-y-auto pr-1 custom-scrollbar">
                        {filteredClientes.filter(c => (c.status||'Nenhum') === status).map(c => {
                           const total = c.unidades.reduce((acc, u) => acc + Math.max(0, (Number(u.consumoKwh)||0) - (Number(u.injetadaMUC)||0)), 0);
                           const kwh = Number(c.unidades[0]?.consumoKwh || 0);
                           const cost = calculateLeadCost(kwh);
                           const tierName = getLeadTierName(cost);
                           const { color, border, bg } = cost <= 2 ? { color: "text-slate-400", border: "border-slate-700", bg: "bg-slate-800" } : cost <= 4 ? { color: "text-cyan-400", border: "border-cyan-800", bg: "bg-cyan-950/30" } : cost <= 6 ? { color: "text-purple-400", border: "border-purple-800", bg: "bg-purple-950/30" } : { color: "text-amber-400", border: "border-amber-600", bg: "bg-amber-950/30" };
                           return (
                               <div key={c.id} onClick={() => setSelectedClienteId(c.id)} className={`relative border p-4 rounded-xl transition-all hover:shadow-lg ${border} ${bg} hover:border-opacity-100 border-opacity-50 cursor-pointer group`}>
                                 {cost >= 8 && (<div className="absolute -top-3 left-4 bg-amber-500 text-black text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-md"><Award className="w-3 h-3" /> {tierName}</div>)}
                                 <div className="flex justify-between items-start mb-4 mt-1">
                                  <div className="overflow-hidden"><h3 className="font-bold text-white text-lg truncate" title={c.nome}>{c.nome}</h3><div className="flex items-center gap-2 mt-1"><span className={`text-xs font-mono px-2 py-0.5 rounded border ${border} ${color} bg-black/20 flex items-center gap-1`}><Zap className="w-3 h-3" />{total.toLocaleString('pt-BR')} kWh</span></div></div>
                                  {(c.isUnlocked || (appUser && (appUser.unlockedLeads?.includes(c.id))) || canSeeEverything) ? <Unlock className="w-4 h-4 text-emerald-500"/> : <Lock className="w-4 h-4 text-slate-600"/>}
                                 </div>
                                 {!((c.isUnlocked || (appUser && (appUser.unlockedLeads?.includes(c.id))) || canSeeEverything)) && (
                                     <Button onClick={(e) => { e.stopPropagation(); handleUnlockLead(c.id); }} disabled={loadingUnlock === c.id} className="w-full h-8 text-xs bg-slate-700 hover:bg-cyan-600 text-white hover:shadow-cyan-500/20">{loadingUnlock === c.id ? <Loader2 className="w-4 h-4 animate-spin"/> : <><Lock className="w-3 h-3 mr-1.5"/> Desbloquear ({cost} Crédito{cost > 1 ? 's' : ''})</>}</Button>
                                 )}
                               </div>
                           );
                        })}
                     </div>
                  </div>
               ))}
            </div>
         )}
      </div>

      {selectedClienteId && selectedCliente && (
         <div className="fixed inset-0 z-50 flex justify-end">
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity" onClick={() => setSelectedClienteId(null)}></div>
            <div className="relative w-full max-w-xl h-full bg-slate-900 border-l border-white/10 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
               <div className="px-6 py-6 border-b border-white/5 flex justify-between items-start bg-slate-800/50">
                  <div className="flex-1 mr-4">
                      <h2 className="text-xl font-bold text-white mb-2">{selectedCliente.nome}</h2>
                      <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded bg-slate-700 text-xs text-slate-300 border border-slate-600 uppercase">{selectedCliente.tipoPessoa}</span>
                          <Select value={selectedCliente.tensao} onValueChange={(v: TensaoType) => handleUpdateField(selectedCliente.id, 'tensao', v)}><SelectTrigger className="h-6 w-[120px] text-[10px] bg-slate-800 border-white/10 text-white"><SelectValue /></SelectTrigger><SelectContent className="bg-slate-900 border-slate-800 text-slate-300">{TENSAO_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select>
                      </div>
                  </div>
                  <button onClick={() => setSelectedClienteId(null)} className="text-slate-400 hover:text-white p-2 hover:bg-white/10 rounded-lg"><X className="w-5 h-5" /></button>
               </div>
               <div className="flex-1 overflow-y-auto p-6 space-y-8">
                  {/* UNLOCK LOGIC */}
                  {((selectedCliente.isUnlocked || (appUser && appUser.unlockedLeads?.includes(selectedCliente.id))) || canSeeEverything) ? (
                      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8">
                          {/* Contact Info */}
                          <div className="bg-slate-800/30 p-5 rounded-xl border border-white/5 relative overflow-hidden">
                              <div className="flex items-center justify-between mb-4"><h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2"><Phone className="w-4 h-4" /> Contatos</h3></div>
                              <div className="space-y-3">
                                  {selectedCliente.contatos?.map((ct, idx) => (
                                      <div key={idx} className="bg-slate-900 p-3 rounded-lg border border-white/5 flex justify-between items-center">
                                          <div><div className="text-white font-medium">{ct.nome}</div><div className="text-sm text-cyan-400">{ct.telefone}</div></div>
                                          <a href={`https://wa.me/55${ct.telefone.replace(/\D/g,'')}`} target="_blank" className="p-2 bg-emerald-600 hover:bg-emerald-500 rounded-full text-white"><Phone className="w-4 h-4" /></a>
                                      </div>
                                  ))}
                              </div>
                          </div>
                          {/* Performance Graph */}
                          {(() => { const uc = selectedCliente.unidades[0]; const consumo = Number(uc?.consumoKwh || 0); const media = Number(uc?.mediaConsumo || 0); if(consumo > 0 && media > 0) { const diff = consumo - media; const pct = ((diff/media)*100).toFixed(1); const isHigh = diff > 0; return (<div className="bg-slate-800/40 p-5 rounded-xl border border-white/5 relative overflow-hidden"><div className="absolute top-0 right-0 p-4 opacity-5"><Zap className="w-24 h-24" /></div><div className="flex justify-between items-center mb-4 relative z-10"><span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Performance de Consumo</span><span className={`text-xs font-bold px-2 py-1 rounded-lg flex items-center gap-1 border ${isHigh ? 'text-red-400 bg-red-500/10 border-red-500/20' : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'}`}>{isHigh ? <TrendingUp className="w-3 h-3"/> : <TrendingDown className="w-3 h-3"/>} {Math.abs(Number(pct))}% {isHigh ? 'Acima' : 'Abaixo'} da média</span></div><div className="flex justify-between items-end text-xs text-slate-400 mb-1 relative z-10"><span>Média: {media.toLocaleString()} kWh</span><span className="text-white font-bold text-lg">{consumo.toLocaleString()} <small className="text-slate-500 font-normal">kWh Atual</small></span></div><div className="h-2 w-full bg-slate-700 rounded-full mt-2 overflow-hidden relative z-10"><div className={`h-full ${isHigh ? 'bg-gradient-to-r from-orange-500 to-red-500' : 'bg-gradient-to-r from-emerald-500 to-teal-500'}`} style={{width: `${Math.min((consumo/(media*1.5))*100, 100)}%`}}></div></div></div>) } return null; })()}
                          {/* Consumer Units */}
                          <div className="space-y-4">
                              <div className="flex justify-between items-center border-b border-white/5 pb-2"><h3 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2"><Zap className="w-4 h-4" /> Unidades Consumidoras</h3><Button size="sm" variant="ghost" className="h-6 text-xs text-cyan-500 hover:text-cyan-400" onClick={() => { const n = [...selectedCliente.unidades, { id: crypto.randomUUID(), consumoKwh: '', temGeracao: false, arquivoFaturaUrl: null, nomeArquivo: null }]; handleUpdateField(selectedCliente.id, 'unidades', n); }}>+ Adicionar UC</Button></div>
                              {selectedCliente.unidades.map((uc, i) => (
                                  <div key={uc.id} className="bg-slate-800/30 p-4 rounded-xl border border-white/5 hover:border-white/10 transition-all group">
                                      <div className="flex justify-between mb-4"><span className="text-xs font-bold bg-slate-700 px-2 py-0.5 rounded text-white">UC {i+1}</span>{selectedCliente.unidades.length > 1 && <button onClick={() => { const n = selectedCliente.unidades.filter(u => u.id !== uc.id); handleUpdateField(selectedCliente.id, 'unidades', n); }} className="text-slate-600 hover:text-red-400"><Trash2 className="w-4 h-4"/></button>}</div>
                                      <div className="grid grid-cols-2 gap-3 mb-3"><div><Label className="text-[10px] text-slate-500 uppercase">Consumo (kWh)</Label><Input placeholder="0" defaultValue={uc.consumoKwh} className="h-9 bg-slate-900/50 border-white/10 text-white font-mono" onBlur={e => {const n=[...selectedCliente.unidades];n[i].consumoKwh=e.target.value;handleUpdateField(selectedCliente.id,'unidades',n)}} /></div><div><Label className="text-[10px] text-slate-500 uppercase">Média Histórica</Label><Input placeholder="0" defaultValue={uc.mediaConsumo} className="h-9 bg-slate-900/50 border-white/10 text-slate-400 font-mono" onBlur={e => {const n=[...selectedCliente.unidades];n[i].mediaConsumo=e.target.value;handleUpdateField(selectedCliente.id,'unidades',n)}} /></div></div>
                                      <div className="bg-black/20 p-3 rounded-lg mb-3 border border-white/5"><p className="text-[10px] text-cyan-500 font-bold uppercase mb-2 flex items-center gap-1"><Sun className="w-3 h-3"/> Dados Técnicos (IA)</p><div className="grid grid-cols-3 gap-2"><div><Label className="text-[9px] text-slate-500">Tarifa Unit.</Label><Input placeholder="0.00" defaultValue={uc.tarifaUnit} className="h-8 text-xs bg-slate-800 border-white/5 text-white" onBlur={e => {const n=[...selectedCliente.unidades];n[i].tarifaUnit=e.target.value;handleUpdateField(selectedCliente.id,'unidades',n)}} /></div><div><Label className="text-[9px] text-slate-500">Injetada mUC</Label><Input placeholder="0" defaultValue={uc.injetadaMUC} className="h-8 text-xs bg-slate-800 border-white/5 text-white" onBlur={e => {const n=[...selectedCliente.unidades];n[i].injetadaMUC=e.target.value;handleUpdateField(selectedCliente.id,'unidades',n)}} /></div><div><Label className="text-[9px] text-slate-500">Injetada oUC</Label><Input placeholder="0" defaultValue={uc.injetadaOUC} className="h-8 text-xs bg-slate-800 border-white/5 text-white" onBlur={e => {const n=[...selectedCliente.unidades];n[i].injetadaOUC=e.target.value;handleUpdateField(selectedCliente.id,'unidades',n)}} /></div></div></div>
                                      <div className="flex gap-2 mb-3"><div className="flex-1"><Input placeholder="Endereço Completo..." defaultValue={uc.endereco} className="h-9 bg-slate-900/50 border-white/10 text-xs text-white" onBlur={e => {const n=[...selectedCliente.unidades];n[i].endereco=e.target.value;handleUpdateField(selectedCliente.id,'unidades',n)}} /></div><Button size="sm" variant="secondary" className="h-9 bg-slate-700 hover:bg-slate-600 text-slate-200" onClick={() => handleManualGeocode(selectedCliente.id, uc.id, uc.endereco || '')} title="Buscar Coordenadas"><LocateFixed className="w-4 h-4" /></Button></div>
                                      <label className={`flex items-center justify-center w-full py-3 border border-dashed rounded-lg cursor-pointer transition-all ${uc.arquivoFaturaUrl ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-400' : 'border-slate-600 hover:border-cyan-500 hover:bg-slate-800 text-slate-400'}`}>{uc.arquivoFaturaUrl ? <Check className="w-4 h-4 mr-2" /> : <Upload className="w-4 h-4 mr-2" />} {uc.arquivoFaturaUrl ? 'Fatura Salva (Trocar)' : 'Upload PDF para IA'}<input type="file" className="hidden" onChange={(e) => handleFileUpload(selectedCliente.id, uc.id, e.target.files?.[0] || null)} /></label>
                                      {uc.arquivoFaturaUrl && (<div className="flex justify-end mt-2"><a href={uc.arquivoFaturaUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-cyan-500 hover:underline flex items-center gap-1"><Eye className="w-3 h-3"/> Ver PDF Original</a></div>)}
                                  </div>
                              ))}
                          </div>
                           <div className="pt-4 border-t border-white/5"><Label className="text-xs text-slate-500 uppercase mb-2 block">Status / Pipeline</Label><Select value={selectedCliente.status} onValueChange={(v) => handleUpdateField(selectedCliente.id, 'status', v)}><SelectTrigger className="w-full bg-slate-800 border-white/10"><SelectValue /></SelectTrigger><SelectContent className="bg-slate-900 border-slate-700 text-slate-300">{['Nenhum', 'Contato?', 'Proposta', 'Fechamento', 'Fechado'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select><Label className="text-xs text-slate-500 uppercase mt-4 mb-2 block">Notas Internas</Label><Textarea placeholder="Detalhes..." defaultValue={selectedCliente.feedbackNotes} className="bg-slate-800/50 border-white/10 min-h-[100px]" onBlur={e => handleUpdateField(selectedCliente.id, 'feedbackNotes', e.target.value)} /></div>
                      </div>
                  ) : (
                      <div className="flex flex-col items-center justify-center text-center p-8 bg-slate-800/30 rounded-2xl border border-dashed border-slate-700">
                          <Lock className="w-12 h-12 text-slate-600 mb-4"/>
                          <h3 className="text-lg font-bold text-white">Conteúdo Bloqueado</h3>
                          <p className="text-slate-400 text-sm mb-6">Desbloqueie este contato para ver os detalhes e iniciar a negociação.</p>
                          <Button onClick={() => handleUnlockLead(selectedCliente.id)} disabled={loadingUnlock === selectedCliente.id} className="w-full bg-yellow-600 hover:bg-yellow-500 text-white font-bold text-lg shadow-lg shadow-yellow-900/20">{loadingUnlock === selectedCliente.id ? <Loader2 className="animate-spin" /> : `Liberar por ${calculateLeadCost(Number(selectedCliente.unidades[0]?.consumoKwh || 0))} crédito(s)`}</Button>
                      </div>
                  )}
               </div>
               <div className="p-4 border-t border-white/5 bg-slate-800/80 flex justify-between items-center gap-4">
                  <div className="text-xs text-slate-500">Saldo: <strong className="text-yellow-400">{canSeeEverything ? "Ilimitado" : `${currentBalance} cr`}</strong></div>
                  <div className="flex gap-2"><Button variant="ghost" onClick={() => deleteDoc(doc(db, 'faturas_clientes', selectedCliente.id))} className="text-red-400 hover:bg-red-500/10">Excluir</Button><Button onClick={() => setSelectedClienteId(null)} className="bg-cyan-600 hover:bg-cyan-500 shadow-lg">Salvar</Button></div>
               </div>
            </div>
         </div>
      )}
    </div>
  );
}
