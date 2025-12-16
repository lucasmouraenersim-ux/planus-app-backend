import React, { useState, useEffect } from 'react';
import { db } from "@/lib/firebase"; // Ajuste o import conforme seu projeto
import { collection, query, orderBy, getDocs } from "firebase/firestore";
import { Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface EventData {
  id: string;
  eventType: string;
  userName: string;
  userEmail: string;
  timestamp: { toDate: () => Date };
  page: string;
}

export default function PartnersAnalytics() {
  const [events, setEvents] = useState<EventData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEvents = async () => {
      setLoading(true);
      try {
        const q = query(collection(db, "user_events"), orderBy("timestamp", "desc"));
        const querySnapshot = await getDocs(q);
        const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as EventData));
        setEvents(data);
      } catch (error) {
        console.error("Failed to fetch events:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, []);

  const stats = {
    total: events.length,
    faturas: events.filter(e => e.eventType === 'INVOICE_PROCESSED').length,
    leads: events.filter(e => e.eventType === 'LEAD_CREATED').length,
    unlocked: events.filter(e => e.eventType === 'LEAD_UNLOCKED').length
  };

  const getColor = (type: string) => {
    switch(type) {
      case 'INVOICE_PROCESSED': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'LEAD_UNLOCKED': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      case 'LEAD_CREATED': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      case 'LEAD_VIEWED': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      default: return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    }
  }

  const StatCard = ({ title, value, color }: { title: string, value: number, color: string }) => (
    <div className={`${color} p-4 rounded-xl shadow-lg border border-white/5`}>
      <p className="text-sm opacity-80">{title}</p>
      <p className="text-3xl font-bold">{value}</p>
    </div>
  );

  return (
    <div className="p-6 bg-slate-950/50 text-white rounded-lg">
      <h2 className="text-2xl font-bold mb-6 text-primary">📊 Analytics de Parceiros</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard title="Total Interações" value={stats.total} color="bg-blue-900/50" />
        <StatCard title="Faturas Processadas" value={stats.faturas} color="bg-green-900/50" />
        <StatCard title="Leads Criados" value={stats.leads} color="bg-purple-900/50" />
        <StatCard title="Leads Desbloqueados" value={stats.unlocked} color="bg-orange-900/50" />
      </div>

      <div className="bg-slate-900 rounded-lg overflow-hidden border border-white/10">
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-800">
              <tr>
                <th className="p-3 text-xs font-semibold uppercase text-slate-400">Parceiro</th>
                <th className="p-3 text-xs font-semibold uppercase text-slate-400">Evento</th>
                <th className="p-3 text-xs font-semibold uppercase text-slate-400">Data</th>
                <th className="p-3 text-xs font-semibold uppercase text-slate-400">Página</th>
              </tr>
            </thead>
            <tbody>
              {events.map(event => (
                <tr key={event.id} className="border-t border-slate-800 hover:bg-slate-800/50">
                  <td className="p-3 font-medium text-slate-200">{event.userName} <br/><span className="text-xs text-slate-500">{event.userEmail}</span></td>
                  <td className="p-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold border ${getColor(event.eventType)}`}>
                      {event.eventType.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="p-3 text-sm text-slate-400">
                    {event.timestamp?.toDate().toLocaleString('pt-BR')}
                  </td>
                  <td className="p-3 text-xs text-slate-500 font-mono">{event.page}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
