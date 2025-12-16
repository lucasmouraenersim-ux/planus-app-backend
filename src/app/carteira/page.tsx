
"use client";
import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Wallet, Copy, Share2, DollarSign, TrendingUp } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function CarteiraPage() {
    const { appUser } = useAuth();
    const { toast } = useToast();
    
    // Seu link real do site
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://planusenergia.com.br';
    const referralLink = `${baseUrl}/register?ref=${appUser?.uid}`;

    const handleCopy = () => {
        navigator.clipboard.writeText(referralLink);
        toast({ title: "Link Copiado!", description: "Envie para seus amigos vendedores." });
    };

    const handleWithdraw = () => {
        // Aqui você pode abrir um modal pedindo a chave PIX
        // ou criar um registro na coleção 'saques' no firebase
        toast({ title: "Solicitação Enviada", description: "Entraremos em contato para o PIX." });
    };

    return (
        <div className="p-8 min-h-screen bg-slate-950 text-white">
            <div className="max-w-4xl mx-auto space-y-8">
                
                {/* CABEÇALHO */}
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-3">
                        <Wallet className="w-8 h-8 text-cyan-500" /> Minha Carteira
                    </h1>
                    <p className="text-slate-400 mt-2">Gerencie seus ganhos e indique parceiros.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    
                    {/* CARTÃO DE SALDO */}
                    <Card className="bg-slate-900 border-slate-800 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-20 bg-emerald-500/10 blur-[80px] rounded-full"></div>
                        <CardHeader>
                            <CardTitle className="text-slate-400 text-sm font-bold uppercase tracking-wider">Saldo Disponível</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-4xl font-mono font-bold text-emerald-400 mb-6">
                                R$ {appUser?.mlmBalance?.toFixed(2).replace('.', ',') || '0,00'}
                            </div>
                            <div className="flex gap-3">
                                <Button onClick={handleWithdraw} className="bg-emerald-600 hover:bg-emerald-500 w-full font-bold">
                                    <DollarSign className="w-4 h-4 mr-2" /> Sacar via PIX
                                </Button>
                                {/* Opção de trocar saldo por créditos no futuro */}
                            </div>
                            <p className="text-[10px] text-slate-500 mt-4 text-center">
                                O saldo provém de 10% de comissão sobre recargas de indicados.
                            </p>
                        </CardContent>
                    </Card>

                    {/* CARTÃO DE AFILIADO */}
                    <Card className="bg-gradient-to-br from-purple-900/40 to-slate-900 border-purple-500/20">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-purple-300">
                                <TrendingUp className="w-5 h-5" /> Indique e Ganhe
                            </CardTitle>
                            <CardDescription className="text-slate-300">
                                Ganhe <span className="text-white font-bold">10% de comissão recorrente</span> sobre todas as recargas dos vendedores que você indicar.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="bg-black/40 p-4 rounded-lg border border-purple-500/30">
                                <label className="text-xs text-purple-400 font-bold mb-2 block uppercase">Seu Link Exclusivo</label>
                                <div className="flex gap-2">
                                    <code className="flex-1 bg-black/50 p-2 rounded text-xs text-slate-300 truncate border border-white/5">
                                        {referralLink}
                                    </code>
                                    <Button size="icon" variant="secondary" onClick={handleCopy} className="shrink-0 bg-slate-800 hover:bg-white hover:text-black">
                                        <Copy className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>
                            <Button variant="outline" className="w-full border-purple-500/50 text-purple-300 hover:bg-purple-900/50 hover:text-white" onClick={() => {
                                if (navigator.share) navigator.share({ title: 'Planus Energia', text: 'Cadastre-se na plataforma de consultores!', url: referralLink });
                            }}>
                                <Share2 className="w-4 h-4 mr-2" /> Compartilhar Link
                            </Button>
                        </CardContent>
                    </Card>
                </div>

                {/* HISTÓRICO (Placeholder) */}
                <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
                    <h3 className="text-lg font-bold text-white mb-4">Histórico de Transações</h3>
                    <div className="text-center py-8 text-slate-500 text-sm">
                        Nenhuma movimentação recente na carteira.
                    </div>
                </div>

            </div>
        </div>
    );
}
