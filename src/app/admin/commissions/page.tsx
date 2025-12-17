
"use client";
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, getDocs, doc, updateDoc, where } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DollarSign, CheckCircle, XCircle, Users, Send, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function CommissionsDashboard() {
    const [withdrawals, setWithdrawals] = useState<any[]>([]);
    const [topAffiliates, setTopAffiliates] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const { toast } = useToast();

    const loadData = async () => {
        setLoading(true);
        try {
            // 1. Carrega Saques Pendentes
            const qWithdraw = query(collection(db, "withdrawal_requests"), orderBy("requestedAt", "desc"));
            const snapWithdraw = await getDocs(qWithdraw);
            setWithdrawals(snapWithdraw.docs.map(d => ({ id: d.id, ...d.data() })));

            // 2. Carrega Top Afiliados (Quem mais tem saldo MLM)
            const qUsers = query(collection(db, "users"), where("mlmBalance", ">", 0), orderBy("mlmBalance", "desc"));
            const snapUsers = await getDocs(qUsers);
            setTopAffiliates(snapUsers.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (error) {
            console.error("Failed to load commission data:", error);
            toast({ title: "Erro ao Carregar Dados", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadData(); }, []);

    const handleApprove = async (withdrawId: string) => {
        if (!confirm("Você confirma que já realizou o PIX manualmente para este usuário?")) return;
        
        try {
            await updateDoc(doc(db, "withdrawal_requests", withdrawId), {
                status: 'concluido',
                processedAt: new Date().toISOString()
            });
            toast({ title: "Saque marcado como Pago!", className: "bg-green-600 text-white" });
            loadData();
        } catch (error) {
             toast({ title: "Erro ao aprovar", variant: "destructive" });
        }
    };

    const handleReject = async (withdrawId: string, userId: string, amount: number, withdrawalType: 'personal' | 'mlm') => {
        const reason = prompt("Motivo da rejeição:");
        if (!reason) return;

        try {
            // Estorna o valor para o saldo correto do usuário
            const userRef = doc(db, "users", userId);
            const userDoc = await getDocs(query(collection(db, "users"), where("uid", "==", userId)));
            if (!userDoc.empty) {
                const currentData = userDoc.docs[0].data();
                const balanceField = withdrawalType === 'mlm' ? 'mlmBalance' : 'personalBalance';
                const currentBalance = currentData[balanceField] || 0;
                await updateDoc(userRef, {
                    [balanceField]: currentBalance + amount
                });
            }

            // Atualiza a solicitação de saque
            await updateDoc(doc(db, "withdrawal_requests", withdrawId), {
                status: 'falhou',
                adminNotes: reason,
                processedAt: new Date().toISOString()
            });
            
            toast({ title: "Saque rejeitado e estornado.", variant: "destructive" });
            loadData();
        } catch (error) {
            toast({ title: "Erro ao rejeitar", description: "Não foi possível estornar o saldo.", variant: "destructive" });
        }
    };
    
    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'pendente': return "bg-yellow-500/20 text-yellow-400 border-yellow-500/50";
            case 'concluido': return "bg-green-500/20 text-green-400 border-green-500/50";
            case 'falhou': return "bg-red-500/20 text-red-400 border-red-500/50";
            default: return "bg-gray-500/20 text-gray-400";
        }
    };

    return (
        <div className="p-8 bg-slate-950 min-h-screen text-white">
            <h1 className="text-3xl font-bold mb-8">Gestão de Comissões e Saques</h1>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                {/* LISTA DE SAQUES */}
                <Card className="bg-slate-900 border-slate-800">
                    <CardHeader><CardTitle className="text-emerald-400 flex items-center gap-2"><DollarSign/> Solicitações de Saque</CardTitle></CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow className="border-slate-800"><TableHead>Usuário</TableHead><TableHead>Valor</TableHead><TableHead>Chave PIX</TableHead><TableHead>Ação</TableHead></TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? <TableRow><TableCell colSpan={4} className="text-center">Carregando...</TableCell></TableRow> : 
                                 withdrawals.filter(w => w.status === 'pendente').length > 0 ? 
                                 withdrawals.filter(w => w.status === 'pendente').map(w => (
                                    <TableRow key={w.id} className="border-slate-800">
                                        <TableCell>{w.userName}</TableCell>
                                        <TableCell className="font-bold text-emerald-400">R$ {w.amount?.toFixed(2)}</TableCell>
                                        <TableCell className="font-mono text-xs">{w.pixKey}</TableCell>
                                        <TableCell className="flex gap-2">
                                            <Button size="sm" className="bg-emerald-600 h-8 w-8 p-0" onClick={() => handleApprove(w.id)}><CheckCircle className="w-4 h-4"/></Button>
                                            <Button size="sm" variant="destructive" className="h-8 w-8 p-0" onClick={() => handleReject(w.id, w.userId, w.amount, w.withdrawalType)}><XCircle className="w-4 h-4"/></Button>
                                        </TableCell>
                                    </TableRow>
                                )) : (
                                    <TableRow><TableCell colSpan={4} className="text-center text-slate-500">Nenhum saque pendente.</TableCell></TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                {/* RANKING DE AFILIADOS */}
                <Card className="bg-slate-900 border-slate-800">
                    <CardHeader><CardTitle className="text-purple-400 flex items-center gap-2"><Users/> Top Afiliados (Saldo MLM)</CardTitle></CardHeader>
                    <CardContent>
                         <Table>
                            <TableHeader>
                                <TableRow className="border-slate-800"><TableHead>Afiliado</TableHead><TableHead className="text-right">Saldo Atual</TableHead></TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? <TableRow><TableCell colSpan={2} className="text-center">Carregando...</TableCell></TableRow> : 
                                 topAffiliates.length > 0 ?
                                 topAffiliates.map(user => (
                                    <TableRow key={user.id} className="border-slate-800">
                                        <TableCell>
                                            <div className="font-bold">{user.displayName}</div>
                                            <div className="text-xs text-slate-500">{user.email}</div>
                                        </TableCell>
                                        <TableCell className="text-right font-mono font-bold text-purple-300">
                                            R$ {user.mlmBalance?.toFixed(2)}
                                        </TableCell>
                                    </TableRow>
                                )) : (
                                     <TableRow><TableCell colSpan={2} className="text-center text-slate-500">Nenhum afiliado com saldo.</TableCell></TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
            
            {/* HISTÓRICO GERAL */}
            <h3 className="text-xl font-bold mb-4 text-slate-400">Histórico de Saques Processados</h3>
            <div className="bg-slate-900 rounded-lg border border-slate-800 overflow-hidden">
                 <Table>
                    <TableHeader>
                        <TableRow className="bg-slate-950 border-slate-800"><TableHead>Data Solicitação</TableHead><TableHead>Usuário</TableHead><TableHead>Valor</TableHead><TableHead>Status</TableHead><TableHead>Tipo</TableHead></TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? <TableRow><TableCell colSpan={5} className="text-center">Carregando...</TableCell></TableRow> :
                         withdrawals.filter(w => w.status !== 'pendente').slice(0, 10).map(w => (
                            <TableRow key={w.id} className="border-slate-800">
                                <TableCell className="text-slate-400">{w.requestedAt ? format(w.requestedAt.toDate(), 'dd/MM/yyyy HH:mm', {locale: ptBR}) : '-'}</TableCell>
                                <TableCell>{w.userName}</TableCell>
                                <TableCell>R$ {w.amount?.toFixed(2)}</TableCell>
                                <TableCell><Badge variant="outline" className={getStatusBadge(w.status)}>{w.status}</Badge></TableCell>
                                <TableCell><Badge variant="secondary">{w.withdrawalType === 'mlm' ? 'Rede' : 'Pessoal'}</Badge></TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}

