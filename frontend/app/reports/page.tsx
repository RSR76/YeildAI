'use client';

import { useEffect, useState } from 'react';
import { FileText, Calendar } from 'lucide-react';

import { Card } from '@/components/ui/Card';
import { Loading, EmptyState } from '@/components/ui/States';
import { PageWrapper } from '@/components/layout/PageWrapper';
import { getReports } from '@/lib/dataService';
import type { Report } from '@/lib/types';

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[] | null>(null);

  useEffect(() => {
    getReports().then(setReports);
  }, []);

  if (!reports) return <PageWrapper title="Analytics Reports"><Loading /></PageWrapper>;

  return (
    <PageWrapper title="Analytics Reports">
      <Card title="Available Reports">
        {reports.length === 0 ? (
          <EmptyState message="No reports generated yet." />
        ) : (
          <div className="space-y-3">
            {reports.map((r) => (
              <div
                key={r.id}
                className="flex items-start gap-3 rounded-xl border border-stone-200 bg-white p-4"
              >
                <FileText className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                <div className="flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="font-medium text-stone-800">{r.title}</h4>
                    <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-medium text-stone-600">
                      {r.type}
                    </span>
                  </div>
                  {r.summary && <p className="mt-1 text-sm text-stone-600">{r.summary}</p>}
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-stone-400">
                    <Calendar className="h-3 w-3" />
                    {new Date(r.createdAt).toLocaleDateString('en-IN', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </PageWrapper>
  );
}