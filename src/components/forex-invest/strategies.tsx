
"use client";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import Image from "next/image";

const strategies = [
    {
        title: "Cruzamento de Médias Móveis (9 & 21)",
        description: "Uma estratégia clássica de seguimento de tendência.",
        content: "Esta estratégia utiliza duas médias móveis exponenciais (EMAs): uma de curto prazo (9 períodos) e uma de longo prazo (21 períodos). Um sinal de compra é gerado quando a EMA de 9 cruza para cima da EMA de 21. Um sinal de venda ocorre quando a EMA de 9 cruza para baixo da EMA de 21. É eficaz em mercados com tendência definida, mas pode gerar sinais falsos em mercados laterais.",
        imageUrl: "https://placehold.co/600x300.png?text=Cruzamento+de+Medias+Moveis",
        imageHint: "line chart moving average crossover"
    },
    {
        title: "Bandas de Bollinger",
        description: "Uma estratégia baseada em volatilidade.",
        content: "As Bandas de Bollinger consistem em uma média móvel central (geralmente de 20 períodos) e duas bandas de desvio padrão (geralmente 2 desvios padrão) acima e abaixo dela. A ideia é que o preço tende a retornar à média. Sinais de compra podem ocorrer quando o preço toca a banda inferior, e sinais de venda quando toca a banda superior. A estratégia é mais útil em mercados com reversão à média.",
        imageUrl: "https://placehold.co/600x300.png?text=Bandas+de+Bollinger",
        imageHint: "candlestick chart bollinger bands"
    }
];

export default function Strategies() {
    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold font-serif text-primary">Estratégias de Trading</h1>
            <p className="text-muted-foreground">Aprenda sobre algumas estratégias populares de trading com exemplos visuais.</p>
             <Card className="bg-card/70 backdrop-blur-lg border shadow-lg">
                <CardContent className="p-4 md:p-6">
                    <Accordion type="single" collapsible className="w-full">
                        {strategies.map((strategy, index) => (
                            <AccordionItem value={`item-${index}`} key={index}>
                                <AccordionTrigger className="text-xl font-semibold text-primary hover:no-underline">{strategy.title}</AccordionTrigger>
                                <AccordionContent className="space-y-4 pt-2">
                                    <p className="text-muted-foreground">{strategy.description}</p>
                                    <p>{strategy.content}</p>
                                    <div className="flex justify-center p-4 bg-muted/50 rounded-lg">
                                        <Image src={strategy.imageUrl} alt={strategy.title} width={600} height={300} className="rounded-lg shadow-md mx-auto" data-ai-hint={strategy.imageHint} />
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
