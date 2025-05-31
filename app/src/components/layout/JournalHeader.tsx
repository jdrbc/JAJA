import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DateDisplay from '../DateDisplay';
import { CloudSyncIndicator } from '../CloudSyncIndicator';
import databaseService from '../../services/database';

interface JournalHeaderProps {
  currentDate: Date;
  onNavigateToNextDay: () => void;
  onNavigateToPreviousDay: () => void;
  isCurrentDayToday: () => boolean;
  copyStatus: 'idle' | 'copied';
  onCopyToClipboard: () => void;
}

const JournalHeader: React.FC<JournalHeaderProps> = ({
  currentDate,
  onNavigateToNextDay,
  onNavigateToPreviousDay,
  isCurrentDayToday,
  copyStatus,
  onCopyToClipboard,
}) => {
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleEditTemplate = () => {
    navigate('/templates');
    setIsMobileMenuOpen(false);
  };

  const handleSettingsClick = () => {
    navigate('/settings');
    setIsMobileMenuOpen(false);
  };

  const handleCloudSyncClick = () => {
    navigate('/settings#cloud-sync');
    setIsMobileMenuOpen(false);
  };

  const handleCopyClick = () => {
    onCopyToClipboard();
    setIsMobileMenuOpen(false);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsMobileMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <header className='bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-20'>
      <div className='flex items-center justify-between max-w-full'>
        {/* Date Navigation */}
        <div className='flex-1 min-w-0'>
          <DateDisplay
            date={currentDate}
            onNextDay={onNavigateToNextDay}
            onPreviousDay={onNavigateToPreviousDay}
            isCurrentDay={isCurrentDayToday()}
          />
        </div>

        {/* Desktop Actions - Hidden on mobile */}
        <div className='hidden lg:flex items-center space-x-2 flex-shrink-0'>
          <CloudSyncIndicator
            databaseService={databaseService}
            onClick={handleCloudSyncClick}
          />

          <button
            onClick={handleEditTemplate}
            className='px-3 py-1 text-sm rounded-md border transition-colors bg-blue-100 text-blue-700 border-blue-300 hover:bg-blue-200 whitespace-nowrap'
          >
            Edit Template
          </button>

          <button
            onClick={onCopyToClipboard}
            className={`px-3 py-1 text-sm rounded-md border transition-colors whitespace-nowrap ${
              copyStatus === 'copied'
                ? 'bg-green-100 text-green-700 border-green-300'
                : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200'
            }`}
          >
            {copyStatus === 'copied' ? 'Copied!' : 'Copy as Markdown'}
          </button>

          <button
            onClick={handleSettingsClick}
            className='px-3 py-1 text-sm rounded-md border transition-colors bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200'
            title='Settings'
          >
            ⚙️
          </button>
        </div>

        {/* Mobile Menu Button - Hidden on desktop */}
        <div className='lg:hidden relative flex-shrink-0' ref={dropdownRef}>
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className='p-2 rounded-md hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500'
            aria-label='Open menu'
          >
            <svg
              className='w-5 h-5 text-gray-600'
              fill='none'
              stroke='currentColor'
              viewBox='0 0 24 24'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z'
              />
            </svg>
          </button>

          {/* Mobile Dropdown Menu */}
          {isMobileMenuOpen && (
            <div className='absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-30'>
              <div className='py-2'>
                <button
                  onClick={handleCloudSyncClick}
                  className='flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100'
                >
                  <span className='mr-3'>☁️</span>
                  Cloud Sync
                </button>

                <button
                  onClick={handleEditTemplate}
                  className='flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100'
                >
                  <span className='mr-3'>✏️</span>
                  Edit Template
                </button>

                <button
                  onClick={handleCopyClick}
                  className='flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100'
                >
                  <span className='mr-3'>
                    {copyStatus === 'copied' ? '✅' : '📋'}
                  </span>
                  {copyStatus === 'copied' ? 'Copied!' : 'Copy as Markdown'}
                </button>

                <button
                  onClick={handleSettingsClick}
                  className='flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100'
                >
                  <span className='mr-3'>⚙️</span>
                  Settings
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default JournalHeader;
