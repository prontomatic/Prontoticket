'use client';

import { useState, useEffect, useRef } from 'react';
import { supabaseClient } from '@/lib/supabase-client';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { LogOut, Ticket, Bell, Settings, User, BarChart3, Users, Tag, Mail } from 'lucide-react';

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

  const allMenuItems = [
    { label: 'Mi Perfil', icon: User, path: '/perfil', roles: ['AGENTE', 'SUPERVISOR', 'ADMINISTRADOR'], group: 'personal' },
    { label: 'Métricas', icon: BarChart3, path: '/dashboard/metricas', roles: ['SUPERVISOR', 'ADMINISTRADOR'], group: 'supervision' },
    { label: 'Usuarios', icon: Users, path: '/admin/usuarios', roles: ['ADMINISTRADOR'], group: 'admin' },
    { label: 'Categorías', icon: Tag, path: '/admin/categorias', roles: ['ADMINISTRADOR'], group: 'admin' },
    { label: 'Configuración', icon: Settings, path: '/admin/configuracion', roles: ['ADMINISTRADOR'], group: 'admin' },
    { label: 'Plantillas de Correo', icon: Mail, path: '/admin/plantillas', roles: ['ADMINISTRADOR'], group: 'admin' },
  ];

  const visibleItems = role ? allMenuItems.filter(item => item.roles.includes(role)) : [];

  return (
    <nav style={{
      background: 'white',
      borderBottom: '1px solid #E2E8F0',
      position: 'sticky',
      top: 0,
      zIndex: 50,
    }}>
      <div style={{
        maxWidth: '1600px',
        margin: '0 auto',
        padding: '0 2rem',
        height: '56px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        {/* Logo */}
        <div
          style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}
          onClick={() => window.location.href = '/dashboard'}
        >
          <div style={{
            background: '#003F8A',
            padding: '7px',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Ticket style={{ width: '18px', height: '18px', color: '#FFD700' }} />
          </div>
          <span style={{ fontWeight: '800', fontSize: '17px', color: '#1A1A2E', letterSpacing: '-0.3px' }}>
            Pronto<span style={{ color: '#003F8A' }}>Ticket</span>
          </span>
        </div>

        {/* Acciones */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Button variant="ghost" size="icon" style={{ borderRadius: '50%', color: '#64748B' }}>
            <Bell style={{ width: '18px', height: '18px' }} />
          </Button>

          {/* Menú desplegable del engranaje */}
          <div ref={menuRef} style={{ position: 'relative' }}>
            <Button
              variant="ghost"
              size="icon"
              style={{ borderRadius: '50%', color: menuOpen ? '#003F8A' : '#64748B', background: menuOpen ? '#E8F0FB' : 'transparent' }}
              onClick={() => setMenuOpen(!menuOpen)}
            >
              <Settings style={{ width: '18px', height: '18px' }} />
            </Button>

            {menuOpen && visibleItems.length > 0 && (
              <div style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                right: 0,
                background: 'white',
                border: '1px solid #E2E8F0',
                borderRadius: '12px',
                boxShadow: '0 10px 30px rgba(0,0,0,0.12)',
                minWidth: '200px',
                padding: '6px',
                zIndex: 100,
              }}>
                {visibleItems.map((item, idx) => {
                  const prevItem = visibleItems[idx - 1];
                  const showSeparator = prevItem && prevItem.group !== item.group;

                  return (
                    <div key={item.path}>
                      {showSeparator && (
                        <div style={{ height: '1px', background: '#E2E8F0', margin: '4px 8px' }} />
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
                          borderRadius: '8px',
                          cursor: 'pointer',
                          fontSize: '13px',
                          fontWeight: '500',
                          color: '#334155',
                          textAlign: 'left',
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = '#F1F5F9'}
                        onMouseLeave={e => e.currentTarget.style.background = 'none'}
                      >
                        <item.icon style={{ width: '16px', height: '16px', color: '#64748B' }} />
                        {item.label}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div style={{ width: '1px', height: '20px', background: '#E2E8F0', margin: '0 4px' }} />
          <span style={{ fontSize: '13px', color: '#475569', fontWeight: '500' }}>
            {user.email}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={handleLogout}
            style={{
              borderColor: '#E2E8F0',
              color: '#475569',
              borderRadius: '999px',
              padding: '0 14px',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <LogOut style={{ width: '14px', height: '14px' }} />
            Salir
          </Button>
        </div>
      </div>
    </nav>
  );
}