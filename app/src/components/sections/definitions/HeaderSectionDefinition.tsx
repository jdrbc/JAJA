import React from 'react';
import {
  StringSectionDefinition,
  SectionRenderProps,
} from '../core/BaseSectionDefinition';

const HeaderDisplay: React.FC<SectionRenderProps> = ({
  content,
  placeholder,
}) => {
  return (
    <h1 className='w-full text-2xl font-bold cursor-pointer'>
      {content || <span className='text-gray-400'>{placeholder}</span>}
    </h1>
  );
};

const HeaderEditor: React.FC<SectionRenderProps> = ({
  content,
  onContentChange,
  placeholder,
}) => {
  return (
    <input
      type='text'
      className='w-full p-3 text-xl border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
      placeholder={placeholder}
      value={content}
      onChange={e => onContentChange(e.target.value)}
      autoFocus
    />
  );
};

export class HeaderSectionDefinition extends StringSectionDefinition {
  readonly id = 'header';
  readonly name = 'Header Section';
  readonly description = 'A header section for daily themes or titles';

  protected getDefaultPlaceholder(): string {
    return 'Write your theme here...';
  }

  // Override the default markdown formatting for headers
  formatToMarkdown(title: string, content: string): string {
    if (!content.trim()) return '';
    // Header sections don't show the template title in markdown since the content IS the header
    return `# ${content}\n\n`;
  }

  renderDisplay(props: SectionRenderProps): React.ReactElement {
    return <HeaderDisplay {...props} />;
  }

  renderEditor(props: SectionRenderProps): React.ReactElement {
    return <HeaderEditor {...props} />;
  }
}
