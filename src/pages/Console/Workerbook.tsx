import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X,
  Loader,
  AlertCircle,
  Info,
  User,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { format, addDays, addMonths, subMonths, isPast } from 'date-fns';
import { getCurrentDate } from '../../lib/date';
import {
  RouteManager,
  getAssignableRouteManagers,
} from '../../lib/routeManagers';
import PayoutToday from './PayoutToday';
import { bookingStore } from '../../stores/AdminBookingStore';
import {
  MasterBooking,
  Season,
  ConsoleProfile,
  Worker,
  Cart,
} from '../../types';
import {
  getStorageItem,
  setStorageItem,
  STORAGE_KEYS,
} from '../../lib/localStorage';

const Workerbook: React.FC = () => {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [allBookings, setAllBookings] = useState<MasterBooking[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedWorkerForAssignment, setSelectedWorkerForAssignment] =
    useState<string | null>(null);
  const [assignableManagers, setAssignableManagers] = useState<RouteManager[]>(
    []
  );
  const [attendanceFinalized, setAttendanceFinalized] =
    useState<boolean>(false);
  const [activeSeason, setActiveSeason] = useState<Season | null>(null);
  const [carts, setCarts] = useState<Cart[]>(() => {
    return getStorageItem(STORAGE_KEYS.CONSOLE_CARTS, []);
  });
  const [cartCount, setCartCount] = useState(carts.length);
  const [showRebookModal, setShowRebookModal] = useState(false);
  const [workerToRebook, setWorkerToRebook] = useState<string | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [cartToAssign, setCartToAssign] = useState<number | null>(null);

  const navigate = useNavigate();

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
      }

      setWorkers(getStorageItem(STORAGE_KEYS.CONSOLE_WORKERS, []));
      setAssignableManagers(getAssignableRouteManagers());

      const bookings = bookingStore.getAllBookings();
      setAllBookings(bookings);

      const finalizedDate = getStorageItem(
        STORAGE_KEYS.ATTENDANCE_FINALIZED,
        null
      );
      setAttendanceFinalized(
        finalizedDate === format(getCurrentDate(), 'yyyy-MM-dd')
      );

      const savedCarts = getStorageItem(STORAGE_KEYS.CONSOLE_CARTS, []);
      setCarts(savedCarts);
      setCartCount(savedCarts.length);
    };

    loadData();
    window.addEventListener('storageUpdated', loadData);
    return () => window.removeEventListener('storageUpdated', loadData);
  }, []);

  const today = format(getCurrentDate(), 'yyyy-MM-dd');

  const isPreSeason = activeSeason?.name === 'Pre Season';
  const isTeamSeason = ['Rejuv', 'Sealing', 'Cleaning'].includes(
    activeSeason?.type || ''
  );

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

  const handleDragStart = (
    e: React.DragEvent<HTMLDivElement>,
    workerId: string
  ) => {
    e.dataTransfer.setData('workerId', workerId);
  };

  const handleDrop = (
    e: React.DragEvent<HTMLDivElement>,
    cartId: number | null
  ) => {
    e.preventDefault();
    const workerId = e.dataTransfer.getData('workerId');

    const updatedWorkers = workers.map((w) => {
      if (w.contractorId === workerId) {
        return { ...w, cartId: cartId };
      }
      return w;
    });
    setWorkers(updatedWorkers);
    setStorageItem(STORAGE_KEYS.CONSOLE_WORKERS, updatedWorkers);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const showedWorkers = workers.filter(
    (w) => w.showed && w.showedDate === today
  );

  const handleFinalizeAttendance = () => {
    const unassignedCount = showedWorkers.filter(
      (w) => !w.routeManager && !w.cartId
    ).length;
    if (unassignedCount > 0) {
      setError(
        `${unassignedCount} worker${unassignedCount > 1 ? 's' : ''} still need${
          unassignedCount === 1 ? 's' : ''
        } to be assigned.`
      );
      return;
    }

    const todayStr = format(getCurrentDate(), 'yyyy-MM-dd');
    setStorageItem(STORAGE_KEYS.ATTENDANCE_FINALIZED, todayStr);
    setStorageItem(`attendanceFinalized_${todayStr}`, 'true');
    setAttendanceFinalized(true);

    const updatedWorkers = workers.map((worker) => {
      if (
        worker.bookingStatus === 'today' &&
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

    setStorageItem(STORAGE_KEYS.CONSOLE_WORKERS, updatedWorkers);
    setWorkers(updatedWorkers);
    setError(null);
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

    setStorageItem(STORAGE_KEYS.CONSOLE_WORKERS, updatedWorkers);
    setSelectedWorkerForAssignment(null);
  };

  const getStatusBadge = (status: string, worker: Worker) => {
    const badgeWidth = 'w-[4.5rem]';

    switch (status.toLowerCase()) {
      case 'alumni': {
        const previousDays = parseInt(
          worker.daysWorkedPreviousYears || '0',
          10
        );
        const currentDays = worker.daysWorked || 0;
        const totalDays = previousDays + currentDays;

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

  const todayWorkers = workers.filter((w) => {
    const isBookedToday =
      (w.bookingStatus === 'today' || w.bookingStatus === 'calendar') &&
      w.bookedDate === today;
    const showedToday = w.showed && w.showedDate === today;
    return isBookedToday || showedToday;
  });

  const bookedWorkers = todayWorkers
    .filter((w) => !w.showed || w.showedDate !== today)
    .sort((a, b) => a.lastName.localeCompare(b.lastName));

  const handleMarkShowed = (workerId: string) => {
    const today = format(getCurrentDate(), 'yyyy-MM-dd');
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
    setWorkers(updatedWorkers);
    setStorageItem(STORAGE_KEYS.CONSOLE_WORKERS, updatedWorkers);
    setWorkerToRebook(workerId);
    setShowRebookModal(true);
  };

  const handleDateClick = (day: number) => {
    const selectedDate = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
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

    setStorageItem(STORAGE_KEYS.CONSOLE_WORKERS, updatedWorkers);
    setShowRebookModal(false);
    setWorkerToRebook(null);
  };

  const handleWDRClick = () => {
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

    setStorageItem(STORAGE_KEYS.CONSOLE_WORKERS, updatedWorkers);
    setShowRebookModal(false);
    setWorkerToRebook(null);
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

  if (isPreSeason) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-12rem)] text-center">
        <Info size={48} className="text-cps-blue mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">Pre Season Mode</h2>
        <p className="text-gray-400 max-w-md">
          Attendance tracking, payouts, and next-day bookings are disabled
          during the Pre Season. Please use the Calendar to manage future
          bookings.
        </p>
      </div>
    );
  }

  if (attendanceFinalized) {
    return <PayoutToday />;
  }
  const previousMonth = () => {
    setCurrentDate(subMonths(currentDate, 1));
  };

  const nextMonth = () => {
    setCurrentDate(addMonths(currentDate, 1));
  };
  const renderCalendar = () => {
    const startDate = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      1
    );
    const endDate = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth() + 1,
      0
    );
    const daysInMonth = endDate.getDate();
    const startDayOfWeek = startDate.getDay();

    const calendarRows = [];
    let currentRow = [];

    for (let i = 0; i < startDayOfWeek; i++) {
      currentRow.push(
        <td key={`empty-${i}`} className="border border-gray-700/50 p-0"></td>
      );
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const calendarDate = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth(),
        day
      );
      const isToday =
        format(calendarDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
      const isDisabled = isPast(calendarDate) && !isToday;

      currentRow.push(
        <td key={day} className="border border-gray-700/50 p-0">
          <button
            onClick={() => handleDateClick(day)}
            disabled={isDisabled}
            className={`w-full h-14 flex flex-col items-center justify-center transition-colors ${
              isDisabled
                ? 'text-gray-600 cursor-not-allowed'
                : isToday
                ? 'bg-cps-blue text-white hover:bg-blue-700'
                : 'text-gray-300 hover:bg-gray-700'
            }`}
          >
            <span className="text-sm">{day}</span>
          </button>
        </td>
      );

      if ((startDayOfWeek + day) % 7 === 0 || day === daysInMonth) {
        calendarRows.push(<tr key={day}>{currentRow}</tr>);
        currentRow = [];
      }
    }

    return calendarRows;
  };

  return (
    <>
      <div className="sticky top-16 bg-[#1a2832] z-10 px-6 py-3 border-b border-gray-700">
        <div className="flex justify-between items-center">
          <div className="flex items-baseline gap-4">
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-bold text-gray-300">
                {todayWorkers.length}
              </span>
              <span className="text-sm text-gray-400">Booked</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-bold text-gray-300">
                {showedWorkers.length}
              </span>
              <span className="text-sm text-gray-400">Showed</span>
            </div>
          </div>
          <button
            onClick={handleFinalizeAttendance}
            className="px-4 py-2 bg-cps-green text-white rounded-md hover:bg-green-700 transition-colors"
          >
            Finalize Attendance & Payout
          </button>
        </div>
        {error && (
          <div className="mt-2 text-sm text-red-400 flex items-center gap-2">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}
      </div>
      <div className="h-[calc(100vh-13rem)] flex bg-black">
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
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium text-white transition-colors ${
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

        {/* Main Workerbook Content */}
        <div
          className={
            isTeamSeason ? 'w-1/2 overflow-y-auto' : 'flex-1 overflow-y-auto'
          }
        >
          {!isTeamSeason ? (
            // Aeration (Individual) View
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
                            `/console/workerbook/contdetail/${member.contractorId}`
                          )
                        }
                        className="w-full bg-gray-800 rounded-lg px-6 py-3 border border-gray-700/50 hover:bg-gray-700/80 transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-4">
                          <div className="flex-1 flex items-center">
                            <div
                              className={`h-5 w-8 rounded flex items-center justify-center text-[10px] font-medium ${
                                member.shuttleLine
                                  ? 'bg-cps-blue/20 text-blue-300'
                                  : 'bg-gray-700 text-gray-400'
                              }`}
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
                            {member.confirmationStatus?.confirmed && (
                              <span className="h-5 px-1.5 rounded text-[10px] font-medium bg-green-900/20 text-green-300">
                                Conf.
                              </span>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMarkShowed(member.contractorId);
                              }}
                              className="px-3 py-1.5 bg-cps-blue text-white rounded-md hover:bg-blue-700 transition-colors text-sm"
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
                        onClick={() =>
                          navigate(
                            `/console/workerbook/contdetail/${member.contractorId}`
                          )
                        }
                        className="w-full bg-green-900/20 rounded-lg px-6 py-3 border border-green-900/30 hover:bg-green-900/30 transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-4">
                          <div className="flex-1 flex items-center">
                            <div
                              className={`h-5 w-8 rounded flex items-center justify-center text-[10px] font-medium ${
                                member.shuttleLine
                                  ? 'bg-cps-blue/20 text-blue-300'
                                  : 'bg-gray-700 text-gray-400'
                              }`}
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
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedWorkerForAssignment(
                                member.contractorId
                              );
                            }}
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium text-white transition-colors ${
                              member.routeManager?.initials
                                ? 'bg-cps-blue hover:bg-blue-700'
                                : 'bg-gray-700 hover:bg-gray-600 text-gray-400'
                            }`}
                          >
                            {member.routeManager?.initials || '?'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            // Team Season View (Carts)
            <div
              className="p-6 h-full"
              onDrop={(e) => handleDrop(e, null)} // Drop here to unassign
              onDragOver={handleDragOver}
            >
              {bookedWorkers.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-lg font-medium text-white mb-2">
                    Not Showed ({bookedWorkers.length})
                  </h3>
                  <div className="space-y-2">
                    {bookedWorkers.map((member) => (
                      <div
                        key={member.contractorId}
                        className="bg-gray-800 rounded-lg p-3 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-4">
                          <User size={16} className="text-gray-400" />
                          <span className="text-sm text-white">
                            {member.firstName} {member.lastName}
                          </span>
                        </div>
                        <button
                          onClick={() => handleMarkShowed(member.contractorId)}
                          className="px-3 py-1.5 bg-cps-blue text-white rounded-md hover:bg-blue-700 transition-colors text-sm"
                        >
                          Mark Showed
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <h3 className="text-lg font-medium text-white mb-2">
                Available Workers (
                {showedWorkers.filter((w) => !w.cartId).length})
              </h3>
              <div className="space-y-2">
                {showedWorkers
                  .filter((w) => !w.cartId)
                  .map((worker) => (
                    <div
                      key={worker.contractorId}
                      draggable
                      onDragStart={(e) =>
                        handleDragStart(e, worker.contractorId)
                      }
                      className="bg-gray-800 rounded-lg p-3 flex items-center gap-4 cursor-grab"
                    >
                      <User size={16} className="text-gray-400" />
                      <span className="text-sm text-white">
                        {worker.firstName} {worker.lastName}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
        {selectedWorkerForAssignment && !isTeamSeason && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-gray-800 rounded-lg p-4 w-full max-w-sm mx-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white">
                  Assign Route Manager
                </h2>
                <button
                  onClick={() => setSelectedWorkerForAssignment(null)}
                  className="p-1 hover:bg-gray-700 rounded-full text-gray-400 hover:text-white"
                >
                  <X size={20} />
                </button>
              </div>
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
                    className="w-full py-2 px-4 text-left bg-gray-700 text-gray-300 rounded-md hover:bg-gray-600 transition-colors"
                  >
                    {manager.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
        {showRebookModal && (
          <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
            <div className="bg-gray-800 rounded-lg p-4 w-[380px] space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-md font-medium text-gray-300">
                  Next Booking Date
                </h3>
                <button
                  onClick={() => {
                    setShowRebookModal(false);
                    setWorkerToRebook(null);
                  }}
                  className="p-1 hover:bg-gray-700 rounded-full"
                >
                  <X size={20} className="text-gray-400" />
                </button>
              </div>
              <div className="flex items-center justify-between">
                <button
                  onClick={previousMonth}
                  className="p-1 hover:bg-gray-700 rounded-full text-gray-400 hover:text-white"
                >
                  <ChevronLeft size={20} />
                </button>
                <h3 className="text-sm font-medium text-gray-300">
                  {currentDate.toLocaleString('default', {
                    month: 'long',
                    year: 'numeric',
                  })}
                </h3>
                <button
                  onClick={nextMonth}
                  className="p-1 hover:bg-gray-700 rounded-full text-gray-400 hover:text-white"
                >
                  <ChevronRight size={20} />
                </button>
              </div>

              <table className="w-full border-collapse border border-gray-700/50">
                <thead>
                  <tr>
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(
                      (day) => (
                        <th
                          key={day}
                          className="border border-gray-700/50 p-1 text-xs font-medium text-gray-400"
                        >
                          {day}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody>{renderCalendar()}</tbody>
              </table>
              <button
                onClick={handleWDRClick}
                className="w-full bg-yellow-600/20 text-yellow-300 py-2 rounded-md hover:bg-yellow-600/30 transition-colors text-sm font-medium"
              >
                Will Call (WDR)
              </button>
            </div>
          </div>
        )}
        {cartToAssign !== null && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-gray-800 rounded-lg p-4 w-full max-w-sm mx-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white">
                  Assign Manager to Cart #{cartToAssign}
                </h2>
                <button
                  onClick={() => setCartToAssign(null)}
                  className="p-1 hover:bg-gray-700 rounded-full text-gray-400 hover:text-white"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="space-y-2">
                {assignableManagers.map((manager) => (
                  <button
                    key={manager.name}
                    onClick={() => handleCartManagerAssignment(manager)}
                    className="w-full py-2 px-4 text-left bg-gray-700 text-gray-300 rounded-md hover:bg-gray-600 transition-colors"
                  >
                    {manager.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default Workerbook;
