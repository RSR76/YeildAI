'use client';

import { Card } from '@/components/ui/Card';
import { PageWrapper } from '@/components/layout/PageWrapper';

export default function SoilAnalysisPage() {
  const mockSoil = { pH: 6.5, nitrogen: 'High', phosphorus: 'Medium' };
  return (
    <PageWrapper title="Soil Analysis">
      <Card title="Soil Composition">
        <ul className="list-disc pl-5 space-y-1 text-stone-700">
          <li>pH Level: {mockSoil.pH}</li>
          <li>Nitrogen: {mockSoil.nitrogen}</li>
          <li>Phosphorus: {mockSoil.phosphorus}</li>
        </ul>
      </Card>
    </PageWrapper>
  );
}
