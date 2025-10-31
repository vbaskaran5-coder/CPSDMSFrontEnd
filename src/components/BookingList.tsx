import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useJobs } from '../contexts/JobContext';
import { Loader } from 'lucide-react';

const BookingList: React.FC = () => {
  const { bookings, loading, error } = useJobs();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[60vh]">
        <Loader className="w-8 h-8 text-cps-red animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-cps-light-red text-white p-4 rounded-lg">
        <p>{error}</p>
      </div>
    );
  }

  if (!bookings || !Array.isArray(bookings) || bookings.length === 0) {
    return (
      <div className="flex justify-center items-center h-[60vh] text-gray-400">
        <p>No bookings available</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {bookings.map((booking) => {
        const isCompleted = booking['Completed'] === 'x';
        const isNotDone =
          booking['Status'] === 'next_time' ||
          booking['Status'] === 'cancelled';
        const isPrebooked = booking.isPrebooked;
        const isContract = booking.isContract;
        const price = parseFloat(booking['Price'] || '59.99').toFixed(2);

        // Determine border and background color
        let borderColor = isPrebooked ? 'border-cps-blue' : 'border-cps-yellow';
        let bgColor = 'bg-gray-800';

        if (isContract) {
          borderColor = 'border-cps-orange';
          bgColor = 'bg-cps-dark-orange';
        } else if (isCompleted) {
          bgColor = 'bg-[#1a332e]';
        } else if (isNotDone) {
          bgColor = 'bg-[#2d0d0d]';
        }

        const handleClick = () => {
          if (isContract) {
            navigate(`/logsheet/contracts/${booking['Booking ID']}`);
          } else {
            navigate(`/logsheet/jobs/${booking['Booking ID']}`);
          }
        };

        return (
          <div
            key={booking['Booking ID']}
            onClick={handleClick}
            className={`rounded-lg p-2.5 shadow-sm hover:shadow-md transition-shadow cursor-pointer border-2 ${bgColor} ${borderColor}`}
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-baseline gap-2">
                  <h3 className="font-semibold text-gray-100">
                    {booking['First Name']} {booking['Last Name']}
                  </h3>
                  <span className="text-sm text-gray-300">
                    {booking['Full Address']}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-400">
                  {booking['Home Phone'] && (
                    <span>{booking['Home Phone']}</span>
                  )}
                  {booking['Email Address'] && (
                    <span>{booking['Email Address']}</span>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-end">
                <div className="flex items-center gap-2">
                  {booking['Prepaid'] === 'x' && (
                    <span className="bg-cps-green text-white text-xs px-2 py-0.5 rounded uppercase font-medium tracking-wide">
                      Prepaid
                    </span>
                  )}
                  <span className="font-semibold text-gray-100">${price}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-300">
                  {booking['Log Sheet Notes'] && (
                    <span className="text-gray-400">
                      {booking['Log Sheet Notes']}
                    </span>
                  )}
                  {isContract ? (
                    <span className="font-bold text-white">
                      {booking.contractTitle}
                    </span>
                  ) : (
                    <span>
                      {booking['FO/BO/FP'] === 'FO'
                        ? 'Front Only'
                        : booking['FO/BO/FP'] === 'BO'
                        ? 'Back Only'
                        : 'Full Property'}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default BookingList;
