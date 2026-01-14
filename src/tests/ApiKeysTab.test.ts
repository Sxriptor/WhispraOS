import { ApiKeysTab } from '../ui/settings/tabs/ApiKeysTab';

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
  value: jest.fn((tagName: string) => {
    const element = {
      tagName: tagName.toUpperCase(),
      className: '',
      id: '',
      innerHTML: '',
      textContent: '',
      style: {},
      type: '',
      value: '',
      placeholder: '',
      checked: false,
      selected: false,
      title: '',
      setAttribute: jest.fn(),
      getAttribute: jest.fn(),
      appendChild: jest.fn(),
      removeChild: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      querySelector: jest.fn(),
      querySelectorAll: jest.fn(() => []),
      focus: jest.fn(),
      click: jest.fn(),
      select: jest.fn(),
      parentNode: null,
      children: [],
      classList: {
        add: jest.fn(),
        remove: jest.fn(),
        contains: jest.fn(() => false),
        toggle: jest.fn()
      }
    };
    return element;
  })
});

Object.defineProperty(document, 'getElementById', {
  value: jest.fn(() => ({
    value: '',
    addEventListener: jest.fn(),
    tagName: 'INPUT',
    type: 'text',
    className: '',
    id: '',
    style: {},
    setAttribute: jest.fn(),
    getAttribute: jest.fn()
  } as any))
});

Object.defineProperty(document, 'querySelector', {
  value: jest.fn(() => ({
    value: 'keychain',
    addEventListener: jest.fn()
  }))
});

describe('ApiKeysTab', () => {
  let apiKeysTab: ApiKeysTab;
  let mockElectronAPI: jest.Mocked<any>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockElectronAPI = {
      invoke: jest.fn()
    };
    (window as any).electronAPI = mockElectronAPI;
    
    apiKeysTab = new ApiKeysTab();
  });

  describe('Tab Properties', () => {
    it('should have correct tab properties', () => {
      expect(apiKeysTab.id).toBe('api-keys');
      expect(apiKeysTab.title).toBe('API Keys');
      expect(apiKeysTab.icon).toBe('🔐');
      expect(apiKeysTab.order).toBe(1);
    });
  });

  describe('Rendering', () => {
    it('should render tab content', () => {
      const container = apiKeysTab.render();

      expect(container).toBeDefined();
      expect(container.className).toBe('api-keys-tab');
    });

    it('should load API keys when rendering', async () => {
      mockElectronAPI.invoke.mockResolvedValue({
        success: true,
        payload: {
          openai: '***',
          elevenlabs: '***'
        }
      });

      apiKeysTab.render();

      // Wait for async loading
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(mockElectronAPI.invoke).toHaveBeenCalledWith('secure-api-keys:get', expect.any(Object));
    });

    it('should handle API key loading failure', async () => {
      mockElectronAPI.invoke.mockResolvedValue({
        success: false,
        error: 'Failed to load keys'
      });

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      apiKeysTab.render();

      // Wait for async loading
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(consoleSpy).toHaveBeenCalledWith('Failed to load API keys');

      consoleSpy.mockRestore();
    });
  });

  describe('Language Support', () => {
    it('should use English translations by default', () => {
      const translations = (apiKeysTab as any).getTranslations();

      expect(translations.modal.title).toBe('Secure API Configuration');
      expect(translations.fields.openaiLabel).toBe('OpenAI API Key:');
    });

    it('should use Spanish translations when language is set', () => {
      (window as any).currentLanguage = 'es';
      apiKeysTab = new ApiKeysTab();

      const translations = (apiKeysTab as any).getTranslations();

      expect(translations.modal.title).toBe('Configuración Segura de API');
      expect(translations.fields.openaiLabel).toBe('Clave API de OpenAI:');
    });

    it('should fallback to English for unsupported languages', () => {
      (window as any).currentLanguage = 'unsupported';
      apiKeysTab = new ApiKeysTab();

      const translations = (apiKeysTab as any).getTranslations();

      expect(translations.modal.title).toBe('Secure API Configuration');
    });
  });

  describe('Storage Configuration', () => {
    beforeEach(() => {
      mockElectronAPI.invoke.mockImplementation((channel: string) => {
        if (channel === 'secure-api-keys:get') {
          return Promise.resolve({
            success: true,
            payload: {}
          });
        }
        if (channel === 'config:get') {
          return Promise.resolve({
            success: true,
            payload: {
              storageConfig: {
                type: 'keychain',
                hasPassphrase: false
              }
            }
          });
        }
        return Promise.resolve({ success: true });
      });
    });

    it('should load storage configuration', async () => {
      await (apiKeysTab as any).loadApiKeys();

      expect(mockElectronAPI.invoke).toHaveBeenCalledWith('config:get', expect.any(Object));
      expect((apiKeysTab as any).storageConfig.type).toBe('keychain');
    });

    it('should use default storage config when loading fails', async () => {
      mockElectronAPI.invoke.mockImplementation((channel: string) => {
        if (channel === 'config:get') {
          return Promise.resolve({ success: false });
        }
        return Promise.resolve({ success: true, payload: {} });
      });

      await (apiKeysTab as any).loadApiKeys();

      expect((apiKeysTab as any).storageConfig.type).toBe('keychain');
      expect((apiKeysTab as any).storageConfig.hasPassphrase).toBe(false);
    });
  });

  describe('API Key Management', () => {
    beforeEach(() => {
      mockElectronAPI.invoke.mockResolvedValue({ success: true });
    });

    it('should show API key when requested', async () => {
      mockElectronAPI.invoke.mockResolvedValue({
        success: true,
        payload: { key: 'sk-test-key-123' }
      });

      const mockInput = {
        type: 'password',
        value: '',
        style: {},
        select: jest.fn()
      };

      const mockButton = {
        innerHTML: '🔍',
        title: 'Show Key',
        onclick: null
      };

      await (apiKeysTab as any).handleShowKey('openai', mockInput, mockButton, {
        buttons: { showKey: 'Show Key' },
        fields: { openaiStored: 'Key stored securely' }
      });

      expect(mockElectronAPI.invoke).toHaveBeenCalledWith('config:get-api-key', expect.any(Object));
      expect(mockInput.type).toBe('text');
      expect(mockInput.value).toBe('sk-test-key-123');
      expect(mockInput.select).toHaveBeenCalled();
    });

    it('should handle show key failure', async () => {
      mockElectronAPI.invoke.mockResolvedValue({
        success: false,
        error: 'Key not found'
      });

      const alertSpy = jest.spyOn(window, 'alert').mockImplementation();

      await (apiKeysTab as any).handleShowKey('openai', {}, {}, {});

      expect(alertSpy).toHaveBeenCalledWith('Failed to retrieve API key');

      alertSpy.mockRestore();
    });

    it('should remove API key when confirmed', async () => {
      const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
      mockElectronAPI.invoke.mockResolvedValue({ success: true });

      await (apiKeysTab as any).handleRemoveKey('openai', {});

      expect(confirmSpy).toHaveBeenCalled();
      expect(mockElectronAPI.invoke).toHaveBeenCalledWith('config:remove-api-key', expect.any(Object));

      confirmSpy.mockRestore();
    });

    it('should not remove API key when not confirmed', async () => {
      const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false);

      await (apiKeysTab as any).handleRemoveKey('openai', {});

      expect(confirmSpy).toHaveBeenCalled();
      expect(mockElectronAPI.invoke).not.toHaveBeenCalledWith('config:remove-api-key', expect.any(Object));

      confirmSpy.mockRestore();
    });

    it('should clear all keys when double confirmed', async () => {
      const confirmSpy = jest.spyOn(window, 'confirm')
        .mockReturnValueOnce(true)  // First confirmation
        .mockReturnValueOnce(true); // Second confirmation

      const alertSpy = jest.spyOn(window, 'alert').mockImplementation();
      mockElectronAPI.invoke.mockResolvedValue({ success: true });

      await (apiKeysTab as any).handleClearAll({
        messages: { resetComplete: 'Keys cleared' }
      });

      expect(confirmSpy).toHaveBeenCalledTimes(2);
      expect(mockElectronAPI.invoke).toHaveBeenCalledWith('config:clear-all-api-keys', expect.any(Object));
      expect(alertSpy).toHaveBeenCalledWith('✅ All API keys have been cleared from secure storage.');

      confirmSpy.mockRestore();
      alertSpy.mockRestore();
    });
  });

  describe('Save Functionality', () => {
    beforeEach(() => {
      // Mock DOM elements
      document.getElementById = jest.fn((id: string) => {
        const mockElement = {
          value: id.includes('openai') ? 'sk-test-key' : 'el-test-key'
        };
        return mockElement as any;
      });

      document.querySelector = jest.fn(() => ({
        value: 'keychain'
      }));
    });

    it('should save API keys and storage configuration', async () => {
      mockElectronAPI.invoke.mockResolvedValue({ success: true });

      const result = await apiKeysTab.onSave();

      expect(result).toBe(true);
      expect(mockElectronAPI.invoke).toHaveBeenCalledWith('config:set', expect.objectContaining({
        payload: expect.objectContaining({
          storageConfig: expect.objectContaining({
            type: 'keychain'
          })
        })
      }));
      expect(mockElectronAPI.invoke).toHaveBeenCalledWith('secure-api-keys:set', expect.any(Object));
    });

    it('should handle storage configuration save failure', async () => {
      mockElectronAPI.invoke.mockImplementation((channel: string) => {
        if (channel === 'config:set') {
          return Promise.resolve({ success: false });
        }
        return Promise.resolve({ success: true });
      });

      const result = await apiKeysTab.onSave();

      expect(result).toBe(false);
    });

    it('should handle API keys save failure', async () => {
      mockElectronAPI.invoke.mockImplementation((channel: string) => {
        if (channel === 'secure-api-keys:set') {
          return Promise.resolve({ success: false });
        }
        return Promise.resolve({ success: true });
      });

      const result = await apiKeysTab.onSave();

      expect(result).toBe(false);
    });

    it('should require passphrase for passphrase storage type', async () => {
      document.querySelector = jest.fn(() => ({
        value: 'passphrase'
      }));

      document.getElementById = jest.fn((id: string) => {
        if (id === 'storage-passphrase-input') {
          return { value: '' }; // Empty passphrase
        }
        return { value: 'test-key' };
      });

      const alertSpy = jest.spyOn(window, 'alert').mockImplementation();

      const result = await apiKeysTab.onSave();

      expect(result).toBe(false);
      expect(alertSpy).toHaveBeenCalledWith('Please enter a passphrase for encrypted storage.');

      alertSpy.mockRestore();
    });
  });

  describe('Validation', () => {
    it('should always validate successfully', () => {
      const isValid = apiKeysTab.validate();
      expect(isValid).toBe(true);
    });

    it('should return no validation errors', () => {
      const errors = apiKeysTab.getValidationErrors();
      expect(errors).toEqual([]);
    });
  });

  describe('Tab Lifecycle', () => {
    it('should reload configuration on activate', async () => {
      mockElectronAPI.invoke.mockResolvedValue({
        success: true,
        payload: {}
      });

      const loadSpy = jest.spyOn(apiKeysTab as any, 'loadApiKeys');

      apiKeysTab.onActivate();

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

      const result = await apiKeysTab.onSave();

      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith('Error saving API keys and storage config:', expect.any(Error));

      consoleSpy.mockRestore();
    });

    it('should handle missing DOM elements', async () => {
      document.getElementById = jest.fn(() => null);

      const result = await apiKeysTab.onSave();

      // Should not throw error and return true (no keys to save)
      expect(result).toBe(true);
    });
  });
});