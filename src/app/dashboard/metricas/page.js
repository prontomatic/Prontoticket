'use client';

import { useEffect, useState } from 'react';
import { supabaseClient } from '@/lib/supabase-client';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { toast } from 'sonner';
import { ArrowLeft, Ticket, Clock, Zap, AlertCircle, Users, Tag } from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const STATUS_COLORS = {
  ABIERTO: '#3B82F6',
  EN_PROCESO_INTERNO: '#EAB308',
  EN_ESPERA_CLIENTE: '#F97316',
  CERRADO: '#22C55E',
};

const STATUS_LABELS = {
  ABIERTO: 'Abiertos',
  EN_PROCESO_INTERNO: 'En Proceso',
  EN_ESPERA_CLIENTE: 'Espera Cliente',
  CERRADO: 'Cerrados',
};

const PERIODS = [
  { value: '7d', label: '7 días' },
  { value: '30d', label: '30 días' },
  { value: '90d', label: '90 días' },
  { value: 'all', label: 'Todo' },
  { value: 'custom', label: 'Personalizado' },
];

function formatHours(hours) {
  if (hours === 0) return '—';
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  if (hours < 24) return `${Math.round(hours * 10) / 10} hrs`;
  const days = Math.floor(hours / 24);
  const remainingHours = Math.round((hours % 24) * 10) / 10;
  return `${days}d ${remainingHours}h`;
}

export default function MetricasPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('30d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [session, setSession] = useState(null);
  const router = useRouter();

  const fetchMetrics = async (token, selectedPeriod, fromDate, toDate) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedPeriod === 'custom') {
        if (fromDate) params.append('date_from', fromDate);
        if (toDate) params.append('date_to', toDate);
      } else {
        params.append('period', selectedPeriod);
      }
      const res = await fetch(`/api/metricas?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setData(await res.json());
      } else if (res.status === 403) {
        toast.error('No tienes permisos para ver métricas');
        router.push('/dashboard');
      }
    } catch (e) { toast.error('Error cargando métricas'); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    const init = async () => {
      const { data: { session: s } } = await supabaseClient.auth.getSession();
      if (!s) { router.push('/'); return; }
      setSession(s);
      fetchMetrics(s.access_token, period);
    };
    init();
  }, [router]);

  const handlePeriodChange = (newPeriod) => {
    setPeriod(newPeriod);
    if (newPeriod === 'custom') {
      // No recarga aún; espera a que el usuario elija fechas
      return;
    }
    setCustomFrom('');
    setCustomTo('');
    if (session) fetchMetrics(session.access_token, newPeriod);
  };

  // Recargar cuando cambian las fechas custom (con debounce)
  useEffect(() => {
    if (period !== 'custom' || !session) return;
    // Validar que ambas fechas estén puestas y que from <= to
    if (!customFrom || !customTo) return;
    if (new Date(customFrom) > new Date(customTo)) {
      toast.error('La fecha "Desde" no puede ser mayor que "Hasta"');
      return;
    }
    const timer = setTimeout(() => {
      fetchMetrics(session.access_token, 'custom', customFrom, customTo);
    }, 400);
    return () => clearTimeout(timer);
  }, [customFrom, customTo, period, session]);

  const roleLabels = { AGENTE: 'Agente', SUPERVISOR: 'Supervisor', ADMINISTRADOR: 'Admin' };

  return (
    <div style={{ minHeight: '100vh', background: '#F4F7F9' }}>
      <Navbar />
      <main style={{ maxWidth: '1400px', margin: '0 auto', padding: '2rem' }}>
        {/* Back + Header */}
        <div
          onClick={() => router.push('/dashboard')}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748B', cursor: 'pointer', marginBottom: '1.5rem', fontSize: '14px', fontWeight: '500' }}
          onMouseEnter={e => e.currentTarget.style.color = '#003F8A'}
          onMouseLeave={e => e.currentTarget.style.color = '#64748B'}
        >
          <ArrowLeft style={{ width: '16px', height: '16px' }} /> Volver al Tablero
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '1.5rem' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#1A1A2E', margin: '0 0 4px', letterSpacing: '-0.5px' }}>
              Panel de Métricas
            </h1>
            <p style={{ fontSize: '14px', color: '#64748B', margin: 0 }}>
              Indicadores de desempeño del equipo de soporte.
            </p>
          </div>
          {/* Filtro de período */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'flex-end' }}>
            <div style={{ display: 'flex', gap: '4px', background: 'white', borderRadius: '10px', border: '1px solid #E2E8F0', padding: '4px' }}>
              {PERIODS.map(p => (
                <button
                  key={p.value}
                  onClick={() => handlePeriodChange(p.value)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '8px',
                    border: 'none',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    background: period === p.value ? '#003F8A' : 'transparent',
                    color: period === p.value ? 'white' : '#64748B',
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
            {period === 'custom' && (
              <div style={{ display: 'flex', gap: '8px', background: 'white', borderRadius: '10px', border: '1px solid #E2E8F0', padding: '8px 12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <label style={{ fontSize: '10px', fontWeight: '600', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Desde</label>
                  <input
                    type="date"
                    value={customFrom}
                    onChange={e => setCustomFrom(e.target.value)}
                    style={{ height: '32px', border: '1px solid #E2E8F0', borderRadius: '6px', padding: '0 8px', fontSize: '13px', background: '#F8FAFC', boxSizing: 'border-box' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <label style={{ fontSize: '10px', fontWeight: '600', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Hasta</label>
                  <input
                    type="date"
                    value={customTo}
                    onChange={e => setCustomTo(e.target.value)}
                    style={{ height: '32px', border: '1px solid #E2E8F0', borderRadius: '6px', padding: '0 8px', fontSize: '13px', background: '#F8FAFC', boxSizing: 'border-box' }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '300px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '50%', border: '3px solid #E2E8F0', borderTopColor: '#003F8A', animation: 'spin 0.8s linear infinite' }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : data ? (
          <>
            {/* KPI Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
              {[
                { label: 'Total Tickets', value: data.kpis.totalTickets, icon: Ticket, color: '#003F8A', bg: '#E8F0FB' },
                { label: 'Abiertos Ahora', value: data.kpis.openTickets, icon: AlertCircle, color: '#DC2626', bg: '#FEE2E2' },
                { label: 'Resolución Promedio', value: formatHours(data.kpis.avgResolutionHours), icon: Clock, color: '#7C3AED', bg: '#EDE9FE' },
                { label: '1ª Respuesta Promedio', value: formatHours(data.kpis.avgFirstResponseHours), icon: Zap, color: '#059669', bg: '#D1FAE5' },
              ].map((kpi, idx) => (
                <div key={idx} style={{
                  background: 'white',
                  borderRadius: '16px',
                  border: '1px solid #E2E8F0',
                  padding: '20px 24px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                  <div>
                    <p style={{ fontSize: '12px', fontWeight: '600', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 6px' }}>{kpi.label}</p>
                    <p style={{ fontSize: '28px', fontWeight: '800', color: '#1A1A2E', margin: 0, letterSpacing: '-1px' }}>{kpi.value}</p>
                  </div>
                  <div style={{
                    width: '48px', height: '48px', borderRadius: '12px',
                    background: kpi.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <kpi.icon style={{ width: '24px', height: '24px', color: kpi.color }} />
                  </div>
                </div>
              ))}
            </div>

            {/* Charts Row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '16px', marginBottom: '24px' }}>
              {/* Pie Chart — por estado */}
              <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '24px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#1A1A2E', margin: '0 0 16px' }}>Por Estado</h3>
                {data.byStatus.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={data.byStatus.map(s => ({ ...s, name: STATUS_LABELS[s.status] || s.status }))}
                        dataKey="count"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={3}
                      >
                        {data.byStatus.map((entry, i) => (
                          <Cell key={i} fill={STATUS_COLORS[entry.status] || '#94A3B8'} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value, name) => [value, name]} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p style={{ textAlign: 'center', color: '#94A3B8', fontSize: '13px', padding: '3rem 0' }}>Sin datos en este período</p>
                )}
                {/* Legend */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'center', marginTop: '8px' }}>
                  {data.byStatus.map((s, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#475569' }}>
                      <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: STATUS_COLORS[s.status] || '#94A3B8' }} />
                      {STATUS_LABELS[s.status] || s.status} ({s.count})
                    </div>
                  ))}
                </div>
              </div>

              {/* Bar Chart — tendencia diaria */}
              <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '24px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#1A1A2E', margin: '0 0 16px' }}>Tickets por Día</h3>
                {data.trend.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={data.trend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 11, fill: '#94A3B8' }}
                        tickFormatter={(d) => {
                          const parts = d.split('-');
                          return `${parts[2]}/${parts[1]}`;
                        }}
                        interval={Math.max(0, Math.floor(data.trend.length / 10))}
                      />
                      <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} allowDecimals={false} />
                      <Tooltip
                        labelFormatter={(d) => {
                          const parts = d.split('-');
                          return `${parts[2]}/${parts[1]}/${parts[0]}`;
                        }}
                        formatter={(value) => [value, 'Tickets']}
                      />
                      <Bar dataKey="count" fill="#003F8A" radius={[4, 4, 0, 0]} maxBarSize={40} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p style={{ textAlign: 'center', color: '#94A3B8', fontSize: '13px', padding: '3rem 0' }}>Sin datos en este período</p>
                )}
              </div>
            </div>

            {/* Agent Performance Table */}
            <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #E2E8F0', overflow: 'hidden', marginBottom: '24px' }}>
              <div style={{ padding: '20px 24px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Users style={{ width: '18px', height: '18px', color: '#64748B' }} />
                <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#1A1A2E', margin: 0 }}>Desempeño por Agente</h3>
              </div>
              {data.agentStats.length > 0 ? (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                      {['Agente', 'Rol', 'Activos', 'Cerrados', 'Resolución Promedio', '1ª Respuesta Promedio'].map(h => (
                        <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.agentStats.map((agent, idx) => (
                      <tr key={idx} style={{ borderBottom: idx < data.agentStats.length - 1 ? '1px solid #F1F5F9' : 'none' }}>
                        <td style={{ padding: '14px 16px', fontSize: '14px', fontWeight: '600', color: '#1A1A2E' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{
                              width: '32px', height: '32px', borderRadius: '50%',
                              background: '#E8F0FB', color: '#003F8A',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: '13px', fontWeight: '700',
                            }}>
                              {agent.name.charAt(0)}
                            </div>
                            {agent.name}
                          </div>
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <span style={{
                            fontSize: '12px', fontWeight: '600', padding: '3px 10px', borderRadius: '999px',
                            background: agent.role === 'ADMINISTRADOR' ? '#DCFCE7' : agent.role === 'SUPERVISOR' ? '#FEF9C3' : '#E8F0FB',
                            color: agent.role === 'ADMINISTRADOR' ? '#166534' : agent.role === 'SUPERVISOR' ? '#854D0E' : '#003F8A',
                          }}>
                            {roleLabels[agent.role] || agent.role}
                          </span>
                        </td>
                        <td style={{ padding: '14px 16px', fontSize: '14px', fontWeight: '600', color: '#1A1A2E' }}>{agent.assigned}</td>
                        <td style={{ padding: '14px 16px', fontSize: '14px', fontWeight: '600', color: '#166534' }}>{agent.closed}</td>
                        <td style={{ padding: '14px 16px', fontSize: '13px', color: '#475569', fontWeight: '500' }}>{formatHours(agent.avgResolutionHours)}</td>
                        <td style={{ padding: '14px 16px', fontSize: '13px', color: '#475569', fontWeight: '500' }}>{formatHours(agent.avgFirstResponseHours)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div style={{ padding: '3rem', textAlign: 'center', color: '#64748B' }}>
                  <p style={{ fontWeight: '600', marginBottom: '4px' }}>No hay datos de agentes</p>
                </div>
              )}
            </div>

            {/* Category Distribution */}
            <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
              <div style={{ padding: '20px 24px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Tag style={{ width: '18px', height: '18px', color: '#64748B' }} />
                <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#1A1A2E', margin: 0 }}>Distribución por Categoría</h3>
              </div>
              <div style={{ padding: '20px 24px' }}>
                {data.byCategory.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {data.byCategory.map((cat, idx) => {
                      const maxCount = Math.max(...data.byCategory.map(c => c.count));
                      const pct = maxCount > 0 ? (cat.count / maxCount) * 100 : 0;
                      return (
                        <div key={idx}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <span style={{ fontSize: '13px', fontWeight: '600', color: '#334155' }}>{cat.name}</span>
                            <span style={{ fontSize: '13px', fontWeight: '700', color: '#1A1A2E' }}>{cat.count}</span>
                          </div>
                          <div style={{ height: '8px', background: '#F1F5F9', borderRadius: '999px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${pct}%`, background: '#003F8A', borderRadius: '999px', transition: 'width 0.5s ease' }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p style={{ textAlign: 'center', color: '#94A3B8', fontSize: '13px', padding: '2rem 0' }}>Sin datos de categorías en este período</p>
                )}
              </div>
            </div>
          </>
        ) : null}
      </main>
    </div>
  );
}