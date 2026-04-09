'use client';

import { useEffect, useState } from 'react';
import { supabaseClient } from '@/lib/supabase-client';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { toast } from 'sonner';
import { ArrowLeft, User, Mail, Shield, Save } from 'lucide-react';

const roleLabels = {
    AGENTE: 'Agente',
    SUPERVISOR: 'Supervisor',
    ADMINISTRADOR: 'Administrador',
};

const roleColors = {
    AGENTE: { bg: '#E8F0FB', text: '#003F8A' },
    SUPERVISOR: { bg: '#FEF9C3', text: '#854D0E' },
    ADMINISTRADOR: { bg: '#DCFCE7', text: '#166534' },
};

export default function PerfilPage() {
    const [session, setSession] = useState(null);
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [fullName, setFullName] = useState('');
    const [saving, setSaving] = useState(false);
    const router = useRouter();

    useEffect(() => {
        const init = async () => {
            const { data: { session: s } } = await supabaseClient.auth.getSession();
            if (!s) { router.push('/'); return; }
            setSession(s);
            try {
                const res = await fetch('/api/profile', {
                    headers: { 'Authorization': `Bearer ${s.access_token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    setProfile(data);
                    setFullName(data.full_name);
                }
            } catch (e) { toast.error('Error cargando perfil'); }
            finally { setLoading(false); }
        };
        init();
    }, [router]);

    const handleSave = async () => {
        if (!fullName.trim()) return toast.error('El nombre no puede estar vacío');
        if (fullName.trim() === profile.full_name) return toast.info('No hay cambios que guardar');
        setSaving(true);
        try {
            const res = await fetch('/api/profile', {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ full_name: fullName.trim() })
            });
            if (res.ok) {
                const updated = await res.json();
                setProfile(updated);
                toast.success('Nombre actualizado exitosamente');
            } else {
                const d = await res.json();
                toast.error(d.error || 'Error al guardar');
            }
        } catch (e) { toast.error('Error de red'); }
        finally { setSaving(false); }
    };

    if (loading) {
        return (
            <div style={{ minHeight: '100vh', background: '#F4F7F9' }}>
                <Navbar />
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 'calc(100vh - 56px)' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '50%', border: '3px solid #E2E8F0', borderTopColor: '#003F8A', animation: 'spin 0.8s linear infinite' }} />
                    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                </div>
            </div>
        );
    }

    return (
        <div style={{ minHeight: '100vh', background: '#F4F7F9' }}>
            <Navbar />
            <main style={{ maxWidth: '600px', margin: '0 auto', padding: '2rem' }}>
                <div
                    onClick={() => router.push('/dashboard')}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748B', cursor: 'pointer', marginBottom: '1.5rem', fontSize: '14px', fontWeight: '500' }}
                    onMouseEnter={e => e.currentTarget.style.color = '#003F8A'}
                    onMouseLeave={e => e.currentTarget.style.color = '#64748B'}
                >
                    <ArrowLeft style={{ width: '16px', height: '16px' }} /> Volver al Tablero
                </div>

                <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#1A1A2E', margin: '0 0 4px', letterSpacing: '-0.5px' }}>
                    Mi Perfil
                </h1>
                <p style={{ fontSize: '14px', color: '#64748B', margin: '0 0 1.5rem' }}>
                    Consulta tu información y actualiza tu nombre.
                </p>

                <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
                    {/* Email — solo lectura */}
                    <div style={{ padding: '20px 24px', borderBottom: '1px solid #F1F5F9' }}>
                        <label style={{ fontSize: '12px', fontWeight: '600', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                            <Mail style={{ width: '14px', height: '14px' }} /> Correo electrónico
                        </label>
                        <p style={{ fontSize: '15px', fontWeight: '500', color: '#94A3B8', margin: 0 }}>{profile?.email}</p>
                    </div>

                    {/* Rol — solo lectura */}
                    <div style={{ padding: '20px 24px', borderBottom: '1px solid #F1F5F9' }}>
                        <label style={{ fontSize: '12px', fontWeight: '600', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                            <Shield style={{ width: '14px', height: '14px' }} /> Rol en el sistema
                        </label>
                        <span style={{
                            background: roleColors[profile?.role]?.bg || '#F1F5F9',
                            color: roleColors[profile?.role]?.text || '#334155',
                            padding: '4px 12px',
                            borderRadius: '999px',
                            fontSize: '13px',
                            fontWeight: '600',
                        }}>
                            {roleLabels[profile?.role] || profile?.role}
                        </span>
                    </div>

                    {/* Nombre — editable */}
                    <div style={{ padding: '20px 24px' }}>
                        <label style={{ fontSize: '12px', fontWeight: '600', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                            <User style={{ width: '14px', height: '14px' }} /> Nombre completo
                        </label>
                        <input
                            type="text"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '10px 14px',
                                border: '1px solid #E2E8F0',
                                borderRadius: '10px',
                                fontSize: '15px',
                                fontWeight: '500',
                                color: '#1A1A2E',
                                outline: 'none',
                                boxSizing: 'border-box',
                            }}
                            onFocus={e => e.target.style.borderColor = '#003F8A'}
                            onBlur={e => e.target.style.borderColor = '#E2E8F0'}
                        />
                    </div>

                    {/* Botón guardar */}
                    <div style={{ padding: '16px 24px', background: '#F8FAFC', borderTop: '1px solid #F1F5F9', display: 'flex', justifyContent: 'flex-end' }}>
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            style={{
                                background: '#003F8A',
                                color: 'white',
                                border: 'none',
                                borderRadius: '10px',
                                padding: '10px 20px',
                                fontSize: '14px',
                                fontWeight: '600',
                                cursor: saving ? 'not-allowed' : 'pointer',
                                opacity: saving ? 0.6 : 1,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                            }}
                        >
                            <Save style={{ width: '16px', height: '16px' }} />
                            {saving ? 'Guardando...' : 'Guardar Cambios'}
                        </button>
                    </div>
                </div>
            </main>
        </div>
    );
}