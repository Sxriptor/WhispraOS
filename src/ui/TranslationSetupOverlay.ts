/**
 * Translation Setup Overlay
 * Shows when translation configuration is missing (no API keys and no local models)
 */

export class TranslationSetupOverlay {
  private static instance: TranslationSetupOverlay | null = null;
  private modal: HTMLElement | null = null;

  private constructor() {}

  public static getInstance(): TranslationSetupOverlay {
    if (!TranslationSetupOverlay.instance) {
      TranslationSetupOverlay.instance = new TranslationSetupOverlay();
    }
    return TranslationSetupOverlay.instance;
  }

  /**
   * Show the translation setup overlay
   */
  public show(): void {
    // Don't show if already visible
    if (this.modal && this.modal.parentNode) {
      return;
    }

    this.createModal();
    document.body.appendChild(this.modal!);
    this.modal!.style.display = 'flex';
  }

  /**
   * Hide the overlay
   */
  public hide(): void {
    if (this.modal && this.modal.parentNode) {
      this.modal.parentNode.removeChild(this.modal);
      this.modal = null;
    }
  }

  /**
   * Check if overlay is currently visible
   */
  public isVisible(): boolean {
    return this.modal !== null && this.modal.parentNode !== null;
  }

  /**
   * Create the modal HTML structure
   */
  private createModal(): void {
    this.modal = document.createElement('div');
    this.modal.className = 'translation-setup-overlay';
    this.modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.75);
      backdrop-filter: blur(8px);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 10000;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    const styles = `
      <style>
        .translation-setup-overlay .setup-button {
          display: flex;
          align-items: center;
          justify-content: flex-start;
          gap: 12px;
          background: #111111;
          color: #ffffff;
          border: 1px solid #333333;
          padding: 14px 20px;
          border-radius: 8px;
          font-weight: 500;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          width: 100%;
          margin-bottom: 12px;
        }

        .translation-setup-overlay .setup-button:hover:not(:disabled) {
          background: #1a1a1a;
          border-color: #404040;
          transform: translateY(-1px);
        }

        .translation-setup-overlay .setup-button:active:not(:disabled) {
          transform: translateY(0);
        }

        .translation-setup-overlay .setup-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          background: #111111;
        }

        .translation-setup-overlay .setup-button.coming-soon {
          opacity: 0.6;
          cursor: default;
        }

        .translation-setup-overlay .setup-button-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          width: 18px;
          height: 18px;
          color: #ffffff;
          opacity: 0.9;
        }

        .translation-setup-overlay .setup-button:hover:not(:disabled) .setup-button-icon {
          opacity: 1;
        }
      </style>
    `;

    this.modal.innerHTML = `
      ${styles}
      <div style="
        background: #000000;
        border: 1px solid #333333;
        border-radius: 12px;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.8);
        width: 480px;
        max-width: 90%;
        padding: 32px;
        display: flex;
        flex-direction: column;
        position: relative;
      ">
        <h2 style="
          font-size: 20px;
          font-weight: 600;
          color: #ffffff;
          margin: 0 0 12px 0;
          text-align: center;
          letter-spacing: -0.025em;
        ">
          Translation Setup Required
        </h2>
        
        <p style="
          font-size: 14px;
          color: #a1a1aa;
          margin: 0 0 28px 0;
          text-align: center;
          line-height: 1.5;
        ">
          To use translation, you need to configure one of the following options:
        </p>

        <button class="setup-button" id="setup-api-keys-button">
          <span class="setup-button-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="m15.5 7.5 2.3 2.3a1 1 0 0 0 1.4 0l2.1-2.1a1 1 0 0 0 0-1.4L19 4"/>
              <path d="m21 2-9.6 9.6"/>
              <circle cx="7.5" cy="15.5" r="5.5"/>
            </svg>
          </span>
          <span>Add OpenAI / DeepInfra API Key</span>
        </button>

        <button class="setup-button" id="setup-local-model-button">
          <span class="setup-button-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect width="18" height="18" x="3" y="3" rx="2"/>
              <path d="M7 7h.01"/>
              <path d="M17 7h.01"/>
              <path d="M7 17h.01"/>
              <path d="M17 17h.01"/>
            </svg>
          </span>
          <span>Select a Local Model</span>
        </button>

        <button class="setup-button" id="setup-managed-mode-button">
          <span class="setup-button-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>
            </svg>
          </span>
          <span>Use Managed Mode</span>
        </button>

        <button style="
          margin-top: 20px;
          padding: 10px 16px;
          background: #111111;
          border: 1px solid #333333;
          color: #a1a1aa;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
        " id="setup-close-button" onmouseover="this.style.background='#1a1a1a'; this.style.color='#ffffff'; this.style.borderColor='#404040'" onmouseout="this.style.background='#111111'; this.style.color='#a1a1aa'; this.style.borderColor='#333333'">
          Close
        </button>
      </div>
    `;

    this.attachEventListeners();
  }

  /**
   * Attach event listeners to buttons
   */
  private attachEventListeners(): void {
    if (!this.modal) return;

    // API Keys button
    const apiKeysButton = this.modal.querySelector('#setup-api-keys-button') as HTMLButtonElement;
    if (apiKeysButton) {
      apiKeysButton.addEventListener('click', () => {
        this.hide();
        // Open settings to API keys tab
        import('./settings/SettingsIntegration.js').then(({ SettingsIntegration }) => {
          const settingsIntegration = SettingsIntegration.getInstance();
          settingsIntegration.showSettings('api-keys');
        }).catch((error) => {
          console.error('Failed to open settings:', error);
        });
      });
    }

    // Local Model button
    const localModelButton = this.modal.querySelector('#setup-local-model-button') as HTMLButtonElement;
    if (localModelButton) {
      localModelButton.addEventListener('click', () => {
        this.hide();
        // Open settings to models tab
        import('./settings/SettingsIntegration.js').then(({ SettingsIntegration }) => {
          const settingsIntegration = SettingsIntegration.getInstance();
          settingsIntegration.showSettings('models');
        }).catch((error) => {
          console.error('Failed to open settings:', error);
        });
      });
    }

    // Managed Mode button
    const managedModeButton = this.modal.querySelector('#setup-managed-mode-button') as HTMLButtonElement;
    if (managedModeButton) {
      managedModeButton.addEventListener('click', async () => {
        try {
          // Get current config
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
              mode: 'managed',
              lastModeSwitch: new Date().toISOString(),
              usageWarningsEnabled: true,
              autoSwitchOnLimit: false
            }
          };

          // Set OpenAI and Whisper cloud models if not already set
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
            payload: { mode: 'managed' }
          });

          // Refresh voices when mode changes
          if ((window as any).loadVoices) {
            (window as any).loadVoices();
          }
          window.dispatchEvent(new CustomEvent('managed-api-mode-changed', { 
            detail: { mode: 'managed' } 
          }));

          console.log('✅ Switched to managed mode and configured models');
          this.hide();
        } catch (error) {
          console.error('Failed to switch to managed mode:', error);
          // Show error message to user
          alert('Failed to switch to managed mode. Please try again or check your account status.');
        }
      });
    }

    // Close button
    const closeButton = this.modal.querySelector('#setup-close-button') as HTMLButtonElement;
    if (closeButton) {
      closeButton.addEventListener('click', () => {
        this.hide();
      });
    }

    // Close on overlay click (outside modal)
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) {
        this.hide();
      }
    });

    // Close on Escape key
    const escapeHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && this.isVisible()) {
        this.hide();
        document.removeEventListener('keydown', escapeHandler);
      }
    };
    document.addEventListener('keydown', escapeHandler);
  }
}

