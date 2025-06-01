import React, { useRef, useState } from 'react';
import SectionContainer from '../sections/SectionContainer';
import AddColumnButton from './AddColumnButton';
import AddSectionButton from './AddSectionButton';
import DragDropProvider, { useDragContext } from './DragDropProvider';
import MenuDropdown from '../ui/MenuDropdown';
import IconButton from '../ui/IconButton';
import { useTemplateManagement } from '../../hooks/useTemplateManagement';
import { Column, SectionWithContent } from '../../services/api';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useDroppable, useDraggable } from '@dnd-kit/core';
import { logger } from '../../utils/logger';

interface TemplateEditLayoutProps {
  columns: Column[];
  sections: SectionWithContent[];
  onContentChange: (sectionId: string, content: string) => void;
  onTemplateChange: () => void;
}

const TemplateEditLayoutContent: React.FC<TemplateEditLayoutProps> = ({
  columns,
  sections,
  onContentChange,
  onTemplateChange,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const { isDragging } = useDragContext();
  const { deleteColumn, deleteSection, updateColumn } = useTemplateManagement();

  // Add state to track which section has properties panel open
  const [openPropertiesSectionId, setOpenPropertiesSectionId] = useState<
    string | null
  >(null);

  const groupSectionsByColumn = () => {
    const grouped: Record<string, SectionWithContent[]> = {};

    columns.forEach(column => {
      grouped[column.id] = sections
        .filter(section => section.column_id === column.id)
        .sort((a, b) => a.display_order - b.display_order);
    });

    return grouped;
  };

  const handleColumnDelete = async (columnId: string) => {
    if (
      window.confirm(
        'Are you sure you want to delete this column? All sections in this column will also be deleted.'
      )
    ) {
      try {
        await deleteColumn(columnId);
        onTemplateChange();
      } catch (error) {
        logger.error('Failed to delete column:', error);
      }
    }
  };

  const handleSectionDelete = async (sectionId: string) => {
    if (window.confirm('Are you sure you want to delete this section?')) {
      try {
        await deleteSection(sectionId);
        onTemplateChange();
      } catch (error) {
        logger.error('Failed to delete section:', error);
      }
    }
  };

  const handleColumnTitleEdit = async (columnId: string, newTitle: string) => {
    try {
      await updateColumn(columnId, { title: newTitle });
      onTemplateChange();
    } catch (error) {
      logger.error('Failed to update column title:', error);
    }
  };

  const handleMoveColumnLeft = async (columnId: string) => {
    const sortedColumns = columns.sort(
      (a, b) => a.display_order - b.display_order
    );
    const currentIndex = sortedColumns.findIndex(col => col.id === columnId);

    if (currentIndex > 0) {
      const currentColumn = sortedColumns[currentIndex];
      const previousColumn = sortedColumns[currentIndex - 1];

      try {
        // Swap display orders
        await updateColumn(currentColumn.id, {
          display_order: previousColumn.display_order,
        });
        await updateColumn(previousColumn.id, {
          display_order: currentColumn.display_order,
        });
        onTemplateChange();
      } catch (error) {
        logger.error('Failed to move column left:', error);
      }
    }
  };

  const handleMoveColumnRight = async (columnId: string) => {
    const sortedColumns = columns.sort(
      (a, b) => a.display_order - b.display_order
    );
    const currentIndex = sortedColumns.findIndex(col => col.id === columnId);

    if (currentIndex < sortedColumns.length - 1) {
      const currentColumn = sortedColumns[currentIndex];
      const nextColumn = sortedColumns[currentIndex + 1];

      try {
        // Swap display orders
        await updateColumn(currentColumn.id, {
          display_order: nextColumn.display_order,
        });
        await updateColumn(nextColumn.id, {
          display_order: currentColumn.display_order,
        });
        onTemplateChange();
      } catch (error) {
        logger.error('Failed to move column right:', error);
      }
    }
  };

  const handleSectionPropertiesOpen = (sectionId: string) => {
    setOpenPropertiesSectionId(sectionId);
  };

  const handleSectionPropertiesClose = () => {
    setOpenPropertiesSectionId(null);
  };

  // Custom Draggable Column Component for Template Editing
  const DraggableTemplateColumn: React.FC<{
    column: Column;
    columnSections: SectionWithContent[];
  }> = ({ column, columnSections }) => {
    const { setNodeRef: setDroppableRef } = useDroppable({
      id: column.id,
      data: {
        type: 'column',
        column: column,
      },
    });

    const {
      attributes,
      listeners,
      setNodeRef: setDraggableRef,
    } = useDraggable({
      id: column.id,
      data: {
        type: 'column',
        column: column,
      },
    });

    const { activeId: contextActiveDragId } = useDragContext();

    // Check if this column is currently being dragged
    const isColumnCurrentlyDragged = contextActiveDragId === column.id;

    const columnClasses = [
      'flex-shrink-0 h-full pr-4 pl-4 border-r border-gray-200 bg-white last:border-r-0 last:mr-4 shadow-sm overflow-y-auto',
      !isColumnCurrentlyDragged ? 'cursor-move' : '',
    ]
      .join(' ')
      .trim();

    const style = {
      // Don't apply transform to disable visual preview
      // transform: CSS.Transform.toString(transform),
      opacity: isColumnCurrentlyDragged ? 1 : 1,
      zIndex: isColumnCurrentlyDragged ? 'auto' : 'auto',
    };

    // Combine refs for both draggable and droppable
    const setNodeRef = (node: HTMLElement | null) => {
      setDraggableRef(node);
      setDroppableRef(node);
    };

    return (
      <div
        ref={setNodeRef}
        className={columnClasses}
        data-column-id={column.id}
        style={{
          width: 'auto',
          minWidth: 'min(280px, 100vw)',
          maxWidth: '100vw',
          ...style,
        }}
        title='Drag to reorder column'
        {...attributes}
        {...listeners}
      >
        <div
          className='sticky top-0 bg-white z-10 pb-2'
          style={{ pointerEvents: isColumnCurrentlyDragged ? 'none' : 'auto' }}
        >
          <div className='flex items-center justify-between group'>
            <div className='flex items-center space-x-2'>
              <h2 className='text-lg font-semibold text-gray-700'>
                {column.title}
              </h2>
            </div>
            <MenuDropdown
              trigger={
                <IconButton
                  onClick={() => {}}
                  className='opacity-0 group-hover:opacity-100'
                  size='sm'
                  title='Column options'
                >
                  <span className='text-gray-500'>⋯</span>
                </IconButton>
              }
              options={[
                {
                  label: 'Edit Title',
                  onClick: () => {
                    const newTitle = prompt(
                      'Enter new column title:',
                      column.title
                    );
                    if (newTitle && newTitle.trim() !== column.title) {
                      handleColumnTitleEdit(column.id, newTitle.trim());
                    }
                  },
                },
                {
                  label: 'Delete Column',
                  onClick: () => handleColumnDelete(column.id),
                  variant: 'danger',
                },
              ]}
            />
          </div>

          {/* Column movement buttons */}
          <div className='flex justify-center space-x-2 mt-2'>
            <IconButton
              onClick={() => handleMoveColumnLeft(column.id)}
              disabled={
                sortedColumns.findIndex(col => col.id === column.id) === 0
              }
              size='md'
              title='Move column left'
              className='bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed w-32'
            >
              <span className='text-gray-600'>←</span>
            </IconButton>
            <IconButton
              onClick={() => handleMoveColumnRight(column.id)}
              disabled={
                sortedColumns.findIndex(col => col.id === column.id) ===
                sortedColumns.length - 1
              }
              size='md'
              title='Move column right'
              className='bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed w-32'
            >
              <span className='text-gray-600'>→</span>
            </IconButton>
          </div>
        </div>

        <TemplateSectionDropZone
          column={column}
          columnSections={columnSections}
          isColumnDragging={isColumnCurrentlyDragged}
          onContentChange={onContentChange}
          onSectionDelete={handleSectionDelete}
          onTemplateChange={onTemplateChange}
        />
      </div>
    );
  };

  // Section drop zone component for template editing
  const TemplateSectionDropZone: React.FC<{
    column: Column;
    columnSections: SectionWithContent[];
    isColumnDragging: boolean;
    onContentChange: (sectionId: string, content: string) => void;
    onSectionDelete: (sectionId: string) => void;
    onTemplateChange: () => void;
  }> = ({
    column,
    columnSections,
    isColumnDragging,
    onContentChange,
    onSectionDelete,
    onTemplateChange,
  }) => {
    const { setNodeRef, isOver } = useDroppable({
      id: `column-drop-${column.id}`,
      data: {
        type: 'column',
        columnId: column.id,
      },
    });

    const { activeItemData } = useDragContext();

    // Check if a section is being dragged over this column area
    const isSectionDragTarget =
      isOver &&
      activeItemData?.itemType === 'section' &&
      (activeItemData as any)?.column_id !== column.id;

    return (
      <div
        ref={setNodeRef}
        className={`min-h-full ${
          isSectionDragTarget
            ? 'bg-green-100 border-green-400 border-2 border-dashed rounded-lg'
            : ''
        }`}
        style={{ pointerEvents: isColumnDragging ? 'none' : 'auto' }}
      >
        <SortableContext
          items={columnSections.map(s => s.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className='space-y-6 min-h-full'>
            {columnSections.map(section => (
              <SectionContainer
                key={section.id}
                section={section}
                content={section.content}
                onContentChange={onContentChange}
                isEditMode={true}
                onSectionDelete={() => onSectionDelete(section.id)}
                onUpdate={onTemplateChange}
                openPropertiesSectionId={openPropertiesSectionId}
                onSectionPropertiesOpen={() =>
                  handleSectionPropertiesOpen(section.id)
                }
                onSectionPropertiesClose={handleSectionPropertiesClose}
              />
            ))}

            <AddSectionButton
              columnId={column.id}
              onSectionAdded={onTemplateChange}
            />

            {/* Drop zone for empty space in column */}
            <div className='flex-1 min-h-20' />
          </div>
        </SortableContext>
      </div>
    );
  };

  const groupedSections = groupSectionsByColumn();
  const sortedColumns = columns.sort(
    (a, b) => a.display_order - b.display_order
  );

  return (
    <div className='w-full h-full'>
      <div
        ref={scrollContainerRef}
        className='flex gap-6 p-4 overflow-x-auto overflow-y-hidden scrollbar-hide h-full'
        data-testid='template-edit-layout'
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          userSelect: isDragging ? 'none' : 'auto',
          WebkitUserSelect: isDragging ? 'none' : 'auto',
        }}
      >
        {sortedColumns.map(column => (
          <DraggableTemplateColumn
            key={column.id}
            column={column}
            columnSections={groupedSections[column.id] || []}
          />
        ))}

        <AddColumnButton onColumnAdded={onTemplateChange} />
      </div>
    </div>
  );
};

const TemplateEditLayout: React.FC<TemplateEditLayoutProps> = props => {
  return (
    <DragDropProvider
      columns={props.columns}
      sections={props.sections}
      onTemplateChange={props.onTemplateChange}
    >
      <TemplateEditLayoutContent {...props} />
    </DragDropProvider>
  );
};

export default TemplateEditLayout;
