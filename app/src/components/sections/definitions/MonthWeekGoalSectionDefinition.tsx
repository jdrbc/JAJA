import React, { useState, useEffect, useRef } from 'react';
import {
  BaseSectionDefinition,
  SectionRenderProps,
  SectionPropertyConfig,
  SectionValidationResult,
  SectionContentData,
} from '../core/BaseSectionDefinition';
import { SmartGoalSuggestion } from '../../ui/SmartGoalSuggestion';
import { geminiService } from '../../../services/gemini';
import { logger } from '../../../utils/logger';

interface MonthlyGoal {
  id: string;
  text: string;
  rating: 'A' | 'B' | 'C' | 'D' | 'F' | '';
}

interface WeekData {
  id: string;
  label: string;
  dateRange: string;
  startDate: string;
  endDate: string;
  goals: string[];
}

interface MonthWeekGoalsData {
  monthlyGoals: MonthlyGoal[];
  weeks: WeekData[];
  metadata: {
    month: string;
    generatedAt: string;
  };
}

// Display Component
const MonthWeekGoalsDisplay: React.FC<SectionRenderProps> = ({
  content,
  placeholder,
}) => {
  const data = parseContent(content);

  if (!content || isContentEmpty(content)) {
    return (
      <div className='text-gray-400 italic p-3 cursor-pointer hover:bg-gray-50 rounded-md'>
        {placeholder || 'Click to set your monthly and weekly goals...'}
      </div>
    );
  }

  return (
    <div className='p-3 hover:bg-gray-50 rounded-md transition-colors cursor-pointer'>
      <div className='space-y-4'>
        {/* Monthly Goals */}
        <div>
          <div className='space-y-1'>
            {data.monthlyGoals.map(goal => (
              <div key={goal.id} className='flex items-center justify-between'>
                <span className='flex-1'>• {goal.text}</span>
                {goal.rating && (
                  <span className='ml-2 px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm font-medium'>
                    [{goal.rating}]
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Weekly Goals */}
        <div>
          <div className='space-y-3'>
            {data.weeks.map(week => (
              <div key={week.id} className='pl-4'>
                <div className='font-medium text-gray-700 mb-1'>
                  {week.label} ({week.dateRange})
                </div>
                {week.goals.length > 0 ? (
                  <div className='space-y-1'>
                    {week.goals.map((goal, index) => (
                      <div key={index} className='text-gray-600 pl-4'>
                        • {goal}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className='text-gray-400 pl-4 italic text-sm'>
                    No goals set for this week
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// Editor Component
const MonthWeekGoalsEditor: React.FC<SectionRenderProps> = ({
  content,
  onContentChange,
  placeholder,
}) => {
  const [data, setData] = useState<MonthWeekGoalsData>(() => {
    const parsed = parseContent(content);

    // If content is empty or weeks are missing, initialize with generated weeks
    if (!parsed.monthlyGoals) parsed.monthlyGoals = [];
    if (!parsed.weeks || parsed.weeks.length === 0) {
      const now = new Date();
      const currentMonth = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
      parsed.weeks = generateWeeksForMonth(
        now.getFullYear(),
        now.getMonth() + 1
      );
      parsed.metadata = {
        month: currentMonth,
        generatedAt: new Date().toISOString(),
      };
    }
    if (!parsed.metadata) {
      parsed.metadata = {
        month: '',
        generatedAt: new Date().toISOString(),
      };
    }
    return parsed;
  });

  const [editingGoal, setEditingGoal] = useState<{
    type: 'monthly' | 'weekly';
    id: string;
    goalIndex?: number;
  } | null>(null);
  const [suggestion, setSuggestion] = useState<string>('');
  const [loading, setLoading] = useState(false);

  // Use ref to track when we're updating content internally vs externally
  const isInternalUpdate = useRef(false);
  const lastContentRef = useRef(content);

  // Effect to handle content synchronization - only respond to external changes
  useEffect(() => {
    // Skip if this is an internal update or content hasn't changed
    if (isInternalUpdate.current || content === lastContentRef.current) {
      isInternalUpdate.current = false;
      return;
    }

    lastContentRef.current = content;

    // Handle empty/invalid content by initializing with generated weeks
    if (!content || content === '{}' || content === '') {
      const now = new Date();
      const currentMonth = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
      const newData = {
        monthlyGoals: [],
        weeks: generateWeeksForMonth(now.getFullYear(), now.getMonth() + 1),
        metadata: {
          month: currentMonth,
          generatedAt: new Date().toISOString(),
        },
      };
      setData(newData);

      // Mark as internal update and trigger change
      isInternalUpdate.current = true;
      onContentChange(serializeContent(newData));
      return;
    }

    // Parse new content from external source (database, etc.)
    try {
      const newData = parseContent(content);

      // Ensure weeks are generated for current month
      const now = new Date();
      const currentMonth = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;

      if (
        !newData.weeks ||
        newData.weeks.length === 0 ||
        newData.metadata.month !== currentMonth
      ) {
        newData.weeks = generateWeeksForMonth(
          now.getFullYear(),
          now.getMonth() + 1
        );
        newData.metadata = {
          month: currentMonth,
          generatedAt: new Date().toISOString(),
        };

        // Update both state and notify parent of generated weeks
        setData(newData);
        isInternalUpdate.current = true;
        onContentChange(serializeContent(newData));
      } else {
        // Just update state to match external content
        setData(newData);
      }
    } catch (error) {
      logger.error('Error parsing content:', error);
    }
  }, [content, onContentChange]);

  // Function to update data and save to database
  const updateDataAndSave = (newData: MonthWeekGoalsData) => {
    setData(newData);
    isInternalUpdate.current = true;
    lastContentRef.current = serializeContent(newData);
    onContentChange(serializeContent(newData));
  };

  const addMonthlyGoal = () => {
    const newData = {
      ...data,
      monthlyGoals: [
        ...data.monthlyGoals,
        { id: `goal-${Date.now()}`, text: '', rating: '' as const },
      ],
    };
    updateDataAndSave(newData);
  };

  const updateMonthlyGoal = (
    id: string,
    field: keyof MonthlyGoal,
    value: string
  ) => {
    const newData = {
      ...data,
      monthlyGoals: data.monthlyGoals.map(goal =>
        goal.id === id ? { ...goal, [field]: value } : goal
      ),
    };
    updateDataAndSave(newData);
  };

  const deleteMonthlyGoal = (id: string) => {
    const newData = {
      ...data,
      monthlyGoals: data.monthlyGoals.filter(goal => goal.id !== id),
    };
    updateDataAndSave(newData);
  };

  const addWeeklyGoal = (weekId: string) => {
    const newData = {
      ...data,
      weeks: data.weeks.map(week =>
        week.id === weekId ? { ...week, goals: [...week.goals, ''] } : week
      ),
    };
    updateDataAndSave(newData);
  };

  const updateWeeklyGoal = (
    weekId: string,
    goalIndex: number,
    value: string
  ) => {
    const newData = {
      ...data,
      weeks: data.weeks.map(week =>
        week.id === weekId
          ? {
              ...week,
              goals: week.goals.map((goal, index) =>
                index === goalIndex ? value : goal
              ),
            }
          : week
      ),
    };
    updateDataAndSave(newData);
  };

  const deleteWeeklyGoal = (weekId: string, goalIndex: number) => {
    const newData = {
      ...data,
      weeks: data.weeks.map(week =>
        week.id === weekId
          ? {
              ...week,
              goals: week.goals.filter((_, index) => index !== goalIndex),
            }
          : week
      ),
    };
    updateDataAndSave(newData);
  };

  const handleGoalTextChange = async (
    value: string,
    type: 'monthly' | 'weekly',
    id: string,
    goalIndex?: number
  ) => {
    if (type === 'monthly') {
      updateMonthlyGoal(id, 'text', value);
    } else {
      updateWeeklyGoal(id, goalIndex!, value);
    }

    // Request AI suggestion after a pause
    if (value.trim().length > 3) {
      setLoading(true);
      try {
        const contextData = serializeContent(data);
        const goalType = type === 'monthly' ? 'Monthly Goal' : 'Weekly Goal';
        const aiSuggestion = await geminiService.getSuggestion(
          value,
          goalType,
          contextData
        );
        setSuggestion(aiSuggestion);
      } catch (error) {
        logger.error('Error getting AI suggestion:', error);
      } finally {
        setLoading(false);
      }
    } else {
      setSuggestion('');
    }
  };

  const acceptSuggestion = () => {
    if (editingGoal && suggestion) {
      if (editingGoal.type === 'monthly') {
        updateMonthlyGoal(editingGoal.id, 'text', suggestion);
      } else {
        updateWeeklyGoal(editingGoal.id, editingGoal.goalIndex!, suggestion);
      }
      setSuggestion('');
      setEditingGoal(null);
    }
  };

  return (
    <div className='space-y-4 p-3'>
      {/* Monthly Goals */}
      <div>
        <div className='space-y-2'>
          {data.monthlyGoals.map(goal => (
            <div key={goal.id} className='flex items-start gap-2'>
              <div className='flex-1'>
                <textarea
                  value={goal.text}
                  onChange={e => {
                    handleGoalTextChange(e.target.value, 'monthly', goal.id);
                    setEditingGoal({ type: 'monthly', id: goal.id });
                  }}
                  placeholder='Enter monthly goal...'
                  className='w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[60px] resize-y'
                  rows={2}
                />
                {editingGoal?.type === 'monthly' &&
                  editingGoal.id === goal.id &&
                  suggestion && (
                    <SmartGoalSuggestion
                      suggestion={suggestion}
                      loading={loading}
                      onAccept={acceptSuggestion}
                      onDismiss={() => setSuggestion('')}
                    />
                  )}
              </div>
              <select
                value={goal.rating}
                onChange={e =>
                  updateMonthlyGoal(goal.id, 'rating', e.target.value)
                }
                className='px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500'
              >
                <option value=''>-</option>
                <option value='A'>A</option>
                <option value='B'>B</option>
                <option value='C'>C</option>
                <option value='D'>D</option>
                <option value='F'>F</option>
              </select>
              <button
                onClick={() => deleteMonthlyGoal(goal.id)}
                className='px-3 py-2 text-red-600 hover:bg-red-50 rounded-md'
              >
                x
              </button>
            </div>
          ))}
          <button
            onClick={addMonthlyGoal}
            className='w-full p-2 border-2 border-dashed border-gray-300 rounded-md text-gray-500 hover:border-blue-300 hover:text-blue-600'
          >
            + Add Monthly Goal
          </button>
        </div>
      </div>

      {/* Weekly Goals */}
      <div>
        <div className='space-y-3'>
          {data.weeks.map(week => (
            <div key={week.id} className='border-l-4 border-blue-200 pl-4'>
              <div className='font-medium text-gray-700 mb-1'>
                {week.label} ({week.dateRange})
              </div>
              <div className='space-y-1'>
                {week.goals.map((goal, goalIndex) => (
                  <div key={goalIndex} className='flex items-start gap-1'>
                    <textarea
                      value={goal}
                      onChange={e => {
                        handleGoalTextChange(
                          e.target.value,
                          'weekly',
                          week.id,
                          goalIndex
                        );
                        setEditingGoal({
                          type: 'weekly',
                          id: week.id,
                          goalIndex,
                        });
                      }}
                      placeholder='Enter weekly goal...'
                      className='flex-1 p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[50px] resize-y'
                      rows={2}
                    />
                    <button
                      onClick={() => deleteWeeklyGoal(week.id, goalIndex)}
                      className='px-3 py-2 text-red-600 hover:bg-red-50 rounded-md'
                    >
                      x
                    </button>
                  </div>
                ))}
                {editingGoal?.type === 'weekly' &&
                  editingGoal.id === week.id &&
                  suggestion && (
                    <SmartGoalSuggestion
                      suggestion={suggestion}
                      loading={loading}
                      onAccept={acceptSuggestion}
                      onDismiss={() => setSuggestion('')}
                    />
                  )}
                <button
                  onClick={() => addWeeklyGoal(week.id)}
                  className='w-full p-2 border-2 border-dashed border-gray-300 rounded-md text-gray-500 hover:border-blue-300 hover:text-blue-600'
                >
                  + Add Weekly Goal
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Helper functions
const parseContent = (content: string): MonthWeekGoalsData => {
  try {
    const parsed = JSON.parse(content || '{}');

    // Ensure all required properties exist with proper defaults
    return {
      monthlyGoals: Array.isArray(parsed.monthlyGoals)
        ? parsed.monthlyGoals
        : [],
      weeks: Array.isArray(parsed.weeks) ? parsed.weeks : [],
      metadata: {
        month: parsed.metadata?.month || '',
        generatedAt: parsed.metadata?.generatedAt || new Date().toISOString(),
      },
    };
  } catch {
    // Return safe defaults if parsing fails
    return {
      monthlyGoals: [],
      weeks: [],
      metadata: {
        month: '',
        generatedAt: new Date().toISOString(),
      },
    };
  }
};

const serializeContent = (data: MonthWeekGoalsData): string => {
  return JSON.stringify(data);
};

const isContentEmpty = (content: string): boolean => {
  try {
    const data = parseContent(content);
    return (
      (!data.monthlyGoals || data.monthlyGoals.length === 0) &&
      (!data.weeks ||
        data.weeks.every(
          (week: WeekData) => !week.goals || week.goals.length === 0
        ))
    );
  } catch {
    return true;
  }
};

const generateWeeksForMonth = (year: number, month: number): WeekData[] => {
  const weeks: WeekData[] = [];
  const firstDay = new Date(year, month - 1, 1);

  // Find first Monday of the current month
  const currentMonday = new Date(firstDay);
  const dayOfWeek = currentMonday.getDay();

  // If first day is not Monday, find the first Monday of the month
  if (dayOfWeek !== 1) {
    const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
    currentMonday.setDate(currentMonday.getDate() + daysUntilMonday);
  }

  let weekNumber = 1;
  while (currentMonday.getMonth() === month - 1) {
    const sunday = new Date(currentMonday);
    sunday.setDate(currentMonday.getDate() + 6);

    // Only include weeks where the Monday is in the current month
    if (currentMonday.getMonth() === month - 1) {
      const dateRange = formatDateRange(currentMonday, sunday);
      weeks.push({
        id: `week-${weekNumber}`,
        label: `Week ${weekNumber}`,
        dateRange,
        startDate: formatDate(currentMonday),
        endDate: formatDate(sunday),
        goals: [],
      });
      weekNumber++;
    }

    // Move to next Monday
    currentMonday.setDate(currentMonday.getDate() + 7);
  }

  return weeks;
};

const formatDate = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

const formatDateRange = (start: Date, end: Date): string => {
  const monthNames = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];

  const startMonth = monthNames[start.getMonth()];
  const endMonth = monthNames[end.getMonth()];
  const startDay = start.getDate();
  const endDay = end.getDate();
  const year = start.getFullYear();

  if (start.getMonth() === end.getMonth()) {
    return `${startMonth} ${startDay}-${endDay}, ${year}`;
  } else {
    return `${startMonth} ${startDay} - ${endMonth} ${endDay}, ${year}`;
  }
};

// Main Section Definition Class
export class MonthWeekGoalSectionDefinition extends BaseSectionDefinition {
  readonly id = 'month_week_goals';
  readonly name = 'Month & Week Goals';
  readonly description =
    'Set and track monthly goals with weekly breakdowns and AI-powered SMART goal suggestions';

  isContentEmpty(content: string): boolean {
    return isContentEmpty(content);
  }

  validateContent(content: string): SectionValidationResult {
    try {
      const data = parseContent(content);
      const errors: string[] = [];

      if (data.monthlyGoals.length === 0) {
        errors.push('At least one monthly goal is required');
      }

      data.monthlyGoals.forEach((goal, index) => {
        if (!goal.text.trim()) {
          errors.push(`Monthly goal ${index + 1} cannot be empty`);
        }
      });

      data.weeks.forEach((week, weekIndex) => {
        week.goals.forEach((goal, goalIndex) => {
          if (goal && !goal.trim()) {
            errors.push(
              `Week ${weekIndex + 1}, goal ${goalIndex + 1} cannot be empty`
            );
          }
        });
      });

      return {
        isValid: errors.length === 0,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error) {
      return {
        isValid: false,
        errors: ['Invalid content format'],
      };
    }
  }

  parseContent(rawContent: string): SectionContentData {
    return parseContent(rawContent);
  }

  serializeContent(data: SectionContentData): string {
    return serializeContent(data as MonthWeekGoalsData);
  }

  getDefaultContent(): string {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
    const weeks = generateWeeksForMonth(now.getFullYear(), now.getMonth() + 1);

    return JSON.stringify({
      monthlyGoals: [],
      weeks,
      metadata: {
        month: currentMonth,
        generatedAt: new Date().toISOString(),
      },
    });
  }

  formatToMarkdown(title: string, content: string): string {
    if (this.isContentEmpty(content)) return '';

    try {
      const data = parseContent(content);
      let markdown = `## ${title}\n\n`;

      // Monthly Goals
      if (data.monthlyGoals && data.monthlyGoals.length > 0) {
        markdown += '### Monthly Goals\n\n';
        data.monthlyGoals.forEach(goal => {
          const rating = goal.rating ? ` [${goal.rating}]` : '';
          markdown += `- ${goal.text}${rating}\n`;
        });
        markdown += '\n';
      }

      // Weekly Goals
      if (
        data.weeks &&
        data.weeks.some(week => week.goals && week.goals.length > 0)
      ) {
        markdown += '### Weekly Goals\n\n';
        data.weeks.forEach(week => {
          if (week.goals && week.goals.length > 0) {
            markdown += `**${week.label} (${week.dateRange})**\n`;
            week.goals.forEach(goal => {
              if (goal.trim()) {
                markdown += `- ${goal}\n`;
              }
            });
            markdown += '\n';
          }
        });
      }

      return markdown.trim();
    } catch (error) {
      return `## ${title}\n\n${content}\n`;
    }
  }

  getPropertyFields(): SectionPropertyConfig[] {
    return [
      {
        key: 'title',
        label: 'Title',
        type: 'text',
        placeholder: 'Section title',
        required: true,
        defaultValue: 'Month & Week Goals',
      },
      {
        key: 'placeholder',
        label: 'Placeholder',
        type: 'text',
        placeholder: 'Placeholder text',
        defaultValue: 'Set your monthly and weekly goals...',
      },
      {
        key: 'refresh_frequency',
        label: 'Refresh Frequency',
        type: 'select',
        options: [{ value: 'monthly', label: 'Monthly' }],
        defaultValue: 'monthly',
      },
      {
        key: 'gemini_enabled',
        label: 'Enable AI Suggestions',
        type: 'checkbox',
        defaultValue: true,
      },
      {
        key: 'auto_generate_weeks',
        label: 'Auto-generate weeks',
        type: 'checkbox',
        defaultValue: true,
      },
    ];
  }

  renderDisplay(props: SectionRenderProps): React.ReactElement {
    return <MonthWeekGoalsDisplay {...props} />;
  }

  renderEditor(props: SectionRenderProps): React.ReactElement {
    return <MonthWeekGoalsEditor {...props} />;
  }

  onContentUpdated?(content: string): void {
    logger.log('Month/Week goals updated:', content.length, 'characters');
  }

  onSectionCreated?(sectionId: string): void {
    logger.log('Month/Week goals section created:', sectionId);
  }
}
