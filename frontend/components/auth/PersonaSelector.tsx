'use client';

import { Landmark, Tractor } from 'lucide-react';
import type { Role } from '@/lib/auth/types';

interface PersonaOption {
  role: Role;
  title: string;
  description: string;
  icon: typeof Landmark;
}

const PERSONAS: PersonaOption[] = [
  {
    role: 'FARMER',
    title: 'Farmer',
    description: 'Register your farms, track them, and get crop recommendations.',
    icon: Tractor,
  },
  {
    role: 'ADMIN',
    title: 'Admin (Govt)',
    description: 'View all registered farms across states and districts, with mapping and recommendations for each area.',
    icon: Landmark,
  },
];

/**
 * Persona is chosen once here, at signup, and is fixed on the account from
 * then on — there's no "switch persona" flow elsewhere in the app. Guest
 * is deliberately not one of these options: it isn't a stored role, it's
 * the "Continue as guest" link on the login page (no account at all).
 */
export function PersonaSelector({ value, onChange }: { value: Role | null; onChange: (role: Role) => void }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Choose your persona">
      {PERSONAS.map((p) => {
        const selected = value === p.role;
        return (
          <button
            key={p.role}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(p.role)}
            className={`flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-colors ${
              selected
                ? 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500'
                : 'border-stone-200 bg-white hover:border-emerald-300'
            }`}
          >
            <p.icon className={`h-5 w-5 ${selected ? 'text-emerald-700' : 'text-stone-500'}`} />
            <span className="font-[var(--font-display)] text-base text-[var(--forest-900)]">{p.title}</span>
            <span className="text-xs text-stone-500">{p.description}</span>
          </button>
        );
      })}
    </div>
  );
}
