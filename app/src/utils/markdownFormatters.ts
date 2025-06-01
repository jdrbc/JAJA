import { SectionTemplate } from '../services/api';

// Interface for the section data passed to formatters
export interface SectionForMarkdown {
  template: SectionTemplate;
  content: string;
}

// Type for a markdown formatter function
export type MarkdownFormatter = (section: SectionForMarkdown) => string;

// Formatter for text sections
export const formatTextSection: MarkdownFormatter = ({ template, content }) => {
  if (!content.trim()) return '';

  return `## ${template.title}\n\n${content}\n`;
};

// Formatter for header sections
export const formatHeaderSection: MarkdownFormatter = ({
  template,
  content,
}) => {
  if (!content.trim()) return '';

  return `# ${content}\n`;
};

// Formatter for todo sections
export const formatTodoSection: MarkdownFormatter = ({ template, content }) => {
  if (!content.trim()) return '';

  try {
    const todoData = JSON.parse(content);
    const items = todoData.items || [];

    if (items.length === 0) return '';

    const todoList = items
      .map((item: any) => {
        const checkbox = item.completed ? '- [x]' : '- [ ]';
        return `${checkbox} ${item.text}`;
      })
      .filter((item: string) => item.trim() !== '- [ ]') // Filter out empty todos
      .join('\n');

    if (!todoList.trim()) return '';

    return `## ${template.title}\n\n${todoList}\n`;
  } catch (error) {
    // If JSON parsing fails, treat as plain text
    return formatTextSection({ template, content });
  }
};

// Main formatter function that routes to appropriate formatter based on content type
export const formatSectionToMarkdown = (
  section: SectionForMarkdown
): string => {
  const { template } = section;

  switch (template.content_type) {
    case 'header':
      return formatHeaderSection(section);
    case 'todo':
      return formatTodoSection(section);
    case 'text':
    default:
      return formatTextSection(section);
  }
};

// Formatter registry for extensibility
export const markdownFormatters: Record<string, MarkdownFormatter> = {
  text: formatTextSection,
  header: formatHeaderSection,
  todo: formatTodoSection,
};

// Function to register custom formatters
export const registerMarkdownFormatter = (
  contentType: string,
  formatter: MarkdownFormatter
) => {
  markdownFormatters[contentType] = formatter;
};
