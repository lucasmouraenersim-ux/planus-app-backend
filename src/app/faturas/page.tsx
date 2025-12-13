
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
  Filter as FilterIcon, Zap, Home, AlertCircle, 
  TrendingUp, TrendingDown, Minus, LayoutGrid, List,
  MoreHorizontal, Map as MapIcon, X, MapPin, LocateFixed, Check, 
  Flame, MapPinned, Lock, Unlock, Coins, Phone, Mail, Search
} from 'lucide-react';
import { collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc, Timestamp, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { uploadFile } from '@/lib/firebase/storage';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { AreaChart, Area, LineChart, Line, ResponsiveContainer } from 'recharts';
import { GoogleMap, useJsApiLoader, OverlayView, HeatmapLayer } from '@react-google-maps/api';
import { unlockContactAction } from '@/actions/unlockContact';
import { TermsModal } from '@/components/TermsModal';
import { CreditPurchaseModal } from '@/components/billing/CreditPurchaseModal';

// --- CONFIGURAÇÃO GOOGLE MAPS ---
const libraries: ("visualization" | "places" | "drawing" | "geometry" | "localContext")[] = ["visualization"];

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
  // NOVO: Controle de "Compra" do lead
  isUnlocked?: boolean; 
  unlockedLeads?: string[];
  credits?: number;
  createdAt: string | Timestamp; 
  lastUpdatedBy?: { uid: string; name: string };
}

// --- CONSTANTES ---
const COST_PER_UNLOCK = 5; // Custo em créditos para liberar um contato
const FATURA_STATUS_OPTIONS: FaturaStatus[] = ['Nenhum', 'Contato?', 'Proposta', 'Fechamento', 'Fechado'];
const TENSAO_OPTIONS: { value: TensaoType; label: string }[] = [
  { value: 'baixa', label: 'Baixa Tensão' },
  { value: 'alta', label: 'Alta Tensão' },
  { value: 'b_optante', label: 'B Optante' },
  { value: 'baixa_renda', label: 'Baixa Renda' },
];

const mapStyles = [
  { elementType: "geometry", stylers: [{ color: "#1e293b" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#1e293b" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#94a3b8" }] },
  { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#cbd5e1" }] },
  { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#64748b" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#0f172a" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#334155" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#1e293b" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#475569" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#1e293b" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0f172a" }] },
];

// --- HELPERS VISUAIS ---
const formatKwh = (val: string | number) => {
    const num = Number(val);
    if (!num) return '0';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
    return num.toString();
};

const getStatusStyle = (status?: FaturaStatus) => {
  switch (status) {
    case 'Contato?': return { badge: 'bg-sky-500/10 text-sky-400 border-sky-500/20', glow: 'shadow-[0_0_10px_rgba(14,165,233,0.2)]', border: 'border-l-sky-500' };
    case 'Proposta': return { badge: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20', glow: '', border: 'border-l-indigo-500' };
    case 'Fechamento': return { badge: 'bg-purple-500/10 text-purple-400 border-purple-500/20', glow: 'shadow-[0_0_10px_rgba(168,85,247,0.3)]', border: 'border-l-purple-500' };
    case 'Fechado': return { badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', glow: 'shadow-[0_0_10px_rgba(16,185,129,0.3)]', border: 'border-l-emerald-500' };
    default: return { badge: 'bg-slate-800 text-slate-400 border-slate-700', glow: '', border: 'border-l-transparent' };
  }
};

const getTensaoColors = (tensao: TensaoType) => {
  switch (tensao) {
    case 'alta': return { gradient: 'from-blue-600 to-cyan-400', text: 'text-blue-400', bg: 'bg-blue-500', shadow: 'shadow-blue-500/20', chartColor: '#3b82f6', pinColor: 'bg-blue-600' };
    case 'baixa': return { gradient: 'from-emerald-500 to-teal-400', text: 'text-emerald-400', bg: 'bg-emerald-500', shadow: 'shadow-emerald-500/20', chartColor: '#10b981', pinColor: 'bg-emerald-600' };
    case 'b_optante': return { gradient: 'from-orange-500 to-amber-400', text: 'text-orange-400', bg: 'bg-orange-500', shadow: 'shadow-orange-500/20', chartColor: '#f97316', pinColor: 'bg-orange-600' };
    case 'baixa_renda': return { gradient: 'from-yellow-500 to-lime-400', text: 'text-yellow-400', bg: 'bg-yellow-500', shadow: 'shadow-yellow-500/20', chartColor: '#eab308', pinColor: 'bg-yellow-600' };
    default: return { gradient: 'from-slate-500 to-slate-400', text: 'text-slate-400', bg: 'bg-slate-500', shadow: 'shadow-slate-500/20', chartColor: '#64748b', pinColor: 'bg-slate-600' };
  }
};

// --- COMPONENTES AUXILIARES ---
const MiniLineChart = ({ color }: { color: string }) => {
    const data = Array.from({length: 8}, () => ({ value: Math.random() * 100 }));
    return (
        <div className="h-[40px] w-[80px]">
            <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
                <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
            </ResponsiveContainer>
        </div>
    )
}

const KPICard = ({ title, value, unit, color, icon: Icon, trend, trendValue }: any) => {
  const styles = getTensaoColors(color === 'blue' ? 'alta' : color === 'emerald' ? 'baixa' : color === 'orange' ? 'b_optante' : 'baixa_renda');
  return (
    <div className={`glass-panel p-6 rounded-2xl relative overflow-hidden group hover:scale-[1.02] transition-all`}>
      <div className="flex justify-between items-start mb-4">
        <div>
          <p className={`text-xs font-bold uppercase tracking-wider text-slate-400`}>{title}</p>
          <h3 className="text-2xl font-bold text-white mt-1">{value.toLocaleString('pt-BR')} <span className="text-xs">{unit}</span></h3>
        </div>
        <div className={`p-2 rounded-lg ${styles.text} bg-white/5`}><Icon className="w-5 h-5" /></div>
      </div>
      <div className="text-xs text-slate-500 flex items-center gap-1">
        {trend === 'up' ? <TrendingUp className="w-3 h-3 text-emerald-400" /> : <TrendingDown className="w-3 h-3 text-red-400" />}
        {trendValue} vs mês anterior
      </div>
    </div>
  );
};

// --- PÁGINA PRINCIPAL ---

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

  const { isLoaded: isMapLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || '',
    libraries: libraries
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

      const isAdmin = appUser.type === 'admin' || appUser.type === 'superadmin';
      const currentCredits = appUser.credits || 0;

      if (!isAdmin && currentCredits < COST_PER_UNLOCK) {
          toast({ title: "Saldo Insuficiente", description: "Clique no seu saldo de créditos para recarregar.", variant: "destructive" });
          setIsCreditModalOpen(true); // Abre o modal de compra
          return;
      }

      toast({ title: "Processando...", description: isAdmin ? "Acesso Admin..." : "Validando saldo..." });

      try {
          const result = await unlockContactAction(appUser.uid, clienteId);

          if (result.success) {
              if (!isAdmin && result.alreadyUnlocked !== true) {
                const newCredits = (appUser.credits || 0) - COST_PER_UNLOCK;
                updateAppUser({ ...appUser, credits: newCredits, unlockedLeads: [...(appUser.unlockedLeads || []), clienteId] });
              } else {
                updateAppUser({ ...appUser, unlockedLeads: [...(appUser.unlockedLeads || []), clienteId] });
              }

              setClientes(prev => prev.map(c => 
                  c.id === clienteId ? { ...c, isUnlocked: true } : c
              ));

              toast({ title: "Sucesso", description: result.message, className: "bg-emerald-500 text-white" });
          } else {
              toast({ title: "Erro", description: result.message, variant: "destructive" });
          }
      } catch (error) {
          toast({ title: "Erro", description: "Falha na comunicação com o servidor.", variant: "destructive" });
      }
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

  // Funções de CRUD
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
    if (!file) return;
    toast({ title: "🤖 IA Analisando...", description: "Lendo dados e localizando endereço..." });
    try {
        const formData = new FormData(); formData.append('file', file);
        const res = await fetch('/api/process-fatura', { method: 'POST', body: formData });
        if (!res.ok) throw new Error('Falha na IA');
        const dadosIA = await res.json();
        const path = `faturas/${clienteId}/${unidadeId}/${file.name}`;
        const url = await uploadFile(file, path);
        if (unidadeId) {
            const cliente = clientes.find(c => c.id === clienteId);
            if (!cliente) return;
            const novasUnidades = cliente.unidades.map(u => u.id === unidadeId ? {
                ...u, arquivoFaturaUrl: url, nomeArquivo: file.name,
                consumoKwh: dadosIA.consumoKwh?.toString(),
                valorTotal: dadosIA.valorTotal?.toString(),
                mediaConsumo: dadosIA.mediaConsumo?.toString(),
                endereco: dadosIA.enderecoCompleto,
                cidade: dadosIA.cidade,
                estado: dadosIA.estado,
                latitude: dadosIA.latitude,
                longitude: dadosIA.longitude
            } : u);
            await handleUpdateField(clienteId, 'unidades', novasUnidades);
            if(cliente.nome === 'Novo Lead' && dadosIA.nomeCliente) await handleUpdateField(clienteId, 'nome', dadosIA.nomeCliente);
            toast({ title: "Sucesso!", description: `Processado: ${dadosIA.cidade || 'Localizado'}` });
        }
    } catch(e: any) { toast({ title: "Erro IA", description: e.message, variant: "destructive" }); }
  };

  // Filter Logic
  const { filteredClientes, kpiData, cidadesDisponiveis } = useMemo(() => {
    let result = [...clientes];
    const totals = { alta: 0, baixa: 0, b_optante: 0, baixa_renda: 0 };
    const cidades = new Set<string>();

    clientes.forEach(c => {
        c.unidades.forEach(u => {
             if(u.cidade) cidades.add(u.cidade);
             const consumo = Number(u.consumoKwh) || 0;
             if (totals[c.tensao] !== undefined) totals[c.tensao] += consumo;
        });
    });

    if (searchTerm) result = result.filter(c => c.nome.toLowerCase().includes(searchTerm.toLowerCase()));
    if (filterTensao !== 'all') result = result.filter(c => c.tensao === filterTensao);
    if (filterCidade !== 'all') result = result.filter(c => c.unidades.some(u => u.cidade === filterCidade));

    return { filteredClientes: result, kpiData: totals, cidadesDisponiveis: Array.from(cidades) };
  }, [clientes, searchTerm, filterTensao, filterCidade]);

  // Heatmap Data
  const heatmapData = useMemo(() => {
    if (!isMapLoaded || !window.google) return [];
    const points: any[] = [];
    filteredClientes.forEach(c => {
        c.unidades.forEach(u => {
            if (u.latitude && u.longitude) {
                points.push({ location: new window.google.maps.LatLng(u.latitude, u.longitude), weight: Number(u.consumoKwh) || 1 });
            }
        });
    });
    return points;
  }, [filteredClientes, isMapLoaded]);


  const selectedCliente = useMemo(() => clientes.find(c => c.id === selectedClienteId), [clientes, selectedClienteId]);
  
  const isUserAdmin = appUser?.type === 'admin' || appUser?.type === 'superadmin';
  const currentBalance = appUser?.credits || 0;

  if (isLoading) return <div className="h-screen bg-slate-950 flex items-center justify-center"><Loader2 className="animate-spin text-cyan-500 w-10 h-10" /></div>;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-300 font-sans relative overflow-hidden">
      <TermsModal />
      <CreditPurchaseModal 
        isOpen={isCreditModalOpen} 
        onClose={() => setIsCreditModalOpen(false)} 
      />

      <style jsx global>{`
        .glass-panel { background: rgba(15, 23, 42, 0.6); backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.05); }
        ::-webkit-scrollbar { width: 6px; } ::-webkit-scrollbar-thumb { background: #334155; border-radius: 3px; }
      `}</style>

      {/* Header */}
      <header className="h-20 shrink-0 flex items-center justify-between px-8 border-b border-white/5 bg-slate-900/50 backdrop-blur-md">
          <div className="flex items-center gap-3"><div className="p-2 bg-gradient-to-tr from-cyan-500 to-blue-600 rounded-lg shadow-lg"><Zap className="h-5 w-5 text-white" /></div><h2 className="text-xl font-bold text-white">Sent Energia</h2></div>
          <div className="flex items-center gap-6">
             <button 
                onClick={() => setIsCreditModalOpen(true)}
                className="hidden md:flex items-center gap-2 bg-slate-800/80 px-4 py-2 rounded-full border border-yellow-500/20 shadow-lg shadow-yellow-900/10 hover:bg-slate-800 hover:border-yellow-500/50 hover:scale-105 transition-all group"
                title="Clique para recarregar"
             >
                <Coins className="w-4 h-4 text-yellow-400 group-hover:animate-bounce" />
                <span className="text-sm font-bold text-yellow-100">
                    {isUserAdmin ? "Ilimitado" : `${currentBalance} Créditos`}
                </span>
                {!isUserAdmin && <PlusCircle className="w-4 h-4 text-yellow-500 ml-1" />}
             </button>
             <div className={`relative transition-all duration-300 ${searchOpen ? 'w-64' : 'w-10'}`}><button onClick={() => setSearchOpen(!searchOpen)} className="absolute left-0 top-0 h-10 w-10 flex items-center justify-center text-slate-400 hover:text-white"><Search className="w-5 h-5" /></button><Input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Buscar..." className={`h-10 bg-slate-800/80 border-white/10 rounded-full pl-10 pr-4 text-sm text-white ${searchOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} /></div>
          </div>
      </header>

      {/* Content */}
      <div className="p-6 pb-20 overflow-y-auto h-[calc(100vh-80px)]">
         {/* KPIs */}
         <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <KPICard title="Alta Tensão" value={kpiData.alta} unit="kWh" color="blue" icon={Zap} trend="up" trendValue="+12%" />
            <KPICard title="Baixa Tensão" value={kpiData.baixa} unit="kWh" color="emerald" icon={Home} trend="up" trendValue="+4%" />
            <KPICard title="B Optante" value={kpiData.b_optante} unit="kWh" color="orange" icon={AlertCircle} trend="stable" trendValue="0%" />
            <KPICard title="Baixa Renda" value={kpiData.baixa_renda} unit="kWh" color="yellow" icon={Minus} trend="down" trendValue="-2%" />
         </div>

         {/* Filters */}
         <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
            <div className="flex items-center gap-2">
                <div className="bg-slate-900/50 p-1.5 rounded-xl border border-white/5 backdrop-blur-sm flex"><button onClick={() => setViewMode('list')} className={`p-2 rounded-lg ${viewMode === 'list' ? 'bg-cyan-600 text-white' : 'text-slate-500'}`}><List className="w-4 h-4" /></button><button onClick={() => setViewMode('kanban')} className={`p-2 rounded-lg ${viewMode === 'kanban' ? 'bg-cyan-600 text-white' : 'text-slate-500'}`}><LayoutGrid className="w-4 h-4" /></button><button onClick={() => setViewMode('map')} className={`p-2 rounded-lg ${viewMode === 'map' ? 'bg-cyan-600 text-white' : 'text-slate-500'}`}><MapIcon className="w-4 h-4" /></button></div>
                <Select value={filterTensao} onValueChange={(v:any) => setFilterTensao(v)}><SelectTrigger className="w-[140px] h-10 bg-slate-900/50 border-white/10 text-xs text-slate-300"><SelectValue placeholder="Tensão" /></SelectTrigger><SelectContent className="bg-slate-900 border-slate-800 text-slate-300"><SelectItem value="all">Todas</SelectItem>{TENSAO_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select>
                <Select value={filterCidade} onValueChange={setFilterCidade}><SelectTrigger className="w-[140px] h-10 bg-slate-900/50 border-white/10 text-xs text-slate-300"><SelectValue placeholder="Cidades" /></SelectTrigger><SelectContent className="bg-slate-900 border-slate-800 text-slate-300"><SelectItem value="all">Todas</SelectItem>{cidadesDisponiveis.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
            </div>
            <Button onClick={handleAddCliente} className="bg-cyan-600 hover:bg-cyan-500 text-white h-10 px-6 shadow-lg"><PlusCircle className="w-4 h-4 mr-2" /> Novo Lead</Button>
         </div>

         {/* VIEW: LIST */}
         {viewMode === 'list' && (
            <div className="glass-panel rounded-2xl overflow-hidden animate-in fade-in duration-500">
               <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-900/50 text-xs uppercase text-slate-500 font-bold border-b border-white/5">
                     <tr><th className="p-5">Cliente / ID</th><th className="p-5">Consumo</th><th className="p-5">Contato</th><th className="p-5">Local</th><th className="p-5">Status</th><th className="p-5 text-right"></th></tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                     {filteredClientes.map((c) => {
                        const total = c.unidades.reduce((acc, u) => acc + (Number(u.consumoKwh) || 0), 0);
                        const style = getTensaoColors(c.tensao);
                        const isUnlocked = c.isUnlocked || isUserAdmin;
                        return (
                           <tr key={c.id} onClick={() => setSelectedClienteId(c.id)} className={`group hover:bg-white/[0.02] cursor-pointer border-l-[3px] ${getStatusStyle(c.status).border} ${selectedClienteId === c.id ? 'bg-white/[0.03]' : ''}`}>
                              <td className="p-5"><div className="flex items-center gap-4"><div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${style.gradient} flex items-center justify-center text-white font-bold shadow-lg text-sm`}>{c.nome.substring(0, 1).toUpperCase()}</div><div><p className="font-semibold text-white text-sm">{c.nome}</p><span className="text-[10px] px-1.5 rounded bg-slate-800 text-slate-400 border border-slate-700 uppercase">{c.tipoPessoa}</span></div></div></td>
                              <td className="p-5"><div className="flex flex-col gap-1"><span className="text-white font-medium text-sm">{total.toLocaleString('pt-BR')} kWh</span><div className="w-24 h-1 bg-slate-800 rounded-full overflow-hidden"><div className={`h-full rounded-full bg-gradient-to-r ${style.gradient}`} style={{ width: `${Math.min(total/500, 100)}%` }}></div></div></div></td>
                              <td className="p-5">{isUnlocked ? <div className="flex items-center gap-2 text-emerald-400 text-xs bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/20 w-fit"><Unlock className="w-3 h-3" /> Liberado</div> : <div className="flex items-center gap-2 text-slate-500 text-xs"><Lock className="w-3 h-3" /> {COST_PER_UNLOCK} Créditos</div>}</td>
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

         {/* VIEW: MAP */}
         {viewMode === 'map' && (
             <div className="w-full h-[650px] bg-slate-900 rounded-2xl border border-white/10 overflow-hidden relative animate-in fade-in duration-500 shadow-2xl">
                <div className="absolute top-4 right-4 z-10 bg-slate-900/90 backdrop-blur p-1 rounded-lg border border-white/10 flex gap-1 shadow-xl">
                    <button onClick={() => setMapLayer('pins')} className={`px-3 py-1.5 rounded text-xs font-medium flex items-center gap-2 ${mapLayer === 'pins' ? 'bg-cyan-600 text-white' : 'text-slate-400'}`}><MapPinned className="w-3 h-3" /> Pinos</button>
                    <button onClick={() => setMapLayer('heat')} className={`px-3 py-1.5 rounded text-xs font-medium flex items-center gap-2 ${mapLayer === 'heat' ? 'bg-orange-600 text-white' : 'text-slate-400'}`}><Flame className="w-3 h-3" /> Calor</button>
                </div>
                {isMapLoaded ? (
                  <GoogleMap mapContainerStyle={{ width: '100%', height: '100%' }} center={{ lat: -15.601, lng: -56.097 }} zoom={11} options={{ styles: mapStyles, disableDefaultUI: true, zoomControl: true }}>
                    {mapLayer === 'heat' && (<HeatmapLayer data={heatmapData} options={{ radius: 40, opacity: 0.8 }} />)}
                    {mapLayer === 'pins' && filteredClientes.map(c => {
                      const uc = c.unidades.find(u => u.latitude && u.longitude);
                      if (!uc?.latitude) return null;
                      const style = getTensaoColors(c.tensao);
                      const isUnlocked = c.isUnlocked || isUserAdmin;
                      const size = Math.min(Math.max(32, (Number(uc.consumoKwh)||0) / 100), 64); 
                      // Pino cinza se bloqueado
                      const pinClass = isUnlocked ? style.pinColor : 'bg-slate-600'; 
                      return (
                        <OverlayView key={c.id} position={{ lat: uc.latitude, lng: uc.longitude! }} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                          <div className="absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer group z-10 hover:z-50" onClick={() => setSelectedClienteId(c.id)}>
                             <div className={`flex items-center justify-center rounded-full border-2 border-white/80 shadow-2xl transition-all duration-300 group-hover:scale-125 ${pinClass}`} style={{ width: `${size}px`, height: `${size}px` }}>
                                <span className="text-[10px] font-bold text-white drop-shadow-md">{formatKwh(Number(uc.consumoKwh))}</span>
                             </div>
                             <div className="absolute top-full mt-1 left-1/2 -translate-x-1/2 bg-slate-900/90 text-white text-xs px-2 py-1 rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity border border-white/10 pointer-events-none z-50 flex items-center gap-1">
                                {isUnlocked ? c.nome : <><Lock className="w-3 h-3 text-yellow-500" /> Bloqueado</>}
                             </div>
                          </div>
                        </OverlayView>
                      );
                    })}
                  </GoogleMap>
                ) : <div className="flex items-center justify-center h-full text-slate-500"><Loader2 className="animate-spin w-8 h-8 mr-2 text-cyan-500" /></div>}
             </div>
         )}

         {/* VIEW: KANBAN */}
         {viewMode === 'kanban' && (
            <div className="flex gap-4 overflow-x-auto pb-4 h-full animate-in fade-in duration-500">
               {FATURA_STATUS_OPTIONS.map(status => (
                  <div key={status} className="min-w-[300px] bg-slate-900/40 rounded-2xl border border-white/5 p-4 flex flex-col gap-4 backdrop-blur-sm">
                     <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase px-1"><span className="flex items-center gap-2"><div className={`w-2 h-2 rounded-full ${getStatusStyle(status).border.replace('border-l-', 'bg-')}`}></div>{status}</span><span className="bg-slate-800 px-2 py-0.5 rounded-full text-white font-mono">{filteredClientes.filter(c => (c.status||'Nenhum') === status).length}</span></div>
                     <div className="flex-1 space-y-3 overflow-y-auto pr-1 custom-scrollbar">
                        {filteredClientes.filter(c => (c.status||'Nenhum') === status).map(c => (
                           <div key={c.id} onClick={() => setSelectedClienteId(c.id)} className="bg-slate-800/60 p-4 rounded-xl border border-white/5 hover:border-cyan-500/50 cursor-pointer group shadow-sm hover:shadow-cyan-900/20 transition-all">
                              <div className="flex justify-between items-start mb-2"><div className="flex items-center gap-2"><div className={`w-6 h-6 rounded bg-gradient-to-br from-slate-600 to-slate-500 flex items-center justify-center text-white font-bold text-[10px]`}>{c.nome.charAt(0)}</div><span className="font-semibold text-sm text-white group-hover:text-cyan-400 truncate w-32">{c.nome}</span></div></div>
                              <div className="flex justify-between items-end"><div className="text-xs text-slate-500 flex items-center gap-1">{(c.isUnlocked || isUserAdmin) ? <Unlock className="w-3 h-3 text-emerald-500"/> : <Lock className="w-3 h-3 text-slate-600"/>}</div><div className="text-sm font-bold text-white">{(c.unidades.reduce((acc,u)=>acc+(Number(u.consumoKwh)||0),0)).toLocaleString()} kWh</div></div>
                           </div>
                        ))}
                     </div>
                  </div>
               ))}
            </div>
         )}
      </div>

      {/* DRAWER */}
      {selectedClienteId && selectedCliente && (
         <div className="fixed inset-0 z-50 flex justify-end">
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity" onClick={() => setSelectedClienteId(null)}></div>
            <div className="relative w-full max-w-xl h-full bg-slate-900 border-l border-white/10 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
               
               <div className="px-6 py-6 border-b border-white/5 flex justify-between items-start bg-slate-800/50">
                  <div>
                      <h2 className="text-xl font-bold text-white mb-1">{selectedCliente.nome}</h2>
                      <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded bg-slate-700 text-xs text-slate-300 border border-slate-600 uppercase">{selectedCliente.tipoPessoa}</span>
                          {(selectedCliente.isUnlocked || isUserAdmin) ? 
                            <span className="text-xs text-emerald-400 border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 rounded flex items-center gap-1"><Unlock className="w-3 h-3"/> Lead Desbloqueado</span>
                            : 
                            <span className="text-xs text-yellow-400 border border-yellow-500/30 bg-yellow-500/10 px-2 py-0.5 rounded flex items-center gap-1"><Lock className="w-3 h-3"/> Lead Bloqueado</span>
                          }
                      </div>
                  </div>
                  <button onClick={() => setSelectedClienteId(null)} className="text-slate-400 hover:text-white p-2 hover:bg-white/10 rounded-lg"><X className="w-5 h-5" /></button>
               </div>
               
               <div className="flex-1 overflow-y-auto p-6 space-y-8">
                  
                  {/* ÁREA DE CONTATOS */}
                  <div className="bg-slate-800/30 p-5 rounded-xl border border-white/5 relative overflow-hidden">
                      <div className="flex items-center justify-between mb-4">
                          <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2"><Phone className="w-4 h-4" /> Contatos</h3>
                      </div>

                      {(selectedCliente.isUnlocked || isUserAdmin) ? (
                          // ESTADO DESBLOQUEADO (OU ADMIN)
                          <div className="space-y-3">
                              {selectedCliente.contatos?.map((ct, idx) => (
                                  <div key={idx} className="bg-slate-900 p-3 rounded-lg border border-white/5 flex justify-between items-center">
                                      <div>
                                          <div className="text-white font-medium">{ct.nome}</div>
                                          <div className="text-sm text-cyan-400">{ct.telefone}</div>
                                      </div>
                                      <a href={`https://wa.me/55${ct.telefone.replace(/\D/g,'')}`} target="_blank" className="p-2 bg-emerald-600 hover:bg-emerald-500 rounded-full text-white"><Phone className="w-4 h-4" /></a>
                                  </div>
                              ))}
                              {(!selectedCliente.contatos || selectedCliente.contatos.length === 0) && <p className="text-sm text-slate-500">Nenhum contato cadastrado.</p>}
                          </div>
                      ) : (
                          // ESTADO BLOQUEADO
                          <div className="relative">
                              <div className="space-y-3 filter blur-sm select-none pointer-events-none opacity-50">
                                  <div className="bg-slate-900 p-3 rounded-lg border border-white/5"><div className="h-4 w-32 bg-slate-700 rounded mb-2"></div><div className="h-3 w-24 bg-slate-700 rounded"></div></div>
                                  <div className="bg-slate-900 p-3 rounded-lg border border-white/5"><div className="h-4 w-40 bg-slate-700 rounded mb-2"></div><div className="h-3 w-28 bg-slate-700 rounded"></div></div>
                              </div>
                              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                                  <div className="bg-slate-900/90 p-4 rounded-xl border border-white/10 shadow-2xl">
                                      <Lock className="w-8 h-8 text-yellow-500 mx-auto mb-2" />
                                      <h4 className="text-white font-bold mb-1">Dados Protegidos</h4>
                                      <p className="text-xs text-slate-400 mb-4 max-w-[200px]">Desbloqueie para ver contatos.</p>
                                      <Button onClick={() => handleUnlockLead(selectedCliente.id)} className="w-full bg-yellow-600 hover:bg-yellow-500 text-white font-bold">Liberar por {COST_PER_UNLOCK} Créditos</Button>
                                  </div>
                              </div>
                          </div>
                      )}
                  </div>

                  {/* VISUALIZAÇÃO PREMIUM */}
                  {(selectedCliente.isUnlocked || isUserAdmin) && (
                      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8">
                          {/* Gráfico */}
                          {(() => {
                              const uc = selectedCliente.unidades[0];
                              const consumo = Number(uc?.consumoKwh || 0);
                              const media = Number(uc?.mediaConsumo || 0);
                              if(consumo > 0 && media > 0) {
                                  const diff = consumo - media;
                                  const pct = ((diff/media)*100).toFixed(1);
                                  const isHigh = diff > 0;
                                  return (
                                      <div className="bg-slate-800/40 p-5 rounded-xl border border-white/5 relative overflow-hidden">
                                          <div className="absolute top-0 right-0 p-4 opacity-5"><Zap className="w-24 h-24" /></div>
                                          <div className="flex justify-between items-center mb-4 relative z-10"><span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Performance de Consumo</span><span className={`text-xs font-bold px-2 py-1 rounded-lg flex items-center gap-1 border ${isHigh ? 'text-red-400 bg-red-500/10 border-red-500/20' : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'}`}>{isHigh ? <TrendingUp className="w-3 h-3"/> : <TrendingDown className="w-3 h-3"/>} {Math.abs(Number(pct))}% {isHigh ? 'Acima' : 'Abaixo'} da média</span></div>
                                          <div className="flex justify-between items-end text-xs text-slate-400 mb-1 relative z-10"><span>Média: {media.toLocaleString()} kWh</span><span className="text-white font-bold text-lg">{consumo.toLocaleString()} <small className="text-slate-500 font-normal">kWh Atual</small></span></div>
                                          <div className="h-2 w-full bg-slate-700 rounded-full mt-2 overflow-hidden relative z-10"><div className={`h-full ${isHigh ? 'bg-gradient-to-r from-orange-500 to-red-500' : 'bg-gradient-to-r from-emerald-500 to-teal-500'}`} style={{width: `${Math.min((consumo/(media*1.5))*100, 100)}%`}}></div></div>
                                      </div>
                                  )
                              }
                              return null;
                          })()}

                          {/* Unidades e Upload */}
                          <div className="space-y-4">
                              <div className="flex justify-between items-center border-b border-white/5 pb-2"><h3 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2"><Home className="w-4 h-4" /> Unidades Consumidoras</h3><Button size="sm" variant="ghost" className="h-6 text-xs text-cyan-500 hover:text-cyan-400" onClick={() => { const n = [...selectedCliente.unidades, { id: crypto.randomUUID(), consumoKwh: '', temGeracao: false, arquivoFaturaUrl: null, nomeArquivo: null }]; handleUpdateField(selectedCliente.id, 'unidades', n); }}>+ Adicionar UC</Button></div>
                              {selectedCliente.unidades.map((uc, i) => (
                                  <div key={uc.id} className="bg-slate-800/30 p-4 rounded-xl border border-white/5 hover:border-white/10 transition-all group">
                                      <div className="flex justify-between mb-3">
                                          <div className="flex items-center gap-2"><span className="text-xs font-bold bg-slate-700 px-2 py-0.5 rounded text-white">UC {i+1}</span>{uc.latitude ? <span className="text-xs text-emerald-400 flex items-center gap-1"><MapPin className="w-3 h-3"/> No Mapa</span> : <span className="text-xs text-slate-500 flex items-center gap-1"><MapPin className="w-3 h-3"/> Sem Mapa</span>}</div>
                                          {selectedCliente.unidades.length > 1 && <button onClick={() => { const n = selectedCliente.unidades.filter(u => u.id !== uc.id); handleUpdateField(selectedCliente.id, 'unidades', n); }} className="text-slate-600 hover:text-red-400"><Trash2 className="w-4 h-4"/></button>}
                                      </div>
                                      <div className="grid grid-cols-2 gap-3 mb-3">
                                          <div><Label className="text-[10px] text-slate-500 uppercase">Consumo (kWh)</Label><Input placeholder="0" defaultValue={uc.consumoKwh} className="h-9 bg-slate-900/50 border-white/10 text-white font-mono" onBlur={e => {const n=[...selectedCliente.unidades];n[i].consumoKwh=e.target.value;handleUpdateField(selectedCliente.id,'unidades',n)}} /></div>
                                          <div><Label className="text-[10px] text-slate-500 uppercase">Média Histórica</Label><Input placeholder="0" defaultValue={uc.mediaConsumo} className="h-9 bg-slate-900/50 border-white/10 text-slate-400 font-mono" onBlur={e => {const n=[...selectedCliente.unidades];n[i].mediaConsumo=e.target.value;handleUpdateField(selectedCliente.id,'unidades',n)}} /></div>
                                      </div>
                                      <div className="flex gap-2 mb-3">
                                          <div className="flex-1"><Input placeholder="Endereço Completo..." defaultValue={uc.endereco} className="h-9 bg-slate-900/50 border-white/10 text-xs text-white" onBlur={e => {const n=[...selectedCliente.unidades];n[i].endereco=e.target.value;handleUpdateField(selectedCliente.id,'unidades',n)}} /></div>
                                          <Button size="sm" variant="secondary" className="h-9 bg-slate-700 hover:bg-slate-600 text-slate-200" onClick={() => handleManualGeocode(selectedCliente.id, uc.id, uc.endereco || '')} title="Buscar Coordenadas"><LocateFixed className="w-4 h-4" /></Button>
                                      </div>
                                      <label className={`flex items-center justify-center w-full py-3 border border-dashed rounded-lg cursor-pointer transition-all ${uc.arquivoFaturaUrl ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-400' : 'border-slate-600 hover:border-cyan-500 hover:bg-slate-800 text-slate-400'}`}>
                                          {uc.arquivoFaturaUrl ? <Check className="w-4 h-4 mr-2" /> : <Upload className="w-4 h-4 mr-2" />} {uc.arquivoFaturaUrl ? 'Fatura OK (Trocar)' : 'Upload PDF (IA)'}
                                          <input type="file" className="hidden" onChange={(e) => handleFileUpload(selectedCliente.id, uc.id, e.target.files?.[0] || null)} />
                                      </label>
                                      {uc.arquivoFaturaUrl && (<div className="flex justify-end mt-2"><a href={uc.arquivoFaturaUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-cyan-500 hover:underline flex items-center gap-1"><Eye className="w-3 h-3"/> Ver PDF Original</a></div>)}
                                  </div>
                              ))}
                          </div>
                          
                          <div className="pt-4 border-t border-white/5">
                              <Label className="text-xs text-slate-500 uppercase mb-2 block">Status / Pipeline</Label>
                              <Select value={selectedCliente.status} onValueChange={(v) => handleUpdateField(selectedCliente.id, 'status', v)}><SelectTrigger className="w-full bg-slate-800 border-white/10"><SelectValue /></SelectTrigger><SelectContent className="bg-slate-900 border-slate-700 text-slate-300">{FATURA_STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
                              <Label className="text-xs text-slate-500 uppercase mt-4 mb-2 block">Notas Internas</Label>
                              <Textarea placeholder="Detalhes..." defaultValue={selectedCliente.feedbackNotes} className="bg-slate-800/50 border-white/10 min-h-[100px]" onBlur={e => handleUpdateField(selectedCliente.id, 'feedbackNotes', e.target.value)} />
                          </div>
                      </div>
                  )}
               </div>
               
               <div className="p-4 border-t border-white/5 bg-slate-800/80 flex justify-between items-center gap-4">
                  <div className="text-xs text-slate-500">Saldo: <strong className="text-yellow-400">{isUserAdmin ? "Ilimitado" : `${currentBalance} cr`}</strong></div>
                  <div className="flex gap-2"><Button variant="ghost" onClick={() => deleteDoc(doc(db, 'faturas_clientes', selectedCliente.id))} className="text-red-400 hover:bg-red-500/10">Excluir</Button><Button onClick={() => setSelectedClienteId(null)} className="bg-cyan-600 hover:bg-cyan-500 shadow-lg">Salvar</Button></div>
               </div>
            </div>
         </div>
      )}
    </div>
  );
}
