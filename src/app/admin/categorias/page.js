'use client';

import { useEffect, useState } from 'react';
import { supabaseClient } from '@/lib/supabase-client';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { toast } from 'sonner';
import { Plus, Pencil, ToggleLeft, ToggleRight } from 'lucide-react';

export default function AdminCategoriasPage() {
  const [categorias, setCategorias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingCat, setEditingCat] = useState(null);
  const [form, setForm] = useState({ name: '', description: '' });
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const init = async () => {
      const { data: { session: s } } = await supabaseClient.auth.getSession();
      if (!s) { router.push('/'); return; }
      setSession(s);
      await fetchCategorias(s.access_token);
    };
    init();
  }, [router]);

  const fetchCategorias = async (token) => {
    try {
      const res = await fetch('/api/admin/categorias', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setCategorias(await res.json());
      else if (res.status === 403) { toast.error('No tienes permisos'); router.push('/dashboard'); }
    } catch (e) { toast.error('Error cargando categorías'); }
    finally { setLoading(false); }
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) return toast.error('El nombre es obligatorio');
    setSubmitting(true);
    try {
      const url = editingCat ? `/api/admin/categorias/${editingCat.id}` : '/api/admin/categorias';
      const method = editingCat ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      if (res.ok) {
        toast.success(editingCat ? 'Categoría actualizada' : 'Categoría creada');
        setShowForm(false);
        setEditingCat(null);
        setForm({ name: '', description: '' });
        await fetchCategorias(session.access_token);
      } else {
        const d = await res.json();
        toast.error(d.error || 'Error al guardar');
      }
    } catch (e) { toast.error('Error de red'); }
    finally { setSubmitting(false); }
  };

  const handleToggleActive = async (cat) => {
    try {
      const res = await fetch(`/api/admin/categorias/${cat.id}`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !cat.is_active })
      });
      if (res.ok) {
        toast.success(`Categoría ${cat.is_active ? 'desactivada' : 'activada'}`);
        await fetchCategorias(session.access_token);
      }
    } catch (e) { toast.error('Error al cambiar estado'); }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#F4F7F9' }}>
      <Navbar />
      <main style={{ maxWidth: '900px', margin: '0 auto', padding: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '1.5rem' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#1A1A2E', margin: '0 0 4px' }}>
              Gestión de Categorías
            </h1>
            <p style={{ fontSize: '14px', color: '#64748B', margin: 0 }}>
              Define las categorías para clasificar los tickets de soporte.
            </p>
          </div>
          <button
            onClick={() => { setShowForm(true); setEditingCat(null); setForm({ name: '', description: '' }); }}
            style={{ background: '#003F8A', color: 'white', border: 'none', borderRadius: '10px', padding: '10px 20px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <Plus style={{ width: '16px', height: '16px' }} />
            Nueva Categoría
          </button>
        </div>

        {showForm && (
          <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '1.5rem', marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#1A1A2E', marginBottom: '1rem' }}>
              {editingCat ? 'Editar Categoría' : 'Nueva Categoría'}
            </h2>
            <div style={{ display: 'grid', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '13px', fontWeight: '500', color: '#374151', display: 'block', marginBottom: '6px' }}>Nombre *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  style={{ width: '100%', height: '40px', border: '1.5px solid #E2E8F0', borderRadius: '8px', padding: '0 12px', fontSize: '14px', boxSizing: 'border-box' }}
                  placeholder="Ej: Falla técnica, Consulta, Garantía..."
                />
              </div>
              <div>
                <label style={{ fontSize: '13px', fontWeight: '500', color: '#374151', display: 'block', marginBottom: '6px' }}>Descripción (opcional)</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  style={{ width: '100%', border: '1.5px solid #E2E8F0', borderRadius: '8px', padding: '10px 12px', fontSize: '14px', boxSizing: 'border-box', resize: 'vertical', minHeight: '80px', fontFamily: 'inherit' }}
                  placeholder="Descripción de cuándo usar esta categoría..."
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '1rem', justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowForm(false); setEditingCat(null); }} style={{ background: 'none', border: '1.5px solid #E2E8F0', borderRadius: '8px', padding: '8px 20px', fontSize: '14px', cursor: 'pointer', color: '#64748B' }}>
                Cancelar
              </button>
              <button onClick={handleSubmit} disabled={submitting} style={{ background: '#003F8A', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 20px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>
                {submitting ? 'Guardando...' : editingCat ? 'Guardar Cambios' : 'Crear Categoría'}
              </button>
            </div>
          </div>
        )}

        <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#64748B' }}>Cargando categorías...</div>
          ) : categorias.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#64748B' }}>
              <p style={{ fontWeight: '600', marginBottom: '4px' }}>No hay categorías creadas</p>
              <p style={{ fontSize: '13px' }}>Crea la primera categoría usando el botón de arriba.</p>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                  {['Nombre', 'Descripción', 'Estado', 'Acciones'].map(h => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {categorias.map((cat, idx) => (
                  <tr key={cat.id} style={{ borderBottom: idx < categorias.length - 1 ? '1px solid #F1F5F9' : 'none' }}>
                    <td style={{ padding: '14px 16px', fontSize: '14px', fontWeight: '600', color: '#1A1A2E' }}>{cat.name}</td>
                    <td style={{ padding: '14px 16px', fontSize: '13px', color: '#64748B' }}>{cat.description || '—'}</td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ background: cat.is_active ? '#DCFCE7' : '#FEE2E2', color: cat.is_active ? '#166534' : '#991B1B', padding: '3px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: '600' }}>
                        {cat.is_active ? 'Activa' : 'Inactiva'}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={() => { setEditingCat(cat); setForm({ name: cat.name, description: cat.description || '' }); setShowForm(true); }} style={{ background: '#F1F5F9', border: 'none', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer', fontSize: '12px', fontWeight: '500', color: '#475569', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Pencil style={{ width: '12px', height: '12px' }} /> Editar
                        </button>
                        <button onClick={() => handleToggleActive(cat)} style={{ background: cat.is_active ? '#FEE2E2' : '#DCFCE7', border: 'none', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer', fontSize: '12px', fontWeight: '500', color: cat.is_active ? '#991B1B' : '#166534', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          {cat.is_active ? <ToggleLeft style={{ width: '12px', height: '12px' }} /> : <ToggleRight style={{ width: '12px', height: '12px' }} />}
                          {cat.is_active ? 'Desactivar' : 'Activar'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
}
