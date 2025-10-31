import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Database } from 'lucide-react';
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Username and password are required.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const profiles = getStorageItem(STORAGE_KEYS.CONSOLE_PROFILES, []);
      const matchedProfile = profiles.find(
        (p: any) => p.username === username && p.password === password
      );

      if (matchedProfile) {
        // Set new admin user based on their title, this overwrites the old session
        setStorageItem(STORAGE_KEYS.ADMIN, matchedProfile.title);

        navigate('/console/workerbook');
      } else {
        throw new Error('Invalid username or password.');
      }
    } catch (err) {
      console.error('Error during login:', err);
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to login. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-cps-green mb-4">
            <Database className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-cps-green">
            Administrative Console
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
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cps-green focus:border-transparent"
                placeholder="Enter username"
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
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cps-green focus:border-transparent"
                placeholder="Enter password"
                disabled={loading}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-cps-green text-white py-2 px-4 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-cps-green focus:ring-offset-2 focus:ring-offset-gray-800 transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed"
            >
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
