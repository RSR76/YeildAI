/**
 * Shared map defaults for the Telangana-first product phase. Used by
 * LocationMap's callers (LocationPicker.tsx, AddFarmModal.tsx) so the map
 * opens centered on Telangana instead of a generic India-wide view.
 *
 * This is a *default view*, not a hard boundary: users can still pan/zoom
 * anywhere and drop a pin outside Telangana (a farm may legitimately be
 * elsewhere), which then honestly resolves to "no forecast coverage" via
 * the existing reverse-geocode + supported-locations matching. See
 * docs/MAP_PROVIDER_EVALUATION.md for why a soft default (center/zoom) was
 * chosen over a hard `maxBounds` lockout.
 *
 * Center/zoom are an approximate Telangana bounding-box midpoint
 * (~15.8-19.9°N, ~77.2-81.3°E), precise enough to frame the whole state at
 * this zoom level — not a surveyed centroid.
 */
export const TELANGANA_CENTER: [number, number] = [17.9, 79.2];
export const TELANGANA_ZOOM = 7;

/** The 13 Telangana districts represented in the seeded location dataset
 * (backend/db/migrations/005_seed_states_and_telangana_districts.sql),
 * mirrored here only for UI ordering/labeling — the authoritative supported
 * list always comes from the backend via getLocations(), never this array. */
export const TELANGANA_DISTRICTS = [
  'Adilabad',
  'Bhadradri Kothagudem',
  'Hyderabad',
  'Jagityal',
  'Karimnagar',
  'Khammam',
  'Mahbubnagar',
  'Medak',
  'Nalgonda',
  'Nizamabad',
  'Rajanna Siricilla',
  'Ranga Reddy',
  'Warangal',
] as const;

export const SUPPORTED_STATE = 'Telangana';
