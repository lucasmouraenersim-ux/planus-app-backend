
"use client";

import React, { useRef, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Play, Pause, Maximize, Volume2, VolumeX, XSquare } from 'lucide-react';

interface CustomVideoPlayerProps {
    src: string;
    onClose: () => void;
    onVideoEnd: () => void;
    allowSeek: boolean;
}

export function CustomVideoPlayer({ src, onClose, onVideoEnd, allowSeek }: CustomVideoPlayerProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);
    const hasSeeked = useRef(false);

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const handlePlay = () => setIsPlaying(true);
        const handlePause = () => setIsPlaying(false);
        const handleTimeUpdate = () => {
            if (video) {
                setProgress((video.currentTime / video.duration) * 100);
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
        const handleSeeking = (e: Event) => {
            if (!allowSeek && !hasSeeked.current && video) {
                const targetTime = video.currentTime;
                // A very small buffer to allow the initial play click
                if (targetTime > 1) { 
                    e.preventDefault();
                    // This is a bit of a hack. We can't perfectly stop seeking,
                    // but we can try to revert it.
                    // This logic is tricky and might not be perfect.
                    // For now, we'll just log it. A better approach is disabling the progress bar UI.
                    console.log("Seeking is disabled for the first watch.");
                    // video.currentTime = video.currentTime; // Re-setting to the same time can sometimes cancel the seek.
                }
            }
        };


        video.addEventListener('play', handlePlay);
        video.addEventListener('pause', handlePause);
        video.addEventListener('timeupdate', handleTimeUpdate);
        video.addEventListener('durationchange', handleDurationChange);
        video.addEventListener('ended', handleEnded);
        video.addEventListener('seeking', handleSeeking);

        return () => {
            video.removeEventListener('play', handlePlay);
            video.removeEventListener('pause', handlePause);
            video.removeEventListener('timeupdate', handleTimeUpdate);
            video.removeEventListener('durationchange', handleDurationChange);
            video.removeEventListener('ended', handleEnded);
            video.removeEventListener('seeking', handleSeeking);
        };
    }, [allowSeek, onVideoEnd]);

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
            videoRef.current.muted = !isMuted;
            setIsMuted(!isMuted);
            if (!isMuted) setVolume(0); else setVolume(1);
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

    const formatTime = (timeInSeconds: number) => {
        const minutes = Math.floor(timeInSeconds / 60);
        const seconds = Math.floor(timeInSeconds % 60);
        return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    };

    return (
        <div className="relative w-full max-w-3xl mx-auto group bg-black rounded-lg overflow-hidden">
            <video
                ref={videoRef}
                src={src}
                className="w-full h-auto aspect-video"
                onClick={togglePlay}
                autoPlay
            />
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <div className={`flex items-center gap-4 ${!allowSeek ? 'pointer-events-none opacity-60' : ''}`}>
                    <Slider
                        value={[progress]}
                        onValueChange={handleProgressChange}
                        className="w-full"
                        disabled={!allowSeek}
                        aria-label="Video Progress"
                    />
                </div>
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
                                value={[volume * 100]}
                                onValueChange={handleVolumeChange}
                                className="w-24"
                                aria-label="Volume"
                             />
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-xs text-white">{formatTime(videoRef.current?.currentTime || 0)} / {formatTime(duration)}</span>
                        <Button variant="ghost" size="icon" onClick={onClose} className="text-white">
                            <XSquare />
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
