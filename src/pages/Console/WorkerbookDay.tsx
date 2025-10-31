import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import PayoutToday from './PayoutToday';
import { getStorageItem, STORAGE_KEYS } from '../../lib/localStorage';

interface Worker {
  contractorId: string;
  firstName: string;
  lastName: string;
  cellPhone: string;
  status: string;
  bookingStatus?: 'calendar';
  bookedDate?: string;
}

const WorkerbookDay: React.FC = () => {
  const { date } = useParams<{ date: string }>();
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [isFinalized, setIsFinalized] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (date) {
      const allWorkers = getStorageItem(STORAGE_KEYS.CONSOLE_WORKERS, []);
      const dayWorkers = allWorkers.filter(
        (w: Worker) => w.bookedDate === date && w.bookingStatus === 'calendar'
      );
      setWorkers(dayWorkers);

      const finalized = getStorageItem(`attendanceFinalized_${date}`, false);
      setIsFinalized(finalized === 'true');
    }
  }, [date]);

  if (!date) {
    return <div>No date specified.</div>;
  }

  if (isFinalized) {
    return <PayoutToday date={date} />;
  }

  return (
    <div className="px-6">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-medium text-white">
          Booked for {format(parseISO(date), 'MMMM d, yyyy')}
        </h2>
        <span className="text-sm text-gray-400">({workers.length})</span>
      </div>

      <div className="space-y-2 mt-4">
        {workers.map((worker) => (
          <div
            key={worker.contractorId}
            onClick={() =>
              navigate(`/console/workerbook/contdetail/${worker.contractorId}`)
            }
            className="w-full bg-gray-800 rounded-lg px-6 py-3 border border-gray-700/50 hover:bg-gray-700/80 transition-colors cursor-pointer"
          >
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
          </div>
        ))}
        {workers.length === 0 && (
          <p className="text-gray-400 mt-4 text-center">
            No workers booked for this day.
          </p>
        )}
      </div>
    </div>
  );
};

export default WorkerbookDay;
