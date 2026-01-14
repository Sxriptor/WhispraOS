import * as fs from 'fs';
import * as path from 'path';
import { ConfigurationManager } from '../services/ConfigurationManager';
import { TranslationProvider, AudioQuality, TTSQuality } from '../types/ConfigurationTypes';

// Mock electron app module
jest.mock('electron', () => ({
  app: {
    getPath: jest.fn(() => '/mock/user/data')
  }
}));

// Mock fs module
jest.mock('fs');
const mockFs = fs as jest.Mocked<typeof fs>;

describe('ConfigurationManager', () => {
  let configManager: ConfigurationManager;
  const mockConfigPath = '/mock/user/data/config.json';

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Reset singleton instance
    (ConfigurationManager as any).instance = undefined;
    
    // Mock fs.existsSync to return false by default (no config file)
    mockFs.existsSync.mockReturnValue(false);
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = ConfigurationManager.getInstance();
      const instance2 = ConfigurationManager.getInstance();
      
      expect(instance1).toBe(instance2);
      expect(instance1).toBeInstanceOf(ConfigurationManager);
    });
  });

  describe('getConfig', () => {
    it('should return default configuration when no config file exists', () => {
      configManager = ConfigurationManager.getInstance();
      const config = configManager.getConfig();
      
      expect(config).toBeDefined();
      expect(config.selectedMicrophone).toBe('');
      expect(config.targetLanguage).toBe('ru');
      expect(config.translationProvider).toBe(TranslationProvider.OPENAI);
      expect(config.audioSettings.quality).toBe(AudioQuality.MEDIUM);
      expect(config.voiceSettings.quality).toBe(TTSQuality.MEDIUM);
    });

    it('should load configuration from file when it exists', () => {
      const mockConfig = {
        selectedMicrophone: 'test-device',
        targetLanguage: 'es',
        translationProvider: TranslationProvider.GOOGLE,
        apiKeys: { openai: 'test-key', elevenlabs: 'test-key' }
      };

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockConfig));

      configManager = ConfigurationManager.getInstance();
      const config = configManager.getConfig();
      
      expect(config.selectedMicrophone).toBe('test-device');
      expect(config.targetLanguage).toBe('es');
      expect(config.translationProvider).toBe(TranslationProvider.GOOGLE);
    });

    it('should return copy of config to prevent mutation', () => {
      configManager = ConfigurationManager.getInstance();
      const config1 = configManager.getConfig();
      const config2 = configManager.getConfig();
      
      expect(config1).not.toBe(config2);
      expect(config1).toEqual(config2);
    });
  });

  describe('updateConfig', () => {
    beforeEach(() => {
      configManager = ConfigurationManager.getInstance();
      mockFs.mkdirSync.mockImplementation(() => {});
      mockFs.writeFileSync.mockImplementation(() => {});
    });

    it('should update configuration with partial changes', () => {
      const updates = {
        selectedMicrophone: 'new-device',
        targetLanguage: 'fr'
      };

      configManager.updateConfig(updates);
      const config = configManager.getConfig();
      
      expect(config.selectedMicrophone).toBe('new-device');
      expect(config.targetLanguage).toBe('fr');
      expect(mockFs.writeFileSync).toHaveBeenCalled();
    });

    it('should deep merge nested objects', () => {
      const updates = {
        audioSettings: {
          vadSensitivity: 75
        }
      };

      configManager.updateConfig(updates);
      const config = configManager.getConfig();
      
      expect(config.audioSettings.vadSensitivity).toBe(75);
      expect(config.audioSettings.quality).toBe(AudioQuality.MEDIUM); // Should preserve existing values
    });

    it('should validate configuration after update', () => {
      const updates = {
        translationProvider: 'invalid-provider' as any
      };

      configManager.updateConfig(updates);
      const config = configManager.getConfig();
      
      // Should fall back to default due to validation
      expect(config.translationProvider).toBe(TranslationProvider.OPENAI);
    });
  });

  describe('resetToDefaults', () => {
    it('should reset configuration to defaults', () => {
      configManager = ConfigurationManager.getInstance();
      
      // First update config
      configManager.updateConfig({ selectedMicrophone: 'test-device' });
      expect(configManager.getConfig().selectedMicrophone).toBe('test-device');
      
      // Then reset
      configManager.resetToDefaults();
      expect(configManager.getConfig().selectedMicrophone).toBe('');
    });
  });

  describe('getValue and setValue', () => {
    beforeEach(() => {
      configManager = ConfigurationManager.getInstance();
      mockFs.writeFileSync.mockImplementation(() => {});
    });

    it('should get nested values using dot notation', () => {
      const value = configManager.getValue('audioSettings.vadSensitivity');
      expect(value).toBe(50); // Default value
    });

    it('should set nested values using dot notation', () => {
      configManager.setValue('audioSettings.vadSensitivity', 80);
      const value = configManager.getValue('audioSettings.vadSensitivity');
      expect(value).toBe(80);
    });

    it('should return undefined for non-existent paths', () => {
      const value = configManager.getValue('nonexistent.path');
      expect(value).toBeUndefined();
    });
  });

  describe('error handling', () => {
    it('should handle JSON parse errors gracefully', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue('invalid json');

      configManager = ConfigurationManager.getInstance();
      const config = configManager.getConfig();
      
      // Should fall back to defaults
      expect(config.targetLanguage).toBe('ru');
    });

    it('should handle file write errors', () => {
      configManager = ConfigurationManager.getInstance();
      mockFs.writeFileSync.mockImplementation(() => {
        throw new Error('Write failed');
      });

      expect(() => {
        configManager.updateConfig({ selectedMicrophone: 'test' });
      }).toThrow('Failed to save configuration');
    });
  });

  describe('validation', () => {
    beforeEach(() => {
      configManager = ConfigurationManager.getInstance();
    });

    it('should validate numeric ranges', () => {
      configManager.updateConfig({
        audioSettings: {
          vadSensitivity: 150 // Above max
        }
      });

      const config = configManager.getConfig();
      expect(config.audioSettings.vadSensitivity).toBe(100); // Clamped to max
    });

    it('should validate enum values', () => {
      configManager.updateConfig({
        translationProvider: 'invalid' as any
      });

      const config = configManager.getConfig();
      expect(config.translationProvider).toBe(TranslationProvider.OPENAI); // Reset to default
    });
  });
});