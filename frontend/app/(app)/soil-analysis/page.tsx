'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Droplets,
  FlaskConical,
  Leaf,
  MapPin,
  PlusCircle,
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
};

function getSoilType(farm: FarmWithSoil): string {
  return farm.soilType ?? farm.soil_type ?? 'Unknown';
}

function getSoilPh(farm: FarmWithSoil): number | null {
  return farm.ph ?? farm.soilPh ?? farm.soil_ph ?? null;
}

/**
 * Local soil analysis fallback.
 *
 * This keeps the page functional when the backend does not yet expose
 * a dedicated soil-analysis endpoint.
 *
 * Replace this function with your soil API/dataService call when the
 * backend soil-analysis endpoint is available.
 */
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

function getNutrientStatus(value: number): {
  label: string;
  className: string;
} {
  if (value >= 60) {
    return {
      label: 'Good',
      className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    };
  }

  if (value >= 40) {
    return {
      label: 'Moderate',
      className: 'bg-amber-50 text-amber-700 border-amber-200',
    };
  }

  return {
    label: 'Low',
    className: 'bg-red-50 text-red-700 border-red-200',
  };
}

function getPhStatus(ph: number) {
  if (ph >= 6 && ph <= 7.5) {
    return {
      label: 'Suitable',
      className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    };
  }

  if (ph >= 5.5 && ph <= 8) {
    return {
      label: 'Acceptable',
      className: 'bg-amber-50 text-amber-700 border-amber-200',
    };
  }

  return {
    label: 'Needs attention',
    className: 'bg-red-50 text-red-700 border-red-200',
  };
}

function getMoistureStatus(moisture: number) {
  if (moisture >= 45 && moisture <= 75) {
    return {
      label: 'Healthy',
      className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    };
  }

  if (moisture < 45) {
    return {
      label: 'Low',
      className: 'bg-amber-50 text-amber-700 border-amber-200',
    };
  }

  return {
    label: 'High',
    className: 'bg-blue-50 text-blue-700 border-blue-200',
  };
}

function getOverallStatus(analysis: SoilAnalysis) {
  const nutrientValues = [
    analysis.nitrogen,
    analysis.phosphorus,
    analysis.potassium,
  ];

  const nutrientScore =
    nutrientValues.reduce((sum, value) => sum + value, 0) /
    nutrientValues.length;

  const phGood = analysis.ph >= 6 && analysis.ph <= 7.5;
  const moistureGood =
    analysis.moisture >= 45 && analysis.moisture <= 75;

  if (nutrientScore >= 60 && phGood && moistureGood) {
    return {
      label: 'Healthy soil',
      description:
        'The available soil indicators are generally favorable for crop cultivation.',
      icon: CheckCircle2,
      className:
        'border-emerald-200 bg-emerald-50 text-emerald-800',
    };
  }

  if (nutrientScore >= 40 && (phGood || moistureGood)) {
    return {
      label: 'Moderate condition',
      description:
        'The soil is usable, but some indicators may benefit from management or monitoring.',
      icon: AlertTriangle,
      className:
        'border-amber-200 bg-amber-50 text-amber-800',
    };
  }

  return {
    label: 'Needs attention',
    description:
      'Some soil indicators may require corrective management before cultivation.',
    icon: AlertTriangle,
    className:
      'border-red-200 bg-red-50 text-red-800',
  };
}

function EmptyFarmState() {
  return (
    <Card title="Soil Analysis">
      <div className="py-14 text-center">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
          <MapPin className="h-8 w-8 text-emerald-600" />
        </div>

        <h2 className="text-xl font-semibold text-stone-800">
          Add a farm to see soil analysis
        </h2>

        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-stone-500">
          Soil analysis is specific to a farm. Add your first farm with its
          location and soil information to view the analysis here.
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
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  unit,
  status,
}: {
  icon: typeof Leaf;
  label: string;
  value: string | number;
  unit?: string;
  status?: {
    label: string;
    className: string;
  };
}) {
  return (
    <Card title="Soil Analysis">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-stone-500">{label}</p>

          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl font-semibold text-stone-800">
              {value}
            </span>

            {unit && (
              <span className="text-xs text-stone-500">
                {unit}
              </span>
            )}
          </div>

          {status && (
            <span
              className={`mt-3 inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${status.className}`}
            >
              {status.label}
            </span>
          )}
        </div>

        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50">
          <Icon className="h-5 w-5 text-emerald-600" />
        </div>
      </div>
    </Card>
  );
}

export default function SoilAnalysisPage() {
  const { activeFarm } = useAuth();

  const [analysis, setAnalysis] = useState<SoilAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Only calculate/load soil analysis when an active farm exists.
   *
   * This is the important part of the new behavior:
   * no farm = no soil data.
   */
  useEffect(() => {
    if (!activeFarm) {
      setAnalysis(null);
      setLoading(false);
      setError(null);
      return;
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(null);
    setAnalysis(null);

    try {
      const soilAnalysis = buildSoilAnalysis(
        activeFarm as FarmWithSoil
      );

      setAnalysis(soilAnalysis);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load soil analysis.'
      );
    } finally {
      setLoading(false);
    }
  }, [activeFarm]);

  const overallStatus = useMemo(() => {
    if (!analysis) return null;
    return getOverallStatus(analysis);
  }, [analysis]);

  if (!activeFarm) {
    return (
      <PageWrapper title="Soil Analysis">
        <EmptyFarmState />
      </PageWrapper>
    );
  }

  if (loading) {
    return (
      <PageWrapper title="Soil Analysis">
        <Loading />
      </PageWrapper>
    );
  }

  if (error) {
    return (
      <PageWrapper title="Soil Analysis">
        <ErrorView message={error} />
      </PageWrapper>
    );
  }

  if (!analysis || !overallStatus) {
    return (
      <PageWrapper title="Soil Analysis">
        <Card title="Soil Analysis">
          <div className="py-10 text-center">
            <p className="text-sm text-stone-500">
              No soil analysis is available for this farm yet.
            </p>
          </div>
        </Card>
      </PageWrapper>
    );
  }

  const StatusIcon = overallStatus.icon;

  const phStatus = getPhStatus(analysis.ph);
  const moistureStatus = getMoistureStatus(analysis.moisture);
  const nitrogenStatus = getNutrientStatus(analysis.nitrogen);
  const phosphorusStatus = getNutrientStatus(analysis.phosphorus);
  const potassiumStatus = getNutrientStatus(analysis.potassium);

  const farmName =
    (activeFarm as FarmWithSoil & { name?: string }).name ??
    'Active farm';

  const farmState =
    (activeFarm as FarmWithSoil & { state?: string }).state;

  const farmDistrict =
    (activeFarm as FarmWithSoil & { district?: string }).district;

  return (
    <PageWrapper title="Soil Analysis">
      {/* Farm context */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-stone-200 bg-stone-50 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100">
            <MapPin className="h-4 w-4 text-emerald-700" />
          </div>

          <div>
            <p className="text-xs text-stone-500">
              Soil analysis for
            </p>

            <p className="text-sm font-semibold text-stone-800">
              {farmName}
            </p>
          </div>
        </div>

        {(farmDistrict || farmState) && (
          <p className="text-sm text-stone-500">
            {[farmDistrict, farmState].filter(Boolean).join(', ')}
          </p>
        )}
      </div>

      {/* Overall condition */}
      <div
        className={`mb-6 rounded-xl border px-5 py-4 ${overallStatus.className}`}
      >
        <div className="flex items-start gap-3">
          <StatusIcon className="mt-0.5 h-5 w-5 shrink-0" />

          <div>
            <h2 className="font-semibold">
              {overallStatus.label}
            </h2>

            <p className="mt-1 text-sm opacity-80">
              {overallStatus.description}
            </p>
          </div>
        </div>
      </div>

      {/* Soil overview */}
      <Card title="Soil Overview">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-stone-400">
              Soil type
            </p>

            <div className="mt-2 flex items-center gap-2">
              <Sprout className="h-4 w-4 text-emerald-600" />
              <p className="font-semibold text-stone-800">
                {analysis.soilType}
              </p>
            </div>
          </div>

          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-stone-400">
              pH
            </p>

            <div className="mt-2 flex items-center gap-2">
              <FlaskConical className="h-4 w-4 text-emerald-600" />
              <p className="font-semibold text-stone-800">
                {analysis.ph.toFixed(1)}
              </p>

              <span
                className={`rounded-full border px-2 py-0.5 text-xs ${phStatus.className}`}
              >
                {phStatus.label}
              </span>
            </div>
          </div>

          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-stone-400">
              Drainage
            </p>

            <div className="mt-2 flex items-center gap-2">
              <Droplets className="h-4 w-4 text-emerald-600" />
              <p className="font-semibold text-stone-800">
                {analysis.drainage}
              </p>
            </div>
          </div>

          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-stone-400">
              Organic matter
            </p>

            <div className="mt-2 flex items-center gap-2">
              <Leaf className="h-4 w-4 text-emerald-600" />
              <p className="font-semibold text-stone-800">
                {analysis.organicMatter.toFixed(1)}%
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Nutrient metrics */}
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <MetricCard
          icon={Leaf}
          label="Nitrogen"
          value={analysis.nitrogen}
          unit="index"
          status={nitrogenStatus}
        />

        <MetricCard
          icon={Sprout}
          label="Phosphorus"
          value={analysis.phosphorus}
          unit="index"
          status={phosphorusStatus}
        />

        <MetricCard
          icon={Leaf}
          label="Potassium"
          value={analysis.potassium}
          unit="index"
          status={potassiumStatus}
        />
      </div>

      {/* Moisture */}
      <div className="mt-6">
        <Card title="Soil Moisture">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-50">
                <Droplets className="h-5 w-5 text-blue-600" />
              </div>

              <div>
                <p className="text-sm text-stone-500">
                  Current moisture level
                </p>

                <p className="mt-1 text-2xl font-semibold text-stone-800">
                  {analysis.moisture}%
                </p>
              </div>
            </div>

            <span
              className={`self-start rounded-full border px-3 py-1.5 text-xs font-medium md:self-center ${moistureStatus.className}`}
            >
              {moistureStatus.label}
            </span>
          </div>

          <div className="mt-5 h-3 overflow-hidden rounded-full bg-stone-100">
            <div
              className="h-full rounded-full bg-emerald-600 transition-all"
              style={{
                width: `${Math.min(
                  100,
                  Math.max(0, analysis.moisture)
                )}%`,
              }}
            />
          </div>

          <div className="mt-2 flex justify-between text-xs text-stone-400">
            <span>Dry</span>
            <span>Optimal range</span>
            <span>Wet</span>
          </div>
        </Card>
      </div>

      {/* Soil indicators */}
      <div className="mt-6">
        <Card title="Soil Indicators">
          <div className="space-y-5">
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-stone-700">
                  Nitrogen
                </span>
                <span className="text-sm text-stone-500">
                  {analysis.nitrogen}
                </span>
              </div>

              <div className="h-2 overflow-hidden rounded-full bg-stone-100">
                <div
                  className="h-full rounded-full bg-emerald-600"
                  style={{
                    width: `${Math.min(100, analysis.nitrogen)}%`,
                  }}
                />
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-stone-700">
                  Phosphorus
                </span>
                <span className="text-sm text-stone-500">
                  {analysis.phosphorus}
                </span>
              </div>

              <div className="h-2 overflow-hidden rounded-full bg-stone-100">
                <div
                  className="h-full rounded-full bg-emerald-600"
                  style={{
                    width: `${Math.min(
                      100,
                      analysis.phosphorus
                    )}%`,
                  }}
                />
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-stone-700">
                  Potassium
                </span>
                <span className="text-sm text-stone-500">
                  {analysis.potassium}
                </span>
              </div>

              <div className="h-2 overflow-hidden rounded-full bg-stone-100">
                <div
                  className="h-full rounded-full bg-emerald-600"
                  style={{
                    width: `${Math.min(
                      100,
                      analysis.potassium
                    )}%`,
                  }}
                />
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-stone-700">
                  Organic matter
                </span>
                <span className="text-sm text-stone-500">
                  {analysis.organicMatter.toFixed(1)}%
                </span>
              </div>

              <div className="h-2 overflow-hidden rounded-full bg-stone-100">
                <div
                  className="h-full rounded-full bg-emerald-600"
                  style={{
                    width: `${Math.min(
                      100,
                      analysis.organicMatter * 25
                    )}%`,
                  }}
                />
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Recommendations */}
      <div className="mt-6">
        <Card title="Soil Management Notes">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-stone-200 bg-stone-50 p-4">
              <div className="flex gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50">
                  <Leaf className="h-4 w-4 text-emerald-600" />
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-stone-800">
                    Nutrient management
                  </h3>

                  <p className="mt-1 text-sm leading-5 text-stone-500">
                    Monitor nitrogen, phosphorus and potassium levels
                    when planning the next cultivation cycle.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-stone-200 bg-stone-50 p-4">
              <div className="flex gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50">
                  <Droplets className="h-4 w-4 text-blue-600" />
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-stone-800">
                    Water management
                  </h3>

                  <p className="mt-1 text-sm leading-5 text-stone-500">
                    Consider the moisture level and drainage
                    characteristics when planning irrigation.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-stone-200 bg-stone-50 p-4">
              <div className="flex gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50">
                  <FlaskConical className="h-4 w-4 text-amber-600" />
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-stone-800">
                    pH management
                  </h3>

                  <p className="mt-1 text-sm leading-5 text-stone-500">
                    The soil pH is {analysis.ph.toFixed(1)}. Keep
                    monitoring pH when selecting crops and planning
                    soil amendments.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-stone-200 bg-stone-50 p-4">
              <div className="flex gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-orange-50">
                  <ThermometerSun className="h-4 w-4 text-orange-600" />
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-stone-800">
                    Crop planning
                  </h3>

                  <p className="mt-1 text-sm leading-5 text-stone-500">
                    Use these soil indicators together with market,
                    weather and crop suitability information when
                    making cultivation decisions.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </PageWrapper>
  );
}