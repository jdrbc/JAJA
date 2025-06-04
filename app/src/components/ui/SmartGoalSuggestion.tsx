import React, { useEffect } from 'react';

interface SmartGoalSuggestionProps {
  suggestion: string;
  loading: boolean;
  onAccept: () => void;
  onDismiss: () => void;
}

export const SmartGoalSuggestion: React.FC<SmartGoalSuggestionProps> = ({
  suggestion,
  loading,
  onAccept,
  onDismiss,
}) => {
  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Tab' && suggestion && !loading) {
        event.preventDefault();
        onAccept();
      } else if (event.key === 'Escape') {
        onDismiss();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [suggestion, loading, onAccept, onDismiss]);

  if (loading) {
    return (
      <div className='mt-1 p-2 bg-blue-50 border border-blue-200 rounded-md'>
        <div className='flex items-center space-x-1'>
          <div className='animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full'></div>
          <span className='text-sm text-blue-700'>
            Getting AI suggestion...
          </span>
        </div>
      </div>
    );
  }

  if (!suggestion) {
    return null;
  }

  return (
    <div className='mt-1 p-2 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-md shadow-sm'>
      <div className='flex items-start space-x-1'>
        <div className='flex-shrink-0'>
          <span className='text-lg'>💡</span>
        </div>
        <div className='flex-1 min-w-0'>
          <div className='text-sm font-medium text-blue-900 mb-1'>
            Suggested SMART goal:
          </div>
          <div className='text-sm text-blue-800 leading-relaxed'>
            {suggestion}
          </div>
        </div>
      </div>

      <div className='mt-2 flex items-center justify-between'>
        <div className='flex space-x-1'>
          <button
            onClick={onAccept}
            className='inline-flex items-center px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 transition-colors'
          >
            <span className='mr-1'>✓</span>
            Accept
          </button>
          <button
            onClick={onDismiss}
            className='inline-flex items-center px-3 py-1.5 bg-gray-200 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-1 transition-colors'
          >
            x
          </button>
        </div>
        <div className='text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded'>
          Press Tab to accept
        </div>
      </div>
    </div>
  );
};
