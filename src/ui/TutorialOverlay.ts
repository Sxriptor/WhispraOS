/**
 * Guided Tutorial Overlay System
 * Provides step-by-step onboarding for new users
 */

import { getTranslations } from '../renderer/i18n.js';

interface TutorialStep {
  id: string;
  title: string;
  message: string;
  targetSelector?: string;
  action?: () => Promise<void> | void;
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
}

export class TutorialOverlay {
  private static instance: TutorialOverlay | null = null;
  private overlayElement: HTMLElement | null = null;
  private tutorialBox: HTMLElement | null = null;
  private highlightElement: HTMLElement | null = null;
  private currentStepIndex: number = 0;
  private isActive: boolean = false;
  private steps: TutorialStep[] = [];
  private previousOverflow: string = '';
  private translations: any = {};

  private constructor() {
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleOverlayClick = this.handleOverlayClick.bind(this);
    this.loadTranslations();
  }

  public static getInstance(): TutorialOverlay {
    if (!TutorialOverlay.instance) {
      TutorialOverlay.instance = new TutorialOverlay();
    }
    return TutorialOverlay.instance;
  }

  /**
   * Load translations based on current language
   */
  private loadTranslations(): void {
    // Get current language from window global or default to 'en'
    const currentLanguage = (window as any).currentLanguage || 'en';
    this.translations = getTranslations(currentLanguage);
  }

  /**
   * Reload translations (call this when language changes)
   */
  public reloadTranslations(): void {
    this.loadTranslations();
    if (this.isActive) {
      // Refresh current step with new translations
      this.initializeSteps();
      this.showStep(this.currentStepIndex);
    }
  }

  /**
   * Initialize tutorial steps
   */
  private initializeSteps(): void {
    const t = this.translations.tutorial || {};
    
    this.steps = [
      {
        id: 'welcome',
        title: t.welcome?.title || 'Welcome to Whispra!',
        message: t.welcome?.message || "Welcome to the app! Let's quickly walk through the main interface.",
        position: 'center'
      },
      {
        id: 'sidebar',
        title: t.sidebar?.title || 'Left Sidebar Navigation',
        message: t.sidebar?.message || 'This is your main navigation bar. Use it to switch between different features like Whispra Translate, Screen Translation, Quick Translate, and more.',
        targetSelector: '#app-sidebar',
        position: 'right'
      },
      {
        id: 'whispra-translate-tab',
        title: t.whispraTranslateTab?.title || 'Whispra Translate Tab',
        message: t.whispraTranslateTab?.message || 'The Whispra Translate tab combines real-time translation and bidirectional mode in one unified interface. Use the left panel for one-way translation and the right panel for bidirectional conversations. Start speaking and watch your words get translated instantly.',
        targetSelector: '#sidebar-whispra-translate-button',
        position: 'right',
        action: async () => {
          // Switch to whispra translate tab
          const switchTabFn = (window as any).switchTab;
          if (typeof switchTabFn === 'function') {
            switchTabFn('whispra-translate');
            await new Promise(resolve => setTimeout(resolve, 200));
          }
        }
      },
      {
        id: 'screen-translation-tab',
        title: t.screenTranslationTab?.title || 'Screen Translation',
        message: t.screenTranslationTab?.message || 'Screen Translation captures text from your screen and translates it in real-time. Great for translating content from games, videos, or applications.',
        targetSelector: '#sidebar-screen-translation-button',
        position: 'right',
        action: async () => {
          const switchTabFn = (window as any).switchTab;
          if (typeof switchTabFn === 'function') {
            switchTabFn('screen-translation');
            await new Promise(resolve => setTimeout(resolve, 200));
          }
        }
      },
      {
        id: 'quick-translate-tab',
        title: t.quickTranslateTab?.title || 'Quick Translate',
        message: t.quickTranslateTab?.message || 'Quick Translate gives you instant translation with a keyboard shortcut. Press Alt+C to translate selected text quickly.',
        targetSelector: '#sidebar-quick-translate-button',
        position: 'right',
        action: async () => {
          const switchTabFn = (window as any).switchTab;
          if (typeof switchTabFn === 'function') {
            switchTabFn('quick-translate');
            await new Promise(resolve => setTimeout(resolve, 200));
          }
        }
      },
      {
        id: 'sound-board-tab',
        title: t.soundBoardTab?.title || 'Sound Board',
        message: t.soundBoardTab?.message || 'The Sound Board lets you play audio clips instantly. Perfect for quick responses or sound effects during conversations.',
        targetSelector: '#sidebar-sound-board-button',
        position: 'right',
        action: async () => {
          const switchTabFn = (window as any).switchTab;
          if (typeof switchTabFn === 'function') {
            switchTabFn('sound-board');
            await new Promise(resolve => setTimeout(resolve, 200));
          }
        }
      },
      {
        id: 'profile',
        title: t.profile?.title || 'Profile Section',
        message: t.profile?.message || 'Access your profile settings, account information, and sign out from here.',
        targetSelector: '#profile-button',
        position: 'bottom'
      },
      {
        id: 'settings',
        title: t.settings?.title || 'Settings Menu',
        message: t.settings?.message || 'Click the settings button in the sidebar to access all application settings. We\'ll show you what\'s inside next.',
        targetSelector: '#sidebar-settings-button',
        position: 'right',
        action: async () => {
          // Import dynamically to avoid circular dependencies
          const { SettingsIntegration } = await import('./settings/SettingsIntegration.js');
          const settingsIntegration = SettingsIntegration.getInstance();
          settingsIntegration.showSettings('api-keys');
          // Wait for modal to open
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      },
      {
        id: 'api-keys',
        title: t.apiKeys?.title || 'API Keys Configuration',
        message: t.apiKeys?.message || 'Configure your API keys here. You\'ll need keys for OpenAI (Whisper), translation services, and ElevenLabs for voice synthesis.',
        targetSelector: '.settings-tab-nav-button',
        position: 'right',
        action: async () => {
          await new Promise(resolve => setTimeout(resolve, 500));
          const { SettingsIntegration } = await import('./settings/SettingsIntegration.js');
          const settingsIntegration = SettingsIntegration.getInstance();
          const settingsModal = settingsIntegration.getSettingsModal();
          if (settingsModal && typeof settingsModal.switchTab === 'function') {
            settingsModal.switchTab('api-keys');
            await new Promise(resolve => setTimeout(resolve, 200));
          }
        }
      },
      {
        id: 'keybinds',
        title: t.keybinds?.title || 'Keyboard Shortcuts',
        message: t.keybinds?.message || 'This is where you can configure keyboard shortcuts for quick actions. Customize your hotkeys to suit your workflow.',
        targetSelector: '.settings-tab-nav-button',
        position: 'right',
        action: async () => {
          // Wait for settings modal to be ready
          await new Promise(resolve => setTimeout(resolve, 500));
          const { SettingsIntegration } = await import('./settings/SettingsIntegration.js');
          const settingsIntegration = SettingsIntegration.getInstance();
          const settingsModal = settingsIntegration.getSettingsModal();
          if (settingsModal && typeof settingsModal.switchTab === 'function') {
            settingsModal.switchTab('keybinds');
            await new Promise(resolve => setTimeout(resolve, 200));
          }
        }
      },
      {
        id: 'models',
        title: t.models?.title || 'Models & Processing',
        message: t.models?.message || 'Here you can select AI models and adjust processing options. Choose between cloud and local processing, and fine-tune model parameters.',
        targetSelector: '.settings-tab-nav-button',
        position: 'right',
        action: async () => {
          const { SettingsIntegration } = await import('./settings/SettingsIntegration.js');
          const settingsIntegration = SettingsIntegration.getInstance();
          const settingsModal = settingsIntegration.getSettingsModal();
          if (settingsModal && typeof settingsModal.switchTab === 'function') {
            settingsModal.switchTab('models');
            await new Promise(resolve => setTimeout(resolve, 200));
          }
        }
      },
      
      {
        id: 'account-settings',
        title: t.accountSettings?.title || 'Account & Background Settings',
        message: t.accountSettings?.message || 'In the Account tab, you can configure system tray behavior and Paddle warmup settings. Enable "Run in Background" to minimize Whispra to the system tray instead of closing it completely.',
        targetSelector: '.settings-tab-nav-button',
        position: 'right',
        action: async () => {
          const { SettingsIntegration } = await import('./settings/SettingsIntegration.js');
          const settingsIntegration = SettingsIntegration.getInstance();
          const settingsModal = settingsIntegration.getSettingsModal();
          if (settingsModal && typeof settingsModal.switchTab === 'function') {
            settingsModal.switchTab('account');
            await new Promise(resolve => setTimeout(resolve, 200));
          }
        }
      },
      {
        id: 'screen-box-selector',
        title: t.screenBoxSelector?.title || 'Screen Box Selector',
        message: t.screenBoxSelector?.message || 'Use Alt+Y (default hotkey) to activate the screen box selector. This lets you select specific areas of your screen for targeted translation instead of translating the entire screen.',
        targetSelector: '#sidebar-whispra-translate-button',
        position: 'center',
        action: async () => {
          // Switch to whispra translate tab
          const switchTabFn = (window as any).switchTab;
          if (typeof switchTabFn === 'function') {
            switchTabFn('whispra-translate');
            await new Promise(resolve => setTimeout(resolve, 200));
          }
        }
      },
      {
        id: 'paddle-warmup',
        title: t.paddleWarmup?.title || 'Paddle Warmup Feature',
        message: t.paddleWarmup?.message || 'Enable "Paddle Warmup on Startup" to pre-load OCR models when the app starts. This makes screen translation faster but increases startup time. You can find this toggle in the Account settings tab.',
        position: 'center'
      },
      {
        id: 'system-tray',
        title: t.systemTray?.title || 'System Tray Integration',
        message: t.systemTray?.message || 'When "Run in Background" is enabled, closing the main window will minimize Whispra to your system tray instead of quitting. Click the tray icon to restore the window, or right-click for quick actions.',
        position: 'center'
      },
      {
        id: 'expanded-overlay',
        title: t.expandedOverlay?.title || 'Expanded Overlay',
        message: t.expandedOverlay?.message || 'Press F11 (or your configured hotkey) to open the Expanded Overlay - a floating control panel that stays on top of other applications. Perfect for gaming or fullscreen apps! It includes all the same features accessible without leaving your current application.',
        position: 'center'
      },
      {
        id: 'hotkeys-summary',
        title: t.hotkeys?.title || 'Essential Hotkeys',
        message: t.hotkeys?.message || 'Remember these key shortcuts: F11 for Expanded Overlay, Alt+T for Screen Translation, Alt+Y for Screen Box Selector. You can customize all hotkeys in Settings → Keybinds.',
        position: 'center'
      },
      {
        id: 'finish',
        title: t.finish?.title || "You're All Set!",
        message: t.finish?.message || "That's it! You're ready to start using the app. Press F11 to try the Expanded Overlay, and explore all the features to customize your experience.",
        position: 'center'
      }
    ];
  }

  /**
   * Check if tutorial has been completed
   */
  public hasCompleted(): boolean {
    const completed = localStorage.getItem('tutorialCompleted');
    return completed === 'true';
  }

  /**
   * Check if tutorial is currently active
   */
  public isCurrentlyActive(): boolean {
    return this.isActive;
  }

  /**
   * Mark tutorial as completed
   */
  private markCompleted(): void {
    localStorage.setItem('tutorialCompleted', 'true');
  }

  /**
   * Start the tutorial
   */
  public async start(): Promise<void> {
    if (this.isActive) {
      return;
    }

    this.initializeSteps();
    this.currentStepIndex = 0;
    this.isActive = true;
    this.createOverlay();
    await this.showStep(0);
  }

  /**
   * Stop the tutorial
   */
  public async stop(): Promise<void> {
    if (!this.isActive) {
      return;
    }

    this.isActive = false;
    await this.removeOverlay();
    this.markCompleted();
    
    // Notify main process that tutorial has completed
    try {
      if ((window as any).electronAPI) {
        (window as any).electronAPI.invoke('tutorial:completed');
      }
    } catch (error) {
      console.error('Error notifying tutorial completion:', error);
    }
    
    // Navigate to whispra translate page after tutorial completion
    try {
      const switchTabFn = (window as any).switchTab;
      if (typeof switchTabFn === 'function') {
        switchTabFn('whispra-translate');
      }
    } catch (error) {
      console.error('Error navigating to whispra translate page:', error);
    }
  }

  /**
   * Skip the tutorial
   */
  public async skip(): Promise<void> {
    await this.stop();
  }

  /**
   * Go to next step
   */
  public async next(): Promise<void> {
    if (this.currentStepIndex < this.steps.length - 1) {
      this.currentStepIndex++;
      await this.showStep(this.currentStepIndex);
    } else {
      this.stop();
    }
  }

  /**
   * Go to previous step
   */
  public async previous(): Promise<void> {
    if (this.currentStepIndex > 0) {
      this.currentStepIndex--;
      await this.showStep(this.currentStepIndex);
    }
  }

  /**
   * Create the overlay structure
   */
  private createOverlay(): void {
    // Prevent body scroll
    this.previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Create overlay background
    this.overlayElement = document.createElement('div');
    this.overlayElement.className = 'tutorial-overlay';
    this.overlayElement.addEventListener('click', this.handleOverlayClick);

    // Create highlight element
    this.highlightElement = document.createElement('div');
    this.highlightElement.className = 'tutorial-highlight';

    // Create tutorial box
    this.tutorialBox = document.createElement('div');
    this.tutorialBox.className = 'tutorial-box';

    // Create box content
    const title = document.createElement('h3');
    title.className = 'tutorial-title';
    this.tutorialBox.appendChild(title);

    const message = document.createElement('p');
    message.className = 'tutorial-message';
    this.tutorialBox.appendChild(message);

    // Create navigation buttons
    const buttons = document.createElement('div');
    buttons.className = 'tutorial-buttons';

    const skipButton = document.createElement('button');
    skipButton.className = 'tutorial-button tutorial-button-skip';
    skipButton.textContent = this.translations.tutorial?.buttons?.skip || 'Skip';
    skipButton.addEventListener('click', () => this.skip());
    buttons.appendChild(skipButton);

    const buttonGroup = document.createElement('div');
    buttonGroup.className = 'tutorial-button-group';

    const backButton = document.createElement('button');
    backButton.className = 'tutorial-button tutorial-button-secondary';
    backButton.textContent = this.translations.tutorial?.buttons?.back || 'Back';
    backButton.addEventListener('click', () => this.previous());
    buttonGroup.appendChild(backButton);

    const nextButton = document.createElement('button');
    nextButton.className = 'tutorial-button tutorial-button-primary';
    nextButton.textContent = this.translations.tutorial?.buttons?.next || 'Next';
    nextButton.addEventListener('click', () => this.next());
    buttonGroup.appendChild(nextButton);

    buttons.appendChild(buttonGroup);
    this.tutorialBox.appendChild(buttons);

    // Add to DOM
    this.overlayElement.appendChild(this.highlightElement);
    this.overlayElement.appendChild(this.tutorialBox);
    document.body.appendChild(this.overlayElement);

    // Add keyboard listeners
    document.addEventListener('keydown', this.handleKeyDown);

    // Load CSS
    this.loadCSS();

    // Animate in
    requestAnimationFrame(() => {
      if (this.overlayElement) {
        this.overlayElement.style.opacity = '1';
      }
    });
  }

  /**
   * Remove the overlay
   */
  private async removeOverlay(): Promise<void> {
    if (this.overlayElement) {
      this.overlayElement.style.opacity = '0';
      setTimeout(() => {
        if (this.overlayElement && this.overlayElement.parentNode) {
          document.body.removeChild(this.overlayElement);
        }
        this.overlayElement = null;
        this.tutorialBox = null;
        this.highlightElement = null;
      }, 200);
    }

    // Restore body scroll
    document.body.style.overflow = this.previousOverflow;

    // Remove keyboard listeners
    document.removeEventListener('keydown', this.handleKeyDown);

    // Close settings modal if open
    try {
      const { SettingsIntegration } = await import('./settings/SettingsIntegration.js');
      const settingsIntegration = SettingsIntegration.getInstance();
      if (settingsIntegration.isSettingsOpen()) {
        settingsIntegration.hideSettings();
      }
    } catch (error) {
      console.error('Error closing settings modal:', error);
    }
  }

  /**
   * Show a specific step
   */
  private async showStep(index: number): Promise<void> {
    if (index < 0 || index >= this.steps.length) {
      return;
    }

    const step = this.steps[index];
    if (!this.tutorialBox) {
      return;
    }

    // Update content
    const title = this.tutorialBox.querySelector('.tutorial-title');
    const message = this.tutorialBox.querySelector('.tutorial-message');
    const backButton = this.tutorialBox.querySelector('.tutorial-button-secondary') as HTMLButtonElement;
    const nextButton = this.tutorialBox.querySelector('.tutorial-button-primary') as HTMLButtonElement;

    if (title) title.textContent = step.title;
    if (message) message.textContent = step.message;

    // Update button states
    if (backButton) {
      backButton.disabled = index === 0;
    }
    if (nextButton) {
      const isLastStep = index === this.steps.length - 1;
      nextButton.textContent = isLastStep 
        ? (this.translations.tutorial?.buttons?.closeTour || 'Close Tour')
        : (this.translations.tutorial?.buttons?.next || 'Next');
    }

    // Execute step action if available
    if (step.action) {
      try {
        await step.action();
      } catch (error) {
        console.error('Error executing tutorial step action:', error);
      }
    }

    // Position tutorial box and highlight
    await this.positionStep(step);

    // Update step indicator
    this.updateStepIndicator(index);
  }

  /**
   * Position the tutorial box relative to the target element
   */
  private async positionStep(step: TutorialStep): Promise<void> {
    if (!this.tutorialBox || !this.highlightElement) {
      return;
    }

    if (step.position === 'center' || !step.targetSelector) {
      // Center position
      this.highlightElement.style.display = 'none';
      this.tutorialBox.style.position = 'fixed';
      this.tutorialBox.style.top = '50%';
      this.tutorialBox.style.left = '50%';
      this.tutorialBox.style.transform = 'translate(-50%, -50%)';
      this.tutorialBox.style.maxWidth = '500px';
      return;
    }

    // Find target element
    let targetElement: HTMLElement | null = null;

    // Special handling for settings tabs
    if (step.id === 'keybinds') {
      const buttons = Array.from(document.querySelectorAll('.settings-tab-nav-button'));
      for (const btn of buttons) {
        if (btn.textContent?.includes('Keybinds')) {
          targetElement = btn as HTMLElement;
          break;
        }
      }
    } else if (step.id === 'models') {
      const buttons = Array.from(document.querySelectorAll('.settings-tab-nav-button'));
      for (const btn of buttons) {
        if (btn.textContent?.includes('Models')) {
          targetElement = btn as HTMLElement;
          break;
        }
      }
    } else if (step.id === 'api-keys') {
      const buttons = Array.from(document.querySelectorAll('.settings-tab-nav-button'));
      for (const btn of buttons) {
        const text = btn.textContent?.trim() || '';
        if (text.includes('API Keys') || text.includes('🔐')) {
          targetElement = btn as HTMLElement;
          break;
        }
      }
    } else if (step.id === 'cloud-local') {
      const buttons = Array.from(document.querySelectorAll('.settings-tab-nav-button'));
      for (const btn of buttons) {
        const text = btn.textContent?.trim() || '';
        if (text.includes('Cloud/Local') || text.includes('☁️')) {
          targetElement = btn as HTMLElement;
          break;
        }
      }
    } else if (step.id === 'account-settings') {
      const buttons = Array.from(document.querySelectorAll('.settings-tab-nav-button'));
      for (const btn of buttons) {
        const text = btn.textContent?.trim() || '';
        if (text.includes('Account') || text.includes('👤')) {
          targetElement = btn as HTMLElement;
          break;
        }
      }
    } else {
      targetElement = document.querySelector(step.targetSelector!) as HTMLElement;
    }

    if (!targetElement) {
      // Fallback to center
      this.highlightElement.style.display = 'none';
      this.tutorialBox.style.position = 'fixed';
      this.tutorialBox.style.top = '50%';
      this.tutorialBox.style.left = '50%';
      this.tutorialBox.style.transform = 'translate(-50%, -50%)';
      this.tutorialBox.style.maxWidth = '500px';
      return;
    }

    // Show highlight
    this.highlightElement.style.display = 'block';
    const rect = targetElement.getBoundingClientRect();
    this.highlightElement.style.top = `${rect.top}px`;
    this.highlightElement.style.left = `${rect.left}px`;
    this.highlightElement.style.width = `${rect.width}px`;
    this.highlightElement.style.height = `${rect.height}px`;

    // Position tutorial box
    const boxRect = this.tutorialBox.getBoundingClientRect();
    const spacing = 20;
    let top = 0;
    let left = 0;

    switch (step.position) {
      case 'top':
        top = rect.top - boxRect.height - spacing;
        left = rect.left + (rect.width / 2) - (boxRect.width / 2);
        break;
      case 'bottom':
        top = rect.bottom + spacing;
        left = rect.left + (rect.width / 2) - (boxRect.width / 2);
        break;
      case 'left':
        top = rect.top + (rect.height / 2) - (boxRect.height / 2);
        left = rect.left - boxRect.width - spacing;
        break;
      case 'right':
        top = rect.top + (rect.height / 2) - (boxRect.height / 2);
        left = rect.right + spacing;
        break;
    }

    // Ensure box stays within viewport
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    if (left < 20) left = 20;
    if (left + boxRect.width > viewportWidth - 20) {
      left = viewportWidth - boxRect.width - 20;
    }
    if (top < 20) top = 20;
    if (top + boxRect.height > viewportHeight - 20) {
      top = viewportHeight - boxRect.height - 20;
    }

    this.tutorialBox.style.position = 'fixed';
    this.tutorialBox.style.top = `${top}px`;
    this.tutorialBox.style.left = `${left}px`;
    this.tutorialBox.style.transform = 'none';
    this.tutorialBox.style.maxWidth = '400px';
  }

  /**
   * Update step indicator
   */
  private updateStepIndicator(currentIndex: number): void {
    if (!this.tutorialBox) return;

    // Remove existing indicator
    const existing = this.tutorialBox.querySelector('.tutorial-step-indicator');
    if (existing) {
      existing.remove();
    }

    // Create new indicator
    const indicator = document.createElement('div');
    indicator.className = 'tutorial-step-indicator';
    indicator.textContent = `${currentIndex + 1} / ${this.steps.length}`;
    this.tutorialBox.insertBefore(indicator, this.tutorialBox.firstChild);
  }

  /**
   * Handle keyboard events
   */
  private handleKeyDown(event: KeyboardEvent): void {
    if (!this.isActive) return;

    switch (event.key) {
      case 'Escape':
        event.preventDefault();
        this.skip();
        break;
      case 'ArrowLeft':
        event.preventDefault();
        this.previous();
        break;
      case 'ArrowRight':
      case 'Enter':
        event.preventDefault();
        this.next();
        break;
    }
  }

  /**
   * Handle overlay clicks (only allow closing via button)
   */
  private handleOverlayClick(event: MouseEvent): void {
    // Don't close on overlay click - only via buttons
    event.stopPropagation();
  }

  /**
   * Load CSS styles
   */
  private loadCSS(): void {
    const existingStyle = document.querySelector('#tutorial-overlay-styles');
    if (existingStyle) {
      return;
    }

    const style = document.createElement('style');
    style.id = 'tutorial-overlay-styles';
    style.textContent = `
      .tutorial-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.5);
        backdrop-filter: blur(2px);
        z-index: 10000;
        opacity: 0;
        transition: opacity 0.3s ease;
      }

      .tutorial-highlight {
        position: fixed;
        border: 3px solid #ffffff;
        border-radius: 8px;
        box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.5),
                    0 0 20px rgba(255, 255, 255, 0.3),
                    inset 0 0 20px rgba(255, 255, 255, 0.1);
        pointer-events: none;
        z-index: 10001;
        transition: all 0.3s ease;
        animation: tutorial-pulse 2s ease-in-out infinite;
      }

      @keyframes tutorial-pulse {
        0%, 100% {
          box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.5),
                      0 0 20px rgba(255, 255, 255, 0.3),
                      inset 0 0 20px rgba(255, 255, 255, 0.1);
        }
        50% {
          box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.5),
                      0 0 30px rgba(255, 255, 255, 0.5),
                      inset 0 0 30px rgba(255, 255, 255, 0.2);
        }
      }

      .tutorial-box {
        position: fixed;
        background: var(--panel);
        border: 1px solid var(--border);
        border-radius: 12px;
        padding: 1.5rem;
        z-index: 10002;
        box-shadow: 0 20px 50px rgba(0, 0, 0, 0.8),
                    0 0 0 1px rgba(255, 255, 255, 0.1);
        min-width: 320px;
        max-width: 500px;
        color: var(--text);
      }

      .tutorial-step-indicator {
        position: absolute;
        top: 1rem;
        right: 1rem;
        font-size: 0.75rem;
        color: var(--muted);
        font-weight: 500;
      }

      .tutorial-title {
        margin: 0 0 0.75rem 0;
        font-size: 1.25rem;
        font-weight: 600;
        color: var(--text);
      }

      .tutorial-message {
        margin: 0 0 1.5rem 0;
        font-size: 0.95rem;
        line-height: 1.6;
        color: var(--muted);
      }

      .tutorial-buttons {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 0.75rem;
      }

      .tutorial-button-group {
        display: flex;
        gap: 0.5rem;
        margin-left: auto;
      }

      .tutorial-button {
        padding: 0.625rem 1.25rem;
        border-radius: 6px;
        font-size: 0.875rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
        border: 1px solid var(--border);
        background: transparent;
        color: var(--text);
      }

      .tutorial-button:hover:not(:disabled) {
        background: #111;
        border-color: var(--focus);
      }

      .tutorial-button:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }

      .tutorial-button-primary {
        background: var(--focus);
        color: #000;
        border-color: var(--focus);
      }

      .tutorial-button-primary:hover:not(:disabled) {
        background: #e5e5e5;
      }

      .tutorial-button-skip {
        color: var(--muted);
        border-color: transparent;
      }

      .tutorial-button-skip:hover {
        color: var(--text);
        background: #111;
      }
    `;
    document.head.appendChild(style);
  }
}

