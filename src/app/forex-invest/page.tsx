
"use client";

import { Suspense } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BarChart, LineChart, PlusCircle, Settings, Download, Loader2 } from 'lucide-react';

function ForexInvestDashboard() {

  // Placeholder data - this will be replaced with real data from Firestore
  const metrics = {
    totalProfitLoss: 1250.75,
    avgDailyEvolution: 0.85,
    bestDailyGain: 350.20,
    worstDailyLoss: -150.50,
  };
  
  const formatCurrency = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'USD' });
  const formatPercentage = (value: number) => `${value.toFixed(2)}%`;

  return (
    <div className="p-4 md:p-6 space-y-6">
       <header className="flex flex-col md:flex-row justify-between items-start md:items-center">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-foreground">
            Forex Invest Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">Sua visão geral de performance e projeções.</p>
        </div>
        <div className="flex items-center gap-2 mt-4 md:mt-0">
          <Button variant="outline"><Download className="mr-2 h-4 w-4" /> Exportar Dados</Button>
          <Button><PlusCircle className="mr-2 h-4 w-4" /> Nova Operação</Button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
            <CardHeader><CardTitle>Balanço Total</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold text-green-500">{formatCurrency(metrics.totalProfitLoss)}</p></CardContent>
        </Card>
         <Card>
            <CardHeader><CardTitle>Evolução Média Diária</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold">{formatPercentage(metrics.avgDailyEvolution)}</p></CardContent>
        </Card>
         <Card>
            <CardHeader><CardTitle>Maior Lucro Diário</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold text-green-500">{formatCurrency(metrics.bestDailyGain)}</p></CardContent>
        </Card>
         <Card>
            <CardHeader><CardTitle>Pior Perda Diária</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold text-red-500">{formatCurrency(metrics.worstDailyLoss)}</p></CardContent>
        </Card>
      </div>

       <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
                <CardHeader>
                    <CardTitle>Evolução do Capital</CardTitle>
                    <CardDescription>Capital Real vs. Projeções de Crescimento</CardDescription>
                </CardHeader>
                <CardContent className="h-[300px] flex items-center justify-center">
                    <LineChart className="text-muted-foreground h-20 w-20" />
                    <p className="ml-4 text-muted-foreground">Gráfico de Linhas (em breve)</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle>TradingView: BTC/USD</CardTitle>
                    <CardDescription>Análise de mercado em tempo real.</CardDescription>
                </CardHeader>
                <CardContent className="h-[300px] flex items-center justify-center">
                   <p className="text-muted-foreground">Widget do TradingView (em breve)</p>
                </CardContent>
            </Card>
       </div>
       
        <Card>
            <CardHeader>
                <CardTitle>Tabela de Projeção e Gerenciamento</CardTitle>
                <CardDescription>Acompanhe seu progresso diário e metas.</CardDescription>
            </CardHeader>
            <CardContent className="h-[300px] flex items-center justify-center">
                <BarChart className="text-muted-foreground h-20 w-20" />
                <p className="ml-4 text-muted-foreground">Tabela de Projeções (em breve)</p>
            </CardContent>
        </Card>

    </div>
  );
}

export default function ForexInvestPage() {
  return (
    <Suspense fallback={
        <div className="flex flex-col justify-center items-center h-screen bg-transparent text-primary">
            <Loader2 className="animate-spin rounded-full h-12 w-12 text-primary mb-4" />
            <p className="text-lg font-medium">Carregando Dashboard...</p>
        </div>
    }>
        <ForexInvestDashboard />
    </Suspense>
  )
}
