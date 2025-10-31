// src/lib/bookingStoreHelpers.ts
import {
    MasterBooking,
    Worker,
    ManagementUser,
    UserPermissions,
    Cart,
    ConsoleProfile,
  } from '../types';
  import {
    getStorageItem,
    setStorageItem,
    STORAGE_KEYS,
  } from './localStorage';
  import { getSeasonConfigById } from './hardcodedData';
  
  /**
   * Finds the ConsoleProfile ID associated with a given worker.
   * This is complex and relies on a chain of assignments:
   * Worker -> RM/Cart -> RM User -> ConsolePermissionLink -> ConsoleProfile ID
   */
  function findConsoleProfileIdForWorker(workerId: string): number | null {
    const worker = getStorageItem<Worker[]>(STORAGE_KEYS.CONSOLE_WORKERS, []).find(
      (w) => w.contractorId === workerId
    );
    if (!worker) return null;
  
    let managerName: string | undefined;
  
    if (worker.cartId) {
      const cart = getStorageItem<Cart[]>(STORAGE_KEYS.CONSOLE_CARTS, []).find(
        (c) => c.id === worker.cartId
      );
      managerName = cart?.routeManager?.name;
    } else {
      managerName = worker.routeManager?.name;
    }
  
    if (!managerName) return null;
  
    const rmUser = getStorageItem<ManagementUser[]>(
      STORAGE_KEYS.MANAGEMENT_USERS,
      []
    ).find((u) => u.name === managerName);
    if (!rmUser) return null;
  
    const perms = getStorageItem<UserPermissions[]>(
      STORAGE_KEYS.USER_PERMISSIONS,
      []
    ).find((p) => p.userId === rmUser.userId);
    if (!perms) return null;
  
    // Assumption: The worker's "context" is the *first* console profile
    // they are linked to as an RM.
    const link = perms.consoleProfileLinks.find(
      (l) => l.isRouteManagerForThisConsole
    );
    return link?.consoleProfileId || null;
  }
  
  /**
   * Gets all bookings for a specific worker for the *globally active season*.
   * Used by the Staff Portal (JobContext).
   */
  export const getBookingsForWorker = (workerId: string): MasterBooking[] => {
    const consoleProfileId = findConsoleProfileIdForWorker(workerId);
    if (!consoleProfileId) return [];
  
    const consoleProfile = getStorageItem<ConsoleProfile[]>(
      STORAGE_KEYS.CONSOLE_PROFILES,
      []
    ).find((p) => p.id === consoleProfileId);
    if (!consoleProfile) return [];
  
    const activeSeasonId = getStorageItem(
      STORAGE_KEYS.ACTIVE_SEASON_ID,
      null
    );
    const seasonConfig = getSeasonConfigById(activeSeasonId);
    if (!seasonConfig) return [];
  
    const storageKeyName = seasonConfig.storageKey;
    if (!storageKeyName || !(storageKeyName in STORAGE_KEYS)) return [];
    
    const storageKey = STORAGE_KEYS[storageKeyName];
    const allBookings = getStorageItem<MasterBooking[]>(storageKey, []);
    const routeAssignments = getStorageItem(STORAGE_KEYS.ROUTE_ASSIGNMENTS, {});
  
    return allBookings.filter((booking) => {
      const isDirectlyAssigned = booking['Contractor Number'] === workerId;
      const isRouteAssigned =
        booking['Route Number'] &&
        routeAssignments[booking['Route Number']] === workerId;
      return isDirectlyAssigned || isRouteAssigned;
    });
  };
  
  /**
   * Gets all bookings for a *specific season* attached to a *specific console*.
   * Filters by territory. Used by Management Portal components.
   */
  export const getBookingsForConsoleSeason = (
    consoleProfileId: number,
    seasonHardcodedId: string
  ): MasterBooking[] => {
    const consoleProfile = getStorageItem<ConsoleProfile[]>(
      STORAGE_KEYS.CONSOLE_PROFILES,
      []
    ).find((p) => p.id === consoleProfileId);
    if (!consoleProfile) return [];
  
    const seasonConfig = getSeasonConfigById(seasonHardcodedId);
    if (!seasonConfig) return [];
  
    const storageKeyName = seasonConfig.storageKey;
    if (!storageKeyName || !(storageKeyName in STORAGE_KEYS)) return [];
    
    const storageKey = STORAGE_KEYS[storageKeyName];
    const allBookings = getStorageItem<MasterBooking[]>(storageKey, []);
    
    // Filter by territory
    const territoryAssignments = getStorageItem(
      STORAGE_KEYS.TERRITORY_ASSIGNMENTS,
      {}
    );
    const assignedMaps = new Set<string>();
    for (const map in territoryAssignments) {
      if (territoryAssignments[map]?.includes(consoleProfileId)) {
        assignedMaps.add(map);
      }
    }
  
    return allBookings.filter((booking) => {
      const map = booking['Master Map'];
      return map && assignedMaps.has(map);
    });
  };
  
  /**
   * Helper function to get the storage key for a given season.
   */
  const getStorageKeyForSeason = (
    seasonHardcodedId: string
  ): string | null => {
    const seasonConfig = getSeasonConfigById(seasonHardcodedId);
    if (!seasonConfig) return null;
  
    const storageKeyName = seasonConfig.storageKey;
    if (!storageKeyName || !(storageKeyName in STORAGE_KEYS)) return null;
  
    return STORAGE_KEYS[storageKeyName];
  };
  
  /**
   * Updates a booking in the correct season's database.
   */
  export const updateBooking = (
    seasonHardcodedId: string,
    bookingId: string,
    updates: Partial<MasterBooking>
  ): boolean => {
    const storageKey = getStorageKeyForSeason(seasonHardcodedId);
    if (!storageKey) return false;
  
    const allBookings = getStorageItem<MasterBooking[]>(storageKey, []);
    let bookingFound = false;
  
    const updatedBookings = allBookings.map((booking) => {
      if (booking['Booking ID'] === bookingId) {
        bookingFound = true;
        if (updates.Price && typeof updates.Price === 'number') {
          updates.Price = updates.Price.toFixed(2);
        }
        return {
          ...booking,
          ...updates,
          updated_at: new Date().toISOString(),
        };
      }
      return booking;
    });
  
    if (bookingFound) {
      setStorageItem(storageKey, updatedBookings);
    }
    return bookingFound;
  };
  
  /**
   * Adds a new booking to the correct season's database.
   */
  export const addBooking = (
    seasonHardcodedId: string,
    bookingData: Partial<MasterBooking>
  ): boolean => {
    const storageKey = getStorageKeyForSeason(seasonHardcodedId);
    if (!storageKey) {
      throw new Error(
        `Cannot add booking: No valid storage key found for season ${seasonHardcodedId}.`
      );
    }
  
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 9);
    const keyPrefix = storageKey.replace('bookings_', '');
    const bookingId = bookingData['Route Number']
      ? `${bookingData['Route Number']}-${keyPrefix}-${timestamp}-${random}`
      : `${keyPrefix}-nobooking-${timestamp}-${random}`;
  
    const newBooking: MasterBooking = {
      'Booking ID': bookingId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      isPrebooked: bookingData.isPrebooked ?? false,
      Completed: bookingData.Completed || '',
      Status: bookingData.Status || 'pending',
      Price: bookingData.Price?.toString() || '0.00',
      'First Name': bookingData['First Name'] || '',
      'Last Name': bookingData['Last Name'] || '',
      'Full Address': bookingData['Full Address'] || '',
      'Master Map': bookingData['Master Map'] || 'Unknown',
      Group: bookingData['Group'] || 'Unknown',
      ...bookingData,
    };
  
    const allBookings = getStorageItem<MasterBooking[]>(storageKey, []);
    allBookings.push(newBooking);
    setStorageItem(storageKey, allBookings);
    return true;
  };