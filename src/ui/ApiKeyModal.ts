import { ApiKeys, StorageSettings } from '../types/ConfigurationTypes';

/**
 * API Key Management Modal with secure storage options
 */
export class ApiKeyModal {
  private modal: HTMLElement | null = null;
  private onSave?: (apiKeys: Partial<ApiKeys>) => void;
  private onStorageConfig?: (config: StorageSettings) => void;

  /**
   * Show the API key management modal
   */
  public show(
    currentKeys: ApiKeys,
    onSave: (apiKeys: Partial<ApiKeys>) => void,
    onStorageConfig?: (config: StorageSettings) => void
  ): void {
    this.onSave = onSave;
    this.onStorageConfig = onStorageConfig;
    this.createModal(currentKeys);
    document.body.appendChild(this.modal!);
    this.modal!.style.display = 'flex';
  }

  /**
   * Hide the modal
   */
  public hide(): void {
    if (this.modal && this.modal.parentNode) {
      this.modal.parentNode.removeChild(this.modal);
      this.modal = null;
    }
  }

  /**
   * Get placeholder text for API key input
   */
  private getPlaceholderText(service: string, isStored: boolean): string {
    const placeholders = {
      'openai': { stored: 'Key stored securely', empty: 'sk-...' },
      'elevenlabs': { stored: 'Key stored securely', empty: '32-character hex string' },
      'google': { stored: 'Key stored securely', empty: 'AIza...' },
      'deepl': { stored: 'Key stored securely', empty: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx:fx' }
    };
    return isStored ? placeholders[service as keyof typeof placeholders]?.stored || '' : placeholders[service as keyof typeof placeholders]?.empty || '';
  }

  /**
   * Create the modal HTML structure
   */
  private createModal(currentKeys: ApiKeys): void {
    this.modal = document.createElement('div');
    this.modal.className = 'api-key-modal';

    this.modal.innerHTML = `
      <div class="modal-overlay">
        <div class="modal-content">
          <div class="modal-header">
            <h2>🔐 Secure API Key Management</h2>
            <button class="close-button" type="button">&times;</button>
          </div>

          <div class="modal-body">
            <div class="storage-config-section">
              <h3>🔒 Storage Configuration</h3>
              <p class="storage-description">
                Choose how your API keys are stored. We recommend using OS keychain for maximum security.
              </p>

              <div class="storage-options">
                <div class="storage-option">
                  <input type="radio" id="storage-keychain" name="storage-type" value="keychain" checked>
                  <label for="storage-keychain">
                    <strong>OS Keychain (Recommended)</strong>
                    <p>Store keys securely in your operating system's credential manager. Most secure option.</p>
                  </label>
                </div>

                <div class="storage-option">
                  <input type="radio" id="storage-passphrase" name="storage-type" value="passphrase">
                  <label for="storage-passphrase">
                    <strong>Passphrase Encryption</strong>
                    <p>Encrypt keys with a passphrase. Good for portability across devices.</p>
                  </label>
                  <div class="passphrase-input" id="passphrase-section" style="display: none;">
                    <input type="password" id="storage-passphrase" placeholder="Enter encryption passphrase">
                    <small>Choose a strong passphrase. You'll need this to access your keys.</small>
                  </div>
                </div>

                <div class="storage-option">
                  <input type="radio" id="storage-none" name="storage-type" value="none">
                  <label for="storage-none">
                    <strong>No Storage</strong>
                    <p>Don't store keys. You'll need to enter them each time you use the app.</p>
                  </label>
                </div>
              </div>
            </div>

            <div class="api-key-section">
              <h3>🔑 API Keys</h3>
              <p class="modal-description">
                Your API keys are now stored securely and will never be saved as plaintext.
                <strong>All keys are masked for security.</strong>
              </p>

              <div class="api-key-group">
                <label for="openai-key">
                  <span class="service-icon">🤖</span>
                  OpenAI API Key
                  <span class="required">*</span>
                </label>
                <div class="input-group">
                  <input
                    type="password"
                    id="openai-key"
                    placeholder="sk-..."
                    value=""
                  />
                  <button type="button" class="toggle-visibility" data-target="openai-key" title="Toggle visibility">👁️</button>
                  <button type="button" class="show-key" data-service="openai" title="Show actual API key">🔍</button>
                  <button type="button" class="validate-key" data-service="openai" title="Validate API key">✓</button>
                  <button type="button" class="remove-key" data-service="openai" title="Remove API key">🗑️</button>
                </div>
                <div class="validation-status" id="openai-status"></div>
                <small class="help-text">
                  Required for speech-to-text and translation. Get your key from
                  <a href="https://platform.openai.com/api-keys" target="_blank">OpenAI Platform</a>
                </small>
              </div>

              <div class="api-key-group">
                <label for="elevenlabs-key">
                  <span class="service-icon">🎙️</span>
                  ElevenLabs API Key
                  <span class="required">*</span>
                </label>
                <div class="input-group">
                  <input
                    type="password"
                    id="elevenlabs-key"
                    placeholder="32-character hex string"
                    value=""
                  />
                  <button type="button" class="toggle-visibility" data-target="elevenlabs-key" title="Toggle visibility">👁️</button>
                  <button type="button" class="show-key" data-service="elevenlabs" title="Show actual API key">🔍</button>
                  <button type="button" class="validate-key" data-service="elevenlabs" title="Validate API key">✓</button>
                  <button type="button" class="remove-key" data-service="elevenlabs" title="Remove API key">🗑️</button>
                </div>
                <div class="validation-status" id="elevenlabs-status"></div>
                <small class="help-text">
                  Required for voice cloning and text-to-speech. Get your key from
                  <a href="https://elevenlabs.io/app/settings/api-keys" target="_blank">ElevenLabs</a>
                </small>
              </div>

              <div class="api-key-group">
                <label for="google-key">
                  <span class="service-icon">🌐</span>
                  Google Translate API Key
                  <span class="optional">(Optional)</span>
                </label>
                <div class="input-group">
                  <input
                    type="password"
                    id="google-key"
                    placeholder="AIza..."
                    value=""
                  />
                  <button type="button" class="toggle-visibility" data-target="google-key" title="Toggle visibility">👁️</button>
                  <button type="button" class="show-key" data-service="google" title="Show actual API key">🔍</button>
                  <button type="button" class="validate-key" data-service="google" title="Validate API key">✓</button>
                  <button type="button" class="remove-key" data-service="google" title="Remove API key">🗑️</button>
                </div>
                <div class="validation-status" id="google-status"></div>
                <small class="help-text">
                  Fallback translation service. Get your key from
                  <a href="https://console.cloud.google.com/apis/credentials" target="_blank">Google Cloud Console</a>
                </small>
              </div>

              <div class="api-key-group">
                <label for="deepl-key">
                  <span class="service-icon">🔄</span>
                  DeepL API Key
                  <span class="optional">(Optional)</span>
                </label>
                <div class="input-group">
                  <input
                    type="password"
                    id="deepl-key"
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx:fx"
                    value=""
                  />
                  <button type="button" class="toggle-visibility" data-target="deepl-key" title="Toggle visibility">👁️</button>
                  <button type="button" class="show-key" data-service="deepl" title="Show actual API key">🔍</button>
                  <button type="button" class="validate-key" data-service="deepl" title="Validate API key">✓</button>
                  <button type="button" class="remove-key" data-service="deepl" title="Remove API key">🗑️</button>
                </div>
                <div class="validation-status" id="deepl-status"></div>
                <small class="help-text">
                  High-quality translation service. Get your key from
                  <a href="https://www.deepl.com/account/summary" target="_blank">DeepL Account</a>
                </small>
              </div>
            </div>
          </div>

          <div class="modal-footer">
            <button type="button" class="btn-danger" id="clear-all-button">🗑️ Clear All Keys</button>
            <button type="button" class="btn-secondary" id="cancel-button">Cancel</button>
            <button type="button" class="btn-primary" id="save-button">Save Configuration</button>
          </div>
        </div>
      </div>
    `;

    this.addModalStyles();
    this.attachEventListeners();
  }

  /**
   * Add modal styles
   */
  private addModalStyles(): void {
    if (document.getElementById('api-key-modal-styles')) {
      return; // Styles already added
    }

    const styles = document.createElement('style');
    styles.id = 'api-key-modal-styles';
    styles.textContent = `
      .api-key-modal {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 1000;
        display: none;
      }

      .modal-overlay {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 2rem;
      }

      .modal-content {
        background: white;
        border-radius: 12px;
        max-width: 600px;
        width: 100%;
        max-height: 90vh;
        overflow-y: auto;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      }

      .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 1.5rem 2rem;
        border-bottom: 1px solid #e1e5e9;
      }

      .modal-header h2 {
        margin: 0;
        color: #333;
        font-size: 1.5rem;
      }

      .close-button {
        background: none;
        border: none;
        font-size: 1.5rem;
        cursor: pointer;
        color: #666;
        padding: 0.5rem;
        border-radius: 4px;
      }

      .close-button:hover {
        background: #f5f5f5;
        color: #333;
      }

      .modal-body {
        padding: 2rem;
      }

      .modal-description {
        margin-bottom: 2rem;
        color: #666;
        line-height: 1.5;
      }

      .api-key-group {
        margin-bottom: 2rem;
      }

      .api-key-group label {
        display: flex;
        align-items: center;
        margin-bottom: 0.5rem;
        font-weight: 500;
        color: #333;
      }

      .service-icon {
        margin-right: 0.5rem;
        font-size: 1.2rem;
      }

      .required {
        color: #e74c3c;
        margin-left: 0.25rem;
      }

      .optional {
        color: #7f8c8d;
        margin-left: 0.25rem;
        font-weight: normal;
        font-size: 0.9rem;
      }

      .input-group {
        display: flex;
        gap: 0.5rem;
        margin-bottom: 0.5rem;
      }

      .input-group input {
        flex: 1;
        padding: 0.75rem;
        border: 2px solid #e1e5e9;
        border-radius: 6px;
        font-size: 1rem;
        font-family: monospace;
      }

      .input-group input:focus {
        outline: none;
        border-color: #667eea;
        box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
      }

      .toggle-visibility,
      .validate-key,
      .show-key,
      .remove-key {
        padding: 0.75rem;
        border: 2px solid #e1e5e9;
        border-radius: 6px;
        background: white;
        cursor: pointer;
        font-size: 1rem;
        min-width: 2.5rem;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .toggle-visibility:hover,
      .validate-key:hover,
      .show-key:hover {
        background: #f8f9fa;
        border-color: #667eea;
      }

      .remove-key:hover {
        background: #fff5f5;
        border-color: #e74c3c;
        color: #e74c3c;
      }

      .show-key {
        background: #fff8f0;
        border-color: #f39c12;
      }

      .show-key:hover {
        background: #ffeaa7;
        border-color: #e67e22;
      }

      .validation-status {
        min-height: 1.5rem;
        font-size: 0.9rem;
        margin-bottom: 0.5rem;
      }

      .validation-status.success {
        color: #27ae60;
      }

      .validation-status.error {
        color: #e74c3c;
      }

      .validation-status.loading {
        color: #3498db;
      }

      .help-text {
        color: #7f8c8d;
        font-size: 0.85rem;
        line-height: 1.4;
      }

      .help-text a {
        color: #667eea;
        text-decoration: none;
      }

      .help-text a:hover {
        text-decoration: underline;
      }

      .modal-footer {
        display: flex;
        justify-content: flex-end;
        gap: 1rem;
        padding: 1.5rem 2rem;
        border-top: 1px solid #e1e5e9;
        background: #f8f9fa;
        border-radius: 0 0 12px 12px;
      }

      .btn-secondary,
      .btn-primary,
      .btn-danger {
        padding: 0.75rem 1.5rem;
        border: none;
        border-radius: 6px;
        font-size: 1rem;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .btn-secondary {
        background: #e9ecef;
        color: #495057;
      }

      .btn-secondary:hover {
        background: #dee2e6;
      }

      .btn-primary {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
      }

      .btn-primary:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
      }

      .btn-danger {
        background: #e74c3c;
        color: white;
      }

      .btn-danger:hover {
        background: #c0392b;
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(231, 76, 60, 0.3);
      }

      /* Storage Configuration Styles */
      .storage-config-section {
        margin-bottom: 2rem;
        padding: 1.5rem;
        background: #f8f9fa;
        border-radius: 8px;
        border: 1px solid #e1e5e9;
      }

      .storage-config-section h3 {
        margin: 0 0 1rem 0;
        color: #333;
        font-size: 1.1rem;
      }

      .storage-description {
        margin-bottom: 1.5rem;
        color: #666;
        line-height: 1.5;
      }

      .storage-options {
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }

      .storage-option {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }

      .storage-option input[type="radio"] {
        margin: 0;
      }

      .storage-option label {
        cursor: pointer;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }

      .storage-option label strong {
        color: #333;
        font-weight: 600;
      }

      .storage-option label p {
        margin: 0;
        color: #666;
        font-size: 0.9rem;
        line-height: 1.4;
      }

      .passphrase-input {
        margin-top: 0.5rem;
        padding: 1rem;
        background: white;
        border: 2px solid #e1e5e9;
        border-radius: 6px;
      }

      .passphrase-input input {
        width: 100%;
        padding: 0.75rem;
        border: 2px solid #e1e5e9;
        border-radius: 6px;
        font-size: 1rem;
        box-sizing: border-box;
      }

      .passphrase-input input:focus {
        outline: none;
        border-color: #667eea;
        box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
      }

      .passphrase-input small {
        display: block;
        margin-top: 0.5rem;
        color: #7f8c8d;
        font-size: 0.85rem;
      }

      .api-key-section h3 {
        margin: 0 0 1rem 0;
        color: #333;
        font-size: 1.1rem;
      }
    `;

    document.head.appendChild(styles);
  }

  /**
   * Attach event listeners to modal elements
   */
  private attachEventListeners(): void {
    if (!this.modal) return;

    // Close button
    const closeButton = this.modal.querySelector('.close-button') as HTMLButtonElement;
    closeButton?.addEventListener('click', () => this.hide());

    // Cancel button
    const cancelButton = this.modal.querySelector('#cancel-button') as HTMLButtonElement;
    cancelButton?.addEventListener('click', () => this.hide());

    // Save button
    const saveButton = this.modal.querySelector('#save-button') as HTMLButtonElement;
    saveButton?.addEventListener('click', () => this.handleSave());

    // Clear all button
    const clearAllButton = this.modal.querySelector('#clear-all-button') as HTMLButtonElement;
    clearAllButton?.addEventListener('click', () => this.handleClearAll());

    // Storage type selection
    const storageRadios = this.modal.querySelectorAll('input[name="storage-type"]');
    storageRadios.forEach(radio => {
      radio.addEventListener('change', (e) => {
        const target = e.target as HTMLInputElement;
        this.handleStorageTypeChange(target.value);
      });
    });

    // Toggle visibility buttons
    const toggleButtons = this.modal.querySelectorAll('.toggle-visibility');
    toggleButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        const target = (e.target as HTMLElement).dataset.target;
        if (target) {
          this.togglePasswordVisibility(target);
        }
      });
    });

    // Validate key buttons
    const validateButtons = this.modal.querySelectorAll('.validate-key');
    validateButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        const service = (e.target as HTMLElement).dataset.service;
        if (service) {
          this.validateApiKey(service);
        }
      });
    });

    // Show key buttons
    const showKeyButtons = this.modal.querySelectorAll('.show-key');
    showKeyButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        const service = (e.target as HTMLElement).dataset.service;
        if (service) {
          this.showApiKey(service);
        }
      });
    });

    // Remove key buttons
    const removeKeyButtons = this.modal.querySelectorAll('.remove-key');
    removeKeyButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        const service = (e.target as HTMLElement).dataset.service;
        if (service) {
          this.removeApiKey(service);
        }
      });
    });

    // Close on overlay click
    const overlay = this.modal.querySelector('.modal-overlay') as HTMLElement;
    overlay?.addEventListener('click', (e) => {
      if (e.target === overlay) {
        this.hide();
      }
    });
  }

  /**
   * Handle storage type change
   */
  private handleStorageTypeChange(storageType: string): void {
    const passphraseSection = document.getElementById('passphrase-section') as HTMLElement;

    if (storageType === 'passphrase') {
      passphraseSection.style.display = 'block';
    } else {
      passphraseSection.style.display = 'none';
    }
  }

  /**
   * Toggle password visibility for an input
   */
  private togglePasswordVisibility(inputId: string): void {
    const input = document.getElementById(inputId) as HTMLInputElement;
    if (input) {
      input.type = input.type === 'password' ? 'text' : 'password';
    }
  }

  /**
   * Validate an API key
   */
  private async validateApiKey(service: string): Promise<void> {
    const input = document.getElementById(`${service}-key`) as HTMLInputElement;
    const status = document.getElementById(`${service}-status`) as HTMLElement;
    
    if (!input || !status) return;

    const apiKey = input.value.trim();
    if (!apiKey) {
      status.textContent = 'Please enter an API key';
      status.className = 'validation-status error';
      return;
    }

    status.textContent = 'Validating...';
    status.className = 'validation-status loading';

    try {
      // Use the electronAPI to validate the key
      const response = await (window as any).electronAPI.invoke('config:validate-api-key', {
        id: Date.now().toString(),
        timestamp: Date.now(),
        payload: { service, apiKey }
      });

      if (response.success && response.payload.valid) {
        status.textContent = '✓ Valid API key';
        status.className = 'validation-status success';
      } else {
        status.textContent = `✗ ${response.payload.error || 'Invalid API key'}`;
        status.className = 'validation-status error';
      }
    } catch (error) {
      status.textContent = '✗ Validation failed';
      status.className = 'validation-status error';
    }
  }

  /**
   * Show actual API key with security warning
   */
  private async showApiKey(service: string): Promise<void> {
    const confirmed = confirm(
      `⚠️ SECURITY WARNING ⚠️\n\n` +
      `You are about to reveal the actual API key for ${service.toUpperCase()}.\n\n` +
      `This will display your sensitive API key in plain text. Make sure:\n` +
      `• Nobody else can see your screen\n` +
      `• You're in a secure environment\n` +
      `• You understand this key gives access to your ${service.toUpperCase()} account\n\n` +
      `Are you sure you want to continue?`
    );

    if (!confirmed) return;

    const input = document.getElementById(`${service}-key`) as HTMLInputElement;
    const status = document.getElementById(`${service}-status`) as HTMLElement;
    
    if (!input || !status) return;

    status.textContent = 'Loading stored key...';
    status.className = 'validation-status loading';

    try {
      // Get the actual API key from storage
      const response = await (window as any).electronAPI.invoke('config:get-api-key', {
        id: Date.now().toString(),
        timestamp: Date.now(),
        payload: { service }
      });

      if (response.success && response.payload.apiKey) {
        input.value = response.payload.apiKey;
        input.type = 'text'; // Make it visible
        status.textContent = `🔍 Showing actual ${service.toUpperCase()} API key`;
        status.className = 'validation-status success';
        
        // Auto-hide after 10 seconds for security
        setTimeout(() => {
          input.type = 'password';
          status.textContent = 'Key hidden for security';
          status.className = 'validation-status';
        }, 10000);
      } else {
        status.textContent = `No ${service.toUpperCase()} API key stored`;
        status.className = 'validation-status error';
      }
    } catch (error) {
      status.textContent = 'Failed to retrieve API key';
      status.className = 'validation-status error';
    }
  }

  /**
   * Remove individual API key with warning
   */
  private async removeApiKey(service: string): Promise<void> {
    const confirmed = confirm(
      `🗑️ Remove ${service.toUpperCase()} API Key\n\n` +
      `Are you sure you want to remove the ${service.toUpperCase()} API key?\n\n` +
      `⚠️ WARNING: If you don't have this key written down elsewhere, ` +
      `you will NOT be able to recover it and will need to create a new one ` +
      `from your ${service.toUpperCase()} account.\n\n` +
      `This action cannot be undone.`
    );

    if (!confirmed) return;

    const input = document.getElementById(`${service}-key`) as HTMLInputElement;
    const status = document.getElementById(`${service}-status`) as HTMLElement;
    
    if (!input || !status) return;

    // Immediately clear the input field for instant visual feedback
    input.value = '';
    input.disabled = true; // Disable during deletion
    
    status.textContent = 'Removing API key...';
    status.className = 'validation-status loading';

    try {
      // Remove the API key from storage
      const response = await (window as any).electronAPI.invoke('secure-api-keys:remove', {
        id: Date.now().toString(),
        timestamp: Date.now(),
        payload: { service }
      });

      if (response.success) {
        input.placeholder = this.getPlaceholderText(service, false);
        input.type = 'password';
        input.disabled = false;
        input.readOnly = false;
        input.style.fontFamily = '';
        
        // Focus the input field so user can immediately start typing
        input.focus();
        
        status.textContent = `✅ ${service.toUpperCase()} API key removed`;
        status.className = 'validation-status success';
        
        // Remove the remove button since key is no longer stored
        const removeButton = input.parentElement?.querySelector('.remove-key');
        if (removeButton) {
          removeButton.remove();
        }
        
        // Remove the show key button as well
        const showButton = input.parentElement?.querySelector('.show-key');
        if (showButton) {
          showButton.remove();
        }
        
        setTimeout(() => {
          status.textContent = '';
          status.className = 'validation-status';
        }, 3000);
      } else {
        input.disabled = false;
        status.textContent = 'Failed to remove API key';
        status.className = 'validation-status error';
      }
    } catch (error) {
      input.disabled = false;
      status.textContent = 'Error removing API key';
      status.className = 'validation-status error';
    }
  }

  /**
   * Clear all API keys with strong warning
   */
  private async handleClearAll(): Promise<void> {
    const confirmed = confirm(
      `🚨 REMOVE ALL API KEYS 🚨\n\n` +
      `This will permanently remove ALL stored API keys:\n` +
      `• OpenAI\n• ElevenLabs\n• Google Translate\n• DeepL\n\n` +
      `⚠️ CRITICAL WARNING:\n` +
      `If you don't have these keys saved elsewhere, you will NOT be able ` +
      `to recover them and will need to create new ones from each service.\n\n` +
      `This action cannot be undone.\n\n` +
      `Are you absolutely sure you want to continue?`
    );

    if (!confirmed) return;

    // Double confirmation for this destructive action
    const doubleConfirmed = confirm(
      `🚨 FINAL CONFIRMATION 🚨\n\n` +
      `You are about to PERMANENTLY DELETE all your API keys.\n\n` +
      `Last chance to cancel - click OK to proceed with deletion.`
    );

    if (!doubleConfirmed) return;

    try {
      // Clear all API keys
      const response = await (window as any).electronAPI.invoke('config:clear-all-api-keys', {
        id: Date.now().toString(),
        timestamp: Date.now(),
        payload: {}
      });

      if (response.success) {
        // Clear all input fields
        const services = ['openai', 'elevenlabs', 'google', 'deepl'];
        services.forEach(service => {
          const input = document.getElementById(`${service}-key`) as HTMLInputElement;
          const status = document.getElementById(`${service}-status`) as HTMLElement;
          if (input) input.value = '';
          if (status) {
            status.textContent = 'API key removed';
            status.className = 'validation-status success';
          }
        });

        alert('✅ All API keys have been successfully removed.');
        
        // Clear status messages after a moment
        setTimeout(() => {
          services.forEach(service => {
            const status = document.getElementById(`${service}-status`) as HTMLElement;
            if (status) {
              status.textContent = '';
              status.className = 'validation-status';
            }
          });
        }, 3000);
      } else {
        alert('❌ Failed to clear API keys. Please try again.');
      }
    } catch (error) {
      alert('❌ Error clearing API keys. Please try again.');
    }
  }

  /**
   * Handle save button click
   */
  private async handleSave(): Promise<void> {
    try {
      // Handle storage configuration first
      const storageType = (document.querySelector('input[name="storage-type"]:checked') as HTMLInputElement)?.value as 'keychain' | 'passphrase' | 'none';
      let passphrase: string | undefined;

      if (storageType === 'passphrase') {
        const passphraseInput = document.getElementById('storage-passphrase') as HTMLInputElement;
        passphrase = passphraseInput.value.trim();

        if (!passphrase) {
          alert('Please enter a passphrase for encrypted storage.');
          return;
        }
      }

      // Configure storage
      if (this.onStorageConfig) {
        const storageConfig: StorageSettings = {
          type: storageType,
          hasPassphrase: storageType === 'passphrase',
          lastMigration: new Date().toISOString()
        };
        await this.onStorageConfig(storageConfig);
      }

      // Collect and save API keys
      const apiKeys: Partial<ApiKeys> = {};
      const services = ['openai', 'elevenlabs', 'google', 'deepl'];

      for (const service of services) {
        const input = document.getElementById(`${service}-key`) as HTMLInputElement;
        if (input && input.value.trim()) {
          apiKeys[service as keyof ApiKeys] = input.value.trim();
        }
      }

      // Call the save callback
      if (this.onSave) {
        await this.onSave(apiKeys);
      }

      this.hide();
    } catch (error) {
      console.error('Error saving configuration:', error);
      alert('Failed to save configuration. Please try again.');
    }
  }
}