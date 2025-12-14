"use client";

import { Suspense, useEffect, useMemo, useState } from 'react';
import AdminCommissionDashboard from '@/components/admin/AdminCommissionDashboard';
import { useAuth } from '@/contexts/AuthContext';
import { 
  Loader2, ShieldCheck, Users, 
  TrendingUp, Activity, Bell, UserPlus, 
  FileText, AlertCircle, Search, MoreHorizontal, ArrowUpRight 
} from 'lucide-react';
import type { AppUser } from '@/types/user';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { sendFCMNotification } from '@/actions/notifications/sendFCMNotification';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';

// --- STYLES & ASSETS ---

// Pequeno componente de gráfico SVG para dar vida visual sem bibliotecas pesadas
const MiniAreaChart = ({ color = "#06b6d4" }) => (
  <div className="h-[60px] w-full overflow-hidden opacity-50">
    <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="w-full h-full">
      <defs>
        <linearGradient id="grad" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.4" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d="M0 30 Q 10 25, 20 28 T 40 20 T 60 15 T 80 25 T 100 10 V 40 H 0 Z" fill="url(#grad)" />
      <path d="M0 30 Q 10 25, 20 28 T 40 20 T 60 15 T 80 25 T 100 10" fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  </div>
);

// Card de KPI Premium
const KPICard = ({ title, value, icon: Icon, trend, trendValue, color = "blue", delay = 0 }: any) => {
    const colors: any = {
        blue: "from-blue-500/10 to-cyan-500/5 border-blue-500/20 text-blue-400",
        purple: "from-purple-500/10 to-pink-500/5 border-purple-500/20 text-purple-400",
        emerald: "from-emerald-500/10 to-teal-500/5 border-emerald-500/20 text-emerald-400",
        orange: "from-orange-500/10 to-red-500/5 border-orange-500/20 text-orange-400",
    };

    return (
        <div 
            className={`relative overflow-hidden rounded-2xl border bg-gradient-to-br ${colors[color]} backdrop-blur-md p-6 group hover:scale-[1.02] transition-all duration-300 shadow-lg shadow-black/20 animate-in fade-in slide-in-from-bottom-4`}
            style={{ animationDelay: `${delay}ms` }}
        >
            <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                <Icon className="w-24 h-24 -mr-6 -mt-6 rotate-12" />
            </div>
            
            <div className="relative z-10 flex flex-col h-full justify-between">
                <div className="flex justify-between items-start">
                    <div>
                        <p className="text-sm font-medium text-slate-400 uppercase tracking-wider">{title}</p>
                        <h3 className="text-3xl font-black text-white mt-2 tracking-tight">{value}</h3>
                    </div>
                    <div className={`p-2 rounded-xl bg-white/5 border border-white/5`}>
                        <Icon className="w-5 h-5" />
                    </div>
                </div>
                
                <div className="mt-4 flex items-center gap-2">
                    {trend === 'up' ? (
                        <span className="flex items-center text-xs font-bold text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded-full">
                            <TrendingUp className="w-3 h-3 mr-1" /> {trendValue}
                        </span>
                    ) : (
                        <span className="text-xs font-medium text-slate-500 bg-slate-800/50 px-2 py-1 rounded-full">
                            {trendValue}
                        </span>
                    )}
                    <span className="text-xs text-slate-500">vs. mês anterior</span>
                </div>
            </div>
            {/* Glow effect on hover */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:animate-shimmer" />
        </div>
    );
};

// Componente de Usuários com visual de Lista "High-Tech"
const RecentUsersTable = ({ users }: { users: AppUser[] }) => {
  return (
    <div className="col-span-1 xl:col-span-8 bg-slate-900/40 border border-white/5 rounded-2xl overflow-hidden backdrop-blur-sm flex flex-col h-full animate-in fade-in slide-in-from-bottom-6 duration-700">
      <div className="p-6 border-b border-white/5 flex items-center justify-between">
        <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-cyan-500" /> Cadastro Recente
            </h3>
            <p className="text-sm text-slate-400">Monitoramento de novos registros em tempo real.</p>
        </div>
        <Button variant="ghost" size="sm" className="text-xs text-cyan-400 hover:text-cyan-300 hover:bg-cyan-950">
            Ver Todos <ArrowUpRight className="ml-1 w-3 h-3"/>
        </Button>
      </div>
      
      <div className="flex-1 overflow-auto">
        <table className="w-full text-left text-sm text-slate-400">
            <thead className="bg-white/5 text-xs uppercase font-semibold text-slate-300 sticky top-0 backdrop-blur-md">
                <tr>
                    <th className="px-6 py-3">Usuário</th>
                    <th className="px-6 py-3">Função</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3 text-right">Ação</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
                {users.slice(0, 6).map((user, i) => (
                    <tr key={user.uid || i} className="group hover:bg-white/[0.02] transition-colors">
                        <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                                <Avatar className="h-10 w-10 border-2 border-slate-800 group-hover:border-cyan-500/50 transition-colors">
                                    <AvatarImage src={user.photoURL || ''} />
                                    <AvatarFallback className="bg-slate-800 text-slate-200 font-bold">
                                        {user.displayName?.slice(0,2).toUpperCase() || 'U'}
                                    </AvatarFallback>
                                </Avatar>
                                <div>
                                    <p className="font-semibold text-white group-hover:text-cyan-400 transition-colors">
                                        {user.displayName || 'Usuário Sem Nome'}
                                    </p>
                                    <p className="text-xs text-slate-500">{user.email}</p>
                                </div>
                            </div>
                        </td>
                        <td className="px-6 py-4">
                             <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                                user.type === 'superadmin' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                                user.type === 'admin' ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' :
                                'bg-slate-500/10 text-slate-400 border-slate-500/20'
                            }`}>
                                {user.type === 'superadmin' ? 'Super Admin' : user.type === 'admin' ? 'Administrador' : 'Vendedor'}
                            </span>
                        </td>
                        <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
                                <span className="text-emerald-400 text-xs font-medium">Ativo</span>
                            </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-white">
                                <MoreHorizontal className="w-4 h-4" />
                            </Button>
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
      </div>
    </div>
  );
};

// Console Lateral Direito (Terminal Style)
const SystemConsole = ({ onTestNotification }: { onTestNotification: () => void }) => {
    return (
        <div className="col-span-1 xl:col-span-4 space-y-6 flex flex-col animate-in fade-in slide-in-from-right-6 duration-700">
            
            {/* System Health */}
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 rounded-full blur-3xl"></div>
                
                <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-emerald-500" /> System Health
                </h3>

                <div className="space-y-4">
                    <div className="bg-slate-900/80 p-3 rounded-lg border-l-2 border-emerald-500 flex justify-between items-center">
                        <div className="text-xs text-slate-400">Database Latency</div>
                        <div className="text-emerald-400 font-mono text-sm font-bold">24ms</div>
                    </div>
                    <div className="bg-slate-900/80 p-3 rounded-lg border-l-2 border-emerald-500 flex justify-between items-center">
                        <div className="text-xs text-slate-400">API Status</div>
                        <div className="text-emerald-400 font-mono text-sm font-bold">Operational</div>
                    </div>
                    <div className="bg-slate-900/80 p-3 rounded-lg border-l-2 border-yellow-500 flex justify-between items-center">
                        <div className="text-xs text-slate-400">Last Backup</div>
                        <div className="text-yellow-400 font-mono text-sm font-bold">2h ago</div>
                    </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-800">
                     <p className="text-xs text-slate-500 mb-2">Push Notification Service</p>
                     <Button 
                        onClick={onTestNotification}
                        variant="outline" 
                        className="w-full justify-between bg-slate-900 border-slate-700 hover:bg-slate-800 hover:text-white text-slate-300"
                    >
                        <span>Testar Disparo</span>
                        <Bell className="w-4 h-4" />
                     </Button>
                </div>
            </div>

            {/* Quick Actions / Marketing Box */}
            <div className="flex-1 bg-gradient-to-b from-cyan-900/20 to-slate-900 border border-cyan-500/20 rounded-2xl p-6 flex flex-col justify-center relative overflow-hidden group">
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10"></div>
                <div className="absolute bottom-0 right-0 w-48 h-48 bg-cyan-500/10 rounded-full blur-[50px] group-hover:bg-cyan-500/20 transition-all duration-500"></div>
                
                <div className="relative z-10">
                    <div className="w-12 h-12 bg-cyan-500 rounded-xl flex items-center justify-center mb-4 shadow-lg shadow-cyan-500/30 group-hover:scale-110 transition-transform">
                        <UserPlus className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">Expandir Time</h3>
                    <p className="text-sm text-cyan-100/60 mb-6">
                        Adicione novos administradores ou gestores para escalar a operação.
                    </p>
                    <Button className="w-full bg-cyan-500 hover:bg-cyan-400 text-white shadow-lg shadow-cyan-900/20 border-0">
                        Convidar Membro
                    </Button>
                </div>
            </div>

        </div>
    );
};


export default function AdminDashboardPage() {
  const { appUser, isLoadingAuth, userAppRole, allFirestoreUsers, isLoadingAllUsers, refreshUsers } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'overview' | 'commissions'>('overview');

  useEffect(() => {
    if ((userAppRole === 'admin' || userAppRole === 'superadmin') && !isLoadingAllUsers && allFirestoreUsers.length === 0) {
      refreshUsers();
    }
  }, [userAppRole, isLoadingAllUsers, allFirestoreUsers.length, refreshUsers]);

  const stats = useMemo(() => {
    const total = allFirestoreUsers.length;
    const admins = allFirestoreUsers.filter(u => u.type === 'admin' || u.type === 'superadmin').length;
    return { total, admins };
  }, [allFirestoreUsers]);

  const handleTestNotification = async () => {
    toast({ title: 'Enviando...', description: 'Disparando notificação push...' });
    const result = await sendFCMNotification({
      title: 'Admin Check 🛡️',
      body: 'Verificação de integridade do sistema realizada.',
      targetRole: 'superadmin',
    });
    if (result.success && result.successCount > 0) {
      toast({ title: 'Sistema Operacional', description: `Sinal recebido por ${result.successCount} dispositivos.`, className: "bg-emerald-600 border-0 text-white" });
    } else {
      toast({ title: 'Falha na Comunicação', description: result.error, variant: 'destructive' });
    }
  };

  if (isLoadingAuth || ((userAppRole === 'admin' || userAppRole === 'superadmin') && isLoadingAllUsers)) {
    return (
      <div className="flex flex-col justify-center items-center h-screen bg-slate-950">
        <div className="relative">
            <div className="absolute inset-0 bg-cyan-500 blur-xl opacity-20 animate-pulse"></div>
            <Loader2 className="relative z-10 animate-spin h-14 w-14 text-cyan-400" />
        </div>
        <p className="text-cyan-500/50 mt-4 text-sm font-mono tracking-widest uppercase">Inicializando Sistema...</p>
      </div>
    );
  }

  if ((userAppRole !== 'admin' && userAppRole !== 'superadmin') || !appUser) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-950 text-slate-400">
        <div className="text-center space-y-4">
            <ShieldCheck className="w-20 h-20 mx-auto text-slate-800" />
            <h1 className="text-2xl font-bold text-slate-200">Acesso Restrito</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 p-6 xl:p-10 font-sans text-slate-200 overflow-x-hidden">
      
      {/* Background Decorativo */}
      <div className="fixed inset-0 pointer-events-none z-0">
          <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] bg-blue-600/5 rounded-full blur-[120px]" />
          <div className="absolute top-[20%] right-[0%] w-[40%] h-[40%] bg-cyan-600/5 rounded-full blur-[100px]" />
      </div>

      <div className="relative z-10 max-w-[1920px] mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-6">
            <div>
                <p className="text-cyan-500 font-mono text-xs mb-2 tracking-widest uppercase">Admin Console v2.0</p>
                <h1 className="text-4xl font-bold text-white tracking-tight">
                    Olá, <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400">{appUser.displayName?.split(' ')[0]}</span>
                </h1>
                <p className="text-slate-400 mt-2 max-w-md text-sm">
                    Aqui está o panorama geral da performance da plataforma e gestão de equipe hoje.
                </p>
            </div>
            
            <div className="flex items-center gap-3 bg-slate-900/50 p-1.5 rounded-xl border border-white/10 backdrop-blur-md">
                <Button 
                    onClick={() => setActiveTab('overview')}
                    variant="ghost"
                    className={`rounded-lg px-6 transition-all duration-300 ${activeTab === 'overview' ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-900/50' : 'text-slate-400 hover:text-white'}`}
                >
                    Visão Geral
                </Button>
                <Button 
                    onClick={() => setActiveTab('commissions')}
                    variant="ghost"
                    className={`rounded-lg px-6 transition-all duration-300 ${activeTab === 'commissions' ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-900/50' : 'text-slate-400 hover:text-white'}`}
                >
                    Gestão de Comissões
                </Button>
            </div>
        </div>

        <Suspense fallback={<Loader2 className="animate-spin text-cyan-500 w-8 h-8 mx-auto" />}>
            {activeTab === 'overview' ? (
                <div className="space-y-8">
                    
                    {/* Linha de KPIs */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <KPICard 
                            title="Total de Usuários" 
                            value={stats.total} 
                            icon={Users} 
                            trend="up" trendValue="+12%" 
                            color="blue"
                            delay={0}
                        />
                        <KPICard 
                            title="Propostas Geradas" 
                            value="843" 
                            icon={FileText} 
                            trend="up" trendValue="+5.2%" 
                            color="emerald"
                            delay={100}
                        />
                        <KPICard 
                            title="Receita Estimada" 
                            value="R$ 142k" 
                            icon={TrendingUp} 
                            trend="up" trendValue="+8%" 
                            color="purple"
                            delay={200}
                        />
                         <KPICard 
                            title="Admins Ativos" 
                            value={stats.admins} 
                            icon={ShieldCheck} 
                            trend="flat" trendValue="Estável" 
                            color="orange"
                            delay={300}
                        />
                    </div>

                    {/* Área Principal - Bento Grid */}
                    <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
                        {/* Tabela de Usuários (8 cols) */}
                        <RecentUsersTable users={allFirestoreUsers as AppUser[]} />
                        
                        {/* Coluna Lateral (4 cols) */}
                        <SystemConsole onTestNotification={handleTestNotification} />
                    </div>

                    {/* Área de Gráfico/Extra (Opcional - Expandível) */}
                    <div className="bg-slate-900/30 border border-white/5 rounded-2xl p-6 backdrop-blur-sm animate-in fade-in slide-in-from-bottom-10 duration-1000">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-bold text-white">Volume de Acessos</h3>
                            <div className="flex gap-2">
                                <Button size="sm" variant="ghost" className="text-xs h-7 bg-white/5">7D</Button>
                                <Button size="sm" variant="ghost" className="text-xs h-7 text-slate-500 hover:text-white">30D</Button>
                            </div>
                        </div>
                        <MiniAreaChart color="#06b6d4" />
                    </div>

                </div>
            ) : (
                <div className="animate-in fade-in slide-in-from-right-10 duration-500">
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
    </div>
  );
}

// Styles para animação de Shimmer (adicione ao seu global.css se desejar, mas funciona sem também via tailwind config padrão ou inline hack)
// .animate-shimmer { animation: shimmer 2s infinite linear; }
// @keyframes shimmer { from { transform: translateX(-100%); } to { transform: translateX(100%); } }