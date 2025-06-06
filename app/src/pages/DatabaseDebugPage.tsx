import React, { useState, useEffect, useCallback } from 'react';
import { database } from '../database/watermelon/database';
import {
  JournalEntry,
  Section,
  SectionJournalEntry,
  ApiKey,
  TemplateColumn,
  TemplateSection,
} from '../database/watermelon/models';
import logger from '../utils/logger';

interface TableData {
  name: string;
  records: any[];
  count: number;
  columns: string[];
}

interface RecordDisplay {
  [key: string]: any;
}

const tableConfigs = [
  {
    name: 'journal_entries',
    displayName: 'Journal Entries',
    model: JournalEntry,
  },
  { name: 'sections', displayName: 'Sections', model: Section },
  {
    name: 'section_journal_entries',
    displayName: 'Section Journal Entries',
    model: SectionJournalEntry,
  },
  { name: 'api_keys', displayName: 'API Keys', model: ApiKey },
  {
    name: 'template_columns',
    displayName: 'Template Columns',
    model: TemplateColumn,
  },
  {
    name: 'template_sections',
    displayName: 'Template Sections',
    model: TemplateSection,
  },
];

const DatabaseDebugPage: React.FC = () => {
  const [tables, setTables] = useState<TableData[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedRecords, setExpandedRecords] = useState<Set<string>>(
    new Set()
  );

  const loadTableData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const tablesData: TableData[] = [];

      for (const config of tableConfigs) {
        try {
          const collection = database.collections.get(config.name);
          const records = await collection.query().fetch();

          // Extract all unique column names from the records
          const columnsSet = new Set<string>();
          records.forEach(record => {
            // Add all properties from the record
            Object.keys(record._raw).forEach(key => columnsSet.add(key));
            // Add common WatermelonDB properties
            columnsSet.add('id');
            columnsSet.add('_status');
            columnsSet.add('_changed');
          });

          const recordsData = records.map(record => {
            const recordData: RecordDisplay = { ...record._raw };
            recordData.id = record.id;
            recordData._status = record._raw._status;
            recordData._changed = record._raw._changed;
            return recordData;
          });

          tablesData.push({
            name: config.name,
            records: recordsData,
            count: records.length,
            columns: Array.from(columnsSet).sort(),
          });
        } catch (err) {
          logger.error(`Error loading ${config.name}:`, err);
          tablesData.push({
            name: config.name,
            records: [],
            count: 0,
            columns: [],
          });
        }
      }

      setTables(tablesData);
      if (!selectedTable && tablesData.length > 0) {
        setSelectedTable(tablesData[0].name);
      }
    } catch (err) {
      setError(
        `Failed to load database: ${err instanceof Error ? err.message : 'Unknown error'}`
      );
    } finally {
      setLoading(false);
    }
  }, [selectedTable]);

  useEffect(() => {
    loadTableData();
  }, [loadTableData]);

  const toggleRecordExpansion = (recordId: string) => {
    const newExpanded = new Set(expandedRecords);
    if (newExpanded.has(recordId)) {
      newExpanded.delete(recordId);
    } else {
      newExpanded.add(recordId);
    }
    setExpandedRecords(newExpanded);
  };

  const formatValue = (value: any): string => {
    if (value === null || value === undefined) {
      return 'null';
    }
    if (typeof value === 'object') {
      return JSON.stringify(value, null, 2);
    }
    if (typeof value === 'boolean') {
      return value ? 'true' : 'false';
    }
    if (typeof value === 'number') {
      return value.toString();
    }
    return String(value);
  };

  const getValueTypeColor = (value: any): string => {
    if (value === null || value === undefined) {
      return 'text-gray-400';
    }
    if (typeof value === 'string') {
      return 'text-green-600';
    }
    if (typeof value === 'number') {
      return 'text-blue-600';
    }
    if (typeof value === 'boolean') {
      return 'text-purple-600';
    }
    if (typeof value === 'object') {
      return 'text-orange-600';
    }
    return 'text-gray-700';
  };

  const filteredTables = tables.filter(
    table =>
      table.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tableConfigs
        .find(config => config.name === table.name)
        ?.displayName.toLowerCase()
        .includes(searchTerm.toLowerCase())
  );

  const selectedTableData = tables.find(table => table.name === selectedTable);

  const filteredRecords =
    selectedTableData?.records.filter(record =>
      Object.values(record).some(value =>
        String(value).toLowerCase().includes(searchTerm.toLowerCase())
      )
    ) || [];

  if (loading) {
    return (
      <div className='min-h-screen bg-gray-50 flex items-center justify-center'>
        <div className='text-center'>
          <div className='w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4' />
          <p className='text-gray-600'>Loading database data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className='min-h-screen bg-gray-50 flex items-center justify-center'>
        <div className='text-center'>
          <div className='w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4'>
            <svg
              className='w-6 h-6 text-red-600'
              fill='none'
              stroke='currentColor'
              viewBox='0 0 24 24'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z'
              />
            </svg>
          </div>
          <h2 className='text-xl font-medium text-gray-900 mb-2'>
            Database Error
          </h2>
          <p className='text-gray-600 mb-4'>{error}</p>
          <button
            onClick={loadTableData}
            className='px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors'
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className='min-h-screen bg-gray-50'>
      {/* Header */}
      <div className='bg-white shadow-sm border-b'>
        <div className='max-w-full mx-auto px-6 py-4'>
          <div className='flex items-center justify-between'>
            <div>
              <h1 className='text-2xl font-bold text-gray-900'>
                Database Debug Console
              </h1>
              <p className='text-gray-600 mt-1'>
                Inspect all records and fields in your WatermelonDB database
              </p>
            </div>
            <div className='flex items-center space-x-4'>
              <button
                onClick={loadTableData}
                className='px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center space-x-2'
              >
                <svg
                  className='w-4 h-4'
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15'
                  />
                </svg>
                <span>Refresh</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className='max-w-full mx-auto px-6 py-6'>
        <div className='flex gap-6'>
          {/* Sidebar - Tables List */}
          <div className='w-80 bg-white rounded-lg shadow-sm border'>
            <div className='p-4 border-b'>
              <h3 className='text-lg font-medium text-gray-900 mb-3'>Tables</h3>
              <input
                type='text'
                placeholder='Search tables or records...'
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
              />
            </div>
            <div className='p-2'>
              {filteredTables.map(table => {
                const config = tableConfigs.find(c => c.name === table.name);
                return (
                  <button
                    key={table.name}
                    onClick={() => setSelectedTable(table.name)}
                    className={`w-full text-left px-3 py-3 rounded-md transition-colors ${
                      selectedTable === table.name
                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                        : 'hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    <div className='flex items-center justify-between'>
                      <div>
                        <p className='font-medium'>
                          {config?.displayName || table.name}
                        </p>
                        <p className='text-sm text-gray-500'>{table.name}</p>
                      </div>
                      <span
                        className={`text-sm px-2 py-1 rounded-full ${
                          table.count > 0
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {table.count}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Main Content - Records */}
          <div className='flex-1'>
            {selectedTableData ? (
              <div className='bg-white rounded-lg shadow-sm border'>
                <div className='p-4 border-b'>
                  <div className='flex items-center justify-between'>
                    <div>
                      <h3 className='text-lg font-medium text-gray-900'>
                        {tableConfigs.find(c => c.name === selectedTable)
                          ?.displayName || selectedTable}
                      </h3>
                      <p className='text-gray-600'>
                        {filteredRecords.length} of {selectedTableData.count}{' '}
                        records
                        {searchTerm && ` (filtered by "${searchTerm}")`}
                      </p>
                    </div>
                    <div className='text-sm text-gray-500'>
                      Columns: {selectedTableData.columns.length}
                    </div>
                  </div>
                </div>

                {selectedTableData.count === 0 ? (
                  <div className='p-8 text-center text-gray-500'>
                    <svg
                      className='w-12 h-12 mx-auto mb-4 text-gray-300'
                      fill='none'
                      stroke='currentColor'
                      viewBox='0 0 24 24'
                    >
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth={2}
                        d='M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2 2v-5m16 0h-6m-4 0H4'
                      />
                    </svg>
                    <p>No records found in this table</p>
                  </div>
                ) : filteredRecords.length === 0 ? (
                  <div className='p-8 text-center text-gray-500'>
                    <svg
                      className='w-12 h-12 mx-auto mb-4 text-gray-300'
                      fill='none'
                      stroke='currentColor'
                      viewBox='0 0 24 24'
                    >
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth={2}
                        d='M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z'
                      />
                    </svg>
                    <p>No records match your search</p>
                  </div>
                ) : (
                  <div className='divide-y'>
                    {filteredRecords.map((record, index) => (
                      <div key={record.id || index} className='p-4'>
                        <div className='flex items-center justify-between mb-2'>
                          <div className='flex items-center space-x-3'>
                            <button
                              onClick={() =>
                                toggleRecordExpansion(
                                  record.id || `record-${index}`
                                )
                              }
                              className='flex items-center space-x-2 text-sm font-medium text-gray-700 hover:text-gray-900'
                            >
                              <svg
                                className={`w-4 h-4 transition-transform ${
                                  expandedRecords.has(
                                    record.id || `record-${index}`
                                  )
                                    ? 'rotate-90'
                                    : ''
                                }`}
                                fill='none'
                                stroke='currentColor'
                                viewBox='0 0 24 24'
                              >
                                <path
                                  strokeLinecap='round'
                                  strokeLinejoin='round'
                                  strokeWidth={2}
                                  d='M9 5l7 7-7 7'
                                />
                              </svg>
                              <span>Record {record.id || index + 1}</span>
                            </button>
                            {record._status && (
                              <span
                                className={`text-xs px-2 py-1 rounded-full ${
                                  record._status === 'created'
                                    ? 'bg-green-100 text-green-800'
                                    : record._status === 'updated'
                                      ? 'bg-yellow-100 text-yellow-800'
                                      : record._status === 'deleted'
                                        ? 'bg-red-100 text-red-800'
                                        : 'bg-gray-100 text-gray-800'
                                }`}
                              >
                                {record._status}
                              </span>
                            )}
                          </div>
                        </div>

                        {expandedRecords.has(
                          record.id || `record-${index}`
                        ) && (
                          <div className='bg-gray-50 rounded-lg p-4 mt-3'>
                            <div className='grid grid-cols-1 gap-3'>
                              {selectedTableData.columns.map(column => {
                                const value = record[column];
                                return (
                                  <div key={column} className='flex'>
                                    <div className='w-48 flex-shrink-0'>
                                      <span className='text-sm font-medium text-gray-700'>
                                        {column}
                                      </span>
                                    </div>
                                    <div className='flex-1'>
                                      <span
                                        className={`text-sm font-mono ${getValueTypeColor(value)}`}
                                      >
                                        {formatValue(value)}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {!expandedRecords.has(
                          record.id || `record-${index}`
                        ) && (
                          <div className='text-sm text-gray-600 grid grid-cols-2 gap-x-6 gap-y-1 mt-2'>
                            {selectedTableData.columns
                              .slice(0, 6)
                              .map(column => {
                                const value = record[column];
                                if (
                                  value === null ||
                                  value === undefined ||
                                  value === ''
                                )
                                  return null;
                                return (
                                  <div key={column} className='flex'>
                                    <span className='font-medium mr-2'>
                                      {column}:
                                    </span>
                                    <span
                                      className={`truncate ${getValueTypeColor(value)}`}
                                    >
                                      {formatValue(value).substring(0, 50)}
                                      {formatValue(value).length > 50
                                        ? '...'
                                        : ''}
                                    </span>
                                  </div>
                                );
                              })}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className='bg-white rounded-lg shadow-sm border p-8 text-center text-gray-500'>
                <svg
                  className='w-12 h-12 mx-auto mb-4 text-gray-300'
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4'
                  />
                </svg>
                <p>Select a table to view its records</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DatabaseDebugPage;
