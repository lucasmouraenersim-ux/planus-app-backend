"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { db } from "@/lib/firebase";
import { collection, query, orderBy, getDocs, where, Timestamp } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Activity, Upload, UserPlus, Lock, Clock, Zap, Calendar, Search } from 'lucide-react';
import { startOfDay, endOfDay, subDays, differenceInMinutes, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Input } from "@/components/ui/input";

// Tipos baseados no nosso Logger
type LogData = {
  id: string;
  userId: string;
  userName: string;
  userRole: string;
  action: string;
  timestamp: Timestamp;
  details?: any;
};

export default function PartnersAnalytics() {
  const [logs, setLogs] = useState<LogData[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filtros
  const [periodo, setPeriodo] = useState('hoje');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchLogs();
  }, [periodo]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      let startDate = startOfDay(new Date());
      
      if (periodo === '7d') startDate = subDays(new Date(), 7);
      if (periodo === '30d') startDate = subDays(new Date(), 30);
      
      // Busca logs do período selecionado
      const q = query(
        collection(db, "system_activity_logs"),
        where("timestamp", ">=", startDate),
        orderBy("timestamp", "desc")
      );

      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LogData));
      setLogs(data);
    } catch (error) {
      console.error("Erro ao buscar analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  // --- PROCESSAMENTO INTELIGENTE DOS DADOS ---
  const stats = useMemo(() => {
    const userStats: Record<string, any> = {};
    let totalUploads = 0;
    let totalLeads = 0;
    let totalUnlocks = 0;

    // 1. Agrupamento por Usuário
    logs.forEach(log => {
      if (!userStats[log.userId]) {
        userStats[log.userId] = {
          id: log.userId,
          name: log.userName,
          role: log.userRole,
          uploads: 0,
          leadsCreated: 0,
          leadsUnlocked: 0,
          uploadTimestamps: [] as number[], // Para calcular média de tempo
          lastActive: log.timestamp
        };
      }

      const user = userStats[log.userId];

      if (log.action === 'UPLOAD_INVOICE') {
        user.uploads++;
        user.uploadTimestamps.push(log.timestamp.toMillis());
        totalUploads++;
      }
      if (log.action === 'CREATE_LEAD') {
        user.leadsCreated++;
        totalLeads++;
      }
      if (log.action === 'UNLOCK_LEAD') {
        user.leadsUnlocked++;
        totalUnlocks++;
      }
    });

    // 2. Cálculo de Produtividade (Tempo Médio)
    const processedUsers = Object.values(userStats).map((user: any) => {
      let avgTimeBetweenUploads = 0;
      
      // Só calcula média se tiver pelo menos 2 uploads
      if (user.uploadTimestamps.length > 1) {
        // Ordena timestamps (do mais antigo para o mais novo)
        const times = user.uploadTimestamps.sort((a: number, b: number) => a - b);
        let totalDiffMinutes = 0;
        
        for (let i = 1; i < times.length; i++) {
          // Diferença em minutos entre um upload e o próximo
          const diff = (times[i] - times[i - 1]) / 1000 / 60;
          // Filtra pausas grandes (ex: almoço > 60 min não conta na média de produtividade direta)
          if (diff < 60) {
             totalDiffMinutes += diff;
          }
        }
        // Média
        if (totalDiffMinutes > 0) {
            avgTimeBetweenUploads = Math.round(totalDiffMinutes / (times.length - 1));
        }
      }

      return { ...user, avgTimeBetweenUploads };
    });

    // Filtro de busca por nome
    const filteredUsers = searchTerm 
      ? processedUsers.filter(u => u.name.toLowerCase().includes(searchTerm.toLowerCase()))
      : processedUsers;

    // Ordenar por atividade (quem produziu mais primeiro)
    filteredUsers.sort((a, b) => (b.uploads + b.leadsUnlocked) - (a.uploads + a.leadsUnlocked));

    return {
      users: filteredUsers,
      totals: { totalUploads, totalLeads, totalUnlocks, totalInteractions: logs.length }
    };
  }, [logs, searchTerm]);

  return (
    <div className="space-y-6">
      {/* --- CABEÇALHO E FILTROS --- */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900 p-4 rounded-xl border border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-cyan-500" />
            Performance da Equipe
          </h2>
          <p className="text-slate-400 text-xs mt-1">
            Análise detalhada de produtividade de Faturas e Vendas.
          </p>
        </div>
        
        <div className="flex gap-2 w-full md:w-auto">
           <div className="relative">
             <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
             <Input 
               placeholder="Filtrar por nome..." 
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
               className="pl-9 bg-slate-950 border-slate-800 w-[200px]"
             />
           </div>
           <Select value={periodo} onValueChange={setPeriodo}>
            <SelectTrigger className="w-[140px] bg-slate-950 border-slate-800 text-white">
              <Calendar className="w-4 h-4 mr-2 text-slate-400" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-slate-800 text-white">
              <SelectItem value="hoje">Hoje</SelectItem>
              <SelectItem value="7d">Últimos 7 dias</SelectItem>
              <SelectItem value="30d">Últimos 30 dias</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* --- CARDS DE KPI GERAL --- */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KPICard title="Total Interações" value={stats.totals.totalInteractions} icon={Activity} color="text-slate-400" bg="bg-slate-500/10" />
        <KPICard title="Faturas Processadas" value={stats.totals.totalUploads} icon={Upload} color="text-purple-400" bg="bg-purple-500/10" />
        <KPICard title="Leads Criados" value={stats.totals.totalLeads} icon={UserPlus} color="text-cyan-400" bg="bg-cyan-500/10" />
        <KPICard title="Leads Desbloqueados" value={stats.totals.totalUnlocks} icon={Lock} color="text-emerald-400" bg="bg-emerald-500/10" />
      </div>

      {/* --- TABELA DETALHADA DE PRODUTIVIDADE --- */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader className="border-b border-slate-800 pb-4">
          <CardTitle className="text-white text-lg">Ranking de Produtividade</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-950">
              <TableRow className="hover:bg-transparent border-slate-800">
                <TableHead className="text-slate-400">Usuário / Cargo</TableHead>
                <TableHead className="text-center text-purple-400">Faturas (Uploads)</TableHead>
                <TableHead className="text-center text-slate-400 hidden md:table-cell">Ritmo Médio</TableHead>
                <TableHead className="text-center text-cyan-400">Novos Leads</TableHead>
                <TableHead className="text-center text-emerald-400">Desbloqueios</TableHead>
                <TableHead className="text-right text-slate-400">Última Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-slate-500">Carregando dados...</TableCell></TableRow>
              ) : stats.users.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-slate-500">Nenhuma atividade registrada no período.</TableCell></TableRow>
              ) : (
                stats.users.map((user: any) => (
                  <TableRow key={user.id} className="border-slate-800 hover:bg-slate-800/50">
                    <TableCell>
                      <div className="font-bold text-white">{user.name}</div>
                      <Badge variant="outline" className="text-[10px] py-0 border-slate-700 text-slate-400 uppercase">
                        {user.role || 'Usuário'}
                      </Badge>
                    </TableCell>
                    
                    {/* Coluna Faturas (Backoffice) */}
                    <TableCell className="text-center">
                      <div className="font-mono text-lg font-bold text-purple-200">{user.uploads}</div>
                      {user.uploads > 0 && <span className="text-[10px] text-slate-500">faturas</span>}
                    </TableCell>

                    {/* Coluna Ritmo (Tempo Médio entre uploads) */}
                    <TableCell className="text-center hidden md:table-cell">
                      {user.uploads > 1 ? (
                        <div className="flex flex-col items-center">
                           <div className="flex items-center gap-1 text-slate-200 font-mono">
                             <Clock className="w-3 h-3 text-slate-500" />
                             {user.avgTimeBetweenUploads} min
                           </div>
                           <span className="text-[10px] text-slate-500">entre envios</span>
                        </div>
                      ) : (
                        <span className="text-slate-600">-</span>
                      )}
                    </TableCell>

                    {/* Coluna Leads Criados */}
                    <TableCell className="text-center font-mono text-slate-300">
                      {user.leadsCreated}
                    </TableCell>

                    {/* Coluna Desbloqueios (Vendas) */}
                    <TableCell className="text-center font-mono text-emerald-300">
                      {user.leadsUnlocked}
                    </TableCell>

                    {/* Coluna Última Atividade */}
                    <TableCell className="text-right text-xs text-slate-400">
                       {user.lastActive ? format(user.lastActive.toDate(), "HH:mm '•' dd/MM", { locale: ptBR }) : '-'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function KPICard({ title, value, icon: Icon, color, bg }: any) {
  return (
    <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center justify-between">
      <div>
        <p className="text-xs font-bold text-slate-500 uppercase">{title}</p>
        <p className="text-2xl font-bold text-white mt-1">{value}</p>
      </div>
      <div className={`p-3 rounded-lg ${bg}`}>
        <Icon className={`w-5 h-5 ${color}`} />
      </div>
    </div>
  )
}
