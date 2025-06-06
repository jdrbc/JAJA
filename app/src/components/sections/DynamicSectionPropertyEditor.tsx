import React from 'react';
import { SectionTemplate } from '../../services/api';
import SectionPropertyEditor from './SectionPropertyEditor';

interface DynamicSectionPropertyEditorProps {
  section: SectionTemplate;
  onClose: () => void;
  onUpdate?: () => void;
}

const DynamicSectionPropertyEditor: React.FC<
  DynamicSectionPropertyEditorProps
> = ({ section, onClose, onUpdate }) => {
  return (
    <SectionPropertyEditor
      section={section}
      onClose={onClose}
      onUpdate={onUpdate}
      isCreating={false}
    />
  );
};

export default DynamicSectionPropertyEditor;
