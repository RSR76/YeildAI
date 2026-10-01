'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Mail, Lock, User, Eye, EyeOff } from 'lucide-react';

import { useAuth } from '@/lib/auth/AuthContext';
import {
  AuthShell,
  AuthField,
  AuthSubmitButton,
} from '@/lib/auth/AuthShell';
import { PersonaSelector } from '@/components/auth/PersonaSelector';
import type { Role } from '@/lib/auth/types';

export default function SignupPage() {
  const { signup } = useAuth();
  const router = useRouter();

  const [role, setRole] = useState<Role | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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

      router.push(role === 'ADMIN' ? '/admin' : '/farm-select');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not create your account. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell activeTab="signup">
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mb-3.5">
        <PersonaSelector
          value={role}
          onChange={setRole}
        />
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-3.5"
      >
        <AuthField
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Full name"
          icon={<User className="h-4 w-4" />}
        />

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
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password (min. 8 characters)"
          icon={<Lock className="h-4 w-4" />}
          trailing={
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="pointer-events-auto"
              aria-label={
                showPassword
                  ? 'Hide password'
                  : 'Show password'
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

        <AuthSubmitButton
          type="submit"
          disabled={submitting}
        >
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            'Sign Up'
          )}
        </AuthSubmitButton>
      </form>
    </AuthShell>
  );
}