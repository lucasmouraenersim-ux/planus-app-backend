
"use client";

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Award, TrendingUp, Users, DollarSign, Rocket, Eye, BarChart, UsersRound } from 'lucide-react';

interface CareerLevel {
  icon: React.ElementType;
  name: string;
  description: string;
  requirements: string[];
  benefits: string[];
  nextStep?: string;
}

const careerLevelsData: CareerLevel[] = [
  {
    icon: Rocket,
    name: "Consultor de Energia",
    description: "O ponto de partida na sua jornada de sucesso com a Sent Energia. Ideal para quem está começando e quer aprender sobre o mercado de energia.",
    requirements: [
      "Cadastro completo e aprovado.",
      "Participação no treinamento inicial.",
      "Primeira venda realizada ou lead qualificado gerado."
    ],
    benefits: [
      "Comissão de 8% sobre vendas diretas.",
      "Acesso a materiais de marketing.",
      "Suporte inicial da equipe Sent."
    ],
    nextStep: "Consultor Sênior"
  },
  {
    icon: TrendingUp,
    name: "Consultor Sênior",
    description: "Você demonstrou consistência e está pronto para expandir seus horizontes e ganhos.",
    requirements: [
      "5 vendas diretas concluídas.",
      "Volume de vendas de R$ 20.000.",
      "Feedback positivo de clientes."
    ],
    benefits: [
      "Comissão de 10% sobre vendas diretas.",
      "Bônus por meta de volume de vendas.",
      "Acesso a treinamentos avançados.",
      "Possibilidade de iniciar a formação de equipe (Nível 1 MLM)."
    ],
    nextStep: "Consultor Master"
  },
  {
    icon: Award,
    name: "Consultor Master",
    description: "Um líder experiente, focado em resultados e no desenvolvimento de sua própria rede.",
    requirements: [
      "15 vendas diretas concluídas.",
      "Volume de vendas de R$ 70.000.",
      "Mínimo de 3 indicados diretos ativos (Nível 1)."
    ],
    benefits: [
      "Comissão de 12% sobre vendas diretas.",
      "Participação em comissões de rede MLM (Nível 1: 5%, Nível 2: 2%).",
      "Bônus de liderança por desempenho da equipe.",
      "Convites para eventos exclusivos Sent."
    ],
    nextStep: "Diamante Sent"
  },
  {
    icon: UsersRound,
    name: "Diamante Sent",
    description: "O ápice da carreira na Sent Energia, um verdadeiro embaixador da marca com uma rede consolidada.",
    requirements: [
      "50 vendas diretas concluídas.",
      "Volume de vendas de R$ 250.000.",
      "Mínimo de 10 indicados diretos ativos, com pelo menos 2 Consultores Master na equipe.",
      "Contribuição significativa para a comunidade Sent."
    ],
    benefits: [
      "Comissão de 15% sobre vendas diretas.",
      "Participação em comissões de rede MLM (Nível 1: 7%, Nível 2: 3%, Nível 3: 1%).",
      "Bônus de performance global.",
      "Viagens de incentivo e reconhecimento especial.",
      "Participação em conselho consultivo (opcional)."
    ]
  }
];

export default function CareerPlanPage() {
  return (
    <div className="container mx-auto px-4 py-8 text-foreground">
      <header className="text-center mb-12">
        <h1 className="text-4xl md:text-5xl font-bold text-primary mb-4">
          Sua Jornada de Crescimento na Sent Energia
        </h1>
        <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto">
          A Sent Energia valoriza seus parceiros e oferece um plano de carreira estruturado para
          você alcançar novos patamares de sucesso e reconhecimento. Conheça os níveis e prepare-se para decolar!
        </p>
      </header>

      <section className="mb-16">
        <h2 className="text-3xl font-semibold text-center text-primary mb-10">Níveis de Carreira</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-2 gap-8">
          {careerLevelsData.map((level) => (
            <Card key={level.name} className="bg-card/70 backdrop-blur-lg border shadow-xl hover:shadow-2xl transition-shadow duration-300 flex flex-col">
              <CardHeader>
                <div className="flex items-center mb-3">
                  <level.icon className="w-10 h-10 mr-4 text-primary" />
                  <CardTitle className="text-2xl text-primary">{level.name}</CardTitle>
                </div>
                <CardDescription className="text-muted-foreground text-sm">{level.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex-grow space-y-4">
                <div>
                  <h4 className="font-semibold text-foreground mb-1">Requisitos para Alcançar:</h4>
                  <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                    {level.requirements.map((req, i) => <li key={i}>{req}</li>)}
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold text-foreground mb-1">Benefícios do Nível:</h4>
                  <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                    {level.benefits.map((ben, i) => <li key={i}>{ben}</li>)}
                  </ul>
                </div>
                {level.nextStep && (
                  <p className="text-sm text-accent-foreground mt-3">
                    <strong className="text-primary">Próximo Nível:</strong> {level.nextStep}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="text-center">
        <h2 className="text-3xl font-semibold text-primary mb-8">Explore Nossas Apresentações Detalhadas</h2>
        <Card className="max-w-2xl mx-auto bg-card/70 backdrop-blur-lg border shadow-xl">
          <CardContent className="space-y-6 p-6">
            <p className="text-muted-foreground">
              Aprofunde-se em cada aspecto do nosso plano de carreira e descubra como maximizar seus ganhos e desenvolvimento profissional.
            </p>
            <div className="flex flex-col sm:flex-row justify-center items-center gap-4 rounded-lg bg-black/10 dark:bg-white/5 p-6 shadow-inner">
              <Link href="/career-plan-presentation" passHref>
                <Button size="lg" className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground">
                  <Eye className="mr-2 h-5 w-5" />
                  Apresentação Completa
                </Button>
              </Link>
              <Link href="/career-plan-mlm-analysis" passHref>
                <Button size="lg" variant="outline" className="w-full sm:w-auto border-primary/60 hover:border-primary text-primary/80 hover:text-primary hover:bg-primary/10">
                  <BarChart className="mr-2 h-5 w-5" />
                  Análise do Modelo MLM
                </Button>
              </Link>
              <Link href="/career-plan-mlm-escalonado" passHref>
                <Button size="lg" variant="outline" className="w-full sm:w-auto border-primary/60 hover:border-primary text-primary/80 hover:text-primary hover:bg-primary/10">
                  <UsersRound className="mr-2 h-5 w-5" />
                 MLM Escalonado
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
