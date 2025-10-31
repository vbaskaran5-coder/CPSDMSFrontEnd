// src/pages/RouteManager/Routes.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader, AlertCircle, X } from 'lucide-react';
import {
  getStorageItem,
  setStorageItem,
  STORAGE_KEYS,
  getSeasonConfigById, // Import helper
} from '../../lib/localStorage';
import {
  ensureEastTerritoryStructureFetched, // Import helper
  createRouteToTerritoryMap, // Import helper
} from '../../lib/dataSyncService';
import { MasterBooking } from '../../types'; // Import MasterBooking type

interface Route {
  routeNumber: string;
  totalBookings: number;
  prepaidBookings: number;
  totalValue: number;
  assignedTo: string | null;
  status: 'in-progress' | 'completed';
}

interface Contractor {
  id: string;
  firstName: string;
  lastName: string;
  assignedRoutes: string[];
}

// Define FullTerritoryStructure locally for this component
interface FullTerritoryStructure {
  [group: string]: {
    [map: string]: string[];
  };
}

const Routes: React.FC = () => {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<string | null>(null);
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
      const routeManagerName = `${routeManager.firstName} ${routeManager.lastName}`;

      if (!routeManagerName.trim()) {
        throw new Error('No route manager found. Please log in again.');
      }

      // 2. Get Route/Map Assignments for this RM (from Admin Console)
      const mapAssignments = getStorageItem(STORAGE_KEYS.MAP_ASSIGNMENTS, {});
      const managerAssignedKeys = new Set<string>();
      Object.entries(mapAssignments).forEach(([key, assignment]) => {
        if (!assignment || typeof assignment !== 'object') return;
        const manager = assignment as { manager?: { name?: string } };
        if (
          manager.manager?.name?.toLowerCase() ===
          routeManagerName.toLowerCase()
        ) {
          managerAssignedKeys.add(key);
        }
      });

      // 3. Fetch Full Territory Structure (to find all routes in assigned maps)
      const structure = await ensureEastTerritoryStructureFetched();
      const allMapsInStructure = new Set<string>();
      Object.values(structure).forEach((maps) =>
        Object.keys(maps).forEach((map) => allMapsInStructure.add(map))
      );

      // 4. Determine Full List of Assigned Routes
      const routeSet = new Set<string>();
      managerAssignedKeys.forEach((key) => {
        if (allMapsInStructure.has(key)) {
          // It's a map, find all its routes
          const groupName = Object.keys(structure).find(
            (g) => structure[g][key]
          );
          if (groupName) {
            const routesInMap = structure[groupName][key] || [];
            routesInMap.forEach((route) => routeSet.add(route));
          }
        } else {
          // It's an individual route
          routeSet.add(key);
        }
      });

      // 5. Load Bookings from the CORRECT Active Season Database
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

      const actualStorageKey = STORAGE_KEYS[hcSeason.storageKey];
      const allBookingsForSeason: MasterBooking[] = getStorageItem(
        actualStorageKey,
        []
      );

      // 6. Filter bookings to only those relevant to this RM's routes
      const relevantBookings = allBookingsForSeason.filter(
        (b) => b['Route Number'] && routeSet.has(b['Route Number'])
      );

      // 7. Calculate Route Data (Iterate over `routeSet` to include routes with 0 bookings)
      const routeAssignments = getStorageItem(
        STORAGE_KEYS.ROUTE_ASSIGNMENTS,
        {}
      );

      const routesData: Route[] = Array.from(routeSet).map((routeNumber) => {
        const routeBookings = relevantBookings.filter(
          (booking) => booking['Route Number'] === routeNumber
        );

        const completedBookings = routeBookings.filter(
          (booking) => booking['Completed'] === 'x'
        );

        const prepaidBookings = routeBookings.filter(
          (booking) => booking['Prepaid'] === 'x'
        ).length;

        const totalValue = routeBookings.reduce(
          (sum: number, booking: MasterBooking) =>
            sum + (parseFloat(booking['Price'] || '59.99') || 59.99),
          0
        );

        const status =
          routeBookings.length > 0 &&
          completedBookings.length === routeBookings.length
            ? 'completed'
            : 'in-progress';

        return {
          routeNumber,
          totalBookings: routeBookings.length,
          prepaidBookings,
          totalValue,
          assignedTo: routeAssignments[routeNumber] || null, // Contractor assignment
          status,
        };
      });

      // Sort routes: unassigned first, then by value
      routesData.sort((a, b) => {
        if (a.assignedTo === null && b.assignedTo !== null) return -1;
        if (a.assignedTo !== null && b.assignedTo === null) return 1;
        return b.totalValue - a.totalValue;
      });

      // 8. Load Contractors available for assignment (This logic remains the same,
      //    assuming RMs can only assign routes to workers *also* assigned to them in the Workerbook)
      const workers = getStorageItem(STORAGE_KEYS.CONSOLE_WORKERS, []);
      const filteredWorkers = workers.filter((worker: any) => {
        if (!worker?.routeManager?.name) return false;
        return (
          worker.routeManager.name.toLowerCase() ===
          routeManagerName.toLowerCase()
        );
      });

      const availableContractors = filteredWorkers.map((worker: any) => {
        const assignedRoutes = Object.entries(routeAssignments)
          .filter(([_, contractorId]) => contractorId === worker.contractorId)
          .map(([route]) => route);

        return {
          id: worker.contractorId,
          firstName: worker.firstName,
          lastName: worker.lastName,
          assignedRoutes,
        };
      });

      setRoutes(routesData);
      setContractors(availableContractors);
    } catch (err) {
      console.error('Error loading data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []); // Use useCallback to stabilize the function

  useEffect(() => {
    loadData();
    // Listen for storage changes that affect this component
    const handleStorageUpdate = (event: any) => {
      const key = event?.detail?.key;
      if (
        key === STORAGE_KEYS.MAP_ASSIGNMENTS || // Admin assigned new map
        key === STORAGE_KEYS.ROUTE_ASSIGNMENTS || // RM assigned route to worker
        key === STORAGE_KEYS.ACTIVE_SEASON_ID || // Admin changed season
        (key && key.startsWith('bookings_')) || // Booking data was updated
        key === STORAGE_KEYS.CONSOLE_WORKERS // Worker assignment changed
      ) {
        loadData();
      }
    };

    window.addEventListener('storageUpdated', handleStorageUpdate);
    // Also listen for bookingStoreRefreshed if Admin console is open
    window.addEventListener('bookingStoreRefreshed', loadData);

    return () => {
      window.removeEventListener('storageUpdated', handleStorageUpdate);
      window.removeEventListener('bookingStoreRefreshed', loadData);
    };
  }, [loadData]); // Depend on the stable loadData function

  // assignContractor function remains the same, but it needs the *correct* booking data
  const assignContractor = (
    routeNumber: string,
    contractorId: string | null
  ) => {
    try {
      // 1. Update Route Assignments (for contractor)
      const savedAssignments = getStorageItem(
        STORAGE_KEYS.ROUTE_ASSIGNMENTS,
        {}
      );
      if (contractorId) {
        savedAssignments[routeNumber] = contractorId;
      } else {
        delete savedAssignments[routeNumber];
      }
      setStorageItem(STORAGE_KEYS.ROUTE_ASSIGNMENTS, savedAssignments);

      // 2. Update the 'Contractor Number' on the bookings themselves
      //    (This requires loading the correct season's bookings again)

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
      const allBookingsForSeason: MasterBooking[] = getStorageItem(
        actualStorageKey,
        []
      );

      const updatedBookings = allBookingsForSeason.map(
        (booking: MasterBooking) => {
          if (booking['Route Number'] === routeNumber) {
            // Assign/Unassign contractor number
            return {
              ...booking,
              'Contractor Number': contractorId || undefined,
            };
          }
          return booking;
        }
      );

      // Save the modified bookings back to the correct season's storage
      setStorageItem(actualStorageKey, updatedBookings);

      setSelectedRoute(null); // Close modal
      // The storage listener will trigger loadData to refresh the UI
    } catch (error) {
      console.error('Error assigning contractor:', error);
      setError('Failed to assign contractor');
    }
  };

  const getContractorInitials = (contractorId: string | null) => {
    if (!contractorId) return '';
    const contractor = contractors.find((c) => c.id === contractorId);
    if (!contractor) return '';
    return `${contractor.firstName[0] || ''}${contractor.lastName[0] || ''}`;
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
        <div className="flex items-center gap-2">
          <AlertCircle size={20} />
          <p>{error}</p>
        </div>
      </div>
    );
  }

  const unassignedRoutes = routes.filter((route) => !route.assignedTo);
  const assignedRoutes = routes.filter((route) => route.assignedTo);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-medium text-white">Routes</h2>
          <span className="text-sm text-gray-400">({routes.length})</span>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
        {unassignedRoutes.map((route) => (
          <div
            key={route.routeNumber}
            onClick={() => setSelectedRoute(route.routeNumber)}
            className="bg-gray-800 p-3 rounded-lg hover:bg-gray-700/80 transition-colors cursor-pointer"
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-white">
                {route.routeNumber}
              </h3>
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium bg-gray-700 text-gray-400"
                title="Unassigned"
              >
                {getContractorInitials(route.assignedTo) || '?'}
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-gray-400">
              <span>
                PBs:{' '}
                <span className="text-cps-blue">{route.totalBookings}</span>
              </span>
              <span>
                PPs:{' '}
                <span className="text-green-400">{route.prepaidBookings}</span>
              </span>
              <span>
                $:{' '}
                <span className="text-cps-yellow">
                  {route.totalValue.toFixed(0)}
                </span>
              </span>
            </div>
          </div>
        ))}

        {assignedRoutes.map((route) => (
          <div
            key={route.routeNumber}
            onClick={() => setSelectedRoute(route.routeNumber)}
            className="bg-gray-800 p-3 rounded-lg hover:bg-gray-700/80 transition-colors cursor-pointer border border-gray-700/50"
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-white">
                {route.routeNumber}
              </h3>
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium bg-cps-blue text-white"
                title={`Assigned to ${getContractorInitials(route.assignedTo)}`}
              >
                {getContractorInitials(route.assignedTo)}
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-gray-400">
              <span>
                PBs:{' '}
                <span className="text-cps-blue">{route.totalBookings}</span>
              </span>
              <span>
                PPs:{' '}
                <span className="text-green-400">{route.prepaidBookings}</span>
              </span>
              <span>
                $:{' '}
                <span className="text-cps-yellow">
                  {route.totalValue.toFixed(0)}
                </span>
              </span>
            </div>
          </div>
        ))}

        {routes.length === 0 && (
          <div className="col-span-full text-center text-gray-400 py-12">
            No routes assigned to your profile.
          </div>
        )}
      </div>

      {selectedRoute && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-4 w-full max-w-sm mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-100">
                Assign Route {selectedRoute}
              </h3>
              <button
                onClick={() => setSelectedRoute(null)}
                className="p-1 hover:bg-gray-700 rounded-full text-gray-400 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600">
              {/* Unassign Button */}
              <button
                onClick={() => assignContractor(selectedRoute, null)}
                className="w-full py-2 px-4 text-left bg-gray-700 text-gray-300 rounded-md hover:bg-gray-600 transition-colors"
              >
                Unassign
              </button>
              {/* Contractor List */}
              {contractors
                .sort((a, b) => {
                  const aHasRoute = a.assignedRoutes.length > 0;
                  const bHasRoute = b.assignedRoutes.length > 0;
                  if (aHasRoute === bHasRoute) {
                    return a.firstName.localeCompare(b.firstName); // Sort alphabetically
                  }
                  return aHasRoute ? 1 : -1; // Sort those without routes first
                })
                .map((contractor) => (
                  <button
                    key={contractor.id}
                    onClick={() =>
                      assignContractor(selectedRoute, contractor.id)
                    }
                    className="w-full py-2 px-4 text-left bg-gray-700 text-gray-300 rounded-md hover:bg-gray-600 transition-colors flex items-center justify-between"
                  >
                    <span>
                      {contractor.firstName} {contractor.lastName}
                    </span>
                    {contractor.assignedRoutes.length > 0 && (
                      <span className="text-xs text-gray-400">
                        ({contractor.assignedRoutes.length} routes)
                      </span>
                    )}
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Routes;
