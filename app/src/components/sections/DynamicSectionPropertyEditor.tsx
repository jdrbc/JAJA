import React, { useState } from 'react';
import { SectionTemplate } from '../../services/api';
import { localApiService } from '../../services/localApi';
import { SectionRegistry } from './core/SectionRegistry';
import logger from '../../utils/logger';

interface DynamicSectionPropertyEditorProps {
  section: SectionTemplate;
  onClose: () => void;
  onUpdate?: () => void;
}

const DynamicSectionPropertyEditor: React.FC<
  DynamicSectionPropertyEditorProps
> = ({ section, onClose, onUpdate }) => {
  const registry = SectionRegistry.getInstance();
  const definition = registry.get(section.content_type);
  const [formData, setFormData] = useState<Record<string, any>>({
    title: section.title,
    placeholder: section.placeholder,
    refresh_frequency: section.refresh_frequency,
    content_type: section.content_type,
  });

  const fields = definition?.getPropertyFields() || [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await localApiService.updateTemplateSection(section.id, formData);
      onUpdate?.();
      onClose();
    } catch (error) {
      logger.error('Failed to update section:', error);
    }
  };

  const renderField = (field: any) => {
    const commonProps = {
      value: formData[field.key] || '',
      onChange: (e: React.ChangeEvent<any>) =>
        setFormData(prev => ({ ...prev, [field.key]: e.target.value })),
      className: 'w-full p-2 border border-gray-300 rounded-md',
      required: field.required,
    };

    switch (field.type) {
      case 'select':
        return (
          <select {...commonProps}>
            {field.options?.map((option: any) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        );
      case 'textarea':
        return (
          <textarea {...commonProps} placeholder={field.placeholder} rows={3} />
        );
      case 'checkbox':
        return (
          <input
            type='checkbox'
            checked={!!formData[field.key]}
            onChange={e =>
              setFormData(prev => ({
                ...prev,
                [field.key]: e.target.checked,
              }))
            }
            className='rounded border-gray-300'
            required={field.required}
          />
        );
      case 'number':
        return <input {...commonProps} type='number' />;
      default:
        return (
          <input {...commonProps} type='text' placeholder={field.placeholder} />
        );
    }
  };

  return (
    <div className='p-4 bg-white border rounded-md'>
      <form onSubmit={handleSubmit} className='space-y-4'>
        {fields.map(field => (
          <div key={field.key}>
            <label className='block text-sm font-medium text-gray-700 mb-1'>
              {field.label}
              {field.required && <span className='text-red-500 ml-1'>*</span>}
            </label>
            {renderField(field)}
          </div>
        ))}

        <div className='flex justify-end space-x-2 pt-4 border-t'>
          <button
            type='button'
            onClick={onClose}
            className='px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200'
          >
            Cancel
          </button>
          <button
            type='submit'
            className='px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700'
          >
            Save Changes
          </button>
        </div>
      </form>
    </div>
  );
};

export default DynamicSectionPropertyEditor;
