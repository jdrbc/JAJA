import React from 'react';
import BaseSection from './BaseSection';
import TodoSection from './TodoSection';
import HeaderSection from './HeaderSection';
import MenuDropdown from '../ui/MenuDropdown';
import IconButton from '../ui/IconButton';
import { SectionTemplate } from '../../services/api';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface SectionContainerProps {
  section: SectionTemplate;
  content: string;
  onContentChange: (id: string, content: string) => void;
  isEditMode?: boolean;
  onSectionDelete?: () => void;
  onSectionTitleEdit?: (newTitle: string) => void;
}

const SectionContainer: React.FC<SectionContainerProps> = ({
  section,
  content,
  onContentChange,
  isEditMode = false,
  onSectionDelete,
  onSectionTitleEdit,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: section.id,
    disabled: !isEditMode,
  });

  // Determine component type based on content_type
  const renderSectionComponent = () => {
    if (section.content_type === 'todo') {
      return (
        <TodoSection
          type={section.id}
          title={section.title}
          content={content}
          onContentChange={newContent =>
            onContentChange(section.id, newContent)
          }
          placeholder={section.placeholder}
        />
      );
    }

    if (section.content_type === 'header') {
      return (
        <HeaderSection
          type={section.id}
          title={section.title}
          content={content}
          onContentChange={newContent =>
            onContentChange(section.id, newContent)
          }
          placeholder={section.placeholder}
        />
      );
    }

    // Default to BaseSection for text content
    return (
      <BaseSection
        type={section.id}
        title={section.title}
        content={content}
        onContentChange={newContent => onContentChange(section.id, newContent)}
        placeholder={section.placeholder}
      />
    );
  };

  const handleTitleEdit = () => {
    const newTitle = prompt('Enter new section title:', section.title);
    if (newTitle && newTitle.trim() !== section.title && onSectionTitleEdit) {
      onSectionTitleEdit(newTitle.trim());
    }
  };

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? 'none' : transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : 'auto',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`section-container group ${
        isEditMode
          ? 'border-2 border-dashed border-gray-300 bg-gray-50 p-4 rounded-lg cursor-move'
          : ''
      }`}
      {...(isEditMode ? { ...attributes, ...listeners } : {})}
    >
      {isEditMode && (
        <div className='flex justify-between items-center mb-3'>
          <div
            className='flex items-center space-x-2 select-none'
            style={{ userSelect: 'none' }}
          >
            <span className='text-sm text-gray-500'>⋮⋮</span>
            <span className='text-sm font-medium text-gray-700'>
              {section.title}
            </span>
          </div>
          <MenuDropdown
            trigger={
              <IconButton
                onClick={() => {}}
                className='opacity-0 group-hover:opacity-100 transition-opacity'
                size='sm'
                title='Section options'
              >
                <span className='text-gray-500'>⋯</span>
              </IconButton>
            }
            options={[
              {
                label: 'Edit Title',
                onClick: handleTitleEdit,
              },
              {
                label: 'Delete Section',
                onClick: onSectionDelete || (() => {}),
                variant: 'danger',
              },
            ]}
          />
        </div>
      )}

      <div className={isEditMode ? 'pointer-events-none opacity-60' : ''}>
        {renderSectionComponent()}
      </div>
    </div>
  );
};

export default SectionContainer;
