import { LayoutDashboard, TrendingUp, Sprout, Building2, Settings } from 'lucide-react';

export function Sidebar() {
  const navItems = [
    { name: 'Dashboard', icon: LayoutDashboard, href: '/' },
    { name: 'Forecasts', icon: TrendingUp, href: '/forecasts' },
    { name: 'Recommendations', icon: Sprout, href: '/recommendations' },
    { name: 'Brokers', icon: Building2, href: '/brokers' },
  ];

  return (
    <aside className="w-64 bg-emerald-900 text-emerald-50 hidden md:flex flex-col">
      <div className="p-6 text-2xl font-bold text-emerald-200">YeildAI</div>
      <nav className="flex-1 px-4 space-y-2">
        {navItems.map((item) => (
          <a
            key={item.name}
            href={item.href}
            className="flex items-center px-4 py-3 rounded-lg hover:bg-emerald-800 transition-colors"
          >
            <item.icon className="w-5 h-5 mr-3" />
            {item.name}
          </a>
        ))}
      </nav>
      <div className="p-4 border-t border-emerald-800">
        <a href="/settings" className="flex items-center px-4 py-3 hover:bg-emerald-800 rounded-lg">
          <Settings className="w-5 h-5 mr-3" />
          Settings
        </a>
      </div>
    </aside>
  );
}
