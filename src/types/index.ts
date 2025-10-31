// src/types/index.ts

// --- Hardcoded Data Reference Types ---
export interface HardcodedSeasonRef {
  id: string;
  name: string;
  type: 'Individual' | 'Team' | 'Service';
  hasPayoutLogic: boolean;
  availableUpsellIds: string[];
}

export interface UpsellRef {
  id: string;
  name: string;
}

// --- NEW MANAGEMENT USER & PERMISSIONS ---
// This is the new persistent user for the Management Portal
export interface ManagementUser {
  userId: number; // Unique ID for the user
  name: string; // Full name, e.g., "Vijay Baskaran"
  title: string; // Job title, e.g., "Owner", "Console Manager"
  username: string; // Auto-generated login (e.g., "basvi")
  password?: string; // Login password (will be plain text in localStorage)
}

// This object defines what a user can see and do
// We will store this under a new key, e.g., 'user_permissions'
export interface UserPermissions {
  userId: number; // Links to the ManagementUser
  canAccessAdminPanel: boolean; // Can they see the "Admin Panel" sidebar item?
  // Specific sub-component permissions
  admin: {
    canManageConsoles: boolean;
    canManageUsers: boolean;
    canManageTerritoryAndBookings: boolean;
    canResetApp: boolean;
  };
  // An array of console profiles this user has access to
  consoleProfileLinks: ConsolePermissionLink[];
}

// This links a User to a ConsoleProfile and defines their role *within* that console
export interface ConsolePermissionLink {
  consoleProfileId: number; // Which console (e.g., 1 for "Hamilton Console")
  // Role-based permissions *for this specific console*
  isRouteManagerForThisConsole: boolean; // Can they be assigned as an RM? (Populates dropdowns)
  canAccessRM_Logbook: boolean; // Can they see the "RM Logbook" for this console?
  // Sub-component permissions
  canAccessWorkerBook: boolean;
  canAccessMasterBookings: boolean;
  canAccessMapAssignments: boolean;
  // Add more granular permissions here later if needed
  // e.g., canAccessPayouts, canEditWorkers, etc.
}

// --- UPDATED CONSOLE PROFILE ---
// This is now a data object, not a user.
export interface ConsoleProfile {
  id: number;
  title: string; // e.g., "Hamilton Console"
  region: 'West' | 'Central' | 'East';
  seasons: ConfiguredSeason[];
}

// ConfiguredSeason remains the same, it's linked from ConsoleProfile
export interface ConfiguredSeason {
  hardcodedId: string;
  enabled: boolean;
  enabledUpsellIds: string[];
  payoutLogic?: PayoutLogicSettings;
}

// --- REMOVED RouteManagerProfile ---
// This is no longer needed. A "Route Manager" is now a ManagementUser
// with the 'isRouteManagerForThisConsole' permission.

// --- Payout Logic (Same as before) ---
export interface PayoutLogicSettings {
  taxRate: number;
  productCost?: number;
  baseCommissionRate?: number;
  soloBaseCommissionRate?: number;
  teamBaseCommissionRate?: number;
  applySilverRaises: boolean;
  applyAlumniRaises: boolean;
  paymentMethodPercentages: {
    [key: string]: {
      percentage: number;
      applyTaxes: boolean;
    };
  };
}

// --- Bookings (Same as before) ---
export interface MasterBooking {
  [key: string]: any;
  'Booking ID': string;
  'Route Number'?: string;
  'Contractor Number'?: string;
  'First Name'?: string;
  'Last Name'?: string;
  'Full Address'?: string;
  'Home Phone'?: string;
  'Cell Phone'?: string;
  'Email Address'?: string;
  Price?: string;
  'FO/BO/FP'?: 'FP' | 'FO' | 'BO' | string;
  'Log Sheet Notes'?: string;
  services?: SoldService[];
  Completed?: 'x' | '' | undefined | null;
  'Date Completed'?: string;
  Status?:
    | 'cancelled'
    | 'next_time'
    | 'pending'
    | 'contract'
    | 'redo'
    | 'ref/dnb'
    | string;
  Prepaid?: 'x' | '' | undefined | null;
  'Payment Method'?: string;
  'Is Paid'?: boolean;
  isPrebooked?: boolean;
  isContract?: boolean;
  contractTitle?: string;
  upsellMenuId?: string;
  created_at?: string;
  updated_at?: string;
  'Booked By'?: string;
  'Date/Time Booked'?: string;
  'Master Map'?: string;
  Group?: string;
  Sprinkler?: string;
  Gate?: string;
  'Must be home'?: string;
  'Call First'?: string;
  'Second Run'?: string;
}

export interface SoldService {
  hardcodedId: string;
  name: string;
  optionId?: string;
  optionName?: string;
  price: number;
}

// --- Workers (Same as before, used by Staff Portal & Workerbook) ---
export interface Worker {
  contractorId: string;
  firstName: string;
  lastName: string;
  cellPhone?: string;
  homePhone?: string;
  email?: string;
  address?: string;
  city?: string;
  status: 'Rookie' | 'Alumni' | string;
  daysWorked?: number;
  daysWorkedPreviousYears?: string;
  aerationSilversPreviousYears?: string;
  rejuvSilversPreviousYears?: string;
  sealingSilversPreviousYears?: string;
  cleaningSilversPreviousYears?: string;
  showed?: boolean;
  showedDate?: string;
  bookingStatus?:
    | 'today'
    | 'next_day'
    | 'calendar'
    | 'wdr_tnb'
    | 'quit_fired'
    | 'no_show'
    | string;
  bookedDate?: string;
  subStatus?: 'WDR' | 'TNB' | 'Quit' | 'Fired' | string;
  noShows?: number;
  routeManager?: {
    name: string;
    initials: string;
  };
  cartId?: number | null;
  shuttleLine?: string;
  payoutCompleted?: boolean;
  commission?: number;
  grossSales?: number;
  equivalent?: number;
  deductions?: Deduction[];
  bonuses?: Bonus[];
  payoutHistory?: PayoutRecord[];
}

export interface PayoutRecord {
  date: string;
  grossSales: number;
  equivalent: number;
  commission: number;
  deductions: Deduction[];
  bonuses: Bonus[];
}

export interface Deduction {
  id: number;
  name: string;
  amount: number;
}

export interface Bonus {
  id: number;
  type: string;
  amount: number;
}

export interface Cart {
  id: number;
  routeManager?: {
    name: string;
    initials: string;
  };
}

// --- App Settings (Same as before) ---
export interface AppSettings {
  syncFrequency: number;
  notificationsEnabled: boolean;
  darkMode: boolean;
  defaultView: 'list' | 'map';
}