// src/pages/Logsheet/NotFound.tsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Home } from 'lucide-react';

const NotFound: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] animate-fade-in">
      <h1 className="text-2xl font-bold text-cps-red mb-4">Page Not Found</h1>
      <p className="mb-6 text-center">
        The page you're looking for doesn't exist or has been moved.
      </p>
      <button
        onClick={() => navigate('/')}
        className="btn btn-primary flex items-center"
      >
        <Home size={16} className="mr-2" /> Go to Dashboard
      </button>
    </div>
  );
};

export default NotFound;