
"use client";

import type { LeadWithId, ChatMessage as ChatMessageType } from '@/types/crm';
import { STAGES_CONFIG } from '@/config/crm-stages';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useState, useEffect, useRef } from 'react';
import { doc, getDoc, Timestamp, onSnapshot } from "firebase/firestore";
import { db } from '@/lib/firebase';
import { 
    DollarSign, Zap, User, CalendarDays, MessageSquare, Send, Edit, Paperclip, 
    CheckCircle, XCircle, AlertTriangle, X, Loader2, MessagesSquare, FileText, Banknote, UserSquare, Landmark, Download, Lightbulb, TrendingUp, Sparkles, BrainCircuit
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from '@/hooks/use-toast';
import { updateCrmLeadDetails, approveFinalizedLead } from '@/lib/firebase/firestore';
import { sendChatMessage } from '@/actions/chat/sendChatMessage';
import { analyzeLead, type AnalyzeLeadOutput } from '@/ai/flows/analyze-lead-flow';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { CHAT_TEMPLATES, type MessageTemplate } from '@/config/chat-templates';
import { trackEvent } from '@/lib/analytics/trackEvent'; // <-- IMPORTADO

const formatCurrency = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });


interface LeadDetailViewProps {
  lead: LeadWithId;
  onClose: () => void;
  onEdit: (lead: LeadWithId) => void;
  isAdmin?: boolean; 
  onApprove?: (leadId: string) => Promise<void>;
  onRequestCorrection?: (leadId: string, reason: string) => Promise<void>;
}

export function LeadDetailView({ lead, onClose, onEdit, isAdmin, onApprove, onRequestCorrection }: LeadDetailViewProps) {
  const { toast } = useToast();
  const { appUser } = useAuth();
  const [chatMessages, setChatMessages] = useState<ChatMessageType[]>([]);
  const [isLoadingChat, setIsLoadingChat] = useState(true);
  const [chatError, setChatError] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [correctionReason, setCorrectionReason] = useState('');
  const [showCorrectionInput, setShowCorrectionInput] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [isEditingSignedDate, setIsEditingSignedDate] = useState(false);
  const [newSignedDate, setNewSignedDate] = useState<Date | undefined>(
    lead.signedAt ? parseISO(lead.signedAt) : undefined
  );
  const [isEditingCompletedDate, setIsEditingCompletedDate] = useState(false);
  const [newCompletedDate, setNewCompletedDate] = useState<Date | undefined>(
    lead.completedAt ? parseISO(lead.completedAt) : undefined
  );

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalyzeLeadOutput | null>(null);

  const [isTemplatesPopoverOpen, setIsTemplatesPopoverOpen] = useState(false);

  const isOwner = appUser?.uid === lead.userId;

  // --- Track Event on View ---
  useEffect(() => {
    if (appUser && lead) {
      trackEvent({
        eventType: 'LEAD_VIEWED',
        user: { id: appUser.uid, name: appUser.displayName || 'N/A', email: appUser.email || 'N/A' },
        metadata: { leadId: lead.id, leadName: lead.name }
      });
    }
  }, [appUser, lead]);


  useEffect(() => {
    if (!lead.id) return;
    
    setIsLoadingChat(true);
    const chatDocRef = doc(db, "crm_lead_chats", lead.id);

    const unsubscribe = onSnapshot(chatDocRef, (docSnap) => {
        if (docSnap.exists()) {
            const messagesData = docSnap.data()?.messages || [];
            const formattedMessages: ChatMessageType[] = messagesData.map((msg: any) => ({
                ...msg,
                timestamp: (msg.timestamp as Timestamp).toDate().toISOString(),
            })).sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
            setChatMessages(formattedMessages);
        } else {
            setChatMessages([]);
        }
        setIsLoadingChat(false);
    }, (error) => {
        console.error("Error fetching chat history:", error);
        setChatError("Não foi possível carregar o histórico de mensagens.");
        setIsLoadingChat(false);
    });

    return () => unsubscribe();
}, [lead.id]);


  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleSendMessage = async () => {
    if (newMessage.trim() === '' || isSendingMessage) return;
    
    setIsSendingMessage(true);
    const messageToSend = newMessage;
    setNewMessage('');
    
    try {
      const result = await sendChatMessage({
        leadId: lead.id,
        phone: lead.phone,
        text: messageToSend,
        sender: 'user',
        type: 'text',
      });

      if (result.success && result.chatMessage) {
        // Optimistic update handled by listener
        if (result.message && result.message.includes('no phone number')) {
             toast({
                title: "Aviso: Apenas salvo no histórico",
                description: "Este lead não possui um número de telefone para envio. A mensagem foi salva no chat.",
                variant: "default",
            });
        }
      } else {
        toast({
          title: "Falha no Envio",
          description: result.message || "Não foi possível enviar a mensagem.",
          variant: "destructive",
        });
        setNewMessage(messageToSend); // Restore message on failure
      }

    } catch (error: any) {
        console.error("Error processing message:", error);
        toast({
            title: "Erro Inesperado",
            description: "Ocorreu um erro ao processar a mensagem.",
            variant: "destructive",
        });
        setNewMessage(messageToSend); 
    } finally {
      setIsSendingMessage(false);
    }
  };
  
  const handleRequestCorrection = async () => {
    if (!onRequestCorrection || !correctionReason.trim()) return;
    await onRequestCorrection(lead.id, correctionReason);
    setCorrectionReason('');
    setShowCorrectionInput(false);
  };
  
  const handleUpdateDate = async (field: 'signedAt' | 'completedAt', date: Date | undefined) => {
    if (!date || !lead.id) return;
    try {
        const fieldName = field === 'signedAt' ? 'de Assinatura' : 'de Finalização';
        await updateCrmLeadDetails(lead.id, { [field]: date.toISOString() });
        toast({
            title: `Data ${fieldName} Atualizada`,
            description: "A data foi salva com sucesso.",
        });
        if (field === 'signedAt') setIsEditingSignedDate(false);
        if (field === 'completedAt') setIsEditingCompletedDate(false);
    } catch (error) {
        console.error("Error updating date:", error);
        toast({
            title: "Erro ao Salvar",
            description: "Não foi possível salvar a nova data.",
            variant: "destructive",
        });
    }
  };

  const handleApproveAndFinalize = async () => {
    if (!isAdmin) return;
    try {
      await approveFinalizedLead(lead.id);
      toast({ title: "Lead Finalizado", description: "O lead foi movido para o estágio Finalizado com sucesso." });
      onClose(); // Close the detail view
    } catch (error) {
      console.error("Error finalizing lead:", error);
      toast({ title: "Erro", description: "Não foi possível finalizar o lead.", variant: "destructive" });
    }
  };

  const handleAnalyzeLead = async () => {
    setIsAnalyzing(true);
    setAnalysisResult(null);
    try {
        const result = await analyzeLead(lead.id);
        setAnalysisResult(result);
        toast({
            title: "Análise Concluída",
            description: "A pontuação do lead e a sugestão de ação foram atualizadas.",
        });
    } catch (error) {
        console.error("Error analyzing lead:", error);
        toast({ title: "Erro na Análise", description: "Não foi possível analisar o lead.", variant: "destructive" });
    } finally {
        setIsAnalyzing(false);
    }
  };


  const handleTemplateSelect = (template: MessageTemplate) => {
    if (!appUser) return;
    const populatedBody = template.body
      .replace(/{{leadName}}/g, lead.name)
      .replace(/{{userName}}/g, appUser.displayName || '');
    setNewMessage(populatedBody);
    setIsTemplatesPopoverOpen(false);
  };

  const stageInfo = STAGES_CONFIG.find(s => s.id === lead.stageId);
  const displayAnalysis = analysisResult || (lead.leadScore ? { leadScore: lead.leadScore, scoreJustification: lead.scoreJustification, nextActionSuggestion: lead.nextActionSuggestion } : null);

  return (
    <div className="p-0 md:p-2">
      <Card className="bg-card/80 backdrop-blur-xl border shadow-2xl flex flex-col h-[90vh]">
        <CardHeader className="flex flex-row justify-between items-start">
          <div>
            <CardTitle className="text-2xl font-bold text-primary mb-1">{lead.name}</CardTitle>
            {lead.company && <CardDescription className="text-sm text-muted-foreground">{lead.company}</CardDescription>}
            <div className="flex items-center gap-2 mt-2">
              {stageInfo && (
                <Badge className={`text-xs ${stageInfo.colorClass} text-white`}>{stageInfo.title}</Badge>
              )}
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </Button>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col min-h-0">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 mb-4 text-sm">
            <div className="flex items-center"><DollarSign className="w-4 h-4 mr-2 text-amber-400" /><strong>Valor:</strong><span className="ml-2 text-foreground">{formatCurrency(lead.value)}</span></div>
            <div className="flex items-center"><Zap className="w-4 h-4 mr-2 text-sky-400" /><strong>Consumo:</strong><span className="ml-2 text-foreground">{lead.kwh} kWh</span></div>
            <div className="flex items-center"><User className="w-4 h-4 mr-2 text-green-400" /><strong>Vendedor:</strong><span className="ml-2 text-foreground">{lead.sellerName}</span></div>
            <div className="flex items-center"><CalendarDays className="w-4 h-4 mr-2 text-purple-400" /><strong>Criado em:</strong><span className="ml-2 text-foreground">{format(parseISO(lead.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span></div>

            {/* Editable SignedAt */}
            <div className="flex items-center">
              <CalendarDays className="w-4 h-4 mr-2 text-green-500" />
              <strong>Assinado em:</strong>
              <span className="ml-2 text-foreground">{lead.signedAt ? format(parseISO(lead.signedAt), "dd/MM/yyyy") : 'N/A'}</span>
              {isAdmin && (
                <Popover open={isEditingSignedDate} onOpenChange={setIsEditingSignedDate}>
                  <PopoverTrigger asChild><Button variant="ghost" size="icon" className="ml-1 h-6 w-6"><Edit className="h-3 w-3" /></Button></PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-card border-border">
                    <Calendar mode="single" selected={newSignedDate} onSelect={setNewSignedDate} initialFocus locale={ptBR} />
                    <div className="p-2 border-t border-border flex justify-end"><Button size="sm" onClick={() => handleUpdateDate('signedAt', newSignedDate)} disabled={!newSignedDate}>Salvar</Button></div>
                  </PopoverContent>
                </Popover>
              )}
            </div>
            
            {/* Editable CompletedAt */}
            <div className="flex items-center">
              <CalendarDays className="w-4 h-4 mr-2 text-emerald-600" />
              <strong>Finalizado em:</strong>
              <span className="ml-2 text-foreground">{lead.completedAt ? format(parseISO(lead.completedAt), "dd/MM/yyyy") : 'N/A'}</span>
              {isAdmin && (
                <Popover open={isEditingCompletedDate} onOpenChange={setIsEditingCompletedDate}>
                  <PopoverTrigger asChild><Button variant="ghost" size="icon" className="ml-1 h-6 w-6"><Edit className="h-3 w-3" /></Button></PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-card border-border">
                    <Calendar mode="single" selected={newCompletedDate} onSelect={setNewCompletedDate} initialFocus locale={ptBR} />
                    <div className="p-2 border-t border-border flex justify-end"><Button size="sm" onClick={() => handleUpdateDate('completedAt', newCompletedDate)} disabled={!newCompletedDate}>Salvar</Button></div>
                  </PopoverContent>
                </Popover>
              )}
            </div>
          </div>
          
          {displayAnalysis && (
            <Card className="mb-4 bg-primary/5 border-primary/20">
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-base text-primary flex items-center">
                  <BrainCircuit className="w-5 h-5 mr-2" />
                  Insights da IA
                  {lead.lastAnalyzedAt && <CardDescription className="text-xs ml-auto">Última análise: {format(parseISO(lead.lastAnalyzedAt), "dd/MM/yy HH:mm")}</CardDescription>}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3 space-y-2 text-sm">
                <div className="flex items-center gap-4">
                  <div className="flex items-center font-semibold">
                    <TrendingUp className="w-4 h-4 mr-2 text-orange-400" />
                    Pontuação: <span className="ml-2 text-foreground text-base">{displayAnalysis.leadScore}/100</span>
                  </div>
                  <p className="text-muted-foreground flex-1">({displayAnalysis.scoreJustification})</p>
                </div>
                <div className="flex items-center font-semibold">
                  <Sparkles className="w-4 h-4 mr-2 text-amber-400" />
                  Próxima Ação Sugerida: <span className="ml-2 text-foreground font-normal">{displayAnalysis.nextActionSuggestion}</span>
                </div>
              </CardContent>
            </Card>
          )}

          {isAdmin && (
            <Card className="mb-4 bg-background/50 border-border">
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-base text-foreground">Detalhes Completos (Admin)</CardTitle>
              </CardHeader>
              <CardContent className="text-xs space-y-2 px-4 pb-3">
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  <p><strong>Email:</strong> {lead.email || 'N/A'}</p>
                  <p><strong>Telefone:</strong> {lead.phone || 'N/A'}</p>
                  <p><strong>Fonte do Lead:</strong> {lead.leadSource || 'N/A'}</p>
                  {lead.customerType === 'pf' && (
                    <>
                      <p><strong>CPF:</strong> {lead.cpf || 'N/A'}</p>
                      <p><strong>Naturalidade:</strong> {lead.naturality || 'N/A'}</p>
                      <p><strong>Estado Civil:</strong> {lead.maritalStatus || 'N/A'}</p>
                      <p><strong>Profissão:</strong> {lead.profession || 'N/A'}</p>
                    </>
                  )}
                  {lead.customerType === 'pj' && (
                    <>
                      <p><strong>CNPJ:</strong> {lead.cnpj || 'N/A'}</p>
                      <p><strong>Inscrição Estadual:</strong> {lead.stateRegistration || 'N/A'}</p>
                    </>
                  )}
                </div>
                {lead.correctionReason && <p className="pt-2 text-amber-600"><strong>Motivo Correção:</strong> {lead.correctionReason}</p>}
              </CardContent>
            </Card>
          )}

          {isAdmin && lead.customerType === 'pj' && (
            <Card className="mb-4 bg-background/50 border-border">
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-base text-foreground">Dados do Representante Legal</CardTitle>
              </CardHeader>
              <CardContent className="text-xs space-y-2 px-4 pb-3">
                 <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                    <p><strong>Nome:</strong> {lead.legalRepresentativeName || 'N/A'}</p>
                    <p><strong>CPF:</strong> {lead.legalRepresentativeCpf || 'N/A'}</p>
                    <p><strong>RG:</strong> {lead.legalRepresentativeRg || 'N/A'}</p>
                    <p><strong>Endereço:</strong> {lead.legalRepresentativeAddress || 'N/A'}</p>
                    <p><strong>Email:</strong> {lead.legalRepresentativeEmail || 'N/A'}</p>
                    <p><strong>Telefone:</strong> {lead.legalRepresentativePhone || 'N/A'}</p>
                    <p><strong>Estado Civil:</strong> {lead.legalRepresentativeMaritalStatus || 'N/A'}</p>
                    <p><strong>Data de Nascimento:</strong> {lead.legalRepresentativeBirthDate || 'N/A'}</p>
                    <p><strong>Profissão:</strong> {lead.legalRepresentativeProfession || 'N/A'}</p>
                    <p><strong>Nacionalidade:</strong> {lead.legalRepresentativeNationality || 'N/A'}</p>
                 </div>
              </CardContent>
            </Card>
          )}

          {(lead.photoDocumentUrl || lead.billDocumentUrl || lead.legalRepresentativeDocumentUrl || lead.otherDocumentsUrl) && (
            <Card className="mb-4 bg-background/50 border-border">
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-base text-foreground">Documentos Anexados</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <div className="flex flex-wrap items-center gap-4">
                  {lead.photoDocumentUrl && (
                    <a href={lead.photoDocumentUrl} target="_blank" rel="noopener noreferrer" className="inline-flex">
                      <Button variant="outline" size="sm"><FileText className="w-3.5 h-3.5 mr-2"/>Ver Doc. Cliente</Button>
                    </a>
                  )}
                  {lead.billDocumentUrl && (
                    <a href={lead.billDocumentUrl} target="_blank" rel="noopener noreferrer" className="inline-flex">
                      <Button variant="outline" size="sm"><Banknote className="w-3.5 h-3.5 mr-2"/>Ver Fatura</Button>
                    </a>
                  )}
                  {lead.legalRepresentativeDocumentUrl && (
                    <a href={lead.legalRepresentativeDocumentUrl} target="_blank" rel="noopener noreferrer" className="inline-flex">
                      <Button variant="outline" size="sm"><UserSquare className="w-3.5 h-3.5 mr-2"/>Ver Doc. Representante</Button>
                    </a>
                  )}
                  {lead.otherDocumentsUrl && (
                    <a href={lead.otherDocumentsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex">
                      <Button variant="outline" size="sm"><Landmark className="w-3.5 h-3.5 mr-2"/>Ver Demais Docs.</Button>
                    </a>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
          
          {(lead.sellerNotes || lead.feedbackAttachmentUrl) && (
            <Card className="mb-4 bg-background/50 border-border">
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-base text-foreground">Feedback do Vendedor</CardTitle>
              </CardHeader>
              <CardContent className="text-xs space-y-2 px-4 pb-3">
                {lead.sellerNotes && (
                  <p className="text-muted-foreground whitespace-pre-wrap"><strong>Notas:</strong> {lead.sellerNotes}</p>
                )}
                {lead.feedbackAttachmentUrl && (
                  <div className="flex items-center gap-4 pt-2">
                    <a href={lead.feedbackAttachmentUrl} target="_blank" rel="noopener noreferrer" className="inline-flex">
                      <Button variant="outline" size="sm"><Download className="w-3.5 h-3.5 mr-2"/>Ver Anexo de Feedback</Button>
                    </a>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {isAdmin && lead.stageId === 'assinado' && lead.needsAdminApproval && (
            <Card className="mb-4 border-amber-500 bg-amber-500/10">
              <CardHeader><CardTitle className="text-amber-600 text-base flex items-center"><AlertTriangle className="w-5 h-5 mr-2"/>Aguardando Aprovação de Contrato</CardTitle></CardHeader>
              <CardContent className="space-x-2">
                <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => onApprove && onApprove(lead.id)}><CheckCircle className="w-4 h-4 mr-2"/>Aprovar Contrato</Button>
                <Button size="sm" variant="outline" onClick={() => setShowCorrectionInput(true)}>Solicitar Correção</Button>
              </CardContent>
            </Card>
          )}
          
          {isAdmin && lead.stageId === 'conformidade' && lead.needsAdminApproval && (
            <Card className="mb-4 border-violet-500 bg-violet-500/10">
              <CardHeader><CardTitle className="text-violet-600 text-base flex items-center"><AlertTriangle className="w-5 h-5 mr-2"/>Aguardando Finalização</CardTitle></CardHeader>
              <CardContent className="space-x-2">
                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={handleApproveAndFinalize}><CheckCircle className="w-4 h-4 mr-2"/>Aprovar e Finalizar</Button>
                <Button size="sm" variant="outline" onClick={() => setShowCorrectionInput(true)}>Solicitar Correção</Button>
              </CardContent>
            </Card>
          )}

          {isAdmin && showCorrectionInput && (
            <div className="mb-4 p-4 border rounded-md bg-background">
              <Label htmlFor="correctionReason" className="font-semibold">Motivo da Solicitação de Correção:</Label>
              <Textarea id="correctionReason" value={correctionReason} onChange={(e) => setCorrectionReason(e.target.value)} placeholder="Descreva o que precisa ser corrigido..." className="mt-1 mb-2" />
              <Button size="sm" onClick={handleRequestCorrection} disabled={!correctionReason.trim()}><Send className="w-4 h-4 mr-2"/>Enviar Solicitação</Button>
              <Button size="sm" variant="ghost" onClick={() => setShowCorrectionInput(false)} className="ml-2">Cancelar</Button>
            </div>
          )}

          {/* Chat Section */}
          <div className="flex-1 flex flex-col min-h-0 border-t pt-4">
            <h3 className="text-lg font-semibold text-foreground mb-2 flex items-center flex-shrink-0"><MessageSquare className="w-5 h-5 mr-2 text-primary"/>Chat com o Lead</h3>
            <ScrollArea className="flex-1 mb-3 pr-3">
               {isLoadingChat ? (
                  <div className="flex items-center justify-center h-full">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                      <p className="ml-2 text-muted-foreground">Carregando chat...</p>
                  </div>
              ) : chatError ? (
                  <div className="flex items-center justify-center h-full text-destructive">
                      <p>{chatError}</p>
                  </div>
              ) : chatMessages.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-sm text-muted-foreground text-center">Nenhuma mensagem ainda.</p>
                  </div>
              ) : (
                  <div className="space-y-4">
                    {chatMessages.map(msg => (
                      <div key={msg.id} className={`flex items-end gap-2 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`p-3 rounded-lg max-w-[80%] text-sm ${msg.sender === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                          <p className="whitespace-pre-wrap">{msg.text}</p>
                          <p className={`text-xs mt-1.5 ${msg.sender === 'user' ? 'text-primary-foreground/70' : 'text-muted-foreground/70'}`}>
                            {format(parseISO(String(msg.timestamp)), "HH:mm", { locale: ptBR })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
              )}
              <div ref={chatEndRef} />
            </ScrollArea>
            <div className="flex gap-2 flex-shrink-0">
              <Popover open={isTemplatesPopoverOpen} onOpenChange={setIsTemplatesPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon" disabled={isSendingMessage}>
                    <Lightbulb className="h-5 w-5" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 mb-2">
                  <div className="grid gap-4">
                    <div className="space-y-2">
                      <h4 className="font-medium leading-none">Templates de Mensagem</h4>
                      <p className="text-sm text-muted-foreground">Selecione uma mensagem para usar.</p>
                    </div>
                    <div className="grid gap-2">
                      {CHAT_TEMPLATES.map((template) => (
                        <Button key={template.name} variant="outline" size="sm" onClick={() => handleTemplateSelect(template)}>
                          {template.name}
                        </Button>
                      ))}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
              <Input value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="Digite uma mensagem..." onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()} disabled={isSendingMessage} />
              <Button onClick={handleSendMessage} disabled={isSendingMessage}>
                {isSendingMessage ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 mr-0 md:mr-2"/>}
                <span className="hidden md:inline">{isSendingMessage ? "" : "Enviar"}</span>
              </Button>
            </div>
          </div>
        </CardContent>
        <CardFooter className="border-t pt-4 flex-wrap gap-2 justify-end">
            <Button variant="outline" onClick={handleAnalyzeLead} disabled={isAnalyzing}>
                {isAnalyzing ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : <BrainCircuit className="w-4 h-4 mr-2"/>}
                Analisar com IA
            </Button>
            {(isAdmin || isOwner) && (
              <Button variant="outline" onClick={() => onEdit(lead)}><Edit className="w-4 h-4 mr-2"/>Editar Lead</Button>
            )}
            <Link href={`/chat?leadId=${lead.id}`} passHref>
                <Button variant="outline">
                    <MessagesSquare className="w-4 h-4 mr-2" />
                    Abrir Chat em Modo Janela
                </Button>
            </Link>
            <Button onClick={onClose}>Fechar</Button>
        </CardFooter>
      </Card>
    </div>
  );
}
