'use client';

import dynamic from 'next/dynamic';
import { memo, useCallback, useState } from 'react';
import { Loader2, MapPin, CheckCircle2, AlertTriangle, XCircle, Info } from 'lucide-react';
import { reverseGeocode as requestReverseGeocode } from '@/lib/dataService';
import { TELANGANA_CENTER, TELANGANA_ZOOM } from '@/lib/mapConfig';
import type { LocationMatchStatus, ReverseGeocodeResult, SelectedCoordinates } from '@/lib/types';

const LocationMap = dynamic(() => import('./LocationMap'), {
  ssr: false,
  loading: () => (
    <div className="flex h-64 items-center justify-center rounded-xl border border-stone-200 bg-stone-50 text-sm text-stone-500 sm:h-80">
      Loading map…
    </div>
  ),
});

function formatCoord(value: number): string {
  return value.toFixed(5);
}

/**
 * Orchestrates pin selection -> explicit "Use this location" -> reverse
 * geocoding -> reporting the resolved location to the caller. Does not fetch
 * recommendations or touch the state/district selectors itself — the
 * Recommendations page owns that decision via onLocationResolved, so this
 * component stays reusable and the existing recommendation-fetch flow is
 * never duplicated.
 */
export const LocationPicker = memo(function LocationPicker({
  onLocationResolved,
}: {
  onLocationResolved: (result: ReverseGeocodeResult) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [pin, setPin] = useState<SelectedCoordinates | null>(null);
  const [status, setStatus] = useState<LocationMatchStatus>('idle');
  const [result, setResult] = useState<ReverseGeocodeResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSelectPin = useCallback((coords: SelectedCoordinates) => {
    setPin(coords);
    setStatus('idle');
    setResult(null);
    setErrorMessage(null);
  }, []);

  const handleUseLocation = useCallback(async () => {
    if (!pin) return;
    setStatus('loading');
    setErrorMessage(null);
    try {
      const geocoded = await requestReverseGeocode(pin.latitude, pin.longitude);
      setResult(geocoded);
      if (geocoded.isSupportedLocation) {
        setStatus('success');
      } else if (geocoded.matchedState) {
        setStatus('partial');
      } else {
        setStatus('unsupported');
      }
      onLocationResolved(geocoded);
    } catch (err) {
      setStatus('error');
      setErrorMessage(err instanceof Error ? err.message : 'The location lookup failed.');
    }
  }, [pin, onLocationResolved]);

  return (
    <div className="mt-4 border-t border-stone-100 pt-4">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-controls="location-map-panel"
        className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 transition-colors hover:bg-stone-50"
      >
        <MapPin size={14} />
        {expanded ? 'Hide map' : 'Choose on map'}
      </button>

      {expanded && (
        <div id="location-map-panel" className="mt-3 space-y-3">
          <p className="text-xs text-stone-500">
            The map opens centered on Telangana, YieldAI&apos;s currently supported state — click anywhere (including
            outside Telangana) to drop a pin. Click elsewhere to move it. The state/district selectors above always
            keep working, whether or not you use the map.
          </p>

          <LocationMap center={TELANGANA_CENTER} zoom={TELANGANA_ZOOM} selected={pin} onSelect={handleSelectPin} />

          {pin && (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <span className="font-mono text-xs text-stone-600">
                {formatCoord(pin.latitude)}, {formatCoord(pin.longitude)}
              </span>
              <button
                type="button"
                onClick={handleUseLocation}
                disabled={status === 'loading'}
                aria-label="Use this map location for recommendations"
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[var(--forest-600)] px-3 py-1.5 text-xs font-medium text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
              >
                {status === 'loading' ? <Loader2 size={14} className="animate-spin" /> : <MapPin size={14} />}
                {status === 'loading' ? 'Looking up location…' : 'Use this location'}
              </button>
            </div>
          )}

          <div role="status" aria-live="polite">
            {status === 'loading' && (
              <p className="text-xs text-stone-500">Looking up this location…</p>
            )}
            {status === 'success' && result && (
              <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  Matched to <strong>{result.matchedDistrict ?? 'this district'}, {result.matchedState ?? 'this state'}</strong>
                  {result.displayName ? ` (${result.displayName})` : ''}. Recommendations updated for this location.
                </span>
              </div>
            )}
            {status === 'partial' && result && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  Matched state <strong>{result.matchedState ?? 'this state'}</strong>, but the mapped district
                  {result.district ? ` (${result.district})` : ''} isn&apos;t in the forecast dataset yet. Pick a
                  supported district from the dropdown above.
                </span>
              </div>
            )}
            {status === 'unsupported' && result && pin && (
              <div className="flex items-start gap-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-stone-600">
                <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  Mapped to {result.displayName ?? `${formatCoord(pin.latitude)}, ${formatCoord(pin.longitude)}`}, but
                  forecast data isn&apos;t currently available for that location. Your current selection is unchanged —
                  use the selectors above, or try another point on the map.
                </span>
              </div>
            )}
            {status === 'error' && (
              <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  {errorMessage ?? 'The location lookup failed.'} You can try again, or continue using the state/district
                  selectors above.
                </span>
              </div>
            )}
          </div>

          <p className="flex items-start gap-1.5 text-xs text-stone-400">
            <Info className="mt-0.5 h-3 w-3 shrink-0" />
            <span>
              This location is used to match available forecast and recommendation data. It does not perform soil
              analysis and is not saved as a farm — farm-specific soil analysis will be connected separately.
            </span>
          </p>
        </div>
      )}
    </div>
  );
});
