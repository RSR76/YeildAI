'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Sprout,
  LineChart,
  FlaskConical,
  CloudSun,
  Tractor,
  FileBarChart,
  Leaf,
  Map,
  UserPlus,
} from 'lucide-react';

import { useAuth } from '@/lib/auth/AuthContext';

const farmerNavItems = [
  { name: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' },
  { name: 'Recommendations', icon: Leaf, href: '/recommendations' },
  { name: 'Mandi Prices', icon: LineChart, href: '/mandi-prices' },
  { name: 'Yield Prediction', icon: Sprout, href: '/yield-prediction' },
  { name: 'Soil Analysis', icon: FlaskConical, href: '/soil-analysis' },
  { name: 'Weather', icon: CloudSun, href: '/weather' },
  { name: 'Farm Details', icon: Tractor, href: '/farm-details' },
  { name: 'Reports', icon: FileBarChart, href: '/reports' },
];

// Admin's world is regions, not a single farm — no Farm Details/Reports,
// but everything a farmer sees is still useful context (mandi prices,
// weather, yield models), plus the map-driven regional view.
const adminNavItems = [
  { name: 'Regions Map', icon: Map, href: '/admin' },
  { name: 'Recommendations', icon: Leaf, href: '/recommendations' },
  { name: 'Mandi Prices', icon: LineChart, href: '/mandi-prices' },
  { name: 'Weather', icon: CloudSun, href: '/weather' },
];

// A guest gets a taste of the read-only pages. Farm Details and Reports
// are left off — they're either write-heavy (add/edit/delete a farm) or
// tied to data a real account would have, so they'd mostly show empty/
// disabled states rather than something worth "checking out".
const guestNavItems = [
  { name: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' },
  { name: 'Recommendations', icon: Leaf, href: '/recommendations' },
  { name: 'Mandi Prices', icon: LineChart, href: '/mandi-prices' },
  { name: 'Weather', icon: CloudSun, href: '/weather' },
];

export function Sidebar() {
  const pathname = usePathname();
  const { isAdmin, isGuest } = useAuth();

  const navItems = isAdmin ? adminNavItems : isGuest ? guestNavItems : farmerNavItems;

  return (
    <aside className="w-64 bg-emerald-900 text-emerald-50 hidden md:flex flex-col">
      <div className="p-6 text-2xl font-bold text-emerald-200">YieldAI</div>

      {isGuest && (
        <div className="mx-4 mb-3 rounded-lg bg-emerald-800/70 px-3 py-2 text-xs text-emerald-100">
          Browsing as Guest — read-only preview.
        </div>
      )}

      <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center px-4 py-3 rounded-lg transition-colors ${
                isActive ? 'bg-emerald-800 text-white' : 'hover:bg-emerald-800/70 text-emerald-100'
              }`}
            >
              <item.icon className="w-5 h-5 mr-3 shrink-0" />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {isGuest && (
        <Link
          href="/signup"
          className="mx-4 mb-6 flex items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-3 font-medium text-emerald-950 hover:bg-emerald-400 transition-colors"
        >
          <UserPlus className="w-4 h-4" />
          Sign up to save farms
        </Link>
      )}
    </aside>
  );
}
