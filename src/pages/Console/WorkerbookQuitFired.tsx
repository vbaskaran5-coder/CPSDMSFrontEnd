import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
    | 'new';
  subStatus?: 'WDR' | 'TNB' | 'Quit' | 'Fired';
  bookedDate?: string;
}

const WorkerbookQuitFired: React.FC = () => {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const loadWorkers = () => {
      const allWorkers = getStorageItem(
        STORAGE_KEYS.CONSOLE_WORKERS,
        []
      ) as Worker[];
      const filtered = allWorkers.filter(
        (w) => w.bookingStatus === 'quit_fired'
      );
      setWorkers(filtered);
    };

    loadWorkers();

    window.addEventListener('storageUpdated', loadWorkers);
    return () => window.removeEventListener('storageUpdated', loadWorkers);
  }, []);

  const getReasonBadge = (reason?: string) => {
    if (!reason) return null;
    const color = 'bg-red-900/20 text-red-300';

    return (
      <span className={`text-xs px-2 py-1 rounded font-medium ${color}`}>
        {reason}
      </span>
    );
  };

  return (
    <div className="px-6">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-medium text-white">Quit/Fired</h2>
        <span className="text-sm text-gray-400">({workers.length})</span>
      </div>

      <div className="space-y-2 mt-4">
        {workers.map((worker) => (
          <div
            key={worker.contractorId}
            onClick={() =>
              navigate(`/console/workerbook/contdetail/${worker.contractorId}`)
            }
            className="w-full bg-gray-800 rounded-lg px-6 py-3 border border-gray-700/50 hover:bg-gray-700/80 transition-colors cursor-pointer flex items-center justify-between"
          >
            <div className="flex items-center gap-4">
              <div className="w-16 text-xs text-gray-400">
                #{worker.contractorId}
              </div>
              <div className="flex-1 flex items-center gap-2">
                <h3 className="text-sm text-gray-300">
                  {worker.firstName} {worker.lastName}
                </h3>
              </div>
              <div className="text-sm text-gray-400">{worker.cellPhone}</div>
            </div>
            <div>{getReasonBadge(worker.subStatus)}</div>
          </div>
        ))}
        {workers.length === 0 && (
          <p className="text-gray-400 mt-4 text-center">
            No workers in this category.
          </p>
        )}
      </div>
    </div>
  );
};

export default WorkerbookQuitFired;
