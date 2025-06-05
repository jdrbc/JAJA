import React from 'react';

/**
 * A reusable spinning loading indicator component
 *
 * @example
 * // Basic usage
 * <Spinner />
 *
 * @example
 * // With custom size and styling
 * <Spinner size="lg" className="text-blue-500" />
 *
 * @example
 * // In a loading button
 * <div className="flex items-center space-x-2">
 *   <Spinner size="sm" />
 *   <span>Loading...</span>
 * </div>
 */

interface SpinnerProps {
  /** Size of the spinner */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  /** Additional CSS classes to apply */
  className?: string;
}

export const Spinner: React.FC<SpinnerProps> = ({
  size = 'sm',
  className = '',
}) => {
  const sizeClasses = {
    xs: 'h-3 w-3',
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
    xl: 'h-12 w-12',
  };

  return (
    <div className={`animate-spin ${sizeClasses[size]} ${className}`}>
      <svg
        className='h-full w-full text-current'
        fill='none'
        viewBox='0 0 24 24'
        aria-label='Loading'
      >
        <circle
          className='opacity-25'
          cx='12'
          cy='12'
          r='10'
          stroke='currentColor'
          strokeWidth='4'
        />
        <path
          className='opacity-75'
          fill='currentColor'
          d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'
        />
      </svg>
    </div>
  );
};

export default Spinner;
