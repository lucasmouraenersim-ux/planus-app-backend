"use client";

import React from 'react';
import { statesData } from '@/data/state-data';
import type { StateInfo } from "@/types";

interface BrazilMapGraphicProps {
  selectedStateCode: string | null;
  hoveredStateCode: string | null;
  onStateClick: (stateCode: string) => void;
  onStateHover: (stateCode: string | null) => void;
  activeStates?: string[]; // Lista de siglas ativas (ex: ['MT', 'GO'])
  activeColor?: string;    // Cor do parceiro selecionado
}

export function BrazilMapGraphic({ 
  selectedStateCode, 
  hoveredStateCode, 
  onStateClick, 
  onStateHover,
  activeStates = [], 
  activeColor = '#06b6d4' // Ciano padrão
}: BrazilMapGraphicProps) {

  // Função para decidir a cor de cada estado
  const getStateColor = (state: StateInfo) => {
    const isSelected = selectedStateCode === state.abbreviation;
    const isHovered = hoveredStateCode === state.code;
    
    // Se tiver filtro de parceiro ativo e o estado NÃO estiver na lista -> Cinza Escuro
    const isInactiveByPartner = activeStates.length > 0 && !activeStates.includes(state.abbreviation);

    if (isInactiveByPartner) {
        return '#1e293b'; // Slate-800 (Apagado)
    }

    if (isSelected) return activeColor; // Cor do parceiro (ou ciano)
    if (isHovered) return activeColor; // Cor do parceiro com opacidade (controlada no CSS se quiser)
    
    // Estado disponível padrão
    return '#3b82f6'; // Azul do botão "Gerar Proposta"
  };

  const getStateOpacity = (state: StateInfo) => {
     const isInactiveByPartner = activeStates.length > 0 && !activeStates.includes(state.abbreviation);
     if (isInactiveByPartner) return 0.3; // Bem transparente

     if (selectedStateCode === state.abbreviation) return 1;
     if (hoveredStateCode === state.code) return 0.8;
     
     // Se o parceiro atende esse estado, destaca ele um pouco
     if (activeStates.length > 0 && activeStates.includes(state.abbreviation)) return 0.6;
     
     return 0.4;
  };

  return (
    <div className="relative w-full h-full flex items-center justify-center p-4">
      <svg
        viewBox="0 0 450 460"
        className="w-full h-full max-h-[600px] drop-shadow-2xl"
        style={{ filter: 'drop-shadow(0 0 20px rgba(0,0,0,0.5))' }}
      >
        <g transform="scale(1) translate(0, 0)">
           {statesData.map((state) => (
             <g key={state.code}>
                <path
                d={state.pathD}
                fill={getStateColor(state)}
                fillOpacity={getStateOpacity(state)}
                stroke={selectedStateCode === state.abbreviation ? '#ffffff' : '#0f172a'}
                strokeWidth={selectedStateCode === state.abbreviation ? 2 : 1}
                className="transition-all duration-300 ease-in-out cursor-pointer hover:brightness-110"
                onClick={() => onStateClick(state.abbreviation)}
                onMouseEnter={() => onStateHover(state.code)}
                onMouseLeave={() => onStateHover(null)}
                />
                {state.circlePathD && (
                    <path
                        d={state.circlePathD}
                        fill={getStateColor(state)}
                        fillOpacity={getStateOpacity(state)}
                        stroke={selectedStateCode === state.abbreviation ? '#ffffff' : '#0f172a'}
                        strokeWidth={selectedStateCode === state.abbreviation ? 1 : 0.5}
                        className="transition-all duration-300 ease-in-out cursor-pointer"
                        onClick={() => onStateClick(state.abbreviation)}
                        onMouseEnter={() => onStateHover(state.code)}
                        onMouseLeave={() => onStateHover(null)}
                    />
                )}
             </g>
           ))}
           
           {/* Labels (Siglas) */}
           {statesData.map((state) => {
              const isActive = activeStates.length === 0 || activeStates.includes(state.abbreviation);
              if (!isActive) return null;
              
              const isSelected = selectedStateCode === state.abbreviation;

              return (
                 <text
                    key={`label-${state.code}`}
                    transform={state.textTransform}
                    className="font-headline text-[10px] sm:text-xs pointer-events-none select-none transition-all duration-300"
                    style={{
                      fill: isSelected ? '#FFFFFF' : '#94a3b8',
                      opacity: isSelected ? 1 : 0.7,
                      textShadow: isSelected ? '0 0 5px rgba(255,255,255,0.7)' : 'none',
                    }}
                    dominantBaseline="middle"
                    textAnchor="middle"
                  >
                    {state.abbreviation}
                  </text>
              );
           })}
        </g>
      </svg>
    </div>
  );
}
