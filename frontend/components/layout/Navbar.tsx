import { Bell, User } from 'lucide-react';

export function Navbar() {
  return (
    <header className="h-16 bg-white border-b border-stone-200 flex items-center justify-between px-6">
      <h2 className="text-xl font-semibold text-stone-800">Dashboard Overview</h2>
      <div className="flex items-center space-x-4">
        <button className="p-2 text-stone-500 hover:bg-stone-100 rounded-full">
          <Bell className="w-5 h-5" />
        </button>
        <div className="w-8 h-8 bg-emerald-100 text-emerald-800 rounded-full flex items-center justify-center font-semibold">
          <User className="w-5 h-5" />
        </div>
      </div>
    </header>
  );
}
