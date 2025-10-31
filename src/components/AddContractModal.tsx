// src/components/AddContractModal.tsx
import React, { useState, useEffect } from 'react';
import { useJobs } from '../contexts/JobContext';
import { getStorageItem, STORAGE_KEYS } from '../lib/localStorage';
import { X, ArrowLeft } from 'lucide-react';
import UpsellFormModal from './UpsellFormModal'; // Assuming this will be adapted for hardcoded upsells
import { ConsoleProfile, Worker, MasterBooking } from '../types';
import {
  REGIONS,
  ALL_UPSELLS,
  UpsellRef,
  getRegionById,
  HardcodedSeason,
} from '../lib/hardcodedData'; // Import hardcoded data

interface AddContractModalProps {
  onClose: () => void;
}

const AddContractModal: React.FC<AddContractModalProps> = ({ onClose }) => {
  const { allBookings, closeAddContract } = useJobs();
  const [step, setStep] = useState<'initial' | 'existing' | 'new' | 'upsell'>(
    'initial'
  );
  const [clientInfo, setClientInfo] = useState({
    customerName: '',
    address: '',
    phone: '',
    email: '',
    routeNumber: '', // Keep route number if selected from existing
  });
  const [availableUpsells, setAvailableUpsells] = useState<UpsellRef[]>([]);
  const [selectedUpsell, setSelectedUpsell] = useState<UpsellRef | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    // Determine available upsells based on active season
    const adminTitle = getStorageItem(STORAGE_KEYS.ADMIN, ''); // Again, assumes ADMIN relates to logsheet user
    const consoleProfiles = getStorageItem<ConsoleProfile[]>(
      STORAGE_KEYS.CONSOLE_PROFILES,
      []
    );
    const consoleProfile = consoleProfiles.find((p) => p.title === adminTitle);

    if (!consoleProfile) {
      setError('Cannot determine console profile.');
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
      setError('No active/enabled season found.');
      return;
    }

    // Filter ALL_UPSELLS based on those enabled in the configuredSeason
    const enabledUpsellRefs = ALL_UPSELLS.filter((upsell) =>
      configuredSeason.enabledUpsellIds.includes(upsell.id)
    );
    setAvailableUpsells(enabledUpsellRefs);
  }, []); // Run once

  const handleSelectExisting = (booking: MasterBooking) => {
    setClientInfo({
      customerName: `${booking['First Name'] || ''} ${
        booking['Last Name'] || ''
      }`.trim(),
      address: booking['Full Address'] || '',
      phone: booking['Home Phone'] || booking['Cell Phone'] || '',
      email: booking['Email Address'] || '',
      routeNumber: booking['Route Number'] || '', // Transfer route number
    });
    setStep('upsell');
  };

  const handleSelectUpsell = (upsell: UpsellRef) => {
    setSelectedUpsell(upsell);
    // Here, instead of opening UpsellFormModal directly,
    // we might need a different flow later based on the next prompt's details
    // For now, let's just log it and close.
    console.log('Selected Upsell:', upsell);
    console.log('For Client:', clientInfo);
    // You would likely open a *new* modal here, tailored to the specific upsell's hardcoded form fields.
    alert(
      `Selected '${upsell.name}'. Next step (form) TBD based on future requirements.`
    );
    onClose(); // Close the modal for now
  };

  // const handleCloseUpsellForm = () => {
  //   setSelectedUpsell(null);
  //   closeAddContract(); // Close the main modal as well
  // };

  const renderStep = () => {
    switch (step) {
      case 'initial':
        return (
          <>
            <h2 className="text-xl font-bold text-white mb-6 text-center">
              Add Contract / Upsell
            </h2>
            <div className="flex justify-center gap-4">
              <button
                onClick={() => setStep('existing')}
                className="px-6 py-3 bg-cps-blue text-white rounded-md hover:bg-blue-700 transition-colors flex-1"
              >
                Existing Client
              </button>
              <button
                // onClick={() => setStep('new')} // New client contract flow TBD
                onClick={() =>
                  alert(
                    'Creating contracts for new clients needs further definition.'
                  )
                }
                className="px-6 py-3 bg-gray-700 text-white rounded-md hover:bg-gray-600 transition-colors flex-1"
                disabled // Disable for now
              >
                New Client
              </button>
            </div>
          </>
        );
      case 'existing':
        const uniqueClients = Array.from(
          new Map(
            allBookings.map((b) => [
              b['Full Address']?.toLowerCase() || b['Booking ID'],
              b,
            ])
          ).values()
        ).sort((a, b) =>
          (a['Last Name'] || '').localeCompare(b['Last Name'] || '')
        );

        return (
          <div>
            <button
              onClick={() => setStep('initial')}
              className="flex items-center gap-2 text-gray-400 hover:text-white mb-4"
            >
              <ArrowLeft size={20} /> Back
            </button>
            <h2 className="text-xl font-bold text-white mb-4">
              Select Existing Client
            </h2>
            <div className="space-y-1 max-h-96 overflow-y-auto pr-1">
              {uniqueClients.length > 0 ? (
                uniqueClients.map((booking) => (
                  <div
                    key={booking['Booking ID']}
                    onClick={() => handleSelectExisting(booking)}
                    className="bg-gray-800 p-2 rounded cursor-pointer hover:bg-gray-700 flex justify-between items-center"
                  >
                    <div>
                      <p className="font-medium text-white text-sm">
                        {booking['First Name']} {booking['Last Name']}
                      </p>
                      <p className="text-xs text-gray-400">
                        {booking['Full Address']}
                      </p>
                    </div>
                    {booking['Route Number'] && (
                      <span className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded-full">
                        {booking['Route Number']}
                      </span>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-center py-4">
                  No existing bookings found.
                </p>
              )}
            </div>
          </div>
        );
      case 'upsell':
        // This step now just lists the available upsells for the *selected client*
        return (
          <div>
            {/* {selectedUpsell && (
               // This modal needs to be redesigned based on hardcoded upsell structure
              <UpsellFormModal
                menu={selectedUpsell} // This needs to adapt
                client={clientInfo}
                onClose={handleCloseUpsellForm}
              />
            )} */}
            <button
              onClick={() => setStep('existing')} // Go back to client selection
              className="flex items-center gap-2 text-gray-400 hover:text-white mb-4"
            >
              <ArrowLeft size={20} /> Back to Clients
            </button>
            <h2 className="text-xl font-bold text-white mb-2">
              Select Upsell for:
            </h2>
            <p className="text-cps-blue mb-4">
              {clientInfo.customerName} ({clientInfo.address})
            </p>

            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {availableUpsells.length > 0 ? (
                availableUpsells.map((upsell) => (
                  <div
                    key={upsell.id}
                    onClick={() => handleSelectUpsell(upsell)}
                    className="bg-gray-800 p-3 rounded cursor-pointer hover:bg-gray-700"
                  >
                    <p className="font-medium text-white">{upsell.name}</p>
                    {/* Optionally add description later */}
                  </div>
                ))
              ) : (
                <p className="text-gray-400 text-center py-4">
                  No upsells enabled for the current active season in this
                  profile.
                </p>
              )}
            </div>
          </div>
        );
      case 'new': // Keep placeholder, flow TBD
        return (
          <div>
            <button
              onClick={() => setStep('initial')}
              className="flex items-center gap-2 text-gray-400 hover:text-white mb-4"
            >
              <ArrowLeft size={20} /> Back
            </button>
            <h2 className="text-xl font-bold text-white mb-4">
              Create New Client for Contract
            </h2>
            <p className="text-gray-400">
              (This functionality needs further definition based on required
              fields for contracts vs. same-day sales)
            </p>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 w-full max-w-lg relative min-h-[200px]">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white z-10"
        >
          <X size={24} />
        </button>
        {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
        {renderStep()}
      </div>
    </div>
  );
};

export default AddContractModal;
