import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { X } from 'lucide-react';
import { format } from 'date-fns';
import { getCurrentDate } from '../lib/date';

const Header: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [showMenu, setShowMenu] = useState(false);
  const isRootPath = location.pathname === '/';

  const contractor = JSON.parse(localStorage.getItem('contractor') || '{}');

  return (
    <>
      <header className="bg-black shadow-md sticky top-0 z-10 border-b border-gray-800">
        <div className="container mx-auto px-4">
          <div className="h-20 flex items-center justify-between">
            <div className="flex-1">
              <div className="text-gray-400">
                <p>{format(getCurrentDate(), 'EEEE, MMMM do')}</p>
              </div>
            </div>

            <div className="flex-1 flex justify-center">
              <button
                onClick={() => navigate('/')}
                className="flex items-center hover:opacity-80 transition-opacity"
              >
                <img
                  src="/logo.svg"
                  alt="Canadian Property Stars Logo"
                  className="h-16 w-16 object-contain"
                />
                <h1 className="text-xl font-bold text-cps-red -ml-1">
                  Digital Logsheet
                </h1>
              </button>
            </div>

            <div className="flex-1 flex justify-end">
              <button
                onClick={() => navigate('/logsheet/signin')}
                className="text-right border-l border-gray-800 pl-8 hover:bg-gray-800/50 py-2 px-4 rounded transition-colors"
              >
                <p className="text-sm font-medium text-gray-300">
                  {contractor.firstName} {contractor.lastName}
                </p>
                <p className="text-xs text-gray-400">#{contractor.number}</p>
              </button>
            </div>
          </div>
        </div>
      </header>

      {showMenu && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-30">
          <div className="bg-gray-800 rounded-lg p-4 w-[90%] max-w-sm">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-100">Menu</h3>
              <button
                onClick={() => setShowMenu(false)}
                className="p-1 hover:bg-gray-700 rounded-full"
              >
                <X size={20} className="text-gray-300" />
              </button>
            </div>
            <div className="space-y-2">
              <button
                onClick={() => {
                  setShowMenu(false);
                  navigate('/');
                }}
                className="w-full py-3 flex items-center gap-3 px-4 bg-gray-700 text-gray-200 rounded-md hover:bg-gray-600 transition-colors"
              >
                Back to Home
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Header;
