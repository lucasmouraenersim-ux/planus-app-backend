
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
  MoreHorizontal, Map as MapIcon, X, MapPin, LocateFixed, Search
} from 'lucide-react';
import { collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc, Timestamp, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { uploadFile } from '@/lib/firebase/storage';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { AreaChart, Area, LineChart, Line, ResponsiveContainer } from 'recharts';
// Importamos OverlayView para criar elementos HTML no mapa
import { GoogleMap, useJsApiLoader, OverlayView } from '@react-google-maps/api';

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
  contatos: any[];
  status?: FaturaStatus;
  feedbackNotes?: string;
  createdAt: string | Timestamp; 
  lastUpdatedBy?: { uid: string; name: string };
}

// --- CONSTANTES ---
const FATURA_STATUS_OPTIONS: FaturaStatus[] = ['Nenhum', 'Contato?', 'Proposta', 'Fechamento', 'Fechado'];
const TENSAO_OPTIONS: { value: TensaoType; label: string }[] = [
  { value: 'baixa', label: 'Baixa Tensão' },
  { value: 'alta', label: 'Alta Tensão' },
  { value: 'b_optante', label: 'B Optante' },
  { value: 'baixa_renda', label: 'Baixa Renda' },
];

const mapStyles = [
  { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
  { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
  { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#263c3f" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#38414e" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#212a37" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#746855" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#1f2835" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#17263c" }] },
];

// --- FUNÇÕES AUXILIARES ---
const formatNumberMap = (num: number) => {
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
    case 'alta': return { gradient: 'from-blue-600 to-cyan-400', chartColor: '#3b82f6', bgMap: 'bg-blue-600', shadow: 'shadow-blue-500/50' };
    case 'baixa': return { gradient: 'from-emerald-500 to-teal-400', chartColor: '#10b981', bgMap: 'bg-emerald-600', shadow: 'shadow-emerald-500/50' };
    case 'b_optante': return { gradient: 'from-orange-500 to-amber-400', chartColor: '#f97316', bgMap: 'bg-orange-600', shadow: 'shadow-orange-500/50' };
    case 'baixa_renda': return { gradient: 'from-yellow-500 to-lime-400', chartColor: '#eab308', bgMap: 'bg-yellow-600', shadow: 'shadow-yellow-500/50' };
    default: return { gradient: 'from-slate-500 to-slate-400', chartColor: '#64748b', bgMap: 'bg-slate-600', shadow: 'shadow-slate-500/50' };
  }
};

// --- COMPONENTES DE GRÁFICO E KPI (Mantidos) ---
const MiniLineChart = ({ data, color }: { data: { value: number }[], color: string }) => (
  <div className="h-[40px] w-[80px]">
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data}>
        <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  </div>
);

const KPICard = ({ title, value, unit, color, icon: Icon, trend, trendValue }: any) => {
  const colorMap: any = {
    blue: { text: 'text-blue-400', bg: 'bg-blue-500/10' },
    emerald: { text: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    orange: { text: 'text-orange-400', bg: 'bg-orange-500/10' },
    yellow: { text: 'text-yellow-400', bg: 'bg-yellow-500/10' },
  };
  return (
    <div className={`glass-panel p-6 rounded-2xl relative overflow-hidden group hover:scale-[1.02] transition-all`}>
      <div className="flex justify-between items-start mb-4">
        <div>
          <p className={`text-xs font-bold uppercase tracking-wider text-slate-400`}>{title}</p>
          <h3 className="text-2xl font-bold text-white mt-1">{value.toLocaleString()} <span className="text-xs">{unit}</span></h3>
        </div>
        <div className={`p-2 rounded-lg ${colorMap[color].bg} ${colorMap[color].text}`}><Icon className="w-5 h-5" /></div>
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
  
  // States
  const [selectedClienteId, setSelectedClienteId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'kanban' | 'map'>('list');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTensao, setFilterTensao] = useState<TensaoType | 'all'>('all');
  const [filterCidade, setFilterCidade] = useState<string>('all');

  // Google Maps Loader
  const { isLoaded: isMapLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || ''
  });

  // Fetch Data
  useEffect(() => {
    const q = query(collection(db, 'faturas_clientes'), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setClientes(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any)));
      setIsLoading(false);
    });
    return () => unsub();
  }, []);

  // Filtros
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

  // Handlers
  const handleAddCliente = async () => {
    try {
        const docRef = await addDoc(collection(db, 'faturas_clientes'), {
            nome: 'Novo Cliente', tipoPessoa: 'pj', tensao: 'baixa',
            unidades: [{ id: crypto.randomUUID(), consumoKwh: '', temGeracao: false, arquivoFaturaUrl: null, nomeArquivo: null }],
            contatos: [], createdAt: Timestamp.now(), status: 'Nenhum'
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
        
        if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.error || 'Falha na IA');
        }

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
            if(cliente.nome === 'Novo Cliente' && dadosIA.nomeCliente) await handleUpdateField(clienteId, 'nome', dadosIA.nomeCliente);
            toast({ title: "Sucesso!", description: `Fatura de ${dadosIA.cidade || 'Local Desconhecido'} processada.` });
        }
    } catch(e: any) { toast({ title: "Erro na IA", description: e.message, variant: "destructive" }); }
  };

  const handleManualGeocode = async (clienteId: string, unidadeId: string, address: string) => {
    if(!address || !process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY) return;
    toast({ title: "Buscando no Mapa...", description: "Consultando Google Maps API..." });
    try {
        const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY}`);
        const data = await response.json();
        if(data.results && data.results.length > 0) {
            const location = data.results[0].geometry.location;
            const cliente = clientes.find(c => c.id === clienteId);
            if(!cliente) return;
            const novasUnidades = cliente.unidades.map(u => u.id === unidadeId ? { ...u, latitude: location.lat, longitude: location.lng, endereco: address } : u);
            await handleUpdateField(clienteId, 'unidades', novasUnidades);
            toast({ title: "Localizado!", description: "Coordenadas atualizadas." });
        } else { toast({ title: "Não encontrado", variant: "destructive" }); }
    } catch(e) { toast({ title: "Erro", variant: "destructive" }); }
  };

  const selectedCliente = useMemo(() => clientes.find(c => c.id === selectedClienteId), [clientes, selectedClienteId]);

  if (isLoading) return <div className="h-screen bg-slate-950 flex items-center justify-center"><Loader2 className="animate-spin text-cyan-500" /></div>;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-300 font-sans relative overflow-hidden">
      <style jsx global>{` .glass-panel { background: rgba(15, 23, 42, 0.6); backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.05); } `}</style>

      {/* Header */}
      <header className="h-16 flex items-center justify-between px-6 border-b border-white/5 bg-slate-900/50 backdrop-blur-md">
         <div className="flex items-center gap-3"><div className="p-1.5 bg-cyan-600 rounded-lg"><Zap className="h-4 w-4 text-white" /></div><h2 className="font-bold text-white">Sent Energia</h2></div>
         <div className={`relative transition-all duration-300 ${searchOpen ? 'w-64' : 'w-10'}`}>
            <button onClick={() => setSearchOpen(!searchOpen)} className="absolute left-0 top-0 h-9 w-10 flex items-center justify-center text-slate-400"><Search className="w-4 h-4" /></button>
            <Input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Buscar..." className={`h-9 bg-slate-800 rounded-full pl-10 ${searchOpen ? 'opacity-100' : 'opacity-0'}`} />
         </div>
      </header>

      {/* Body */}
      <div className="p-6 pb-20 overflow-y-auto h-[calc(100vh-64px)]">
         {/* KPIs */}
         <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <KPICard title="Alta Tensão" value={kpiData.alta} unit="kWh" color="blue" icon={Zap} trend="up" trendValue="+12%" />
            <KPICard title="Baixa Tensão" value={kpiData.baixa} unit="kWh" color="emerald" icon={Home} trend="up" trendValue="+4%" />
            <KPICard title="B Optante" value={kpiData.b_optante} unit="kWh" color="orange" icon={AlertCircle} trend="stable" trendValue="0%" />
            <KPICard title="Baixa Renda" value={kpiData.baixa_renda} unit="kWh" color="yellow" icon={Minus} trend="down" trendValue="-2%" />
         </div>

         {/* Filters */}
         <div className="flex flex-col md:flex-row justify-between gap-4 mb-4">
            <div className="flex gap-2 items-center">
                <div className="bg-slate-900 p-1 rounded-lg border border-white/10 flex">
                   <button onClick={() => setViewMode('list')} className={`p-1.5 rounded ${viewMode === 'list' ? 'bg-slate-700 text-white' : 'text-slate-500'}`}><List className="w-4 h-4" /></button>
                   <button onClick={() => setViewMode('kanban')} className={`p-1.5 rounded ${viewMode === 'kanban' ? 'bg-slate-700 text-white' : 'text-slate-500'}`}><LayoutGrid className="w-4 h-4" /></button>
                   <button onClick={() => setViewMode('map')} className={`p-1.5 rounded ${viewMode === 'map' ? 'bg-slate-700 text-white' : 'text-slate-500'}`}><MapIcon className="w-4 h-4" /></button>
                </div>
                <Select value={filterTensao} onValueChange={(v:any) => setFilterTensao(v)}>
                   <SelectTrigger className="w-[140px] h-9 bg-slate-900 border-white/10 text-xs"><SelectValue placeholder="Tensão" /></SelectTrigger>
                   <SelectContent className="bg-slate-900 border-slate-800"><SelectItem value="all">Todas Tensões</SelectItem>{TENSAO_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={filterCidade} onValueChange={setFilterCidade}>
                   <SelectTrigger className="w-[140px] h-9 bg-slate-900 border-white/10 text-xs"><SelectValue placeholder="Cidade" /></SelectTrigger>
                   <SelectContent className="bg-slate-900 border-slate-800">
                     <SelectItem value="all">Todas Cidades</SelectItem>
                     {cidadesDisponiveis.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                   </SelectContent>
                </Select>
            </div>
            <Button onClick={handleAddCliente} size="sm" className="bg-cyan-600 h-9 text-xs"><PlusCircle className="w-3 h-3 mr-2" /> Novo</Button>
         </div>

         {/* VIEWS */}
         {viewMode === 'list' && (
            <div className="glass-panel rounded-xl overflow-hidden">
               <table className="w-full text-left">
                  <thead className="bg-slate-900/50 text-[10px] uppercase text-slate-500 font-bold border-b border-white/5">
                     <tr><th className="p-4">Cliente</th><th className="p-4">Consumo</th><th className="p-4">Cidade</th><th className="p-4">Status</th><th className="p-4 text-right"></th></tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-sm">
                     {filteredClientes.map(c => {
                        const total = c.unidades.reduce((acc, u) => acc + (Number(u.consumoKwh)||0), 0);
                        const cidade = c.unidades[0]?.cidade || '-';
                        const style = getTensaoColors(c.tensao);
                        return (
                           <tr key={c.id} onClick={() => setSelectedClienteId(c.id)} className="hover:bg-white/[0.02] cursor-pointer">
                              <td className="p-4 flex items-center gap-3">
                                 <div className={`w-8 h-8 rounded bg-gradient-to-br ${style.gradient} flex items-center justify-center text-white font-bold text-xs`}>{c.nome.charAt(0)}</div>
                                 <div><div className="font-medium text-white">{c.nome}</div><div className="text-xs text-slate-500">{c.tipoPessoa.toUpperCase()}</div></div>
                              </td>
                              <td className="p-4 text-slate-300">{total.toLocaleString()} kWh</td>
                              <td className="p-4 text-slate-400 text-xs">{cidade}</td>
                              <td className="p-4"><span className={`px-2 py-0.5 rounded-full text-[10px] border ${getStatusStyle(c.status).badge}`}>{c.status || 'Nenhum'}</span></td>
                              <td className="p-4 text-right"><Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500"><MoreHorizontal className="w-4 h-4" /></Button></td>
                           </tr>
                        )
                     })}
                  </tbody>
               </table>
            </div>
         )}

         {/* === MAPA DINÂMICO (CIRCULOS) === */}
         {viewMode === 'map' && (
            <div className="w-full h-[600px] bg-slate-900 rounded-xl border border-white/10 overflow-hidden relative">
               {isMapLoaded ? (
                  <GoogleMap 
                    mapContainerStyle={{ width: '100%', height: '100%' }} 
                    center={{ lat: -15.601, lng: -56.097 }}
                    zoom={11} 
                    options={{ styles: mapStyles, disableDefaultUI: true, zoomControl: true }}
                  >
                     {filteredClientes.map(c => {
                        const uc = c.unidades.find(u => u.latitude && u.longitude);
                        if(!uc?.latitude || !uc?.longitude) return null;
                        
                        const kwh = Number(uc.consumoKwh) || 0;
                        const style = getTensaoColors(c.tensao);
                        // Tamanho do circulo baseado no consumo (Min 30px, Max 60px)
                        const size = Math.min(Math.max(30, kwh / 100), 60);

                        return (
                           <OverlayView
                             key={c.id}
                             position={{ lat: uc.latitude, lng: uc.longitude }}
                             mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
                           >
                             <div 
                                onClick={() => setSelectedClienteId(c.id)}
                                className={`
                                    relative flex items-center justify-center rounded-full text-white font-bold cursor-pointer 
                                    transition-all duration-300 hover:scale-125 group
                                    ${style.bgMap} ${style.shadow} shadow-lg border-2 border-slate-900
                                `}
                                style={{ width: `${'size'}px`, height: `${'size'}px`, transform: 'translate(-50%, -50%)' }}
                             >
                                <span className="text-[10px] drop-shadow-md">{formatNumberMap(kwh)}</span>
                                
                                {/* Tooltip com Nome */}
                                <div className="absolute bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white text-xs px-2 py-1 rounded border border-white/10 whitespace-nowrap z-50">
                                    {c.nome}
                                </div>
                             </div>
                           </OverlayView>
                        )
                     })}
                  </GoogleMap>
               ) : <div className="flex items-center justify-center h-full"><Loader2 className="animate-spin" /></div>}
            </div>
         )}

         {viewMode === 'kanban' && (
            <div className="flex gap-4 overflow-x-auto pb-4 h-full">
               {FATURA_STATUS_OPTIONS.map(status => (
                  <div key={status} className="min-w-[280px] bg-slate-900/40 rounded-xl border border-white/5 p-3 flex flex-col gap-3">
                     <div className="text-xs font-bold text-slate-400 uppercase px-1 flex justify-between"><span>{status}</span><span className="bg-slate-800 px-2 rounded-full text-white">{filteredClientes.filter(c => (c.status||'Nenhum') === status).length}</span></div>
                     <div className="flex-1 space-y-3 overflow-y-auto pr-1">
                        {filteredClientes.filter(c => (c.status||'Nenhum') === status).map(c => (
                           <div key={c.id} onClick={() => setSelectedClienteId(c.id)} className="bg-slate-800/60 p-3 rounded-lg border border-white/5 hover:border-cyan-500/50 cursor-pointer shadow-sm">
                              <div className="font-semibold text-sm text-white truncate mb-1">{c.nome}</div>
                              <div className="text-xs text-slate-500">{(c.unidades.reduce((acc,u)=>acc+(Number(u.consumoKwh)||0),0)).toLocaleString()} kWh</div>
                           </div>
                        ))}
                     </div>
                  </div>
               ))}
            </div>
         )}
      </div>

      {/* Drawer */}
      {selectedClienteId && (selectedClienteId !== 'novo' ? clientes.find(c => c.id === selectedClienteId) : null) && (
         // Nota: Lógica do Drawer simplificada para brevidade, usar a mesma do código anterior
         // Apenas certifique-se que handleManualGeocode está acessível aqui
         <div className="fixed inset-0 z-50 flex justify-end">
            <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={() => setSelectedClienteId(null)}></div>
            <div className="relative w-full max-w-lg h-full bg-slate-900 border-l border-white/10 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
               {/* Conteúdo do Drawer (Copiado da versão anterior para manter funcionalidade) */}
               {(() => {
                   const selectedCliente = clientes.find(c => c.id === selectedClienteId)!;
                   return (
                       <>
                       <div className="px-6 py-5 border-b border-white/5 flex justify-between bg-slate-800/50">
                          <div><h2 className="text-lg font-bold text-white">{selectedCliente.nome}</h2><p className="text-sm text-cyan-400">{selectedCliente.tensao} • {selectedCliente.tipoPessoa}</p></div>
                          <button onClick={() => setSelectedClienteId(null)} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
                       </div>
                       <div className="flex-1 overflow-y-auto p-6 space-y-6">
                          {/* Unidades */}
                          {selectedCliente.unidades.map((uc, i) => (
                              <div key={uc.id} className="bg-slate-800/40 p-4 rounded-lg border border-white/5">
                                  <div className="flex justify-between mb-2">
                                      <span className="text-xs font-bold bg-slate-700 px-1.5 py-0.5 rounded text-white">UC {i+1}</span>
                                      {uc.latitude ? <span className="text-xs text-emerald-400 flex items-center gap-1"><MapPin className="w-3 h-3"/> No Mapa</span> : <span className="text-xs text-slate-500">Sem Localização</span>}
                                  </div>
                                  <div className="flex gap-2 mb-3">
                                      <Input placeholder="Consumo" defaultValue={uc.consumoKwh} className="h-8 text-xs bg-slate-900 border-white/10" onBlur={e => {const n=[...selectedCliente.unidades];n[i].consumoKwh=e.target.value;handleUpdateField(selectedCliente.id,'unidades',n)}} />
                                  </div>
                                  {/* Busca Manual */}
                                  <div className="flex gap-2 mb-3">
                                      <Input placeholder="Endereço" defaultValue={uc.endereco} className="h-8 text-xs bg-slate-900 border-white/10" onBlur={e => {const n=[...selectedCliente.unidades];n[i].endereco=e.target.value;handleUpdateField(selectedCliente.id,'unidades',n)}} />
                                      <Button size="sm" variant="secondary" className="h-8" onClick={() => handleManualGeocode(selectedCliente.id, uc.id, uc.endereco || '')}><LocateFixed className="w-4 h-4" /></Button>
                                  </div>
                                  <label className="flex items-center justify-center w-full py-3 border border-dashed border-slate-600 rounded-lg cursor-pointer hover:bg-slate-800 text-xs text-slate-400 transition-colors">
                                      <Upload className="w-3 h-3 mr-2" /> {uc.arquivoFaturaUrl ? 'Trocar Fatura' : 'Upload Fatura (IA)'}
                                      <input type="file" className="hidden" onChange={(e) => handleFileUpload(selectedCliente.id, uc.id, e.target.files?.[0] || null)} />
                                  </label>
                              </div>
                          ))}
                       </div>
                       </>
                   )
               })()}
            </div>
         </div>
      )}
    </div>
  );
}
