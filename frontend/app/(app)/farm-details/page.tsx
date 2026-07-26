'use client';

import { useState } from 'react';
import { MapPin, Ruler, Droplet, Layers, Plus } from 'lucide-react';

import { Card } from '@/components/ui/Card';
import { PageWrapper } from '@/components/layout/PageWrapper';
import { AddFarmModal } from '@/components/layout/AddFarmModal';
import { useAuth } from '@/lib/auth/AuthContext';

export default function FarmDetailsPage() {
  const { activeFarm } = useAuth();
  const [showAddModal, setShowAddModal] = useState(false);

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
    { icon: MapPin, label: 'Location', value: activeFarm.location },
    { icon: Ruler, label: 'Size', value: `${activeFarm.sizeAcres} acres` },
    { icon: Layers, label: 'Soil Type', value: activeFarm.soilType },
    { icon: Droplet, label: 'Irrigation', value: activeFarm.irrigation },
  ];

  return (
    <PageWrapper title="Farm Details">
      <Card title="Farm Profile">
        <h4 className="mb-4 text-xl font-semibold text-stone-900">{activeFarm.name}</h4>
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
    </PageWrapper>
  );
}