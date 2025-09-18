
"use client";

import React, { useRef, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Play, Pause, Maximize, Volume2, VolumeX, XSquare } from 'lucide-react';
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
    
    // This effect handles video events
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

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
            onVideoEnd();
        };

        video.addEventListener('play', handlePlay);
        video.addEventListener('pause', handlePause);
        video.addEventListener('timeupdate', handleTimeUpdate);
        video.addEventListener('durationchange', handleDurationChange);
        video.addEventListener('ended', handleEnded);

        // Attempt to play on mount only once
        if (video.paused) {
          video.play().catch(error => {
            // Autoplay is often blocked, which is fine. The user can click play.
            if (error.name !== 'NotAllowedError') {
              console.error("Video play error:", error);
            }
          });
        }


        return () => {
            video.removeEventListener('play', handlePlay);
            video.removeEventListener('pause', handlePause);
            video.removeEventListener('timeupdate', handleTimeUpdate);
            video.removeEventListener('durationchange', handleDurationChange);
            video.removeEventListener('ended', handleEnded);
        };
    }, [onVideoEnd, src]); // Depend on src to re-run if the video source changes

    const togglePlay = () => {
        if (videoRef.current) {
            videoRef.current.paused ? videoRef.current.play() : videoRef.current.pause();
        }
    };

    const handleProgressChange = (value: number[]) => {
        if (videoRef.current && allowSeek) {
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
                playsInline // Important for mobile browsers
            />
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <Slider
                    value={[progress]}
                    onValueChange={handleProgressChange}
                    className={cn("w-full", !allowSeek && "cursor-not-allowed")}
                    disabled={!allowSeek}
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
