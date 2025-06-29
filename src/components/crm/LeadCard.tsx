"use client";

import { useState } from 'react';
import type { LeadWithId, StageId } from '@/types/crm';
import type { UserType } from '@/types/user';
import { STAGES_CONFIG } from '@/config/crm-stages';

import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
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
import { DollarSign, Zap, User, CalendarDays, ExternalLink, MoreHorizontal, Move, Trash2, Edit2, Handshake, CheckCircle, Award } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface LeadCardProps {
  lead: LeadWithId;
  onViewDetails: (lead: LeadWithId) => void;
  userAppRole: UserType | null;
  onMoveLead: (leadId: string, newStageId: StageId) => void;
  onDeleteLead: (leadId: string) => void;
  onEditLead: (lead: LeadWithId) => void;
  onAssignLead: (leadId: string) => void;
}

const formatCurrency = (value: number) => {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

export function LeadCard({ lead, onViewDetails, userAppRole, onMoveLead, onDeleteLead, onEditLead, onAssignLead }: LeadCardProps) {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  return (
    <Card className="mb-4 bg-card/70 backdrop-blur-lg border shadow-md hover:shadow-xl transition-shadow duration-300">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <CardTitle className="text-lg font-semibold text-primary truncate" title={lead.name}>
            {lead.name}
          </CardTitle>
        </div>
        {lead.company && <CardDescription className="text-xs text-muted-foreground truncate">{lead.company}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="flex items-center text-muted-foreground">
          <DollarSign className="w-4 h-4 mr-2 text-amber-500" />
          <span>Valor: {formatCurrency(lead.value)}</span>
        </div>
        <div className="flex items-center text-muted-foreground">
          <Zap className="w-4 h-4 mr-2 text-sky-500" />
          <span>Consumo: {lead.kwh} kWh</span>
        </div>
        <div className="flex items-center text-muted-foreground">
          <User className="w-4 h-4 mr-2 text-green-500" />
          <span className="truncate">Vendedor: {lead.sellerName}</span>
        </div>
        <div className="flex items-center text-muted-foreground">
          <CalendarDays className="w-4 h-4 mr-2 text-purple-500" />
          <span>Último Contato: {format(parseISO(lead.lastContact), "dd/MM/yy HH:mm", { locale: ptBR })}</span>
        </div>
        
        {lead.signedAt && (
            <div className="flex items-center text-muted-foreground text-xs pt-1">
                <CheckCircle className="w-3.5 h-3.5 mr-1.5 text-green-500" />
                <span>Assinado: {format(parseISO(lead.signedAt), "dd/MM/yy")}</span>
            </div>
        )}
        {lead.completedAt && (
            <div className="flex items-center text-muted-foreground text-xs">
                <Award className="w-3.5 h-3.5 mr-1.5 text-emerald-500" />
                <span>Finalizado: {format(parseISO(lead.completedAt), "dd/MM/yy")}</span>
            </div>
        )}

        {lead.leadSource && (
          <div className="pt-1">
            <Badge variant="secondary" className="text-xs">{lead.leadSource}</Badge>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex items-center justify-between">
        {lead.stageId === 'para-atribuir' && userAppRole === 'vendedor' ? (
          <Button className="w-full bg-green-600 hover:bg-green-700 text-white" onClick={() => onAssignLead(lead.id)}>
            <Handshake className="w-4 h-4 mr-2" />
            Atribuir a mim
          </Button>
        ) : (
          <>
            <Button variant="outline" size="sm" className="flex-1" onClick={() => onViewDetails(lead)}>
              <ExternalLink className="w-3 h-3 mr-2" />
              Ver Detalhes
            </Button>
            {(userAppRole === 'admin' || userAppRole === 'superadmin') && (
              <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="ml-2">
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Ações</DropdownMenuLabel>
                    <DropdownMenuSeparator />
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
                    <DropdownMenuItem onSelect={() => onEditLead(lead)}>
                      <Edit2 className="w-4 h-4 mr-2" />
                      Editar
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <AlertDialogTrigger asChild>
                      <DropdownMenuItem className="text-destructive focus:bg-destructive focus:text-destructive-foreground">
                        <Trash2 className="w-4 h-4 mr-2" />
                        Excluir
                      </DropdownMenuItem>
                    </AlertDialogTrigger>
                  </DropdownMenuContent>
                </DropdownMenu>

                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Tem certeza absoluta?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta ação não pode ser desfeita. Isso excluirá permanentemente o lead <strong className="text-foreground">{lead.name}</strong> e todo o seu histórico de chat.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive hover:bg-destructive/90"
                      onClick={() => onDeleteLead(lead.id)}
                    >
                      Sim, excluir lead
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </>
        )}
      </CardFooter>
    </Card>
  );
}
