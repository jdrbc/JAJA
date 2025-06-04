import React, { useState, useEffect } from 'react';
import { apiKeyService } from '../services/apiKeyStorage';
import { geminiService } from '../services/gemini';
import { logger } from '../utils/logger';

export const ApiKeySettings: React.FC = () => {
  const [geminiKey, setGeminiKey] = useState('');
  const [maskedKey, setMaskedKey] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadExistingKey();
  }, []);

  const loadExistingKey = async () => {
    try {
      const masked = await apiKeyService.getMaskedApiKey('gemini');
      setMaskedKey(masked);
    } catch (err) {
      logger.error('Error loading API key:', err);
    }
  };

  const handleSave = async () => {
    setError(null);

    if (!geminiKey.trim()) {
      setError('API key cannot be empty');
      return;
    }

    // Validate format
    const validation = apiKeyService.validateApiKeyFormat('gemini', geminiKey);
    if (!validation.isValid) {
      setError(validation.error || 'Invalid API key format');
      return;
    }

    try {
      await apiKeyService.setApiKey('gemini', geminiKey);
      await loadExistingKey();
      setIsEditing(false);
      setGeminiKey('');
      setTestResult({ success: true, message: 'API key saved successfully!' });
    } catch (err) {
      setError('Failed to save API key');
      logger.error('Error saving API key:', err);
    }
  };

  const handleTest = async () => {
    if (!geminiKey.trim()) {
      setError('Enter an API key to test');
      return;
    }

    setIsTesting(true);
    setTestResult(null);
    setError(null);

    try {
      const isValid = await geminiService.testApiKey(geminiKey);
      setTestResult({
        success: isValid,
        message: isValid
          ? 'API key is valid and working!'
          : 'API key is invalid or not working',
      });
    } catch (err) {
      setTestResult({
        success: false,
        message: 'Failed to test API key',
      });
      logger.error('Error testing API key:', err);
    } finally {
      setIsTesting(false);
    }
  };

  const handleEdit = () => {
    setIsEditing(true);
    setTestResult(null);
    setError(null);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setGeminiKey('');
    setTestResult(null);
    setError(null);
  };

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete the Gemini API key?')) {
      try {
        await apiKeyService.deleteApiKey('gemini');
        setMaskedKey(null);
        setTestResult({
          success: true,
          message: 'API key deleted successfully!',
        });
      } catch (err) {
        setError('Failed to delete API key');
        logger.error('Error deleting API key:', err);
      }
    }
  };

  return (
    <div className='bg-white p-6 rounded-lg shadow-sm border'>
      <h3 className='text-lg font-semibold text-gray-900 mb-4'>
        AI Integration Settings
      </h3>

      <div className='space-y-4'>
        <div>
          <label className='block text-sm font-medium text-gray-700 mb-2'>
            Gemini API Key
          </label>
          <p className='text-sm text-gray-600 mb-3'>
            Enter your Google Gemini API key to enable AI-powered SMART goal
            suggestions. You can get an API key from{' '}
            <a
              href='https://aistudio.google.com/app/apikey'
              target='_blank'
              rel='noopener noreferrer'
              className='text-blue-600 hover:text-blue-800 underline'
            >
              Google AI Studio
            </a>
            .
          </p>

          {!isEditing && maskedKey ? (
            <div className='flex items-center space-x-3'>
              <span className='font-mono text-sm bg-gray-100 px-3 py-2 rounded border'>
                {maskedKey}
              </span>
              <button
                onClick={handleEdit}
                className='px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700'
              >
                Edit
              </button>
              <button
                onClick={handleDelete}
                className='px-3 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700'
              >
                Delete
              </button>
            </div>
          ) : (
            <div className='space-y-3'>
              <input
                type='password'
                value={geminiKey}
                onChange={e => setGeminiKey(e.target.value)}
                placeholder='Enter your Gemini API key...'
                className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
              />

              <div className='flex space-x-3'>
                <button
                  onClick={handleSave}
                  className='px-4 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700'
                >
                  Save
                </button>
                <button
                  onClick={handleTest}
                  disabled={isTesting}
                  className='px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50'
                >
                  {isTesting ? 'Testing...' : 'Test'}
                </button>
                {isEditing && (
                  <button
                    onClick={handleCancel}
                    className='px-4 py-2 bg-gray-600 text-white text-sm rounded hover:bg-gray-700'
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          )}

          {error && (
            <div className='mt-3 p-3 bg-red-50 border border-red-200 rounded-md'>
              <p className='text-sm text-red-700'>{error}</p>
            </div>
          )}

          {testResult && (
            <div
              className={`mt-3 p-3 border rounded-md ${
                testResult.success
                  ? 'bg-green-50 border-green-200'
                  : 'bg-red-50 border-red-200'
              }`}
            >
              <p
                className={`text-sm ${
                  testResult.success ? 'text-green-700' : 'text-red-700'
                }`}
              >
                {testResult.message}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
