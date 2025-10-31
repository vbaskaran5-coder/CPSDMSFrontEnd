// src/pages/BusinessPanel/BusinessPanelLayout.tsx
import React from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Shield, Users, UserSquare, Database, MapPin } from 'lucide-react'; // Added MapPin
import { STORAGE_KEYS, removeStorageItem } from '../../lib/localStorage';

const BusinessPanelLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path: string) => location.pathname.startsWith(path);

  return (
    <div className="min-h-screen bg-black flex">
      {/* Sidebar */}
      <div className="w-64 bg-gray-900 border-r border-gray-800 p-4 flex flex-col fixed h-full">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-3 mb-8 text-left w-full hover:opacity-80 transition-opacity"
          title="Go to Home Page"
        >
          <Shield className="w-8 h-8 text-cps-yellow flex-shrink-0" />
          <h1 className="text-xl font-bold text-white">Business Panel</h1>
        </button>
        <nav className="space-y-1 flex-1 overflow-y-auto">
          <button
            onClick={() => navigate('/business-panel/console-profiles')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-left transition-colors ${
              isActive('/business-panel/console-profiles')
                ? 'bg-gray-700 text-white'
                : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
            }`}
          >
            <Users size={18} />
            <span>Console Profiles</span>
          </button>
          <button
            onClick={() => navigate('/business-panel/route-manager-profiles')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-left transition-colors ${
              isActive('/business-panel/route-manager-profiles')
                ? 'bg-gray-700 text-white'
                : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
            }`}
          >
            <UserSquare size={18} />
            <span>Route Managers</span>
          </button>
          {/* Booking Management Button */}
          <button
            onClick={() => navigate('/business-panel/booking-management')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-left transition-colors ${
              isActive('/business-panel/booking-management')
                ? 'bg-gray-700 text-white'
                : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
            }`}
          >
            <Database size={18} />
            <span>Bookings</span>
          </button>
          {/* >>> ADDED Territory Management Button <<< */}
          <button
            onClick={() => navigate('/business-panel/territory-management')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-left transition-colors ${
              isActive('/business-panel/territory-management')
                ? 'bg-gray-700 text-white'
                : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
            }`}
          >
            <MapPin size={18} />
            <span>Territory</span>
          </button>
        </nav>
        {/* Logout Button */}
        <div className="mt-auto pt-4 border-t border-gray-700">
          <button
            onClick={() => {
              removeStorageItem(STORAGE_KEYS.BUSINESS_USER);
              navigate('/');
            }}
            className="w-full flex items-center gap-3 px-3 py-2 text-gray-400 hover:bg-red-800/30 hover:text-red-300 rounded-md text-left transition-colors"
            title="Logout"
          >
            <span>Logout</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 ml-64 p-6 overflow-y-auto bg-gray-900">
        <Outlet />
      </main>
    </div>
  );
};

export default BusinessPanelLayout;
