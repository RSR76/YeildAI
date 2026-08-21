import type { FarmProfile } from './auth/types';

export const GUEST_DEMO_FARMS: FarmProfile[] = [
  {
    id: 'guest-demo-farm',
    userId: 'guest',
    name: 'Sample Farm (Demo)',

    location: 'Hyderabad, Telangana',
    address: 'Demo village, Hyderabad',

    // Approximate Hyderabad coordinates
    latitude: 17.3850,
    longitude: 78.4867,

    state: 'Telangana',
    district: 'Hyderabad',
    pincode: '500001',

    sizeAcres: 5,
    soilType: 'Black soil',
    crops: ['Onion', 'Tomato'],
    irrigation: 'Drip',

    isDefault: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];