// src/pages/BusinessPanel/TerritoryManagement.tsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  MapPin,
  Users,
  AlertCircle,
  CheckCircle,
  X,
  ChevronDown,
  ChevronUp,
  Loader,
} from 'lucide-react';
import {
  getStorageItem,
  setStorageItem,
  STORAGE_KEYS,
} from '../../lib/localStorage';
import { MasterBooking, ConsoleProfile } from '../../types';
import { REGIONS, HardcodedSeason } from '../../lib/hardcodedData'; // Import REGIONS
import { ensureEastTerritoryStructureFetched } from '../../lib/dataSyncService'; // <<< IMPORTED dataSyncService

interface TerritoryData {
  group: string;
  map: string;
  bookingCount: number;
  assignedProfileIds: number[]; // Store IDs of profiles assigned to this map
}

interface GroupedTerritoryData {
  [groupName: string]: TerritoryData[];
}

// Interface for the full territory structure from Google Sheet
interface FullTerritoryStructure {
  [group: string]: {
    [map: string]: string[]; // Array of all route codes
  };
}

type RegionTab = 'East' | 'Central' | 'West';

// Function to get all bookings from all relevant storage keys
const getAllBookingsFromStorage = (): MasterBooking[] => {
  let allBookings: MasterBooking[] = [];
  REGIONS.forEach((region) => {
    region.seasons.forEach((season: HardcodedSeason) => {
      // Use the storageKey from the season config
      const storageKeyName = season.storageKey;
      // Check if the key name exists in STORAGE_KEYS enum/object
      if (storageKeyName && storageKeyName in STORAGE_KEYS) {
        // Retrieve the actual storage key string (e.g., 'bookings_west_aeration')
        const key = STORAGE_KEYS[storageKeyName as keyof typeof STORAGE_KEYS];
        const bookings = getStorageItem<MasterBooking[]>(key, []);
        allBookings = allBookings.concat(bookings);
      } else {
        // Log if a season has a storageKey defined but it's not in STORAGE_KEYS
        // This helps catch configuration errors.
        if (storageKeyName) {
          console.warn(
            `Storage key name "${storageKeyName}" for season "${season.id}" not found in STORAGE_KEYS.`
          );
        }
      }
    });
  });
  return allBookings;
};

const TerritoryManagement: React.FC = () => {
  const [activeRegionTab, setActiveRegionTab] = useState<RegionTab>('East');
  const [territoryData, setTerritoryData] = useState<GroupedTerritoryData>({});
  // This state holds the structure for the active tab (currently only East)
  const [activeTerritoryStructure, setActiveTerritoryStructure] =
    useState<FullTerritoryStructure>({});
  const [consoleProfiles, setConsoleProfiles] = useState<ConsoleProfile[]>([]);
  const [loading, setLoading] = useState(true); // Combined loading state
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());
  const [selectedMaps, setSelectedMaps] = useState<Set<string>>(new Set());
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [territoryAssignments, setTerritoryAssignments] = useState<
    Record<string, number[]>
  >(() => getStorageItem(STORAGE_KEYS.TERRITORY_ASSIGNMENTS, {}));
  // Removed territoryLoading, using combined 'loading' state now

  // Load initial data
  const loadData = useCallback(async () => {
    // <<< Made async
    setLoading(true); // Use combined loading state
    setError(null);
    let structure: FullTerritoryStructure = {};
    let relevantBookings: MasterBooking[] = [];

    try {
      // Load Profiles & Assignments (always needed)
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

      // Branch logic based on tab
      if (activeRegionTab === 'East') {
        // <<< REFACTOR: Use service >>>
        structure = await ensureEastTerritoryStructureFetched(); // Fetch/cache via service
        setActiveTerritoryStructure(structure);

        // Load all bookings to calculate stats for East maps
        const allBookings = getAllBookingsFromStorage();
        // Filter bookings relevant to the *fetched structure*
        relevantBookings = allBookings.filter(
          (booking) =>
            booking['Group'] &&
            structure[booking['Group']] &&
            structure[booking['Group']][booking['Master Map']]
        );
      } else {
        // For Central/West, set empty structure for now
        setActiveTerritoryStructure({});
        relevantBookings = [];
        console.log(
          `Territory management for ${activeRegionTab} not yet implemented.`
        );
      }

      // --- Process Bookings for the active region's structure ---
      const territoriesMap: Record<string, TerritoryData> = {};

      // 1. Initialize maps from the region's structure
      for (const group in structure) {
        for (const map in structure[group]) {
          const key = `${group}|${map}`;
          territoriesMap[key] = {
            group,
            map,
            bookingCount: 0, // Default to 0
            assignedProfileIds: assignments[map] || [], // Get assignments based on map name
          };
        }
      }

      // 2. Count bookings for those maps
      relevantBookings.forEach((booking) => {
        const group = booking['Group']?.trim();
        const map = booking['Master Map']?.trim();
        const key = group && map ? `${group}|${map}` : null;

        if (key && territoriesMap[key]) {
          territoriesMap[key].bookingCount++;
        }
      });

      // 3. Group for display
      const grouped: GroupedTerritoryData = {};
      Object.values(territoriesMap).forEach((td) => {
        if (!grouped[td.group]) {
          grouped[td.group] = [];
        }
        grouped[td.group].push(td);
      });

      // 4. Sort maps within each group
      for (const groupName in grouped) {
        grouped[groupName].sort((a, b) => a.map.localeCompare(b.map));
      }

      setTerritoryData(grouped);
    } catch (err) {
      console.error('Error loading territory data:', err);
      setError(
        err instanceof Error ? err.message : 'Failed to load territory data'
      );
      setTerritoryData({}); // Clear data on error
      setActiveTerritoryStructure({}); // Clear structure on error
    } finally {
      setLoading(false); // Combined loading state
    }
  }, [activeRegionTab]); // Reload data when activeRegionTab changes

  useEffect(() => {
    loadData(); // Load on mount and when tab changes

    const handleStorageUpdate = (event: any) => {
      const updatedKey = event?.detail?.key;
      // Reload if profiles, assignments, any booking DB, or the cached structure changes
      if (
        updatedKey === STORAGE_KEYS.CONSOLE_PROFILES ||
        updatedKey === STORAGE_KEYS.TERRITORY_ASSIGNMENTS ||
        updatedKey?.startsWith('bookings_') ||
        updatedKey === STORAGE_KEYS.EAST_TERRITORY_STRUCTURE
      ) {
        console.log(
          `Relevant storage key updated (${updatedKey}), reloading territory data.`
        );
        loadData(); // Reload relevant data
      }
    };
    window.addEventListener('storageUpdated', handleStorageUpdate);
    return () =>
      window.removeEventListener('storageUpdated', handleStorageUpdate);
  }, [loadData]); // Depend on loadData

  // Reset selections when tab changes
  useEffect(() => {
    setSelectedGroups(new Set());
    setSelectedMaps(new Set());
    setExpandedGroups(new Set());
    setError(null);
  }, [activeRegionTab]);

  // --- Selection Handlers ---
  const handleGroupSelect = (groupName: string, isSelected: boolean) => {
    if (activeRegionTab !== 'East') return; // Only allow selection on East tab

    const newSelectedGroups = new Set(selectedGroups);
    const newSelectedMaps = new Set(selectedMaps);
    // Use activeTerritoryStructure for accurate map list
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
    if (isSelected) {
      newSelectedMaps.add(mapName);
    } else {
      newSelectedMaps.delete(mapName);
    }
    setSelectedMaps(newSelectedMaps);

    // Update group check based on activeTerritoryStructure
    const mapsInGroup = Object.keys(activeTerritoryStructure[groupName] || {});
    const allMapsInGroupSelected = mapsInGroup.every((map) =>
      newSelectedMaps.has(map)
    );
    const newSelectedGroups = new Set(selectedGroups);
    if (allMapsInGroupSelected && mapsInGroup.length > 0) {
      newSelectedGroups.add(groupName);
    } else {
      newSelectedGroups.delete(groupName);
    }
    setSelectedGroups(newSelectedGroups);
  };

  // --- Assignment Modal ---
  const handleOpenAssignModal = () => {
    if (activeRegionTab !== 'East') return;
    if (selectedMaps.size === 0) {
      setError('Please select at least one Group or Master Map to assign.');
      return;
    }
    setError(null); // Clear error before opening
    setShowAssignModal(true);
  };

  const handleAssignToProfile = (profileId: number | null) => {
    setError(null);
    setSuccessMessage(null);
    const newAssignments = { ...territoryAssignments };
    let changed = false;
    let assignmentCount = 0;

    if (profileId === null) {
      // Unassign
      selectedMaps.forEach((map) => {
        if (newAssignments[map] && newAssignments[map].length > 0) {
          delete newAssignments[map]; // Remove the map key entirely
          changed = true;
          assignmentCount++;
        }
      });
      if (changed)
        setSuccessMessage(`Unassigned ${assignmentCount} selected map(s).`);
    } else {
      // Assign
      // Filter profiles to only those matching the *active region*
      const applicableProfiles = consoleProfiles.filter(
        (p) => p.region === activeRegionTab // Ensure profile matches the current tab
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
        if (!newAssignments[map]) {
          newAssignments[map] = [];
        }
        // Check if profile ID is already assigned before adding
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
      setSelectedGroups(new Set()); // Clear selections
      setSelectedMaps(new Set());
      // Update internal state directly to reflect changes immediately
      setTerritoryData((prevData) => {
        const updatedData = { ...prevData };
        Object.keys(updatedData).forEach((group) => {
          updatedData[group] = updatedData[group].map((mapInfo) => ({
            ...mapInfo,
            assignedProfileIds: newAssignments[mapInfo.map] || [], // Update assignments
          }));
        });
        return updatedData;
      });
      setTimeout(() => setSuccessMessage(null), 3000);
    }
    setShowAssignModal(false);
  };

  // Toggle group expansion
  const toggleGroupExpansion = (groupName: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupName)) {
        next.delete(groupName);
      } else {
        next.add(groupName);
      }
      return next;
    });
  };

  // Get profile titles for display
  const getProfileTitles = (profileIds: number[]): string[] => {
    if (!profileIds || profileIds.length === 0) return ['Unassigned'];
    return profileIds
      .map((id) => consoleProfiles.find((p) => p.id === id)?.title)
      .filter((title): title is string => !!title); // Filter out undefined if profile not found
  };

  // Sorted groups for rendering, based on territoryData which comes from bookings
  const sortedBookingGroups = useMemo(
    () => Object.keys(territoryData).sort(),
    [territoryData]
  );

  // --- Render Functions ---

  // Render content for the active tab
  const renderTabContent = () => {
    // Handle non-East tabs
    if (activeRegionTab !== 'East') {
      return (
        <div className="text-center text-gray-500 py-10 bg-gray-800 rounded-lg border border-gray-700/50">
          Territory data for {activeRegionTab} region is not yet available.
        </div>
      );
    }

    // Handle loading state
    if (loading) {
      // Use combined loading state
      return (
        <div className="flex justify-center items-center h-40">
          <Loader className="animate-spin text-cps-blue" size={32} />
        </div>
      );
    }

    // Handle empty structure for East after loading
    const eastGroupNames = Object.keys(activeTerritoryStructure);
    if (eastGroupNames.length === 0) {
      return (
        <p className="text-center text-gray-500 py-10">
          {error
            ? `Error: ${error}`
            : 'No East territory structure found. Check Google Sheet connection or cache.'}
        </p>
      );
    }

    // Sort groups alphabetically based on the structure
    const sortedStructureGroups = eastGroupNames.sort();

    return (
      <div className="space-y-4">
        {sortedStructureGroups.map((groupName) => (
          <div
            key={groupName}
            className="bg-gray-800 rounded-lg border border-gray-700/50 overflow-hidden"
          >
            {/* Group Header */}
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
            {/* Maps within Group (Conditional) */}
            {expandedGroups.has(groupName) && (
              <div className="p-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                {Object.keys(activeTerritoryStructure[groupName] || {})
                  .sort() // Sort maps alphabetically
                  .map((mapName) => {
                    // Find corresponding booking stats (might be undefined if no bookings)
                    const mapBookingStats = territoryData[groupName]?.find(
                      (t) => t.map === mapName
                    );
                    // Use assignments from state, defaulting to empty array
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

  return (
    <div className="animate-fade-in">
      <div className="flex justify-between items-center mb-5">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <MapPin size={24} /> Territory Assignment
        </h2>
        {activeRegionTab === 'East' && ( // Only show Assign button for East
          <button
            onClick={handleOpenAssignModal}
            disabled={selectedMaps.size === 0 || loading} // Use combined loading state
            className="px-4 py-2 bg-cps-blue text-white rounded-md hover:bg-blue-700 transition-colors flex items-center gap-1.5 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Users size={16} /> Assign Selected ({selectedMaps.size})
          </button>
        )}
      </div>

      {/* Region Tabs */}
      <div className="flex border-b border-gray-700 mb-6">
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

      {/* Messages */}
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

      {/* Render Active Tab Content */}
      {renderTabContent()}

      {/* Assign Modal - Only show relevant profiles based on activeRegionTab */}
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
                  .filter((p) => p.region === activeRegionTab) // Filter for profiles in the active region
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
              {/* Unassign Button */}
              <button
                onClick={() => handleAssignToProfile(null)} // Unassign
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
};

export default TerritoryManagement;
