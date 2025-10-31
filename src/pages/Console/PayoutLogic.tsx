import React, { useState, useEffect } from 'react';
import { Save } from 'lucide-react';
import {
  getStorageItem,
  setStorageItem,
  STORAGE_KEYS,
} from '../../lib/localStorage';

const PAYOUT_LOGIC_SETTINGS_KEY = 'payout_logic_settings';

interface PayoutLogicSettings {
  taxRate: number;
  baseCommissionRate: number;
  applySilverRaises: boolean;
  applyAlumniRaises: boolean;
  paymentMethodPercentages: {
    [key: string]: {
      percentage: number;
      applyTaxes: boolean;
    };
  };
}

const PayoutLogic: React.FC = () => {
  const [settings, setSettings] = useState<PayoutLogicSettings>({
    taxRate: 13,
    baseCommissionRate: 8,
    applySilverRaises: true,
    applyAlumniRaises: true,
    paymentMethodPercentages: {
      Cash: { percentage: 100, applyTaxes: true },
      Cheque: { percentage: 100, applyTaxes: true },
      'E-Transfer': { percentage: 100, applyTaxes: true },
      'Credit Card': { percentage: 100, applyTaxes: true },
      Prepaid: { percentage: 50, applyTaxes: true },
      Billed: { percentage: 50, applyTaxes: true },
    },
  });
  const [saved, setSaved] = useState(false);

  // Load settings from local storage on component mount
  useEffect(() => {
    const savedSettings = getStorageItem(PAYOUT_LOGIC_SETTINGS_KEY, settings);

    // Handle old payment method structure for backward compatibility
    if (
      savedSettings.paymentMethodPercentages &&
      typeof savedSettings.paymentMethodPercentages['Cash'] === 'number'
    ) {
      const upgradedPercentages = {} as any;
      for (const key in savedSettings.paymentMethodPercentages) {
        upgradedPercentages[key] = {
          percentage: savedSettings.paymentMethodPercentages[key],
          applyTaxes: true,
        };
      }
      savedSettings.paymentMethodPercentages = upgradedPercentages;
    }

    // Merge with defaults to add any new top-level properties like baseCommissionRate
    setSettings((prev) => ({ ...prev, ...savedSettings }));
  }, []);

  const handleTaxRateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value === '' ? 0 : parseInt(e.target.value, 10);
    setSettings((prev) => ({ ...prev, taxRate: isNaN(value) ? 0 : value }));
    setSaved(false);
  };

  const handleBaseCommissionChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = e.target.value === '' ? 0 : parseFloat(e.target.value);
    setSettings((prev) => ({
      ...prev,
      baseCommissionRate: isNaN(value) ? 0 : value,
    }));
    setSaved(false);
  };

  const handleCheckboxChange = (
    field: 'applySilverRaises' | 'applyAlumniRaises',
    checked: boolean
  ) => {
    setSettings((prev) => ({
      ...prev,
      [field]: checked,
    }));
    setSaved(false);
  };

  const handlePercentageChange = (method: string, value: string) => {
    const percentage = value === '' ? 0 : parseInt(value, 10);
    setSettings((prev) => ({
      ...prev,
      paymentMethodPercentages: {
        ...prev.paymentMethodPercentages,
        [method]: {
          ...prev.paymentMethodPercentages[method],
          percentage: isNaN(percentage) ? 0 : percentage,
        },
      },
    }));
    setSaved(false);
  };

  const handleApplyTaxesChange = (method: string, checked: boolean) => {
    setSettings((prev) => ({
      ...prev,
      paymentMethodPercentages: {
        ...prev.paymentMethodPercentages,
        [method]: {
          ...prev.paymentMethodPercentages[method],
          applyTaxes: checked,
        },
      },
    }));
    setSaved(false);
  };

  const handleSave = () => {
    setStorageItem(PAYOUT_LOGIC_SETTINGS_KEY, settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="px-6 animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-medium text-white">
          Payout Logic Settings
        </h2>
        <div className="flex items-center gap-4">
          {saved && (
            <span className="text-sm text-cps-green animate-fade-in">
              Settings saved!
            </span>
          )}
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-4 py-2 bg-cps-blue text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            <Save size={16} />
            <span>Save Settings</span>
          </button>
        </div>
      </div>

      <div className="max-w-md mx-auto space-y-8">
        {/* Tax Rate Setting */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-md font-medium text-gray-200 mb-4">Tax Rate</h3>
          <div className="flex items-center justify-between">
            <label htmlFor="taxRate" className="text-sm text-gray-400">
              Default Tax Rate
            </label>
            <div className="relative">
              <input
                type="number"
                id="taxRate"
                value={settings.taxRate}
                onChange={handleTaxRateChange}
                className="input w-24 text-center pr-8"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                %
              </span>
            </div>
          </div>
        </div>

        {/* Net Calculation */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-md font-medium text-gray-200 mb-4">
            Net Calculation
          </h3>

          <div className="flex items-center justify-between mb-4">
            <label
              htmlFor="baseCommissionRate"
              className="text-sm text-gray-400"
            >
              Base Commission Rate per Equiv
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                $
              </span>
              <input
                type="number"
                id="baseCommissionRate"
                value={settings.baseCommissionRate.toFixed(2)}
                onChange={handleBaseCommissionChange}
                className="input w-24 text-center pl-7"
                step="0.01"
              />
            </div>
          </div>

          <div className="space-y-2 mb-6">
            <div className="flex items-center justify-between">
              <label
                htmlFor="applySilverRaises"
                className="text-sm text-gray-300"
              >
                Apply Silver Raises
              </label>
              <input
                type="checkbox"
                id="applySilverRaises"
                checked={settings.applySilverRaises}
                onChange={(e) =>
                  handleCheckboxChange('applySilverRaises', e.target.checked)
                }
                className="h-4 w-4 rounded border-gray-600 bg-gray-700 text-cps-blue focus:ring-cps-blue"
              />
            </div>
            <div className="flex items-center justify-between">
              <label
                htmlFor="applyAlumniRaises"
                className="text-sm text-gray-300"
              >
                Apply Alumni Raises
              </label>
              <input
                type="checkbox"
                id="applyAlumniRaises"
                checked={settings.applyAlumniRaises}
                onChange={(e) =>
                  handleCheckboxChange('applyAlumniRaises', e.target.checked)
                }
                className="h-4 w-4 rounded border-gray-600 bg-gray-700 text-cps-blue focus:ring-cps-blue"
              />
            </div>
          </div>

          {/* Method Weight Section */}
          <div className="border-t border-gray-700 pt-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-md font-medium text-gray-200">
                Method Weight
              </h3>
              <span className="text-xs text-gray-400">Deduct Tax</span>
            </div>
            <div className="space-y-3">
              {Object.entries(settings.paymentMethodPercentages).map(
                ([method, { percentage, applyTaxes }]) => (
                  <div
                    key={method}
                    className="flex items-center justify-between"
                  >
                    <label
                      htmlFor={`method-${method}`}
                      className="text-sm text-gray-300 flex-1"
                    >
                      {method}
                    </label>
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <input
                          type="number"
                          id={`method-${method}`}
                          value={percentage}
                          onChange={(e) =>
                            handlePercentageChange(method, e.target.value)
                          }
                          className="input w-20 text-center pr-6"
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">
                          %
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        id={`tax-${method}`}
                        checked={applyTaxes}
                        onChange={(e) =>
                          handleApplyTaxesChange(method, e.target.checked)
                        }
                        className="h-4 w-4 rounded border-gray-600 bg-gray-700 text-cps-blue focus:ring-cps-blue"
                      />
                    </div>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PayoutLogic;
