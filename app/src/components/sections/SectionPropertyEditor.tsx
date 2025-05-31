import React, { useState, useCallback } from 'react';
import { SectionTemplate } from '../../services/api';
import { useTemplateManagement } from '../../hooks/useTemplateManagement';
import { createDebouncedSectionSave } from '../../utils/debounceUtils';

interface SectionPropertyEditorProps {
  section: SectionTemplate;
  onClose: () => void;
  onUpdate?: () => void;
  customFields?: PropertyFieldConfig[];
}

type EditablePropertyKey =
  | 'title'
  | 'placeholder'
  | 'default_content'
  | 'refresh_frequency'
  | 'content_type';

export interface PropertyFieldConfig {
  key: EditablePropertyKey;
  label: string;
  type: 'text' | 'textarea' | 'select';
  options?: { value: string; label: string }[];
  rows?: number;
  placeholder?: string;
}

const BaseSectionPropertyEditor: React.FC<SectionPropertyEditorProps> = ({
  section,
  onClose,
  onUpdate,
  customFields,
}) => {
  const { updateSectionSilent } = useTemplateManagement();
  const [localValues, setLocalValues] = useState({
    title: section.title,
    placeholder: section.placeholder || '',
    default_content: section.default_content || '',
    refresh_frequency: section.refresh_frequency,
    content_type: section.content_type,
  });

  // Create debounced save function using the utility with silent update
  const debouncedSave = useCallback(() => {
    return createDebouncedSectionSave(updateSectionSilent, section.id);
  }, [updateSectionSilent, section.id]);

  const handleFieldChange = (field: EditablePropertyKey, value: string) => {
    setLocalValues(prev => ({ ...prev, [field]: value }));
    debouncedSave()(field, value);
  };

  // Default fields - can be overridden by customFields prop
  const getDefaultPropertyFields = (): PropertyFieldConfig[] => [
    {
      key: 'title',
      label: 'Title',
      type: 'text',
      placeholder: 'Section title',
    },
    {
      key: 'content_type',
      label: 'Content Type',
      type: 'select',
      options: [
        { value: 'text', label: 'Text Section' },
        { value: 'todo', label: 'Todo List' },
        { value: 'header', label: 'Header Section' },
      ],
    },
    {
      key: 'placeholder',
      label: 'Placeholder Text',
      type: 'textarea',
      rows: 2,
      placeholder: 'Placeholder text shown when empty',
    },
    {
      key: 'default_content',
      label: 'Default Content',
      type: 'textarea',
      rows: 3,
      placeholder: 'Default content for new entries',
    },
    {
      key: 'refresh_frequency',
      label: 'Refresh Frequency',
      type: 'select',
      options: [
        { value: 'daily', label: 'Daily' },
        { value: 'weekly', label: 'Weekly' },
        { value: 'monthly', label: 'Monthly' },
      ],
    },
  ];

  const renderField = (config: PropertyFieldConfig) => {
    const value = localValues[config.key];

    switch (config.type) {
      case 'text':
        return (
          <input
            type='text'
            value={value}
            onChange={e => handleFieldChange(config.key, e.target.value)}
            placeholder={config.placeholder}
            className='mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm'
          />
        );

      case 'textarea':
        return (
          <textarea
            value={value}
            onChange={e => handleFieldChange(config.key, e.target.value)}
            placeholder={config.placeholder}
            rows={config.rows || 3}
            className='mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm'
          />
        );

      case 'select':
        return (
          <select
            value={value}
            onChange={e => handleFieldChange(config.key, e.target.value)}
            className='mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm'
          >
            {config.options?.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        );

      default:
        return null;
    }
  };

  const propertyFields = customFields || getDefaultPropertyFields();

  return (
    <div className='space-y-4 p-4 bg-white border-t border-gray-200'>
      {propertyFields.map(config => (
        <div key={config.key}>
          <label className='block text-sm font-medium text-gray-700'>
            {config.label}
          </label>
          {renderField(config)}
        </div>
      ))}

      <div className='pt-2'>
        <button
          onClick={() => {
            onUpdate?.(); // Call onUpdate when explicitly closing
            onClose();
          }}
          className='w-full px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500'
        >
          Close Properties
        </button>
      </div>
    </div>
  );
};

export default BaseSectionPropertyEditor;
