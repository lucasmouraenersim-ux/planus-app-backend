"use client";

import { Suspense, useEffect, useState } from 'react'; 
import { useRouter } from 'next/navigation'; 
import SellerCommissionDashboard from '@/components/seller/SellerCommissionDashboard';
import type { AppUser } from '@/types/user'; 
import { useAuth } from '@/contexts/AuthContext'; 
import { Loader2 } from 'lucide-react';
import type { LeadWithId } from '@/types/crm';
import { collection, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

function SellerDashboardPageContent() {
  const { appUser, isLoadingAuth, userAppRole, allFirestoreUsers } = useAuth();
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
            console.log('🔍 ===== DEBUG PAINEL VENDEDOR (ALTERNATIVO) =====');
            console.log('👤 appUser:', {
                uid: appUser.uid,
                displayName: appUser.displayName,
                email: appUser.email
            });
            console.log('👤 userAppRole:', userAppRole);
            console.log('👥 Total de usuários no sistema:', allFirestoreUsers.length);
            
            // MÉTODO ALTERNATIVO: Buscar direto do Firestore
            const leadsCollectionRef = collection(db, 'crm_leads');
            const snapshot = await getDocs(leadsCollectionRef);
            
            console.log('📊 Total de leads no Firestore:', snapshot.size);
            
            // Converter para array
            const allLeads: LeadWithId[] = [];
            snapshot.forEach(docSnap => {
                const data = docSnap.data();
                allLeads.push({
                    id: docSnap.id,
                    ...data,
                    createdAt: (data.createdAt as Timestamp)?.toDate().toISOString(),
                    lastContact: (data.lastContact as Timestamp)?.toDate().toISOString(),
                    signedAt: data.signedAt ? (data.signedAt as Timestamp).toDate().toISOString() : undefined,
                    completedAt: data.completedAt ? (data.completedAt as Timestamp).toDate().toISOString() : undefined,
                } as LeadWithId);
            });
            
            console.log('📊 Total de leads convertidos:', allLeads.length);
            
            // Buscar leads do vendedor e da equipe usando sellerName
            const sellerNameLower = (appUser.displayName || '').trim().toLowerCase();
            console.log('🔍 Buscando por sellerName:', sellerNameLower);
            
            // IDs da equipe (downline)
            const downlineUsers = allFirestoreUsers.filter(u => u.uplineUid === appUser.uid);
            const downlineNames = downlineUsers.map(u => u.displayName?.trim().toLowerCase()).filter(Boolean);
            
            console.log('👥 Equipe (downline):', {
                count: downlineUsers.length,
                names: downlineUsers.map(u => u.displayName)
            });
            
            // Log de alguns leads para debug
            console.log('📋 Amostra de 5 leads:', allLeads.slice(0, 5).map(l => ({
                id: l.id,
                name: l.name,
                sellerName: l.sellerName,
                stageId: l.stageId
            })));
            
            // Filtrar leads do vendedor + equipe
            const filteredLeads = allLeads.filter(lead => {
                const leadSellerName = lead.sellerName?.trim().toLowerCase();
                
                // Lead é do vendedor?
                if (leadSellerName === sellerNameLower) return true;
                
                // Lead é de alguém da equipe?
                if (downlineNames.includes(leadSellerName || '')) return true;
                
                return false;
            });
            
            console.log('📊 Leads filtrados:', {
                total: filteredLeads.length,
                finalizados: filteredLeads.filter(l => l.stageId === 'finalizado').length,
                assinados: filteredLeads.filter(l => l.stageId === 'assinado').length
            });
            
            // Log detalhado dos leads filtrados
            console.log('📋 Leads filtrados detalhados:');
            filteredLeads.forEach((lead, index) => {
                if (index < 10) { // Mostra só os 10 primeiros
                    console.log(`  ${index + 1}. ${lead.name} (${lead.sellerName}) - ${lead.stageId}`);
                }
            });
            
            console.log('🔍 =======================================');
            
            setLeads(filteredLeads);
        } catch (error) {
            console.error("❌ ERRO ao buscar leads:", error);
        } finally {
            setIsLoadingLeads(false);
        }
    };
  
    fetchLeads();
  }, [appUser, userAppRole, allFirestoreUsers]);

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
