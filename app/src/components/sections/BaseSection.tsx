import React, { useState, useRef, useEffect } from 'react';
import SectionTitle from './SectionTitle';

export interface BaseSectionProps {
  type: string;
  content: string;
  onContentChange: (content: string) => void;
  title: string;
  placeholder?: string;
}

const BaseSection: React.FC<BaseSectionProps> = ({
  type,
  content,
  onContentChange,
  title,
  placeholder = 'Write your thoughts here...',
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [textareaHeight, setTextareaHeight] = useState('8rem'); // default min-height
  const displayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (displayRef.current && !isEditing) {
      // Measure the display div height when not editing
      const height = displayRef.current.scrollHeight;
      setTextareaHeight(`${Math.max(height, 128)}px`); // 128px = 8rem minimum
    }
  }, [content, isEditing]);

  const handleClick = () => {
    setIsEditing(true);
  };

  const handleBlur = () => {
    setIsEditing(false);
  };

  return (
    <div className='mb-6'>
      <SectionTitle title={title} />
      <div className='pl-4'>
        {isEditing ? (
          <textarea
            className='w-full p-4 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y'
            style={{ height: textareaHeight }}
            placeholder={placeholder}
            value={content}
            onChange={e => onContentChange(e.target.value)}
            onBlur={handleBlur}
            autoFocus
            data-testid={`${type}-editor`}
          />
        ) : (
          <div
            ref={displayRef}
            className='w-full min-h-32 p-4 italic border-gray-300 rounded-md cursor-pointer whitespace-pre-wrap'
            onClick={handleClick}
            data-testid={`${type}-display`}
          >
            {content || <span className='text-gray-400'>{placeholder}</span>}
          </div>
        )}
      </div>
    </div>
  );
};

export default BaseSection;
