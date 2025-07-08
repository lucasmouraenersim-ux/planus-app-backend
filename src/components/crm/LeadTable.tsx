"use client";

import type { LeadWithId, StageId } from '@/types/crm';
import type { UserType } from '@/types/user';
import { STAGES_CONFIG } from '@/config/crm-stages';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  DropdownMenuPortal,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { MoreHorizontal, Edit2, Trash2, Move, ExternalLink, ArrowUp, ArrowDown } from 'lucide-react';
import { useState } from 'react';

interface LeadTableProps {
  leads: LeadWithId[];
  onViewLeadDetails: (lead: LeadWithId) => void;
  userAppRole: UserType | null;
  onMoveLead: (leadId: string, newStageId: StageId) => void;
  onDeleteLead: (leadId: string) => void;
  onEditLead: (lead: LeadWithId) => void;
  sortConfig: { key: keyof LeadWithId; direction: 'ascending' | 'descending' } | null;
  onSort: (key: keyof LeadWithId) => void;
}

const formatCurrency = (value: number | undefined) => {
    if (value === undefined) return "R$ 0,00";
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

export function LeadTable({ leads, onViewLeadDetails, userAppRole, onMoveLead, onDeleteLead, onEditLead, sortConfig, onSort }: LeadTableProps) {
  const [leadToDelete, setLeadToDelete] = useState<LeadWithId | null>(null);

  const isAdmin = userAppRole === 'admin' || userAppRole === 'superadmin';

  const getStageBadgeStyle = (stageId: StageId) => {
    const stageConfig = STAGES_CONFIG.find(s => s.id === stageId);
    return stageConfig ? `${stageConfig.colorClass} text-white` : 'bg-gray-500 text-white';
  };
  
  const SortableHeader = ({ sortKey, label }: { sortKey: keyof LeadWithId; label: string }) => {
    const isSorted = sortConfig?.key === sortKey;
    const direction = isSorted ? sortConfig.direction : undefined;
    
    return (
      <TableHead>
        <Button variant="ghost" onClick={() => onSort(sortKey)} className="px-2 py-1 h-auto">
          {label}
          {isSorted && (direction === 'ascending' ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />)}
        </Button>
      </TableHead>
    );
  };


  return (
    <div className="border rounded-lg m-4 overflow-hidden bg-card/50 backdrop-blur-sm">
      <Table>
        <TableHeader>
          <TableRow>
            <SortableHeader sortKey="name" label="Cliente" />
            <SortableHeader sortKey="sellerName" label="Vendedor" />
            <SortableHeader sortKey="stageId" label="Estágio" />
            <SortableHeader sortKey="kwh" label="Consumo (kWh)" />
            <SortableHeader sortKey="valueAfterDiscount" label="Valor c/ Desc." />
            <SortableHeader sortKey="lastContact" label="Último Contato" />
            <TableHead className="w-[50px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {leads.map((lead) => (
            <TableRow key={lead.id}>
              <TableCell className="font-medium">{lead.name}</TableCell>
              <TableCell>{lead.sellerName}</TableCell>
              <TableCell>
                <Badge className={getStageBadgeStyle(lead.stageId)}>{STAGES_CONFIG.find(s => s.id === lead.stageId)?.title || lead.stageId}</Badge>
              </TableCell>
              <TableCell className="text-right">{lead.kwh?.toLocaleString('pt-BR') || 0}</TableCell>
              <TableCell className="text-right">{formatCurrency(lead.valueAfterDiscount)}</TableCell>
              <TableCell>{format(parseISO(lead.lastContact), "dd/MM/yy HH:mm", { locale: ptBR })}</TableCell>
              <TableCell>
                <AlertDialog onOpenChange={(open) => !open && setLeadToDelete(null)}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Ações</DropdownMenuLabel>
                      <DropdownMenuItem onSelect={() => onViewLeadDetails(lead)}>
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Ver Detalhes
                      </DropdownMenuItem>
                      {isAdmin && (
                        <>
                          <DropdownMenuItem onSelect={() => onEditLead(lead)}>
                            <Edit2 className="w-4 h-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuSub>
                            <DropdownMenuSubTrigger>
                              <Move className="w-4 h-4 mr-2" />
                              Mover para
                            </DropdownMenuSubTrigger>
                            <DropdownMenuPortal>
                              <DropdownMenuSubContent>
                                {STAGES_CONFIG.map((stage) => (
                                  <DropdownMenuItem
                                    key={stage.id}
                                    disabled={lead.stageId === stage.id}
                                    onSelect={() => onMoveLead(lead.id, stage.id)}
                                  >
                                    {stage.title}
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuSubContent>
                            </DropdownMenuPortal>
                          </DropdownMenuSub>
                          <DropdownMenuSeparator />
                          <AlertDialogTrigger asChild>
                            <DropdownMenuItem className="text-destructive focus:bg-destructive focus:text-destructive-foreground" onSelect={(e) => { e.preventDefault(); setLeadToDelete(lead); }}>
                              <Trash2 className="w-4 h-4 mr-2" />
                              Excluir
                            </DropdownMenuItem>
                          </AlertDialogTrigger>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Tem certeza absoluta?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Esta ação não pode ser desfeita. Isso excluirá permanentemente o lead <strong className="text-foreground">{leadToDelete?.name}</strong>.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-destructive hover:bg-destructive/90"
                        onClick={() => leadToDelete && onDeleteLead(leadToDelete.id)}
                      >
                        Sim, excluir lead
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
       {leads.length === 0 && (
        <div className="text-center p-10 text-muted-foreground">
          Nenhum lead encontrado com os filtros atuais.
        </div>
      )}
    </div>
  );
}
