'use client';

import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import type React from 'react';

interface PageWrapperProps {
  children: React.ReactNode;
  title: string;
  /**
   * Optional subtitle shown under the title (e.g. "Update your farm
   * information."). Omitted by existing callers (e.g. Farm Details), so
   * this is additive and doesn't change their rendering.
   */
  subtitle?: string;
  /**
   * When provided, renders a back arrow to the left of the title and calls
   * this on click (e.g. router.back()). Omitted by existing callers.
   */
  onBack?: () => void;
}

export function PageWrapper({ children, title, subtitle, onBack }: PageWrapperProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
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

          <h2 className="font-[var(--font-display)] text-[28px] text-[var(--forest-900)]">{title}</h2>
        </div>

        {subtitle && (
          <p className={`mt-1.5 text-sm text-[var(--ink-soft)] ${onBack ? 'pl-11' : ''}`}>{subtitle}</p>
        )}
      </div>

      {children}
    </motion.div>
  );
}