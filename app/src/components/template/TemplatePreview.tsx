import React from 'react';
import { SectionTemplate, Column } from '../../services/api';

interface TemplatePreviewProps {
  columns: Column[];
  sections: SectionTemplate[];
}

const TemplatePreview: React.FC<TemplatePreviewProps> = ({
  columns,
  sections,
}) => {
  const getSectionsForColumn = (columnId: string) => {
    return sections
      .filter(section => section.column_id === columnId)
      .sort((a, b) => a.display_order - b.display_order);
  };

  const getUnassignedSections = () => {
    return sections
      .filter(section => !section.column_id)
      .sort((a, b) => a.display_order - b.display_order);
  };

  const renderSectionPreview = (section: SectionTemplate) => {
    const getContentPreview = () => {
      switch (section.content_type) {
        case 'header':
          return (
            <div className='text-lg font-semibold text-gray-800 border-b border-gray-200 pb-2'>
              {section.title}
            </div>
          );
        case 'todo':
          return (
            <div className='space-y-2'>
              <div className='flex items-center space-x-2'>
                <input type='checkbox' className='rounded' disabled />
                <span className='text-gray-600'>Sample todo item</span>
              </div>
              <div className='flex items-center space-x-2'>
                <input type='checkbox' className='rounded' disabled />
                <span className='text-gray-600'>Another todo item</span>
              </div>
            </div>
          );
        default:
          return (
            <div className='text-gray-600'>
              {section.placeholder || 'Sample text content...'}
            </div>
          );
      }
    };

    return (
      <div
        key={section.id}
        className='bg-white border border-gray-200 rounded-lg p-4 mb-4'
      >
        <div className='flex justify-between items-start mb-3'>
          <h3 className='text-sm font-medium text-gray-900'>{section.title}</h3>
          <div className='flex space-x-1'>
            <span className='px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded'>
              {section.refresh_frequency}
            </span>
            <span className='px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded'>
              {section.content_type}
            </span>
          </div>
        </div>
        {getContentPreview()}
      </div>
    );
  };

  const sortedColumns = columns.sort(
    (a, b) => a.display_order - b.display_order
  );
  const unassignedSections = getUnassignedSections();

  return (
    <div className='space-y-6'>
      <div className='flex justify-between items-center'>
        <h2 className='text-lg font-medium text-gray-900'>Template Preview</h2>
        <div className='text-sm text-gray-500'>
          This shows how your journal layout will appear
        </div>
      </div>

      {/* Column layout preview */}
      {sortedColumns.length > 0 ? (
        <div className='flex space-x-6 overflow-x-auto'>
          {sortedColumns.map(column => {
            const columnSections = getSectionsForColumn(column.id);
            return (
              <div
                key={column.id}
                className='flex-shrink-0 bg-gray-50 rounded-lg p-4'
                style={{ width: `${column.width}px`, minWidth: '300px' }}
              >
                <div className='flex justify-between items-center mb-4'>
                  <h3 className='text-lg font-semibold text-gray-800'>
                    {column.title}
                  </h3>
                  <span className='text-xs text-gray-500'>
                    {column.width}px
                  </span>
                </div>

                {columnSections.length > 0 ? (
                  <div className='space-y-4'>
                    {columnSections.map(renderSectionPreview)}
                  </div>
                ) : (
                  <div className='text-center py-8 text-gray-400'>
                    No sections assigned to this column
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className='text-center py-8 text-gray-400 bg-gray-50 rounded-lg'>
          No columns configured
        </div>
      )}

      {/* Unassigned sections */}
      {unassignedSections.length > 0 && (
        <div className='mt-8'>
          <h3 className='text-lg font-medium text-gray-900 mb-4'>
            Unassigned Sections
          </h3>
          <div className='bg-yellow-50 border border-yellow-200 rounded-lg p-4'>
            <div className='flex items-center mb-3'>
              <div className='flex-shrink-0'>
                <svg
                  className='h-5 w-5 text-yellow-400'
                  viewBox='0 0 20 20'
                  fill='currentColor'
                >
                  <path
                    fillRule='evenodd'
                    d='M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z'
                    clipRule='evenodd'
                  />
                </svg>
              </div>
              <div className='ml-3'>
                <h4 className='text-sm font-medium text-yellow-800'>
                  These sections are not assigned to any column
                </h4>
                <p className='text-sm text-yellow-700'>
                  Assign them to columns or they won't appear in the journal
                  layout.
                </p>
              </div>
            </div>
            <div className='space-y-2'>
              {unassignedSections.map(renderSectionPreview)}
            </div>
          </div>
        </div>
      )}

      {/* Summary stats */}
      <div className='bg-white border border-gray-200 rounded-lg p-4'>
        <h3 className='text-lg font-medium text-gray-900 mb-3'>
          Template Summary
        </h3>
        <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
          <div className='text-center'>
            <div className='text-2xl font-bold text-blue-600'>
              {columns.length}
            </div>
            <div className='text-sm text-gray-500'>Columns</div>
          </div>
          <div className='text-center'>
            <div className='text-2xl font-bold text-green-600'>
              {sections.length}
            </div>
            <div className='text-sm text-gray-500'>Total Sections</div>
          </div>
          <div className='text-center'>
            <div className='text-2xl font-bold text-purple-600'>
              {sections.filter(s => s.column_id).length}
            </div>
            <div className='text-sm text-gray-500'>Assigned Sections</div>
          </div>
          <div className='text-center'>
            <div className='text-2xl font-bold text-orange-600'>
              {unassignedSections.length}
            </div>
            <div className='text-sm text-gray-500'>Unassigned Sections</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TemplatePreview;
