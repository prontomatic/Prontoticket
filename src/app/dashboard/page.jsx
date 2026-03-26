'use client';

import { useEffect, useState } from 'react';
import Navbar from '@/components/Navbar';
import { supabaseClient } from '@/lib/supabase-client';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Clock, MessageSquare, User } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

const COLUMNS = [
  { id: 'ABIERTO', label: 'Abiertos', color: 'bg-blue-500/10 text-blue-700 border-blue-200', dot: 'bg-blue-500' },
  { id: 'EN_PROCESO_INTERNO', label: 'En Proceso', color: 'bg-amber-500/10 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
  { id: 'EN_ESPERA_CLIENTE', label: 'Esperando Cliente', color: 'bg-purple-500/10 text-purple-700 border-purple-200', dot: 'bg-purple-500' },
  { id: 'CERRADO', label: 'Cerrados', color: 'bg-slate-500/10 text-slate-700 border-slate-200', dot: 'bg-slate-500' }
];

export default function DashboardPage() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const fetchTickets = async () => {
      const { data: { session } } = await supabaseClient.auth.getSession();
      if (!session) {
        router.push('/');
        return;
      }
      
      try {
        const res = await fetch('/api/tickets', {
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        });
        if (res.ok) {
          const data = await res.json();
          setTickets(data);
        } else {
            if(res.status === 401) router.push('/');
        }
      } catch (err) {
        console.error('Failed to fetch tickets', err);
      } finally {
        setLoading(false);
      }
    };

    fetchTickets();
  }, [router]);

  const getTicketsByStatus = (statusId) => {
    return tickets.filter(t => t.status === statusId);
  };

  return (
    <>
      <Navbar />
      <main className="flex-1 max-w-[1600px] w-full mx-auto p-4 sm:p-6 lg:p-8">
        <div className="mb-8 flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Dashboard de Soporte</h1>
            <p className="text-slate-500 mt-1">Gestiona los tickets y atiende las solicitudes de los clientes.</p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
             <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 h-[calc(100vh-220px)] overflow-hidden">
            {COLUMNS.map(col => (
              <div key={col.id} className="flex flex-col bg-slate-100/50 backdrop-blur-sm rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                <div className="p-4 border-b border-slate-200 bg-white/50 flex justify-between items-center sticky top-0 z-10">
                  <div className="flex items-center space-x-2">
                    <div className={`h-2.5 w-2.5 rounded-full ${col.dot}`}></div>
                    <h2 className="font-semibold text-slate-800">{col.label}</h2>
                  </div>
                  <Badge variant="secondary" className={`${col.color} border px-2.5 py-0.5 rounded-full font-bold`}>
                    {getTicketsByStatus(col.id).length}
                  </Badge>
                </div>
                
                <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
                  {getTicketsByStatus(col.id).map(ticket => (
                    <Card 
                      key={ticket.id} 
                      className="cursor-pointer hover:shadow-md hover:border-orange-300 transition-all duration-200 border-slate-200 bg-white group hover:-translate-y-1"
                      onClick={() => router.push(`/tickets/${ticket.id}`)}
                    >
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start mb-2">
                          <Badge variant="outline" className="text-xs font-mono text-slate-500 border-slate-200 bg-slate-50">
                            #{ticket.id}
                          </Badge>
                          <span className="text-xs text-slate-400 flex items-center">
                            <Clock className="w-3 h-3 mr-1" />
                            {formatDistanceToNow(new Date(ticket.updated_at), { addSuffix: true, locale: es })}
                          </span>
                        </div>
                        <h3 className="font-medium text-slate-900 text-sm line-clamp-2 leading-tight group-hover:text-orange-700 transition-colors">
                          {ticket.subject}
                        </h3>
                        
                        <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
                           <div className="flex items-center truncate max-w-[120px]">
                              <User className="h-3.5 w-3.5 mr-1.5 opacity-70" />
                              <span className="truncate">{ticket.client_email.split('@')[0]}</span>
                           </div>
                           {ticket.agent ? (
                             <div className="flex items-center bg-orange-50 text-orange-700 px-2 py-1 rounded-md border border-orange-100">
                               <span className="truncate max-w-[80px] font-medium">{ticket.agent.full_name.split(' ')[0]}</span>
                             </div>
                           ) : (
                             <Badge variant="outline" className="border-dashed font-normal text-slate-400 bg-transparent">
                               Sin asignar
                             </Badge>
                           )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  
                  {getTicketsByStatus(col.id).length === 0 && (
                    <div className="flex flex-col items-center justify-center p-8 text-center h-full opacity-50">
                      <MessageSquare className="h-8 w-8 text-slate-400 mb-2" />
                      <p className="text-sm tracking-tight text-slate-500 font-medium">No hay tickets</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
      
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
      `}} />
    </>
  );
}
