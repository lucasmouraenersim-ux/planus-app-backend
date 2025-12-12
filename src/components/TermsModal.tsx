
"use client";

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { updateDoc, doc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { ShieldCheck, Loader2 } from 'lucide-react';

export function TermsModal() {
  const { appUser, refreshUsers } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Se o usuário está logado E (não tem o termo OU o termo é null)
    if (appUser && !appUser.termsAcceptedAt) {
      setIsOpen(true);
    }
  }, [appUser]);

  const handleAccept = async () => {
    if (!appUser || !accepted) return;
    setLoading(true);
    try {
      await updateDoc(doc(db, "users", appUser.uid), {
        termsAcceptedAt: Timestamp.now()
      });
      await refreshUsers(); // Atualiza contexto local
      setIsOpen(false);
    } catch (error) {
      console.error("Erro ao aceitar termos", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-lg bg-slate-900 border-white/10 text-slate-300" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <ShieldCheck className="text-emerald-500" /> Termos de Uso de Dados
          </DialogTitle>
          <DialogDescription>
            Para acessar a plataforma de inteligência, você deve concordar com as regras de conformidade e LGPD.
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="h-[200px] w-full rounded-md border border-white/10 p-4 bg-slate-950 text-xs leading-relaxed">
          <p className="font-bold mb-2">1. FINALIDADE E USO DOS DADOS</p>
          <p className="mb-2">Os dados disponibilizados (faturas, contatos, consumo) destinam-se exclusivamente à prospecção comercial B2B legítima.</p>
          
          <p className="font-bold mb-2">2. RESPONSABILIDADE (LGPD)</p>
          <p className="mb-2">Ao desbloquear um contato, você assume a posição de <strong>Controlador</strong> dos dados, isentando a Sent Energia de responsabilidade sobre a forma de abordagem.</p>
          
          <p className="font-bold mb-2">3. PROIBIÇÕES</p>
          <p className="mb-2">É estritamente proibido compartilhar, revender ou tornar público qualquer documento baixado desta plataforma.</p>
          
          <p className="font-bold mb-2">4. AUDITORIA</p>
          <p>Todas as ações de visualização e download são registradas para fins de auditoria de segurança.</p>
        </ScrollArea>

        <div className="flex items-center space-x-2 py-4">
          <Checkbox id="terms" checked={accepted} onCheckedChange={(v) => setAccepted(!!v)} className="border-white/50" />
          <Label htmlFor="terms" className="text-sm cursor-pointer">Li, compreendi e aceito os termos acima.</Label>
        </div>

        <DialogFooter>
          <Button onClick={handleAccept} disabled={!accepted || loading} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white">
            {loading ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : null}
            {loading ? "Registrando..." : "Aceitar e Continuar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
