'use client';

import { MapContainer, TileLayer, CircleMarker, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import type { SelectedCoordinates } from '@/lib/types';

/**
 * Pure map interaction only — no reverse-geocoding, no recommendation
 * fetching, no business logic. Coordinates flow out via onSelect; everything
 * else (geocoding, matching, status messaging) lives in LocationPicker.
 *
 * Uses a CircleMarker (SVG, no image asset) for the pin instead of Leaflet's
 * default Marker icon, which avoids the well-known broken-marker-icon issue
 * that comes from bundlers not resolving Leaflet's image assets.
 */

function ClickHandler({ onSelect }: { onSelect: (coords: SelectedCoordinates) => void }) {
  useMapEvents({
    click(e) {
      onSelect({ latitude: e.latlng.lat, longitude: e.latlng.lng });
    },
  });
  return null;
}

export default function LocationMap({
  center,
  zoom,
  selected,
  onSelect,
}: {
  center: [number, number];
  zoom: number;
  selected: SelectedCoordinates | null;
  onSelect: (coords: SelectedCoordinates) => void;
}) {
  return (
    <div className="h-64 w-full overflow-hidden rounded-xl border border-stone-200 sm:h-80">
      <MapContainer center={center} zoom={zoom} scrollWheelZoom style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ClickHandler onSelect={onSelect} />
        {selected && (
          <CircleMarker
            center={[selected.latitude, selected.longitude]}
            radius={9}
            pathOptions={{ color: '#2E6B4E', weight: 2, fillColor: '#2E6B4E', fillOpacity: 0.6 }}
          />
        )}
      </MapContainer>
    </div>
  );
}
