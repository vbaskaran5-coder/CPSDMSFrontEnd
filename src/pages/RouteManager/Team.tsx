// src/pages/RouteManager/Team.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { AlertCircle, ChevronDown, ChevronUp, Loader } from 'lucide-react';
import ContractorJobs from '../../components/ContractorJobs';
import {
  getStorageItem,
  setStorageItem,
  STORAGE_KEYS,
  getSeasonConfigById, // Import the helper
} from '../../lib/localStorage';
import {
  ConsoleProfile,
  Worker,
  Cart,
  MasterBooking, // Import MasterBooking
  HardcodedSeason,
  PayoutLogicSettings, // Import PayoutLogicSettings
} from '../../types';
import { defaultPayoutLogicSettings } from '../../lib/hardcodedData'; // Import default settings

interface TeamMember {
  id: string;
  firstName: string;
  lastName: string;
  number: string;
  phone: string;
  steps: number;
  averagePrice: number;
  gasSteps: number; // This field seems unused in calc, but kept for type structure
  equivalent: number;
  assignedRoutes: string[];
  cartId?: number | null;
}

interface TeamCart {
  id: number;
  members: TeamMember[];
  steps: number;
  averagePrice: number;
  gasSteps: number; // This field seems unused in calc, but kept for type structure
  equivalent: number;
  assignedRoutes: string[];
}

const Team: React.FC = () => {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [teamCarts, setTeamCarts] = useState<TeamCart[]>([]);
  const [isTeamSeason, setIsTeamSeason] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  const loadTeamData = useCallback(() => {
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
      const hcSeason = getSeasonConfigById(activeSeasonId); // Get hardcoded config
      if (
        !hcSeason ||
        !hcSeason.storageKey ||
        !(hcSeason.storageKey in STORAGE_KEYS)
      ) {
        throw new Error(
          'Active season is not configured correctly. Please contact admin.'
        );
      }

      // <<< NEW: Get Configured Season and Payout Logic >>>
      const configuredSeason = consoleProfile.seasons.find(
        (cs) => cs.hardcodedId === activeSeasonId && cs.enabled
      );
      if (!configuredSeason) {
        throw new Error('Could not find enabled configured season in profile.');
      }
      // Get the specific payout logic for this profile/season, or fall back to defaults
      const payoutLogic =
        configuredSeason.payoutLogic || defaultPayoutLogicSettings;
      // <<< END NEW >>>

      const isTeam = hcSeason.type === 'Team';
      setIsTeamSeason(isTeam);

      // 4. Load Correct Bookings
      const actualStorageKey = STORAGE_KEYS[hcSeason.storageKey];
      const allBookings: MasterBooking[] = getStorageItem(actualStorageKey, []);

      // 5. Load Workers and Assignments
      const allWorkers: Worker[] = getStorageItem(
        STORAGE_KEYS.CONSOLE_WORKERS,
        []
      );
      const routeAssignments = getStorageItem(
        STORAGE_KEYS.ROUTE_ASSIGNMENTS,
        {}
      );

      // <<< NEW: Helper function to calculate Net Sales based on Payout Logic >>>
      const getNetSalesForBooking = (
        booking: MasterBooking,
        logic: PayoutLogicSettings
      ): number => {
        // Note: This simplifies contract EQ. For a summary, it assumes non-contract logic.
        // A full implementation would need to load Upsell Menu configs.
        if (booking.isContract) {
          // Simple fallback for contracts: 50% net after tax (like Billed/IOS)
          const price = parseFloat(booking.Price || '0') || 0;
          return (price / (1 + logic.taxRate / 100)) * 0.5;
        }

        const price = parseFloat(booking.Price || '0') || 0;
        let methodKey: string = 'Custom'; // Default fallback
        const paymentMethod = (booking['Payment Method'] || '').toLowerCase();

        if (booking.Prepaid === 'x') methodKey = 'Prepaid';
        else if (paymentMethod.includes('cash')) methodKey = 'Cash';
        else if (paymentMethod.includes('cheque')) methodKey = 'Cheque';
        else if (paymentMethod.includes('transfer')) methodKey = 'E-Transfer';
        else if (paymentMethod.includes('credit')) methodKey = 'Credit Card';
        else if (paymentMethod.includes('billed')) methodKey = 'Billed';
        else if (paymentMethod.includes('ios')) methodKey = 'IOS';
        else if (paymentMethod.includes(': $')) methodKey = 'Custom';

        const methodSettings = logic.paymentMethodPercentages[methodKey];

        if (!methodSettings) {
          console.warn(
            `Team.tsx: Payout settings not found for method: ${methodKey}. Using default (100% net, tax applied).`
          );
          return price / (1 + logic.taxRate / 100);
        }

        let adjustedValue = price * (methodSettings.percentage / 100);
        if (methodSettings.applyTaxes) {
          adjustedValue /= 1 + logic.taxRate / 100;
        }
        return adjustedValue;
      };
      // <<< END NEW HELPER >>>

      // 6. Process Stats
      if (isTeam) {
        // --- Team Season Logic (e.g., Sealing) ---
        const allCarts: Cart[] = getStorageItem(STORAGE_KEYS.CONSOLE_CARTS, []);
        const assignedCarts = allCarts.filter(
          (c) => c.routeManager?.name.toLowerCase() === routeManagerName
        );

        const cartsData: TeamCart[] = assignedCarts.map((cart) => {
          const membersInCart = allWorkers.filter((w) => w.cartId === cart.id);

          const memberDetails: TeamMember[] = membersInCart.map((worker) => {
            const assignedRoutes = Object.entries(routeAssignments)
              .filter(
                ([_, contractorId]) => contractorId === worker.contractorId
              )
              .map(([route]) => route);

            const completedBookings = allBookings.filter(
              (booking) =>
                booking['Completed'] === 'x' &&
                booking['Contractor Number'] === worker.contractorId
            );

            const steps = completedBookings.length;
            const totalGrossAmount = completedBookings.reduce(
              // Use Gross for Avg Price
              (sum: number, booking: MasterBooking) =>
                sum + (parseFloat(booking['Price'] || '0') || 0),
              0
            );

            // <<< REFACTORED EQ CALCULATION >>>
            let totalNetSales = completedBookings.reduce(
              (sum: number, booking: MasterBooking) =>
                sum + getNetSalesForBooking(booking, payoutLogic),
              0
            );
            // Apply product cost reduction for Team seasons
            totalNetSales *= 1 - (payoutLogic.productCost || 0) / 100;

            const equivalent = totalNetSales > 0 ? totalNetSales / 25 : 0;
            // <<< END REFACTOR >>>

            return {
              id: worker.contractorId,
              firstName: worker.firstName,
              lastName: worker.lastName,
              number: worker.contractorId,
              phone: worker.cellPhone || worker.homePhone || 'No phone number',
              steps,
              averagePrice: steps > 0 ? totalGrossAmount / steps : 0, // Use Gross
              gasSteps: 0,
              equivalent, // Use new correct equivalent
              assignedRoutes,
              cartId: worker.cartId,
            };
          });

          const totalSteps = memberDetails.reduce((sum, m) => sum + m.steps, 0);
          const totalGrossAmount = memberDetails.reduce(
            (sum, m) => sum + m.averagePrice * m.steps, // This is correct (Avg * Steps)
            0
          );
          // Sum the already calculated correct equivalents
          const totalEquivalent = memberDetails.reduce(
            (sum, m) => sum + m.equivalent,
            0
          );

          return {
            id: cart.id,
            members: memberDetails,
            steps: totalSteps,
            averagePrice: totalSteps > 0 ? totalGrossAmount / totalSteps : 0,
            gasSteps: memberDetails.reduce((sum, m) => sum + m.gasSteps, 0),
            equivalent: totalEquivalent, // Use summed correct equivalent
            assignedRoutes: [
              ...new Set(memberDetails.flatMap((m) => m.assignedRoutes)),
            ],
          };
        });

        setTeamCarts(cartsData.sort((a, b) => a.id - b.id));
        setTeamMembers([]);
      } else {
        // --- Individual Season Logic (e.g., Aeration) ---
        const members: TeamMember[] = allWorkers
          .filter(
            (worker) =>
              worker.routeManager?.name.toLowerCase() === routeManagerName
          )
          .map((worker) => {
            const assignedRoutes = Object.entries(routeAssignments)
              .filter(
                ([_, contractorId]) => contractorId === worker.contractorId
              )
              .map(([route]) => route);

            const completedBookings = allBookings.filter(
              (booking) =>
                booking['Completed'] === 'x' &&
                booking['Contractor Number'] === worker.contractorId
            );

            const steps = completedBookings.length;
            const totalGrossAmount = completedBookings.reduce(
              (sum: number, booking: MasterBooking) =>
                sum + (parseFloat(booking['Price'] || '0') || 0),
              0
            );

            // <<< REFACTORED EQ CALCULATION >>>
            const totalNetSales = completedBookings.reduce(
              (sum: number, booking: MasterBooking) =>
                sum + getNetSalesForBooking(booking, payoutLogic),
              0
            );
            // No product cost for individual season (handled in helper if needed)
            const equivalent = totalNetSales > 0 ? totalNetSales / 25 : 0;
            // <<< END REFACTOR >>>

            return {
              id: worker.contractorId,
              firstName: worker.firstName,
              lastName: worker.lastName,
              number: worker.contractorId,
              phone: worker.cellPhone || worker.homePhone || 'No phone number',
              steps,
              averagePrice: steps > 0 ? totalGrossAmount / steps : 0, // Use Gross
              gasSteps: 0,
              equivalent, // Use new correct equivalent
              assignedRoutes,
              cartId: worker.cartId,
            };
          });
        setTeamMembers(members);
        setTeamCarts([]);
      }
    } catch (err) {
      console.error('Error loading team data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load team data');
    } finally {
      setLoading(false);
    }
  }, []); // Use useCallback to stabilize the function

  useEffect(() => {
    loadTeamData();
    // Listen for storage changes that affect this component
    const handleStorageUpdate = (event: any) => {
      const key = event?.detail?.key;
      if (
        key === STORAGE_KEYS.ROUTE_MANAGER ||
        key === STORAGE_KEYS.ROUTE_MANAGER_PROFILES ||
        key === STORAGE_KEYS.CONSOLE_PROFILES ||
        key === STORAGE_KEYS.ACTIVE_SEASON_ID ||
        key === STORAGE_KEYS.CONSOLE_WORKERS ||
        key === STORAGE_KEYS.CONSOLE_CARTS ||
        key === STORAGE_KEYS.ROUTE_ASSIGNMENTS ||
        (key && key.startsWith('bookings_'))
      ) {
        console.log(
          `Team.tsx detected relevant storage update (${key}), reloading data.`
        );
        loadTeamData();
      }
    };

    window.addEventListener('storageUpdated', handleStorageUpdate);
    // Also listen for bookingStoreRefreshed if Admin console is open
    window.addEventListener('bookingStoreRefreshed', loadTeamData);

    return () => {
      window.removeEventListener('storageUpdated', handleStorageUpdate);
      window.removeEventListener('bookingStoreRefreshed', loadTeamData);
    };
  }, [loadTeamData]); // Depend on the stable loadData function

  const toggleItem = (itemId: string) => {
    setExpandedItem(expandedItem === itemId ? null : itemId);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cps-blue"></div>
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

  return (
    <div className="space-y-2">
      {(isTeamSeason ? teamCarts.length > 0 : teamMembers.length > 0) ? (
        isTeamSeason ? (
          teamCarts.map((cart) => (
            <div
              key={cart.id}
              className="bg-gray-800 rounded-lg p-3 hover:bg-gray-700/80 transition-colors w-full"
            >
              <button
                onClick={() => toggleItem(`cart-${cart.id}`)}
                className="w-full text-left"
              >
                <div className="flex items-center justify-between">
                  <div className="w-1/4">
                    <h3 className="text-sm font-medium text-white">
                      Cart #{cart.id}
                    </h3>
                    <p className="text-xs text-gray-400 truncate">
                      {cart.members.map((m) => m.firstName).join(', ')}
                    </p>
                  </div>
                  <div className="w-2/4 flex flex-col items-center justify-center gap-2">
                    {cart.assignedRoutes.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 justify-center">
                        {cart.assignedRoutes.map((route) => (
                          <span
                            key={route}
                            className="px-2 py-0.5 bg-cps-blue text-white rounded text-xs font-medium"
                          >
                            {route}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="w-1/4 flex items-center justify-end gap-4">
                    <div className="flex flex-col items-end">
                      <div className="flex items-baseline gap-2">
                        <span className="text-xs font-bold text-gray-400">
                          Steps:
                        </span>
                        <span className="text-sm text-gray-200">
                          {cart.steps}
                        </span>
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-xs font-bold text-gray-400">
                          Avg:
                        </span>
                        <span className="text-sm text-gray-200">
                          ${cart.averagePrice.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-xs font-bold text-gray-400">
                          EQ:
                        </span>
                        <span className="text-sm text-gray-200">
                          {cart.equivalent.toFixed(2)}
                        </span>
                      </div>
                    </div>
                    {expandedItem === `cart-${cart.id}` ? (
                      <ChevronUp size={16} className="text-gray-400" />
                    ) : (
                      <ChevronDown size={16} className="text-gray-400" />
                    )}
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
                onClick={() => toggleItem(member.id)}
                className="w-full text-left"
              >
                <div className="flex items-center justify-between">
                  <div className="w-1/4">
                    <h3 className="text-sm font-medium text-white">
                      {member.firstName} {member.lastName}
                    </h3>
                    <p className="text-xs text-gray-400">{member.phone}</p>
                  </div>

                  <div className="w-2/4 flex flex-col items-center justify-center gap-2">
                    {member.assignedRoutes.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 justify-center">
                        {member.assignedRoutes.map((route) => (
                          <span
                            key={route}
                            className="px-2 py-0.5 bg-cps-blue text-white rounded text-xs font-medium"
                          >
                            {route}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="w-1/4 flex items-center justify-end gap-4">
                    <div className="flex flex-col items-end">
                      <div className="flex items-baseline gap-2">
                        <span className="text-xs font-bold text-gray-400">
                          Steps:
                        </span>
                        <span className="text-sm text-gray-200">
                          {member.steps}
                        </span>
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-xs font-bold text-gray-400">
                          Avg:
                        </span>
                        <span className="text-sm text-gray-200">
                          ${member.averagePrice.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-xs font-bold text-gray-400">
                          EQ:
                        </span>
                        <span className="text-sm text-gray-200">
                          {member.equivalent.toFixed(2)}
                        </span>
                      </div>
                    </div>
                    {expandedItem === member.id ? (
                      <ChevronUp size={16} className="text-gray-400" />
                    ) : (
                      <ChevronDown size={16} className="text-gray-400" />
                    )}
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
          No team members or carts are assigned to you for today in the active
          season.
        </div>
      )}
    </div>
  );
};

export default Team;
