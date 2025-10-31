// src/lib/routeManagers.ts
import { getStorageItem, STORAGE_KEYS } from './localStorage';
import { ManagementUser, UserPermissions } from '../types';

export interface RouteManager {
  name: string;
  initials: string;
}

/**
 * Gets a list of all Management Users who are designated
 * as Route Managers for a *specific* Console Profile.
 * @param consoleProfileId The ID of the console profile to check against.
 * @returns An array of RouteManager objects.
 */
export const getAssignableRouteManagers = (
  consoleProfileId: number
): RouteManager[] => {
  if (!consoleProfileId) {
    return [{ name: 'Unassigned', initials: '' }];
  }

  // 1. Get all users and all permissions
  const allUsers = getStorageItem<ManagementUser[]>(
    STORAGE_KEYS.MANAGEMENT_USERS,
    []
  );
  const allPermissions = getStorageItem<UserPermissions[]>(
    STORAGE_KEYS.USER_PERMISSIONS,
    []
  );

  // 2. Find all user IDs that have the "isRouteManager" flag for this console
  const managerUserIds = new Set<number>();
  allPermissions.forEach((perm) => {
    const link = perm.consoleProfileLinks.find(
      (l) =>
        l.consoleProfileId === consoleProfileId &&
        l.isRouteManagerForThisConsole
    );
    if (link) {
      managerUserIds.add(perm.userId);
    }
  });

  // 3. Get the user objects for those IDs
  const managers = allUsers.filter((user) => managerUserIds.has(user.userId));

  // 4. Format the data for the UI
  const formattedManagers: RouteManager[] = managers.map((user) => {
    const nameParts = user.name.split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts[nameParts.length - 1] || '';
    return {
      name: user.name,
      initials: `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase(),
    };
  });

  // 5. Add "Unassigned" and return
  return [{ name: 'Unassigned', initials: '' }, ...formattedManagers];
};