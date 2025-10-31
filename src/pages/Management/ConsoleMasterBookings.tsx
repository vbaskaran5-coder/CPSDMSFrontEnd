// src/pages/Management/ConsoleMasterBookings.tsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  CheckCircle,
  Clock,
  XCircle,
  Loader,
  X,
  Save,
  Search,
  Phone,
  Mail,
  ChevronDown,
  ChevronUp,
  Database,
} from 'lucide-react';
import {
  MasterBooking,
  ConsoleProfile,
  ConfiguredSeason,
} from '../../types';
import * as bookingHelpers from '../../lib/bookingStoreHelpers';
import { getStorageItem, STORAGE_KEYS } from '../../lib/localStorage';
import { getSeasonConfigById, HardcodedSeason } from '../../lib/hardcodedData';

// --- Types ---
type SubTabStatus =
  | 'Active'
  | 'Completed'
  | 'Cancelled'
  | 'Redo'
  | 'Billed'
  | 'Ref/DNB';

const SUB_TABS: SubTabStatus[] = [
  'Active',
  'Completed',
  'Cancelled',
  'Redo',
  'Billed',
  'Ref/DNB',
];

interface EditingBookingData extends Partial<MasterBooking> {
  'House #'?: string;
  'Street Name'?: string;
}
// --- End Types ---

const ConsoleMasterBookings: React.FC = () => {
  const { consoleProfileId } = useParams<{ consoleProfileId: string }>();
  const navigate = useNavigate();

  // --- State ---
  const [consoleProfile, setConsoleProfile] = useState<ConsoleProfile | null>(
    null
  );
  const [enabledSeasons, setEnabledSeasons] = useState<HardcodedSeason[]>([]);
  const [activeSeason, setActiveSeason] = useState<HardcodedSeason | null>(
    null
  );
  const [activeSubTab, setActiveSubTab] = useState<SubTabStatus>('Active');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [currentBookings, setCurrentBookings] = useState<MasterBooking[]>([]);
  const [expandedBookingId, setExpandedBookingId] = useState<string | null>(
    null
  );
  const [editingBookingData, setEditingBookingData] =
    useState<EditingBookingData | null>(null);

  const numConsoleId = parseInt(consoleProfileId || '0', 10);
  // --- End State ---

  // --- Data Loading ---
  const loadData = useCallback(() => {
    console.log('Console MasterBookings: loadData triggered.');
    setLoading(true);
    setError(null);
    try {
      if (isNaN(numConsoleId) || numConsoleId === 0) {
        throw new Error('Invalid Console Profile ID.');
      }

      const profiles = getStorageItem<ConsoleProfile[]>(
        STORAGE_KEYS.CONSOLE_PROFILES,
        []
      );
      const profile = profiles.find((p) => p.id === numConsoleId);
      if (!profile) throw new Error('Console Profile not found.');
      setConsoleProfile(profile);

      // Get all *enabled* seasons for this console
      const seasons: HardcodedSeason[] = [];
      profile.seasons.forEach((cs: ConfiguredSeason) => {
        if (cs.enabled) {
          const hcSeason = getSeasonConfigById(cs.hardcodedId);
          if (hcSeason) {
            seasons.push(hcSeason);
          }
        }
      });
      setEnabledSeasons(seasons);

      // Set the active season (first one, or keep existing if still valid)
      let currentActive = activeSeason;
      if (
        !currentActive ||
        !seasons.find((s) => s.id === currentActive?.id)
      ) {
        currentActive = seasons[0] || null;
      }
      setActiveSeason(currentActive);

      // Load bookings for the active season
      if (currentActive) {
        const bookings = bookingHelpers.getBookingsForConsoleSeason(
          numConsoleId,
          currentActive.id
        );
        setCurrentBookings(bookings);
      } else {
        setCurrentBookings([]); // No enabled seasons
      }
    } catch (err) {
      console.error('Error loading data in Console MasterBookings:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [consoleProfileId, activeSeason]); // Depend on activeSeason

  // Initial load and listener setup
  useEffect(() => {
    loadData();
    const handleStorageUpdate = (event: any) => {
      const key = event?.detail?.key;
      if (
        key === STORAGE_KEYS.CONSOLE_PROFILES ||
        key === STORAGE_KEYS.TERRITORY_ASSIGNMENTS ||
        key?.startsWith('bookings_')
      ) {
        loadData();
      }
    };
    window.addEventListener('storageUpdated', handleStorageUpdate);
    return () => {
      window.removeEventListener('storageUpdated', handleStorageUpdate);
    };
  }, [loadData]); // Only depends on loadData

  // Reload bookings when activeSeason tab changes
  useEffect(() => {
    if (activeSeason && numConsoleId) {
      setLoading(true);
      try {
        const bookings = bookingHelpers.getBookingsForConsoleSeason(
          numConsoleId,
          activeSeason.id
        );
        setCurrentBookings(bookings);
      } catch (err) {
        setError('Failed to load bookings for selected season.');
      } finally {
        setLoading(false);
      }
    } else if (!activeSeason) {
      setCurrentBookings([]); // Clear bookings if no season is active
    }
  }, [activeSeason, numConsoleId]);

  // Reset UI state when tabs change
  useEffect(() => {
    setSearchTerm('');
    setExpandedBookingId(null);
    setEditingBookingData(null);
  }, [activeSubTab, activeSeason]);

  // --- Filtering Logic ---
  const filteredBookings = useMemo(() => {
    let filtered = currentBookings;
    switch (activeSubTab) {
      case 'Active':
        filtered = filtered.filter(
          (b) =>
            !b.Completed &&
            (!b.Status || b.Status === 'pending' || b.Status === 'contract')
        );
        break;
      case 'Completed':
        filtered = filtered.filter(
          (b) =>
            b.Completed === 'x' &&
            (b['Payment Method'] || '').toLowerCase() !== 'billed'
        );
        break;
      case 'Cancelled':
        filtered = filtered.filter((b) => b.Status === 'cancelled');
        break;
      case 'Redo':
        filtered = filtered.filter((b) => b.Status === 'redo');
        break;
      case 'Billed':
        filtered = filtered.filter(
          (b) =>
            b.Completed === 'x' &&
            (b['Payment Method'] || '').toLowerCase() === 'billed'
        );
        break;
      case 'Ref/DNB':
        filtered = filtered.filter((b) => b.Status === 'ref/dnb');
        break;
      default:
        break;
    }
    if (searchTerm.trim()) {
      const lowerSearch = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (b) =>
          [
            b['Route Number'],
            b['Full Address'],
            b['First Name'],
            b['Last Name'],
            b['Home Phone']?.replace(/\D/g, ''),
            b['Cell Phone']?.replace(/\D/g, ''),
            b['Email Address'],
            b['Booking ID'],
          ].some((field) => field?.toLowerCase().includes(lowerSearch)) ||
          b['Home Phone']
            ?.replace(/\D/g, '')
            .includes(lowerSearch.replace(/\D/g, '')) ||
          b['Cell Phone']
            ?.replace(/\D/g, '')
            .includes(lowerSearch.replace(/\D/g, ''))
      );
    }
    filtered.sort((a, b) =>
      (a['Route Number'] || '').localeCompare(b['Route Number'] || '')
    );
    return filtered;
  }, [currentBookings, activeSubTab, searchTerm]);

  // --- Edit Handlers ---
  const handleToggleExpand = (bookingId: string) => {
    if (expandedBookingId === bookingId) {
      if (editingBookingData) {
        handleSaveEdit(bookingId, editingBookingData);
      }
      setExpandedBookingId(null);
      setEditingBookingData(null);
    } else {
      if (expandedBookingId && editingBookingData) {
        handleSaveEdit(expandedBookingId, editingBookingData);
      }
      const bookingToEdit = currentBookings.find(
        (b) => b['Booking ID'] === bookingId
      );
      if (bookingToEdit) {
        const address = bookingToEdit['Full Address'] || '';
        const firstSpaceIndex = address.indexOf(' ');
        const initialHouseNumber =
          firstSpaceIndex > 0 ? address.substring(0, firstSpaceIndex) : address;
        const initialStreetName =
          firstSpaceIndex > 0 ? address.substring(firstSpaceIndex + 1) : '';
        setEditingBookingData({
          ...bookingToEdit,
          'House #': initialHouseNumber,
          'Street Name': initialStreetName,
        });
      } else {
        setEditingBookingData(null);
      }
      setExpandedBookingId(bookingId);
    }
  };
  const handleInputChange = (
    field: keyof EditingBookingData,
    value: string
  ) => {
    if (field === 'Price') {
      value = value.replace(/[^\d.]/g, '');
      const parts = value.split('.');
      if (parts.length > 2) value = parts[0] + '.' + parts.slice(1).join('');
      if (value.includes('.')) {
        const [, decimal] = value.split('.');
        if (decimal && decimal.length > 2) {
          value = `${parts[0]}.${decimal.slice(0, 2)}`;
        }
      }
    }
    setEditingBookingData((prev) =>
      prev ? { ...prev, [field]: value } : null
    );
  };
  const handleBadgeToggle = (field: keyof EditingBookingData) => {
    setEditingBookingData((prev) => {
      if (!prev) return null;
      const currentValue = prev[field] === 'x' ? '' : 'x';
      return { ...prev, [field]: currentValue };
    });
  };
  const handleServiceTypeToggle = () => {
    setEditingBookingData((prev) => {
      if (!prev) return null;
      const currentType = prev['FO/BO/FP'] || 'FP';
      let nextType: string;
      if (currentType === 'FP') nextType = 'FO';
      else if (currentType === 'FO') nextType = 'BO';
      else nextType = 'FP';
      return { ...prev, 'FO/BO/FP': nextType };
    });
  };
  const handleSaveEdit = (
    bookingId: string,
    dataToSave: EditingBookingData | null
  ) => {
    if (!dataToSave || !activeSeason) return;
    setError(null);
    setSuccessMessage(null);
    try {
      const houseNum = dataToSave['House #']?.trim() || '';
      const street = dataToSave['Street Name']?.trim() || '';
      const fullAddress = `${houseNum} ${street}`.trim();
      const updates: Partial<MasterBooking> = { ...dataToSave };
      delete updates['House #'];
      delete updates['Street Name'];
      updates['Full Address'] = fullAddress;

      const success = bookingHelpers.updateBooking(
        activeSeason.id,
        bookingId,
        updates
      );
      if (success) {
        setSuccessMessage('Booking updated successfully.');
        setTimeout(() => setSuccessMessage(null), 2000);
      } else {
        throw new Error('Booking not found in database.');
      }
    } catch (err) {
      console.error('Error saving booking via store:', err);
      setError(
        `Error saving: ${err instanceof Error ? err.message : 'Unknown error'}`
      );
    }
  };

  // --- Render Functions ---
  const renderBookingRow = (booking: MasterBooking) => {
    const isExpanded = expandedBookingId === booking['Booking ID'];
    const currentData =
      isExpanded && editingBookingData ? editingBookingData : booking;
    const address = currentData['Full Address'] || '';
    const firstSpaceIndex = address.indexOf(' ');
    const displayHouseNumber =
      firstSpaceIndex > 0 ? address.substring(0, firstSpaceIndex) : address;
    const displayStreetName =
      firstSpaceIndex > 0 ? address.substring(firstSpaceIndex + 1) : '';
    const price = parseFloat(currentData.Price || '0').toFixed(2);
    const allBadges = [
      { key: 'Prepaid', text: 'PP', color: 'bg-green-900/40 text-green-300', toggleFn: () => handleBadgeToggle('Prepaid') },
      { key: 'FO/BO/FP', text: currentData['FO/BO/FP'] || 'FP', color: 'bg-blue-900/40 text-blue-300', toggleFn: handleServiceTypeToggle },
      { key: 'Sprinkler', text: 'SS', color: 'bg-indigo-900/40 text-indigo-300', toggleFn: () => handleBadgeToggle('Sprinkler') },
      { key: 'Gate', text: 'LG', color: 'bg-yellow-900/40 text-yellow-300', toggleFn: () => handleBadgeToggle('Gate') },
      { key: 'Must be home', text: 'MBH', color: 'bg-purple-900/40 text-purple-300', toggleFn: () => handleBadgeToggle('Must be home') },
      { key: 'Call First', text: 'CF', color: 'bg-pink-900/40 text-pink-300', toggleFn: () => handleBadgeToggle('Call First') },
      { key: 'Second Run', text: '2nd', color: 'bg-red-900/40 text-red-300', toggleFn: () => handleBadgeToggle('Second Run') },
    ];
    const currentBadges = allBadges.filter(
      (badge) =>
        badge.key === 'FO/BO/FP' ||
        currentData[badge.key as keyof MasterBooking] === 'x'
    );
    return (
      <div
        key={booking['Booking ID']}
        className={`border-b border-gray-700 transition-all duration-300 ease-in-out ${
          isExpanded ? 'bg-gray-700/50' : 'hover:bg-gray-700/30'
        }`}
      >
        <div
          onClick={() => handleToggleExpand(booking['Booking ID'])}
          className="p-2 grid grid-cols-[80px_1fr_1fr_100px_1fr_80px_1fr_30px] gap-2 items-center text-sm cursor-pointer"
        >
          {isExpanded && editingBookingData ? (
            <input type="text" value={editingBookingData['Route Number'] || ''} onChange={(e) => handleInputChange('Route Number', e.target.value)} className="input text-xs py-1 px-1.5 bg-gray-600 border-gray-500 font-mono" onClick={(e) => e.stopPropagation()} />
          ) : (
            <span className="truncate text-gray-300 font-mono text-xs">{currentData['Route Number']}</span>
          )}
          {isExpanded && editingBookingData ? (
            <input type="text" value={editingBookingData['First Name'] || ''} onChange={(e) => handleInputChange('First Name', e.target.value)} className="input text-xs py-1 px-1.5 bg-gray-600 border-gray-500" onClick={(e) => e.stopPropagation()} />
          ) : (
            <span className="truncate text-gray-300">{currentData['First Name']}</span>
          )}
          {isExpanded && editingBookingData ? (
            <input type="text" value={editingBookingData['Last Name'] || ''} onChange={(e) => handleInputChange('Last Name', e.target.value)} className="input text-xs py-1 px-1.5 bg-gray-600 border-gray-500" onClick={(e) => e.stopPropagation()} />
          ) : (
            <span className="truncate text-gray-300">{currentData['Last Name']}</span>
          )}
          {isExpanded && editingBookingData ? (
            <input type="text" value={editingBookingData['House #'] || ''} onChange={(e) => handleInputChange('House #', e.target.value)} className="input text-xs py-1 px-1.5 bg-gray-600 border-gray-500" onClick={(e) => e.stopPropagation()} />
          ) : (
            <span className="truncate text-gray-300">{displayHouseNumber}</span>
          )}
          {isExpanded && editingBookingData ? (
            <input type="text" value={editingBookingData['Street Name'] || ''} onChange={(e) => handleInputChange('Street Name', e.target.value)} className="input text-xs py-1 px-1.5 bg-gray-600 border-gray-500" onClick={(e) => e.stopPropagation()} />
          ) : (
            <span className="truncate text-gray-300">{displayStreetName}</span>
          )}
          {isExpanded && editingBookingData ? (
            <input type="text" value={editingBookingData['Price'] || ''} onChange={(e) => handleInputChange('Price', e.target.value)} className="input text-xs py-1 px-1.5 text-right bg-gray-600 border-gray-500" onClick={(e) => e.stopPropagation()} />
          ) : (
            <span className="text-right text-gray-200 font-medium">${price}</span>
          )}
          <span className="flex flex-wrap gap-1 items-center">
            {currentBadges.map((badge) => (
              <button
                key={badge.key}
                onClick={(e) => {
                  if (!isExpanded) return;
                  e.stopPropagation();
                  badge.toggleFn();
                }}
                disabled={!isExpanded}
                className={`text-[10px] px-1.5 py-0.5 rounded ${badge.color} whitespace-nowrap font-medium ${isExpanded ? 'cursor-pointer hover:brightness-125' : 'cursor-default'}`}
                title={isExpanded ? `Toggle ${badge.key}` : badge.key}
              >
                {badge.text}
              </button>
            ))}
            {isExpanded && (
              <button
                onClick={(e) => e.stopPropagation()}
                className="group relative text-[10px] px-1 py-0.5 rounded bg-gray-600 text-gray-400 hover:bg-gray-500"
                title="Add Badge"
              > +
                <div className="absolute hidden group-focus:block group-hover:block right-0 mt-1 w-28 bg-gray-900 border border-gray-700 rounded shadow-lg z-10 p-1 space-y-1">
                  {allBadges
                    .filter((b) => b.key !== 'FO/BO/FP')
                    .filter((b) => !currentBadges.find((cb) => cb.key === b.key))
                    .map((badge) => (
                      <button
                        key={badge.key}
                        onClick={(e) => { e.stopPropagation(); badge.toggleFn(); }}
                        className={`w-full text-left text-[10px] px-1.5 py-0.5 rounded ${badge.color} hover:brightness-125`}
                      >
                        {badge.text} ({badge.key})
                      </button>
                    ))}
                  {allBadges.filter((b) => b.key !== 'FO/BO/FP').filter((b) => !currentBadges.find((cb) => cb.key === b.key)).length === 0 && (
                    <span className="text-[10px] text-gray-500 px-1.5 py-0.5 block text-center">No more badges</span>
                  )}
                </div>
              </button>
            )}
          </span>
          <span className="text-center text-gray-400 flex justify-center">
            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </span>
        </div>
        {isExpanded && editingBookingData && (
          <div className="p-4 pt-2 bg-gray-700/30 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2">
                <Phone size={14} className="text-gray-400 shrink-0" />
                <input type="text" placeholder="Home Phone" value={editingBookingData['Home Phone'] || ''} onChange={(e) => handleInputChange('Home Phone', e.target.value)} className="input text-xs py-1 px-1.5 bg-gray-600 border-gray-500 w-full" />
              </div>
              <div className="flex items-center gap-2">
                <Mail size={14} className="text-gray-400 shrink-0" />
                <input type="email" placeholder="Email Address" value={editingBookingData['Email Address'] || ''} onChange={(e) => handleInputChange('Email Address', e.target.value)} className="input text-xs py-1 px-1.5 bg-gray-600 border-gray-500 w-full" />
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderBookingTable = () => {
    return (
      <div className="bg-gray-800 rounded-lg shadow-lg flex flex-col h-full animate-fade-in">
        {/* Header */}
        <div className="p-4 border-b border-gray-700 flex-shrink-0">
          <div className="flex flex-wrap justify-between items-center gap-4 ">
            <div>
              <h3 className="text-xl font-semibold text-white">
                {activeSeason?.name || 'Bookings'}
              </h3>
              <p className="text-sm text-gray-400">
                Total Filtered: {filteredBookings.length}
              </p>
            </div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                <Search size={16} />
              </span>
              <input
                type="text"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input pl-9 w-64 text-sm py-1.5"
              />
            </div>
          </div>
        </div>
        {/* Table Area */}
        <div className="flex-grow overflow-hidden flex flex-col">
          {/* Table Header */}
          <div className="p-2 bg-gray-700 text-xs text-gray-400 grid grid-cols-[80px_1fr_1fr_100px_1fr_80px_1fr_30px] gap-2 font-medium sticky top-0 z-10 flex-shrink-0">
            <span>Route #</span> <span>First</span> <span>Last</span>
            <span>House #</span> <span>Street Name</span>
            <span className="text-right">Price</span> <span>Badges</span>
            <span></span>
          </div>
          {/* Table Body */}
          <div className="flex-grow overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
            {loading ? (
              <div className="flex justify-center items-center h-40">
                <Loader className="animate-spin text-cps-blue" size={32} />
              </div>
            ) : filteredBookings.length > 0 ? (
              filteredBookings.map(renderBookingRow)
            ) : (
              <p className="p-6 text-center text-gray-500">
                No bookings found for "{activeSubTab}"
                {searchTerm ? ` matching "${searchTerm}"` : ''}.
              </p>
            )}
          </div>
        </div>
      </div>
    );
  };
  // --- End Renderers ---

  // --- Main Render ---
  return (
    <div className="animate-fade-in flex flex-col h-[calc(100vh-14rem)]">
      {/* Top-level Season Tabs */}
      <div className="flex border-b border-gray-700 mb-6 flex-shrink-0">
        {enabledSeasons.map((season) => (
          <button
            key={season.id}
            onClick={() => setActiveSeason(season)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors duration-150 focus:outline-none ${
              activeSeason?.id === season.id
                ? 'border-cps-blue text-white'
                : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-500'
            }`}
          >
            <Database size={16} /> {season.name}
          </button>
        ))}
        {enabledSeasons.length === 0 && !loading && (
          <p className="p-4 text-gray-500">
            No seasons are enabled for this console profile.
          </p>
        )}
      </div>

      {/* Messages Area */}
      {error && (
        <div className="mb-4 p-3 bg-red-900/30 text-red-300 border border-red-700 rounded-md text-sm flex items-center justify-between shadow-lg flex-shrink-0">
          <span className="flex items-center gap-2">
            <AlertCircle size={16} /> {error}
          </span>
          <button
            onClick={() => setError(null)}
            className="p-1 rounded-full hover:bg-red-800/50"
          >
            <X size={18} />
          </button>
        </div>
      )}
      {successMessage && (
        <div className="mb-4 p-3 bg-green-900/30 text-green-300 border border-green-700 rounded-md text-sm flex items-center justify-between shadow-lg flex-shrink-0">
          <span className="flex items-center gap-2">
            <CheckCircle size={16} /> {successMessage}
          </span>
          <button
            onClick={() => setSuccessMessage(null)}
            className="p-1 rounded-full hover:bg-green-800/50"
          >
            <X size={18} />
          </button>
        </div>
      )}

      {/* Render correct view */}
      <div className="flex-grow overflow-hidden">
        {activeSeason ? (
          renderBookingTable()
        ) : (
          !loading && (
            <div className="text-center text-gray-500 pt-10">
              Please select an enabled season to view bookings.
            </div>
          )
        )}
      </div>

      {/* Sub-Tabs Footer */}
      <div className="flex-shrink-0 border-t border-gray-700 bg-gray-800 rounded-b-lg overflow-hidden mt-auto">
        <div className="flex overflow-x-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
          {SUB_TABS.map((tabName) => (
            <button
              key={tabName}
              onClick={() => setActiveSubTab(tabName)}
              className={`px-3 py-2 text-xs font-medium whitespace-nowrap border-r border-gray-700 last:border-r-0 transition-colors focus:outline-none ${
                activeSubTab === tabName
                  ? 'bg-gray-600 text-white'
                  : 'bg-gray-700/50 text-gray-400 hover:bg-gray-700 hover:text-gray-200'
              }`}
            >
              {tabName}
            </button>
          ))}
          <div className="flex-grow border-r border-gray-700 bg-gray-700/50"></div>
        </div>
      </div>
    </div>
  );
};

export default ConsoleMasterBookings;