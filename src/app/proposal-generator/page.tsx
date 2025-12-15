
      
"use client";

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  User, MapPin, Zap, FileText, Save, 
  CheckCircle2, DollarSign, Percent, ArrowRight, ArrowLeft,
  Trophy, Sun, Building2, Wallet, ChevronLeft, ChevronRight, Sparkles, Upload, Loader2, Phone, Hash, UtilityPole
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/contexts/AuthContext';
import { uploadFile } from '@/lib/firebase/storage';
import { saveProposalAction } from '@/actions/saveProposal'; 

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
  const { appUser, userAppRole } = useAuth();

  const [currentStep, setCurrentStep] = useState(1);
  const [activeIndex, setActiveIndex] = useState(0); 
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);

  const [formData, setFormData] = useState({
    clienteNome: '',
    clienteCnpjCpf: '',
    clienteTelefone: '',
    clienteCep: '',
    clienteRua: '',
    clienteNumero: '',
    clienteBairro: '',
    clienteCidade: '',
    clienteUF: '',
    codigoClienteInstalacao: '', // UC
    distribuidora: '',
    comercializadora: '',
    item1Quantidade: '1500',
    currentTariff: '0.98',
    desconto: '15',
    cobreBandeira: true,
    comFidelidade: true,
    ligacao: 'TRIFASICO', // Tipo de Ligação
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

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleAIUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setInvoiceFile(file);
    setIsProcessingAI(true);
    toast({ title: "🤖 Lendo Fatura...", description: "A IA está extraindo os dados..." });
    
    try {
        const form = new FormData();
        form.append('file', file);
        const res = await fetch('/api/process-fatura', { method: 'POST', body: form });
        const data = await res.json();
        
        console.log("Dados recebidos da API:", data); // Debug
        
        if (data.consumoKwh) {
            setFormData(prev => ({
                ...prev,
                clienteNome: data.nomeCliente || prev.clienteNome,
                item1Quantidade: data.consumoKwh?.toString() || prev.item1Quantidade,
                // Corrigido: usa tarifaUnit ou unitPrice
                currentTariff: (data.tarifaUnit || data.unitPrice)?.toString() || prev.currentTariff,
                clienteRua: data.enderecoCompleto?.split(',')[0] || prev.clienteRua,
                clienteCidade: data.cidade || prev.clienteCidade,
                clienteUF: data.estado || prev.clienteUF,
                // Corrigido: usa distribuidora
                distribuidora: data.distribuidora || prev.distribuidora,
                // Corrigido: usa codigoCliente
                codigoClienteInstalacao: data.codigoCliente || prev.codigoClienteInstalacao
            }));
            toast({ title: "Sucesso!", description: "Dados preenchidos automaticamente.", className: "bg-emerald-500 text-white" });
        } else {
            toast({ title: "Aviso", description: "Alguns dados não foram encontrados.", variant: "destructive" });
        }
    } catch (error) {
        console.error("Erro no upload:", error);
        toast({ title: "Erro na Leitura", description: "Não foi possível ler os dados, preencha manualmente.", variant: "destructive" });
    } finally {
        setIsProcessingAI(false);
    }
};

  const handleSubmit = async () => {
    if (!formData.comercializadora) {
      toast({ title: "Atenção", description: "Selecione uma comercializadora.", variant: "destructive" });
      return;
    }
    if (!formData.clienteTelefone) {
        toast({ title: "Atenção", description: "O telefone do cliente é obrigatório.", variant: "destructive" });
        return;
    }

    setIsSaving(true);
    
    try {
        let pdfUrl = null;
        if (invoiceFile && appUser) {
            const path = `proposals/${appUser.uid}/${Date.now()}_${invoiceFile.name}`;
            pdfUrl = await uploadFile(invoiceFile, path);
        }

        const result = await saveProposalAction({
            ...formData,
            pdfUrl: pdfUrl,
            generatorName: appUser?.displayName || 'Desconhecido',
            generatorEmail: appUser?.email
        }, appUser!.uid, userAppRole!);

        if (result.success) {
            toast({ title: `Proposta #${result.proposalNumber} Gerada!`, description: "Redirecionando para visualização..." });
            const params = new URLSearchParams();
            Object.entries(formData).forEach(([key, value]) => params.set(key, String(value)));
            params.set('proposalNumber', result.proposalNumber.toString());
            router.push(`/proposal?${params.toString()}`);
        } else {
            toast({ title: "Erro", description: result.message, variant: "destructive" });
        }

    } catch (error) {
        console.error(error);
        toast({ title: "Erro", description: "Falha ao processar.", variant: "destructive" });
    } finally {
        setIsSaving(false);
    }
  };

  const handleNextProvider = () => setActiveIndex((prev) => (prev + 1) % providers.length);
  const handlePrevProvider = () => setActiveIndex((prev) => (prev - 1 + providers.length) % providers.length);
  const handleBlurCep = async () => {
    const cep = formData.clienteCep.replace(/\D/g, '');
    if (cep.length === 8) {
        try {
            const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
            const data = await res.json();
            if(!data.erro) setFormData(prev => ({...prev, clienteRua: data.logradouro, clienteBairro: data.bairro, clienteCidade: data.localidade, clienteUF: data.uf}));
        } catch(e) {}
    }
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
        .glass-card-premium { background: linear-gradient(135deg, rgba(30, 41, 59, 0.8), rgba(15, 23, 42, 0.9)); border: 1px solid rgba(255, 255, 255, 0.08); box-shadow: 0 10px 40px -10px rgba(0,0,0,0.5); backdrop-filter: blur(20px); }
        .carousel-active { transform: scale(1.3); z-index: 10; opacity: 1; }
        .carousel-inactive { transform: scale(0.8); z-index: 1; opacity: 0.4; filter: blur(2px) grayscale(80%); }
        @keyframes spin-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .active-ring { position: absolute; inset: -4px; border-radius: 50%; background: conic-gradient(from 0deg, transparent 0%, #06b6d4 50%, #10b981 100%); animation: spin-slow 3s linear infinite; padding: 3px; -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0); -webkit-mask-composite: xor; mask-composite: exclude; }
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
             {currentStep === 2 && <Button variant="outline" onClick={() => setCurrentStep(1)} className="border-slate-700 hover:bg-slate-800 text-slate-300"><ArrowLeft className="w-4 h-4 mr-2" /> Voltar</Button>}
             {currentStep === 1 ? (
                 <Button onClick={() => setCurrentStep(2)} className="bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg px-6">Avançar <ArrowRight className="w-4 h-4 ml-2" /></Button>
             ) : (
                 <Button onClick={handleSubmit} disabled={isSaving} className="bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg px-6">
                    {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : <Save className="w-4 h-4 mr-2" />} 
                    Gerar Proposta Final
                 </Button>
             )}
          </div>
        </div>

        {/* === PASSO 1 === */}
        {currentStep === 1 && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="lg:col-span-2 space-y-6">
                    
                    <div className="relative overflow-hidden rounded-2xl border border-cyan-500/30 bg-cyan-900/10 p-6 flex flex-col md:flex-row items-center justify-between gap-4 group hover:bg-cyan-900/20 transition-all">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-cyan-500/20 rounded-full text-cyan-400"><Sparkles className="w-6 h-6" /></div>
                            <div>
                                <h3 className="text-white font-bold">Preenchimento Automático com IA</h3>
                                <p className="text-sm text-slate-400">Arraste a fatura aqui para preencher os dados.</p>
                            </div>
                        </div>
                        <label className="cursor-pointer bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 shadow-lg shadow-cyan-500/20 transition-all">
                            {isProcessingAI ? <Loader2 className="w-4 h-4 animate-spin"/> : <Upload className="w-4 h-4"/>}
                            {isProcessingAI ? "Lendo..." : "Upload Fatura"}
                            <input type="file" accept=".pdf" className="hidden" onChange={handleAIUpload} />
                        </label>
                    </div>

                    <div className="glass-panel p-6 rounded-2xl">
                        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2"><User className="w-5 h-5 text-cyan-400" /> Dados do Cliente</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2"><Label>Nome / Razão Social</Label><Input placeholder="Ex: Mercado Mix LTDA" className="bg-slate-900/50 border-white/10 text-white" value={formData.clienteNome} onChange={e => handleChange('clienteNome', e.target.value)} /></div>
                            <div className="space-y-2"><Label>CPF / CNPJ</Label><Input placeholder="00.000.000/0001-00" className="bg-slate-900/50 border-white/10 text-white" value={formData.clienteCnpjCpf} onChange={e => handleChange('clienteCnpjCpf', e.target.value)} /></div>
                            <div className="space-y-2 md:col-span-2">
                                <Label className="text-white">Telefone / WhatsApp (Obrigatório)</Label>
                                <div className="relative">
                                    <Phone className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                                    <Input placeholder="(00) 90000-0000" className="bg-slate-900/50 border-white/10 pl-10 text-white" value={formData.clienteTelefone} onChange={e => handleChange('clienteTelefone', e.target.value)} />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="glass-panel p-6 rounded-2xl">
                        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2"><MapPin className="w-5 h-5 text-purple-400" /> Endereço</h2>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="md:col-span-1 space-y-2"><Label>CEP</Label><Input className="bg-slate-900/50 border-white/10 text-white" value={formData.clienteCep} onChange={e => handleChange('clienteCep', e.target.value)} onBlur={handleBlurCep} /></div>
                            <div className="md:col-span-3 space-y-2"><Label>Rua</Label><Input className="bg-slate-900/50 border-white/10 text-white" value={formData.clienteRua} onChange={e => handleChange('clienteRua', e.target.value)} /></div>
                            <div className="md:col-span-1 space-y-2"><Label>Número</Label><Input className="bg-slate-900/50 border-white/10 text-white" value={formData.clienteNumero} onChange={e => handleChange('clienteNumero', e.target.value)} /></div>
                            <div className="md:col-span-1 space-y-2"><Label>Bairro</Label><Input className="bg-slate-900/50 border-white/10 text-white" value={formData.clienteBairro} onChange={e => handleChange('clienteBairro', e.target.value)} /></div>
                            <div className="md:col-span-1 space-y-2"><Label>Cidade</Label><Input className="bg-slate-900/50 border-white/10 text-white" value={formData.clienteCidade} onChange={e => handleChange('clienteCidade', e.target.value)} /></div>
                            <div className="md:col-span-1 space-y-2"><Label>UF</Label><Input className="bg-slate-900/50 border-white/10 text-white" value={formData.clienteUF} onChange={e => handleChange('clienteUF', e.target.value)} /></div>
                        </div>
                    </div>
                    
                    <div className="glass-panel p-6 rounded-2xl">
                        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2"><Zap className="w-5 h-5 text-yellow-400" /> Dados de Energia</h2>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <Label>Nº da UC</Label>
                                <div className="relative">
                                    <Hash className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                                    <Input placeholder="Ex: 6555432" className="bg-slate-900/50 border-white/10 text-white pl-10" value={formData.codigoClienteInstalacao} onChange={e => handleChange('codigoClienteInstalacao', e.target.value)} />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Distribuidora</Label>
                                <div className="relative">
                                    <UtilityPole className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                                    <Input placeholder="Ex: Energisa" className="bg-slate-900/50 border-white/10 text-white pl-10" value={formData.distribuidora} onChange={e => handleChange('distribuidora', e.target.value)} />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Tipo</Label>
                                <Select value={formData.ligacao} onValueChange={v => handleChange('ligacao', v)}>
                                    <SelectTrigger className="bg-slate-900/50 border-white/10 text-white"><SelectValue placeholder="Selecione" /></SelectTrigger>
                                    <SelectContent className="bg-slate-900 border-slate-700 text-white">
                                        <SelectItem value="MONOFASICO">Monofásico</SelectItem>
                                        <SelectItem value="BIFASICO">Bifásico</SelectItem>
                                        <SelectItem value="TRIFASICO">Trifásico</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2"><Label>Consumo (kWh)</Label><Input type="number" className="bg-slate-900/50 border-white/10 text-white font-bold" value={formData.item1Quantidade} onChange={e => handleChange('item1Quantidade', e.target.value)} /></div>
                            <div className="space-y-2"><Label>Tarifa (R$)</Label><Input className="bg-slate-900/50 border-white/10 text-white font-bold" value={formData.currentTariff} onChange={e => handleChange('currentTariff', e.target.value)} /></div>
                            <div className="space-y-2"><Label>Desconto (%)</Label><Input type="number" className="bg-emerald-500/10 border-emerald-500/20 text-emerald-400 font-bold" value={formData.desconto} onChange={e => handleChange('desconto', e.target.value)} /></div>
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-1">
                    <div className="sticky top-8 glass-card-premium rounded-2xl p-6 space-y-4">
                        <div className="flex justify-between items-center">
                            <div>
                                <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-widest flex items-center gap-2"><FileText className="w-3 h-3" /> Resumo da Simulação</h3>
                                <div className="text-xl font-bold text-white truncate mt-1">{formData.clienteNome || 'Novo Cliente'}</div>
                            </div>
                            <Sparkles className="w-6 h-6 text-cyan-500/50" />
                        </div>
                        
                        <div className="border-t border-white/10 pt-4 space-y-3">
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-slate-400">Fatura Atual (Estimada)</span>
                                <span className="text-sm font-medium text-slate-400 line-through">{valorFaturaAtual.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-cyan-400 font-medium flex items-center gap-2"><Zap className="w-4 h-4"/> Nova Fatura</span>
                                <span className="text-lg font-bold text-white">{novoValorFatura.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</span>
                            </div>
                        </div>

                        <div className="relative bg-emerald-600 rounded-xl p-5 text-center shadow-lg shadow-emerald-900/30 mt-4">
                            <p className="text-emerald-100 text-[10px] font-bold uppercase tracking-wider mb-1">Economia Anual Estimada</p>
                            <p className="text-3xl font-black text-white drop-shadow-md">{economiaAnual.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</p>
                             <div className="mt-3 bg-emerald-700/50 text-emerald-100 text-xs font-semibold inline-flex items-center gap-1.5 px-3 py-1 rounded-full">
                                <CheckCircle2 className="w-3 h-3" />
                                {formData.desconto}% de Desconto Garantido
                            </div>
                        </div>

                        <div className="text-xs text-center text-slate-500 pt-4">Avance para escolher o parceiro de energia.</div>
                    </div>
                </div>
            </div>
        )}

        {currentStep === 2 && (
             <div className="flex flex-col items-center justify-center space-y-10 animate-in zoom-in-95 duration-500 py-4">
                 <div className="text-center"><h2 className="text-3xl font-bold text-white mb-2">Escolha a Parceira Ideal</h2></div>
                 
                 <div className="relative w-full max-w-4xl h-48 flex items-center justify-center">
                    <button onClick={handlePrevProvider} className="absolute left-0 z-20 p-2 rounded-full bg-slate-800/80 hover:bg-slate-700 text-white transition-all hover:scale-110"><ChevronLeft className="w-8 h-8" /></button>
                    <div className="flex items-center justify-center gap-6 perspective-1000">
                        {[-1, 0, 1].map((offset) => {
                            const index = (activeIndex + offset + providers.length) % providers.length;
                            const provider = providers[index];
                            const isActive = offset === 0;
                            return (
                                <div key={provider.id} onClick={() => setActiveIndex(index)} className={`relative transition-all duration-500 ease-out cursor-pointer rounded-full overflow-visible flex items-center justify-center bg-white ${isActive ? 'w-44 h-44 carousel-active' : 'w-24 h-24 carousel-inactive'}`}>
                                    {isActive && <div className="active-ring"></div>}
                                    <div className="w-full h-full rounded-full flex items-center justify-center p-4 shadow-2xl relative z-10 border-4 border-slate-900 bg-white overflow-hidden"><img src={provider.logo} alt={provider.name} className="w-full h-full object-contain" /></div>
                                    {isActive && (<div className="absolute bottom-0 right-0 bg-emerald-500 text-white p-2 rounded-full shadow-lg z-20"><CheckCircle2 className="w-6 h-6" /></div>)}
                                </div>
                            );
                        })}
                    </div>
                    <button onClick={handleNextProvider} className="absolute right-0 z-20 p-2 rounded-full bg-slate-800/80 hover:bg-slate-700 text-white transition-all hover:scale-110"><ChevronRight className="w-8 h-8" /></button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-5xl">
                    <div className="glass-panel p-8 rounded-2xl flex flex-col justify-center text-center border-t-4 border-t-cyan-500 relative overflow-hidden group">
                        <div className={`absolute inset-0 bg-${providers[activeIndex].color}-500/5 group-hover:bg-${providers[activeIndex].color}-500/10 transition-colors`}></div>
                        <div className="relative z-10">
                            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-800 border border-slate-700 text-cyan-400 text-sm font-bold mb-6 uppercase tracking-wider shadow-lg">{React.createElement(providers[activeIndex].icon, { className: "w-4 h-4" })} Vantagem Competitiva</div>
                            <h3 className="text-3xl font-bold text-white mb-4">{providers[activeIndex].name}</h3>
                            <p className="text-lg text-slate-300 leading-relaxed font-light">{providers[activeIndex].description}</p>
                        </div>
                    </div>
                    <div className="glass-card-premium p-8 rounded-2xl flex flex-col justify-between border-t-4 border-t-emerald-500">
                        <div className="flex justify-between items-start mb-6"><div><h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Simulação Final</h3><div className="text-2xl font-bold text-white mt-1 truncate max-w-[250px]">{formData.clienteNome}</div></div></div>
                        <div className="flex items-center justify-between bg-emerald-600 p-6 rounded-xl shadow-lg transform hover:scale-[1.02] transition-transform"><div><p className="text-emerald-100 text-xs font-bold uppercase mb-1">Economia Anual</p><p className="text-3xl font-black text-white">R$ {economiaAnual.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p></div><div className="bg-white/20 backdrop-blur px-4 py-2 rounded-lg text-white font-bold">{formData.desconto}% OFF</div></div>
                    </div>
                </div>
             </div>
        )}
      </div>
    </div>
  );
}

    