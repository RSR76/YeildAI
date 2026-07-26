import type React from 'react';
import { AuthProvider } from '@/lib/auth/AuthContext';
import './globals.css';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="h-screen bg-[#F7F6F0] text-[#1B221D]">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}