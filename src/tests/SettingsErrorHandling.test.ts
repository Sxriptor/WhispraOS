/**
 * Comprehensive error handling tests for Settings Modal
 * Tests graceful degradation and error recovery scenarios
 */

import { SettingsModal } from '../ui/settings/SettingsModal';
import { ApiKeysTab } from '../ui/settings/tabs/ApiKeysTab';
import { ModelsTab } from '../ui/settings/tabs/ModelsTab';
import { BaseSettingsTab } from '../ui/settings/interfaces/SettingsTab';

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
    setAttribute: jest.fn(),
    appendChild: jest.fn(),
    addEventListener: jest.fn(),
    querySelector: jest.fn(),
    querySelectorAll: jest.fn(() => []),
    classList: {
      add: jest.fn(),
      remove: jest.fn()
    },
    remove: jest.fn()
  }))
});

Object.defineProperty(document, 'body', {
  value: {
    appendChild: jest.fn(),
    removeChild: jest.fn()
  }
});

Object.defineProperty(document, 'querySelector', {
  value: jest.fn(() => ({
    disabled: false,
    textContent: 'Save',
    innerHTML: 'Save'
  }))
});

// Mock requestAnimationFrame
Object.defineProperty(window, 'requestAnimationFrame', {
  value: jest.fn((callback: Function) => {
    setTimeout(callback, 0);
    return 1;
  })
});

// Mock problematic tab classes for testing
class RenderErrorTab extends BaseSettingsTab {
  public readonly id = 'render-error-tab';
  public readonly title = 'Render Error Tab';
  public readonly icon = '💥';
  public readonly order = 1;

  public render(): HTMLElement {
    throw new Error('Render failed catastrophically');
  }

  public async onSave(): Promise<boolean> {
    return true;
  }

  public validate(): boolean {
    return true;
  }

  public getValidationErrors(): string[] {
    return [];
  }
}

class SaveErrorTab extends BaseSettingsTab {
  public readonly id = 'save-error-tab';
  public readonly title = 'Save Error Tab';
  public readonly icon = '💾';
  public readonly order = 2;

  public render(): HTMLElement {
    return document.createElement('div');
  }

  public async onSave(): Promise<boolean> {
    throw new Error('Save operation failed');
  }

  public validate(): boolean {
    return true;
  }

  public getValidationErrors(): string[] {
    return [];
  }
}

class ValidationErrorTab extends BaseSettingsTab {
  public readonly id = 'validation-error-tab';
  public readonly title = 'Validation Error Tab';
  public readonly icon = '⚠️';
  public readonly order = 3;

  public render(): HTMLElement {
    return document.createElement('div');
  }

  public async onSave(): Promise<boolean> {
    return true;
  }

  public validate(): boolean {
    throw new Error('Validation check failed');
  }

  public getValidationErrors(): string[] {
    throw new Error('Cannot get validation errors');
  }
}

class NetworkErrorTab extends BaseSettingsTab {
  public readonly id = 'network-error-tab';
  public readonly title = 'Network Error Tab';
  public readonly icon = '🌐';
  public readonly order = 4;

  public render(): HTMLElement {
    return document.createElement('div');
  }

  public async onSave(): Promise<boolean> {
    // Simulate network timeout
    await new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Network timeout')), 100);
    });
    return true;
  }

  public validate(): boolean {
    return true;
  }

  public getValidationErrors(): string[] {
    return [];
  }
}

describe('Settings Error Handling Tests', () => {
  let settingsModal: SettingsModal;
  let mockElectronAPI: jest.Mocked<any>;
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockElectronAPI = {
      invoke: jest.fn()
    };
    (window as any).electronAPI = mockElectronAPI;
    
    settingsModal = new SettingsModal();
    consoleSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    if (settingsModal && settingsModal.isOpen()) {
      settingsModal.hide();
    }
    consoleSpy.mockRestore();
  });

  describe('Tab Render Error Handling', () => {
    it('should handle tab render failures gracefully', () => {
      settingsModal.registerTab({
        id: 'render-error-tab',
        title: 'Render Error Tab',
        icon: '💥',
        component: RenderErrorTab,
        order: 1
      });

      settingsModal.show();

      // Should not throw error when trying to switch to failing tab
      expect(() => settingsModal.switchTab('render-error-tab')).not.toThrow();
      
      // Should log the error
      expect(consoleSpy).toHaveBeenCalledWith(
        'Error validating tab render-error-tab:',
        expect.any(Error)
      );
    });

    it('should continue working with other tabs when one fails to render', () => {
      settingsModal.registerTab({
        id: 'render-error-tab',
        title: 'Render Error Tab',
        icon: '💥',
        component: RenderErrorTab,
        order: 1
      });

      settingsModal.registerTab({
        id: 'working-tab',
        title: 'Working Tab',
        icon: '✅',
        component: ApiKeysTab,
        order: 2
      });

      settingsModal.show();

      // Failing tab should not prevent other tabs from working
      settingsModal.switchTab('working-tab');
      expect(settingsModal.getActiveTabId()).toBe('working-tab');
    });
  });

  describe('Save Error Handling', () => {
    it('should handle individual tab save failures', async () => {
      settingsModal.registerTab({
        id: 'save-error-tab',
        title: 'Save Error Tab',
        icon: '💾',
        component: SaveErrorTab,
        order: 1
      });

      settingsModal.show();

      const saveResult = await settingsModal.saveAllTabs();
      expect(saveResult).toBe(false);
      
      // Should log the error but not crash
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should handle network timeouts during save', async () => {
      settingsModal.registerTab({
        id: 'network-error-tab',
        title: 'Network Error Tab',
        icon: '🌐',
        component: NetworkErrorTab,
        order: 1
      });

      settingsModal.show();

      const saveResult = await settingsModal.saveAllTabs();
      expect(saveResult).toBe(false);
    });

    it('should handle mixed success and failure scenarios', async () => {
      settingsModal.registerTab({
        id: 'working-tab',
        title: 'Working Tab',
        icon: '✅',
        component: ApiKeysTab,
        order: 1
      });

      settingsModal.registerTab({
        id: 'save-error-tab',
        title: 'Save Error Tab',
        icon: '💾',
        component: SaveErrorTab,
        order: 2
      });

      settingsModal.show();

      const saveResult = await settingsModal.saveAllTabs();
      expect(saveResult).toBe(false);
    });
  });

  describe('Validation Error Handling', () => {
    it('should handle validation method failures', async () => {
      settingsModal.registerTab({
        id: 'validation-error-tab',
        title: 'Validation Error Tab',
        icon: '⚠️',
        component: ValidationErrorTab,
        order: 1
      });

      settingsModal.show();

      const saveResult = await settingsModal.saveAllTabs();
      expect(saveResult).toBe(false);
      
      // Should handle the validation error gracefully
      expect(consoleSpy).toHaveBeenCalledWith(
        'Error validating tab validation-error-tab:',
        expect.any(Error)
      );
    });

    it('should handle getValidationErrors method failures', async () => {
      // Create a tab that fails validation but also fails to get errors
      class BadValidationTab extends BaseSettingsTab {
        public readonly id = 'bad-validation-tab';
        public readonly title = 'Bad Validation Tab';
        public readonly icon = '🚫';
        public readonly order = 1;

        public render(): HTMLElement {
          return document.createElement('div');
        }

        public async onSave(): Promise<boolean> {
          return true;
        }

        public validate(): boolean {
          return false; // Fails validation
        }

        public getValidationErrors(): string[] {
          throw new Error('Cannot get validation errors');
        }
      }

      settingsModal.registerTab({
        id: 'bad-validation-tab',
        title: 'Bad Validation Tab',
        icon: '🚫',
        component: BadValidationTab,
        order: 1
      });

      settingsModal.show();

      const saveResult = await settingsModal.saveAllTabs();
      expect(saveResult).toBe(false);
    });
  });

  describe('IPC Communication Error Handling', () => {
    it('should handle IPC invoke failures', async () => {
      mockElectronAPI.invoke.mockRejectedValue(new Error('IPC communication failed'));

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
    });

    it('should handle malformed IPC responses', async () => {
      mockElectronAPI.invoke.mockResolvedValue(null); // Invalid response

      settingsModal.registerTab({
        id: 'models',
        title: 'Models',
        icon: '🤖',
        component: ModelsTab,
        order: 1
      });

      settingsModal.show();
      settingsModal.switchTab('models');

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should handle gracefully
      expect(settingsModal.isOpen()).toBe(true);
    });
  });

  describe('DOM Manipulation Error Handling', () => {
    it('should handle missing DOM elements', () => {
      // Mock querySelector to return null
      document.querySelector = jest.fn(() => null);

      settingsModal.show();

      // Should not crash when DOM elements are missing
      expect(settingsModal.isOpen()).toBe(true);
    });

    it('should handle DOM manipulation failures', () => {
      // Mock appendChild to throw error
      const mockAppendChild = jest.fn(() => {
        throw new Error('DOM manipulation failed');
      });

      document.body.appendChild = mockAppendChild;

      // Should handle gracefully
      expect(() => settingsModal.show()).not.toThrow();
    });
  });

  describe('Memory and Resource Error Handling', () => {
    it('should handle memory allocation failures', () => {
      // Mock createElement to simulate memory issues
      const originalCreateElement = document.createElement;
      let callCount = 0;
      
      document.createElement = jest.fn((tagName: string) => {
        callCount++;
        if (callCount > 5) {
          throw new Error('Out of memory');
        }
        return originalCreateElement.call(document, tagName);
      });

      settingsModal.registerTab({
        id: 'api-keys',
        title: 'API Keys',
        icon: '🔐',
        component: ApiKeysTab,
        order: 1
      });

      // Should handle gracefully
      expect(() => settingsModal.show()).not.toThrow();
    });

    it('should clean up resources even when errors occur', () => {
      settingsModal.show();
      
      // Mock removeChild to throw error
      document.body.removeChild = jest.fn(() => {
        throw new Error('Cleanup failed');
      });

      // Should still attempt cleanup
      expect(() => settingsModal.hide()).not.toThrow();
    });
  });

  describe('Concurrent Operation Error Handling', () => {
    it('should handle multiple simultaneous save operations', async () => {
      settingsModal.registerTab({
        id: 'api-keys',
        title: 'API Keys',
        icon: '🔐',
        component: ApiKeysTab,
        order: 1
      });

      settingsModal.show();

      // Start multiple save operations simultaneously
      const savePromises = [
        settingsModal.saveAllTabs(),
        settingsModal.saveAllTabs(),
        settingsModal.saveAllTabs()
      ];

      const results = await Promise.all(savePromises);
      
      // Should handle concurrent operations gracefully
      expect(results).toHaveLength(3);
    });

    it('should handle rapid tab switching during save operations', async () => {
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

      // Start save operation
      const savePromise = settingsModal.saveAllTabs();

      // Rapidly switch tabs during save
      for (let i = 0; i < 10; i++) {
        settingsModal.switchTab(i % 2 === 0 ? 'tab-1' : 'tab-2');
      }

      const result = await savePromise;
      
      // Should complete without crashing
      expect(typeof result).toBe('boolean');
    });
  });

  describe('Recovery and Fallback Mechanisms', () => {
    it('should provide fallback when tab registration fails', () => {
      // Try to register a tab with invalid configuration
      expect(() => {
        settingsModal.registerTab({
          id: '',
          title: '',
          icon: '',
          component: null as any,
          order: 0
        });
      }).not.toThrow();
    });

    it('should recover from CSS loading failures', () => {
      // Mock head.appendChild to fail
      document.head.appendChild = jest.fn(() => {
        throw new Error('CSS loading failed');
      });

      // Should still show modal without CSS
      expect(() => settingsModal.show()).not.toThrow();
      expect(settingsModal.isOpen()).toBe(true);
    });

    it('should maintain functionality when event listeners fail', () => {
      // Mock addEventListener to fail
      document.addEventListener = jest.fn(() => {
        throw new Error('Event listener failed');
      });

      settingsModal.show();

      // Should still be functional
      expect(settingsModal.isOpen()).toBe(true);
    });
  });
});