
"use client";

import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, limit, onSnapshot, where } from 'firebase/firestore';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { 
  Eye, Clock, Lock, FilePlus, Upload, CreditCard, Activity 
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const ACTION_CONFIG: any = {
  'PAGE_VIEW': { icon: Eye, color: 'text-slate-400', label: 'Acessou a Página' },
  'TIME_ON_PAGE': { icon: Clock, color: 'text-blue-400', label: 'Sessão Finalizada' },
  'UNLOCK_LEAD': { icon: Lock, color: 'text-emerald-400', label: 'Desbloqueou Lead' },
  'CREATE_LEAD': { icon: FilePlus, color: 'text-cyan-400', label: 'Criou Novo Lead' },
  'UPLOAD_INVOICE': { icon: Upload, color: 'text-purple-400', label: 'Processou Fatura' },
  'OPEN_CREDIT_MODAL': { icon: CreditCard, color: 'text-yellow-400', label: 'Intenção de Recarga' },
};

export default function ActivityFeed() {
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    // Busca os últimos 50 eventos em tempo real
    const q = query(
        collection(db, 'system_activity_logs'), 
        orderBy('timestamp', 'desc'), 
        limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => unsubscribe();
  }, []);

  return (
    <div className="bg-slate-900/30 border border-white/5 rounded-2xl overflow-hidden flex flex-col backdrop-blur-sm animate-in fade-in slide-in-from-bottom-10 duration-1000 h-[400px]">
      <div className="p-4 border-b border-white/5 bg-slate-950/50 flex justify-between items-center">
        <h3 className="font-bold text-white flex items-center gap-2">
            <Activity className="w-4 h-4 text-cyan-500" />
            Monitoramento em Tempo Real
        </h3>
        <Badge variant="outline" className="border-slate-700 text-slate-400">Ao Vivo</Badge>
      </div>
      
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {logs.map((log) => {
            const config = ACTION_CONFIG[log.action] || { icon: Activity, color: 'text-gray-400', label: log.action };
            const Icon = config.icon;
            
            return (
              <div key={log.id} className="flex gap-3 text-sm border-l-2 border-slate-800 pl-3 pb-1 relative group">
                <div className={`mt-0.5 ${config.color}`}>
                   <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1">
                   <div className="flex justify-between">
                      <span className="font-bold text-slate-200">{log.userName}</span>
                      <span className="text-xs text-slate-500">
                        {log.timestamp ? formatDistanceToNow(log.timestamp.toDate(), { addSuffix: true, locale: ptBR }) : 'Agora'}
                      </span>
                   </div>
                   
                   <p className="text-slate-400 text-xs mt-0.5">{config.label}</p>
                   
                   {/* Detalhes Específicos */}
                   <div className="mt-1 text-xs text-slate-500 font-mono bg-slate-950/50 p-1.5 rounded border border-slate-800/50">
                      {log.action === 'UNLOCK_LEAD' && (
                        <>Lead: <span className="text-white">{log.details?.leadName}</span> • Custo: {log.details?.cost}cr</>
                      )}
                      {log.action === 'TIME_ON_PAGE' && (
                        <>Duração: <span className="text-white">{log.details?.formatted}</span></>
                      )}
                      {log.action === 'UPLOAD_INVOICE' && (
                        <>Arquivo: {log.details?.fileName} • IA: {log.details?.iaDetectedTensao}</>
                      )}
                       {log.action === 'OPEN_CREDIT_MODAL' && (
                        <>Saldo no momento: {log.details?.currentBalance}cr</>
                      )}
                      {!['UNLOCK_LEAD', 'TIME_ON_PAGE', 'UPLOAD_INVOICE', 'OPEN_CREDIT_MODAL'].includes(log.action) && (
                        JSON.stringify(log.details || {}).slice(0, 50)
                      )}
                   </div>
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
