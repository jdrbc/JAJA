import database from '../database/watermelon/database';
import { ApiKey as ApiKeyModel } from '../database/watermelon/models';
import { logger } from '../utils/logger';
import { Q } from '@nozbe/watermelondb';

export interface ApiKey {
  id: string;
  service: string;
  keyValue: string;
  createdAt: string;
  updatedAt: string;
}

export class ApiKeyService {
  async getApiKey(service: string): Promise<string | null> {
    try {
      const apiKeys = await database.collections
        .get<ApiKeyModel>('api_keys')
        .query(Q.where('service', service))
        .fetch();

      if (apiKeys.length > 0) {
        return apiKeys[0].keyValue;
      }

      return null;
    } catch (error) {
      logger.error(`Error getting API key for ${service}:`, error);
      return null;
    }
  }

  async setApiKey(service: string, keyValue: string): Promise<void> {
    try {
      await database.write(async () => {
        // Check if key already exists
        const existingKeys = await database.collections
          .get<ApiKeyModel>('api_keys')
          .query(Q.where('service', service))
          .fetch();

        if (existingKeys.length > 0) {
          // Update existing key
          await existingKeys[0].update((apiKey: ApiKeyModel) => {
            apiKey.keyValue = keyValue;
          });
        } else {
          // Insert new key
          await database.collections
            .get<ApiKeyModel>('api_keys')
            .create((apiKey: ApiKeyModel) => {
              apiKey.service = service;
              apiKey.keyValue = keyValue;
            });
        }
      });

      logger.log(`API key set for service: ${service}`);
    } catch (error) {
      logger.error(`Error setting API key for ${service}:`, error);
      throw error;
    }
  }

  async deleteApiKey(service: string): Promise<void> {
    try {
      await database.write(async () => {
        const apiKeys = await database.collections
          .get<ApiKeyModel>('api_keys')
          .query(Q.where('service', service))
          .fetch();

        if (apiKeys.length > 0) {
          await apiKeys[0].destroyPermanently();
        }
      });

      logger.log(`API key deleted for service: ${service}`);
    } catch (error) {
      logger.error(`Error deleting API key for ${service}:`, error);
      throw error;
    }
  }

  async listApiKeys(): Promise<ApiKey[]> {
    try {
      const apiKeyRecords = await database.collections
        .get<ApiKeyModel>('api_keys')
        .query(Q.sortBy('service'))
        .fetch();

      return apiKeyRecords.map(record => ({
        id: record.id,
        service: record.service,
        keyValue: '****', // Don't return actual key values for security
        createdAt: record.createdAt.toISOString(),
        updatedAt: record.updatedAt.toISOString(),
      }));
    } catch (error) {
      logger.error('Error listing API keys:', error);
      return [];
    }
  }

  async hasApiKey(service: string): Promise<boolean> {
    const key = await this.getApiKey(service);
    return key !== null && key.trim().length > 0;
  }

  // Validate API key format (basic validation)
  validateApiKeyFormat(
    service: string,
    keyValue: string
  ): { isValid: boolean; error?: string } {
    if (!keyValue || keyValue.trim().length === 0) {
      return { isValid: false, error: 'API key cannot be empty' };
    }

    switch (service) {
      case 'gemini':
        // Gemini API keys typically start with 'AIza' and are about 39 characters
        if (!keyValue.startsWith('AIza') || keyValue.length < 35) {
          return {
            isValid: false,
            error:
              'Invalid Gemini API key format. Keys should start with "AIza" and be approximately 39 characters long.',
          };
        }
        break;

      default:
        // Generic validation for unknown services
        if (keyValue.length < 10) {
          return { isValid: false, error: 'API key seems too short' };
        }
    }

    return { isValid: true };
  }

  // Get masked API key for display purposes
  async getMaskedApiKey(service: string): Promise<string | null> {
    const key = await this.getApiKey(service);
    if (!key) return null;

    // Show first 4 and last 4 characters, mask the rest
    if (key.length <= 8) {
      return '*'.repeat(key.length);
    }

    return (
      key.substring(0, 4) +
      '*'.repeat(key.length - 8) +
      key.substring(key.length - 4)
    );
  }
}

export const apiKeyService = new ApiKeyService();
