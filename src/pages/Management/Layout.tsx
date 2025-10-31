// src/pages/Management/Layout.tsx
import React, { useState, useEffect } from 'react';
import {
  Outlet,
  useNavigate,
  useLocation,
  NavLink,
} from 'react-router-dom';
import {
  Shield,
  LayoutGrid,
  Users,
  MapPin,
  BookOpen,
  ClipboardList,
  Database,
  User,
  Settings,
  LogOut,
  ChevronDown,
  Building,
  UserCheck,
  Package,
  RotateCcw,
} from 'lucide-react';
import {
  getStorageItem,
  removeStorageItem,
  STORAGE_KEYS,
} from '../../lib/localStorage';
import {
  ManagementUser,
  UserPermissions,
  ConsoleProfile,
  ConsolePermissionLink,
} from '../../types';

// This is a sub-component to keep the layout code cleaner.
// It builds the navigation group for a single Console Profile.
const ConsoleNavGroup: React.FC<{
  consoleProfile: ConsoleProfile;
  permissions: ConsolePermissionLink;
  isActive: (path: string) => boolean;
}> = ({ consoleProfile, permissions, isActive }) => {
  const [isOpen, setIsOpen] = useState(true); // Default to open
  const location = useLocation();

  // Check if any child route of this console is active
  const isConsoleActive = [
    permissions.canAccessRM_Logbook &&
      isActive(`/console/rm-logbook/${consoleProfile.id}`),
    permissions.canAccessWorkerBook &&
      isActive(`/console/workerbook/${consoleProfile.id}`),
    permissions.canAccessMasterBookings &&
      isActive(`/console/master-bookings/${consoleProfile.id}`),
    permissions.canAccessMapAssignments &&
      isActive(`/console/map-assignments/${consoleProfile.id}`),
  ].some(Boolean);

  useEffect(() => {
    // Automatically open the dropdown if a child route is active
    if (isConsoleActive) {
      setIsOpen(true);
    }
  }, [location, isConsoleActive]);

  const navLinkClass = (path: string) =>
    `w-full flex items-center gap-3 px-3 py-2 rounded-md text-left text-sm transition-colors ${
      isActive(path)
        ? 'bg-gray-700 text-white'
        : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
    }`;

  return (
    <div className="space-y-1">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between gap-3 px-3 py-2 rounded-md text-left transition-colors ${
          isConsoleActive
            ? 'bg-gray-800 text-cps-blue'
            : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
        }`}
      >
        <div className="flex items-center gap-3">
          <Building size={18} />
          <span className="font-medium">{consoleProfile.title}</span>
        </div>
        <ChevronDown
          size={16}
          className={`transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>
      {isOpen && (
        <div className="pl-6 space-y-1">
          {permissions.canAccessRM_Logbook && (
            <NavLink
              to={`rm-logbook/${consoleProfile.id}`}
              className={navLinkClass(`rm-logbook/${consoleProfile.id}`)}
            >
              <BookOpen size={16} />
              <span>RM Logbook</span>
            </NavLink>
          )}
          {permissions.canAccessWorkerBook && (
            <NavLink
              to={`workerbook/${consoleProfile.id}`}
              className={navLinkClass(`workerbook/${consoleProfile.id}`)}
            >
              <Users size={16} />
              <span>Worker-Book</span>
            </NavLink>
          )}
          {permissions.canAccessMasterBookings && (
            <NavLink
              to={`master-bookings/${consoleProfile.id}`}
              className={navLinkClass(`master-bookings/${consoleProfile.id}`)}
            >
              <Database size={16} />
              <span>Master-Bookings</span>
            </NavLink>
          )}
          {permissions.canAccessMapAssignments && (
            <NavLink
              to={`map-assignments/${consoleProfile.id}`}
              className={navLinkClass(`map-assignments/${consoleProfile.id}`)}
            >
              <MapPin size={16} />
              <span>Map Assignments</span>
            </NavLink>
          )}
        </div>
      )}
    </div>
  );
};

// The Main Layout Component
const ManagementLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [activeUser, setActiveUser] = useState<ManagementUser | null>(null);
  const [userPermissions, setUserPermissions] =
    useState<UserPermissions | null>(null);
  const [userConsoleProfiles, setUserConsoleProfiles] = useState<
    ConsoleProfile[]
  >([]);

  useEffect(() => {
    // Load all necessary data on mount
    const user = getStorageItem<ManagementUser | null>(
      STORAGE_KEYS.ACTIVE_MANAGEMENT_USER,
      null
    );
    if (!user) {
      handleLogout();
      return;
    }
    setActiveUser(user);

    const allPermissions = getStorageItem<UserPermissions[]>(
      STORAGE_KEYS.USER_PERMISSIONS,
      []
    );
    const perms = allPermissions.find((p) => p.userId === user.userId);
    setUserPermissions(perms || null);

    const allConsoleProfiles = getStorageItem<ConsoleProfile[]>(
      STORAGE_KEYS.CONSOLE_PROFILES,
      []
    );
    
    if (perms) {
      const profileIds = new Set(
        perms.consoleProfileLinks.map((link) => link.consoleProfileId)
      );
      setUserConsoleProfiles(
        allConsoleProfiles.filter((p) => profileIds.has(p.id))
      );
    }
  }, []);

  const handleLogout = () => {
    removeStorageItem(STORAGE_KEYS.ACTIVE_MANAGEMENT_USER);
    navigate('/');
  };

  const isActive = (path: string) => location.pathname.endsWith(path);

  const navLinkClass = (path: string) =>
    `w-full flex items-center gap-3 px-3 py-2 rounded-md text-left transition-colors ${
      isActive(path)
        ? 'bg-gray-700 text-white'
        : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
    }`;

  if (!activeUser || !userPermissions) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <p className="text-white">Loading user data...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex">
      {/* Sidebar */}
      <div className="w-64 bg-gray-900 border-r border-gray-800 p-4 flex flex-col fixed h-full">
        <div
          onClick={() => navigate('/console/dashboard')}
          className="flex items-center gap-3 mb-8 text-left w-full hover:opacity-80 transition-opacity cursor-pointer"
          title="Go to Dashboard"
        >
          <Shield className="w-8 h-8 text-cps-blue flex-shrink-0" />
          <h1 className="text-xl font-bold text-white">Management</h1>
        </div>
        <nav className="space-y-1 flex-1 overflow-y-auto">
          {/* Dashboard */}
          <NavLink to="dashboard" className={navLinkClass('dashboard')}>
            <LayoutGrid size={18} />
            <span>Dashboard</span>
          </NavLink>

          {/* Dynamically Added Console Groups */}
          {userConsoleProfiles.map((profile) => {
            const consolePerms = userPermissions.consoleProfileLinks.find(
              (link) => link.consoleProfileId === profile.id
            );
            if (!consolePerms) return null;
            return (
              <ConsoleNavGroup
                key={profile.id}
                consoleProfile={profile}
                permissions={consolePerms}
                isActive={isActive}
              />
            );
          })}

          {/* Admin Panel (Conditional) */}
          {userPermissions.canAccessAdminPanel && (
            <div className="space-y-1 pt-2">
              <h3 className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Admin Panel
              </h3>
              {userPermissions.admin.canManageConsoles && (
                <NavLink to="admin/consoles" className={navLinkClass('admin/consoles')}>
                  <Building size={18} />
                  <span>Console Management</span>
                </NavLink>
              )}
              {userPermissions.admin.canManageUsers && (
                <NavLink to="admin/users" className={navLinkClass('admin/users')}>
                  <UserCheck size={18} />
                  <span>User Management</span>
                </NavLink>
              )}
              {userPermissions.admin.canManageTerritoryAndBookings && (
                <NavLink to="admin/territory" className={navLinkClass('admin/territory')}>
                  <Package size={18} />
                  <span>Bookings & Territory</span>
                </NavLink>
              )}
              {userPermissions.admin.canResetApp && (
                <NavLink to="admin/reset" className={navLinkClass('admin/reset')}>
                  <RotateCcw size={18} />
                  <span>Reset App</span>
                </NavLink>
              )}
            </div>
          )}
        </nav>
        {/* User Menu / Logout */}
        <div className="mt-auto pt-4 border-t border-gray-700 space-y-2">
          <NavLink
            to="settings"
            className="w-full flex items-center gap-3 px-3 py-2 text-gray-400 hover:bg-gray-800 hover:text-gray-200 rounded-md text-left transition-colors"
            title="User Settings"
          >
            <Settings size={18} />
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-medium text-white truncate">
                {activeUser.name}
              </p>
              <p className="text-xs text-gray-400 truncate">
                {activeUser.title}
              </p>
            </div>
          </NavLink>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 text-gray-400 hover:bg-red-800/30 hover:text-red-300 rounded-md text-left transition-colors"
            title="Logout"
          >
            <LogOut size={18} />
            <span className="text-sm">Logout</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 ml-64 p-6 overflow-y-auto bg-gray-900">
        <Outlet />
      </main>
    </div>
  );
};

export default ManagementLayout;