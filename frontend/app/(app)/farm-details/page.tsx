'use client';

import { useState } from 'react';
import { MapPin, Ruler, Droplet, Layers, Plus, Trash2, AlertTriangle } from 'lucide-react';

import { Card } from '@/components/ui/Card';
import { PageWrapper } from '@/components/layout/PageWrapper';
import { AddFarmModal } from '@/components/layout/AddFarmModal';
import { useAuth } from '@/lib/auth/AuthContext';

export default function FarmDetailsPage() {
  const { activeFarm, removeFarm } = useAuth();
  const [showAddModal, setShowAddModal] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (!activeFarm) return;
    setDeleting(true);
    setError(null);
    try {
      await removeFarm(activeFarm.id);
      setConfirmingDelete(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete this farm. Please try again.');
    } finally {
      setDeleting(false);
    }
  }

  if (!activeFarm) {
    return (
      <PageWrapper title="Farm Details">
        <Card title="No farms yet">
          <p className="mb-4 text-sm text-stone-600">
            Add your first farm to start tracking soil health, yield predictions, and recommendations for it.
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 rounded-lg bg-emerald-800 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-900"
          >
            <Plus className="h-4 w-4" />
            Add a farm
          </button>
        </Card>
        {showAddModal && <AddFarmModal onClose={() => setShowAddModal(false)} />}
      </PageWrapper>
    );
  }

  const stats = [
    { icon: MapPin, label: 'Location', value: activeFarm.address || activeFarm.location },
    { icon: Ruler, label: 'Size', value: `${activeFarm.sizeAcres} acres` },
    { icon: Layers, label: 'Soil Type', value: activeFarm.soilType },
    { icon: Droplet, label: 'Irrigation', value: activeFarm.irrigation },
  ];

  return (
    <PageWrapper title="Farm Details">
      <Card title="Farm Profile">
        <div className="mb-4 flex items-start justify-between gap-3">
          <h4 className="text-xl font-semibold text-stone-900">{activeFarm.name}</h4>
          <button
            onClick={() => setConfirmingDelete(true)}
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete farm
          </button>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {stats.map((s) => (
            <div key={s.label} className="flex items-start gap-3">
              <s.icon className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
              <div>
                <div className="text-xs uppercase tracking-wide text-stone-400">{s.label}</div>
                <div className="text-sm font-medium text-stone-800">{s.value}</div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Current Crops">
        {activeFarm.crops.length === 0 ? (
          <p className="text-sm text-stone-500">No crops recorded for this farm yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {activeFarm.crops.map((crop) => (
              <span
                key={crop}
                className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-800"
              >
                {crop}
              </span>
            ))}
          </div>
        )}
      </Card>

      {confirmingDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
          onClick={() => !deleting && setConfirmingDelete(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              <h3 className="font-[var(--font-display)] text-lg text-stone-900">Delete {activeFarm.name}?</h3>
            </div>
            <p className="mb-4 text-sm text-stone-600">
              This permanently removes this farm and its saved details. This can&apos;t be undone.
            </p>
            {error && (
              <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {error}
              </div>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmingDelete(false)}
                disabled={deleting}
                className="flex-1 rounded-lg border border-stone-200 px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </PageWrapper>
  );
}