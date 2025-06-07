import database from '../database/watermelon/database';
import {
  Section as SectionModel,
  SectionJournalEntry as SectionJournalEntryModel,
  TemplateSection as TemplateSectionModel,
} from '../database/watermelon/models';
import { Q } from '@nozbe/watermelondb';
import { TimeframeCalculator } from '../utils/timeframeUtils';
import logger from '../utils/logger';

export interface SectionWithTemplate {
  // Section data
  id: string;
  type: string;
  content: string;
  timeframeType: 'daily' | 'weekly' | 'monthly' | 'persistent';
  timeframeStart: string;
  timeframeEnd: string;
  createdAt: Date;
  updatedAt: Date;
  // Template data from join
  title: string;
  refreshFrequency: string;
  contentType: string;
  placeholder: string;
  defaultContent: string;
  displayOrder: number;
  columnId: string;
}

export class SectionService {
  async updateSectionContent(
    sectionId: string,
    content: string
  ): Promise<void> {
    logger.log('Updating section content:', sectionId, content);
    const sectionsCollection =
      database.collections.get<SectionModel>('sections');
    const section = await sectionsCollection.find(sectionId);

    // No database.write() - assumes we're already in a write context
    await section.update(section => {
      section.content = content;
    });
  }

  async getSectionsForEntry(
    journalEntryId: string
  ): Promise<SectionWithTemplate[]> {
    const junctionCollection =
      database.collections.get<SectionJournalEntryModel>(
        'section_journal_entries'
      );
    const templatesCollection =
      database.collections.get<TemplateSectionModel>('template_sections');

    const junctionRecords = await junctionCollection
      .query(Q.where('journal_entry_id', journalEntryId))
      .fetch();

    const sectionsWithTemplates: SectionWithTemplate[] = [];

    for (const junction of junctionRecords) {
      const section = await junction.section;
      const template = await templatesCollection.find(section.type);

      sectionsWithTemplates.push({
        id: section.id,
        type: section.type,
        content: section.content,
        timeframeType: section.timeframeType,
        timeframeStart: section.timeframeStart,
        timeframeEnd: section.timeframeEnd,
        createdAt: section.createdAt,
        updatedAt: section.updatedAt,
        title: template.title,
        refreshFrequency: template.refreshFrequency,
        contentType: template.contentType,
        placeholder: template.placeholder,
        defaultContent: template.defaultContent,
        displayOrder: template.displayOrder,
        columnId: template.columnId,
      });
    }

    // Sort by display order
    return sectionsWithTemplates.sort(
      (a, b) => a.displayOrder - b.displayOrder
    );
  }

  private async getTemplate(
    sectionType: string
  ): Promise<TemplateSectionModel | null> {
    logger.log('Getting template for section type:', sectionType);
    const templatesCollection =
      database.collections.get<TemplateSectionModel>('template_sections');
    try {
      return await templatesCollection.find(sectionType);
    } catch {
      return null;
    }
  }

  // New method: Get or create section within an existing write context
  async getOrCreateSection(
    sectionType: string,
    entryDate: string
  ): Promise<{ id: string; content: string }> {
    // Get template to determine current refresh frequency
    const template = await this.getTemplate(sectionType);
    if (!template) {
      throw new Error(`Template not found: ${sectionType}`);
    }

    const timeframe = TimeframeCalculator.getTimeframeBounds(
      entryDate,
      template.refreshFrequency
    );

    const sectionsCollection =
      database.collections.get<SectionModel>('sections');

    if (template.refreshFrequency === 'persistent') {
      // Persistent sections: one section that persists across all entries
      const existing = await sectionsCollection
        .query(
          Q.where('type', sectionType),
          Q.where('timeframe_type', 'persistent')
        )
        .fetch();

      if (existing.length > 0) {
        return { id: existing[0].id, content: existing[0].content };
      }

      // Create new persistent section with no end date
      const newSection = await sectionsCollection.create(section => {
        section.type = sectionType;
        section.content = '';
        section.timeframeType = 'persistent';
        section.timeframeStart = entryDate; // Start from when first accessed
        section.timeframeEnd = '9999-12-31'; // No end date
      });

      return { id: newSection.id, content: newSection.content };
    } else if (template.refreshFrequency === 'daily') {
      // Daily sections: one per day
      const existing = await sectionsCollection
        .query(
          Q.where('type', sectionType),
          Q.where('timeframe_type', 'daily'),
          Q.where('timeframe_start', timeframe.start)
        )
        .fetch();

      if (existing.length > 0) {
        return { id: existing[0].id, content: existing[0].content };
      }

      // No database.write() - assumes we're already in a write context
      const newSection = await sectionsCollection.create(section => {
        section.type = sectionType;
        section.content = '';
        section.timeframeType = 'daily';
        section.timeframeStart = timeframe.start;
        section.timeframeEnd = timeframe.end;
      });

      return { id: newSection.id, content: newSection.content };
    } else {
      // Weekly/monthly sections: one per timeframe
      const existing = await sectionsCollection
        .query(
          Q.where('type', sectionType),
          Q.where('timeframe_type', timeframe.type),
          Q.where('timeframe_start', timeframe.start)
        )
        .fetch();

      if (existing.length > 0) {
        return { id: existing[0].id, content: existing[0].content };
      }

      // No database.write() - assumes we're already in a write context
      const newSection = await sectionsCollection.create(section => {
        section.type = sectionType;
        section.content = '';
        section.timeframeType = timeframe.type;
        section.timeframeStart = timeframe.start;
        section.timeframeEnd = timeframe.end;
      });

      return { id: newSection.id, content: newSection.content };
    }
  }

  async linkSectionToEntry(
    sectionId: string,
    journalEntryId: string
  ): Promise<void> {
    logger.log('Linking section to entry:', sectionId, journalEntryId);
    const junctionCollection =
      database.collections.get<SectionJournalEntryModel>(
        'section_journal_entries'
      );

    // Use upsert to ensure only one record per section-journal entry pair
    // No database.write() - assumes we're already in a write context
    await SectionJournalEntryModel.upsert(
      junctionCollection,
      sectionId,
      journalEntryId
    );
  }

  async updateMostRecentSectionForFrequencyChange(
    templateId: string,
    newFrequency: string
  ): Promise<void> {
    logger.log(
      'Updating most recent section for frequency change:',
      templateId,
      newFrequency
    );
    const sectionsCollection =
      database.collections.get<SectionModel>('sections');
    const junctionCollection =
      database.collections.get<SectionJournalEntryModel>(
        'section_journal_entries'
      );

    // Find sections of this template type that are linked to journal entries
    const sectionsOfType = await sectionsCollection
      .query(Q.where('type', templateId))
      .fetch();

    if (sectionsOfType.length === 0) {
      // No existing sections for this template
      return;
    }

    // Find the section linked to the most recent journal entry
    let mostRecentSection = null;
    let mostRecentJournalEntryDate = null;

    for (const section of sectionsOfType) {
      // Get journal entries linked to this section
      const junctionRecords = await junctionCollection
        .query(Q.where('section_id', section.id))
        .fetch();

      for (const junction of junctionRecords) {
        const journalEntry = await junction.journalEntry;
        const entryDate = new Date(journalEntry.date);

        if (
          !mostRecentJournalEntryDate ||
          entryDate > mostRecentJournalEntryDate
        ) {
          mostRecentJournalEntryDate = entryDate;
          mostRecentSection = section;
        }
      }
    }

    if (!mostRecentSection) {
      // No sections are linked to journal entries
      return;
    }

    // Calculate new timeframe bounds based on the most recent section's timeframe_start date
    const newTimeframe = TimeframeCalculator.getTimeframeBounds(
      mostRecentSection.timeframeStart,
      newFrequency
    );

    // Update the section with new timeframe properties
    // No database.write() - assumes we're already in a write context
    await mostRecentSection.update(section => {
      section.timeframeType = newTimeframe.type;
      section.timeframeStart = newTimeframe.start;
      section.timeframeEnd = newTimeframe.end;
    });
  }
}
