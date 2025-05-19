import React from 'react';

interface IconButtonProps {
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'danger' | 'primary';
  size?: 'sm' | 'md';
  disabled?: boolean;
  title?: string;
}

const IconButton: React.FC<IconButtonProps> = ({
  onClick,
  children,
  className = '',
  variant = 'default',
  size = 'md',
  disabled = false,
  title,
}) => {
  const baseClasses =
    'inline-flex items-center justify-center rounded-md border transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2';

  const sizeClasses = {
    sm: 'p-1 text-xs',
    md: 'p-2 text-sm',
  };

  const variantClasses = {
    default:
      'border-gray-300 bg-white text-gray-700 hover:bg-gray-50 focus:ring-gray-500',
    danger:
      'border-red-300 bg-red-50 text-red-700 hover:bg-red-100 focus:ring-red-500',
    primary:
      'border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100 focus:ring-blue-500',
  };

  const disabledClasses = 'opacity-50 cursor-not-allowed';

  const classes = [
    baseClasses,
    sizeClasses[size],
    variantClasses[variant],
    disabled ? disabledClasses : '',
    className,
  ].join(' ');

  return (
    <button
      onClick={onClick}
      className={classes}
      disabled={disabled}
      title={title}
    >
      {children}
    </button>
  );
};

export default IconButton;
