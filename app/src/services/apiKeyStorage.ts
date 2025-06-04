import databaseService from './database';
import { logger } from '../utils/logger';

export interface ApiKey {
  id: string;
  service: string;
  keyValue: string;
  createdAt: string;
  updatedAt: string;
}

export class ApiKeyService {
  private async ensureInitialized() {
    await databaseService.initialize();
  }

  async getApiKey(service: string): Promise<string | null> {
    await this.ensureInitialized();
    const db = databaseService.getConnection()!;

    try {
      const stmt = db.prepare(
        'SELECT key_value FROM api_keys WHERE service = ?'
      );
      stmt.bind([service]);

      let keyValue: string | null = null;
      if (stmt.step()) {
        const row = stmt.get({});
        keyValue = row.key_value as string;
      }
      stmt.finalize();

      return keyValue;
    } catch (error) {
      logger.error(`Error getting API key for ${service}:`, error);
      return null;
    }
  }

  async setApiKey(service: string, keyValue: string): Promise<void> {
    await this.ensureInitialized();
    const db = databaseService.getConnection()!;

    try {
      // Check if key already exists
      const existingStmt = db.prepare(
        'SELECT id FROM api_keys WHERE service = ?'
      );
      existingStmt.bind([service]);

      if (existingStmt.step()) {
        // Update existing key
        const updateStmt = db.prepare(`
          UPDATE api_keys 
          SET key_value = ?, updated_at = CURRENT_TIMESTAMP 
          WHERE service = ?
        `);
        updateStmt.bind([keyValue, service]);
        updateStmt.step();
        updateStmt.finalize();
      } else {
        // Insert new key
        const insertStmt = db.prepare(`
          INSERT INTO api_keys (id, service, key_value) 
          VALUES (?, ?, ?)
        `);
        const id = `${service}_${Date.now()}`;
        insertStmt.bind([id, service, keyValue]);
        insertStmt.step();
        insertStmt.finalize();
      }
      existingStmt.finalize();

      logger.log(`API key set for service: ${service}`);
    } catch (error) {
      logger.error(`Error setting API key for ${service}:`, error);
      throw error;
    }
  }

  async deleteApiKey(service: string): Promise<void> {
    await this.ensureInitialized();
    const db = databaseService.getConnection()!;

    try {
      const stmt = db.prepare('DELETE FROM api_keys WHERE service = ?');
      stmt.bind([service]);
      stmt.step();
      stmt.finalize();

      logger.log(`API key deleted for service: ${service}`);
    } catch (error) {
      logger.error(`Error deleting API key for ${service}:`, error);
      throw error;
    }
  }

  async listApiKeys(): Promise<ApiKey[]> {
    await this.ensureInitialized();
    const db = databaseService.getConnection()!;

    try {
      const stmt = db.prepare(`
        SELECT id, service, '' as key_value, created_at, updated_at 
        FROM api_keys 
        ORDER BY service
      `);

      const keys: ApiKey[] = [];
      while (stmt.step()) {
        const row = stmt.get({});
        keys.push({
          id: row.id as string,
          service: row.service as string,
          keyValue: '****', // Don't return actual key values for security
          createdAt: row.created_at as string,
          updatedAt: row.updated_at as string,
        });
      }
      stmt.finalize();

      return keys;
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
