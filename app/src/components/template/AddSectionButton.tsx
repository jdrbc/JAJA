import React, { useState } from 'react';
import { SectionTemplate } from '../../services/api';
import SectionPropertyEditor from '../sections/SectionPropertyEditor';

interface AddSectionButtonProps {
  columnId: string;
  onSectionAdded: (section: SectionTemplate) => void;
}

const AddSectionButton: React.FC<AddSectionButtonProps> = ({
  columnId,
  onSectionAdded,
}) => {
  const [isCreating, setIsCreating] = useState(false);

  const handleSectionCreated = (section: SectionTemplate) => {
    onSectionAdded(section);
    setIsCreating(false);
  };

  const handleCancel = () => {
    setIsCreating(false);
  };

  if (isCreating) {
    return (
      <div className='mt-6'>
        <SectionPropertyEditor
          columnId={columnId}
          onSectionCreated={handleSectionCreated}
          onClose={handleCancel}
          isCreating={true}
        />
      </div>
    );
  }

  return (
    <button
      onClick={() => setIsCreating(true)}
      className='w-full mt-6 h-16 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50 hover:bg-gray-100 hover:border-gray-400 transition-colors flex items-center justify-center group'
    >
      <div className='text-center'>
        <div className='text-2xl text-gray-400 group-hover:text-gray-500 mb-1'>
          +
        </div>
        <div className='text-xs text-gray-500 group-hover:text-gray-600'>
          Add Section
        </div>
      </div>
    </button>
  );
};

export default AddSectionButton;
