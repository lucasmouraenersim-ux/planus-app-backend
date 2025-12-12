"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { 
  Download, Loader2, ArrowLeft, Leaf, Zap, Globe, ShieldCheck, 
  PiggyBank, Wrench, TrendingUp, Building, ShoppingBag, 
  Utensils, Wheat
} from "lucide-react";

// --- DADOS E MOCKS ---

const commercializerCatalog = [
  { name: "BC Energia", logo: "https://raw.githubusercontent.com/LucasMouraChaser/campanhassent/bc761e2a925f19d5436b3642acb35fac8e3075f8/BC-ENERGIA.png" },
  { name: "Bolt Energy", logo: "https://raw.githubusercontent.com/LucasMouraChaser/campanhassent/bc761e2a925f19d5436b3642acb35fac8e3075f8/Bolt%20Energy.jpg" },
  { name: "Capibolt", logo: "https://raw.githubusercontent.com/LucasMouraChaser/campanhassent/main/Capibolt.png" },
  { name: "Cenergy", logo: "https://raw.githubusercontent.com/LucasMouraChaser/campanhassent/bc761e2a925f19d5436b3642acb35fac8e3075f8/images.jpg" },
  { name: "Serena Energia", logo: "https://raw.githubusercontent.com/LucasMouraChaser/campanhassent/bc761e2a925f19d5436b3642acb35fac8e3075f8/images.png" },
  { name: "Bowe Holding", logo: "https://raw.githubusercontent.com/LucasMouraChaser/campanhassent/bc761e2a925f19d5436b3642acb35fac8e3075f8/logo_bow-e-holding_NU3tgD.png" },
  { name: "Fit Energia", logo: "https://raw.githubusercontent.com/LucasMouraChaser/campanhassent/bc761e2a925f19d5436b3642acb35fac8e3075f8/logo_fitenergia.png" },
];

const plants = [
  { name: "Complexo Solar Ceilandia", location: "Ceilândia • DF", image: "https://raw.githubusercontent.com/LucasMouraChaser/campanhassent/56c15b3f8997df4f7ffae93fc2aae20df5505afc/Complexo-solar-Ceilandia-DF-1-768x465.jpg" },
  { name: "Complexo Solar Janaúba", location: "Janaúba • MG", image: "https://raw.githubusercontent.com/LucasMouraChaser/campanhassent/56c15b3f8997df4f7ffae93fc2aae20df5505afc/maior-energia-solar-brasil-mg-ciclovivo.jpg" },
  { name: "Complexo GDSun", location: "Geração Distribuída", image: "https://raw.githubusercontent.com/LucasMouraChaser/campanhassent/d889749a0d844cbea5a80379fd30df2e04783bde/images%20(1).jpg" },
];

const stats = [
    { label: "Clientes Atendidos", value: "+5.500", icon: Zap },
    { label: "Economia Gerada", value: "R$ 480 mi", icon: Globe },
    { label: "Energia Limpa", value: "230 GWh", icon: Leaf },
    { label: "CO₂ Evitado", value: "15k tons", icon: ShieldCheck },
];

const faqs = [
    { 
        question: "Como funciona a energia por assinatura?", 
        answer: "Nós injetamos energia limpa de nossas usinas na rede da distribuidora. Essa energia vira créditos que são abatidos na sua conta, garantindo o desconto.",
        icon: Zap 
    },
    { 
        question: "Preciso fazer investimento?", 
        answer: "Não! Zero investimento. Não precisa instalar placas, nem obras. A Planus Energia cuida de toda a geração e manutenção.",
        icon: PiggyBank 
    },
    { 
        question: "Tem custo de manutenção?", 
        answer: "Nenhum. Toda a operação e manutenção das usinas é responsabilidade nossa e dos nossos parceiros geradores.",
        icon: Wrench 
    },
    { 
        question: "E se o consumo aumentar?", 
        answer: "Sem problemas. Ajustamos a injeção de energia conforme seu perfil de consumo para manter sua economia sempre otimizada.",
        icon: TrendingUp 
    },
];

const clients = [
    { category: "Indústrias", icon: Building, names: ["Teuto", "Super Frango", "Zuppa"] },
    { category: "Comércio", icon: ShoppingBag, names: ["Grupo Saga", "Big Lar", "Fujioka"] },
    { category: "Food Service", icon: Utensils, names: ["Coco Bambu", "LifeBox", "Madero"] },
    { category: "Agro", icon: Wheat, names: ["São Salvador", "Milhão", "Grupo Cereal"] },
];

const formatCurrency = (val: number) => val.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});

function ProposalPageContent() {
  const searchParams = useSearchParams();
  const proposalRef = useRef<HTMLDivElement>(null);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  // --- CORREÇÃO: Função para tratar números brasileiros (vírgula e ponto) ---
  const parseNumber = (val: string | null) => {
    if (!val) return 0;
    // Remove pontos de milhar (ex: 17.850 -> 17850) e troca vírgula por ponto (ex: 0,98 -> 0.98)
    const clean = val.replace(/\./g, '').replace(',', '.');
    const parsed = parseFloat(clean);
    return isNaN(parsed) ? 0 : parsed;
  };

  // Parse dos dados da URL
  const proposalData = useMemo(() => ({
    clientName: searchParams.get("clienteNome") || "Cliente",
    clientCpfCnpj: searchParams.get("clienteCnpjCpf") || "",
    consumerUnit: searchParams.get("codigoClienteInstalacao") || "",
    distributor: searchParams.get("distribuidora") || "Distribuidora Local",
    comercializadora: searchParams.get("comercializadora") || "BC Energia",
    // Usando a função corrigida para números
    avgConsumption: parseNumber(searchParams.get("item1Quantidade")), 
    currentPrice: parseNumber(searchParams.get("tariff")),
    discountRate: parseNumber(searchParams.get("desconto")),
    coversTariffFlag: searchParams.get("cobreBandeira") === 'true',
    address: `${searchParams.get("clienteRua") || ''}, ${searchParams.get("clienteCidade") || ''} - ${searchParams.get("clienteUF") || ''}`
  }), [searchParams]);

  // Cálculos
  const calculated = useMemo(() => {
    const avgMonthlyCost = proposalData.avgConsumption * proposalData.currentPrice;
    
    // Calcula o preço do kWh com desconto
    const discountDecimal = proposalData.discountRate / 100;
    const bcPrice = proposalData.currentPrice * (1 - discountDecimal);
    
    const bcMonthlyCost = proposalData.avgConsumption * bcPrice;
    const monthlyEconomy = avgMonthlyCost - bcMonthlyCost;
    const annualEconomy = monthlyEconomy * 12;
    
    return { avgMonthlyCost, bcPrice, bcMonthlyCost, monthlyEconomy, annualEconomy };
  }, [proposalData]);

  const selectedCommercializer = commercializerCatalog.find(c => c.name === proposalData.comercializadora) || commercializerCatalog[0];

  const handleDownloadPDF = async () => {
      const content = proposalRef.current;
      if (!content || isGeneratingPDF) return;
      setIsGeneratingPDF(true);
      
      const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4', compress: true });
      const width = pdf.internal.pageSize.getWidth();
      const height = pdf.internal.pageSize.getHeight();
      const sections = content.querySelectorAll('[data-pdf-section]');
      
      for (let i = 0; i < sections.length; i++) {
          if (i > 0) pdf.addPage();
          const canvas = await html2canvas(sections[i] as HTMLElement, { 
              scale: 2, 
              useCORS: true, 
              backgroundColor: '#ffffff',
              logging: false
          });
          const imgData = canvas.toDataURL('image/jpeg', 0.95);
          pdf.addImage(imgData, 'JPEG', 0, 0, width, height);
      }
      pdf.save(`Proposta_Planus_${proposalData.clientName.replace(/\s/g, '_')}.pdf`);
      setIsGeneratingPDF(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 font-sans p-4 md:p-8 flex flex-col items-center">
      
      {/* Barra de Ações Flutuante */}
      <div className="fixed bottom-6 right-6 z-50 flex gap-4 no-print">
        <Link href="/proposal-generator">
            <Button variant="secondary" className="h-14 rounded-full shadow-lg px-6 border border-slate-700 bg-slate-900 text-white hover:bg-slate-800">
                <ArrowLeft className="mr-2 h-5 w-5" /> Voltar
            </Button>
        </Link>
        <Button onClick={handleDownloadPDF} disabled={isGeneratingPDF} className="h-14 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 rounded-full shadow-lg px-8 text-lg font-bold text-white transition-all hover:scale-105">
            {isGeneratingPDF ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Download className="mr-2 h-5 w-5" />}
            {isGeneratingPDF ? "Gerando..." : "Baixar PDF"}
        </Button>
      </div>

      <div ref={proposalRef} className="w-full max-w-[210mm] space-y-0">
        
        {/* === PÁGINA 1: CAPA === */}
        <div data-pdf-section="cover" className="relative w-full aspect-[210/297] bg-slate-900 text-white overflow-hidden flex flex-col">
            <div className="absolute inset-0 z-0">
                <img src="https://images.unsplash.com/photo-1509391366360-2e959784a276?q=80&w=2072&auto=format&fit=crop" className="w-full h-full object-cover opacity-30" alt="Solar Background" crossOrigin="anonymous"/>
                <div className="absolute inset-0 bg-gradient-to-b from-slate-900 via-slate-900/50 to-slate-900"></div>
            </div>
            
            <div className="relative z-10 flex-1 flex flex-col justify-between p-16">
                <div className="w-full border-b border-white/20 pb-6 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                         <img 
                            src="https://raw.githubusercontent.com/lucasmouraenersim-ux/main/b0c93c3d8a644f4a5c54974a14b804bab886dcac/LOGO_LOGO_BRANCA.png" 
                            alt="Planus Energia" 
                            className="h-12 w-auto object-contain"
                            crossOrigin="anonymous"
                         />
                    </div>
                    <div className="text-right">
                        <p className="text-xs text-cyan-400 font-bold uppercase tracking-wider">Código da Proposta</p>
                        <p className="text-xl font-bold">#{new Date().getFullYear()}-{(Math.random()*1000).toFixed(0)}</p>
                    </div>
                </div>

                <div className="py-10">
                    <h2 className="text-7xl font-black leading-tight mb-6">Energia Limpa <br/><span className="text-cyan-400">Inteligente.</span></h2>
                    <p className="text-2xl text-slate-300 font-light max-w-2xl leading-relaxed">Soluções de geração distribuída que reduzem custos e ampliam a sustentabilidade do seu negócio.</p>
                </div>

                <div className="border-t border-white/20 pt-8 mt-auto">
                    <div className="flex justify-between items-end">
                        <div>
                            <p className="text-xs text-slate-400 uppercase tracking-widest mb-2">Preparado Exclusivamente Para</p>
                            <h3 className="text-3xl font-bold text-white mb-2">{proposalData.clientName}</h3>
                            <p className="text-lg text-slate-300">{proposalData.address}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-xs text-slate-400 uppercase tracking-widest mb-1">Validade</p>
                            <p className="text-xl font-bold text-white">5 Dias Úteis</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        {/* === PÁGINA 2: INSTITUCIONAL === */}
        <div data-pdf-section="about" className="relative w-full aspect-[210/297] bg-white text-slate-900 p-12 flex flex-col justify-between">
            <div>
                <div className="flex items-center gap-4 mb-10">
                    <div className="w-2 h-10 bg-cyan-600"></div>
                    <div><h2 className="text-3xl font-black text-slate-800 uppercase tracking-tight">Quem Somos</h2><p className="text-slate-500">A força da Planus Energia conectando você ao futuro.</p></div>
                </div>

                <p className="text-lg text-slate-600 mb-8 leading-relaxed">
                    A <strong className="text-cyan-600">Planus Energia</strong> integra um ecossistema de empresas especializadas em soluções de energia limpa, conectando consumidores às nossas usinas fotovoltaicas e comercializadoras parceiras. Atuamos com responsabilidade ESG, neutralizando emissões.
                </p>

                <div className="grid grid-cols-4 gap-4 mb-12">
                    {stats.map((stat, i) => (
                        <div key={i} className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-center">
                            <stat.icon className="w-6 h-6 text-cyan-600 mx-auto mb-2" />
                            <div className="text-2xl font-black text-slate-800">{stat.value}</div>
                            <div className="text-xs text-slate-500 font-medium uppercase">{stat.label}</div>
                        </div>
                    ))}
                </div>

                <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2"><Leaf className="w-5 h-5 text-emerald-500"/> Nossas Usinas</h3>
                <div className="grid grid-cols-3 gap-6 mb-12">
                    {plants.map((plant, i) => (
                        <div key={i} className="group relative overflow-hidden rounded-xl bg-slate-900 shadow-md h-32">
                            <img src={plant.image} alt={plant.name} className="w-full h-full object-cover opacity-80" crossOrigin="anonymous" />
                            <div className="absolute bottom-0 w-full bg-gradient-to-t from-black/90 to-transparent p-3">
                                <p className="text-xs font-bold text-white">{plant.name}</p>
                                <p className="text-[10px] text-slate-300">{plant.location}</p>
                            </div>
                        </div>
                    ))}
                </div>

                <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2"><Globe className="w-5 h-5 text-blue-500"/> Comercializadoras Parceiras</h3>
                <div className="grid grid-cols-6 gap-3 items-center">
                    {commercializerCatalog.map((c, i) => (
                        <div key={i} className="border border-slate-200 rounded-lg p-2 h-16 flex items-center justify-center grayscale opacity-70">
                            <img src={c.logo} alt={c.name} className="max-h-full max-w-full object-contain" crossOrigin="anonymous" />
                        </div>
                    ))}
                </div>
            </div>
            <div className="border-t border-slate-100 pt-4 flex justify-between items-center text-xs text-slate-400"><span>Planus Energia Hub</span><span>Página 2/4</span></div>
        </div>

        {/* === PÁGINA 3: PROPOSTA COMERCIAL === */}
        <div data-pdf-section="proposal" className="relative w-full aspect-[210/297] bg-slate-50 text-slate-900 p-12 flex flex-col">
            <header className="mb-10">
                <div className="flex items-center gap-4">
                    <div className="w-2 h-10 bg-emerald-500"></div>
                    <div><h2 className="text-3xl font-black text-slate-800 uppercase tracking-tight">Estudo de Economia</h2><p className="text-slate-500">Análise detalhada do seu potencial de redução de custos.</p></div>
                </div>
            </header>

            <main className="flex-1">
                <div className="grid grid-cols-2 gap-8 mb-8">
                    {/* Cenário Atual */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                        <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-3">
                            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold">1</div>
                            <span className="font-bold text-slate-600 uppercase text-sm">Cenário Atual</span>
                        </div>
                        <div className="space-y-3 text-sm">
                            <div className="flex justify-between"><span className="text-slate-500">Consumo Médio</span><span className="font-medium">{proposalData.avgConsumption.toLocaleString()} kWh</span></div>
                            <div className="flex justify-between"><span className="text-slate-500">Tarifa Vigente</span><span className="font-medium">{formatCurrency(proposalData.currentPrice)}</span></div>
                            <div className="bg-slate-100 p-3 rounded-lg flex justify-between items-center mt-2"><span className="font-bold text-slate-700">Custo Mensal</span><span className="font-black text-slate-800 text-lg">{formatCurrency(calculated.avgMonthlyCost)}</span></div>
                        </div>
                    </div>

                    {/* Cenário Proposto */}
                    <div className="bg-white p-6 rounded-2xl shadow-md border-2 border-emerald-500 relative overflow-hidden">
                        <div className="absolute top-0 right-0 bg-emerald-500 text-white text-[10px] font-bold px-3 py-1 rounded-bl-lg uppercase tracking-wider">Recomendado</div>
                        <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-3">
                            <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 font-bold">2</div>
                            <span className="font-bold text-emerald-700 uppercase text-sm">Cenário Planus Energia</span>
                        </div>
                        <div className="space-y-3 text-sm">
                            <div className="flex justify-between"><span className="text-slate-500">Desconto Base</span><span className="font-bold text-emerald-600 bg-emerald-50 px-2 rounded">{proposalData.discountRate}% OFF</span></div>
                            <div className="flex justify-between"><span className="text-slate-500">Nova Tarifa</span><span className="font-bold text-emerald-700">{formatCurrency(calculated.bcPrice)}</span></div>
                            <div className="bg-emerald-50 p-3 rounded-lg flex justify-between items-center mt-2 border border-emerald-100"><span className="font-bold text-emerald-800">Novo Custo</span><span className="font-black text-emerald-700 text-lg">{formatCurrency(calculated.bcMonthlyCost)}</span></div>
                        </div>
                    </div>
                </div>

                <div className="bg-slate-900 rounded-2xl p-8 text-center text-white mb-8 relative overflow-hidden">
                    <div className="relative z-10">
                        <p className="text-slate-400 text-xs font-bold uppercase tracking-[0.2em] mb-2">Economia Anual Projetada</p>
                        <div className="text-5xl font-black text-emerald-400 drop-shadow-lg">{formatCurrency(calculated.annualEconomy)}</div>
                        <p className="text-slate-400 text-sm mt-3">Valor livre para reinvestir no seu negócio.</p>
                    </div>
                </div>

                {/* Tabela de Bandeiras Turbinada */}
                {proposalData.coversTariffFlag && (
                    <div className="bg-white rounded-xl border border-slate-200 p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <ShieldCheck className="w-5 h-5 text-blue-600" />
                            <h3 className="font-bold text-slate-800">Semáforo de Economia (Proteção de Bandeiras)</h3>
                        </div>
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                                <tr>
                                    <th className="p-3 text-left font-semibold">Bandeira</th>
                                    <th className="p-3 text-center font-semibold text-emerald-600 bg-emerald-50">Seu Desconto Total</th>
                                    <th className="p-3 text-right font-semibold">Custo Final kWh</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                <tr>
                                    <td className="p-3 font-medium text-green-600 flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-green-500"></div> Verde</td>
                                    <td className="p-3 text-center font-bold text-emerald-700 bg-emerald-50/50">{proposalData.discountRate}%</td>
                                    <td className="p-3 text-right font-bold text-slate-700">{formatCurrency(calculated.bcPrice)}</td>
                                </tr>
                                <tr>
                                    <td className="p-3 font-medium text-yellow-600 flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-yellow-500"></div> Amarela</td>
                                    <td className="p-3 text-center font-bold text-emerald-700 bg-emerald-50/50">{proposalData.discountRate + 3}% (Bônus +3%)</td>
                                    <td className="p-3 text-right font-bold text-slate-700">{formatCurrency(calculated.bcPrice * 0.97)}</td>
                                </tr>
                                <tr>
                                    <td className="p-3 font-medium text-red-600 flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-red-500"></div> Vermelha 1</td>
                                    <td className="p-3 text-center font-bold text-emerald-700 bg-emerald-50/50">{proposalData.discountRate + 5}% (Bônus +5%)</td>
                                    <td className="p-3 text-right font-bold text-slate-700">{formatCurrency(calculated.bcPrice * 0.95)}</td>
                                </tr>
                                <tr>
                                    <td className="p-3 font-medium text-red-800 flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-red-800"></div> Vermelha 2</td>
                                    <td className="p-3 text-center font-bold text-emerald-700 bg-emerald-50/50">{proposalData.discountRate + 8}% (Bônus +8%)</td>
                                    <td className="p-3 text-right font-bold text-slate-700">{formatCurrency(calculated.bcPrice * 0.92)}</td>
                                </tr>
                            </tbody>
                        </table>
                        <p className="text-xs text-slate-400 mt-2 italic">* O desconto aumenta automaticamente nas bandeiras mais caras para proteger sua economia.</p>
                    </div>
                )}
            </main>
            <div className="border-t border-slate-200 pt-4 flex justify-between items-center text-xs text-slate-400"><span>Planus Energia Hub</span><span>Página 3/4</span></div>
        </div>

        {/* === PÁGINA 4: FAQ & CLIENTES === */}
        <div data-pdf-section="faq" className="relative w-full aspect-[210/297] bg-white text-slate-900 p-12 flex flex-col justify-between">
            <div>
                <div className="flex items-center gap-4 mb-8">
                    <div className="w-2 h-10 bg-cyan-600"></div>
                    <div><h2 className="text-3xl font-black text-slate-800 uppercase tracking-tight">Perguntas Frequentes</h2><p className="text-slate-500">Tire suas dúvidas sobre o modelo.</p></div>
                </div>

                <div className="grid grid-cols-2 gap-6 mb-12">
                    {faqs.map((faq, i) => (
                        <div key={i} className="bg-slate-50 p-5 rounded-xl border border-slate-100">
                            <div className="flex items-start gap-3 mb-2">
                                <div className="p-2 bg-cyan-100 text-cyan-600 rounded-lg"><faq.icon className="w-5 h-5" /></div>
                                <h4 className="font-bold text-slate-800 text-sm">{faq.question}</h4>
                            </div>
                            <p className="text-xs text-slate-600 leading-relaxed pl-12">{faq.answer}</p>
                        </div>
                    ))}
                </div>

                <div className="flex items-center gap-4 mb-6">
                    <div className="w-2 h-10 bg-emerald-500"></div>
                    <div><h2 className="text-3xl font-black text-slate-800 uppercase tracking-tight">Quem Confia</h2><p className="text-slate-500">Alguns dos nossos clientes por setor.</p></div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    {clients.map((group, i) => (
                        <div key={i} className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm">
                            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
                                <group.icon className="w-4 h-4 text-slate-400" />
                                <span className="font-bold text-slate-700 text-sm uppercase">{group.category}</span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {group.names.map((name, j) => (
                                    <span key={j} className="text-xs font-medium bg-slate-100 text-slate-600 px-3 py-1 rounded-full">{name}</span>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <footer className="mt-auto pt-6 text-center text-xs text-slate-400 border-t border-slate-200">
                <p>Planus Energia • Soluções em Energia Limpa</p>
                <p className="mt-1">Proposta válida por 5 dias. Sujeito a aprovação de crédito.</p>
                <div className="flex justify-end items-center mt-2">
                    <span className="mr-2">Entrega Garantida por:</span>
                    {selectedCommercializer.logo && <img src={selectedCommercializer.logo} alt="Parceiro" className="h-6 object-contain" crossOrigin="anonymous" />}
                </div>
            </footer>
            <div className="border-t border-slate-100 pt-4 flex justify-between items-center text-xs text-slate-400 mt-4"><span>Planus Energia Hub</span><span>Página 4/4</span></div>
        </div>

      </div>
    </div>
  );
}

export default function ProposalPage() {
  return (
    <Suspense fallback={<div>Carregando...</div>}>
      <ProposalPageContent />
    </Suspense>
  );
}