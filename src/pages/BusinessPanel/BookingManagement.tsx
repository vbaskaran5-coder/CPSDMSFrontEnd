// src/pages/BusinessPanel/BookingManagement.tsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Database,
  Upload,
  Trash2,
  AlertCircle,
  CheckCircle,
  Clock,
  XCircle,
  Download,
  Loader,
  X,
  Save,
  Search,
  Phone,
  Mail,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import Papa from 'papaparse'; // PapaParse is still needed for the import logic
import { MasterBooking } from '../../types';
import {
  setStorageItem,
  getStorageItem,
  STORAGE_KEYS,
  removeStorageItem,
} from '../../lib/localStorage';
import { REGIONS, HardcodedSeason } from '../../lib/hardcodedData'; // Import REGIONS
import { ensureEastTerritoryStructureFetched } from '../../lib/dataSyncService'; // <<< IMPORTED dataSyncService

// --- Interfaces ---
interface BookingDatabaseInfo {
  key: keyof typeof STORAGE_KEYS;
  name: string;
  region: 'West' | 'Central' | 'East';
  seasonName: string;
  hardcodedId: string; // Use the ID (e.g., 'east-aeration')
  hcSeason: HardcodedSeason; // Store the full config
}

// Generate the list of database info based on hardcodedData
const generateDatabaseInfoList = (): BookingDatabaseInfo[] => {
  const dbList: BookingDatabaseInfo[] = [];
  REGIONS.forEach((region) => {
    region.seasons.forEach((season) => {
      // Use the storageKey directly from the season config
      const storageKeyName = season.storageKey;
      // Check if the key name is valid and exists in STORAGE_KEYS
      if (storageKeyName && storageKeyName in STORAGE_KEYS) {
        dbList.push({
          key: storageKeyName, // e.g., 'BOOKINGS_EAST_AERATION'
          name: `${region.id} - ${season.name}`, // e.g., 'East - Aeration'
          region: region.id,
          seasonName: season.name,
          hardcodedId: season.id, // e.g., 'east-aeration'
          hcSeason: season, // Store the full object
        });
      }
    });
  });
  return dbList;
};

const DATABASES = generateDatabaseInfoList(); // Generate the list dynamically

type MainTab = 'Overview' | keyof typeof STORAGE_KEYS; // Main tabs can be Overview or a specific database key name

interface BookingCounts {
  total: number;
  active: number;
  completed: number;
  cancelled: number;
  redo: number;
  billed: number;
  refdnb: number;
}
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
// Type for the inline editing state (including temporary fields)
interface EditingBookingData extends Partial<MasterBooking> {
  'House #'?: string; // Add temporary field
  'Street Name'?: string; // Add temporary field
}

// Interface for the full territory structure from Google Sheet
interface FullTerritoryStructure {
  [group: string]: {
    [map: string]: string[]; // Array of all route codes
  };
}
// --- End Interfaces ---

// --- Component ---
const BookingManagement: React.FC = () => {
  const [activeMainTab, setActiveMainTab] = useState<MainTab>('Overview');
  const [activeSubTab, setActiveSubTab] = useState<SubTabStatus>('Active');
  const [loading, setLoading] = useState<Record<string, boolean>>({}); // Loading state per DB key for imports
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [bookingCounts, setBookingCounts] = useState<
    Record<string, BookingCounts> // Keyed by DB Key Name (e.g., 'BOOKINGS_EAST_AERATION')
  >({});
  const [searchTerm, setSearchTerm] = useState('');
  const [currentBookings, setCurrentBookings] = useState<MasterBooking[]>([]); // Bookings for the currently selected DB tab
  const navigate = useNavigate();
  const [expandedBookingId, setExpandedBookingId] = useState<string | null>(
    null
  );
  const [editingBookingData, setEditingBookingData] =
    useState<EditingBookingData | null>(null);

  // --- Effects ---
  // Effect to calculate counts on mount and listen for storage updates
  useEffect(() => {
    calculateAllCounts(); // Calculate counts for the Overview tab initially

    const handleStorageUpdate = (event: any) => {
      const updatedKey = event?.detail?.key;
      // Recalculate counts if any booking database is updated
      if (updatedKey && updatedKey.startsWith('bookings_')) {
        console.log(`Storage key ${updatedKey} updated, recalculating counts.`);
        calculateAllCounts(); // Recalculate counts for Overview

        // Reload data for the active database tab if it was the one updated
        if (
          activeMainTab !== 'Overview' &&
          updatedKey ===
            STORAGE_KEYS[activeMainTab as keyof typeof STORAGE_KEYS]
        ) {
          console.log(
            `Active DB tab (${activeMainTab}) updated, reloading data.`
          );
          loadDataForActiveDbTab(activeMainTab as keyof typeof STORAGE_KEYS);
        }
      }
      // Reload counts if territory structure changes (might affect mapping in future imports)
      else if (updatedKey === STORAGE_KEYS.EAST_TERRITORY_STRUCTURE) {
        console.log('Territory structure updated, recalculating counts.');
        calculateAllCounts();
      }
    };

    window.addEventListener('storageUpdated', handleStorageUpdate);
    return () =>
      window.removeEventListener('storageUpdated', handleStorageUpdate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only on mount

  // Effect to load data when the main database tab changes
  useEffect(() => {
    if (activeMainTab !== 'Overview') {
      // If a specific database tab is selected
      loadDataForActiveDbTab(activeMainTab as keyof typeof STORAGE_KEYS);
    } else {
      // If Overview tab is selected, clear the current bookings
      setCurrentBookings([]);
    }
    // Reset secondary states when changing main tab
    setActiveSubTab('Active'); // Default to 'Active' sub-tab
    setSearchTerm('');
    setExpandedBookingId(null);
    setEditingBookingData(null);
    setError(null); // Clear errors
    setSuccessMessage(null); // Clear success messages
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMainTab]); // Re-run when the main tab changes

  // --- Data Loading and Calculation ---
  const loadDataForActiveDbTab = useCallback(
    (dbKey: keyof typeof STORAGE_KEYS | null) => {
      // Ensure the key is valid before proceeding
      if (!dbKey || !(dbKey in STORAGE_KEYS)) {
        setCurrentBookings([]);
        console.warn('loadDataForActiveDbTab called with invalid key:', dbKey);
        setError(`Invalid database key selected: ${dbKey}`);
        return;
      }

      const currentStorageKey = STORAGE_KEYS[dbKey]; // Get the actual storage key string
      console.log(`Loading data for key: ${currentStorageKey}`);
      let bookings = getStorageItem<MasterBooking[]>(currentStorageKey, []); // Load from localStorage

      // --- Migration Logic ---
      // Check if the target is East Aeration, it's empty, AND the old 'bookings' key exists
      if (
        bookings.length === 0 &&
        dbKey === 'BOOKINGS_EAST_AERATION' && // Specifically check for the target key name
        localStorage.getItem(STORAGE_KEYS.BOOKINGS) !== null // Check if the old key exists
      ) {
        console.log("Checking for old 'bookings' data to migrate...");
        const oldBookings = getStorageItem<MasterBooking[]>(
          STORAGE_KEYS.BOOKINGS,
          [] // Provide default for the old key as well
        );
        if (oldBookings.length > 0) {
          console.log(
            `Found ${oldBookings.length} old bookings. Migrating to ${currentStorageKey}...`
          );
          setStorageItem(currentStorageKey, oldBookings); // Save old data to the new key
          removeStorageItem(STORAGE_KEYS.BOOKINGS); // Remove the old key
          bookings = oldBookings; // Use the migrated data immediately
          setSuccessMessage(
            `Successfully migrated ${oldBookings.length} old bookings to East Aeration.`
          );
          calculateAllCounts(); // Update counts immediately after migration
        } else {
          // If the old key existed but was empty, just remove it
          removeStorageItem(STORAGE_KEYS.BOOKINGS);
          console.log("Removed empty legacy 'bookings' key.");
        }
      }
      // --- End Migration Logic ---

      setCurrentBookings(bookings); // Set the loaded (or migrated) bookings
      console.log(`Loaded ${bookings.length} bookings for ${dbKey}.`);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [] // calculateAllCounts removed, it's called separately where needed
  );

  // Calculates booking counts for a single database key
  const calculateCountsForKey = (storageKey: string): BookingCounts => {
    const bookings = getStorageItem<MasterBooking[]>(storageKey, []);
    // Filter logic remains the same as MasterBookings.tsx
    const active = bookings.filter(
      (b) =>
        !b.Completed &&
        (!b.Status || b.Status === 'pending' || b.Status === 'contract')
    ).length;
    const completed = bookings.filter(
      (b) =>
        b.Completed === 'x' &&
        (b['Payment Method'] || '').toLowerCase() !== 'billed'
    ).length;
    const cancelled = bookings.filter((b) => b.Status === 'cancelled').length;
    const redo = bookings.filter((b) => b.Status === 'redo').length;
    const billed = bookings.filter(
      (b) =>
        b.Completed === 'x' &&
        (b['Payment Method'] || '').toLowerCase() === 'billed'
    ).length;
    const refdnb = bookings.filter((b) => b.Status === 'ref/dnb').length;
    return {
      total: bookings.length,
      active,
      completed,
      cancelled,
      redo,
      billed,
      refdnb,
    };
  };

  // Calculates counts for ALL databases (used for Overview tab)
  const calculateAllCounts = useCallback(() => {
    console.log('Recalculating all booking counts for Overview...');
    const newCounts: Record<string, BookingCounts> = {};
    DATABASES.forEach((dbInfo) => {
      // Use the actual storage key string (e.g., 'bookings_east_aeration')
      const keyString = STORAGE_KEYS[dbInfo.key];
      // Store counts using the key name (e.g., 'BOOKINGS_EAST_AERATION') for consistency
      newCounts[dbInfo.key] = calculateCountsForKey(keyString);
    });
    setBookingCounts(newCounts);
  }, []); // Empty dependencies, relies on getting current storage state

  // --- Filtering Logic (Memoized, same as MasterBookings.tsx) ---
  const filteredBookings = useMemo(() => {
    if (activeMainTab === 'Overview') return []; // No table data needed for Overview

    let filtered = currentBookings; // Start with bookings loaded for the active tab

    // Apply sub-tab filtering
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

    // Apply search term filtering
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

    // Sort the final filtered list by Route Number
    filtered.sort((a, b) =>
      (a['Route Number'] || '').localeCompare(b['Route Number'] || '')
    );

    console.log(
      `Filtering complete for ${activeMainTab} - ${activeSubTab}. Found ${filtered.length} bookings.`
    );
    return filtered;
  }, [currentBookings, activeSubTab, searchTerm, activeMainTab]);

  // --- Import Handlers ---
  const handleEastAerationImport = useCallback(async () => {
    // <<< Made async
    const tabKey = 'BOOKINGS_EAST_AERATION';
    const storageKey = STORAGE_KEYS[tabKey]; // Get the actual storage key string
    setError(null);
    setSuccessMessage(null);
    setLoading((prev) => ({ ...prev, [tabKey]: true })); // Set loading for this specific import

    try {
      // <<< REFACTOR: Use dataSyncService to ensure structure is ready >>>
      const territoryStructure = await ensureEastTerritoryStructureFetched();
      // <<< END REFACTOR >>>

      if (Object.keys(territoryStructure).length === 0) {
        throw new Error(
          'Territory structure is empty. Cannot map routes. Try resetting session on homepage.'
        );
      }

      // Build routeToMap from the fetched structure (same logic as before)
      const routeToMap: Record<string, { group: string; map: string }> = {};
      for (const group in territoryStructure) {
        for (const map in territoryStructure[group]) {
          territoryStructure[group][map].forEach((routeCode) => {
            routeToMap[routeCode] = { group, map };
          });
        }
      }
      console.log(
        `Built routeToMap with ${Object.keys(routeToMap).length} routes.`
      );

      // Fetch bookings data (same logic as before)
      const bookingsResponse = await fetch(
        'https://docs.google.com/spreadsheets/d/1KPRTH3bESAi-0-2K9v1b-hOUGdCqzLD0D4mdKCSMs-0/gviz/tq?tqx=out:csv&sheet=East%20Aeration'
      );
      if (!bookingsResponse.ok)
        throw new Error(
          `Bookings fetch failed: ${bookingsResponse.statusText}`
        );
      const bookingsText = await bookingsResponse.text();

      // Parse and Map Bookings (same logic as before)
      const bookingsResult = Papa.parse(bookingsText, {
        header: true,
        skipEmptyLines: true,
      });
      if (bookingsResult.errors.length > 0)
        throw new Error(
          `Bookings parsing error: ${bookingsResult.errors[0].message}`
        );
      if (!bookingsResult.data || bookingsResult.data.length === 0)
        throw new Error('No data rows found in sheet.');

      console.log(
        `Parsed ${bookingsResult.data.length} rows from bookings sheet.`
      );

      let skippedRowCount = 0;
      const mappedData: MasterBooking[] = bookingsResult.data
        .map((row: any, index: number) => {
          const routeNumber = row['Route #']?.trim();
          if (!routeNumber) {
            skippedRowCount++;
            // console.warn(`Skipping row ${index + 2} due to missing Route #.`);
            return null; // Skip row if no route number
          }
          const mapInfo = routeToMap[routeNumber]; // Look up in the map
          if (!mapInfo) {
            console.warn(
              `Route Number ${routeNumber} not found in Territory Structure for row ${
                index + 2
              }. Assigning to Unknown.`
            );
            // Assign to Unknown instead of skipping if mapping fails
            // mapInfo = { group: 'Unknown', map: 'Unknown' };
            skippedRowCount++; // Still count as skipped if mapping fails
            return null;
          }

          // Generate a unique ID (consider stability if imports happen often)
          const bookingId = `${routeNumber}-EA-${Date.now()}-${index}-${Math.random()
            .toString(16)
            .slice(2)}`;

          // Combine notes
          const notesParts = [
            row['Sprinkler']?.toLowerCase() === 'x' && 'SS',
            row['Gate']?.toLowerCase() === 'x' && 'Gate',
            row['Must Be Home']?.toLowerCase() === 'x' && 'MBH',
            row['Call First']?.toLowerCase() === 'x' && 'CF',
            row['2nd Round']?.toLowerCase() === 'x' && '2nd RUN',
            row['Notes']?.trim(), // Include existing Notes field
          ].filter(Boolean); // Remove falsy values
          const logSheetNotes = notesParts.join(' - ');

          // Attempt to parse price and type from 'Service' column, fallback to 'Price' column or default
          const serviceString = row['Service']?.trim() || '';
          let price = '59.99'; // Default price
          let propertyType = 'FP'; // Default type
          const serviceParts = serviceString.split(' ');
          if (serviceParts.length > 0 && !isNaN(parseFloat(serviceParts[0]))) {
            price = parseFloat(serviceParts[0]).toFixed(2);
          }
          if (serviceParts.length > 1) {
            const type = serviceParts[1].toUpperCase();
            if (['FP', 'FO', 'BO'].includes(type)) {
              propertyType = type;
            }
          }
          // Override with Price column if it exists and is valid
          if (row['Price']?.trim()) {
            const priceFromCol = parseFloat(row['Price'].trim());
            if (!isNaN(priceFromCol) && priceFromCol > 0) {
              // Ensure price is valid
              price = priceFromCol.toFixed(2);
            }
          }

          // Combine address
          const houseNum = row['House Number']?.trim() || '';
          const streetName = row['Street Name']?.trim() || '';
          const fullAddress = `${houseNum} ${streetName}`.trim();

          // Create the MasterBooking object
          return {
            'Booking ID': bookingId,
            'Booked By': row['Booked By']?.trim() || '',
            'Date/Time Booked': row['Date Booked']?.trim() || '', // Use 'Date Booked' header
            'Master Map': mapInfo.map, // Use mapped value
            Group: mapInfo.group, // Use mapped value
            'Route Number': routeNumber,
            'First Name': row['First Name']?.trim() || '',
            'Last Name': row['Last Name']?.trim() || '',
            'Full Address': fullAddress,
            'Home Phone': row['Phone Number']?.trim() || '', // Use 'Phone Number' header
            'Cell Phone': '', // Assuming Cell Phone is not in this sheet
            'Email Address': row['Email Address']?.trim() || '',
            Price: price, // Use parsed/calculated price
            Prepaid: row['Prepaid']?.toLowerCase() === 'x' ? 'x' : '',
            'FO/BO/FP': propertyType, // Use parsed type
            'Log Sheet Notes': logSheetNotes, // Combined notes
            Completed: '', // Default to not completed
            Status: 'pending', // Default status
            isPrebooked: true, // Mark as prebooked from import
            // Include badge fields directly
            Sprinkler: row['Sprinkler']?.toLowerCase() === 'x' ? 'x' : '',
            Gate: row['Gate']?.toLowerCase() === 'x' ? 'x' : '',
            'Must be home':
              row['Must Be Home']?.toLowerCase() === 'x' ? 'x' : '',
            'Call First': row['Call First']?.toLowerCase() === 'x' ? 'x' : '',
            'Second Run': row['2nd Round']?.toLowerCase() === 'x' ? 'x' : '',
            // Add other potentially missing fields with defaults
            City: '',
            'Phone Type': row['Phone Type']?.trim() || '',
          } as MasterBooking;
        })
        .filter((item): item is MasterBooking => item !== null); // Filter out skipped rows

      console.log(`Mapped ${mappedData.length} bookings successfully.`);

      // Validation and Saving
      if (
        mappedData.length === 0 &&
        bookingsResult.data.length > 0 &&
        skippedRowCount === bookingsResult.data.length
      ) {
        // If all rows were skipped (likely due to missing route# or mapping issues)
        throw new Error(
          `Import failed: All ${bookingsResult.data.length} data rows were skipped (missing Route # or mapping error). Check console warnings.`
        );
      }
      if (skippedRowCount > 0) {
        console.warn(
          `Skipped ${skippedRowCount} rows during import due to missing 'Route #' or mapping issues.`
        );
      }

      setStorageItem(storageKey, mappedData); // Save mapped data to the correct localStorage key
      setSuccessMessage(
        `Imported ${mappedData.length} bookings into East Aeration.${
          skippedRowCount > 0 ? ` Skipped ${skippedRowCount} rows.` : ''
        }`
      );
      // If the currently viewed tab is the one just imported, reload its data
      if (activeMainTab === tabKey) {
        loadDataForActiveDbTab(tabKey);
      }
      calculateAllCounts(); // Recalculate overview counts
    } catch (importError) {
      console.error('East Aeration Import Error:', importError);
      setError(
        `Import failed: ${
          importError instanceof Error ? importError.message : 'Unknown error'
        }. Check console for details.`
      );
    } finally {
      setLoading((prev) => ({ ...prev, [tabKey]: false })); // Stop loading indicator for this import
    }
  }, [activeMainTab, calculateAllCounts, loadDataForActiveDbTab]); // Dependencies

  // --- Edit Handlers (remain same as MasterBookings.tsx) ---
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
        if (decimal && decimal.length > 2)
          value = `${parts[0]}.${decimal.slice(0, 2)}`;
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
    if (!dataToSave || activeMainTab === 'Overview') return;
    const dbKey = activeMainTab as keyof typeof STORAGE_KEYS;
    const storageKey = STORAGE_KEYS[dbKey];
    const bookingIndex = currentBookings.findIndex(
      (b: MasterBooking) => b['Booking ID'] === bookingId
    );

    if (bookingIndex !== -1) {
      // Use structuredClone for deep copy if available and needed, otherwise JSON parse/stringify
      const updatedBookings = JSON.parse(JSON.stringify(currentBookings));
      const houseNum = dataToSave['House #']?.trim() || '';
      const street = dataToSave['Street Name']?.trim() || '';
      const fullAddress = `${houseNum} ${street}`.trim();
      const originalBooking = updatedBookings[bookingIndex];

      // Merge original with changes, apply address, remove temp fields
      updatedBookings[bookingIndex] = {
        ...originalBooking,
        ...dataToSave,
        'Full Address': fullAddress,
        updated_at: new Date().toISOString(), // Update timestamp
      };
      delete updatedBookings[bookingIndex]['House #'];
      delete updatedBookings[bookingIndex]['Street Name'];

      setStorageItem(storageKey, updatedBookings); // Save back to localStorage
      setCurrentBookings(updatedBookings); // Update local state immediately
      setSuccessMessage('Booking updated successfully.');
      setTimeout(() => setSuccessMessage(null), 2000);
    } else {
      console.error(
        `Error saving: Booking ${bookingId} not found in current list.`
      );
      setError(`Error saving: Booking ${bookingId} not found.`);
    }
  };

  // --- Render Functions (remain same as MasterBookings.tsx) ---
  const renderOverview = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 animate-fade-in">
      {DATABASES.map((dbInfo) => {
        const counts = bookingCounts[dbInfo.key] || {
          total: 0,
          active: 0,
          completed: 0,
          cancelled: 0,
          redo: 0,
          billed: 0,
          refdnb: 0,
        };
        const isLoadingImport = loading[dbInfo.key]; // Check loading state for this specific DB key
        const isEastAeration = dbInfo.key === 'BOOKINGS_EAST_AERATION'; // Check if it's the specific importable DB

        return (
          <button
            key={dbInfo.key}
            onClick={() => setActiveMainTab(dbInfo.key)}
            className="bg-gray-700/60 rounded-lg p-4 border border-gray-600/50 flex flex-col justify-between min-h-[170px] shadow-md hover:shadow-lg hover:border-cps-blue focus:outline-none focus:ring-2 focus:ring-cps-blue focus:ring-offset-2 focus:ring-offset-black transition-all duration-200 text-left group"
          >
            {/* Top Section: Info */}
            <div>
              <h4 className="font-semibold text-white mb-1 truncate group-hover:text-cps-blue">
                {dbInfo.name}
              </h4>
              <p className="text-xs text-gray-400 mb-3">
                {dbInfo.region} / {dbInfo.seasonName}
              </p>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between items-center text-gray-300">
                  <span className="flex items-center gap-1.5 text-xs">
                    <Clock size={12} /> Active:
                  </span>
                  <span className="font-medium">{counts.active}</span>
                </div>
                <div className="flex justify-between items-center text-green-400">
                  <span className="flex items-center gap-1.5 text-xs">
                    <CheckCircle size={12} /> Completed:
                  </span>
                  <span className="font-medium">{counts.completed}</span>
                </div>
                <div className="flex justify-between items-center text-red-400">
                  <span className="flex items-center gap-1.5 text-xs">
                    <XCircle size={12} /> Cancelled:
                  </span>
                  <span className="font-medium">{counts.cancelled}</span>
                </div>
                <div className="flex justify-between items-center text-gray-400 pt-1 border-t border-gray-600/50 mt-2">
                  <span className="font-medium text-xs">Total:</span>
                  <span className="font-medium">{counts.total}</span>
                </div>
              </div>
            </div>
            {/* Bottom Section: Import Button (Conditional) */}
            {isEastAeration ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleEastAerationImport();
                }}
                disabled={isLoadingImport}
                className={`mt-3 w-full flex items-center justify-center gap-1.5 px-2 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-xs font-medium transition-colors disabled:bg-gray-500 disabled:cursor-not-allowed ${
                  isLoadingImport ? 'opacity-75 cursor-wait animate-pulse' : ''
                }`}
                title="Import East Aeration from Google Sheet"
              >
                {isLoadingImport ? (
                  <Loader size={12} className="animate-spin" />
                ) : (
                  <Download size={12} />
                )}
                <span>
                  {isLoadingImport ? 'Importing...' : 'Import East Aeration'}
                </span>
              </button>
            ) : (
              // Placeholder for non-importable databases
              <div
                className="mt-3 w-full flex items-center justify-center gap-1.5 px-2 py-1 bg-gray-600/50 text-gray-400/50 rounded text-xs font-medium cursor-not-allowed h-[26px]"
                title="Import function unavailable"
              >
                <Upload size={12} />
                <span>Import (N/A)</span>
              </div>
            )}
          </button>
        );
      })}
    </div>
  );

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
      {
        key: 'Prepaid',
        text: 'PP',
        color: 'bg-green-900/40 text-green-300',
        toggleFn: () => handleBadgeToggle('Prepaid'),
      },
      {
        key: 'FO/BO/FP',
        text: currentData['FO/BO/FP'] || 'FP',
        color: 'bg-blue-900/40 text-blue-300',
        toggleFn: handleServiceTypeToggle,
      },
      {
        key: 'Sprinkler',
        text: 'SS',
        color: 'bg-indigo-900/40 text-indigo-300',
        toggleFn: () => handleBadgeToggle('Sprinkler'),
      },
      {
        key: 'Gate',
        text: 'LG',
        color: 'bg-yellow-900/40 text-yellow-300',
        toggleFn: () => handleBadgeToggle('Gate'),
      },
      {
        key: 'Must be home',
        text: 'MBH',
        color: 'bg-purple-900/40 text-purple-300',
        toggleFn: () => handleBadgeToggle('Must be home'),
      },
      {
        key: 'Call First',
        text: 'CF',
        color: 'bg-pink-900/40 text-pink-300',
        toggleFn: () => handleBadgeToggle('Call First'),
      },
      {
        key: 'Second Run',
        text: '2nd',
        color: 'bg-red-900/40 text-red-300',
        toggleFn: () => handleBadgeToggle('Second Run'),
      },
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
          {/* Fields */}
          {isExpanded && editingBookingData ? (
            <input
              type="text"
              value={editingBookingData['Route Number'] || ''}
              onChange={(e) =>
                handleInputChange('Route Number', e.target.value)
              }
              className="input text-xs py-1 px-1.5 bg-gray-600 border-gray-500 font-mono"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className="truncate text-gray-300 font-mono text-xs">
              {currentData['Route Number']}
            </span>
          )}
          {isExpanded && editingBookingData ? (
            <input
              type="text"
              value={editingBookingData['First Name'] || ''}
              onChange={(e) => handleInputChange('First Name', e.target.value)}
              className="input text-xs py-1 px-1.5 bg-gray-600 border-gray-500"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className="truncate text-gray-300">
              {currentData['First Name']}
            </span>
          )}
          {isExpanded && editingBookingData ? (
            <input
              type="text"
              value={editingBookingData['Last Name'] || ''}
              onChange={(e) => handleInputChange('Last Name', e.target.value)}
              className="input text-xs py-1 px-1.5 bg-gray-600 border-gray-500"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className="truncate text-gray-300">
              {currentData['Last Name']}
            </span>
          )}
          {isExpanded && editingBookingData ? (
            <input
              type="text"
              value={editingBookingData['House #'] || ''}
              onChange={(e) => handleInputChange('House #', e.target.value)}
              className="input text-xs py-1 px-1.5 bg-gray-600 border-gray-500"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className="truncate text-gray-300">{displayHouseNumber}</span>
          )}
          {isExpanded && editingBookingData ? (
            <input
              type="text"
              value={editingBookingData['Street Name'] || ''}
              onChange={(e) => handleInputChange('Street Name', e.target.value)}
              className="input text-xs py-1 px-1.5 bg-gray-600 border-gray-500"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className="truncate text-gray-300">{displayStreetName}</span>
          )}
          {isExpanded && editingBookingData ? (
            <input
              type="text"
              value={editingBookingData['Price'] || ''}
              onChange={(e) => handleInputChange('Price', e.target.value)}
              className="input text-xs py-1 px-1.5 text-right bg-gray-600 border-gray-500"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className="text-right text-gray-200 font-medium">
              ${price}
            </span>
          )}
          {/* Badges */}
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
                className={`text-[10px] px-1.5 py-0.5 rounded ${
                  badge.color
                } whitespace-nowrap font-medium ${
                  isExpanded
                    ? 'cursor-pointer hover:brightness-125'
                    : 'cursor-default'
                }`}
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
              >
                {' '}
                +
                <div className="absolute hidden group-focus:block group-hover:block right-0 mt-1 w-28 bg-gray-900 border border-gray-700 rounded shadow-lg z-10 p-1 space-y-1">
                  {allBadges
                    .filter((b) => b.key !== 'FO/BO/FP')
                    .filter(
                      (b) => !currentBadges.find((cb) => cb.key === b.key)
                    )
                    .map((badge) => (
                      <button
                        key={badge.key}
                        onClick={(e) => {
                          e.stopPropagation();
                          badge.toggleFn();
                        }}
                        className={`w-full text-left text-[10px] px-1.5 py-0.5 rounded ${badge.color} hover:brightness-125`}
                      >
                        {badge.text} ({badge.key})
                      </button>
                    ))}
                  {allBadges
                    .filter((b) => b.key !== 'FO/BO/FP')
                    .filter(
                      (b) => !currentBadges.find((cb) => cb.key === b.key)
                    ).length === 0 && (
                    <span className="text-[10px] text-gray-500 px-1.5 py-0.5 block text-center">
                      No more badges
                    </span>
                  )}
                </div>
              </button>
            )}
          </span>
          {/* Expand Icon */}
          <span className="text-center text-gray-400 flex justify-center">
            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </span>
        </div>
        {/* Expanded Content */}
        {isExpanded && editingBookingData && (
          <div className="p-4 pt-2 bg-gray-700/30 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2">
                <Phone size={14} className="text-gray-400 shrink-0" />
                <input
                  type="text"
                  placeholder="Home Phone"
                  value={editingBookingData['Home Phone'] || ''}
                  onChange={(e) =>
                    handleInputChange('Home Phone', e.target.value)
                  }
                  className="input text-xs py-1 px-1.5 bg-gray-600 border-gray-500 w-full"
                />
              </div>
              <div className="flex items-center gap-2">
                <Mail size={14} className="text-gray-400 shrink-0" />
                <input
                  type="email"
                  placeholder="Email Address"
                  value={editingBookingData['Email Address'] || ''}
                  onChange={(e) =>
                    handleInputChange('Email Address', e.target.value)
                  }
                  className="input text-xs py-1 px-1.5 bg-gray-600 border-gray-500 w-full"
                />
              </div>
            </div>
            {/* Add more editable fields here as needed */}
          </div>
        )}
      </div>
    );
  };

  const renderDatabaseTab = () => {
    if (activeMainTab === 'Overview') return null; // Should not happen if logic is correct
    const currentKey = activeMainTab as keyof typeof STORAGE_KEYS;
    const counts = bookingCounts[currentKey] || {
      total: 0,
      active: 0,
      completed: 0,
      cancelled: 0,
      redo: 0,
      billed: 0,
      refdnb: 0,
    };
    const currentDbInfo = DATABASES.find((db) => db.key === currentKey);

    return (
      <div className="bg-gray-800 rounded-lg shadow-lg flex flex-col h-[calc(100vh-220px)] animate-fade-in">
        {/* Header */}
        <div className="p-4 border-b border-gray-700 flex-shrink-0">
          <div className="flex flex-wrap justify-between items-center gap-4 ">
            <div>
              <h3 className="text-xl font-semibold text-white">
                {currentDbInfo?.name || 'Manage Bookings'}
              </h3>
              <p className="text-sm text-gray-400">
                Total Filtered: {filteredBookings.length} / {counts.total}
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
            <span>Route #</span> <span>First</span> <span>Last</span>{' '}
            <span>House #</span> <span>Street Name</span>{' '}
            <span className="text-right">Price</span> <span>Badges</span>{' '}
            <span></span>
          </div>
          {/* Table Body */}
          <div className="flex-grow overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
            {currentBookings.length === 0 && !loading[currentKey] ? ( // Show only if not loading AND empty
              <p className="p-6 text-center text-gray-500">
                No bookings found for this database.
              </p>
            ) : filteredBookings.length > 0 ? (
              filteredBookings.map(renderBookingRow)
            ) : !loading[currentKey] ? ( // Show only if not loading AND no filter results
              <p className="p-6 text-center text-gray-500">
                No bookings found for "{activeSubTab}"
                {searchTerm ? ` matching "${searchTerm}"` : ''}.
              </p>
            ) : (
              // Optional: You could add a mini-loader here if currentBookings is empty but loading is true
              <div className="flex justify-center items-center h-40">
                <Loader className="animate-spin text-cps-blue" size={24} />
              </div>
            )}
          </div>
        </div>
        {/* Footer Tabs */}
        <div className="flex-shrink-0 border-t border-gray-700 bg-gray-800 rounded-b-lg overflow-hidden">
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

  // --- Main Render ---
  return (
    <div className="animate-fade-in">
      <h2 className="text-2xl font-bold text-white mb-5">Booking Management</h2>

      {/* Messages Area */}
      {error && (
        <div className="mb-4 p-3 bg-red-900/30 text-red-300 border border-red-700 rounded-md text-sm flex items-center justify-between shadow-lg">
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
        <div className="mb-4 p-3 bg-green-900/30 text-green-300 border border-green-700 rounded-md text-sm flex items-center justify-between shadow-lg">
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

      {/* Main Tabs Navigation */}
      <div className="flex border-b border-gray-700 mb-6 overflow-x-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800 pb-px">
        {/* Overview Tab */}
        <button
          key="Overview"
          onClick={() => setActiveMainTab('Overview')}
          className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-cps-blue focus-visible:ring-offset-2 focus-visible:ring-offset-black flex items-center gap-2 ${
            activeMainTab === 'Overview'
              ? 'border-cps-blue text-white'
              : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-500'
          }`}
        >
          <Database size={16} /> Overview
        </button>
        {/* Dynamic Database Tabs */}
        {DATABASES.map((dbInfo) => (
          <button
            key={dbInfo.key}
            onClick={() => setActiveMainTab(dbInfo.key)}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-cps-blue focus-visible:ring-offset-2 focus-visible:ring-offset-black ${
              activeMainTab === dbInfo.key
                ? 'border-cps-blue text-white'
                : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-500'
            }`}
          >
            {dbInfo.name}
          </button>
        ))}
        <div className="flex-grow border-b-2 border-gray-700"></div>{' '}
        {/* Filler */}
      </div>

      {/* Tab Content Area */}
      <div>
        {activeMainTab === 'Overview' ? renderOverview() : renderDatabaseTab()}
      </div>
    </div>
  );
};

export default BookingManagement;
