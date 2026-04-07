'use client';

import { useEffect, useState } from 'react';
import Navbar from '@/components/Navbar';
import { supabaseClient } from '@/lib/supabase-client';
import { useRouter } from 'next/navigation';
import { Clock, MessageSquare, User } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

const COLUMNS = [
  {
    id: 'ABIERTO',
    label: 'Abiertos',
    dot: '#3B82F6',
    borderColor: '#DBEAFE',
    headerBg: '#F8FAFF',
    labelColor: '#1E40AF',
    badgeBg: '#DBEAFE',
    badgeColor: '#1E40AF',
  },
  {
    id: 'EN_PROCESO_INTERNO',
    label: 'En Proceso',
    dot: '#EAB308',
    borderColor: '#FEF9C3',
    headerBg: '#FFFEF5',
    labelColor: '#854D0E',
    badgeBg: '#FEF9C3',
    badgeColor: '#854D0E',
  },
  {
    id: 'EN_ESPERA_CLIENTE',
    label: 'Esperando Cliente',
    dot: '#F97316',
    borderColor: '#FFEDD5',
    headerBg: '#FFFBF8',
    labelColor: '#9A3412',
    badgeBg: '#FFEDD5',
    badgeColor: '#9A3412',
  },
  {
    id: 'CERRADO',
    label: 'Cerrados',
    dot: '#22C55E',
    borderColor: '#DCFCE7',
    headerBg: '#F8FFF9',
    labelColor: '#166534',
    badgeBg: '#DCFCE7',
    badgeColor: '#166534',
  },
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
          headers: { 'Authorization': `Bearer ${session.access_token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setTickets(data);
        } else {
          if (res.status === 401) router.push('/');
        }
      } catch (err) {
        console.error('Failed to fetch tickets', err);
      } finally {
        setLoading(false);
      }
    };
    fetchTickets();
  }, [router]);

  const getTicketsByStatus = (statusId) => tickets.filter(t => t.status === statusId);

  return (
    <>
      <Navbar />
      <main style={{
        flex: 1,
        maxWidth: '1600px',
        width: '100%',
        margin: '0 auto',
        padding: '2rem',
        background: '#F4F7F9',
        minHeight: 'calc(100vh - 56px)',
      }}>
        {/* Header */}
        <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#1A1A2E', margin: '0 0 4px', letterSpacing: '-0.5px' }}>
              Dashboard de Soporte
            </h1>
            <p style={{ fontSize: '14px', color: '#64748B', margin: 0 }}>
              Gestiona los tickets y atiende las solicitudes de los clientes.
            </p>
          </div>
        </div>

        {/* Loading */}
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '64px' }}>
            <div style={{
              width: '48px', height: '48px', borderRadius: '50%',
              border: '3px solid #E2E8F0', borderTopColor: '#003F8A',
              animation: 'spin 0.8s linear infinite',
            }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : (
          /* Kanban */
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '16px',
            height: 'calc(100vh - 200px)',
          }}>
            {COLUMNS.map(col => (
              <div key={col.id} style={{
                display: 'flex',
                flexDirection: 'column',
                background: 'white',
                borderRadius: '16px',
                border: '1px solid #E2E8F0',
                overflow: 'hidden',
              }}>
                {/* Cabecera de columna */}
                <div style={{
                  padding: '14px 16px',
                  borderBottom: `3px solid ${col.borderColor}`,
                  background: col.headerBg,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                      width: '10px', height: '10px',
                      borderRadius: '50%', background: col.dot,
                    }} />
                    <span style={{ fontWeight: '600', fontSize: '14px', color: col.labelColor }}>
                      {col.label}
                    </span>
                  </div>
                  <span style={{
                    background: col.badgeBg,
                    color: col.badgeColor,
                    fontSize: '12px',
                    fontWeight: '700',
                    padding: '2px 10px',
                    borderRadius: '999px',
                  }}>
                    {getTicketsByStatus(col.id).length}
                  </span>
                </div>

                {/* Tarjetas */}
                <div style={{
                  flex: 1,
                  overflowY: 'auto',
                  padding: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}>
                  {getTicketsByStatus(col.id).map(ticket => (
                    <div
                      key={ticket.id}
                      onClick={() => router.push(`/tickets/${ticket.id}`)}
                      style={{
                        background: 'white',
                        border: '1px solid #E2E8F0',
                        borderLeft: '3px solid #003F8A',
                        borderRadius: '12px',
                        padding: '14px',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.borderColor = '#003F8A';
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,63,138,0.1)';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.borderColor = '#E2E8F0';
                        e.currentTarget.style.borderLeftColor = '#003F8A';
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{
                          fontSize: '11px', fontFamily: 'monospace',
                          color: '#64748B', background: '#F1F5F9',
                          padding: '2px 8px', borderRadius: '6px',
                          border: '1px solid #E2E8F0',
                        }}>
                          #{ticket.id}
                        </span>
                        <span style={{ fontSize: '11px', color: '#94A3B8', display: 'flex', alignItems: 'center', gap: '3px' }}>
                          <Clock style={{ width: '11px', height: '11px' }} />
                          {formatDistanceToNow(new Date(ticket.updated_at), { addSuffix: true, locale: es })}
                        </span>
                      </div>

                      <p style={{
                        fontSize: '13px', fontWeight: '600',
                        color: '#1A1A2E', margin: '0 0 10px',
                        lineHeight: '1.4',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}>
                        {ticket.subject}
                      </p>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '11px', color: '#64748B', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <User style={{ width: '11px', height: '11px' }} />
                          {ticket.client_email.split('@')[0]}
                        </span>
                        {ticket.agent ? (
                          <span style={{
                            fontSize: '11px', color: '#003F8A',
                            background: '#E8F0FB', padding: '3px 8px',
                            borderRadius: '6px', fontWeight: '500',
                          }}>
                            {ticket.agent.full_name.split(' ')[0]}
                          </span>
                        ) : (
                          <span style={{
                            fontSize: '11px', color: '#94A3B8',
                            border: '1px dashed #CBD5E1', padding: '3px 8px',
                            borderRadius: '6px',
                          }}>
                            Sin asignar
                          </span>
                        )}
                      </div>
                    </div>
                  ))}

                  {getTicketsByStatus(col.id).length === 0 && (
                    <div style={{
                      flex: 1, display: 'flex', flexDirection: 'column',
                      alignItems: 'center', justifyContent: 'center',
                      padding: '2rem', opacity: 0.4,
                    }}>
                      <MessageSquare style={{ width: '28px', height: '28px', color: '#94A3B8' }} />
                      <p style={{ fontSize: '13px', color: '#94A3B8', margin: '6px 0 0', fontWeight: '500' }}>
                        No hay tickets
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
