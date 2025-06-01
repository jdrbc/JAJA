import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { addDays, isSameDay, parse, isValid, format } from 'date-fns';
import ColumnLayout from '../components/layout/ColumnLayout';
import JournalHeader from '../components/layout/JournalHeader';
import { SaveIndicator } from '../components/SaveIndicator';

import {
  JournalEntry,
  SectionTemplate,
  SectionWithContent,
  Column,
} from '../services/api';
import localApiService from '../services/localApi';
import { formatDateForAPI } from '../utils/dates';
import { logger } from '../utils/logger';
import { createDebouncedEntrySaveWithCallback } from '../utils/debounceUtils';
import { useSaveStatus } from '../hooks/useSaveStatus';

const JournalEntryPage: React.FC = () => {
  const [entry, setEntry] = useState<JournalEntry | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<SectionTemplate[]>([]);
  const [columns, setColumns] = useState<Column[]>([]);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied'>('idle');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Save status hook
  const {
    status,
    statusText,
    statusColor,
    markPending,
    markLocalSaved,
    markError,
  } = useSaveStatus();

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

  // Fetch section templates from local API
  const loadTemplates = useCallback(async () => {
    try {
      const templateConfig = await localApiService.fetchTemplates();
      setTemplates(templateConfig.sections);
      setColumns(
        templateConfig.columns.sort((a, b) => a.display_order - b.display_order)
      );
    } catch (err) {
      setError(
        'Failed to load section templates. Some features may be limited.'
      );
      logger.error(err);
    }
  }, []);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  // Load entry when date changes
  useEffect(() => {
    const loadEntry = async () => {
      setIsLoading(true);
      try {
        const formattedDate = formatDateForAPI(currentDate);
        const fetchedEntry =
          await localApiService.fetchEntryByDate(formattedDate);

        if (fetchedEntry) {
          setEntry(fetchedEntry);
        } else {
          // Create an empty entry structure
          setEntry({
            date: formattedDate,
            sections: {},
          });
        }

        setError(null);
      } catch (err) {
        setError('Failed to load journal entry. Please try again.');
        logger.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    loadEntry();
  }, [currentDate]);

  // Debounced save function with completion callbacks
  const debouncedSave = useCallback(() => {
    return createDebouncedEntrySaveWithCallback(
      (date: string, entry: any) => {
        return localApiService.updateEntry(date, entry);
      },
      markLocalSaved, // onComplete
      markError // onError
    );
  }, [markLocalSaved, markError]);

  // Handle section content changes
  const handleSectionChange = (sectionId: string, content: string) => {
    if (!entry) return;

    const updatedEntry = {
      ...entry,
      sections: {
        ...entry.sections,
        [sectionId]: {
          ...entry.sections[sectionId],
          content,
        },
      },
    };

    setEntry(updatedEntry);
    markPending(); // Mark that changes are pending
    debouncedSave()(updatedEntry);
  };

  // Convert entry sections to SectionWithContent format for ColumnLayout
  const getSections = (): SectionWithContent[] => {
    if (!entry || !templates.length) return [];

    return templates
      .map(template => {
        const sectionData = entry.sections[template.id];
        return {
          ...template,
          content: sectionData?.content || '',
        };
      })
      .sort((a, b) => a.display_order - b.display_order);
  };

  // Copy entry content to clipboard
  const copyToClipboard = async () => {
    if (!entry) return;

    try {
      const entryText = Object.entries(entry.sections)
        .map(([sectionId, section]) => {
          const template = templates.find(t => t.id === sectionId);
          const title = template?.title || sectionId;
          return `${title}:\n${section.content}\n`;
        })
        .join('\n');

      const fullText = `Journal Entry - ${format(currentDate, 'MMMM d, yyyy')}\n\n${entryText}`;

      await navigator.clipboard.writeText(fullText);
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
        onCopyToClipboard={copyToClipboard}
        saveStatus={status}
        saveStatusText={statusText}
        saveStatusColor={statusColor}
      />

      {entry && (
        <ColumnLayout
          entry={entry}
          sections={getSections()}
          columns={columns}
          onContentChange={handleSectionChange}
        />
      )}

      {/* Mobile floating save indicator */}
      <SaveIndicator
        status={status}
        statusText={statusText}
        statusColor={statusColor}
        variant='mobile'
      />
    </div>
  );
};

export default JournalEntryPage;
