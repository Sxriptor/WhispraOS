import * as keytar from 'keytar';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { ApiKeys } from '../types/ConfigurationTypes';

/**
 * Secure storage manager for API keys with multiple backend options
 */
export class SecureStorageManager {
  private static instance: SecureStorageManager;
  private readonly serviceName = 'VoiceTranslationVoiceMod';
  private storageType: 'keychain' | 'passphrase' | 'none' = 'keychain';
  private passphrase: string | null = null;
  private encryptedStoragePath: string;

  private constructor() {
    // Get user data directory for encrypted storage
    const userDataPath = app.getPath('userData');
    this.encryptedStoragePath = path.join(userDataPath, 'encrypted-keys.json');

    // Load storage configuration
    this.loadStorageConfig();

    // Auto-migrate existing keys on startup
    this.autoMigrateExistingKeys();
  }

  /**
   * Auto-migrate existing plaintext keys on startup
   */
  private async autoMigrateExistingKeys(): Promise<void> {
    try {
      const { ConfigurationManager } = await import('./ConfigurationManager');
      const configManager = ConfigurationManager.getInstance();
      const config = configManager.getConfig();

      // Check if there are any plaintext keys in config
      const hasPlaintextKeys = Object.values(config.apiKeys).some(key => key && key.trim() !== '' && key !== '***');

      if (hasPlaintextKeys) {
        console.log('🔐 Auto-migrating plaintext API keys to secure storage...');

        const services: (keyof typeof config.apiKeys)[] = ['openai', 'elevenlabs', 'google', 'deepl'];

        for (const service of services) {
          const plaintextKey = config.apiKeys[service];
          if (plaintextKey && plaintextKey.trim() !== '' && plaintextKey !== '***') {
            await this.storeApiKey(service, plaintextKey);
            console.log(`✅ Migrated ${service} API key`);
          }
        }

        // Clear plaintext keys from config
        const cleanConfig = { ...config };
        cleanConfig.apiKeys = {
          openai: '',
          elevenlabs: '',
          google: '',
          deepl: ''
        };
        configManager.updateConfigSecure(cleanConfig);

        console.log('✅ Auto-migration completed');
      }
    } catch (error) {
      console.warn('⚠️ Auto-migration failed:', error);
    }
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): SecureStorageManager {
    if (!SecureStorageManager.instance) {
      SecureStorageManager.instance = new SecureStorageManager();
    }
    return SecureStorageManager.instance;
  }

  /**
   * Configure storage type and passphrase
   */
  public async configureStorage(type: 'keychain' | 'passphrase' | 'none', passphrase?: string): Promise<void> {
    // If switching from passphrase to something else, clear passphrase
    if (this.storageType === 'passphrase' && type !== 'passphrase') {
      await this.clearPassphraseStorage();
      this.passphrase = null;
    }

    this.storageType = type;

    if (type === 'passphrase') {
      if (!passphrase) {
        throw new Error('Passphrase is required for passphrase storage mode');
      }
      this.passphrase = passphrase;
      await this.migrateFromKeychainToPassphrase();
    }

    // Save configuration
    this.saveStorageConfig();

    // If switching away from keychain, clear keychain storage
    if (type !== 'keychain') {
      await this.clearKeychainStorage();
    }
  }

  /**
   * Get current storage configuration
   */
  public getStorageConfig(): { type: 'keychain' | 'passphrase' | 'none'; hasPassphrase: boolean } {
    return {
      type: this.storageType,
      hasPassphrase: this.passphrase !== null
    };
  }

  /**
   * Store API key using the configured storage method
   */
  public async storeApiKey(service: keyof ApiKeys, apiKey: string): Promise<void> {
    switch (this.storageType) {
      case 'keychain':
        await this.storeInKeychain(service, apiKey);
        break;
      case 'passphrase':
        await this.storeInPassphraseStorage(service, apiKey);
        break;
      case 'none':
        throw new Error('Cannot store API key when storage is disabled. Please configure storage first.');
      default:
        throw new Error(`Unknown storage type: ${this.storageType}`);
    }
  }

  /**
   * Retrieve API key from the configured storage method
   */
  public async retrieveApiKey(service: keyof ApiKeys): Promise<string> {
    switch (this.storageType) {
      case 'keychain':
        return await this.retrieveFromKeychain(service);
      case 'passphrase':
        return await this.retrieveFromPassphraseStorage(service);
      case 'none':
        return ''; // No keys stored when storage is disabled
      default:
        throw new Error(`Unknown storage type: ${this.storageType}`);
    }
  }

  /**
   * Delete API key from storage
   */
  public async deleteApiKey(service: keyof ApiKeys): Promise<void> {
    switch (this.storageType) {
      case 'keychain':
        await this.deleteFromKeychain(service);
        break;
      case 'passphrase':
        await this.deleteFromPassphraseStorage(service);
        break;
      case 'none':
        // Nothing to delete
        break;
      default:
        throw new Error(`Unknown storage type: ${this.storageType}`);
    }
  }

  /**
   * Store API key in OS keychain using keytar
   */
  private async storeInKeychain(service: keyof ApiKeys, apiKey: string): Promise<void> {
    try {
      await keytar.setPassword(this.serviceName, service, apiKey);
    } catch (error) {
      throw new Error(`Failed to store API key in keychain: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Retrieve API key from OS keychain
   */
  private async retrieveFromKeychain(service: keyof ApiKeys): Promise<string> {
    try {
      const apiKey = await keytar.getPassword(this.serviceName, service);
      return apiKey || '';
    } catch (error) {
      console.error(`Error retrieving API key from keychain:`, error);
      return '';
    }
  }

  /**
   * Delete API key from OS keychain
   */
  private async deleteFromKeychain(service: keyof ApiKeys): Promise<void> {
    try {
      const deleted = await keytar.deletePassword(this.serviceName, service);
      console.log(`[SecureStorageManager] Deleted ${service} key from keychain:`, deleted);
      
      // Verify deletion by attempting to retrieve the key
      const verifyKey = await keytar.getPassword(this.serviceName, service);
      if (verifyKey) {
        console.warn(`[SecureStorageManager] Key still exists after deletion, retrying...`);
        // Retry deletion
        await keytar.deletePassword(this.serviceName, service);
        
        // Verify again
        const verifyKey2 = await keytar.getPassword(this.serviceName, service);
        if (verifyKey2) {
          throw new Error('Failed to delete API key after retry');
        }
      }
    } catch (error) {
      // Ignore errors if key doesn't exist
      console.warn(`Could not delete API key from keychain:`, error);
    }
  }

  /**
   * Store API key using passphrase encryption
   */
  private async storeInPassphraseStorage(service: keyof ApiKeys, apiKey: string): Promise<void> {
    if (!this.passphrase) {
      throw new Error('No passphrase configured for encrypted storage');
    }

    try {
      const encryptedData = await this.encryptWithPassphrase(apiKey, this.passphrase);
      const storageData = this.loadEncryptedStorage();

      storageData[service] = encryptedData;
      this.saveEncryptedStorage(storageData);
    } catch (error) {
      throw new Error(`Failed to store API key in encrypted storage: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Retrieve API key from passphrase storage
   */
  private async retrieveFromPassphraseStorage(service: keyof ApiKeys): Promise<string> {
    if (!this.passphrase) {
      return '';
    }

    try {
      const storageData = this.loadEncryptedStorage();
      const encryptedData = storageData[service];

      if (!encryptedData) {
        return '';
      }

      return await this.decryptWithPassphrase(encryptedData, this.passphrase);
    } catch (error) {
      console.error(`Error retrieving API key from encrypted storage:`, error);
      return '';
    }
  }

  /**
   * Delete API key from passphrase storage
   */
  private async deleteFromPassphraseStorage(service: keyof ApiKeys): Promise<void> {
    try {
      const storageData = this.loadEncryptedStorage();
      delete storageData[service];
      this.saveEncryptedStorage(storageData);
    } catch (error) {
      console.warn(`Could not delete API key from encrypted storage:`, error);
    }
  }

  /**
   * Encrypt data with passphrase using AES-256-GCM
   */
  private async encryptWithPassphrase(data: string, passphrase: string): Promise<string> {
    const salt = crypto.randomBytes(32);
    const key = crypto.scryptSync(passphrase, salt, 32);

    const iv = crypto.randomBytes(12); // 96-bit IV recommended for GCM
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

    const encrypted = Buffer.concat([
      cipher.update(data, 'utf8'),
      cipher.final()
    ]);

    const tag = cipher.getAuthTag();

    // Combine salt, IV, tag, and encrypted data
    const result = Buffer.concat([salt, iv, tag, encrypted]);

    return result.toString('base64');
  }

  /**
   * Decrypt data with passphrase using AES-256-GCM
   */
  private async decryptWithPassphrase(encryptedData: string, passphrase: string): Promise<string> {
    const data = Buffer.from(encryptedData, 'base64');

    // Extract salt, IV, tag, and encrypted data
    const salt = data.subarray(0, 32);
    const iv = data.subarray(32, 44); // 12 bytes
    const tag = data.subarray(44, 60); // 16 bytes
    const encrypted = data.subarray(60);

    const key = crypto.scryptSync(passphrase, salt, 32);

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final()
    ]);

    return decrypted.toString('utf8');
  }

  /**
   * Load encrypted storage data
   */
  private loadEncryptedStorage(): Record<string, string> {
    try {
      if (fs.existsSync(this.encryptedStoragePath)) {
        const data = fs.readFileSync(this.encryptedStoragePath, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.warn('Could not load encrypted storage:', error);
    }

    return {};
  }

  /**
   * Save encrypted storage data
   */
  private saveEncryptedStorage(data: Record<string, string>): void {
    try {
      // Ensure directory exists
      const dir = path.dirname(this.encryptedStoragePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(this.encryptedStoragePath, JSON.stringify(data, null, 2));
    } catch (error) {
      throw new Error(`Failed to save encrypted storage: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Clear all keys from keychain storage
   */
  private async clearKeychainStorage(): Promise<void> {
    const services: (keyof ApiKeys)[] = ['openai', 'elevenlabs', 'google', 'deepl'];

    for (const service of services) {
      await this.deleteFromKeychain(service);
    }
  }

  /**
   * Clear passphrase storage
   */
  private async clearPassphraseStorage(): Promise<void> {
    try {
      if (fs.existsSync(this.encryptedStoragePath)) {
        fs.unlinkSync(this.encryptedStoragePath);
      }
    } catch (error) {
      console.warn('Could not clear encrypted storage file:', error);
    }
  }

  /**
   * Migrate keys from keychain to passphrase storage
   */
  private async migrateFromKeychainToPassphrase(): Promise<void> {
    if (!this.passphrase) {
      return;
    }

    const services: (keyof ApiKeys)[] = ['openai', 'elevenlabs', 'google', 'deepl'];

    for (const service of services) {
      try {
        const apiKey = await this.retrieveFromKeychain(service);
        if (apiKey) {
          await this.storeInPassphraseStorage(service, apiKey);
          await this.deleteFromKeychain(service);
        }
      } catch (error) {
        console.warn(`Could not migrate ${service} key:`, error);
      }
    }
  }

  /**
   * Load storage configuration from file
   */
  private loadStorageConfig(): void {
    try {
      const configPath = path.join(app.getPath('userData'), 'storage-config.json');

      if (fs.existsSync(configPath)) {
        const configData = fs.readFileSync(configPath, 'utf8');
        const config = JSON.parse(configData);

        this.storageType = config.type || 'keychain';

        if (config.type === 'passphrase' && config.encryptedPassphrase) {
          // Note: In a real implementation, you'd want to prompt for the passphrase
          // For now, we'll assume it's been set previously
          console.warn('Passphrase storage detected but passphrase not loaded. Please reconfigure storage.');
        }
      }
    } catch (error) {
      console.warn('Could not load storage configuration:', error);
    }
  }

  /**
   * Save storage configuration to file
   */
  private saveStorageConfig(): void {
    try {
      const configPath = path.join(app.getPath('userData'), 'storage-config.json');

      // Ensure directory exists
      const dir = path.dirname(configPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const config = {
        type: this.storageType,
        // Note: We don't save the actual passphrase for security reasons
        // It should be entered each time the app starts
        encryptedPassphrase: this.storageType === 'passphrase' ? 'configured' : null
      };

      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    } catch (error) {
      console.error('Could not save storage configuration:', error);
    }
  }
}
