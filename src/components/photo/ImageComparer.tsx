
"use client";

import { useState } from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface ImageComparerProps {
  original: string;
  enhanced: string;
  originalHint?: string;
  enhancedHint?: string;
}

export function ImageComparer({ original, enhanced, originalHint, enhancedHint }: ImageComparerProps) {
  const [sliderPosition, setSliderPosition] = useState(50);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSliderPosition(Number(e.target.value));
  };

  return (
    <div className="relative w-full h-full rounded-lg overflow-hidden border-2 border-slate-700 shadow-2xl">
      <div className="absolute inset-0">
        <Image 
          src={original} 
          alt="Original Image" 
          layout="fill" 
          objectFit="cover" // Alterado de 'contain' para 'cover'
          objectPosition="center"
          data-ai-hint={originalHint}
        />
      </div>
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}
      >
        <Image 
          src={enhanced} 
          alt="Enhanced Image" 
          layout="fill" 
          objectFit="cover" // Alterado de 'contain' para 'cover'
          objectPosition="center"
          data-ai-hint={enhancedHint}
        />
      </div>

      <div
        className="absolute inset-y-0 bg-white/50 w-1 cursor-ew-resize"
        style={{ left: `calc(${sliderPosition}% - 2px)` }}
      >
        <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-10 w-10 bg-white rounded-full flex items-center justify-center shadow-lg">
          <ChevronLeft className="h-5 w-5 text-slate-800" />
          <ChevronRight className="h-5 w-5 text-slate-800" />
        </div>
      </div>
      
      <input
        type="range"
        min="0"
        max="100"
        value={sliderPosition}
        onChange={handleSliderChange}
        className="absolute inset-0 w-full h-full cursor-ew-resize opacity-0"
        aria-label="Image comparison slider"
      />
    </div>
  );
}
