'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type React from 'react';

import { useAuth } from '@/lib/auth/AuthContext';
import { Loading } from '@/components/ui/States';

/**
 * Wraps the whole (app) route group. A logged-in user (Admin or Farmer) OR
 * an active Guest session may pass through; anyone else is bounced to
 * /login. This file wasn't in the files you shared (the (app)/layout.tsx
 * imports it from '@/components/auth/ProtectedRoute' but it wasn't
 * included) — this is a best-effort reconstruction. If you already have a
 * version of this file, merge the `isGuest` line in rather than replacing
 * it wholesale.
 */
export function ProtectedRoute({ children }: { children: React.ReactNode }) {
    const { isAuthenticated, isGuest, isLoading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!isLoading && !isAuthenticated && !isGuest) {
            router.replace('/login');
        }
    }, [isLoading, isAuthenticated, isGuest, router]);

    if (isLoading) {
        return <Loading />;
    }

    if (!isAuthenticated && !isGuest) {
        return null;
    }

    return <>{children}</>;
}
