
"use client";

import { useMemo, useState } from 'react';
import { addDays, differenceInDays, format, endOfYear } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { BarChart, Bitcoin, AreaChart } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

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

export const ProjectionView = ({ config }: { config: ProjectionConfig }) => {
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
    
    return (
        <div className="p-4 md:p-6 w-full">
            <header className="mb-6">
                <h1 className="text-3xl font-bold text-foreground">{config.name}</h1>
                <p className="text-muted-foreground">
                    Iniciado em {format(config.startDate, 'dd/MM/yyyy')} com {formatCurrency(config.initialCapital, 'USD')}
                </p>
            </header>

            <Tabs defaultValue="projection">
                <TabsList className="mb-4">
                    <TabsTrigger value="projection"><AreaChart className="w-4 h-4 mr-2" />Projeção</TabsTrigger>
                    <TabsTrigger value="dashboard"><BarChart className="w-4 h-4 mr-2" />Dashboard</TabsTrigger>
                    <TabsTrigger value="bitcoin"><Bitcoin className="w-4 h-4 mr-2" />Bitcoin Gráfico</TabsTrigger>
                </TabsList>
                <TabsContent value="projection">
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
                </TabsContent>
                <TabsContent value="dashboard">
                    <p>Dashboard de performance em desenvolvimento.</p>
                </TabsContent>
                <TabsContent value="bitcoin">
                     <p>Gráfico do Bitcoin em desenvolvimento.</p>
                </TabsContent>
            </Tabs>
        </div>
    );
};
