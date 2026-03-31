'use client';

import { useState, useEffect } from 'react';
import { supabaseClient } from '@/lib/supabase-client';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { LogOut, Ticket, Bell, Settings } from 'lucide-react';

export default function Navbar() {
  const [user, setUser] = useState(null);
  const router = useRouter();

  useEffect(() => {
    supabaseClient.auth.getUser().then(({ data }) => {
      setUser(data?.user || null);
    });
  }, []);

  const handleLogout = async () => {
    await supabaseClient.auth.signOut();
    router.push('/');
  };

  if (!user) return null;

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
          onClick={() => router.push('/dashboard')}
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
          <Button variant="ghost" size="icon" style={{ borderRadius: '50%', color: '#64748B' }}>
            <Settings style={{ width: '18px', height: '18px' }} />
          </Button>
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
