// src/pages/Management/AdminReset.tsx
import React, { useState } from 'react';
import { RotateCcw, Loader, AlertCircle } from 'lucide-react';
import { STORAGE_KEYS, removeStorageItem } from '../../lib/localStorage';
import { ensureEastTerritoryStructureFetched } from '../../lib/dataSyncService';

const AdminReset: React.FC = () => {
  const [resetting, setResetting] = useState(false);

  const handleReset = async (type: 'full' | 'excludePanel') => {
    const confirmationText =
      type === 'full'
        ? 'Are you sure you want to perform a "Full Reset"?\n\nThis will clear ALL application data including login sessions, bookings, settings, and cached territory info.'
        : 'Are you sure you want to perform an "App Data Only" reset?\n\nThis will clear daily operational data (logins, assignments, daily worker status) but keeps Admin Panel configurations.';

    if (!window.confirm(confirmationText)) {
      return;
    }

    setResetting(true);

    const keysToExcludeOnPartialReset = [
      STORAGE_KEYS.MANAGEMENT_USERS,
      STORAGE_KEYS.USER_PERMISSIONS,
      STORAGE_KEYS.CONSOLE_PROFILES,
      STORAGE_KEYS.SERVICES,
      STORAGE_KEYS.UPSELL_MENUS,
      STORAGE_KEYS.TERRITORY_ASSIGNMENTS,
      STORAGE_KEYS.EAST_TERRITORY_STRUCTURE,
    ];

    const allKnownStaticKeys = Object.values(STORAGE_KEYS);
    const keysToRemove: string[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        let shouldRemove = false;

        if (allKnownStaticKeys.includes(key as any)) {
          shouldRemove = true;
        } else if (
          key.startsWith('routeAssignments_') ||
          key.startsWith('mapAssignments_') ||
          key.startsWith('attendanceFinalized_') ||
          key.startsWith('payout_logic_settings')
        ) {
          shouldRemove = true;
        } else if (['lastSynced', 'cps_settings'].includes(key)) {
          shouldRemove = true;
        }

        if (shouldRemove) {
          if (
            type === 'excludePanel' &&
            keysToExcludeOnPartialReset.includes(key as any)
          ) {
            // Do not remove
          } else {
            keysToRemove.push(key);
          }
        }
      }
    }

    console.log(`Resetting session (${type}), removing keys:`, keysToRemove);
    keysToRemove.forEach((key) => {
      removeStorageItem(key);
    });

    if (type === 'full') {
      try {
        console.log(
          'Performing full reset, forcing territory structure re-fetch...'
        );
        await ensureEastTerritoryStructureFetched(true);
        console.log('Territory structure re-fetched successfully.');
      } catch (e) {
        console.error(
          'Failed to re-fetch territory structure after full reset:',
          e
        );
        alert(
          `Warning: Failed to refresh territory data after reset. Error: ${
            e instanceof Error ? e.message : 'Unknown error'
          }`
        );
      }
    }

    setTimeout(() => {
      window.location.href = '/'; // Go to login page after reset
    }, 500);
  };

  return (
    <div className="animate-fade-in">
      <h2 className="text-3xl font-bold text-white mb-8">Reset Application</h2>

      <div className="max-w-xl bg-gray-800 p-6 rounded-lg border border-gray-700">
        <div className="mb-4 p-3 bg-red-900/30 text-red-300 border border-red-700 rounded-md text-sm flex items-start gap-2">
          <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold mb-1">Warning: Destructive Action</h4>
            <p>
              Resetting the application will clear data from your browser's
              localStorage. This action is irreversible.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-white">Full Reset</h3>
            <p className="text-sm text-gray-400 mb-3">
              Clears ALL application data including users, console profiles,
              bookings, settings, and cached territory info. Use this if the
              app is completely broken or you want a fresh start.
            </p>
            <button
              onClick={() => handleReset('full')}
              disabled={resetting}
              className="w-full py-2 bg-red-700 text-white rounded-md hover:bg-red-800 transition-colors disabled:opacity-50 disabled:cursor-wait flex items-center justify-center gap-2"
            >
              {resetting ? (
                <Loader size={16} className="animate-spin" />
              ) : (
                <RotateCcw size={16} />
              )}
              {resetting ? 'Resetting...' : 'Perform Full Reset'}
            </button>
          </div>

          <div className="border-t border-gray-700 pt-4">
            <h3 className="text-lg font-semibold text-white">
              Reset App Data Only
            </h3>
            <p className="text-sm text-gray-400 mb-3">
              Clears daily operational data (logins, assignments, worker
              status) but keeps Admin Panel configurations (Users, Consoles,
              Territory) intact. Use this for minor glitches.
            </p>
            <button
              onClick={() => handleReset('excludePanel')}
              disabled={resetting}
              className="w-full py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 transition-colors disabled:opacity-50 disabled:cursor-wait flex items-center justify-center gap-2"
            >
              {resetting ? (
                <Loader size={16} className="animate-spin" />
              ) : (
                <RotateCcw size={16} />
              )}
              {resetting ? 'Resetting...' : 'Reset App Data Only'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminReset;