
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
  DragOverEvent,
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

import { 
  Users, Filter, Plus, Loader2, Search, Calendar, 
  LayoutGrid, List as ListIcon, GripVertical 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { format, parseISO } from 'date-fns';

// --- TIPOS ---
type Lead = {
  id: string;
  name: string;
  stageId: string;
  valueAfterDiscount?: number;
  kwh?: number;
  sellerName?: string;
  createdAt: string;
};

const STAGES = [
  { id: 'contato', title: 'Contato Inicial', color: 'bg-blue-500' },
  { id: 'proposta', title: 'Proposta Enviada', color: 'bg-yellow-500' },
  { id: 'negociacao', title: 'Em Negociação', color: 'bg-orange-500' },
  { id: 'fechado', title: 'Fechado / Ganho', color: 'bg-emerald-500' },
  { id: 'perdido', title: 'Perdido', color: 'bg-red-500' }
];

// --- COMPONENTE: CARD DO LEAD (USADO NA LISTA E NO OVERLAY) ---
const LeadCard = React.forwardRef<HTMLDivElement, { lead: Lead; isOverlay?: boolean; onClick?: () => void }>(
  ({ lead, isOverlay, onClick }, ref) => {
    return (
      <div
        ref={ref}
        onClick={onClick}
        className={`
            relative p-4 rounded-xl border transition-all cursor-grab active:cursor-grabbing
            ${isOverlay 
                ? 'bg-slate-800 border-cyan-500 shadow-2xl scale-105 rotate-2 z-50' 
                : 'bg-slate-800/60 border-white/5 hover:border-cyan-500/50 hover:bg-slate-800 shadow-lg'
            }
        `}
      >
        {!isOverlay && (
             <div className="absolute top-3 right-3 p-1 text-slate-600 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity">
                <GripVertical className="w-4 h-4" />
             </div>
        )}

        <div className="flex justify-between items-start mb-2 pr-6">
           <h4 className="font-bold text-white text-sm truncate">{lead.name}</h4>
        </div>

        <div className="space-y-2">
            <div className="flex items-center text-xs text-slate-400 gap-2">
                <Calendar className="w-3 h-3" /> 
                {/* Proteção para data inválida */}
                {lead.createdAt && !isNaN(new Date(lead.createdAt).getTime()) 
                    ? format(new Date(lead.createdAt), 'dd/MM HH:mm') 
                    : 'Data N/A'}
            </div>
            
            <div className="flex justify-between items-center pt-2 border-t border-white/5 mt-2">
                <div className="flex flex-col">
                    <span className="text-[10px] text-slate-500 uppercase">Valor</span>
                    <span className="text-sm font-bold text-emerald-400">R$ {(lead.valueAfterDiscount || 0).toLocaleString('pt-BR')}</span>
                </div>
                <div className="flex flex-col items-end">
                    <span className="text-[10px] text-slate-500 uppercase">Consumo</span>
                    <span className="text-sm font-bold text-cyan-400">{(lead.kwh || 0).toLocaleString()} kWh</span>
                </div>
            </div>

            {lead.sellerName && (
                <div className="flex items-center gap-2 mt-2 pt-2">
                    <Avatar className="w-5 h-5"><AvatarImage src="" /><AvatarFallback className="text-[9px] bg-slate-700">{lead.sellerName.charAt(0)}</AvatarFallback></Avatar>
                    <span className="text-xs text-slate-400 truncate max-w-[120px]">{lead.sellerName}</span>
                </div>
            )}
        </div>
      </div>
    );
  }
);
LeadCard.displayName = "LeadCard";


// --- COMPONENTE: ITEM ARRASTÁVEL ---
function SortableItem({ lead, onClick }: { lead: Lead, onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ 
      id: lead.id,
      data: { type: 'Lead', lead } // Passamos o lead completo nos dados
  });
  
  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="mb-3 group">
        <LeadCard lead={lead} onClick={onClick} />
    </div>
  );
}

// --- COMPONENTE: COLUNA ---
function KanbanColumn({ id, title, color, leads, onEditLead }: { id: string, title: string, color: string, leads: Lead[], onEditLead: (l: Lead) => void }) {
  const totalValue = leads.reduce((acc, l) => acc + (l.valueAfterDiscount || 0), 0);
  
  return (
    <div className="flex flex-col h-full min-w-[300px] w-[300px] bg-slate-900/30 rounded-2xl border border-white/5 backdrop-blur-sm">
      <div className={`p-4 rounded-t-2xl border-b border-white/5 ${color} bg-opacity-10`}>
        <div className="flex justify-between items-center mb-1">
            <h3 className={`font-bold text-sm uppercase tracking-wider ${color.replace('bg-', 'text-')}`}>{title}</h3>
            <Badge variant="secondary" className="bg-slate-800 text-white border-0">{leads.length}</Badge>
        </div>
        <div className="text-xs text-slate-400 font-mono">
            Total: R$ {totalValue.toLocaleString('pt-BR', { notation: "compact" })}
        </div>
      </div>

      <div className="flex-1 p-3 overflow-y-auto custom-scrollbar">
        <SortableContext id={id} items={leads.map(l => l.id)} strategy={verticalListSortingStrategy}>
            {leads.map(lead => (
                <SortableItem key={lead.id} lead={lead} onClick={() => onEditLead(lead)} />
            ))}
            {/* Área vazia que garante que a coluna aceite drops mesmo sem itens */}
            {leads.length === 0 && (
                <div className="h-full min-h-[100px] border-2 border-dashed border-slate-800/50 rounded-xl flex items-center justify-center text-slate-600 text-xs">
                    Arraste para cá
                </div>
            )}
        </SortableContext>
      </div>
    </div>
  );
}


// --- PÁGINA PRINCIPAL CRM ---

export default function CRMPage() {
  const { toast } = useToast();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeLead, setActiveLead] = useState<Lead | null>(null); // Lead sendo arrastado
  const [filterText, setFilterText] = useState('');

  // Sensores (Mouse e Touch) - Ajustado activationConstraint para 5px para não confundir com clique
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), 
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    const q = query(collection(db, "crm_leads"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
        const data = snap.docs.map(d => ({ 
            id: d.id, 
            ...d.data(),
            // Garantir que datas venham como string ISO para evitar erros
            createdAt: d.data().createdAt instanceof Timestamp ? d.data().createdAt.toDate().toISOString() : d.data().createdAt || new Date().toISOString()
        } as Lead));
        setLeads(data);
        setIsLoading(false);
    });
    return () => unsub();
  }, []);

  const handleDragStart = (event: DragStartEvent) => {
      if (event.active.data.current?.type === 'Lead') {
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

    // Encontrar o lead que está sendo movido
    const activeLead = leads.find(l => l.id === activeId);
    if (!activeLead) return;

    // Descobrir para qual ESTÁGIO ele foi
    let newStageId = '';

    // Cenário 1: Soltou em cima de uma Coluna vazia ou na área da coluna
    if (STAGES.some(s => s.id === overId)) {
        newStageId = overId;
    } 
    // Cenário 2: Soltou em cima de outro Card (Lead)
    else {
        const overLead = leads.find(l => l.id === overId);
        if (overLead) {
            newStageId = overLead.stageId;
        }
    }

    if (newStageId && newStageId !== activeLead.stageId) {
        // 1. Atualização Otimista (UI muda na hora)
        setLeads(prev => prev.map(l => l.id === activeId ? { ...l, stageId: newStageId } : l));

        // 2. Atualização no Backend
        try {
            await updateCrmLeadStage(activeId, newStageId as any);
            const stageName = STAGES.find(s => s.id === newStageId)?.title;
            toast({ title: "Lead Movido", description: `Mudou para: ${stageName}`, className: "bg-slate-800 border-emerald-500 text-emerald-400" });
        } catch (error) {
            console.error(error);
            toast({ title: "Erro", description: "Falha ao mover lead.", variant: "destructive" });
            // Reverter em caso de erro (poderia refetch do firebase, mas o listener já faz isso)
        }
    }
  };
  
  // Efeito de drop suave
  const dropAnimation: DropAnimation = {
    sideEffects: defaultDropAnimationSideEffects({
      styles: {
        active: { opacity: '0.5' },
      },
    }),
  };

  const filteredLeads = useMemo(() => {
      if(!filterText) return leads;
      return leads.filter(l => l.name.toLowerCase().includes(filterText.toLowerCase()));
  }, [leads, filterText]);


  if (isLoading) return <div className="h-screen bg-slate-950 flex items-center justify-center"><Loader2 className="w-10 h-10 text-cyan-500 animate-spin"/></div>;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-300 font-sans flex flex-col overflow-hidden">
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 3px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
      `}</style>

      {/* Header */}
      <header className="h-20 shrink-0 border-b border-white/5 bg-slate-900/80 backdrop-blur px-8 flex items-center justify-between z-10">
         <div className="flex items-center gap-3">
             <div className="p-2 bg-gradient-to-tr from-cyan-600 to-blue-600 rounded-lg shadow-lg"><Users className="w-5 h-5 text-white" /></div>
             <h1 className="text-xl font-bold text-white">Pipeline de Vendas</h1>
         </div>
         <div className="flex items-center gap-4">
             <div className="relative">
                 <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                 <Input placeholder="Buscar lead..." className="pl-9 bg-slate-800 border-white/10 w-64 focus:ring-cyan-500 transition-all" value={filterText} onChange={e => setFilterText(e.target.value)} />
             </div>
             <Button className="bg-cyan-600 hover:bg-cyan-500 shadow-lg shadow-cyan-900/20"><Plus className="w-4 h-4 mr-2" /> Novo Lead</Button>
         </div>
      </header>

      {/* Board Kanban */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden p-6">
         <DndContext 
            sensors={sensors} 
            collisionDetection={closestCorners} 
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
         >
            <div className="flex h-full gap-6 min-w-max pb-4">
                {STAGES.map(stage => (
                    <KanbanColumn 
                        key={stage.id}
                        id={stage.id} 
                        title={stage.title}
                        color={stage.color}
                        leads={filteredLeads.filter(l => l.stageId === stage.id)}
                        onEditLead={(lead) => console.log("Editar", lead)}
                    />
                ))}
            </div>

            {/* Overlay: O card visual que segue o mouse */}
            <DragOverlay dropAnimation={dropAnimation}>
                {activeLead ? (
                    <LeadCard lead={activeLead} isOverlay />
                ) : null}
            </DragOverlay>
         </DndContext>
      </div>
    </div>
  );
}
