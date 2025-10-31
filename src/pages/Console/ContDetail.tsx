import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import {
  ArrowLeft,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Edit2,
  Check,
  X,
  UserCircle,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Repeat, // Import Repeat icon for Transfer
} from 'lucide-react';
import { Worker, PayoutRecord } from '../../types';
import {
  getStorageItem,
  setStorageItem,
  STORAGE_KEYS,
} from '../../lib/localStorage';

// Define ConsoleProfile interface
interface ConsoleProfile {
  id: number;
  title: string;
}

const ContDetail: React.FC = () => {
  const { workerId } = useParams<{ workerId: string }>();
  const navigate = useNavigate();
  const [showProfile, setShowProfile] = useState(false);
  const [showStats, setShowStats] = useState(true);
  const [showCalendar, setShowCalendar] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showPreviousStats, setShowPreviousStats] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showTransferModal, setShowTransferModal] = useState(false); // State for transfer modal

  const workers = getStorageItem(STORAGE_KEYS.CONSOLE_WORKERS, []);
  const worker: Worker | undefined = workers.find(
    (w: Worker) => w.contractorId === workerId
  );

  const [editForm, setEditForm] = useState({
    firstName: worker?.firstName || '',
    lastName: worker?.lastName || '',
    cellPhone: worker?.cellPhone || '',
    homePhone: worker?.homePhone || '',
    email: worker?.email || '',
    address: worker?.address || '',
    city: worker?.city || '',
  });

  if (!worker) {
    return (
      <div className="text-center text-gray-400 py-12">Worker not found</div>
    );
  }

  const totalSilvers = [
    parseInt(worker.aerationSilversPreviousYears || '0'),
    parseInt(worker.rejuvSilversPreviousYears || '0'),
    parseInt(worker.sealingSilversPreviousYears || '0'),
    parseInt(worker.cleaningSilversPreviousYears || '0'),
  ].reduce((a, b) => a + b, 0);

  const handleSave = () => {
    const updatedWorkers = workers.map((w: Worker) => {
      if (w.contractorId === workerId) {
        return {
          ...w,
          ...editForm,
        };
      }
      return w;
    });

    setStorageItem(STORAGE_KEYS.CONSOLE_WORKERS, updatedWorkers);
    setIsEditing(false);
  };

  const handleCancel = () => {
    if (worker) {
      setEditForm({
        firstName: worker.firstName,
        lastName: worker.lastName,
        cellPhone: worker.cellPhone,
        homePhone: worker.homePhone,
        email: worker.email,
        address: worker.address,
        city: worker.city,
      });
    }
    setIsEditing(false);
  };

  const daysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const startDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  const isPast = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    date.setHours(0, 0, 0, 0);
    return date < today;
  };

  const handleDateClick = (day: number) => {
    const selectedDate = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      day
    );
    const formattedDate = format(selectedDate, 'yyyy-MM-dd');
    const today = format(new Date(), 'yyyy-MM-dd');

    const updatedWorkers = workers.map((w: Worker) => {
      if (w.contractorId === workerId) {
        return {
          ...w,
          bookingStatus: 'calendar',
          bookedDate: formattedDate,
          showed: formattedDate === today ? w.showed : false,
          showedDate: formattedDate === today ? w.showedDate : undefined,
        };
      }
      return w;
    });

    setStorageItem(STORAGE_KEYS.CONSOLE_WORKERS, updatedWorkers);
    navigate(-1);
  };

  const handleStatusChange = (
    status: 'wdr_tnb' | 'quit_fired',
    reason: 'WDR' | 'TNB' | 'Quit' | 'Fired'
  ) => {
    const updatedWorkers = workers.map((w: Worker) => {
      if (w.contractorId === workerId) {
        return {
          ...w,
          bookingStatus: status,
          subStatus: reason,
          bookedDate: undefined,
        };
      }
      return w;
    });

    setStorageItem(STORAGE_KEYS.CONSOLE_WORKERS, updatedWorkers);
    navigate(-1);
  };

  const handleTransfer = () => {
    const allWorkers = getStorageItem(STORAGE_KEYS.CONSOLE_WORKERS, []);
    const updatedWorkers = allWorkers.map((w: Worker) => {
      if (w.contractorId === workerId) {
        const {
          bookingStatus,
          bookedDate,
          routeManager,
          showed,
          showedDate,
          ...rest
        } = w;
        return rest; // Return worker without booking status and route manager
      }
      return w;
    });
    setStorageItem(STORAGE_KEYS.CONSOLE_WORKERS, updatedWorkers);
    setShowTransferModal(false);
    navigate('/console/workerbook');
  };

  const previousMonth = () => {
    setCurrentDate(
      new Date(currentDate.getFullYear(), currentDate.getMonth() - 1)
    );
  };

  const nextMonth = () => {
    setCurrentDate(
      new Date(currentDate.getFullYear(), currentDate.getMonth() + 1)
    );
  };

  const getBookingStatusBadge = () => {
    if (!worker.bookingStatus) return null;

    const badgeClasses: { [key: string]: string } = {
      today: 'bg-green-900/20 text-green-300',
      next_day: 'bg-blue-900/20 text-blue-300',
      calendar: 'bg-purple-900/20 text-purple-300',
      wdr_tnb: 'bg-yellow-900/20 text-yellow-300',
      quit_fired: 'bg-red-900/20 text-red-300',
      new: 'bg-gray-700 text-gray-300',
    };

    const getBadgeText = () => {
      switch (worker.bookingStatus) {
        case 'today':
          return 'Booked Today';
        case 'next_day':
          return 'Next Day';
        case 'calendar':
          if (worker.bookedDate) {
            return format(parseISO(worker.bookedDate), 'MMM d');
          }
          return 'Future Date';
        case 'wdr_tnb':
          return 'WDR/TNB';
        case 'quit_fired':
          return 'Quit/Fired';
        case 'new':
          return 'New';
        default:
          return '';
      }
    };

    return (
      <span
        className={`text-xs px-2 py-1 rounded ${
          badgeClasses[worker.bookingStatus]
        }`}
      >
        {getBadgeText()}
      </span>
    );
  };

  const renderCalendar = () => {
    const days = daysInMonth(currentDate);
    const startDay = startDayOfMonth(currentDate);
    const weeks = [];
    let week = [];

    for (let i = 0; i < startDay; i++) {
      week.push(
        <td key={`empty-${i}`} className="border border-gray-700/50 p-0"></td>
      );
    }

    for (let day = 1; day <= days; day++) {
      const date = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth(),
        day
      );
      const isDisabled = isPast(date);
      const isTodayDate = isToday(date);

      week.push(
        <td key={day} className="border border-gray-700/50 p-0">
          <button
            onClick={() => handleDateClick(day)}
            disabled={isDisabled && !isTodayDate}
            className={`w-full h-14 flex flex-col items-center justify-center transition-colors ${
              isDisabled && !isTodayDate
                ? 'text-gray-600 cursor-not-allowed'
                : isTodayDate
                ? 'bg-cps-blue text-white hover:bg-blue-700'
                : 'text-gray-300 hover:bg-gray-700'
            }`}
          >
            <span className="text-sm">{day}</span>
          </button>
        </td>
      );

      if ((startDay + day) % 7 === 0 || day === days) {
        weeks.push(<tr key={day}>{week}</tr>);
        week = [];
      }
    }

    return weeks;
  };

  const payoutHistory = worker.payoutHistory || [];
  const totalSales = payoutHistory.reduce(
    (sum: number, record: PayoutRecord) => sum + record.grossSales,
    0
  );
  const totalEQ = payoutHistory.reduce(
    (sum: number, record: PayoutRecord) => sum + record.equivalent,
    0
  );
  const totalPayout = payoutHistory.reduce(
    (sum: number, record: PayoutRecord) => sum + record.commission,
    0
  );
  const daysWithPayout = payoutHistory.length;

  const averageEQ = daysWithPayout > 0 ? totalEQ / daysWithPayout : 0;
  const averagePayout = daysWithPayout > 0 ? totalPayout / daysWithPayout : 0;
  const consoleProfiles: ConsoleProfile[] = getStorageItem(
    STORAGE_KEYS.CONSOLE_PROFILES,
    []
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-gray-700 rounded-full transition-colors"
          >
            <ArrowLeft className="text-gray-400" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              {isEditing ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={editForm.firstName}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        firstName: e.target.value,
                      }))
                    }
                    className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white text-lg w-32"
                    placeholder="First Name"
                  />
                  <input
                    type="text"
                    value={editForm.lastName}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        lastName: e.target.value,
                      }))
                    }
                    className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white text-lg w-32"
                    placeholder="Last Name"
                  />
                </div>
              ) : (
                <h2 className="text-lg font-medium text-white">
                  {worker.firstName} {worker.lastName}
                </h2>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm text-gray-400">
                #{worker.contractorId}
              </span>
              {worker.status && (
                <span
                  className={`text-xs px-2 py-1 rounded ${
                    worker.status.toLowerCase() === 'alumni'
                      ? 'bg-purple-900/20 text-purple-300'
                      : 'bg-green-900/20 text-green-300'
                  }`}
                >
                  {worker.status}
                </span>
              )}
              {getBookingStatusBadge()}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => {
              setShowProfile(true);
              setShowCalendar(false);
              setShowStats(false);
            }}
            className={`flex flex-col items-center gap-1 ${
              showProfile ? 'text-white' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <UserCircle
              size={20}
              className={showProfile ? 'text-cps-blue' : ''}
            />
            <span className={`text-sm ${showProfile ? 'text-cps-blue' : ''}`}>
              Profile
            </span>
          </button>
          <button
            onClick={() => {
              setShowStats(true);
              setShowProfile(false);
              setShowCalendar(false);
            }}
            className={`flex flex-col items-center gap-1 ${
              showStats ? 'text-white' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <BarChart3 size={20} className={showStats ? 'text-cps-blue' : ''} />
            <span className={`text-sm ${showStats ? 'text-cps-blue' : ''}`}>
              Stats
            </span>
          </button>
          <button
            onClick={() => {
              setShowCalendar(true);
              setShowProfile(false);
              setShowStats(false);
            }}
            className={`flex flex-col items-center gap-1 ${
              showCalendar ? 'text-white' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <Calendar
              size={20}
              className={showCalendar ? 'text-cps-blue' : ''}
            />
            <span className={`text-sm ${showCalendar ? 'text-cps-blue' : ''}`}>
              Calendar
            </span>
          </button>
          <button
            onClick={() => setShowTransferModal(true)}
            className="flex flex-col items-center gap-1 text-gray-400 hover:text-gray-200"
          >
            <Repeat size={20} />
            <span className="text-sm">Transfer</span>
          </button>
        </div>
      </div>

      {showProfile && (
        <div className="bg-gray-800 rounded-lg p-4 animate-fade-in">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-300">
              Contact Information
            </h3>
            {isEditing ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSave}
                  className="p-1 hover:bg-gray-700 rounded text-green-400 hover:text-green-300"
                  title="Save"
                >
                  <Check size={18} />
                </button>
                <button
                  onClick={handleCancel}
                  className="p-1 hover:bg-gray-700 rounded text-red-400 hover:text-red-300"
                  title="Cancel"
                >
                  <X size={18} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsEditing(true)}
                className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-white"
                title="Edit"
              >
                <Edit2 size={18} />
              </button>
            )}
          </div>

          {isEditing ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Phone size={16} className="text-gray-400" />
                <div className="flex-1 space-y-2">
                  <input
                    type="tel"
                    value={editForm.cellPhone}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        cellPhone: e.target.value,
                      }))
                    }
                    className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white w-full"
                    placeholder="Cell Phone"
                  />
                  <input
                    type="tel"
                    value={editForm.homePhone}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        homePhone: e.target.value,
                      }))
                    }
                    className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white w-full"
                    placeholder="Home Phone"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Mail size={16} className="text-gray-400" />
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, email: e.target.value }))
                  }
                  className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white w-full"
                  placeholder="Email address"
                />
              </div>

              <div className="flex items-center gap-3">
                <MapPin size={16} className="text-gray-400" />
                <div className="flex-1 space-y-2">
                  <input
                    type="text"
                    value={editForm.address}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        address: e.target.value,
                      }))
                    }
                    className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white w-full"
                    placeholder="Address"
                  />
                  <input
                    type="text"
                    value={editForm.city}
                    onChange={(e) =>
                      setEditForm((prev) => ({ ...prev, city: e.target.value }))
                    }
                    className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white w-full"
                    placeholder="City"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {(worker.cellPhone || worker.homePhone) && (
                <div className="flex items-center gap-3">
                  <Phone size={16} className="text-gray-400" />
                  <div className="space-y-1">
                    {worker.cellPhone && (
                      <div className="flex items-center gap-2">
                        <span className="text-gray-200">
                          {worker.cellPhone}
                        </span>
                        <span className="text-[10px] bg-cps-blue/20 text-blue-300 px-1.5 rounded">
                          Cell
                        </span>
                      </div>
                    )}
                    {worker.homePhone && (
                      <div className="flex items-center gap-2">
                        <span className="text-gray-200">
                          {worker.homePhone}
                        </span>
                        <span className="text-[10px] bg-gray-700 text-gray-300 px-1.5 rounded">
                          Home
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {worker.email && (
                <div className="flex items-center gap-3">
                  <Mail size={16} className="text-gray-400" />
                  <span className="text-gray-200">{worker.email}</span>
                </div>
              )}

              {worker.address && (
                <div className="flex items-center gap-3">
                  <MapPin size={16} className="text-gray-400" />
                  <span className="text-gray-200">
                    {worker.address}
                    {worker.city && `, ${worker.city}`}
                  </span>
                </div>
              )}

              {worker.shuttleLine && (
                <div className="flex items-center gap-3">
                  <Calendar size={16} className="text-gray-400" />
                  <span className="text-gray-200">
                    Shuttle Line: {worker.shuttleLine}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {showTransferModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-sm mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-white">
                Transfer Contractor
              </h3>
              <button
                onClick={() => setShowTransferModal(false)}
                className="p-1 hover:bg-gray-700 rounded-full text-gray-400 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>
            <p className="text-sm text-gray-400 mb-4">
              Select a Console Profile to transfer{' '}
              <span className="font-medium text-white">
                {worker.firstName} {worker.lastName}
              </span>{' '}
              to. They will be moved to the Import tab.
            </p>
            <div className="space-y-2">
              {consoleProfiles.map((profile) => (
                <button
                  key={profile.id}
                  onClick={handleTransfer}
                  className="w-full text-left bg-gray-700 text-gray-300 rounded-md hover:bg-gray-600 transition-colors p-3"
                >
                  {profile.title}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {showStats && (
        <div className="space-y-4 animate-fade-in">
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-300 mb-4">
              Lifetime Stats
            </h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-gray-400">Total Sales</p>
                <p className="text-lg font-medium text-white">
                  ${totalSales.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Average EQ</p>
                <p className="text-lg font-medium text-white">
                  {averageEQ.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Average Payout</p>
                <p className="text-lg font-medium text-white">
                  ${averagePayout.toFixed(2)}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-300 mb-4">
              Current Season Stats
            </h3>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-gray-400">Days Worked</p>
                <p className="text-lg font-medium text-white">
                  {worker.daysWorked || 0}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400">No Shows</p>
                <p className="text-lg font-medium text-red-400">
                  {worker.noShows || 0}
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={() => setShowPreviousStats(!showPreviousStats)}
            className="w-full bg-gray-800 rounded-lg p-4 flex items-center justify-between hover:bg-gray-700/80 transition-colors"
          >
            <span className="text-sm font-medium text-gray-300">
              Previous Years Stats
            </span>
            {showPreviousStats ? (
              <ChevronUp size={20} className="text-gray-400" />
            ) : (
              <ChevronDown size={20} className="text-gray-400" />
            )}
          </button>

          {showPreviousStats && (
            <div className="bg-gray-800 rounded-lg p-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-gray-400">Days Worked</p>
                    <p className="text-lg font-medium text-white">
                      {worker.daysWorkedPreviousYears || '0'}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-gray-400">Total Silvers</p>
                    <p className="text-lg font-medium text-white">
                      {totalSilvers}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="relative w-3.5 h-3.5">
                      <img
                        src="/silver-hat.svg"
                        alt=""
                        className="w-full h-full object-contain"
                        style={{
                          filter:
                            'drop-shadow(0 0 12px rgba(69, 123, 157, 0.6))',
                        }}
                      />
                    </div>
                    <span className="text-sm text-gray-300">
                      Aeration: {worker.aerationSilversPreviousYears || '0'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="relative w-3.5 h-3.5">
                      <img
                        src="/silver-hat.svg"
                        alt=""
                        className="w-full h-full object-contain"
                        style={{
                          filter:
                            'drop-shadow(0 0 12px rgba(42, 157, 143, 0.6))',
                        }}
                      />
                    </div>
                    <span className="text-sm text-gray-300">
                      Rejuv: {worker.rejuvSilversPreviousYears || '0'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="relative w-3.5 h-3.5">
                      <img
                        src="/silver-hat.svg"
                        alt=""
                        className="w-full h-full object-contain"
                        style={{
                          filter:
                            'drop-shadow(0 0 12px rgba(233, 196, 106, 0.6))',
                        }}
                      />
                    </div>
                    <span className="text-sm text-gray-300">
                      Sealing: {worker.sealingSilversPreviousYears || '0'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="relative w-3.5 h-3.5">
                      <img
                        src="/silver-hat.svg"
                        alt=""
                        className="w-full h-full object-contain"
                        style={{
                          filter:
                            'drop-shadow(0 0 12px rgba(230, 57, 70, 0.6))',
                        }}
                      />
                    </div>
                    <span className="text-sm text-gray-300">
                      Cleaning: {worker.cleaningSilversPreviousYears || '0'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {showCalendar && (
        <div className="flex flex-col items-center gap-6 animate-fade-in">
          <div className="bg-gray-800 rounded-lg p-4 w-[340px]">
            <div className="flex items-center justify-between mb-4">
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
          </div>

          <div className="grid grid-cols-2 gap-3 w-[340px]">
            <button
              onClick={() => handleStatusChange('wdr_tnb', 'WDR')}
              className="bg-gray-800 hover:bg-gray-700 text-white py-2 px-4 rounded-lg transition-colors text-center text-sm"
            >
              WDR
            </button>

            <button
              onClick={() => handleStatusChange('wdr_tnb', 'TNB')}
              className="bg-gray-800 hover:bg-gray-700 text-white py-2 px-4 rounded-lg transition-colors text-center text-sm"
            >
              TNB
            </button>

            <button
              onClick={() => handleStatusChange('quit_fired', 'Quit')}
              className="bg-gray-800 hover:bg-gray-700 text-white py-2 px-4 rounded-lg transition-colors text-center text-sm"
            >
              Quit
            </button>

            <button
              onClick={() => handleStatusChange('quit_fired', 'Fired')}
              className="bg-gray-800 hover:bg-gray-700 text-white py-2 px-4 rounded-lg transition-colors text-center text-sm"
            >
              Fired
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContDetail;
