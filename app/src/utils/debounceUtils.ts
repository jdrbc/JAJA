import debounce from 'lodash/debounce';

/**
 * Creates a debounced save function that can be used with useCallback
 *
 * @param saveFunction - The function to call for saving
 * @param delay - Debounce delay in milliseconds (default: 500)
 * @param onPending - Optional callback to call immediately when save is triggered
 * @param onComplete - Optional callback to call when save completes successfully
 * @param onError - Optional callback to call when save fails
 * @returns A debounced save function
 */
export const createDebouncedSave = <T extends any[]>(
  saveFunction: (...args: T) => Promise<void> | void,
  delay: number = 500,
  onPending?: () => void,
  onComplete?: () => void,
  onError?: (error: any) => void
) => {
  const debouncedFn = debounce(async (...args: T) => {
    try {
      await saveFunction(...args);
      if (onComplete) {
        onComplete();
      }
    } catch (error) {
      if (onError) {
        onError(error);
      }
    }
  }, delay);

  // Return a wrapper that calls onPending immediately
  return (...args: T) => {
    if (onPending) {
      onPending();
    }
    return debouncedFn(...args);
  };
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
 * Creates a debounced save function for journal entry updates with completion callback
 */
export const createDebouncedEntrySaveWithCallback = (
  updateFunction: (date: string, entry: any) => Promise<any>,
  onComplete?: () => void,
  onError?: (error: any) => void
) => {
  return debounce(async (entry: any) => {
    try {
      await updateFunction(entry.date, entry);
      if (onComplete) {
        onComplete();
      }
    } catch (error) {
      if (onError) {
        onError(error);
      }
    }
  }, 1000);
};
