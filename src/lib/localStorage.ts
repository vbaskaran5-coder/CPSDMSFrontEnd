// src/lib/localStorage.ts
import { HardcodedSeason, REGIONS, getSeasonConfigById } from './hardcodedData'; // Import REGIONS and getSeasonConfigById

// Define STORAGE_KEYS enum/object
export const STORAGE_KEYS = {
  // --- Data Stores ---
  BOOKINGS: 'bookings', // Kept for one-time migration check
  CONSOLE_WORKERS: 'console_workers',
  CONSOLE_CARTS: 'console_carts',
  TERRITORY_ASSIGNMENTS: 'territory_assignments', // For Business Panel
  EAST_TERRITORY_STRUCTURE: 'east_territory_structure', // For caching fetched territory

  // --- Master Booking Databases ---
  BOOKINGS_WEST_AERATION: 'bookings_west_aeration',
  BOOKINGS_WEST_SPRING_REJUV: 'bookings_west_spring_rejuv',
  BOOKINGS_WEST_FALL_REJUV: 'bookings_west_fall_rejuv',
  BOOKINGS_WEST_SERVICE: 'bookings_west_service',
  BOOKINGS_CENTRAL_AERATION: 'bookings_central_aeration',
  BOOKINGS_CENTRAL_CLEANING: 'bookings_central_cleaning',
  // BOOKINGS_CENTRAL_SERVICE: 'bookings_central_service', // Key can be added if needed
  BOOKINGS_EAST_AERATION: 'bookings_east_aeration',
  BOOKINGS_EAST_SEALING: 'bookings_east_sealing',
  // BOOKINGS_EAST_SERVICE: 'bookings_east_service', // Key can be added if needed

  // --- Configuration / Profiles ---
  CONSOLE_PROFILES: 'console_profiles', // List of ConsoleProfile objects (data, not users)
  SERVICES: 'services',
  UPSELL_MENUS: 'upsell_menus',

  // --- NEW Management User System ---
  MANAGEMENT_USERS: 'management_users', // List of all persistent ManagementUser objects
  USER_PERMISSIONS: 'user_permissions', // List of UserPermissions objects (links users to roles)
  ACTIVE_MANAGEMENT_USER: 'active_management_user', // The currently logged-in ManagementUser object

  // --- Staff (Logsheet) Session ---
  CONTRACTOR: 'contractor', // Logged-in individual worker
  ACTIVE_CART: 'active_cart', // Logged-in team/cart worker

  // --- Daily/Operational State ---
  ROUTE_ASSIGNMENTS: 'routeAssignments',
  MAP_ASSIGNMENTS: 'mapAssignments',
  ATTENDANCE_FINALIZED: 'attendanceFinalized', // Stores 'yyyy-MM-dd' or null
  LAST_APP_DATE: 'lastAppDate', // Stores 'yyyy-MM-dd'
} as const; // Use 'as const' for better type inference on keys

// Ensure STORAGE_KEYS values are unique (for safety)
const values = Object.values(STORAGE_KEYS);
const uniqueValues = new Set(values);
if (values.length !== uniqueValues.size) {
  console.error('Duplicate values found in STORAGE_KEYS!');
}

// --- Helper Functions ---

/**
 * Retrieves an item from localStorage and parses it as JSON.
 * Includes robust checks for 'undefined'/'null' strings and parsing errors.
 * @param key The key of the item to retrieve.
 * @param defaultValue The default value to return if the item doesn't exist or parsing fails.
 * @returns The parsed item or the default value.
 */
export const getStorageItem = <T>(key: string, defaultValue: T): T => {
  if (typeof localStorage === 'undefined') {
    console.warn('localStorage is not available.');
    return defaultValue;
  }
  const savedItem = localStorage.getItem(key);
  try {
    // Check for null, undefined explicitly stored as strings, or actual null/undefined
    if (
      savedItem === 'undefined' ||
      savedItem === 'null' ||
      savedItem === null
    ) {
      return defaultValue;
    }
    // Handle potential empty array string from previous logic if needed specifically
    if (key === STORAGE_KEYS.CONSOLE_PROFILES && savedItem === '[]') {
      console.warn(
        `localStorage item "${key}" contained empty array "[]", returning default.`
      );
      return defaultValue;
    }
    return JSON.parse(savedItem);
  } catch (e) {
    console.error(
      `Error parsing localStorage item "${key}":`,
      e,
      ` | Value: ${savedItem}`
    );
    // If parsing fails, it might be a simple string. Check if defaultValue is string.
    if (typeof defaultValue === 'string' && savedItem !== null) {
      // Return the raw string if the default is a string and parsing failed
      return savedItem as unknown as T;
    }
    return defaultValue;
  }
};

/**
 * Saves an item to localStorage after converting it to a JSON string.
 * Dispatches a custom 'storageUpdated' event.
 * Validates the key against STORAGE_KEYS or known dynamic patterns.
 * @param key The key of the item to save. Should generally be from STORAGE_KEYS or follow patterns like 'bookings_*', 'routeAssignments_*', etc.
 * @param value The value to save.
 */
export const setStorageItem = <T>(key: string, value: T): void => {
  // Allow known keys and dynamic keys with specific prefixes, plus known singletons
  const allowedDynamicPrefixes = [
    'bookings_',
    'routeAssignments_',
    'mapAssignments_',
    'attendanceFinalized_',
    'payout_logic_settings',
  ];
  const allowedSingletons = ['lastSynced', 'cps_settings']; // Add any other known non-enum keys

  const isValidKey =
    Object.values(STORAGE_KEYS).includes(key as any) || // Cast needed due to 'as const'
    allowedDynamicPrefixes.some((prefix) => key.startsWith(prefix)) ||
    allowedSingletons.includes(key);

  if (!isValidKey) {
    console.error(
      `Attempted to use invalid or unrecognized storage key: "${key}". Please use keys defined in STORAGE_KEYS or follow established patterns.`
    );
    // Decide whether to throw an error or just warn and prevent saving
    // throw new Error(`Invalid storage key used: "${key}"`);
    return; // Prevent saving with invalid key
  }

  if (typeof localStorage === 'undefined') {
    console.warn('localStorage is not available. Cannot save item.');
    return;
  }
  try {
    // Storing 'undefined' is problematic, remove the item instead
    if (value === undefined) {
      removeStorageItem(key); // Use the remove function which also dispatches event
      return;
    }

    const valueToStore = JSON.stringify(value);
    localStorage.setItem(key, valueToStore);

    // Dispatch a custom event so stores/components can react to changes
    window.dispatchEvent(
      new CustomEvent('storageUpdated', { detail: { key, value } }) // Include value in detail
    );
  } catch (e) {
    console.error(`Error saving localStorage item "${key}":`, e);
    if (
      e instanceof DOMException &&
      (e.name === 'QuotaExceededError' ||
        e.name === 'NS_ERROR_DOM_QUOTA_REACHED')
    ) {
      alert(
        'Error: Local storage is full. Please clear some data or contact support.'
      );
    }
  }
};

/**
 * Removes an item from localStorage.
 * Dispatches a custom 'storageUpdated' event.
 * Validates the key against STORAGE_KEYS or known dynamic patterns.
 * @param key The key of the item to remove. Should generally be from STORAGE_KEYS or follow patterns like 'bookings_*', 'routeAssignments_*', etc.
 */
export const removeStorageItem = (key: string): void => {
  // Allow known keys and dynamic keys with specific prefixes, plus known singletons
  const allowedDynamicPrefixes = [
    'bookings_',
    'routeAssignments_',
    'mapAssignments_',
    'attendanceFinalized_',
    'payout_logic_settings',
  ];
  const allowedSingletons = ['lastSynced', 'cps_settings'];

  const isValidKey =
    Object.values(STORAGE_KEYS).includes(key as any) || // Cast needed
    allowedDynamicPrefixes.some((prefix) => key.startsWith(prefix)) ||
    allowedSingletons.includes(key);

  if (!isValidKey) {
    console.error(
      `Attempted to remove invalid or unrecognized storage key: "${key}". Please use keys defined in STORAGE_KEYS or follow established patterns.`
    );
    // Decide whether to throw an error or just warn and prevent removal
    // throw new Error(`Invalid storage key used for removal: "${key}"`);
    return; // Prevent removing with invalid key
  }

  if (typeof localStorage === 'undefined') {
    console.warn('localStorage is not available. Cannot remove item.');
    return;
  }
  try {
    localStorage.removeItem(key);
    // Dispatch event indicating removal (value is null)
    window.dispatchEvent(
      new CustomEvent('storageUpdated', { detail: { key, value: null } })
    );
  } catch (e) {
    console.error(`Error removing localStorage item "${key}":`, e);
  }
};

// The getSeasonConfigById function remains as it was in the previous file.
export { getSeasonConfigById };