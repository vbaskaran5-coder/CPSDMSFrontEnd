// src/pages/HomePage.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, Shield, KeyRound } from 'lucide-react';
import {
  getStorageItem,
  setStorageItem,
  STORAGE_KEYS,
} from '../lib/localStorage';
import { ManagementUser, UserPermissions, Worker } from '../types';

// Helper to create the master user
const createMasterUser = () => {
  const users = getStorageItem<ManagementUser[]>(
    STORAGE_KEYS.MANAGEMENT_USERS,
    []
  );
  const perms = getStorageItem<UserPermissions[]>(
    STORAGE_KEYS.USER_PERMISSIONS,
    []
  );

  const masterUserExists = users.some((u) => u.username === 'basvi');

  if (!masterUserExists) {
    const masterUser: ManagementUser = {
      userId: 1,
      name: 'Vijay Baskaran',
      title: 'Owner',
      username: 'basvi',
      password: 'basvi', // As specified
    };

    const masterPermissions: UserPermissions = {
      userId: 1,
      canAccessAdminPanel: true,
      admin: {
        canManageConsoles: true,
        canManageUsers: true,
        canManageTerritoryAndBookings: true,
        canResetApp: true,
      },
      consoleProfileLinks: [], // Will be populated when consoles are created
    };

    users.push(masterUser);
    perms.push(masterPermissions);

    setStorageItem(STORAGE_KEYS.MANAGEMENT_USERS, users);
    setStorageItem(STORAGE_KEYS.USER_PERMISSIONS, perms);
    console.log('Master user "basvi" created.');
  }
};

const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [portalType, setPortalType] = useState<'staff' | 'management'>('staff');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // On first load, ensure the master user exists
  useEffect(() => {
    createMasterUser();
  }, []);

  const handleStaffLogin = () => {
    const consoleWorkers: Worker[] = getStorageItem(
      STORAGE_KEYS.CONSOLE_WORKERS,
      []
    );
    const today = new Date().toISOString().split('T')[0]; // Simple yyyy-MM-dd

    // Find worker who is marked as 'showed' for today
    const worker = consoleWorkers.find(
      (w) =>
        w.contractorId === username &&
        w.showed &&
        w.showedDate === today
    );

    if (!worker) {
      throw new Error(
        'Invalid contractor number or not marked as "showed" for today.'
      );
    }

    // Password is the worker's first name (case-insensitive)
    if (password.toLowerCase() !== worker.firstName.toLowerCase()) {
      throw new Error('Invalid password (Hint: try your first name).');
    }

    const contractorInfo = {
      number: worker.contractorId,
      firstName: worker.firstName,
      lastName: worker.lastName,
    };

    // Set the correct session type (Cart or Individual)
    if (worker.cartId) {
      setStorageItem(STORAGE_KEYS.ACTIVE_CART, {
        cartId: worker.cartId,
        loggedInWorker: contractorInfo,
      });
      localStorage.removeItem(STORAGE_KEYS.CONTRACTOR);
    } else {
      setStorageItem(STORAGE_KEYS.CONTRACTOR, contractorInfo);
      localStorage.removeItem(STORAGE_KEYS.ACTIVE_CART);
    }

    navigate('/logsheet');
  };

  const handleManagementLogin = () => {
    const users = getStorageItem<ManagementUser[]>(
      STORAGE_KEYS.MANAGEMENT_USERS,
      []
    );
    
    const user = users.find(
      (u) =>
        u.username.toLowerCase() === username.toLowerCase() &&
        u.password === password
    );

    if (user) {
      setStorageItem(STORAGE_KEYS.ACTIVE_MANAGEMENT_USER, user);
      // Navigate to the new unified console (we'll create this layout next)
      navigate('/console');
    } else {
      throw new Error('Invalid username or password.');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Please enter both username/ID and password.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      if (portalType === 'staff') {
        handleStaffLogin();
      } else {
        handleManagementLogin();
      }
    } catch (err) {
      console.error('Error during login:', err);
      setError(
        err instanceof Error ? err.message : 'An unexpected error occurred.'
      );
    } finally {
      setLoading(false);
    }
  };

  const isStaff = portalType === 'staff';

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div
            className={`inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 ${
              isStaff ? 'bg-cps-red' : 'bg-cps-blue'
            }`}
          >
            {isStaff ? (
              <ClipboardList className="h-8 w-8 text-white" />
            ) : (
              <Shield className="h-8 w-8 text-white" />
            )}
          </div>
          <h1
            className={`text-2xl font-bold ${
              isStaff ? 'text-cps-red' : 'text-cps-blue'
            }`}
          >
            {isStaff ? 'Staff Portal' : 'Management Portal'}
          </h1>
          <p className="text-sm text-gray-400">Digital Logsheet</p>
        </div>

        <div className="bg-gray-800 rounded-lg shadow-lg p-8 border border-gray-700">
          <form onSubmit={handleSubmit}>
            {error && (
              <div className="mb-4 p-3 bg-cps-light-red text-white rounded-md text-sm">
                {error}
              </div>
            )}

            <div className="mb-4">
              <label
                htmlFor="portalType"
                className="block text-sm font-medium text-gray-300 mb-2"
              >
                Login As
              </label>
              <select
                id="portalType"
                value={portalType}
                onChange={(e) =>
                  setPortalType(e.target.value as 'staff' | 'management')
                }
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cps-blue"
              >
                <option value="staff">Staff Portal (Logsheet)</option>
                <option value="management">Management Portal</option>
              </select>
            </div>

            <div className="mb-4">
              <label
                htmlFor="username"
                className="block text-sm font-medium text-gray-300 mb-2"
              >
                {isStaff ? 'Contractor Number' : 'Username'}
              </label>
              <div className="relative">
                <KeyRound
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  size={20}
                />
                <input
                  type="text"
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 bg-gray-700/40 border border-gray-600/50 rounded-md text-gray-100 placeholder-gray-400 focus:outline-none focus:border-cps-red focus:ring-1 focus:ring-cps-red"
                  placeholder={
                    isStaff ? 'Enter your contractor #' : 'Enter username'
                  }
                  required
                  disabled={loading}
                />
              </div>
            </div>

            <div className="mb-6">
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-300 mb-2"
              >
                Password
              </label>
              <div className="relative">
                <KeyRound
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  size={20}
                />
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 bg-gray-700/40 border border-gray-600/50 rounded-md text-gray-100 placeholder-gray-400 focus:outline-none focus:border-cps-red focus:ring-1 focus:ring-cps-red"
                  placeholder={
                    isStaff ? 'Enter your first name' : 'Enter password'
                  }
                  required
                  disabled={loading}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full text-white py-2 px-4 rounded-md transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed ${
                isStaff
                  ? 'bg-cps-red hover:bg-[#dc2f3d]'
                  : 'bg-cps-blue hover:bg-blue-700'
              }`}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default HomePage;