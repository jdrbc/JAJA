import { useState, useEffect } from 'react';
import { unifiedSyncService } from './unifiedSyncService';
import databaseService from './database';
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
      // Step 1: Initialize database
      logger.log('INIT: Initializing database...');
      await databaseService.initialize();

      // Step 2: Initialize unified sync service
      logger.log('INIT: Initializing sync service...');
      await unifiedSyncService.initialize();

      // Step 3: Make database service globally available for cloud sync
      (window as any).databaseService = databaseService;

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
        await initializationService.initialize();
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
