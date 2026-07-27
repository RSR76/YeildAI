// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import { LocationBar } from '../components/location/LocationBar';
import type { EffectiveLocation, FarmLocationStatus, Location } from '../lib/types';

// The real LocationPicker renders a Leaflet map via next/dynamic, which needs
// browser APIs jsdom doesn't provide and is unrelated to what LocationBar
// itself is responsible for (display, overrides, recovery controls).
vi.mock('../components/map/LocationPicker', () => ({
    LocationPicker: () => <div data-testid="location-picker-stub" />,
}));

afterEach(() => {
    cleanup();
});

const SUPPORTED_LOCATIONS: Location[] = [
    { state: 'Uttar Pradesh', district: 'Barabanki' },
    { state: 'Uttar Pradesh', district: 'Lucknow' },
    { state: 'Maharashtra', district: 'Nashik' },
];

type Props = React.ComponentProps<typeof LocationBar>;

function baseProps(overrides: Partial<Props> = {}): Props {
    const effectiveLocation: EffectiveLocation = {
        state: 'Uttar Pradesh',
        district: 'Barabanki',
        source: 'farm',
        isSupported: true,
    };
    return {
        effectiveLocation,
        farmLocationStatus: 'supported' as FarmLocationStatus,
        locations: SUPPORTED_LOCATIONS,
        locationsError: null,
        hasOverride: false,
        hasFarm: true,
        onManualSelect: vi.fn(),
        onMapLocationResolved: vi.fn(),
        onResetToFarm: vi.fn(),
        ...overrides,
    };
}

function byParagraphContaining(text: string) {
    return (_content: string, element: Element | null) =>
        element?.tagName.toLowerCase() === 'p' && !!element.textContent?.includes(text);
}

describe('LocationBar', () => {
    it('displays the district/state and source label from the effectiveLocation prop', () => {
        render(<LocationBar {...baseProps()} />);
        expect(screen.getByText('Barabanki, Uttar Pradesh')).toBeTruthy();
        expect(screen.getByText('Farm location')).toBeTruthy();
    });

    it('shows "Use farm location" only when an override is active and a valid farm exists', () => {
        const { rerender } = render(<LocationBar {...baseProps({ hasOverride: true, hasFarm: true })} />);
        expect(screen.getByText('Use farm location')).toBeTruthy();

        rerender(<LocationBar {...baseProps({ hasOverride: true, hasFarm: false })} />);
        expect(screen.queryByText('Use farm location')).toBeNull();

        rerender(<LocationBar {...baseProps({ hasOverride: false, hasFarm: true })} />);
        expect(screen.queryByText('Use farm location')).toBeNull();
    });

    it('auto-opens the location picker and shows the coverage warning for an unsupported farm location', () => {
        render(
            <LocationBar
                {...baseProps({
                    effectiveLocation: {
                        state: 'Madhya Pradesh',
                        district: 'Nowhereville',
                        source: 'farm',
                        isSupported: false,
                    },
                    farmLocationStatus: 'unsupported',
                })}
            />
        );
        expect(screen.getByText('No forecast coverage')).toBeTruthy();
        expect(screen.getByText(byParagraphContaining("isn't in the forecast dataset yet"))).toBeTruthy();
        // Auto-expanded: the recovery selects are visible without clicking "Change location".
        expect(screen.getByText('State')).toBeTruthy();
        expect(screen.getByText('District')).toBeTruthy();
    });

    it('auto-opens the location picker for a blank/missing farm location with no coverage', () => {
        render(
            <LocationBar
                {...baseProps({
                    effectiveLocation: { state: 'Uttar Pradesh', district: 'Barabanki', source: 'default', isSupported: false },
                    farmLocationStatus: 'missing',
                })}
            />
        );
        expect(screen.getByText('No forecast coverage')).toBeTruthy();
        expect(screen.getByText('State')).toBeTruthy();
        expect(screen.getByText('District')).toBeTruthy();
    });

    it('shows the no-farm hint and recovery selects when there is no farm at all', () => {
        render(
            <LocationBar
                {...baseProps({
                    effectiveLocation: { state: 'Uttar Pradesh', district: 'Barabanki', source: 'default', isSupported: false },
                    farmLocationStatus: 'no-farm',
                    hasFarm: false,
                })}
            />
        );
        expect(
            screen.getByText('No farm selected — showing the default location. Add a farm or pick one below.')
        ).toBeTruthy();
        expect(screen.getByText('State')).toBeTruthy();
    });

    it('calls onResetToFarm when "Use farm location" is clicked', () => {
        const onResetToFarm = vi.fn();
        render(<LocationBar {...baseProps({ hasOverride: true, hasFarm: true, onResetToFarm })} />);
        fireEvent.click(screen.getByText('Use farm location'));
        expect(onResetToFarm).toHaveBeenCalledTimes(1);
    });

    it('never shows the previous location once the effectiveLocation prop changes (e.g. during a loading transition)', () => {
        const { rerender } = render(
            <LocationBar
                {...baseProps({
                    effectiveLocation: { state: 'Uttar Pradesh', district: 'Barabanki', source: 'farm', isSupported: true },
                })}
            />
        );
        expect(screen.getByText('Barabanki, Uttar Pradesh')).toBeTruthy();
        expect(screen.queryByText('No forecast coverage')).toBeNull();

        rerender(
            <LocationBar
                {...baseProps({
                    effectiveLocation: { state: 'Maharashtra', district: 'Nashik', source: 'manual', isSupported: false },
                    farmLocationStatus: 'unsupported',
                    hasOverride: true,
                })}
            />
        );

        expect(screen.queryByText('Barabanki, Uttar Pradesh')).toBeNull();
        expect(screen.getByText('Nashik, Maharashtra')).toBeTruthy();
        expect(screen.getByText('No forecast coverage')).toBeTruthy();
    });
});
