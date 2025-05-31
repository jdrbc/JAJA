import React from 'react';
import BaseSectionPropertyEditor, {
  PropertyFieldConfig,
} from './SectionPropertyEditor';
import { SectionTemplate } from '../../services/api';

interface HeaderSectionPropertyEditorProps {
  section: SectionTemplate;
  onClose: () => void;
  onUpdate?: () => void;
}

const HeaderSectionPropertyEditor: React.FC<
  HeaderSectionPropertyEditorProps
> = ({ section, onClose, onUpdate }) => {
  // Custom fields for header sections - excludes default_content
  const headerFields: PropertyFieldConfig[] = [
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

  return (
    <BaseSectionPropertyEditor
      section={section}
      onClose={onClose}
      onUpdate={onUpdate}
      customFields={headerFields}
    />
  );
};

export default HeaderSectionPropertyEditor;
