'use client';

import { useEffect, useState } from 'react';
import { supabaseClient } from '@/lib/supabase-client';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { toast } from 'sonner';
import { ArrowLeft, Save, Clock, Link2, AlertTriangle } from 'lucide-react';

const CONFIG_META = {
  'cierre_aviso_horas': {
    label: 'Aviso de cortesía',
    description: 'Horas sin respuesta del cliente antes de enviar el correo de aviso preventivo.',
    icon: Clock,
    type: 'number',
    suffix: 'horas',
    group: 'cierre',
  },
  'cierre_auto_horas': {
    label: 'Cierre automático',
    description: 'Horas sin respuesta del cliente antes de cerrar el ticket automáticamente.',
    icon: AlertTriangle,
    type: 'number',
    suffix: 'horas',
    group: 'cierre',
  },
  'csat_survey_url': {
    label: 'URL Encuesta CSAT',
    description: 'Enlace al formulario de Google Forms (o similar) para la encuesta de satisfacción del cliente.',
    icon: Link2,
    type: 'url',
    suffix: '',
    group: 'notificaciones',
  },
};

export default function ConfiguracionPage() {
  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);
  const [editedValues, setEditedValues] = useState({});
  const [saving, setSaving] = useState({});
  const router = useRouter();

  useEffect(() => {
    const init = async () => {
      const { data: { session: s } } = await supabaseClient.auth.getSession();
      if (!s) { router.push('/'); return; }
      setSession(s);
      await fetchConfigs(s.access_token);
    };
    init();
  }, [router]);

  const fetchConfigs = async (token) => {
    try {
      const res = await fetch('/api/admin/configuracion', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setConfigs(data);
        const values = {};
        data.forEach(c => { values[c.key] = c.value; });
        setEditedValues(values);
      } else if (res.status === 403) {
        toast.error('No tienes permisos');
        router.push('/dashboard');
      }
    } catch (e) { toast.error('Error cargando configuración'); }
    finally { setLoading(false); }
  };

  const handleSave = async (key) => {
    const currentConfig = configs.find(c => c.key === key);
    if (editedValues[key] === currentConfig?.value) {
      return toast.info('No hay cambios que guardar');
    }

    // Validaciones
    const meta = CONFIG_META[key];
    if (meta?.type === 'number') {
      const num = parseFloat(editedValues[key]);
      if (isNaN(num) || num <= 0) {
        return toast.error('El valor debe ser un número mayor a 0');
      }
    }
    if (meta?.type === 'url' && editedValues[key]) {
      try {
        new URL(editedValues[key]);
      } catch {
        return toast.error('Ingresa una URL válida (ejemplo: https://forms.gle/abc123)');
      }
    }

    setSaving(prev => ({ ...prev, [key]: true }));
    try {
      const res = await fetch('/api/admin/configuracion', {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ key, value: editedValues[key] })
      });
      if (res.ok) {
        toast.success('Configuración guardada');
        await fetchConfigs(session.access_token);
      } else {
        const d = await res.json();
        toast.error(d.error || 'Error al guardar');
      }
    } catch (e) { toast.error('Error de red'); }
    finally { setSaving(prev => ({ ...prev, [key]: false })); }
  };

  const groups = {
    cierre: { title: 'Parámetros de Cierre Automático', description: 'Configuración de los tiempos de inactividad para aviso y cierre de tickets.' },
    notificaciones: { title: 'Parámetros de Notificaciones', description: 'Configuración de las notificaciones enviadas a los clientes.' },
  };

  return (
    <div style={{ minHeight: '100vh', background: '#F4F7F9' }}>
      <Navbar />
      <main style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem' }}>
        <div
          onClick={() => router.push('/dashboard')}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748B', cursor: 'pointer', marginBottom: '1.5rem', fontSize: '14px', fontWeight: '500' }}
          onMouseEnter={e => e.currentTarget.style.color = '#003F8A'}
          onMouseLeave={e => e.currentTarget.style.color = '#64748B'}
        >
          <ArrowLeft style={{ width: '16px', height: '16px' }} /> Volver al Tablero
        </div>

        <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#1A1A2E', margin: '0 0 4px', letterSpacing: '-0.5px' }}>
          Configuración del Sistema
        </h1>
        <p style={{ fontSize: '14px', color: '#64748B', margin: '0 0 2rem' }}>
          Ajusta los parámetros operativos de ProntoTicket. Los cambios se aplican inmediatamente.
        </p>

        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '50%', border: '3px solid #E2E8F0', borderTopColor: '#003F8A', animation: 'spin 0.8s linear infinite' }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : (
          Object.entries(groups).map(([groupKey, group]) => (
            <div key={groupKey} style={{ marginBottom: '2rem' }}>
              <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#1A1A2E', margin: '0 0 4px' }}>{group.title}</h2>
              <p style={{ fontSize: '13px', color: '#64748B', margin: '0 0 1rem' }}>{group.description}</p>

              <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
                {configs
                  .filter(c => CONFIG_META[c.key]?.group === groupKey)
                  .map((config, idx, arr) => {
                    const meta = CONFIG_META[config.key];
                    if (!meta) return null;
                    const IconComp = meta.icon;
                    const hasChanged = editedValues[config.key] !== config.value;

                    return (
                      <div key={config.key} style={{
                        padding: '20px 24px',
                        borderBottom: idx < arr.length - 1 ? '1px solid #F1F5F9' : 'none',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                              <IconComp style={{ width: '16px', height: '16px', color: '#64748B' }} />
                              <span style={{ fontSize: '14px', fontWeight: '600', color: '#1A1A2E' }}>{meta.label}</span>
                              {config.isDefault && (
                                <span style={{ fontSize: '11px', color: '#94A3B8', background: '#F1F5F9', padding: '2px 8px', borderRadius: '999px' }}>
                                  Valor por defecto
                                </span>
                              )}
                            </div>
                            <p style={{ fontSize: '13px', color: '#64748B', margin: 0 }}>{meta.description}</p>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '12px' }}>
                          <input
                            type={meta.type === 'number' ? 'number' : 'text'}
                            value={editedValues[config.key] || ''}
                            onChange={e => setEditedValues(prev => ({ ...prev, [config.key]: e.target.value }))}
                            style={{
                              flex: 1,
                              height: '40px',
                              border: `1.5px solid ${hasChanged ? '#003F8A' : '#E2E8F0'}`,
                              borderRadius: '10px',
                              padding: '0 12px',
                              fontSize: '14px',
                              color: '#1A1A2E',
                              boxSizing: 'border-box',
                              outline: 'none',
                              background: '#F8FAFC',
                              fontFamily: meta.type === 'url' ? 'monospace' : 'inherit',
                            }}
                            onFocus={e => e.target.style.borderColor = '#003F8A'}
                            onBlur={e => { if (!hasChanged) e.target.style.borderColor = '#E2E8F0'; }}
                          />
                          {meta.suffix && (
                            <span style={{ fontSize: '13px', color: '#64748B', fontWeight: '500', minWidth: '50px' }}>{meta.suffix}</span>
                          )}
                          <button
                            onClick={() => handleSave(config.key)}
                            disabled={saving[config.key] || !hasChanged}
                            style={{
                              background: hasChanged ? '#003F8A' : '#E2E8F0',
                              color: hasChanged ? 'white' : '#94A3B8',
                              border: 'none',
                              borderRadius: '10px',
                              padding: '8px 16px',
                              fontSize: '13px',
                              fontWeight: '600',
                              cursor: hasChanged ? 'pointer' : 'not-allowed',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            <Save style={{ width: '14px', height: '14px' }} />
                            {saving[config.key] ? 'Guardando...' : 'Guardar'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          ))
        )}
      </main>
    </div>
  );
}
