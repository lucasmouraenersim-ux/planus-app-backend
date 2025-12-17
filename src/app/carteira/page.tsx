
"use client";
import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Wallet, Copy, Share2, DollarSign, TrendingUp, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { requestWithdrawalAction } from '@/actions/withdraw';
import type { PixKeyType, WithdrawalType } from '@/types/wallet';
import Link from 'next/link';

export default function CarteiraPage() {
    const { appUser, updateAppUser } = useAuth();
    const { toast } = useToast();
    const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
    const [withdrawAmount, setWithdrawAmount] = useState(0);
    const [pixKeyType, setPixKeyType] = useState<PixKeyType>('CPF/CNPJ');
    const [pixKey, setPixKey] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://planusenergia.com.br';
    const referralLink = `${baseUrl}/register?ref=${appUser?.uid}`;

    const handleCopy = () => {
        navigator.clipboard.writeText(referralLink);
        toast({ title: "Link Copiado!", description: "Envie para seus amigos vendedores." });
    };

    const handleRequestWithdrawal = async (type: WithdrawalType) => {
        if (!appUser) return;
        if (withdrawAmount < 50) {
            toast({ title: "Valor mínimo para saque é R$ 50,00", variant: "destructive" });
            return;
        }
        if (!pixKey) {
            toast({ title: "Chave PIX é obrigatória", variant: "destructive" });
            return;
        }
        
        setIsLoading(true);
        const result = await requestWithdrawalAction({
            userId: appUser.uid,
            amount: withdrawAmount,
            pixKeyType,
            pixKey,
            withdrawalType: type,
        });

        if (result.success) {
            toast({ title: "Solicitação Enviada!", description: result.message, className: "bg-green-600 text-white" });
            // Optimistic update
            if (type === 'mlm') {
                updateAppUser({ mlmBalance: (appUser.mlmBalance || 0) - withdrawAmount });
            } else {
                updateAppUser({ personalBalance: (appUser.personalBalance || 0) - withdrawAmount });
            }
            setIsWithdrawModalOpen(false);
        } else {
            toast({ title: "Erro na Solicitação", description: result.message, variant: "destructive" });
        }
        setIsLoading(false);
    };

    return (
        <>
            <div className="p-8 min-h-screen bg-slate-950 text-white">
                <div className="max-w-4xl mx-auto space-y-8">
                    
                    <div>
                        <h1 className="text-3xl font-bold flex items-center gap-3">
                            <Wallet className="w-8 h-8 text-cyan-500" /> Minha Carteira
                        </h1>
                        <p className="text-slate-400 mt-2">Gerencie seus ganhos e indique parceiros.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        
                        <Card className="bg-slate-900 border-slate-800 relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-20 bg-emerald-500/10 blur-[80px] rounded-full"></div>
                            <CardHeader>
                                <CardTitle className="text-slate-400 text-sm font-bold uppercase tracking-wider">Saldo de Rede (MLM)</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-4xl font-mono font-bold text-emerald-400 mb-6">
                                    R$ {appUser?.mlmBalance?.toFixed(2).replace('.', ',') || '0,00'}
                                </div>
                                <Button onClick={() => setIsWithdrawModalOpen(true)} className="bg-emerald-600 hover:bg-emerald-500 w-full font-bold">
                                    <DollarSign className="w-4 h-4 mr-2" /> Solicitar Saque
                                </Button>
                                <p className="text-[10px] text-slate-500 mt-4 text-center">
                                    O saldo provém de 10% de comissão sobre recargas de indicados.
                                </p>
                            </CardContent>
                        </Card>

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
                    <div className="text-center mt-4">
                        <Link href="/team" className="text-sm text-cyan-400 hover:underline">
                            Visualizar minha equipe
                        </Link>
                    </div>
                </div>
            </div>

            <Dialog open={isWithdrawModalOpen} onOpenChange={setIsWithdrawModalOpen}>
                <DialogContent className="bg-slate-900 border-slate-700 text-white">
                    <DialogHeader>
                        <DialogTitle>Solicitar Saque</DialogTitle>
                        <DialogDescription>
                            O valor será enviado para a chave PIX informada em até 3 dias úteis.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="amount">Valor do Saque (R$)</Label>
                            <Input
                                id="amount"
                                type="number"
                                placeholder="Mínimo R$ 50,00"
                                value={withdrawAmount || ''}
                                onChange={(e) => setWithdrawAmount(Number(e.target.value))}
                                max={appUser?.mlmBalance || 0}
                            />
                        </div>
                         <div className="space-y-2">
                            <Label htmlFor="pixKeyType">Tipo da Chave PIX</Label>
                            <Select value={pixKeyType} onValueChange={(v) => setPixKeyType(v as PixKeyType)}>
                                <SelectTrigger id="pixKeyType"><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="CPF/CNPJ">CPF/CNPJ</SelectItem>
                                    <SelectItem value="Celular">Celular</SelectItem>
                                    <SelectItem value="Email">Email</SelectItem>
                                    <SelectItem value="Aleatória">Aleatória</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="pixKey">Chave PIX</Label>
                            <Input
                                id="pixKey"
                                placeholder="Sua chave PIX"
                                value={pixKey}
                                onChange={(e) => setPixKey(e.target.value)}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsWithdrawModalOpen(false)}>Cancelar</Button>
                        <Button onClick={() => handleRequestWithdrawal('mlm')} disabled={isLoading}>
                             {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                            Confirmar Solicitação
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

