
"use client";

import type { LeadWithId, Stage, StageId } from '@/types/crm';
import { STAGES_CONFIG } from '@/config/crm-stages';
import { LeadCard } from './LeadCard';
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import type { AppUser, FirestoreUser, UserType } from '@/types/user';
import { Zap } from 'lucide-react';

interface KanbanBoardProps {
  leads: LeadWithId[];
  onViewLeadDetails: (lead: LeadWithId) => void;
  userAppRole: UserType | null;
  onMoveLead: (leadId: string, newStageId: StageId) => void;
  onDeleteLead: (leadId: string) => void;
  onEditLead: (lead: LeadWithId) => void;
  onAssignLead: (leadId: string) => void;
  allFirestoreUsers: FirestoreUser[];
  loggedInUser: AppUser;
  downlineLevelMap: Map<string, number>;
  activeAssignedLeadsCount: number;
}

export function KanbanBoard({ leads, onViewLeadDetails, userAppRole, onMoveLead, onDeleteLead, onEditLead, onAssignLead, allFirestoreUsers, loggedInUser, downlineLevelMap, activeAssignedLeadsCount }: KanbanBoardProps) {
  const assignmentLimit = 2;

  return (
    <ScrollArea className="w-full whitespace-nowrap rounded-md ">
      <div className="flex w-max space-x-4 p-4">
        {STAGES_CONFIG.map((stage: Stage) => {
          const stageLeads = leads.filter(l => l.stageId === stage.id);
          const totalKwhInStage = stageLeads.reduce((sum, lead) => sum + (lead.kwh || 0), 0);

          return (
            <div key={stage.id} className="flex-shrink-0 w-[300px]">
              <div className={`p-2 rounded-t-lg text-white font-semibold text-sm ${stage.colorClass} flex justify-between items-center`}>
                <span>{stage.title.toUpperCase()} ({stageLeads.length})</span>
                <div className="flex items-center gap-1 font-normal text-xs opacity-90">
                    <Zap className="w-3 h-3"/>
                    <span>{totalKwhInStage.toLocaleString('pt-BR')} kWh</span>
                </div>
              </div>
              <div className="bg-card/50 backdrop-blur-sm border border-t-0 rounded-b-lg p-2 h-[calc(100vh-220px)] overflow-y-auto">
                {stageLeads
                  .map(lead => (
                    <LeadCard 
                      key={lead.id} 
                      lead={lead} 
                      onViewDetails={onViewLeadDetails}
                      userAppRole={userAppRole}
                      onMoveLead={onMoveLead}
                      onDeleteLead={onDeleteLead}
                      onEditLead={onEditLead}
                      onAssignLead={onAssignLead}
                      allFirestoreUsers={allFirestoreUsers}
                      loggedInUser={loggedInUser}
                      downlineLevelMap={downlineLevelMap}
                      activeAssignedLeadsCount={activeAssignedLeadsCount}
                      assignmentLimit={assignmentLimit}
                    />
                  ))}
                {stageLeads.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">Nenhum lead neste estágio.</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}
