// src/pages/Management/ConsoleWorkerbook.tsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  X,
  Loader,
  AlertCircle,
  Info,
  User,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  DollarSign,
  Edit,
  Clock,
  Calendar,
  PhoneOff,
  UserX,
  Download,
  UserPlus,
} from 'lucide-react';
import { format, addDays, addMonths, subMonths, isPast, parseISO } from 'date-fns';
import { getCurrentDate } from '../../lib/date';
import {
  RouteManager,
  getAssignableRouteManagers,
} from '../../lib/routeManagers';
import * as bookingHelpers from '../../lib/bookingStoreHelpers';
import {
  MasterBooking,
  ConsoleProfile,
  Worker,
  Cart,
  PayoutLogicSettings,
  HardcodedSeason,
} from '../../types';
import {
  getStorageItem,
  setStorageItem,
  STORAGE_KEYS,
} from '../../lib/localStorage';
import {
  getSeasonConfigById,
  defaultPayoutLogicSettings,
} from '../../lib/hardcodedData';
import Papa from 'papaparse';

type WorkerbookTab =
  | 'Today'
  | 'Next Day'
  | 'Calendar'
  | 'No Shows'
  | 'WDR/TNB'
  | 'Quit/Fired'
  | 'Import';

const TABS: WorkerbookTab[] = [
  'Today',
  'Next Day',
  'Calendar',
  'No Shows',
  'WDR/TNB',
  'Quit/Fired',
  'Import',
];

const ConsoleWorkerbook: React.FC = () => {
  const { consoleProfileId } = useParams<{ consoleProfileId: string }>();
  const navigate = useNavigate();
  const numConsoleId = parseInt(consoleProfileId || '0', 10);

  // --- State ---
  const [activeTab, setActiveTab] = useState<WorkerbookTab>('Today');
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [allBookings, setAllBookings] = useState<MasterBooking[]>([]);
  const [consoleProfile, setConsoleProfile] = useState<ConsoleProfile | null>(
    null
  );
  const [activeSeason, setActiveSeason] = useState<HardcodedSeason | null>(
    null
  );
  const [payoutSettings, setPayoutSettings] = useState<PayoutLogicSettings>(
    defaultPayoutLogicSettings
  );
  const [carts, setCarts] = useState<Cart[]>([]);
  const [cartCount, setCartCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attendanceFinalized, setAttendanceFinalized] =
    useState<boolean>(false);
  const [assignableManagers, setAssignableManagers] = useState<RouteManager[]>(
    []
  );
  const [selectedWorkerForAssignment, setSelectedWorkerForAssignment] =
    useState<string | null>(null);
  const [cartToAssign, setCartToAssign] = useState<number | null>(null);

  // --- Modals State ---
  const [showRebookModal, setShowRebookModal] = useState(false);
  const [workerToRebook, setWorkerToRebook] = useState<string | null>(null);
  const [rebookCalendarDate, setRebookCalendarDate] = useState(new Date());
  const [selectedWorkers, setSelectedWorkers] = useState<Set<string>>(
    new Set()
  );
  const [showMoveWorkersModal, setShowMoveWorkersModal] = useState(false);
  const [moveWorkersCalendarDate, setMoveWorkersCalendarDate] = useState(
    new Date()
  );
  // --- End State ---

  const today = format(getCurrentDate(), 'yyyy-MM-dd');

  // --- Data Loading ---
  const loadData = useCallback(() => {
    try {
      if (isNaN(numConsoleId) || numConsoleId === 0)
        throw new Error('Invalid Console Profile ID.');

      // Load all data
      const allWorkers = getStorageItem<Worker[]>(
        STORAGE_KEYS.CONSOLE_WORKERS,
        []
      );
      const allProfiles = getStorageItem<ConsoleProfile[]>(
        STORAGE_KEYS.CONSOLE_PROFILES,
        []
      );
      const allCarts = getStorageItem<Cart[]>(STORAGE_KEYS.CONSOLE_CARTS, []);
      const activeSeasonId = getStorageItem(
        STORAGE_KEYS.ACTIVE_SEASON_ID,
        null
      );
      const finalizedDate = getStorageItem(
        STORAGE_KEYS.ATTENDANCE_FINALIZED,
        null
      );

      // Set Console Profile
      const profile = allProfiles.find((p) => p.id === numConsoleId);
      if (!profile) throw new Error('Console Profile not found.');
      setConsoleProfile(profile);

      // Set Active Season and Payout Logic
      const hcSeason = getSeasonConfigById(activeSeasonId);
      if (!hcSeason) throw new Error('Active season not found.');
      setActiveSeason(hcSeason);

      const configuredSeason = profile.seasons.find(
        (s) => s.hardcodedId === activeSeasonId
      );
      setPayoutSettings(
        configuredSeason?.payoutLogic || defaultPayoutLogicSettings
      );

      // Set Data
      setWorkers(allWorkers);
      setCarts(allCarts);
      setCartCount(allCarts.length);
      setAssignableManagers(getAssignableRouteManagers(numConsoleId));
      setAttendanceFinalized(finalizedDate === today);

      // Load bookings for this console and season
      const bookings = bookingHelpers.getBookingsForConsoleSeason(
        numConsoleId,
        hcSeason.id
      );
      setAllBookings(bookings);
    } catch (err) {
      console.error('Error loading workerbook data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [numConsoleId, today]);

  useEffect(() => {
    loadData();
    const handleStorageUpdate = (event: any) => {
      const key = event?.detail?.key;
      if (
        key === STORAGE_KEYS.CONSOLE_WORKERS ||
        key === STORAGE_KEYS.CONSOLE_PROFILES ||
        key === STORAGE_KEYS.CONSOLE_CARTS ||
        key === STORAGE_KEYS.ACTIVE_SEASON_ID ||
        key === STORAGE_KEYS.ATTENDANCE_FINALIZED ||
        key?.startsWith('bookings_')
      ) {
        loadData();
      }
    };
    window.addEventListener('storageUpdated', handleStorageUpdate);
    return () => {
      window.removeEventListener('storageUpdated', handleStorageUpdate);
    };
  }, [loadData]);

  // --- Payout Calculations (from PayoutToday) ---
  const { totalEquivalent, totalGrossSales } = useMemo(() => {
    const showedWorkers = workers.filter(
      (w) => w.showed && w.showedDate === today
    );
    if (showedWorkers.length === 0 || !activeSeason) {
      return { totalEquivalent: 0, totalGrossSales: 0 };
    }

    const allBookingsForToday = allBookings.filter(
      (b) =>
        b['Completed'] === 'x' &&
        b['Date Completed']?.startsWith(today) &&
        showedWorkers.some((w) => w.contractorId === b['Contractor Number'])
    );
    const gross = allBookingsForToday.reduce(
      (sum, b) => sum + parseFloat(b.Price || '0'),
      0
    );

    const getNetSales = (b: MasterBooking) => {
      const price = parseFloat(b.Price || '0');
      let methodKey: string = 'Custom';
      const paymentMethod = (b['Payment Method'] || '').toLowerCase();
      if (b.Prepaid === 'x') methodKey = 'Prepaid';
      else if (paymentMethod.includes('cash')) methodKey = 'Cash';
      else if (paymentMethod.includes('cheque')) methodKey = 'Cheque';
      else if (paymentMethod.includes('transfer')) methodKey = 'E-Transfer';
      else if (paymentMethod.includes('credit')) methodKey = 'Credit Card';
      else if (paymentMethod.includes('billed')) methodKey = 'Billed';
      else if (paymentMethod.includes('ios')) methodKey = 'IOS';

      const methodSettings = payoutSettings.paymentMethodPercentages[methodKey];
      if (!methodSettings)
        return price / (1 + payoutSettings.taxRate / 100);
      let adjValue = price * (methodSettings.percentage / 100);
      if (methodSettings.applyTaxes)
        adjValue /= 1 + payoutSettings.taxRate / 100;
      return adjValue;
    };

    let totalNet = 0;
    allBookingsForToday.forEach((b) => {
      totalNet += getNetSales(b);
    });

    if (activeSeason.type === 'Team') {
      totalNet *= 1 - (payoutSettings.productCost || 0) / 100;
    }

    const equivalent = totalNet > 0 ? totalNet / 25 : 0;
    return { totalEquivalent: equivalent, totalGrossSales: gross };
  }, [workers, allBookings, activeSeason, payoutSettings, today]);
  // --- End Payout Calcs ---

  // --- Filtered Worker Lists ---
  const todayWorkers = useMemo(
    () =>
      workers.filter((w) => {
        const isBookedToday =
          (w.bookingStatus === 'today' || w.bookingStatus === 'calendar') &&
          w.bookedDate === today;
        const showedToday = w.showed && w.showedDate === today;
        return isBookedToday || showedToday;
      }),
    [workers, today]
  );
  const showedWorkers = useMemo(
    () => todayWorkers.filter((w) => w.showed && w.showedDate === today),
    [todayWorkers, today]
  );
  const bookedWorkers = useMemo(
    () =>
      todayWorkers
        .filter((w) => !w.showed || w.showedDate !== today)
        .sort((a, b) => a.lastName.localeCompare(b.lastName)),
    [todayWorkers, today]
  );
  const nextDayWorkers = useMemo(() => {
    const tomorrow = format(addDays(getCurrentDate(), 1), 'yyyy-MM-dd');
    return workers
      .filter(
        (w) =>
          w.bookingStatus === 'next_day' ||
          (w.bookingStatus === 'calendar' && w.bookedDate === tomorrow)
      )
      .map((worker) => ({
        ...worker,
        confirmationStatus: {
          ...worker.confirmationStatus,
          confirmed:
            (worker.showedDate === today &&
              worker.bookingStatus === 'next_day') || // Auto-confirm if they worked today and are 'next_day'
            worker.confirmationStatus?.confirmed,
        },
      }))
      .sort((a, b) => a.lastName.localeCompare(b.lastName));
  }, [workers, today]);
  const calendarWorkers = useMemo(() => {
    const grouped: Record<string, Worker[]> = {};
    workers
      .filter(
        (w) =>
          w.bookingStatus === 'calendar' &&
          w.bookedDate &&
          w.bookedDate > format(addDays(getCurrentDate(), 1), 'yyyy-MM-dd')
      )
      .sort((a, b) => a.lastName.localeCompare(b.lastName))
      .forEach((w) => {
        if (!grouped[w.bookedDate!]) grouped[w.bookedDate!] = [];
        grouped[w.bookedDate!].push(w);
      });
    return Object.entries(grouped).sort(
      ([dateA], [dateB]) =>
        parseISO(dateA).getTime() - parseISO(dateB).getTime()
    );
  }, [workers]);
  const noShowWorkers = useMemo(
    () =>
      workers
        .filter((w) => w.bookingStatus === 'no_show')
        .sort((a, b) => (b.noShows || 0) - (a.noShows || 0)),
    [workers]
  );
  const wdrTnbWorkers = useMemo(
    () => workers.filter((w) => w.bookingStatus === 'wdr_tnb'),
    [workers]
  );
  const quitFiredWorkers = useMemo(
    () => workers.filter((w) => w.bookingStatus === 'quit_fired'),
    [workers]
  );
  const notBookedWorkers = useMemo(
    () =>
      workers
        .filter((w) => !w.bookingStatus)
        .sort((a, b) => a.lastName.localeCompare(b.lastName)),
    [workers]
  );
  // --- End Filtered Lists ---

  // --- Handlers ---
  const saveWorkers = (updatedWorkers: Worker[]) => {
    setWorkers(updatedWorkers);
    setStorageItem(STORAGE_KEYS.CONSOLE_WORKERS, updatedWorkers);
  };
  const saveCarts = (updatedCarts: Cart[]) => {
    setCarts(updatedCarts);
    setStorageItem(STORAGE_KEYS.CONSOLE_CARTS, updatedCarts);
  };
  const createCarts = () => {
    let newCarts: Cart[] = [];
    if (cartCount > 0) {
      newCarts = Array.from({ length: cartCount }, (_, i) => {
        const existingCart = carts.find((c) => c.id === i + 1);
        return existingCart || { id: i + 1, workers: [] };
      });
    }
    saveCarts(newCarts);
  };
  const handleFinalizeAttendance = () => {
    const unassignedCount = showedWorkers.filter(
      (w) => !w.routeManager && !w.cartId
    ).length;
    if (unassignedCount > 0) {
      setError(
        `${unassignedCount} worker(s) still need to be assigned to a Cart or RM.`
      );
      return;
    }
    setStorageItem(STORAGE_KEYS.ATTENDANCE_FINALIZED, today);
    setStorageItem(`attendanceFinalized_${today}`, 'true');
    setAttendanceFinalized(true);
    const updatedWorkers = workers.map((worker) => {
      if (
        (worker.bookingStatus === 'today' ||
          (worker.bookingStatus === 'calendar' &&
            worker.bookedDate === today)) &&
        (!worker.showed || worker.showedDate !== today)
      ) {
        return {
          ...worker,
          bookingStatus: 'no_show',
          noShows: (worker.noShows || 0) + 1,
          routeManager: undefined,
          cartId: null,
        };
      }
      return worker;
    });
    saveWorkers(updatedWorkers);
    setError(null);
  };
  const handleModifyAttendance = () => {
    setStorageItem(STORAGE_KEYS.ATTENDANCE_FINALIZED, null);
    setStorageItem(`attendanceFinalized_${today}`, 'false');
    setAttendanceFinalized(false);
  };
  const handleMarkShowed = (workerId: string) => {
    const updatedWorkers = workers.map((w: Worker) => {
      if (w.contractorId === workerId) {
        const shouldIncrementDays = !w.showed || w.showedDate !== today;
        const currentDaysWorked = w.daysWorked || 0;
        return {
          ...w,
          showed: true,
          showedDate: today,
          daysWorked: shouldIncrementDays
            ? currentDaysWorked + 1
            : currentDaysWorked,
        };
      }
      return w;
    });
    saveWorkers(updatedWorkers);
    setWorkerToRebook(workerId);
    setShowRebookModal(true);
  };
  const handleRebookDateClick = (day: number) => {
    const selectedDate = new Date(
      rebookCalendarDate.getFullYear(),
      rebookCalendarDate.getMonth(),
      day
    );
    const formattedDate = format(selectedDate, 'yyyy-MM-dd');
    const updatedWorkers = workers.map((w: Worker) => {
      if (w.contractorId === workerToRebook) {
        return {
          ...w,
          bookingStatus: 'calendar',
          bookedDate: formattedDate,
        };
      }
      return w;
    });
    saveWorkers(updatedWorkers);
    setShowRebookModal(false);
    setWorkerToRebook(null);
  };
  const handleRebookWDRClick = () => {
    const updatedWorkers = workers.map((w: Worker) => {
      if (w.contractorId === workerToRebook) {
        return {
          ...w,
          bookingStatus: 'wdr_tnb',
          subStatus: 'WDR',
          bookedDate: undefined,
        };
      }
      return w;
    });
    saveWorkers(updatedWorkers);
    setShowRebookModal(false);
    setWorkerToRebook(null);
  };
  const handleDragStart = (
    e: React.DragEvent<HTMLDivElement>,
    workerId: string
  ) => e.dataTransfer.setData('workerId', workerId);
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) =>
    e.preventDefault();
  const handleDrop = (e: React.DragEvent<HTMLDivElement>, cartId: number | null) => {
    e.preventDefault();
    const workerId = e.dataTransfer.getData('workerId');
    const updatedWorkers = workers.map((w) => {
      if (w.contractorId === workerId) return { ...w, cartId: cartId };
      return w;
    });
    saveWorkers(updatedWorkers);
  };
  const handleRouteManagerAssignment = (
    workerId: string,
    manager: RouteManager
  ) => {
    const updatedWorkers = workers.map((w) => {
      if (w.contractorId === workerId) {
        return {
          ...w,
          routeManager: manager.name === 'Unassigned' ? undefined : manager,
        };
      }
      return w;
    });
    saveWorkers(updatedWorkers);
    setSelectedWorkerForAssignment(null);
  };
  const handleCartManagerAssignment = (manager: RouteManager) => {
    if (cartToAssign === null) return;
    const updatedCarts = carts.map((cart) => {
      if (cart.id === cartToAssign) {
        return {
          ...cart,
          routeManager: manager.name === 'Unassigned' ? undefined : manager,
        };
      }
      return cart;
    });
    saveCarts(updatedCarts);
    setCartToAssign(null);
  };
  const handleNextDayStatusClick = (
    workerId: string,
    status: 'confirmed' | 'leftMessage' | 'notAvailable',
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    const updatedWorkers = workers.map((worker) => {
      if (worker.contractorId === workerId) {
        const currentStatus = worker.confirmationStatus || {};
        if (status === 'confirmed')
          return {
            ...worker,
            confirmationStatus: {
              ...currentStatus,
              confirmed: !currentStatus.confirmed,
            },
          };
        if (status === 'leftMessage')
          return {
            ...worker,
            confirmationStatus: {
              ...currentStatus,
              leftMessage: (currentStatus.leftMessage || 0) + 1,
            },
          };
        return {
          ...worker,
          confirmationStatus: {
            ...currentStatus,
            notAvailable: (currentStatus.notAvailable || 0) + 1,
          },
        };
      }
      return worker;
    });
    saveWorkers(updatedWorkers);
  };
  const handleImport = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        'https://docs.google.com/spreadsheets/d/1KPRTH3bESAi-0-2K9v1b-hOUGdCqzLD0D4mdKCSMs-0/gviz/tq?tqx=out:csv&sheet=Workers'
      );
      if (!response.ok) throw new Error('Failed to fetch workers data');
      const text = await response.text();
      const result = Papa.parse(text, { header: false, skipEmptyLines: true });
      if (!result.data || !Array.isArray(result.data))
        throw new Error('Invalid data format received');

      const existingWorkersMap = new Map(
        workers.map((worker: Worker) => [worker.contractorId, worker])
      );
      const newWorkers = result.data
        .slice(1)
        .filter((row: any) => {
          const contractorId = row[0]?.toString().trim();
          return contractorId && !existingWorkersMap.has(contractorId);
        })
        .map(
          (row: any) =>
            ({
              contractorId: row[0]?.toString().trim() || '',
              firstName: row[1]?.toString().trim() || '',
              lastName: row[2]?.toString().trim() || '',
              cellPhone: (row[3]?.toString().trim() || '').replace(/\D/g, ''),
              homePhone: (row[4]?.toString().trim() || '').replace(/\D/g, ''),
              email: row[5]?.toString().trim() || '',
              address: row[6]?.toString().trim() || '',
              city: row[7]?.toString().trim() || '',
              status:
                row[8]?.toString().trim().toLowerCase() === 'alumni'
                  ? 'Alumni'
                  : 'Rookie',
              daysWorkedPreviousYears: row[9]?.toString().trim() || '0',
              aerationSilversPreviousYears: row[10]?.toString().trim() || '0',
              rejuvSilversPreviousYears: row[11]?.toString().trim() || '0',
              sealingSilversPreviousYears: row[12]?.toString().trim() || '0',
              cleaningSilversPreviousYears: row[13]?.toString().trim() || '0',
              shuttleLine: row[14]?.toString().trim() || '',
            } as Worker)
        );
      saveWorkers([...workers, ...newWorkers]);
      setError(null);
    } catch (err) {
      console.error('Error importing workers:', err);
      setError(
        err instanceof Error ? err.message : 'Failed to import workers'
      );
    } finally {
      setLoading(false);
    }
  };
  const handleMoveWorkersToDate = (day: number) => {
    const selectedDate = new Date(
      moveWorkersCalendarDate.getFullYear(),
      moveWorkersCalendarDate.getMonth(),
      day
    );
    const formattedDate = format(selectedDate, 'yyyy-MM-dd');
    const updatedWorkers = workers.map((worker: Worker) => {
      if (selectedWorkers.has(worker.contractorId)) {
        return {
          ...worker,
          bookingStatus: 'calendar',
          bookedDate: formattedDate,
        };
      }
      return worker;
    });
    saveWorkers(updatedWorkers);
    setSelectedWorkers(new Set());
    setShowMoveWorkersModal(false);
  };
  const handleMoveWorkersToStatus = (
    status: 'wdr_tnb' | 'quit_fired',
    subStatus: 'WDR' | 'TNB' | 'Quit' | 'Fired'
  ) => {
    const updatedWorkers = workers.map((worker: Worker) => {
      if (selectedWorkers.has(worker.contractorId)) {
        return {
          ...worker,
          bookingStatus: status,
          subStatus: subStatus,
          bookedDate: undefined,
        };
      }
      return worker;
    });
    saveWorkers(updatedWorkers);
    setSelectedWorkers(new Set());
    setShowMoveWorkersModal(false);
  };
  const toggleWorkerSelection = (workerId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSelected = new Set(selectedWorkers);
    if (newSelected.has(workerId)) newSelected.delete(workerId);
    else newSelected.add(workerId);
    setSelectedWorkers(newSelected);
  };
  // --- End Handlers ---

  // --- Render Helpers ---
  const getStatusBadge = (status: string, worker: Worker) => {
    const badgeWidth = 'w-[4.5rem]';
    switch (status.toLowerCase()) {
      case 'alumni': {
        const totalDays =
          parseInt(worker.daysWorkedPreviousYears || '0', 10) +
          (worker.daysWorked || 0);
        return (
          <div className={`flex flex-col items-center ${badgeWidth}`}>
            <span className="text-[11px] w-full text-center px-2 py-0.5 bg-purple-900/20 text-purple-300 rounded">
              Alumni
            </span>
            <span className="text-[10px] w-full text-center -mt-0.5 px-2 py-0.5 bg-purple-900/20 text-purple-300 rounded-b">
              {totalDays}d
            </span>
          </div>
        );
      }
      case 'rookie':
        return (
          <div className={`flex flex-col items-center ${badgeWidth}`}>
            <span className="text-[11px] w-full text-center px-2 py-0.5 bg-green-900/20 text-green-300 rounded">
              Rookie
            </span>
            <span className="text-[10px] w-full text-center -mt-0.5 px-2 py-0.5 bg-green-900/20 text-green-300 rounded-b">
              {worker.daysWorked || 0}d
            </span>
          </div>
        );
      default:
        return null;
    }
  };
  const getShuttleColor = (shuttle?: string) => {
    if (!shuttle) return 'bg-gray-700 text-gray-400';
    const letter = shuttle.charAt(0).toUpperCase();
    switch (letter) {
      case 'R': return 'bg-red-500/30 text-red-300';
      case 'G': return 'bg-green-500/30 text-green-300';
      case 'B': return 'bg-blue-500/30 text-blue-300';
      case 'Y': return 'bg-yellow-500/30 text-yellow-300';
      default: return 'bg-gray-700 text-gray-400';
    }
  };
  const renderMiniCalendar = (
    date: Date,
    setter: (d: Date) => void,
    handler: (day: number) => void
  ) => {
    const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    const startDay = new Date(date.getFullYear(), date.getMonth(), 1).getDay();
    const weeks = [];
    let week = [];
    for (let i = 0; i < startDay; i++) week.push(<td key={`e-${i}`}></td>);
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(date.getFullYear(), date.getMonth(), day);
      const isToday = format(d, 'yyyy-MM-dd') === today;
      const isDisabled = isPast(d) && !isToday;
      week.push(
        <td key={day}>
          <button
            onClick={() => handler(day)}
            disabled={isDisabled}
            className={`w-10 h-10 flex items-center justify-center rounded-full text-sm ${
              isDisabled
                ? 'text-gray-600 cursor-not-allowed'
                : isToday
                ? 'bg-cps-blue text-white font-bold hover:bg-blue-700'
                : 'text-gray-300 hover:bg-gray-700'
            }`}
          >
            {day}
          </button>
        </td>
      );
      if ((startDay + day) % 7 === 0 || day === daysInMonth) {
        weeks.push(<tr key={day}>{week}</tr>);
        week = [];
      }
    }
    return (
      <div className="bg-gray-800 rounded-lg p-4 w-[380px] space-y-4">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setter(subMonths(date, 1))}
            className="p-1 hover:bg-gray-700 rounded-full text-gray-400"
          >
            <ChevronLeft size={20} />
          </button>
          <h3 className="text-sm font-medium text-gray-300">
            {format(date, 'MMMM yyyy')}
          </h3>
          <button
            onClick={() => setter(addMonths(date, 1))}
            className="p-1 hover:bg-gray-700 rounded-full text-gray-400"
          >
            <ChevronRight size={20} />
          </button>
        </div>
        <table className="w-full text-center">
          <thead>
            <tr>
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d) => (
                <th key={d} className="text-xs text-gray-500 w-10 h-10">
                  {d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>{weeks}</tbody>
        </table>
      </div>
    );
  };
  // --- End Render Helpers ---

  // --- Render Tabs ---
  const renderToday = () => {
    const isTeamSeason = activeSeason?.type === 'Team';
    const averageEQ =
      showedWorkers.length > 0
        ? totalEquivalent / showedWorkers.length
        : 0;
    const cartAverage =
      isTeamSeason && carts.length > 0 ? totalGrossSales / carts.length : 0;

    // Content for when attendance is *not* finalized
    const attendanceContent = (
      <div
        className={`h-[calc(100vh-13rem)] flex ${
          isTeamSeason ? 'bg-black' : 'bg-[#1a2832]'
        }`}
      >
        {isTeamSeason && (
          <div className="w-1/2 bg-gray-900/50 p-4 space-y-4 overflow-y-auto">
            <h3 className="text-lg font-medium text-white">Carts</h3>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={cartCount}
                onChange={(e) =>
                  setCartCount(parseInt(e.target.value, 10) || 0)
                }
                className="input w-20"
                placeholder="Qty"
              />
              <button
                onClick={createCarts}
                className="bg-cps-blue text-white rounded-md px-3 py-1 text-sm"
              >
                Create
              </button>
            </div>
            <div className="space-y-2">
              {carts.map((cart) => (
                <div
                  key={cart.id}
                  onDrop={(e) => handleDrop(e, cart.id)}
                  onDragOver={handleDragOver}
                  className="bg-gray-800 p-2 rounded-md border-2 border-dashed border-gray-700 min-h-[60px]"
                >
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="text-sm font-bold text-white">
                      Cart #{cart.id}
                    </h4>
                    <button
                      onClick={() => setCartToAssign(cart.id)}
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium text-white ${
                        cart.routeManager?.initials
                          ? 'bg-cps-blue hover:bg-blue-700'
                          : 'bg-gray-700 hover:bg-gray-600 text-gray-400'
                      }`}
                    >
                      {cart.routeManager?.initials || '?'}
                    </button>
                  </div>
                  <div className="space-y-1">
                    {workers
                      .filter((w) => w.cartId === cart.id)
                      .map((w) => (
                        <div
                          key={w.contractorId}
                          draggable
                          onDragStart={(e) =>
                            handleDragStart(e, w.contractorId)
                          }
                          className="bg-gray-700 p-1 rounded text-xs text-white cursor-grab"
                        >
                          {w.firstName} {w.lastName}
                        </div>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div
          className={
            isTeamSeason
              ? 'w-1/2 overflow-y-auto'
              : 'flex-1 overflow-y-auto'
          }
          onDrop={(e) => handleDrop(e, null)}
          onDragOver={handleDragOver}
        >
          <div className="px-6 pb-6">
            <div className="space-y-4">
              {bookedWorkers.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-gray-400 py-2">
                    Not Showed ({bookedWorkers.length})
                  </h3>
                  {bookedWorkers.map((member) => (
                    <div
                      key={member.contractorId}
                      onClick={() =>
                        navigate(
                          `/console/workerbook/${numConsoleId}/detail/${member.contractorId}`
                        )
                      }
                      className="w-full bg-gray-800 rounded-lg px-6 py-3 border border-gray-700/50 hover:bg-gray-700/80 cursor-pointer"
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex-1 flex items-center">
                          <div
                            className={`h-5 w-8 rounded flex items-center justify-center text-[10px] font-medium ${getShuttleColor(
                              member.shuttleLine
                            )}`}
                          >
                            {member.shuttleLine || '--'}
                          </div>
                          <div className="w-48 ml-4">
                            <span className="text-sm text-gray-300">
                              {member.firstName} {member.lastName}
                            </span>
                          </div>
                          <div className="w-32">
                            <span className="text-sm font-medium text-gray-300">
                              {member.cellPhone}
                            </span>
                          </div>
                          {getStatusBadge(member.status, member)}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMarkShowed(member.contractorId);
                            }}
                            className="px-3 py-1.5 bg-cps-blue text-white rounded-md hover:bg-blue-700 text-sm"
                          >
                            Mark Showed
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {showedWorkers.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-gray-400 py-2">
                    Showed ({showedWorkers.length})
                  </h3>
                  {showedWorkers.map((member) => (
                    <div
                      key={member.contractorId}
                      draggable={isTeamSeason}
                      onDragStart={(e) =>
                        handleDragStart(e, member.contractorId)
                      }
                      onClick={() =>
                        navigate(
                          `/console/workerbook/${numConsoleId}/detail/${member.contractorId}`
                        )
                      }
                      className={`w-full bg-green-900/20 rounded-lg px-6 py-3 border border-green-900/30 hover:bg-green-900/30 cursor-pointer ${
                        isTeamSeason ? 'cursor-grab' : ''
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex-1 flex items-center">
                          <div
                            className={`h-5 w-8 rounded flex items-center justify-center text-[10px] font-medium ${getShuttleColor(
                              member.shuttleLine
                            )}`}
                          >
                            {member.shuttleLine || '--'}
                          </div>
                          <div className="w-48 ml-4">
                            <span className="text-sm text-gray-300">
                              {member.firstName} {member.lastName}
                            </span>
                          </div>
                          <div className="w-32">
                            <span className="text-sm font-medium text-gray-300">
                              {member.cellPhone}
                            </span>
                          </div>
                          {getStatusBadge(member.status, member)}
                        </div>
                        {!isTeamSeason && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedWorkerForAssignment(
                                member.contractorId
                              );
                            }}
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium text-white ${
                              member.routeManager?.initials
                                ? 'bg-cps-blue hover:bg-blue-700'
                                : 'bg-gray-700 hover:bg-gray-600 text-gray-400'
                            }`}
                          >
                            {member.routeManager?.initials || '?'}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );

    // Content for when attendance *is* finalized
    const payoutContent = (
      <div className="px-6 overflow-y-auto h-[calc(100vh-13rem)]">
        {isTeamSeason ? (
          // Team Payout View
          <div className="space-y-4">
            {carts.map((cart) => {
              const cartWorkers = workers.filter(
                (w) => w.cartId === cart.id && w.showedDate === today
              );
              if (cartWorkers.length === 0) return null;
              const cartBookings = cartWorkers.flatMap((w) =>
                allBookings.filter(
                  (b) =>
                    b['Contractor Number'] === w.contractorId &&
                    b['Completed'] === 'x' &&
                    b['Date Completed']?.startsWith(today)
                )
              );
              const cartSteps = cartBookings.length;
              const cartSales = cartBookings.reduce(
                (sum, b) => sum + parseFloat(b.Price || '0'),
                0
              );
              const isCartPaid = cartWorkers.every((w) => w.payoutCompleted);

              return (
                <div
                  key={cart.id}
                  className={`bg-gray-800 rounded-lg p-4 ${
                    isCartPaid
                      ? 'border border-cps-green/50 bg-green-900/10'
                      : ''
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
                    {cartWorkers.map((member) => (
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
                      onClick={() =>
                        navigate(
                          `/console/workerbook/${numConsoleId}/payout/cart/${cart.id}`
                        )
                      }
                      className="flex items-center gap-1 px-3 py-1.5 bg-cps-green text-white rounded hover:bg-green-700 text-sm"
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
          // Individual Payout View
          <div className="space-y-2">
            {showedWorkers.map((member) => {
              const contractorBookings = allBookings.filter(
                (b) =>
                  b['Contractor Number'] === member.contractorId &&
                  b['Completed'] === 'x' &&
                  b['Date Completed']?.startsWith(today)
              );
              const stepCount = contractorBookings.length;
              return (
                <div
                  key={member.contractorId}
                  onClick={
                    member.payoutCompleted
                      ? () =>
                          navigate(
                            `/console/workerbook/${numConsoleId}/payout/contractor/${member.contractorId}`
                          )
                      : undefined
                  }
                  className={`bg-gray-800/90 rounded-md px-3 py-2 flex items-center justify-between border ${
                    member.payoutCompleted
                      ? 'border-cps-green/50 bg-green-900/10 hover:bg-green-900/20 cursor-pointer'
                      : 'border-gray-700/50 hover:border-gray-600'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-6 h-6 rounded-full bg-cps-blue flex items-center justify-center text-xs font-medium text-white"
                      title={member.routeManager?.name}
                    >
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
                        ${(member.grossSales ?? 0).toFixed(2)}
                      </span>
                      <span className="text-gray-500">•</span>
                      <span className="text-gray-200">
                        {(member.equivalent ?? 0).toFixed(2)}EQ
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
                          navigate(
                            `/console/workerbook/${numConsoleId}/payout/contractor/${member.contractorId}`
                          )
                        }
                        className="flex items-center gap-1 px-2 py-0.5 bg-cps-green text-white rounded hover:bg-green-700 text-xs"
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
      </div>
    );

    return (
      <div className="h-[calc(100vh-8rem)] flex flex-col">
        {/* Header */}
        <div className="flex-none bg-[#1a2832] z-10 px-6 py-3 border-b border-gray-700">
          <div className="flex justify-between items-center">
            <div className="flex items-baseline gap-4">
              <div className="flex items-baseline gap-2">
                <span className="text-lg font-bold text-gray-300">
                  {showedWorkers.length}
                </span>
                <span className="text-sm text-gray-400">Showed</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-lg font-bold text-gray-300">
                  {bookedWorkers.length}
                </span>
                <span className="text-sm text-gray-400">Booked</span>
              </div>
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
                <p className="font-medium text-white">
                  {averageEQ.toFixed(2)}
                </p>
              </div>
              <button
                onClick={
                  attendanceFinalized
                    ? handleModifyAttendance
                    : handleFinalizeAttendance
                }
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md transition-colors ${
                  attendanceFinalized
                    ? 'bg-gray-700 text-white hover:bg-gray-600'
                    : 'bg-cps-green text-white hover:bg-green-700'
                }`}
              >
                <Edit size={14} />
                <span className="text-sm">
                  {attendanceFinalized
                    ? 'Modify Attendance'
                    : 'Finalize Attendance'}
                </span>
              </button>
            </div>
          </div>
          {error && (
            <div className="mt-2 text-sm text-red-400 flex items-center gap-2">
              <AlertCircle size={16} /> <span>{error}</span>
            </div>
          )}
        </div>
        {/* Content */}
        {attendanceFinalized ? payoutContent : attendanceContent}
      </div>
    );
  };
  const renderNextDay = () => (
    <div className="px-6 h-[calc(100vh-13rem)] overflow-y-auto">
      <div className="space-y-6">
        {notConfirmedWorkers.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-gray-400 py-2">
              Not Confirmed ({notConfirmedWorkers.length})
            </h3>
            {notConfirmedWorkers.map((member) => (
              <div
                key={member.contractorId}
                onClick={() =>
                  navigate(
                    `/console/workerbook/${numConsoleId}/detail/${member.contractorId}`
                  )
                }
                className="w-full bg-gray-800 rounded-lg px-6 py-3 border border-gray-700/50 hover:bg-gray-700/80 cursor-pointer"
              >
                <div className="flex items-center gap-4">
                  <div className="flex-1 flex items-center">
                    <div
                      className={`h-5 w-8 rounded flex items-center justify-center text-[10px] font-medium ${getShuttleColor(
                        member.shuttleLine
                      )}`}
                    >
                      {member.shuttleLine || '--'}
                    </div>
                    <div className="w-48 ml-4">
                      <span className="text-sm text-gray-300">
                        {member.firstName} {member.lastName}
                      </span>
                    </div>
                    <div className="w-32">
                      <span className="text-sm font-medium text-gray-300">
                        {member.cellPhone}
                      </span>
                    </div>
                    {getStatusBadge(member.status, member)}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) =>
                        handleNextDayStatusClick(
                          member.contractorId,
                          'notAvailable',
                          e
                        )
                      }
                      className={`h-5 px-1.5 rounded text-[10px] font-medium ${
                        member.confirmationStatus?.notAvailable
                          ? 'bg-red-900/20 text-red-300'
                          : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                      }`}
                    >
                      NA {member.confirmationStatus?.notAvailable || 0}
                    </button>
                    <button
                      onClick={(e) =>
                        handleNextDayStatusClick(
                          member.contractorId,
                          'leftMessage',
                          e
                        )
                      }
                      className={`h-5 px-1.5 rounded text-[10px] font-medium ${
                        member.confirmationStatus?.leftMessage
                          ? 'bg-blue-900/20 text-blue-300'
                          : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                      }`}
                    >
                      LM {member.confirmationStatus?.leftMessage || 0}
                    </button>
                    <button
                      onClick={(e) =>
                        handleNextDayStatusClick(
                          member.contractorId,
                          'confirmed',
                          e
                        )
                      }
                      className={`h-5 px-1.5 rounded text-[10px] font-medium ${
                        member.confirmationStatus?.confirmed
                          ? 'bg-green-900/20 text-green-300'
                          : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                      }`}
                    >
                      Conf.
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        {confirmedWorkers.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-gray-400 py-2">
              Confirmed ({confirmedWorkers.length})
            </h3>
            {confirmedWorkers.map((member) => (
              <div
                key={member.contractorId}
                onClick={() =>
                  navigate(
                    `/console/workerbook/${numConsoleId}/detail/${member.contractorId}`
                  )
                }
                className="w-full bg-green-900/20 rounded-lg px-6 py-3 border border-green-900/30 hover:bg-green-900/30 cursor-pointer"
              >
                <div className="flex items-center gap-4">
                  <div className="flex-1 flex items-center">
                    <div
                      className={`h-5 w-8 rounded flex items-center justify-center text-[10px] font-medium ${getShuttleColor(
                        member.shuttleLine
                      )}`}
                    >
                      {member.shuttleLine || '--'}
                    </div>
                    <div className="w-48 ml-4">
                      <span className="text-sm text-gray-300">
                        {member.firstName} {member.lastName}
                      </span>
                    </div>
                    <div className="w-32">
                      <span className="text-sm font-medium text-gray-300">
                        {member.cellPhone}
                      </span>
                    </div>
                    {getStatusBadge(member.status, member)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
  const renderListTab = (
    title: string,
    workersToList: Worker[],
    badge?: (w: Worker) => React.ReactNode
  ) => (
    <div className="px-6 h-[calc(100vh-13rem)] overflow-y-auto">
      <div className="flex items-center gap-2 py-4">
        <h2 className="text-lg font-medium text-white">{title}</h2>
        <span className="text-sm text-gray-400">({workersToList.length})</span>
      </div>
      <div className="space-y-2">
        {workersToList.map((worker) => (
          <div
            key={worker.contractorId}
            onClick={() =>
              navigate(
                `/console/workerbook/${numConsoleId}/detail/${worker.contractorId}`
              )
            }
            className="w-full bg-gray-800 rounded-lg px-6 py-3 border border-gray-700/50 hover:bg-gray-700/80 cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-16 text-xs text-gray-400">
                  #{worker.contractorId}
                </div>
                <div className="flex-1">
                  <h3 className="text-sm text-gray-300">
                    {worker.firstName} {worker.lastName}
                  </h3>
                </div>
                <div className="text-sm text-gray-400">{worker.cellPhone}</div>
              </div>
              {badge && <div>{badge(worker)}</div>}
            </div>
          </div>
        ))}
        {workersToList.length === 0 && (
          <p className="text-gray-400 mt-4 text-center">
            No workers in this category.
          </p>
        )}
      </div>
    </div>
  );
  const renderImport = () => (
    <div className="px-6 h-[calc(100vh-13rem)] overflow-y-auto">
      <div className="flex items-center justify-between py-4">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-medium text-white">Import / Not Booked</h2>
          <span className="text-sm text-gray-400">
            ({notBookedWorkers.length})
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowMoveWorkersModal(true)}
            disabled={selectedWorkers.size === 0}
            className="flex items-center gap-2 px-3 py-1.5 bg-cps-blue text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            <span className="text-sm">
              Move Selected ({selectedWorkers.size})
            </span>
          </button>
          <button
            onClick={handleImport}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 bg-cps-blue text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            <Download size={16} />
            <span className="text-sm">Import Workers</span>
          </button>
        </div>
      </div>
      <div className="space-y-2">
        {notBookedWorkers.map((member) => (
          <div
            key={member.contractorId}
            className="w-full bg-gray-800 rounded-lg px-6 py-3 border border-gray-700/50 flex items-center gap-4 hover:bg-gray-700/80"
          >
            <input
              type="checkbox"
              checked={selectedWorkers.has(member.contractorId)}
              onChange={(e) => toggleWorkerSelection(member.contractorId, e)}
              className="h-4 w-4 rounded border-gray-600 bg-gray-700 text-cps-blue focus:ring-cps-blue cursor-pointer"
            />
            <button
              onClick={() =>
                navigate(
                  `/console/workerbook/${numConsoleId}/detail/${member.contractorId}`
                )
              }
              className="flex-1 flex items-center gap-4 text-left"
            >
              <div className="w-16 text-xs text-gray-400">
                #{member.contractorId}
              </div>
              <div className="flex-1 flex items-center gap-2">
                <h3 className="text-sm text-gray-300">
                  {member.firstName} {member.lastName}
                </h3>
                {getStatusBadge(member.status, member)}
              </div>
              <div className="text-sm text-gray-400">{member.cellPhone}</div>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
  // --- End Render Tabs ---

  // --- Main Return ---
  if (loading) {
    return (
      <div className="flex justify-center items-center h-[calc(100vh-8rem)]">
        <Loader className="w-8 h-8 text-cps-blue animate-spin" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="p-6 text-center text-red-400">
        <AlertCircle size={24} className="mx-auto mb-2" />
        {error}
      </div>
    );
  }
  if (!consoleProfile || !activeSeason) {
    return (
      <div className="p-6 text-center text-gray-400">
        Could not load console profile or active season.
      </div>
    );
  }

  const isPreSeason = activeSeason.type === 'Service';

  // Main layout
  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col">
      {/* Pre-Season Blocker */}
      {isPreSeason ? (
        <div className="flex flex-col items-center justify-center h-full text-center p-6">
          <Info size={48} className="text-cps-blue mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Pre Season Mode</h2>
          <p className="text-gray-400 max-w-md">
            The Workerbook is in Pre-Season mode. Attendance tracking and
            payouts are disabled.
          </p>
        </div>
      ) : activeTab === 'Today' ? (
        renderToday()
      ) : activeTab === 'Next Day' ? (
        renderNextDay()
      ) : activeTab === 'Calendar' ? (
        renderListTab(
          'Calendar',
          calendarWorkers.flatMap(([, workers]) => workers),
          (w) => (
            <span className="text-xs px-2 py-1 rounded bg-purple-900/20 text-purple-300">
              {format(parseISO(w.bookedDate!), 'MMM d')}
            </span>
          )
        )
      ) : activeTab === 'No Shows' ? (
        renderListTab(
          'No Shows',
          noShowWorkers,
          (w) => (
            <span className="text-xs px-2 py-1 rounded bg-red-900/20 text-red-300">
              {w.noShows} No Show{w.noShows! > 1 ? 's' : ''}
            </span>
          )
        )
      ) : activeTab === 'WDR/TNB' ? (
        renderListTab(
          'WDR / TNB',
          wdrTnbWorkers,
          (w) => (
            <span className="text-xs px-2 py-1 rounded bg-yellow-900/20 text-yellow-300">
              {w.subStatus}
            </span>
          )
        )
      ) : activeTab === 'Quit/Fired' ? (
        renderListTab(
          'Quit / Fired',
          quitFiredWorkers,
          (w) => (
            <span className="text-xs px-2 py-1 rounded bg-red-900/20 text-red-300">
              {w.subStatus}
            </span>
          )
        )
      ) : activeTab === 'Import' ? (
        renderImport()
      ) : null}

      {/* Bottom Tab Bar */}
      <div className="flex-shrink-0 border-t border-gray-700 bg-gray-800 rounded-b-lg overflow-hidden">
        <div className="flex overflow-x-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
          {TABS.filter(
            (tab) =>
              !isPreSeason ||
              (tab !== 'Today' && tab !== 'Next Day' && tab !== 'No Shows')
          ).map((tabName) => (
            <button
              key={tabName}
              onClick={() => setActiveTab(tabName)}
              className={`flex-1 px-3 py-2 text-xs font-medium whitespace-nowrap border-r border-gray-700 last:border-r-0 transition-colors ${
                activeTab === tabName
                  ? 'bg-gray-600 text-white'
                  : 'bg-gray-700/50 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {tabName}
            </button>
          ))}
        </div>
      </div>

      {/* --- Modals --- */}
      {selectedWorkerForAssignment && !isTeamSeason && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-4 w-full max-w-sm mx-4">
            <h2 className="text-lg font-semibold text-white mb-4">
              Assign Route Manager
            </h2>
            <div className="space-y-2">
              {assignableManagers.map((manager) => (
                <button
                  key={manager.name}
                  onClick={() =>
                    handleRouteManagerAssignment(
                      selectedWorkerForAssignment,
                      manager
                    )
                  }
                  className="w-full py-2 px-4 text-left bg-gray-700 text-gray-300 rounded-md hover:bg-gray-600"
                >
                  {manager.name}
                </button>
              ))}
            </div>
            <button
              onClick={() => setSelectedWorkerForAssignment(null)}
              className="w-full mt-4 py-2 text-gray-300"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {cartToAssign !== null && isTeamSeason && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-4 w-full max-w-sm mx-4">
            <h2 className="text-lg font-semibold text-white mb-4">
              Assign Manager to Cart #{cartToAssign}
            </h2>
            <div className="space-y-2">
              {assignableManagers.map((manager) => (
                <button
                  key={manager.name}
                  onClick={() => handleCartManagerAssignment(manager)}
                  className="w-full py-2 px-4 text-left bg-gray-700 text-gray-300 rounded-md hover:bg-gray-600"
                >
                  {manager.name}
                </button>
              ))}
            </div>
            <button
              onClick={() => setCartToAssign(null)}
              className="w-full mt-4 py-2 text-gray-300"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {showRebookModal && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
          <div className="flex flex-col gap-4">
            {renderMiniCalendar(
              rebookCalendarDate,
              setRebookCalendarDate,
              handleRebookDateClick
            )}
            <button
              onClick={handleRebookWDRClick}
              className="w-full bg-yellow-600/20 text-yellow-300 py-2 rounded-md hover:bg-yellow-600/30 font-medium"
            >
              Will Call (WDR)
            </button>
            <button
              onClick={() => setShowRebookModal(false)}
              className="w-full py-2 text-gray-300"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {showMoveWorkersModal && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
          <div className="flex flex-col gap-4">
            {renderMiniCalendar(
              moveWorkersCalendarDate,
              setMoveWorkersCalendarDate,
              handleMoveWorkersToDate
            )}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleMoveWorkersToStatus('wdr_tnb', 'WDR')}
                className="bg-gray-700 text-white py-2 px-4 rounded-lg"
              >
                WDR
              </button>
              <button
                onClick={() => handleMoveWorkersToStatus('wdr_tnb', 'TNB')}
                className="bg-gray-700 text-white py-2 px-4 rounded-lg"
              >
                TNB
              </button>
              <button
                onClick={() => handleMoveWorkersToStatus('quit_fired', 'Quit')}
                className="bg-gray-700 text-white py-2 px-4 rounded-lg"
              >
                Quit
              </button>
              <button
                onClick={() => handleMoveWorkersToStatus('quit_fired', 'Fired')}
                className="bg-gray-700 text-white py-2 px-4 rounded-lg"
              >
                Fired
              </button>
            </div>
            <button
              onClick={() => setShowMoveWorkersModal(false)}
              className="w-full py-2 text-gray-300"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
export default ConsoleWorkerbook;