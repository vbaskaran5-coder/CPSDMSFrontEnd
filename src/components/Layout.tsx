import React from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import Header from './Header';
import Navigation from './Navigation';
import { ArrowLeft } from 'lucide-react';

const Layout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const isDashboard = location.pathname === '/logsheet';

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <Header />
      <main className="flex-grow container mx-auto px-4 py-6 mb-16">
        <Outlet />
      </main>
      {isDashboard ? (
        <Navigation />
      ) : (
        <div className="fixed bottom-0 left-0 right-0 bg-black shadow-[0_-2px_10px_rgba(0,0,0,0.1)] z-10">
          <div className="container mx-auto px-4">
            <div className="flex justify-start py-3">
              <button
                onClick={() => navigate(-1)}
                className="flex items-center gap-2 px-4 py-2 text-gray-400 hover:text-white transition-colors"
              >
                <ArrowLeft size={20} />
                <span>Back</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Layout;