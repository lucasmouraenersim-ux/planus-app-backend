
"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Sparkles, Wand2, Upload, Moon, ZapOff, Award, Edit } from 'lucide-react';
import { ImageComparer } from './ImageComparer';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

const enhancementOptions = [
  { label: 'Clarear fotos noturnas', icon: Moon },
  { label: 'Remover Boom de raios', icon: ZapOff },
  { label: 'Aprimorar qualidade', icon: Award },
  { label: 'Edição profissional', icon: Edit },
];


export function PhotoEnhancer() {
  const [isEnhancing, setIsEnhancing] = useState(false);
  // Add state for images, comparison value, etc.

  return (
    <div className="min-h-screen bg-[#171821] text-white flex flex-col p-4 md:p-6 lg:p-8">
       <header className="text-center mb-8">
        <h1 className="text-4xl md:text-5xl font-bold mb-3">De Ficção Científica à Realidade</h1>
        <p className="text-lg text-slate-400">Aprimorando suas imagens com IA</p>
      </header>
      
      <div className="flex-1 flex gap-8">
        {/* Sidebar */}
        <aside className="w-64 flex-shrink-0 space-y-6">
          <Button size="lg" className="w-full bg-[#a855f7] hover:bg-[#a855f7]/90 text-white">
            <Upload className="mr-2 h-5 w-5" />
            Fazer Upload
          </Button>

          <Card className="bg-[#252630]/70 border-slate-700 text-slate-200">
            <nav className="p-4 space-y-2">
              <h3 className="px-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">Ferramentas de IA</h3>
               {enhancementOptions.map((option, index) => (
                <Button key={index} variant="ghost" className="w-full justify-start text-sm">
                  <option.icon className="mr-3 h-5 w-5 text-slate-400" />
                  {option.label}
                </Button>
              ))}
            </nav>
          </Card>
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col">
          <div className="flex-1 mb-8">
            <ImageComparer 
              original="https://placehold.co/800x500/333/ccc.png?text=Original"
              enhanced="https://placehold.co/800x500/555/fff.png?text=Aprimorada"
              originalHint="stormy sky landscape"
              enhancedHint="dramatic sky landscape"
            />
          </div>

          <footer className="w-full">
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button size="lg" className="bg-[#a855f7] hover:bg-[#a855f7]/90 text-white w-full sm:w-auto">
                <Wand2 className="mr-2 h-5 w-5" />
                Aprimorar Foto
              </Button>
              <Button size="lg" variant="outline" className="border-slate-600 hover:bg-slate-800 hover:text-white w-full sm:w-auto">
                <Download className="mr-2 h-5 w-5" />
                Baixar
              </Button>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
}
