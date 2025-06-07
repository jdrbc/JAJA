import React from 'react';
import {
  BaseSectionDefinition,
  SectionRenderProps,
  SectionPropertyConfig,
  SectionValidationResult,
  SectionContentData,
} from '../core/BaseSectionDefinition';

// Data interfaces
interface HabitTrackerData {
  name: string;
  color: string;
  frequency: 'daily' | 'weekly';
  completedDates: string[];
  createdAt: string;
}

// Helper functions
function parseHabitData(content: string): HabitTrackerData {
  try {
    const data = JSON.parse(content);
    return {
      name: data.name || '',
      color: data.color || '#3B82F6',
      frequency: data.frequency || 'daily',
      completedDates: data.completedDates || [],
      createdAt: data.createdAt || new Date().toISOString().split('T')[0],
    };
  } catch {
    return {
      name: '',
      color: '#3B82F6',
      frequency: 'daily',
      completedDates: [],
      createdAt: new Date().toISOString().split('T')[0],
    };
  }
}

function serializeHabitData(data: HabitTrackerData): string {
  return JSON.stringify(data);
}

function shouldCompleteOnDate(
  data: HabitTrackerData,
  dateString: string
): boolean {
  const date = new Date(dateString);
  const dayOfWeek = date.getDay(); // 0 = Sunday

  switch (data.frequency) {
    case 'daily':
      return true;
    case 'weekly':
      return dayOfWeek === 1; // Default to Mondays
    default:
      return true;
  }
}

function calculateHabitStrength(
  data: HabitTrackerData,
  targetDate: string
): number {
  const today = new Date(targetDate);
  const createdDate = new Date(data.createdAt);
  const daysSinceCreation = Math.floor(
    (today.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysSinceCreation < 0) return 0;

  let strength = 0;
  const decayRate = 0.05; // How quickly strength decays per day

  // Check each day since creation
  for (let i = 0; i <= daysSinceCreation; i++) {
    const checkDate = new Date(createdDate.getTime() + i * 24 * 60 * 60 * 1000);
    const dateString = checkDate.toISOString().split('T')[0];

    const shouldHaveBeenCompleted = shouldCompleteOnDate(data, dateString);
    const wasCompleted = data.completedDates.includes(dateString);

    if (shouldHaveBeenCompleted) {
      if (wasCompleted) {
        // Completion increases strength
        strength = Math.min(1, strength + 0.1);
      } else {
        // Missing decreases strength
        strength = Math.max(0, strength - decayRate);
      }
    }

    // Natural decay over time
    strength = Math.max(0, strength * (1 - decayRate / 10));
  }

  return Math.round(strength * 100) / 100; // Round to 2 decimal places
}

function calculateCurrentStreak(data: HabitTrackerData): number {
  if (data.completedDates.length === 0) return 0;
  const today = new Date().toISOString().split('T')[0];

  // Check if we should count today or start from yesterday
  let currentDate =
    shouldCompleteOnDate(data, today) && data.completedDates.includes(today)
      ? today
      : getPreviousDate(today);

  let streak = 0;

  // Count backwards from current date
  while (true) {
    if (!shouldCompleteOnDate(data, currentDate)) {
      // Skip days when habit shouldn't be completed
      currentDate = getPreviousDate(currentDate);
      continue;
    }

    if (data.completedDates.includes(currentDate)) {
      streak++;
      currentDate = getPreviousDate(currentDate);
    } else {
      // Streak broken
      break;
    }

    // Stop if we go before creation date
    if (currentDate < data.createdAt) break;
  }

  return streak;
}

function getPreviousDate(dateString: string): string {
  const date = new Date(dateString);
  date.setDate(date.getDate() - 1);
  return date.toISOString().split('T')[0];
}

// Progress Ring Component
interface ProgressRingProps {
  strength: number; // 0 to 1
  color: string;
  checked: boolean;
  onClick: () => void;
  disabled?: boolean;
  size?: number;
}

const ProgressRing: React.FC<ProgressRingProps> = ({
  strength,
  color,
  checked,
  onClick,
  disabled = false,
  size = 40,
}) => {
  const strokeWidth = 3;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDasharray = circumference;
  const strokeDashoffset = circumference - strength * circumference;

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled && onClick) {
      onClick();
    }
  };

  return (
    <div
      className={`relative cursor-pointer ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      onClick={handleClick}
    >
      {/* Progress Ring */}
      <svg width={size} height={size} className='transform -rotate-90'>
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke='#e5e7eb'
          strokeWidth={strokeWidth}
          fill='none'
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill='none'
          strokeDasharray={strokeDasharray}
          strokeDashoffset={strokeDashoffset}
          className='transition-all duration-300 ease-in-out'
          opacity={strength > 0 ? 0.8 : 0.3}
        />
      </svg>

      {/* Visual checkbox indicator in center */}
      <div className='absolute inset-0 flex items-center justify-center pointer-events-none'>
        <div
          className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all duration-200 ${
            checked ? 'border-opacity-100' : 'border-opacity-50'
          }`}
          style={{
            backgroundColor: checked ? color : 'transparent',
            borderColor: color,
          }}
        >
          {checked && (
            <svg
              className='w-2.5 h-2.5 text-white'
              fill='currentColor'
              viewBox='0 0 20 20'
            >
              <path
                fillRule='evenodd'
                d='M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z'
                clipRule='evenodd'
              />
            </svg>
          )}
        </div>
      </div>
    </div>
  );
};

// Display Component
const HabitTrackerDisplay: React.FC<SectionRenderProps> = ({
  content,
  onContentChange,
  entryDate,
}) => {
  const data = parseHabitData(content);
  const today = new Date().toISOString().split('T')[0];

  // Check completion status for THIS journal entry's date
  const isCompletedOnDate = data.completedDates.includes(entryDate);

  // Strength is always calculated up to today (recalculated on every render)
  const currentStrength = calculateHabitStrength(data, today);

  // Show if this habit should be completed on the entry date
  const shouldComplete = shouldCompleteOnDate(data, entryDate);

  const handleToggle = () => {
    // Capture the date at toggle time to prevent race conditions
    const toggleDate = entryDate;

    // Parse the current content to get fresh data
    const currentData = parseHabitData(content);
    const wasCompletedOnToggleDate =
      currentData.completedDates.includes(toggleDate);

    const newCompletedDates = wasCompletedOnToggleDate
      ? currentData.completedDates.filter(date => date !== toggleDate)
      : [...currentData.completedDates, toggleDate];

    const updatedData = { ...currentData, completedDates: newCompletedDates };
    onContentChange(serializeHabitData(updatedData));
  };

  if (!data.name.trim()) {
    return (
      <div className='text-gray-400 italic p-3'>
        Click to configure your habit...
      </div>
    );
  }

  const currentStreak = calculateCurrentStreak(data);

  return (
    <div className='flex items-center space-x-3 p-3'>
      <ProgressRing
        strength={currentStrength}
        color={data.color}
        checked={isCompletedOnDate}
        onClick={handleToggle}
        disabled={!shouldComplete}
      />
      <div className='flex-1'>
        <h3 className='font-medium'>{data.name}</h3>
        <div className='flex items-center space-x-4 text-sm text-gray-500'>
          <span>Strength: {Math.round(currentStrength * 100)}%</span>
          <span>Streak: {currentStreak} days</span>
          <span className='capitalize'>{data.frequency}</span>
        </div>
        {entryDate !== today && (
          <span className='text-xs text-gray-400'>
            {isCompletedOnDate
              ? '✅ Completed'
              : shouldComplete
                ? '⏸️ Skipped'
                : '➖ Not scheduled'}{' '}
            on {entryDate}
          </span>
        )}
      </div>
    </div>
  );
};

// Editor Component - Configuration happens in layout editor only
const HabitTrackerEditor: React.FC<SectionRenderProps> = ({
  content,
  entryDate,
}) => {
  const data = parseHabitData(content);

  if (!data.name.trim()) {
    return (
      <div className='p-4 bg-blue-50 border border-blue-200 rounded-md'>
        <p className='text-blue-800 text-sm'>
          💡 <strong>Habit not configured yet.</strong>
        </p>
        <p className='text-blue-600 text-sm mt-1'>
          Configure this habit in the Template Editor → Section Properties.
        </p>
      </div>
    );
  }

  // Show the same interface as display mode when editing
  return (
    <HabitTrackerDisplay
      content={content}
      onContentChange={() => {}}
      entryDate={entryDate}
    />
  );
};

// Main Section Definition Class
export class HabitTrackerSectionDefinition extends BaseSectionDefinition {
  readonly id = 'habit_tracker';
  readonly name = 'Habit Tracker';
  readonly description = 'Track daily habits with progress visualization';

  // Indicate this section is interactive in display mode
  readonly isInteractiveInDisplayMode = true;

  // Content validation
  isContentEmpty(content: string): boolean {
    try {
      const data = parseHabitData(content);
      return !data.name || data.name.trim() === '';
    } catch {
      return true;
    }
  }

  validateContent(content: string): SectionValidationResult {
    try {
      const data = parseHabitData(content);

      if (!data.name || data.name.trim().length < 2) {
        return {
          isValid: false,
          errors: ['Habit name must be at least 2 characters'],
        };
      }

      if (!data.color.match(/^#[0-9A-Fa-f]{6}$/)) {
        return {
          isValid: false,
          errors: ['Color must be a valid hex color (e.g., #3B82F6)'],
        };
      }

      return { isValid: true };
    } catch (error) {
      return {
        isValid: false,
        errors: ['Invalid habit data format'],
      };
    }
  }

  // Serialization
  parseContent(rawContent: string): SectionContentData {
    return parseHabitData(rawContent);
  }

  serializeContent(data: SectionContentData): string {
    return serializeHabitData(data as HabitTrackerData);
  }

  // Default content
  getDefaultContent(): string {
    return serializeHabitData({
      name: 'New Habit',
      color: '#3B82F6',
      frequency: 'daily',
      completedDates: [],
      createdAt: new Date().toISOString().split('T')[0],
    });
  }

  // Markdown export
  formatToMarkdown(title: string, content: string): string {
    if (this.isContentEmpty(content)) return '';

    try {
      const data = parseHabitData(content);
      const today = new Date().toISOString().split('T')[0];
      const strength = Math.round(calculateHabitStrength(data, today) * 100);
      const streak = calculateCurrentStreak(data);

      const progressBar =
        '●'.repeat(Math.floor(strength / 10)) +
        '○'.repeat(10 - Math.floor(strength / 10));

      return `## ${title}\n\n**Strength**: ${strength}% ${progressBar}\n**Current Streak**: ${streak} days\n**Frequency**: ${data.frequency}\n`;
    } catch {
      return `## ${title}\n\n${content}\n`;
    }
  }

  // Property configuration
  getPropertyFields(): SectionPropertyConfig[] {
    return [
      {
        key: 'title',
        label: 'Habit Name',
        type: 'text',
        placeholder: 'Exercise, Read, Meditate...',
        required: true,
      },
      {
        key: 'refresh_frequency',
        label: 'Duration',
        type: 'select',
        options: [
          { value: 'persistent', label: 'Persistent (across all entries)' },
        ],
        defaultValue: 'persistent',
      },
      {
        key: 'default_content',
        label: 'Habit Configuration',
        type: 'textarea',
        placeholder: 'Configure habit settings',
      },
    ];
  }

  // React components
  renderDisplay(props: SectionRenderProps): React.ReactElement {
    return <HabitTrackerDisplay {...props} />;
  }

  renderEditor(props: SectionRenderProps): React.ReactElement {
    return <HabitTrackerEditor {...props} />;
  }
}
