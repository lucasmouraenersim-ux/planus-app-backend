
"use client";

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { CheckCircle, Lock, PlayCircle, Loader2 } from 'lucide-react';
import YouTube from 'react-youtube';
import type { YouTubePlayer } from 'react-youtube';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { FirestoreUser } from '@/types/user';

const trainingModules = [
  {
    id: 'module1',
    title: 'Módulo 1: A Oportunidade',
    videos: [
      { id: 'MTp7KkZhkJo', title: 'A Oportunidade do Mercado', duration: 183 },
      { id: 'xR3dzreEUe0', title: 'O que é kWh e Crédito de Energia', duration: 161 },
      { id: 'zTbuI8AH2LY', title: 'O que a Usina Ganha', duration: 93 },
    ],
  },
  {
    id: 'module2',
    title: 'Módulo 2: O Cliente e os Ganhos',
    videos: [
      { id: 'Elz4c7bpcO4', title: 'Benefícios para o Cliente', duration: 123 },
      { id: 'WIMBnoZVfmo', title: 'Quem é o cliente ideal', duration: 125 },
      { id: 'yGTEMOG1Jlo', title: 'Quanto Dá pra Ganhar', duration: 257 },
    ],
  },
];

export default function TrainingPage() {
  const { appUser, updateAppUserProfile } = useAuth(); // Use updateAppUserProfile to refresh state
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
  const playerRef = useRef<YouTubePlayer | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const userProgress = appUser?.trainingProgress || {};

  const handleVideoReady = (event: { target: YouTubePlayer }) => {
    playerRef.current = event.target;
  };

  const stopProgressInterval = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  // This function will now handle updating both Firestore and local state
  const updateUserProgress = async (moduleId: string, videoId: string, updates: object) => {
    if (!appUser) return;
    const path = `trainingProgress.${moduleId}.${videoId}`;
    const fullUpdatePath = { [`${path}`]: { ...userProgress[moduleId]?.[videoId], ...updates } };

    await updateDoc(doc(db, 'users', appUser.uid), fullUpdatePath);

    // After updating firestore, fetch the latest user data to refresh the context
    const userDocRef = doc(db, 'users', appUser.uid);
    const userDocSnap = await getDoc(userDocRef);
    if (userDocSnap.exists()) {
      const latestUserData = userDocSnap.data() as FirestoreUser;
      // Use a dummy update to trigger a re-fetch and state update in the context
      // This forces the UI to re-render with the new progress
      await updateAppUserProfile({ personalFinance: latestUserData.personalFinance }); 
    }
  };

  const handlePlay = (moduleId: string, videoId: string, duration: number) => {
    stopProgressInterval();

    intervalRef.current = setInterval(async () => {
      if (!playerRef.current || !appUser) {
        stopProgressInterval();
        return;
      }
      
      const currentTime = await playerRef.current.getCurrentTime();
      const currentProgressInDb = userProgress[moduleId]?.[videoId] || { watchedSeconds: 0, completed: false };

      if (currentTime > currentProgressInDb.watchedSeconds) {
        await updateUserProgress(moduleId, videoId, { watchedSeconds: currentTime });
      }
      
      if (currentTime >= duration - 2 && !currentProgressInDb.completed) {
        await updateUserProgress(moduleId, videoId, { completed: true });
        stopProgressInterval();
      }
    }, 2000);
  };

  const handleEnd = async (moduleId: string, videoId: string) => {
    stopProgressInterval();

    if (appUser && !userProgress[moduleId]?.[videoId]?.completed) {
      await updateUserProgress(moduleId, videoId, { completed: true });
    }
  };

  const isVideoUnlocked = (moduleId: string, videoIndex: number): boolean => {
    if (moduleId === 'module1' && videoIndex === 0) return true;

    const currentModuleIndex = trainingModules.findIndex(m => m.id === moduleId);
    if (currentModuleIndex === -1) return false;

    if (videoIndex > 0) {
      const prevVideo = trainingModules[currentModuleIndex].videos[videoIndex - 1];
      return userProgress[moduleId]?.[prevVideo.id]?.completed === true;
    }

    if (currentModuleIndex > 0) {
      const prevModule = trainingModules[currentModuleIndex - 1];
      const lastVideoOfPrevModule = prevModule.videos[prevModule.videos.length - 1];
      return userProgress[prevModule.id]?.[lastVideoOfPrevModule.id]?.completed === true;
    }
    
    return false;
  };

  useEffect(() => {
    return () => {
      stopProgressInterval();
    };
  }, []);

  if (!appUser) {
    return (
      <div className="flex justify-center items-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  const allVideos = trainingModules.flatMap(m => m.videos);
  const completedVideos = allVideos.filter(v => {
    const moduleId = trainingModules.find(m => m.videos.some(vid => vid.id === v.id))?.id;
    return moduleId && userProgress[moduleId]?.[v.id]?.completed === true;
  }).length;
  const totalProgressPercentage = (completedVideos / allVideos.length) * 100;
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
              {completedVideos} de {allVideos.length} vídeos concluídos.
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
          <Accordion type="single" collapsible className="w-full" defaultValue="module1">
            {trainingModules.map((module) => (
              <AccordionItem key={module.id} value={module.id}>
                <AccordionTrigger>{module.title}</AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4">
                    {module.videos.map((video, index) => {
                      const unlocked = isVideoUnlocked(module.id, index);
                      const progress = userProgress[module.id]?.[video.id];
                      const isCompleted = progress?.completed === true;
                      const progressPercent = isCompleted ? 100 : (progress ? (progress.watchedSeconds / video.duration) * 100 : 0);

                      return (
                        <div key={video.id} className="p-3 border rounded-md">
                          <div className="flex justify-between items-center mb-2">
                            <h4 className="font-semibold text-foreground">{video.title}</h4>
                            {unlocked ? (
                              isCompleted ? (
                                <CheckCircle className="h-5 w-5 text-green-500" />
                              ) : (
                                <PlayCircle className="h-5 w-5 text-primary" />
                              )
                            ) : (
                              <Lock className="h-5 w-5 text-muted-foreground" />
                            )}
                          </div>
                          <Progress value={progressPercent} className="h-2 mb-2" />
                          {activeVideoId === video.id && (
                            <YouTube
                              videoId={video.id}
                              opts={{
                                height: '390',
                                width: '100%',
                                playerVars: {
                                  autoplay: 1,
                                  controls: 1,
                                  disablekb: 1,
                                  modestbranding: 1,
                                  iv_load_policy: 3,
                                },
                              }}
                              onReady={handleVideoReady}
                              onPlay={() => handlePlay(module.id, video.id, video.duration)}
                              onEnd={() => handleEnd(module.id, video.id)}
                              onStateChange={(e) => { if (e.data === 0) handleEnd(module.id, video.id); }}
                            />
                          )}
                          <Button onClick={() => setActiveVideoId(video.id)} disabled={!unlocked || activeVideoId === video.id} size="sm">
                            {activeVideoId === video.id ? "Assistindo..." : "Assistir Vídeo"}
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
}
