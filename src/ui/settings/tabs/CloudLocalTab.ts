/**
 * Cloud/Local processing tab implementation
 * Manages processing mode selection and local model configuration
 */

import { BaseSettingsTab } from '../interfaces/SettingsTab.js';
import { LocalModalOverlay } from '../../LocalModalOverlay.js';

// Define processing configuration interfaces
interface ProcessingConfig {
  mode: 'cloud' | 'local';
  localModelPaths: LocalModelPaths;
  processingPreferences: ProcessingPreferences;
}

interface LocalModelPaths {
  whisperModelPath?: string;
  gptModelPath?: string;
  translationModelPath?: string;
  voiceModelPath?: string;
}

interface ProcessingPreferences {
  fallbackToCloud: boolean;
  cacheModels: boolean;
  maxMemoryUsage: number;
  enableGpuAcceleration: boolean;
}

export class CloudLocalTab extends BaseSettingsTab {
  public readonly id = 'cloud-local';
  public readonly title = 'Cloud/Local';
  public readonly icon = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/></svg>';
  public readonly order = 3;

  private processingConfig: ProcessingConfig = {
    mode: 'cloud',
    localModelPaths: {},
    processingPreferences: {
      fallbackToCloud: true,
      cacheModels: true,
      maxMemoryUsage: 4096,
      enableGpuAcceleration: false
    }
  };

  private currentLanguage: string = 'en';
  private localModal: LocalModalOverlay | null = null;
  private userHasChangedMode: boolean = false;

  // Translation strings for different languages
  private translations = {
    'en': {
      sections: {
        mode: 'Processing Mode',
        modeDesc: 'Choose where AI processing happens: in the cloud or locally on your device'
      },
      modes: {
        cloud: 'Cloud Processing',
        cloudDesc: 'Use online AI services (OpenAI, ElevenLabs). Requires internet connection and API keys.',
        local: 'Local Processing',
        localDesc: 'Use AI models installed on your device. Works offline but requires model files.'
      },
      buttons: {
        testLocal: 'Test Local Processing',
        resetPaths: 'Reset Paths'
      },
      messages: {
        testSuccess: 'Local processing test successful',
        testFailed: 'Local processing test failed',
        resetConfirm: 'Reset all local model paths?',
        resetComplete: 'Local model paths have been reset'
      },
      warnings: {
        localRequiresModels: 'Local processing requires valid model files to function',
        cloudRequiresInternet: 'Cloud processing requires internet connection and API keys'
      }
    },
    'es': {
      sections: {
        mode: 'Modo de Procesamiento',
        modeDesc: 'Elige dónde ocurre el procesamiento de IA: en la nube o localmente en tu dispositivo'
      },
      modes: {
        cloud: 'Procesamiento en la Nube',
        cloudDesc: 'Usar servicios de IA en línea (OpenAI, ElevenLabs). Requiere conexión a internet y claves API.',
        local: 'Procesamiento Local',
        localDesc: 'Usar modelos de IA instalados en tu dispositivo. Funciona sin conexión pero requiere archivos de modelo.'
      },
      buttons: {
        testLocal: 'Probar Procesamiento Local',
        resetPaths: 'Restablecer Rutas'
      },
      messages: {
        testSuccess: 'Prueba de procesamiento local exitosa',
        testFailed: 'Prueba de procesamiento local falló',
        resetConfirm: '¿Restablecer todas las rutas de modelos locales?',
        resetComplete: 'Las rutas de modelos locales han sido restablecidas'
      },
      warnings: {
        localRequiresModels: 'El procesamiento local requiere archivos de modelo válidos para funcionar',
        cloudRequiresInternet: 'El procesamiento en la nube requiere conexión a internet y claves API'
      }
    }
  };

  constructor() {
    super();
    this.loadCurrentLanguage();
    // Don't load config in constructor - it's async and might interfere
  }

  /**
   * Load current language from global state
   */
  private loadCurrentLanguage(): void {
    // Try to get current language from global variable or default to 'en'
    this.currentLanguage = (window as any).currentLanguage || 'en';
  }

  /**
   * Get translations for current language
   */
  private getTranslations(): any {
    return this.translations[this.currentLanguage as keyof typeof this.translations] || this.translations['en'];
  }

  /**
   * Load processing configuration from storage
   */
  private async loadProcessingConfig(): Promise<void> {
    try {
      console.log('Loading processing configuration from storage...');
      const response = await (window as any).electronAPI.invoke('config:get', {
        id: Date.now().toString(),
        timestamp: Date.now(),
        payload: null
      });

      console.log('Config response:', response);
      if (response.success && response.payload?.processingConfig) {
        console.log('Loaded processingConfig from storage:', response.payload.processingConfig);
        console.log('User has changed mode:', this.userHasChangedMode);
        
        // Only merge config if user hasn't made manual changes
        if (!this.userHasChangedMode) {
          this.processingConfig = { ...this.processingConfig, ...response.payload.processingConfig };
          console.log('Final processingConfig after merge:', this.processingConfig);
        } else {
          console.log('User has made changes, not overriding with stored config');
        }
      } else {
        console.log('No processingConfig found in storage, using defaults');
      }
    } catch (error) {
      console.error('Error loading processing configuration:', error);
      // Use defaults if loading fails
    }
  }

  /**
   * Render the tab content
   */
  public render(): HTMLElement {
    const container = this.createElement('div', 'cloud-local-tab');

    // Load configuration first, then render
    this.loadProcessingConfig().then(() => {
      this.renderContent(container);
    });

    return container;
  }

  /**
   * Render the tab content
   */
  private renderContent(container: HTMLElement): void {
    const t = this.getTranslations();
    
    container.innerHTML = '';

    // Create section header
    const header = this.createElement('h2', 'settings-section-header');
    header.textContent = `Processing Configuration`;
    container.appendChild(header);

    // Create processing mode section
    const modeSection = this.createProcessingModeSection(t);
    container.appendChild(modeSection);

    // Create action buttons
    const actionsSection = this.createActionsSection(t);
    container.appendChild(actionsSection);

    console.log('CloudLocalTab rendered with mode:', this.processingConfig.mode);
  }

  /**
   * Create processing mode selection section
   */
  private createProcessingModeSection(t: any): HTMLElement {
    const section = this.createElement('div', 'settings-form-group');
    
    const title = this.createElement('h3', 'settings-section-header');
    title.textContent = `⚙️ ${t.sections.mode}`;
    section.appendChild(title);

    const description = this.createElement('p', 'settings-section-description');
    description.textContent = t.sections.modeDesc;
    section.appendChild(description);

    // Cloud processing option
    const cloudOption = this.createModeOption('cloud', t.modes.cloud, t.modes.cloudDesc, t);
    section.appendChild(cloudOption);

    // Local processing option
    const localOption = this.createModeOption('local', t.modes.local, t.modes.localDesc, t);
    section.appendChild(localOption);


    // Add warning message
    const warningContainer = this.createElement('div');
    warningContainer.id = 'processing-mode-warning';
    warningContainer.style.cssText = `
      margin-top: var(--settings-spacing-md);
      padding: var(--settings-spacing-md);
      background: var(--settings-warning);
      color: white;
      border-radius: var(--settings-radius-md);
      font-size: 0.875rem;
    `;
    section.appendChild(warningContainer);

    this.updateModeWarning(t);

    return section;
  }

  /**
   * Create individual processing mode option
   */
  private createModeOption(mode: 'cloud' | 'local', title: string, description: string, t: any): HTMLElement {
    const option = this.createElement('div');
    option.style.cssText = `
      border: 1px solid var(--settings-border);
      border-radius: var(--settings-radius-md);
      padding: var(--settings-spacing-md);
      margin-bottom: var(--settings-spacing-sm);
      background: var(--settings-background);
    `;

    const radioContainer = this.createElement('div');
    radioContainer.style.cssText = `
      display: flex;
      align-items: flex-start;
      gap: var(--settings-spacing-sm);
    `;

    const radio = this.createElement('input') as HTMLInputElement;
    radio.type = 'radio';
    radio.name = 'processing-mode';
    radio.value = mode;
    radio.id = `processing-${mode}`;
    radio.checked = this.processingConfig.mode === mode;
    radio.addEventListener('change', async () => {
      console.log('=== RADIO BUTTON CLICKED ===');
      console.log('Mode being set:', mode);
      console.log('Radio button value:', radio.value);
      console.log('Radio button checked:', radio.checked);

      // Immediately update the configuration
      this.processingConfig.mode = mode;
      this.userHasChangedMode = true;

      console.log('Configuration updated to:', this.processingConfig);
      this.updateModeWarning(t);
      
      // Handle the mode change (this will show the local modal if needed)
      this.handleModeChange(mode, t);
      
      // Auto-save on change
      await this.onSave();
    });

    const labelContainer = this.createElement('div');
    labelContainer.style.flex = '1';

    const label = this.createElement('label');
    label.setAttribute('for', `processing-${mode}`);
    label.style.cssText = `
      font-weight: 600;
      color: var(--settings-text);
      cursor: pointer;
      display: block;
      margin-bottom: var(--settings-spacing-xs);
    `;
    label.textContent = title;

    const desc = this.createElement('p');
    desc.style.cssText = `
      margin: 0;
      color: var(--settings-text-secondary);
      font-size: 0.875rem;
      line-height: 1.4;
    `;
    desc.textContent = description;

    labelContainer.appendChild(label);
    labelContainer.appendChild(desc);

    radioContainer.appendChild(radio);
    radioContainer.appendChild(labelContainer);
    option.appendChild(radioContainer);

    return option;
  }

  /**
   * Handle processing mode change
   */
  private handleModeChange(mode: 'cloud' | 'local', t: any): void {
    console.log('Mode change triggered:', mode);
    console.log('Before update - processingConfig:', this.processingConfig);
    
    // Mark that user has made a manual change
    this.userHasChangedMode = true;
    
    // Create a new object to ensure the reference is updated
    this.processingConfig = {
      ...this.processingConfig,
      mode: mode
    };
    
    console.log('After update - processingConfig:', this.processingConfig);
    this.updateModeWarning(t);
    
    // Show local models setup modal when local mode is selected
    if (mode === 'local') {
      this.showLocalModelsModal();
    }
  }

  /**
   * Show the local models setup modal
   */
  private showLocalModelsModal(): void {
    if (!this.localModal) {
      this.localModal = new LocalModalOverlay();
    }
    
    this.localModal.show(() => {
      // Modal closed callback - refresh model status
      console.log('Local models modal closed');
      this.checkAndUpdateLocalModeWarning();
    });
  }

  /**
   * Update mode warning message
   */
  private updateModeWarning(t: any): void {
    const warningContainer = document.getElementById('processing-mode-warning');
    if (!warningContainer) return;

    let warningText = '';
    
    switch (this.processingConfig.mode) {
      case 'cloud':
        warningText = `ℹ️ ${t.warnings.cloudRequiresInternet}`;
        break;
      case 'local':
        warningText = `ℹ️ ${t.warnings.localRequiresModels}`;
        break;
    }
    
    warningContainer.textContent = warningText;
    
    // If local mode is selected, check model status and update warning
    if (this.processingConfig.mode === 'local') {
      this.checkAndUpdateLocalModeWarning();
    }
  }

  /**
   * Check local model status and update warning accordingly
   */
  private async checkAndUpdateLocalModeWarning(): Promise<void> {
    try {
      const response = await (window as any).electronAPI.invoke('local-models:check-installations', {
        id: Date.now().toString(),
        timestamp: Date.now(),
        payload: {}
      });

      if (response.success) {
        const modelStatuses = response.payload;
        const missingModels: string[] = [];
        
        if (!modelStatuses.argos) missingModels.push('Argos Translate');
        if (!modelStatuses.whisper) missingModels.push('Fast Whisper');
        
        const warningContainer = document.getElementById('processing-mode-warning');
        if (warningContainer) {
          if (missingModels.length > 0) {
            warningContainer.innerHTML = `
              <div style="color: #dc2626; font-weight: 600;">
                ℹ️ Local processing requires all AI models to be installed
              </div>
              <div style="color: #6b7280; font-size: 0.875rem; margin-top: 4px;">
                Missing: ${missingModels.join(', ')}. Click the "Local Models Setup" button to download them.
              </div>
            `;
            warningContainer.style.background = '#fee2e2';
            warningContainer.style.border = '1px solid #fecaca';
          } else {
            warningContainer.innerHTML = `
              <div style="color: #059669; font-weight: 600;">
                ✅ All required local models are installed
              </div>
              <div style="color: #6b7280; font-size: 0.875rem; margin-top: 4px;">
                Local processing is ready to use.
              </div>
            `;
            warningContainer.style.background = '#d1fae5';
            warningContainer.style.border = '1px solid #a7f3d0';
          }
        }
      }
    } catch (error) {
      console.error('Error checking local model status:', error);
    }
  }

  /**
   * Create actions section
   */
  private createActionsSection(t: any): HTMLElement {
    const section = this.createElement('div');
    section.style.cssText = `
      display: flex;
      gap: var(--settings-spacing-md);
      justify-content: flex-end;
      margin-top: var(--settings-spacing-xl);
    `;

    return section;
  }

  /**
   * Called when tab becomes active
   */
  public onActivate(): void {
    super.onActivate();
    
    // Only re-render if container exists, don't reload config (preserves user changes)
    if (this.container) {
      this.renderContent(this.container);
      
      // If local mode is selected, refresh the model status
      if (this.processingConfig.mode === 'local') {
        this.checkAndUpdateLocalModeWarning();
      }
    }
  }

  /**
   * Save processing configuration
   */
  public async onSave(): Promise<boolean> {
    try {
      console.log('=== SAVE DEBUG ===');
      console.log('Current processingConfig:', this.processingConfig);

      // Prefer existing stored config when radios are not available (e.g., saving all tabs at once)
      let resolvedMode: 'cloud' | 'local' = this.processingConfig.mode;

      try {
        const currentConfigResponse = await (window as any).electronAPI.invoke('config:get', {
          id: Date.now().toString(),
          timestamp: Date.now(),
          payload: null
        });
        if (currentConfigResponse.success && currentConfigResponse.payload?.processingConfig?.mode) {
          resolvedMode = currentConfigResponse.payload.processingConfig.mode;
          console.log('Resolved mode from stored config:', resolvedMode);
        }
      } catch (e) {
        console.warn('Unable to read stored processing config, will rely on UI if present.');
      }

      // Read from radio buttons only if they exist in the DOM (tab is active)
      const cloudRadio = document.querySelector('input[name="processing-mode"][value="cloud"]') as HTMLInputElement;
      const localRadio = document.querySelector('input[name="processing-mode"][value="local"]') as HTMLInputElement;

      if (cloudRadio && localRadio) {
        const actualMode = localRadio.checked ? 'local' : 'cloud';
        console.log('Cloud radio checked:', !!cloudRadio?.checked);
        console.log('Local radio checked:', !!localRadio?.checked);
        console.log('Setting mode to (from UI):', actualMode);
        resolvedMode = actualMode;
      } else {
        console.log('Radio inputs not found, using resolved mode (stored):', resolvedMode);
      }

      // Apply resolved mode without clobbering other properties
      this.processingConfig = {
        ...this.processingConfig,
        mode: resolvedMode
      };

      console.log('Final processingConfig being saved:', this.processingConfig);
      
      // Validate configuration before saving
      const validation = await this.validateAsync();
      if (!validation.isValid) {
        console.error('Validation failed:', validation.errors);
        
        // Show user-friendly error message
        this.showValidationError(validation.errors.join(' '));
        return false;
      }
      
      console.log('=== END SAVE DEBUG ===');

      const response = await (window as any).electronAPI.invoke('config:set', {
        id: Date.now().toString(),
        timestamp: Date.now(),
        payload: { processingConfig: this.processingConfig }
      });

      if (response.success) {
        console.log('Processing configuration saved successfully');
        return true;
      } else {
        console.error('Failed to save processing configuration');
        return false;
      }
    } catch (error) {
      console.error('Error saving processing configuration:', error);
      return false;
    }
  }

  /**
   * Validate processing configuration (synchronous interface)
   */
  public validate(): boolean {
    // For synchronous validation, we can only check basic state
    // Async validation is handled in onSave method
    return true;
  }

  /**
   * Get validation errors (synchronous interface)
   */
  public getValidationErrors(): string[] {
    // For synchronous validation, we return empty array
    // Real validation happens in onSave method
    return [];
  }

  /**
   * Async validation for local model requirements
   */
  private async validateAsync(): Promise<{ isValid: boolean; errors: string[] }> {
    const errors: string[] = [];

    // Check if local mode is selected and validate model requirements
    if (this.processingConfig.mode === 'local') {
      const modelErrors = await this.checkLocalModelRequirements();
      errors.push(...modelErrors);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Check if all required local models are installed
   */
  private async checkLocalModelRequirements(): Promise<string[]> {
    const errors: string[] = [];
    
    try {
      // Call the main process to check if models exist
      const response = await (window as any).electronAPI.invoke('local-models:check-installations', {
        id: Date.now().toString(),
        timestamp: Date.now(),
        payload: {}
      });

      if (response.success) {
        const modelStatuses = response.payload;
        const missingModels: string[] = [];
        
        if (!modelStatuses.argos) missingModels.push('Argos Translate');
        if (!modelStatuses.whisper) missingModels.push('Fast Whisper');
        
        if (missingModels.length > 0) {
          errors.push(`Local processing requires all AI models to be installed. Missing: ${missingModels.join(', ')}. Please download the required models first.`);
        }
      } else {
        errors.push('Unable to verify local model installation status. Please try again.');
      }
    } catch (error) {
      console.error('Error checking local model requirements:', error);
      errors.push('Unable to verify local model installation status. Please try again.');
    }
    
    return errors;
  }

  /**
   * Show validation error message to user
   */
  private showValidationError(message: string): void {
    // Create or update error message display
    let errorContainer = document.getElementById('processing-validation-error');
    
    if (!errorContainer) {
      errorContainer = this.createElement('div', 'processing-validation-error');
      errorContainer.id = 'processing-validation-error';
      errorContainer.style.cssText = `
        margin-top: var(--settings-spacing-md);
        padding: var(--settings-spacing-md);
        background: #fee2e2;
        color: #dc2626;
        border: 1px solid #fecaca;
        border-radius: var(--settings-radius-md);
        font-size: 0.875rem;
        line-height: 1.4;
      `;
      
      // Insert after the warning container
      const warningContainer = document.getElementById('processing-mode-warning');
      if (warningContainer && warningContainer.parentNode) {
        warningContainer.parentNode.insertBefore(errorContainer, warningContainer.nextSibling);
      }
    }
    
    errorContainer.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="font-size: 16px;">ℹ️</span>
        <span>${message}</span>
      </div>
    `;
    
    // Auto-hide after 10 seconds
    setTimeout(() => {
      if (errorContainer && errorContainer.parentNode) {
        errorContainer.parentNode.removeChild(errorContainer);
      }
    }, 10000);
  }
}