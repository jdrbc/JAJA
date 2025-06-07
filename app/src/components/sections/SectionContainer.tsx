import React from 'react';
import UniversalSection from './UniversalSection';
import DynamicSectionPropertyEditor from './DynamicSectionPropertyEditor';
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
  onUpdate?: () => void;
  openPropertiesSectionId?: string | null;
  onSectionPropertiesOpen?: () => void;
  onSectionPropertiesClose?: () => void;
  entryDate: string;
}

const SectionContainer: React.FC<SectionContainerProps> = ({
  section,
  content,
  onContentChange,
  isEditMode = false,
  onSectionDelete,
  onUpdate,
  openPropertiesSectionId,
  onSectionPropertiesOpen,
  onSectionPropertiesClose,
  entryDate,
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
          ? 'border-2 border-dashed border-gray-300 bg-gray-50 rounded-lg'
          : ''
      }`}
    >
      {isEditMode ? (
        <div className='flex'>
          {/* Full-height drag handle */}
          <div
            className='flex-shrink-0 w-12 flex flex-col items-center justify-center bg-gray-200 hover:bg-gray-300 transition-colors cursor-move select-none rounded-l-lg'
            style={{ userSelect: 'none' }}
            {...attributes}
            {...listeners}
          >
            {/* Three columns of small dots */}
            <div className='flex items-center space-x-1 py-2'>
              {Array.from({ length: 3 }, (_, i) => (
                <div key={i} className='flex flex-col space-y-1'>
                  {Array.from({ length: 6 }, (_, j) => (
                    <div
                      key={j}
                      className='w-1 h-1 bg-gray-500 rounded-full'
                    ></div>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Main content area */}
          <div className='flex-1'>
            {/* Edit mode header */}
            <div className='flex justify-between items-center p-4'>
              <div className='flex items-center'>
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
                    label: 'Delete Section',
                    onClick: onSectionDelete || (() => {}),
                    variant: 'danger',
                  },
                ]}
              />
            </div>

            {/* Property editor or edit properties button */}
            {isEditMode && openPropertiesSectionId === section.id ? (
              <DynamicSectionPropertyEditor
                section={section}
                onClose={() => onSectionPropertiesClose?.()}
                onUpdate={onUpdate}
              />
            ) : (
              <div className='px-4 pb-4'>
                <button
                  onClick={() => onSectionPropertiesOpen?.()}
                  className='w-full px-4 py-3 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
                >
                  Edit Properties
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        // Normal mode - use universal section
        <UniversalSection
          type={section.content_type}
          title={section.title}
          content={content}
          onContentChange={newContent =>
            onContentChange(section.id, newContent)
          }
          placeholder={section.placeholder}
          entryDate={entryDate}
          configuration={section.configuration}
        />
      )}
    </div>
  );
};

export default SectionContainer;
