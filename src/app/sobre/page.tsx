"use client";

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Info, ShieldCheck, Zap, Handshake } from 'lucide-react';

export default function AboutPage() {
  return (
    <div className="container mx-auto px-4 py-8 text-foreground">
      <header className="text-center mb-12">
        <Info className="w-16 h-16 text-primary mx-auto mb-4" />
        <h1 className="text-4xl md:text-5xl font-bold text-primary mb-4">
          Sobre o Aplicativo Sent Energia
        </h1>
        <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto">
          Uma ferramenta completa e integrada para impulsionar o sucesso dos nossos parceiros e consultores de energia.
        </p>
      </header>

      <div className="max-w-4xl mx-auto space-y-8">
        <Card className="bg-card/70 backdrop-blur-lg border shadow-xl">
          <CardHeader>
            <CardTitle className="flex items-center text-2xl text-primary">
              <Zap className="w-6 h-6 mr-3" />
              Nossa Missão
            </CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground space-y-4">
            <p>
              O aplicativo Sent Energia foi desenvolvido com o objetivo de centralizar e otimizar todas as etapas do processo de vendas e gestão de relacionamento com o cliente. Nossa missão é fornecer aos nossos consultores as melhores ferramentas para que possam alcançar resultados extraordinários, com eficiência, transparência e agilidade.
            </p>
            <p>
              Desde a simulação de economia e geração de propostas personalizadas até a gestão completa do funil de vendas no CRM e o acompanhamento de comissões, tudo foi pensado para facilitar o seu dia a dia e maximizar seu potencial de ganhos.
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card/70 backdrop-blur-lg border shadow-xl">
          <CardHeader>
            <CardTitle className="flex items-center text-2xl text-primary">
              <Handshake className="w-6 h-6 mr-3" />
              Funcionalidades Principais
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc list-inside text-muted-foreground space-y-2">
              <li><strong>Calculadora de Economia:</strong> Simule o potencial de economia para seus clientes de forma rápida e visual.</li>
              <li><strong>Gerador de Propostas:</strong> Crie propostas detalhadas e profissionais baseadas nas simulações.</li>
              <li><strong>CRM Integrado:</strong> Gerencie seus leads através de um funil de vendas claro e intuitivo (Kanban).</li>
              <li><strong>Integração com WhatsApp:</strong> Receba mensagens de novos leads diretamente no seu CRM.</li>
              <li><strong>Painéis de Controle:</strong> Acompanhe seu desempenho, comissões e o ranking de performance.</li>
              <li><strong>Gestão de Carteira:</strong> Visualize seus saldos e solicite saques de comissão de forma segura.</li>
              <li><strong>Plano de Carreira:</strong> Explore as oportunidades de crescimento e desenvolvimento dentro da Sent Energia.</li>
            </ul>
          </CardContent>
        </Card>

        <Card className="bg-card/70 backdrop-blur-lg border shadow-xl">
          <CardHeader>
            <CardTitle className="flex items-center text-2xl text-primary">
              <ShieldCheck className="w-6 h-6 mr-3" />
              Compromisso com a Privacidade
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              A segurança e a privacidade dos dados de nossos usuários e de seus clientes são de extrema importância para nós. Tratamos todas as informações com o máximo de cuidado e em conformidade com as leis de proteção de dados vigentes.
            </p>
            <p className="text-muted-foreground">
              Para saber mais sobre como coletamos, usamos e protegemos suas informações, por favor, leia nossa Política de Privacidade.
            </p>
            <Link href="/politica-de-privacidade.html" passHref>
              <Button variant="outline">
                Ver Política de Privacidade
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
