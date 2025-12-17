"use client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Info, Zap, Flame, Battery, Factory, AlertTriangle, Calendar, CheckCircle2 } from 'lucide-react';

interface PricingGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenPurchase: () => void; // Função para abrir o modal de compra
}

export function PricingGuideModal({ isOpen, onClose, onOpenPurchase }: PricingGuideModalProps) {
  
  // Tabela de Custo de Desbloqueio (Regra de Negócio)
  const unlockCosts = [
    { 
      label: "Residencial / Pequeno", 
      kwh: "Até 2.000 kWh", 
      credits: 2, 
      color: "text-emerald-400",
      icon: <Battery className="w-4 h-4" />
    },
    { 
      label: "Comércio Padrão", 
      kwh: "2.001 a 5.000 kWh", 
      credits: 4, 
      color: "text-cyan-400",
      icon: <Zap className="w-4 h-4" />
    },
    { 
      label: "Grande Comércio", 
      kwh: "Acima de 5.000 kWh", 
      credits: 6, 
      color: "text-orange-400",
      icon: <Flame className="w-4 h-4" />
    },
    { 
      label: "B Optante (Híbrido)", 
      kwh: "Alta Demanda em BT", 
      credits: 8, 
      color: "text-purple-400",
      icon: <Factory className="w-4 h-4" />
    },
    { 
      label: "Alta Tensão (Grupo A)", 
      kwh: "Minas de Ouro", 
      credits: 10, 
      color: "text-yellow-400",
      icon: <Zap className="w-4 h-4 fill-current" />,
      note: "50% OFF no Plano Enterprise"
    },
  ];

  // Tabela de Compra de Créditos (Promoção de Natal)
  const creditPackages = [
    { name: "Teste", credits: 10, price: "R$ 30,00", perCredit: "R$ 3,00" },
    { name: "Econômico", credits: 50, price: "R$ 125,00", perCredit: "R$ 2,50" },
    { name: "Profissional", credits: 100, price: "R$ 200,00", perCredit: "R$ 2,00" },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-3xl bg-slate-950 border-slate-800 text-white max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <Info className="w-6 h-6 text-cyan-500" />
            Guia de Preços & Desbloqueios
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-8 mt-4">
          
          {/* SEÇÃO 1: CUSTO PARA DESBLOQUEAR (CRÉDITOS) */}
          <div className="space-y-3">
            <h3 className="text-lg font-bold text-white flex items-center gap-2 border-b border-white/10 pb-2">
              <Zap className="w-5 h-5 text-yellow-500" /> 
              Quanto custa cada Lead?
            </h3>
            <p className="text-sm text-slate-400">
              Nosso sistema é justo: você paga proporcionalmente ao <strong>potencial de consumo (kWh)</strong> do cliente.
            </p>
            
            <div className="rounded-xl border border-slate-800 overflow-hidden bg-slate-900/50">
              <Table>
                <TableHeader className="bg-slate-900">
                  <TableRow className="border-slate-800 hover:bg-transparent">
                    <TableHead className="text-slate-300 w-[200px]">Perfil</TableHead>
                    <TableHead className="text-slate-300">Consumo Médio</TableHead>
                    <TableHead className="text-right text-slate-300">Custo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {unlockCosts.map((item, i) => (
                    <TableRow key={i} className="border-slate-800 hover:bg-slate-800/50">
                      <TableCell className="font-medium flex items-center gap-2">
                        <div className={`p-1.5 rounded-md bg-slate-800 border border-slate-700 ${item.color}`}>
                          {item.icon}
                        </div>
                        {item.label}
                      </TableCell>
                      <TableCell className="text-slate-400 text-xs font-mono uppercase">
                        {item.kwh}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-col items-end">
                          <Badge variant="outline" className="bg-slate-950 border-slate-700 text-white font-bold mb-0.5">
                            {item.credits} Créditos
                          </Badge>
                          {item.note && <span className="text-[9px] text-green-400 font-bold">{item.note}</span>}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* SEÇÃO 2: VALOR DOS PACOTES (NATAL) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Calendar className="w-5 h-5 text-red-500" /> 
                Tabela Promocional de Natal
              </h3>
              <Badge className="bg-red-600 hover:bg-red-700 text-white border-none">Válido até 25/12</Badge>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {creditPackages.map((pkg, i) => (
                <div key={i} className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col items-center text-center hover:border-slate-600 transition-colors">
                  <h4 className="text-slate-300 font-bold text-sm uppercase">{pkg.name}</h4>
                  <div className="text-2xl font-bold text-white mt-1 mb-2">{pkg.price}</div>
                  <Badge variant="secondary" className="bg-slate-800 text-cyan-400 border border-cyan-900/30 mb-3">
                    {pkg.credits} Créditos
                  </Badge>
                  <p className="text-[10px] text-slate-500">Sai a {pkg.perCredit} / crédito</p>
                </div>
              ))}
            </div>

            {/* DESTAQUE EMPRESARIAL */}
            <div className="bg-gradient-to-r from-blue-900/40 to-cyan-900/40 border border-cyan-500/30 p-4 rounded-xl flex items-center justify-between">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-cyan-500/20 rounded-lg mt-1">
                  <CheckCircle2 className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <h4 className="text-cyan-100 font-bold text-sm">Plano Empresarial (Assinatura)</h4>
                  <p className="text-xs text-cyan-200/70 mt-1 max-w-[300px]">
                    Garanta <strong>200 Créditos Mensais</strong> pelo preço fixo de <strong>R$ 200,00</strong>.
                    <br/>
                    Custo por crédito cai para <strong>R$ 1,00</strong>!
                  </p>
                </div>
              </div>
              <div className="text-right">
                 <span className="block text-xl font-bold text-white">R$ 200,00</span>
                 <span className="text-[10px] text-slate-400 uppercase">/mês</span>
              </div>
            </div>
          </div>

          <div className="bg-yellow-900/10 border border-yellow-500/20 p-3 rounded-lg flex gap-3 items-center text-xs text-yellow-200/80">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <p>
              <strong>Atenção:</strong> Após o dia 25/12, os valores dos pacotes serão reajustados para a tabela de 2025 (iniciando em R$ 99,90). Aproveite para estocar créditos agora.
            </p>
          </div>

        </div>

        <DialogFooter className="mt-4">
          <Button variant="ghost" onClick={onClose}>Fechar</Button>
          <Button onClick={() => { onClose(); onOpenPurchase(); }} className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold">
            Quero Recarregar Agora
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
