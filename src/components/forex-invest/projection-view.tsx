
"use client";

import * as React from "react"
import { useMemo, useState } from 'react';
import { addDays, differenceInDays, format, endOfYear, parseISO, startOfDay, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, differenceInMinutes } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { LineChart as LineChartIcon, Bitcoin, BarChart, RefreshCw, Plus, TrendingUp, Target, Clock, CheckCircle, Percent, ArrowDownUp, TrendingDown, ChevronsDown, BrainCircuit, CalendarIcon, Activity, AreaChart as AreaChartIcon } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { TradingViewWidget } from "./trading-view-widget";
import type { ForexBancaConfig, ForexOperation } from '@/types/forex';
import { useForex } from '@/contexts/ForexProvider';
import { Popover, PopoverTrigger, PopoverContent } from "../ui/popover";
import { cn } from "@/lib/utils";
import { Calendar } from "../ui/calendar";
import type { DateRange } from "react-day-picker";

export interface ProjectionConfig extends Omit<ForexBancaConfig, 'startDate' | 'id' | 'userId'>{
  startDate: Date;
}

interface ProjectionDay {
  day: number;
  date: string;
  capitalAtualUSD: number;
  drawdownAtualUSD: number;
  loteRiscoBaixoAtual: number;
  loteRiscoAltoAtual: number;
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

const formatDuration = (totalMinutes: number): string => {
    if (isNaN(totalMinutes) || totalMinutes < 0) return "N/A";
    const hours = Math.floor(totalMinutes / 60);
    const minutes = Math.round(totalMinutes % 60);
    return `${hours}h ${minutes}m`;
};


export const ProjectionView = ({ config, onNewProjection }: { config: ProjectionConfig, onNewProjection: () => void }) => {
    const { operations } = useForex();
    const [timeRange, setTimeRange] = useState('all_time');
    const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>();

    const filteredOperations = useMemo(() => {
      if (timeRange === 'all_time') return operations;

      const now = new Date();
      let startDate: Date;

      if (timeRange === 'last_30_days') {
          startDate = subDays(now, 30);
      } else if (timeRange === 'last_7_days') {
          startDate = subDays(now, 7);
      } else if (timeRange === 'custom' && customDateRange?.from) {
          startDate = customDateRange.from;
          const endDate = customDateRange.to ? endOfDay(customDateRange.to) : endOfDay(customDateRange.from);
          return operations.filter(op => {
              const opDate = parseISO(op.createdAt as string);
              return opDate >= startDate && opDate <= endDate;
          });
      } else {
          return operations;
      }
      
      return operations.filter(op => parseISO(op.createdAt as string) >= startDate);
    }, [operations, timeRange, customDateRange]);


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
        
        let runningCapital = config.initialCapitalUSD;
        let compoundingProjectionCapitals: {[key: string]: number} = { '1': config.initialCapitalUSD, '2': config.initialCapitalUSD, '3': config.initialCapitalUSD, '4': config.initialCapitalUSD, '5': config.initialCapitalUSD };

        for (let i = 0; i < totalDays; i++) {
            const currentDate = addDays(config.startDate, i);
            const dateKey = format(startOfDay(currentDate), 'yyyy-MM-dd');

            if (dailyResults.has(dateKey)) {
                runningCapital += dailyResults.get(dateKey)!;
            }

            const dayEntry: ProjectionDay = {
                day: i + 1,
                date: format(currentDate, 'dd/MM/yyyy', { locale: ptBR }),
                capitalAtualUSD: runningCapital,
                drawdownAtualUSD: runningCapital * 0.15,
                loteRiscoBaixoAtual: (runningCapital * 0.10) / 1000,
                loteRiscoAltoAtual: (runningCapital * 0.20) / 1000,
                projections: {},
            };
            
            [1, 2, 3, 4, 5].forEach(goalPercent => {
                const key = String(goalPercent);
                compoundingProjectionCapitals[key] *= (1 + goalPercent / 100);
                dayEntry.projections[key] = {
                    capitalUSD: compoundingProjectionCapitals[key],
                    capitalBRL: compoundingProjectionCapitals[key] * config.usdToBrlRate,
                    drawdownUSD: compoundingProjectionCapitals[key] * 0.15,
                    loteRiscoBaixo: (compoundingProjectionCapitals[key] * 0.10) / 1000,
                    loteRiscoAlto: (compoundingProjectionCapitals[key] * 0.20) / 1000,
                };
            });
            
            data.push(dayEntry);
        }

        return data;
    }, [config, operations]);

    const dashboardMetrics = useMemo(() => {
        const closedOps = filteredOperations.filter(op => op.status === 'Fechada' && op.resultUSD !== undefined && op.closedAt);
        if (closedOps.length === 0) return { totalOps: 0, profitableOps: 0, winRate: 0, avgProfit: 0, avgLoss: 0, avgOperationTime: 0, riskRewardRatio: 0, maxDrawdown: 0, profitFactor: 0 };

        const profits = closedOps.filter(op => op.resultUSD! > 0).map(op => op.resultUSD!);
        const losses = closedOps.filter(op => op.resultUSD! < 0).map(op => op.resultUSD!);
        
        const totalProfit = profits.reduce((sum, p) => sum + p, 0);
        const totalLoss = losses.reduce((sum, l) => sum + l, 0);
        
        const avgProfit = profits.length > 0 ? totalProfit / profits.length : 0;
        const avgLoss = losses.length > 0 ? Math.abs(totalLoss / losses.length) : 0;
        
        const totalDurationMinutes = closedOps.reduce((sum, op) => sum + differenceInMinutes(parseISO(op.closedAt as string), parseISO(op.createdAt as string)), 0);

        // Max Drawdown Calculation
        let peak = config.initialCapitalUSD;
        let maxDrawdown = 0;
        let currentCapital = config.initialCapitalUSD;
        
        const sortedOps = [...operations].sort((a, b) => parseISO(a.createdAt as string).getTime() - parseISO(b.createdAt as string).getTime());
        sortedOps.forEach(op => {
            if (op.status === 'Fechada' && op.resultUSD !== undefined) {
                currentCapital += op.resultUSD;
                if (currentCapital > peak) {
                    peak = currentCapital;
                }
                const drawdown = ((peak - currentCapital) / peak) * 100;
                if (drawdown > maxDrawdown) {
                    maxDrawdown = drawdown;
                }
            }
        });


        return {
            totalOps: closedOps.length,
            profitableOps: profits.length,
            winRate: (profits.length / closedOps.length) * 100,
            avgProfit,
            avgLoss,
            avgOperationTime: totalDurationMinutes / closedOps.length,
            riskRewardRatio: avgLoss > 0 ? avgProfit / avgLoss : Infinity,
            maxDrawdown,
            profitFactor: totalLoss !== 0 ? totalProfit / Math.abs(totalLoss) : Infinity,
        };
    }, [filteredOperations, config.initialCapitalUSD, operations]);

    const chartData = useMemo(() => {
      return projectionData.map(day => {
          return {
              name: `Dia ${day.day}`,
              'Capital Atual': day.capitalAtualUSD,
              'Meta 1%': day.projections['1'].capitalUSD,
              'Meta 2%': day.projections['2'].capitalUSD,
              'Meta 3%': day.projections['3'].capitalUSD,
              'Meta 4%': day.projections['4'].capitalUSD,
              'Meta 5%': day.projections['5'].capitalUSD,
          };
      });
  }, [projectionData]);


    const lineColors: { [key: string]: string } = {
        'Capital Atual': '#8884d8', // Roxo vibrante
        'Meta 1%': '#82ca9d',       // Verde suave
        'Meta 2%': '#ffc658',       // Amarelo âmbar
        'Meta 3%': '#ff8042',       // Laranja
        'Meta 4%': '#00C49F',       // Verde azulado (Teal)
        'Meta 5%': '#FFBB28',       // Dourado
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

            <Tabs defaultValue="dashboard">
                <TabsList className="mb-4">
                    <TabsTrigger value="dashboard"><BarChart className="w-4 h-4 mr-2" />Dashboard</TabsTrigger>
                    <TabsTrigger value="projection"><LineChartIcon className="w-4 h-4 mr-2" />Projeção</TabsTrigger>
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
                                            <TableHead className="sticky left-[150px] bg-card z-10 w-[120px] text-blue-400 border-r">Capital Atual (USD)</TableHead>
                                            <TableHead className="w-[120px] text-blue-400">Drawdown Atual</TableHead>
                                            <TableHead className="w-[120px] text-blue-400">Lote Baixo Atual</TableHead>
                                            <TableHead className="w-[120px] text-blue-400 border-r">Lote Alto Atual</TableHead>
                                            {/* Projections */}
                                            {[1, 2, 3, 4, 5].map(goal => (
                                                <React.Fragment key={goal}>
                                                    <TableHead className="text-center text-green-400">Capital {goal}% (USD)</TableHead>
                                                    <TableHead className="text-center text-green-400">Capital {goal}% (BRL)</TableHead>
                                                    <TableHead className="text-center text-red-400">Drawdown</TableHead>
                                                    <TableHead className="text-center">Lotes (R. Baixo)</TableHead>
                                                    <TableHead className="text-center">Lotes (R. Alto)</TableHead>
                                                    <TableHead className="text-center">Ops/Dia</TableHead>
                                                </React.Fragment>
                                            ))}
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {projectionData.map((row) => (
                                            <TableRow key={row.day}>
                                                <TableCell className="sticky left-0 bg-card z-10 font-medium">{row.day}</TableCell>
                                                <TableCell className="sticky left-[50px] bg-card z-10">{row.date}</TableCell>
                                                <TableCell className="sticky left-[150px] bg-card z-10 font-semibold text-blue-400 border-r">{formatCurrency(row.capitalAtualUSD, 'USD')}</TableCell>
                                                <TableCell className="text-center text-blue-400">{formatCurrency(row.drawdownAtualUSD, 'USD')}</TableCell>
                                                <TableCell className="text-center text-blue-400">{row.loteRiscoBaixoAtual.toFixed(2)}</TableCell>
                                                <TableCell className="text-center text-blue-400 border-r">{row.loteRiscoAltoAtual.toFixed(2)}</TableCell>
                                                
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
                     <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Operações</CardTitle><Target className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{dashboardMetrics.totalOps}</div><p className="text-xs text-muted-foreground">{dashboardMetrics.profitableOps} lucrativas</p></CardContent></Card>
                        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Taxa de Acerto</CardTitle><Percent className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{dashboardMetrics.winRate.toFixed(1)}%</div><p className="text-xs text-muted-foreground">de operações com lucro</p></CardContent></Card>
                        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Risco/Retorno</CardTitle><ArrowDownUp className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{dashboardMetrics.riskRewardRatio.toFixed(2)}</div><p className="text-xs text-muted-foreground">Lucro médio / Perda média</p></CardContent></Card>
                        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Fator de Lucro</CardTitle><TrendingUp className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{dashboardMetrics.profitFactor.toFixed(2)}</div><p className="text-xs text-muted-foreground">Lucro bruto / Prejuízo bruto</p></CardContent></Card>
                        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Drawdown Máximo</CardTitle><ChevronsDown className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold text-red-500">{dashboardMetrics.maxDrawdown.toFixed(2)}%</div><p className="text-xs text-muted-foreground">Maior queda do capital</p></CardContent></Card>
                        
                        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Lucro Médio</CardTitle><TrendingUp className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold text-green-500">{formatCurrency(dashboardMetrics.avgProfit, 'USD')}</div><p className="text-xs text-muted-foreground">por operação lucrativa</p></CardContent></Card>
                        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Perda Média</CardTitle><TrendingDown className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold text-red-500">{formatCurrency(dashboardMetrics.avgLoss, 'USD')}</div><p className="text-xs text-muted-foreground">por operação com prejuízo</p></CardContent></Card>
                        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Expectativa</CardTitle><BrainCircuit className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{(dashboardMetrics.winRate/100 * dashboardMetrics.avgProfit - (1 - dashboardMetrics.winRate/100) * dashboardMetrics.avgLoss).toFixed(2)}</div><p className="text-xs text-muted-foreground">Ganho esperado por trade</p></CardContent></Card>
                        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Tempo Médio</CardTitle><Clock className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{formatDuration(dashboardMetrics.avgOperationTime)}</div><p className="text-xs text-muted-foreground">Duração média de cada trade</p></CardContent></Card>
                     </div>
                    <Card className="bg-card/70 mt-4">
                        <CardHeader>
                            <div className="flex justify-between items-center">
                                <div>
                                    <CardTitle>Gráfico de Evolução de Capital</CardTitle>
                                    <CardDescription>Comparativo entre o capital atual e as projeções de lucro.</CardDescription>
                                </div>
                                <div className="flex items-center gap-2">
                                     <Select value={timeRange} onValueChange={setTimeRange}>
                                        <SelectTrigger className="w-[180px]">
                                            <SelectValue placeholder="Selecione o período" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all_time">Todo o Período</SelectItem>
                                            <SelectItem value="last_30_days">Últimos 30 dias</SelectItem>
                                            <SelectItem value="last_7_days">Últimos 7 dias</SelectItem>
                                            <SelectItem value="custom">Personalizado</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    {timeRange === 'custom' && (
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button
                                                    id="date"
                                                    variant={"outline"}
                                                    className={cn("w-[240px] justify-start text-left font-normal", !customDateRange && "text-muted-foreground")}
                                                >
                                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                                    {customDateRange?.from ? (
                                                        customDateRange.to ? (
                                                            <>
                                                                {format(customDateRange.from, "LLL dd, y")} -{" "}
                                                                {format(customDateRange.to, "LLL dd, y")}
                                                            </>
                                                        ) : (
                                                            format(customDateRange.from, "LLL dd, y")
                                                        )
                                                    ) : (
                                                        <span>Escolha o intervalo</span>
                                                    )}
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0" align="start">
                                                <Calendar
                                                    initialFocus
                                                    mode="range"
                                                    defaultMonth={customDateRange?.from}
                                                    selected={customDateRange}
                                                    onSelect={setCustomDateRange}
                                                    numberOfMonths={2}
                                                />
                                            </PopoverContent>
                                        </Popover>
                                    )}
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="h-[400px] w-full">
                           <ResponsiveContainer width="100%" height="100%">
                             <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                               <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                               <XAxis 
                                 dataKey="name" 
                                 stroke="hsl(var(--muted-foreground))"
                                 fontSize={12}
                                 tickLine={false}
                                 axisLine={false}
                                 interval={Math.floor(chartData.length / 15)}
                               />
                               <YAxis 
                                 stroke="hsl(var(--muted-foreground))" 
                                 fontSize={12}
                                 tickLine={false}
                                 axisLine={false}
                                 tickFormatter={(value) => `$${Number(value)/1000}k`}
                                />
                               <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'hsl(var(--primary))', strokeWidth: 1, strokeDasharray: '3 3' }} />
                               <Legend wrapperStyle={{ paddingTop: '20px' }}/>
                               {Object.entries(lineColors).map(([key, color]) => (
                                  <Line 
                                    key={key}
                                    type="monotone" 
                                    dataKey={key} 
                                    stroke={color} 
                                    strokeWidth={key === 'Capital Atual' ? 2 : 1.5} 
                                    dot={false}
                                    strokeDasharray={key === 'Capital Atual' ? '1' : '5 5'}
                                  />
                               ))}
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

// Helper function to get the end of the day for a date
function endOfDay(date: Date) {
  const newDate = new Date(date);
  newDate.setHours(23, 59, 59, 999);
  return newDate;
}

    

