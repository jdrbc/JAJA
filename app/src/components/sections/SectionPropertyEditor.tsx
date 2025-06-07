import React, { useState, useEffect, useCallback } from 'react';
import { SectionTemplate } from '../../services/api';
import { localApiService } from '../../services/localApi';
import { SectionRegistry } from './core/SectionRegistry';
import { useTemplateManagement } from '../../hooks/useTemplateManagement';
import logger from '../../utils/logger';

interface SectionPropertyEditorProps {
  // For editing existing sections
  section?: SectionTemplate;

  // For creating new sections
  columnId?: string;
  onSectionCreated?: (section: SectionTemplate) => void;

  // Common props
  onClose: () => void;
  onUpdate?: () => void;
  isCreating?: boolean;
}

const SectionPropertyEditor: React.FC<SectionPropertyEditorProps> = ({
  section,
  columnId,
  onSectionCreated,
  onClose,
  onUpdate,
  isCreating = false,
}) => {
  const registry = SectionRegistry.getInstance();
  const { createSection, isLoading } = useTemplateManagement();

  // Helper function to get default values from section definition
  const getDefaultValues = useCallback(
    (contentType: string) => {
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
    },
    [registry]
  );

  // Initialize form data
  const [formData, setFormData] = useState<Record<string, any>>(() => {
    if (section) {
      // Editing existing section
      const baseData = {
        id: section.id,
        title: section.title,
        placeholder: section.placeholder,
        refresh_frequency: section.refresh_frequency,
        content_type: section.content_type,
        default_content: section.default_content,
      };

      // Extract custom fields from configuration JSON
      if (section.configuration) {
        try {
          const configData = JSON.parse(section.configuration);
          return {
            ...baseData,
            ...configData,
          };
        } catch {
          // If parsing fails, use base data only
          return baseData;
        }
      }

      return baseData;
    } else {
      // Creating new section
      const defaultValues = getDefaultValues('text');
      return {
        id: `section_${Date.now()}`,
        title: defaultValues.title,
        placeholder: defaultValues.placeholder,
        refresh_frequency: defaultValues.refresh_frequency,
        content_type: 'text',
        default_content: defaultValues.default_content,
      };
    }
  });

  // Update default values when content type changes (for new sections)
  useEffect(() => {
    if (isCreating && formData.content_type) {
      const defaultValues = getDefaultValues(formData.content_type);
      const currentDefinition = registry.get(formData.content_type);
      const fields = currentDefinition?.getPropertyFields() || [];

      const updates: Record<string, any> = {
        // Only update these if they haven't been manually set
        placeholder: formData.placeholder || defaultValues.placeholder,
        refresh_frequency: defaultValues.refresh_frequency,
        default_content: defaultValues.default_content,
      };

      // Add default values for all custom fields
      fields.forEach(field => {
        if (
          !['title', 'placeholder', 'refresh_frequency'].includes(field.key)
        ) {
          updates[field.key] = formData[field.key] || field.defaultValue;
        }
      });

      setFormData(prev => ({
        ...prev,
        ...updates,
      }));
    }
  }, [formData.content_type, isCreating, getDefaultValues, registry, formData]);

  const currentDefinition = registry.get(formData.content_type);
  const fields = currentDefinition?.getPropertyFields() || [];
  const sectionTypes = registry.getAllTypes();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      // Separate standard fields from custom configuration fields
      const standardFields = [
        'id',
        'title',
        'placeholder',
        'refresh_frequency',
        'content_type',
        'default_content',
        'column_id',
      ];
      const customFields: Record<string, any> = {};

      // Extract custom fields into configuration
      Object.keys(formData).forEach(key => {
        if (!standardFields.includes(key)) {
          customFields[key] = formData[key];
        }
      });

      // Generate configuration JSON from custom fields
      const configuration =
        Object.keys(customFields).length > 0
          ? JSON.stringify(customFields)
          : '';

      if (isCreating) {
        // Creating new section
        if (!formData.title?.trim() || !columnId) return;

        const newSection = await createSection({
          id: formData.id,
          title: formData.title.trim(),
          content_type: formData.content_type,
          placeholder: formData.placeholder?.trim() || '',
          default_content: formData.default_content || '',
          refresh_frequency: formData.refresh_frequency || 'daily',
          configuration,
          column_id: columnId,
        });

        onSectionCreated?.(newSection);
      } else {
        // Updating existing section
        if (!section) return;

        await localApiService.updateTemplateSection(section.id, {
          title: formData.title,
          placeholder: formData.placeholder,
          refresh_frequency: formData.refresh_frequency,
          content_type: formData.content_type,
          default_content: formData.default_content,
          configuration,
        });

        onUpdate?.();
      }

      onClose();
    } catch (error) {
      logger.error(
        `Failed to ${isCreating ? 'create' : 'update'} section:`,
        error
      );
    }
  };

  const renderField = (field: any) => {
    const commonProps = {
      value: formData[field.key] || field.defaultValue || '',
      onChange: (e: React.ChangeEvent<any>) =>
        setFormData(prev => ({ ...prev, [field.key]: e.target.value })),
      className:
        'w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500',
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
            className='rounded border-gray-300 focus:ring-2 focus:ring-blue-500'
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
    <div className='p-4 bg-white border-2 border-dashed border-blue-300 rounded-lg bg-blue-50'>
      <div className='mb-4'>
        <h3 className='text-lg font-medium text-gray-900'>
          {isCreating ? 'Create New Section' : 'Edit Section Properties'}
        </h3>
      </div>

      <form onSubmit={handleSubmit} className='space-y-4'>
        {/* Content Type (for new sections only) */}
        {isCreating && (
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>
              Section Type
              <span className='text-red-500 ml-1'>*</span>
            </label>
            <select
              value={formData.content_type}
              onChange={e =>
                setFormData(prev => ({ ...prev, content_type: e.target.value }))
              }
              className='w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
              required
            >
              {sectionTypes.map(type => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Dynamic fields from section definition */}
        {fields
          .filter(field => !field.hidden)
          .map(field => (
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
            disabled={(!formData.title?.trim() && isCreating) || isLoading}
            className='px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50'
          >
            {isLoading
              ? 'Saving...'
              : isCreating
                ? 'Create Section'
                : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default SectionPropertyEditor;
