'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type React from 'react';

import { useAuth } from '@/lib/auth/AuthContext';
import { Loading } from '@/components/ui/States';

/**
 * Nest this inside ProtectedRoute (which already handles "logged in or
 * guest") for any page that's Admin-only. A Farmer or Guest who lands on
 * an /admin/* URL is redirected to /dashboard rather than shown a 403 page,
 * since they got there by mistake (typed URL, stale bookmark), not by
 * intentionally probing access.
 */
export function AdminRoute({ children }: { children: React.ReactNode }) {
    const { isAdmin, isLoading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!isLoading && !isAdmin) {
            router.replace('/dashboard');
        }
    }, [isLoading, isAdmin, router]);

    if (isLoading) {
        return <Loading />;
    }

    if (!isAdmin) {
        return null;
    }

    return <>{children}</>;
}
