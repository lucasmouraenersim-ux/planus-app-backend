
"use client";

import { Suspense, useEffect } from 'react'; // Added useEffect
import AdminCommissionDashboard from '@/components/admin/AdminCommissionDashboard';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, ShieldCheck } from 'lucide-react';
import type { AppUser } from '@/types/user';

export default function AdminDashboardPage() {
  const { appUser, isLoadingAuth, userAppRole, allFirestoreUsers, isLoadingAllUsers, fetchAllAppUsers } = useAuth();

  // Effect to fetch users if admin is already logged in but allFirestoreUsers might not be populated initially
  useEffect(() => {
    if ((userAppRole === 'admin' || userAppRole === 'superadmin') && !isLoadingAllUsers && allFirestoreUsers.length === 0) {
      fetchAllAppUsers();
    }
  }, [userAppRole, isLoadingAllUsers, allFirestoreUsers.length, fetchAllAppUsers]);

  if (isLoadingAuth || ((userAppRole === 'admin' || userAppRole === 'superadmin') && isLoadingAllUsers)) {
    return (
      <div className="flex flex-col justify-center items-center h-screen bg-transparent text-primary">
        <Loader2 className="animate-spin rounded-full h-12 w-12 text-primary mb-4" />
        <p className="text-lg font-medium">Carregando dados do administrador...</p>
      </div>
    );
  }

  if ((userAppRole !== 'admin' && userAppRole !== 'superadmin') || !appUser) {
    return (
      <div className="flex flex-col items-center justify-center h-screen text-destructive">
        <ShieldCheck size={64} className="mb-4" />
        <h1 className="text-2xl font-bold">Acesso Negado</h1>
        <p>Você não tem permissão para acessar esta página.</p>
      </div>
    );
  }

  return (
    <Suspense fallback={
      <div className="flex flex-col justify-center items-center h-screen bg-transparent text-primary">
        <Loader2 className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4" />
        <p className="text-lg font-medium">Carregando Painel do Administrador...</p>
      </div>
    }>
      <AdminCommissionDashboard
        loggedInUser={appUser as AppUser}
        initialUsers={allFirestoreUsers}
        isLoadingUsersProp={isLoadingAllUsers}
        refreshUsers={fetchAllAppUsers}
      />
    </Suspense>
  );
}
