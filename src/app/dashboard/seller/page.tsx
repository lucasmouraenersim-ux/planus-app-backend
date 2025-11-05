
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

    const downlineUids = allFirestoreUsers
        .filter(u => u.uplineUid === appUser.uid)
        .map(u => u.uid);

    const allTeamUids = [appUser.uid, ...downlineUids];
    
    // A query 'in' é limitada a 30 itens. Se a equipe for maior, precisará de múltiplas queries.
    if (allTeamUids.length > 30) {
        console.warn("A equipe excede 30 membros, a consulta de leads pode estar incompleta.");
        // Implementar lógica de múltiplas queries se necessário
    }
    
    const leadsQuery = query(collection(db, 'crm_leads'), where('userId', 'in', allTeamUids));

    const unsubscribe = onSnapshot(leadsQuery, (snapshot) => {
        const fetchedLeads: LeadWithId[] = [];
        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            fetchedLeads.push({
                id: docSnap.id,
                ...data,
                createdAt: (data.createdAt as Timestamp)?.toDate().toISOString(),
                lastContact: (data.lastContact as Timestamp)?.toDate().toISOString(),
                signedAt: data.signedAt ? (data.signedAt as Timestamp).toDate().toISOString() : undefined,
                completedAt: data.completedAt ? (data.completedAt as Timestamp).toDate().toISOString() : undefined,
            } as LeadWithId);
        });
        setLeads(fetchedLeads);
        setIsLoadingLeads(false);
    }, (error) => {
        console.error("❌ ERRO ao buscar leads em tempo real:", error);
        setIsLoadingLeads(false);
    });

    return () => unsubscribe(); // Limpa o listener ao desmontar o componente

  }, [appUser, allFirestoreUsers, isLoadingAuth]);
  

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
