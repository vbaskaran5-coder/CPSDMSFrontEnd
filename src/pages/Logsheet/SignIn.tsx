// src/pages/Logsheet/SignIn.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { KeyRound, Lock } from 'lucide-react';
import { format } from 'date-fns';
import { getCurrentDate } from '../../lib/date';
import {
  getStorageItem,
  setStorageItem,
  STORAGE_KEYS,
} from '../../lib/localStorage';
import { Worker } from '../../types';

const SignIn: React.FC = () => {
  const [contractorNumber, setContractorNumber] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const today = format(getCurrentDate(), 'yyyy-MM-dd');
  const consoleWorkers: Worker[] = getStorageItem(
    STORAGE_KEYS.CONSOLE_WORKERS,
    []
  );

  const availableWorkers = consoleWorkers.filter(
    (w: any) => w.showed && w.showedDate === today
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contractorNumber.trim() || !password.trim()) {
      setError('Please enter both contractor number and password.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const worker = availableWorkers.find(
        (w) => w.contractorId === contractorNumber
      );

      if (!worker) {
        throw new Error(
          'Invalid contractor number or not available for today.'
        );
      }

      if (password.toLowerCase() !== worker.firstName.toLowerCase()) {
        throw new Error('Invalid password.');
      }

      const contractorInfo = {
        number: contractorNumber,
        firstName: worker.firstName,
        lastName: worker.lastName,
      };

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
    } catch (err) {
      console.error('Error during login:', err);
      setError(
        err instanceof Error ? err.message : 'An unexpected error occurred.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-cps-red mb-4">
            <KeyRound className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-cps-red">Digital Logsheet</h1>
        </div>

        <div className="bg-gray-800 rounded-lg shadow-lg p-8 border border-gray-700">
          <form onSubmit={handleSubmit}>
            {error && (
              <div className="mb-4 p-3 bg-cps-light-red text-white rounded-md text-sm">
                {error}
              </div>
            )}

            <div className="mb-6">
              <label
                htmlFor="contractorNumber"
                className="block text-sm font-medium text-gray-300 mb-2"
              >
                Contractor Number
              </label>
              <div className="relative mb-4">
                <KeyRound
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  size={20}
                />
                <input
                  type="text"
                  id="contractorNumber"
                  value={contractorNumber}
                  onChange={(e) => setContractorNumber(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 bg-gray-700/40 backdrop-blur-sm border border-gray-600/50 rounded-md text-gray-100 placeholder-gray-400 focus:outline-none focus:border-cps-red focus:ring-1 focus:ring-cps-red"
                  placeholder="Enter your contractor number"
                  required
                  disabled={loading}
                />
              </div>

              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-300 mb-2"
              >
                Password
              </label>
              <div className="relative">
                <Lock
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  size={20}
                />
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 bg-gray-700/40 backdrop-blur-sm border border-gray-600/50 rounded-md text-gray-100 placeholder-gray-400 focus:outline-none focus:border-cps-red focus:ring-1 focus:ring-cps-red"
                  placeholder="Enter your password"
                  required
                  disabled={loading}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || availableWorkers.length === 0}
              className="w-full bg-cps-red text-white py-2 px-4 rounded-md hover:bg-[#dc2f3d] transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default SignIn;