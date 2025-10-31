// src/lib/dataSyncService.ts
import Papa from 'papaparse';
import {
  getStorageItem,
  setStorageItem,
  STORAGE_KEYS,
  removeStorageItem,
} from './localStorage'; // Added removeStorageItem

// Interface for the full territory structure fetched from Google Sheet
interface FullTerritoryStructure {
  [group: string]: {
    [map: string]: string[]; // Array of all route codes belonging to this map
  };
}

// Interface for the structure mapping a single route to its Group/Map
interface RouteToTerritoryMap {
  [routeCode: string]: {
    group: string;
    map: string;
  };
}

// <<< CORRECTED SHEET NAME HERE >>>
// Google Sheet URL for the Territory structure (CSV export) - Updated sheet name
const EAST_TERRITORY_SHEET_URL =
  'https://docs.google.com/spreadsheets/d/1KPRTH3bESAi-0-2K9v1b-hOUGdCqzLD0D4mdKCSMs-0/gviz/tq?tqx=out:csv&sheet=Territory%20East'; // Corrected sheet name

/**
 * Fetches the East Territory structure (Group -> Map -> Routes[]) from the Google Sheet.
 * Parses the CSV data assuming ONE route per row and transforms it.
 * @returns {Promise<FullTerritoryStructure>} A promise that resolves to the structured territory data.
 * @throws {Error} If fetching or parsing fails.
 */
const fetchAndProcessTerritoryStructure =
  async (): Promise<FullTerritoryStructure> => {
    console.log(
      `Fetching East Territory structure from Google Sheet ('Territory East')...`
    ); // Updated log
    const response = await fetch(EAST_TERRITORY_SHEET_URL);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch territory data: ${response.status} ${response.statusText}`
      );
    }
    const csvText = await response.text();

    return new Promise((resolve, reject) => {
      Papa.parse(csvText, {
        header: false, // Assuming no header row or we skip it
        skipEmptyLines: true,
        complete: (results) => {
          console.log(
            `Parsed ${results.data.length} rows from territory sheet.`
          );
          if (results.errors.length > 0) {
            console.error('CSV Parsing Errors:', results.errors);
            return reject(
              new Error(`CSV parsing error: ${results.errors[0].message}`)
            );
          }

          const structure: FullTerritoryStructure = {};
          let headerSkipped = false; // Flag to ensure we skip the actual header row if present

          results.data.forEach((row: any, index: number) => {
            // Basic header check (adjust if header structure is different)
            if (
              !headerSkipped &&
              typeof row[0] === 'string' &&
              row[0].toLowerCase() === 'group' &&
              typeof row[3] === 'string' &&
              row[3].toLowerCase() === 'route'
            ) {
              console.log('Skipping header row:', row);
              headerSkipped = true;
              return; // Skip this row
            }

            const group = row[0]?.trim();
            // City column (index 1) is ignored for structure
            const map = row[2]?.trim(); // Map Name is column C (index 2)
            const routeCode = row[3]?.trim(); // SINGLE Route is column D (index 3)

            if (group && map && routeCode) {
              // Ensure group exists
              if (!structure[group]) {
                structure[group] = {};
              }
              // Ensure map exists within the group
              if (!structure[group][map]) {
                structure[group][map] = [];
              }
              // Add the single route code to the map's list
              // Check for duplicates before adding (optional but good practice)
              if (!structure[group][map].includes(routeCode)) {
                structure[group][map].push(routeCode);
              } else {
                console.warn(
                  `Duplicate route code found and skipped: ${routeCode} in Group ${group}, Map ${map}`
                );
              }
            } else {
              // Log which row is being skipped and why (using original index + 1 for sheet row number)
              // Don't log if it was the intended header row
              if (index > 0 || !headerSkipped) {
                // Avoid logging header if it was skipped correctly
                console.warn(
                  `Skipping incomplete row ${
                    index + 1
                  } in territory sheet. Group: ${group || 'MISSING'}, Map: ${
                    map || 'MISSING'
                  }, Route: ${routeCode || 'MISSING'}`
                );
              }
            }
          });

          // Optionally sort routes within each map after processing all rows
          for (const group in structure) {
            for (const map in structure[group]) {
              structure[group][map].sort();
            }
          }

          console.log('Processed territory structure:', structure);
          resolve(structure);
        },
        error: (error: Error) => {
          console.error('CSV PapaParse Error:', error);
          reject(new Error(`CSV parsing failed: ${error.message}`));
        },
      });
    });
  };

/**
 * Ensures the East Territory structure is available, fetching and caching if necessary.
 * @param {boolean} forceRefetch - If true, forces a re-fetch from the Google Sheet, ignoring the cache.
 * @returns {Promise<FullTerritoryStructure>} A promise resolving to the territory structure.
 */
export const ensureEastTerritoryStructureFetched = async (
  forceRefetch = false
): Promise<FullTerritoryStructure> => {
  const cachedStructure = getStorageItem<FullTerritoryStructure | null>(
    STORAGE_KEYS.EAST_TERRITORY_STRUCTURE,
    null
  );

  // Check if cache exists and is not empty before using it
  if (
    cachedStructure &&
    Object.keys(cachedStructure).length > 0 &&
    !forceRefetch
  ) {
    console.log('Using cached East Territory structure.');
    return cachedStructure;
  }

  // If no cache, empty cache, or forceRefetch is true, fetch fresh data
  console.log(
    forceRefetch
      ? 'Forcing re-fetch of territory structure.'
      : 'Fetching territory structure (no valid cache).'
  );

  try {
    const fetchedStructure = await fetchAndProcessTerritoryStructure();
    // Only cache if the fetched structure is not empty
    if (Object.keys(fetchedStructure).length > 0) {
      setStorageItem(STORAGE_KEYS.EAST_TERRITORY_STRUCTURE, fetchedStructure);
      console.log('Fetched and cached East Territory structure.');
    } else {
      console.warn(
        'Fetched territory structure was empty. Not caching. Check sheet name and content.'
      );
      // Remove potentially empty/invalid cache item if it exists
      removeStorageItem(STORAGE_KEYS.EAST_TERRITORY_STRUCTURE);
    }
    return fetchedStructure;
  } catch (error) {
    console.error('Failed to ensure East Territory structure:', error);
    // If fetching fails but we have old valid cache, return it as a fallback
    if (cachedStructure && Object.keys(cachedStructure).length > 0) {
      console.warn(
        'Fetching failed, returning potentially stale cached structure.'
      );
      return cachedStructure;
    }
    // If no cache and fetch failed, return empty structure
    return {};
  }
};

/**
 * Helper function to create the reverse map (Route -> {Group, Map})
 * from the main territory structure. Useful for import processes.
 * @param {FullTerritoryStructure} structure - The main territory structure.
 * @returns {RouteToTerritoryMap} A map where keys are route codes.
 */
export const createRouteToTerritoryMap = (
  structure: FullTerritoryStructure
): RouteToTerritoryMap => {
  const routeMap: RouteToTerritoryMap = {};
  for (const group in structure) {
    for (const map in structure[group]) {
      structure[group][map].forEach((routeCode) => {
        // Basic check for existing key, although ideally sheet data is clean
        if (routeMap[routeCode]) {
          console.warn(
            `Duplicate route code "${routeCode}" found during route map creation. Overwriting Map/Group assignment. Old: ${routeMap[routeCode].group}/${routeMap[routeCode].map}, New: ${group}/${map}`
          );
        }
        routeMap[routeCode] = { group, map };
      });
    }
  }
  return routeMap;
};
