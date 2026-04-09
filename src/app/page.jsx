'use client';

import { useState } from 'react';
import { supabaseClient } from '@/lib/supabase-client';
import { toast } from 'sonner';
import Image from 'next/image';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabaseClient.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      toast.error(error.message || 'Error al iniciar sesión');
      setLoading(false);
    } else {
      toast.success('Sesión iniciada correctamente');
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 500);
    }
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
      {/* Círculos decorativos de fondo */}
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
        position: 'absolute', top: '40%', left: '10%',
        width: '180px', height: '180px', borderRadius: '50%',
        background: 'rgba(255,215,0,0.04)', pointerEvents: 'none'
      }} />

      {/* Card principal */}
      <div style={{
        background: 'white',
        borderRadius: '20px',
        padding: '2.5rem 2rem',
        width: '100%',
        maxWidth: '400px',
        position: 'relative',
        zIndex: 1
      }}>

        {/* Branding: logo + título */}
        <div style={{
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', marginBottom: '1.75rem', gap: '1rem'
        }}>
          <Image
            src="/logo-prontomatic.png"
            alt="Logo Prontomatic"
            width={120}
            height={120}
            style={{ objectFit: 'contain' }}
            priority
          />
          <div style={{ textAlign: 'center' }}>
            <h1 style={{
              fontSize: '22px', fontWeight: '700',
              color: '#003F8A', margin: '0 0 4px'
            }}>
              ProntoTicket
            </h1>
            <p style={{ fontSize: '13px', color: '#64748B', margin: 0 }}>
              Sistema de Soporte Técnico
            </p>
          </div>
        </div>

        {/* Divisor decorativo */}
        <div style={{
          height: '1px',
          background: 'linear-gradient(to right, transparent, #E2E8F0, transparent)',
          marginBottom: '1.75rem'
        }} />

        {/* Formulario */}
        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: '1rem' }}>
            <label
              htmlFor="email"
              style={{
                display: 'block', fontSize: '13px',
                fontWeight: '500', color: '#374151', marginBottom: '6px'
              }}
            >
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

          <div style={{ marginBottom: '1.5rem' }}>
            <label
              htmlFor="password"
              style={{
                display: 'block', fontSize: '13px',
                fontWeight: '500', color: '#374151', marginBottom: '6px'
              }}
            >
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              placeholder="••••••••"
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

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', height: '46px',
              background: loading ? '#94A3B8' : '#003F8A',
              color: 'white', border: 'none', borderRadius: '10px',
              fontSize: '15px', fontWeight: '600', cursor: loading ? 'not-allowed' : 'pointer',
              letterSpacing: '0.3px', fontFamily: 'inherit',
              transition: 'background 0.2s'
            }}
          >
            {loading ? 'Iniciando...' : 'Iniciar Sesión'}
          </button>
        </form>

        <p style={{
          textAlign: 'center', fontSize: '12px',
          color: '#94A3B8', marginTop: '1.25rem', marginBottom: 0
        }}>
          Acceso exclusivo para personal de Prontomatic
        </p>
      </div>
    </main>
  );
}
