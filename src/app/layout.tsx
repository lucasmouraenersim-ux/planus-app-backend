"use client";

import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { TermsDialog } from '@/components/auth/TermsDialog';
import { SidebarProvider, Sidebar, SidebarContent, SidebarFooter, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarInset, useSidebar } from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import React, { useEffect } from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { 
  BarChart3, Calculator, UsersRound, Wallet, Rocket, CircleUserRound, LogOut, 
  FileText, ShieldAlert, Loader2, Info, Network, Target, ListChecks, 
  BookOpen as TrainingIcon, Image as ImageIcon, Zap, Send, LayoutDashboard, 
  Menu, Sparkles, Trophy
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import type { UserType } from '@/types/user';
import { CommandMenu } from '@/components/ui/command-menu';

const AppLayoutContent = ({ children }: { children: React.ReactNode }) => {
    const pathname = usePathname();
    const router = useRouter();
    const { appUser, isLoadingAuth } = useAuth();
    
    // Tratamento para páginas públicas
    const isPublicPage = pathname === '/' || pathname === '/login' || pathname === '/register' || pathname.startsWith('/meteorologia');

    useEffect(() => {
        if (!isLoadingAuth && !appUser && !isPublicPage) {
            router.replace('/login');
        }
    }, [isLoadingAuth, appUser, pathname, router, isPublicPage]);

    if (isLoadingAuth) {
        return (
            <div className="flex flex-col justify-center items-center h-screen bg-[#020617] text-primary">
                <div className="relative">
                    <div className="absolute inset-0 bg-cyan-500/20 blur-xl rounded-full"></div>
                    <Loader2 className="relative animate-spin h-12 w-12 text-cyan-500" />
                </div>
                <p className="mt-4 text-slate-400 text-sm font-medium tracking-widest uppercase animate-pulse">Carregando Hub...</p>
            </div>
        );
    }
    
    if (!appUser && isPublicPage) {
         return <>{children}</>;
    }

    if (appUser) {
        return (
            <SidebarProvider defaultOpen={true}>
                <AuthenticatedAppShell>{children}</AuthenticatedAppShell>
            </SidebarProvider>
        );
    }
    
    return <>{children}</>;
};

const AuthenticatedAppShell = ({ children }: { children: React.ReactNode }) => {
    const { toggleSidebar, state: sidebarState, isMobile, setOpenMobile } = useSidebar();
    const currentPathname = usePathname();
    const router = useRouter();
    const { appUser, userAppRole, acceptUserTerms } = useAuth();

    const handleLogout = async () => {
        await signOut(auth);
        router.replace('/login');
    };

    if (!appUser) return null;

    const formatUserRole = (role: UserType | null): string => {
        const map: Record<string, string> = { 
            admin: "Administrador", superadmin: "Super Admin", vendedor: "Consultor", 
            prospector: "SDR", user: "Cliente", advogado: "Jurídico", pending_setup: "Pendente" 
        };
        return map[role || ''] || "Usuário";
    };

    // Estilo do Botão do Menu (Ativo/Inativo)
    const getMenuClass = (isActive: boolean) => cn(
        "transition-all duration-200 font-medium tracking-wide",
        isActive 
            ? "bg-gradient-to-r from-cyan-600/20 to-blue-600/10 text-cyan-400 border-l-2 border-cyan-500 pl-3 shadow-[0_0_15px_rgba(6,182,212,0.1)]" 
            : "text-slate-400 hover:text-white hover:bg-white/5 pl-4"
    );

    const menuIconClass = (isActive: boolean) => cn(
        "w-5 h-5 mr-3 transition-colors",
        isActive ? "text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]" : "text-slate-500 group-hover:text-slate-300"
    );

    // Verificações de permissão
    const isAdminOrSuper = userAppRole === 'admin' || userAppRole === 'superadmin';
    const isSeller = userAppRole === 'vendedor';

    return (
        <>
            <TermsDialog isOpen={!appUser.termsAcceptedAt} onAccept={acceptUserTerms} />
            
            <Sidebar collapsible="icon" className="border-r border-white/5 bg-[#020617]">
                
                {/* Header Sidebar */}
                <div className="h-16 flex items-center justify-center border-b border-white/5 bg-[#020617]">
                    {sidebarState === 'expanded' ? (
                         <div className="flex items-center gap-2 animate-in fade-in zoom-in duration-300">
                             <div className="p-1.5 bg-gradient-to-tr from-cyan-500 to-blue-600 rounded-lg shadow-[0_0_15px_rgba(6,182,212,0.3)]">
                                 <Zap className="h-5 w-5 text-white fill-white" />
                             </div>
                             <span className="font-heading font-bold text-xl tracking-tight text-white">Sent<span className="text-cyan-500">Energia</span></span>
                         </div>
                    ) : (
                        <div className="p-1.5 bg-gradient-to-tr from-cyan-500 to-blue-600 rounded-lg">
                             <Zap className="h-5 w-5 text-white fill-white" />
                        </div>
                    )}
                </div>

                {/* Profile Card */}
                {sidebarState === 'expanded' && (
                    <div className="mx-4 mt-6 p-3 rounded-xl bg-slate-900/50 border border-white/5 flex items-center gap-3 mb-2 animate-in slide-in-from-left-4 fade-in">
                        <Avatar className="h-10 w-10 border-2 border-cyan-500/30">
                            <AvatarImage src={appUser.photoURL || undefined} />
                            <AvatarFallback className="bg-slate-800 text-cyan-400 font-bold">{appUser.displayName?.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div className="overflow-hidden">
                            <h2 className="text-sm font-bold text-white truncate">{appUser.displayName}</h2>
                            <p className="text-xs text-slate-400 truncate">{formatUserRole(userAppRole)}</p>
                        </div>
                    </div>
                )}

                <SidebarContent className="px-2 mt-2 space-y-1 custom-scrollbar">
                    <SidebarMenu>
                        
                        {/* GRUPO 1: FERRAMENTAS ESSENCIAIS */}
                        <MenuSectionLabel label="Ferramentas" collapsed={sidebarState === 'collapsed'} />
                        
                        {userAppRole !== 'advogado' && (
                            <>
                                <MenuItem href="/dashboard" icon={Calculator} label="Calculadora" active={currentPathname === '/dashboard'} getMenuClass={getMenuClass} menuIconClass={menuIconClass} />
                                <MenuItem href="/proposal-generator" icon={FileText} label="Gerador Proposta" active={currentPathname.includes('/proposal')} getMenuClass={getMenuClass} menuIconClass={menuIconClass} />
                            </>
                        )}
                        
                        {(userAppRole === 'superadmin' || appUser.displayName?.toLowerCase() === 'jhonathas' || userAppRole === 'advogado') && (
                            <MenuItem href="/faturas" icon={FileText} label="Faturas Inteligentes" active={currentPathname === '/faturas'} getMenuClass={getMenuClass} menuIconClass={menuIconClass} />
                        )}

                        {userAppRole !== 'advogado' && (
                            <>
                                {/* GRUPO 2: COMERCIAL & VENDAS */}
                                <MenuSectionLabel label="Comercial" collapsed={sidebarState === 'collapsed'} />

                                {isSeller && (
                                    <MenuItem href="/dashboard/seller" icon={LayoutDashboard} label="Meu Painel" active={currentPathname === '/dashboard/seller'} getMenuClass={getMenuClass} menuIconClass={menuIconClass} />
                                )}
                                
                                {(isAdminOrSuper || appUser?.canViewCrm) && (
                                    <MenuItem href="/crm" icon={UsersRound} label="CRM & Pipeline" active={currentPathname === '/crm'} getMenuClass={getMenuClass} menuIconClass={menuIconClass} />
                                )}
                                
                                <MenuItem href="/carteira" icon={Wallet} label="Minha Carteira" active={currentPathname === '/carteira'} getMenuClass={getMenuClass} menuIconClass={menuIconClass} />

                                {isAdminOrSuper && (
                                    <>
                                        <MenuItem href="/leads" icon={ListChecks} label="Importar Leads" active={currentPathname === '/leads'} getMenuClass={getMenuClass} menuIconClass={menuIconClass} />
                                        <MenuItem href="/disparos" icon={Send} label="Disparos em Massa" active={currentPathname === '/disparos'} getMenuClass={getMenuClass} menuIconClass={menuIconClass} />
                                    </>
                                )}

                                {/* GRUPO 3: GESTÃO & EQUIPE */}
                                <MenuSectionLabel label="Gestão" collapsed={sidebarState === 'collapsed'} />
                                
                                {isAdminOrSuper && (
                                    <>
                                        <MenuItem href="/admin/dashboard" icon={ShieldAlert} label="Painel Admin" active={currentPathname === '/admin/dashboard'} getMenuClass={getMenuClass} menuIconClass={menuIconClass} />
                                        <MenuItem href="/admin/goals" icon={Target} label="Metas & Objetivos" active={currentPathname === '/admin/goals'} getMenuClass={getMenuClass} menuIconClass={menuIconClass} />
                                        <MenuItem href="/admin/training" icon={TrainingIcon} label="Treinamentos" active={currentPathname === '/admin/training'} getMenuClass={getMenuClass} menuIconClass={menuIconClass} />
                                    </>
                                )}

                                <MenuItem href="/ranking" icon={Trophy} label="Ranking" active={currentPathname === '/ranking'} getMenuClass={getMenuClass} menuIconClass={menuIconClass} />
                                
                                {(isSeller || isAdminOrSuper) && (
                                    <MenuItem href="/team" icon={Network} label="Minha Equipe" active={currentPathname === '/team'} getMenuClass={getMenuClass} menuIconClass={menuIconClass} />
                                )}
                                
                                {userAppRole === 'superadmin' && (
                                    <MenuItem href="/photo-enhancer" icon={Sparkles} label="IA Fotos" active={currentPathname === '/photo-enhancer'} getMenuClass={getMenuClass} menuIconClass={menuIconClass} />
                                )}

                                {appUser?.canViewCareerPlan && (
                                    <MenuItem href="/career-plan" icon={Rocket} label="Plano de Carreira" active={currentPathname.startsWith('/career-plan')} getMenuClass={getMenuClass} menuIconClass={menuIconClass} />
                                )}
                            </>
                        )}
                        
                        {/* GRUPO 4: CONTA */}
                        <MenuSectionLabel label="Conta" collapsed={sidebarState === 'collapsed'} />
                        <MenuItem href="/profile" icon={CircleUserRound} label="Meu Perfil" active={currentPathname === '/profile'} getMenuClass={getMenuClass} menuIconClass={menuIconClass} />
                        <MenuItem href="/sobre" icon={Info} label="Sobre" active={currentPathname === '/sobre'} getMenuClass={getMenuClass} menuIconClass={menuIconClass} />
                    </SidebarMenu>
                </SidebarContent>

                <SidebarFooter className="p-4 border-t border-white/5 bg-[#020617]">
                    <Button variant="ghost" onClick={handleLogout} className="w-full justify-start text-red-400 hover:text-red-300 hover:bg-red-500/10 gap-3 transition-colors">
                        <LogOut className="h-5 w-5" />
                        {sidebarState === 'expanded' && <span className="font-medium">Sair do Sistema</span>}
                    </Button>
                </SidebarFooter>
            </Sidebar>

            {/* CONTEÚDO PRINCIPAL */}
            <SidebarInset className="bg-[#020617] relative overflow-hidden">
                
                {/* Background Blobs Globais */}
                <div className="fixed inset-0 z-0 pointer-events-none">
                    <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-cyan-600/10 rounded-full blur-[120px] animate-float"></div>
                    <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[120px] animate-float" style={{animationDelay: '2s'}}></div>
                </div>

                {/* Mobile Header Trigger */}
                <header className="sticky top-0 z-30 flex h-14 items-center gap-x-4 border-b border-white/5 bg-slate-950/50 backdrop-blur-md px-4 sm:px-6 md:hidden">
                    <Button variant="ghost" size="icon" onClick={toggleSidebar} className="text-white">
                        <Menu className="h-6 w-6" />
                    </Button>
                    <span className="font-heading font-bold text-lg text-white">Sent Energia</span>
                </header>

                <main className="relative z-10 flex-1 overflow-auto h-full">
                    {children}
                </main>
            </SidebarInset>
        </>
    );
};

// Componente Auxiliar de Item de Menu (Limpo e Reutilizável)
const MenuItem = ({ href, icon: Icon, label, active, getMenuClass, menuIconClass }: any) => (
    <SidebarMenuItem>
        <Link href={href} className="w-full block">
            <SidebarMenuButton className={cn("w-full group h-11 mb-1 transition-all", getMenuClass(active))}>
                <Icon className={menuIconClass(active)} />
                <span className="truncate">{label}</span>
            </SidebarMenuButton>
        </Link>
    </SidebarMenuItem>
);

// Componente Auxiliar para Títulos de Seção
const MenuSectionLabel = ({ label, collapsed }: { label: string, collapsed: boolean }) => {
    if (collapsed) return <div className="h-4"></div>; // Espaço em branco se colapsado
    return (
        <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold px-4 py-2 mt-4 mb-1 animate-in fade-in">
            {label}
        </div>
    );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="dark">
      <head>
        <title>Sent Energia Hub</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <meta name="theme-color" content="#020617" />
      </head>
      <body className="font-sans antialiased bg-background text-foreground selection:bg-cyan-500/30 selection:text-cyan-100">
        <AuthProvider>
            <AppLayoutContent>{children}</AppLayoutContent>
            <Toaster />
            <CommandMenu />
        </AuthProvider>
      </body>
    </html>
  );
}
