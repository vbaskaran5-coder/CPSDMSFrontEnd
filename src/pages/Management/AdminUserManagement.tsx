// src/pages/Management/AdminUserManagement.tsx
import React, { useState, useEffect } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  getStorageItem,
  setStorageItem,
  STORAGE_KEYS,
} from '../../lib/localStorage';
import { ManagementUser, UserPermissions } from '../../types';

const AdminUserManagement: React.FC = () => {
  const [users, setUsers] = useState<ManagementUser[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newUser, setNewUser] = useState({
    name: '',
    title: '',
  });
  const navigate = useNavigate();

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = () => {
    const savedUsers = getStorageItem(STORAGE_KEYS.MANAGEMENT_USERS, []);
    setUsers(savedUsers);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setNewUser((prev) => ({ ...prev, [name]: value }));
  };

  const handleAddUser = () => {
    if (!newUser.name || !newUser.title) {
      alert('Please fill out both Name and Title.');
      return;
    }

    // Generate username and password
    const nameParts = newUser.name.split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts[nameParts.length - 1] || '';

    if (firstName.length < 2 || lastName.length < 3) {
      alert(
        'Name must be valid (e.g., "John Doe") to generate a username.'
      );
      return;
    }

    const username = (
      lastName.substring(0, 3) + firstName.substring(0, 2)
    ).toLowerCase();
    const password = username; // Password is the same as username

    if (users.some((u) => u.username === username)) {
      alert(
        `A user with the generated username "${username}" already exists. Please use a different name.`
      );
      return;
    }

    const newUserId = Date.now();
    const newUserObj: ManagementUser = {
      userId: newUserId,
      name: newUser.name,
      title: newUser.title,
      username: username,
      password: password,
    };

    // Create default, empty permissions for this user
    const newUserPerms: UserPermissions = {
      userId: newUserId,
      canAccessAdminPanel: false,
      admin: {
        canManageConsoles: false,
        canManageUsers: false,
        canManageTerritoryAndBookings: false,
        canResetApp: false,
      },
      consoleProfileLinks: [],
    };

    // Add to localStorage
    const allUsers = [...users, newUserObj];
    const allPermissions = [
      ...getStorageItem<UserPermissions[]>(STORAGE_KEYS.USER_PERMISSIONS, []),
      newUserPerms,
    ];

    setStorageItem(STORAGE_KEYS.MANAGEMENT_USERS, allUsers);
    setStorageItem(STORAGE_KEYS.USER_PERMISSIONS, allPermissions);

    setUsers(allUsers); // Update local state
    setNewUser({ name: '', title: '' }); // Reset form
    setIsAdding(false);
  };

  const handleDeleteUser = (userIdToDelete: number) => {
    if (userIdToDelete === 1) {
      alert('The master user (ID 1) cannot be deleted.');
      return;
    }

    if (
      !window.confirm(
        'Are you sure you want to delete this user and all their permissions? This cannot be undone.'
      )
    ) {
      return;
    }

    // Remove user from users list
    const updatedUsers = users.filter((user) => user.userId !== userIdToDelete);
    setUsers(updatedUsers);
    setStorageItem(STORAGE_KEYS.MANAGEMENT_USERS, updatedUsers);

    // Remove user's permissions
    const allPermissions = getStorageItem<UserPermissions[]>(
      STORAGE_KEYS.USER_PERMISSIONS,
      []
    );
    const updatedPermissions = allPermissions.filter(
      (perm) => perm.userId !== userIdToDelete
    );
    setStorageItem(STORAGE_KEYS.USER_PERMISSIONS, updatedPermissions);
  };

  return (
    <div className="animate-fade-in">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-white">User Management</h2>
        {!isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="bg-cps-blue text-white rounded-md hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 px-4 py-2"
          >
            <Plus size={16} />
            Add User
          </button>
        )}
      </div>
      <div className="bg-gray-800 rounded-lg p-6">
        {isAdding && (
          <div className="mb-4 pb-4 border-b border-gray-700 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <input
                type="text"
                name="name"
                value={newUser.name}
                onChange={handleInputChange}
                placeholder="Full Name (e.g., John Doe)"
                className="input"
              />
              <input
                type="text"
                name="title"
                value={newUser.title}
                onChange={handleInputChange}
                placeholder="Title (e.g., Console Manager)"
                className="input"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleAddUser}
                className="bg-cps-green text-white rounded-md hover:bg-green-700 transition-colors flex-1 py-2"
              >
                Save User
              </button>
              <button
                onClick={() => setIsAdding(false)}
                className="bg-gray-600 text-white rounded-md hover:bg-gray-500 transition-colors flex-1 py-2"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* User List */}
        <div className="space-y-2">
          {users.length > 0 ? (
            users.map((user) => (
              <div
                key={user.userId}
                className="flex items-center justify-between bg-gray-700/50 p-3 rounded-md hover:bg-gray-700 transition-colors group"
              >
                <button
                  onClick={() =>
                    navigate(`/console/admin/users/${user.userId}`)
                  }
                  className="flex-1 text-left"
                >
                  <p className="font-medium text-white">{user.name}</p>
                  <p className="text-sm text-gray-400">
                    {user.title} (User: {user.username})
                  </p>
                </button>
                {user.userId !== 1 && ( // Don't allow deleting master user
                  <button
                    onClick={() => handleDeleteUser(user.userId)}
                    className="p-2 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all ml-2"
                    title="Delete User"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            ))
          ) : (
            <p className="text-center text-gray-400 py-4">
              No management users created yet.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminUserManagement;