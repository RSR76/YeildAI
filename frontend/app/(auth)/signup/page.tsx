'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2, Sprout } from 'lucide-react';

import { useAuth } from '@/lib/auth/AuthContext';
import { PersonaSelector } from '@/components/auth/PersonaSelector';
import type { Role } from '@/lib/auth/types';

/**
 * Wasn't in the files you shared — new page. This is where "when we login
 * or sign up we give them an option to choose their persona" lives: the
 * persona picker gates the rest of the form, and the choice is sent as
 * `role` to POST /auth/signup, fixed on the account from then on.
 */
export default function SignupPage() {
  const { signup } = useAuth();
  const router = useRouter();

  const [role, setRole] = useState<Role | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!role) {
      setError('Choose a persona to continue.');
      return;
    }

    setSubmitting(true);
    try {
      await signup(email, password, name, role);
      router.push(role === 'ADMIN' ? '/admin' : '/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create your account. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-50 px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-2">
          <Sprout className="h-6 w-6 text-emerald-700" />
          <span className="font-[var(--font-display)] text-xl text-[var(--forest-900)]">YieldAI</span>
        </div>

        <h1 className="mb-1 text-lg font-semibold text-stone-900">Create your account</h1>
        <p className="mb-5 text-sm text-stone-500">Choose how you&apos;ll use YieldAI. This can&apos;t be changed later.</p>

        <div className="mb-5">
          <PersonaSelector value={role} onChange={setRole} />
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-stone-600">Full name</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm outline-none focus:border-emerald-400"
              placeholder="Anita Sharma"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-stone-600">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm outline-none focus:border-emerald-400"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-stone-600">Password</label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm outline-none focus:border-emerald-400"
              placeholder="At least 8 characters"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-800 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-900 disabled:opacity-60"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {submitting ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-stone-500">
          Already have an account?{' '}
          <Link href="/login" className="font-medium text-emerald-700 hover:underline">
            Sign in
          </Link>
        </p>
        <p className="mt-1 text-center text-sm text-stone-500">
          Just looking?{' '}
          <Link href="/login" className="font-medium text-stone-700 hover:underline">
            Continue as guest
          </Link>
        </p>
      </div>
    </div>
  );
}
