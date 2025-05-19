import axios from 'axios';
import { SectionTemplate, Column } from './api';

const API_BASE_URL = '/api';

// Column management
export const createTemplateColumn = async (
  column: Omit<Column, 'created_at' | 'updated_at'>
): Promise<Column> => {
  const response = await axios.post(
    `${API_BASE_URL}/templates/columns`,
    column
  );
  return response.data;
};

export const updateTemplateColumn = async (
  id: string,
  column: Partial<Column>
): Promise<Column> => {
  const response = await axios.put(
    `${API_BASE_URL}/templates/columns/${id}`,
    column
  );
  return response.data;
};

export const deleteTemplateColumn = async (id: string): Promise<void> => {
  await axios.delete(`${API_BASE_URL}/templates/columns/${id}`);
};

// Section management
export const createTemplateSection = async (
  section: Omit<SectionTemplate, 'created_at' | 'updated_at'>
): Promise<SectionTemplate> => {
  const response = await axios.post(
    `${API_BASE_URL}/templates/sections`,
    section
  );
  return response.data;
};

export const updateTemplateSection = async (
  id: string,
  section: Partial<SectionTemplate>
): Promise<SectionTemplate> => {
  const response = await axios.put(
    `${API_BASE_URL}/templates/sections/${id}`,
    section
  );
  return response.data;
};

export const deleteTemplateSection = async (id: string): Promise<void> => {
  await axios.delete(`${API_BASE_URL}/templates/sections/${id}`);
};
