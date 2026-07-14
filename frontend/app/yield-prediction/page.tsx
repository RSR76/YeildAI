'use client';

import { Card } from '@/components/ui/Card';
import { PageWrapper } from '@/components/layout/PageWrapper';
import { KPICard } from '@/components/ui/KPICard';

export default function YieldPredictionPage() {
  return (
    <PageWrapper title="Yield Prediction">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <KPICard title="Projected Yield" value="45 quintals/acre" />
        <KPICard title="Confidence" value="88%" />
      </div>
      <Card title="Yield Analysis">
        <p className="text-stone-600">Based on historical data and current soil conditions, the projected yield is optimized for the upcoming season.</p>
      </Card>
    </PageWrapper>
  );
}
