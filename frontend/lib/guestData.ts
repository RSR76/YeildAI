import type { FarmProfile } from './auth/types';

/**
 * Guest mode has no account and no token, so it can never call
 * `/farms` (user-scoped, requires auth — see FarmController).
 *
 * This fixture provides a demo farm so guests can explore the
 * farm-related pages without creating an account.
 */
export const GUEST_DEMO_FARMS: FarmProfile[] = [
  {
    id: 'guest-demo-farm',
    userId: 'guest',
    name: 'Sample Farm (Demo)',
    location: 'Nashik, Maharashtra',
    address: 'Demo village, Nashik',
    latitude: 19.9975,
    longitude: 73.7898,
    state: 'Maharashtra',
    district: 'Nashik',
    pincode: '422001',
    sizeAcres: 5,
    soilType: 'Black soil',
    crops: ['Onion', 'Tomato'],
    irrigation: 'Drip',
    isDefault: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];