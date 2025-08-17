
"use client";

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Sparkles, Wand2, Upload, Moon, ZapOff, Award, Edit, Loader2 } from 'lucide-react';
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
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [enhancedImage, setEnhancedImage] = useState<string | null>(null);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setEnhancedImage(null); // Reset enhanced image on new upload
      setOriginalImage(URL.createObjectURL(file));
    }
  };

  const handleEnhanceClick = () => {
    if (!originalImage) return;
    setIsEnhancing(true);
    // Simulate AI enhancement
    setTimeout(() => {
      // In a real app, this would be the URL returned from the AI service
      setEnhancedImage("https://placehold.co/800x500/171821/FFFFFF?text=Aprimorada");
      setIsEnhancing(false);
    }, 2000);
  };
  
  const handleDownload = () => {
    if (!enhancedImage) return;
    const link = document.createElement('a');
    link.href = enhancedImage;
    link.download = 'foto-aprimorada.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div className="min-h-screen bg-[#171821] text-white flex flex-col p-4 md:p-6 lg:p-8">
       <header className="text-center mb-8">
        <h1 className="text-4xl md:text-5xl font-bold mb-3">De Ficção Científica à Realidade</h1>
        <p className="text-lg text-slate-400">Aprimorando suas imagens com IA</p>
      </header>
      
      <div className="flex-1 flex flex-col md:flex-row gap-8">
        {/* Sidebar */}
        <aside className="w-full md:w-64 flex-shrink-0 space-y-6">
           <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            accept="image/*"
          />
          <Button size="lg" className="w-full bg-[#a855f7] hover:bg-[#a855f7]/90 text-white" onClick={handleUploadClick}>
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
          <div className="flex-1 mb-8 relative">
            <ImageComparer 
              original={originalImage || "https://placehold.co/800x500/333/ccc.png?text=Original"}
              enhanced={enhancedImage || originalImage || "https://placehold.co/800x500/333/ccc.png?text=Original"}
              originalHint="uploaded image"
              enhancedHint="enhanced image"
            />
            {isEnhancing && (
              <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center rounded-lg z-10">
                <Loader2 className="h-12 w-12 text-[#a855f7] animate-spin mb-4" />
                <p className="text-lg font-semibold">Aprimorando sua imagem...</p>
                <p className="text-sm text-slate-400">Aguarde, a mágica da IA está acontecendo.</p>
              </div>
            )}
          </div>

          <footer className="w-full">
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button 
                size="lg" 
                className="bg-[#a855f7] hover:bg-[#a855f7]/90 text-white w-full sm:w-auto"
                onClick={handleEnhanceClick}
                disabled={isEnhancing || !originalImage}
              >
                {isEnhancing ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Wand2 className="mr-2 h-5 w-5" />}
                {isEnhancing ? 'Aprimorando...' : 'Aprimorar Foto'}
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                className="border-slate-600 hover:bg-slate-800 hover:text-white w-full sm:w-auto"
                onClick={handleDownload}
                disabled={!enhancedImage}
              >
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
