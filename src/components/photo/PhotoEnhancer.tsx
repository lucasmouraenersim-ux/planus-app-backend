
"use client";

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Sparkles, Wand2, Upload, Moon, ZapOff, Award, Edit, Loader2 } from 'lucide-react';
import { ImageComparer } from './ImageComparer';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { enhancePhoto } from '@/ai/flows/enhance-photo-flow'; // Import the new AI flow

const enhancementOptions = [
  { label: 'Clarear fotos noturnas', icon: Moon },
  { label: 'Remover Boom de raios', icon: ZapOff },
  { label: 'Aprimorar qualidade', icon: Award },
  { label: 'Edição profissional', icon: Edit },
];

function toDataURL(url: string, callback: (dataUrl: string) => void) {
  const xhr = new XMLHttpRequest();
  xhr.onload = function () {
    const reader = new FileReader();
    reader.onloadend = function () {
      callback(reader.result as string);
    };
    reader.readAsDataURL(xhr.response);
  };
  xhr.open('GET', url);
  xhr.responseType = 'blob';
  xhr.send();
}


export function PhotoEnhancer() {
  const { toast } = useToast();
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [enhancedImage, setEnhancedImage] = useState<string | null>(null);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [aspectRatio, setAspectRatio] = useState('16 / 9');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setEnhancedImage(null); // Reset enhanced image on new upload
      const imageUrl = URL.createObjectURL(file);
      setOriginalImage(imageUrl);

      // Get image dimensions to set aspect ratio
      const img = new window.Image();
      img.onload = () => {
        setAspectRatio(`${img.width} / ${img.height}`);
      };
      img.src = imageUrl;
    }
  };

  const handleEnhanceClick = () => {
    if (!originalImage) return;

    setIsEnhancing(true);
    toast({
      title: 'Aprimorando imagem...',
      description: 'Aguarde, a mágica da IA está acontecendo.',
    });

    toDataURL(originalImage, async (dataUrl) => {
        try {
            const result = await enhancePhoto({ photoDataUri: dataUrl });
            if (result.imageUrl) {
                setEnhancedImage(result.imageUrl);
                toast({
                    title: 'Sucesso!',
                    description: 'Sua imagem foi aprimorada.',
                });
            } else {
                 throw new Error("A IA não retornou uma imagem.");
            }
        } catch (error) {
            console.error("Enhancement failed:", error);
            toast({
                title: 'Erro no Aprimoramento',
                description: 'Não foi possível aprimorar a imagem. Tente novamente.',
                variant: 'destructive',
            });
        } finally {
            setIsEnhancing(false);
        }
    });
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
          <div className="flex-1 mb-8 relative flex items-center justify-center">
            <div 
              className="relative w-full max-w-full max-h-full"
              style={{ aspectRatio: aspectRatio }}
            >
              <ImageComparer 
                original={originalImage || "https://placehold.co/800x500/333/ccc.png?text=Original"}
                enhanced={enhancedImage || originalImage || "https://placehold.co/800x500/333/ccc.png?text=Original"}
                originalHint="uploaded image"
                enhancedHint="enhanced image"
              />
            </div>
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
