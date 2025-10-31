import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { getAssignableRouteManagers, RouteManager } from '../lib/routeManagers';

interface AssignRouteManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onAssign: (manager: RouteManager) => void;
  selectedMaps: Set<string>;
  selectedRoutes: Set<string>;
}

const AssignRouteManager: React.FC<AssignRouteManagerProps> = ({
  isOpen,
  onClose,
  onAssign,
  selectedMaps,
  selectedRoutes,
}) => {
  const [assignableManagers, setAssignableManagers] = useState<RouteManager[]>(
    []
  );

  useEffect(() => {
    if (isOpen) {
      setAssignableManagers(getAssignableRouteManagers());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">
            Assign Route Manager
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-700 rounded-full text-gray-400 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        <div className="mb-4">
          <div className="text-sm text-gray-400">
            <p>Selected Maps: {selectedMaps.size}</p>
            <p>Selected Routes: {selectedRoutes.size}</p>
          </div>
        </div>

        <div className="space-y-2">
          {assignableManagers.map((manager) => (
            <button
              key={manager.name}
              onClick={() => {
                onAssign(manager);
                onClose();
              }}
              className="w-full flex items-center gap-3 px-4 py-3 bg-gray-700 hover:bg-gray-600 rounded-md transition-colors text-left"
            >
              <div className="w-8 h-8 rounded-full bg-cps-blue flex items-center justify-center text-sm font-medium text-white">
                {manager.initials}
              </div>
              <span className="text-gray-200">{manager.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AssignRouteManager;
