// src/App.tsx
import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { format } from 'date-fns';
import { getCurrentDate } from './lib/date';
import {
  getStorageItem,
  setStorageItem,
  STORAGE_KEYS,
  removeStorageItem,
} from './lib/localStorage';
import { Worker } from './types'; // Import Worker type for daily reset logic

// --- Core Pages ---
import HomePage from './pages/HomePage';

// --- Staff Portal (Logsheet) ---
import Layout from './components/Layout';
import Dashboard from './pages/Logsheet/Dashboard';
import JobDetail from './pages/Logsheet/JobDetail';
import ContractDetail from './pages/Logsheet/ContractDetail';
import NewJob from './pages/Logsheet/NewJob';
import NotFound from './pages/Logsheet/NotFound'; // Use the Logsheet's NotFound

// --- NEW Management Portal ---
import ManagementLayout from './pages/Management/Layout';
import ManagementDashboard from './pages/Management/Dashboard';
import ManagementSettings from './pages/Management/ManagementSettings';

// Console Components
import RMLogbook from './pages/Management/RMLogbook';
import ConsoleWorkerbook from './pages/Management/ConsoleWorkerbook';
import ContDetail from './pages/Management/ContDetail';
import PayoutContractor from './pages/Management/PayoutContractor';
import ConsoleMasterBookings from './pages/Management/ConsoleMasterBookings';
import ConsoleMapAssignments from './pages/Management/ConsoleMapAssignments';

// Admin Panel Components
import AdminConsoleManagement from './pages/Management/AdminConsoleManagement';
import AdminConsoleProfileDetail from './pages/Management/AdminConsoleProfileDetail';
import AdminEditSeason from './pages/Management/AdminEditSeason';
import AdminUserManagement from './pages/Management/AdminUserManagement';
import AdminUserPermissions from './pages/Management/AdminUserPermissions';
import AdminBookingsAndTerritory from './pages/Management/AdminBookingsAndTerritory';
import AdminReset from './pages/Management/AdminReset';

// --- Private Route Components ---

/**
 * Staff Portal Private Route
 * Checks if a staff member (Contractor or Cart) is logged in.
 */
const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
  const contractor = getStorageItem(STORAGE_KEYS.CONTRACTOR, null);
  const activeCart = getStorageItem(STORAGE_KEYS.ACTIVE_CART, null);
  // User is logged in if either of these session keys exist
  return contractor || activeCart ? (
    <>{children}</>
  ) : (
    <Navigate to="/" replace /> // Redirect to main login page
  );
};

/**
 * NEW Management Portal Private Route
 * Checks if a persistent ManagementUser is logged in.
 */
const ManagementPrivateRoute = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const managementUser = getStorageItem(
    STORAGE_KEYS.ACTIVE_MANAGEMENT_USER,
    null
  );
  return managementUser ? (
    <>{children}</>
  ) : (
    <Navigate to="/" replace /> // Redirect to main login page
  );
};

// --- App Component ---
function App() {
  // Daily reset logic effect (Preserved from old App.tsx)
  useEffect(() => {
    const todayStr = format(getCurrentDate(), 'yyyy-MM-dd');
    const lastAppDate = getStorageItem(STORAGE_KEYS.LAST_APP_DATE, null);

    if (lastAppDate && lastAppDate !== todayStr) {
      console.log(
        `New day detected (${todayStr}). Resetting daily assignments and statuses from ${lastAppDate}.`
      );

      const yesterdayStr = lastAppDate;

      // Archive previous day's route assignments
      const routeAssignments = getStorageItem(
        STORAGE_KEYS.ROUTE_ASSIGNMENTS,
        null
      );
      if (routeAssignments && Object.keys(routeAssignments).length > 0) {
        setStorageItem(`routeAssignments_${yesterdayStr}`, routeAssignments);
      }
      removeStorageItem(STORAGE_KEYS.ROUTE_ASSIGNMENTS);

      // Archive previous day's map assignments
      const mapAssignments = getStorageItem(STORAGE_KEYS.MAP_ASSIGNMENTS, null);
      if (mapAssignments && Object.keys(mapAssignments).length > 0) {
        setStorageItem(`mapAssignments_${yesterdayStr}`, mapAssignments);
      }
      removeStorageItem(STORAGE_KEYS.MAP_ASSIGNMENTS);

      // Archive previous day's attendance finalization status
      const attendanceFinalized = getStorageItem(
        STORAGE_KEYS.ATTENDANCE_FINALIZED,
        null
      );
      if (attendanceFinalized) {
        setStorageItem(`attendanceFinalized_${yesterdayStr}`, 'true');
      }
      removeStorageItem(STORAGE_KEYS.ATTENDANCE_FINALIZED);

      // Reset worker statuses for the new day
      const workers = getStorageItem<Worker[]>(
        STORAGE_KEYS.CONSOLE_WORKERS,
        []
      );
      if (workers.length > 0) {
        const resetWorkers = workers.map((w) => {
          if (
            w.bookingStatus === 'quit_fired' ||
            w.bookingStatus === 'wdr_tnb'
          ) {
            return w;
          }

          const newWorker = { ...w };

          delete newWorker.showed;
          delete newWorker.showedDate;
          // delete newWorker.confirmationStatus; // Let's keep confirmation status
          delete newWorker.routeManager;
          delete newWorker.cartId;

          if (newWorker.bookingStatus === 'next_day') {
            newWorker.bookingStatus = 'today';
            newWorker.bookedDate = todayStr;
          } else if (
            newWorker.bookingStatus === 'calendar' &&
            newWorker.bookedDate === todayStr
          ) {
            newWorker.bookingStatus = 'today';
          } else if (newWorker.bookingStatus === 'today') {
            // Was 'today' (yesterday), so now they are unbooked
            delete newWorker.bookingStatus;
            delete newWorker.bookedDate;
          } else if (newWorker.bookingStatus === 'no_show') {
            // Clear no-show status from yesterday
            delete newWorker.bookingStatus;
            delete newWorker.bookedDate;
          }

          return newWorker;
        });
        setStorageItem(STORAGE_KEYS.CONSOLE_WORKERS, resetWorkers);
        console.log('Worker daily statuses reset.');
      }
    }
    setStorageItem(STORAGE_KEYS.LAST_APP_DATE, todayStr);
  }, []);

  return (
    <Routes>
      {/* --- Public Login Route --- */}
      <Route path="/" element={<HomePage />} />

      {/* --- Staff Portal (Logsheet) Routes --- */}
      <Route
        path="/logsheet"
        element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="jobs/:jobId" element={<JobDetail />} />
        <Route path="contracts/:jobId" element={<ContractDetail />} />
        <Route path="new-job" element={<NewJob />} />
        <Route path="*" element={<NotFound />} />
      </Route>

      {/* --- NEW Consolidated Management Portal Routes --- */}
      <Route
        path="/console"
        element={
          <ManagementPrivateRoute>
            <ManagementLayout />
          </ManagementPrivateRoute>
        }
      >
        {/* Main Dashboard/Settings */}
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<ManagementDashboard />} />
        <Route path="settings" element={<ManagementSettings />} />

        {/* Console-Specific Components */}
        <Route path="rm-logbook/:consoleProfileId" element={<RMLogbook />} />
        <Route
          path="master-bookings/:consoleProfileId"
          element={<ConsoleMasterBookings />}
        />
        <Route
          path="map-assignments/:consoleProfileId"
          element={<ConsoleMapAssignments />}
        />
        <Route
          path="workerbook/:consoleProfileId"
          element={<ConsoleWorkerbook />}
        />
        <Route
          path="workerbook/:consoleProfileId/detail/:workerId"
          element={<ContDetail />}
        />
        <Route
          path="workerbook/:consoleProfileId/payout/contractor/:contractorId"
          element={<PayoutContractor />}
        />
        <Route
          path="workerbook/:consoleProfileId/payout/cart/:cartId"
          element={<PayoutContractor />}
        />

        {/* Admin Panel Sub-Components */}
        <Route path="admin/consoles" element={<AdminConsoleManagement />} />
        <Route
          path="admin/consoles/:profileId"
          element={<AdminConsoleProfileDetail />}
        />
        <Route
          path="admin/consoles/:profileId/edit-season/:seasonHardcodedId"
          element={<AdminEditSeason />}
        />
        <Route path="admin/users" element={<AdminUserManagement />} />
        <Route
          path="admin/users/:userId"
          element={<AdminUserPermissions />}
        />
        <Route
          path="admin/territory"
          element={<AdminBookingsAndTerritory />}
        />
        <Route path="admin/reset" element={<AdminReset />} />

        {/* Fallback for any unknown /console routes */}
        <Route path="*" element={<NotFound />} />
      </Route>

      {/* --- Catch-all Fallback --- */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;