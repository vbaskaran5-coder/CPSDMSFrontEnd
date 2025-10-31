// src/pages/Management/AdminUserPermissions.tsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Shield, Building, AlertCircle } from 'lucide-react';
import {
  getStorageItem,
  setStorageItem,
  STORAGE_KEYS,
} from '../../lib/localStorage';
import {
  ManagementUser,
  UserPermissions,
  ConsoleProfile,
  ConsolePermissionLink,
} from '../../types';

const AdminUserPermissions: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();

  const [user, setUser] = useState<ManagementUser | null>(null);
  const [permissions, setPermissions] = useState<UserPermissions | null>(null);
  const [allConsoles, setAllConsoles] = useState<ConsoleProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    try {
      if (!userId) {
        navigate('/console/admin/users');
        return;
      }
      const numUserId = parseInt(userId, 10);

      const allUsers = getStorageItem<ManagementUser[]>(
        STORAGE_KEYS.MANAGEMENT_USERS,
        []
      );
      const allPerms = getStorageItem<UserPermissions[]>(
        STORAGE_KEYS.USER_PERMISSIONS,
        []
      );
      const allConsoleProfiles = getStorageItem<ConsoleProfile[]>(
        STORAGE_KEYS.CONSOLE_PROFILES,
        []
      );

      const foundUser = allUsers.find((u) => u.userId === numUserId);
      const foundPerms = allPerms.find((p) => p.userId === numUserId);

      if (!foundUser || !foundPerms) {
        setError('User or permissions not found.');
        setLoading(false);
        return;
      }

      setUser(foundUser);
      setPermissions(foundPerms);
      setAllConsoles(allConsoleProfiles);
      setLoading(false);
    } catch (err) {
      setError('Failed to load user data.');
      setLoading(false);
    }
  }, [userId, navigate]);

  const handleAdminPermissionChange = (
    field: keyof UserPermissions['admin'],
    value: boolean
  ) => {
    if (!permissions) return;
    setPermissions({
      ...permissions,
      admin: {
        ...permissions.admin,
        [field]: value,
      },
    });
  };

  const handleConsolePermissionChange = (
    consoleId: number,
    field: keyof Omit<ConsolePermissionLink, 'consoleProfileId'>,
    value: boolean
  ) => {
    if (!permissions) return;

    const existingLink = permissions.consoleProfileLinks.find(
      (link) => link.consoleProfileId === consoleId
    );
    let newLinks: ConsolePermissionLink[];

    if (existingLink) {
      newLinks = permissions.consoleProfileLinks.map((link) =>
        link.consoleProfileId === consoleId
          ? { ...link, [field]: value }
          : link
      );
    } else {
      // Create a new link if one doesn't exist
      newLinks = [
        ...permissions.consoleProfileLinks,
        {
          consoleProfileId: consoleId,
          isRouteManagerForThisConsole:
            field === 'isRouteManagerForThisConsole' ? value : false,
          canAccessRM_Logbook:
            field === 'canAccessRM_Logbook' ? value : false,
          canAccessWorkerBook:
            field === 'canAccessWorkerBook' ? value : false,
          canAccessMasterBookings:
            field === 'canAccessMasterBookings' ? value : false,
          canAccessMapAssignments:
            field === 'canAccessMapAssignments' ? value : false,
        },
      ];
    }

    // Clean up: remove links where all permissions are false
    newLinks = newLinks.filter(
      (link) =>
        link.isRouteManagerForThisConsole ||
        link.canAccessRM_Logbook ||
        link.canAccessWorkerBook ||
        link.canAccessMasterBookings ||
        link.canAccessMapAssignments
    );

    setPermissions({ ...permissions, consoleProfileLinks: newLinks });
  };

  const handleSave = () => {
    if (!permissions || !user) return;

    const allPermissions = getStorageItem<UserPermissions[]>(
      STORAGE_KEYS.USER_PERMISSIONS,
      []
    );
    const updatedPermissions = allPermissions.map((p) =>
      p.userId === user.userId ? permissions : p
    );

    setStorageItem(STORAGE_KEYS.USER_PERMISSIONS, updatedPermissions);
    navigate('/console/admin/users');
  };

  if (loading) return <div>Loading...</div>;
  if (error)
    return (
      <div className="text-red-400 flex items-center gap-2">
        <AlertCircle size={16} /> {error}
      </div>
    );
  if (!user || !permissions) return null;

  const isMasterUser = user.userId === 1;

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/console/admin/users')}
            className="p-2 hover:bg-gray-700 rounded-full transition-colors"
          >
            <ArrowLeft className="text-gray-400" />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-white">{user.name}</h2>
            <p className="text-sm text-gray-400">
              {user.title} (User: {user.username})
            </p>
          </div>
        </div>
        <button
          onClick={handleSave}
          className="bg-cps-green text-white rounded-md hover:bg-green-700 transition-colors flex items-center justify-center gap-2 px-4 py-2"
        >
          <Save size={16} />
          Save Permissions
        </button>
      </div>

      <div className="space-y-6">
        {/* Admin Panel Permissions */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <div className="flex items-center gap-2 mb-4">
            <Shield size={20} className="text-cps-yellow" />
            <h3 className="text-lg font-medium text-white">
              Admin Panel Access
            </h3>
          </div>
          <div className="space-y-3">
            <label className="flex items-center gap-3 p-3 rounded-md cursor-pointer hover:bg-gray-700/50">
              <input
                type="checkbox"
                checked={permissions.canAccessAdminPanel}
                disabled={isMasterUser}
                onChange={(e) =>
                  setPermissions({
                    ...permissions,
                    canAccessAdminPanel: e.target.checked,
                  })
                }
                className="h-4 w-4 rounded border-gray-600 bg-gray-900 text-cps-blue focus:ring-cps-blue"
              />
              <span className="text-white">Can Access Admin Panel</span>
            </label>
            {permissions.canAccessAdminPanel && (
              <div className="pl-8 space-y-2 pt-2 border-l border-gray-700">
                <label className="flex items-center gap-3 p-2 rounded-md cursor-pointer hover:bg-gray-700/50">
                  <input
                    type="checkbox"
                    checked={permissions.admin.canManageConsoles}
                    disabled={isMasterUser}
                    onChange={(e) =>
                      handleAdminPermissionChange(
                        'canManageConsoles',
                        e.target.checked
                      )
                    }
                    className="h-4 w-4 rounded border-gray-600 bg-gray-900 text-cps-blue focus:ring-cps-blue"
                  />
                  <span className="text-gray-300">Can Manage Consoles</span>
                </label>
                <label className="flex items-center gap-3 p-2 rounded-md cursor-pointer hover:bg-gray-700/50">
                  <input
                    type="checkbox"
                    checked={permissions.admin.canManageUsers}
                    disabled={isMasterUser}
                    onChange={(e) =>
                      handleAdminPermissionChange(
                        'canManageUsers',
                        e.target.checked
                      )
                    }
                    className="h-4 w-4 rounded border-gray-600 bg-gray-900 text-cps-blue focus:ring-cps-blue"
                  />
                  <span className="text-gray-300">Can Manage Users</span>
                </label>
                <label className="flex items-center gap-3 p-2 rounded-md cursor-pointer hover:bg-gray-700/50">
                  <input
                    type="checkbox"
                    checked={
                      permissions.admin.canManageTerritoryAndBookings
                    }
                    disabled={isMasterUser}
                    onChange={(e) =>
                      handleAdminPermissionChange(
                        'canManageTerritoryAndBookings',
                        e.target.checked
                      )
                    }
                    className="h-4 w-4 rounded border-gray-600 bg-gray-900 text-cps-blue focus:ring-cps-blue"
                  />
                  <span className="text-gray-300">
                    Can Manage Bookings & Territory
                  </span>
                </label>
                <label className="flex items-center gap-3 p-2 rounded-md cursor-pointer hover:bg-gray-700/50">
                  <input
                    type="checkbox"
                    checked={permissions.admin.canResetApp}
                    disabled={isMasterUser}
                    onChange={(e) =>
                      handleAdminPermissionChange(
                        'canResetApp',
                        e.target.checked
                      )
                    }
                    className="h-4 w-4 rounded border-gray-600 bg-gray-900 text-cps-blue focus:ring-cps-blue"
                  />
                  <span className="text-gray-300">Can Reset App</span>
                </label>
              </div>
            )}
          </div>
        </div>

        {/* Console Profile Links */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <div className="flex items-center gap-2 mb-4">
            <Building size={20} className="text-cps-blue" />
            <h3 className="text-lg font-medium text-white">
              Console Permissions
            </h3>
          </div>
          <div className="space-y-4">
            {allConsoles.length === 0 && (
              <p className="text-gray-500">
                No Console Profiles have been created yet. Go to "Admin Panel
                {'>'} Console Management" to create one.
              </p>
            )}
            {allConsoles.map((console) => {
              const link = permissions.consoleProfileLinks.find(
                (l) => l.consoleProfileId === console.id
              ) || { consoleProfileId: console.id }; // Default empty link

              return (
                <div
                  key={console.id}
                  className="bg-gray-700/50 p-4 rounded-lg"
                >
                  <h4 className="font-semibold text-white mb-3">
                    {console.title} ({console.region})
                  </h4>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                    <label className="flex items-center gap-3 p-2 rounded-md cursor-pointer hover:bg-gray-700">
                      <input
                        type="checkbox"
                        checked={
                          !!link.isRouteManagerForThisConsole
                        }
                        disabled={isMasterUser}
                        onChange={(e) =>
                          handleConsolePermissionChange(
                            console.id,
                            'isRouteManagerForThisConsole',
                            e.target.checked
                          )
                        }
                        className="h-4 w-4 rounded border-gray-600 bg-gray-900 text-cps-blue focus:ring-cps-blue"
                      />
                      <span className="text-gray-300 text-sm">
                        Is Route Manager
                      </span>
                    </label>
                    <label className="flex items-center gap-3 p-2 rounded-md cursor-pointer hover:bg-gray-700">
                      <input
                        type="checkbox"
                        checked={!!link.canAccessRM_Logbook}
                        disabled={isMasterUser}
                        onChange={(e) =>
                          handleConsolePermissionChange(
                            console.id,
                            'canAccessRM_Logbook',
                            e.target.checked
                          )
                        }
                        className="h-4 w-4 rounded border-gray-600 bg-gray-900 text-cps-blue focus:ring-cps-blue"
                      />
                      <span className="text-gray-300 text-sm">
                        Access RM Logbook
                      </span>
                    </label>
                    <label className="flex items-center gap-3 p-2 rounded-md cursor-pointer hover:bg-gray-700">
                      <input
                        type="checkbox"
                        checked={!!link.canAccessWorkerBook}
                        disabled={isMasterUser}
                        onChange={(e) =>
                          handleConsolePermissionChange(
                            console.id,
                            'canAccessWorkerBook',
                            e.target.checked
                          )
                        }
                        className="h-4 w-4 rounded border-gray-600 bg-gray-900 text-cps-blue focus:ring-cps-blue"
                      />
                      <span className="text-gray-300 text-sm">
                        Access Worker-Book
                      </span>
                    </label>
                    <label className="flex items-center gap-3 p-2 rounded-md cursor-pointer hover:bg-gray-700">
                      <input
                        type="checkbox"
                        checked={!!link.canAccessMasterBookings}
                        disabled={isMasterUser}
                        onChange={(e) =>
                          handleConsolePermissionChange(
                            console.id,
                            'canAccessMasterBookings',
                            e.target.checked
                          )
                        }
                        className="h-4 w-4 rounded border-gray-600 bg-gray-900 text-cps-blue focus:ring-cps-blue"
                      />
                      <span className="text-gray-300 text-sm">
                        Access Master-Bookings
                      </span>
                    </label>
                    <label className="flex items-center gap-3 p-2 rounded-md cursor-pointer hover:bg-gray-700">
                      <input
                        type="checkbox"
                        checked={!!link.canAccessMapAssignments}
                        disabled={isMasterUser}
                        onChange={(e) =>
                          handleConsolePermissionChange(
                            console.id,
                            'canAccessMapAssignments',
                            e.target.checked
                          )
                        }
                        className="h-4 w-4 rounded border-gray-600 bg-gray-900 text-cps-blue focus:ring-cps-blue"
                      />
                      <span className="text-gray-300 text-sm">
                        Access Map Assignments
                      </span>
                    </label>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminUserPermissions;