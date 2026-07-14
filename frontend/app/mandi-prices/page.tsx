'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Loading, ErrorView } from '@/components/ui/States';
import { PageWrapper } from '@/components/layout/PageWrapper';

export default function MandiPricesPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient('/forecast/all-latest')
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <PageWrapper title="Mandi Prices"><Loading /></PageWrapper>;
  if (error) return <PageWrapper title="Mandi Prices"><ErrorView message={error} /></PageWrapper>;

  return (
    <PageWrapper title="Mandi Prices">
      <Card title="Current Market Prices">
        <pre className="text-sm bg-stone-100 p-4 rounded-lg overflow-x-auto">{JSON.stringify(data, null, 2)}</pre>
      </Card>
    </PageWrapper>
  );
}
