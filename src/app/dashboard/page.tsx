
"use client";

import { useState, useMemo, Suspense, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { BrazilMapGraphic } from '@/components/BrazilMapGraphic';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { calculateSavings } from '@/lib/discount-calculator';
import { HandHelping, TrendingUp, Zap, MapPin, DollarSign, Percent, BarChart3, ChevronRight, Sparkles, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PARTNERS_COVERAGE } from '@/data/partners'; // Crie esse arquivo no passo 1

// --- COMPONENTES AUXILIARES ---

// Card de Resultado com Animação
const BigNumberCard = ({ label, value, subtext, color = "emerald" }: { label: string, value: string, subtext?: string, color?: "emerald" | "blue" | "orange" }) => (
    <div className={`relative overflow-hidden rounded-2xl bg-slate-900/60 border border-white/10 p-6 backdrop-blur-md group hover:border-${color}-500/50 transition-all duration-500`}>
        <div className={`absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity bg-${color}-500 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2`}></div>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-2">
            {color === 'emerald' ? <TrendingUp className="w-3 h-3" /> : <DollarSign className="w-3 h-3" />} {label}
        </p>
        <div className="text-3xl md:text-4xl font-black text-white tracking-tight mt-2">
            {value}
        </div>
        {subtext && <p className={`text-xs mt-2 font-medium text-${color}-400`}>{subtext}</p>}
    </div>
);

// Toggle Customizado para Tipo de Desconto
const DiscountTypeToggle = ({ value, onChange }: { value: 'promotional' | 'fixed', onChange: (v: 'promotional' | 'fixed') => void }) => (
    <div className="bg-slate-950 p-1 rounded-lg border border-white/10 flex relative">
        <div 
            className={`absolute top-1 bottom-1 w-[calc(50%-4px)] bg-cyan-600 rounded-md transition-all duration-300 shadow-lg ${value === 'promotional' ? 'left-1' : 'left-[calc(50%+4px)]'}`} 
        />
        <button 
            onClick={() => onChange('promotional')}
            className={`flex-1 relative z-10 text-xs font-bold py-2 text-center transition-colors ${value === 'promotional' ? 'text-white' : 'text-slate-400 hover:text-white'}`}
        >
            Promocional
        </button>
        <button 
            onClick={() => onChange('fixed')}
            className={`flex-1 relative z-10 text-xs font-bold py-2 text-center transition-colors ${value === 'fixed' ? 'text-white' : 'text-slate-400 hover:text-white'}`}
        >
            Fixo
        </button>
    </div>
);

function DashboardPageContent() {
  const searchParams = useSearchParams();
  const initialKwh = parseInt(searchParams.get('item1Quantidade') || '1500', 10);
  const initialUF = searchParams.get('clienteUF');

  // States
  const [selectedStateCode, setSelectedStateCode] = useState<string | null>(initialUF || null);
  const [hoveredStateCode, setHoveredStateCode] = useState<string | null>(null);
  const [currentKwh, setCurrentKwh] = useState<number>(initialKwh);
  const [showCompetitorAnalysis, setShowCompetitorAnalysis] = useState(false);
  const [selectedPartnerId, setSelectedPartnerId] = useState('all');


  // Configuração de Desconto
  const [discountConfig, setDiscountConfig] = useState<any>(() => {
    const discountType = searchParams.get('discountType') as 'promotional' | 'fixed' || 'promotional';
    return {
        type: discountType,
        promotional: {
          rate: parseInt(searchParams.get('promotionalRate') || '25', 10),
          durationMonths: parseInt(searchParams.get('promotionalDuration') || '3', 10),
          subsequentRate: parseInt(searchParams.get('subsequentRate') || '15', 10),
        },
        fixed: {
          rate: parseInt(searchParams.get('fixedRate') || '20', 10),
        }
    };
  });

  const currentPartner = useMemo(() => 
    PARTNERS_COVERAGE.find(p => p.id === selectedPartnerId) || PARTNERS_COVERAGE[0], 
  [selectedPartnerId]);


  // Cálculos
  const savingsResult = useMemo(() => {
    const kwhToReaisFactor = 1.0907; 
    const billAmount = currentKwh * kwhToReaisFactor;

    const stateForCalc = selectedStateCode || 'MT';
    
    return calculateSavings(billAmount, discountConfig, stateForCalc);
  }, [currentKwh, discountConfig, selectedStateCode]);

  const proposalLink = useMemo(() => {
    const params = new URLSearchParams();
    params.set('item1Quantidade', String(currentKwh));
    if (selectedStateCode) params.set('clienteUF', selectedStateCode);
    
    params.set('discountType', discountConfig.type);
    
    if (discountConfig.type === 'promotional') {
      params.set('promotionalRate', String(discountConfig.promotional.rate));
      params.set('promotionalDuration', String(discountConfig.promotional.durationMonths));
      params.set('subsequentRate', String(discountConfig.promotional.subsequentRate));
    } else {
      params.set('fixedRate', String(discountConfig.fixed.rate));
    }
    
    return `/proposal-generator?${params.toString()}`;
  }, [currentKwh, selectedStateCode, discountConfig]);

  const formatCurrency = (val: number) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-300 font-sans relative overflow-hidden flex flex-col">
      
      {/* Estilos Globais */}
      <style jsx global>{`
        .glass-panel { background: rgba(30, 41, 59, 0.4); backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.05); box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2); }
        .animate-blob { animation: blob 15s infinite; }
        @keyframes blob { 0% { transform: translate(0px, 0px) scale(1); } 33% { transform: translate(30px, -50px) scale(1.1); } 66% { transform: translate(-20px, 20px) scale(0.9); } 100% { transform: translate(0px, 0px) scale(1); } }
        /* Slider Customizado */
        input[type="range"]::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 20px; height: 20px; background: #06b6d4; cursor: pointer; border-radius: 50%; box-shadow: 0 0 10px rgba(6, 182, 212, 0.8); transition: transform 0.1s; }
        input[type="range"]::-webkit-slider-thumb:hover { transform: scale(1.2); }
      `}</style>

      {/* Background Dinâmico */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-cyan-500/10 rounded-full blur-[100px] animate-blob"></div>
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-purple-500/10 rounded-full blur-[100px] animate-blob" style={{ animationDelay: '2s' }}></div>
      </div>

      {/* Conteúdo Principal */}
      <div className="relative z-10 flex-1 p-4 md:p-8 max-w-[1600px] mx-auto w-full">
        
        {/* Header */}
        <div className="mb-8">
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                <div className="p-2 bg-gradient-to-tr from-cyan-600 to-blue-600 rounded-xl shadow-lg shadow-cyan-900/20">
                    <BarChart3 className="w-6 h-6 text-white" />
                </div>
                Simulador de Economia
            </h1>
            <p className="text-slate-400 mt-2">Selecione um estado no mapa e ajuste o consumo para ver a mágica acontecer.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* === COLUNA ESQUERDA: CONTROLES (4 Cols) === */}
            <div className="lg:col-span-4 space-y-6">
                
                {/* Card de Configuração de Consumo */}
                <div className="glass-panel p-6 rounded-2xl">
                    <div className="flex items-center gap-2 mb-6">
                        <Zap className="w-5 h-5 text-yellow-400" />
                        <h2 className="text-lg font-bold text-white">Perfil de Consumo</h2>
                    </div>

                    <div className="space-y-6">
                        <div>
                            <div className="flex justify-between text-sm mb-2">
                                <Label className="text-slate-300">Consumo Mensal</Label>
                                <span className="font-bold text-cyan-400 text-lg">{currentKwh.toLocaleString()} kWh</span>
                            </div>
                            <Slider 
                                value={[currentKwh]} 
                                onValueChange={(v) => setCurrentKwh(v[0])} 
                                max={50000} /* AUMENTADO PARA 50.000 conforme solicitado */
                                step={100} 
                                className="cursor-pointer"
                            />
                            <div className="flex justify-between text-[10px] text-slate-500 mt-1 uppercase tracking-wider">
                                <span>Residencial</span>
                                <span>Comercial</span>
                                <span>Industrial</span>
                            </div>
                        </div>

                        <div className="pt-4 border-t border-white/5">
                            <div className="flex justify-between items-center mb-3">
                                <Label className="text-slate-300 flex items-center gap-2"><Percent className="w-4 h-4 text-emerald-400"/> Modelo de Desconto</Label>
                            </div>
                            <DiscountTypeToggle 
                                value={discountConfig.type} 
                                onChange={(t) => setDiscountConfig({ ...discountConfig, type: t })} 
                            />
                        </div>

                        {discountConfig.type === 'promotional' ? (
                            <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2">
                                <div>
                                    <Label className="text-xs text-slate-400">Taxa Promo (%)</Label>
                                    <Input 
                                        type="number" 
                                        className="mt-1 bg-slate-900/50 border-white/10 text-white font-bold h-10"
                                        value={discountConfig.promotional.rate}
                                        onChange={(e) => setDiscountConfig({...discountConfig, promotional: {...discountConfig.promotional, rate: Number(e.target.value)}})}
                                    />
                                </div>
                                <div>
                                    <Label className="text-xs text-slate-400">Duração (Meses)</Label>
                                    <Input 
                                        type="number" 
                                        className="mt-1 bg-slate-900/50 border-white/10 text-white font-bold h-10"
                                        value={discountConfig.promotional.durationMonths}
                                        onChange={(e) => setDiscountConfig({...discountConfig, promotional: {...discountConfig.promotional, durationMonths: Number(e.target.value)}})}
                                    />
                                </div>
                            </div>
                        ) : (
                            <div className="animate-in fade-in slide-in-from-top-2">
                                <Label className="text-xs text-slate-400">Taxa Fixa (%)</Label>
                                <Input 
                                    type="number" 
                                    className="mt-1 bg-slate-900/50 border-white/10 text-white font-bold h-10"
                                    value={discountConfig.fixed.rate}
                                    onChange={(e) => setDiscountConfig({...discountConfig, fixed: {...discountConfig.fixed, rate: Number(e.target.value)}})}
                                />
                            </div>
                        )}
                        
                        <div className="flex items-center justify-between pt-4 border-t border-white/5">
                            <Label htmlFor="competitor" className="text-sm cursor-pointer text-slate-400">Comparar com Concorrentes</Label>
                            <Switch id="competitor" checked={showCompetitorAnalysis} onCheckedChange={setShowCompetitorAnalysis} />
                        </div>
                    </div>
                </div>

                {selectedStateCode && (
                    <div className="glass-panel p-4 rounded-xl flex items-center gap-4 animate-in fade-in slide-in-from-left-4">
                        <div className="w-12 h-12 bg-slate-800 rounded-full flex items-center justify-center border border-white/10 font-black text-xl text-white">
                            {selectedStateCode}
                        </div>
                        <div>
                            <p className="text-xs text-slate-400 uppercase tracking-wider">Região Selecionada</p>
                            <p className="text-white font-bold text-lg">{selectedStateCode}</p>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => setSelectedStateCode(null)} className="ml-auto text-slate-500 hover:text-white"><X className="w-4 h-4"/></Button>
                    </div>
                )}
            </div>

            {/* === COLUNA CENTRAL: MAPA (5 Cols) === */}
            <div className="lg:col-span-5 h-[500px] lg:h-auto relative group">
                 <div 
                    className="absolute inset-0 rounded-3xl blur-3xl transition-colors duration-1000"
                    style={{ backgroundColor: `${currentPartner.color}20` }} // 20% de opacidade da cor do parceiro
                ></div>
                
                {/* Seletor Flutuante de Parceiro */}
                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 w-64">
                    <Select value={selectedPartnerId} onValueChange={setSelectedPartnerId}>
                        <SelectTrigger className="bg-slate-900/80 border-white/10 text-white backdrop-blur-md">
                            <SelectValue placeholder="Filtrar Cobertura" />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 border-slate-700 text-white">
                            {PARTNERS_COVERAGE.map(p => (
                                <SelectItem key={p.id} value={p.id}>
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }}></div>
                                        {p.name}
                                    </div>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="relative w-full h-full flex items-center justify-center p-4">
                    <BrazilMapGraphic 
                        selectedStateCode={selectedStateCode}
                        hoveredStateCode={hoveredStateCode}
                        onStateClick={setSelectedStateCode}
                        onStateHover={setHoveredStateCode}
                        // NOVAS PROPS
                        activeStates={currentPartner.states}
                        activeColor={currentPartner.color}
                    />
                    
                    {/* Legenda Dinâmica no Rodapé do Mapa */}
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-slate-400 bg-slate-900/50 px-3 py-1 rounded-full border border-white/5 backdrop-blur pointer-events-none">
                        Exibindo cobertura: <span style={{ color: currentPartner.color, fontWeight: 'bold' }}>{currentPartner.name}</span>
                    </div>
                </div>
            </div>

            {/* === COLUNA DIREITA: RESULTADOS (3 Cols) === */}
            <div className="lg:col-span-3 space-y-6">
                
                <div>
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-cyan-400" /> Projeção de Ganhos
                    </h3>
                    
                    {savingsResult ? (
                        <div className="space-y-4">
                            <BigNumberCard 
                                label="Economia Anual" 
                                value={formatCurrency(savingsResult.annualSaving)} 
                                subtext="Dinheiro livre no caixa"
                                color="emerald"
                            />
                            
                            <BigNumberCard 
                                label="Desconto Médio" 
                                value={`${savingsResult.effectiveAnnualDiscountPercentage.toFixed(1)}%`} 
                                subtext={discountConfig.type === 'promotional' ? "Com bônus inicial" : "Taxa fixa garantida"}
                                color="blue"
                            />

                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-slate-900/40 p-4 rounded-xl border border-white/5">
                                    <p className="text-[10px] text-slate-500 uppercase">Fatura Atual</p>
                                    <p className="text-lg font-bold text-slate-300 line-through decoration-red-500/50">{formatCurrency(savingsResult.originalMonthlyBill)}</p>
                                </div>
                                <div className="bg-emerald-500/10 p-4 rounded-xl border border-emerald-500/20">
                                    <p className="text-[10px] text-emerald-400 uppercase">Nova Fatura</p>
                                    <p className="text-lg font-bold text-white">{formatCurrency(savingsResult.newMonthlyBillWithPlanus)}</p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-center p-6 border-2 border-dashed border-slate-800 rounded-2xl bg-slate-900/20">
                            <MapPin className="w-12 h-12 text-slate-600 mb-4" />
                            <p className="text-slate-400 font-medium">Selecione um estado no mapa para calcular a economia disponível na região.</p>
                        </div>
                    )}
                </div>

                <div className="fixed bottom-6 right-6 lg:static lg:w-full z-50">
                    <Link href={proposalLink} className="w-full">
                        <Button 
                            disabled={!savingsResult}
                            className={`
                                h-16 w-full rounded-xl shadow-2xl transition-all duration-300
                                ${savingsResult 
                                    ? 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:scale-105 text-white' 
                                    : 'bg-slate-800 text-slate-500 cursor-not-allowed'}
                            `}
                        >
                            <div className="flex items-center justify-between w-full px-6">
                                <div className="text-left">
                                    <p className="text-xs font-medium uppercase tracking-wider opacity-80">Gostou?</p>
                                    <p className="text-lg font-bold">Gerar Proposta</p>
                                </div>
                                <div className="bg-white/20 p-2 rounded-full">
                                    <ChevronRight className="w-6 h-6 text-white" />
                                </div>
                            </div>
                        </Button>
                    </Link>
                </div>

            </div>
        </div>

        {showCompetitorAnalysis && savingsResult && (
            <div className="mt-12 animate-in slide-in-from-bottom-10 fade-in duration-700">
                <div className="glass-panel p-8 rounded-2xl border-t-4 border-t-purple-500">
                    <h3 className="text-2xl font-bold text-white mb-6">Comparativo de Mercado</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-slate-800 p-6 rounded-xl border-2 border-emerald-500 relative">
                            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-500 text-white text-xs font-bold px-3 py-1 rounded-full uppercase">Melhor Escolha</div>
                            <p className="text-center font-bold text-white text-lg mb-4">Sent Energia</p>
                            <p className="text-center text-3xl font-black text-emerald-400">{formatCurrency(savingsResult.annualSaving)}</p>
                            <p className="text-center text-xs text-slate-400 mt-2">Economia Anual</p>
                        </div>
                        <div className="bg-slate-900/50 p-6 rounded-xl border border-white/5 opacity-70">
                            <p className="text-center font-bold text-slate-400 text-lg mb-4">Média de Mercado</p>
                            <p className="text-center text-3xl font-bold text-slate-300">{formatCurrency(savingsResult.annualSaving * 0.8)}</p>
                            <p className="text-center text-xs text-slate-500 mt-2">Economia estimada (-20%)</p>
                        </div>
                        <div className="bg-slate-900/50 p-6 rounded-xl border border-white/5 opacity-50">
                            <p className="text-center font-bold text-slate-500 text-lg mb-4">Sem Gestão</p>
                            <p className="text-center text-3xl font-bold text-slate-600">R$ 0,00</p>
                            <p className="text-center text-xs text-slate-600 mt-2">Sem economia</p>
                        </div>
                    </div>
                </div>
            </div>
        )}

      </div>
    </div>
  );
}

export default function DashboardPage() {
    return (
        <Suspense fallback={<div className="h-screen flex items-center justify-center bg-slate-950"><Loader2 className="w-10 h-10 text-cyan-500 animate-spin"/></div>}>
            <DashboardPageContent />
        </Suspense>
    )
}
