'use client';

import { useEffect, useState } from 'react';
import { MapPin, Ruler, Droplet, Layers } from 'lucide-react';

import { Card } from '@/components/ui/Card';
import { Loading } from '@/components/ui/States';
import { PageWrapper } from '@/components/layout/PageWrapper';
import { mockFarmProfile } from '@/lib/mockData';
import type { FarmProfile } from '@/lib/types';

export default function FarmDetailsPage() {
  const [farm, setFarm] = useState<FarmProfile | null>(null);

  useEffect(() => {
    // No dedicated backend endpoint yet — sourced from the temporary mock
    // data layer (lib/mockData.ts) until farm-profile management exists.
    const timer = setTimeout(() => setFarm(mockFarmProfile), 200);
    return () => clearTimeout(timer);
  }, []);

  if (!farm) return <PageWrapper title="Farm Details"><Loading /></PageWrapper>;

  const stats = [
    { icon: MapPin, label: 'Location', value: farm.location },
    { icon: Ruler, label: 'Size', value: `${farm.sizeAcres} acres` },
    { icon: Layers, label: 'Soil Type', value: farm.soilType },
    { icon: Droplet, label: 'Irrigation', value: farm.irrigation },
  ];

  return (
    <PageWrapper title="Farm Details">
      <Card title="Farm Profile">
        <h4 className="mb-4 text-xl font-semibold text-stone-900">{farm.name}</h4>
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
        <div className="flex flex-wrap gap-2">
          {farm.crops.map((crop) => (
            <span
              key={crop}
              className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-800"
            >
              {crop}
            </span>
          ))}
        </div>
      </Card>
    </PageWrapper>
  );
}