import { SecureStorageManager } from './SecureStorageManager';
import { ApiKeys } from '../types/ConfigurationTypes';
import { ApiError, ErrorCodes } from '../types/ErrorTypes';

/**
 * Manages API keys with secure storage and validation
 */
export class ApiKeyManager {
  private static instance: ApiKeyManager;
  private storageManager: SecureStorageManager;

  private constructor() {
    this.storageManager = SecureStorageManager.getInstance();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): ApiKeyManager {
    if (!ApiKeyManager.instance) {
      ApiKeyManager.instance = new ApiKeyManager();
    }
    return ApiKeyManager.instance;
  }

  /**
   * Get all API keys (returns masked values for security)
   */
  public async getApiKeys(): Promise<ApiKeys> {
    const services: (keyof ApiKeys)[] = ['openai', 'elevenlabs', 'deepinfra', 'google', 'deepl'];
    const apiKeys: ApiKeys = {
      openai: '',
      elevenlabs: '',
      deepinfra: '',
      google: '',
      deepl: ''
    };

    for (const service of services) {
      const hasKey = await this.hasApiKey(service);
      apiKeys[service] = hasKey ? '***' : '';
      console.log(`[ApiKeyManager] Service ${service}: ${hasKey ? 'HAS KEY' : 'NO KEY'}`);
    }

    return apiKeys;
  }

  /**
   * Set API key for a specific service
   */
  public async setApiKey(service: keyof ApiKeys, apiKey: string): Promise<void> {
    if (!apiKey || apiKey.trim().length === 0) {
      await this.removeApiKey(service);
      return;
    }

    await this.storageManager.storeApiKey(service, apiKey.trim());
  }

  /**
   * Get API key for a specific service
   */
  public async getApiKey(service: keyof ApiKeys): Promise<string> {
    try {
      return await this.storageManager.retrieveApiKey(service);
    } catch (error) {
      console.error(`Error retrieving API key for ${service}:`, error);
      return '';
    }
  }

  /**
   * Check if API key is configured for a service
   */
  public async hasApiKey(service: keyof ApiKeys): Promise<boolean> {
    try {
      const apiKey = await this.getApiKey(service);
      return apiKey.length > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Validate API key format for a specific service
   */
  public validateApiKeyFormat(service: keyof ApiKeys, apiKey: string): boolean {
    if (!apiKey || apiKey.trim().length === 0) {
      return false;
    }

    const trimmedKey = apiKey.trim();

    switch (service) {
      case 'openai':
        // OpenAI API keys start with 'sk-' and are typically 51 characters
        return trimmedKey.startsWith('sk-') && trimmedKey.length >= 20;

      case 'elevenlabs':
        // ElevenLabs API keys are typically 32 character hex strings
        return /^[a-f0-9]{32}$/i.test(trimmedKey);

      case 'google':
        // Google API keys are typically 39 characters starting with 'AIza'
        return trimmedKey.startsWith('AIza') && trimmedKey.length === 39;

      case 'deepinfra':
        // DeepInfra API keys are typically alphanumeric strings with optional special chars
        return trimmedKey.length >= 20 && /^[a-zA-Z0-9_\-]+$/.test(trimmedKey);

      case 'deepl':
        // DeepL API keys end with ':fx' for free tier or are UUID-like for pro
        return trimmedKey.endsWith(':fx') ||
               /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(trimmedKey);

      default:
        return false;
    }
  }

  /**
   * Validate API key by making a test request
   */
  public async validateApiKey(service: keyof ApiKeys, apiKey: string): Promise<{ valid: boolean; error?: string }> {
    if (!this.validateApiKeyFormat(service, apiKey)) {
      return {
        valid: false,
        error: 'Invalid API key format'
      };
    }

    try {
      switch (service) {
        case 'openai':
          return await this.validateOpenAIKey(apiKey);

        case 'elevenlabs':
          return await this.validateElevenLabsKey(apiKey);

        case 'deepinfra':
          return await this.validateDeepInfraKey(apiKey);

        case 'google':
          return await this.validateGoogleKey(apiKey);

        case 'deepl':
          return await this.validateDeepLKey(apiKey);

        default:
          return {
            valid: false,
            error: 'Unknown service'
          };
      }
    } catch (error) {
      console.error(`Error validating ${service} API key:`, error);
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Validation failed'
      };
    }
  }

  /**
   * Remove API key for a service
   */
  public async removeApiKey(service: keyof ApiKeys): Promise<void> {
    console.log(`[ApiKeyManager] Removing API key for service: ${service}`);
    await this.storageManager.deleteApiKey(service);
    
    // Verify the key was actually removed
    const stillExists = await this.hasApiKey(service);
    if (stillExists) {
      console.error(`[ApiKeyManager] Key for ${service} still exists after deletion!`);
      throw new Error(`Failed to remove API key for ${service}`);
    }
    console.log(`[ApiKeyManager] Successfully removed API key for service: ${service}`);
  }

  /**
   * Clear all API keys
   */
  public async clearAllApiKeys(): Promise<void> {
    const services: (keyof ApiKeys)[] = ['openai', 'elevenlabs', 'deepinfra', 'google', 'deepl'];
    for (const service of services) {
      await this.removeApiKey(service);
    }
  }

  /**
   * Get list of services with configured API keys
   */
  public async getConfiguredServices(): Promise<(keyof ApiKeys)[]> {
    const services: (keyof ApiKeys)[] = ['openai', 'elevenlabs', 'deepinfra', 'google', 'deepl'];
    const configuredServices: (keyof ApiKeys)[] = [];

    for (const service of services) {
      if (await this.hasApiKey(service)) {
        configuredServices.push(service);
      }
    }

    return configuredServices;
  }

  /**
   * Get list of services missing API keys
   */
  public async getMissingServices(): Promise<(keyof ApiKeys)[]> {
    const services: (keyof ApiKeys)[] = ['openai', 'elevenlabs', 'deepinfra', 'google', 'deepl'];
    const missingServices: (keyof ApiKeys)[] = [];

    for (const service of services) {
      if (!(await this.hasApiKey(service))) {
        missingServices.push(service);
      }
    }

    return missingServices;
  }

  /**
   * Get storage configuration
   */
  public getStorageConfig(): { type: 'keychain' | 'passphrase' | 'none'; hasPassphrase: boolean } {
    return this.storageManager.getStorageConfig();
  }

  /**
   * Configure storage type
   */
  public async configureStorage(type: 'keychain' | 'passphrase' | 'none', passphrase?: string): Promise<void> {
    await this.storageManager.configureStorage(type, passphrase);
  }

  /**
   * Validate OpenAI API key
   */
  private async validateOpenAIKey(apiKey: string): Promise<{ valid: boolean; error?: string }> {
    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        return { valid: true };
      } else if (response.status === 401) {
        return { valid: false, error: 'Invalid API key' };
      } else if (response.status === 429) {
        return { valid: false, error: 'Rate limit exceeded' };
      } else {
        return { valid: false, error: `HTTP ${response.status}: ${response.statusText}` };
      }
    } catch (error) {
      return {
        valid: false,
        error: 'Network error - unable to validate key'
      };
    }
  }

  /**
   * Validate ElevenLabs API key
   */
  private async validateElevenLabsKey(apiKey: string): Promise<{ valid: boolean; error?: string }> {
    try {
      const response = await fetch('https://api.elevenlabs.io/v1/user', {
        method: 'GET',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        return { valid: true };
      } else if (response.status === 401) {
        return { valid: false, error: 'Invalid API key' };
      } else if (response.status === 429) {
        return { valid: false, error: 'Rate limit exceeded' };
      } else {
        return { valid: false, error: `HTTP ${response.status}: ${response.statusText}` };
      }
    } catch (error) {
      return {
        valid: false,
        error: 'Network error - unable to validate key'
      };
    }
  }

  /**
   * Validate DeepInfra API key
   */
  private async validateDeepInfraKey(apiKey: string): Promise<{ valid: boolean; error?: string }> {
    try {
      const response = await fetch('https://api.deepinfra.com/v1/models', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        return { valid: true };
      } else if (response.status === 401) {
        return { valid: false, error: 'Invalid API key' };
      } else if (response.status === 429) {
        return { valid: false, error: 'Rate limit exceeded' };
      } else {
        return { valid: false, error: `HTTP ${response.status}: ${response.statusText}` };
      }
    } catch (error) {
      return {
        valid: false,
        error: 'Network error - unable to validate key'
      };
    }
  }

  /**
   * Validate Google Translate API key
   */
  private async validateGoogleKey(apiKey: string): Promise<{ valid: boolean; error?: string }> {
    try {
      const testUrl = `https://translation.googleapis.com/language/translate/v2/languages?key=${apiKey}`;
      const response = await fetch(testUrl);

      if (response.ok) {
        return { valid: true };
      } else if (response.status === 400) {
        return { valid: false, error: 'Invalid API key' };
      } else if (response.status === 403) {
        return { valid: false, error: 'API key access denied' };
      } else {
        return { valid: false, error: `HTTP ${response.status}: ${response.statusText}` };
      }
    } catch (error) {
      return {
        valid: false,
        error: 'Network error - unable to validate key'
      };
    }
  }

  /**
   * Validate DeepL API key
   */
  private async validateDeepLKey(apiKey: string): Promise<{ valid: boolean; error?: string }> {
    try {
      const baseUrl = apiKey.endsWith(':fx') 
        ? 'https://api-free.deepl.com/v2/usage'
        : 'https://api.deepl.com/v2/usage';

      const response = await fetch(baseUrl, {
        method: 'GET',
        headers: {
          'Authorization': `DeepL-Auth-Key ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        return { valid: true };
      } else if (response.status === 403) {
        return { valid: false, error: 'Invalid API key' };
      } else if (response.status === 429) {
        return { valid: false, error: 'Rate limit exceeded' };
      } else {
        return { valid: false, error: `HTTP ${response.status}: ${response.statusText}` };
      }
    } catch (error) {
      return {
        valid: false,
        error: 'Network error - unable to validate key'
      };
    }
  }
}