/**
 * Approximate soil-type and irrigation-method lookup, by Indian state.
 *
 * IMPORTANT: this is NOT authoritative soil-survey data. There is no
 * government soil-survey or irrigation-census API wired into this project.
 * These are broad, commonly-cited regional generalizations (e.g. "much of
 * Maharashtra/Gujarat's Deccan trap region is black cotton soil") used only
 * to pre-fill the add-farm form after a location is picked on the map — the
 * user can and should edit them, since real conditions vary a lot within a
 * state and even within a single district.
 */

export interface SoilIrrigationEstimate {
    soilType: string;
    irrigation: string;
    /** Always true — signals to the UI that this is a rough estimate, not measured data. */
    isEstimate: true;
  }
  
  const STATE_ESTIMATES: Record<string, { soilType: string; irrigation: string }> = {
    Maharashtra: { soilType: 'Black cotton soil', irrigation: 'Rainfed' },
    Gujarat: { soilType: 'Black cotton soil', irrigation: 'Canal + tube well' },
    'Madhya Pradesh': { soilType: 'Black cotton soil', irrigation: 'Rainfed' },
    'Uttar Pradesh': { soilType: 'Alluvial loam', irrigation: 'Canal + tube well' },
    Bihar: { soilType: 'Alluvial loam', irrigation: 'Canal + tube well' },
    Punjab: { soilType: 'Alluvial loam', irrigation: 'Canal + tube well' },
    Haryana: { soilType: 'Alluvial loam', irrigation: 'Canal + tube well' },
    'West Bengal': { soilType: 'Alluvial loam', irrigation: 'Canal + tube well' },
    Assam: { soilType: 'Alluvial loam', irrigation: 'Rainfed' },
    Karnataka: { soilType: 'Red laterite', irrigation: 'Borewell' },
    'Tamil Nadu': { soilType: 'Red laterite', irrigation: 'Borewell' },
    'Andhra Pradesh': { soilType: 'Red laterite', irrigation: 'Canal + tube well' },
    Telangana: { soilType: 'Red laterite', irrigation: 'Borewell' },
    Kerala: { soilType: 'Red laterite', irrigation: 'Rainfed' },
    Odisha: { soilType: 'Red laterite', irrigation: 'Rainfed' },
    Rajasthan: { soilType: 'Sandy loam', irrigation: 'Drip irrigation' },
    Chhattisgarh: { soilType: 'Clay loam', irrigation: 'Rainfed' },
    Jharkhand: { soilType: 'Red laterite', irrigation: 'Rainfed' },
  };
  
  const DEFAULT_ESTIMATE = { soilType: 'Alluvial loam', irrigation: 'Canal + tube well' };
  
  /**
   * Best-effort soil type + irrigation guess for a state (district isn't
   * granular enough for this lookup, so it's currently unused but kept in the
   * signature for when a finer-grained table is available).
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- kept for a future finer-grained (district-level) lookup table
  export function estimateSoilAndIrrigation(state: string, _district?: string): SoilIrrigationEstimate {
    const key = Object.keys(STATE_ESTIMATES).find((s) => s.toLowerCase() === state.trim().toLowerCase());
    const base = key ? STATE_ESTIMATES[key] : DEFAULT_ESTIMATE;
    return { ...base, isEstimate: true };
  }