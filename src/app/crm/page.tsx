
"use client";

import React from 'react';
import { useState, useEffect, Suspense, useRef, useMemo, useCallback } from 'react';
import type { LeadWithId, StageId } from '@/types/crm';
import { KanbanBoard } from '@/components/crm/KanbanBoard';
import { LeadTable } from '@/components/crm/LeadTable'; 
import { LeadForm } from '@/components/crm/LeadForm';
import { LeadDetailView } from '@/components/crm/LeadDetailView';
import { Button } from '@/components/ui/button';
import { PlusCircle, Users, Filter, Plus, Zap, Upload, Download, Loader2, CopyCheck, Trash2, Edit, HelpCircle, BookOpen, MessageSquare, CheckCircle as CheckCircleIcon, ArrowLeft, ArrowRight, Kanban, List } from 'lucide-react';
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
import { collection, query, onSnapshot, orderBy, Timestamp, where, getDocs, getCountFromServer } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { createCrmLead, updateCrmLeadDetails, approveFinalizedLead, requestCrmLeadCorrection, updateCrmLeadStage, deleteCrmLead, assignLeadToSeller } from '@/lib/firebase/firestore';
import { type LeadDocumentData } from '@/types/crm';
import { Badge } from '@/components/ui/badge';
import { importLeadsFromCSV } from '@/actions/admin/leadManagement';
import Papa from 'papaparse';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from '@/components/ui/checkbox';
import { Card } from '@/components/ui/card';
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface DuplicateGroup {
  key: string; // The CPF or CNPJ
  leads: LeadWithId[];
}

const tutorialSteps = [
    {
        icon: BookOpen,
        title: "Como dar Feedback e Liberar Leads",
        description: "Este guia rápido mostrará como atualizar o status de seus leads para poder atribuir novos."
    },
    {
        icon: Edit,
        title: "Passo 1: Edite o Lead",
        description: "Encontre o lead que você já atendeu no Kanban e, no menu de ações, clique em 'Editar' para abrir o formulário."
    },
    {
        icon: MessageSquare,
        title: "Passo 2: Adicione uma Observação",
        description: "No formulário, vá até a seção 'Feedback do Vendedor' e escreva uma nota sobre o status da negociação (Ex: 'Proposta enviada, aguardando resposta')."
    },
    {
        icon: Upload,
        title: "Passo 3: Anexe um Comprovante",
        description: "Esta é a parte mais importante. Anexe um arquivo que comprove seu feedback, como um print da conversa, a proposta enviada, etc."
    },
    {
        icon: CheckCircleIcon,
        title: "Pronto! Vaga Liberada!",
        description: "Ao salvar, o sistema entende que você deu o feedback necessário e libera um novo espaço para você atribuir mais leads a si mesmo."
    }
];


function CrmPageContent() {
  const { appUser, userAppRole, allFirestoreUsers, isLoadingAllUsers } = useAuth();
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
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);


  // Filter states
  const [filterName, setFilterName] = useState("");
  const [filterCpf, setFilterCpf] = useState("");
  const [filterUc, setFilterUc] = useState("");
  const [filterPhone, setFilterPhone] = useState("");
  const [filterSeller, setFilterSeller] = useState("");

  const [viewMode, setViewMode] = useState<'kanban' | 'table'>('kanban');
  const [sortConfig, setSortConfig] = useState<{ key: keyof LeadWithId; direction: 'ascending' | 'descending' } | null>({ key: 'lastContact', direction: 'descending' });


  // Tutorial states
  const [isTutorialOpen, setIsTutorialOpen] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);
  const [dontShowTutorialAgain, setDontShowTutorialAgain] = useState(false);
  const [isFeedbackPopoverOpen, setIsFeedbackPopoverOpen] = useState(false);

  const assignmentLimit = appUser?.assignmentLimit ?? 2; // Use dynamic limit, default to 2

  useEffect(() => {
    // This effect runs on the client, so localStorage is available.
    if (userAppRole === 'vendedor') {
        const tutorialSeen = localStorage.getItem('sentCrmTutorialSeen');
        if (!tutorialSeen) {
            setIsTutorialOpen(true);
        }
    }
  }, [userAppRole]);

  const handleCloseTutorial = () => {
    if (dontShowTutorialAgain) {
        localStorage.setItem('sentCrmTutorialSeen', 'true');
    }
    setIsTutorialOpen(false);
    setTutorialStep(0); // Reset for next time if needed
  };

  const mapDocToLead = useCallback((doc: any): LeadWithId => {
    const data = doc.data();
    return {
        id: doc.id,
        ...data,
        createdAt: (data.createdAt as Timestamp)?.toDate().toISOString(),
        lastContact: (data.lastContact as Timestamp)?.toDate().toISOString(),
        signedAt: data.signedAt ? (data.signedAt as Timestamp).toDate().toISOString() : undefined,
        completedAt: data.completedAt ? (data.completedAt as Timestamp).toDate().toISOString() : undefined,
    } as LeadWithId;
  }, []);
  
// CORREÇÃO PARA O CRM
// Substituir o useEffect que carrega os leads por este código:

useEffect(() => {
    if (isLoadingAllUsers || !appUser) {
        setIsLoading(true);
        return;
    }

    const leadsCollection = collection(db, "crm_leads");
    let unsubscribe: () => void = () => {};

    // CORREÇÃO: Admins veem todos, vendedores filtram por sellerName (nome)
    if (userAppRole === 'admin' || userAppRole === 'superadmin' || userAppRole === 'advogado') {
        // Admins veem TODOS os leads
        const q = query(leadsCollection, orderBy("lastContact", "desc"));
        unsubscribe = onSnapshot(q, (snapshot) => {
            setLeads(snapshot.docs.map(mapDocToLead));
            setIsLoading(false);
        }, (error) => {
            console.error("Error fetching leads for admin:", error);
            toast({ title: "Erro ao Carregar Leads", variant: "destructive" });
            setIsLoading(false);
        });
    } else if (userAppRole === 'vendedor') {
        // Vendedores veem leads onde sellerName corresponde ao displayName
        // Como não podemos filtrar por sellerName no Firebase (não é indexado),
        // vamos buscar TODOS e filtrar no cliente
        const q = query(leadsCollection, orderBy("lastContact", "desc"));
        unsubscribe = onSnapshot(q, (snapshot) => {
            const allLeads = snapshot.docs.map(mapDocToLead);
            const sellerNameLower = (appUser.displayName || '').trim().toLowerCase();
            const filteredLeads = allLeads.filter(lead => 
                lead.sellerName?.trim().toLowerCase() === sellerNameLower
            );
            setLeads(filteredLeads);
            setIsLoading(false);
        }, (error) => {
            console.error("Error fetching leads for seller:", error);
            toast({ title: "Erro ao Carregar Leads", variant: "destructive" });
            setIsLoading(false);
        });
    } else {
        // Para qualquer outro tipo de usuário, não mostra leads
        setLeads([]);
        setIsLoading(false);
        unsubscribe = () => {};
    }

    return () => {
        unsubscribe();
    };
}, [appUser, userAppRole, toast, isLoadingAllUsers, mapDocToLead]);


  const handleSort = (key: keyof LeadWithId) => {
    setSortConfig(current => {
      if (current?.key === key && current.direction === 'ascending') {
        return { key, direction: 'descending' };
      }
      return { key, direction: 'ascending' };
    });
  };


  const filteredLeads = useMemo(() => {
    let sortableLeads = [...leads];

    sortableLeads = sortableLeads.filter(lead => {
      const cleanFilterName = filterName.trim().toLowerCase();
      const cleanFilterCpf = filterCpf.trim().replace(/\D/g, '');
      const cleanFilterUc = filterUc.trim().toLowerCase();
      const cleanFilterPhone = filterPhone.trim().replace(/\D/g, '');
      const cleanFilterSeller = filterSeller.trim().toLowerCase();

      if (cleanFilterName && !lead.name.toLowerCase().includes(cleanFilterName)) {
        return false;
      }
      
      const leadDocument = (lead.cpf || lead.cnpj || '').replace(/\D/g, '');
      if (cleanFilterCpf && !leadDocument.includes(cleanFilterCpf)) {
        return false;
      }
        
      const leadUc = lead.codigoClienteInstalacao || '';
      if (cleanFilterUc && !leadUc.toLowerCase().includes(cleanFilterUc)) {
        return false;
      }

      const leadPhone = lead.phone || '';
      if (cleanFilterPhone && !leadPhone.includes(cleanFilterPhone)) {
        return false;
      }

      if (cleanFilterSeller && !(lead.sellerName || '').toLowerCase().includes(cleanFilterSeller)) {
        return false;
      }

      return true;
    });

    if (sortConfig !== null) {
      sortableLeads.sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];

        if (aValue === undefined || aValue === null) return 1;
        if (bValue === undefined || bValue === null) return -1;
        
        if (aValue < bValue) {
          return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
      });
    }


    return sortableLeads;
  }, [leads, filterName, filterCpf, filterUc, filterPhone, filterSeller, sortConfig]);

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

  const downlineLevelMap = useMemo(() => {
    const map = new Map<string, number>();
    const findDownline = (uplineId: string, level = 1, maxLevel = 4) => {
        if (level > maxLevel) return;
        const directDownline = allFirestoreUsers.filter(u => u.uplineUid === uplineId && u.mlmEnabled);
        directDownline.forEach(u => {
            map.set(u.uid, level);
            findDownline(u.uid, level + 1, maxLevel);
        });
    };
    if (appUser) {
        findDownline(appUser.uid);
    }
    return map;
  }, [allFirestoreUsers, appUser]);

  const activeAssignedLeadsCount = useMemo(() => {
    if (!appUser) return 0;
    // An active lead is assigned to the user, not in a final state, and has no feedback attachment yet.
    return leads.filter(lead => 
      lead.userId === appUser.uid && 
      !['assinado', 'finalizado', 'perdido', 'cancelado'].includes(lead.stageId) &&
      !lead.hasFeedbackAttachment
    ).length;
  }, [leads, appUser]);
  
  const leadsWithPendingFeedback = useMemo(() => {
    if (!appUser) return [];
    // An active lead is assigned to the user, not in a final state, and has no feedback attachment yet.
    return leads.filter(lead => 
      lead.userId === appUser.uid && 
      !['assinado', 'finalizado', 'perdido', 'cancelado'].includes(lead.stageId) &&
      !lead.hasFeedbackAttachment
    );
  }, [leads, appUser]);

  const handleOpenForm = (leadToEdit?: LeadWithId) => {
    setEditingLead(leadToEdit || null);
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingLead(null);
  };

  const handleFormSubmit = async (
    formData: Omit<LeadDocumentData, 'id' | 'createdAt' | 'lastContact' | 'userId' | 'photoDocumentUrl' | 'billDocumentUrl' | 'legalRepresentativeDocumentUrl' | 'otherDocumentsUrl'>,
    photoFile?: File,
    billFile?: File,
    legalRepFile?: File,
    otherDocsFile?: File,
    feedbackAttachmentFile?: File
  ) => {
    setIsSubmitting(true);
    try {
      if (editingLead) {
        await updateCrmLeadDetails(
          editingLead.id,
          formData,
          photoFile,
          billFile,
          legalRepFile,
          otherDocsFile,
          feedbackAttachmentFile
        );
        toast({ title: "Lead Atualizado", description: `Os dados de "${formData.name || 'Lead'}" foram salvos.` });
      } else {
        if (!appUser) throw new Error("Usuário não autenticado.");
        const leadDataForCreation = {
          ...formData,
          sellerName: formData.sellerName || appUser.displayName || appUser.email!,
        };
        await createCrmLead(
          leadDataForCreation,
          photoFile,
          billFile,
          legalRepFile,
          otherDocsFile
        );
        toast({ title: "Lead Criado", description: `"${formData.name || 'Novo Lead'}" foi adicionado ao CRM.` });
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
      await approveFinalizedLead(leadId);
      toast({ title: "Lead Finalizado", description: "O lead foi movido para 'Finalizado' com sucesso." });
      handleCloseLeadDetails();
    } catch (error) {
      console.error("Error approving lead:", error);
      toast({ title: "Erro ao Aprovar", description: "Não foi possível finalizar o lead.", variant: "destructive" });
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
      }, assignmentLimit);
      toast({
        title: "Lead Atribuído!",
        description: "O lead agora é seu e foi movido para 'Contato Inicial'.",
      });
    } catch (error: any) {
      console.error("Error assigning lead:", error);
      toast({ title: "Erro ao Atribuir", description: error.message || "Não foi possível atribuir o lead. Pode já ter sido pego por outro vendedor.", variant: "destructive" });
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
      setIsSubmittingAction(true);
      await handleDeleteLead(leadToDelete.id);
      // UI will update via realtime listener, but we can also update the dialog state
      setDuplicateGroups(prev =>
        prev.map(group => ({
          ...group,
          leads: group.leads.filter(l => l.id !== leadToDelete!.id)
        })).filter(group => group.leads.length > 1)
      );
      setLeadToDelete(null);
      setIsDeleteDialogOpen(false);
      setIsSubmittingAction(false);
    }
  };


  if (isLoading || isLoadingAllUsers) {
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
              <Badge variant="secondary" className="ml-4 text-base font-semibold">{filteredLeads.length}</Badge>
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
             {userAppRole === 'vendedor' && (
                <Popover open={isFeedbackPopoverOpen} onOpenChange={setIsFeedbackPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Card className="px-3 py-2 border-primary/30 cursor-pointer hover:bg-muted/50 transition-colors">
                      <div className="flex items-center">
                          <span className="text-sm text-muted-foreground mr-2">Feedbacks Pendentes:</span>
                          <span className="text-xl font-bold text-primary">{activeAssignedLeadsCount}</span>
                          <TooltipProvider delayDuration={0}>
                              <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span onClick={(e) => e.stopPropagation()}>
                                      <HelpCircle className="w-4 h-4 ml-2 text-muted-foreground cursor-help" />
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                      <p className="max-w-xs">Este é o número de leads ativos que<br/> aguardam seu feedback com anexo. Zere<br/> o contador para poder atribuir mais leads.</p>
                                  </TooltipContent>
                              </Tooltip>
                          </TooltipProvider>
                      </div>
                    </Card>
                  </PopoverTrigger>
                  <PopoverContent className="w-80">
                      <div className="grid gap-4">
                          <div className="space-y-2">
                              <h4 className="font-medium leading-none">Leads com Feedback Pendente</h4>
                              <p className="text-sm text-muted-foreground">
                                  Adicione um feedback com anexo para liberar novos slots.
                              </p>
                          </div>
                          <ScrollArea className="max-h-60">
                            <div className="grid gap-2 pr-4">
                                {leadsWithPendingFeedback.length > 0 ? leadsWithPendingFeedback.map(lead => (
                                    <div key={lead.id} className="flex items-center justify-between p-2 rounded-md hover:bg-muted">
                                        <span className="text-sm font-medium truncate pr-2">{lead.name}</span>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-7 px-2"
                                            onClick={() => {
                                                handleOpenForm(lead);
                                                setIsFeedbackPopoverOpen(false);
                                            }}
                                        >
                                            <Edit className="w-3 h-3 mr-1" /> Editar
                                        </Button>
                                    </div>
                                )) : (
                                  <p className="text-sm text-muted-foreground text-center py-4">Nenhum feedback pendente!</p>
                                )}
                            </div>
                          </ScrollArea>
                      </div>
                  </PopoverContent>
                </Popover>
            )}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  <Filter className="w-4 h-4 mr-2" />
                  Filtros
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80">
                <div className="grid gap-4">
                  <div className="space-y-2">
                    <h4 className="font-medium leading-none">Filtros Ativos</h4>
                    <p className="text-sm text-muted-foreground">
                      Filtre os leads por critérios específicos.
                    </p>
                  </div>
                  <div className="grid gap-2">
                    <div className="grid grid-cols-3 items-center gap-4">
                      <Label htmlFor="filterName">Nome</Label>
                      <Input
                        id="filterName"
                        placeholder="Nome do cliente"
                        value={filterName}
                        onChange={(e) => setFilterName(e.target.value)}
                        className="col-span-2 h-8"
                      />
                    </div>
                    <div className="grid grid-cols-3 items-center gap-4">
                      <Label htmlFor="filterCpf">CPF/CNPJ</Label>
                      <Input
                        id="filterCpf"
                        placeholder="Documento"
                        value={filterCpf}
                        onChange={(e) => setFilterCpf(e.target.value)}
                        className="col-span-2 h-8"
                      />
                    </div>
                    <div className="grid grid-cols-3 items-center gap-4">
                      <Label htmlFor="filterUc">UC</Label>
                      <Input
                        id="filterUc"
                        placeholder="Unidade Consumidora"
                        value={filterUc}
                        onChange={(e) => setFilterUc(e.target.value)}
                        className="col-span-2 h-8"
                      />
                    </div>
                    <div className="grid grid-cols-3 items-center gap-4">
                      <Label htmlFor="filterPhone">Telefone</Label>
                      <Input
                        id="filterPhone"
                        placeholder="Telefone"
                        value={filterPhone}
                        onChange={(e) => setFilterPhone(e.target.value)}
                        className="col-span-2 h-8"
                      />
                    </div>
                    <div className="grid grid-cols-3 items-center gap-4">
                      <Label htmlFor="filterSeller">Vendedor</Label>
                      <Input
                        id="filterSeller"
                        placeholder="Nome do vendedor"
                        value={filterSeller}
                        onChange={(e) => setFilterSeller(e.target.value)}
                        className="col-span-2 h-8"
                      />
                    </div>
                  </div>
                  <Button
                    onClick={() => {
                      setFilterName('');
                      setFilterCpf('');
                      setFilterUc('');
                      setFilterPhone('');
                      setFilterSeller('');
                    }}
                  >
                    Limpar Filtros
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
             <div className="p-1 bg-muted rounded-md flex items-center">
                <Button variant={viewMode === 'kanban' ? 'default' : 'ghost'} size="sm" onClick={() => setViewMode('kanban')} className="h-8">
                    <Kanban className="w-4 h-4 mr-2" />
                    Kanban
                </Button>
                <Button variant={viewMode === 'table' ? 'default' : 'ghost'} size="sm" onClick={() => setViewMode('table')} className="h-8">
                    <List className="w-4 h-4 mr-2" />
                    Lista
                </Button>
            </div>
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
                <Button onClick={() => {
                    const csv = Papa.unparse(leads);
                    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                    const link = document.createElement("a");
                    const url = URL.createObjectURL(blob);
                    link.setAttribute("href", url);
                    link.setAttribute("download", "leads.csv");
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }} size="sm" variant="outline">
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
      
      <div className="flex-1 min-w-0 overflow-auto">
        {viewMode === 'kanban' ? (
           <KanbanBoard 
            leads={filteredLeads} 
            onViewLeadDetails={handleViewLeadDetails}
            userAppRole={userAppRole}
            onMoveLead={handleMoveLead}
            onDeleteLead={handleDeleteLead}
            onEditLead={handleOpenForm}
            onAssignLead={handleAssignLead}
            allFirestoreUsers={allFirestoreUsers}
            loggedInUser={appUser as AppUser}
            downlineLevelMap={downlineLevelMap}
            activeAssignedLeadsCount={activeAssignedLeadsCount}
            assignmentLimit={assignmentLimit}
          />
        ) : (
          <LeadTable
            leads={filteredLeads}
            onViewLeadDetails={handleViewLeadDetails}
            userAppRole={userAppRole}
            onMoveLead={handleMoveLead}
            onDeleteLead={handleDeleteLead}
            onEditLead={handleOpenForm}
            sortConfig={sortConfig}
            onSort={handleSort}
          />
        )}
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

      <Dialog open={isTutorialOpen} onOpenChange={(open) => {if (!open) handleCloseTutorial()}}>
        <DialogContent className="sm:max-w-md bg-card/80 backdrop-blur-lg border text-foreground">
          <DialogHeader>
            <div className="text-center mb-4">
              {React.createElement(tutorialSteps[tutorialStep].icon, { className: "w-12 h-12 mx-auto text-primary" })}
            </div>
            <DialogTitle className="text-primary text-center">{tutorialSteps[tutorialStep].title}</DialogTitle>
            <DialogDescription className="text-center min-h-[60px]">
              {tutorialSteps[tutorialStep].description}
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center space-x-2 pt-2">
            {tutorialSteps.map((_, index) => (
                <div key={index} className={`h-2 w-2 rounded-full transition-colors ${index === tutorialStep ? 'bg-primary' : 'bg-muted'}`} />
            ))}
          </div>
          <DialogFooter className="mt-4 sm:justify-between">
            <div className="flex items-center space-x-2">
                <Checkbox id="dont-show-again" checked={dontShowTutorialAgain} onCheckedChange={(checked) => setDontShowTutorialAgain(Boolean(checked))} />
                <Label htmlFor="dont-show-again" className="text-xs text-muted-foreground">Não mostrar novamente</Label>
            </div>
            <div className="flex gap-2">
                {tutorialStep > 0 && <Button variant="outline" onClick={() => setTutorialStep(s => s - 1)}><ArrowLeft className="w-4 h-4 mr-1" /> Anterior</Button>}
                {tutorialStep < tutorialSteps.length - 1 
                  ? <Button onClick={() => setTutorialStep(s => s + 1)}>Próximo <ArrowRight className="w-4 h-4 ml-1" /></Button>
                  : <Button onClick={handleCloseTutorial}>Entendi!</Button>
                }
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
            <AlertDialogCancel onClick={() => setLeadToDelete(null)} disabled={isSubmittingAction}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
                className="bg-destructive hover:bg-destructive/90"
                onClick={handleConfirmDelete}
                disabled={isSubmittingAction}
            >
                {isSubmittingAction && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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