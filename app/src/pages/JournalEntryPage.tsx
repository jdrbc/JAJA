import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { addDays, isSameDay, parse, isValid, format } from 'date-fns';
import ColumnLayout from '../components/layout/ColumnLayout';
import JournalHeader from '../components/layout/JournalHeader';
import { SaveIndicator } from '../components/SaveIndicator';
import { ContentUndoToolbar } from '../components/ContentUndoToolbar';

import {
  SectionTemplate,
  SectionWithContent,
  JournalEntry,
} from '../services/api';
import { formatDateForAPI } from '../utils/dates';
import { logger } from '../utils/logger';
import { useJournalEntry, useTemplates } from '../services/reactiveDataService';
import { createDebouncedSave } from '../utils/debounceUtils';
import { useSyncStore, useSyncStatus } from '../stores/syncStore';
import { useContentUndo } from '../hooks/useContentUndo';
import { sectionRegistry } from '../components/sections/registry';

const JournalEntryPage: React.FC = () => {
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied'>('idle');
  // Local state to store immediate changes without triggering re-renders
  const [localEntry, setLocalEntry] = useState<JournalEntry | null>(null);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Get sync store actions and status
  const { setPending, completeSync, failSync } = useSyncStore();
  const syncStatus = useSyncStatus();

  // Get undo/redo functions
  const { undo, redo, canUndo, canRedo, undoDescription } = useContentUndo();

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
      setLocalEntry(prevLocalEntry => {
        // Only update local state if we don't already have local changes
        // or if the entry is significantly different (e.g., from navigation)
        if (!prevLocalEntry || prevLocalEntry.date !== entry.date) {
          console.log('reload: date change');
          return entry;
        }

        // Check if the incoming entry has meaningful differences
        // If it's just the same data we already saved, don't update
        const hasSignificantChanges = Object.keys(entry.sections).some(
          sectionId => {
            const incomingContent = entry.sections[sectionId]?.content || '';
            const localContent =
              prevLocalEntry.sections[sectionId]?.content || '';

            if (incomingContent !== localContent) {
              console.log('reload: sig change in : ' + sectionId);

              // For complex JSON content (weekly/monthly sections), check if it's just metadata changes
              try {
                const incomingData = JSON.parse(incomingContent);
                const localData = JSON.parse(localContent);

                // If both are valid JSON, do a deeper comparison excluding volatile metadata
                if (
                  typeof incomingData === 'object' &&
                  typeof localData === 'object'
                ) {
                  // Create copies without metadata for comparison
                  const incomingCopy = { ...incomingData };
                  const localCopy = { ...localData };

                  // Remove volatile metadata fields that change on every save
                  if (incomingCopy.metadata) {
                    delete incomingCopy.metadata.generatedAt;
                  }
                  if (localCopy.metadata) {
                    delete localCopy.metadata.generatedAt;
                  }

                  // If the core content is the same after removing volatile metadata,
                  // this is likely just a save echo - don't treat as significant
                  const incomingStr = JSON.stringify(incomingCopy);
                  const localStr = JSON.stringify(localCopy);

                  if (incomingStr === localStr) {
                    console.log(
                      'reload: ignoring metadata-only change in: ' + sectionId
                    );
                    return false; // Not a significant change
                  }
                }
              } catch {
                // If not JSON or parsing fails, treat as significant change
              }

              return true; // Significant change detected
            }
            return false;
          }
        );

        if (hasSignificantChanges) {
          console.log(
            'reload: updating local entry due to significant changes'
          );
          return entry;
        } else {
          console.log(
            'reload: no significant changes, keeping current local entry'
          );
          return prevLocalEntry;
        }
      });
    }
  }, [entry]);

  // Update document title when date changes
  useEffect(() => {
    document.title = format(currentDate, 'MMMM d, yyyy');
  }, [currentDate]);

  // Navigation functions
  const navigateToDate = async (date: Date) => {
    // Clear local state immediately for clean transition
    setLocalEntry(null);

    // Navigate to new URL
    navigate(`/?date=${formatDateForAPI(date)}`);

    // The useJournalEntry hook will automatically refetch when formattedDate changes
    // due to the URL change, so we don't need to manually call refetch here
  };

  const navigateToNextDay = () => {
    // Prevent navigation while saves are pending or in progress
    if (syncStatus === 'pending' || syncStatus === 'syncing') {
      logger.log('Navigation blocked: saves in progress');
      return;
    }

    const nextDay = addDays(currentDate, 1);
    const today = new Date();

    // Don't allow navigating into the future
    if (nextDay <= today) {
      navigateToDate(nextDay);
    }
  };

  const navigateToPreviousDay = () => {
    // Prevent navigation while saves are pending or in progress
    if (syncStatus === 'pending' || syncStatus === 'syncing') {
      logger.log('Navigation blocked: saves in progress');
      return;
    }

    const previousDay = addDays(currentDate, -1);
    navigateToDate(previousDay);
  };

  const isCurrentDayToday = () => {
    const today = new Date();
    return isSameDay(currentDate, today);
  };

  // Handle section content changes with immediate local state update and debounced save
  const handleSectionChange = (sectionId: string, content: string) => {
    logger.log('handleSectionChange', sectionId, content);
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
      // Group sections by column and sort properly
      const sectionsWithContent = templates
        .map((template: SectionTemplate) => {
          const sectionData = localEntry.sections[template.id];
          return {
            ...template,
            content: sectionData?.content || '',
          };
        })
        .filter(section => section.content.trim() !== '' && section.column_id); // Remove empty sections and sections without column_id

      // Group sections by column
      const sectionsByColumn = sectionsWithContent.reduce(
        (acc, section) => {
          const columnId = section.column_id!; // Assert non-null since we filtered above
          if (!acc[columnId]) {
            acc[columnId] = [];
          }
          acc[columnId].push(section);
          return acc;
        },
        {} as Record<string, SectionWithContent[]>
      );

      // Sort columns by display_order (left to right)
      const sortedColumns = columns
        .filter(column => sectionsByColumn[column.id]?.length > 0) // Only include columns with content
        .sort((a, b) => a.display_order - b.display_order);

      // Generate markdown by column order, then section order within each column
      const markdownSections = sortedColumns
        .flatMap(column => {
          // Sort sections within this column by display_order (top to bottom)
          const columnSections = sectionsByColumn[column.id].sort(
            (a, b) => a.display_order - b.display_order
          );

          return columnSections.map(section =>
            sectionRegistry.formatToMarkdown(
              section.content_type,
              section.title,
              section.content
            )
          );
        })
        .filter(section => section.trim() !== '')
        .join('\n');

      const fullMarkdown = `# Journal Entry - ${format(currentDate, 'MMMM d, yyyy')}\n\n${markdownSections}`;

      await navigator.clipboard.writeText(fullMarkdown);
      setCopyStatus('copied');
      setTimeout(() => setCopyStatus('idle'), 2000);
    } catch (err) {
      logger.error('Failed to copy to clipboard:', err);
    }
  };

  // Enhanced undo/redo functions that cancel pending saves
  const handleUndo = async () => {
    // Cancel any pending debounced saves to prevent conflicts
    debouncedSave.cancel();
    await undo();
  };

  const handleRedo = async () => {
    // Cancel any pending debounced saves to prevent conflicts
    debouncedSave.cancel();
    await redo();
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
        navigationDisabled={
          syncStatus === 'pending' || syncStatus === 'syncing'
        }
      />

      {/* Content Undo/Redo Toolbar */}
      <div className='px-4 py-2 bg-gray-50 border-b border-gray-200'>
        <ContentUndoToolbar
          canUndo={canUndo}
          canRedo={canRedo}
          onUndo={handleUndo}
          onRedo={handleRedo}
          undoDescription={undoDescription}
        />
      </div>

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
