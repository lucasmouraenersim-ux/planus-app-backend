
"use client";

import { useState, useEffect, Suspense, useRef, useMemo } from 'react';
import type { LeadWithId, StageId } from '@/types/crm';
import { KanbanBoard } from '@/components/crm/KanbanBoard';
import { LeadForm } from '@/components/crm/LeadForm';
import { LeadDetailView } from '@/components/crm/LeadDetailView';
import { Button } from '@/components/ui/button';
import { PlusCircle, Users, Filter, Plus, Zap } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from "@/hooks/use-toast";
import { collection, query, onSnapshot, orderBy, Timestamp, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { createCrmLead, updateCrmLeadDetails, approveCrmLead, requestCrmLeadCorrection, updateCrmLeadStage, deleteCrmLead, assignLeadToSeller } from '@/lib/firebase/firestore';
import { type LeadDocumentData } from '@/types/crm';
import { Badge } from '@/components/ui/badge';


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

    let unsubscribe1: () => void;
    let unsubscribe2: () => void;
    
    const leadsMap = new Map<string, LeadWithId>();

    const processSnapshot = (snapshot: any, isInitialLoadForSpinner = false) => {
        snapshot.docChanges().forEach((change: any) => {
            if (change.type === "removed") {
                leadsMap.delete(change.doc.id);
            } else {
                const data = change.doc.data();
                const lead: LeadWithId = {
                    id: change.doc.id,
                    ...data,
                    createdAt: (data.createdAt as Timestamp).toDate().toISOString(),
                    lastContact: (data.lastContact as Timestamp).toDate().toISOString(),
                    signedAt: data.signedAt ? (data.signedAt as Timestamp).toDate().toISOString() : undefined,
                } as LeadWithId;

                // Toast notification for new leads
                if (change.type === 'added' && !knownLeadIds.current.has(lead.id)) {
                    if (userAppRole === 'admin') {
                         toast({ title: "✨ Novo Lead Recebido!", description: `Lead "${lead.name}" foi adicionado ao CRM.` });
                    } else if (userAppRole === 'vendedor' && lead.stageId === 'para-atribuir') {
                        toast({ title: "📢 Novo Lead Disponível!", description: `Lead "${lead.name}" está disponível para atribuição.` });
                    }
                    knownLeadIds.current.add(lead.id);
                }

                leadsMap.set(change.doc.id, lead);
            }
        });

        const sortedLeads = Array.from(leadsMap.values()).sort((a, b) => new Date(b.lastContact).getTime() - new Date(a.lastContact).getTime());
        setLeads(sortedLeads);

        if (isInitialLoadForSpinner) {
            setIsLoading(false);
        }
    };
    
    if (userAppRole === 'admin') {
      const q = query(collection(db, "crm_leads"), orderBy("lastContact", "desc"));
      unsubscribe1 = onSnapshot(q, (snapshot) => processSnapshot(snapshot, true));
    } else if (userAppRole === 'vendedor') {
      // Query for user's own leads
      const q1 = query(collection(db, "crm_leads"), where("userId", "==", appUser.uid));
      unsubscribe1 = onSnapshot(q1, (snapshot) => processSnapshot(snapshot, true));

      // Query for unassigned leads
      const q2 = query(collection(db, "crm_leads"), where("stageId", "==", "para-atribuir"));
      unsubscribe2 = onSnapshot(q2, (snapshot) => processSnapshot(snapshot, false));
    } else {
        setIsLoading(false);
        setLeads([]);
    }

    return () => {
      if (unsubscribe1) unsubscribe1();
      if (unsubscribe2) unsubscribe2();
    };
  }, [appUser, toast, userAppRole]);


  const kwhTotalAssinado = useMemo(() => {
    return leads
      .filter(lead => lead.stageId === 'assinado')
      .reduce((sum, lead) => sum + (lead.kwh || 0), 0);
  }, [leads]);

  const kwhTotalParaAtribuir = useMemo(() => {
    return leads
      .filter(lead => lead.stageId === 'para-atribuir')
      .reduce((sum, lead) => sum + (lead.kwh || 0), 0);
  }, [leads]);
  
  const kwhTotalAssinadoNoPeriodo = useMemo(() => {
    const today = new Date();
    const dayOfMonth = today.getDate();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    let startDate: Date;
    let endDate: Date;

    // The sales cycle is from the 21st of one month to the 20th of the next.
    // So the end date should be the 21st at 00:00:00, making it exclusive.
    if (dayOfMonth < 21) {
      // Period from 21st of last month to 20th of this month.
      startDate = new Date(currentYear, currentMonth - 1, 21);
      endDate = new Date(currentYear, currentMonth, 21);
    } else {
      // Period from 21st of this month to 20th of next month.
      startDate = new Date(currentYear, currentMonth, 21);
      endDate = new Date(currentYear, currentMonth + 1, 21);
    }

    return leads
      .filter(lead => {
        if (lead.stageId !== 'assinado' || !lead.signedAt) {
          return false;
        }
        const signedDate = new Date(lead.signedAt);
        // Check if signedDate is on or after startDate and before endDate.
        return signedDate >= startDate && signedDate < endDate;
      })
      .reduce((sum, lead) => sum + (lead.kwh || 0), 0);
  }, [leads]);


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
  
  const handleMoveLead = async (leadId: string, newStageId: StageId) => {
    try {
      await updateCrmLeadStage(leadId, newStageId);
      toast({
        title: "Lead Movido",
        description: `O lead foi movido para o estágio "${newStageId}".`,
      });
      // The real-time listener will update the UI automatically.
    } catch (error) {
      console.error("Error moving lead:", error);
      toast({ title: "Erro ao Mover", description: "Não foi possível mover o lead.", variant: "destructive" });
    }
  };
  
  const handleDeleteLead = async (leadId: string) => {
    try {
      await deleteCrmLead(leadId);
      toast({
        title: "Lead Excluído",
        description: "O lead foi excluído com sucesso.",
      });
      // The real-time listener will update the UI automatically.
    } catch (error) {
      console.error("Error deleting lead:", error);
      toast({ title: "Erro ao Excluir", description: "Não foi possível excluir o lead.", variant: "destructive" });
    }
  };
  
  const handleAssignLead = async (leadId: string) => {
    if (!appUser) {
      toast({ title: "Erro de Autenticação", description: "Você precisa estar logado para atribuir um lead.", variant: "destructive" });
      return;
    }
    try {
      await assignLeadToSeller(leadId, {
        uid: appUser.uid,
        name: appUser.displayName || appUser.email!,
      });
      toast({
        title: "Lead Atribuído!",
        description: "O lead agora é seu e foi movido para 'Contato Inicial'.",
      });
    } catch (error) {
      console.error("Error assigning lead:", error);
      toast({ title: "Erro ao Atribuir", description: "Não foi possível atribuir o lead. Pode já ter sido pego por outro vendedor.", variant: "destructive" });
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
        <div className="flex justify-between items-center flex-wrap gap-4">
          <div className="flex items-center flex-wrap gap-x-4 gap-y-2">
            <h1 className="text-2xl font-semibold text-foreground flex items-center">
              <Users className="w-7 h-7 mr-3 text-primary" />
              CRM - Gestão de Leads
              <Badge variant="secondary" className="ml-4 text-base font-semibold">{leads.length}</Badge>
            </h1>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="border-green-500/50 text-green-500 bg-green-500/10 py-1.5">
                <Zap className="w-4 h-4 mr-1.5" />
                <span className="font-normal mr-1.5">Assinado:</span>
                <span className="font-semibold">{kwhTotalAssinado.toLocaleString('pt-BR')} kWh</span>
              </Badge>
              <Badge variant="outline" className="border-indigo-500/50 text-indigo-500 bg-indigo-500/10 py-1.5">
                <Zap className="w-4 h-4 mr-1.5" />
                <span className="font-normal mr-1.5">Assinado (Período):</span>
                <span className="font-semibold">{kwhTotalAssinadoNoPeriodo.toLocaleString('pt-BR')} kWh</span>
              </Badge>
              <Badge variant="outline" className="border-slate-500/50 text-slate-500 bg-slate-500/10 py-1.5">
                <Zap className="w-4 h-4 mr-1.5" />
                <span className="font-normal mr-1.5">Para Atribuir:</span>
                <span className="font-semibold">{kwhTotalParaAtribuir.toLocaleString('pt-BR')} kWh</span>
              </Badge>
            </div>
          </div>
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
        <KanbanBoard 
          leads={leads} 
          onViewLeadDetails={handleViewLeadDetails}
          userAppRole={userAppRole}
          onMoveLead={handleMoveLead}
          onDeleteLead={handleDeleteLead}
          onEditLead={handleOpenForm}
          onAssignLead={handleAssignLead}
        />
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
