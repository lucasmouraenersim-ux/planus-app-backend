
"use client";
import React, { useRef, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Camera, RefreshCw, CheckCircle } from 'lucide-react';

interface CameraCaptureProps {
  onCapture: (file: File) => void;
  label: string;
}

export function CameraCapture({ onCapture, label }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsStreaming(true);
      }
    } catch (err) {
      console.error("Erro ao acessar camera:", err);
      alert("Não foi possível acessar a câmera. Verifique as permissões.");
    }
  };

  const stopCamera = () => {
    const stream = videoRef.current?.srcObject as MediaStream;
    stream?.getTracks().forEach(track => track.stop());
    setIsStreaming(false);
  };

  const takePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      if (context) {
        // Define tamanho do canvas igual ao video
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        context.drawImage(videoRef.current, 0, 0);
        
        const dataUrl = canvasRef.current.toDataURL('image/jpeg');
        setCapturedImage(dataUrl);
        
        // Converte para File para enviar pro Firebase
        canvasRef.current.toBlob((blob) => {
          if (blob) {
            const file = new File([blob], "camera-capture.jpg", { type: "image/jpeg" });
            onCapture(file);
          }
        }, 'image/jpeg');
        
        stopCamera();
      }
    }
  };

  const reset = () => {
    setCapturedImage(null);
    startCamera();
  };

    useEffect(() => {
        // Funcao de limpeza para parar a camera quando o componente é desmontado
        return () => {
            if (videoRef.current && videoRef.current.srcObject) {
                const stream = videoRef.current.srcObject as MediaStream;
                stream.getTracks().forEach(track => track.stop());
            }
        };
    }, []);

  return (
    <div className="flex flex-col items-center gap-3 bg-black/40 p-4 rounded-xl border border-white/10">
      <p className="text-sm font-bold text-white mb-2">{label}</p>
      
      <div className="relative w-full max-w-[300px] aspect-[4/3] bg-black rounded-lg overflow-hidden border-2 border-slate-700">
        {!capturedImage ? (
           <>
             {!isStreaming && (
                <div className="absolute inset-0 flex items-center justify-center">
                    <Button onClick={startCamera} variant="ghost" className="text-slate-400 hover:text-white flex flex-col gap-2">
                        <Camera className="w-8 h-8" />
                        <span>Ativar Câmera</span>
                    </Button>
                </div>
             )}
             <video ref={videoRef} autoPlay playsInline muted className={`w-full h-full object-cover ${!isStreaming ? 'hidden' : ''}`} />
           </>
        ) : (
           <img src={capturedImage} alt="Captura" className="w-full h-full object-cover" />
        )}
        <canvas ref={canvasRef} className="hidden" />
      </div>

      <div className="flex gap-2">
        {!capturedImage && isStreaming && (
            <Button onClick={takePhoto} className="bg-white text-black hover:bg-slate-200 rounded-full w-12 h-12 p-0 flex items-center justify-center">
                <div className="w-10 h-10 border-2 border-black rounded-full"></div>
            </Button>
        )}
        {capturedImage && (
            <div className="flex gap-2">
                <Button onClick={reset} size="sm" variant="outline" className="border-slate-600 text-slate-300">
                    <RefreshCw className="w-4 h-4 mr-2" /> Refazer
                </Button>
                <div className="flex items-center gap-2 px-4 bg-green-900/30 text-green-400 border border-green-900 rounded text-sm font-bold">
                    <CheckCircle className="w-4 h-4" /> Foto Pronta
                </div>
            </div>
        )}
      </div>
    </div>
  );
}
