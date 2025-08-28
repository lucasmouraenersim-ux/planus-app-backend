
"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import type { FirestoreUser } from '@/types/user';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, GraduationCap, CheckCircle } from 'lucide-react';
import { updateUser } from '@/lib/firebase/firestore';
import { useToast } from '@/hooks/use-toast';

const trainingModules = [
  {
    id: 'module1',
    title: 'Módulo 1: Boas-vindas e Introdução',
    videos: [
      { id: 'qWpL2K_qY4Y', title: 'Introdução à Planus Energia', duration: 120 },
      { id: 'dQw4w9WgXcQ', title: 'Nosso Modelo de Negócio', duration: 180 },
    ],
  },
  {
    id: 'module2',
    title: 'Módulo 2: Ferramentas e Processos',
    videos: [
      { id: '3tmd-ClpJxA', title: 'Usando o CRM', duration: 240 },
      { id: 'o-YBDTqX_ZU', title: 'Como Gerar uma Proposta', duration: 200 },
    ],
  },
];

const totalTrainingVideos = trainingModules.reduce((acc, module) => acc + module.videos.length, 0);

export default function TrainingProgressPage() {
  const { allFirestoreUsers, isLoadingAllUsers, refreshUsers } = useAuth();
  const { toast } = useToast();
  const [prospectors, setProspectors] = useState<FirestoreUser[]>([]);
  const [activatingUserId, setActivatingUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoadingAllUsers) {
      const prospectorUsers = allFirestoreUsers.filter(user => user.type === 'prospector');
      setProspectors(prospectorUsers);
    }
  }, [allFirestoreUsers, isLoadingAllUsers]);

  const calculateProgress = (user: FirestoreUser) => {
    const progress = user.trainingProgress;
    if (!progress) return { percentage: 0, completedVideos: 0, lastVideo: 'Nenhum vídeo iniciado' };

    let completedVideos = 0;
    let lastWatchedTitle = 'Nenhum vídeo iniciado';
    
    trainingModules.forEach(module => {
      module.videos.forEach(video => {
        if (progress[module.id]?.[video.id]?.completed) {
          completedVideos++;
          lastWatchedTitle = video.title;
        } else if (progress[module.id]?.[video.id]?.watchedSeconds > 0) {
          lastWatchedTitle = video.title;
        }
      });
    });

    const percentage = totalTrainingVideos > 0 ? (completedVideos / totalTrainingVideos) * 100 : 0;
    return { percentage, completedVideos, lastVideo: lastWatchedTitle };
  };

  const handleActivatePromoter = async (userId: string) => {
    setActivatingUserId(userId);
    try {
      await updateUser(userId, { type: 'vendedor' });
      toast({
        title: "Promotor Ativado!",
        description: "O usuário agora tem acesso completo como vendedor.",
      });
      await refreshUsers(); 
    } catch (error) {
      console.error("Failed to activate promoter:", error);
      toast({
        title: "Erro ao Ativar",
        description: "Não foi possível alterar o tipo do usuário.",
        variant: "destructive",
      });
    } finally {
      setActivatingUserId(null);
    }
  };

  if (isLoadingAllUsers) {
    return <div className="flex justify-center items-center h-screen"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="container mx-auto p-4 md:p-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl text-primary flex items-center">
            <GraduationCap className="mr-3 h-8 w-8" />
            Acompanhamento de Treinamento
          </CardTitle>
          <CardDescription>
            Monitore o progresso dos novos promotores e ative suas contas após a conclusão.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Promotor</TableHead>
                <TableHead>Progresso</TableHead>
                <TableHead>Último Vídeo Assistido</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {prospectors.length > 0 ? prospectors.map(user => {
                const { percentage, lastVideo, completedVideos } = calculateProgress(user);
                const isCompleted = percentage >= 100;
                const isActivating = activatingUserId === user.uid;

                return (
                  <TableRow key={user.uid}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarImage src={user.photoURL || undefined} alt={user.displayName || 'P'} />
                          <AvatarFallback>{(user.displayName || 'P').charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p>{user.displayName}</p>
                          <p className="text-xs text-muted-foreground">{user.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={percentage} className="w-40 h-2" />
                        <span className="text-sm font-semibold">{percentage.toFixed(0)}%</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{completedVideos} de {totalTrainingVideos} vídeos concluídos</p>
                    </TableCell>
                    <TableCell>{lastVideo}</TableCell>
                    <TableCell className="text-right">
                      {isCompleted ? (
                        <Button 
                          size="sm" 
                          className="bg-green-600 hover:bg-green-700" 
                          onClick={() => handleActivatePromoter(user.uid)}
                          disabled={isActivating}
                        >
                          {isActivating ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                          Ativar Promotor
                        </Button>
                      ) : (
                        <span className="text-sm text-muted-foreground italic">Em progresso...</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              }) : (
                <TableRow>
                  <TableCell colSpan={4} className="text-center h-24">
                    Nenhum promotor em treinamento no momento.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
