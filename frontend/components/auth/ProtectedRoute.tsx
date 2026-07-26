'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type React from 'react';

import { useAuth } from '@/lib/auth/AuthContext';
import { Loading } from '@/components/ui/States';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
    const { isAuthenticated, isLoading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!isLoading && !isAuthenticated) {
            router.replace('/login');
        }
    }, [isLoading, isAuthenticated, router]);

    if (isLoading || !isAuthenticated) {
        return (
            <div className="flex h-full items-center justify-center">
                <Loading />
            </div>
        );
    }

    return <>{children}</>;
}