// src/pages/Management/ConsoleMapAssignments.tsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Loader,
  AlertCircle,
  Mail,
  Users,
  MapPin,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  getStorageItem,
  setStorageItem,
  STORAGE_KEYS,
} from '../../lib/localStorage';
import {
  MasterBooking,
  ConsoleProfile,
  ManagementUser,
  UserPermissions,
} from '../../types';
import * as bookingHelpers from '../../lib/bookingStoreHelpers';
import { getAssignableRouteManagers, RouteManager } from '../../lib/routeManagers';
import { ensureEastTerritoryStructureFetched } from '../../lib/dataSyncService';
import AssignRouteManager from '../../components/AssignRouteManager';
import EmailTemplate from '../../components/EmailTemplate';

// Interfaces
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

const ConsoleMapAssignments: React.FC = () => {
  const { consoleProfileId } = useParams<{ consoleProfileId: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [consoleProfile, setConsoleProfile] = useState<ConsoleProfile | null>(
    null
  );
  const [activeSeasonId, setActiveSeasonId] = useState<string | null>(null);

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
  const [assignableManagers, setAssignableManagers] = useState<RouteManager[]>(
    []
  );
  const [territoryAssignments, setTerritoryAssignments] = useState<
    Record<string, number[]>
  >({});

  const numConsoleId = parseInt(consoleProfileId || '0', 10);

  const processBookingsForMapStats = useCallback(
    (bookings: MasterBooking[]): GroupedTerritoryStats => {
      const mapStatsData: Record<string, TerritoryStats> = {};
      bookings.forEach((booking) => {
        const masterMap = booking['Master Map']?.trim();
        const routeNumber = booking['Route Number']?.trim();
        const group = booking['Group']?.trim();
        const price = parseFloat(booking['Price'] || '0') || 0;
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
      return groupedData;
    },
    []
  );

  const loadData = useCallback(async () => {
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

      const seasonId = getStorageItem(STORAGE_KEYS.ACTIVE_SEASON_ID, null);
      if (!seasonId) throw new Error('No active season set.');
      setActiveSeasonId(seasonId);

      const [structure, assignmentsFromStorage, currentMapAssignments] =
        await Promise.all([
          ensureEastTerritoryStructureFetched(),
          getStorageItem(STORAGE_KEYS.TERRITORY_ASSIGNMENTS, {}),
          getStorageItem(STORAGE_KEYS.MAP_ASSIGNMENTS, {}),
        ]);

      setFullTerritoryStructure(structure);
      setTerritoryAssignments(assignmentsFromStorage);
      setAssignments(currentMapAssignments);
      setAssignableManagers(getAssignableRouteManagers(numConsoleId));

      const bookings = bookingHelpers.getBookingsForConsoleSeason(
        numConsoleId,
        seasonId
      );
      const processedStats = processBookingsForMapStats(bookings);
      setTerritoryStats(processedStats);
    } catch (err) {
      console.error('Error loading map assignment data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [numConsoleId, processBookingsForMapStats]);

  useEffect(() => {
    loadData();
    const handleStorageUpdate = (event: any) => {
      const key = event?.detail?.key;
      if (
        key === STORAGE_KEYS.ACTIVE_SEASON_ID ||
        key === STORAGE_KEYS.TERRITORY_ASSIGNMENTS ||
        key === STORAGE_KEYS.EAST_TERRITORY_STRUCTURE ||
        key?.startsWith('bookings_')
      ) {
        loadData();
      } else if (key === STORAGE_KEYS.MAP_ASSIGNMENTS) {
        setAssignments(getStorageItem(STORAGE_KEYS.MAP_ASSIGNMENTS, {}));
      } else if (key === STORAGE_KEYS.MANAGEMENT_USERS) {
        setAssignableManagers(getAssignableRouteManagers(numConsoleId));
      }
    };
    window.addEventListener('storageUpdated', handleStorageUpdate);
    return () => {
      window.removeEventListener('storageUpdated', handleStorageUpdate);
    };
  }, [loadData, numConsoleId]);

  // --- Map Assignment Handlers ---
  const handleMapSelect = (mapName: string) => {
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
        if (isUnassign) {
          delete newAssignments[routeCode];
        } else {
          newAssignments[routeCode] = { manager, date: assignmentDate };
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
    setExpandedMap((prev) => (prev === mapName ? null : mapName));
  };

  // --- Main Render Logic ---
  if (loading) {
    return (
      <div className="flex justify-center items-center h-[calc(100vh-14rem)]">
        <Loader className="animate-spin text-cps-blue" size={32} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-cps-light-red text-white p-4 rounded-lg">
        <div className="flex items-center gap-2">
          <AlertCircle size={20} />
          <p>{error}</p>
        </div>
      </div>
    );
  }

  const assignedMapNames = new Set<string>();
  for (const map in territoryAssignments) {
    if (territoryAssignments[map]?.includes(numConsoleId)) {
      assignedMapNames.add(map);
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
        <MapPin size={48} className="text-gray-600" />
        <p className="text-gray-400">
          No territories assigned to this console profile.
        </p>
        <p className="text-sm text-gray-500">
          Go to Admin Panel {'>'} Bookings & Territory to assign territories.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in pb-16 h-[calc(1View - 14rem)] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800 pr-2">
      <div className="sticky top-0 z-10 py-2 bg-gray-900 -mx-4 px-4 border-b border-gray-700">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-white">Map Assignments</h2>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowEmailTemplate(true)}
              disabled={selectedMaps.size === 0 && selectedRoutes.size === 0}
              className="px-3 py-1.5 bg-gray-600 text-white rounded-md hover:bg-gray-500 transition-colors flex items-center gap-1.5 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              title="Send Service Notification Email"
            >
              <Mail size={14} /> <span>Notifications</span>
            </button>
            <button
              onClick={() => setShowAssignManager(true)}
              disabled={selectedMaps.size === 0 && selectedRoutes.size === 0}
              className="px-3 py-1.5 bg-cps-blue text-white rounded-md hover:bg-blue-700 transition-colors flex items-center gap-1.5 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              title="Assign selected maps/routes to a Route Manager"
            >
              <Users size={14} /> <span>Assign</span>
            </button>
          </div>
        </div>
      </div>
      {sortedRelevantGroups.map((groupName) => (
        <div key={groupName} className="space-y-1">
          <h3 className="text-sm font-medium text-gray-400 border-b border-gray-700 pb-1 px-1 sticky top-[65px] bg-gray-900 z-[9]">
            {groupName} ({Object.keys(relevantStructure[groupName] || {}).length}{' '}
            Maps)
          </h3>
          <div className="grid grid-cols-1 gap-1 pt-1">
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
                    <div className="flex items-center gap-2 bg-gray-700/60 rounded-md py-1.5 px-3 border border-gray-600/50">
                      <input
                        type="checkbox"
                        checked={isMapSelected}
                        onChange={() => handleMapSelect(mapName)}
                        className="h-4 w-4 rounded border-gray-600 bg-gray-900 text-cps-blue focus:ring-cps-blue cursor-pointer flex-shrink-0"
                        title={`Select map ${mapName} and all its ${mapRouteCount} routes`}
                      />
                      <button
                        onClick={() => toggleMap(mapName)}
                        className="flex-1 flex items-center justify-between text-left min-w-0"
                      >
                        <div className="flex items-center gap-2 flex-shrink-0 pr-2">
                          <h4
                            className="text-sm font-medium text-white truncate"
                            title={mapName}
                          >
                            {mapName}
                          </h4>
                          {mapAssignment && (
                            <div
                              className="w-5 h-5 rounded-full bg-cps-blue flex items-center justify-center text-xs font-medium text-white flex-shrink-0"
                              title={`Assigned to ${mapAssignment.manager.name} on ${mapAssignment.date}`}
                            >
                              {mapAssignment.manager.initials}
                            </div>
                          )}
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
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-gray-400 flex-shrink-0 ml-auto">
                          <span
                            className="w-10 text-right"
                            title="Total Routes"
                          >
                            Rts:{' '}
                            <span className="font-medium text-gray-200">
                              {mapRouteCount}
                            </span>
                          </span>
                          <span
                            className="w-12 text-right"
                            title="Assigned Bookings"
                          >
                            PBs:{' '}
                            <span className="font-medium text-cps-blue">
                              {mapBookingCount}
                            </span>
                          </span>
                          <span
                            className="w-12 text-right"
                            title="Assigned Routes w/ Bookings"
                          >
                            Over:{' '}
                            <span className="font-medium text-cps-green">
                              {mapRoutesWithBookings}
                            </span>
                          </span>
                          <span
                            className="w-12 text-right"
                            title="Assigned Value"
                          >
                            $$:{' '}
                            <span className="font-medium text-cps-yellow">
                              ${mapTotalValue.toFixed(0)}
                            </span>
                          </span>
                        </div>
                      </button>
                    </div>
                    {isMapExpanded && (
                      <div className="mt-1 pl-10 pr-1 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-1">
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
                              <input
                                type="checkbox"
                                checked={isRouteSelected}
                                onChange={() =>
                                  handleRouteSelect(routeCode, mapName)
                                }
                                className="h-4 w-4 rounded border-gray-600 bg-gray-900 text-cps-blue focus:ring-cps-blue cursor-pointer mr-2 flex-shrink-0"
                              />
                              <div className="flex-1 flex items-center justify-center gap-1 text-xs font-medium text-gray-200">
                                {routeCode}
                                {showRouteSpecificAssignment && (
                                  <div
                                    className="w-4 h-4 rounded-full bg-cps-blue/70 flex items-center justify-center text-[9px] font-medium text-white"
                                    title={`Assigned to ${routeAssignment.manager.name} on ${routeAssignment.date}`}
                                  >
                                    {routeAssignment.manager.initials}
                                  </div>
                                )}
                              </div>
                              {hasBookings && (
                                <div className="flex flex-col items-end text-[10px] ml-2 flex-shrink-0 leading-tight">
                                  <span className="font-medium text-cps-blue">
                                    {routeBookingCount} PBs
                                  </span>
                                  <span className="text-gray-400">
                                    ${routeValue.toFixed(0)}
                                  </span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      ))}
      <EmailTemplate
        isOpen={showEmailTemplate}
        onClose={() => setShowEmailTemplate(false)}
        selectedMaps={selectedMaps}
        selectedRoutes={selectedRoutes}
      />
      <AssignRouteManager
        isOpen={showAssignManager}
        onClose={() => setShowAssignManager(false)}
        onAssign={handleAssignManager}
        selectedMaps={selectedMaps}
        selectedRoutes={selectedRoutes}
        // Pass the correct list of managers for this console
        assignableManagers={assignableManagers}
      />
    </div>
  );
};

export default ConsoleMapAssignments;