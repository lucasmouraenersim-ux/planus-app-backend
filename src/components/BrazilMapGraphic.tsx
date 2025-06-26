// /src/components/BrazilMapGraphic.tsx
"use client";

import { cn } from "@/lib/utils";
import { statesData } from "@/data/state-data";
import type { StateInfo } from "@/types";

interface BrazilMapGraphicProps {
  selectedStateCode: string | null;
  hoveredStateCode: string | null;
  onStateClick: (stateCode: string) => void;
  onStateHover: (stateCode: string | null) => void;
  className?: string;
}

export function BrazilMapGraphic({
  selectedStateCode,
  hoveredStateCode,
  onStateClick,
  onStateHover,
  className,
}: BrazilMapGraphicProps) {

  const getFillColor = (state: StateInfo, isCircle: boolean = false) => {
    if (!state.available) {
      return "fill-muted opacity-70";
    }
    if (selectedStateCode === state.code || hoveredStateCode === state.code) {
      return "fill-accent";
    }
    if (isCircle) {
      return "fill-primary opacity-70";
    }
    return "fill-primary";
  };

  return (
    <svg
      version="1.1"
      id="svg-map"
      xmlns="http://www.w3.org/2000/svg"
      xmlnsXlink="http://www.w3.org/1999/xlink"
      x="0px"
      y="0px"
      width="100%"
      viewBox="0 0 450 460"
      enableBackground="new 0 0 450 460"
      xmlSpace="preserve"
      className={cn("max-w-xl w-full", className)}
      aria-label="Interactive map of Brazil"
    >
      <g>
        {statesData.map((state) => {
          const isAvailable = state.available;
          return (
            <g
              key={state.code}
              onClick={() => {
                if (isAvailable) {
                  onStateClick(state.code);
                }
              }}
              onMouseEnter={() => {
                if (isAvailable) {
                  onStateHover(state.code);
                }
              }}
              onMouseLeave={() => {
                if (isAvailable) {
                  onStateHover(null);
                }
              }}
              className={cn(
                "focus:outline-none focus:ring-2 focus:ring-ring rounded-sm",
                isAvailable ? "cursor-pointer group" : "cursor-not-allowed"
              )}
              aria-label={`${state.name}${isAvailable ? "" : " - Indisponível"}`}
              tabIndex={isAvailable ? 0 : -1}
              onKeyDown={(e) => {
                if (isAvailable && (e.key === "Enter" || e.key === " ")) {
                  e.preventDefault();
                  onStateClick(state.code);
                }
              }}
            >
              <title>{`${state.name}${isAvailable ? "" : " (Indisponível)"}`}</title>
              <path
                d={state.pathD}
                stroke="hsl(var(--card))"
                strokeWidth="1.0404"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={cn(
                  "transition-colors duration-200 ease-in-out",
                  getFillColor(state)
                )}
              />
              {state.circlePathD && (
                <path
                  d={state.circlePathD}
                  className={cn(
                    "transition-colors duration-200 ease-in-out",
                    getFillColor(state, true)
                  )}
                />
              )}
              <text
                transform={state.textTransform}
                className={cn(
                  "font-headline text-[10px] sm:text-xs pointer-events-none select-none",
                  isAvailable ? "fill-white" : "fill-muted-foreground opacity-80"
                )}
                style={{ userSelect: 'none' }}
                dominantBaseline="middle"
                textAnchor="middle"
              >
                {state.abbreviation}
              </text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}
