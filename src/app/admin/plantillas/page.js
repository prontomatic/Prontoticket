'use client';

import { useEffect, useState } from 'react';
import { supabaseClient } from '@/lib/supabase-client';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { toast } from 'sonner';
import { ArrowLeft, Save, Mail, RotateCcw, ChevronDown, ChevronUp, Info } from 'lucide-react';

const TEMPLATE_LABELS = {
  'acuse_recibo': 'Acuse de Recibo',
  'aviso_24h': 'Aviso de Cierre Próximo',
  'cierre_48h': 'Cierre Automático',
  'csat': 'Encuesta de Satisfacción (CSAT)',
};

const AVAILABLE_VARIABLES = [
  { name: '{{ticket_id}}', description: 'Número del ticket' },
  { name: '{{ticket_subject}}', description: 'Asunto del ticket' },
  { name: '{{client_email}}', description: 'Correo del cliente' },
  { name: '{{fecha_cierre}}', description: 'Fecha y hora de cierre (solo cierre/CSAT)' },
  { name: '{{horas_restantes}}', description: 'Horas restantes antes del cierre (solo aviso)' },
  { name: '{{csat_url}}', description: 'URL de la encuesta CSAT (solo CSAT)' },
];

export default function PlantillasPage() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);
  const [expandedKey, setExpandedKey] = useState(null);
  const [editedTemplates, setEditedTemplates] = useState({});
  const [saving, setSaving] = useState({});
  const [showVariables, setShowVariables] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const init = async () => {
      const { data: { session: s } } = await supabaseClient.auth.getSession();
      if (!s) { router.push('/'); return; }
      setSession(s);
      await fetchTemplates(s.access_token);
    };
    init();
  }, [router]);

  const fetchTemplates = async (token) => {
    try {
      const res = await fetch('/api/admin/plantillas', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setTemplates(data);
        const edited = {};
        data.forEach(t => { edited[t.key] = { subject: t.subject, body: t.body }; });
        setEditedTemplates(edited);
      } else if (res.status === 403) {
        toast.error('No tienes permisos');
        router.push('/dashboard');
      }
    } catch (e) { toast.error('Error cargando plantillas'); }
    finally { setLoading(false); }
  };

  const handleSave = async (key) => {
    const edited = editedTemplates[key];
    if (!edited?.subject?.trim() || !edited?.body?.trim()) {
      return toast.error('El asunto y el cuerpo no pueden estar vacíos');
    }

    setSaving(prev => ({ ...prev, [key]: true }));
    try {
      const res = await fetch('/api/admin/plantillas', {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ key, subject: edited.subject, body: edited.body })
      });
      if (res.ok) {
        toast.success('Plantilla guardada exitosamente');
        await fetchTemplates(session.access_token);
      } else {
        const d = await res.json();
        toast.error(d.error || 'Error al guardar');
      }
    } catch (e) { toast.error('Error de red'); }
    finally { setSaving(prev => ({ ...prev, [key]: false })); }
  };

  const handleReset = async (key) => {
    const confirmed = window.confirm('¿Restaurar esta plantilla a su valor original? Se perderán los cambios personalizados.');
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/admin/plantillas?key=${key}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });
      if (res.ok) {
        toast.success('Plantilla restaurada al valor original');
        await fetchTemplates(session.access_token);
      } else {
        const d = await res.json();
        toast.error(d.error || 'Error al restaurar');
      }
    } catch (e) { toast.error('Error de red'); }
  };

  const hasChanges = (key) => {
    const original = templates.find(t => t.key === key);
    const edited = editedTemplates[key];
    if (!original || !edited) return false;
    return original.subject !== edited.subject || original.body !== edited.body;
  };

  return (
    <div style={{ minHeight: '100vh', background: '#F4F7F9' }}>
      <Navbar />
      <main style={{ maxWidth: '900px', margin: '0 auto', padding: '2rem' }}>
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
              Plantillas de Correo
            </h1>
            <p style={{ fontSize: '14px', color: '#64748B', margin: 0 }}>
              Personaliza los correos automáticos que reciben los clientes.
            </p>
          </div>
        </div>

        {/* Panel de variables disponibles */}
        <div style={{
          background: 'white', borderRadius: '12px', border: '1px solid #E2E8F0',
          marginBottom: '1.5rem', overflow: 'hidden'
        }}>
          <button
            onClick={() => setShowVariables(!showVariables)}
            style={{
              width: '100%', padding: '12px 20px', background: '#F8FAFC',
              border: 'none', cursor: 'pointer', display: 'flex',
              alignItems: 'center', justifyContent: 'space-between',
              fontSize: '13px', fontWeight: '600', color: '#475569',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Info style={{ width: '16px', height: '16px', color: '#003F8A' }} />
              Variables disponibles para las plantillas
            </span>
            {showVariables ? <ChevronUp style={{ width: '16px', height: '16px' }} /> : <ChevronDown style={{ width: '16px', height: '16px' }} />}
          </button>
          {showVariables && (
            <div style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {AVAILABLE_VARIABLES.map(v => (
                <div key={v.name} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                  <code style={{ background: '#F1F5F9', padding: '2px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: '600', color: '#003F8A' }}>
                    {v.name}
                  </code>
                  <span style={{ color: '#64748B' }}>{v.description}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '50%', border: '3px solid #E2E8F0', borderTopColor: '#003F8A', animation: 'spin 0.8s linear infinite' }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {templates.map(template => {
              const isExpanded = expandedKey === template.key;
              const edited = editedTemplates[template.key] || {};
              const changed = hasChanges(template.key);

              return (
                <div key={template.key} style={{
                  background: 'white', borderRadius: '16px',
                  border: `1px solid ${isExpanded ? '#003F8A' : '#E2E8F0'}`,
                  overflow: 'hidden', transition: 'border-color 0.2s',
                }}>
                  {/* Header */}
                  <button
                    onClick={() => setExpandedKey(isExpanded ? null : template.key)}
                    style={{
                      width: '100%', padding: '18px 24px', background: 'none',
                      border: 'none', cursor: 'pointer', display: 'flex',
                      alignItems: 'center', justifyContent: 'space-between', textAlign: 'left',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{
                        width: '40px', height: '40px', borderRadius: '10px',
                        background: '#E8F0FB', display: 'flex',
                        alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Mail style={{ width: '20px', height: '20px', color: '#003F8A' }} />
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '15px', fontWeight: '700', color: '#1A1A2E' }}>
                            {TEMPLATE_LABELS[template.key] || template.key}
                          </span>
                          {template.isDefault && (
                            <span style={{ fontSize: '11px', color: '#94A3B8', background: '#F1F5F9', padding: '2px 8px', borderRadius: '999px' }}>
                              Original
                            </span>
                          )}
                          {!template.isDefault && (
                            <span style={{ fontSize: '11px', color: '#003F8A', background: '#E8F0FB', padding: '2px 8px', borderRadius: '999px' }}>
                              Personalizada
                            </span>
                          )}
                        </div>
                        <p style={{ fontSize: '13px', color: '#64748B', margin: '2px 0 0' }}>{template.description}</p>
                      </div>
                    </div>
                    {isExpanded ? <ChevronUp style={{ width: '18px', height: '18px', color: '#64748B' }} /> : <ChevronDown style={{ width: '18px', height: '18px', color: '#64748B' }} />}
                  </button>

                  {/* Expanded editor */}
                  {isExpanded && (
                    <div style={{ padding: '0 24px 24px', borderTop: '1px solid #F1F5F9' }}>
                      {/* Subject */}
                      <div style={{ marginTop: '16px', marginBottom: '12px' }}>
                        <label style={{ fontSize: '12px', fontWeight: '600', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '6px' }}>
                          Asunto del Correo
                        </label>
                        <input
                          type="text"
                          value={edited.subject || ''}
                          onChange={e => setEditedTemplates(prev => ({
                            ...prev,
                            [template.key]: { ...prev[template.key], subject: e.target.value }
                          }))}
                          style={{
                            width: '100%', height: '40px',
                            border: '1.5px solid #E2E8F0', borderRadius: '10px',
                            padding: '0 12px', fontSize: '14px', color: '#1A1A2E',
                            boxSizing: 'border-box', outline: 'none', background: '#F8FAFC',
                            fontFamily: 'monospace',
                          }}
                          onFocus={e => e.target.style.borderColor = '#003F8A'}
                          onBlur={e => e.target.style.borderColor = '#E2E8F0'}
                        />
                      </div>

                      {/* Body */}
                      <div style={{ marginBottom: '16px' }}>
                        <label style={{ fontSize: '12px', fontWeight: '600', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '6px' }}>
                          Cuerpo del Correo
                        </label>
                        <textarea
                          value={edited.body || ''}
                          onChange={e => setEditedTemplates(prev => ({
                            ...prev,
                            [template.key]: { ...prev[template.key], body: e.target.value }
                          }))}
                          rows={14}
                          style={{
                            width: '100%',
                            border: '1.5px solid #E2E8F0', borderRadius: '10px',
                            padding: '12px', fontSize: '13px', color: '#1A1A2E',
                            boxSizing: 'border-box', outline: 'none', background: '#F8FAFC',
                            fontFamily: 'monospace', lineHeight: '1.6', resize: 'vertical',
                          }}
                          onFocus={e => e.target.style.borderColor = '#003F8A'}
                          onBlur={e => e.target.style.borderColor = '#E2E8F0'}
                        />
                      </div>

                      {/* Actions */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <button
                          onClick={() => handleReset(template.key)}
                          disabled={template.isDefault}
                          style={{
                            background: 'none', border: '1.5px solid #E2E8F0',
                            borderRadius: '10px', padding: '8px 16px',
                            fontSize: '13px', fontWeight: '500', color: template.isDefault ? '#CBD5E1' : '#64748B',
                            cursor: template.isDefault ? 'not-allowed' : 'pointer',
                            display: 'flex', alignItems: 'center', gap: '6px',
                          }}
                        >
                          <RotateCcw style={{ width: '14px', height: '14px' }} />
                          Restaurar Original
                        </button>

                        <button
                          onClick={() => handleSave(template.key)}
                          disabled={saving[template.key] || !changed}
                          style={{
                            background: changed ? '#003F8A' : '#E2E8F0',
                            color: changed ? 'white' : '#94A3B8',
                            border: 'none', borderRadius: '10px',
                            padding: '8px 20px', fontSize: '13px', fontWeight: '600',
                            cursor: changed ? 'pointer' : 'not-allowed',
                            display: 'flex', alignItems: 'center', gap: '6px',
                          }}
                        >
                          <Save style={{ width: '14px', height: '14px' }} />
                          {saving[template.key] ? 'Guardando...' : 'Guardar Cambios'}
                        </button>
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
