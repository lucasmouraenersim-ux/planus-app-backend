"use client";

import { Suspense } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Loader2 } from 'lucide-react';
import Image from 'next/image';

function ForexStrategiesPage() {

  const strategies = [
    {
      title: 'Cruzamento de Médias Móveis (9 e 21)',
      description: 'Uma estratégia popular para identificar a direção da tendência. O cruzamento de uma média móvel curta (9 períodos) sobre uma longa (21 períodos) pode sinalizar mudanças no momento do mercado.',
      content: {
        goldenCross: 'Sinal de Compra (Golden Cross): Ocorre quando a média móvel de 9 períodos cruza para CIMA da média de 21. Isso sugere que a tendência de curto prazo está se tornando mais forte que a de longo prazo, indicando um potencial momento de alta.',
        deathCross: 'Sinal de Venda (Death Cross): Ocorre quando a média móvel de 9 períodos cruza para BAIXO da média de 21. Isso sugere que a tendência de curto prazo está enfraquecendo, indicando um potencial momento de baixa.',
      },
      imageUrl: 'https://placehold.co/600x300.png?text=Cruzamento+de+Medias+Moveis',
      imageAiHint: 'line chart moving average crossover',
    },
    {
      title: 'Bandas de Bollinger',
      description: 'Uma ferramenta de análise de volatilidade que consiste em uma média móvel central e duas bandas (superior e inferior) que representam desvios padrão.',
      content: {
        overbought: 'Sinal de Sobrecompra: Quando o preço toca ou ultrapassa a banda superior, pode indicar que o ativo está sobrecomprado e pode haver uma reversão para a média (baixa).',
        oversold: 'Sinal de Sobrevenda: Quando o preço toca ou ultrapassa a banda inferior, pode indicar que o ativo está sobrevendido e pode haver uma reversão para a média (alta).',
        volatility: 'Aperto e Alargamento: Bandas que se aproximam ("aperto") sugerem baixa volatilidade e um possível movimento brusco futuro. Bandas que se afastam ("alargamento") indicam aumento da volatilidade.'
      },
      imageUrl: 'https://placehold.co/600x300.png?text=Bandas+de+Bollinger',
      imageAiHint: 'line chart bollinger bands',
    },
  ];


  return (
    <div className="p-4 md:p-6 space-y-6">
       <header>
        <h1 className="text-2xl md:text-3xl font-semibold text-foreground">
          Estratégias de Trading
        </h1>
        <p className="text-muted-foreground mt-1">Explore conceitos e estratégias populares para aprimorar sua análise.</p>
      </header>

      <Card>
        <CardContent className="p-6">
          <Accordion type="single" collapsible className="w-full">
            {strategies.map((strategy, index) => (
              <AccordionItem key={index} value={`item-${index}`}>
                <AccordionTrigger className="text-lg font-medium">{strategy.title}</AccordionTrigger>
                <AccordionContent className="pt-2">
                  <p className="text-muted-foreground mb-4">{strategy.description}</p>
                  <div className="grid md:grid-cols-2 gap-6 items-start">
                    <div className="space-y-3 text-sm">
                      {Object.entries(strategy.content).map(([key, value]) => (
                         <div key={key}>
                           <h4 className="font-semibold text-foreground capitalize">{key.replace(/([A-Z])/g, ' $1')}</h4>
                           <p className="text-muted-foreground">{value}</p>
                         </div>
                      ))}
                    </div>
                    <div>
                      <Image 
                        src={strategy.imageUrl} 
                        alt={`Ilustração para ${strategy.title}`} 
                        width={600} 
                        height={300} 
                        className="rounded-md object-cover" 
                        data-ai-hint={strategy.imageAiHint}
                      />
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>

    </div>
  );
}

export default function ForexInvestStrategiesPage() {
  return (
    <Suspense fallback={
        <div className="flex flex-col justify-center items-center h-screen bg-transparent text-primary">
            <Loader2 className="animate-spin rounded-full h-12 w-12 text-primary mb-4" />
            <p className="text-lg font-medium">Carregando Estratégias...</p>
        </div>
    }>
        <ForexStrategiesPage />
    </Suspense>
  )
}
