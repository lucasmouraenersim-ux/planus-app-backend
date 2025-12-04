"use client";

import { PhotoEnhancer } from '@/components/photo/PhotoEnhancer';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, ShieldAlert } from 'lucide-react';

export default function PhotoEnhancerPage() {
  const { userAppRole, isLoadingAuth } = useAuth();

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
        <p>Apenas Super Admins podem acessar esta página.</p>
      </div>
    );
  }

  return <PhotoEnhancer />;
}
