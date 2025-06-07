import React from 'react';

export interface SectionContentData {
  [key: string]: any;
}

export interface SectionValidationResult {
  isValid: boolean;
  errors?: string[];
}

export interface SectionRenderProps {
  content: string;
  onContentChange: (content: string) => void;
  placeholder?: string;
  isEditMode?: boolean;
  entryDate: string; // ISO date string of the journal entry being viewed
}

export interface SectionPropertyConfig {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'number' | 'checkbox';
  options?: Array<{ value: string; label: string }>;
  placeholder?: string;
  required?: boolean;
  defaultValue?: any;
}

export abstract class BaseSectionDefinition {
  abstract readonly id: string;
  abstract readonly name: string;
  abstract readonly description: string;

  // Optional flag to indicate this section is interactive in display mode
  // and should not trigger edit mode when clicked
  readonly isInteractiveInDisplayMode?: boolean;

  // Content validation
  abstract isContentEmpty(content: string): boolean;
  abstract validateContent(content: string): SectionValidationResult;

  // Serialization
  abstract parseContent(rawContent: string): SectionContentData;
  abstract serializeContent(data: SectionContentData): string;

  // Default content
  abstract getDefaultContent(): string;

  // Markdown export
  abstract formatToMarkdown(title: string, content: string): string;

  // Property configuration
  abstract getPropertyFields(): SectionPropertyConfig[];

  // React components
  abstract renderDisplay(props: SectionRenderProps): React.ReactElement;
  abstract renderEditor(props: SectionRenderProps): React.ReactElement;

  // Optional hooks for lifecycle events
  onContentUpdated?(content: string): void;
  onSectionCreated?(sectionId: string): void;
  onSectionDeleted?(sectionId: string): void;
}

/**
 * Common base class that provides default implementations for typical section patterns.
 * Override specific methods to customize behavior for your section type.
 */
export abstract class CommonSectionDefinition extends BaseSectionDefinition {
  // Default property fields - can be overridden
  protected getBasePropertyFields(): SectionPropertyConfig[] {
    return [
      {
        key: 'title',
        label: 'Title',
        type: 'text',
        placeholder: 'Section title',
        required: true,
      },
      {
        key: 'placeholder',
        label: 'Placeholder',
        type: 'text',
        placeholder: 'Placeholder text',
        defaultValue: this.getDefaultPlaceholder(),
      },
      {
        key: 'refresh_frequency',
        label: 'Refresh Frequency',
        type: 'select',
        options: [
          { value: 'daily', label: 'Daily' },
          { value: 'weekly', label: 'Weekly' },
          { value: 'monthly', label: 'Monthly' },
          { value: 'persistent', label: '∞' },
        ],
        defaultValue: 'daily',
      },
    ];
  }

  // Override this to provide section-specific default placeholder
  protected getDefaultPlaceholder(): string {
    return 'Enter your content here...';
  }

  // Override this to add additional property fields
  protected getAdditionalPropertyFields(): SectionPropertyConfig[] {
    return [];
  }

  // Final implementation - combines base and additional fields
  getPropertyFields(): SectionPropertyConfig[] {
    return [
      ...this.getBasePropertyFields(),
      ...this.getAdditionalPropertyFields(),
    ];
  }
}

/**
 * Base class for sections that handle simple string content.
 * Provides common implementations for string-based sections.
 */
export abstract class StringSectionDefinition extends CommonSectionDefinition {
  // Default implementations for simple string content
  isContentEmpty(content: string): boolean {
    return !content.trim();
  }

  validateContent(content: string): SectionValidationResult {
    return { isValid: true };
  }

  parseContent(rawContent: string): SectionContentData {
    return { text: rawContent };
  }

  serializeContent(data: SectionContentData): string {
    return typeof data === 'string' ? data : data.text || '';
  }

  getDefaultContent(): string {
    return '';
  }

  // Default markdown formatting - override for custom formatting
  formatToMarkdown(title: string, content: string): string {
    if (!content.trim()) return '';
    return `## ${title}\n\n${content}\n`;
  }
}
