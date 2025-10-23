
"use client";

import { useSearchParams } from 'next/navigation';
import { Suspense, useMemo, useState, useRef } from 'react';
import { calculateSavings } from '@/lib/discount-calculator';
import jsPDF from 'jspdf';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Download } from 'lucide-react';

// Função para formatar moeda
const formatCurrency = (value: number | undefined | null) => {
    if (value === undefined || value === null || isNaN(value)) return "R$ 0,00";
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

function ProposalPageContent() {
    const searchParams = useSearchParams();
    const proposalRef = useRef<HTMLDivElement>(null);
    const [isDownloadDialogOpen, setIsDownloadDialogOpen] = useState(false);
    const [fileName, setFileName] = useState('');

    // Extrair dados da URL
    const clienteNome = searchParams.get('clienteNome') || "Cliente não informado";
    const consumoMedioKWh = parseInt(searchParams.get('item1Quantidade') || '0', 10);
    const ucs = searchParams.get('codigoClienteInstalacao') || 'N/A';
    
    // Calcular economia
    const savingsResult = useMemo(() => {
        const kwh = consumoMedioKWh;
        const kwhToReaisFactor = 1.0907; // Fator de conversão kWh para Reais
        const billAmount = kwh * kwhToReaisFactor;
        const uf = searchParams.get('clienteUF') || 'MT'; // Default para MT

        // Reconstruir config de desconto da URL
        const discountType = searchParams.get('discountType') as 'promotional' | 'fixed' || 'promotional';
        let discountConfig;
        if (discountType === 'promotional') {
            discountConfig = {
                type: 'promotional',
                promotional: {
                    rate: parseInt(searchParams.get('promotionalRate') || '25', 10),
                    durationMonths: parseInt(searchParams.get('promotionalDuration') || '3', 10),
                    subsequentRate: parseInt(searchParams.get('subsequentRate') || '15', 10),
                }
            };
        } else {
            discountConfig = {
                type: 'fixed',
                fixed: {
                    rate: parseInt(searchParams.get('fixedRate') || '20', 10),
                }
            };
        }
        // @ts-ignore
        return calculateSavings(billAmount, discountConfig, uf);
    }, [searchParams, consumoMedioKWh]);

    // Dados para a tabela de comparação (exemplo estático, idealmente viria de um cálculo)
    const custoAtual = savingsResult.originalMonthlyBill;
    const economiaMensal = savingsResult.monthlySaving;
    const custoComSent = custoAtual - economiaMensal;
    const custoConcorrente = custoAtual * 0.88; // Simulando 12% de desconto da Enersim
    const diferencaVsConcorrente = custoConcorrente - custoComSent;
    
    const handleDownloadPDF = () => {
        const doc = new jsPDF('p', 'pt', 'a4');
        const content = proposalRef.current;
        if (content) {
            doc.html(content, {
                callback: function (doc) {
                    doc.save(`${fileName || 'proposta-sent-energia'}.pdf`);
                    setIsDownloadDialogOpen(false);
                },
                x: 15,
                y: 15,
                width: 170,
                windowWidth: 650
            });
        }
    };
    
    // Atualiza o nome do arquivo padrão quando o nome do cliente muda
    useState(() => {
        setFileName(`Proposta_Sent_Energia_${clienteNome.replace(/\s+/g, '_')}`);
    });

    return (
        <div style={{ fontFamily: "'Inter', sans-serif", backgroundColor: "#f3f4f6" }}>
            <Dialog open={isDownloadDialogOpen} onOpenChange={setIsDownloadDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Baixar Proposta em PDF</DialogTitle>
                        <DialogDescription>
                            Edite o nome do arquivo abaixo antes de fazer o download.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Label htmlFor="pdf-filename">Nome do Arquivo</Label>
                        <Input 
                            id="pdf-filename" 
                            value={fileName} 
                            onChange={(e) => setFileName(e.target.value)}
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDownloadDialogOpen(false)}>Cancelar</Button>
                        <Button onClick={handleDownloadPDF}>Download</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <div className="a4-container" ref={proposalRef} style={{ maxWidth: '800px', minHeight: '1100px', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)', margin: '2rem auto', backgroundColor: 'white', padding: '2rem 1.5rem' }}>
                <header className="flex justify-between items-center pb-6 border-b border-gray-200 mb-8">
                    <div className="flex items-center">
                        <img 
                            src="https://raw.githubusercontent.com/LucasMouraChaser/backgrounds-sent/main/LOGO_SENT_ENERGIA_HORIZONTAL_COLORIDA.png" 
                            alt="Sent Energia Logo" 
                            className="h-8 md:h-10 w-auto"
                            data-ai-hint="company logo"
                        />
                    </div>
                    <div className="text-right">
                        <h1 className="text-xl md:text-2xl font-bold text-[#FF3399]">PROPOSTA DE ECONOMIA</h1>
                        <p className="text-sm text-gray-500">Data: {new Date().toLocaleDateString('pt-BR')}</p>
                    </div>
                </header>

                <section className="mb-8 p-4 bg-gray-50 rounded-lg border-l-4 border-[#FF3399]">
                    <h2 className="text-lg md:text-xl font-semibold text-gray-800 mb-2">Cliente</h2>
                    <p className="text-2xl font-extrabold text-[#FF3399] mb-4">{clienteNome}</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
                        <div>
                            <span className="font-medium text-gray-700">Consumo Médio Mensal:</span> 
                            <span className="font-bold"> {consumoMedioKWh.toLocaleString('pt-BR')} kWh</span>
                        </div>
                        <div>
                            <span className="font-medium text-gray-700">Unidades Consumidoras (UCs):</span> 
                            <span className="font-bold"> {ucs}</span>
                        </div>
                    </div>
                </section>

                <section className="text-center mb-10">
                    <p className="text-xl text-gray-700 font-light mb-4">Com a solução de energia Sent, sua empresa alcançará:</p>
                    <div className="bg-[#FF3399] text-white p-6 md:p-8 rounded-xl shadow-lg transform hover:scale-[1.02] transition duration-300">
                        <h3 className="text-3xl md:text-5xl font-extrabold tracking-tight mb-2">ECONOMIA ANUAL DE</h3>
                        <p className="text-5xl md:text-7xl font-black">{formatCurrency(savingsResult.annualSaving)}</p>
                        <p className="text-xl md:text-2xl font-semibold mt-2">
                          (Desconto efetivo de {savingsResult.effectiveAnnualDiscountPercentage.toFixed(1)}%)
                        </p>
                    </div>
                </section>

                <section className="mb-10">
                    <h3 className="text-2xl font-bold text-gray-800 mb-4 border-b pb-2">Análise Financeira Detalhada</h3>
                    <div className="overflow-x-auto rounded-lg border border-gray-200">
                        <table className="comparison-table w-full text-sm text-gray-900">
                            <thead>
                                <tr className="bg-gray-100">
                                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontWeight: 600, color: '#374151', backgroundColor: '#f9fafb' }}>Cenário de Fornecimento</th>
                                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontWeight: 600, color: '#374151', backgroundColor: '#f9fafb' }}>Custo Mensal Estimado</th>
                                    <th style={{ padding: '0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb', fontWeight: 600, color: '#374151', backgroundColor: '#f9fafb' }}>Diferença vs. Custo Antes</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                                    <td data-label="Cenário de Fornecimento">Custo Atual (Antes da Sent)</td>
                                    <td data-label="Custo Mensal Estimado" className="font-bold">{formatCurrency(custoAtual)}</td>
                                    <td data-label="Diferença vs. Custo Antes" className="text-right text-gray-600">{formatCurrency(0)}</td>
                                </tr>
                                <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                                    <td data-label="Cenário de Fornecimento">Custo com a Concorrente (Ex: Enersim)</td>
                                    <td data-label="Custo Mensal Estimado">{formatCurrency(custoConcorrente)}</td>
                                    <td data-label="Diferença vs. Custo Antes" className="text-right text-red-600 font-medium">Economia de {formatCurrency(custoAtual - custoConcorrente)}</td>
                                </tr>
                                <tr className="text-[#FF3399] bg-[#FF3399]/10" style={{ fontWeight: 700, backgroundColor: '#fff0f5' }}>
                                    <td data-label="Cenário de Fornecimento">Proposta <span className="font-extrabold">Sent</span></td>
                                    <td data-label="Custo Mensal Estimado" className="font-extrabold text-2xl">{formatCurrency(custoComSent)}</td>
                                    <td data-label="Diferença vs. Custo Antes" className="text-right text-green-700 font-extrabold">Economia de {formatCurrency(economiaMensal)}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    <div className="mt-6 p-4 bg-gray-100 rounded-lg text-center">
                        <p className="text-lg font-semibold text-gray-800">
                            A diferença entre a proposta <span className="text-[#FF3399]">Sent</span> e a melhor alternativa é de 
                            <span className="text-[#FF3399] font-extrabold"> {formatCurrency(diferencaVsConcorrente)} mensais</span>.
                        </p>
                    </div>
                </section>

                <section className="mb-8 p-6 bg-[#FF3399] rounded-xl text-white text-center">
                    <h4 className="text-xl md:text-2xl font-bold mb-3">Maximize Sua Economia Agora!</h4>
                    <p className="mb-4">Com o serviço Sent, você garante a melhor condição de mercado, segurança e previsibilidade no seu custo de energia.</p>
                    <button className="bg-white text-[#FF3399] hover:bg-gray-200 transition duration-150 font-bold py-3 px-8 rounded-full shadow-lg">
                        FALE CONOSCO E FECHE O SEU CONTRATO
                    </button>
                </section>

                <footer className="pt-6 border-t border-gray-200 text-center text-xs text-gray-500">
                    <p>Proposta elaborada por Sent Energia | Seu Parceiro em Energia Inteligente.</p>
                    <p>{savingsResult.discountDescription}</p>
                    <p>Os valores são estimativas baseadas no consumo médio fornecido e podem sofrer pequenas variações de acordo com a tarifa e demanda da distribuidora local.</p>
                </footer>
            </div>
             <div className="fixed bottom-6 right-6 z-50">
                <Button onClick={() => setIsDownloadDialogOpen(true)} size="lg" className="rounded-full shadow-lg h-16 w-auto px-6">
                    <Download className="mr-3 h-6 w-6" />
                    <div className="flex flex-col items-start">
                        <span className="text-base font-bold">Baixar PDF</span>
                    </div>
                </Button>
            </div>
        </div>
    );
}

export default function ProposalPage() {
    return (
        <Suspense fallback={<div>Carregando proposta...</div>}>
            <ProposalPageContent />
        </Suspense>
    );
}
