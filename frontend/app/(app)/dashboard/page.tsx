'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';

import {
  Sprout,
  TrendingUp,
  FlaskConical,
  CloudSun,
  BarChart3,
  FileText,
  ArrowUp,
  ArrowDown,
  Leaf,
  Droplets,
  Wind,
  CloudRain,
  Bell,
  User,
  ChevronDown,
} from 'lucide-react';

import { useAuth } from '@/lib/auth/AuthContext';
import { getRecommendations } from '@/lib/dataService';
import type { Recommendation } from '@/lib/types';
import { Loading, ErrorView } from '@/components/ui/States';

export default function Dashboard() {
  const router = useRouter();
  const { activeFarm } = useAuth();

  const state = activeFarm?.state;
  const district = activeFarm?.district;

  const [recommendations, setRecommendations] = useState<
    Recommendation[] | null
  >(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /*
   * -----------------------------------------------------------
   * FARMER NAME
   * -----------------------------------------------------------
   */

  const farmerName = 'Farmer';

  /*
   * -----------------------------------------------------------
   * LOAD RECOMMENDATIONS
   * -----------------------------------------------------------
   */

  useEffect(() => {
    if (!state || !district) {
      setRecommendations(null);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    getRecommendations(state, district)
      .then((data) => {
        setRecommendations(data);
      })
      .catch((err) => {
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to load dashboard data.',
        );
      })
      .finally(() => {
        setLoading(false);
      });
  }, [state, district]);

  /*
   * -----------------------------------------------------------
   * SORT RECOMMENDATIONS
   * -----------------------------------------------------------
   */

  const crops = useMemo(() => {
    if (!recommendations) {
      return [];
    }

    return [...recommendations].sort(
      (a, b) => b.confidenceScore - a.confidenceScore,
    );
  }, [recommendations]);

  const topCrop = crops[0];

  /*
   * -----------------------------------------------------------
   * NO FARM
   * -----------------------------------------------------------
   */

  if (!activeFarm || !state || !district) {
    return (
      <div className="min-h-screen bg-white px-6 py-8">
        <div className="flex min-h-[70vh] items-center justify-center">
          <div className="w-full max-w-lg rounded-2xl border border-[#e4eadf] bg-[#f7faf3] p-10 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#e8f4df]">
              <Sprout className="h-7 w-7 text-[#24833f]" />
            </div>

            <h1 className="mt-5 text-2xl font-bold text-[#17251d]">
              Add your first farm
            </h1>

            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#657067]">
              Add a farm to see crop recommendations, mandi prices,
              weather information and yield predictions.
            </p>

            <button
              type="button"
              onClick={() =>
                window.dispatchEvent(new CustomEvent('open-add-farm'))
              }
              className="mt-6 rounded-xl bg-[#24833f] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#1d7036]"
            >
              Add Farm
            </button>
          </div>
        </div>
      </div>
    );
  }

  /*
   * -----------------------------------------------------------
   * LOADING
   * -----------------------------------------------------------
   */

  if (loading) {
    return (
      <div className="min-h-screen bg-white px-6 py-8">
        <Loading />
      </div>
    );
  }

  /*
   * -----------------------------------------------------------
   * ERROR
   * -----------------------------------------------------------
   */

  if (error) {
    return (
      <div className="min-h-screen bg-white px-6 py-8">
        <ErrorView message={error} />
      </div>
    );
  }

  /*
   * -----------------------------------------------------------
   * DASHBOARD
   * -----------------------------------------------------------
   */

  return (
    <div className="min-h-screen w-full bg-white px-5 pb-6 pt-[104px] sm:px-6 lg:px-8">

      {/* HEADER */}
      <header className="fixed left-[283px] right-0 top-0 z-40 h-[104px] border-b border-[#f0f1ef] bg-white">
        <div className="flex h-full items-center justify-end px-8">

          {/* RIGHT SIDE */}
          <div className="flex items-center gap-5">

            {/* NOTIFICATIONS */}
            <button
              type="button"
              aria-label="Notifications"
              className="relative flex h-10 w-10 items-center justify-center rounded-full text-[#374151] transition hover:bg-[#f5f7f4]"
            >
              <Bell
                className="h-6 w-6"
                strokeWidth={1.8}
              />
            </button>

            {/* DIVIDER */}
            <div className="h-8 w-px bg-[#edf0eb]" />

            {/* USER */}
            <button
              type="button"
              className="flex items-center gap-3 rounded-full px-2 py-1.5 transition hover:bg-[#f7f9f6]"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#f0f7eb]">
                <User
                  className="h-6 w-6 text-[#24833f]"
                  strokeWidth={1.8}
                />
              </div>

              <span className="text-[15px] font-medium text-[#111827]">
                Hello, {farmerName}
              </span>

              <ChevronDown
                className="h-4 w-4 text-[#374151]"
                strokeWidth={2}
              />
            </button>

          </div>
        </div>
      </header>

      {/* DASHBOARD */}
      <main className="w-full">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">

          {/* =====================================================
              CROP RECOMMENDATIONS
          ====================================================== */}

          <DashboardCard
            className="border-[#dfead7] bg-[#f7faf3]"
            icon={<Sprout className="h-7 w-7 text-[#55a83b]" />}
            iconClassName="bg-[#eaf5df]"
            title="Crop Recommendations"
          >
            <p className="mt-7 text-[15px] text-[#111827]">
              Best Crop for You
            </p>

            <h2 className="mt-2 text-[25px] font-bold text-[#24833f]">
              {topCrop?.name ?? 'Tomato'}
            </h2>

            <p className="mt-2 min-h-[52px] text-[15px] leading-7 text-[#111827]">
              High demand in your region and suitable for current conditions.
            </p>

            <p className="mt-5 text-[15px] font-semibold text-[#24833f]">
              Confidence:{' '}
              {topCrop
                ? `${Math.round(topCrop.confidenceScore * 100)}%`
                : '92%'}
            </p>

            <DashboardButton
              className="border-[#3a9b50] text-[#24833f]"
              onClick={() => router.push('/recommendations')}
            >
              View Recommendations
            </DashboardButton>
          </DashboardCard>

          {/* =====================================================
              MANDI PRICES
          ====================================================== */}

          <DashboardCard
            className="border-[#dce9f8] bg-[#f5f9ff]"
            icon={<BarChart3 className="h-7 w-7 text-[#1976d2]" />}
            iconClassName="bg-[#e7f1fc]"
            title="Mandi Prices"
          >
            <p className="mt-7 text-[15px] text-[#111827]">
              Today&apos;s Prices (₹/Quintal)
            </p>

            <div className="mt-5 space-y-4">
              <PriceRow
                name="Tomato"
                price="₹2,800"
                direction="up"
              />

              <PriceRow
                name="Onion"
                price="₹2,400"
                direction="down"
              />

              <PriceRow
                name="Soybean"
                price="₹4,500"
                direction="up"
              />

              <PriceRow
                name="Wheat"
                price="₹2,250"
                direction="up"
              />
            </div>

            <DashboardButton
              className="border-[#2386d1] text-[#1680c8]"
              onClick={() => router.push('/mandi-prices')}
            >
              View All Prices
            </DashboardButton>
          </DashboardCard>

          {/* =====================================================
              SOIL ANALYSIS
          ====================================================== */}

          <DashboardCard
            className="border-[#eee3c6] bg-[#fffaf0]"
            icon={<FlaskConical className="h-7 w-7 text-[#d79500]" />}
            iconClassName="bg-[#fff3d3]"
            title="Soil Analysis"
          >
            <div className="mt-7 space-y-5">
              <MetricRow
                label="pH"
                value="6.5"
                status="Good"
                statusType="good"
              />

              <MetricRow
                label="Nitrogen (N)"
                value="240 kg/ha"
                status="Good"
                statusType="good"
              />

              <MetricRow
                label="Phosphorus (P)"
                value="18 kg/ha"
                status="Medium"
                statusType="medium"
              />

              <MetricRow
                label="Potassium (K)"
                value="320 kg/ha"
                status="Good"
                statusType="good"
              />
            </div>

            <DashboardButton
              className="border-[#dfa119] text-[#d18b00]"
              onClick={() => router.push('/soil-analysis')}
            >
              View Soil Report
            </DashboardButton>
          </DashboardCard>

          {/* =====================================================
              WEATHER
          ====================================================== */}

          <DashboardCard
            className="border-[#dcecef] bg-[#f3fbfd]"
            icon={<CloudSun className="h-7 w-7 text-[#0e9eae]" />}
            iconClassName="bg-[#e3f8fb]"
            title="Weather"
          >
            <div className="mt-5 text-center">
              <div className="text-[29px] font-bold text-[#111827]">
                29°C
              </div>

              <div className="mt-1 text-[14px] text-[#111827]">
                Sunny
              </div>
            </div>

            <div className="my-4 h-px bg-[#dbe9ec]" />

            <div className="space-y-3">
              <WeatherRow
                icon={<Droplets className="h-4 w-4" />}
                label="Humidity"
                value="62%"
              />

              <WeatherRow
                icon={<Wind className="h-4 w-4" />}
                label="Wind"
                value="14 km/h"
              />

              <WeatherRow
                icon={<CloudRain className="h-4 w-4" />}
                label="Rain Chance"
                value="20%"
              />
            </div>

            <DashboardButton
              className="border-[#10a3b3] text-[#0b94a4]"
              onClick={() => router.push('/weather')}
            >
              View Forecast
            </DashboardButton>
          </DashboardCard>

          {/* =====================================================
              YIELD PREDICTION
          ====================================================== */}

          <DashboardCard
            className="border-[#d8ebe3] bg-[#f2faf6]"
            icon={<TrendingUp className="h-7 w-7 text-[#199d68]" />}
            iconClassName="bg-[#e2f6eb]"
            title="Yield Prediction"
          >
            <p className="mt-7 text-[15px] text-[#111827]">
              Predicted Yield
            </p>

            <h2 className="mt-2 text-[25px] font-bold text-[#16854f]">
              4.2 tonnes/acre
            </h2>

            <p className="mt-4 text-[15px] text-[#111827]">
              For {topCrop?.name ?? 'Tomato'}
            </p>

            <p className="mt-4 text-[15px] font-semibold text-[#16854f]">
              Confidence: 85%
            </p>

            <DashboardButton
              className="border-[#329b65] text-[#16854f]"
              onClick={() => router.push('/yield-prediction')}
            >
              View Prediction
            </DashboardButton>
          </DashboardCard>

          {/* =====================================================
              REPORTS
          ====================================================== */}

          <DashboardCard
            className="border-[#f0e1d6] bg-[#fff7f1]"
            icon={<FileText className="h-7 w-7 text-[#e26700]" />}
            iconClassName="bg-[#fff0e4]"
            title="Reports"
          >
            <p className="mt-7 text-[15px] text-[#111827]">
              Your farm reports are ready.
            </p>

            <div className="mt-5 space-y-3 text-[15px] text-[#111827]">
              <p>• Soil Health Report</p>
              <p>• Crop Performance Report</p>
              <p>• Yield Report</p>
            </div>

            <DashboardButton
              className="border-[#ed7b23] text-[#dc6200]"
              onClick={() => router.push('/reports')}
            >
              View Reports
            </DashboardButton>
          </DashboardCard>

        </div>

        {/* =======================================================
            TIP BAR
        ======================================================== */}

        <div className="mt-5 flex items-center gap-4 rounded-xl border border-[#dce8d4] bg-[#f4f8ef] px-5 py-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#e6f1dc]">
            <Leaf className="h-5 w-5 text-[#54a53d]" />
          </div>

          <p className="text-[15px] text-[#111827]">
            <span className="font-semibold">Tip:</span>{' '}
            Keep your farm details and crop data updated to get the most
            accurate recommendations.
          </p>
        </div>
      </main>
    </div>
  );
}

/* ===============================================================
   DASHBOARD CARD
================================================================ */

function DashboardCard({
  children,
  title,
  icon,
  iconClassName,
  className = '',
}: {
  children: ReactNode;
  title: string;
  icon: ReactNode;
  iconClassName?: string;
  className?: string;
}) {
  return (
    <section
      className={`flex min-h-[390px] flex-col rounded-2xl border p-6 ${className}`}
    >
      <div className="flex items-center gap-4">
        <div
          className={`flex h-[60px] w-[60px] shrink-0 items-center justify-center rounded-full ${
            iconClassName ?? 'bg-white'
          }`}
        >
          {icon}
        </div>

        <h2 className="text-[18px] font-semibold text-[#111827]">
          {title}
        </h2>
      </div>

      <div className="flex flex-1 flex-col">
        {children}
      </div>
    </section>
  );
}

/* ===============================================================
   DASHBOARD BUTTON
================================================================ */

function DashboardButton({
  children,
  className = '',
  onClick,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`mt-auto w-full rounded-lg border bg-transparent py-3 text-[15px] font-semibold transition hover:bg-white/70 ${className}`}
    >
      {children}
    </button>
  );
}

/* ===============================================================
   MANDI PRICE ROW
================================================================ */

function PriceRow({
  name,
  price,
  direction,
}: {
  name: string;
  price: string;
  direction: 'up' | 'down';
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[15px] font-semibold text-[#111827]">
        {name}
      </span>

      <div className="flex items-center gap-5">
        <span className="text-[15px] text-[#111827]">
          {price}
        </span>

        {direction === 'up' ? (
          <ArrowUp className="h-5 w-5 text-[#159447]" />
        ) : (
          <ArrowDown className="h-5 w-5 text-red-500" />
        )}
      </div>
    </div>
  );
}

/* ===============================================================
   SOIL METRIC
================================================================ */

function MetricRow({
  label,
  value,
  status,
  statusType,
}: {
  label: string;
  value: string;
  status: string;
  statusType: 'good' | 'medium';
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[15px] font-semibold text-[#111827]">
        {label}
      </span>

      <div className="flex items-center gap-4">
        <span className="text-[14px] text-[#111827]">
          {value}
        </span>

        <span
          className={`rounded-lg px-3 py-1 text-[13px] font-medium ${
            statusType === 'good'
              ? 'bg-[#e8f4df] text-[#17752f]'
              : 'bg-[#fff0cc] text-[#c77a00]'
          }`}
        >
          {status}
        </span>
      </div>
    </div>
  );
}

/* ===============================================================
   WEATHER ROW
================================================================ */

function WeatherRow({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between text-[14px]">
      <div className="flex items-center gap-2 text-[#111827]">
        <span className="text-[#1999a9]">
          {icon}
        </span>

        <span>{label}</span>
      </div>

      <span className="font-medium text-[#111827]">
        {value}
      </span>
    </div>
  );
}