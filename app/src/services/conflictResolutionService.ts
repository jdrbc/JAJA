import {
  ConflictData,
  ConflictResolution,
  ConflictResolver,
} from '../types/cloudStorage';

class ConflictResolutionService {
  private resolveCallback: ((resolution: ConflictResolution) => void) | null =
    null;
  private currentConflict: ConflictData | null = null;
  private isModalOpen = false;

  // UI state for React components
  private onModalStateChange:
    | ((isOpen: boolean, conflict: ConflictData | null) => void)
    | null = null;

  setModalStateChangeCallback(
    callback: (isOpen: boolean, conflict: ConflictData | null) => void
  ): void {
    this.onModalStateChange = callback;
  }

  private updateModalState(
    isOpen: boolean,
    conflict: ConflictData | null = null
  ): void {
    this.isModalOpen = isOpen;
    this.currentConflict = conflict;
    if (this.onModalStateChange) {
      this.onModalStateChange(isOpen, conflict);
    }
  }

  // This function will be set as the conflict resolver in cloud storage manager
  readonly conflictResolver: ConflictResolver = (
    conflict: ConflictData
  ): Promise<ConflictResolution> => {
    return new Promise(resolve => {
      this.resolveCallback = resolve;
      this.updateModalState(true, conflict);
    });
  };

  // Called by the modal when user makes a choice
  resolveConflict(resolution: ConflictResolution): void {
    if (this.resolveCallback) {
      this.resolveCallback(resolution);
      this.resolveCallback = null;
    }
    this.updateModalState(false, null);
  }

  // Getters for UI state
  getModalState(): { isOpen: boolean; conflict: ConflictData | null } {
    return {
      isOpen: this.isModalOpen,
      conflict: this.currentConflict,
    };
  }
}

export const conflictResolutionService = new ConflictResolutionService();
