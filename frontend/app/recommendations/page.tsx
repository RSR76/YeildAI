'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from 'recharts';
import { Trophy, Sparkles } from 'lucide-react';

import { Card } from '@/components/ui/Card';
import { Loading, ErrorView } from '@/components/ui/States';
import { PageWrapper } from '@/components/layout/PageWrapper';
import { TrendBadge } from '@/components/ui/Badge';
import { getRecommendations, DEFAULT_LOCATION } from '@/lib/dataService';
import type { Recommendation } from '@/lib/types';

export default function RecommendationsPage() {
  const [data, setData] = useState<Recommendation[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getRecommendations()
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const chartData = useMemo(
    () => (data ?? []).map((r) => ({ name: r.name, profit: r.expectedProfit })),
    [data]
  );

  if (loading) return <PageWrapper title="Crop Recommendations"><Loading /></PageWrapper>;
  if (error) return <PageWrapper title="Crop Recommendations"><ErrorView message={error} /></PageWrapper>;
  if (!data || data.length === 0) {
    return (
      <PageWrapper title="Crop Recommendations">
        <Card title="Recommendations">
          <p className="text-stone-600">No recommendations available yet.</p>
        </Card>
      </PageWrapper>
    );
  }

  const top = data[0];

  return (
    <PageWrapper title="Crop Recommendations">
      <p className="text-sm text-stone-500 -mt-4 mb-2">
        Ranked for {DEFAULT_LOCATION.district}, {DEFAULT_LOCATION.state} based on price trend signals and MSP margins.
      </p>

      <Card title="Top pick">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <span className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
              <Sparkles size={12} /> AI recommended
            </span>
            <h4 className="text-2xl font-semibold text-stone-900">{top.name}</h4>
            <p className="mt-1 text-sm text-stone-500">
              {top.bestSeason ?? 'Any season'} · {top.growthDuration ?? '—'} day cycle
            </p>
          </div>
          <div className="flex gap-8 text-right">
            <div>
              <div className="text-xs uppercase tracking-wide text-stone-400">Expected profit / acre</div>
              <div className="text-xl font-semibold text-emerald-700">
                ₹{top.expectedProfit.toLocaleString('en-IN')}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-stone-400">Confidence</div>
              <div className="text-xl font-semibold text-stone-800">
                {Math.round(top.confidenceScore * 100)}%
              </div>
            </div>
          </div>
        </div>
      </Card>

      <Card title="Expected profit by crop">
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chartData} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 5" stroke="var(--line)" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--ink-soft)' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: 'var(--ink-soft)' }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ borderRadius: 12, border: '1px solid var(--line)', fontSize: 12.5 }}
              formatter={(v) => [`₹${Number(v).toLocaleString('en-IN')}`, 'Expected profit']}
            />
            <Bar dataKey="profit" radius={[6, 6, 0, 0]}>
              {chartData.map((d, i) => (
                <Cell key={d.name} fill={i === 0 ? 'var(--forest-600)' : 'var(--sage-300)'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card title="All ranked recommendations">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-stone-200 text-stone-500">
                <th className="pb-3 pr-4 font-medium">Rank</th>
                <th className="pb-3 pr-4 font-medium">Crop</th>
                <th className="pb-3 pr-4 font-medium">Score</th>
                <th className="pb-3 pr-4 font-medium">Expected Profit</th>
                <th className="pb-3 pr-4 font-medium">Price Trend</th>
              </tr>
            </thead>
            <tbody>
              {data.map((r, i) => (
                <tr key={r.cropId} className="border-b border-stone-100">
                  <td className="py-3 pr-4 text-stone-500">
                    {i === 0 ? <Trophy className="h-4 w-4 text-amber-500" /> : `#${i + 1}`}
                  </td>
                  <td className="py-3 pr-4 font-medium text-stone-800">{r.name}</td>
                  <td className="py-3 pr-4 text-stone-600">{r.score.toFixed(1)}</td>
                  <td className="py-3 pr-4 font-mono text-stone-800">
                    ₹{r.expectedProfit.toLocaleString('en-IN')}
                  </td>
                  <td className="py-3 pr-4">
                    <TrendBadge trend={r.predictedTrend} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </PageWrapper>
  );
}