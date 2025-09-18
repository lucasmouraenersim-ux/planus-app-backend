
"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import type { FirestoreUser, TrainingModule, TrainingVideo } from '@/types/user';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Loader2, GraduationCap, CheckCircle, Upload, PlusCircle, Trash2, Edit } from 'lucide-react';
import { updateUser } from '@/lib/firebase/firestore';
import { uploadFile } from '@/lib/firebase/storage';
import { useToast } from '@/hooks/use-toast';
import { collection, onSnapshot, doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';


const TRAINING_CONFIG_DOC_ID = 'main-config';

export default function TrainingManagementPage() {
  const { allFirestoreUsers, isLoadingAllUsers, refreshUsers, userAppRole } = useAuth();
  const { toast } = useToast();
  
  const [trainingModules, setTrainingModules] = useState<TrainingModule[]>([]);
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);

  const [prospectors, setProspectors] = useState<FirestoreUser[]>([]);
  const [activatingUserId, setActivatingUserId] = useState<string | null>(null);

  const [isEditingModule, setIsEditingModule] = useState<TrainingModule | null>(null);
  const [isEditingVideo, setIsEditingVideo] = useState<{ module: TrainingModule; video: TrainingVideo } | null>(null);
  const [newModuleName, setNewModuleName] = useState('');
  const [newVideoTitle, setNewVideoTitle] = useState('');
  const [newVideoFile, setNewVideoFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Fetch training config
  useEffect(() => {
    const configDocRef = doc(db, 'training-config', TRAINING_CONFIG_DOC_ID);
    const unsubscribe = onSnapshot(configDocRef, (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            setTrainingModules(data.modules || []);
        } else {
            setTrainingModules([]);
        }
        setIsLoadingConfig(false);
    });
    return () => unsubscribe();
  }, []);

  // Filter prospectors
  useEffect(() => {
    if (!isLoadingAllUsers) {
      const prospectorUsers = allFirestoreUsers.filter(user => user.type === 'prospector');
      setProspectors(prospectorUsers);
    }
  }, [allFirestoreUsers, isLoadingAllUsers]);

  const totalTrainingVideos = useMemo(() => trainingModules.reduce((acc, module) => acc + module.videos.length, 0), [trainingModules]);

  const saveTrainingConfig = useCallback(async (modules: TrainingModule[]) => {
    try {
      const configDocRef = doc(db, 'training-config', TRAINING_CONFIG_DOC_ID);
      await setDoc(configDocRef, { modules });
      toast({ title: 'Sucesso', description: 'Configuração de treinamento salva.' });
    } catch (error) {
      console.error("Error saving training config:", error);
      toast({ title: 'Erro', description: 'Não foi possível salvar a configuração.', variant: 'destructive' });
    }
  }, [toast]);

  const handleAddModule = () => {
    if (!newModuleName.trim()) return;
    const newModule: TrainingModule = {
      id: `module-${Date.now()}`,
      title: newModuleName.trim(),
      videos: [],
    };
    saveTrainingConfig([...trainingModules, newModule]);
    setNewModuleName('');
  };

  const handleAddVideo = async () => {
    if (!newVideoTitle.trim() || !newVideoFile || !isEditingModule) return;
    
    setIsUploading(true);
    try {
      const videoPath = `training_videos/${newVideoFile.name.replace(/\s+/g, '_')}`;
      const videoUrl = await uploadFile(newVideoFile, videoPath);
      
      const newVideo: TrainingVideo = {
        id: `video-${Date.now()}`,
        title: newVideoTitle,
        videoUrl: videoUrl,
        duration: 0, // Duration would need to be extracted from the video file
      };

      const updatedModules = trainingModules.map(m => {
        if (m.id === isEditingModule.id) {
          return { ...m, videos: [...m.videos, newVideo] };
        }
        return m;
      });
      await saveTrainingConfig(updatedModules);
      setNewVideoTitle('');
      setNewVideoFile(null);
    } catch (error) {
      console.error("Error uploading video:", error);
      toast({ title: 'Erro de Upload', description: 'Não foi possível enviar o vídeo.', variant: 'destructive' });
    } finally {
      setIsUploading(false);
    }
  };
  
  const handleDeleteVideo = (moduleId: string, videoId: string) => {
    const updatedModules = trainingModules.map(m => {
      if (m.id === moduleId) {
        return { ...m, videos: m.videos.filter(v => v.id !== videoId) };
      }
      return m;
    });
    saveTrainingConfig(updatedModules);
  }
  
  const handleDeleteModule = (moduleId: string) => {
    const updatedModules = trainingModules.filter(m => m.id !== moduleId);
    saveTrainingConfig(updatedModules);
  }

  const calculateProgress = (user: FirestoreUser) => {
    const progress = user.trainingProgress;
    if (!progress || totalTrainingVideos === 0) return { percentage: 0, completedVideos: 0, lastVideo: 'Nenhum vídeo iniciado' };

    let completedVideos = 0;
    let lastWatchedTitle = 'Nenhum vídeo iniciado';
    
    trainingModules.forEach(module => {
      module.videos.forEach(video => {
        if (progress[module.id]?.[video.id]?.completed) {
          completedVideos++;
          lastWatchedTitle = video.title;
        }
      });
    });

    const percentage = (completedVideos / totalTrainingVideos) * 100;
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

  if (isLoadingAllUsers || isLoadingConfig) {
    return <div className="flex justify-center items-center h-screen"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  
  if (userAppRole !== 'superadmin' && userAppRole !== 'admin') {
      return <div>Acesso negado.</div>
  }

  return (
    <div className="container mx-auto p-4 md:p-8">
      <Tabs defaultValue="progress">
        <TabsList className="mb-4">
          <TabsTrigger value="progress">Acompanhamento de Treinamento</TabsTrigger>
          <TabsTrigger value="management">Gerenciar Módulos e Vídeos</TabsTrigger>
        </TabsList>
        <TabsContent value="progress">
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
        </TabsContent>
        <TabsContent value="management">
            <Card>
                <CardHeader>
                    <CardTitle>Gerenciador de Treinamento</CardTitle>
                    <CardDescription>Adicione, edite ou remova módulos e vídeos do treinamento.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="mb-6 space-y-2">
                        <Label htmlFor="new-module-name">Novo Módulo</Label>
                        <div className="flex gap-2">
                            <Input id="new-module-name" value={newModuleName} onChange={(e) => setNewModuleName(e.target.value)} placeholder="Título do novo módulo" />
                            <Button onClick={handleAddModule}><PlusCircle className="mr-2 h-4 w-4"/>Adicionar Módulo</Button>
                        </div>
                    </div>
                    <Accordion type="multiple" className="w-full">
                        {trainingModules.map(module => (
                            <AccordionItem key={module.id} value={module.id}>
                                <AccordionTrigger className="font-semibold">{module.title}</AccordionTrigger>
                                <AccordionContent>
                                    <div className="space-y-4">
                                        {module.videos.map(video => (
                                            <div key={video.id} className="flex items-center justify-between p-2 border rounded-md">
                                                <span>{video.title}</span>
                                                <Button variant="ghost" size="icon" onClick={() => handleDeleteVideo(module.id, video.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                            </div>
                                        ))}
                                         <Dialog>
                                            <DialogTrigger asChild>
                                                <Button variant="outline" className="w-full mt-2" onClick={() => setIsEditingModule(module)}><PlusCircle className="mr-2 h-4 w-4" /> Adicionar Vídeo a este Módulo</Button>
                                            </DialogTrigger>
                                        </Dialog>
                                        <Button variant="destructive" size="sm" className="w-full mt-2" onClick={() => handleDeleteModule(module.id)}><Trash2 className="mr-2 h-4 w-4" /> Excluir Módulo</Button>
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        ))}
                    </Accordion>
                </CardContent>
            </Card>
        </TabsContent>
      </Tabs>
      
      <Dialog onOpenChange={(open) => {if (!open) { setIsEditingModule(null); setNewVideoFile(null); setNewVideoTitle(''); }}} open={!!isEditingModule}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Adicionar Vídeo ao Módulo: {isEditingModule?.title}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
                <div>
                    <Label htmlFor="video-title">Título do Vídeo</Label>
                    <Input id="video-title" value={newVideoTitle} onChange={(e) => setNewVideoTitle(e.target.value)} placeholder="Título do vídeo" />
                </div>
                 <div>
                    <Label htmlFor="video-file">Arquivo de Vídeo</Label>
                    <Input id="video-file" type="file" accept="video/*" onChange={(e) => setNewVideoFile(e.target.files?.[0] || null)} />
                </div>
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => setIsEditingModule(null)} disabled={isUploading}>Cancelar</Button>
                <Button onClick={handleAddVideo} disabled={isUploading || !newVideoFile || !newVideoTitle}>
                    {isUploading ? <Loader2 className="h-4 w-4 animate-spin mr-2"/> : <Upload className="h-4 w-4 mr-2" />}
                    {isUploading ? 'Enviando...' : 'Fazer Upload e Salvar'}
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
