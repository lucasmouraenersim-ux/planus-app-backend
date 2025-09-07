
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
import { doc, updateDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const trainingModules = [
  {
    id: 'module1',
    title: 'Módulo 1: Boas-vindas e Introdução',
    videos: [
      { id: 'qWpL2K_qY4Y', title: 'Introdução à Sent Energia', duration: 120 }, // Placeholder duration
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

export default function TrainingPage() {
  const { appUser, refreshUsers } = useAuth();
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
  const playerRef = useRef<YouTubePlayer | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const userProgress = appUser?.trainingProgress || {};

  const handleVideoReady = (event: { target: YouTubePlayer }) => {
    playerRef.current = event.target;
  };

  const handlePlay = (moduleId: string, videoId: string, duration: number) => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    intervalRef.current = setInterval(async () => {
      if (playerRef.current && appUser) {
        const currentTime = await playerRef.current.getCurrentTime();
        const path = `trainingProgress.${moduleId}.${videoId}`;
        const currentProgress = userProgress[moduleId]?.[videoId]?.watchedSeconds || 0;

        if (currentTime > currentProgress) {
          await updateDoc(doc(db, 'users', appUser.uid), {
            [`${path}.watchedSeconds`]: currentTime,
          });
        }
        
        if (currentTime >= duration - 1) {
            await updateDoc(doc(db, 'users', appUser.uid), {
                [`${path}.completed`]: true,
            });
            if (intervalRef.current) clearInterval(intervalRef.current);
        }
      }
    }, 2000);
  };

  const handleEnd = (moduleId: string, videoId: string) => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
     if(appUser) {
        const path = `trainingProgress.${moduleId}.${videoId}`;
        updateDoc(doc(db, 'users', appUser.uid), {
            [`${path}.completed`]: true,
        });
     }
  };

  const isVideoUnlocked = (moduleId: string, videoIndex: number): boolean => {
    if (moduleId === 'module1' && videoIndex === 0) return true;

    const currentModuleIndex = trainingModules.findIndex(m => m.id === moduleId);
    if (currentModuleIndex === -1) return false;

    // Check if previous video in the same module is complete
    if (videoIndex > 0) {
      const prevVideo = trainingModules[currentModuleIndex].videos[videoIndex - 1];
      return userProgress[moduleId]?.[prevVideo.id]?.completed === true;
    }

    // Check if last video of previous module is complete
    if (currentModuleIndex > 0) {
      const prevModule = trainingModules[currentModuleIndex - 1];
      const lastVideoOfPrevModule = prevModule.videos[prevModule.videos.length - 1];
      return userProgress[prevModule.id]?.[lastVideoOfPrevModule.id]?.completed === true;
    }
    
    return false;
  };

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  if (!appUser) {
    return (
        <div className="flex justify-center items-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-8">
      <Card className="bg-card/80 backdrop-blur-lg">
        <CardHeader>
          <CardTitle className="text-3xl text-primary">Portal de Treinamento</CardTitle>
          <CardDescription>Bem-vindo, {appUser.displayName}! Complete os módulos para ativar sua conta.</CardDescription>
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
                      const progressPercent = progress ? (progress.watchedSeconds / video.duration) * 100 : 0;

                      return (
                        <div key={video.id} className="p-3 border rounded-md">
                           <div className="flex justify-between items-center mb-2">
                                <h4 className="font-semibold text-foreground">{video.title}</h4>
                                {unlocked ? (
                                    progress?.completed ? (
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
                                            disablekb: 1, // Disables keyboard controls
                                            modestbranding: 1,
                                        },
                                    }}
                                    onReady={handleVideoReady}
                                    onPlay={() => handlePlay(module.id, video.id, video.duration)}
                                    onEnd={() => handleEnd(module.id, video.id)}
                                />
                            )}
                             <Button onClick={() => setActiveVideoId(video.id)} disabled={!unlocked || activeVideoId === video.id}>
                                Assistir Vídeo
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
