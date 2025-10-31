// src/pages/Logsheet/ContractDetail.tsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useJobs } from '../../contexts/JobContext';
import { Save, ArrowLeft } from 'lucide-react';
import { getStorageItem, STORAGE_KEYS } from '../../lib/localStorage';

const ContractDetail: React.FC = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const { getJob, updateJob } = useJobs();

  const booking = getJob(jobId!);

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    address: '',
    phone: '',
    email: '',
    price: '',
    routeNumber: '',
    paymentMethod: '',
    answers: {} as Record<string, string>,
  });

  const [upsellMenu, setUpsellMenu] = useState<any>(null);

  useEffect(() => {
    if (booking) {
      const allUpsellMenus = getStorageItem(STORAGE_KEYS.UPSELL_MENUS, []);
      const menu = allUpsellMenus.find(
        (m: any) => m.id === booking.upsellMenuId
      );
      setUpsellMenu(menu);

      setFormData({
        firstName: booking['First Name'] || '',
        lastName: booking['Last Name'] || '',
        address: booking['Full Address'] || '',
        phone: booking['Home Phone'] || '',
        email: booking['Email Address'] || '',
        price: booking['Price'] || '0.00',
        routeNumber: booking['Route Number'] || '',
        paymentMethod: booking['Payment Method'] || '',
        answers: booking['Log Sheet Notes']
          ? JSON.parse(booking['Log Sheet Notes'])
          : {},
      });
    }
  }, [booking]);

  const handleAnswerChange = (queryId: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      answers: { ...prev.answers, [queryId]: value },
    }));
  };

  const handleSave = () => {
    updateJob(jobId!, {
      'First Name': formData.firstName,
      'Last Name': formData.lastName,
      'Full Address': formData.address,
      'Home Phone': formData.phone,
      'Email Address': formData.email,
      Price: formData.price,
      'Route Number': formData.routeNumber,
      'Log Sheet Notes': JSON.stringify(formData.answers),
      'Payment Method': formData.paymentMethod,
    });
    navigate('/logsheet');
  };

  if (!booking) {
    return (
      <div className="bg-gray-800 p-6 rounded-lg text-center">
        <p className="text-gray-400">Contract not found.</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="bg-gray-800 rounded-lg shadow-sm">
        <div className="p-4">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/logsheet')}
                className="p-2 hover:bg-gray-700 rounded-full transition-colors"
              >
                <ArrowLeft className="text-gray-400" />
              </button>
              <h2 className="text-xl font-bold text-gray-100">
                {booking.contractTitle}
              </h2>
            </div>
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-cps-blue text-white rounded-md hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <Save size={16} />
              Save Changes
            </button>
          </div>

          <div className="space-y-4">
            {/* Client Details */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">First Name</label>
                <input
                  type="text"
                  value={formData.firstName}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      firstName: e.target.value,
                    }))
                  }
                  className="input"
                />
              </div>
              <div>
                <label className="label">Last Name</label>
                <input
                  type="text"
                  value={formData.lastName}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      lastName: e.target.value,
                    }))
                  }
                  className="input"
                />
              </div>
            </div>
            <div>
              <label className="label">Address</label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, address: e.target.value }))
                }
                className="input"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Phone</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, phone: e.target.value }))
                  }
                  className="input"
                />
              </div>
              <div>
                <label className="label">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, email: e.target.value }))
                  }
                  className="input"
                />
              </div>
            </div>
            <div>
              <label className="label">Route Number</label>
              <input
                type="text"
                value={formData.routeNumber}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    routeNumber: e.target.value,
                  }))
                }
                className="input"
              />
            </div>

            {/* Upsell Details */}
            {upsellMenu &&
              upsellMenu.queries.map((query: any) => (
                <div key={query.id}>
                  <label className="label">{query.question}</label>
                  <select
                    className="input"
                    value={formData.answers[query.question] || ''}
                    onChange={(e) =>
                      handleAnswerChange(query.question, e.target.value)
                    }
                  >
                    {query.options.map((option: string, index: number) => (
                      <option key={index} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
              ))}

            {/* Payment Details */}
            <div>
              <label className="label">Price</label>
              <input
                type="text"
                value={formData.price}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, price: e.target.value }))
                }
                className="input"
              />
            </div>
            <div>
              <label className="label">Payment Method</label>
              <div className="grid grid-cols-3 gap-3">
                {['Cash', 'Cheque', 'E-Transfer', 'Credit Card', 'Billed'].map(
                  (method) => (
                    <button
                      key={method}
                      type="button"
                      onClick={() =>
                        setFormData((prev) => ({
                          ...prev,
                          paymentMethod: method,
                        }))
                      }
                      className={`py-2 px-4 rounded-md border ${
                        formData.paymentMethod === method
                          ? 'border-cps-red bg-red-900/20 text-cps-red'
                          : 'border-gray-600 hover:bg-gray-700'
                      }`}
                    >
                      {method}
                    </button>
                  )
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContractDetail;