
"use client";

import { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import type { LeadWithId, ChatMessage } from '@/types/crm';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Send, Paperclip, Search, MessagesSquare, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { doc, getDoc, Timestamp } from "firebase/firestore";
import { db } from '@/lib/firebase';
import { useToast } from "@/hooks/use-toast";
import { sendChatMessage } from '@/actions/chat/sendChatMessage';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

async function fetchChatHistoryClient(leadId: string): Promise<ChatMessage[]> {
    if (!leadId) return [];
    
    const chatDocRef = doc(db, "crm_lead_chats", leadId);
    const chatDocSnap = await getDoc(chatDocRef);

    if (!chatDocSnap.exists()) {
        return [];
    }
    
    const messagesData = chatDocSnap.data()?.messages || [];
    
    const formattedMessages: ChatMessage[] = messagesData.map((msg: any) => ({
      ...msg,
      timestamp: (msg.timestamp as Timestamp).toDate().toISOString(),
    })).sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    
    return formattedMessages;
}

export function ChatLayout() {
  const { appUser, fetchAllCrmLeadsGlobally } = useAuth();
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
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadLeads = async () => {
      setIsLoadingLeads(true);
      const allLeads = await fetchAllCrmLeadsGlobally(); 
      setLeads(allLeads);
      
      const leadIdFromUrl = searchParams.get('leadId');
      if (leadIdFromUrl) {
        const leadToSelect = allLeads.find(l => l.id === leadIdFromUrl);
        setSelectedLead(leadToSelect || null);
      } else if (allLeads.length > 0) {
        const sortedLeads = [...allLeads].sort((a, b) => new Date(b.lastContact).getTime() - new Date(a.lastContact).getTime());
        setSelectedLead(sortedLeads[0]);
      }
      setIsLoadingLeads(false);
    };

    if(appUser) {
        loadLeads();
    }
  }, [appUser, searchParams, fetchAllCrmLeadsGlobally]);
  
  useEffect(() => {
    if (!selectedLead) {
        setChatMessages([]);
        return;
    };

    let isMounted = true;
    const loadChat = async () => {
        if (isMounted) setIsLoadingChat(true);
        try {
            const history = await fetchChatHistoryClient(selectedLead.id);
            if (isMounted) {
                setChatMessages(history);
            }
        } catch (error) {
            console.error("Error fetching chat history:", error);
        } finally {
            if (isMounted) setIsLoadingChat(false);
        }
    };
    
    loadChat();

    return () => { isMounted = false; };
  }, [selectedLead]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleSendMessage = async () => {
    if (!selectedLead || newMessage.trim() === '' || isSending) return;
    
    setIsSending(true);
    const messageText = newMessage;
    setNewMessage('');
    
    try {
        const result = await sendChatMessage({
            leadId: selectedLead.id,
            phone: selectedLead.phone,
            text: messageText,
            sender: 'user',
        });

        if (result.success && result.chatMessage) {
            setChatMessages(prev => [...prev, result.chatMessage!]);
        } else {
            toast({ title: "Erro", description: result.message || "Falha ao enviar mensagem.", variant: "destructive" });
            setNewMessage(messageText); // Restore on failure
        }
    } catch (error) {
        toast({ title: "Erro", description: "Ocorreu um erro inesperado.", variant: "destructive" });
        setNewMessage(messageText);
    } finally {
        setIsSending(false);
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
              <div>
                <h3 className="font-semibold text-foreground">{selectedLead.name}</h3>
                <p className="text-xs text-muted-foreground">{selectedLead.phone || 'Sem telefone'}</p>
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
                          <p className="whitespace-pre-wrap">{msg.text}</p>
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
                <Button variant="ghost" size="icon" disabled><Paperclip /></Button>
                <Input 
                  placeholder="Digite uma mensagem..." 
                  className="flex-1"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  disabled={isSending}
                />
                <Button onClick={handleSendMessage} disabled={isSending}>
                    {isSending ? <Loader2 className="w-4 h-4 animate-spin"/> : <Send />}
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
