"use client";
import { EsriMap } from '@/components/meteorologia/EsriMap';
import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';

const LoadingSpinner = () => (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-gray-900 text-white">
        <div className="flex items-center justify-center space-x-1">
            <div className="h-4 w-2 animate-pulse bg-white" style={{ animationDelay: '0s' }}></div>
            <div className="h-6 w-2 animate-pulse bg-white" style={{ animationDelay: '0.1s' }}></div>
            <div className="h-8 w-2 animate-pulse bg-white" style={{ animationDelay: '0.2s' }}></div>
            <div className="h-6 w-2 animate-pulse bg-white" style={{ animationDelay: '0.3s' }}></div>
            <div className="h-4 w-2 animate-pulse bg-white" style={{ animationDelay: '0.4s' }}></div>
        </div>
        <p className="mt-4 text-sm">Carregando mapa meteorológico...</p>
    </div>
);


export default function MeteorologiaPage() {
  return (
    <div style={{ width: '100vw', height: '100vh', margin: 0, padding: 0, overflow: 'hidden', backgroundColor: '#4A90E2' }}>
        <Suspense fallback={<LoadingSpinner />}>
            <EsriMap />
        </Suspense>
    </div>
  );
}
