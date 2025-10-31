// src/components/ContractorJobs.tsx
import React, { useState, useEffect } from 'react';
import {
  getStorageItem,
  STORAGE_KEYS,
  getSeasonConfigById, // Import the helper
} from '../lib/localStorage';
import { MasterBooking } from '../types'; // Import MasterBooking type

interface ContractorJobsProps {
  contractorNumber: string;
}

const ContractorJobs: React.FC<ContractorJobsProps> = ({
  contractorNumber,
}) => {
  const [bookings, setBookings] = useState<MasterBooking[]>([]);

  // Function to load bookings from the correct active season
  const loadBookings = () => {
    // 1. Find the active season
    const activeSeasonId = getStorageItem(STORAGE_KEYS.ACTIVE_SEASON_ID, null);
    const hcSeason = getSeasonConfigById(activeSeasonId);

    if (
      !hcSeason ||
      !hcSeason.storageKey ||
      !(hcSeason.storageKey in STORAGE_KEYS)
    ) {
      console.error(
        'ContractorJobs: Active season not configured or found. Cannot load jobs.'
      );
      setBookings([]); // Set to empty if no valid season
      return;
    }

    // 2. Get the correct storage key (e.g., 'bookings_east_aeration')
    const actualStorageKey = STORAGE_KEYS[hcSeason.storageKey];

    // 3. Load all bookings from that season's database
    const allBookingsForSeason: MasterBooking[] = getStorageItem(
      actualStorageKey,
      []
    );

    // 4. Load route assignments
    const routeAssignments = getStorageItem(STORAGE_KEYS.ROUTE_ASSIGNMENTS, {});

    // 5. Filter bookings for this specific contractor
    const filteredBookings = allBookingsForSeason.filter((booking) => {
      // Check if booking is directly assigned to contractor by Contractor Number
      const isDirectlyAssigned =
        booking['Contractor Number'] === contractorNumber;

      // Check if booking's route is assigned to contractor
      const isRouteAssigned =
        booking['Route Number'] &&
        routeAssignments[booking['Route Number']] === contractorNumber;

      return isDirectlyAssigned || isRouteAssigned;
    });

    setBookings(filteredBookings);
  };

  useEffect(() => {
    loadBookings(); // Load on component mount

    // Listen for any storage update that might affect this component
    const handleStorageChange = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (
        detail?.key === STORAGE_KEYS.ROUTE_ASSIGNMENTS ||
        detail?.key === STORAGE_KEYS.ACTIVE_SEASON_ID ||
        (detail?.key && detail.key.startsWith('bookings_'))
      ) {
        loadBookings();
      }
    };

    window.addEventListener('storageUpdated', handleStorageChange);
    // Also listen for bookingStoreRefreshed if Admin console is open and makes changes
    window.addEventListener('bookingStoreRefreshed', loadBookings);

    return () => {
      window.removeEventListener('storageUpdated', handleStorageChange);
      window.removeEventListener('bookingStoreRefreshed', loadBookings);
    };
  }, [contractorNumber]); // Re-run if the contractor prop itself changes

  // Filter jobs by status
  const completedJobs = bookings.filter(
    (booking) => booking['Completed'] === 'x'
  );
  const pendingJobs = bookings.filter(
    (booking) => !booking['Completed'] && !booking['Status']
  );
  // <<< FIX: Added check to ensure job is NOT completed >>>
  const notDoneJobs = bookings.filter(
    (booking) => !!booking['Status'] && booking['Completed'] !== 'x'
  );

  const getPaymentBadgeColor = (method: string) => {
    if (!method) return 'bg-gray-700 text-gray-200'; // Default for undefined
    const lowerMethod = method.toLowerCase();

    if (lowerMethod.includes('cash')) return 'bg-cps-red text-white';
    if (lowerMethod.includes('cheque')) return 'bg-cps-yellow text-yellow-900';
    if (lowerMethod.includes('credit')) return 'bg-purple-900 text-purple-100';
    if (lowerMethod.includes('transfer'))
      return 'bg-purple-700 text-purple-100';
    if (lowerMethod.includes('pp')) return 'bg-green-900 text-green-100'; // Check for 'pp'
    if (lowerMethod.includes('prepaid')) return 'bg-green-900 text-green-100';
    if (lowerMethod.includes('billed')) return 'bg-green-700 text-green-100';

    return 'bg-gray-700 text-gray-200'; // Default
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'next_time':
        return 'bg-cps-yellow text-yellow-900';
      case 'cancelled':
      case 'ref/dnb':
        return 'bg-cps-red text-white';
      case 'redo':
        return 'bg-blue-900 text-blue-100';
      case 'pending': // Added pending for the 'Not Done' section
        return 'bg-gray-700 text-gray-200';
      default:
        return 'bg-gray-700 text-gray-200';
    }
  };

  const getStatusBadgeText = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'next_time':
        return '2ND RUN';
      case 'cancelled':
        return 'CANC';
      case 'ref/dnb':
        return 'REF/DNB';
      case 'redo':
        return 'REDO';
      case 'pending':
        return 'PENDING'; // Added pending
      default:
        return status?.toUpperCase().substring(0, 7) || 'N/A'; // Show status, truncated
    }
  };

  const renderJobCard = (job: MasterBooking, showPayment: boolean = true) => {
    const isPrebooked = job.isPrebooked;
    let paymentMethod =
      job['Prepaid'] === 'x'
        ? 'PP'
        : (job['Payment Method'] || '').toUpperCase();

    // Abbreviate common methods for display
    if (paymentMethod) {
      if (paymentMethod.includes('CREDIT')) paymentMethod = 'CCD';
      else if (paymentMethod.includes('TRANSFER')) paymentMethod = 'ETF';
      else if (paymentMethod.includes('CHEQUE')) paymentMethod = 'CHQ';
      else if (paymentMethod.includes('CASH')) paymentMethod = 'CSH';
      else if (paymentMethod.includes('BILLED')) paymentMethod = 'BILL';
    }

    const badgeColor = showPayment
      ? getPaymentBadgeColor(paymentMethod)
      : getStatusBadgeColor(job['Status'] || '');

    const badgeText = showPayment
      ? paymentMethod || 'N/A'
      : getStatusBadgeText(job['Status'] || '');

    return (
      <div
        key={job['Booking ID']}
        className={`rounded-md p-2 flex items-center justify-between border ${
          isPrebooked ? 'border-cps-blue' : 'border-cps-yellow'
        } bg-gray-700/30`}
      >
        <div className="flex items-center gap-2 text-sm">
          {job['Route Number'] && (
            <span className="text-cps-blue">{job['Route Number']}</span>
          )}
          <span className="text-gray-300 truncate" title={job['Full Address']}>
            {job['Full Address']}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-200">
            ${parseFloat(job['Price'] || '59.99').toFixed(2)}
          </span>
          <span
            className={`text-[10px] w-10 text-center px-1 py-0.5 rounded-full font-medium leading-none ${badgeColor}`}
          >
            {badgeText}
          </span>
        </div>
      </div>
    );
  };

  // Re-order display: Pending, then Not Done, then Completed
  if (!completedJobs.length && !pendingJobs.length && !notDoneJobs.length) {
    return <div className="text-gray-400 text-sm mt-2 px-2">No jobs found</div>;
  }

  return (
    <div className="mt-4 space-y-4 px-3 pb-2">
      {pendingJobs.length > 0 && (
        <div className="space-y-1.5">
          <h4 className="text-xs font-medium text-gray-400 px-2">Pending</h4>
          {pendingJobs.map((job) => renderJobCard(job, false))}{' '}
          {/* Show status badge */}
        </div>
      )}

      {notDoneJobs.length > 0 && (
        <div className="space-y-1.5">
          <h4 className="text-xs font-medium text-gray-400 px-2">Not Done</h4>
          {notDoneJobs.map((job) => renderJobCard(job, false))}
        </div>
      )}

      {completedJobs.length > 0 && (
        <div className="space-y-1.5">
          <h4 className="text-xs font-medium text-gray-400 px-2">Completed</h4>
          {completedJobs.map((job) => renderJobCard(job, true))}{' '}
          {/* Show payment badge */}
        </div>
      )}
    </div>
  );
};

export default ContractorJobs;
