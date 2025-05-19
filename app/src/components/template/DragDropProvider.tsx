import React, { useState, createContext, useContext } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  useSensor,
  useSensors,
  rectIntersection,
  MouseSensor,
  TouchSensor,
} from '@dnd-kit/core';
import {
  Column,
  SectionTemplate,
  SectionWithContent,
} from '../../services/api';
import { useTemplateManagement } from '../../hooks/useTemplateManagement';
import { logger } from '../../utils/logger';

// Define a type for the active item's data to be more specific
type ActiveDragItemData =
  | ({ itemType: 'column' } & Column)
  | ({ itemType: 'section' } & (SectionTemplate | SectionWithContent));

interface DragContextType {
  isDragging: boolean;
  activeId: string | null;
  activeItemData: ActiveDragItemData | null;
}

const DragContext = createContext<DragContextType>({
  isDragging: false,
  activeId: null,
  activeItemData: null,
});

export const useDragContext = () => useContext(DragContext);

interface DragDropProviderProps {
  children: React.ReactNode;
  columns: Column[];
  sections: (SectionTemplate | SectionWithContent)[];
  onTemplateChange: () => void;
}

const DragDropProvider: React.FC<DragDropProviderProps> = ({
  children,
  columns,
  sections,
  onTemplateChange,
}) => {
  const { reorderColumns, reorderSections, moveSectionToColumn } =
    useTemplateManagement();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeItemData, setActiveItemData] =
    useState<ActiveDragItemData | null>(null);

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const activeId = active.id as string;
    setActiveId(activeId);

    // Check if we're dragging a column
    const activeColumn = columns.find(c => c.id === activeId);
    if (activeColumn) {
      setActiveItemData({
        ...activeColumn,
        itemType: 'column',
      });
      return;
    }

    // Check if we're dragging a section
    const activeSection = sections.find(s => s.id === activeId);
    if (activeSection) {
      setActiveItemData({
        ...activeSection,
        itemType: 'section',
      });
      return;
    }

    // Fallback to data from the drag event
    if (active.data.current?.type === 'column') {
      const columnData = active.data.current.column as Column;
      setActiveItemData({
        ...columnData,
        itemType: 'column',
      });
    } else if (active.data.current?.type === 'section') {
      setActiveItemData({
        ...(active.data.current.section as
          | SectionTemplate
          | SectionWithContent),
        itemType: 'section',
      });
    } else {
      setActiveItemData(null);
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Check if we're dragging a column
    const activeColumn = columns.find(c => c.id === activeId);
    if (activeColumn) {
      let targetColumnId = overId;

      // If hovering over a section, find its parent column
      const overSection = sections.find(s => s.id === overId);
      if (overSection && overSection.column_id) {
        targetColumnId = overSection.column_id;
      }

      // If hovering over a column drop zone, extract the column ID
      if (overId.startsWith('column-drop-')) {
        targetColumnId = overId.replace('column-drop-', '');
      }

      // Perform immediate reordering if we're over a different column
      const targetColumn = columns.find(c => c.id === targetColumnId);
      if (targetColumn && activeId !== targetColumnId) {
        const sortedColumns = [...columns].sort(
          (a, b) => a.display_order - b.display_order
        );
        const oldIndex = sortedColumns.findIndex(c => c.id === activeId);
        const newIndex = sortedColumns.findIndex(c => c.id === targetColumnId);

        if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
          const newColumns = [...sortedColumns];
          const [movedColumn] = newColumns.splice(oldIndex, 1);
          newColumns.splice(newIndex, 0, movedColumn);

          // Update display_order for all columns
          const updatedColumns = newColumns.map((column, index) => ({
            ...column,
            display_order: index,
          }));

          // Perform immediate reordering
          reorderColumns(updatedColumns).then(() => {
            onTemplateChange();
          });
        }
      }

      return;
    }

    // Check if we're dragging a section
    const activeSection = sections.find(s => s.id === activeId);
    if (!activeSection) return;

    // Check if we're over a column (for moving between columns)
    const overColumn = columns.find(c => c.id === overId);
    if (overColumn && activeSection.column_id !== overId) {
      // Move section to different column
      moveSectionToColumn(activeId, overId).then(() => {
        onTemplateChange();
      });
      return;
    }

    // Check if we're over a column drop zone
    if (overId.startsWith('column-drop-')) {
      const targetColumnId = overId.replace('column-drop-', '');
      if (activeSection.column_id !== targetColumnId) {
        moveSectionToColumn(activeId, targetColumnId).then(() => {
          onTemplateChange();
        });
        return;
      }
    }

    // Check if we're over another section (for reordering within same column)
    const overSection = sections.find(s => s.id === overId);
    if (
      overSection &&
      activeSection.column_id === overSection.column_id &&
      activeId !== overId
    ) {
      // We're reordering within the same column - this will be handled in dragEnd
      // but we can provide visual feedback here if needed
      logger.log('Reordering sections within column:', activeSection.column_id);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    logger.log('Drag end - active:', active.id, 'over:', over?.id);

    if (!over) {
      logger.log('No over target found');
      setActiveId(null);
      setActiveItemData(null);
      return;
    }

    const activeId = active.id as string;
    const overId = over.id as string;

    if (activeId === overId) {
      logger.log('Dropped on same item');
      setActiveId(null);
      setActiveItemData(null);
      return;
    }

    const activeColumn = columns.find(c => c.id === activeId);
    const activeSection = sections.find(s => s.id === activeId);

    // --- Column Reordering Logic ---
    if (activeColumn) {
      // Column reordering is now handled in dragOver, so we just clean up here
      setActiveId(null);
      setActiveItemData(null);
      return;
    }

    // --- Section Reordering and Moving Logic ---
    if (activeSection) {
      const overSection = sections.find(s => s.id === overId);

      if (overSection) {
        // If sections are in different columns, move to the target column
        if (activeSection.column_id !== overSection.column_id) {
          await moveSectionToColumn(activeId, overSection.column_id || '');
          onTemplateChange();
          setActiveId(null);
          setActiveItemData(null);
          return;
        }

        // If sections are in the same column, reorder them
        if (activeSection.column_id === overSection.column_id) {
          const columnSections = sections
            .filter(s => s.column_id === activeSection.column_id)
            .sort((a, b) => a.display_order - b.display_order);

          const oldIndex = columnSections.findIndex(s => s.id === activeId);
          const newIndex = columnSections.findIndex(s => s.id === overId);

          if (oldIndex !== -1 && newIndex !== -1) {
            const newSections = [...columnSections];
            const [movedSection] = newSections.splice(oldIndex, 1);
            newSections.splice(newIndex, 0, movedSection);

            // Update display_order for sections in this column
            const updatedSections = newSections.map((section, index) => ({
              ...section,
              display_order: index,
            }));

            await reorderSections(updatedSections);
            onTemplateChange();
          }
        }
      } else {
        // Handle case: dropping a section onto a column (not on another section)
        let targetColumnId: string | undefined = undefined;

        // Check if dropping directly onto a column
        const overColumn = columns.find(c => c.id === overId);
        if (overColumn) {
          targetColumnId = overId;
        }
        // Check if dropping onto a column's designated drop zone
        else if (overId.startsWith('column-drop-')) {
          targetColumnId = overId.replace('column-drop-', '');
        }

        if (targetColumnId && activeSection.column_id !== targetColumnId) {
          await moveSectionToColumn(activeId, targetColumnId);
          onTemplateChange();
        }
      }
    }

    // Cleanup
    setActiveId(null);
    setActiveItemData(null);
  };

  const handleDragCancel = () => {
    setActiveId(null);
    setActiveItemData(null);
  };

  const dragContextValue: DragContextType = {
    isDragging: activeId !== null,
    activeId,
    activeItemData,
  };

  return (
    <DragContext.Provider value={dragContextValue}>
      <DndContext
        sensors={sensors}
        collisionDetection={rectIntersection}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        {children}
      </DndContext>
    </DragContext.Provider>
  );
};

export default DragDropProvider;
