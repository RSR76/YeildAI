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
import { Calendar } from 'lucide-react';

import { Card } from '@/components/ui/Card';
import { Loading, ErrorView, EmptyState } from '@/components/ui/States';
import { listAvailableYears, getYearlyHistory, compareYears } from '@/lib/dataService';
import type { YearlyHistory, YearComparisonEntry } from '@/lib/types';

// Must match yearComparisonQuerySchema's cap in
// backend/src/controllers/forecast.controller.ts — the backend rejects any
// /forecast/year-comparison request listing more than 10 years with a 400.
// Capped here too so a (commodity, market) pair that accumulates more than
// 10 distinct years of history (the whole point of the multi-year backfill
// this migration enables) doesn't turn the comparison card into a 400 error.
const MAX_COMPARISON_YEARS = 10;

function formatRupees(value: number | null): string {
  return value === null ? '—' : `₹${value.toLocaleString('en-IN')}`;
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
}

/**
 * Genuine year-by-year Mandi Prices experience (Phase 7/14): a year
 * selector backed by real per-year records, plus a year-over-year summary
 * table. Every number here comes from the API — a year with no stored data
 * renders as "—"/"No data", never 0 or an interpolated value, per the
 * product decision to never imply data that doesn't exist.
 *
 * Self-contained (fetches its own years/history/comparison) so
 * mandi-prices/page.tsx just renders <YearlyPanel .../> once a commodity
 * row is selected, instead of growing into a large page component.
 */
export function YearlyPanel({
  commodity,
  state,
  district,
  market,
}: {
  commodity: string;
  state: string;
  district: string;
  market: string;
}) {
  const [availableYears, setAvailableYears] = useState<number[] | null>(null);
  const [yearsError, setYearsError] = useState<string | null>(null);
  const [yearsLoading, setYearsLoading] = useState(true);

  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [yearHistory, setYearHistory] = useState<YearlyHistory | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const [comparison, setComparison] = useState<YearComparisonEntry[] | null>(null);
  const [comparisonError, setComparisonError] = useState<string | null>(null);

  // Reload available years whenever the selected commodity/market changes.
  useEffect(() => {
    const controller = new AbortController();
    // Clear stale state immediately so a commodity/market change never
    // briefly shows the previous selection's years while the new request is
    // in flight — same pattern as mandi-prices/page.tsx's forecast fetch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setYearsLoading(true);
    setYearsError(null);
    setAvailableYears(null);
    setSelectedYear(null);
    setYearHistory(null);
    setComparison(null);
    listAvailableYears(commodity, state, district, market, { signal: controller.signal })
      .then((data) => {
        if (controller.signal.aborted) return;
        setAvailableYears(data);
        if (data.length > 0) setSelectedYear(data[0]);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setYearsError(err instanceof Error ? err.message : 'Failed to load available years.');
      })
      .finally(() => {
        if (controller.signal.aborted) return;
        setYearsLoading(false);
      });
    return () => controller.abort();
  }, [commodity, state, district, market]);

  // Fetch full-year history for the selected year.
  useEffect(() => {
    if (selectedYear === null) return;
    const controller = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHistoryLoading(true);
    setHistoryError(null);
    getYearlyHistory(commodity, state, district, market, selectedYear, { signal: controller.signal })
      .then((data) => {
        if (controller.signal.aborted) return;
        setYearHistory(data);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setHistoryError(err instanceof Error ? err.message : 'Failed to load yearly history.');
      })
      .finally(() => {
        if (controller.signal.aborted) return;
        setHistoryLoading(false);
      });
    return () => controller.abort();
  }, [commodity, state, district, market, selectedYear]);

  // Fetch a year-over-year comparison across every available year (once we
  // know which years exist). Supplementary to the page — a failure here
  // shows an inline message in the comparison card only, it never blocks
  // the year selector/chart above.
  useEffect(() => {
    if (!availableYears || availableYears.length === 0) return;
    const controller = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setComparisonError(null);
    // availableYears is ascending — take the most recent MAX_COMPARISON_YEARS
    // rather than the oldest, since recent years are what a year-over-year
    // comparison view is actually for.
    const yearsToCompare = availableYears.slice(-MAX_COMPARISON_YEARS);
    compareYears(commodity, state, district, market, yearsToCompare, { signal: controller.signal })
      .then((data) => {
        if (controller.signal.aborted) return;
        setComparison(data);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setComparisonError(err instanceof Error ? err.message : 'Failed to load year comparison.');
      });
    return () => controller.abort();
  }, [commodity, state, district, market, availableYears]);

  const chartData = useMemo(
    () =>
      (yearHistory?.records ?? []).map((r) => ({
        date: new Date(r.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
        price: r.modalPrice,
      })),
    [yearHistory]
  );

  if (yearsLoading) {
    return (
      <Card title="Year-by-year history">
        <Loading message="Loading available years…" />
      </Card>
    );
  }

  if (yearsError) {
    return (
      <Card title="Year-by-year history">
        <ErrorView message={yearsError} />
      </Card>
    );
  }

  if (!availableYears || availableYears.length === 0) {
    return (
      <Card title="Year-by-year history">
        <EmptyState message={`No stored historical years for ${commodity} at ${market} yet.`} />
      </Card>
    );
  }

  return (
    <>
      <Card title={`${commodity} — year-by-year history at ${market}`}>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Calendar className="h-4 w-4 text-stone-400" />
          {availableYears.map((y) => (
            <button
              key={y}
              type="button"
              onClick={() => setSelectedYear(y)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                selectedYear === y
                  ? 'border-[var(--forest-600)] bg-[var(--forest-600)] text-white'
                  : 'border-stone-200 bg-white text-stone-600 hover:bg-stone-50'
              }`}
            >
              {y}
            </button>
          ))}
        </div>

        {historyLoading && <Loading message={`Loading ${selectedYear} history…`} />}
        {historyError && <ErrorView message={historyError} />}
        {!historyLoading && !historyError && yearHistory && chartData.length === 0 && (
          <EmptyState message={`No data recorded for ${selectedYear}.`} />
        )}
        {!historyLoading && !historyError && chartData.length > 0 && (
          <ResponsiveContainer width="100%" height={240}>
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
        )}
      </Card>

      <Card title="Year-over-year comparison">
        {comparisonError && <ErrorView message={comparisonError} />}
        {!comparisonError && !comparison && <Loading message="Loading year comparison…" />}
        {!comparisonError && comparison && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-stone-200 text-stone-500">
                  <th className="pb-3 pr-4 font-medium">Year</th>
                  <th className="pb-3 pr-4 font-medium">Records</th>
                  <th className="pb-3 pr-4 font-medium">Min</th>
                  <th className="pb-3 pr-4 font-medium">Max</th>
                  <th className="pb-3 pr-4 font-medium">Avg modal</th>
                  <th className="pb-3 pr-4 font-medium">Latest observation</th>
                </tr>
              </thead>
              <tbody>
                {comparison.map((y) => (
                  <tr key={y.year} className="border-b border-stone-100">
                    <td className="py-3 pr-4 font-medium text-stone-800">{y.year}</td>
                    <td className="py-3 pr-4 text-stone-600">
                      {y.hasData ? y.recordCount.toLocaleString('en-IN') : 'No data'}
                    </td>
                    <td className="py-3 pr-4 font-mono text-stone-800">{formatRupees(y.minModalPrice)}</td>
                    <td className="py-3 pr-4 font-mono text-stone-800">{formatRupees(y.maxModalPrice)}</td>
                    <td className="py-3 pr-4 font-mono text-stone-800">{formatRupees(y.avgModalPrice)}</td>
                    <td className="py-3 pr-4 text-stone-600">{formatDate(y.latestRecord?.date ?? null)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
