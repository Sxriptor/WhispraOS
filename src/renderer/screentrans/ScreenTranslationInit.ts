import { ctx } from './shared.js';
import { setupMainGPUModeToggle } from './PaddleGPU.js';
import { setupPaddleWarmupToggle } from './PaddleWarmup.js';
import { updateScreenTranslationButton, updateScreenTranslationStatus } from './PaddleTriggerConfig.js';
import { selectDisplay } from './LoadDisplays.js';

export async function initializeScreenTranslationTab(): Promise<void> {
    try {
        // Set flag to prevent config saving during initialization
        ctx.isInitializingScreenTranslation = true;
        
        console.log(`📺 ====== initializeScreenTranslationTab() called ======`);
        console.log(`📺 Current dropdown values BEFORE loading config:`, {
            source: ctx.screenTranslationSourceLang?.value,
            target: ctx.screenTranslationTargetLang?.value
        });
        ctx.logToDebug('📺 Initializing Screen Translation system...');

        // Initialize button state
        updateScreenTranslationButton();
        updateScreenTranslationStatus('ready');

        // Setup GPU mode toggle
        setupMainGPUModeToggle();
        
        // Setup Paddle warmup toggle (await to ensure config is loaded)
        await setupPaddleWarmupToggle();

        // Load screen translation config from saved settings FIRST (before loading displays)
        try {
            const response = await (window as any).electronAPI.invoke('config:get', {
                id: Date.now().toString(),
                timestamp: Date.now(),
                payload: null
            });

            if (response.success && response.payload?.screenTranslation) {
                const config = response.payload.screenTranslation;
                
                console.log(`📺 Loaded config from storage:`, config);

                // Set target language
                if (ctx.screenTranslationTargetLang && config.targetLanguage) {
                    console.log(`📺 Setting target language dropdown to: ${config.targetLanguage}`);
                    ctx.screenTranslationTargetLang.value = config.targetLanguage;
                }

                // Set source language
                if (ctx.screenTranslationSourceLang && config.sourceLanguage) {
                    console.log(`📺 Setting source language dropdown to: ${config.sourceLanguage}`);
                    ctx.screenTranslationSourceLang.value = config.sourceLanguage;
                    console.log(`📺 Source language dropdown is now: ${ctx.screenTranslationSourceLang.value}`);
                }

                // Note: Display will be set after loading displays
                ctx.logToDebug(`📺 Screen translation config loaded: ${config.sourceLanguage || 'auto'} → ${config.targetLanguage || 'en'}`);
            } else {
                console.log(`📺 No saved screen translation config found, using defaults`);
            }
        } catch (error) {
            ctx.logToDebug(`⚠️ Failed to load screen translation config: ${error}`);
        }

        // Load available displays AFTER loading config (this may trigger selectDisplay which saves config)
        await ctx.loadAvailableDisplays();

        // Re-apply display selection from config if needed
        try {
            const response = await (window as any).electronAPI.invoke('config:get', {
                id: Date.now().toString(),
                timestamp: Date.now(),
                payload: null
            });

            if (response.success && response.payload?.screenTranslation?.displayId) {
                const config = response.payload.screenTranslation;
                if (config.displayId && ctx.screenTranslationDisplaySelect?.value !== config.displayId) {
                    console.log(`📺 Re-applying saved display: ${config.displayId}`);
                    selectDisplay(config.displayId, { skipConfigUpdate: true });
                }
            }
        } catch (error) {
            console.log(`⚠️ Failed to re-apply display config: ${error}`);
        }

        // System is ready for one-shot translations

        ctx.logToDebug('✅ Screen Translation system initialized successfully');

    } catch (error) {
        ctx.logToDebug(`❌ Error initializing Screen Translation tab: ${error}`);
    } finally {
        // Clear initialization flag to allow normal config saving
        ctx.isInitializingScreenTranslation = false;
        console.log(`📺 Initialization complete, config saving re-enabled`);
    }
}