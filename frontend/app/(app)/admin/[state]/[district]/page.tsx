'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Tractor, Sprout, TrendingUp, Info, AlertTriangle } from 'lucide-react';

import { Card } from '@/components/ui/Card';
import { Loading, ErrorView } from '@/components/ui/States';
import { PageWrapper } from '@/components/layout/PageWrapper';
import { AdminRoute } from '@/components/auth/AdminRoute';
import { getAdminDistrict } from '@/lib/dataService';
import type { AdminDistrictDetail } from '@/lib/types';

const DIRECTION_DOT: Record<string, string> = {
  positive: 'bg-emerald-500',
  risk: 'bg-red-500',
  informational: 'bg-stone-400',
};

function AdminDistrictContent() {
  const params = useParams<{ state: string; district: string }>();
  const router = useRouter();
  const state = decodeURIComponent(params.state);
  const district = decodeURIComponent(params.district);

  const [detail, setDetail] = useState<AdminDistrictDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setDetail(null);
    setError(null);
    getAdminDistrict(state, district)
      .then((data) => {
        if (!cancelled) setDetail(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load this district.');
      });
    return () => {
      cancelled = true;
    };
  }, [state, district]);

  if (error) return <ErrorView message={error} />;
  if (!detail) return <Loading />;

  return (
    <PageWrapper title={`${district}, ${state}`}>
      <button
        onClick={() => router.push('/admin')}
        className="mb-4 flex items-center gap-1.5 text-sm font-medium text-emerald-700 hover:underline"
      >
        <ArrowLeft className="h-4 w-4" /> All regions
      </button>

      <Card title={`Registered farms (${detail.farms.length})`}>
        {detail.farms.length === 0 ? (
          <p className="text-sm text-stone-500">No farms registered in this district yet.</p>
        ) : (
          <div className="divide-y divide-stone-100">
            {detail.farms.map((f) => (
              <div key={f.id} className="flex items-start justify-between gap-3 py-3">
                <div className="flex items-start gap-2.5">
                  <Tractor className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  <div>
                    <div className="text-sm font-medium text-stone-800">{f.name}</div>
                    <div className="text-xs text-stone-400">
                      Owner: {f.user.name} · {f.sizeAcres} acres · {f.soilType}
                    </div>
                    {f.crops.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {f.crops.map((crop) => (
                          <span
                            key={crop}
                            className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-800"
                          >
                            {crop}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <span className="shrink-0 text-xs text-stone-400">
                  {new Date(f.createdAt).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="Recommended crops for this district">
        <p className="mb-3 text-xs text-stone-500">
          Same scoring model farmers in {district} see — score, expected profit, and full reasoning.
        </p>
        {detail.recommendations.length === 0 ? (
          <p className="text-sm text-stone-500">No recommendation data available for this district yet.</p>
        ) : (
          <div className="space-y-3">
            {detail.recommendations.map((rec) => (
              <div key={rec.cropId} className="rounded-xl border border-stone-200 p-4">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Sprout className="h-4 w-4 text-emerald-600" />
                    <span className="font-medium text-stone-800">{rec.name}</span>
                    {rec.category && <span className="text-xs text-stone-400">{rec.category}</span>}
                  </div>
                  <div className="flex items-center gap-1 text-xs font-medium text-emerald-700">
                    <TrendingUp className="h-3.5 w-3.5" />
                    Score {Math.round(rec.score)}
                  </div>
                </div>

                <div className="mb-2 grid grid-cols-2 gap-2 text-xs text-stone-500 sm:grid-cols-4">
                  <div>Expected profit: <span className="font-medium text-stone-800">₹{rec.expectedProfit.toLocaleString()}</span></div>
                  <div>Confidence: <span className="font-medium text-stone-800">{Math.round(rec.confidenceScore * 100)}%</span></div>
                  <div>Trend: <span className="font-medium text-stone-800">{rec.predictedTrend}</span></div>
                  <div>Price: <span className="font-medium text-stone-800">₹{rec.currentPrice.toLocaleString()}</span></div>
                </div>

                {rec.reasoning && (
                  <div className="mt-2 border-t border-stone-100 pt-2">
                    <div className="mb-1.5 flex items-start gap-1.5 text-xs text-stone-600">
                      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-stone-400" />
                      {rec.reasoning.summary}
                    </div>
                    <ul className="space-y-1">
                      {rec.reasoning.factors.map((f, i) => (
                        <li key={i} className="flex items-start gap-1.5 text-xs text-stone-600">
                          <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${DIRECTION_DOT[f.direction]}`} />
                          <span><span className="font-medium">{f.factor}:</span> {f.detail}</span>
                        </li>
                      ))}
                    </ul>
                    {rec.reasoning.limitations.length > 0 && (
                      <div className="mt-1.5 flex items-start gap-1.5 text-[11px] text-amber-700">
                        <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                        {rec.reasoning.limitations.join(' ')}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </PageWrapper>
  );
}

export default function AdminDistrictPage() {
  return (
    <AdminRoute>
      <AdminDistrictContent />
    </AdminRoute>
  );
}
