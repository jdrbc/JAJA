import { useState, useEffect } from 'react';
import { conflictResolutionService } from '../services/conflictResolutionService';
import { ConflictData, ConflictResolution } from '../types/cloudStorage';

export function useConflictResolution() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [conflict, setConflict] = useState<ConflictData | null>(null);

  useEffect(() => {
    // Set up callback to listen for modal state changes
    const handleModalStateChange = (
      isOpen: boolean,
      conflictData: ConflictData | null
    ) => {
      setIsModalOpen(isOpen);
      setConflict(conflictData);
    };

    conflictResolutionService.setModalStateChangeCallback(
      handleModalStateChange
    );

    // Get initial state
    const initialState = conflictResolutionService.getModalState();
    setIsModalOpen(initialState.isOpen);
    setConflict(initialState.conflict);

    // Cleanup is not needed since we're setting a singleton callback
    return () => {
      conflictResolutionService.setModalStateChangeCallback(() => {});
    };
  }, []);

  const resolveConflict = (resolution: ConflictResolution) => {
    conflictResolutionService.resolveConflict(resolution);
  };

  return {
    isModalOpen,
    conflict,
    resolveConflict,
  };
}
