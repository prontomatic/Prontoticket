'use client';

import { useEffect, useState, useRef } from 'react';
import Navbar from '@/components/Navbar';
import { supabaseClient } from '@/lib/supabase-client';
import { useRouter } from 'next/navigation';
import { Clock, MessageSquare, User, Search, X, SlidersHorizontal, Inbox, Sparkles } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { colors, shadows, radius, transitions, typography, stringToColor } from '@/lib/design-tokens';

const COLUMNS = [
  { id: 'ABIERTO', label: 'Abiertos', style: colors.statusAbierto },
  { id: 'EN_PROCESO_INTERNO', label: 'En Proceso', style: colors.statusEnProceso },
  { id: 'EN_ESPERA_CLIENTE', label: 'Esperando Cliente', style: colors.statusEnEspera },
  { id: 'CERRADO', label: 'Cerrados', style: colors.statusCerrado },
];

const STATUS_LABELS = {
  ABIERTO: 'Abiertos',
  EN_PROCESO_INTERNO: 'En Proceso',
  EN_ESPERA_CLIENTE: 'Esperando Cliente',
  CERRADO: 'Cerrados',
};

export default function DashboardPage() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);
  const [period, setPeriod] = useState('30d'); // '30d' (default) | 'all'
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

  // Función reutilizable de fetch de tickets (se llama al inicio y al cambiar el período)
  const fetchTickets = async (accessToken, periodValue) => {
    try {
      const res = await fetch(`/api/tickets?period=${periodValue}`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      if (res.ok) setTickets(await res.json());
      else if (res.status === 401) router.push('/');
    } catch (err) {
      console.error('Failed to fetch tickets', err);
    }
  };

  useEffect(() => {
    const fetchInitial = async () => {
      const { data: { session: s } } = await supabaseClient.auth.getSession();
      if (!s) { router.push('/'); return; }
      setSession(s);
      try {
        await fetchTickets(s.access_token, period);

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
      } catch (err) { console.error('Failed to fetch', err); }
      finally { setLoading(false); }
    };
    fetchInitial();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  // Refetch cuando cambia el período (sin volver a hacer todo el setup inicial)
  useEffect(() => {
    if (!session) return;
    setLoading(true);
    fetchTickets(session.access_token, period).finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) setShowResults(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
      } catch (err) { console.error('Search error', err); }
      finally { setSearching(false); }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, filterStatus, filterAssigned, filterDateFrom, filterDateTo, session]);

  const clearFilters = () => {
    setSearchQuery(''); setFilterStatus(''); setFilterAssigned('');
    setFilterDateFrom(''); setFilterDateTo('');
    setSearchResults([]); setShowResults(false);
  };

  const hasActiveFilters = filterStatus || filterAssigned || filterDateFrom || filterDateTo;
  const getTicketsByStatus = (statusId) => tickets.filter(t => t.status === statusId);
  const totalTickets = tickets.length;

  return (
    <>
      <Navbar />
      <main style={{
        flex: 1,
        width: '100%',
        margin: '0 auto',
        padding: '2rem',
        maxWidth: '1600px',
        background: colors.bg,
        minHeight: 'calc(100vh - 60px)',
      }}>
        {/* Fondo decorativo sutil */}
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, height: '240px',
          background: `linear-gradient(180deg, ${colors.primarySoft}30 0%, ${colors.bg}00 100%)`,
          pointerEvents: 'none',
          zIndex: 0,
        }} />

        <div style={{ position: 'relative', zIndex: 1 }}>
          {/* Header */}
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '1.25rem' }}>
              <div>
                <h1 style={{
                  fontSize: '28px',
                  fontWeight: typography.weight.extrabold,
                  color: colors.textPrimary,
                  margin: '0 0 6px',
                  letterSpacing: typography.trackingTighter,
                }}>
                  Dashboard de Soporte
                </h1>
                <p style={{ fontSize: '14px', color: colors.textMuted, margin: 0 }}>
                  {totalTickets > 0
                    ? `Mostrando ${totalTickets} ticket${totalTickets !== 1 ? 's' : ''} (${period === '30d' ? 'últimos 30 días' : 'todos'}).`
                    : 'Sin tickets en el período seleccionado.'}
                </p>
              </div>

              {/* Toggle de período */}
              <div style={{
                display: 'flex',
                gap: '4px',
                background: colors.surfaceAlt,
                padding: '4px',
                borderRadius: radius.md,
                border: `1px solid ${colors.border}`,
              }}>
                <button
                  onClick={() => setPeriod('30d')}
                  style={{
                    padding: '6px 14px',
                    fontSize: '12px',
                    fontWeight: typography.weight.semibold,
                    background: period === '30d' ? colors.surface : 'transparent',
                    color: period === '30d' ? colors.textPrimary : colors.textMuted,
                    border: 'none',
                    borderRadius: radius.sm,
                    cursor: 'pointer',
                    transition: transitions.fast,
                    boxShadow: period === '30d' ? shadows.xs : 'none',
                  }}
                >
                  Últimos 30 días
                </button>
                <button
                  onClick={() => setPeriod('all')}
                  style={{
                    padding: '6px 14px',
                    fontSize: '12px',
                    fontWeight: typography.weight.semibold,
                    background: period === 'all' ? colors.surface : 'transparent',
                    color: period === 'all' ? colors.textPrimary : colors.textMuted,
                    border: 'none',
                    borderRadius: radius.sm,
                    cursor: 'pointer',
                    transition: transitions.fast,
                    boxShadow: period === 'all' ? shadows.xs : 'none',
                  }}
                >
                  Todos
                </button>
              </div>
            </div>

            {/* Barra de búsqueda */}
            <div ref={searchRef} style={{ position: 'relative', maxWidth: '720px' }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'stretch' }}>
                <div style={{ flex: 1, position: 'relative' }}>
                  <Search style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', width: '18px', height: '18px', color: colors.textPlaceholder }} />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    onFocus={() => { if (searchResults.length > 0) setShowResults(true); }}
                    placeholder="Buscar por #ticket, asunto, email, RUT o agente..."
                    style={{
                      width: '100%', height: '46px',
                      border: `1.5px solid ${colors.border}`,
                      borderRadius: radius.md,
                      padding: '0 40px 0 46px',
                      fontSize: '14px', color: colors.textPrimary,
                      boxSizing: 'border-box', outline: 'none',
                      background: colors.surface,
                      fontFamily: 'inherit',
                      boxShadow: shadows.xs,
                      transition: transitions.base,
                    }}
                    onMouseEnter={e => e.target.style.borderColor = colors.borderStrong}
                    onMouseLeave={e => e.target.style.borderColor = colors.border}
                    onBlur={e => e.target.style.borderColor = colors.border}
                  />
                  {(searchQuery || hasActiveFilters) && (
                    <button
                      onClick={clearFilters}
                      style={{
                        position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                        background: 'none', border: 'none', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        width: '24px', height: '24px', borderRadius: radius.pill,
                        color: colors.textMuted,
                        transition: transitions.fast,
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = colors.surfaceAlt; e.currentTarget.style.color = colors.textSecondary; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = colors.textMuted; }}
                    >
                      <X style={{ width: '14px', height: '14px' }} />
                    </button>
                  )}
                </div>
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  style={{
                    height: '46px', padding: '0 18px',
                    background: (showFilters || hasActiveFilters) ? colors.primary : colors.surface,
                    color: (showFilters || hasActiveFilters) ? 'white' : colors.textSecondary,
                    border: `1.5px solid ${(showFilters || hasActiveFilters) ? colors.primary : colors.border}`,
                    borderRadius: radius.md,
                    cursor: 'pointer',
                    fontSize: '13px', fontWeight: typography.weight.semibold,
                    display: 'flex', alignItems: 'center', gap: '8px',
                    transition: transitions.base,
                    boxShadow: (showFilters || hasActiveFilters) ? shadows.primarySoft : shadows.xs,
                  }}
                >
                  <SlidersHorizontal style={{ width: '16px', height: '16px' }} />
                  Filtros
                  {hasActiveFilters && (
                    <span style={{
                      background: 'white', color: colors.primary,
                      borderRadius: radius.pill, fontSize: '11px',
                      padding: '1px 7px', fontWeight: typography.weight.bold,
                    }}>
                      {[filterStatus, filterAssigned, filterDateFrom, filterDateTo].filter(Boolean).length}
                    </span>
                  )}
                </button>
              </div>

              {/* Panel de filtros */}
              {showFilters && (
                <div style={{
                  background: colors.surface, borderRadius: radius.md,
                  border: `1px solid ${colors.border}`, padding: '18px',
                  marginTop: '10px',
                  display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: '14px',
                  boxShadow: shadows.sm,
                }}>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: typography.weight.bold, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: typography.trackingWide, display: 'block', marginBottom: '6px' }}>Estado</label>
                    <select
                      value={filterStatus}
                      onChange={e => setFilterStatus(e.target.value)}
                      style={{ width: '100%', height: '38px', border: `1.5px solid ${colors.border}`, borderRadius: radius.sm, padding: '0 10px', fontSize: '13px', background: colors.surfaceAlt, boxSizing: 'border-box', color: colors.textPrimary }}
                    >
                      <option value="">Todos</option>
                      {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                  {agents.length > 0 && (
                    <div>
                      <label style={{ fontSize: '11px', fontWeight: typography.weight.bold, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: typography.trackingWide, display: 'block', marginBottom: '6px' }}>Agente</label>
                      <select
                        value={filterAssigned}
                        onChange={e => setFilterAssigned(e.target.value)}
                        style={{ width: '100%', height: '38px', border: `1.5px solid ${colors.border}`, borderRadius: radius.sm, padding: '0 10px', fontSize: '13px', background: colors.surfaceAlt, boxSizing: 'border-box', color: colors.textPrimary }}
                      >
                        <option value="">Todos</option>
                        <option value="unassigned">Sin asignar</option>
                        {agents.map(a => <option key={a.id} value={a.id}>{a.full_name}</option>)}
                      </select>
                    </div>
                  )}
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: typography.weight.bold, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: typography.trackingWide, display: 'block', marginBottom: '6px' }}>Desde</label>
                    <input
                      type="date"
                      value={filterDateFrom}
                      onChange={e => setFilterDateFrom(e.target.value)}
                      style={{ width: '100%', height: '38px', border: `1.5px solid ${colors.border}`, borderRadius: radius.sm, padding: '0 10px', fontSize: '13px', background: colors.surfaceAlt, boxSizing: 'border-box', color: colors.textPrimary }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: typography.weight.bold, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: typography.trackingWide, display: 'block', marginBottom: '6px' }}>Hasta</label>
                    <input
                      type="date"
                      value={filterDateTo}
                      onChange={e => setFilterDateTo(e.target.value)}
                      style={{ width: '100%', height: '38px', border: `1.5px solid ${colors.border}`, borderRadius: radius.sm, padding: '0 10px', fontSize: '13px', background: colors.surfaceAlt, boxSizing: 'border-box', color: colors.textPrimary }}
                    />
                  </div>
                </div>
              )}

              {/* Dropdown de resultados */}
              {showResults && (searchResults.length > 0 || searching) && (
                <div style={{
                  position: 'absolute', top: 'calc(100% + 10px)', left: 0, right: 0,
                  background: colors.surface, borderRadius: radius.md,
                  border: `1px solid ${colors.border}`,
                  boxShadow: shadows.lg,
                  maxHeight: '420px', overflowY: 'auto',
                  zIndex: 50,
                }}>
                  {searching ? (
                    <div style={{ padding: '24px', textAlign: 'center', fontSize: '13px', color: colors.textMuted }}>
                      Buscando...
                    </div>
                  ) : (
                    <>
                      <div style={{ padding: '10px 18px', fontSize: '11px', fontWeight: typography.weight.bold, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: typography.trackingWide, background: colors.surfaceAlt, borderBottom: `1px solid ${colors.borderSubtle}` }}>
                        {searchResults.length} resultado{searchResults.length !== 1 ? 's' : ''}
                      </div>
                      {searchResults.map(ticket => (
                        <div
                          key={ticket.id}
                          onClick={() => { setShowResults(false); router.push(`/tickets/${ticket.id}`); }}
                          style={{ padding: '14px 18px', cursor: 'pointer', borderBottom: `1px solid ${colors.borderSubtle}`, transition: transitions.fast }}
                          onMouseEnter={e => e.currentTarget.style.background = colors.surfaceAlt}
                          onMouseLeave={e => e.currentTarget.style.background = colors.surface}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '11px', fontFamily: 'monospace', color: colors.textMuted, background: colors.surfaceAlt, padding: '2px 8px', borderRadius: radius.xs, fontWeight: typography.weight.semibold }}>
                                #{ticket.id}
                              </span>
                              <span style={{ fontSize: '11px', fontWeight: typography.weight.semibold, color: colors.textSecondary }}>
                                {STATUS_LABELS[ticket.status] || ticket.status}
                              </span>
                            </div>
                            <span style={{ fontSize: '11px', color: colors.textPlaceholder }}>
                              {formatDistanceToNow(new Date(ticket.updated_at), { addSuffix: true, locale: es })}
                            </span>
                          </div>
                          <p style={{ fontSize: '13px', fontWeight: typography.weight.semibold, color: colors.textPrimary, margin: '0 0 2px', lineHeight: '1.35' }}>
                            {ticket.subject}
                          </p>
                          <p style={{ fontSize: '12px', color: colors.textMuted, margin: 0 }}>
                            {ticket.client_name ? `${ticket.client_name} · ${ticket.client_email}` : ticket.client_email}
                            {ticket.agent && <span> · Asignado a {ticket.agent.full_name}</span>}
                          </p>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}

              {showResults && !searching && searchResults.length === 0 && (searchQuery.length >= 2 || hasActiveFilters) && (
                <div style={{
                  position: 'absolute', top: 'calc(100% + 10px)', left: 0, right: 0,
                  background: colors.surface, borderRadius: radius.md,
                  border: `1px solid ${colors.border}`,
                  boxShadow: shadows.lg,
                  padding: '24px', textAlign: 'center',
                  fontSize: '13px', color: colors.textMuted,
                  zIndex: 50,
                }}>
                  No se encontraron tickets que coincidan con la búsqueda.
                </div>
              )}
            </div>
          </div>

          {/* Loading */}
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '300px' }}>
              <div style={{
                width: '44px', height: '44px', borderRadius: radius.pill,
                border: `3px solid ${colors.border}`, borderTopColor: colors.primary,
                animation: 'spin 0.8s linear infinite',
              }} />
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          ) : (
            /* Kanban */
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '18px',
              height: 'calc(100vh - 240px)',
            }}>
              {COLUMNS.map(col => {
                const colTickets = getTicketsByStatus(col.id);
                return (
                  <div key={col.id} style={{
                    display: 'flex',
                    flexDirection: 'column',
                    background: colors.surface,
                    borderRadius: radius.lg,
                    border: `1px solid ${colors.border}`,
                    overflow: 'hidden',
                    boxShadow: shadows.sm,
                  }}>
                    {/* Cabecera de columna */}
                    <div style={{
                      padding: '14px 16px',
                      borderBottom: `2px solid ${col.style.border}`,
                      background: col.style.headerTint,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                          width: '10px', height: '10px',
                          borderRadius: radius.pill, background: col.style.dot,
                          boxShadow: `0 0 0 3px ${col.style.dot}22`,
                        }} />
                        <span style={{ fontWeight: typography.weight.bold, fontSize: '14px', color: col.style.text, letterSpacing: typography.trackingTight }}>
                          {col.label}
                        </span>
                      </div>
                      <span style={{
                        background: col.style.bg,
                        color: col.style.text,
                        fontSize: '12px',
                        fontWeight: typography.weight.bold,
                        padding: '3px 11px',
                        borderRadius: radius.pill,
                        border: `1px solid ${col.style.border}`,
                        minWidth: '26px',
                        textAlign: 'center',
                      }}>
                        {colTickets.length}
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
                      {colTickets.map(ticket => {
                        const isNew = ticket.is_unread === true;
                        const clientDisplayName = ticket.client_name || ticket.client_email.split('@')[0];
                        const agentAvatarColor = ticket.agent ? stringToColor(ticket.agent.full_name) : null;
                        return (
                          <div
                            key={ticket.id}
                            onClick={() => router.push(`/tickets/${ticket.id}`)}
                            style={{
                              background: colors.surface,
                              border: `1px solid ${colors.border}`,
                              borderLeft: `3px solid ${col.style.dot}`,
                              borderRadius: radius.md,
                              padding: '14px',
                              cursor: 'pointer',
                              transition: transitions.smooth,
                              position: 'relative',
                              boxShadow: shadows.xs,
                            }}
                            onMouseEnter={e => {
                              e.currentTarget.style.borderColor = colors.primary;
                              e.currentTarget.style.borderLeftColor = col.style.dot;
                              e.currentTarget.style.transform = 'translateY(-2px)';
                              e.currentTarget.style.boxShadow = shadows.primaryHover;
                            }}
                            onMouseLeave={e => {
                              e.currentTarget.style.borderColor = colors.border;
                              e.currentTarget.style.borderLeftColor = col.style.dot;
                              e.currentTarget.style.transform = 'translateY(0)';
                              e.currentTarget.style.boxShadow = shadows.xs;
                            }}
                          >
                            {/* Badge "Nuevo" en amarillo Prontomatic */}
                            {isNew && (
                              <div style={{
                                position: 'absolute',
                                top: '8px', right: '8px',
                                background: colors.accent,
                                color: colors.textPrimary,
                                fontSize: '9px',
                                fontWeight: typography.weight.black,
                                padding: '2px 7px',
                                borderRadius: radius.pill,
                                textTransform: 'uppercase',
                                letterSpacing: typography.trackingWide,
                                display: 'flex', alignItems: 'center', gap: '3px',
                                boxShadow: shadows.xs,
                              }}>
                                <Sparkles style={{ width: '9px', height: '9px' }} />
                                Nuevo
                              </div>
                            )}

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', marginRight: isNew ? '56px' : '0' }}>
                              <span style={{
                                fontSize: '11px', fontFamily: 'monospace',
                                color: colors.textMuted, background: colors.surfaceAlt,
                                padding: '2px 8px', borderRadius: radius.xs,
                                border: `1px solid ${colors.borderSubtle}`,
                                fontWeight: typography.weight.semibold,
                              }}>
                                #{ticket.id}
                              </span>
                              <span style={{ fontSize: '11px', color: colors.textPlaceholder, display: 'flex', alignItems: 'center', gap: '3px' }}>
                                <Clock style={{ width: '11px', height: '11px' }} />
                                {formatDistanceToNow(new Date(ticket.updated_at), { addSuffix: true, locale: es })}
                              </span>
                            </div>

                            <p style={{
                              fontSize: '13.5px', fontWeight: typography.weight.semibold,
                              color: colors.textPrimary, margin: '0 0 10px',
                              lineHeight: '1.4',
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                              letterSpacing: typography.trackingTight,
                            }}>
                              {ticket.subject}
                            </p>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '11px', color: colors.textMuted, display: 'flex', alignItems: 'center', gap: '5px', minWidth: 0, flex: 1 }}>
                                <User style={{ width: '11px', height: '11px', flexShrink: 0, color: colors.textPlaceholder }} />
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {clientDisplayName}
                                </span>
                              </span>
                              {ticket.agent ? (
                                <div style={{
                                  display: 'flex', alignItems: 'center', gap: '5px',
                                  background: colors.primarySoft,
                                  padding: '3px 8px 3px 3px',
                                  borderRadius: radius.pill,
                                  flexShrink: 0,
                                }}>
                                  <div style={{
                                    width: '16px', height: '16px',
                                    borderRadius: radius.pill,
                                    background: agentAvatarColor,
                                    color: 'white',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: '9px', fontWeight: typography.weight.bold,
                                  }}>
                                    {ticket.agent.full_name.charAt(0)}
                                  </div>
                                  <span style={{
                                    fontSize: '11px', color: colors.primary,
                                    fontWeight: typography.weight.semibold,
                                  }}>
                                    {ticket.agent.full_name.split(' ')[0]}
                                  </span>
                                </div>
                              ) : (
                                <span style={{
                                  fontSize: '11px', color: colors.textPlaceholder,
                                  border: `1px dashed ${colors.borderStrong}`,
                                  padding: '3px 8px', borderRadius: radius.pill,
                                  flexShrink: 0,
                                  fontWeight: typography.weight.medium,
                                }}>
                                  Sin asignar
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}

                      {colTickets.length === 0 && (
                        <div style={{
                          flex: 1, display: 'flex', flexDirection: 'column',
                          alignItems: 'center', justifyContent: 'center',
                          padding: '2rem 1rem', opacity: 0.5,
                        }}>
                          <div style={{
                            width: '48px', height: '48px',
                            borderRadius: radius.lg,
                            background: colors.surfaceAlt,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            marginBottom: '10px',
                          }}>
                            <Inbox style={{ width: '22px', height: '22px', color: colors.textPlaceholder }} />
                          </div>
                          <p style={{ fontSize: '13px', color: colors.textMuted, margin: 0, fontWeight: typography.weight.semibold }}>
                            Sin tickets
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
