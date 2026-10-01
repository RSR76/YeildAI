'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Sprout,
  MapPin,
  Pencil,
  ArrowRight,
  Ruler,
  Mountain,
  MapPinned,
} from 'lucide-react';

import { useAuth } from '@/lib/auth/AuthContext';
import { PageWrapper } from '@/components/layout/PageWrapper';

export default function FarmSummaryPage() {
  const router = useRouter();
  const { activeFarm, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !activeFarm) {
      router.replace('/farm-select');
    }
  }, [isLoading, activeFarm, router]);

  if (isLoading || !activeFarm) {
    return (
      <PageWrapper title="Your Farm">
        <div className="rounded-2xl border border-stone-200 bg-white p-8 text-center text-sm text-[var(--ink-soft)]">
          Loading your farm…
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper
      title="Your Farm"
      subtitle="Check your farm details before continuing."
    >
      <div className="mx-auto w-full max-w-4xl">

        {/* FARM CARD */}
        <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">

          {/* FARM HEADER */}
          <div className="flex items-center gap-4 border-b border-stone-100 px-5 py-5 sm:px-6">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[var(--sage-100)]">
              <Sprout
                className="h-7 w-7 text-[var(--forest-600)]"
                strokeWidth={2}
              />
            </div>

            <div className="min-w-0">
              <h2 className="truncate font-[var(--font-display)] text-xl font-semibold text-[var(--forest-900)]">
                {activeFarm.name}
              </h2>

              <div className="mt-1 flex items-center gap-1.5 text-sm text-stone-500">
                <MapPin className="h-3.5 w-3.5" />
                <span>
                  {activeFarm.district}, {activeFarm.state}
                </span>
              </div>
            </div>
          </div>

          {/* FARM DETAILS */}
          <div className="p-5 sm:p-6">

            <h3 className="mb-4 text-sm font-semibold text-[var(--forest-900)]">
              Farm details
            </h3>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">

              {/* Location */}
              <div className="flex items-start gap-3 rounded-xl bg-[var(--sage-100)]/50 p-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white">
                  <MapPinned className="h-4 w-4 text-[var(--forest-600)]" />
                </div>

                <div className="min-w-0">
                  <p className="text-xs text-stone-500">
                    Location
                  </p>

                  <p className="mt-0.5 text-sm font-medium text-stone-800">
                    {activeFarm.address || activeFarm.location}
                  </p>
                </div>
              </div>

              {/* District */}
              <div className="flex items-start gap-3 rounded-xl bg-stone-50 p-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white">
                  <MapPin className="h-4 w-4 text-[var(--forest-600)]" />
                </div>

                <div>
                  <p className="text-xs text-stone-500">
                    District
                  </p>

                  <p className="mt-0.5 text-sm font-medium text-stone-800">
                    {activeFarm.district}
                  </p>
                </div>
              </div>

              {/* State */}
              <div className="flex items-start gap-3 rounded-xl bg-stone-50 p-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white">
                  <MapPin className="h-4 w-4 text-[var(--forest-600)]" />
                </div>

                <div>
                  <p className="text-xs text-stone-500">
                    State
                  </p>

                  <p className="mt-0.5 text-sm font-medium text-stone-800">
                    {activeFarm.state}
                  </p>
                </div>
              </div>

              {/* Area */}
              <div className="flex items-start gap-3 rounded-xl bg-stone-50 p-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white">
                  <Ruler className="h-4 w-4 text-[var(--forest-600)]" />
                </div>

                <div>
                  <p className="text-xs text-stone-500">
                    Farm size
                  </p>

                  <p className="mt-0.5 text-sm font-medium text-stone-800">
                    {activeFarm.sizeAcres} acres
                  </p>
                </div>
              </div>

              {/* Soil */}
              <div className="flex items-start gap-3 rounded-xl bg-stone-50 p-4 sm:col-span-2">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white">
                  <Mountain className="h-4 w-4 text-[var(--forest-600)]" />
                </div>

                <div>
                  <p className="text-xs text-stone-500">
                    Soil type
                  </p>

                  <p className="mt-0.5 text-sm font-medium text-stone-800">
                    {activeFarm.soilType}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* ACTIONS */}
          <div className="border-t border-stone-100 bg-stone-50/50 p-5 sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row">

              <button
                type="button"
                onClick={() => router.push('/farm-details/edit')}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-[var(--forest-600)] bg-white px-4 py-3 text-sm font-semibold text-[var(--forest-600)] transition-colors hover:bg-[var(--sage-100)]"
              >
                <Pencil className="h-4 w-4" />
                Edit Farm Details
              </button>

              <button
                type="button"
                onClick={() => router.push('/dashboard')}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--forest-600)] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[var(--forest-900)]"
              >
                Continue to Dashboard
                <ArrowRight className="h-4 w-4" />
              </button>

            </div>
          </div>
        </div>
      </div>
    </PageWrapper>
  );
}