// src/pages/Logsheet/NewJob.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Save, Percent, AlertCircle } from 'lucide-react'; // Added AlertCircle
import { useJobs } from '../../contexts/JobContext';
import { getStorageItem, STORAGE_KEYS } from '../../lib/localStorage';
import {
  ConsoleProfile,
  PayoutLogicSettings,
  Worker,
  SoldService,
  MasterBooking,
} from '../../types';
import {
  REGIONS,
  getRegionById,
  HardcodedSeason,
  BaseService,
  BaseServiceOption,
  defaultPayoutLogicSettings,
} from '../../lib/hardcodedData'; // Import hardcoded data

const NewJob: React.FC = () => {
  const navigate = useNavigate();
  const { addJob } = useJobs();

  // Form State
  const [routeCode, setRouteCode] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [houseNumber, setHouseNumber] = useState('');
  const [streetName, setStreetName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  // State to hold selected services with their options and prices
  const [selectedSoldServices, setSelectedSoldServices] = useState<
    SoldService[]
  >([]);
  const [amount, setAmount] = useState('0.00'); // This will be calculated sum
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [customPaymentAmounts, setCustomPaymentAmounts] = useState({
    cash: '',
    cheque: '',
    etransfer: '',
    creditCard: '',
    billed: '',
  });
  const [notes, setNotes] = useState(''); // Simple text notes for now

  // Data State
  const [activeHardcodedSeason, setActiveHardcodedSeason] =
    useState<HardcodedSeason | null>(null);
  const [payoutLogic, setPayoutLogic] = useState<PayoutLogicSettings>(
    defaultPayoutLogicSettings
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    // Determine active season based on logged-in user's profile
    const contractor = getStorageItem(STORAGE_KEYS.CONTRACTOR, null);
    const activeCart = getStorageItem(STORAGE_KEYS.ACTIVE_CART, null);
    const loggedInWorkerId =
      activeCart?.loggedInWorker.number || contractor?.number;

    if (!loggedInWorkerId) {
      setError('Could not identify logged-in worker.');
      return;
    }

    // Find worker to get console profile ID (via RM or directly if possible - needs adjustment based on data structure)
    // This logic might need refinement based on how worker profiles store console links
    // Simplified: Assume we can find the console profile somehow
    const adminTitle = getStorageItem(STORAGE_KEYS.ADMIN, ''); // This assumes ADMIN is set for logsheet users too, which might not be correct.
    // A better approach is needed to link Contractor -> ConsoleProfile

    const consoleProfiles = getStorageItem<ConsoleProfile[]>(
      STORAGE_KEYS.CONSOLE_PROFILES,
      []
    );
    // PROBLEM: We need a reliable way to link the logged-in contractor/cart to *their* ConsoleProfile
    // For now, let's assume the ADMIN key holds the *relevant* profile title for the current session.
    const consoleProfile = consoleProfiles.find((p) => p.title === adminTitle);

    if (!consoleProfile) {
      setError('Could not determine the correct console profile for settings.');
      return;
    }

    const activeSeasonHardcodedId = getStorageItem<string | null>(
      STORAGE_KEYS.ACTIVE_SEASON_ID,
      null
    );
    const configuredSeason = consoleProfile.seasons.find(
      (cs) => cs.hardcodedId === activeSeasonHardcodedId && cs.enabled
    );

    if (!configuredSeason) {
      setError('No active season is configured or enabled for your profile.');
      return;
    }

    const regionData = getRegionById(consoleProfile.region);
    const hcSeasonData = regionData?.seasons.find(
      (hs) => hs.id === configuredSeason.hardcodedId
    );

    if (!hcSeasonData) {
      setError('Could not load season data.');
      return;
    }

    setActiveHardcodedSeason(hcSeasonData);
    setPayoutLogic(configuredSeason.payoutLogic || defaultPayoutLogicSettings); // Use profile-specific logic or default

    // Pre-populate route code logic (same as before)
    const lastRouteCode = localStorage.getItem('lastRouteCode');
    const assignedRoutes = Object.entries(
      getStorageItem(STORAGE_KEYS.ROUTE_ASSIGNMENTS, {})
    )
      .filter(([_, workerId]) => workerId === loggedInWorkerId)
      .map(([route]) => route);

    if (assignedRoutes.length > 0) {
      setRouteCode(assignedRoutes[0]);
    } else if (lastRouteCode) {
      setRouteCode(lastRouteCode);
    }
  }, []); // Run once on mount

  // --- Service Selection Logic ---

  // For single-choice seasons (Sealing, Cleaning)
  const handleSingleServiceSelect = (
    service: BaseService,
    option?: BaseServiceOption
  ) => {
    const price = option?.defaultPrice ?? service.defaultPrice ?? 0;
    const soldService: SoldService = {
      hardcodedId: service.id,
      name: service.name,
      optionId: option?.id,
      optionName: option?.name,
      price: price,
    };
    setSelectedSoldServices([soldService]); // Replace existing
  };

  // For multi-choice seasons (Rejuv) or Aeration (which is single but has options)
  const handleMultiServiceToggle = (
    service: BaseService,
    option?: BaseServiceOption
  ) => {
    const serviceIdWithOption = option ? option.id : service.id;
    const isSelected = selectedSoldServices.some(
      (s) => (s.optionId || s.hardcodedId) === serviceIdWithOption
    );

    if (isSelected) {
      setSelectedSoldServices((prev) =>
        prev.filter(
          (s) => (s.optionId || s.hardcodedId) !== serviceIdWithOption
        )
      );
    } else {
      const price = option?.defaultPrice ?? service.defaultPrice ?? 0;
      const soldService: SoldService = {
        hardcodedId: service.id,
        name: service.name,
        optionId: option?.id,
        optionName: option?.name,
        price: price,
      };
      // For Aeration, ensure only one option is selected
      if (service.id === 'aeration') {
        setSelectedSoldServices((prev) => [
          ...prev.filter((s) => s.hardcodedId !== 'aeration'),
          soldService,
        ]);
      } else {
        setSelectedSoldServices((prev) => [...prev, soldService]);
      }
    }
  };

  // Calculate total amount based on selected services
  useEffect(() => {
    const total = selectedSoldServices.reduce((sum, s) => sum + s.price, 0);
    setAmount(total.toFixed(2));
  }, [selectedSoldServices]);

  // --- End Service Selection ---

  const calculateTax = () => {
    const currentTotal = selectedSoldServices.reduce(
      (sum, s) => sum + s.price,
      0
    );
    if (payoutLogic.taxRate) {
      const tax = currentTotal * (payoutLogic.taxRate / 100);
      const totalWithTax = currentTotal + tax;
      setAmount(totalWithTax.toFixed(2)); // Update the displayed total amount
      // Adjust individual service prices proportionally? Or just update total?
      // For now, just updating the total amount field. Submission needs to handle this.
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (selectedSoldServices.length === 0) {
      setError('Please select at least one service.');
      return;
    }

    const finalAmount = parseFloat(amount);
    if (isNaN(finalAmount) || finalAmount <= 0) {
      setError('Please enter a valid total amount.');
      return;
    }

    let finalPaymentMethod = paymentMethod;
    if (paymentMethod === 'Custom') {
      const totalCustom = Object.values(customPaymentAmounts).reduce(
        (sum, current) => sum + (parseFloat(current) || 0),
        0
      );
      // Basic validation: Ensure custom split matches total amount
      if (Math.abs(totalCustom - finalAmount) > 0.01) {
        // Allow for floating point differences
        setError(
          `Custom payment split ($${totalCustom.toFixed(
            2
          )}) does not match total amount ($${finalAmount.toFixed(2)}).`
        );
        return;
      }
      finalPaymentMethod = Object.entries(customPaymentAmounts)
        .filter(([_, value]) => parseFloat(value) > 0)
        .map(
          ([key, value]) =>
            `${key.charAt(0).toUpperCase() + key.slice(1)}: $${parseFloat(
              value
            ).toFixed(2)}`
        )
        .join('; ');
    }

    // Determine FO/BO/FP based on Aeration selection if present
    const aerationSelection = selectedSoldServices.find(
      (s) => s.hardcodedId === 'aeration'
    );
    let propertyType = 'FP'; // Default
    if (aerationSelection?.optionId?.includes('-fo')) propertyType = 'FO';
    else if (aerationSelection?.optionId?.includes('-bo')) propertyType = 'BO';

    const newBookingData: Partial<MasterBooking> = {
      'First Name': firstName,
      'Last Name': lastName,
      'Full Address': `${houseNumber} ${streetName}`.trim(),
      'Home Phone': phone,
      'Email Address': email,
      Price: finalAmount.toFixed(2), // Use the final calculated/entered amount
      'Log Sheet Notes': notes, // Add basic notes field
      'Payment Method': finalPaymentMethod,
      'Is Paid': finalPaymentMethod !== 'Billed', // Mark as paid unless billed
      'Route Number': routeCode,
      isContract: false, // This is a same-day sale, not a contract
      isPrebooked: false,
      services: selectedSoldServices, // Store the array of sold services
      Completed: 'x', // Mark as completed immediately
      'Date Completed': new Date().toISOString(),
      // Add FO/BO/FP based on Aeration selection
      'FO/BO/FP': propertyType,
      // We need the Contractor Number here!
      // 'Contractor Number': loggedInWorkerId, // This needs reliable fetching logic added in useEffect
    };

    try {
      addJob(newBookingData); // Call the context function to add the job
      localStorage.setItem('lastRouteCode', routeCode); // Save last used route code
      navigate('/logsheet'); // Navigate back after successful save
    } catch (jobError) {
      console.error('Error adding job:', jobError);
      setError(
        `Failed to save job: ${
          jobError instanceof Error ? jobError.message : 'Unknown error'
        }`
      );
    }
  };

  const totalCustomAmount = useMemo(() => {
    return Object.values(customPaymentAmounts).reduce(
      (sum, current) => sum + (parseFloat(current) || 0),
      0
    );
  }, [customPaymentAmounts]);

  // --- Render Logic ---
  const renderServiceSelection = () => {
    if (!activeHardcodedSeason)
      return <p className="text-gray-400">Loading services...</p>;

    const { doorServices, type } = activeHardcodedSeason;
    const isSingleChoice =
      type === 'Team' &&
      (activeHardcodedSeason.id.includes('-sealing') ||
        activeHardcodedSeason.id.includes('-cleaning'));

    return (
      <div
        className={`grid grid-cols-2 md:grid-cols-${
          isSingleChoice ? doorServices.length : 3
        } gap-2`}
      >
        {doorServices.map((service) => {
          // If service has options (like Aeration)
          if (service.options && service.options.length > 0) {
            return service.options.map((option) => {
              const serviceIdWithOption = option.id;
              const isSelected = selectedSoldServices.some(
                (s) => (s.optionId || s.hardcodedId) === serviceIdWithOption
              );
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => handleMultiServiceToggle(service, option)}
                  className={`p-3 rounded-md text-sm transition-colors text-center ${
                    isSelected
                      ? 'bg-cps-blue text-white ring-2 ring-offset-2 ring-offset-gray-900 ring-cps-blue'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {service.name} <br /> ({option.name})
                </button>
              );
            });
          }
          // If service is standalone (like Dethatching or a single-choice option)
          else {
            const isSelected = selectedSoldServices.some(
              (s) => s.hardcodedId === service.id
            );
            return (
              <button
                key={service.id}
                type="button"
                onClick={() =>
                  isSingleChoice
                    ? handleSingleServiceSelect(service)
                    : handleMultiServiceToggle(service)
                }
                className={`p-3 rounded-md text-sm transition-colors text-center ${
                  isSelected
                    ? 'bg-cps-blue text-white ring-2 ring-offset-2 ring-offset-gray-900 ring-cps-blue'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {service.name}
              </button>
            );
          }
        })}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-3xl relative max-h-[95vh] flex flex-col">
        <div className="flex justify-between items-center mb-4 flex-shrink-0">
          <h2 className="text-xl font-bold text-white">
            Add New Same Day Sale
          </h2>
          <button
            onClick={() => navigate('/logsheet')}
            className="text-gray-400 hover:text-white"
          >
            <X size={24} />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-900/30 text-red-300 border border-red-700 rounded-md text-sm flex items-center gap-2 flex-shrink-0">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="overflow-y-auto space-y-6 pr-2 flex-grow"
        >
          {/* Client Information */}
          <div className="bg-gray-900/50 p-4 rounded-lg">
            <h3 className="text-lg font-semibold text-gray-200 mb-4">
              Client Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-1">
                <label className="label">Route Code</label>
                <input
                  type="text"
                  value={routeCode}
                  onChange={(e) => setRouteCode(e.target.value)}
                  className="input"
                />
              </div>
              <div className="md:col-span-2 grid grid-cols-2 gap-4">
                <div>
                  <label className="label">First Name *</label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="input"
                    required
                  />
                </div>
                <div>
                  <label className="label">Last Name *</label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="input"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="label">House # *</label>
                <input
                  type="text"
                  value={houseNumber}
                  onChange={(e) => setHouseNumber(e.target.value)}
                  className="input"
                  required
                />
              </div>
              <div className="md:col-span-2">
                <label className="label">Street Name *</label>
                <input
                  type="text"
                  value={streetName}
                  onChange={(e) => setStreetName(e.target.value)}
                  className="input"
                  required
                />
              </div>
              <div>
                <label className="label">Phone</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="input"
                />
              </div>
              <div className="md:col-span-2">
                <label className="label">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input"
                />
              </div>
            </div>
          </div>

          {/* Service Selection */}
          <div className="bg-gray-900/50 p-4 rounded-lg">
            <h3 className="text-lg font-semibold text-gray-200 mb-4">
              Services Sold *
            </h3>
            {activeHardcodedSeason ? (
              renderServiceSelection()
            ) : (
              <p className="text-gray-500">Select a season first.</p>
            )}
          </div>

          {/* Notes */}
          <div className="bg-gray-900/50 p-4 rounded-lg">
            <h3 className="text-lg font-semibold text-gray-200 mb-2">Notes</h3>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="input w-full h-20 resize-none"
              placeholder="Add any relevant notes (e.g., gate code, specific instructions)..."
            />
          </div>

          {/* Amount & Payment */}
          <div className="bg-gray-900/50 p-4 rounded-lg">
            <h3 className="text-lg font-semibold text-gray-200 mb-4">
              Payment
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Total Amount ($) *</label>
                <div className="flex gap-2">
                  <input
                    type="number" // Use number for better input control
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="input flex-grow"
                    required
                    placeholder="0.00"
                    step="0.01" // Allow cents
                    min="0"
                  />
                  <button
                    type="button"
                    onClick={calculateTax}
                    className="p-2 bg-gray-700 text-gray-300 rounded-md hover:bg-gray-600 flex items-center gap-1"
                    title={`Add ${payoutLogic.taxRate}% Tax`}
                  >
                    <Percent size={14} /> Tax
                  </button>
                </div>
              </div>
              <div>
                <label className="label">Payment Method *</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="input"
                  required
                >
                  <option value="Cash">Cash</option>
                  <option value="Cheque">Cheque</option>
                  <option value="E-Transfer">E-Transfer</option>
                  <option value="Credit Card">Credit Card</option>
                  <option value="Billed">Billed</option>
                  <option value="Custom">Custom Split</option>
                </select>
              </div>
            </div>
            {paymentMethod === 'Custom' && (
              <div className="mt-4 border-t border-gray-700 pt-4">
                <h4 className="text-md font-medium text-gray-300 mb-2">
                  Custom Payment Split
                </h4>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                  {Object.keys(customPaymentAmounts).map((key) => (
                    <div key={key}>
                      <label className="label capitalize">
                        {key === 'creditCard' ? 'Credit Card' : key}
                      </label>
                      <input
                        type="number"
                        value={
                          customPaymentAmounts[
                            key as keyof typeof customPaymentAmounts
                          ]
                        }
                        onChange={(e) =>
                          setCustomPaymentAmounts({
                            ...customPaymentAmounts,
                            [key]: e.target.value,
                          })
                        }
                        className="input"
                        placeholder="0.00"
                        step="0.01"
                        min="0"
                      />
                    </div>
                  ))}
                </div>
                <div
                  className={`mt-4 text-right text-sm font-medium ${
                    Math.abs(totalCustomAmount - parseFloat(amount)) > 0.01
                      ? 'text-red-400'
                      : 'text-green-400'
                  }`}
                >
                  Total Split: ${totalCustomAmount.toFixed(2)} / $
                  {parseFloat(amount || '0').toFixed(2)}
                </div>
              </div>
            )}
          </div>

          {/* Submit Button */}
          <div className="pt-4 flex justify-end flex-shrink-0">
            <button
              type="submit"
              className="flex items-center gap-2 px-6 py-2 bg-cps-green text-white rounded-md hover:bg-green-700 transition-colors font-medium"
            >
              <Save size={16} />
              <span>Save Sale & Mark Complete</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NewJob;