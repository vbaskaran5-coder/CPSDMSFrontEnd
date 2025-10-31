import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, addDays } from 'date-fns';
import { getCurrentDate } from '../../lib/date';
import {
  getStorageItem,
  setStorageItem,
  STORAGE_KEYS,
} from '../../lib/localStorage';

interface Worker {
  contractorId: string;
  firstName: string;
  lastName: string;
  cellPhone: string;
  status: string;
  bookingStatus?:
    | 'today'
    | 'next_day'
    | 'calendar'
    | 'wdr_tnb'
    | 'quit_fired'
    | 'new';
  bookedDate?: string;
  showed?: boolean;
  showedDate?: string;
  confirmationStatus?: {
    confirmed?: boolean;
    leftMessage?: number;
    notAvailable?: number;
  };
  shuttleLine?: string;
  daysWorked?: number;
  daysWorkedPreviousYears?: string;
}

const WorkerbookNextDay: React.FC = () => {
  const [workers, setWorkers] = useState<Worker[]>(() => {
    return getStorageItem(STORAGE_KEYS.CONSOLE_WORKERS, []);
  });

  const navigate = useNavigate();

  useEffect(() => {
    const handleStorageChange = () => {
      setWorkers(getStorageItem(STORAGE_KEYS.CONSOLE_WORKERS, []));
    };

    window.addEventListener('storageUpdated', handleStorageChange);
    return () =>
      window.removeEventListener('storageUpdated', handleStorageChange);
  }, []);

  const tomorrow = format(addDays(getCurrentDate(), 1), 'yyyy-MM-dd');
  const today = format(getCurrentDate(), 'yyyy-MM-dd');

  const filteredWorkers = workers
    .filter(
      (w) =>
        w.bookingStatus === 'next_day' ||
        (w.bookingStatus === 'calendar' && w.bookedDate === tomorrow)
    )
    .map((worker) => {
      const wasBookedToday = worker.showedDate === today;

      return {
        ...worker,
        confirmationStatus: {
          ...worker.confirmationStatus,
          confirmed: wasBookedToday
            ? true
            : worker.confirmationStatus?.confirmed,
        },
      };
    })
    .sort((a, b) => a.lastName.localeCompare(b.lastName));

  const confirmedWorkers = filteredWorkers.filter(
    (w) => w.confirmationStatus?.confirmed
  );
  const notConfirmedWorkers = filteredWorkers.filter(
    (w) => !w.confirmationStatus?.confirmed
  );

  // Calculate first day workers (0 days worked)
  const firstDayWorkers = filteredWorkers.filter(
    (w) => !w.daysWorked && !w.daysWorkedPreviousYears
  );

  // Calculate shuttle line counts
  const shuttleCounts = filteredWorkers.reduce((acc, worker) => {
    if (worker.shuttleLine) {
      const line = worker.shuttleLine.charAt(0).toUpperCase() + 'L';
      acc[line] = (acc[line] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  const getStatusBadge = (status: string, worker: Worker) => {
    const badgeWidth = 'w-[4.5rem]'; // Fixed width for all badges

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

  const getShuttleColor = (shuttle?: string) => {
    if (!shuttle) return 'bg-gray-700 text-gray-400';

    const letter = shuttle.charAt(0).toUpperCase();
    switch (letter) {
      case 'R':
        return 'bg-red-500/30 text-red-300';
      case 'G':
        return 'bg-green-500/30 text-green-300';
      case 'B':
        return 'bg-blue-500/30 text-blue-300';
      case 'Y':
        return 'bg-yellow-500/30 text-yellow-300';
      default:
        return 'bg-gray-700 text-gray-400';
    }
  };

  const handleStatusClick = (
    workerId: string,
    status: 'confirmed' | 'leftMessage' | 'notAvailable',
    e: React.MouseEvent
  ) => {
    e.stopPropagation();

    const updatedWorkers = workers.map((worker) => {
      if (worker.contractorId === workerId) {
        const currentStatus = worker.confirmationStatus || {};

        if (status === 'confirmed') {
          return {
            ...worker,
            confirmationStatus: {
              ...currentStatus,
              confirmed: !currentStatus.confirmed,
            },
          };
        } else if (status === 'leftMessage') {
          return {
            ...worker,
            confirmationStatus: {
              ...currentStatus,
              leftMessage: (currentStatus.leftMessage || 0) + 1,
            },
          };
        } else {
          return {
            ...worker,
            confirmationStatus: {
              ...currentStatus,
              notAvailable: (currentStatus.notAvailable || 0) + 1,
            },
          };
        }
      }
      return worker;
    });

    setStorageItem(STORAGE_KEYS.CONSOLE_WORKERS, updatedWorkers);
  };

  const renderWorkerCard = (member: Worker) => (
    <div
      key={member.contractorId}
      onClick={() =>
        navigate(`/console/workerbook/contdetail/${member.contractorId}`)
      }
      className={`w-full rounded-lg px-6 py-3 border hover:bg-gray-700/80 transition-colors cursor-pointer ${
        member.confirmationStatus?.confirmed
          ? 'bg-green-900/20 border-green-900/30'
          : 'bg-gray-800 border-gray-700/50'
      }`}
    >
      <div className="flex items-center gap-4">
        {/* Left side - Shuttle, Name, Phone, Badge */}
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

        {/* Right side - NA, LM, Conf buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={(e) =>
              handleStatusClick(member.contractorId, 'notAvailable', e)
            }
            className={`h-5 px-1.5 rounded text-[10px] font-medium transition-colors ${
              member.confirmationStatus?.notAvailable
                ? 'bg-red-900/20 text-red-300'
                : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
            }`}
          >
            NA {member.confirmationStatus?.notAvailable || 0}
          </button>
          <button
            onClick={(e) =>
              handleStatusClick(member.contractorId, 'leftMessage', e)
            }
            className={`h-5 px-1.5 rounded text-[10px] font-medium transition-colors ${
              member.confirmationStatus?.leftMessage
                ? 'bg-blue-900/20 text-blue-300'
                : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
            }`}
          >
            LM {member.confirmationStatus?.leftMessage || 0}
          </button>
          <button
            onClick={(e) =>
              handleStatusClick(member.contractorId, 'confirmed', e)
            }
            className={`h-5 px-1.5 rounded text-[10px] font-medium transition-colors ${
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
  );

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col bg-black">
      {/* Stats header - Fixed position */}
      <div className="flex-none bg-black px-6">
        <div className="bg-black py-4">
          <div className="flex flex-col gap-2">
            {/* Main stats */}
            <div className="flex items-center gap-6">
              <div className="flex items-baseline gap-2">
                <span className="text-lg font-bold text-gray-300">
                  {filteredWorkers.length}
                </span>
                <span className="text-sm text-gray-400">Booked</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-lg font-bold text-gray-300">
                  {confirmedWorkers.length}
                </span>
                <span className="text-sm text-gray-400">Confirmed</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-lg font-bold text-gray-300">
                  {firstDayWorkers.length}
                </span>
                <span className="text-sm text-gray-400">First Day</span>
              </div>
            </div>

            {/* Shuttle line stats */}
            {Object.keys(shuttleCounts).length > 0 && (
              <div className="flex items-center gap-2">
                {Object.entries(shuttleCounts).map(([line, count]) => {
                  const color = line.startsWith('R')
                    ? 'bg-red-500/30 text-red-300'
                    : line.startsWith('G')
                    ? 'bg-green-500/30 text-green-300'
                    : line.startsWith('B')
                    ? 'bg-blue-500/30 text-blue-300'
                    : line.startsWith('Y')
                    ? 'bg-yellow-500/30 text-yellow-300'
                    : 'bg-gray-700 text-gray-400';

                  return (
                    <div key={line} className="flex items-center gap-1.5">
                      <div
                        className={`h-6 px-2 rounded flex items-center justify-center text-xs font-medium ${color}`}
                      >
                        {line} {count}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main content - Scrollable */}
      <div className="flex-1 overflow-y-auto px-6 pb-6 bg-[#1a2832]">
        <div className="space-y-6">
          {/* Not Confirmed Section */}
          {notConfirmedWorkers.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-gray-400 py-2">
                Not Confirmed ({notConfirmedWorkers.length})
              </h3>
              {notConfirmedWorkers.map(renderWorkerCard)}
            </div>
          )}

          {/* Confirmed Section */}
          {confirmedWorkers.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-gray-400 py-2">
                Confirmed ({confirmedWorkers.length})
              </h3>
              {confirmedWorkers.map(renderWorkerCard)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WorkerbookNextDay;
