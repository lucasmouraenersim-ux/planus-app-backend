
"use client";

import * as React from "react"
import { useMemo, useState } from 'react';
import { addDays, differenceInDays, format, endOfYear, parseISO, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { LineChart as LineChartIcon, Bitcoin, AreaChart, BarChart, RefreshCw, Plus } from 'lucide-react';
import { LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { TradingViewWidget } from "./trading-view-widget";
import type { ForexBancaConfig, ForexOperation } from '@/types/forex';
import { useForex } from '@/contexts/ForexProvider';

export interface ProjectionConfig extends Omit<ForexBancaConfig, 'startDate' | 'id' | 'userId'>{
  startDate: Date;
}

interface ProjectionDay {
  day: number;
  date: string;
  capitalAtualUSD: number;
  projections: {
    [key: string]: { // key is "1", "2", "3", "4", "5"
      capitalUSD: number;
      capitalBRL: number;
      drawdownUSD: number;
      loteRiscoBaixo: number;
      loteRiscoAlto: number;
    };
  };
}

const formatCurrency = (value: number | undefined | null, currency: 'USD' | 'BRL' = 'USD') => {
    if (value === null || value === undefined || isNaN(value)) {
        return currency === 'USD' ? '$0.00' : 'R$ 0,00';
    }
    return value.toLocaleString('pt-BR', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
};

export const ProjectionView = ({ config, onNewProjection }: { config: ProjectionConfig, onNewProjection: () => void }) => {
    const { operations } = useForex();

    const projectionData = useMemo(() => {
        const dailyResults = new Map<string, number>();
        operations.forEach(op => {
            if (op.closedAt && op.status === 'Fechada' && op.resultUSD !== undefined) {
                const closeDateStr = format(startOfDay(parseISO(op.closedAt as string)), 'yyyy-MM-dd');
                const currentDailyResult = dailyResults.get(closeDateStr) || 0;
                dailyResults.set(closeDateStr, currentDailyResult + op.resultUSD);
            }
        });

        const data: ProjectionDay[] = [];
        const endDate = endOfYear(config.startDate);
        const totalDays = differenceInDays(endDate, config.startDate) + 1;
        let currentDate = config.startDate;
        let runningCapital = config.initialCapitalUSD;

        for (let i = 1; i <= totalDays; i++) {
            const dateKey = format(startOfDay(currentDate), 'yyyy-MM-dd');
            if (dailyResults.has(dateKey)) {
                runningCapital += dailyResults.get(dateKey)!;
            }

            const dayEntry: ProjectionDay = {
                day: i,
                date: format(currentDate, 'dd/MM/yyyy', { locale: ptBR }),
                capitalAtualUSD: runningCapital,
                projections: {},
            };
            
            [1, 2, 3, 4, 5].forEach(goalPercent => {
                const key = String(goalPercent);
                const projectedCapital = runningCapital * (1 + goalPercent / 100);
                dayEntry.projections[key] = {
                    capitalUSD: projectedCapital,
                    capitalBRL: projectedCapital * config.usdToBrlRate,
                    drawdownUSD: projectedCapital * 0.15,
                    loteRiscoBaixo: (projectedCapital * 0.10) / 1000,
                    loteRiscoAlto: (projectedCapital * 0.20) / 1000,
                };
            });
            
            data.push(dayEntry);
            currentDate = addDays(currentDate, 1);
        }

        return data;
    }, [config, operations]);

    const chartData = useMemo(() => {
      return projectionData.map(day => ({
        name: `Dia ${day.day}`,
        'Capital Atual': day.capitalAtualUSD,
        'Meta 1%': day.capitalAtualUSD * 1.01,
      }));
    }, [projectionData]);

    const lineColors = {
      'Capital Atual': 'hsl(var(--chart-1))',
      'Meta 1%': 'hsl(var(--chart-2))',
    };

    const CustomTooltip = ({ active, payload, label }: any) => {
      if (active && payload && payload.length) {
        return (
          <div className="p-2 bg-background/80 backdrop-blur-sm border rounded-lg shadow-lg text-sm">
            <p className="font-bold text-foreground mb-2">{label}</p>
            {payload.map((pld: any) => (
              <div key={pld.dataKey} style={{ color: pld.color }}>
                {pld.dataKey}: {formatCurrency(pld.value, 'USD')}
              </div>
            ))}
          </div>
        );
      }
      return null;
    };
    
    return (
        <div className="p-4 md:p-6 w-full">
            <header className="mb-6 flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-foreground">{config.name}</h1>
                    <p className="text-muted-foreground">
                        Iniciado em {format(config.startDate, 'dd/MM/yyyy')} com {formatCurrency(config.initialCapitalUSD, 'USD')}
                    </p>
                </div>
                <Button variant="outline" onClick={onNewProjection}>
                    <RefreshCw className="w-4 h-4 mr-2"/>
                    Nova Projeção
                </Button>
            </header>

            <Tabs defaultValue="projection">
                <TabsList className="mb-4">
                    <TabsTrigger value="projection"><AreaChart className="w-4 h-4 mr-2" />Projeção</TabsTrigger>
                    <TabsTrigger value="dashboard"><BarChart className="w-4 h-4 mr-2" />Dashboard</TabsTrigger>
                    <TabsTrigger value="bitcoin"><Bitcoin className="w-4 h-4 mr-2" />Bitcoin Gráfico</TabsTrigger>
                </TabsList>
                <TabsContent value="projection" className="relative">
                    <Card className="bg-card/70">
                        <CardHeader>
                            <CardTitle>Tabela de Projeção e Gerenciamento</CardTitle>
                            <CardDescription>Evolução de capital e sugestões de gerenciamento de risco para diferentes metas de lucro diário.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ScrollArea className="w-full whitespace-nowrap">
                                <Table className="min-w-max">
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="sticky left-0 bg-card z-10 w-[50px]">Dia</TableHead>
                                            <TableHead className="sticky left-[50px] bg-card z-10 w-[100px]">Data</TableHead>
                                            <TableHead className="sticky left-[150px] bg-card z-10 w-[110px] text-blue-400">Capital Atual (USD)</TableHead>
                                            {/* Projections */}
                                            {[1, 2, 3, 4, 5].map(goal => (
                                                <React.Fragment key={goal}>
                                                    <TableHead className="text-center text-green-400">Capital {goal}% (USD)</TableHead>
                                                    <TableHead className="text-center text-green-400">Capital {goal}% (BRL)</TableHead>
                                                    <TableHead className="text-center text-red-400">Drawdown Aceitável (USD)</TableHead>
                                                    <TableHead className="text-center">Lotes (Risco Baixo)</TableHead>
                                                    <TableHead className="text-center">Lotes (Risco Alto)</TableHead>
                                                    <TableHead className="text-center">Operações/Dia</TableHead>
                                                </React.Fragment>
                                            ))}
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {projectionData.map((row) => (
                                            <TableRow key={row.day}>
                                                <TableCell className="sticky left-0 bg-card z-10 font-medium">{row.day}</TableCell>
                                                <TableCell className="sticky left-[50px] bg-card z-10">{row.date}</TableCell>
                                                <TableCell className="sticky left-[150px] bg-card z-10 font-semibold text-blue-400">{formatCurrency(row.capitalAtualUSD, 'USD')}</TableCell>
                                                
                                                {[1, 2, 3, 4, 5].map(goal => {
                                                    const key = String(goal);
                                                    const proj = row.projections[key];
                                                    return (
                                                        <React.Fragment key={goal}>
                                                            <TableCell className="text-center">{formatCurrency(proj.capitalUSD, 'USD')}</TableCell>
                                                            <TableCell className="text-center">{formatCurrency(proj.capitalBRL, 'BRL')}</TableCell>
                                                            <TableCell className="text-center text-red-400">{formatCurrency(proj.drawdownUSD, 'USD')}</TableCell>
                                                            <TableCell className="text-center text-green-400">{proj.loteRiscoBaixo.toFixed(2)}</TableCell>
                                                            <TableCell className="text-center text-orange-400">{proj.loteRiscoAlto.toFixed(2)}</TableCell>
                                                            <TableCell className="text-center">2</TableCell>
                                                        </React.Fragment>
                                                    )
                                                })}
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                                <ScrollBar orientation="horizontal" />
                            </ScrollArea>
                        </CardContent>
                    </Card>
                    <Button
                        variant="default"
                        size="icon"
                        className="absolute bottom-4 right-4 h-14 w-14 rounded-full shadow-lg z-20"
                        aria-label="Adicionar Operação"
                    >
                        <Plus className="h-6 w-6" />
                    </Button>
                </TabsContent>
                <TabsContent value="dashboard">
                   <div className="space-y-4">
                     <div className="flex items-center gap-4">
                        <Select defaultValue="all_time">
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Selecione o período" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all_time">Todo o Período</SelectItem>
                                <SelectItem value="last_30">Últimos 30 dias</SelectItem>
                                <SelectItem value="last_7">Últimos 7 dias</SelectItem>
                                <SelectItem value="custom">Personalizado</SelectItem>
                            </SelectContent>
                        </Select>
                        <p className="text-sm text-muted-foreground">
                            Feche pelo menos 2 operações no período selecionado para ver as métricas.
                        </p>
                    </div>
                    <Card className="bg-card/70">
                        <CardHeader>
                            <CardTitle>Gráfico de Evolução de Capital</CardTitle>
                            <CardDescription>Comparativo entre o capital atual e as projeções de lucro.</CardDescription>
                        </CardHeader>
                        <CardContent className="h-[400px] w-full">
                           <ResponsiveContainer width="100%" height="100%">
                             <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                               <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                               <XAxis 
                                 dataKey="name" 
                                 stroke="hsl(var(--muted-foreground))"
                                 fontSize={12}
                                 tickLine={false}
                                 axisLine={false}
                                 interval={Math.floor(chartData.length / 20)}
                               />
                               <YAxis 
                                 stroke="hsl(var(--muted-foreground))" 
                                 fontSize={12}
                                 tickLine={false}
                                 axisLine={false}
                                 tickFormatter={(value) => `$${value/1000}k`}
                                />
                               <Tooltip content={<CustomTooltip />} />
                               <Legend />
                               <Line type="monotone" dataKey="Capital Atual" stroke={lineColors['Capital Atual']} dot={false} strokeWidth={2} />
                               <Line type="monotone" dataKey="Meta 1%" stroke={lineColors['Meta 1%']} dot={false} strokeWidth={2} />
                             </LineChart>
                           </ResponsiveContainer>
                        </CardContent>
                    </Card>
                   </div>
                </TabsContent>
                <TabsContent value="bitcoin">
                     <Card>
                        <CardHeader>
                            <CardTitle>Gráfico de Mercado: BTC/USD</CardTitle>
                            <CardDescription>Análise em tempo real do par Bitcoin/Dólar Americano via TradingView.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <TradingViewWidget symbol="BITSTAMP:BTCUSD" />
                        </CardContent>
                     </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
};
