
"use client";

import type { InvoiceData } from '@/types/invoice';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import Image from 'next/image';
import {
  Sun, // Replacing BarChart2 for Planus logo context
  Zap,        
  Lightbulb,  
  DollarSign, 
  CalendarDays, 
  Globe,      
  TreePine,   
} from 'lucide-react';

const PLANUS_BLUE = "#004460";
const PLANUS_YELLOW = "#FDB813";

const formatCurrency = (value: string | number | undefined | null, defaultString = "R$ 0,00"): string => {
  if (value === undefined || value === null || value === "") return defaultString;
  const numValue = typeof value === 'string' ? parseFloat(value.replace("R$", "").trim().replace(/\./g, '').replace(',', '.')) : value;
  if (isNaN(numValue)) return defaultString;
  return numValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const formatNumber = (value: string | number | undefined | null, fractionDigits = 2, defaultString = "0,00"): string => {
    if (value === undefined || value === null || value === "") return defaultString;
    const numValue = typeof value === 'string' ? parseFloat(value.replace(/\./g, '').replace(',', '.')) : value;
    if (isNaN(numValue)) return defaultString;
    return numValue.toLocaleString('pt-BR', { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits });
};

const IconItem: React.FC<{ icon: React.ElementType; label: string; value: string; bgColorClass?: string; iconColorClass?: string }> = ({ icon: Icon, label, value, bgColorClass = "bg-cyan-100", iconColorClass = "text-[#004460]" }) => (
  <div className="flex flex-col items-center text-center p-2 space-y-1">
    <div className={`w-16 h-16 rounded-full flex items-center justify-center ${bgColorClass}`}>
      <Icon className={`w-8 h-8 ${iconColorClass}`} />
    </div>
    <span className="text-xs text-gray-600">{label}</span>
    <span className="text-sm font-bold text-gray-800">{value}</span>
  </div>
);

export const PlanusInvoiceDisplay: React.FC<{ invoiceData: InvoiceData | null }> = ({ invoiceData }) => {
  if (!invoiceData) {
    return <div className="p-4 text-center text-muted-foreground">Carregando dados da fatura Planus...</div>;
  }

  const today = new Date();
  const dataAtualFormatada = format(today, 'dd/MM/yyyy', { locale: ptBR });
  const refMesAno = invoiceData.mesAnoReferencia ? invoiceData.mesAnoReferencia.toUpperCase() : format(today, 'MMM/yyyy', { locale: ptBR }).toUpperCase();
  const dataVencimentoFormatada = invoiceData.dataVencimento || format(new Date(today.setDate(today.getDate() + 10)), 'dd/MM/yyyy', { locale: ptBR });
  
  const uc = invoiceData.codigoClienteInstalacao || "N/A";
  const supplyTypeSelected = invoiceData.ligacao || "N/A";
  const numeroBoleto = invoiceData.boweNumeroBoleto || "S/N"; 
  
  const totalAPagarComDescontoPlanus = formatCurrency(invoiceData.valorTotalFatura);
  const clientName = invoiceData.clienteNome || "N/A";
  const cpfCnpj = invoiceData.clienteCnpjCpf || "N/A";
  const localidadeCliente = `${invoiceData.clienteCidadeUF || "N/A"}`;

  const valorTotalFaturaBruto = formatCurrency(invoiceData.boweAntesValor); 
  const economiaMensal = formatCurrency(invoiceData.boweEconomiaMensalValor);
  const economiaAcumuladaCalculada = formatCurrency(invoiceData.boweEconomiaAcumuladaValor); 
  const reducaoCO2 = invoiceData.boweReducaoCO2Valor || "0 t"; 
  const arvoresPlantadas = invoiceData.boweArvoresPlantadasValor || "0"; 

  const cipLabelText = invoiceData.item3Desc ? invoiceData.item3Desc.replace("Contrib de Ilum Pub", "CIP").split('(')[0].trim() : "CIP";
  const custosDistribuidoraPage2 = formatCurrency(invoiceData.boweCustosDistribuidoraValor);
  const kwhConsumoEfetivo = formatNumber(invoiceData.item1Quantidade, 2);
  const energiaEletricaValorUnitarioPlanus = formatNumber(invoiceData.boweEnergiaEletricaTarifa, 6); // Changed to formatNumber
  const energiaEletricaValorTotalPlanus = formatCurrency(invoiceData.boweEnergiaEletricaValor);
  const restituicaoPisCofins = formatCurrency(invoiceData.boweRestituicaoPisCofinsValor);
  const creditosPlanus = formatCurrency(invoiceData.boweCreditosValor); 
  
  const energisaTariffComTributos = formatNumber(parseFloat(invoiceData.item1Tarifa || "0"), 6); // Changed to formatNumber
  const semPlanusCustoEnergia = formatCurrency(invoiceData.boweSemBowCustosDistribuidoraValor); 
  const semPlanusCustoDisponibilidade = formatCurrency(invoiceData.boweSemBowDemaisCustosValor); 
  const semPlanusIluminacaoPublicaValor = formatCurrency(invoiceData.item3Valor); 
  const semPlanusTotal = formatCurrency(invoiceData.boweAntesValor); 

  const pixCode = invoiceData.bowePixCodigo || `00190.00009 03730.402009 00007.813173 1 1031000${parseFloat(invoiceData.valorTotalFatura || "0").toFixed(2).replace('.', '').padStart(10, '0')}`;
  const beneficiario = invoiceData.bowePixBeneficiario || `Beneficiário: PLANUS ENERGIA SIMULAÇÃO - CNPJ: XX.XXX.XXX/0001-XX`;


  return (
    <div className="bg-white text-gray-800 p-0 md:p-0 rounded-lg shadow-xl max-w-4xl mx-auto font-sans my-8">
      {/* Header */}
      <div className="bg-[#004460] text-white p-6 md:p-8 rounded-t-lg flex flex-col md:flex-row justify-between items-start mb-0">
        <div className="mb-4 md:mb-0 flex items-center">
          <Image 
            src="https://placehold.co/150x50/004460/FDB813?text=Empresa%0AVencedora" 
            alt="Logo Empresa Vencedora"
            width={150}
            height={50}
            data-ai-hint="company logo"
          />
        </div>
        <div className="text-xs space-y-1 md:text-right flex-shrink-0 md:pl-4">
          <p><strong className="font-medium text-gray-300">Nº de Instalação:</strong> {uc}</p>
          <p><strong className="font-medium text-gray-300">Tipo de Ligação:</strong> {supplyTypeSelected}</p>
          <p><strong className="font-medium text-gray-300">Número do Boleto:</strong> {numeroBoleto}</p>
          <p><strong className="font-medium text-gray-300">Data de Emissão:</strong> {dataAtualFormatada}</p>
        </div>
        <div className="text-xs space-y-1 md:text-right mt-4 md:mt-0 md:pl-4">
          <p><strong className="font-medium text-gray-300">Mês de referência:</strong> <span className="text-white font-semibold">{refMesAno}</span></p>
          <p><strong className="font-medium text-gray-300">Data de vencimento:</strong> <span className="text-white font-semibold">{dataVencimentoFormatada}</span></p>
          <p className="mt-1"><strong className="block font-medium text-gray-300">Total a pagar:</strong></p>
          <p className="text-2xl font-bold text-[#FDB813]">{totalAPagarComDescontoPlanus}</p>
        </div>
      </div>
      
      <div className="p-6 md:p-8"> {/* Content padding starts here */}
        {/* Client Info */}
        <div className="mb-6 pb-4 border-b border-gray-200 text-sm">
          <p><strong className="font-semibold text-gray-700">Nome/Razão Social do Titular:</strong> <span className="uppercase font-medium text-gray-900">{clientName}</span></p>
          <p><strong className="font-semibold text-gray-700">CPF/CNPJ:</strong> {cpfCnpj}</p>
          <p><strong className="font-semibold text-gray-700">Endereço:</strong> {invoiceData.clienteEndereco || "N/A"}</p>
          <p><strong className="font-semibold text-gray-700">Localidade:</strong> {localidadeCliente}</p>
        </div>

        {/* Entenda sua Fatura! */}
        <div className="mb-8">
          <h2 className="text-xl font-bold text-[#004460] text-center mb-4">ENTENDA SUA FATURA!</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
            <IconItem icon={Zap} label="Antes da Planus" value={valorTotalFaturaBruto} bgColorClass="bg-red-100" iconColorClass="text-red-500" />
            <IconItem icon={Lightbulb} label="Depois da Planus" value={totalAPagarComDescontoPlanus} bgColorClass="bg-green-100" iconColorClass="text-green-600" />
            <IconItem icon={DollarSign} label="Sua economia" value={economiaMensal} bgColorClass="bg-yellow-100" iconColorClass="text-yellow-500" />
            <IconItem icon={CalendarDays} label="Economia Acumulada" value={economiaAcumuladaCalculada} bgColorClass="bg-blue-100" iconColorClass="text-blue-500" />
            <IconItem icon={Globe} label="Redução de CO²" value={reducaoCO2} bgColorClass="bg-teal-100" iconColorClass="text-teal-500" />
            <IconItem icon={TreePine} label="Árvores Plantadas" value={arvoresPlantadas} bgColorClass="bg-lime-100" iconColorClass="text-lime-500" />
          </div>
        </div>

        {/* Seus Custos Mensais */}
        <div className="mb-8">
          <h2 className="text-xl font-bold text-[#004460] mb-3">SEUS CUSTOS MENSAIS</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#004460] text-white">
                <tr>
                  <th className="p-2 text-left font-semibold">Descrição</th>
                  <th className="p-2 text-right font-semibold">Quantidade</th>
                  <th className="p-2 text-right font-semibold">Valor unitário por kWh</th>
                  <th className="p-2 text-right font-semibold">Valor TOTAL</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-200">
                  <td className="p-2">Custos da distribuidora ({cipLabelText})</td>
                  <td className="p-2 text-right">{formatNumber(invoiceData.item1Quantidade,0)} kWh + {cipLabelText}</td>
                  <td className="p-2 text-right">Variado</td>
                  <td className="p-2 text-right">{custosDistribuidoraPage2}</td>
                </tr>
                <tr className="border-b border-gray-200">
                  <td className="p-2">Energia elétrica Planus</td>
                  <td className="p-2 text-right">{kwhConsumoEfetivo} kWh</td>
                  <td className="p-2 text-right">R$ {energiaEletricaValorUnitarioPlanus}</td>
                  <td className="p-2 text-right">{energiaEletricaValorTotalPlanus}</td>
                </tr>
                <tr className="border-b border-gray-200">
                  <td className="p-2">PIS/COFINS</td>
                  <td className="p-2 text-right">-</td>
                  <td className="p-2 text-right">-</td>
                  <td className="p-2 text-right">{restituicaoPisCofins}</td>
                </tr>
                <tr className="border-b border-gray-200">
                  <td className="p-2">Créditos Energia Injetada</td>
                  <td className="p-2 text-right">-</td>
                  <td className="p-2 text-right">-</td>
                  <td className="p-2 text-right">{creditosPlanus}</td>
                </tr>
                <tr className="font-bold text-gray-800 bg-gray-100">
                  <td className="p-2 text-lg">TOTAL</td>
                  <td className="p-2 text-right"></td>
                  <td className="p-2 text-right"></td>
                  <td className="p-2 text-right text-lg text-[#004460]">{totalAPagarComDescontoPlanus}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Observação */}
        <div className="mb-8 p-3 bg-gray-50 rounded-md text-sm text-gray-600">
          <strong className="text-gray-700">Observação:</strong> {invoiceData.boweObservacao || "Valores simulados. A economia real pode variar. Contate um consultor para mais detalhes."}
        </div>

        {/* Footer Grid */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div>
            <h3 className="text-md font-semibold text-[#004460] mb-2">GRÁFICO COM HISTÓRICO DE CONSUMO (Exemplo)</h3>
            <div className="bg-gray-100 p-4 rounded-md h-48 flex items-center justify-center">
              <Image src="https://placehold.co/300x150.png" alt="Gráfico de Consumo" width={300} height={150} data-ai-hint="bar chart" className="object-contain"/>
            </div>
          </div>
          <div>
            <h3 className="text-md font-semibold text-[#004460] mb-2">QUANTO VOCÊ GASTARIA SEM A PLANUS</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-[#004460] text-white">
                  <tr>
                    <th className="p-1.5 text-left font-semibold">Descrição</th>
                    <th className="p-1.5 text-right font-semibold">Qtde</th>
                    <th className="p-1.5 text-right font-semibold">Valor por kWh</th>
                    <th className="p-1.5 text-right font-semibold">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-200">
                    <td className="p-1.5">Custos da distribuidora (Energia)</td>
                    <td className="p-1.5 text-right">{kwhConsumoEfetivo} kWh</td>
                    <td className="p-1.5 text-right">R$ {energisaTariffComTributos}</td>
                    <td className="p-1.5 text-right">{semPlanusCustoEnergia}</td>
                  </tr>
                  <tr className="border-b border-gray-200">
                    <td className="p-1.5">Custos da distribuidora (Disponibilidade)</td>
                    <td className="p-1.5 text-right">{formatNumber(invoiceData.item1Quantidade,0)} kWh</td>
                    <td className="p-1.5 text-right">R$ {energisaTariffComTributos}</td>
                    <td className="p-1.5 text-right">{semPlanusCustoDisponibilidade}</td>
                  </tr>
                  <tr className="border-b border-gray-200">
                    <td className="p-1.5">{cipLabelText}</td>
                    <td className="p-1.5 text-right">-</td>
                    <td className="p-1.5 text-right">-</td>
                    <td className="p-1.5 text-right">{semPlanusIluminacaoPublicaValor}</td>
                  </tr>
                  <tr className="border-b border-gray-200">
                    <td className="p-1.5">Demais Custos</td>
                    <td className="p-1.5 text-right">-</td>
                    <td className="p-1.5 text-right">-</td>
                    <td className="p-1.5 text-right">{formatCurrency(0)}</td>
                  </tr>
                  <tr className="font-bold text-gray-800 bg-gray-100">
                    <td className="p-1.5">TOTAL</td>
                    <td className="p-1.5 text-right"></td>
                    <td className="p-1.5 text-right"></td>
                    <td className="p-1.5 text-right text-[#004460]">{semPlanusTotal}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* PIX Info */}
        <div className="border-t border-gray-200 pt-6 mt-6">
          <div className="flex flex-col md:flex-row items-start md:items-center">
              <div className="mb-4 md:mb-0 md:mr-6">
                   <Image src="https://placehold.co/80x80.png" alt="QR Code PIX" width={80} height={80} data-ai-hint="qrcode" />
              </div>
              <div className="text-xs text-gray-600 space-y-0.5 flex-grow">
                  <p><strong className="text-gray-700">Mês de Referência:</strong> {refMesAno}</p>
                  <p><strong className="text-gray-700">Data de Vencimento:</strong> {dataVencimentoFormatada}</p>
                  <p><strong className="text-gray-700">Total a Pagar:</strong> <span className="font-bold text-[#004460]">{totalAPagarComDescontoPlanus}</span></p>
                  <p><strong className="text-gray-700">Nº de Instalação:</strong> {uc}</p>
              </div>
          </div>
          <div className="mt-3 bg-gray-100 p-2 rounded text-center">
              <p className="text-xs font-mono break-all text-gray-700">{pixCode}</p>
          </div>
          <p className="text-xs text-center mt-2 text-gray-600">{beneficiario}</p>
        </div>
      </div> {/* Closing content padding div */}
    </div>
  );
};
