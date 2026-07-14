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
} from 'lucide-react';

const navItems = [
  { name: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' },
  { name: 'Recommendations', icon: Leaf, href: '/recommendations' },
  { name: 'Mandi Prices', icon: LineChart, href: '/mandi-prices' },
  { name: 'Yield Prediction', icon: Sprout, href: '/yield-prediction' },
  { name: 'Soil Analysis', icon: FlaskConical, href: '/soil-analysis' },
  { name: 'Weather', icon: CloudSun, href: '/weather' },
  { name: 'Farm Details', icon: Tractor, href: '/farm-details' },
  { name: 'Reports', icon: FileBarChart, href: '/reports' },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-emerald-900 text-emerald-50 hidden md:flex flex-col">
      <div className="p-6 text-2xl font-bold text-emerald-200">YieldAI</div>
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
    </aside>
  );
}