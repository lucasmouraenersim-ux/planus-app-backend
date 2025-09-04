// /src/components/SavingsDisplay.tsx
"use client";

import type { SavingsResult } from "@/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, AlertTriangle, Droplets } from "lucide-react";
import Link from "next/link";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer } from 'recharts';
import { ChartContainer, type ChartConfig } from "@/components/ui/chart";

interface SavingsDisplayProps {
  savings: SavingsResult | null;
  currentKwh: number;
  selectedStateCode?: string | null;
  proposalLink: string;
}

const formatCurrency = (value: number) => {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const illustrativeChartData = [
  { month: "M1", value: 120 },
  { month: "M2", value: 150 },
  { month: "M3", value: 130 },
  { month: "M4", value: 190 },
  { month: "M5", value: 220 },
];

const chartConfig = {
  value: {
    label: "Economia",
    color: "hsl(var(--primary))",
  },
} satisfies ChartConfig;

const renderDiscountDescription = (description: string) => {
  const parts = description.split(/(\d+%)/g); 
  return parts.map((part, index) => {
    if (/\d+%/.test(part)) {
      return <span key={index} className="text-primary font-medium">{part}</span>;
    }
    return part;
  });
};

export function SavingsDisplay({ savings, proposalLink }: SavingsDisplayProps) {

  if (!savings || savings.monthlySaving === 0) {
    return (
      <Card className="w-full shadow-lg animate-in fade-in-50 bg-card/70 backdrop-blur-lg border text-card-foreground rounded-lg">
        <CardHeader>
          <CardTitle className="text-xl font-semibold text-foreground flex items-center">
            <AlertTriangle className="mr-2 h-5 w-5 text-amber-500" />
            Simule sua Economia
          </CardTitle>
          <CardDescription className="text-sm text-muted-foreground mt-1">
            {savings?.discountDescription || "Ajuste o consumo ou selecione um estado disponível para ver sua economia."}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4 flex flex-col items-center">
           <Link href={proposalLink}>
            <Button variant="default" size="lg" className="w-full bg-accent hover:bg-accent/90 text-accent-foreground">
              <FileText className="mr-2 h-5 w-5" />
              INICIAR NOVA PROPOSTA
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }
  
  const FlagIndicator = ({ color, label, rate }: { color: string, label: string, rate: number }) => (
    <div className="flex items-center space-x-2">
      <div className={`w-3 h-3 rounded-full ${color}`} />
      <span className="text-xs text-muted-foreground">{label}:</span>
      <span className="text-xs font-bold text-foreground">{rate.toFixed(0)}%</span>
    </div>
  );

  return (
    <Card className="w-full shadow-lg animate-in fade-in-50 bg-card/70 backdrop-blur-lg border text-card-foreground rounded-lg">
      <CardHeader className="pb-3">
        <CardTitle className="text-xl font-semibold text-foreground">
          Sua Economia Estimada
        </CardTitle>
        <CardDescription className="text-sm text-muted-foreground mt-1">
          {renderDiscountDescription(savings.discountDescription)}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-2 space-y-6">
        <div className="grid md:grid-cols-2 gap-4 items-end">
          <div className="space-y-3">
            <div>
              <p className="text-xs text-muted-foreground">Conta Original Estimada</p>
              <p className="text-lg font-medium text-foreground">{formatCurrency(savings.originalMonthlyBill)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Nova Conta com Planus (Estimada)</p>
              <p className="text-3xl font-bold text-primary">{formatCurrency(savings.newMonthlyBillWithPlanus)}</p>
            </div>
          </div>
          <div className="flex justify-center items-center mt-4 md:mt-0 h-[120px] w-full max-w-[250px] mx-auto">
            <ChartContainer config={chartConfig} className="h-full w-full">
              <BarChart 
                accessibilityLayer 
                data={illustrativeChartData} 
                margin={{ top: 10, right: 0, left: 0, bottom: 0 }}
              >
                <XAxis dataKey="month" hide stroke="hsl(var(--foreground))" fontSize={10} />
                <YAxis hide stroke="hsl(var(--foreground))" fontSize={10} />
                <Bar dataKey="value" fill="var(--color-value)" radius={[4, 4, 0, 0]} barSize={20} />
              </BarChart>
            </ChartContainer>
          </div>
        </div>

        {savings.savingsByFlag && (
          <div className="pt-4 border-t border-border">
            <h4 className="text-sm font-semibold text-center mb-3">Desconto Efetivo por Bandeira Tarifária</h4>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-2 gap-y-2 justify-items-center">
              <FlagIndicator color="bg-green-500" label="Verde" rate={savings.savingsByFlag.green.rate * 100} />
              <FlagIndicator color="bg-yellow-400" label="Amarela" rate={savings.savingsByFlag.yellow.rate * 100} />
              <FlagIndicator color="bg-red-500" label="Vermelha 1" rate={savings.savingsByFlag.red1.rate * 100} />
              <FlagIndicator color="bg-red-700" label="Vermelha 2" rate={savings.savingsByFlag.red2.rate * 100} />
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
          <div>
            <p className="text-xs text-muted-foreground">Economia Anual Estimada</p>
            <p className="text-2xl font-bold text-foreground">{formatCurrency(savings.annualSaving)}</p>
          </div>
          <div className="text-left">
            <p className="text-xs text-muted-foreground">Desconto Anual Efetivo</p>
            <p className="text-2xl font-bold text-primary">{savings.effectiveAnnualDiscountPercentage}%</p>
          </div>
        </div>
        
        <div className="pt-4">
          <Link href={proposalLink}>
            <Button variant="default" size="lg" className="w-full bg-accent hover:bg-accent/90 text-accent-foreground">
              <FileText className="mr-2 h-5 w-5" />
              INICIAR NOVA PROPOSTA
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
