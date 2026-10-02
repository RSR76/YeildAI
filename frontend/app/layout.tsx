import type React from 'react';
import type { Metadata } from 'next';
import { AuthProvider } from '@/lib/auth/AuthContext';
import './globals.css';

const description =
  'BhaviAI helps farmers choose the best crops, check mandi prices, and increase profits with AI-powered predictions.';

export const metadata: Metadata = {
  metadataBase: new URL('https://bhaviai.in'),
  title: {
    default: 'BhaviAI',
    template: '%s | BhaviAI',
  },
  description,
  applicationName: 'BhaviAI',
  openGraph: {
    title: 'BhaviAI',
    description,
    url: 'https://bhaviai.in',
    siteName: 'BhaviAI',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'BhaviAI',
    description,
  },
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