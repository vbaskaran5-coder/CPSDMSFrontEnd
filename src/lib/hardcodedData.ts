// src/lib/hardcodedData.ts

import { PayoutLogicSettings, STORAGE_KEYS } from '../types'; // Import STORAGE_KEYS type

// Define Base Services (sold at the door)
export interface BaseServiceOption {
  id: string; // e.g., 'aeration-fp', 'aeration-fo'
  name: string; // e.g., 'Full Property', 'Front Only'
  defaultPrice?: number; // Optional default price override
}

export interface BaseService {
  id: string; // e.g., 'aeration', 'dethatching'
  name: string; // e.g., 'Aeration', 'De-Thatching'
  options?: BaseServiceOption[]; // Options like FP, FO, BO for Aeration
  defaultPrice?: number; // Default price if no options
  allowMultiple?: boolean; // Can multiple instances be added (like Rejuv components)?
}

// Define Upsells (sold as contracts)
export interface UpsellRef {
  // Renamed from Upsell for clarity as it's a reference
  id: string; // e.g., 'star-plan-pro', 'window-cleaning'
  name: string; // e.g., 'Star Plan Pro', 'Window Cleaning'
  // More details might be added later based on specific upsell needs
}

// Define Season Structure
export interface HardcodedSeason {
  id: string; // e.g., 'west-aeration', 'east-sealing'
  name: string; // e.g., 'Aeration', 'Summer Sealing'
  type: 'Individual' | 'Team' | 'Service'; // Simplified types
  storageKey: keyof typeof STORAGE_KEYS; // <<< ADDED THIS
  doorServices: BaseService[]; // Services sold directly on logsheet (New Client)
  availableUpsellIds: string[]; // IDs of upsells possible for this season
  hasPayoutLogic: boolean; // Does this season type need editable payout logic?
}

// Define Region Structure
export interface Region {
  id: 'West' | 'Central' | 'East';
  name: string;
  seasons: HardcodedSeason[];
}

// --- Hardcoded Data Definitions ---

// Base Services
const aerationService: BaseService = {
  id: 'aeration',
  name: 'Aeration',
  options: [
    { id: 'aeration-fp', name: 'Full Property', defaultPrice: 59.99 },
    { id: 'aeration-fo', name: 'Front Only', defaultPrice: 59.99 },
    { id: 'aeration-bo', name: 'Back Only', defaultPrice: 59.99 },
  ],
};
const dethatchingService: BaseService = {
  id: 'dethatching',
  name: 'De-Thatching',
  defaultPrice: 150,
  allowMultiple: true,
};
const overseedingService: BaseService = {
  id: 'overseeding',
  name: 'Over-Seeding',
  defaultPrice: 100,
  allowMultiple: true,
};
const fertilizationService: BaseService = {
  id: 'fertilization',
  name: 'Fertilization',
  defaultPrice: 80,
  allowMultiple: true,
};
const limeTreatmentService: BaseService = {
  id: 'lime',
  name: 'Lime Treatment',
  defaultPrice: 70,
  allowMultiple: true,
};
const windowCleaningService: BaseService = {
  id: 'window-cleaning',
  name: 'Window Cleaning',
  defaultPrice: 199.99,
};
const windowCleaningPlusService: BaseService = {
  id: 'window-cleaning-plus',
  name: 'Window Cleaning Plus',
  defaultPrice: 299.99,
};
const sealStarService: BaseService = {
  id: 'sealstar',
  name: 'SealStar',
  defaultPrice: 249.99,
};
const sealStarPlusService: BaseService = {
  id: 'sealstar-plus',
  name: 'SealStar+',
  defaultPrice: 349.99,
};
const rampService: BaseService = {
  id: 'ramp',
  name: 'Ramp',
  defaultPrice: 99.99,
};

// Upsells (Basic definition, details TBD)
const upsells: UpsellRef[] = [
  { id: 'star-plan-pro', name: 'Star Plan Pro' },
  { id: 'lawn-rejuvenation', name: 'Lawn Rejuvenation' },
  { id: 'grub-control', name: 'Grub Control' },
  { id: 'star-plan-after-care', name: 'Star Plan After Care' },
  { id: 'window-cleaning', name: 'Window Cleaning Upsell' }, // Renamed slightly to differentiate
  { id: 'window-cleaning-plus', name: 'Window Cleaning Plus Upsell' }, // Renamed slightly
  { id: 'driveway-sealing', name: 'Driveway Sealing' },
  { id: 'hot-asphalt-ramp', name: 'Hot Asphalt Ramp' },
];

export const ALL_UPSELLS: ReadonlyArray<UpsellRef> = upsells;

// Regions and their Seasons
const regions: Region[] = [
  {
    id: 'West',
    name: 'West (BC)',
    seasons: [
      {
        id: 'west-aeration',
        name: 'Aeration',
        type: 'Individual',
        storageKey: 'BOOKINGS_WEST_AERATION', // <<< UPDATED
        doorServices: [aerationService],
        availableUpsellIds: [
          'star-plan-pro',
          'lawn-rejuvenation',
          'grub-control',
        ],
        hasPayoutLogic: true,
      },
      {
        id: 'west-spring-rejuv',
        name: 'Spring Rejuv',
        type: 'Team',
        storageKey: 'BOOKINGS_WEST_SPRING_REJUV', // <<< UPDATED
        doorServices: [
          aerationService,
          dethatchingService,
          overseedingService,
          fertilizationService,
          limeTreatmentService,
        ],
        availableUpsellIds: ['star-plan-after-care', 'grub-control'],
        hasPayoutLogic: true,
      },
      {
        id: 'west-fall-rejuv',
        name: 'Fall Rejuv',
        type: 'Team',
        storageKey: 'BOOKINGS_WEST_FALL_REJUV', // <<< UPDATED
        doorServices: [
          aerationService,
          dethatchingService,
          overseedingService,
          fertilizationService,
          limeTreatmentService,
        ],
        availableUpsellIds: [],
        hasPayoutLogic: true,
      },
      {
        id: 'west-service',
        name: 'Service',
        type: 'Service',
        storageKey: 'BOOKINGS_WEST_SERVICE', // <<< UPDATED
        doorServices: [],
        availableUpsellIds: [],
        hasPayoutLogic: false,
      },
    ],
  },
  {
    id: 'Central',
    name: 'Central (AB/SK)',
    seasons: [
      {
        id: 'central-aeration',
        name: 'Aeration',
        type: 'Individual',
        storageKey: 'BOOKINGS_CENTRAL_AERATION', // <<< UPDATED
        doorServices: [aerationService],
        availableUpsellIds: ['window-cleaning', 'window-cleaning-plus'],
        hasPayoutLogic: true,
      },
      {
        id: 'central-cleaning',
        name: 'Summer Cleaning',
        type: 'Team',
        storageKey: 'BOOKINGS_CENTRAL_CLEANING', // <<< UPDATED
        doorServices: [windowCleaningService, windowCleaningPlusService], // Options between these
        availableUpsellIds: ['window-cleaning', 'window-cleaning-plus'],
        hasPayoutLogic: true,
      },
      // Note: Central Service is omitted as it maps to null storage key (could add if needed)
      // {
      //   id: 'central-service',
      //   name: 'Service',
      //   type: 'Service',
      //   storageKey: 'BOOKINGS_CENTRAL_SERVICE', // Requires adding this key to STORAGE_KEYS in types
      //   doorServices: [],
      //   availableUpsellIds: [],
      //   hasPayoutLogic: false,
      // },
    ],
  },
  {
    id: 'East',
    name: 'East (ON)',
    seasons: [
      {
        id: 'east-aeration',
        name: 'Aeration',
        type: 'Individual',
        storageKey: 'BOOKINGS_EAST_AERATION', // <<< UPDATED
        doorServices: [aerationService],
        availableUpsellIds: ['driveway-sealing', 'hot-asphalt-ramp'],
        hasPayoutLogic: true,
      },
      {
        id: 'east-sealing',
        name: 'Summer Sealing',
        type: 'Team',
        storageKey: 'BOOKINGS_EAST_SEALING', // <<< UPDATED
        doorServices: [sealStarService, sealStarPlusService, rampService], // Options between these
        availableUpsellIds: ['driveway-sealing', 'hot-asphalt-ramp'],
        hasPayoutLogic: true,
      },
      // Note: East Service is omitted as it maps to null storage key (could add if needed)
      // {
      //   id: 'east-service',
      //   name: 'Service',
      //   type: 'Service',
      //   storageKey: 'BOOKINGS_EAST_SERVICE', // Requires adding this key to STORAGE_KEYS in types
      //   doorServices: [],
      //   availableUpsellIds: [],
      //   hasPayoutLogic: false,
      // },
    ],
  },
];

export const REGIONS: ReadonlyArray<Region> = regions;

// Helper function to get region data by ID
export const getRegionById = (
  regionId: 'West' | 'Central' | 'East' | undefined
): Region | undefined => {
  return REGIONS.find((r) => r.id === regionId);
};

// Helper function to get a specific season's HARDCODED config by its ID (e.g., 'east-aeration')
// Renamed from getHardcodedSeasonById for clarity
export const getSeasonConfigById = (
  seasonHardcodedId: string | null | undefined
): HardcodedSeason | undefined => {
  if (!seasonHardcodedId) return undefined;
  for (const region of REGIONS) {
    const season = region.seasons.find((s) => s.id === seasonHardcodedId);
    if (season) return season;
  }
  return undefined;
};

// Default Payout Logic
export const defaultPayoutLogicSettings: PayoutLogicSettings = {
  taxRate: 13,
  productCost: 0, // Default to 0, overridden by season type if needed
  baseCommissionRate: 8.0, // Default for Individual
  soloBaseCommissionRate: 6.0, // Default for Team (Solo)
  teamBaseCommissionRate: 8.0, // Default for Team (Multi)
  applySilverRaises: true,
  applyAlumniRaises: true,
  paymentMethodPercentages: {
    Cash: { percentage: 100, applyTaxes: true },
    Cheque: { percentage: 100, applyTaxes: true },
    'E-Transfer': { percentage: 100, applyTaxes: true },
    'Credit Card': { percentage: 100, applyTaxes: true },
    Prepaid: { percentage: 50, applyTaxes: true }, // Count 50% towards net
    Billed: { percentage: 50, applyTaxes: true }, // Count 50% towards net
    IOS: { percentage: 50, applyTaxes: true }, // Count 50% towards net for contracts
    Custom: { percentage: 100, applyTaxes: true }, // Assume custom split needs full calc by default
  },
};
