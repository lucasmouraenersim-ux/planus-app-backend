
"use client";

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getTeamForUser } from '@/actions/user/getTeam';
import { getLeadsForTeam } from '@/actions/user/getTeamLeads';
import type { FirestoreUser } from '@/types/user';
import type { LeadWithId } from '@/types/crm';
import { Loader2, Network, UsersRound, FileText, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { STAGES_CONFIG } from '@/config/crm-stages';

interface TeamMemberWithLevel extends FirestoreUser {
    level: number;
}

function TeamPageContent() {
  const { appUser, allFirestoreUsers, isLoadingAuth } = useAuth();
  const [teamMembers, setTeamMembers] = useState<TeamMemberWithLevel[]>([]);
  const [teamLeads, setTeamLeads] = useState<LeadWithId[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const userMap = useMemo(() => {
    const map = new Map<string, FirestoreUser>();
    allFirestoreUsers.forEach(user => {
      map.set(user.uid, user);
    });
    if (appUser) {
        map.set(appUser.uid, appUser as FirestoreUser);
    }
    return map;
  }, [allFirestoreUsers, appUser]);

  useEffect(() => {
    async function loadTeamData() {
      if (!appUser) return;
      setIsLoading(true);
      
      const [members, leads] = await Promise.all([
        getTeamForUser(appUser.uid),
        getLeadsForTeam(appUser.uid)
      ]);

      // Calculate level for each member
      const membersWithLevel = members.map(member => {
          let level = 0;
          let currentUplineId = member.uplineUid;
          while(currentUplineId && currentUplineId !== appUser.uid) {
              const upline = userMap.get(currentUplineId);
              currentUplineId = upline?.uplineUid;
              level++;
          }
          // The loop counts connections. Level is connections + 1.
          return { ...member, level: level + 1 };
      });

      setTeamMembers(membersWithLevel);
      setTeamLeads(leads.sort((a,b) => new Date(b.lastContact).getTime() - new Date(a.lastContact).getTime()));
      setIsLoading(false);
    }
    if (appUser) {
      loadTeamData();
    }
  }, [appUser, userMap]);


  const getStageBadgeStyle = (stageId: LeadWithId['stageId']) => {
    const stageConfig = STAGES_CONFIG.find(s => s.id === stageId);
    return stageConfig ? `${stageConfig.colorClass} text-white` : 'bg-gray-500 text-white';
  };

  const formatCurrency = (value: number | undefined) => value?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) || "R$ 0,00";

  if (isLoading || isLoadingAuth) {
    return (
      <div className="flex flex-col justify-center items-center h-screen bg-transparent text-primary">
        <Loader2 className="animate-spin rounded-full h-12 w-12 text-primary mb-4" />
        <p className="text-lg font-medium">Carregando dados da equipe...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 text-foreground">
      <header className="text-center mb-12">
        <Network className="w-16 h-16 text-primary mx-auto mb-4" />
        <h1 className="text-4xl md:text-5xl font-bold text-primary">
          Minha Equipe
        </h1>
        <p className="text-lg text-muted-foreground mt-2">
          Visualize sua downline e acompanhe a performance dos seus leads e da sua equipe.
        </p>
      </header>

      <Tabs defaultValue="members" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="members"><UsersRound className="mr-2 h-4 w-4"/>Membros da Equipe ({teamMembers.length})</TabsTrigger>
          <TabsTrigger value="leads"><FileText className="mr-2 h-4 w-4"/>Leads da Equipe ({teamLeads.length})</TabsTrigger>
        </TabsList>
        
        <TabsContent value="members">
          <Card>
            <CardHeader>
              <CardTitle>Membros da sua Downline</CardTitle>
              <CardDescription>Aqui estão todos os consultores que fazem parte da sua rede.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Consultor</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Nível</TableHead>
                    <TableHead>Líder Direto (Upline)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teamMembers.length > 0 ? teamMembers.map(member => (
                    <TableRow key={member.uid}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarImage src={member.photoURL || undefined} alt={member.displayName || 'U'} />
                            <AvatarFallback>{(member.displayName || 'U').charAt(0)}</AvatarFallback>
                          </Avatar>
                          {member.displayName}
                        </div>
                      </TableCell>
                      <TableCell>{member.email}</TableCell>
                      <TableCell><Badge variant="outline">{member.type}</Badge></TableCell>
                       <TableCell>
                        <Badge variant="secondary" className="flex items-center gap-1.5 w-fit">
                            <TrendingUp className="h-3.5 w-3.5"/>
                            Nível {member.level}
                        </Badge>
                      </TableCell>
                      <TableCell>{userMap.get(member.uplineUid || '')?.displayName || 'N/A'}</TableCell>
                    </TableRow>
                  )) : (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center">Você ainda não possui membros na sua equipe.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="leads">
           <Card>
            <CardHeader>
              <CardTitle>Leads da Equipe</CardTitle>
              <CardDescription>Todos os leads pertencentes a você e sua downline.</CardDescription>
            </CardHeader>
            <CardContent>
               <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lead</TableHead>
                    <TableHead>Vendedor</TableHead>
                    <TableHead>Estágio</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Último Contato</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teamLeads.length > 0 ? teamLeads.map(lead => (
                    <TableRow key={lead.id}>
                      <TableCell className="font-medium">{lead.name}</TableCell>
                      <TableCell>{lead.sellerName}</TableCell>
                       <TableCell>
                        <Badge className={getStageBadgeStyle(lead.stageId)}>{STAGES_CONFIG.find(s => s.id === lead.stageId)?.title || lead.stageId}</Badge>
                      </TableCell>
                      <TableCell>{formatCurrency(lead.valueAfterDiscount)}</TableCell>
                      <TableCell>{format(parseISO(lead.lastContact), "dd/MM/yy HH:mm", { locale: ptBR })}</TableCell>
                    </TableRow>
                  )) : (
                     <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center">Nenhum lead encontrado para sua equipe.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>
    </div>
  );
}

export default function TeamPage() {
    return (
        <Suspense fallback={
            <div className="flex flex-col justify-center items-center h-screen bg-transparent text-primary">
                <Loader2 className="animate-spin rounded-full h-12 w-12 text-primary mb-4" />
                <p className="text-lg font-medium">Carregando Equipe...</p>
            </div>
        }>
            <TeamPageContent />
        </Suspense>
    );
}
