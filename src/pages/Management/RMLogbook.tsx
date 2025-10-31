// src/pages/Management/RMLogbook.tsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Loader,
  AlertCircle,
  X,
  MapPin,
  Users,
  ClipboardList,
} from 'lucide-react';
import {
  getStorageItem,
  setStorageItem,
  STORAGE_KEYS,
} from '../../lib/localStorage';
import {
  MasterBooking,
  Worker,
  ConsoleProfile,
  HardcodedSeason,
  ManagementUser,
  UserPermissions,
  PayoutLogicSettings,
} from '../../types';
import * as bookingHelpers from '../../lib/bookingStoreHelpers';
import {
  getSeasonConfigById,
  defaultPayoutLogicSettings,
} from '../../lib/hardcodedData';
import { ensureEastTerritoryStructureFetched } from '../../lib/dataSyncService';
import ContractorJobs from '../../components/ContractorJobs'; // Re-using this component

type ActiveTab = 'Team' | 'Routes' | 'Bookings';

// --- Team Tab Interfaces ---
interface TeamMember {
  id: string;
  firstName: string;
  lastName: string;
  number: string;
  phone: string;
  steps: number;
  averagePrice: number;
  equivalent: number;
  assignedRoutes: string[];
  cartId?: number | null;
}
interface TeamCart {
  id: number;
  members: TeamMember[];
  steps: number;
  averagePrice: number;
  equivalent: number;
  assignedRoutes: string[];
}

// --- Routes Tab Interfaces ---
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

const RMLogbook: React.FC = () => {
  const { consoleProfileId } = useParams<{ consoleProfileId: string }>();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<ActiveTab>('Team');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // --- Common State ---
  const [consoleProfile, setConsoleProfile] = useState<ConsoleProfile | null>(
    null
  );
  const [activeUser, setActiveUser] = useState<ManagementUser | null>(null);
  const [activeSeason, setActiveSeason] = useState<HardcodedSeason | null>(
    null
  );
  const [allBookings, setAllBookings] = useState<MasterBooking[]>([]); // Bookings for this console/season
  const [allWorkers, setAllWorkers] = useState<Worker[]>([]);
  const [routeAssignments, setRouteAssignments] = useState<
    Record<string, string>
  >({});
  const [rmAssignedRouteKeys, setRmAssignedRouteKeys] = useState<Set<string>>(
    new Set()
  );

  // --- Team Tab State ---
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [teamCarts, setTeamCarts] = useState<TeamCart[]>([]);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  // --- Routes Tab State ---
  const [routes, setRoutes] = useState<Route[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<string | null>(null);

  // --- Bookings Tab State ---
  const [preBookings, setPreBookings] = useState<MasterBooking[]>([]);
  const [selectedBooking, setSelectedBooking] =
    useState<MasterBooking | null>(null);
  const [availableWorkers, setAvailableWorkers] = useState<Worker[]>([]);

  // --- Main Data Loading Function ---
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const numConsoleId = parseInt(consoleProfileId || '0', 10);
      if (isNaN(numConsoleId) || numConsoleId === 0) {
        throw new Error('Invalid Console Profile ID.');
      }

      // 1. Get Logged-in User
      const user = getStorageItem<ManagementUser | null>(
        STORAGE_KEYS.ACTIVE_MANAGEMENT_USER,
        null
      );
      if (!user) throw new Error('No active user found. Please log in.');
      setActiveUser(user);
      const userFullName = user.name.toLowerCase();

      // 2. Get Console Profile
      const profiles = getStorageItem<ConsoleProfile[]>(
        STORAGE_KEYS.CONSOLE_PROFILES,
        []
      );
      const profile = profiles.find((p) => p.id === numConsoleId);
      if (!profile) throw new Error('Console Profile not found.');
      setConsoleProfile(profile);

      // 3. Get Active Season (from global state)
      const activeSeasonId = getStorageItem(
        STORAGE_KEYS.ACTIVE_SEASON_ID,
        null
      );
      const hcSeason = getSeasonConfigById(activeSeasonId);
      if (!hcSeason) throw new Error('Active season not configured.');
      setActiveSeason(hcSeason);

      // 4. Load Data
      const [
        bookings,
        workers,
        territoryStructure,
        mapAssignments,
        routeAssignmentsData,
        allCarts,
      ] = await Promise.all([
        bookingHelpers.getBookingsForConsoleSeason(numConsoleId, hcSeason.id),
        getStorageItem<Worker[]>(STORAGE_KEYS.CONSOLE_WORKERS, []),
        ensureEastTerritoryStructureFetched(), // This is async
        getStorageItem(STORAGE_KEYS.MAP_ASSIGNMENTS, {}),
        getStorageItem(STORAGE_KEYS.ROUTE_ASSIGNMENTS, {}),
        getStorageItem<Cart[]>(STORAGE_KEYS.CONSOLE_CARTS, []),
      ]);
      
      setAllBookings(bookings);
      setAllWorkers(workers);
      setRouteAssignments(routeAssignmentsData);

      // 5. Get RM's Assigned Routes (for Routes & Bookings tabs)
      const assignedKeys = new Set<string>();
      Object.entries(mapAssignments).forEach(([key, assignment]) => {
        const manager = (assignment as any).manager;
        if (manager?.name?.toLowerCase() === userFullName) {
          assignedKeys.add(key);
        }
      });

      const finalRouteSet = new Set<string>();
      assignedKeys.forEach((key) => {
        const groupName = Object.keys(structure).find((g) => structure[g][key]);
        if (groupName) {
          (structure[groupName][key] || []).forEach((route) =>
            finalRouteSet.add(route)
          );
        } else {
          finalRouteSet.add(key);
        }
      });
      setRmAssignedRouteKeys(finalRouteSet);

      // 6. Get Workers for this RM
      const workersForThisRM = workers.filter((w) => {
        return w.routeManager?.name?.toLowerCase() === userFullName;
      });
      setAvailableWorkers(workersForThisRM); // For Bookings tab assignment

      // --- Process Data for TEAM Tab ---
      const today = new Date().toISOString().split('T')[0];
      const isTeam = hcSeason.type === 'Team';
      const payoutLogic =
        profile.seasons.find((s) => s.hardcodedId === hcSeason.id)
          ?.payoutLogic || defaultPayoutLogicSettings;

      if (isTeam) {
        const assignedCarts = allCarts.filter(
          (c) => c.routeManager?.name.toLowerCase() === userFullName
        );
        const cartsData: TeamCart[] = assignedCarts.map((cart) => {
          const membersInCart = workers.filter(
            (w) => w.cartId === cart.id && w.showed && w.showedDate === today
          );
          const memberDetails: TeamMember[] = membersInCart.map((worker) => {
            const { steps, averagePrice, equivalent } = calculateWorkerStats(
              worker.contractorId,
              bookings,
              payoutLogic
            );
            return {
              id: worker.contractorId,
              firstName: worker.firstName,
              lastName: worker.lastName,
              number: worker.contractorId,
              phone: worker.cellPhone || 'N/A',
              steps,
              averagePrice,
              equivalent,
              assignedRoutes: [], // Not relevant for this view
              cartId: worker.cartId,
            };
          });
          const totalSteps = memberDetails.reduce((s, m) => s + m.steps, 0);
          const totalGross = memberDetails.reduce(
            (s, m) => s + m.averagePrice * m.steps,
            0
          );
          const totalEq = memberDetails.reduce((s, m) => s + m.equivalent, 0);
          return {
            id: cart.id,
            members: memberDetails,
            steps: totalSteps,
            averagePrice: totalSteps > 0 ? totalGross / totalSteps : 0,
            equivalent: totalEq,
            assignedRoutes: [],
          };
        });
        setTeamCarts(cartsData.sort((a, b) => a.id - b.id));
        setTeamMembers([]);
      } else {
        const members: TeamMember[] = workers
          .filter(
            (w) =>
              w.routeManager?.name.toLowerCase() === userFullName &&
              w.showed &&
              w.showedDate === today
          )
          .map((worker) => {
            const { steps, averagePrice, equivalent } = calculateWorkerStats(
              worker.contractorId,
              bookings,
              payoutLogic
            );
            return {
              id: worker.contractorId,
              firstName: worker.firstName,
              lastName: worker.lastName,
              number: worker.contractorId,
              phone: worker.cellPhone || 'N/A',
              steps,
              averagePrice,
              equivalent,
              assignedRoutes: [],
              cartId: worker.cartId,
            };
          });
        setTeamMembers(members);
        setTeamCarts([]);
      }

      // --- Process Data for ROUTES Tab ---
      const workersForAssignment: Contractor[] = workersForThisRM.map((w) => ({
        id: w.contractorId,
        firstName: w.firstName,
        lastName: w.lastName,
        assignedRoutes: Object.entries(routeAssignmentsData)
          .filter(([_, workerId]) => workerId === w.contractorId)
          .map(([route]) => route),
      }));
      setContractors(workersForAssignment);

      const relevantBookingsForRoutes = bookings.filter(
        (b) => b['Route Number'] && finalRouteSet.has(b['Route Number'])
      );
      const routesData: Route[] = Array.from(finalRouteSet).map(
        (routeNumber) => {
          const routeBookings = relevantBookingsForRoutes.filter(
            (b) => b['Route Number'] === routeNumber
          );
          const completedBookings = routeBookings.filter(
            (b) => b['Completed'] === 'x'
          );
          const prepaidBookings = routeBookings.filter(
            (b) => b['Prepaid'] === 'x'
          ).length;
          const totalValue = routeBookings.reduce(
            (sum, b) => sum + (parseFloat(b['Price'] || '0') || 0),
            0
          );
          return {
            routeNumber,
            totalBookings: routeBookings.length,
            prepaidBookings,
            totalValue,
            assignedTo: routeAssignmentsData[routeNumber] || null,
            status:
              routeBookings.length > 0 &&
              completedBookings.length === routeBookings.length
                ? 'completed'
                : 'in-progress',
          };
        }
      );
      routesData.sort((a, b) => {
        if (a.assignedTo === null && b.assignedTo !== null) return -1;
        if (a.assignedTo !== null && b.assignedTo === null) return 1;
        return b.totalValue - a.totalValue;
      });
      setRoutes(routesData);

      // --- Process Data for BOOKINGS Tab ---
      const filteredPreBookings = bookings.filter(
        (b) =>
          b.isPrebooked &&
          b['Route Number'] &&
          finalRouteSet.has(b['Route Number'])
      );
      filteredPreBookings.sort((a, b) => {
        const routeCompare = (a['Route Number'] || '').localeCompare(
          b['Route Number'] || ''
        );
        if (routeCompare !== 0) return routeCompare;
        if (a['Completed'] === 'x' && b['Completed'] !== 'x') return 1;
        if (a['Completed'] !== 'x' && b['Completed'] === 'x') return -1;
        return (a['Full Address'] || '').localeCompare(b['Full Address'] || '', undefined, {
          numeric: true,
        });
      });
      setPreBookings(filteredPreBookings);
    } catch (err) {
      console.error('Error loading RM Logbook data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [consoleProfileId]);

  // Effect to load data on mount and when storage changes
  useEffect(() => {
    loadData();
    const handleStorageUpdate = (event: any) => {
      const key = event?.detail?.key;
      // Listen to all relevant keys
      if (
        key === STORAGE_KEYS.ACTIVE_MANAGEMENT_USER ||
        key === STORAGE_KEYS.CONSOLE_PROFILES ||
        key === STORAGE_KEYS.ACTIVE_SEASON_ID ||
        key === STORAGE_KEYS.CONSOLE_WORKERS ||
        key === STORAGE_KEYS.CONSOLE_CARTS ||
        key === STORAGE_KEYS.MAP_ASSIGNMENTS ||
        key === STORAGE_KEYS.ROUTE_ASSIGNMENTS ||
        key?.startsWith('bookings_')
      ) {
        console.log(
          `RMLogbook detected relevant storage update (${key}), reloading data.`
        );
        loadData();
      }
    };
    window.addEventListener('storageUpdated', handleStorageUpdate);
    return () => {
      window.removeEventListener('storageUpdated', handleStorageUpdate);
    };
  }, [loadData]);

  // --- Helper: Calculate Worker Stats ---
  const calculateWorkerStats = (
    workerId: string,
    allBookings: MasterBooking[],
    payoutLogic: PayoutLogicSettings
  ) => {
    const completedBookings = allBookings.filter(
      (b) => b['Completed'] === 'x' && b['Contractor Number'] === workerId
    );
    const steps = completedBookings.length;
    const totalGrossAmount = completedBookings.reduce(
      (sum, b) => sum + (parseFloat(b['Price'] || '0') || 0),
      0
    );
    const totalNetSales = completedBookings.reduce(
      (sum, b) => sum + getNetSalesForBooking(b, payoutLogic),
      0
    );
    const equivalent = totalNetSales > 0 ? totalNetSales / 25 : 0;
    return {
      steps,
      averagePrice: steps > 0 ? totalGrossAmount / steps : 0,
      equivalent,
    };
  };

  const getNetSalesForBooking = (
    booking: MasterBooking,
    logic: PayoutLogicSettings
  ): number => {
    if (booking.isContract) {
      const price = parseFloat(booking.Price || '0') || 0;
      return (price / (1 + logic.taxRate / 100)) * 0.5; // Simple fallback
    }
    const price = parseFloat(booking.Price || '0') || 0;
    let methodKey: string = 'Custom';
    const paymentMethod = (booking['Payment Method'] || '').toLowerCase();
    if (booking.Prepaid === 'x') methodKey = 'Prepaid';
    else if (paymentMethod.includes('cash')) methodKey = 'Cash';
    else if (paymentMethod.includes('cheque')) methodKey = 'Cheque';
    else if (paymentMethod.includes('transfer')) methodKey = 'E-Transfer';
    else if (paymentMethod.includes('credit')) methodKey = 'Credit Card';
    else if (paymentMethod.includes('billed')) methodKey = 'Billed';
    else if (paymentMethod.includes('ios')) methodKey = 'IOS';
    
    const methodSettings = logic.paymentMethodPercentages[methodKey];
    if (!methodSettings) {
      return price / (1 + logic.taxRate / 100);
    }
    let adjustedValue = price * (methodSettings.percentage / 100);
    if (methodSettings.applyTaxes) {
      adjustedValue /= 1 + logic.taxRate / 100;
    }
    return adjustedValue;
  };

  // --- Handlers for Routes Tab ---
  const assignContractorToRoute = (
    routeNumber: string,
    contractorId: string | null
  ) => {
    try {
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

      // This requires loading the correct season's bookings again
      if (!activeSeason) throw new Error('Active season not set.');
      
      // Re-fetch all bookings for the season
      const storageKeyName = getSeasonConfigById(activeSeason.id)?.storageKey;
      if (!storageKeyName || !(storageKeyName in STORAGE_KEYS)) {
        throw new Error('Invalid storage key for season.');
      }
      const allSeasonBookings = getStorageItem<MasterBooking[]>(STORAGE_KEYS[storageKeyName], []);

      const updatedBookings = allSeasonBookings.map((booking: MasterBooking) => {
        if (booking['Route Number'] === routeNumber) {
          return {
            ...booking,
            'Contractor Number': contractorId || undefined,
          };
        }
        return booking;
      });
      setStorageItem(STORAGE_KEYS[storageKeyName], updatedBookings);

      setSelectedRoute(null);
      // Data will reload via storage listener
    } catch (error) {
      console.error('Error assigning contractor:', error);
      setError('Failed to assign contractor');
    }
  };

  const getContractorInitials = (contractorId: string | null): string => {
    if (!contractorId) return '';
    const contractor = contractors.find((c) => c.id === contractorId);
    if (!contractor) return '';
    return `${contractor.firstName[0] || ''}${contractor.lastName[0] || ''}`;
  };

  // --- Handlers for Bookings Tab ---
  const assignContractorToBooking = (workerId: string) => {
    if (!selectedBooking || !activeSeason) return;
    try {
      // Use the helper to update the single booking
      bookingHelpers.updateBooking(activeSeason.id, selectedBooking['Booking ID'], {
        'Contractor Number': workerId || undefined,
      });

      // Also update route assignments
      const routeAssignments = getStorageItem(
        STORAGE_KEYS.ROUTE_ASSIGNMENTS,
        {}
      );
      const routeNumber = selectedBooking['Route Number'];
      if (routeNumber) {
        if (workerId) {
          routeAssignments[routeNumber] = workerId;
        } else {
          delete routeAssignments[routeNumber];
        }
        setStorageItem(STORAGE_KEYS.ROUTE_ASSIGNMENTS, routeAssignments);
      }

      setSelectedBooking(null);
      // Data reloads via listener
    } catch (err) {
      console.error('Error assigning contractor:', err);
      setError(
        err instanceof Error ? err.message : 'Failed to assign contractor'
      );
    }
  };

  const getBookingContractorInitials = (booking: MasterBooking): string => {
    if (!booking['Contractor Number']) return '';
    const worker = allWorkers.find(
      (w) => w.contractorId === booking['Contractor Number']
    );
    if (!worker) return '??';
    return `${worker.firstName[0] || ''}${worker.lastName[0] || ''}`;
  };

  // --- RENDER FUNCTIONS ---

  const renderTeamTab = () => (
    <div className="space-y-2">
      {(activeSeason?.type === 'Team'
        ? teamCarts.length > 0
        : teamMembers.length > 0) ? (
        activeSeason?.type === 'Team' ? (
          teamCarts.map((cart) => (
            <div
              key={cart.id}
              className="bg-gray-800 rounded-lg p-3 hover:bg-gray-700/80 transition-colors w-full"
            >
              <button
                onClick={() => setExpandedItem(expandedItem === `cart-${cart.id}` ? null : `cart-${cart.id}`)}
                className="w-full text-left"
              >
                {/* Cart header */}
                <div className="flex items-center justify-between">
                  <div className="w-1/4">
                    <h3 className="text-sm font-medium text-white">
                      Cart #{cart.id}
                    </h3>
                    <p className="text-xs text-gray-400 truncate">
                      {cart.members.map((m) => m.firstName).join(', ')}
                    </p>
                  </div>
                  <div className="w-1/4 flex flex-col items-end">
                    <span className="text-xs text-gray-400">Steps: <span className="text-sm text-gray-200">{cart.steps}</span></span>
                    <span className="text-xs text-gray-400">Avg: <span className="text-sm text-gray-200">${cart.averagePrice.toFixed(2)}</span></span>
                    <span className="text-xs text-gray-400">EQ: <span className="text-sm text-gray-200">{cart.equivalent.toFixed(2)}</span></span>
                  </div>
                </div>
              </button>
              {expandedItem === `cart-${cart.id}` &&
                cart.members.map((member) => (
                  <ContractorJobs
                    key={member.id}
                    contractorNumber={member.number}
                  />
                ))}
            </div>
          ))
        ) : (
          teamMembers.map((member) => (
            <div
              key={member.id}
              className="bg-gray-800 rounded-lg p-3 hover:bg-gray-700/80 transition-colors w-full"
            >
              <button
                onClick={() => setExpandedItem(expandedItem === member.id ? null : member.id)}
                className="w-full text-left"
              >
                {/* Member header */}
                <div className="flex items-center justify-between">
                  <div className="w-1/4">
                    <h3 className="text-sm font-medium text-white">
                      {member.firstName} {member.lastName}
                    </h3>
                    <p className="text-xs text-gray-400">{member.phone}</p>
                  </div>
                   <div className="w-1/4 flex flex-col items-end">
                    <span className="text-xs text-gray-400">Steps: <span className="text-sm text-gray-200">{member.steps}</span></span>
                    <span className="text-xs text-gray-400">Avg: <span className="text-sm text-gray-200">${member.averagePrice.toFixed(2)}</span></span>
                    <span className="text-xs text-gray-400">EQ: <span className="text-sm text-gray-200">{member.equivalent.toFixed(2)}</span></span>
                  </div>
                </div>
              </button>
              {expandedItem === member.id && (
                <ContractorJobs contractorNumber={member.number} />
              )}
            </div>
          ))
        )
      ) : (
        <div className="text-center text-gray-400 py-12">
          No team members or carts are assigned to you for today.
        </div>
      )}
    </div>
  );

  const renderRoutesTab = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
        {routes.map((route) => (
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
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                  route.assignedTo
                    ? 'bg-cps-blue text-white'
                    : 'bg-gray-700 text-gray-400'
                }`}
                title={
                  route.assignedTo
                    ? `Assigned to ${getContractorInitials(route.assignedTo)}`
                    : 'Unassigned'
                }
              >
                {getContractorInitials(route.assignedTo) || '?'}
              </div>
            </div>
            <div className="flex items-center justify-between text-xs text-gray-400">
              <span>
                PBs: <span className="text-cps-blue">{route.totalBookings}</span>
              </span>
              <span>
                PPs: <span className="text-green-400">{route.prepaidBookings}</span>
              </span>
              <span>
                $: <span className="text-cps-yellow">{route.totalValue.toFixed(0)}</span>
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
      {/* Routes Modal */}
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
              <button
                onClick={() => assignContractorToRoute(selectedRoute, null)}
                className="w-full py-2 px-4 text-left bg-gray-700 text-gray-300 rounded-md hover:bg-gray-600 transition-colors"
              >
                Unassign
              </button>
              {contractors
                .sort((a, b) => a.firstName.localeCompare(b.firstName))
                .map((contractor) => (
                  <button
                    key={contractor.id}
                    onClick={() =>
                      assignContractorToRoute(selectedRoute, contractor.id)
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

  const renderBookingsTab = () => {
    const bookingsByRoute = preBookings.reduce((acc, booking) => {
      const route = booking['Route Number'] || 'Unassigned';
      if (!acc[route]) acc[route] = [];
      acc[route].push(booking);
      return acc;
    }, {} as Record<string, MasterBooking[]>);

    return (
      <div className="space-y-6">
        {Object.entries(bookingsByRoute)
          .sort(([routeA], [routeB]) => routeA.localeCompare(routeB))
          .map(([route, routeBookings]) => (
            <div key={route} className="space-y-1">
              <div className="flex items-baseline gap-2 mb-2">
                <h3 className="text-sm font-medium text-cps-blue">{route}</h3>
                <span className="text-xs text-gray-400">
                  ({routeBookings.length} bookings)
                </span>
              </div>
              {routeBookings.map((booking) => {
                const initials = getBookingContractorInitials(booking);
                const isCompleted = booking['Completed'] === 'x';
                return (
                  <div
                    key={booking['Booking ID']}
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
                          {initials}
                        </div>
                      ) : (
                        <button
                          onClick={() => setSelectedBooking(booking)}
                          className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${
                            initials
                              ? 'bg-cps-blue text-white hover:bg-blue-700'
                              : 'bg-gray-700 text-gray-500 hover:bg-gray-600'
                          }`}
                          title={initials ? `Assigned to ${initials}` : 'Assign'}
                        >
                          {initials || '?'}
                        </button>
                      )}
                      <span
                        className="text-sm text-gray-400 truncate"
                        title={booking['Full Address']}
                      >
                        {booking['Full Address']}
                      </span>
                    </div>
                    {/* (Badges and price, etc.) */}
                  </div>
                );
              })}
            </div>
          ))}
        {preBookings.length === 0 && (
          <div className="text-center text-gray-400 py-12">
            No prebooked jobs found for your assigned routes.
          </div>
        )}
        {/* Bookings Modal */}
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
              </div>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                <button
                  onClick={() => assignContractorToBooking('')}
                  className="w-full py-2 px-4 text-left bg-gray-700 text-gray-300 rounded-md hover:bg-gray-600"
                >
                  Unassign
                </button>
                {availableWorkers.map((worker) => (
                  <button
                    key={worker.contractorId}
                    onClick={() =>
                      assignContractorToBooking(worker.contractorId)
                    }
                    className="w-full py-2 px-4 text-left bg-gray-700 text-gray-300 rounded-md hover:bg-gray-600"
                  >
                    {worker.firstName} {worker.lastName}
                  </button>
                ))}
                {availableWorkers.length === 0 && (
                  <p className="text-center text-gray-500 text-sm py-4">
                    No workers assigned to you today.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // --- Main Return ---
  if (loading) {
    return (
      <div className="flex justify-center items-center h-[60vh]">
        <Loader className="w-8 h-8 text-cps-blue animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/30 text-red-300 p-4 rounded-lg">
        <div className="flex items-center gap-2">
          <AlertCircle size={20} />
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <h2 className="text-2xl font-bold text-white mb-6">RM Logbook</h2>
      {/* Tab Navigation */}
      <div className="flex border-b border-gray-700 mb-6">
        <button
          onClick={() => setActiveTab('Team')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 ${
            activeTab === 'Team'
              ? 'border-cps-blue text-white'
              : 'border-transparent text-gray-400 hover:text-gray-200'
          }`}
        >
          <Users size={16} /> Team
        </button>
        <button
          onClick={() => setActiveTab('Routes')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 ${
            activeTab === 'Routes'
              ? 'border-cps-blue text-white'
              : 'border-transparent text-gray-400 hover:text-gray-200'
          }`}
        >
          <MapPin size={16} /> Routes
        </button>
        <button
          onClick={() => setActiveTab('Bookings')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 ${
            activeTab === 'Bookings'
              ? 'border-cps-blue text-white'
              : 'border-transparent text-gray-400 hover:text-gray-200'
          }`}
        >
          <ClipboardList size={16} /> Bookings
        </button>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'Team' && renderTeamTab()}
        {activeTab === 'Routes' && renderRoutesTab()}
        {activeTab === 'Bookings' && renderBookingsTab()}
      </div>
    </div>
  );
};

export default RMLogbook;