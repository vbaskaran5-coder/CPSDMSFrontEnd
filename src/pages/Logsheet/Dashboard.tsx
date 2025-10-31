// src/pages/Logsheet/Dashboard.tsx
import React from 'react';
import BookingList from '../../components/BookingList';
import SyncStatus from '../../components/SyncStatus';
import { useJobs } from '../../contexts/JobContext';
import AddContractModal from '../../components/AddContractModal';

const Dashboard: React.FC = () => {
  const { isAddContractOpen, closeAddContract } = useJobs();

  return (
    <div className="container mx-auto px-4 py-6 relative">
      <BookingList />
      <SyncStatus />
      {isAddContractOpen && <AddContractModal onClose={closeAddContract} />}
    </div>
  );
};

export default Dashboard;