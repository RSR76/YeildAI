'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Mail, Lock, Eye, EyeOff } from 'lucide-react';

import { useAuth } from '@/lib/auth/AuthContext';
import {
  AuthShell,
  AuthField,
  AuthSubmitButton,
} from '@/lib/auth/AuthShell';

export default function LoginPage() {
  const { login, enterGuestMode } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await login(email, password);
      router.push('/farm-select');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not sign in. Check your email and password.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  function handleGuest() {
    enterGuestMode();
    router.push('/dashboard');
  }

  return (
    <AuthShell activeTab="login">
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3.5">
        <AuthField
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          icon={<Mail className="h-4 w-4" />}
        />

        <AuthField
          type={showPassword ? 'text' : 'password'}
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          icon={<Lock className="h-4 w-4" />}
          trailing={
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="pointer-events-auto"
              aria-label={
                showPassword ? 'Hide password' : 'Show password'
              }
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          }
        />

        <div className="flex justify-end">
          <button
            type="button"
            className="text-xs font-medium text-stone-500 hover:text-emerald-700"
          >
            Forgot password?
          </button>
        </div>

        <AuthSubmitButton
          type="submit"
          disabled={submitting}
        >
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            'Login'
          )}
        </AuthSubmitButton>
      </form>

      <div className="my-5 flex items-center gap-3">
        <div className="h-px flex-1 bg-stone-200" />
        <span className="text-xs text-stone-400">or</span>
        <div className="h-px flex-1 bg-stone-200" />
      </div>

      <button
        type="button"
        disabled
        title="Google sign-in isn't set up on this backend yet"
        className="flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl border border-stone-200 py-3 text-sm font-medium text-stone-400"
      >
        <GoogleIcon />
        Continue with Google
      </button>

      <button
        type="button"
        onClick={handleGuest}
        className="mt-3 w-full text-center text-xs font-medium text-stone-400 hover:text-emerald-700"
      >
        Continue as guest
      </button>
    </AuthShell>
  );
}

function GoogleIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.29A7.14 7.14 0 0 1 4.89 12c0-.79.14-1.56.38-2.29V6.62H1.29A11.96 11.96 0 0 0 0 12c0 1.94.46 3.77 1.29 5.38l3.98-3.09Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.94 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75Z"
      />
    </svg>
  );
}

