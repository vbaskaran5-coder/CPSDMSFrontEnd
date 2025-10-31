import React, { useState } from 'react';
import { X, Save } from 'lucide-react';
import { MasterBooking } from '../types';

interface EditBookingModalProps {
  booking: MasterBooking;
  onSave: (bookingId: string, updates: Partial<MasterBooking>) => void;
  onClose: () => void;
}

const EditBookingModal: React.FC<EditBookingModalProps> = ({
  booking,
  onSave,
  onClose,
}) => {
  const [price, setPrice] = useState(booking.Price || '0');
  const [paymentMethod, setPaymentMethod] = useState(
    booking['Payment Method'] || ''
  );

  const handleSave = () => {
    onSave(booking['Booking ID'], {
      Price: price,
      'Payment Method': paymentMethod,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-lg relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white"
        >
          <X size={24} />
        </button>
        <h2 className="text-xl font-bold text-white mb-4">
          Edit Completed Job
        </h2>
        <div className="space-y-4">
          <div>
            <label htmlFor="price" className="label">
              Price
            </label>
            <input
              id="price"
              type="text"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label htmlFor="paymentMethod" className="label">
              Payment Method
            </label>
            <select
              id="paymentMethod"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="input"
            >
              <option value="Cash">Cash</option>
              <option value="Cheque">Cheque</option>
              <option value="E-Transfer">E-Transfer</option>
              <option value="Credit Card">Credit Card</option>
              <option value="Billed">Billed</option>
              <option value="Prepaid">Prepaid</option>
            </select>
          </div>
        </div>
        <div className="mt-6 flex justify-end">
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-4 py-2 bg-cps-blue text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            <Save size={16} />
            <span>Save Changes</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditBookingModal;
