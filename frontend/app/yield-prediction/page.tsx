'use client';

import { useEffect, useState } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { Gauge, Sprout } from 'lucide-react';

import { Card } from '@/components/ui/Card';
import { KPICard } from '@/components/ui/KPICard';
import { Loading } from '@/components/ui/States';
import { PageWrapper } from '@/components/layout/PageWrapper';
import { mockYieldTrend, mockFarmProfile } from '@/lib/mockData';
import type { YieldPoint } from '@/lib/types';

export default function YieldPredictionPage() {
  const [data, setData] = useState<YieldPoint[] | null>(null);

  useEffect(() => {
    // Yield prediction has no dedicated backend endpoint yet — sourced from
    // the temporary mock data layer (lib/mockData.ts) until one exists.
    const timer = setTimeout(() => setData(mockYieldTrend), 200);
    return () => clearTimeout(timer);
  }, []);

  if (!data) return <PageWrapper title="Yield Prediction"><Loading /></PageWrapper>;

  const latestPredicted = [...data].reverse().find((d) => d.predicted != null)?.predicted ?? 0;
  const latestActual = [...data].reverse().find((d) => d.actual != null)?.actual ?? 0;
  const changePct = latestActual ? Math.round(((latestPredicted - latestActual) / latestActual) * 100) : 0;

  return (
    <PageWrapper title="Yield Prediction">
      <p className="text-sm text-stone-500 -mt-4 mb-2">
        Projected yield for {mockFarmProfile.name} ({mockFarmProfile.location}), based on soil health and season trends.
      </p>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <KPICard title="Projected Yield (next season)" value={`${latestPredicted} quintals/acre`} change={`${changePct >= 0 ? '+' : ''}${changePct}%`} />
        <KPICard title="Last recorded yield" value={`${latestActual} quintals/acre`} />
        <KPICard title="Prediction confidence" value="88%" />
      </div>

      <Card title="Yield trend — actual vs. predicted">
        <div className="mb-3 flex items-center gap-2 text-sm text-stone-500">
          <Gauge className="h-4 w-4" />
          Quintals per acre, by season
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={data} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 5" stroke="var(--line)" vertical={false} />
            <XAxis dataKey="season" tick={{ fontSize: 11, fill: 'var(--ink-soft)' }} axisLine={false} tickLine={false} />
            <YAxis domain={[30, 55]} tick={{ fontSize: 11, fill: 'var(--ink-soft)' }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid var(--line)', fontSize: 12.5 }} />
            <Line type="monotone" dataKey="actual" stroke="var(--forest-900)" strokeWidth={2.5} dot={{ r: 3 }} name="Actual" connectNulls={false} />
            <Line type="monotone" dataKey="predicted" stroke="var(--gold-500)" strokeWidth={2.5} strokeDasharray="5 4" dot={{ r: 3 }} name="Predicted" connectNulls />
          </ComposedChart>
        </ResponsiveContainer>
        <div className="mt-3 flex gap-5 text-xs text-stone-500">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: 'var(--forest-900)' }} /> Actual
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: 'var(--gold-500)' }} /> Predicted
          </span>
        </div>
      </Card>

      <Card title="What's driving this prediction">
        <div className="flex items-start gap-3 text-sm text-stone-600">
          <Sprout className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
          <p>
            Soil nitrogen and moisture levels are within the optimal range for this cycle, and near-normal
            monsoon distribution is expected across the district. Combined with the current crop mix, the
            model projects a yield improvement over the last recorded season.
          </p>
        </div>
      </Card>
    </PageWrapper>
  );
}