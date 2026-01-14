/**
 * Main settings modal container and tab management
 * Provides a tabbed interface for application settings
 */

import { SettingsTab, TabDefinition } from './interfaces/SettingsTab.js';
import { getTranslations } from '../../renderer/i18n.js';

export class SettingsModal {
  private modalElement: HTMLElement | null = null;
  private overlayElement: HTMLElement | null = null;
  private tabNavElement: HTMLElement | null = null;
  private tabContentElement: HTMLElement | null = null;
  private registeredTabs: Map<string, TabDefinition> = new Map();
  private activeTab: SettingsTab | null = null;
  private activeTabId: string | null = null;
  private isVisible: boolean = false;
  private runInBackgroundState: boolean = false;

  constructor() {
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleOverlayClick = this.handleOverlayClick.bind(this);
    
    // Listen for API mode changes to refresh the API Keys tab
    window.addEventListener('managed-api-mode-changed', (event: any) => {
      console.log('🔄 Settings modal detected API mode change:', event.detail?.mode);
      
      // If API Keys tab is currently active, force refresh it
      if (this.activeTabId === 'api-keys' && this.activeTab && typeof (this.activeTab as any).forceRefresh === 'function') {
        setTimeout(() => {
          (this.activeTab as any).forceRefresh().catch((error: any) => {
            console.error('Error refreshing API Keys tab after mode change:', error);
          });
        }, 50);
      }
    });
  }

  /**
   * Show the settings modal
   */
  public async show(): Promise<void> {
    if (this.isVisible) {
      return;
    }

    // Load the runInBackground state FIRST before creating any UI
    await this.loadRunInBackgroundState();
    console.log('[SettingsModal] State loaded, creating modal with runInBackground:', this.runInBackgroundState);

    this.createModal();
    this.isVisible = true;
    
    // Add class to body to indicate settings is open
    document.body.classList.add('settings-modal-open');
    
    // Add to DOM with animation
    this.overlayElement!.style.opacity = '0';
    document.body.appendChild(this.overlayElement!);
    
    // Trigger animation
    requestAnimationFrame(() => {
      if (this.overlayElement) {
        this.overlayElement.style.transition = 'opacity 0.2s ease';
        this.overlayElement.style.opacity = '1';
      }
    });
    
    // Add event listeners
    document.addEventListener('keydown', this.handleKeyDown);
    
    // Focus management
    setTimeout(() => this.focusModal(), 100);
    
    // Render tab navigation
    this.renderTabNavigation();
    
    // Activate first tab if available
    const firstTab = Array.from(this.registeredTabs.values())
      .sort((a, b) => a.order - b.order)[0];
    
    if (firstTab) {
      this.switchTab(firstTab.id);
    }
  }

  /**
   * Hide the settings modal
   */
  public hide(): void {
    if (!this.isVisible) {
      return;
    }

    // Deactivate current tab
    if (this.activeTab) {
      this.activeTab.onDeactivate();
      this.activeTab = null;
      this.activeTabId = null;
    }

    // Remove event listeners
    document.removeEventListener('keydown', this.handleKeyDown);

    // Clean up any temporary messages
    this.clearMessages();

    // Remove from DOM with animation support
    if (this.overlayElement) {
      this.overlayElement.style.opacity = '0';
      
      setTimeout(() => {
        if (this.overlayElement && this.overlayElement.parentNode) {
          document.body.removeChild(this.overlayElement);
        }
        // Remove class from body when settings is closed
        document.body.classList.remove('settings-modal-open');
        this.cleanup();
      }, 200);
    } else {
      // Remove class from body when settings is closed
      document.body.classList.remove('settings-modal-open');
      this.cleanup();
    }
  }

  /**
   * Clean up modal resources
   */
  private cleanup(): void {
    // Clean up references
    this.modalElement = null;
    this.overlayElement = null;
    this.tabNavElement = null;
    this.tabContentElement = null;
    this.isVisible = false;
  }

  /**
   * Clear temporary messages
   */
  private clearMessages(): void {
    if (!this.modalElement) {
      return;
    }

    const messages = this.modalElement.querySelectorAll(
      '.settings-validation-errors, .settings-save-success, .settings-save-error'
    );
    
    messages.forEach(message => {
      if (message.parentNode) {
        message.parentNode.removeChild(message);
      }
    });
  }

  /**
   * Check if modal is currently visible
   */
  public isOpen(): boolean {
    return this.isVisible;
  }

  /**
   * Get the currently active tab
   */
  public getActiveTab(): SettingsTab | null {
    return this.activeTab;
  }

  /**
   * Get the currently active tab ID
   */
  public getActiveTabId(): string | null {
    return this.activeTabId;
  }

  /**
   * Create the modal DOM structure
   */
  private createModal(): void {
    // Create overlay
    this.overlayElement = document.createElement('div');
    this.overlayElement.className = 'settings-modal-overlay';
    this.overlayElement.addEventListener('click', this.handleOverlayClick);

    // Create modal container
    this.modalElement = document.createElement('div');
    this.modalElement.className = 'settings-modal';
    this.modalElement.setAttribute('role', 'dialog');
    this.modalElement.setAttribute('aria-modal', 'true');
    this.modalElement.setAttribute('aria-labelledby', 'settings-modal-title');

    // Apply current theme to modal
    this.applyCurrentTheme();

    // Create header (uses pre-loaded runInBackgroundState)
    const header = this.createHeader();
    this.modalElement.appendChild(header);

    // Create body
    const body = this.createBody();
    this.modalElement.appendChild(body);

    // Create footer
    const footer = this.createFooter();
    this.modalElement.appendChild(footer);

    // Add modal to overlay
    this.overlayElement.appendChild(this.modalElement);

    // Load CSS if not already loaded
    this.loadCSS();
  }

  /**
   * Create modal header
   */
  private createHeader(): HTMLElement {
    const currentLanguage = (window as any).currentLanguage || 'en';
    const t = getTranslations(currentLanguage);
    const settingsT = t.settingsModal || {};
    
    const header = document.createElement('div');
    header.className = 'settings-modal-header';

    const title = document.createElement('h2');
    title.id = 'settings-modal-title';
    title.className = 'settings-modal-title';
    title.textContent = settingsT.title || 'Settings';

    // Create background toggle container
    const toggleContainer = document.createElement('div');
    toggleContainer.className = 'settings-header-toggle';
    toggleContainer.style.cssText = 'display: flex; align-items: center; gap: 8px; margin-left: auto; margin-right: 12px;';

    const toggleLabel = document.createElement('span');
    toggleLabel.textContent = settingsT.runInBackground || 'Run in background';
    toggleLabel.style.cssText = 'font-size: 0.875rem; color: var(--settings-text-secondary);';

    const toggleSwitch = document.createElement('div');
    toggleSwitch.className = 'settings-toggle-switch';
    // Ensure the switch has visible dimensions and positioning; background will be set by updateToggleUI
    toggleSwitch.style.cssText = 'width: 40px; height: 22px; background: var(--settings-border); border-radius: 11px; position: relative; cursor: pointer; transition: background 0.2s;';
    toggleSwitch.setAttribute('role', 'switch');
    toggleSwitch.setAttribute('aria-label', settingsT.runInBackground || 'Run in background');

    const toggleHandle = document.createElement('div');
    toggleHandle.className = 'settings-toggle-handle';
    toggleHandle.style.cssText = 'width: 18px; height: 18px; border-radius: 50%; position: absolute; top: 2px; transition: all 0.2s; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);';

    toggleSwitch.appendChild(toggleHandle);

    // Apply the loaded state (already loaded in show() method)
    console.log('[SettingsModal] Creating toggle with runInBackgroundState:', this.runInBackgroundState);
    this.updateToggleUI(toggleSwitch, toggleHandle, this.runInBackgroundState);

    // Add click handler
    toggleSwitch.addEventListener('click', () => this.handleBackgroundToggle(toggleSwitch, toggleHandle));

    toggleContainer.appendChild(toggleLabel);
    toggleContainer.appendChild(toggleSwitch);

    const closeButton = document.createElement('button');
    closeButton.className = 'settings-modal-close';
    closeButton.innerHTML = '×';
    closeButton.setAttribute('aria-label', settingsT.close || 'Close settings');
    closeButton.addEventListener('click', () => this.hide());

    header.appendChild(title);
    header.appendChild(toggleContainer);
    header.appendChild(closeButton);

    return header;
  }

  /**
   * Create modal body with tab navigation and content
   */
  private createBody(): HTMLElement {
    const body = document.createElement('div');
    body.className = 'settings-modal-body';

    // Create tab navigation
    this.tabNavElement = document.createElement('nav');
    this.tabNavElement.className = 'settings-tab-nav';
    this.tabNavElement.setAttribute('role', 'tablist');

    const navList = document.createElement('ul');
    navList.className = 'settings-tab-nav-list';
    this.tabNavElement.appendChild(navList);

    // Create tab content area
    this.tabContentElement = document.createElement('div');
    this.tabContentElement.className = 'settings-tab-content';
    this.tabContentElement.setAttribute('role', 'tabpanel');

    body.appendChild(this.tabNavElement);
    body.appendChild(this.tabContentElement);

    return body;
  }

  /**
   * Create modal footer
   */
  private createFooter(): HTMLElement {
    const currentLanguage = (window as any).currentLanguage || 'en';
    const t = getTranslations(currentLanguage);
    const settingsT = t.settingsModal || {};
    
    const footer = document.createElement('div');
    footer.className = 'settings-modal-footer';

    const closeButton = document.createElement('button');
    closeButton.className = 'settings-button settings-button-secondary';
    closeButton.textContent = settingsT.close || 'Close';
    closeButton.addEventListener('click', () => this.hide());

    footer.appendChild(closeButton);

    return footer;
  }

  /**
   * Load CSS file if not already loaded
   */
  private loadCSS(): void {
    const existingLink = document.querySelector('link[href*="settings.css"]');
    if (existingLink) {
      return;
    }

    // Inject CSS directly instead of loading external file
    const style = document.createElement('style');
    style.textContent = this.getSettingsCSS();
    document.head.appendChild(style);
  }

  /**
   * Get the CSS content for settings modal
   */
  private getSettingsCSS(): string {
    return `
      /* Modern Settings Modal CSS Variables */
      :root {
        --settings-primary-color: #ffffff;
        --settings-primary-hover: #e5e5e5;
        --settings-secondary-color: #9ca3af;
        --settings-success: #22c55e;
        --settings-warning: #f59e0b;
        --settings-error: #ef4444;
        --settings-background: #000000;
        --settings-surface: #111111;
        --settings-surface-hover: #1a1a1a;
        --settings-border: #333333;
        --settings-border-light: #404040;
        --settings-text: #ffffff;
        --settings-text-secondary: #a1a1aa;
        --settings-text-muted: #71717a;
        --settings-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.8);
        --settings-shadow-lg: 0 20px 25px -5px rgba(0, 0, 0, 0.6), 0 10px 10px -5px rgba(0, 0, 0, 0.4);
        --settings-radius-sm: 0.375rem;
        --settings-radius-md: 0.5rem;
        --settings-radius-lg: 0.75rem;
        --settings-radius-xl: 1rem;
        --settings-spacing-xs: 0.25rem;
        --settings-spacing-sm: 0.5rem;
        --settings-spacing-md: 0.75rem;
        --settings-spacing-lg: 1rem;
        --settings-spacing-xl: 1.25rem;
      }

      /* Dark theme support (already dark by default) */
      [data-theme="dark"] {
        --settings-background: #000000;
        --settings-surface: #0a0a0a;
        --settings-border: #262626;
        --settings-text: #f5f5f5;
        --settings-text-secondary: #c7c7c7;
      }

      /* Neo-Brutalism Theme Support */
      [data-theme="neo-brutalism"] {
        --settings-primary-color: #00D9FF;
        --settings-primary-hover: #39FF14;
        --settings-secondary-color: #000000;
        --settings-success: #39FF14;
        --settings-warning: #FFEA00;
        --settings-error: #FF1744;
        --settings-background: #FFFFFF;
        --settings-surface: #FFFFFF;
        --settings-surface-hover: #00D9FF;
        --settings-border: #000000;
        --settings-border-light: #000000;
        --settings-text: #000000;
        --settings-text-secondary: #000000;
        --settings-text-muted: #000000;
        --settings-shadow: 0 8px 0 rgba(0, 0, 0, 0.15);
        --settings-shadow-lg: 0 8px 0 rgba(0, 0, 0, 0.15);
        --settings-radius-sm: 0;
        --settings-radius-md: 0;
        --settings-radius-lg: 0;
        --settings-radius-xl: 0;
      }

      /* Force theme card text colors in neo-brutalism - override inline styles */
      [data-theme="neo-brutalism"] .settings-tab-content [style*="color: var(--settings-text)"],
      [data-theme="neo-brutalism"] .settings-tab-content [style*="color:var(--settings-text)"] {
        color: #000000 !important;
      }

      [data-theme="neo-brutalism"] .settings-tab-content [style*="color: var(--settings-text-secondary)"],
      [data-theme="neo-brutalism"] .settings-tab-content [style*="color:var(--settings-text-secondary)"] {
        color: #000000 !important;
      }

      [data-theme="neo-brutalism"] .settings-tab-content [style*="background: var(--settings-surface)"],
      [data-theme="neo-brutalism"] .settings-tab-content [style*="background:var(--settings-surface)"],
      [data-theme="neo-brutalism"] .theme-card[style*="background: var(--settings-surface)"],
      [data-theme="neo-brutalism"] .theme-card[style*="background:var(--settings-surface)"] {
        background: #FFFFFF !important;
        background-color: #FFFFFF !important;
      }

      [data-theme="neo-brutalism"] .settings-modal {
        border: 3px solid var(--settings-border);
        border-radius: 0;
        box-shadow: var(--settings-shadow);
      }

      [data-theme="neo-brutalism"] .settings-modal-header {
        background: #FFEA00;
        border-bottom: 3px solid var(--settings-border);
      }

      [data-theme="neo-brutalism"] .settings-modal-title {
        font-weight: 900;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }

      [data-theme="neo-brutalism"] .settings-modal-close {
        background: var(--settings-background);
        border: 3px solid var(--settings-border);
        border-radius: 0;
        font-weight: 900;
        box-shadow: 0 5px 0 rgba(0, 0, 0, 0.15);
        transition: all 0.15s cubic-bezier(0.68, -0.55, 0.265, 1.55);
      }

      [data-theme="neo-brutalism"] .settings-modal-close:hover {
        background: #FF1744;
        color: #FFFFFF;
        transform: translate(-2px, -2px);
        box-shadow: 0 7px 0 rgba(0, 0, 0, 0.15);
      }

      [data-theme="neo-brutalism"] .settings-tab-nav {
        background: var(--settings-background);
        border-right: 3px solid var(--settings-border);
      }

      [data-theme="neo-brutalism"] .settings-tab-nav-button {
        border: 3px solid var(--settings-border);
        border-radius: 0;
        font-weight: 900;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        box-shadow: 0 5px 0 rgba(0, 0, 0, 0.15);
        transition: all 0.15s cubic-bezier(0.68, -0.55, 0.265, 1.55);
      }

      [data-theme="neo-brutalism"] .settings-tab-nav-button:hover {
        background: var(--settings-primary-color);
        transform: translate(-2px, -2px);
        box-shadow: 0 7px 0 rgba(0, 0, 0, 0.15);
      }

      [data-theme="neo-brutalism"] .settings-modal-footer {
        background: var(--settings-background);
        border-top: 3px solid var(--settings-border);
      }

      [data-theme="neo-brutalism"] .settings-button {
        border: 3px solid var(--settings-border);
        border-radius: 0;
        font-weight: 900;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        box-shadow: 0 5px 0 rgba(0, 0, 0, 0.15);
        transition: all 0.15s cubic-bezier(0.68, -0.55, 0.265, 1.55);
      }

      [data-theme="neo-brutalism"] .settings-button-primary {
        background: var(--settings-primary-color);
        color: #000000;
        border-color: #000000;
      }

      [data-theme="neo-brutalism"] .settings-button-primary:hover {
        background: var(--settings-primary-hover);
        transform: translate(-2px, -2px);
        box-shadow: 0 7px 0 rgba(0, 0, 0, 0.15);
      }

      [data-theme="neo-brutalism"] .settings-button-secondary {
        background: var(--settings-background);
        color: #000000;
        border-color: #000000;
      }

      [data-theme="neo-brutalism"] .settings-button-secondary:hover {
        background: #FFEA00;
        transform: translate(-2px, -2px);
        box-shadow: 0 7px 0 rgba(0, 0, 0, 0.15);
      }

      /* Fix button text colors for neo-brutalism */
      [data-theme="neo-brutalism"] .settings-button-primary {
        background: var(--settings-primary-color);
        color: #000000 !important;
        border-color: #000000;
      }

      [data-theme="neo-brutalism"] .settings-button-secondary {
        background: var(--settings-background);
        color: #000000 !important;
        border-color: #000000;
      }

      /* ONLY blue buttons get white text - everything else stays black */
      [data-theme="neo-brutalism"] button[style*="background: #2563eb"],
      [data-theme="neo-brutalism"] button[style*="background:#2563eb"],
      [data-theme="neo-brutalism"] button[style*="background-color: #2563eb"],
      [data-theme="neo-brutalism"] button[style*="background-color:#2563eb"],
      [data-theme="neo-brutalism"] .settings-button[style*="background: #2563eb"],
      [data-theme="neo-brutalism"] .settings-button[style*="background:#2563eb"] {
        color: #FFFFFF !important;
        border: 3px solid #000000 !important;
        font-weight: 900 !important;
        text-transform: uppercase !important;
        letter-spacing: 0.05em !important;
        box-shadow: 0 5px 0 rgba(0, 0, 0, 0.15) !important;
      }

      /* Ensure all other text remains black */
      [data-theme="neo-brutalism"] .settings-tab-content p,
      [data-theme="neo-brutalism"] .settings-tab-content div,
      [data-theme="neo-brutalism"] .settings-tab-content span,
      [data-theme="neo-brutalism"] .settings-tab-content label,
      [data-theme="neo-brutalism"] .settings-tab-content input,
      [data-theme="neo-brutalism"] .settings-tab-content select,
      [data-theme="neo-brutalism"] .settings-tab-content textarea {
        color: #000000 !important;
      }

      [data-theme="neo-brutalism"] .settings-form-input,
      [data-theme="neo-brutalism"] .settings-form-select {
        border: 3px solid var(--settings-border);
        border-radius: 0;
        background: var(--settings-background);
        color: #000000;
        font-weight: 700;
        box-shadow: 0 5px 0 rgba(0, 0, 0, 0.15);
      }

      [data-theme="neo-brutalism"] .settings-form-input:focus,
      [data-theme="neo-brutalism"] .settings-form-select:focus {
        border-color: var(--settings-primary-color);
        box-shadow: 0 0 0 4px var(--settings-primary-color), 0 5px 0 rgba(0, 0, 0, 0.15);
      }

      /* Fix select dropdown options for neo-brutalism */
      [data-theme="neo-brutalism"] .settings-form-select option,
      [data-theme="neo-brutalism"] select option {
        background: #FFFFFF !important;
        color: #000000 !important;
      }

      /* Additional neo-brutalism text color fixes */
      [data-theme="neo-brutalism"] .settings-tab-content,
      [data-theme="neo-brutalism"] .settings-tab-content * {
        color: #000000 !important;
      }

      /* Ensure ALL text elements are black - comprehensive override */
      [data-theme="neo-brutalism"] .settings-tab-content p,
      [data-theme="neo-brutalism"] .settings-tab-content div,
      [data-theme="neo-brutalism"] .settings-tab-content span,
      [data-theme="neo-brutalism"] .settings-tab-content label,
      [data-theme="neo-brutalism"] .settings-tab-content input,
      [data-theme="neo-brutalism"] .settings-tab-content select,
      [data-theme="neo-brutalism"] .settings-tab-content textarea,
      [data-theme="neo-brutalism"] .settings-tab-content h1,
      [data-theme="neo-brutalism"] .settings-tab-content h2,
      [data-theme="neo-brutalism"] .settings-tab-content h3,
      [data-theme="neo-brutalism"] .settings-tab-content h4,
      [data-theme="neo-brutalism"] .settings-tab-content h5,
      [data-theme="neo-brutalism"] .settings-tab-content h6,
      [data-theme="neo-brutalism"] .settings-tab-content strong,
      [data-theme="neo-brutalism"] .settings-tab-content em,
      [data-theme="neo-brutalism"] .settings-tab-content small,
      [data-theme="neo-brutalism"] .settings-tab-content code,
      [data-theme="neo-brutalism"] .settings-tab-content pre {
        color: #000000 !important;
      }

      /* Override any inherited white text - exclude theme cards */
      [data-theme="neo-brutalism"] .settings-modal *:not(button[style*="background: #2563eb"]):not(button[style*="background:#2563eb"]):not(.settings-tab-nav-button.active):not(.settings-tab-nav-button.active *):not(.theme-card):not(.theme-card *) {
        color: #000000 !important;
      }

      /* Active navigation button - must come after general override to ensure white text */
      [data-theme="neo-brutalism"] .settings-tab-nav-button.active {
        background: #FFEA00 !important;
        color: #000000 !important;
        border-color: #000000 !important;
      }

      [data-theme="neo-brutalism"] .settings-tab-nav-button.active *,
      [data-theme="neo-brutalism"] .settings-tab-nav-button.active span,
      [data-theme="neo-brutalism"] .settings-tab-nav-button.active .settings-tab-nav-icon {
        color: #000000 !important;
      }

      [data-theme="neo-brutalism"] .settings-tab-nav-button.active:hover {
        background: #FF1744 !important;
        color: #FFFFFF !important;
      }

      [data-theme="neo-brutalism"] .settings-tab-nav-button.active:hover *,
      [data-theme="neo-brutalism"] .settings-tab-nav-button.active:hover span,
      [data-theme="neo-brutalism"] .settings-tab-nav-button.active:hover .settings-tab-nav-icon {
        color: #FFFFFF !important;
      }

      [data-theme="neo-brutalism"] .settings-form-label {
        color: #000000 !important;
        font-weight: 900;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }

      [data-theme="neo-brutalism"] .settings-section-header {
        color: #000000 !important;
        font-weight: 900;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }

      [data-theme="neo-brutalism"] .settings-section-description {
        color: #000000 !important;
        font-weight: 700;
      }

      /* Theme cards - FORCE white background and black text - override ALL other rules */
      [data-theme="neo-brutalism"] .theme-card {
        background: #FFFFFF !important;
        background-color: #FFFFFF !important;
        border-color: #000000 !important;
        color: #000000 !important;
      }

      [data-theme="neo-brutalism"] .theme-card *,
      [data-theme="neo-brutalism"] .theme-card h3,
      [data-theme="neo-brutalism"] .theme-card p,
      [data-theme="neo-brutalism"] .theme-card div:not(:last-child),
      [data-theme="neo-brutalism"] .theme-card span {
        color: #000000 !important;
        background: transparent !important;
        background-color: transparent !important;
      }

      /* Override badge colors for non-active themes */
      [data-theme="neo-brutalism"] .theme-card > div:last-child {
        background: #000000 !important;
        background-color: #000000 !important;
        color: #FFFFFF !important;
      }

      /* Active theme badge should be blue with white text */
      [data-theme="neo-brutalism"] .theme-card[style*="border-color: var(--settings-primary-color)"] > div:last-child,
      [data-theme="neo-brutalism"] .theme-card[style*="border-color:var(--settings-primary-color)"] > div:last-child {
        background: #00D9FF !important;
        background-color: #00D9FF !important;
        color: #FFFFFF !important;
      }

      [data-theme="neo-brutalism"] .settings-form-help {
        color: #000000 !important;
        font-weight: 700;
      }

      [data-theme="neo-brutalism"] .settings-card {
        background: var(--settings-background);
        border: 3px solid var(--settings-border);
        border-radius: 0;
        color: #000000 !important;
      }

      [data-theme="neo-brutalism"] .settings-card * {
        color: #000000 !important;
      }

      /* FINAL OVERRIDE: Force theme cards to white background - must be last to override everything */
      [data-theme="neo-brutalism"] .themes-tab > div > div.theme-card,
      [data-theme="neo-brutalism"] .settings-tab-content .themes-tab > div > div.theme-card,
      [data-theme="neo-brutalism"] .theme-card[style*="background"],
      [data-theme="neo-brutalism"] .theme-card[style*="background-color"] {
        background: #FFFFFF !important;
        background-color: #FFFFFF !important;
      }

      [data-theme="neo-brutalism"] .themes-tab > div > div.theme-card *,
      [data-theme="neo-brutalism"] .settings-tab-content .themes-tab > div > div.theme-card * {
        color: #000000 !important;
      }

      /* Corporate Theme Support */
      [data-theme="corporate"] {
        --settings-primary-color: #2563eb;
        --settings-primary-hover: #1d4ed8;
        --settings-secondary-color: #6c757d;
        --settings-success: #10b981;
        --settings-warning: #f59e0b;
        --settings-error: #ef4444;
        --settings-background: #ffffff;
        --settings-surface: #f8f9fa;
        --settings-surface-hover: #e9ecef;
        --settings-border: #dee2e6;
        --settings-border-light: #ced4da;
        --settings-text: #212529;
        --settings-text-secondary: #6c757d;
        --settings-text-muted: #adb5bd;
        --settings-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
        --settings-shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
        --settings-radius-sm: 0.375rem;
        --settings-radius-md: 0.5rem;
        --settings-radius-lg: 0.75rem;
        --settings-radius-xl: 1rem;
      }

      /* Hacker Theme Support */
      [data-theme="hacker"] {
        --settings-primary-color: #00ff00;
        --settings-primary-hover: #00ffff;
        --settings-secondary-color: #00cc00;
        --settings-success: #00ff00;
        --settings-warning: #ffff00;
        --settings-error: #ff0000;
        --settings-background: #000000;
        --settings-surface: #0a0a0a;
        --settings-surface-hover: #003300;
        --settings-border: #00ff00;
        --settings-border-light: #00ffff;
        --settings-text: #00ff00;
        --settings-text-secondary: #00cc00;
        --settings-text-muted: #008800;
        --settings-shadow: 0 0 10px rgba(0, 255, 0, 0.5), 0 0 20px rgba(0, 255, 0, 0.3);
        --settings-shadow-lg: 0 0 15px rgba(0, 255, 0, 0.8), 0 0 30px rgba(0, 255, 0, 0.5);
        --settings-radius-sm: 0;
        --settings-radius-md: 0;
        --settings-radius-lg: 0;
        --settings-radius-xl: 0;
      }

      [data-theme="hacker"] .settings-modal {
        border: 1px solid var(--settings-border);
        border-radius: 0;
        box-shadow: var(--settings-shadow);
      }

      [data-theme="hacker"] .settings-modal-header {
        background: var(--settings-surface);
        border-bottom: 1px solid var(--settings-border);
        box-shadow: 0 0 10px rgba(0, 255, 0, 0.5);
      }

      [data-theme="hacker"] .settings-modal-title {
        text-shadow: 0 0 10px rgba(0, 255, 0, 0.5);
        font-family: 'Courier New', monospace;
      }

      [data-theme="hacker"] .settings-tab-nav {
        background: var(--settings-surface);
        border-right: 1px solid var(--settings-border);
        box-shadow: 0 0 10px rgba(0, 255, 0, 0.3);
      }

      [data-theme="hacker"] .settings-tab-nav-button {
        border: 1px solid var(--settings-border);
        border-radius: 0;
        font-family: 'Courier New', monospace;
        text-shadow: 0 0 10px rgba(0, 255, 0, 0.5);
        box-shadow: 0 0 5px rgba(0, 255, 0, 0.3);
      }

      [data-theme="hacker"] .settings-tab-nav-button:hover {
        background: var(--settings-surface-hover);
        border-color: var(--settings-border-light);
        color: var(--settings-border-light);
        text-shadow: 0 0 10px rgba(0, 255, 255, 0.5);
        box-shadow: 0 0 10px rgba(0, 255, 255, 0.5);
      }

      [data-theme="hacker"] .settings-tab-nav-button.active {
        background: var(--settings-surface-hover);
        color: var(--settings-border-light);
        border-color: var(--settings-border-light);
      }

      /* Modal Overlay */
      .settings-modal-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.75);
        backdrop-filter: blur(8px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10001;
        opacity: 0;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      }

      /* Modal Container */
      .settings-modal {
        background: var(--settings-background);
        border: 1px solid var(--settings-border);
        border-radius: var(--settings-radius-xl);
        box-shadow: var(--settings-shadow);
        width: 95vw;
        max-width: 900px;
        max-height: 85vh;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        transform: scale(0.95);
        transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      }

      .settings-modal-overlay.show .settings-modal {
        transform: scale(1);
      }

      /* Modal Header */
      .settings-modal-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: var(--settings-spacing-lg);
        border-bottom: 1px solid var(--settings-border);
        background: var(--settings-surface);
      }

      .settings-modal-title {
        margin: 0;
        font-size: 1.5rem;
        font-weight: 700;
        color: var(--settings-text);
        letter-spacing: -0.025em;
      }

      .settings-modal-close {
        background: var(--settings-surface-hover);
        border: 1px solid var(--settings-border);
        width: 32px;
        height: 32px;
        border-radius: var(--settings-radius-md);
        cursor: pointer;
        color: var(--settings-text-secondary);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.25rem;
        transition: all 0.2s ease;
      }

      .settings-modal-close:hover {
        background: var(--settings-surface);
      }

      /* Modal Body */
      .settings-modal-body {
        display: flex;
        flex: 1;
        overflow: hidden;
      }

      /* Tab Navigation */
      .settings-tab-nav {
        width: 240px;
        background: var(--settings-surface);
        border-right: 1px solid var(--settings-border);
        overflow-y: auto;
      }

      .settings-tab-nav-list {
        list-style: none;
        margin: 0;
        padding: var(--settings-spacing-md);
      }

      .settings-tab-nav-item {
        margin-bottom: var(--settings-spacing-sm);
      }

      .settings-tab-nav-button {
        width: 100%;
        display: flex;
        align-items: center;
        gap: var(--settings-spacing-md);
        padding: var(--settings-spacing-sm) var(--settings-spacing-md);
        background: none;
        border: 1px solid transparent;
        border-radius: var(--settings-radius-lg);
        cursor: pointer;
        text-align: left;
        color: var(--settings-text-secondary);
        font-weight: 500;
        font-size: 0.95rem;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        position: relative;
      }

      .settings-tab-nav-button:hover {
        background: var(--settings-surface-hover);
        color: var(--settings-text);
        border-color: var(--settings-border-light);
      }

      .settings-tab-nav-button.active {
        background: var(--settings-primary-color);
        color: #000000;
        border-color: var(--settings-primary-color);
        font-weight: 600;
      }

      .settings-tab-nav-button.active::before {
        content: '';
        position: absolute;
        left: 0;
        top: 50%;
        transform: translateY(-50%);
        width: 3px;
        height: 20px;
        background: var(--settings-primary-color);
        border-radius: 0 2px 2px 0;
      }

      .settings-tab-nav-icon {
        font-size: 1.125rem;
        opacity: 0.8;
      }

      .settings-tab-nav-button.active .settings-tab-nav-icon {
        opacity: 1;
      }

      /* Tab Content */
      .settings-tab-content {
        flex: 1;
        padding: var(--settings-spacing-lg);
        overflow-y: auto;
        background: var(--settings-background);
      }

      /* Modal Footer */
      .settings-modal-footer {
        display: flex;
        justify-content: flex-end;
        gap: var(--settings-spacing-md);
        padding: var(--settings-spacing-lg);
        border-top: 1px solid var(--settings-border);
        background: var(--settings-surface);
      }

      /* Buttons */
      .settings-button {
        padding: var(--settings-spacing-sm) var(--settings-spacing-lg);
        border-radius: var(--settings-radius-lg);
        font-weight: 600;
        font-size: 0.875rem;
        cursor: pointer;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        border: 1px solid transparent;
        letter-spacing: 0.025em;
      }

      .settings-button-primary {
        background: var(--settings-primary-color);
        color: #000000;
        border-color: var(--settings-primary-color);
        box-shadow: 0 1px 3px rgba(255, 255, 255, 0.1);
      }

      .settings-button-primary:hover {
        background: var(--settings-primary-hover);
        border-color: var(--settings-primary-hover);
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(255, 255, 255, 0.15);
      }

      .settings-button-primary:disabled {
        opacity: 0.5;
        cursor: not-allowed;
        transform: none;
        box-shadow: none;
      }

      .settings-button-secondary {
        background: var(--settings-surface-hover);
        color: var(--settings-text);
        border-color: var(--settings-border);
      }

      .settings-button-secondary:hover {
        background: var(--settings-surface);
        border-color: var(--settings-border-light);
        transform: translateY(-1px);
      }

      /* Form Elements */
      .settings-form-group {
        margin-bottom: var(--settings-spacing-lg);
      }

      .settings-form-label {
        display: block;
        margin-bottom: var(--settings-spacing-sm);
        font-weight: 600;
        font-size: 0.875rem;
        color: var(--settings-text);
        letter-spacing: 0.025em;
      }

      .settings-form-input, .settings-form-select {
        width: 100%;
        padding: var(--settings-spacing-md);
        border: 1px solid var(--settings-border);
        border-radius: var(--settings-radius-lg);
        background: var(--settings-surface);
        color: var(--settings-text);
        font-size: 0.875rem;
        transition: all 0.2s ease;
      }

      .settings-form-input:focus, .settings-form-select:focus {
        outline: none;
        border-color: var(--settings-primary-color);
        background: var(--settings-background);
        box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.1);
      }

      .settings-form-input::placeholder {
        color: var(--settings-text-muted);
      }

      /* Language Library tab (internal language tabs + substitution list) */
      .language-library-lang-tabs {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--settings-spacing-sm);
        margin: 0 0 var(--settings-spacing-lg) 0;
      }

      .language-library-lang-tab {
        position: relative;
        display: inline-flex;
        align-items: center;
        gap: var(--settings-spacing-sm);
        padding: var(--settings-spacing-sm) var(--settings-spacing-md);
        border: 1px solid var(--settings-border);
        background: var(--settings-surface);
        color: var(--settings-text-secondary);
        border-radius: var(--settings-radius-lg);
        cursor: pointer;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        font-weight: 600;
      }

      .language-library-lang-tab:hover {
        background: var(--settings-surface-hover);
        color: var(--settings-text);
        border-color: var(--settings-border-light);
      }

      .language-library-lang-tab.active {
        background: var(--settings-primary-color);
        color: #000000;
        border-color: var(--settings-primary-color);
      }

      .language-library-lang-tab-close {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 18px;
        height: 18px;
        border-radius: var(--settings-radius-md);
        margin-left: var(--settings-spacing-xs);
        color: inherit;
        opacity: 0.85;
      }

      .language-library-lang-tab:hover .language-library-lang-tab-close {
        opacity: 1;
      }

      .language-library-lang-tab-close:hover {
        background: rgba(0, 0, 0, 0.15);
      }

      .language-library-lang-tab.active .language-library-lang-tab-close:hover {
        background: rgba(0, 0, 0, 0.2);
      }

      .language-library-lang-tab-add {
        display: inline-flex;
        align-items: center;
        gap: var(--settings-spacing-sm);
      }

      .language-library-plus {
        padding: var(--settings-spacing-sm) var(--settings-spacing-md);
        border-radius: var(--settings-radius-lg);
        border: 1px solid var(--settings-border);
        background: var(--settings-surface);
        color: var(--settings-text);
        cursor: pointer;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        font-weight: 600;
      }

      .language-library-plus:hover:not(:disabled) {
        background: var(--settings-surface-hover);
        border-color: var(--settings-border-light);
      }

      .language-library-plus:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .language-library-lang-picker {
        padding: var(--settings-spacing-sm) var(--settings-spacing-md);
        border-radius: var(--settings-radius-lg);
        border: 1px solid var(--settings-border);
        background: var(--settings-surface);
        color: var(--settings-text);
      }

      .language-library-entries {
        margin-top: var(--settings-spacing-md);
        border: 1px solid var(--settings-border);
        border-radius: var(--settings-radius-xl);
        background: var(--settings-surface);
        padding: var(--settings-spacing-lg);
      }

      .language-library-subtitle {
        font-weight: 600;
        color: var(--settings-text);
        margin-bottom: var(--settings-spacing-md);
      }

      .language-library-table {
        display: flex;
        flex-direction: column;
        gap: var(--settings-spacing-sm);
      }

      .language-library-row {
        display: grid;
        grid-template-columns: 1fr 1fr auto;
        gap: var(--settings-spacing-sm);
        align-items: center;
      }

      .language-library-header .language-library-cell {
        font-size: 0.8rem;
        color: var(--settings-text-muted);
        font-weight: 600;
        letter-spacing: 0.02em;
      }

      .language-library-input {
        width: 100%;
      }

      .language-library-actions-row {
        margin-top: var(--settings-spacing-lg);
        display: flex;
        justify-content: flex-start;
      }

      .language-library-tip {
        margin-top: var(--settings-spacing-md);
        font-size: 0.85rem;
        color: var(--settings-text-secondary);
        line-height: 1.4;
      }

      /* Section Headers */
      .settings-section-header {
        font-size: 1.125rem;
        font-weight: 700;
        color: var(--settings-text);
        margin: 0 0 var(--settings-spacing-md) 0;
        letter-spacing: -0.025em;
      }

      .settings-section-description {
        color: var(--settings-text-secondary);
        font-size: 0.875rem;
        line-height: 1.5;
        margin: 0 0 var(--settings-spacing-lg) 0;
      }

      /* Help Text */
      .settings-form-help {
        display: block;
        margin-top: var(--settings-spacing-xs);
        font-size: 0.75rem;
        color: var(--settings-text-muted);
        line-height: 1.4;
      }

      .settings-form-success {
        color: var(--settings-success);
      }

      /* Card-like containers */
      .settings-card {
        background: var(--settings-surface);
        border: 1px solid var(--settings-border);
        border-radius: var(--settings-radius-lg);
        padding: var(--settings-spacing-lg);
        margin-bottom: var(--settings-spacing-lg);
      }

      /* Loading Spinner */
      .settings-spinner {
        display: inline-block;
        width: 1rem;
        height: 1rem;
        border: 2px solid transparent;
        border-top: 2px solid currentColor;
        border-radius: 50%;
        animation: settings-spin 1s linear infinite;
        margin-right: var(--settings-spacing-sm);
      }

      @keyframes settings-spin {
        to {
          transform: rotate(360deg);
        }
      }

      /* Message Styles */
      .settings-validation-errors,
      .settings-save-success,
      .settings-save-error {
        padding: var(--settings-spacing-md);
        margin: var(--settings-spacing-md);
        border-radius: var(--settings-radius-md);
        font-size: 0.875rem;
      }

      .settings-validation-errors,
      .settings-save-error {
        background: var(--settings-error);
        color: white;
      }

      .settings-save-success {
        background: var(--settings-success);
        color: white;
      }

      /* Responsive Design */
      @media (max-width: 768px) {
        .settings-modal {
          width: 95vw;
          max-height: 95vh;
        }

        .settings-modal-body {
          flex-direction: column;
        }

        .settings-tab-nav {
          width: 100%;
          max-height: 150px;
        }

        .settings-tab-nav-list {
          display: flex;
          overflow-x: auto;
          padding: var(--settings-spacing-sm);
        }

        .settings-tab-nav-item {
          flex-shrink: 0;
          margin-right: var(--settings-spacing-sm);
          margin-bottom: 0;
        }

        .settings-tab-nav-button {
          white-space: nowrap;
        }
      }

      /* Blur and darken sidebar when settings modal is open */
      body.settings-modal-open .sidebar {
        filter: blur(4px) brightness(0.5);
        transition: filter 0.3s ease;
      }
    `;
  }

  /**
   * Handle keyboard events
   */
  private handleKeyDown(event: KeyboardEvent): void {
    switch (event.key) {
      case 'Escape':
        event.preventDefault();
        this.hide();
        break;
      
      case 'Tab':
        // Trap focus within modal
        this.trapFocus(event);
        break;
    }
  }

  /**
   * Trap focus within the modal for accessibility
   */
  private trapFocus(event: KeyboardEvent): void {
    if (!this.modalElement) {
      return;
    }

    const focusableElements = this.modalElement.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    
    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    if (event.shiftKey) {
      // Shift + Tab
      if (document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      }
    } else {
      // Tab
      if (document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }
  }

  /**
   * Handle overlay clicks (close modal when clicking outside)
   */
  private handleOverlayClick(event: MouseEvent): void {
    if (event.target === this.overlayElement) {
      this.hide();
    }
  }

  /**
   * Focus the modal for accessibility
   */
  private focusModal(): void {
    if (this.modalElement) {
      this.modalElement.focus();
    }
  }

  /**
   * Save the currently active tab
   */
  public async saveCurrentTab(): Promise<boolean> {
    const saveButton = document.querySelector('.settings-button-primary') as HTMLButtonElement;
    const originalText = saveButton?.textContent || 'Save';
    
    try {
      // Check if there's an active tab
      if (!this.activeTab) {
        console.warn('No active tab to save');
        return false;
      }

      // Show loading state
      if (saveButton) {
        saveButton.disabled = true;
        saveButton.innerHTML = '<span class="settings-spinner"></span>Saving...';
      }

      // Validate the current tab
      if (!this.activeTab.validate()) {
        const errors = this.activeTab.getValidationErrors();
        this.showValidationErrors(errors);
        return false;
      }

      // Save the current tab
      const saved = await this.activeTab.onSave();

      if (saved) {
        // Save successful
        this.showSaveSuccess();
        
        // Close modal after a brief delay
        setTimeout(() => {
          this.hide();
        }, 1000);
        return true;
      } else {
        // Some saves failed
        this.showSaveError('Some settings could not be saved. Please try again.');
        return false;
      }

    } catch (error) {
      console.error('Error saving settings:', error);
      this.showSaveError('An unexpected error occurred while saving settings.');
      return false;
    } finally {
      // Restore button state
      if (saveButton) {
        saveButton.disabled = false;
        saveButton.textContent = originalText;
      }
    }
  }

  /**
   * Save all tabs (for backwards compatibility with tests)
   * @deprecated Use saveCurrentTab() instead for UI interactions
   */
  public async saveAllTabs(): Promise<boolean> {
    // Delegate to saveCurrentTab for now
    return this.saveCurrentTab();
  }

  /**
   * Show validation errors to the user
   */
  private showValidationErrors(errors: string[]): void {
    // Remove existing error display
    const existingError = this.modalElement?.querySelector('.settings-validation-errors');
    if (existingError) {
      existingError.remove();
    }

    // Create error display
    const errorContainer = document.createElement('div');
    errorContainer.className = 'settings-validation-errors';
    errorContainer.style.cssText = `
      background: var(--settings-error);
      color: white;
      padding: var(--settings-spacing-md);
      margin: var(--settings-spacing-md);
      border-radius: var(--settings-radius-md);
      font-size: 0.875rem;
    `;

    const errorTitle = document.createElement('div');
    errorTitle.style.fontWeight = 'bold';
    errorTitle.textContent = 'Please fix the following errors:';
    errorContainer.appendChild(errorTitle);

    const errorList = document.createElement('ul');
    errorList.style.cssText = 'margin: 0.5rem 0 0 1rem; padding: 0;';
    
    errors.forEach(error => {
      const listItem = document.createElement('li');
      listItem.textContent = error;
      errorList.appendChild(listItem);
    });

    errorContainer.appendChild(errorList);

    // Insert before footer
    const footer = this.modalElement?.querySelector('.settings-modal-footer');
    if (footer) {
      this.modalElement?.insertBefore(errorContainer, footer);
    }

    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (errorContainer.parentNode) {
        errorContainer.parentNode.removeChild(errorContainer);
      }
    }, 5000);
  }

  /**
   * Show save success message
   */
  private showSaveSuccess(): void {
    const successContainer = document.createElement('div');
    successContainer.className = 'settings-save-success';
    successContainer.style.cssText = `
      background: var(--settings-success);
      color: white;
      padding: var(--settings-spacing-md);
      margin: var(--settings-spacing-md);
      border-radius: var(--settings-radius-md);
      font-size: 0.875rem;
      text-align: center;
    `;
    successContainer.textContent = 'Settings saved successfully!';

    // Insert before footer
    const footer = this.modalElement?.querySelector('.settings-modal-footer');
    if (footer) {
      this.modalElement?.insertBefore(successContainer, footer);
    }
  }

  /**
   * Show save error message
   */
  private showSaveError(message: string): void {
    const errorContainer = document.createElement('div');
    errorContainer.className = 'settings-save-error';
    errorContainer.style.cssText = `
      background: var(--settings-error);
      color: white;
      padding: var(--settings-spacing-md);
      margin: var(--settings-spacing-md);
      border-radius: var(--settings-radius-md);
      font-size: 0.875rem;
      text-align: center;
    `;
    errorContainer.textContent = message;

    // Insert before footer
    const footer = this.modalElement?.querySelector('.settings-modal-footer');
    if (footer) {
      this.modalElement?.insertBefore(errorContainer, footer);
    }

    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (errorContainer.parentNode) {
        errorContainer.parentNode.removeChild(errorContainer);
      }
    }, 5000);
  }

  /**
   * Switch to a specific tab
   */
  public switchTab(tabId: string): void {
    const tabDefinition = this.registeredTabs.get(tabId);
    if (!tabDefinition) {
      console.warn(`Tab with id "${tabId}" not found`);
      return;
    }

    // Deactivate current tab
    if (this.activeTab) {
      this.activeTab.onDeactivate();
    }

    // Create new tab instance
    const newTab = new tabDefinition.component();

    // Clear content area and render new tab
    if (this.tabContentElement) {
      this.tabContentElement.innerHTML = '';
      const tabContent = newTab.render();
      this.tabContentElement.appendChild(tabContent);
    }

    // Update active tab
    this.activeTab = newTab;
    this.activeTabId = tabId;

    // Activate new tab
    newTab.onActivate();

    // Special handling for API Keys tab to ensure proper refresh
    if (tabId === 'api-keys' && typeof (newTab as any).forceRefresh === 'function') {
      // Small delay to ensure DOM is ready, then force refresh to fix any UI glitches
      setTimeout(() => {
        (newTab as any).forceRefresh().catch((error: any) => {
          console.error('Error during API Keys tab force refresh:', error);
        });
      }, 100);
    }

    // Update navigation UI
    this.updateTabNavigation();

    // Hide footer for keybinds tab (auto-save)
    this.updateFooterVisibility(tabId);
  }

  /**
   * Update footer visibility based on active tab
   */
  private updateFooterVisibility(tabId: string): void {
    const footer = this.modalElement?.querySelector('.settings-modal-footer') as HTMLElement;
    if (!footer) {
      return;
    }

    // Hide footer for keybinds tab (auto-save functionality)
    if (tabId === 'keybinds') {
      footer.style.display = 'none';
    } else {
      footer.style.display = 'flex';
    }
  }

  /**
   * Register a tab
   */
  public registerTab(definition: TabDefinition): void {
    this.registeredTabs.set(definition.id, definition);
    
    // If modal is already visible, update navigation
    if (this.isVisible && this.tabNavElement) {
      this.renderTabNavigation();
    }
  }

  /**
   * Unregister a tab
   */
  public unregisterTab(tabId: string): void {
    this.registeredTabs.delete(tabId);
    
    // If this was the active tab, switch to another
    if (this.activeTabId === tabId) {
      const remainingTabs = Array.from(this.registeredTabs.values())
        .sort((a, b) => a.order - b.order);
      
      if (remainingTabs.length > 0) {
        this.switchTab(remainingTabs[0].id);
      } else {
        this.activeTab = null;
        this.activeTabId = null;
        if (this.tabContentElement) {
          this.tabContentElement.innerHTML = '';
        }
      }
    }
    
    // Update navigation if modal is visible
    if (this.isVisible && this.tabNavElement) {
      this.renderTabNavigation();
    }
  }

  /**
   * Get all registered tabs
   */
  public getRegisteredTabs(): TabDefinition[] {
    return Array.from(this.registeredTabs.values())
      .sort((a, b) => a.order - b.order);
  }

  /**
   * Render tab navigation
   */
  private renderTabNavigation(): void {
    if (!this.tabNavElement) {
      return;
    }

    const navList = this.tabNavElement.querySelector('.settings-tab-nav-list');
    if (!navList) {
      return;
    }

    // Clear existing navigation
    navList.innerHTML = '';

    // Get sorted tabs
    const sortedTabs = this.getRegisteredTabs();

    // Create navigation items
    sortedTabs.forEach(tab => {
      const listItem = document.createElement('li');
      listItem.className = 'settings-tab-nav-item';

      const button = document.createElement('button');
      button.className = 'settings-tab-nav-button';
      button.setAttribute('role', 'tab');
      button.setAttribute('aria-selected', 'false');
      button.setAttribute('aria-controls', `tab-panel-${tab.id}`);
      button.setAttribute('id', `tab-${tab.id}`);
      button.setAttribute('tabindex', '-1');

      // Add icon if provided
      if (tab.icon) {
        const icon = document.createElement('span');
        icon.className = 'settings-tab-nav-icon';
        icon.innerHTML = tab.icon;
        button.appendChild(icon);
      }

      // Add title
      const title = document.createElement('span');
      title.textContent = tab.title;
      button.appendChild(title);

      // Add click handler
      button.addEventListener('click', () => {
        this.switchTab(tab.id);
      });

      // Add keyboard navigation
      button.addEventListener('keydown', (event) => {
        this.handleTabKeyDown(event, tab.id);
      });

      listItem.appendChild(button);
      navList.appendChild(listItem);
    });

    // Update active state
    this.updateTabNavigation();
  }

  /**
   * Update tab navigation active state
   */
  private updateTabNavigation(): void {
    if (!this.tabNavElement || !this.activeTabId) {
      return;
    }

    // Remove active class from all buttons
    const buttons = this.tabNavElement.querySelectorAll('.settings-tab-nav-button');
    buttons.forEach(button => {
      button.classList.remove('active');
      button.setAttribute('aria-selected', 'false');
      button.setAttribute('tabindex', '-1');
    });

    // Add active class to current tab
    const activeButton = this.tabNavElement.querySelector(`#tab-${this.activeTabId}`);
    if (activeButton) {
      activeButton.classList.add('active');
      activeButton.setAttribute('aria-selected', 'true');
      activeButton.setAttribute('tabindex', '0');
    }

    // Update content panel attributes
    if (this.tabContentElement) {
      this.tabContentElement.setAttribute('aria-labelledby', `tab-${this.activeTabId}`);
      this.tabContentElement.setAttribute('id', `tab-panel-${this.activeTabId}`);
    }
  }

  /**
   * Handle keyboard navigation in tabs
   */
  private handleTabKeyDown(event: KeyboardEvent, tabId: string): void {
    const tabs = this.getRegisteredTabs();
    const currentIndex = tabs.findIndex(tab => tab.id === tabId);
    
    let targetIndex = currentIndex;

    switch (event.key) {
      case 'ArrowLeft':
      case 'ArrowUp':
        event.preventDefault();
        targetIndex = currentIndex > 0 ? currentIndex - 1 : tabs.length - 1;
        break;
      
      case 'ArrowRight':
      case 'ArrowDown':
        event.preventDefault();
        targetIndex = currentIndex < tabs.length - 1 ? currentIndex + 1 : 0;
        break;
      
      case 'Home':
        event.preventDefault();
        targetIndex = 0;
        break;
      
      case 'End':
        event.preventDefault();
        targetIndex = tabs.length - 1;
        break;
      
      case 'Enter':
      case ' ':
        event.preventDefault();
        this.switchTab(tabId);
        return;
      
      default:
        return;
    }

    // Focus and activate the target tab
    if (tabs[targetIndex]) {
      const targetButton = this.tabNavElement?.querySelector(`#tab-${tabs[targetIndex].id}`) as HTMLElement;
      if (targetButton) {
        targetButton.focus();
      }
    }
  }

  /**
   * Load the run in background state from config into class variable
   */
  private async loadRunInBackgroundState(): Promise<void> {
    try {
      const response = await (window as any).electronAPI.invoke('config:get', {
        id: Date.now().toString(),
        timestamp: Date.now(),
        payload: { keys: ['uiSettings'] }
      });
      
      console.log('[SettingsModal] Config response:', response);
      console.log('[SettingsModal] Full payload:', JSON.stringify(response.payload, null, 2));
      
      // The config:get handler returns the full config in payload
      const uiSettings = response.payload?.uiSettings;
      const runInBackground = uiSettings?.runInBackground;
      
      console.log('[SettingsModal] uiSettings:', uiSettings);
      console.log('[SettingsModal] runInBackground value:', runInBackground);
      
      if (response.success) {
        // Default to false (OFF) if not explicitly set
        this.runInBackgroundState = runInBackground ?? false;
        console.log('[SettingsModal] Loaded runInBackgroundState:', this.runInBackgroundState);
      } else {
        this.runInBackgroundState = false;
        console.log('[SettingsModal] Config request failed, defaulting to false');
      }
    } catch (error) {
      console.error('Failed to load background state:', error);
      // Default to disabled (OFF) on error
      this.runInBackgroundState = false;
    }
  }

  /**
   * Handle background toggle click
   */
  private async handleBackgroundToggle(toggleSwitch: HTMLElement, toggleHandle: HTMLElement): Promise<void> {
    try {
      // Use the ACTUAL saved state from class variable, not the DOM attribute
      const currentState = this.runInBackgroundState;
      const newState = !currentState;
      
      console.log('[SettingsModal] Toggle clicked - current saved state:', currentState, 'new state:', newState);

      // Update UI immediately for responsiveness
      this.updateToggleUI(toggleSwitch, toggleHandle, newState);
      
      // Update internal state
      this.runInBackgroundState = newState;

      // Save to configuration
      const response = await (window as any).electronAPI.invoke('config:set', {
        id: Date.now().toString(),
        timestamp: Date.now(),
        payload: {
          uiSettings: {
            runInBackground: newState
          }
        }
      });
      
      console.log('[SettingsModal] Save response:', response);

      if (!response.success) {
        console.error('Failed to save background toggle state:', response.error);
        // Revert UI and internal state on error
        this.runInBackgroundState = currentState;
        this.updateToggleUI(toggleSwitch, toggleHandle, currentState);
      }
    } catch (error) {
      console.error('Failed to toggle background setting:', error);
      // Revert UI and internal state on error
      const currentState = this.runInBackgroundState;
      this.updateToggleUI(toggleSwitch, toggleHandle, currentState);
    }
  }

  /**
   * Apply current theme to modal elements
   */
  private applyCurrentTheme(): void {
    if (!this.overlayElement || !this.modalElement) {
      return;
    }

    // Get current theme from document
    const currentTheme = document.documentElement.getAttribute('data-theme') || 
                        document.body.getAttribute('data-theme') || 
                        'default';

    // Apply theme to overlay and modal
    this.overlayElement.setAttribute('data-theme', currentTheme);
    this.modalElement.setAttribute('data-theme', currentTheme);

    console.log('[SettingsModal] Applied theme:', currentTheme);
  }

  /**
   * Update the toggle UI to reflect the current state
   */
  private updateToggleUI(toggleSwitch: HTMLElement, toggleHandle: HTMLElement, isEnabled: boolean): void {
    console.log('[SettingsModal] updateToggleUI called with isEnabled:', isEnabled);
    
    if (isEnabled) {
      toggleSwitch.style.background = '#3b82f6';
      toggleHandle.style.left = '20px';
      toggleHandle.style.background = 'white';
      toggleHandle.style.transform = 'scale(1)';
      toggleSwitch.setAttribute('aria-checked', 'true');
      console.log('[SettingsModal] Toggle UI set to ON (blue with white handle on right)');
    } else {
      toggleSwitch.style.background = 'var(--settings-border)';
      toggleHandle.style.left = '2px';
      toggleHandle.style.background = '#9ca3af';
      toggleHandle.style.transform = 'scale(0.9)';
      toggleSwitch.setAttribute('aria-checked', 'false');
      console.log('[SettingsModal] Toggle UI set to OFF (grey with grey handle on left)');
    }
  }
}