"use client";

import './globals.css';
import React, { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { SidebarProvider, Sidebar, SidebarContent, SidebarFooter, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarInset, useSidebar } from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import Link from 'next/link';
import { 
  BarChart3, Calculator, UsersRound, Wallet, Rocket, CircleUserRound, LogOut, 
  FileText, ShieldAlert, Loader2, Info, Network, Target, ListChecks, 
  BookOpen as TrainingIcon, Image as ImageIcon, Zap, Send, LayoutDashboard, 
  Menu, Sparkles, Trophy, UserCog
} from 'lucide-react';
import { cn } from "@/lib/utils";
import type { UserType, AppUser } from '@/types/user';
import { CommandMenu } from '@/components/ui/command-menu';
import { TermsDialog } from '@/components/auth/TermsDialog';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';


const AppSidebar = () => {
    const { appUser, userAppRole } = useAuth();
    const { state: sidebarState } = useSidebar();
    const router = useRouter();
    const currentPathname = usePathname();

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

    const isAdminOrSuper = userAppRole === 'admin' || userAppRole === 'superadmin';
    const isSeller = userAppRole === 'vendedor';

    return (
        <Sidebar collapsible="icon" className="border-r border-white/5 bg-[#020617]">
            <div className="h-16 flex items-center justify-center border-b border-white/5 bg-[#020617]">
                <Link href="/hub" className="w-full flex justify-center">
                    {sidebarState === 'expanded' ? (
                        <div className="flex items-center gap-2 cursor-pointer animate-in fade-in">
                            <img src="https://raw.githubusercontent.com/lucasmouraenersim-ux/main/b0c93c3d8a644f4a5c54974a14b804bab886dcac/LOGO_LOGO_BRANCA.png" alt="Sent Energia" className="h-8 w-auto object-contain"/>
                        </div>
                    ) : (
                        <div className="p-1.5 bg-gradient-to-tr from-cyan-500 to-blue-600 rounded-lg cursor-pointer">
                            <Zap className="h-5 w-5 text-white fill-white" />
                        </div>
                    )}
                </Link>
            </div>
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
                            <MenuSectionLabel label="Gestão" collapsed={sidebarState === 'collapsed'} />
                            {isAdminOrSuper && (
                                <>
                                    <MenuItem href="/admin/dashboard" icon={ShieldAlert} label="Painel Admin" active={currentPathname === '/admin/dashboard'} getMenuClass={getMenuClass} menuIconClass={menuIconClass} />
                                    <MenuItem href="/admin/proposals" icon={BarChart3} label="Histórico Propostas" active={currentPathname === '/admin/proposals'} getMenuClass={getMenuClass} menuIconClass={menuIconClass} />
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
                                <MenuItem href="/plano-carreira" icon={Rocket} label="Plano de Carreira" active={currentPathname.startsWith('/plano-carreira')} getMenuClass={getMenuClass} menuIconClass={menuIconClass} />
                            )}
                        </>
                    )}
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
    );
}

const MobileHeader = () => {
    const { toggleSidebar } = useSidebar();
    return (
        <header className="sticky top-0 z-30 flex h-14 items-center gap-x-4 border-b border-white/5 bg-slate-950/50 backdrop-blur-md px-4 sm:px-6 md:hidden">
            <Button variant="ghost" size="icon" onClick={toggleSidebar} className="text-white">
                <Menu className="h-6 w-6" />
            </Button>
            <span className="font-heading font-bold text-lg text-white">Sent Energia</span>
        </header>
    );
};

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

const MenuSectionLabel = ({ label, collapsed }: { label: string, collapsed: boolean }) => {
    if (collapsed) return <div className="h-4"></div>;
    return (
        <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold px-4 py-2 mt-4 mb-1 animate-in fade-in">
            {label}
        </div>
    );
}

const AuthenticatedAppShell = ({ children }: { children: React.ReactNode }) => {
    const { isImpersonating, stopImpersonating, originalAdminUser, appUser } = useAuth();
    const pathname = usePathname();
    const isImmersivePage = pathname === '/hub' || pathname.startsWith('/meteorologia');

    if (isImmersivePage) {
       return (
         <>
          {isImpersonating && (
             <div className="fixed top-0 left-0 right-0 z-50 bg-yellow-500 text-black px-4 py-2 flex items-center justify-center gap-4 text-sm font-semibold">
                 <UserCog className="w-5 h-5" />
                 <span>Você está navegando como <strong>{appUser?.displayName}</strong>.</span>
                 <Button size="sm" variant="secondary" className="h-7 bg-black/10 hover:bg-black/20 text-black" onClick={stopImpersonating}>
                     Retornar para Admin ({originalAdminUser?.displayName})
                 </Button>
             </div>
           )}
           {children}
         </>
       );
    }
    
    return (
        <SidebarProvider defaultOpen={true}>
            {isImpersonating && (
                <div className="fixed top-0 left-0 right-0 z-50 bg-yellow-500 text-black px-4 py-2 flex items-center justify-center gap-4 text-sm font-semibold">
                    <UserCog className="w-5 h-5" />
                    <span>Você está navegando como <strong>{appUser?.displayName}</strong>.</span>
                    <Button size="sm" variant="secondary" className="h-7 bg-black/10 hover:bg-black/20 text-black" onClick={stopImpersonating}>
                        Retornar para Admin ({originalAdminUser?.displayName})
                    </Button>
                </div>
            )}
            <AppSidebar />
            <SidebarInset className="bg-[#020617] relative overflow-hidden">
                <div className="fixed inset-0 z-0 pointer-events-none">
                    <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-cyan-600/10 rounded-full blur-[120px] animate-float"></div>
                    <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[120px] animate-float" style={{animationDelay: '2s'}}></div>
                </div>
                <MobileHeader />
                <main className="relative z-10 flex-1 overflow-auto h-full">
                    {children}
                </main>
            </SidebarInset>
            <TermsDialogWrapper />
            <CommandMenu />
        </SidebarProvider>
    );
};

const TermsDialogWrapper = () => {
  const { appUser, acceptUserTerms } = useAuth();
  return <TermsDialog isOpen={!!appUser && !appUser.termsAcceptedAt} onAccept={acceptUserTerms} />;
};

const ClientLayout = ({ children }: { children: React.ReactNode }) => {
    const { appUser, isLoadingAuth } = useAuth();
    const router = useRouter();
    const pathname = usePathname();

    const isPublicPage = ['/login', '/register', '/'].includes(pathname) || pathname.startsWith('/meteorologia');

    useEffect(() => {
        if (!isLoadingAuth && !appUser && !isPublicPage) {
            router.replace('/login');
        }
    }, [isLoadingAuth, appUser, isPublicPage, router, pathname]);

    if (isLoadingAuth) {
        return (
            <div className="flex flex-col justify-center items-center h-screen bg-[#020617] text-primary">
                <Loader2 className="animate-spin h-12 w-12 text-cyan-500" />
            </div>
        );
    }

    if (appUser && !isPublicPage) {
        return <AuthenticatedAppShell>{children}</AuthenticatedAppShell>;
    }

    return <>{children}</>;
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="dark">
      <head>
        <title>Sent Energia Hub</title>
        <meta name="theme-color" content="#020617" />
      </head>
      <body className="font-sans antialiased bg-background text-foreground selection:bg-cyan-500/30 selection:text-cyan-100">
        <AuthProvider>
          <ClientLayout>{children}</ClientLayout>
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}
