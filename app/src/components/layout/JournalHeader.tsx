import React from 'react';
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

  const handleEditTemplate = () => {
    navigate('/templates');
  };

  const handleSettingsClick = () => {
    navigate('/settings');
  };

  const handleCloudSyncClick = () => {
    navigate('/settings#cloud-sync');
  };

  return (
    <header className='bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-20'>
      <div className='flex items-center justify-between max-w-full'>
        {/* Date Navigation */}
        <div className='flex-1'>
          <DateDisplay
            date={currentDate}
            onNextDay={onNavigateToNextDay}
            onPreviousDay={onNavigateToPreviousDay}
            isCurrentDay={isCurrentDayToday()}
          />
        </div>

        {/* Actions */}
        <div className='flex items-center space-x-2'>
          {/* Cloud Sync Indicator */}
          <CloudSyncIndicator
            databaseService={databaseService}
            onClick={handleCloudSyncClick}
          />

          <button
            onClick={handleEditTemplate}
            className='px-3 py-1 text-sm rounded-md border transition-colors bg-blue-100 text-blue-700 border-blue-300 hover:bg-blue-200'
          >
            Edit Template
          </button>

          <button
            onClick={onCopyToClipboard}
            className={`px-3 py-1 text-sm rounded-md border transition-colors ${
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
      </div>
    </header>
  );
};

export default JournalHeader;
