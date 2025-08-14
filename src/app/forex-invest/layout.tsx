
"use client";

import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, ShieldAlert } from 'lucide-react';
import Image from 'next/image';

// This layout will wrap all pages under /forex-invest
export default function ForexInvestLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isLoadingAuth, userAppRole } = useAuth();

  if (isLoadingAuth) {
    return (
      <div className="flex flex-col justify-center items-center h-screen bg-transparent text-primary">
        <Loader2 className="animate-spin rounded-full h-12 w-12 text-primary mb-4" />
        <p className="text-lg font-medium">Verificando permissões...</p>
      </div>
    );
  }

  // NOTE: This logic should eventually be more specific, maybe checking for a specific role.
  // For now, we allow any logged-in user to see it, as per the new simplified structure.
  if (!isLoadingAuth && !userAppRole) {
     return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-56px)] text-destructive p-4 text-center">
        <ShieldAlert size={64} className="mb-4" />
        <h1 className="text-2xl font-bold">Acesso Negado</h1>
        <p>Você não tem permissão para acessar esta área.</p>
      </div>
    );
  }
  
  return (
    <div className="relative flex flex-col h-full">
        {/* The main content for the forex pages */}
        {children}
    </div>
  );
}
