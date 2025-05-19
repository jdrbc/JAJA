import React, { useRef } from 'react';
import SectionContainer from '../sections/SectionContainer';
import { Column, SectionWithContent, JournalEntry } from '../../services/api';

interface ColumnLayoutProps {
  columns: Column[];
  sections: SectionWithContent[];
  entry: JournalEntry | null;
  onContentChange: (sectionId: string, content: string) => void;
}

const ColumnLayout: React.FC<ColumnLayoutProps> = ({
  columns,
  sections,
  entry,
  onContentChange,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const groupSectionsByColumn = () => {
    const grouped: Record<string, SectionWithContent[]> = {};

    columns.forEach(column => {
      grouped[column.id] = sections
        .filter(section => section.column_id === column.id)
        .sort((a, b) => a.display_order - b.display_order);
    });

    return grouped;
  };

  const renderColumn = (
    column: Column,
    columnSections: SectionWithContent[]
  ) => {
    return (
      <div
        key={column.id}
        className='flex-shrink-0 scroll-snap-align-start scroll-snap-stop-always h-full pr-4 pl-4 border-r border-gray-200 bg-white last:border-r-0 last:mr-4 shadow-sm overflow-y-auto'
        style={{ width: `${column.width}px` }}
      >
        <div className='sticky top-0 bg-white z-10 pb-2'>
          <h2 className='text-lg font-semibold text-gray-700'>
            {column.title}
          </h2>
        </div>

        <div className='space-y-6'>
          {columnSections.map(section => (
            <SectionContainer
              key={section.id}
              section={section}
              content={section.content}
              onContentChange={onContentChange}
              isEditMode={false}
            />
          ))}
        </div>
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
        className='flex gap-6 p-4 overflow-x-auto overflow-y-hidden scroll-smooth snap-x snap-mandatory scrollbar-hide h-full'
        data-testid='column-layout'
        style={{
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >
        {sortedColumns.map(column =>
          renderColumn(column, groupedSections[column.id] || [])
        )}
      </div>
    </div>
  );
};

export default ColumnLayout;
