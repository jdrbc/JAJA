import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DateDisplay from '../DateDisplay';
import { SaveIndicator } from '../SaveIndicator';

interface JournalHeaderProps {
  currentDate: Date;
  onNavigateToNextDay: () => void;
  onNavigateToPreviousDay: () => void;
  isCurrentDayToday: () => boolean;
  copyStatus: 'idle' | 'copied';
  onCopyToClipboard: () => void;
}

export default function JournalHeader({
  currentDate,
  onNavigateToNextDay,
  onNavigateToPreviousDay,
  isCurrentDayToday,
  copyStatus,
  onCopyToClipboard,
}: JournalHeaderProps) {
  const [showCopied, setShowCopied] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const navigate = useNavigate();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mobileMenuRef = useRef<HTMLDivElement | null>(null);

  // Show copied message when status changes
  useEffect(() => {
    if (copyStatus === 'copied') {
      setShowCopied(true);

      // Clear existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Hide after 2 seconds
      timeoutRef.current = setTimeout(() => {
        setShowCopied(false);
      }, 2000);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [copyStatus]);

  // Close mobile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        mobileMenuRef.current &&
        !mobileMenuRef.current.contains(event.target as Node)
      ) {
        setShowMobileMenu(false);
      }
    };

    if (showMobileMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMobileMenu]);

  const handleSettingsClick = () => {
    navigate('/settings');
    setShowMobileMenu(false);
  };

  const handleTemplateEditClick = () => {
    navigate('/templates');
    setShowMobileMenu(false);
  };

  const handleCopyClick = () => {
    onCopyToClipboard();
    setShowMobileMenu(false);
  };

  const handleMobileMenuToggle = () => {
    setShowMobileMenu(!showMobileMenu);
  };

  const handleLogoClick = () => {
    navigate('/');
  };

  return (
    <header className='relative bg-white border-b border-gray-200'>
      <div className='flex justify-between items-center p-4'>
        {/* Left side - Logo and Date Navigation */}
        <div className='flex items-center gap-4'>
          {/* Logo */}
          <button
            onClick={handleLogoClick}
            className='flex items-center gap-2 hover:opacity-80 transition-opacity'
            title='JAJA - Just Another Journal App'
          >
            <img
              src='/logo.png'
              alt='JAJA Logo'
              className='h-8 w-8 object-contain'
            />
            <span className='hidden sm:block text-lg font-semibold text-gray-800'>
              JAJA
            </span>
          </button>

          {/* Date Navigation */}
          <DateDisplay
            date={currentDate}
            onNextDay={onNavigateToNextDay}
            onPreviousDay={onNavigateToPreviousDay}
            isCurrentDay={isCurrentDayToday()}
          />
        </div>

        {/* Mobile Menu Button - shows on mobile only */}
        <div className='flex items-center gap-3'>
          {/* Desktop Save Status */}
          <div className='hidden lg:block'>
            <SaveIndicator variant='desktop' />
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={handleMobileMenuToggle}
            className='lg:hidden flex items-center justify-center w-10 h-10 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors'
            title='Menu'
            aria-label='Toggle menu'
          >
            <div className='flex flex-col space-y-1'>
              <div className='w-4 h-0.5 bg-gray-600'></div>
              <div className='w-4 h-0.5 bg-gray-600'></div>
              <div className='w-4 h-0.5 bg-gray-600'></div>
            </div>
          </button>

          {/* Desktop Actions - hidden on mobile */}
          <div className='hidden lg:flex items-center gap-3'>
            {/* Copy Button */}
            <button
              onClick={onCopyToClipboard}
              className='flex items-center gap-2 px-3 py-1 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 text-sm transition-colors'
              title='Copy journal content to clipboard'
            >
              {showCopied ? (
                <>
                  <span>✓</span>
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <span>📋</span>
                  <span>Copy Markdown</span>
                </>
              )}
            </button>

            {/* Edit Templates Button */}
            <button
              onClick={handleTemplateEditClick}
              className='flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 text-sm transition-colors'
              title='Edit journal templates and layout'
            >
              <span>📝</span>
              <span>Edit Templates</span>
            </button>

            {/* Settings Button */}
            <button
              onClick={handleSettingsClick}
              className='flex items-center gap-2 px-3 py-1 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 text-sm transition-colors'
              title='Settings'
            >
              <span>⚙️</span>
              <span>Settings</span>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {showMobileMenu && (
        <div
          ref={mobileMenuRef}
          className='lg:hidden absolute top-full right-4 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-50'
        >
          <div className='py-2'>
            {/* Mobile Save Status */}
            <div className='px-4 py-2 border-b border-gray-100'>
              <SaveIndicator variant='mobile' />
            </div>

            {/* Copy Button */}
            <button
              onClick={handleCopyClick}
              className='w-full flex items-center gap-3 px-4 py-3 text-left text-gray-700 hover:bg-gray-50 transition-colors'
            >
              {showCopied ? (
                <>
                  <span className='text-lg'>✓</span>
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <span className='text-lg'>📋</span>
                  <span>Copy Markdown</span>
                </>
              )}
            </button>

            {/* Edit Templates Button */}
            <button
              onClick={handleTemplateEditClick}
              className='w-full flex items-center gap-3 px-4 py-3 text-left text-blue-700 hover:bg-blue-50 transition-colors'
            >
              <span className='text-lg'>📝</span>
              <span>Edit Templates</span>
            </button>

            {/* Settings Button */}
            <button
              onClick={handleSettingsClick}
              className='w-full flex items-center gap-3 px-4 py-3 text-left text-gray-700 hover:bg-gray-50 transition-colors'
            >
              <span className='text-lg'>⚙️</span>
              <span>Settings</span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
