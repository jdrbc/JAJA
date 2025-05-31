import { useState, useCallback } from 'react';
import { Column, SectionTemplate } from '../services/api';
import localApiService from '../services/localApi';
import { useEditMode } from '../contexts/EditModeContext';

export const useTemplateManagement = () => {
  const { setIsDirty } = useEditMode();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Column operations
  const createColumn = useCallback(
    async (columnData: Omit<Column, 'display_order'>) => {
      setIsLoading(true);
      setError(null);
      try {
        // Get current max display_order
        const templates = await localApiService.fetchTemplates();
        const maxOrder = Math.max(
          ...templates.columns.map(c => c.display_order),
          -1
        );

        const newColumn: Column = {
          ...columnData,
          display_order: maxOrder + 1,
        };

        await localApiService.createTemplateColumn(newColumn);
        setIsDirty(true);
        return newColumn;
      } catch (err) {
        setError('Failed to create column');
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [setIsDirty]
  );

  const updateColumn = useCallback(
    async (id: string, updates: Partial<Column>) => {
      setIsLoading(true);
      setError(null);
      try {
        const updatedColumn = await localApiService.updateTemplateColumn(
          id,
          updates
        );
        setIsDirty(true);
        return updatedColumn;
      } catch (err) {
        setError('Failed to update column');
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [setIsDirty]
  );

  const deleteColumn = useCallback(
    async (id: string) => {
      setIsLoading(true);
      setError(null);
      try {
        await localApiService.deleteTemplateColumn(id);
        setIsDirty(true);
      } catch (err) {
        setError('Failed to delete column');
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [setIsDirty]
  );

  const reorderColumns = useCallback(
    async (columns: Column[]) => {
      setIsLoading(true);
      setError(null);
      try {
        // Use batch update for better performance and atomicity
        const columnOrders = columns.map((column, index) => ({
          id: column.id,
          display_order: index,
        }));
        await localApiService.batchUpdateColumnOrders(columnOrders);
        setIsDirty(true);
      } catch (err) {
        setError('Failed to reorder columns');
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [setIsDirty]
  );

  // Section operations
  const createSection = useCallback(
    async (sectionData: Omit<SectionTemplate, 'display_order'>) => {
      setIsLoading(true);
      setError(null);
      try {
        // Get current max display_order for the column
        const templates = await localApiService.fetchTemplates();
        const sectionsInColumn = templates.sections.filter(
          s => s.column_id === sectionData.column_id
        );
        const maxOrder = Math.max(
          ...sectionsInColumn.map(s => s.display_order),
          -1
        );

        const newSection: SectionTemplate = {
          ...sectionData,
          display_order: maxOrder + 1,
        };

        await localApiService.createTemplateSection(newSection);
        setIsDirty(true);
        return newSection;
      } catch (err) {
        setError('Failed to create section');
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [setIsDirty]
  );

  const updateSection = useCallback(
    async (id: string, updates: Partial<SectionTemplate>) => {
      setIsLoading(true);
      setError(null);
      try {
        const updatedSection = await localApiService.updateTemplateSection(
          id,
          updates
        );
        setIsDirty(true);
        return updatedSection;
      } catch (err) {
        setError('Failed to update section');
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [setIsDirty]
  );

  const updateSectionSilent = useCallback(
    async (id: string, updates: Partial<SectionTemplate>) => {
      setIsLoading(true);
      setError(null);
      try {
        const updatedSection = await localApiService.updateTemplateSection(
          id,
          updates
        );
        // Don't set isDirty to avoid triggering template reload
        return updatedSection;
      } catch (err) {
        setError('Failed to update section');
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const deleteSection = useCallback(
    async (id: string) => {
      setIsLoading(true);
      setError(null);
      try {
        await localApiService.deleteTemplateSection(id);
        setIsDirty(true);
      } catch (err) {
        setError('Failed to delete section');
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [setIsDirty]
  );

  const reorderSections = useCallback(
    async (sections: SectionTemplate[]) => {
      setIsLoading(true);
      setError(null);
      try {
        // Use batch update for better performance and atomicity
        const sectionOrders = sections.map((section, index) => ({
          id: section.id,
          display_order: index,
        }));
        await localApiService.batchUpdateSectionOrders(sectionOrders);
        setIsDirty(true);
      } catch (err) {
        setError('Failed to reorder sections');
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [setIsDirty]
  );

  const moveSectionToColumn = useCallback(
    async (sectionId: string, targetColumnId: string) => {
      setIsLoading(true);
      setError(null);
      try {
        // Get current templates to calculate new display_order
        const templates = await localApiService.fetchTemplates();
        const sectionsInTargetColumn = templates.sections.filter(
          s => s.column_id === targetColumnId
        );
        const maxOrder = Math.max(
          ...sectionsInTargetColumn.map(s => s.display_order),
          -1
        );

        await localApiService.updateTemplateSection(sectionId, {
          column_id: targetColumnId,
          display_order: maxOrder + 1,
        });
        setIsDirty(true);
      } catch (err) {
        setError('Failed to move section');
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [setIsDirty]
  );

  return {
    isLoading,
    error,
    // Column operations
    createColumn,
    updateColumn,
    deleteColumn,
    reorderColumns,
    // Section operations
    createSection,
    updateSection,
    updateSectionSilent,
    deleteSection,
    reorderSections,
    moveSectionToColumn,
  };
};
