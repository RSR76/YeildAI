'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { MapPin, Wheat, Ruler } from 'lucide-react';

import { Card } from '@/components/ui/Card';
import { Loading, ErrorView } from '@/components/ui/States';
import { PageWrapper } from '@/components/layout/PageWrapper';
import { AdminRoute } from '@/components/auth/AdminRoute';
import { getAdminRegions } from '@/lib/dataService';
import type { AdminRegionSummary } from '@/lib/types';

const AdminRegionsMap = dynamic(
  () => import('@/components/map/AdminRegionsMap').then((m) => m.AdminRegionsMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[420px] items-center justify-center rounded-xl border border-stone-200 bg-stone-50 text-sm text-stone-500">
        Loading map…
      </div>
    ),
  }
);

function AdminRegionsContent() {
  const router = useRouter();
  const [regions, setRegions] = useState<AdminRegionSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getAdminRegions()
      .then((data) => {
        if (!cancelled) setRegions(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load regions.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const totals = useMemo(() => {
    if (!regions) return null;
    return {
      farms: regions.reduce((sum, r) => sum + r.farmCount, 0),
      acres: Math.round(regions.reduce((sum, r) => sum + r.totalAcres, 0)),
      districts: regions.length,
    };
  }, [regions]);

  function goToDistrict(region: AdminRegionSummary) {
    router.push(`/admin/${encodeURIComponent(region.state)}/${encodeURIComponent(region.district)}`);
  }

  if (error) return <ErrorView message={error} />;
  if (!regions) return <Loading />;

  return (
    <PageWrapper title="Regions Overview">
      {totals && (
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card title="Registered farms">
            <div className="text-2xl font-semibold text-stone-900">{totals.farms}</div>
          </Card>
          <Card title="Total acreage">
            <div className="text-2xl font-semibold text-stone-900">{totals.acres.toLocaleString()} ac</div>
          </Card>
          <Card title="Districts covered">
            <div className="text-2xl font-semibold text-stone-900">{totals.districts}</div>
          </Card>
        </div>
      )}

      <Card title="All regions">
        <p className="mb-3 text-xs text-stone-500">
          Click a marker or a row to see every registered farm in that district, plus its crop
          recommendations and reasoning.
        </p>
        <AdminRegionsMap regions={regions} onSelectRegion={goToDistrict} />
      </Card>

      <Card title="Districts">
        {regions.length === 0 ? (
          <p className="text-sm text-stone-500">No farms have been registered yet.</p>
        ) : (
          <div className="divide-y divide-stone-100">
            {regions.map((r) => (
              <button
                key={`${r.state}-${r.district}`}
                onClick={() => goToDistrict(r)}
                className="flex w-full items-center justify-between gap-3 py-3 text-left hover:bg-stone-50"
              >
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 shrink-0 text-emerald-600" />
                  <div>
                    <div className="text-sm font-medium text-stone-800">{r.district}, {r.state}</div>
                    {r.topCrops.length > 0 && (
                      <div className="flex items-center gap-1 text-xs text-stone-400">
                        <Wheat className="h-3 w-3" /> {r.topCrops.join(', ')}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs text-stone-500">
                  <span>{r.farmCount} farms</span>
                  <span className="flex items-center gap-1"><Ruler className="h-3 w-3" /> {r.totalAcres} ac</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </Card>
    </PageWrapper>
  );
}

export default function AdminRegionsPage() {
  return (
    <AdminRoute>
      <AdminRegionsContent />
    </AdminRoute>
  );
}
