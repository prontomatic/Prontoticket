'use client';

import { useState, useEffect } from 'react';
import { supabaseClient } from '@/lib/supabase-client';
import { toast } from 'sonner';
import Image from 'next/image';
import { CheckCircle2 } from 'lucide-react';

export default function ActualizarPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabaseClient.auth.getSession();
      if (session) {
        setSessionReady(true);
      }
      setChecking(false);
    };
    checkSession();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!password || password.length < 6) {
      return toast.error('La contraseña debe tener al menos 6 caracteres');
    }
    if (password !== confirmPassword) {
      return toast.error('Las contraseñas no coinciden');
    }

    setLoading(true);

    const { error } = await supabaseClient.auth.updateUser({ password });

    if (error) {
      toast.error(error.message || 'Error al actualizar contraseña');
    } else {
      setSuccess(true);
      toast.success('Contraseña actualizada exitosamente');
      // Cerrar sesión para que el usuario ingrese con su nueva contraseña
      await supabaseClient.auth.signOut();
    }
    setLoading(false);
  };

  return (
    <main style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #003F8A 0%, #002F6C 50%, #001A3D 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
      position: 'relative',
      overflow: 'hidden'
    }}>
      <div style={{
        position: 'absolute', top: '-80px', right: '-80px',
        width: '320px', height: '320px', borderRadius: '50%',
        background: 'rgba(255,215,0,0.06)', pointerEvents: 'none'
      }} />
      <div style={{
        position: 'absolute', bottom: '-100px', left: '-60px',
        width: '400px', height: '400px', borderRadius: '50%',
        background: 'rgba(255,255,255,0.04)', pointerEvents: 'none'
      }} />

      <div style={{
        background: 'white',
        borderRadius: '20px',
        padding: '2.5rem 2rem',
        width: '100%',
        maxWidth: '400px',
        position: 'relative',
        zIndex: 1
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '1.75rem', gap: '1rem' }}>
          <Image
            src="/logo-prontomatic.png"
            alt="Logo Prontomatic"
            width={120}
            height={120}
            style={{ objectFit: 'contain' }}
            priority
          />
          <div style={{ textAlign: 'center' }}>
            <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#003F8A', margin: '0 0 4px' }}>
              {success ? 'Contraseña Actualizada' : 'Nueva Contraseña'}
            </h1>
            {!success && !checking && sessionReady && (
              <p style={{ fontSize: '13px', color: '#64748B', margin: 0 }}>
                Ingresa tu nueva contraseña
              </p>
            )}
          </div>
        </div>

        <div style={{ height: '1px', background: 'linear-gradient(to right, transparent, #E2E8F0, transparent)', marginBottom: '1.75rem' }} />

        {success ? (
          <div style={{ textAlign: 'center', padding: '1rem 0' }}>
            <div style={{
              width: '56px', height: '56px', borderRadius: '50%',
              background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 1rem'
            }}>
              <CheckCircle2 style={{ width: '28px', height: '28px', color: '#166534' }} />
            </div>
            <p style={{ fontSize: '14px', color: '#64748B', margin: '0 0 1.5rem', lineHeight: '1.5' }}>
              Tu contraseña ha sido actualizada correctamente. Ya puedes iniciar sesión con tu nueva contraseña.
            </p>
            <button
              onClick={() => window.location.href = '/'}
              style={{
                width: '100%', height: '46px',
                background: '#003F8A', color: 'white',
                border: 'none', borderRadius: '10px',
                fontSize: '15px', fontWeight: '600',
                cursor: 'pointer', fontFamily: 'inherit'
              }}
            >
              Ir a Iniciar Sesión
            </button>
          </div>
        ) : checking ? (
          <div style={{ textAlign: 'center', padding: '2rem 0' }}>
            <div style={{
              width: '48px', height: '48px', borderRadius: '50%',
              border: '3px solid #E2E8F0', borderTopColor: '#003F8A',
              animation: 'spin 0.8s linear infinite',
              margin: '0 auto 1rem'
            }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            <p style={{ fontSize: '14px', color: '#64748B', margin: 0 }}>
              Verificando enlace de recuperación...
            </p>
          </div>
        ) : !sessionReady ? (
          <div style={{ textAlign: 'center', padding: '1rem 0' }}>
            <p style={{ fontSize: '14px', color: '#DC2626', fontWeight: '600', margin: '0 0 8px' }}>
              Enlace inválido o expirado
            </p>
            <p style={{ fontSize: '13px', color: '#64748B', margin: '0 0 1.5rem', lineHeight: '1.5' }}>
              El enlace de recuperación ya fue utilizado o ha expirado. Solicita uno nuevo desde la página de inicio de sesión.
            </p>
            <button
              onClick={() => window.location.href = '/recuperar-password'}
              style={{
                width: '100%', height: '46px',
                background: '#003F8A', color: 'white',
                border: 'none', borderRadius: '10px',
                fontSize: '15px', fontWeight: '600',
                cursor: 'pointer', fontFamily: 'inherit'
              }}
            >
              Solicitar nuevo enlace
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '1rem' }}>
              <label htmlFor="password" style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#374151', marginBottom: '6px' }}>
                Nueva Contraseña
              </label>
              <input
                id="password"
                type="password"
                placeholder="Mínimo 6 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{
                  width: '100%', height: '42px',
                  border: '1.5px solid #E2E8F0', borderRadius: '10px',
                  padding: '0 12px', fontSize: '14px', color: '#1A1A2E',
                  boxSizing: 'border-box', outline: 'none',
                  background: '#F8FAFC', fontFamily: 'inherit'
                }}
              />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label htmlFor="confirmPassword" style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#374151', marginBottom: '6px' }}>
                Confirmar Contraseña
              </label>
              <input
                id="confirmPassword"
                type="password"
                placeholder="Repite tu nueva contraseña"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                style={{
                  width: '100%', height: '42px',
                  border: '1.5px solid #E2E8F0', borderRadius: '10px',
                  padding: '0 12px', fontSize: '14px', color: '#1A1A2E',
                  boxSizing: 'border-box', outline: 'none',
                  background: '#F8FAFC', fontFamily: 'inherit'
                }}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', height: '46px',
                background: loading ? '#94A3B8' : '#003F8A',
                color: 'white', border: 'none', borderRadius: '10px',
                fontSize: '15px', fontWeight: '600',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit', transition: 'background 0.2s'
              }}
            >
              {loading ? 'Actualizando...' : 'Actualizar Contraseña'}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
