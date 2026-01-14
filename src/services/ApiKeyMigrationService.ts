import { ConfigurationManager } from './ConfigurationManager';
import { SecureStorageManager } from './SecureStorageManager';
import { ApiKeys } from '../types/ConfigurationTypes';

/**
 * Service for migrating existing API keys from plaintext storage to secure storage
 */
export class ApiKeyMigrationService {
  private static instance: ApiKeyMigrationService;
  private configManager: ConfigurationManager;
  private storageManager: SecureStorageManager;

  private constructor() {
    this.configManager = ConfigurationManager.getInstance();
    this.storageManager = SecureStorageManager.getInstance();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): ApiKeyMigrationService {
    if (!ApiKeyMigrationService.instance) {
      ApiKeyMigrationService.instance = new ApiKeyMigrationService();
    }
    return ApiKeyMigrationService.instance;
  }

  /**
   * Check if migration is needed
   */
  public async needsMigration(): Promise<boolean> {
    try {
      const config = this.configManager.getConfig();

      // Check if there are any plaintext API keys in the config
      const hasPlaintextKeys = Object.values(config.apiKeys).some(key => key && key.trim() !== '' && key !== '***');

      if (!hasPlaintextKeys) {
        return false;
      }

      // Check if any keys are already stored securely
      const services: (keyof ApiKeys)[] = ['openai', 'elevenlabs', 'google', 'deepl'];
      for (const service of services) {
        if (config.apiKeys[service] && config.apiKeys[service] !== '***') {
          const secureKey = await this.storageManager.retrieveApiKey(service);
          if (secureKey) {
            // There's both plaintext and secure storage - migration may have been interrupted
            return true;
          }
        }
      }

      return hasPlaintextKeys;
    } catch (error) {
      console.error('Error checking migration status:', error);
      return false;
    }
  }

  /**
   * Perform migration of plaintext keys to secure storage
   */
  public async migrateKeys(): Promise<{ migrated: number; failed: number; errors: string[] }> {
    const result = { migrated: 0, failed: 0, errors: [] as string[] };

    try {
      const config = this.configManager.getConfig();
      const services: (keyof ApiKeys)[] = ['openai', 'elevenlabs', 'google', 'deepl'];

      for (const service of services) {
        const plaintextKey = config.apiKeys[service];

        if (plaintextKey && plaintextKey.trim() !== '' && plaintextKey !== '***') {
          try {
            // Store the key securely
            await this.storageManager.storeApiKey(service, plaintextKey);

            // Clear the plaintext key from config
            config.apiKeys[service] = '';
            result.migrated++;
          } catch (error) {
            result.failed++;
            const errorMsg = `Failed to migrate ${service} key: ${error instanceof Error ? error.message : 'Unknown error'}`;
            result.errors.push(errorMsg);
            console.error(errorMsg);
          }
        }
      }

      // Save the updated config with cleared plaintext keys
      if (result.migrated > 0) {
        this.configManager.updateConfig({ apiKeys: config.apiKeys });
      }

      // Update storage configuration to reflect migration
      const storageConfig = this.configManager.getConfig().uiSettings.storageConfig || {
        type: 'keychain',
        hasPassphrase: false
      };
      storageConfig.lastMigration = new Date().toISOString();
      this.configManager.updateConfig({
        uiSettings: {
          ...this.configManager.getConfig().uiSettings,
          storageConfig
        }
      });

    } catch (error) {
      result.errors.push(`Migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return result;
  }

  /**
   * Validate that migration was successful
   */
  public async validateMigration(): Promise<{ valid: boolean; issues: string[] }> {
    const issues: string[] = [];

    try {
      const config = this.configManager.getConfig();
      const services: (keyof ApiKeys)[] = ['openai', 'elevenlabs', 'google', 'deepl'];

      for (const service of services) {
        // Check that no plaintext keys remain
        if (config.apiKeys[service] && config.apiKeys[service] !== '***') {
          issues.push(`Plaintext ${service} key still exists in config`);
        }

        // Check that secure keys are accessible
        try {
          const hasSecureKey = await this.storageManager.retrieveApiKey(service);
          if (config.apiKeys[service] === '***' && !hasSecureKey) {
            issues.push(`${service} key marked as configured but not found in secure storage`);
          }
        } catch (error) {
          issues.push(`Error checking ${service} key in secure storage: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
    } catch (error) {
      issues.push(`Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return {
      valid: issues.length === 0,
      issues
    };
  }

  /**
   * Emergency rollback - restore plaintext keys from secure storage
   * This should only be used if secure storage is completely broken
   */
  public async emergencyRollback(): Promise<{ restored: number; failed: number; errors: string[] }> {
    const result = { restored: 0, failed: 0, errors: [] as string[] };

    console.warn('Performing emergency rollback of API keys to plaintext storage');

    try {
      const config = this.configManager.getConfig();
      const services: (keyof ApiKeys)[] = ['openai', 'elevenlabs', 'google', 'deepl'];

      for (const service of services) {
        try {
          const secureKey = await this.storageManager.retrieveApiKey(service);
          if (secureKey) {
            config.apiKeys[service] = secureKey;
            result.restored++;
          }
        } catch (error) {
          result.failed++;
          const errorMsg = `Failed to restore ${service} key: ${error instanceof Error ? error.message : 'Unknown error'}`;
          result.errors.push(errorMsg);
          console.error(errorMsg);
        }
      }

      // Save the updated config with restored plaintext keys
      if (result.restored > 0) {
        this.configManager.updateConfig({ apiKeys: config.apiKeys });
      }

    } catch (error) {
      result.errors.push(`Rollback failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return result;
  }

  /**
   * Get migration status information
   */
  public async getMigrationStatus(): Promise<{
    needsMigration: boolean;
    plaintextKeys: (keyof ApiKeys)[];
    secureKeys: (keyof ApiKeys)[];
    storageType: 'keychain' | 'passphrase' | 'none';
  }> {
    const config = this.configManager.getConfig();
    const services: (keyof ApiKeys)[] = ['openai', 'elevenlabs', 'google', 'deepl'];
    const plaintextKeys: (keyof ApiKeys)[] = [];
    const secureKeys: (keyof ApiKeys)[] = [];

    for (const service of services) {
      if (config.apiKeys[service] && config.apiKeys[service] !== '***') {
        plaintextKeys.push(service);
      }

      try {
        const secureKey = await this.storageManager.retrieveApiKey(service);
        if (secureKey) {
          secureKeys.push(service);
        }
      } catch (error) {
        // Ignore errors when checking secure storage
      }
    }

    const storageConfig = this.storageManager.getStorageConfig();

    return {
      needsMigration: plaintextKeys.length > 0,
      plaintextKeys,
      secureKeys,
      storageType: storageConfig.type
    };
  }
}
