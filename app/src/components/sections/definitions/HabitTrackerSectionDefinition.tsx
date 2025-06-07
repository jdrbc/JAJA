import React from 'react';
import {
  BaseSectionDefinition,
  SectionRenderProps,
  SectionPropertyConfig,
  SectionValidationResult,
  SectionContentData,
} from '../core/BaseSectionDefinition';

// Data interfaces
interface HabitConfig {
  name: string;
  color: string;
  frequency: 'daily' | 'weekly';
}

interface HabitDynamicData {
  completedDates: string[];
  createdAt: string;
}

interface HabitTrackerData extends HabitConfig, HabitDynamicData {}

// Helper functions
function parseHabitConfig(configuration: string): HabitConfig {
  // Handle empty or undefined configuration
  if (!configuration || configuration.trim() === '') {
    return {
      name: '',
      color: '#3B82F6',
      frequency: 'daily',
    };
  }

  try {
    const data = JSON.parse(configuration);
    return {
      name: data.habit_name || data.title || data.name || '',
      color: data.habit_color || data.color || '#3B82F6',
      frequency: data.habit_frequency || data.frequency || 'daily',
    };
  } catch {
    return {
      name: '',
      color: '#3B82F6',
      frequency: 'daily',
    };
  }
}

function parseHabitDynamicData(content: string): HabitDynamicData {
  try {
    const data = JSON.parse(content);
    return {
      completedDates: data.completedDates || [],
      createdAt: data.createdAt || new Date().toISOString().split('T')[0],
    };
  } catch {
    return {
      completedDates: [],
      createdAt: new Date().toISOString().split('T')[0],
    };
  }
}

function parseHabitData(
  content: string,
  configuration: string = '',
  title: string = ''
): HabitTrackerData {
  const config = parseHabitConfig(configuration);
  const dynamic = parseHabitDynamicData(content);

  return {
    ...config,
    ...dynamic,
    name: title || config.name, // Use section title as habit name
  };
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
  configuration,
  title,
}) => {
  const data = parseHabitData(content, configuration, title);
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
    const currentData = parseHabitData(content, configuration);
    const wasCompletedOnToggleDate =
      currentData.completedDates.includes(toggleDate);

    const newCompletedDates = wasCompletedOnToggleDate
      ? currentData.completedDates.filter(date => date !== toggleDate)
      : [...currentData.completedDates, toggleDate];

    // Only update dynamic data in content
    const updatedDynamicData = {
      completedDates: newCompletedDates,
      createdAt: currentData.createdAt,
    };
    onContentChange(JSON.stringify(updatedDynamicData));
  };

  if (!data.name.trim()) {
    return (
      <div className='text-gray-400 italic p-3'>
        💡 <strong>Habit not configured yet.</strong> Configure this habit in
        the Template Editor → Section Properties.
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

// Editor Component - Shows same interface as display when configured
const HabitTrackerEditor: React.FC<SectionRenderProps> = ({
  content,
  onContentChange,
  entryDate,
  configuration,
  title,
}) => {
  const data = parseHabitData(content, configuration, title);

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
      onContentChange={onContentChange}
      entryDate={entryDate}
      configuration={configuration}
      title={title}
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

  // Content validation - checks if configuration has name
  isContentEmpty(content: string, configuration?: string): boolean {
    // For habit tracker, we consider it empty if no title is set in the section
    // Since we can't access the title here, we'll return false to indicate not empty
    // The actual validation happens at the component level
    return false;
  }

  validateContent(content: string): SectionValidationResult {
    try {
      // Validate content format (dynamic data)
      parseHabitDynamicData(content);
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
    return parseHabitDynamicData(rawContent);
  }

  serializeContent(data: SectionContentData): string {
    return JSON.stringify(data);
  }

  // Default content - just dynamic data
  getDefaultContent(): string {
    return JSON.stringify({
      completedDates: [],
      createdAt: new Date().toISOString().split('T')[0],
    });
  }

  // Markdown export
  formatToMarkdown(
    title: string,
    content: string,
    configuration?: string
  ): string {
    if (!title?.trim()) return '';

    try {
      const data = parseHabitData(content, configuration || '', title);
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

  // Property configuration - individual fields that will be saved to configuration
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
        key: 'habit_color',
        label: 'Color',
        type: 'text',
        placeholder: '#3B82F6',
        defaultValue: '#3B82F6',
      },
      {
        key: 'habit_frequency',
        label: 'Frequency',
        type: 'select',
        options: [
          { value: 'daily', label: 'Daily' },
          { value: 'weekly', label: 'Weekly' },
        ],
        defaultValue: 'daily',
      },
      {
        key: 'refresh_frequency',
        label: 'Duration',
        type: 'select',
        options: [
          { value: 'persistent', label: 'Persistent (across all entries)' },
        ],
        defaultValue: 'persistent',
        hidden: true, // Hide fields with only one option
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
