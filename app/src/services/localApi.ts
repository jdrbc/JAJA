import database from '../database/watermelon/database';
import {
  JournalEntry as JournalEntryModel,
  TemplateColumn,
  TemplateSection,
  Section,
  SectionJournalEntry,
} from '../database/watermelon/models';
import {
  JournalEntry,
  SectionTemplate,
  Column,
  SectionWithContent,
} from './api';
import { logger } from '../utils/logger';
import { SectionRegistry } from '../components/sections/core/SectionRegistry';
import { Q } from '@nozbe/watermelondb';
import { SectionService } from './sectionService';

export class LocalApiService {
  private sectionService = new SectionService();

  // Template Management
  async fetchTemplates(): Promise<{
    columns: Column[];
    sections: SectionTemplate[];
  }> {
    try {
      // Fetch columns
      const columnRecords = await database.collections
        .get<TemplateColumn>('template_columns')
        .query(Q.sortBy('display_order'))
        .fetch();

      const columns: Column[] = columnRecords.map(record => ({
        id: record.id,
        title: record.title,
        width: record.width,
        display_order: record.displayOrder,
      }));

      // Fetch sections
      const sectionRecords = await database.collections
        .get<TemplateSection>('template_sections')
        .query(Q.sortBy('display_order'))
        .fetch();

      const sections: SectionTemplate[] = sectionRecords.map(record => ({
        id: record.id,
        title: record.title,
        refresh_frequency: record.refreshFrequency,
        display_order: record.displayOrder,
        placeholder: record.placeholder,
        default_content: record.defaultContent,
        content_type: record.contentType,
        column_id: record.columnId,
      }));

      return { columns, sections };
    } catch (error) {
      logger.error('Error fetching templates:', error);
      throw error;
    }
  }

  async fetchEntryByDate(date: string): Promise<JournalEntry | null> {
    logger.log(`fetchEntryByDate called for date: ${date}`);

    try {
      // Get entry
      const entryRecords = await database.collections
        .get<JournalEntryModel>('journal_entries')
        .query(Q.where('date', date))
        .fetch();

      const entry: JournalEntryModel | null = entryRecords[0] || null;

      // Get templates for section structure
      const templates = await this.fetchTemplates();
      const sectionsData: { [key: string]: SectionWithContent } = {};

      // If entry exists, get its sections
      if (entry) {
        logger.log(`Entry found for ${date}, entry ID: ${entry.id}`);

        const sectionsWithTemplates =
          await this.sectionService.getSectionsForEntry(entry.id);
        const existingSectionsMap: { [key: string]: any } = {};

        sectionsWithTemplates.forEach((section: any) => {
          existingSectionsMap[section.type] = section;
        });

        // Build sections data
        for (const template of templates.sections) {
          const existingSection = existingSectionsMap[template.id];

          if (
            existingSection &&
            this.isNotBlankContent(
              existingSection.contentType,
              existingSection.content
            )
          ) {
            // Section exists with content
            sectionsData[template.id] = {
              content: existingSection.content,
              title: template.title,
              refresh_frequency: template.refresh_frequency,
              placeholder: template.placeholder,
              content_type: template.content_type,
              id: template.id,
              display_order: template.display_order,
              default_content: template.default_content,
              column_id: template.column_id,
            };
          } else {
            // Get or create section for this timeframe
            let section: { id: string; content: string };

            await database.write(async () => {
              section = await this.sectionService.getOrCreateSection(
                template.id,
                date
              );

              // Link to entry
              await this.sectionService.linkSectionToEntry(
                section.id,
                entry.id
              );
            });

            sectionsData[template.id] = {
              content: section!.content || template.default_content || '',
              title: template.title,
              refresh_frequency: template.refresh_frequency,
              placeholder: template.placeholder,
              content_type: template.content_type,
              id: template.id,
              display_order: template.display_order,
              default_content: template.default_content,
              column_id: template.column_id,
            };
          }
        }
      } else {
        logger.log(`No entry found for ${date}, creating empty structure`);
        // No entry exists, create empty structure with timeframe sections
        for (const template of templates.sections) {
          let section: { id: string; content: string };

          await database.write(async () => {
            section = await this.sectionService.getOrCreateSection(
              template.id,
              date
            );
          });

          sectionsData[template.id] = {
            content: section!.content || template.default_content || '',
            title: template.title,
            refresh_frequency: template.refresh_frequency,
            placeholder: template.placeholder,
            content_type: template.content_type,
            id: template.id,
            display_order: template.display_order,
            default_content: template.default_content,
            column_id: template.column_id,
          };
        }
      }

      logger.log(
        `fetchEntryByDate returning entry for ${date} with ${Object.keys(sectionsData).length} sections`
      );
      logger.log(sectionsData);
      return {
        date,
        sections: sectionsData,
      };
    } catch (error) {
      logger.error('Error fetching entry:', error);
      throw error;
    }
  }

  private isNotBlankContent(contentType: string, content: string): boolean {
    const registry = SectionRegistry.getInstance();
    return !registry.isContentEmpty(contentType, content);
  }

  private async getOrCreateJournalEntry(
    date: string
  ): Promise<JournalEntryModel> {
    const entryRecords = await database.collections
      .get<JournalEntryModel>('journal_entries')
      .query(Q.where('date', date))
      .fetch();

    if (entryRecords.length > 0) {
      const journalEntry = entryRecords[0];
      logger.log('Updated existing entry with ID:', journalEntry.id);
      return journalEntry;
    } else {
      // Create new entry
      const journalEntry = await database.collections
        .get<JournalEntryModel>('journal_entries')
        .create((record: JournalEntryModel) => {
          record.date = date;
        });
      logger.log('Created new entry with ID:', journalEntry.id);
      return journalEntry;
    }
  }

  private async getExistingSectionsMap(
    journalEntryId: string
  ): Promise<{ [key: string]: any }> {
    const existingSections =
      await this.sectionService.getSectionsForEntry(journalEntryId);
    const existingSectionsMap: { [key: string]: any } = {};

    existingSections.forEach((section: any) => {
      existingSectionsMap[section.type] = section;
    });

    return existingSectionsMap;
  }

  private async processSectionUpdate(
    sectionType: string,
    sectionData: any,
    existingSectionsMap: { [key: string]: any },
    journalEntryId: string,
    date: string
  ): Promise<void> {
    const existingSection = existingSectionsMap[sectionType];

    if (existingSection) {
      // Use existing section that's already linked to this entry
      logger.log(
        'Updating existing linked section:',
        existingSection.id,
        sectionData.content
      );
      await this.sectionService.updateSectionContent(
        existingSection.id,
        sectionData.content
      );
    } else {
      // No existing section linked to this entry, get or create one
      const section = await this.sectionService.getOrCreateSection(
        sectionType,
        date
      );

      // Link section to this journal entry
      await this.sectionService.linkSectionToEntry(section.id, journalEntryId);

      // Update section content
      await this.sectionService.updateSectionContent(
        section.id,
        sectionData.content
      );
    }
  }

  // Simplified updateEntry method
  async updateEntry(date: string, entry: JournalEntry): Promise<JournalEntry> {
    try {
      await database.write(async () => {
        // Get or create journal entry
        const journalEntry = await this.getOrCreateJournalEntry(date);

        // Get existing sections that are already linked to this journal entry
        const existingSectionsMap = await this.getExistingSectionsMap(
          journalEntry.id
        );

        // Process each section update
        for (const [sectionType, sectionData] of Object.entries(
          entry.sections
        )) {
          await this.processSectionUpdate(
            sectionType,
            sectionData,
            existingSectionsMap,
            journalEntry.id,
            date
          );
        }
      });

      return entry;
    } catch (error) {
      logger.error('Error updating entry:', error);
      throw error;
    }
  }

  async deleteEntry(date: string): Promise<void> {
    try {
      await database.write(async () => {
        const entryRecords = await database.collections
          .get<JournalEntryModel>('journal_entries')
          .query(Q.where('date', date))
          .fetch();

        if (entryRecords.length > 0) {
          await entryRecords[0].destroyPermanently();
        }
      });
    } catch (error) {
      logger.error('Error deleting entry:', error);
      throw error;
    }
  }

  async createTemplateColumn(columnData: Column): Promise<Column> {
    try {
      await database.write(async () => {
        await database.collections
          .get<TemplateColumn>('template_columns')
          .create((record: TemplateColumn) => {
            record.title = columnData.title;
            record.width = columnData.width;
            record.displayOrder = columnData.display_order;
          });
      });

      return columnData;
    } catch (error) {
      logger.error('Error creating template column:', error);
      throw error;
    }
  }

  async updateTemplateColumn(
    id: string,
    columnData: Partial<Column>
  ): Promise<Column> {
    try {
      let updatedColumn: Column;

      await database.write(async () => {
        const record = await database.collections
          .get<TemplateColumn>('template_columns')
          .find(id);

        await record.update((column: TemplateColumn) => {
          if (columnData.title !== undefined) column.title = columnData.title;
          if (columnData.width !== undefined) column.width = columnData.width;
          if (columnData.display_order !== undefined)
            column.displayOrder = columnData.display_order;
        });

        updatedColumn = {
          id: record.id,
          title: record.title,
          width: record.width,
          display_order: record.displayOrder,
        };
      });

      return updatedColumn!;
    } catch (error) {
      logger.error('Error updating template column:', error);
      throw error;
    }
  }

  async deleteTemplateColumn(id: string): Promise<void> {
    try {
      await database.write(async () => {
        const record = await database.collections
          .get<TemplateColumn>('template_columns')
          .find(id);
        await record.destroyPermanently();
      });
    } catch (error) {
      logger.error('Error deleting template column:', error);
      throw error;
    }
  }

  async batchUpdateColumnOrders(
    columns: Array<{ id: string; display_order: number }>
  ): Promise<void> {
    try {
      await database.write(async () => {
        for (const column of columns) {
          const record = await database.collections
            .get<TemplateColumn>('template_columns')
            .find(column.id);
          await record.update((col: TemplateColumn) => {
            col.displayOrder = column.display_order;
          });
        }
      });
    } catch (error) {
      logger.error('Error batch updating column orders:', error);
      throw error;
    }
  }

  async batchUpdateSectionOrders(
    sections: Array<{ id: string; display_order: number }>
  ): Promise<void> {
    try {
      await database.write(async () => {
        for (const section of sections) {
          const record = await database.collections
            .get<TemplateSection>('template_sections')
            .find(section.id);
          await record.update((sec: TemplateSection) => {
            sec.displayOrder = section.display_order;
          });
        }
      });
    } catch (error) {
      logger.error('Error batch updating section orders:', error);
      throw error;
    }
  }

  async createTemplateSection(
    sectionData: SectionTemplate
  ): Promise<SectionTemplate> {
    try {
      await database.write(async () => {
        await database.collections
          .get<TemplateSection>('template_sections')
          .create((record: TemplateSection) => {
            record.title = sectionData.title;
            record.refreshFrequency = sectionData.refresh_frequency;
            record.displayOrder = sectionData.display_order;
            record.placeholder = sectionData.placeholder || '';
            record.defaultContent = sectionData.default_content || '';
            record.contentType = sectionData.content_type;
            record.columnId = sectionData.column_id || '';
          });
      });

      return sectionData;
    } catch (error) {
      logger.error('Error creating template section:', error);
      throw error;
    }
  }

  async updateTemplateSection(
    id: string,
    sectionData: Partial<SectionTemplate>
  ): Promise<SectionTemplate> {
    try {
      let updatedSection: SectionTemplate;

      await database.write(async () => {
        const record = await database.collections
          .get<TemplateSection>('template_sections')
          .find(id);

        // Check if frequency is being changed
        const isFrequencyChanging =
          sectionData.refresh_frequency !== undefined &&
          sectionData.refresh_frequency !== record.refreshFrequency;

        await record.update((section: TemplateSection) => {
          if (sectionData.title !== undefined)
            section.title = sectionData.title;
          if (sectionData.refresh_frequency !== undefined)
            section.refreshFrequency = sectionData.refresh_frequency;
          if (sectionData.display_order !== undefined)
            section.displayOrder = sectionData.display_order;
          if (sectionData.placeholder !== undefined)
            section.placeholder = sectionData.placeholder;
          if (sectionData.default_content !== undefined)
            section.defaultContent = sectionData.default_content;
          if (sectionData.content_type !== undefined)
            section.contentType = sectionData.content_type;
          if (sectionData.column_id !== undefined)
            section.columnId = sectionData.column_id;
        });

        // If frequency changed, update the most recent section
        if (isFrequencyChanging) {
          await this.sectionService.updateMostRecentSectionForFrequencyChange(
            id,
            sectionData.refresh_frequency!
          );
        }

        updatedSection = {
          id: record.id,
          title: record.title,
          refresh_frequency: record.refreshFrequency,
          display_order: record.displayOrder,
          placeholder: record.placeholder,
          default_content: record.defaultContent,
          content_type: record.contentType,
          column_id: record.columnId,
        };
      });

      return updatedSection!;
    } catch (error) {
      logger.error('Error updating template section:', error);
      throw error;
    }
  }

  async deleteTemplateSection(id: string): Promise<void> {
    try {
      await database.write(async () => {
        // First, find all sections that use this template
        const sectionsCollection =
          database.collections.get<Section>('sections');
        const sectionsToDelete = await sectionsCollection
          .query(Q.where('type', id))
          .fetch();

        // For each section, delete its journal entry junctions first
        const junctionCollection =
          database.collections.get<SectionJournalEntry>(
            'section_journal_entries'
          );
        for (const section of sectionsToDelete) {
          const junctions = await junctionCollection
            .query(Q.where('section_id', section.id))
            .fetch();

          // Delete all junctions for this section
          for (const junction of junctions) {
            await junction.destroyPermanently();
          }

          // Delete the section itself
          await section.destroyPermanently();
        }

        // Finally, delete the template section
        const record = await database.collections
          .get<TemplateSection>('template_sections')
          .find(id);
        await record.destroyPermanently();
      });
    } catch (error) {
      logger.error('Error deleting template section:', error);
      throw error;
    }
  }
}

// Create and export singleton instance
export const localApiService = new LocalApiService();
