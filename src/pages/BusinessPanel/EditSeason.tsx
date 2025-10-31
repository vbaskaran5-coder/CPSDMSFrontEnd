// src/pages/BusinessPanel/EditSeason.tsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import {
  getStorageItem,
  setStorageItem,
  STORAGE_KEYS,
} from '../../lib/localStorage';
import {
  ConsoleProfile,
  PayoutLogicSettings,
  ConfiguredSeason,
} from '../../types';
import {
  REGIONS,
  ALL_UPSELLS,
  HardcodedSeason,
  getRegionById,
  defaultPayoutLogicSettings,
} from '../../lib/hardcodedData';

const EditSeason: React.FC = () => {
  // Use hardcodedId from URL now
  const { profileId, seasonHardcodedId } = useParams<{
    profileId: string;
    seasonHardcodedId: string;
  }>();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<ConsoleProfile | null>(null);
  const [configuredSeason, setConfiguredSeason] =
    useState<ConfiguredSeason | null>(null);
  const [hardcodedSeasonData, setHardcodedSeasonData] =
    useState<HardcodedSeason | null>(null);
  const [payoutLogic, setPayoutLogic] = useState<PayoutLogicSettings>(
    defaultPayoutLogicSettings
  );
  const [enabledUpsellIds, setEnabledUpsellIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const profiles = getStorageItem<ConsoleProfile[]>(
      STORAGE_KEYS.CONSOLE_PROFILES,
      []
    );
    const currentProfile = profiles.find((p) => p.id.toString() === profileId);

    if (currentProfile) {
      setProfile(currentProfile);
      const currentConfiguredSeason = currentProfile.seasons.find(
        (s) => s.hardcodedId === seasonHardcodedId
      );

      if (currentConfiguredSeason) {
        setConfiguredSeason(currentConfiguredSeason);
        // Ensure payoutLogic is initialized if missing but should exist
        const regionData = getRegionById(currentProfile.region);
        const hcSeason = regionData?.seasons.find(
          (s) => s.id === seasonHardcodedId
        );
        setHardcodedSeasonData(hcSeason || null);

        if (hcSeason?.hasPayoutLogic) {
          setPayoutLogic(
            currentConfiguredSeason.payoutLogic || defaultPayoutLogicSettings
          );
        }

        setEnabledUpsellIds(currentConfiguredSeason.enabledUpsellIds || []);
      } else {
        // Season config not found for this profile, maybe navigate away or show error
        console.error('Configured season not found in profile');
        navigate(`/business-panel/console-profiles/${profileId}`); // Go back
      }
    } else {
      console.error('Profile not found');
      navigate('/business-panel/console-profiles'); // Go back
    }
    setLoading(false);
  }, [profileId, seasonHardcodedId, navigate]);

  const handlePayoutLogicChange = (
    field: keyof PayoutLogicSettings,
    value: any
  ) => {
    // Ensure value is correctly typed (number or boolean)
    let processedValue = value;
    if (typeof payoutLogic[field] === 'number') {
      processedValue = parseFloat(value) || 0;
    } else if (typeof payoutLogic[field] === 'boolean') {
      processedValue = Boolean(value);
    }
    setPayoutLogic((prev) => ({ ...prev, [field]: processedValue }));
  };

  const handlePaymentPercentageChange = (method: string, value: string) => {
    const percentage = value === '' ? 0 : parseInt(value, 10);
    setPayoutLogic((prev) => ({
      ...prev,
      paymentMethodPercentages: {
        ...prev.paymentMethodPercentages,
        [method]: {
          ...(prev.paymentMethodPercentages[method] || {
            percentage: 0,
            applyTaxes: true,
          }), // Ensure object exists
          percentage: isNaN(percentage)
            ? 0
            : Math.max(0, Math.min(100, percentage)), // Clamp between 0-100
        },
      },
    }));
  };

  const handleApplyTaxesChange = (method: string, checked: boolean) => {
    setPayoutLogic((prev) => ({
      ...prev,
      paymentMethodPercentages: {
        ...prev.paymentMethodPercentages,
        [method]: {
          ...(prev.paymentMethodPercentages[method] || {
            percentage: 0,
            applyTaxes: true,
          }), // Ensure object exists
          applyTaxes: checked,
        },
      },
    }));
  };

  const handleUpsellToggle = (upsellId: string) => {
    setEnabledUpsellIds((prev) =>
      prev.includes(upsellId)
        ? prev.filter((id) => id !== upsellId)
        : [...prev, upsellId]
    );
  };

  const handleSave = () => {
    if (!profile || !configuredSeason) return;

    const profiles = getStorageItem<ConsoleProfile[]>(
      STORAGE_KEYS.CONSOLE_PROFILES,
      []
    );
    const updatedProfiles = profiles.map((p) => {
      if (p.id === profile.id) {
        const updatedSeasons = p.seasons.map((s) => {
          if (s.hardcodedId === seasonHardcodedId) {
            return {
              ...s,
              payoutLogic: hardcodedSeasonData?.hasPayoutLogic
                ? payoutLogic
                : undefined, // Only save if applicable
              enabledUpsellIds: enabledUpsellIds,
            };
          }
          return s;
        });
        return { ...p, seasons: updatedSeasons };
      }
      return p;
    });

    setStorageItem(STORAGE_KEYS.CONSOLE_PROFILES, updatedProfiles);
    navigate(`/business-panel/console-profiles/${profile.id}`);
  };

  if (loading || !profile || !configuredSeason || !hardcodedSeasonData) {
    return <div>Loading season data...</div>; // Or a proper loading indicator
  }

  const availableUpsellsForSeason = ALL_UPSELLS.filter((u) =>
    hardcodedSeasonData.availableUpsellIds.includes(u.id)
  );
  const isTeamSeason = hardcodedSeasonData.type === 'Team';

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() =>
              navigate(`/business-panel/console-profiles/${profileId}`)
            }
            className="p-2 hover:bg-gray-700 rounded-full transition-colors"
          >
            <ArrowLeft className="text-gray-400" />
          </button>
          <h2 className="text-2xl font-bold text-white">
            Edit Season: {hardcodedSeasonData.name} ({profile.title})
          </h2>
        </div>
        <button
          onClick={handleSave}
          className="bg-cps-green text-white rounded-md hover:bg-green-700 transition-colors flex items-center justify-center gap-2 px-4 py-2"
        >
          <Save size={16} />
          Save Settings
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Payout Logic Section (Conditional) */}
        {hardcodedSeasonData.hasPayoutLogic ? (
          <div className="bg-gray-800 rounded-lg p-6 space-y-6">
            <h3 className="text-lg font-medium text-white">Payout Logic</h3>

            {/* Tax Rate & Product Cost */}
            <div className="bg-gray-700/50 p-4 rounded-lg space-y-4">
              <h4 className="text-md font-medium text-gray-200">Base Rates</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="taxRate" className="text-sm text-gray-400">
                    Tax Rate (%)
                  </label>
                  <div className="relative mt-1">
                    <input
                      type="number"
                      id="taxRate"
                      value={payoutLogic.taxRate}
                      onChange={(e) =>
                        handlePayoutLogicChange('taxRate', e.target.value)
                      }
                      className="input w-full text-center pr-8"
                      step="0.1"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                      %
                    </span>
                  </div>
                </div>
                {isTeamSeason && (
                  <div>
                    <label
                      htmlFor="productCost"
                      className="text-sm text-gray-400"
                    >
                      Product Cost (%)
                    </label>
                    <div className="relative mt-1">
                      <input
                        type="number"
                        id="productCost"
                        value={payoutLogic.productCost || 0}
                        onChange={(e) =>
                          handlePayoutLogicChange('productCost', e.target.value)
                        }
                        className="input w-full text-center pr-8"
                        step="0.1"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                        %
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Commission Rates */}
            <div className="bg-gray-700/50 p-4 rounded-lg space-y-4">
              <h4 className="text-md font-medium text-gray-200">
                Commission Rates
              </h4>
              {hardcodedSeasonData.type === 'Individual' && (
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="baseCommissionRate"
                    className="text-sm text-gray-400"
                  >
                    Base Rate per EQ
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                      $
                    </span>
                    <input
                      type="number"
                      id="baseCommissionRate"
                      value={
                        payoutLogic.baseCommissionRate?.toFixed(2) ?? '0.00'
                      }
                      onChange={(e) =>
                        handlePayoutLogicChange(
                          'baseCommissionRate',
                          e.target.value
                        )
                      }
                      className="input w-24 text-center pl-7"
                      step="0.01"
                    />
                  </div>
                </div>
              )}
              {isTeamSeason && (
                <>
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="soloBaseCommissionRate"
                      className="text-sm text-gray-400"
                    >
                      Solo Rate per EQ
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                        $
                      </span>
                      <input
                        type="number"
                        id="soloBaseCommissionRate"
                        value={
                          payoutLogic.soloBaseCommissionRate?.toFixed(2) ??
                          '0.00'
                        }
                        onChange={(e) =>
                          handlePayoutLogicChange(
                            'soloBaseCommissionRate',
                            e.target.value
                          )
                        }
                        className="input w-24 text-center pl-7"
                        step="0.01"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="teamBaseCommissionRate"
                      className="text-sm text-gray-400"
                    >
                      Team Rate per EQ
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                        $
                      </span>
                      <input
                        type="number"
                        id="teamBaseCommissionRate"
                        value={
                          payoutLogic.teamBaseCommissionRate?.toFixed(2) ??
                          '0.00'
                        }
                        onChange={(e) =>
                          handlePayoutLogicChange(
                            'teamBaseCommissionRate',
                            e.target.value
                          )
                        }
                        className="input w-24 text-center pl-7"
                        step="0.01"
                      />
                    </div>
                  </div>
                </>
              )}
              {/* Raises */}
              <div className="space-y-2 pt-2 border-t border-gray-600">
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
                    checked={payoutLogic.applySilverRaises}
                    onChange={(e) =>
                      handlePayoutLogicChange(
                        'applySilverRaises',
                        e.target.checked
                      )
                    }
                    className="h-4 w-4 rounded border-gray-600 bg-gray-900 text-cps-blue focus:ring-cps-blue"
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
                    checked={payoutLogic.applyAlumniRaises}
                    onChange={(e) =>
                      handlePayoutLogicChange(
                        'applyAlumniRaises',
                        e.target.checked
                      )
                    }
                    className="h-4 w-4 rounded border-gray-600 bg-gray-900 text-cps-blue focus:ring-cps-blue"
                  />
                </div>
              </div>
            </div>

            {/* Method Weights */}
            <div className="bg-gray-700/50 p-4 rounded-lg">
              <div className="flex justify-between items-center mb-4">
                <h4 className="text-md font-medium text-gray-200">
                  Method Net Weight
                </h4>
                <span className="text-xs text-gray-400">
                  Apply Tax Deduction
                </span>
              </div>
              <div className="space-y-3">
                {Object.entries(payoutLogic.paymentMethodPercentages).map(
                  ([method, config]) => (
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
                            value={config.percentage}
                            onChange={(e) =>
                              handlePaymentPercentageChange(
                                method,
                                e.target.value
                              )
                            }
                            className="input w-20 text-center pr-6"
                            min="0"
                            max="100"
                          />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">
                            %
                          </span>
                        </div>
                        <input
                          type="checkbox"
                          id={`tax-${method}`}
                          checked={config.applyTaxes}
                          onChange={(e) =>
                            handleApplyTaxesChange(method, e.target.checked)
                          }
                          className="h-4 w-4 rounded border-gray-600 bg-gray-900 text-cps-blue focus:ring-cps-blue"
                        />
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-gray-800 rounded-lg p-6 text-center text-gray-500">
            No payout logic applicable for '{hardcodedSeasonData.type}' season
            type.
          </div>
        )}

        {/* Enabled Upsells Section */}
        <div className="bg-gray-800 rounded-lg p-6 space-y-4">
          <h3 className="text-lg font-medium text-white">Enabled Upsells</h3>
          {availableUpsellsForSeason.length > 0 ? (
            <div className="bg-gray-700/50 p-4 rounded-lg space-y-2">
              {availableUpsellsForSeason.map((upsell) => (
                <label
                  key={upsell.id}
                  className="flex items-center gap-3 p-2 rounded-md cursor-pointer hover:bg-gray-800"
                >
                  <input
                    type="checkbox"
                    checked={enabledUpsellIds.includes(upsell.id)}
                    onChange={() => handleUpsellToggle(upsell.id)}
                    className="h-4 w-4 rounded border-gray-600 bg-gray-900 text-cps-blue focus:ring-cps-blue"
                  />
                  <span className="text-white">{upsell.name}</span>
                </label>
              ))}
            </div>
          ) : (
            <p className="text-gray-400 text-sm text-center bg-gray-700/50 p-4 rounded-lg">
              No upsells are available for this season.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default EditSeason;
