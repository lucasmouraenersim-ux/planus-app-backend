
"use client";

import { Sidebar, SidebarContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarInset, SidebarProvider, useSidebar } from '@/components/ui/sidebar';
import { useAuth } from '@/contexts/AuthContext';
import { AreaChart, Banknote, BrainCircuit, Home, LayoutDashboard, Lightbulb, Menu, ShieldAlert, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ForexProvider } from '@/contexts/ForexProvider';
import { Toaster } from '@/components/ui/toaster';
import Image from 'next/image';

// Inner component that uses the sidebar context
function ForexShell({ children }: { children: React.ReactNode }) {
  const { isMobile, openMobile, setOpenMobile } = useSidebar();

  return (
    <div className="flex h-screen bg-background text-foreground font-sans">
      <Sidebar collapsible={isMobile ? 'offcanvas' : 'icon'} side="left" className="bg-primary text-primary-foreground border-r border-border/20">
        <SidebarContent className="p-2">
          <SidebarMenu>
            <SidebarMenuItem>
              <Link href="/forex-invest">
                <SidebarMenuButton tooltip="Dashboard" isActive={true}>
                  <LayoutDashboard />
                  Dashboard
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <Link href="/forex-invest/operations">
                <SidebarMenuButton tooltip="Minhas Operações">
                  <AreaChart />
                  Minhas Operações
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <Link href="/forex-invest/strategies">
                <SidebarMenuButton tooltip="Estratégias">
                  <Lightbulb />
                  Estratégias
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
            <SidebarMenuItem>
               <Link href="/admin/dashboard">
                <SidebarMenuButton tooltip="Painel Admin Planus">
                  <ShieldAlert />
                  Painel Admin
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarContent>
      </Sidebar>
      <SidebarInset className="flex-1 flex flex-col">
         <div className="absolute inset-0 z-[-1]">
            <Image src="https://raw.githubusercontent.com/LucasMouraChaser/backgrounds-sent/refs/heads/main/Whisk_7171a56086%20(2).svg" alt="Blurred Background" fill sizes="100vw" style={{ objectFit: "cover", objectPosition: "center" }} className="filter blur-lg" data-ai-hint="abstract background" priority />
            <div className="absolute inset-0 bg-background/80"></div>
         </div>
        <header className="flex items-center justify-between p-4 bg-card/60 backdrop-blur-lg border-b border-border">
           <Button variant="ghost" onClick={() => setOpenMobile(!openMobile)} className="md:hidden">
             {openMobile ? <X /> : <Menu />}
           </Button>
           <h1 className="text-xl font-bold text-primary font-serif">Forex Vision</h1>
         </header>
        <main className="flex-1 overflow-y-auto p-6">
          {children}
          <Toaster />
        </main>
      </SidebarInset>
    </div>
  );
}


export default function ForexInvestLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { appUser, isLoadingAuth, userAppRole } = useAuth();
  const router = useRouter();

  if (isLoadingAuth) {
    return <div className="flex justify-center items-center h-screen">Carregando...</div>;
  }

  if (!appUser || userAppRole !== 'superadmin') {
    router.replace('/dashboard');
    return null;
  }

  return (
    <ForexProvider>
      <SidebarProvider>
        <ForexShell>{children}</ForexShell>
      </SidebarProvider>
    </ForexProvider>
  );
}

    