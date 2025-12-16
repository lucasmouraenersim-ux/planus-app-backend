
"use client";
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from '@/components/ui/badge';
import { Loader2, Check, Tag, Zap, Building2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from "@/hooks/use-toast";

interface CreditPurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreditPurchaseModal({ isOpen, onClose }: CreditPurchaseModalProps) {
  const { appUser } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState<string | null>(null);
  const [coupon, setCoupon] = useState('');
  
  const handleBuy = async (itemId: string) => {
    if (!appUser) return;
    setLoading(itemId);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: appUser.uid, itemId, couponCode: coupon }) // Envia o cupom
      });
      const data = await res.json();
      if (data.paymentUrl) {
        window.open(data.paymentUrl, '_blank');
        onClose();
      } else {
        toast({ title: "Erro ao gerar pagamento", description: data.error || "Desconhecido", variant: "destructive" });
      }
    } catch (e) {
      console.error(e);
      toast({ title: "Erro de conexão", variant: "destructive" });
    } finally {
      setLoading(null);
    }
  };

  const PlanCard = ({ id, credits, price, label, bestValue, isSub }: any) => (
    <div className={`relative border p-4 rounded-xl flex flex-col gap-3 transition-all cursor-pointer hover:border-cyan-500/50 hover:bg-slate-800/50 ${bestValue ? 'border-yellow-500/50 bg-yellow-900/10' : 'border-white/10 bg-slate-900'}`}>
        {bestValue && <div className="absolute -top-3 right-4 bg-yellow-500 text-black text-[10px] font-bold px-2 py-0.5 rounded-full">MAIS VENDIDO</div>}
        <div>
            <h4 className="text-white font-bold text-lg flex items-center gap-2">
                {isSub ? <Building2 className="w-4 h-4 text-cyan-400"/> : <Zap className="w-4 h-4 text-yellow-400"/>}
                {credits} Créditos
            </h4>
            <p className="text-slate-400 text-xs">{label}</p>
        </div>
        <div className="mt-auto">
            <div className="text-2xl font-bold text-white">R$ {price}<span className="text-sm font-normal text-slate-500">,00</span></div>
            {isSub && <div className="text-[10px] text-cyan-400 font-bold uppercase">Cobrança Mensal</div>}
        </div>
        <Button 
            onClick={() => handleBuy(id)} 
            disabled={loading !== null} 
            className={`w-full ${bestValue ? 'bg-yellow-500 hover:bg-yellow-400 text-black' : 'bg-slate-700 hover:bg-cyan-600 text-white'}`}
        >
            {loading === id ? <Loader2 className="animate-spin w-4 h-4"/> : (isSub ? 'Assinar Agora' : 'Comprar')}
        </Button>
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-3xl bg-slate-950 border-slate-800 text-white">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
             <div className="p-2 bg-gradient-to-tr from-yellow-500 to-orange-600 rounded-lg"><Zap className="w-5 h-5 text-white" /></div>
             Recarregar Créditos
          </DialogTitle>
        </DialogHeader>

        <div className="mt-4">
            <Tabs defaultValue="avulso" className="w-full">
                <TabsList className="grid w-full grid-cols-2 bg-slate-900 mb-6">
                    <TabsTrigger value="avulso">Pacotes Avulsos</TabsTrigger>
                    <TabsTrigger value="empresarial" className="data-[state=active]:text-cyan-400">Planos Empresariais</TabsTrigger>
                </TabsList>

                {/* PACOTES AVULSOS */}
                <TabsContent value="avulso" className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-in fade-in slide-in-from-bottom-2">
                    <PlanCard id="pack_10" credits={10} price={30} label="Para iniciantes" />
                    <PlanCard id="pack_50" credits={50} price={125} label="Para vendedores ativos" bestValue />
                    <PlanCard id="pack_100" credits={100} price={200} label="Para equipes pequenas" />
                </TabsContent>

                {/* PLANOS EMPRESARIAIS */}
                <TabsContent value="empresarial" className="animate-in fade-in slide-in-from-bottom-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <PlanCard 
                            id="plan_sdr_quarterly" 
                            credits={200} 
                            price={200} 
                            label="Assinatura Mensal (Fidelidade Trimestral)" 
                            isSub={true}
                            bestValue
                        />
                         <div className="border border-dashed border-slate-700 rounded-xl flex flex-col items-center justify-center p-6 text-center text-slate-500 hover:border-cyan-500/30 transition-colors">
                            <Building2 className="w-12 h-12 mb-2 opacity-50"/>
                            <h4 className="font-bold text-slate-300">Precisa de mais volume?</h4>
                            <p className="text-xs mt-1">Planos acima de 1000 créditos.<br/>Fale com nosso comercial.</p>
                            <Button variant="link" className="text-cyan-400 mt-2 h-auto p-0 text-xs">Entrar em contato</Button>
                         </div>
                    </div>
                </TabsContent>
            </Tabs>
        </div>

        {/* ÁREA DE CUPOM */}
        <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between gap-4">
            <div className="flex-1">
                <p className="text-xs text-slate-400 mb-1.5 ml-1">Possui um cupom de desconto?</p>
                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <Tag className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                        <Input 
                            value={coupon} 
                            onChange={(e) => setCoupon(e.target.value.toUpperCase())}
                            placeholder="EX: SDRPRO20" 
                            className="pl-9 bg-slate-900 border-slate-700 text-white font-mono uppercase placeholder:normal-case"
                        />
                    </div>
                    {coupon.length > 3 && <Badge className="bg-green-600/20 text-green-400 border-green-600/50"><Check className="w-3 h-3 mr-1"/> Aplicar no Pagamento</Badge>}
                </div>
            </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
