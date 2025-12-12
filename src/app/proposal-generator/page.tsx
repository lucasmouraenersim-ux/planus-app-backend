"use client";

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  User, MapPin, Zap, FileText, Save, 
  CheckCircle2, DollarSign, Percent, ArrowRight, ArrowLeft,
  Trophy, Sun, Building2, Wallet, ChevronLeft, ChevronRight, Star, Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from "@/hooks/use-toast";

// Componente para animar números
const AnimatedNumber = ({ value, prefix = "", suffix = "" }: { value: number, prefix?: string, suffix?: string }) => {
  const [displayValue, setDisplayValue] = useState(0);
  const duration = 800; 

  useEffect(() => {
    let startTimestamp: number | null = null;
    const startValue = displayValue;

    const animationFrame = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      const nextValue = startValue + (value - startValue) * progress;
      
      setDisplayValue(nextValue);
      
      if (progress < 1) {
        requestAnimationFrame(animationFrame);
      }
    };
    requestAnimationFrame(animationFrame);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return <>{prefix}{displayValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{suffix}</>;
};


// --- DADOS DAS COMERCIALIZADORAS ---
const providers = [
  {
    id: 'bc',
    name: 'BC Energia',
    logo: 'https://raw.githubusercontent.com/LucasMouraChaser/campanhassent/bc761e2a925f19d5436b3642acb35fac8e3075f8/BC-ENERGIA.png',
    color: 'emerald', 
    icon: Zap,
    description: 'Solidez e confiança. Ideal para perfis de consumo variados com atendimento premium local.'
  },
  {
    id: 'bowe',
    name: 'Bowe Holding',
    logo: 'https://raw.githubusercontent.com/LucasMouraChaser/campanhassent/bc761e2a925f19d5436b3642acb35fac8e3075f8/logo_bow-e-holding_NU3tgD.png',
    color: 'purple',
    icon: Wallet,
    description: 'Até 30% de desconto para clientes acima de 20.000 kWh. Opção de Cashback de R$200 por indicação.'
  },
  {
    id: 'bolt',
    name: 'Bolt Energy',
    logo: 'https://raw.githubusercontent.com/LucasMouraChaser/campanhassent/bc761e2a925f19d5436b3642acb35fac8e3075f8/Bolt%20Energy.jpg',
    color: 'blue',
    icon: Building2,
    description: 'Descontos agressivos na Alta Tensão. Unificação de tarifas (Ponta/Fora Ponta) e 50% de desconto na demanda.'
  },
  {
    id: 'capibolt',
    name: 'Capibolt',
    logo: 'https://raw.githubusercontent.com/LucasMouraChaser/campanhassent/main/Capibolt.png',
    color: 'cyan',
    icon: Sun,
    description: 'Desconto de 30% para clientes acima de 5.000 kWh. Atende clientes com excedentes de painéis solares.'
  },
  {
    id: 'enersim',
    name: 'Enersim',
    logo: 'https://enersim.com.br/wp-content/uploads/2021/06/Logo-Enersim-1.png', 
    color: 'orange',
    icon: Trophy,
    description: 'Desconto de até 20% para qualquer consumo. Atende também clientes cadastrados no benefício Baixa Renda.'
  }
];

export default function ProposalGeneratorPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [currentStep, setCurrentStep] = useState(1);
  const [activeIndex, setActiveIndex] = useState(0); 

  const [formData, setFormData] = useState({
    clienteNome: '',
    clienteCnpjCpf: '',
    clienteCep: '',
    clienteRua: '',
    clienteNumero: '',
    clienteBairro: '',
    clienteCidade: '',
    clienteUF: '',
    codigoClienteInstalacao: '',
    distribuidora: '',
    comercializadora: '',
    item1Quantidade: '1500',
    currentTariff: '0.98',
    desconto: '15',
    cobreBandeira: true,
    comFidelidade: true,
    ligacao: 'TRIFASICO',
    classificacao: 'RESIDENCIAL-B1'
  });

  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      item1Quantidade: searchParams.get('item1Quantidade') || prev.item1Quantidade,
      clienteUF: searchParams.get('clienteUF') || prev.clienteUF,
      currentTariff: searchParams.get('currentTariff') || prev.currentTariff,
      desconto: searchParams.get('promotionalRate') || searchParams.get('fixedRate') || prev.desconto
    }));
  }, [searchParams]);

  useEffect(() => {
    setFormData(prev => ({ ...prev, comercializadora: providers[activeIndex].name }));
  }, [activeIndex]);

  const handleBlurCep = async () => {
    const cep = formData.clienteCep.replace(/\D/g, '');
    if (cep.length === 8) {
      try {
        const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
        const data = await res.json();
        if (!data.erro) {
          setFormData(prev => ({
            ...prev,
            clienteRua: data.logradouro,
            clienteBairro: data.bairro,
            clienteCidade: data.localidade,
            clienteUF: data.uf
          }));
          toast({ title: "Endereço encontrado!", description: `${data.logradouro}` });
        }
      } catch (error) { console.error(error); }
    }
  };

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleNextProvider = () => {
    setActiveIndex((prev) => (prev + 1) % providers.length);
  };

  const handlePrevProvider = () => {
    setActiveIndex((prev) => (prev - 1 + providers.length) % providers.length);
  };

  const handleSubmit = () => {
    const params = new URLSearchParams();
    Object.entries(formData).forEach(([key, value]) => params.set(key, String(value)));
    router.push(`/proposal?${params.toString()}`);
  };

  const consumo = Number(formData.item1Quantidade.replace(',', '.')) || 0;
  const tarifa = Number(formData.currentTariff.replace(',', '.')) || 0;
  const desconto = Number(formData.desconto) || 0;
  const valorFaturaAtual = consumo * tarifa;
  const economiaMensal = valorFaturaAtual * (desconto / 100);
  const economiaAnual = economiaMensal * 12;
  const novoValorFatura = valorFaturaAtual - economiaMensal;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-300 font-sans relative overflow-hidden flex flex-col">
      
      <style jsx global>{`
        .glass-panel { background: rgba(30, 41, 59, 0.4); backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.05); box-shadow: 0 4px 30px rgba(0, 0, 0, 0.1); }
        .glass-card-premium { 
            background: linear-gradient(135deg, rgba(30, 41, 59, 0.8), rgba(15, 23, 42, 0.9)); 
            border: 1px solid rgba(255, 255, 255, 0.08); 
            box-shadow: 0 10px 40px -10px rgba(0,0,0,0.5);
            backdrop-filter: blur(20px);
        }
        
        .carousel-active { transform: scale(1.3); z-index: 10; opacity: 1; }
        .carousel-inactive { transform: scale(0.8); z-index: 1; opacity: 0.4; filter: blur(2px) grayscale(80%); }
        
        @keyframes spin-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .active-ring {
          position: absolute; inset: -4px; border-radius: 50%;
          background: conic-gradient(from 0deg, transparent 0%, #06b6d4 50%, #10b981 100%);
          animation: spin-slow 3s linear infinite;
          padding: 3px; 
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor; mask-composite: exclude;
        }

        .animate-blob { animation: blob 10s infinite; }
        @keyframes blob { 0% { transform: translate(0px, 0px) scale(1); } 33% { transform: translate(30px, -50px) scale(1.1); } 66% { transform: translate(-20px, 20px) scale(0.9); } 100% { transform: translate(0px, 0px) scale(1); } }
      `}</style>
      
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl opacity-30 animate-blob"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl opacity-30 animate-blob"></div>
      </div>

      <div className="relative z-10 p-4 md:p-8 w-full max-w-7xl mx-auto flex-1 flex flex-col">
        
        {/* Header */}
        <div className="mb-6 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <div className="p-2 bg-gradient-to-tr from-cyan-600 to-blue-600 rounded-lg shadow-lg"><FileText className="w-5 h-5 text-white" /></div>
              Gerador de Propostas
            </h1>
            <div className="flex items-center gap-2 mt-2">
                <div className={`h-1 w-8 rounded-full transition-all ${currentStep >= 1 ? 'bg-cyan-500' : 'bg-slate-700'}`}></div>
                <div className={`h-1 w-8 rounded-full transition-all ${currentStep >= 2 ? 'bg-cyan-500' : 'bg-slate-700'}`}></div>
                <span className="text-xs text-slate-400 ml-2">Passo {currentStep} de 2</span>
            </div>
          </div>
          
          <div className="flex gap-3">
             {currentStep === 2 && (
                 <Button variant="outline" onClick={() => setCurrentStep(1)} className="border-slate-700 hover:bg-slate-800 text-slate-300">
                    <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
                 </Button>
             )}
             {currentStep === 1 ? (
                 <Button onClick={() => setCurrentStep(2)} className="bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg px-6">
                    Avançar <ArrowRight className="w-4 h-4 ml-2" />
                 </Button>
             ) : (
                 <Button onClick={handleSubmit} className="bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg px-6">
                    <Save className="w-4 h-4 mr-2" /> Gerar Proposta Final
                 </Button>
             )}
          </div>
        </div>

        {/* === PASSO 1: FORMULÁRIO === */}
        {currentStep === 1 && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="lg:col-span-2 space-y-6">
                    <div className="glass-panel p-6 rounded-2xl">
                        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2"><User className="w-5 h-5 text-cyan-400" /> Dados do Cliente</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2"><Label>Nome / Razão Social</Label><Input placeholder="Ex: Mercado Mix LTDA" className="bg-slate-900/50 border-white/10 text-white" value={formData.clienteNome} onChange={e => handleChange('clienteNome', e.target.value)} /></div>
                            <div className="space-y-2"><Label>CPF / CNPJ</Label><Input placeholder="00.000.000/0001-00" className="bg-slate-900/50 border-white/10 text-white" value={formData.clienteCnpjCpf} onChange={e => handleChange('clienteCnpjCpf', e.target.value)} /></div>
                        </div>
                    </div>
                    <div className="glass-panel p-6 rounded-2xl">
                        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2"><MapPin className="w-5 h-5 text-purple-400" /> Endereço da Unidade</h2>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="md:col-span-1 space-y-2"><Label>CEP</Label><Input placeholder="00000-000" className="bg-slate-900/50 border-white/10 text-white" value={formData.clienteCep} onChange={e => handleChange('clienteCep', e.target.value)} onBlur={handleBlurCep} /></div>
                            <div className="md:col-span-3 space-y-2"><Label>Rua</Label><Input placeholder="Logradouro..." className="bg-slate-900/50 border-white/10 text-white" value={formData.clienteRua} onChange={e => handleChange('clienteRua', e.target.value)} /></div>
                            <div className="md:col-span-1 space-y-2"><Label>Número</Label><Input placeholder="Nº" className="bg-slate-900/50 border-white/10 text-white" value={formData.clienteNumero} onChange={e => handleChange('clienteNumero', e.target.value)} /></div>
                            <div className="md:col-span-1 space-y-2"><Label>Bairro</Label><Input placeholder="Bairro" className="bg-slate-900/50 border-white/10 text-white" value={formData.clienteBairro} onChange={e => handleChange('clienteBairro', e.target.value)} /></div>
                            <div className="md:col-span-1 space-y-2"><Label>Cidade</Label><Input placeholder="Cidade" className="bg-slate-900/50 border-white/10 text-white" value={formData.clienteCidade} onChange={e => handleChange('clienteCidade', e.target.value)} /></div>
                            <div className="md:col-span-1 space-y-2"><Label>UF</Label><Input placeholder="UF" className="bg-slate-900/50 border-white/10 text-white" value={formData.clienteUF} onChange={e => handleChange('clienteUF', e.target.value)} /></div>
                        </div>
                    </div>
                    <div className="glass-panel p-6 rounded-2xl">
                        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2"><Zap className="w-5 h-5 text-yellow-400" /> Dados de Energia</h2>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-2"><Label>Nº da UC</Label><Input placeholder="Ex: 6555432" className="bg-slate-900/50 border-white/10 text-white" value={formData.codigoClienteInstalacao} onChange={e => handleChange('codigoClienteInstalacao', e.target.value)} /></div>
                            <div className="space-y-2"><Label>Distribuidora</Label><Input placeholder="Ex: Neoenergia" className="bg-slate-900/50 border-white/10 text-white" value={formData.distribuidora} onChange={e => handleChange('distribuidora', e.target.value)} /></div>
                            <div className="space-y-2"><Label>Tipo</Label><Select><SelectTrigger className="bg-slate-900/50 border-white/10 text-white"><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent className="bg-slate-900 border-slate-700 text-white"><SelectItem value="mono">Monofásico</SelectItem><SelectItem value="bi">Bifásico</SelectItem><SelectItem value="tri">Trifásico</SelectItem></SelectContent></Select></div>
                            <div className="space-y-2"><Label>Consumo Médio (kWh)</Label><div className="relative"><Zap className="absolute left-3 top-3 w-4 h-4 text-slate-500" /><Input type="number" className="bg-slate-900/50 border-white/10 pl-10 text-white font-bold" value={formData.item1Quantidade} onChange={e => handleChange('item1Quantidade', e.target.value)} /></div></div>
                            <div className="space-y-2"><Label>Tarifa Vigente (R$)</Label><div className="relative"><DollarSign className="absolute left-3 top-3 w-4 h-4 text-slate-500" /><Input className="bg-slate-900/50 border-white/10 pl-10 text-white font-bold" value={formData.currentTariff} onChange={e => handleChange('currentTariff', e.target.value)} /></div></div>
                            <div className="space-y-2"><Label>Desconto (%)</Label><div className="relative"><Percent className="absolute left-3 top-3 w-4 h-4 text-emerald-500" /><Input type="number" className="bg-emerald-500/10 border-emerald-500/20 pl-10 text-emerald-400 font-bold" value={formData.desconto} onChange={e => handleChange('desconto', e.target.value)} /></div></div>
                        </div>
                    </div>
                </div>

                {/* --- NOVO CARD DE RESUMO --- */}
                <div className="lg:col-span-1">
                    <div className="sticky top-8 glass-card-premium rounded-2xl p-0 overflow-hidden group">
                        <div className="relative bg-gradient-to-r from-slate-900 to-slate-800 p-6 border-b border-white/5">
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><Sparkles className="w-16 h-16 text-cyan-400" /></div>
                            <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-widest mb-1 flex items-center gap-2"><FileText className="w-3 h-3" /> Resumo da Simulação</h3>
                            <div className="text-xl font-bold text-white truncate">{formData.clienteNome || 'Novo Cliente'}</div>
                        </div>
                        <div className="p-6 space-y-6">
                            <div className="space-y-3">
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-slate-400">Fatura Atual (Estimada)</span>
                                    <span className="text-white font-medium line-through decoration-red-500/50 decoration-2">R$ {valorFaturaAtual.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
                                </div>
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-cyan-400 font-medium flex items-center gap-2"><Zap className="w-4 h-4" /> Nova Fatura</span>
                                    <span className="text-white font-bold text-lg"><AnimatedNumber value={novoValorFatura} prefix="R$ " /></span>
                                </div>
                            </div>
                            <div className="relative bg-emerald-600 rounded-xl p-5 text-center shadow-lg shadow-emerald-900/30 overflow-hidden transform transition-transform group-hover:scale-[1.02]">
                                <div className="absolute -right-4 -top-4 w-16 h-16 bg-white/10 rounded-full blur-xl"></div>
                                <p className="text-emerald-100 text-[10px] font-bold uppercase tracking-wider mb-1">Economia Anual Estimada</p>
                                <p className="text-3xl font-black text-white drop-shadow-md"><AnimatedNumber value={economiaAnual} prefix="R$ " /></p>
                                <div className="mt-3 inline-flex items-center gap-1 bg-black/20 px-3 py-1 rounded-full text-xs text-white font-medium backdrop-blur-sm">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-300" /> {desconto}% de Desconto Garantido
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* === PASSO 2: CARROSSEL === */}
        {currentStep === 2 && (
            <div className="flex flex-col items-center justify-center space-y-10 animate-in zoom-in-95 duration-500 py-4">
                <div className="text-center">
                    <h2 className="text-3xl font-bold text-white mb-2">Escolha a Parceira Ideal</h2>
                    <p className="text-slate-400">Deslize para selecionar a melhor opção para este perfil.</p>
                </div>
                <div className="relative w-full max-w-4xl h-48 flex items-center justify-center">
                    <button onClick={handlePrevProvider} className="absolute left-0 z-20 p-2 rounded-full bg-slate-800/80 hover:bg-slate-700 text-white transition-all hover:scale-110"><ChevronLeft className="w-8 h-8" /></button>
                    <div className="flex items-center justify-center gap-6 perspective-1000">
                        {[-1, 0, 1].map((offset) => {
                            const index = (activeIndex + offset + providers.length) % providers.length;
                            const provider = providers[index];
                            const isActive = offset === 0;
                            return (
                                <div 
                                    key={provider.id}
                                    onClick={() => setActiveIndex(index)}
                                    className={`relative transition-all duration-500 ease-out cursor-pointer rounded-full overflow-visible flex items-center justify-center bg-white ${isActive ? 'w-44 h-44 carousel-active' : 'w-24 h-24 carousel-inactive'}`}
                                >
                                    {isActive && <div className="active-ring"></div>}
                                    <div className="w-full h-full rounded-full flex items-center justify-center p-4 shadow-2xl relative z-10 border-4 border-slate-900 bg-white overflow-hidden">
                                        <img src={provider.logo} alt={provider.name} className="w-full h-full object-contain" />
                                    </div>
                                    {isActive && (<div className="absolute bottom-0 right-0 bg-emerald-500 text-white p-2 rounded-full shadow-lg z-20"><CheckCircle2 className="w-6 h-6" /></div>)}
                                </div>
                            );
                        })}
                    </div>
                    <button onClick={handleNextProvider} className="absolute right-0 z-20 p-2 rounded-full bg-slate-800/80 hover:bg-slate-700 text-white transition-all hover:scale-110"><ChevronRight className="w-8 h-8" /></button>
                </div>

                {/* Cards Inferiores */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-5xl">
                    <div className="glass-panel p-8 rounded-2xl flex flex-col justify-center text-center border-t-4 border-t-cyan-500 relative overflow-hidden group">
                        <div className={`absolute inset-0 bg-${providers[activeIndex].color}-500/5 group-hover:bg-${providers[activeIndex].color}-500/10 transition-colors`}></div>
                        <div className="relative z-10">
                            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-800 border border-slate-700 text-cyan-400 text-sm font-bold mb-6 uppercase tracking-wider shadow-lg">
                                {React.createElement(providers[activeIndex].icon, { className: "w-4 h-4" })}
                                Vantagem Competitiva
                            </div>
                            <h3 className="text-3xl font-bold text-white mb-4">{providers[activeIndex].name}</h3>
                            <p className="text-lg text-slate-300 leading-relaxed font-light">{providers[activeIndex].description}</p>
                        </div>
                        <div className="mt-8 pt-6 border-t border-white/10 flex justify-center gap-6">
                            <div className="flex items-center gap-2"><Switch checked={formData.cobreBandeira} onCheckedChange={v => handleChange('cobreBandeira', v)} /><Label className="text-xs text-slate-400">Cobrir Bandeira</Label></div>
                            <div className="flex items-center gap-2"><Switch checked={formData.comFidelidade} onCheckedChange={v => handleChange('comFidelidade', v)} /><Label className="text-xs text-slate-400">Fidelidade 12m</Label></div>
                        </div>
                    </div>
                    <div className="glass-card-premium p-8 rounded-2xl flex flex-col justify-between border-t-4 border-t-emerald-500">
                        <div className="flex justify-between items-start mb-6">
                            <div><h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Simulação Final</h3><div className="text-2xl font-bold text-white mt-1 truncate max-w-[250px]">{formData.clienteNome}</div></div>
                            <div className="text-right"><div className="text-xs text-slate-500 uppercase">Fatura Atual</div><div className="text-lg font-medium text-slate-300 line-through decoration-red-500/50">R$ {valorFaturaAtual.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</div></div>
                        </div>
                        <div className="bg-slate-900/50 p-6 rounded-xl border border-white/5 mb-6">
                            <div className="flex justify-between items-center mb-2"><span className="text-slate-400">Nova Fatura</span><span className="text-2xl font-bold text-white">R$ {novoValorFatura.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span></div>
                            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden"><div className="h-full bg-emerald-500" style={{ width: `${100 - parseFloat(formData.desconto)}%` }}></div></div>
                        </div>
                        <div className="flex items-center justify-between bg-emerald-600 p-6 rounded-xl shadow-lg shadow-emerald-900/20 transform hover:scale-[1.02] transition-transform">
                            <div><p className="text-emerald-100 text-xs font-bold uppercase mb-1">Economia Anual</p><p className="text-3xl font-black text-white">R$ {economiaAnual.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p></div>
                            <div className="bg-white/20 backdrop-blur px-4 py-2 rounded-lg text-white font-bold">{formData.desconto}% OFF</div>
                        </div>
                    </div>
                </div>
            </div>
        )}
      </div>
    </div>
  );
}