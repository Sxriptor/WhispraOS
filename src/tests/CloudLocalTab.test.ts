import { CloudLocalTab } from '../ui/settings/tabs/CloudLocalTab';

// Mock DOM environment
Object.defineProperty(window, 'electronAPI', {
  value: {
    invoke: jest.fn()
  }
});

Object.defineProperty(window, 'currentLanguage', {
  value: 'en',
  writable: true
});

// Mock document methods
Object.defineProperty(document, 'createElement', {
  value: jest.fn((tagName: string) => ({
    tagName: tagName.toUpperCase(),
    className: '',
    id: '',
    innerHTML: '',
    textContent: '',
    style: {},
    type: '',
    value: '',
    checked: false,
    name: '',
    setAttribute: jest.fn(),
    appendChild: jest.fn(),
    addEventListener: jest.fn(),
    querySelector: jest.fn(),
    querySelectorAll: jest.fn(() => []),
    classList: {
      add: jest.fn(),
      remove: jest.fn()
    }
  }))
});

Object.defineProperty(document, 'getElementById', {
  value: jest.fn(() => ({
    value: '',
    checked: false,
    style: {},
    addEventListener: jest.fn()
  }))
});

Object.defineProperty(document, 'querySelector', {
  value: jest.fn(() => ({
    checked: true,
    value: 'cloud'
  }))
});

describe('CloudLocalTab', () => {
  let cloudLocalTab: CloudLocalTab;
  let mockElectronAPI: jest.Mocked<any>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockElectronAPI = {
      invoke: jest.fn()
    };
    (window as any).electronAPI = mockElectronAPI;
    
    cloudLocalTab = new CloudLocalTab();
  });

  describe('Tab Properties', () => {
    it('should have correct tab properties', () => {
      expect(cloudLocalTab.id).toBe('cloud-local');
      expect(cloudLocalTab.title).toBe('Processing');
      expect(cloudLocalTab.icon).toBe('☁️');
      expect(cloudLocalTab.order).toBe(3);
    });
  });

  describe('Configuration Loading', () => {
    it('should load processing configuration', async () => {
      const mockConfig = {
        processingMode: 'cloud',
        localModelPaths: {
          whisper: '/path/to/whisper',
          translation: '/path/to/translation'
        }
      };

      mockElectronAPI.invoke.mockResolvedValue({
        success: true,
        payload: mockConfig
      });

      await (cloudLocalTab as any).loadProcessingConfig();

      expect(mockElectronAPI.invoke).toHaveBeenCalledWith('config:get', expect.any(Object));
      expect((cloudLocalTab as any).processingConfig.processingMode).toBe('cloud');
    });

    it('should use defaults when loading fails', async () => {
      mockElectronAPI.invoke.mockRejectedValue(new Error('Load failed'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await (cloudLocalTab as any).loadProcessingConfig();

      expect((cloudLocalTab as any).processingConfig.processingMode).toBe('cloud');
      expect(consoleSpy).toHaveBeenCalledWith('Error loading processing configuration:', expect.any(Error));

      consoleSpy.mockRestore();
    });
  });

  describe('Processing Mode Selection', () => {
    it('should handle cloud mode selection', () => {
      const container = cloudLocalTab.render();
      expect(container).toBeDefined();
      expect(container.className).toBe('cloud-local-tab');
    });

    it('should handle local mode selection', () => {
      document.querySelector = jest.fn(() => ({
        checked: true,
        value: 'local'
      }));

      const container = cloudLocalTab.render();
      expect(container).toBeDefined();
    });

    it('should handle hybrid mode selection', () => {
      document.querySelector = jest.fn(() => ({
        checked: true,
        value: 'hybrid'
      }));

      const container = cloudLocalTab.render();
      expect(container).toBeDefined();
    });
  });

  describe('Local Model Path Management', () => {
    it('should handle model path browsing', async () => {
      mockElectronAPI.invoke.mockResolvedValue({
        success: true,
        payload: { filePath: '/selected/model/path' }
      });

      await (cloudLocalTab as any).browseModelPath('whisper', {
        messages: { selectModel: 'Select model' }
      });

      expect(mockElectronAPI.invoke).toHaveBeenCalledWith('dialog:show-open-dialog', expect.any(Object));
    });

    it('should handle browse cancellation', async () => {
      mockElectronAPI.invoke.mockResolvedValue({
        success: false
      });

      await (cloudLocalTab as any).browseModelPath('whisper', {
        messages: { selectModel: 'Select model' }
      });

      expect(mockElectronAPI.invoke).toHaveBeenCalledWith('dialog:show-open-dialog', expect.any(Object));
    });
  });

  describe('Validation', () => {
    it('should validate cloud mode successfully', () => {
      (cloudLocalTab as any).processingConfig.processingMode = 'cloud';

      const isValid = cloudLocalTab.validate();
      const errors = cloudLocalTab.getValidationErrors();

      expect(isValid).toBe(true);
      expect(errors).toEqual([]);
    });

    it('should validate local mode with valid paths', () => {
      (cloudLocalTab as any).processingConfig = {
        processingMode: 'local',
        localModelPaths: {
          whisper: '/valid/whisper/path',
          translation: '/valid/translation/path'
        }
      };

      const isValid = cloudLocalTab.validate();
      const errors = cloudLocalTab.getValidationErrors();

      expect(isValid).toBe(true);
      expect(errors).toEqual([]);
    });

    it('should detect missing local model paths', () => {
      (cloudLocalTab as any).processingConfig = {
        processingMode: 'local',
        localModelPaths: {
          whisper: '',
          translation: ''
        }
      };

      const isValid = cloudLocalTab.validate();
      const errors = cloudLocalTab.getValidationErrors();

      expect(isValid).toBe(false);
      expect(errors).toContain('Whisper model path is required for local processing');
      expect(errors).toContain('Translation model path is required for local processing');
    });

    it('should validate hybrid mode', () => {
      (cloudLocalTab as any).processingConfig.processingMode = 'hybrid';

      const isValid = cloudLocalTab.validate();
      expect(isValid).toBe(true);
    });
  });

  describe('Save Functionality', () => {
    beforeEach(() => {
      document.querySelector = jest.fn((selector: string) => {
        if (selector.includes('cloud')) {
          return { checked: true, value: 'cloud' };
        }
        return { checked: false };
      });

      document.getElementById = jest.fn(() => ({
        value: '/test/path'
      }));
    });

    it('should save processing configuration successfully', async () => {
      mockElectronAPI.invoke.mockResolvedValue({ success: true });

      const result = await cloudLocalTab.onSave();

      expect(result).toBe(true);
      expect(mockElectronAPI.invoke).toHaveBeenCalledWith('config:set', expect.objectContaining({
        payload: expect.objectContaining({
          processingMode: expect.any(String),
          localModelPaths: expect.any(Object)
        })
      }));
    });

    it('should handle save failure', async () => {
      mockElectronAPI.invoke.mockResolvedValue({ success: false });

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = await cloudLocalTab.onSave();

      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith('Failed to save processing configuration');

      consoleSpy.mockRestore();
    });
  });

  describe('Language Support', () => {
    it('should use English translations by default', () => {
      const translations = (cloudLocalTab as any).getTranslations();

      expect(translations.sections.processingMode).toBe('Processing Mode');
      expect(translations.modes.cloud).toBe('Cloud Processing');
    });

    it('should use Spanish translations when language is set', () => {
      (window as any).currentLanguage = 'es';
      cloudLocalTab = new CloudLocalTab();

      const translations = (cloudLocalTab as any).getTranslations();

      expect(translations.sections.processingMode).toBe('Modo de Procesamiento');
      expect(translations.modes.cloud).toBe('Procesamiento en la Nube');
    });
  });

  describe('Tab Lifecycle', () => {
    it('should reload configuration on activate', async () => {
      mockElectronAPI.invoke.mockResolvedValue({
        success: true,
        payload: {}
      });

      const loadSpy = jest.spyOn(cloudLocalTab as any, 'loadProcessingConfig');

      cloudLocalTab.onActivate();

      // Wait for async operation
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(loadSpy).toHaveBeenCalled();

      loadSpy.mockRestore();
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      mockElectronAPI.invoke.mockRejectedValue(new Error('Network error'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = await cloudLocalTab.onSave();

      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith('Error saving processing configuration:', expect.any(Error));

      consoleSpy.mockRestore();
    });

    it('should handle missing DOM elements', async () => {
      document.querySelector = jest.fn(() => null);
      document.getElementById = jest.fn(() => null);

      const result = await cloudLocalTab.onSave();

      // Should not throw error and use defaults
      expect(result).toBe(true);
    });
  });
});