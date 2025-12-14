
"use client";

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { 
  BookOpen, Download, Share2, Zap, CheckCircle2, 
  ArrowLeft, Lightbulb, GraduationCap, Target, Copy, Check, FileText
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from '@/hooks/use-toast';
import Link from 'next/link';

// --- COMPONENTE DE SCRIPT ---
const SalesScript = ({ title, text }: { title: string, text: string }) => {
    const [copied, setCopied] = useState(false);
    const copyToClipboard = () => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        toast({ title: "Copiado!", description: "Script copiado para a área de transferência." });
    };

    return (
        <div className="bg-slate-900/50 border border-white/5 rounded-xl p-5 hover:border-cyan-500/30 transition-colors group">
            <div className="flex justify-between items-center mb-3">
                <h4 className="font-bold text-white text-sm flex items-center gap-2">
                    <Share2 className="w-4 h-4 text-emerald-400"/> {title}
                </h4>
                <Button variant="outline" size="sm" onClick={copyToClipboard} className="h-7 text-xs border-white/10 hover:bg-emerald-500 hover:text-white hover:border-emerald-500 transition-colors">
                    {copied ? <Check className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
                    {copied ? "Copiado" : "Copiar"}
                </Button>
            </div>
            <p className="text-slate-400 text-sm leading-relaxed whitespace-pre-line font-mono bg-black/30 p-4 rounded-lg border border-white/5">
                {text}
            </p>
        </div>
    );
};

export default function OnboardingPage() {
    const { appUser } = useAuth();
    
    return (
        <div className="min-h-screen bg-[#020617] text-slate-200 font-sans relative overflow-x-hidden pb-20">
            {/* Background */}
            <div className="fixed inset-0 pointer-events-none z-0">
                <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-cyan-900/10 to-transparent opacity-40" />
                <div className="absolute bottom-0 right-0 w-[800px] h-[600px] bg-blue-900/10 rounded-full blur-[120px]" />
            </div>

            <div className="container max-w-5xl mx-auto px-4 py-8 relative z-10">
                
                {/* Voltar ao Hub */}
                <div className="mb-6">
                    <Link href="/hub">
                        <Button variant="ghost" className="text-slate-400 hover:text-white pl-0 gap-2">
                            <ArrowLeft className="w-4 h-4" /> Voltar ao Hub
                        </Button>
                    </Link>
                </div>

                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-end mb-10 gap-6 animate-in fade-in slide-in-from-top-6 duration-700">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline" className="border-emerald-500 text-emerald-400 bg-emerald-500/10 px-3 py-1">Hub de Parceiros</Badge>
                        </div>
                        <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight">
                            Kit de Boas-vindas
                        </h1>
                        <p className="text-slate-400 mt-2 max-w-xl">
                            Materiais, treinamentos rápidos e ferramentas para acelerar suas vendas.
                        </p>
                    </div>
                </div>

                <Tabs defaultValue="knowledge" className="space-y-8">
                    
                    <TabsList className="bg-slate-900/50 border border-white/10 p-1 rounded-xl h-auto backdrop-blur-md grid grid-cols-2 w-full max-w-md">
                        <TabsTrigger value="knowledge" className="data-[state=active]:bg-cyan-600 data-[state=active]:text-white rounded-lg py-2.5 transition-all">
                            <GraduationCap className="w-4 h-4 mr-2" /> Conhecimento
                        </TabsTrigger>
                        <TabsTrigger value="tools" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white rounded-lg py-2.5 transition-all">
                            <Zap className="w-4 h-4 mr-2" /> Ferramentas & Scripts
                        </TabsTrigger>
                    </TabsList>

                    {/* --- ABA 1: CONHECIMENTO --- */}
                    <TabsContent value="knowledge" className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
                        
                        {/* Cards de Conceito */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <Card className="bg-slate-900/40 border-white/10 backdrop-blur-sm hover:border-cyan-500/50 transition-all hover:-translate-y-1 duration-300">
                                <CardHeader>
                                    <div className="w-12 h-12 rounded-xl bg-yellow-500/10 flex items-center justify-center mb-4 border border-yellow-500/20">
                                        <Lightbulb className="w-6 h-6 text-yellow-500" />
                                    </div>
                                    <CardTitle className="text-white text-lg">O que é GD?</CardTitle>
                                </CardHeader>
                                <CardContent className="text-slate-400 text-sm leading-relaxed">
                                    A Geração Distribuída permite que a energia seja gerada em fazendas solares e enviada para a rede da concessionária (ex: Cemig). Isso gera créditos que abatem a conta do cliente.
                                </CardContent>
                            </Card>

                            <Card className="bg-slate-900/40 border-white/10 backdrop-blur-sm hover:border-cyan-500/50 transition-all hover:-translate-y-1 duration-300">
                                <CardHeader>
                                    <div className="w-12 h-12 rounded-xl bg-cyan-500/10 flex items-center justify-center mb-4 border border-cyan-500/20">
                                        <Target className="w-6 h-6 text-cyan-500" />
                                    </div>
                                    <CardTitle className="text-white text-lg">O Produto</CardTitle>
                                </CardHeader>
                                <CardContent className="text-slate-400 text-sm leading-relaxed">
                                    Vendemos <strong>Assinatura de Energia</strong>. O cliente aluga uma cota da usina digitalmente. Sem obras, sem investimento e sem fidelidade. É desconto puro na fatura atual.
                                </CardContent>
                            </Card>

                            <Card className="bg-slate-900/40 border-white/10 backdrop-blur-sm hover:border-cyan-500/50 transition-all hover:-translate-y-1 duration-300">
                                <CardHeader>
                                    <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center mb-4 border border-purple-500/20">
                                        <CheckCircle2 className="w-6 h-6 text-purple-500" />
                                    </div>
                                    <CardTitle className="text-white text-lg">Para quem vender?</CardTitle>
                                </CardHeader>
                                <CardContent className="text-slate-400 text-sm leading-relaxed">
                                    Residências e Comércios (Baixa Tensão) com conta acima de R$ 300,00. Padarias, mercados, condomínios e casas grandes são os clientes ideais.
                                </CardContent>
                            </Card>
                        </div>

                        {/* Jornada do Cliente */}
                        <div className="bg-slate-900/30 border border-white/10 rounded-2xl p-8">
                            <h3 className="text-xl font-bold text-white mb-8 flex items-center gap-2">
                                <Target className="w-5 h-5 text-cyan-400"/> A Jornada da Venda
                            </h3>
                            
                            <div className="relative">
                                {/* Linha conectora (Desktop) */}
                                <div className="hidden md:block absolute top-1/2 left-0 w-full h-0.5 bg-gradient-to-r from-cyan-900 to-blue-900 -translate-y-1/2 z-0"></div>

                                <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                                    {[
                                        { step: "01", title: "Abordagem", desc: "Pedir a fatura" },
                                        { step: "02", title: "Simulação", desc: "Usar o App" },
                                        { step: "03", title: "Proposta", desc: "Mostrar economia" },
                                        { step: "04", title: "Fechamento", desc: "Assinatura Digital" },
                                        { step: "05", title: "Ativação", desc: "Cliente Conectado" }
                                    ].map((s) => (
                                        <div key={s.step} className="relative z-10 bg-slate-950 border border-white/10 p-4 rounded-xl text-center hover:border-cyan-500/50 transition-colors">
                                            <div className="w-8 h-8 rounded-full bg-cyan-600 text-white font-bold flex items-center justify-center mx-auto mb-3 shadow-[0_0_10px_rgba(8,145,178,0.5)]">
                                                {s.step}
                                            </div>
                                            <p className="font-bold text-white text-sm">{s.title}</p>
                                            <p className="text-xs text-slate-500">{s.desc}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                    </TabsContent>

                    {/* --- ABA 2: FERRAMENTAS --- */}
                    <TabsContent value="tools" className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
                        
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            
                            {/* Coluna Esquerda: SCRIPTS */}
                            <div className="space-y-6">
                                <h3 className="text-lg font-bold text-white mb-4">Scripts de Venda</h3>
                                
                                <SalesScript 
                                    title="Abordagem Inicial (WhatsApp)"
                                    text={`Olá! Tudo bem? Me chamo ${appUser?.displayName?.split(' ')[0] || 'Nome'}, sou consultor credenciado da Planus Energia. 👋\n\nEstamos cadastrando imóveis na sua região para receber um desconto garantido na conta de luz, através da Lei 14.300. \n\nÉ sem obras e sem investimento. Você já conhece esse benefício?`}
                                />

                                <SalesScript 
                                    title="Quebra de Objeção (É Golpe?)"
                                    text={`Entendo sua preocupação! Mas não é mágica, é lei (Marco Legal da GD). 🏛️\n\nFunciona assim: Nossas usinas solares injetam energia na rede da concessionária, e essa energia vira créditos que abatem a sua conta.\n\nO desconto é garantido em contrato e você não paga nada para aderir. Posso te mandar uma simulação rápida?`}
                                />
                                
                                <SalesScript 
                                    title="Cobrança de Fatura"
                                    text={`Para eu calcular exatamente quanto você vai economizar por ano, preciso apenas de uma foto da sua última conta de luz (ou o PDF). \n\nConsegue me enviar aqui? É rapidinho! ⚡`}
                                />
                            </div>

                            {/* Coluna Direita: DOWNLOADS */}
                            <div className="space-y-6">
                                <h3 className="text-lg font-bold text-white mb-4">Central de Downloads</h3>
                                
                                <div className="bg-slate-900/50 border border-white/10 rounded-2xl overflow-hidden">
                                    {[
                                        { name: "Apresentação Comercial.pdf", size: "2.4 MB", type: "PDF" },
                                        { name: "Modelo de Contrato Exemplo.pdf", size: "1.1 MB", type: "PDF" },
                                        { name: "Planilha de Objeções.xlsx", size: "0.8 MB", type: "XLS" },
                                        { name: "Logo Planus Alta Resolução.png", size: "3.5 MB", type: "IMG" },
                                    ].map((file, i) => (
                                        <div key={i} className="flex items-center justify-between p-4 border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors group cursor-pointer">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400 group-hover:bg-cyan-600 group-hover:text-white transition-colors">
                                                    <FileText className="w-5 h-5" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-slate-200 group-hover:text-white">{file.name}</p>
                                                    <p className="text-xs text-slate-500">{file.size} • {file.type}</p>
                                                </div>
                                            </div>
                                            <Button variant="ghost" size="icon" className="text-slate-500 hover:text-white">
                                                <Download className="w-5 h-5" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>

                                <div className="bg-gradient-to-br from-indigo-900/50 to-purple-900/50 border border-indigo-500/30 rounded-2xl p-6 text-center mt-6">
                                    <h4 className="text-white font-bold mb-2">Precisa de Anúncios?</h4>
                                    <p className="text-indigo-200 text-sm mb-4">Use nosso gerador automático para criar artes com seu nome e telefone.</p>
                                    <Link href="/marketing-studio">
                                        <Button className="bg-white text-indigo-900 hover:bg-indigo-50 w-full font-bold">
                                            Ir para Marketing Studio
                                        </Button>
                                    </Link>
                                </div>
                            </div>

                        </div>
                    </TabsContent>
                </Tabs>

            </div>
        </div>
    );
}
    