"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  DndContext, DragOverlay, closestCorners, KeyboardSensor, PointerSensor, useSensor, useSensors, DragStartEvent, DragEndEvent 
} from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { useAuth } from '@/contexts/AuthContext';
import { useToast } from "@/hooks/use-toast";
import { collection, query, onSnapshot, orderBy, Timestamp, updateDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { updateCrmLeadStage } from '@/lib/firebase/firestore'; // Importe sua função de update

import { 
  Users, Filter, Plus, Zap, Loader2, Search, MoreHorizontal, Calendar, 
  DollarSign, Phone, LayoutGrid, List as ListIcon, GripVertical 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// --- TIPOS (Simplificados para o exemplo, use os seus oficiais) ---
type Lead = {
  id: string;
  name: string;
  stageId: string; // 'contato', 'proposta', 'negociacao', 'fechado'
  valueAfterDiscount?: number;
  kwh?: number;
  sellerName?: string;
  phone?: string;
  createdAt: string;
};

const STAGES = [
  { id: 'contato', title: 'Contato Inicial', color: 'bg-blue-500' },
  { id: 'proposta', title: 'Proposta Enviada', color: 'bg-yellow-500' },
  { id: 'negociacao', title: 'Em Negociação', color: 'bg-orange-500' },
  { id: 'fechado', title: 'Fechado / Ganho', color: 'bg-emerald-500' },
  { id: 'perdido', title: 'Perdido', color: 'bg-red-500' }
];

// --- COMPONENTES DO DRAG & DROP ---

// 1. O Cartão Arrastável (Sortable Item)
function SortableLeadCard({ lead, onClick }: { lead: Lead, onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: lead.id, data: { ...lead } });
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
    zIndex: isDragging ? 999 : 'auto',
  };

  return (
    <div ref={setNodeRef} style={style} className="group relative mb-3">
      {/* Card Visual */}
      <div 
        onClick={onClick}
        className="bg-slate-800/60 hover:bg-slate-800 p-4 rounded-xl border border-white/5 hover:border-cyan-500/50 shadow-lg transition-all cursor-pointer backdrop-blur-sm group-hover:shadow-cyan-900/20"
      >
        {/* Drag Handle (Grip) */}
        <div {...attributes} {...listeners} className="absolute top-3 right-3 p-1 text-slate-600 hover:text-white cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity">
           <GripVertical className="w-4 h-4" />
        </div>

        <div className="flex justify-between items-start mb-2 pr-6">
           <h4 className="font-bold text-white text-sm truncate">{lead.name}</h4>
        </div>

        <div className="space-y-2">
            <div className="flex items-center text-xs text-slate-400 gap-2">
                <Calendar className="w-3 h-3" /> {format(parseISO(lead.createdAt), 'dd/MM HH:mm')}
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
    </div>
  );
}

// 2. A Coluna (Droppable)
function KanbanColumn({ id, title, color, leads, onEditLead }: { id: string, title: string, color: string, leads: Lead[], onEditLead: (l: Lead) => void }) {
  const totalValue = leads.reduce((acc, l) => acc + (l.valueAfterDiscount || 0), 0);
  
  return (
    <div className="flex flex-col h-full min-w-[300px] w-[300px] bg-slate-900/30 rounded-2xl border border-white/5 backdrop-blur-sm">
      {/* Header da Coluna */}
      <div className={`p-4 rounded-t-2xl border-b border-white/5 ${color} bg-opacity-10`}>
        <div className="flex justify-between items-center mb-1">
            <h3 className={`font-bold text-sm uppercase tracking-wider ${color.replace('bg-', 'text-')}`}>{title}</h3>
            <Badge variant="secondary" className="bg-slate-800 text-white border-0">{leads.length}</Badge>
        </div>
        <div className="text-xs text-slate-400 font-mono">
            Total: R$ {totalValue.toLocaleString('pt-BR', { notation: "compact" })}
        </div>
      </div>

      {/* Área de Drop */}
      <div className="flex-1 p-3 overflow-y-auto custom-scrollbar">
        <SortableContext id={id} items={leads.map(l => l.id)} strategy={verticalListSortingStrategy}>
            {leads.map(lead => (
                <SortableLeadCard key={lead.id} lead={lead} onClick={() => onEditLead(lead)} />
            ))}
            {leads.length === 0 && (
                <div className="h-24 border-2 border-dashed border-slate-800 rounded-xl flex items-center justify-center text-slate-600 text-xs">
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
  const { appUser } = useAuth();
  
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeDragId, setActiveDragId] = useState<string | null>(null); // ID do card sendo arrastado
  const [filterText, setFilterText] = useState('');

  // Sensores para Drag & Drop (Mouse e Touch)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), // Move 5px para iniciar drag
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Carregar Dados
  useEffect(() => {
    const q = query(collection(db, "crm_leads"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
        const data = snap.docs.map(d => {
            const docData = d.data();
            return { 
                id: d.id, 
                ...docData,
                // Garantir que timestamps sejam strings ISO
                createdAt: (docData.createdAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
            } as Lead
        });
        setLeads(data);
        setIsLoading(false);
    });
    return () => unsub();
  }, []);

  // Lógica de Movimentação (Drag End)
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragId(null);

    if (!over) return;

    const leadId = active.id as string;
    const newStageId = over.id as string; // O ID da coluna é o StageID

    // Encontra o lead atual
    const lead = leads.find(l => l.id === leadId);
    if (!lead || lead.stageId === newStageId) return; // Se não mudou de coluna, ignora

    // 1. Atualização Otimista (UI Imediata)
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, stageId: newStageId } : l));

    // 2. Atualiza no Firebase
    try {
        await updateCrmLeadStage(leadId, newStageId as any); // Sua função de update existente
        toast({ title: "Lead Movido", description: `Mudou para ${STAGES.find(s => s.id === newStageId)?.title}` });
    } catch (error) {
        toast({ title: "Erro", description: "Falha ao mover lead.", variant: "destructive" });
        // Reverte se der erro (opcional)
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
      setActiveDragId(event.active.id as string);
  }

  // Filtragem
  const filteredLeads = useMemo(() => {
      if(!filterText) return leads;
      return leads.filter(l => l.name.toLowerCase().includes(filterText.toLowerCase()));
  }, [leads, filterText]);


  if (isLoading) return <div className="h-screen bg-slate-950 flex items-center justify-center"><Loader2 className="w-10 h-10 text-cyan-500 animate-spin"/></div>;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-300 font-sans flex flex-col overflow-hidden">
      
      {/* Styles Globais */}
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 3px; }
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
                 <Input 
                    placeholder="Buscar lead..." 
                    className="pl-9 bg-slate-800 border-white/10 w-64 focus:ring-cyan-500 transition-all" 
                    value={filterText}
                    onChange={e => setFilterText(e.target.value)}
                 />
             </div>
             <Button className="bg-cyan-600 hover:bg-cyan-500 shadow-lg shadow-cyan-900/20">
                 <Plus className="w-4 h-4 mr-2" /> Novo Lead
             </Button>
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
                        id={stage.id} // O ID da coluna deve ser o StageID para o drop funcionar
                        title={stage.title}
                        color={stage.color}
                        leads={filteredLeads.filter(l => l.stageId === stage.id)}
                        onEditLead={(lead) => console.log("Editar", lead)} // Conecte sua função handleOpenForm aqui
                    />
                ))}
            </div>

            {/* Overlay (O card "fantasma" que segue o mouse) */}
            <DragOverlay>
                {activeDragId ? (
                    <div className="opacity-90 rotate-3 cursor-grabbing scale-105">
                         {/* Reutilizando estrutura visual para o overlay */}
                         <div className="bg-slate-800 p-4 rounded-xl border border-cyan-500 shadow-2xl">
                             <h4 className="font-bold text-white">Movendo Lead...</h4>
                         </div>
                    </div>
                ) : null}
            </DragOverlay>
         </DndContext>
      </div>

    </div>
  );
}
