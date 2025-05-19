import axios from 'axios';

const API_BASE_URL = '/api';

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
  column_id?: string;
}

export interface SectionWithContent extends SectionTemplate {
  content: string;
}

export interface TemplateConfig {
  columns: Column[];
  sections: SectionTemplate[];
}

export const fetchTemplates = async (): Promise<TemplateConfig> => {
  const response = await axios.get(`${API_BASE_URL}/templates`);
  return response.data;
};

// Keep backward compatibility for existing code
export const fetchSectionTemplates = async (): Promise<SectionTemplate[]> => {
  const config = await fetchTemplates();
  return config.sections;
};

export const fetchEntries = async (): Promise<JournalEntry[]> => {
  const response = await axios.get(`${API_BASE_URL}/entries`);
  return response.data;
};

export const fetchEntryByDate = async (
  date: string
): Promise<JournalEntry | null> => {
  try {
    const response = await axios.get(`${API_BASE_URL}/entries/${date}`);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      return null;
    }
    throw error;
  }
};

export const createEntry = async (
  entry: JournalEntry
): Promise<JournalEntry> => {
  const response = await axios.post(
    `${API_BASE_URL}/entries/${entry.date}`,
    entry
  );
  return response.data;
};

export const updateEntry = async (
  date: string,
  entry: JournalEntry
): Promise<JournalEntry> => {
  const response = await axios.put(`${API_BASE_URL}/entries/${date}`, entry);
  return response.data;
};

export const deleteEntry = async (date: string): Promise<void> => {
  await axios.delete(`${API_BASE_URL}/entries/${date}`);
};
