
"use client";

import { useState, useEffect, Suspense, useRef } from 'react';
import type { LeadWithId } from '@/types/crm';
import { KanbanBoard } from '@/components/crm/KanbanBoard';
import { LeadForm } from '@/components/crm/LeadForm';
import { LeadDetailView } from '@/components/crm/LeadDetailView';
import { Button } from '@/components/ui/button';
import { PlusCircle, Users, Filter, Plus } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from "@/hooks/use-toast";
import { collection, query, onSnapshot, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { createCrmLead, updateCrmLeadDetails, approveCrmLead, requestCrmLeadCorrection } from '@/lib/firebase/firestore';
import { type LeadDocumentData } from '@/types/crm';


function CrmPageContent() {
  const { appUser, userAppRole } = useAuth();
  const { toast } = useToast();
  const [leads, setLeads] = useState<LeadWithId[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<LeadWithId | null>(null);
  const [editingLead, setEditingLead] = useState<LeadWithId | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const knownLeadIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!appUser) return;

    const q = query(collection(db, "crm_leads"), orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const fetchedLeads: LeadWithId[] = [];
        const currentLeadIds = new Set<string>();

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const lead: LeadWithId = {
                id: doc.id,
                ...data,
                createdAt: (data.createdAt as Timestamp).toDate().toISOString(),
                lastContact: (data.lastContact as Timestamp).toDate().toISOString(),
                signedAt: data.signedAt ? (data.signedAt as Timestamp).toDate().toISOString() : undefined,
            } as LeadWithId;
            fetchedLeads.push(lead);
            currentLeadIds.add(lead.id);
        });

        // Check for new leads only after the initial load
        if (knownLeadIds.current.size > 0) {
            fetchedLeads.forEach(lead => {
                if (!knownLeadIds.current.has(lead.id)) {
                    toast({
                        title: "✨ Novo Lead Recebido!",
                        description: `Lead "${lead.name}" foi adicionado ao seu CRM.`,
                    });
                }
            });
        }
        
        setLeads(fetchedLeads);
        knownLeadIds.current = currentLeadIds;
        setIsLoading(false);
    }, (error) => {
        console.error("Error fetching real-time leads: ", error);
        toast({
            title: "Erro ao Carregar Leads",
            description: "Não foi possível buscar os leads em tempo real.",
            variant: "destructive",
        });
        setIsLoading(false);
    });

    return () => unsubscribe();
  }, [appUser, toast]);


  const handleOpenForm = (leadToEdit?: LeadWithId) => {
    setEditingLead(leadToEdit || null);
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingLead(null);
  };

  const handleFormSubmit = async (formData: Omit<LeadDocumentData, 'id' | 'createdAt' | 'lastContact' | 'userId'>, photoFile?: File, billFile?: File) => {
    setIsSubmitting(true);
    try {
      if (editingLead) {
        await updateCrmLeadDetails(editingLead.id, {
          ...formData,
          lastContactIso: new Date().toISOString(),
        });
        toast({ title: "Lead Atualizado", description: `Os dados de "${formData.name}" foram salvos.` });
      } else {
        if (!appUser) throw new Error("Usuário não autenticado.");
        const leadDataForCreation = {
          ...formData,
          sellerName: formData.sellerName || appUser.displayName || appUser.email!,
        };
        await createCrmLead(leadDataForCreation, photoFile, billFile);
        toast({ title: "Lead Criado", description: `"${formData.name}" foi adicionado ao CRM.` });
      }
      handleCloseForm();
    } catch (error) {
      console.error("Error submitting lead:", error);
      toast({ title: "Erro ao Salvar", description: "Não foi possível salvar o lead.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleViewLeadDetails = (lead: LeadWithId) => {
    setSelectedLead(lead);
  };

  const handleCloseLeadDetails = () => {
    setSelectedLead(null);
  };

  const handleApproveLead = async (leadId: string) => {
    try {
      await approveCrmLead(leadId);
      toast({ title: "Lead Aprovado", description: "O lead foi movido para 'Assinado'." });
      handleCloseLeadDetails();
    } catch (error) {
      console.error("Error approving lead:", error);
      toast({ title: "Erro ao Aprovar", description: "Não foi possível aprovar o lead.", variant: "destructive" });
    }
  };

  const handleRequestCorrectionLead = async (leadId: string, reason: string) => {
    try {
      await requestCrmLeadCorrection(leadId, reason);
      toast({ title: "Correção Solicitada", description: "O vendedor foi notificado." });
      handleCloseLeadDetails();
    } catch (error) {
      console.error("Error requesting correction:", error);
      toast({ title: "Erro na Solicitação", description: "Não foi possível solicitar a correção.", variant: "destructive" });
    }
  };


  if (isLoading) {
     return (
      <div className="flex flex-col justify-center items-center h-[calc(100vh-56px)] bg-transparent text-primary">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
        <p className="text-lg font-medium">Carregando leads...</p>
      </div>
    );
  }


  return (
    <div className="relative flex flex-col h-[calc(100vh-56px)] overflow-hidden">
      <header className="p-4 border-b border-sidebar-border bg-card/70 backdrop-blur-lg">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-semibold text-foreground flex items-center">
            <Users className="w-7 h-7 mr-3 text-primary" />
            CRM - Gestão de Leads
          </h1>
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm">
              <Filter className="w-4 h-4 mr-2" />
              Filtros
            </Button>
            <Button onClick={() => handleOpenForm()} size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground">
              <PlusCircle className="w-4 h-4 mr-2" />
              Novo Lead
            </Button>
          </div>
        </div>
      </header>
      
      <div className="flex-1 min-w-0 overflow-hidden"> {/* Wrapper for KanbanBoard */}
        <KanbanBoard leads={leads} onViewLeadDetails={handleViewLeadDetails} />
      </div>

      {/* Floating Action Button */}
      <Button
        onClick={() => handleOpenForm()}
        className="absolute bottom-6 left-6 w-14 h-14 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg z-20"
        aria-label="Adicionar Novo Lead"
        size="icon"
      >
        <Plus className="w-7 h-7" />
      </Button>

      <Dialog open={isFormOpen} onOpenChange={(open) => !open && handleCloseForm()}>
        <DialogContent className="sm:max-w-[600px] bg-card/70 backdrop-blur-lg border shadow-2xl text-foreground">
          <DialogHeader>
            <DialogTitle className="text-primary">{editingLead ? 'Editar Lead' : 'Criar Novo Lead'}</DialogTitle>
            <DialogDescription>
              {editingLead ? 'Atualize os dados do lead.' : 'Preencha os dados para criar um novo lead.'}
            </DialogDescription>
          </DialogHeader>
          <LeadForm 
            onSubmit={handleFormSubmit} 
            onCancel={handleCloseForm}
            initialData={editingLead || undefined}
            isSubmitting={isSubmitting}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedLead} onOpenChange={(open) => !open && handleCloseLeadDetails()}>
          <DialogContent className="max-w-3xl w-[90vw] h-[90vh] p-0 bg-transparent border-none shadow-none text-foreground">
            <DialogHeader className="sr-only">
              <DialogTitle>Detalhes do Lead</DialogTitle>
              <DialogDescription>
                Exibe os detalhes completos e o histórico de um lead específico.
              </DialogDescription>
            </DialogHeader>
            {selectedLead && (
              <LeadDetailView 
                lead={selectedLead} 
                onClose={handleCloseLeadDetails} 
                onEdit={() => {
                    handleCloseLeadDetails(); // Close detail view first
                    handleOpenForm(selectedLead); // Then open edit form
                }}
                isAdmin={userAppRole === 'admin'}
                onApprove={handleApproveLead}
                onRequestCorrection={handleRequestCorrectionLead}
              />
            )}
          </DialogContent>
      </Dialog>

    </div>
  );
}

export default function CRMPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col justify-center items-center h-screen bg-transparent text-primary">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
        <p className="text-lg font-medium">Carregando CRM...</p>
      </div>
    }>
      <CrmPageContent />
    </Suspense>
  );
}
