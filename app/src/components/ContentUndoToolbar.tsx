import React, { useEffect } from 'react';
import { useContentUndo } from '../hooks/useContentUndo';

interface ContentUndoToolbarProps {
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => Promise<void> | void;
  onRedo?: () => Promise<void> | void;
  undoDescription?: string | null;
}

export const ContentUndoToolbar: React.FC<ContentUndoToolbarProps> = ({
  canUndo: propCanUndo,
  canRedo: propCanRedo,
  onUndo: propOnUndo,
  onRedo: propOnRedo,
  undoDescription: propUndoDescription,
}) => {
  // Use hook as fallback if props not provided
  const {
    undo: hookUndo,
    redo: hookRedo,
    canUndo: hookCanUndo,
    canRedo: hookCanRedo,
    undoDescription: hookUndoDescription,
  } = useContentUndo();

  // Use props if provided, otherwise fall back to hook values
  const canUndo = propCanUndo !== undefined ? propCanUndo : hookCanUndo;
  const canRedo = propCanRedo !== undefined ? propCanRedo : hookCanRedo;
  const undo = propOnUndo || hookUndo;
  const redo = propOnRedo || hookRedo;
  const undoDescription =
    propUndoDescription !== undefined
      ? propUndoDescription
      : hookUndoDescription;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey && canRedo) {
          redo();
        } else if (canUndo) {
          undo();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, canUndo, canRedo]);

  return (
    <div className='flex items-center gap-2 p-2 bg-white border border-gray-200 rounded-md shadow-sm'>
      <button
        onClick={undo}
        disabled={!canUndo}
        title={undoDescription || 'Undo (Cmd+Z)'}
        className={`
          px-3 py-1 text-sm rounded transition-colors
          ${
            canUndo
              ? 'text-gray-700 bg-gray-100 hover:bg-gray-200 active:bg-gray-300'
              : 'text-gray-400 bg-gray-50 cursor-not-allowed'
          }
        `}
      >
        ↶ {'Undo'}
      </button>
      <button
        onClick={redo}
        disabled={!canRedo}
        title='Redo (Cmd+Shift+Z)'
        className={`
          px-3 py-1 text-sm rounded transition-colors
          ${
            canRedo
              ? 'text-gray-700 bg-gray-100 hover:bg-gray-200 active:bg-gray-300'
              : 'text-gray-400 bg-gray-50 cursor-not-allowed'
          }
        `}
      >
        ↷ Redo
      </button>
    </div>
  );
};
