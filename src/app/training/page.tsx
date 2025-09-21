
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
import { sendWhatsappMessage } from '@/actions/whatsapp/sendWhatsappMessage'; // Import the action

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
  const [quizAnswers, setQuizAnswers] = useState<{ [key: string]: number }>({});
  const [isSubmittingQuiz, setIsSubmittingQuiz] = useState(false);
  const [quizResult, setQuizResult] = useState<{ score: number; message: string } | null>(null);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [cooldownTimeLeft, setCooldownTimeLeft] = useState<number | null>(null);

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
    if (!appUser || userProgress[moduleId]?.[videoId]?.completed) return;
    
    const newProgress = { 
        ...userProgress, 
        [moduleId]: { 
            ...(userProgress[moduleId] || {}), 
            [videoId]: { completed: true } 
        } 
    };
    
    // Update local state and Firestore
    updateAppUser({ ...appUser, trainingProgress: newProgress });
    const userDocRef = doc(db, 'users', appUser.uid);
    await updateDoc(userDocRef, { trainingProgress: newProgress });
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
  
  const allVideos = trainingModules.flatMap(m => m.videos);
  const totalTrainingVideos = allVideos.length;

  const completedVideos = allVideos.filter(v => {
    const moduleId = trainingModules.find(m => m.videos.some(vid => vid.id === v.id))?.id;
    return moduleId && userProgress[moduleId]?.[v.id]?.completed === true;
  }).length;
  
  const totalProgressPercentage = totalTrainingVideos > 0 ? (completedVideos / totalTrainingVideos) * 100 : 0;
  const isTrainingComplete = totalProgressPercentage >= 100;

  const isVideoUnlocked = (moduleId: string, videoIndex: number): boolean => {
    if (isLoadingConfig || !appUser) return false;
    const moduleIndex = trainingModules.findIndex(m => m.id === moduleId);
    if (moduleIndex === -1) return false;

    // First video of the first module is always unlocked
    if (moduleIndex === 0 && videoIndex === 0) return true;

    // Find the previous video
    let prevModuleId: string;
    let prevVideoId: string;

    if (videoIndex > 0) {
      // Previous video is in the same module
      prevModuleId = moduleId;
      prevVideoId = trainingModules[moduleIndex].videos[videoIndex - 1].id;
    } else {
      // Previous video is the last video of the previous module
      if (moduleIndex === 0) return false; // Should not happen if check above is correct
      const prevModule = trainingModules[moduleIndex - 1];
      if (prevModule.videos.length === 0) return isVideoUnlocked(prevModule.id, 0); // Recursively check previous empty modules
      prevModuleId = prevModule.id;
      prevVideoId = prevModule.videos[prevModule.videos.length - 1].id;
    }

    return userProgress[prevModuleId]?.[prevVideoId]?.completed === true;
  };
  
  const allQuizQuestions = trainingModules.flatMap(m => m.quiz || []);

  const handleStartQuiz = () => {
    if (allQuizQuestions.length > 0) {
      setQuizAnswers({});
      setShowQuiz(true);
    }
  };

  const handleSubmitQuiz = async () => {
    if (!appUser) return;
    setIsSubmittingQuiz(true);

    let correctCount = 0;
    allQuizQuestions.forEach(q => {
      if (quizAnswers[q.id] === q.correctAnswerIndex) {
        correctCount++;
      }
    });
    
    const score = (correctCount / allQuizQuestions.length) * 100;

    const newAttempt: QuizAttempt = {
        score,
        timestamp: new Date().toISOString(),
        answers: quizAnswers,
    };
    
    const moduleIdForSaving = trainingModules[0]?.id || 'mainQuiz';
    const existingAttempts = userProgress[moduleIdForSaving]?.quizAttempts || [];
    const newProgress = { ...userProgress, [moduleIdForSaving]: { ...userProgress[moduleIdForSaving], quizAttempts: [...existingAttempts, newAttempt] } };

    const userDocRef = doc(db, 'users', appUser.uid);
    
    // Send WhatsApp Notification
    try {
        const adminPhoneNumber = "65981014125";
        if (adminPhoneNumber) {
            const message = `🔔 *Alerta de Treinamento Concluído* 🔔\n\nO promotor *${appUser.displayName || appUser.email}* finalizou o questionário de treinamento com uma pontuação de *${score.toFixed(1)}%*.`;

            await sendWhatsappMessage({
                to: adminPhoneNumber,
                message: { text: message }
            });
            console.log("Admin notification sent successfully.");
        } else {
            console.warn("ADMIN_PHONE_NUMBER not set. Skipping notification.");
        }
    } catch (notificationError) {
        console.error("Failed to send admin notification:", notificationError);
        // Do not block the flow if the notification fails, just log it.
    }


    if (score >= 80) {
      await updateDoc(userDocRef, { trainingProgress: newProgress, type: 'vendedor' });
      updateAppUser({ ...appUser, type: 'vendedor', trainingProgress: newProgress });
      setQuizResult({ score, message: "Parabéns! O Gestor entrará em contato com você para dar continuidade ao seu processo! Vamos ganhar dinheiro!!!" });
    } else {
      await updateDoc(userDocRef, { trainingProgress: newProgress });
      updateAppUser({ ...appUser, trainingProgress: newProgress });
      setQuizResult({ score, message: "Sinto muito! Você precisa refazer o treinamento. Você poderá tentar o questionário novamente em 24 horas." });
    }

    setIsSubmittingQuiz(false);
  };
  
  const handleQuizDialogClose = () => {
    setQuizResult(null);
    setShowQuiz(false);
    if (quizResult && quizResult.score >= 80) {
      setIsRedirecting(true);
      setTimeout(() => router.push('/dashboard'), 2000);
    }
  }

  const latestAttempt = userProgress[trainingModules[0]?.id || '']?.quizAttempts?.slice(-1)[0];
  const quizPassed = latestAttempt && latestAttempt.score >= 80;

  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    if (latestAttempt && !quizPassed) {
      const lastAttemptTime = new Date(latestAttempt.timestamp).getTime();
      const twentyFourHours = 24 * 60 * 60 * 1000;
      const cooldownEndTime = lastAttemptTime + twentyFourHours;

      const updateCountdown = () => {
        const now = new Date().getTime();
        const timeLeft = cooldownEndTime - now;
        if (timeLeft > 0) {
          setCooldownTimeLeft(timeLeft);
        } else {
          setCooldownTimeLeft(null);
          if (intervalId) clearInterval(intervalId);
        }
      };

      updateCountdown();
      intervalId = setInterval(updateCountdown, 1000);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [latestAttempt, quizPassed]);
  
  const formatCountdown = (ms: number | null): string => {
    if (ms === null || ms < 0) return "00h 00m 00s";
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((ms % (1000 * 60)) / 1000);
    return `${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;
  };

  const canTakeQuiz = cooldownTimeLeft === null;

  if (isLoadingConfig || !appUser) {
    return <div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  
  if (isRedirecting) {
    return <div className="flex flex-col justify-center items-center h-full text-center">
        <CheckCircle className="h-16 w-16 text-green-500 mb-4"/>
        <h2 className="text-2xl font-bold text-primary">Aprovado!</h2>
        <p className="text-muted-foreground">Redirecionando para o seu painel em 2 segundos...</p>
        <Loader2 className="h-8 w-8 animate-spin text-primary mt-4" />
    </div>;
  }

  const renderQuiz = () => (
    <Card className="bg-card/90">
      <CardHeader>
        <CardTitle className="text-primary">Questionário Final</CardTitle>
        <CardDescription>Responda as perguntas para validar seu conhecimento e ativar sua conta.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {allQuizQuestions.map((q, index) => (
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
        <Button onClick={handleSubmitQuiz} disabled={isSubmittingQuiz || Object.keys(quizAnswers).length < allQuizQuestions.length}>
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
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          )}

          {!showQuiz && !activeVideoUrl && isTrainingComplete && !quizPassed && (
              <div className="mt-6 p-4 bg-primary/10 border border-primary/20 rounded-md text-center space-y-3">
                <h3 className="font-semibold">Parabéns por concluir todos os vídeos!</h3>
                <p className="text-sm text-muted-foreground">Agora, teste seu conhecimento para liberar o próximo passo.</p>
                <Button onClick={handleStartQuiz} disabled={!canTakeQuiz}>
                  <FileQuestion className="mr-2 h-4 w-4" /> Iniciar Questionário Final
                </Button>
                {!canTakeQuiz && <p className="text-sm text-amber-600 mt-2">Nova tentativa em: {formatCountdown(cooldownTimeLeft)}</p>}
              </div>
          )}

          {quizPassed && (
            <div className="mt-6 p-4 bg-green-500/10 border border-green-500/30 rounded-lg text-center">
              <h3 className="font-semibold text-green-600">Treinamento Concluído com Sucesso!</h3>
              <p className="text-sm text-muted-foreground">Sua conta de vendedor está ativa. Você será redirecionado para o painel principal.</p>
            </div>
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
