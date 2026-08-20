'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  Sprout,
  Home,
  Plus,
  ArrowRight,
  Lightbulb,
} from 'lucide-react';

import { useAuth } from '@/lib/auth/AuthContext';
import { AddFarmModal } from '@/components/layout/AddFarmModal';

export default function FarmSelectPage() {
  const { activeFarm } = useAuth();
  const router = useRouter();
  const [showAddModal, setShowAddModal] = useState(false);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--canvas)] p-4 sm:p-8">
      <div className="grid w-full max-w-5xl grid-cols-1 overflow-hidden rounded-3xl bg-white shadow-[0_20px_60px_-24px_rgba(20,49,42,0.25)] lg:grid-cols-2">

        {/* LEFT SIDE */}
        <div className="relative flex flex-col justify-between overflow-hidden bg-[#f7f5eb] px-8 pt-10 sm:px-10">

          <div>
            {/* Logo */}
            <div className="flex items-center gap-2">
              <Sprout
                className="h-7 w-7 text-[var(--forest-600)]"
                strokeWidth={2.25}
              />

              <span className="font-[var(--font-display)] text-xl font-semibold">
                <span className="text-[var(--forest-900)]">
                  Yeild
                </span>
                <span className="text-[var(--forest-600)]">
                  AI
                </span>
              </span>
            </div>

            <p className="mt-0.5 pl-9 text-xs text-[var(--ink-soft)]">
              Smart Farming, Better Tomorrow.
            </p>

            {/* Heading */}
            <h1 className="mt-10 font-[var(--font-display)] text-3xl font-semibold text-[var(--forest-900)]">
              Let&apos;s get started!
            </h1>

            <p className="mt-2 text-sm leading-relaxed text-[var(--ink-soft)]">
              Continue with your existing farm or add a new one.
            </p>
          </div>

          {/* Farm image */}
          <div className="relative -mx-8 mt-8 h-64 overflow-hidden sm:-mx-10">
            <Image
                src="/images/farm-summary.png"
                alt="Farm fields"
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="h-full w-full object-fill"
                priority
            />
            </div>
        </div>

        {/* RIGHT SIDE */}
        <div className="flex flex-col justify-center px-8 py-10 sm:px-10">

          <h2 className="font-[var(--font-display)] text-xl font-semibold text-[var(--forest-900)]">
            Select an option
          </h2>

          <div className="mt-5 space-y-4">

            {/* CONTINUE WITH CURRENT FARM */}
            {activeFarm && (
              <button
                type="button"
                onClick={() => router.push('/farm-summary')}
                className="flex w-full items-center gap-4 rounded-2xl border border-stone-200 p-4 text-left transition-colors hover:border-[var(--forest-600)] hover:bg-[var(--sage-100)]/40"
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--sage-300)]">
                  <Home className="h-6 w-6 text-[var(--forest-900)]" />
                </span>

                <span className="flex-1">
                  <span className="block font-semibold text-[var(--forest-900)]">
                    Continue with Current Farm
                  </span>

                  <span className="block text-sm text-[var(--ink-soft)]">
                    View your farm dashboard and insights.
                  </span>
                </span>

                <ArrowRight className="h-5 w-5 shrink-0 text-[var(--forest-900)]" />
              </button>
            )}

            {/* OR */}
            {activeFarm && (
              <div className="flex items-center gap-3 text-xs text-stone-400">
                <div className="h-px flex-1 bg-stone-200" />
                <span>or</span>
                <div className="h-px flex-1 bg-stone-200" />
              </div>
            )}

            {/* ADD NEW FARM */}
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="flex w-full items-center gap-4 rounded-2xl border border-stone-200 p-4 text-left transition-colors hover:border-[var(--forest-600)] hover:bg-[var(--sage-100)]/40"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--forest-600)]">
                <Plus className="h-6 w-6 text-white" />
              </span>

              <span className="flex-1">
                <span className="block font-semibold text-[var(--forest-900)]">
                  Add New Farm
                </span>

                <span className="block text-sm text-[var(--ink-soft)]">
                  Add a new farm to get started.
                </span>
              </span>

              <ArrowRight className="h-5 w-5 shrink-0 text-[var(--forest-900)]" />
            </button>
          </div>

          {/* INFO MESSAGE */}
          <div className="mt-6 flex items-start gap-2.5 rounded-xl bg-[var(--sage-100)] px-4 py-3">
            <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-[var(--forest-600)]" />

            <p className="text-xs leading-snug text-[var(--forest-900)]">
              You can add more farms later from the Settings.
            </p>
          </div>
        </div>
      </div>

      {/* ADD FARM MODAL */}
      {showAddModal && (
        <AddFarmModal
          onClose={() => {
            setShowAddModal(false);
            router.push('/farm-summary');
          }}
        />
      )}
    </div>
  );
}