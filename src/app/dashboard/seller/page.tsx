
// src/app/dashboard/seller/page.tsx
"use client";

import { Suspense, useEffect, useState, useMemo } from 'react'; 
import { useRouter } from 'next/navigation'; 
import SellerCommissionDashboard from '@/components/seller/SellerCommissionDashboard';
import type { AppUser } from '@/types/user'; 
import { useAuth } from '@/contexts/AuthContext'; 
import { Loader2 } from 'lucide-react';
import { getLeadsForTeam } from '@/actions/user/getTeamLeads';
import type { LeadWithId } from '@/types/crm';

function SellerDashboardPageContent() {
  const { appUser, isLoadingAuth, userAppRole } = useAuth();
  const router = useRouter();
  const [leads, setLeads] = useState<LeadWithId[]>([]);
  const [isLoadingLeads, setIsLoadingLeads] = useState(true);

  useEffect(() => {
    if (!isLoadingAuth && (!appUser || userAppRole !== 'vendedor')) {
      router.replace('/login'); 
    }
  }, [isLoadingAuth, appUser, userAppRole, router]);

  useEffect(() => {
    if (appUser && userAppRole === 'vendedor') {
      setIsLoadingLeads(true);
      getLeadsForTeam(appUser.uid)
        .then(setLeads)
        .catch(error => {
          console.error("Error fetching team leads for dashboard:", error);
          setLeads([]);
        })
        .finally(() => setIsLoadingLeads(false));
    }
  }, [appUser, userAppRole]);

  if (isLoadingAuth || !appUser || userAppRole !== 'vendedor') {
    return (
      <div className="flex flex-col justify-center items-center h-screen bg-transparent text-primary">
        <Loader2 className="animate-spin rounded-full h-12 w-12 text-primary mb-4" />
        <p className="text-lg font-medium">Carregando dados do vendedor...</p>
      </div>
    );
  }

  return (
    <SellerCommissionDashboard 
      loggedInUser={appUser as AppUser} 
      leads={leads}
      isLoading={isLoadingLeads}
    />
  );
}


export default function SellerDashboardPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col justify-center items-center h-screen bg-transparent text-primary">
        <Loader2 className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4" />
        <p className="text-lg font-medium">Carregando Painel do Vendedor...</p>
      </div>
    }>
      <SellerDashboardPageContent />
    </Suspense>
  );
}
