'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { LineChart as LineChartIcon, Search } from 'lucide-react';

import { Card } from '@/components/ui/Card';
import { Loading, ErrorView, EmptyState } from '@/components/ui/States';
import { PageWrapper } from '@/components/layout/PageWrapper';
import { TrendBadge, ConfidenceBadge } from '@/components/ui/Badge';
import { LocationBar } from '@/components/location/LocationBar';
import { getAllLatestForecasts, getForecastHistory } from '@/lib/dataService';
import { useAuth } from '@/lib/auth/AuthContext';
import { useEffectiveLocation } from '@/lib/useEffectiveLocation';
import type { Forecast } from '@/lib/types';

export default function MandiPricesPage() {
  const { activeFarm } = useAuth();
  const {
    effectiveLocation,
    farmLocationStatus,
    locations,
    locationsError,
    hasOverride,
    setManualLocation,
    setMapLocation,
    resetToFarm,
  } = useEffectiveLocation(activeFarm);
  const { state, district } = effectiveLocation;

  const [forecasts, setForecasts] = useState<Forecast[] | null>(null);
  const [history, setHistory] = useState<Forecast[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    // Clear stale rows/selection/history immediately so a location change
    // never briefly shows the previous location's markets under the new
    // label while the new request is in flight.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(null);
    setForecasts(null);
    setSelected(null);
    setHistory([]);
    getAllLatestForecasts(undefined, state, district, { signal: controller.signal })
      .then((data) => {
        if (controller.signal.aborted) return;
        setForecasts(data);
        if (data.length > 0) setSelected(data[0].commodity);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setError(err.message);
      })
      .finally(() => {
        if (controller.signal.aborted) return;
        setLoading(false);
      });
    return () => controller.abort();
  }, [state, district]);

  useEffect(() => {
    if (!selected) return;
    const row = forecasts?.find((f) => f.commodity === selected);
    if (!row) return;
    const controller = new AbortController();
    getForecastHistory(selected, row.state, row.district, row.market, { signal: controller.signal })
      .then((data) => {
        if (controller.signal.aborted) return;
        setHistory(data);
      })
      .catch(() => {
        // History is supplementary to the price table; a failure here
        // shouldn't block the page, so it's swallowed rather than surfaced
        // as a page-level error.
      });
    return () => controller.abort();
  }, [selected, forecasts]);

  const filtered = useMemo(() => {
    if (!forecasts) return [];
    if (!query.trim()) return forecasts;
    return forecasts.filter((f) => f.commodity.toLowerCase().includes(query.toLowerCase()));
  }, [forecasts, query]);

  const chartData = useMemo(
    () =>
      history.map((h) => ({
        date: new Date(h.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
        price: h.currentModalPrice,
      })),
    [history]
  );

  const locationBar = (
    <LocationBar
      effectiveLocation={effectiveLocation}
      farmLocationStatus={farmLocationStatus}
      locations={locations}
      locationsError={locationsError}
      hasOverride={hasOverride}
      hasFarm={!!activeFarm}
      onManualSelect={setManualLocation}
      onMapLocationResolved={(result) => {
        if (result.matchedState && result.matchedDistrict) {
          setMapLocation(result.matchedState, result.matchedDistrict);
        }
      }}
      onResetToFarm={resetToFarm}
    />
  );

  if (loading) {
    return (
      <PageWrapper title="Mandi Prices">
        {locationBar}
        <Loading />
      </PageWrapper>
    );
  }
  if (error) {
    return (
      <PageWrapper title="Mandi Prices">
        {locationBar}
        <ErrorView message={error} />
      </PageWrapper>
    );
  }

  return (
    <PageWrapper title="Mandi Prices">
      {locationBar}
      <p className="text-sm text-stone-500 -mt-2 mb-2">
        Showing latest forecasts for {district}, {state}.
      </p>

      <Card title="Current Market Prices">
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2">
          <Search className="h-4 w-4 text-stone-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search commodity…"
            className="w-full bg-transparent text-sm text-stone-700 outline-none placeholder:text-stone-400"
          />
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            message={
              (forecasts ?? []).length === 0
                ? `No forecast coverage for ${district}, ${state} yet. Try a different location above.`
                : 'No commodities match your search.'
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-stone-200 text-stone-500">
                  <th className="pb-3 pr-4 font-medium">Commodity</th>
                  <th className="pb-3 pr-4 font-medium">Market</th>
                  <th className="pb-3 pr-4 font-medium">Modal Price</th>
                  <th className="pb-3 pr-4 font-medium">Trend</th>
                  <th className="pb-3 pr-4 font-medium">Confidence</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((f) => (
                  <tr
                    key={f.id}
                    onClick={() => setSelected(f.commodity)}
                    className={`cursor-pointer border-b border-stone-100 transition-colors hover:bg-stone-50 ${
                      selected === f.commodity ? 'bg-emerald-50' : ''
                    }`}
                  >
                    <td className="py-3 pr-4 font-medium text-stone-800">{f.commodity}</td>
                    <td className="py-3 pr-4 text-stone-600">{f.market}</td>
                    <td className="py-3 pr-4 font-mono text-stone-800">
                      ₹{f.currentModalPrice.toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 pr-4">
                      <TrendBadge trend={f.predictedPriceTrend} />
                    </td>
                    <td className="py-3 pr-4">
                      <ConfidenceBadge band={f.confidenceBand} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {selected && chartData.length > 0 && (
        <Card title={`${selected} — 8 week price trend`}>
          <div className="mb-3 flex items-center gap-2 text-sm text-stone-500">
            <LineChartIcon className="h-4 w-4" />
            Modal price (₹/quintal) at {history[0]?.market}
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={chartData} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 5" stroke="var(--line)" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11.5, fill: 'var(--ink-soft)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11.5, fill: 'var(--ink-soft)' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: '1px solid var(--line)', fontSize: 12.5 }}
                formatter={(v) => [`₹${Number(v).toLocaleString('en-IN')}`, 'Price']}
              />
              <Line type="monotone" dataKey="price" stroke="var(--forest-600)" strokeWidth={2.5} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}
    </PageWrapper>
  );
}
