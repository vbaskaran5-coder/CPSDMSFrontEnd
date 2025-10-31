import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { format, addMonths, subMonths, isPast } from 'date-fns';
import { getCurrentDate } from '../../lib/date';
import { getStorageItem, STORAGE_KEYS } from '../../lib/localStorage';

interface Worker {
  contractorId: string;
  bookingStatus?:
    | 'today'
    | 'next_day'
    | 'calendar'
    | 'wdr_tnb'
    | 'quit_fired'
    | 'new';
  bookedDate?: string;
  showedDate?: string;
  payoutCompleted?: boolean;
  grossSales?: number;
}

interface DayStat {
  workerCount: number;
  grossSales: number;
}

const WorkerbookCalendar: React.FC = () => {
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(getCurrentDate());
  const [workerCounts, setWorkerCounts] = useState<Record<string, number>>({});
  const [dayStats, setDayStats] = useState<Record<string, DayStat>>({});

  useEffect(() => {
    const updateStats = () => {
      const workers = getStorageItem(
        STORAGE_KEYS.CONSOLE_WORKERS,
        []
      ) as Worker[];

      const bookingCounts: Record<string, number> = {};
      const dailyStats: Record<
        string,
        { totalSales: number; showedCount: number; paidCount: number }
      > = {};

      // Group workers by day and calculate stats
      workers.forEach((worker) => {
        // Aggregate stats for days workers showed up
        if (worker.showedDate) {
          if (!dailyStats[worker.showedDate]) {
            dailyStats[worker.showedDate] = {
              totalSales: 0,
              showedCount: 0,
              paidCount: 0,
            };
          }
          dailyStats[worker.showedDate].showedCount++;
          if (worker.payoutCompleted) {
            dailyStats[worker.showedDate].paidCount++;
            dailyStats[worker.showedDate].totalSales += worker.grossSales || 0;
          }
        }
        // Aggregate booking counts
        if (worker.bookingStatus === 'calendar' && worker.bookedDate) {
          bookingCounts[worker.bookedDate] =
            (bookingCounts[worker.bookedDate] || 0) + 1;
        }
      });

      const finalDayStats: Record<string, DayStat> = {};
      for (const date in dailyStats) {
        const dayData = dailyStats[date];
        // If all workers who showed up have been paid out, finalize the stats for that day
        if (
          dayData.showedCount > 0 &&
          dayData.showedCount === dayData.paidCount
        ) {
          finalDayStats[date] = {
            workerCount: dayData.showedCount,
            grossSales: dayData.totalSales,
          };
        }
      }

      setWorkerCounts(bookingCounts);
      setDayStats(finalDayStats);
    };

    updateStats();

    window.addEventListener('storageUpdated', updateStats);
    return () => window.removeEventListener('storageUpdated', updateStats);
  }, []);

  const previousMonth = () => {
    setCurrentDate(subMonths(currentDate, 1));
  };

  const nextMonth = () => {
    setCurrentDate(addMonths(currentDate, 1));
  };

  const handleDateClick = (day: number) => {
    const selectedDate = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      day
    );
    const formattedDate = format(selectedDate, 'yyyy-MM-dd');
    const today = format(getCurrentDate(), 'yyyy-MM-dd');

    if (formattedDate === today) {
      navigate('/console/workerbook');
    } else {
      navigate(`/console/workerbook/day/${formattedDate}`);
    }
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
      const dateString = format(calendarDate, 'yyyy-MM-dd');
      const dayStat = dayStats[dateString];
      const workerCount = workerCounts[dateString] || 0;
      const today = getCurrentDate();
      const isPastDate =
        isPast(calendarDate) &&
        format(calendarDate, 'yyyy-MM-dd') !== format(today, 'yyyy-MM-dd');
      const isToday =
        format(calendarDate, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd');

      currentRow.push(
        <td key={day} className="border border-gray-700/50 p-0">
          <button
            onClick={() => handleDateClick(day)}
            className={`w-full h-14 flex flex-col items-center justify-center transition-colors ${
              isPastDate && !dayStat
                ? 'text-gray-600 cursor-not-allowed'
                : isToday
                ? 'bg-cps-blue text-white hover:bg-blue-700'
                : 'text-gray-300 hover:bg-gray-700'
            }`}
            disabled={isPastDate && !dayStat}
          >
            <span className="text-sm">{day}</span>
            {dayStat ? (
              <span className="text-xs mt-0.5 font-bold text-green-300">
                {dayStat.workerCount}W - ${dayStat.grossSales.toFixed(0)}
              </span>
            ) : workerCount > 0 ? (
              <span
                className={`text-xs mt-0.5 font-bold ${
                  isToday ? 'text-white' : 'text-cps-blue'
                }`}
              >
                {workerCount}B
              </span>
            ) : null}
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-medium text-white">Calendar View</h2>
        </div>
      </div>

      <div className="bg-gray-800 rounded-lg p-4">
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
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <th
                  key={day}
                  className="border border-gray-700/50 p-1 text-xs font-medium text-gray-400"
                >
                  {day}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>{renderCalendar()}</tbody>
        </table>
      </div>
    </div>
  );
};

export default WorkerbookCalendar;
