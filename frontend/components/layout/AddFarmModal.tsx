'use client';

import { X } from 'lucide-react';
import type { FarmProfile } from '@/lib/auth/types';
import { FarmForm } from './FarmForm';

interface AddFarmModalProps {
  onClose: () => void;
  onSuccess?: (farm: FarmProfile) => void;
}

export function AddFarmModal({
  onClose,
  onSuccess,
}: AddFarmModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-stone-100 px-6 py-4">
          <div>
            <h3 className="font-[var(--font-display)] text-lg text-[var(--forest-900)]">
              Add a farm
            </h3>

            <p className="mt-0.5 text-xs text-stone-400">
              <span className="text-red-500">*</span>{' '}
              indicates a required field
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-stone-400 hover:bg-stone-100"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <FarmForm
            mode="add"
            onSuccess={(farm) => {
              onSuccess?.(farm);
            }}
          />
        </div>
      </div>
    </div>
  );
}