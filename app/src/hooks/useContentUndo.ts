import { useState, useEffect } from 'react';
import { reactiveDataService } from '../services/reactiveDataService';
import { logger } from '../utils/logger';

export const useContentUndo = () => {
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [undoDescription, setUndoDescription] = useState<string | null>(null);

  useEffect(() => {
    const updateState = () => {
      setCanUndo(reactiveDataService.canUndoContent());
      setCanRedo(reactiveDataService.canRedoContent());
      setUndoDescription(reactiveDataService.getUndoDescription());
    };

    // Update after any entry change
    const unsubscribe = reactiveDataService.subscribeToAllEntries(updateState);
    updateState();

    return unsubscribe;
  }, []);

  const undo = async () => {
    try {
      await reactiveDataService.undoContent();
    } catch (error) {
      logger.error('Undo failed:', error);
    }
  };

  const redo = async () => {
    try {
      await reactiveDataService.redoContent();
    } catch (error) {
      logger.error('Redo failed:', error);
    }
  };

  return { undo, redo, canUndo, canRedo, undoDescription };
};
