'use client';

import { useEffect, useState } from 'react';
import { supabaseClient } from '@/lib/supabase-client';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { toast } from 'sonner';
import { ArrowLeft, Shield, Search, Trash2, RefreshCw, Mail, AlertTriangle, ChevronDown, ChevronUp, Settings as SettingsIcon } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const PRESETS = [
  { value: 50, label: 'Estricto', description: 'Filtra agresivamente. Puede tener falsos positivos.' },
  { value: 70, label: 'Normal', description: 'Balance recomendado entre precisión y filtrado.' },
  { value: 100, label: 'Permisivo', description: 'Solo filtra casos obvios. Menos falsos positivos.' },
];

const PERIOD_OPTIONS = [
  { value: 7, label: '7 días' },
  { value: 30, label: '30 días' },
  { value: 90, label: '90 días' },
];

export default function CorreosFiltradosPage() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [days, setDays] = useState(30);
  const [expandedId, setExpandedId] = useState(null);
  const [currentThreshold, setCurrentThreshold] = useState(70);
  const [savingThreshold, setSavingThreshold] = useState(false);
  const [showSensitivity, setShowSensitivity] = useState(false);
  const router = useRouter();

  const isAdmin = profile?.role === 'ADMINISTRADOR';

  useEffect(() => {
    const init = async () => {
      const { data: { session: s } } = await supabaseClient.auth.getSession();
      if (!s) { router.push('/'); return; }
      setSession(s);

      const profRes = await fetch('/api/profile', {
        headers: { 'Authorization': `Bearer ${s.access_token}` }
      });
      if (profRes.ok) {
        const prof = await profRes.json();
        setProfile(prof);
        if (!['SUPERVISOR', 'ADMINISTRADOR'].includes(prof.role)) {
          toast.error('No tienes permisos para acceder a esta sección');
          router.push('/dashboard');
          return;
        }
      }

      await fetchEmails(s.access_token, days, search);
      await fetchThreshold(s.access_token);
    };
    init();
  }, [router]);

  const fetchEmails = async (token, daysValue, searchValue) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('days', String(daysValue));
      if (searchValue && searchValue.length >= 2) params.append('search', searchValue);

      const res = await fetch(`/api/admin/correos-filtrados?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setEmails(await res.json());
    } catch (e) { toast.error('Error cargando correos'); }
    finally { setLoading(false); }
  };

  const fetchThreshold = async (token) => {
    try {
      const res = await fetch('/api/admin/configuracion', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const configs = await res.json();
        const config = configs.find(c => c.key === 'spam_threshold');
        if (config) setCurrentThreshold(parseInt(config.value, 10));
      }
    } catch (e) { /* silencio */ }
  };

  // Debounce de búsqueda
  useEffect(() => {
    if (!session) return;
    const timer = setTimeout(() => {
      fetchEmails(session.access_token, days, search);
    }, 400);
    return () => clearTimeout(timer);
  }, [search, days, session]);

  const handleChangeThreshold = async (newThreshold) => {
    if (!isAdmin) return;
    setSavingThreshold(true);
    try {
      const res = await fetch('/api/admin/configuracion', {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ key: 'spam_threshold', value: String(newThreshold) })
      });
      if (res.ok) {
        setCurrentThreshold(newThreshold);
        toast.success('Sensibilidad del filtro actualizada');
      } else {
        toast.error('Error al guardar');
      }
    } catch (e) { toast.error('Error de red'); }
    finally { setSavingThreshold(false); }
  };

  const handleReactivate = async (email) => {
    const confirmed = window.confirm(
      `¿Reactivar este correo como ticket?\n\nRemitente: ${email.from_email}\nAsunto: ${email.subject}\n\nSe creará un ticket nuevo con el contenido parcial del correo. Si necesitas la información completa o adjuntos, deberás solicitarlos al cliente.`
    );
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/admin/correos-filtrados/${email.id}/reactivar`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });
      if (res.ok) {
        const data = await res.json();
        toast.success(`Ticket #${data.ticketId} creado exitosamente`);
        await fetchEmails(session.access_token, days, search);
      } else {
        const d = await res.json();
        toast.error(d.error || 'Error al reactivar');
      }
    } catch (e) { toast.error('Error de red'); }
  };

  const handleDelete = async (email) => {
    const confirmed = window.confirm(
      `¿Eliminar definitivamente este correo filtrado?\n\nRemitente: ${email.from_email}\nAsunto: ${email.subject}`
    );
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/admin/correos-filtrados/${email.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });
      if (res.ok) {
        toast.success('Correo eliminado');
        await fetchEmails(session.access_token, days, search);
      }
    } catch (e) { toast.error('Error de red'); }
  };

  const getPresetLabel = (threshold) => {
    const preset = PRESETS.find(p => p.value === threshold);
    return preset ? preset.label : 'Personalizado';
  };

  return (
    <div style={{ minHeight: '100vh', background: '#F4F7F9' }}>
      <Navbar />
      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>
        <div
          onClick={() => router.push('/dashboard')}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748B', cursor: 'pointer', marginBottom: '1.5rem', fontSize: '14px', fontWeight: '500' }}
          onMouseEnter={e => e.currentTarget.style.color = '#003F8A'}
          onMouseLeave={e => e.currentTarget.style.color = '#64748B'}
        >
          <ArrowLeft style={{ width: '16px', height: '16px' }} /> Volver al Tablero
        </div>

        <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#1A1A2E', margin: '0 0 4px', letterSpacing: '-0.5px' }}>
          Correos Filtrados
        </h1>
        <p style={{ fontSize: '14px', color: '#64748B', margin: '0 0 2rem' }}>
          Revisa los correos que el sistema detectó como spam o automáticos. Puedes reactivarlos como ticket si fueron filtrados por error.
        </p>

        {/* Panel de sensibilidad (solo ADMINISTRADOR) */}
        {isAdmin && (
          <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #E2E8F0', marginBottom: '1.5rem', overflow: 'hidden' }}>
            <button
              onClick={() => setShowSensitivity(!showSensitivity)}
              style={{ width: '100%', padding: '16px 20px', background: '#F8FAFC', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <SettingsIcon style={{ width: '18px', height: '18px', color: '#003F8A' }} />
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: '14px', fontWeight: '700', color: '#1A1A2E' }}>Sensibilidad del filtro</div>
                  <div style={{ fontSize: '12px', color: '#64748B' }}>
                    Nivel actual: <strong>{getPresetLabel(currentThreshold)}</strong> (umbral: {currentThreshold})
                  </div>
                </div>
              </div>
              {showSensitivity ? <ChevronUp style={{ width: '18px', height: '18px', color: '#64748B' }} /> : <ChevronDown style={{ width: '18px', height: '18px', color: '#64748B' }} />}
            </button>
            {showSensitivity && (
              <div style={{ padding: '16px 20px', borderTop: '1px solid #F1F5F9', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                {PRESETS.map(preset => {
                  const isActive = currentThreshold === preset.value;
                  return (
                    <button
                      key={preset.value}
                      onClick={() => handleChangeThreshold(preset.value)}
                      disabled={savingThreshold || isActive}
                      style={{
                        padding: '14px 16px',
                        borderRadius: '12px',
                        border: `2px solid ${isActive ? '#003F8A' : '#E2E8F0'}`,
                        background: isActive ? '#E8F0FB' : 'white',
                        cursor: (savingThreshold || isActive) ? 'default' : 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ fontSize: '14px', fontWeight: '700', color: isActive ? '#003F8A' : '#1A1A2E', marginBottom: '2px' }}>
                        {preset.label} ({preset.value})
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748B', lineHeight: '1.4' }}>
                        {preset.description}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Filtros de búsqueda */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '1rem', alignItems: 'center' }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <Search style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', width: '16px', height: '16px', color: '#94A3B8' }} />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por remitente o asunto..."
              style={{
                width: '100%', height: '42px',
                border: '1.5px solid #E2E8F0', borderRadius: '12px',
                padding: '0 14px 0 42px', fontSize: '14px',
                boxSizing: 'border-box', outline: 'none', background: 'white',
              }}
            />
          </div>
          <div style={{ display: 'flex', gap: '4px', background: 'white', borderRadius: '10px', border: '1px solid #E2E8F0', padding: '4px' }}>
            {PERIOD_OPTIONS.map(p => (
              <button
                key={p.value}
                onClick={() => setDays(p.value)}
                style={{
                  padding: '6px 14px', borderRadius: '8px', border: 'none',
                  fontSize: '13px', fontWeight: '600', cursor: 'pointer',
                  background: days === p.value ? '#003F8A' : 'transparent',
                  color: days === p.value ? 'white' : '#64748B',
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Lista de correos filtrados */}
        {loading ? (
          <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '3rem', textAlign: 'center', color: '#64748B' }}>
            Cargando correos filtrados...
          </div>
        ) : emails.length === 0 ? (
          <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '3rem', textAlign: 'center' }}>
            <Shield style={{ width: '48px', height: '48px', color: '#CBD5E1', margin: '0 auto 12px' }} />
            <p style={{ fontSize: '15px', fontWeight: '600', color: '#334155', margin: '0 0 4px' }}>
              No hay correos filtrados
            </p>
            <p style={{ fontSize: '13px', color: '#64748B', margin: 0 }}>
              {search ? 'No se encontraron resultados con esa búsqueda.' : `No se han filtrado correos en los últimos ${days} días.`}
            </p>
          </div>
        ) : (
          <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
            <div style={{ padding: '12px 20px', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', fontSize: '12px', fontWeight: '600', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {emails.length} correo{emails.length !== 1 ? 's' : ''} filtrado{emails.length !== 1 ? 's' : ''}
            </div>
            {emails.map((email, idx) => {
              const isExpanded = expandedId === email.id;
              return (
                <div key={email.id} style={{ borderBottom: idx < emails.length - 1 ? '1px solid #F1F5F9' : 'none' }}>
                  <div
                    onClick={() => setExpandedId(isExpanded ? null : email.id)}
                    style={{ padding: '14px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'}
                    onMouseLeave={e => e.currentTarget.style.background = 'white'}
                  >
                    <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <AlertTriangle style={{ width: '18px', height: '18px', color: '#B45309' }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '14px', fontWeight: '600', color: '#1A1A2E', marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {email.subject}
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {email.from_name ? `${email.from_name} <${email.from_email}>` : email.from_email}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', flexShrink: 0 }}>
                      <span style={{ background: '#FEE2E2', color: '#991B1B', fontSize: '11px', fontWeight: '700', padding: '2px 10px', borderRadius: '999px' }}>
                        Score: {email.score}
                      </span>
                      <span style={{ fontSize: '11px', color: '#94A3B8' }}>
                        {format(new Date(email.filtered_at), "dd MMM yyyy · HH:mm", { locale: es })}
                      </span>
                    </div>
                    {isExpanded ? <ChevronUp style={{ width: '18px', height: '18px', color: '#64748B', flexShrink: 0 }} /> : <ChevronDown style={{ width: '18px', height: '18px', color: '#64748B', flexShrink: 0 }} />}
                  </div>

                  {isExpanded && (
                    <div style={{ padding: '0 20px 20px', background: '#FAFBFC' }}>
                      <div style={{ display: 'grid', gap: '12px' }}>
                        <div>
                          <div style={{ fontSize: '11px', fontWeight: '600', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
                            Motivos del filtrado
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {email.reasons.split(' | ').map((reason, i) => (
                              <span key={i} style={{ background: 'white', border: '1px solid #FDE68A', color: '#92400E', fontSize: '12px', padding: '4px 10px', borderRadius: '999px' }}>
                                {reason}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: '11px', fontWeight: '600', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
                            Vista previa del cuerpo (primeros 500 caracteres)
                          </div>
                          <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '12px', fontSize: '13px', color: '#334155', whiteSpace: 'pre-wrap', fontFamily: 'monospace', maxHeight: '200px', overflowY: 'auto' }}>
                            {email.body_preview || '(cuerpo vacío)'}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                          <button
                            onClick={() => handleDelete(email)}
                            style={{ background: 'white', border: '1.5px solid #FEE2E2', borderRadius: '10px', padding: '8px 16px', fontSize: '13px', fontWeight: '600', color: '#991B1B', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                          >
                            <Trash2 style={{ width: '14px', height: '14px' }} /> Eliminar
                          </button>
                          <button
                            onClick={() => handleReactivate(email)}
                            style={{ background: '#003F8A', border: 'none', borderRadius: '10px', padding: '8px 16px', fontSize: '13px', fontWeight: '600', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                          >
                            <RefreshCw style={{ width: '14px', height: '14px' }} /> Reactivar como ticket
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
