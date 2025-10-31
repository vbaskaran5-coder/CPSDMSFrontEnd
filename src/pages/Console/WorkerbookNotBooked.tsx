import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, Loader } from 'lucide-react';
import Papa from 'papaparse';
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
  homePhone: string;
  email: string;
  address: string;
  city: string;
  status: string;
  daysWorkedPreviousYears: string;
  aerationSilversPreviousYears: string;
  rejuvSilversPreviousYears: string;
  sealingSilversPreviousYears: string;
  cleaningSilversPreviousYears: string;
  shuttleLine: string;
  bookingStatus?:
    | 'today'
    | 'next_day'
    | 'calendar'
    | 'wdr_tnb'
    | 'quit_fired'
    | 'new';
  bookedDate?: string;
}

const WorkerbookNotBooked: React.FC = () => {
  const [workers, setWorkers] = useState<Worker[]>(() => {
    return getStorageItem(STORAGE_KEYS.CONSOLE_WORKERS, [])
      .filter((w: Worker) => !w.bookingStatus) // Only show workers without a booking status
      .sort((a: Worker, b: Worker) => a.lastName.localeCompare(b.lastName));
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedWorkers, setSelectedWorkers] = useState<Set<string>>(
    new Set()
  );
  const navigate = useNavigate();

  useEffect(() => {
    const handleStorageChange = () => {
      const savedWorkers = getStorageItem(STORAGE_KEYS.CONSOLE_WORKERS, []);
      setWorkers(
        savedWorkers
          .filter((w: Worker) => !w.bookingStatus) // Only show workers without a booking status
          .sort((a: Worker, b: Worker) => a.lastName.localeCompare(b.lastName))
      );
    };

    window.addEventListener('storageUpdated', handleStorageChange);
    return () =>
      window.removeEventListener('storageUpdated', handleStorageChange);
  }, []);

  const formatPhoneNumber = (phone: string): string => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(
        6
      )}`;
    }
    return phone;
  };

  const handleImport = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        'https://docs.google.com/spreadsheets/d/1KPRTH3bESAi-0-2K9v1b-hOUGdCqzLD0D4mdKCSMs-0/gviz/tq?tqx=out:csv&sheet=Workers'
      );

      if (!response.ok) {
        throw new Error('Failed to fetch workers data');
      }

      const text = await response.text();
      const result = Papa.parse(text, {
        header: false,
        skipEmptyLines: true,
      });

      if (!result.data || !Array.isArray(result.data)) {
        throw new Error('Invalid data format received');
      }

      // Get all existing workers
      const existingWorkers = getStorageItem(STORAGE_KEYS.CONSOLE_WORKERS, []);

      // Create a map of existing workers by contractorId
      const existingWorkersMap = new Map(
        existingWorkers.map((worker: Worker) => [worker.contractorId, worker])
      );

      // Process workers data, skipping duplicates
      const newWorkers = result.data
        .slice(1)
        .filter((row) => {
          const contractorId = row[0]?.toString().trim();
          return contractorId && !existingWorkersMap.has(contractorId);
        })
        .map((row) => ({
          contractorId: row[0]?.toString().trim() || '',
          firstName: row[1]?.toString().trim() || '',
          lastName: row[2]?.toString().trim() || '',
          cellPhone: formatPhoneNumber(row[3]?.toString().trim() || ''),
          homePhone: formatPhoneNumber(row[4]?.toString().trim() || ''),
          email: row[5]?.toString().trim() || '',
          address: row[6]?.toString().trim() || '',
          city: row[7]?.toString().trim() || '',
          status:
            row[8]?.toString().trim().toLowerCase() === 'alumni'
              ? 'Alumni'
              : row[8]?.toString().trim().toLowerCase() === 'rookie'
              ? 'Rookie'
              : '',
          daysWorkedPreviousYears: row[9]?.toString().trim() || '',
          aerationSilversPreviousYears: row[10]?.toString().trim() || '',
          rejuvSilversPreviousYears: row[11]?.toString().trim() || '',
          sealingSilversPreviousYears: row[12]?.toString().trim() || '',
          cleaningSilversPreviousYears: row[13]?.toString().trim() || '',
          shuttleLine: row[14]?.toString().trim() || '',
        }));

      // Combine existing and new workers
      const combinedWorkers = [...existingWorkers, ...newWorkers];

      // Save to localStorage
      setStorageItem(STORAGE_KEYS.CONSOLE_WORKERS, combinedWorkers);

      setError(null);
    } catch (error) {
      console.error('Error importing workers:', error);
      setError(
        error instanceof Error ? error.message : 'Failed to import workers'
      );
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'alumni':
        return (
          <span className="text-[10px] px-1.5 py-0.5 bg-purple-900/20 text-purple-300 rounded">
            Alumni
          </span>
        );
      case 'rookie':
        return (
          <span className="text-[10px] px-1.5 py-0.5 bg-green-900/20 text-green-300 rounded">
            Rookie
          </span>
        );
      default:
        return null;
    }
  };

  const toggleWorker = (workerId: string, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent navigation when clicking checkbox
    const newSelected = new Set(selectedWorkers);
    if (newSelected.has(workerId)) {
      newSelected.delete(workerId);
    } else {
      newSelected.add(workerId);
    }
    setSelectedWorkers(newSelected);
  };

  const handleMoveSelected = () => {
    if (selectedWorkers.size === 0) return;

    const workerIds = Array.from(selectedWorkers);
    const queryParams = workerIds.map((id) => `workerId=${id}`).join('&');
    navigate(`/console/workerbook/move-workers?${queryParams}`);
  };

  if (loading) {
    return (
      <div className="px-6">
        <div className="flex justify-center items-center h-[60vh]">
          <Loader className="w-8 h-8 text-cps-blue animate-spin" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-6">
        <div className="bg-cps-light-red text-white p-4 rounded-lg">
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-medium text-white">Not Booked</h2>
          <span className="text-sm text-gray-400">({workers.length})</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleMoveSelected}
            disabled={selectedWorkers.size === 0}
            className="flex items-center gap-2 px-3 py-1.5 bg-cps-blue text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="text-sm">
              Move Selected ({selectedWorkers.size})
            </span>
          </button>
          <button
            onClick={handleImport}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 bg-cps-blue text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download size={16} />
            <span className="text-sm">Import Workers</span>
          </button>
        </div>
      </div>

      <div className="space-y-2 mt-4">
        {workers.map((member) => (
          <div
            key={member.contractorId}
            className="w-full bg-gray-800 rounded-lg px-6 py-3 border border-gray-700/50 flex items-center gap-4 hover:bg-gray-700/80 transition-colors"
          >
            <div className="flex items-center h-5">
              <input
                type="checkbox"
                checked={selectedWorkers.has(member.contractorId)}
                onChange={(e) => e.stopPropagation()} // Prevent change event from bubbling
                onClick={(e) => toggleWorker(member.contractorId, e)}
                className="h-4 w-4 rounded border-gray-600 bg-gray-700 text-cps-blue focus:ring-cps-blue cursor-pointer"
              />
            </div>

            <button
              onClick={() =>
                navigate(
                  `/console/workerbook/contdetail/${member.contractorId}`
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
                {getStatusBadge(member.status)}
              </div>

              <div className="text-sm text-gray-400">{member.cellPhone}</div>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default WorkerbookNotBooked;
