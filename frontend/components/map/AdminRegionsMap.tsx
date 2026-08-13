'use client';

import { useMemo } from 'react';
import { MapContainer, TileLayer, CircleMarker, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

import type { AdminRegionSummary } from '@/lib/types';

const INDIA_CENTER: [number, number] = [22.9734, 78.6569];
const INDIA_ZOOM = 5;

function radiusFor(farmCount: number, max: number): number {
  if (max <= 0) return 6;
  const min = 6;
  const cap = 26;
  return min + (cap - min) * Math.sqrt(farmCount / max);
}

/**
 * NOTE: this assumes `leaflet` / `react-leaflet` are already dependencies
 * (LocationMap.tsx, dynamically imported elsewhere with ssr:false, strongly
 * suggests they are). This is a new, separate component rather than an
 * extension of LocationMap, since LocationMap's props weren't in the files
 * you shared and it's built for single-pin *selection*, not many read-only
 * region markers.
 */
export function AdminRegionsMap({
  regions,
  onSelectRegion,
}: {
  regions: AdminRegionSummary[];
  onSelectRegion: (region: AdminRegionSummary) => void;
}) {
  const plottable = useMemo(
    () => regions.filter((r): r is AdminRegionSummary & { latitude: number; longitude: number } =>
      r.latitude !== null && r.longitude !== null
    ),
    [regions]
  );
  const maxFarms = useMemo(() => Math.max(1, ...plottable.map((r) => r.farmCount)), [plottable]);

  return (
    <div className="h-[420px] w-full overflow-hidden rounded-xl border border-stone-200">
      <MapContainer center={INDIA_CENTER} zoom={INDIA_ZOOM} className="h-full w-full" scrollWheelZoom>
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {plottable.map((region) => (
          <CircleMarker
            key={`${region.state}-${region.district}`}
            center={[region.latitude, region.longitude]}
            radius={radiusFor(region.farmCount, maxFarms)}
            pathOptions={{ color: '#065f46', fillColor: '#10b981', fillOpacity: 0.55, weight: 1.5 }}
            eventHandlers={{ click: () => onSelectRegion(region) }}
          >
            <Tooltip direction="top" offset={[0, -4]}>
              <div className="text-xs">
                <div className="font-semibold">{region.district}, {region.state}</div>
                <div>{region.farmCount} farm{region.farmCount === 1 ? '' : 's'} · {region.totalAcres} acres</div>
              </div>
            </Tooltip>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}
