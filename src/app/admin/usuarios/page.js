'use client';

import { useEffect, useState } from 'react';
import { supabaseClient } from '@/lib/supabase-client';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { toast } from 'sonner';
import { UserPlus, Pencil, ToggleLeft, ToggleRight, Shield, User, Eye, KeyRound } from 'lucide-react';

const ROLES = ['AGENTE', 'SUPERVISOR', 'ADMINISTRADOR'];

const roleColors = {
  AGENTE: { bg: '#E8F0FB', text: '#003F8A' },
  SUPERVISOR: { bg: '#FEF9C3', text: '#854D0E' },
  ADMINISTRADOR: { bg: '#DCFCE7', text: '#166534' },
};

export default function AdminUsuariosPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [form, setForm] = useState({ email: '', full_name: '', role: 'AGENTE', password: '' });
  const [submitting, setSubmitting] = useState(false);
  const [tempPasswordData, setTempPasswordData] = useState(null);
  const router = useRouter();

  useEffect(() => {
    const init = async () => {
      const { data: { session: s } } = await supabaseClient.auth.getSession();
      if (!s) { router.push('/'); return; }
      setSession(s);
      await fetchUsers(s.access_token);
    };
    init();
  }, [router]);

  const fetchUsers = async (token) => {
    try {
      const res = await fetch('/api/admin/usuarios', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setUsers(await res.json());
      else if (res.status === 403) { toast.error('No tienes permisos para acceder a esta sección'); router.push('/dashboard'); }
    } catch (e) { toast.error('Error cargando usuarios'); }
    finally { setLoading(false); }
  };

  const handleSubmit = async () => {
    if (!form.email || !form.full_name) return toast.error('Email y nombre son obligatorios');
    if (!editingUser && !form.password) return toast.error('La contraseña es obligatoria para nuevos usuarios');
    setSubmitting(true);
    try {
      const url = editingUser ? `/api/admin/usuarios/${editingUser.id}` : '/api/admin/usuarios';
      const method = editingUser ? 'PATCH' : 'POST';
      const body = editingUser
        ? { full_name: form.full_name, role: form.role }
        : { email: form.email, full_name: form.full_name, role: form.role, password: form.password };

      const res = await fetch(url, {
        method,
        headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (res.ok) {
        toast.success(editingUser ? 'Usuario actualizado' : 'Usuario creado exitosamente');
        setShowForm(false);
        setEditingUser(null);
        setForm({ email: '', full_name: '', role: 'AGENTE', password: '' });
        await fetchUsers(session.access_token);
      } else {
        const d = await res.json();
        toast.error(d.error || 'Error al guardar usuario');
      }
    } catch (e) { toast.error('Error de red'); }
    finally { setSubmitting(false); }
  };

  const handleToggleActive = async (user) => {
    try {
      const res = await fetch(`/api/admin/usuarios/${user.id}`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !user.is_active })
      });
      if (res.ok) {
        toast.success(`Usuario ${user.is_active ? 'desactivado' : 'activado'}`);
        await fetchUsers(session.access_token);
      }
    } catch (e) { toast.error('Error al cambiar estado'); }
  };

  const handleResetPassword = async (targetUser) => {
    const confirmed = window.confirm(`¿Estás seguro de restablecer la contraseña de ${targetUser.full_name} (${targetUser.email})?`);
    if (!confirmed) return;
    try {
      const res = await fetch(`/api/admin/usuarios/${targetUser.id}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setTempPasswordData({ email: targetUser.email, name: targetUser.full_name, password: data.tempPassword });
        toast.success('Contraseña restablecida exitosamente');
      } else {
        const d = await res.json();
        toast.error(d.error || 'Error al restablecer contraseña');
      }
    } catch (e) { toast.error('Error de red'); }
  };

  const handleEdit = (user) => {
    setEditingUser(user);
    setForm({ email: user.email, full_name: user.full_name, role: user.role, password: '' });
    setShowForm(true);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#F4F7F9' }}>
      <Navbar />
      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '1.5rem' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#1A1A2E', margin: '0 0 4px', letterSpacing: '-0.5px' }}>
              Gestión de Usuarios
            </h1>
            <p style={{ fontSize: '14px', color: '#64748B', margin: 0 }}>
              Administra los agentes, supervisores y administradores del sistema.
            </p>
          </div>
          <button
            onClick={() => { setShowForm(true); setEditingUser(null); setForm({ email: '', full_name: '', role: 'AGENTE', password: '' }); }}
            style={{ background: '#003F8A', color: 'white', border: 'none', borderRadius: '10px', padding: '10px 20px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <UserPlus style={{ width: '16px', height: '16px' }} />
            Nuevo Usuario
          </button>
        </div>

        {/* Formulario */}
        {showForm && (
          <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '1.5rem', marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#1A1A2E', marginBottom: '1rem' }}>
              {editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '13px', fontWeight: '500', color: '#374151', display: 'block', marginBottom: '6px' }}>Nombre completo *</label>
                <input
                  type="text"
                  value={form.full_name}
                  onChange={e => setForm({ ...form, full_name: e.target.value })}
                  style={{ width: '100%', height: '40px', border: '1.5px solid #E2E8F0', borderRadius: '8px', padding: '0 12px', fontSize: '14px', boxSizing: 'border-box' }}
                  placeholder="Nombre Apellido"
                />
              </div>
              <div>
                <label style={{ fontSize: '13px', fontWeight: '500', color: '#374151', display: 'block', marginBottom: '6px' }}>Correo electrónico *</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  disabled={!!editingUser}
                  style={{ width: '100%', height: '40px', border: '1.5px solid #E2E8F0', borderRadius: '8px', padding: '0 12px', fontSize: '14px', boxSizing: 'border-box', background: editingUser ? '#F8FAFC' : 'white' }}
                  placeholder="agente@prontomatic.cl"
                />
              </div>
              <div>
                <label style={{ fontSize: '13px', fontWeight: '500', color: '#374151', display: 'block', marginBottom: '6px' }}>Rol *</label>
                <select
                  value={form.role}
                  onChange={e => setForm({ ...form, role: e.target.value })}
                  style={{ width: '100%', height: '40px', border: '1.5px solid #E2E8F0', borderRadius: '8px', padding: '0 12px', fontSize: '14px', boxSizing: 'border-box' }}
                >
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              {!editingUser && (
                <div>
                  <label style={{ fontSize: '13px', fontWeight: '500', color: '#374151', display: 'block', marginBottom: '6px' }}>Contraseña inicial *</label>
                  <input
                    type="password"
                    value={form.password}
                    onChange={e => setForm({ ...form, password: e.target.value })}
                    style={{ width: '100%', height: '40px', border: '1.5px solid #E2E8F0', borderRadius: '8px', padding: '0 12px', fontSize: '14px', boxSizing: 'border-box' }}
                    placeholder="Mínimo 6 caracteres"
                  />
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '1rem', justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowForm(false); setEditingUser(null); }} style={{ background: 'none', border: '1.5px solid #E2E8F0', borderRadius: '8px', padding: '8px 20px', fontSize: '14px', cursor: 'pointer', color: '#64748B' }}>
                Cancelar
              </button>
              <button onClick={handleSubmit} disabled={submitting} style={{ background: '#003F8A', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 20px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>
                {submitting ? 'Guardando...' : editingUser ? 'Guardar Cambios' : 'Crear Usuario'}
              </button>
            </div>
          </div>
        )}

        {/* Tabla de usuarios */}
        <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#64748B' }}>Cargando usuarios...</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                  {['Usuario', 'Correo', 'Rol', 'Estado', 'Acciones'].map(h => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((user, idx) => (
                  <tr key={user.id} style={{ borderBottom: idx < users.length - 1 ? '1px solid #F1F5F9' : 'none' }}>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#E8F0FB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: '700', color: '#003F8A', flexShrink: 0 }}>
                          {user.full_name.charAt(0).toUpperCase()}
                        </div>
                        <span style={{ fontSize: '14px', fontWeight: '600', color: '#1A1A2E' }}>{user.full_name}</span>
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: '13px', color: '#64748B' }}>{user.email}</td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ background: roleColors[user.role]?.bg, color: roleColors[user.role]?.text, padding: '3px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: '600' }}>
                        {user.role}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ background: user.is_active ? '#DCFCE7' : '#FEE2E2', color: user.is_active ? '#166534' : '#991B1B', padding: '3px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: '600' }}>
                        {user.is_active ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={() => handleEdit(user)} style={{ background: '#F1F5F9', border: 'none', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer', fontSize: '12px', fontWeight: '500', color: '#475569', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Pencil style={{ width: '12px', height: '12px' }} /> Editar
                        </button>
                        <button onClick={() => handleToggleActive(user)} style={{ background: user.is_active ? '#FEE2E2' : '#DCFCE7', border: 'none', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer', fontSize: '12px', fontWeight: '500', color: user.is_active ? '#991B1B' : '#166534', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          {user.is_active ? <ToggleLeft style={{ width: '12px', height: '12px' }} /> : <ToggleRight style={{ width: '12px', height: '12px' }} />}
                          {user.is_active ? 'Desactivar' : 'Activar'}
                        </button>
                        <button onClick={() => handleResetPassword(user)} style={{ background: '#FEF3C7', border: 'none', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer', fontSize: '12px', fontWeight: '500', color: '#92400E', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <KeyRound style={{ width: '12px', height: '12px' }} /> Contraseña
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {/* Diálogo de contraseña temporal */}
        {tempPasswordData && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.5)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', zIndex: 100
          }}
          onClick={() => setTempPasswordData(null)}
          >
            <div
              style={{
                background: 'white', borderRadius: '16px',
                padding: '2rem', maxWidth: '440px', width: '90%',
                boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
              }}
              onClick={e => e.stopPropagation()}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <KeyRound style={{ width: '20px', height: '20px', color: '#92400E' }} />
                </div>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1A1A2E', margin: 0 }}>Contraseña Restablecida</h3>
                  <p style={{ fontSize: '13px', color: '#64748B', margin: 0 }}>{tempPasswordData.name}</p>
                </div>
              </div>

              <div style={{
                background: '#FFFBEB', border: '1px solid #FDE68A',
                borderRadius: '10px', padding: '1rem', marginBottom: '1rem'
              }}>
                <p style={{ fontSize: '12px', color: '#92400E', fontWeight: '600', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Contraseña Temporal
                </p>
                <p style={{ fontSize: '20px', fontWeight: '700', color: '#1A1A2E', margin: 0, letterSpacing: '1px', fontFamily: 'monospace' }}>
                  {tempPasswordData.password}
                </p>
              </div>

              <p style={{ fontSize: '13px', color: '#64748B', margin: '0 0 1rem', lineHeight: '1.5' }}>
                Comunica esta contraseña temporal a <strong>{tempPasswordData.email}</strong>. El usuario deberá iniciar sesión con esta contraseña.
              </p>

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(tempPasswordData.password);
                    toast.success('Contraseña copiada al portapapeles');
                  }}
                  style={{ background: '#F1F5F9', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', color: '#475569' }}
                >
                  Copiar
                </button>
                <button
                  onClick={() => setTempPasswordData(null)}
                  style={{ background: '#003F8A', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
