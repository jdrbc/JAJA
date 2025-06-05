import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Column, SectionWithContent } from '../services/api';
import TemplateEditLayout from '../components/template/TemplateEditLayout';
import { TemplateEditModeProvider } from '../contexts/EditModeContext';
import { localApiService } from '../services/localApi';
import { logger } from '../utils/logger';

const TemplateManagementPage: React.FC = () => {
  const [columns, setColumns] = useState<Column[]>([]);
  const [sections, setSections] = useState<SectionWithContent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  // Load templates
  const loadTemplates = async () => {
    setIsLoading(true);
    try {
      const templateConfig = await localApiService.fetchTemplates();
      setColumns(
        templateConfig.columns.sort(
          (a: Column, b: Column) => a.display_order - b.display_order
        )
      );

      // Convert SectionTemplate to SectionWithContent for the layout
      const sectionsWithContent: SectionWithContent[] =
        templateConfig.sections.map(section => ({
          ...section,
          content: section.default_content || '', // Use default content for preview
        }));

      setSections(
        sectionsWithContent.sort(
          (a: SectionWithContent, b: SectionWithContent) =>
            a.display_order - b.display_order
        )
      );
      setError(null);
    } catch (err) {
      setError('Failed to load templates. Please try again.');
      logger.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  // Dummy content change handler (not used in template editing)
  const handleContentChange = (sectionId: string, content: string) => {
    // This is just for the interface - content editing isn't relevant in template management
    logger.log('Content change in template preview:', sectionId, content);
  };

  if (isLoading) {
    return (
      <div className='min-h-screen bg-gray-50 flex items-center justify-center'>
        <div className='text-lg text-gray-600'>Loading templates...</div>
      </div>
    );
  }

  return (
    <TemplateEditModeProvider>
      <div className='min-h-screen bg-gray-50'>
        {/* Header */}
        <header className='bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-20'>
          <div className='flex items-center justify-between max-w-full'>
            <h1 className='text-2xl font-bold text-gray-900'>
              Template Management
            </h1>
            <button
              onClick={() => navigate('/')}
              className='px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700'
            >
              Back to Journal
            </button>
          </div>
        </header>

        {error && (
          <div className='mx-4 mt-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded'>
            {error}
          </div>
        )}

        {/* Template Edit Layout */}
        <TemplateEditLayout
          columns={columns}
          sections={sections}
          onContentChange={handleContentChange}
          onTemplateChange={loadTemplates}
        />
      </div>
    </TemplateEditModeProvider>
  );
};

export default TemplateManagementPage;
