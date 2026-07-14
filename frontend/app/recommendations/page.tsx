'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Loading, ErrorView } from '@/components/ui/States';
import { PageWrapper } from '@/components/layout/PageWrapper';

export default function RecommendationsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient('/recommendations')
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <PageWrapper title="Crop Recommendations"><Loading /></PageWrapper>;
  if (error) return <PageWrapper title="Crop Recommendations"><ErrorView message={error} /></PageWrapper>;

  return (
    <PageWrapper title="Crop Recommendations">
      <Card title="Recommendations Data">
        <pre className="text-sm bg-stone-100 p-4 rounded-lg overflow-x-auto">{JSON.stringify(data, null, 2)}</pre>
      </Card>
    </PageWrapper>
  );
}
