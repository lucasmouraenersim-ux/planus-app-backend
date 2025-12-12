"use client";

import React, { useRef, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { 
  Sun, Zap, Factory, GraduationCap, Handshake, 
  ArrowRight, TrendingUp, ShieldCheck, Coins 
} from 'lucide-react';
import { Button } from '@/components/ui/button';

// --- COMPONENTE SPOTLIGHT CARD (Interno para facilitar) ---
const SpotlightCard = ({ children, className = "", onClick }: any) => {
  const divRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [opacity, setOpacity] = useState(0);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!divRef.current) return;
    const div = divRef.current;
    const rect = div.getBoundingClientRect();
    setPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  return (
    <div
      ref={divRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setOpacity(1)}
      onMouseLeave={() => setOpacity(0)}
      onClick={onClick}
      className={`relative overflow-hidden rounded-2xl border border-white/10 bg-slate-900/50 backdrop-blur-md transition-all duration-300 hover:scale-[1.02] cursor-pointer group ${className}`}
    >
      <div
        className="pointer-events-none absolute -inset-px opacity-0 transition duration-300 group-hover:opacity-100"
        style={{
          background: `radial-gradient(600px circle at ${position.x}px ${position.y}px, rgba(6, 182, 212, 0.15), transparent 40%)`,
        }}
      />
      <div className="relative h-full z-10">{children}</div>
    </div>
  );
};

export default function HubPage() {
  const { appUser } = useAuth();

  const verticals = [
    {
      title: "Parceiro Solar",
      subtitle: "Venda de Usinas (CAPEX)",
      description: "Dimensionamento, orçamentos e financiamento para clientes que querem investir em ativos próprios.",
      icon: Sun,
      color: "text-yellow-400",
      bg: "bg-yellow-500/10",
      border: "group-hover:border-yellow-500/50",
      link: "/solar", // Futura rota
      status: "Em Breve"
    },
    {
      title: "Assinatura (GD)",
      subtitle: "Desconto na Fatura (OPEX)",
      description: "O modelo recorrente ideal para residências e comércios que buscam economia imediata sem investimento.",
      icon: Zap,
      color: "text-cyan-400",
      bg: "bg-cyan-500/10",
      border: "group-hover:border-cyan-500/50",
      link: "/dashboard", // Rota atual do Dashboard
      status: "Ativo"
    },
    {
      title: "Mercado Livre",
      subtitle: "Migração ACL (Grupo A)",
      description: "Soluções de alta performance para indústrias e grandes consumidores com demanda contratada.",
      icon: Factory,
      color: "text-purple-400",
      bg: "bg-purple-500/10",
      border: "group-hover:border-purple-500/50",
      link: "/acl", // Futura rota
      status: "Em Breve"
    }
  ];

  return (
    <div className="min-h-screen bg-[#020617] text-slate-300 font-sans p-6 md:p-10 relative overflow-hidden">
      
      {/* Background Ambience */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[20%] w-[800px] h-[800px] bg-cyan-900/20 rounded-full blur-[120px] opacity-40 animate-pulse"></div>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto space-y-12">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-end gap-6">
            <div>
                <h1 className="text-4xl font-heading font-bold text-white mb-2">
                    Olá, <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-emerald-400">{appUser?.displayName?.split(' ')[0] || 'Parceiro'}</span>
                </h1>
                <p className="text-slate-400 text-lg">Qual solução energética vamos levar ao mercado hoje?</p>
            </div>
            
            {/* Quick Stats (Resumo da Carteira) */}
            <div className="flex gap-4">
                <div className="bg-slate-900/80 border border-white/10 rounded-xl p-4 flex items-center gap-3 backdrop-blur">
                    <div className="p-2 bg-emerald-500/10 rounded-lg"><Coins className="w-5 h-5 text-emerald-400"/></div>
                    <div>
                        <p className="text-xs text-slate-500 uppercase font-bold">Comissões</p>
                        <p className="text-white font-bold">R$ 12.450,00</p>
                    </div>
                </div>
                <div className="bg-slate-900/80 border border-white/10 rounded-xl p-4 flex items-center gap-3 backdrop-blur">
                    <div className="p-2 bg-blue-500/10 rounded-lg"><TrendingUp className="w-5 h-5 text-blue-400"/></div>
                    <div>
                        <p className="text-xs text-slate-500 uppercase font-bold">Leads Ativos</p>
                        <p className="text-white font-bold">42</p>
                    </div>
                </div>
            </div>
        </div>

        {/* --- VERTICAIS DE NEGÓCIO (CARDS GRANDES) --- */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {verticals.map((item, idx) => (
                <Link href={item.link} key={idx} className={item.status === 'Em Breve' ? 'pointer-events-none opacity-60' : ''}>
                    <SpotlightCard className={`h-full p-8 flex flex-col justify-between border-white/5 ${item.border}`}>
                        <div>
                            <div className="flex justify-between items-start mb-6">
                                <div className={`p-4 rounded-2xl ${item.bg} ${item.color}`}>
                                    <item.icon className="w-8 h-8" />
                                </div>
                                {item.status === 'Em Breve' && (
                                    <span className="px-2 py-1 rounded-full bg-slate-800 text-[10px] uppercase font-bold tracking-wider text-slate-400 border border-white/5">
                                        Em Breve
                                    </span>
                                )}
                            </div>
                            
                            <h2 className="text-2xl font-bold text-white mb-1">{item.title}</h2>
                            <p className={`text-sm font-medium mb-4 ${item.color}`}>{item.subtitle}</p>
                            <p className="text-slate-400 leading-relaxed text-sm">{item.description}</p>
                        </div>

                        <div className="mt-8 flex items-center text-sm font-bold text-white group-hover:gap-2 transition-all">
                            Acessar Módulo <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" />
                        </div>
                    </SpotlightCard>
                </Link>
            ))}
        </div>

        {/* --- ECOSSISTEMA DE SUPORTE --- */}
        <div>
            <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-500"/> Ecossistema Sent
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Sent Academy */}
                <SpotlightCard className="p-6 flex items-center gap-6">
                    <div className="h-24 w-24 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shrink-0">
                        <GraduationCap className="w-10 h-10 text-white" />
                    </div>
                    <div>
                        <h4 className="text-xl font-bold text-white mb-1">Sent Academy</h4>
                        <p className="text-slate-400 text-sm mb-3">Treinamentos exclusivos para você dominar o mercado de energia e vender mais.</p>
                        <Button variant="link" className="p-0 text-indigo-400 hover:text-indigo-300 h-auto">
                            Ir para os cursos &rarr;
                        </Button>
                    </div>
                </SpotlightCard>

                {/* Rede de Parceiros */}
                <SpotlightCard className="p-6 flex items-center gap-6">
                    <div className="h-24 w-24 bg-gradient-to-br from-slate-700 to-slate-800 rounded-2xl flex items-center justify-center shadow-lg shrink-0 border border-white/10">
                        <Handshake className="w-10 h-10 text-white" />
                    </div>
                    <div>
                        <h4 className="text-xl font-bold text-white mb-1">Rede de Parceiros</h4>
                        <p className="text-slate-400 text-sm mb-3">Conecte-se com integradores e engenheiros para executar os projetos que você vendeu.</p>
                        <Button variant="link" className="p-0 text-slate-300 hover:text-white h-auto">
                            Encontrar parceiro &rarr;
                        </Button>
                    </div>
                </SpotlightCard>
            </div>
        </div>

      </div>
    </div>
  );
}
