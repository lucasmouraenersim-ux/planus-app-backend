
// /src/app/dashboard/page.tsx
"use client";

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { format, addDays, subDays, getDaysInMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '@/contexts/AuthContext'; 

import { BrazilMapGraphic } from '@/components/BrazilMapGraphic';
import { StateInfoCard } from '@/components/StateInfoCard';
import { SavingsDisplay } from '@/components/SavingsDisplay';
import InvoiceEditor from '@/components/invoice-editor';
import { PlanusInvoiceDisplay } from '@/components/PlanusInvoiceDisplay'; 
import CompetitorComparisonDisplay from '@/components/CompetitorComparisonDisplay';

import { statesData } from '@/data/state-data';
import type { StateInfo, SavingsResult, InvoiceData } from '@/types';
import { calculateSavings } from '@/lib/discount-calculator';
import { initialInvoiceData as defaultInitialInvoiceData, ENERGISA_INVOICE_FIELDS_CONFIG } from '@/config/invoice-fields';


import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Button } from '@/components/ui/button';
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { MapPin, ChevronLeft, FileText, Loader2 } from 'lucide-react';

const KWH_TO_R_FACTOR = 1.0907; 
const MIN_KWH_SLIDER = 400;
const MAX_KWH_SLIDER = 100000; 
const SLIDER_STEP = 50;
const DEFAULT_KWH = 1500;
const DEFAULT_UF = 'MT';

// Constantes para cálculos da fatura
const TARIFA_ENERGIA = 1.093110; // R$/kWh
const ALIQUOTA_PIS_PERC = 1.0945 / 100; 
const ALIQUOTA_COFINS_PERC = 4.9955 / 100; 
const ALIQUOTA_ICMS_PERC = 17.00 / 100;

const formatNumberToCurrencyString = (value: number | null | undefined, includeSymbol = true): string => {
  if (value === null || value === undefined || isNaN(value)) return includeSymbol ? "R$ 0,00" : "0,00";
  return value.toLocaleString('pt-BR', { 
    style: includeSymbol ? 'currency' : 'decimal', 
    currency: 'BRL', 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  });
};

const formatNumberToLocaleString = (value: number | null | undefined, fractionDigits: number = 2): string => {
  if (value === null || value === undefined || isNaN(value)) {
    if (fractionDigits === 0) return "0";
    return "0," + "0".repeat(fractionDigits);
  }
  return value.toLocaleString('pt-BR', { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits });
};

const parseLocaleNumberString = (str: string | null | undefined): number => {
  if (!str) return 0;
  const cleanedString = String(str).replace("R$", "").trim().replace(/\./g, '').replace(',', '.');
  return parseFloat(cleanedString);
};

const formatUc = (uc: string | null | undefined): string => {
  if (!uc || String(uc).length < 3) return uc || "";
  const ucStr = String(uc);
  const firstDigit = ucStr.charAt(0);
  const lastDigit = ucStr.charAt(ucStr.length - 1);
  const middleDigits = ucStr.substring(1, ucStr.length - 1);
  return `${firstDigit} / ${middleDigits} - ${lastDigit}`;
};


function CalculatorPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { firebaseUser, appUser, isLoadingAuth } = useAuth();
  
  const [showMap, setShowMap] = useState(true); 
  const [hoveredStateCode, setHoveredStateCode] = useState<string | null>(null);
  const [selectedState, setSelectedState] = useState<StateInfo | null>(null);
  const [currentKwh, setCurrentKwh] = useState<number>(DEFAULT_KWH);
  const [isFidelityEnabled, setIsFidelityEnabled] = useState(true);
  const [savings, setSavings] = useState<SavingsResult | null>(null);
  
  const [shouldShowInvoiceEditor, setShouldShowInvoiceEditor] = useState(false);
  const [originalInvoiceData, setOriginalInvoiceData] = useState<InvoiceData | null>(null);
  const [planusInvoiceData, setPlanusInvoiceData] = useState<InvoiceData | null>(null);
  
  useEffect(() => {
    if (!isLoadingAuth && !firebaseUser) {
        router.replace('/login');
    }
  }, [isLoadingAuth, firebaseUser, router]);

  useEffect(() => {
    if (isLoadingAuth || !firebaseUser) return;

    const params = new URLSearchParams(searchParams.toString());
    const hasProposalData = !!params.get("clienteNome");

    if (hasProposalData) {
      setShouldShowInvoiceEditor(true);
      setShowMap(false); 

      const newOriginalInvoiceData = { ...defaultInitialInvoiceData } as InvoiceData;
      
      params.forEach((value, key) => {
        if (key in newOriginalInvoiceData && key !== 'codigoClienteInstalacao') {
          newOriginalInvoiceData[key as keyof InvoiceData] = value;
        }
      });

      newOriginalInvoiceData.clienteNome = params.get("clienteNome") || newOriginalInvoiceData.clienteNome;
      const rua = params.get("clienteRua") || "";
      const numero = params.get("clienteNumero") || "";
      const complemento = params.get("clienteComplemento") || "";
      let enderecoCompleto = rua;
      if (numero) enderecoCompleto += `, ${numero}`;
      if (complemento) enderecoCompleto += ` - ${complemento}`;
      newOriginalInvoiceData.clienteEndereco = enderecoCompleto || defaultInitialInvoiceData.clienteEndereco;
      newOriginalInvoiceData.clienteBairro = params.get("clienteBairro") || newOriginalInvoiceData.clienteBairro;
      const cidade = params.get("clienteCidade") || "";
      const uf = params.get("clienteUF") || "";
      newOriginalInvoiceData.clienteCidadeUF = (cidade && uf) ? `${cidade}/${uf}` : cidade || defaultInitialInvoiceData.clienteCidadeUF;
      newOriginalInvoiceData.clienteCnpjCpf = params.get("clienteCnpjCpf") || newOriginalInvoiceData.clienteCnpjCpf;
      newOriginalInvoiceData.codigoClienteInstalacao = formatUc(params.get("codigoClienteInstalacao") || newOriginalInvoiceData.codigoClienteInstalacao);
      newOriginalInvoiceData.ligacao = params.get("ligacao") || newOriginalInvoiceData.ligacao;
      newOriginalInvoiceData.classificacao = params.get("classificacao") || newOriginalInvoiceData.classificacao;

      const hoje = new Date();
      newOriginalInvoiceData.mesAnoReferencia = format(hoje, 'MMMM / yyyy', { locale: ptBR }).toUpperCase();
      newOriginalInvoiceData.dataVencimento = format(addDays(hoje, 10), 'dd/MM/yyyy');
      newOriginalInvoiceData.leituraAnteriorData = format(subDays(hoje, 30), 'dd/MM/yyyy');
      newOriginalInvoiceData.leituraAtualData = format(hoje, 'dd/MM/yyyy');
      newOriginalInvoiceData.numDiasFaturamento = getDaysInMonth(hoje).toString();
      newOriginalInvoiceData.proximaLeituraData = format(addDays(hoje, 30), 'dd/MM/yyyy');
      
      const consumoKwhInput = parseLocaleNumberString(params.get("item1Quantidade") || newOriginalInvoiceData.item1Quantidade);
      setCurrentKwh(consumoKwhInput > MAX_KWH_SLIDER ? MAX_KWH_SLIDER : consumoKwhInput < MIN_KWH_SLIDER ? MIN_KWH_SLIDER : consumoKwhInput);
      const cipValorInput = parseLocaleNumberString(params.get("item3Valor") || newOriginalInvoiceData.item3Valor);
      const valorProdPropriaInput = parseLocaleNumberString(params.get("valorProducaoPropria") || newOriginalInvoiceData.valorProducaoPropria);
      const isencaoIcmsEnergiaGeradaParam = params.get("isencaoIcmsEnergiaGerada") || "nao";
      const fidelityParam = params.get("comFidelidade") === 'true';
      setIsFidelityEnabled(fidelityParam);


      const valorConsumoPrincipalOriginal = consumoKwhInput * TARIFA_ENERGIA;
      newOriginalInvoiceData.valorTotalFatura = formatNumberToCurrencyString(valorConsumoPrincipalOriginal + cipValorInput - valorProdPropriaInput); 
      newOriginalInvoiceData.item1Quantidade = formatNumberToLocaleString(consumoKwhInput, 2);
      newOriginalInvoiceData.item1Valor = formatNumberToCurrencyString(valorConsumoPrincipalOriginal);

      const tarifaEnergiaSemIcmsCalc = TARIFA_ENERGIA * (1 - ALIQUOTA_ICMS_PERC);
      newOriginalInvoiceData.item1TarifaEnergiaInjetadaREF = formatNumberToLocaleString(tarifaEnergiaSemIcmsCalc, 6);
      newOriginalInvoiceData.item2Tarifa = isencaoIcmsEnergiaGeradaParam === "sim" ? formatNumberToLocaleString(TARIFA_ENERGIA, 6) : formatNumberToLocaleString(tarifaEnergiaSemIcmsCalc, 6);
      newOriginalInvoiceData.item2Valor = formatNumberToCurrencyString(valorProdPropriaInput); 
      newOriginalInvoiceData.item3Valor = formatNumberToCurrencyString(cipValorInput);
      
      const baseCalculoPisCofinsOriginal = consumoKwhInput * tarifaEnergiaSemIcmsCalc; 
      newOriginalInvoiceData.item1PisBase = formatNumberToCurrencyString(baseCalculoPisCofinsOriginal);
      newOriginalInvoiceData.item1PisValor = formatNumberToCurrencyString(baseCalculoPisCofinsOriginal * ALIQUOTA_PIS_PERC);
      newOriginalInvoiceData.item1CofinsBase = formatNumberToCurrencyString(baseCalculoPisCofinsOriginal);
      newOriginalInvoiceData.item1CofinsValor = formatNumberToCurrencyString(baseCalculoPisCofinsOriginal * ALIQUOTA_COFINS_PERC);
      newOriginalInvoiceData.item1IcmsBase = formatNumberToCurrencyString(valorConsumoPrincipalOriginal); 
      newOriginalInvoiceData.item1IcmsRS = formatNumberToCurrencyString(valorConsumoPrincipalOriginal * ALIQUOTA_ICMS_PERC);
      
      ENERGISA_INVOICE_FIELDS_CONFIG.forEach(field => {
        if (!(field.name in newOriginalInvoiceData) && field.initialValue) {
            newOriginalInvoiceData[field.name as keyof InvoiceData] = field.initialValue;
        }
        const fixedDisplayFields: (keyof InvoiceData)[] = ['item1Tarifa', 'item1PisAliq', 'item1CofinsAliq', 'item1IcmsPerc'];
        if (fixedDisplayFields.includes(field.name as keyof InvoiceData) && field.initialValue) {
             newOriginalInvoiceData[field.name as keyof InvoiceData] = field.initialValue;
        }
      });
      setOriginalInvoiceData(newOriginalInvoiceData);

      // --- Calculate Planus Discounted Invoice Data ---
      const newPlanusInvoiceData = JSON.parse(JSON.stringify(newOriginalInvoiceData)) as InvoiceData; 
      newPlanusInvoiceData.headerTitle = "ENTENDA SUA FATURA PLANUS"; 
      newPlanusInvoiceData.companyName = "ENERGIA ELÉTRICA FORNECIDA PLANUS COMERCIALIZADORA VAREJISTA LTDA";
      
      newPlanusInvoiceData.companyAddress = ""; 
      newPlanusInvoiceData.companyCityStateZip = "";
      newPlanusInvoiceData.companyCnpj = "XX.XXX.XXX/XXXX-XX"; // Placeholder for Planus
      newPlanusInvoiceData.companyInscEst = "";

      const valorEnergiaOriginalNum = parseLocaleNumberString(newOriginalInvoiceData.item1Valor);
      const currentSavingsResult = calculateSavings(valorEnergiaOriginalNum, fidelityParam, uf);
      setSavings(currentSavingsResult);
      
      const ligacaoParam = params.get("ligacao") || "NAO_INFORMADO";
      let kwhAdjustment = 0;
      if (ligacaoParam === 'MONOFASICO') {
          kwhAdjustment = 30;
      } else if (ligacaoParam === 'BIFASICO') {
          kwhAdjustment = 50;
      } else if (ligacaoParam === 'TRIFASICO') {
          kwhAdjustment = 100;
      }

      const custoDisponibilidade = kwhAdjustment * TARIFA_ENERGIA;
      const consumoKwhPlanus = consumoKwhInput - kwhAdjustment;
      
      const valorEnergiaPlanusBruto = consumoKwhPlanus * TARIFA_ENERGIA;
      const valorLinhaEnergiaPlanus = valorEnergiaPlanusBruto - currentSavingsResult.monthlySaving;
      
      const valorLinhaDistribuidoraPlanus = cipValorInput + custoDisponibilidade;
      
      newPlanusInvoiceData.item1Quantidade = formatNumberToLocaleString(consumoKwhPlanus, 2);
      newPlanusInvoiceData.item1Valor = formatNumberToCurrencyString(valorLinhaEnergiaPlanus);

      // Zero out taxes for Planus invoice display
      newPlanusInvoiceData.item1PisValor = formatNumberToCurrencyString(0);
      newPlanusInvoiceData.item1CofinsValor = formatNumberToCurrencyString(0);
      newPlanusInvoiceData.item1IcmsRS = formatNumberToCurrencyString(0);
      
      const totalPlanus = valorLinhaEnergiaPlanus + valorLinhaDistribuidoraPlanus - valorProdPropriaInput;
      newPlanusInvoiceData.valorTotalFatura = formatNumberToCurrencyString(totalPlanus);
      
      newPlanusInvoiceData.boweNomeRazaoSocial = newOriginalInvoiceData.clienteNome;
      newPlanusInvoiceData.boweCpfCnpj = newOriginalInvoiceData.clienteCnpjCpf;
      newPlanusInvoiceData.boweEnderecoCompleto = `${newOriginalInvoiceData.clienteEndereco || ''} ${newOriginalInvoiceData.clienteBairro||''} ${newOriginalInvoiceData.clienteCidadeUF||''} CEP: ${params.get("clienteCep") || ""}`.trim();
      newPlanusInvoiceData.boweNumeroInstalacao = newOriginalInvoiceData.codigoClienteInstalacao;
      newPlanusInvoiceData.boweMesReferencia = newOriginalInvoiceData.mesAnoReferencia.split('/')[0].trim() + "/" + newOriginalInvoiceData.mesAnoReferencia.split('/')[1].trim();
      newPlanusInvoiceData.boweTipoLigacao = `${newOriginalInvoiceData.classificacao.split('-')[0]} ${newOriginalInvoiceData.ligacao}`;
      newPlanusInvoiceData.boweDataVencimento = newOriginalInvoiceData.dataVencimento;
      newPlanusInvoiceData.boweNumeroBoleto = "S/N"; 
      newPlanusInvoiceData.boweTotalAPagar = newPlanusInvoiceData.valorTotalFatura; 
      newPlanusInvoiceData.boweDataEmissao = format(hoje, 'dd/MM/yyyy');

      newPlanusInvoiceData.boweAntesValor = newOriginalInvoiceData.valorTotalFatura;
      newPlanusInvoiceData.boweDepoisValor = newPlanusInvoiceData.valorTotalFatura; 
      newPlanusInvoiceData.boweEconomiaMensalValor = formatNumberToCurrencyString(currentSavingsResult.monthlySaving);
      newPlanusInvoiceData.boweEconomiaAcumuladaValor = formatNumberToCurrencyString(currentSavingsResult.annualSaving); 
      newPlanusInvoiceData.boweReducaoCO2Valor = "0 t"; 
      newPlanusInvoiceData.boweArvoresPlantadasValor = "0"; 

      newPlanusInvoiceData.boweCustosDistribuidoraValor = formatNumberToCurrencyString(valorLinhaDistribuidoraPlanus);
      newPlanusInvoiceData.boweEnergiaEletricaQtd = newPlanusInvoiceData.item1Quantidade + " kWh";
      newPlanusInvoiceData.boweEnergiaEletricaTarifa = formatNumberToLocaleString(consumoKwhPlanus > 0 ? valorLinhaEnergiaPlanus / consumoKwhPlanus : 0, 6);
      newPlanusInvoiceData.boweEnergiaEletricaValor = newPlanusInvoiceData.item1Valor;
      newPlanusInvoiceData.boweRestituicaoPisCofinsValor = formatNumberToCurrencyString(0);
      newPlanusInvoiceData.boweCreditosValor = valorProdPropriaInput > 0 ? `-${formatNumberToCurrencyString(valorProdPropriaInput)}` : "R$ 0,00";
      newPlanusInvoiceData.boweCustosTotalValor = newPlanusInvoiceData.valorTotalFatura;
      newPlanusInvoiceData.boweObservacao = currentSavingsResult.discountDescription;

      newPlanusInvoiceData.boweSemBowCustosDistribuidoraValor = newOriginalInvoiceData.item1Valor; 
      newPlanusInvoiceData.boweSemBowIluminacaoPublicaValor = newOriginalInvoiceData.item3Valor; 
      newPlanusInvoiceData.boweSemBowDemaisCustosValor = "R$ 0,00"; 
      newPlanusInvoiceData.boweSemBowTotalValor = newOriginalInvoiceData.valorTotalFatura;

      setPlanusInvoiceData(newPlanusInvoiceData);

    } else {
      setShouldShowInvoiceEditor(false);
      setOriginalInvoiceData(null);
      setPlanusInvoiceData(null);
      
      const stateCodeFromUrl = searchParams.get('state');
      const kwhFromUrl = searchParams.get('kwh');
      let initialStateCode = DEFAULT_UF;
      if (stateCodeFromUrl && statesData.find(s => s.code === stateCodeFromUrl && s.available)) {
        initialStateCode = stateCodeFromUrl;
        setShowMap(false); 
      } else {
        setShowMap(true); 
      }
      const initialKwh = kwhFromUrl ? parseInt(kwhFromUrl, 10) : DEFAULT_KWH;
      setCurrentKwh((!isNaN(initialKwh) && initialKwh >= MIN_KWH_SLIDER && initialKwh <= MAX_KWH_SLIDER) ? initialKwh : DEFAULT_KWH);

      if (stateCodeFromUrl) {
        const stateDetails = statesData.find(s => s.code === initialStateCode);
        if (stateDetails && stateDetails.available) {
            setSelectedState(stateDetails);
        } else {
            const defaultStateDetails = statesData.find(s => s.code === DEFAULT_UF && s.available);
            setSelectedState(defaultStateDetails || null);
            if (!defaultStateDetails && stateCodeFromUrl) { 
                toast({ title: "Estado Indisponível", description: `O estado ${stateCodeFromUrl} não está disponível para simulação.`, variant: "destructive" });
            }
            setShowMap(true);
        }
      } else {
        setShowMap(true);
        setSelectedState(null);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, isLoadingAuth, firebaseUser, toast]); 

  useEffect(() => {
    if (isLoadingAuth || !firebaseUser || shouldShowInvoiceEditor) return; 
    
    const currentParams = new URLSearchParams(searchParams.toString());
    const newParams = new URLSearchParams();

    currentParams.forEach((value, key) => {
        if (key !== 'state' && key !== 'kwh') {
            newParams.set(key, value);
        }
    });

    if (selectedState && !showMap) { 
      newParams.set('state', selectedState.code);
      newParams.set('kwh', currentKwh.toString());
    }
    
    if (newParams.toString() !== currentParams.toString().split('&').filter(p=>!p.startsWith('state=') && !p.startsWith('kwh=')).join('&')) {
        router.replace(`/dashboard?${newParams.toString()}`, { scroll: false });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedState, currentKwh, showMap, isLoadingAuth, firebaseUser, shouldShowInvoiceEditor]);


  useEffect(() => {
    if (isLoadingAuth || !firebaseUser) return;

    if (selectedState && selectedState.available && !showMap && !shouldShowInvoiceEditor) {
      const billAmountInReais = currentKwh * KWH_TO_R_FACTOR;
      setSavings(calculateSavings(billAmountInReais, isFidelityEnabled, selectedState.abbreviation));
    } else if (!shouldShowInvoiceEditor) { 
      setSavings(null); 
    }
  }, [currentKwh, selectedState, isLoadingAuth, firebaseUser, showMap, shouldShowInvoiceEditor, isFidelityEnabled]);

  const handleStateClick = (stateCode: string) => {
    const stateDetails = statesData.find(s => s.code === stateCode);
    if (stateDetails && stateDetails.available) {
      setSelectedState(stateDetails);
      setShowMap(false); 
    } else if (stateDetails) {
      toast({ title: "Estado Indisponível", description: `${stateDetails.name} ainda não está disponível para simulação.`, variant: "destructive" });
    }
  };

  const handleReturnToMap = () => {
    setShowMap(true);
    setSelectedState(null);
    setSavings(null);
    const params = new URLSearchParams(searchParams.toString());
    params.delete('state');
    params.delete('kwh');
    router.replace(`/dashboard?${params.toString()}`,{ scroll: false });
  };

  const handleStateHover = (stateCode: string | null) => {
    setHoveredStateCode(stateCode);
  };

  const handleKwhInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    let value = parseInt(event.target.value, 10);
    if (isNaN(value)) value = MIN_KWH_SLIDER; 
    if (value < MIN_KWH_SLIDER) value = MIN_KWH_SLIDER;
    if (value > MAX_KWH_SLIDER) value = MAX_KWH_SLIDER;
    setCurrentKwh(value);
  };

  const handleSliderChange = (value: number[]) => {
    setCurrentKwh(value[0]);
  };
  
  const currentBillWithoutDiscount = parseFloat((currentKwh * KWH_TO_R_FACTOR).toFixed(2));

  if (isLoadingAuth) { 
    return (
      <div className="flex flex-col justify-center items-center h-screen bg-background text-primary">
        <Loader2 className="animate-spin rounded-full h-12 w-12 text-primary mb-4" />
        <p className="text-lg font-medium">Carregando...</p>
      </div>
    );
  }

  if (!firebaseUser && !isLoadingAuth) {
    return (
         <div className="flex flex-col justify-center items-center h-screen bg-background text-primary">
            <Loader2 className="animate-spin rounded-full h-12 w-12 text-primary mb-4" />
            <p className="text-lg font-medium">Redirecionando para login...</p>
        </div>
    );
  }


  return (
    <div className="flex flex-col items-center justify-start min-h-screen p-0">
      {!shouldShowInvoiceEditor && (
        <>
          <header className="mb-8 text-center py-4">
            <h1 className="text-3xl md:text-4xl font-headline text-primary font-bold tracking-tight">
              Calculadora de Economia de Energia
            </h1>
            {!showMap && selectedState && (
              <Button variant="outline" onClick={handleReturnToMap} className="mt-4">
                <ChevronLeft className="mr-2 h-4 w-4" />
                Selecionar Outro Estado
              </Button>
            )}
            {showMap && (
                <p className="text-muted-foreground mt-2 text-sm md:text-base max-w-2xl mx-auto">
                    Clique em um estado no mapa para iniciar a simulação.
                </p>
            )}
            {!showMap && selectedState && (
                <p className="text-muted-foreground mt-2 text-sm md:text-base max-w-2xl mx-auto">
                    Ajuste o consumo para o estado de <strong className="text-primary">{selectedState.name}</strong> e veja o quanto você pode economizar.
                    Depois, clique em "Iniciar Nova Proposta" para personalizar sua fatura.
                </p>
            )}
          </header>

          {showMap && (
            <div className="w-full max-w-6xl mx-auto flex justify-center mb-12 px-4">
              <Card className="w-full md:w-2/3 lg:w-1/2 shadow-xl bg-card/70 backdrop-blur-lg border">
                <CardHeader>
                  <CardTitle className="text-xl font-bold text-primary flex items-center">
                    <MapPin className="mr-2 h-5 w-5" />
                    Selecione seu Estado no Mapa
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex justify-center">
                  <BrazilMapGraphic
                    selectedStateCode={selectedState?.code || null}
                    hoveredStateCode={hoveredStateCode}
                    onStateClick={handleStateClick}
                    onStateHover={handleStateHover}
                    className="max-w-md"
                  />
                </CardContent>
              </Card>
            </div>
          )}

          {!showMap && selectedState && (
            <div className="w-full max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12 px-4">
              <div className="flex flex-col items-center space-y-6">
                <StateInfoCard state={selectedState} />
                <Card className="w-full shadow-xl bg-card/70 backdrop-blur-lg border">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-xl font-bold text-primary flex items-center">
                          <FileText className="mr-2 h-5 w-5" /> 
                          Simulador de Consumo
                      </CardTitle>
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="fidelity-switch"
                          checked={isFidelityEnabled}
                          onCheckedChange={setIsFidelityEnabled}
                          aria-label="Com fidelidade?"
                        />
                        <Label htmlFor="fidelity-switch" className="text-sm font-medium text-muted-foreground">
                          Com fidelidade?
                        </Label>
                      </div>
                    </div>
                    <CardDescription className="mt-1">
                        Ajuste seu consumo mensal em kWh para ver a estimativa para {selectedState.name}.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div>
                        <Label htmlFor="kwhInput" className="text-sm font-medium">Consumo Mensal (kWh)</Label>
                        <Input
                        id="kwhInput"
                        type="number"
                        value={currentKwh}
                        onChange={handleKwhInputChange}
                        min={MIN_KWH_SLIDER}
                        max={MAX_KWH_SLIDER}
                        step={SLIDER_STEP}
                        className="mt-1 text-lg"
                        />
                    </div>
                    <Slider
                        value={[currentKwh]}
                        onValueChange={handleSliderChange}
                        min={MIN_KWH_SLIDER}
                        max={MAX_KWH_SLIDER}
                        step={SLIDER_STEP}
                        aria-label="Slider de Consumo kWh"
                    />
                    <div className="p-3 bg-secondary rounded-md text-center">
                        <p className="text-sm text-muted-foreground">Sua conta atual estimada (sem desconto):</p>
                        <p className="text-2xl font-semibold text-primary">
                        {currentBillWithoutDiscount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="flex flex-col space-y-6">
                <SavingsDisplay 
                  savings={savings} 
                  currentKwh={currentKwh} 
                  selectedStateCode={selectedState?.code}
                />
              </div>
            </div>
          )}
           {!showMap && selectedState && savings && !shouldShowInvoiceEditor && (
              <div className="w-full max-w-6xl mx-auto px-4 mb-12">
                <CompetitorComparisonDisplay 
                  currentBillAmount={currentBillWithoutDiscount} 
                  sentEnergyAnnualSaving={savings.annualSaving} 
                />
              </div>
            )}
        </>
      )}
      
      {shouldShowInvoiceEditor && originalInvoiceData && (
        <div className="w-full max-w-4xl mx-auto mt-8 px-2 md:px-4">
          <Card className="shadow-2xl overflow-hidden bg-card/70 backdrop-blur-lg border mb-8">
            <CardHeader className="bg-primary/10 p-4 md:p-6">
              <CardTitle className="text-xl md:text-2xl font-bold text-primary text-center">
                Editor da Fatura (Simulação Original Energisa)
              </CardTitle>
              <CardDescription className="text-center text-muted-foreground mt-1 text-xs md:text-sm">
                Os dados do formulário de proposta são carregados aqui. Você pode editar os campos diretamente.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 md:p-2 bg-background">
              <InvoiceEditor invoiceData={originalInvoiceData} onInvoiceDataChange={setOriginalInvoiceData} isEditable={true} />
            </CardContent>
          </Card>

          {planusInvoiceData && (
             <>
                <CardHeader className="bg-primary/10 p-4 md:p-6 mt-10 rounded-t-lg">
                  <CardTitle className="text-xl md:text-2xl font-bold text-primary text-center">
                      Simulacao de desconto
                  </CardTitle>
                  <CardDescription className="text-center text-muted-foreground mt-1 text-xs md:text-sm">
                      Veja como ficaria sua fatura com os descontos aplicados, em um layout inspirado na fatura "bowe".
                  </CardDescription>
                </CardHeader>
                <PlanusInvoiceDisplay invoiceData={planusInvoiceData} />
            </>
          )}
           {savings && originalInvoiceData && (
              <div className="w-full max-w-6xl mx-auto px-4 my-8">
                <CompetitorComparisonDisplay 
                  currentBillAmount={parseLocaleNumberString(originalInvoiceData?.item1Valor) || 0} 
                  sentEnergyAnnualSaving={savings.annualSaving} 
                />
              </div>
            )}
        </div>
      )}
    </div>
  );
}


export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col justify-center items-center h-screen bg-background text-primary">
        <Loader2 className="animate-spin rounded-full h-12 w-12 text-primary mb-4" />
        <p className="text-lg font-medium">Carregando calculadora e editor...</p>
      </div>
    }>
      <CalculatorPageContent />
    </Suspense>
  );
}
