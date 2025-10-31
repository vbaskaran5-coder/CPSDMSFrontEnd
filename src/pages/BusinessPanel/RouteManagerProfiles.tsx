import React, { useState, useEffect } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import {
  getStorageItem,
  setStorageItem,
  STORAGE_KEYS,
} from '../../lib/localStorage';

interface RouteManagerProfile {
  id: number;
  firstName: string;
  lastName: string;
  username: string;
  password?: string;
  consoleProfileId?: number;
}

interface ConsoleProfile {
  id: number;
  title: string;
}

const RouteManagerProfiles: React.FC = () => {
  const [profiles, setProfiles] = useState<RouteManagerProfile[]>([]);
  const [consoleProfiles, setConsoleProfiles] = useState<ConsoleProfile[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newProfile, setNewProfile] = useState({
    firstName: '',
    lastName: '',
    username: '',
    password: '',
  });
  const [selectedManager, setSelectedManager] =
    useState<RouteManagerProfile | null>(null);

  useEffect(() => {
    const savedProfiles = getStorageItem(
      STORAGE_KEYS.ROUTE_MANAGER_PROFILES,
      []
    );
    const savedConsoleProfiles = getStorageItem(
      STORAGE_KEYS.CONSOLE_PROFILES,
      []
    );
    setProfiles(savedProfiles);
    setConsoleProfiles(savedConsoleProfiles);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setNewProfile((prev) => ({ ...prev, [name]: value }));
  };

  const handleAddProfile = () => {
    if (
      newProfile.firstName &&
      newProfile.lastName &&
      newProfile.username &&
      newProfile.password
    ) {
      const newProfileWithId = { ...newProfile, id: Date.now() };
      const updatedProfiles = [...profiles, newProfileWithId];
      setProfiles(updatedProfiles);
      setStorageItem(STORAGE_KEYS.ROUTE_MANAGER_PROFILES, updatedProfiles);
      setNewProfile({
        firstName: '',
        lastName: '',
        username: '',
        password: '',
      });
      setIsAdding(false);
    }
  };

  const handleDeleteProfile = (id: number) => {
    const updatedProfiles = profiles.filter((profile) => profile.id !== id);
    setProfiles(updatedProfiles);
    setStorageItem(STORAGE_KEYS.ROUTE_MANAGER_PROFILES, updatedProfiles);
  };

  const handleAssignProfile = (consoleProfileId: number) => {
    if (selectedManager) {
      const updatedProfiles = profiles.map((p) =>
        p.id === selectedManager.id ? { ...p, consoleProfileId } : p
      );
      setProfiles(updatedProfiles);
      setStorageItem(STORAGE_KEYS.ROUTE_MANAGER_PROFILES, updatedProfiles);
      setSelectedManager(null);
    }
  };

  const getConsoleProfileTitle = (id?: number) => {
    const profile = consoleProfiles.find((p) => p.id === id);
    return profile ? profile.title : 'Unassigned';
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-white">
          Route Manager Profiles
        </h2>
        {!isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="bg-cps-blue text-white rounded-md hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 px-4 py-2"
          >
            <Plus size={16} />
            Add Profile
          </button>
        )}
      </div>
      <div className="bg-gray-800 rounded-lg p-6">
        {isAdding && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4 pb-4 border-b border-gray-700">
            <input
              type="text"
              name="firstName"
              value={newProfile.firstName}
              onChange={handleInputChange}
              placeholder="First Name"
              className="input"
            />
            <input
              type="text"
              name="lastName"
              value={newProfile.lastName}
              onChange={handleInputChange}
              placeholder="Last Name"
              className="input"
            />
            <input
              type="text"
              name="username"
              value={newProfile.username}
              onChange={handleInputChange}
              placeholder="Username"
              className="input"
            />
            <input
              type="password"
              name="password"
              value={newProfile.password}
              onChange={handleInputChange}
              placeholder="Password"
              className="input"
            />
            <div className="flex gap-2">
              <button
                onClick={handleAddProfile}
                className="bg-cps-green text-white rounded-md hover:bg-green-700 transition-colors flex-1"
              >
                Save
              </button>
              <button
                onClick={() => setIsAdding(false)}
                className="bg-gray-600 text-white rounded-md hover:bg-gray-500 transition-colors flex-1"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {profiles.length > 0 ? (
            profiles.map((profile) => (
              <div
                key={profile.id}
                className="flex items-center justify-between bg-gray-700/50 p-3 rounded-md"
              >
                <button
                  onClick={() => setSelectedManager(profile)}
                  className="text-left"
                >
                  <p className="font-medium text-white">
                    {profile.firstName} {profile.lastName}
                  </p>
                  <p className="text-sm text-gray-400">
                    Assigned to:{' '}
                    {getConsoleProfileTitle(profile.consoleProfileId)}
                  </p>
                </button>
                <button
                  onClick={() => handleDeleteProfile(profile.id)}
                  className="p-2 text-gray-400 hover:text-red-400 transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))
          ) : (
            <p className="text-center text-gray-400 py-4">
              No route manager profiles created yet.
            </p>
          )}
        </div>
      </div>

      {selectedManager && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-sm mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-white">
                Assign to Console
              </h3>
              <button
                onClick={() => setSelectedManager(null)}
                className="p-1 hover:bg-gray-700 rounded-full text-gray-400 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>
            <div className="space-y-2">
              {consoleProfiles.map((cp) => (
                <button
                  key={cp.id}
                  onClick={() => handleAssignProfile(cp.id)}
                  className="w-full text-left bg-gray-700 text-gray-300 rounded-md hover:bg-gray-600 transition-colors p-3"
                >
                  {cp.title}
                </button>
              ))}
              <button
                onClick={() => handleAssignProfile(0)}
                className="w-full text-left bg-gray-700 text-gray-300 rounded-md hover:bg-gray-600 transition-colors p-3"
              >
                Unassign
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RouteManagerProfiles;
