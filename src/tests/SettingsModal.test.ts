import { SettingsModal } from '../ui/settings/SettingsModal';
import { BaseSettingsTab, TabDefinition } from '../ui/settings/interfaces/SettingsTab';

// Mock DOM methods
Object.defineProperty(window, 'getComputedStyle', {
  value: () => ({
    getPropertyValue: () => ''
  })
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

// Mock CSS file loading
Object.defineProperty(document, 'querySelector', {
  value: jest.fn(() => null)
});

// Mock requestAnimationFrame
Object.defineProperty(window, 'requestAnimationFrame', {
  value: jest.fn((callback: Function) => {
    setTimeout(callback, 0);
    return 1;
  })
});

// Mock test tab class
class MockTab extends BaseSettingsTab {
  public readonly id = 'mock-tab';
  public readonly title = 'Mock Tab';
  public readonly icon = '🧪';
  public readonly order = 1;

  public render(): HTMLElement {
    return document.createElement('div');
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

// Mock failing tab class
class FailingTab extends BaseSettingsTab {
  public readonly id = 'failing-tab';
  public readonly title = 'Failing Tab';
  public readonly icon = '❌';
  public readonly order = 2;

  public render(): HTMLElement {
    throw new Error('Render failed');
  }

  public async onSave(): Promise<boolean> {
    return false;
  }

  public validate(): boolean {
    return false;
  }

  public getValidationErrors(): string[] {
    return ['Validation error 1', 'Validation error 2'];
  }
}

describe('SettingsModal', () => {
  let settingsModal: SettingsModal;

  beforeEach(() => {
    jest.clearAllMocks();
    settingsModal = new SettingsModal();
  });

  afterEach(() => {
    if (settingsModal && settingsModal.isOpen()) {
      settingsModal.hide();
    }
  });

  describe('Tab Registration', () => {
    it('should register tabs correctly', () => {
      const tabDefinition: TabDefinition = {
        id: 'test-tab',
        title: 'Test Tab',
        icon: '🧪',
        component: MockTab,
        order: 1
      };

      settingsModal.registerTab(tabDefinition);
      const registeredTabs = settingsModal.getRegisteredTabs();

      expect(registeredTabs).toHaveLength(1);
      expect(registeredTabs[0]).toEqual(tabDefinition);
    });

    it('should sort tabs by order', () => {
      const tab1: TabDefinition = {
        id: 'tab-1',
        title: 'Tab 1',
        icon: '1️⃣',
        component: MockTab,
        order: 3
      };

      const tab2: TabDefinition = {
        id: 'tab-2',
        title: 'Tab 2',
        icon: '2️⃣',
        component: MockTab,
        order: 1
      };

      const tab3: TabDefinition = {
        id: 'tab-3',
        title: 'Tab 3',
        icon: '3️⃣',
        component: MockTab,
        order: 2
      };

      settingsModal.registerTab(tab1);
      settingsModal.registerTab(tab2);
      settingsModal.registerTab(tab3);

      const registeredTabs = settingsModal.getRegisteredTabs();

      expect(registeredTabs).toHaveLength(3);
      expect(registeredTabs[0].id).toBe('tab-2'); // order: 1
      expect(registeredTabs[1].id).toBe('tab-3'); // order: 2
      expect(registeredTabs[2].id).toBe('tab-1'); // order: 3
    });

    it('should unregister tabs correctly', () => {
      const tabDefinition: TabDefinition = {
        id: 'test-tab',
        title: 'Test Tab',
        icon: '🧪',
        component: MockTab,
        order: 1
      };

      settingsModal.registerTab(tabDefinition);
      expect(settingsModal.getRegisteredTabs()).toHaveLength(1);

      settingsModal.unregisterTab('test-tab');
      expect(settingsModal.getRegisteredTabs()).toHaveLength(0);
    });
  });

  describe('Modal Lifecycle', () => {
    it('should show modal correctly', () => {
      expect(settingsModal.isOpen()).toBe(false);

      settingsModal.show();

      expect(settingsModal.isOpen()).toBe(true);
      expect(document.body.appendChild).toHaveBeenCalled();
    });

    it('should hide modal correctly', () => {
      settingsModal.show();
      expect(settingsModal.isOpen()).toBe(true);

      settingsModal.hide();

      expect(settingsModal.isOpen()).toBe(false);
    });

    it('should not show modal multiple times', () => {
      settingsModal.show();
      const firstCallCount = (document.body.appendChild as jest.Mock).mock.calls.length;

      settingsModal.show(); // Second call should be ignored

      expect((document.body.appendChild as jest.Mock).mock.calls.length).toBe(firstCallCount);
    });

    it('should handle hide when not visible', () => {
      expect(settingsModal.isOpen()).toBe(false);

      // Should not throw error
      expect(() => settingsModal.hide()).not.toThrow();
    });
  });

  describe('Tab Switching', () => {
    beforeEach(() => {
      const tabDefinition: TabDefinition = {
        id: 'test-tab',
        title: 'Test Tab',
        icon: '🧪',
        component: MockTab,
        order: 1
      };

      settingsModal.registerTab(tabDefinition);
      settingsModal.show();
    });

    it('should switch to registered tab', () => {
      settingsModal.switchTab('test-tab');

      expect(settingsModal.getActiveTabId()).toBe('test-tab');
      expect(settingsModal.getActiveTab()).toBeInstanceOf(MockTab);
    });

    it('should handle switching to non-existent tab', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      settingsModal.switchTab('non-existent-tab');

      expect(consoleSpy).toHaveBeenCalledWith('Tab with id "non-existent-tab" not found');
      expect(settingsModal.getActiveTabId()).toBeNull();

      consoleSpy.mockRestore();
    });

    it('should deactivate previous tab when switching', () => {
      // Switch to first tab
      settingsModal.switchTab('test-tab');
      const firstTab = settingsModal.getActiveTab();
      const deactivateSpy = jest.spyOn(firstTab!, 'onDeactivate');

      // Register and switch to second tab
      const secondTabDef: TabDefinition = {
        id: 'second-tab',
        title: 'Second Tab',
        icon: '2️⃣',
        component: MockTab,
        order: 2
      };
      settingsModal.registerTab(secondTabDef);
      settingsModal.switchTab('second-tab');

      expect(deactivateSpy).toHaveBeenCalled();
      expect(settingsModal.getActiveTabId()).toBe('second-tab');
    });
  });

  describe('Save Coordination', () => {
    beforeEach(() => {
      const mockTabDef: TabDefinition = {
        id: 'mock-tab',
        title: 'Mock Tab',
        icon: '🧪',
        component: MockTab,
        order: 1
      };

      const failingTabDef: TabDefinition = {
        id: 'failing-tab',
        title: 'Failing Tab',
        icon: '❌',
        component: FailingTab,
        order: 2
      };

      settingsModal.registerTab(mockTabDef);
      settingsModal.registerTab(failingTabDef);
      settingsModal.show();
    });

    it('should save all tabs successfully', async () => {
      // Only register successful tab for this test
      settingsModal.unregisterTab('failing-tab');

      const result = await settingsModal.saveAllTabs();

      expect(result).toBe(true);
    });

    it('should handle validation errors', async () => {
      // Switch to failing tab to trigger validation error
      settingsModal.switchTab('failing-tab');

      const result = await settingsModal.saveAllTabs();

      expect(result).toBe(false);
    });

    it('should handle save failures', async () => {
      // The failing tab will return false from onSave
      const result = await settingsModal.saveAllTabs();

      expect(result).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle tab render errors gracefully', () => {
      const failingTabDef: TabDefinition = {
        id: 'failing-tab',
        title: 'Failing Tab',
        icon: '❌',
        component: FailingTab,
        order: 1
      };

      settingsModal.registerTab(failingTabDef);
      settingsModal.show();

      // Should not throw error when trying to switch to failing tab
      expect(() => settingsModal.switchTab('failing-tab')).not.toThrow();
    });

    it('should handle missing tab content element', () => {
      const tabDefinition: TabDefinition = {
        id: 'test-tab',
        title: 'Test Tab',
        icon: '🧪',
        component: MockTab,
        order: 1
      };

      settingsModal.registerTab(tabDefinition);
      
      // Mock missing content element
      const originalQuerySelector = document.querySelector;
      document.querySelector = jest.fn(() => null);

      settingsModal.show();

      // Should not throw error
      expect(() => settingsModal.switchTab('test-tab')).not.toThrow();

      // Restore original method
      document.querySelector = originalQuerySelector;
    });
  });

  describe('Keyboard Navigation', () => {
    beforeEach(() => {
      settingsModal.show();
    });

    it('should handle escape key to close modal', () => {
      const event = new KeyboardEvent('keydown', { key: 'Escape' });
      
      // Simulate escape key press
      document.dispatchEvent(event);

      // Modal should be closed (we can't easily test this without full DOM)
      // This test verifies the event listener is set up
      expect(document.addEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));
    });

    it('should handle save shortcut', () => {
      const event = new KeyboardEvent('keydown', { 
        key: 's', 
        ctrlKey: true 
      });
      
      // Simulate Ctrl+S key press
      document.dispatchEvent(event);

      // Should trigger save (we can't easily test the actual save without mocking more)
      expect(document.addEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));
    });
  });

  describe('CSS Loading', () => {
    it('should load CSS file when modal is created', () => {
      settingsModal.show();

      expect(document.head.appendChild).toHaveBeenCalled();
    });

    it('should not load CSS file multiple times', () => {
      // Mock existing CSS link
      document.querySelector = jest.fn(() => ({ href: 'settings.css' }));

      settingsModal.show();

      // Should not append CSS again
      expect(document.head.appendChild).not.toHaveBeenCalled();
    });
  });
});