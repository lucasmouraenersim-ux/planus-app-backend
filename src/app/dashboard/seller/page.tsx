
"use client";

import { Suspense, useEffect, useState } from 'react'; 
import { useRouter } from 'next/navigation'; 
import SellerCommissionDashboard from '@/components/seller/SellerCommissionDashboard';
import type { AppUser } from '@/types/user'; 
import { useAuth } from '@/contexts/AuthContext'; 
import { Loader2 } from 'lucide-react';
import type { LeadWithId } from '@/types/crm';
import { collection, getDocs, Timestamp, onSnapshot, query, where } from 'firebase/firestore'; // Import onSnapshot
import { db } from '@/lib/firebase';

function SellerDashboardPageContent() {
  const { appUser, isLoadingAuth, userAppRole, allFirestoreUsers, fetchAllCrmLeadsGlobally } = useAuth();
  const router = useRouter();
  const [leads, setLeads] = useState<LeadWithId[]>([]);
  const [isLoadingLeads, setIsLoadingLeads] = useState(true);

  // Redirecionar se não for vendedor
  useEffect(() => {
    if (!isLoadingAuth && (!appUser || userAppRole !== 'vendedor')) {
      router.replace('/login'); 
    }
  }, [isLoadingAuth, appUser, userAppRole, router]);

  // Buscar leads em tempo real
  useEffect(() => {
    if (isLoadingAuth || !appUser || !allFirestoreUsers.length) {
      return;
    }
  
    setIsLoadingLeads(true);
    
    // CORREÇÃO: Usar a mesma estratégia da página de Ranking
    // Busca TODOS os leads e filtra por sellerName (nome do vendedor)
    fetchAllCrmLeadsGlobally().then(allLeads => {
        const sellerNameLower = (appUser.displayName || '').trim().toLowerCase();
        
        // Filtra os leads que pertencem ao vendedor logado ou à sua downline
        const downlineUids = allFirestoreUsers
            .filter(u => u.uplineUid === appUser.uid)
            .map(u => u.uid);

        const myLeads = allLeads.filter(lead => 
            (lead.sellerName?.trim().toLowerCase() === sellerNameLower) || 
            (downlineUids.includes(lead.userId))
        );

        setLeads(myLeads);
        setIsLoadingLeads(false);
    }).catch(error => {
        console.error("❌ ERRO ao buscar leads no painel do vendedor:", error);
        setIsLoadingLeads(false);
    });

  }, [appUser, allFirestoreUsers, isLoadingAuth, fetchAllCrmLeadsGlobally]);
  

  if (isLoadingAuth || isLoadingLeads) {
    return (
      <div className="flex flex-col justify-center items-center h-screen bg-transparent text-primary">
        <Loader2 className="animate-spin rounded-full h-12 w-12 text-primary mb-4" />
        <p className="text-lg font-medium">Carregando dados do painel...</p>
      </div>
    );
  }

  if (!appUser) {
    return (
      <div className="flex flex-col justify-center items-center h-screen bg-transparent text-destructive">
        <p className="text-lg font-medium">Erro: Usuário não autenticado.</p>
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
