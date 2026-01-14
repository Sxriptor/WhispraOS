/**
 * Integration tests for Settings Modal functionality
 * Tests complete workflows from UI to persistence
 */

import { SettingsModal } from '../ui/settings/SettingsModal';
import { ApiKeysTab } from '../ui/settings/tabs/ApiKeysTab';
import { ModelsTab } from '../ui/settings/tabs/ModelsTab';
import { CloudLocalTab } from '../ui/settings/tabs/CloudLocalTab';
import { AccountTab } from '../ui/settings/tabs/AccountTab';

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
      checked: false,
      selected: false,
      disabled: false,
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
      remove: jest.fn(),
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

Object.defineProperty(document, 'body', {
  value: {
    appendChild: jest.fn(),
    removeChild: jest.fn()
  }
});

Object.defineProperty(document, 'head', {
  value: {
    appendChild: jest.fn()
  }
});

Object.defineProperty(document, 'querySelector', {
  value: jest.fn(() => null)
});

Object.defineProperty(document, 'getElementById', {
  value: jest.fn(() => ({
    value: '',
    textContent: '',
    disabled: false
  }))
});

// Mock requestAnimationFrame
Object.defineProperty(window, 'requestAnimationFrame', {
  value: jest.fn((callback: Function) => {
    setTimeout(callback, 0);
    return 1;
  })
});

describe('Settings Integration Tests', () => {
  let settingsModal: SettingsModal;
  let mockElectronAPI: jest.Mocked<any>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockElectronAPI = {
      invoke: jest.fn()
    };
    (window as any).electronAPI = mockElectronAPI;
    
    settingsModal = new SettingsModal();
  });

  afterEach(() => {
    if (settingsModal && settingsModal.isOpen()) {
      settingsModal.hide();
    }
  });

  describe('Complete Settings Workflow', () => {
    beforeEach(() => {
      // Register all tabs
      settingsModal.registerTab({
        id: 'api-keys',
        title: 'API Keys',
        icon: '🔐',
        component: ApiKeysTab,
        order: 1
      });

      settingsModal.registerTab({
        id: 'models',
        title: 'Models',
        icon: '🤖',
        component: ModelsTab,
        order: 2
      });

      settingsModal.registerTab({
        id: 'cloud-local',
        title: 'Processing',
        icon: '☁️',
        component: CloudLocalTab,
        order: 3
      });

      settingsModal.registerTab({
        id: 'account',
        title: 'Account',
        icon: '👤',
        component: AccountTab,
        order: 4
      });
    });

    it('should complete full settings configuration workflow', async () => {
      // Mock successful API responses
      mockElectronAPI.invoke.mockImplementation((channel: string) => {
        switch (channel) {
          case 'secure-api-keys:get':
            return Promise.resolve({
              success: true,
              payload: {
                openai: '***',
                elevenlabs: '***'
              }
            });
          case 'config:get':
            return Promise.resolve({
              success: true,
              payload: {
                whisperModel: 'whisper-1',
                gptModel: 'gpt-3.5-turbo',
                voiceId: 'test-voice',
                modelParameters: {
                  temperature: 0.7,
                  maxTokens: 150,
                  stability: 0.5,
                  similarityBoost: 0.5,
                  speed: 1.0
                },
                processingMode: 'cloud',
                storageConfig: {
                  type: 'keychain',
                  hasPassphrase: false
                }
              }
            });
          case 'voice:get-voices':
            return Promise.resolve({
              success: true,
              payload: {
                voices: [
                  { id: 'voice-1', name: 'Voice 1' },
                  { id: 'voice-2', name: 'Voice 2' }
                ]
              }
            });
          case 'config:set':
          case 'secure-api-keys:set':
            return Promise.resolve({ success: true });
          default:
            return Promise.resolve({ success: true });
        }
      });

      // Show modal
      settingsModal.show();
      expect(settingsModal.isOpen()).toBe(true);

      // Switch between tabs
      settingsModal.switchTab('api-keys');
      expect(settingsModal.getActiveTabId()).toBe('api-keys');

      settingsModal.switchTab('models');
      expect(settingsModal.getActiveTabId()).toBe('models');

      settingsModal.switchTab('cloud-local');
      expect(settingsModal.getActiveTabId()).toBe('cloud-local');

      settingsModal.switchTab('account');
      expect(settingsModal.getActiveTabId()).toBe('account');

      // Save all settings
      const saveResult = await settingsModal.saveAllTabs();
      expect(saveResult).toBe(true);

      // Verify all expected API calls were made
      expect(mockElectronAPI.invoke).toHaveBeenCalledWith('config:get', expect.any(Object));
      expect(mockElectronAPI.invoke).toHaveBeenCalledWith('secure-api-keys:get', expect.any(Object));
    });

    it('should handle cross-tab data dependencies', async () => {
      // Mock API keys being set in ApiKeysTab
      mockElectronAPI.invoke.mockImplementation((channel: string) => {
        if (channel === 'secure-api-keys:get') {
          return Promise.resolve({
            success: true,
            payload: {
              openai: 'sk-test-key',
              elevenlabs: 'el-test-key'
            }
          });
        }
        if (channel === 'config:get') {
          return Promise.resolve({
            success: true,
            payload: {
              whisperModel: 'whisper-1',
              gptModel: 'gpt-4',
              voiceId: 'premium-voice'
            }
          });
        }
        return Promise.resolve({ success: true });
      });

      settingsModal.show();

      // Switch to API Keys tab and verify it loads
      settingsModal.switchTab('api-keys');
      await new Promise(resolve => setTimeout(resolve, 0));

      // Switch to Models tab and verify it can use the API keys
      settingsModal.switchTab('models');
      await new Promise(resolve => setTimeout(resolve, 0));

      // Both tabs should have loaded their configurations
      expect(mockElectronAPI.invoke).toHaveBeenCalledWith('secure-api-keys:get', expect.any(Object));
      expect(mockElectronAPI.invoke).toHaveBeenCalledWith('config:get', expect.any(Object));
    });

    it('should handle save coordination across tabs', async () => {
      // Mock one tab failing to save
      mockElectronAPI.invoke.mockImplementation((channel: string) => {
        if (channel === 'config:set') {
          return Promise.resolve({ success: false });
        }
        if (channel === 'secure-api-keys:set') {
          return Promise.resolve({ success: true });
        }
        return Promise.resolve({ success: true, payload: {} });
      });

      settingsModal.show();

      const saveResult = await settingsModal.saveAllTabs();
      expect(saveResult).toBe(false);
    });
  });

  describe('Error Recovery Scenarios', () => {
    it('should handle tab loading failures gracefully', async () => {
      // Mock API failure
      mockElectronAPI.invoke.mockRejectedValue(new Error('Network error'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      settingsModal.registerTab({
        id: 'api-keys',
        title: 'API Keys',
        icon: '🔐',
        component: ApiKeysTab,
        order: 1
      });

      settingsModal.show();
      settingsModal.switchTab('api-keys');

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should not crash the application
      expect(settingsModal.isOpen()).toBe(true);
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should handle validation errors across multiple tabs', async () => {
      // Create a tab that will fail validation
      class FailingValidationTab extends ApiKeysTab {
        public validate(): boolean {
          return false;
        }

        public getValidationErrors(): string[] {
          return ['Test validation error'];
        }
      }

      settingsModal.registerTab({
        id: 'failing-tab',
        title: 'Failing Tab',
        icon: '❌',
        component: FailingValidationTab,
        order: 1
      });

      settingsModal.show();

      const saveResult = await settingsModal.saveAllTabs();
      expect(saveResult).toBe(false);
    });

    it('should handle partial save failures', async () => {
      mockElectronAPI.invoke.mockImplementation((channel: string) => {
        if (channel === 'config:set') {
          return Promise.resolve({ success: true });
        }
        if (channel === 'secure-api-keys:set') {
          return Promise.resolve({ success: false });
        }
        return Promise.resolve({ success: true, payload: {} });
      });

      settingsModal.registerTab({
        id: 'api-keys',
        title: 'API Keys',
        icon: '🔐',
        component: ApiKeysTab,
        order: 1
      });

      settingsModal.registerTab({
        id: 'models',
        title: 'Models',
        icon: '🤖',
        component: ModelsTab,
        order: 2
      });

      settingsModal.show();

      const saveResult = await settingsModal.saveAllTabs();
      expect(saveResult).toBe(false);
    });
  });

  describe('User Input Validation', () => {
    it('should validate user input across all tabs', async () => {
      // Mock DOM elements with invalid values
      document.getElementById = jest.fn((id: string) => {
        if (id.includes('temperature')) {
          return { value: '5.0' }; // Invalid temperature
        }
        if (id.includes('maxTokens')) {
          return { value: '1000' }; // Invalid max tokens
        }
        return { value: '' };
      });

      settingsModal.registerTab({
        id: 'models',
        title: 'Models',
        icon: '🤖',
        component: ModelsTab,
        order: 1
      });

      settingsModal.show();

      const saveResult = await settingsModal.saveAllTabs();
      expect(saveResult).toBe(false);
    });

    it('should provide clear validation feedback', async () => {
      // Create a tab with validation errors
      class ValidationErrorTab extends ApiKeysTab {
        public validate(): boolean {
          return false;
        }

        public getValidationErrors(): string[] {
          return [
            'API key is required',
            'Invalid key format'
          ];
        }
      }

      settingsModal.registerTab({
        id: 'validation-tab',
        title: 'Validation Tab',
        icon: '⚠️',
        component: ValidationErrorTab,
        order: 1
      });

      settingsModal.show();

      const saveResult = await settingsModal.saveAllTabs();
      expect(saveResult).toBe(false);

      // Should show validation errors (we can't easily test DOM manipulation)
      expect(document.createElement).toHaveBeenCalledWith('div');
    });
  });

  describe('Performance and Resource Management', () => {
    it('should handle multiple rapid tab switches', () => {
      settingsModal.registerTab({
        id: 'tab-1',
        title: 'Tab 1',
        icon: '1️⃣',
        component: ApiKeysTab,
        order: 1
      });

      settingsModal.registerTab({
        id: 'tab-2',
        title: 'Tab 2',
        icon: '2️⃣',
        component: ModelsTab,
        order: 2
      });

      settingsModal.show();

      // Rapid tab switching
      for (let i = 0; i < 10; i++) {
        settingsModal.switchTab(i % 2 === 0 ? 'tab-1' : 'tab-2');
      }

      // Should end up on tab-2
      expect(settingsModal.getActiveTabId()).toBe('tab-2');
    });

    it('should clean up resources when modal is hidden', () => {
      settingsModal.show();
      expect(settingsModal.isOpen()).toBe(true);

      settingsModal.hide();
      expect(settingsModal.isOpen()).toBe(false);

      // Event listeners should be cleaned up
      expect(document.removeEventListener).toHaveBeenCalled();
    });
  });
});