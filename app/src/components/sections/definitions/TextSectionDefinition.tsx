import React, { useRef, useEffect, useState } from 'react';
import {
  StringSectionDefinition,
  SectionRenderProps,
} from '../core/BaseSectionDefinition';

const TextDisplay: React.FC<SectionRenderProps> = ({
  content,
  placeholder,
}) => {
  const displayRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={displayRef}
      className='w-full min-h-32 p-4 italic border-gray-300 rounded-md cursor-pointer whitespace-pre-wrap'
    >
      {content || <span className='text-gray-400'>{placeholder}</span>}
    </div>
  );
};

const TextEditor: React.FC<SectionRenderProps> = ({
  content,
  onContentChange,
  placeholder,
}) => {
  const [textareaHeight, setTextareaHeight] = useState('8rem');

  useEffect(() => {
    // Auto-resize based on content
    const lines = content.split('\n').length;
    const height = Math.max(128, lines * 24 + 32); // 24px per line + padding
    setTextareaHeight(`${height}px`);
  }, [content]);

  return (
    <textarea
      className='w-full p-4 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y'
      style={{ height: textareaHeight }}
      placeholder={placeholder || 'Write your thoughts here...'}
      value={content}
      onChange={e => onContentChange(e.target.value)}
      autoFocus
    />
  );
};

export class TextSectionDefinition extends StringSectionDefinition {
  readonly id = 'text';
  readonly name = 'Text Section';
  readonly description = 'Basic text input section';

  protected getDefaultPlaceholder(): string {
    return 'Write your thoughts here...';
  }

  renderDisplay(props: SectionRenderProps): React.ReactElement {
    return <TextDisplay {...props} />;
  }

  renderEditor(props: SectionRenderProps): React.ReactElement {
    return <TextEditor {...props} />;
  }
}
