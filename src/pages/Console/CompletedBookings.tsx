import React, { useState, useEffect } from 'react';
import { bookingStore } from '../../stores/AdminBookingStore';
import { MasterBooking, Worker, Service } from '../../types';
import { format, parseISO } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { getStorageItem, STORAGE_KEYS } from '../../lib/localStorage';
import { Tag } from 'lucide-react';

const CompletedBookings: React.FC = () => {
  const [completedBookings, setCompletedBookings] = useState<MasterBooking[]>(
    []
  );
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const loadData = () => {
      setLoading(true);
      const allWorkers: Worker[] = getStorageItem(
        STORAGE_KEYS.CONSOLE_WORKERS,
        []
      );
      setWorkers(allWorkers);

      const allBookings = bookingStore.getAllBookings();
      const filteredAndSorted = allBookings
        .filter((b) => b.Completed === 'x' && !b.isContract)
        .sort((a, b) => {
          const dateA = a['Date Completed']
            ? parseISO(a['Date Completed'])
            : new Date(0);
          const dateB = b['Date Completed']
            ? parseISO(b['Date Completed'])
            : new Date(0);
          return dateB.getTime() - dateA.getTime();
        });
      setCompletedBookings(filteredAndSorted);
      setLoading(false);
    };

    loadData();
    window.addEventListener('storageUpdated', loadData);
    return () => window.removeEventListener('storageUpdated', loadData);
  }, []);

  const getContractorName = (booking: MasterBooking): string => {
    const contractorId = booking['Contractor Number'];
    if (!contractorId) return 'N/A';

    const worker = workers.find((w) => w.contractorId === contractorId);
    if (!worker) return `#${contractorId}`;

    // If part of a cart, find all team members
    if (worker.cartId) {
      const teamMembers = workers.filter((w) => w.cartId === worker.cartId);
      if (teamMembers.length > 0) {
        return teamMembers.map((m) => m.firstName).join(', ');
      }
    }

    return `${worker.firstName} ${worker.lastName}`;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cps-blue"></div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-4">Completed Jobs</h2>
      <div className="bg-gray-800 rounded-lg overflow-x-auto">
        <table className="w-full text-left table-fixed">
          <thead className="border-b border-gray-700">
            <tr>
              <th className="p-3 text-xs text-gray-400 font-medium w-[10%]">
                Date
              </th>
              <th className="p-3 text-xs text-gray-400 font-medium w-[15%]">
                Customer
              </th>
              <th className="p-3 text-xs text-gray-400 font-medium w-[20%]">
                Contractor(s)
              </th>
              <th className="p-3 text-xs text-gray-400 font-medium w-[10%]">
                Type
              </th>
              <th className="p-3 text-xs text-gray-400 font-medium w-[20%]">
                Services
              </th>
              <th className="p-3 text-xs text-gray-400 font-medium w-[15%]">
                Payment
              </th>
              <th className="p-3 text-xs text-gray-400 font-medium w-[10%] text-right">
                Amount
              </th>
            </tr>
          </thead>
          <tbody>
            {completedBookings.map((booking) => (
              <tr
                key={booking['Booking ID']}
                className="border-b border-gray-700/50 hover:bg-gray-700/30"
              >
                <td className="p-3 text-sm text-gray-300 whitespace-nowrap">
                  {booking['Date Completed']
                    ? format(parseISO(booking['Date Completed']), 'MMM d, yyyy')
                    : 'N/A'}
                </td>
                <td className="p-3 text-sm text-gray-300 truncate">
                  {booking['First Name']} {booking['Last Name']}
                </td>
                <td className="p-3 text-sm text-gray-300 truncate">
                  {getContractorName(booking)}
                </td>
                <td className="p-3 text-sm">
                  {booking.isPrebooked ? (
                    <span className="px-2 py-0.5 text-xs rounded-full bg-green-900/40 text-green-300">
                      Pre-Book
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 text-xs rounded-full bg-yellow-900/40 text-yellow-300">
                      New Sale
                    </span>
                  )}
                </td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-1">
                    {(booking.services || []).map((service: Service) => (
                      <span
                        key={service.id}
                        className="flex items-center gap-1.5 text-xs bg-blue-900/40 text-blue-300 px-2 py-1 rounded-full"
                      >
                        <Tag size={12} />
                        {service.name}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="p-3 text-sm text-gray-300 truncate">
                  {booking['Payment Method']}
                </td>
                <td className="p-3 text-sm text-white font-medium text-right">
                  ${parseFloat(booking.Price || '0').toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {completedBookings.length === 0 && (
          <p className="text-center text-gray-400 py-8">
            No completed jobs found.
          </p>
        )}
      </div>
    </div>
  );
};

export default CompletedBookings;
