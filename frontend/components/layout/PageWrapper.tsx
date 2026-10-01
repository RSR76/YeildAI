'use client';

import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Bell,
  ChevronDown,
  User,
} from 'lucide-react';
import type React from 'react';

interface PageWrapperProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  onBack?: () => void;
}

export function PageWrapper({
  children,
  title,
  subtitle,
  onBack,
}: PageWrapperProps) {
  return (
    <div className="min-h-screen w-full bg-white m-2">
      {/* TOP HEADER */}
      <header className="fixed left-[283px] right-0 top-0 z-40 h-[84px] border-b border-[#f0f1ef] bg-white">
        <div className="flex h-full items-center justify-end px-5 sm:px-8 lg:px-10">
          <div className="flex items-center gap-5">
            {/* Notifications */}
            <button
              type="button"
              aria-label="Notifications"
              className="relative flex h-10 w-10 items-center justify-center rounded-full text-[#374151] transition hover:bg-[#f5f7f4]"
            >
              <Bell
                className="h-6 w-6"
                strokeWidth={1.8}
              />
            </button>

            {/* Divider */}
            <div className="h-8 w-px bg-[#edf0eb]" />

            {/* User */}
            <button
              type="button"
              className="flex items-center gap-3 rounded-full px-2 py-1.5 transition hover:bg-[#f7f9f6]"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#f0f7eb]">
                <User
                  className="h-6 w-6 text-[#24833f]"
                  strokeWidth={1.8}
                />
              </div>

              <span className="hidden text-[15px] font-medium text-[#111827] sm:block">
                Hello, Farmer
              </span>

              <ChevronDown
                className="h-4 w-4 text-[#374151]"
                strokeWidth={2}
              />
            </button>
          </div>
        </div>
      </header>

      {/* PAGE CONTENT */}
      <motion.main
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="px-5 py-5 mt-[64px] sm:px-8 lg:px-10"
      >
        {/* PAGE TITLE */}
        <div className="mb-6">
          <div className="flex items-center gap-3">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                aria-label="Go back"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--forest-900)] transition-colors hover:bg-[var(--sage-100)]"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
            )}

            <h1 className="font-[var(--font-display)] text-[28px] text-[var(--forest-900)]">
              {title}
            </h1>
          </div>

          {subtitle && (
            <p
              className={`mt-1.5 text-sm text-[var(--ink-soft)] ${
                onBack ? 'pl-11' : ''
              }`}
            >
              {subtitle}
            </p>
          )}
        </div>

        {/* PAGE CONTENT */}
        {children}
      </motion.main>
    </div>
  );
}