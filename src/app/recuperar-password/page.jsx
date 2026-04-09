'use client';

import { useState } from 'react';
import { supabaseClient } from '@/lib/supabase-client';
import { toast } from 'sonner';
import Image from 'next/image';
import { ArrowLeft, Mail } from 'lucide-react';

export default function RecuperarPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return toast.error('Ingresa tu correo electrónico');
    setLoading(true);

    const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/actualizar-password`
    });

    if (error) {
      toast.error(error.message || 'Error al enviar correo de recuperación');
    } else {
      setSent(true);
      toast.success('Correo de recuperación enviado');
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
      {/* Círculos decorativos */}
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
              Recuperar Contraseña
            </h1>
            <p style={{ fontSize: '13px', color: '#64748B', margin: 0 }}>
              Te enviaremos un enlace para restablecer tu contraseña
            </p>
          </div>
        </div>

        <div style={{ height: '1px', background: 'linear-gradient(to right, transparent, #E2E8F0, transparent)', marginBottom: '1.75rem' }} />

        {!sent ? (
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '1.5rem' }}>
              <label htmlFor="email" style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#374151', marginBottom: '6px' }}>
                Correo Electrónico
              </label>
              <input
                id="email"
                type="email"
                placeholder="agente@prontomatic.cl"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
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
              {loading ? 'Enviando...' : 'Enviar enlace de recuperación'}
            </button>
          </form>
        ) : (
          <div style={{ textAlign: 'center', padding: '1rem 0' }}>
            <div style={{
              width: '56px', height: '56px', borderRadius: '50%',
              background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 1rem'
            }}>
              <Mail style={{ width: '28px', height: '28px', color: '#166534' }} />
            </div>
            <h2 style={{ fontSize: '17px', fontWeight: '700', color: '#1A1A2E', margin: '0 0 8px' }}>
              Correo enviado
            </h2>
            <p style={{ fontSize: '14px', color: '#64748B', margin: '0 0 4px', lineHeight: '1.5' }}>
              Revisa tu bandeja de entrada en <strong style={{ color: '#1A1A2E' }}>{email}</strong>
            </p>
            <p style={{ fontSize: '13px', color: '#94A3B8', margin: 0 }}>
              Si no lo ves, revisa la carpeta de spam.
            </p>
          </div>
        )}

        <button
          type="button"
          onClick={() => window.location.href = '/'}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
            margin: '1.5rem auto 0', background: 'none', border: 'none',
            color: '#64748B', fontSize: '13px', fontWeight: '500', cursor: 'pointer',
          }}
        >
          <ArrowLeft style={{ width: '14px', height: '14px' }} />
          Volver al inicio de sesión
        </button>
      </div>
    </main>
  );
}
