import React, { useState } from 'react';
import { ConflictData, ConflictResolution } from '../types/cloudStorage';

interface ConflictResolutionModalProps {
  conflict: ConflictData;
  onResolve: (resolution: ConflictResolution) => void;
  isOpen: boolean;
}

export const ConflictResolutionModal: React.FC<
  ConflictResolutionModalProps
> = ({ conflict, onResolve, isOpen }) => {
  const [selectedResolution, setSelectedResolution] =
    useState<ConflictResolution | null>(null);

  if (!isOpen) return null;

  const handleResolve = () => {
    if (selectedResolution) {
      onResolve(selectedResolution);
    }
  };

  const formatDataSize = (data: Uint8Array) => {
    const sizeInKB = Math.round(data.length / 1024);
    return `${sizeInKB} KB`;
  };

  const formatHash = (hash: string) => {
    return `${hash.slice(0, 8)}...${hash.slice(-8)}`;
  };

  return (
    <div className='fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50'>
      <div className='relative top-20 mx-auto p-6 border shadow-lg rounded-md bg-white max-w-2xl w-full max-w-[calc(100vw-2rem)]'>
        <div className='mt-3'>
          <div className='flex items-center mb-6'>
            <span className='text-2xl mr-3'>⚠️</span>
            <h3 className='text-xl font-semibold text-gray-900'>
              Database Conflict Detected
            </h3>
          </div>

          <p className='text-gray-600 mb-6'>
            Your local journal data differs from the data stored in the cloud.
            Please choose which version you'd like to keep:
          </p>

          <div className='space-y-4 mb-6'>
            {/* Local Data Option */}
            <div
              className={`border-2 rounded-lg p-4 cursor-pointer transition-colors ${
                selectedResolution === 'use-local'
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => setSelectedResolution('use-local')}
            >
              <div className='flex items-center mb-2'>
                <input
                  type='radio'
                  name='resolution'
                  value='use-local'
                  checked={selectedResolution === 'use-local'}
                  onChange={() => setSelectedResolution('use-local')}
                  className='h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500'
                />
                <label className='ml-3 text-lg font-medium text-gray-900'>
                  💻 Keep Local Data
                </label>
              </div>
              <div className='ml-7 text-sm text-gray-600'>
                <p>Use the data currently on this device</p>
                <p className='mt-1'>
                  <span className='font-medium'>Size:</span>{' '}
                  {formatDataSize(conflict.localData)} •{' '}
                  <span className='font-medium ml-2'>Hash:</span>{' '}
                  {formatHash(conflict.localHash)}
                </p>
              </div>
            </div>

            {/* Cloud Data Option */}
            <div
              className={`border-2 rounded-lg p-4 cursor-pointer transition-colors ${
                selectedResolution === 'use-cloud'
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => setSelectedResolution('use-cloud')}
            >
              <div className='flex items-center mb-2'>
                <input
                  type='radio'
                  name='resolution'
                  value='use-cloud'
                  checked={selectedResolution === 'use-cloud'}
                  onChange={() => setSelectedResolution('use-cloud')}
                  className='h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500'
                />
                <label className='ml-3 text-lg font-medium text-gray-900'>
                  ☁️ Keep Cloud Data
                </label>
              </div>
              <div className='ml-7 text-sm text-gray-600'>
                <p>Use the data stored in the cloud</p>
                <p className='mt-1'>
                  <span className='font-medium'>Size:</span>{' '}
                  {formatDataSize(conflict.cloudData)} •{' '}
                  <span className='font-medium ml-2'>Hash:</span>{' '}
                  {formatHash(conflict.cloudHash)}
                </p>
              </div>
            </div>
          </div>

          <div className='bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6'>
            <div className='flex'>
              <span className='text-yellow-600 mr-2'>⚠️</span>
              <div className='text-sm text-yellow-800'>
                <p className='font-medium'>Important:</p>
                <p>
                  The version you don't choose will be overwritten. Consider
                  exporting a backup before proceeding if you're unsure.
                </p>
              </div>
            </div>
          </div>

          <div className='flex justify-end space-x-3'>
            <button
              onClick={() => onResolve('cancel')}
              className='px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
            >
              Cancel
            </button>
            <button
              onClick={handleResolve}
              disabled={!selectedResolution}
              className='px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed'
            >
              Continue with Selected Data
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
