import databaseService from './database';
import {
  JournalEntry,
  SectionTemplate,
  Column,
  SectionWithContent,
} from './api';
import { logger } from '../utils/logger';

export class LocalApiService {
  private async ensureInitialized() {
    await databaseService.initialize();
  }

  // Template Management
  async fetchTemplates(): Promise<{
    columns: Column[];
    sections: SectionTemplate[];
  }> {
    await this.ensureInitialized();
    const db = databaseService.getConnection()!;

    try {
      // Fetch columns
      const columnsStmt = db.prepare(
        'SELECT * FROM template_columns ORDER BY display_order'
      );
      const columns: Column[] = [];
      while (columnsStmt.step()) {
        const row = columnsStmt.get({});
        columns.push({
          id: row.id as string,
          title: row.title as string,
          width:
            typeof row.width === 'number'
              ? row.width
              : parseInt(row.width as string) || 500,
          display_order: row.display_order as number,
        });
      }
      columnsStmt.finalize();

      // Fetch sections
      const sectionsStmt = db.prepare(
        'SELECT * FROM template_sections ORDER BY display_order'
      );
      const sections: SectionTemplate[] = [];
      while (sectionsStmt.step()) {
        const row = sectionsStmt.get({});
        sections.push({
          id: row.id as string,
          title: row.title as string,
          refresh_frequency: row.refresh_frequency as string,
          display_order: row.display_order as number,
          placeholder: row.placeholder as string,
          default_content: row.default_content as string,
          content_type: row.content_type as string,
          column_id: row.column_id as string,
        });
      }
      sectionsStmt.finalize();

      return { columns, sections };
    } catch (error) {
      logger.error('Error fetching templates:', error);
      throw error;
    }
  }

  // Journal Entry Management
  async fetchEntryByDate(date: string): Promise<JournalEntry | null> {
    logger.log(`fetchEntryByDate called for date: ${date}`);
    await this.ensureInitialized();
    const db = databaseService.getConnection()!;

    try {
      // Get entry
      const entryStmt = db.prepare(
        'SELECT * FROM journal_entries WHERE date = ?'
      );
      entryStmt.bind([date]);

      let entry: any = null;
      if (entryStmt.step()) {
        entry = entryStmt.get({});
      }
      entryStmt.finalize();

      // Get templates for section structure
      const templates = await this.fetchTemplates();
      const sectionsData: { [key: string]: SectionWithContent } = {};

      // If entry exists, get its sections
      if (entry) {
        logger.log(`Entry found for ${date}, entry ID: ${entry.id}`);
        const sectionsStmt = db.prepare(
          'SELECT * FROM sections WHERE entry_id = ?'
        );
        sectionsStmt.bind([entry.id]);

        const existingSections: { [key: string]: any } = {};
        while (sectionsStmt.step()) {
          const section = sectionsStmt.get({});
          logger.log(
            `Found existing section: ${section.type}, content length: ${section.content?.length || 0}`
          );
          existingSections[section.type as string] = section;
        }
        sectionsStmt.finalize();

        // Build sections data with template info
        for (const template of templates.sections) {
          const existingSection = existingSections[template.id];
          let content = '';

          if (existingSection !== undefined) {
            // Section exists in database - use its content (even if empty string)
            content = existingSection.content ?? '';
            logger.log(
              `Using existing content for ${template.id}: "${content}" (length: ${content.length})`
            );
          } else {
            // Section doesn't exist in database - get persisted content or default
            logger.log(
              `No existing section found for ${template.id}, checking for persisted content...`
            );
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

  private async getExistingSectionContent(
    entryDate: string,
    sectionType: string,
    refreshFrequency: string
  ): Promise<string | null> {
    logger.log(
      `getExistingSectionContent called for: ${sectionType}, ${entryDate}, ${refreshFrequency}`
    );
    if (refreshFrequency === 'daily') {
      return null; // Daily sections don't persist
    }

    try {
      const db = databaseService.getConnection()!;
      const date = new Date(entryDate);
      let startDate: string;

      if (refreshFrequency === 'monthly') {
        // Get first and last day of the month
        const year = date.getFullYear();
        const month = date.getMonth();
        startDate = new Date(year, month, 1).toISOString().split('T')[0];
      } else if (refreshFrequency === 'weekly') {
        // Get Monday of this week
        const dayOfWeek = date.getDay();
        const monday = new Date(date);
        monday.setDate(date.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
        startDate = monday.toISOString().split('T')[0];

        // Get Sunday of this week
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
      } else {
        return null;
      }

      // Find the most recent entry in the period with this section type
      const stmt = db.prepare(`
        SELECT s.content 
        FROM sections s
        JOIN journal_entries je ON s.entry_id = je.id
        WHERE s.type = ? 
          AND je.date >= ? 
          AND je.date < ?
          AND s.content != ''
        ORDER BY je.date DESC
        LIMIT 1
      `);

      stmt.bind([sectionType, startDate, entryDate]);

      let content: string | null = null;
      if (stmt.step()) {
        const row = stmt.get({});
        content = row.content as string;
      }
      stmt.finalize();

      return content;
    } catch (error) {
      logger.error('Error getting existing section content:', error);
      return null;
    }
  }

  async updateEntry(date: string, entry: JournalEntry): Promise<JournalEntry> {
    await this.ensureInitialized();
    const db = databaseService.getConnection()!;

    try {
      db.exec('BEGIN TRANSACTION');

      // Get or create journal entry
      const entryStmt = db.prepare(
        'SELECT id FROM journal_entries WHERE date = ?'
      );
      entryStmt.bind([date]);

      let entryId: number;
      if (entryStmt.step()) {
        const row = entryStmt.get({});
        entryId = row.id as number;
      } else {
        // Create new entry
        const insertStmt = db.prepare(
          'INSERT INTO journal_entries (date) VALUES (?)'
        );
        insertStmt.bind([date]);
        insertStmt.step();
        insertStmt.finalize();

        // Get the last inserted row ID using a separate query
        const lastIdStmt = db.prepare('SELECT last_insert_rowid() as id');
        lastIdStmt.step();
        const lastIdRow = lastIdStmt.get({});
        entryId = lastIdRow.id as number;
        lastIdStmt.finalize();
        logger.log('Created new entry with ID:', entryId);
      }
      entryStmt.finalize();

      // Update sections
      logger.log(
        'About to update sections with entryId:',
        entryId,
        'type:',
        typeof entryId
      );
      for (const [sectionType, sectionData] of Object.entries(entry.sections)) {
        // Check if section exists
        const existingStmt = db.prepare(
          'SELECT id FROM sections WHERE entry_id = ? AND type = ?'
        );
        existingStmt.bind([entryId, sectionType]);

        if (existingStmt.step()) {
          // Update existing section
          const row = existingStmt.get({});
          const updateStmt = db.prepare(`
            UPDATE sections 
            SET content = ?, updated_at = CURRENT_TIMESTAMP 
            WHERE id = ?
          `);
          updateStmt.bind([sectionData.content, row.id]);
          updateStmt.step();
          updateStmt.finalize();
        } else {
          // Create new section
          const insertStmt = db.prepare(`
            INSERT INTO sections (entry_id, type, content, refresh_frequency, content_type) 
            VALUES (?, ?, ?, ?, ?)
          `);
          insertStmt.bind([
            entryId,
            sectionType,
            sectionData.content,
            sectionData.refresh_frequency,
            sectionData.content_type,
          ]);
          insertStmt.step();
          insertStmt.finalize();
        }
        existingStmt.finalize();
      }

      db.exec('COMMIT');

      // Return the updated entry without calling fetchEntryByDate to avoid recursion
      // await this.fetchEntryByDate(date) as JournalEntry;
      return entry;
    } catch (error) {
      db.exec('ROLLBACK');
      logger.error('Error updating entry:', error);
      throw error;
    }
  }

  async deleteEntry(date: string): Promise<void> {
    await this.ensureInitialized();
    const db = databaseService.getConnection()!;

    try {
      const stmt = db.prepare('DELETE FROM journal_entries WHERE date = ?');
      stmt.bind([date]);
      stmt.step();
      stmt.finalize();
    } catch (error) {
      logger.error('Error deleting entry:', error);
      throw error;
    }
  }

  // Template CRUD operations
  async createTemplateColumn(columnData: Column): Promise<Column> {
    await this.ensureInitialized();
    const db = databaseService.getConnection()!;

    try {
      const stmt = db.prepare(`
        INSERT INTO template_columns (id, title, width, display_order) 
        VALUES (?, ?, ?, ?)
      `);
      stmt.bind([
        columnData.id,
        columnData.title,
        columnData.width,
        columnData.display_order,
      ]);
      stmt.step();
      stmt.finalize();

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
    await this.ensureInitialized();
    const db = databaseService.getConnection()!;

    try {
      const updates: string[] = [];
      const values: any[] = [];

      if (columnData.title !== undefined) {
        updates.push('title = ?');
        values.push(columnData.title);
      }
      if (columnData.width !== undefined) {
        updates.push('width = ?');
        values.push(columnData.width);
      }
      if (columnData.display_order !== undefined) {
        updates.push('display_order = ?');
        values.push(columnData.display_order);
      }

      updates.push('updated_at = CURRENT_TIMESTAMP');
      values.push(id);

      const stmt = db.prepare(
        `UPDATE template_columns SET ${updates.join(', ')} WHERE id = ?`
      );
      stmt.bind(values);
      stmt.step();
      stmt.finalize();

      // Fetch and return updated column
      const selectStmt = db.prepare(
        'SELECT * FROM template_columns WHERE id = ?'
      );
      selectStmt.bind([id]);
      selectStmt.step();
      const row = selectStmt.get({});
      selectStmt.finalize();

      return {
        id: row.id as string,
        title: row.title as string,
        width:
          typeof row.width === 'number'
            ? row.width
            : parseInt(row.width as string) || 500,
        display_order: row.display_order as number,
      };
    } catch (error) {
      logger.error('Error updating template column:', error);
      throw error;
    }
  }

  async deleteTemplateColumn(id: string): Promise<void> {
    await this.ensureInitialized();
    const db = databaseService.getConnection()!;

    try {
      const stmt = db.prepare('DELETE FROM template_columns WHERE id = ?');
      stmt.bind([id]);
      stmt.step();
      stmt.finalize();
    } catch (error) {
      logger.error('Error deleting template column:', error);
      throw error;
    }
  }

  async batchUpdateColumnOrders(
    columns: Array<{ id: string; display_order: number }>
  ): Promise<void> {
    await this.ensureInitialized();
    const db = databaseService.getConnection()!;

    try {
      db.exec('BEGIN TRANSACTION');

      const stmt = db.prepare(
        'UPDATE template_columns SET display_order = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
      );

      for (const column of columns) {
        stmt.bind([column.display_order, column.id]);
        stmt.step();
        stmt.reset();
      }

      stmt.finalize();
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      logger.error('Error batch updating column orders:', error);
      throw error;
    }
  }

  async batchUpdateSectionOrders(
    sections: Array<{ id: string; display_order: number }>
  ): Promise<void> {
    await this.ensureInitialized();
    const db = databaseService.getConnection()!;

    try {
      db.exec('BEGIN TRANSACTION');

      const stmt = db.prepare(
        'UPDATE template_sections SET display_order = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
      );

      for (const section of sections) {
        stmt.bind([section.display_order, section.id]);
        stmt.step();
        stmt.reset();
      }

      stmt.finalize();
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      logger.error('Error batch updating section orders:', error);
      throw error;
    }
  }

  async createTemplateSection(
    sectionData: SectionTemplate
  ): Promise<SectionTemplate> {
    await this.ensureInitialized();
    const db = databaseService.getConnection()!;

    try {
      const stmt = db.prepare(`
        INSERT INTO template_sections (id, title, refresh_frequency, display_order, placeholder, default_content, content_type, column_id) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.bind([
        sectionData.id,
        sectionData.title,
        sectionData.refresh_frequency,
        sectionData.display_order,
        sectionData.placeholder || '',
        sectionData.default_content || '',
        sectionData.content_type,
        sectionData.column_id || null,
      ]);
      stmt.step();
      stmt.finalize();

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
    await this.ensureInitialized();
    const db = databaseService.getConnection()!;

    try {
      const updates: string[] = [];
      const values: any[] = [];

      if (sectionData.title !== undefined) {
        updates.push('title = ?');
        values.push(sectionData.title);
      }
      if (sectionData.refresh_frequency !== undefined) {
        updates.push('refresh_frequency = ?');
        values.push(sectionData.refresh_frequency);
      }
      if (sectionData.display_order !== undefined) {
        updates.push('display_order = ?');
        values.push(sectionData.display_order);
      }
      if (sectionData.placeholder !== undefined) {
        updates.push('placeholder = ?');
        values.push(sectionData.placeholder);
      }
      if (sectionData.default_content !== undefined) {
        updates.push('default_content = ?');
        values.push(sectionData.default_content);
      }
      if (sectionData.content_type !== undefined) {
        updates.push('content_type = ?');
        values.push(sectionData.content_type);
      }
      if (sectionData.column_id !== undefined) {
        updates.push('column_id = ?');
        values.push(sectionData.column_id);
      }

      updates.push('updated_at = CURRENT_TIMESTAMP');
      values.push(id);

      const stmt = db.prepare(
        `UPDATE template_sections SET ${updates.join(', ')} WHERE id = ?`
      );
      stmt.bind(values);
      stmt.step();
      stmt.finalize();

      // Fetch and return updated section
      const selectStmt = db.prepare(
        'SELECT * FROM template_sections WHERE id = ?'
      );
      selectStmt.bind([id]);
      selectStmt.step();
      const row = selectStmt.get({});
      selectStmt.finalize();

      return {
        id: row.id as string,
        title: row.title as string,
        refresh_frequency: row.refresh_frequency as string,
        display_order: row.display_order as number,
        placeholder: row.placeholder as string,
        default_content: row.default_content as string,
        content_type: row.content_type as string,
        column_id: row.column_id as string,
      };
    } catch (error) {
      logger.error('Error updating template section:', error);
      throw error;
    }
  }

  async deleteTemplateSection(id: string): Promise<void> {
    await this.ensureInitialized();
    const db = databaseService.getConnection()!;

    try {
      const stmt = db.prepare('DELETE FROM template_sections WHERE id = ?');
      stmt.bind([id]);
      stmt.step();
      stmt.finalize();
    } catch (error) {
      logger.error('Error deleting template section:', error);
      throw error;
    }
  }

  // Manual save method for explicit persistence
  async saveDatabase(): Promise<void> {
    await this.ensureInitialized();
    await databaseService.saveDatabase();
  }
}

export const localApiService = new LocalApiService();
export default localApiService;
