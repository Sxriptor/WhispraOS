import { SettingsManager } from '../services/SettingsManager';
import { ConfigurationManager } from '../services/ConfigurationManager';

// Mock ConfigurationManager
jest.mock('../services/ConfigurationManager');
const MockConfigurationManager = ConfigurationManager as jest.MockedClass<typeof ConfigurationManager>;

describe('SettingsManager', () => {
  let settingsManager: SettingsManager;
  let mockConfigManager: jest.Mocked<ConfigurationManager>;

  beforeEach(() => {
    // Reset singleton instance
    (SettingsManager as any).instance = undefined;
    
    // Create mock config manager
    mockConfigManager = {
      getValue: jest.fn(),
      setValue: jest.fn(),
      getConfig: jest.fn(),
      updateConfig: jest.fn(),
      resetToDefaults: jest.fn(),
      getConfigPath: jest.fn(() => '/mock/config.json')
    } as any;

    MockConfigurationManager.getInstance.mockReturnValue(mockConfigManager);
    
    settingsManager = SettingsManager.getInstance();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = SettingsManager.getInstance();
      const instance2 = SettingsManager.getInstance();
      
      expect(instance1).toBe(instance2);
      expect(instance1).toBeInstanceOf(SettingsManager);
    });
  });

  describe('saveSetting and getSetting', () => {
    it('should save and retrieve settings', () => {
      mockConfigManager.getValue.mockReturnValue('test-value');
      
      settingsManager.saveSetting('test.key', 'test-value');
      const value = settingsManager.getSetting('test.key');
      
      expect(mockConfigManager.setValue).toHaveBeenCalledWith('test.key', 'test-value');
      expect(mockConfigManager.getValue).toHaveBeenCalledWith('test.key');
      expect(value).toBe('test-value');
    });

    it('should return default value when setting not found', () => {
      mockConfigManager.getValue.mockReturnValue(undefined);
      
      const value = settingsManager.getSetting('nonexistent.key', 'default');
      
      expect(value).toBe('default');
    });

    it('should handle errors gracefully', () => {
      mockConfigManager.setValue.mockImplementation(() => {
        throw new Error('Save failed');
      });

      expect(() => {
        settingsManager.saveSetting('test.key', 'value');
      }).toThrow('Save failed');
    });
  });

  describe('microphone settings', () => {
    it('should save and get selected microphone', () => {
      mockConfigManager.getValue.mockReturnValue('device-123');
      
      settingsManager.saveSelectedMicrophone('device-123');
      const deviceId = settingsManager.getSelectedMicrophone();
      
      expect(mockConfigManager.setValue).toHaveBeenCalledWith('selectedMicrophone', 'device-123');
      expect(deviceId).toBe('device-123');
    });

    it('should return empty string as default for microphone', () => {
      mockConfigManager.getValue.mockReturnValue(undefined);
      
      const deviceId = settingsManager.getSelectedMicrophone();
      
      expect(deviceId).toBe('');
    });
  });

  describe('language settings', () => {
    it('should save and get target language', () => {
      mockConfigManager.getValue.mockReturnValue('es');
      
      settingsManager.saveTargetLanguage('es');
      const language = settingsManager.getTargetLanguage();
      
      expect(mockConfigManager.setValue).toHaveBeenCalledWith('targetLanguage', 'es');
      expect(language).toBe('es');
    });

    it('should return default target language', () => {
      mockConfigManager.getValue.mockReturnValue(undefined);
      
      const language = settingsManager.getTargetLanguage();
      
      expect(language).toBe('ru');
    });

    it('should save and get source language', () => {
      mockConfigManager.getValue.mockReturnValue('fr');
      
      settingsManager.saveSourceLanguage('fr');
      const language = settingsManager.getSourceLanguage();
      
      expect(mockConfigManager.setValue).toHaveBeenCalledWith('sourceLanguage', 'fr');
      expect(language).toBe('fr');
    });
  });

  describe('window bounds', () => {
    it('should save and get window bounds', () => {
      const bounds = { width: 1400, height: 900, x: 100, y: 50, maximized: false };
      mockConfigManager.getValue.mockReturnValue(bounds);
      
      settingsManager.saveWindowBounds(bounds);
      const retrievedBounds = settingsManager.getWindowBounds();
      
      expect(mockConfigManager.setValue).toHaveBeenCalledWith('uiSettings.windowBounds', bounds);
      expect(retrievedBounds).toEqual(bounds);
    });

    it('should return default window bounds', () => {
      mockConfigManager.getValue.mockReturnValue(undefined);
      
      const bounds = settingsManager.getWindowBounds();
      
      expect(bounds).toEqual({
        width: 1200,
        height: 800,
        maximized: false
      });
    });
  });

  describe('audio and voice settings', () => {
    it('should save and get audio settings', () => {
      const currentSettings = { vadSensitivity: 50, quality: 'medium' };
      const updates = { vadSensitivity: 75 };
      const expectedSettings = { vadSensitivity: 75, quality: 'medium' };
      
      mockConfigManager.getValue.mockReturnValue(currentSettings);
      
      settingsManager.saveAudioSettings(updates);
      
      expect(mockConfigManager.setValue).toHaveBeenCalledWith('audioSettings', expectedSettings);
    });

    it('should save and get voice settings', () => {
      const currentSettings = { stability: 0.5, speed: 1.0 };
      const updates = { stability: 0.8 };
      const expectedSettings = { stability: 0.8, speed: 1.0 };
      
      mockConfigManager.getValue.mockReturnValue(currentSettings);
      
      settingsManager.saveVoiceSettings(updates);
      
      expect(mockConfigManager.setValue).toHaveBeenCalledWith('voiceSettings', expectedSettings);
    });
  });

  describe('export and import', () => {
    it('should export settings to JSON', () => {
      const mockConfig = {
        selectedMicrophone: 'device-123',
        targetLanguage: 'es',
        sourceLanguage: 'en',
        translationProvider: 'openai',
        voiceId: 'voice-123',
        debugMode: true,
        audioSettings: { vadSensitivity: 75 },
        voiceSettings: { stability: 0.8 },
        uiSettings: {
          theme: 'dark',
          windowBounds: { width: 1200, height: 800, maximized: false },
          showDebugConsole: true,
          uiLanguage: 'en',
          showNotifications: true
        }
      };

      mockConfigManager.getConfig.mockReturnValue(mockConfig as any);
      
      const exported = settingsManager.exportSettings();
      const parsed = JSON.parse(exported);
      
      expect(parsed.version).toBe('1.0.0');
      expect(parsed.settings.selectedMicrophone).toBe('device-123');
      expect(parsed.settings.targetLanguage).toBe('es');
    });

    it('should import settings from JSON', () => {
      const importData = {
        version: '1.0.0',
        settings: {
          selectedMicrophone: 'imported-device',
          targetLanguage: 'fr',
          debugMode: true
        }
      };

      settingsManager.importSettings(JSON.stringify(importData));
      
      expect(mockConfigManager.updateConfig).toHaveBeenCalledWith({
        selectedMicrophone: 'imported-device',
        targetLanguage: 'fr',
        debugMode: true
      });
    });

    it('should handle invalid import data', () => {
      expect(() => {
        settingsManager.importSettings('invalid json');
      }).toThrow('Failed to import settings');

      expect(() => {
        settingsManager.importSettings('{"invalid": "format"}');
      }).toThrow('Failed to import settings');
    });
  });

  describe('reset and migration', () => {
    it('should reset all settings', () => {
      settingsManager.resetAllSettings();
      
      expect(mockConfigManager.resetToDefaults).toHaveBeenCalled();
    });

    it('should check if migration is needed', () => {
      mockConfigManager.getConfig.mockReturnValue(null as any);
      
      const needsMigration = settingsManager.needsMigration();
      
      expect(needsMigration).toBe(true);
    });

    it('should perform migration when needed', () => {
      mockConfigManager.getConfig.mockReturnValue(null as any);
      
      settingsManager.migrateSettings();
      
      expect(mockConfigManager.resetToDefaults).toHaveBeenCalled();
    });
  });

  describe('settings summary', () => {
    it('should provide settings summary', () => {
      const mockConfig = {
        apiKeys: {
          openai: 'sk-test',
          elevenlabs: 'test-key',
          google: '',
          deepl: ''
        },
        selectedMicrophone: 'device-123',
        targetLanguage: 'es',
        translationProvider: 'openai',
        debugMode: true,
        uiSettings: { theme: 'dark' }
      };

      mockConfigManager.getConfig.mockReturnValue(mockConfig as any);
      mockConfigManager.getConfigPath.mockReturnValue('/mock/config.json');
      
      const summary = settingsManager.getSettingsSummary();
      
      expect(summary.hasOpenAIKey).toBe(true);
      expect(summary.hasElevenLabsKey).toBe(true);
      expect(summary.hasGoogleKey).toBe(false);
      expect(summary.hasDeepLKey).toBe(false);
      expect(summary.selectedMicrophone).toBe('device-123');
      expect(summary.targetLanguage).toBe('es');
      expect(summary.debugMode).toBe(true);
    });
  });
});