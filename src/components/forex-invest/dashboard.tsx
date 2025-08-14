"use client";

import { useForex } from '@/contexts/ForexProvider';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { AreaChart, LineChart, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Line } from 'recharts';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { CalendarIcon, DollarSign, TrendingDown, TrendingUp } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Calendar } from '../ui/calendar';
import type { DateRange } from 'react-day-picker';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

const bankrollSchema = z.object({
  name: z.string().min(1, "Nome da banca é obrigatório."),
  initialCapital: z.coerce.number().positive("Capital inicial deve ser positivo."),
  usdbrl: z.coerce.number().positive("Cotação USD/BRL deve ser positiva."),
  startDate: z.date({ required_error: "Data de início é obrigatória." }),
});

type BankrollFormData = z.infer<typeof bankrollSchema>;

export default function Dashboard() {
  const { bankroll, setBankroll, projection, dailyPerformance, filteredChartData, setDateRange } = useForex();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>();

  const form = useForm<BankrollFormData>({
    resolver: zodResolver(bankrollSchema),
    defaultValues: {
      name: bankroll?.name || "Minha Banca",
      initialCapital: bankroll?.initialCapital || 1000,
      usdbrl: bankroll?.usdbrl || 5.20,
      startDate: bankroll?.startDate ? parseISO(bankroll.startDate as unknown as string) : new Date(),
    },
  });

  const onSubmit = (data: BankrollFormData) => {
    setBankroll({
      ...data,
      startDate: data.startDate.toISOString(),
      currentCapital: data.initialCapital
    });
    setIsModalOpen(false);
  };

  if (!bankroll) {
    return (
      <div className="flex items-center justify-center h-full">
        <Dialog open={true}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Configurar Banca Forex</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem><FormLabel>Nome da Banca</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="initialCapital" render={({ field }) => (
                  <FormItem><FormLabel>Capital Inicial (USD)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="usdbrl" render={({ field }) => (
                  <FormItem><FormLabel>Cotação USD/BRL</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="startDate" render={({ field }) => (
                    <FormItem className="flex flex-col"><FormLabel>Data de Início</FormLabel>
                        <Popover><PopoverTrigger asChild>
                            <Button variant="outline">{field.value ? format(field.value, "PPP") : <span>Escolha uma data</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button>
                        </PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent></Popover>
                    <FormMessage />
                    </FormItem>
                )} />
                <DialogFooter>
                  <Button type="submit">Salvar</Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="space-y-6">
        <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold font-serif text-[#3F51B5]">Dashboard de Projeção</h1>
            <div className="flex gap-2">
                 <Popover>
                    <PopoverTrigger asChild>
                        <Button variant="outline"><CalendarIcon className="mr-2 h-4 w-4" />
                            {customDateRange?.from ? ( customDateRange.to ? `${format(customDateRange.from, "LLL dd, y")} - ${format(customDateRange.to, "LLL dd, y")}` : format(customDateRange.from, "LLL dd, y")) : "Período"}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="end">
                        <Calendar mode="range" selected={customDateRange} onSelect={(range) => { setCustomDateRange(range); setDateRange(range); }} numberOfMonths={2}/>
                    </PopoverContent>
                </Popover>
                <Button onClick={() => setDateRange('last7')}>7 Dias</Button>
                <Button onClick={() => setDateRange('last30')}>30 Dias</Button>
                <Button onClick={() => setDateRange('all')}>Todo Período</Button>
            </div>
        </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Lucro/Prejuízo Total</CardTitle><DollarSign className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent><div className={`text-2xl font-bold ${dailyPerformance.totalProfitLoss >= 0 ? 'text-green-500' : 'text-red-500'}`}>${dailyPerformance.totalProfitLoss.toFixed(2)}</div></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Evolução Diária Média</CardTitle><TrendingUp className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent><div className="text-2xl font-bold">{dailyPerformance.avgEvolution.toFixed(2)}%</div></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Maior Ganho Diário</CardTitle><TrendingUp className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent><div className="text-2xl font-bold text-green-500">${dailyPerformance.bestDay.toFixed(2)}</div></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Pior Perda Diária</CardTitle><TrendingDown className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent><div className="text-2xl font-bold text-red-500">${dailyPerformance.worstDay.toFixed(2)}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Evolução do Capital</CardTitle><CardDescription>Comparativo entre a evolução real e as projeções de lucro.</CardDescription></CardHeader>
        <CardContent className="h-96">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={filteredChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tickFormatter={(str) => format(parseISO(str), "dd/MM")} />
              <YAxis tickFormatter={(value) => `$${value}`} />
              <Tooltip formatter={(value: number) => value.toFixed(2)} />
              <Legend />
              <Line type="monotone" dataKey="actualCapital" name="Minha Evolução" stroke="#8884d8" strokeWidth={2} />
              <Line type="monotone" dataKey="proj1" name="Meta 1%" stroke="#82ca9d" strokeDasharray="5 5" />
              <Line type="monotone" dataKey="proj2" name="Meta 2%" stroke="#ffc658" strokeDasharray="5 5" />
              <Line type="monotone" dataKey="proj3" name="Meta 3%" stroke="#ff8042" strokeDasharray="5 5" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Tabela de Projeção e Gerenciamento</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Capital Atual (USD)</TableHead>
                <TableHead>1% Proj. (USD)</TableHead>
                <TableHead>3% Proj. (USD)</TableHead>
                <TableHead>5% Proj. (USD)</TableHead>
                <TableHead>Drawdown (USD)</TableHead>
                <TableHead>Lotes (Risco Baixo)</TableHead>
                <TableHead>Lotes (Risco Alto)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projection.map((day, index) => (
                <TableRow key={index}>
                  <TableCell>{format(parseISO(day.date), "dd/MM/yyyy")}</TableCell>
                  <TableCell>${day.actualCapital.toFixed(2)}</TableCell>
                  <TableCell>${day.proj1.toFixed(2)}</TableCell>
                  <TableCell>${day.proj3.toFixed(2)}</TableCell>
                  <TableCell>${day.proj5.toFixed(2)}</TableCell>
                  <TableCell>${day.drawdown.toFixed(2)}</TableCell>
                  <TableCell>{day.lowRiskLots.toFixed(2)}</TableCell>
                  <TableCell>{day.highRiskLots.toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
