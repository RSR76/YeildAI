'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Info } from 'lucide-react';

import { useAuth } from '@/lib/auth/AuthContext';
import { PageWrapper } from '@/components/layout/PageWrapper';
import { FarmForm } from '@/components/layout/FarmForm';

/**
 * "Edit Farm Details" — reached from the Farm Summary page's
 * "Edit Farm Details" button. Reuses the existing FarmForm (mode="edit",
 * layout="page") exactly as already built for Add Farm, including the
 * existing LocationMap / reverse-geocode / soil lookup wiring — nothing
 * about that flow is re-implemented here.
 */
export default function EditFarmPage() {
  const router = useRouter();
  const { activeFarm, isLoading, isGuest } = useAuth();

  useEffect(() => {
    if (!isLoading && !activeFarm) {
      router.replace('/farm-select');
    }
  }, [isLoading, activeFarm, router]);

  if (isLoading || !activeFarm) {
    return (
      <PageWrapper title="Edit Farm Details" subtitle="Update your farm information." onBack={() => router.back()}>
        <div className="rounded-2xl border border-stone-200 bg-white p-10 text-center text-sm text-[var(--ink-soft)]">
          Loading your farm…
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper
      title="Edit Farm Details"
      subtitle="Update your farm information."
      onBack={() => router.push('/farm-summary')}
    >
      {/* Required-field notice */}
      <div className="mb-5 flex items-center gap-2.5 rounded-xl bg-[var(--sage-100)] px-4 py-3">
        <Info className="h-4 w-4 shrink-0 text-[var(--forest-600)]" />
        <p className="text-sm text-[var(--forest-900)]">
          <span className="text-red-500">*</span> indicates a required field
        </p>
      </div>

      {isGuest && (
        <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Sign up to save changes — guest mode is read-only.
        </div>
      )}

      <div className="rounded-2xl border border-stone-200 bg-white p-6">
        <FarmForm
          mode="edit"
          layout="page"
          initialFarm={activeFarm}
          onSuccess={() => router.push('/farm-summary')}
          onCancel={() => router.push('/farm-summary')}
        />
      </div>
    </PageWrapper>
  );
}