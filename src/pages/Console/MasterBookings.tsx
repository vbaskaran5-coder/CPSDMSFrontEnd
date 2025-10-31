// src/pages/Console/MasterBookings.tsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Download, // For Maps view
  Users, // For Maps view
  MapPin, // For Maps view
} from 'lucide-react';
import { MasterBooking, Worker, ConsoleProfile } from '../../types';
import { bookingStore } from '../../stores/AdminBookingStore'; // Using the central store
import {
  setStorageItem,
  getStorageItem,
  STORAGE_KEYS,
} from '../../lib/localStorage';
import AssignRouteManager from '../../components/AssignRouteManager';
import EmailTemplate from '../../components/EmailTemplate';
import {
  RouteManager,
  getAssignableRouteManagers,
} from '../../lib/routeManagers';
import {
  ensureEastTerritoryStructureFetched,
  createRouteToTerritoryMap,
} from '../../lib/dataSyncService';

// --- Types ---
type SubTabStatus =
  | 'Maps'
  | 'Active'
  | 'Completed'
  | 'Cancelled'
  | 'Redo'
  | 'Billed'
  | 'Ref/DNB';

const SUB_TABS: SubTabStatus[] = [
  'Maps',
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

interface TerritoryStats {
  group: string;
  map: string;
  bookingsCount: number;
  routesWithBookings: number;
  totalValue: number;
  routesWithData: MapRouteStats[];
}

interface MapRouteStats {
  code: string;
  bookings: number;
  value: number;
}

interface GroupedTerritoryStats {
  [key: string]: TerritoryStats[];
}

interface FullTerritoryStructure {
  [group: string]: {
    [map: string]: string[];
  };
}
// --- End Types ---

// --- Component ---
const MasterBookings: React.FC = () => {
  // --- State ---
  const [activeSubTab, setActiveSubTab] = useState<SubTabStatus>('Maps');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentBookings, setCurrentBookings] = useState<MasterBooking[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [expandedBookingId, setExpandedBookingId] = useState<string | null>(
    null
  );
  const [editingBookingData, setEditingBookingData] =
    useState<EditingBookingData | null>(null);
  const [territoryStats, setTerritoryStats] = useState<GroupedTerritoryStats>(
    {}
  );
  const [fullTerritoryStructure, setFullTerritoryStructure] =
    useState<FullTerritoryStructure>({});
  const [expandedMap, setExpandedMap] = useState<string | null>(null);
  const [selectedMaps, setSelectedMaps] = useState<Set<string>>(new Set());
  const [selectedRoutes, setSelectedRoutes] = useState<Set<string>>(new Set());
  const [showEmailTemplate, setShowEmailTemplate] = useState(false);
  const [showAssignManager, setShowAssignManager] = useState(false);
  const [assignments, setAssignments] = useState<
    Record<string, { manager: RouteManager; date: string }>
  >({});
  const [mapsLoading, setMapsLoading] = useState(false);
  const [assignableManagers, setAssignableManagers] = useState<RouteManager[]>(
    []
  );
  const [territoryAssignments, setTerritoryAssignments] = useState<
    Record<string, number[]>
  >({});
  const [currentConsoleProfileId, setCurrentConsoleProfileId] = useState<
    number | null
  >(null);

  const navigate = useNavigate();
  // --- End State ---

  // --- Data Processing for Maps ---
  const processBookingsForMapStats = useCallback(
    /* ... */ (bookings: MasterBooking[]): GroupedTerritoryStats => {
      // Logic remains the same
      console.log('Processing bookings for Map Stats view...');
      if (!bookings || bookings.length === 0) {
        console.log('No bookings to process for map stats.');
        return {};
      }
      const mapStatsData: Record<string, TerritoryStats> = {}; // Key: mapName
      bookings.forEach((booking) => {
        const masterMap = booking['Master Map']?.trim();
        const routeNumber = booking['Route Number']?.trim();
        const group = booking['Group']?.trim();
        const price = parseFloat(booking['Price'] || '59.99') || 59.99;
        if (!masterMap || !routeNumber || !group) return;
        if (!mapStatsData[masterMap]) {
          mapStatsData[masterMap] = {
            group,
            map: masterMap,
            bookingsCount: 0,
            routesWithBookings: 0,
            totalValue: 0,
            routesWithData: [],
          };
        }
        mapStatsData[masterMap].bookingsCount++;
        mapStatsData[masterMap].totalValue += price;
        let routeStats = mapStatsData[masterMap].routesWithData.find(
          (r) => r.code === routeNumber
        );
        if (!routeStats) {
          routeStats = { code: routeNumber, bookings: 0, value: 0 };
          mapStatsData[masterMap].routesWithData.push(routeStats);
        }
        routeStats.bookings++;
        routeStats.value += price;
      });
      Object.values(mapStatsData).forEach((territory) => {
        territory.routesWithBookings = territory.routesWithData.length;
        territory.routesWithData.sort((a, b) => a.code.localeCompare(b.code));
      });
      const groupedData = Object.values(mapStatsData).reduce(
        (acc: GroupedTerritoryStats, territory) => {
          if (!acc[territory.group]) acc[territory.group] = [];
          acc[territory.group].push(territory);
          return acc;
        },
        {}
      );
      for (const groupName in groupedData) {
        groupedData[groupName].sort((a, b) =>
          a.map.toLowerCase().localeCompare(b.map.toLowerCase())
        );
      }
      console.log('Map Stats data processed:', groupedData);
      return groupedData;
    },
    []
  );

  // --- Effects ---
  const loadData = useCallback(async () => {
    // ... (logic remains the same as previous version) ...
    console.log('Console MasterBookings: loadData triggered.');
    setLoading(true);
    setMapsLoading(true);
    setError(null);
    try {
      const structure = await ensureEastTerritoryStructureFetched();
      setFullTerritoryStructure(structure);
      console.log('Loaded territory structure:', structure);

      const assignmentsFromStorage = getStorageItem(
        STORAGE_KEYS.TERRITORY_ASSIGNMENTS,
        {}
      );
      setTerritoryAssignments(assignmentsFromStorage);
      const adminTitle = getStorageItem(STORAGE_KEYS.ADMIN, null);
      let profileId: number | null = null;
      if (adminTitle) {
        const profiles: ConsoleProfile[] = getStorageItem(
          STORAGE_KEYS.CONSOLE_PROFILES,
          []
        );
        const currentProfile = profiles.find((p) => p.title === adminTitle);
        profileId = currentProfile?.id ?? null;
      }
      setCurrentConsoleProfileId(profileId);
      console.log(`Current Console Profile ID: ${profileId}`);

      const bookingsFromStore = bookingStore.getAllBookings();
      setCurrentBookings(bookingsFromStore);
      console.log(
        `Loaded ${bookingsFromStore.length} bookings (filtered by territory).`
      );

      setWorkers(getStorageItem(STORAGE_KEYS.CONSOLE_WORKERS, []));
      setAssignableManagers(getAssignableRouteManagers());
      const currentMapAssignments = getStorageItem(
        STORAGE_KEYS.MAP_ASSIGNMENTS,
        {}
      );
      setAssignments(currentMapAssignments);

      const processedStats = processBookingsForMapStats(bookingsFromStore);
      setTerritoryStats(processedStats);
    } catch (err) {
      console.error('Error loading data in Console MasterBookings:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
      setCurrentBookings([]);
      setTerritoryStats({});
      setFullTerritoryStructure({});
      setTerritoryAssignments({});
      setCurrentConsoleProfileId(null);
    } finally {
      setLoading(false);
      setMapsLoading(false);
    }
  }, [processBookingsForMapStats]);

  useEffect(() => {
    // ... (logic remains the same as previous version) ...
    loadData();
    window.addEventListener('bookingStoreRefreshed', loadData);
    const handleStorageUpdate = (event: any) => {
      const updatedKey = event?.detail?.key;
      if (
        updatedKey === STORAGE_KEYS.ACTIVE_SEASON_ID ||
        updatedKey === STORAGE_KEYS.ADMIN ||
        updatedKey === STORAGE_KEYS.CONSOLE_PROFILES ||
        updatedKey === STORAGE_KEYS.TERRITORY_ASSIGNMENTS ||
        updatedKey === STORAGE_KEYS.EAST_TERRITORY_STRUCTURE
      ) {
        console.log(
          `Critical state changed (${updatedKey}), reloading MasterBookings data.`
        );
        loadData();
      } else if (updatedKey === STORAGE_KEYS.CONSOLE_WORKERS) {
        setWorkers(getStorageItem(STORAGE_KEYS.CONSOLE_WORKERS, []));
      } else if (updatedKey === STORAGE_KEYS.MAP_ASSIGNMENTS) {
        console.log(
          'Map assignments updated, reloading RM assignments for Maps view...'
        );
        setAssignments(getStorageItem(STORAGE_KEYS.MAP_ASSIGNMENTS, {}));
      } else if (updatedKey === STORAGE_KEYS.ROUTE_MANAGER_PROFILES) {
        setAssignableManagers(getAssignableRouteManagers());
      }
    };
    window.addEventListener('storageUpdated', handleStorageUpdate);
    return () => {
      window.removeEventListener('bookingStoreRefreshed', loadData);
      window.removeEventListener('storageUpdated', handleStorageUpdate);
    };
  }, [loadData]);

  useEffect(() => {
    // ... (logic remains the same as previous version) ...
    setSearchTerm('');
    setExpandedBookingId(null);
    setEditingBookingData(null);
    setSelectedMaps(new Set());
    setSelectedRoutes(new Set());
    setExpandedMap(null);
  }, [activeSubTab]);

  // --- Filtering Logic ---
  const filteredBookings = useMemo(() => {
    // ... (logic remains the same as previous version) ...
    if (activeSubTab === 'Maps') return [];
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
    /* ... */
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
      const bookingToEdit = bookingStore.getBookingById(bookingId);
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
        console.error(`Booking ${bookingId} not found for editing.`);
        setEditingBookingData(null);
      }
      setExpandedBookingId(bookingId);
    }
  };
  const handleInputChange = (
    field: keyof EditingBookingData,
    value: string
  ) => {
    /* ... */
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
    /* ... */
    setEditingBookingData((prev) => {
      if (!prev) return null;
      const currentValue = prev[field] === 'x' ? '' : 'x';
      return { ...prev, [field]: currentValue };
    });
  };
  const handleServiceTypeToggle = () => {
    /* ... */
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
    /* ... */
    if (!dataToSave) return;
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
      bookingStore.updateBooking(bookingId, updates);
      setSuccessMessage('Booking updated successfully.');
      setTimeout(() => setSuccessMessage(null), 2000);
    } catch (err) {
      console.error('Error saving booking via store:', err);
      setError(
        `Error saving: ${err instanceof Error ? err.message : 'Unknown error'}`
      );
    }
  };

  // --- Maps View Handlers ---
  const handleMapSelect = (mapName: string) => {
    /* ... */
    if (!fullTerritoryStructure) return;
    const newSelectedMaps = new Set(selectedMaps);
    const newSelectedRoutes = new Set(selectedRoutes);
    const groupName = Object.keys(fullTerritoryStructure).find(
      (group) => fullTerritoryStructure[group]?.[mapName]
    );
    if (!groupName) return;
    const routesInMap = fullTerritoryStructure[groupName][mapName] || [];
    if (newSelectedMaps.has(mapName)) {
      newSelectedMaps.delete(mapName);
      routesInMap.forEach((routeCode) => newSelectedRoutes.delete(routeCode));
    } else {
      newSelectedMaps.add(mapName);
      routesInMap.forEach((routeCode) => newSelectedRoutes.add(routeCode));
    }
    setSelectedMaps(newSelectedMaps);
    setSelectedRoutes(newSelectedRoutes);
  };
  const handleRouteSelect = (routeCode: string, mapName: string) => {
    /* ... */
    if (!fullTerritoryStructure) return;
    const newSelectedRoutes = new Set(selectedRoutes);
    const newSelectedMaps = new Set(selectedMaps);
    const groupName = Object.keys(fullTerritoryStructure).find(
      (group) => fullTerritoryStructure[group]?.[mapName]
    );
    if (!groupName) return;
    const routesInMap = fullTerritoryStructure[groupName][mapName] || [];
    if (newSelectedRoutes.has(routeCode)) {
      newSelectedRoutes.delete(routeCode);
      newSelectedMaps.delete(mapName);
    } else {
      newSelectedRoutes.add(routeCode);
      const allRoutesInMapSelected = routesInMap.every((r) =>
        newSelectedRoutes.has(r)
      );
      if (allRoutesInMapSelected && routesInMap.length > 0) {
        newSelectedMaps.add(mapName);
      } else {
        newSelectedMaps.delete(mapName);
      }
    }
    setSelectedRoutes(newSelectedRoutes);
    setSelectedMaps(newSelectedMaps);
  };
  const handleAssignManager = (manager: RouteManager) => {
    /* ... */
    const newAssignments = { ...assignments };
    const today = new Date();
    const assignmentDate = `${today.toLocaleString('default', {
      month: 'short',
    })}${today.getDate()}`;
    const isUnassign = manager.name === 'Unassigned';
    const routesCoveredByMaps = new Set<string>();
    selectedMaps.forEach((mapName) => {
      if (isUnassign) {
        delete newAssignments[mapName];
      } else {
        newAssignments[mapName] = { manager, date: assignmentDate };
      }
      const groupName = Object.keys(fullTerritoryStructure).find(
        (group) => fullTerritoryStructure[group]?.[mapName]
      );
      if (groupName) {
        const routesInMap = fullTerritoryStructure[groupName][mapName] || [];
        routesInMap.forEach((routeCode) => routesCoveredByMaps.add(routeCode));
        routesInMap.forEach((routeCode) => delete newAssignments[routeCode]);
      }
    });
    selectedRoutes.forEach((routeCode) => {
      if (!routesCoveredByMaps.has(routeCode)) {
        let partOfSelectedMap = false;
        for (const mapName of selectedMaps) {
          const groupName = Object.keys(fullTerritoryStructure).find(
            (group) => fullTerritoryStructure[group]?.[mapName]
          );
          if (
            groupName &&
            fullTerritoryStructure[groupName][mapName]?.includes(routeCode)
          ) {
            partOfSelectedMap = true;
            break;
          }
        }
        if (!partOfSelectedMap) {
          if (isUnassign) {
            delete newAssignments[routeCode];
          } else {
            newAssignments[routeCode] = { manager, date: assignmentDate };
          }
        }
      }
    });
    setStorageItem(STORAGE_KEYS.MAP_ASSIGNMENTS, newAssignments);
    setAssignments(newAssignments);
    setSelectedMaps(new Set());
    setSelectedRoutes(new Set());
    setShowAssignManager(false);
  };
  const toggleMap = (mapName: string) => {
    /* ... */
    setExpandedMap((prev) => (prev === mapName ? null : mapName));
  };

  // --- Render Functions ---
  const renderBookingRow = (booking: MasterBooking) => {
    // ... (logic remains the same) ...
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
        {' '}
        <div
          onClick={() => handleToggleExpand(booking['Booking ID'])}
          className="p-2 grid grid-cols-[80px_1fr_1fr_100px_1fr_80px_1fr_30px] gap-2 items-center text-sm cursor-pointer"
        >
          {' '}
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
          )}{' '}
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
          )}{' '}
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
          )}{' '}
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
          )}{' '}
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
          )}{' '}
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
          )}{' '}
          <span className="flex flex-wrap gap-1 items-center">
            {' '}
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
            ))}{' '}
            {isExpanded && (
              <button
                onClick={(e) => e.stopPropagation()}
                className="group relative text-[10px] px-1 py-0.5 rounded bg-gray-600 text-gray-400 hover:bg-gray-500"
                title="Add Badge"
              >
                {' '}
                +{' '}
                <div className="absolute hidden group-focus:block group-hover:block right-0 mt-1 w-28 bg-gray-900 border border-gray-700 rounded shadow-lg z-10 p-1 space-y-1">
                  {' '}
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
                    ))}{' '}
                  {allBadges
                    .filter((b) => b.key !== 'FO/BO/FP')
                    .filter(
                      (b) => !currentBadges.find((cb) => cb.key === b.key)
                    ).length === 0 && (
                    <span className="text-[10px] text-gray-500 px-1.5 py-0.5 block text-center">
                      No more badges
                    </span>
                  )}{' '}
                </div>{' '}
              </button>
            )}{' '}
          </span>{' '}
          <span className="text-center text-gray-400 flex justify-center">
            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </span>{' '}
        </div>{' '}
        {isExpanded && editingBookingData && (
          <div className="p-4 pt-2 bg-gray-700/30 space-y-3">
            {' '}
            <div className="grid grid-cols-2 gap-3">
              {' '}
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
              </div>{' '}
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
              </div>{' '}
            </div>{' '}
          </div>
        )}{' '}
      </div>
    );
  };

  const renderMapsView = () => {
    // ... (logic remains the same as previous version) ...
    if (mapsLoading || loading) {
      return (
        <div className="flex justify-center items-center h-[calc(100vh-14rem)]">
          {' '}
          <Loader className="animate-spin text-cps-blue" size={32} />{' '}
        </div>
      );
    }
    const assignedMapNames = new Set<string>();
    if (currentConsoleProfileId !== null) {
      for (const map in territoryAssignments) {
        if (territoryAssignments[map]?.includes(currentConsoleProfileId)) {
          assignedMapNames.add(map);
        }
      }
    }
    const relevantStructure: FullTerritoryStructure = {};
    const relevantGroups = new Set<string>();
    for (const group in fullTerritoryStructure) {
      for (const map in fullTerritoryStructure[group]) {
        if (assignedMapNames.has(map)) {
          if (!relevantStructure[group]) {
            relevantStructure[group] = {};
          }
          relevantStructure[group][map] = fullTerritoryStructure[group][map];
          relevantGroups.add(group);
        }
      }
    }
    const sortedRelevantGroups = Array.from(relevantGroups).sort();
    if (sortedRelevantGroups.length === 0 && !loading) {
      return (
        <div className="flex flex-col items-center justify-center h-[calc(100vh-14rem)] gap-4 text-center">
          {' '}
          <MapPin size={48} className="text-gray-600" />{' '}
          <p className="text-gray-400">
            No territories assigned to this profile, or no structure loaded.
          </p>{' '}
          <p className="text-sm text-gray-500">
            Check assignments in Business Panel or ensure territory data is
            fetched.
          </p>{' '}
        </div>
      );
    }
    return (
      <div className="space-y-4 animate-fade-in pb-16 h-[calc(100vh-14rem)] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800 pr-2">
        {' '}
        <div className="sticky top-0 z-10 py-2 bg-gray-800 -mx-4 px-4 border-b border-gray-700">
          {' '}
          <div className="flex justify-end gap-2">
            {' '}
            <button
              onClick={() => setShowEmailTemplate(true)}
              disabled={selectedMaps.size === 0 && selectedRoutes.size === 0}
              className="px-3 py-1.5 bg-gray-600 text-white rounded-md hover:bg-gray-500 transition-colors flex items-center gap-1.5 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              title="Send Service Notification Email"
            >
              {' '}
              <Mail size={14} /> <span>Notifications</span>{' '}
            </button>{' '}
            <button
              onClick={() => setShowAssignManager(true)}
              disabled={selectedMaps.size === 0 && selectedRoutes.size === 0}
              className="px-3 py-1.5 bg-cps-blue text-white rounded-md hover:bg-blue-700 transition-colors flex items-center gap-1.5 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              title="Assign selected maps/routes to a Route Manager"
            >
              {' '}
              <Users size={14} /> <span>Assign</span>{' '}
            </button>{' '}
          </div>{' '}
        </div>{' '}
        {sortedRelevantGroups.map((groupName) => (
          <div key={groupName} className="space-y-1">
            {' '}
            <h3 className="text-sm font-medium text-gray-400 border-b border-gray-700 pb-1 px-1 sticky top-[49px] bg-gray-800 z-[9]">
              {' '}
              {groupName} (
              {Object.keys(relevantStructure[groupName] || {}).length} Maps){' '}
            </h3>{' '}
            <div className="grid grid-cols-1 gap-1 pt-1">
              {' '}
              {Object.keys(relevantStructure[groupName] || {})
                .sort((a, b) => a.localeCompare(b))
                .map((mapName) => {
                  const mapStats = territoryStats[groupName]?.find(
                    (m) => m.map === mapName
                  );
                  const allRoutesInMap =
                    relevantStructure[groupName]?.[mapName] || [];
                  const mapRouteCount = allRoutesInMap.length;
                  const mapBookingCount = mapStats?.bookingsCount || 0;
                  const mapRoutesWithBookings =
                    mapStats?.routesWithBookings || 0;
                  const mapTotalValue = mapStats?.totalValue || 0;
                  const isMapExpanded = expandedMap === mapName;
                  const isMapSelected = selectedMaps.has(mapName);
                  const mapAssignment = assignments[mapName];
                  return (
                    <div key={mapName}>
                      {' '}
                      <div className="flex items-center gap-2 bg-gray-700/60 rounded-md py-1.5 px-3 border border-gray-600/50">
                        {' '}
                        <input
                          type="checkbox"
                          checked={isMapSelected}
                          onChange={() => handleMapSelect(mapName)}
                          className="h-4 w-4 rounded border-gray-600 bg-gray-900 text-cps-blue focus:ring-cps-blue cursor-pointer flex-shrink-0"
                          title={`Select map ${mapName} and all its ${mapRouteCount} routes`}
                        />{' '}
                        <button
                          onClick={() => toggleMap(mapName)}
                          className="flex-1 flex items-center justify-between text-left min-w-0"
                        >
                          {' '}
                          <div className="flex items-center gap-2 flex-shrink-0 pr-2">
                            {' '}
                            <h4
                              className="text-sm font-medium text-white truncate"
                              title={mapName}
                            >
                              {mapName}
                            </h4>{' '}
                            {mapAssignment && (
                              <div
                                className="w-5 h-5 rounded-full bg-cps-blue flex items-center justify-center text-xs font-medium text-white flex-shrink-0"
                                title={`Assigned to ${mapAssignment.manager.name} on ${mapAssignment.date}`}
                              >
                                {mapAssignment.manager.initials}
                              </div>
                            )}{' '}
                            {isMapExpanded ? (
                              <ChevronUp
                                size={16}
                                className="text-gray-400 ml-1 flex-shrink-0"
                              />
                            ) : (
                              <ChevronDown
                                size={16}
                                className="text-gray-400 ml-1 flex-shrink-0"
                              />
                            )}{' '}
                          </div>{' '}
                          <div className="flex items-center gap-3 text-[11px] text-gray-400 flex-shrink-0 ml-auto">
                            {' '}
                            <span
                              className="w-10 text-right"
                              title="Total Routes"
                            >
                              Rts:{' '}
                              <span className="font-medium text-gray-200">
                                {mapRouteCount}
                              </span>
                            </span>{' '}
                            <span
                              className="w-12 text-right"
                              title="Assigned Bookings"
                            >
                              PBs:{' '}
                              <span className="font-medium text-cps-blue">
                                {mapBookingCount}
                              </span>
                            </span>{' '}
                            <span
                              className="w-12 text-right"
                              title="Assigned Routes w/ Bookings"
                            >
                              Over:{' '}
                              <span className="font-medium text-cps-green">
                                {mapRoutesWithBookings}
                              </span>
                            </span>{' '}
                            <span
                              className="w-12 text-right"
                              title="Assigned Value"
                            >
                              $$:{' '}
                              <span className="font-medium text-cps-yellow">
                                ${mapTotalValue.toFixed(0)}
                              </span>
                            </span>{' '}
                          </div>{' '}
                        </button>{' '}
                      </div>{' '}
                      {isMapExpanded && (
                        <div className="mt-1 pl-10 pr-1 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-1">
                          {' '}
                          {allRoutesInMap.map((routeCode) => {
                            const routeStats = mapStats?.routesWithData.find(
                              (r) => r.code === routeCode
                            );
                            const hasBookings = !!routeStats;
                            const routeBookingCount = routeStats?.bookings || 0;
                            const routeValue = routeStats?.value || 0;
                            const isRouteSelected =
                              selectedRoutes.has(routeCode);
                            const routeAssignment = assignments[routeCode];
                            const showRouteSpecificAssignment =
                              routeAssignment &&
                              (!mapAssignment ||
                                routeAssignment.manager.name !==
                                  mapAssignment.manager.name);
                            const routeBorderClass = hasBookings
                              ? 'border-white/50'
                              : 'border-gray-600/30';
                            return (
                              <div
                                key={routeCode}
                                className={`bg-gray-700/30 rounded-md p-1.5 border flex items-center ${routeBorderClass}`}
                              >
                                {' '}
                                <input
                                  type="checkbox"
                                  checked={isRouteSelected}
                                  onChange={() =>
                                    handleRouteSelect(routeCode, mapName)
                                  }
                                  className="h-4 w-4 rounded border-gray-600 bg-gray-900 text-cps-blue focus:ring-cps-blue cursor-pointer mr-2 flex-shrink-0"
                                />{' '}
                                <div className="flex-1 flex items-center justify-center gap-1 text-xs font-medium text-gray-200">
                                  {' '}
                                  {routeCode}{' '}
                                  {showRouteSpecificAssignment && (
                                    <div
                                      className="w-4 h-4 rounded-full bg-cps-blue/70 flex items-center justify-center text-[9px] font-medium text-white"
                                      title={`Assigned to ${routeAssignment.manager.name} on ${routeAssignment.date}`}
                                    >
                                      {routeAssignment.manager.initials}
                                    </div>
                                  )}{' '}
                                </div>{' '}
                                {hasBookings && (
                                  <div className="flex flex-col items-end text-[10px] ml-2 flex-shrink-0 leading-tight">
                                    {' '}
                                    <span className="font-medium text-cps-blue">
                                      {routeBookingCount} PBs
                                    </span>{' '}
                                    <span className="text-gray-400">
                                      ${routeValue.toFixed(0)}
                                    </span>{' '}
                                  </div>
                                )}{' '}
                              </div>
                            );
                          })}{' '}
                        </div>
                      )}{' '}
                    </div>
                  );
                })}{' '}
            </div>{' '}
          </div>
        ))}{' '}
        <EmailTemplate
          isOpen={showEmailTemplate}
          onClose={() => setShowEmailTemplate(false)}
          selectedMaps={selectedMaps}
          selectedRoutes={selectedRoutes}
        />{' '}
        <AssignRouteManager
          isOpen={showAssignManager}
          onClose={() => setShowAssignManager(false)}
          onAssign={handleAssignManager}
          selectedMaps={selectedMaps}
          selectedRoutes={selectedRoutes}
        />{' '}
      </div>
    );
  };

  const renderBookingTable = () => {
    return (
      <div className="bg-gray-800 rounded-lg shadow-lg flex flex-col h-[calc(100vh-14rem)] animate-fade-in">
        {/* Header */}
        <div className="p-4 border-b border-gray-700 flex-shrink-0">
          <div className="flex flex-wrap justify-between items-center gap-4 ">
            <div>
              <h3 className="text-xl font-semibold text-white">
                Master Bookings (Active Season)
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
            <span>Route #</span> <span>First</span> <span>Last</span>{' '}
            <span>House #</span> <span>Street Name</span>{' '}
            <span className="text-right">Price</span> <span>Badges</span>{' '}
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
        {/* <<< FIX: REMOVED DUPLICATE FOOTER FROM HERE >>> */}
      </div>
    );
  };
  // --- End Renderers ---

  // --- Main Render ---
  return (
    <div className="animate-fade-in flex flex-col h-[calc(100vh-8rem)]">
      {/* Messages Area */}
      {error && (
        <div className="mb-4 p-3 bg-red-900/30 text-red-300 border border-red-700 rounded-md text-sm flex items-center justify-between shadow-lg flex-shrink-0">
          {' '}
          <span className="flex items-center gap-2">
            <AlertCircle size={16} /> {error}
          </span>{' '}
          <button
            onClick={() => setError(null)}
            className="p-1 rounded-full hover:bg-red-800/50"
          >
            <X size={18} />
          </button>{' '}
        </div>
      )}
      {successMessage && (
        <div className="mb-4 p-3 bg-green-900/30 text-green-300 border border-green-700 rounded-md text-sm flex items-center justify-between shadow-lg flex-shrink-0">
          {' '}
          <span className="flex items-center gap-2">
            <CheckCircle size={16} /> {successMessage}
          </span>{' '}
          <button
            onClick={() => setSuccessMessage(null)}
            className="p-1 rounded-full hover:bg-green-800/50"
          >
            <X size={18} />
          </button>{' '}
        </div>
      )}

      {/* Render correct view */}
      <div className="flex-grow overflow-hidden">
        {activeSubTab === 'Maps' ? renderMapsView() : renderBookingTable()}
      </div>

      {/* Sub-Tabs Footer (Single Instance) */}
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
              {' '}
              {tabName === 'Maps' ? (
                <MapPin size={12} className="inline -mt-px mr-1" />
              ) : null}{' '}
              {tabName}{' '}
            </button>
          ))}
          <div className="flex-grow border-r border-gray-700 bg-gray-700/50"></div>
        </div>
      </div>
    </div>
  );
};

export default MasterBookings;
