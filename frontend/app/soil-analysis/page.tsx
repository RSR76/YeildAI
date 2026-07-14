'use client';

import { useEffect, useState } from 'react';
import { FlaskConical } from 'lucide-react';

import { Card } from '@/components/ui/Card';
import { Loading } from '@/components/ui/States';
import { PageWrapper } from '@/components/layout/PageWrapper';
import { StatusBadge } from '@/components/ui/Badge';
import { mockSoilSamples, mockFarmProfile } from '@/lib/mockData';
import type { SoilSample } from '@/lib/types';

export default function SoilAnalysisPage() {
  const [data, setData] = useState<SoilSample[] | null>(null);

  useEffect(() => {
    // No dedicated backend endpoint yet — sourced from the temporary mock
    // data layer (lib/mockData.ts) until a soil-testing integration exists.
    const timer = setTimeout(() => setData(mockSoilSamples), 200);
    return () => clearTimeout(timer);
  }, []);

  if (!data) return <PageWrapper title="Soil Analysis"><Loading /></PageWrapper>;

  const flagged = data.filter((s) => s.status !== 'Optimal');

  return (
    <PageWrapper title="Soil Analysis">
      <p className="text-sm text-stone-500 -mt-4 mb-2">
        Latest soil test results for {mockFarmProfile.name} — {mockFarmProfile.soilType}.
      </p>

      <Card title="Soil Composition">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-stone-200 text-stone-500">
                <th className="pb-3 pr-4 font-medium">Parameter</th>
                <th className="pb-3 pr-4 font-medium">Value</th>
                <th className="pb-3 pr-4 font-medium">Ideal Range</th>
                <th className="pb-3 pr-4 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.map((s) => (
                <tr key={s.parameter} className="border-b border-stone-100">
                  <td className="py-3 pr-4 font-medium text-stone-800">{s.parameter}</td>
                  <td className="py-3 pr-4 font-mono text-stone-800">
                    {s.value} {s.unit}
                  </td>
                  <td className="py-3 pr-4 text-stone-500">
                    {s.idealMin}–{s.idealMax} {s.unit}
                  </td>
                  <td className="py-3 pr-4">
                    <StatusBadge status={s.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Recommended actions">
        {flagged.length === 0 ? (
          <p className="text-stone-600">All measured parameters are within the optimal range.</p>
        ) : (
          <ul className="space-y-3">
            {flagged.map((s) => (
              <li key={s.parameter} className="flex items-start gap-3 text-sm text-stone-600">
                <FlaskConical className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                <span>
                  <strong className="text-stone-800">{s.parameter}</strong> is {s.status.toLowerCase()} (
                  {s.value} {s.unit}, ideal {s.idealMin}–{s.idealMax} {s.unit}).{' '}
                  {s.status === 'Low'
                    ? 'Consider a targeted fertilizer application before the next sowing cycle.'
                    : 'Consider reducing further inputs of this nutrient this season.'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </PageWrapper>
  );
}