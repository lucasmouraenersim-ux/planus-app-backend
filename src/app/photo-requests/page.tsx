"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, orderBy } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, ShieldAlert, Download, Upload, Image as ImageIcon } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import Image from 'next/image';
import { useToast } from '@/hooks/use-toast';
import { uploadFile } from '@/lib/firebase/storage';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';


interface EnhancementRequest {
  id: string;
  userId: string;
  userName: string;
  userPhoto: string | null;
  originalImageUrl: string;
  enhancedImageUrl: string | null;
  enhancementType: string;
  status: 'pending' | 'completed';
  createdAt: string;
}

export default function PhotoRequestsPage() {
  const { userAppRole, isLoadingAuth } = useAuth();
  const { toast } = useToast();
  const [requests, setRequests] = useState<EnhancementRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [uploadingFileId, setUploadingFileId] = useState<string | null>(null);

  useEffect(() => {
    if (isLoadingAuth) return;
    if (userAppRole !== 'superadmin' && userAppRole !== 'admin') {
      setIsLoading(false);
      return;
    }

    const q = query(collection(db, 'photoEnhancementRequests'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const fetchedRequests: EnhancementRequest[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        fetchedRequests.push({
          id: doc.id,
          ...data,
          createdAt: (data.createdAt as any).toDate().toISOString(),
        } as EnhancementRequest);
      });
      setRequests(fetchedRequests);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching photo requests:", error);
      toast({ title: "Erro ao Carregar", description: "Não foi possível buscar as solicitações.", variant: 'destructive' });
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [userAppRole, isLoadingAuth, toast]);
  
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, requestId: string) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingFileId(requestId);
    toast({ title: 'Enviando imagem editada...' });

    try {
      const filePath = `enhancement_results/${requestId}/enhanced_${file.name}`;
      const downloadURL = await uploadFile(file, filePath);
      
      const requestDocRef = doc(db, 'photoEnhancementRequests', requestId);
      await updateDoc(requestDocRef, {
        enhancedImageUrl: downloadURL,
        status: 'completed',
      });

      toast({ title: 'Sucesso!', description: 'Imagem editada enviada e solicitação marcada como concluída.' });
    } catch (error) {
      console.error('Error uploading enhanced image:', error);
      toast({ title: 'Erro no Upload', description: 'Não foi possível enviar a imagem editada.', variant: 'destructive' });
    } finally {
      setUploadingFileId(null);
    }
  };

  if (isLoadingAuth || isLoading) {
    return (
      <div className="flex justify-center items-center h-[calc(100vh-56px)]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (userAppRole !== 'superadmin' && userAppRole !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-56px)] text-destructive p-4 text-center">
        <ShieldAlert size={64} className="mb-4" />
        <h1 className="text-2xl font-bold">Acesso Negado</h1>
        <p>Você não tem permissão para acessar esta página.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-primary flex items-center">
          <ImageIcon className="mr-3 h-8 w-8" />
          Solicitações de Edição de Foto
        </h1>
        <p className="text-muted-foreground mt-2">
          Gerencie as fotos enviadas pelos usuários para aprimoramento.
        </p>
      </header>

      {requests.length === 0 ? (
        <p className="text-center text-muted-foreground mt-16">Nenhuma solicitação de edição de foto encontrada.</p>
      ) : (
        <div className="space-y-6">
          {requests.map((req) => (
            <Card key={req.id} className="bg-card/70 backdrop-blur-lg">
              <CardHeader className="flex flex-row justify-between items-start">
                <div>
                  <CardTitle className="flex items-center gap-3">
                     <Avatar>
                        <AvatarImage src={req.userPhoto || undefined} alt={req.userName} />
                        <AvatarFallback>{req.userName.charAt(0)}</AvatarFallback>
                    </Avatar>
                    {req.userName}
                  </CardTitle>
                  <CardDescription>
                    Solicitado em: {format(parseISO(req.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })} | Tipo: <span className="font-semibold text-primary">{req.enhancementType}</span>
                  </CardDescription>
                </div>
                 <Badge variant={req.status === 'completed' ? 'default' : 'secondary'} className={req.status === 'completed' ? 'bg-green-600' : ''}>
                    {req.status === 'completed' ? 'Concluído' : 'Pendente'}
                </Badge>
              </CardHeader>
              <CardContent className="grid md:grid-cols-2 gap-6 items-center">
                <div>
                    <h4 className="font-semibold mb-2">Original</h4>
                    <div className="relative aspect-video w-full max-w-sm rounded-lg overflow-hidden border">
                         <Image src={req.originalImageUrl} alt="Original" layout="fill" objectFit="cover" />
                    </div>
                </div>
                <div>
                    <h4 className="font-semibold mb-2">Editada</h4>
                    <div className="relative aspect-video w-full max-w-sm rounded-lg overflow-hidden border bg-muted/30 flex items-center justify-center">
                         {req.enhancedImageUrl ? (
                            <Image src={req.enhancedImageUrl} alt="Aprimorada" layout="fill" objectFit="cover" />
                         ) : (
                            <p className="text-sm text-muted-foreground">Aguardando upload...</p>
                         )}
                    </div>
                </div>
              </CardContent>
              <CardFooter className="flex justify-end gap-4">
                 <Button asChild variant="outline">
                    <a href={req.originalImageUrl} download={`original_${req.id}.jpg`} target="_blank" rel="noopener noreferrer">
                        <Download className="mr-2 h-4 w-4" />
                        Baixar Original
                    </a>
                </Button>
                <Button asChild>
                   <label htmlFor={`upload-${req.id}`} className="cursor-pointer">
                    {uploadingFileId === req.id ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        <Upload className="mr-2 h-4 w-4" />
                    )}
                    {req.enhancedImageUrl ? 'Substituir Editada' : 'Enviar Editada'}
                    <Input id={`upload-${req.id}`} type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, req.id)} disabled={uploadingFileId === req.id} />
                   </label>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
