
"use client";

import * as React from "react";
import { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  FileText, PlusCircle, Trash2, Upload, Download, Eye, Loader2,
  User as UserIcon, Phone, Filter as FilterIcon, ArrowUpDown, Zap,
  MessageSquare, UserCheck, Paperclip, Search, Bell, TrendingUp, 
  TrendingDown, Minus, Home, AlertCircle, Plus, LayoutGrid, List,
  MoreHorizontal, AlertTriangle, CheckCircle2, X, Share2
} from 'lucide-react';
import { collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc, Timestamp, arrayUnion, arrayRemove, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { uploadFile } from '@/lib/firebase/storage';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { AreaChart, Area, LineChart, Line, ResponsiveContainer } from 'recharts';

// --- TIPOS ---
export type TensaoType = 'baixa' | 'alta' | 'b_optante' | 'baixa_renda';
export type FaturaStatus = 'Nenhum' | 'Contato?' | 'Proposta' | 'Fechamento' | 'Fechado';

export interface UnidadeConsumidora {
  id: string;
  consumoKwh: string;
  valorTotal?: string; // Novo: Para simular TUSD/TE
  precoUnitario?: number;
  temGeracao: boolean;
  arquivoFaturaUrl: string | null;
  nomeArquivo: string | null;
}

export interface Contato {
  id: string;
  nome: string;
  telefone: string;
}

export interface FaturaCliente {
  id: string;
  nome: string;
  tipoPessoa: 'pf' | 'pj';
  tensao: TensaoType;
  unidades: UnidadeConsumidora[];
  contatos: Contato[];
  status?: FaturaStatus;
  feedbackNotes?: string;
  feedbackAttachmentUrl?: string | null;
  createdAt: string | Timestamp; 
  lastUpdatedAt?: string | Timestamp;
  lastUpdatedBy?: { uid: string; name: string };
}

// --- CONFIGURAÇÕES VISUAIS E MOCKS ---
const FATURA_STATUS_OPTIONS: FaturaStatus[] = ['Nenhum', 'Contato?', 'Proposta', 'Fechamento', 'Fechado'];
const TENSAO_OPTIONS: { value: TensaoType; label: string }[] = [
  { value: 'baixa', label: 'Baixa Tensão' },
  { value: 'alta', label: 'Alta Tensão' },
  { value: 'b_optante', label: 'B Optante' },
  { value: 'baixa_renda', label: 'Baixa Renda' },
];

// Lógica de Cores e Estilos
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
    case 'alta': return { gradient: 'from-blue-600 to-cyan-400', text: 'text-blue-400', bg: 'bg-blue-500', shadow: 'shadow-blue-500/20', chartColor: '#3b82f6' };
    case 'baixa': return { gradient: 'from-emerald-500 to-teal-400', text: 'text-emerald-400', bg: 'bg-emerald-500', shadow: 'shadow-emerald-500/20', chartColor: '#10b981' };
    case 'b_optante': return { gradient: 'from-orange-500 to-amber-400', text: 'text-orange-400', bg: 'bg-orange-500', shadow: 'shadow-orange-500/20', chartColor: '#f97316' };
    case 'baixa_renda': return { gradient: 'from-yellow-500 to-lime-400', text: 'text-yellow-400', bg: 'bg-yellow-500', shadow: 'shadow-yellow-500/20', chartColor: '#eab308' };
    default: return { gradient: 'from-slate-500 to-slate-400', text: 'text-slate-400', bg: 'bg-slate-500', shadow: 'shadow-slate-500/20', chartColor: '#64748b' };
  }
};

// Funções de Inteligência Energética (Simulação)
const analyzeEnergyData = (consumoTotal: number) => {
  const anomalies = [];
  // Lógica fake para demonstração
  if (consumoTotal > 30000 && consumoTotal % 2 !== 0) anomalies.push({ type: 'reactive', label: 'Excesso Reativo', cost: 'R$ 450,00' });
  if (consumoTotal > 50000) anomalies.push({ type: 'demand', label: 'Ultrapassagem Demanda', cost: 'R$ 1.200,00' });
  
  // Fake YoY (Year over Year) calculation
  const yoyPercentage = Math.floor(Math.random() * 40) - 20; // Random between -20% and +20%
  
  return { anomalies, yoyPercentage };
};

const generateMiniChartData = (trend: 'up' | 'down') => {
  const data = [];
  let lastValue = Math.random() * 50 + 25; // start between 25 and 75
  for (let i = 0; i < 10; i++) {
    data.push({ value: lastValue });
    if (trend === 'up') {
      lastValue += Math.random() * 10;
    } else {
      lastValue -= Math.random() * 10;
      if (lastValue < 0) lastValue = 0;
    }
  }
  return data;
};

// --- COMPONENTES VISUAIS ---

// Tooltip Personalizado TUSD/TE
const EnergyCostTooltip = ({ value }: { value: number }) => {
  const tusd = value * 0.45;
  const te = value * 0.35;
  const taxes = value * 0.20;

  return (
    <div className="group relative inline-block">
      <span className="cursor-help border-b border-dashed border-slate-500 text-white font-medium">
        R$ {value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
      </span>
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-3 bg-slate-900 border border-slate-700 rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 text-xs">
        <div className="space-y-1">
          <div className="flex justify-between text-slate-400"><span>TUSD (Fio):</span> <span className="text-white">R$ {tusd.toFixed(0)}</span></div>
          <div className="flex justify-between text-slate-400"><span>TE (Energia):</span> <span className="text-white">R$ {te.toFixed(0)}</span></div>
          <div className="flex justify-between text-slate-400"><span>Impostos:</span> <span className="text-white">R$ {taxes.toFixed(0)}</span></div>
          <div className="border-t border-slate-700 mt-1 pt-1 text-center text-[10px] text-cyan-400">Composição Estimada</div>
        </div>
        <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-900"></div>
      </div>
    </div>
  );
};

// Gráficos
const SparklineChart = ({ data, color }: { data: { value: number }[], color: string }) => (
  <div className="h-[80px] w-full -ml-2 mt-2">
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data}>
        <defs>
          <linearGradient id={`gradient-${color}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.4} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2} fill={`url(#gradient-${color})`} />
      </AreaChart>
    </ResponsiveContainer>
  </div>
);

const MiniLineChart = ({ data, color }: { data: { value: number }[], color: string }) => (
  <div className="h-[40px] w-[80px]">
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data}>
        <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  </div>
);

const KPICard = ({ title, value, unit, color, icon: Icon, trend, trendValue, delay }: any) => {
  const colorMap: any = {
    blue: { text: 'text-blue-400', bg: 'bg-blue-500/10', chartColor: '#3b82f6', glow: 'group-hover:shadow-[0_0_20px_rgba(59,130,246,0.3)]' },
    emerald: { text: 'text-emerald-400', bg: 'bg-emerald-500/10', chartColor: '#10b981', glow: 'group-hover:shadow-[0_0_20px_rgba(16,185,129,0.3)]' },
    orange: { text: 'text-orange-400', bg: 'bg-orange-500/10', chartColor: '#f97316', glow: 'group-hover:shadow-[0_0_20px_rgba(249,115,22,0.3)]' },
    yellow: { text: 'text-yellow-400', bg: 'bg-yellow-500/10', chartColor: '#eab308', glow: 'group-hover:shadow-[0_0_20px_rgba(234,179,8,0.3)]' },
  };
  const styles = colorMap[color];
  const sparkData = useMemo(() => Array.from({ length: 10 }, () => ({ value: Math.floor(Math.random() * 50) + 20 })), []);

  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor = trend === 'up' ? 'text-emerald-400 bg-emerald-500/10' : trend === 'down' ? 'text-red-400 bg-red-500/10' : 'text-slate-400 bg-slate-700/50';

  return (
    <div className={`glass-panel rounded-2xl overflow-hidden hover:scale-[1.02] transition-all duration-300 group animate-slide-up relative border border-white/5 bg-slate-900/40 backdrop-blur-md`} style={{ animationDelay: delay }}>
       <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-2xl ${styles.glow} border border-transparent`} />
      <div className="p-6 pb-0 relative z-10">
        <div className="flex justify-between items-start">
          <div>
            <p className={`text-xs font-bold ${styles.text} uppercase tracking-wider mb-1`}>{title}</p>
            <h3 className="text-3xl font-bold text-white tracking-tight">
              {value.toLocaleString('pt-BR')} <span className="text-sm text-slate-500 font-normal">{unit}</span>
            </h3>
          </div>
          <div className={`p-2.5 ${styles.bg} rounded-xl ${styles.text} transition-colors`}>
            <Icon className="w-5 h-5" />
          </div>
        </div>
        <div className={`mt-3 flex items-center gap-1.5 text-xs font-medium ${trendColor} w-fit px-2.5 py-1 rounded-full`}>
          <TrendIcon className="w-3 h-3" /> {trendValue}
        </div>
      </div>
      <SparklineChart data={sparkData} color={styles.chartColor} />
    </div>
  );
};

// --- PÁGINA PRINCIPAL ---

export default function FaturasPage() {
  const { toast } = useToast();
  const { appUser } = useAuth();
  const [clientes, setClientes] = useState<FaturaCliente[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // State para Drawer & Seleção
  const [selectedClienteId, setSelectedClienteId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // UI States
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTensao, setFilterTensao] = useState<TensaoType | 'all'>('all');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc' | 'none'>('none');

  // Fetch Data
  useEffect(() => {
    const faturasCollectionRef = collection(db, 'faturas_clientes');
    const q = query(faturasCollectionRef, orderBy("createdAt", "asc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const faturasData = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
          lastUpdatedAt: data.lastUpdatedAt instanceof Timestamp ? data.lastUpdatedAt.toDate().toISOString() : undefined,
        }
      }) as FaturaCliente[];
      setClientes(faturasData);
      setIsLoading(false);
    }, (error) => {
      console.error(error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Filter & Logic
  const { filteredClientes, kpiData } = useMemo(() => {
    let result = [...clientes];
    const totals = { alta: 0, baixa: 0, b_optante: 0, baixa_renda: 0 };
    
    clientes.forEach(c => {
      const consumo = c.unidades.reduce((acc, u) => acc + (Number(u.consumoKwh) || 0), 0);
      if (totals[c.tensao] !== undefined) totals[c.tensao] += consumo;
    });

    if (searchTerm) result = result.filter(c => c.nome.toLowerCase().includes(searchTerm.toLowerCase()));
    if (filterTensao !== 'all') result = result.filter(c => c.tensao === filterTensao);
    
    if (sortOrder !== 'none') {
      result.sort((a, b) => {
        const consA = a.unidades.reduce((acc, u) => acc + (Number(u.consumoKwh) || 0), 0);
        const consB = b.unidades.reduce((acc, u) => acc + (Number(u.consumoKwh) || 0), 0);
        return sortOrder === 'asc' ? consA - consB : consB - a;
      });
    }
    return { filteredClientes: result, kpiData: totals };
  }, [clientes, searchTerm, filterTensao, sortOrder]);

  // Handlers
  const handleAddCliente = async () => {
    const newClienteData = {
      nome: 'Novo Cliente', tipoPessoa: 'pj', tensao: 'baixa',
      unidades: [{ id: crypto.randomUUID(), consumoKwh: '', temGeracao: false, arquivoFaturaUrl: null, nomeArquivo: null }],
      contatos: [{ id: crypto.randomUUID(), nome: '', telefone: '' }],
      createdAt: Timestamp.now(), status: 'Nenhum', feedbackNotes: '',
    };
    try {
      const docRef = await addDoc(collection(db, 'faturas_clientes'), newClienteData);
      setSelectedClienteId(docRef.id);
    } catch (error) { toast({ title: "Erro", variant: "destructive" }); }
  };
  
  const handleAddUnidade = async (clienteId: string) => {
    const clienteRef = doc(db, 'faturas_clientes', clienteId);
    const newUnidade = { id: crypto.randomUUID(), consumoKwh: '', temGeracao: false, arquivoFaturaUrl: null, nomeArquivo: null };
    try {
      await updateDoc(clienteRef, {
        unidades: arrayUnion(newUnidade)
      });
    } catch (e) { toast({ title: "Erro", variant: "destructive" }); }
  };

  const handleRemoveUnidade = async (clienteId: string, unidadeToRemove: UnidadeConsumidora) => {
    const clienteRef = doc(db, 'faturas_clientes', clienteId);
    try {
      await updateDoc(clienteRef, {
        unidades: arrayRemove(unidadeToRemove)
      });
    } catch (e) { toast({ title: "Erro", variant: "destructive" }); }
  };

  const handleAddContato = async (clienteId: string) => {
    const clienteRef = doc(db, 'faturas_clientes', clienteId);
    const newContato = { id: crypto.randomUUID(), nome: '', telefone: '' };
    try {
      await updateDoc(clienteRef, {
        contatos: arrayUnion(newContato)
      });
    } catch (e) { toast({ title: "Erro", variant: "destructive" }); }
  };
  
  const handleRemoveContato = async (clienteId: string, contatoToRemove: Contato) => {
    const clienteRef = doc(db, 'faturas_clientes', clienteId);
    try {
      await updateDoc(clienteRef, {
        contatos: arrayRemove(contatoToRemove)
      });
    } catch (e) { toast({ title: "Erro", variant: "destructive" }); }
  };

  const handleUpdateField = async (clienteId: string, field: string, value: any) => {
    const ref = doc(db, 'faturas_clientes', clienteId);
    try {
      const updateData: any = { [field]: value, lastUpdatedAt: Timestamp.now() };
      if (appUser) updateData.lastUpdatedBy = { uid: appUser.uid, name: appUser.displayName || 'User' };
      await updateDoc(ref, updateData);
    } catch (e) { toast({ title: "Erro ao Salvar", variant: "destructive" }); }
  };
  
  const handleFileUpload = async (clienteId: string, unidadeId: string, file: File | null) => {
    if (!file) return;

    // 1. Feedback visual imediato
    toast({ 
      title: "🤖 Analisando Fatura...", 
      description: "A IA está lendo o consumo e valores. Aguarde...",
    });

    try {
      // 2. Envia para a API de IA
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/process-fatura', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Falha na IA');
      
      const dadosIA = await response.json();

      // 3. Mostra o que a IA achou
      toast({ 
        title: "Leitura Concluída!", 
        description: `Cliente: ${dadosIA.nomeCliente?.substring(0, 15) || 'N/A'}... | Consumo: ${dadosIA.consumoKwh || 0} kWh`,
        className: "bg-emerald-500/10 border-emerald-500/50 text-emerald-400"
      });

      // 4. Faz o upload do arquivo para o Storage
      const path = `faturas/${clienteId}/${unidadeId}/${file.name}`;
      const url = await uploadFile(file, path);

      // 5. Atualiza o Firestore com dados da IA + URL
      const clienteAtual = clientes.find(c => c.id === clienteId);
      if(clienteAtual) {
          const novasUnidades = clienteAtual.unidades.map(u => u.id === unidadeId ? { 
              ...u, 
              arquivoFaturaUrl: url, 
              nomeArquivo: file.name,
              consumoKwh: dadosIA.consumoKwh?.toString() || u.consumoKwh,
              valorTotal: dadosIA.valorTotal?.toString() || u.valorTotal,
              precoUnitario: dadosIA.precoUnitario,
          } : u);
          
          await handleUpdateField(clienteId, 'unidades', novasUnidades);
          
          if (clienteAtual.nome === 'Novo Cliente' && dadosIA.nomeCliente) {
             await handleUpdateField(clienteId, 'nome', dadosIA.nomeCliente);
          }
          toast({ title: "Sucesso!", description: "Fatura anexada e dados atualizados." });
      }
    } catch (e) {
      console.error(e);
      toast({ title: "Erro", description: "Não foi possível ler a fatura automaticamente. O arquivo foi anexado, mas os dados precisam ser inseridos manualmente.", variant: "destructive" });
       // Fallback: anexa o arquivo mesmo se a IA falhar
      try {
        const path = `faturas/${clienteId}/${unidadeId}/${file.name}`;
        const url = await uploadFile(file, path);
        const clienteAtual = clientes.find(c => c.id === clienteId);
        if (clienteAtual) {
          const novasUnidades = clienteAtual.unidades.map(u => u.id === unidadeId ? { ...u, arquivoFaturaUrl: url, nomeArquivo: file.name } : u);
          await handleUpdateField(clienteId, 'unidades', novasUnidades);
        }
      } catch (uploadError) {
        console.error("Upload fallback error:", uploadError);
      }
    }
  };


  const handleFeedbackFileChange = async (e: React.ChangeEvent<HTMLInputElement>, clienteId: string) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      toast({ title: "Enviando anexo..." });
      try {
        const filePath = `faturas_feedback/${clienteId}/${Date.now()}-${file.name}`;
        const downloadURL = await uploadFile(file, filePath);
        await handleUpdateField(clienteId, 'feedbackAttachmentUrl', downloadURL);
        toast({ title: "Anexo enviado com sucesso!", variant: 'default' });
      } catch (error) {
        toast({ title: "Erro no upload", description: "Não foi possível enviar o arquivo.", variant: "destructive" });
      }
    }
  };

  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
    setSelectedIds(newSet);
  };

  // Cliente selecionado para o Drawer
  const selectedCliente = useMemo(() => clientes.find(c => c.id === selectedClienteId), [clientes, selectedClienteId]);

  if (isLoading) return <div className="h-screen bg-slate-950 flex items-center justify-center text-cyan-500"><Loader2 className="animate-spin w-8 h-8" /></div>;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-300 font-sans relative overflow-hidden">
      
      {/* Styles & Animation */}
      <style jsx global>{`
        .glass-panel { background: rgba(15, 23, 42, 0.6); backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.05); box-shadow: 0 4px 30px rgba(0, 0, 0, 0.1); }
        .shimmer { position: relative; overflow: hidden; }
        .shimmer::after { content: ''; position: absolute; top: 0; right: 0; bottom: 0; left: 0; transform: translateX(-100%); background-image: linear-gradient(90deg, rgba(255,255,255,0) 0, rgba(255,255,255,0.1) 20%, rgba(255,255,255,0.05) 60%, rgba(255,255,255,0)); animation: shimmer 3s infinite; }
        @keyframes shimmer { 100% { transform: translateX(100%); } }
        /* Drawer Transition */
        .drawer-enter { transform: translateX(100%); }
        .drawer-enter-active { transform: translateX(0); transition: transform 300ms ease-out; }
        .drawer-exit { transform: translateX(0); }
        .drawer-exit-active { transform: translateX(100%); transition: transform 300ms ease-in; }
      `}</style>

      {/* Background */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl opacity-40"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl opacity-40"></div>
      </div>

      <main className="relative z-10 flex flex-col h-screen overflow-hidden">
        
        {/* Header */}
        <header className="h-16 flex items-center justify-between px-6 border-b border-white/5 bg-slate-900/50 backdrop-blur-md">
          <div className="flex items-center gap-3">
             <div className="p-1.5 bg-gradient-to-tr from-cyan-500 to-blue-600 rounded-lg shadow-lg"><Zap className="h-4 w-4 text-white" /></div>
             <h2 className="font-bold text-white tracking-tight">Gestão de Faturas</h2>
          </div>
          <div className="flex items-center gap-4">
            <div className={`relative transition-all duration-300 ${searchOpen ? 'w-64' : 'w-10'}`}>
               <button onClick={() => setSearchOpen(!searchOpen)} className="absolute left-0 top-0 h-9 w-10 flex items-center justify-center text-slate-400 hover:text-white"><Search className="w-4 h-4" /></button>
               <Input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Buscar..." className={`h-9 bg-slate-800/80 border-white/10 rounded-full pl-10 pr-4 text-xs text-white ${searchOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} />
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 pb-20 custom-scrollbar">
          
          {/* KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <KPICard title="Alta Tensão" value={kpiData.alta} unit="kWh" color="blue" icon={Zap} trend="up" trendValue="+12%" delay="0s" />
            <KPICard title="Baixa Tensão" value={kpiData.baixa} unit="kWh" color="emerald" icon={Home} trend="up" trendValue="+4%" delay="0.1s" />
            <KPICard title="B Optante" value={kpiData.b_optante} unit="kWh" color="orange" icon={AlertCircle} trend="stable" trendValue="0%" delay="0.2s" />
            <KPICard title="Baixa Renda" value={kpiData.baixa_renda} unit="kWh" color="yellow" icon={Minus} trend="down" trendValue="-2%" delay="0.3s" />
          </div>

          {/* Actions & Filters */}
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-4">
             <div className="flex items-center gap-2">
                {/* View Toggle */}
                <div className="bg-slate-900 p-1 rounded-lg border border-white/10 flex">
                   <button onClick={() => setViewMode('list')} className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'}`}><List className="w-4 h-4" /></button>
                   <button onClick={() => setViewMode('kanban')} className={`p-1.5 rounded-md transition-all ${viewMode === 'kanban' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'}`}><LayoutGrid className="w-4 h-4" /></button>
                </div>
                <div className="h-6 w-px bg-white/10 mx-2"></div>
                <Select value={filterTensao} onValueChange={(v:any) => setFilterTensao(v)}>
                   <SelectTrigger className="w-[140px] h-9 bg-slate-900 border-white/10 text-xs"><SelectValue /></SelectTrigger>
                   <SelectContent className="bg-slate-900 border-slate-800"><SelectItem value="all">Todas</SelectItem>{TENSAO_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
             </div>
             <Button onClick={handleAddCliente} size="sm" className="bg-cyan-600 hover:bg-cyan-500 h-9 text-xs"><PlusCircle className="w-3 h-3 mr-2" /> Novo Cliente</Button>
          </div>

          {/* Bulk Actions Floating Bar */}
          {selectedIds.size > 0 && (
             <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-cyan-600 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-4 z-40 animate-slide-up">
                <span className="font-bold text-sm">{selectedIds.size} selecionados</span>
                <div className="h-4 w-px bg-white/30"></div>
                <button className="flex items-center gap-1 hover:text-cyan-100 text-xs font-medium"><Download className="w-4 h-4" /> Baixar ZIP</button>
                <button className="flex items-center gap-1 hover:text-cyan-100 text-xs font-medium"><Share2 className="w-4 h-4" /> Enviar Whats</button>
                <button onClick={() => setSelectedIds(new Set())} className="ml-2 p-1 hover:bg-cyan-700 rounded-full"><X className="w-4 h-4" /></button>
             </div>
          )}

          {/* LIST VIEW */}
          {viewMode === 'list' && (
            <div className="glass-panel rounded-xl overflow-hidden">
               <table className="w-full text-left border-collapse">
                  <thead>
                     <tr className="bg-slate-900/50 text-[10px] uppercase text-slate-500 font-bold tracking-wider border-b border-white/5">
                        <th className="p-4 w-10"><Checkbox checked={selectedIds.size === filteredClientes.length && filteredClientes.length > 0} onCheckedChange={(c) => { if(c) setSelectedIds(new Set(filteredClientes.map(c => c.id))); else setSelectedIds(new Set()); }} className="border-slate-600 data-[state=checked]:bg-cyan-500" /></th>
                        <th className="p-4">Cliente</th>
                        <th className="p-4">Tendência</th>
                        <th className="p-4">Consumo & Custo</th>
                        <th className="p-4">Status</th>
                        <th className="p-4 text-right">Ações</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-sm">
                     {filteredClientes.map(cliente => {
                        const totalConsumo = cliente.unidades.reduce((acc, u) => acc + (Number(u.consumoKwh) || 0), 0);
                        const valorEstimado = totalConsumo * 0.92; // R$ 0,92 por kWh (Simulado)
                        const { anomalies, yoyPercentage } = analyzeEnergyData(totalConsumo);
                        const style = getTensaoColors(cliente.tensao);
                        const statusStyle = getStatusStyle(cliente.status);

                        const tensaoPrefix = ['baixa', 'b_optante', 'baixa_renda'].includes(cliente.tensao) ? 'B' : 'A';
                        const prefixStyle = tensaoPrefix === 'A' 
                            ? 'bg-blue-500 text-white' 
                            : 'bg-emerald-500 text-white';

                        return (
                           <tr key={cliente.id} onClick={() => setSelectedClienteId(cliente.id)} className="group hover:bg-white/[0.02] transition-colors cursor-pointer">
                              <td className="p-4"><Checkbox checked={selectedIds.has(cliente.id)} onClick={(e) => { e.stopPropagation(); toggleSelection(cliente.id); }} className="border-slate-600 data-[state=checked]:bg-cyan-500" /></td>
                              <td className="p-4">
                                 <div className="flex items-center gap-3">
                                    <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shadow-lg ${prefixStyle}`}>{tensaoPrefix}</div>
                                    <div>
                                       <div className="font-semibold text-white group-hover:text-cyan-400 transition-colors">{cliente.nome}</div>
                                       <div className="text-xs text-slate-500 flex gap-2">
                                          {cliente.tipoPessoa.toUpperCase()} • {anomalies.length > 0 && <span className="text-red-400 font-medium flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Atenção</span>}
                                       </div>
                                    </div>
                                 </div>
                              </td>
                              <td className="p-4"><MiniLineChart data={generateMiniChartData(totalConsumo > 20000 ? 'up' : 'down')} color={style.chartColor} /></td>
                              <td className="p-4">
                                 <div className="flex flex-col">
                                    <span className="text-slate-300 text-xs">{totalConsumo.toLocaleString('pt-BR')} kWh</span>
                                    <EnergyCostTooltip value={valorEstimado} />
                                    <div className={`text-[10px] flex items-center gap-1 mt-1 ${yoyPercentage > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                                       {yoyPercentage > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                       {Math.abs(yoyPercentage)}% vs ano ant.
                                    </div>
                                 </div>
                              </td>
                              <td className="p-4">
                                 <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium border ${statusStyle.badge}`}>
                                    {['Contato?', 'Fechamento'].includes(cliente.status || '') && <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse"></span>}
                                    {cliente.status || 'Nenhum'}
                                 </span>
                              </td>
                              <td className="p-4 text-right">
                                 <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-white" onClick={(e) => { e.stopPropagation(); }}><MoreHorizontal className="w-4 h-4" /></Button>
                              </td>
                           </tr>
                        );
                     })}
                  </tbody>
               </table>
            </div>
          )}

          {/* KANBAN VIEW */}
          {viewMode === 'kanban' && (
             <div className="flex gap-4 overflow-x-auto pb-4 h-full">
                {FATURA_STATUS_OPTIONS.map(status => (
                   <div key={status} className="min-w-[280px] bg-slate-900/40 rounded-xl border border-white/5 p-3 flex flex-col gap-3">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase px-1">
                         <span>{status}</span>
                         <span className="bg-slate-800 px-2 py-0.5 rounded-full text-white">{filteredClientes.filter(c => (c.status || 'Nenhum') === status).length}</span>
                      </div>
                      <div className="flex-1 space-y-3 overflow-y-auto pr-1 custom-scrollbar">
                         {filteredClientes.filter(c => (c.status || 'Nenhum') === status).map(cliente => (
                            <div key={cliente.id} onClick={() => setSelectedClienteId(cliente.id)} className="bg-slate-800/60 p-3 rounded-lg border border-white/5 hover:border-cyan-500/50 cursor-pointer group shadow-sm">
                               <div className="flex justify-between items-start mb-2">
                                  <span className="font-semibold text-sm text-white group-hover:text-cyan-400 truncate w-32">{cliente.nome}</span>
                                  {cliente.tensao === 'alta' && <Zap className="w-3 h-3 text-blue-400" />}
                               </div>
                               <div className="text-xs text-slate-500 mb-2">
                                  {cliente.unidades.length} UCs • {(cliente.unidades.reduce((acc, u) => acc + (Number(u.consumoKwh) || 0), 0)).toLocaleString('pt-BR')} kWh
                               </div>
                               <div className="flex justify-between items-center mt-2 border-t border-white/5 pt-2">
                                  <span className="text-[10px] text-slate-600">{cliente.lastUpdatedBy?.name || 'Sistema'}</span>
                                  <div className="h-2 w-2 rounded-full bg-emerald-500"></div>
                               </div>
                            </div>
                         ))}
                      </div>
                   </div>
                ))}
             </div>
          )}

        </div>
      </main>

      {/* --- DRAWER (GAVETA LATERAL) --- */}
      {selectedClienteId && selectedCliente && (
        <div className="fixed inset-0 z-50 flex justify-end" role="dialog">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity" onClick={() => setSelectedClienteId(null)}></div>
          
          {/* Panel */}
          <div className="relative w-full max-w-lg h-full bg-slate-900 border-l border-white/10 shadow-2xl flex flex-col transform transition-transform duration-300 ease-in-out">
             
             {/* Drawer Header */}
             <div className="px-6 py-5 border-b border-white/5 flex justify-between items-start bg-slate-800/50">
                <div>
                   <h2 className="text-lg font-bold text-white">{selectedCliente.nome}</h2>
                   <p className="text-sm text-cyan-400 flex items-center gap-2">
                      {selectedCliente.tensao === 'alta' ? 'Alta Tensão (A4)' : 'Baixa Tensão (B)'} • {selectedCliente.tipoPessoa.toUpperCase()}
                   </p>
                </div>
                <button onClick={() => setSelectedClienteId(null)} className="text-slate-400 hover:text-white p-1 hover:bg-white/10 rounded-lg"><X className="w-5 h-5" /></button>
             </div>

             {/* Drawer Body */}
             <div className="flex-1 overflow-y-auto p-6 space-y-6">
                
                {/* 1. Alertas de Energia (Badges) */}
                {(() => {
                   const total = selectedCliente.unidades.reduce((acc, u) => acc + (Number(u.consumoKwh) || 0), 0);
                   const { anomalies } = analyzeEnergyData(total);
                   if (anomalies.length > 0) return (
                      <div className="space-y-2">
                         <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Anomalias Detectadas</h3>
                         {anomalies.map((a, i) => (
                            <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                               <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5" />
                               <div>
                                  <div className="text-sm font-semibold text-red-400">{a.label}</div>
                                  <div className="text-xs text-red-300/70">Multa estimada: {a.cost}</div>
                               </div>
                            </div>
                         ))}
                      </div>
                   );
                })()}

                {/* 2. Ações Rápidas */}
                <div className="grid grid-cols-2 gap-3">
                   <Button variant="outline" className="border-slate-700 hover:bg-slate-800 text-slate-300"><FileText className="w-4 h-4 mr-2" /> Histórico PDF</Button>
                   <Button variant="outline" className="border-slate-700 hover:bg-slate-800 text-slate-300"><MessageSquare className="w-4 h-4 mr-2" /> Contestar</Button>
                </div>

                {/* 3. Unidades Consumidoras */}
                <div className="space-y-3">
                   <div className="flex justify-between items-center">
                      <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Unidades (UCs)</h3>
                      <button className="text-xs text-cyan-500 hover:underline" onClick={() => handleAddUnidade(selectedCliente.id)}>+ Adicionar</button>
                   </div>
                   {selectedCliente.unidades.map((uc, i) => (
                      <div key={uc.id} className="bg-slate-800/40 p-3 rounded-lg border border-white/5">
                         <div className="flex justify-between mb-2">
                            <span className="text-xs font-bold bg-slate-700 px-1.5 py-0.5 rounded text-white">UC {i+1}</span>
                            <span className="text-xs text-slate-400">{uc.temGeracao ? 'Com GD ☀️' : 'Sem GD'}</span>
                         </div>
                         <div className="flex gap-2 mb-2">
                            <Input placeholder="Consumo" defaultValue={uc.consumoKwh} className="h-8 text-xs bg-slate-900 border-white/10" onBlur={(e) => { const n = [...selectedCliente.unidades]; n[i].consumoKwh = e.target.value; handleUpdateField(selectedCliente.id, 'unidades', n); }} />
                            <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-slate-700" onClick={() => window.open(uc.arquivoFaturaUrl || '', '_blank')} disabled={!uc.arquivoFaturaUrl}><Eye className="w-4 h-4" /></Button>
                         </div>
                         <label className="flex items-center justify-center w-full py-2 border border-dashed border-slate-600 rounded-lg cursor-pointer hover:bg-slate-800 text-xs text-slate-400">
                            <Upload className="w-3 h-3 mr-2" /> {uc.nomeArquivo || 'Anexar Fatura'}
                            <input type="file" className="hidden" onChange={(e) => handleFileUpload(selectedCliente.id, uc.id, e.target.files ? e.target.files[0] : null)} /> 
                         </label>
                      </div>
                   ))}
                </div>

                {/* 4. Timeline / Status */}
                <div className="border-t border-white/10 pt-4">
                   <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Feedback e status</h3>
                  <Textarea placeholder="Adicione uma observação sobre o contato..." defaultValue={selectedCliente.feedbackNotes} onBlur={(e) => handleUpdateField(selectedCliente.id, 'feedbackNotes', e.target.value)} className="bg-slate-800/60 border-slate-700 text-sm mb-2" />
                  <div className="flex items-center gap-2">
                    <label htmlFor="feedback-attachment" className="flex-1">
                      <Button asChild variant="outline" className="w-full border-slate-700 hover:bg-slate-800">
                        <span className="flex items-center"><Paperclip className="w-4 h-4 mr-2" />Anexar Comprovante</span>
                      </Button>
                      <input id="feedback-attachment" type="file" className="hidden" onChange={(e) => handleFeedbackFileChange(e, selectedCliente.id)} />
                    </label>
                    {selectedCliente.feedbackAttachmentUrl && <a href={selectedCliente.feedbackAttachmentUrl} target="_blank" rel="noopener noreferrer"><Button variant="secondary" size="sm">Ver Anexo</Button></a>}
                  </div>
                   <div className="mt-4">
                      <Label className="text-xs text-slate-400">Mudar Status</Label>
                      <Select value={selectedCliente.status} onValueChange={(v) => handleUpdateField(selectedCliente.id, 'status', v)}>
                         <SelectTrigger className="w-full bg-slate-800 border-white/10 mt-1"><SelectValue /></SelectTrigger>
                         <SelectContent className="bg-slate-900 border-slate-700"><SelectItem value="Nenhum">Selecione...</SelectItem>{FATURA_STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                      </Select>
                   </div>
                </div>

             </div>

             {/* Drawer Footer */}
             <div className="p-4 border-t border-white/5 bg-slate-800/30 flex justify-end gap-2">
                <Button variant="ghost" onClick={() => deleteDoc(doc(db, 'faturas_clientes', selectedCliente.id))} className="text-red-400 hover:text-red-300 hover:bg-red-500/10">Excluir Cliente</Button>
                <Button onClick={() => setSelectedClienteId(null)} className="bg-cyan-600 hover:bg-cyan-500">Salvar & Fechar</Button>
             </div>

          </div>
        </div>
      )}

    </div>
  );
}
