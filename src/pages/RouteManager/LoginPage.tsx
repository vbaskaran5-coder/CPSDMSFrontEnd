import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin } from 'lucide-react';
import {
  getStorageItem,
  setStorageItem,
  STORAGE_KEYS,
} from '../../lib/localStorage';

const LoginPage: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) return;

    setLoading(true);
    setError('');

    try {
      const profiles = getStorageItem(STORAGE_KEYS.ROUTE_MANAGER_PROFILES, []);
      const matchedProfile = profiles.find(
        (p: any) => p.username === username && p.password === password
      );

      if (matchedProfile) {
        setStorageItem(STORAGE_KEYS.ROUTE_MANAGER, matchedProfile);
        navigate('/route-manager/team');
      } else {
        throw new Error('Invalid username or password.');
      }
    } catch (err) {
      console.error('Error during login:', err);
      setError(
        err instanceof Error
          ? err.message
          : 'Invalid route manager name. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-cps-blue mb-4">
            <MapPin className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-cps-blue">
            Digital Route Manager
          </h1>
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
                htmlFor="username"
                className="block text-sm font-medium text-gray-300 mb-2"
              >
                Username
              </label>
              <input
                type="text"
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cps-blue focus:border-transparent"
                placeholder="Enter your username"
                disabled={loading}
              />
            </div>

            <div className="mb-6">
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-300 mb-2"
              >
                Password
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cps-blue focus:border-transparent"
                placeholder="Enter your password"
                disabled={loading}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-cps-blue text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-cps-blue focus:ring-offset-2 focus:ring-offset-gray-800 transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed"
            >
              {loading ? 'Loading...' : 'Login'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
