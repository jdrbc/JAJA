import React from 'react';
import { useNavigate } from 'react-router-dom';
import { CloudSyncSettings } from '../components/CloudSyncSettings';
import { BackupRestoreSettings } from '../components/BackupRestoreSettings';
import { ApiKeySettings } from '../components/ApiKeySettings';

const SettingsPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className='min-h-screen bg-gray-50'>
      <div className='max-w-4xl mx-auto p-6'>
        {/* Header */}
        <div className='mb-8'>
          <button
            onClick={() => navigate('/')}
            className='mb-4 px-4 py-2 text-gray-600 hover:text-gray-800 flex items-center gap-2'
          >
            ← Back to Journal
          </button>
          <h1 className='text-3xl font-bold text-gray-800'>Settings</h1>
        </div>

        {/* Cloud Sync Settings */}
        <div className='bg-white rounded-lg shadow-md p-6 mb-6'>
          <CloudSyncSettings />
        </div>

        {/* API Key Settings */}
        <div className='bg-white rounded-lg shadow-md p-6 mb-6'>
          <ApiKeySettings />
        </div>

        {/* Backup & Restore Settings */}
        <div className='bg-white rounded-lg shadow-md p-6 mb-6'>
          <BackupRestoreSettings />
        </div>

        {/* Development Tools (only in development mode) */}
        {process.env.NODE_ENV === 'development' && (
          <div className='bg-white rounded-lg shadow-md p-6 mb-6'>
            <h2 className='text-2xl font-bold text-gray-800 mb-6'>
              Development Tools
            </h2>
            <div className='space-y-4'>
              <button
                onClick={() => navigate('/debug/database')}
                className='w-full flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors'
              >
                <div className='flex items-center space-x-3'>
                  <div className='w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center'>
                    <svg
                      className='w-5 h-5 text-blue-600'
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
                  </div>
                  <div className='text-left'>
                    <p className='font-medium text-gray-900'>
                      Database Debug Console
                    </p>
                    <p className='text-sm text-gray-500'>
                      Inspect all records and fields in the database
                    </p>
                  </div>
                </div>
                <svg
                  className='w-5 h-5 text-gray-400'
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
              </button>
            </div>
          </div>
        )}

        {/* App Info */}
        <div className='bg-white rounded-lg shadow-md p-6'>
          <h2 className='text-2xl font-bold text-gray-800 mb-6'>About</h2>
          <div className='space-y-4 text-gray-600'>
            <p>
              This is a personal journaling application that helps you maintain
              daily reflections and track your thoughts, goals, and experiences.
            </p>
            <p>
              All your data is stored locally on your device for privacy. When
              you connect to cloud storage, your data is automatically synced
              for backup and access across devices.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
