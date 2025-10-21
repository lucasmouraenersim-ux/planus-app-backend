
"use client";

import { useState, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { BrazilMapGraphic } from '@/components/BrazilMapGraphic';
import { StateInfoCard } from '@/components/StateInfoCard';
import { SavingsDisplay } from '@/components/SavingsDisplay';
import CompetitorComparisonDisplay from '@/components/CompetitorComparisonDisplay';
import { DiscountConfigurator, type DiscountConfig } from '@/components/DiscountConfigurator';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { calculateSavings } from '@/lib/discount-calculator';
import { statesData } from '@/data/state-data';
import type { StateInfo } from '@/types';
import { HandHelping, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

function DashboardPageContent() {
  const searchParams = useSearchParams();
  const initialKwh = parseInt(searchParams.get('item1Quantidade') || '1500', 10);
  const initialUF = searchParams.get('clienteUF');

  const [selectedStateCode, setSelectedStateCode] = useState<string | null>(initialUF || null);
  const [hoveredStateCode, setHoveredStateCode] = useState<string | null>(null);
  const [currentKwh, setCurrentKwh] = useState<number>(initialKwh);
  const [isFidelityEnabled, setIsFidelityEnabled] = useState(false);
  const [showCompetitorAnalysis, setShowCompetitorAnalysis] = useState(false);

  const [discountConfig, setDiscountConfig] = useState<DiscountConfig>({
    type: 'promotional',
    promotional: { rate: 25, durationMonths: 3, subsequentRate: 15 },
    fixed: { rate: 20 },
  });

  const selectedState = useMemo(() => {
    if (!selectedStateCode) return null;
    return statesData.find(s => s.abbreviation === selectedStateCode) || null;
  }, [selectedStateCode]);

  const handleStateClick = (stateCode: string) => {
    setSelectedStateCode(stateCode);
  };
  
  const handleKwhChange = (value: number[]) => {
      setCurrentKwh(value[0]);
  };
  
  const handleKwhInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = parseInt(event.target.value.replace(/\D/g, ''), 10);
      setCurrentKwh(isNaN(value) ? 0 : value);
  };

  const savingsResult = useMemo(() => {
    const kwhToReaisFactor = 1.0907; // Fator de conversão kWh para Reais
    const billAmount = currentKwh * kwhToReaisFactor;

    if (!selectedState?.available) {
      return {
        effectiveAnnualDiscountPercentage: 0,
        monthlySaving: 0,
        annualSaving: 0,
        discountDescription: `O estado de ${selectedState?.name || '...'} ainda não está disponível.`,
        originalMonthlyBill: 0,
        newMonthlyBillWithPlanus: 0,
      };
    }
    
    return calculateSavings(billAmount, discountConfig, selectedStateCode);

  }, [currentKwh, selectedState, discountConfig, selectedStateCode]);
  
  const proposalLink = useMemo(() => {
    const params = new URLSearchParams();
    params.set('item1Quantidade', String(currentKwh));
    if (selectedStateCode) {
      params.set('clienteUF', selectedStateCode);
    }
    return `/proposal-generator?${params.toString()}`;
  }, [currentKwh, selectedStateCode]);

  return (
    <div className="relative flex flex-col min-h-[calc(100vh-56px)] items-center justify-start p-4 md:p-8 space-y-8">
      <div className="w-full grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        {/* Left Column */}
        <div className="flex flex-col gap-8">
          <Card className="shadow-xl bg-card/70 backdrop-blur-lg border">
            <CardHeader>
              <CardTitle className="text-2xl font-bold text-primary">Calculadora de Economia</CardTitle>
              <CardDescription>Selecione um estado e ajuste o consumo para simular.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <StateInfoCard state={selectedState || (hoveredStateCode ? statesData.find(s => s.code === hoveredStateCode) : null)} />
              <div className="space-y-4">
                <Label htmlFor="kwh-slider">Consumo Mensal (kWh)</Label>
                <Slider id="kwh-slider" min={100} max={50000} step={100} value={[currentKwh]} onValueChange={handleKwhChange} />
                <Input type="text" value={currentKwh.toLocaleString('pt-BR')} onChange={handleKwhInputChange} className="text-center font-bold text-lg" />
              </div>
            </CardContent>
          </Card>

           <DiscountConfigurator config={discountConfig} onConfigChange={setDiscountConfig} />
          
          <Card className="shadow-lg bg-card/70 backdrop-blur-lg border">
            <CardHeader>
              <CardTitle className="text-xl font-semibold text-primary flex items-center">
                <TrendingUp className="mr-2 h-5 w-5" />
                Análise de Mercado
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <Label htmlFor="competitor-switch" className="flex flex-col space-y-1">
                  <span>Comparar com Concorrentes</span>
                  <span className="font-normal leading-snug text-muted-foreground text-xs">
                    Ative para ver uma análise comparativa da economia.
                  </span>
                </Label>
                <Switch id="competitor-switch" checked={showCompetitorAnalysis} onCheckedChange={setShowCompetitorAnalysis} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column */}
        <div className="flex flex-col gap-8">
          <div className="lg:sticky lg:top-24">
             <BrazilMapGraphic 
                selectedStateCode={selectedStateCode}
                hoveredStateCode={hoveredStateCode}
                onStateClick={handleStateClick}
                onStateHover={setHoveredStateCode}
              />
          </div>
          <SavingsDisplay savings={savingsResult} currentKwh={currentKwh} selectedStateCode={selectedStateCode} proposalLink={proposalLink} />
        </div>
      </div>

       {showCompetitorAnalysis && (
        <div className="w-full mt-8">
          <CompetitorComparisonDisplay 
            currentBillAmount={currentKwh * 1.0907}
            sentEnergyAnnualSaving={savingsResult.annualSaving}
          />
        </div>
      )}

       <Link href="/proposal-generator" passHref className="fixed bottom-6 right-6 z-50">
        <Button size="lg" className="rounded-full shadow-lg h-16 w-auto px-6 bg-accent hover:bg-accent/90 text-accent-foreground">
          <HandHelping className="mr-3 h-6 w-6" />
          <div className="flex flex-col items-start">
            <span className="text-base font-bold">Nova Proposta</span>
            <span className="text-xs font-normal -mt-1">Começar do zero</span>
          </div>
        </Button>
      </Link>
    </div>
  );
}

export default function DashboardPage() {
    return (
        <Suspense fallback={<div>Carregando...</div>}>
            <DashboardPageContent />
        </Suspense>
    )
}
