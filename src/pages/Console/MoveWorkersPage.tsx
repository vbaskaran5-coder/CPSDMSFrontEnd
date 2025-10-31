import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { format, addMonths, subMonths, isPast } from 'date-fns';
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  getStorageItem,
  setStorageItem,
  STORAGE_KEYS,
} from '../../lib/localStorage';

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
}

const MoveWorkersPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [currentDate, setCurrentDate] = useState(new Date());

  // Extract selected worker IDs from query parameters
  const searchParams = new URLSearchParams(location.search);
  const selectedWorkers = searchParams.getAll('workerId');

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

    // Move selected workers to the chosen date
    const allWorkers = getStorageItem(STORAGE_KEYS.CONSOLE_WORKERS, []);
    const updatedWorkers = allWorkers.map((worker: any) => {
      if (selectedWorkers.includes(worker.contractorId)) {
        return {
          ...worker,
          bookingStatus: 'calendar',
          bookedDate: formattedDate,
        };
      }
      return worker;
    });
    setStorageItem(STORAGE_KEYS.CONSOLE_WORKERS, updatedWorkers);

    navigate('/console/workerbook/calendar');
  };

  const handleStatusChange = (status: 'wdr_tnb' | 'quit_fired') => {
    const allWorkers = getStorageItem(STORAGE_KEYS.CONSOLE_WORKERS, []);
    const updatedWorkers = allWorkers.map((worker: any) => {
      if (selectedWorkers.includes(worker.contractorId)) {
        return {
          ...worker,
          bookingStatus: status,
          bookedDate: null,
        };
      }
      return worker;
    });
    setStorageItem(STORAGE_KEYS.CONSOLE_WORKERS, updatedWorkers);

    navigate(`/console/workerbook/${status}`);
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
      const isDisabled = isPast(calendarDate);
      const isToday =
        format(calendarDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');

      currentRow.push(
        <td key={day} className="border border-gray-700/50 p-0">
          <button
            onClick={() => handleDateClick(day)}
            disabled={isDisabled && !isToday}
            className={`w-full h-14 flex flex-col items-center justify-center transition-colors ${
              isDisabled && !isToday
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/console/workerbook/not-booked')}
            className="p-2 hover:bg-gray-700 rounded-full transition-colors"
          >
            <ArrowLeft className="text-gray-400" />
          </button>
          <div>
            <h2 className="text-lg font-medium text-white">Move Workers</h2>
            <p className="text-sm text-gray-400">
              Select a date or status for the selected workers.
            </p>
          </div>
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

      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => handleStatusChange('wdr_tnb')}
          className="bg-gray-800 hover:bg-gray-700 text-white py-2 px-4 rounded-lg transition-colors text-center text-sm"
        >
          WDR/TNB
        </button>
        <button
          onClick={() => handleStatusChange('quit_fired')}
          className="bg-gray-800 hover:bg-gray-700 text-white py-2 px-4 rounded-lg transition-colors text-center text-sm"
        >
          Quit/Fired
        </button>
      </div>
    </div>
  );
};

export default MoveWorkersPage;
