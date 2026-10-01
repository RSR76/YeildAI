'use client';

import { useEffect, useState } from 'react';
import {
  CloudRain,
  Sun,
  Cloud,
  CloudLightning,
  Droplets,
  MapPin,
  PlusCircle,
  Wind,
} from 'lucide-react';

import { Card } from '@/components/ui/Card';
import { Loading } from '@/components/ui/States';
import { PageWrapper } from '@/components/layout/PageWrapper';
import { generateWeatherWeek } from '@/lib/deriveFarmData';
import { useAuth } from '@/lib/auth/AuthContext';
import type { WeatherDay } from '@/lib/types';

const conditionIcon = (condition: string) => {
  const value = condition.toLowerCase();

  if (value.includes('thunder')) return CloudLightning;
  if (value.includes('rain')) return CloudRain;
  if (value.includes('cloud')) return Cloud;
  return Sun;
};

function NoFarmState() {
  return (
    <PageWrapper title="Weather">
      <Card title="Weather">
        <div className="py-14 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
            <MapPin className="h-8 w-8 text-emerald-600" />
          </div>

          <h2 className="text-xl font-semibold text-stone-800">
            Add a farm to see weather
          </h2>

          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-stone-500">
            Weather forecasts are specific to your farm location.
            Add a farm to view the weather outlook and farming
            impact for your location.
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

export default function WeatherPage() {
  const { activeFarm } = useAuth();

  const [data, setData] = useState<WeatherDay[] | null>(null);

  const location = activeFarm?.location;

  useEffect(() => {
    if (!activeFarm) {
      setData(null);
      return;
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setData(null);

    const timer = setTimeout(() => {
      setData(generateWeatherWeek(activeFarm));
    }, 200);

    return () => clearTimeout(timer);
  }, [activeFarm]);

  if (!activeFarm) {
    return <NoFarmState />;
  }

  if (!data) {
    return (
      <PageWrapper title="Weather">
        <Loading />
      </PageWrapper>
    );
  }

  const today = data[0];

  const forecastDays = data.slice(0, 5);

  const rainyDays = data.filter(
    (day) => day.rainfallChance >= 50
  ).length;

  const TodayIcon = conditionIcon(today.condition);

  return (
    <PageWrapper title="Weather">
      <div className="px-5 pb-10 pt-4 sm:px-8 lg:px-10">
      {/* Header */}
      <div className="-mt-4 mb-5">
        <p className="text-sm text-stone-500">
          Current weather and forecast for your farm.
        </p>

        {location && (
          <div className="mt-1 flex items-center gap-1.5 text-xs text-stone-400">
            <MapPin className="h-3.5 w-3.5" />
            {location}
          </div>
        )}
      </div>

      {/* Main Weather Card */}
<div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">

{/* Current Weather */}
<div className="p-6">
  <p className="text-xs font-semibold text-stone-700">
    Current Weather
  </p>

  <div className="mt-6 flex items-center gap-4">
    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-50">
      <TodayIcon className="h-8 w-8 text-amber-500" />
    </div>

    <div>
      <div className="flex items-start">
        <span className="text-3xl font-semibold tracking-tight text-stone-800">
          {today.high}°
        </span>

        <span className="ml-1 mt-1 text-sm text-stone-400">
          C
        </span>
      </div>

      <p className="mt-0.5 text-xs text-stone-500">
        Today's high
      </p>
    </div>
  </div>

  <p className="mt-4 text-sm font-medium text-stone-700">
    {today.condition}
  </p>

  {/* Current Weather Metrics */}
  <div className="mt-6 grid grid-cols-2 gap-x-8 gap-y-4 border-t border-stone-100 pt-5 sm:grid-cols-4">

    <div>
      <p className="text-[10px] font-medium uppercase tracking-wide text-stone-400">
        Rain Chance
      </p>

      <div className="mt-1 flex items-center gap-1.5">
        <Droplets className="h-3.5 w-3.5 text-sky-500" />

        <span className="text-xs font-semibold text-stone-700">
          {today.rainfallChance}%
        </span>
      </div>
    </div>

    <div>
      <p className="text-[10px] font-medium uppercase tracking-wide text-stone-400">
        Low
      </p>

      <p className="mt-1 text-xs font-semibold text-stone-700">
        {today.low}°C
      </p>
    </div>

    <div>
      <p className="text-[10px] font-medium uppercase tracking-wide text-stone-400">
        Forecast
      </p>

      <p className="mt-1 text-xs font-semibold text-stone-700">
        {today.day}
      </p>
    </div>

    <div>
      <p className="text-[10px] font-medium uppercase tracking-wide text-stone-400">
        Rainy Days
      </p>

      <p className="mt-1 text-xs font-semibold text-stone-700">
        {rainyDays} this week
      </p>
    </div>

  </div>
</div>


{/* Divider */}
<div className="border-t border-stone-200" />


{/* 5 Day Forecast */}
<div className="p-6">
  <p className="text-xs font-semibold text-stone-700">
    5 Day Forecast
  </p>

  <div className="mt-4 divide-y divide-stone-100">

    {forecastDays.map((day, index) => {
      const Icon = conditionIcon(day.condition);

      return (
        <div
          key={day.date}
          className="grid grid-cols-[1fr_auto_1fr_auto] items-center gap-4 py-3"
        >

          {/* Day */}
          <div>
            <p className="text-[11px] font-semibold text-stone-700">
              {index === 0 ? 'Today' : day.day}
            </p>

            <p className="mt-0.5 text-[9px] text-stone-400">
              {day.date}
            </p>
          </div>


          {/* Weather Icon */}
          <div className="flex h-8 w-8 items-center justify-center">
            <Icon
              className={`h-5 w-5 ${
                day.condition.toLowerCase().includes('rain')
                  ? 'text-sky-500'
                  : day.condition
                      .toLowerCase()
                      .includes('cloud')
                  ? 'text-slate-400'
                  : 'text-amber-500'
              }`}
            />
          </div>


          {/* Temperature */}
          <div>
            <span className="text-xs font-semibold text-stone-700">
              {day.high}°C
            </span>

            <span className="ml-2 text-[10px] text-stone-400">
              {day.low}°C
            </span>
          </div>


          {/* Condition */}
          <div className="min-w-[70px] text-right">
            <p className="truncate text-[9px] text-stone-500">
              {day.condition}
            </p>

            <div className="mt-0.5 flex items-center justify-end gap-1">
              <Droplets className="h-2.5 w-2.5 text-sky-500" />

              <span className="text-[9px] text-stone-400">
                {day.rainfallChance}%
              </span>
            </div>
          </div>

        </div>
      );
    })}

  </div>
</div>

</div>

      {/* Farming Impact */}
      <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-emerald-100 bg-emerald-50/70 px-4 py-3">
        <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-600">
          <span className="text-[9px] font-bold text-white">✓</span>
        </div>

        <p className="text-[11px] leading-5 text-stone-600">
          <span className="font-semibold text-emerald-700">
            Tip:
          </span>{' '}
          {rainyDays >= 3
            ? 'Weather updates help you better plan irrigation and crop protection. Above-average rainfall is expected this week, so check field drainage before the next spell of rain.'
            : 'Weather updates help you better plan irrigation and crop protection. Dry conditions are expected this week, so plan irrigation schedules accordingly.'}
        </p>
      </div>
      </div>
    </PageWrapper>
  );
}