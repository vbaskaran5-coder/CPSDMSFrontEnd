import React from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { format } from 'date-fns';
import AchievementWatermarks from '../../components/AchievementWatermarks';
import { ArrowLeft } from 'lucide-react';
import { PayoutRecord, Worker, Deduction, Bonus } from '../../types';
import {
  getStorageItem,
  setStorageItem,
  STORAGE_KEYS,
} from '../../lib/localStorage';

const PayoutSummary: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { contractorId } = useParams<{ contractorId: string }>();

  const payoutData = location.state?.payoutData;

  if (!payoutData) {
    navigate('/console/workerbook');
    return null;
  }

  const {
    grossSales = 0,
    payableSales = 0,
    aerEquivalent = 0,
    payoutRate = 8.0,
    aerationCommission = 0,
    totalCommission = 0,
    contractor = {},
    completedSteps = 0,
    deductions = [],
    bonuses = [],
    payoutDate,
  } = payoutData;

  const showSilverHat = aerEquivalent >= 50;
  const showGoldJersey = aerEquivalent >= 40 && aerEquivalent < 50;
  const showGreenJacket = aerEquivalent >= 30 && aerEquivalent < 40;

  const handleSubmit = () => {
    try {
      const workers = getStorageItem(STORAGE_KEYS.CONSOLE_WORKERS, []);
      const updatedWorkers = workers.map((w: Worker) => {
        if (w.contractorId === contractor.number) {
          const newPayoutRecord: PayoutRecord = {
            date: payoutDate,
            grossSales,
            equivalent: aerEquivalent,
            commission: totalCommission,
            deductions,
            bonuses,
          };

          const history = w.payoutHistory || [];
          const existingRecordIndex = history.findIndex(
            (p) => p.date === payoutDate
          );

          let updatedHistory;
          if (existingRecordIndex > -1) {
            updatedHistory = [...history];
            updatedHistory[existingRecordIndex] = newPayoutRecord;
          } else {
            updatedHistory = [newPayoutRecord, ...history];
          }

          return {
            ...w,
            payoutCompleted: true,
            commission: totalCommission,
            grossSales: grossSales,
            equivalent: aerEquivalent,
            deductions,
            bonuses,
            payoutHistory: updatedHistory,
          };
        }
        return w;
      });

      setStorageItem(STORAGE_KEYS.CONSOLE_WORKERS, updatedWorkers);
      navigate('/console/workerbook');
    } catch (error) {
      console.error('Error during payout submission:', error);
    }
  };

  const totalDeductions = deductions.reduce(
    (sum: number, d: Deduction) => sum + d.amount,
    0
  );
  const totalBonuses = bonuses.reduce(
    (sum: number, b: Bonus) => sum + b.amount,
    0
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-black">
      <div className="bg-gray-800/60 backdrop-blur-sm rounded-lg shadow-lg p-8 w-full max-w-md relative z-10 border border-gray-700/50">
        <h1 className="text-2xl font-bold text-center text-gray-100 mb-6">
          Payout Summary
        </h1>

        <div className="text-center mb-6">
          <div className="text-sm text-gray-400">
            <p>{format(new Date(payoutDate), 'MMMM d, yyyy')}</p>
            <p>
              {contractor.firstName} {contractor.lastName} • #
              {contractor.number}
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="bg-gray-700/40 rounded-lg p-3">
            <div className="flex justify-between items-center">
              <p className="text-gray-400 text-sm">Total Steps</p>
              <div className="text-base font-medium text-gray-200">
                {completedSteps}
              </div>
            </div>
          </div>

          <div className="bg-gray-700/40 rounded-lg p-3">
            <div className="flex justify-between items-center">
              <p className="text-gray-400 text-sm">Gross Sales</p>
              <div className="text-base font-medium text-gray-200">
                ${grossSales.toFixed(2)}
              </div>
            </div>
          </div>

          <div className="bg-gray-700/40 rounded-lg p-3">
            <div className="flex justify-between items-center">
              <p className="text-gray-400 text-sm">Payable Sales</p>
              <div className="text-base font-medium text-gray-200">
                ${payableSales.toFixed(2)}
              </div>
            </div>
          </div>

          <div className="bg-gray-700/70 rounded-lg p-6 border border-gray-600/70 relative overflow-hidden">
            <AchievementWatermarks
              achievements={{
                silverHat: showSilverHat,
                goldJersey: showGoldJersey,
                greenJacket: showGreenJacket,
              }}
            />
            <div className="text-center relative z-10">
              <p className="text-gray-400 mb-2">Aeration Equivalent</p>
              <div className="text-5xl font-bold text-gray-100">
                {aerEquivalent.toFixed(2)}EQ
              </div>
            </div>
          </div>

          <div className="bg-gray-700/40 rounded-lg p-3">
            <div className="flex justify-between items-center">
              <p className="text-gray-400 text-sm">Base Commission</p>
              <div className="text-sm font-medium text-gray-200">
                ${aerationCommission.toFixed(2)}
              </div>
            </div>
          </div>

          {totalBonuses > 0 && (
            <div className="bg-gray-700/40 rounded-lg p-3">
              <div className="flex justify-between items-center">
                <p className="text-gray-400 text-sm">Bonuses</p>
                <div className="text-sm font-medium text-green-400">
                  +${totalBonuses.toFixed(2)}
                </div>
              </div>
            </div>
          )}

          {totalDeductions > 0 && (
            <div className="bg-gray-700/40 rounded-lg p-3">
              <div className="flex justify-between items-center">
                <p className="text-gray-400 text-sm">Deductions</p>
                <div className="text-sm font-medium text-red-400">
                  -${totalDeductions.toFixed(2)}
                </div>
              </div>
            </div>
          )}

          <div className="bg-gray-700/70 rounded-lg p-6 border border-gray-600/70">
            <div className="text-center">
              <p className="text-gray-400 mb-2">Total Commission</p>
              <div className="text-5xl font-bold text-gray-100">
                ${totalCommission.toFixed(2)}
              </div>
            </div>
          </div>

          <button
            onClick={handleSubmit}
            className="w-full bg-cps-green text-white py-4 rounded-md hover:bg-green-700 transition-colors font-medium text-lg mt-4"
          >
            Submit Payout
          </button>

          <button
            onClick={() =>
              navigate(`/console/payout/contractor/${contractorId}`)
            }
            className="w-full flex items-center justify-center gap-2 bg-gray-700 text-gray-200 py-3 rounded-md hover:bg-gray-600 transition-colors mt-2"
          >
            <ArrowLeft size={20} />
            <span>Back to Payout</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default PayoutSummary;
