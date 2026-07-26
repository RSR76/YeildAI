'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Mail, Lock, User, AlertCircle } from 'lucide-react';

import { useAuth } from '@/lib/auth/AuthContext';

export default function SignupPage() {
    const { signup } = useAuth();
    const router = useRouter();

    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);

        if (password.length < 8) {
            setError('Password must be at least 8 characters.');
            return;
        }

        setSubmitting(true);
        try {
            await signup(email, password, name);
            router.push('/dashboard');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div className="rounded-[18px] border border-white/70 bg-white/80 p-8 shadow-[0_1px_2px_rgba(20,49,42,0.04),0_16px_40px_-20px_rgba(20,49,42,0.22)] backdrop-blur-[14px]">
            <h1 className="mb-1 font-[var(--font-display)] text-2xl text-[var(--forest-900)]">Create your account</h1>
            <p className="mb-6 text-sm text-stone-500">Start tracking crops and prices with YieldAI.</p>

            {error && (
                <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{error}</span>
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="mb-1.5 block text-sm font-medium text-stone-700" htmlFor="name">
                        Full name
                    </label>
                    <div className="flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2.5 focus-within:border-emerald-400">
                        <User className="h-4 w-4 text-stone-400" />
                        <input
                            id="name"
                            type="text"
                            required
                            autoComplete="name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Ravi Kumar"
                            className="w-full bg-transparent text-sm text-stone-800 outline-none placeholder:text-stone-400"
                        />
                    </div>
                </div>

                <div>
                    <label className="mb-1.5 block text-sm font-medium text-stone-700" htmlFor="email">
                        Email
                    </label>
                    <div className="flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2.5 focus-within:border-emerald-400">
                        <Mail className="h-4 w-4 text-stone-400" />
                        <input
                            id="email"
                            type="email"
                            required
                            autoComplete="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@example.com"
                            className="w-full bg-transparent text-sm text-stone-800 outline-none placeholder:text-stone-400"
                        />
                    </div>
                </div>

                <div>
                    <label className="mb-1.5 block text-sm font-medium text-stone-700" htmlFor="password">
                        Password
                    </label>
                    <div className="flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2.5 focus-within:border-emerald-400">
                        <Lock className="h-4 w-4 text-stone-400" />
                        <input
                            id="password"
                            type="password"
                            required
                            minLength={8}
                            autoComplete="new-password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="At least 8 characters"
                            className="w-full bg-transparent text-sm text-stone-800 outline-none placeholder:text-stone-400"
                        />
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={submitting}
                    className="w-full rounded-lg bg-emerald-800 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-900 disabled:opacity-60"
                >
                    {submitting ? 'Creating account…' : 'Create account'}
                </button>
            </form>

            <p className="mt-6 text-center text-sm text-stone-500">
                Already have an account?{' '}
                <Link href="/login" className="font-medium text-emerald-700 hover:underline">
                    Sign in
                </Link>
            </p>
        </div>
    );
}