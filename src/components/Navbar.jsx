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
    <nav className="bg-white/70 backdrop-blur-lg border-b border-gray-100 sticky top-0 z-50 shadow-sm transition-all duration-300">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center cursor-pointer hover:opacity-80 transition-opacity" onClick={() => router.push('/dashboard')}>
            <div className="bg-orange-100 p-2 rounded-xl mr-3">
              <Ticket className="h-6 w-6 text-orange-600" />
            </div>
            <span className="font-extrabold text-xl text-slate-800 tracking-tight">Pronto<span className="text-orange-600">Ticket</span></span>
          </div>
          <div className="flex items-center space-x-2 sm:space-x-4">
            <Button variant="ghost" size="icon" className="text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-full">
              <Bell className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" className="text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-full">
              <Settings className="h-5 w-5" />
            </Button>
            <div className="h-6 w-px bg-slate-200 mx-2 hidden sm:block"></div>
            <div className="text-sm font-medium text-slate-700 hidden sm:block">
              {user.email}
            </div>
            <Button variant="outline" size="sm" onClick={handleLogout} className="border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 shadow-sm rounded-full px-4">
              <LogOut className="h-4 w-4 mr-2" />
              Salir
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
}
