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
import { Trophy, Sparkles, AlertTriangle } from 'lucide-react';

import { Card } from '@/components/ui/Card';
import { Loading, ErrorView } from '@/components/ui/States';
import { PageWrapper } from '@/components/layout/PageWrapper';
import { TrendBadge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import { getRecommendations, getLocations, DEFAULT_LOCATION } from '@/lib/dataService';
import type { Recommendation, Location } from '@/lib/types';

export default function RecommendationsPage() {
  const [locations, setLocations] = useState<Location[] | null>(null);
  const [locationsError, setLocationsError] = useState<string | null>(null);

  const [state, setState] = useState(DEFAULT_LOCATION.state);
  const [district, setDistrict] = useState(DEFAULT_LOCATION.district);

  const [data, setData] = useState<Recommendation[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [waking, setWaking] = useState(false);

  const onRetry = () => setWaking(true);

  // Location options for the selectors, populated from the real forecast
  // CSV via the backend — this does not block the initial recommendations
  // load below, which uses the known-good default location right away.
  useEffect(() => {
    getLocations({ onRetry })
      .then(setLocations)
      .catch((err) => setLocationsError(err.message));
  }, []);

  const states = useMemo(() => {
    if (!locations) return [];
    return Array.from(new Set(locations.map((l) => l.state))).sort();
  }, [locations]);

  const districtsForState = useMemo(() => {
    if (!locations) return [];
    return locations
      .filter((l) => l.state === state)
      .map((l) => l.district)
      .sort();
  }, [locations, state]);

  // If the selected state no longer has the current district (e.g. right
  // after a state change), snap to the first valid district for that state.
  useEffect(() => {
    if (districtsForState.length === 0) return;
    if (!districtsForState.includes(district)) {
      setDistrict(districtsForState[0] as string);
    }
  }, [districtsForState, district]);

  // Reload recommendations whenever state/district settle on a value. This
  // fires immediately on mount with the default location, and again any
  // time the user picks a new state or district.
  useEffect(() => {
    setLoading(true);
    setError(null);
    getRecommendations(state, district, { onRetry })
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => {
        setLoading(false);
        setWaking(false);
      });
  }, [state, district]);

  const chartData = useMemo(
    () => (data ?? []).map((r) => ({ name: r.name, profit: r.expectedProfit })),
    [data]
  );

  const locationSelectors = (
    <Card title="Location">
      <div className="flex flex-col gap-3 sm:flex-row">
        <Select
          label="State"
          value={state}
          onChange={(newState) => setState(newState)}
          options={states.map((s) => ({ value: s, label: s }))}
          disabled={!locations}
        />
        <Select
          label="District"
          value={district}
          onChange={(newDistrict) => setDistrict(newDistrict)}
          options={districtsForState.map((d) => ({ value: d, label: d }))}
          disabled={!locations || districtsForState.length === 0}
        />
      </div>
      {locationsError && (
        <p className="mt-3 text-xs text-red-600">Could not load the full location list: {locationsError}</p>
      )}
    </Card>
  );

  if (loading) {
    return (
      <PageWrapper title="Crop Recommendations">
        {locationSelectors}
        <Loading message={waking ? 'The backend is waking up. This can take up to a minute.' : undefined} />
      </PageWrapper>
    );
  }
  if (error) {
    return (
      <PageWrapper title="Crop Recommendations">
        {locationSelectors}
        <ErrorView message={error} />
      </PageWrapper>
    );
  }
  if (!data || data.length === 0) {
    return (
      <PageWrapper title="Crop Recommendations">
        {locationSelectors}
        <Card title="Recommendations">
          <p className="text-stone-600">No recommendations available for {district}, {state}.</p>
        </Card>
      </PageWrapper>
    );
  }

  const top = data[0] as Recommendation;
  const hasProfitablePick = top.expectedProfit > 0;

  return (
    <PageWrapper title="Crop Recommendations">
      <p className="text-sm text-stone-500 -mt-4 mb-2">
        Ranked for {district}, {state} based on price trend signals and MSP margins.
      </p>

      {locationSelectors}

      {!hasProfitablePick && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            No crop currently shows a positive expected profit for {district}, {state}. Showing the least-unprofitable
            option below — treat this as a caution, not a recommendation to plant.
          </span>
        </div>
      )}

      <Card title={hasProfitablePick ? 'Top pick' : 'Best available (no profitable option)'}>
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            {hasProfitablePick ? (
              <span className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                <Sparkles size={12} /> AI recommended
              </span>
            ) : (
              <span className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
                <AlertTriangle size={12} /> No profitable option
              </span>
            )}
            <h4 className="text-2xl font-semibold text-stone-900">{top.name}</h4>
            <p className="mt-1 text-sm text-stone-500">
              {top.bestSeason ?? 'Any season'} · {top.growthDuration ?? '—'} day cycle
            </p>
          </div>
          <div className="flex gap-8 text-right">
            <div>
              <div className="text-xs uppercase tracking-wide text-stone-400">Expected profit / acre</div>
              <div className={`text-xl font-semibold ${hasProfitablePick ? 'text-emerald-700' : 'text-red-600'}`}>
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
                    {i === 0 ? (hasProfitablePick ? <Trophy className="h-4 w-4 text-amber-500" /> : <AlertTriangle className="h-4 w-4 text-amber-500" />) : `#${i + 1}`}
                  </td>
                  <td className="py-3 pr-4 font-medium text-stone-800">{r.name}</td>
                  <td className="py-3 pr-4 text-stone-600">{r.score.toFixed(1)}</td>
                  <td className={`py-3 pr-4 font-mono ${r.expectedProfit > 0 ? 'text-stone-800' : 'text-red-600'}`}>
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
