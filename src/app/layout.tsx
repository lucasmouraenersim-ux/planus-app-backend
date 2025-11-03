
"use client";

// import type { Metadata } from 'next'; // Metadata can be an issue with "use client"
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { TermsDialog } from '@/components/auth/TermsDialog';
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarInset,
  useSidebar,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import React, { ReactNode, useEffect } from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { BarChart3, Calculator, UsersRound, Wallet, Rocket, CircleUserRound, LogOut, FileText, LayoutDashboard, ShieldAlert, Loader2, Menu, Send, Info, Network, Banknote, BrainCircuit, LineChart, GraduationCap, Target, ListChecks, BookOpen as TrainingIcon, CloudRain, Trophy, Image as ImageIcon } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import type { UserType } from '@/types/user';
import { useToast } from '@/hooks/use-toast';

// This component decides which layout to render
const AppLayoutContent = ({ children }: { children: React.ReactNode }) => {
    const pathname = usePathname();
    const router = useRouter();
    const { appUser, isLoadingAuth, userAppRole } = useAuth();

    // The /meteorologia/* routes now use this root AuthProvider, so they need to be handled
    // as public-like pages here, but their own layout will manage auth state internally.
    const isMeteorologiaPage = pathname.startsWith('/meteorologia');
    if (isMeteorologiaPage) {
        return <>{children}</>;
    }

    useEffect(() => {
        if (!isLoadingAuth) {
            const isAuthPage = pathname === '/login' || pathname === '/register';
            const isPublicPage = pathname === '/' || pathname === '/politica-de-privacidade' || pathname === '/photo-requests';
            const isTrainingPage = pathname === '/training';

            if (appUser) { // User is logged in
                if (userAppRole === 'prospector' && !isTrainingPage) {
                    router.replace('/training');
                    return;
                }
                
                if (isAuthPage) {
                    if (pathname !== '/') {
                        router.replace('/dashboard');
                    }
                }
            } else { // User is not logged in
                if (!isAuthPage && !isPublicPage) {
                    router.replace('/login');
                }
            }
        }
    }, [isLoadingAuth, appUser, userAppRole, pathname, router]);
    
    if (isLoadingAuth) {
        return (
            <div className="flex flex-col justify-center items-center h-screen bg-background text-primary">
                <Loader2 className="animate-spin rounded-full h-12 w-12 text-primary mb-4" />
            </div>
        );
    }
    
    // Public pages render without the authenticated shell
    if (!appUser && (pathname === '/' || pathname === '/login' || pathname === '/register' || pathname === '/politica-de-privacidade')) {
         return <>{children}</>;
    }

    // Authenticated users or users on other pages get the full shell
    if (appUser) {
        // Special case for prospectors on the training page, show minimal shell
        if (userAppRole === 'prospector' && pathname === '/training') {
            return <MinimalShell>{children}</MinimalShell>;
        }

        return (
            <SidebarProvider defaultOpen={true}>
                <AuthenticatedAppShell>{children}</AuthenticatedAppShell>
            </SidebarProvider>
        );
    }
    
    // Fallback for non-logged-in users on public pages that might not have appUser yet
    if (!appUser && (pathname === '/' || pathname === '/politica-de-privacidade')) {
      return <>{children}</>;
    }

    // Fallback loader for any other edge cases
    return (
      <div className="flex flex-col justify-center items-center h-screen bg-background text-primary">
          <Loader2 className="animate-spin rounded-full h-12 w-12 text-primary mb-4" />
      </div>
    );
};


// Minimal shell for users in training
const MinimalShell = ({ children }: { children: React.ReactNode }) => {
    const { appUser } = useAuth();
    const router = useRouter();
    const handleLogout = async () => {
        try {
            await signOut(auth);
            router.replace('/login');
        } catch (error) {
            console.error("Logout error:", error);
        }
    };

    return (
        <div className="flex flex-col h-screen">
             <header className="sticky top-0 z-30 flex h-14 items-center gap-x-4 border-b bg-background/70 backdrop-blur-md px-4 sm:px-6 py-2">
                <h1 className="text-lg font-semibold text-primary truncate flex-grow">Sent Energia - Treinamento</h1>
                 <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground hidden sm:inline">{appUser?.displayName || appUser?.email}</span>
                    <Button variant="outline" size="sm" onClick={handleLogout}>
                        <LogOut className="mr-2 h-4 w-4"/>Sair
                    </Button>
                </div>
            </header>
            <main className="flex-1 overflow-auto bg-muted/30">{children}</main>
        </div>
    );
};


// Main authenticated shell with sidebar and header
const AuthenticatedAppShell = ({ children }: { children: React.ReactNode }) => {
    const { toggleSidebar, state: sidebarState, isMobile, openMobile, setOpenMobile } = useSidebar();
    const currentPathname = usePathname();
    const router = useRouter();
    const { toast } = useToast();
    const { appUser, userAppRole, acceptUserTerms } = useAuth();

    const handleLogout = async () => {
        try {
            await signOut(auth);
            router.replace('/login');
        } catch (error) {
            console.error("Logout error:", error);
        }
    };

    const handleAcceptTerms = async () => {
        try {
            await acceptUserTerms();
            toast({ title: "Termos Aceitos", description: "Obrigado! Você pode continuar a usar o aplicativo." });
        } catch (error) {
            toast({ title: "Erro", description: "Não foi possível salvar sua aceitação.", variant: "destructive" });
        }
    };
    
    if (!appUser) return null;

    const showTermsDialog = !appUser.termsAcceptedAt;

    const formatUserRole = (role: UserType | null): string => {
        if (!role) return "Usuário";
        const map: Record<UserType, string> = { admin: "Administrador", superadmin: "Super Admin", vendedor: "Vendedor", prospector: "Prospector", user: "Cliente", pending_setup: "Pendente", advogado: "Advogado" };
        return map[role] || role.charAt(0).toUpperCase() + role.slice(1);
    };

    return (
        <>
            <TermsDialog isOpen={showTermsDialog} onAccept={handleAcceptTerms} />
            <Sidebar collapsible={isMobile ? "offcanvas" : "icon"}>
                {(!isMobile || openMobile) && (
                    <div className={cn("p-3 border-b border-sidebar-border text-center", (sidebarState === 'collapsed' && !isMobile) && "hidden")}>
                        <h2 className="text-lg font-semibold text-sidebar-foreground truncate">{appUser.displayName || "Usuário"}</h2>
                        <p className="text-xs text-sidebar-foreground/80">{formatUserRole(userAppRole)}</p>
                    </div>
                )}
                <SidebarContent className={cn((!isMobile || openMobile) && "pt-4")}>
                    <SidebarMenu>
                         <SidebarMenuItem>
                            <Link href="/dashboard"><SidebarMenuButton isActive={currentPathname === '/dashboard'} tooltip="Calculadora"><Calculator />Calculadora</SidebarMenuButton></Link>
                         </SidebarMenuItem>
                         <SidebarMenuItem>
                           <Link href="/proposal-generator"><SidebarMenuButton isActive={currentPathname === '/proposal-generator'} tooltip="Gerador de Proposta"><FileText />Proposta</SidebarMenuButton></Link>
                         </SidebarMenuItem>
                         {userAppRole === 'vendedor' && (<SidebarMenuItem><Link href="/dashboard/seller"><SidebarMenuButton isActive={currentPathname === '/dashboard/seller'} tooltip="Meu Painel"><LayoutDashboard />Meu Painel</SidebarMenuButton></Link></SidebarMenuItem>)}
                         {(userAppRole === 'admin' || userAppRole === 'superadmin' || appUser?.canViewCrm) && (<SidebarMenuItem><Link href="/crm"><SidebarMenuButton tooltip="Gestão de Clientes" isActive={currentPathname === '/crm'}><UsersRound />CRM</SidebarMenuButton></Link></SidebarMenuItem>)}
                         {(userAppRole === 'admin' || userAppRole === 'superadmin') && (<SidebarMenuItem><Link href="/leads"><SidebarMenuButton tooltip="Importar Leads" isActive={currentPathname === '/leads'}><ListChecks />Leads</SidebarMenuButton></Link></SidebarMenuItem>)}
                         {(userAppRole === 'admin' || userAppRole === 'superadmin') && (<SidebarMenuItem><Link href="/disparos"><SidebarMenuButton tooltip="Disparos em Massa" isActive={currentPathname === '/disparos'}><Send />Disparos</SidebarMenuButton></Link></SidebarMenuItem>)}
                         <SidebarMenuItem><Link href="/carteira"><SidebarMenuButton tooltip="Minha Carteira" isActive={currentPathname === '/carteira'}><Wallet />Carteira</SidebarMenuButton></Link></SidebarMenuItem>
                         {(userAppRole === 'admin' || userAppRole === 'superadmin') && (<SidebarMenuItem><Link href="/admin/dashboard"><SidebarMenuButton isActive={currentPathname === '/admin/dashboard'} tooltip="Painel Admin"><ShieldAlert />Painel Admin</SidebarMenuButton></Link></SidebarMenuItem>)}
                         {(userAppRole === 'admin' || userAppRole === 'superadmin') && (<SidebarMenuItem><Link href="/admin/goals"><SidebarMenuButton isActive={currentPathname === '/admin/goals'} tooltip="Metas"><Target />Metas</SidebarMenuButton></Link></SidebarMenuItem>)}
                         {(userAppRole === 'admin' || userAppRole === 'superadmin') && (<SidebarMenuItem><Link href="/admin/training"><SidebarMenuButton isActive={currentPathname === '/admin/training'} tooltip="Gerenciar Treinamento"><TrainingIcon />Gerenciar Treinamento</SidebarMenuButton></Link></SidebarMenuItem>)}
                         <SidebarMenuItem><Link href="/ranking"><SidebarMenuButton tooltip="Ranking de Performance" isActive={currentPathname === '/ranking'}><BarChart3 />Ranking</SidebarMenuButton></Link></SidebarMenuItem>
                         
                         {(userAppRole === 'vendedor' || userAppRole === 'admin' || userAppRole === 'superadmin') && (
                            <SidebarMenuItem>
                                <Link href="/team">
                                    <SidebarMenuButton isActive={currentPathname === '/team'} tooltip="Minha Equipe">
                                        <Network />Minha Equipe
                                    </SidebarMenuButton>
                                </Link>
                            </SidebarMenuItem>
                         )}

                         {appUser?.canViewCareerPlan && (<SidebarMenuItem><Link href="/career-plan"><SidebarMenuButton tooltip="Planejamento de Carreira" isActive={currentPathname === '/career-plan' || currentPathname.startsWith('/career-plan/')}><Rocket />Plano de Carreira</SidebarMenuButton></Link></SidebarMenuItem>)}
                         <SidebarMenuItem><Link href="/profile"><SidebarMenuButton tooltip="Meu Perfil" isActive={currentPathname === '/profile'}><CircleUserRound />Perfil</SidebarMenuButton></Link></SidebarMenuItem>
                         <SidebarMenuItem><Link href="/sobre"><SidebarMenuButton tooltip="Sobre o App" isActive={currentPathname.startsWith('/sobre')}><Info />Sobre</SidebarMenuButton></Link></SidebarMenuItem>
                    </SidebarMenu>
                </SidebarContent>
                <SidebarFooter className="p-2 border-t border-sidebar-border">
                    <TooltipProvider delayDuration={0}>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="ghost" onClick={handleLogout} className={cn("w-full flex items-center gap-2 p-2 text-left text-sm", "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground", (sidebarState === 'expanded' || openMobile) ? "justify-start" : "justify-center", (sidebarState === 'collapsed' && !isMobile) && "size-8 p-0")} aria-label="Sair">
                                    <LogOut className="h-5 w-5 flex-shrink-0" /><span className={cn((sidebarState === 'collapsed' && !isMobile) && "hidden")}>Sair</span>
                                </Button>
                            </TooltipTrigger>
                            {(sidebarState === 'collapsed' && !isMobile) && (<TooltipContent side="right" align="center"><p>Sair</p></TooltipContent>)}
                        </Tooltip>
                    </TooltipProvider>
                </SidebarFooter>
            </Sidebar>
            <SidebarInset onClick={() => { if (isMobile && openMobile) setOpenMobile(false); }}>
                <div className="absolute inset-0 z-[-1] bg-background">
                    <Image src="https://raw.githubusercontent.com/LucasMouraChaser/backgrounds-sent/refs/heads/main/Whisk_7171a56086%20(2).svg" alt="Blurred Background" fill sizes="100vw" style={{ objectFit: "cover", objectPosition: "center" }} className="filter blur-lg opacity-30" data-ai-hint="abstract background" priority />
                </div>
                <header className="sticky top-0 z-30 flex h-14 items-center gap-x-4 border-b bg-card/70 backdrop-blur-lg px-4 sm:px-6 py-2">
                    <Button variant="ghost" size="icon" onClick={toggleSidebar} className="rounded-full h-9 w-9 p-0 text-foreground hover:bg-accent hover:text-accent-foreground -ml-1" aria-label="Toggle sidebar">
                        <Avatar className="h-8 w-8"><AvatarImage src={appUser.photoURL || undefined} alt={appUser.displayName || "Usuário"} data-ai-hint="user avatar small" /><AvatarFallback className="text-xs bg-muted text-muted-foreground">{appUser.displayName ? appUser.displayName.substring(0, 2).toUpperCase() : (appUser.email ? appUser.email.substring(0, 2).toUpperCase() : "U")}</AvatarFallback></Avatar>
                    </Button>
                    <h1 className="text-lg font-semibold text-primary truncate flex-grow">Sent Energia</h1>
                </header>
                <main className="flex-1 overflow-auto">{children}</main>
            </SidebarInset>
        </>
    );
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700&family=Space+Grotesk:wght@400;500;700&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=PT+Sans:ital,wght@0,400;0,700;1,400;1,700&display=swap" rel="stylesheet" />
        <title>Sent Energia App</title>
      </head>
      <body className="font-body antialiased">
        <AuthProvider>
            <AppLayoutContent>{children}</AppLayoutContent>
            <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}
