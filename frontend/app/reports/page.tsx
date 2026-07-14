'use client';

import { Card } from '@/components/ui/Card';
import { PageWrapper } from '@/components/layout/PageWrapper';

export default function ReportsPage() {
  return (
    <PageWrapper title="Analytics Reports">
      <Card title="Available Reports">
        <p className="text-stone-600">No reports generated yet.</p>
      </Card>
    </PageWrapper>
  );
}
