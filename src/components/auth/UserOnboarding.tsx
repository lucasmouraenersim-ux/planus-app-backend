"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { TermsDialog } from '@/components/auth/TermsDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { uploadFile } from '@/lib/firebase/storage';
import { updateDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Camera, FileText, CheckCircle, Clock, AlertTriangle, Send, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { CameraCapture } from '@/components/ui/camera-capture';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function WaitScreen() {
    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
            <div className="max-w-md text-center">
                <Clock className="w-20 h-20 text-yellow-500 mx-auto mb-6 animate-pulse" />
                <h2 className="text-2xl font-bold text-white mb-2">Análise em Andamento</h2>
                <p className="text-slate-400 mb-8">Recebemos seus documentos. Nossa equipe fará a validação em breve.</p>
                <div className="bg-slate-900 p-4 rounded-lg border border-slate-800 inline-block text-left">
                    <p className="text-xs text-slate-500 uppercase font-bold mb-1">Dúvidas?</p>
                    <p className="text-sm text-white flex items-center gap-2"><Send className="w-4 h-4" /> (65) 98101-4125</p>
                    <a href="https://wa.me/5565981014125" target="_blank" rel="noopener noreferrer" className="block w-full bg-emerald-600 text-white text-center py-2 rounded mt-3 text-sm font-bold">Falar no WhatsApp</a>
                </div>
            </div>
        </div>
    )
}

function RejectedScreen({ reason }: { reason?: string }) {
    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
            <div className="max-w-md text-center">
                <AlertTriangle className="w-20 h-20 text-red-500 mx-auto mb-6" />
                <h2 className="text-2xl font-bold text-white mb-2">Cadastro Reprovado</h2>
                <p className="text-slate-400 mb-4">Infelizmente não pudemos validar seu cadastro.</p>
                {reason && (
                    <div className="bg-red-950/30 border border-red-900/50 p-4 rounded text-red-200 text-sm mb-6">
                        Motivo: {reason}
                    </div>
                )}
                <Button variant="outline" onClick={() => window.location.reload()}>Tentar Novamente</Button>
            </div>
        </div>
    )
}

export function UserOnboarding() {
  const { appUser, acceptUserTerms, refreshUsers } = useAuth();
  const { toast } = useToast();
  
  const [step, setStep] = useState<'terms' | 'docs'>('terms');
  const [docFile, setDocFile] = useState<File | null>(null);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (appUser?.termsAcceptedAt) {
      setStep('docs');
    } else {
      setStep('terms');
    }
  }, [appUser]);

  if (!appUser) return null;

  if (appUser.status === 'pending_approval') {
      return <WaitScreen />;
  }

  if (appUser.status === 'rejected') {
      return <RejectedScreen reason={appUser.adminNotes} />;
  }

  const handleTermsAccepted = async () => {
    await acceptUserTerms();
    await refreshUsers();
    setStep('docs');
  }

  const handleUploadDocs = async () => {
      if (!docFile || !selfieFile || !appUser) {
          toast({ title: "Faltam arquivos", description: "Por favor, envie o documento e a selfie.", variant: "destructive" });
          return;
      }
      setLoading(true);
      try {
          const docUrl = await uploadFile(docFile, `kyc/${appUser.uid}/document.jpg`);
          const selfieUrl = await uploadFile(selfieFile, `kyc/${appUser.uid}/selfie.jpg`);

          await updateDoc(doc(db, 'users', appUser.uid), {
              documentUrl: docUrl,
              selfieUrl: selfieUrl,
              status: 'pending_approval',
              kycSubmittedAt: new Date().toISOString()
          });

          toast({ title: "Documentos Enviados!", description: "Aguarde a análise da nossa equipe.", className: "bg-green-600 text-white" });
          await refreshUsers();
      } catch (error) {
          console.error(error);
          toast({ title: "Erro no envio", description: "Não foi possível enviar seus documentos. Tente novamente.", variant: "destructive" });
      } finally {
          setLoading(false);
      }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl animate-in fade-in zoom-in-95">
          <div className="text-center mb-8">
              <h1 className="text-2xl font-bold text-white">Validação de Identidade</h1>
              <p className="text-slate-400 text-sm mt-2">Para sua segurança e conformidade legal, precisamos validar quem você é.</p>
          </div>

          {step === 'terms' && (
              <div className="text-center animate-in fade-in">
                  <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
                  <p className="text-slate-300 mb-6">Primeiro, você precisa aceitar nossos termos de uso e responsabilidade legal.</p>
                  <TermsDialog isOpen={true} onAccept={handleTermsAccepted} />
              </div>
          )}

          {step === 'docs' && (
              <div className="space-y-6">
                <div className="bg-slate-950 p-4 rounded-lg border border-slate-800">
                    <Label className="text-white mb-4 block flex items-center gap-2">
                        <Camera className="w-4 h-4 text-cyan-500"/> Selfie de Validação
                    </Label>
                    
                    <Tabs defaultValue="camera" className="w-full">
                      <TabsList className="grid w-full grid-cols-2 bg-slate-900">
                        <TabsTrigger value="camera">Usar Câmera</TabsTrigger>
                        <TabsTrigger value="upload">Fazer Upload</TabsTrigger>
                      </TabsList>
                      
                      <TabsContent value="camera">
                          <CameraCapture 
                              label="Tire uma foto do seu rosto agora" 
                              onCapture={(file) => setSelfieFile(file)} 
                          />
                      </TabsContent>
                      
                      <TabsContent value="upload">
                          <Input type="file" accept="image/*" onChange={e => setSelfieFile(e.target.files?.[0] || null)} className="bg-slate-900 border-slate-700 text-slate-300 mt-2" />
                          <p className="text-[10px] text-slate-500 mt-1">Envie uma foto recente e nítida.</p>
                      </TabsContent>
                    </Tabs>
                </div>

                <div className="bg-slate-950 p-4 rounded-lg border border-slate-800">
                     <Label className="text-white mb-4 block flex items-center gap-2">
                        <FileText className="w-4 h-4 text-cyan-500"/> Documento (Frente)
                    </Label>
                    
                    <Tabs defaultValue="upload" className="w-full">
                      <TabsList className="grid w-full grid-cols-2 bg-slate-900">
                        <TabsTrigger value="upload">Upload PDF/Foto</TabsTrigger>
                        <TabsTrigger value="camera">Usar Câmera</TabsTrigger>
                      </TabsList>

                       <TabsContent value="upload">
                          <Input type="file" accept="image/*,application/pdf" onChange={e => setDocFile(e.target.files?.[0] || null)} className="bg-slate-900 border-slate-700 text-slate-300 mt-2" />
                       </TabsContent>
                       
                       <TabsContent value="camera">
                          <CameraCapture 
                              label="Posicione o documento na câmera" 
                              onCapture={(file) => setDocFile(file)} 
                          />
                      </TabsContent>
                    </Tabs>
                </div>

                <Button onClick={handleUploadDocs} disabled={loading || !docFile || !selfieFile} className="w-full bg-cyan-600 hover:bg-cyan-500 h-12 text-lg mt-4">
                    {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2"/> : null}
                    {loading ? "Enviando..." : "Enviar para Análise"}
                </Button>
              </div>
          )}
      </div>
    </div>
  );
}
