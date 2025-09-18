
"use client";

import React, { useRef, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Play, Pause, Maximize, Volume2, VolumeX, XSquare, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CustomVideoPlayerProps {
    src: string;
    onClose: () => void;
    onVideoEnd: () => void;
    allowSeek: boolean;
}

export function CustomVideoPlayer({ src, onClose, onVideoEnd, allowSeek }: CustomVideoPlayerProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);
    const [hasEnded, setHasEnded] = useState(false);
    
    // This effect handles video events
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        // Reset state when src changes
        setHasEnded(false);
        setIsPlaying(false);
        setProgress(0);

        const handlePlay = () => setIsPlaying(true);
        const handlePause = () => setIsPlaying(false);
        const handleTimeUpdate = () => {
            if (video) {
                const currentProgress = (video.currentTime / video.duration) * 100;
                if (!isNaN(currentProgress)) {
                  setProgress(currentProgress);
                }
            }
        };
        const handleDurationChange = () => {
            if (video) {
                setDuration(video.duration);
            }
        };
        const handleEnded = () => {
            setIsPlaying(false);
            setHasEnded(true);
            onVideoEnd();
        };

        video.addEventListener('play', handlePlay);
        video.addEventListener('pause', handlePause);
        video.addEventListener('timeupdate', handleTimeUpdate);
        video.addEventListener('durationchange', handleDurationChange);
        video.addEventListener('ended', handleEnded);

        // Attempt to play on mount
        const playPromise = video.play();
        if (playPromise !== undefined) {
          playPromise.catch(error => {
            // Autoplay was prevented. This is a common browser policy.
            // User will have to click play manually.
            if (error.name !== 'NotAllowedError') {
              console.error("Video play error on mount:", error);
            }
          });
        }

        // Cleanup function to remove event listeners
        return () => {
            video.removeEventListener('play', handlePlay);
            video.removeEventListener('pause', handlePause);
            video.removeEventListener('timeupdate', handleTimeUpdate);
            video.removeEventListener('durationchange', handleDurationChange);
            video.removeEventListener('ended', handleEnded);
        };
    }, [src, onVideoEnd]);

    const togglePlay = () => {
        if (videoRef.current) {
            // If the video has ended, reset it before playing again
            if (hasEnded && videoRef.current.currentTime >= duration - 0.1) {
                videoRef.current.currentTime = 0;
                setHasEnded(false);
            }
            if (videoRef.current.paused) {
                videoRef.current.play();
            } else {
                videoRef.current.pause();
            }
        }
    };

    const handleProgressChange = (value: number[]) => {
        if (videoRef.current && (allowSeek || hasEnded)) { // Allow seeking if completed
            const newTime = (value[0] / 100) * duration;
            videoRef.current.currentTime = newTime;
        }
    };
    
    const toggleMute = () => {
        if (videoRef.current) {
            const newMutedState = !videoRef.current.muted;
            videoRef.current.muted = newMutedState;
            setIsMuted(newMutedState);
            if(newMutedState) {
                setVolume(0);
            } else {
                setVolume(videoRef.current.volume);
            }
        }
    };

    const handleVolumeChange = (value: number[]) => {
        if (videoRef.current) {
            const newVolume = value[0] / 100;
            videoRef.current.volume = newVolume;
            setVolume(newVolume);
            setIsMuted(newVolume === 0);
        }
    };

    const toggleFullscreen = () => {
        const container = containerRef.current;
        if (!container) return;

        if (!document.fullscreenElement) {
            container.requestFullscreen().catch(err => {
                alert(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
            });
        } else {
            document.exitFullscreen();
        }
    };

    const formatTime = (timeInSeconds: number) => {
        if (isNaN(timeInSeconds)) return "00:00";
        const minutes = Math.floor(timeInSeconds / 60);
        const seconds = Math.floor(timeInSeconds % 60);
        return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    };

    return (
        <div ref={containerRef} className="relative w-full max-w-3xl mx-auto group bg-black rounded-lg overflow-hidden">
            <video
                ref={videoRef}
                src={src}
                className="w-full h-auto aspect-video"
                onClick={togglePlay}
                playsInline
            />

            {hasEnded && (
              <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center text-white z-20">
                <CheckCircle className="w-16 h-16 text-green-500 mb-4" />
                <h3 className="text-2xl font-bold">Vídeo Concluído!</h3>
                <p className="text-muted-foreground">Seu progresso foi salvo. Você pode fechar ou assistir novamente.</p>
              </div>
            )}

            <div className={cn(
              "absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/70 to-transparent transition-opacity duration-300",
              hasEnded ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            )}>
                <Slider
                    value={[progress]}
                    onValueChange={handleProgressChange}
                    className={cn("w-full", !allowSeek && !hasEnded && "cursor-not-allowed")}
                    disabled={!allowSeek && !hasEnded}
                    aria-label="Video Progress"
                />
                 <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-3">
                        <Button variant="ghost" size="icon" onClick={togglePlay} className="text-white">
                            {isPlaying ? <Pause /> : <Play />}
                        </Button>
                         <div className="flex items-center gap-2">
                            <Button variant="ghost" size="icon" onClick={toggleMute} className="text-white">
                                {isMuted || volume === 0 ? <VolumeX /> : <Volume2 />}
                            </Button>
                             <Slider 
                                value={[isMuted ? 0 : volume * 100]}
                                onValueChange={handleVolumeChange}
                                className="w-24"
                                aria-label="Volume"
                             />
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-xs text-white">{formatTime(videoRef.current?.currentTime || 0)} / {formatTime(duration)}</span>
                        <Button variant="ghost" size="icon" onClick={toggleFullscreen} className="text-white">
                            <Maximize />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={onClose} className="text-white">
                            <XSquare />
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
