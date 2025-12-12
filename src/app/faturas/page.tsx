"use client";

import * as React from "react";
import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {
  FileText, PlusCircle, Trash2, Upload, Download, Eye, Loader2,
  User as UserIcon, Phone, Filter as FilterIcon, ArrowUpDown, Zap,
  MessageSquare, UserCheck, ChevronDown, ChevronUp, Paperclip,
  Search, Bell, MoreHorizontal, TrendingUp, TrendingDown, Minus,
  Home, AlertCircle, Plus
} from 'lucide-react';
import { collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc, Timestamp, arrayUnion, arrayRemove, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { uploadFile } from '@/lib/firebase/storage';
import { useToast } from '@/hooks/use-toast';
import type { FaturaCliente, UnidadeConsumidora, Contato, FaturaStatus, TensaoType } from '@/types/faturas';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { Textarea } from '@/components/ui/textarea';
import { AreaChart, Area, LineChart, Line, ResponsiveContainer } from 'recharts';

// Constantes
const FATURA_STATUS_OPTIONS: FaturaStatus[] = ['Nenhum', 'Contato?', 'Proposta', 'Fechamento', 'Fechado'];
const TENSAO_OPTIONS: { value: TensaoType; label: string }[] = [
  { value: 'baixa', label: 'Baixa Tensão' },
  { value: 'alta', label: 'Alta Tensão' },
  { value: 'b_optante', label: 'B Optante' },
  { value: 'baixa_renda', label: 'Baixa Renda' },
];

// Dados fake para sparklines (você pode substituir por dados reais)
const generateSparklineData = () => Array.from({ length: 7 }, () => ({ value: Math.random() * 100 + 20 }));
const generateMiniChartData = (trend: 'up' | 'down' | 'stable') => {
  const base = Math.random() * 50 + 20;
  return Array.from({ length: 5 }, (_, i) => ({
    value: trend === 'up' ? base + i * 10 + Math.random() * 5 :
           trend === 'down' ? base - i * 8 + Math.random() * 5 :
           base + Math.random() * 10 - 5
  }));
};

// Estilos por status
const getStatusStyle = (status?: FaturaStatus) => {
  switch (status) {
    case 'Contato?': return { badge: 'bg-sky-500/10 text-sky-400 border-sky-500/20', glow: 'shadow-[0_0_10px_rgba(14,165,233,0.2)]', border: 'border-l-sky-500' };
    case 'Proposta': return { badge: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20', glow: '', border: 'border-l-indigo-500' };
    case 'Fechamento': return { badge: 'bg-purple-500/10 text-purple-400 border-purple-500/20', glow: '', border: 'border-l-purple-500' };
    case 'Fechado': return { badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', glow: 'shadow-[0_0_10px_rgba(16,185,129,0.2)]', border: 'border-l-emerald-500' };
    default: return { badge: 'bg-slate-800 text-slate-400 border-slate-700', glow: '', border: 'border-l-transparent' };
  }
};

// Cores por tipo de tensão
const getTensaoColors = (tensao: TensaoType) => {
  switch (tensao) {
    case 'alta': return { gradient: 'from-blue-500 to-cyan-400', text: 'text-blue-400', bg: 'bg-blue-500', shadow: 'shadow-blue-500/20' };
    case 'baixa': return { gradient: 'from-emerald-500 to-teal-400', text: 'text-emerald-400', bg: 'bg-emerald-500', shadow: 'shadow-emerald-500/20' };
    case 'b_optante': return { gradient: 'from-orange-500 to-amber-400', text: 'text-orange-400', bg: 'bg-orange-500', shadow: 'shadow-orange-500/20' };
    case 'baixa_renda': return { gradient: 'from-yellow-500 to-lime-400', text: 'text-yellow-400', bg: 'bg-yellow-500', shadow: 'shadow-yellow-500/20' };
    default: return { gradient: 'from-slate-500 to-slate-400', text: 'text-slate-400', bg: 'bg-slate-500', shadow: 'shadow-slate-500/20' };
  }
};

// Componente SparklineChart
const SparklineChart = ({ data, color }: { data: { value: number }[], color: string }) => (
  <ResponsiveContainer width="100%" height={80}>
    <AreaChart data={data}>
      <defs>
        <linearGradient id={`gradient-${color}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.4} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <Area
        type="monotone"
        dataKey="value"
        stroke={color}
        strokeWidth={2}
        fill={`url(#gradient-${color})`}
      />
    </AreaChart>
  </ResponsiveContainer>
);

// Componente MiniChart para tabela
const MiniLineChart = ({ data, color }: { data: { value: number }[], color: string }) => (
  <ResponsiveContainer width={96} height={40}>
    <LineChart data={data}>
      <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={false} />
    </LineChart>
  </ResponsiveContainer>
);

// Componente KPI Card
const KPICard = ({
  title,
  value,
  unit,
  color,
  icon: Icon,
  trend,
  trendValue,
  delay
}: {
  title: string;
  value: number;
  unit: string;
  color: 'blue' | 'emerald' | 'orange' | 'yellow';
  icon: React.ElementType;
  trend?: 'up' | 'down' | 'stable';
  trendValue?: string;
  delay: string;
}) => {
  const colorMap = {
    blue: { text: 'text-blue-400', bg: 'bg-blue-500/10', hover: 'group-hover:bg-blue-500', chartColor: '#3b82f6', glow: 'shadow-[0_0_15px_rgba(59,130,246,0.5)]' },
    emerald: { text: 'text-emerald-400', bg: 'bg-emerald-500/10', hover: 'group-hover:bg-emerald-500', chartColor: '#10b981', glow: 'shadow-[0_0_15px_rgba(16,185,129,0.5)]' },
    orange: { text: 'text-orange-400', bg: 'bg-orange-500/10', hover: 'group-hover:bg-orange-500', chartColor: '#f97316', glow: 'shadow-[0_0_15px_rgba(249,115,22,0.5)]' },
    yellow: { text: 'text-yellow-400', bg: 'bg-yellow-500/10', hover: 'group-hover:bg-yellow-500', chartColor: '#eab308', glow: 'shadow-[0_0_15px_rgba(234,179,8,0.5)]' },
  };

  const styles = colorMap[color];
  const sparkData = useMemo(() => generateSparklineData(), []);

  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendBg = trend === 'up' ? 'bg-emerald-500/10 text-emerald-400' :
                 trend === 'down' ? 'bg-red-500/10 text-red-400' :
                 'bg-slate-700/50 text-slate-400';

  return (
    <div
      className="glass-panel p-0 rounded-2xl overflow-hidden hover:scale-[1.02] transition-transform duration-300 group animate-slide-up"
      style={{ animationDelay: delay }}
    >
      <div className="p-6 pb-0 relative z-10">
        <div className="flex justify-between items-start">
          <div>
            <p className={`text-xs font-semibold ${styles.text} uppercase tracking-wider mb-1`}>{title}</p>
            <h3 className="text-2xl font-bold text-white">
              {value.toLocaleString('pt-BR')} <span className="text-sm text-slate-500 font-normal">{unit}</span>
            </h3>
          </div>
          <div className={`p-2 ${styles.bg} rounded-lg ${styles.text} ${styles.hover} group-hover:text-white transition-colors ${styles.glow}`}>
            <Icon className="w-5 h-5" />
          </div>
        </div>
        <div className={`mt-2 flex items-center gap-1 text-xs ${trendBg} w-fit px-2 py-1 rounded-full`}>
          <TrendIcon className="w-3 h-3" /> {trendValue || '0%'}
        </div>
      </div>
      <div className="-ml-2 mt-2">
        <SparklineChart data={sparkData} color={styles.chartColor} />
      </div>
    </div>
  );
};

// Componente Principal
export default function FaturasPage() {
  const { toast } = useToast();
  const { appUser } = useAuth();
  const [clientes, setClientes] = useState<FaturaCliente[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedClientId, setExpandedClientId] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Filtros
  const [filterTensao, setFilterTensao] = useState<TensaoType | 'all'>('all');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc' | 'none'>('none');

  // Fetch dados
  useEffect(() => {
    const faturasCollectionRef = collection(db, 'faturas_clientes');
    const q = query(faturasCollectionRef, orderBy("createdAt", "asc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const faturasData = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt ? (data.createdAt as Timestamp).toDate().toISOString() : new Date().toISOString(),
          lastUpdatedAt: data.lastUpdatedAt ? (data.lastUpdatedAt as Timestamp).toDate().toISOString() : undefined,
        }
      }) as FaturaCliente[];
      setClientes(faturasData);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching faturas: ", error);
      toast({ title: "Erro ao Carregar Dados", description: "Não foi possível buscar os dados do Firestore.", variant: "destructive" });
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [toast]);

  // Filtrar e ordenar
  const filteredAndSortedClientes = useMemo(() => {
    let filtered = [...clientes];

    // Filtro por busca
    if (searchTerm) {
      filtered = filtered.filter(c =>
        c.nome.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filtro por tensão
    if (filterTensao !== 'all') {
      filtered = filtered.filter(cliente => cliente.tensao === filterTensao);
    }

    // Ordenar por kWh
    if (sortOrder !== 'none') {
      filtered.sort((a, b) => {
        const totalConsumoA = a.unidades.reduce((sum, u) => sum + (parseInt(u.consumoKwh) || 0), 0);
        const totalConsumoB = b.unidades.reduce((sum, u) => sum + (parseInt(u.consumoKwh) || 0), 0);
        return sortOrder === 'asc' ? totalConsumoA - totalConsumoB : totalConsumoB - totalConsumoA;
      });
    }
    return filtered;
  }, [clientes, filterTensao, sortOrder, searchTerm]);

  // Totais por tensão
  const { totalKwhAlta, totalKwhBaixa, totalKwhBOptante, totalKwhBaixaRenda } = useMemo(() => {
    let totals: Record<TensaoType, number> = { alta: 0, baixa: 0, b_optante: 0, baixa_renda: 0 };
    clientes.forEach(cliente => {
      const clienteKwh = cliente.unidades.reduce((sum, u) => sum + (parseInt(u.consumoKwh) || 0), 0);
      if (totals[cliente.tensao] !== undefined) {
        totals[cliente.tensao] += clienteKwh;
      }
    });
    return {
      totalKwhAlta: totals.alta,
      totalKwhBaixa: totals.baixa,
      totalKwhBOptante: totals.b_optante,
      totalKwhBaixaRenda: totals.baixa_renda
    };
  }, [clientes]);

  // Handlers
  const handleAddCliente = async () => {
    const newUnidade: UnidadeConsumidora = {
      id: crypto.randomUUID(),
      consumoKwh: '',
      temGeracao: false,
      arquivoFaturaUrl: null,
      nomeArquivo: null,
    };
    const newContato: Contato = {
      id: crypto.randomUUID(),
      nome: '',
      telefone: '',
    };
    const newClienteData: Omit<FaturaCliente, 'id' | 'createdAt'> & { createdAt: Timestamp } = {
      nome: 'Novo Cliente',
      tipoPessoa: '' as 'pf' | 'pj',
      tensao: 'baixa',
      unidades: [newUnidade],
      contatos: [newContato],
      createdAt: Timestamp.now(),
      status: 'Nenhum',
      feedbackNotes: '',
    };

    try {
      await addDoc(collection(db, 'faturas_clientes'), newClienteData);
      toast({ title: "Cliente Adicionado", description: "Um novo cliente foi criado com sucesso." });
    } catch (error) {
      console.error("Error adding document: ", error);
      toast({ title: "Erro", description: "Não foi possível adicionar o cliente.", variant: "destructive" });
    }
  };

  const handleRemoveCliente = async (clienteId: string) => {
    try {
      await deleteDoc(doc(db, 'faturas_clientes', clienteId));
      toast({ title: "Cliente Removido", description: "O cliente e todos os seus dados foram removidos." });
    } catch (error) {
      console.error("Error removing document: ", error);
      toast({ title: "Erro", description: "Não foi possível remover o cliente.", variant: "destructive" });
    }
  };

  const handleUpdateField = async (clienteId: string, fieldPath: string, value: any) => {
    const clienteDocRef = doc(db, 'faturas_clientes', clienteId);
    try {
      const updates: { [key: string]: any } = { [fieldPath]: value };
      if (fieldPath === 'status' || fieldPath === 'feedbackNotes' || fieldPath === 'feedbackAttachmentUrl') {
        updates.lastUpdatedAt = Timestamp.now();
        if (appUser) {
          updates.lastUpdatedBy = { uid: appUser.uid, name: appUser.displayName || appUser.email || 'N/A' };
        }
      }
      await updateDoc(clienteDocRef, updates);
    } catch (error) {
      console.error(`Error updating field ${fieldPath}: `, error);
      toast({ title: "Erro ao Salvar", description: "Não foi possível salvar a alteração.", variant: "destructive" });
    }
  };

  const handleAddUnidade = async (clienteId: string) => {
    const newUnidade: UnidadeConsumidora = {
      id: crypto.randomUUID(),
      consumoKwh: '',
      temGeracao: false,
      arquivoFaturaUrl: null,
      nomeArquivo: null,
    };
    const clienteDocRef = doc(db, 'faturas_clientes', clienteId);
    await updateDoc(clienteDocRef, { unidades: arrayUnion(newUnidade) });
  };

  const handleRemoveUnidade = async (clienteId: string, unidade: UnidadeConsumidora) => {
    const clienteDocRef = doc(db, 'faturas_clientes', clienteId);
    await updateDoc(clienteDocRef, { unidades: arrayRemove(unidade) });
  };

  const handleAddContato = async (clienteId: string) => {
    const newContato: Contato = { id: crypto.randomUUID(), nome: '', telefone: '' };
    const clienteDocRef = doc(db, 'faturas_clientes', clienteId);
    await updateDoc(clienteDocRef, { contatos: arrayUnion(newContato) });
  };

  const handleRemoveContato = async (clienteId: string, contato: Contato) => {
    const clienteDocRef = doc(db, 'faturas_clientes', clienteId);
    await updateDoc(clienteDocRef, { contatos: arrayRemove(contato) });
  };

  const handleFileChange = async (clienteId: string, unidadeId: string, file: File | null) => {
    if (!file) return;
    toast({ title: "Enviando arquivo...", description: "Aguarde enquanto a fatura é salva." });
    try {
      const filePath = `faturas/${clienteId}/${unidadeId}/${file.name}`;
      const fileUrl = await uploadFile(file, filePath);

      const cliente = clientes.find(c => c.id === clienteId);
      if (cliente) {
        const novasUnidades = cliente.unidades.map(u =>
          u.id === unidadeId ? { ...u, arquivoFaturaUrl: fileUrl, nomeArquivo: file.name } : u
        );
        await handleUpdateField(clienteId, 'unidades', novasUnidades);
        toast({ title: "Sucesso!", description: "Fatura enviada e salva com sucesso." });
      }
    } catch (error) {
      console.error("File upload error: ", error);
      toast({ title: "Erro de Upload", description: "Não foi possível enviar o arquivo da fatura.", variant: "destructive" });
    }
  };

  const handleFeedbackFileChange = async (clienteId: string, file: File | null) => {
    if (!file) return;
    toast({ title: "Enviando comprovante...", description: "Aguarde enquanto o arquivo é salvo." });
    try {
      const filePath = `faturas_feedback/${clienteId}/${Date.now()}_${file.name}`;
      const fileUrl = await uploadFile(file, filePath);
      await handleUpdateField(clienteId, 'feedbackAttachmentUrl', fileUrl);
      toast({ title: "Sucesso!", description: "Comprovante de feedback enviado." });
    } catch (error) {
      console.error("Feedback file upload error: ", error);
      toast({ title: "Erro de Upload", description: "Não foi possível enviar o comprovante.", variant: "destructive" });
    }
  };

  const handleDownload = (url: string | null) => {
    if (!url) return;
    window.open(url, '_blank');
  };

  const handleView = (url: string | null) => {
    if (!url) return;
    window.open(url, '_blank');
  };

  const toggleExpand = (clienteId: string) => {
    setExpandedClientId(currentId => currentId === clienteId ? null : clienteId);
  }

  // Loading
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex justify-center items-center">
        <div className="flex items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-cyan-500" />
          <p className="text-lg text-slate-300">Carregando dados das faturas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-300 relative overflow-hidden" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      {/* Background Dinâmico - Blobs Animados */}
      <div className="fixed inset-0 z-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-500/20 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-purple-500/20 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-32 left-1/3 w-96 h-96 bg-emerald-500/20 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-4000"></div>
      </div>

      {/* Main Content */}
      <main className="relative z-10 flex-1 flex flex-col">
        {/* Header */}
        <header className="h-20 flex items-center justify-between px-8 z-20">
          <div className="flex flex-col animate-slide-up" style={{ animationDelay: '0.1s' }}>
            <h2 className="text-2xl font-bold text-white flex items-center gap-3">
              <FileText className="h-7 w-7 text-cyan-400" />
              Gerenciamento de Faturas
            </h2>
            <p className="text-sm text-slate-400">Visão geral em tempo real</p>
          </div>
          <div className="flex items-center gap-6 animate-slide-up" style={{ animationDelay: '0.2s' }}>
            {/* Search Bar Expandable */}
            <div className={`relative transition-all duration-300 ${searchOpen ? 'w-64' : 'w-10'}`}>
              <button
                onClick={() => setSearchOpen(!searchOpen)}
                className="absolute left-0 top-0 h-10 w-10 flex items-center justify-center text-slate-400 hover:text-white z-10"
              >
                <Search className="w-5 h-5" />
              </button>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`h-10 bg-slate-800/50 border border-white/10 rounded-full pl-10 pr-4 text-sm text-white focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all duration-300 ${searchOpen ? 'w-full opacity-100' : 'w-10 opacity-0 pointer-events-none'}`}
                placeholder="Buscar cliente..."
              />
            </div>
            <button className="relative p-2 text-slate-400 hover:text-white transition-colors">
              <Bell className="w-6 h-6" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full animate-ping"></span>
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>
          </div>
        </header>

        {/* Scroll Area */}
        <div className="flex-1 overflow-y-auto px-8 pb-8 custom-scrollbar">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <KPICard
              title="Alta Tensão"
              value={totalKwhAlta}
              unit="kWh"
              color="blue"
              icon={Zap}
              trend="up"
              trendValue="+12.5%"
              delay="0.1s"
            />
            <KPICard
              title="Baixa Tensão"
              value={totalKwhBaixa}
              unit="kWh"
              color="emerald"
              icon={Home}
              trend="up"
              trendValue="+4.2%"
              delay="0.2s"
            />
            <KPICard
              title="B Optante"
              value={totalKwhBOptante}
              unit="kWh"
              color="orange"
              icon={AlertCircle}
              trend="stable"
              trendValue="0%"
              delay="0.3s"
            />
            <KPICard
              title="Baixa Renda"
              value={totalKwhBaixaRenda}
              unit="kWh"
              color="yellow"
              icon={Zap}
              trend="up"
              trendValue="+2.1%"
              delay="0.35s"
            />
          </div>

          {/* Action Card - Adicionar Cliente */}
          <div className="mb-8 animate-slide-up" style={{ animationDelay: '0.4s' }}>
            <button
              onClick={handleAddCliente}
              className="glass-panel rounded-2xl p-6 flex items-center gap-4 hover:bg-white/5 transition-colors cursor-pointer border-dashed border-2 border-slate-700 hover:border-cyan-500 group w-full md:w-auto"
            >
              <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 group-hover:bg-cyan-500 group-hover:text-white transition-all shadow-lg">
                <Plus className="w-6 h-6" />
              </div>
              <div className="text-left">
                <h3 className="text-white font-semibold group-hover:text-cyan-400 transition-colors">Adicionar Novo Cliente</h3>
                <p className="text-xs text-slate-500">Clique para criar um novo registro</p>
              </div>
            </button>
          </div>

          {/* Table Container */}
          <div className="glass-panel rounded-2xl overflow-hidden animate-slide-up" style={{ animationDelay: '0.5s' }}>
            {/* Table Header Actions */}
            <div className="p-5 border-b border-white/5 flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="flex flex-wrap gap-3">
                {/* Filtro Tensão */}
                <div className="flex items-center gap-2">
                  <FilterIcon className="h-4 w-4 text-slate-500" />
                  <Select value={filterTensao} onValueChange={(value: TensaoType | 'all') => setFilterTensao(value)}>
                    <SelectTrigger className="w-[160px] bg-slate-800/50 border-white/10 text-slate-300 text-sm">
                      <SelectValue placeholder="Filtrar tensão" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-700">
                      <SelectItem value="all">Todas as Tensões</SelectItem>
                      {TENSAO_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {/* Ordenação */}
                <div className="flex items-center gap-2">
                  <ArrowUpDown className="h-4 w-4 text-slate-500" />
                  <Select value={sortOrder} onValueChange={(value: 'asc' | 'desc' | 'none') => setSortOrder(value)}>
                    <SelectTrigger className="w-[180px] bg-slate-800/50 border-white/10 text-slate-300 text-sm">
                      <SelectValue placeholder="Ordenar consumo" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-700">
                      <SelectItem value="none">Ordem Padrão</SelectItem>
                      <SelectItem value="desc">Maior para Menor</SelectItem>
                      <SelectItem value="asc">Menor para Maior</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <p className="text-sm text-slate-400">
                <span className="text-white font-bold">{filteredAndSortedClientes.length}</span> Clientes encontrados
              </p>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-900/40 text-xs uppercase text-slate-500 font-bold tracking-wider">
                    <th className="p-5 pl-8 w-[50px]"></th>
                    <th className="p-5">Cliente</th>
                    <th className="p-5">Tendência</th>
                    <th className="p-5">Consumo</th>
                    <th className="p-5">Status</th>
                    <th className="p-5">Última Interação</th>
                    <th className="p-5 text-right pr-8">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50 text-sm">
                  {filteredAndSortedClientes.length > 0 ? (
                    filteredAndSortedClientes.map((cliente, index) => {
                      const totalConsumo = cliente.unidades.reduce((sum, u) => sum + (parseInt(u.consumoKwh) || 0), 0);
                      const hasGd = cliente.unidades.some(u => u.temGeracao);
                      const isExpanded = expandedClientId === cliente.id;
                      const statusStyles = getStatusStyle(cliente.status);
                      const tensaoColors = getTensaoColors(cliente.tensao);
                      const tensaoLabel = TENSAO_OPTIONS.find(opt => opt.value === cliente.tensao)?.label || cliente.tensao;

                      // Dados fake para o mini chart
                      const trend = totalConsumo > 10000 ? 'up' : totalConsumo > 5000 ? 'stable' : 'down';
                      const miniChartData = generateMiniChartData(trend);
                      const chartColor = trend === 'up' ? '#10b981' : trend === 'down' ? '#ef4444' : '#a855f7';

                      // Porcentagem para barra de progresso (baseado em 50000 kWh como máximo)
                      const progressPercent = Math.min((totalConsumo / 50000) * 100, 100);

                      return (
                        <React.Fragment key={cliente.id}>
                          {/* Linha Principal */}
                          <tr
                            onClick={() => toggleExpand(cliente.id)}
                            className={`hover:bg-white/[0.02] transition-colors group cursor-pointer border-l-4 ${statusStyles.border}`}
                          >
                            <td className="p-5 pl-6">
                              <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white">
                                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                              </Button>
                            </td>
                            <td className="p-5">
                              <div className="flex items-center gap-4">
                                <div className="relative">
                                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-tr ${tensaoColors.gradient} flex items-center justify-center text-white font-bold shadow-lg ${tensaoColors.shadow}`}>
                                    {cliente.nome?.charAt(0)?.toUpperCase() || 'N'}
                                  </div>
                                  {cliente.status === 'Fechado' && (
                                    <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 border-2 border-slate-900 rounded-full"></div>
                                  )}
                                  {cliente.status === 'Fechamento' && (
                                    <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-yellow-500 border-2 border-slate-900 rounded-full animate-pulse"></div>
                                  )}
                                </div>
                                <div>
                                  <p className={`font-semibold text-white group-hover:${tensaoColors.text} transition-colors`}>
                                    {cliente.nome || <span className="italic text-slate-500">Novo Cliente</span>}
                                  </p>
                                  <p className="text-xs text-slate-500">{tensaoLabel} • {cliente.tipoPessoa === 'pj' ? 'PJ' : cliente.tipoPessoa === 'pf' ? 'PF' : 'Tipo N/D'}</p>
                                </div>
                              </div>
                            </td>
                            <td className="p-5">
                              <MiniLineChart data={miniChartData} color={chartColor} />
                            </td>
                            <td className="p-5">
                              <div className="flex items-center gap-2">
                                <span className="text-white font-medium">{totalConsumo.toLocaleString('pt-BR')} kWh</span>
                                {trend === 'up' && (
                                  <span className="text-xs text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded flex items-center">
                                    <TrendingUp className="w-3 h-3 mr-0.5" /> 5%
                                  </span>
                                )}
                                {trend === 'down' && (
                                  <span className="text-xs text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded flex items-center">
                                    <TrendingDown className="w-3 h-3 mr-0.5" /> 2%
                                  </span>
                                )}
                              </div>
                              <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden max-w-[150px]">
                                <div
                                  className={`bg-gradient-to-r ${tensaoColors.gradient} h-full rounded-full shimmer`}
                                  style={{ width: `${progressPercent}%` }}
                                ></div>
                              </div>
                            </td>
                            <td className="p-5">
                              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${statusStyles.badge} ${statusStyles.glow}`}>
                                {(cliente.status === 'Fechado' || cliente.status === 'Contato?') && (
                                  <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-current"></span>
                                  </span>
                                )}
                                {cliente.status || 'Nenhum'}
                              </span>
                            </td>
                            <td className="p-5 text-sm">
                              {cliente.lastUpdatedBy ? (
                                <div className="flex flex-col text-xs">
                                  <span className="font-medium text-slate-300">{cliente.lastUpdatedBy.name}</span>
                                  <span className="text-slate-500">{cliente.lastUpdatedAt ? new Date(cliente.lastUpdatedAt).toLocaleString('pt-BR') : ''}</span>
                                </div>
                              ) : <span className="text-slate-600">N/A</span>}
                            </td>
                            <td className="p-5 text-right pr-8">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e) => { e.stopPropagation(); handleRemoveCliente(cliente.id); }}
                                className="text-slate-400 hover:text-red-400 hover:bg-red-500/10"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </td>
                          </tr>

                          {/* Linha Expandida */}
                          {isExpanded && (
                            <tr>
                              <td colSpan={7} className="p-0">
                                <div className="p-6 bg-slate-900/50 border-t border-white/5">
                                  {/* Dados do Cliente */}
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                                    <div>
                                      <Label className="text-slate-400 text-xs mb-1 block">Nome do Cliente</Label>
                                      <Input
                                        placeholder="Nome do cliente"
                                        defaultValue={cliente.nome}
                                        onBlur={(e) => handleUpdateField(cliente.id, 'nome', e.target.value)}
                                        className="bg-slate-800/50 border-white/10 text-white"
                                      />
                                    </div>
                                    <div>
                                      <Label className="text-slate-400 text-xs mb-1 block">Tipo de Pessoa</Label>
                                      <Select value={cliente.tipoPessoa} onValueChange={(value: 'pf' | 'pj' | '') => handleUpdateField(cliente.id, 'tipoPessoa', value)}>
                                        <SelectTrigger className="bg-slate-800/50 border-white/10 text-white">
                                          <SelectValue placeholder="Selecione o tipo" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-slate-900 border-slate-700">
                                          <SelectItem value="pf">Pessoa Física</SelectItem>
                                          <SelectItem value="pj">Pessoa Jurídica</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div>
                                      <Label className="text-slate-400 text-xs mb-1 block">Tensão</Label>
                                      <Select value={cliente.tensao} onValueChange={(value: TensaoType) => handleUpdateField(cliente.id, 'tensao', value)}>
                                        <SelectTrigger className="bg-slate-800/50 border-white/10 text-white">
                                          <SelectValue placeholder="Selecione a Tensão" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-slate-900 border-slate-700">
                                          {TENSAO_OPTIONS.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  </div>

                                  {/* Contatos */}
                                  <div className="mb-6">
                                    <h4 className="font-semibold text-sm mb-3 text-slate-400 flex items-center gap-2">
                                      <UserIcon className="h-4 w-4" /> Contatos
                                    </h4>
                                    <div className="space-y-3">
                                      {cliente.contatos.map((contato) => (
                                        <div key={contato.id} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center p-3 border border-white/5 rounded-xl bg-slate-800/30">
                                          <div className="md:col-span-5 flex items-center gap-2">
                                            <UserIcon className="h-4 w-4 text-slate-500" />
                                            <Input
                                              placeholder="Nome do Contato"
                                              defaultValue={contato.nome}
                                              onBlur={(e) => {
                                                const updatedContatos = cliente.contatos.map((c) => c.id === contato.id ? { ...c, nome: e.target.value } : c);
                                                handleUpdateField(cliente.id, 'contatos', updatedContatos);
                                              }}
                                              className="bg-slate-800/50 border-white/10 text-white"
                                            />
                                          </div>
                                          <div className="md:col-span-6 flex items-center gap-2">
                                            <Phone className="h-4 w-4 text-slate-500" />
                                            <Input
                                              placeholder="Telefone"
                                              defaultValue={contato.telefone}
                                              onBlur={(e) => {
                                                const updatedContatos = cliente.contatos.map((c) => c.id === contato.id ? { ...c, telefone: e.target.value } : c);
                                                handleUpdateField(cliente.id, 'contatos', updatedContatos);
                                              }}
                                              className="bg-slate-800/50 border-white/10 text-white"
                                            />
                                          </div>
                                          <div className="md:col-span-1 flex justify-end">
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              onClick={() => handleRemoveContato(cliente.id, contato)}
                                              disabled={cliente.contatos.length <= 1}
                                              className="text-slate-500 hover:text-red-400 hover:bg-red-500/10"
                                            >
                                              <Trash2 className="h-4 w-4" />
                                            </Button>
                                          </div>
                                        </div>
                                      ))}
                                      <Button
                                        onClick={() => handleAddContato(cliente.id)}
                                        variant="outline"
                                        size="sm"
                                        className="bg-transparent border-dashed border-slate-600 text-slate-400 hover:bg-slate-800 hover:text-white hover:border-cyan-500"
                                      >
                                        <PlusCircle className="mr-2 h-4 w-4" /> Adicionar Contato
                                      </Button>
                                    </div>
                                  </div>

                                  {/* Unidades Consumidoras */}
                                  <div className="mb-6">
                                    <h4 className="font-semibold text-sm mb-3 text-slate-400 flex items-center gap-2">
                                      <Zap className="h-4 w-4" /> Unidades Consumidoras
                                    </h4>
                                    <div className="space-y-3">
                                      {cliente.unidades.map((unidade, ucIndex) => (
                                        <div key={unidade.id} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center p-3 border border-white/5 rounded-xl bg-slate-800/30">
                                          <span className="md:col-span-1 text-center font-semibold text-cyan-400 text-sm">UC {ucIndex + 1}</span>
                                          <div className="md:col-span-3">
                                            <Input
                                              type="number"
                                              placeholder="Consumo (kWh)"
                                              defaultValue={unidade.consumoKwh}
                                              onBlur={(e) => {
                                                const updatedUnidades = cliente.unidades.map((u) => u.id === unidade.id ? { ...u, consumoKwh: e.target.value } : u);
                                                handleUpdateField(cliente.id, 'unidades', updatedUnidades);
                                              }}
                                              className="bg-slate-800/50 border-white/10 text-white"
                                            />
                                          </div>
                                          <div className="md:col-span-2 flex items-center justify-center gap-2">
                                            <Checkbox
                                              checked={unidade.temGeracao}
                                              onCheckedChange={(checked) => {
                                                const updatedUnidades = cliente.unidades.map((u) => u.id === unidade.id ? { ...u, temGeracao: !!checked } : u);
                                                handleUpdateField(cliente.id, 'unidades', updatedUnidades);
                                              }}
                                              id={`gen-${cliente.id}-${ucIndex}`}
                                              className="border-slate-500 data-[state=checked]:bg-cyan-500 data-[state=checked]:border-cyan-500"
                                            />
                                            <label htmlFor={`gen-${cliente.id}-${ucIndex}`} className="text-sm text-slate-400">Tem GD?</label>
                                          </div>
                                          <div className="md:col-span-2">
                                            <Button asChild variant="outline" size="sm" className="w-full bg-transparent border-slate-600 text-slate-400 hover:bg-slate-700 hover:text-white">
                                              <label className="cursor-pointer">
                                                <Upload className="mr-2 h-4 w-4" />
                                                {unidade.arquivoFaturaUrl ? 'Trocar' : 'Anexar'}
                                                <Input type="file" className="hidden" onChange={(e) => handleFileChange(cliente.id, unidade.id, e.target.files ? e.target.files[0] : null)} />
                                              </label>
                                            </Button>
                                          </div>
                                          <div className="md:col-span-3 flex items-center justify-end gap-1">
                                            {unidade.arquivoFaturaUrl && (
                                              <>
                                                <Button variant="ghost" size="icon" onClick={() => handleView(unidade.arquivoFaturaUrl)} className="text-slate-400 hover:text-cyan-400">
                                                  <Eye className="h-4 w-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" onClick={() => handleDownload(unidade.arquivoFaturaUrl)} className="text-slate-400 hover:text-cyan-400">
                                                  <Download className="h-4 w-4" />
                                                </Button>
                                              </>
                                            )}
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              onClick={() => handleRemoveUnidade(cliente.id, unidade)}
                                              disabled={cliente.unidades.length <= 1}
                                              className="text-slate-500 hover:text-red-400 hover:bg-red-500/10"
                                            >
                                              <Trash2 className="h-4 w-4" />
                                            </Button>
                                          </div>
                                        </div>
                                      ))}
                                      <Button
                                        onClick={() => handleAddUnidade(cliente.id)}
                                        variant="outline"
                                        size="sm"
                                        className="bg-transparent border-dashed border-slate-600 text-slate-400 hover:bg-slate-800 hover:text-white hover:border-cyan-500"
                                      >
                                        <PlusCircle className="mr-2 h-4 w-4" /> Adicionar UC
                                      </Button>
                                    </div>
                                  </div>

                                  {/* Feedback e Status */}
                                  <div className="pt-4 border-t border-white/5">
                                    <h4 className="font-semibold text-sm mb-3 text-slate-400 flex items-center gap-2">
                                      <MessageSquare className="h-4 w-4" /> Feedback e Status
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                      <div>
                                        <Label className="text-slate-400 text-xs mb-1 block">Status</Label>
                                        <Select value={cliente.status || 'Nenhum'} onValueChange={(value: FaturaStatus) => handleUpdateField(cliente.id, 'status', value)}>
                                          <SelectTrigger className="bg-slate-800/50 border-white/10 text-white">
                                            <SelectValue placeholder="Selecione o status" />
                                          </SelectTrigger>
                                          <SelectContent className="bg-slate-900 border-slate-700">
                                            {FATURA_STATUS_OPTIONS.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                                          </SelectContent>
                                        </Select>
                                      </div>
                                      <div className="md:col-span-2">
                                        <Label className="text-slate-400 text-xs mb-1 block">Notas de Feedback</Label>
                                        <Textarea
                                          placeholder="Adicione notas de feedback aqui..."
                                          defaultValue={cliente.feedbackNotes}
                                          onBlur={(e) => handleUpdateField(cliente.id, 'feedbackNotes', e.target.value)}
                                          className="bg-slate-800/50 border-white/10 text-white min-h-[80px]"
                                        />
                                      </div>
                                    </div>
                                    <div className="mt-4 flex items-center gap-4">
                                      <Button asChild variant="outline" size="sm" className="bg-transparent border-slate-600 text-slate-400 hover:bg-slate-700 hover:text-white">
                                        <label className="cursor-pointer">
                                          <Paperclip className="mr-2 h-4 w-4" />
                                          Anexar Comprovante
                                          <Input type="file" className="hidden" onChange={(e) => handleFeedbackFileChange(cliente.id, e.target.files ? e.target.files[0] : null)} />
                                        </label>
                                      </Button>
                                      {cliente.feedbackAttachmentUrl && (
                                        <Button variant="secondary" size="sm" onClick={() => handleView(cliente.feedbackAttachmentUrl)} className="bg-slate-700 text-white hover:bg-slate-600">
                                          <Eye className="mr-2 h-4 w-4" />
                                          Ver Anexo
                                        </Button>
                                      )}
                                    </div>
                                    {cliente.lastUpdatedBy && (
                                      <div className="text-xs text-slate-500 mt-3 flex items-center">
                                        <UserCheck className="mr-2 h-3 w-3" />
                                        Última atualização por <strong className="mx-1 text-slate-300">{cliente.lastUpdatedBy.name}</strong> em {cliente.lastUpdatedAt ? new Date(cliente.lastUpdatedAt).toLocaleString('pt-BR') : '...'}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={7} className="h-32 text-center text-slate-500">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <FileText className="h-8 w-8 text-slate-600" />
                          <p>Nenhum cliente encontrado.</p>
                          <p className="text-xs">Clique em "Adicionar Novo Cliente" para começar.</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}