
"use client";

import * as React from "react"
import { useMemo, useState } from 'react';
import { addDays, differenceInDays, format, endOfYear } from 'date-fns';
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

export interface ProjectionConfig {
  name: string;
  initialCapital: number;
  startDate: Date;
  usdToBrlRate: number;
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

const formatCurrency = (value: number, currency: 'USD' | 'BRL' = 'USD') => {
    return value.toLocaleString('pt-BR', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
};

export const ProjectionView = ({ config, onNewProjection }: { config: ProjectionConfig, onNewProjection: () => void }) => {
    const projectionData = useMemo(() => {
        const data: ProjectionDay[] = [];
        const endDate = endOfYear(config.startDate);
        const totalDays = differenceInDays(endDate, config.startDate) + 1;
        let currentDate = config.startDate;

        let lastProjections: ProjectionDay['projections'] = {};
        const goals = [1, 2, 3, 4, 5];

        goals.forEach(goalPercent => {
            const key = String(goalPercent);
            lastProjections[key] = {
                capitalUSD: config.initialCapital,
                capitalBRL: config.initialCapital * config.usdToBrlRate,
                drawdownUSD: config.initialCapital * 0.15,
                loteRiscoBaixo: (config.initialCapital * 0.10) / 1000,
                loteRiscoAlto: (config.initialCapital * 0.20) / 1000,
            };
        });

        for (let i = 1; i <= totalDays; i++) {
            const dayEntry: ProjectionDay = {
                day: i,
                date: format(currentDate, 'dd/MM/yyyy', { locale: ptBR }),
                capitalAtualUSD: config.initialCapital, // This will be dynamic later
                projections: {},
            };

            goals.forEach(goalPercent => {
                const key = String(goalPercent);
                const prevCapital = lastProjections[key].capitalUSD;
                const newCapital = prevCapital * (1 + goalPercent / 100);
                
                dayEntry.projections[key] = {
                    capitalUSD: newCapital,
                    capitalBRL: newCapital * config.usdToBrlRate,
                    drawdownUSD: newCapital * 0.15,
                    loteRiscoBaixo: (newCapital * 0.10) / 1000,
                    loteRiscoAlto: (newCapital * 0.20) / 1000,
                };
            });
            
            lastProjections = dayEntry.projections;
            data.push(dayEntry);
            currentDate = addDays(currentDate, 1);
        }

        return data;
    }, [config]);

    const chartData = useMemo(() => {
      return projectionData.map(day => ({
        name: `Dia ${day.day}`,
        '1%': day.projections['1'].capitalUSD,
        '2%': day.projections['2'].capitalUSD,
        '3%': day.projections['3'].capitalUSD,
        '4%': day.projections['4'].capitalUSD,
        '5%': day.projections['5'].capitalUSD,
      }));
    }, [projectionData]);

    const lineColors = {
      '1%': 'hsl(var(--chart-1))',
      '2%': 'hsl(var(--chart-2))',
      '3%': 'hsl(var(--chart-3))',
      '4%': 'hsl(var(--chart-4))',
      '5%': 'hsl(var(--chart-5))',
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
                        Iniciado em {format(config.startDate, 'dd/MM/yyyy')} com {formatCurrency(config.initialCapital, 'USD')}
                    </p>
                </div>
                <Button variant="outline" onClick={onNewProjection}>
                    <RefreshCw className="w-4 h-4 mr-2"/>
                    Nova Projeção
                </Button>
            </header>

            <Tabs defaultValue="dashboard">
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
                        className="absolute bottom-4 right-4 h-14 w-14 rounded-full shadow-lg"
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
                               <Line type="monotone" dataKey="1%" stroke={lineColors['1%']} dot={false} strokeWidth={2} />
                               <Line type="monotone" dataKey="2%" stroke={lineColors['2%']} dot={false} strokeWidth={2} />
                               <Line type="monotone" dataKey="3%" stroke={lineColors['3%']} dot={false} strokeWidth={2} />
                               <Line type="monotone" dataKey="4%" stroke={lineColors['4%']} dot={false} strokeWidth={2} />
                               <Line type="monotone" dataKey="5%" stroke={lineColors['5%']} dot={false} strokeWidth={2} />
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
