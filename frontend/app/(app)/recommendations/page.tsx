'use client';

import { Fragment, useEffect, useState } from 'react';
import {
  Info,
  MapPin,
  PlusCircle,
  TrendingUp,
  TrendingDown,
  Minus,
  Leaf,
  ChevronDown,
} from 'lucide-react';

import { Card } from '@/components/ui/Card';
import { Loading, ErrorView } from '@/components/ui/States';
import { PageWrapper } from '@/components/layout/PageWrapper';
import { LocationBar } from '@/components/location/LocationBar';
import { getRecommendations } from '@/lib/dataService';
import { useAuth } from '@/lib/auth/AuthContext';
import { useEffectiveLocation } from '@/lib/useEffectiveLocation';
import type {
  Recommendation,
  ReasoningDirection,
} from '@/lib/types';

/* =========================================================
   CROP IMAGES
   ========================================================= */

const CROP_IMAGES: Record<string, string> = {
  tomato: '/images/crops/tomato.jpg',
  soybean: '/images/crops/soybean.jpg',
  chilli: '/images/crops/chilli.jpg',
  chili: '/images/crops/chilli.jpg',
  onion: '/images/crops/onion.jpg',
  wheat: '/images/crops/wheat.jpg',
  rice: '/images/crops/rice.jpg',
  maize: '/images/crops/maize.jpg',
  corn: '/images/crops/maize.jpg',
};

const DEFAULT_CROP_IMAGE = '/images/crops/default.jpg';

function getCropImage(name: string) {
  return CROP_IMAGES[name.toLowerCase().trim()] ?? DEFAULT_CROP_IMAGE;
}

/* =========================================================
   REASONING STYLES
   ========================================================= */

const DIRECTION_STYLES: Record<
  ReasoningDirection,
  {
    label: string;
    className: string;
  }
> = {
  positive: {
    label: 'Positive',
    className:
      'border-emerald-200 bg-emerald-50 text-emerald-700',
  },

  risk: {
    label: 'Risk',
    className:
      'border-red-200 bg-red-50 text-red-700',
  },

  informational: {
    label: 'Info',
    className:
      'border-stone-200 bg-stone-50 text-stone-600',
  },
};

/* =========================================================
   PROBABILITY HELPERS
   ========================================================= */

function hasValidProbabilities(values: number[]): boolean {
  if (values.length === 0) return false;

  if (!values.every((v) => Number.isFinite(v) && v >= 0)) {
    return false;
  }

  return values.reduce((sum, v) => sum + v, 0) > 0;
}

function largestRemainderRound(values: number[]): number[] {
  if (!hasValidProbabilities(values)) {
    return values.map(() => 0);
  }

  const sum = values.reduce((s, v) => s + v, 0);

  const scaled = values.map((v) => (v / sum) * 100);

  const floors = scaled.map((v) => Math.floor(v));

  const result = [...floors];

  let diff =
    100 - floors.reduce((s, v) => s + v, 0);

  const order = scaled
    .map((v, i) => ({
      i,
      remainder: v - (floors[i] ?? 0),
    }))
    .sort((a, b) =>
      diff >= 0
        ? b.remainder - a.remainder
        : a.remainder - b.remainder,
    );

  let idx = 0;

  while (diff !== 0) {
    const target = order[idx % order.length];

    if (target) {
      result[target.i] =
        (result[target.i] ?? 0) +
        (diff > 0 ? 1 : -1);
    }

    diff += diff > 0 ? -1 : 1;
    idx++;
  }

  return result;
}

/* =========================================================
   PROBABILITY BREAKDOWN
   ========================================================= */

function ProbabilityBreakdown({
  probRising,
  probStable,
  probFalling,
}: {
  probRising: number;
  probStable: number;
  probFalling: number;
}) {
  const [
    risingPct,
    stablePct,
    fallingPct,
  ] = largestRemainderRound([
    probRising,
    probStable,
    probFalling,
  ]);

  const rows = [
    {
      label: 'Rising',
      pct: risingPct ?? 0,
      className: 'bg-emerald-500',
    },
    {
      label: 'Stable',
      pct: stablePct ?? 0,
      className: 'bg-amber-400',
    },
    {
      label: 'Falling',
      pct: fallingPct ?? 0,
      className: 'bg-red-400',
    },
  ];

  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <div
          key={row.label}
          className="flex items-center gap-2 text-xs"
        >
          <span className="w-12 shrink-0 text-stone-500">
            {row.label}
          </span>

          <div className="h-2 flex-1 overflow-hidden rounded-full bg-stone-100">
            <div
              className={`h-full rounded-full ${row.className}`}
              style={{
                width: `${row.pct}%`,
              }}
            />
          </div>

          <span className="w-9 text-right font-medium text-stone-600">
            {row.pct}%
          </span>
        </div>
      ))}
    </div>
  );
}

/* =========================================================
   REASONING PANEL
   ========================================================= */

function ReasoningPanel({
  rec,
}: {
  rec: Recommendation;
}) {
  if (!rec.reasoning) {
    return (
      <p className="text-sm text-stone-500">
        Detailed reasoning is not available for this
        recommendation.
      </p>
    );
  }

  return (
    <div className="space-y-4 text-sm">
      <p className="leading-6 text-stone-700">
        {rec.reasoning.summary}
      </p>

      <div className="space-y-2">
        {rec.reasoning.factors.map((factor) => {
          const style =
            DIRECTION_STYLES[factor.direction] ??
            DIRECTION_STYLES.informational;

          return (
            <div
              key={factor.factor}
              className={`rounded-xl border px-3 py-2.5 ${style.className}`}
            >
              <div className="flex gap-2">
                <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide">
                  {style.label}
                </span>

                <span>
                  <strong className="font-semibold">
                    {factor.factor}:
                  </strong>{' '}
                  {factor.detail}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {typeof rec.probRising === 'number' &&
        typeof rec.probStable === 'number' &&
        typeof rec.probFalling === 'number' && (
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-400">
              Price trend probability
            </div>

            {hasValidProbabilities([
              rec.probRising,
              rec.probStable,
              rec.probFalling,
            ]) ? (
              <ProbabilityBreakdown
                probRising={rec.probRising}
                probStable={rec.probStable}
                probFalling={rec.probFalling}
              />
            ) : (
              <p className="text-xs text-stone-500">
                Trend probability data unavailable.
              </p>
            )}
          </div>
        )}

      {rec.reasoning.limitations.length > 0 && (
        <ul className="space-y-1 border-t border-stone-100 pt-3 text-xs text-stone-500">
          {rec.reasoning.limitations.map(
            (limitation) => (
              <li
                key={limitation}
                className="flex items-start gap-1.5"
              >
                <Info className="mt-0.5 h-3 w-3 shrink-0" />
                <span>{limitation}</span>
              </li>
            ),
          )}
        </ul>
      )}
    </div>
  );
}

/* =========================================================
   NO FARM STATE
   ========================================================= */

function NoFarmState() {
  return (
    <PageWrapper title="Crop Recommendations">
      <Card title="Recommendations">
        <div className="py-14 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
            <MapPin className="h-8 w-8 text-emerald-600" />
          </div>

          <h2 className="text-xl font-semibold text-stone-800">
            Add a farm to see crop recommendations
          </h2>

          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-stone-500">
            Crop recommendations are generated for a
            specific farm based on its location and
            market conditions. Add a farm to see which
            crops are recommended for you.
          </p>

          <button
            type="button"
            onClick={() => {
              window.dispatchEvent(
                new CustomEvent('open-add-farm'),
              );
            }}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-800"
          >
            <PlusCircle className="h-4 w-4" />
            Add your first farm
          </button>
        </div>
      </Card>
    </PageWrapper>
  );
}

/* =========================================================
   TREND ICON
   ========================================================= */

function TrendIcon({
  trend,
}: {
  trend: string;
}) {
  if (trend === 'rising') {
    return (
      <span className="inline-flex items-center gap-1 text-emerald-600">
        <TrendingUp className="h-4 w-4" />
        Rising
      </span>
    );
  }

  if (trend === 'falling') {
    return (
      <span className="inline-flex items-center gap-1 text-red-500">
        <TrendingDown className="h-4 w-4" />
        Falling
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 text-stone-500">
      <Minus className="h-4 w-4" />
      Stable
    </span>
  );
}

/* =========================================================
   PROGRESS BAR
   ========================================================= */

function ProgressBar({
  value,
}: {
  value: number;
}) {
  const safeValue = Math.min(
    100,
    Math.max(0, value),
  );

  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-20 overflow-hidden rounded-full bg-stone-100">
        <div
          className="h-full rounded-full bg-emerald-500 transition-all"
          style={{
            width: `${safeValue}%`,
          }}
        />
      </div>

      <span className="text-xs font-medium text-stone-500">
        {safeValue}%
      </span>
    </div>
  );
}

/* =========================================================
   MAIN PAGE
   ========================================================= */

export default function RecommendationsPage() {
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

  const { state, district } =
    effectiveLocation;

  const [data, setData] =
    useState<Recommendation[] | null>(null);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const [expandedCropIds, setExpandedCropIds] =
    useState<Set<string>>(new Set());

  /* =======================================================
     TOGGLE DETAILS
     ======================================================= */

  const toggleReasoning = (cropId: string) => {
    setExpandedCropIds((previous) => {
      const next = new Set(previous);

      if (next.has(cropId)) {
        next.delete(cropId);
      } else {
        next.add(cropId);
      }

      return next;
    });
  };

  /* =======================================================
     LOAD RECOMMENDATIONS
     ======================================================= */

  useEffect(() => {
    if (!activeFarm || !state || !district) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }

    const controller =
      new AbortController();

    setLoading(true);
    setError(null);
    setData(null);
    setExpandedCropIds(new Set());

    getRecommendations(
      state,
      district,
      {
        signal: controller.signal,
      },
    )
      .then((result) => {
        if (controller.signal.aborted) {
          return;
        }

        setData(result);
      })
      .catch((err) => {
        if (controller.signal.aborted) {
          return;
        }

        setError(
          err instanceof Error
            ? err.message
            : 'Unable to load recommendations.',
        );
      })
      .finally(() => {
        if (controller.signal.aborted) {
          return;
        }

        setLoading(false);
      });

    return () => controller.abort();
  }, [activeFarm, state, district]);

  /* =======================================================
     LOCATION BAR
     ======================================================= */

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
        if (
          result.matchedState &&
          result.matchedDistrict
        ) {
          setMapLocation(
            result.matchedState,
            result.matchedDistrict,
          );
        }
      }}
      onResetToFarm={resetToFarm}
    />
  );

  /* =======================================================
     NO FARM
     ======================================================= */

  if (!activeFarm) {
    return <NoFarmState />;
  }

  /* =======================================================
     LOADING
     ======================================================= */

  if (loading) {
    return (
      <PageWrapper title="Crop Recommendations">
        {locationBar}

        <Loading />
      </PageWrapper>
    );
  }

  /* =======================================================
     ERROR
     ======================================================= */

  if (error) {
    return (
      <PageWrapper title="Crop Recommendations">
        {locationBar}

        <ErrorView message={error} />
      </PageWrapper>
    );
  }

  /* =======================================================
     EMPTY
     ======================================================= */

  if (!data || data.length === 0) {
    return (
      <PageWrapper title="Crop Recommendations">
        {locationBar}

        <Card title="Recommendations">
          <div className="py-8">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50">
              <Leaf className="h-6 w-6 text-emerald-600" />
            </div>

            <p className="text-sm leading-6 text-stone-600">
              {!state || !district
                ? 'This farm does not have a complete location yet. Add or update the farm location to generate recommendations.'
                : `No recommendations available for ${district}, ${state}${
                    effectiveLocation.isSupported === false
                      ? ' — this location has no forecast coverage yet.'
                      : ' yet.'
                  }`}
            </p>
          </div>
        </Card>
      </PageWrapper>
    );
  }

  /* =======================================================
     PAGE
     ======================================================= */

  return (
    <PageWrapper title="Crop Recommendations">
      <div className="space-y-6">

        {/* =================================================
            HEADER
        ================================================= */}

        <div className="rounded-2xl border border-[#e2eadc] bg-[#f7faf4] px-5 py-5 sm:px-6">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#e5f1dc]">
              <Leaf className="h-6 w-6 text-[#27833f]" />
            </div>

            <div>
              <h1 className="text-xl font-bold text-[#173b2a] sm:text-2xl">
                Crop Recommendations
              </h1>

              <p className="mt-1 text-sm leading-5 text-stone-500">
                Crops that may be suitable for your
                farm based on current conditions.
              </p>
            </div>
          </div>
        </div>

        {/* =================================================
            LOCATION
        ================================================= */}

        {locationBar}

        {/* =================================================
            FILTERS
        ================================================= */}

        <div className="flex flex-wrap gap-3">

          <div className="relative">
            <select
              defaultValue="recommended"
              className="h-10 appearance-none rounded-xl border border-stone-200 bg-white px-4 pr-9 text-sm font-medium text-stone-700 outline-none transition focus:border-emerald-400"
            >
              <option value="recommended">
                Recommended
              </option>

              <option value="profit">
                Highest Profit
              </option>

              <option value="confidence">
                Highest Confidence
              </option>
            </select>

            <ChevronDown className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-stone-400" />
          </div>

          <div className="flex h-10 items-center rounded-xl border border-stone-200 bg-white px-4 text-sm text-stone-600">
            Farm: <strong className="ml-1 text-stone-800">
              {district}
            </strong>
          </div>
        </div>

        {/* =================================================
            RECOMMENDATION CARDS
        ================================================= */}

        <div className="grid gap-5 xl:grid-cols-2">

          {data.map((rec, index) => {
            const confidence = Math.round(
              rec.confidenceScore * 100,
            );

            /*
             * The current Recommendation type does not
             * expose separate demand/supply values.
             * Until the backend provides those fields,
             * the recommendation score is used as the
             * visual indicator.
             */

            const demand = Math.min(
              100,
              Math.max(
                0,
                Math.round(rec.score),
              ),
            );

            const supply = Math.min(
              100,
              Math.max(
                0,
                Math.round(rec.score * 0.95),
              ),
            );

            const trend =
              rec.predictedTrend?.toLowerCase() ??
              'stable';

            const risk =
              confidence >= 80
                ? 'Low'
                : confidence >= 65
                  ? 'Medium'
                  : 'High';

            const riskClass =
              risk === 'Low'
                ? 'bg-emerald-50 text-emerald-700'
                : risk === 'Medium'
                  ? 'bg-amber-50 text-amber-700'
                  : 'bg-red-50 text-red-700';

            const isExpanded =
              expandedCropIds.has(rec.cropId);

            return (
              <Fragment key={rec.cropId}>

                <div
                  className={`overflow-hidden rounded-2xl border bg-white shadow-[0_5px_20px_rgba(20,49,42,0.05)] transition-all ${
                    index === 0
                      ? 'border-emerald-200'
                      : 'border-stone-200'
                  }`}
                >

                  {/* =========================================
                      IMAGE + CROP HEADER
                  ========================================= */}

                  <div className="relative h-44 overflow-hidden bg-[#eef4e8]">
                    <img
                      src={getCropImage(rec.name)}
                      alt={rec.name}
                      className="h-full w-full object-cover"
                      onError={(event) => {
                        const image =
                          event.currentTarget;

                        if (
                          image.src.endsWith(
                            DEFAULT_CROP_IMAGE,
                          )
                        ) {
                          return;
                        }

                        image.src =
                          DEFAULT_CROP_IMAGE;
                      }}
                    />

                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 via-black/15 to-transparent px-5 pb-4 pt-10">
                      <div className="flex items-end justify-between gap-3">

                        <div>
                          <p className="text-xs font-medium text-white/80">
                            {index === 0
                              ? 'Best recommendation'
                              : 'Recommended crop'}
                          </p>

                          <h2 className="mt-0.5 text-2xl font-bold text-white">
                            {rec.name}
                          </h2>
                        </div>

                        {index === 0 && (
                          <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-emerald-700">
                            Recommended
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* =========================================
                      CARD CONTENT
                  ========================================= */}

                  <div className="p-5">

                    {/* Profit + confidence */}

                    <div className="grid grid-cols-2 gap-3">

                      <div className="rounded-xl bg-[#f6faf3] p-3.5">
                        <p className="text-xs text-stone-500">
                          Expected Profit
                        </p>

                        <p className="mt-1 text-lg font-bold text-[#173b2a]">
                          ₹
                          {rec.expectedProfit.toLocaleString(
                            'en-IN',
                          )}
                        </p>

                        <p className="text-[11px] text-stone-400">
                          per acre
                        </p>
                      </div>

                      <div className="rounded-xl bg-[#f5f8fc] p-3.5">
                        <p className="text-xs text-stone-500">
                          Confidence
                        </p>

                        <p className="mt-1 text-lg font-bold text-[#173b2a]">
                          {confidence}%
                        </p>

                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-stone-200">
                          <div
                            className="h-full rounded-full bg-emerald-500"
                            style={{
                              width: `${confidence}%`,
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Why recommended */}

                    <div className="mt-4 rounded-xl border border-[#e7eee2] bg-[#fbfdf9] p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">
                        Why this crop?
                      </p>

                      <p className="mt-1.5 text-sm leading-6 text-stone-700">
                        {rec.reasoning?.summary ??
                          'This crop is recommended based on the available market and farm conditions.'}
                      </p>
                    </div>

                    {/* Stats */}

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">

                      <div>
                        <div className="mb-1.5 flex items-center justify-between">
                          <span className="text-xs text-stone-500">
                            Demand
                          </span>
                        </div>

                        <ProgressBar value={demand} />
                      </div>

                      <div>
                        <div className="mb-1.5 flex items-center justify-between">
                          <span className="text-xs text-stone-500">
                            Supply
                          </span>
                        </div>

                        <ProgressBar value={supply} />
                      </div>
                    </div>

                    {/* Trend + risk */}

                    <div className="mt-4 flex items-center justify-between border-t border-stone-100 pt-4">

                      <div>
                        <p className="mb-1 text-[11px] uppercase tracking-wide text-stone-400">
                          Price trend
                        </p>

                        <div className="text-sm font-semibold">
                          <TrendIcon trend={trend} />
                        </div>
                      </div>

                      <div className="text-right">
                        <p className="mb-1 text-[11px] uppercase tracking-wide text-stone-400">
                          Risk
                        </p>

                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${riskClass}`}
                        >
                          {risk}
                        </span>
                      </div>
                    </div>

                    {/* Details button */}

                    <button
                      type="button"
                      onClick={() =>
                        toggleReasoning(
                          rec.cropId,
                        )
                      }
                      className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-200 px-4 py-2.5 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50"
                    >
                      {isExpanded
                        ? 'Hide Details'
                        : 'Why are we recommending this?'}

                      <ChevronDown
                        className={`h-4 w-4 transition-transform ${
                          isExpanded
                            ? 'rotate-180'
                            : ''
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* =========================================
                    EXPANDED DETAILS
                ========================================= */}

                {isExpanded && (
                  <div className="xl:col-span-2 rounded-2xl border border-emerald-100 bg-[#f9fcf7] p-5">
                    <div className="mb-3 flex items-center gap-2">
                      <Info className="h-4 w-4 text-emerald-600" />

                      <h3 className="text-sm font-semibold text-[#173b2a]">
                        More about {rec.name}
                      </h3>
                    </div>

                    <ReasoningPanel rec={rec} />
                  </div>
                )}
              </Fragment>
            );
          })}
        </div>

        {/* =================================================
            FOOTER TIP
        ================================================= */}

        <div className="flex items-start gap-3 rounded-2xl border border-[#e1ead9] bg-[#f3f8ee] px-4 py-3.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white">
            <Leaf className="h-4 w-4 text-emerald-600" />
          </div>

          <p className="text-sm leading-5 text-stone-600">
            <span className="font-semibold text-stone-700">
              Tip:
            </span>{' '}
            Profit values are estimated based on
            current market trends and may vary.
          </p>
        </div>
      </div>
    </PageWrapper>
  );
}