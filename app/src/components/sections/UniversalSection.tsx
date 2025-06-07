import React, { useState } from 'react';
import { SectionRegistry } from './core/SectionRegistry';
import SectionTitle from './SectionTitle';
import logger from '../../utils/logger';

export interface UniversalSectionProps {
  type: string;
  title: string;
  content: string;
  onContentChange: (content: string) => void;
  placeholder?: string;
  entryDate: string;
}

const UniversalSection: React.FC<UniversalSectionProps> = ({
  type,
  title,
  content,
  onContentChange,
  placeholder,
  entryDate,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const registry = SectionRegistry.getInstance();
  const definition = registry.get(type);

  if (!definition) {
    logger.warn(`No section definition found for type: ${type}`);
    return (
      <div className='mb-6 p-4 border border-red-300 rounded bg-red-50'>
        <span className='text-red-600'>Unknown section type: {type}</span>
      </div>
    );
  }

  return (
    <div className='mb-6'>
      <SectionTitle title={title} />
      <div className='pl-4'>
        {isEditing ? (
          <div data-testid={`${type}-editor`}>
            {definition.renderEditor({
              content,
              onContentChange: newContent => {
                onContentChange(newContent);
                if (definition.onContentUpdated) {
                  definition.onContentUpdated(newContent);
                }
              },
              placeholder,
              isEditMode: true,
              entryDate,
            })}
            <div className='mt-2 flex space-x-2'>
              <button
                onClick={() => setIsEditing(false)}
                className='px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600'
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <div
            className={`p-2 rounded ${
              definition.isInteractiveInDisplayMode
                ? ''
                : 'cursor-pointer hover:bg-gray-50'
            }`}
            onClick={
              definition.isInteractiveInDisplayMode
                ? undefined
                : () => setIsEditing(true)
            }
            data-testid={`${type}-display`}
          >
            {definition.renderDisplay({
              content,
              onContentChange,
              placeholder,
              isEditMode: false,
              entryDate,
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default UniversalSection;
