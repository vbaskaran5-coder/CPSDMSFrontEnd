// src/pages/Logsheet/JobDetail.tsx
import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useJobs } from '../../contexts/JobContext';
import { AlertCircle } from 'lucide-react';
import { getStorageItem, STORAGE_KEYS } from '../../lib/localStorage';

const JobDetail: React.FC = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const { allBookings, updateJob } = useJobs();

  const booking = allBookings.find((b) => b['Booking ID'] === jobId);

  if (!booking) {
    return (
      <div className="bg-gray-800 p-6 rounded-lg text-center">
        <p className="text-gray-400">
          Booking not found. It might have been updated.
        </p>
        <button
          onClick={() => navigate('/logsheet')}
          className="mt-4 text-sm text-cps-blue"
        >
          Back to Logsheet
        </button>
      </div>
    );
  }

  const [showModifyPrompt, setShowModifyPrompt] = useState(
    booking['Completed'] === 'x'
  );
  const [formData, setFormData] = useState({
    firstName: booking['First Name'] || '',
    lastName: booking['Last Name'] || '',
    address: booking['Full Address'] || '',
    phone: booking['Home Phone'] || '',
    email: booking['Email Address'] || '',
    propertyType: booking['FO/BO/FP'] || 'FP',
    price: booking['Price'] || '59.99',
    routeNumber: booking['Route Number'] || '',
    prebooked: booking['Route Number']?.length > 0,
  });

  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [showNotDoneModal, setShowNotDoneModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [amountReceived, setAmountReceived] = useState(formData.price);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [cardDetails, setCardDetails] = useState({
    name: '',
    number: '',
    expiry: '',
    cvc: '',
  });

  const handleAmountChange = (value: string) => {
    value = value.replace(/[^\d.]/g, '');
    const parts = value.split('.');
    if (parts.length > 2) value = parts[0] + '.' + parts[1];
    if (value.includes('.')) {
      const [whole, decimal] = value.split('.');
      value = `${whole}.${decimal.slice(0, 2)}`;
    }
    setAmountReceived(value);
  };

  const calculateTax = () => {
    const baseAmount = parseFloat(amountReceived);
    if (isNaN(baseAmount)) return;
    const withTax = baseAmount * 1.13;
    setAmountReceived(withTax.toFixed(2));
  };

  const validatePayment = () => {
    const newErrors: Record<string, string> = {};
    if (!paymentMethod) newErrors.paymentMethod = 'Payment method is required';
    if (paymentMethod === 'credit') {
      if (!cardDetails.name) newErrors.cardName = 'Name on card is required';
      if (!cardDetails.number) newErrors.cardNumber = 'Card number is required';
      if (!cardDetails.expiry) newErrors.cardExpiry = 'Expiry date is required';
      if (!cardDetails.cvc) newErrors.cvc = 'CVC is required';
    }
    if (paymentMethod === 'billed' && !invoiceNumber.trim())
      newErrors.invoiceNumber = 'Invoice number is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const getUpdates = () => {
    const contractor = getStorageItem(STORAGE_KEYS.CONTRACTOR, {});
    return {
      'Updated At': new Date().toISOString(),
      Price: formData.price,
      'First Name': formData.firstName,
      'Last Name': formData.lastName,
      'Full Address': formData.address,
      'Home Phone': formData.phone,
      'Email Address': formData.email,
      'FO/BO/FP': formData.propertyType,
      'Route Number': formData.routeNumber,
      'Contractor Number': contractor.number,
    };
  };

  const handleComplete = () => {
    if (booking['Prepaid'] === 'x') {
      updateJob(jobId!, {
        ...getUpdates(),
        Completed: 'x',
        'Date Completed': new Date().toISOString(),
      });
      navigate('/logsheet');
    } else {
      setShowPaymentForm(true);
    }
  };

  const handlePaymentSubmit = () => {
    if (!validatePayment()) return;
    const updates: any = {
      ...getUpdates(),
      Completed: 'x',
      'Date Completed': new Date().toISOString(),
      'Payment Method': paymentMethod,
      Price: amountReceived,
      'Is Paid': paymentMethod !== 'billed',
    };
    if (paymentMethod === 'billed') updates['Invoice Number'] = invoiceNumber;
    updateJob(jobId!, updates);
    navigate('/logsheet');
  };

  const handleNotDoneOption = (option: 'next_time' | 'cancelled') => {
    updateJob(jobId!, {
      ...getUpdates(),
      Status: option,
    });
    setShowNotDoneModal(false);
    navigate('/logsheet');
  };

  if (showModifyPrompt) {
    return (
      <div className="animate-fade-in">
        <div className="bg-gray-800 rounded-lg p-6 text-center">
          <h2 className="text-xl font-bold text-gray-100 mb-6">
            This job is already completed
          </h2>
          <div className="flex justify-center gap-4">
            <button
              onClick={() => setShowModifyPrompt(false)}
              className="px-6 py-3 bg-cps-red text-white rounded-md hover:bg-[#dc2f3d] transition-colors"
            >
              Modify Entry
            </button>
            <button
              onClick={() => navigate('/logsheet')}
              className="px-6 py-3 bg-gray-700 text-gray-200 rounded-md hover:bg-gray-600 transition-colors"
            >
              Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="bg-gray-800 rounded-lg shadow-sm">
        <form className="p-4">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-gray-100">Job Details</h2>
            {formData.prebooked && (
              <span className="bg-cps-blue text-white text-xs px-2 py-1 rounded">
                Prebooked
              </span>
            )}
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  First Name
                </label>
                <input
                  type="text"
                  value={formData.firstName}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      firstName: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Last Name
                </label>
                <input
                  type="text"
                  value={formData.lastName}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      lastName: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-gray-100"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Address
              </label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, address: e.target.value }))
                }
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-gray-100"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Phone
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, phone: e.target.value }))
                  }
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, email: e.target.value }))
                  }
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-gray-100"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Route Number
              </label>
              <input
                type="text"
                value={formData.routeNumber}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    routeNumber: e.target.value,
                  }))
                }
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-gray-100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Property Type
              </label>
              <div className="flex gap-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="propertyType"
                    value="FP"
                    checked={formData.propertyType === 'FP'}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        propertyType: e.target.value,
                      }))
                    }
                    className="mr-2"
                  />
                  Full Property
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="propertyType"
                    value="FO"
                    checked={formData.propertyType === 'FO'}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        propertyType: e.target.value,
                      }))
                    }
                    className="mr-2"
                  />
                  Front Only
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="propertyType"
                    value="BO"
                    checked={formData.propertyType === 'BO'}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        propertyType: e.target.value,
                      }))
                    }
                    className="mr-2"
                  />
                  Back Only
                </label>
              </div>
            </div>

            <div className="bg-gray-700/30 rounded-lg p-4">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-300">
                  Price {booking['Prepaid'] === 'x' && '(Prepaid)'}
                </span>
                <span className="text-lg font-semibold text-gray-100">
                  ${formData.price}
                </span>
              </div>
            </div>

            {booking['Log Sheet Notes'] && (
              <div className="bg-gray-700/30 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-300 mb-2">
                  Prebook Notes
                </h3>
                <p className="text-gray-400">{booking['Log Sheet Notes']}</p>
              </div>
            )}
          </div>

          {showPaymentForm ? (
            <div className="mt-6 border-t border-gray-700 pt-6">
              <h3 className="text-lg font-medium text-gray-200 mb-4">
                Payment Details
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Amount Received
                  </label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                        $
                      </span>
                      <input
                        type="text"
                        value={amountReceived}
                        onChange={(e) => handleAmountChange(e.target.value)}
                        className="w-full pl-8 pr-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-gray-100"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={calculateTax}
                      className="px-3 py-2 bg-gray-700 text-gray-300 rounded-md hover:bg-gray-600 transition-colors"
                      title="Add 13% HST"
                    >
                      <AlertCircle size={20} />
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Payment Method
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {['cash', 'cheque', 'etransfer', 'credit', 'billed'].map(
                      (method) => (
                        <button
                          key={method}
                          type="button"
                          onClick={() => setPaymentMethod(method)}
                          className={`py-2 px-4 rounded-md border ${
                            paymentMethod === method
                              ? 'border-cps-red bg-red-900/20 text-cps-red'
                              : 'border-gray-600 hover:bg-gray-700'
                          }`}
                        >
                          {method.charAt(0).toUpperCase() + method.slice(1)}
                        </button>
                      )
                    )}
                  </div>
                  {errors.paymentMethod && (
                    <p className="text-red-500 text-xs mt-1">
                      <AlertCircle size={12} className="inline mr-1" />
                      {errors.paymentMethod}
                    </p>
                  )}
                </div>
                {paymentMethod === 'credit' && (
                  <div className="space-y-3">{/* Credit Card Inputs */}</div>
                )}
                {paymentMethod === 'billed' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Invoice Number
                    </label>
                    <input
                      type="text"
                      value={invoiceNumber}
                      onChange={(e) => setInvoiceNumber(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-gray-100"
                      placeholder="Enter invoice number"
                    />
                    {errors.invoiceNumber && (
                      <p className="text-red-500 text-xs mt-1">
                        <AlertCircle size={12} className="inline mr-1" />
                        {errors.invoiceNumber}
                      </p>
                    )}
                  </div>
                )}
                <div className="flex gap-3 mt-6">
                  <button
                    type="button"
                    onClick={() => setShowPaymentForm(false)}
                    className="flex-1 py-3 bg-gray-700 text-gray-200 rounded-md hover:bg-gray-600 transition-colors"
                  >
                    Back to Details
                  </button>
                  <button
                    type="button"
                    onClick={handlePaymentSubmit}
                    className="flex-1 py-3 bg-cps-red text-white rounded-md hover:bg-[#dc2f3d] transition-colors"
                  >
                    Complete Payment
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex justify-end mt-6">
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleComplete}
                  className="px-4 py-2 bg-cps-red text-white rounded-md hover:bg-[#dc2f3d] transition-colors"
                >
                  {booking['Prepaid'] === 'x'
                    ? 'Mark Complete'
                    : 'Process Payment'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowNotDoneModal(true)}
                  className="px-4 py-2 bg-cps-blue text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  Not Done
                </button>
              </div>
            </div>
          )}
        </form>
      </div>

      {showNotDoneModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-4 w-full max-w-sm mx-4">
            <h3 className="text-lg font-semibold text-gray-100 mb-4">
              Why was the job not done?
            </h3>
            <div className="space-y-3">
              <button
                onClick={() => handleNotDoneOption('next_time')}
                className="w-full py-3 bg-gray-700 text-gray-200 rounded-md hover:bg-gray-600 transition-colors text-left px-4"
              >
                Next Time
              </button>
              <button
                onClick={() => handleNotDoneOption('cancelled')}
                className="w-full py-3 bg-cps-red text-white rounded-md hover:bg-[#dc2f3d] transition-colors text-left px-4"
              >
                Cancelled
              </button>
              <button
                onClick={() => setShowNotDoneModal(false)}
                className="w-full py-3 bg-gray-700 text-gray-200 rounded-md hover:bg-gray-600 transition-colors"
              >
                Go Back
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default JobDetail;