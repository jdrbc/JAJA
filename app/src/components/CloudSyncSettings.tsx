import React, { useState } from 'react';
import { useSync } from '../services/unifiedSyncService';
import { logger } from '../utils/logger';

export function CloudSyncSettings() {
  const [loading, setLoading] = useState(false);
  const {
    providers,
    activeProvider,
    isCloudEnabled,
    connectProvider,
    disconnectProvider,
  } = useSync();

  const handleConnect = async (providerName: string) => {
    setLoading(true);
    try {
      await connectProvider(providerName);
    } catch (error) {
      logger.error('Connect failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setLoading(true);
    try {
      await disconnectProvider();
    } catch (error) {
      logger.error('Disconnect failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='space-y-6'>
      <div>
        <h2 className='text-xl font-semibold text-gray-800 mb-4'>
          Cloud Storage
        </h2>
        <p className='text-gray-600 mb-6'>
          Connect your journal to cloud storage for automatic syncing across
          devices. Your data is stored privately and securely.
        </p>
      </div>

      {/* Connection Status */}
      {isCloudEnabled && activeProvider && (
        <div className='bg-green-50 border border-green-200 rounded-lg p-4'>
          <div className='flex items-center justify-between'>
            <div className='flex items-center space-x-3'>
              <span className='text-2xl'>{activeProvider.icon}</span>
              <div>
                <h3 className='font-medium text-green-800'>
                  Connected to {activeProvider.displayName}
                </h3>
                <p className='text-sm text-green-600'>Auto-sync is enabled</p>
              </div>
            </div>
            <button
              onClick={handleDisconnect}
              disabled={loading}
              className='px-4 py-2 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200 disabled:opacity-50 disabled:cursor-not-allowed'
            >
              Disconnect
            </button>
          </div>
        </div>
      )}

      {/* Connection Options */}
      {!isCloudEnabled && (
        <div>
          <h3 className='text-lg font-semibold text-gray-800 mb-4'>
            Choose a Cloud Provider
          </h3>
          <div className='space-y-3'>
            {providers.map(provider => (
              <div
                key={provider.name}
                className='border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors'
              >
                <div className='flex items-center justify-between'>
                  <div className='flex items-center space-x-3'>
                    <span className='text-2xl'>{provider.icon}</span>
                    <div>
                      <h4 className='font-medium text-gray-800'>
                        {provider.displayName}
                      </h4>
                      <p className='text-sm text-gray-600'>
                        Secure, private storage in your app folder
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleConnect(provider.name)}
                    disabled={loading}
                    className='px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed'
                  >
                    {loading ? 'Connecting...' : 'Connect'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Info Section */}
      <div className='bg-blue-50 border border-blue-200 rounded-lg p-4'>
        <h3 className='font-medium text-blue-800 mb-2'>Privacy & Security</h3>
        <ul className='text-sm text-blue-700 space-y-1'>
          <li>
            • Your journal data is encrypted and stored in your private app
            folder
          </li>
          <li>• No one else can access your data, including us</li>
          <li>
            • All sync operations happen directly between your device and cloud
            storage
          </li>
          <li>• You can disconnect and delete your data at any time</li>
        </ul>
      </div>
    </div>
  );
}
