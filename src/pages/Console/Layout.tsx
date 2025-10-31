// src/pages/Console/Layout.tsx
import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Search,
  MapPin,
  ListFilter,
  CheckCircle2,
  XCircle,
  Clock,
  Calendar,
  ChevronRight,
  PhoneOff,
  UserX,
  Download,
  Database,
} from 'lucide-react';
import { getStorageItem, STORAGE_KEYS } from '../../lib/localStorage';
import { ConsoleProfile, ConfiguredSeason, Worker } from '../../types';
import { getRegionById } from '../../lib/hardcodedData';

const Layout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [adminProfile, setAdminProfile] = useState<ConsoleProfile | null>(null);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Worker[]>([]);
  const [activeConfiguredSeason, setActiveConfiguredSeason] =
    useState<ConfiguredSeason | null>(null);

  useEffect(() => {
    const loadData = () => {
      const adminTitle = getStorageItem(STORAGE_KEYS.ADMIN, '');
      const allProfiles: ConsoleProfile[] = getStorageItem(
        STORAGE_KEYS.CONSOLE_PROFILES,
        []
      );
      const currentProfile = allProfiles.find(
        (p: ConsoleProfile) => p.title === adminTitle
      );
      setAdminProfile(currentProfile || null);
      const activeSeasonHardcodedId = getStorageItem<string | null>(
        STORAGE_KEYS.ACTIVE_SEASON_ID,
        null
      );
      if (currentProfile && currentProfile.seasons) {
        const configuredSeason = currentProfile.seasons.find(
          (cs) => cs.hardcodedId === activeSeasonHardcodedId && cs.enabled
        );
        setActiveConfiguredSeason(configuredSeason || null);
        const regionData = getRegionById(currentProfile.region);
        const hcSeasonData = regionData?.seasons.find(
          (hs) => hs.id === activeSeasonHardcodedId
        );
        // Pre-Season redirection logic
        if (
          hcSeasonData?.type === 'Service' ||
          hcSeasonData?.name === 'Pre Season'
        ) {
          if (
            location.pathname === '/console/workerbook' ||
            location.pathname === '/console/workerbook/next-day'
          ) {
            navigate('/console/workerbook/calendar', { replace: true });
          }
        }
      } else {
        setActiveConfiguredSeason(null);
      }
      setWorkers(getStorageItem(STORAGE_KEYS.CONSOLE_WORKERS, []));
    };
    loadData();
    const handleStorage = () => loadData();
    window.addEventListener('storage', handleStorage);
    window.addEventListener('storageUpdated', handleStorage);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('storageUpdated', handleStorage);
    };
  }, [location.pathname, navigate]);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    if (query.trim() === '') {
      setSearchResults([]);
      return;
    }
    const lowercasedQuery = query.toLowerCase();
    const filtered = workers.filter(
      (worker) =>
        worker.firstName.toLowerCase().includes(lowercasedQuery) ||
        worker.lastName.toLowerCase().includes(lowercasedQuery) ||
        (worker.cellPhone &&
          worker.cellPhone
            .replace(/\D/g, '')
            .includes(lowercasedQuery.replace(/\D/g, ''))) ||
        worker.contractorId.toLowerCase().includes(lowercasedQuery)
    );
    const sorted = filtered.sort((a, b) => {
      const nameA = `${a.firstName} ${a.lastName}`.toLowerCase();
      const nameB = `${b.firstName} ${b.lastName}`.toLowerCase();
      const idA = a.contractorId.toLowerCase();
      const idB = b.contractorId.toLowerCase();
      if (
        nameA.startsWith(lowercasedQuery) &&
        !nameB.startsWith(lowercasedQuery)
      )
        return -1;
      if (
        !nameA.startsWith(lowercasedQuery) &&
        nameB.startsWith(lowercasedQuery)
      )
        return 1;
      if (idA.startsWith(lowercasedQuery) && !idB.startsWith(lowercasedQuery))
        return -1;
      if (!idA.startsWith(lowercasedQuery) && idB.startsWith(lowercasedQuery))
        return 1;
      if (nameA.includes(lowercasedQuery) && !nameB.includes(lowercasedQuery))
        return -1;
      if (!nameA.includes(lowercasedQuery) && nameB.includes(lowercasedQuery))
        return 1;
      return nameA.localeCompare(nameB);
    });
    setSearchResults(sorted.slice(0, 10));
  };

  const handleWorkerSelect = (workerId: string) => {
    navigate(`/console/workerbook/contdetail/${workerId}`);
    setSearchQuery('');
    setSearchResults([]);
  };

  const isActive = (path: string) => {
    if (path === '/console/workerbook') return location.pathname === path;
    // Special check for bookings to highlight the parent when viewing details or specific seasons
    if (
      path === '/console/bookings/prebooks' &&
      location.pathname.startsWith('/console/bookings/prebooks')
    )
      return true;
    return location.pathname.startsWith(path);
  };

  const isWorkerbook = location.pathname.startsWith('/console/workerbook');
  const isBookings = location.pathname.startsWith('/console/bookings');
  const regionData = getRegionById(adminProfile?.region);
  const activeHcSeasonData = regionData?.seasons.find(
    (hs) => hs.id === activeConfiguredSeason?.hardcodedId
  );
  const isPreSeasonOrService =
    activeHcSeasonData?.type === 'Service' ||
    activeHcSeasonData?.name === 'Pre Season';

  return (
    <div className="min-h-screen bg-black flex">
      {/* Static Sidebar */}
      <div className="w-32 bg-black fixed top-16 bottom-0 left-0 z-20 border-r border-gray-800">
        <div className="h-full flex flex-col">
          <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
            <nav className="p-2 space-y-1">
              {
                isWorkerbook /* Workerbook Sidebar */ ? (
                  <>
                    {!isPreSeasonOrService && (
                      <>
                        <button
                          onClick={() => navigate('/console/workerbook')}
                          className={`w-full flex flex-col items-center justify-center gap-1 px-1 py-2 text-gray-300 hover:bg-gray-800 rounded-md transition-colors ${
                            isActive('/console/workerbook')
                              ? 'bg-gray-800 text-white font-medium'
                              : ''
                          }`}
                          title="Booked Today"
                        >
                          <Clock size={16} />
                          <span className="text-[11px] leading-tight text-center">
                            Today
                          </span>
                        </button>
                        <button
                          onClick={() =>
                            navigate('/console/workerbook/next-day')
                          }
                          className={`w-full flex flex-col items-center justify-center gap-1 px-1 py-2 text-gray-300 hover:bg-gray-800 rounded-md transition-colors ${
                            isActive('/console/workerbook/next-day')
                              ? 'bg-gray-800 text-white font-medium'
                              : ''
                          }`}
                          title="Next Day Bookings"
                        >
                          <ChevronRight size={16} />
                          <span className="text-[11px] leading-tight text-center">
                            Next Day
                          </span>
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => navigate('/console/workerbook/calendar')}
                      className={`w-full flex flex-col items-center justify-center gap-1 px-1 py-2 text-gray-300 hover:bg-gray-800 rounded-md transition-colors ${
                        isActive('/console/workerbook/calendar') ||
                        isActive('/console/workerbook/day/')
                          ? 'bg-gray-800 text-white font-medium'
                          : ''
                      }`}
                      title="Booking Calendar"
                    >
                      <Calendar size={16} />
                      <span className="text-[11px] leading-tight text-center">
                        Calendar
                      </span>
                    </button>
                    {!isPreSeasonOrService && ( // Also hide No Shows in Pre Season/Service
                      <button
                        onClick={() => navigate('/console/workerbook/no-shows')}
                        className={`w-full flex flex-col items-center justify-center gap-1 px-1 py-2 text-gray-300 hover:bg-gray-800 rounded-md transition-colors ${
                          isActive('/console/workerbook/no-shows')
                            ? 'bg-gray-800 text-white font-medium'
                            : ''
                        }`}
                        title="No Shows"
                      >
                        <XCircle size={16} />
                        <span className="text-[11px] leading-tight text-center">
                          No Shows
                        </span>
                      </button>
                    )}
                    <button
                      onClick={() => navigate('/console/workerbook/wdr-tnb')}
                      className={`w-full flex flex-col items-center justify-center gap-1 px-1 py-2 text-gray-300 hover:bg-gray-800 rounded-md transition-colors ${
                        isActive('/console/workerbook/wdr-tnb')
                          ? 'bg-gray-800 text-white font-medium'
                          : ''
                      }`}
                      title="Will Call / TNB"
                    >
                      <PhoneOff size={16} />
                      <span className="text-[11px] leading-tight text-center">
                        WDR/TNB
                      </span>
                    </button>
                    <button
                      onClick={() => navigate('/console/workerbook/quit-fired')}
                      className={`w-full flex flex-col items-center justify-center gap-1 px-1 py-2 text-gray-300 hover:bg-gray-800 rounded-md transition-colors ${
                        isActive('/console/workerbook/quit-fired')
                          ? 'bg-gray-800 text-white font-medium'
                          : ''
                      }`}
                      title="Quit / Fired Workers"
                    >
                      <UserX size={16} />
                      <span className="text-[11px] leading-tight text-center">
                        Quit/Fired
                      </span>
                    </button>
                    <button
                      onClick={() => navigate('/console/workerbook/not-booked')}
                      className={`w-full flex flex-col items-center justify-center gap-1 px-1 py-2 text-gray-300 hover:bg-gray-800 rounded-md transition-colors ${
                        isActive('/console/workerbook/not-booked') ||
                        isActive('/console/workerbook/move-workers')
                          ? 'bg-gray-800 text-white font-medium'
                          : ''
                      }`}
                      title="Import / Manage Unbooked"
                    >
                      <Download size={16} />
                      <span className="text-[11px] leading-tight text-center">
                        Import
                      </span>
                    </button>
                  </>
                ) : isBookings /* Bookings Sidebar */ ? (
                  <>
                    {/* Season Links */}
                    {adminProfile?.seasons?.map((configuredSeason) => {
                      const region = getRegionById(adminProfile.region);
                      const hcSeason = region?.seasons.find(
                        (s) => s.id === configuredSeason.hardcodedId
                      );
                      if (
                        !hcSeason ||
                        !configuredSeason.enabled ||
                        (hcSeason.type === 'Service' &&
                          adminProfile.region !== 'West')
                      ) {
                        return null;
                      }
                      // Use includes for path matching because of potential query params
                      const seasonIsActive =
                        location.pathname.startsWith(
                          '/console/bookings/prebooks'
                        ) &&
                        location.search.includes(
                          `season=${configuredSeason.hardcodedId}`
                        );
                      return (
                        <button
                          key={configuredSeason.hardcodedId}
                          onClick={() =>
                            navigate(
                              `/console/bookings/prebooks?season=${configuredSeason.hardcodedId}`
                            )
                          } // Still navigate to prebooks (now MasterBookings)
                          className={`w-full flex flex-col items-center justify-center gap-1 px-1 py-2 text-gray-300 hover:bg-gray-800 rounded-md transition-colors ${
                            seasonIsActive
                              ? 'bg-gray-800 text-white font-medium'
                              : ''
                          }`}
                          title={`${hcSeason.name} Bookings`}
                        >
                          <Database size={16} />
                          <span className="text-[11px] leading-tight text-center">
                            {hcSeason.name}
                          </span>
                        </button>
                      );
                    })}
                    {/* Completed Button */}
                    <button
                      onClick={() => navigate('/console/bookings/completed')}
                      className={`w-full flex flex-col items-center justify-center gap-1 px-1 py-2 text-gray-300 hover:bg-gray-800 rounded-md transition-colors ${
                        isActive('/console/bookings/completed')
                          ? 'bg-gray-800 text-white font-medium'
                          : ''
                      }`}
                      title="Completed Jobs Log"
                    >
                      <CheckCircle2 size={16} />
                      <span className="text-[11px] leading-tight text-center">
                        Completed
                      </span>
                    </button>
                  </>
                ) : null /* Settings Sidebar etc. */
              }
            </nav>
          </div>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 ml-32">
        {/* Header */}
        <header className="bg-black h-16 fixed top-0 left-0 right-0 z-30 border-b border-gray-800">
          <div className="flex items-center justify-between max-w-[1920px] mx-auto px-4 h-full">
            {/* Left side */}
            <div className="flex items-center gap-6">
              <button
                onClick={() => navigate('/')}
                className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                title="Go to Home Page"
              >
                <img src="/logo.svg" alt="CPS Logo" className="w-9 h-9" />
              </button>
              {/* Section Toggles */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => navigate('/console/workerbook')}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    isWorkerbook
                      ? 'bg-[#1a2832] text-white'
                      : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                  }`}
                >
                  {' '}
                  Workerbook{' '}
                </button>
                <button
                  onClick={() => navigate('/console/bookings/prebooks')} // <<< Ensure this navigates correctly
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    isBookings
                      ? 'bg-[#1a2832] text-white'
                      : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                  }`}
                >
                  {' '}
                  Bookings{' '}
                </button>
                <button
                  onClick={() => navigate('/console/settings/payout-logic')}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    location.pathname.startsWith('/console/settings')
                      ? 'bg-[#1a2832] text-white'
                      : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                  }`}
                >
                  {' '}
                  Settings{' '}
                </button>
              </div>
            </div>
            {/* Right side */}
            <div className="flex items-center gap-4">
              {/* Worker Search */}
              {isWorkerbook && (
                <div className="relative w-full max-w-xs">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    {' '}
                    <Search className="h-4 w-4 text-gray-400" />{' '}
                  </div>
                  <input
                    type="text"
                    placeholder="Search workers..."
                    value={searchQuery}
                    onChange={handleSearch}
                    className="w-full text-sm py-1.5 pl-9 pr-4 bg-gray-800 border border-gray-700 rounded-full text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-cps-blue"
                  />
                  {searchResults.length > 0 && (
                    <div className="absolute top-full mt-1 w-full bg-gray-800 border border-gray-700 rounded-md shadow-lg z-40 max-h-60 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600">
                      {searchResults.map((worker) => (
                        <button
                          key={worker.contractorId}
                          onClick={() =>
                            handleWorkerSelect(worker.contractorId)
                          }
                          className="w-full text-left px-3 py-2 hover:bg-gray-700 transition-colors"
                        >
                          {' '}
                          <div className="flex justify-between items-center">
                            {' '}
                            <span className="text-sm text-gray-200">
                              {worker.firstName} {worker.lastName}
                            </span>{' '}
                            <span className="text-xs text-gray-500">
                              #{worker.contractorId}
                            </span>{' '}
                          </div>{' '}
                          {worker.cellPhone && (
                            <p className="text-xs text-gray-400">
                              {worker.cellPhone}
                            </p>
                          )}{' '}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {/* Admin Profile Display/Logout */}
              <button
                onClick={() => navigate('/console/login')}
                className="text-right hover:opacity-80 transition-opacity"
                title="Admin Profile / Logout"
              >
                <p className="text-sm font-medium text-white leading-tight">
                  {adminProfile?.title || 'Admin'}
                </p>
                <p className="text-xs text-gray-400 leading-tight">
                  {activeHcSeasonData?.name || 'No Active Season'}
                </p>
              </button>
            </div>
          </div>
        </header>

        {/* Main Content Outlet */}
        <main className="pt-16 bg-[#1a2832] min-h-screen">
          <div className="p-4 md:p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;
