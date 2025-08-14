
"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, ShieldAlert, LayoutDashboard, History, Lightbulb, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

// This layout will wrap all pages under /forex-invest
export default function ForexInvestLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isLoadingAuth, userAppRole } = useAuth();
  const pathname = usePathname();

  const navItems = [
    { href: '/forex-invest', label: 'Projeção e Dashboard', icon: LayoutDashboard },
    { href: '/forex-invest/operations', label: 'Minhas Operações', icon: History },
    { href: '/forex-invest/strategies', label: 'Estratégias', icon: Lightbulb },
  ];

  if (isLoadingAuth) {
    return (
      <div className="flex flex-col justify-center items-center h-screen bg-transparent text-primary">
        <Loader2 className="animate-spin rounded-full h-12 w-12 text-primary mb-4" />
        <p className="text-lg font-medium">Verificando permissões...</p>
      </div>
    );
  }

  if (userAppRole !== 'superadmin') {
     return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-56px)] text-destructive p-4 text-center">
        <ShieldAlert size={64} className="mb-4" />
        <h1 className="text-2xl font-bold">Acesso Negado</h1>
        <p>Você não tem permissão para acessar esta área.</p>
      </div>
    );
  }
  
  return (
    <div className="flex h-full">
        <aside className="w-64 flex-shrink-0 bg-card/50 backdrop-blur-sm border-r p-4">
            <h2 className="text-2xl font-bold text-primary mb-6 flex items-center">
                <svg className="w-8 h-8 mr-2" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M4 4h4v16H4V4zm8 8h4v8h-4v-8zm0-8h4v4h-4V4z" fill="currentColor"/>
                </svg>
                Forex Vision
            </h2>
            <nav className="flex flex-col gap-2">
                {navItems.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                        <Link key={item.href} href={item.href} passHref>
                            <Button
                                variant={isActive ? 'default' : 'ghost'}
                                className={cn("w-full justify-start", isActive && "bg-accent text-accent-foreground")}
                            >
                                <item.icon className="mr-2 h-4 w-4" />
                                {item.label}
                            </Button>
                        </Link>
                    );
                })}
                 <Button
                    variant='ghost'
                    className="w-full justify-start text-muted-foreground cursor-not-allowed"
                    disabled
                >
                    <Settings className="mr-2 h-4 w-4" />
                    Configurações
                </Button>
            </nav>
        </aside>
        <main className="flex-1 overflow-y-auto">
            {children}
        </main>
    </div>
  );
}
