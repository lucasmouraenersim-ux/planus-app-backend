
"use client";

import { useSearchParams } from 'next/navigation';
import { Suspense, useMemo, useState, useRef, useEffect } from 'react';
import jsPDF from 'jspdf';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';

// Função para formatar moeda
const formatCurrency = (value: number | undefined | null) => {
    if (value === undefined || value === null || isNaN(value)) return "R$ 0,00";
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const formatKWh = (value: number | undefined | null) => {
    if (value === undefined || value === null || isNaN(value)) return "0 kWh";
    return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 0 }).format(value) + ' kWh';
}

function ProposalPageContent() {
    const searchParams = useSearchParams();
    const proposalRef = useRef<HTMLDivElement>(null);
    
    // State for all proposal inputs
    const [proposalData, setProposalData] = useState({
        proposalCode: '0001/2025',
        clientName: 'ACADEMIA FITNESS TOTAL LTDA',
        clientCpfCnpj: 'XX.XXX.XXX/0001-XX',
        consumerUnit: 'Rua das Acacias, 123 - Goiânia/GO',
        distributor: 'Neoenergia Brasília',
        avgConsumption: 23183,
        currentPrice: 0.98,
        discountRate: 19
    });

    // State for calculated values
    const [calculated, setCalculated] = useState({
        avgMonthlyCost: 0,
        bcPrice: 0,
        bcMonthlyCost: 0,
        monthlyEconomy: 0,
        annualEconomy: 0
    });
    
    // Pre-fill from URL params
    useEffect(() => {
        setProposalData(prev => ({
            ...prev,
            clientName: searchParams.get('clienteNome') || prev.clientName,
            avgConsumption: parseFloat(searchParams.get('item1Quantidade') || String(prev.avgConsumption)),
            currentPrice: parseFloat(searchParams.get('currentTariff') || String(prev.currentPrice)),
            discountRate: parseFloat(searchParams.get('fixedRate') || searchParams.get('promotionalRate') || String(prev.discountRate)),
            clientCpfCnpj: searchParams.get('clienteCnpjCpf') || prev.clientCpfCnpj,
            consumerUnit: `${searchParams.get('clienteRua') || ''}, ${searchParams.get('clienteNumero') || ''} - ${searchParams.get('clienteCidade') || ''}/${searchParams.get('clienteUF') || ''}` || prev.consumerUnit,
        }));
    }, [searchParams]);

    // Perform calculations when data changes
    useEffect(() => {
        const { avgConsumption, currentPrice, discountRate } = proposalData;
        const discountDecimal = discountRate / 100;
        
        const avgMonthlyCost = avgConsumption * currentPrice;
        const bcPrice = currentPrice * (1 - discountDecimal);
        const bcMonthlyCost = avgConsumption * bcPrice;
        const monthlyEconomy = avgMonthlyCost - bcMonthlyCost;
        const annualEconomy = monthlyEconomy * 12;

        setCalculated({
            avgMonthlyCost,
            bcPrice,
            bcMonthlyCost,
            monthlyEconomy,
            annualEconomy
        });
    }, [proposalData]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { id, value } = e.target;
        const isNumber = e.target.type === 'number';
        setProposalData(prev => ({
            ...prev,
            [id]: isNumber ? parseFloat(value) || 0 : value
        }));
    };

    const handleDownloadPDF = () => {
        const doc = new jsPDF('p', 'pt', 'a4');
        const content = proposalRef.current;
        if (content) {
            doc.html(content, {
                callback: function (doc) {
                    doc.save(`Proposta_${proposalData.clientName.replace(/\s+/g, '_')}.pdf`);
                },
                x: 0,
                y: 0,
                html2canvas: {
                  scale: 0.6 // Scale down to fit A4
                },
            });
        }
    };

    return (
        <div className="font-sans bg-gray-100 p-4 md:p-8">
            <div id="proposal-container" className="max-w-4xl mx-auto space-y-6">

                {/* Input Area */}
                <div className="bg-white page rounded-xl p-6 md:p-8 border-t-8 border-blue-600">
                    <h2 className="text-3xl font-bold mb-6 text-gray-800">⚙️ Configuração Rápida da Proposta (Edite Aqui)</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div><label htmlFor="proposalCode" className="block text-sm font-medium text-gray-700">1. Código da Proposta</label><input type="text" id="proposalCode" value={proposalData.proposalCode} onChange={handleInputChange} className="p-2 border border-gray-300 rounded-lg w-full" /></div>
                        <div><label htmlFor="clientName" className="block text-sm font-medium text-gray-700">2. Nome do Cliente</label><input type="text" id="clientName" value={proposalData.clientName} onChange={handleInputChange} className="p-2 border border-gray-300 rounded-lg w-full" /></div>
                        <div><label htmlFor="clientCpfCnpj" className="block text-sm font-medium text-gray-700">3. CNPJ/CPF</label><input type="text" id="clientCpfCnpj" value={proposalData.clientCpfCnpj} onChange={handleInputChange} className="p-2 border border-gray-300 rounded-lg w-full" /></div>
                        <div><label htmlFor="consumerUnit" className="block text-sm font-medium text-gray-700">4. Unidade Consumidora (UC)</label><input type="text" id="consumerUnit" value={proposalData.consumerUnit} onChange={handleInputChange} className="p-2 border border-gray-300 rounded-lg w-full" /></div>
                        <div><label htmlFor="distributor" className="block text-sm font-medium text-gray-700">5. Distribuidora</label><input type="text" id="distributor" value={proposalData.distributor} onChange={handleInputChange} className="p-2 border border-gray-300 rounded-lg w-full" /></div>
                        <div><label htmlFor="avgConsumption" className="block text-sm font-medium text-gray-700">6. Consumo Mensal (kWh)</label><input type="number" id="avgConsumption" value={proposalData.avgConsumption} onChange={handleInputChange} className="p-2 border border-gray-300 rounded-lg w-full" /></div>
                        <div><label htmlFor="currentPrice" className="block text-sm font-medium text-gray-700">7. Tarifa Atual (R$/kWh)</label><input type="number" id="currentPrice" step="0.01" value={proposalData.currentPrice} onChange={handleInputChange} className="p-2 border border-gray-300 rounded-lg w-full" /></div>
                        <div><label htmlFor="discountRate" className="block text-sm font-medium text-gray-700">8. Desconto Oferecido (%)</label><input type="number" id="discountRate" value={proposalData.discountRate} onChange={handleInputChange} className="p-2 border border-gray-300 rounded-lg w-full" /></div>
                    </div>
                </div>

                <div ref={proposalRef} className="space-y-6">
                    {/* Page 1 */}
                    <div className="page rounded-xl flex flex-col justify-between items-center text-center p-10 md:p-20 bg-[#1e3a8a] text-white">
                        <p className="text-xl font-light opacity-80">Código da proposta: {proposalData.proposalCode}</p>
                        <div className="my-16"><h1 className="text-6xl md:text-8xl font-black tracking-tighter">Proposta Comercial</h1><h2 className="text-3xl md:text-5xl font-light mt-4">Geração Distribuída</h2><h3 className="text-2xl md:text-4xl font-extrabold mt-2 text-[#06b6d4]">Energia por Assinatura</h3></div>
                        <div className="mt-auto"><p className="text-xl md:text-3xl font-light mb-4">Geramos valor com a nossa energia.</p><div className="text-2xl font-black uppercase tracking-widest">GRUPO BC ENERGIA</div></div>
                    </div>

                    {/* Page 2 */}
                    <div className="page rounded-xl p-8 md:p-12 bg-white">
                        <h2 className="text-4xl font-extrabold mb-8 text-[#1e3a8a] border-b pb-2">Quem Somos</h2>
                        <p className="mb-8 text-lg text-gray-700">O Grupo BC Energia é composto por um conjunto de empresas dedicadas ao setor elétrico, atuando em modelos de negócios de <strong>geração distribuída</strong> (energia por assinatura para baixa tensão) e <strong>comercialização/serviços de gestão de energia</strong> (para média e alta tensão no mercado livre).</p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12 text-center">
                            <div className="p-4 rounded-lg bg-blue-50"><p className="text-3xl font-black text-[#1e3a8a]">+5.500</p><p className="text-sm text-gray-600">clientes atendidos</p></div>
                            <div className="p-4 rounded-lg bg-blue-50"><p className="text-3xl font-black text-[#1e3a8a]">+R$ 480 mi</p><p className="text-sm text-gray-600">de economia gerada</p></div>
                            <div className="p-4 rounded-lg bg-blue-50"><p className="text-3xl font-black text-[#1e3a8a]">+230 GWh</p><p className="text-sm text-gray-600">de geração limpa e renovável</p></div>
                            <div className="p-4 rounded-lg bg-blue-50"><p className="text-3xl font-black text-[#1e3a8a]">ESG</p><p className="text-sm text-gray-600">+15 mil toneladas de CO2 evitados</p></div>
                        </div>
                        <h3 className="text-2xl font-bold mb-4 text-gray-800 border-l-4 border-[#06b6d4] pl-3">Algumas de Nossas Usinas</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><div className="bg-gray-100 rounded-lg p-4 text-center"><img src="https://placehold.co/400x200/1e3a8a/ffffff?text=FOTO+USINA+1" alt="Placeholder para a foto da Usina 1" className="w-full h-40 object-cover rounded-lg mb-2" /><p className="font-semibold text-sm">Usina Vera de Minas (MG)</p><p className="text-xs text-gray-500">Capacidade: XX MWp</p></div><div className="bg-gray-100 rounded-lg p-4 text-center"><img src="https://placehold.co/400x200/06b6d4/1e3a8a?text=FOTO+USINA+2" alt="Placeholder para a foto da Usina 2" className="w-full h-40 object-cover rounded-lg mb-2" /><p className="font-semibold text-sm">Usina Calajina (GO)</p><p className="text-xs text-gray-500">Capacidade: XX MWp</p></div></div>
                    </div>
                    
                    {/* Page 3 */}
                    <div className="page rounded-xl p-8 md:p-12 bg-white">
                        <h2 className="text-4xl font-extrabold mb-4 text-[#1e3a8a] border-b pb-2">Proposta Comercial</h2>
                        <p className="text-lg text-gray-600 mb-8">Geração Distribuída - Energia por Assinatura</p>
                        <div className="bg-gray-50 p-6 rounded-lg mb-8 border-l-4 border-[#06b6d4]">
                            <h3 className="text-xl font-bold text-gray-800 mb-3">Dados da Proposta</h3>
                            <p className="grid grid-cols-2 gap-2 text-sm"><span className="font-semibold">Cliente:</span> <span>{proposalData.clientName}</span><span className="font-semibold">CNPJ/CPF:</span> <span>{proposalData.clientCpfCnpj}</span><span className="font-semibold">Instalações (UC):</span> <span>{proposalData.consumerUnit}</span><span className="font-semibold">Distribuidora:</span> <span>{proposalData.distributor}</span></p>
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <div className="bg-red-50 p-6 rounded-lg border-l-4 border-red-500"><h3 className="text-2xl font-bold text-red-700 mb-4">Custo sem a BC Energia</h3><div className="space-y-2"><p className="flex justify-between items-center text-lg"><span className="font-semibold">Consumo Mensal (kWh):</span><span className="font-bold">{formatKWh(proposalData.avgConsumption)}</span></p><p className="flex justify-between items-center text-lg"><span className="font-semibold">Preço Atual (R$/kWh):</span><span className="font-bold text-red-500">{formatCurrency(proposalData.currentPrice)}</span></p><p className="flex justify-between items-center text-2xl border-t pt-2"><span className="font-black">Custo Médio (Mensal):</span><span className="font-black text-red-700">{formatCurrency(calculated.avgMonthlyCost)}</span></p></div></div>
                            <div className="bg-green-50 p-6 rounded-lg border-l-4 border-green-500"><h3 className="text-2xl font-bold text-green-700 mb-4">Desconto BC Energia</h3><div className="space-y-2"><p className="flex justify-between items-center text-lg"><span className="font-semibold">Desconto (%):</span><span className="font-bold text-green-600">{proposalData.discountRate}%</span></p><p className="flex justify-between items-center text-lg"><span className="font-semibold">Preço BC (R$/kWh):</span><span className="font-bold text-green-600">{formatCurrency(calculated.bcPrice)}</span></p><p className="flex justify-between items-center text-2xl border-t pt-2"><span className="font-black">Custo Médio (Mensal):</span><span className="font-black text-green-700">{formatCurrency(calculated.bcMonthlyCost)}</span></p></div></div>
                        </div>
                        <div className="mt-8 bg-blue-600 text-white p-6 rounded-lg text-center shadow-lg"><p className="text-2xl font-semibold mb-2">Economia Mensal (Bandeira Verde):</p><p className="text-5xl font-black">{formatCurrency(calculated.monthlyEconomy)}</p><p className="text-xl mt-4 font-semibold">Economia Anual Sem Investimento:</p><p className="text-4xl font-black text-yellow-300">{formatCurrency(calculated.annualEconomy)}</p></div>
                        <div className="mt-8"><h3 className="text-2xl font-bold mb-4 text-gray-800 border-l-4 border-blue-400 pl-3">O que é a Bandeira Tarifária?</h3><p className="text-gray-700 mb-4">Assim como um semáforo, as cores mostram o custo da energia a cada período. <strong>Com a BC Energia, você está protegido das variações das bandeiras tarifárias.</strong> Mesmo quando uma bandeira tarifária está em vigor, você continua economizando.</p><div className="overflow-x-auto"><table className="min-w-full bg-white rounded-lg shadow-md"><thead><tr className="bg-gray-200 text-gray-700 uppercase text-sm leading-normal"><th className="py-3 px-6 text-left">Cor</th><th className="py-3 px-6 text-left">Significado</th><th className="py-3 px-6 text-left">Impacto na Conta</th></tr></thead><tbody className="text-gray-600 text-sm font-light"><tr className="border-b border-gray-200 hover:bg-gray-100"><td className="py-3 px-6 font-bold text-green-600">Verde</td><td className="py-3 px-6">Condições normais de geração</td><td className="py-3 px-6">Nenhuma cobrança extra</td></tr><tr className="border-b border-gray-200 hover:bg-gray-100"><td className="py-3 px-6 font-bold text-yellow-600">Amarela</td><td className="py-3 px-6">Geração mais cara</td><td className="py-3 px-6">Taxa adicional</td></tr><tr className="border-b border-gray-200 hover:bg-gray-100"><td className="py-3 px-6 font-bold text-red-600">Vermelha I</td><td className="py-3 px-6">Geração muito cara</td><td className="py-3 px-6">Custo extra mais elevado</td></tr><tr className="hover:bg-gray-100"><td className="py-3 px-6 font-bold text-red-800">Vermelha II</td><td className="py-3 px-6">Geração em estado crítico</td><td className="py-3 px-6">Custo extra máximo</td></tr></tbody></table></div></div>
                    </div>
                </div>
            </div>

            <div className="fixed bottom-6 right-6 z-50">
                <Button onClick={handleDownloadPDF} size="lg" className="rounded-full shadow-lg h-16 w-auto px-6">
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
