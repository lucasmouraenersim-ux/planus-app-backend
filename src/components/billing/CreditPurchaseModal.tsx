"use client";

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Loader2, Zap, CheckCircle2, CreditCard } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from "@/hooks/use-toast";

const CREDIT_PACKS = [
  { 
    id: 'pack_10', 
    credits: 10, 
    price: 30, 
    label: 'Básico',
    desc: 'Para testar a plataforma.'
  },
  { 
    id: 'pack_50', 
    credits: 50, 
    price: 125, 
    label: 'Profissional',
    desc: 'Melhor custo-benefício.',
    popular: true
  },
  { 
    id: 'pack_100', 
    credits: 100, 
    price: 200, 
    label: 'Enterprise',
    desc: 'Volume alto de leads.'
  },
];

interface CreditPurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreditPurchaseModal({ isOpen, onClose }: CreditPurchaseModalProps) {
  const { appUser } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState<string | null>(null);

  const handleBuy = async (packId: string) => {
    if (!appUser) return;
    setLoading(packId);

    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            userId: appUser.uid, 
            itemId: packId, 
            type: 'pack' 
        })
      });

      const data = await response.json();

      if (data.paymentUrl) {
        // Redireciona para o Asaas
        window.location.href = data.paymentUrl;
      } else {
        throw new Error(data.error || "Erro ao gerar pagamento");
      }
    } catch (error) {
      console.error(error);
      toast({ title: "Erro", description: "Falha ao iniciar pagamento. Tente novamente.", variant: "destructive" });
    } finally {
      setLoading(null);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-3xl bg-[#020617] border-white/10 text-white overflow-hidden p-0">
        <div className="grid md:grid-cols-5 h-full min-h-[500px]">
            
            {/* Lateral Esquerda - Visual */}
            <div className="md:col-span-2 bg-gradient-to-br from-cyan-900/50 to-slate-900 p-8 flex flex-col justify-between relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-full bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20"></div>
                <div className="relative z-10">
                    <div className="w-12 h-12 bg-cyan-500 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-cyan-500/30">
                        <Zap className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-2xl font-bold mb-2">Recarregue sua Energia</h3>
                    <p className="text-cyan-200/70 text-sm">Adicione créditos para desbloquear contatos e usar a inteligência artificial.</p>
                </div>
                <div className="relative z-10 space-y-4 text-sm text-slate-300">
                    <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-cyan-400"/> Acesso imediato</div>
                    <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-cyan-400"/> Nota Fiscal Automática</div>
                    <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-cyan-400"/> PIX ou Cartão</div>
                </div>
            </div>

            {/* Lateral Direita - Planos */}
            <div className="md:col-span-3 p-8 bg-slate-950">
                <DialogHeader className="mb-6">
                    <DialogTitle>Selecione um pacote</DialogTitle>
                    <DialogDescription>Pagamento seguro via Asaas.</DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    {CREDIT_PACKS.map((pack) => (
                        <div 
                            key={pack.id}
                            className={`
                                group relative p-4 rounded-xl border cursor-pointer transition-all duration-200
                                ${pack.popular 
                                    ? 'bg-cyan-950/30 border-cyan-500/50 hover:bg-cyan-900/40' 
                                    : 'bg-slate-900 border-white/5 hover:border-white/20 hover:bg-slate-800'}
                            `}
                            onClick={() => handleBuy(pack.id)}
                        >
                            {pack.popular && (
                                <span className="absolute -top-3 right-4 bg-cyan-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shadow-glow-sm">
                                    Mais Vendido
                                </span>
                            )}
                            
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-4">
                                    <div className={`p-3 rounded-lg ${pack.popular ? 'bg-cyan-500/20 text-cyan-400' : 'bg-slate-800 text-slate-400'}`}>
                                        <Zap className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-white">{pack.credits} Créditos</h4>
                                        <p className="text-xs text-slate-400">{pack.desc}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-lg font-bold text-white">R$ {pack.price}</p>
                                    <Button 
                                        size="sm" 
                                        className={`h-8 text-xs ${pack.popular ? 'bg-cyan-600 hover:bg-cyan-500' : 'bg-slate-700 hover:bg-slate-600'}`}
                                        disabled={loading === pack.id}
                                    >
                                        {loading === pack.id ? <Loader2 className="w-3 h-3 animate-spin"/> : 'Comprar'}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                <p className="text-xs text-center text-slate-500 mt-6 flex items-center justify-center gap-2">
                    <CreditCard className="w-3 h-3" /> Pagamento processado externamente em ambiente seguro.
                </p>
            </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
