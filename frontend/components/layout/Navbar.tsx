'use client';

import { useState, useRef, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Bell, User, LogOut, ChevronDown } from 'lucide-react';

import { useAuth } from '@/lib/auth/AuthContext';
import { FarmSwitcher } from './FarmSwitcher';

const TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard Overview',
  '/recommendations': 'Crop Recommendations',
  '/mandi-prices': 'Mandi Prices',
  '/yield-prediction': 'Yield Prediction',
  '/soil-analysis': 'Soil Analysis',
  '/weather': 'Weather',
  '/farm-details': 'Farm Details',
  '/reports': 'Analytics Reports',
};

export function Navbar() {
  const pathname = usePathname();
  const title = (pathname && TITLES[pathname]) || 'YieldAI';

  const { user, logout } = useAuth();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleLogout() {
    logout();
    router.push('/login');
  }

  const initials = user?.name
    ? user.name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()
    : null;

  return (
    <header className="h-16 bg-white border-b border-stone-200 flex items-center justify-between px-6">
      <h2 className="text-xl font-semibold text-stone-800">{title}</h2>
      <div className="flex items-center space-x-3">
        <FarmSwitcher />

        <button className="p-2 text-stone-500 hover:bg-stone-100 rounded-full">
          <Bell className="w-5 h-5" />
        </button>

        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-1.5 rounded-full pl-1 pr-2 py-1 hover:bg-stone-100"
          >
            <div className="w-8 h-8 bg-emerald-100 text-emerald-800 rounded-full flex items-center justify-center font-semibold text-sm">
              {initials ?? <User className="w-4 h-4" />}
            </div>
            <ChevronDown className="h-3.5 w-3.5 text-stone-400" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 z-40 mt-2 w-56 rounded-xl border border-stone-200 bg-white p-1.5 shadow-lg">
              <div className="px-2.5 py-2">
                <div className="truncate text-sm font-medium text-stone-800">{user?.name}</div>
                <div className="truncate text-xs text-stone-500">{user?.email}</div>
              </div>
              <div className="my-1 border-t border-stone-100" />
              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm font-medium text-red-600 hover:bg-red-50"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}