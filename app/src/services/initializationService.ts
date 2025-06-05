import { useState, useEffect } from 'react';
import { unifiedSyncService } from './unifiedSyncService';
import { logger } from '../utils/logger';

class InitializationService {
  private isInitialized = false;

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.log('INIT: Already initialized, skipping');
      return;
    }

    logger.log('INIT: Starting application initialization...');

    try {
      // Step 1: Initialize WatermelonDB database
      logger.log('INIT: Initializing WatermelonDB...');
      // WatermelonDB initializes itself when imported, but we can add any setup here if needed
      logger.log('INIT: WatermelonDB ready');

      // Step 2: Initialize unified sync service with WatermelonDB
      logger.log('INIT: Initializing sync service...');
      await unifiedSyncService.initialize();

      this.isInitialized = true;
      logger.log('INIT: Application initialization complete');
    } catch (error) {
      logger.error('INIT: Initialization failed:', error);
      throw error;
    }
  }

  isReady(): boolean {
    return this.isInitialized;
  }

  // For development/testing purposes
  async reset(): Promise<void> {
    logger.log('INIT: Resetting application state...');
    this.isInitialized = false;
    // Add any cleanup logic here if needed
  }
}

export const initializationService = new InitializationService();

// React hook for initialization status
export function useInitialization() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initialize = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Add timeout to prevent infinite loading
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => {
            reject(
              new Error(
                'Initialization timed out after 30 seconds. Please refresh the page and try again.'
              )
            );
          }, 30000); // 30 second timeout
        });

        await Promise.race([
          initializationService.initialize(),
          timeoutPromise,
        ]);

        setIsInitialized(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Initialization failed');
        logger.error('INIT: Hook initialization failed:', err);
      } finally {
        setIsLoading(false);
      }
    };

    initialize();
  }, []);

  return {
    isInitialized,
    isLoading,
    error,
    retry: () => {
      setError(null);
      initializationService.reset().then(() => {
        // Re-run initialization
        window.location.reload();
      });
    },
  };
}
