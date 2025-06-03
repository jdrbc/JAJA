# Adding a New Section Type

This guide covers all the steps and considerations for adding a new section type to the journaling application.

## Overview

The application uses a template-based system where sections are defined by:
- **Content Type**: Determines how content is rendered and edited
- **Refresh Frequency**: Controls content persistence (daily, weekly, monthly)
- **Template Configuration**: Title, placeholder, default content, etc.

## 1. Data Model Considerations

### Database Schema
The current schema supports custom section types without changes:

```sql
-- template_sections table
CREATE TABLE template_sections (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  refresh_frequency TEXT NOT NULL DEFAULT 'daily',
  display_order INTEGER NOT NULL,
  placeholder TEXT DEFAULT '',
  default_content TEXT DEFAULT '',
  content_type TEXT NOT NULL DEFAULT 'text',  -- This identifies the section type
  column_id TEXT,
  -- ... timestamps and foreign keys
);
```

### TypeScript Interfaces
Ensure your new section type is compatible with existing interfaces:

```typescript
// In services/api.ts
export interface SectionTemplate {
  id: string;
  title: string;
  refresh_frequency: string;  // 'daily' | 'weekly' | 'monthly'
  display_order: number;
  placeholder: string;
  default_content: string;
  content_type: string;       // Your new type identifier
  column_id: string;
}

export interface SectionWithContent extends SectionTemplate {
  content: string;            // Content format depends on your section type
}
```

## 2. Component Implementation

### Step 1: Create the Section Component

Create a new component file: `app/src/components/sections/YourNewSection.tsx`

**Pattern to Follow:**
```typescript
import React, { useState } from 'react';
import SectionTitle from './SectionTitle';

export interface YourNewSectionProps {
  type: string;
  content: string;
  onContentChange: (content: string) => void;
  title: string;
  placeholder?: string;
}

const YourNewSection: React.FC<YourNewSectionProps> = ({
  type,
  content,
  onContentChange,
  title,
  placeholder = 'Default placeholder...',
}) => {
  // Component-specific state
  const [isEditing, setIsEditing] = useState(false);

  // Content parsing (if needed)
  const parseContent = (rawContent: string) => {
    // For complex content types (like todos), parse JSON
    // For simple types, return content as-is
    try {
      return JSON.parse(rawContent);
    } catch {
      return rawContent;
    }
  };

  // Content serialization (if needed)
  const serializeContent = (data: any) => {
    // For complex types, stringify to JSON
    // For simple types, return as-is
    return typeof data === 'string' ? data : JSON.stringify(data);
  };

  return (
    <div className='mb-6'>
      <SectionTitle title={title} />
      <div className='pl-4'>
        {/* Your custom UI implementation */}
        {isEditing ? (
          // Edit mode UI
          <div data-testid={`${type}-editor`}>
            {/* Custom editing interface */}
          </div>
        ) : (
          // Display mode UI
          <div 
            className='cursor-pointer'
            onClick={() => setIsEditing(true)}
            data-testid={`${type}-display`}
          >
            {/* Custom display interface */}
          </div>
        )}
      </div>
    </div>
  );
};

export default YourNewSection;
```

**Key Requirements:**
- Include `data-testid` attributes for testing
- Handle empty content gracefully
- Support both editing and display modes
- Use consistent styling patterns
- Include proper TypeScript interfaces

### Step 2: Register in SectionContainer

Update `app/src/components/sections/SectionContainer.tsx`:

```typescript
// Add import
import YourNewSection from './YourNewSection';

// Update renderSectionComponent method
const renderSectionComponent = () => {
  if (section.content_type === 'your_new_type') {
    return (
      <YourNewSection
        type={section.id}
        title={section.title}
        content={content}
        onContentChange={newContent => onContentChange(section.id, newContent)}
        placeholder={section.placeholder}
      />
    );
  }
  
  // ... existing conditions
};
```

### Step 3: Add to Section Type Definitions

Update all relevant places where section types are defined:

1. **AddSectionButton.tsx**:
```typescript
const SECTION_TYPES = [
  { value: 'text', label: 'Text Section' },
  { value: 'todo', label: 'Todo List' },
  { value: 'header', label: 'Header Section' },
  { value: 'your_new_type', label: 'Your New Type' }, // Add this
];
```

2. **SectionPropertyEditor.tsx** (property forms):
```typescript
const getDefaultPropertyFields = (): PropertyFieldConfig[] => [
  // ...
  {
    key: 'content_type',
    label: 'Content Type',
    type: 'select',
    options: [
      { value: 'text', label: 'Text Section' },
      { value: 'todo', label: 'Todo List' },
      { value: 'header', label: 'Header Section' },
      { value: 'your_new_type', label: 'Your New Type' }, // Add this
    ],
  },
  // ...
];
```

3. **TemplateSectionEditor.tsx**:
```typescript
// Update the content_type select options
<option value='text'>Text</option>
<option value='todo'>Todo List</option>
<option value='header'>Header</option>
<option value='your_new_type'>Your New Type</option> {/* Add this */}
```

## 3. Template Preview Integration

### Update TemplatePreview.tsx

Add preview rendering for your new section type:

```typescript
const renderSectionPreview = (section: SectionTemplate) => {
  const getContentPreview = () => {
    switch (section.content_type) {
      case 'your_new_type':
        return (
          <div className='your-preview-styling'>
            {/* Static preview of how your section looks */}
            Sample preview content for your new type
          </div>
        );
      // ... existing cases
    }
  };
  // ...
};
```

## 4. Content Persistence Logic

### Understanding Refresh Frequencies

The application has sophisticated content persistence logic in `localApi.ts`:

- **Daily**: Content resets each day (not persisted across days)
- **Weekly**: Content persists within the same week (Monday-Sunday)
- **Monthly**: Content persists within the same month

### Special Content Handling

If your section type requires special persistence logic, update `localApi.ts`:

1. **Content Validation** (for empty content detection):
```typescript
private isNotBlankTodoContent(contentType: string, content: string): boolean {
  if (contentType === 'your_new_type') {
    // Add your custom logic to determine if content is "blank"
    // Return false if content should be considered empty
    return /* your logic here */;
  }
  // ... existing logic
}
```

2. **Content Processing** (if needed):
Update methods like `fetchEntryByDate` and `updateEntry` if your content type requires special handling.

## 5. Markdown Export Support

### Update markdownFormatters.ts

Add formatter for your new section type:

```typescript
// Add new formatter function
export const formatYourNewTypeSection: MarkdownFormatter = ({ template, content }) => {
  if (!content.trim()) return '';

  try {
    // Parse and format your content type for markdown
    // For JSON content:
    const data = JSON.parse(content);
    const formattedContent = /* format your data */;
    
    return `## ${template.title}\n\n${formattedContent}\n`;
  } catch (error) {
    // Fallback to text formatting
    return formatTextSection({ template, content });
  }
};

// Update main formatter
export const formatSectionToMarkdown = (section: SectionForMarkdown): string => {
  const { template } = section;

  switch (template.content_type) {
    case 'your_new_type':
      return formatYourNewTypeSection(section);
    // ... existing cases
  }
};
```

## 6. Custom Property Editors (Optional)

If your section type needs custom property editing (like HeaderSection does), create:

`app/src/components/sections/YourNewSectionPropertyEditor.tsx`:

```typescript
import React from 'react';
import BaseSectionPropertyEditor, { PropertyFieldConfig } from './SectionPropertyEditor';
import { SectionTemplate } from '../../services/api';

interface YourNewSectionPropertyEditorProps {
  section: SectionTemplate;
  onClose: () => void;
  onUpdate: () => void;
}

const YourNewSectionPropertyEditor: React.FC<YourNewSectionPropertyEditorProps> = ({
  section,
  onClose,
  onUpdate,
}) => {
  // Define custom fields (exclude fields you don't want)
  const customFields: PropertyFieldConfig[] = [
    {
      key: 'title',
      label: 'Title',
      type: 'text',
      placeholder: 'Section title',
    },
    // Add/remove fields as needed for your section type
  ];

  return (
    <BaseSectionPropertyEditor
      section={section}
      onClose={onClose}
      onUpdate={onUpdate}
      customFields={customFields}
    />
  );
};

export default YourNewSectionPropertyEditor;
```

Then update `SectionContainer.tsx` to use it:

```typescript
// Add import
import YourNewSectionPropertyEditor from './YourNewSectionPropertyEditor';

// Update property editor rendering logic
const renderPropertyEditor = () => {
  if (section.content_type === 'your_new_type') {
    return (
      <YourNewSectionPropertyEditor
        section={section}
        onClose={onSectionPropertiesClose}
        onUpdate={onUpdate}
      />
    );
  }
  // ... existing conditions
};
```

## 7. Testing Considerations

### Test Data Attributes
Your component must include these `data-testid` attributes:
- `${type}-editor` for edit mode
- `${type}-display` for display mode

### Content Handling Tests
Consider testing:
- Empty content display
- Content parsing/serialization
- Edit/display mode transitions
- Persistence across refresh frequencies

## 8. Common Patterns and Best Practices

### Content Storage Patterns

1. **Simple Text**: Store as plain string
2. **Structured Data**: Store as JSON string (like TodoSection)
3. **Rich Content**: Consider storing as JSON with metadata

### UI Patterns

1. **Click to Edit**: Most sections use click-to-edit pattern
2. **Auto-focus**: New inputs should auto-focus when created
3. **Consistent Styling**: Use existing Tailwind patterns
4. **Responsive Design**: Ensure mobile compatibility

### Performance Considerations

1. **Debounced Saves**: Content changes are automatically debounced
2. **Lazy Rendering**: Consider virtualization for large lists
3. **Memory Management**: Clean up event listeners and timers

## 9. User Migration and Automatic Section Addition

### How New Sections Are Added to Existing Entries

The application automatically handles adding new section types to existing journal entries through the `fetchEntryByDate` method in `localApi.ts`. When you add a new section type to a template:

1. **On Entry Load**: The system fetches the current template configuration
2. **Section Building**: For each template section, it checks if content exists in the database
3. **Automatic Addition**: If a section doesn't exist, it automatically creates it with:
   - Default content from the template
   - Persisted content based on refresh frequency (for weekly/monthly sections)
   - Empty content for daily sections

**Key Code Logic**:
```typescript
// From localApi.ts - fetchEntryByDate method
for (const template of templates.sections) {
  const existingSection = existingSections[template.id];
  let content = '';

  if (existingSection && /* content exists */) {
    // Use existing content
    content = existingSection.content;
  } else {
    // New section - get persisted content or use default
    content = (await this.getExistingSectionContent(
      date,
      template.id,
      template.refresh_frequency
    )) || template.default_content || '';
  }

  sectionsData[template.id] = {
    content,
    // ... other template properties
  };
}
```

This means **no manual migration is needed** when adding new section types - they appear automatically the next time a user opens any journal entry.

## 10. Deployment Process

### Quality Checks

Before deploying changes that include new section types, run:

```bash
# Fix linting and formatting issues automatically
npm run quality:fix

# Run all quality checks (lint, format check, type check)
npm run quality
```

### Available Scripts

The project includes these quality-related npm scripts:

- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint issues automatically
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check if code is properly formatted
- `npm run type-check` - Run TypeScript type checking
- `npm run quality:fix` - Run `lint:fix` and `format`
- `npm run quality` - Run `lint`, `format:check`, and `type-check`

### CI/CD Integration

The project has GitHub Actions that automatically run quality checks on:
- Push to `main` or `develop` branches
- Pull requests to `main` or `develop` branches

### Pre-commit Hooks

The project uses Husky for pre-commit hooks that run:
- `lint-staged` - Automatically fixes and formats staged files
- Quality checks to prevent commits with issues

## 11. Example: Adding a Rating Section

Here's a complete example of adding a star rating section:

### RatingSection.tsx
```typescript
import React, { useState } from 'react';
import SectionTitle from './SectionTitle';

interface RatingData {
  rating: number;
  note?: string;
}

export interface RatingSectionProps {
  type: string;
  content: string;
  onContentChange: (content: string) => void;
  title: string;
  placeholder?: string;
}

const RatingSection: React.FC<RatingSectionProps> = ({
  type,
  content,
  onContentChange,
  title,
  placeholder = 'Rate your day and add a note...',
}) => {
  const [isEditing, setIsEditing] = useState(false);

  const parseRating = (content: string): RatingData => {
    try {
      return JSON.parse(content) || { rating: 0 };
    } catch {
      return { rating: 0 };
    }
  };

  const ratingData = parseRating(content);

  const updateRating = (rating: number, note?: string) => {
    const newData = { rating, note: note || ratingData.note };
    onContentChange(JSON.stringify(newData));
  };

  const renderStars = (rating: number, interactive: boolean = false) => (
    <div className="flex space-x-1">
      {[1, 2, 3, 4, 5].map(star => (
        <button
          key={star}
          className={`text-2xl ${star <= rating ? 'text-yellow-400' : 'text-gray-300'} ${
            interactive ? 'hover:text-yellow-300 cursor-pointer' : 'cursor-default'
          }`}
          onClick={interactive ? () => updateRating(star, ratingData.note) : undefined}
          disabled={!interactive}
        >
          ★
        </button>
      ))}
    </div>
  );

  return (
    <div className='mb-6'>
      <SectionTitle title={title} />
      <div className='pl-4'>
        {isEditing ? (
          <div className="space-y-3" data-testid={`${type}-editor`}>
            {renderStars(ratingData.rating, true)}
            <textarea
              className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={placeholder}
              value={ratingData.note || ''}
              onChange={e => updateRating(ratingData.rating, e.target.value)}
              onBlur={() => setIsEditing(false)}
              rows={3}
            />
          </div>
        ) : (
          <div
            className="cursor-pointer p-3 rounded-md hover:bg-gray-50"
            onClick={() => setIsEditing(true)}
            data-testid={`${type}-display`}
          >
            {ratingData.rating > 0 ? (
              <div className="space-y-2">
                {renderStars(ratingData.rating)}
                {ratingData.note && (
                  <p className="text-gray-700">{ratingData.note}</p>
                )}
              </div>
            ) : (
              <span className="text-gray-400">{placeholder}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default RatingSection;
```

### Update Section Registration
Add `'rating'` to all the type definition arrays mentioned in step 2.

### Add Markdown Formatter
```typescript
export const formatRatingSection: MarkdownFormatter = ({ template, content }) => {
  if (!content.trim()) return '';

  try {
    const data = JSON.parse(content);
    if (data.rating === 0) return '';

    const stars = '★'.repeat(data.rating) + '☆'.repeat(5 - data.rating);
    const note = data.note ? `\n\n${data.note}` : '';
    
    return `## ${template.title}\n\n${stars} (${data.rating}/5)${note}\n`;
  } catch (error) {
    return formatTextSection({ template, content });
  }
};
```

## 12. Checklist

Before deploying a new section type, ensure:

- [ ] Component created with proper TypeScript interfaces
- [ ] Registered in SectionContainer.tsx
- [ ] Added to all section type definition arrays
- [ ] Template preview implemented
- [ ] Markdown formatter added (if applicable)
- [ ] Test data attributes included
- [ ] Content persistence logic considered
- [ ] Custom property editor created (if needed)
- [ ] Responsive design tested
- [ ] Empty content handling implemented
- [ ] Error handling for content parsing
- [ ] Quality checks pass (`npm run quality`)
- [ ] Code formatted and linted (`npm run quality:fix`)

## 13. Questions for Developers

Before implementing a new section type, consider:

1. **Content Structure**: Will you store simple text or complex JSON data?
2. **Refresh Frequency**: Should content persist daily, weekly, or monthly?
3. **User Interaction**: What editing interface makes sense for your content type?
4. **Export Format**: How should this content appear in markdown exports?
5. **Property Customization**: Does this section type need custom configuration options?
6. **Performance Impact**: Will this section type handle large amounts of data efficiently?
7. **Migration Impact**: Since new sections are automatically added to existing entries, ensure your default content is appropriate for all users.

This completes the comprehensive guide for adding new section types to the journaling application.
