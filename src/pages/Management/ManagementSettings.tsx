// src/pages/Management/ManagementSettings.tsx
import React, { useState, useEffect } from 'react';
import { Save, AlertCircle, CheckCircle } from 'lucide-react';
import {
  getStorageItem,
  setStorageItem,
  STORAGE_KEYS,
} from '../../lib/localStorage';
import { ManagementUser } from '../../types';

const ManagementSettings: React.FC = () => {
  const [activeUser, setActiveUser] = useState<ManagementUser | null>(null);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const user = getStorageItem<ManagementUser | null>(
      STORAGE_KEYS.ACTIVE_MANAGEMENT_USER,
      null
    );
    setActiveUser(user);
  }, []);

  const handleSavePassword = () => {
    setError('');
    setSuccess('');

    if (!activeUser) {
      setError('Could not find active user. Please log in again.');
      return;
    }

    // 1. Check old password
    if (oldPassword !== activeUser.password) {
      setError('Old password does not match.');
      return;
    }

    // 2. Check new password length
    if (newPassword.length < 5) {
      setError('New password must be at least 5 characters long.');
      return;
    }

    // 3. Check for match
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }

    try {
      // Find and update the user in the main user list
      const allUsers = getStorageItem<ManagementUser[]>(
        STORAGE_KEYS.MANAGEMENT_USERS,
        []
      );
      const updatedUsers = allUsers.map((user) => {
        if (user.userId === activeUser.userId) {
          return { ...user, password: newPassword };
        }
        return user;
      });

      // Find and update the active user session
      const updatedActiveUser = { ...activeUser, password: newPassword };

      // Save both back to localStorage
      setStorageItem(STORAGE_KEYS.MANAGEMENT_USERS, updatedUsers);
      setStorageItem(STORAGE_KEYS.ACTIVE_MANAGEMENT_USER, updatedActiveUser);

      // Update local state and clear fields
      setActiveUser(updatedActiveUser);
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSuccess('Password updated successfully!');
    } catch (err) {
      setError('An error occurred while saving. Please try again.');
      console.error(err);
    }
  };

  if (!activeUser) {
    return <div>Loading...</div>;
  }

  return (
    <div className="animate-fade-in">
      <h2 className="text-3xl font-bold text-white mb-8">User Settings</h2>

      <div className="max-w-md bg-gray-800 p-6 rounded-lg border border-gray-700">
        <h3 className="text-xl font-semibold text-white mb-4">
          Change Password
        </h3>
        <p className="text-sm text-gray-400 mb-2">
          Your username is:{' '}
          <strong className="text-gray-200">{activeUser.username}</strong>
        </p>
        <p className="text-sm text-gray-400 mb-6">
          To change your password, please enter your old password and a new one.
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-900/30 text-red-300 border border-red-700 rounded-md text-sm flex items-center gap-2">
            <AlertCircle size={16} /> {error}
          </div>
        )}
        {success && (
          <div className="mb-4 p-3 bg-green-900/30 text-green-300 border border-green-700 rounded-md text-sm flex items-center gap-2">
            <CheckCircle size={16} /> {success}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label
              htmlFor="oldPassword"
              className="block text-sm font-medium text-gray-300 mb-2"
            >
              Old Password
            </label>
            <input
              type="password"
              id="oldPassword"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label
              htmlFor="newPassword"
              className="block text-sm font-medium text-gray-300 mb-2"
            >
              New Password
            </label>
            <input
              type="password"
              id="newPassword"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label
              htmlFor="confirmPassword"
              className="block text-sm font-medium text-gray-300 mb-2"
            >
              Confirm New Password
            </label>
            <input
              type="password"
              id="confirmPassword"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="input"
            />
          </div>
          <div className="pt-2">
            <button
              onClick={handleSavePassword}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-cps-blue text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              <Save size={16} />
              Save New Password
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ManagementSettings;