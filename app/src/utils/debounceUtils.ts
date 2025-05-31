import debounce from 'lodash/debounce';

/**
 * Creates a debounced save function that can be used with useCallback
 *
 * @param saveFunction - The function to call for saving
 * @param delay - Debounce delay in milliseconds (default: 500)
 * @returns A debounced save function
 */
export const createDebouncedSave = <T extends any[]>(
  saveFunction: (...args: T) => Promise<void> | void,
  delay: number = 500
) => {
  return debounce(async (...args: T) => {
    try {
      await saveFunction(...args);
    } catch (error) {}
  }, delay);
};

/**
 * Creates a debounced save function for section property updates
 */
export const createDebouncedSectionSave = (
  updateFunction: (
    sectionId: string,
    updates: Record<string, any>
  ) => Promise<any>,
  sectionId: string
) => {
  return createDebouncedSave((field: string, value: string) => {
    return updateFunction(sectionId, { [field]: value });
  }, 500);
};

/**
 * Creates a debounced save function for journal entry updates
 */
export const createDebouncedEntrySave = (
  updateFunction: (date: string, entry: any) => Promise<any>
) => {
  return createDebouncedSave((entry: any) => {
    return updateFunction(entry.date, entry);
  }, 1000);
};

/**
 * Creates a debounced save function for cloud storage
 */
export const createDebouncedCloudSave = (
  saveFunction: (databaseService: any) => Promise<void>
) => {
  return createDebouncedSave((databaseService: any) => {
    return saveFunction(databaseService);
  }, 2000);
};
