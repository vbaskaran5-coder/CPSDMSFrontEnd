import React, { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle } from 'lucide-react';
import { useJobs } from '../contexts/JobContext';
import { getStorageItem } from '../lib/localStorage';

const SyncStatus: React.FC = () => {
  const { syncJobs, loading, error } = useJobs();
  const [showStatus, setShowStatus] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  const [lastSynced, setLastSynced] = useState<string | null>(
    getStorageItem('lastSynced', null)
  );

  useEffect(() => {
    if (showStatus) {
      const timer = setTimeout(() => {
        setShowStatus(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [showStatus]);

  const formatLastSynced = () => {
    if (!lastSynced) return 'Never synced';
    const date = new Date(lastSynced);
    return `Last synced: ${date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    })}`;
  };

  return (
    <>
      {/* Sync status toast */}
      {showStatus && (
        <div className="fixed bottom-24 left-0 right-0 mx-auto w-5/6 max-w-sm bg-white rounded-lg shadow-lg p-4 z-20 flex items-center animate-fade-in">
          {error ? (
            <AlertTriangle size={20} className="text-cps-red mr-2" />
          ) : (
            <CheckCircle size={20} className="text-cps-green mr-2" />
          )}
          <div className="flex-1">
            <p className="font-medium">{syncMessage}</p>
            <p className="text-xs text-gray-500">{formatLastSynced()}</p>
          </div>
        </div>
      )}
    </>
  );
};

export default SyncStatus;
