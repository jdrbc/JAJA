# Adding a New Section Type

This guide covers adding a new section type to the journaling application using the modern inheritance-based architecture.

## Overview

The application uses an inheritance-based section system where each section type:
- **Extends `BaseSectionDefinition`**: Implements a standardized interface for all section behavior
- **Self-registers**: Automatically integrates with the application through the `SectionRegistry`
- **Handles its own logic**: Contains all rendering, validation, persistence, and formatting logic
- **No manual integration**: Adding a new section requires only creating the definition and registering it

This eliminates scattered logic, switch statements, and manual component integration throughout the application.

## 1. Architecture Overview

### Current System Structure

```typescript
// Core Infrastructure (Already Implemented)
├── BaseSectionDefinition.ts    // Abstract base class for all sections
├── SectionRegistry.ts          // Centralized section registry singleton
├── UniversalSection.tsx        // Universal component that renders any section type
└── DynamicSectionPropertyEditor.tsx // Universal property editor

// Section Definitions
├── TextSectionDefinition.tsx   // Text section implementation
├── TodoSectionDefinition.tsx   // Todo list section implementation  
├── HeaderSectionDefinition.tsx // Header section implementation
└── YourNewSectionDefinition.tsx // Your new section (to be created)
```

### Key Benefits
- **Single File Per Section**: All logic for a section type lives in one file
- **No Core App Changes**: Adding sections doesn't require modifying core application logic
- **Automatic Integration**: Sections work immediately once registered
- **Type Safety**: Full TypeScript support with compile-time checking
- **Consistent Patterns**: All sections follow the same interface and patterns

## 2. Creating a New Section Type

### Step 1: Create the Section Definition

Create a new file: `app/src/components/sections/definitions/YourNewSectionDefinition.tsx`

```typescript
import React from 'react';
import {
  BaseSectionDefinition,
  SectionRenderProps,
  SectionPropertyConfig,
  SectionValidationResult,
  SectionContentData,
} from '../core/BaseSectionDefinition';

// Display Component (when not editing)
const YourNewDisplay: React.FC<SectionRenderProps> = ({ content, placeholder }) => {
  // Parse content if needed
  const parsedContent = parseYourContent(content);

  return (
    <div className='cursor-pointer p-3 rounded-md hover:bg-gray-50'>
      {content ? (
        <div>
          {/* Your custom display logic */}
          <p>{parsedContent.displayText}</p>
        </div>
      ) : (
        <span className='text-gray-400'>{placeholder}</span>
      )}
    </div>
  );
};

// Editor Component (when editing)
const YourNewEditor: React.FC<SectionRenderProps> = ({
  content,
  onContentChange,
  placeholder,
}) => {
  const parsedContent = parseYourContent(content);

  const handleChange = (newValue: string) => {
    // Process and serialize your content
    const serializedContent = serializeYourContent(newValue);
    onContentChange(serializedContent);
  };

  return (
    <div>
      {/* Your custom editing interface */}
      <input
        type='text'
        value={parsedContent.editValue}
        onChange={e => handleChange(e.target.value)}
        placeholder={placeholder}
        className='w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
        autoFocus
      />
    </div>
  );
};

// Helper functions for your content type
const parseYourContent = (content: string) => {
  try {
    // For JSON content types
    return JSON.parse(content || '{}');
  } catch {
    // For simple text content types
    return { displayText: content, editValue: content };
  }
};

const serializeYourContent = (data: any) => {
  // For JSON content types
  if (typeof data === 'object') {
    return JSON.stringify(data);
  }
  // For simple text content types
  return data;
};

// Main Section Definition Class
export class YourNewSectionDefinition extends BaseSectionDefinition {
  readonly id = 'your_new_type';
  readonly name = 'Your New Section Type';
  readonly description = 'Description of what this section type does';

  // Content validation - determines if content is "empty"
  isContentEmpty(content: string): boolean {
    if (!content.trim()) return true;
    
    try {
      // For JSON content types, check if meaningful data exists
      const data = JSON.parse(content);
      return Object.keys(data).length === 0;
    } catch {
      // For text content types
      return !content.trim();
    }
  }

  // Content validation - checks if content is valid
  validateContent(content: string): SectionValidationResult {
    try {
      // Add your validation logic
      const data = parseYourContent(content);
      
      // Example validation
      if (data.someRequiredField && data.someRequiredField.length < 3) {
        return {
          isValid: false,
          errors: ['Required field must be at least 3 characters'],
        };
      }
      
      return { isValid: true };
    } catch (error) {
      return {
        isValid: false,
        errors: ['Invalid content format'],
      };
    }
  }

  // Parse raw content string into structured data
  parseContent(rawContent: string): SectionContentData {
    return parseYourContent(rawContent);
  }

  // Serialize structured data back to string for storage
  serializeContent(data: SectionContentData): string {
    return serializeYourContent(data);
  }

  // Default content for new sections
  getDefaultContent(): string {
    // Return empty string for text types, or JSON for complex types
    return JSON.stringify({ defaultField: '' });
  }

  // Markdown export formatting
  formatToMarkdown(title: string, content: string): string {
    if (this.isContentEmpty(content)) return '';

    try {
      const data = parseYourContent(content);
      
      // Format your content type for markdown export
      const formattedContent = `**${data.someField}**: ${data.someOtherField}`;
      
      return `## ${title}\n\n${formattedContent}\n`;
    } catch (error) {
      // Fallback to simple text formatting
      return `## ${title}\n\n${content}\n`;
    }
  }

  // Property configuration for the section editor
  getPropertyFields(): SectionPropertyConfig[] {
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
        defaultValue: 'Enter your content...',
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
        defaultValue: 'daily',
      },
      // Add custom fields specific to your section type
      // {
      //   key: 'custom_field',
      //   label: 'Custom Setting',
      //   type: 'checkbox',
      //   defaultValue: false,
      // },
    ];
  }

  // Render methods - return React components
  renderDisplay(props: SectionRenderProps): React.ReactElement {
    return <YourNewDisplay {...props} />;
  }

  renderEditor(props: SectionRenderProps): React.ReactElement {
    return <YourNewEditor {...props} />;
  }

  // Optional lifecycle hooks
  onContentUpdated?(content: string): void {
    // Called whenever content changes
    console.log('Content updated:', content);
  }

  onSectionCreated?(sectionId: string): void {
    // Called when a new section of this type is created
    console.log('Section created:', sectionId);
  }

  onSectionDeleted?(sectionId: string): void {
    // Called when a section of this type is deleted
    console.log('Section deleted:', sectionId);
  }
}
```

### Step 2: Register the Section

Update `app/src/components/sections/registry.ts`:

```typescript
import { SectionRegistry } from './core/SectionRegistry';
import { TextSectionDefinition } from './definitions/TextSectionDefinition';
import { TodoSectionDefinition } from './definitions/TodoSectionDefinition';
import { HeaderSectionDefinition } from './definitions/HeaderSectionDefinition';
import { YourNewSectionDefinition } from './definitions/YourNewSectionDefinition'; // Add this

export function initializeSectionRegistry(): void {
  const registry = SectionRegistry.getInstance();
  
  registry.register(new TextSectionDefinition());
  registry.register(new TodoSectionDefinition());
  registry.register(new HeaderSectionDefinition());
  registry.register(new YourNewSectionDefinition()); // Add this
}

export const sectionRegistry = SectionRegistry.getInstance();
```

**That's it!** Your new section type is now fully integrated into the application.

## 3. Content Type Patterns

### Simple Text Content
```typescript
isContentEmpty(content: string): boolean {
  return !content.trim();
}

parseContent(rawContent: string): SectionContentData {
  return { text: rawContent };
}

serializeContent(data: SectionContentData): string {
  return typeof data === 'string' ? data : data.text || '';
}
```

### JSON Structured Content
```typescript
interface YourContentStructure {
  items: Array<{ id: string; text: string; completed: boolean }>;
  metadata?: { created: Date; category: string };
}

isContentEmpty(content: string): boolean {
  try {
    const data: YourContentStructure = JSON.parse(content);
    return data.items.length === 0;
  } catch {
    return true;
  }
}

parseContent(rawContent: string): SectionContentData {
  try {
    return JSON.parse(rawContent) as YourContentStructure;
  } catch {
    return { items: [], metadata: undefined };
  }
}

serializeContent(data: SectionContentData): string {
  return JSON.stringify(data);
}
```

### Rich Content with Validation
```typescript
validateContent(content: string): SectionValidationResult {
  try {
    const data = JSON.parse(content);
    const errors: string[] = [];
    
    if (!data.title || data.title.length < 3) {
      errors.push('Title must be at least 3 characters');
    }
    
    if (data.items && data.items.some((item: any) => !item.text)) {
      errors.push('All items must have text');
    }
    
    return {
      isValid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch {
    return {
      isValid: false,
      errors: ['Invalid JSON format'],
    };
  }
}
```

## 4. UI Component Patterns

### Display Component Best Practices
```typescript
const YourDisplay: React.FC<SectionRenderProps> = ({ content, placeholder }) => {
  const data = parseYourContent(content);
  
  // Handle empty state
  if (!content || isContentEmpty(content)) {
    return (
      <div className='text-gray-400 italic p-3'>
        {placeholder || 'Click to add content...'}
      </div>
    );
  }
  
  // Render your content
  return (
    <div className='p-3 hover:bg-gray-50 rounded-md transition-colors'>
      {/* Your content rendering */}
    </div>
  );
};
```

### Editor Component Best Practices
```typescript
const YourEditor: React.FC<SectionRenderProps> = ({
  content,
  onContentChange,
  placeholder,
}) => {
  const [localState, setLocalState] = useState(() => parseYourContent(content));
  
  // Update content when local state changes
  useEffect(() => {
    const serialized = serializeYourContent(localState);
    onContentChange(serialized);
  }, [localState, onContentChange]);
  
  return (
    <div className='space-y-3'>
      {/* Your editing interface */}
      <input
        value={localState.someField}
        onChange={e => setLocalState(prev => ({ ...prev, someField: e.target.value }))}
        placeholder={placeholder}
        className='w-full p-3 border rounded-md focus:ring-2 focus:ring-blue-500'
        autoFocus
      />
    </div>
  );
};
```

## 5. Testing Your Section

### Manual Testing Checklist
1. **Creation**: Can create new sections of your type
2. **Display**: Content displays correctly in view mode
3. **Editing**: Can edit content and changes persist
4. **Empty State**: Empty content displays placeholder properly
5. **Properties**: Section properties editor works
6. **Persistence**: Content saves correctly across app restarts
7. **Markdown Export**: Content exports to markdown properly
8. **Validation**: Content validation works as expected

### Test Data Attributes
Your components should include these for automated testing:
```typescript
// In display component
<div data-testid={`${sectionType}-display`}>

// In editor component  
<div data-testid={`${sectionType}-editor`}>
```

## 6. Advanced Features

### Custom Property Fields
```typescript
getPropertyFields(): SectionPropertyConfig[] {
  return [
    // Standard fields
    { key: 'title', label: 'Title', type: 'text', required: true },
    { key: 'placeholder', label: 'Placeholder', type: 'text' },
    { key: 'refresh_frequency', label: 'Refresh', type: 'select', options: [...] },
    
    // Custom fields for your section type
    {
      key: 'max_items',
      label: 'Maximum Items',
      type: 'number',
      defaultValue: 10,
    },
    {
      key: 'category',
      label: 'Category',
      type: 'select',
      options: [
        { value: 'personal', label: 'Personal' },
        { value: 'work', label: 'Work' },
        { value: 'health', label: 'Health' },
      ],
    },
    {
      key: 'auto_sort',
      label: 'Auto Sort Items',
      type: 'checkbox',
      defaultValue: false,
    },
  ];
}
```

### Lifecycle Hooks
```typescript
onContentUpdated(content: string): void {
  // Trigger analytics, validation, or side effects
  if (this.isContentEmpty(content)) {
    console.log('Content cleared');
  }
}

onSectionCreated(sectionId: string): void {
  // Initialize section-specific data, send events, etc.
  localStorage.setItem(`section-${sectionId}-created`, Date.now().toString());
}

onSectionDeleted(sectionId: string): void {
  // Cleanup section-specific data
  localStorage.removeItem(`section-${sectionId}-created`);
}
```

### Complex Markdown Formatting
```typescript
formatToMarkdown(title: string, content: string): string {
  if (this.isContentEmpty(content)) return '';
  
  try {
    const data = parseYourContent(content);
    
    let markdown = `## ${title}\n\n`;
    
    // Format complex structures
    if (data.items && data.items.length > 0) {
      data.items.forEach((item, index) => {
        markdown += `${index + 1}. **${item.title}**: ${item.description}\n`;
        if (item.tags) {
          markdown += `   Tags: ${item.tags.join(', ')}\n`;
        }
        markdown += '\n';
      });
    }
    
    // Add metadata
    if (data.metadata) {
      markdown += `*Created: ${data.metadata.created}*\n`;
    }
    
    return markdown;
  } catch (error) {
    return `## ${title}\n\n${content}\n`;
  }
}
```

## 7. Migration Considerations

### Data Compatibility
The new system is fully backwards compatible. Existing content will:
- Load correctly in the new section definitions
- Maintain all existing functionality  
- Continue to save in the same format

### Performance
- Registry lookups are O(1) constant time
- Section rendering is optimized with React patterns
- No performance impact from the new architecture

### Error Handling
The system gracefully handles:
- Missing section definitions (shows error state)
- Invalid content (falls back to safe rendering)
- Registry initialization failures (continues with basic functionality)

## 8. Deployment

### Quality Checks
Before deploying:
```bash
# Fix linting and formatting
npm run quality:fix

# Run all quality checks
npm run quality

# Test the build
npm run build
```

### File Structure
Your section should follow this structure:
```
app/src/components/sections/
├── definitions/
│   └── YourNewSectionDefinition.tsx  ✅ Your new file
├── registry.ts                       ✅ Updated with your section
└── core/
    ├── BaseSectionDefinition.ts      ✅ Unchanged
    └── SectionRegistry.ts            ✅ Unchanged
```

## 9. Examples

### Rating Section Example
```typescript
export class RatingSectionDefinition extends BaseSectionDefinition {
  readonly id = 'rating';
  readonly name = 'Rating Section';
  readonly description = 'Rate your day with stars and notes';

  isContentEmpty(content: string): boolean {
    try {
      const data = JSON.parse(content);
      return data.rating === 0 && !data.note?.trim();
    } catch {
      return true;
    }
  }

  formatToMarkdown(title: string, content: string): string {
    if (this.isContentEmpty(content)) return '';
    
    try {
      const data = JSON.parse(content);
      const stars = '★'.repeat(data.rating) + '☆'.repeat(5 - data.rating);
      const note = data.note ? `\n\n${data.note}` : '';
      
      return `## ${title}\n\n${stars} (${data.rating}/5)${note}\n`;
    } catch {
      return `## ${title}\n\n${content}\n`;
    }
  }

  // ... other required methods
}
```

## 10. Summary

Adding a new section type now requires only:

1. **Create one file**: `YourNewSectionDefinition.tsx`
2. **Register it**: Add one line to `registry.ts`
3. **Test**: Your section works immediately

**No more:**
- Switch statements throughout the app
- Manual component registration in multiple files
- Scattered section-specific logic
- Complex integration steps

The inheritance-based architecture provides a clean, maintainable, and extensible foundation for section types that scales easily as your application grows.
