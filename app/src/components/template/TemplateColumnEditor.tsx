import React, { useState } from 'react';
import { Column } from '../../services/api';

interface TemplateColumnEditorProps {
  columns: Column[];
  onCreateColumn: (
    column: Omit<Column, 'created_at' | 'updated_at'>
  ) => Promise<void>;
  onUpdateColumn: (id: string, column: Partial<Column>) => Promise<void>;
  onDeleteColumn: (id: string) => Promise<void>;
  editingColumn: Column | null;
  setEditingColumn: (column: Column | null) => void;
  showForm: boolean;
  setShowForm: (show: boolean) => void;
}

const TemplateColumnEditor: React.FC<TemplateColumnEditorProps> = ({
  columns,
  onCreateColumn,
  onUpdateColumn,
  onDeleteColumn,
  editingColumn,
  setEditingColumn,
  showForm,
  setShowForm,
}) => {
  const [formData, setFormData] = useState({
    id: '',
    title: '',
    width: 500,
    display_order: 1,
  });

  const resetForm = () => {
    setFormData({
      id: '',
      title: '',
      width: 500,
      display_order: Math.max(...columns.map(c => c.display_order), 0) + 1,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (editingColumn) {
      await onUpdateColumn(editingColumn.id, formData);
    } else {
      await onCreateColumn(formData);
      resetForm();
    }
  };

  const handleEdit = (column: Column) => {
    setEditingColumn(column);
    setFormData({
      id: column.id,
      title: column.title,
      width: column.width,
      display_order: column.display_order,
    });
    setShowForm(true);
  };

  const handleCancel = () => {
    setEditingColumn(null);
    setShowForm(false);
    resetForm();
  };

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='flex justify-between items-center'>
        <h2 className='text-lg font-medium text-gray-900'>
          Column Configuration
        </h2>
        <button
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
          className='px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
        >
          Add Column
        </button>
      </div>

      {/* Column list */}
      <div className='bg-white shadow overflow-hidden sm:rounded-md'>
        <ul className='divide-y divide-gray-200'>
          {columns.map(column => (
            <li key={column.id}>
              <div className='px-4 py-4 flex items-center justify-between'>
                <div className='flex-1'>
                  <div className='flex items-center justify-between'>
                    <p className='text-sm font-medium text-gray-900'>
                      {column.title}
                    </p>
                    <div className='ml-2 flex-shrink-0 flex'>
                      <p className='px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800'>
                        Order: {column.display_order}
                      </p>
                    </div>
                  </div>
                  <div className='mt-2 flex items-center text-sm text-gray-500'>
                    <span>ID: {column.id}</span>
                    <span className='mx-2'>•</span>
                    <span>Width: {column.width}px</span>
                  </div>
                </div>
                <div className='ml-4 flex-shrink-0 flex space-x-2'>
                  <button
                    onClick={() => handleEdit(column)}
                    className='text-blue-600 hover:text-blue-900 text-sm font-medium'
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => onDeleteColumn(column.id)}
                    className='text-red-600 hover:text-red-900 text-sm font-medium'
                  >
                    Delete
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Form modal */}
      {showForm && (
        <div className='fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50'>
          <div className='relative top-20 mx-auto p-5 border shadow-lg rounded-md bg-white max-w-md w-full max-w-[calc(100vw-2rem)]'>
            <div className='mt-3'>
              <h3 className='text-lg font-medium text-gray-900 mb-4'>
                {editingColumn ? 'Edit Column' : 'Add New Column'}
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
                    disabled={!!editingColumn}
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
                    htmlFor='width'
                    className='block text-sm font-medium text-gray-700'
                  >
                    Width (px)
                  </label>
                  <input
                    type='number'
                    id='width'
                    value={formData.width}
                    onChange={e =>
                      setFormData({
                        ...formData,
                        width: parseInt(e.target.value),
                      })
                    }
                    className='mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm'
                    required
                    min='100'
                  />
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
                    {editingColumn ? 'Update' : 'Create'}
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

export default TemplateColumnEditor;
