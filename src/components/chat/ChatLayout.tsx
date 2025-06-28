
"use client";

import { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import type { LeadWithId, ChatMessage } from '@/types/crm';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Send, Paperclip, Search, MessagesSquare, ArrowLeft, Mic, Square } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import Image from 'next/image';
import { doc, getDoc, Timestamp, onSnapshot } from "firebase/firestore";
import { db } from '@/lib/firebase';
import { uploadFile } from '@/lib/firebase/storage';
import { useToast } from "@/hooks/use-toast";
import { sendChatMessage } from '@/actions/chat/sendChatMessage';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function ChatLayout() {
  const { appUser, userAppRole, fetchAllCrmLeadsGlobally } = useAuth();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [leads, setLeads] = useState<LeadWithId[]>([]);
  const [selectedLead, setSelectedLead] = useState<LeadWithId | null>(null);
  const [isLoadingLeads, setIsLoadingLeads] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isLoadingChat, setIsLoadingChat] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  
  const [isRecording, setIsRecording] = useState(false);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadLeads = async () => {
      setIsLoadingLeads(true);
      const allLeads = await fetchAllCrmLeadsGlobally();
      
      let leadsToDisplay: LeadWithId[] = [];

      if (userAppRole === 'admin' || userAppRole === 'superadmin') {
        leadsToDisplay = allLeads;
      } else if (userAppRole === 'vendedor' && appUser) {
        leadsToDisplay = allLeads.filter(lead => lead.userId === appUser.uid);
      }

      setLeads(leadsToDisplay);
      
      const leadIdFromUrl = searchParams.get('leadId');
      if (leadIdFromUrl) {
        const leadToSelect = leadsToDisplay.find(l => l.id === leadIdFromUrl);
        setSelectedLead(leadToSelect || null);
      } else if (leadsToDisplay.length > 0) {
        const sortedLeads = [...leadsToDisplay].sort((a, b) => new Date(b.lastContact).getTime() - new Date(a.lastContact).getTime());
        setSelectedLead(sortedLeads[0]);
      } else {
        setSelectedLead(null); // Explicitly set to null if no leads
      }
      setIsLoadingLeads(false);
    };

    if(appUser) {
        loadLeads();
    }
  }, [appUser, userAppRole, searchParams, fetchAllCrmLeadsGlobally]);
  
  useEffect(() => {
    if (!selectedLead) {
        setChatMessages([]);
        return;
    };

    setIsLoadingChat(true);
    const chatDocRef = doc(db, "crm_lead_chats", selectedLead.id);
    
    const unsubscribe = onSnapshot(chatDocRef, (docSnap) => {
        if (docSnap.exists()) {
            const messagesData = docSnap.data()?.messages || [];
            const formattedMessages: ChatMessage[] = messagesData.map((msg: any) => ({
                ...msg,
                timestamp: (msg.timestamp as Timestamp).toDate().toISOString(),
            })).sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
            setChatMessages(formattedMessages);
        } else {
            setChatMessages([]);
        }
        setIsLoadingChat(false);
    }, (error) => {
        console.error("Error listening to chat history:", error);
        setIsLoadingChat(false);
        toast({ title: "Erro de Chat", description: "Não foi possível carregar as mensagens.", variant: "destructive" });
    });

    return () => unsubscribe();
  }, [selectedLead, toast]);

  useEffect(() => {
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  }, [chatMessages]);

  const sendMessageInternal = async (text: string, type: 'text' | 'image' | 'audio' | 'document', mediaUrl?: string) => {
    if (!selectedLead) return;
    setIsSending(true);
    
    try {
        const result = await sendChatMessage({
            leadId: selectedLead.id,
            phone: selectedLead.phone,
            text,
            sender: 'user',
            type,
            mediaUrl
        });

        if (result.success && result.chatMessage) {
            // No optimistic update needed, listener will handle it
        } else {
            toast({ title: "Erro", description: result.message || "Falha ao enviar mensagem.", variant: "destructive" });
        }
    } catch (error) {
        toast({ title: "Erro", description: "Ocorreu um erro inesperado.", variant: "destructive" });
    } finally {
        setIsSending(false);
        setIsUploadingMedia(false);
    }
  };

  const handleSendText = () => {
    if (newMessage.trim() === '') return;
    sendMessageInternal(newMessage, 'text');
    setNewMessage('');
  };
  
  const handlePaperclipClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0 || !selectedLead) return;
    const file = event.target.files[0];
    event.target.value = ''; // Reset input
    
    setIsUploadingMedia(true);
    toast({ title: "Enviando imagem...", description: "Aguarde enquanto o anexo é carregado." });
    
    try {
        const filePath = `chat_media/${selectedLead.id}/${Date.now()}-${file.name}`;
        const downloadURL = await uploadFile(file, filePath);
        await sendMessageInternal(newMessage || file.name, 'image', downloadURL);
        setNewMessage('');
    } catch (error) {
        toast({ title: "Erro no Upload", description: "Não foi possível enviar a imagem.", variant: "destructive" });
        setIsUploadingMedia(false);
    }
  };

  const handleRecordClick = async () => {
    if (isRecording) {
        mediaRecorderRef.current?.stop();
        setIsRecording(false);
        return; // The rest of the logic is handled in onstop
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        const supportedCandidates = [
            { mimeType: 'audio/ogg; codecs=opus', extension: 'ogg' },
            { mimeType: 'audio/mp4', extension: 'mp4' },
            { mimeType: 'audio/aac', extension: 'aac' },
        ];

        const supportedProfile = supportedCandidates.find(
            (candidate) => MediaRecorder.isTypeSupported(candidate.mimeType)
        );

        if (!supportedProfile) {
            toast({
                title: "Gravação não suportada",
                description: "Seu navegador não suporta um formato de áudio compatível (OGG Opus, AAC, ou MP4).",
                variant: "destructive",
            });
            console.error("No supported audio format found for MediaRecorder.");
            return;
        }
        
        const options = { mimeType: supportedProfile.mimeType };
        mediaRecorderRef.current = new MediaRecorder(stream, options);
        
        audioChunksRef.current = [];
        
        mediaRecorderRef.current.ondataavailable = (event) => {
            if (event.data.size > 0) {
                audioChunksRef.current.push(event.data);
            }
        };
        
        mediaRecorderRef.current.onstop = async () => {
            const audioBlob = new Blob(audioChunksRef.current, { type: supportedProfile.mimeType });
            const audioFile = new File([audioBlob], `audio-${Date.now()}.${supportedProfile.extension}`, { type: supportedProfile.mimeType });

            if (!selectedLead) return;

            setIsUploadingMedia(true);
            toast({ title: "Enviando áudio...", description: "Aguarde enquanto o áudio é carregado." });

            try {
                const filePath = `chat_media/${selectedLead.id}/${audioFile.name}`;
                const downloadURL = await uploadFile(audioFile, filePath);
                await sendMessageInternal("Mensagem de voz", 'audio', downloadURL);
            } catch(error) {
                console.error("Audio upload error:", error);
                toast({ title: "Erro no Upload", description: "Não foi possível enviar o áudio.", variant: "destructive" });
            } finally {
               setIsUploadingMedia(false);
            }
            
            stream.getTracks().forEach(track => track.stop());
        };
        
        mediaRecorderRef.current.start();
        setIsRecording(true);
    } catch (error) {
        console.error("Error accessing media devices.", error);
        toast({ title: "Erro de Microfone", description: "Não foi possível acessar o microfone. Verifique as permissões do navegador.", variant: "destructive" });
    }
};


  const filteredLeads = useMemo(() => {
    return leads
      .filter(lead => lead.name.toLowerCase().includes(searchTerm.toLowerCase()))
      .sort((a, b) => new Date(b.lastContact).getTime() - new Date(a.lastContact).getTime());
  }, [leads, searchTerm]);

  return (
    <div className="flex h-[calc(100vh-56px)] border-t">
      <aside className={cn(
        "w-full md:w-1/3 lg:w-1/4 h-full border-r flex-col bg-card/50",
        selectedLead ? "hidden md:flex" : "flex"
      )}>
        <div className="p-4 border-b">
          <h2 className="text-xl font-semibold text-primary">Conversas</h2>
          <div className="relative mt-2">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Pesquisar leads..." 
              className="pl-8" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        <ScrollArea className="flex-1">
          {isLoadingLeads ? (
            <div className="flex justify-center items-center h-full"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : (
            filteredLeads.map(lead => (
              <div
                key={lead.id}
                className={cn(
                  "flex items-center gap-4 p-3 cursor-pointer border-b hover:bg-muted/50",
                  selectedLead?.id === lead.id && "bg-muted"
                )}
                onClick={() => setSelectedLead(lead)}
              >
                <Avatar className="h-10 w-10">
                  <AvatarImage src={undefined} alt={lead.name} />
                  <AvatarFallback className="bg-primary/20 text-primary">{lead.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 truncate">
                  <p className="font-semibold truncate">{lead.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{lead.company || `Consumo: ${lead.kwh} kWh`}</p>
                </div>
              </div>
            ))
          )}
        </ScrollArea>
      </aside>

      <main className={cn(
        "flex-1 flex-col h-full bg-background/30",
        selectedLead ? "flex" : "hidden md:flex"
      )}>
        {selectedLead ? (
          <>
            <header className="flex items-center gap-4 p-3 border-b bg-card/50 flex-shrink-0">
              <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setSelectedLead(null)}><ArrowLeft /></Button>
              <Avatar className="h-10 w-10">
                <AvatarImage src={undefined} alt={selectedLead.name} />
                <AvatarFallback className="bg-primary/20 text-primary">{selectedLead.name.charAt(0)}</AvatarFallback>
              </Avatar>
              <div className="flex-1 truncate">
                <h3 className="font-semibold text-foreground">{selectedLead.name}</h3>
                 {appUser?.canViewLeadPhoneNumber && (
                  <p className="text-xs text-muted-foreground">{selectedLead.phone || 'Telefone não disponível'}</p>
                )}
              </div>
            </header>
            
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                 {isLoadingChat ? (
                    <div className="flex justify-center items-center h-full"><Loader2 className="h-5 w-5 animate-spin" /></div>
                 ) : (
                    chatMessages.map(msg => (
                      <div key={msg.id} className={`flex items-end gap-2 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`p-3 rounded-lg max-w-[80%] text-sm ${msg.sender === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                          {msg.type === 'image' && msg.mediaUrl && (
                              <a href={msg.mediaUrl} target="_blank" rel="noopener noreferrer" className="block mb-2">
                                  <Image src={msg.mediaUrl} alt={msg.text || 'Imagem enviada'} width={250} height={250} className="rounded-lg object-cover" />
                              </a>
                          )}
                           {msg.type === 'audio' && msg.mediaUrl && (
                                <audio controls src={msg.mediaUrl} className="w-full max-w-xs my-2" />
                            )}
                          {msg.text && <p className="whitespace-pre-wrap">{msg.text}</p>}
                          {msg.transcription && (
                            <div className="mt-2 pt-2 border-t border-white/20">
                              <p className="text-xs italic opacity-80">{msg.transcription}</p>
                            </div>
                          )}
                           <p className={`text-xs mt-1.5 text-right ${msg.sender === 'user' ? 'text-primary-foreground/70' : 'text-muted-foreground/70'}`}>
                            {format(parseISO(String(msg.timestamp)), "HH:mm", { locale: ptBR })}
                          </p>
                        </div>
                      </div>
                    ))
                 )}
                 <div ref={chatEndRef} />
              </div>
            </ScrollArea>

            <footer className="p-4 border-t bg-card/50 flex-shrink-0">
              <div className="flex items-center gap-2">
                <Input 
                  placeholder="Digite uma mensagem..." 
                  className="flex-1"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && newMessage.trim() !== '' && handleSendText()}
                  disabled={isSending || isRecording || isUploadingMedia}
                />
                <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="image/*"
                    onChange={handleFileSelected}
                />
                <Button variant="ghost" size="icon" onClick={handlePaperclipClick} disabled={isSending || isRecording || isUploadingMedia}>
                    <Paperclip className="h-5 w-5" />
                </Button>
                <Button 
                    variant={isRecording ? "destructive" : "ghost"} 
                    size="icon" 
                    onClick={handleRecordClick} 
                    disabled={isSending || isUploadingMedia}
                >
                    {isRecording ? <Square className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                </Button>
                <Button onClick={handleSendText} disabled={isSending || isRecording || isUploadingMedia || newMessage.trim() === ''}>
                    {isSending || isUploadingMedia ? <Loader2 className="w-4 h-4 animate-spin"/> : <Send className="w-4 h-4" />}
                </Button>
              </div>
            </footer>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <MessagesSquare className="h-16 w-16 mb-4" />
            <p className="text-lg">Selecione uma conversa</p>
            <p className="text-sm">Suas conversas com os leads aparecerão aqui.</p>
          </div>
        )}
      </main>
    </div>
  );
}
