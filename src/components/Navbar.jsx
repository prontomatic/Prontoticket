'use client';

import { useState, useEffect, useRef } from 'react';
import { supabaseClient } from '@/lib/supabase-client';
import { useRouter } from 'next/navigation';
import { LogOut, Ticket, Settings, User, BarChart3, Users, Tag, Mail, Shield, ChevronDown } from 'lucide-react';
import { colors, shadows, radius, transitions, typography, roleConfig, stringToColor } from '@/lib/design-tokens';

export default function Navbar() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const router = useRouter();

  useEffect(() => {
    supabaseClient.auth.getUser().then(async ({ data }) => {
      setUser(data?.user || null);
      if (data?.user) {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (session) {
          const res = await fetch('/api/profile', {
            headers: { 'Authorization': `Bearer ${session.access_token}` }
          });
          if (res.ok) setProfile(await res.json());
        }
      }
    });
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    const confirmed = window.confirm('¿Estás seguro de que quieres salir del sistema?');
    if (!confirmed) return;
    await supabaseClient.auth.signOut();
    window.location.href = '/';
  };

  const navigateTo = (path) => {
    setMenuOpen(false);
    router.push(path);
  };

  if (!user) return null;

  const role = profile?.role;
  const userInitial = (profile?.full_name?.[0] || user.email?.[0] || '?').toUpperCase();
  const userAvatarColor = stringToColor(profile?.full_name || user.email);

  const allMenuItems = [
    { label: 'Mi Perfil', icon: User, path: '/perfil', roles: ['AGENTE', 'SUPERVISOR', 'ADMINISTRADOR'], group: 'personal' },
    { label: 'Métricas', icon: BarChart3, path: '/dashboard/metricas', roles: ['SUPERVISOR', 'ADMINISTRADOR'], group: 'supervision' },
    { label: 'Correos Filtrados', icon: Shield, path: '/admin/correos-filtrados', roles: ['SUPERVISOR', 'ADMINISTRADOR'], group: 'supervision' },
    { label: 'Usuarios', icon: Users, path: '/admin/usuarios', roles: ['ADMINISTRADOR'], group: 'admin' },
    { label: 'Categorías', icon: Tag, path: '/admin/categorias', roles: ['ADMINISTRADOR'], group: 'admin' },
    { label: 'Configuración', icon: Settings, path: '/admin/configuracion', roles: ['ADMINISTRADOR'], group: 'admin' },
    { label: 'Plantillas de Correo', icon: Mail, path: '/admin/plantillas', roles: ['ADMINISTRADOR'], group: 'admin' },
  ];

  const visibleItems = role ? allMenuItems.filter(item => item.roles.includes(role)) : [];
  const roleStyle = role ? roleConfig[role] : null;

  return (
    <nav style={{
      background: colors.surface,
      borderBottom: `1px solid ${colors.border}`,
      position: 'sticky',
      top: 0,
      zIndex: 50,
      backdropFilter: 'saturate(180%) blur(8px)',
    }}>
      <div style={{
        maxWidth: '1600px',
        margin: '0 auto',
        padding: '0 2rem',
        height: '60px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        {/* Logo */}
        <div
          style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}
          onClick={() => window.location.href = '/dashboard'}
        >
          <div style={{
            background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.primaryDark} 100%)`,
            padding: '8px',
            borderRadius: radius.md,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: shadows.primarySoft,
            position: 'relative',
          }}>
            <Ticket style={{ width: '18px', height: '18px', color: colors.accent, strokeWidth: 2.5 }} />
          </div>
          <span style={{
            fontWeight: typography.weight.extrabold,
            fontSize: '18px',
            color: colors.textPrimary,
            letterSpacing: typography.trackingTight,
          }}>
            Pronto<span style={{ color: colors.primary }}>Ticket</span>
          </span>
        </div>

        {/* Acciones */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {/* Menú desplegable del engranaje */}
          <div ref={menuRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              style={{
                width: '38px',
                height: '38px',
                borderRadius: radius.pill,
                border: 'none',
                background: menuOpen ? colors.primarySoft : 'transparent',
                color: menuOpen ? colors.primary : colors.textMuted,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: transitions.base,
              }}
              onMouseEnter={e => { if (!menuOpen) { e.currentTarget.style.background = colors.surfaceAlt; } }}
              onMouseLeave={e => { if (!menuOpen) { e.currentTarget.style.background = 'transparent'; } }}
            >
              <Settings style={{ width: '18px', height: '18px' }} />
            </button>

            {menuOpen && visibleItems.length > 0 && (
              <div style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                right: 0,
                background: colors.surface,
                border: `1px solid ${colors.border}`,
                borderRadius: radius.md,
                boxShadow: shadows.lg,
                minWidth: '220px',
                padding: '6px',
                zIndex: 100,
                animation: 'dropdownFade 0.15s ease-out',
              }}>
                <style>{`
                  @keyframes dropdownFade {
                    from { opacity: 0; transform: translateY(-4px); }
                    to { opacity: 1; transform: translateY(0); }
                  }
                `}</style>
                {visibleItems.map((item, idx) => {
                  const prevItem = visibleItems[idx - 1];
                  const showSeparator = prevItem && prevItem.group !== item.group;

                  return (
                    <div key={item.path}>
                      {showSeparator && (
                        <div style={{ height: '1px', background: colors.borderSubtle, margin: '4px 8px' }} />
                      )}
                      <button
                        onClick={() => navigateTo(item.path)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          width: '100%',
                          padding: '10px 12px',
                          border: 'none',
                          background: 'none',
                          borderRadius: radius.sm,
                          cursor: 'pointer',
                          fontSize: '13px',
                          fontWeight: typography.weight.medium,
                          color: colors.textPrimary,
                          textAlign: 'left',
                          transition: transitions.fast,
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = colors.surfaceAlt; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
                      >
                        <item.icon style={{ width: '16px', height: '16px', color: colors.textMuted }} />
                        {item.label}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div style={{ width: '1px', height: '20px', background: colors.border, margin: '0 8px' }} />

          {/* Info del usuario */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: radius.pill,
              background: userAvatarColor,
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '13px',
              fontWeight: typography.weight.bold,
              boxShadow: shadows.xs,
            }}>
              {userInitial}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', lineHeight: '1.2' }}>
              <span style={{ fontSize: '13px', color: colors.textPrimary, fontWeight: typography.weight.semibold }}>
                {profile?.full_name || user.email.split('@')[0]}
              </span>
              {roleStyle && (
                <span style={{
                  fontSize: '10px',
                  fontWeight: typography.weight.bold,
                  color: roleStyle.color,
                  textTransform: 'uppercase',
                  letterSpacing: typography.trackingWide,
                  marginTop: '1px',
                }}>
                  {roleStyle.label}
                </span>
              )}
            </div>
          </div>

          <button
            onClick={handleLogout}
            style={{
              marginLeft: '12px',
              border: `1px solid ${colors.border}`,
              background: colors.surface,
              color: colors.textSecondary,
              borderRadius: radius.pill,
              padding: '7px 14px',
              fontSize: '13px',
              fontWeight: typography.weight.semibold,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              transition: transitions.base,
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = colors.danger;
              e.currentTarget.style.color = colors.danger;
              e.currentTarget.style.background = colors.dangerSoft;
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = colors.border;
              e.currentTarget.style.color = colors.textSecondary;
              e.currentTarget.style.background = colors.surface;
            }}
          >
            <LogOut style={{ width: '14px', height: '14px' }} />
            Salir
          </button>
        </div>
      </div>
    </nav>
  );
}