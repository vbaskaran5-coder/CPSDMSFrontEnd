// src/pages/Management/AdminConsoleProfileDetail.tsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ToggleLeft, ToggleRight, Settings } from 'lucide-react';
import {
  getStorageItem,
  setStorageItem,
  STORAGE_KEYS,
} from '../../lib/localStorage';
import { ConsoleProfile, ConfiguredSeason } from '../../types';
import {
  getRegionById,
  defaultPayoutLogicSettings,
} from '../../lib/hardcodedData';

const AdminConsoleProfileDetail: React.FC = () => {
  const { profileId } = useParams<{ profileId: string }>();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ConsoleProfile | null>(null);

  useEffect(() => {
    loadProfile();
  }, [profileId]);

  const loadProfile = () => {
    const profiles = getStorageItem<ConsoleProfile[]>(
      STORAGE_KEYS.CONSOLE_PROFILES,
      []
    );
    const currentProfile = profiles.find((p) => p.id.toString() === profileId);

    if (currentProfile) {
      // Ensure seasons exist based on region, add if missing
      const regionData = getRegionById(currentProfile.region);
      if (regionData) {
        let profileUpdated = false;
        const currentSeasonIds = new Set(
          currentProfile.seasons.map((s) => s.hardcodedId)
        );
        const updatedSeasons = [...currentProfile.seasons];

        regionData.seasons.forEach((hardcodedSeason) => {
          if (!currentSeasonIds.has(hardcodedSeason.id)) {
            // Add missing season configuration
            updatedSeasons.push({
              hardcodedId: hardcodedSeason.id,
              enabled: true, // Default to enabled
              enabledUpsellIds: hardcodedSeason.availableUpsellIds,
              payoutLogic: hardcodedSeason.hasPayoutLogic
                ? defaultPayoutLogicSettings
                : undefined,
            });
            profileUpdated = true;
          } else {
            // Ensure existing seasons have payoutLogic if they should
            const existingSeason = updatedSeasons.find(
              (s) => s.hardcodedId === hardcodedSeason.id
            );
            if (
              existingSeason &&
              hardcodedSeason.hasPayoutLogic &&
              !existingSeason.payoutLogic
            ) {
              existingSeason.payoutLogic = defaultPayoutLogicSettings;
              profileUpdated = true;
            } else if (
              existingSeason &&
              !hardcodedSeason.hasPayoutLogic &&
              existingSeason.payoutLogic
            ) {
              delete existingSeason.payoutLogic;
              profileUpdated = true;
            }
          }
        });

        const validSeasonIds = new Set(regionData.seasons.map((s) => s.id));
        const finalSeasons = updatedSeasons.filter((s) =>
          validSeasonIds.has(s.hardcodedId)
        );
        if (finalSeasons.length !== updatedSeasons.length) {
          profileUpdated = true;
        }

        if (profileUpdated) {
          currentProfile.seasons = finalSeasons;
          const updatedProfiles = profiles.map((p) =>
            p.id === currentProfile.id ? currentProfile : p
          );
          setStorageItem(STORAGE_KEYS.CONSOLE_PROFILES, updatedProfiles);
        }
      }
      setProfile(currentProfile);
    }
  };

  const handleSeasonToggle = (hardcodedId: string) => {
    if (profile) {
      const profiles = getStorageItem<ConsoleProfile[]>(
        STORAGE_KEYS.CONSOLE_PROFILES,
        []
      );
      const updatedProfiles = profiles.map((p) => {
        if (p.id === profile.id) {
          const updatedSeasons = p.seasons.map((s) =>
            s.hardcodedId === hardcodedId ? { ...s, enabled: !s.enabled } : s
          );
          return { ...p, seasons: updatedSeasons };
        }
        return p;
      });
      setStorageItem(STORAGE_KEYS.CONSOLE_PROFILES, updatedProfiles);
      loadProfile(); // Reload to update state
    }
  };

  if (!profile) {
    return <div>Profile not found.</div>;
  }

  const regionData = getRegionById(profile.region);
  const hardcodedSeasonsMap = new Map(
    regionData?.seasons.map((s) => [s.id, s])
  );

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/console/admin/consoles')}
            className="p-2 hover:bg-gray-700 rounded-full transition-colors"
          >
            <ArrowLeft className="text-gray-400" />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-white">{profile.title}</h2>
            <p className="text-sm text-gray-400">Region: {profile.region}</p>
          </div>
        </div>
      </div>

      <div className="bg-gray-800 rounded-lg p-6 max-w-3xl mx-auto space-y-4">
        <h3 className="text-lg font-medium text-white mb-2">
          Enabled Seasons
        </h3>
        <p className="text-sm text-gray-400 mb-4">
          Toggle seasons on or off for this console profile. Disabled seasons
          will not appear in the Master-Bookings tabs.
        </p>

        <div className="space-y-3">
          {profile.seasons?.map((configuredSeason) => {
            const hardcodedSeason = hardcodedSeasonsMap.get(
              configuredSeason.hardcodedId
            );
            if (!hardcodedSeason) return null;

            return (
              <div
                key={configuredSeason.hardcodedId}
                className={`p-4 rounded-md transition-all border ${
                  configuredSeason.enabled
                    ? 'bg-gray-700/50 border-gray-700'
                    : 'bg-gray-800 border-gray-700 opacity-60'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div>
                      <p
                        className={`font-medium ${
                          configuredSeason.enabled
                            ? 'text-white'
                            : 'text-gray-500 line-through'
                        }`}
                      >
                        {hardcodedSeason.name}
                      </p>
                      <p className="text-sm text-gray-400">
                        {hardcodedSeason.type}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Edit Payout/Upsells Button */}
                    {hardcodedSeason.hasPayoutLogic &&
                      configuredSeason.enabled && (
                        <button
                          onClick={() =>
                            navigate(
                              `/console/admin/consoles/${profileId}/edit-season/${configuredSeason.hardcodedId}`
                            )
                          }
                          className="p-2 text-gray-400 hover:text-cps-blue rounded-full hover:bg-gray-600 transition-colors"
                          title="Edit Payout Logic & Upsells"
                        >
                          <Settings size={18} />
                        </button>
                      )}
                    {/* Enable/Disable Toggle */}
                    <button
                      onClick={() =>
                        handleSeasonToggle(configuredSeason.hardcodedId)
                      }
                      className={`p-1 rounded-full ${
                        configuredSeason.enabled
                          ? 'text-green-400 hover:text-green-300'
                          : 'text-gray-500 hover:text-gray-400'
                      }`}
                      title={
                        configuredSeason.enabled
                          ? 'Disable Season'
                          : 'Enable Season'
                      }
                    >
                      {configuredSeason.enabled ? (
                        <ToggleRight size={24} />
                      ) : (
                        <ToggleLeft size={24} />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default AdminConsoleProfileDetail;