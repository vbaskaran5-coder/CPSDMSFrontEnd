// src/pages/RouteManager/Bookings.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader, X } from 'lucide-react';
import {
  getStorageItem,
  setStorageItem,
  STORAGE_KEYS,
  getSeasonConfigById, // Import helper
} from '../../lib/localStorage';
import {
  MasterBooking,
  Worker,
  ConsoleProfile,
  HardcodedSeason,
} from '../../types'; // Import necessary types
import { ensureEastTerritoryStructureFetched } from '../../lib/dataSyncService'; // Import for map-route expansion

const Bookings: React.FC = () => {
  const [bookings, setBookings] = useState<MasterBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<MasterBooking | null>(
    null
  );
  const [availableWorkers, setAvailableWorkers] = useState<Worker[]>([]);
  const navigate = useNavigate();

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // 1. Get Logged-in Route Manager
      const routeManager = getStorageItem(STORAGE_KEYS.ROUTE_MANAGER, {
        firstName: '',
        lastName: '',
      });
      const routeManagerName =
        `${routeManager.firstName} ${routeManager.lastName}`.toLowerCase();
      if (!routeManagerName.trim()) {
        throw new Error('No route manager found. Please log in again.');
      }

      // 2. Find RM's Console Profile
      const routeManagerProfiles = getStorageItem(
        STORAGE_KEYS.ROUTE_MANAGER_PROFILES,
        []
      );
      const rmProfile = routeManagerProfiles.find(
        (p: any) =>
          `${p.firstName} ${p.lastName}`.toLowerCase() === routeManagerName
      );
      if (!rmProfile) {
        throw new Error(
          'Route Manager profile not found or not assigned to a Console Profile.'
        );
      }
      const consoleProfiles: ConsoleProfile[] = getStorageItem(
        STORAGE_KEYS.CONSOLE_PROFILES,
        []
      );
      const consoleProfile = consoleProfiles.find(
        (p) => p.id === rmProfile?.consoleProfileId
      );
      if (!consoleProfile) {
        throw new Error('Associated Console Profile could not be found.');
      }

      // 3. Find Active Season Config
      const activeSeasonId = getStorageItem(
        STORAGE_KEYS.ACTIVE_SEASON_ID,
        null
      );
      const hcSeason = getSeasonConfigById(activeSeasonId);
      if (
        !hcSeason ||
        !hcSeason.storageKey ||
        !(hcSeason.storageKey in STORAGE_KEYS)
      ) {
        throw new Error(
          'Active season is not configured correctly. Please contact admin.'
        );
      }

      // 4. Load Correct Bookings
      const actualStorageKey = STORAGE_KEYS[hcSeason.storageKey];
      const allBookings: MasterBooking[] = getStorageItem(actualStorageKey, []);

      // 5. Get RM's Assigned Maps/Routes
      const mapAssignments = getStorageItem(STORAGE_KEYS.MAP_ASSIGNMENTS, {});
      const managerAssignedKeys = new Set<string>(); // Holds both maps and individual routes
      Object.entries(mapAssignments).forEach(([key, assignment]) => {
        if (!assignment || typeof assignment !== 'object') return;
        const manager = assignment as { manager?: { name?: string } };
        if (manager.manager?.name?.toLowerCase() === routeManagerName) {
          managerAssignedKeys.add(key);
        }
      });

      // 6. Expand maps to include all their routes
      const structure = await ensureEastTerritoryStructureFetched(); // Get territory structure
      const finalAssignedRoutes = new Set<string>();
      managerAssignedKeys.forEach((key) => {
        const groupName = Object.keys(structure).find((g) => structure[g][key]);
        if (groupName) {
          // It's a map key
          const routesInMap = structure[groupName][key] || [];
          routesInMap.forEach((route) => finalAssignedRoutes.add(route));
        } else {
          // It's an individual route key
          finalAssignedRoutes.add(key);
        }
      });

      // 7. Load Available Workers (assigned to this RM in Workerbook)
      const allWorkers: Worker[] = getStorageItem(
        STORAGE_KEYS.CONSOLE_WORKERS,
        []
      );
      const filteredWorkers = allWorkers.filter(
        (worker: Worker) =>
          worker.routeManager?.name?.toLowerCase() === routeManagerName
      );
      setAvailableWorkers(filteredWorkers);

      // 8. Filter Bookings based on expanded route list
      const filteredBookings = allBookings.filter((booking: MasterBooking) => {
        const route = booking['Route Number'];
        const isPrebooked = booking.isPrebooked === true;
        // Check if the booking's route is in the final set of assigned routes
        return route && finalAssignedRoutes.has(route) && isPrebooked;
      });

      // 9. Sort Bookings
      const sortedBookings = [...filteredBookings].sort(
        (a: MasterBooking, b: MasterBooking) => {
          const routeCompare = (a['Route Number'] || '').localeCompare(
            b['Route Number'] || ''
          );
          if (routeCompare !== 0) return routeCompare;

          if (a['Completed'] === 'x' && b['Completed'] !== 'x') return 1;
          if (a['Completed'] !== 'x' && b['Completed'] === 'x') return -1;

          // Add secondary sort by address (e.g., house number)
          const addressA = a['Full Address'] || '';
          const addressB = b['Full Address'] || '';
          return addressA.localeCompare(addressB, undefined, { numeric: true });
        }
      );

      setBookings(sortedBookings);
    } catch (error) {
      console.error('Error loading data:', error);
      setError(error instanceof Error ? error.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []); // Use useCallback

  useEffect(() => {
    loadData();
    // Listen for storage changes
    const handleStorageUpdate = (event: any) => {
      const key = event?.detail?.key;
      if (
        key === STORAGE_KEYS.ROUTE_MANAGER ||
        key === STORAGE_KEYS.ROUTE_MANAGER_PROFILES ||
        key === STORAGE_KEYS.CONSOLE_PROFILES ||
        key === STORAGE_KEYS.ACTIVE_SEASON_ID ||
        key === STORAGE_KEYS.CONSOLE_WORKERS ||
        key === STORAGE_KEYS.MAP_ASSIGNMENTS ||
        key === STORAGE_KEYS.ROUTE_ASSIGNMENTS || // Added this
        (key && key.startsWith('bookings_'))
      ) {
        console.log(
          `Bookings.tsx detected relevant storage update (${key}), reloading data.`
        );
        loadData();
      }
    };

    window.addEventListener('storageUpdated', handleStorageUpdate);
    window.addEventListener('bookingStoreRefreshed', loadData); // Also listen to store

    return () => {
      window.removeEventListener('storageUpdated', handleStorageUpdate);
      window.removeEventListener('bookingStoreRefreshed', loadData);
    };
  }, [loadData]); // Depend on stable loadData

  const getContractorInitials = (booking: MasterBooking): string => {
    if (!booking['Contractor Number']) return '';

    const worker = availableWorkers.find(
      (w) => w.contractorId === booking['Contractor Number']
    );

    if (worker) {
      return `${worker.firstName[0] || ''}${worker.lastName[0] || ''}`;
    }

    // Fallback: Check all workers if not in RM's list (e.g., team worker)
    const allWorkers: Worker[] = getStorageItem(
      STORAGE_KEYS.CONSOLE_WORKERS,
      []
    );
    const anyWorker = allWorkers.find(
      (w) => w.contractorId === booking['Contractor Number']
    );
    if (anyWorker) {
      return `${anyWorker.firstName[0] || ''}${anyWorker.lastName[0] || ''}`;
    }

    return '';
  };

  const getBookingBadges = (booking: MasterBooking) => {
    const badges = [];
    if (booking['Sprinkler'] === 'x')
      badges.push({ text: 'SS', color: 'bg-blue-900/20 text-blue-300' });
    if (booking['Gate'] === 'x')
      badges.push({ text: 'Gate', color: 'bg-yellow-900/20 text-yellow-300' });
    if (booking['Must be home'] === 'x')
      badges.push({ text: 'MBH', color: 'bg-purple-900/20 text-purple-300' });
    if (booking['Call First'] === 'x')
      badges.push({ text: 'CF', color: 'bg-pink-900/20 text-pink-300' });
    if (booking['Second Run'] === 'x')
      badges.push({ text: '2nd', color: 'bg-red-900/20 text-red-300' });
    return badges;
  };

  const handleAssignContractor = (workerId: string) => {
    if (!selectedBooking) return;

    try {
      // 1. Find the correct storage key for the active season
      const activeSeasonId = getStorageItem(
        STORAGE_KEYS.ACTIVE_SEASON_ID,
        null
      );
      const hcSeason = getSeasonConfigById(activeSeasonId);
      if (
        !hcSeason ||
        !hcSeason.storageKey ||
        !(hcSeason.storageKey in STORAGE_KEYS)
      ) {
        throw new Error(
          'Cannot assign contractor: Active season not configured.'
        );
      }
      const actualStorageKey = STORAGE_KEYS[hcSeason.storageKey];

      // 2. Load all bookings from that key
      const allBookings = getStorageItem(actualStorageKey, []);

      // 3. Map and update the specific booking
      const updatedBookings = allBookings.map((booking: MasterBooking) => {
        if (booking['Booking ID'] === selectedBooking['Booking ID']) {
          return {
            ...booking,
            'Contractor Number': workerId || undefined, // Set or remove
          };
        }
        return booking;
      });

      // 4. Save the updated list back to the correct storage key
      setStorageItem(actualStorageKey, updatedBookings);

      // 5. Update route assignments as well
      const routeAssignments = getStorageItem(
        STORAGE_KEYS.ROUTE_ASSIGNMENTS,
        {}
      );
      const routeNumber = selectedBooking['Route Number'];
      if (routeNumber) {
        if (workerId) {
          routeAssignments[routeNumber] = workerId;
        } else {
          delete routeAssignments[routeNumber]; // Unassign
        }
        setStorageItem(STORAGE_KEYS.ROUTE_ASSIGNMENTS, routeAssignments);
      }

      setSelectedBooking(null); // Close modal
      // UI will refresh via the storage listener
    } catch (err) {
      console.error('Error assigning contractor:', err);
      setError(
        err instanceof Error ? err.message : 'Failed to assign contractor'
      );
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[60vh]">
        <Loader className="w-8 h-8 text-cps-blue animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-cps-light-red text-white p-4 rounded-lg">
        <p>{error}</p>
      </div>
    );
  }

  const bookingsByRoute = bookings.reduce((acc, booking) => {
    const route = booking['Route Number'] || 'Unassigned';
    if (!acc[route]) acc[route] = [];
    acc[route].push(booking);
    return acc;
  }, {} as Record<string, MasterBooking[]>);

  return (
    <div className="space-y-6">
      <div className="flex items-baseline gap-2">
        <h2 className="text-lg font-medium text-white">Prebooked Jobs</h2>
        <span className="text-sm text-gray-400">({bookings.length} total)</span>
      </div>

      {Object.entries(bookingsByRoute)
        .sort(([routeA], [routeB]) => routeA.localeCompare(routeB)) // Sort routes alphabetically
        .map(([route, routeBookings]) => (
          <div key={route} className="space-y-1">
            <div className="flex items-baseline gap-2 mb-2">
              <h3 className="text-sm font-medium text-cps-blue">{route}</h3>
              <span className="text-xs text-gray-400">
                ({routeBookings.length} bookings)
              </span>
            </div>

            {routeBookings.map((booking) => {
              const initials = getContractorInitials(booking);
              const price = parseFloat(booking['Price'] || '59.99').toFixed(2);
              const isCompleted = booking['Completed'] === 'x';
              const badges = getBookingBadges(booking);

              return (
                <div
                  key={booking['Booking ID']} // Use Booking ID for a stable key
                  className={`rounded-lg p-2 flex items-center justify-between hover:bg-gray-800 transition-colors border ${
                    isCompleted
                      ? 'border-cps-green bg-green-900/20'
                      : 'border-gray-700/30 bg-gray-800/50'
                  }`}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {isCompleted ? (
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium bg-cps-green text-white"
                        title={`Completed by ${initials}`}
                      >
                        {initials || '?'}
                      </div>
                    ) : (
                      <button
                        onClick={() => setSelectedBooking(booking)}
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${
                          initials
                            ? 'bg-cps-blue text-white hover:bg-blue-700'
                            : 'bg-gray-700 text-gray-500 hover:bg-gray-600'
                        }`}
                        title={
                          initials
                            ? `Assigned to ${initials}`
                            : 'Assign Contractor'
                        }
                      >
                        {initials || '?'}
                      </button>
                    )}

                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span
                        className="text-sm text-gray-400 truncate"
                        title={booking['Full Address']}
                      >
                        {booking['Full Address']}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      {badges.map((badge, i) => (
                        <span
                          key={i}
                          className={`text-[10px] ${badge.color} px-1.5 py-0.5 rounded font-medium`}
                        >
                          {badge.text}
                        </span>
                      ))}

                      {booking['Prepaid'] === 'x' && (
                        <span className="text-[10px] bg-green-900/20 text-green-300 px-1.5 py-0.5 rounded font-medium">
                          PP
                        </span>
                      )}

                      <span className="text-[10px] bg-cps-blue/20 text-blue-300 px-1.5 py-0.5 rounded font-medium">
                        {booking['FO/BO/FP']}
                      </span>
                    </div>

                    <span className="text-sm text-gray-200 font-medium w-16 text-right">
                      ${price}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ))}

      {bookings.length === 0 && !loading && (
        <div className="text-center text-gray-400 py-12">
          No prebooked jobs found for your assigned maps/routes in the active
          season.
        </div>
      )}

      {selectedBooking && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-4 w-full max-w-sm mx-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">
                Assign Contractor
              </h2>
              <button
                onClick={() => setSelectedBooking(null)}
                className="p-1 hover:bg-gray-700 rounded-full text-gray-400 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            <div className="mb-4">
              <p className="text-sm text-gray-400">
                {selectedBooking['Full Address']}
              </p>
              <p className="text-xs text-gray-500">
                Route: {selectedBooking['Route Number']}
              </p>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600">
              <button
                onClick={() => handleAssignContractor('')}
                className="w-full py-2 px-4 text-left bg-gray-700 text-gray-300 rounded-md hover:bg-gray-600 transition-colors"
              >
                Unassign
              </button>
              {availableWorkers.map((worker) => (
                <button
                  key={worker.contractorId}
                  onClick={() => handleAssignContractor(worker.contractorId)}
                  className="w-full py-2 px-4 text-left bg-gray-700 text-gray-300 rounded-md hover:bg-gray-600 transition-colors flex items-center justify-between"
                >
                  <span>
                    {worker.firstName} {worker.lastName}
                  </span>
                  <span className="text-xs bg-cps-blue text-white px-2 py-0.5 rounded">
                    {worker.firstName[0]}
                    {worker.lastName[0]}
                  </span>
                </button>
              ))}
              {availableWorkers.length === 0 && (
                <p className="text-center text-gray-500 text-sm py-4">
                  No workers assigned to you in the Workerbook.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Bookings;
