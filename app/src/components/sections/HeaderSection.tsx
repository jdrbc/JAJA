import React, { useState } from 'react';

export interface HeaderSectionProps {
  type: string;
  content: string;
  onContentChange: (content: string) => void;
  title: string;
  placeholder?: string;
}

const HeaderSection: React.FC<HeaderSectionProps> = ({
  type,
  content,
  onContentChange,
  title,
  placeholder = 'Write your theme here...',
}) => {
  const [isEditing, setIsEditing] = useState(false);

  const handleClick = () => {
    setIsEditing(true);
  };

  const handleBlur = () => {
    setIsEditing(false);
  };

  return (
    <div className='mb-6'>
      {/* No title shown for header type */}
      {isEditing ? (
        <>
          <input
            type='text'
            className='w-full p-3 text-xl border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
            placeholder={placeholder}
            value={content}
            onChange={e => onContentChange(e.target.value)}
            onBlur={handleBlur}
            autoFocus
            data-testid={`${type}-editor`}
          />
        </>
      ) : (
        <h1
          className='w-full text-2xl font-bold cursor-pointer'
          onClick={handleClick}
          data-testid={`${type}-display`}
        >
          {content || <span className='text-gray-400'>{placeholder}</span>}
        </h1>
      )}
    </div>
  );
};

export default HeaderSection;
