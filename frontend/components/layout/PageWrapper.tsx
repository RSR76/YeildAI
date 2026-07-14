'use client';

import { motion } from 'framer-motion';
import type React from 'react';

interface PageWrapperProps {
  children: React.ReactNode;
  title: string;
}

export function PageWrapper({ children, title }: PageWrapperProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      <h2 className="font-[var(--font-display)] text-[28px] text-[var(--forest-900)] mb-6">{title}</h2>
      {children}
    </motion.div>
  );
}
