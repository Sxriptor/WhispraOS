/**
 * Models tab implementation
 * Manages AI model selection and configuration for speech recognition, translation, and TTS
 */

import { BaseSettingsTab } from '../interfaces/SettingsTab.js';

// Define model configuration interfaces
interface ModelConfig {
    whisperModel: string;
    gptModel: string;
    voiceModel: string;
    modelParameters: ModelParameters;
}

interface ModelParameters {
    temperature: number;
    maxTokens: number;
    stability: number;
    similarityBoost: number;
    speed: number;
}

export class ModelsTab extends BaseSettingsTab {
    public readonly id = 'models';
    public readonly title = 'Models';
    public readonly icon = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M7 7h.01"/><path d="M17 7h.01"/><path d="M7 17h.01"/><path d="M17 17h.01"/></svg>';
    public readonly order = 2;

    private modelConfig: ModelConfig = {
        whisperModel: 'whisper-1',
        gptModel: 'openai',
        voiceModel: 'elevenlabs',
        modelParameters: {
            temperature: 0.7,
            maxTokens: 150,
            stability: 0.5,
            similarityBoost: 0.5,
            speed: 1.0
        }
    };

    private currentLanguage: string = 'en';

    // Available model options - all models in single dropdown
    private whisperModels = [
        { id: 'whisper-1', name: 'Whisper v1 (Cloud)', description: 'Latest OpenAI Whisper model with improved accuracy (requires API key)', isLocal: false },
        { id: 'tiny', name: 'Faster Whisper Tiny (Local)', description: 'Fastest, smallest model (~75MB) - good for real-time processing', isLocal: true, size: '75MB' },
        { id: 'small', name: 'Faster Whisper Small (Local)', description: 'Small model (~244MB) - good balance of speed and accuracy', isLocal: true, size: '244MB' },
        { id: 'medium', name: 'Faster Whisper Medium (Local)', description: 'Medium model (~769MB) - better accuracy, slower processing', isLocal: true, size: '769MB' },
        { id: 'large', name: 'Faster Whisper Large (Local)', description: 'Large model (~1550MB) - highest accuracy, slowest processing', isLocal: true, size: '1550MB' },
        { id: 'deepinfra', name: 'DeepInfra (Cloud)', description: 'DeepInfra API for cloud-based speech recognition', isLocal: false }
    ];

    // Track which models are downloaded
    private downloadedWhisperModels: string[] = [];

    private translationModels = [
        { id: 'openai', name: 'OpenAI GPT (Cloud)', description: 'OpenAI GPT models for translation (requires API key)', isLocal: false },
        { id: 'argos', name: 'Argos Translate (Local)', description: 'Local neural machine translation model', isLocal: true },
        { id: 'deepinfra', name: 'DeepInfra (Cloud)', description: 'DeepInfra API for cloud-based translation', isLocal: false }
    ];

    private voiceModels = [
        { id: 'elevenlabs', name: 'ElevenLabs', description: 'ElevenLabs voice synthesis (requires API key)', isLocal: false }
    ];

    private localModelsInstalled = {
        whisper: false,
        argos: false
    };

    // Translation strings for different languages
    private translations = {
        'en': {
            sections: {
                whisper: 'Speech Recognition Model',
                whisperDesc: 'Configure the AI model used for converting speech to text',
                gpt: 'Translation Model',
                gptDesc: 'Configure the AI model used for text translation',
                voice: 'Voice Synthesis Model',
                voiceDesc: 'Configure voice settings for text-to-speech output',
                parameters: 'Model Parameters',
                parametersDesc: 'Fine-tune model behavior and output quality'
            },
            fields: {
                whisperModel: 'Whisper Model:',
                gptModel: 'Translation Model:',
                voiceModel: 'Voice Model:',
                temperature: 'Temperature:',
                temperatureHelp: 'Controls randomness in translation (0.0-2.0). Lower = more consistent, Higher = more creative',
                maxTokens: 'Max Tokens:',
                maxTokensHelp: 'Maximum length of translation output (50-500)',
                stability: 'Voice Stability:',
                stabilityHelp: 'Controls voice consistency (0.0-1.0). Higher = more stable voice',
                similarityBoost: 'Similarity Boost:',
                similarityBoostHelp: 'Enhances voice similarity to original (0.0-1.0)',
                speed: 'Speech Speed:',
                speedHelp: 'Controls speech playback speed (0.25-4.0). 1.0 = normal speed'
            },
            buttons: {
                testVoice: 'Test Voice',
                resetDefaults: 'Reset to Defaults'
            },
            messages: {
                testingVoice: 'Testing voice...',
                voiceTestComplete: 'Voice test complete',
                voiceTestFailed: 'Voice test failed',
                resetConfirm: 'Reset all model settings to defaults?',
                resetComplete: 'Model settings reset to defaults'
            }
        },
        'es': {
            sections: {
                whisper: 'Modelo de Reconocimiento de Voz',
                whisperDesc: 'Configura el modelo de IA usado para convertir voz a texto',
                gpt: 'Modelo de Traducción',
                gptDesc: 'Configura el modelo de IA usado para traducción de texto',
                voice: 'Modelo de Síntesis de Voz',
                voiceDesc: 'Configura ajustes de voz para salida de texto a voz',
                parameters: 'Parámetros del Modelo',
                parametersDesc: 'Ajusta el comportamiento del modelo y calidad de salida'
            },
            fields: {
                whisperModel: 'Modelo Whisper:',
                gptModel: 'Modelo de Traducción:',
                voiceModel: 'Modelo de Voz:',
                temperature: 'Temperatura:',
                temperatureHelp: 'Controla aleatoriedad en traducción (0.0-2.0). Menor = más consistente, Mayor = más creativo',
                maxTokens: 'Tokens Máximos:',
                maxTokensHelp: 'Longitud máxima de salida de traducción (50-500)',
                stability: 'Estabilidad de Voz:',
                stabilityHelp: 'Controla consistencia de voz (0.0-1.0). Mayor = voz más estable',
                similarityBoost: 'Impulso de Similitud:',
                similarityBoostHelp: 'Mejora similitud de voz al original (0.0-1.0)',
                speed: 'Velocidad de Habla:',
                speedHelp: 'Controla velocidad de reproducción (0.25-4.0). 1.0 = velocidad normal'
            },
            buttons: {
                testVoice: 'Probar Voz',
                resetDefaults: 'Restablecer Predeterminados'
            },
            messages: {
                testingVoice: 'Probando voz...',
                voiceTestComplete: 'Prueba de voz completa',
                voiceTestFailed: 'Prueba de voz falló',
                resetConfirm: '¿Restablecer todos los ajustes del modelo a predeterminados?',
                resetComplete: 'Ajustes del modelo restablecidos a predeterminados'
            }
        }
    };

    constructor() {
        super();
        this.loadCurrentLanguage();
        this.setupEventListeners();
    }

    /**
     * Setup event listeners for model downloads
     */
    private setupEventListeners(): void {
        // Listen for local model downloads from the LocalModalOverlay
        window.addEventListener('local-model-downloaded', ((event: CustomEvent) => {
            const { modelKey, modelType } = event.detail;
            console.log(`Local model downloaded: ${modelKey} (${modelType})`);
            
            // Refresh the models list
            if (modelType === 'whisper' || modelKey === 'whisper') {
                this.loadDownloadedWhisperModels().then(() => {
                    // Update the dropdown immediately
                    this.refreshWhisperDropdown();
                    
                    // Update the download button if we're viewing that model
                    if (this.container && this.modelConfig.whisperModel === modelKey) {
                        const section = this.container.querySelector('.settings-form-group');
                        if (section) {
                            this.updateWhisperDownloadButton(modelKey, section as HTMLElement);
                        }
                    }
                });
            } else if (modelType === 'argos' || modelKey === 'argos' || modelKey === 'argos-extra') {
                this.checkLocalModelsInstalled().then(() => {
                    // Update the UI if we're currently viewing the models tab
                    if (this.container) {
                        this.renderContent(this.container);
                    }
                });
            }
        }) as EventListener);
    }

    /**
     * Load current language from global state
     */
    private loadCurrentLanguage(): void {
        this.currentLanguage = (window as any).currentLanguage || 'en';
    }

    /**
     * Get translations for current language
     */
    private getTranslations(): any {
        return this.translations[this.currentLanguage as keyof typeof this.translations] || this.translations['en'];
    }

    /**
     * Render the Models tab content
     */
    public render(): HTMLElement {
        const container = this.createElement('div', 'models-tab');

        // Load model configuration and check local models when rendering
        Promise.all([
            this.loadModelConfig(),
            this.checkLocalModelsInstalled()
        ]).then(() => {
            this.renderContent(container);
        });

        return container;
    }

    /**
     * Check if local models are installed and get available Whisper models
     */
    private async checkLocalModelsInstalled(): Promise<void> {
        try {
            const response = await (window as any).electronAPI.invoke('local-models:check-installations', {
                id: Date.now().toString(),
                timestamp: Date.now(),
                payload: {}
            });

            if (response.success && response.payload) {
                this.localModelsInstalled.whisper = response.payload.whisper || false;
                this.localModelsInstalled.argos = response.payload.argos || false;
                console.log('Local models installation status:', this.localModelsInstalled);

                // If Whisper is installed, get the list of downloaded models
                if (this.localModelsInstalled.whisper) {
                    await this.loadDownloadedWhisperModels();
                }
            }
        } catch (error) {
            console.error('Error checking local models installation:', error);
        }
    }

    /**
     * Load downloaded Whisper models from the system
     */
    private async loadDownloadedWhisperModels(): Promise<void> {
        try {
            const response = await (window as any).electronAPI.invoke('whisper:get-available-models', {
                id: Date.now().toString(),
                timestamp: Date.now(),
                payload: {}
            });

            if (response.success && response.payload && Array.isArray(response.payload)) {
                this.downloadedWhisperModels = response.payload;
                console.log('Downloaded Whisper models:', this.downloadedWhisperModels);
            }
        } catch (error) {
            console.error('Error loading downloaded Whisper models:', error);
        }
    }

    /**
     * Open the local models downloader
     */
    private async openLocalModelsDownloader(): Promise<void> {
        try {
            // Dynamically import LocalModalOverlay
            const { LocalModalOverlay } = await import('../../LocalModalOverlay.js');
            const overlay = new LocalModalOverlay();
            overlay.show(() => {
                // Refresh installation status and available models after closing
                this.checkLocalModelsInstalled().then(() => {
                    if (this.container) {
                        this.renderContent(this.container);
                    }
                });
            });
        } catch (error) {
            console.error('Failed to load LocalModalOverlay:', error);
        }
    }

    /**
     * Load model configuration from storage
     */
    private async loadModelConfig(): Promise<void> {
        try {
            const response = await (window as any).electronAPI.invoke('config:get', {
                id: Date.now().toString(),
                timestamp: Date.now(),
                payload: null
            });

            if (response.success && response.payload) {
                const config = response.payload;

                // Load unified model configuration (prefer cloudModelConfig for backward compatibility)
                if (config.modelConfig) {
                    this.modelConfig = {
                        whisperModel: config.modelConfig.whisperModel || 'whisper-1',
                        gptModel: config.modelConfig.gptModel || 'openai',
                        voiceModel: config.modelConfig.voiceModel || 'elevenlabs',
                        modelParameters: {
                            temperature: config.modelConfig.modelParameters?.temperature || 0.7,
                            maxTokens: config.modelConfig.modelParameters?.maxTokens || 150,
                            stability: config.modelConfig.modelParameters?.stability || 0.5,
                            similarityBoost: config.modelConfig.modelParameters?.similarityBoost || 0.5,
                            speed: config.modelConfig.modelParameters?.speed || 1.0
                        }
                    };
                } else if (config.cloudModelConfig) {
                    // Fallback to cloudModelConfig for backward compatibility
                    this.modelConfig = {
                        whisperModel: config.cloudModelConfig.whisperModel || 'whisper-1',
                        gptModel: config.cloudModelConfig.gptModel || 'openai',
                        voiceModel: config.cloudModelConfig.voiceModel || 'elevenlabs',
                        modelParameters: {
                            temperature: config.cloudModelConfig.modelParameters?.temperature || 0.7,
                            maxTokens: config.cloudModelConfig.modelParameters?.maxTokens || 150,
                            stability: config.cloudModelConfig.modelParameters?.stability || 0.5,
                            similarityBoost: config.cloudModelConfig.modelParameters?.similarityBoost || 0.5,
                            speed: config.cloudModelConfig.modelParameters?.speed || 1.0
                        }
                    };
                } else {
                    // Legacy config fallback
                    this.modelConfig.whisperModel = config.whisperModel || this.getDefaultWhisperModel();
                    this.modelConfig.gptModel = config.gptModel || this.getDefaultTranslationModel();
                    this.modelConfig.voiceModel = config.voiceId || this.getDefaultVoiceModel();
                    if (config.modelParameters) {
                        this.modelConfig.modelParameters = {
                            temperature: config.modelParameters.temperature || 0.7,
                            maxTokens: config.modelParameters.maxTokens || 150,
                            stability: config.modelParameters.stability || 0.5,
                            similarityBoost: config.modelParameters.similarityBoost || 0.5,
                            speed: config.modelParameters.speed || 1.0
                        };
                    }
                }
            }
        } catch (error) {
            console.error('Error loading model configuration:', error);
            // Use defaults if loading fails
        }
    }

    /**
     * Get default whisper model
     */
    private getDefaultWhisperModel(): string {
        return this.whisperModels.length > 0 ? this.whisperModels[0].id : 'whisper-1';
    }

    /**
     * Get default translation model
     */
    private getDefaultTranslationModel(): string {
        return this.translationModels.length > 0 ? this.translationModels[0].id : 'openai';
    }

    /**
     * Get default voice model
     */
    private getDefaultVoiceModel(): string {
        // Prefer OpenAI Alloy voice as default (works with managed keys)
        const alloVoice = this.voiceModels.find(v => v.id === 'alloy');
        if (alloVoice) {
            return 'alloy';
        }
        
        // Fallback to first available voice
        return this.voiceModels.length > 0 ? this.voiceModels[0].id : 'alloy';
    }

    /**
     * Render the tab content
     */
    private renderContent(container: HTMLElement): void {
        const t = this.getTranslations();

        container.innerHTML = '';

        // Create header with download button
        const headerContainer = this.createElement('div');
        headerContainer.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: var(--settings-spacing-lg);
        `;

        const header = this.createElement('h2', 'settings-section-header');
        header.textContent = `AI Model Configuration`;
        header.style.margin = '0';
        headerContainer.appendChild(header);

        // Add "Download Local Models" button
        const downloadButton = this.createElement('button', 'settings-button settings-button-primary') as HTMLButtonElement;
        downloadButton.innerHTML = `
            <span style="margin-right: 8px;">📥</span>
            Download Local Models
        `;
        downloadButton.style.cssText = `
            background: #2563eb;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 6px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s;
            display: flex;
            align-items: center;
        `;
        downloadButton.addEventListener('click', () => this.openLocalModelsDownloader());
        downloadButton.addEventListener('mouseenter', () => {
            downloadButton.style.background = '#1d4ed8';
        });
        downloadButton.addEventListener('mouseleave', () => {
            downloadButton.style.background = '#2563eb';
        });
        headerContainer.appendChild(downloadButton);

        container.appendChild(headerContainer);

        // Create Whisper model section
        const whisperSection = this.createWhisperModelSection(t);
        container.appendChild(whisperSection);

        // Create Translation model section
        const translationSection = this.createTranslationModelSection(t);
        container.appendChild(translationSection);

        // Create voice model section
        const voiceSection = this.createVoiceModelSection(t);
        container.appendChild(voiceSection);

        // Create action buttons
        const actionsSection = this.createActionsSection(t);
        container.appendChild(actionsSection);
    }



    /**
     * Create Whisper model selection section
     */
    private createWhisperModelSection(t: any): HTMLElement {
        const section = this.createElement('div', 'settings-form-group');

        const title = this.createElement('h3', 'settings-section-header');
        title.textContent = `🎤 ${t.sections.whisper}`;
        section.appendChild(title);

        const description = this.createElement('p', 'settings-section-description');
        description.textContent = t.sections.whisperDesc;
        section.appendChild(description);

        const label = this.createElement('label', 'settings-form-label');
        label.setAttribute('for', 'whisper-model-select');
        label.textContent = t.fields.whisperModel;
        section.appendChild(label);

        const select = this.createElement('select', 'settings-form-select') as HTMLSelectElement;
        select.id = 'whisper-model-select';

        // Show all models with download status
        this.whisperModels.forEach(model => {
            const option = this.createElement('option') as HTMLOptionElement;
            option.value = model.id;
            
            // Add download status indicator for local models
            let statusText = '';
            if (model.isLocal) {
                const isDownloaded = this.downloadedWhisperModels.includes(model.id);
                statusText = isDownloaded ? ' ✓' : ' (Not Downloaded)';
            }
            
            option.textContent = model.name + statusText;
            option.title = model.description;
            
            if (model.id === this.modelConfig.whisperModel) {
                option.selected = true;
            }
            select.appendChild(option);
        });

        select.addEventListener('change', async () => {
            this.modelConfig.whisperModel = select.value;
            this.updateWhisperModelDescription(select.value, section);
            this.updateWhisperDownloadButton(select.value, section);
            // Auto-save on change
            await this.onSave();
            // Refresh voices when model changes
            if ((window as any).loadVoices) {
                (window as any).loadVoices();
            }
            window.dispatchEvent(new CustomEvent('model-config-changed'));
        });

        section.appendChild(select);

        // Add download button container
        const downloadContainer = this.createElement('div');
        downloadContainer.id = 'whisper-download-container';
        downloadContainer.style.cssText = 'margin-top: 12px;';
        section.appendChild(downloadContainer);

        // Add description for selected model
        this.updateWhisperModelDescription(this.modelConfig.whisperModel, section);
        this.updateWhisperDownloadButton(this.modelConfig.whisperModel, section);

        return section;
    }

    /**
     * Refresh the Whisper dropdown to show updated download status
     */
    private refreshWhisperDropdown(): void {
        const select = document.getElementById('whisper-model-select') as HTMLSelectElement;
        if (!select) return;

        const currentValue = select.value;
        
        // Clear and rebuild options
        select.innerHTML = '';
        
        this.whisperModels.forEach(model => {
            const option = this.createElement('option') as HTMLOptionElement;
            option.value = model.id;
            
            // Add download status indicator for local models
            let statusText = '';
            if (model.isLocal) {
                const isDownloaded = this.downloadedWhisperModels.includes(model.id);
                statusText = isDownloaded ? ' ✓' : ' (Not Downloaded)';
            }
            
            option.textContent = model.name + statusText;
            option.title = model.description;
            
            if (model.id === currentValue) {
                option.selected = true;
            }
            select.appendChild(option);
        });
    }

    /**
     * Update Whisper model description
     */
    private updateWhisperModelDescription(modelId: string, section: HTMLElement): void {
        // Remove existing help text
        const existingHelp = section.querySelector('.settings-form-help');
        if (existingHelp) {
            existingHelp.remove();
        }

        const selectedModel = this.whisperModels.find(m => m.id === modelId);
        if (selectedModel) {
            const helpText = this.createElement('small', 'settings-form-help');
            helpText.textContent = selectedModel.description;
            section.appendChild(helpText);
        }
    }

    /**
     * Update Whisper download button visibility and state
     */
    private updateWhisperDownloadButton(modelId: string, section: HTMLElement): void {
        const container = section.querySelector('#whisper-download-container');
        if (!container) return;

        container.innerHTML = '';

        const selectedModel = this.whisperModels.find(m => m.id === modelId);
        if (!selectedModel || !selectedModel.isLocal) {
            return; // No download button for cloud models
        }

        const isDownloaded = this.downloadedWhisperModels.includes(modelId);
        
        if (isDownloaded) {
            // Show "Downloaded" status
            const statusDiv = this.createElement('div');
            statusDiv.style.cssText = 'color: #10b981; font-weight: 500; display: flex; align-items: center; gap: 8px;';
            statusDiv.innerHTML = `<span>✓</span><span>Model Downloaded</span>`;
            container.appendChild(statusDiv);
        } else {
            // Show download button
            const downloadButton = this.createElement('button', 'settings-button settings-button-primary') as HTMLButtonElement;
            downloadButton.id = `download-whisper-${modelId}`;
            downloadButton.innerHTML = `<span style="margin-right: 8px;">📥</span>Download Model (${(selectedModel as any).size || 'Unknown size'})`;
            downloadButton.style.cssText = `
                background: #2563eb;
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 6px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s;
            `;
            
            downloadButton.addEventListener('click', () => this.downloadWhisperModel(modelId));
            downloadButton.addEventListener('mouseenter', () => {
                downloadButton.style.background = '#1d4ed8';
            });
            downloadButton.addEventListener('mouseleave', () => {
                if (!downloadButton.disabled) {
                    downloadButton.style.background = '#2563eb';
                }
            });
            
            container.appendChild(downloadButton);
        }
    }

    /**
     * Download a specific Whisper model
     */
    private async downloadWhisperModel(modelId: string): Promise<void> {
        const button = document.querySelector(`#download-whisper-${modelId}`) as HTMLButtonElement;
        if (!button) return;

        const originalText = button.innerHTML;
        
        try {
            button.disabled = true;
            button.innerHTML = '<span style="margin-right: 8px;">⏳</span>Downloading...';
            button.style.background = '#9ca3af';
            button.style.cursor = 'wait';

            // Listen for progress updates
            const progressHandler = (_event: any, data: { modelId: string, message: string }) => {
                if (data.modelId === modelId) {
                    button.innerHTML = `<span style="margin-right: 8px;">⏳</span>${data.message}`;
                }
            };

            if ((window as any).electronAPI && (window as any).electronAPI.on) {
                (window as any).electronAPI.on('whisper:download-progress', progressHandler);
            }

            const response = await (window as any).electronAPI.invoke('whisper:download-model', {
                id: Date.now().toString(),
                timestamp: Date.now(),
                payload: { modelId }
            });

            // Remove progress listener
            if ((window as any).electronAPI && (window as any).electronAPI.removeListener) {
                (window as any).electronAPI.removeListener('whisper:download-progress', progressHandler);
            }

            if (response.success) {
                button.innerHTML = '<span style="margin-right: 8px;">✓</span>Downloaded!';
                button.style.background = '#10b981';
                
                // Refresh the downloaded models list
                await this.loadDownloadedWhisperModels();
                
                // Emit event for other components
                window.dispatchEvent(new CustomEvent('local-model-downloaded', { 
                    detail: { modelKey: modelId, modelType: 'whisper' }
                }));
                
                // Update the UI immediately
                if (this.container) {
                    // Refresh the dropdown options
                    this.refreshWhisperDropdown();
                    
                    // Update the download button
                    const section = this.container.querySelector('.settings-form-group');
                    if (section) {
                        this.updateWhisperDownloadButton(modelId, section as HTMLElement);
                    }
                }
            } else {
                throw new Error(response.error || 'Download failed');
            }
        } catch (error) {
            console.error('Error downloading Whisper model:', error);
            button.innerHTML = '<span style="margin-right: 8px;">❌</span>Download Failed';
            button.style.background = '#ef4444';
            
            setTimeout(() => {
                button.disabled = false;
                button.innerHTML = originalText;
                button.style.background = '#2563eb';
                button.style.cursor = 'pointer';
            }, 3000);
            
            alert(`Failed to download model: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Create Translation model selection section
     */
    private createTranslationModelSection(t: any): HTMLElement {
        const section = this.createElement('div', 'settings-form-group');

        const title = this.createElement('h3', 'settings-section-header');
        title.textContent = `🌐 ${t.sections.gpt}`;
        section.appendChild(title);

        const description = this.createElement('p', 'settings-section-description');
        description.textContent = t.sections.gptDesc;
        section.appendChild(description);

        const label = this.createElement('label', 'settings-form-label');
        label.setAttribute('for', 'translation-model-select');
        label.textContent = t.fields.gptModel;
        section.appendChild(label);

        const select = this.createElement('select', 'settings-form-select') as HTMLSelectElement;
        select.id = 'translation-model-select';

        this.translationModels.forEach(model => {
            const option = this.createElement('option') as HTMLOptionElement;
            option.value = model.id;
            
            // Check if local model is installed
            const isAvailable = !model.isLocal || this.localModelsInstalled.argos;
            const availabilityText = isAvailable ? '' : ' (Not Installed)';
            
            option.textContent = model.name + availabilityText;
            option.title = model.description;
            option.disabled = !isAvailable;
            
            if (model.id === this.modelConfig.gptModel) {
                option.selected = true;
            }
            select.appendChild(option);
        });

        select.addEventListener('change', async () => {
            this.modelConfig.gptModel = select.value;
            this.updateTranslationModelDescription(select.value, section);
            // Auto-save on change
            await this.onSave();
            // Refresh voices when model changes
            if ((window as any).loadVoices) {
                (window as any).loadVoices();
            }
            window.dispatchEvent(new CustomEvent('model-config-changed'));
        });

        section.appendChild(select);

        // Add description for selected model
        this.updateTranslationModelDescription(this.modelConfig.gptModel, section);

        return section;
    }

    /**
     * Update Translation model description
     */
    private updateTranslationModelDescription(modelId: string, section: HTMLElement): void {
        // Remove existing help text
        const existingHelp = section.querySelector('.settings-form-help');
        if (existingHelp) {
            existingHelp.remove();
        }

        const selectedModel = this.translationModels.find(m => m.id === modelId);
        if (selectedModel) {
            const helpText = this.createElement('small', 'settings-form-help');
            helpText.textContent = selectedModel.description;
            section.appendChild(helpText);
        }
    }

    /**
     * Create voice model selection section
     */
    private createVoiceModelSection(t: any): HTMLElement {
        const section = this.createElement('div', 'settings-form-group');

        const title = this.createElement('h3', 'settings-section-header');
        title.textContent = `🗣️ ${t.sections.voice}`;
        section.appendChild(title);

        const description = this.createElement('p', 'settings-section-description');
        description.textContent = t.sections.voiceDesc;
        section.appendChild(description);

        const label = this.createElement('label', 'settings-form-label');
        label.setAttribute('for', 'voice-model-select');
        label.textContent = t.fields.voiceModel;
        section.appendChild(label);

        const selectContainer = this.createElement('div');
        selectContainer.style.cssText = `
            display: flex;
            gap: var(--settings-spacing-sm);
            align-items: center;
        `;

        const select = this.createElement('select', 'settings-form-select') as HTMLSelectElement;
        select.id = 'voice-model-select';
        select.style.flex = '1';

        // Load voices
        this.loadVoices(select);

        select.addEventListener('change', async () => {
            this.modelConfig.voiceModel = select.value;
            this.updateVoiceModelDescription(select.value, section);
            // Auto-save on change
            await this.onSave();
            // Refresh voices in main app
            if ((window as any).loadVoices) {
                (window as any).loadVoices();
            }
            // Dispatch event for voice refresh
            window.dispatchEvent(new CustomEvent('model-config-changed'));
        });

        selectContainer.appendChild(select);

        // Add test voice button
        const testButton = this.createElement('button', 'settings-button settings-button-secondary') as HTMLButtonElement;
        testButton.textContent = t.buttons.testVoice;
        testButton.addEventListener('click', () => this.testVoice(t));
        selectContainer.appendChild(testButton);

        section.appendChild(selectContainer);

        // Add description for selected model
        this.updateVoiceModelDescription(this.modelConfig.voiceModel, section);

        return section;
    }

    /**
     * Load voices
     */
    private async loadVoices(select: HTMLSelectElement): Promise<void> {
        select.innerHTML = '';
        
        this.voiceModels.forEach(model => {
            const option = this.createElement('option') as HTMLOptionElement;
            option.value = model.id;
            option.textContent = model.name;
            option.title = model.description;
            if (model.id === this.modelConfig.voiceModel) {
                option.selected = true;
            }
            select.appendChild(option);
        });

        // Load additional voices from API
        try {
            const response = await (window as any).electronAPI.invoke('voice:get-voices', {
                id: Date.now().toString(),
                timestamp: Date.now(),
                payload: null
            });

            if (response.success && response.payload?.voices) {
                const voices = response.payload.voices;
                
                voices.forEach((voice: any) => {
                    const option = this.createElement('option') as HTMLOptionElement;
                    option.value = voice.id;
                    option.textContent = voice.name;
                    if (voice.id === this.modelConfig.voiceModel) {
                        option.selected = true;
                    }
                    select.appendChild(option);
                });
            }
        } catch (error) {
            console.error('Error loading voices:', error);
        }
    }



    /**
     * Update Voice model description
     */
    private updateVoiceModelDescription(modelId: string, section: HTMLElement): void {
        // Remove existing help text
        const existingHelp = section.querySelector('.settings-form-help');
        if (existingHelp) {
            existingHelp.remove();
        }

        const selectedModel = this.voiceModels.find(m => m.id === modelId);
        if (selectedModel) {
            const helpText = this.createElement('small', 'settings-form-help');
            helpText.textContent = selectedModel.description;
            section.appendChild(helpText);
        }
    }


    /**
     * Test voice with current settings
     */
    private async testVoice(t: any): Promise<void> {
        const testButton = document.querySelector('.models-tab button') as HTMLButtonElement;
        const originalText = testButton?.textContent || t.buttons.testVoice;

        try {
            if (testButton) {
                testButton.disabled = true;
                testButton.textContent = t.messages.testingVoice;
            }

            const response = await (window as any).electronAPI.invoke('tts:synthesize-only', {
                id: Date.now().toString(),
                timestamp: Date.now(),
                payload: {
                    text: 'This is a test of the voice synthesis with current model settings.',
                    voiceId: this.modelConfig.voiceModel,
                    modelId: undefined // Use default model
                }
            });

            if (response.success) {
                // Play the audio (implementation would depend on audio system)
                console.log('Voice test completed successfully');
                alert(t.messages.voiceTestComplete);
            } else {
                console.error('Voice test failed:', response.error);
                alert(t.messages.voiceTestFailed);
            }
        } catch (error) {
            console.error('Error testing voice:', error);
            alert(t.messages.voiceTestFailed);
        } finally {
            if (testButton) {
                testButton.disabled = false;
                testButton.textContent = originalText;
            }
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

        const resetButton = this.createElement('button', 'settings-button settings-button-secondary') as HTMLButtonElement;
        resetButton.textContent = t.buttons.resetDefaults;
        resetButton.addEventListener('click', () => this.resetToDefaults(t));

        section.appendChild(resetButton);

        return section;
    }

    /**
     * Reset all settings to defaults
     */
    private resetToDefaults(t: any): void {
        const confirmed = confirm(t.messages.resetConfirm);

        if (confirmed) {
            // Reset to default values
            this.modelConfig = {
                whisperModel: 'whisper-1',
                gptModel: 'openai',
                voiceModel: 'elevenlabs',
                modelParameters: {
                    temperature: 0.7,
                    maxTokens: 150,
                    stability: 0.5,
                    similarityBoost: 0.5,
                    speed: 1.0
                }
            };

            // Re-render the content
            if (this.container) {
                this.renderContent(this.container);
            }

            alert(t.messages.resetComplete);
        }
    }

    /**
     * Called when tab becomes active
     */
    public onActivate(): void {
        super.onActivate();
        // Reload configuration and check local models when tab becomes active
        Promise.all([
            this.loadModelConfig(),
            this.checkLocalModelsInstalled()
        ]).then(() => {
            if (this.container) {
                this.renderContent(this.container);
            }
        });
    }

    /**
     * Save model configuration
     */
    public async onSave(): Promise<boolean> {
        try {
            console.log('=== MODELS SAVE DEBUG ===');

            // Read current values from UI elements
            const whisperSelect = document.getElementById('whisper-model-select') as HTMLSelectElement;
            const translationSelect = document.getElementById('translation-model-select') as HTMLSelectElement;
            const voiceSelect = document.getElementById('voice-model-select') as HTMLSelectElement;

            // Update config from UI
            if (whisperSelect) {
                this.modelConfig.whisperModel = whisperSelect.value;
                console.log('Whisper model from UI:', whisperSelect.value);
            }
            if (translationSelect) {
                this.modelConfig.gptModel = translationSelect.value;
                console.log('Translation model from UI:', translationSelect.value);
            }
            if (voiceSelect) {
                this.modelConfig.voiceModel = voiceSelect.value;
                console.log('Voice model from UI:', voiceSelect.value);
            }

            console.log('Model config before save:', this.modelConfig);

            // Save unified model configuration
            const configUpdate = {
                modelConfig: {
                    whisperModel: this.modelConfig.whisperModel,
                    gptModel: this.modelConfig.gptModel,
                    voiceModel: this.modelConfig.voiceModel,
                    modelParameters: this.modelConfig.modelParameters
                }
            };

            console.log('Saving model config update:', configUpdate);

            const response = await (window as any).electronAPI.invoke('config:set', {
                id: Date.now().toString(),
                timestamp: Date.now(),
                payload: configUpdate
            });

            if (response.success) {
                console.log('Model configuration saved successfully');
                return true;
            } else {
                console.error('Failed to save model configuration');
                return false;
            }
        } catch (error) {
            console.error('Error saving model configuration:', error);
            return false;
        }
    }

    /**
     * Validate model configuration
     */
    public validate(): boolean {
        const errors = this.getValidationErrors();
        return errors.length === 0;
    }

    /**
     * Get validation errors
     */
    public getValidationErrors(): string[] {
        const errors: string[] = [];
        const params = this.modelConfig.modelParameters;

        // Validate temperature
        if (params.temperature < 0 || params.temperature > 2) {
            errors.push('Temperature must be between 0.0 and 2.0');
        }

        // Validate max tokens
        if (params.maxTokens < 50 || params.maxTokens > 500) {
            errors.push('Max tokens must be between 50 and 500');
        }

        // Validate stability
        if (params.stability < 0 || params.stability > 1) {
            errors.push('Voice stability must be between 0.0 and 1.0');
        }

        // Validate similarity boost
        if (params.similarityBoost < 0 || params.similarityBoost > 1) {
            errors.push('Similarity boost must be between 0.0 and 1.0');
        }

        // Validate speed
        if (params.speed < 0.25 || params.speed > 4.0) {
            errors.push('Speech speed must be between 0.25 and 4.0');
        }

        return errors;
    }
}