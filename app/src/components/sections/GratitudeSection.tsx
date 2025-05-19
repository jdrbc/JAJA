import React from 'react';
import BaseSection, { BaseSectionProps } from './BaseSection';

interface GratitudeSectionProps
  extends Omit<BaseSectionProps, 'type' | 'title' | 'placeholder'> {
  prompts?: string[];
}

const GratitudeSection: React.FC<GratitudeSectionProps> = ({
  content,
  onContentChange,
}) => {
  return (
    <div>
      <BaseSection
        type='gratitude'
        content={content}
        onContentChange={onContentChange}
        title='Daily Gratitude'
        placeholder='What are you grateful for today?'
      />
    </div>
  );
};

export default GratitudeSection;
