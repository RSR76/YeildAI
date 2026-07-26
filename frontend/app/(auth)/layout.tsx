import type React from 'react';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex min-h-screen items-center justify-center px-4 py-12">
            <div className="w-full max-w-md">
                <div className="mb-8 text-center">
                    <span className="font-[var(--font-display)] text-3xl text-[var(--forest-900)]">YieldAI</span>
                </div>
                {children}
            </div>
        </div>
    );
}