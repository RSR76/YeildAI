'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Droplets,
  FlaskConical,
  Leaf,
  MapPin,
  Sprout,
  ThermometerSun,
} from 'lucide-react';

import { Card } from '@/components/ui/Card';
import { Loading, ErrorView } from '@/components/ui/States';
import { PageWrapper } from '@/components/layout/PageWrapper';
import { useAuth } from '@/lib/auth/AuthContext';

type SoilAnalysis = {
  soilType: string;
  ph: number;
  nitrogen: number;
  phosphorus: number;
  potassium: number;
  moisture: number;
  organicMatter: number;
  drainage: string;
};

type FarmWithSoil = {
  soilType?: string | null;
  soil_type?: string | null;
  ph?: number | null;
  soilPh?: number | null;
  soil_ph?: number | null;
  name?: string;
  state?: string;
  district?: string;
};

/* =========================================================
   FARM DATA
========================================================= */

function getSoilType(farm: FarmWithSoil): string {
  return farm.soilType ?? farm.soil_type ?? 'Unknown';
}

function getSoilPh(farm: FarmWithSoil): number | null {
  return farm.ph ?? farm.soilPh ?? farm.soil_ph ?? null;
}

/* =========================================================
   SOIL ANALYSIS
========================================================= */

function buildSoilAnalysis(farm: FarmWithSoil): SoilAnalysis {
  const soilType = getSoilType(farm);
  const farmPh = getSoilPh(farm);

  const normalized = soilType.toLowerCase();

  if (normalized.includes('black')) {
    return {
      soilType,
      ph: farmPh ?? 7.1,
      nitrogen: 62,
      phosphorus: 48,
      potassium: 72,
      moisture: 68,
      organicMatter: 1.9,
      drainage: 'Moderate',
    };
  }

  if (normalized.includes('red')) {
    return {
      soilType,
      ph: farmPh ?? 6.4,
      nitrogen: 48,
      phosphorus: 42,
      potassium: 55,
      moisture: 48,
      organicMatter: 1.4,
      drainage: 'Good',
    };
  }

  if (normalized.includes('alluvial')) {
    return {
      soilType,
      ph: farmPh ?? 7.0,
      nitrogen: 68,
      phosphorus: 61,
      potassium: 70,
      moisture: 64,
      organicMatter: 2.1,
      drainage: 'Good',
    };
  }

  if (normalized.includes('laterite')) {
    return {
      soilType,
      ph: farmPh ?? 5.8,
      nitrogen: 42,
      phosphorus: 35,
      potassium: 44,
      moisture: 52,
      organicMatter: 1.2,
      drainage: 'Good',
    };
  }

  if (normalized.includes('sandy')) {
    return {
      soilType,
      ph: farmPh ?? 6.2,
      nitrogen: 38,
      phosphorus: 32,
      potassium: 41,
      moisture: 35,
      organicMatter: 0.9,
      drainage: 'Very good',
    };
  }

  if (normalized.includes('clay')) {
    return {
      soilType,
      ph: farmPh ?? 6.8,
      nitrogen: 60,
      phosphorus: 45,
      potassium: 68,
      moisture: 75,
      organicMatter: 1.8,
      drainage: 'Poor',
    };
  }

  return {
    soilType,
    ph: farmPh ?? 6.8,
    nitrogen: 50,
    phosphorus: 45,
    potassium: 55,
    moisture: 55,
    organicMatter: 1.5,
    drainage: 'Moderate',
  };
}

/* =========================================================
   STATUS
========================================================= */

function nutrientStatus(value: number) {
  if (value >= 60) {
    return {
      label: 'Good',
      className: 'bg-emerald-50 text-emerald-700',
    };
  }

  if (value >= 40) {
    return {
      label: 'Medium',
      className: 'bg-amber-50 text-amber-700',
    };
  }

  return {
    label: 'Low',
    className: 'bg-red-50 text-red-700',
  };
}

function phStatus(ph: number) {
  if (ph >= 6 && ph <= 7.5) {
    return {
      label: 'Good',
      className: 'bg-emerald-50 text-emerald-700',
    };
  }

  return {
    label: 'Needs attention',
    className: 'bg-amber-50 text-amber-700',
  };
}

/* =========================================================
   HEALTH SCORE
========================================================= */

function getHealthScore(analysis: SoilAnalysis): number {
  const nutrientAverage =
    (analysis.nitrogen +
      analysis.phosphorus +
      analysis.potassium) /
    3;

  const phScore =
    analysis.ph >= 6 && analysis.ph <= 7.5 ? 100 : 70;

  const moistureScore =
    analysis.moisture >= 45 && analysis.moisture <= 75
      ? 100
      : 70;

  return Math.round(
    nutrientAverage * 0.6 +
      phScore * 0.2 +
      moistureScore * 0.2,
  );
}

/* =========================================================
   RECOMMENDATIONS
========================================================= */

function getRecommendations(analysis: SoilAnalysis) {
  const recommendations: {
    text: string;
    type: 'good' | 'warning';
  }[] = [];

  if (analysis.nitrogen >= 60) {
    recommendations.push({
      text: 'Maintain nitrogen level',
      type: 'good',
    });
  } else {
    recommendations.push({
      text: 'Improve nitrogen level',
      type: 'warning',
    });
  }

  if (analysis.phosphorus >= 60) {
    recommendations.push({
      text: 'Good phosphorus level',
      type: 'good',
    });
  } else {
    recommendations.push({
      text: 'Check phosphorus level',
      type: 'warning',
    });
  }

  if (analysis.moisture >= 45 && analysis.moisture <= 75) {
    recommendations.push({
      text: 'Good soil moisture',
      type: 'good',
    });
  } else {
    recommendations.push({
      text: 'Check irrigation',
      type: 'warning',
    });
  }

  if (analysis.ph >= 6 && analysis.ph <= 7.5) {
    recommendations.push({
      text: 'pH is suitable',
      type: 'good',
    });
  } else {
    recommendations.push({
      text: 'Check soil pH',
      type: 'warning',
    });
  }

  return recommendations;
}

/* =========================================================
   EMPTY FARM
========================================================= */

function EmptyFarmState() {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-10 text-center shadow-sm">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50">
        <MapPin className="h-6 w-6 text-emerald-600" />
      </div>

      <h2 className="text-lg font-semibold text-stone-800">
        Add a farm to see soil analysis
      </h2>

      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-stone-500">
        Add your farm location and details to view soil information.
      </p>
    </div>
  );
}

/* =========================================================
   MAIN PAGE
========================================================= */

export default function SoilAnalysisPage() {
  const { activeFarm } = useAuth();

  const [analysis, setAnalysis] =
    useState<SoilAnalysis | null>(null);

  const [loading, setLoading] = useState(true);

  const [error, setError] =
    useState<string | null>(null);

  /* -------------------------------------------------------
     LOAD SOIL DATA
  ------------------------------------------------------- */

  useEffect(() => {
    if (!activeFarm) {
      setAnalysis(null);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = buildSoilAnalysis(
        activeFarm as FarmWithSoil,
      );

      setAnalysis(result);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load soil analysis.',
      );
    } finally {
      setLoading(false);
    }
  }, [activeFarm]);

  /* -------------------------------------------------------
     HEALTH SCORE
  ------------------------------------------------------- */

  const healthScore = useMemo(() => {
    if (!analysis) return 0;

    return getHealthScore(analysis);
  }, [analysis]);

  /* -------------------------------------------------------
     NO FARM
  ------------------------------------------------------- */

  if (!activeFarm) {
    return (
      <PageWrapper
        title="Soil Analysis"
        subtitle="Detailed soil health analysis of your farm."
      >
        <div className="px-5 pb-10 pt-4 sm:px-8 lg:px-10">
          <EmptyFarmState />
        </div>
      </PageWrapper>
    );
  }

  /* -------------------------------------------------------
     LOADING
  ------------------------------------------------------- */

  if (loading) {
    return (
      <PageWrapper
        title="Soil Analysis"
        subtitle="Detailed soil health analysis of your farm."
      >
        <div className="px-5 pb-10 pt-4 sm:px-8 lg:px-10">
          <Loading />
        </div>
      </PageWrapper>
    );
  }

  /* -------------------------------------------------------
     ERROR
  ------------------------------------------------------- */

  if (error) {
    return (
      <PageWrapper
        title="Soil Analysis"
        subtitle="Detailed soil health analysis of your farm."
      >
        <div className="px-5 pb-10 pt-4 sm:px-8 lg:px-10">
          <ErrorView message={error} />
        </div>
      </PageWrapper>
    );
  }

  if (!analysis) {
    return null;
  }

  /* -------------------------------------------------------
     STATUS VALUES
  ------------------------------------------------------- */

  const ph = phStatus(analysis.ph);

  const nitrogen = nutrientStatus(
    analysis.nitrogen,
  );

  const phosphorus = nutrientStatus(
    analysis.phosphorus,
  );

  const potassium = nutrientStatus(
    analysis.potassium,
  );

  const recommendations =
    getRecommendations(analysis);

  const farm = activeFarm as FarmWithSoil;

  const farmName =
    farm.name ?? 'Your Farm';

  const farmLocation = [
    farm.district,
    farm.state,
  ]
    .filter(Boolean)
    .join(', ');

  /* -------------------------------------------------------
     PAGE
  ------------------------------------------------------- */

  return (
    <PageWrapper
      title="Soil Analysis"
      subtitle="Detailed soil health analysis of your farm."
    >
      <div className="px-5 pb-10 pt-4 sm:px-8 lg:px-10">

        {/* FARM INFO */}

        <div className="mb-5 flex flex-col gap-3 rounded-xl border border-stone-200 bg-white px-5 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--sage-100)]">
              <MapPin className="h-5 w-5 text-[var(--forest-600)]" />
            </div>

            <div>
              <p className="text-xs text-stone-400">
                Soil analysis for
              </p>

              <p className="text-sm font-semibold text-stone-800">
                {farmName}
              </p>
            </div>
          </div>

          {farmLocation && (
            <p className="text-sm text-stone-500">
              {farmLocation}
            </p>
          )}
        </div>

        {/* TOP CARDS */}

        <div className="grid gap-5 lg:grid-cols-3">

          {/* SOIL HEALTH */}

          <Card title="Soil Health Score">
            <div className="flex min-h-[190px] flex-col items-center justify-center">

              <div className="relative flex h-28 w-28 items-center justify-center rounded-full border-[6px] border-emerald-100">
                <div className="absolute inset-1 rounded-full border-[5px] border-emerald-500" />

                <div className="relative text-center">
                  <p className="text-3xl font-bold text-emerald-700">
                    {healthScore}
                  </p>

                  <p className="text-xs font-medium text-emerald-600">
                    Good
                  </p>
                </div>
              </div>

              <p className="mt-4 text-sm font-semibold text-stone-800">
                Overall Soil Health
              </p>

              <p className="mt-1 max-w-[210px] text-center text-xs leading-5 text-stone-500">
                Your soil indicators are generally
                suitable for cultivation.
              </p>
            </div>
          </Card>

          {/* NUTRIENTS */}

          <Card title="Nutrient Status">
            <div className="space-y-4 py-1">

              <NutrientRow
                label="pH"
                value={analysis.ph.toFixed(1)}
                status={ph}
              />

              <NutrientRow
                label="Nitrogen (N)"
                value={`${analysis.nitrogen} index`}
                status={nitrogen}
              />

              <NutrientRow
                label="Phosphorus (P)"
                value={`${analysis.phosphorus} index`}
                status={phosphorus}
              />

              <NutrientRow
                label="Potassium (K)"
                value={`${analysis.potassium} index`}
                status={potassium}
              />

              <NutrientRow
                label="Organic Carbon"
                value={`${analysis.organicMatter.toFixed(1)}%`}
                status={{
                  label:
                    analysis.organicMatter >= 1.5
                      ? 'Good'
                      : 'Medium',
                  className:
                    analysis.organicMatter >= 1.5
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-amber-50 text-amber-700',
                }}
              />

            </div>
          </Card>

          {/* SOIL TYPE */}

          <Card title="Soil Type">
            <div className="flex min-h-[190px] flex-col justify-between">

              <div className="flex items-start justify-between gap-4">

                <div>
                  <p className="text-xl font-bold text-stone-800">
                    {analysis.soilType}
                  </p>

                  <p className="mt-2 max-w-[180px] text-xs leading-5 text-stone-500">
                    Soil type based on your farm
                    information.
                  </p>
                </div>

                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-amber-50">
                  <FlaskConical className="h-7 w-7 text-amber-600" />
                </div>

              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">

                <div className="rounded-lg bg-stone-50 p-3">
                  <p className="text-[10px] uppercase tracking-wide text-stone-400">
                    pH
                  </p>

                  <p className="mt-1 text-sm font-semibold text-stone-800">
                    {analysis.ph.toFixed(1)}
                  </p>
                </div>

                <div className="rounded-lg bg-stone-50 p-3">
                  <p className="text-[10px] uppercase tracking-wide text-stone-400">
                    Drainage
                  </p>

                  <p className="mt-1 text-sm font-semibold text-stone-800">
                    {analysis.drainage}
                  </p>
                </div>

              </div>
            </div>
          </Card>

        </div>

        {/* SECOND ROW */}

        <div className="mt-5 grid gap-5 lg:grid-cols-2">

          {/* MOISTURE */}

          <Card title="Soil Moisture">
            <div className="flex items-center justify-between">

              <div className="flex items-center gap-3">

                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-50">
                  <Droplets className="h-5 w-5 text-blue-600" />
                </div>

                <div>
                  <p className="text-xs text-stone-500">
                    Current moisture level
                  </p>

                  <p className="mt-1 text-2xl font-bold text-stone-800">
                    {analysis.moisture}%
                  </p>
                </div>

              </div>

              <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700">
                {analysis.moisture >= 45 &&
                analysis.moisture <= 75
                  ? 'Good'
                  : 'Check'}
              </span>

            </div>

            <div className="mt-5 h-2.5 overflow-hidden rounded-full bg-stone-100">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all"
                style={{
                  width: `${Math.min(
                    100,
                    Math.max(
                      0,
                      analysis.moisture,
                    ),
                  )}%`,
                }}
              />
            </div>

            <div className="mt-2 flex justify-between text-[10px] text-stone-400">
              <span>Dry</span>
              <span>Healthy range</span>
              <span>Wet</span>
            </div>
          </Card>

          {/* QUICK SUMMARY */}

          <Card title="Quick Summary">
            <div className="grid grid-cols-2 gap-3">

              <SummaryItem
                icon={Sprout}
                label="Nitrogen"
                value={nitrogen.label}
              />

              <SummaryItem
                icon={FlaskConical}
                label="Phosphorus"
                value={phosphorus.label}
              />

              <SummaryItem
                icon={Leaf}
                label="Potassium"
                value={potassium.label}
              />

              <SummaryItem
                icon={Droplets}
                label="Drainage"
                value={analysis.drainage}
              />

            </div>
          </Card>

        </div>

        {/* RECOMMENDATIONS */}

        <div className="mt-5">

          <Card title="Recommendations">

            <div className="flex flex-wrap gap-3">

              {recommendations.map(
                (recommendation, index) => (
                  <div
                    key={`${recommendation.text}-${index}`}
                    className={`flex items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-medium ${
                      recommendation.type === 'good'
                        ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
                        : 'border-amber-100 bg-amber-50 text-amber-700'
                    }`}
                  >
                    {recommendation.type === 'good' ? (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    ) : (
                      <AlertTriangle className="h-3.5 w-3.5" />
                    )}

                    {recommendation.text}
                  </div>
                ),
              )}

            </div>

          </Card>

        </div>

        {/* TIP */}

        <div className="mt-5 rounded-xl border border-[#e1eadc] bg-[#f5f8f0] px-5 py-3.5">

          <div className="flex items-center gap-3">

            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white">
              <ThermometerSun className="h-4 w-4 text-[var(--forest-600)]" />
            </div>

            <p className="text-xs text-stone-600">
              <span className="font-semibold text-[var(--forest-900)]">
                Tip:
              </span>{' '}
              Keep your soil information updated to
              get better crop recommendations.
            </p>

          </div>

        </div>

      </div>
    </PageWrapper>
  );
}

/* =========================================================
   NUTRIENT ROW
========================================================= */

function NutrientRow({
  label,
  value,
  status,
}: {
  label: string;
  value: string;
  status: {
    label: string;
    className: string;
  };
}) {
  return (
    <div className="flex items-center justify-between gap-3">

      <span className="text-xs font-medium text-stone-700">
        {label}
      </span>

      <div className="flex items-center gap-2">

        <span className="text-xs text-stone-500">
          {value}
        </span>

        <span
          className={`rounded-md px-2 py-1 text-[10px] font-medium ${status.className}`}
        >
          {status.label}
        </span>

      </div>

    </div>
  );
}

/* =========================================================
   SUMMARY ITEM
========================================================= */

function SummaryItem({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Sprout;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-stone-100 bg-stone-50 p-3">

      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white">
        <Icon className="h-4 w-4 text-[var(--forest-600)]" />
      </div>

      <div className="min-w-0">

        <p className="text-[10px] text-stone-400">
          {label}
        </p>

        <p className="truncate text-xs font-semibold text-stone-700">
          {value}
        </p>

      </div>

    </div>
  );
}