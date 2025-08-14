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

export default function ForexInvestLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { appUser, isLoadingAuth, userAppRole } = useAuth();
  const router = useRouter();
  const { isMobile, openMobile, setOpenMobile } = useSidebar();

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
        <div className="flex h-screen bg-[#F0F2F5] dark:bg-gray-900 font-sans">
          <Sidebar collapsible={isMobile ? 'offcanvas' : 'icon'} side="left" className="bg-[#3F51B5] text-white">
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
            <header className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
               <Button variant="ghost" onClick={() => setOpenMobile(!openMobile)} className="md:hidden">
                 {openMobile ? <X /> : <Menu />}
               </Button>
               <h1 className="text-xl font-bold text-[#3F51B5] dark:text-[#C5CAE9] font-serif">Forex Vision</h1>
             </header>
            <main className="flex-1 overflow-y-auto p-6">
              {children}
              <Toaster />
            </main>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </ForexProvider>
  );
}
