'use client';

import { Card } from '@/components/ui/Card';
import { PageWrapper } from '@/components/layout/PageWrapper';
import { KPICard } from '@/components/ui/KPICard';

export default function WeatherPage() {
  return (
    <PageWrapper title="Weather">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <KPICard title="Temperature" value="28°C" />
        <KPICard title="Condition" value="Sunny" />
      </div>
      <Card title="Detailed Forecast">
        <p className="text-stone-600">Weather forecast data will be displayed here.</p>
      </Card>
    </PageWrapper>
  );
}
