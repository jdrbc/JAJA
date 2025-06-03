import { JournalEntry } from './api';
import { localApiService } from './localApi';
import { logger } from '../utils/logger';

// Content Delta Types
interface ContentDelta {
  id: string;
  timestamp: number;
  operation: 'content_change';
  entryDate: string;
  sectionId?: string;
  value?: any;
  oldValue?: any;
  metadata: {
    source: 'user';
    changeType: 'todo' | 'text' | 'entry';
  };
}

interface DeltaBatch {
  id: string;
  timestamp: number;
  deltas: ContentDelta[];
  entryDate: string;
}

// Event emitter interface for dependency injection
interface DataEventEmitter {
  emit(key: string): void;
}

export class ContentDeltaInterceptor {
  private undoHistory: DeltaBatch[] = [];
  private redoHistory: DeltaBatch[] = [];
  private maxHistorySize = 50; // Smaller for content-only
  private dataEventEmitter: DataEventEmitter;
  private isUndoRedoInProgress = false; // Flag to prevent recursion

  constructor(dataEventEmitter: DataEventEmitter) {
    this.dataEventEmitter = dataEventEmitter;
  }

  async interceptEntrySave(
    newEntry: JournalEntry,
    originalUpdateFn: (
      date: string,
      entry: JournalEntry
    ) => Promise<JournalEntry>
  ): Promise<JournalEntry> {
    // Skip interception if undo/redo is in progress to prevent loops
    if (this.isUndoRedoInProgress) {
      logger.log(
        'ContentDeltaInterceptor: Skipping interception during undo/redo'
      );
      return originalUpdateFn(newEntry.date, newEntry);
    }

    // Get current entry for comparison
    const currentEntry = await localApiService.fetchEntryByDate(newEntry.date);

    // Generate content-only deltas
    const deltas = this.generateContentDeltas(currentEntry, newEntry);

    // Skip save if no content changes (fixes saves-on-read!)
    if (deltas.length === 0) {
      logger.log(
        'ContentDeltaInterceptor: No content changes detected, skipping save'
      );
      return newEntry;
    }

    logger.log(
      `ContentDeltaInterceptor: ${deltas.length} content deltas detected`
    );

    // Execute original save
    const result = await originalUpdateFn(newEntry.date, newEntry);

    // Store for undo/redo
    this.addDeltaBatch({
      id: `content_batch_${Date.now()}`,
      timestamp: Date.now(),
      deltas,
      entryDate: newEntry.date,
    });

    return result;
  }

  private generateContentDeltas(
    oldEntry: JournalEntry | null,
    newEntry: JournalEntry
  ): ContentDelta[] {
    const deltas: ContentDelta[] = [];

    if (!oldEntry) {
      return deltas;
    }

    // Compare only section content
    for (const [sectionId, newSection] of Object.entries(newEntry.sections)) {
      const oldSection = oldEntry.sections[sectionId];

      if (oldSection && oldSection.content !== newSection.content) {
        // Content changed
        deltas.push({
          id: `content_change_${Date.now()}`,
          timestamp: Date.now(),
          operation: 'content_change',
          entryDate: newEntry.date,
          sectionId,
          value: newSection.content,
          oldValue: oldSection.content,
          metadata: {
            source: 'user',
            changeType: this.detectContentType(newSection.content),
          },
        });
      }
    }

    return deltas;
  }

  private detectContentType(content: string): 'todo' | 'text' {
    return content.includes('- [ ]') || content.includes('- [x]')
      ? 'todo'
      : 'text';
  }

  private addDeltaBatch(batch: DeltaBatch): void {
    this.undoHistory.push(batch);
    this.redoHistory = []; // Clear redo on new action

    // Keep history manageable
    if (this.undoHistory.length > this.maxHistorySize) {
      this.undoHistory.shift();
    }

    logger.log(
      `ContentDeltaInterceptor: Added delta batch, history size: ${this.undoHistory.length}`
    );

    // Emit refresh event to notify subscribers of state change
    this.emitRefreshEvent(batch.entryDate);
  }

  // Undo/Redo Implementation
  async undo(): Promise<boolean> {
    const batch = this.undoHistory.pop();
    if (!batch) return false;

    try {
      this.isUndoRedoInProgress = true; // Prevent interception loops
      logger.log(
        `ContentDeltaInterceptor: Undoing ${batch.deltas.length} deltas`
      );
      await this.applyReverseBatch(batch);
      this.redoHistory.push(batch);
      this.emitRefreshEvent(batch.entryDate);

      // Keep flag set for a brief period to account for async UI updates
      setTimeout(() => {
        this.isUndoRedoInProgress = false;
      }, 100);

      return true;
    } catch (error) {
      this.undoHistory.push(batch); // Restore on failure
      logger.error('ContentDeltaInterceptor: Undo failed:', error);
      this.isUndoRedoInProgress = false; // Clear immediately on error
      throw error;
    }
  }

  async redo(): Promise<boolean> {
    const batch = this.redoHistory.pop();
    if (!batch) return false;

    try {
      this.isUndoRedoInProgress = true; // Prevent interception loops
      logger.log(
        `ContentDeltaInterceptor: Redoing ${batch.deltas.length} deltas`
      );
      await this.applyForwardBatch(batch);
      this.undoHistory.push(batch);
      this.emitRefreshEvent(batch.entryDate);

      // Keep flag set for a brief period to account for async UI updates
      setTimeout(() => {
        this.isUndoRedoInProgress = false;
      }, 100);

      return true;
    } catch (error) {
      this.redoHistory.push(batch);
      logger.error('ContentDeltaInterceptor: Redo failed:', error);
      this.isUndoRedoInProgress = false; // Clear immediately on error
      throw error;
    }
  }

  private async applyReverseBatch(batch: DeltaBatch): Promise<void> {
    const entry = await localApiService.fetchEntryByDate(batch.entryDate);
    if (!entry) return;

    let updatedEntry = { ...entry };

    // Apply deltas in reverse order
    for (const delta of [...batch.deltas].reverse()) {
      updatedEntry = this.reverseContentDelta(updatedEntry, delta);
    }

    await localApiService.updateEntry(batch.entryDate, updatedEntry);
  }

  private reverseContentDelta(
    entry: JournalEntry,
    delta: ContentDelta
  ): JournalEntry {
    const newEntry = { ...entry };

    switch (delta.operation) {
      case 'content_change':
        // Restore old content
        if (delta.sectionId && delta.oldValue !== undefined) {
          newEntry.sections[delta.sectionId].content = delta.oldValue;
        }
        break;
    }

    return newEntry;
  }

  private async applyForwardBatch(batch: DeltaBatch): Promise<void> {
    // For redo, we can actually just re-apply the same changes
    // since we store the full "new" values in deltas
    const entry = await localApiService.fetchEntryByDate(batch.entryDate);
    if (!entry) return;

    let updatedEntry = { ...entry };

    for (const delta of batch.deltas) {
      updatedEntry = this.applyContentDelta(updatedEntry, delta);
    }

    await localApiService.updateEntry(batch.entryDate, updatedEntry);
  }

  private applyContentDelta(
    entry: JournalEntry,
    delta: ContentDelta
  ): JournalEntry {
    const newEntry = { ...entry };

    switch (delta.operation) {
      case 'content_change':
        if (delta.sectionId && delta.value !== undefined) {
          newEntry.sections[delta.sectionId].content = delta.value;
        }
        break;
    }

    return newEntry;
  }

  private emitRefreshEvent(entryDate: string): void {
    this.dataEventEmitter.emit(`journal:${entryDate}`);
    this.dataEventEmitter.emit('journal:*');
  }

  canUndo(): boolean {
    return this.undoHistory.length > 0;
  }

  canRedo(): boolean {
    return this.redoHistory.length > 0;
  }

  getUndoDescription(): string | null {
    const lastBatch = this.undoHistory[this.undoHistory.length - 1];
    if (!lastBatch) return null;

    const delta = lastBatch.deltas[0]; // Use first delta for description
    switch (delta.operation) {
      case 'content_change':
        return `Undo ${delta.metadata.changeType} edit`;
      default:
        return 'Undo';
    }
  }

  // Debug methods
  getHistorySize(): number {
    return this.undoHistory.length;
  }

  getRedoSize(): number {
    return this.redoHistory.length;
  }
}
