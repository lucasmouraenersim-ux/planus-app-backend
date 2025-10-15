"use client";

import { Suspense, useEffect, useState, useMemo } from 'react'; 
import { useRouter } from 'next/navigation'; 
import SellerCommissionDashboard from '@/components/seller/SellerCommissionDashboard';
import type { AppUser } from '@/types/user'; 
import { useAuth } from '@/contexts/AuthContext'; 
import { Loader2 } from 'lucide-react';
import type { LeadWithId } from '@/types/crm';
import { collection, onSnapshot, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { parseISO } from 'date-fns';

function SellerDashboardPageContent() {
  const { appUser, isLoadingAuth, userAppRole, allFirestoreUsers, fetchAllCrmLeadsGlobally } = useAuth();
  const router = useRouter();
  const [leads, setLeads] = useState<LeadWithId[]>([]);
  const [isLoadingLeads, setIsLoadingLeads] = useState(true);

  useEffect(() => {
    if (!isLoadingAuth && (!appUser || userAppRole !== 'vendedor')) {
      router.replace('/login'); 
    }
  }, [isLoadingAuth, appUser, userAppRole, router]);

  useEffect(() => {
    if (!appUser || !allFirestoreUsers.length) return;
  
    const fetchLeads = async () => {
        setIsLoadingLeads(true);
        
        try {
            // CORREÇÃO: Buscar TODOS os leads e filtrar por sellerName
            const allLeads = await fetchAllCrmLeadsGlobally();
            
            console.log('🔍 ===== DEBUG PAINEL VENDEDOR =====');
            console.log('👤 appUser.uid:', appUser.uid);
            console.log('👤 appUser.displayName:', appUser.displayName);
            console.log('📊 Total de leads carregados:', allLeads.length);
            
            // Buscar leads do vendedor e da equipe usando sellerName
            const sellerNameLower = (appUser.displayName || '').trim().toLowerCase();
            
            // IDs da equipe (downline)
            const downlineUsers = allFirestoreUsers.filter(u => u.uplineUid === appUser.uid);
            const downlineNames = downlineUsers.map(u => u.displayName?.trim().toLowerCase()).filter(Boolean);
            
            console.log('👥 Equipe (downline):', downlineUsers.map(u => u.displayName));
            
            // Filtrar leads do vendedor + equipe
            const filteredLeads = allLeads.filter(lead => {
                const leadSellerName = lead.sellerName?.trim().toLowerCase();
                
                // Lead é do vendedor?
                if (leadSellerName === sellerNameLower) return true;
                
                // Lead é de alguém da equipe?
                if (downlineNames.includes(leadSellerName || '')) return true;
                
                return false;
            });
            
            console.log('📊 Leads do vendedor + equipe:', filteredLeads.length);
            console.log('📊 Leads finalizados:', filteredLeads.filter(l => l.stageId === 'finalizado').length);
            console.log('🔍 ==================================');
            
            setLeads(filteredLeads);
        } catch (error) {
            console.error("Error fetching seller and team leads:", error);
        } finally {
            setIsLoadingLeads(false);
        }
    };
  
    fetchLeads();
  }, [appUser, userAppRole, allFirestoreUsers, fetchAllCrmLeadsGlobally]);

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
