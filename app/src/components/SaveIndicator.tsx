import React from 'react';
import { SaveStatus } from '../hooks/useSaveStatus';

interface SaveIndicatorProps {
  status: SaveStatus;
  statusText: string;
  statusColor: string;
  variant?: 'desktop' | 'mobile';
}

export function SaveIndicator({
  status,
  statusText,
  statusColor,
  variant = 'desktop',
}: SaveIndicatorProps) {
  if (variant === 'mobile') {
    return (
      <div className='fixed bottom-4 right-4 z-50 lg:hidden'>
        <div className='flex items-center gap-1 px-2 py-1 bg-white border border-gray-200 rounded-full shadow-lg text-xs'>
          {status === 'saving' && (
            <div className='w-2 h-2 border border-blue-600 border-t-transparent rounded-full animate-spin'></div>
          )}
          <span className={statusColor}>
            {status === 'pending' && '•'}
            {status === 'saving' && '↻'}
            {status === 'synced' && '✓'}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className='flex items-center gap-2 px-3 py-1 bg-gray-100 rounded-lg text-sm'>
      {status === 'saving' && (
        <div className='w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin'></div>
      )}
      <span className={statusColor}>{statusText}</span>
    </div>
  );
}
