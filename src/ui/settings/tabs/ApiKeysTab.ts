/**
 * API Keys tab implementation
 * Manages secure storage and configuration of API keys for OpenAI and ElevenLabs
 */

import { BaseSettingsTab } from '../interfaces/SettingsTab.js';
import { getTranslations } from '../../../renderer/i18n.js';
// TODO: Use IPC to communicate with services
// For now, this tab will show static content

// Temporary type definitions
type ApiMode = 'managed' | 'personal';

// Define StorageSettings interface locally to avoid dependency issues
interface StorageSettings {
  type: 'keychain' | 'passphrase' | 'none';
  hasPassphrase: boolean;
  lastMigration?: string;
}

// Define API key types
type ApiKeyType = 'openai' | 'elevenlabs' | 'deepinfra';

export class ApiKeysTab extends BaseSettingsTab {
  public readonly id = 'api-keys';
  public readonly title = 'API Keys';
  public readonly icon = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15.5 7.5 2.3 2.3a1 1 0 0 0 1.4 0l2.1-2.1a1 1 0 0 0 0-1.4L19 4"/><path d="m21 2-9.6 9.6"/><circle cx="7.5" cy="15.5" r="5.5"/></svg>';
  public readonly order = 1;

  private apiKeys: any = {};
  private currentLanguage: string = 'en';
  private storageConfig: StorageSettings = {
    type: 'keychain',
    hasPassphrase: false
  };
  // TODO: Use IPC to communicate with services
  private currentMode: ApiMode = 'personal';
  private cachedUltraAccess: boolean | null = null;

  // Default translations (fallback when i18n doesn't have the key)
  private defaultTranslations = {
    modal: { title: 'Secure API Configuration', close: 'Close' },
    instructions: {
      title: 'API Key Setup Instructions',
      openaiTitle: 'OpenAI API Key',
      openaiPermissions: 'Read permissions: Models, Capabilities',
      openaiUsage: 'Used for speech-to-text and text-to-speech translation',
      openaiLink: 'platform.openai.com/api-keys',
      elevenlabsTitle: 'ElevenLabs API Key',
      elevenlabsRestrict: 'Restrict key: Enabled',
      elevenlabsNoAccess: 'Everything else: No access',
      elevenlabsTts: 'Text to speech: Access',
      elevenlabsSts: 'Speech to speech: Access',
      elevenlabsAgents: 'ElevenLabs agents: Write',
      elevenlabsVoices: 'Voices: Write',
      elevenlabsVoiceGen: 'Voice generation: Access',
      elevenlabsUser: 'User: Read',
      elevenlabsLink: 'elevenlabs.io/app/profile'
    },
    fields: {
      openaiLabel: 'OpenAI API Key:',
      openaiPlaceholder: 'Enter your OpenAI API key',
      openaiStored: 'Key stored securely',
      openaiHelp: 'Enter your OpenAI API key (sk-...)',
      elevenlabsLabel: 'ElevenLabs API Key:',
      elevenlabsPlaceholder: 'Enter your ElevenLabs API key',
      elevenlabsStored: 'Key stored securely',
      elevenlabsHelp: 'Enter your ElevenLabs API key (32 chars)',
      deepinfraLabel: 'DeepInfra API Key:',
      deepinfraPlaceholder: 'Enter your DeepInfra API key',
      deepinfraStored: 'Key stored securely',
      deepinfraHelp: 'Enter your DeepInfra API key for accessing various AI models',
      googleLabel: 'Google Translate API Key:',
      googlePlaceholder: 'Enter your Google Translate API key',
      googleStored: 'Key stored securely',
      googleHelp: 'Enter your Google Translate API key (AIza...)',
      deeplLabel: 'DeepL API Key:',
      deeplPlaceholder: 'Enter your DeepL API key',
      deeplStored: 'Key stored securely',
      deeplHelp: 'Enter your DeepL API key (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx:fx)'
    },
    buttons: {
      showKey: 'Show Key',
      removeKey: 'Remove Key',
      clearAll: 'Clear All Keys',
      cancel: 'Cancel',
      save: 'Save'
    },
    status: { keyStored: '✓ Key stored securely' },
    links: {
      openai: 'Generate key at: platform.openai.com/api-keys',
      elevenlabs: 'Generate key at: https://try.elevenlabs.io/whispra',
      deepinfra: 'Generate key at: deepinfra.com/dash/api_keys',
      google: 'Generate key at: console.cloud.google.com/apis/credentials',
      deepl: 'Generate key at: www.deepl.com/account/summary'
    },
    storage: {
      title: 'Storage Configuration',
      description: 'Choose how your API keys are stored. We recommend using OS keychain for maximum security.',
      keychain: 'OS Keychain (Recommended)',
      keychainDesc: 'Store keys securely in your operating system\'s credential manager. Most secure option.',
      passphrase: 'Passphrase Encryption',
      passphraseDesc: 'Encrypt keys with a passphrase. Good for portability across devices.',
      passphraseInput: 'Enter encryption passphrase',
      passphraseHelp: 'Choose a strong passphrase. You\'ll need this to access your keys.',
      none: 'No Storage',
      noneDesc: 'Don\'t store keys. You\'ll need to enter them each time you use the app.'
    },
    managedApi: {
      title: 'API Key Management',
      description: 'Choose how to manage your API keys for translation services.',
      modeLabel: 'API Key Mode:',
      personalMode: 'Personal Keys',
      personalModeDesc: 'Use your own OpenAI and ElevenLabs API keys',
      managedMode: 'Managed Keys',
      managedModeDesc: 'Use Whispra-managed keys (requires subscription)',
      subscriptionRequired: 'Subscription required for managed keys',
      usageLimitInfo: '$20 monthly usage limit included',
      switchingMode: 'Switching mode...',
      switchFailed: 'Failed to switch mode'
    }
  };

  constructor() {
    super();
    this.loadCurrentLanguage();
    // Mode will be loaded when rendering
    
    // Listen for mode change events
    window.addEventListener('managed-api-mode-changed', async (event: any) => {
      if (event.detail && event.detail.mode) {
        this.currentMode = event.detail.mode;
        if (this.container) {
          await this.renderContent(this.container);
        }
      }
    });
  }

  /**
   * Load saved managed API mode from configuration
   */
  private async loadManagedApiMode(): Promise<void> {
    try {
      // First check if user has ultra access and cache the result
      const hasUltraAccess = await this.checkUltraAccess();
      this.cachedUltraAccess = hasUltraAccess;
      
      if (!hasUltraAccess) {
        // For non-ultra users, always force personal mode
        this.currentMode = 'personal';
        console.log(`📋 Non-ultra user detected, forcing personal mode`);
        return;
      }

      const response = await (window as any).electronAPI.invoke('config:get', {
        id: Date.now().toString(),
        timestamp: Date.now()
      });

      console.log('📋 Config response:', response);
      
      if (response.success && response.payload?.managedApiConfig?.mode) {
        this.currentMode = response.payload.managedApiConfig.mode;
        console.log(`📋 Loaded saved managed API mode: ${this.currentMode}`);
      } else {
        // Always default to personal mode - let users explicitly choose managed mode
        this.currentMode = 'personal';
        console.log(`📋 No saved managed API mode found, defaulting to personal mode (user can choose managed if desired)`);
      }
    } catch (error) {
      console.error('Failed to load managed API mode:', error);
      this.currentMode = 'personal'; // Default fallback
    }
  }

  /**
   * Get user's usage limit based on their plan tier
   */
  private async getUserUsageLimit(): Promise<number> {
    try {
      const subscriptionResponse = await (window as any).electronAPI.invoke('subscription:check-access');
      
      if (subscriptionResponse.success) {
        const { planTier } = subscriptionResponse;
        // Ultra: $20, Trial/Pro: $5
        return planTier === 'ultra' ? 20 : 5;
      }
    } catch (error) {
      console.error('Failed to get user usage limit:', error);
    }
    
    // Default to $5
    return 5;
  }

  /**
   * Check if user has managed API access (trial, pro with managed_api_access, or ultra)
   */
  private async checkUltraAccess(): Promise<boolean> {
    try {
      const subscriptionResponse = await (window as any).electronAPI.invoke('subscription:check-access');
      
      if (subscriptionResponse.success) {
        const { hasManagedAPI } = subscriptionResponse;
        console.log(`🔍 Checking managed API access: hasManagedAPI=${hasManagedAPI}`);
        
        // User has managed API access if hasManagedAPI is true (includes trial, pro with managed_api_access, and ultra)
        return hasManagedAPI === true;
      }
    } catch (error) {
      console.error('Failed to check user subscription:', error);
    }
    
    return false;
  }



  /**
   * Load current language from global state
   */
  private loadCurrentLanguage(): void {
    // Try to get current language from global variable or default to 'en'
    this.currentLanguage = (window as any).currentLanguage || 'en';
  }

  /**
   * Get translations for current language using global i18n system
   */
  private getApiKeysTranslations(): any {
    const t = getTranslations(this.currentLanguage);
    const settings = t.settings || {};
    
    // Deep merge with defaults, preferring i18n values
    const mergeWithDefaults = (i18nObj: any, defaultObj: any): any => {
      const result: any = { ...defaultObj };
      if (i18nObj) {
        for (const key of Object.keys(i18nObj)) {
          if (typeof i18nObj[key] === 'object' && !Array.isArray(i18nObj[key]) && defaultObj[key]) {
            result[key] = mergeWithDefaults(i18nObj[key], defaultObj[key]);
          } else if (i18nObj[key] !== undefined) {
            result[key] = i18nObj[key];
          }
        }
      }
      return result;
    };
    
    return mergeWithDefaults(settings, this.defaultTranslations);
  }

  /**
   * Get placeholder text for API key input
   */
  private getPlaceholderText(keyType: ApiKeyType, t: any, isStored: boolean): string {
    const placeholders = {
      'openai': { stored: t.fields.openaiStored, empty: t.fields.openaiPlaceholder },
      'elevenlabs': { stored: t.fields.elevenlabsStored, empty: t.fields.elevenlabsPlaceholder },
      'deepinfra': { stored: t.fields.deepinfraStored, empty: t.fields.deepinfraPlaceholder }
    };
    return isStored ? placeholders[keyType].stored : placeholders[keyType].empty;
  }

  /**
   * Render the API Keys tab content
   */
  public render(): HTMLElement {
    const container = this.createElement('div', 'api-keys-tab');
    this.container = container; // Store reference for later updates

    // Show loading state initially
    this.showLoadingState(container);

    // Load managed API mode and API keys when rendering
    Promise.all([
      this.loadManagedApiMode(),
      this.loadApiKeys()
    ]).then(async () => {
      await this.renderContent(container);
    }).catch(error => {
      console.error('Error loading API keys tab:', error);
      this.showErrorState(container, error);
    });

    return container;
  }

  /**
   * Show loading state while data is being loaded
   */
  private showLoadingState(container: HTMLElement): void {
    container.innerHTML = '';
    
    const loadingContainer = this.createElement('div');
    loadingContainer.style.cssText = `
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: var(--settings-spacing-xl);
      text-align: center;
    `;

    const spinner = this.createElement('div');
    spinner.style.cssText = `
      width: 32px;
      height: 32px;
      border: 3px solid var(--settings-border);
      border-top: 3px solid var(--settings-primary-color);
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin-bottom: var(--settings-spacing-md);
    `;

    const loadingText = this.createElement('p');
    loadingText.style.cssText = `
      color: var(--settings-text-secondary);
      margin: 0;
    `;
    loadingText.textContent = 'Loading API configuration...';

    loadingContainer.appendChild(spinner);
    loadingContainer.appendChild(loadingText);
    container.appendChild(loadingContainer);

    // Add CSS animation for spinner
    if (!document.getElementById('api-keys-spinner-style')) {
      const style = document.createElement('style');
      style.id = 'api-keys-spinner-style';
      style.textContent = `
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `;
      document.head.appendChild(style);
    }
  }

  /**
   * Show error state if loading fails
   */
  private showErrorState(container: HTMLElement, error: any): void {
    container.innerHTML = '';
    
    const errorContainer = this.createElement('div');
    errorContainer.style.cssText = `
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: var(--settings-spacing-xl);
      text-align: center;
    `;

    const errorIcon = this.createElement('div');
    errorIcon.style.cssText = `
      font-size: 2rem;
      margin-bottom: var(--settings-spacing-md);
    `;
    errorIcon.textContent = '⚠️';

    const errorText = this.createElement('p');
    errorText.style.cssText = `
      color: var(--settings-error);
      margin: 0 0 var(--settings-spacing-md) 0;
      font-weight: 600;
    `;
    errorText.textContent = 'Failed to load API configuration';

    const errorDetails = this.createElement('p');
    errorDetails.style.cssText = `
      color: var(--settings-text-secondary);
      margin: 0;
      font-size: 0.9rem;
    `;
    errorDetails.textContent = error instanceof Error ? error.message : 'Unknown error occurred';

    errorContainer.appendChild(errorIcon);
    errorContainer.appendChild(errorText);
    errorContainer.appendChild(errorDetails);
    container.appendChild(errorContainer);
  }

  /**
   * Load API keys and storage configuration from secure storage
   */
  private async loadApiKeys(): Promise<void> {
    try {
      // Load API keys
      const keysResponse = await (window as any).electronAPI.invoke('secure-api-keys:get', {
        id: Date.now().toString(),
        timestamp: Date.now(),
        payload: null
      });

      if (keysResponse.success) {
        this.apiKeys = keysResponse.payload || {};
      } else {
        console.error('Failed to load API keys');
        this.apiKeys = {};
      }

      // Load storage configuration
      const configResponse = await (window as any).electronAPI.invoke('config:get', {
        id: Date.now().toString(),
        timestamp: Date.now(),
        payload: null
      });

      if (configResponse.success && configResponse.payload?.storageConfig) {
        this.storageConfig = configResponse.payload.storageConfig;
      } else {
        // Default to keychain if no config found
        this.storageConfig = {
          type: 'keychain',
          hasPassphrase: false
        };
      }
    } catch (error) {
      console.error('Error loading API keys and storage config:', error);
      this.apiKeys = {};
      this.storageConfig = {
        type: 'keychain',
        hasPassphrase: false
      };
    }
  }

  /**
   * Render the tab content
   */
  private async renderContent(container: HTMLElement): Promise<void> {
    const t = this.getApiKeysTranslations();

    container.innerHTML = '';

    // Create managed API mode selection section (includes its own header)
    const modeSection = await this.createModeSelectionSection(t);
    container.appendChild(modeSection);

    // Create storage configuration section (only show in personal mode)
    if (this.currentMode === 'personal') {
      const storageSection = this.createStorageConfigSection(t);
      container.appendChild(storageSection);
    }

    // Create instructions section (only show in personal mode)
    if (this.currentMode === 'personal') {
      const instructionsSection = this.createInstructionsSection(t);
      container.appendChild(instructionsSection);
    }

    // Create API key fields
    const fieldsSection = this.createFieldsSection(t);
    container.appendChild(fieldsSection);

    // Create action buttons
    const actionsSection = this.createActionsSection(t);
    container.appendChild(actionsSection);
  }

  /**
   * Create managed API mode selection section
   */
  private async createModeSelectionSection(t: any): Promise<HTMLElement> {
    const section = this.createElement('div', 'settings-form-group');

    // Use cached managed API access status or check if not available
    const hasManagedAccess = this.cachedUltraAccess !== null ? this.cachedUltraAccess : await this.checkUltraAccess();

    if (!hasManagedAccess) {
      // For users without managed API access, force personal mode and don't show mode selection
      this.currentMode = 'personal';
      
      // Show a simple info message about using personal API keys
      const infoContainer = this.createElement('div');
      infoContainer.style.cssText = `
        background: var(--settings-surface);
        border: 1px solid var(--settings-border);
        border-radius: var(--settings-radius-md);
        padding: var(--settings-spacing-lg);
        margin-bottom: var(--settings-spacing-lg);
      `;

      const infoTitle = this.createElement('h2', 'settings-section-header');
      infoTitle.textContent = `🔑 API Keys`;
      infoContainer.appendChild(infoTitle);

      const currentModeInfo = this.createElement('div');
      currentModeInfo.style.cssText = `
        background: rgba(33, 150, 243, 0.1);
        border: 1px solid rgba(33, 150, 243, 0.3);
        border-radius: var(--settings-radius-sm);
        padding: var(--settings-spacing-sm);
        color: #2196F3;
        font-size: 0.9rem;
        text-align: center;
      `;
      currentModeInfo.textContent = '🔑 Using Personal API Keys';

      infoContainer.appendChild(currentModeInfo);
      section.appendChild(infoContainer);
      return section;
    }

    // Mode selection container (for users with managed API access: trial, pro, or ultra)
    const title = this.createElement('h2', 'settings-section-header');
    title.textContent = `🔑 API Keys`;
    section.appendChild(title);

    const description = this.createElement('p', 'settings-section-description');
    description.textContent = 'Configure your API keys for translation services.';
    section.appendChild(description);

    const modeContainer = this.createElement('div');
    modeContainer.style.cssText = `
      background: var(--settings-surface);
      border: 1px solid var(--settings-border);
      border-radius: var(--settings-radius-md);
      padding: var(--settings-spacing-lg);
      margin-bottom: var(--settings-spacing-lg);
    `;

    // Mode label
    const modeLabel = this.createElement('label', 'settings-form-label');
    modeLabel.textContent = t.managedApi.modeLabel;
    modeContainer.appendChild(modeLabel);

    // Mode selection radio buttons
    const radioContainer = this.createElement('div');
    radioContainer.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: var(--settings-spacing-md);
      margin-top: var(--settings-spacing-sm);
    `;

    // Personal mode option
    const personalOption = this.createModeOption('personal', t.managedApi.personalMode, t.managedApi.personalModeDesc, this.currentMode === 'personal');
    radioContainer.appendChild(personalOption);

    // Managed mode option
    const managedOption = this.createModeOption('managed', t.managedApi.managedMode, t.managedApi.managedModeDesc, this.currentMode === 'managed');
    radioContainer.appendChild(managedOption);

    modeContainer.appendChild(radioContainer);

    // Usage limit info for managed mode
    if (this.currentMode === 'managed') {
      // Get user's plan tier to show correct usage limit
      const usageLimit = await this.getUserUsageLimit();
      
      const usageInfo = this.createElement('div');
      usageInfo.style.cssText = `
        background: rgba(76, 175, 80, 0.1);
        border: 1px solid rgba(76, 175, 80, 0.3);
        border-radius: var(--settings-radius-sm);
        padding: var(--settings-spacing-sm);
        margin-top: var(--settings-spacing-md);
        color: #4CAF50;
        font-size: 0.85rem;
      `;
      usageInfo.textContent = `ℹ️ $${usageLimit} monthly usage limit included`;
      modeContainer.appendChild(usageInfo);
    }

    section.appendChild(modeContainer);
    return section;
  }

  /**
   * Create a mode selection radio option
   */
  private createModeOption(mode: ApiMode, title: string, description: string, isSelected: boolean): HTMLElement {
    const option = this.createElement('div');
    option.style.cssText = `
      display: flex;
      align-items: flex-start;
      gap: var(--settings-spacing-sm);
      padding: var(--settings-spacing-md);
      border: 1px solid ${isSelected ? 'var(--settings-primary-color)' : 'var(--settings-border)'};
      border-radius: var(--settings-radius-sm);
      background: ${isSelected ? 'rgba(var(--settings-primary-color-rgb), 0.1)' : 'transparent'};
      cursor: pointer;
      transition: all 0.2s ease;
    `;

    // Radio button
    const radio = this.createElement('input') as HTMLInputElement;
    radio.type = 'radio';
    radio.name = 'api-mode';
    radio.value = mode;
    radio.checked = isSelected;
    radio.style.cssText = `
      margin-top: 2px;
      cursor: pointer;
    `;

    // Content container
    const content = this.createElement('div');
    content.style.flex = '1';

    // Title
    const titleEl = this.createElement('div');
    titleEl.style.cssText = `
      font-weight: 600;
      color: var(--settings-text);
      margin-bottom: var(--settings-spacing-xs);
    `;
    titleEl.textContent = title;

    // Description
    const descEl = this.createElement('div');
    descEl.style.cssText = `
      font-size: 0.85rem;
      color: var(--settings-text-secondary);
      line-height: 1.4;
    `;
    descEl.textContent = description;

    content.appendChild(titleEl);
    content.appendChild(descEl);

    option.appendChild(radio);
    option.appendChild(content);

    // Click handler
    option.addEventListener('click', () => {
      if (!radio.checked) {
        this.handleModeChange(mode);
      }
    });

    radio.addEventListener('change', () => {
      if (radio.checked) {
        this.handleModeChange(mode);
      }
    });

    return option;
  }

  /**
   * Handle API mode change
   */
  private async handleModeChange(newMode: ApiMode): Promise<void> {
    if (newMode === this.currentMode) return;

    const t = this.getApiKeysTranslations();

    try {
      // Show loading state
      const modeOptions = document.querySelectorAll('input[name="api-mode"]') as NodeListOf<HTMLInputElement>;
      modeOptions.forEach(option => option.disabled = true);

      // Validate managed mode access if switching to managed
      if (newMode === 'managed') {
        const hasAccess = await this.checkUltraAccess();
        if (!hasAccess) {
          // Re-enable options
          modeOptions.forEach(option => option.disabled = false);
          
          // For non-ultra users, silently prevent switching and keep personal mode
          console.log(`🚫 Non-ultra user attempted to switch to managed mode, keeping personal mode`);
          
          // Reset radio button to personal mode
          const personalRadio = document.querySelector('input[name="api-mode"][value="personal"]') as HTMLInputElement;
          if (personalRadio) personalRadio.checked = true;
          
          return;
        }
      }

      console.log(`🔄 User with managed access is switching from ${this.currentMode} to ${newMode} mode`);
      if (newMode === 'personal') {
        console.log(`🔑 User chose personal mode - will use their own API keys instead of managed backend`);
      } else {
        console.log(`🏢 User chose managed mode - will use Whispra-managed API keys`);
      }

      // Switch mode and save to configuration
      try {
        // First get current config to preserve existing settings
        const configResponse = await (window as any).electronAPI.invoke('config:get', {
          id: Date.now().toString(),
          timestamp: Date.now()
        });
        
        const currentConfig = configResponse?.payload || {};
        const currentModelConfig = currentConfig.modelConfig || currentConfig.cloudModelConfig || {};
        
        const savePayload: any = {
          managedApiConfig: {
            mode: newMode,
            lastModeSwitch: new Date().toISOString(),
            usageWarningsEnabled: true,
            autoSwitchOnLimit: false
          }
        };
        
        // When switching to managed mode, set models to OpenAI cloud services
        if (newMode === 'managed') {
          savePayload.modelConfig = {
            whisperModel: 'whisper-1',
            gptModel: 'openai',
            voiceModel: currentModelConfig.voiceModel || 'elevenlabs',
            modelParameters: currentModelConfig.modelParameters || {
              temperature: 0.7,
              maxTokens: 150,
              stability: 0.5,
              similarityBoost: 0.5,
              speed: 1.0
            }
          };
          console.log(`🔄 Switching to managed mode - setting models to OpenAI (whisper-1, openai)`);
        }
        
        console.log(`💾 Saving managed API config:`, savePayload);
        
        const saveResponse = await (window as any).electronAPI.invoke('config:set', {
          id: Date.now().toString(),
          timestamp: Date.now(),
          payload: savePayload
        });
        
        console.log(`💾 Save response:`, saveResponse);
        
        if (saveResponse.success) {
          this.currentMode = newMode;
          console.log(`🔄 Successfully switched to ${newMode} mode and saved to config`);
        } else {
          console.error('Failed to save managed API mode:', saveResponse.error);
          this.currentMode = newMode;
          console.log(`🔄 Switched to ${newMode} mode (save failed)`);
        }
        
        // Notify the ManagedApiRouter about the mode change via IPC
        try {
          await (window as any).electronAPI.invoke('managed-api:set-mode', {
            id: Date.now().toString(),
            timestamp: Date.now(),
            payload: { mode: newMode }
          });
          console.log(`🔄 Notified ManagedApiRouter of mode change to ${newMode}`);
        } catch (routerError) {
          console.error('Failed to notify ManagedApiRouter of mode change:', routerError);
        }
        
      } catch (saveError) {
        console.error('Failed to save managed API mode:', saveError);
        // Continue anyway, just log the error
        this.currentMode = newMode;
        console.log(`🔄 Switched to ${newMode} mode (save failed)`);
      }

      // Clear cached Ultra access status to ensure fresh state
      this.cachedUltraAccess = null;

      // Reload API keys to ensure fresh state
      await this.loadApiKeys();

      // Dispatch mode change event
      window.dispatchEvent(new CustomEvent('managed-api-mode-changed', { 
        detail: { mode: newMode } 
      }));

      // If switched to managed mode, also dispatch model config change event
      if (newMode === 'managed') {
        window.dispatchEvent(new CustomEvent('model-config-changed', { 
          detail: { 
            whisperModel: 'whisper-1',
            gptModel: 'openai'
          } 
        }));
        console.log(`📢 Dispatched model-config-changed event for managed mode`);
      }

      // Re-render the entire content to update UI with proper refresh
      if (this.container) {
        // Clear container completely first to avoid any DOM conflicts
        this.container.innerHTML = '';
        
        // Show loading state briefly to indicate refresh
        this.showLoadingState(this.container);
        
        // Small delay to ensure DOM is cleared and loading state is visible
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Re-render with fresh state
        await this.renderContent(this.container);
        
        // Ensure all inputs are properly enabled after re-render
        const inputs = this.container.querySelectorAll('input[type="password"], input[type="text"]') as NodeListOf<HTMLInputElement>;
        inputs.forEach(input => {
          input.disabled = false;
          input.readOnly = false;
          input.style.pointerEvents = 'auto';
          input.style.opacity = '1';
        });
        
        console.log(`🔄 Successfully refreshed API Keys tab for ${newMode} mode`);
      }

    } catch (error) {
      console.error('Failed to switch API mode:', error);
      
      // Re-enable options
      const modeOptions = document.querySelectorAll('input[name="api-mode"]') as NodeListOf<HTMLInputElement>;
      modeOptions.forEach(option => option.disabled = false);
      
      // Show error message
      alert(`${t.managedApi.switchFailed}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      // Reset radio button to current mode
      const currentRadio = document.querySelector(`input[name="api-mode"][value="${this.currentMode}"]`) as HTMLInputElement;
      if (currentRadio) currentRadio.checked = true;
    }
  }

  /**
   * Create storage configuration section
   */
  private createStorageConfigSection(t: any): HTMLElement {
    const section = this.createElement('div', 'settings-form-group');

    const title = this.createElement('h3', 'settings-section-header');
    title.textContent = `🔒 ${t.storage.title}`;
    section.appendChild(title);

    const description = this.createElement('p', 'settings-section-description');
    description.textContent = t.storage.description;
    section.appendChild(description);

    // Create info box for keychain storage
    const infoBox = this.createElement('div');
    infoBox.style.cssText = `
      background: var(--settings-surface);
      border: 1px solid var(--settings-border);
      border-radius: var(--settings-radius-md);
      padding: var(--settings-spacing-md);
      margin-bottom: var(--settings-spacing-lg);
    `;

    const infoTitle = this.createElement('h4');
    infoTitle.style.cssText = `
      margin: 0 0 var(--settings-spacing-sm) 0;
      color: var(--settings-text);
      font-weight: 600;
    `;
    infoTitle.textContent = `${t.storage.keychain}`;

    const infoDesc = this.createElement('p');
    infoDesc.style.cssText = `
      margin: 0;
      color: var(--settings-text-secondary);
      font-size: 0.9rem;
      line-height: 1.4;
    `;
    infoDesc.textContent = t.storage.keychainDesc;

    infoBox.appendChild(infoTitle);
    infoBox.appendChild(infoDesc);
    section.appendChild(infoBox);

    return section;
  }



  /**
   * Create instructions section
   */
  private createInstructionsSection(t: any): HTMLElement {
    const section = this.createElement('div', 'settings-form-group');

    const instructionsBox = this.createElement('div');
    instructionsBox.style.cssText = `
      background: var(--settings-surface);
      border: 1px solid var(--settings-border);
      border-radius: var(--settings-radius-md);
      padding: var(--settings-spacing-lg);
      margin-bottom: var(--settings-spacing-lg);
    `;

    const title = this.createElement('h3');
    title.style.cssText = `
      margin: 0 0 var(--settings-spacing-lg) 0;
      color: var(--settings-text-secondary);
      font-size: 0.95rem;
    `;
    title.textContent = `📋 ${t.instructions.title}`;
    instructionsBox.appendChild(title);

    // OpenAI instructions
    const openaiSection = this.createElement('div');
    openaiSection.style.marginBottom = 'var(--settings-spacing-lg)';

    const openaiTitle = this.createElement('h4');
    openaiTitle.style.cssText = `
      margin: 0 0 var(--settings-spacing-xs) 0;
      color: var(--settings-primary-color);
      font-size: 0.85rem;
    `;
    openaiTitle.textContent = t.instructions.openaiTitle;
    openaiSection.appendChild(openaiTitle);

    const openaiList = this.createElement('ul');
    openaiList.style.cssText = `
      margin: 0;
      padding-left: var(--settings-spacing-lg);
      color: var(--settings-text-secondary);
      font-size: 0.8rem;
      line-height: 1.3;
    `;

    const openaiItems = [
      t.instructions.openaiPermissions,
      t.instructions.openaiUsage,
      t.links.openai
    ];

    openaiItems.forEach(item => {
      const li = this.createElement('li');
      li.innerHTML = item.includes('platform.openai.com') ?
        `<strong>${item}</strong>` :
        (item.includes('permissions') || item.includes('Permisos') || item.includes('Разрешения') || item.includes('权限') || item.includes('権限') ?
          `<strong>${item}</strong>` : item);
      openaiList.appendChild(li);
    });

    openaiSection.appendChild(openaiList);
    instructionsBox.appendChild(openaiSection);

    // ElevenLabs instructions
    const elevenlabsSection = this.createElement('div');

    const elevenlabsTitle = this.createElement('h4');
    elevenlabsTitle.style.cssText = `
      margin: 0 0 var(--settings-spacing-xs) 0;
      color: var(--settings-primary-color);
      font-size: 0.85rem;
    `;
    elevenlabsTitle.textContent = t.instructions.elevenlabsTitle;
    elevenlabsSection.appendChild(elevenlabsTitle);

    const elevenlabsList = this.createElement('ul');
    elevenlabsList.style.cssText = `
      margin: 0;
      padding-left: var(--settings-spacing-lg);
      color: var(--settings-text-secondary);
      font-size: 0.8rem;
      line-height: 1.3;
    `;

    const elevenlabsItems = [
      t.instructions.elevenlabsRestrict,
      t.instructions.elevenlabsNoAccess,
      t.instructions.elevenlabsTts,
      t.instructions.elevenlabsSts,
      t.instructions.elevenlabsAgents,
      t.instructions.elevenlabsVoices,
      t.instructions.elevenlabsVoiceGen,
      t.instructions.elevenlabsUser,
      t.links.elevenlabs
    ];

    elevenlabsItems.forEach(item => {
      const li = this.createElement('li');
      li.innerHTML = item.includes('try.elevenlabs.io/whispra') ?
        `<strong>${item}</strong>` :
        `<strong>${item}</strong>`;
      elevenlabsList.appendChild(li);
    });

    elevenlabsSection.appendChild(elevenlabsList);
    instructionsBox.appendChild(elevenlabsSection);

    // Add "View Full Setup Guide" button
    const buttonContainer = this.createElement('div');
    buttonContainer.style.cssText = `
      margin-top: var(--settings-spacing-lg);
      padding-top: var(--settings-spacing-md);
      border-top: 1px solid var(--settings-border);
      text-align: center;
    `;

    const setupGuideButton = this.createElement('button', 'settings-button') as HTMLButtonElement;
    setupGuideButton.style.cssText = `
      padding: var(--settings-spacing-sm) var(--settings-spacing-lg);
      background: var(--settings-primary-color);
      color: white;
      border: none;
      border-radius: var(--settings-radius-md);
      cursor: pointer;
      font-size: 0.85rem;
      display: inline-flex;
      align-items: center;
      gap: var(--settings-spacing-sm);
    `;
    setupGuideButton.innerHTML = '📖 View Full Setup Guide';
    setupGuideButton.addEventListener('click', async () => {
      try {
        await (window as any).electronAPI.showApiSetup();
      } catch (error) {
        console.error('Failed to open API setup guide:', error);
      }
    });

    buttonContainer.appendChild(setupGuideButton);
    instructionsBox.appendChild(buttonContainer);

    section.appendChild(instructionsBox);
    return section;
  }

  /**
   * Create API key input fields section
   */
  private createFieldsSection(t: any): HTMLElement {
    const section = this.createElement('div');

    if (this.currentMode === 'managed') {
      // Show managed API status
      const managedStatus = this.createManagedApiStatus(t);
      section.appendChild(managedStatus);
      
      // Still show ElevenLabs API Key field in managed mode (for TTS)
      const elevenlabsGroup = this.createApiKeyField('elevenlabs', t, false);
      section.appendChild(elevenlabsGroup);
    } else {
      // Show personal API key fields
      // OpenAI API Key field (required)
      const openaiGroup = this.createApiKeyField('openai', t, true);
      section.appendChild(openaiGroup);

      // ElevenLabs API Key field (required)
      const elevenlabsGroup = this.createApiKeyField('elevenlabs', t, true);
      section.appendChild(elevenlabsGroup);

      // DeepInfra API Key field (optional) - now using standardized method
      const deepinfraGroup = this.createApiKeyField('deepinfra', t, false);
      section.appendChild(deepinfraGroup);
    }

    return section;
  }

  /**
   * Create managed API status display
   */
  private createManagedApiStatus(t: any): HTMLElement {
    const container = this.createElement('div');
    container.style.cssText = `
      background: var(--settings-surface);
      border: 1px solid var(--settings-border);
      border-radius: var(--settings-radius-md);
      padding: var(--settings-spacing-lg);
      margin-bottom: var(--settings-spacing-lg);
      text-align: center;
    `;

    // Status icon and title
    const statusTitle = this.createElement('div');
    statusTitle.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: center;
      gap: var(--settings-spacing-sm);
      margin-bottom: var(--settings-spacing-md);
      color: #4CAF50;
      font-weight: 600;
    `;
    statusTitle.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M9 12l2 2 4-4"/>
        <circle cx="12" cy="12" r="10"/>
      </svg>
      Managed API Keys Active
    `;

    // Status description
    const statusDesc = this.createElement('div');
    statusDesc.style.cssText = `
      color: var(--settings-text-secondary);
      font-size: 0.9rem;
      line-height: 1.4;
      margin-bottom: var(--settings-spacing-md);
    `;
    statusDesc.textContent = 'Your API requests are being routed through Whispra-managed keys. No personal API keys required.';

    // Services list
    const servicesList = this.createElement('div');
    servicesList.style.cssText = `
      display: flex;
      justify-content: center;
      gap: var(--settings-spacing-lg);
      margin-top: var(--settings-spacing-md);
    `;

    const services = [
      { name: 'OpenAI', icon: '🤖' },
      { name: 'ElevenLabs', icon: '🎙️' }
    ];

    services.forEach(service => {
      const serviceItem = this.createElement('div');
      serviceItem.style.cssText = `
        display: flex;
        align-items: center;
        gap: var(--settings-spacing-xs);
        color: var(--settings-text);
        font-size: 0.85rem;
      `;
      serviceItem.innerHTML = `${service.icon} ${service.name}`;
      servicesList.appendChild(serviceItem);
    });

    container.appendChild(statusTitle);
    container.appendChild(statusDesc);
    container.appendChild(servicesList);

    // Add "View Full Setup Guide" button
    const buttonContainer = this.createElement('div');
    buttonContainer.style.cssText = `
      margin-top: var(--settings-spacing-lg);
      padding-top: var(--settings-spacing-md);
      border-top: 1px solid var(--settings-border);
    `;

    const setupGuideButton = this.createElement('button', 'settings-button') as HTMLButtonElement;
    setupGuideButton.style.cssText = `
      padding: var(--settings-spacing-sm) var(--settings-spacing-lg);
      background: var(--settings-primary-color);
      color: white;
      border: none;
      border-radius: var(--settings-radius-md);
      cursor: pointer;
      font-size: 0.85rem;
      display: inline-flex;
      align-items: center;
      gap: var(--settings-spacing-sm);
    `;
    setupGuideButton.innerHTML = '📖 View Full Setup Guide';
    setupGuideButton.addEventListener('click', async () => {
      try {
        await (window as any).electronAPI.showApiSetup();
      } catch (error) {
        console.error('Failed to open API setup guide:', error);
      }
    });

    buttonContainer.appendChild(setupGuideButton);
    container.appendChild(buttonContainer);

    return container;
  }

  /**
   * Create individual API key field
   */
  private createApiKeyField(keyType: ApiKeyType, t: any, required: boolean = false): HTMLElement {
    const group = this.createElement('div', 'settings-form-group');

    const label = this.createElement('label', 'settings-form-label');
    label.setAttribute('for', `${keyType}-key`);

    const labelText = {
      'openai': t.fields.openaiLabel,
      'elevenlabs': t.fields.elevenlabsLabel,
      'deepinfra': t.fields.deepinfraLabel
    }[keyType];

    label.innerHTML = `${labelText} ${required ? '<span style="color: var(--settings-error);">*</span>' : '<span style="color: var(--settings-text-secondary); font-size: 0.8em;">(Optional)</span>'}`;
    group.appendChild(label);

    const inputContainer = this.createElement('div');
    inputContainer.style.cssText = `
      display: flex;
      gap: var(--settings-spacing-sm);
      margin-top: var(--settings-spacing-xs);
    `;

    const input = this.createElement('input', 'settings-form-input') as HTMLInputElement;
    input.type = 'password';
    input.id = `${keyType}-key`;
    input.style.flex = '1';
    // Ensure input is always enabled and interactive
    input.disabled = false;
    input.readOnly = false;
    input.tabIndex = 0; // Ensure it's focusable
    input.style.pointerEvents = 'auto';
    input.style.opacity = '1';
    input.style.userSelect = 'text';
    input.style.cursor = 'text';
    // Remove any attributes that might prevent interaction
    input.removeAttribute('disabled');
    input.removeAttribute('readonly');

    const isStored = this.apiKeys[keyType] === '***';
    input.placeholder = this.getPlaceholderText(keyType, t, isStored);

    // Auto-save on blur (when user finishes typing and clicks away)
    let saveTimeout: number | null = null;
    input.addEventListener('blur', () => {
      // Clear any pending timeout
      if (saveTimeout !== null) {
        clearTimeout(saveTimeout);
        saveTimeout = null;
      }
      // Save immediately on blur if there's text
      if (input.value.trim()) {
        this.onSave().catch(err => console.error('Error auto-saving API key:', err));
      }
    });

    // Auto-save after user stops typing (debounced)
    input.addEventListener('input', () => {
      // Clear existing timeout
      if (saveTimeout !== null) {
        clearTimeout(saveTimeout);
      }
      // Set new timeout to save after 2 seconds of no typing
      saveTimeout = window.setTimeout(() => {
        if (input.value.trim()) {
          this.onSave().catch(err => console.error('Error auto-saving API key:', err));
        }
        saveTimeout = null;
      }, 2000);
    });

    inputContainer.appendChild(input);

    // Show/Hide button if key is stored
    if (isStored) {
      const showButton = this.createElement('button', 'settings-button settings-button-secondary') as HTMLButtonElement;
      showButton.innerHTML = '🔍';
      showButton.title = t.buttons.showKey;
      showButton.style.cssText = `
        padding: var(--settings-spacing-sm);
        background: var(--settings-success);
        color: white;
        border: none;
        border-radius: var(--settings-radius-sm);
        font-size: 14px;
        cursor: pointer;
      `;
      showButton.addEventListener('click', () => this.handleShowKey(keyType, input, showButton, t));
      inputContainer.appendChild(showButton);

      const removeButton = this.createElement('button', 'settings-button settings-button-secondary') as HTMLButtonElement;
      removeButton.innerHTML = '🗑️';
      removeButton.title = t.buttons.removeKey;
      removeButton.style.cssText = `
        padding: var(--settings-spacing-sm);
        background: var(--settings-error);
        color: white;
        border: none;
        border-radius: var(--settings-radius-sm);
        font-size: 14px;
        cursor: pointer;
      `;
      removeButton.addEventListener('click', () => this.handleRemoveKey(keyType, t));
      inputContainer.appendChild(removeButton);
    }

    group.appendChild(inputContainer);

    // Help text
    const helpText = this.createElement('small', isStored ? 'settings-form-success' : 'settings-form-help');

    if (isStored) {
      helpText.textContent = t.status.keyStored;
    } else {
      const helpTexts = {
        'openai': t.fields.openaiHelp,
        'elevenlabs': t.fields.elevenlabsHelp,
        'deepinfra': t.fields.deepinfraHelp
      };
      helpText.textContent = helpTexts[keyType];
    }

    group.appendChild(helpText);

    return group;
  }



  /**
   * Create actions section
   */
  private createActionsSection(t: any): HTMLElement {
    const section = this.createElement('div');
    section.style.cssText = `
      display: flex;
      gap: var(--settings-spacing-md);
      justify-content: space-between;
      align-items: center;
      margin-top: var(--settings-spacing-xl);
    `;

    const clearAllButton = this.createElement('button', 'settings-button') as HTMLButtonElement;
    clearAllButton.style.cssText = `
      padding: var(--settings-spacing-sm) var(--settings-spacing-lg);
      background: var(--settings-error);
      color: white;
      border: none;
      border-radius: var(--settings-radius-md);
      cursor: pointer;
    `;
    clearAllButton.textContent = t.buttons.clearAll;
    clearAllButton.addEventListener('click', () => this.handleClearAll(t));

    section.appendChild(clearAllButton);

    return section;
  }

  /**
   * Handle showing API key
   */
  private async handleShowKey(keyType: ApiKeyType, input: HTMLInputElement, button: HTMLButtonElement, t: any): Promise<void> {
    try {
      const response = await (window as any).electronAPI.invoke('config:get-api-key', {
        id: Date.now().toString(),
        timestamp: Date.now(),
        payload: { keyType }
      });

      if (response.success && response.payload?.key) {
        input.type = 'text';
        input.value = response.payload.key;
        input.style.fontFamily = 'monospace';

        // Auto-select the text for easy copying
        input.select();

        // Change button to hide after showing
        button.innerHTML = '👁️';
        button.title = 'Hide Key';
        button.onclick = () => {
          input.type = 'password';
          input.value = '';

          const placeholders = {
            'openai': t.fields.openaiStored,
            'elevenlabs': t.fields.elevenlabsStored,
            'deepinfra': t.fields.deepinfraStored,
            'google': t.fields.googleStored,
            'deepl': t.fields.deeplStored
          };

          input.placeholder = placeholders[keyType as keyof typeof placeholders];
          input.style.fontFamily = '';
          button.innerHTML = '🔍';
          button.title = t.buttons.showKey;
          button.onclick = () => this.handleShowKey(keyType, input, button, t);
        };
      } else {
        alert('Failed to retrieve API key');
      }
    } catch (error) {
      console.error('Error showing API key:', error);
      alert('Failed to show API key');
    }
  }

  /**
   * Handle removing single API key
   */
  private async handleRemoveKey(keyType: ApiKeyType, t: any): Promise<void> {
    const keyNames = {
      'openai': 'OpenAI',
      'elevenlabs': 'ElevenLabs',
      'deepinfra': 'DeepInfra'
    };
    const keyName = keyNames[keyType];
    const confirmed = confirm(
      `⚠️ Remove ${keyName} API Key?\n\n` +
      `This will permanently delete your ${keyName} API key from secure storage.\n\n` +
      `If you don't have the key written down elsewhere, you'll need to generate a new one from ${keyName}'s website.\n\n` +
      `Are you sure you want to continue?`
    );

    if (confirmed) {
      try {
        console.log(`[ApiKeysTab] Removing ${keyType} API key...`);
        console.log(`[ApiKeysTab] Current state before removal:`, this.apiKeys[keyType]);
        
        // Immediately clear the input field for instant visual feedback
        const inputField = document.getElementById(`${keyType}-key`) as HTMLInputElement;
        if (inputField) {
          inputField.value = '';
          // Don't disable - let user continue typing if they want to add a new key
          // inputField.disabled = true; // Removed - this was causing the bug
        }
        
        const response = await (window as any).electronAPI.invoke('secure-api-keys:remove', {
          id: Date.now().toString(),
          timestamp: Date.now(),
          payload: { service: keyType }
        });

        if (response.success) {
          console.log(`[ApiKeysTab] Successfully removed ${keyType} API key, reloading...`);
          
          // Notify subscription cache that API keys changed
          try {
            await (window as any).electronAPI.notifyApiKeysChanged();
            console.log('✅ Notified subscription cache of API key removal');
          } catch (error) {
            console.warn('Failed to notify subscription cache of API key removal:', error);
          }
          
          // Refresh voices when ElevenLabs key is removed
          if (keyType === 'elevenlabs' && (window as any).loadVoices) {
            console.log('🔊 ElevenLabs key removed, refreshing voices...');
            (window as any).loadVoices();
            window.dispatchEvent(new CustomEvent('api-keys-updated'));
          }
          
          // Reload API keys to ensure state is correct
          await this.loadApiKeys();
          console.log(`[ApiKeysTab] Reloaded API keys, new state:`, this.apiKeys);
          console.log(`[ApiKeysTab] Key ${keyType} is now:`, this.apiKeys[keyType], `(should be undefined or empty)`);
          
          if (this.container) {
            // Find the field group for this key type
            const oldFieldGroup = this.container.querySelector(`#${keyType}-key`)?.closest('.settings-form-group');
            
            if (oldFieldGroup && oldFieldGroup.parentElement) {
              // Store the parent and position
              const parent = oldFieldGroup.parentElement;
              const nextSibling = oldFieldGroup.nextSibling;
              
              // Remove the old field group completely
              oldFieldGroup.remove();
              
              // Reload API keys to ensure state is correct
              await this.loadApiKeys();
              
              // Get translations
              const t = this.getApiKeysTranslations();
              
              // Create a completely fresh field using the same method as initial render
              const freshFieldGroup = this.createApiKeyField(keyType, t, false);
              
              // Insert the fresh field group in the same position
              if (nextSibling) {
                parent.insertBefore(freshFieldGroup, nextSibling);
              } else {
                parent.appendChild(freshFieldGroup);
              }
              
              console.log(`[ApiKeysTab] Completely recreated field group for ${keyType}`);
              
              // Wait for DOM to update, then focus the input
              requestAnimationFrame(() => {
                setTimeout(() => {
                  const freshInput = document.getElementById(`${keyType}-key`) as HTMLInputElement;
                  if (freshInput) {
                    freshInput.focus();
                    console.log(`[ApiKeysTab] Fresh input field ${keyType} created and focused`);
                  }
                }, 100);
              });
            } else {
              // Fallback: re-render entire content
              await this.loadApiKeys();
              await this.renderContent(this.container);
              
              requestAnimationFrame(() => {
                setTimeout(() => {
                  const freshInput = document.getElementById(`${keyType}-key`) as HTMLInputElement;
                  if (freshInput) {
                    freshInput.focus();
                  }
                }, 100);
              });
            }
          }
        } else {
          console.error('[ApiKeysTab] Failed to remove API key:', response.error);
          
          // Re-enable input field on failure
          if (inputField) {
            inputField.disabled = false;
            inputField.readOnly = false;
          }
          
          alert(`Failed to remove API key: ${response.error || 'Unknown error'}`);
          
          // Reload to restore previous state
          await this.loadApiKeys();
          if (this.container) {
            await this.renderContent(this.container);
          }
        }
      } catch (error) {
        console.error('[ApiKeysTab] Error removing API key:', error);
        alert(`Failed to remove API key: ${error instanceof Error ? error.message : 'Unknown error'}`);
        
        // Reload to restore previous state
        await this.loadApiKeys();
        if (this.container) {
          await this.renderContent(this.container);
        }
      }
    }
  }

  /**
   * Handle clearing all API keys
   */
  private async handleClearAll(t: any): Promise<void> {
    const confirmed = confirm(
      `⚠️ DANGER: Clear ALL API Keys?\n\n` +
      `This will permanently delete ALL API keys from secure storage including:\n` +
      `• OpenAI API Key\n` +
      `• ElevenLabs API Key\n` +
      `• DeepInfra API Key\n` +
      `• Google Translate API Key\n` +
      `• DeepL API Key\n\n` +
      `If you don't have these keys written down elsewhere, you'll need to generate new ones.\n\n` +
      `This action cannot be undone. Are you absolutely sure?`
    );

    if (confirmed) {
      const doubleConfirmed = confirm(
        `🚨 FINAL WARNING 🚨\n\n` +
        `You are about to permanently delete ALL API keys.\n\n` +
        `Click OK to proceed with deletion, or Cancel to abort.`
      );

      if (doubleConfirmed) {
        try {
          const response = await (window as any).electronAPI.invoke('config:clear-all-api-keys', {
            id: Date.now().toString(),
            timestamp: Date.now(),
            payload: {}
          });

          if (response.success) {
            alert('✅ All API keys have been cleared from secure storage.');

            // Refresh voices when all keys are cleared (ElevenLabs was included)
            if ((window as any).loadVoices) {
              console.log('🔊 All API keys cleared (including ElevenLabs), refreshing voices...');
              (window as any).loadVoices();
              window.dispatchEvent(new CustomEvent('api-keys-updated'));
            }

            // Reload API keys and re-render
            await this.loadApiKeys();
            if (this.container) {
              await this.renderContent(this.container);
            }
          } else {
            alert('Failed to clear API keys');
          }
        } catch (error) {
          console.error('Error clearing API keys:', error);
          alert('Failed to clear API keys');
        }
      }
    }
  }



  /**
   * Called when tab becomes active
   */
  public onActivate(): void {
    super.onActivate();
    // Clear cached Ultra access status to ensure fresh check
    this.cachedUltraAccess = null;
    
    // Reload both managed API mode and API keys when tab becomes active
    Promise.all([
      this.loadManagedApiMode(),
      this.loadApiKeys()
    ]).then(async () => {
      if (this.container) {
        // Clear container completely first to avoid any DOM conflicts
        this.container.innerHTML = '';
        
        // Show loading state briefly
        this.showLoadingState(this.container);
        
        // Small delay to ensure proper refresh
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // Re-render with fresh state
        await this.renderContent(this.container);
        
        // Ensure all input fields are enabled and interactive after re-render
        const inputs = this.container.querySelectorAll('input[type="password"], input[type="text"]') as NodeListOf<HTMLInputElement>;
        inputs.forEach(input => {
          input.disabled = false;
          input.readOnly = false;
          input.style.pointerEvents = 'auto';
          input.style.opacity = '1';
        });
        
        console.log('🔄 API Keys tab activated and refreshed');
      }
    }).catch(error => {
      console.error('Error reloading API keys tab:', error);
      if (this.container) {
        this.showErrorState(this.container, error);
      }
    });
  }

  /**
   * Called when tab becomes inactive (settings modal closing)
   */
  public onDeactivate(): void {
    super.onDeactivate();
    // Auto-save any API keys that have been entered when closing settings
    this.onSave().catch(err => console.error('Error auto-saving API keys on deactivate:', err));
  }

  /**
   * Save API keys and storage configuration
   */
  public async onSave(): Promise<boolean> {
    try {
      // Always use keychain storage (only option available)
      const storageConfig: StorageSettings = {
        type: 'keychain',
        hasPassphrase: false,
        lastMigration: new Date().toISOString()
      };

      // Save storage configuration
      const storageResponse = await (window as any).electronAPI.invoke('config:set', {
        id: Date.now().toString(),
        timestamp: Date.now(),
        payload: { storageConfig }
      });

      if (!storageResponse.success) {
        console.error('Failed to save storage configuration');
        return false;
      }

      this.storageConfig = storageConfig;

      // Save API keys
      const apiKeys: any = {};
      const services = ['openai', 'elevenlabs', 'deepinfra'];
      let elevenlabsKeyUpdated = false;

      // Only include keys that have values
      for (const service of services) {
        const input = document.getElementById(`${service}-key`) as HTMLInputElement;
        if (input && input.value.trim()) {
          apiKeys[service] = input.value.trim();
          // Check if ElevenLabs key was added/updated
          if (service === 'elevenlabs') {
            elevenlabsKeyUpdated = true;
          }
        }
      }

      // Only save if there are keys to save
      if (Object.keys(apiKeys).length > 0) {
        const response = await (window as any).electronAPI.invoke('secure-api-keys:set', {
          id: Date.now().toString(),
          timestamp: Date.now(),
          payload: { apiKeys }
        });

        if (response.success) {
          // Trigger API key configuration check
          if ((window as any).checkApiKeysConfiguration) {
            (window as any).checkApiKeysConfiguration();
          }
          
          // Notify subscription cache that API keys changed
          try {
            await (window as any).electronAPI.notifyApiKeysChanged();
            console.log('✅ Notified subscription cache of API key changes');
          } catch (error) {
            console.warn('Failed to notify subscription cache of API key changes:', error);
          }
          
          // Dispatch event to notify other components that API keys were updated
          window.dispatchEvent(new CustomEvent('api-keys-updated'));
          console.log('🔑 API keys updated, dispatched event');
          
          // Refresh voices when ElevenLabs key is added/updated
          // Add a small delay to ensure the API key is fully saved to secure storage
          if (elevenlabsKeyUpdated) {
            console.log('🔊 ElevenLabs key updated, will refresh voices...');
            // Wait a bit for the key to be fully saved, then refresh voices
            // The event listener in renderer.ts will also handle this, but we call it directly too
            setTimeout(async () => {
              if ((window as any).loadVoices) {
                try {
                  await (window as any).loadVoices();
                  console.log('✅ Voices refreshed after ElevenLabs key update');
                } catch (error) {
                  console.error('❌ Error refreshing voices:', error);
                  // Retry once after another delay
                  setTimeout(async () => {
                    if ((window as any).loadVoices) {
                      await (window as any).loadVoices();
                      console.log('✅ Voices refreshed on retry');
                    }
                  }, 1000);
                }
              } else {
                console.warn('⚠️ loadVoices function not available');
              }
            }, 800); // 800ms delay to ensure secure storage write completes
          }
          
          return true;
        } else {
          console.error('Failed to save API keys');
          return false;
        }
      }

      return true; // No keys to save is considered success
    } catch (error) {
      console.error('Error saving API keys and storage config:', error);
      return false;
    }
  }

  /**
   * Validate API keys
   */
  public validate(): boolean {
    // API keys are optional, so always valid
    return true;
  }

  /**
   * Get validation errors
   */
  public getValidationErrors(): string[] {
    return [];
  }

  /**
   * Force a complete refresh of the tab content
   * This method can be called externally to fix any UI glitches
   */
  public async forceRefresh(): Promise<void> {
    try {
      console.log('🔄 Force refreshing API Keys tab...');
      
      // Clear all cached state
      this.cachedUltraAccess = null;
      
      // Reload all data
      await Promise.all([
        this.loadManagedApiMode(),
        this.loadApiKeys()
      ]);
      
      if (this.container) {
        // Clear container completely
        this.container.innerHTML = '';
        
        // Show loading state briefly
        this.showLoadingState(this.container);
        
        // Small delay to ensure proper refresh
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Re-render with fresh state
        await this.renderContent(this.container);
        
        // Ensure all inputs are properly enabled
        const inputs = this.container.querySelectorAll('input[type="password"], input[type="text"]') as NodeListOf<HTMLInputElement>;
        inputs.forEach(input => {
          input.disabled = false;
          input.readOnly = false;
          input.style.pointerEvents = 'auto';
          input.style.opacity = '1';
        });
        
        console.log('✅ API Keys tab force refresh completed');
      }
    } catch (error) {
      console.error('Error during force refresh:', error);
      if (this.container) {
        this.showErrorState(this.container, error);
      }
    }
  }
}
