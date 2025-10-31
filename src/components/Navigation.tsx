import React from 'react';
import { Plus, ListFilter, CheckCircle2, Clock, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useJobs } from '../contexts/JobContext';

const Navigation: React.FC = () => {
  const navigate = useNavigate();
  const { filter, setFilter, openAddContract } = useJobs();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-black shadow-[0_-2px_10px_rgba(0,0,0,0.1)] z-10">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center py-3">
          <div className="flex gap-2">
            <button
              onClick={() => setFilter({ status: undefined })}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-md transition-colors ${
                filter?.status === undefined
                  ? 'bg-cps-blue text-white'
                  : 'text-gray-400 hover:bg-gray-800'
              }`}
            >
              <ListFilter size={18} />
              <span className="text-sm">All</span>
            </button>
            <button
              onClick={() => setFilter({ status: 'pending' })}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-md transition-colors ${
                filter?.status === 'pending'
                  ? 'bg-cps-yellow text-yellow-900'
                  : 'text-gray-400 hover:bg-gray-800'
              }`}
            >
              <Clock size={18} />
              <span className="text-sm">Pending</span>
            </button>
            <button
              onClick={() => setFilter({ status: 'completed' })}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-md transition-colors ${
                filter?.status === 'completed'
                  ? 'bg-cps-green text-white'
                  : 'text-gray-400 hover:bg-gray-800'
              }`}
            >
              <CheckCircle2 size={18} />
              <span className="text-sm">Done</span>
            </button>
            <button
              onClick={() => setFilter({ status: 'contracts' })}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-md transition-colors ${
                filter?.status === 'contracts'
                  ? 'bg-cps-orange text-white'
                  : 'text-gray-400 hover:bg-gray-800'
              }`}
            >
              <FileText size={18} />
              <span className="text-sm">Contracts</span>
            </button>
          </div>

          <div className="flex gap-2">
            <button
              onClick={openAddContract}
              className="flex items-center gap-2 px-4 py-1.5 bg-cps-orange text-white rounded-md hover:bg-orange-600 transition-colors"
            >
              <Plus size={18} />
              <span className="text-sm">Add Contract</span>
            </button>
            <button
              onClick={() => navigate('/logsheet/new-job')}
              className="flex items-center gap-2 px-4 py-1.5 bg-cps-red text-white rounded-md hover:bg-[#dc2f3d] transition-colors"
            >
              <Plus size={18} />
              <span className="text-sm">New Client</span>
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
