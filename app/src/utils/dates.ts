import { format, parse, isValid } from 'date-fns';

export const formatDateForDisplay = (date: Date): string => {
  return format(date, 'EEEE, MMMM d, yyyy');
};

/**
 * Formats a date for API requests in YYYY-MM-DD format
 */
export const formatDateForAPI = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

export const parseAPIDate = (dateString: string): Date => {
  const parsedDate = parse(dateString, 'yyyy-MM-dd', new Date());
  if (!isValid(parsedDate)) {
    throw new Error(`Invalid date format: ${dateString}`);
  }
  return parsedDate;
};
