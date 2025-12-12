"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { 
  Sun, Zap, Factory, GraduationCap, Handshake, 
  ArrowRight, ChevronLeft, ChevronRight, LogOut
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';

const modules = [
  {
    id: 'solar',
    title: "Parceiro Solar",
    subtitle: "Venda de Usinas (CAPEX)",
    description: "Para clientes que desejam investir em ativos próprios. Orçamentos de engenharia e financiamento.",
    icon: Sun,
    color: "text-yellow-400",
    glow: "shadow-yellow-500/40",
    bg: "bg-yellow-500/10",
    link: "/solar",
    status: "Em Breve"
  },
  {
    id: 'gd',
    title: "Assinatura (GD)",
    subtitle: "Desconto na Fatura (OPEX)",
    description: "Modelo recorrente para residências e comércios. Economia imediata sem investimento.",
    icon: Zap,
    color: "text-cyan-400",
    glow: "shadow-cyan-500/50",
    bg: "bg-cyan-500/10",
    link: "/dashboard", // Link para o Dashboard atual
    status: "Ativo"
  },
  {
    id: 'acl',
    title: "Mercado Livre",
    subtitle: "Migração ACL (Grupo A)",
    description: "Alta performance para indústrias. Gestão de demanda contratada e compra de energia no atacado.",
    icon: Factory,
    color: "text-purple-400",
    glow: "shadow-purple-500/40",
    bg: "bg-purple-500/10",
    link: "/acl",
    status: "Em Breve"
  }
];

export default function HubPage() {
  const { appUser } = useAuth();
  const router = useRouter();
  const [activeIndex, setActiveIndex] = useState(1); // Começa no do meio (GD)

  // Navegação por Teclado
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setActiveIndex((prev) => (prev + 1) % modules.length);
      if (e.key === 'ArrowLeft') setActiveIndex((prev) => (prev - 1 + modules.length) % modules.length);
      if (e.key === 'Enter') router.push(modules[activeIndex].link);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeIndex, router]);

  const handleLogout = async () => {
    await signOut(auth);
    router.replace('/login');
  };

  return (
    <div className="h-screen w-full bg-[#020617] text-white overflow-hidden flex flex-col font-sans relative selection:bg-cyan-500/30">
      
      {/* Background Cinematográfico */}
      <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-[-20%] left-[50%] -translate-x-1/2 w-[1000px] h-[600px] bg-cyan-900/20 rounded-full blur-[120px] animate-pulse"></div>
          <div className="absolute bottom-0 w-full h-1/2 bg-gradient-to-t from-[#020617] via-[#020617]/80 to-transparent"></div>
          {/* Grid de chão futurista */}
          <div className="absolute bottom-0 w-full h-[400px] opacity-20" 
               style={{ 
                   backgroundImage: 'linear-gradient(0deg, transparent 24%, rgba(6, 182, 212, .3) 25%, rgba(6, 182, 212, .3) 26%, transparent 27%, transparent 74%, rgba(6, 182, 212, .3) 75%, rgba(6, 182, 212, .3) 76%, transparent 77%, transparent), linear-gradient(90deg, transparent 24%, rgba(6, 182, 212, .3) 25%, rgba(6, 182, 212, .3) 26%, transparent 27%, transparent 74%, rgba(6, 182, 212, .3) 75%, rgba(6, 182, 212, .3) 76%, transparent 77%, transparent)',
                   backgroundSize: '50px 50px',
                   transform: 'perspective(500px) rotateX(60deg) translateY(100px)'
               }}>
          </div>
      </div>

      {/* Header Minimalista */}
      <header className="relative z-20 flex justify-between items-center px-10 py-6">
          <div className="flex items-center gap-3">
             <div className="p-1.5 bg-gradient-to-tr from-cyan-500 to-blue-600 rounded-lg shadow-[0_0_15px_rgba(6,182,212,0.5)]">
                 <Zap className="h-5 w-5 text-white fill-white" />
             </div>
             <span className="font-heading font-bold text-xl tracking-tight">Sent<span className="text-cyan-400">Energia</span></span>
          </div>

          <div className="flex items-center gap-6">
              <div className="flex items-center gap-3 bg-white/5 px-4 py-2 rounded-full border border-white/10 backdrop-blur-md">
                  <Avatar className="h-8 w-8 border border-white/20">
                      <AvatarImage src={appUser?.photoURL || undefined} />
                      <AvatarFallback className="bg-slate-800 text-xs">{appUser?.displayName?.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="text-sm">
                      <p className="font-medium leading-none">{appUser?.displayName}</p>
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider">{appUser?.type === 'superadmin' ? 'Super Admin' : 'Parceiro'}</p>
                  </div>
              </div>
              <Button variant="ghost" size="icon" onClick={handleLogout} className="text-slate-400 hover:text-red-400 transition-colors">
                  <LogOut className="w-5 h-5" />
              </Button>
          </div>
      </header>

      {/* --- CARROSSEL 3D COVERFLOW --- */}
      <main className="flex-1 relative z-10 flex flex-col items-center justify-center -mt-10">
          
          <div className="text-center mb-12 space-y-2 animate-in fade-in slide-in-from-bottom-8 duration-700">
              <h1 className="text-5xl md:text-6xl font-black tracking-tight text-white drop-shadow-2xl">
                  Escolha sua <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-emerald-400">Jornada</span>
              </h1>
              <p className="text-lg text-slate-400 font-light">Navegue pelo ecossistema de soluções energéticas.</p>
          </div>

          <div className="relative w-full max-w-6xl h-[450px] flex items-center justify-center perspective-1000">
              
              {/* Botões de Navegação */}
              <button onClick={() => setActiveIndex((prev) => (prev - 1 + modules.length) % modules.length)} className="absolute left-10 z-30 p-4 rounded-full bg-white/5 hover:bg-white/10 text-white transition-all backdrop-blur hover:scale-110">
                  <ChevronLeft className="w-8 h-8" />
              </button>
              <button onClick={() => setActiveIndex((prev) => (prev + 1) % modules.length)} className="absolute right-10 z-30 p-4 rounded-full bg-white/5 hover:bg-white/10 text-white transition-all backdrop-blur hover:scale-110">
                  <ChevronRight className="w-8 h-8" />
              </button>

              {/* Cards */}
              <div className="flex items-center justify-center gap-0 w-full h-full relative">
                  {modules.map((item, index) => {
                      // Lógica de Posição
                      let position = index - activeIndex;
                      if (position < -1) position = modules.length + position; // Loop visual
                      if (position > 1) position = position - modules.length;

                      const isActive = position === 0;
                      const isLeft = position === -1 || (index === 0 && activeIndex === modules.length - 1); // Lógica de loop circular simples para 3 itens
                      const isRight = position === 1 || (index === modules.length - 1 && activeIndex === 0);

                      // Estilos Baseados na Posição (3D)
                      let transform = 'scale(0.8) translateX(0) translateZ(-200px) rotateY(0deg)';
                      let zIndex = 0;
                      let opacity = 0.4;
                      let blur = 'blur(4px)';
                      let pointerEvents = 'none';

                      if (isActive) {
                          transform = 'scale(1.1) translateX(0) translateZ(0) rotateY(0deg)';
                          zIndex = 20;
                          opacity = 1;
                          blur = 'blur(0px)';
                          pointerEvents = 'auto';
                      } else if (isLeft) { // Item à esquerda (ou o último se for o primeiro)
                          // Correção manual para loop de 3 itens
                          if(index === 0 && activeIndex === 2) { // Item 0 vira Right
                             transform = 'scale(0.85) translateX(60%) translateZ(-100px) rotateY(-15deg)';
                          } else if (index === 2 && activeIndex === 0) { // Item 2 vira Left
                             transform = 'scale(0.85) translateX(-60%) translateZ(-100px) rotateY(15deg)';
                          } else {
                              // Normal
                              transform = position < 0 
                                ? 'scale(0.85) translateX(-60%) translateZ(-100px) rotateY(15deg)'
                                : 'scale(0.85) translateX(60%) translateZ(-100px) rotateY(-15deg)';
                          }
                          zIndex = 10;
                          opacity = 0.6;
                          blur = 'blur(2px)';
                          pointerEvents = 'auto';
                      }

                      return (
                          <div 
                              key={item.id}
                              onClick={() => setActiveIndex(index)}
                              className={`absolute transition-all duration-700 ease-out cursor-pointer w-[380px]`}
                              style={{ 
                                  transform, 
                                  zIndex, 
                                  opacity, 
                                  filter: blur,
                                  pointerEvents: pointerEvents as any
                              }}
                          >
                              <div className={`
                                  relative bg-[#0B1121] border border-white/10 rounded-3xl p-8 h-[420px] flex flex-col justify-between overflow-hidden group shadow-2xl
                                  ${isActive ? item.glow : ''}
                              `}>
                                  {/* Brilho de Fundo no Card Ativo */}
                                  <div className={`absolute top-0 right-0 w-64 h-64 ${item.bg.replace('/10', '/5')} rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2 transition-opacity duration-500 ${isActive ? 'opacity-100' : 'opacity-0'}`}></div>

                                  <div>
                                      <div className="flex justify-between items-start mb-8">
                                          <div className={`p-4 rounded-2xl ${item.bg} ${item.color} ring-1 ring-white/5`}>
                                              <item.icon className="w-10 h-10" />
                                          </div>
                                          {item.status === 'Em Breve' && (
                                              <span className="px-3 py-1 rounded-full bg-white/5 text-[10px] uppercase font-bold tracking-widest text-slate-500 border border-white/5">
                                                  Em Breve
                                              </span>
                                          )}
                                          {item.status === 'Ativo' && isActive && (
                                              <span className="flex h-3 w-3 relative">
                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                                              </span>
                                          )}
                                      </div>
                                      
                                      <h2 className="text-3xl font-bold text-white mb-2 tracking-tight">{item.title}</h2>
                                      <p className={`text-sm font-medium mb-4 ${item.color} uppercase tracking-wider`}>{item.subtitle}</p>
                                      <p className="text-slate-400 leading-relaxed text-sm font-light border-t border-white/5 pt-4">
                                          {item.description}
                                      </p>
                                  </div>

                                  <Link href={item.link} className={item.status === 'Em Breve' ? 'pointer-events-none' : ''}>
                                      <Button 
                                          className={`w-full h-12 text-md font-bold transition-all duration-300 ${isActive ? 'bg-white text-black hover:bg-cyan-50 hover:scale-105 shadow-[0_0_20px_rgba(255,255,255,0.3)]' : 'bg-slate-800 text-slate-500 border border-white/5 hover:bg-slate-700'}`}
                                      >
                                          {item.status === 'Ativo' ? 'Acessar Módulo' : 'Aguarde Lançamento'}
                                          {item.status === 'Ativo' && <ArrowRight className="w-4 h-4 ml-2" />}
                                      </Button>
                                  </Link>
                              </div>
                              
                              {/* Reflexo no chão (Opcional, dá um toque premium) */}
                              {isActive && (
                                  <div className="absolute -bottom-10 left-0 right-0 h-10 bg-gradient-to-b from-[#0B1121]/50 to-transparent opacity-30 blur-md transform scale-y-[-1]"></div>
                              )}
                          </div>
                      );
                  })}
              </div>
          </div>

      </main>

      {/* --- RODAPÉ ECOSSISTEMA (Discreto e Elegante) --- */}
      <footer className="relative z-20 border-t border-white/5 bg-[#020617]/80 backdrop-blur-xl py-6">
          <div className="max-w-7xl mx-auto px-10 flex flex-col md:flex-row justify-between items-center gap-6">
              
              <div className="flex items-center gap-2 text-slate-500">
                  <span className="h-2 w-2 bg-emerald-500 rounded-full animate-pulse"></span>
                  <span className="text-xs font-bold uppercase tracking-widest">Ecossistema Sent Conectado</span>
              </div>

              <div className="flex gap-8">
                  <Link href="/academy" className="group flex items-center gap-3 opacity-60 hover:opacity-100 transition-opacity">
                      <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 group-hover:bg-indigo-500 group-hover:text-white transition-colors">
                          <GraduationCap className="w-5 h-5" />
                      </div>
                      <div className="flex flex-col">
                          <span className="text-sm font-bold text-white">Sent Academy</span>
                          <span className="text-[10px] text-slate-400">Universidade Corporativa</span>
                      </div>
                  </Link>

                  <Link href="/parceiros" className="group flex items-center gap-3 opacity-60 hover:opacity-100 transition-opacity">
                      <div className="p-2 rounded-lg bg-slate-700/30 text-slate-300 group-hover:bg-slate-700 group-hover:text-white transition-colors">
                          <Handshake className="w-5 h-5" />
                      </div>
                      <div className="flex flex-col">
                          <span className="text-sm font-bold text-white">Rede de Parceiros</span>
                          <span className="text-[10px] text-slate-400">Marketplace de Serviços</span>
                      </div>
                  </Link>
              </div>

              <div className="text-[10px] text-slate-600 font-mono hidden md:block">
                  V.2.0 • SERVER US-EAST
              </div>
          </div>
      </footer>

    </div>
  );
}
