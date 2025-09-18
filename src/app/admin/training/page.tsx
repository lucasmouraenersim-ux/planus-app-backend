
"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import jsPDF from 'jspdf';
import { useAuth } from '@/contexts/AuthContext';
import type { FirestoreUser, TrainingModule, TrainingVideo, TrainingQuizQuestion, QuizAttempt } from '@/types/user';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Loader2, GraduationCap, CheckCircle, Upload, PlusCircle, Trash2, Edit, HelpCircle, Check, X, FileQuestion, MoreHorizontal, RotateCcw, FileSignature } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { updateUser } from '@/lib/firebase/firestore';
import { uploadFile } from '@/lib/firebase/storage';
import { useToast } from '@/hooks/use-toast';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';


const TRAINING_CONFIG_DOC_ID = 'main-config';

export default function TrainingManagementPage() {
  const { allFirestoreUsers, isLoadingAllUsers, refreshUsers, userAppRole } = useAuth();
  const { toast } = useToast();
  
  const [trainingModules, setTrainingModules] = useState<TrainingModule[]>([]);
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);

  const [usersInTraining, setUsersInTraining] = useState<FirestoreUser[]>([]);
  const [activatingUserId, setActivatingUserId] = useState<string | null>(null);
  const [resettingUserId, setResettingUserId] = useState<string | null>(null);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);


  // State for video management
  const [isEditingModule, setIsEditingModule] = useState<TrainingModule | null>(null);
  const [newModuleName, setNewModuleName] = useState('');
  const [newVideoTitle, setNewVideoTitle] = useState('');
  const [newVideoFile, setNewVideoFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  
  // State for quiz management
  const [editingQuizModule, setEditingQuizModule] = useState<TrainingModule | null>(null);
  const [editingQuestion, setEditingQuestion] = useState<Partial<TrainingQuizQuestion> | null>(null);
  const [currentQuestionText, setCurrentQuestionText] = useState('');
  const [currentOptions, setCurrentOptions] = useState<string[]>(['', '', '', '']);
  const [currentCorrectAnswerIndex, setCurrentCorrectAnswerIndex] = useState<number>(0);


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

  useEffect(() => {
    if (!isLoadingAllUsers) {
      // Show users who are either 'prospector' OR 'vendedor' but still have training progress.
      // This keeps them on the list after being promoted.
      const trainingUsers = allFirestoreUsers.filter(user => 
        user.type === 'prospector' || 
        (user.type === 'vendedor' && user.trainingProgress && Object.keys(user.trainingProgress).length > 0)
      );
      setUsersInTraining(trainingUsers);
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
      quiz: [],
    };
    saveTrainingConfig([...trainingModules, newModule]);
    setNewModuleName('');
  };

  const handleDeleteModule = (moduleId: string) => {
    const updatedModules = trainingModules.filter(m => m.id !== moduleId);
    saveTrainingConfig(updatedModules);
  };
  
  // --- Video Handlers ---
  const handleAddVideo = async () => {
    if (!newVideoTitle.trim() || !newVideoFile || !isEditingModule) return;
    setIsUploading(true);
    try {
      const videoPath = `training_videos/${newVideoFile.name.replace(/\s+/g, '_')}`;
      const videoUrl = await uploadFile(newVideoFile, videoPath);
      const newVideo: TrainingVideo = { id: `video-${Date.now()}`, title: newVideoTitle, videoUrl, duration: 0 };
      const updatedModules = trainingModules.map(m => m.id === isEditingModule.id ? { ...m, videos: [...m.videos, newVideo] } : m);
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
    const updatedModules = trainingModules.map(m => m.id === moduleId ? { ...m, videos: m.videos.filter(v => v.id !== videoId) } : m);
    saveTrainingConfig(updatedModules);
  };
  
  // --- Quiz Handlers ---
  const openQuestionModal = (module: TrainingModule, question: Partial<TrainingQuizQuestion> | null = null) => {
    setEditingQuizModule(module);
    if (question) {
      setEditingQuestion(question);
      setCurrentQuestionText(question.question || '');
      setCurrentOptions(question.options || ['', '', '', '']);
      setCurrentCorrectAnswerIndex(question.correctAnswerIndex ?? 0);
    } else {
      setEditingQuestion({});
      setCurrentQuestionText('');
      setCurrentOptions(['', '', '', '']);
      setCurrentCorrectAnswerIndex(0);
    }
  };

  const handleSaveQuestion = () => {
    if (!editingQuizModule || !currentQuestionText.trim()) return;
    const isNew = !editingQuestion?.id;
    const questionToSave: TrainingQuizQuestion = {
      id: editingQuestion?.id || `question-${Date.now()}`,
      question: currentQuestionText,
      options: currentOptions,
      correctAnswerIndex: currentCorrectAnswerIndex,
    };

    const updatedModules = trainingModules.map(m => {
      if (m.id === editingQuizModule.id) {
        const quiz = m.quiz || [];
        const newQuiz = isNew ? [...quiz, questionToSave] : quiz.map(q => q.id === questionToSave.id ? questionToSave : q);
        return { ...m, quiz: newQuiz };
      }
      return m;
    });

    saveTrainingConfig(updatedModules);
    setEditingQuizModule(null);
  };
  
  const handleDeleteQuestion = (moduleId: string, questionId: string) => {
    const updatedModules = trainingModules.map(m => {
      if (m.id === moduleId) {
        return { ...m, quiz: (m.quiz || []).filter(q => q.id !== questionId) };
      }
      return m;
    });
    saveTrainingConfig(updatedModules);
  };


  const calculateProgress = (user: FirestoreUser) => {
    const progress = user.trainingProgress || {};
    if (totalTrainingVideos === 0) return { videoPercentage: 0, completedVideos: 0, lastVideo: 'Nenhum vídeo' };
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
    return {
      videoPercentage: (completedVideos / totalTrainingVideos) * 100,
      completedVideos,
      lastVideo: lastWatchedTitle
    };
  };
  
  const getLatestQuizAttempt = (user: FirestoreUser): QuizAttempt | undefined => {
      if (!user.trainingProgress) return undefined;
      const allAttempts: QuizAttempt[] = Object.values(user.trainingProgress)
          .flatMap(moduleProgress => moduleProgress.quizAttempts || [])
          .filter(attempt => attempt); // Ensure no null/undefined attempts

      if (allAttempts.length === 0) return undefined;
      // Sort by timestamp descending to get the latest one
      return allAttempts.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
  };

  const handleActivatePromoter = async (userId: string) => {
    setActivatingUserId(userId);
    try {
      await updateUser(userId, { type: 'vendedor' });
      toast({ title: "Promotor Ativado!", description: "O usuário agora tem acesso completo como vendedor." });
      await refreshUsers(); 
    } catch (error) {
      console.error("Failed to activate promoter:", error);
      toast({ title: "Erro ao Ativar", description: "Não foi possível alterar o tipo do usuário.", variant: "destructive" });
    } finally {
      setActivatingUserId(null);
    }
  };
  
  const handleResetTrainingClick = (user: FirestoreUser) => {
    setResettingUserId(user.uid);
    setIsResetConfirmOpen(true);
  };

  const handleConfirmResetTraining = async () => {
    if (!resettingUserId) return;
    try {
      await updateUser(resettingUserId, { trainingProgress: {} });
      toast({ title: "Treinamento Resetado!", description: "O progresso do usuário foi apagado." });
      await refreshUsers();
    } catch (error) {
      console.error("Failed to reset training:", error);
      toast({ title: "Erro ao Resetar", description: "Não foi possível apagar o progresso do treinamento.", variant: "destructive" });
    } finally {
      setResettingUserId(null);
      setIsResetConfirmOpen(false);
    }
  };

  const handleElaborateContract = (user: FirestoreUser) => {
    const promoterName = user.displayName || '_________________________';
    const promoterDocument = user.cpf || '[CPF/CNPJ]';

    const contractText = `
CONTRATO DE PARCERIA PARA INDICAÇÃO DE CLIENTES

De um lado:
SENT ENERGIA LTDA, pessoa jurídica de direito privado, com sede na Rua Comandante Costa, 1649, Centro-Sul, na cidade de Cuiabá, Estado do Mato Grosso, CEP 78.020-400, inscrita no CNPJ/ME sob o nº 61.287.384/0001-60, neste ato representada na forma dos seus documentos societários, doravante designada “CONTRATANTE”;

E, de outro lado:
${promoterName}, pessoa física, inscrita no CPF sob o nº ${promoterDocument}, com residência no(a) [Endereço Completo], doravante designado(a) “PROMOTOR”;

CONTRATANTE e PROMOTOR também serão designados como "Partes" ou, individualmente, como "Parte”.

CONSIDERANDO QUE:
(i) a CONTRATANTE é empresa especializada em serviços de assessoria, consultoria e gestão na área de energia, incluindo o desenvolvimento e exploração de projetos de geração distribuída com a troca da energia gerada pelas unidades de geração por créditos junto às distribuidoras de energia elétrica;
(ii) o PROMOTOR possui relacionamentos de mercado e o potencial conhecimento de uma base de clientes ("Clientes") os quais podem ter interesse em se cadastrar na CONTRATANTE para ter acesso ao Sistema de Compensação de Energia Elétrica ("SCEE"), nos termos da Lei 14.300/2022 e Resoluções Normativas ANEEL n° 1.000/2021 e n° 1.059/2023; e
(iii) as Partes têm interesse em celebrar uma parceria de forma que o PROMOTOR ofereça aos seus Clientes a adesão ao SCEE através do cadastro na CONTRATANTE.

RESOLVEM as PARTES celebrar o presente Contrato de Parceria para Indicação de Clientes (“CONTRATO"), que será regido pelas condições dispostas a seguir.

I. OBJETO
1.1. Constitui objeto do presente CONTRATO a divulgação pelo PROMOTOR para a sua base de Clientes sobre os benefícios em aderir à CONTRATANTE e ao SCEE, de forma que o PROMOTOR será remunerado pela quantidade de Clientes que efetivamente se cadastrarem na CONTRATANTE para acesso ao SCEE, através da troca de titularidade da unidade consumidora de energia elétrica dos Clientes ("Parceria").
1.2. Para tanto, a CONTRATANTE poderá fornecer ao PROMOTOR um hiperlink de direcionamento dos Clientes para a sua plataforma com, por exemplo, conteúdos, banners, Call to Actions, widgets e/ou outras ações. Fica igualmente acordado que nenhum material será divulgado aos Clientes sem a prévia e expressa aprovação por escrito da CONTRATANTE.

II. OBRIGAÇÕES DAS PARTES
2.1. São obrigações do PROMOTOR:
2.1.1. Contatar os Clientes para divulgação das condições para cadastro na CONTRATANTE e adesão ao SCEE;
2.1.2. Observar as diretrizes e instruções da CONTRATANTE quanto ao conteúdo do material a ser divulgado aos Clientes;
2.1.3. Arcar, por sua conta e risco exclusivos, com todas e quaisquer despesas e custos necessários à execução do objeto desta Parceria.
2.2. São obrigações da CONTRATANTE:
2.2.1. A CONTRATANTE obriga-se a efetuar o pagamento do preço estabelecido na Cláusula IV abaixo;
2.2.2. Receber os Clientes dentro da sua infraestrutura para concluir os procedimentos de cadastro e adesão;
2.2.3. Colaborar com o PROMOTOR para o bom andamento da Parceria.

III. PRAZO DO CONTRATO E RESCISÃO
3.1. O CONTRATO vigerá por prazo indeterminado, iniciando-se na data de assinatura do presente instrumento.

IV. PREÇO E CONDIÇÕES DE PAGAMENTO
4.1. Pela parceria, a CONTRATANTE pagará ao PROMOTOR uma comissão de 40% (quarenta por cento) sobre o valor da primeira proposta aceita pelo cliente.
4.1.1. Entende-se como "proposta" o valor da conta de energia do cliente já com o desconto oferecido pela CONTRATANTE.
4.1.2. A comissão será devida para cada Cliente único que efetuar o cadastro junto à CONTRATANTE e tiver a troca de titularidade da sua unidade consumidora efetivada.
4.2. Os pagamentos devidos nos termos deste CONTRATO serão realizados por meio de depósito em conta bancária de titularidade do PROMOTOR, ou outra forma acordada entre as Partes.
4.3. O pagamento será efetuado na primeira sexta-feira subsequente à semana de finalização da adesão do Cliente, entendida como a efetiva troca de titularidade.
4.4. O preço estabelecido nesta Cláusula constituirá a única e completa remuneração do PROMOTOR pela execução deste CONTRATO, já incluindo a totalidade das despesas, ônus, tributos e custos de qualquer espécie.

V. FORO
5.1. As Partes elegem o foro da Comarca de Cuiabá/MT para dirimir quaisquer dúvidas ou ações oriundas do presente CONTRATO, renunciando a qualquer outro por mais privilegiado que seja.

E, por estarem justas e contratadas, resolvem as Partes firmar o presente CONTRATO.

Cuiabá, ${new Date().toLocaleDateString('pt-BR')}.


___________________________________
SENT ENERGIA LTDA
CNPJ: 61.287.384/0001-60


___________________________________
${promoterName}
CPF/CNPJ: ${promoterDocument}
`;

    const doc = new jsPDF();
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    
    // Define margins e largura máxima
    const margin = 15;
    const maxWidth = doc.internal.pageSize.getWidth() - margin * 2;
    const lineHeight = doc.getLineHeight() / doc.internal.scaleFactor;
    let y = 20;

    // Divide o texto em linhas que cabem na página
    const lines = doc.splitTextToSize(contractText, maxWidth);

    lines.forEach((line: string) => {
        // Verifica se a próxima linha ultrapassará o limite da página
        if (y + lineHeight > doc.internal.pageSize.getHeight() - margin) {
            doc.addPage(); // Adiciona uma nova página
            y = margin; // Reseta a posição Y para o topo da nova página
        }
        doc.text(line, margin, y);
        y += lineHeight;
    });

    doc.save(`Contrato_Parceria_${promoterName.replace(/\s+/g, '_')}.pdf`);

    toast({
      title: "Contrato Gerado",
      description: `O PDF do contrato para ${promoterName} foi baixado.`,
    });
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
        <TabsList className="mb-4 grid w-full grid-cols-3">
          <TabsTrigger value="progress">Acompanhamento</TabsTrigger>
          <TabsTrigger value="management">Gerenciar Módulos e Vídeos</TabsTrigger>
          <TabsTrigger value="quiz">Gerenciar Questionários</TabsTrigger>
        </TabsList>
        
        <TabsContent value="progress">
           <Card>
            <CardHeader>
              <CardTitle className="text-3xl text-primary flex items-center"><GraduationCap className="mr-3 h-8 w-8" /> Acompanhamento de Treinamento</CardTitle>
              <CardDescription>Monitore o progresso e o resultado dos quizzes dos novos promotores.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Promotor</TableHead><TableHead>Progresso Vídeos</TableHead><TableHead>Resultado Quiz</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
                <TableBody>
                  {usersInTraining.length > 0 ? usersInTraining.map(user => {
                    const { videoPercentage, completedVideos } = calculateProgress(user);
                    const latestAttempt = getLatestQuizAttempt(user);
                    // A user can be activated if they passed the quiz OR if they are already a 'vendedor'
                    const quizPassed = latestAttempt && latestAttempt.score >= 80;
                    const canBeActivated = quizPassed && user.type === 'prospector';
                    const isActivating = activatingUserId === user.uid;

                    return (
                      <TableRow key={user.uid}>
                        <TableCell className="font-medium"><div className="flex items-center gap-3"><Avatar className="h-9 w-9"><AvatarImage src={user.photoURL || undefined} alt={user.displayName || 'P'} /><AvatarFallback>{(user.displayName || 'P').charAt(0)}</AvatarFallback></Avatar><div><p>{user.displayName}</p><p className="text-xs text-muted-foreground">{user.email}</p></div></div></TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2"><Progress value={videoPercentage} className="w-40 h-2" /><span className="text-sm font-semibold">{videoPercentage.toFixed(0)}%</span></div>
                          <p className="text-xs text-muted-foreground">{completedVideos} de {totalTrainingVideos} vídeos concluídos</p>
                        </TableCell>
                        <TableCell>
                          {latestAttempt ? (
                            <div className={`flex items-center gap-1.5 font-semibold ${quizPassed ? 'text-green-600' : 'text-red-600'}`}>
                              {quizPassed ? <CheckCircle className="h-4 w-4" /> : <X className="h-4 w-4" />}
                              {latestAttempt.score.toFixed(1)}%
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">Pendente</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                           <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Ações</DropdownMenuLabel>
                              {canBeActivated && (
                                <DropdownMenuItem onClick={() => handleActivatePromoter(user.uid)} disabled={isActivating}>
                                  {isActivating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4 text-green-600" />}
                                  Ativar Promotor
                                </DropdownMenuItem>
                              )}
                              {quizPassed && (
                                <DropdownMenuItem onClick={() => handleElaborateContract(user)}>
                                  <FileSignature className="mr-2 h-4 w-4 text-blue-500" />
                                  Elaborar Contrato
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleResetTrainingClick(user)} className="text-destructive focus:bg-destructive focus:text-destructive-foreground">
                                <RotateCcw className="mr-2 h-4 w-4" />
                                Resetar Treinamento
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  }) : (
                    <TableRow><TableCell colSpan={4} className="text-center h-24">Nenhum usuário em treinamento no momento.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="management">
            <Card>
                <CardHeader><CardTitle>Gerenciador de Módulos e Vídeos</CardTitle><CardDescription>Adicione, edite ou remova módulos e vídeos do treinamento.</CardDescription></CardHeader>
                <CardContent>
                    <div className="mb-6 space-y-2"><Label htmlFor="new-module-name">Novo Módulo</Label><div className="flex gap-2"><Input id="new-module-name" value={newModuleName} onChange={(e) => setNewModuleName(e.target.value)} placeholder="Título do novo módulo" /><Button onClick={handleAddModule}><PlusCircle className="mr-2 h-4 w-4"/>Adicionar Módulo</Button></div></div>
                    <Accordion type="multiple" className="w-full">
                        {trainingModules.map(module => (
                            <AccordionItem key={module.id} value={module.id}>
                                <AccordionTrigger className="font-semibold">{module.title}</AccordionTrigger>
                                <AccordionContent>
                                    <div className="space-y-4">
                                        {module.videos.map(video => (<div key={video.id} className="flex items-center justify-between p-2 border rounded-md"><span>{video.title}</span><Button variant="ghost" size="icon" onClick={() => handleDeleteVideo(module.id, video.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></div>))}
                                         <Dialog onOpenChange={(open) => {if (!open) setIsEditingModule(null)}}><DialogTrigger asChild><Button variant="outline" className="w-full mt-2" onClick={() => setIsEditingModule(module)}><PlusCircle className="mr-2 h-4 w-4" /> Adicionar Vídeo</Button></DialogTrigger></Dialog>
                                        <Button variant="destructive" size="sm" className="w-full mt-2" onClick={() => handleDeleteModule(module.id)}><Trash2 className="mr-2 h-4 w-4" /> Excluir Módulo</Button>
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        ))}
                    </Accordion>
                </CardContent>
            </Card>
        </TabsContent>

        <TabsContent value="quiz">
           <Card>
             <CardHeader><CardTitle>Gerenciador de Questionários</CardTitle><CardDescription>Crie e edite as perguntas para cada módulo do treinamento.</CardDescription></CardHeader>
             <CardContent>
               <Accordion type="multiple" className="w-full">
                 {trainingModules.map(module => (
                   <AccordionItem key={`quiz-${module.id}`} value={`quiz-${module.id}`}>
                     <AccordionTrigger className="font-semibold">{module.title}</AccordionTrigger>
                     <AccordionContent>
                       <div className="space-y-4">
                         {(module.quiz || []).map(q => (
                           <div key={q.id} className="flex items-start justify-between p-3 border rounded-md">
                             <div className="flex-1"><p className="font-medium">{q.question}</p><ul className="mt-2 text-sm text-muted-foreground list-disc pl-5">{q.options.map((opt, i) => <li key={i} className={i === q.correctAnswerIndex ? 'font-semibold text-green-600' : ''}>{opt}</li>)}</ul></div>
                             <div className="flex gap-1"><Button variant="ghost" size="icon" onClick={() => openQuestionModal(module, q)}><Edit className="h-4 w-4" /></Button><Button variant="ghost" size="icon" onClick={() => handleDeleteQuestion(module.id, q.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></div>
                           </div>
                         ))}
                         <Button variant="outline" className="w-full mt-2" onClick={() => openQuestionModal(module)}><PlusCircle className="mr-2 h-4 w-4" /> Adicionar Pergunta</Button>
                       </div>
                     </AccordionContent>
                   </AccordionItem>
                 ))}
               </Accordion>
             </CardContent>
           </Card>
        </TabsContent>
      </Tabs>
      
      {/* Video Dialog */}
      <Dialog onOpenChange={(open) => {if (!open) { setIsEditingModule(null); setNewVideoFile(null); setNewVideoTitle(''); }}} open={!!isEditingModule}>
        <DialogContent><DialogHeader><DialogTitle>Adicionar Vídeo ao Módulo: {isEditingModule?.title}</DialogTitle></DialogHeader><div className="space-y-4 py-4"><div><Label htmlFor="video-title">Título do Vídeo</Label><Input id="video-title" value={newVideoTitle} onChange={(e) => setNewVideoTitle(e.target.value)} placeholder="Título do vídeo" /></div><div><Label htmlFor="video-file">Arquivo de Vídeo</Label><Input id="video-file" type="file" accept="video/*" onChange={(e) => setNewVideoFile(e.target.files?.[0] || null)} /></div></div><DialogFooter><Button variant="outline" onClick={() => setIsEditingModule(null)} disabled={isUploading}>Cancelar</Button><Button onClick={handleAddVideo} disabled={isUploading || !newVideoFile || !newVideoTitle}>{isUploading ? <Loader2 className="h-4 w-4 animate-spin mr-2"/> : <Upload className="h-4 w-4 mr-2" />}{isUploading ? 'Enviando...' : 'Fazer Upload e Salvar'}</Button></DialogFooter></DialogContent>
      </Dialog>
      
      {/* Quiz Dialog */}
      <Dialog onOpenChange={(open) => {if (!open) setEditingQuizModule(null)}} open={!!editingQuizModule}>
        <DialogContent className="max-w-lg"><DialogHeader><DialogTitle>{editingQuestion?.id ? 'Editar' : 'Adicionar'} Pergunta</DialogTitle><DialogDescription>Módulo: {editingQuizModule?.title}</DialogDescription></DialogHeader>
          <div className="space-y-4 py-4">
            <div><Label htmlFor="question-text">Pergunta</Label><Input id="question-text" value={currentQuestionText} onChange={(e) => setCurrentQuestionText(e.target.value)} /></div>
            <div>
              <Label>Opções de Resposta</Label>
              <RadioGroup value={String(currentCorrectAnswerIndex)} onValueChange={(val) => setCurrentCorrectAnswerIndex(Number(val))} className="mt-2 space-y-2">
                {currentOptions.map((option, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <RadioGroupItem value={String(index)} id={`option-${index}`} />
                    <Input value={option} onChange={(e) => { const newOpts = [...currentOptions]; newOpts[index] = e.target.value; setCurrentOptions(newOpts); }} placeholder={`Opção ${index + 1}`} />
                  </div>
                ))}
              </RadioGroup>
              <p className="text-xs text-muted-foreground mt-2">Selecione a bolinha ao lado da resposta correta.</p>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setEditingQuizModule(null)}>Cancelar</Button><Button onClick={handleSaveQuestion}>Salvar Pergunta</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isResetConfirmOpen} onOpenChange={setIsResetConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Reset</AlertDialogTitle>
            <AlertDialogDescription>
              Você tem certeza que deseja resetar todo o progresso de treinamento para este usuário? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setResettingUserId(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmResetTraining} className="bg-destructive hover:bg-destructive/90">
              Sim, Resetar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
