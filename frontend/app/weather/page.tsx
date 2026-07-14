'use client';

import { useEffect, useState } from 'react';
import { CloudRain, Sun, Cloud, CloudLightning, Droplets } from 'lucide-react';

import { Card } from '@/components/ui/Card';
import { KPICard } from '@/components/ui/KPICard';
import { Loading } from '@/components/ui/States';
import { PageWrapper } from '@/components/layout/PageWrapper';
import { mockWeatherWeek, mockFarmProfile } from '@/lib/mockData';
import type { WeatherDay } from '@/lib/types';

const conditionIcon = (condition: string) => {
  if (condition.includes('Thunder')) return CloudLightning;
  if (condition.includes('Rain')) return CloudRain;
  if (condition.includes('Cloud')) return Cloud;
  return Sun;
};

export default function WeatherPage() {
  const [data, setData] = useState<WeatherDay[] | null>(null);

  useEffect(() => {
    // No dedicated backend endpoint yet — sourced from the temporary mock
    // data layer (lib/mockData.ts) until a weather-provider integration exists.
    const timer = setTimeout(() => setData(mockWeatherWeek), 200);
    return () => clearTimeout(timer);
  }, []);

  if (!data) return <PageWrapper title="Weather"><Loading /></PageWrapper>;

  const today = data[0];
  const rainyDays = data.filter((d) => d.rainfallChance >= 50).length;

  return (
    <PageWrapper title="Weather">
      <p className="text-sm text-stone-500 -mt-4 mb-2">7-day outlook for {mockFarmProfile.location}.</p>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <KPICard title="Today" value={`${today.high}° / ${today.low}°C`} change={today.condition} />
        <KPICard title="Rain chance today" value={`${today.rainfallChance}%`} />
        <KPICard title="Rainy days this week" value={`${rainyDays} of 7`} />
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
                <span className="text-xs font-medium text-stone-500">{d.day}</span>
                <span className="text-[11px] text-stone-400">{d.date}</span>
                <Icon className="my-1 h-6 w-6 text-emerald-600" />
                <span className="text-sm font-semibold text-stone-800">
                  {d.high}° / {d.low}°
                </span>
                <span className="flex items-center gap-1 text-[11px] text-stone-500">
                  <Droplets className="h-3 w-3" /> {d.rainfallChance}%
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