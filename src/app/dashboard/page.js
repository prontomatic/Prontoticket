'use client';

import { useEffect, useState, useRef } from 'react';
import Navbar from '@/components/Navbar';
import { supabaseClient } from '@/lib/supabase-client';
import { useRouter } from 'next/navigation';
import { Clock, MessageSquare, User, Search, X, Filter, ChevronDown } from 'lucide-react';
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
  const [session, setSession] = useState(null);
  // Búsqueda
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterAssigned, setFilterAssigned] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [agents, setAgents] = useState([]);
  const searchRef = useRef(null);
  const router = useRouter();

  useEffect(() => {
    const fetchInitial = async () => {
      const { data: { session: s } } = await supabaseClient.auth.getSession();
      if (!s) { router.push('/'); return; }
      setSession(s);
      try {
        const res = await fetch('/api/tickets', {
          headers: { 'Authorization': `Bearer ${s.access_token}` }
        });
        if (res.ok) setTickets(await res.json());
        else if (res.status === 401) router.push('/');

        // Cargar agentes para el filtro (solo si el usuario no es AGENTE)
        const profileRes = await fetch('/api/profile', {
          headers: { 'Authorization': `Bearer ${s.access_token}` }
        });
        if (profileRes.ok) {
          const profile = await profileRes.json();
          if (profile.role === 'SUPERVISOR' || profile.role === 'ADMINISTRADOR') {
            const usersRes = await fetch('/api/admin/usuarios', {
              headers: { 'Authorization': `Bearer ${s.access_token}` }
            });
            if (usersRes.ok) {
              const users = await usersRes.json();
              setAgents(users.filter(u => u.is_active));
            }
          }
        }
      } catch (err) {
        console.error('Failed to fetch', err);
      } finally {
        setLoading(false);
      }
    };
    fetchInitial();
  }, [router]);

  // Cerrar dropdown al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounce de búsqueda
  useEffect(() => {
    if (!session) return;

    const hasFilters = filterStatus || filterAssigned || filterDateFrom || filterDateTo;
    if (searchQuery.trim().length < 2 && !hasFilters) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams();
        if (searchQuery.trim()) params.append('q', searchQuery.trim());
        if (filterStatus) params.append('status', filterStatus);
        if (filterAssigned) params.append('assigned_to', filterAssigned);
        if (filterDateFrom) params.append('date_from', filterDateFrom);
        if (filterDateTo) params.append('date_to', filterDateTo);

        const res = await fetch(`/api/tickets/search?${params.toString()}`, {
          headers: { 'Authorization': `Bearer ${session.access_token}` }
        });
        if (res.ok) {
          setSearchResults(await res.json());
          setShowResults(true);
        }
      } catch (err) {
        console.error('Search error', err);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, filterStatus, filterAssigned, filterDateFrom, filterDateTo, session]);

  const clearFilters = () => {
    setSearchQuery('');
    setFilterStatus('');
    setFilterAssigned('');
    setFilterDateFrom('');
    setFilterDateTo('');
    setSearchResults([]);
    setShowResults(false);
  };

  const hasActiveFilters = filterStatus || filterAssigned || filterDateFrom || filterDateTo;

  const STATUS_LABELS = {
    ABIERTO: 'Abiertos',
    EN_PROCESO_INTERNO: 'En Proceso',
    EN_ESPERA_CLIENTE: 'Esperando Cliente',
    CERRADO: 'Cerrados',
  };

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
        {/* Header con búsqueda */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '1rem' }}>
            <div>
              <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#1A1A2E', margin: '0 0 4px', letterSpacing: '-0.5px' }}>
                Dashboard de Soporte
              </h1>
              <p style={{ fontSize: '14px', color: '#64748B', margin: 0 }}>
                Gestiona los tickets y atiende las solicitudes de los clientes.
              </p>
            </div>
          </div>

          {/* Barra de búsqueda */}
          <div ref={searchRef} style={{ position: 'relative', maxWidth: '700px' }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'stretch' }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <Search style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', width: '18px', height: '18px', color: '#94A3B8' }} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onFocus={() => { if (searchResults.length > 0) setShowResults(true); }}
                  placeholder="Buscar por #ticket, asunto, email, RUT o agente..."
                  style={{
                    width: '100%', height: '44px',
                    border: '1.5px solid #E2E8F0', borderRadius: '12px',
                    padding: '0 40px 0 44px', fontSize: '14px', color: '#1A1A2E',
                    boxSizing: 'border-box', outline: 'none', background: 'white',
                    fontFamily: 'inherit',
                  }}
                  onMouseEnter={e => e.target.style.borderColor = '#CBD5E1'}
                  onMouseLeave={e => e.target.style.borderColor = '#E2E8F0'}
                />
                {(searchQuery || hasActiveFilters) && (
                  <button
                    onClick={clearFilters}
                    style={{
                      position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      width: '22px', height: '22px', borderRadius: '50%',
                      color: '#94A3B8',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#F1F5F9'; e.currentTarget.style.color = '#475569'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#94A3B8'; }}
                  >
                    <X style={{ width: '14px', height: '14px' }} />
                  </button>
                )}
              </div>
              <button
                onClick={() => setShowFilters(!showFilters)}
                style={{
                  height: '44px', padding: '0 16px',
                  background: (showFilters || hasActiveFilters) ? '#003F8A' : 'white',
                  color: (showFilters || hasActiveFilters) ? 'white' : '#475569',
                  border: '1.5px solid ' + ((showFilters || hasActiveFilters) ? '#003F8A' : '#E2E8F0'),
                  borderRadius: '12px',
                  cursor: 'pointer',
                  fontSize: '13px', fontWeight: '600',
                  display: 'flex', alignItems: 'center', gap: '6px',
                }}
              >
                <Filter style={{ width: '16px', height: '16px' }} />
                Filtros
                {hasActiveFilters && (
                  <span style={{
                    background: 'white', color: '#003F8A',
                    borderRadius: '999px', fontSize: '11px',
                    padding: '1px 6px', fontWeight: '700',
                  }}>
                    {[filterStatus, filterAssigned, filterDateFrom, filterDateTo].filter(Boolean).length}
                  </span>
                )}
              </button>
            </div>

            {/* Panel de filtros */}
            {showFilters && (
              <div style={{
                background: 'white', borderRadius: '12px',
                border: '1px solid #E2E8F0', padding: '16px',
                marginTop: '8px',
                display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '12px',
              }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: '600', color: '#64748B', display: 'block', marginBottom: '4px' }}>Estado</label>
                  <select
                    value={filterStatus}
                    onChange={e => setFilterStatus(e.target.value)}
                    style={{ width: '100%', height: '36px', border: '1.5px solid #E2E8F0', borderRadius: '8px', padding: '0 10px', fontSize: '13px', background: '#F8FAFC', boxSizing: 'border-box' }}
                  >
                    <option value="">Todos</option>
                    {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                {agents.length > 0 && (
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: '600', color: '#64748B', display: 'block', marginBottom: '4px' }}>Agente</label>
                    <select
                      value={filterAssigned}
                      onChange={e => setFilterAssigned(e.target.value)}
                      style={{ width: '100%', height: '36px', border: '1.5px solid #E2E8F0', borderRadius: '8px', padding: '0 10px', fontSize: '13px', background: '#F8FAFC', boxSizing: 'border-box' }}
                    >
                      <option value="">Todos</option>
                      <option value="unassigned">Sin asignar</option>
                      {agents.map(a => <option key={a.id} value={a.id}>{a.full_name}</option>)}
                    </select>
                  </div>
                )}
                <div>
                  <label style={{ fontSize: '12px', fontWeight: '600', color: '#64748B', display: 'block', marginBottom: '4px' }}>Desde</label>
                  <input
                    type="date"
                    value={filterDateFrom}
                    onChange={e => setFilterDateFrom(e.target.value)}
                    style={{ width: '100%', height: '36px', border: '1.5px solid #E2E8F0', borderRadius: '8px', padding: '0 10px', fontSize: '13px', background: '#F8FAFC', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: '600', color: '#64748B', display: 'block', marginBottom: '4px' }}>Hasta</label>
                  <input
                    type="date"
                    value={filterDateTo}
                    onChange={e => setFilterDateTo(e.target.value)}
                    style={{ width: '100%', height: '36px', border: '1.5px solid #E2E8F0', borderRadius: '8px', padding: '0 10px', fontSize: '13px', background: '#F8FAFC', boxSizing: 'border-box' }}
                  />
                </div>
              </div>
            )}

            {/* Dropdown de resultados */}
            {showResults && (searchResults.length > 0 || searching) && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 8px)', left: 0, right: 0,
                background: 'white', borderRadius: '12px',
                border: '1px solid #E2E8F0',
                boxShadow: '0 10px 30px rgba(0,0,0,0.12)',
                maxHeight: '400px', overflowY: 'auto',
                zIndex: 50,
              }}>
                {searching ? (
                  <div style={{ padding: '20px', textAlign: 'center', fontSize: '13px', color: '#64748B' }}>Buscando...</div>
                ) : (
                  <>
                    <div style={{ padding: '8px 16px', fontSize: '11px', fontWeight: '600', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', background: '#F8FAFC', borderBottom: '1px solid #F1F5F9' }}>
                      {searchResults.length} resultado{searchResults.length !== 1 ? 's' : ''}
                    </div>
                    {searchResults.map(ticket => (
                      <div
                        key={ticket.id}
                        onClick={() => { setShowResults(false); router.push(`/tickets/${ticket.id}`); }}
                        style={{ padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid #F1F5F9' }}
                        onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'}
                        onMouseLeave={e => e.currentTarget.style.background = 'white'}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '11px', fontFamily: 'monospace', color: '#64748B', background: '#F1F5F9', padding: '2px 8px', borderRadius: '6px' }}>
                              #{ticket.id}
                            </span>
                            <span style={{ fontSize: '11px', fontWeight: '600', color: '#475569' }}>
                              {STATUS_LABELS[ticket.status] || ticket.status}
                            </span>
                          </div>
                          <span style={{ fontSize: '11px', color: '#94A3B8' }}>
                            {formatDistanceToNow(new Date(ticket.updated_at), { addSuffix: true, locale: es })}
                          </span>
                        </div>
                        <p style={{ fontSize: '13px', fontWeight: '600', color: '#1A1A2E', margin: '0 0 2px', lineHeight: '1.3' }}>
                          {ticket.subject}
                        </p>
                        <p style={{ fontSize: '12px', color: '#64748B', margin: 0 }}>
                          {ticket.client_name ? `${ticket.client_name} · ${ticket.client_email}` : ticket.client_email}
                          {ticket.agent && <span> · Asignado a {ticket.agent.full_name}</span>}
                        </p>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}

            {/* Mensaje sin resultados */}
            {showResults && !searching && searchResults.length === 0 && (searchQuery.length >= 2 || hasActiveFilters) && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 8px)', left: 0, right: 0,
                background: 'white', borderRadius: '12px',
                border: '1px solid #E2E8F0',
                boxShadow: '0 10px 30px rgba(0,0,0,0.12)',
                padding: '20px', textAlign: 'center',
                fontSize: '13px', color: '#64748B',
                zIndex: 50,
              }}>
                No se encontraron tickets que coincidan con la búsqueda.
              </div>
            )}
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
                        <span style={{ fontSize: '11px', color: '#64748B', display: 'flex', alignItems: 'center', gap: '4px', minWidth: 0, flex: 1, marginRight: '8px' }}>
                          <User style={{ width: '11px', height: '11px', flexShrink: 0 }} />
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {ticket.client_name || ticket.client_email.split('@')[0]}
                          </span>
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
