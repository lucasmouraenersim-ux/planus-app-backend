"use client";

import { useEffect, useState } from 'react';
import { 
  FileText, Search, Download, Calendar, User, Zap, Eye, Loader2 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import { collection, query, orderBy, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { format } from 'date-fns';

export default function AdminProposalsPage() {
  const [proposals, setProposals] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'proposals'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setProposals(data);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const filteredProposals = proposals.filter(p => 
    p.clienteNome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.proposalNumber?.toString().includes(searchTerm)
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-300 p-8 font-sans">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-2">
            <FileText className="w-8 h-8 text-cyan-500" /> Histórico de Propostas
          </h1>
          <p className="text-slate-400">Todas as simulações geradas pela equipe.</p>
        </div>
        <div className="bg-slate-900 border border-white/10 px-4 py-2 rounded-lg">
            <span className="text-xs text-slate-500 uppercase font-bold">Total Gerado</span>
            <div className="text-2xl font-bold text-white">{proposals.length}</div>
        </div>
      </div>

      <div className="bg-slate-900/50 border border-white/5 rounded-xl overflow-hidden backdrop-blur-sm">
        <div className="p-4 border-b border-white/5">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
            <Input 
              placeholder="Buscar por cliente ou número..." 
              className="pl-10 bg-slate-800 border-white/10 text-white"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {loading ? <div className="p-8 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-cyan-500"/></div> : 
        <Table>
          <TableHeader className="bg-slate-900">
            <TableRow className="border-white/5 hover:bg-transparent">
              <TableHead className="text-slate-400"># ID</TableHead>
              <TableHead className="text-slate-400">Data</TableHead>
              <TableHead className="text-slate-400">Cliente</TableHead>
              <TableHead className="text-slate-400">Gerado Por</TableHead>
              <TableHead className="text-slate-400">Consumo</TableHead>
              <TableHead className="text-slate-400">Desconto</TableHead>
              <TableHead className="text-right text-slate-400">Anexo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredProposals.map((prop) => (
              <TableRow key={prop.id} className="border-white/5 hover:bg-white/5">
                <TableCell className="font-mono text-cyan-400 font-bold">#{prop.proposalNumber}</TableCell>
                <TableCell>
                    <div className="flex items-center gap-2 text-xs">
                        <Calendar className="w-3 h-3 text-slate-500" />
                        {prop.createdAt?.seconds ? format(new Date(prop.createdAt.seconds * 1000), 'dd/MM HH:mm') : '-'}
                    </div>
                </TableCell>
                <TableCell>
                    <div className="font-medium text-white">{prop.clienteNome}</div>
                    <div className="text-xs text-slate-500">{prop.clienteTelefone}</div>
                </TableCell>
                <TableCell>
                    <div className="flex items-center gap-2">
                        <User className="w-3 h-3 text-slate-500" />
                        <span className="text-sm">{prop.generatorName}</span>
                    </div>
                </TableCell>
                <TableCell>
                    <Badge variant="outline" className="border-yellow-500/30 text-yellow-500 bg-yellow-500/10">
                        <Zap className="w-3 h-3 mr-1" /> {prop.item1Quantidade} kWh
                    </Badge>
                </TableCell>
                <TableCell><span className="font-bold text-emerald-400">{prop.desconto}%</span></TableCell>
                <TableCell className="text-right">
                   {prop.pdfUrl ? (
                       <a href={prop.pdfUrl} target="_blank" className="inline-flex items-center gap-1 text-xs text-cyan-400 hover:underline">
                           <Download className="w-3 h-3" /> Fatura
                       </a>
                   ) : <span className="text-slate-600 text-xs">Sem anexo</span>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>}
      </div>
    </div>
  );
}
