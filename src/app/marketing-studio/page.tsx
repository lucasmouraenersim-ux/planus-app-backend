
"use client";

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Download, Palette, Type, Smartphone, Check, ArrowLeft, Sparkles, LayoutTemplate } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';

// --- CONFIGURAÇÃO DOS TEMPLATES ---
const TEMPLATES = [
    { 
        id: 0, 
        name: "Blue Horizon", 
        colors: ["#083344", "#06b6d4"], // Cyan/Dark Blue
        accent: "#22d3ee",
        headline: "REDUZA SUA CONTA", 
        subhead: "SEM GASTAR NADA",
        badgeText: "20%"
    },
    { 
        id: 1, 
        name: "Deep Purple", 
        colors: ["#2e1065", "#7c3aed"], // Purple/Violet
        accent: "#d8b4fe",
        headline: "ENERGIA SOLAR", 
        subhead: "POR ASSINATURA",
        badgeText: "ZERO"
    },
    { 
        id: 2, 
        name: "Eco Green", 
        colors: ["#022c22", "#10b981"], // Emerald/Dark Green
        accent: "#34d399",
        headline: "SUSTENTABILIDADE", 
        subhead: "& ECONOMIA REAL",
        badgeText: "ECO"
    },
    { 
        id: 3, 
        name: "Luxury Black", 
        colors: ["#000000", "#1e293b"], // Black/Slate
        accent: "#facc15", // Gold
        headline: "SEM INVESTIMENTO", 
        subhead: "DESCONTO GARANTIDO",
        badgeText: "VIP"
    }
];

// --- COMPONENTE DE FUNDO ---
const CinematicBackground = () => (
    <div className="fixed inset-0 pointer-events-none z-0 bg-[#020617] overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px] opacity-20"></div>
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-cyan-600/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[120px]" />
    </div>
);

export default function MarketingStudioPage() {
    const { appUser } = useAuth();
    const { toast } = useToast();
    
    // Dados do Usuário
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    
    // Config do Banner
    const [selectedTemplate, setSelectedTemplate] = useState(0);
    const [customHeadline, setCustomHeadline] = useState('');
    const [customSubhead, setCustomSubhead] = useState('');
    
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Carregar dados iniciais
    useEffect(() => {
        if (appUser) {
            // Pega primeiro e último nome para não ficar gigante
            const names = (appUser.displayName || 'Seu Nome').split(' ');
            const shortName = names.length > 1 ? `${names[0]} ${names[names.length - 1]}` : names[0];
            setName(shortName);
            setPhone(appUser.phone || '(00) 00000-0000');
        }
    }, [appUser]);

    // Atualizar inputs quando template muda
    useEffect(() => {
        setCustomHeadline(TEMPLATES[selectedTemplate].headline);
        setCustomSubhead(TEMPLATES[selectedTemplate].subhead);
    }, [selectedTemplate]);

    // --- LÓGICA DE DESENHO NO CANVAS (1080x1350 - Ratio 4:5 para Feed/Stories) ---
    const drawCanvas = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const W = 1080;
        const H = 1350; 
        const template = TEMPLATES[selectedTemplate];

        // 1. Fundo (Gradiente)
        const gradient = ctx.createLinearGradient(0, 0, W, H);
        gradient.addColorStop(0, template.colors[0]);
        gradient.addColorStop(1, template.colors[1]);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, W, H);

        // 2. Pattern Geométrico
        ctx.strokeStyle = "rgba(255,255,255,0.03)";
        ctx.lineWidth = 2;
        for (let i = 0; i < 6; i++) {
            ctx.beginPath();
            ctx.arc(W/2, H/2, 200 + (i * 120), 0, Math.PI * 2);
            ctx.stroke();
        }

        // 3. Logo Planus (Simulada em Texto)
        ctx.fillStyle = "#FFFFFF";
        ctx.font = "bold 40px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("PLANUS ENERGIA", W/2, 100);

        // 4. Headline
        ctx.fillStyle = "#FFFFFF";
        ctx.font = "900 100px sans-serif";
        ctx.shadowColor = "rgba(0,0,0,0.5)";
        ctx.shadowBlur = 30;
        ctx.fillText(customHeadline.toUpperCase(), W/2, 450);
        ctx.shadowBlur = 0;

        // 5. Subheadline
        ctx.fillStyle = template.accent;
        ctx.font = "bold 60px sans-serif";
        ctx.fillText(customSubhead.toUpperCase(), W/2, 540);

        // 6. Elemento Central (Badge)
        const badgeY = 750;
        ctx.beginPath();
        ctx.arc(W/2, badgeY, 130, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,255,255,0.05)";
        ctx.fill();
        ctx.lineWidth = 6;
        ctx.strokeStyle = template.accent;
        ctx.stroke();

        ctx.fillStyle = "#FFFFFF";
        ctx.font = "bold 90px sans-serif";
        ctx.fillText(template.badgeText, W/2, badgeY + 30);

        // 7. Rodapé do Consultor
        const footerH = 320;
        
        // Caixa de Vidro
        ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
        ctx.roundRect(60, H - footerH - 60, W - 120, footerH, 40);
        ctx.fill();
        
        // Borda Brilhante
        ctx.strokeStyle = template.accent;
        ctx.lineWidth = 3;
        ctx.stroke();

        // Texto Consultor
        ctx.fillStyle = template.accent;
        ctx.font = "bold 30px sans-serif";
        ctx.fillText("CONSULTOR AUTORIZADO", W/2, H - footerH + 10);

        // Nome
        ctx.fillStyle = "#FFFFFF";
        ctx.font = "bold 60px sans-serif";
        ctx.fillText(name.toUpperCase(), W/2, H - footerH + 90);

        // Botão WhatsApp Simulado
        const whatsY = H - footerH + 150;
        ctx.fillStyle = "#25D366";
        ctx.beginPath();
        ctx.roundRect((W/2) - 350, whatsY, 700, 80, 40);
        ctx.fill();

        ctx.fillStyle = "#000000";
        ctx.font = "bold 40px sans-serif";
        ctx.fillText(`WhatsApp: ${phone}`, W/2, whatsY + 55);
    };

    // Redesenhar
    useEffect(() => {
        // Pequeno delay para garantir que fonte carregou
        setTimeout(drawCanvas, 100);
    }, [name, phone, selectedTemplate, customHeadline, customSubhead]);

    const handleDownload = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        
        const link = document.createElement('a');
        link.download = `post-planus-${Date.now()}.png`;
        link.href = canvas.toDataURL('image/png', 1.0);
        link.click();
        
        toast({ 
            title: "Download Concluído", 
            description: "A imagem foi salva no seu dispositivo.",
            className: "bg-emerald-600 border-none text-white"
        });
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-200 font-sans relative overflow-x-hidden pb-20">
            <CinematicBackground />

            <div className="container max-w-7xl mx-auto px-4 py-8 relative z-10">
                
                {/* Navegação Voltar */}
                <div className="mb-8">
                    <Link href="/hub">
                        <Button variant="ghost" className="text-slate-400 hover:text-white pl-0 gap-2">
                            <ArrowLeft className="w-4 h-4" /> Voltar ao Hub
                        </Button>
                    </Link>
                </div>
                
                {/* HEADER */}
                <div className="flex items-center gap-4 mb-10 animate-in fade-in slide-in-from-top-4 duration-700">
                    <div className="p-3 bg-gradient-to-br from-purple-600 to-cyan-600 rounded-2xl shadow-lg shadow-purple-500/20">
                        <Sparkles className="w-8 h-8 text-white" />
                    </div>
                    <div>
                        <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight">
                            Marketing Studio
                        </h1>
                        <p className="text-slate-400">
                            Crie anúncios profissionais para suas redes sociais em segundos.
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
                    
                    {/* COLUNA ESQUERDA: CONTROLES */}
                    <div className="lg:col-span-5 space-y-8 animate-in slide-in-from-left-8 duration-700 delay-200">
                        
                        {/* 1. Templates */}
                        <div className="space-y-4">
                            <Label className="text-slate-300 flex items-center gap-2">
                                <LayoutTemplate className="w-4 h-4 text-cyan-400"/> Escolha o Tema
                            </Label>
                            <div className="grid grid-cols-2 gap-3">
                                {TEMPLATES.map((t) => (
                                    <button
                                        key={t.id}
                                        onClick={() => setSelectedTemplate(t.id)}
                                        className={`relative h-20 rounded-xl border-2 transition-all duration-300 overflow-hidden group text-left p-3 flex flex-col justify-end ${
                                            selectedTemplate === t.id 
                                            ? 'border-cyan-500 ring-2 ring-cyan-500/30' 
                                            : 'border-white/5 hover:border-white/20'
                                        }`}
                                        style={{ background: `linear-gradient(to bottom right, ${t.colors[0]}, ${t.colors[1]})` }}
                                    >
                                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            {selectedTemplate === t.id && <div className="bg-cyan-500 rounded-full p-1"><Check className="w-3 h-3 text-white"/></div>}
                                        </div>
                                        <span className="text-xs font-bold text-white z-10">{t.name}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* 2. Conteúdo do Texto */}
                        <div className="space-y-4 bg-slate-900/50 p-6 rounded-2xl border border-white/5">
                            <Label className="text-slate-300 flex items-center gap-2">
                                <Type className="w-4 h-4 text-purple-400"/> Personalizar Textos
                            </Label>
                            
                            <div className="space-y-3">
                                <div>
                                    <Label className="text-[10px] text-slate-500 uppercase font-bold mb-1">Manchete</Label>
                                    <Input 
                                        value={customHeadline} 
                                        onChange={(e) => setCustomHeadline(e.target.value)} 
                                        maxLength={20}
                                        className="bg-slate-950 border-white/10 focus:border-cyan-500 text-white font-bold h-11"
                                    />
                                </div>
                                <div>
                                    <Label className="text-[10px] text-slate-500 uppercase font-bold mb-1">Subtítulo</Label>
                                    <Input 
                                        value={customSubhead} 
                                        onChange={(e) => setCustomSubhead(e.target.value)} 
                                        maxLength={25}
                                        className="bg-slate-950 border-white/10 focus:border-cyan-500 text-cyan-400 font-bold h-11"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* 3. Dados do Consultor */}
                        <div className="space-y-4 bg-slate-900/50 p-6 rounded-2xl border border-white/5">
                            <Label className="text-slate-300 flex items-center gap-2">
                                <Smartphone className="w-4 h-4 text-emerald-400"/> Seus Dados de Contato
                            </Label>
                            
                            <div className="space-y-3">
                                <div>
                                    <Label className="text-[10px] text-slate-500 uppercase font-bold mb-1">Nome no Banner</Label>
                                    <Input 
                                        value={name} 
                                        onChange={(e) => setName(e.target.value)} 
                                        className="bg-slate-950 border-white/10 text-white h-11"
                                    />
                                </div>
                                <div>
                                    <Label className="text-[10px] text-slate-500 uppercase font-bold mb-1">WhatsApp</Label>
                                    <Input 
                                        value={phone} 
                                        onChange={(e) => setPhone(e.target.value)} 
                                        className="bg-slate-950 border-white/10 text-white h-11"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Botão de Ação */}
                        <Button 
                            onClick={handleDownload} 
                            className="w-full h-14 text-lg font-bold bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 shadow-lg shadow-cyan-500/25 rounded-xl transition-all hover:scale-[1.02]"
                        >
                            <Download className="mr-2 w-5 h-5" /> Baixar Imagem (HD)
                        </Button>

                    </div>

                    {/* COLUNA DIREITA: PREVIEW */}
                    <div className="lg:col-span-7 flex flex-col items-center animate-in zoom-in duration-700 delay-300">
                        <div className="sticky top-10">
                            <div className="relative group">
                                {/* Moldura do Celular */}
                                <div className="relative z-10 bg-slate-950 p-4 rounded-[3rem] border-[6px] border-slate-800 shadow-2xl">
                                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/3 h-6 bg-slate-950 rounded-b-xl z-20"></div>
                                    
                                    {/* Canvas Real */}
                                    <div className="relative overflow-hidden rounded-[2.2rem]">
                                        <canvas 
                                            ref={canvasRef}
                                            width={1080}
                                            height={1350}
                                            className="w-full h-auto max-h-[75vh] object-contain bg-slate-900"
                                            style={{ maxWidth: '400px' }} 
                                        />
                                    </div>
                                </div>

                                {/* Glow Effect atrás */}
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[110%] h-[90%] bg-gradient-to-tr from-cyan-500/20 to-purple-500/20 rounded-[4rem] blur-[80px] -z-10 group-hover:opacity-100 transition-opacity duration-500"></div>
                            </div>
                            <p className="text-center text-xs text-slate-500 mt-6">Preview em tempo real</p>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}

    