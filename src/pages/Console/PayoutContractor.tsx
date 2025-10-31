import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Save,
  Trash2,
  Plus,
  Users,
  DollarSign,
  AlertCircle,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { getCurrentDate } from '../../lib/date';
import { bookingStore } from '../../stores/AdminBookingStore';
import {
  MasterBooking,
  PayoutRecord,
  Worker,
  Deduction,
  Bonus,
  // UpsellMenu, // Now using UpsellRef or hardcoded data
  ConfiguredSeason, // Changed from Season
  ConsoleProfile,
  PayoutLogicSettings,
  Cart,
} from '../../types';
import {
  getStorageItem,
  setStorageItem,
  STORAGE_KEYS,
} from '../../lib/localStorage';
import EditBookingModal from '../../components/EditBookingModal';
// Import hardcoded data helpers
import {
  REGIONS,
  getRegionById,
  HardcodedSeason,
  defaultPayoutLogicSettings,
  ALL_UPSELLS,
} from '../../lib/hardcodedData';

const PayoutContractor: React.FC = () => {
  const { contractorId, cartId } = useParams<{
    contractorId?: string;
    cartId?: string;
  }>();
  const navigate = useNavigate();

  // State
  const [team, setTeam] = useState<Worker[]>([]); // Workers being paid out (1 or more)
  const [bookings, setBookings] = useState<MasterBooking[]>([]); // Completed bookings for this team today
  const [deductions, setDeductions] = useState<Record<string, Deduction[]>>({});
  const [bonuses, setBonuses] = useState<Record<string, Bonus[]>>({});
  const [verifiedCash, setVerifiedCash] = useState(''); // String for input control
  const [verifiedCheque, setVerifiedCheque] = useState(''); // String for input control
  const [actualChangeReceived, setActualChangeReceived] = useState(''); // String for input control
  const [payoutSettings, setPayoutSettings] = useState<PayoutLogicSettings>(
    defaultPayoutLogicSettings
  );
  const [activeHardcodedSeason, setActiveHardcodedSeason] =
    useState<HardcodedSeason | null>(null);
  const [editingBooking, setEditingBooking] = useState<MasterBooking | null>(
    null
  );
  const [machineRental, setMachineRental] = useState<Record<string, boolean>>(
    {}
  ); // Track per worker
  const [equivSplits, setEquivSplits] = useState<Record<string, number>>({}); // % split for EQ
  const [upsellSplits, setUpsellSplits] = useState<Record<string, number>>({}); // % split for Upsell comm.
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const payoutDate = format(getCurrentDate(), 'yyyy-MM-dd'); // Date payout is for

  useEffect(() => {
    setLoading(true);
    setError(null);
    try {
      // --- Fetch Console Profile and Active Season Config ---
      const adminTitle = getStorageItem(STORAGE_KEYS.ADMIN, '');
      const allProfiles: ConsoleProfile[] = getStorageItem(
        STORAGE_KEYS.CONSOLE_PROFILES,
        []
      );
      const currentProfile = allProfiles.find((p) => p.title === adminTitle);

      if (!currentProfile)
        throw new Error('Cannot find current console profile');

      const activeSeasonHardcodedId = getStorageItem<string | null>(
        STORAGE_KEYS.ACTIVE_SEASON_ID,
        null
      );
      const configuredSeason = currentProfile.seasons.find(
        (cs) => cs.hardcodedId === activeSeasonHardcodedId && cs.enabled
      );

      if (!configuredSeason)
        throw new Error('No active/enabled season found for profile');

      const regionData = getRegionById(currentProfile.region);
      const hcSeasonData = regionData?.seasons.find(
        (hs) => hs.id === configuredSeason.hardcodedId
      );

      if (!hcSeasonData)
        throw new Error('Could not load hardcoded season data.');

      setActiveHardcodedSeason(hcSeasonData);
      setPayoutSettings(
        configuredSeason.payoutLogic || defaultPayoutLogicSettings
      ); // Use profile-specific or default
      // --- End Fetch Console Profile ---

      // --- Determine Team Members ---
      const allWorkers: Worker[] = getStorageItem(
        STORAGE_KEYS.CONSOLE_WORKERS,
        []
      );
      let currentTeam: Worker[];

      if (cartId) {
        // Team payout based on cart ID
        const cartNum = parseInt(cartId, 10);
        currentTeam = allWorkers.filter(
          (w) => w.cartId === cartNum && w.showed && w.showedDate === payoutDate
        );
      } else if (contractorId) {
        // Individual payout based on contractor ID
        currentTeam = allWorkers.filter(
          (w) =>
            w.contractorId === contractorId &&
            w.showed &&
            w.showedDate === payoutDate
        );
      } else {
        throw new Error('No contractor or cart ID provided.');
      }

      if (currentTeam.length === 0) {
        // Maybe they were navigated here but attendance changed?
        throw new Error('No workers found for this payout.');
      }

      setTeam(currentTeam);
      // --- End Determine Team ---

      // --- Initialize Splits, Adjustments, Rentals ---
      if (currentTeam.length > 0) {
        const initialSplit = 100 / currentTeam.length; // Default even split
        const initialEqSplits: Record<string, number> = {};
        const initialUpSplits: Record<string, number> = {};
        const initialDeductions: Record<string, Deduction[]> = {};
        const initialBonuses: Record<string, Bonus[]> = {};
        const initialRentals: Record<string, boolean> = {};

        currentTeam.forEach((member) => {
          initialEqSplits[member.contractorId] = initialSplit;
          initialUpSplits[member.contractorId] = initialSplit;
          initialDeductions[member.contractorId] = member.deductions || []; // Load existing if re-editing?
          initialBonuses[member.contractorId] = member.bonuses || []; // Load existing if re-editing?
          initialRentals[member.contractorId] = true; // Default to having rental
        });

        setEquivSplits(initialEqSplits);
        setUpsellSplits(initialUpSplits);
        setDeductions(initialDeductions);
        setBonuses(initialBonuses);
        setMachineRental(initialRentals);
      }
      // --- End Init ---

      // --- Load Relevant Bookings ---
      const allBookings = bookingStore.getAllBookings(); // Get all from store
      const teamBookingIds = new Set(
        currentTeam.flatMap((w) =>
          allBookings
            .filter((b) => b['Contractor Number'] === w.contractorId) // Only bookings directly assigned for payout calc
            .map((b) => b['Booking ID'])
        )
      );

      const todaysCompletedBookings = allBookings.filter(
        (b) =>
          teamBookingIds.has(b['Booking ID']) &&
          b.Completed === 'x' &&
          b['Date Completed']?.startsWith(payoutDate)
      );
      setBookings(todaysCompletedBookings);
      // --- End Load Bookings ---
    } catch (err) {
      console.error('Error loading payout data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data.');
    } finally {
      setLoading(false);
    }
  }, [contractorId, cartId, payoutDate]); // Rerun if ID or date changes

  // --- Helper Functions (Add/Remove Deductions/Bonuses, Handle Changes) ---
  // These remain largely the same as before...
  const addDeduction = (workerId: string) => {
    const newDeduction = { id: Date.now(), name: '', amount: 0 };
    setDeductions((prev) => ({
      ...prev,
      [workerId]: [...(prev[workerId] || []), newDeduction],
    }));
  };

  const removeDeduction = (workerId: string, id: number) => {
    setDeductions((prev) => ({
      ...prev,
      [workerId]: (prev[workerId] || []).filter((d) => d.id !== id),
    }));
  };

  const handleDeductionChange = (
    workerId: string,
    id: number,
    field: 'name' | 'amount',
    value: string
  ) => {
    setDeductions((prev) => ({
      ...prev,
      [workerId]: (prev[workerId] || []).map((d) =>
        d.id === id
          ? {
              ...d,
              [field]: field === 'amount' ? parseFloat(value) || 0 : value,
            }
          : d
      ),
    }));
  };

  const addBonus = (workerId: string) => {
    const newBonus = { id: Date.now(), type: '', amount: 0 };
    setBonuses((prev) => ({
      ...prev,
      [workerId]: [...(prev[workerId] || []), newBonus],
    }));
  };

  const removeBonus = (workerId: string, id: number) => {
    setBonuses((prev) => ({
      ...prev,
      [workerId]: (prev[workerId] || []).filter((b) => b.id !== id),
    }));
  };

  const handleBonusChange = (
    workerId: string,
    id: number,
    field: 'type' | 'amount',
    value: string
  ) => {
    setBonuses((prev) => ({
      ...prev,
      [workerId]: (prev[workerId] || []).map((b) =>
        b.id === id
          ? {
              ...b,
              [field]: field === 'amount' ? parseFloat(value) || 0 : value,
            }
          : b
      ),
    }));
  };

  const handleUpdateBooking = (
    bookingId: string,
    updates: Partial<MasterBooking>
  ) => {
    // Make sure 'Price' is stored as a string if needed by MasterBooking type
    if (updates.Price && typeof updates.Price === 'number') {
      updates.Price = updates.Price.toFixed(2);
    }
    bookingStore.updateBooking(bookingId, updates);
    // Refresh local state (bookingStore should trigger listener, but explicit refresh can be added)
    const updatedBookings = bookings.map((b) =>
      b['Booking ID'] === bookingId ? { ...b, ...updates } : b
    );
    setBookings(updatedBookings);

    setEditingBooking(null);
  };

  // --- Input Parsers ---
  const numVerifiedCash = parseFloat(verifiedCash) || 0;
  const numVerifiedCheque = parseFloat(verifiedCheque) || 0;
  const numActualChange = parseFloat(actualChangeReceived) || 0;

  // --- PAYOUT CALCULATIONS (Using Memoization for efficiency) ---

  const calculatedPayouts = useMemo(() => {
    if (!activeHardcodedSeason || loading) {
      return { teamGrossSales: 0, totalTeamEquivalent: 0, workerPayouts: {} };
    }

    const isTeam = activeHardcodedSeason.type === 'Team';

    // 1. Calculate Actual Gross Sales collected by this team today
    const otherPaymentsTotal = bookings
      .filter((b) => {
        const method = (b['Payment Method'] || '').toLowerCase();
        // Exclude cash/cheque which are verified separately, and IOS which isn't 'collected'
        return method !== 'cash' && method !== 'cheque' && method !== 'ios';
      })
      .reduce((sum, b) => sum + parseFloat(b.Price || '0'), 0);

    // Actual Gross includes verified cash/cheque, change received back, and other electronic/billed payments
    const actualGrossSales =
      numVerifiedCash +
      numActualChange +
      numVerifiedCheque +
      otherPaymentsTotal;

    // 2. Calculate Upsell Commission & EQ Contribution (only from Contract bookings)
    const { totalUpsellCommission, aerationEqContribution } = (() => {
      let totalCommission = 0;
      let eqContribution = 0;
      const contractBookings = bookings.filter((b) => b.isContract);

      contractBookings.forEach((booking) => {
        // Find the hardcoded upsell details (if needed - currently based on %)
        const upsellRef = ALL_UPSELLS.find(
          (u) => u.id === booking.upsellMenuId
        ); // Assumes upsellMenuId stores the hardcoded ID
        if (!upsellRef) return; // Skip if upsell definition not found

        // Get payout settings relevant to this upsell from the *season* config
        const eqPercent =
          configuredSeason?.upsells?.find((u) => u.id === upsellRef.id)
            ?.eqPercentage ?? 0; // Find specific config
        const prePayCommPercent =
          configuredSeason?.upsells?.find((u) => u.id === upsellRef.id)
            ?.prePayCommissionPercentage ?? 10; // Default 10%

        const price = parseFloat(booking.Price || '0');
        const taxRate = payoutSettings.taxRate; // Use season's payout settings tax rate
        const netPrice = price / (1 + taxRate / 100);

        if (eqPercent > 0) {
          const portionForEq = netPrice * (eqPercent / 100);
          eqContribution += portionForEq;
          const remainderForCommission = netPrice - portionForEq;
          totalCommission += remainderForCommission * (prePayCommPercent / 100); // Use specific commission %
        } else {
          totalCommission += netPrice * (prePayCommPercent / 100); // Use specific commission %
        }
      });
      return { totalUpsellCommission, aerationEqContribution };
    })();

    // 3. Calculate Total Net Sales for EQ calculation
    const totalNetSales = (() => {
      // Start with EQ contribution from upsells
      let net = aerationEqContribution;

      // Add net value from non-contract (door sales) bookings
      bookings
        .filter((b) => !b.isContract)
        .forEach((booking) => {
          const price = parseFloat(booking.Price || '0');
          let methodKey: string = 'Custom'; // Default fallback
          const paymentMethod = (booking['Payment Method'] || '').toLowerCase();

          // Determine the correct key for paymentMethodPercentages
          if (booking.Prepaid === 'x') methodKey = 'Prepaid';
          else if (paymentMethod.includes('cash')) methodKey = 'Cash';
          else if (paymentMethod.includes('cheque')) methodKey = 'Cheque';
          else if (paymentMethod.includes('transfer')) methodKey = 'E-Transfer';
          else if (paymentMethod.includes('credit')) methodKey = 'Credit Card';
          else if (paymentMethod.includes('billed')) methodKey = 'Billed';
          else if (paymentMethod.includes('ios')) methodKey = 'IOS';
          // If custom split, it might contain multiple methods, handle as 'Custom' or refine logic
          else if (paymentMethod.includes(': $')) methodKey = 'Custom';

          const methodSettings =
            payoutSettings.paymentMethodPercentages[methodKey];

          if (!methodSettings) {
            // If method not found, assume 100% and apply tax (conservative default)
            console.warn(
              `Payout settings not found for method: ${methodKey}. Using default calculation.`
            );
            net += price / (1 + payoutSettings.taxRate / 100);
            return;
          }

          let adjustedValue = price * (methodSettings.percentage / 100);
          if (methodSettings.applyTaxes) {
            adjustedValue /= 1 + payoutSettings.taxRate / 100;
          }
          net += adjustedValue;
        });

      // Apply product cost reduction for Team seasons
      if (isTeam) {
        const productCostPercent = payoutSettings.productCost || 0;
        net *= 1 - productCostPercent / 100;
      }

      return net;
    })();

    // 4. Calculate Total Equivalent for the team
    const totalEquivalent = totalNetSales > 0 ? totalNetSales / 25 : 0;

    // 5. Calculate Individual Payouts
    const workerPayouts: Record<string, any> = {};
    team.forEach((worker) => {
      // Calculate Raises
      const silverRaise =
        payoutSettings.applySilverRaises && activeHardcodedSeason
          ? (() => {
              let silvers = 0;
              // Determine which silver count applies based on hardcoded season ID
              if (activeHardcodedSeason.id.includes('aeration'))
                silvers = parseInt(worker.aerationSilversPreviousYears || '0');
              else if (activeHardcodedSeason.id.includes('rejuv'))
                silvers = parseInt(worker.rejuvSilversPreviousYears || '0');
              else if (activeHardcodedSeason.id.includes('sealing'))
                silvers = parseInt(worker.sealingSilversPreviousYears || '0');
              else if (activeHardcodedSeason.id.includes('cleaning'))
                silvers = parseInt(worker.cleaningSilversPreviousYears || '0');
              // Apply bonus rules
              if (silvers >= 8) return 1.0;
              if (silvers >= 6) return 0.75;
              if (silvers >= 4) return 0.5;
              if (silvers >= 2) return 0.25;
              return 0;
            })()
          : 0;

      const alumniRaise = payoutSettings.applyAlumniRaises
        ? (() => {
            const lifetimeDays =
              parseInt(worker.daysWorkedPreviousYears || '0') +
              (worker.daysWorked || 0);
            if (lifetimeDays >= 200) return 0.5;
            if (lifetimeDays >= 50) return 0.25;
            return 0;
          })()
        : 0;

      // Determine Base Rate
      let baseRate = 0;
      if (activeHardcodedSeason.type === 'Individual') {
        baseRate = payoutSettings.baseCommissionRate || 0;
      } else if (isTeam) {
        baseRate =
          team.length > 1
            ? payoutSettings.teamBaseCommissionRate || 0
            : payoutSettings.soloBaseCommissionRate || 0;
      }
      const commissionRate = baseRate + silverRaise + alumniRaise;

      // Calculate Splits
      const eqSplitPercent = equivSplits[worker.contractorId] || 0;
      const upsellSplitPercent = upsellSplits[worker.contractorId] || 0;

      const individualEquiv = totalEquivalent * (eqSplitPercent / 100);
      const baseCommission = individualEquiv * commissionRate;
      const individualUpsellCommission =
        totalUpsellCommission * (upsellSplitPercent / 100);

      // Calculate Adjustments
      const totalDeductions = (deductions[worker.contractorId] || []).reduce(
        (sum, d) => sum + d.amount,
        0
      );
      const totalBonuses = (bonuses[worker.contractorId] || []).reduce(
        (sum, b) => sum + b.amount,
        0
      );
      const machineRentalCost = machineRental[worker.contractorId] ? 10 : 0;

      // Final Payout
      const finalPayout =
        baseCommission +
        individualUpsellCommission +
        totalBonuses -
        totalDeductions -
        machineRentalCost;

      workerPayouts[worker.contractorId] = {
        commissionRate,
        finalPayout,
        individualEquiv,
        baseCommission,
        individualUpsellCommission,
        totalDeductions,
        totalBonuses,
        machineRentalCost,
        grossSalesSplit: actualGrossSales / team.length, // Simple even split for reporting
      };
    });

    return {
      teamGrossSales: actualGrossSales,
      totalTeamEquivalent: totalEquivalent,
      workerPayouts,
    };
  }, [
    activeHardcodedSeason,
    loading,
    bookings,
    team,
    payoutSettings,
    equivSplits,
    upsellSplits,
    deductions,
    bonuses,
    machineRental,
    verifiedCash,
    verifiedCheque,
    actualChangeReceived,
  ]);

  const handleFinalizePayout = () => {
    if (team.length === 0 || loading || !calculatedPayouts.workerPayouts)
      return;
    setError(null); // Clear previous errors

    // Validation: Ensure splits add up to 100% (or close enough)
    const totalEqSplit = Object.values(equivSplits).reduce(
      (sum, val) => sum + val,
      0
    );
    const totalUpsellSplit = Object.values(upsellSplits).reduce(
      (sum, val) => sum + val,
      0
    );

    if (
      Math.abs(totalEqSplit - 100) > 0.1 ||
      Math.abs(totalUpsellSplit - 100) > 0.1
    ) {
      setError('Error: EQ Splits and Upsell Splits must each total 100%.');
      return;
    }

    try {
      const allWorkers = getStorageItem<Worker[]>(
        STORAGE_KEYS.CONSOLE_WORKERS,
        []
      );
      const updatedWorkers = allWorkers.map((w) => {
        const payoutResult = calculatedPayouts.workerPayouts[w.contractorId];
        // Only update workers who are part of the current payout team
        if (payoutResult) {
          const newPayoutRecord: PayoutRecord = {
            date: payoutDate,
            grossSales: payoutResult.grossSalesSplit, // Use the calculated split
            equivalent: payoutResult.individualEquiv,
            commission: payoutResult.finalPayout,
            deductions: deductions[w.contractorId] || [],
            bonuses: bonuses[w.contractorId] || [],
          };

          const history = w.payoutHistory || [];
          // Check if a record for this date already exists and replace it, otherwise add new
          const existingRecordIndex = history.findIndex(
            (p) => p.date === payoutDate
          );
          let updatedHistory: PayoutRecord[];
          if (existingRecordIndex > -1) {
            updatedHistory = [...history];
            updatedHistory[existingRecordIndex] = newPayoutRecord;
          } else {
            updatedHistory = [newPayoutRecord, ...history].sort((a, b) =>
              b.date.localeCompare(a.date)
            ); // Keep sorted
          }

          return {
            ...w,
            payoutCompleted: true, // Mark as completed for today
            // Store today's calculated values directly on the worker for quick display
            commission: newPayoutRecord.commission,
            grossSales: newPayoutRecord.grossSales,
            equivalent: newPayoutRecord.equivalent,
            deductions: newPayoutRecord.deductions, // Ensure these are saved back if modified
            bonuses: newPayoutRecord.bonuses, // Ensure these are saved back if modified
            payoutHistory: updatedHistory,
          };
        }
        return w; // Return unchanged worker if not part of this payout
      });

      setStorageItem(STORAGE_KEYS.CONSOLE_WORKERS, updatedWorkers);
      navigate('/console/workerbook'); // Navigate back after successful save
    } catch (error) {
      console.error('Error during payout submission:', error);
      setError(
        `Payout failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  };

  // --- UI Calculations ---
  const expectedCashTotal = bookings
    .filter((b) => (b['Payment Method'] || '').toLowerCase() === 'cash')
    .reduce((sum, b) => sum + parseFloat(b.Price || '0'), 0);

  const expectedChequeTotal = bookings
    .filter((b) => (b['Payment Method'] || '').toLowerCase() === 'cheque')
    .reduce((sum, b) => sum + parseFloat(b.Price || '0'), 0);

  // Discrepancy based on verified cash (+ change returned) vs expected cash
  const cashDiscrepancy = numVerifiedCash + numActualChange - expectedCashTotal;
  const chequeDiscrepancy = numVerifiedCheque - expectedChequeTotal;

  // --- Render ---
  if (loading)
    return (
      <div className="p-6 text-center text-gray-400">
        Loading Payout Data... <Loader className="inline animate-spin ml-2" />
      </div>
    );
  if (error) return <div className="p-6 text-center text-red-400">{error}</div>;
  if (team.length === 0 || !activeHardcodedSeason)
    return (
      <div className="p-6 text-center text-gray-500">
        No workers or season data available for payout.
      </div>
    );

  const isTeamPayout = team.length > 1;
  const { teamGrossSales, totalTeamEquivalent, workerPayouts } =
    calculatedPayouts;

  return (
    <div className="space-y-6 animate-fade-in p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/console/workerbook')} // Go back to workerbook
          className="p-2 hover:bg-gray-700 rounded-full transition-colors"
        >
          <ArrowLeft className="text-gray-400" />
        </button>
        <div>
          <h2 className="text-lg font-medium text-white">
            {isTeamPayout
              ? `Team Payout (Cart #${cartId})`
              : `${team[0].firstName} ${team[0].lastName}`}
          </h2>
          <p className="text-sm text-gray-400">
            {activeHardcodedSeason.name} Payout for{' '}
            {format(parseISO(payoutDate), 'MMMM d, yyyy')}
          </p>
        </div>
      </div>

      {/* Main Payout Form */}
      <div className="bg-gray-800 rounded-lg p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
        {/* Top Summary & Verification */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Summary & Jobs */}
          <div className="space-y-4">
            {/* Sales Summary */}
            <div className="grid grid-cols-2 gap-4 text-center bg-gray-900/50 p-3 rounded-md">
              <div>
                <p className="text-xs text-gray-400">Team Gross Sales</p>
                <p className="text-lg font-medium text-white">
                  ${teamGrossSales.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Total Team EQ</p>
                <p className="text-lg font-medium text-white">
                  {totalTeamEquivalent.toFixed(2)}
                </p>
              </div>
            </div>

            {/* Completed Jobs List */}
            <div>
              <h3 className="text-sm font-medium text-gray-300 mb-2">
                Completed Jobs ({bookings.length})
              </h3>
              <div className="space-y-1 max-h-60 overflow-y-auto pr-2 bg-gray-900/50 p-2 rounded-md border border-gray-700/50">
                {bookings.map((booking) => (
                  <div
                    key={booking['Booking ID']}
                    onClick={() => setEditingBooking(booking)}
                    className={`flex justify-between items-center bg-gray-700/50 p-1.5 rounded-md cursor-pointer hover:bg-gray-700 transition-colors border-l-4 ${
                      booking.isContract
                        ? 'border-orange-500'
                        : booking.isPrebooked
                        ? 'border-green-500'
                        : 'border-yellow-500'
                    }`}
                  >
                    <span className="text-xs text-gray-300 truncate px-1 flex-1">
                      {booking['Full Address']}
                    </span>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs font-medium text-gray-200">
                        ${parseFloat(booking.Price || '0').toFixed(2)}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-900/40 text-blue-300 whitespace-nowrap">
                        {(booking['Payment Method'] || 'N/A').substring(0, 10)}
                        {booking.Prepaid === 'x' ? ' (PP)' : ''}
                      </span>
                    </div>
                  </div>
                ))}
                {bookings.length === 0 && (
                  <p className="text-xs text-gray-500 text-center py-2">
                    No completed jobs found for this payout.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Right: Payment Verification */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-300">
              Verify Payments
            </h3>
            <div className="bg-gray-900/50 p-3 rounded-md space-y-3 border border-gray-700/50">
              {/* Expected Values */}
              <div className="flex justify-between items-center text-xs text-gray-500 mb-2">
                <span>Expected Cash: ${expectedCashTotal.toFixed(2)}</span>
                <span>Expected Cheques: ${expectedChequeTotal.toFixed(2)}</span>
              </div>
              {/* Inputs */}
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-400 w-32 shrink-0">
                  Cash Rec'd:
                </label>
                <input
                  type="number"
                  value={verifiedCash}
                  onChange={(e) => setVerifiedCash(e.target.value)}
                  placeholder="0.00"
                  className="input flex-1 text-right"
                  step="0.01"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-400 w-32 shrink-0">
                  Cheques Rec'd:
                </label>
                <input
                  type="number"
                  value={verifiedCheque}
                  onChange={(e) => setVerifiedCheque(e.target.value)}
                  placeholder="0.00"
                  className="input flex-1 text-right"
                  step="0.01"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-400 w-32 shrink-0">
                  Change Ret'd:
                </label>
                <input
                  type="number"
                  value={actualChangeReceived}
                  onChange={(e) => setActualChangeReceived(e.target.value)}
                  placeholder="0.00"
                  className="input flex-1 text-right"
                  step="0.01"
                />
              </div>

              {/* Discrepancies */}
              <div className="border-t border-gray-700 pt-3 mt-2 space-y-1">
                <div
                  className={`flex justify-between items-center text-sm ${
                    cashDiscrepancy === 0
                      ? 'text-gray-400'
                      : cashDiscrepancy > 0
                      ? 'text-green-400'
                      : 'text-red-400'
                  }`}
                >
                  <span>Cash Discrepancy:</span>
                  <span className="font-bold">
                    {cashDiscrepancy.toFixed(2)}
                  </span>
                </div>
                <div
                  className={`flex justify-between items-center text-sm ${
                    chequeDiscrepancy === 0
                      ? 'text-gray-400'
                      : chequeDiscrepancy > 0
                      ? 'text-green-400'
                      : 'text-red-400'
                  }`}
                >
                  <span>Cheque Discrepancy:</span>
                  <span className="font-bold">
                    {chequeDiscrepancy.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Payout Splits (Only for Teams) */}
        {isTeamPayout && (
          <div className="bg-gray-900/50 p-4 rounded-md border border-gray-700/50">
            <h3 className="text-md font-medium text-white mb-4">
              Team Payout Split
            </h3>
            <div className="space-y-4">
              {team.map((member) => {
                const payoutResult = workerPayouts[member.contractorId];
                if (!payoutResult) return null; // Skip if calculation failed

                return (
                  <div
                    key={member.contractorId}
                    className="bg-gray-800 p-3 rounded-lg border border-gray-700/70"
                  >
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-2">
                      <div>
                        <p className="font-bold text-white">
                          {member.firstName} {member.lastName}
                        </p>
                        <p className="text-xs text-gray-400">
                          Rate: ${payoutResult.commissionRate.toFixed(2)}/EQ
                        </p>
                      </div>
                      <p className="text-xl font-bold text-cps-green mt-1 sm:mt-0">
                        ${payoutResult.finalPayout.toFixed(2)}
                      </p>
                    </div>
                    {/* Split Inputs */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs text-gray-400 block mb-1">
                          EQ Split (%)
                        </label>
                        <input
                          type="number"
                          value={
                            equivSplits[member.contractorId]?.toString() || ''
                          }
                          onChange={(e) =>
                            setEquivSplits({
                              ...equivSplits,
                              [member.contractorId]:
                                parseFloat(e.target.value) || 0,
                            })
                          }
                          className="input w-full text-right"
                          step="0.1"
                          min="0"
                          max="100"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 block mb-1">
                          Upsell Split (%)
                        </label>
                        <input
                          type="number"
                          value={
                            upsellSplits[member.contractorId]?.toString() || ''
                          }
                          onChange={(e) =>
                            setUpsellSplits({
                              ...upsellSplits,
                              [member.contractorId]:
                                parseFloat(e.target.value) || 0,
                            })
                          }
                          className="input w-full text-right"
                          step="0.1"
                          min="0"
                          max="100"
                        />
                      </div>
                    </div>
                    {/* Display calculated values */}
                    <div className="text-xs text-gray-400 mt-2 grid grid-cols-3 gap-2">
                      <span>EQ: {payoutResult.individualEquiv.toFixed(2)}</span>
                      <span>
                        Base: ${payoutResult.baseCommission.toFixed(2)}
                      </span>
                      <span>
                        Upsell: $
                        {payoutResult.individualUpsellCommission.toFixed(2)}
                      </span>
                    </div>
                  </div>
                );
              })}
              {/* Validation for Splits */}
              <div className="text-right text-xs mt-2">
                <span
                  className={`mr-4 ${
                    Math.abs(
                      Object.values(equivSplits).reduce((s, v) => s + v, 0) -
                        100
                    ) > 0.1
                      ? 'text-red-400'
                      : 'text-green-400'
                  }`}
                >
                  EQ Total:{' '}
                  {Object.values(equivSplits)
                    .reduce((s, v) => s + v, 0)
                    .toFixed(1)}
                  %
                </span>
                <span
                  className={`${
                    Math.abs(
                      Object.values(upsellSplits).reduce((s, v) => s + v, 0) -
                        100
                    ) > 0.1
                      ? 'text-red-400'
                      : 'text-green-400'
                  }`}
                >
                  Upsell Total:{' '}
                  {Object.values(upsellSplits)
                    .reduce((s, v) => s + v, 0)
                    .toFixed(1)}
                  %
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Adjustments (Bonuses & Deductions) - Per Worker */}
        <div className="space-y-4 border-t border-gray-700 pt-4">
          <h3 className="text-md font-medium text-white mb-2">
            Adjustments & Final Payout
          </h3>
          {team.map((member) => {
            const payoutResult = workerPayouts[member.contractorId];
            if (!payoutResult && !isTeamPayout) return null; // Only show adjustments section if payout calculated or it's a team

            return (
              <div
                key={member.contractorId}
                className="bg-gray-900/50 p-4 rounded-lg border border-gray-700/50"
              >
                <div className="flex justify-between items-center mb-3">
                  <h4 className="text-sm font-semibold text-gray-200">
                    {member.firstName} {member.lastName}
                  </h4>
                  {/* Display final payout for this worker */}
                  {payoutResult && (
                    <span className="text-lg font-bold text-cps-green">
                      ${payoutResult.finalPayout.toFixed(2)}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Bonuses */}
                  <div>
                    <h5 className="text-xs font-medium text-gray-400 mb-2">
                      Bonuses
                    </h5>
                    <div className="space-y-2 mb-2">
                      {(bonuses[member.contractorId] || []).map((b) => (
                        <div key={b.id} className="flex items-center gap-1">
                          <input
                            type="text"
                            value={b.type}
                            onChange={(e) =>
                              handleBonusChange(
                                member.contractorId,
                                b.id,
                                'type',
                                e.target.value
                              )
                            }
                            placeholder="Type"
                            className="input flex-1 text-xs px-2 py-1"
                          />
                          <input
                            type="number"
                            value={b.amount === 0 ? '' : b.amount.toString()}
                            onChange={(e) =>
                              handleBonusChange(
                                member.contractorId,
                                b.id,
                                'amount',
                                e.target.value
                              )
                            }
                            placeholder="Amt"
                            className="input w-16 text-xs px-2 py-1 text-right"
                            step="0.01"
                          />
                          <button
                            onClick={() =>
                              removeBonus(member.contractorId, b.id)
                            }
                            className="p-1 bg-red-900/30 text-red-400 rounded hover:bg-red-900/50"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => addBonus(member.contractorId)}
                      className="text-xs text-cps-blue hover:text-blue-400 flex items-center gap-1"
                    >
                      <Plus size={12} />
                      Add Bonus
                    </button>
                  </div>
                  {/* Deductions */}
                  <div>
                    <h5 className="text-xs font-medium text-gray-400 mb-2">
                      Deductions
                    </h5>
                    <div className="space-y-2 mb-2">
                      {(deductions[member.contractorId] || []).map((d) => (
                        <div key={d.id} className="flex items-center gap-1">
                          <input
                            type="text"
                            value={d.name}
                            onChange={(e) =>
                              handleDeductionChange(
                                member.contractorId,
                                d.id,
                                'name',
                                e.target.value
                              )
                            }
                            placeholder="Reason"
                            className="input flex-1 text-xs px-2 py-1"
                          />
                          <input
                            type="number"
                            value={d.amount === 0 ? '' : d.amount.toString()}
                            onChange={(e) =>
                              handleDeductionChange(
                                member.contractorId,
                                d.id,
                                'amount',
                                e.target.value
                              )
                            }
                            placeholder="Amt"
                            className="input w-16 text-xs px-2 py-1 text-right"
                            step="0.01"
                          />
                          <button
                            onClick={() =>
                              removeDeduction(member.contractorId, d.id)
                            }
                            className="p-1 bg-red-900/30 text-red-400 rounded hover:bg-red-900/50"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => addDeduction(member.contractorId)}
                      className="text-xs text-cps-blue hover:text-blue-400 flex items-center gap-1"
                    >
                      <Plus size={12} />
                      Add Deduction
                    </button>
                  </div>
                </div>
                {/* Machine Rental */}
                <div className="mt-3 border-t border-gray-700 pt-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={machineRental[member.contractorId] ?? true}
                      onChange={(e) =>
                        setMachineRental({
                          ...machineRental,
                          [member.contractorId]: e.target.checked,
                        })
                      }
                      className="h-4 w-4 rounded border-gray-600 bg-gray-900 text-cps-red focus:ring-cps-red"
                    />
                    <span className="text-sm text-gray-300">
                      Machine Rental (-$10.00)
                    </span>
                  </label>
                </div>
              </div>
            );
          })}
        </div>

        {/* Final Actions */}
        <div className="pt-6 flex justify-between items-center border-t border-gray-700 mt-4">
          {/* Display Total Payout */}
          <div>
            <p className="text-gray-400 text-sm">Total Team Payout</p>
            <p className="text-2xl font-bold text-cps-green">
              $
              {Object.values(workerPayouts)
                .reduce((sum, p) => sum + p.finalPayout, 0)
                .toFixed(2)}
            </p>
          </div>
          <button
            onClick={handleFinalizePayout}
            disabled={loading} // Disable while loading
            className="bg-cps-green text-white py-2 px-6 rounded-md hover:bg-green-700 transition-colors flex items-center gap-2 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save size={16} />
            <span>Save & Finalize Payout</span>
          </button>
        </div>
      </div>

      {/* Edit Booking Modal */}
      {editingBooking && (
        <EditBookingModal
          booking={editingBooking}
          onSave={handleUpdateBooking}
          onClose={() => setEditingBooking(null)}
        />
      )}
    </div>
  );
};

export default PayoutContractor;
