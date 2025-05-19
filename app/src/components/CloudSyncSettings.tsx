import React from 'react';
import { useCloudStorage } from '../hooks/useCloudStorage';
import { logger } from '../utils/logger';

export function CloudSyncSettings() {
  const {
    providers,
    loading,
    activeProvider,
    connectProvider,
    disconnect,
    isConnected,
    syncInProgress,
    lastSync,
    error,
  } = useCloudStorage();

  const handleConnect = async (providerName: string) => {
    await connectProvider(providerName);
  };

  const handleDisconnect = async () => {
    try {
      await disconnect();
    } catch (error) {
      logger.error('Disconnect failed:', error);
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
      {isConnected && activeProvider && (
        <div className='bg-green-50 border border-green-200 rounded-lg p-4'>
          <div className='flex items-center justify-between'>
            <div className='flex items-center space-x-3'>
              <span className='text-2xl'>{activeProvider.icon}</span>
              <div>
                <h3 className='font-medium text-green-800'>
                  Connected to {activeProvider.displayName}
                </h3>
                <p className='text-sm text-green-600'>
                  {lastSync
                    ? `Last synced: ${lastSync.toLocaleString()}`
                    : 'Ready to sync'}
                </p>
              </div>
            </div>
            <button
              onClick={handleDisconnect}
              disabled={loading || syncInProgress}
              className='px-4 py-2 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200 disabled:opacity-50 disabled:cursor-not-allowed'
            >
              Disconnect
            </button>
          </div>

          {syncInProgress && (
            <div className='mt-3 flex items-center space-x-2 text-sm text-green-600'>
              <div className='w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin'></div>
              <span>Syncing...</span>
            </div>
          )}
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className='bg-red-50 border border-red-200 rounded-lg p-4'>
          <h3 className='font-medium text-red-800 mb-2'>Sync Error</h3>
          <p className='text-sm text-red-600'>{error}</p>
        </div>
      )}

      {/* Connection Options */}
      {!isConnected && (
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
        <h3 className='font-medium text-blue-800 mb-2'>How it works</h3>
        <ul className='text-sm text-blue-700 space-y-1'>
          <li>• Your journal data syncs automatically when you make changes</li>
          <li>
            • Data is stored in a private app folder (not visible in your Drive)
          </li>
          <li>• Changes are saved within 2 seconds of editing</li>
          <li>• Works offline - syncs when you reconnect</li>
        </ul>
      </div>
    </div>
  );
}
