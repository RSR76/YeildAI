'use client';

import { useCallback, useEffect, useState } from 'react';

import { getLocations } from './dataService';
import { resolveEffectiveLocation, resolveFarmLocationStatus, type LocationOverride } from './location';
import type { Location } from './types';
import type { FarmProfile } from './auth/types';

/**
 * Combines the active farm's location with an optional user override (map
 * pin or manual dropdown pick) into the single EffectiveLocation that
 * Recommendations/Mandi Prices fetch data for. The override resets whenever
 * the active farm changes, so switching farms doesn't leave a stale
 * "custom location" pointed at the previous farm's region.
 */
export function useEffectiveLocation(farm: FarmProfile | null) {
    const [locations, setLocations] = useState<Location[] | null>(null);
    const [locationsError, setLocationsError] = useState<string | null>(null);
    const [override, setOverride] = useState<LocationOverride | null>(null);

    useEffect(() => {
        const controller = new AbortController();
        getLocations({ signal: controller.signal })
            .then((data) => {
                if (controller.signal.aborted) return;
                setLocations(data);
            })
            .catch((err) => {
                if (controller.signal.aborted) return;
                setLocationsError(err instanceof Error ? err.message : 'Failed to load supported locations.');
            });
        return () => controller.abort();
    }, []);

    useEffect(() => {
        // Dropping any map/manual override on farm switch is intentional: an
        // override picked for the previous farm's region should never silently
        // carry over and shadow the newly active farm's own location.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setOverride(null);
    }, [farm?.id]);

    const setManualLocation = useCallback((state: string, district: string) => {
        setOverride({ state, district, source: 'manual' });
    }, []);

    const setMapLocation = useCallback((state: string, district: string) => {
        setOverride({ state, district, source: 'map' });
    }, []);

    const resetToFarm = useCallback(() => setOverride(null), []);

    const farmLocationStatus = resolveFarmLocationStatus(farm, locations);
    const effectiveLocation = resolveEffectiveLocation({ farm, override, locations });

    return {
        effectiveLocation,
        farmLocationStatus,
        locations,
        locationsError,
        hasOverride: override !== null,
        setManualLocation,
        setMapLocation,
        resetToFarm,
    };
}
