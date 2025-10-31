// src/contexts/JobContext.tsx
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
} from 'react';
import { MasterBooking } from '../types';
import * as bookingHelpers from '../lib/bookingStoreHelpers'; // Import the new stateless helpers
import {
  getStorageItem,
  STORAGE_KEYS,
} from '../lib/localStorage';
import { getSeasonConfigById } from '../lib/hardcodedData';

// Filter interface
interface Filter {
  status?: 'pending' | 'completed' | 'contracts' | undefined;
}

interface JobContextType {
  bookings: MasterBooking[]; // Filtered bookings for the current view
  allBookings: MasterBooking[]; // All relevant bookings for the user
  loading: boolean;
  error: string | null;
  addJob: (jobData: Partial<MasterBooking>) => void;
  getJob: (id: string) => MasterBooking | undefined;
  updateJob: (id: string, updates: Partial<MasterBooking>) => void;
  completeJob: (id: string, paymentMethod: string, isPaid: boolean) => void;
  cancelJob: (id: string) => void;
  completedSteps: number;
  filter: Filter;
  setFilter: React.Dispatch<React.SetStateAction<Filter>>;
  syncJobs: () => Promise<void>;
  isAddContractOpen: boolean;
  openAddContract: () => void;
  closeAddContract: () => void;
}

const JobContext = createContext<JobContextType | undefined>(undefined);

export const JobProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>({ status: undefined });
  const [allBookings, setAllBookings] = useState<MasterBooking[]>([]);
  const [isAddContractOpen, setIsAddContractOpen] = useState(false);

  // Get the globally active season ID, which the Staff Portal relies on
  const activeSeasonId = getStorageItem<string | null>(
    STORAGE_KEYS.ACTIVE_SEASON_ID,
    null
  );

  const openAddContract = () => setIsAddContractOpen(true);
  const closeAddContract = () => setIsAddContractOpen(false);

  const loadAndFilterBookings = useCallback(() => {
    setLoading(true);
    setError(null);
    console.log('JobContext: Reloading and filtering bookings for worker...');

    try {
      const activeCart = getStorageItem(STORAGE_KEYS.ACTIVE_CART, null);
      const contractor = getStorageItem(STORAGE_KEYS.CONTRACTOR, null);
      const loggedInWorkerId =
        activeCart?.loggedInWorker.number || contractor?.number;

      let relevantBookings: MasterBooking[] = [];

      if (loggedInWorkerId) {
        // Use the new stateless helper function
        relevantBookings = bookingHelpers.getBookingsForWorker(loggedInWorkerId);
        console.log(
          `JobContext: Filtered down to ${relevantBookings.length} relevant bookings for worker ${loggedInWorkerId}.`
        );
      } else {
        console.log('JobContext: No logged-in worker found.');
      }

      setAllBookings(relevantBookings);
    } catch (err) {
      console.error('Error loading/filtering bookings in JobContext:', err);
      setError(
        `Failed to load bookings: ${
          err instanceof Error ? err.message : 'Unknown error'
        }`
      );
      setAllBookings([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Effect to load initially and listen for store refreshes or auth changes
  useEffect(() => {
    loadAndFilterBookings(); // Initial load

    // Listen for storage changes
    const handleStorageUpdate = (event: any) => {
      const changedKey = event?.detail?.key;
      // If any of these keys change, reload the worker's bookings
      if (
        changedKey === STORAGE_KEYS.CONTRACTOR ||
        changedKey === STORAGE_KEYS.ACTIVE_CART ||
        changedKey === STORAGE_KEYS.ROUTE_ASSIGNMENTS ||
        changedKey === STORAGE_KEYS.ACTIVE_SEASON_ID ||
        changedKey === STORAGE_KEYS.CONSOLE_WORKERS ||
        changedKey === STORAGE_KEYS.MANAGEMENT_USERS ||
        changedKey === STORAGE_KEYS.USER_PERMISSIONS ||
        changedKey === STORAGE_KEYS.CONSOLE_CARTS ||
        changedKey?.startsWith('bookings_')
      ) {
        console.log(
          `JobContext detected relevant storage update (${changedKey}), reloading.`
        );
        loadAndFilterBookings();
      }
    };
    window.addEventListener('storageUpdated', handleStorageUpdate);

    // Cleanup listeners on unmount
    return () => {
      window.removeEventListener('storageUpdated', handleStorageUpdate);
    };
  }, [loadAndFilterBookings]);

  // Filter the `allBookings` based on the UI filter state
  const filteredBookings = useMemo(() => {
    console.log('JobContext: Applying UI filter:', filter);
    return allBookings.filter((booking) => {
      if (filter.status === 'completed' && booking['Completed'] !== 'x')
        return false;
      if (filter.status === 'contracts' && !booking.isContract) return false;
      if (
        filter.status === 'pending' &&
        (booking['Completed'] === 'x' ||
          !!booking['Status'] ||
          booking.isContract)
      )
        return false;
      return true;
    });
  }, [allBookings, filter]);

  const completedSteps = useMemo(
    () => allBookings.filter((booking) => booking['Completed'] === 'x').length,
    [allBookings]
  );

  // --- Store Interaction Methods ---

  const addJob = useCallback(
    (jobData: Partial<MasterBooking>) => {
      setError(null);
      if (!activeSeasonId) {
        const msg = 'Cannot add job: No active season is set.';
        setError(msg);
        console.error(msg);
        alert(msg);
        return;
      }

      const activeCart = getStorageItem(STORAGE_KEYS.ACTIVE_CART, null);
      const contractor = getStorageItem(STORAGE_KEYS.CONTRACTOR, null);
      const loggedInWorkerId =
        activeCart?.loggedInWorker.number || contractor?.number;

      if (!loggedInWorkerId) {
        const msg = 'Cannot add job: No logged-in worker identified.';
        setError(msg);
        console.error(msg);
        alert(msg);
        return;
      }

      let group = 'Unknown';
      let masterMap = 'Unknown';
      if (jobData['Route Number']) {
        const territoryStructure = getStorageItem(
          STORAGE_KEYS.EAST_TERRITORY_STRUCTURE,
          {}
        );
        let found = false;
        for (const grp in territoryStructure) {
          for (const map in territoryStructure[grp]) {
            if (territoryStructure[grp][map].includes(jobData['Route Number'])) {
              group = grp;
              masterMap = map;
              found = true;
              break;
            }
          }
          if (found) break;
        }
      }

      const bookingToAdd: Partial<MasterBooking> = {
        ...jobData,
        'Contractor Number': loggedInWorkerId,
        isPrebooked: false,
        Completed: jobData.Completed || 'x',
        Status: jobData.Status || '',
        'Date Completed': jobData['Date Completed'] || new Date().toISOString(),
        'Is Paid': jobData['Is Paid'] ?? jobData['Payment Method'] !== 'Billed',
        Price: jobData.Price?.toString() || '0.00',
        'First Name': jobData['First Name'] || '',
        'Last Name': jobData['Last Name'] || '',
        'Full Address': jobData['Full Address'] || '',
        Group: group,
        'Master Map': masterMap,
      };

      try {
        // Use the new helper, passing the active season ID
        bookingHelpers.addBooking(activeSeasonId, bookingToAdd);
      } catch (err) {
        const errorMsg = `Failed to add job: ${
          err instanceof Error ? err.message : 'Unknown error'
        }`;
        console.error('Error in JobContext addJob:', err);
        setError(errorMsg);
        alert(errorMsg);
      }
    },
    [activeSeasonId]
  );

  const getJob = useCallback(
    (id: string): MasterBooking | undefined => {
      return allBookings.find((b) => b['Booking ID'] === id);
    },
    [allBookings]
  );

  const updateJob = useCallback(
    (id: string, updates: Partial<MasterBooking>) => {
      setError(null);
      if (!activeSeasonId) {
        setError('Cannot update job: No active season selected.');
        return;
      }
      if (updates.Price && typeof updates.Price === 'number') {
        updates.Price = updates.Price.toFixed(2);
      }
      try {
        bookingHelpers.updateBooking(activeSeasonId, id, updates);
      } catch (err) {
        const errorMsg = `Failed to update job ${id}: ${
          err instanceof Error ? err.message : 'Unknown error'
        }`;
        console.error('Error in JobContext updateJob:', err);
        setError(errorMsg);
      }
    },
    [activeSeasonId]
  );

  const completeJob = useCallback(
    (id: string, paymentMethod: string, isPaid: boolean) => {
      setError(null);
      if (!activeSeasonId) {
        setError('Cannot complete job: No active season selected.');
        return;
      }
      try {
        bookingHelpers.updateBooking(activeSeasonId, id, {
          Completed: 'x',
          Status: '',
          'Payment Method': paymentMethod,
          'Is Paid': isPaid,
          'Date Completed': new Date().toISOString(),
        });
      } catch (err) {
        const errorMsg = `Failed to complete job ${id}: ${
          err instanceof Error ? err.message : 'Unknown error'
        }`;
        console.error('Error in JobContext completeJob:', err);
        setError(errorMsg);
      }
    },
    [activeSeasonId]
  );

  const cancelJob = useCallback(
    (id: string) => {
      setError(null);
      if (!activeSeasonId) {
        setError('Cannot cancel job: No active season selected.');
        return;
      }
      try {
        bookingHelpers.updateBooking(activeSeasonId, id, {
          Status: 'cancelled',
          Completed: '',
          'Date Completed': new Date().toISOString(),
        });
      } catch (err) {
        const errorMsg = `Failed to cancel job ${id}: ${
          err instanceof Error ? err.message : 'Unknown error'
        }`;
        console.error('Error in JobContext cancelJob:', err);
        setError(errorMsg);
      }
    },
    [activeSeasonId]
  );

  const syncJobs = useCallback(async (): Promise<void> => {
    console.log('Manual sync triggered in JobContext...');
    loadAndFilterBookings();
  }, [loadAndFilterBookings]);

  const contextValue = useMemo(
    () => ({
      bookings: filteredBookings,
      allBookings: allBookings,
      loading,
      error,
      addJob,
      getJob,
      updateJob,
      completeJob,
      cancelJob,
      completedSteps,
      filter,
      setFilter,
      syncJobs,
      isAddContractOpen,
      openAddContract,
      closeAddContract,
    }),
    [
      filteredBookings,
      allBookings,
      loading,
      error,
      addJob,
      getJob,
      updateJob,
      completeJob,
      cancelJob,
      completedSteps,
      filter,
      syncJobs,
      isAddContractOpen,
      closeAddContract, // Added missing dependency
    ]
  );

  return (
    <JobContext.Provider value={contextValue}>{children}</JobContext.Provider>
  );
};

export const useJobs = () => {
  const context = useContext(JobContext);
  if (context === undefined) {
    throw new Error('useJobs must be used within a JobProvider');
  }
  return context;
};