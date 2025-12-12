"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { 
  DndContext, 
  DragOverlay, 
  closestCorners, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors, 
  DragStartEvent, 
  DragEndEvent,
  defaultDropAnimationSideEffects,
  DropAnimation
} from '@dnd-kit/core';
import { 
  SortableContext, 
  sortableKeyboardCoordinates, 
  verticalListSortingStrategy, 
  useSortable 
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
  GripVertical, DollarSign, Phone, MessageCircle, ExternalLink, Zap, User
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// --- CONFIGURAÇÃO DAS COLUNAS (STAGES) ---
const STAGES = [
  { id: 'para-validacao', title: 'Para Validação', color: 'bg-slate-700', border: 'border-slate-500' },
  { id: 'para-atribuir', title: 'Para Atribuir', color: 'bg-slate-600', border: 'border-slate-400' },
  { id: 'contato', title: 'Contato Inicial', color: 'bg-blue-600', border: 'border-blue-500' },
  { id: 'fatura', title: 'Fatura em Análise', color: 'bg-indigo-600', border: 'border-indigo-500' },
  { id: 'proposta', title: 'Proposta Apresentada', color: 'bg-yellow-600', border: 'border-yellow-500' },
  { id: 'negociacao', title: 'Em Negociação', color: 'bg-orange-600', border: 'border-orange-500' },
  { id: 'contrato', title: 'Contrato', color: 'bg-purple-600', border: 'border-purple-500' },
  { id: 'assinado', title: 'Assinado', color: 'bg-emerald-600', border: 'border-emerald-500' },
  { id: 'finalizado', title: 'Finalizado', color: 'bg-green-600', border: 'border-green-500' },
  { id: 'perdido', title: 'Perdido', color: 'bg-red-600', border: 'border-red-500' },
  { id: 'cancelado', title: 'Cancelado', color: 'bg-gray-600', border: 'border-gray-500' }
];

// --- TIPOS ---
type Lead = {
  id: string;
  name: string;
  stageId: string;
  value?: number; // Valor Original
  valueAfterDiscount?: number; // Valor com Desconto
  kwh?: number;
  sellerName?: string;
  phone?: string;
  createdAt: string;
  lastContact?: string;
  description?: string; // Observações
  [key: string]: any; // Allow other fields from LeadWithId
};

// --- HELPER: Formatar Moeda ---
const formatCurrency = (val?: number) => 
    val ? val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'R$ 0,00';

// --- COMPONENTE: CARD RICO (Sortable) ---
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

    const original = lead.value || 0;
    const final = lead.valueAfterDiscount || 0;
    const discount = original > 0 ? ((original - final) / original) * 100 : 0;

    return (
        <div 
            ref={setNodeRef} 
            style={style} 
            className={`
                group relative flex flex-col gap-3 p-4 rounded-xl border transition-all bg-slate-900/80 backdrop-blur-sm
                ${isOverlay ? 'border-cyan-500 shadow-2xl scale-105 rotate-2 cursor-grabbing z-50' : 'border-white/5 hover:border-cyan-500/50 hover:shadow-lg cursor-grab'}
            `}
            {...attributes} 
            {...listeners}
        >
            <div className="flex justify-between items-start">
                <h4 className="font-bold text-white text-sm line-clamp-2 leading-tight">{lead.name}</h4>
                {!isOverlay && <div className="p-1 rounded hover:bg-white/10 text-slate-500"><GripVertical className="w-4 h-4" /></div>}
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-1 text-slate-400">
                    <Zap className="w-3 h-3 text-yellow-500" />
                    <span>{lead.kwh?.toLocaleString()} kWh</span>
                </div>
                <div className="flex items-center gap-1 text-slate-400 justify-end">
                    <span className="text-[10px] text-slate-500 line-through">{formatCurrency(lead.value)}</span>
                </div>
            </div>

            <div className="bg-slate-950/50 p-2 rounded-lg border border-white/5">
                <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] text-emerald-500 font-bold uppercase">Valor Final</span>
                    {discount > 0 && <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-1.5 rounded">-{discount.toFixed(0)}%</span>}
                </div>
                <div className="text-sm font-bold text-white flex items-center gap-1">
                    <DollarSign className="w-3 h-3 text-emerald-500" />
                    {formatCurrency(lead.valueAfterDiscount)}
                </div>
            </div>

            <div className="flex flex-col gap-1 text-[10px] text-slate-500">
                <div className="flex items-center gap-1">
                    <User className="w-3 h-3" />
                    <span className="truncate">{lead.sellerName || 'Sistema'}</span>
                </div>
                <div className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    <span>{lead.lastContact ? format(new Date(lead.lastContact), "dd/MM/yy HH:mm", { locale: ptBR }) : 'Sem contato'}</span>
                </div>
            </div>

            {!isOverlay && (
                <div className="flex gap-2 mt-1 pt-2 border-t border-white/5">
                    {lead.phone && (
                        <a 
                           href={`https://wa.me/55${lead.phone.replace(/\D/g, '')}`} 
                           target="_blank"
                           rel="noopener noreferrer"
                           className="flex-1 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-500 text-[10px] font-bold py-1.5 rounded flex items-center justify-center gap-1 transition-colors"
                           onPointerDown={(e) => e.stopPropagation()}
                           onClick={(e) => e.stopPropagation()}
                        >
                            <MessageCircle className="w-3 h-3" /> WhatsApp
                        </a>
                    )}
                    <button 
                        className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold py-1.5 rounded flex items-center justify-center gap-1 transition-colors"
                        onPointerDown={(e) => e.stopPropagation()} 
                        onClick={(e) => {
                            e.stopPropagation();
                            onClickDetails?.();
                        }}
                    >
                        <ExternalLink className="w-3 h-3" /> Ver Detalhes
                    </button>
                </div>
            )}
        </div>
    );
}

// --- COMPONENTE: COLUNA ---
function KanbanColumn({ stage, leads, onEditLead }: { stage: typeof STAGES[0], leads: Lead[], onEditLead: (l: Lead) => void }) {
  const totalValue = leads.reduce((acc, l) => acc + (l.valueAfterDiscount || 0), 0);
  const totalKwh = leads.reduce((acc, l) => acc + (l.kwh || 0), 0);
  
  return (
    <div className="flex flex-col h-full min-w-[320px] w-[320px] bg-slate-900/40 rounded-xl border border-white/5">
      <div className={`p-3 rounded-t-xl border-b-4 ${stage.color.replace('bg-', 'border-')} bg-slate-900`}>
        <div className="flex justify-between items-center mb-1">
            <h3 className="font-bold text-sm text-white uppercase tracking-wider">{stage.title}</h3>
            <Badge className="bg-slate-800 text-white hover:bg-slate-700">{leads.length}</Badge>
        </div>
        <div className="flex justify-between items-center text-[10px] text-slate-400 font-mono mt-1">
             <span>{formatCurrency(totalValue)}</span>
             <span className="flex items-center gap-1"><Zap className="w-3 h-3" /> {totalKwh.toLocaleString()} kWh</span>
        </div>
      </div>

      <div className="flex-1 p-2 overflow-y-auto custom-scrollbar">
        <SortableContext id={stage.id} items={leads.map(l => l.id)} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-2 min-h-[150px]">
                {leads.map(lead => (
                    <LeadCard key={lead.id} lead={lead} onClickDetails={() => onEditLead(lead)} />
                ))}
            </div>
        </SortableContext>
      </div>
    </div>
  );
}

// --- PÁGINA PRINCIPAL ---

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
    } 
    else {
        const overLead = leads.find(l => l.id === overId);
        if (overLead) {
            newStageId = overLead.stageId;
        }
    }

    if (newStageId && newStageId !== currentLead.stageId) {
        setLeads(prev => prev.map(l => l.id === activeId ? { ...l, stageId: newStageId } : l));

        try {
            await updateCrmLeadStage(activeId, newStageId as any);
            const stageName = STAGES.find(s => s.id === newStageId)?.title;
            toast({ title: "Lead Atualizado", description: `Movido para: ${stageName}` });
        } catch (error) {
            console.error(error);
            toast({ title: "Erro", description: "Falha ao mover lead.", variant: "destructive" });
        }
    }
  };

  const metrics = useMemo(() => {
    const totalLeads = leads.length;
    const finalizadoKwh = leads.filter(l => l.stageId === 'finalizado').reduce((acc, l) => acc + (l.kwh || 0), 0);
    const paraAtribuirKwh = leads.filter(l => l.stageId === 'para-atribuir').reduce((acc, l) => acc + (l.kwh || 0), 0);
    return { totalLeads, finalizadoKwh, paraAtribuirKwh };
  }, [leads]);

  const filteredLeads = useMemo(() => {
      if(!filterText) return leads;
      return leads.filter(l => l.name.toLowerCase().includes(filterText.toLowerCase()));
  }, [leads, filterText]);


  if (isLoading) return <div className="h-screen bg-slate-950 flex items-center justify-center"><Loader2 className="w-10 h-10 text-cyan-500 animate-spin"/></div>;

  return (
    <div className="h-[calc(100vh-56px)] bg-slate-950 text-slate-300 font-sans flex flex-col overflow-hidden">
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 3px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
      `}</style>

      <header className="shrink-0 border-b border-white/5 bg-slate-900/80 backdrop-blur px-6 py-4 flex flex-col gap-4 z-10">
         <div className="flex justify-between items-center">
             <div className="flex items-center gap-3">
                 <div className="p-2 bg-cyan-600 rounded-lg shadow-lg"><Users className="w-6 h-6 text-white" /></div>
                 <div>
                    <h1 className="text-xl font-bold text-white flex items-center gap-2">
                        CRM - Gestão de Leads 
                        <Badge variant="secondary" className="bg-slate-800 text-slate-300">{metrics.totalLeads}</Badge>
                    </h1>
                 </div>
             </div>
             
             <div className="flex gap-3">
                 <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400 py-1 px-3">
                    <Zap className="w-3 h-3 mr-2" /> Finalizado: {metrics.finalizadoKwh.toLocaleString()} kWh
                 </Badge>
                 <Badge variant="outline" className="border-slate-500/30 bg-slate-500/10 text-slate-400 py-1 px-3">
                    <Zap className="w-3 h-3 mr-2" /> Para Atribuir: {metrics.paraAtribuirKwh.toLocaleString()} kWh
                 </Badge>
             </div>
         </div>

         <div className="flex justify-between items-center">
             <div className="relative">
                 <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                 <Input 
                    placeholder="Buscar lead, documento ou telefone..." 
                    className="pl-9 bg-slate-800 border-white/10 w-96 focus:ring-cyan-500 h-9 text-sm" 
                    value={filterText}
                    onChange={e => setFilterText(e.target.value)}
                 />
             </div>
             <Button onClick={() => setIsFormOpen(true)} size="sm" className="bg-cyan-600 hover:bg-cyan-500 shadow-lg">
                 <Plus className="w-4 h-4 mr-2" /> Novo Lead
             </Button>
         </div>
      </header>

      <div className="flex-1 overflow-x-auto overflow-y-hidden p-6 bg-[url('/bg-grid.svg')] bg-fixed bg-repeat opacity-90">
         <DndContext 
            sensors={sensors} 
            collisionDetection={closestCorners} 
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
         >
            <div className="flex h-full gap-4 min-w-max pb-4">
                {STAGES.map(stage => (
                    <KanbanColumn 
                        key={stage.id}
                        stage={stage}
                        leads={filteredLeads.filter(l => l.stageId === stage.id)}
                        onEditLead={setSelectedLead}
                    />
                ))}
            </div>

            <DragOverlay dropAnimation={{
                sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0.4' } } })
            }}>
                {activeLead ? (<LeadCard lead={activeLead} isOverlay />) : null}
            </DragOverlay>
         </DndContext>
      </div>

      {selectedLead && (
        <Dialog open={!!selectedLead} onOpenChange={() => setSelectedLead(null)}>
            <DialogContent className="max-w-4xl h-[90vh] p-0 border-none bg-transparent">
                <LeadDetailView 
                    lead={selectedLead as any} 
                    onClose={() => setSelectedLead(null)}
                    onEdit={() => { setSelectedLead(null); setIsFormOpen(true); }}
                    isAdmin={true}
                />
            </DialogContent>
        </Dialog>
      )}

      {isFormOpen && (
        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
            <DialogContent className="max-w-xl bg-slate-900 border-white/10">
                 <LeadForm 
                    onCancel={() => setIsFormOpen(false)}
                    onSubmit={async (data) => {
                        setIsFormOpen(false);
                    }}
                    allUsers={[]}
                 />
            </DialogContent>
        </Dialog>
      )}

    </div>
  );
}
