import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import JournalEntryPage from './pages/JournalEntryPage';
import TemplateManagementPage from './pages/TemplateManagementPage';
import SettingsPage from './pages/SettingsPage';
import { useInitialization } from './services/initializationService';
import { useConflictResolution } from './hooks/useConflictResolution';
import { ConflictResolutionModal } from './components/ConflictResolutionModal';
import { initializeSectionRegistry } from './components/sections/registry';
import { DatabaseResetUtil } from './utils/databaseReset';
import './App.css';

// Loading component while the app initializes
const LoadingScreen: React.FC = () => {
  const [loadingTime, setLoadingTime] = useState(0);
  const [isTimeout, setIsTimeout] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setLoadingTime(prev => {
        const newTime = prev + 1;
        if (newTime >= 25) {
          setIsTimeout(true);
        }
        return newTime;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className='min-h-screen bg-gray-50 flex items-center justify-center'>
      <div className='text-center max-w-md px-6'>
        <div className='w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4' />
        <h2 className='text-xl font-medium text-gray-900 mb-2'>
          Initializing Journal
        </h2>
        <p className='text-gray-600 mb-4'>
          Setting up your data and sync services...
        </p>

        {/* Progress indicator */}
        <div className='w-full bg-gray-200 rounded-full h-2 mb-4'>
          <div
            className={`h-2 rounded-full transition-all duration-1000 ${
              isTimeout ? 'bg-orange-500' : 'bg-blue-600'
            }`}
            style={{ width: `${Math.min((loadingTime / 30) * 100, 100)}%` }}
          />
        </div>

        <p className='text-sm text-gray-500'>
          {loadingTime < 10 && 'Loading database...'}
          {loadingTime >= 10 &&
            loadingTime < 20 &&
            'Connecting to cloud services...'}
          {loadingTime >= 20 && !isTimeout && 'Finishing setup...'}
          {isTimeout && (
            <span className='text-orange-600'>
              Taking longer than expected... This may indicate a network issue.
            </span>
          )}
        </p>

        {loadingTime > 30 && (
          <button
            onClick={() => window.location.reload()}
            className='mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm'
          >
            Refresh Page
          </button>
        )}
      </div>
    </div>
  );
};

// Error component if initialization fails
const ErrorScreen: React.FC<{ error: string; onRetry: () => void }> = ({
  error,
  onRetry,
}) => (
  <div className='min-h-screen bg-gray-50 flex items-center justify-center'>
    <div className='text-center max-w-md'>
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
        Initialization Failed
      </h2>
      <p className='text-gray-600 mb-4'>{error}</p>
      <button
        onClick={onRetry}
        className='px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors'
      >
        Try Again
      </button>
    </div>
  </div>
);

function App() {
  // Initialize section registry on app start
  useEffect(() => {
    initializeSectionRegistry();

    // Make DatabaseResetUtil available in console for development
    if (process.env.NODE_ENV === 'development') {
      (window as any).DatabaseResetUtil = DatabaseResetUtil;
    }
  }, []);

  const { isLoading, error, retry } = useInitialization();
  const { isModalOpen, conflict, resolveConflict } = useConflictResolution();

  // Show loading screen while initializing
  if (isLoading) {
    return <LoadingScreen />;
  }

  // Show error screen if initialization failed
  if (error) {
    return <ErrorScreen error={error} onRetry={retry} />;
  }

  // Show main app once initialized
  return (
    <BrowserRouter>
      <div className='min-h-screen bg-gray-50'>
        <Routes>
          <Route path='/' element={<JournalEntryPage />} />
          <Route path='/templates' element={<TemplateManagementPage />} />
          <Route path='/settings' element={<SettingsPage />} />
        </Routes>

        {/* Conflict Resolution Modal */}
        {isModalOpen && conflict && (
          <ConflictResolutionModal
            isOpen={isModalOpen}
            conflict={conflict}
            onResolve={resolveConflict}
          />
        )}
      </div>
    </BrowserRouter>
  );
}

export default App;
