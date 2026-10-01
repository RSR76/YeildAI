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

import {
  Search,
  TrendingUp,
  TrendingDown,
  Minus,
  LineChart as LineChartIcon,
  IndianRupee,
} from 'lucide-react';

import { Card } from '@/components/ui/Card';
import {
  Loading,
  ErrorView,
  EmptyState,
} from '@/components/ui/States';
import { PageWrapper } from '@/components/layout/PageWrapper';
import { ConfidenceBadge } from '@/components/ui/Badge';
import { LocationBar } from '@/components/location/LocationBar';

import {
  getAllLatestForecasts,
  getForecastHistory,
} from '@/lib/dataService';

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

  const [forecasts, setForecasts] = useState<Forecast[] | null>(
    null,
  );

  const [history, setHistory] = useState<Forecast[]>([]);

  const [selectedForecastId, setSelectedForecastId] = useState<
    string | null
  >(null);

  const [query, setQuery] = useState('');

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    setLoading(true);
    setError(null);
    setForecasts(null);
    setSelectedForecastId(null);
    setHistory([]);

    getAllLatestForecasts(
      undefined,
      state,
      district,
      {
        signal: controller.signal,
      },
    )
      .then((data) => {
        if (controller.signal.aborted) return;

        setForecasts(data);

        if (data.length > 0) {
          setSelectedForecastId(data[0].id);
        }
      })
      .catch((err) => {
        if (controller.signal.aborted) return;

        console.error('MANDI FORECAST ERROR:', err);

        setError(
          err instanceof Error
            ? err.message
            : 'Unable to load mandi prices.',
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [state, district]);

  const selectedForecast = useMemo(() => {
    return (
      forecasts?.find(
        (forecast) => forecast.id === selectedForecastId,
      ) ?? null
    );
  }, [forecasts, selectedForecastId]);

  useEffect(() => {
    if (!selectedForecast) {
      setHistory([]);
      return;
    }

    const controller = new AbortController();

    getForecastHistory(
      selectedForecast.commodity,
      selectedForecast.state,
      selectedForecast.district,
      selectedForecast.market,
      {
        signal: controller.signal,
      },
    )
      .then((data) => {
        if (!controller.signal.aborted) {
          setHistory(data);
        }
      })
      .catch((err) => {
        if (controller.signal.aborted) return;

        console.error('MANDI HISTORY ERROR:', err);
        setHistory([]);
      });

    return () => controller.abort();
  }, [selectedForecast]);

  const filteredForecasts = useMemo(() => {
    if (!forecasts) return [];

    const search = query.trim().toLowerCase();

    if (!search) {
      return forecasts;
    }

    return forecasts.filter((forecast) =>
      forecast.commodity.toLowerCase().includes(search),
    );
  }, [forecasts, query]);

  const chartData = useMemo(() => {
    return history
      .map((item) => {
        const price = Number(item.currentModalPrice);
        const parsedDate = new Date(item.date);

        return {
          date: Number.isNaN(parsedDate.getTime())
            ? item.date
            : parsedDate.toLocaleDateString('en-IN', {
                month: 'short',
                day: 'numeric',
              }),
          price,
        };
      })
      .filter((item) => Number.isFinite(item.price));
  }, [history]);

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
          setMapLocation(
            result.matchedState,
            result.matchedDistrict,
          );
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
    <PageWrapper title="Mandi Prices" subtitle="Today's latest market prices near your farm.">
      <div className="space-y-6">

        {locationBar}

        <div className="rounded-2xl border border-stone-200 bg-white p-4">
          <label className="mb-2 block text-sm font-semibold text-stone-700">
            Find a crop
          </label>

          <div className="flex items-center gap-2 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5">
            <Search className="h-4 w-4 shrink-0 text-stone-400" />

            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search tomato, onion, wheat..."
              className="w-full bg-transparent text-sm text-stone-700 outline-none placeholder:text-stone-400"
            />
          </div>
        </div>

        <Card title="Today's Prices">
          {filteredForecasts.length === 0 ? (
            <EmptyState
              message={
                (forecasts ?? []).length === 0
                  ? `No forecast coverage for ${district}, ${state} yet. Try a different location above.`
                  : 'No crops match your search.'
              }
            />
          ) : (
            <div className="space-y-3">
              {filteredForecasts.map((forecast) => {
                const isSelected =
                  selectedForecastId === forecast.id;

                const trend =
                  forecast.predictedPriceTrend?.toLowerCase();

                return (
                  <button
                    key={forecast.id}
                    type="button"
                    onClick={() =>
                      setSelectedForecastId(forecast.id)
                    }
                    className={`w-full rounded-xl border p-4 text-left transition-all ${
                      isSelected
                        ? 'border-emerald-300 bg-[#f5faf2]'
                        : 'border-stone-200 bg-white hover:border-emerald-200 hover:bg-[#fafcf9]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <p className="truncate text-base font-semibold text-[#173b2a]">
                          {forecast.commodity}
                        </p>

                        <p className="mt-1 text-xs text-stone-500">
                          {forecast.market}
                        </p>
                      </div>

                      <div className="shrink-0 text-right">
                        <p className="text-lg font-bold text-[#173b2a]">
                          ₹
                          {Number(
                            forecast.currentModalPrice,
                          ).toLocaleString('en-IN')}
                        </p>

                        <p className="text-[11px] text-stone-400">
                          per quintal
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-stone-100 pt-3">
                      <SimpleTrend trend={trend} />

                      <ConfidenceBadge
                        band={forecast.confidenceBand}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </Card>

        {selectedForecast && (
          <Card title={`${selectedForecast.commodity} Price`}>
            <div className="mb-5 rounded-xl bg-[#f6faf2] p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs text-stone-500">
                    Current modal price
                  </p>

                  <p className="mt-1 text-2xl font-bold text-[#173b2a]">
                    ₹
                    {Number(
                      selectedForecast.currentModalPrice,
                    ).toLocaleString('en-IN')}
                  </p>

                  <p className="mt-1 text-xs text-stone-400">
                    per quintal
                  </p>
                </div>

                <SimpleTrend
                  trend={selectedForecast.predictedPriceTrend?.toLowerCase()}
                />
              </div>
            </div>

            {chartData.length > 0 ? (
              <>
                <div className="mb-4 flex items-center gap-2 text-sm text-stone-500">
                  <LineChartIcon className="h-4 w-4 text-emerald-600" />
                  Recent price history
                </div>

                <ResponsiveContainer width="100%" height={240}>
                  <LineChart
                    data={chartData}
                    margin={{
                      top: 8,
                      right: 10,
                      left: -10,
                      bottom: 0,
                    }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 5"
                      stroke="var(--line)"
                      vertical={false}
                    />

                    <XAxis
                      dataKey="date"
                      tick={{
                        fontSize: 11,
                        fill: 'var(--ink-soft)',
                      }}
                      axisLine={false}
                      tickLine={false}
                    />

                    <YAxis
                      tick={{
                        fontSize: 11,
                        fill: 'var(--ink-soft)',
                      }}
                      axisLine={false}
                      tickLine={false}
                    />

                    <Tooltip
                      contentStyle={{
                        borderRadius: 12,
                        border: '1px solid var(--line)',
                        fontSize: 12,
                      }}
                      formatter={(value) => [
                        `₹${Number(value).toLocaleString('en-IN')}`,
                        'Price',
                      ]}
                    />

                    <Line
                      type="monotone"
                      dataKey="price"
                      stroke="var(--forest-600)"
                      strokeWidth={2.5}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </>
            ) : (
              <div className="rounded-xl bg-stone-50 p-5 text-center">
                <p className="text-sm text-stone-500">
                  Price history is not available for this crop yet.
                </p>
              </div>
            )}
          </Card>
        )}

        <div className="rounded-xl border border-[#e1eadc] bg-[#f6faf2] px-4 py-3">
          <p className="text-sm leading-5 text-stone-600">
            <span className="font-semibold text-[#173b2a]">
              Tip:
            </span>{' '}
            Prices can change daily. Check the latest price before
            selling your crop.
          </p>
        </div>
      </div>
    </PageWrapper>
  );
}

function SimpleTrend({
  trend,
}: {
  trend?: string;
}) {
  if (trend === 'rising') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
        <TrendingUp className="h-3.5 w-3.5" />
        Price rising
      </span>
    );
  }

  if (trend === 'falling') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-600">
        <TrendingDown className="h-3.5 w-3.5" />
        Price falling
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-stone-100 px-2.5 py-1 text-xs font-semibold text-stone-600">
      <Minus className="h-3.5 w-3.5" />
      Price stable
    </span>
  );
}