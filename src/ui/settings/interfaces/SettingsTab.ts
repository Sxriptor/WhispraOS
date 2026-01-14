/**
 * Common interface for all settings tabs
 * Provides consistent structure and lifecycle management
 */

export interface SettingsTab {
  /** Unique identifier for the tab */
  readonly id: string;
  
  /** Display title for the tab */
  readonly title: string;
  
  /** Icon class or identifier for the tab */
  readonly icon: string;
  
  /** Order for tab display (lower numbers appear first) */
  readonly order: number;
  
  /**
   * Render the tab content
   * @returns HTMLElement containing the tab's UI
   */
  render(): HTMLElement;
  
  /**
   * Called when the tab becomes active
   * Use for initialization, event binding, etc.
   */
  onActivate(): void;
  
  /**
   * Called when the tab becomes inactive
   * Use for cleanup, event unbinding, etc.
   */
  onDeactivate(): void;
  
  /**
   * Save the tab's current configuration
   * @returns Promise<boolean> true if save was successful
   */
  onSave(): Promise<boolean>;
  
  /**
   * Validate the tab's current state
   * @returns boolean true if validation passes
   */
  validate(): boolean;
  
  /**
   * Get validation error messages
   * @returns string[] array of error messages, empty if valid
   */
  getValidationErrors(): string[];
}

/**
 * Configuration for tab registration
 */
export interface TabDefinition {
  /** Unique identifier for the tab */
  id: string;
  
  /** Display title for the tab */
  title: string;
  
  /** Icon class or identifier for the tab */
  icon: string;
  
  /** Constructor for the tab component */
  component: new () => SettingsTab;
  
  /** Order for tab display (lower numbers appear first) */
  order: number;
}

/**
 * Tab registration system for dynamic tab loading
 */
export interface TabRegistry {
  /**
   * Register a new tab
   * @param definition Tab definition to register
   */
  registerTab(definition: TabDefinition): void;
  
  /**
   * Get all registered tabs sorted by order
   * @returns TabDefinition[] array of registered tabs
   */
  getRegisteredTabs(): TabDefinition[];
  
  /**
   * Get a specific tab by ID
   * @param id Tab identifier
   * @returns TabDefinition | undefined
   */
  getTab(id: string): TabDefinition | undefined;
  
  /**
   * Unregister a tab
   * @param id Tab identifier to remove
   */
  unregisterTab(id: string): void;
}

/**
 * Event types for tab system
 */
export interface TabEvents {
  /** Fired when a tab is activated */
  'tab:activated': { tabId: string; tab: SettingsTab };
  
  /** Fired when a tab is deactivated */
  'tab:deactivated': { tabId: string; tab: SettingsTab };
  
  /** Fired when tab validation fails */
  'tab:validation-failed': { tabId: string; errors: string[] };
  
  /** Fired when tab save operation completes */
  'tab:saved': { tabId: string; success: boolean };
  
  /** Fired when modal is shown */
  'modal:shown': {};
  
  /** Fired when modal is hidden */
  'modal:hidden': {};
}

/**
 * Base abstract class for implementing settings tabs
 * Provides common functionality and enforces interface compliance
 */
export abstract class BaseSettingsTab implements SettingsTab {
  abstract readonly id: string;
  abstract readonly title: string;
  abstract readonly icon: string;
  abstract readonly order: number;
  
  protected container: HTMLElement | null = null;
  protected isActive: boolean = false;
  
  abstract render(): HTMLElement;
  
  onActivate(): void {
    this.isActive = true;
  }
  
  onDeactivate(): void {
    this.isActive = false;
  }
  
  abstract onSave(): Promise<boolean>;
  
  validate(): boolean {
    return this.getValidationErrors().length === 0;
  }
  
  getValidationErrors(): string[] {
    return [];
  }
  
  /**
   * Helper method to create DOM elements with classes
   */
  protected createElement<K extends keyof HTMLElementTagNameMap>(
    tagName: K,
    className?: string,
    textContent?: string
  ): HTMLElementTagNameMap[K] {
    const element = document.createElement(tagName);
    if (className) {
      element.className = className;
    }
    if (textContent) {
      element.textContent = textContent;
    }
    return element;
  }
  
  /**
   * Helper method to add event listeners that are automatically cleaned up
   */
  protected addEventListeners(element: HTMLElement, events: Record<string, EventListener>): void {
    Object.entries(events).forEach(([event, listener]) => {
      element.addEventListener(event, listener);
    });
  }
}