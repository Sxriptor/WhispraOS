import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { 
  AppConfig, 
  AudioQuality, 
  TTSQuality, 
  TranslationProvider,
  OverlaySettings,
  ManagedApiConfig
} from '../types/ConfigurationTypes';

/**
 * Manages application configuration with file-based persistence
 */
export class ConfigurationManager {
  private static instance: ConfigurationManager;
  private config: AppConfig;
  private configPath: string;
  private readonly configFileName = 'config.json';

  private constructor() {
    // Get user data directory
    const userDataPath = app.getPath('userData');
    this.configPath = path.join(userDataPath, this.configFileName);
    
    // Load configuration
    this.config = this.loadConfiguration();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): ConfigurationManager {
    if (!ConfigurationManager.instance) {
      ConfigurationManager.instance = new ConfigurationManager();
    }
    return ConfigurationManager.instance;
  }

  /**
   * Get current configuration
   */
  public getConfig(): AppConfig {
    return { ...this.config }; // Return a copy to prevent direct mutation
  }

  /**
   * Get current configuration (alias for getConfig)
   */
  public getConfiguration(): AppConfig {
    return this.getConfig();
  }

  /**
   * Update configuration with partial changes
   */
  public updateConfig(updates: Partial<AppConfig>): void {
    // Deep merge the updates with current config
    this.config = this.deepMerge(this.config, updates);

    // Validate the updated configuration
    this.validateConfiguration(this.config);

    // Save to file
    this._saveConfiguration();
  }

  /**
   * Update configuration without saving API keys
   */
  public updateConfigSecure(updates: Partial<AppConfig>): void {
    // Remove API keys from updates to prevent saving them
    const { apiKeys, ...cleanUpdates } = updates;

    // Deep merge the updates with current config
    this.config = this.deepMerge(this.config, cleanUpdates);

    // Ensure API keys are always empty in the saved config
    this.config.apiKeys = {
      openai: '',
      elevenlabs: '',
      google: '',
      deepl: ''
    };

    // Validate the updated configuration
    this.validateConfiguration(this.config);

    // Save to file
    this._saveConfiguration();
  }

  /**
   * Reset configuration to defaults
   */
  public resetToDefaults(): void {
    this.config = this.getDefaultConfiguration();
    this._saveConfiguration();
  }

  /**
   * Get specific configuration value by path
   */
  public getValue<T>(path: string): T | undefined {
    return this.getNestedValue(this.config, path);
  }

  /**
   * Set specific configuration value by path
   */
  public setValue(path: string, value: any): void {
    this.setNestedValue(this.config, path, value);
    this.validateConfiguration(this.config);
    this._saveConfiguration();
  }

  /**
   * Check if configuration file exists
   */
  public configExists(): boolean {
    return fs.existsSync(this.configPath);
  }

  /**
   * Get configuration file path
   */
  public getConfigPath(): string {
    return this.configPath;
  }

  /**
   * Load configuration from file or create default
   */
  private loadConfiguration(): AppConfig {
    try {
      if (fs.existsSync(this.configPath)) {
        const configData = fs.readFileSync(this.configPath, 'utf8');
        const loadedConfig = JSON.parse(configData);
        
        // Merge with defaults to ensure all properties exist
        const defaultConfig = this.getDefaultConfiguration();
        const mergedConfig = this.deepMerge(defaultConfig, loadedConfig);
        
        // Validate the loaded configuration
        this.validateConfiguration(mergedConfig);
        
        console.log('Configuration loaded from:', this.configPath);
        return mergedConfig;
      }
    } catch (error) {
      console.error('Error loading configuration:', error);
    }

    // Return default configuration if loading failed
    console.log('Using default configuration');
    return this.getDefaultConfiguration();
  }

  /**
   * Save configuration to file
   */
  public saveConfiguration(config?: AppConfig): void {
    if (config) {
      this.config = config;
      this.validateConfiguration(this.config);
    }
    this._saveConfiguration();
  }

  /**
   * Internal save configuration to file
   */
  private _saveConfiguration(): void {
    try {
      // Ensure directory exists
      const configDir = path.dirname(this.configPath);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }

      // Write configuration to file
      const configData = JSON.stringify(this.config, null, 2);
      fs.writeFileSync(this.configPath, configData, 'utf8');
      
      console.log('Configuration saved to:', this.configPath);
    } catch (error) {
      console.error('Error saving configuration:', error);
      throw new Error(`Failed to save configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get default configuration
   */
  private getDefaultConfiguration(): AppConfig {
    // On macOS, use "-" key instead of F11 to avoid conflict with volume controls
    const isMacOS = process.platform === 'darwin';
    const defaultOverlayHotkey = isMacOS 
      ? { ctrl: false, alt: false, shift: false, key: '-' }  // "-" key on macOS
      : { ctrl: false, alt: false, shift: false, key: 'F11' }; // F11 on Windows/Linux

    return {
      selectedMicrophone: '',
      targetLanguage: 'en',
      sourceLanguage: 'ja',
      languageCandidates: [],
      translationProvider: TranslationProvider.OPENAI,
      voiceId: '',
      debugMode: false,
      // API keys are never stored in config.json for security
      // They are stored securely via SecureStorageManager
      apiKeys: {
        openai: '',
        elevenlabs: '',
        google: '',
        deepl: ''
      },
      audioSettings: {
        vadSensitivity: 50,
        minSegmentDuration: 1000,
        maxSegmentDuration: 10000,
        quality: AudioQuality.MEDIUM,
        noiseReduction: true,
        autoGainControl: true,
        echoCancellation: true
      },
      voiceSettings: {
        stability: 0.5,
        similarityBoost: 0.5,
        speed: 1.0,
        quality: TTSQuality.MEDIUM
      },
      uiSettings: {
        theme: 'default',
        windowBounds: {
          width: 1200,
          height: 800,
          maximized: false
        },
        showDebugConsole: false,
        uiLanguage: 'en',
        showNotifications: true,
        overlaySettings: {
          enabled: true,
          toggleHotkey: defaultOverlayHotkey,
          position: {
            x: 100,
            y: 100
          },
          opacity: 0.9,
          autoHide: false,
          alwaysOnTop: true,
          clickThrough: true
        },
        bidirectionalSourceLanguage: 'auto',
        bidirectionalTargetLanguage: 'en',
        paddleWarmupOnStartup: true,
        bidirectionalOptimization: {
          translationSpeed: 'normal', // 'normal' or 'fast' (uses OpenAI Real-Time API)
          translationCacheSize: 1000,
          fingerprintCacheSize: 100,
          fuzzyMatchThreshold: 0.8,
          enableCachePreloading: true,
          enablePerformanceSelection: true,
          enableBatchProcessing: true,
          batchSize: 5
        }
      },
      customVoices: [],
      processingMode: 'cloud',
      cloudModelConfig: {
        whisperModel: 'whisper-1',
        gptModel: 'openai',
        voiceModel: 'elevenlabs',
        modelParameters: {
          temperature: 0.7,
          speed: 1.0,
          quality: 'medium'
        }
      },
      localModelConfig: {
        whisperModel: 'tiny',
        gptModel: 'argos',
        voiceModel: 'elevenlabs',
        modelParameters: {
          temperature: 0.0,
          speed: 1.0,
          quality: 'medium'
        }
      },
      // Unified model configuration (defaults to cloud)
      modelConfig: {
        whisperModel: 'whisper-1',
        gptModel: 'openai',
        voiceModel: 'elevenlabs',
        modelParameters: {
          temperature: 0.7,
          maxTokens: 150,
          stability: 0.5,
          similarityBoost: 0.5,
          speed: 1.0
        }
      },
      vbAudioSetupShown: false,
      blackHoleSetupShown: false,
      managedApiConfig: {
        mode: 'personal',
        lastModeSwitch: new Date().toISOString(),
        usageWarningsEnabled: true,
        autoSwitchOnLimit: false
      }
    };
  }

  /**
   * Validate configuration object
   */
  private validateConfiguration(config: AppConfig): void {
    // Basic validation - ensure required properties exist
    if (!config) {
      throw new Error('Configuration is null or undefined');
    }

    // Validate API keys object
    if (!config.apiKeys || typeof config.apiKeys !== 'object') {
      throw new Error('Invalid API keys configuration');
    }

    // Validate audio settings
    if (!config.audioSettings || typeof config.audioSettings !== 'object') {
      throw new Error('Invalid audio settings configuration');
    }

    // Validate voice settings
    if (!config.voiceSettings || typeof config.voiceSettings !== 'object') {
      throw new Error('Invalid voice settings configuration');
    }

    // Validate UI settings
    if (!config.uiSettings || typeof config.uiSettings !== 'object') {
      throw new Error('Invalid UI settings configuration');
    }

    // Validate enum values
    if (!Object.values(TranslationProvider).includes(config.translationProvider)) {
      console.warn('Invalid translation provider, using default');
      config.translationProvider = TranslationProvider.OPENAI;
    }

    if (!Object.values(AudioQuality).includes(config.audioSettings.quality)) {
      console.warn('Invalid audio quality, using default');
      config.audioSettings.quality = AudioQuality.MEDIUM;
    }

    if (!Object.values(TTSQuality).includes(config.voiceSettings.quality)) {
      console.warn('Invalid TTS quality, using default');
      config.voiceSettings.quality = TTSQuality.MEDIUM;
    }

    // Validate numeric ranges
    config.audioSettings.vadSensitivity = Math.max(0, Math.min(100, config.audioSettings.vadSensitivity));
    config.voiceSettings.stability = Math.max(0, Math.min(1, config.voiceSettings.stability));
    config.voiceSettings.similarityBoost = Math.max(0, Math.min(1, config.voiceSettings.similarityBoost));
    config.voiceSettings.speed = Math.max(0.1, Math.min(3.0, config.voiceSettings.speed));
  }

  /**
   * Deep merge two objects
   */
  private deepMerge(target: any, source: any): any {
    const result = { ...target };

    for (const key in source) {
      if (source.hasOwnProperty(key)) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
          result[key] = this.deepMerge(target[key] || {}, source[key]);
        } else {
          result[key] = source[key];
        }
      }
    }

    return result;
  }

  /**
   * Get nested value from object using dot notation
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  /**
   * Set nested value in object using dot notation
   */
  private setNestedValue(obj: any, path: string, value: any): void {
    const keys = path.split('.');
    const lastKey = keys.pop()!;
    const target = keys.reduce((current, key) => {
      if (!current[key] || typeof current[key] !== 'object') {
        current[key] = {};
      }
      return current[key];
    }, obj);
    
    target[lastKey] = value;
  }
}
