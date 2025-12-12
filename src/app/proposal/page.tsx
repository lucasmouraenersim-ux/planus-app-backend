"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

import { Button } from "@/components/ui/button";
import { Download, Loader2, ArrowLeft } from "lucide-react";
import Link from "next/link";

// --- TYPES ---
const commercializerCatalog = [
  {
    name: "BC Energia",
    cnpj: "CNPJ 18.384.740/0001-34",
    segment: "Geracao distribuida para baixa tensao",
    coverage: "GO, DF, MT, MS",
    logo: "https://raw.githubusercontent.com/LucasMouraChaser/campanhassent/bc761e2a925f19d5436b3642acb35fac8e3075f8/BC-ENERGIA.png",
  },
  {
    name: "Bolt Energy",
    cnpj: "CNPJ 43.899.807/0001-04",
    segment: "Comercializacao varejista e gestao de energia",
    coverage: "Centro-Oeste e Sudeste",
    logo: "https://raw.githubusercontent.com/LucasMouraChaser/campanhassent/bc761e2a925f19d5436b3642acb35fac8e3075f8/Bolt%20Energy.jpg",
  },
  {
    name: "Cenergy",
    cnpj: "CNPJ 35.274.925/0001-80",
    segment: "Geracao distribuida fotovoltaica",
    coverage: "GO, BA, MG",
    logo: "https://raw.githubusercontent.com/LucasMouraChaser/campanhassent/bc761e2a925f19d5436b3642acb35fac8e3075f8/images.jpg",
  },
  {
    name: "Serena Energia",
    cnpj: "CNPJ 40.102.671/0001-09",
    segment: "Midway e atacado de energia limpa",
    coverage: "CO, SE, NE",
    logo: "https://raw.githubusercontent.com/LucasMouraChaser/campanhassent/bc761e2a925f19d5436b3642acb35fac8e3075f8/images.png",
  },
];
const plants = [
  {
    name: "Complexo Solar Ceilandia - DF",
    location: "Ceilândia • Distrito Federal",
    capacity: "Capacidade não informada",
    image: "https://raw.githubusercontent.com/LucasMouraChaser/campanhassent/56c15b3f8997df4f7ffae93fc2aae20df5505afc/Complexo-solar-Ceilandia-DF-1-768x465.jpg",
  },
  {
    name: "Complexo Solar Janaúba - MG",
    location: "Janaúba • Minas Gerais",
    capacity: "1,5 GWp",
    image: "https://raw.githubusercontent.com/LucasMouraChaser/campanhassent/56c15b3f8997df4f7ffae93fc2aae20df5505afc/maior-energia-solar-brasil-mg-ciclovivo.jpg",
  },
  {
    name: "Complexo GDSun",
    location: "Localização não informada",
    capacity: "Comercializador: GDSun",
    image: "https://raw.githubusercontent.com/LucasMouraChaser/campanhassent/d889749a0d844cbea5a80379fd30df2e04783bde/images%20(1).jpg",
  },
];
const formatCurrency = (val: number) => val.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});

function ProposalPageContent() {
  const searchParams = useSearchParams();
  const proposalRef = useRef<HTMLDivElement>(null);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  // Parse dos dados da URL
  const proposalData = useMemo(() => ({
    clientName: searchParams.get("clienteNome") || "Cliente",
    clientCpfCnpj: searchParams.get("clienteCnpjCpf") || "",
    consumerUnit: searchParams.get("codigoClienteInstalacao") || "",
    distributor: searchParams.get("distribuidora") || "",
    comercializadora: searchParams.get("comercializadora") || "BC Energia",
    avgConsumption: parseFloat(searchParams.get("item1Quantidade") || "0"),
    currentPrice: parseFloat(searchParams.get("currentTariff") || "0"),
    discountRate: parseFloat(searchParams.get("desconto") || "0"),
    coversTariffFlag: searchParams.get("cobreBandeira") === 'true',
    address: `${searchParams.get("clienteRua") || ''}, ${searchParams.get("clienteCidade") || ''} - ${searchParams.get("clienteUF") || ''}`
  }), [searchParams]);

  // Cálculos
  const calculated = useMemo(() => {
    const avgMonthlyCost = proposalData.avgConsumption * proposalData.currentPrice;
    const bcPrice = proposalData.currentPrice * (1 - (proposalData.discountRate / 100));
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
          const canvas = await html2canvas(sections[i] as HTMLElement, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
          const imgData = canvas.toDataURL('image/png');
          pdf.addImage(imgData, 'PNG', 0, 0, width, height);
      }
      pdf.save(`Proposta_${proposalData.clientName}.pdf`);
      setIsGeneratingPDF(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 font-sans p-4 md:p-8 flex flex-col items-center">
      
      {/* Barra de Ações Flutuante */}
      <div className="fixed bottom-6 right-6 z-50 flex gap-4 no-print">
        <Link href="/proposal-generator">
            <Button variant="secondary" className="h-14 rounded-full shadow-lg px-6">
                <ArrowLeft className="mr-2 h-5 w-5" /> Voltar
            </Button>
        </Link>
        <Button onClick={handleDownloadPDF} disabled={isGeneratingPDF} className="h-14 bg-cyan-600 hover:bg-cyan-500 rounded-full shadow-lg px-8 text-lg font-bold text-white">
            {isGeneratingPDF ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Download className="mr-2 h-5 w-5" />}
            {isGeneratingPDF ? "Gerando..." : "Baixar PDF"}
        </Button>
      </div>

      {/* Container da Proposta (A4 Ratio) */}
      <div ref={proposalRef} className="w-full max-w-[210mm] space-y-8">
        
        {/* PÁGINA 1: CAPA */}
        <div data-pdf-section="cover" className="relative w-full aspect-[210/297] bg-slate-900 text-white overflow-hidden rounded-none shadow-2xl">
            {/* Background Image (Substitua por uma imagem real de alta qualidade) */}
            <div className="absolute inset-0 bg-gradient-to-b from-slate-900/80 to-slate-900/40 z-10" />
            <img src="https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80" className="absolute inset-0 w-full h-full object-cover opacity-50" alt="Solar" />
            
            <div className="relative z-20 h-full flex flex-col justify-between p-12">
                <div className="flex justify-between items-start">
                    <div className="text-cyan-400 font-bold tracking-widest uppercase text-sm">Proposta Comercial</div>
                    <div className="bg-white/10 backdrop-blur px-4 py-1 rounded-full text-xs font-mono">#{new Date().getFullYear()}-001</div>
                </div>

                <div className="text-center space-y-6">
                    <h1 className="text-6xl font-black tracking-tight leading-tight">Energia Limpa <br/><span className="text-cyan-400">e Mais Barata</span></h1>
                    <p className="text-xl text-slate-300 font-light max-w-lg mx-auto">Soluções inteligentes de geração distribuída para o seu negócio prosperar com sustentabilidade.</p>
                </div>

                <div className="bg-white/10 backdrop-blur border border-white/20 p-6 rounded-xl">
                    <div className="text-sm text-slate-400 uppercase tracking-wider mb-2">Preparado para</div>
                    <div className="text-2xl font-bold">{proposalData.clientName}</div>
                    <div className="text-slate-300 mt-1">{proposalData.address}</div>
                </div>
            </div>
        </div>

        {/* PÁGINA 2: A PROPOSTA */}
        <div data-pdf-section="page2" className="relative w-full aspect-[210/297] bg-white text-slate-900 p-12 shadow-2xl flex flex-col">
            <header className="flex justify-between items-center border-b border-slate-200 pb-6 mb-8">
                <div>
                    <h2 className="text-3xl font-bold text-slate-900">Estudo de Economia</h2>
                    <p className="text-slate-500">Comparativo financeiro detalhado</p>
                </div>
                <div className="text-right">
                    <div className="text-sm font-bold text-cyan-600">SENT ENERGIA</div>
                    <div className="text-xs text-slate-400">Hub de Soluções</div>
                </div>
            </header>

            <main className="flex-1 space-y-8">
                {/* Cards Comparativos */}
                <div className="grid grid-cols-2 gap-6">
                    <div className="bg-slate-50 border border-slate-200 p-6 rounded-xl">
                        <div className="text-sm font-bold text-slate-500 uppercase mb-4">Cenário Atual</div>
                        <div className="space-y-3">
                            <div className="flex justify-between"><span>Consumo</span> <strong>{proposalData.avgConsumption} kWh</strong></div>
                            <div className="flex justify-between"><span>Tarifa</span> <strong>{formatCurrency(proposalData.currentPrice)}</strong></div>
                            <div className="h-px bg-slate-200 my-2"></div>
                            <div className="flex justify-between text-lg text-slate-900"><span>Mensal</span> <strong>{formatCurrency(calculated.avgMonthlyCost)}</strong></div>
                        </div>
                    </div>
                    <div className="bg-cyan-50 border border-cyan-200 p-6 rounded-xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 bg-cyan-600 text-white text-xs font-bold px-3 py-1 rounded-bl-lg">RECOMENDADO</div>
                        <div className="text-sm font-bold text-cyan-700 uppercase mb-4">Novo Cenário</div>
                        <div className="space-y-3">
                            <div className="flex justify-between text-cyan-900"><span>Desconto</span> <strong>{proposalData.discountRate}%</strong></div>
                            <div className="flex justify-between text-cyan-900"><span>Nova Tarifa</span> <strong>{formatCurrency(calculated.bcPrice)}</strong></div>
                            <div className="h-px bg-cyan-200 my-2"></div>
                            <div className="flex justify-between text-lg font-bold text-cyan-900"><span>Mensal</span> <strong>{formatCurrency(calculated.bcMonthlyCost)}</strong></div>
                        </div>
                    </div>
                </div>

                {/* Destaque de Economia */}
                <div className="bg-slate-900 text-white rounded-2xl p-8 text-center relative overflow-hidden">
                    <div className="relative z-10">
                        <div className="text-slate-400 text-sm uppercase tracking-widest mb-2">Economia Anual Projetada</div>
                        <div className="text-6xl font-black text-emerald-400">{formatCurrency(calculated.annualEconomy)}</div>
                        <div className="mt-4 text-sm text-slate-400">Valor que permanece no seu caixa todo ano.</div>
                    </div>
                    <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                </div>

                {/* Tabela de Bandeiras */}
                {proposalData.coversTariffFlag && (
                    <div>
                        <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2"><div className="w-2 h-6 bg-cyan-500 rounded"></div> Cobertura de Bandeiras</h3>
                        <table className="w-full text-sm">
                            <thead className="bg-slate-100 text-slate-600">
                                <tr><th className="p-3 text-left">Bandeira</th><th className="p-3 text-right">Custo Extra (Mercado)</th><th className="p-3 text-right text-emerald-600">Custo Sent</th></tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                <tr><td className="p-3 font-medium">Verde</td><td className="p-3 text-right">R$ 0,00</td><td className="p-3 text-right font-bold text-emerald-600">R$ 0,00</td></tr>
                                <tr><td className="p-3 font-medium text-yellow-600">Amarela</td><td className="p-3 text-right">~ R$ 0,02</td><td className="p-3 text-right font-bold text-emerald-600">R$ 0,00 (Isento)</td></tr>
                                <tr><td className="p-3 font-medium text-red-600">Vermelha 1</td><td className="p-3 text-right">~ R$ 0,04</td><td className="p-3 text-right font-bold text-emerald-600">R$ 0,00 (Isento)</td></tr>
                                <tr><td className="p-3 font-medium text-red-800">Vermelha 2</td><td className="p-3 text-right">~ R$ 0,07</td><td className="p-3 text-right font-bold text-emerald-600">R$ 0,00 (Isento)</td></tr>
                            </tbody>
                        </table>
                        <p className="text-xs text-slate-500 mt-2">* Valores de bandeira aproximados conforme regulação ANEEL.</p>
                    </div>
                )}
            </main>

            <footer className="pt-6 border-t border-slate-200 mt-auto flex justify-between items-end">
                <div className="text-xs text-slate-400">
                    Proposta válida por 5 dias.<br/>
                    Sujeito a análise de crédito.
                </div>
                <div className="flex gap-4">
                    {selectedCommercializer.logo && <img src={selectedCommercializer.logo} alt="Parceiro" className="h-8 object-contain opacity-60" />}
                </div>
            </footer>
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
