
"use client";

import { useState, useEffect, Suspense, useRef, useMemo } from 'react';
import type { LeadWithId, StageId } from '@/types/crm';
import { KanbanBoard } from '@/components/crm/KanbanBoard';
import { LeadForm } from '@/components/crm/LeadForm';
import { LeadDetailView } from '@/components/crm/LeadDetailView';
import { Button } from '@/components/ui/button';
import { PlusCircle, Users, Filter, Plus, Zap, Upload, Download, Loader2, CopyCheck, Trash2, Edit } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from "@/hooks/use-toast";
import { collection, query, onSnapshot, orderBy, Timestamp, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { createCrmLead, updateCrmLeadDetails, approveCrmLead, requestCrmLeadCorrection, updateCrmLeadStage, deleteCrmLead, assignLeadToSeller } from '@/lib/firebase/firestore';
import { type LeadDocumentData } from '@/types/crm';
import { Badge } from '@/components/ui/badge';
import { importLeadsFromCSV } from '@/actions/admin/leadManagement';
import Papa from 'papaparse';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface DuplicateGroup {
  key: string; // The CPF or CNPJ
  leads: LeadWithId[];
}

function CrmPageContent() {
  const { appUser, userAppRole, allFirestoreUsers } = useAuth();
  const { toast } = useToast();
  const [leads, setLeads] = useState<LeadWithId[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<LeadWithId | null>(null);
  const [editingLead, setEditingLead] = useState<LeadWithId | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const knownLeadIds = useRef<Set<string>>(new Set());
  
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isUploadingLeads, setIsUploadingLeads] = useState(false);

  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[]>([]);
  const [leadToDelete, setLeadToDelete] = useState<LeadWithId | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);


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
                    completedAt: data.completedAt ? (data.completedAt as Timestamp).toDate().toISOString() : undefined,
                } as LeadWithId;

                // Toast notification for new leads
                if (change.type === 'added' && !knownLeadIds.current.has(lead.id)) {
                    if (userAppRole === 'admin' || userAppRole === 'superadmin') {
                         toast({ title: "✨ Novo Lead Recebido!", description: `Lead "${lead.name}" foi adicionado ao CRM.` });
                    } else if (userAppRole === 'vendedor' && lead.stageId === 'para-atribuir') {
                        toast({ title: "📢 Novo Lead Disponível!", description: `Lead "${lead.name}" está disponível para atribuição.` });
                    }
                    knownLeadIds.current.add(lead.id);
                }

                leadsMap.set(change.doc.id, lead);
            }
        });

        const sortedLeads = Array.from(leadsMap.values()).sort((a, b) => {
          const getDateForSort = (lead: LeadWithId): Date => {
            if (lead.stageId === 'finalizado' && lead.completedAt) {
              return new Date(lead.completedAt);
            }
            if (lead.stageId === 'assinado' && lead.signedAt) {
              return new Date(lead.signedAt);
            }
            return new Date(lead.lastContact);
          };

          const dateA = getDateForSort(a);
          const dateB = getDateForSort(b);
          return dateB.getTime() - dateA.getTime();
        });
        
        setLeads(sortedLeads);

        if (isInitialLoadForSpinner) {
            setIsLoading(false);
        }
    };
    
    if (userAppRole === 'admin' || userAppRole === 'superadmin') {
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


  const kwhTotalFinalizado = useMemo(() => {
    return leads
      .filter(lead => lead.stageId === 'finalizado')
      .reduce((sum, lead) => sum + (lead.kwh || 0), 0);
  }, [leads]);

  const kwhTotalParaAtribuir = useMemo(() => {
    return leads
      .filter(lead => lead.stageId === 'para-atribuir')
      .reduce((sum, lead) => sum + (lead.kwh || 0), 0);
  }, [leads]);
  
  const kwhTotalFinalizadoNoPeriodo = useMemo(() => {
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
        if (lead.stageId !== 'finalizado' || !lead.completedAt) {
          return false;
        }
        const completedDate = new Date(lead.completedAt);
        // Check if completedDate is on or after startDate and before endDate.
        return completedDate >= startDate && completedDate < endDate;
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
        await updateCrmLeadDetails(editingLead.id, formData, photoFile, billFile);
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

  const handleImportLeads = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const fileInput = event.currentTarget.elements.namedItem('csvFile') as HTMLInputElement;

    if (!fileInput?.files?.length) {
      toast({ title: "Nenhum arquivo", description: "Por favor, selecione um arquivo CSV.", variant: "destructive" });
      return;
    }
    setIsUploadingLeads(true);
    const result = await importLeadsFromCSV(formData);
    toast({
      title: result.success ? "Importação Concluída" : "Erro na Importação",
      description: result.message,
      variant: result.success ? "default" : "destructive"
    });
    if (result.success) {
      // The realtime listener will pick up the new leads automatically.
      setIsImportModalOpen(false);
    }
    setIsUploadingLeads(false);
  };
  
  const handleDownloadTemplate = () => {
    const headers = "Cliente,Vendedor,Documento,Instalação,Concessionária,Plano,Consumo (KWh),Valor (RS),Status,Assinado em,Finalizado em,Data Referencia Venda,Criado em,Atualizado em";
    const csvContent = "data:text/csv;charset=utf-8," + encodeURI(headers);
    const link = document.createElement("a");
    link.setAttribute("href", csvContent);
    link.setAttribute("download", "modelo_importacao_leads.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportLeadsCSV = () => {
    if (leads.length === 0) {
      toast({ title: "Nenhum lead para exportar." });
      return;
    }
    const dataToExport = leads.map(lead => ({
      'Cliente': lead.name,
      'Vendedor': lead.sellerName,
      'Documento': lead.cpf || lead.cnpj || '',
      'Instalação': lead.codigoClienteInstalacao || '',
      'Concessionária': lead.concessionaria || '',
      'Plano': lead.plano || '',
      'Consumo (KWh)': lead.kwh,
      'Valor (R$)': lead.value,
      'Status': lead.stageId.toUpperCase(),
      'Assinado em': lead.signedAt ? format(parseISO(lead.signedAt), 'dd/MM/yyyy HH:mm') : '',
      'Finalizado em': lead.completedAt ? format(parseISO(lead.completedAt as string), 'dd/MM/yyyy HH:mm') : '',
      'Data Referencia Venda': lead.saleReferenceDate || '',
      'Criado em': format(parseISO(lead.createdAt), 'dd/MM/yyyy HH:mm'),
      'Atualizado em': format(parseISO(lead.lastContact), 'dd/MM/yyyy HH:mm'),
    }));
    const csv = Papa.unparse(dataToExport);
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `leads_planus_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
    toast({ title: "Exportação de Leads Iniciada", description: `${leads.length} leads exportados.` });
  };
  
  const handleCheckDuplicates = () => {
    const docMap = new Map<string, LeadWithId[]>();
    
    leads.forEach(lead => {
      const doc = (lead.cpf || lead.cnpj || '').replace(/\D/g, '');
      if (doc && doc.length >= 11) { // Only check for valid CPF/CNPJ lengths
        if (!docMap.has(doc)) {
          docMap.set(doc, []);
        }
        docMap.get(doc)!.push(lead);
      }
    });

    const duplicates: DuplicateGroup[] = [];
    docMap.forEach((leadGroup, key) => {
      if (leadGroup.length > 1) {
        duplicates.push({ key, leads: leadGroup.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) });
      }
    });
    
    if (duplicates.length === 0) {
      toast({ title: "Nenhuma Duplicidade Encontrada", description: "Não foram encontrados leads com o mesmo CPF ou CNPJ." });
      return;
    }

    setDuplicateGroups(duplicates);
    setIsDuplicateModalOpen(true);
  };
  
  const handleDeleteClick = (lead: LeadWithId) => {
    setLeadToDelete(lead);
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (leadToDelete) {
      await handleDeleteLead(leadToDelete.id);
      // UI will update via realtime listener, but we can also update the dialog state
      setDuplicateGroups(prev =>
        prev.map(group => ({
          ...group,
          leads: group.leads.filter(l => l.id !== leadToDelete!.id)
        })).filter(group => group.leads.length > 1)
      );
    }
    setLeadToDelete(null);
    setIsDeleteDialogOpen(false);
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
              <Badge variant="outline" className="border-emerald-600/50 text-emerald-500 bg-emerald-600/10 py-1.5">
                <Zap className="w-4 h-4 mr-1.5" />
                <span className="font-normal mr-1.5">Finalizado:</span>
                <span className="font-semibold">{kwhTotalFinalizado.toLocaleString('pt-BR')} kWh</span>
              </Badge>
              <Badge variant="outline" className="border-indigo-500/50 text-indigo-500 bg-indigo-500/10 py-1.5">
                <Zap className="w-4 h-4 mr-1.5" />
                <span className="font-normal mr-1.5">Finalizado (Período):</span>
                <span className="font-semibold">{kwhTotalFinalizadoNoPeriodo.toLocaleString('pt-BR')} kWh</span>
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
            {userAppRole === 'superadmin' && (
              <>
                <Button onClick={handleCheckDuplicates} size="sm" variant="outline">
                  <CopyCheck className="w-4 h-4 mr-2" />
                  Verificar Duplicados
                </Button>
                <Button onClick={() => setIsImportModalOpen(true)} size="sm" variant="outline">
                  <Upload className="w-4 h-4 mr-2" />
                  Importar
                </Button>
                <Button onClick={handleExportLeadsCSV} size="sm" variant="outline">
                  <Download className="w-4 h-4 mr-2" />
                  Exportar
                </Button>
              </>
            )}
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
            allUsers={allFirestoreUsers}
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
                isAdmin={userAppRole === 'admin' || userAppRole === 'superadmin'}
                onApprove={handleApproveLead}
                onRequestCorrection={handleRequestCorrectionLead}
              />
            )}
          </DialogContent>
      </Dialog>

      <Dialog open={isImportModalOpen} onOpenChange={setIsImportModalOpen}>
        <DialogContent className="sm:max-w-md bg-card/70 backdrop-blur-lg border text-foreground">
          <DialogHeader>
            <DialogTitle className="text-primary">Importar Leads por CSV</DialogTitle>
            <DialogDescription>
              Faça o upload de um arquivo CSV para adicionar novos leads em lote.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleImportLeads} className="space-y-4 py-3">
            <div className="space-y-2">
              <Label htmlFor="csvFile">Arquivo CSV</Label>
              <Input id="csvFile" name="csvFile" type="file" accept=".csv" disabled={isUploadingLeads} />
              <p className="text-sm text-muted-foreground">
                O arquivo deve seguir o modelo para evitar erros.
              </p>
            </div>
            <DialogFooter className="flex-col sm:flex-row sm:justify-between sm:items-center pt-2">
               <Button type="button" variant="link" size="sm" onClick={handleDownloadTemplate} className="p-0 h-auto text-primary justify-start order-last sm:order-first mt-2 sm:mt-0">
                  <Download className="mr-2 h-4 w-4" />
                  Baixar Modelo
               </Button>
               <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => setIsImportModalOpen(false)} disabled={isUploadingLeads}>Cancelar</Button>
                <Button type="submit" disabled={isUploadingLeads}>
                  {isUploadingLeads ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                  Importar Arquivo
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      
      <Dialog open={isDuplicateModalOpen} onOpenChange={setIsDuplicateModalOpen}>
        <DialogContent className="max-w-4xl w-[90vw] h-[90vh] bg-card/70 backdrop-blur-lg border text-foreground">
          <DialogHeader>
            <DialogTitle className="text-primary">Leads Duplicados Encontrados</DialogTitle>
            <DialogDescription>
              Foram encontrados {duplicateGroups.length} grupo(s) de leads com o mesmo CPF ou CNPJ.
              Analise e gerencie os leads abaixo para manter a base de dados organizada.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="flex-1 -mx-6 px-6">
            <div className="space-y-6 py-4">
              {duplicateGroups.map((group) => (
                <div key={group.key} className="p-4 rounded-lg border bg-background/50">
                  <h3 className="font-semibold mb-2">
                    Duplicidade para o Documento: <span className="text-primary font-mono">{group.key}</span>
                  </h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Vendedor</TableHead>
                        <TableHead>Estágio</TableHead>
                        <TableHead>Criado em</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {group.leads.map((lead) => (
                        <TableRow key={lead.id}>
                          <TableCell className="font-medium">{lead.name}</TableCell>
                          <TableCell>{lead.sellerName}</TableCell>
                          <TableCell>
                             <Badge variant="outline">{lead.stageId}</Badge>
                          </TableCell>
                          <TableCell>{format(parseISO(lead.createdAt), "dd/MM/yy HH:mm")}</TableCell>
                          <TableCell className="text-right space-x-1">
                            <Button variant="outline" size="sm" onClick={() => handleViewLeadDetails(lead)}>Ver Detalhes</Button>
                            <Button variant="outline" size="sm" onClick={() => { setIsDuplicateModalOpen(false); handleOpenForm(lead); }}>
                                <Edit className="w-3 h-3 mr-1"/>Editar
                            </Button>
                            <Button variant="destructive" size="sm" onClick={() => handleDeleteClick(lead)}>
                                <Trash2 className="w-3 h-3 mr-1"/>Remover
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ))}
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button onClick={() => setIsDuplicateModalOpen(false)}>Concluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação excluirá permanentemente o lead <strong className="text-foreground">{leadToDelete?.name}</strong>. Isso não pode ser desfeito.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setLeadToDelete(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={handleConfirmDelete}>
              Sim, Excluir Lead
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
