
"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Sparkles, Wand2 } from 'lucide-react';
import { ImageComparer } from './ImageComparer';

export function PhotoEnhancer() {
  const [isEnhancing, setIsEnhancing] = useState(false);
  // Add state for images, comparison value, etc.

  return (
    <div className="min-h-screen bg-[#171821] text-white flex flex-col items-center justify-center p-4 md:p-8">
      <header className="text-center mb-10">
        <h1 className="text-4xl md:text-5xl font-bold mb-3">De Ficção Científica à Realidade</h1>
        <p className="text-lg text-slate-400">Aprimorando suas imagens com IA</p>
      </header>
      
      <main className="w-full max-w-4xl mb-12">
        <ImageComparer 
          original="https://placehold.co/800x500/333/ccc.png?text=Original"
          enhanced="https://placehold.co/800x500/555/fff.png?text=Aprimorada"
          originalHint="stormy sky landscape"
          enhancedHint="dramatic sky landscape"
        />
      </main>

      <footer className="w-full max-w-4xl">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
          <Button size="lg" className="bg-[#a855f7] hover:bg-[#a855f7]/90 text-white w-full sm:w-auto">
            <Wand2 className="mr-2 h-5 w-5" />
            Melhorar Foto
          </Button>
          <Button size="lg" variant="outline" className="border-slate-600 hover:bg-slate-800 hover:text-white w-full sm:w-auto">
            <Download className="mr-2 h-5 w-5" />
            Baixar
          </Button>
        </div>

        <div className="text-center">
            <p className="text-sm uppercase tracking-widest text-slate-500 mb-4">COMO VISTO EM</p>
            <div className="flex justify-center items-center gap-8 opacity-70">
                <span className="font-semibold">How-To Geek</span>
                <span className="font-semibold">Y Combinator</span>
                <span className="font-semibold">IT'S FOSS</span>
            </div>
        </div>
      </footer>
    </div>
  );
}
