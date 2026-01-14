import { ConfigurationManager } from './ConfigurationManager';
import { AppConfig } from '../types/ConfigurationTypes';

/**
 * Manages user preferences and settings with automatic persistence
 */
export class SettingsManager {
  private static instance: SettingsManager;
  private configManager: ConfigurationManager;
  private settingsVersion = '1.0.0';

  private constructor() {
    this.configManager = ConfigurationManager.getInstance();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): SettingsManager {
    if (!SettingsManager.instance) {
      SettingsManager.instance = new SettingsManager();
    }
    return SettingsManager.instance;
  }

  /**
   * Save user preference
   */
  public saveSetting<T>(key: string, value: T): void {
    try {
      this.configManager.setValue(key, value);
      console.log(`Setting saved: ${key} = ${JSON.stringify(value)}`);
    } catch (error) {
      console.error(`Error saving setting ${key}:`, error);
      throw error;
    }
  }

  /**
   * Get user preference
   */
  public getSetting<T>(key: string, defaultValue?: T): T | undefined {
    try {
      const value = this.configManager.getValue<T>(key);
      return value !== undefined ? value : defaultValue;
    } catch (error) {
      console.error(`Error getting setting ${key}:`, error);
      return defaultValue;
    }
  }

  /**
   * Save microphone selection
   */
  public saveSelectedMicrophone(deviceId: string): void {
    this.saveSetting('selectedMicrophone', deviceId);
  }

  /**
   * Get selected microphone
   */
  public getSelectedMicrophone(): string {
    return this.getSetting('selectedMicrophone', '') || '';
  }

  /**
   * Save target language
   */
  public saveTargetLanguage(languageCode: string): void {
    this.saveSetting('targetLanguage', languageCode);
  }

  /**
   * Get target language
   */
  public getTargetLanguage(): string {
    return this.getSetting('targetLanguage', 'ru') || 'ru';
  }

  /**
   * Save source language
   */
  public saveSourceLanguage(languageCode: string): void {
    this.saveSetting('sourceLanguage', languageCode);
  }

  /**
   * Get source language
   */
  public getSourceLanguage(): string {
    return this.getSetting('sourceLanguage', 'en') || 'en';
  }

  /**
   * Save translation provider preference
   */
  public saveTranslationProvider(provider: string): void {
    this.saveSetting('translationProvider', provider);
  }

  /**
   * Get translation provider preference
   */
  public getTranslationProvider(): string {
    return this.getSetting('translationProvider', 'openai') || 'openai';
  }

  /**
   * Save voice ID for TTS
   */
  public saveVoiceId(voiceId: string): void {
    this.saveSetting('voiceId', voiceId);
  }

  /**
   * Get voice ID for TTS
   */
  public getVoiceId(): string {
    return this.getSetting('voiceId', '') || '';
  }

  /**
   * Save debug mode preference
   */
  public saveDebugMode(enabled: boolean): void {
    this.saveSetting('debugMode', enabled);
  }

  /**
   * Get debug mode preference
   */
  public getDebugMode(): boolean {
    return this.getSetting('debugMode', false) || false;
  }

  /**
   * Save window bounds
   */
  public saveWindowBounds(bounds: { width: number; height: number; x?: number; y?: number; maximized: boolean }): void {
    this.saveSetting('uiSettings.windowBounds', bounds);
  }

  /**
   * Get window bounds
   */
  public getWindowBounds(): { width: number; height: number; x?: number; y?: number; maximized: boolean } {
    return this.getSetting('uiSettings.windowBounds', {
      width: 1200,
      height: 800,
      maximized: false
    }) || {
      width: 1200,
      height: 800,
      maximized: false
    };
  }

  /**
   * Save UI theme preference
   */
  public saveTheme(theme: 'default' | 'neo-brutalism' | 'hacker' | 'corporate' | 'light' | 'dark' | 'auto'): void {
    this.saveSetting('uiSettings.theme', theme);
  }

  /**
   * Get UI theme preference
   */
  public getTheme(): 'default' | 'neo-brutalism' | 'hacker' | 'corporate' | 'light' | 'dark' | 'auto' {
    return this.getSetting('uiSettings.theme', 'default') || 'default';
  }

  /**
   * Save debug console visibility
   */
  public saveDebugConsoleVisibility(visible: boolean): void {
    this.saveSetting('uiSettings.showDebugConsole', visible);
  }

  /**
   * Get debug console visibility
   */
  public getDebugConsoleVisibility(): boolean {
    return this.getSetting('uiSettings.showDebugConsole', false) || false;
  }

  /**
   * Save audio settings
   */
  public saveAudioSettings(settings: {
    vadSensitivity?: number;
    minSegmentDuration?: number;
    maxSegmentDuration?: number;
    quality?: string;
    noiseReduction?: boolean;
    autoGainControl?: boolean;
    echoCancellation?: boolean;
  }): void {
    const currentSettings = this.getSetting('audioSettings', {});
    const updatedSettings = { ...currentSettings, ...settings };
    this.saveSetting('audioSettings', updatedSettings);
  }

  /**
   * Get audio settings
   */
  public getAudioSettings(): any {
    return this.getSetting('audioSettings', {
      vadSensitivity: 50,
      minSegmentDuration: 1000,
      maxSegmentDuration: 10000,
      quality: 'medium',
      noiseReduction: true,
      autoGainControl: true,
      echoCancellation: true
    });
  }

  /**
   * Save voice settings
   */
  public saveVoiceSettings(settings: {
    stability?: number;
    similarityBoost?: number;
    speed?: number;
    quality?: string;
  }): void {
    const currentSettings = this.getSetting('voiceSettings', {});
    const updatedSettings = { ...currentSettings, ...settings };
    this.saveSetting('voiceSettings', updatedSettings);
  }

  /**
   * Get voice settings
   */
  public getVoiceSettings(): any {
    return this.getSetting('voiceSettings', {
      stability: 0.5,
      similarityBoost: 0.5,
      speed: 1.0,
      quality: 'medium'
    });
  }

  /**
   * Export all settings to JSON
   */
  public exportSettings(): string {
    const config = this.configManager.getConfig();
    const exportData = {
      version: this.settingsVersion,
      timestamp: new Date().toISOString(),
      settings: {
        selectedMicrophone: config.selectedMicrophone,
        targetLanguage: config.targetLanguage,
        sourceLanguage: config.sourceLanguage,
        translationProvider: config.translationProvider,
        voiceId: config.voiceId,
        debugMode: config.debugMode,
        audioSettings: config.audioSettings,
        voiceSettings: config.voiceSettings,
        uiSettings: {
          theme: config.uiSettings.theme,
          windowBounds: config.uiSettings.windowBounds,
          showDebugConsole: config.uiSettings.showDebugConsole,
          uiLanguage: config.uiSettings.uiLanguage,
          showNotifications: config.uiSettings.showNotifications
        }
      }
    };

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Import settings from JSON
   */
  public importSettings(jsonData: string): void {
    try {
      const importData = JSON.parse(jsonData);
      
      if (!importData.settings) {
        throw new Error('Invalid settings format');
      }

      // Validate version compatibility
      if (importData.version && this.isVersionCompatible(importData.version)) {
        console.log(`Importing settings from version ${importData.version}`);
      } else {
        console.warn('Settings version may be incompatible, proceeding with caution');
      }

      // Import settings
      const settings = importData.settings;
      const updates: Partial<AppConfig> = {};

      if (settings.selectedMicrophone !== undefined) {
        updates.selectedMicrophone = settings.selectedMicrophone;
      }
      if (settings.targetLanguage !== undefined) {
        updates.targetLanguage = settings.targetLanguage;
      }
      if (settings.sourceLanguage !== undefined) {
        updates.sourceLanguage = settings.sourceLanguage;
      }
      if (settings.translationProvider !== undefined) {
        updates.translationProvider = settings.translationProvider;
      }
      if (settings.voiceId !== undefined) {
        updates.voiceId = settings.voiceId;
      }
      if (settings.debugMode !== undefined) {
        updates.debugMode = settings.debugMode;
      }
      if (settings.audioSettings !== undefined) {
        updates.audioSettings = settings.audioSettings;
      }
      if (settings.voiceSettings !== undefined) {
        updates.voiceSettings = settings.voiceSettings;
      }
      if (settings.uiSettings !== undefined) {
        updates.uiSettings = settings.uiSettings;
      }

      // Apply updates
      this.configManager.updateConfig(updates);
      console.log('Settings imported successfully');

    } catch (error) {
      console.error('Error importing settings:', error);
      throw new Error(`Failed to import settings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Reset all settings to defaults
   */
  public resetAllSettings(): void {
    this.configManager.resetToDefaults();
    console.log('All settings reset to defaults');
  }

  /**
   * Get settings migration status
   */
  public needsMigration(): boolean {
    const config = this.configManager.getConfig();
    // Check if this is an old configuration that needs migration
    return !config || typeof config !== 'object';
  }

  /**
   * Perform settings migration
   */
  public migrateSettings(): void {
    if (!this.needsMigration()) {
      return;
    }

    console.log('Migrating settings to new format...');
    
    // For now, just reset to defaults
    // In the future, this could contain logic to migrate from older versions
    this.resetAllSettings();
    
    console.log('Settings migration completed');
  }

  /**
   * Check if a version is compatible with current settings format
   */
  private isVersionCompatible(version: string): boolean {
    // Simple version compatibility check
    const [major] = version.split('.').map(Number);
    const [currentMajor] = this.settingsVersion.split('.').map(Number);
    
    return major === currentMajor;
  }

  /**
   * Get settings summary for debugging
   */
  public getSettingsSummary(): Record<string, any> {
    const config = this.configManager.getConfig();
    return {
      version: this.settingsVersion,
      configPath: this.configManager.getConfigPath(),
      hasOpenAIKey: !!(config.apiKeys.openai && config.apiKeys.openai.length > 0),
      hasElevenLabsKey: !!(config.apiKeys.elevenlabs && config.apiKeys.elevenlabs.length > 0),
      hasGoogleKey: !!(config.apiKeys.google && config.apiKeys.google.length > 0),
      hasDeepLKey: !!(config.apiKeys.deepl && config.apiKeys.deepl.length > 0),
      selectedMicrophone: config.selectedMicrophone || 'none',
      targetLanguage: config.targetLanguage,
      translationProvider: config.translationProvider,
      debugMode: config.debugMode,
      theme: config.uiSettings.theme
    };
  }
}