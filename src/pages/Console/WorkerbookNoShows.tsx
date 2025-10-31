import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { getStorageItem, STORAGE_KEYS } from '../../lib/localStorage';

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
    | 'new'
    | 'no_show';
  bookedDate?: string;
  showed?: boolean;
  showedDate?: string;
  routeManager?: {
    name: string;
    initials: string;
  };
  shuttleLine?: string;
  daysWorked?: number;
  daysWorkedPreviousYears?: string;
  noShows?: number;
  lastNoShowDate?: string;
}

const WorkerbookNoShows: React.FC = () => {
  const [workers, setWorkers] = useState<Worker[]>(() => {
    return getStorageItem(STORAGE_KEYS.CONSOLE_WORKERS, [])
      .filter((w: Worker) => w.bookingStatus === 'no_show')
      .sort((a: Worker, b: Worker) => (b.noShows || 0) - (a.noShows || 0));
  });

  const navigate = useNavigate();

  useEffect(() => {
    const handleStorageChange = () => {
      const updatedWorkers = getStorageItem(STORAGE_KEYS.CONSOLE_WORKERS, [])
        .filter((w: Worker) => w.bookingStatus === 'no_show')
        .sort((a: Worker, b: Worker) => (b.noShows || 0) - (a.noShows || 0));
      setWorkers(updatedWorkers);
    };

    window.addEventListener('storageUpdated', handleStorageChange);
    return () =>
      window.removeEventListener('storageUpdated', handleStorageChange);
  }, []);

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

  return (
    <div className="px-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-medium text-white">No Shows</h2>
          <span className="text-sm text-gray-400">({workers.length})</span>
        </div>
      </div>

      <div className="space-y-2 mt-4">
        {workers.map((member) => (
          <div
            key={member.contractorId}
            onClick={() =>
              navigate(`/console/workerbook/contdetail/${member.contractorId}`)
            }
            className="w-full bg-gray-800 rounded-lg px-6 py-3 border border-gray-700/50 hover:bg-gray-700/80 transition-colors cursor-pointer"
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

              {/* Right side - No Shows count and last date */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm text-gray-400">No Shows:</span>
                  <span className="text-sm font-medium text-red-400">
                    {member.noShows}
                  </span>
                </div>
                {member.showedDate && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm text-gray-400">Last:</span>
                    <span className="text-sm font-medium text-gray-300">
                      {format(new Date(member.showedDate), 'MMM d')}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default WorkerbookNoShows;
