// Quick Translate Panel Integration
// Initialize Quick Translate Panel functionality directly
import { getModifierKeyName } from '../../utils/platformUtils-renderer.js';

let quickTranslatePanelInstance: any = null;

export function initializeQuickTranslatePanel(): void {
    if (quickTranslatePanelInstance) return;

    console.log('⚡ Initializing quick translate panel');

    // Initialize the panel functionality directly without importing the class
    const providerSelect = document.getElementById('quick-translate-provider') as HTMLSelectElement;
    const targetLangSelect = document.getElementById('quick-translate-target-lang') as HTMLSelectElement;
    const inputTextarea = document.getElementById('quick-translate-input') as HTMLTextAreaElement;
    const translateBtn = document.getElementById('quick-translate-btn') as HTMLButtonElement;
    const translateBtnText = document.getElementById('quick-translate-btn-text') as HTMLSpanElement;
    const translateSpinner = document.getElementById('quick-translate-spinner') as HTMLDivElement;
    const clearBtn = document.getElementById('quick-translate-clear-btn') as HTMLButtonElement;
    const copyBtn = document.getElementById('quick-translate-copy-btn') as HTMLButtonElement;
    const outputTextarea = document.getElementById('quick-translate-output') as HTMLTextAreaElement;
    const infoDiv = document.getElementById('quick-translate-info') as HTMLDivElement;
    const cacheSizeSpan = document.getElementById('quick-translate-cache-size') as HTMLSpanElement;
    const clearCacheBtn = document.getElementById('quick-translate-clear-cache-btn') as HTMLButtonElement;

    // Hotkey elements
    const hotkeyToggle = document.getElementById('quick-translate-hotkey-toggle') as HTMLDivElement;
    const hotkeySwitch = document.getElementById('quick-translate-hotkey-switch') as HTMLDivElement;
    const hotkeyInfoBtn = document.getElementById('quick-translate-hotkey-info-btn') as HTMLButtonElement;
    const hotkeyDropdown = document.getElementById('quick-translate-hotkey-dropdown') as HTMLDivElement;

    // Auto-translate toggle elements
    const autoTranslateToggle = document.getElementById('quick-translate-auto-toggle') as HTMLDivElement;
    const autoTranslateSwitch = document.getElementById('quick-translate-auto-switch') as HTMLDivElement;
    const autoTranslateInfo = document.getElementById('quick-translate-auto-info') as HTMLSpanElement;

    let isTranslating = false;
    let hotkeyEnabled = false;
    let autoTranslateEnabled = true; // Default to enabled
    let debounceTimer: NodeJS.Timeout | null = null;
    const DEBOUNCE_DELAY = 800; // milliseconds to wait after user stops typing

    // Update info function
    function updateInfo(message: string): void {
        if (infoDiv) {
            infoDiv.textContent = message;
        }
    }

    // Update cache size function
    async function updateCacheSize(): Promise<void> {
        try {
            const result = await (window as any).electronAPI.invoke('quick-translate:get-cache-size');
            const size = result.size || 0;
            if (cacheSizeSpan) {
                cacheSizeSpan.textContent = `${size} cached translation${size !== 1 ? 's' : ''}`;
            }
        } catch (error) {
            console.error('Failed to get cache size:', error);
            if (cacheSizeSpan) {
                cacheSizeSpan.textContent = '0 cached translations';
            }
        }
    }

    // Set translating state function
    function setTranslating(translating: boolean): void {
        isTranslating = translating;

        if (translateBtn) {
            translateBtn.disabled = translating;
        }

        if (translateBtnText) {
            translateBtnText.textContent = translating ? 'Translating...' : 'Translate';
        }

        if (translateSpinner) {
            translateSpinner.style.display = translating ? 'inline-block' : 'none';
        }
    }

    // Update translate button state
    function updateTranslateButton(): void {
        if (!translateBtn || !inputTextarea) return;

        const hasText = inputTextarea.value.trim().length > 0;
        translateBtn.disabled = !hasText || isTranslating;
    }

  // Handle translation
  async function handleTranslate(): Promise<void> {
    if (isTranslating || !inputTextarea || !outputTextarea) return;

    const text = inputTextarea.value.trim();
    if (!text) {
        updateInfo('Please enter text to translate');
        return;
    }

    setTranslating(true);
    updateInfo('Translating...');

    try {
        // Determine provider: check UI selection first, then main config
        let provider: 'openai' | 'deepinfra' | 'argos-translate' = 'openai';
        
        if (providerSelect?.value) {
            provider = providerSelect.value as 'openai' | 'deepinfra' | 'argos-translate';
        } else {
            // Check main config for translation provider
            try {
                const configResponse = await (window as any).electronAPI.invoke('config:get', {
                    id: Date.now().toString(),
                    timestamp: Date.now(),
                    payload: null
                });
                if (configResponse.success && configResponse.payload) {
                    const config = configResponse.payload;
                    
                    // Use unified modelConfig (with fallback to cloudModelConfig for backward compatibility)
                    const modelConfig = config.modelConfig || config.cloudModelConfig;
                    const gptModel = modelConfig?.gptModel;
                    
                    if (gptModel === 'argos') {
                        provider = 'argos-translate';
                        console.log('[QuickTranslate] Using Argos Translate from config');
                    } else if (gptModel === 'deepinfra') {
                        provider = 'deepinfra';
                        console.log('[QuickTranslate] Using DeepInfra from config');
                    } else {
                        provider = 'openai';
                        console.log('[QuickTranslate] Using OpenAI from config');
                    }
                }
            } catch (configError) {
                console.warn('[QuickTranslate] Failed to get config, defaulting to openai:', configError);
            }
        }

        // Get source language - always use 'auto' for cloud providers
        // For Argos, use 'auto' as well (it will be handled by the service)
        const sourceLanguage = 'auto';

        const options = {
            to: targetLangSelect?.value || 'en',
            from: sourceLanguage,
            provider: provider
        };

        console.log(`[QuickTranslate] Translation options:`, options);

        const result = await (window as any).electronAPI.invoke('quick-translate:translate', { text, options });

        if (result.success && result.translatedText) {
            outputTextarea.value = result.translatedText;
            if (copyBtn) copyBtn.disabled = false;

            const cacheInfo = result.cached ? ' (cached)' : '';
            const providerInfo = ` via ${result.provider}`;
            updateInfo(`Translation completed${providerInfo}${cacheInfo}`);
        } else {
            outputTextarea.value = '';
            if (copyBtn) copyBtn.disabled = true;
            updateInfo(`Translation failed: ${result.error || 'Unknown error'}`);
        }
    } catch (error: any) {
        outputTextarea.value = '';
        if (copyBtn) copyBtn.disabled = true;
        updateInfo(`Error: ${error.message}`);
    } finally {
        setTranslating(false);
        updateCacheSize();
    }
}

    // Clear inputs function
    function clearInputs(): void {
        if (inputTextarea) {
            inputTextarea.value = '';
        }
        if (outputTextarea) {
            outputTextarea.value = '';
        }
        if (copyBtn) {
            copyBtn.disabled = true;
        }
        updateInfo('Ready to translate');
        updateTranslateButton();
    }

    // Copy result function
    async function copyResult(): Promise<void> {
        if (!outputTextarea || !outputTextarea.value) return;

        try {
            await navigator.clipboard.writeText(outputTextarea.value);
            updateInfo('Translation copied to clipboard');
        } catch (error) {
            // Fallback for older browsers
            outputTextarea.select();
            document.execCommand('copy');
            updateInfo('Translation copied to clipboard');
        }
    }

    // Clear cache function
    async function clearCache(): Promise<void> {
        try {
            await (window as any).electronAPI.invoke('quick-translate:clear-cache');
            updateCacheSize();
            updateInfo('Translation cache cleared');
        } catch (error: any) {
            updateInfo(`Failed to clear cache: ${error.message}`);
        }
    }

    // Setup event listeners
    if (providerSelect) {
        providerSelect.addEventListener('change', async () => {
            const provider = providerSelect.value as 'openai' | 'deepinfra' | 'argos-translate';
            updateInfo(`Provider changed to ${provider}`);

            // Restart Argos if Argos is selected
            if (provider === 'argos-translate') {
                try {
                    console.log(`🌐 Restarting Argos service for Quick Translate provider change`);
                    const restartResult = await (window as any).electronAPI.invoke('argos:restart', {
                        id: Date.now().toString(),
                        timestamp: Date.now(),
                        payload: null
                    });
                    
                    if (restartResult?.success) {
                        console.log('✅ Argos restarted successfully for provider change');
                        // Small delay to ensure Argos is fully ready
                        await new Promise(resolve => setTimeout(resolve, 500));
                    } else {
                        console.warn('⚠️ Argos restart returned unsuccessful:', restartResult?.error);
                    }
                } catch (error) {
                    console.error('❌ Failed to restart Argos service on provider change:', error);
                    // Don't throw - allow translation to proceed, it will fallback if needed
                }
            }

            // Re-translate if there's text
            if (inputTextarea && inputTextarea.value.trim().length > 0) {
                // Clear debounce timer and translate immediately
                if (debounceTimer) {
                    clearTimeout(debounceTimer);
                }
                handleTranslate();
            }
        });
    } else {
        // No provider select in UI, use default behavior
    }

    // Function to check if Argos is selected (from UI or config)
    async function isArgosSelected(): Promise<boolean> {
        // Check provider from UI select first, if it exists
        if (providerSelect?.value) {
            return providerSelect.value === 'argos-translate';
        }
        
        // No provider select in UI, check config
        try {
            const configResponse = await (window as any).electronAPI.invoke('config:get', {
                id: Date.now().toString(),
                timestamp: Date.now(),
                payload: null
            });
            if (configResponse.success && configResponse.payload) {
                const config = configResponse.payload;
                const processingMode = config.processingConfig?.mode 
                    || config.processingMode 
                    || (config.localModelConfig?.gptModel === 'argos' ? 'local' : 'cloud')
                    || 'cloud';
                
                const localProvider = config.localModelConfig?.gptModel;
                
                if (localProvider === 'argos') {
                    return true;
                } else {
                    const modelConfig = processingMode === 'local'
                        ? config.localModelConfig
                        : config.cloudModelConfig;
                    const mainProvider = modelConfig?.gptModel;
                    
                    return processingMode === 'local' && mainProvider === 'argos';
                }
            }
        } catch (error) {
            console.warn('[QuickTranslate] Failed to check config for Argos:', error);
        }
        
        return false;
    }

    // Function to restart Argos when language changes
    async function restartArgosIfNeeded(reason: string): Promise<void> {
        const isArgos = await isArgosSelected();
        
        if (isArgos) {
            try {
                console.log(`🌐 Restarting Argos service: ${reason}`);
                const restartResult = await (window as any).electronAPI.invoke('argos:restart', {
                    id: Date.now().toString(),
                    timestamp: Date.now(),
                    payload: null
                });
                
                if (restartResult?.success) {
                    console.log('✅ Argos restarted successfully');
                    // Small delay to ensure Argos is fully ready
                    await new Promise(resolve => setTimeout(resolve, 500));
                } else {
                    console.warn('⚠️ Argos restart returned unsuccessful:', restartResult?.error);
                }
            } catch (error) {
                console.error('❌ Failed to restart Argos service:', error);
                // Don't throw - allow translation to proceed, it will fallback if needed
            }
        }
    }

    // Re-translate when target language changes
    if (targetLangSelect) {
        targetLangSelect.addEventListener('change', async () => {
            const newLanguage = targetLangSelect.value;
            
            // Restart Argos if needed
            await restartArgosIfNeeded(`Quick Translate target language change: ${newLanguage}`);
            
            // Re-translate if there's text
            if (inputTextarea && inputTextarea.value.trim().length > 0) {
                // Clear debounce timer and translate immediately
                if (debounceTimer) {
                    clearTimeout(debounceTimer);
                }
                handleTranslate();
            }
        });
    }

    if (translateBtn) {
        translateBtn.addEventListener('click', handleTranslate);
    }

    if (clearBtn) {
        clearBtn.addEventListener('click', clearInputs);
    }

    if (copyBtn) {
        copyBtn.addEventListener('click', copyResult);
    }

    if (clearCacheBtn) {
        clearCacheBtn.addEventListener('click', clearCache);
    }

    // Show hotkey dropdown on hover
    if (hotkeyInfoBtn && hotkeyDropdown) {
        hotkeyInfoBtn.addEventListener('mouseenter', () => {
            hotkeyDropdown.style.display = 'block';
        });

        hotkeyInfoBtn.addEventListener('mouseleave', () => {
            hotkeyDropdown.style.display = 'none';
        });

        // Keep dropdown visible when hovering over it
        hotkeyDropdown.addEventListener('mouseenter', () => {
            hotkeyDropdown.style.display = 'block';
        });

        hotkeyDropdown.addEventListener('mouseleave', () => {
            hotkeyDropdown.style.display = 'none';
        });
    }

    if (inputTextarea) {
        // Real-time translation with debouncing and word completion detection
        inputTextarea.addEventListener('input', (e: Event) => {
            updateTranslateButton();

            // Clear existing timer
            if (debounceTimer) {
                clearTimeout(debounceTimer);
            }

            const text = inputTextarea.value.trim();
            if (text.length > 0) {
                // Only auto-translate if the toggle is enabled
                if (autoTranslateEnabled) {
                    // Check if the last character is a word boundary (space, punctuation)
                    const lastChar = inputTextarea.value[inputTextarea.value.length - 1];
                    const isWordBoundary = /[\s,.!?;:]/.test(lastChar);

                    // If word is complete (ended with space/punctuation), translate immediately
                    if (isWordBoundary && text.length > 0) {
                        updateInfo('Translating word...');
                        handleTranslate();
                    } else {
                        // Otherwise, show "typing..." and wait for debounce
                        updateInfo('Typing...');

                        // Set new timer to trigger translation after user stops typing
                        debounceTimer = setTimeout(() => {
                            handleTranslate();
                        }, DEBOUNCE_DELAY);
                    }
                } else {
                    // Auto-translate is off, just update the ready state
                    updateInfo('Ready to translate');
                }
            } else {
                // Clear output if input is empty
                if (outputTextarea) {
                    outputTextarea.value = '';
                }
                if (copyBtn) {
                    copyBtn.disabled = true;
                }
                updateInfo('Ready to translate');
            }
        });

        // Allow Enter+Ctrl to trigger translation immediately
        inputTextarea.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'Enter') {
                e.preventDefault();
                // Clear debounce timer and translate immediately
                if (debounceTimer) {
                    clearTimeout(debounceTimer);
                }
                handleTranslate();
            }
        });
    }

    // Auto-translate toggle functionality
    function updateAutoTranslateToggle(enabled: boolean): void {
        autoTranslateEnabled = enabled;
        if (autoTranslateSwitch) {
            autoTranslateSwitch.classList.toggle('active', enabled);
        }
        if (autoTranslateInfo) {
            autoTranslateInfo.textContent = enabled
                ? 'Translates as you type'
                : 'Click Translate or press Ctrl+Enter';
        }
        updateInfo(enabled ? 'Auto-translate enabled' : 'Auto-translate disabled - Click Translate to translate');
    }

    if (autoTranslateToggle) {
        autoTranslateToggle.addEventListener('click', () => {
            updateAutoTranslateToggle(!autoTranslateEnabled);
        });
    }

    // Hotkey toggle functionality
    function updateHotkeyToggle(enabled: boolean): void {
        hotkeyEnabled = enabled;
        if (hotkeySwitch) {
            hotkeySwitch.classList.toggle('active', enabled);
        }
    }

    async function toggleHotkey(): Promise<void> {
        try {
            if (hotkeyEnabled) {
                await (window as any).electronAPI.invoke('quick-translate-hotkey:disable');
                updateHotkeyToggle(false);
                updateInfo('Global hotkey disabled');
            } else {
                await (window as any).electronAPI.invoke('quick-translate-hotkey:enable');
                updateHotkeyToggle(true);
                const modifierKey = getModifierKeyName();
                updateInfo(`Global hotkey enabled - Press ${modifierKey}+C to translate selected text`);
            }
        } catch (error: any) {
            updateInfo(`Failed to toggle hotkey: ${error.message}`);
        }
    }

    async function updateHotkeyConfig(): Promise<void> {
        try {
            // Determine the effective provider (from UI or main config)
            let effectiveProvider: 'openai' | 'deepinfra' | 'argos-translate' = 'openai';
            
            if (providerSelect?.value) {
                effectiveProvider = providerSelect.value as 'openai' | 'deepinfra' | 'argos-translate';
            } else {
                // Check main config if UI selector doesn't have a value
                try {
                    const configResponse = await (window as any).electronAPI.invoke('config:get', {
                        id: Date.now().toString(),
                        timestamp: Date.now(),
                        payload: null
                    });
                    if (configResponse.success && configResponse.payload) {
                        const config = configResponse.payload;
                        const localProvider = config.localModelConfig?.gptModel;
                        if (localProvider === 'argos') {
                            effectiveProvider = 'argos-translate';
                        }
                    }
                } catch (configError) {
                    console.warn('[QuickTranslate] Failed to get config for updateHotkeyConfig:', configError);
                }
            }
            
            const config: any = {
                targetLanguage: targetLangSelect?.value || 'en',
                provider: effectiveProvider
            };
            
            // Source language is always auto-detected for quick translate
            // No need to save source language preference

            await (window as any).electronAPI.invoke('quick-translate-hotkey:update-config', { config });
            updateInfo('Hotkey settings updated');
        } catch (error: any) {
            updateInfo(`Failed to update hotkey settings: ${error.message}`);
        }
    }

    async function loadHotkeyConfig(): Promise<void> {
        try {
            const result = await (window as any).electronAPI.invoke('quick-translate-hotkey:get-config');
            if (result.config) {
                updateHotkeyToggle(result.config.enabled);
                
                // Load target language and provider from saved config
                if (targetLangSelect && result.config.targetLanguage) {
                    targetLangSelect.value = result.config.targetLanguage;
                }
                if (providerSelect && result.config.provider) {
                    providerSelect.value = result.config.provider;
                }
                // Source language is always auto-detected, no need to load it
            }

            const enabledResult = await (window as any).electronAPI.invoke('quick-translate-hotkey:is-enabled');
            updateHotkeyToggle(enabledResult.enabled);
        } catch (error) {
            console.error('Failed to load hotkey config:', error);
        }
    }


    // Hotkey event listeners
    if (hotkeyToggle) {
        hotkeyToggle.addEventListener('click', toggleHotkey);
    }

    // Update hotkey config when main settings change
    if (targetLangSelect) {
        targetLangSelect.addEventListener('change', updateHotkeyConfig);
    }

    if (providerSelect) {
        providerSelect.addEventListener('change', updateHotkeyConfig);
    }


    // Listen for hotkey results
    (window as any).electronAPI.onQuickTranslateHotkeyResult((data: any) => {
        if (inputTextarea && outputTextarea) {
            inputTextarea.value = data.originalText;
            outputTextarea.value = data.translatedText;
            if (copyBtn) copyBtn.disabled = false;
            updateInfo(`Hotkey translation completed at ${new Date(data.timestamp).toLocaleTimeString()}`);
        }
    });

    // Initialize
    updateCacheSize();
    updateTranslateButton();
    loadHotkeyConfig();
    quickTranslatePanelInstance = true; // Mark as initialized
}