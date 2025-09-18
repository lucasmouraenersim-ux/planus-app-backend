
"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { CheckCircle, Lock, Loader2, FileQuestion, Send, AlertTriangle } from 'lucide-react';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel } from '@/components/ui/alert-dialog';
import { doc, updateDoc, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { TrainingModule, QuizAttempt, TrainingQuizQuestion } from '@/types/user';
import { CustomVideoPlayer } from '@/components/training/CustomVideoPlayer';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useRouter } from 'next/navigation';

const TRAINING_CONFIG_DOC_ID = 'main-config';

export default function TrainingPage() {
  const { appUser, updateAppUser } = useAuth();
  const router = useRouter();

  const [activeVideoUrl, setActiveVideoUrl] = useState<string | null>(null);
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
  const [activeModuleId, setActiveModuleId] = useState<string | null>(null);

  const [trainingModules, setTrainingModules] = useState<TrainingModule[]>([]);
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);
  
  const [showQuiz, setShowQuiz] = useState(false);
  const [currentQuiz, setCurrentQuiz] = useState<TrainingQuizQuestion[]>([]);
  const [quizAnswers, setQuizAnswers] = useState<{ [key: string]: number }>({});
  const [isSubmittingQuiz, setIsSubmittingQuiz] = useState(false);
  const [quizResult, setQuizResult] = useState<{ score: number; message: string } | null>(null);

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

  const userProgress = appUser?.trainingProgress || {};

  const handleVideoCompleted = async (moduleId: string, videoId: string) => {
    if (!appUser) return;
    const path = `trainingProgress.${moduleId}.${videoId}`;
    const newProgress = { ...userProgress, [moduleId]: { ...(userProgress[moduleId] || {}), [videoId]: { completed: true } } };
    const userDocRef = doc(db, 'users', appUser.uid);
    await updateDoc(userDocRef, { trainingProgress: newProgress });
    updateAppUser({ ...appUser, trainingProgress: newProgress });
  };
  
  const handleSelectVideo = (module: TrainingModule, videoId: string, videoUrl: string) => {
      setActiveModuleId(module.id);
      setActiveVideoId(videoId);
      setActiveVideoUrl(videoUrl);
  };

  const handleClosePlayer = () => {
    setActiveVideoId(null);
    setActiveVideoUrl(null);
    setActiveModuleId(null);
  };

  const isVideoUnlocked = (moduleId: string, videoIndex: number): boolean => {
    if (isLoadingConfig || !appUser) return false;
    const firstModule = trainingModules[0];
    if (firstModule && moduleId === firstModule.id && videoIndex === 0) return true;
    const currentModuleIndex = trainingModules.findIndex(m => m.id === moduleId);
    if (currentModuleIndex === -1) return false;
    const currentModule = trainingModules[currentModuleIndex];
    if (videoIndex > 0) {
      const prevVideo = currentModule.videos[videoIndex - 1];
      return userProgress[moduleId]?.[prevVideo.id]?.completed === true;
    }
    if (currentModuleIndex > 0) {
      const prevModule = trainingModules[currentModuleIndex - 1];
      if (prevModule.videos.length === 0) return isVideoUnlocked(prevModule.id, 0); 
      const lastVideoOfPrevModule = prevModule.videos[prevModule.videos.length - 1];
      return userProgress[prevModule.id]?.[lastVideoOfPrevModule.id]?.completed === true;
    }
    return false;
  };

  const handleStartQuiz = (moduleId: string) => {
    const module = trainingModules.find(m => m.id === moduleId);
    if (module?.quiz) {
      setActiveModuleId(moduleId); // Set active module for quiz submission
      setCurrentQuiz(module.quiz);
      setQuizAnswers({});
      setShowQuiz(true);
    }
  };

  const handleSubmitQuiz = async () => {
    if (!appUser || !activeModuleId) return;
    setIsSubmittingQuiz(true);

    let correctCount = 0;
    currentQuiz.forEach(q => {
      if (quizAnswers[q.id] === q.correctAnswerIndex) {
        correctCount++;
      }
    });
    
    const score = (correctCount / currentQuiz.length) * 100;

    const newAttempt: QuizAttempt = {
        score,
        timestamp: new Date().toISOString(),
        answers: quizAnswers,
    };
    
    const existingAttempts = userProgress[activeModuleId]?.quizAttempts || [];
    const newProgress = { ...userProgress, [activeModuleId]: { ...userProgress[activeModuleId], quizAttempts: [...existingAttempts, newAttempt] } };

    const userDocRef = doc(db, 'users', appUser.uid);
    await updateDoc(userDocRef, { trainingProgress: newProgress });
    updateAppUser({ ...appUser, trainingProgress: newProgress });

    if (score >= 80) {
      setQuizResult({ score, message: "Parabéns! Você foi aprovado. O Gestor entrará em contato para dar continuidade ao seu processo! Vamos ganhar dinheiro!!!" });
      await updateDoc(userDocRef, { type: 'vendedor' });
      updateAppUser({ ...appUser, type: 'vendedor', trainingProgress: newProgress });
    } else {
      setQuizResult({ score, message: "Sinto muito! Você precisa refazer o treinamento. Você poderá tentar o questionário novamente em 24 horas." });
    }

    setIsSubmittingQuiz(false);
  };
  
  const handleQuizDialogClose = () => {
    setQuizResult(null);
    setShowQuiz(false);
    if (quizResult && quizResult.score >= 80) {
      router.push('/dashboard');
    }
  }

  if (isLoadingConfig || !appUser) {
    return <div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  
  const allVideos = trainingModules.flatMap(m => m.videos);
  const totalTrainingVideos = allVideos.length;
  const completedVideos = allVideos.filter(v => {
    const moduleId = trainingModules.find(m => m.videos.some(vid => vid.id === v.id))?.id;
    return moduleId && userProgress[moduleId]?.[v.id]?.completed === true;
  }).length;
  const totalProgressPercentage = totalTrainingVideos > 0 ? (completedVideos / totalTrainingVideos) * 100 : 0;
  
  const isTrainingComplete = completedVideos === totalTrainingVideos;

  const renderQuiz = () => (
    <Card className="bg-card/90">
      <CardHeader>
        <CardTitle className="text-primary">Questionário do Módulo</CardTitle>
        <CardDescription>Responda as perguntas para validar seu conhecimento.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {currentQuiz.map((q, index) => (
          <div key={q.id} className="p-4 border rounded-md">
            <p className="font-semibold mb-3">{index + 1}. {q.question}</p>
            <RadioGroup onValueChange={(val) => setQuizAnswers(prev => ({ ...prev, [q.id]: Number(val) }))}>
              {q.options.map((opt, i) => (
                <div key={i} className="flex items-center space-x-2">
                  <RadioGroupItem value={String(i)} id={`${q.id}-${i}`} />
                  <Label htmlFor={`${q.id}-${i}`}>{opt}</Label>
                </div>
              ))}
            </RadioGroup>
          </div>
        ))}
      </CardContent>
      <CardFooter className="flex justify-end">
        <Button onClick={handleSubmitQuiz} disabled={isSubmittingQuiz || Object.keys(quizAnswers).length < currentQuiz.length}>
          {isSubmittingQuiz ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
          Finalizar e Enviar Respostas
        </Button>
      </CardFooter>
    </Card>
  );

  return (
    <div className="container mx-auto p-4 md:p-8">
      <Card className="bg-card/80 backdrop-blur-lg">
        <CardHeader>
          <CardTitle className="text-3xl text-primary">Portal de Treinamento</CardTitle>
          <CardDescription>Bem-vindo, {appUser.displayName}! Complete os módulos para ativar sua conta de vendedor.</CardDescription>
          <div className="pt-4">
            <Progress value={totalProgressPercentage} className="h-3" />
            <p className="text-sm text-muted-foreground text-right mt-1">{completedVideos} de {totalTrainingVideos} vídeos concluídos.</p>
          </div>
        </CardHeader>
        <CardContent>
          {showQuiz ? renderQuiz() : activeVideoUrl && activeVideoId && activeModuleId ? (
             <CustomVideoPlayer src={activeVideoUrl} onClose={handleClosePlayer} onVideoEnd={() => handleVideoCompleted(activeModuleId, activeVideoId)} allowSeek={userProgress[activeModuleId]?.[activeVideoId]?.completed || false} />
          ) : (
            <Accordion type="single" collapsible className="w-full" defaultValue={trainingModules[0]?.id}>
              {trainingModules.map((module) => {
                const moduleVideos = module.videos || [];
                const completedModuleVideos = moduleVideos.filter(v => userProgress[module.id]?.[v.id]?.completed).length;
                const moduleComplete = moduleVideos.length > 0 && completedModuleVideos === moduleVideos.length;
                
                const attempts = userProgress[module.id]?.quizAttempts || [];
                const lastAttempt = attempts.length > 0 ? attempts[attempts.length - 1] : null;
                const quizTaken = !!lastAttempt;
                const quizPassed = lastAttempt && lastAttempt.score >= 80;
                
                let canTakeQuiz = true;
                let cooldownMessage = "";
                if (lastAttempt && !quizPassed) {
                    const lastAttemptTime = new Date(lastAttempt.timestamp).getTime();
                    const now = new Date().getTime();
                    const twentyFourHours = 24 * 60 * 60 * 1000;
                    if (now - lastAttemptTime < twentyFourHours) {
                        canTakeQuiz = false;
                        const timeLeft = twentyFourHours - (now - lastAttemptTime);
                        const hours = Math.floor(timeLeft / (60 * 60 * 1000));
                        const minutes = Math.floor((timeLeft % (60 * 60 * 1000)) / (60 * 1000));
                        cooldownMessage = `Aguarde ${hours}h ${minutes}m para tentar novamente.`;
                    }
                }

                return (
                  <AccordionItem key={module.id} value={module.id}>
                    <AccordionTrigger>{module.title}</AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-4">
                        {moduleVideos.map((video, index) => {
                          const unlocked = isVideoUnlocked(module.id, index);
                          const isCompleted = userProgress[module.id]?.[video.id]?.completed === true;
                          return (<div key={video.id} className="p-3 border rounded-md flex justify-between items-center">
                              <h4 className="font-semibold text-foreground">{video.title}</h4>
                              {isCompleted ? <Button onClick={() => handleSelectVideo(module, video.id, video.videoUrl)} size="sm"><CheckCircle className="h-4 w-4 mr-2 text-green-400" />Assistir Novamente</Button> : <Button onClick={() => handleSelectVideo(module, video.id, video.videoUrl)} disabled={!unlocked} size="sm">{unlocked ? 'Assistir' : <Lock className="h-4 w-4"/>}</Button>}
                          </div>);
                        })}
                        {moduleComplete && (module.quiz || []).length > 0 && !quizPassed && (
                          <div className="p-4 bg-primary/10 border border-primary/20 rounded-md text-center space-y-3">
                            <h3 className="font-semibold">Parabéns por concluir os vídeos!</h3>
                            <p className="text-sm text-muted-foreground">Agora, teste seu conhecimento para liberar o próximo passo.</p>
                            <Button onClick={() => handleStartQuiz(module.id)} disabled={!canTakeQuiz}>
                              <FileQuestion className="mr-2 h-4 w-4" /> Iniciar Questionário
                            </Button>
                            {!canTakeQuiz && <p className="text-xs text-amber-600 mt-2">{cooldownMessage}</p>}
                          </div>
                        )}
                        {quizPassed && (
                          <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg text-center">
                            <h3 className="font-semibold text-green-600">Questionário Concluído com Sucesso!</h3>
                            <p className="text-sm text-muted-foreground">Um administrador irá revisar seu progresso e ativar sua conta de vendedor em breve.</p>
                          </div>
                        )}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          )}
        </CardContent>
      </Card>
      
       <AlertDialog open={!!quizResult} onOpenChange={(open) => !open && handleQuizDialogClose()}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className={quizResult && quizResult.score >= 80 ? 'text-green-600' : 'text-red-600'}>
                {quizResult && quizResult.score >= 80 ? 'Aprovado!' : 'Tente Novamente'}
              </AlertDialogTitle>
              <AlertDialogDescription>
                Seu resultado: <strong>{quizResult?.score.toFixed(1)}%</strong>
                <p className="mt-2">{quizResult?.message}</p>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogAction onClick={handleQuizDialogClose}>Fechar</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
    </div>
  );
}
