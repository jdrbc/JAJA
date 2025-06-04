import React, { useState } from 'react';
import { useTemplateManagement } from '../../hooks/useTemplateManagement';
import { SectionTemplate } from '../../services/api';
import { logger } from '../../utils/logger';
import { SectionRegistry } from '../sections/core/SectionRegistry';

interface AddSectionButtonProps {
  columnId: string;
  onSectionAdded: (section: SectionTemplate) => void;
}

const AddSectionButton: React.FC<AddSectionButtonProps> = ({
  columnId,
  onSectionAdded,
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [contentType, setContentType] = useState('text');
  const [placeholder, setPlaceholder] = useState('');
  const { createSection, isLoading } = useTemplateManagement();

  // Get section types from registry
  const registry = SectionRegistry.getInstance();
  const sectionTypes = registry.getAllTypes();

  const handleCreate = async () => {
    if (!title.trim()) return;

    try {
      const newSection = await createSection({
        id: `section_${Date.now()}`,
        title: title.trim(),
        content_type: contentType,
        placeholder: placeholder.trim(),
        default_content: '',
        refresh_frequency: 'daily',
        column_id: columnId,
      });
      onSectionAdded(newSection);
      setTitle('');
      setPlaceholder('');
      setContentType('text');
      setIsCreating(false);
    } catch (error) {
      logger.error('Failed to create section:', error);
    }
  };

  const handleCancel = () => {
    setTitle('');
    setPlaceholder('');
    setContentType('text');
    setIsCreating(false);
  };

  if (isCreating) {
    return (
      <div className='mt-6 p-4 border-2 border-dashed border-blue-300 rounded-lg bg-blue-50'>
        <div className='space-y-3'>
          <input
            type='text'
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder='Section title'
            className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
            autoFocus
            onKeyDown={e => {
              if (e.key === 'Enter' && e.metaKey) handleCreate();
              if (e.key === 'Escape') handleCancel();
            }}
          />

          <select
            value={contentType}
            onChange={e => setContentType(e.target.value)}
            className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
          >
            {sectionTypes.map(type => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>

          <input
            type='text'
            value={placeholder}
            onChange={e => setPlaceholder(e.target.value)}
            placeholder='Placeholder text (optional)'
            className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
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
    );
  }

  return (
    <button
      onClick={() => setIsCreating(true)}
      className='w-full mt-6 h-16 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50 hover:bg-gray-100 hover:border-gray-400 transition-colors flex items-center justify-center group'
    >
      <div className='text-center'>
        <div className='text-2xl text-gray-400 group-hover:text-gray-500 mb-1'>
          +
        </div>
        <div className='text-xs text-gray-500 group-hover:text-gray-600'>
          Add Section
        </div>
      </div>
    </button>
  );
};

export default AddSectionButton;
