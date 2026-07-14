'use client';

import { Card } from '@/components/ui/Card';
import { PageWrapper } from '@/components/layout/PageWrapper';

export default function FarmDetailsPage() {
  const farmData = { name: "Green Acres", location: "Punjab, India", size: "50 acres", crops: "Wheat, Rice" };
  return (
    <PageWrapper title="Farm Details">
      <Card title="Farm Profile">
        <div className="grid grid-cols-2 gap-4 text-stone-700">
          <p><strong>Name:</strong> {farmData.name}</p>
          <p><strong>Location:</strong> {farmData.location}</p>
          <p><strong>Size:</strong> {farmData.size}</p>
          <p><strong>Crops:</strong> {farmData.crops}</p>
        </div>
      </Card>
    </PageWrapper>
  );
}
