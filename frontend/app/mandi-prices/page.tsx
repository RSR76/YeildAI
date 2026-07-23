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
import { LineChart as LineChartIcon } from 'lucide-react';

import { Card } from '@/components/ui/Card';
import { Loading, ErrorView, EmptyState } from '@/components/ui/States';
import { PageWrapper } from '@/components/layout/PageWrapper';
import { TrendBadge, ConfidenceBadge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import { getAllLatestForecasts, getForecastHistory, getCommodities, getMarkets, DEFAULT_LOCATION } from '@/lib/dataService';
import type { Forecast, MarketOption } from '@/lib/types';

const DEFAULT_COMMODITY = 'Tomato';

export default function MandiPricesPage() {
  const [commodities, setCommodities] = useState<string[] | null>(null);
  const [commodity, setCommodity] = useState(DEFAULT_COMMODITY);

  const [markets, setMarkets] = useState<MarketOption[] | null>(null);
  const [marketsError, setMarketsError] = useState<string | null>(null);

  const [state, setState] = useState(DEFAULT_LOCATION.state);
  const [district, setDistrict] = useState(DEFAULT_LOCATION.district);
  const [market, setMarket] = useState('');

  const [forecasts, setForecasts] = useState<Forecast[] | null>(null);
  const [history, setHistory] = useState<Forecast[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [waking, setWaking] = useState(false);

  const onRetry = () => setWaking(true);

  // Commodity options, fetched once from the real backend.
  useEffect(() => {
    getCommodities({ onRetry })
      .then((list) => {
        setCommodities(list);
        if (list.length > 0 && !list.includes(DEFAULT_COMMODITY)) {
          setCommodity(list[0] as string);
        }
      })
      .catch((err) => setError(err.message));
  }, []);

  // Market options for the selected commodity, refetched whenever commodity
  // changes. Reused to derive the State/District/Market selector options,
  // so every combination shown is guaranteed to have real data.
  useEffect(() => {
    setMarkets(null);
    setMarketsError(null);
    getMarkets(commodity, { onRetry })
      .then(setMarkets)
      .catch((err) => setMarketsError(err.message));
  }, [commodity]);

  const states = useMemo(() => {
    if (!markets) return [];
    return Array.from(new Set(markets.map((m) => m.state))).sort();
  }, [markets]);

  const districtsForState = useMemo(() => {
    if (!markets) return [];
    return Array.from(new Set(markets.filter((m) => m.state === state).map((m) => m.district))).sort();
  }, [markets, state]);

  const marketsForDistrict = useMemo(() => {
    if (!markets) return [];
    return markets
      .filter((m) => m.state === state && m.district === district)
      .map((m) => m.market)
      .sort();
  }, [markets, state, district]);

  // Snap state to a valid option once market data for the (possibly new)
  // commodity loads.
  useEffect(() => {
    if (states.length === 0) return;
    if (!states.includes(state)) setState(states[0] as string);
  }, [states, state]);

  // Reset the district whenever it's no longer valid for the selected state.
  useEffect(() => {
    if (districtsForState.length === 0) return;
    if (!districtsForState.includes(district)) setDistrict(districtsForState[0] as string);
  }, [districtsForState, district]);

  // Reset the market whenever it's no longer valid for the selected district.
  useEffect(() => {
    if (marketsForDistrict.length === 0) {
      if (market !== '') setMarket('');
      return;
    }
    if (!marketsForDistrict.includes(market)) setMarket(marketsForDistrict[0] as string);
  }, [marketsForDistrict, market]);

  // Load the table: every market for the selected commodity/state/district.
  useEffect(() => {
    setLoading(true);
    setError(null);
    getAllLatestForecasts(commodity, { onRetry })
      .then((all) => {
        setForecasts(all.filter((f) => f.state === state && f.district === district));
      })
      .catch((err) => setError(err.message))
      .finally(() => {
        setLoading(false);
        setWaking(false);
      });
  }, [commodity, state, district]);

  // Load the price history chart for the selected market.
  useEffect(() => {
    if (!market) {
      setHistory([]);
      return;
    }
    getForecastHistory(commodity, state, district, market)
      .then(setHistory)
      .catch(() => setHistory([]));
  }, [commodity, state, district, market]);

  const chartData = useMemo(
    () =>
      history.map((h) => ({
        date: new Date(h.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
        price: h.currentModalPrice,
      })),
    [history]
  );

  const selectors = (
    <Card title="Filters">
      <div className="flex flex-col gap-3 sm:flex-row">
        <Select
          label="Commodity"
          value={commodity}
          onChange={setCommodity}
          options={(commodities ?? []).map((c) => ({ value: c, label: c }))}
          disabled={!commodities}
        />
        <Select
          label="State"
          value={state}
          onChange={setState}
          options={states.map((s) => ({ value: s, label: s }))}
          disabled={!markets || states.length === 0}
        />
        <Select
          label="District"
          value={district}
          onChange={setDistrict}
          options={districtsForState.map((d) => ({ value: d, label: d }))}
          disabled={!markets || districtsForState.length === 0}
        />
        <Select
          label="Market"
          value={market}
          onChange={setMarket}
          options={marketsForDistrict.map((m) => ({ value: m, label: m }))}
          disabled={!markets || marketsForDistrict.length === 0}
        />
      </div>
      {marketsError && <p className="mt-3 text-xs text-red-600">Could not load the market list: {marketsError}</p>}
    </Card>
  );

  if (loading) {
    return (
      <PageWrapper title="Mandi Prices">
        {selectors}
        <Loading message={waking ? 'The backend is waking up. This can take up to a minute.' : undefined} />
      </PageWrapper>
    );
  }
  if (error) {
    return (
      <PageWrapper title="Mandi Prices">
        {selectors}
        <ErrorView message={error} />
      </PageWrapper>
    );
  }

  return (
    <PageWrapper title="Mandi Prices">
      <p className="text-sm text-stone-500 -mt-4 mb-2">
        Showing latest {commodity} forecasts for {district}, {state}.
      </p>

      {selectors}

      <Card title="Current Market Prices">
        {!forecasts || forecasts.length === 0 ? (
          <EmptyState message={`No ${commodity} forecasts found for ${district}, ${state}.`} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-stone-200 text-stone-500">
                  <th className="pb-3 pr-4 font-medium">Market</th>
                  <th className="pb-3 pr-4 font-medium">Modal Price</th>
                  <th className="pb-3 pr-4 font-medium">Trend</th>
                  <th className="pb-3 pr-4 font-medium">Confidence</th>
                </tr>
              </thead>
              <tbody>
                {forecasts.map((f) => (
                  <tr
                    key={f.id}
                    onClick={() => setMarket(f.market)}
                    className={`cursor-pointer border-b border-stone-100 transition-colors hover:bg-stone-50 ${
                      market === f.market ? 'bg-emerald-50' : ''
                    }`}
                  >
                    <td className="py-3 pr-4 font-medium text-stone-800">{f.market}</td>
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

      {market && chartData.length > 0 && (
        <Card title={`${commodity} — price trend in ${market}`}>
          <div className="mb-3 flex items-center gap-2 text-sm text-stone-500">
            <LineChartIcon className="h-4 w-4" />
            Modal price (₹/quintal) at {market}
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
