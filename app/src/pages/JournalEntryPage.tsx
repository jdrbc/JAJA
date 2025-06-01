import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { addDays, isSameDay, parse, isValid, format } from 'date-fns';
import ColumnLayout from '../components/layout/ColumnLayout';
import JournalHeader from '../components/layout/JournalHeader';
import { SaveIndicator } from '../components/SaveIndicator';

import {
  SectionTemplate,
  SectionWithContent,
  JournalEntry,
} from '../services/api';
import { formatDateForAPI } from '../utils/dates';
import { logger } from '../utils/logger';
import { useJournalEntry, useTemplates } from '../services/reactiveDataService';
import { createDebouncedSave } from '../utils/debounceUtils';
import { useSyncStore } from '../stores/syncStore';
import { formatSectionToMarkdown } from '../utils/markdownFormatters';

const JournalEntryPage: React.FC = () => {
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied'>('idle');
  // Local state to store immediate changes without triggering re-renders
  const [localEntry, setLocalEntry] = useState<JournalEntry | null>(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Get sync store actions
  const { setPending, completeSync, failSync } = useSyncStore();

  // Get current date from URL or default to today
  const getCurrentDateFromUrl = useCallback((): Date => {
    const dateParam = searchParams.get('date');

    if (dateParam) {
      const parsedDate = parse(dateParam, 'yyyy-MM-dd', new Date());
      if (isValid(parsedDate)) {
        // Don't allow future dates
        const today = new Date();
        return parsedDate <= today ? parsedDate : today;
      }
    }

    return new Date();
  }, [searchParams]);

  // Memoize the date to prevent infinite renders
  const currentDate = useMemo(
    () => getCurrentDateFromUrl(),
    [getCurrentDateFromUrl]
  );

  // Use reactive hooks for data
  const formattedDate = formatDateForAPI(currentDate);
  const {
    entry,
    loading: isLoading,
    error,
    updateEntry,
  } = useJournalEntry(formattedDate);
  const { templates, columns } = useTemplates();

  // Create debounced save function
  const debouncedSave = useMemo(() => {
    return createDebouncedSave(
      async (entryData: JournalEntry) => {
        await updateEntry(entryData);
      },
      1000,
      () => setPending(), // Set pending immediately when changes are made
      () => completeSync(), // Mark as complete when save finishes
      error => failSync(error instanceof Error ? error.message : 'Save failed') // Handle errors
    );
  }, [updateEntry, setPending, completeSync, failSync]);

  // Update local state when entry changes from reactive service
  useEffect(() => {
    if (entry) {
      setLocalEntry(entry);
    }
  }, [entry]);

  // Update document title when date changes
  useEffect(() => {
    document.title = format(currentDate, 'MMMM d, yyyy');
  }, [currentDate]);

  // Navigation functions
  const navigateToDate = (date: Date) => {
    if (isLoading) return;
    navigate(`/?date=${formatDateForAPI(date)}`);
  };

  const navigateToNextDay = () => {
    const nextDay = addDays(currentDate, 1);
    const today = new Date();

    // Don't allow navigating into the future
    if (nextDay <= today) {
      navigateToDate(nextDay);
    }
  };

  const navigateToPreviousDay = () => {
    const previousDay = addDays(currentDate, -1);
    navigateToDate(previousDay);
  };

  const isCurrentDayToday = () => {
    const today = new Date();
    return isSameDay(currentDate, today);
  };

  // Handle section content changes with immediate local state update and debounced save
  const handleSectionChange = (sectionId: string, content: string) => {
    if (!localEntry) return;

    const updatedEntry = {
      ...localEntry,
      sections: {
        ...localEntry.sections,
        [sectionId]: {
          ...localEntry.sections[sectionId],
          content,
        },
      },
    };

    // Update local state immediately for responsive UI
    setLocalEntry(updatedEntry);

    // Save to database with debounce
    debouncedSave(updatedEntry);
  };

  // Convert entry sections to SectionWithContent format for ColumnLayout
  const getSections = (): SectionWithContent[] => {
    // Use localEntry instead of entry for immediate updates
    if (!localEntry || !templates.length) return [];

    return templates
      .map((template: SectionTemplate) => {
        const sectionData = localEntry.sections[template.id];
        return {
          ...template,
          content: sectionData?.content || '',
        };
      })
      .sort(
        (a: SectionWithContent, b: SectionWithContent) =>
          a.display_order - b.display_order
      );
  };

  // Copy entry content to markdown format
  const copyToMarkdown = async () => {
    if (!localEntry) return;

    try {
      const markdownSections = Object.entries(localEntry.sections)
        .map(([sectionId, section]) => {
          const template = templates.find(
            (t: SectionTemplate) => t.id === sectionId
          );
          if (!template) return '';

          return formatSectionToMarkdown({
            template,
            content: section.content,
          });
        })
        .filter(section => section.trim() !== '') // Remove empty sections
        .join('\n');

      const fullMarkdown = `# Journal Entry - ${format(currentDate, 'MMMM d, yyyy')}\n\n${markdownSections}`;

      await navigator.clipboard.writeText(fullMarkdown);
      setCopyStatus('copied');
      setTimeout(() => setCopyStatus('idle'), 2000);
    } catch (err) {
      logger.error('Failed to copy to clipboard:', err);
    }
  };

  if (isLoading) {
    return (
      <div className='min-h-screen bg-gray-50 flex items-center justify-center'>
        <div className='text-lg text-gray-600'>Loading journal entry...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className='min-h-screen bg-gray-50 flex items-center justify-center'>
        <div className='text-center'>
          <div className='text-lg text-red-600 mb-4'>{error}</div>
          <button
            onClick={() => window.location.reload()}
            className='px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700'
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className='min-h-screen bg-gray-50'>
      <JournalHeader
        currentDate={currentDate}
        onNavigateToNextDay={navigateToNextDay}
        onNavigateToPreviousDay={navigateToPreviousDay}
        isCurrentDayToday={isCurrentDayToday}
        copyStatus={copyStatus}
        onCopyToClipboard={copyToMarkdown}
      />

      {localEntry && (
        <ColumnLayout
          entry={localEntry}
          sections={getSections()}
          columns={columns}
          onContentChange={handleSectionChange}
        />
      )}

      {/* Mobile floating save indicator */}
      <SaveIndicator variant='mobile' />
    </div>
  );
};

export default JournalEntryPage;
