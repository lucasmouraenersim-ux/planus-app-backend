
"use client";

import { Suspense, useEffect, useState, useMemo } from 'react'; 
import { useRouter } from 'next/navigation'; 
import SellerCommissionDashboard from '@/components/seller/SellerCommissionDashboard';
import type { AppUser } from '@/types/user'; 
import { useAuth } from '@/contexts/AuthContext'; 
import { Loader2 } from 'lucide-react';
import type { LeadWithId } from '@/types/crm';
import { collection, onSnapshot, query, where, or, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { parseISO } from 'date-fns';

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
    if (appUser && userAppRole === 'vendedor') {
      setIsLoadingLeads(true);
      
      const downlineUids = allFirestoreUsers
        .filter(u => u.uplineUid === appUser.uid)
        .map(u => u.uid);
      
      const uidsToQuery = [appUser.uid, ...downlineUids];
      
      if (uidsToQuery.length === 0) {
        setLeads([]);
        setIsLoadingLeads(false);
        return;
      }
      
      const q = query(collection(db, 'crm_leads'), where('userId', 'in', uidsToQuery));
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const teamLeads = snapshot.docs.map(docSnap => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            ...data,
            createdAt: (data.createdAt as Timestamp).toDate().toISOString(),
            lastContact: (data.lastContact as Timestamp).toDate().toISOString(),
            signedAt: data.signedAt ? (data.signedAt as Timestamp).toDate().toISOString() : undefined,
            completedAt: data.completedAt ? (data.completedAt as Timestamp).toDate().toISOString() : undefined,
          } as LeadWithId
        });
        setLeads(teamLeads);
        setIsLoadingLeads(false);
      }, (error) => {
        console.error("Error fetching seller and team leads:", error);
        setIsLoadingLeads(false);
      });

      return () => unsubscribe();
    }
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
