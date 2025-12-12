
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { 
  DndContext, DragOverlay, closestCorners, KeyboardSensor, PointerSensor, 
  useSensor, useSensors, DragStartEvent, DragEndEvent, 
  defaultDropAnimationSideEffects, DropAnimation 
} from '@dnd-kit/core';
import { 
  SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable 
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { useAuth } from '@/contexts/AuthContext';
import { useToast } from "@/hooks/use-toast";
import { collection, query, onSnapshot, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { updateCrmLeadStage } from '@/lib/firebase/firestore'; 
import { LeadDetailView } from '@/components/crm/LeadDetailView'; 
import { LeadForm } from '@/components/crm/LeadForm'; 

import { 
  Users, Filter, Plus, Loader2, Search, Calendar, 
  GripVertical, DollarSign, MessageCircle, ExternalLink, Zap, User, 
  Flame, Clock, Send, CalendarPlus
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { 
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { format, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// --- CONFIGURAÇÃO DAS COLUNAS (Visual Refinado) ---
const STAGES = [
  { id: 'para-validacao', title: 'Para Validação', color: 'bg-slate-500', accent: 'border-slate-500' },
  { id: 'para-atribuir', title: 'Para Atribuir', color: 'bg-indigo-500', accent: 'border-indigo-500' },
  { id: 'contato', title: 'Contato Inicial', color: 'bg-blue-500', accent: 'border-blue-500' },
  { id: 'fatura', title: 'Fatura em Análise', color: 'bg-sky-500', accent: 'border-sky-500' },
  { id: 'proposta', title: 'Proposta Apresentada', color: 'bg-amber-500', accent: 'border-amber-500' },
  { id: 'negociacao', title: 'Em Negociação', color: 'bg-orange-500', accent: 'border-orange-500' },
  { id: 'contrato', title: 'Contrato', color: 'bg-purple-500', accent: 'border-purple-500' },
  { id: 'assinado', title: 'Assinado', color: 'bg-emerald-500', accent: 'border-emerald-500' },
  { id: 'finalizado', title: 'Finalizado', color: 'bg-green-600', accent: 'border-green-600' },
  { id: 'perdido', title: 'Perdido', color: 'bg-red-500', accent: 'border-red-500' },
  { id: 'cancelado', title: 'Cancelado', color: 'bg-zinc-600', accent: 'border-zinc-500' }
];

// --- TIPOS ---
type Lead = {
  id: string;
  name: string;
  stageId: string;
  value?: number; 
  valueAfterDiscount?: number;
  kwh?: number;
  sellerName?: string;
  phone?: string;
  createdAt: string;
  lastContact?: string;
  photoURL?: string;
};

// --- HELPER: Formatar Moeda ---
const formatCurrency = (val?: number) => 
    val ? val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'R$ 0,00';

// --- HELPER: Templates de WhatsApp ---
const getWhatsappLink = (phone: string, template: 'ola' | 'cobranca' | 'proposta', leadName: string) => {
    const cleanPhone = phone.replace(/\D/g, '');
    let text = '';
    const name = leadName.split(' ')[0]; // Primeiro nome

    switch(template) {
        case 'ola': text = `Olá ${name}, tudo bem? Aqui é da Sent Energia. Gostaria de falar sobre sua economia de energia.`; break;
        case 'proposta': text = `Olá ${name}, já conseguimos analisar sua fatura! Tenho uma proposta de economia pronta pra você.`; break;
        case 'cobranca': text = `Oi ${name}, passando para saber se você conseguiu avaliar a proposta que enviei?`; break;
    }
    return `https://wa.me/55${cleanPhone}?text=${encodeURIComponent(text)}`;
};

// --- COMPONENTE: CARD RICO E INTELIGENTE ---
function LeadCard({ lead, isOverlay, onClickDetails }: { lead: Lead; isOverlay?: boolean; onClickDetails?: () => void }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: lead.id,
        data: { type: 'Lead', lead },
        disabled: isOverlay
    });

    const style = {
        transform: CSS.Translate.toString(transform),
        transition,
        opacity: isDragging ? 0.3 : 1,
    };

    // --- LÓGICA DE INTELIGÊNCIA ---
    const original = lead.value || 0;
    const final = lead.valueAfterDiscount || 0;
    const discount = original > 0 ? ((original - final) / original) * 100 : 0;

    // 1. Lead Scoring (Consumo kWh)
    const kwh = lead.kwh || 0;
    const isHot = kwh > 5000;  // > 5.000 kWh
    const isWarm = kwh > 1000 && kwh <= 5000; // 1.000 a 5.000 kWh
    
    // 2. Alerta de Estagnação (Dias sem contato)
    const daysSinceContact = lead.lastContact 
        ? differenceInDays(new Date(), new Date(lead.lastContact)) 
        : differenceInDays(new Date(), new Date(lead.createdAt));
    
    const isStagnant = daysSinceContact > 7; // Alerta Amarelo
    const isCritical = daysSinceContact > 15; // Alerta Vermelho

    // Estilos dinâmicos baseados no Score
    let borderClass = 'border-white/5';
    let bgClass = 'bg-slate-900';
    let shadowClass = '';

    if (isHot) {
        borderClass = 'border-orange-500/50';
        bgClass = 'bg-gradient-to-br from-slate-900 to-orange-950/20';
        shadowClass = 'shadow-[0_0_15px_-3px_rgba(249,115,22,0.15)]';
    } else if (isWarm) {
        borderClass = 'border-cyan-500/40';
        shadowClass = 'shadow-[0_0_10px_-3px_rgba(6,182,212,0.1)]';
    }

    return (
        <div 
            ref={setNodeRef} 
            style={style} 
            className={`
                group relative flex flex-col gap-3 p-4 rounded-xl border transition-all duration-200
                ${bgClass} ${borderClass} ${shadowClass}
                ${isOverlay 
                    ? 'shadow-2xl scale-105 rotate-2 cursor-grabbing z-50 ring-2 ring-cyan-500/50' 
                    : 'hover:border-white/10 hover:bg-slate-800 hover:shadow-lg hover:-translate-y-1 cursor-grab active:cursor-grabbing'
                }
            `}
            {...attributes} 
            {...listeners}
        >
            {/* Header: Nome e Badges */}
            <div className="flex justify-between items-start gap-2">
                <h4 className="font-bold text-slate-100 text-sm line-clamp-2 leading-snug tracking-tight">
                    {lead.name}
                </h4>
                {!isOverlay && (
                    <div className="flex items-center gap-1 text-slate-600">
                        {/* Ícone de Scoring */}
                        {isHot && <Flame className="w-4 h-4 text-orange-500 animate-pulse" fill="currentColor" />}
                        {isWarm && <Zap className="w-4 h-4 text-cyan-400" fill="currentColor" />}
                        
                        {/* Ícone de Drag */}
                        <div className="group-hover:text-slate-400 transition-colors ml-1">
                            <GripVertical className="w-4 h-4" />
                        </div>
                    </div>
                )}
            </div>

            {/* Corpo: Dados Principais */}
            <div className="grid grid-cols-2 gap-3 py-2 border-y border-white/5">
                <div className="flex flex-col">
                    <span className="text-[10px] uppercase text-slate-500 font-medium mb-0.5">Valor Final</span>
                    <div className={`flex items-center gap-1 font-bold text-sm ${isHot ? 'text-orange-400' : 'text-emerald-400'}`}>
                        <span className="text-xs">R$</span>
                        {lead.valueAfterDiscount?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || '0,00'}
                    </div>
                    {discount > 0 && <span className="text-[9px] text-emerald-600 mt-0.5">-{discount.toFixed(0)}% OFF</span>}
                </div>
                <div className="flex flex-col items-end">
                    <span className="text-[10px] uppercase text-slate-500 font-medium mb-0.5">Consumo</span>
                    <div className={`flex items-center gap-1 font-bold text-sm ${isHot ? 'text-white' : 'text-sky-400'}`}>
                        {isHot ? <Zap className="w-3 h-3 text-orange-500" /> : <Zap className="w-3 h-3" />}
                        {lead.kwh?.toLocaleString()} <span className="text-[10px] font-normal text-slate-400">kWh</span>
                    </div>
                </div>
            </div>

            {/* Alertas de Estagnação (Se houver) */}
            {(isStagnant || isCritical) && (
                <div className={`
                    flex items-center gap-2 text-[10px] px-2 py-1 rounded-md font-medium
                    ${isCritical ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'}
                `}>
                    <Clock className="w-3 h-3" />
                    <span>Sem contato há {daysSinceContact} dias</span>
                </div>
            )}

            {/* Footer: Vendedor e Data */}
            <div className="flex items-center justify-between mt-1">
                <div className="flex items-center gap-2">
                    <Avatar className="w-5 h-5 border border-white/10">
                        <AvatarImage src={lead.photoURL} />
                        <AvatarFallback className="text-[9px] bg-slate-800 text-slate-300">{lead.sellerName?.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <span className="text-[10px] text-slate-400 max-w-[80px] truncate">{lead.sellerName || 'Sistema'}</span>
                </div>
                <div className="flex items-center gap-1 text-[10px] text-slate-500">
                    <Calendar className="w-3 h-3" />
                    {lead.createdAt && !isNaN(new Date(lead.createdAt).getTime()) ? format(new Date(lead.createdAt), 'dd/MM') : '--/--'}
                </div>
            </div>

            {/* Ações Avançadas (Hover) */}
            {!isOverlay && (
                <div className="grid grid-cols-4 gap-1 pt-2 mt-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                     {/* 1. Botão WhatsApp Inteligente */}
                     {lead.phone ? (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <button className="col-span-2 h-7 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border border-emerald-500/20 text-[10px] font-bold rounded-md flex items-center justify-center gap-1 transition-colors" onPointerDown={(e) => e.stopPropagation()}>
                                    <MessageCircle className="w-3 h-3" /> WhatsApp
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="bg-slate-900 border-slate-700 text-slate-300">
                                <DropdownMenuLabel className="text-xs">Escolha o Modelo</DropdownMenuLabel>
                                <DropdownMenuSeparator className="bg-slate-700" />
                                <DropdownMenuItem className="hover:bg-slate-800 cursor-pointer text-xs" onClick={() => window.open(getWhatsappLink(lead.phone!, 'ola', lead.name), '_blank')}>👋 Apresentação</DropdownMenuItem>
                                <DropdownMenuItem className="hover:bg-slate-800 cursor-pointer text-xs" onClick={() => window.open(getWhatsappLink(lead.phone!, 'proposta', lead.name), '_blank')}>💰 Enviar Proposta</DropdownMenuItem>
                                <DropdownMenuItem className="hover:bg-slate-800 cursor-pointer text-xs" onClick={() => window.open(getWhatsappLink(lead.phone!, 'cobranca', lead.name), '_blank')}>⏳ Follow-up (Cobrança)</DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                     ) : (
                         <div className="col-span-2 h-7 flex items-center justify-center text-[10px] text-slate-600 bg-slate-900/50 rounded border border-white/5">Sem Whats</div>
                     )}

                    {/* 2. Botão Detalhes */}
                    <button 
                        className="col-span-1 h-7 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-white/10 text-[10px] font-bold rounded-md flex items-center justify-center transition-colors"
                        onPointerDown={(e) => e.stopPropagation()} 
                        onClick={(e) => { e.stopPropagation(); onClickDetails?.(); }}
                        title="Ver Detalhes Completos"
                    >
                        <ExternalLink className="w-3 h-3" />
                    </button>

                     {/* 3. Botão Tarefa (Mock) */}
                     <button 
                        className="col-span-1 h-7 bg-slate-800 hover:bg-amber-500/10 hover:text-amber-500 text-slate-400 border border-white/10 text-[10px] font-bold rounded-md flex items-center justify-center transition-colors"
                        onPointerDown={(e) => e.stopPropagation()}
                        title="Agendar Tarefa"
                    >
                        <CalendarPlus className="w-3 h-3" />
                    </button>
                </div>
            )}
        </div>
    );
}

// --- COMPONENTE: COLUNA ---
function KanbanColumn({ stage, leads, onEditLead }: { stage: typeof STAGES[0], leads: Lead[], onEditLead: (l: Lead) => void }) {
  const totalValue = leads.reduce((acc, l) => acc + (l.valueAfterDiscount || 0), 0);
  
  return (
    <div className="flex flex-col h-full min-w-[300px] w-[300px] max-w-[300px] rounded-xl bg-slate-950/30 border border-white/5 backdrop-blur-sm">
      <div className="p-3 pb-2">
        <div className="flex justify-between items-center mb-2">
            <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${stage.color}`}></div>
                <h3 className="font-bold text-sm text-slate-200 uppercase tracking-tight">{stage.title}</h3>
            </div>
            <Badge className="bg-slate-800 text-slate-300 border border-white/5 hover:bg-slate-700">{leads.length}</Badge>
        </div>
        <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden mb-1">
            <div className={`h-full ${stage.color}`} style={{ width: '40%' }}></div>
        </div>
        <div className="text-[10px] text-slate-500 font-mono text-right">
            Total: {formatCurrency(totalValue)}
        </div>
      </div>

      <div className="flex-1 p-2 overflow-y-auto overflow-x-hidden custom-scrollbar bg-gradient-to-b from-slate-950/50 to-transparent rounded-b-xl">
        <SortableContext id={stage.id} items={leads.map(l => l.id)} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-2 min-h-[100px]">
                {leads.map(lead => (
                    <LeadCard key={lead.id} lead={lead} onClickDetails={() => onEditLead(lead)} />
                ))}
            </div>
        </SortableContext>
      </div>
    </div>
  );
}

// --- PÁGINA PRINCIPAL CRM ---

export default function CRMPage() {
  const { toast } = useToast();
  const { appUser } = useAuth();
  
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeLead, setActiveLead] = useState<Lead | null>(null);
  const [filterText, setFilterText] = useState('');
  
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    const q = query(collection(db, "crm_leads"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
        const data = snap.docs.map(d => {
            const data = d.data();
            return { 
                id: d.id, 
                ...data,
                createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : data.createdAt || new Date().toISOString(),
                lastContact: data.lastContact instanceof Timestamp ? data.lastContact.toDate().toISOString() : data.lastContact
            } as Lead
        });
        setLeads(data);
        setIsLoading(false);
    });
    return () => unsub();
  }, []);

  const handleDragStart = (event: DragStartEvent) => {
      if (event.active.data.current?.lead) {
          setActiveLead(event.active.data.current.lead);
      }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveLead(null);
    if (!over) return;
    const activeId = active.id as string;
    const overId = over.id as string;
    if (activeId === overId) return;

    const currentLead = leads.find(l => l.id === activeId);
    if (!currentLead) return;

    let newStageId = '';
    if (STAGES.some(s => s.id === overId)) {
        newStageId = overId;
    } else {
        const overLead = leads.find(l => l.id === overId);
        if (overLead) newStageId = overLead.stageId;
    }

    if (newStageId && newStageId !== currentLead.stageId) {
        setLeads(prev => prev.map(l => l.id === activeId ? { ...l, stageId: newStageId } : l));
        try {
            await updateCrmLeadStage(activeId, newStageId as any);
            const stageName = STAGES.find(s => s.id === newStageId)?.title;
            toast({ title: "Status Atualizado", description: `Movido para ${stageName}`, className: "bg-slate-800 border-emerald-500/50 text-emerald-400" });
        } catch (error) {
            console.error(error);
            toast({ title: "Erro", description: "Falha ao mover lead.", variant: "destructive" });
        }
    }
  };
  
  const dropAnimation: DropAnimation = {
    sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0.4' } } }),
  };

  const filteredLeads = useMemo(() => {
      if(!filterText) return leads;
      return leads.filter(l => l.name.toLowerCase().includes(filterText.toLowerCase()));
  }, [leads, filterText]);

  const metrics = useMemo(() => {
    const total = leads.length;
    const valuePipeline = leads.reduce((acc, l) => acc + (l.valueAfterDiscount || 0), 0);
    const kwhPipeline = leads.reduce((acc, l) => acc + (l.kwh || 0), 0);
    return { total, valuePipeline, kwhPipeline };
  }, [leads]);

  if (isLoading) return <div className="h-screen bg-slate-950 flex items-center justify-center"><Loader2 className="w-10 h-10 text-cyan-500 animate-spin"/></div>;

  return (
    <div className="h-[calc(100vh-56px)] bg-slate-950 text-slate-300 font-sans flex flex-col overflow-hidden relative">
      <div className="absolute inset-0 z-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>
      <style jsx global>{` .custom-scrollbar::-webkit-scrollbar { width: 4px; height: 6px; } .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 4px; } .custom-scrollbar::-webkit-scrollbar-track { background: transparent; } `}</style>

      <header className="shrink-0 border-b border-white/5 bg-slate-950/80 backdrop-blur-md px-6 py-3 flex items-center justify-between z-10 gap-4">
         <div className="flex items-center gap-4">
             <div className="bg-gradient-to-br from-cyan-600 to-blue-700 p-2 rounded-lg shadow-lg shadow-cyan-900/20"><Users className="w-5 h-5 text-white" /></div>
             <div><h1 className="text-lg font-bold text-white leading-tight">Pipeline de Vendas</h1><p className="text-xs text-slate-500">Gerencie suas oportunidades em tempo real</p></div>
             <div className="h-8 w-px bg-white/10 mx-2"></div>
             <div className="flex gap-4">
                <div><p className="text-[10px] text-slate-500 uppercase font-bold">Valor em Pipeline</p><p className="text-sm font-bold text-emerald-400">{formatCurrency(metrics.valuePipeline)}</p></div>
                <div><p className="text-[10px] text-slate-500 uppercase font-bold">Volume Total</p><p className="text-sm font-bold text-sky-400">{metrics.kwhPipeline.toLocaleString()} kWh</p></div>
                <div><p className="text-[10px] text-slate-500 uppercase font-bold">Leads Ativos</p><p className="text-sm font-bold text-white">{metrics.total}</p></div>
             </div>
         </div>
         <div className="flex items-center gap-3">
             <div className="relative"><Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" /><Input placeholder="Filtrar leads..." className="pl-9 bg-slate-900 border-white/10 w-64 focus:ring-cyan-500 h-9 text-sm transition-all focus:w-80" value={filterText} onChange={e => setFilterText(e.target.value)} /></div>
             <Button onClick={() => setIsFormOpen(true)} size="sm" className="bg-cyan-600 hover:bg-cyan-500 h-9 shadow-lg shadow-cyan-900/20"><Plus className="w-4 h-4 mr-2" /> Novo Lead</Button>
         </div>
      </header>

      <div className="flex-1 overflow-x-auto overflow-y-hidden p-6 z-0">
         <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div className="flex h-full gap-4 min-w-max pb-2">
                {STAGES.map(stage => (
                    <KanbanColumn key={stage.id} stage={stage} leads={filteredLeads.filter(l => l.stageId === stage.id)} onEditLead={setSelectedLead} />
                ))}
            </div>
            <DragOverlay dropAnimation={dropAnimation}>{activeLead ? (<LeadCard lead={activeLead} isOverlay />) : null}</DragOverlay>
         </DndContext>
      </div>

      {selectedLead && (
        <Dialog open={!!selectedLead} onOpenChange={() => setSelectedLead(null)}>
            <DialogContent className="max-w-4xl h-[90vh] p-0 border-none bg-transparent shadow-2xl">
                <LeadDetailView 
                    lead={selectedLead} 
                    onClose={() => setSelectedLead(null)}
                    onEdit={() => { setSelectedLead(null); setIsFormOpen(true); }} 
                    isAdmin={true} 
                    onApprove={async () => {}}
                    onRequestCorrection={async () => {}}
                />
            </DialogContent>
        </Dialog>
      )}

      {isFormOpen && (
        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
            <DialogContent className="max-w-xl bg-slate-950 border-white/10 p-0 overflow-hidden">
                 <LeadForm 
                    onCancel={() => setIsFormOpen(false)}
                    onSubmit={async (data) => { setIsFormOpen(false); }}
                    allUsers={[]} 
                    initialData={undefined}
                    isSubmitting={false}
                 />
            </DialogContent>
        </Dialog>
      )}
    </div>
  );
}