import type React from 'react';
import type { Metadata } from 'next';
import { AuthProvider } from '@/lib/auth/AuthContext';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'BhaviAI',
    template: '%s | BhaviAI',
  },
  description:
    'BhaviAI helps farmers choose the best crops, check mandi prices, and increase profits with AI-powered predictions.',
  applicationName: 'BhaviAI',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="h-screen bg-[#F7F6F0] text-[#1B221D]">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}