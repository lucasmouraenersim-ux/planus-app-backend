"use client";

import { useState } from 'react';
import { Check, Zap, CreditCard, Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/contexts/AuthContext';

// Planos de Assinatura (Recorrência)
const SUBSCRIPTION_PLANS = [
  {
    id: 'starter_monthly',
    name: 'Starter',
    price: 97,
    credits: 20,
    features: ['Acesso ao Mapa', '20 Créditos Mensais', 'Suporte por Email'],
    highlight: false
  },
  {
    id: 'pro_monthly',
    name: 'Profissional',
    price: 197,
    credits: 50,
    features: ['Tudo do Starter', '50 Créditos Mensais', 'Mapa de Calor', 'Suporte Prioritário'],
    highlight: true // Destaque visual
  }
];

// Pacotes Avulsos (Recarga)
const CREDIT_PACKS = [
  { id: 'pack_10', credits: 10, price: 30 },  // R$ 3,00/crédito
  { id: 'pack_50', credits: 50, price: 125 }, // R$ 2,50/crédito
  { id: 'pack_100', credits: 100, price: 200 }, // R$ 2,00/crédito
];

export function PricingTable() {
  const { appUser } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState<string | null>(null);

  const handleCheckout = async (itemId: string, type: 'subscription' | 'pack') => {
    setLoading(itemId);
    try {
      // 1. Chama sua API para gerar o link de pagamento
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            userId: appUser?.uid, 
            itemId, 
            type // 'subscription' ou 'pack'
        })
      });

      const data = await response.json();

      if (data.paymentUrl) {
        // 2. Redireciona o usuário para o Checkout do Gateway (Asaas/Stripe)
        window.location.href = data.paymentUrl;
      } else {
        throw new Error("Erro ao gerar pagamento");
      }

    } catch (error) {
      toast({ title: "Erro", description: "Não foi possível iniciar o pagamento.", variant: "destructive" });
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-12 py-8">
      
      {/* Seção 1: Assinaturas (Recorrência) */}
      <div>
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-white mb-2">Planos Mensais</h2>
          <p className="text-slate-400">Garanta créditos todo mês com desconto e acesso contínuo.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {SUBSCRIPTION_PLANS.map((plan) => (
            <Card key={plan.id} className={`bg-slate-900 border-white/10 relative ${plan.highlight ? 'border-cyan-500 shadow-2xl shadow-cyan-900/20' : ''}`}>
              {plan.highlight && <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-cyan-600 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider flex items-center gap-1"><Sparkles className="w-3 h-3"/> Mais Popular</div>}
              
              <CardHeader className="text-center">
                <CardTitle className="text-white text-xl">{plan.name}</CardTitle>
                <div className="mt-4 mb-2">
                  <span className="text-4xl font-black text-white">R$ {plan.price}</span>
                  <span className="text-slate-500">/mês</span>
                </div>
                <CardDescription className="text-cyan-400 font-medium">{plan.credits} créditos renovados mensalmente</CardDescription>
              </CardHeader>
              
              <CardContent>
                <ul className="space-y-3">
                  {plan.features.map((feat, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-slate-300">
                      <Check className="w-4 h-4 text-emerald-500" /> {feat}
                    </li>
                  ))}
                </ul>
              </CardContent>
              
              <CardFooter>
                <Button 
                    onClick={() => handleCheckout(plan.id, 'subscription')}
                    disabled={!!loading}
                    className={`w-full h-12 text-lg font-bold ${plan.highlight ? 'bg-cyan-600 hover:bg-cyan-500' : 'bg-slate-800 hover:bg-slate-700'}`}
                >
                    {loading === plan.id ? <Loader2 className="animate-spin" /> : 'Assinar Agora'}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>

      {/* Seção 2: Recargas Avulsas (On-demand) */}
      <div className="border-t border-white/10 pt-12">
        <div className="text-center mb-8">
          <h3 className="text-2xl font-bold text-white mb-2">Precisa de mais créditos?</h3>
          <p className="text-slate-400">Faça uma recarga avulsa. Sem mensalidade, sem fidelidade.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {CREDIT_PACKS.map((pack) => (
            <div key={pack.id} className="bg-slate-900/50 border border-white/10 rounded-xl p-6 flex flex-col items-center hover:bg-slate-900 transition-colors">
              <div className="bg-yellow-500/10 p-3 rounded-full mb-4">
                <Zap className="w-6 h-6 text-yellow-500" />
              </div>
              <div className="text-2xl font-bold text-white mb-1">{pack.credits} Créditos</div>
              <div className="text-slate-400 mb-6">por R$ {pack.price},00</div>
              <Button 
                variant="outline" 
                className="w-full border-slate-700 hover:bg-slate-800 text-white"
                onClick={() => handleCheckout(pack.id, 'pack')}
                disabled={!!loading}
              >
                {loading === pack.id ? '...' : 'Comprar Recarga'}
              </Button>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
