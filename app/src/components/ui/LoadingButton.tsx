import React from 'react';
import { Spinner } from './Spinner';

interface LoadingButtonProps {
  children: React.ReactNode;
  loading?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
  spinnerSize?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'primary' | 'secondary' | 'success' | 'danger';
}

export const LoadingButton: React.FC<LoadingButtonProps> = ({
  children,
  loading = false,
  disabled = false,
  onClick,
  className = '',
  spinnerSize = 'sm',
  variant = 'primary',
}) => {
  const baseClasses =
    'px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

  const variantClasses = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700',
    secondary: 'bg-gray-100 text-gray-700 hover:bg-gray-200',
    success: 'bg-green-100 text-green-700 hover:bg-green-200',
    danger: 'bg-red-100 text-red-700 hover:bg-red-200',
  };

  const isDisabled = disabled || loading;

  return (
    <button
      onClick={onClick}
      disabled={isDisabled}
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
    >
      {loading ? (
        <div className='flex items-center space-x-2'>
          <Spinner size={spinnerSize} />
          <span>{children}</span>
        </div>
      ) : (
        children
      )}
    </button>
  );
};

export default LoadingButton;
