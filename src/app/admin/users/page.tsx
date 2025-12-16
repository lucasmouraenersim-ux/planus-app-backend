
"use client";

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, updateDoc, onSnapshot } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Check, X, Eye, FileText, User as UserIcon, AlertTriangle, ExternalLink, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';

export default function AdminUsersApprovalPage() {
    const { userAppRole, isLoadingAuth } = useAuth();
    const [pendingUsers, setPendingUsers] = useState<any[]>([]);
    const [selectedUser, setSelectedUser] = useState<any>(null);
    const [rejectionReason, setRejectionReason] = useState('');
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        if (isLoadingAuth || (userAppRole !== 'admin' && userAppRole !== 'superadmin')) {
            if (!isLoadingAuth) setLoading(false);
            return;
        }

        const q = query(collection(db, 'users'), where('status', '==', 'pending_approval'));
        const unsubscribe = onSnapshot(q, (snap) => {
            setPendingUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            setLoading(false);
        });

        return () => unsubscribe();
    }, [userAppRole, isLoadingAuth]);

    const handleDecision = async (status: 'approved' | 'rejected') => {
        if (!selectedUser) return;

        if (status === 'rejected' && !rejectionReason.trim()) {
            toast({ title: "Motivo obrigatório", description: "Por favor, informe o motivo da reprovação.", variant: "destructive" });
            return;
        }

        setIsSubmitting(true);
        try {
            await updateDoc(doc(db, 'users', selectedUser.id), {
                status: status,
                adminNotes: status === 'rejected' ? rejectionReason.trim() : null,
                approvedAt: status === 'approved' ? new Date().toISOString() : null
            });
            
            toast({ 
                title: status === 'approved' ? 'Usuário Aprovado!' : 'Usuário Reprovado',
                className: status === 'approved' ? 'bg-green-600 text-white border-none' : 'bg-red-600 text-white border-none'
            });
            
            setSelectedUser(null);
            setRejectionReason('');
            // A lista será atualizada automaticamente pelo onSnapshot
        } catch (error) {
            console.error(error);
            toast({ title: "Erro ao processar", variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-screen bg-slate-950">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    if (userAppRole !== 'admin' && userAppRole !== 'superadmin') {
        return (
            <div className="p-8 text-center text-red-500">
                Acesso negado. Apenas administradores podem ver esta página.
            </div>
        );
    }

    return (
        <div className="p-4 md:p-8 bg-slate-950 min-h-screen text-white">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2">Aprovação de Cadastros (KYC)</h1>
                    <p className="text-slate-400">Valide documentos e selfies para liberar acesso à plataforma.</p>
                </div>
                <Badge variant="outline" className="text-base px-4 py-1 border-yellow-500 text-yellow-500">
                    {pendingUsers.length} Pendentes
                </Badge>
            </div>
            
            <div className="grid gap-4">
                {pendingUsers.length === 0 && (
                     <div className="text-center py-20 bg-slate-900/50 rounded-xl border border-dashed border-slate-800">
                        <UserIcon className="w-12 h-12 mx-auto text-slate-700 mb-4" />
                        <p className="text-slate-500 text-lg">Nenhum usuário aguardando aprovação.</p>
                    </div>
                )}
                
                {pendingUsers.map(user => (
                    <div key={user.id} className="bg-slate-900 p-6 rounded-xl border border-white/5 hover:border-white/10 transition-all flex justify-between items-center group">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-xl font-bold text-slate-500 group-hover:bg-cyan-900 group-hover:text-cyan-400 transition-colors">
                                {user.displayName?.charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <h3 className="text-white font-bold text-lg flex items-center gap-2">
                                    {user.displayName}
                                    <Badge variant="secondary" className="text-[10px] bg-slate-800 text-slate-400 border-none">PENDENTE</Badge>
                                </h3>
                                <p className="text-slate-400 text-sm">{user.email}</p>
                                <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                                    <AlertTriangle className="w-3 h-3 text-yellow-600" />
                                    Enviado em: {user.kycSubmittedAt ? new Date(user.kycSubmittedAt).toLocaleString('pt-BR') : 'Data desconhecida'}
                                </p>
                            </div>
                        </div>
                        <Button onClick={() => setSelectedUser(user)} className="bg-cyan-600 hover:bg-cyan-500 shadow-lg shadow-cyan-900/20">
                            <Eye className="w-4 h-4 mr-2" /> Analisar Documentos
                        </Button>
                    </div>
                ))}
            </div>

            {selectedUser && (
                <Dialog open={!!selectedUser} onOpenChange={() => {setSelectedUser(null); setRejectionReason('');}}>
                    <DialogContent className="bg-slate-950 border-slate-800 max-w-4xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle className="text-xl font-bold text-white mb-4">Análise de: {selectedUser.displayName}</DialogTitle>
                        </DialogHeader>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* DOCUMENTO */}
                            <div className="bg-slate-900 p-4 rounded-xl border border-white/10">
                                <h3 className="text-white font-bold mb-3 flex items-center gap-2 border-b border-white/5 pb-2">
                                    <FileText className="w-4 h-4 text-cyan-500"/> Documento de Identidade
                                </h3>
                                <div className="aspect-[4/3] bg-black rounded-lg border border-slate-800 overflow-hidden relative group">
                                    <img src={selectedUser.documentUrl} alt="Doc" className="w-full h-full object-contain" />
                                    <a href={selectedUser.documentUrl} target="_blank" rel="noopener noreferrer" className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white font-bold transition-opacity">
                                        <ExternalLink className="w-6 h-6 mr-2" /> Abrir Original
                                    </a>
                                </div>
                            </div>

                            {/* SELFIE */}
                            <div className="bg-slate-900 p-4 rounded-xl border border-white/10">
                                <h3 className="text-white font-bold mb-3 flex items-center gap-2 border-b border-white/5 pb-2">
                                    <UserIcon className="w-4 h-4 text-cyan-500"/> Selfie de Validação
                                </h3>
                                <div className="aspect-[4/3] bg-black rounded-lg border border-slate-800 overflow-hidden relative group">
                                    <img src={selectedUser.selfieUrl} alt="Selfie" className="w-full h-full object-contain" />
                                    <a href={selectedUser.selfieUrl} target="_blank" rel="noopener noreferrer" className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white font-bold transition-opacity">
                                        <ExternalLink className="w-6 h-6 mr-2" /> Abrir Original
                                    </a>
                                </div>
                            </div>
                        </div>

                        {/* ÁREA DE REJEIÇÃO */}
                        <div className="mt-6 p-4 bg-red-950/10 border border-red-900/30 rounded-lg">
                            <Label htmlFor="reason" className="text-red-400 font-bold mb-2 block">Motivo da Reprovação (Obrigatório se reprovar)</Label>
                            <Textarea 
                                id="reason"
                                placeholder="Ex: Documento ilegível, Selfie não corresponde ao documento..." 
                                value={rejectionReason}
                                onChange={e => setRejectionReason(e.target.value)}
                                className="bg-slate-900 border-red-900/30 text-white min-h-[80px]"
                            />
                        </div>

                        <DialogFooter className="flex justify-between items-center mt-4 border-t border-white/10 pt-4">
                            <Button variant="ghost" onClick={() => setSelectedUser(null)} className="text-slate-500">Cancelar</Button>
                            <div className="flex gap-3">
                                <Button 
                                    variant="destructive" 
                                    onClick={() => handleDecision('rejected')}
                                    disabled={loading || !rejectionReason.trim()}
                                    title={!rejectionReason.trim() ? "Escreva um motivo para reprovar" : ""}
                                >
                                    {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin"/>}
                                    <X className="w-4 h-4 mr-2" /> Reprovar
                                </Button>
                                <Button 
                                    className="bg-green-600 hover:bg-green-500 text-white font-bold px-6" 
                                    onClick={() => handleDecision('approved')}
                                    disabled={loading}
                                >
                                    {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin"/>}
                                    <Check className="w-4 h-4 mr-2" /> APROVAR ACESSO
                                </Button>
                            </div>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}
        </div>
    );
}
