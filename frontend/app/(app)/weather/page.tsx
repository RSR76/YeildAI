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
} from 'lucide-react';

import { Card } from '@/components/ui/Card';
import { KPICard } from '@/components/ui/KPICard';
import { Loading } from '@/components/ui/States';
import { PageWrapper } from '@/components/layout/PageWrapper';
import { generateWeatherWeek } from '@/lib/deriveFarmData';
import { useAuth } from '@/lib/auth/AuthContext';
import type { WeatherDay } from '@/lib/types';

const conditionIcon = (condition: string) => {
  if (condition.includes('Thunder')) return CloudLightning;
  if (condition.includes('Rain')) return CloudRain;
  if (condition.includes('Cloud')) return Cloud;
  return Sun;
};

function NoFarmState() {
  return (
    <PageWrapper title="Weather">
      <Card title='Weather'>
        <div className="py-14 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
            <MapPin className="h-8 w-8 text-emerald-600" />
          </div>

          <h2 className="text-xl font-semibold text-stone-800">
            Add a farm to see weather
          </h2>

          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-stone-500">
            Weather forecasts are specific to your farm location.
            Add a farm to view the 7-day weather outlook and farming
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
    /*
     * No active farm = no weather data.
     * Also clears any previous farm's forecast.
     */
    if (!activeFarm) {
      setData(null);
      return;
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setData(null);

    /*
     * No dedicated backend endpoint yet — weather is currently
     * derived per farm using deriveFarmData.ts.
     *
     * Recomputes whenever the active farm changes.
     */
    const timer = setTimeout(() => {
      setData(generateWeatherWeek(activeFarm));
    }, 200);

    return () => clearTimeout(timer);
  }, [activeFarm]);

  /*
   * No farm = no weather forecast.
   */
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

  const rainyDays = data.filter(
    (d) => d.rainfallChance >= 50
  ).length;

  return (
    <PageWrapper title="Weather">
      <p className="text-sm text-stone-500 -mt-4 mb-2">
        7-day outlook for {location}.
      </p>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <KPICard
          title="Today"
          value={`${today.high}° / ${today.low}°C`}
          change={today.condition}
        />

        <KPICard
          title="Rain chance today"
          value={`${today.rainfallChance}%`}
        />

        <KPICard
          title="Rainy days this week"
          value={`${rainyDays} of 7`}
        />
      </div>

      <Card title="7-day forecast">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {data.map((d) => {
            const Icon = conditionIcon(d.condition);

            return (
              <div
                key={d.date}
                className="flex flex-col items-center gap-1.5 rounded-xl border border-stone-200 bg-white p-3 text-center"
              >
                <span className="text-xs font-medium text-stone-500">
                  {d.day}
                </span>

                <span className="text-[11px] text-stone-400">
                  {d.date}
                </span>

                <Icon className="my-1 h-6 w-6 text-emerald-600" />

                <span className="text-sm font-semibold text-stone-800">
                  {d.high}° / {d.low}°
                </span>

                <span className="flex items-center gap-1 text-[11px] text-stone-500">
                  <Droplets className="h-3 w-3" />
                  {d.rainfallChance}%
                </span>
              </div>
            );
          })}
        </div>
      </Card>

      <Card title="Farming impact">
        <p className="text-sm text-stone-600">
          {rainyDays >= 3
            ? 'Above-average rainfall is expected this week. Consider delaying irrigation and check field drainage before the next spell of rain.'
            : 'Dry conditions are expected to dominate this week. Plan irrigation schedules accordingly, especially for moisture-sensitive crops.'}
        </p>
      </Card>
    </PageWrapper>
  );
}