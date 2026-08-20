// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';

import { YearlyPanel } from '../components/mandi/YearlyPanel';
import { listAvailableYears, getYearlyHistory, compareYears } from '../lib/dataService';
import type { YearComparisonEntry, YearlyHistory } from '../lib/types';

vi.mock('../lib/dataService', () => ({
  listAvailableYears: vi.fn(),
  getYearlyHistory: vi.fn(),
  compareYears: vi.fn(),
}));

const mockedListYears = listAvailableYears as unknown as ReturnType<typeof vi.fn>;
const mockedGetHistory = getYearlyHistory as unknown as ReturnType<typeof vi.fn>;
const mockedCompareYears = compareYears as unknown as ReturnType<typeof vi.fn>;

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const PROPS = { commodity: 'Tomato', state: 'Telangana', district: 'Warangal', market: 'Warangal' };

describe('YearlyPanel', () => {
  it('shows an honest empty state when no years are available, never fabricating one', async () => {
    mockedListYears.mockResolvedValue([]);

    render(<YearlyPanel {...PROPS} />);

    await waitFor(() => expect(screen.getByText(/no stored historical years/i)).toBeTruthy());
    expect(mockedGetHistory).not.toHaveBeenCalled();
  });

  it('renders a year button per available year and loads that year on click', async () => {
    const years: number[] = [2025];
    const history: YearlyHistory = {
      year: 2025,
      records: [
        {
          id: 'r1',
          commodity: 'Tomato',
          state: 'Telangana',
          district: 'Warangal',
          market: 'Warangal',
          date: '2025-06-01',
          modalPrice: 1200,
          minPrice: 1100,
          maxPrice: 1300,
          variety: null,
          grade: null,
          source: 'agmarknet-data-gov-in',
        },
      ],
    };
    const comparison: YearComparisonEntry[] = [
      {
        year: 2025,
        hasData: true,
        recordCount: 1,
        latestRecord: history.records[0]!,
        minModalPrice: 1100,
        maxModalPrice: 1300,
        avgModalPrice: 1200,
      },
      // A requested-but-missing year must render as "No data", never 0.
      { year: 2024, hasData: false, recordCount: 0, latestRecord: null, minModalPrice: null, maxModalPrice: null, avgModalPrice: null },
    ];

    mockedListYears.mockResolvedValue(years);
    mockedGetHistory.mockResolvedValue(history);
    mockedCompareYears.mockResolvedValue(comparison);

    render(<YearlyPanel {...PROPS} />);

    expect(await screen.findByRole('button', { name: '2025' })).toBeTruthy();
    await waitFor(() => expect(mockedGetHistory).toHaveBeenCalledWith('Tomato', 'Telangana', 'Warangal', 'Warangal', 2025, expect.anything()));

    // Comparison table: the missing year shows "No data", not a 0.
    await waitFor(() => expect(screen.getByText('No data')).toBeTruthy());
    expect(screen.queryByText(/^0$/)).toBeNull();
  });

  it('surfaces a load failure as an error instead of silently showing nothing', async () => {
    mockedListYears.mockRejectedValue(new Error('years endpoint unavailable'));

    render(<YearlyPanel {...PROPS} />);

    await waitFor(() => expect(screen.getByText(/years endpoint unavailable/i)).toBeTruthy());
  });
});
