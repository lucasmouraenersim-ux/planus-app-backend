
"use client";

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Sparkles, Wand2, Upload, Moon, Zap, Award, Edit, Loader2, Camera } from 'lucide-react';
import { ImageComparer } from './ImageComparer';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext'; // Assuming you have AuthContext
import { uploadEnhancementRequest, type EnhancementType } from '@/actions/photo/uploadEnhancementRequest';

const enhancementOptions = [
  { id: 'upscale_leve', label: 'Upscale Leve', icon: Award },
  { id: 'noturna', label: 'Edição de foto Noturna', icon: Moon },
  { id: 'hdr', label: 'Edição de Foto em HDR', icon: Sparkles },
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
  const { appUser } = useAuth(); // Get logged-in user info
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [enhancedImage, setEnhancedImage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [aspectRatio, setAspectRatio] = useState('16 / 9');
  const [selectedEnhancement, setSelectedEnhancement] = useState<EnhancementType>('upscale_leve');
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

      const img = new window.Image();
      img.onload = () => {
        setAspectRatio(`${img.width} / ${img.height}`);
      };
      img.src = imageUrl;
    }
  };

  const handleSendForEnhancement = () => {
    if (!originalImage || !appUser) {
        toast({
            title: 'Ação Necessária',
            description: 'Por favor, faça o upload de uma imagem e esteja logado para continuar.',
            variant: 'destructive',
        });
        return;
    }

    setIsSubmitting(true);
    toast({
      title: 'Enviando sua foto...',
      description: 'Aguarde enquanto sua imagem é enviada para nossa equipe de edição.',
    });

    toDataURL(originalImage, async (dataUrl) => {
        try {
            const result = await uploadEnhancementRequest({ 
              photoDataUri: dataUrl,
              enhancementType: selectedEnhancement,
              userId: appUser.uid,
            });
            if (result.success) {
                toast({
                    title: 'Enviado com Sucesso!',
                    description: 'Sua foto está na fila para edição. Você será notificado quando estiver pronta.',
                });
                // Optionally clear the original image after successful submission
                // setOriginalImage(null); 
            } else {
                 throw new Error(result.message || "A solicitação falhou no servidor.");
            }
        } catch (error) {
            console.error("Enhancement request failed:", error);
            toast({
                title: 'Erro no Envio',
                description: 'Não foi possível enviar sua imagem para edição. Tente novamente.',
                variant: 'destructive',
            });
        } finally {
            setIsSubmitting(false);
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
              <h3 className="px-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">Tipos de Edição</h3>
               {enhancementOptions.map((option) => (
                <Button 
                  key={option.id}
                  variant={selectedEnhancement === option.id ? "secondary" : "ghost"}
                  className="w-full justify-start text-sm"
                  onClick={() => setSelectedEnhancement(option.id as EnhancementType)}
                  disabled={option.disabled}
                >
                  <option.icon className="mr-3 h-5 w-5 text-slate-400" />
                  {option.label}
                </Button>
              ))}
            </nav>
          </Card>
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col">
          <div 
            className="flex-1 mb-8 relative flex items-center justify-center bg-black/20 rounded-lg border-2 border-dashed border-slate-700"
            style={{ aspectRatio: aspectRatio }}
          >
             {!originalImage && (
                <div className="text-center text-slate-500">
                    <Camera className="h-16 w-16 mx-auto mb-4"/>
                    <p>Faça o upload de uma imagem para começar</p>
                </div>
            )}
            {originalImage && (
              <ImageComparer 
                original={originalImage}
                enhanced={enhancedImage || originalImage}
                originalHint="uploaded image"
                enhancedHint="enhanced image"
              />
            )}
            {isSubmitting && (
              <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center rounded-lg z-10">
                <Loader2 className="h-12 w-12 text-[#a855f7] animate-spin mb-4" />
                <p className="text-lg font-semibold">Enviando para edição...</p>
                <p className="text-sm text-slate-400">Sua imagem está sendo preparada para nossa equipe.</p>
              </div>
            )}
          </div>

          <footer className="w-full">
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button 
                size="lg" 
                className="bg-[#a855f7] hover:bg-[#a855f7]/90 text-white w-full sm:w-auto"
                onClick={handleSendForEnhancement}
                disabled={isSubmitting || !originalImage}
              >
                {isSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Wand2 className="mr-2 h-5 w-5" />}
                {isSubmitting ? 'Enviando...' : 'Enviar para Edição'}
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
