// src/stores/AdminBookingStore.ts
import { MasterBooking, ConsoleProfile } from '../types';
import {
  getStorageItem,
  setStorageItem,
  STORAGE_KEYS,
  getSeasonConfigById, // Import the updated helper from localStorage
} from '../lib/localStorage';
import { HardcodedSeason, REGIONS, getRegionById } from '../lib/hardcodedData'; // Import REGIONS

// Interface remains the same
interface BookingUpdates extends Partial<MasterBooking> {
  Completed?: string;
  Status?: string;
  'Payment Method'?: string;
  'Is Paid'?: boolean;
  'Date Completed'?: string;
}

class AdminBookingStore {
  private static instance: AdminBookingStore;
  // Holds raw data for the currently active season database
  private rawActiveBookings: MasterBooking[] = [];
  // Holds data filtered by territory assignment for the logged-in profile
  private filteredActiveBookings: MasterBooking[] = [];
  private activeStorageKey: string | null = null; // Stores the actual key string, e.g., 'bookings_west_aeration'
  private currentConsoleProfileId: number | null = null;
  private territoryAssignments: Record<string, number[]> = {};

  private constructor() {
    this.loadAssignmentsAndProfile(); // Load assignments and profile info first
    this.syncBasedOnActiveSeason(); // Initial load based on current setting

    // Listen for changes
    window.addEventListener('storageUpdated', (event: any) => {
      const changedKey = event?.detail?.key;
      if (changedKey) {
        let needsResync = false;
        let needsRefilter = false;

        // Check if assignments or logged-in profile changed
        if (
          changedKey === STORAGE_KEYS.TERRITORY_ASSIGNMENTS ||
          changedKey === STORAGE_KEYS.ADMIN ||
          changedKey === STORAGE_KEYS.CONSOLE_PROFILES
        ) {
          console.log(
            `Assignments or profile changed (${changedKey}), reloading assignments and refiltering.`
          );
          this.loadAssignmentsAndProfile();
          needsRefilter = true; // Need to refilter existing data
        }

        // Check if active season or its data changed
        if (
          changedKey === STORAGE_KEYS.ACTIVE_SEASON_ID ||
          changedKey === this.activeStorageKey
        ) {
          console.log(
            `Active season or its data changed (${changedKey}), resyncing AdminBookingStore.`
          );
          needsResync = true; // Need to reload data from storage
        } else if (changedKey.startsWith('bookings_')) {
          // console.log(`Another booking DB (${changedKey}) changed, but not resyncing active store (${this.activeStorageKey})`);
        }

        if (needsResync) {
          this.syncBasedOnActiveSeason(); // This already includes filtering
        } else if (needsRefilter) {
          this.filterBookingsByTerritory(); // Just refilter the existing raw data
          // Dispatch event
          window.dispatchEvent(new Event('bookingStoreRefreshed'));
        }
      }
    });
  }

  public static getInstance(): AdminBookingStore {
    if (!AdminBookingStore.instance) {
      AdminBookingStore.instance = new AdminBookingStore();
    }
    return AdminBookingStore.instance;
  }

  // Load territory assignments and current console profile ID
  private loadAssignmentsAndProfile(): void {
    this.territoryAssignments = getStorageItem(
      STORAGE_KEYS.TERRITORY_ASSIGNMENTS,
      {}
    );

    const adminTitle = getStorageItem(STORAGE_KEYS.ADMIN, null);
    if (adminTitle) {
      const profiles: ConsoleProfile[] = getStorageItem(
        STORAGE_KEYS.CONSOLE_PROFILES,
        []
      );
      const currentProfile = profiles.find((p) => p.title === adminTitle);
      this.currentConsoleProfileId = currentProfile?.id ?? null;
      console.log(
        `AdminBookingStore: Loaded profile ID ${this.currentConsoleProfileId} for ${adminTitle}`
      );
    } else {
      this.currentConsoleProfileId = null; // No admin logged in
      console.log('AdminBookingStore: No admin profile title found.');
    }
  }

  // Filter the raw bookings based on territory assignments
  private filterBookingsByTerritory(): void {
    if (this.currentConsoleProfileId === null) {
      console.log(
        'AdminBookingStore: No console profile ID, showing no bookings.'
      );
      this.filteredActiveBookings = []; // No profile, show no bookings
      return;
    }

    // Find maps assigned to the current profile
    const assignedMaps = new Set<string>();
    for (const map in this.territoryAssignments) {
      if (
        this.territoryAssignments[map]?.includes(this.currentConsoleProfileId)
      ) {
        assignedMaps.add(map);
      }
    }
    console.log(
      `AdminBookingStore: Profile ${this.currentConsoleProfileId} has ${
        assignedMaps.size
      } maps assigned: ${Array.from(assignedMaps).join(', ')}`
    );

    // Filter the raw data
    this.filteredActiveBookings = this.rawActiveBookings.filter((booking) => {
      const map = booking['Master Map'];
      // Keep only bookings whose map is assigned to the current console profile.
      // If the profile has 0 assignments, assignedMaps will be empty, and this filter
      // will correctly result in an empty filteredActiveBookings array.
      return map && assignedMaps.has(map);
    });

    console.log(
      `AdminBookingStore: Filtered ${this.rawActiveBookings.length} raw bookings down to ${this.filteredActiveBookings.length} based on territory assignment.`
    );
  }

  // Method to determine key, load raw data, and apply initial filter
  private syncBasedOnActiveSeason(): void {
    const activeSeasonId = getStorageItem(STORAGE_KEYS.ACTIVE_SEASON_ID, null);
    // <<< REFACTOR: Use getSeasonConfigById from localStorage >>>
    const hcSeason = getSeasonConfigById(activeSeasonId);
    // <<< REFACTOR: Access storageKey directly from hcSeason >>>
    const storageKeyName = hcSeason?.storageKey; // Get key name, e.g., 'BOOKINGS_EAST_AERATION'

    if (storageKeyName && storageKeyName in STORAGE_KEYS) {
      const actualKey = STORAGE_KEYS[storageKeyName]; // Gets the string value, e.g., 'bookings_east_aeration'
      this.activeStorageKey = actualKey;
      try {
        this.rawActiveBookings = getStorageItem(this.activeStorageKey, []); // Load raw data
        console.log(
          `Synced AdminBookingStore with ${this.activeStorageKey}, found ${this.rawActiveBookings.length} raw bookings.`
        );
      } catch (e) {
        console.error(
          `Error loading bookings from ${this.activeStorageKey}:`,
          e
        );
        this.rawActiveBookings = []; // Fallback to empty on error
      }
    } else {
      console.warn(
        `AdminBookingStore: No active/valid season key (ID: ${activeSeasonId} -> KeyName: ${storageKeyName}), loading empty bookings.`
      );
      this.activeStorageKey = null;
      this.rawActiveBookings = [];
    }
    // Apply territory filter after loading raw data
    this.filterBookingsByTerritory();
    // Dispatch refresh event after loading AND filtering
    window.dispatchEvent(new Event('bookingStoreRefreshed'));
  }

  // Save changes back to the raw data in storage
  private saveActiveBookings(): void {
    if (!this.activeStorageKey) {
      console.error('Cannot save bookings: No active storage key set.');
      return;
    }
    // Save the raw (unfiltered by territory) data back to local storage
    setStorageItem(this.activeStorageKey, this.rawActiveBookings);
    console.log(
      `Saved ${this.rawActiveBookings.length} raw bookings to ${this.activeStorageKey}.`
    );
    // After saving, re-apply the territory filter to update the filtered list in memory
    this.filterBookingsByTerritory();
  }

  // --- Methods now use filteredActiveBookings for reads, but modify rawActiveBookings for writes ---

  /** Returns bookings for the active season FILTERED by territory assignment */
  public getAllBookings(): MasterBooking[] {
    // Return the in-memory list filtered by territory
    return this.filteredActiveBookings;
  }

  /** Gets bookings for a contractor WITHIN the active season, FILTERED by territory */
  public getBookingsForContractor(contractorNumber: string): MasterBooking[] {
    if (
      !contractorNumber ||
      typeof contractorNumber !== 'string' ||
      contractorNumber.trim() === ''
    ) {
      return [];
    }
    // Route assignments are global daily for now
    const routeAssignments = getStorageItem(STORAGE_KEYS.ROUTE_ASSIGNMENTS, {});

    // Filter the already territory-filtered list
    return this.filteredActiveBookings.filter((booking) => {
      // Direct assignment check
      if (booking['Contractor Number'] === contractorNumber) return true;

      // Route assignment check (only if contractor isn't directly assigned)
      if (
        booking['Route Number'] &&
        (!booking['Contractor Number'] || booking['Contractor Number'] === '')
      ) {
        return routeAssignments[booking['Route Number']] === contractorNumber;
      }
      return false;
    });
  }

  /** Gets a specific booking by ID WITHIN the active season, respecting territory filter */
  public getBookingById(bookingId: string): MasterBooking | undefined {
    // Find within the filtered list
    return this.filteredActiveBookings.find(
      (booking) => booking['Booking ID'] === bookingId
    );
  }

  /** Updates a specific booking by ID in the RAW data, then refilters */
  public updateBooking(
    bookingId: string,
    updates: Partial<MasterBooking>
  ): void {
    let bookingFound = false;
    // Update the RAW list
    this.rawActiveBookings = this.rawActiveBookings.map((booking) => {
      if (booking['Booking ID'] === bookingId) {
        bookingFound = true;
        // Make sure Price is stored as string
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
      this.saveActiveBookings(); // Saves raw data and refilters internal list
    } else {
      console.warn(
        `Update failed: Booking ID ${bookingId} not found in active database (${this.activeStorageKey})`
      );
    }
  }

  /** Adds a new booking TO the RAW data for the active season, then refilters */
  public addBooking(
    bookingData: Partial<MasterBooking> // Accept Partial<MasterBooking> for flexibility
  ): void {
    if (!this.activeStorageKey) {
      const errorMsg =
        'Cannot add booking: No active booking database selected.';
      console.error(errorMsg);
      alert(errorMsg);
      throw new Error(errorMsg);
    }

    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 9);
    const keyPrefix = this.activeStorageKey.replace('bookings_', '');
    const bookingId = bookingData['Route Number']
      ? `${bookingData['Route Number']}-${keyPrefix}-${timestamp}-${random}` // Include prefix for uniqueness
      : `${keyPrefix}-nobooking-${timestamp}-${random}`;

    const newBooking: MasterBooking = {
      // Ensure all required fields have defaults even if not provided
      'Booking ID': bookingId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      isPrebooked: bookingData.isPrebooked ?? false,
      Completed: bookingData.Completed || '',
      Status: bookingData.Status || 'pending',
      Price: bookingData.Price?.toString() || '0.00', // Default price or ensure string
      'First Name': bookingData['First Name'] || '',
      'Last Name': bookingData['Last Name'] || '',
      'Full Address': bookingData['Full Address'] || '',
      'Master Map': bookingData['Master Map'] || 'Unknown', // Add default
      Group: bookingData['Group'] || 'Unknown', // Add default
      // Include other fields from bookingData, providing defaults if necessary
      ...bookingData,
    };

    // Add to the RAW list
    this.rawActiveBookings.push(newBooking);
    this.saveActiveBookings(); // Saves raw data and refilters internal list
  }

  /** Completes a booking in the RAW data, then refilters */
  public completeBooking(
    bookingId: string,
    paymentMethod: string,
    isPaid: boolean
  ): void {
    this.updateBooking(bookingId, {
      Completed: 'x',
      Status: '', // Clear status when completing
      'Payment Method': paymentMethod,
      'Is Paid': isPaid,
      'Date Completed': new Date().toISOString(),
    }); // updateBooking saves raw and refilters
  }

  /** Cancels a booking in the RAW data, then refilters */
  public cancelBooking(bookingId: string): void {
    this.updateBooking(bookingId, {
      Status: 'cancelled',
      Completed: '', // Ensure not marked completed
      'Date Completed': new Date().toISOString(), // Record cancellation date
    }); // updateBooking saves raw and refilters
  }

  // Method specifically for Business Panel Import/Clear - operates on RAW data
  /** Replaces ALL RAW bookings in a SPECIFIC database, then refilters if it's the active one */
  public replaceAllBookingsForKey(
    bookings: MasterBooking[],
    storageKey: string
  ): void {
    if (
      !storageKey ||
      !Object.values(STORAGE_KEYS).includes(storageKey as any)
    ) {
      // Cast needed
      console.error(
        'Invalid storage key provided for replaceAllBookings:',
        storageKey
      );
      throw new Error(`Invalid storage key: ${storageKey}`);
    }
    // Directly set the storage for the specified key
    setStorageItem(storageKey, bookings);

    // If the replaced key is the currently active one, update the internal RAW state and refilter
    if (storageKey === this.activeStorageKey) {
      this.rawActiveBookings = bookings;
      this.filterBookingsByTerritory(); // Re-apply territory filter
      window.dispatchEvent(new Event('bookingStoreRefreshed'));
    }
    console.log(
      `Replaced all bookings in ${storageKey}. New raw count: ${bookings.length}`
    );
  }
}

// Export a single instance
export const bookingStore = AdminBookingStore.getInstance();
