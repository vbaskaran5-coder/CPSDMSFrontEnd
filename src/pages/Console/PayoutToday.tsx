import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { bookingStore } from '../../stores/AdminBookingStore';
import {
  MasterBooking,
  Worker,
  Season,
  ConsoleProfile,
  Cart,
  UpsellMenu,
  PayoutLogicSettings,
} from '../../types';
import { CheckCircle2, DollarSign, Edit } from 'lucide-react';
import { format } from 'date-fns';
import { getCurrentDate } from '../../lib/date';
import {
  getStorageItem,
  setStorageItem,
  STORAGE_KEYS,
  removeStorageItem, // <<< IMPORT removeStorageItem
} from '../../lib/localStorage';

const defaultPayoutLogicSettings: PayoutLogicSettings = {
  taxRate: 13,
  productCost: 20,
  baseCommissionRate: 8.0,
  soloBaseCommissionRate: 6.0,
  teamBaseCommissionRate: 8.0,
  applySilverRaises: true,
  applyAlumniRaises: true,
  paymentMethodPercentages: {
    Cash: { percentage: 100, applyTaxes: true },
    Cheque: { percentage: 100, applyTaxes: true },
    'E-Transfer': { percentage: 100, applyTaxes: true },
    'Credit Card': { percentage: 100, applyTaxes: true },
    Prepaid: { percentage: 50, applyTaxes: true },
    Billed: { percentage: 50, applyTaxes: true },
  },
};

const PayoutToday: React.FC<{ date?: string }> = ({ date }) => {
  // <<< UPDATE props to accept optional date
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [payoutSettings, setPayoutSettings] = useState<PayoutLogicSettings>(
    defaultPayoutLogicSettings
  );
  const [activeSeason, setActiveSeason] = useState<Season | null>(null);
  const navigate = useNavigate();
  // <<< UPDATE to use prop 'date' if provided, otherwise use current date
  const displayDate = date ? date : format(getCurrentDate(), 'yyyy-MM-dd');

  useEffect(() => {
    const loadData = () => {
      const adminTitle = getStorageItem(STORAGE_KEYS.ADMIN, '');
      const allProfiles: ConsoleProfile[] = getStorageItem(
        STORAGE_KEYS.CONSOLE_PROFILES,
        []
      );
      const currentProfile = allProfiles.find((p) => p.title === adminTitle);
      const activeSeasonId = getStorageItem(
        STORAGE_KEYS.ACTIVE_SEASON_ID,
        null
      );
      if (currentProfile && currentProfile.seasons) {
        const season = currentProfile.seasons.find(
          (s) => s.id === activeSeasonId
        );
        setActiveSeason(season || null);
        if (season?.payoutLogic) {
          setPayoutSettings(season.payoutLogic);
        }
      }

      const savedWorkers: Worker[] = getStorageItem(
        STORAGE_KEYS.CONSOLE_WORKERS,
        []
      );
      if (savedWorkers) {
        const dayWorkers = savedWorkers.filter(
          (w: Worker) => w.showed && w.showedDate === displayDate
        );
        setWorkers(dayWorkers);
      }
    };

    loadData();

    window.addEventListener('storageUpdated', loadData);
    return () => window.removeEventListener('storageUpdated', loadData);
  }, [displayDate]);

  // --- NEW: Effect to check for payout completion ---
  useEffect(() => {
    if (workers.length > 0) {
      const allPaid = workers.every((w) => w.payoutCompleted);
      if (allPaid) {
        console.log(
          'All payouts for the day are finalized. Clearing RM and Contractor sessions.'
        );
        removeStorageItem(STORAGE_KEYS.CONTRACTOR);
        removeStorageItem(STORAGE_KEYS.ACTIVE_CART);
        removeStorageItem(STORAGE_KEYS.ROUTE_MANAGER);
        // Admin session (`STORAGE_KEYS.ADMIN`) remains active.
      }
    }
  }, [workers]);
  // --- END NEW ---

  const isTeamSeason = ['Rejuv', 'Sealing', 'Cleaning'].includes(
    activeSeason?.type || ''
  );

  const getBookingsForContractor = (contractorId: string) => {
    const allWorkerBookings =
      bookingStore.getBookingsForContractor(contractorId);
    return allWorkerBookings.filter(
      (b) =>
        b['Completed'] === 'x' && b['Date Completed']?.startsWith(displayDate)
    );
  };

  const calculateGrossSales = (bookings: MasterBooking[]) => {
    return bookings.reduce((sum, booking) => {
      return sum + parseFloat(booking['Price'] || '0');
    }, 0);
  };

  const { totalEquivalent, totalGrossSales } = useMemo(() => {
    if (workers.length === 0) {
      return { totalEquivalent: 0, totalGrossSales: 0 };
    }

    const allBookingsForToday = workers.flatMap((w) =>
      getBookingsForContractor(w.contractorId)
    );
    const gross = calculateGrossSales(allBookingsForToday);

    const { aerationEqContribution } = (() => {
      const allUpsellMenus: UpsellMenu[] = getStorageItem(
        STORAGE_KEYS.UPSELL_MENUS,
        []
      );
      let eqContribution = 0;
      const contractBookings = allBookingsForToday.filter((b) => b.isContract);
      contractBookings.forEach((booking) => {
        const menu = allUpsellMenus.find((m) => m.id === booking.upsellMenuId);
        if (!menu) return;
        const price = parseFloat(booking.Price || '0');
        const taxRate =
          activeSeason?.payoutLogic?.taxRate || payoutSettings.taxRate;
        const netPrice = price / (1 + taxRate / 100);
        if (menu.eqPercentage && menu.eqPercentage > 0) {
          eqContribution += netPrice * (menu.eqPercentage / 100);
        }
      });
      return { aerationEqContribution: eqContribution };
    })();

    const netAerationSales = allBookingsForToday
      .filter((b) => !b.isContract)
      .reduce((sum, booking) => {
        const price = parseFloat(booking.Price || '0');
        let methodKey: string;
        const paymentMethod = (
          booking['Payment Method'] || 'Billed'
        ).toLowerCase();

        if (booking.Prepaid === 'x') methodKey = 'Prepaid';
        else if (paymentMethod.includes('cash')) methodKey = 'Cash';
        else if (paymentMethod.includes('cheque')) methodKey = 'Cheque';
        else if (paymentMethod.includes('transfer')) methodKey = 'E-Transfer';
        else if (paymentMethod.includes('credit')) methodKey = 'Credit Card';
        else methodKey = 'Billed';

        const methodSettings =
          payoutSettings.paymentMethodPercentages[methodKey];
        if (!methodSettings)
          return sum + price / (1 + payoutSettings.taxRate / 100);

        let adjustedValue = price * (methodSettings.percentage / 100);
        if (methodSettings.applyTaxes)
          adjustedValue /= 1 + payoutSettings.taxRate / 100;
        return sum + adjustedValue;
      }, 0);

    let totalNet = netAerationSales + aerationEqContribution;

    if (isTeamSeason) {
      const productCost = payoutSettings.productCost || 0;
      totalNet *= 1 - productCost / 100;
    }

    const equivalent = totalNet > 0 ? totalNet / 25 : 0;

    return { totalEquivalent: equivalent, totalGrossSales: gross };
  }, [workers, activeSeason, payoutSettings, displayDate]);

  const averageEQ = workers.length > 0 ? totalEquivalent / workers.length : 0;

  const handleNavigateToPayout = (workerId: string) => {
    navigate(`/console/payout/contractor/${workerId}`);
  };

  const handleNavigateToTeamPayout = (cart: {
    id: number;
    workers: Worker[];
  }) => {
    if (cart.workers && cart.workers.length > 0) {
      navigate(`/console/payout/cart/${cart.id}`);
    }
  };

  const handleModifyAttendance = () => {
    // <<< UPDATE to use displayDate
    setStorageItem(STORAGE_KEYS.ATTENDANCE_FINALIZED, null);
    setStorageItem(`attendanceFinalized_${displayDate}`, 'false');
    // <<< UPDATE to navigate to correct date view
    if (date) {
      navigate(`/console/workerbook/day/${date}`);
    } else {
      navigate('/console/workerbook');
    }
  };

  const carts: { id: number; workers: Worker[] }[] = workers
    .reduce((acc: { id: number; workers: Worker[] }[], worker) => {
      if (worker.cartId) {
        let cart = acc.find((c) => c.id === worker.cartId);
        if (!cart) {
          cart = { id: worker.cartId, workers: [] };
          acc.push(cart);
        }
        cart.workers.push(worker);
      }
      return acc;
    }, [])
    .sort((a, b) => a.id - b.id);

  const cartAverage =
    isTeamSeason && carts.length > 0 ? totalGrossSales / carts.length : 0;

  return (
    <div className="px-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-baseline gap-2">
          <h2 className="text-lg font-medium text-white">
            {/* <<< UPDATE to show correct date */}
            {date
              ? `Payout for ${format(parseISO(date), 'MMMM d')}`
              : "Today's Payout"}
          </h2>
          <span className="text-sm text-gray-400">
            ({workers.length} contractors)
          </span>
        </div>
        <div className="flex items-center gap-6 text-sm">
          {isTeamSeason && (
            <div className="text-center">
              <p className="text-xs text-gray-400">Cart Average</p>
              <p className="font-medium text-white">
                ${cartAverage.toFixed(2)}
              </p>
            </div>
          )}
          <div className="text-center">
            <p className="text-xs text-gray-400">Total Sales (Gross)</p>
            <p className="font-medium text-white">
              ${totalGrossSales.toFixed(2)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-400">Average EQ</p>
            <p className="font-medium text-white">{averageEQ.toFixed(2)}</p>
          </div>
          <button
            onClick={handleModifyAttendance}
            className="flex items-center gap-2 px-3 py-1.5 bg-gray-700 text-white rounded-md hover:bg-gray-600 transition-colors"
          >
            <Edit size={14} />
            <span className="text-sm">Modify Attendance</span>
          </button>
        </div>
      </div>

      {isTeamSeason ? (
        // Team Season View
        <div className="space-y-4">
          {carts.map((cart) => {
            const cartBookings = cart.workers.flatMap((w) =>
              getBookingsForContractor(w.contractorId)
            );
            const cartSteps = cartBookings.length;
            const cartSales = calculateGrossSales(cartBookings);
            const isCartPaid = cart.workers.every((w) => w.payoutCompleted);

            return (
              <div
                key={cart.id}
                className={`bg-gray-800 rounded-lg p-4 ${
                  isCartPaid ? 'border border-cps-green/50 bg-green-900/10' : ''
                }`}
              >
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-md font-bold text-white">
                    Cart #{cart.id}
                  </h3>
                  <div className="flex items-center gap-4 text-sm">
                    <span>
                      Steps: <span className="font-medium">{cartSteps}</span>
                    </span>
                    <span>
                      Gross:{' '}
                      <span className="font-medium">
                        ${cartSales.toFixed(2)}
                      </span>
                    </span>
                  </div>
                </div>
                <div className="space-y-2">
                  {cart.workers.map((member) => (
                    <div
                      key={member.contractorId}
                      className="bg-gray-700/50 p-2 rounded-md flex justify-between items-center"
                    >
                      <span className="text-sm text-gray-300">
                        {member.firstName} {member.lastName}
                      </span>
                      {isCartPaid && (
                        <div className="flex items-center gap-4 text-xs">
                          <span>
                            EQ:{' '}
                            <span className="font-medium text-gray-200">
                              {member.equivalent?.toFixed(2)}
                            </span>
                          </span>
                          <div className="flex items-center gap-1 px-2 py-0.5 bg-cps-green/20 text-green-300 rounded">
                            <DollarSign size={12} />
                            <span>${member.commission?.toFixed(2)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex justify-end">
                  <button
                    onClick={() => handleNavigateToTeamPayout(cart)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-cps-green text-white rounded hover:bg-green-700 transition-colors text-sm"
                  >
                    <CheckCircle2 size={14} />
                    {isCartPaid ? 'Modify Payout' : 'Complete Team Payout'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        // Individual Season View
        <div className="space-y-2">
          {workers.map((member) => {
            const contractorBookings = getBookingsForContractor(
              member.contractorId
            );
            const stepCount = contractorBookings.length;
            const grossSales = member.payoutCompleted
              ? member.grossSales
              : calculateGrossSales(contractorBookings);
            const equivalent = member.payoutCompleted
              ? member.equivalent
              : totalEquivalent / workers.length; // Use the averaged correct EQ

            return (
              <div
                key={member.contractorId}
                onClick={
                  member.payoutCompleted
                    ? () => handleNavigateToPayout(member.contractorId)
                    : undefined
                }
                className={`bg-gray-800/90 backdrop-blur-sm rounded-md px-3 py-2 flex items-center justify-between transition-colors border border-gray-700/50 shadow-sm ${
                  member.payoutCompleted
                    ? 'border-cps-green/50 bg-green-900/10 hover:bg-green-900/20 cursor-pointer'
                    : 'hover:border-gray-600'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-cps-blue flex items-center justify-center text-xs font-medium text-white">
                    {member.routeManager?.initials || '??'}
                  </div>
                  <span className="text-sm text-gray-200">
                    {member.firstName} {member.lastName}
                  </span>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-200 font-medium">
                      {stepCount}
                    </span>
                    <span className="text-gray-500">•</span>
                    <span className="text-gray-200">
                      ${(grossSales ?? 0).toFixed(2)}
                    </span>
                    <span className="text-gray-500">•</span>
                    <span className="text-gray-200">
                      {(equivalent ?? 0).toFixed(2)}EQ
                    </span>
                  </div>

                  {member.payoutCompleted ? (
                    <div className="flex items-center gap-1 px-2 py-0.5 bg-cps-green/20 text-green-300 rounded text-xs">
                      <DollarSign size={12} />
                      <span>${(member.commission ?? 0).toFixed(2)}</span>
                    </div>
                  ) : (
                    <button
                      onClick={() =>
                        handleNavigateToPayout(member.contractorId)
                      }
                      className="flex items-center gap-1 px-2 py-0.5 bg-cps-green text-white rounded hover:bg-green-700 transition-colors text-xs"
                    >
                      <CheckCircle2 size={12} />
                      <span>Complete</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {workers.length === 0 && (
        <div className="text-center text-gray-400 py-12">
          No contractors showed up today.
        </div>
      )}
    </div>
  );
};

export default PayoutToday;