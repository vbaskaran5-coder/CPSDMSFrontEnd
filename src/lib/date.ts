// No longer needs the 'date-fns-tz' library

/**
 * Returns the current date object.
 * This function should be called every time the current date is needed
 * to avoid stale date issues by creating a new Date object on each call.
 */
export const getCurrentDate = () => {
  // By creating the new Date object inside the function, we ensure
  // it's always fresh and not a stale value from when the app first loaded.
  return new Date();
};
