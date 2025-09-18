
"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { CheckCircle, Lock, Loader2 } from 'lucide-react';
import { doc, updateDoc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { TrainingModule } from '@/types/user';
import { CustomVideoPlayer } from '@/components/training/CustomVideoPlayer';

const TRAINING_CONFIG_DOC_ID = 'main-config';

export default function TrainingPage() {
  const { appUser, updateAppUser } = useAuth(); // Changed to use updateAppUser for local state update
  const [activeVideoUrl, setActiveVideoUrl] = useState<string | null>(null);
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
  const [activeModuleId, setActiveModuleId] = useState<string | null>(null);

  const [trainingModules, setTrainingModules] = useState<TrainingModule[]>([]);
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);

  // Fetch training config from Firestore
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
    const newProgress = {
        ...userProgress,
        [moduleId]: {
            ...(userProgress[moduleId] || {}),
            [videoId]: {
                completed: true
            }
        }
    };
    
    const userDocRef = doc(db, 'users', appUser.uid);
    // Update Firestore in the background
    await updateDoc(userDocRef, { trainingProgress: newProgress });
    
    // Immediately update local state to reflect the change in the UI
    updateAppUser({ ...appUser, trainingProgress: newProgress });
  };
  
  const handleSelectVideo = (module: TrainingModule, videoId: string, videoUrl: string) => {
      setActiveModuleId(module.id);
      setActiveVideoId(videoId);
      setActiveVideoUrl(videoUrl);
  }

  const handleClosePlayer = () => {
    setActiveVideoId(null);
    setActiveVideoUrl(null);
    setActiveModuleId(null);
  };

  const isVideoUnlocked = (moduleId: string, videoIndex: number): boolean => {
    if (isLoadingConfig || !appUser) return false;

    const firstModule = trainingModules[0];
    if (firstModule && moduleId === firstModule.id && videoIndex === 0) {
      return true;
    }

    const currentModuleIndex = trainingModules.findIndex(m => m.id === moduleId);
    if (currentModuleIndex === -1) return false;
    
    const currentModule = trainingModules[currentModuleIndex];

    if (videoIndex > 0) {
      const prevVideo = currentModule.videos[videoIndex - 1];
      return userProgress[moduleId]?.[prevVideo.id]?.completed === true;
    }

    if (currentModuleIndex > 0) {
      const prevModule = trainingModules[currentModuleIndex - 1];
      if (prevModule.videos.length === 0) {
          return isVideoUnlocked(prevModule.id, 0); 
      }
      const lastVideoOfPrevModule = prevModule.videos[prevModule.videos.length - 1];
      return userProgress[prevModule.id]?.[lastVideoOfPrevModule.id]?.completed === true;
    }
    
    return false;
  };


  if (isLoadingConfig || !appUser) {
    return (
      <div className="flex justify-center items-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  const allVideos = trainingModules.flatMap(m => m.videos);
  const totalTrainingVideos = allVideos.length;

  const completedVideos = allVideos.filter(v => {
    const moduleId = trainingModules.find(m => m.videos.some(vid => vid.id === v.id))?.id;
    return moduleId && userProgress[moduleId]?.[v.id]?.completed === true;
  }).length;
  
  const totalProgressPercentage = totalTrainingVideos > 0 ? (completedVideos / totalTrainingVideos) * 100 : 0;
  const isTrainingComplete = totalProgressPercentage >= 100;

  return (
    <div className="container mx-auto p-4 md:p-8">
      <Card className="bg-card/80 backdrop-blur-lg">
        <CardHeader>
          <CardTitle className="text-3xl text-primary">Portal de Treinamento</CardTitle>
          <CardDescription>Bem-vindo, {appUser.displayName}! Complete os módulos para ativar sua conta de vendedor.</CardDescription>
          <div className="pt-4">
            <Progress value={totalProgressPercentage} className="h-3" />
            <p className="text-sm text-muted-foreground text-right mt-1">
              {completedVideos} de {totalTrainingVideos} vídeos concluídos.
            </p>
          </div>
          {isTrainingComplete && (
            <div className="mt-4 p-4 bg-green-500/10 border border-green-500/30 rounded-lg text-center">
              <h3 className="font-semibold text-green-600">Treinamento Concluído!</h3>
              <p className="text-sm text-muted-foreground">Parabéns! Você finalizou todos os módulos. Um administrador irá revisar seu progresso e ativar sua conta de vendedor em breve.</p>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {activeVideoUrl && activeVideoId && activeModuleId ? (
             <CustomVideoPlayer 
                src={activeVideoUrl}
                onClose={handleClosePlayer}
                onVideoEnd={() => handleVideoCompleted(activeModuleId, activeVideoId)}
                allowSeek={userProgress[activeModuleId]?.[activeVideoId]?.completed || false}
             />
          ) : (
            <Accordion type="single" collapsible className="w-full" defaultValue={trainingModules[0]?.id}>
                {trainingModules.map((module) => (
                <AccordionItem key={module.id} value={module.id}>
                    <AccordionTrigger>{module.title}</AccordionTrigger>
                    <AccordionContent>
                    <div className="space-y-4">
                        {module.videos.map((video, index) => {
                        const unlocked = isVideoUnlocked(module.id, index);
                        const isCompleted = userProgress[module.id]?.[video.id]?.completed === true;

                        return (
                            <div key={video.id} className="p-3 border rounded-md flex justify-between items-center">
                                <h4 className="font-semibold text-foreground">{video.title}</h4>
                                {isCompleted ? (
                                    <Button onClick={() => handleSelectVideo(module, video.id, video.videoUrl)} size="sm">
                                      <CheckCircle className="h-4 w-4 mr-2 text-green-400" />
                                      Assistir Novamente
                                    </Button>
                                ) : (
                                    <Button onClick={() => handleSelectVideo(module, video.id, video.videoUrl)} disabled={!unlocked} size="sm">
                                        {unlocked ? 'Assistir' : <Lock className="h-4 w-4"/>}
                                    </Button>
                                )}
                            </div>
                        );
                        })}
                    </div>
                    </AccordionContent>
                </AccordionItem>
                ))}
            </Accordion>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
