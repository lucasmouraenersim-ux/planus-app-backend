
"use client";

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, updateDoc, onSnapshot } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Check, X, Eye, FileText, User as UserIcon, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Textarea } from '@/components/ui/textarea';

export default function AdminUsersApprovalPage() {
    const { userAppRole, isLoadingAuth } = useAuth();
    const [pendingUsers, setPendingUsers] = useState<any[]>([]);
    const [selectedUser, setSelectedUser] = useState<any>(null);
    const [rejectionReason, setRejectionReason] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const { toast } = useToast();

    useEffect(() => {
        if (isLoadingAuth || (userAppRole !== 'admin' && userAppRole !== 'superadmin')) {
            if (!isLoadingAuth) setIsLoading(false);
            return;
        }

        const q = query(collection(db, 'users'), where('status', '==', 'pending_approval'));
        const unsubscribe = onSnapshot(q, (snap) => {
            setPendingUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [userAppRole, isLoadingAuth]);

    const handleDecision = async (status: 'approved' | 'rejected') => {
        if (!selectedUser) return;
        
        const updateData: any = { status };
        if (status === 'rejected') {
            if (!rejectionReason.trim()) {
                toast({ title: "Motivo obrigatório", description: "Por favor, informe o motivo da reprovação.", variant: "destructive" });
                return;
            }
            updateData.adminNotes = rejectionReason.trim();
        } else {
            updateData.adminNotes = null; // Clear notes on approval
        }

        await updateDoc(doc(db, 'users', selectedUser.id), updateData);
        toast({ title: status === 'approved' ? 'Usuário Aprovado!' : 'Usuário Reprovado' });
        
        setSelectedUser(null);
        setRejectionReason('');
    };

    if (isLoading) {
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
            <h1 className="text-3xl font-bold text-white mb-6">Aprovação de Usuários (KYC)</h1>
            
            <div className="grid gap-4">
                {pendingUsers.length === 0 && (
                    <div className="text-center py-16 border-2 border-dashed border-slate-800 rounded-2xl">
                        <Check className="w-12 h-12 text-green-500 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-slate-300">Tudo em ordem!</h3>
                        <p className="text-slate-500">Nenhum usuário pendente de aprovação no momento.</p>
                    </div>
                )}
                
                {pendingUsers.map(user => (
                    <div key={user.id} className="bg-slate-900 p-4 rounded-xl border border-white/10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                            <h3 className="text-white font-bold">{user.displayName}</h3>
                            <p className="text-slate-400 text-sm">{user.email}</p>
                            <p className="text-xs text-slate-500 mt-1">Enviado em: {user.kycSubmittedAt ? new Date(user.kycSubmittedAt).toLocaleString('pt-BR') : 'N/A'}</p>
                        </div>
                        <Button onClick={() => setSelectedUser(user)} className="bg-cyan-600 hover:bg-cyan-500 w-full sm:w-auto">
                            <Eye className="w-4 h-4 mr-2" /> Analisar
                        </Button>
                    </div>
                ))}
            </div>

            {selectedUser && (
                <Dialog open={!!selectedUser} onOpenChange={() => { setSelectedUser(null); setRejectionReason(''); }}>
                    <DialogContent className="bg-slate-900 border-slate-800 max-w-4xl text-white">
                         <DialogHeader>
                            <DialogTitle>Analisar Documentos de: {selectedUser.displayName}</DialogTitle>
                            <DialogDescription>
                                Verifique se a selfie corresponde ao documento e se as informações estão legíveis.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
                            <div>
                                <h3 className="text-white mb-2 flex items-center gap-2"><FileText className="w-4 h-4"/> Documento</h3>
                                <div className="h-64 bg-black rounded border border-white/10 overflow-hidden">
                                    <img src={selectedUser.documentUrl} alt="Doc" className="w-full h-full object-contain" />
                                </div>
                                <a href={selectedUser.documentUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-cyan-500 underline mt-1 block">Abrir Original</a>
                            </div>
                            <div>
                                <h3 className="text-white mb-2 flex items-center gap-2"><UserIcon className="w-4 h-4"/> Selfie</h3>
                                <div className="h-64 bg-black rounded border border-white/10 overflow-hidden">
                                    <img src={selectedUser.selfieUrl} alt="Selfie" className="w-full h-full object-contain" />
                                </div>
                                <a href={selectedUser.selfieUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-cyan-500 underline mt-1 block">Abrir Original</a>
                            </div>
                        </div>

                         <div className="space-y-2">
                             <Label htmlFor="rejectionReason" className="text-red-400">Motivo da Reprovação (se aplicável)</Label>
                             <Textarea 
                                id="rejectionReason" 
                                value={rejectionReason}
                                onChange={(e) => setRejectionReason(e.target.value)}
                                placeholder="Ex: Foto do documento ilegível, selfie não corresponde ao documento..."
                                className="bg-slate-800 border-slate-700"
                            />
                         </div>

                        <div className="flex justify-end gap-3 mt-6">
                            <Button variant="destructive" onClick={() => handleDecision('rejected')}>
                                <X className="w-4 h-4 mr-2" /> Reprovar
                            </Button>
                            <Button className="bg-green-600 hover:bg-green-500 text-white" onClick={() => handleDecision('approved')}>
                                <Check className="w-4 h-4 mr-2" /> Aprovar Acesso
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            )}
        </div>
    );
}
