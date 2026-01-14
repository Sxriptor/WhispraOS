/**
 * Account tab implementation
 * Displays user account information, subscription status, and preferences
 */

import { BaseSettingsTab } from '../interfaces/SettingsTab.js';
import { UsageDisplay } from '../../components/UsageDisplay.js';
import { getTranslations } from '../../../renderer/i18n.js';
// TODO: Use IPC to communicate with services
// For now, this tab will show static content

export class AccountTab extends BaseSettingsTab {
  public readonly id = 'account';
  public readonly title = 'Account';
  public readonly icon = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
  public readonly order = 0;

  private currentLanguage: string = 'en';
  private userEmail: string = '';
  private trialInfo: any = null;
  private usageDisplay: UsageDisplay | null = null;
  // TODO: Use IPC to communicate with services
  private accountTabCheckInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.loadCurrentLanguage();
    // TODO: Initialize IPC communication with services
  }

  /**
   * Load current language from global state
   */
  private loadCurrentLanguage(): void {
    this.currentLanguage = (window as any).currentLanguage || 'en';
  }

  /**
   * Get translations for current language using global i18n system
   */
  private getAccountTranslations(): any {
    const t = getTranslations(this.currentLanguage);
    const account = t.settingsModal?.account || {};
    
    // Return a structured object matching the expected format
    return {
      title: account.title || 'Account',
      sections: {
        profile: account.profile || 'Profile',
        subscription: account.subscription || 'Subscription',
        usage: account.usage || 'Usage',
        preferences: account.preferences || 'Preferences'
      },
      labels: {
        email: account.email || 'Email',
        plan: account.plan || 'Plan',
        trialDays: account.trialDays || 'Trial Days Remaining',
        status: account.status || 'Status',
        spokenLanguage: account.spokenLanguage || 'Language You Speak',
        rememberResponses: account.rememberResponses || 'Save API Responses',
        rememberResponsesDesc: account.rememberResponsesDesc || 'Store API responses for usage tracking and debugging. Disable for enhanced privacy.',
        usageUsed: account.usageUsed || 'Used this month',
        usageRemaining: account.usageRemaining || 'remaining',
        usageLoading: account.usageLoading || 'Loading usage data...',
        usageError: account.usageError || 'Unable to load usage data',
        usageWarningHigh: account.usageWarningHigh || '⚠️ High usage this month',
        usageWarningLimit: account.usageWarningLimit || '⚠️ Approaching usage limit'
      },
      buttons: {
        openDashboard: account.openDashboard || 'Manage Subscription',
        signOut: account.signOut || 'Sign Out'
      },
      messages: {
        opening: account.opening || 'Opening...',
        error: account.error || 'Failed to open account dashboard. Please visit account.whispra.xyz manually.',
        loading: account.loading || 'Loading account information...'
      },
      plans: {
        trial: account.trial || '7-Day Free Trial',
        active: account.active || 'Active Subscription',
        expired: account.expired || 'Expired'
      }
    };
  }

  /**
   * Render the Account tab content
   */
  public render(): HTMLElement {
    this.loadCurrentLanguage(); // Refresh language on render
    this.container = this.createElement('div', 'account-tab');
    this.renderContent(this.container);
    // Load data asynchronously and re-render when ready
    this.loadAccountData();
    return this.container;
  }

  /**
   * Load account data from storage and Supabase
   */
  private async loadAccountData(): Promise<void> {
    try {
      // Get user email from token
      const userEmail = await this.getUserEmail();
      this.userEmail = userEmail || 'Not available';

      // Get fresh data from Supabase
      const supabaseData = await this.getSupabaseUserAccess();
      console.log('Supabase user access data:', supabaseData);

      // Merge with local trial info (fallback)
      const localTrialInfo = await this.getTrialInfo();
      
      // Prefer Supabase data if available, fallback to local
      this.trialInfo = {
        hasAccess: supabaseData?.hasAccess ?? localTrialInfo?.hasAccess ?? false,
        isTrialActive: supabaseData?.isTrialActive ?? localTrialInfo?.isTrialActive ?? false,
        trialDaysRemaining: supabaseData?.trialDaysRemaining ?? localTrialInfo?.trialDaysRemaining,
        hasActiveSubscription: supabaseData?.hasActiveSubscription ?? false,
        subscriptionPlan: supabaseData?.subscriptionPlan,
        subscriptionStatus: supabaseData?.subscriptionStatus,
        planTier: supabaseData?.planTier ?? 'pro',
        hasManagedAPI: supabaseData?.hasManagedAPI ?? false
      };

      console.log('Final trial info:', this.trialInfo);
      console.log('Container exists?', !!this.container);

      // Re-render with loaded data
      if (this.container) {
        console.log('Re-rendering with loaded data...');
        this.renderContent(this.container);
      } else {
        console.error('Container not found for re-render!');
      }
    } catch (error) {
      console.error('Failed to load account data:', error);
    }
  }

  /**
   * Get user email from token
   */
  private async getUserEmail(): Promise<string | null> {
    try {
      const token = await (window as any).electronAPI.invoke('auth:get-token');
      if (!token) return null;

      // Decode JWT to get email
      const parts = token.split('.');
      if (parts.length !== 3) return null;

      const payload = JSON.parse(atob(parts[1]));
      return payload.email || null;
    } catch (error) {
      console.error('Failed to get user email:', error);
      return null;
    }
  }

  /**
   * Get trial info from local storage
   */
  private async getTrialInfo(): Promise<any> {
    try {
      const response = await (window as any).electronAPI.invoke('auth:get-trial-info');
      console.log('Local trial info response:', response);
      return response?.trialInfo || null;
    } catch (error) {
      console.error('Failed to get trial info:', error);
      return null;
    }
  }

  /**
   * Get fresh user access data from Supabase
   */
  private async getSupabaseUserAccess(): Promise<any> {
    try {
      // Force refresh subscription data when opening account tab
      await (window as any).electronAPI.forceRefreshSubscription('account tab opened');
      
      const response = await (window as any).electronAPI.invoke('subscription:check-access');
      console.log('Supabase check-access response:', response);
      
      if (response?.success) {
        // The response already contains the access data at the top level
        return {
          hasAccess: response.hasAccess,
          isTrialActive: response.isTrialActive,
          trialDaysRemaining: response.trialDaysRemaining,
          hasActiveSubscription: response.hasActiveSubscription,
          subscriptionPlan: response.subscriptionPlan,
          subscriptionStatus: response.subscriptionStatus,
          planTier: response.planTier,
          hasManagedAPI: response.hasManagedAPI
        };
      }
      
      return null;
    } catch (error) {
      console.error('Failed to get Supabase user access:', error);
      return null;
    }
  }

  /**
   * Render the tab content
   */
  private renderContent(container: HTMLElement): void {
    const t = this.getAccountTranslations();
    
    container.innerHTML = '';

    // Main container
    const mainContent = this.createElement('div');
    mainContent.style.cssText = `
      padding: var(--settings-spacing-xl);
      max-width: 600px;
    `;

    // Account info card
    const accountCard = this.createElement('div');
    accountCard.style.cssText = `
      background: var(--settings-bg-secondary);
      border: 1px solid var(--settings-border);
      border-radius: var(--settings-radius-lg);
      padding: var(--settings-spacing-xl);
      margin-bottom: var(--settings-spacing-lg);
    `;

    // Email
    const emailLabel = this.createElement('div');
    emailLabel.style.cssText = `
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--settings-text-secondary, rgba(255, 255, 255, 0.5));
      margin-bottom: 0.25rem;
      font-weight: 600;
    `;
    emailLabel.textContent = t.labels.email;

    const emailValue = this.createElement('div');
    emailValue.style.cssText = `
      font-size: 1rem;
      color: var(--settings-text, #ffffff);
      margin-bottom: var(--settings-spacing-lg);
    `;
    emailValue.textContent = this.userEmail || t.messages.loading;

    // Plan
    const planLabel = this.createElement('div');
    planLabel.style.cssText = `
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--settings-text-secondary, rgba(255, 255, 255, 0.5));
      margin-bottom: 0.25rem;
      font-weight: 600;
    `;
    planLabel.textContent = t.labels.plan;

    const planValue = this.createElement('div');
    planValue.style.cssText = `
      font-size: 1rem;
      color: var(--settings-text, #ffffff);
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: var(--settings-spacing-lg);
    `;
    
    // Determine plan name
    let planName: string;
    if (this.trialInfo?.hasActiveSubscription && this.trialInfo?.subscriptionPlan) {
      planName = this.trialInfo.subscriptionPlan;
    } else if (this.trialInfo?.isTrialActive) {
      planName = t.plans.trial;
    } else if (this.trialInfo?.hasAccess) {
      planName = t.plans.active;
    } else {
      planName = t.plans.expired;
    }
    
    planValue.textContent = planName;

    // Add Ultra badge if user has ultra plan (with managed API access)
    if (this.trialInfo?.planTier === 'ultra' && this.trialInfo?.hasManagedAPI) {
      const ultraBadge = this.createElement('span');
      ultraBadge.style.cssText = `
        display: inline-block;
        padding: 4px 12px;
        border-radius: 12px;
        font-size: 0.75rem;
        font-weight: 600;
        text-transform: uppercase;
        background: linear-gradient(135deg, #9C27B0 0%, #E91E63 100%);
        color: white;
        margin-left: 8px;
        box-shadow: 0 2px 8px rgba(156, 39, 176, 0.3);
      `;
      ultraBadge.textContent = '⭐ Ultra';
      planValue.appendChild(ultraBadge);
    }

    // Trial days if applicable
    if (this.trialInfo?.isTrialActive && this.trialInfo?.trialDaysRemaining !== undefined) {
      const trialDays = this.createElement('div');
      trialDays.style.cssText = `
        font-size: 0.85rem;
        color: var(--settings-text-secondary, rgba(255, 255, 255, 0.7));
        margin-top: 0.25rem;
      `;
      trialDays.textContent = `${this.trialInfo.trialDaysRemaining} days remaining`;
      planValue.appendChild(trialDays);
    }

    // Action button (inside card)
    const openButton = this.createElement('button', 'settings-button settings-button-primary') as HTMLButtonElement;
    openButton.style.cssText = `
      width: 100%;
      padding: var(--settings-spacing-md);
      font-size: 0.95rem;
      font-weight: 500;
      border-radius: var(--settings-radius-md);
    `;
    openButton.textContent = t.buttons.openDashboard;
    openButton.addEventListener('click', () => this.openAccountDashboard(t));

    accountCard.appendChild(emailLabel);
    accountCard.appendChild(emailValue);
    accountCard.appendChild(planLabel);
    accountCard.appendChild(planValue);
    accountCard.appendChild(openButton);
    mainContent.appendChild(accountCard);

    // Preferences
    const preferencesLabel = this.createElement('div');
    preferencesLabel.style.cssText = `
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--settings-text, #ffffff);
      margin-bottom: var(--settings-spacing-sm);
    `;
    preferencesLabel.textContent = t.sections.preferences;
    mainContent.appendChild(preferencesLabel);

    const preferencesCard = this.createElement('div');
    preferencesCard.style.cssText = `
      background: var(--settings-bg-secondary);
      border: 1px solid var(--settings-border);
      border-radius: var(--settings-radius-md);
      padding: var(--settings-spacing-md);
      margin-bottom: var(--settings-spacing-xl);
    `;
    preferencesCard.appendChild(this.createLanguageSelector(t.labels.spokenLanguage));
    
    // Add remember toggle for managed API users only
    if (this.trialInfo?.hasManagedAPI) {
      preferencesCard.appendChild(this.createRememberToggle());
    }
    
    mainContent.appendChild(preferencesCard);

    // Usage (only show for Ultra users with managed API)
    if (this.trialInfo?.hasManagedAPI) {
      const usageLabel = this.createElement('div');
      usageLabel.style.cssText = `
        font-size: 0.85rem;
        font-weight: 600;
        color: var(--settings-text, #ffffff);
        margin-bottom: var(--settings-spacing-sm);
      `;
      usageLabel.textContent = t.sections.usage;
      mainContent.appendChild(usageLabel);

      const usageCard = this.createElement('div');
      usageCard.style.cssText = `
        background: var(--settings-bg-secondary);
        border: 1px solid var(--settings-border);
        border-radius: var(--settings-radius-md);
        padding: var(--settings-spacing-lg);
        margin-bottom: var(--settings-spacing-xl);
      `;
      usageCard.appendChild(this.createUsageDisplay());
      mainContent.appendChild(usageCard);
    }

    container.appendChild(mainContent);
  }

  /**
   * Create usage display with progress bar
   */
  private createUsageDisplay(): HTMLElement {
    const t = this.getAccountTranslations();
    const container = this.createElement('div');
    
    // Loading state initially
    container.innerHTML = `
      <div style="text-align: center; color: var(--settings-text-secondary, rgba(255, 255, 255, 0.5)); font-size: 0.9rem;">
        ${t.labels.usageLoading}
      </div>
    `;

    // Load usage data asynchronously
    this.loadUsageData().then(usage => {
      if (!usage) {
        container.innerHTML = `
          <div style="text-align: center; color: var(--settings-text-secondary, rgba(255, 255, 255, 0.5)); font-size: 0.9rem;">
            ${t.labels.usageError}
          </div>
        `;
        return;
      }

      // Clear loading state
      container.innerHTML = '';

      // Determine the usage limit based on plan tier
      // Trial and Pro: $5, Ultra: $20
      const actualUsed = usage.totalCost || 0;
      const actualLimit = usage.usageLimit || 5;
      
      // For Ultra users, show $20 limit, otherwise $5
      const isUltra = this.trialInfo?.planTier === 'ultra';
      const displayLimit = isUltra ? 20 : 5;
      
      // Calculate percentage based on actual limit
      const percentage = Math.min((actualUsed / actualLimit) * 100, 100);
      
      // Display values: multiply actual cost to show subscription value
      // Ultra: 2x multiplier (users pay $2 for $1 of API usage)
      // Pro/Trial: 5x multiplier (users pay $5 for $1 of API usage)
      const displayMultiplier = isUltra ? 2 : 5;
      const displayUsed = actualUsed * displayMultiplier;
      const displayRemaining = displayLimit - displayUsed;

      // Usage text
      const usageText = this.createElement('div');
      usageText.style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
      `;
      
      const usedLabel = this.createElement('div');
      usedLabel.style.cssText = `
        font-size: 0.9rem;
        color: var(--settings-text-secondary, rgba(255, 255, 255, 0.7));
      `;
      usedLabel.textContent = t.labels.usageUsed;
      
      const usedAmount = this.createElement('div');
      usedAmount.style.cssText = `
        font-size: 1.1rem;
        font-weight: 600;
        color: var(--settings-text, #ffffff);
      `;
      usedAmount.textContent = `$${displayUsed.toFixed(2)} / $${displayLimit.toFixed(2)}`;
      
      usageText.appendChild(usedLabel);
      usageText.appendChild(usedAmount);
      container.appendChild(usageText);

      // Progress bar
      const progressBar = this.createElement('div');
      progressBar.style.cssText = `
        width: 100%;
        height: 8px;
        background: var(--settings-bg-secondary, rgba(255, 255, 255, 0.1));
        border-radius: 4px;
        overflow: hidden;
        margin-bottom: 12px;
      `;
      
      const progressFill = this.createElement('div');
      const color = percentage >= 90 ? '#f44336' : percentage >= 70 ? '#ff9800' : '#4caf50';
      progressFill.style.cssText = `
        width: ${percentage}%;
        height: 100%;
        background: ${color};
        transition: width 0.3s ease;
      `;
      
      progressBar.appendChild(progressFill);
      container.appendChild(progressBar);

      // Remaining text
      const remainingText = this.createElement('div');
      remainingText.style.cssText = `
        font-size: 0.85rem;
        color: var(--settings-text-secondary, rgba(255, 255, 255, 0.6));
        text-align: center;
      `;
      remainingText.textContent = `$${displayRemaining.toFixed(2)} ${t.labels.usageRemaining}`;
      container.appendChild(remainingText);

      // Warning if approaching limit
      if (percentage >= 80) {
        const warning = this.createElement('div');
        warning.style.cssText = `
          margin-top: 12px;
          padding: 8px 12px;
          background: rgba(255, 152, 0, 0.1);
          border: 1px solid rgba(255, 152, 0, 0.3);
          border-radius: 4px;
          font-size: 0.85rem;
          color: #ff9800;
          text-align: center;
        `;
        warning.textContent = percentage >= 90 
          ? t.labels.usageWarningLimit
          : t.labels.usageWarningHigh;
        container.appendChild(warning);
      }
    });

    return container;
  }

  /**
   * Load usage data from backend
   */
  private async loadUsageData(): Promise<any> {
    try {
      const response = await (window as any).electronAPI.invoke('subscription:get-usage');
      console.log('Usage data response:', response);
      
      if (response?.success && response?.usage) {
        return response.usage;
      }
      
      return null;
    } catch (error) {
      console.error('Failed to load usage data:', error);
      return null;
    }
  }

  /**
   * Create language selector
   */
  private createLanguageSelector(label: string): HTMLElement {
    const container = this.createElement('div');
    
    const labelEl = this.createElement('label');
    labelEl.style.cssText = `
      display: block;
      font-size: 0.9rem;
      font-weight: 500;
      color: var(--settings-text, #ffffff);
      margin-bottom: var(--settings-spacing-sm);
    `;
    labelEl.textContent = label;

    const select = this.createElement('select', 'settings-select') as HTMLSelectElement;
    select.id = 'settings-spoken-language';
    select.style.cssText = `
      width: 100%;
      padding: var(--settings-spacing-sm) var(--settings-spacing-md);
      border: 1px solid var(--settings-border);
      border-radius: var(--settings-radius-md);
      background: var(--settings-surface, #1a1a1a);
      color: var(--settings-text, #ffffff);
      font-size: 0.95rem;
      cursor: pointer;
    `;

    // Add language options (same as translate-to selector)
    const languages = [
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
      { code: 'tr', name: 'Turkish' },
      { code: 'pl', name: 'Polish' },
      { code: 'nl', name: 'Dutch' },
      { code: 'sv', name: 'Swedish' },
      { code: 'da', name: 'Danish' },
      { code: 'no', name: 'Norwegian' }
    ];

    languages.forEach(lang => {
      const option = this.createElement('option') as HTMLOptionElement;
      option.value = lang.code;
      option.textContent = lang.name;
      select.appendChild(option);
    });

    // Load saved preference
    this.loadSpokenLanguage().then(savedLang => {
      if (savedLang) select.value = savedLang;
    });

    // Save on change and sync with other selectors
    select.addEventListener('change', () => {
      this.saveSpokenLanguage(select.value);
      // Dispatch custom event to sync other language selectors
      window.dispatchEvent(new CustomEvent('spoken-language-changed', { 
        detail: { language: select.value, source: 'settings' } 
      }));
    });

    // Listen for spoken language changes from other sources (whispra translate, profile dropdown)
    window.addEventListener('spoken-language-changed', (event: Event) => {
      const customEvent = event as CustomEvent;
      const { language, source } = customEvent.detail;
      
      // Don't update if this selector was the source
      if (source === 'settings') return;
      
      // Update this selector if the language exists
      if (select.querySelector(`option[value="${language}"]`)) {
        select.value = language;
        console.log(`Settings language selector synced to ${language} from ${source}`);
      }
    });

    container.appendChild(labelEl);
    container.appendChild(select);

    return container;
  }

  /**
   * Create API mode display
   */
  private createApiModeDisplay(): HTMLElement {
    const container = this.createElement('div');
    
    const labelEl = this.createElement('div');
    labelEl.style.cssText = `
      font-size: 0.9rem;
      font-weight: 500;
      color: var(--settings-text, #ffffff);
      margin-bottom: var(--settings-spacing-sm);
    `;
    labelEl.textContent = 'Current API Mode';

    const modeDisplay = this.createElement('div');
    modeDisplay.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--settings-spacing-sm) var(--settings-spacing-md);
      background: var(--settings-surface, #1a1a1a);
      border: 1px solid var(--settings-border);
      border-radius: var(--settings-radius-md);
      margin-bottom: var(--settings-spacing-sm);
    `;

    const modeValue = this.createElement('div');
    modeValue.style.cssText = `
      font-size: 0.95rem;
      color: var(--settings-text, #ffffff);
      font-weight: 500;
    `;

    const switchButton = this.createElement('button', 'settings-button') as HTMLButtonElement;
    switchButton.style.cssText = `
      padding: var(--settings-spacing-xs) var(--settings-spacing-md);
      font-size: 0.85rem;
      font-weight: 500;
      border-radius: var(--settings-radius-sm);
    `;

    // Load current mode
    this.loadApiMode().then(async (currentMode) => {
      const mode = currentMode || 'personal';
      modeValue.textContent = mode === 'managed' ? 'Managed Mode' : 'Personal Mode';
      
      if (this.trialInfo?.hasManagedAPI) {
        // User has managed API access - show switch button
        switchButton.textContent = mode === 'managed' ? 'Switch to Personal' : 'Switch to Managed';
        switchButton.addEventListener('click', async () => {
          const newMode = mode === 'managed' ? 'personal' : 'managed';
          await this.switchApiMode(newMode);
          // Reload the tab to show updated mode
          this.render();
        });
        modeDisplay.appendChild(modeValue);
        modeDisplay.appendChild(switchButton);
      } else {
        // User doesn't have managed API access - just show mode
        modeValue.textContent = 'Personal Mode (Managed mode requires Ultra subscription)';
        modeDisplay.appendChild(modeValue);
      }
    });

    const description = this.createElement('div');
    description.style.cssText = `
      font-size: 0.8rem;
      color: var(--settings-text-secondary, rgba(255, 255, 255, 0.6));
      margin-top: var(--settings-spacing-xs);
    `;
    description.textContent = this.trialInfo?.hasManagedAPI 
      ? 'Managed mode uses Whispra\'s API keys. Personal mode uses your own API keys.'
      : 'You are using personal API keys. Upgrade to Ultra to access managed mode.';

    container.appendChild(labelEl);
    container.appendChild(modeDisplay);
    container.appendChild(description);

    return container;
  }

  /**
   * Load current API mode
   */
  private async loadApiMode(): Promise<'managed' | 'personal' | null> {
    try {
      const response = await (window as any).electronAPI.invoke('config:get', {
        id: Date.now().toString(),
        timestamp: Date.now()
      });
      return response?.payload?.managedApiConfig?.mode || 'personal';
    } catch (error) {
      console.error('Failed to load API mode:', error);
      return null;
    }
  }

  /**
   * Switch API mode
   */
  private async switchApiMode(newMode: 'managed' | 'personal'): Promise<void> {
    try {
      const configResponse = await (window as any).electronAPI.invoke('config:get', {
        id: Date.now().toString(),
        timestamp: Date.now(),
        payload: null
      });

      if (!configResponse.success || !configResponse.payload) {
        console.error('Failed to get config');
        return;
      }

      const config = configResponse.payload;
      const updates: any = {
        managedApiConfig: {
          mode: newMode,
          lastModeSwitch: new Date().toISOString(),
          usageWarningsEnabled: true,
          autoSwitchOnLimit: false
        }
      };

      // If switching to managed mode, set OpenAI and Whisper cloud models if not already set
      if (newMode === 'managed') {
        const currentModelConfig = config.modelConfig || config.cloudModelConfig;
        if (!currentModelConfig || !currentModelConfig.gptModel || currentModelConfig.gptModel === 'argos') {
          updates.modelConfig = {
            whisperModel: 'whisper-1',
            gptModel: 'openai',
            voiceModel: currentModelConfig?.voiceModel || 'elevenlabs',
            modelParameters: currentModelConfig?.modelParameters || {
              temperature: 0.7,
              maxTokens: 150,
              stability: 0.5,
              similarityBoost: 0.5,
              speed: 1.0
            }
          };
        } else if (currentModelConfig.whisperModel && !['whisper-1', 'deepinfra'].includes(currentModelConfig.whisperModel)) {
          // Update whisper model to cloud if it's local
          updates.modelConfig = {
            ...currentModelConfig,
            whisperModel: 'whisper-1'
          };
        }
      }

      // Save config
      await (window as any).electronAPI.invoke('config:set', {
        id: Date.now().toString(),
        timestamp: Date.now(),
        payload: updates
      });

      // Notify ManagedApiRouter
      await (window as any).electronAPI.invoke('managed-api:set-mode', {
        id: Date.now().toString(),
        timestamp: Date.now(),
        payload: { mode: newMode }
      });

      // Refresh voices when mode changes
      if ((window as any).loadVoices) {
        (window as any).loadVoices();
      }
      window.dispatchEvent(new CustomEvent('managed-api-mode-changed', { 
        detail: { mode: newMode } 
      }));

      console.log(`✅ Switched to ${newMode} mode`);
    } catch (error) {
      console.error('Failed to switch API mode:', error);
      throw error;
    }
  }

  /**
   * Load spoken language preference
   */
  private async loadSpokenLanguage(): Promise<string | null> {
    try {
      const response = await (window as any).electronAPI.invoke('config:get', {
        id: Date.now().toString(),
        timestamp: Date.now()
      });
      return response?.payload?.userPreferences?.spokenLanguage || null;
    } catch (error) {
      console.error('Failed to load spoken language:', error);
      return null;
    }
  }

  /**
   * Save spoken language preference
   */
  private async saveSpokenLanguage(language: string): Promise<void> {
    try {
      await (window as any).electronAPI.invoke('config:set', {
        id: Date.now().toString(),
        timestamp: Date.now(),
        payload: {
          userPreferences: {
            spokenLanguage: language
          }
        }
      });
      console.log(`Saved spoken language: ${language}`);
    } catch (error) {
      console.error('Failed to save spoken language:', error);
    }
  }

  /**
   * Create remember responses toggle
   */
  private createRememberToggle(): HTMLElement {
    const t = this.getAccountTranslations();
    const container = this.createElement('div');
    container.style.cssText = `
      margin-top: var(--settings-spacing-lg);
      padding-top: var(--settings-spacing-lg);
      border-top: 1px solid var(--settings-border);
    `;
    
    const toggleContainer = this.createElement('div');
    toggleContainer.style.cssText = `
      display: flex;
      align-items: flex-start;
      gap: var(--settings-spacing-md);
    `;

    // Toggle switch
    const toggleWrapper = this.createElement('div');
    toggleWrapper.style.cssText = `
      position: relative;
      flex-shrink: 0;
      margin-top: 2px;
    `;

    const toggle = this.createElement('input') as HTMLInputElement;
    toggle.type = 'checkbox';
    toggle.id = 'remember-responses-toggle';
    toggle.style.cssText = `
      position: absolute;
      opacity: 0;
      width: 0;
      height: 0;
    `;

    const toggleSlider = this.createElement('label');
    toggleSlider.setAttribute('for', 'remember-responses-toggle');
    toggleSlider.style.cssText = `
      display: block;
      width: 44px;
      height: 24px;
      background: var(--settings-bg-secondary, rgba(255, 255, 255, 0.2));
      border-radius: 12px;
      position: relative;
      cursor: pointer;
      transition: background-color 0.3s ease;
    `;

    const toggleKnob = this.createElement('div');
    toggleKnob.style.cssText = `
      position: absolute;
      top: 2px;
      left: 2px;
      width: 20px;
      height: 20px;
      background: white;
      border-radius: 50%;
      transition: transform 0.3s ease;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    `;

    toggleSlider.appendChild(toggleKnob);
    toggleWrapper.appendChild(toggle);
    toggleWrapper.appendChild(toggleSlider);

    // Label and description
    const labelContainer = this.createElement('div');
    labelContainer.style.cssText = `
      flex: 1;
    `;

    const label = this.createElement('div');
    label.style.cssText = `
      font-size: 0.9rem;
      font-weight: 500;
      color: var(--settings-text, #ffffff);
      margin-bottom: 0.25rem;
      cursor: pointer;
    `;
    label.textContent = t.labels.rememberResponses;
    label.addEventListener('click', () => toggle.click());

    const description = this.createElement('div');
    description.style.cssText = `
      font-size: 0.8rem;
      color: var(--settings-text-secondary, rgba(255, 255, 255, 0.6));
      line-height: 1.4;
    `;
    description.textContent = t.labels.rememberResponsesDesc;

    labelContainer.appendChild(label);
    labelContainer.appendChild(description);

    toggleContainer.appendChild(toggleWrapper);
    toggleContainer.appendChild(labelContainer);
    container.appendChild(toggleContainer);

    // Load saved preference (default to true)
    this.loadRememberPreference().then(remember => {
      toggle.checked = remember !== false; // Default to true if not set
      this.updateToggleAppearance(toggle, toggleSlider, toggleKnob);
    });

    // Handle toggle changes
    toggle.addEventListener('change', () => {
      this.saveRememberPreference(toggle.checked);
      this.updateToggleAppearance(toggle, toggleSlider, toggleKnob);
    });

    return container;
  }

  /**
   * Update toggle visual appearance
   */
  private updateToggleAppearance(toggle: HTMLInputElement, slider: HTMLElement, knob: HTMLElement): void {
    if (toggle.checked) {
      slider.style.background = '#4caf50';
      knob.style.transform = 'translateX(20px)';
    } else {
      slider.style.background = 'var(--settings-bg-secondary, rgba(255, 255, 255, 0.2))';
      knob.style.transform = 'translateX(0)';
    }
  }

  /**
   * Load remember responses preference
   */
  private async loadRememberPreference(): Promise<boolean> {
    try {
      const response = await (window as any).electronAPI.invoke('config:get', {
        id: Date.now().toString(),
        timestamp: Date.now()
      });
      return response?.payload?.userPreferences?.rememberResponses !== false; // Default to true
    } catch (error) {
      console.error('Failed to load remember preference:', error);
      return true; // Default to true
    }
  }

  /**
   * Save remember responses preference
   */
  private async saveRememberPreference(remember: boolean): Promise<void> {
    try {
      await (window as any).electronAPI.invoke('config:set', {
        id: Date.now().toString(),
        timestamp: Date.now(),
        payload: {
          userPreferences: {
            rememberResponses: remember
          }
        }
      });
      console.log(`Saved remember responses preference: ${remember}`);
    } catch (error) {
      console.error('Failed to save remember preference:', error);
    }
  }


  /**
   * Initialize usage display based on managed API availability
   */
  private async initializeUsageDisplay(container: HTMLElement, t: any): Promise<void> {
    try {
      // Check if user has managed API access
      const hasManagedAccess = true; // TODO: Check via IPC
      
      if (hasManagedAccess) {
        // Initialize usage display component
        this.usageDisplay = new UsageDisplay(container);
        
        // Set user token for usage monitoring
        const token = await this.getUserToken();
        if (token) {
          // TODO: Set user token and start monitoring via IPC
        }
      } else {
        // Show "no access" message
        container.style.cssText = `
          background: var(--settings-bg-secondary);
          border: 1px solid var(--settings-border);
          border-radius: var(--settings-radius-md);
          padding: var(--settings-spacing-lg);
          text-align: center;
          color: var(--settings-text-secondary, rgba(255, 255, 255, 0.5));
          font-size: 0.9rem;
        `;
        container.textContent = t.labels.noManagedAccess;
      }
    } catch (error) {
      console.error('Failed to initialize usage display:', error);
      
      // Show error state
      container.style.cssText = `
        background: var(--settings-bg-secondary);
        border: 1px solid var(--settings-border);
        border-radius: var(--settings-radius-md);
        padding: var(--settings-spacing-lg);
        text-align: center;
        color: rgba(255, 255, 255, 0.5);
        font-size: 0.9rem;
      `;
      container.textContent = t.labels.usageComingSoon;
    }
  }

  /**
   * Get user authentication token
   */
  private async getUserToken(): Promise<string | null> {
    try {
      return await (window as any).electronAPI.invoke('auth:get-token');
    } catch (error) {
      console.error('Failed to get user token:', error);
      return null;
    }
  }

  /**
   * Open account dashboard in default browser
   */
  private async openAccountDashboard(t: any): Promise<void> {
    const openButton = document.querySelector('.account-tab .settings-button-primary') as HTMLButtonElement;
    const originalText = openButton?.innerHTML || `🌐 ${t.buttons.openDashboard}`;
    
    try {
      if (openButton) {
        openButton.disabled = true;
        openButton.innerHTML = `⏳ ${t.messages.opening}`;
      }

      // Open the account dashboard URL in the default browser
      const response = await (window as any).electronAPI.invoke('open-external', 'https://account.whispra.xyz');

      if (!response.success) {
        throw new Error(response.error || 'Failed to open external URL');
      }

      // Brief delay to show the "opening" message
      setTimeout(() => {
        if (openButton) {
          openButton.disabled = false;
          openButton.innerHTML = originalText;
        }
      }, 1500);

    } catch (error) {
      console.error('Error opening account dashboard:', error);
      alert(t.messages.error);
      
      if (openButton) {
        openButton.disabled = false;
        openButton.innerHTML = originalText;
      }
    }
  }

  /**
   * Refresh content (re-render)
   */
  private refreshContent(): void {
    this.loadCurrentLanguage();
    if (this.container) {
      this.renderContent(this.container);
    }
  }

  /**
   * Called when tab becomes active
   */
  public onActivate(): void {
    super.onActivate();
    // Refresh content when tab becomes active to update language
    this.refreshContent();
    
    // Check subscription immediately when account tab is activated
    this.checkSubscriptionOnAccountTab();
    
    // Set up 30-second interval to check subscription while account tab is active
    this.startAccountTabSubscriptionCheck();
  }

  /**
   * Called when tab becomes inactive
   */
  public onDeactivate(): void {
    super.onDeactivate();
    // Stop the 30-second interval when tab is deactivated
    this.stopAccountTabSubscriptionCheck();
    
    // Don't stop monitoring here as other components might need it
    // The UsageMonitorService manages its own lifecycle
  }

  /**
   * Start 30-second subscription check interval for account tab
   */
  private startAccountTabSubscriptionCheck(): void {
    // Clear any existing interval
    this.stopAccountTabSubscriptionCheck();
    
    // Check every 30 seconds
    this.accountTabCheckInterval = setInterval(() => {
      this.checkSubscriptionOnAccountTab();
    }, 30000); // 30 seconds
    
    console.log('🔍 [Account Tab] Started 30-second subscription check interval');
  }

  /**
   * Stop the 30-second subscription check interval
   */
  private stopAccountTabSubscriptionCheck(): void {
    if (this.accountTabCheckInterval) {
      clearInterval(this.accountTabCheckInterval);
      this.accountTabCheckInterval = null;
      console.log('🔍 [Account Tab] Stopped 30-second subscription check interval');
    }
  }

  /**
   * Check subscription status when account tab is active
   */
  private async checkSubscriptionOnAccountTab(): Promise<void> {
    try {
      console.log('🔍 [Account Tab] Checking subscription status...');
      if ((window as any).electronAPI?.forceSubscriptionCheck) {
        const result = await (window as any).electronAPI.forceSubscriptionCheck();
        if (result && !result.hasAccess) {
          console.log('🚪 [Account Tab] User has no access - sign out should have been triggered');
        } else {
          console.log('✅ [Account Tab] User has access');
        }
      }
    } catch (error) {
      console.error('❌ [Account Tab] Failed to check subscription:', error);
    }
    
    // TODO: Restart usage monitoring via IPC
  }



  /**
   * Save account configuration (no-op for this tab)
   */
  public async onSave(): Promise<boolean> {
    // No configuration to save for this tab
    return true;
  }

  /**
   * Validate account configuration (always valid)
   */
  public validate(): boolean {
    return true;
  }

  /**
   * Get validation errors (none for this tab)
   */
  public getValidationErrors(): string[] {
    return [];
  }
}
