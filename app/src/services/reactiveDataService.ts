import { useState, useEffect, useCallback } from 'react';
import { localApiService } from './localApi';
import { JournalEntry } from './api';
import { logger } from '../utils/logger';
import { ContentDeltaInterceptor } from './contentDeltaInterceptor';
import { dataChangeEmitter } from './unifiedSyncService';

// Event emitter for data changes
class DataEventEmitter {
  private listeners = new Map<string, Set<() => void>>();

  subscribe(key: string, callback: () => void) {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    this.listeners.get(key)!.add(callback);

    return () => {
      const callbacks = this.listeners.get(key);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          this.listeners.delete(key);
        }
      }
    };
  }

  emit(key: string) {
    const callbacks = this.listeners.get(key);
    if (callbacks) {
      callbacks.forEach(callback => callback());
    }
  }

  emitGlobal() {
    this.listeners.forEach(callbacks => {
      callbacks.forEach(callback => callback());
    });
  }
}

const dataEventEmitter = new DataEventEmitter();

// Simplified Reactive Data Service
export class ReactiveDataService {
  private contentDeltaInterceptor: ContentDeltaInterceptor;

  constructor() {
    this.contentDeltaInterceptor = new ContentDeltaInterceptor(
      dataEventEmitter
    );
  }

  // Journal Entry operations
  async getJournalEntry(date: string): Promise<JournalEntry | null> {
    return localApiService.fetchEntryByDate(date);
  }

  async updateJournalEntry(
    date: string,
    entry: JournalEntry
  ): Promise<JournalEntry> {
    const result = await this.contentDeltaInterceptor.interceptEntrySave(
      entry,
      async (entryDate: string, entryData: JournalEntry) => {
        const saveResult = await localApiService.updateEntry(
          entryDate,
          entryData
        );

        // Emit local change events
        dataEventEmitter.emit(`journal:${entryDate}`);
        dataEventEmitter.emit('journal:*');

        // Notify sync service of data changes
        dataChangeEmitter.emit();

        return saveResult;
      }
    );

    logger.log('REACTIVE: Journal entry updated:', date);
    return result;
  }

  async deleteJournalEntry(date: string): Promise<void> {
    await localApiService.deleteEntry(date);

    // Emit change events
    dataEventEmitter.emit(`journal:${date}`);
    dataEventEmitter.emit('journal:*');

    // Notify sync service of data changes
    dataChangeEmitter.emit();

    logger.log('REACTIVE: Journal entry deleted:', date);
  }

  // Template operations
  async getTemplates() {
    return localApiService.fetchTemplates();
  }

  // Subscription methods
  subscribeToEntry(date: string, callback: () => void) {
    return dataEventEmitter.subscribe(`journal:${date}`, callback);
  }

  subscribeToAllEntries(callback: () => void) {
    return dataEventEmitter.subscribe('journal:*', callback);
  }

  subscribeToTemplates(callback: () => void) {
    return dataEventEmitter.subscribe('templates', callback);
  }

  // Content undo/redo functionality
  async undoContent(): Promise<boolean> {
    return this.contentDeltaInterceptor.undo();
  }

  async redoContent(): Promise<boolean> {
    return this.contentDeltaInterceptor.redo();
  }

  canUndoContent(): boolean {
    return this.contentDeltaInterceptor.canUndo();
  }

  canRedoContent(): boolean {
    return this.contentDeltaInterceptor.canRedo();
  }

  getUndoDescription(): string | null {
    return this.contentDeltaInterceptor.getUndoDescription();
  }
}

export const reactiveDataService = new ReactiveDataService();

// React hooks for reactive data access
export function useJournalEntry(date: string) {
  const [entry, setEntry] = useState<JournalEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadEntry = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await reactiveDataService.getJournalEntry(date);
      setEntry(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load entry');
      logger.error('Failed to load journal entry:', err);
    } finally {
      setLoading(false);
    }
  }, [date]);

  // Initial load
  useEffect(() => {
    loadEntry();
  }, [loadEntry]);

  // Subscribe to changes
  useEffect(() => {
    const unsubscribe = reactiveDataService.subscribeToEntry(date, loadEntry);
    return unsubscribe;
  }, [date, loadEntry]);

  const updateEntry = useCallback(
    async (updatedEntry: JournalEntry) => {
      try {
        setError(null);
        const result = await reactiveDataService.updateJournalEntry(
          date,
          updatedEntry
        );
        setEntry(result);
        return result;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update entry');
        throw err;
      }
    },
    [date]
  );

  const deleteEntry = useCallback(async () => {
    try {
      setError(null);
      await reactiveDataService.deleteJournalEntry(date);
      setEntry(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete entry');
      throw err;
    }
  }, [date]);

  return {
    entry,
    loading,
    error,
    updateEntry,
    deleteEntry,
    refetch: loadEntry,
  };
}

export function useTemplates() {
  const [templateData, setTemplateData] = useState<{
    sections: any[];
    columns: any[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTemplates = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await reactiveDataService.getTemplates();
      setTemplateData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load templates');
      logger.error('Failed to load templates:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  // Subscribe to changes
  useEffect(() => {
    const unsubscribe = reactiveDataService.subscribeToTemplates(loadTemplates);
    return unsubscribe;
  }, [loadTemplates]);

  return {
    templates: templateData?.sections || [],
    columns:
      templateData?.columns?.sort(
        (a: any, b: any) => a.display_order - b.display_order
      ) || [],
    loading,
    error,
    refetch: loadTemplates,
  };
}
