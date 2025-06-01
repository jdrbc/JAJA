import React, { useState } from 'react';
import { useTemplateManagement } from '../../hooks/useTemplateManagement';
import { Column } from '../../services/api';
import { logger } from '../../utils/logger';

interface AddColumnButtonProps {
  onColumnAdded: (column: Column) => void;
}

const AddColumnButton: React.FC<AddColumnButtonProps> = ({ onColumnAdded }) => {
  const [isCreating, setIsCreating] = useState(false);
  const [title, setTitle] = useState('');
  const { createColumn, isLoading } = useTemplateManagement();

  const handleCreate = async () => {
    if (!title.trim()) return;

    try {
      const newColumn = await createColumn({
        id: `col_${Date.now()}`,
        title: title.trim(),
        width: 400, // Default width
      });
      onColumnAdded(newColumn);
      setTitle('');
      setIsCreating(false);
    } catch (error) {
      logger.error('Failed to create column:', error);
    }
  };

  const handleCancel = () => {
    setTitle('');
    setIsCreating(false);
  };

  if (isCreating) {
    return (
      <div
        className='flex-shrink-0 h-full pr-4 pl-4 border-r border-gray-200 bg-white shadow-sm'
        style={{ width: 'min(320px, 100vw)' }}
      >
        <div className='p-4 border-2 border-dashed border-blue-300 rounded-lg bg-blue-50'>
          <div className='space-y-3'>
            <input
              type='text'
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder='Column title'
              className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
              autoFocus
              onKeyDown={e => {
                if (e.key === 'Enter') handleCreate();
                if (e.key === 'Escape') handleCancel();
              }}
            />
            <div className='flex space-x-2'>
              <button
                onClick={handleCreate}
                disabled={!title.trim() || isLoading}
                className='px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50'
              >
                {isLoading ? 'Creating...' : 'Create'}
              </button>
              <button
                onClick={handleCancel}
                className='px-3 py-1 text-sm bg-gray-300 text-gray-700 rounded hover:bg-gray-400'
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className='flex-shrink-0 h-full pr-4 pl-4'
      style={{ width: 'min(320px, 100vw)' }}
    >
      <button
        onClick={() => setIsCreating(true)}
        className='w-full h-32 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50 hover:bg-gray-100 hover:border-gray-400 transition-colors flex items-center justify-center group'
      >
        <div className='text-center'>
          <div className='text-3xl text-gray-400 group-hover:text-gray-500 mb-2'>
            +
          </div>
          <div className='text-sm text-gray-500 group-hover:text-gray-600'>
            Add Column
          </div>
        </div>
      </button>
    </div>
  );
};

export default AddColumnButton;
