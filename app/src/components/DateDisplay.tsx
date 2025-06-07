import React from 'react';

interface DateDisplayProps {
  date: Date;
  onPreviousDay: () => void;
  onNextDay: () => void;
  isCurrentDay: boolean;
  isLoading?: boolean;
  navigationDisabled?: boolean;
}

const DateDisplay: React.FC<DateDisplayProps> = ({
  date,
  onPreviousDay,
  onNextDay,
  isCurrentDay,
  isLoading = false,
  navigationDisabled = false,
}) => {
  const formattedDate = date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className='flex flex-col items-start space-y-2'>
      <div className='text-base font-medium text-gray-800'>{formattedDate}</div>
      <div className='flex space-x-2'>
        <button
          onClick={onPreviousDay}
          className='px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm transition-colors'
          disabled={isLoading || navigationDisabled}
          aria-label='Previous day'
          title={navigationDisabled ? 'Saving changes...' : undefined}
        >
          {isLoading ? (
            <span className='inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin mr-1'></span>
          ) : null}
          ←&nbsp;Prev
        </button>
        <button
          onClick={onNextDay}
          className={`px-3 py-1 ${isCurrentDay ? 'bg-gray-300 cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-600'} text-white rounded disabled:opacity-50 text-sm transition-colors`}
          disabled={isCurrentDay || isLoading || navigationDisabled}
          aria-label='Next day'
          title={navigationDisabled ? 'Saving changes...' : undefined}
        >
          Next&nbsp;→
          {isLoading ? (
            <span className='inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin ml-1'></span>
          ) : null}
        </button>
      </div>
    </div>
  );
};

export default DateDisplay;
