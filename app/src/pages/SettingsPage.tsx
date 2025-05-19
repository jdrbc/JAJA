import React from 'react';
import { useNavigate } from 'react-router-dom';
import { CloudSyncSettings } from '../components/CloudSyncSettings';

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
