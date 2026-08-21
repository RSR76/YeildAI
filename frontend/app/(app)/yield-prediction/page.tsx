'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import {
  Gauge,
  MapPin,
  PlusCircle,
  Sprout,
  TrendingUp,
  Droplets,
  Layers3,
} from 'lucide-react';

import { Card } from '@/components/ui/Card';
import { Loading, ErrorView } from '@/components/ui/States';
import { PageWrapper } from '@/components/layout/PageWrapper';

import {
  generateYieldTrend,
  generateYieldConfidence,
  generateSoilSamples,
  generateWeatherWeek,
} from '@/lib/deriveFarmData';

import { useAuth } from '@/lib/auth/AuthContext';
import type { YieldPoint } from '@/lib/types';

function NoFarmState() {
  return (
    <PageWrapper title="Yield Prediction">
      <Card title="Yield Prediction">
        <div className="py-14 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
            <MapPin className="h-8 w-8 text-emerald-600" />
          </div>

          <h2 className="text-xl font-semibold text-stone-800">
            Add a farm to see yield prediction
          </h2>

          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-stone-500">
            Yield predictions are generated for a specific farm using its
            location, crop profile, soil conditions, and seasonal information.
            Add a farm to get started.
          </p>

          <button
            type="button"
            onClick={() => {
              window.dispatchEvent(new CustomEvent('open-add-farm'));
            }}
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-800"
          >
            <PlusCircle className="h-4 w-4" />
            Add your first farm
          </button>
        </div>
      </Card>
    </PageWrapper>
  );
}

export default function YieldPredictionPage() {
  const { activeFarm } = useAuth();

  const [data, setData] = useState<YieldPoint[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const farmName = activeFarm?.name;
  const location = activeFarm?.location;

  useEffect(() => {
    if (!activeFarm) {
      setData(null);
      setError(null);
      return;
    }

    const timer = setTimeout(() => {
      try {
        const trend = generateYieldTrend(activeFarm);
        setData(trend);
        setError(null);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to generate yield prediction.'
        );
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [activeFarm]);

  const confidence = useMemo(
    () => (activeFarm ? generateYieldConfidence(activeFarm) : 0),
    [activeFarm]
  );

  const soil = useMemo(
    () => (activeFarm ? generateSoilSamples(activeFarm) : []),
    [activeFarm]
  );

  const weather = useMemo(
    () => (activeFarm ? generateWeatherWeek(activeFarm) : []),
    [activeFarm]
  );

  if (!activeFarm) {
    return <NoFarmState />;
  }

  if (error) {
    return (
      <PageWrapper title="Yield Prediction">
        <ErrorView message={error} />
      </PageWrapper>
    );
  }

  if (!data) {
    return (
      <PageWrapper title="Yield Prediction">
        <Loading />
      </PageWrapper>
    );
  }

  const latestPredicted =
    [...data].reverse().find((d) => d.predicted != null)?.predicted ?? 0;

  const latestActual =
    [...data].reverse().find((d) => d.actual != null)?.actual ?? 0;

  const changePct = latestActual
    ? Math.round(((latestPredicted - latestActual) / latestActual) * 100)
    : 0;

  const rainyDays = weather.filter((day) => day.rainfallChance >= 50).length;

  const nitrogen = soil.find((sample) => sample.parameter === 'Nitrogen (N)');
  const moisture = soil.find((sample) => sample.parameter === 'Moisture');

  const soilSummary =
    nitrogen?.status === 'Optimal' && moisture?.status === 'Optimal'
      ? 'Soil nitrogen and moisture are currently within their target ranges.'
      : nitrogen?.status === 'Low'
      ? 'Soil nitrogen is below the target range and may limit yield potential.'
      : moisture?.status === 'Low'
      ? 'Soil moisture is below the target range and irrigation may be important this cycle.'
      : 'Current soil conditions show some variation from the target ranges.';

  const weatherSummary =
    rainyDays >= 3
      ? `The current outlook shows ${rainyDays} higher-rainfall days this week.`
      : `The current outlook shows mostly dry conditions, with ${rainyDays} higher-rainfall day${
          rainyDays === 1 ? '' : 's'
        } this week.`;

  const cropSummary = activeFarm.crops?.length
    ? `The prediction is adjusted for the farm's current crop profile: ${activeFarm.crops.join(
        ', '
      )}.`
    : 'No crop profile is currently available for this farm.';

  const chartValues = data.flatMap((point) =>
    [point.actual, point.predicted].filter(
      (value): value is number => value != null
    )
  );

  const minYield = chartValues.length ? Math.min(...chartValues) : 0;
  const maxYield = chartValues.length ? Math.max(...chartValues) : 10;

  const yMin = Math.max(0, Math.floor(minYield - 5));
  const yMax = Math.ceil(maxYield + 5);

  return (
    <PageWrapper title="Yield Prediction">
      <div className="space-y-6 px-5 pb-10 pt-4 sm:px-8 lg:px-10">
        {/* Header */}
        <div className="-mt-4">
          <p className="text-sm text-stone-500">
            Projected yield based on your farm profile ({farmName}) and seasonal
            conditions.
          </p>

          {location && (
            <div className="mt-1 flex items-center gap-1.5 text-xs text-stone-400">
              <MapPin className="h-3.5 w-3.5" />
              {location}
            </div>
          )}
        </div>

        {/* Current Yield Prediction */}
        <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
          <div className="p-6">
            <p className="text-xs font-semibold text-stone-700">
              Current Yield Prediction
            </p>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-emerald-50">
                  <Sprout className="h-7 w-7 text-emerald-600" />
                </div>

                <div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-semibold tracking-tight text-stone-800">
                      {latestPredicted}
                    </span>

                    <span className="text-sm text-stone-400">
                      quintals/acre
                    </span>
                  </div>

                  <p className="mt-1 text-xs text-stone-500">
                    Projected yield for next season
                  </p>
                </div>
              </div>

              {/* Change */}
              <div className="text-right">
                <div className="flex items-center justify-end gap-1.5">
                  <TrendingUp
                    className={`h-4 w-4 ${
                      changePct >= 0
                        ? 'text-emerald-600'
                        : 'rotate-180 text-red-500'
                    }`}
                  />

                  <span
                    className={`text-sm font-semibold ${
                      changePct >= 0 ? 'text-emerald-700' : 'text-red-600'
                    }`}
                  >
                    {changePct >= 0 ? '+' : ''}
                    {changePct}%
                  </span>
                </div>

                <p className="mt-1 text-[10px] text-stone-400">
                  vs. last recorded yield
                </p>
              </div>
            </div>

            {/* Metrics */}
            <div className="mt-7 grid grid-cols-2 gap-x-6 gap-y-5 border-t border-stone-100 pt-5 sm:grid-cols-4">
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wide text-stone-400">
                  Last Yield
                </p>

                <p className="mt-1 text-xs font-semibold text-stone-700">
                  {latestActual} quintals/acre
                </p>
              </div>

              <div>
                <p className="text-[10px] font-medium uppercase tracking-wide text-stone-400">
                  Confidence
                </p>

                <p className="mt-1 text-xs font-semibold text-stone-700">
                  {confidence}%
                </p>
              </div>

              <div>
                <p className="text-[10px] font-medium uppercase tracking-wide text-stone-400">
                  Farm Size
                </p>

                <p className="mt-1 text-xs font-semibold text-stone-700">
                  {activeFarm.sizeAcres} acres
                </p>
              </div>

              <div>
                <p className="text-[10px] font-medium uppercase tracking-wide text-stone-400">
                  Crop
                </p>

                <p className="mt-1 truncate text-xs font-semibold text-stone-700">
                  {activeFarm.crops?.length
                    ? activeFarm.crops.join(', ')
                    : 'Not specified'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Yield Trend */}
        <Card title="Yield Trend">
          <div className="mb-4 flex items-center gap-2 text-sm text-stone-500">
            <Gauge className="h-4 w-4" />
            Actual vs. predicted yield by season
          </div>

          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={data}
                margin={{
                  top: 8,
                  right: 16,
                  left: -8,
                  bottom: 0,
                }}
              >
                <CartesianGrid
                  strokeDasharray="3 5"
                  stroke="var(--line, #e7e5e4)"
                  vertical={false}
                />

                <XAxis
                  dataKey="season"
                  tick={{
                    fontSize: 11,
                    fill: 'var(--ink-soft, #78716c)',
                  }}
                  axisLine={false}
                  tickLine={false}
                />

                <YAxis
                  domain={[yMin, yMax]}
                  tick={{
                    fontSize: 11,
                    fill: 'var(--ink-soft, #78716c)',
                  }}
                  axisLine={false}
                  tickLine={false}
                />

                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: '1px solid var(--line, #e7e5e4)',
                    fontSize: 12.5,
                  }}
                />

                <Line
                  type="monotone"
                  dataKey="actual"
                  stroke="var(--forest-900, #064e3b)"
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                  name="Actual"
                  connectNulls={false}
                />

                <Line
                  type="monotone"
                  dataKey="predicted"
                  stroke="var(--gold-500, #eab308)"
                  strokeWidth={2.5}
                  strokeDasharray="5 4"
                  dot={{ r: 3 }}
                  name="Predicted"
                  connectNulls
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-3 flex gap-5 text-xs text-stone-500">
            <span className="flex items-center gap-1.5">
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: 'var(--forest-900, #064e3b)' }}
              />
              Actual
            </span>

            <span className="flex items-center gap-1.5">
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: 'var(--gold-500, #eab308)' }}
              />
              Predicted
            </span>
          </div>
        </Card>

        {/* Prediction Drivers */}
        <Card title="What's driving this prediction">
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50">
                <Layers3 className="h-4 w-4 text-emerald-600" />
              </div>

              <div>
                <p className="text-xs font-semibold text-stone-700">
                  Soil conditions
                </p>

                <p className="mt-1 text-sm leading-5 text-stone-500">
                  {soilSummary}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-50">
                <Droplets className="h-4 w-4 text-sky-600" />
              </div>

              <div>
                <p className="text-xs font-semibold text-stone-700">
                  Weather outlook
                </p>

                <p className="mt-1 text-sm leading-5 text-stone-500">
                  {weatherSummary}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-50">
                <Sprout className="h-4 w-4 text-amber-600" />
              </div>

              <div>
                <p className="text-xs font-semibold text-stone-700">
                  Crop profile
                </p>

                <p className="mt-1 text-sm leading-5 text-stone-500">
                  {cropSummary}
                </p>
              </div>
            </div>

            <div className="border-t border-stone-100 pt-4">
              <p className="text-sm leading-6 text-stone-500">
                The farm profile also includes{' '}
                <span className="font-medium text-stone-700">
                  {activeFarm.sizeAcres} acres
                </span>
                ,{' '}
                <span className="font-medium text-stone-700">
                  {activeFarm.soilType}
                </span>{' '}
                soil and{' '}
                <span className="font-medium text-stone-700">
                  {activeFarm.irrigation}
                </span>{' '}
                irrigation.
              </p>
            </div>
          </div>
        </Card>

        {/* Bottom Tip */}
        <div className="flex items-start gap-2.5 rounded-xl border border-emerald-100 bg-emerald-50/70 px-4 py-3">
          <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-600">
            <span className="text-[9px] font-bold text-white">✓</span>
          </div>

          <p className="text-[11px] leading-5 text-stone-600">
            <span className="font-semibold text-emerald-700">Tip:</span> Yield
            predictions become more useful when your farm's crop, soil,
            irrigation, and seasonal information are kept up to date.
          </p>
        </div>
      </div>
    </PageWrapper>
  );
}