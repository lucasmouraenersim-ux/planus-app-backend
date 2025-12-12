
"use client";

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  User, MapPin, Zap, FileText, Save, 
  CheckCircle2, DollarSign, Percent, ArrowRight, ArrowLeft,
  Star, Trophy, Sun, Building2, Wallet
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from "@/hooks/use-toast";
import Image from 'next/image';

// --- DADOS DAS COMERCIALIZADORAS (REGRAS DE NEGÓCIO) ---
const providers = [
  {
    id: 'BC Energia',
    name: 'BC Energia',
    logo: 'https://raw.githubusercontent.com/LucasMouraChaser/campanhassent/bc761e2a925f19d5436b3642acb35fac8e3075f8/BC-ENERGIA.png',
    color: 'emerald',
    icon: Zap,
    description: 'Solidez e confiança. Ideal para perfis de consumo variados com atendimento premium local.'
  },
  {
    id: 'Bowe Holding',
    name: 'Bowe',
    logo: 'https://raw.githubusercontent.com/LucasMouraChaser/campanhassent/bc761e2a925f19d5436b3642acb35fac8e3075f8/logo_bow-e-holding_NU3tgD.png',
    color: 'purple',
    icon: Wallet, // Cashback
    description: 'Até 30% de desconto para clientes acima de 20.000 kWh. Opção de Cashback de R$200 por indicação.'
  },
  {
    id: 'Enersim', // Supondo que você tenha o logo, ou usarei um placeholder
    name: 'Enersim',
    logo: 'https://enersim.com.br/wp-content/uploads/2021/06/Logo-Enersim-1.png', // Exemplo
    color: 'orange',
    icon: Trophy,
    description: 'Desconto de até 20% para qualquer consumo. Atende também clientes cadastrados no benefício Baixa Renda.'
  },
  {
    id: 'Bolt Energy',
    name: 'Bolt',
    logo: 'https://raw.githubusercontent.com/LucasMouraChaser/campanhassent/bc761e2a925f19d5436b3642acb35fac8e3075f8/Bolt%20Energy.jpg',
    color: 'blue',
    icon: Building2,
    description: 'Descontos agressivos na Alta Tensão. Unificação de tarifas (Ponta/Fora Ponta) e 50% de desconto na demanda.'
  },
  {
    id: 'Capibolt',
    name: 'Capibolt',
    logo: 'https://raw.githubusercontent.com/LucasMouraChaser/campanhassent/main/Capibolt.png',
    color: 'cyan',
    icon: Sun,
    description: 'Desconto de 30% para clientes acima de 5.000 kWh. Atende clientes com excedentes de painéis solares.'
  }
];

export default function ProposalGeneratorPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  // Controle de Passos (1 = Dados, 2 = Comercializadora)
  const [currentStep, setCurrentStep] = useState(1);

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
    comercializadora: '', // Será preenchido no passo 2
    item1Quantidade: '1500',
    currentTariff: '0.98',
    desconto: '15',
    cobreBandeira: true,
    comFidelidade: true,
    ligacao: 'TRIFASICO',
    classificacao: 'RESIDENCIAL-B1'
  });

  // Preencher dados iniciais
  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      item1Quantidade: searchParams.get('item1Quantidade') || prev.item1Quantidade,
      clienteUF: searchParams.get('clienteUF') || prev.clienteUF,
      currentTariff: searchParams.get('currentTariff') || prev.currentTariff,
      desconto: searchParams.get('promotionalRate') || searchParams.get('fixedRate') || prev.desconto
    }));
  }, [searchParams]);

  // Busca de CEP
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

  const handleSubmit = () => {
    if (!formData.comercializadora) {
      toast({ title: "Selecione uma Comercializadora", description: "Escolha um parceiro no Passo 2.", variant: "destructive" });
      return;
    }
    const params = new URLSearchParams();
    Object.entries(formData).forEach(([key, value]) => params.set(key, String(value)));
    router.push(`/proposal?${params.toString()}`);
  };

  // Cálculos do Live Preview
  const consumo = Number(formData.item1Quantidade.replace(',', '.')) || 0;
  const tarifa = Number(formData.currentTariff.replace(',', '.')) || 0;
  const desconto = Number(formData.desconto) || 0;
  const valorFaturaAtual = consumo * tarifa;
  const economiaMensal = valorFaturaAtual * (desconto / 100);
  const economiaAnual = economiaMensal * 12;
  const novoValorFatura = valorFaturaAtual - economiaMensal;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-300 font-sans relative overflow-hidden">
      
      {/* Styles Globais */}
      <style jsx global>{`
        .glass-panel { background: rgba(30, 41, 59, 0.4); backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.05); box-shadow: 0 4px 30px rgba(0, 0, 0, 0.1); }
        .glass-card { background: linear-gradient(145deg, rgba(30, 41, 59, 0.6), rgba(15, 23, 42, 0.6)); border: 1px solid rgba(255, 255, 255, 0.05); }
        .provider-ring-selected { box-shadow: 0 0 30px rgba(6, 182, 212, 0.4); border-color: #06b6d4; transform: scale(1.1); }
        .slide-in { animation: slideIn 0.4s ease-out forwards; }
        @keyframes slideIn { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
      `}</style>
      
      {/* Background */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl opacity-30"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl opacity-30"></div>
      </div>

      <div className="relative z-10 p-4 md:p-8 max-w-7xl mx-auto">
        
        {/* Header com Progresso */}
        <div className="mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <div className="p-2 bg-gradient-to-tr from-cyan-600 to-blue-600 rounded-xl shadow-lg"><FileText className="w-6 h-6 text-white" /></div>
              Gerador de Propostas
            </h1>
            <div className="flex items-center gap-2 mt-2">
                <div className={`h-1 w-12 rounded-full transition-all ${currentStep >= 1 ? 'bg-cyan-500' : 'bg-slate-700'}`}></div>
                <div className={`h-1 w-12 rounded-full transition-all ${currentStep >= 2 ? 'bg-cyan-500' : 'bg-slate-700'}`}></div>
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
                 <Button onClick={() => setCurrentStep(2)} className="bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg px-8">
                    Avançar <ArrowRight className="w-4 h-4 ml-2" />
                 </Button>
             ) : (
                 <Button onClick={handleSubmit} className="bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg px-8">
                    <Save className="w-4 h-4 mr-2" /> Gerar Proposta Final
                 </Button>
             )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* === CONTEÚDO PRINCIPAL (VARIA POR PASSO) === */}
          <div className="lg:col-span-2 space-y-6 slide-in">
            
            {/* PASSO 1: DADOS DO CLIENTE */}
            {currentStep === 1 && (
                <>
                    {/* Seção 1: Cliente */}
                    <div className="glass-panel p-6 rounded-2xl">
                    <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2"><User className="w-5 h-5 text-cyan-400" /> Dados do Cliente</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2"><Label>Nome / Razão Social</Label><Input placeholder="Ex: Mercado Mix LTDA" className="bg-slate-900/50 border-white/10" value={formData.clienteNome} onChange={e => handleChange('clienteNome', e.target.value)} /></div>
                        <div className="space-y-2"><Label>CPF / CNPJ</Label><Input placeholder="00.000.000/0001-00" className="bg-slate-900/50 border-white/10" value={formData.clienteCnpjCpf} onChange={e => handleChange('clienteCnpjCpf', e.target.value)} /></div>
                    </div>
                    </div>

                    {/* Seção 2: Localização */}
                    <div className="glass-panel p-6 rounded-2xl">
                    <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2"><MapPin className="w-5 h-5 text-purple-400" /> Endereço da Unidade</h2>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="md:col-span-1 space-y-2"><Label>CEP</Label><Input placeholder="00000-000" className="bg-slate-900/50 border-white/10" value={formData.clienteCep} onChange={e => handleChange('clienteCep', e.target.value)} onBlur={handleBlurCep} /></div>
                        <div className="md:col-span-3 space-y-2"><Label>Rua</Label><Input placeholder="Logradouro..." className="bg-slate-900/50 border-white/10" value={formData.clienteRua} onChange={e => handleChange('clienteRua', e.target.value)} /></div>
                        <div className="md:col-span-1 space-y-2"><Label>Número</Label><Input placeholder="Nº" className="bg-slate-900/50 border-white/10" value={formData.clienteNumero} onChange={e => handleChange('clienteNumero', e.target.value)} /></div>
                        <div className="md:col-span-1 space-y-2"><Label>Bairro</Label><Input placeholder="Bairro" className="bg-slate-900/50 border-white/10" value={formData.clienteBairro} onChange={e => handleChange('clienteBairro', e.target.value)} /></div>
                        <div className="md:col-span-1 space-y-2"><Label>Cidade</Label><Input placeholder="Cidade" className="bg-slate-900/50 border-white/10" value={formData.clienteCidade} onChange={e => handleChange('clienteCidade', e.target.value)} /></div>
                        <div className="md:col-span-1 space-y-2"><Label>UF</Label><Input placeholder="UF" className="bg-slate-900/50 border-white/10" value={formData.clienteUF} onChange={e => handleChange('clienteUF', e.target.value)} /></div>
                    </div>
                    </div>

                    {/* Seção 3: Energia */}
                    <div className="glass-panel p-6 rounded-2xl">
                    <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2"><Zap className="w-5 h-5 text-yellow-400" /> Dados de Energia</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2"><Label>Nº da UC</Label><Input placeholder="Ex: 6555432" className="bg-slate-900/50 border-white/10" value={formData.codigoClienteInstalacao} onChange={e => handleChange('codigoClienteInstalacao', e.target.value)} /></div>
                        <div className="space-y-2"><Label>Distribuidora</Label><Input placeholder="Ex: Neoenergia" className="bg-slate-900/50 border-white/10" value={formData.distribuidora} onChange={e => handleChange('distribuidora', e.target.value)} /></div>
                        <div className="space-y-2"><Label>Tipo</Label><Select><SelectTrigger className="bg-slate-900/50 border-white/10"><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent className="bg-slate-900 border-slate-700 text-white"><SelectItem value="mono">Monofásico</SelectItem><SelectItem value="bi">Bifásico</SelectItem><SelectItem value="tri">Trifásico</SelectItem></SelectContent></Select></div>
                        <div className="space-y-2"><Label>Consumo Médio (kWh)</Label><div className="relative"><Zap className="absolute left-3 top-3 w-4 h-4 text-slate-500" /><Input type="number" className="bg-slate-900/50 border-white/10 pl-10 text-white font-bold" value={formData.item1Quantidade} onChange={e => handleChange('item1Quantidade', e.target.value)} /></div></div>
                        <div className="space-y-2"><Label>Tarifa Vigente (R$)</Label><div className="relative"><DollarSign className="absolute left-3 top-3 w-4 h-4 text-slate-500" /><Input className="bg-slate-900/50 border-white/10 pl-10 text-white font-bold" value={formData.currentTariff} onChange={e => handleChange('currentTariff', e.target.value)} /></div></div>
                        <div className="space-y-2"><Label>Desconto (%)</Label><div className="relative"><Percent className="absolute left-3 top-3 w-4 h-4 text-emerald-500" /><Input type="number" className="bg-emerald-500/10 border-emerald-500/20 pl-10 text-emerald-400 font-bold" value={formData.desconto} onChange={e => handleChange('desconto', e.target.value)} /></div></div>
                    </div>
                    </div>
                </>
            )}

            {/* PASSO 2: SELEÇÃO DE COMERCIALIZADORA (O MARKETPLACE) */}
            {currentStep === 2 && (
                <div className="space-y-6">
                    <div className="text-center mb-8">
                        <h2 className="text-2xl font-bold text-white">Escolha a Parceira Ideal</h2>
                        <p className="text-slate-400">Selecione a comercializadora que melhor atende o perfil deste cliente.</p>
                    </div>

                    {/* Galeria Dinâmica (Carrossel Flex) */}
                    <div className="flex flex-wrap justify-center gap-6 py-4">
                        {providers.map((provider) => {
                            const isSelected = formData.comercializadora === provider.name;
                            return (
                                <div 
                                    key={provider.id} 
                                    onClick={() => handleChange('comercializadora', provider.name)}
                                    className={`
                                        group relative w-32 h-32 rounded-full cursor-pointer transition-all duration-300 bg-slate-800 border-4 
                                        flex items-center justify-center overflow-hidden
                                        ${isSelected ? 'provider-ring-selected border-cyan-500' : 'border-slate-700 hover:border-slate-500 hover:scale-105'}
                                    `}
                                >
                                    {/* Logo */}
                                    <div className="w-24 h-24 relative">
                                        <img src={provider.logo} alt={provider.name} className="object-contain w-full h-full" />
                                    </div>
                                    
                                    {/* Checkmark se selecionado */}
                                    {isSelected && (
                                        <div className="absolute inset-0 bg-cyan-900/60 flex items-center justify-center backdrop-blur-[2px]">
                                            <CheckCircle2 className="w-10 h-10 text-white drop-shadow-lg" />
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>

                    {/* Detalhes da Seleção */}
                    <div className="glass-panel p-8 rounded-2xl min-h-[200px] flex items-center justify-center text-center transition-all duration-500">
                        {formData.comercializadora ? (
                            (() => {
                                const selected = providers.find(p => p.name === formData.comercializadora)!;
                                return (
                                    <div className="max-w-2xl slide-in">
                                        <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-slate-800 border border-slate-700 text-cyan-400 text-sm font-bold mb-4 uppercase tracking-wider">
                                            <selected.icon className="w-4 h-4" /> Vantagem Competitiva
                                        </div>
                                        <h3 className="text-2xl font-bold text-white mb-3">{selected.name}</h3>
                                        <p className="text-lg text-slate-300 leading-relaxed">{selected.description}</p>
                                    </div>
                                )
                            })()
                        ) : (
                            <div className="text-slate-500 flex flex-col items-center">
                                <Star className="w-12 h-12 mb-3 opacity-20" />
                                <p>Clique em uma logo acima para ver as vantagens exclusivas.</p>
                            </div>
                        )}
                    </div>

                    {/* Checkboxes Finais */}
                    <div className="mt-6 p-4 bg-slate-800/50 rounded-xl border border-white/5 flex flex-col md:flex-row gap-6 justify-center">
                        <div className="flex items-center gap-3">
                            <Switch checked={formData.cobreBandeira} onCheckedChange={v => handleChange('cobreBandeira', v)} />
                            <div className="flex flex-col"><Label className="text-sm cursor-pointer">Cobrir Bandeira Tarifária?</Label><span className="text-xs text-slate-500">Se ativo, a empresa absorve custos extras.</span></div>
                        </div>
                        <div className="flex items-center gap-3">
                            <Switch checked={formData.comFidelidade} onCheckedChange={v => handleChange('comFidelidade', v)} />
                            <div className="flex flex-col"><Label className="text-sm cursor-pointer">Fidelidade (12 meses)</Label><span className="text-xs text-slate-500">Aplica multa em caso de cancelamento.</span></div>
                        </div>
                    </div>
                </div>
            )}

          </div>

          {/* === COLUNA DIREITA: LIVE PREVIEW (SEMPRE VISÍVEL) === */}
          <div className="lg:col-span-1">
            <div className="sticky top-8 space-y-6">
                
                {/* Cartão de Resumo */}
                <div className="glass-card rounded-2xl overflow-hidden shadow-2xl shadow-black/50 border-t-4 border-t-cyan-500 relative">
                    <div className="p-6">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Resumo da Simulação</h3>
                        <div className="text-xl font-bold text-white mb-6 truncate">{formData.clienteNome || 'Cliente'}</div>

                        <div className="space-y-4">
                            <div className="flex justify-between items-center py-3 border-b border-white/5">
                                <span className="text-slate-400 text-sm">Fatura Atual (Estimada)</span>
                                <span className="text-white font-medium">R$ {valorFaturaAtual.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                            </div>
                            <div className="flex justify-between items-center py-3 border-b border-white/5">
                                <span className="text-slate-400 text-sm flex items-center gap-2"><Zap className="w-4 h-4 text-emerald-400"/> Nova Fatura</span>
                                <span className="text-emerald-400 font-bold text-lg">R$ {novoValorFatura.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                            </div>
                        </div>

                        <div className="mt-6 bg-gradient-to-r from-emerald-600 to-teal-500 rounded-xl p-5 text-center shadow-lg border border-emerald-400/30">
                            <p className="text-emerald-100 text-xs font-medium uppercase mb-1">Economia Anual Estimada</p>
                            <p className="text-3xl font-extrabold text-white">R$ {economiaAnual.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
                            <div className="mt-2 text-xs bg-black/20 rounded-full px-2 py-1 inline-block text-emerald-100 border border-white/10">
                                {desconto}% de Desconto
                            </div>
                        </div>
                    </div>
                    
                    {formData.comercializadora && (
                        <div className="bg-slate-900/80 p-3 border-t border-white/5 text-center flex items-center justify-center gap-2">
                            <span className="text-xs text-slate-400">Entregue por:</span>
                            <span className="text-cyan-400 font-bold text-sm uppercase">{formData.comercializadora}</span>
                        </div>
                    )}
                </div>

                {/* Dica Contextual */}
                <div className="glass-panel rounded-xl p-5 border border-dashed border-slate-700">
                    <div className="flex gap-3">
                        <div className="mt-1"><Star className="w-5 h-5 text-yellow-400" /></div>
                        <div>
                            <h4 className="font-semibold text-white text-sm">Dica de Venda</h4>
                            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                                {currentStep === 1 ? "Preencha os dados de consumo com atenção. Eles são a base para o cálculo da economia." : "Escolha a parceira que oferece o benefício mais relevante para a dor do cliente (ex: Cashback ou Alta Tensão)."}
                            </p>
                        </div>
                    </div>
                </div>

            </div>
          </div>

        </div>
      </div>
    </div>
  );
}