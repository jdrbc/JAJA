export interface SectionData {
  content: string;
  title: string;
  refresh_frequency: string;
  placeholder: string;
  display_order?: number;
  default_content?: string;
  content_type?: string;
}

export interface SectionDataMap {
  [key: string]: SectionData;
}

export interface JournalEntry {
  date: string;
  sections: SectionDataMap;
}

export interface Column {
  id: string;
  title: string;
  width: number;
  display_order: number;
}

export interface SectionTemplate {
  id: string;
  title: string;
  refresh_frequency: string;
  display_order: number;
  placeholder: string;
  default_content: string;
  content_type: string;
  configuration: string;
  column_id?: string;
}

export interface SectionWithContent extends SectionTemplate {
  content: string;
}
