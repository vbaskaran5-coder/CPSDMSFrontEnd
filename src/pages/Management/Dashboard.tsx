// src/pages/Management/Dashboard.tsx
import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
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
  STORAGE_KEYS,
} from '../../lib/localStorage';
import {
  ManagementUser,
  UserPermissions,
  ConsoleProfile,
} from '../../types';

const DashboardCard: React.FC<{
  to: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  color: string;
}> = ({ to, icon, title, description, color }) => (
  <NavLink
    to={to}
    className={`bg-gray-800 rounded-lg p-6 hover:bg-gray-700 transition-colors group border-l-4 ${color}`}
  >
    <div className="flex items-center gap-4 mb-3">
      {icon}
      <h3 className="text-xl font-semibold text-white">{title}</h3>
    </div>
    <p className="text-sm text-gray-400 group-hover:text-gray-300">
      {description}
    </p>
  </NavLink>
);

const ManagementDashboard: React.FC = () => {
  const [activeUser, setActiveUser] = useState<ManagementUser | null>(null);
  const [userPermissions, setUserPermissions] =
    useState<UserPermissions | null>(null);
  const [userConsoleProfiles, setUserConsoleProfiles] = useState<
    ConsoleProfile[]
  >([]);

  useEffect(() => {
    const user = getStorageItem<ManagementUser | null>(
      STORAGE_KEYS.ACTIVE_MANAGEMENT_USER,
      null
    );
    setActiveUser(user);

    if (user) {
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
    }
  }, []);

  if (!activeUser || !userPermissions) {
    return <div>Loading Dashboard...</div>;
  }

  // Find the first console profile link (if any) to use for direct navigation
  const firstConsoleLink = userPermissions.consoleProfileLinks[0];
  const firstConsoleId = firstConsoleLink?.consoleProfileId;

  return (
    <div className="animate-fade-in">
      <h2 className="text-3xl font-bold text-white mb-2">
        Welcome, {activeUser.name}
      </h2>
      <p className="text-lg text-gray-400 mb-8">{activeUser.title}</p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* --- Console-Specific Cards --- */}

        {firstConsoleLink?.canAccessRM_Logbook && (
          <DashboardCard
            to={`/console/rm-logbook/${firstConsoleId}`}
            icon={<BookOpen className="w-8 h-8 text-cps-yellow" />}
            title="RM Logbook"
            description="Manage your team, assign routes, and track pre-booked jobs for your console."
            color="border-cps-yellow"
          />
        )}

        {firstConsoleLink?.canAccessWorkerBook && (
          <DashboardCard
            to={`/console/workerbook/${firstConsoleId}`}
            icon={<Users className="w-8 h-8 text-cps-blue" />}
            title="Worker-Book"
            description="Manage daily worker attendance, status, and initiate payouts."
            color="border-cps-blue"
          />
        )}

        {firstConsoleLink?.canAccessMasterBookings && (
          <DashboardCard
            to={`/console/master-bookings/${firstConsoleId}`}
            icon={<Database className="w-8 h-8 text-cps-green" />}
            title="Master Bookings"
            description="View and manage the master list of all bookings for your console."
            color="border-cps-green"
          />
        )}

        {firstConsoleLink?.canAccessMapAssignments && (
          <DashboardCard
            to={`/console/map-assignments/${firstConsoleId}`}
            icon={<MapPin className="w-8 h-8 text-cps-orange" />}
            title="Map Assignments"
            description="Assign route managers to specific maps for daily operations."
            color="border-cps-orange"
          />
        )}

        {/* --- Admin Panel Cards --- */}

        {userPermissions.admin.canManageConsoles && (
          <DashboardCard
            to="/console/admin/consoles"
            icon={<Building className="w-8 h-8 text-gray-400" />}
            title="Console Management"
            description="Create, edit, and configure console profiles for each location."
            color="border-gray-500"
          />
        )}

        {userPermissions.admin.canManageUsers && (
          <DashboardCard
            to="/console/admin/users"
            icon={<UserCheck className="w-8 h-8 text-gray-400" />}
            title="User Management"
            description="Create users and assign permissions to all management portals."
            color="border-gray-500"
          />
        )}

        {userPermissions.admin.canManageTerritoryAndBookings && (
          <DashboardCard
            to="/console/admin/territory"
            icon={<Package className="w-8 h-8 text-gray-400" />}
            title="Bookings & Territory"
            description="Manage master booking lists and assign territories to consoles."
            color="border-gray-500"
          />
        )}

        {userPermissions.admin.canResetApp && (
          <DashboardCard
            to="/console/admin/reset"
            icon={<RotateCcw className="w-8 h-8 text-cps-red" />}
            title="Reset App"
            description="Perform application resets and clear cached data."
            color="border-cps-red"
          />
        )}
      </div>

      {userPermissions.consoleProfileLinks.length > 1 && (
        <div className="mt-8 p-4 bg-gray-800 rounded-lg">
          <p className="text-gray-300">
            You have access to multiple consoles. The cards above link to your
            primary console (<b>{userConsoleProfiles[0]?.title || '...'}</b>).
            Use the sidebar to access other consoles.
          </p>
        </div>
      )}
    </div>
  );
};

export default ManagementDashboard;