// src/pages/Management/AdminBookingsAndTerritory.tsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Database,
  Upload,
  AlertCircle,
  CheckCircle,
  Clock,
  XCircle,
  Download,
  Loader,
  X,
  MapPin,
  Users,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import Papa from 'papaparse';
import { MasterBooking, ConsoleProfile } from '../../types';
import {
  setStorageItem,
  getStorageItem,
  STORAGE_KEYS,
  removeStorageItem,
} from '../../lib/localStorage';
import { REGIONS, HardcodedSeason } from '../../lib/hardcodedData';
import { ensureEastTerritoryStructureFetched } from '../../lib/dataSyncService';

// --- Interfaces for Booking Management ---
interface BookingDatabaseInfo {
  key: keyof typeof STORAGE_KEYS;
  name: string;
  region: 'West' | 'Central' | 'East';
  seasonName: string;
  hardcodedId: string;
  hcSeason: HardcodedSeason;
}

const generateDatabaseInfoList = (): BookingDatabaseInfo[] => {
  const dbList: BookingDatabaseInfo[] = [];
  REGIONS.forEach((region) => {
    region.seasons.forEach((season) => {
      const storageKeyName = season.storageKey;
      if (storageKeyName && storageKeyName in STORAGE_KEYS) {
        dbList.push({
          key: storageKeyName,
          name: `${region.id} - ${season.name}`,
          region: region.id,
          seasonName: season.name,
          hardcodedId: season.id,
          hcSeason: season,
        });
      }
    });
  });
  return dbList;
};

const DATABASES = generateDatabaseInfoList();

interface BookingCounts {
  total: number;
  active: number;
  completed: number;
  cancelled: number;
  redo: number;
  billed: number;
  refdnb: number;
}

// --- Interfaces for Territory Management ---
interface TerritoryData {
  group: string;
  map: string;
  bookingCount: number;
  assignedProfileIds: number[];
}

interface GroupedTerritoryData {
  [groupName: string]: TerritoryData[];
}

interface FullTerritoryStructure {
  [group: string]: {
    [map: string]: string[];
  };
}

type RegionTab = 'East' | 'Central' | 'West';

const AdminBookingsAndTerritory: React.FC = () => {
  const [activeView, setActiveView] = useState<'bookings' | 'territory'>(
    'bookings'
  );
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // --- State for Booking Management ---
  const [loadingImport, setLoadingImport] = useState<Record<string, boolean>>(
    {}
  );
  const [bookingCounts, setBookingCounts] = useState<
    Record<string, BookingCounts>
  >({});

  // --- State for Territory Management ---
  const [activeRegionTab, setActiveRegionTab] = useState<RegionTab>('East');
  const [territoryData, setTerritoryData] = useState<GroupedTerritoryData>({});
  const [activeTerritoryStructure, setActiveTerritoryStructure] =
    useState<FullTerritoryStructure>({});
  const [consoleProfiles, setConsoleProfiles] = useState<ConsoleProfile[]>([]);
  const [loadingTerritory, setLoadingTerritory] = useState(true);
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());
  const [selectedMaps, setSelectedMaps] = useState<Set<string>>(new Set());
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [territoryAssignments, setTerritoryAssignments] = useState<
    Record<string, number[]>
  >(() => getStorageItem(STORAGE_KEYS.TERRITORY_ASSIGNMENTS, {}));

  // --- Common Handlers ---
  const clearMessages = () => {
    setError(null);
    setSuccessMessage(null);
  };

  // --- BOOKING MANAGEMENT LOGIC ---

  const calculateCountsForKey = (storageKey: string): BookingCounts => {
    const bookings = getStorageItem<MasterBooking[]>(storageKey, []);
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

  const calculateAllBookingCounts = useCallback(() => {
    console.log('Recalculating all booking counts for Overview...');
    const newCounts: Record<string, BookingCounts> = {};
    DATABASES.forEach((dbInfo) => {
      const keyString = STORAGE_KEYS[dbInfo.key];
      newCounts[dbInfo.key] = calculateCountsForKey(keyString);
    });
    setBookingCounts(newCounts);
  }, []);

  const handleEastAerationImport = useCallback(async () => {
    const tabKey = 'BOOKINGS_EAST_AERATION';
    const storageKey = STORAGE_KEYS[tabKey];
    clearMessages();
    setLoadingImport((prev) => ({ ...prev, [tabKey]: true }));

    try {
      const territoryStructure = await ensureEastTerritoryStructureFetched();
      if (Object.keys(territoryStructure).length === 0) {
        throw new Error(
          'Territory structure is empty. Cannot map routes. Try resetting session on homepage.'
        );
      }

      const routeToMap: Record<string, { group: string; map: string }> = {};
      for (const group in territoryStructure) {
        for (const map in territoryStructure[group]) {
          territoryStructure[group][map].forEach((routeCode) => {
            routeToMap[routeCode] = { group, map };
          });
        }
      }

      const bookingsResponse = await fetch(
        'https://docs.google.com/spreadsheets/d/1KPRTH3bESAi-0-2K9v1b-hOUGdCqzLD0D4mdKCSMs-0/gviz/tq?tqx=out:csv&sheet=East%20Aeration'
      );
      if (!bookingsResponse.ok)
        throw new Error(
          `Bookings fetch failed: ${bookingsResponse.statusText}`
        );
      const bookingsText = await bookingsResponse.text();

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

      let skippedRowCount = 0;
      const mappedData: MasterBooking[] = bookingsResult.data
        .map((row: any, index: number) => {
          const routeNumber = row['Route #']?.trim();
          if (!routeNumber) {
            skippedRowCount++;
            return null;
          }
          const mapInfo = routeToMap[routeNumber];
          if (!mapInfo) {
            console.warn(
              `Route Number ${routeNumber} not found in Territory Structure for row ${
                index + 2
              }. Skipping.`
            );
            skippedRowCount++;
            return null;
          }

          const bookingId = `${routeNumber}-EA-${Date.now()}-${index}-${Math.random()
            .toString(16)
            .slice(2)}`;

          const notesParts = [
            row['Sprinkler']?.toLowerCase() === 'x' && 'SS',
            row['Gate']?.toLowerCase() === 'x' && 'Gate',
            row['Must Be Home']?.toLowerCase() === 'x' && 'MBH',
            row['Call First']?.toLowerCase() === 'x' && 'CF',
            row['2nd Round']?.toLowerCase() === 'x' && '2nd RUN',
            row['Notes']?.trim(),
          ].filter(Boolean);
          const logSheetNotes = notesParts.join(' - ');

          const serviceString = row['Service']?.trim() || '';
          let price = '59.99';
          let propertyType = 'FP';
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
          if (row['Price']?.trim()) {
            const priceFromCol = parseFloat(row['Price'].trim());
            if (!isNaN(priceFromCol) && priceFromCol > 0) {
              price = priceFromCol.toFixed(2);
            }
          }

          const houseNum = row['House Number']?.trim() || '';
          const streetName = row['Street Name']?.trim() || '';
          const fullAddress = `${houseNum} ${streetName}`.trim();

          return {
            'Booking ID': bookingId,
            'Booked By': row['Booked By']?.trim() || '',
            'Date/Time Booked': row['Date Booked']?.trim() || '',
            'Master Map': mapInfo.map,
            Group: mapInfo.group,
            'Route Number': routeNumber,
            'First Name': row['First Name']?.trim() || '',
            'Last Name': row['Last Name']?.trim() || '',
            'Full Address': fullAddress,
            'Home Phone': row['Phone Number']?.trim() || '',
            'Cell Phone': '',
            'Email Address': row['Email Address']?.trim() || '',
            Price: price,
            Prepaid: row['Prepaid']?.toLowerCase() === 'x' ? 'x' : '',
            'FO/BO/FP': propertyType,
            'Log Sheet Notes': logSheetNotes,
            Completed: '',
            Status: 'pending',
            isPrebooked: true,
            Sprinkler: row['Sprinkler']?.toLowerCase() === 'x' ? 'x' : '',
            Gate: row['Gate']?.toLowerCase() === 'x' ? 'x' : '',
            'Must be home':
              row['Must Be Home']?.toLowerCase() === 'x' ? 'x' : '',
            'Call First': row['Call First']?.toLowerCase() === 'x' ? 'x' : '',
            'Second Run': row['2nd Round']?.toLowerCase() === 'x' ? 'x' : '',
            City: '',
            'Phone Type': row['Phone Type']?.trim() || '',
          } as MasterBooking;
        })
        .filter((item): item is MasterBooking => item !== null);

      if (
        mappedData.length === 0 &&
        bookingsResult.data.length > 0 &&
        skippedRowCount === bookingsResult.data.length
      ) {
        throw new Error(
          `Import failed: All ${bookingsResult.data.length} data rows were skipped (missing Route # or mapping error).`
        );
      }

      setStorageItem(storageKey, mappedData);
      setSuccessMessage(
        `Imported ${mappedData.length} bookings into East Aeration.${
          skippedRowCount > 0 ? ` Skipped ${skippedRowCount} rows.` : ''
        }`
      );
      calculateAllBookingCounts();
    } catch (importError) {
      console.error('East Aeration Import Error:', importError);
      setError(
        `Import failed: ${
          importError instanceof Error ? importError.message : 'Unknown error'
        }.`
      );
    } finally {
      setLoadingImport((prev) => ({ ...prev, [tabKey]: false }));
    }
  }, [calculateAllBookingCounts]);

  const renderBookingManagement = () => (
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
        const isLoading = loadingImport[dbInfo.key];
        const isEastAeration = dbInfo.key === 'BOOKINGS_EAST_AERATION';

        return (
          <div
            key={dbInfo.key}
            className="bg-gray-700/60 rounded-lg p-4 border border-gray-600/50 flex flex-col justify-between min-h-[170px] shadow-md"
          >
            <div>
              <h4 className="font-semibold text-white mb-1 truncate">
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
            {isEastAeration ? (
              <button
                onClick={handleEastAerationImport}
                disabled={isLoading}
                className={`mt-3 w-full flex items-center justify-center gap-1.5 px-2 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-xs font-medium transition-colors disabled:bg-gray-500 disabled:cursor-not-allowed ${
                  isLoading ? 'opacity-75 cursor-wait animate-pulse' : ''
                }`}
                title="Import East Aeration from Google Sheet"
              >
                {isLoading ? (
                  <Loader size={12} className="animate-spin" />
                ) : (
                  <Download size={12} />
                )}
                <span>
                  {isLoading ? 'Importing...' : 'Import East Aeration'}
                </span>
              </button>
            ) : (
              <div
                className="mt-3 w-full flex items-center justify-center gap-1.5 px-2 py-1 bg-gray-600/50 text-gray-400/50 rounded text-xs font-medium cursor-not-allowed h-[26px]"
                title="Import function unavailable"
              >
                <Upload size={12} />
                <span>Import (N/A)</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  // --- TERRITORY MANAGEMENT LOGIC ---

  const loadTerritoryData = useCallback(async () => {
    setLoadingTerritory(true);
    clearMessages();
    let structure: FullTerritoryStructure = {};
    let relevantBookings: MasterBooking[] = [];

    try {
      const profiles = getStorageItem<ConsoleProfile[]>(
        STORAGE_KEYS.CONSOLE_PROFILES,
        []
      );
      setConsoleProfiles(profiles);
      const assignments = getStorageItem(
        STORAGE_KEYS.TERRITORY_ASSIGNMENTS,
        {}
      );
      setTerritoryAssignments(assignments);

      if (activeRegionTab === 'East') {
        structure = await ensureEastTerritoryStructureFetched();
        setActiveTerritoryStructure(structure);
        const allBookings = getAllBookingsFromStorage();
        relevantBookings = allBookings.filter(
          (booking) =>
            booking['Group'] &&
            structure[booking['Group']] &&
            structure[booking['Group']][booking['Master Map']]
        );
      } else {
        setActiveTerritoryStructure({});
        relevantBookings = [];
      }

      const territoriesMap: Record<string, TerritoryData> = {};
      for (const group in structure) {
        for (const map in structure[group]) {
          const key = `${group}|${map}`;
          territoriesMap[key] = {
            group,
            map,
            bookingCount: 0,
            assignedProfileIds: assignments[map] || [],
          };
        }
      }

      relevantBookings.forEach((booking) => {
        const group = booking['Group']?.trim();
        const map = booking['Master Map']?.trim();
        const key = group && map ? `${group}|${map}` : null;
        if (key && territoriesMap[key]) {
          territoriesMap[key].bookingCount++;
        }
      });

      const grouped: GroupedTerritoryData = {};
      Object.values(territoriesMap).forEach((td) => {
        if (!grouped[td.group]) grouped[td.group] = [];
        grouped[td.group].push(td);
      });

      for (const groupName in grouped) {
        grouped[groupName].sort((a, b) => a.map.localeCompare(b.map));
      }

      setTerritoryData(grouped);
    } catch (err) {
      console.error('Error loading territory data:', err);
      setError(
        err instanceof Error ? err.message : 'Failed to load territory data'
      );
      setTerritoryData({});
      setActiveTerritoryStructure({});
    } finally {
      setLoadingTerritory(false);
    }
  }, [activeRegionTab]);

  const handleGroupSelect = (groupName: string, isSelected: boolean) => {
    if (activeRegionTab !== 'East') return;
    const newSelectedGroups = new Set(selectedGroups);
    const newSelectedMaps = new Set(selectedMaps);
    const mapsInGroup = Object.keys(activeTerritoryStructure[groupName] || {});

    if (isSelected) {
      newSelectedGroups.add(groupName);
      mapsInGroup.forEach((map) => newSelectedMaps.add(map));
    } else {
      newSelectedGroups.delete(groupName);
      mapsInGroup.forEach((map) => newSelectedMaps.delete(map));
    }
    setSelectedGroups(newSelectedGroups);
    setSelectedMaps(newSelectedMaps);
  };

  const handleMapSelect = (
    mapName: string,
    groupName: string,
    isSelected: boolean
  ) => {
    if (activeRegionTab !== 'East') return;
    const newSelectedMaps = new Set(selectedMaps);
    if (isSelected) newSelectedMaps.add(mapName);
    else newSelectedMaps.delete(mapName);
    setSelectedMaps(newSelectedMaps);

    const mapsInGroup = Object.keys(activeTerritoryStructure[groupName] || {});
    const allMapsInGroupSelected = mapsInGroup.every((map) =>
      newSelectedMaps.has(map)
    );
    const newSelectedGroups = new Set(selectedGroups);
    if (allMapsInGroupSelected && mapsInGroup.length > 0)
      newSelectedGroups.add(groupName);
    else newSelectedGroups.delete(groupName);
    setSelectedGroups(newSelectedGroups);
  };

  const handleOpenAssignModal = () => {
    if (activeRegionTab !== 'East') return;
    if (selectedMaps.size === 0) {
      setError('Please select at least one Group or Master Map to assign.');
      return;
    }
    clearMessages();
    setShowAssignModal(true);
  };

  const handleAssignToProfile = (profileId: number | null) => {
    clearMessages();
    const newAssignments = { ...territoryAssignments };
    let changed = false;
    let assignmentCount = 0;

    if (profileId === null) {
      // Unassign
      selectedMaps.forEach((map) => {
        if (newAssignments[map] && newAssignments[map].length > 0) {
          delete newAssignments[map];
          changed = true;
          assignmentCount++;
        }
      });
      if (changed)
        setSuccessMessage(`Unassigned ${assignmentCount} selected map(s).`);
    } else {
      // Assign
      const applicableProfiles = consoleProfiles.filter(
        (p) => p.region === activeRegionTab
      );
      const profile = applicableProfiles.find((p) => p.id === profileId);

      if (!profile) {
        setError(
          `Selected profile is not an ${activeRegionTab} region profile or not found.`
        );
        setShowAssignModal(false);
        return;
      }

      selectedMaps.forEach((map) => {
        if (!newAssignments[map]) newAssignments[map] = [];
        if (!newAssignments[map].includes(profileId)) {
          newAssignments[map].push(profileId);
          changed = true;
          assignmentCount++;
        }
      });
      if (changed)
        setSuccessMessage(
          `Assigned ${assignmentCount} map(s) to ${profile.title}.`
        );
    }

    if (changed) {
      setTerritoryAssignments(newAssignments);
      setStorageItem(STORAGE_KEYS.TERRITORY_ASSIGNMENTS, newAssignments);
      setSelectedGroups(new Set());
      setSelectedMaps(new Set());
      setTerritoryData((prevData) => {
        const updatedData = { ...prevData };
        Object.keys(updatedData).forEach((group) => {
          updatedData[group] = updatedData[group].map((mapInfo) => ({
            ...mapInfo,
            assignedProfileIds: newAssignments[mapInfo.map] || [],
          }));
        });
        return updatedData;
      });
      setTimeout(() => setSuccessMessage(null), 3000);
    }
    setShowAssignModal(false);
  };

  const toggleGroupExpansion = (groupName: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      next.has(groupName) ? next.delete(groupName) : next.add(groupName);
      return next;
    });
  };

  const getProfileTitles = (profileIds: number[]): string[] => {
    if (!profileIds || profileIds.length === 0) return ['Unassigned'];
    return profileIds
      .map((id) => consoleProfiles.find((p) => p.id === id)?.title)
      .filter((title): title is string => !!title);
  };

  const sortedStructureGroups = useMemo(
    () => Object.keys(activeTerritoryStructure).sort(),
    [activeTerritoryStructure]
  );

  const renderTerritoryManagement = () => (
    <div className="animate-fade-in">
      <div className="flex justify-between items-center mb-5">
        <div className="flex border-b border-gray-700">
          {(['East', 'Central', 'West'] as RegionTab[]).map((region) => (
            <button
              key={region}
              onClick={() => setActiveRegionTab(region)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors duration-150 focus:outline-none ${
                activeRegionTab === region
                  ? 'border-cps-blue text-white'
                  : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-500'
              }`}
            >
              {region}
            </button>
          ))}
          <div className="flex-grow border-b-2 border-gray-700"></div>
        </div>
        {activeRegionTab === 'East' && (
          <button
            onClick={handleOpenAssignModal}
            disabled={selectedMaps.size === 0 || loadingTerritory}
            className="px-4 py-2 bg-cps-blue text-white rounded-md hover:bg-blue-700 transition-colors flex items-center gap-1.5 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Users size={16} /> Assign Selected ({selectedMaps.size})
          </button>
        )}
      </div>

      {renderTerritoryView()}

      {showAssignModal && activeRegionTab === 'East' && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-sm mx-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">
                Assign {activeRegionTab} Territory
              </h3>
              <button
                onClick={() => setShowAssignModal(false)}
                className="p-1 hover:bg-gray-700 rounded-full text-gray-400 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>
            <p className="text-sm text-gray-400 mb-4">
              Select an{' '}
              <span className="font-semibold text-white">
                {activeRegionTab}
              </span>{' '}
              Console Profile to assign the selected {selectedMaps.size} map(s)
              to.
            </p>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-gray-600">
              {consoleProfiles.filter((p) => p.region === activeRegionTab)
                .length > 0 ? (
                consoleProfiles
                  .filter((p) => p.region === activeRegionTab)
                  .map((profile) => (
                    <button
                      key={profile.id}
                      onClick={() => handleAssignToProfile(profile.id)}
                      className="w-full text-left bg-gray-700 text-gray-300 rounded-md hover:bg-gray-600 transition-colors p-3"
                    >
                      {profile.title}
                    </button>
                  ))
              ) : (
                <p className="text-gray-500 text-center">
                  No {activeRegionTab} console profiles found.
                </p>
              )}
              <button
                onClick={() => handleAssignToProfile(null)}
                className="w-full text-left bg-red-900/50 text-red-300 rounded-md hover:bg-red-900/70 transition-colors p-3 mt-4"
              >
                Unassign Selected Maps
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderTerritoryView = () => {
    if (activeRegionTab !== 'East') {
      return (
        <div className="text-center text-gray-500 py-10 bg-gray-800 rounded-lg border border-gray-700/50">
          Territory data for {activeRegionTab} region is not yet available.
        </div>
      );
    }
    if (loadingTerritory) {
      return (
        <div className="flex justify-center items-center h-40">
          <Loader className="animate-spin text-cps-blue" size={32} />
        </div>
      );
    }
    if (sortedStructureGroups.length === 0) {
      return (
        <p className="text-center text-gray-500 py-10">
          No East territory structure found. Check Google Sheet connection or
          cache.
        </p>
      );
    }

    return (
      <div className="space-y-4">
        {sortedStructureGroups.map((groupName) => (
          <div
            key={groupName}
            className="bg-gray-800 rounded-lg border border-gray-700/50 overflow-hidden"
          >
            <div className="flex items-center gap-3 p-3 bg-gray-700/50 border-b border-gray-700/50">
              <input
                type="checkbox"
                checked={selectedGroups.has(groupName)}
                onChange={(e) => handleGroupSelect(groupName, e.target.checked)}
                className="h-4 w-4 rounded border-gray-600 bg-gray-900 text-cps-blue focus:ring-cps-blue cursor-pointer flex-shrink-0"
              />
              <button
                onClick={() => toggleGroupExpansion(groupName)}
                className="flex items-center justify-between flex-grow text-left"
              >
                <h3 className="font-semibold text-white">{groupName}</h3>
                {expandedGroups.has(groupName) ? (
                  <ChevronUp size={18} className="text-gray-400" />
                ) : (
                  <ChevronDown size={18} className="text-gray-400" />
                )}
              </button>
            </div>
            {expandedGroups.has(groupName) && (
              <div className="p-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                {Object.keys(activeTerritoryStructure[groupName] || {})
                  .sort()
                  .map((mapName) => {
                    const mapBookingStats = territoryData[groupName]?.find(
                      (t) => t.map === mapName
                    );
                    const assignedProfileIds =
                      territoryAssignments[mapName] || [];
                    const assignedTitles = getProfileTitles(assignedProfileIds);
                    const isUnassigned =
                      assignedTitles.length === 1 &&
                      assignedTitles[0] === 'Unassigned';

                    return (
                      <div
                        key={mapName}
                        className="flex items-center gap-2 bg-gray-700/40 p-2 rounded border border-gray-600/50"
                      >
                        <input
                          type="checkbox"
                          checked={selectedMaps.has(mapName)}
                          onChange={(e) =>
                            handleMapSelect(
                              mapName,
                              groupName,
                              e.target.checked
                            )
                          }
                          className="h-4 w-4 rounded border-gray-600 bg-gray-900 text-cps-blue focus:ring-cps-blue cursor-pointer flex-shrink-0"
                        />
                        <div className="flex-grow overflow-hidden">
                          <p className="text-sm font-medium text-gray-200 truncate">
                            {mapName}
                          </p>
                          <p className="text-xs text-gray-400 truncate">
                            Bookings: {mapBookingStats?.bookingCount ?? 0}
                          </p>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {assignedTitles.map((title, index) => (
                              <span
                                key={index}
                                title={title}
                                className={`text-[10px] px-1.5 py-0.5 rounded ${
                                  isUnassigned
                                    ? 'bg-gray-600 text-gray-300'
                                    : 'bg-cps-blue/60 text-blue-200'
                                }`}
                              >
                                {title}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  // --- Main Render ---

  // Effect to load data for the active view
  useEffect(() => {
    if (activeView === 'bookings') {
      calculateAllBookingCounts();
    } else if (activeView === 'territory') {
      loadTerritoryData();
    }
  }, [activeView, calculateAllBookingCounts, loadTerritoryData]);

  // Effect to load territory data when region tab changes
  useEffect(() => {
    if (activeView === 'territory') {
      loadTerritoryData();
    }
  }, [activeRegionTab, activeView, loadTerritoryData]);

  return (
    <div className="animate-fade-in">
      <div className="flex justify-between items-center mb-5">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <Package size={24} /> Bookings & Territory
        </h2>
      </div>

      {/* View Tabs */}
      <div className="flex border-b border-gray-700 mb-6">
        <button
          onClick={() => setActiveView('bookings')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors duration-150 focus:outline-none ${
            activeView === 'bookings'
              ? 'border-cps-blue text-white'
              : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-500'
          }`}
        >
          Booking Management
        </button>
        <button
          onClick={() => setActiveView('territory')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors duration-150 focus:outline-none ${
            activeView === 'territory'
              ? 'border-cps-blue text-white'
              : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-500'
          }`}
        >
          Territory Assignment
        </button>
        <div className="flex-grow border-b-2 border-gray-700"></div>
      </div>

      {/* Messages */}
      {error && (
        <div className="mb-4 p-3 bg-red-900/30 text-red-300 border border-red-700 rounded-md text-sm flex items-center justify-between shadow-lg">
          <span className="flex items-center gap-2">
            <AlertCircle size={16} /> {error}
          </span>
          <button
            onClick={clearMessages}
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
            onClick={clearMessages}
            className="p-1 rounded-full hover:bg-green-800/50"
          >
            <X size={18} />
          </button>
        </div>
      )}

      {/* Render Active View */}
      {activeView === 'bookings'
        ? renderBookingManagement()
        : renderTerritoryManagement()}
    </div>
  );
};

export default AdminBookingsAndTerritory;