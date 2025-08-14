
"use client";

import { Suspense, useState, useEffect } from 'react';
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { ptBR } from 'date-fns/locale';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { ProjectionView } from '@/components/forex-invest/projection-view';
import { useForex } from '@/contexts/ForexProvider';

import { Calendar as CalendarIcon, LineChart, Loader2, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ForexBancaConfig } from '@/types/forex';

const setupSchema = z.object({
  name: z.string().min(1, "O nome da banca é obrigatório."),
  initialCapitalUSD: z.preprocess(
    (a) => parseFloat(String(a).replace(",", ".")),
    z.number().positive("O capital deve ser um número positivo.")
  ),
  usdToBrlRate: z.preprocess(
    (a) => parseFloat(String(a).replace(",", ".")),
    z.number().positive("A cotação deve ser um número positivo.")
  ),
  startDate: z.date({
    required_error: "A data de início é obrigatória.",
  }),
});

type SetupFormData = z.infer<typeof setupSchema>;

function ForexInvestDashboard() {
  const { config, setConfig, isLoading } = useForex();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const form = useForm<SetupFormData>({
    resolver: zodResolver(setupSchema),
    defaultValues: {
      name: "Minha Banca",
      initialCapitalUSD: 30,
      usdToBrlRate: 5,
      startDate: new Date(),
    },
  });

  const onSubmit = async (data: SetupFormData) => {
    setIsSubmitting(true);
    await setConfig(data);
    setIsSubmitting(false);
  };

  const handleNewProjection = () => {
    setConfig(null); // This will cause the form to show again
    form.reset();
  };

  if (isLoading) {
    return (
        <div className="flex flex-col justify-center items-center h-[calc(100vh-10rem)]">
            <Loader2 className="animate-spin rounded-full h-12 w-12 text-primary mb-4" />
            <p className="text-lg font-medium">Carregando projeção...</p>
        </div>
    );
  }

  if (config) {
      const projectionConfig = {
          ...config,
          startDate: new Date(config.startDate as string) // Ensure date is a Date object
      };
      return <ProjectionView config={projectionConfig} onNewProjection={handleNewProjection} />;
  }

  return (
    <div className="flex items-center justify-center min-h-full p-4 md:p-6">
      <Card className="w-full max-w-lg bg-card/80">
        <CardHeader className="text-center">
          <div className="flex justify-center items-center mb-4">
            <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
               <LineChart className="w-8 h-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl">Bem-vindo ao Forex Invest</CardTitle>
          <CardDescription>Insira os dados iniciais para criar sua projeção de banca.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome da Banca</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Minha Banca" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="initialCapitalUSD"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Capital Inicial (USD)</FormLabel>
                      <FormControl>
                        <Input type="text" placeholder="Ex: 100" {...field} onChange={e => field.onChange(e.target.value.replace(',', '.'))} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="usdToBrlRate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cotação USD/BRL</FormLabel>
                      <FormControl>
                        <Input type="text" placeholder="Ex: 5.25" {...field} onChange={e => field.onChange(e.target.value.replace(',', '.'))} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Data de Início</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={"outline"}
                            className={cn(
                              "w-full pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              format(field.value, "PPP", { locale: ptBR })
                            ) : (
                              <span>Escolha uma data</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) =>
                            date > new Date() || date < new Date("1900-01-01")
                          }
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                     <FormDescription className="text-xs text-muted-foreground mt-2">A projeção será calculada até o final do ano.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isSubmitting ? "Criando..." : "Criar Projeção"}
                {!isSubmitting && <ArrowRight className="ml-2 h-4 w-4" />}
              </Button>
            </form>
          </Form>
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
