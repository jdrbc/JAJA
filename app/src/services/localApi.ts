import database from '../database/watermelon/database';
import {
  JournalEntry as JournalEntryModel,
  Section as SectionModel,
  TemplateColumn,
  TemplateSection,
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

export class LocalApiService {
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

  // Journal Entry Management
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

        const existingSections = await entry.sections;
        const existingSectionsMap: { [key: string]: SectionModel } = {};

        existingSections.forEach((section: SectionModel) => {
          logger.log(
            `Found existing section: ${section.type}, content length: ${section.content?.length || 0}`
          );
          existingSectionsMap[section.type] = section;
        });

        // Build sections data with template info
        for (const template of templates.sections) {
          const existingSection = existingSectionsMap[template.id];
          let content = '';

          if (
            existingSection !== undefined &&
            existingSection.content !== '' &&
            existingSection.content !== null &&
            this.isNotBlankContent(
              template.content_type,
              existingSection.content
            )
          ) {
            // Section exists in database - use its content
            content = existingSection.content ?? '';
          } else {
            // Section doesn't exist in database - get persisted content or default
            content =
              (await this.getExistingSectionContent(
                date,
                template.id,
                template.refresh_frequency
              )) ||
              template.default_content ||
              '';
            logger.log(
              `Using fallback content for ${template.id}: "${content}" (length: ${content.length})`
            );
          }

          sectionsData[template.id] = {
            content,
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
      } else {
        logger.log(`No entry found for ${date}, creating empty structure`);
        // No entry exists, create empty structure with persisted content
        for (const template of templates.sections) {
          const persistedContent = await this.getExistingSectionContent(
            date,
            template.id,
            template.refresh_frequency
          );

          sectionsData[template.id] = {
            content: persistedContent || template.default_content || '',
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

  private async getExistingSectionContent(
    entryDate: string,
    sectionType: string,
    refreshFrequency: string
  ): Promise<string | null> {
    try {
      let startDate: string;

      // Calculate start date based on refresh frequency
      const entryDateObj = new Date(entryDate);
      switch (refreshFrequency) {
        case 'daily':
          startDate = entryDate;
          break;
        case 'weekly':
          const weekStart = new Date(entryDateObj);
          weekStart.setDate(entryDateObj.getDate() - entryDateObj.getDay());
          startDate = weekStart.toISOString().split('T')[0];
          break;
        case 'monthly':
          const monthStart = new Date(
            entryDateObj.getFullYear(),
            entryDateObj.getMonth(),
            1
          );
          startDate = monthStart.toISOString().split('T')[0];
          break;
        default:
          startDate = entryDate;
      }

      // Find sections with content in the time period
      const sectionsCollection =
        database.collections.get<SectionModel>('sections');
      const sectionsWithContent = await sectionsCollection
        .query(
          Q.where('type', sectionType),
          Q.where('content', Q.notEq('')),
          Q.on('journal_entries', [
            Q.where('date', Q.gte(startDate)),
            Q.where('date', Q.lt(entryDate)),
          ]),
          Q.sortBy('created_at', Q.desc),
          Q.take(1)
        )
        .fetch();

      if (sectionsWithContent.length > 0) {
        const section = sectionsWithContent[0];
        const contentType = section.contentType;

        // Check if content is not blank using the registry
        if (this.isNotBlankContent(contentType, section.content)) {
          logger.log(
            `Found persisted content for ${sectionType} from period starting ${startDate}: ${section.content.substring(0, 50)}...`
          );
          return section.content;
        }
      }

      return null;
    } catch (error) {
      logger.error('Error getting existing section content:', error);
      return null;
    }
  }

  async updateEntry(date: string, entry: JournalEntry): Promise<JournalEntry> {
    try {
      await database.write(async () => {
        // Get or create journal entry
        const entryRecords = await database.collections
          .get<JournalEntryModel>('journal_entries')
          .query(Q.where('date', date))
          .fetch();

        let journalEntry: JournalEntryModel;
        if (entryRecords.length > 0) {
          journalEntry = entryRecords[0];
        } else {
          // Create new entry
          journalEntry = await database.collections
            .get<JournalEntryModel>('journal_entries')
            .create((record: JournalEntryModel) => {
              record.date = date;
            });
          logger.log('Created new entry with ID:', journalEntry.id);
        }

        // Update sections
        logger.log('About to update sections for entry:', journalEntry.id);
        for (const [sectionType, sectionData] of Object.entries(
          entry.sections
        )) {
          // Check if section exists
          const existingSections = await database.collections
            .get<SectionModel>('sections')
            .query(
              Q.where('entry_id', journalEntry.id),
              Q.where('type', sectionType)
            )
            .fetch();

          if (existingSections.length > 0) {
            // Update existing section
            const existingSection = existingSections[0];
            await existingSection.update((section: SectionModel) => {
              section.content = sectionData.content;
            });
          } else {
            // Create new section
            await database.collections
              .get<SectionModel>('sections')
              .create((section: SectionModel) => {
                section.entryId = journalEntry.id;
                section.type = sectionType;
                section.content = sectionData.content;
                section.refreshFrequency = sectionData.refresh_frequency;
                section.contentType = sectionData.content_type || '';
              });
          }
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
