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
    selected: false,
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
    value: 'en',
    checked: false,
    addEventListener: jest.fn()
  }))
});

Object.defineProperty(document, 'querySelector', {
  value: jest.fn(() => ({
    value: 'dark',
    checked: true
  }))
});

describe('AccountTab', () => {
  let accountTab: AccountTab;
  let mockElectronAPI: jest.Mocked<any>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockElectronAPI = {
      invoke: jest.fn()
    };
    (window as any).electronAPI = mockElectronAPI;
    
    accountTab = new AccountTab();
  });

  describe('Tab Properties', () => {
    it('should have correct tab properties', () => {
      expect(accountTab.id).toBe('account');
      expect(accountTab.title).toBe('Account');
      expect(accountTab.icon).toBe('👤');
      expect(accountTab.order).toBe(4);
    });
  });

  describe('User Preferences Loading', () => {
    it('should load user preferences', async () => {
      const mockPreferences = {
        language: 'en',
        theme: 'dark',
        notifications: {
          translationComplete: true,
          errors: true,
          updates: false
        }
      };

      mockElectronAPI.invoke.mockResolvedValue({
        success: true,
        payload: mockPreferences
      });

      await (accountTab as any).loadUserPreferences();

      expect(mockElectronAPI.invoke).toHaveBeenCalledWith('config:get', expect.any(Object));
      expect((accountTab as any).userPreferences.language).toBe('en');
      expect((accountTab as any).userPreferences.theme).toBe('dark');
    });

    it('should use defaults when loading fails', async () => {
      mockElectronAPI.invoke.mockRejectedValue(new Error('Load failed'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await (accountTab as any).loadUserPreferences();

      expect((accountTab as any).userPreferences.language).toBe('en');
      expect((accountTab as any).userPreferences.theme).toBe('auto');
      expect(consoleSpy).toHaveBeenCalledWith('Error loading user preferences:', expect.any(Error));

      consoleSpy.mockRestore();
    });
  });

  describe('Account Dashboard', () => {
    it('should open account dashboard', async () => {
      mockElectronAPI.invoke.mockResolvedValue({ success: true });

      await (accountTab as any).openAccountDashboard({
        messages: { openingDashboard: 'Opening...' }
      });

      expect(mockElectronAPI.invoke).toHaveBeenCalledWith('auth:open-dashboard', expect.any(Object));
    });

    it('should handle dashboard opening failure', async () => {
      mockElectronAPI.invoke.mockResolvedValue({
        success: false,
        error: 'Failed to open dashboard'
      });

      const alertSpy = jest.spyOn(window, 'alert').mockImplementation();
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await (accountTab as any).openAccountDashboard({
        messages: { 
          openingDashboard: 'Opening...',
          dashboardError: 'Failed to open dashboard'
        }
      });

      expect(consoleSpy).toHaveBeenCalledWith('Failed to open account dashboard:', 'Failed to open dashboard');
      expect(alertSpy).toHaveBeenCalledWith('Failed to open dashboard');

      alertSpy.mockRestore();
      consoleSpy.mockRestore();
    });
  });

  describe('Theme Management', () => {
    it('should handle theme changes', () => {
      const container = accountTab.render();
      expect(container).toBeDefined();
      expect(container.className).toBe('account-tab');
    });

    it('should apply theme preview', () => {
      const mockBody = {
        setAttribute: jest.fn(),
        classList: {
          add: jest.fn(),
          remove: jest.fn()
        }
      };

      Object.defineProperty(document, 'body', {
        value: mockBody,
        configurable: true
      });

      (accountTab as any).previewTheme('dark');

      expect(mockBody.setAttribute).toHaveBeenCalledWith('data-theme', 'dark');
    });
  });

  describe('Language Selection', () => {
    it('should handle language changes', () => {
      const mockSelect = {
        value: 'es',
        addEventListener: jest.fn()
      };

      (accountTab as any).handleLanguageChange(mockSelect, {
        messages: { languageChanged: 'Language changed' }
      });

      expect((accountTab as any).userPreferences.language).toBe('es');
    });

    it('should show language change confirmation', () => {
      const alertSpy = jest.spyOn(window, 'alert').mockImplementation();

      const mockSelect = {
        value: 'ja',
        addEventListener: jest.fn()
      };

      (accountTab as any).handleLanguageChange(mockSelect, {
        messages: { languageChanged: 'Language changed to Japanese' }
      });

      expect(alertSpy).toHaveBeenCalledWith('Language changed to Japanese');

      alertSpy.mockRestore();
    });
  });

  describe('Notification Preferences', () => {
    it('should handle notification toggle', () => {
      const mockCheckbox = {
        checked: true,
        addEventListener: jest.fn()
      };

      (accountTab as any).handleNotificationToggle('translationComplete', mockCheckbox);

      expect((accountTab as any).userPreferences.notifications.translationComplete).toBe(true);
    });

    it('should handle multiple notification types', () => {
      const notifications = ['translationComplete', 'errors', 'updates'];
      
      notifications.forEach((type, index) => {
        const mockCheckbox = {
          checked: index % 2 === 0, // Alternate true/false
          addEventListener: jest.fn()
        };

        (accountTab as any).handleNotificationToggle(type, mockCheckbox);
      });

      expect((accountTab as any).userPreferences.notifications.translationComplete).toBe(true);
      expect((accountTab as any).userPreferences.notifications.errors).toBe(false);
      expect((accountTab as any).userPreferences.notifications.updates).toBe(true);
    });
  });

  describe('Validation', () => {
    it('should always validate successfully', () => {
      const isValid = accountTab.validate();
      expect(isValid).toBe(true);
    });

    it('should return no validation errors', () => {
      const errors = accountTab.getValidationErrors();
      expect(errors).toEqual([]);
    });
  });

  describe('Save Functionality', () => {
    beforeEach(() => {
      document.getElementById = jest.fn((id: string) => {
        if (id.includes('language')) {
          return { value: 'es' };
        }
        if (id.includes('theme')) {
          return { value: 'light' };
        }
        return { checked: true };
      });
    });

    it('should save user preferences successfully', async () => {
      mockElectronAPI.invoke.mockResolvedValue({ success: true });

      const result = await accountTab.onSave();

      expect(result).toBe(true);
      expect(mockElectronAPI.invoke).toHaveBeenCalledWith('config:set', expect.objectContaining({
        payload: expect.objectContaining({
          language: expect.any(String),
          theme: expect.any(String),
          notifications: expect.any(Object)
        })
      }));
    });

    it('should handle save failure', async () => {
      mockElectronAPI.invoke.mockResolvedValue({ success: false });

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = await accountTab.onSave();

      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith('Failed to save user preferences');

      consoleSpy.mockRestore();
    });
  });

  describe('Language Support', () => {
    it('should use English translations by default', () => {
      const translations = (accountTab as any).getTranslations();

      expect(translations.sections.account).toBe('Account');
      expect(translations.sections.preferences).toBe('Preferences');
    });

    it('should use Spanish translations when language is set', () => {
      (window as any).currentLanguage = 'es';
      accountTab = new AccountTab();

      const translations = (accountTab as any).getTranslations();

      expect(translations.sections.account).toBe('Cuenta');
      expect(translations.sections.preferences).toBe('Preferencias');
    });

    it('should fallback to English for unsupported languages', () => {
      (window as any).currentLanguage = 'unsupported';
      accountTab = new AccountTab();

      const translations = (accountTab as any).getTranslations();

      expect(translations.sections.account).toBe('Account');
    });
  });

  describe('Tab Lifecycle', () => {
    it('should reload preferences on activate', async () => {
      mockElectronAPI.invoke.mockResolvedValue({
        success: true,
        payload: {}
      });

      const loadSpy = jest.spyOn(accountTab as any, 'loadUserPreferences');

      accountTab.onActivate();

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

      const result = await accountTab.onSave();

      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith('Error saving user preferences:', expect.any(Error));

      consoleSpy.mockRestore();
    });

    it('should handle missing DOM elements', async () => {
      document.getElementById = jest.fn(() => null);

      const result = await accountTab.onSave();

      // Should not throw error and use defaults
      expect(result).toBe(true);
    });

    it('should handle theme preview errors', () => {
      // Mock document.body to be null
      Object.defineProperty(document, 'body', {
        value: null,
        configurable: true
      });

      // Should not throw error
      expect(() => (accountTab as any).previewTheme('dark')).not.toThrow();
    });
  });
});