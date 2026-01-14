// Types will be accessed via window object to avoid ES6 module issues

/**
 * Expanded overlay renderer process logic - copied from original overlay-renderer.ts
 */
class ExpandedOverlayRenderer {
  private currentState: any | null = null;
  private syncIntervalId: NodeJS.Timeout | null = null;
  private soundboardListenersAttached: boolean = false;
  private isResizing: boolean = false;
  private resizeStartY: number = 0;
  private resizeStartHeight: number = 0;
  private boundHandleResizeMove!: (e: MouseEvent) => void;
  private boundHandleResizeEnd!: () => void;
  private isDragging: boolean = false;
  private dragStartX: number = 0;
  private dragStartY: number = 0;
  private dragStartOverlayX: number = 0;
  private dragStartOverlayY: number = 0;
  private boundHandleDragMove!: (e: MouseEvent) => void;
  private boundHandleDragEnd!: () => void;
  private currentLanguage: string = 'en';
  private translations: any = {};

  constructor() {
    try {
      // Bind resize handlers to maintain reference for proper cleanup
      this.boundHandleResizeMove = this.handleResizeMove.bind(this);
      this.boundHandleResizeEnd = this.handleResizeEnd.bind(this);

      // Bind drag handlers to maintain reference for proper cleanup
      this.boundHandleDragMove = this.handleDragMove.bind(this);
      this.boundHandleDragEnd = this.handleDragEnd.bind(this);

      this.initializeElements();
      this.setupEventListeners();
      this.setupIPCListeners();
      this.setupErrorHandling();

      // Initialize translation system
      this.loadLanguagePreference();
      this.setupLanguageChangeListener();
      this.setupConsoleTestFunction();

      // Load and display keybinds
      this.loadKeybinds();

      // Setup keybind change handlers
      this.setupKeybindChangeHandlers();

      // Setup listener for config updates from other windows
      this.setupConfigUpdateListener();
    } catch (error) {
      console.error('Error initializing expanded overlay renderer:', error);
      this.reportError('Expanded overlay renderer initialization failed: ' + (error as Error).message);
    }
  }

  /**
   * Initialize DOM elements and references
   */
  private initializeElements(): void {
    // Get DOM elements
    const elements = {
      expandedOverlay: document.getElementById('expanded-overlay'),
      closeButton: document.getElementById('close-button'),
      openWebOverlayButton: document.getElementById('open-web-overlay'),
      translationTab: document.getElementById('translation-tab'),
      bidirectionalTab: document.getElementById('bidirectional-tab'),
      screenTranslationTab: document.getElementById('screen-translation-tab'),
      quickTranslateTab: document.getElementById('quick-translate-tab'),
      soundboardTab: document.getElementById('soundboard-tab'),
      overlaySettingsTab: document.getElementById('overlay-settings-tab'),
      translationContent: document.getElementById('translation-content'),
      bidirectionalContent: document.getElementById('bidirectional-content'),
      screenTranslationContent: document.getElementById('screen-translation-content'),
      quickTranslateContent: document.getElementById('quick-translate-content'),
      soundboardContent: document.getElementById('soundboard-content'),
      overlaySettingsContent: document.getElementById('overlay-settings-content'),
      // Quick translate elements
      overlayQuickTargetLang: document.getElementById('overlay-quick-target-lang'),
      overlayQuickInput: document.getElementById('overlay-quick-input'),
      overlayQuickOutput: document.getElementById('overlay-quick-output'),
      overlayQuickTranslateBtn: document.getElementById('overlay-quick-translate-btn'),
      overlayQuickCopyBtn: document.getElementById('overlay-quick-copy-btn'),
      overlayQuickStatus: document.getElementById('overlay-quick-status'),
      // Soundboard elements
      overlayAddSound: document.getElementById('overlay-add-sound'),
      overlayStopAll: document.getElementById('overlay-stop-all'),
      overlayVbVolume: document.getElementById('overlay-vb-volume'),
      overlayVbVolumeDisplay: document.getElementById('overlay-vb-volume-display'),
      overlayHeadphonesVolume: document.getElementById('overlay-headphones-volume'),
      overlayHeadphonesVolumeDisplay: document.getElementById('overlay-headphones-volume-display'),
      overlaySoundGrid: document.getElementById('overlay-sound-grid'),
      resizeHandle: document.getElementById('resize-handle')
    };

    // Store references for later use
    (window as any).expandedOverlayElements = elements;

    // Apply Mac-specific restrictions for bidirectional
    this.applyMacBidirectionalRestrictions(elements);
  }

  /**
   * Apply Mac-specific restrictions to bidirectional feature
   */
  private applyMacBidirectionalRestrictions(elements: any): void {
    const isMac = (window as any).electronAPI?.platform === 'darwin';
    if (!isMac) return;

    console.log('[Overlay] 🍎 Applying Mac bidirectional restrictions');

    // Grey out bidirectional tab
    if (elements.bidirectionalTab) {
      elements.bidirectionalTab.style.opacity = '0.5';
      elements.bidirectionalTab.style.cursor = 'not-allowed';
      elements.bidirectionalTab.title = 'Coming Soon on macOS';
    }

    // Add coming soon overlay to bidirectional content
    if (elements.bidirectionalContent) {
      elements.bidirectionalContent.style.position = 'relative';
      
      const overlay = document.createElement('div');
      overlay.style.cssText = `
        position: absolute;
        inset: 0;
        background: rgba(0, 0, 0, 0.75);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        z-index: 100;
        backdrop-filter: blur(3px);
      `;
      overlay.innerHTML = `
        <div style="text-align: center; color: white; padding: 1.5rem;">
          <div style="font-size: 36px; margin-bottom: 0.75rem;">🚧</div>
          <h3 style="margin: 0 0 0.5rem; font-size: 1.1rem; font-weight: 600;">Coming Soon on macOS</h3>
          <p style="margin: 0; opacity: 0.8; font-size: 0.85rem;">
            Bidirectional translation is currently Windows-only.
          </p>
        </div>
      `;
      elements.bidirectionalContent.appendChild(overlay);
    }

    // Disable start button
    const startBtn = document.getElementById('start-bidirectional-button');
    if (startBtn) {
      (startBtn as HTMLButtonElement).disabled = true;
      startBtn.style.opacity = '0.5';
      startBtn.style.cursor = 'not-allowed';
    }
  }

  /**
   * Load language preference from main process
   */
  private async loadLanguagePreference(): Promise<void> {
    try {
      const response = await (window as any).electronAPI?.invoke('config:get', {
        id: Date.now().toString(),
        timestamp: Date.now(),
        payload: null
      });

      if (response?.success && response.payload?.uiSettings?.language) {
        this.currentLanguage = response.payload.uiSettings.language;
        console.log('[Expanded Overlay] Loaded language preference:', this.currentLanguage);
        await this.loadOverlayTranslations();
        this.updateOverlayTranslations();
      } else {
        console.log('[Expanded Overlay] No language preference found, using default:', this.currentLanguage);
        await this.loadOverlayTranslations();
        this.updateOverlayTranslations();
      }
    } catch (error) {
      console.error('[Expanded Overlay] Error loading language preference:', error);
      await this.loadOverlayTranslations();
      this.updateOverlayTranslations();
    }
  }

  /**
   * Load overlay translations from JSON file
   */
  private async loadOverlayTranslations(): Promise<void> {
    try {
      console.log('[Expanded Overlay] Loading translations for language:', this.currentLanguage);
      // Request just the filename, main process will resolve to src/locales/
      const filePath = `overlay-${this.currentLanguage}.json`;
      console.log('[Expanded Overlay] Attempting to load file:', filePath);

      const response = await (window as any).electronAPI?.invoke('fs:read-file', {
        id: Date.now().toString(),
        timestamp: Date.now(),
        payload: {
          path: filePath
        }
      });

      console.log('[Expanded Overlay] File read response:', response);
      console.log('[Expanded Overlay] Response success:', response?.success);
      console.log('[Expanded Overlay] Response error:', response?.error);
      console.log('[Expanded Overlay] Response payload length:', response?.payload?.length);

      if (response?.success) {
        console.log('[Expanded Overlay] File content received, parsing JSON...');
        this.translations = JSON.parse(response.payload);
        console.log('[Expanded Overlay] Successfully loaded translations:', Object.keys(this.translations));
        console.log('[Expanded Overlay] Sample translation (header.title):', this.getTranslation('header.title', 'Default'));
      } else {
        console.warn('[Expanded Overlay] Failed to load translations file:', response?.error, 'falling back to English');
        // Fallback to English
        this.currentLanguage = 'en';
        const fallbackPath = 'overlay-en.json';
        console.log('[Expanded Overlay] Attempting fallback file:', fallbackPath);

        const fallbackResponse = await (window as any).electronAPI?.invoke('fs:read-file', {
          id: Date.now().toString(),
          timestamp: Date.now(),
          payload: {
            path: fallbackPath
          }
        });

        console.log('[Expanded Overlay] Fallback response:', fallbackResponse);

        if (fallbackResponse?.success) {
          this.translations = JSON.parse(fallbackResponse.payload);
          console.log('[Expanded Overlay] Successfully loaded fallback translations');
        } else {
          console.error('[Expanded Overlay] Failed to load fallback English translations:', fallbackResponse?.error);
          this.translations = {};
        }
      }
    } catch (error) {
      console.error('[Expanded Overlay] Error loading translations:', error);
      this.translations = {};
    }
  }

  /**
   * Setup language change listener
   */
  private setupLanguageChangeListener(): void {
    console.log('[Expanded Overlay] Setting up language change listeners...');

    // Listen for language changes from main app
    (window as any).electronAPI?.onLanguageChange?.((languageCode: string) => {
      console.log('[Expanded Overlay] Language change detected:', languageCode);
      console.log('[Expanded Overlay] Current language before change:', this.currentLanguage);
      this.currentLanguage = languageCode;
      console.log('[Expanded Overlay] Current language after change:', this.currentLanguage);
      this.loadOverlayTranslations().then(() => {
        console.log('[Expanded Overlay] Translations loaded, updating UI...');
        this.updateOverlayTranslations();
        console.log('[Expanded Overlay] UI update completed');
      }).catch(error => {
        console.error('[Expanded Overlay] Error loading translations:', error);
      });
    });

    // Also listen for config updates that might include language changes
    (window as any).electronAPI?.onConfigUpdated?.((config: any) => {
      console.log('[Expanded Overlay] Config update received:', config);
      if (config.uiSettings?.language && config.uiSettings.language !== this.currentLanguage) {
        console.log('[Expanded Overlay] Language updated in config:', config.uiSettings.language);
        this.currentLanguage = config.uiSettings.language;
        this.loadOverlayTranslations().then(() => {
          this.updateOverlayTranslations();
        });
      } else if (config.uiSettings?.language) {
        console.log('[Expanded Overlay] Config has same language, no change needed:', config.uiSettings.language);
      }
    });

    console.log('[Expanded Overlay] Language change listeners setup completed');
  }

  /**
   * Update overlay translations
   */
  private updateOverlayTranslations(): void {
    try {
      console.log('[Expanded Overlay] Updating overlay translations for language:', this.currentLanguage);

      // Update tab buttons
      this.updateTabButtonText('translation-tab', this.getTranslation('tabs.translation', 'Translation'));
      this.updateTabButtonText('bidirectional-tab', this.getTranslation('tabs.bidirectional', 'Bidirectional'));
      this.updateTabButtonText('screen-translation-tab', this.getTranslation('tabs.screenTranslation', 'Screen Translation'));
      this.updateTabButtonText('quick-translate-tab', this.getTranslation('tabs.quickTranslate', 'Quick Trans'));
      this.updateTabButtonText('soundboard-tab', this.getTranslation('tabs.soundboard', 'Soundboard'));
      this.updateTabButtonText('overlay-settings-tab', this.getTranslation('tabs.settings', 'Settings'));

      // Update header
      this.updateElementText('.overlay-title', this.getTranslation('header.title', 'Whispra Controls'));
      this.updateElementAttribute('open-web-overlay', 'title', this.getTranslation('header.webOverlay', 'Web Overlay'));

      // Update translation tab
      this.updateTranslationTabTranslations();

      // Update bidirectional tab
      this.updateBidirectionalTabTranslations();

      // Update screen translation tab
      this.updateScreenTranslationTabTranslations();

      // Update soundboard tab
      this.updateSoundboardTabTranslations();

      // Update settings tab
      this.updateSettingsTabTranslations();

      console.log('[Expanded Overlay] Translation update completed');
    } catch (error) {
      console.error('[Expanded Overlay] Error updating translations:', error);
    }
  }

  /**
   * Update translation tab translations
   */
  private updateTranslationTabTranslations(): void {
    // Labels
    this.updateElementText('[data-i18n="translation.labels.microphone"]', this.getTranslation('translation.labels.microphone', 'Microphone'));
    this.updateElementText('[data-i18n="translation.labels.targetLanguage"]', this.getTranslation('translation.labels.targetLanguage', 'Target Language'));
    this.updateElementText('[data-i18n="translation.labels.voice"]', this.getTranslation('translation.labels.voice', 'Voice'));
    this.updateElementText('[data-i18n="translation.labels.output"]', this.getTranslation('translation.labels.output', 'Output'));
    this.updateElementText('[data-i18n="translation.labels.pushToTalk"]', this.getTranslation('translation.labels.pushToTalk', 'Push-to-Talk'));
    this.updateElementText('[data-i18n="translation.labels.holdKeyToRecord"]', this.getTranslation('translation.labels.holdKeyToRecord', 'Hold key to record'));

    // Placeholders
    this.updateElementAttribute('microphone-select', 'data-i18n', this.getTranslation('translation.placeholders.selectMicrophone', 'Select microphone...'));
    this.updateElementAttribute('voice-select', 'data-i18n', this.getTranslation('translation.placeholders.loadingVoices', 'Loading voices...'));

    // Buttons
    this.updateElementText('[data-i18n="translation.buttons.startTranslation"]', this.getTranslation('translation.buttons.startTranslation', 'Start Translation'));
    this.updateElementText('[data-i18n="translation.buttons.outputVirtualDevice"]', this.getTranslation('translation.buttons.outputVirtualDevice', 'Output: Virtual Device'));

    // Key prefix
    this.updateElementText('[data-i18n="common.keyPrefix"]', this.getTranslation('common.keyPrefix', 'Key:'));
  }

  /**
   * Update bidirectional tab translations
   */
  private updateBidirectionalTabTranslations(): void {
    // Labels
    this.updateElementText('[data-i18n="bidirectional.labels.outputDevice"]', this.getTranslation('bidirectional.labels.outputDevice', 'Output Device'));
    this.updateElementText('[data-i18n="bidirectional.labels.incomingVoice"]', this.getTranslation('bidirectional.labels.incomingVoice', 'Incoming Voice'));
    this.updateElementText('[data-i18n="bidirectional.labels.sourceLanguage"]', this.getTranslation('bidirectional.labels.sourceLanguage', 'Source Language'));
    this.updateElementText('[data-i18n="bidirectional.labels.targetLanguage"]', this.getTranslation('bidirectional.labels.targetLanguage', 'Translate To'));

    // Placeholders
    this.updateElementAttribute('bidirectional-output-select', 'data-i18n', this.getTranslation('bidirectional.placeholders.loadingOutputDevices', 'Loading output devices...'));
    this.updateElementAttribute('incoming-voice-select', 'data-i18n', this.getTranslation('bidirectional.placeholders.loadingVoices', 'Loading voices...'));

    // Buttons
    this.updateElementText('[data-i18n="bidirectional.buttons.startBidirectional"]', this.getTranslation('bidirectional.buttons.startBidirectional', 'Start Bidirectional'));

    // Key prefix
    this.updateElementText('[data-i18n="common.keyPrefix"]', this.getTranslation('common.keyPrefix', 'Key:'));
  }

  /**
   * Update screen translation tab translations
   */
  private updateScreenTranslationTabTranslations(): void {
    // Labels
    this.updateElementText('[data-i18n="screenTranslation.labels.screenSelection"]', this.getTranslation('screenTranslation.labels.screenSelection', 'Screen Selection'));
    this.updateElementText('[data-i18n="screenTranslation.labels.translateTo"]', this.getTranslation('screenTranslation.labels.translateTo', 'Translate To'));
    this.updateElementText('[data-i18n="screenTranslation.labels.translateLanguage"]', this.getTranslation('screenTranslation.labels.translateLanguage', 'Translate Language'));
    this.updateElementText('[data-i18n="screenTranslation.labels.keybind"]', this.getTranslation('screenTranslation.labels.keybind', 'Keybind'));

    // Placeholders
    this.updateElementAttribute('screen-selection', 'data-i18n', this.getTranslation('screenTranslation.placeholders.selectScreen', 'Select screen...'));

    // Buttons
    this.updateElementText('[data-i18n="screenTranslation.buttons.changeKeybind"]', this.getTranslation('screenTranslation.buttons.changeKeybind', 'Change Key'));

    // Key prefix
    this.updateElementText('[data-i18n="common.keyPrefix"]', this.getTranslation('common.keyPrefix', 'Key:'));
  }

  /**
   * Update soundboard tab translations
   */
  private updateSoundboardTabTranslations(): void {
    // Labels
    this.updateElementText('[data-i18n="soundboard.labels.soundBoardControls"]', this.getTranslation('soundboard.labels.soundBoardControls', 'Sound Board Controls'));
    this.updateElementText('[data-i18n="soundboard.labels.volumeControls"]', this.getTranslation('soundboard.labels.volumeControls', 'Volume Controls'));
    this.updateElementText('[data-i18n="soundboard.labels.soundPads"]', this.getTranslation('soundboard.labels.soundPads', 'Sound Pads'));
    this.updateElementText('[data-i18n="soundboard.labels.vbAudioVolume"]', this.getTranslation('soundboard.labels.vbAudioVolume', 'VB Audio:'));
    this.updateElementText('[data-i18n="soundboard.labels.headphonesVolume"]', this.getTranslation('soundboard.labels.headphonesVolume', 'Headphones:'));

    // Buttons
    this.updateElementText('[data-i18n="soundboard.buttons.addSound"]', this.getTranslation('soundboard.buttons.addSound', 'Add Sound'));
    this.updateElementText('[data-i18n="soundboard.buttons.stopAll"]', this.getTranslation('soundboard.buttons.stopAll', 'Stop All'));

    // Placeholders
    this.updateElementText('[data-i18n="soundboard.placeholders.noSoundsAdded"]', this.getTranslation('soundboard.placeholders.noSoundsAdded', 'No sounds added yet. Click "Add Sound" to get started!'));

    // Volume percentage
    this.updateElementText('[data-i18n="common.volume"]', this.getTranslation('common.volume', '%'));
  }

  /**
   * Update settings tab translations
   */
  private updateSettingsTabTranslations(): void {
    // Labels
    this.updateElementText('[data-i18n="settings.labels.overlayToggleHotkey"]', this.getTranslation('settings.labels.overlayToggleHotkey', 'Overlay Toggle Hotkey'));
    this.updateElementText('[data-i18n="settings.labels.pushToTalkHotkey"]', this.getTranslation('settings.labels.pushToTalkHotkey', 'Push-to-Talk Hotkey'));
    this.updateElementText('[data-i18n="settings.labels.bidirectionalToggleHotkey"]', this.getTranslation('settings.labels.bidirectionalToggleHotkey', 'Bidirectional Toggle Hotkey'));
    this.updateElementText('[data-i18n="settings.labels.clickThrough"]', this.getTranslation('settings.labels.clickThrough', 'Click-through'));
    this.updateElementText('[data-i18n="settings.labels.alwaysOnTop"]', this.getTranslation('settings.labels.alwaysOnTop', 'Always On Top'));
    this.updateElementText('[data-i18n="settings.labels.overlayOpacity"]', this.getTranslation('settings.labels.overlayOpacity', 'Overlay Opacity'));

    // Modifiers
    const modifierKey = this.getModifierKeyName();
    this.updateElementText('[data-i18n="settings.modifiers.ctrl"]', this.getTranslation('settings.modifiers.ctrl', 'Ctrl'));
    this.updateElementText('[data-i18n="settings.modifiers.alt"]', this.getTranslation('settings.modifiers.alt', modifierKey));
    this.updateElementText('[data-i18n="settings.modifiers.shift"]', this.getTranslation('settings.modifiers.shift', 'Shift'));

    // Toggle descriptions
    this.updateElementText('[data-i18n="settings.labels.enableClickThrough"]', this.getTranslation('settings.labels.enableClickThrough', 'Enable click-through in Minimal mode'));
    this.updateElementText('[data-i18n="settings.labels.keepOverlayAbove"]', this.getTranslation('settings.labels.keepOverlayAbove', 'Keep overlay above other windows'));
  }

  /**
   * Get translation by key with fallback
   */
  private getTranslation(key: string, fallback: string): string {
    try {
      const keys = key.split('.');
      let value = this.translations;

      for (const k of keys) {
        value = value?.[k];
        if (value === undefined) {
          console.warn(`[Expanded Overlay] Translation key not found: ${key}, using fallback: ${fallback}`);
          return fallback;
        }
      }

      return typeof value === 'string' ? value : fallback;
    } catch (error) {
      console.error(`[Expanded Overlay] Error getting translation for key ${key}:`, error);
      return fallback;
    }
  }

  /**
   * Get modifier key name based on platform (Option for macOS, Alt for others)
   */
  private getModifierKeyName(): string {
    if (typeof window !== 'undefined' && (window as any).electronAPI?.platform) {
      return (window as any).electronAPI.platform === 'darwin' ? 'Option' : 'Alt';
    }
    return 'Alt';
  }

  /**
   * Update tab button text while preserving emoji
   */
  private updateTabButtonText(tabId: string, text: string): void {
    const tabButton = document.getElementById(tabId);
    if (tabButton) {
      const emoji = tabButton.textContent?.split(' ')[0] || '';
      tabButton.textContent = emoji + ' ' + text;
    }
  }

  /**
   * Update element text by selector
   */
  private updateElementText(selector: string, text: string): void {
    const element = document.querySelector(selector) as HTMLElement;
    if (element) {
      element.textContent = text;
    }
  }

  /**
   * Update element attribute
   */
  private updateElementAttribute(elementId: string, attribute: string, value: string): void {
    const element = document.getElementById(elementId);
    if (element) {
      element.setAttribute(attribute, value);
    }
  }

  /**
   * Setup console test function for debugging
   */
  private setupConsoleTestFunction(): void {
    (window as any).testOverlayTranslation = () => {
      console.log('[Expanded Overlay] Current language:', this.currentLanguage);
      console.log('[Expanded Overlay] Available translations:', Object.keys(this.translations));
      console.log('[Expanded Overlay] Translation sample:', this.getTranslation('header.title', 'Default'));
      console.log('[Expanded Overlay] All translations:', this.translations);
    };

    (window as any).forceOverlayLanguageChange = (lang: string) => {
      console.log('[Expanded Overlay] Forcing language change to:', lang);
      this.currentLanguage = lang;
      this.loadOverlayTranslations().then(() => {
        console.log('[Expanded Overlay] Translations loaded, updating UI...');
        this.updateOverlayTranslations();
        console.log('[Expanded Overlay] UI update completed');
      }).catch(error => {
        console.error('[Expanded Overlay] Error loading translations:', error);
      });
    };

    (window as any).reloadOverlayTranslations = () => {
      console.log('[Expanded Overlay] Reloading translations for current language:', this.currentLanguage);
      this.loadOverlayTranslations().then(() => {
        this.updateOverlayTranslations();
        console.log('[Expanded Overlay] Translations reloaded and UI updated');
      });
    };

    (window as any).testFileRead = async (filename: string) => {
      console.log('[Expanded Overlay] Testing file read for:', filename);
      try {
        const response = await (window as any).electronAPI?.invoke('fs:read-file', {
          id: Date.now().toString(),
          timestamp: Date.now(),
          payload: {
            path: filename
          }
        });
        console.log('[Expanded Overlay] Test file read response:', response);
        return response;
      } catch (error) {
        console.error('[Expanded Overlay] Test file read error:', error);
        return null;
      }
    };

    // Test opacity function
    (window as any).testOpacity = (opacity: number) => {
      console.log('[Expanded Overlay] Testing opacity:', opacity);
      this.applyOpacityChange(opacity);
    };

    // Test theme detection
    (window as any).checkTheme = () => {
      const overlayContainer = document.querySelector('.overlay-container') as HTMLElement;
      const isLight = overlayContainer?.classList.contains('light-theme');
      console.log('[Expanded Overlay] Current theme - Light:', isLight, 'Classes:', overlayContainer?.className);
      return { isLight, classes: overlayContainer?.className };
    };
  }

  /**
   * Setup event listeners for UI interactions
   */
  private setupEventListeners(): void {
    const elements = (window as any).expandedOverlayElements;

    // Close button
    elements.closeButton?.addEventListener('click', () => {
      this.sendToMain('overlay:close', {
        id: Date.now().toString(),
        timestamp: Date.now(),
        payload: null
      });
    });

    // Tab switching
    elements.translationTab?.addEventListener('click', () => {
      this.switchTab('translation');
    });

    elements.bidirectionalTab?.addEventListener('click', () => {
      this.switchTab('bidirectional');
    });

    elements.screenTranslationTab?.addEventListener('click', () => {
      this.switchTab('screen-translation');
    });

    elements.soundboardTab?.addEventListener('click', () => {
      this.switchTab('soundboard');
    });

    elements.quickTranslateTab?.addEventListener('click', () => {
      this.switchTab('quick-translate');
    });

    elements.overlaySettingsTab?.addEventListener('click', () => {
      this.switchTab('overlay-settings');
    });

    // Open Web Overlay button -> toggle soundboard overlay
    elements.openWebOverlayButton?.addEventListener('click', async () => {
      try {
        await (window as any).electronAPI?.invoke?.('soundboard-overlay:toggle');
      } catch (error) {
        console.error('Failed to toggle soundboard web overlay:', error);
      }
    });

    // Setting controls
    this.setupSettingControls();

    // Quick translate controls
    this.setupQuickTranslateControls();

    // Theme toggle
    this.setupThemeToggle();

    // Resize functionality
    this.setupResizeHandling();

    // Header dragging functionality
    this.setupHeaderDragging();

    // Load all data asynchronously to not block initialization
    setTimeout(() => {
      this.loadAllData().catch(() => {});
    }, 100);
  }

  /**
   * Setup IPC listeners for communication with main process
   */
  private setupIPCListeners(): void {
    // Listen for state updates
    (window as any).electronAPI?.onStateUpdate((state: any) => {
      try {
        this.updateState(state);
      } catch (error) {
        console.error('Error handling state update:', error);
      }
    });

    // Listen for translation results
    (window as any).electronAPI?.onTranslationResult((result: any) => {
      try {
        this.updateTranslationResult(result);
      } catch (error) {
        console.error('Error handling translation result:', error);
      }
    });

    // Listen for translation state changes
    (window as any).electronAPI?.onTranslationStateChanged?.((state: any) => {
      try {
        console.log('[Expanded Overlay] Received translation state change:', state);
        console.log('[Expanded Overlay] Updating translation button to:', state.isRunning || false);
        this.updateTranslationButton(state.isRunning || false);
      } catch (error) {
        console.error('Error handling translation state change:', error);
      }
    });

    // Listen for bidirectional state updates
    (window as any).electronAPI?.onBidirectionalStateUpdate?.((state: any) => {
      try {
        console.log('[Expanded Overlay] Received bidirectional state update:', state);
        this.updateBidirectionalButton(state.isEnabled || false);
      } catch (error) {
        console.error('Error handling bidirectional state update:', error);
      }
    });

    // Listen for ping health checks - pong is sent automatically by preload
    (window as any).electronAPI?.onPing?.(() => {
      // Ping received, pong is automatically sent by preload script
      console.log('Expanded overlay ping received, responding with pong');
    });

    // Listen for cleanup requests
    (window as any).electronAPI?.onCleanupResources?.(() => {
      this.cleanup();
    });

    // Listen for soundboard events
    (window as any).electronAPI?.soundboard?.onSoundLoaded?.((sound: any) => {
      // Refresh soundboard display when new sounds are loaded
      console.log('Sound loaded in overlay:', sound);
      this.loadSoundboardData().catch(error => {
        console.error('Error refreshing soundboard after sound loaded:', error);
      });
    });

    (window as any).electronAPI?.soundboard?.onSoundPlayed?.((data: any) => {
      // Update soundboard display to show playing state
      console.log('Sound played in overlay:', data);
      // Could add visual feedback for playing sounds
    });

    (window as any).electronAPI?.soundboard?.onSoundStopped?.((data: any) => {
      // Update soundboard display to show stopped state
      console.log('Sound stopped in overlay:', data);
      // Could remove visual feedback for stopped sounds
    });

    // Listen for volume changes for real-time sync
    (window as any).electronAPI?.soundboard?.onVolumeChanged?.((volume: number) => {
      const elements = (window as any).expandedOverlayElements;
      if (elements.overlayVbVolume) {
        elements.overlayVbVolume.value = Math.round(volume * 100).toString();
      }
      if (elements.overlayVbVolumeDisplay) {
        elements.overlayVbVolumeDisplay.textContent = `${Math.round(volume * 100)}%`;
      }
    });

    (window as any).electronAPI?.soundboard?.onHeadphonesVolumeChanged?.((volume: number) => {
      const elements = (window as any).expandedOverlayElements;
      if (elements.overlayHeadphonesVolume) {
        elements.overlayHeadphonesVolume.value = Math.round(volume * 100).toString();
      }
      if (elements.overlayHeadphonesVolumeDisplay) {
        elements.overlayHeadphonesVolumeDisplay.textContent = `${Math.round(volume * 100)}%`;
      }
    });

    // Soundboard data is loaded directly via API calls, no need for IPC listeners

    // Listen for config updates from main app to stay in sync (remote control behavior)
    (window as any).electronAPI?.onConfigUpdated?.((config: any) => {
      try {
        this.syncWithMainAppConfig(config);
      } catch (error) {
        console.error('Error syncing with main app config:', error);
      }
    });

    // Listen for screen translation updates from main app
    if ((window as any).electronAPI?.on) {
      (window as any).electronAPI.on('screen-translation:update', (data: any) => {
        try {
          console.log('[Expanded Overlay] Received screen translation update from main app:', data);
          this.syncScreenTranslationSettings(data);
        } catch (error) {
          console.error('Error syncing screen translation settings:', error);
        }
      });
    }
  }

  /**
   * Load all data for both translation and bidirectional tabs
   */
  private async loadAllData(): Promise<void> {
    try {
      console.log('[Expanded Overlay] Loading all data...');

      // Load translation tab data
      await this.loadTranslationData();

      // Load bidirectional tab data
      await this.loadBidirectionalData();

      // Load screen translation tab data
      await this.loadScreenTranslationData();

      // Sync button states with main app (delayed to allow main app to settle)
      setTimeout(() => {
        console.log('[Expanded Overlay] Initial button state sync');
        this.syncButtonStatesWithMainApp();
      }, 1000);

      // Set up periodic fallback sync every 30 seconds (reduced frequency)
      if (!this.syncIntervalId) {
        console.log('[Expanded Overlay] Setting up periodic sync every 30 seconds');
        this.syncIntervalId = setInterval(() => {
          console.log('[Expanded Overlay] Periodic button state sync');
          this.syncButtonStatesWithMainApp().catch(error => {
            console.error('Error during periodic button state sync:', error);
          });
        }, 30000); // Increased from 5 to 30 seconds
      }

      // Load and sync current config from main app (auto-select current values)
      setTimeout(() => {
        this.loadAndSyncCurrentConfig();
      }, 200); // Small delay to ensure dropdowns are populated

      // Load saved overlay size and position
      setTimeout(() => {
        this.loadOverlaySize();
        this.loadOverlayPosition();
      }, 300); // Small delay to ensure overlay is rendered
    } catch (error) {
      console.error('Error loading overlay data:', error);
    }
  }

  /**
   * Load translation tab data (microphones, languages, voices)
   */
  private async loadTranslationData(): Promise<void> {
    try {
      // Load microphones
      await this.loadMicrophones();
      
      // Load languages  
      await this.loadLanguages();
      
      // Load voices
      await this.loadVoices();
    } catch (error) {
      console.error('Error loading translation data:', error);
    }
  }

  /**
   * Load microphones for translation tab
   */
  private async loadMicrophones(): Promise<void> {
    try {
      console.log('🎤 Loading microphones for overlay...');

      // Request microphone permission first to ensure we can access devices
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop()); // Stop the stream immediately
        console.log('🎤 Microphone permission granted');
      } catch (permError) {
        console.warn('🎤 Microphone permission denied or failed:', permError);
      }

      // Now enumerate devices
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter(device => device.kind === 'audioinput');

      console.log('🎤 Found', audioInputs.length, 'microphone devices:', audioInputs.map(d => ({ id: d.deviceId, label: d.label })));

      const micSelect = document.getElementById('microphone-select') as HTMLSelectElement;
      if (!micSelect) {
        console.warn('🎤 Microphone select element not found');
        return;
      }

      micSelect.innerHTML = '<option value="">Select microphone...</option>';

      audioInputs.forEach((device) => {
        const option = document.createElement('option');
        option.value = device.deviceId;
        option.textContent = device.label || `Microphone ${device.deviceId.slice(0, 8)}...`;
        micSelect.appendChild(option);
        console.log('🎤 Added microphone option:', device.label || device.deviceId);
      });

      // Set current selection from config
      const configResponse = await (window as any).electronAPI?.invoke('config:get', {
        id: Date.now().toString(),
        timestamp: Date.now(),
        payload: null
      });

      if (configResponse?.success && configResponse.payload?.selectedMicrophone) {
        console.log('🎤 Setting microphone from config:', configResponse.payload.selectedMicrophone);
        micSelect.value = configResponse.payload.selectedMicrophone;

        // If the configured device doesn't exist in the list, clear the selection
        if (micSelect.value !== configResponse.payload.selectedMicrophone) {
          console.warn('🎤 Configured microphone not found in device list, clearing selection');
          micSelect.value = '';
        }
      } else {
        console.log('🎤 No microphone configured in config');
      }

      console.log('🎤 Microphone loading completed');
    } catch (error) {
      console.error('🎤 Error loading microphones:', error);
      // Fallback to simple message
      const micSelect = document.getElementById('microphone-select') as HTMLSelectElement;
      if (micSelect) {
        micSelect.innerHTML = '<option value="">Microphone access needed</option>';
      }
    }
  }

  /**
   * Load languages for translation tab  
   */
  private async loadLanguages(): Promise<void> {
    try {
      // Languages are populated by LanguageSelector in main app - use hardcoded languages
      const langSelect = document.getElementById('language-select') as HTMLSelectElement;
      if (!langSelect) return;
        // Use hardcoded languages like main app LanguageSelector
        const languages = [
          { code: 'en', name: 'English', flag: '🇺🇸' },
          { code: 'es', name: 'Spanish', flag: '🇪🇸' },
          { code: 'fr', name: 'French', flag: '🇫🇷' },
          { code: 'de', name: 'German', flag: '🇩🇪' },
          { code: 'it', name: 'Italian', flag: '🇮🇹' },
          { code: 'pt', name: 'Portuguese', flag: '🇵🇹' },
          { code: 'ru', name: 'Russian', flag: '🇷🇺' },
          { code: 'ja', name: 'Japanese', flag: '🇯🇵' },
          { code: 'ko', name: 'Korean', flag: '🇰🇷' },
          { code: 'zh', name: 'Chinese', flag: '🇨🇳' },
          { code: 'ar', name: 'Arabic', flag: '🇸🇦' },
          { code: 'hi', name: 'Hindi', flag: '🇮🇳' },
          { code: 'th', name: 'Thai', flag: '🇹🇭' },
          { code: 'vi', name: 'Vietnamese', flag: '🇻🇳' },
          { code: 'tr', name: 'Turkish', flag: '🇹🇷' },
          { code: 'pl', name: 'Polish', flag: '🇵🇱' },
          { code: 'nl', name: 'Dutch', flag: '🇳🇱' },
          { code: 'sv', name: 'Swedish', flag: '🇸🇪' },
          { code: 'da', name: 'Danish', flag: '🇩🇰' },
          { code: 'no', name: 'Norwegian', flag: '🇳🇴' }
        ];

        langSelect.innerHTML = '';
        languages.forEach(language => {
          const option = document.createElement('option');
          option.value = language.code;
          option.textContent = `${language.flag} ${language.name}`;
          langSelect.appendChild(option);
        });

      // Set default value if available
      const configResponse = await (window as any).electronAPI?.invoke('config:get', {
        id: Date.now().toString(),
        timestamp: Date.now(),
        payload: null
      });

      if (configResponse?.success && configResponse.payload?.targetLanguage) {
        langSelect.value = configResponse.payload.targetLanguage;
      }
    } catch (error) {
      console.error('Error loading languages:', error);
    }
  }

  /**
   * Load voices for translation tab
   */
  private async loadVoices(): Promise<void> {
    try {
      const response = await (window as any).electronAPI?.invoke('voices:get-available', {
        id: Date.now().toString(),
        timestamp: Date.now(),
        payload: null
      });

      const translationVoiceSelect = document.getElementById('voice-select') as HTMLSelectElement;
      if (!translationVoiceSelect || !response?.success) return;

      translationVoiceSelect.innerHTML = '<option value="">Loading voices...</option>';
      
      if (response.payload?.voices) {
        translationVoiceSelect.innerHTML = '<option value="">Select voice...</option>';
        response.payload.voices.forEach((voice: any) => {
          const option = document.createElement('option');
          option.value = voice.voice_id;
          option.textContent = voice.name || voice.voice_id;
          translationVoiceSelect.appendChild(option);
        });
      }

      // Set default value if available
      const configResponse = await (window as any).electronAPI?.invoke('config:get', {
        id: Date.now().toString(),
        timestamp: Date.now(),
        payload: null
      });

      if (configResponse?.success && configResponse.payload?.voiceId) {
        translationVoiceSelect.value = configResponse.payload.voiceId;
      }
    } catch (error) {
      console.error('Error loading voices:', error);
    }
  }

  /**
   * Setup header dragging for moving the overlay
   */
  private setupHeaderDragging(): void {
    const elements = (window as any).expandedOverlayElements;
    const overlay = elements.expandedOverlay;
    const overlayContainer = overlay?.parentElement;

    if (!overlay || !overlayContainer) {
      console.warn('Overlay or container element not found for dragging');
      return;
    }

    // Make the overlay container position relative so we can move the overlay within it
    overlayContainer.style.position = 'relative';

    // Add mousedown listener to the header (but not to buttons)
    const header = overlay.querySelector('.overlay-header');
    if (!header) {
      console.warn('Header element not found for dragging');
      return;
    }

    header.addEventListener('mousedown', (e: MouseEvent) => {
      // Don't start dragging if clicking on buttons or interactive elements
      const target = e.target as HTMLElement;
      if (target.tagName === 'BUTTON' || target.closest('button') || target.closest('.close-button') || target.closest('.overlay-button')) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();
      
      this.isDragging = true;
      this.dragStartX = e.clientX;
      this.dragStartY = e.clientY;
      
      // Get current overlay position
      const overlayRect = overlay.getBoundingClientRect();
      const containerRect = overlayContainer.getBoundingClientRect();
      this.dragStartOverlayX = overlayRect.left - containerRect.left;
      this.dragStartOverlayY = overlayRect.top - containerRect.top;
      
      // Add global mouse event listeners
      document.addEventListener('mousemove', this.boundHandleDragMove);
      document.addEventListener('mouseup', this.boundHandleDragEnd);
      
      // Prevent text selection during drag
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'move';
      
      console.log('Started dragging overlay');
    });
  }

  /**
   * Handle mouse move during drag
   */
  private handleDragMove(e: MouseEvent): void {
    if (!this.isDragging) return;
    
    const elements = (window as any).expandedOverlayElements;
    const overlay = elements.expandedOverlay;
    const overlayContainer = overlay?.parentElement;
    
    if (!overlay || !overlayContainer) return;
    
    const deltaX = e.clientX - this.dragStartX;
    const deltaY = e.clientY - this.dragStartY;
    
    const newX = this.dragStartOverlayX + deltaX;
    const newY = this.dragStartOverlayY + deltaY;
    
    // Constrain to viewport bounds
    const containerRect = overlayContainer.getBoundingClientRect();
    const overlayRect = overlay.getBoundingClientRect();
    
    const minX = 0;
    const maxX = containerRect.width - overlayRect.width;
    const minY = 0;
    const maxY = containerRect.height - overlayRect.height;
    
    const constrainedX = Math.max(minX, Math.min(maxX, newX));
    const constrainedY = Math.max(minY, Math.min(maxY, newY));
    
    // Update overlay position
    overlay.style.position = 'absolute';
    overlay.style.left = `${constrainedX}px`;
    overlay.style.top = `${constrainedY}px`;
    overlay.style.transform = 'none'; // Remove any centering transform
  }

  /**
   * Handle mouse up to end drag
   */
  private handleDragEnd(): void {
    if (!this.isDragging) return;
    
    this.isDragging = false;
    
    // Remove global event listeners
    document.removeEventListener('mousemove', this.boundHandleDragMove);
    document.removeEventListener('mouseup', this.boundHandleDragEnd);
    
    // Restore normal cursor and text selection
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
    
    // Save the new position to preferences
    this.saveOverlayPosition();
    
    console.log('Finished dragging overlay');
  }

  /**
   * Save overlay position to preferences
   */
  private async saveOverlayPosition(): Promise<void> {
    try {
      const elements = (window as any).expandedOverlayElements;
      const overlay = elements.expandedOverlay;
      
      if (!overlay) return;
      
      const position = {
        x: parseInt(overlay.style.left) || 0,
        y: parseInt(overlay.style.top) || 0
      };
      
      // Save to config via main process
      await (window as any).electronAPI?.invoke('config:set', {
        id: Date.now().toString(),
        timestamp: Date.now(),
        payload: {
          uiSettings: {
            expandedOverlayPosition: position
          }
        }
      });
      
      console.log('Saved overlay position:', position);
    } catch (error) {
      console.error('Error saving overlay position:', error);
    }
  }

  /**
   * Load saved overlay position from preferences
   */
  private async loadOverlayPosition(): Promise<void> {
    try {
      const configResponse = await (window as any).electronAPI?.invoke('config:get', {
        id: Date.now().toString(),
        timestamp: Date.now(),
        payload: null
      });

      if (configResponse?.success && configResponse.payload?.uiSettings?.expandedOverlayPosition) {
        const elements = (window as any).expandedOverlayElements;
        const overlay = elements.expandedOverlay;
        const overlayContainer = overlay?.parentElement;
        
        if (overlay && overlayContainer) {
          const savedPosition = configResponse.payload.uiSettings.expandedOverlayPosition;
          
          // Apply saved position
          overlay.style.position = 'absolute';
          overlay.style.left = `${savedPosition.x}px`;
          overlay.style.top = `${savedPosition.y}px`;
          overlay.style.transform = 'none';
          
          console.log('Loaded overlay position:', savedPosition);
        }
      }
    } catch (error) {
      console.error('Error loading overlay position:', error);
    }
  }

  /**
   * Setup resize handling for vertical resizing
   */
  private setupResizeHandling(): void {
    const elements = (window as any).expandedOverlayElements;
    const resizeHandle = elements.resizeHandle;
    const overlay = elements.expandedOverlay;

    if (!resizeHandle || !overlay) {
      console.warn('Resize handle or overlay element not found');
      return;
    }

    // Mouse down on resize handle
    resizeHandle.addEventListener('mousedown', (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      
      this.isResizing = true;
      this.resizeStartY = e.clientY;
      this.resizeStartHeight = overlay.offsetHeight;
      
      // Add global mouse event listeners
      document.addEventListener('mousemove', this.boundHandleResizeMove);
      document.addEventListener('mouseup', this.boundHandleResizeEnd);
      
      // Prevent text selection during resize
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'ns-resize';
      
      console.log('Started resizing overlay');
    });
  }

  /**
   * Handle mouse move during resize
   */
  private handleResizeMove(e: MouseEvent): void {
    if (!this.isResizing) return;
    
    const elements = (window as any).expandedOverlayElements;
    const overlay = elements.expandedOverlay;
    
    if (!overlay) return;
    
    const deltaY = e.clientY - this.resizeStartY;
    const newHeight = this.resizeStartHeight + deltaY;
    
    // Apply height constraints
    const minHeight = 350; // matches CSS min-height
    const maxHeight = 800; // matches CSS max-height

    const constrainedHeight = Math.max(minHeight, Math.min(maxHeight, newHeight));
    
    // Update overlay height
    overlay.style.height = `${constrainedHeight}px`;

    // Update content scroll area height
    this.updateContentScrollHeight();

    // Resize the window to fit the new content size
    this.resizeWindow(constrainedHeight);
  }

  /**
   * Handle mouse up to end resize
   */
  private handleResizeEnd(): void {
    if (!this.isResizing) return;
    
    this.isResizing = false;
    
    // Remove global event listeners
    document.removeEventListener('mousemove', this.boundHandleResizeMove);
    document.removeEventListener('mouseup', this.boundHandleResizeEnd);
    
    // Restore normal cursor and text selection
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
    
    // Save the new size to preferences
    this.saveOverlaySize();
    
    console.log('Finished resizing overlay');
  }

  /**
   * Update content scroll area height based on overlay size
   */
  private updateContentScrollHeight(): void {
    const elements = (window as any).expandedOverlayElements;
    const overlay = elements.expandedOverlay;
    const contentScroll = overlay?.querySelector('.content-scroll') as HTMLElement;

    if (!overlay || !contentScroll) return;

    // Remove any restrictive max-height to allow full expansion
    contentScroll.style.maxHeight = 'none';

    // Let flexbox handle the sizing naturally
    console.log('Content scroll area updated for overlay height:', overlay.offsetHeight);
  }

  /**
   * Resize the Electron window to fit the overlay content
   */
  private async resizeWindow(height: number): Promise<void> {
    try {
      const elements = (window as any).expandedOverlayElements;
      const overlay = elements.expandedOverlay;

      if (!overlay) return;

      // Calculate the required window size with fixed width
      const windowWidth = 670; // Fixed width to accommodate 650px overlay + padding
      const windowHeight = Math.max(470, height + 20); // Add some padding

      // Send resize request to main process
      await (window as any).electronAPI?.invoke('overlay:resize-expanded', {
        id: Date.now().toString(),
        timestamp: Date.now(),
        payload: { width: windowWidth, height: windowHeight }
      });

      console.log(`Window resized to ${windowWidth}x${windowHeight} to fit content height ${height}`);
    } catch (error) {
      console.error('Error resizing window:', error);
    }
  }

  /**
   * Save overlay size to preferences
   */
  private async saveOverlaySize(): Promise<void> {
    try {
      const elements = (window as any).expandedOverlayElements;
      const overlay = elements.expandedOverlay;
      
      if (!overlay) return;
      
      const height = overlay.offsetHeight;
      
      // Save to config via main process
      await (window as any).electronAPI?.invoke('config:set', {
        id: Date.now().toString(),
        timestamp: Date.now(),
        payload: {
          uiSettings: {
            expandedOverlayHeight: height
          }
        }
      });
      
      console.log('Saved overlay height:', height);
    } catch (error) {
      console.error('Error saving overlay size:', error);
    }
  }

  /**
   * Load saved overlay size from preferences
   */
  private async loadOverlaySize(): Promise<void> {
    try {
      const configResponse = await (window as any).electronAPI?.invoke('config:get', {
        id: Date.now().toString(),
        timestamp: Date.now(),
        payload: null
      });

      if (configResponse?.success && configResponse.payload?.uiSettings?.expandedOverlayHeight) {
        const elements = (window as any).expandedOverlayElements;
        const overlay = elements.expandedOverlay;
        
        if (overlay) {
          const savedHeight = configResponse.payload.uiSettings.expandedOverlayHeight;
          const minHeight = 300;
          const constrainedHeight = Math.max(minHeight, savedHeight);
          
          overlay.style.height = `${constrainedHeight}px`;
          this.updateContentScrollHeight();

          // Resize the window to fit the loaded size
          this.resizeWindow(constrainedHeight);

          console.log('Loaded overlay height:', constrainedHeight);
        }
      }
    } catch (error) {
      console.error('Error loading overlay size:', error);
    }
  }

  /**
   * Setup setting control event listeners
   */
  private setupSettingControls(): void {
    // Translation tab controls
    const microphoneSelect = document.getElementById('microphone-select') as HTMLSelectElement;
    if (microphoneSelect) {
      console.log('🎤 Setting up microphone change listener');
      microphoneSelect.addEventListener('change', (e) => {
        const target = e.target as HTMLSelectElement;
        console.log('🎤 Microphone selection changed to:', target.value, 'from:', target.options[target.selectedIndex]?.text);
        this.sendSettingChangeAndSync('selectedMicrophone', target.value);
      });
    } else {
      console.warn('🎤 Microphone select element not found!');
    }

    const languageSelect = document.getElementById('language-select') as HTMLSelectElement;
    languageSelect?.addEventListener('change', (e) => {
      const target = e.target as HTMLSelectElement;
      this.sendSettingChangeAndSync('targetLanguage', target.value);
    });

    const translationVoiceHandler = document.getElementById('voice-select') as HTMLSelectElement;
    translationVoiceHandler?.addEventListener('change', (e) => {
      const target = e.target as HTMLSelectElement;
      this.sendSettingChangeAndSync('voiceId', target.value);
    });

    // Source language
    // Target language (HTML uses 'language-select' for target language)
    const targetLanguage = document.getElementById('language-select') as HTMLSelectElement;
    targetLanguage?.addEventListener('change', (e) => {
      const target = e.target as HTMLSelectElement;
      this.sendToMain('overlay:setting-change', {
        setting: 'targetLanguage',
        value: target.value
      });
    });

    // Main voice selection
    const mainVoiceSelect = document.getElementById('voice-select') as HTMLSelectElement;
    mainVoiceSelect?.addEventListener('change', (e) => {
      const target = e.target as HTMLSelectElement;
      this.sendSettingChangeAndSync('voiceId', target.value);
    });

    // Toggle switches
    this.setupToggleSwitch('ptt-toggle', 'pttEnabled');
    this.setupToggleSwitch('overlay-clickthrough-toggle', 'clickThrough');
    this.setupToggleSwitch('overlay-ontop-toggle', 'alwaysOnTop');

    // Bidirectional output device selector
    const bidirectionalOutputSelect = document.getElementById('bidirectional-output-select') as HTMLSelectElement;
    bidirectionalOutputSelect?.addEventListener('change', (e) => {
      const target = e.target as HTMLSelectElement;
      console.log('🔊 Bidirectional output device changed to:', target.value);
      this.sendSettingChangeAndSync('bidirectionalOutputDeviceId', target.value);
    });

    // Add device change listener to refresh device lists when devices change
    navigator.mediaDevices.addEventListener('devicechange', () => {
      console.log('🔄 Media devices changed, refreshing device lists...');
      this.loadMicrophones();
      this.loadBidirectionalOutputDevices();
    });

    // Incoming voice selector
    const incomingVoiceSelect = document.getElementById('incoming-voice-select') as HTMLSelectElement;
    incomingVoiceSelect?.addEventListener('change', (e) => {
      const target = e.target as HTMLSelectElement;
      this.sendSettingChangeAndSync('incomingVoiceId', target.value);
    });

    // Bidirectional source language selector
    const bidirectionalSourceLanguageSelect = document.getElementById('bidirectional-source-language') as HTMLSelectElement;
    bidirectionalSourceLanguageSelect?.addEventListener('change', (e) => {
      const target = e.target as HTMLSelectElement;
      console.log('🌐 Bidirectional source language changed to:', target.value);
      this.sendSettingChangeAndSync('bidirectionalSourceLanguage', target.value);
    });

    // Bidirectional target language selector
    const bidirectionalTargetLanguageSelect = document.getElementById('bidirectional-target-language') as HTMLSelectElement;
    bidirectionalTargetLanguageSelect?.addEventListener('change', (e) => {
      const target = e.target as HTMLSelectElement;
      console.log('🎯 Bidirectional target language changed to:', target.value);
      this.sendSettingChangeAndSync('bidirectionalTargetLanguage', target.value);
    });

    // Start/Stop Bidirectional button
    const startBidirectionalBtn = document.getElementById('start-bidirectional-button');
    startBidirectionalBtn?.addEventListener('click', () => {
      this.handleBidirectionalButtonClick();
    });

    // Start/Stop Translation button - removed, now using PTT-only mode
    // Users should hold PTT key to start translation

    // Overlay hotkey selector
    const overlayHotkey = document.getElementById('overlay-hotkey') as HTMLSelectElement;
    overlayHotkey?.addEventListener('change', (e) => {
      const key = (e.target as HTMLSelectElement).value;
      (window as any).electronAPI?.invoke('config:set', {
        id: Date.now().toString(), timestamp: Date.now(), payload: {
          uiSettings: { overlaySettings: { toggleHotkey: { ctrl: false, alt: false, shift: false, key } } }
        }
      }).then(() => {
        // Update in-memory hotkey immediately
        (window as any).electronAPI?.invoke('hotkeys:update', { overlayHotkey: { ctrl: false, alt: false, shift: false, key } }).catch(() => {});
      }).catch(() => {});
    });

    // Opacity slider
    const overlayOpacity = document.getElementById('overlay-opacity') as HTMLInputElement;
    overlayOpacity?.addEventListener('input', (e) => {
      const opacity = parseInt((e.target as HTMLInputElement).value) / 100;
      
      console.log(`Opacity slider changed to: ${opacity} (${Math.round(opacity * 100)}%)`);
      
      // Apply opacity change immediately for real-time feedback
      this.applyOpacityChange(opacity);
      
      // Save to settings
      this.sendSettingChangeAndSync('opacity', opacity);
    });

    // GPU mode toggle setup
    this.setupExpandedGPUModeToggle();

    // Load initial data asynchronously to not block initialization - removed since we now call loadAllData at the top level
  }

  /**
   * Setup GPU mode toggle for screen translation Paddle OCR speed
   */
  private async setupExpandedGPUModeToggle(): Promise<void> {
    try {
      const gpuModeToggle = document.getElementById('expanded-gpu-mode-toggle');
      const gpuModeLabel = document.getElementById('expanded-gpu-mode-label');

      if (!gpuModeToggle || !gpuModeLabel) {
        return;
      }

      // Check GPU Paddle status (use quick check for UI responsiveness)
      const quickStatus = await (window as any).electronAPI?.gpuPaddle.quickStatus();
      const hasGPUPaddle = quickStatus?.success && quickStatus.hasGPUPaddle;

      // Get current GPU mode
      const modeResult = await (window as any).electronAPI?.gpuPaddle.getGpuMode();
      const currentMode = modeResult?.mode || 'normal';

      // Set initial toggle state
      if (currentMode === 'fast' && hasGPUPaddle) {
        gpuModeToggle.classList.add('active');
        gpuModeLabel.textContent = 'Fast (GPU)';
      } else {
        gpuModeToggle.classList.remove('active');
        gpuModeLabel.textContent = hasGPUPaddle ? 'Normal (CPU)' : 'Not Installed';
      }

      // Add click handler for toggle
      gpuModeToggle.addEventListener('click', async () => {
        // Use quick status check to avoid timeouts during UI interactions
        const quickStatus = await (window as any).electronAPI?.gpuPaddle.quickStatus();
        const isInstalled = quickStatus?.success && quickStatus.hasGPUPaddle;

        console.log('⚡ Quick GPU Paddle status check:', { isInstalled, fromCache: quickStatus?.fromCache });

        if (!isInstalled) {
          // GPU Paddle not installed - open installation overlay
          console.log('⚡ GPU Paddle not installed, opening installation overlay');
          try {
            await (window as any).electronAPI?.gpuPaddle.showOverlay();
          } catch (error) {
            console.error('Failed to show GPU installation overlay:', error);
          }
          return;
        }

        // GPU Paddle is installed - toggle mode
        const isActive = gpuModeToggle.classList.contains('active');
        const newMode = isActive ? 'normal' : 'fast';

        try {
          // Update mode
          await (window as any).electronAPI?.gpuPaddle.setGpuMode(newMode);

          // Toggle UI
          if (newMode === 'fast') {
            gpuModeToggle.classList.add('active');
            gpuModeLabel.textContent = 'Fast (GPU)';
          } else {
            gpuModeToggle.classList.remove('active');
            gpuModeLabel.textContent = 'Normal (CPU)';
          }

          console.log(`⚡ GPU mode changed to: ${newMode}`);

          // Notify main app to update its UI
          this.sendToMain('overlay:gpu-mode-changed', { mode: newMode });
        } catch (error) {
          console.error('Failed to change GPU mode:', error);
        }
      });

      // Listen for GPU mode changes from main app
      (window as any).electronAPI?.onGpuModeChanged?.((mode: string) => {
        console.log('⚡ Received GPU mode change from main app:', mode);
        if (mode === 'fast') {
          gpuModeToggle.classList.add('active');
          gpuModeLabel.textContent = 'Fast (GPU)';
        } else {
          gpuModeToggle.classList.remove('active');
          gpuModeLabel.textContent = 'Normal (CPU)';
        }
      });
    } catch (error) {
      console.error('Failed to setup expanded GPU mode toggle:', error);
    }
  }

  /**
   * Load bidirectional data (output devices, voices, target languages)
   */
  private async loadBidirectionalData(): Promise<void> {
    try {
      // Load output devices
      await this.loadBidirectionalOutputDevices();
      
      // Load voices for incoming voice selection
      await this.loadIncomingVoices();
      
      // Load target languages
      await this.loadBidirectionalTargetLanguages();
    } catch (error) {
      console.error('Error loading bidirectional data:', error);
    }
  }

  /**
   * Load bidirectional output devices
   */
  private async loadBidirectionalOutputDevices(): Promise<void> {
    try {
      console.log('🔊 Loading bidirectional output devices for overlay...');

      // Request audio permission first to ensure we can access devices
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop()); // Stop the stream immediately
        console.log('🔊 Audio permission granted for output devices');
      } catch (permError) {
        console.warn('🔊 Audio permission denied or failed:', permError);
      }

      // Get output devices using MediaDevices API
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioOutputs = devices.filter(device => device.kind === 'audiooutput');

      console.log('🔊 Found', audioOutputs.length, 'output devices:', audioOutputs.map(d => ({ id: d.deviceId, label: d.label })));

      const outputSelect = document.getElementById('bidirectional-output-select') as HTMLSelectElement;
      if (!outputSelect) {
        console.warn('🔊 Bidirectional output select element not found');
        return;
      }

      outputSelect.innerHTML = '<option value="">Select output device...</option>';

      audioOutputs.forEach((device) => {
        const option = document.createElement('option');
        option.value = device.deviceId;
        option.textContent = device.label || `Output Device ${device.deviceId.slice(0, 8)}...`;
        outputSelect.appendChild(option);
        console.log('🔊 Added output device option:', device.label || device.deviceId);
      });

      // Set current selection from config
      const configResponse = await (window as any).electronAPI?.invoke('config:get', {
        id: Date.now().toString(),
        timestamp: Date.now(),
        payload: null
      });

      if (configResponse?.success && configResponse.payload?.uiSettings?.bidirectionalOutputDeviceId) {
        console.log('🔊 Setting bidirectional output device from config:', configResponse.payload.uiSettings.bidirectionalOutputDeviceId);
        outputSelect.value = configResponse.payload.uiSettings.bidirectionalOutputDeviceId;

        // If the configured device doesn't exist in the list, clear the selection
        if (outputSelect.value !== configResponse.payload.uiSettings.bidirectionalOutputDeviceId) {
          console.warn('🔊 Configured output device not found in device list, clearing selection');
          outputSelect.value = '';
        }
      } else {
        console.log('🔊 No bidirectional output device configured in config');
      }

      console.log('🔊 Bidirectional output device loading completed');
    } catch (error) {
      console.error('🔊 Error loading bidirectional output devices:', error);
      const outputSelect = document.getElementById('bidirectional-output-select') as HTMLSelectElement;
      if (outputSelect) {
        outputSelect.innerHTML = '<option value="">Output device access needed</option>';
      }
    }
  }

  /**
   * Load incoming voices - load all available voices for selection
   */
  private async loadIncomingVoices(): Promise<void> {
    try {
      const response = await (window as any).electronAPI?.invoke('voices:get-available', {
        id: Date.now().toString(),
        timestamp: Date.now(),
        payload: null
      });

      const incomingVoiceSelect = document.getElementById('incoming-voice-select') as HTMLSelectElement;
      if (!incomingVoiceSelect) return;

      incomingVoiceSelect.innerHTML = '<option value="">Loading voices...</option>';

      if (response?.success && response.payload?.voices) {
        incomingVoiceSelect.innerHTML = '<option value="">Select incoming voice...</option>';
        response.payload.voices.forEach((voice: any) => {
          const option = document.createElement('option');
          option.value = voice.voice_id;
          option.textContent = voice.name || voice.voice_id;
          incomingVoiceSelect.appendChild(option);
        });

        // Set current selection from main app config
        const configResponse = await (window as any).electronAPI?.invoke('config:get', {
          id: Date.now().toString(),
          timestamp: Date.now(),
          payload: null
        });

        if (configResponse?.success && configResponse.payload?.uiSettings?.incomingVoiceId) {
          incomingVoiceSelect.value = configResponse.payload.uiSettings.incomingVoiceId;
        }
      } else {
        incomingVoiceSelect.innerHTML = '<option value="">Voice service unavailable</option>';
      }
    } catch (error) {
      console.error('Error loading incoming voices:', error);
      const incomingVoiceSelect = document.getElementById('incoming-voice-select') as HTMLSelectElement;
      if (incomingVoiceSelect) {
        incomingVoiceSelect.innerHTML = '<option value="">Voice loading error</option>';
      }
    }
  }

  /**
   * Load bidirectional target languages (same as translation tab)
   */
  private async loadBidirectionalTargetLanguages(): Promise<void> {
    try {
      const targetLangSelect = document.getElementById('bidirectional-target-language') as HTMLSelectElement;
      if (!targetLangSelect) return;

      // Use same languages as translation tab
      const languages = [
        { code: 'en', name: 'English', flag: '🇺🇸' },
        { code: 'es', name: 'Spanish', flag: '🇪🇸' },
        { code: 'fr', name: 'French', flag: '🇫🇷' },
        { code: 'de', name: 'German', flag: '🇩🇪' },
        { code: 'it', name: 'Italian', flag: '🇮🇹' },
        { code: 'pt', name: 'Portuguese', flag: '🇵🇹' },
        { code: 'ru', name: 'Russian', flag: '🇷🇺' },
        { code: 'ja', name: 'Japanese', flag: '🇯🇵' },
        { code: 'ko', name: 'Korean', flag: '🇰🇷' },
        { code: 'zh', name: 'Chinese', flag: '🇨🇳' },
        { code: 'ar', name: 'Arabic', flag: '🇸🇦' },
        { code: 'hi', name: 'Hindi', flag: '🇮🇳' },
        { code: 'th', name: 'Thai', flag: '🇹🇭' },
        { code: 'vi', name: 'Vietnamese', flag: '🇻🇳' },
        { code: 'tr', name: 'Turkish', flag: '🇹🇷' },
        { code: 'pl', name: 'Polish', flag: '🇵🇱' },
        { code: 'nl', name: 'Dutch', flag: '🇳🇱' },
        { code: 'sv', name: 'Swedish', flag: '🇸🇪' },
        { code: 'da', name: 'Danish', flag: '🇩🇰' },
        { code: 'no', name: 'Norwegian', flag: '🇳🇴' }
      ];

      targetLangSelect.innerHTML = '';
      languages.forEach(language => {
        const option = document.createElement('option');
        option.value = language.code;
        option.textContent = `${language.flag} ${language.name}`;
        targetLangSelect.appendChild(option);
      });

      // Set default value from config
      const configResponse = await (window as any).electronAPI?.invoke('config:get', {
        id: Date.now().toString(),
        timestamp: Date.now(),
        payload: null
      });

      if (configResponse?.success && configResponse.payload?.uiSettings?.bidirectionalTargetLanguage) {
        targetLangSelect.value = configResponse.payload.uiSettings.bidirectionalTargetLanguage;
      } else if (configResponse?.success && configResponse.payload?.targetLanguage) {
        // Fallback to main target language
        targetLangSelect.value = configResponse.payload.targetLanguage;
      }
    } catch (error) {
      console.error('Error loading bidirectional target languages:', error);
    }
  }

  /**
   * Setup toggle switch functionality
   */
  private setupToggleSwitch(elementId: string, settingName: string): void {
    const toggle = document.getElementById(elementId);
    toggle?.addEventListener('click', () => {
      const isActive = toggle.classList.contains('active');
      const newValue = !isActive;
      
      // Optimistically update UI first
      toggle.classList.toggle('active', newValue);
      
      // Send to main app and sync back
      this.sendSettingChangeAndSync(settingName, newValue);
    });
  }

  /**
   * Update overlay state
   */
  private updateState(state: any): void {
    this.currentState = state;
    this.syncSettingsWithState();
  }

  /**
   * Update translation result
   */
  private updateTranslationResult(result: any): void {
    if (!this.currentState) return;
    
    this.currentState.translationResult = result;
    this.syncSettingsWithState();
  }

  /**
   * Sync UI settings with current state
   */
  private syncSettingsWithState(): void {
    if (!this.currentState) return;

    // Update expanded overlay settings to match current state
    const targetLanguage = document.getElementById('language-select') as HTMLSelectElement;
    const stateVoiceSelect = document.getElementById('voice-select') as HTMLSelectElement;
    const overlayHotkey = document.getElementById('overlay-hotkey') as HTMLSelectElement;

    // Update language selections (these would come from main app config)
    // For now, we'll just ensure the UI reflects the current translation result
    if (this.currentState.translationResult) {
      const { sourceLanguage: srcLang, targetLanguage: tgtLang } = this.currentState.translationResult;
      // Note: sourceLanguage is auto-detected, only update targetLanguage
      if (targetLanguage && targetLanguage.value !== tgtLang) {
        targetLanguage.value = tgtLang;
      }
    }

    // Populate overlay hotkey from config via IPC (once)
    if (overlayHotkey) {
      (window as any).electronAPI?.invoke('overlay:get-config', { id: Date.now().toString(), timestamp: Date.now(), payload: null })
        .then((res: any) => {
          const key = res?.success ? (res.payload?.toggleHotkey?.key || 'F11') : 'F11';
          overlayHotkey.value = key;
        }).catch(() => {});
    }
  }

  /**
   * Sync with main app config changes (remote control behavior)
   */
  private syncWithMainAppConfig(config: any): void {
    try {
      // Update microphone selection
      const micSelect = document.getElementById('microphone-select') as HTMLSelectElement;
      if (micSelect && config.selectedMicrophone !== undefined && micSelect.value !== config.selectedMicrophone) {
        micSelect.value = config.selectedMicrophone;
      }

      // Update language selections
      const langSelect = document.getElementById('language-select') as HTMLSelectElement;
      if (langSelect && config.targetLanguage !== undefined && langSelect.value !== config.targetLanguage) {
        langSelect.value = config.targetLanguage;
        console.log('Synced overlay target language to:', config.targetLanguage);
      }

      // Update voice selections
      const voiceSelect = document.getElementById('voice-select') as HTMLSelectElement;
      if (voiceSelect && config.voiceId !== undefined && voiceSelect.value !== config.voiceId) {
        voiceSelect.value = config.voiceId;
        console.log('Synced overlay voice to:', config.voiceId);
      }

      // Update bidirectional voice
      const incomingVoiceSelect = document.getElementById('incoming-voice-select') as HTMLSelectElement;
      if (incomingVoiceSelect && config.uiSettings?.incomingVoiceId !== undefined && incomingVoiceSelect.value !== config.uiSettings.incomingVoiceId) {
        incomingVoiceSelect.value = config.uiSettings.incomingVoiceId;
      }

      // Update bidirectional source language
      const bidirectionalSourceLanguageSelect = document.getElementById('bidirectional-source-language') as HTMLSelectElement;
      if (bidirectionalSourceLanguageSelect && config.uiSettings?.bidirectionalSourceLanguage !== undefined && bidirectionalSourceLanguageSelect.value !== config.uiSettings.bidirectionalSourceLanguage) {
        bidirectionalSourceLanguageSelect.value = config.uiSettings.bidirectionalSourceLanguage;
      }

      // Update bidirectional target language
      const bidirectionalTargetLanguageSelect = document.getElementById('bidirectional-target-language') as HTMLSelectElement;
      if (bidirectionalTargetLanguageSelect && config.uiSettings?.bidirectionalTargetLanguage !== undefined && bidirectionalTargetLanguageSelect.value !== config.uiSettings.bidirectionalTargetLanguage) {
        bidirectionalTargetLanguageSelect.value = config.uiSettings.bidirectionalTargetLanguage;
      }

      // Update bidirectional output device
      const outputSelect = document.getElementById('bidirectional-output-select') as HTMLSelectElement;
      if (outputSelect && config.uiSettings?.bidirectionalOutputDeviceId !== undefined && outputSelect.value !== config.uiSettings.bidirectionalOutputDeviceId) {
        outputSelect.value = config.uiSettings.bidirectionalOutputDeviceId;
      }

      // Update toggle switches
      const pttToggle = document.getElementById('ptt-toggle');
      if (pttToggle && config.pttEnabled !== undefined) {
        pttToggle.classList.toggle('active', config.pttEnabled);
      }

      const clickThroughToggle = document.getElementById('overlay-clickthrough-toggle');
      if (clickThroughToggle && config.clickThrough !== undefined) {
        clickThroughToggle.classList.toggle('active', config.clickThrough);
      }

      const onTopToggle = document.getElementById('overlay-ontop-toggle');
      if (onTopToggle && config.alwaysOnTop !== undefined) {
        onTopToggle.classList.toggle('active', config.alwaysOnTop);
      }

      // Update opacity slider
      const opacitySlider = document.getElementById('overlay-opacity') as HTMLInputElement;
      if (opacitySlider && config.opacity !== undefined) {
        opacitySlider.value = Math.round(config.opacity * 100).toString();
        // Apply the opacity change immediately
        this.applyOpacityChange(config.opacity);
      }

      // Update hotkey selectors
      const overlayHotkey = document.getElementById('overlay-hotkey') as HTMLSelectElement;
      if (overlayHotkey && config.uiSettings?.overlaySettings?.toggleHotkey?.key) {
        overlayHotkey.value = config.uiSettings.overlaySettings.toggleHotkey.key;
      }

      console.log('Synced overlay with main app config:', Object.keys(config));
    } catch (error) {
      console.error('Error syncing with main app config:', error);
    }
  }

  /**
   * Load and display keybinds from configuration
   */
  private async loadKeybinds(): Promise<void> {
    try {
      const configResponse = await (window as any).electronAPI?.invoke('config:get', {
        id: Date.now().toString(),
        timestamp: Date.now(),
        payload: null
      });

      if (!configResponse?.success) {
        console.warn('Failed to load config for keybinds');
        return;
      }

      const cfg = configResponse.payload;

      // Helper function to format keybind display
      const formatKeybindDisplay = (keybind: string): string => {
        if (keybind === 'Space') return 'SPACE';
        if (keybind.startsWith('Key')) return keybind.substring(3);
        if (keybind.startsWith('Digit')) return keybind.substring(5);
        if (keybind.startsWith('Numpad')) return 'Numpad ' + keybind.substring(6);
        return keybind;
      };

      // Load PTT hotkey
      const pttHotkey = cfg.uiSettings?.pttHotkey || { ctrl: false, alt: false, shift: false, key: 'Space' };
      const modifierKey = this.getModifierKeyName();
      const pttModifiers = [];
      if (pttHotkey.ctrl) pttModifiers.push('Ctrl');
      if (pttHotkey.alt) pttModifiers.push(modifierKey);
      if (pttHotkey.shift) pttModifiers.push('Shift');
      const pttKeyDisplay = pttHotkey.key === 'Space' ? 'SPACE' : pttHotkey.key;
      const pttKey = pttModifiers.length > 0 ? `${pttModifiers.join(' + ')} + ${pttKeyDisplay}` : pttKeyDisplay;

      const pttDisplay = document.getElementById('overlay-ptt-keybind-display');
      const pttLabelDisplay = document.getElementById('ptt-key-display'); // New label display
      const currentKeybindDisplay = document.getElementById('current-keybind');
      
      if (pttDisplay) pttDisplay.textContent = pttKey;
      if (pttLabelDisplay) pttLabelDisplay.textContent = pttKey; // Update new label
      if (currentKeybindDisplay) currentKeybindDisplay.textContent = pttKey;

      // Load bidirectional hotkey
      const bidiHotkey = cfg.uiSettings?.bidirectionalHotkey || { ctrl: false, alt: true, shift: false, key: 'B' };
      const bidiModifiers = [];
      if (bidiHotkey.ctrl) bidiModifiers.push('Ctrl');
      if (bidiHotkey.alt) bidiModifiers.push(modifierKey);
      if (bidiHotkey.shift) bidiModifiers.push('Shift');
      const bidiKey = bidiModifiers.length > 0 ? `${bidiModifiers.join(' + ')} + ${bidiHotkey.key}` : bidiHotkey.key;

      const bidiDisplay = document.getElementById('overlay-bidi-keybind-display');
      if (bidiDisplay) bidiDisplay.textContent = bidiKey;

      // Load screen translation hotkey
      const screenHotkey = cfg.uiSettings?.screenTranslationHotkey || { ctrl: false, alt: true, shift: false, key: 'T' };
      const screenModifiers = [];
      if (screenHotkey.ctrl) screenModifiers.push('Ctrl');
      if (screenHotkey.alt) screenModifiers.push(modifierKey);
      if (screenHotkey.shift) screenModifiers.push('Shift');
      const screenKey = screenModifiers.length > 0 ? `${screenModifiers.join(' + ')} + ${screenHotkey.key}` : screenHotkey.key;

      const screenDisplay = document.getElementById('overlay-screen-keybind-display');
      if (screenDisplay) screenDisplay.textContent = screenKey;

      // Load overlay toggle hotkey
      const isMacOS = (window as any).electronAPI?.platform === 'darwin';
      const defaultOverlayHotkey = isMacOS 
        ? { ctrl: false, alt: false, shift: false, key: '-' }  // "-" key on macOS
        : { ctrl: false, alt: false, shift: false, key: 'F11' }; // F11 on Windows/Linux
      const overlayToggleHotkey = cfg.uiSettings?.overlaySettings?.toggleHotkey || defaultOverlayHotkey;
      const overlayModifiers = [];
      if (overlayToggleHotkey.ctrl) overlayModifiers.push('Ctrl');
      if (overlayToggleHotkey.alt) overlayModifiers.push(modifierKey);
      if (overlayToggleHotkey.shift) overlayModifiers.push('Shift');
      const overlayToggleKeyFormatted = formatKeybindDisplay(overlayToggleHotkey.key);
      const overlayToggleKey = overlayModifiers.length > 0 ? `${overlayModifiers.join(' + ')} + ${overlayToggleKeyFormatted}` : overlayToggleKeyFormatted;

      const overlayDisplay = document.getElementById('overlay-toggle-keybind-display');
      if (overlayDisplay) overlayDisplay.textContent = overlayToggleKey;

      console.log('[Expanded Overlay] Loaded keybinds from config');
    } catch (error) {
      console.error('Failed to load keybinds in expanded overlay:', error);
    }
  }

  /**
   * Setup listener for config updates from other windows
   */
  private setupConfigUpdateListener(): void {
    (window as any).electronAPI?.on?.('config:updated', (config: any) => {
      console.log('[Expanded Overlay] Config updated from another window, reloading keybinds');
      this.loadKeybinds();
    });

    // Listen for screen translation keybind updates
    (window as any).electronAPI?.on?.('screen-translation-keybind-updated', (_event: any, data: any) => {
      console.log('[Expanded Overlay] Screen translation keybind updated:', data.keybind);
      if (data.keybind) {
        const modifierKey = this.getModifierKeyName();
        const displayKey = data.keybind.startsWith('Key') ? data.keybind.substring(3) : data.keybind;
        const screenDisplay = document.getElementById('screen-translation-keybind-display');
        if (screenDisplay) {
          screenDisplay.textContent = `${modifierKey} + ${displayKey}`;
        }
      }
    });
  }

  /**
   * Setup keybind change handlers for all keybind change buttons
   */
  private setupKeybindChangeHandlers(): void {
    // Helper function to format keybind display
    const formatKeybindDisplay = (keybind: string): string => {
      if (keybind === 'Space') return 'SPACE';
      if (keybind.startsWith('Key')) return keybind.substring(3);
      if (keybind.startsWith('Digit')) return keybind.substring(5);
      if (keybind.startsWith('Numpad')) return 'Numpad ' + keybind.substring(6);
      return keybind;
    };

    // Helper function to create keybind modal
    const createKeybindModal = (title: string, currentKeybind: string, onSave: (newKeybind: string) => void) => {
      const modal = document.createElement('div');
      modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0, 0, 0, 0.85); backdrop-filter: blur(4px);
        display: flex; justify-content: center; align-items: center; z-index: 2147483648;
      `;

      const modalContent = document.createElement('div');
      modalContent.style.cssText = `
        background: #1a1a1a; border: 2px solid #3b82f6; border-radius: 12px;
        padding: 30px; max-width: 500px; width: 90%;
      `;

      modalContent.innerHTML = `
        <h3 style="color: #3b82f6; margin: 0 0 20px 0; font-size: 1.3rem;">${title}</h3>
        <p style="color: #ccc; margin-bottom: 20px;">Press any key to set as the new keybind...</p>
        <div style="background: #0a0a0a; border: 2px solid #3b82f6; border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 20px;">
          <div style="font-size: 1.5rem; color: #3b82f6; font-weight: bold; font-family: monospace;" id="keybind-preview">${formatKeybindDisplay(currentKeybind)}</div>
        </div>
        <div style="display: flex; gap: 10px; justify-content: flex-end;">
          <button id="cancel-keybind-modal" style="padding: 10px 20px; background: #333; color: #fff; border: none; border-radius: 6px; cursor: pointer;">Cancel</button>
        </div>
      `;

      modal.appendChild(modalContent);
      document.body.appendChild(modal);

      const preview = modalContent.querySelector('#keybind-preview') as HTMLElement;
      const cancelBtn = modalContent.querySelector('#cancel-keybind-modal') as HTMLButtonElement;

      let newKeybind = currentKeybind;

      const keydownHandler = (e: KeyboardEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (e.key === 'Escape') {
          document.body.removeChild(modal);
          document.removeEventListener('keydown', keydownHandler);
          return;
        }

        newKeybind = e.code;
        preview.textContent = formatKeybindDisplay(newKeybind);

        setTimeout(() => {
          onSave(newKeybind);
          document.body.removeChild(modal);
          document.removeEventListener('keydown', keydownHandler);
        }, 300);
      };

      document.addEventListener('keydown', keydownHandler);

      cancelBtn.addEventListener('click', () => {
        document.body.removeChild(modal);
        document.removeEventListener('keydown', keydownHandler);
      });
    };

    // PTT Change Button
    const pttChangeBtn = document.getElementById('overlay-ptt-change');
    if (pttChangeBtn) {
      pttChangeBtn.addEventListener('click', () => {
        const pttDisplay = document.getElementById('overlay-ptt-keybind-display');
        const pttLabelDisplay = document.getElementById('ptt-key-display'); // New label display
        const currentKey = pttDisplay?.textContent || 'SPACE';
        createKeybindModal('Change Push-to-Talk Key', currentKey, async (newKeybind) => {
          if (pttDisplay) pttDisplay.textContent = formatKeybindDisplay(newKeybind);
          if (pttLabelDisplay) pttLabelDisplay.textContent = formatKeybindDisplay(newKeybind); // Update new label

          const keyForStorage = newKeybind === 'Space' ? 'Space' : (newKeybind.startsWith('Key') ? newKeybind.substring(3) : newKeybind);

          // ENFORCE: Space bar MUST have Ctrl for PTT - hardcode it
          let hotkey = { ctrl: false, alt: false, shift: false, key: keyForStorage };
          const isFunctionKey = (key: string): boolean => {
            return /^F\d{1,2}$/.test(key);
          };
          
          if (keyForStorage === 'Space') {
            hotkey.ctrl = true;
            hotkey.alt = false;
            hotkey.shift = false;
            console.log('🚫 Space bar requires Ctrl for PTT - enforcing Ctrl+Space');
          } else if (!isFunctionKey(keyForStorage)) {
            // ENFORCE: Non-function keys (except Space) MUST have Alt
            hotkey.alt = true;
            hotkey.ctrl = false;
            hotkey.shift = false;
            console.log(`🚫 ${keyForStorage} requires Alt for PTT - enforcing Alt+${keyForStorage}`);
          }

          try {
            await (window as any).electronAPI.invoke('config:set', {
              id: Date.now().toString(),
              timestamp: Date.now(),
              payload: { uiSettings: { pttHotkey: hotkey } }
            });

            await (window as any).electronAPI.invoke('hotkeys:update', {
              pttHotkey: hotkey
            });

            console.log(`✅ PTT key changed to ${formatKeybindDisplay(newKeybind)}`);
          } catch (error) {
            console.error('Failed to update PTT keybind:', error);
          }
        });
      });
    }

    // Bidirectional Change Button
    const bidiChangeBtn = document.getElementById('overlay-bidi-change');
    if (bidiChangeBtn) {
      bidiChangeBtn.addEventListener('click', () => {
        const modifierKey = this.getModifierKeyName();
        const bidiDisplay = document.getElementById('overlay-bidi-keybind-display');
        const currentDisplay = bidiDisplay?.textContent || `${modifierKey} + B`;
        const currentKey = currentDisplay.replace(`${modifierKey} + `, '');
        createKeybindModal('Change Bidirectional Key', `Key${currentKey}`, async (newKeybind) => {
          const keyForStorage = newKeybind.startsWith('Key') ? newKeybind.substring(3) : newKeybind;
          const displayKey = `${modifierKey} + ${keyForStorage}`;

          if (bidiDisplay) bidiDisplay.textContent = displayKey;

          try {
            await (window as any).electronAPI.invoke('config:set', {
              id: Date.now().toString(),
              timestamp: Date.now(),
              payload: { uiSettings: { bidirectionalHotkey: { ctrl: false, alt: true, shift: false, key: keyForStorage } } }
            });

            await (window as any).electronAPI.invoke('hotkeys:update', {
              bidirectionalHotkey: { ctrl: false, alt: true, shift: false, key: keyForStorage }
            });

            console.log(`✅ Bidirectional key changed to ${modifierKey} + ${keyForStorage}`);
          } catch (error) {
            console.error('Failed to update bidirectional keybind:', error);
          }
        });
      });
    }

    // Screen Translation Change Button
    const screenChangeBtn = document.getElementById('overlay-screen-change');
    if (screenChangeBtn) {
      screenChangeBtn.addEventListener('click', () => {
        const modifierKey = this.getModifierKeyName();
        const screenDisplay = document.getElementById('overlay-screen-keybind-display');
        const currentDisplay = screenDisplay?.textContent || `${modifierKey} + T`;
        const currentKey = currentDisplay.replace(`${modifierKey} + `, '');
        createKeybindModal('Change Screen Translation Key', `Key${currentKey}`, async (newKeybind) => {
          const keyForStorage = newKeybind.startsWith('Key') ? newKeybind.substring(3) : newKeybind;
          const displayKey = `${modifierKey} + ${keyForStorage}`;

          if (screenDisplay) screenDisplay.textContent = displayKey;

          try {
            await (window as any).electronAPI.invoke('config:set', {
              id: Date.now().toString(),
              timestamp: Date.now(),
              payload: { uiSettings: { screenTranslationHotkey: { ctrl: false, alt: true, shift: false, key: keyForStorage } } }
            });

            await (window as any).electronAPI.invoke('hotkeys:update', {
              screenTranslationHotkey: { ctrl: false, alt: true, shift: false, key: keyForStorage }
            });

            console.log(`✅ Screen Translation key changed to ${modifierKey} + ${keyForStorage}`);
          } catch (error) {
            console.error('Failed to update screen translation keybind:', error);
          }
        });
      });
    }

    // Overlay Toggle Change Button
    const overlayToggleChangeBtn = document.getElementById('overlay-toggle-change');
    if (overlayToggleChangeBtn) {
      overlayToggleChangeBtn.addEventListener('click', () => {
        const overlayDisplay = document.getElementById('overlay-toggle-keybind-display');
        const currentKey = overlayDisplay?.textContent || 'F11';
        createKeybindModal('Change Overlay Toggle Key', currentKey, async (newKeybind) => {
          if (overlayDisplay) overlayDisplay.textContent = formatKeybindDisplay(newKeybind);

          try {
            await (window as any).electronAPI.invoke('config:set', {
              id: Date.now().toString(),
              timestamp: Date.now(),
              payload: {
                uiSettings: {
                  overlaySettings: {
                    enabled: true,
                    toggleHotkey: {
                      ctrl: false,
                      alt: false,
                      shift: false,
                      key: newKeybind
                    }
                  }
                }
              }
            });

            await (window as any).electronAPI.invoke('hotkeys:update', {
              overlayHotkey: { ctrl: false, alt: false, shift: false, key: newKeybind }
            });

            console.log(`✅ Overlay toggle key changed to ${formatKeybindDisplay(newKeybind)}`);
          } catch (error) {
            console.error('Failed to update overlay toggle keybind:', error);
          }
        });
      });
    }
  }

  /**
   * Load current config from main app and sync all controls
   */
  private async loadAndSyncCurrentConfig(): Promise<void> {
    try {
      const configResponse = await (window as any).electronAPI?.invoke('config:get', {
        id: Date.now().toString(),
        timestamp: Date.now(),
        payload: null
      });

      if (configResponse?.success) {
        this.syncWithMainAppConfig(configResponse.payload);
      }
    } catch (error) {
      console.error('Error loading current config:', error);
    }
  }

  /**
   * Load screen translation tab data
   */
  private async loadScreenTranslationData(): Promise<void> {
    try {
      // Load screen sources
      await this.loadScreenSources();

      // Load languages for source and target
      await this.loadScreenTranslationLanguages();

      // Load current keybind
      await this.loadScreenTranslationKeybind();

      // Setup event listeners
      this.setupScreenTranslationControls();
    } catch (error) {
      console.error('Error loading screen translation data:', error);
    }
  }

  /**
   * Load available screen sources (screens only, not windows)
   */
  private async loadScreenSources(): Promise<void> {
    try {
      // Get screen sources and displays to map properly
      const [screenSources, displays] = await Promise.all([
        (window as any).electronAPI?.invoke('get-desktop-sources', ['screen']),
        (window as any).electronAPI?.invoke('get-displays')
      ]);

      const screenSelect = document.getElementById('screen-selection') as HTMLSelectElement;
      if (!screenSelect) return;

      screenSelect.innerHTML = '<option value="">Select screen...</option>';

      if (screenSources && Array.isArray(screenSources) && displays && Array.isArray(displays)) {
        // Sort displays by position (left to right, top to bottom)
        const sortedDisplays = displays.sort((a: any, b: any) => {
          if (a.bounds.x !== b.bounds.x) return a.bounds.x - b.bounds.x;
          return a.bounds.y - b.bounds.y;
        });

        // Create mapping between display IDs and screen sources
        const displayToSourceMap = new Map();
        screenSources.forEach((source: any) => {
          if (source.display_id) {
            displayToSourceMap.set(source.display_id.toString(), source.id);
          }
        });

        // Add options using display IDs as values (matching main app)
        sortedDisplays.forEach((display: any, index: number) => {
          const option = document.createElement('option');
          option.value = display.id.toString();

          // Display as "Screen 1", "Screen 2", etc.
          option.textContent = `Screen ${index + 1}`;
          screenSelect.appendChild(option);
        });
      }

      // Load saved selection from main app (config uses displayId)
      const configResponse = await (window as any).electronAPI?.invoke('config:get', {
        id: Date.now().toString(),
        timestamp: Date.now(),
        payload: null
      });

      if (configResponse?.success && configResponse.payload?.screenTranslation?.displayId) {
        screenSelect.value = configResponse.payload.screenTranslation.displayId;
      }
    } catch (error) {
      console.error('Error loading screen sources:', error);
    }
  }

  /**
   * Load languages for screen translation (matching main app)
   */
  private async loadScreenTranslationLanguages(): Promise<void> {
    try {
      // Target languages (Translate To) - same as main app screen-translation-target-lang
      const targetLanguages = [
        { code: 'en', name: 'English' },
        { code: 'es', name: 'Spanish' },
        { code: 'fr', name: 'French' },
        { code: 'de', name: 'German' },
        { code: 'it', name: 'Italian' },
        { code: 'pt', name: 'Portuguese' },
        { code: 'ru', name: 'Russian' },
        { code: 'ja', name: 'Japanese' },
        { code: 'ko', name: 'Korean' },
        { code: 'zh', name: 'Chinese' },
        { code: 'ar', name: 'Arabic' },
        { code: 'hi', name: 'Hindi' }
      ];

      // Source languages (Translate Language) - same as main app screen-translation-source-lang
      const sourceLanguages = [
        { code: 'auto', name: 'Auto-detect' },
        { code: 'en', name: 'English' },
        { code: 'es', name: 'Spanish' },
        { code: 'fr', name: 'French' },
        { code: 'de', name: 'German' },
        { code: 'it', name: 'Italian' },
        { code: 'pt', name: 'Portuguese' },
        { code: 'ru', name: 'Russian' },
        { code: 'ja', name: 'Japanese' },
        { code: 'ko', name: 'Korean' },
        { code: 'zh', name: 'Chinese' },
        { code: 'ar', name: 'Arabic' },
        { code: 'hi', name: 'Hindi' },
        { code: 'th', name: 'Thai' },
        { code: 'vi', name: 'Vietnamese' },
        { code: 'nl', name: 'Dutch' },
        { code: 'sv', name: 'Swedish' },
        { code: 'no', name: 'Norwegian' },
        { code: 'da', name: 'Danish' },
        { code: 'fi', name: 'Finnish' },
        { code: 'pl', name: 'Polish' },
        { code: 'cs', name: 'Czech' },
        { code: 'hu', name: 'Hungarian' },
        { code: 'ro', name: 'Romanian' },
        { code: 'bg', name: 'Bulgarian' },
        { code: 'hr', name: 'Croatian' },
        { code: 'sk', name: 'Slovak' }
      ];

      const sourceSelect = document.getElementById('screen-source-language') as HTMLSelectElement;
      const targetSelect = document.getElementById('screen-target-language') as HTMLSelectElement;

      if (targetSelect) {
        targetSelect.innerHTML = '';
        targetLanguages.forEach(lang => {
          const option = document.createElement('option');
          option.value = lang.code;
          option.textContent = lang.name;
          targetSelect.appendChild(option);
        });
      }

      if (sourceSelect) {
        sourceSelect.innerHTML = '';
        sourceLanguages.forEach(lang => {
          const option = document.createElement('option');
          option.value = lang.code;
          option.textContent = lang.name;
          sourceSelect.appendChild(option);
        });
      }

      // Load saved selections from config (sync with main app)
      const configResponse = await (window as any).electronAPI?.invoke('config:get', {
        id: Date.now().toString(),
        timestamp: Date.now(),
        payload: null
      });

      if (configResponse?.success) {
        if (targetSelect && configResponse.payload?.screenTranslation?.targetLanguage) {
          targetSelect.value = configResponse.payload.screenTranslation.targetLanguage;
        }
        if (sourceSelect && configResponse.payload?.screenTranslation?.sourceLanguage) {
          sourceSelect.value = configResponse.payload.screenTranslation.sourceLanguage;
        }
      }
    } catch (error) {
      console.error('Error loading screen translation languages:', error);
    }
  }

  /**
   * Load current screen translation keybind from main app config
   */
  private async loadScreenTranslationKeybind(): Promise<void> {
    try {
      const configResponse = await (window as any).electronAPI?.invoke('config:get', {
        id: Date.now().toString(),
        timestamp: Date.now(),
        payload: null
      });

      const keybindDisplay = document.getElementById('screen-translation-keybind-display');
      if (keybindDisplay && configResponse?.success) {
        // Get from uiSettings.screenTranslationHotkey (same as main app)
        const defaultHotkey = { ctrl: false, alt: true, shift: false, key: 'T' };
        const hotkey = configResponse.payload?.uiSettings?.screenTranslationHotkey || defaultHotkey;

        // Display as "Alt + T" (matching main app format)
        const modifierKey = this.getModifierKeyName();
        keybindDisplay.textContent = `${modifierKey} + ${hotkey.key}`;
      }
    } catch (error) {
      console.error('Error loading screen translation keybind:', error);
    }
  }

  /**
   * Setup screen translation controls (remote control for main app)
   */
  private setupScreenTranslationControls(): void {
    const screenSelect = document.getElementById('screen-selection') as HTMLSelectElement;
    const sourceLanguageSelect = document.getElementById('screen-source-language') as HTMLSelectElement;
    const targetLanguageSelect = document.getElementById('screen-target-language') as HTMLSelectElement;
    const refreshSourcesBtn = document.getElementById('screen-refresh-sources');
    const changeKeybindBtn = document.getElementById('screen-translation-change-keybind');

    // Screen selection
    screenSelect?.addEventListener('change', async (e) => {
      const target = e.target as HTMLSelectElement;
      console.log('[Screen Translation Overlay] Screen selection changed to:', target.value);

      // Send to main app to update DOM and config (same pattern as language handlers)
      this.sendToMain('screen-translation:set-screen-source', {
        screenSource: target.value
      });
    });

    // Refresh sources button
    refreshSourcesBtn?.addEventListener('click', () => {
      this.loadScreenSources();
    });

    // Target language (Translate To)
    targetLanguageSelect?.addEventListener('change', async (e) => {
      const target = e.target as HTMLSelectElement;
      console.log('[Screen Translation Overlay] Target language changed to:', target.value);

      // Send to main app to update the screen-translation-target-lang select element
      this.sendToMain('screen-translation:set-target-language', {
        targetLanguage: target.value
      });
    });

    // Source language (Translate Language)
    sourceLanguageSelect?.addEventListener('change', async (e) => {
      const target = e.target as HTMLSelectElement;
      console.log('[Screen Translation Overlay] Source language changed to:', target.value);

      // Send to main app to update the screen-translation-source-lang select element
      this.sendToMain('screen-translation:set-source-language', {
        sourceLanguage: target.value
      });
    });

    changeKeybindBtn?.addEventListener('click', async () => {
      // Click the main app's change keybind button
      const result = await (window as any).electronAPI?.invoke('screen-translation:click-change-keybind');

      if (result?.success) {
        // Start listening for keypress in overlay to send to main app
        this.listenForKeybindChange();
      }
    });
  }

  /**
   * Listen for keypress to change screen translation keybind
   */
  private listenForKeybindChange(): void {
    let set = false;
    const listener = async (e: KeyboardEvent) => {
      if (set) return;

      // Require Alt key to be pressed
      if (!e.altKey) {
        return;
      }

      // Ignore if only modifier keys are pressed
      if (e.key === 'Alt' || e.key === 'Control' || e.key === 'Shift' || e.key === 'Meta') {
        return;
      }

      set = true;
      e.preventDefault();

      // Convert to KeyX format if needed
      const keyForStorage = e.code.startsWith('Key') ? e.code.substring(3) : e.code;
      const modifierKey = this.getModifierKeyName();

      console.log('[Screen Translation Overlay] Keybind changed to:', `${modifierKey} + ${keyForStorage}`);

      // Send to main app to save the keybind
      const result = await (window as any).electronAPI?.invoke('screen-translation:set-keybind-key', {
        key: keyForStorage,
        code: e.code
      });

      // Update overlay display immediately
      const keybindDisplay = document.getElementById('screen-translation-keybind-display');
      if (keybindDisplay) {
        keybindDisplay.textContent = `${modifierKey} + ${keyForStorage}`;
      }

      document.removeEventListener('keydown', listener);

      console.log('[Screen Translation Overlay] Keybind saved:', result);
    };

    document.addEventListener('keydown', listener);

    // Listen for cancel event from main app
    const cancelListener = () => {
      document.removeEventListener('keydown', listener);
      (window as any).electronAPI?.off?.('screen-translation:keybind-cancel', cancelListener);
    };

    if ((window as any).electronAPI?.on) {
      (window as any).electronAPI.on('screen-translation:keybind-cancel', cancelListener);
    }
  }

  /**
   * Sync screen translation settings from main app (bidirectional sync)
   */
  private syncScreenTranslationSettings(data: any): void {
    const screenSelect = document.getElementById('screen-selection') as HTMLSelectElement;
    const sourceSelect = document.getElementById('screen-source-language') as HTMLSelectElement;
    const targetSelect = document.getElementById('screen-target-language') as HTMLSelectElement;
    const keybindDisplay = document.getElementById('screen-translation-keybind-display');

    // Handle both screenSource and displayId (config uses displayId)
    const newScreenValue = data.screenSource || data.displayId;
    if (screenSelect && newScreenValue !== undefined && screenSelect.value !== newScreenValue) {
      screenSelect.value = newScreenValue;
      console.log('[Expanded Overlay] Synced screen translation screen source to:', newScreenValue);
    }

    if (sourceSelect && data.sourceLanguage !== undefined && sourceSelect.value !== data.sourceLanguage) {
      sourceSelect.value = data.sourceLanguage;
      console.log('[Expanded Overlay] Synced screen translation source language to:', data.sourceLanguage);
    }

    if (targetSelect && data.targetLanguage !== undefined && targetSelect.value !== data.targetLanguage) {
      targetSelect.value = data.targetLanguage;
      console.log('[Expanded Overlay] Synced screen translation target language to:', data.targetLanguage);
    }

    // Handle keybind sync - data.keybind contains the hotkey object from config
    if (keybindDisplay && data.keybind !== undefined) {
      // If it's a hotkey object, format it properly
      if (typeof data.keybind === 'object' && data.keybind.key) {
        const modifierKey = this.getModifierKeyName();
        const displayText = `${modifierKey} + ${data.keybind.key}`;
        if (keybindDisplay.textContent !== displayText) {
          keybindDisplay.textContent = displayText;
          console.log('[Expanded Overlay] Synced screen translation keybind to:', displayText);
        }
      }
    }
  }


  /**
   * Switch between tabs in expanded mode
   */
  private switchTab(tab: 'translation' | 'bidirectional' | 'screen-translation' | 'quick-translate' | 'soundboard' | 'overlay-settings'): void {
    const elements = (window as any).expandedOverlayElements;

    // Update tab buttons
    elements.translationTab?.classList.toggle('active', tab === 'translation');
    elements.bidirectionalTab?.classList.toggle('active', tab === 'bidirectional');
    elements.screenTranslationTab?.classList.toggle('active', tab === 'screen-translation');
    elements.quickTranslateTab?.classList.toggle('active', tab === 'quick-translate');
    elements.soundboardTab?.classList.toggle('active', tab === 'soundboard');
    elements.overlaySettingsTab?.classList.toggle('active', tab === 'overlay-settings');

    // Update tab content
    elements.translationContent?.classList.toggle('hidden', tab !== 'translation');
    elements.bidirectionalContent?.classList.toggle('hidden', tab !== 'bidirectional');
    elements.screenTranslationContent?.classList.toggle('hidden', tab !== 'screen-translation');
    elements.quickTranslateContent?.classList.toggle('hidden', tab !== 'quick-translate');
    elements.soundboardContent?.classList.toggle('hidden', tab !== 'soundboard');
    elements.overlaySettingsContent?.classList.toggle('hidden', tab !== 'overlay-settings');

    // Initialize soundboard when tab is opened
    if (tab === 'soundboard') {
      this.initializeSoundboard().catch(error => {
        console.error('Error initializing soundboard:', error);
      });
    }
  }

  /**
   * Handle translation button click (start/stop)
   */
  private handleTranslationButtonClick(): void {
    const startButton = document.getElementById('start-button');
    if (!startButton) return;

    const buttonText = startButton.textContent || '';
    const isRunning = buttonText.includes('Stop') || buttonText.includes('⏹️');

    console.log('[Overlay] Translation button clicked, current text:', buttonText, 'isRunning:', isRunning);
    console.log('[Overlay] Current button element:', startButton);
    
    if (isRunning) {
      console.log('[Overlay] Sending stop translation command to main app');
      // Send control message to main app to stop translation
      this.sendToMain('overlay:control-translation', {
        id: Date.now().toString(),
        timestamp: Date.now(),
        payload: { action: 'stop' }
      });
    } else {
      console.log('[Overlay] Sending start translation command to main app');
      // Gather current configuration before starting
      const microphoneSelect = document.getElementById('microphone-select') as HTMLSelectElement;
      const languageSelect = document.getElementById('language-select') as HTMLSelectElement;
      const voiceSelect = document.getElementById('voice-select') as HTMLSelectElement;
      const outputToggleButton = document.getElementById('output-toggle-button');
      
      const config = {
        microphoneId: microphoneSelect?.value || '',
        targetLanguage: languageSelect?.value || 'en',
        voiceId: voiceSelect?.value || '',
        outputToVirtualMic: outputToggleButton?.textContent?.includes('Virtual') || true
      };

      // Send control message to main app to start translation
      this.sendToMain('overlay:control-translation', {
        id: Date.now().toString(),
        timestamp: Date.now(),
        payload: { action: 'start', config: config }
      });
    }
  }

  /**
   * Handle bidirectional button click (start/stop)
   */
  private handleBidirectionalButtonClick(): void {
    // Check if on Mac - bidirectional not available
    const isMac = (window as any).electronAPI?.platform === 'darwin';
    if (isMac) {
      console.log('[Overlay] 🍎 Bidirectional mode is not available on macOS');
      return;
    }

    const startBidirectionalBtn = document.getElementById('start-bidirectional-button');
    if (!startBidirectionalBtn) return;

    const buttonText = startBidirectionalBtn.textContent || '';
    const isRunning = buttonText.includes('Stop') || buttonText.includes('⏹️');
    
    console.log('[Overlay] Bidirectional button clicked, current text:', buttonText, 'isRunning:', isRunning);
    
    if (isRunning) {
      console.log('[Overlay] Sending stop bidirectional command');
      this.sendToMain('bidirectional:stop', {
        id: Date.now().toString(),
        timestamp: Date.now(),
        payload: null
      });
    } else {
      console.log('[Overlay] Sending start bidirectional command');
      // Gather bidirectional configuration
      const outputSelect = document.getElementById('bidirectional-output-select') as HTMLSelectElement;
      const incomingVoiceSelect = document.getElementById('incoming-voice-select') as HTMLSelectElement;
      
      const config = {
        outputDevice: outputSelect?.value || '',
        incomingVoiceId: incomingVoiceSelect?.value || ''
      };

      this.sendToMain('bidirectional:start', {
        id: Date.now().toString(),
        timestamp: Date.now(),
        payload: config
      });
    }
  }

  /**
   * Update translation button state
   */
  private updateTranslationButton(isRunning: boolean): void {
    const startButton = document.getElementById('start-button');
    if (!startButton) return;

    console.log('[Expanded Overlay] Updating translation button, isRunning:', isRunning);
    
    if (isRunning) {
      startButton.textContent = '⏹️ Stop Translation';
      startButton.style.background = 'rgba(244, 67, 67, 0.9)';
      startButton.style.color = 'white';
    } else {
      startButton.textContent = '▶️ Start Translation';
      startButton.style.background = '';
      startButton.style.color = '';
    }
  }

  /**
   * Update bidirectional button state
   */
  private updateBidirectionalButton(isRunning: boolean): void {
    const startBidirectionalBtn = document.getElementById('start-bidirectional-button');
    if (!startBidirectionalBtn) return;

    if (isRunning) {
      startBidirectionalBtn.textContent = '⏹️ Stop Bidirectional';
      startBidirectionalBtn.style.background = 'rgba(244, 67, 67, 0.9)';
      startBidirectionalBtn.style.color = 'white';
    } else {
      startBidirectionalBtn.textContent = '▶️ Start Bidirectional';
      startBidirectionalBtn.style.background = '';
      startBidirectionalBtn.style.color = '';
    }
  }

  /**
   * Sync button states with main app on initialization
   */
  private async syncButtonStatesWithMainApp(): Promise<void> {
    try {
      console.log('[Expanded Overlay] Syncing button states with main app...');
      
      // Check translation status
      const translationStatus = await (window as any).electronAPI?.invoke('pipeline:get-status', {
        id: Date.now().toString(),
        timestamp: Date.now(),
        payload: null
      });
      
      console.log('[Expanded Overlay] Translation status from main app:', JSON.stringify(translationStatus, null, 2));
      if (translationStatus?.success && translationStatus.payload) {
        console.log('[Expanded Overlay] Setting translation button to:', translationStatus.payload.isActive || false);
        this.updateTranslationButton(translationStatus.payload.isActive || false);
      } else {
        console.log('[Expanded Overlay] Invalid translation status response:', translationStatus);
      }

      // Check bidirectional status
      const bidirectionalStatus = await (window as any).electronAPI?.invoke('overlay:get-current-state', {
        id: Date.now().toString(),
        timestamp: Date.now(),
        payload: null
      });
      
      console.log('[Expanded Overlay] Bidirectional status from main app:', JSON.stringify(bidirectionalStatus, null, 2));
      if (bidirectionalStatus?.success && bidirectionalStatus.payload?.bidirectionalState) {
        console.log('[Expanded Overlay] Setting bidirectional button to:', bidirectionalStatus.payload.bidirectionalState.isEnabled || false);
        this.updateBidirectionalButton(bidirectionalStatus.payload.bidirectionalState.isEnabled || false);
      } else {
        console.log('[Expanded Overlay] Invalid bidirectional status response:', bidirectionalStatus);
      }
    } catch (error) {
      console.error('Error syncing button states with main app:', error);
    }
  }

  /**
   * Send message to main process
   */
  private sendToMain(channel: string, data?: any): void {
    try {
      (window as any).electronAPI?.sendToMain(channel, data);
    } catch (error) {
      console.error('Error sending message to main process:', error);
    }
  }

  /**
   * Send setting change to main app and trigger config update broadcast
   */
  private async sendSettingChangeAndSync(setting: string, value: any): Promise<void> {
    try {
      console.log('📤 Sending setting change to main app:', setting, '=', value);
      // Send the setting change to main app
      this.sendToMain('overlay:setting-change', {
        setting: setting,
        value: value
      });

      // Wait a moment for main app to process, then refresh our view
      setTimeout(() => {
        console.log('🔄 Refreshing overlay config after setting change');
        this.loadAndSyncCurrentConfig();
      }, 100);
    } catch (error) {
      console.error('❌ Error sending setting change:', error);
    }
  }

  /**
   * Cleanup renderer resources
   */
  private cleanup(): void {
    try {
      // Clear sync interval
      if (this.syncIntervalId) {
        clearInterval(this.syncIntervalId);
        this.syncIntervalId = null;
        console.log('Cleared sync interval');
      }

      // Reset state
      this.currentState = null;
      console.log('Expanded overlay renderer cleaned up');
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }

  /**
   * Setup global error handling
   */
  private setupErrorHandling(): void {
    // Handle uncaught errors
    window.addEventListener('error', (event) => {
      console.error('Uncaught error in expanded overlay:', event.error);
      this.reportError('Uncaught error: ' + event.error?.message || 'Unknown error');
    });

    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      console.error('Unhandled promise rejection in expanded overlay:', event.reason);
      this.reportError('Unhandled promise rejection: ' + event.reason?.message || 'Unknown error');
    });
  }

  /**
   * Initialize soundboard functionality
   */
  private async initializeSoundboard(): Promise<void> {
    const elements = (window as any).expandedOverlayElements;
    
    // Setup soundboard event listeners only once to avoid duplicates
    if (!this.soundboardListenersAttached) {
      this.setupSoundboardEventListeners();
      this.soundboardListenersAttached = true;
    }
    
    // Load soundboard data
    await this.loadSoundboardData();
  }

  /**
   * Setup soundboard event listeners
   */
  private setupSoundboardEventListeners(): void {
    const elements = (window as any).expandedOverlayElements;

    // Add sound button - tell main app to show file picker
    elements.overlayAddSound?.addEventListener('click', () => {
      try {
        this.sendToMain('soundboard:overlay-show-file-picker');
        // Refresh the soundboard display after a delay
        setTimeout(() => this.loadSoundboardData(), 1000);
      } catch (error) {
        console.error('Error triggering file picker:', error);
      }
    });

    // Stop all button - tell main app to stop all sounds
    elements.overlayStopAll?.addEventListener('click', () => {
      try {
        this.sendToMain('soundboard:overlay-stop-all-sounds');
      } catch (error) {
        console.error('Error triggering stop all sounds:', error);
      }
    });

    // VB Audio volume slider
    elements.overlayVbVolume?.addEventListener('input', async (e: Event) => {
      const value = (e.target as HTMLInputElement).value;
      const volume = parseInt(value) / 100;
      try {
        await (window as any).electronAPI?.soundboard?.updateSettings({ masterVolume: volume });
        if (elements.overlayVbVolumeDisplay) {
          elements.overlayVbVolumeDisplay.textContent = `${value}%`;
        }
      } catch (error) {
        console.error('Error updating master volume:', error);
      }
    });

    // Headphones volume slider
    elements.overlayHeadphonesVolume?.addEventListener('input', async (e: Event) => {
      const value = (e.target as HTMLInputElement).value;
      const volume = parseInt(value) / 100;
      try {
        await (window as any).electronAPI?.soundboard?.updateSettings({ headphonesVolume: volume });
        if (elements.overlayHeadphonesVolumeDisplay) {
          elements.overlayHeadphonesVolumeDisplay.textContent = `${value}%`;
        }
      } catch (error) {
        console.error('Error updating headphones volume:', error);
      }
    });
  }

  /**
   * Load soundboard data
   */
  private async loadSoundboardData(): Promise<void> {
    try {
      // Check if soundboard API is available
      if (!(window as any).electronAPI?.soundboard) {
        console.error('Soundboard API not available in overlay');
        return;
      }

      // Get sounds and settings using the soundboard API
      let sounds = await (window as any).electronAPI.soundboard.getAllSounds();
      const settings = await (window as any).electronAPI.soundboard.getSettings();

      console.log('🎵 Soundboard overlay - Loaded sounds:', sounds?.length || 0, 'sounds');
      if (sounds && sounds.length > 0) {
        sounds.forEach((sound: any, i: number) => {
          console.log(`🎵   Sound ${i + 1}:`, sound.label, '(ID:', sound.id, ', slot:', sound.slot, ')');
        });
      }
      console.log('🎵 Soundboard overlay - Loaded settings:', settings);
      
      if (sounds && Array.isArray(sounds)) {
        // Deduplicate by ID and sort by slot for stable display
        const uniqueMap = new Map<string, any>();
        for (const s of sounds) {
          const key = String(s.id);
          if (!uniqueMap.has(key)) uniqueMap.set(key, s);
        }
        const normalized = Array.from(uniqueMap.values()).sort((a: any, b: any) => (a?.slot || 0) - (b?.slot || 0));
        this.updateSoundboardDisplay(normalized);
      } else {
        console.log('No sounds found or invalid sounds data');
      }
      
      if (settings && typeof settings === 'object') {
        this.updateSoundboardSettings(settings);
      } else {
        console.log('No settings found or invalid settings data');
      }
    } catch (error) {
      console.error('Error loading soundboard data:', error);
    }
  }

  /**
   * Update soundboard display with sounds data
   */
  private updateSoundboardDisplay(sounds: any[]): void {
    const elements = (window as any).expandedOverlayElements;
    const grid = elements.overlaySoundGrid;
    
    if (!grid) return;

    // Clear existing content
    grid.innerHTML = '';

    if (sounds.length === 0) {
      grid.innerHTML = `
        <div style="text-align: center; color: #888; padding: 20px; grid-column: 1/-1;">
          No sounds added yet. Click "Add Sound" to get started!
        </div>
      `;
      return;
    }

    // Add sound pads
    sounds.forEach((sound: any, index: number) => {
      const pad = document.createElement('div');
      pad.className = 'overlay-sound-pad';
      pad.dataset.soundId = String(sound.id);
      
      pad.innerHTML = `
        <div class="overlay-sound-pad-label">${sound.label || `Sound ${index + 1}`}</div>
        <div class="overlay-sound-pad-key">${sound.hotkey || ''}</div>
      `;

      pad.addEventListener('click', async () => {
        try {
          console.log('🎵 Overlay: Playing sound pad', index + 1, 'with sound:', sound.label, 'ID:', sound.id, 'Type:', typeof sound.id);
          // Send message to main app to play the sound (remote control behavior)
          this.sendToMain('soundboard:overlay-play-sound', {
            soundId: String(sound.id),
            slot: typeof sound.slot === 'number' ? sound.slot : undefined
          });
          console.log('🎵 Overlay: Sent sound play request for ID:', sound.id);
        } catch (error) {
          console.error('🎵 Overlay: Error triggering sound playback:', error);
        }
      });

      grid.appendChild(pad);
    });
  }

  /**
   * Update soundboard settings display
   */
  private updateSoundboardSettings(settings: any): void {
    const elements = (window as any).expandedOverlayElements;
    
    console.log('Updating soundboard settings display:', settings);
    
    if (settings.masterVolume !== undefined) {
      const value = Math.round(settings.masterVolume * 100);
      if (elements.overlayVbVolume) {
        elements.overlayVbVolume.value = value.toString();
      }
      if (elements.overlayVbVolumeDisplay) {
        elements.overlayVbVolumeDisplay.textContent = `${value}%`;
      }
      console.log('Set master volume to:', value);
    }

    if (settings.headphonesVolume !== undefined) {
      const value = Math.round(settings.headphonesVolume * 100);
      if (elements.overlayHeadphonesVolume) {
        elements.overlayHeadphonesVolume.value = value.toString();
      }
      if (elements.overlayHeadphonesVolumeDisplay) {
        elements.overlayHeadphonesVolumeDisplay.textContent = `${value}%`;
      }
      console.log('Set headphones volume to:', value);
    }
  }

  /**
   * Setup quick translate controls
   */
  private quickTranslateAutoEnabled: boolean = true;
  private quickTranslateDebounceTimer: NodeJS.Timeout | null = null;
  private readonly QUICK_TRANSLATE_DEBOUNCE_DELAY = 1000; // 1 second

  private setupQuickTranslateControls(): void {
    const elements = (window as any).expandedOverlayElements;
    
    const translateBtn = elements.overlayQuickTranslateBtn;
    const copyBtn = elements.overlayQuickCopyBtn;
    const inputTextarea = elements.overlayQuickInput as HTMLTextAreaElement;
    const outputTextarea = elements.overlayQuickOutput as HTMLTextAreaElement;
    const autoToggle = document.getElementById('overlay-quick-auto-toggle');
    const autoInfo = document.getElementById('overlay-quick-auto-info');
    
    // Translate button click
    translateBtn?.addEventListener('click', () => {
      this.handleQuickTranslate();
    });
    
    // Copy button click
    copyBtn?.addEventListener('click', () => {
      this.copyQuickTranslateResult();
    });
    
    // Auto-translate toggle
    autoToggle?.addEventListener('click', () => {
      this.quickTranslateAutoEnabled = !this.quickTranslateAutoEnabled;
      autoToggle.classList.toggle('active', this.quickTranslateAutoEnabled);
      if (autoInfo) {
        autoInfo.textContent = this.quickTranslateAutoEnabled 
          ? 'Translates as you type' 
          : 'Click Translate or Ctrl+Enter';
      }
      this.updateQuickTranslateStatus(this.quickTranslateAutoEnabled 
        ? 'Auto-translate enabled' 
        : 'Auto-translate disabled');
    });
    
    // Input textarea - auto-translate with debounce
    inputTextarea?.addEventListener('input', () => {
      // Clear existing timer
      if (this.quickTranslateDebounceTimer) {
        clearTimeout(this.quickTranslateDebounceTimer);
        this.quickTranslateDebounceTimer = null;
      }
      
      const text = inputTextarea.value.trim();
      
      if (!text) {
        // Clear output if input is empty
        if (outputTextarea) outputTextarea.value = '';
        if (copyBtn) copyBtn.disabled = true;
        this.updateQuickTranslateStatus('Ready to translate');
        return;
      }
      
      if (this.quickTranslateAutoEnabled) {
        this.updateQuickTranslateStatus('Typing...');
        
        // Set debounce timer
        this.quickTranslateDebounceTimer = setTimeout(() => {
          this.handleQuickTranslate();
        }, this.QUICK_TRANSLATE_DEBOUNCE_DELAY);
      }
    });
    
    // Enable translate on Ctrl+Enter
    inputTextarea?.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        // Clear debounce and translate immediately
        if (this.quickTranslateDebounceTimer) {
          clearTimeout(this.quickTranslateDebounceTimer);
          this.quickTranslateDebounceTimer = null;
        }
        this.handleQuickTranslate();
      }
    });
    
    // Re-translate when target language changes (if auto-translate is on and there's text)
    const targetLangSelect = elements.overlayQuickTargetLang as HTMLSelectElement;
    targetLangSelect?.addEventListener('change', () => {
      if (this.quickTranslateAutoEnabled && inputTextarea?.value.trim()) {
        if (this.quickTranslateDebounceTimer) {
          clearTimeout(this.quickTranslateDebounceTimer);
        }
        this.handleQuickTranslate();
      }
    });
  }

  /**
   * Handle quick translate
   */
  private async handleQuickTranslate(): Promise<void> {
    const elements = (window as any).expandedOverlayElements;
    
    const inputTextarea = elements.overlayQuickInput as HTMLTextAreaElement;
    const outputTextarea = elements.overlayQuickOutput as HTMLTextAreaElement;
    const targetLangSelect = elements.overlayQuickTargetLang as HTMLSelectElement;
    const translateBtn = elements.overlayQuickTranslateBtn as HTMLButtonElement;
    const translateText = document.getElementById('overlay-quick-translate-text');
    const spinner = document.getElementById('overlay-quick-spinner');
    const statusDiv = elements.overlayQuickStatus as HTMLDivElement;
    const copyBtn = elements.overlayQuickCopyBtn as HTMLButtonElement;
    
    const text = inputTextarea?.value?.trim();
    if (!text) {
      this.updateQuickTranslateStatus('Please enter text to translate');
      return;
    }
    
    // Set loading state
    if (translateBtn) translateBtn.disabled = true;
    if (translateText) translateText.textContent = 'Translating...';
    if (spinner) spinner.style.display = 'inline';
    this.updateQuickTranslateStatus('Translating...');
    
    try {
      const options = {
        to: targetLangSelect?.value || 'en',
        from: 'auto'
      };
      
      const result = await (window as any).electronAPI?.invoke('quick-translate:translate', { text, options });
      
      if (result?.success && result.translatedText) {
        if (outputTextarea) {
          outputTextarea.value = result.translatedText;
        }
        if (copyBtn) copyBtn.disabled = false;
        
        const cacheInfo = result.cached ? ' (cached)' : '';
        const providerInfo = result.provider ? ` via ${result.provider}` : '';
        this.updateQuickTranslateStatus(`Done${providerInfo}${cacheInfo}`);
      } else {
        if (outputTextarea) outputTextarea.value = '';
        if (copyBtn) copyBtn.disabled = true;
        this.updateQuickTranslateStatus(`Failed: ${result?.error || 'Unknown error'}`);
      }
    } catch (error: any) {
      if (outputTextarea) outputTextarea.value = '';
      if (copyBtn) copyBtn.disabled = true;
      this.updateQuickTranslateStatus(`Error: ${error.message}`);
    } finally {
      // Reset button state
      if (translateBtn) translateBtn.disabled = false;
      if (translateText) translateText.textContent = 'Translate';
      if (spinner) spinner.style.display = 'none';
    }
  }

  /**
   * Copy quick translate result to clipboard
   */
  private async copyQuickTranslateResult(): Promise<void> {
    const elements = (window as any).expandedOverlayElements;
    const outputTextarea = elements.overlayQuickOutput as HTMLTextAreaElement;
    
    if (!outputTextarea?.value) return;
    
    try {
      await navigator.clipboard.writeText(outputTextarea.value);
      this.updateQuickTranslateStatus('Copied to clipboard!');
    } catch (error) {
      // Fallback
      outputTextarea.select();
      document.execCommand('copy');
      this.updateQuickTranslateStatus('Copied to clipboard!');
    }
  }

  /**
   * Update quick translate status message
   */
  private updateQuickTranslateStatus(message: string): void {
    const elements = (window as any).expandedOverlayElements;
    const statusDiv = elements.overlayQuickStatus as HTMLDivElement;
    if (statusDiv) {
      statusDiv.textContent = message;
    }
  }

  /**
   * Report error to main process
   */
  private reportError(errorMessage: string): void {
    try {
      (window as any).electronAPI?.reportError?.(errorMessage);
    } catch (error) {
      console.error('Failed to report error to main process:', error);
    }
  }

  /**
   * Clear opacity-related CSS variables from both root and overlay container
   */
  private clearOpacityVariables(): void {
    const overlayContainer = document.querySelector('.overlay-container') as HTMLElement;
    const root = document.documentElement;
    
    // Clear variables from both elements
    const variablesToClear = ['--glass-bg-primary', '--glass-bg-secondary'];
    
    variablesToClear.forEach(variable => {
      root.style.removeProperty(variable);
      if (overlayContainer) {
        overlayContainer.style.removeProperty(variable);
      }
    });
    
    console.log('Cleared opacity CSS variables from both elements');
  }

  /**
   * Apply opacity change to overlay elements for real-time feedback
   */
  private applyOpacityChange(opacity: number): void {
    try {
      const overlayContainer = document.querySelector('.overlay-container') as HTMLElement;
      const expandedOverlay = document.querySelector('.expanded-overlay') as HTMLElement;
      
      if (!overlayContainer || !expandedOverlay) {
        console.warn('Could not find overlay elements for opacity change');
        return;
      }

      const isLightTheme = overlayContainer.classList.contains('light-theme');
      
      console.log(`Applying opacity: ${opacity} (${Math.round(opacity * 100)}%), Light theme: ${isLightTheme}`);
      
      // Clear old variables first to prevent conflicts
      this.clearOpacityVariables();
      
      // Set CSS variables on the correct element (overlayContainer for light theme, root for dark theme)
      const targetElement = isLightTheme ? overlayContainer : document.documentElement;
      
      if (isLightTheme) {
        // Light theme: go from transparent white to solid white
        const primaryOpacity1 = 0.2 + (opacity * 0.8); // 0.2 to 1.0
        const primaryOpacity2 = 0.15 + (opacity * 0.65); // 0.15 to 0.8
        const primaryOpacity3 = 0.1 + (opacity * 0.5); // 0.1 to 0.6
        const secondaryOpacity1 = 0.15 + (opacity * 0.65); // 0.15 to 0.8
        const secondaryOpacity2 = 0.1 + (opacity * 0.5); // 0.1 to 0.6
        
        targetElement.style.setProperty('--glass-bg-primary', `linear-gradient(135deg, 
          rgba(255, 255, 255, ${primaryOpacity1}) 0%,
          rgba(255, 255, 255, ${primaryOpacity2}) 50%,
          rgba(255, 255, 255, ${primaryOpacity3}) 100%)`);
        targetElement.style.setProperty('--glass-bg-secondary', `linear-gradient(135deg, 
          rgba(255, 255, 255, ${secondaryOpacity1}) 0%,
          rgba(255, 255, 255, ${secondaryOpacity2}) 100%)`);
          
        console.log(`Light theme opacities: primary=${primaryOpacity1}, secondary=${secondaryOpacity1}`);
      } else {
        // Dark theme: go from transparent black to solid black
        const primaryOpacity1 = 0.3 + (opacity * 0.7); // 0.3 to 1.0
        const primaryOpacity2 = 0.2 + (opacity * 0.6); // 0.2 to 0.8
        const primaryOpacity3 = 0.1 + (opacity * 0.5); // 0.1 to 0.6
        const secondaryOpacity1 = 0.2 + (opacity * 0.6); // 0.2 to 0.8
        const secondaryOpacity2 = 0.1 + (opacity * 0.5); // 0.1 to 0.6
        
        targetElement.style.setProperty('--glass-bg-primary', `linear-gradient(135deg, 
          rgba(0, 0, 0, ${primaryOpacity1}) 0%,
          rgba(0, 0, 0, ${primaryOpacity2}) 50%,
          rgba(0, 0, 0, ${primaryOpacity3}) 100%)`);
        targetElement.style.setProperty('--glass-bg-secondary', `linear-gradient(135deg, 
          rgba(0, 0, 0, ${secondaryOpacity1}) 0%,
          rgba(0, 0, 0, ${secondaryOpacity2}) 100%)`);
          
        console.log(`Dark theme opacities: primary=${primaryOpacity1}, secondary=${secondaryOpacity1}`);
      }

      // Update backdrop filter intensity (less blur when more opaque)
      const blurAmount = 25 - (opacity * 10); // 25px to 15px blur (less blur = more solid)
      expandedOverlay.style.backdropFilter = `blur(${blurAmount}px) saturate(180%)`;
      (expandedOverlay.style as any).webkitBackdropFilter = `blur(${blurAmount}px) saturate(180%)`;

      // Force a repaint by temporarily changing a property
      expandedOverlay.style.transform = 'translateZ(0)';
      setTimeout(() => {
        expandedOverlay.style.transform = '';
      }, 1);

      console.log(`Applied opacity change: ${opacity} (${Math.round(opacity * 100)}%), blur: ${blurAmount}px`);
    } catch (error) {
      console.error('Error applying opacity change:', error);
    }
  }

  /**
   * Setup theme toggle functionality
   */
  private setupThemeToggle(): void {
    const themeToggle = document.getElementById('overlay-theme-toggle');
    const themeLabel = document.getElementById('overlay-theme-label');
    const overlayContainer = document.querySelector('.overlay-container') as HTMLElement;

    if (!themeToggle || !themeLabel || !overlayContainer) return;

    // Load saved theme preference
    const savedTheme = localStorage.getItem('whispra-overlay-theme') || 'dark';
    const isLight = savedTheme === 'light';
    
    // Apply initial theme
    if (isLight) {
      overlayContainer.classList.add('light-theme');
      themeToggle.classList.add('active');
      themeLabel.textContent = 'Light Theme';
    } else {
      overlayContainer.classList.remove('light-theme');
      themeToggle.classList.remove('active');
      themeLabel.textContent = 'Dark Theme';
    }

    // Theme toggle click handler
    themeToggle.addEventListener('click', () => {
      const isCurrentlyLight = overlayContainer.classList.contains('light-theme');
      
      if (isCurrentlyLight) {
        // Switch to dark theme
        overlayContainer.classList.remove('light-theme');
        themeToggle.classList.remove('active');
        themeLabel.textContent = 'Dark Theme';
        localStorage.setItem('whispra-overlay-theme', 'dark');
      } else {
        // Switch to light theme
        overlayContainer.classList.add('light-theme');
        themeToggle.classList.add('active');
        themeLabel.textContent = 'Light Theme';
        localStorage.setItem('whispra-overlay-theme', 'light');
      }

      // Reapply current opacity after theme change
      const opacitySlider = document.getElementById('overlay-opacity') as HTMLInputElement;
      if (opacitySlider) {
        const currentOpacity = parseInt(opacitySlider.value) / 100;
        this.applyOpacityChange(currentOpacity);
      }
    });
  }
}

// Initialize expanded overlay renderer when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new ExpandedOverlayRenderer();
});

// Export for potential external use
(window as any).ExpandedOverlayRenderer = ExpandedOverlayRenderer;