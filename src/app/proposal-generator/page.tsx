
"use client";

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  User, MapPin, Zap, FileText, Save, 
  CheckCircle2, DollarSign, Percent, Building2, Lightbulb
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from "@/hooks/use-toast";

export default function ProposalGeneratorPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  // Estado unificado para facilitar o Live Preview
  const [formData, setFormData] = useState({
    clienteNome: '',
    clienteCnpjCpf: '',
    clienteCep: '',
    clienteRua: '',
    clienteNumero: '',
    clienteBairro: '',
    clienteCidade: '',
    clienteUF: '',
    codigoClienteInstalacao: '', // UC
    distribuidora: '',
    comercializadora: 'BC Energia',
    item1Quantidade: '1500', // Consumo
    currentTariff: '0.98',
    desconto: '15',
    cobreBandeira: true,
    comFidelidade: true,
    ligacao: 'TRIFASICO',
    classificacao: 'RESIDENCIAL-B1'
  });

  // Preencher dados da URL (vinda do Dashboard)
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
          toast({ title: "Endereço encontrado!", description: `${data.logradouro}, ${data.localidade}` });
        }
      } catch (error) {
        console.error("Erro CEP", error);
      }
    }
  };

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = () => {
    const params = new URLSearchParams();
    Object.entries(formData).forEach(([key, value]) => {
      params.set(key, String(value));
    });
    router.push(`/proposal?${params.toString()}`);
  };

  // --- CÁLCULOS DO LIVE PREVIEW ---
  const consumo = Number(formData.item1Quantidade.replace(',', '.')) || 0;
  const tarifa = Number(formData.currentTariff.replace(',', '.')) || 0;
  const desconto = Number(formData.desconto) || 0;

  const valorFaturaAtual = consumo * tarifa;
  const economiaMensal = valorFaturaAtual * (desconto / 100);
  const economiaAnual = economiaMensal * 12;
  const novoValorFatura = valorFaturaAtual - economiaMensal;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-300 font-sans relative overflow-hidden">
      
      {/* Background Animado */}
      <style jsx global>{`
        .glass-panel { background: rgba(30, 41, 59, 0.4); backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.05); box-shadow: 0 4px 30px rgba(0, 0, 0, 0.1); }
        .glass-card { background: linear-gradient(145deg, rgba(30, 41, 59, 0.6), rgba(15, 23, 42, 0.6)); border: 1px solid rgba(255, 255, 255, 0.05); }
        @keyframes blob { 0% { transform: translate(0px, 0px) scale(1); } 33% { transform: translate(30px, -50px) scale(1.1); } 66% { transform: translate(-20px, 20px) scale(0.9); } 100% { transform: translate(0px, 0px) scale(1); } }
        .animate-blob { animation: blob 10s infinite; }
        .animation-delay-2000 { animation-delay: 2s; }
      `}</style>
      
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full mix-blend-screen filter blur-3xl opacity-30 animate-blob"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full mix-blend-screen filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
      </div>

      <div className="relative z-10 p-4 md:p-8 max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <div className="p-2 bg-gradient-to-tr from-cyan-600 to-blue-600 rounded-xl shadow-lg shadow-cyan-900/20">
                <FileText className="w-6 h-6 text-white" />
              </div>
              Gerador de Propostas
            </h1>
            <p className="text-slate-400 mt-2 ml-1">Configure os parâmetros comerciais para gerar a simulação.</p>
          </div>
          <Button onClick={handleSubmit} className="bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-500/20 px-8 h-12 text-lg font-semibold w-full md:w-auto">
             <Save className="w-5 h-5 mr-2" /> Gerar Proposta Final
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* === COLUNA ESQUERDA: FORMULÁRIO === */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Seção 1: Cliente */}
            <div className="glass-panel p-6 rounded-2xl">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <User className="w-5 h-5 text-cyan-400" /> Dados do Cliente
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nome / Razão Social</Label>
                  <Input 
                    placeholder="Ex: Mercado Mix LTDA" 
                    className="bg-slate-900/50 border-white/10 h-11 focus:border-cyan-500 text-white"
                    value={formData.clienteNome} onChange={e => handleChange('clienteNome', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>CPF / CNPJ</Label>
                  <Input 
                    placeholder="00.000.000/0001-00" 
                    className="bg-slate-900/50 border-white/10 h-11 focus:border-cyan-500 text-white"
                    value={formData.clienteCnpjCpf} onChange={e => handleChange('clienteCnpjCpf', e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Seção 2: Localização */}
            <div className="glass-panel p-6 rounded-2xl">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-purple-400" /> Endereço da Unidade
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-1 space-y-2">
                  <Label>CEP</Label>
                  <Input 
                    placeholder="00000-000" 
                    className="bg-slate-900/50 border-white/10 h-11 focus:border-cyan-500 text-white"
                    value={formData.clienteCep} onChange={e => handleChange('clienteCep', e.target.value)}
                    onBlur={handleBlurCep}
                  />
                </div>
                <div className="md:col-span-3 space-y-2">
                  <Label>Rua</Label>
                  <Input 
                    placeholder="Logradouro..." 
                    className="bg-slate-900/50 border-white/10 h-11 focus:border-cyan-500 text-white"
                    value={formData.clienteRua} onChange={e => handleChange('clienteRua', e.target.value)}
                  />
                </div>
                <div className="md:col-span-1 space-y-2">
                  <Label>Número</Label>
                  <Input 
                    placeholder="Nº" 
                    className="bg-slate-900/50 border-white/10 h-11 focus:border-cyan-500 text-white"
                    value={formData.clienteNumero} onChange={e => handleChange('clienteNumero', e.target.value)}
                  />
                </div>
                <div className="md:col-span-1 space-y-2">
                  <Label>Bairro</Label>
                  <Input 
                    placeholder="Bairro" 
                    className="bg-slate-900/50 border-white/10 h-11 focus:border-cyan-500 text-white"
                    value={formData.clienteBairro} onChange={e => handleChange('clienteBairro', e.target.value)}
                  />
                </div>
                <div className="md:col-span-1 space-y-2">
                  <Label>Cidade</Label>
                  <Input 
                    placeholder="Cidade" 
                    className="bg-slate-900/50 border-white/10 h-11 focus:border-cyan-500 text-white"
                    value={formData.clienteCidade} onChange={e => handleChange('clienteCidade', e.target.value)}
                  />
                </div>
                <div className="md:col-span-1 space-y-2">
                  <Label>UF</Label>
                  <Input 
                    placeholder="UF" 
                    className="bg-slate-900/50 border-white/10 h-11 focus:border-cyan-500 text-white"
                    value={formData.clienteUF} onChange={e => handleChange('clienteUF', e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Seção 3: Dados Técnicos */}
            <div className="glass-panel p-6 rounded-2xl">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Zap className="w-5 h-5 text-yellow-400" /> Dados de Energia
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Nº da UC</Label>
                  <Input 
                    placeholder="Ex: 6555432" 
                    className="bg-slate-900/50 border-white/10 h-11 focus:border-cyan-500 text-white"
                    value={formData.codigoClienteInstalacao} onChange={e => handleChange('codigoClienteInstalacao', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Distribuidora</Label>
                  <Input 
                    placeholder="Ex: Neoenergia" 
                    className="bg-slate-900/50 border-white/10 h-11 focus:border-cyan-500 text-white"
                    value={formData.distribuidora} onChange={e => handleChange('distribuidora', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Comercializadora</Label>
                  <Select value={formData.comercializadora} onValueChange={v => handleChange('comercializadora', v)}>
                    <SelectTrigger className="bg-slate-900/50 border-white/10 h-11 text-white"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-700 text-white">
                        <SelectItem value="BC Energia">BC Energia</SelectItem>
                        <SelectItem value="Bolt Energy">Bolt Energy</SelectItem>
                        <SelectItem value="Capibolt">Capibolt</SelectItem>
                        <SelectItem value="Cenergy">Cenergy</SelectItem>
                        <SelectItem value="Serena Energia">Serena Energia</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label>Consumo Médio (kWh)</Label>
                  <div className="relative">
                    <Zap className="absolute left-3 top-3.5 w-4 h-4 text-slate-500" />
                    <Input 
                        type="number"
                        className="bg-slate-900/50 border-white/10 h-11 pl-10 focus:border-cyan-500 text-white font-bold"
                        value={formData.item1Quantidade} onChange={e => handleChange('item1Quantidade', e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Tarifa Vigente (R$)</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-3.5 w-4 h-4 text-slate-500" />
                    <Input 
                        className="bg-slate-900/50 border-white/10 h-11 pl-10 focus:border-cyan-500 text-white font-bold"
                        value={formData.currentTariff} onChange={e => handleChange('currentTariff', e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Desconto (%)</Label>
                  <div className="relative">
                    <Percent className="absolute left-3 top-3.5 w-4 h-4 text-emerald-500" />
                    <Input 
                        type="number"
                        className="bg-emerald-500/10 border-emerald-500/20 h-11 pl-10 focus:border-emerald-500 text-emerald-400 font-bold"
                        value={formData.desconto} onChange={e => handleChange('desconto', e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-6 p-4 bg-slate-800/50 rounded-xl border border-white/5 flex flex-col md:flex-row gap-6">
                 <div className="flex items-center gap-3">
                    <Switch checked={formData.cobreBandeira} onCheckedChange={v => handleChange('cobreBandeira', v)} />
                    <div className="flex flex-col">
                        <Label className="text-sm cursor-pointer">Cobrir Bandeira Tarifária?</Label>
                        <span className="text-xs text-slate-500">Se ativo, a empresa absorve custos extras.</span>
                    </div>
                 </div>
                 <div className="flex items-center gap-3">
                    <Switch checked={formData.comFidelidade} onCheckedChange={v => handleChange('comFidelidade', v)} />
                    <div className="flex flex-col">
                        <Label className="text-sm cursor-pointer">Fidelidade (12 meses)</Label>
                        <span className="text-xs text-slate-500">Aplica multa em caso de cancelamento.</span>
                    </div>
                 </div>
              </div>
            </div>

          </div>

          {/* === COLUNA DIREITA: LIVE PREVIEW (STICKY) === */}
          <div className="lg:col-span-1">
            <div className="sticky top-8 space-y-6">
                
                {/* Cartão de Resumo da Proposta */}
                <div className="glass-card rounded-2xl overflow-hidden shadow-2xl shadow-black/50 border-t-4 border-t-cyan-500 relative">
                    {/* Efeito Glow interno */}
                    <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/20 blur-3xl rounded-full -translate-y-1/2 translate-x-1/2"></div>

                    <div className="p-6">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Resumo da Simulação</h3>
                        <div className="text-xl font-bold text-white mb-6 truncate">{formData.clienteNome || 'Nome do Cliente'}</div>

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

                        <div className="mt-6 bg-gradient-to-r from-emerald-600 to-teal-500 rounded-xl p-5 text-center shadow-lg transform transition-transform hover:scale-105 duration-300 border border-emerald-400/30">
                            <p className="text-emerald-100 text-xs font-medium uppercase mb-1">Economia Anual Estimada</p>
                            <p className="text-3xl font-extrabold text-white">R$ {economiaAnual.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
                            <div className="mt-2 text-xs bg-black/20 rounded-full px-2 py-1 inline-block text-emerald-100 border border-white/10">
                                {desconto}% de Desconto Garantido
                            </div>
                        </div>
                    </div>
                    
                    <div className="bg-slate-900/80 p-4 border-t border-white/5 text-center">
                        <p className="text-xs text-slate-500 mb-3 flex items-center justify-center gap-1"><Building2 className="w-3 h-3"/> Comercializadora: <span className="text-cyan-400 font-bold">{formData.comercializadora}</span></p>
                        <Button onClick={handleSubmit} className="w-full bg-white text-slate-900 hover:bg-slate-200 font-bold">
                            <CheckCircle2 className="w-4 h-4 mr-2" /> Visualizar Proposta PDF
                        </Button>
                    </div>
                </div>

                {/* Card de Informações Extras */}
                <div className="glass-panel rounded-xl p-5 border border-dashed border-slate-700">
                    <h4 className="font-semibold text-white mb-3 flex items-center gap-2">
                        <Lightbulb className="w-4 h-4 text-yellow-400" /> Benefícios Inclusos
                    </h4>
                    <ul className="space-y-2 text-sm text-slate-400">
                        <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5" /> Sem custo de adesão</li>
                        <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5" /> Energia 100% Renovável</li>
                        <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5" /> Gestão via App e Web</li>
                        {formData.cobreBandeira && <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5" /> Cobertura de Bandeira Tarifária</li>}
                    </ul>
                </div>

            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
