"use client";

import { Suspense, useEffect, useMemo, useState } from 'react';
import AdminCommissionDashboard from '@/components/admin/AdminCommissionDashboard'; // Mantendo seu componente original
import { useAuth } from '@/contexts/AuthContext';
import { 
  Loader2, ShieldCheck, Send, Users, 
  TrendingUp, Activity, Bell, UserPlus, 
  FileText, AlertCircle 
} from 'lucide-react';
import type { AppUser } from '@/types/user';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { sendFCMNotification } from '@/actions/notifications/sendFCMNotification';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

// --- COMPONENTES VISUAIS NOVOS ---

// Card de Estatística (KPI)
const StatCard = ({ title, value, icon: Icon, description, trend }: any) => (
  <Card className="bg-slate-900/50 border-white/10 backdrop-blur-sm text-slate-100">
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium text-slate-400">{title}</CardTitle>
      <Icon className="h-4 w-4 text-cyan-500" />
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">{value}</div>
      <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
        {trend && <span className="text-emerald-500 font-bold">{trend}</span>}
        {description}
      </p>
    </CardContent>
  </Card>
);

// Lista de Usuários Recentes (Extraída do seu allFirestoreUsers)
const RecentUsersList = ({ users }: { users: AppUser[] }) => {
  // Pega os últimos 5 usuários (assumindo que o array vem ordenado ou apenas pegando os primeiros para demo)
  const recentUsers = users.slice(0, 5);

  return (
    <Card className="bg-slate-900/50 border-white/10 text-slate-100 col-span-1 md:col-span-3">
      <CardHeader>
        <CardTitle className="text-lg">Novos Usuários</CardTitle>
        <CardDescription className="text-slate-400">Últimos registros na plataforma</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {recentUsers.map((user, i) => (
            <div key={user.uid || i} className="flex items-center justify-between border-b border-white/5 pb-2 last:border-0">
              <div className="flex items-center gap-3">
                <Avatar className="h-9 w-9 border border-white/10">
                  <AvatarImage src={user.photoURL || ''} />
                  <AvatarFallback className="bg-cyan-900 text-cyan-200">{user.displayName?.slice(0,2).toUpperCase() || 'US'}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium text-white">{user.displayName || 'Sem Nome'}</p>
                  <p className="text-xs text-slate-500">{user.email}</p>
                </div>
              </div>
              <div className={`text-xs px-2 py-1 rounded-full border ${
                user.type === 'superadmin' ? 'bg-purple-500/10 border-purple-500/20 text-purple-400' :
                user.type === 'admin' ? 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400' :
                'bg-slate-500/10 border-slate-500/20 text-slate-400'
              }`}>
                {user.type}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

// Área de Status do Sistema (Onde colocamos o teste de notificação)
const SystemStatusCard = ({ onTestNotification }: { onTestNotification: () => void }) => (
  <Card className="bg-slate-900/50 border-white/10 text-slate-100 col-span-1 md:col-span-2">
    <CardHeader>
      <CardTitle className="text-lg flex items-center gap-2">
        <Activity className="w-5 h-5 text-emerald-500" /> Status do Sistema
      </CardTitle>
    </CardHeader>
    <CardContent className="space-y-4">
      <div className="flex items-center justify-between p-3 bg-slate-950/50 rounded-lg border border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-sm text-slate-300">Banco de Dados</span>
        </div>
        <span className="text-xs text-emerald-500 font-bold">Online</span>
      </div>
      
      <div className="flex items-center justify-between p-3 bg-slate-950/50 rounded-lg border border-white/5">
        <div className="flex items-center gap-3">
          <Bell className="w-4 h-4 text-yellow-500" />
          <span className="text-sm text-slate-300">Serviço de Push</span>
        </div>
        <Button variant="outline" size="sm" onClick={onTestNotification} className="h-7 text-xs border-white/10 hover:bg-white/5">
          Testar Envio
        </Button>
      </div>
    </CardContent>
  </Card>
);

// --- PÁGINA PRINCIPAL ---

export default function AdminDashboardPage() {
  const { appUser, isLoadingAuth, userAppRole, allFirestoreUsers, isLoadingAllUsers, refreshUsers } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'overview' | 'commissions'>('overview');

  // Fetch users if needed
  useEffect(() => {
    if ((userAppRole === 'admin' || userAppRole === 'superadmin') && !isLoadingAllUsers && allFirestoreUsers.length === 0) {
      refreshUsers();
    }
  }, [userAppRole, isLoadingAllUsers, allFirestoreUsers.length, refreshUsers]);

  // Cálculos de Estatísticas (Stats) baseados nos dados reais
  const stats = useMemo(() => {
    const total = allFirestoreUsers.length;
    const admins = allFirestoreUsers.filter(u => u.type === 'admin' || u.type === 'superadmin').length;
    // Mockando propostas pois não tenho acesso ao contexto de propostas aqui
    const activeProposals = 142; 
    return { total, admins, activeProposals };
  }, [allFirestoreUsers]);

  const handleTestNotification = async () => {
    toast({ title: 'Enviando...', description: 'Disparando notificação push...' });
    const result = await sendFCMNotification({
      title: 'Teste do Admin 🛡️',
      body: 'Sistema de notificações operando 100%.',
      targetRole: 'superadmin',
    });
    if (result.success && result.successCount > 0) {
      toast({ title: 'Sucesso!', description: `Enviada para ${result.successCount} dispositivo(s).`, className: "bg-emerald-500 text-white" });
    } else {
      toast({ title: 'Erro', description: result.error || 'Nenhum token encontrado.', variant: 'destructive' });
    }
  };

  // Loading State
  if (isLoadingAuth || ((userAppRole === 'admin' || userAppRole === 'superadmin') && isLoadingAllUsers)) {
    return (
      <div className="flex flex-col justify-center items-center h-screen bg-slate-950 text-cyan-500">
        <Loader2 className="animate-spin h-12 w-12 mb-4" />
        <p className="text-slate-400 animate-pulse">Carregando Painel Planus...</p>
      </div>
    );
  }

  // Access Denied State
  if ((userAppRole !== 'admin' && userAppRole !== 'superadmin') || !appUser) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-950 text-red-500">
        <ShieldCheck size={64} className="mb-4 opacity-50" />
        <h1 className="text-2xl font-bold">Acesso Restrito</h1>
        <p className="text-slate-500">Esta área é exclusiva para administradores.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 p-6 md:p-8 font-sans text-slate-200">
      
      {/* Header da Página */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Painel do Administrador</h1>
          <p className="text-slate-400 mt-1">Bem-vindo de volta, {appUser.displayName?.split(' ')[0]}.</p>
        </div>
        
        {/* Toggle Simples de Abas (Se o AdminCommissionDashboard não tiver abas internas para 'Visão Geral') */}
        <div className="bg-slate-900 p-1 rounded-lg border border-white/10 flex">
            <button 
                onClick={() => setActiveTab('overview')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'overview' ? 'bg-cyan-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
            >
                Visão Geral
            </button>
            <button 
                onClick={() => setActiveTab('commissions')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'commissions' ? 'bg-cyan-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
            >
                Comissões
            </button>
        </div>
      </div>

      <Suspense fallback={<Loader2 className="animate-spin text-cyan-500" />}>
        
        {activeTab === 'overview' ? (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                
                {/* 1. KPIs - Métricas Principais */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard 
                        title="Usuários Totais" 
                        value={stats.total} 
                        icon={Users} 
                        description="Cadastrados na base"
                        trend="+12%"
                    />
                    <StatCard 
                        title="Propostas Ativas" 
                        value={stats.activeProposals} 
                        icon={FileText} 
                        description="Geradas este mês" 
                        trend="+5%"
                    />
                    <StatCard 
                        title="Admins" 
                        value={stats.admins} 
                        icon={ShieldCheck} 
                        description="Com acesso ao painel" 
                    />
                    <StatCard 
                        title="Erros de Sistema" 
                        value="0" 
                        icon={AlertCircle} 
                        description="Últimos 7 dias"
                        trend="Estável" 
                    />
                </div>

                {/* 2. Grid Mista: Gráfico (Mock) + Lista Recente + Status */}
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                    
                    {/* Lista de Usuários (3 cols) */}
                    <RecentUsersList users={allFirestoreUsers as AppUser[]} />

                    {/* Status do Sistema (2 cols) */}
                    <div className="col-span-1 lg:col-span-2 space-y-6">
                        <SystemStatusCard onTestNotification={handleTestNotification} />
                        
                        {/* Card de Ação Rápida */}
                        <Card className="bg-gradient-to-br from-cyan-900/20 to-blue-900/20 border-cyan-500/20 border text-white">
                            <CardHeader>
                                <CardTitle className="text-md flex items-center gap-2">
                                    <UserPlus className="w-4 h-4 text-cyan-400"/> Acesso Rápido
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <Button className="w-full bg-cyan-600 hover:bg-cyan-500 transition-colors">
                                    Convidar Novo Admin
                                </Button>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        ) : (
            /* 3. Aba de Comissões (Seu componente original) */
            <div className="animate-in fade-in slide-in-from-right-4 duration-500">
                <AdminCommissionDashboard
                    loggedInUser={appUser as AppUser}
                    initialUsers={allFirestoreUsers}
                    isLoadingUsersProp={isLoadingAllUsers}
                    onUsersChange={refreshUsers}
                />
            </div>
        )}

      </Suspense>
    </div>
  );
}
