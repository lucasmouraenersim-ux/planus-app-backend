"use client";

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { CheckCircle, Zap, TrendingUp, Users, FileText, CalendarClock, Leaf, ShieldCheck } from 'lucide-react';
import { calculateSavings } from '@/lib/discount-calculator';
import Image from 'next/image';

const formatCurrency = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const LandingPage = () => {
  const [billAmount, setBillAmount] = useState(1000);
  const savings = calculateSavings(billAmount, true);

  const handleSliderChange = (value: number[]) => {
    setBillAmount(value[0]);
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(event.target.value, 10);
    setBillAmount(isNaN(value) ? 0 : value);
  };

  return (
    <div className="bg-background text-foreground">
      {/* Hero Section */}
      <section className="text-center py-20 px-4 bg-primary/5">
        <h1 className="text-4xl md:text-5xl font-bold text-primary mb-4">Reduza sua conta de luz em até 30%</h1>
        <p className="text-lg text-muted-foreground max-w-3xl mx-auto mb-8">
          Com a Planus Energia, você acessa fontes de energia renovável, economiza dinheiro e ajuda o planeta. Sem instalação, sem obras e sem investimento inicial.
        </p>
        <Link href="/login">
            <Button size="lg" className="bg-accent hover:bg-accent/90 text-accent-foreground">Acessar Área do Consultor</Button>
        </Link>
      </section>

      {/* How it works */}
      <section className="py-16 px-4">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">Como Funciona? É Simples!</h2>
        <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-8 text-center">
          <div className="flex flex-col items-center">
            <div className="bg-primary text-primary-foreground rounded-full h-16 w-16 flex items-center justify-center text-2xl font-bold mb-4"><FileText/></div>
            <h3 className="text-xl font-semibold mb-2">1. Análise da Fatura</h3>
            <p className="text-muted-foreground">Analisamos sua fatura de energia para entender seu consumo e apresentar a melhor solução de economia.</p>
          </div>
          <div className="flex flex-col items-center">
            <div className="bg-primary text-primary-foreground rounded-full h-16 w-16 flex items-center justify-center text-2xl font-bold mb-4"><Zap/></div>
            <h3 className="text-xl font-semibold mb-2">2. Adesão Digital</h3>
            <p className="text-muted-foreground">Você assina digitalmente, sem burocracia. Cuidamos de toda a comunicação com a sua distribuidora.</p>
          </div>
          <div className="flex flex-col items-center">
            <div className="bg-primary text-primary-foreground rounded-full h-16 w-16 flex items-center justify-center text-2xl font-bold mb-4"><Leaf/></div>
            <h3 className="text-xl font-semibold mb-2">3. Economia na Prática</h3>
            <p className="text-muted-foreground">Em até 90 dias, você começa a receber sua nova fatura com o desconto aplicado, direto no seu e-mail.</p>
          </div>
        </div>
      </section>
      
      {/* Savings Calculator */}
      <section className="py-16 px-4 bg-muted/50">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">Simule sua Economia Anual</h2>
        <Card className="max-w-3xl mx-auto shadow-lg">
          <CardHeader>
            <CardTitle>Quanto você paga na sua conta de luz mensalmente?</CardTitle>
          </CardHeader>
          <CardContent className="grid md:grid-cols-2 gap-8 items-center">
            <div>
              <Input
                type="number"
                value={billAmount}
                onChange={handleInputChange}
                className="text-2xl h-14 mb-4 text-center font-bold"
              />
              <Slider
                value={[billAmount]}
                onValueChange={handleSliderChange}
                min={100}
                max={20000}
                step={50}
              />
            </div>
            <div className="text-center bg-primary/10 p-6 rounded-lg">
              <p className="text-sm text-muted-foreground">Sua economia anual estimada</p>
              <p className="text-4xl md:text-5xl font-bold text-primary my-2">{formatCurrency(savings.annualSaving)}</p>
              <p className="text-sm text-muted-foreground">Com desconto efetivo de <span className="font-bold">{savings.effectiveAnnualDiscountPercentage}%</span> ao ano.</p>
            </div>
          </CardContent>
          <CardDescription className="text-center px-6 pb-4 text-xs">
            {savings.discountDescription}
          </CardDescription>
        </Card>
      </section>

      {/* Legal Basis & Timeline */}
      <section className="py-16 px-4 grid md:grid-cols-2 gap-12 max-w-6xl mx-auto items-center">
        <div>
          <h3 className="text-3xl font-bold text-primary mb-4 flex items-center"><ShieldCheck className="w-8 h-8 mr-3"/>Baseado na Lei</h3>
          <div className="text-muted-foreground space-y-3">
              <p>
                  A Geração Distribuída (GD) é regulamentada pela ANEEL (Resolução Normativa 1.059/2023), permitindo que a energia gerada por fontes renováveis (como solar, eólica, biomassa) seja injetada na rede da distribuidora local.
              </p>
              <p>
                  Essa energia se transforma em créditos que são utilizados para abater o consumo de nossos clientes, gerando a economia na fatura de luz. É um processo seguro, legal e que promove a sustentabilidade.
              </p>
          </div>
        </div>
         <div>
          <h3 className="text-3xl font-bold text-primary mb-4 flex items-center"><CalendarClock className="w-8 h-8 mr-3"/>Cronograma</h3>
           <ul className="list-none space-y-3">
              <li className="flex items-start"><CheckCircle className="w-5 h-5 mr-3 mt-1 text-green-500 flex-shrink-0"/><p><strong className="text-foreground">Dia 1:</strong> Assinatura digital do contrato.</p></li>
              <li className="flex items-start"><CheckCircle className="w-5 h-5 mr-3 mt-1 text-green-500 flex-shrink-0"/><p><strong className="text-foreground">Até 30 Dias:</strong> A Planus informa a distribuidora sobre a adesão.</p></li>
              <li className="flex items-start"><CheckCircle className="w-5 h-5 mr-3 mt-1 text-green-500 flex-shrink-0"/><p><strong className="text-foreground">De 60 a 90 Dias:</strong> A distribuidora processa a alteração e, no ciclo de faturamento seguinte, você recebe sua primeira fatura com o desconto da Planus.</p></li>
           </ul>
        </div>
      </section>

      {/* Our Clients */}
      <section className="py-16 px-4 bg-muted/50">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">Clientes que Confiam na Planus</h2>
        <div className="max-w-5xl mx-auto flex flex-wrap justify-center items-center gap-x-12 gap-y-8">
            <Image src="https://placehold.co/150x60.png" width={150} height={60} alt="Logo Cliente 1" className="opacity-60" data-ai-hint="company logo"/>
            <Image src="https://placehold.co/150x60.png" width={150} height={60} alt="Logo Cliente 2" className="opacity-60" data-ai-hint="company logo"/>
            <Image src="https://placehold.co/150x60.png" width={150} height={60} alt="Logo Cliente 3" className="opacity-60" data-ai-hint="company logo"/>
            <Image src="https://placehold.co/150x60.png" width={150} height={60} alt="Logo Cliente 4" className="opacity-60" data-ai-hint="company logo"/>
            <Image src="https://placehold.co/150x60.png" width={150} height={60} alt="Logo Cliente 5" className="opacity-60" data-ai-hint="company logo"/>
        </div>
      </section>
    </div>
  );
}

export default LandingPage;
