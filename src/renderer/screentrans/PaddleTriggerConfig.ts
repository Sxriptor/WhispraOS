import { ctx } from './shared.js';
import { getModifierKeyName } from '../../utils/platformUtils-renderer.js';

// Screen Translation Functions

// Loading overlay management - uses separate window like PTT overlay
async function showLoadingOverlay(message: string = 'Processing...'): Promise<void> {
    try {
        await (window as any).electronAPI.invoke('screen-translation-loading:show', message);
    } catch (error) {
        console.error('Failed to show loading overlay:', error);
    }
}

async function hideLoadingOverlay(): Promise<void> {
    try {
        await (window as any).electronAPI.invoke('screen-translation-loading:hide');
    } catch (error) {
        console.error('Failed to hide loading overlay:', error);
    }
}

async function updateLoadingMessage(message: string): Promise<void> {
    try {
        await (window as any).electronAPI.invoke('screen-translation-loading:update-message', message);
    } catch (error) {
        console.error('Failed to update loading message:', error);
    }
}

// Setup IPC listener for box processing start
if (typeof window !== 'undefined' && (window as any).electronAPI) {
    (window as any).electronAPI.on('screen-translation:box-processing-start', () => {
        showLoadingOverlay('Processing selected region...');
    });
    
    (window as any).electronAPI.on('screen-translation:box-processing-complete', () => {
        hideLoadingOverlay();
    });
}

export async function performScreenOCRDirect(sourceLanguage: string, displayId: string) {
    try {
        // Convert 'auto' to default language (Japanese for screen detection)
        const ocrLanguage = sourceLanguage === 'auto' ? 'ja' : sourceLanguage;
        console.log(`📺 Starting screen OCR for language: ${ocrLanguage} (from ${sourceLanguage})`);
        console.log(`📺 Display ID: ${displayId}`);

        // Step 1: Take screenshot
        console.log('📸 Taking screenshot...');

        const screenshotResult = await (window as any).electronAPI.invoke('paddle:take-screenshot', {
            displayId
        });

        console.log('📸 Screenshot result:', screenshotResult);

        if (!screenshotResult.success) {
            throw new Error(`Screenshot failed: ${screenshotResult.error}`);
        }

        console.log(`✅ Screenshot saved: ${screenshotResult.imagePath}`);

        // Step 2: Run OCR
        console.log(`🔍 Running OCR with language: ${ocrLanguage}...`);

        const ocrResult = await (window as any).electronAPI.invoke('paddle:run-ocr', {
            imagePath: screenshotResult.imagePath,
            language: ocrLanguage
        });

        console.log('🔍 OCR result:', ocrResult);

        if (!ocrResult.success) {
            throw new Error(`OCR failed: ${ocrResult.error}`);
        }

        console.log(`✅ OCR found ${ocrResult.total_boxes || ocrResult.text_boxes?.length || 0} text boxes`);

        // Step 3: Update overlay with OCR results (no translation)
        const textBoxes = ocrResult.text_boxes || [];

        try {
            await (window as any).electronAPI.invoke('screen-translation:update-overlay', {
                displayId,
                textBoxes: textBoxes.map((box: any) => ({
                    text: box.text,
                    translatedText: box.text, // Just show original text
                    x: box.x,
                    y: box.y,
                    width: box.width,
                    height: box.height,
                    confidence: box.confidence
                }))
            });
            console.log('✅ Overlay updated with OCR results');
        } catch (overlayError) {
            console.warn('⚠️ Failed to update overlay:', overlayError);
        }

        return {
            success: true,
            textBoxes,
            fullText: ocrResult.full_text || ''
        };

    } catch (error) {
        console.error('❌ Screen OCR failed:', error);
        return {
            success: false,
            textBoxes: [],
            fullText: '',
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}

export async function triggerScreenTranslation(): Promise<void> {
    try {
        // Check if continuous screen translation is already running
        ctx.logToDebug('📺 Checking screen translation status...');
        const statusResponse = await (window as any).electronAPI.invoke('screen-translation:get-status');

        // STATE 1: If overlay is open (continuous mode is active), close it
        if (statusResponse?.success && statusResponse.isActive) {
            ctx.logToDebug('📺 Screen translation overlay is open, closing it...');
            // Stop continuous screen translation and close overlay
            await (window as any).electronAPI.invoke('screen-translation:stop-system');

            // Update UI to ready state
            ctx.isScreenTranslationProcessing = false;
            updateScreenTranslationStatus('ready');
            ctx.logToDebug('📺 Screen translation overlay closed, UI updated to ready state');
            return;
        }

        // STATE 2: If processing is ongoing OR if we're already processing, cancel it IMMEDIATELY
        if (ctx.isScreenTranslationProcessing || statusResponse?.isProcessing) {
            ctx.logToDebug('📺 Processing is ongoing, cancelling IMMEDIATELY...');
            // Cancel the ongoing processing - this kills OCR processes immediately
            await (window as any).electronAPI.invoke('screen-translation:cancel-processing');

            // Update UI back to ready state IMMEDIATELY
            ctx.isScreenTranslationProcessing = false;
            updateScreenTranslationStatus('ready');
            ctx.logToDebug('📺 Processing cancelled, UI updated to ready state');
            return;
        }

        // STATE 3: Start new processing
        // Show loading overlay immediately
        await showLoadingOverlay('Starting screen translation...');

        // Check for PaddlePaddle before proceeding
        ctx.logToDebug('🏓 Checking PaddlePaddle requirements for screen translation...');
        await ctx.checkPaddlePaddleBeforeScreenTranslation();

        ctx.logToDebug('📺 Starting one-shot screen translation...');

        // Update loading message
        await updateLoadingMessage('Capturing screen...');

        // Show processing feedback
        ctx.isScreenTranslationProcessing = true;
        updateScreenTranslationStatus('processing');

        // Get settings from UI
        const targetLanguage = ctx.screenTranslationTargetLang?.value || 'en';
        const sourceLanguage = ctx.screenTranslationSourceLang?.value || 'auto';
        const displayId = ctx.screenTranslationDisplaySelect?.value || 'primary';

        ctx.logToDebug(`📺 Using settings: ${sourceLanguage} → ${targetLanguage} on display ${displayId}`);

        // Get screen sources using desktopCapturer
        const sources = await (window as any).electronAPI.invoke('get-desktop-sources', ['screen']);

        // Log all available sources with their display_id
        ctx.logToDebug(`🖥️ Available screen sources: ${JSON.stringify(sources.map((s: any) => ({
            id: s.id,
            name: s.name,
            display_id: s.display_id
        })), null, 2)}`);

        // Find the source that matches our selected display
        let targetSource = sources[0]; // fallback

        if (displayId !== 'primary') {
            // Try to find source by display_id match
            const matchedSource = sources.find((s: any) => s.display_id?.toString() === displayId);
            if (matchedSource) {
                targetSource = matchedSource;
                ctx.logToDebug(`✅ Found matching source by display_id: ${JSON.stringify(targetSource)}`);
            } else {
                ctx.logToDebug(`⚠️ No source found for display ID ${displayId}, using fallback: ${JSON.stringify(targetSource)}`);
            }
        }

        // Update loading message
        await updateLoadingMessage('Processing text...');

        // Ensure screen translation system is started
        await (window as any).electronAPI.invoke('screen-translation:start-system');

        // Use the new desktopCapturer-based approach
        const result = await (window as any).electronAPI.invoke('screen-translation:process-source', {
            sourceId: targetSource.id,
            displayId: targetSource.display_id?.toString() || displayId
        });

        // Check if processing was cancelled
        if (!ctx.isScreenTranslationProcessing) {
            ctx.logToDebug('🛑 Processing was cancelled during OCR/translation');
            return;
        }

        if (result.success) {
            ctx.logToDebug(`✅ Screen translation completed: ${result.translatedBoxes.length} text boxes found`);
            updateScreenTranslationStats(result.translatedBoxes.length, result.translatedBoxes.length, 0);
            // Hide loading overlay when translation overlays appear
            await hideLoadingOverlay();

        } else {
            ctx.logToDebug(`❌ Screen translation failed: ${result.error}`);
            updateScreenTranslationStatus('error');
            await hideLoadingOverlay();
        }

    } catch (error) {
        // If processing was cancelled, don't show error
        if (!ctx.isScreenTranslationProcessing && error instanceof Error && error.message.includes('cancelled')) {
            ctx.logToDebug('🛑 Screen translation was cancelled');
            await hideLoadingOverlay();
            return;
        }

        ctx.logToDebug(`❌ Error in screen translation: ${error instanceof Error ? error.message : 'Unknown error'}`);
        console.error('Screen translation error:', error);
        updateScreenTranslationStatus('error');
        await hideLoadingOverlay();
    } finally {
        ctx.isScreenTranslationProcessing = false;

        // Reset to ready after a short delay
        setTimeout(() => {
            updateScreenTranslationStatus('ready');
        }, 2000);
    }
}

export async function triggerScreenTranslationBoxSelect(): Promise<void> {
    try {
        // Check if box selector is already open - if so, close it
        const isOpen = await (window as any).electronAPI.invoke('screen-translation:is-box-selector-open');
        
        if (isOpen) {
            ctx.logToDebug('📦 Closing box selector...');
            await (window as any).electronAPI.invoke('screen-translation:close-box-selector');
            ctx.logToDebug('📦 Box selector closed');
            return;
        }

        // Check if there are any overlay windows currently showing
        const overlayCheck = await (window as any).electronAPI.invoke('screen-translation:has-overlays');
        const hasOverlays = overlayCheck?.success && overlayCheck.hasOverlays;
        
        // Check if overlay system is active
        const overlayStatus = await (window as any).electronAPI.invoke('screen-translation:get-status');
        const isSystemActive = overlayStatus?.success && overlayStatus.isActive;
        
        // If there are overlays or system is active, clean up and return (don't open new box selector)
        if (hasOverlays || isSystemActive) {
            ctx.logToDebug('📦 Found existing overlays or active system, cleaning up...');
            
            if (hasOverlays) {
                await (window as any).electronAPI.invoke('screen-translation:force-cleanup');
                ctx.logToDebug('📦 Overlays cleaned up');
            }
            
            if (isSystemActive) {
                await (window as any).electronAPI.invoke('screen-translation:stop-system');
                ctx.logToDebug('📦 Overlay system stopped');
            }
            
            return; // Exit without opening new box selector
        }

        ctx.logToDebug('📦 Opening box selection for screen translation...');

        // Show loading overlay
        await showLoadingOverlay('Preparing box selection...');

        // Check for PaddlePaddle before proceeding
        await ctx.checkPaddlePaddleBeforeScreenTranslation();

        // Get settings from UI
        const targetLanguage = ctx.screenTranslationTargetLang?.value || 'en';
        const sourceLanguage = ctx.screenTranslationSourceLang?.value || 'auto';

        ctx.logToDebug(`📦 Box selection with languages: ${sourceLanguage} → ${targetLanguage}`);

        // Show the box selector overlay
        await (window as any).electronAPI.invoke('screen-translation:show-box-selector', {
            sourceLanguage,
            targetLanguage
        });

        // Hide loading overlay when box selector appears
        await hideLoadingOverlay();

        ctx.logToDebug('📦 Box selector opened successfully');

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        ctx.logToDebug(`❌ Failed to open box selector: ${errorMessage}`);
        console.error('Box selector error:', error);
        await hideLoadingOverlay();
    }
}

export async function triggerScreenTranslationWatchBoxSelect(): Promise<void> {
    try {
        // Check if watch box is already active - if so, stop it
        const isActive = await (window as any).electronAPI.invoke('screen-translation:is-watch-box-active');
        
        if (isActive) {
            ctx.logToDebug('👁️ Stopping watch box...');
            await (window as any).electronAPI.invoke('screen-translation:stop-watch-box');
            ctx.logToDebug('👁️ Watch box stopped');
            return;
        }

        // Check if box selector is already open - if so, close it
        const isOpen = await (window as any).electronAPI.invoke('screen-translation:is-watch-box-selector-open');
        
        if (isOpen) {
            ctx.logToDebug('👁️ Closing watch box selector...');
            await (window as any).electronAPI.invoke('screen-translation:close-watch-box-selector');
            ctx.logToDebug('👁️ Watch box selector closed');
            return;
        }

        ctx.logToDebug('👁️ Opening watch box selection...');

        // Show loading overlay
        await showLoadingOverlay('Preparing watch box selection...');

        // Check for PaddlePaddle before proceeding
        await ctx.checkPaddlePaddleBeforeScreenTranslation();

        // Get settings from UI
        const targetLanguage = ctx.screenTranslationTargetLang?.value || 'en';
        const sourceLanguage = ctx.screenTranslationSourceLang?.value || 'auto';

        ctx.logToDebug(`👁️ Watch box selection with languages: ${sourceLanguage} → ${targetLanguage}`);

        // Show the watch box selector overlay
        await (window as any).electronAPI.invoke('screen-translation:show-watch-box-selector', {
            sourceLanguage,
            targetLanguage
        });

        // Hide loading overlay when box selector appears
        await hideLoadingOverlay();

        ctx.logToDebug('👁️ Watch box selector opened successfully');

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        ctx.logToDebug(`❌ Failed to open watch box selector: ${errorMessage}`);
        console.error('Watch box selector error:', error);
        await hideLoadingOverlay();
    }
}

export function updateScreenTranslationButton(): void {
    if (ctx.screenTranslationTriggerButton) {
        ctx.screenTranslationTriggerButton.textContent = '📸 Translate Screen';
        ctx.screenTranslationTriggerButton.classList.remove('active');
    }
}

export function updateScreenTranslationStats(total: number, successful: number, processingTime: number): void {
    if (ctx.totalTextBlocksSpan) ctx.totalTextBlocksSpan.textContent = total.toString();
    if (ctx.successfulTranslationsSpan) ctx.successfulTranslationsSpan.textContent = successful.toString();
    if (ctx.processingTimeSpan) ctx.processingTimeSpan.textContent = `${processingTime}ms`;
}

export async function showPythonCheckOverlay(): Promise<void> {
    try {
        ctx.logToDebug('🐍 Requesting Python check overlay...');

        // Send IPC message to main process to show Python check overlay
        await (window as any).electronAPI.sendToMain('python-check:show-overlay');

    } catch (error) {
        ctx.logToDebug(`❌ Error showing Python check overlay: ${error instanceof Error ? error.message : 'Unknown error'}`);
        console.error('Error showing Python check overlay:', error);
    }
}

export function updateScreenTranslationStatus(status: 'ready' | 'processing' | 'starting' | 'stopping' | 'active' | 'error' | 'warmup'): void {
    const isProcessing = status === 'processing' || status === 'starting' || status === 'stopping';
    const isActive = status === 'active';
    const isWarmingUp = status === 'warmup';
    const shouldAnimate = isProcessing || isActive || isWarmingUp;

    if (ctx.screenTranslationProcessingDot) {
        ctx.screenTranslationProcessingDot.classList.toggle('active', shouldAnimate);
    }
    if (ctx.whispraScreenProcessingDot) {
        ctx.whispraScreenProcessingDot.classList.toggle('active', shouldAnimate);
    }

    const statusText = {
        'ready': 'Ready',
        'processing': 'Processing... (click to cancel)',
        'starting': 'Starting...',
        'stopping': 'Stopping...',
        'active': 'Active (click to close)',
        'error': 'Error',
        'warmup': 'Paddle warming...'
    };
    const message = statusText[status] || 'Ready';

    if (ctx.screenTranslationStatus) {
        ctx.screenTranslationStatus.textContent = message;
    }
    if (ctx.whispraScreenStatus) {
        ctx.whispraScreenStatus.textContent = message;
    }

    if (ctx.screenTranslationTriggerButton) {
        // Disable button during warmup, keep enabled otherwise
        ctx.screenTranslationTriggerButton.disabled = isWarmingUp;
    }
}

/**
 * Initialize OCR model for the currently selected source language
 */
export async function initializeOCRForCurrentLanguage(): Promise<void> {
    try {
        const sourceLanguage = ctx.screenTranslationSourceLang?.value || 'auto';
        await initializeOCRForLanguage(sourceLanguage);
    } catch (error) {
        ctx.logToDebug(`❌ Failed to initialize OCR for current language: ${error}`);
    }
}

/**
 * Initialize OCR model for a specific language
 */
export async function initializeOCRForLanguage(sourceLanguage: string): Promise<void> {
    try {
        // Convert 'auto' to default language (Japanese for screen detection)
        const ocrLanguage = sourceLanguage === 'auto' ? 'ja' : sourceLanguage;

        ctx.logToDebug(`📖 Initializing OCR for language: ${ocrLanguage} (from ${sourceLanguage})`);
        ctx.logToDebug(`🌐 Translation will be: ${sourceLanguage} → ${ctx.screenTranslationTargetLang?.value || 'en'}`);

        // Show status
        if (ctx.screenTranslationStatus) {
            ctx.screenTranslationStatus.textContent = `Initializing ${ocrLanguage} OCR...`;
        }
        if (ctx.whispraScreenStatus) {
            ctx.whispraScreenStatus.textContent = `Initializing ${ocrLanguage} OCR...`;
        }

        // Don't override the settings here - they're already set by updateScreenTranslationConfig
        // Just log that OCR is being initialized
        ctx.logToDebug(`✅ OCR will use language: ${ocrLanguage}`);

        if (ctx.screenTranslationStatus) {
            ctx.screenTranslationStatus.textContent = 'Ready';
        }
        if (ctx.whispraScreenStatus) {
            ctx.whispraScreenStatus.textContent = 'Ready';
        }

    } catch (error) {
        ctx.logToDebug(`❌ Error initializing OCR for ${sourceLanguage}: ${error}`);
        if (ctx.screenTranslationStatus) {
            ctx.screenTranslationStatus.textContent = `Error: ${error}`;
        }
        if (ctx.whispraScreenStatus) {
            ctx.whispraScreenStatus.textContent = `Error: ${error}`;
        }
    }
}

export async function updateScreenTranslationConfig(): Promise<void> {
    try {
        // Skip saving during initialization to prevent overwriting loaded config
        if (ctx.isInitializingScreenTranslation) {
            console.log(`📺 Skipping config save during initialization`);
            return;
        }

        const config = {
            targetLanguage: ctx.screenTranslationTargetLang?.value || 'en',
            sourceLanguage: ctx.screenTranslationSourceLang?.value || 'auto',
            displayId: ctx.screenTranslationDisplaySelect?.value || 'primary'
        };

        console.log(`📺 Saving screen translation config:`, {
            sourceLanguage: config.sourceLanguage,
            targetLanguage: config.targetLanguage,
            displayId: config.displayId,
            dropdownActualValue: ctx.screenTranslationSourceLang?.value
        });

        await (window as any).electronAPI.invoke('config:set', {
            id: Date.now().toString(),
            timestamp: Date.now(),
            payload: { screenTranslation: config }
        });

        ctx.logToDebug(`🖥️ Screen translation config updated: ${config.sourceLanguage} → ${config.targetLanguage} on ${config.displayId}`);

        // Check if screen translation is currently active
        const isActive = await (window as any).electronAPI.invoke('screen-translation:get-status');
        const wasActive = isActive?.isActive;

        // Stop current screen translation if running (to switch displays)
        if (wasActive) {
            await (window as any).electronAPI.invoke('screen-translation:stop-system');
            ctx.logToDebug(`🛑 Stopped screen translation to switch to display ${config.displayId}`);
        }

        // Update screen translation settings including target language
        await (window as any).electronAPI.invoke('screen-translation:update-settings', {
            sourceLanguage: config.sourceLanguage,
            targetLanguage: config.targetLanguage,
            autoTranslate: true
        });

        // Notify overlays about the config change (bidirectional sync)
        (window as any).electronAPI?.sendToMain?.('screen-translation:main-app-changed', {
            targetLanguage: config.targetLanguage,
            sourceLanguage: config.sourceLanguage,
            displayId: config.displayId
        });

        // Initialize OCR model for the source language when config changes
        await initializeOCRForLanguage(config.sourceLanguage);

        // Trigger Paddle warmup for the new source language if warmup is enabled
        try {
            const warmupResponse = await (window as any).electronAPI.invoke('config:get', {
                id: Date.now().toString(),
                timestamp: Date.now(),
                payload: null
            });
            const warmupEnabled = warmupResponse?.payload?.uiSettings?.paddleWarmupOnStartup !== false; // Default to true
            
            if (warmupEnabled) {
                console.log(`🏓 Triggering Paddle warmup for language change: ${config.sourceLanguage}`);
                (window as any).electronAPI.paddle.triggerWarmup(config.sourceLanguage);
            }
        } catch (error) {
            console.log('⚠️ Failed to trigger Paddle warmup on language change:', error);
        }

        // Note: Argos restart is handled in Quick Translate panel, not here
        // Screen translation uses Paddle OCR, not Argos translation

        // Restart screen translation if it was active before
        if (wasActive) {
            setTimeout(async () => {
                try {
                    await triggerScreenTranslation();
                    ctx.logToDebug(`🔄 Restarted screen translation on display ${config.displayId}`);
                } catch (restartError) {
                    ctx.logToDebug(`❌ Failed to restart screen translation: ${restartError}`);
                }
            }, 1000); // Small delay to ensure proper cleanup
        }

    } catch (error) {
        ctx.logToDebug(`❌ Failed to save screen translation config: ${error}`);
    }
}


export function handleScreenTranslationKeyDown(event: KeyboardEvent): void {
    // Screen translation requires Alt + key (unlike PTT which is just the key)
    if (event.code === ctx.screenTranslationKeybind && event.altKey) {
        event.preventDefault();
        triggerScreenTranslation();
    }
}

export function showScreenTranslationKeybindModal(): void {
    const modal = document.createElement('div');
    modal.id = 'screen-translation-keybind-modal';
    modal.style.cssText = `position: fixed; inset: 0; background: rgba(0,0,0,0.5); display:flex;align-items:center;justify-content:center; z-index:1000;`;
    const content = document.createElement('div');
    content.style.cssText = 'background:white;padding:1.5rem;border-radius:8px;max-width:90%;width:380px;text-align:center;color:black;';

    // Get current display key
    const currentDisplayKey = ctx.screenTranslationKeybind.startsWith('Key') ? ctx.screenTranslationKeybind.substring(3) : ctx.screenTranslationKeybind;
    const modifierKey = getModifierKeyName();

    content.innerHTML = `
        <h3>Change Screen Translation Key</h3>
        <p>Press ${modifierKey} + any key to set the hotkey</p>
        <p style="font-size: 0.9rem; color: #666;">Must include ${modifierKey} modifier</p>
        <div style="margin:1rem 0;">Current: <kbd>${modifierKey} + ${currentDisplayKey}</kbd></div>
        <button id="screen-cancel" style="padding:0.5rem 1rem;">Cancel</button>
    `;
    modal.appendChild(content);
    document.body.appendChild(modal);

    let set = false;
    const listener = (e: KeyboardEvent) => {
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
        let keyForStorage = e.code.startsWith('Key') ? e.code.substring(3) : e.code;
        ctx.screenTranslationKeybind = e.code; // Store in local variable for display
        console.log('🔑 Screen translation keybind changed to:', e.code);

        // Update display immediately
        ctx.updateScreenTranslationKeybindDisplay(e.code, ctx.screenTranslationKeybindSpan, ctx.screenTranslationKeybindDisplay);

        // Also update the whispra-screen panel display
        const whispraKeybindDisplay = document.getElementById('whispra-screen-keybind') as HTMLElement | null;
        if (whispraKeybindDisplay) {
            whispraKeybindDisplay.textContent = `${getModifierKeyName()} + ${keyForStorage}`;
        }

        // Save to config with the new hotkey structure
        (window as any).electronAPI.invoke('config:set', {
            id: Date.now().toString(),
            timestamp: Date.now(),
            payload: {
                uiSettings: {
                    screenTranslationHotkey: {
                        ctrl: false,
                        alt: true,
                        shift: false,
                        key: keyForStorage
                    }
                }
            }
        }).then(() => {
            // Update in-memory hotkey immediately
            (window as any).electronAPI.invoke('hotkeys:update', {
                screenTranslationHotkey: {
                    ctrl: false,
                    alt: true,
                    shift: false,
                    key: keyForStorage
                }
            }).catch(() => { });
            const modifierKey = getModifierKeyName();
            ctx.logToDebug(`🖥️ Screen translation hotkey changed to ${modifierKey} + ${keyForStorage}`);

            // Notify overlays about keybind change
            (window as any).electronAPI?.sendToMain?.('screen-translation:main-app-changed', {
                keybind: {
                    ctrl: false,
                    alt: true,
                    shift: false,
                    key: keyForStorage
                }
            });
        }).catch(() => { });

        document.removeEventListener('keydown', listener);
        document.body.removeChild(modal);
    };

    document.addEventListener('keydown', listener);
    content.querySelector('#screen-cancel')?.addEventListener('click', () => {
        document.removeEventListener('keydown', listener);
        document.body.removeChild(modal);
    });
}

export function showScreenTranslationBoxSelectKeybindModal(): void {
    const modal = document.createElement('div');
    modal.id = 'screen-translation-box-select-keybind-modal';
    modal.style.cssText = `position: fixed; inset: 0; background: rgba(0,0,0,0.5); display:flex;align-items:center;justify-content:center; z-index:1000;`;
    const content = document.createElement('div');
    content.style.cssText = 'background:white;padding:1.5rem;border-radius:8px;max-width:90%;width:380px;text-align:center;color:black;';

    // Get current keybind from config
    (async () => {
        try {
            const response = await (window as any).electronAPI.invoke('config:get', {
                id: Date.now().toString(),
                timestamp: Date.now(),
                payload: null
            });

            let currentDisplayKey = 'Y';
            if (response.success && response.payload.uiSettings?.screenTranslationBoxHotkey) {
                currentDisplayKey = response.payload.uiSettings.screenTranslationBoxHotkey.key;
            }
            const modifierKey = getModifierKeyName();

            content.innerHTML = `
                <h3>Change Box Select Key</h3>
                <p>Press ${modifierKey} + any key to set the hotkey</p>
                <p style="font-size: 0.9rem; color: #666;">Must include ${modifierKey} modifier</p>
                <div style="margin:1rem 0;">Current: <kbd>${modifierKey} + ${currentDisplayKey}</kbd></div>
                <button id="box-select-cancel" style="padding:0.5rem 1rem;">Cancel</button>
            `;
            modal.appendChild(content);
            document.body.appendChild(modal);

            let set = false;
            const listener = (e: KeyboardEvent) => {
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
                let keyForStorage = e.code.startsWith('Key') ? e.code.substring(3) : e.code;
                console.log('🔑 Box select keybind changed to:', e.code);

                // Save to config with the new hotkey structure
                (window as any).electronAPI.invoke('config:set', {
                    id: Date.now().toString(),
                    timestamp: Date.now(),
                    payload: {
                        uiSettings: {
                            screenTranslationBoxHotkey: {
                                ctrl: false,
                                alt: true,
                                shift: false,
                                key: keyForStorage
                            }
                        }
                    }
                }).then(() => {
                    // Update in-memory hotkey immediately
                    (window as any).electronAPI.invoke('hotkeys:update', {
                        screenTranslationBoxHotkey: {
                            ctrl: false,
                            alt: true,
                            shift: false,
                            key: keyForStorage
                        }
                    }).catch(() => { });
                    const modifierKey = getModifierKeyName();
                    ctx.logToDebug(`📦 Box select hotkey changed to ${modifierKey} + ${keyForStorage}`);

                    // Update the display
                    const keybindDisplay = document.getElementById('whispra-screen-box-keybind') as HTMLElement | null;
                    if (keybindDisplay) {
                        keybindDisplay.textContent = `${modifierKey} + ${keyForStorage}`;
                    }
                }).catch(() => { });

                document.removeEventListener('keydown', listener);
                document.body.removeChild(modal);
            };

            document.addEventListener('keydown', listener);
            content.querySelector('#box-select-cancel')?.addEventListener('click', () => {
                document.removeEventListener('keydown', listener);
                document.body.removeChild(modal);
            });
        } catch (error) {
            console.error('Failed to load box select keybind for modal:', error);
        }
    })();
}

export function showScreenTranslationWatchBoxKeybindModal(): void {
    const modal = document.createElement('div');
    modal.id = 'screen-translation-watch-box-keybind-modal';
    modal.style.cssText = `position: fixed; inset: 0; background: rgba(0,0,0,0.5); display:flex;align-items:center;justify-content:center; z-index:1000;`;
    const content = document.createElement('div');
    content.style.cssText = 'background:white;padding:1.5rem;border-radius:8px;max-width:90%;width:380px;text-align:center;color:black;';

    // Get current keybind from config
    (async () => {
        try {
            const response = await (window as any).electronAPI.invoke('config:get', {
                id: Date.now().toString(),
                timestamp: Date.now(),
                payload: null
            });

            let currentDisplayKey = 'W';
            if (response.success && response.payload.uiSettings?.screenTranslationWatchBoxHotkey) {
                currentDisplayKey = response.payload.uiSettings.screenTranslationWatchBoxHotkey.key;
            }
            const modifierKey = getModifierKeyName();

            content.innerHTML = `
                <h3>Change Watch Box Key</h3>
                <p>Press ${modifierKey} + any key to set the hotkey</p>
                <p style="font-size: 0.9rem; color: #666;">Must include ${modifierKey} modifier</p>
                <div style="margin:1rem 0;">Current: <kbd>${modifierKey} + ${currentDisplayKey}</kbd></div>
                <button id="watch-box-cancel" style="padding:0.5rem 1rem;">Cancel</button>
            `;
            modal.appendChild(content);
            document.body.appendChild(modal);

            let set = false;
            const listener = (e: KeyboardEvent) => {
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
                let keyForStorage = e.code.startsWith('Key') ? e.code.substring(3) : e.code;
                console.log('🔑 Watch box keybind changed to:', e.code);

                // Save to config with the new hotkey structure
                (window as any).electronAPI.invoke('config:set', {
                    id: Date.now().toString(),
                    timestamp: Date.now(),
                    payload: {
                        uiSettings: {
                            screenTranslationWatchBoxHotkey: {
                                ctrl: false,
                                alt: true,
                                shift: false,
                                key: keyForStorage
                            }
                        }
                    }
                }).then(() => {
                    // Update in-memory hotkey immediately
                    (window as any).electronAPI.invoke('hotkeys:update', {
                        screenTranslationWatchBoxHotkey: {
                            ctrl: false,
                            alt: true,
                            shift: false,
                            key: keyForStorage
                        }
                    }).catch(() => { });
                    const modifierKey = getModifierKeyName();
                    ctx.logToDebug(`👁️ Watch box hotkey changed to ${modifierKey} + ${keyForStorage}`);

                    // Update the display
                    const keybindDisplay = document.getElementById('whispra-screen-watch-box-keybind') as HTMLElement | null;
                    if (keybindDisplay) {
                        keybindDisplay.textContent = `${modifierKey} + ${keyForStorage}`;
                    }
                }).catch(() => { });

                document.removeEventListener('keydown', listener);
                document.body.removeChild(modal);
            };

            document.addEventListener('keydown', listener);
            content.querySelector('#watch-box-cancel')?.addEventListener('click', () => {
                document.removeEventListener('keydown', listener);
                document.body.removeChild(modal);
            });
        } catch (error) {
            console.error('Failed to load watch box keybind for modal:', error);
        }
    })();
}