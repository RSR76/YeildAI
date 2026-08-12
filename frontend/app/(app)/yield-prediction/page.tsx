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
import { Gauge, MapPin, PlusCircle, Sprout } from 'lucide-react';

import { Card } from '@/components/ui/Card';
import { KPICard } from '@/components/ui/KPICard';
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
      <Card title='Yeild Prediction'>
        <div className="py-14 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
            <MapPin className="h-8 w-8 text-emerald-600" />
          </div>

          <h2 className="text-xl font-semibold text-stone-800">
            Add a farm to see yield prediction
          </h2>

          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-stone-500">
            Yield predictions are generated for a specific farm using
            its location, crop profile, soil conditions, and seasonal
            information. Add a farm to get started.
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

  /*
   * Do not use mockFarmProfile as a fallback.
   * Yield prediction must only exist for a real active farm.
   */
  const farmName = activeFarm?.name;
  const location = activeFarm?.location;

  useEffect(() => {
    /*
     * If there is no active farm, clear any previous farm's data
     * and do not generate a prediction.
     */
    if (!activeFarm) {
      setData(null);
      setError(null);
      return;
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setData(null);
    setError(null);

    const timer = setTimeout(() => {
      try {
        const trend = generateYieldTrend(activeFarm);
        setData(trend);
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

  /*
   * These calculations are also farm-dependent.
   * They are only used after the active-farm check below.
   */
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

  /*
   * No farm = no yield prediction.
   *
   * This is intentionally before the loading state so a user who
   * has never added a farm does not see a loading spinner forever.
   */
  if (!activeFarm) {
    return <NoFarmState />;
  }

  if (!data) {
    return (
      <PageWrapper title="Yield Prediction">
        <Loading />
      </PageWrapper>
    );
  }

  if (error) {
    return (
      <PageWrapper title="Yield Prediction">
        <ErrorView message={error} />
      </PageWrapper>
    );
  }

  const latestPredicted =
    [...data].reverse().find((d) => d.predicted != null)?.predicted ?? 0;

  const latestActual =
    [...data].reverse().find((d) => d.actual != null)?.actual ?? 0;

  const changePct = latestActual
    ? Math.round(
        ((latestPredicted - latestActual) / latestActual) * 100
      )
    : 0;

  const rainyDays = weather.filter(
    (day) => day.rainfallChance >= 50
  ).length;

  const nitrogen = soil.find(
    (sample) => sample.parameter === 'Nitrogen (N)'
  );

  const moisture = soil.find(
    (sample) => sample.parameter === 'Moisture'
  );

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
      ? `The current illustrative outlook shows ${rainyDays} higher-rainfall days this week.`
      : `The current illustrative outlook shows mostly dry conditions, with ${rainyDays} higher-rainfall day${
          rainyDays === 1 ? '' : 's'
        } this week.`;

  const cropSummary =
    activeFarm.crops?.length
      ? `The prediction is adjusted for the farm's current crop profile: ${activeFarm.crops.join(
          ', '
        )}.`
      : 'No crop profile is currently available for this farm.';

  const chartValues = data.flatMap((point) =>
    [point.actual, point.predicted].filter(
      (value): value is number => value != null
    )
  );

  const minYield = chartValues.length
    ? Math.min(...chartValues)
    : 0;

  const maxYield = chartValues.length
    ? Math.max(...chartValues)
    : 10;

  const yMin = Math.max(0, Math.floor(minYield - 5));
  const yMax = Math.ceil(maxYield + 5);

  return (
    <PageWrapper title="Yield Prediction">
      <p className="text-sm text-stone-500 -mt-4 mb-2">
        Projected yield for {farmName} ({location}), based on the
        farm profile, derived soil conditions, and seasonal outlook.
      </p>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <KPICard
          title="Projected Yield (next season)"
          value={`${latestPredicted} quintals/acre`}
          change={`${changePct >= 0 ? '+' : ''}${changePct}%`}
        />

        <KPICard
          title="Last recorded yield"
          value={`${latestActual} quintals/acre`}
        />

        <KPICard
          title="Prediction confidence"
          value={`${confidence}%`}
        />
      </div>

      <Card title="Yield trend — actual vs. predicted">
        <div className="mb-3 flex items-center gap-2 text-sm text-stone-500">
          <Gauge className="h-4 w-4" />
          Quintals per acre, by season
        </div>

        <ResponsiveContainer width="100%" height={300}>
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
              stroke="var(--line)"
              vertical={false}
            />

            <XAxis
              dataKey="season"
              tick={{
                fontSize: 11,
                fill: 'var(--ink-soft)',
              }}
              axisLine={false}
              tickLine={false}
            />

            <YAxis
              domain={[yMin, yMax]}
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
                fontSize: 12.5,
              }}
            />

            <Line
              type="monotone"
              dataKey="actual"
              stroke="var(--forest-900)"
              strokeWidth={2.5}
              dot={{ r: 3 }}
              name="Actual"
              connectNulls={false}
            />

            <Line
              type="monotone"
              dataKey="predicted"
              stroke="var(--gold-500)"
              strokeWidth={2.5}
              strokeDasharray="5 4"
              dot={{ r: 3 }}
              name="Predicted"
              connectNulls
            />
          </ComposedChart>
        </ResponsiveContainer>

        <div className="mt-3 flex gap-5 text-xs text-stone-500">
          <span className="flex items-center gap-1.5">
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: 'var(--forest-900)' }}
            />
            Actual
          </span>

          <span className="flex items-center gap-1.5">
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: 'var(--gold-500)' }}
            />
            Predicted
          </span>
        </div>
      </Card>

      <Card title="What's driving this prediction">
        <div className="flex items-start gap-3 text-sm text-stone-600">
          <Sprout className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />

          <div className="space-y-2">
            <p>{soilSummary}</p>
            <p>{weatherSummary}</p>
            <p>{cropSummary}</p>

            <p>
              The farm profile also includes {activeFarm.sizeAcres} acres,
              {` ${activeFarm.soilType}`} soil and
              {` ${activeFarm.irrigation}`} irrigation.
            </p>
          </div>
        </div>
      </Card>
    </PageWrapper>
  );
}