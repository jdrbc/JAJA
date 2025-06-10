import React, { useState } from 'react';
import { SectionTemplate, Column } from '../../services/api';
import { SectionRegistry } from '../sections/core/SectionRegistry';

interface TemplateSectionEditorProps {
  sections: SectionTemplate[];
  columns: Column[];
  onCreateSection: (
    section: Omit<SectionTemplate, 'created_at' | 'updated_at'>
  ) => Promise<void>;
  onUpdateSection: (
    id: string,
    section: Partial<SectionTemplate>
  ) => Promise<void>;
  onDeleteSection: (id: string) => Promise<void>;
  editingSection: SectionTemplate | null;
  setEditingSection: (section: SectionTemplate | null) => void;
  showForm: boolean;
  setShowForm: (show: boolean) => void;
}

const TemplateSectionEditor: React.FC<TemplateSectionEditorProps> = ({
  sections,
  columns,
  onCreateSection,
  onUpdateSection,
  onDeleteSection,
  editingSection,
  setEditingSection,
  showForm,
  setShowForm,
}) => {
  // Get section types from registry
  const registry = SectionRegistry.getInstance();
  const sectionTypes = registry.getAllTypes();

  // Helper function to get default values from section definition
  const getDefaultValues = (contentType: string) => {
    const definition = registry.get(contentType);
    if (!definition) {
      return {
        title: '',
        placeholder: '',
        refresh_frequency: 'daily',
        default_content: '',
      };
    }

    const propertyFields = definition.getPropertyFields();
    const defaults: Record<string, any> = {};

    propertyFields.forEach(field => {
      if (field.defaultValue !== undefined) {
        defaults[field.key] = field.defaultValue;
      }
    });

    return {
      title: defaults.title || '',
      placeholder: defaults.placeholder || '',
      refresh_frequency: defaults.refresh_frequency || 'daily',
      default_content: definition.getDefaultContent() || '',
    };
  };

  const [formData, setFormData] = useState<
    Omit<SectionTemplate, 'created_at' | 'updated_at'>
  >(() => {
    const defaultValues = getDefaultValues('text');
    return {
      id: '',
      title: defaultValues.title,
      refresh_frequency: defaultValues.refresh_frequency,
      display_order: Math.max(0, ...sections.map(s => s.display_order)) + 1,
      placeholder: defaultValues.placeholder,
      default_content: defaultValues.default_content,
      content_type: 'text',
      configuration: '',
      column_id: '',
    };
  });

  const resetForm = () => {
    const defaultValues = getDefaultValues('text');
    setFormData({
      id: '',
      title: defaultValues.title,
      refresh_frequency: defaultValues.refresh_frequency,
      display_order: Math.max(...sections.map(s => s.display_order), 0) + 1,
      placeholder: defaultValues.placeholder,
      default_content: defaultValues.default_content,
      content_type: 'text',
      configuration: '',
      column_id: columns.length > 0 ? columns[0].id : '',
    });
  };

  // Update form when content type changes
  const handleContentTypeChange = (newContentType: string) => {
    const defaultValues = getDefaultValues(newContentType);
    setFormData(prev => ({
      ...prev,
      content_type: newContentType,
      // Only update these if they haven't been manually set
      title: prev.title || defaultValues.title,
      placeholder: prev.placeholder || defaultValues.placeholder,
      // Only update refresh_frequency if it's currently set to a default value
      // and the user hasn't manually changed it for this section
      refresh_frequency:
        !editingSection ||
        prev.refresh_frequency ===
          getDefaultValues(prev.content_type).refresh_frequency
          ? defaultValues.refresh_frequency
          : prev.refresh_frequency,
      default_content: defaultValues.default_content,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (editingSection) {
      await onUpdateSection(editingSection.id, formData);
    } else {
      await onCreateSection(formData);
      resetForm();
    }
  };

  const handleEdit = (section: SectionTemplate) => {
    setEditingSection(section);
    setFormData({
      id: section.id,
      title: section.title,
      refresh_frequency: section.refresh_frequency,
      display_order: section.display_order,
      placeholder: section.placeholder || '',
      default_content: section.default_content || '',
      content_type: section.content_type || 'text',
      configuration: section.configuration || '',
      column_id: section.column_id || '',
    });
    setShowForm(true);
  };

  const handleCancel = () => {
    setEditingSection(null);
    setShowForm(false);
    resetForm();
  };

  const getColumnName = (columnId: string) => {
    const column = columns.find(c => c.id === columnId);
    return column ? column.title : 'No Column';
  };

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='flex justify-between items-center'>
        <h2 className='text-lg font-medium text-gray-900'>
          Section Configuration
        </h2>
        <button
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
          className='px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
        >
          Add Section
        </button>
      </div>

      {/* Section list */}
      <div className='bg-white shadow overflow-hidden sm:rounded-md'>
        <ul className='divide-y divide-gray-200'>
          {sections.map(section => (
            <li key={section.id}>
              <div className='px-4 py-4'>
                <div className='flex items-center justify-between'>
                  <div className='flex-1'>
                    <div className='flex items-center justify-between'>
                      <p className='text-sm font-medium text-gray-900'>
                        {section.title}
                      </p>
                      <div className='ml-2 flex-shrink-0 flex space-x-2'>
                        <span className='px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800'>
                          {section.refresh_frequency}
                        </span>
                        <span className='px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800'>
                          Order: {section.display_order}
                        </span>
                      </div>
                    </div>
                    <div className='mt-2 flex items-center text-sm text-gray-500'>
                      <span>ID: {section.id}</span>
                      <span className='mx-2'>•</span>
                      <span>Type: {section.content_type}</span>
                      <span className='mx-2'>•</span>
                      <span>
                        Column: {getColumnName(section.column_id || '')}
                      </span>
                    </div>
                    {section.placeholder && (
                      <div className='mt-1 text-sm text-gray-400'>
                        Placeholder: {section.placeholder}
                      </div>
                    )}
                  </div>
                  <div className='ml-4 flex-shrink-0 flex space-x-2'>
                    <button
                      onClick={() => handleEdit(section)}
                      className='text-blue-600 hover:text-blue-900 text-sm font-medium'
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => onDeleteSection(section.id)}
                      className='text-red-600 hover:text-red-900 text-sm font-medium'
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Form modal */}
      {showForm && (
        <div className='fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50'>
          <div className='relative top-10 mx-auto p-5 border shadow-lg rounded-md bg-white max-h-screen overflow-y-auto max-w-md w-full max-w-[calc(100vw-2rem)]'>
            <div className='mt-3'>
              <h3 className='text-lg font-medium text-gray-900 mb-4'>
                {editingSection ? 'Edit Section' : 'Add New Section'}
              </h3>

              <form onSubmit={handleSubmit} className='space-y-4'>
                <div>
                  <label
                    htmlFor='id'
                    className='block text-sm font-medium text-gray-700'
                  >
                    ID
                  </label>
                  <input
                    type='text'
                    id='id'
                    value={formData.id}
                    onChange={e =>
                      setFormData({ ...formData, id: e.target.value })
                    }
                    disabled={!!editingSection}
                    className='mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100'
                    required
                  />
                </div>

                <div>
                  <label
                    htmlFor='title'
                    className='block text-sm font-medium text-gray-700'
                  >
                    Title
                  </label>
                  <input
                    type='text'
                    id='title'
                    value={formData.title}
                    onChange={e =>
                      setFormData({ ...formData, title: e.target.value })
                    }
                    className='mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm'
                    required
                  />
                </div>

                <div>
                  <label
                    htmlFor='refresh_frequency'
                    className='block text-sm font-medium text-gray-700'
                  >
                    Refresh Frequency
                  </label>
                  <select
                    id='refresh_frequency'
                    value={formData.refresh_frequency}
                    onChange={e =>
                      setFormData({
                        ...formData,
                        refresh_frequency: e.target.value,
                      })
                    }
                    className='mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm'
                    required
                  >
                    <option value='daily'>Daily</option>
                    <option value='weekly'>Weekly</option>
                    <option value='monthly'>Monthly</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor='content_type'
                    className='block text-sm font-medium text-gray-700'
                  >
                    Content Type
                  </label>
                  <select
                    id='content_type'
                    value={formData.content_type}
                    onChange={e => handleContentTypeChange(e.target.value)}
                    className='mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm'
                    required
                  >
                    {sectionTypes.map(type => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor='column_id'
                    className='block text-sm font-medium text-gray-700'
                  >
                    Column
                  </label>
                  <select
                    id='column_id'
                    value={formData.column_id}
                    onChange={e =>
                      setFormData({ ...formData, column_id: e.target.value })
                    }
                    className='mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm'
                  >
                    <option value=''>No Column</option>
                    {columns.map(column => (
                      <option key={column.id} value={column.id}>
                        {column.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor='display_order'
                    className='block text-sm font-medium text-gray-700'
                  >
                    Display Order
                  </label>
                  <input
                    type='number'
                    id='display_order'
                    value={formData.display_order}
                    onChange={e =>
                      setFormData({
                        ...formData,
                        display_order: parseInt(e.target.value),
                      })
                    }
                    className='mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm'
                    required
                    min='1'
                  />
                </div>

                <div>
                  <label
                    htmlFor='placeholder'
                    className='block text-sm font-medium text-gray-700'
                  >
                    Placeholder Text
                  </label>
                  <textarea
                    id='placeholder'
                    value={formData.placeholder}
                    onChange={e =>
                      setFormData({ ...formData, placeholder: e.target.value })
                    }
                    rows={2}
                    className='mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm'
                  />
                </div>

                <div>
                  <label
                    htmlFor='default_content'
                    className='block text-sm font-medium text-gray-700'
                  >
                    Default Content
                  </label>
                  <textarea
                    id='default_content'
                    value={formData.default_content}
                    onChange={e =>
                      setFormData({
                        ...formData,
                        default_content: e.target.value,
                      })
                    }
                    rows={3}
                    className='mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm'
                  />
                </div>

                <div className='flex justify-end space-x-3 pt-4'>
                  <button
                    type='button'
                    onClick={handleCancel}
                    className='px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
                  >
                    Cancel
                  </button>
                  <button
                    type='submit'
                    className='px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
                  >
                    {editingSection ? 'Update' : 'Create'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TemplateSectionEditor;
