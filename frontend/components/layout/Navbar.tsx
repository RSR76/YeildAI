'use client';

import { usePathname, useRouter } from 'next/navigation';
import {
  Sprout,
  LayoutDashboard,
  House,
  Leaf,
  BarChart3,
  FlaskConical,
  CloudSun,
  TrendingUp,
  FileText,
  Headphones,
  LogOut,
  ShieldCheck,
  Sparkles,
  Bell,
  User,
  ChevronDown,
} from 'lucide-react';

import { useAuth } from '@/lib/auth/AuthContext';

const NAV_ITEMS = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    label: 'My Farm',
    href: '/farm-details',
    icon: House,
  },
  {
    label: 'Crop Recommendations',
    href: '/recommendations',
    icon: Leaf,
  },
  {
    label: 'Mandi Prices',
    href: '/mandi-prices',
    icon: BarChart3,
  },
  {
    label: 'Soil Analysis',
    href: '/soil-analysis',
    icon: FlaskConical,
  },
  {
    label: 'Weather',
    href: '/weather',
    icon: CloudSun,
  },
  {
    label: 'Yield Prediction',
    href: '/yield-prediction',
    icon: TrendingUp,
  },
  {
    label: 'Reports',
    href: '/reports',
    icon: FileText,
  },
];

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();

  const {
    user,
    isAdmin,
    isGuest,
    logout,
    exitGuestMode,
  } = useAuth();

  function handleLogout() {
    logout();
    router.push('/login');
  }

  function handleExitGuest() {
    exitGuestMode();
    router.push('/login');
  }

  const farmerName = isGuest
    ? 'Guest'
    : user?.name || 'Farmer';

  const initials = user?.name
    ? user.name
        .split(' ')
        .map((part) => part[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : null;

  return (
    <>
      {/* =====================================================
          LEFT SIDEBAR
      ===================================================== */}

      <aside className="fixed left-0 top-0 z-50 flex h-screen w-[283px] flex-col border-r border-[#edf0eb] bg-white">

        {/* LOGO */}

        <div className="px-8 pt-6">
          <button
            type="button"
            onClick={() => router.push('/dashboard')}
            className="text-left"
          >
            <div className="flex items-center gap-2.5">
              <Sprout className="h-8 w-8 text-[#55a83b]" />

              <span className="text-[24px] font-bold tracking-[-0.8px] text-[#24833f]">
                YeildAI
              </span>
            </div>

            <p className="mt-1.5 text-[11px] text-[#17251d]">
              Smart Farming. Better Tomorrow.
            </p>
          </button>
        </div>

        {/* NAVIGATION */}

        <nav className="mt-7 flex-1 px-4">
          <div className="space-y-1.5">

            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;

              const isActive =
                pathname === item.href ||
                (item.href !== '/dashboard' &&
                  pathname?.startsWith(`${item.href}/`));

              return (
                <button
                  key={item.href}
                  type="button"
                  onClick={() => router.push(item.href)}
                  className={`group flex w-full items-center gap-4 rounded-lg px-3 py-3 transition ${
                    isActive
                      ? 'bg-[#f2f7ed] text-[#17752f]'
                      : 'text-[#111827] hover:bg-[#f7f9f6]'
                  }`}
                >
                  <Icon
                    className={`h-6 w-6 shrink-0 ${
                      isActive
                        ? 'text-[#24833f]'
                        : 'text-[#4b5563]'
                    }`}
                    strokeWidth={1.8}
                  />

                  <span
                    className={`text-[14px] ${
                      isActive
                        ? 'font-semibold text-[#17752f]'
                        : 'font-medium text-[#111827]'
                    }`}
                  >
                    {item.label}
                  </span>
                </button>
              );
            })}

          </div>
        </nav>

        {/* ADMIN / GUEST */}

        {(isAdmin || isGuest) && (
          <div className="px-4 pb-2">

            {isAdmin && (
              <div className="mb-2 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-[11px] font-medium text-emerald-800">
                <ShieldCheck className="h-3.5 w-3.5" />
                Admin Mode
              </div>
            )}

            {isGuest && (
              <div className="mb-2 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-[11px] font-medium text-amber-800">
                <Sparkles className="h-3.5 w-3.5" />
                Guest Preview
              </div>
            )}

          </div>
        )}

        {/* NEED HELP */}

        <div className="px-4 pb-4">
          <button
            type="button"
            className="flex w-full items-center gap-3 rounded-lg bg-[#f4f8ef] px-4 py-3.5 text-left transition hover:bg-[#edf5e7]"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center">
              <Headphones
                className="h-6 w-6 text-[#24833f]"
                strokeWidth={1.8}
              />
            </div>

            <div>
              <p className="text-[15px] font-semibold text-[#17752f]">
                Need Help?
              </p>

              <p className="mt-0.5 text-[12px] text-[#111827]">
                Contact Support
              </p>
            </div>
          </button>
        </div>

        {/* LOGOUT */}

        {isGuest ? (
          <button
            type="button"
            onClick={handleExitGuest}
            className="mx-4 mb-4 flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-emerald-700 hover:bg-emerald-50"
          >
            <LogOut className="h-4 w-4" />
            Exit guest mode
          </button>
        ) : (
          <button
            type="button"
            onClick={handleLogout}
            className="mx-4 mb-4 flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        )}
      </aside>


      {/* =====================================================
          TOP HEADER
      ===================================================== */}

      
    </>
  );
}