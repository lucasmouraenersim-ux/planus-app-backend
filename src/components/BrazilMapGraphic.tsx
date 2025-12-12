"use client";

import React from 'react';
import { statesData } from '@/data/state-data';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface BrazilMapGraphicProps {
  selectedStateCode: string | null;
  hoveredStateCode: string | null;
  onStateClick: (stateCode: string) => void;
  onStateHover: (stateCode: string | null) => void;
  activeStates?: string[];
  activeColor?: string;
}

export function BrazilMapGraphic({ 
  selectedStateCode, 
  hoveredStateCode, 
  onStateClick, 
  onStateHover,
  activeStates = [], 
  activeColor = '#06b6d4'
}: BrazilMapGraphicProps) {

  const getStyle = (uf: string) => {
    const isSelected = selectedStateCode === uf;
    const isHovered = hoveredStateCode === uf;
    
    const isInactive = activeStates.length > 0 && !activeStates.includes(uf);

    // Se o parceiro não atende, fica escuro
    if (isInactive) {
        return { 
          fill: '#1e293b', 
          opacity: 0.3, 
          stroke: '#334155', 
          strokeWidth: 0.5 
        };
    }

    // Se selecionado, brilha
    if (isSelected) {
        return { 
          fill: activeColor, 
          opacity: 1, 
          stroke: '#ffffff', 
          strokeWidth: 2, 
          filter: `drop-shadow(0 0 15px ${activeColor})`,
          zIndex: 10 
        };
    }
    
    // Hover
    if (isHovered) {
        return { 
          fill: activeColor, 
          opacity: 0.7, 
          stroke: '#ffffff', 
          strokeWidth: 1, 
          cursor: 'pointer' 
        };
    }

    // Normal (azul padrão)
    return { 
      fill: '#3b82f6', 
      opacity: 1, 
      stroke: '#0f172a', 
      strokeWidth: 1, 
      cursor: 'pointer' 
    };
  };

  return (
    <div className="relative w-full h-full flex items-center justify-center p-4">
      <svg
        viewBox="0 0 600 600"
        className="w-full h-full max-h-[600px]"
        xmlns="http://www.w3.org/2000/svg"
        style={{ overflow: 'visible' }}
      >
        <g transform="scale(1.2) translate(-20, -40)">
          {statesData.map((state) => (
             <TooltipProvider key={state.abbreviation}>
               <Tooltip>
                 <TooltipTrigger asChild>
                   <path
                     id={state.abbreviation}
                     d={state.pathD}
                     style={getStyle(state.abbreviation)}
                     className="transition-all duration-300 ease-out"
                     onClick={() => onStateClick(state.abbreviation)}
                     onMouseEnter={() => onStateHover(state.abbreviation)}
                     onMouseLeave={() => onStateHover(null)}
                   />
                 </TooltipTrigger>
                 <TooltipContent className="bg-slate-900 border-white/10 text-white font-bold">
                   <p>{state.name}</p>
                 </TooltipContent>
               </Tooltip>
             </TooltipProvider>
          ))}
        </g>
      </svg>
    </div>
  );
}