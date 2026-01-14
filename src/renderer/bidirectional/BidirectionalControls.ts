/**
 * Bidirectional Controls
 * Main control functions: initialization, start, stop, toggle, device loaders
 * This is the largest module containing the core bidirectional logic
 */

import {
    isBidirectionalActive,
    bidirectionalKeybind,
    bidirectionalOutputDeviceId,
    bidirectionalInputDeviceId,
    bidirectionalUseDisplayAudio,
    selectedProcessName,
    incomingVoiceId,
    bidirectionalSourceLanguage,
    bidirectionalTargetLanguage,
    bidirectionalCaptionsEnabled,
    captionsSettings,
    bidirectionalMiniOverlayTimer,
    bidirectionalAutoOpenedOverlay,
    isInitializingBidirectional,
    bidirectionalTTSProcessor,
    bidirectionalContextManager,
    bidiAudioStream,
    bidiDesktopStream,
    bidiMixedStream,
    bidiMixerCtx,
    bidiMixerDestination,
    bidiAnalyzerCtx,
    bidiAnalyzerNode,
    bidiSourceNode,
    bidiEnhancementNodes,
    bidiVadInterval,
    bidiCalibrating,
    bidiCalibSamples,
    bidiCalibAccum,
    bidiBaseline,
    bidiConsecutiveActiveFrames,
    bidiStartTs,
    bidiLastVoiceTs,
    bidiVadThreshold,
    bidiInSpeech,
    bidiNeedsProbe,
    bidiLastProbeAttemptTs,
    bidiSectionActive,
    bidiSectionBlocked,
    bidiUseWasapiWav,
    bidiMimeType,
    bidiRecorder,
    bidiLastTranscription,
    bidiLastAudioChunkTime,
    wasapiWorkletNode,
    wasapiCtx,
    wasapiDest,
    wasapiPcmQueue,
    pendingFinalize,
    bidiCurrentBlobs,
    bidiPlaybackQueue,
    bidiIsPlayingTts,
    bidiChunkQueue,
    isProcessingBidiChunk,
    bidiProcessing,
    macosRealOutputDeviceId,
    setIsBidirectionalActive,
    setBidirectionalKeybind,
    setBidirectionalOutputDeviceId,
    setBidirectionalInputDeviceId,
    setBidirectionalUseDisplayAudio,
    setSelectedProcessName,
    setIncomingVoiceId,
    setBidirectionalSourceLanguage,
    setBidirectionalTargetLanguage,
    setBidirectionalCaptionsEnabled,
    setCaptionsSettings,
    setBidirectionalMiniOverlayTimer,
    setBidirectionalAutoOpenedOverlay,
    setIsInitializingBidirectional,
    setBidirectionalTTSProcessor,
    setBidirectionalContextManager,
    setBidiAudioStream,
    setBidiDesktopStream,
    setBidiMixedStream,
    setBidiMixerCtx,
    setBidiMixerDestination,
    setBidiAnalyzerCtx,
    setBidiAnalyzerNode,
    setBidiSourceNode,
    setBidiEnhancementNodes,
    setBidiVadInterval,
    setBidiCalibrating,
    setBidiCalibSamples,
    setBidiCalibAccum,
    setBidiBaseline,
    setBidiConsecutiveActiveFrames,
    setBidiStartTs,
    setBidiLastVoiceTs,
    setBidiVadThreshold,
    setBidiInSpeech,
    setBidiNeedsProbe,
    setBidiLastProbeAttemptTs,
    setBidiSectionActive,
    setBidiSectionBlocked,
    setBidiUseWasapiWav,
    setBidiMimeType,
    setBidiRecorder,
    setBidiLastTranscription,
    setBidiLastAudioChunkTime,
    setWasapiWorkletNode,
    setWasapiCtx,
    setWasapiDest,
    setWasapiPcmQueue,
    setPendingFinalize,
    setBidiCurrentBlobs,
    setBidiPlaybackQueue,
    setBidiIsPlayingTts,
    setBidiChunkQueue,
    setIsProcessingBidiChunk,
    setBidiProcessing,
    setMacosRealOutputDeviceId,
    resetAllBidirectionalState
} from './BidirectionalState.js';

import {
    getBidirectionalDOMElements,
    setBidirectionalStatus,
    getBidirectionalSourceLanguage,
    getBidirectionalTargetLanguage,
    updateUILanguage
} from './BidirectionalUI.js';

import { updateBidirectionalKeybindDisplay } from '../translationHelpers.js';
import { updateScreenTranslationKeybindDisplay } from '../translationHelpers.js';
import {
    updateBidirectionalCaptionsToggle,
    updateCaptions,
    clearCaptions
} from './BidirectionalCaptions.js';

import {
    float32ToWavBlob,
    startPcmCapture,
    stopPcmCapture
} from './BidirectionalAudioHelpers.js';

import { processBidirectionalAudioChunk, updateBidirectionalUI, initializeProcessorModule } from './BidirectionalProcessor.js';

// Import services
import { TranslationContextManager } from '../../services/TranslationContextManager.js';
import { BidirectionalTTSProcessor } from '../../services/BidirectionalTTSProcessor.js';

// Import audio enhancement
import { createAudioEnhancement, AudioEnhancementNodes } from './BidirectionalAudioEnhancement.js';

// Import bidirectional audio level overlay
import { BidirectionalOverlay } from '../../ui/BidirectionalOverlay.js';

// Bidirectional overlay instance
let bidirectionalOverlay: BidirectionalOverlay | null = null;

// Forward declarations for functions that must be imported from renderer.ts
let playAudioToDevice: ((audioData: number[], sinkId?: string) => Promise<void>) | null = null;
let requestDisplayAudioWithOverlay: (() => Promise<{ stream: MediaStream | null; processName: string | null }>) | null = null;
let fallbackToVBCableIfAvailable: ((currentDeviceId: string | null) => Promise<string | null>) | null = null;
let logToDebug: ((message: string) => void) | null = null;
let applyAccentTag: ((text: string) => string) | null = null;
let getAccentEnabled: (() => boolean) | null = null;

// Track screen translation keybind
let screenTranslationKeybind = 'KeyT';

/**
 * Inject shared functions from renderer.ts
 * These functions are shared across multiple modules and cannot be moved
 */
export function injectSharedFunctions(
    playAudio: (audioData: number[], sinkId?: string) => Promise<void>,
    requestDisplay: () => Promise<{ stream: MediaStream | null; processName: string | null }>,
    fallbackVB: (currentDeviceId: string | null) => Promise<string | null>,
    logDebug: (message: string) => void,
    applyAccent: (text: string) => string,
    getAccent: () => boolean
): void {
    playAudioToDevice = playAudio;
    requestDisplayAudioWithOverlay = requestDisplay;
    fallbackToVBCableIfAvailable = fallbackVB;
    logToDebug = logDebug;
    applyAccentTag = applyAccent;
    getAccentEnabled = getAccent;
}

/**
 * Initialize bidirectional tab
 * Loads configuration and sets up the initial state
 */
export async function initializeBidirectionalTab(): Promise<void> {
    try {
        // Set flag to prevent config saving during initialization
        setIsInitializingBidirectional(true);

        console.log('🔄 ====== initializeBidirectionalTab() called ======');

        const elements = getBidirectionalDOMElements();

        // Restore saved settings FIRST
        const response = await (window as any).electronAPI.invoke('config:get', {
            id: Date.now().toString(),
            timestamp: Date.now(),
            payload: null
        });

        if (response.success) {
            const cfg = response.payload;

            // Set default bidirectional hotkey if not configured
            const defaultBidiHotkey = { ctrl: false, alt: true, shift: false, key: 'B' };
            const bidiHotkey = cfg.uiSettings?.bidirectionalHotkey || defaultBidiHotkey;

            // Convert from hotkey object to keybind string format
            let bidiKey = bidiHotkey.key;
            let newBidirectionalKeybind: string;
            if (bidiKey.startsWith('Key') && bidiKey.length === 4) {
                newBidirectionalKeybind = bidiKey;
            } else if (bidiKey === 'Space') {
                newBidirectionalKeybind = 'Space';
            } else if (/^[A-Z]$/i.test(bidiKey)) {
                newBidirectionalKeybind = `Key${bidiKey.toUpperCase()}`;
            } else {
                newBidirectionalKeybind = bidiKey;
            }
            setBidirectionalKeybind(newBidirectionalKeybind);

            // Update all display elements using helper function
            updateBidirectionalKeybindDisplay(
                newBidirectionalKeybind,
                elements.bidirectionalKeybindSpan,
                elements.bidirectionalKeybindDisplay
            );

            // Set default screen translation hotkey if not configured
            const defaultScreenTranslationHotkey = { ctrl: false, alt: true, shift: false, key: 'T' };
            const screenTranslationHotkey = cfg.uiSettings?.screenTranslationHotkey || defaultScreenTranslationHotkey;

            // Convert from hotkey object to keybind string format
            let screenKey = screenTranslationHotkey.key;
            if (screenKey.startsWith('Key') && screenKey.length === 4) {
                screenTranslationKeybind = screenKey;
            } else if (screenKey === 'Space') {
                screenTranslationKeybind = 'Space';
            } else if (/^[A-Z]$/i.test(screenKey)) {
                screenTranslationKeybind = `Key${screenKey.toUpperCase()}`;
            } else {
                screenTranslationKeybind = screenKey;
            }

            // Update all display elements using helper function
            const screenTranslationKeybindSpan = document.getElementById('screen-translation-current-keybind') as HTMLSpanElement | null;
            const screenTranslationKeybindDisplay = document.getElementById('screen-translation-keybind-display') as HTMLElement | null;
            updateScreenTranslationKeybindDisplay(screenTranslationKeybind, screenTranslationKeybindSpan, screenTranslationKeybindDisplay);

            // Restore bidirectional settings
            if (cfg.uiSettings?.bidirectionalOutputDeviceId && elements.bidirectionalOutputSelect) {
                setBidirectionalOutputDeviceId(cfg.uiSettings.bidirectionalOutputDeviceId);
                elements.bidirectionalOutputSelect.value = cfg.uiSettings.bidirectionalOutputDeviceId || '';
            }

            // Process selection removed - always use system audio capture (not per-process)
            // Clear any previously saved process name to ensure system audio is used
            setSelectedProcessName(null);
            // Also clear from config to prevent future loads
            try {
                await (window as any).electronAPI.invoke('config:set', {
                    id: Date.now().toString(),
                    timestamp: Date.now(),
                    payload: { uiSettings: { bidirectionalProcessName: null } }
                });
            } catch (e) {
                console.warn('Failed to clear bidirectionalProcessName from config:', e);
            }

            // bidirectionalInputSelect configuration removed - now hardcoded to Display/System Audio
            setBidirectionalUseDisplayAudio(true);
            setBidirectionalInputDeviceId(null);

            if (cfg.uiSettings?.incomingVoiceId && elements.incomingVoiceSelect) {
                setIncomingVoiceId(cfg.uiSettings.incomingVoiceId);
                elements.incomingVoiceSelect.value = cfg.uiSettings.incomingVoiceId || '';
            }

            // Load bidirectional language settings
            if (cfg.uiSettings?.bidirectionalSourceLanguage !== undefined) {
                setBidirectionalSourceLanguage(cfg.uiSettings.bidirectionalSourceLanguage);
                if (elements.bidirectionalSourceLanguageSelect && elements.bidirectionalSourceLanguageSelect.value !== cfg.uiSettings.bidirectionalSourceLanguage) {
                    elements.bidirectionalSourceLanguageSelect.value = cfg.uiSettings.bidirectionalSourceLanguage;
                    console.log('Loaded bidirectional source language from config:', cfg.uiSettings.bidirectionalSourceLanguage);
                }
            }

            if (cfg.uiSettings?.bidirectionalTargetLanguage !== undefined) {
                setBidirectionalTargetLanguage(cfg.uiSettings.bidirectionalTargetLanguage);
                if (elements.bidirectionalTargetLanguageSelect && elements.bidirectionalTargetLanguageSelect.value !== cfg.uiSettings.bidirectionalTargetLanguage) {
                    elements.bidirectionalTargetLanguageSelect.value = cfg.uiSettings.bidirectionalTargetLanguage;
                    console.log('Loaded bidirectional target language from config:', cfg.uiSettings.bidirectionalTargetLanguage);
                }
            }

            // Load bidirectional captions setting
            if (cfg.uiSettings?.bidirectionalCaptionsEnabled !== undefined) {
                setBidirectionalCaptionsEnabled(cfg.uiSettings.bidirectionalCaptionsEnabled);
                console.log('Loaded bidirectional captions setting from config:', cfg.uiSettings.bidirectionalCaptionsEnabled);
            }

            // Load captions settings
            let loadedCaptionsSettings = captionsSettings; // Keep reference to loaded settings
            if (cfg.uiSettings?.captionsSettings) {
                const loadedSettings = cfg.uiSettings.captionsSettings;
                console.log('📥 RAW loaded settings from config:', JSON.stringify(loadedSettings, null, 2));
                console.log('📥 captionsOnly from config:', loadedSettings.captionsOnly, typeof loadedSettings.captionsOnly);

                // Validate and clean loaded settings (prevent empty strings, remove junk properties)
                // Start with loaded settings, filter out junk, and override invalid values with defaults
                const { isTrusted, ...cleanedSettings } = loadedSettings as any; // Remove isTrusted

                loadedCaptionsSettings = {
                    ...cleanedSettings, // Keep all properties like position, etc.
                    enabled: loadedSettings.enabled !== undefined ? loadedSettings.enabled : captionsSettings.enabled,
                    textColor: (loadedSettings.textColor && loadedSettings.textColor !== '') ? loadedSettings.textColor as any : captionsSettings.textColor,
                    background: (loadedSettings.background && loadedSettings.background !== '') ? loadedSettings.background as any : captionsSettings.background,
                    fontSize: (loadedSettings.fontSize && loadedSettings.fontSize !== '') ? loadedSettings.fontSize as any : captionsSettings.fontSize,
                    captionsOnly: loadedSettings.captionsOnly !== undefined ? loadedSettings.captionsOnly : captionsSettings.captionsOnly
                };

                console.log('✅ Loaded captions settings from config (validated):', JSON.stringify(loadedCaptionsSettings, null, 2));
                console.log('✅ captionsOnly after validation:', loadedCaptionsSettings.captionsOnly);
            }

            // Sync captions enabled state (use the loaded settings, not captionsSettings which may be stale)
            const syncedSettings = { ...loadedCaptionsSettings, enabled: bidirectionalCaptionsEnabled };
            console.log('🔄 Syncing captions settings with enabled state:', JSON.stringify(syncedSettings, null, 2));
            console.log('🔄 captionsOnly after sync:', syncedSettings.captionsOnly);
            console.log('🔄 About to call setCaptionsSettings with:', JSON.stringify(syncedSettings, null, 2));
            setCaptionsSettings(syncedSettings);
            console.log('💾 FINAL captionsSettings after setCaptionsSettings (should be same as above):', JSON.stringify(captionsSettings, null, 2));
            updateBidirectionalCaptionsToggle();

            // Initialize captions overlay with loaded settings
            if (bidirectionalCaptionsEnabled) {
                try {
                    await (window as any).electronAPI.invoke('captions:updateSettings', {
                        id: Date.now().toString(),
                        timestamp: Date.now(),
                        payload: syncedSettings
                    });
                    console.log('📺 Captions overlay initialized with loaded settings');
                } catch (error) {
                    console.error('❌ Failed to initialize captions overlay:', error);
                }
            }

            // Load bidirectional optimization settings
            if (cfg.uiSettings?.bidirectionalOptimization) {
                const opt = cfg.uiSettings.bidirectionalOptimization;
                const speedSelect = document.getElementById('bidirectional-speed-select') as HTMLSelectElement;
                
                if (speedSelect) {
                    speedSelect.value = opt.translationSpeed || 'normal';
                }
            }
            
            // Update speed select text based on translation model
            updateSpeedSelectText(cfg);
        }

        // Set up speed select event listener
        const speedSelect = document.getElementById('bidirectional-speed-select') as HTMLSelectElement;
        if (speedSelect) {
            speedSelect.addEventListener('change', async (e) => {
                const speed = (e.target as HTMLSelectElement).value as 'normal' | 'fast';
                try {
                    await (window as any).electronAPI.invoke('config:set', {
                        id: Date.now().toString(),
                        timestamp: Date.now(),
                        payload: {
                            uiSettings: {
                                bidirectionalOptimization: {
                                    translationSpeed: speed
                                }
                            }
                        }
                    });
                    console.log(`✅ Translation speed set to: ${speed}`);
                } catch (error) {
                    console.error('❌ Failed to update translation speed setting:', error);
                }
            });
        }
        
        // Listen for config changes to update dropdown text when translation model changes
        if ((window as any).electronAPI?.onConfigUpdated) {
            (window as any).electronAPI.onConfigUpdated((config: any) => {
                console.log('🔄 Config updated, refreshing speed select text. gptModel:', config?.modelConfig?.gptModel || config?.cloudModelConfig?.gptModel);
                updateSpeedSelectText(config);
            });
        }

        // Load bidirectional devices and voices
        await loadBidirectionalOutputDevices();
        await loadBidirectionalProcesses();
        await loadIncomingVoices();

    } catch (error) {
        console.log('⚠️ Error during bidirectional initialization:', error);
    } finally {
        // Clear initialization flag to allow normal config saving
        setIsInitializingBidirectional(false);
        console.log('🔄 Bidirectional initialization complete, config saving re-enabled');
    }
}

/**
 * Update speed select dropdown text based on translation model
 */
export function updateSpeedSelectText(config: any): void {
    const speedSelect = document.getElementById('bidirectional-speed-select') as HTMLSelectElement;
    if (!speedSelect) {
        console.warn('⚠️ Speed select element not found');
        return;
    }
    
    // Get translation model from config
    const modelConfig = config.modelConfig || config.cloudModelConfig || {};
    const gptModel = modelConfig.gptModel || 'openai';
    
    console.log(`🔄 updateSpeedSelectText called. gptModel: ${gptModel}, modelConfig:`, modelConfig);
    
    // Find the fast option
    const fastOption = Array.from(speedSelect.options).find(opt => opt.value === 'fast');
    
    if (!fastOption) {
        console.warn('⚠️ Fast option not found in speed select');
        return;
    }
    
    if (gptModel === 'argos') {
        // Argos doesn't support Real-Time API - show message to use OpenAI or DeepInfra
        fastOption.textContent = 'Fast (Use OpenAI or DeepInfra)';
        fastOption.disabled = true;
        // Only force normal if currently set to fast
        if (speedSelect.value === 'fast') {
            speedSelect.value = 'normal';
        }
        
        // Update description
        const description = speedSelect.parentElement?.querySelector('small');
        if (description) {
            description.textContent = 'Fast mode requires OpenAI or DeepInfra translation model';
        }
    } else if (gptModel === 'deepinfra') {
        // DeepInfra can use Real-Time API (it's OpenAI-compatible)
        fastOption.textContent = 'Fast (OpenAI Real-Time)';
        fastOption.disabled = false;
        
        // Update description
        const description = speedSelect.parentElement?.querySelector('small');
        if (description) {
            description.textContent = 'Fast mode uses OpenAI Real-Time API for ultra-low latency';
        }
    } else {
        // OpenAI - default behavior
        fastOption.textContent = 'Fast (OpenAI Real-Time)';
        fastOption.disabled = false;
        
        // Update description
        const description = speedSelect.parentElement?.querySelector('small');
        if (description) {
            description.textContent = 'Fast mode uses OpenAI Real-Time API for ultra-low latency';
        }
    }
}

/**
 * Load bidirectional output devices
 */
export async function loadBidirectionalOutputDevices(): Promise<void> {
    const elements = getBidirectionalDOMElements();
    if (!elements.bidirectionalOutputSelect) return;

    try {
        elements.bidirectionalOutputSelect.innerHTML = '<option value="">Loading output devices...</option>';
        const response = await (window as any).electronAPI.invoke('audio:get-output-devices', {
            id: Date.now().toString(),
            timestamp: Date.now(),
            payload: null
        });

        if (response.success && response.payload) {
            const devices = response.payload;
            elements.bidirectionalOutputSelect.innerHTML = '';

            if (!elements.bidirectionalOutputSelect) {
                console.error('❌ bidirectionalOutputSelect element not found');
                return;
            }

            if (devices.length === 0) {
                const emptyOpt = document.createElement('option');
                emptyOpt.value = '';
                emptyOpt.textContent = 'No output devices found';
                elements.bidirectionalOutputSelect.appendChild(emptyOpt);
                console.log('No output devices found');
                return;
            }

            // Add all devices
            devices.forEach((device: any) => {
                const opt = document.createElement('option');
                opt.value = device.deviceId;
                opt.textContent = device.label || `Device ${device.deviceId.substring(0, 8)}`;
                elements.bidirectionalOutputSelect!.appendChild(opt);
            });

            // Auto-detect VB-Audio Cable and set as default if no device selected
            if (!bidirectionalOutputDeviceId) {
                const vbCableDevice = devices.find((d: any) =>
                    (d.label || '').toLowerCase().includes('cable') &&
                    (d.label || '').toLowerCase().includes('vb-audio')
                );
                if (vbCableDevice) {
                    setBidirectionalOutputDeviceId(vbCableDevice.deviceId);
                    elements.bidirectionalOutputSelect.value = vbCableDevice.deviceId;
                    console.log('🔊 Auto-detected VB-Audio Cable:', vbCableDevice.label);

                    // Save to config
                    try {
                        await (window as any).electronAPI.invoke('config:set', {
                            id: Date.now().toString(),
                            timestamp: Date.now(),
                            payload: { uiSettings: { bidirectionalOutputDeviceId: vbCableDevice.deviceId } }
                        });
                    } catch (err) {
                        console.error('Failed to save auto-detected VB-Audio Cable:', err);
                    }
                } else if (devices.length > 0) {
                    // Fallback to first device if VB-Audio not found
                    setBidirectionalOutputDeviceId(devices[0].deviceId);
                    elements.bidirectionalOutputSelect.value = devices[0].deviceId;
                }
            } else {
                // Restore saved device
                elements.bidirectionalOutputSelect.value = bidirectionalOutputDeviceId;
            }

            console.log(`Loaded ${devices.length} output devices`);
        } else {
            elements.bidirectionalOutputSelect.innerHTML = '<option value="">Error loading devices</option>';
        }
    } catch (error) {
        console.error('Error loading bidirectional output devices:', error);
        if (elements.bidirectionalOutputSelect) {
            elements.bidirectionalOutputSelect.innerHTML = '<option value="">Error loading devices</option>';
        }
    }
}

/**
 * Load bidirectional processes (for WASAPI)
 */
export async function loadBidirectionalProcesses(): Promise<void> {
    const elements = getBidirectionalDOMElements();
    if (!elements.bidirectionalProcessSelect) return;

    try {
        elements.bidirectionalProcessSelect.innerHTML = '<option value="">Loading processes...</option>';
        const response = await (window as any).electronAPI.invoke('wasapi:get-processes', {
            id: Date.now().toString(),
            timestamp: Date.now(),
            payload: null
        });

        if (response.success && response.payload) {
            const processes = response.payload;
            if (!elements.bidirectionalProcessSelect) {
                console.error('❌ bidirectionalProcessSelect element not found');
                return;
            }
            elements.bidirectionalProcessSelect.innerHTML = '';

            // Add default option
            const defaultOpt = document.createElement('option');
            defaultOpt.value = '';
            defaultOpt.textContent = 'All System Audio';
            elements.bidirectionalProcessSelect.appendChild(defaultOpt);

            if (processes.length === 0) {
                console.log('No audio processes found');
                return;
            }

            // Add all processes
            processes.forEach((proc: any) => {
                const opt = document.createElement('option');
                opt.value = proc.name;
                opt.textContent = proc.name;
                elements.bidirectionalProcessSelect!.appendChild(opt);
            });

            // Restore selected process if exists
            if (selectedProcessName) {
                elements.bidirectionalProcessSelect.value = selectedProcessName;
            }

            console.log(`Loaded ${processes.length} audio processes`);
        } else {
            elements.bidirectionalProcessSelect.innerHTML = '<option value="">Error loading processes</option>';
        }
    } catch (error) {
        console.error('Error loading bidirectional processes:', error);
        if (elements.bidirectionalProcessSelect) {
            elements.bidirectionalProcessSelect.innerHTML = '<option value="">Error loading processes</option>';
        }
    }
}

/**
 * Load incoming voices for TTS
 */
export async function loadIncomingVoices(): Promise<void> {
    const elements = getBidirectionalDOMElements();
    if (!elements.incomingVoiceSelect) return;

    try {
        elements.incomingVoiceSelect.innerHTML = '<option value="">Loading voices...</option>';
        const response = await (window as any).electronAPI.invoke('voice:get-voices', {
            id: Date.now().toString(),
            timestamp: Date.now(),
            payload: null
        });

        let voices: any[] = [];
        if (response.success && response.payload) {
            voices = response.payload;
        } else {
            voices = [
                { id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam (Male, English)' },
                { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella (Female, English)' }
            ];
        }

        if (!elements.incomingVoiceSelect) {
            console.error('❌ incomingVoiceSelect element not found');
            return;
        }
        elements.incomingVoiceSelect.innerHTML = '';

        if (voices.length === 0) {
            const fallbackOpt = document.createElement('option');
            fallbackOpt.value = '';
            fallbackOpt.textContent = 'No voices available';
            elements.incomingVoiceSelect.appendChild(fallbackOpt);
            console.log('No voices found');
        } else {
            voices.forEach(v => {
                const opt = document.createElement('option');
                opt.value = v.id;
                opt.textContent = v.name;
                elements.incomingVoiceSelect!.appendChild(opt);
            });

            if (!incomingVoiceId && voices.length > 0) {
                setIncomingVoiceId(voices[0].id);
                elements.incomingVoiceSelect.value = voices[0].id;
            }
        }

        console.log(`Loaded ${voices.length} voices for bidirectional mode`);
    } catch (error) {
        console.error('Error loading incoming voices:', error);
        if (elements.incomingVoiceSelect) {
            elements.incomingVoiceSelect.innerHTML = '<option value="">Error loading voices</option>';
        }
    }
}

/**
 * Toggle bidirectional mode on/off
 */
export async function toggleBidirectional(): Promise<void> {
    // Check if on Mac - bidirectional not available
    const isMac = (window as any).electronAPI?.platform === 'darwin';
    if (isMac) {
        console.log('🍎 Bidirectional mode is not available on macOS');
        return;
    }

    if (isBidirectionalActive) {
        await stopBidirectional();
    } else {
        await startBidirectional();
    }
}

/**
 * Start bidirectional translation mode
 * This is the largest function - sets up entire audio pipeline
 */
export async function startBidirectional(): Promise<void> {
    // Check if on Mac - bidirectional not available
    const isMac = (window as any).electronAPI?.platform === 'darwin';
    if (isMac) {
        console.log('🍎 Bidirectional mode is not available on macOS');
        return;
    }

    if (isBidirectionalActive) return;

    // Reset captions chunks when starting bidirectional translation
    try {
        await (window as any).electronAPI.invoke('captions:resetChunks', {
            id: Date.now().toString(),
            timestamp: Date.now(),
            payload: {}
        });
        console.log('📺 Captions chunks reset for new bidirectional session');
    } catch (error) {
        console.error('❌ Failed to reset captions chunks:', error);
    }

    // Check for TTS availability - ALWAYS force captions-only mode (TTS coming soon)
    let isCaptionsOnlyMode = true; // Always true - TTS for bidirectional is coming soon
    console.log('📝 TTS for bidirectional is coming soon - forcing captions-only mode');
    
    // Ensure captions are enabled and captionsOnly is true
    if (!bidirectionalCaptionsEnabled) {
        setBidirectionalCaptionsEnabled(true);
        updateBidirectionalCaptionsToggle();
    }
    
    const newSettings = { ...captionsSettings, enabled: true, captionsOnly: true };
    setCaptionsSettings(newSettings);
    
    // Update captions overlay
    try {
        await (window as any).electronAPI.invoke('captions:updateSettings', {
            id: Date.now().toString(),
            timestamp: Date.now(),
            payload: newSettings
        });
    } catch (error) {
        console.error('❌ Failed to update captions overlay:', error);
    }

    // Note: Bidirectional mode does NOT use microphone - it only captures game/system audio
    // The microphone check has been removed as it's not relevant for bidirectional mode

    // Ensure voice (skip if captions-only mode is enabled)
    const elements = getBidirectionalDOMElements();
    if (!isCaptionsOnlyMode) {
        if (!incomingVoiceId && elements.incomingVoiceSelect && elements.incomingVoiceSelect.value) {
            setIncomingVoiceId(elements.incomingVoiceSelect.value);
        }
        if (!incomingVoiceId) {
            alert('Please select an incoming voice or enable captions-only mode in caption settings');
            return;
        }
    } else {
        console.log('📝 Captions-only mode enabled - skipping voice validation');
    }

    // Check if VB-Cable is configured and provide monitoring reminder
    if (bidirectionalOutputDeviceId) {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const outputDevice = devices.find(d => d.deviceId === bidirectionalOutputDeviceId && d.kind === 'audiooutput');
        if (outputDevice) {
            const label = (outputDevice.label || '').toLowerCase();
            const isVBCable = label.includes('cable input') || label.includes('vb-audio cable');
            if (isVBCable) {
                logToDebug?.('🎯 VB-Audio Cable detected for bidirectional output');
                logToDebug?.('📢 REMINDER: Enable "Listen to this device" in Windows Sound Settings if you want to hear the TTS');
                logToDebug?.(`   → Right-click volume icon → Sounds → Playback tab → ${outputDevice.label} → Properties → Listen tab → Check "Listen to this device"`);
            }
        }
    }

    // BIDIRECTIONAL MODE: Only capture game/system audio, NEVER user microphone
    // This allows user to use push-to-talk for their own speech while game audio is translated in background
    console.log('🎮 BIDIRECTIONAL MODE: Capturing ONLY game/system audio (no microphone)');
    console.log('🔍 DEBUG: bidirectionalUseDisplayAudio =', bidirectionalUseDisplayAudio);
    console.log('🔍 DEBUG: bidirectionalInputDeviceId =', bidirectionalInputDeviceId);

    // macOS-specific: Use CoreAudio loopback to capture from default output (like WASAPI on Windows)
    // TTS will go to BlackHole output so user hears both: system audio (default) + TTS (BlackHole)
    const isMacOS = (window as any).electronAPI?.platform === 'darwin' || 
                    (typeof process !== 'undefined' && process.platform === 'darwin');
    
    if (isMacOS) {
        console.log('🍎 macOS detected - will use CoreAudio loopback (no system output change needed)');
        logToDebug?.('🍎 macOS: Using CoreAudio loopback capture (system audio stays on default output)');
        
        // Find BlackHole output device for TTS playback
        // User will hear: system audio from default output + TTS from BlackHole output
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const blackHoleOutput = devices.find(d => {
                const label = d.label.toLowerCase();
                return d.kind === 'audiooutput' && 
                       (label.includes('blackhole') || label.includes('black hole'));
            });
            
            if (blackHoleOutput) {
                setMacosRealOutputDeviceId(blackHoleOutput.deviceId);
                console.log('✅ Found BlackHole output device for TTS:', blackHoleOutput.label);
                logToDebug?.('✅ macOS: TTS will route to BlackHole output (NOT captured, user must route BlackHole to speakers)');
                logToDebug?.('💡 To hear TTS: System Settings → Sound → Output → Select BlackHole, OR create Multi-Output Device');
            } else {
                console.warn('⚠️ BlackHole output device not found - TTS will use default output (will be captured!)');
                logToDebug?.('⚠️ macOS: BlackHole not found - TTS will be captured and cause echo. Install BlackHole!');
            }
        } catch (error) {
            console.warn('⚠️ Could not find BlackHole output device:', error);
        }
    }

    try {
        // Always set bidiAudioStream to null - we don't want user microphone in bidirectional mode
        setBidiAudioStream(null);

        if (bidirectionalUseDisplayAudio) {
            console.log('🎛️ Input set to Display/System Audio (game audio only)');
        } else if (bidirectionalInputDeviceId) {
            // Even if a device is selected, in bidirectional mode we assume it's a system audio device (like VB-Cable)
            // not a microphone, so we still capture it
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    deviceId: { exact: bidirectionalInputDeviceId },
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false,
                    sampleRate: 44100,
                    channelCount: 2
                }
            });
            setBidiAudioStream(stream);
            console.log('✅ Using selected system audio device (VB-Cable/system output) for bidirectional');
            try {
                const tracks = stream.getAudioTracks();
                const t = tracks[0];
                console.log('🎧 System audio track info:', {
                    selectedDeviceId: bidirectionalInputDeviceId,
                    trackLabel: t?.label,
                    settings: t?.getSettings ? t.getSettings() : undefined,
                    constraints: t?.getConstraints ? t.getConstraints() : undefined,
                    muted: (t as any)?.muted,
                    readyState: t?.readyState
                });
                if (t) {
                    t.addEventListener('mute', () => console.warn('⚠️ System audio track muted'));
                    t.addEventListener('unmute', () => console.log('🔊 System audio track unmuted'));
                    t.addEventListener('ended', () => console.warn('⚠️ System audio track ended'));
                }
            } catch { }
        } else {
            console.log('🎛️ No system audio device selected - will rely on desktop capture only');
        }
        // If user selected Display/System Audio, capture it (shows overlay to pick screen/app)
        if (bidirectionalUseDisplayAudio) {
            console.log('🖥️ Starting display audio capture...');
            console.log('🔍 DEBUG: About to call requestDisplayAudioWithOverlay()');
            try {
                if (!requestDisplayAudioWithOverlay) throw new Error('requestDisplayAudioWithOverlay not available');
                const desktopResult = await requestDisplayAudioWithOverlay();
                setBidiDesktopStream(desktopResult.stream);
                console.log('✅ Using desktop audio capture for system output');
                console.log('🔍 DEBUG: bidiDesktopStream tracks:', bidiDesktopStream?.getAudioTracks()?.length || 0);
                console.log('🔍 DEBUG: bidiDesktopStream id:', bidiDesktopStream?.id);

                // macOS: No passthrough needed - system audio is already playing to real speakers
                // We're using CoreAudio loopback which captures from the output device without changing it
                // Windows: Disable desktop audio passthrough - we only want to hear translated TTS
                if (!isMacOS) {
                    console.log('🚫 Skipping desktop audio passthrough to avoid replaying source audio');
                } else {
                    console.log('🍎 macOS: System audio already playing to real speakers (no passthrough needed)');
                }

                // Note: Do NOT start system-wide WASAPI capture here to avoid renderer instability
            } catch (deskErr) {
                console.warn('⚠️ Desktop audio capture not available or denied:', deskErr);
                // Offer automatic fallback to VB-CABLE input if available
                if (fallbackToVBCableIfAvailable) {
                    await fallbackToVBCableIfAvailable(bidirectionalInputDeviceId);
                }
            }
        }
    } catch (e) {
        console.warn('⚠️ Desktop audio failed in bidirectional mode:', e);
        // In bidirectional mode, we DO NOT fall back to microphone
        // The user should use push-to-talk for their own speech
        console.log('🚫 NOT falling back to microphone in bidirectional mode - use push-to-talk for your speech');
    }
    if (!bidiAudioStream && !bidiDesktopStream) {
        throw new Error('Failed to get any audio stream for Bidirectional');
    }

    // Mix available streams - in bidirectional mode, this should ONLY be game/system audio
    const mixerCtx = new AudioContext();
    setBidiMixerCtx(mixerCtx);
    const sources: MediaStreamAudioSourceNode[] = [];
    const gains: GainNode[] = [];
    const mixerDest = mixerCtx.createMediaStreamDestination();
    setBidiMixerDestination(mixerDest);
    
    const connectStream = (stream: MediaStream, label: string, gainValue = 1.0) => {
        const src = mixerCtx.createMediaStreamSource(stream);
        const g = mixerCtx.createGain();
        g.gain.value = gainValue; // Pass through at full volume for analysis
        src.connect(g).connect(mixerDest);
        sources.push(src);
        gains.push(g);
        console.log(`🧩 Mixed in stream: ${label}`);
    };

    // In bidirectional mode, we should only have system/game audio streams
    if (bidiAudioStream) {
        console.log('🎮 Adding system audio device stream (VB-Cable/system output)');
        connectStream(bidiAudioStream, 'system-device', 1.0);
    }
    if (bidiDesktopStream) {
        console.log('🖥️ Adding desktop/WASAPI stream (game audio)');
        connectStream(bidiDesktopStream, 'desktop-game', 1.0);
    }

    if (!bidiAudioStream && !bidiDesktopStream) {
        throw new Error('No game/system audio streams available for bidirectional mode. Please select Display/System Audio or configure VB-Cable.');
    }

    setBidiMixedStream(mixerDest.stream);
    console.log('🎯 BIDIRECTIONAL AUDIO SETUP COMPLETE - Listening to game audio only (no microphone)');

    const audioStream = bidiMixedStream as MediaStream;

    logToDebug?.('🔁 Starting Bidirectional: initializing audio capture and VAD...');
    try { await (window as any).electronAPI.invoke('bidirectional:state', { id: Date.now().toString(), timestamp: Date.now(), payload: { action: 'start' } }); } catch { }
    // VAD setup with audio enhancement (noise removal + gain boost for whispers)
    let analyzerCtx: AudioContext;
    try {
        // Use default sample rate for broad compatibility
        analyzerCtx = new AudioContext();
        setBidiAnalyzerCtx(analyzerCtx);
    } catch (e) {
        logToDebug?.('❌ Failed to create AudioContext for Bidirectional');
        throw e;
    }
    const sourceNode = analyzerCtx.createMediaStreamSource(audioStream);
    setBidiSourceNode(sourceNode);
    
    // Create audio enhancement pipeline with mild filtering
    // Main adaptive gain is applied to WASAPI PCM in renderer.ts feedWasapiPcmToWorklet()
    const enhancementNodes = createAudioEnhancement(analyzerCtx, sourceNode, 1.0);
    setBidiEnhancementNodes(enhancementNodes);
    
    // Create analyzer node for VAD (connected after enhancement)
    const analyzerNode = analyzerCtx.createAnalyser();
    setBidiAnalyzerNode(analyzerNode);
    analyzerNode.fftSize = 2048;
    analyzerNode.smoothingTimeConstant = 0.3;
    
    // Connect: source -> enhancement -> analyzer
    enhancementNodes.outputNode.connect(analyzerNode);
    console.log('🧪 Analyser configured:', {
        fftSize: analyzerNode.fftSize,
        smoothingTimeConstant: analyzerNode.smoothingTimeConstant
    });
    // Begin short auto-calibration window to set a sensible threshold for VB-Cable/system input
    setBidiCalibrating(true);
    setBidiCalibSamples(0);
    setBidiCalibAccum(0);
    setBidiBaseline(0);
    setBidiConsecutiveActiveFrames(0);
    setBidiStartTs(Date.now());

    console.log('🔊 Audio analysis setup complete:', {
        contextState: analyzerCtx.state,
        sampleRate: analyzerCtx.sampleRate,
        fftSize: analyzerNode.fftSize,
        streamTracks: audioStream.getTracks().length
    });
    
    // Show bidirectional audio level overlay (audio levels sent from main process WASAPI handler)
    if (!bidirectionalOverlay) {
        bidirectionalOverlay = new BidirectionalOverlay();
    }
    bidirectionalOverlay.show();
    console.log('📊 Bidirectional audio level overlay shown');
    
    setBidiLastVoiceTs(Date.now());
    console.log('🔄 Starting VAD interval with enhanced whisper detection...');
    
    // Helper function to detect voice frequencies (300-3400 Hz typical for speech)
    const detectVoiceFrequencies = (analyzerNode: AnalyserNode, sampleRate: number): boolean => {
        const frequencyData = new Uint8Array(analyzerNode.frequencyBinCount);
        analyzerNode.getByteFrequencyData(frequencyData);
        
        // Voice frequency range: 300-3400 Hz (fundamental + formants)
        const voiceMinBin = Math.floor((300 / sampleRate) * analyzerNode.fftSize);
        const voiceMaxBin = Math.floor((3400 / sampleRate) * analyzerNode.fftSize);
        
        // Calculate energy in voice frequency range
        let voiceEnergy = 0;
        let totalEnergy = 0;
        
        for (let i = 0; i < frequencyData.length; i++) {
            const magnitude = frequencyData[i] / 255.0;
            totalEnergy += magnitude;
            if (i >= voiceMinBin && i <= voiceMaxBin) {
                voiceEnergy += magnitude;
            }
        }
        
        // Voice is present if voice frequencies have significant energy relative to total
        const voiceRatio = totalEnergy > 0 ? voiceEnergy / totalEnergy : 0;
        // Very permissive - just check if there's ANY significant voice frequency content
        return voiceRatio > 0.15 || voiceEnergy > 0.001;
    };
    
    setBidiVadInterval(window.setInterval(() => {
        if (!bidiAnalyzerNode) {
            console.log('❌ VAD: analyzer node not available');
            return;
        }
        try {
            const buf = new Uint8Array(bidiAnalyzerNode.fftSize);
            bidiAnalyzerNode.getByteTimeDomainData(buf);
            // Compute normalized stats
            let sum = 0;
            let sumSq = 0;
            let minNorm = Infinity;
            let maxNorm = -Infinity;
            let min8 = 255, max8 = 0;
            for (let i = 0; i < buf.length; i++) {
                const b = buf[i];
                const val = (b - 128) / 128;
                sum += Math.abs(val);
                sumSq += val * val;
                if (val < minNorm) minNorm = val;
                if (val > maxNorm) maxNorm = val;
                if (b < min8) min8 = b;
                if (b > max8) max8 = b;
            }
            const vol = sum / buf.length;
            const rms = Math.sqrt(sumSq / buf.length);
            const peak = Math.max(Math.abs(minNorm), Math.abs(maxNorm));

            // Use a fixed very low threshold - no auto-calibration
            // Auto-calibration was causing issues by setting threshold too high
            if (bidiCalibrating) {
                setBidiCalibAccum(bidiCalibAccum + vol);
                setBidiCalibSamples(bidiCalibSamples + 1);
                if (bidiCalibSamples >= 10) { // ~2 seconds at 200ms interval
                    const baseline = bidiCalibAccum / bidiCalibSamples;
                    // FIXED threshold - very low to catch quiet voices
                    // Don't base it on baseline, just use a fixed low value
                    const FIXED_LOW_THRESHOLD = 0.0005; // Fixed low threshold for quiet voice detection
                    setBidiVadThreshold(FIXED_LOW_THRESHOLD);
                    setBidiCalibrating(false);
                    setBidiBaseline(baseline);
                    console.log(`🛠️ VAD: Using FIXED threshold=${FIXED_LOW_THRESHOLD} (baseline was ${baseline.toFixed(5)})`);
                }
                // During calibration, do not attempt any probe or section logic
                return;
            }
            
            // Enhanced voice detection: check both amplitude AND voice frequencies
            // This helps distinguish whispers from background noise
            const sampleRate = bidiAnalyzerCtx?.sampleRate || 44100;
            const hasVoiceFreq = detectVoiceFrequencies(bidiAnalyzerNode, sampleRate);
            const hasVolume = vol > bidiVadThreshold;
            
            // Voice is active if we have volume AND voice frequencies (or very high volume as fallback)
            const voiceActive = (hasVolume && hasVoiceFreq) || (vol > bidiVadThreshold * 2.0);

            // Always log volume every few cycles to confirm VAD is working
            if (Math.random() < 0.15) { // ~15% of the time
                const isSilence = (max8 - min8) <= 3; // Very narrow range indicates silence
                console.log(`🎤 Audio level: ${vol.toFixed(4)} (rms: ${rms.toFixed(4)}, peak: ${peak.toFixed(4)}, threshold: ${bidiVadThreshold.toFixed(4)}, voiceFreq: ${hasVoiceFreq}, active: ${voiceActive}, bufLen: ${buf.length}, raw8:min=${min8} max=${max8}${isSilence ? ' [SILENCE DETECTED]' : ''})`);

                if (isSilence && Math.random() < 0.05) { // Occasionally remind about routing
                    const isMacOS = (window as any).electronAPI?.platform === 'darwin' || 
                                   (typeof process !== 'undefined' && process.platform === 'darwin');
                    if (isMacOS) {
                        console.warn('⚠️ TROUBLESHOOTING: Capturing silence from system audio. Ensure:');
                        console.warn('   1. An app (YouTube, game, etc.) is playing audio to your default output device');
                        console.warn('   2. That app is actually playing audio right now');
                        console.warn('   3. System audio is not muted');
                        console.warn('   4. CoreAudio loopback capture is working (check main process logs)');
                    } else {
                        console.warn('⚠️ TROUBLESHOOTING: Capturing silence from VB-CABLE. Ensure:');
                        console.warn('   1. An app (YouTube, game, etc.) is outputting to "CABLE Input (VB-Audio Virtual Cable)"');
                        console.warn('   2. That app is actually playing audio right now');
                        console.warn('   3. VB-CABLE driver is properly installed and not muted');
                    }
                }
            }

            if (voiceActive) {
                console.log(`🎯 Voice detected! Level: ${vol.toFixed(4)}, VoiceFreq: ${hasVoiceFreq}`);
            }
            if (voiceActive) {
                setBidiConsecutiveActiveFrames(bidiConsecutiveActiveFrames + 1);
                setBidiLastVoiceTs(Date.now());
            } else {
                setBidiConsecutiveActiveFrames(0);
            }
            setBidiInSpeech(voiceActive);
            const silenceMs = Date.now() - bidiLastVoiceTs;
            // On speech onset, schedule a language probe if no section and not blocked
            if (voiceActive && bidiConsecutiveActiveFrames >= 3 && !bidiSectionActive && !bidiSectionBlocked && !bidiNeedsProbe) {
                console.log('🎯 Setting probe flag - speech detected');
                try {
                    (window as any).electronAPI.invoke('bidirectional:log', {
                        id: Date.now().toString(),
                        timestamp: Date.now(),
                        payload: { level: 'info', message: 'VAD triggered - probe needed', data: { volume: vol.toFixed(4) } }
                    });
                } catch { }
                setBidiNeedsProbe(true);
                setBidiLastProbeAttemptTs(Date.now());
            }
            // On sustained silence, finalize section or clear block
            if (!voiceActive && silenceMs > 800) {
                if (bidiSectionActive) {
                    finalizeBidirectionalSection().catch(() => { });
                } else if (bidiSectionBlocked) {
                    setBidiSectionBlocked(false); // allow probing on next speech
                }
            }
            // If no probe has been attempted for a while but we're receiving audio, force a probe soon
            if (!bidiSectionActive && !bidiSectionBlocked && !bidiNeedsProbe) {
                const now = Date.now();
                const recentlyStarted = (now - bidiStartTs) < 2000;
                const belowFloor = vol <= Math.max(bidiVadThreshold * 0.9, bidiBaseline * 1.1);
                const isSilence = (max8 - min8) <= 3; // Don't probe pure silence

                if (!recentlyStarted && !isSilence && (now - bidiLastProbeAttemptTs > 3000)) {
                    if (!belowFloor) {
                        setBidiNeedsProbe(true);
                        console.log('⏱️ Forcing probe due to activity without probe');
                    } else if (now - bidiStartTs > 7000) {
                        // Even if below floor, force a probe after sustained input period (but not if silence)
                        setBidiNeedsProbe(true);
                        console.log('⏱️ Forcing probe due to sustained low-level input');
                    }
                }
            }
        } catch (e) {
            console.warn('❌ VAD error:', e);
            // analyzer may throw if context is closed; stop interval
            if (bidiVadInterval) {
                clearInterval(bidiVadInterval);
                setBidiVadInterval(null);
            }
        }
    }, 200)); // 5 Hz - slower for more stable detection

    // If a process is selected, use WASAPI per-process capture instead of screen capture
    if (selectedProcessName) {
        console.log(`🎙️ Starting WASAPI capture for process: ${selectedProcessName}`);
        try {
            await (window as any).electronAPI.stopPerAppCapture();
            const result = await (window as any).electronAPI.startCaptureByProcess(selectedProcessName);
            if (!result || result.success !== true) {
                throw new Error(result?.error || 'Failed to start process capture');
            }
            console.log(`✅ WASAPI capture started for ${selectedProcessName} (all instances)`);
            setBidiUseWasapiWav(true);
            setBidiMimeType('audio/wav');
            // Don't use PCM capture when using WASAPI process capture
            setBidiRecorder(null);
        } catch (error) {
            console.error(`❌ Failed to start WASAPI capture for ${selectedProcessName}:`, error);
            throw error;
        }
    } else {
        // Fallback to screen capture if no process selected
        const useWasapiWav = bidirectionalUseDisplayAudio && bidiDesktopStream;
        await startPcmCapture(audioStream);
        if (useWasapiWav) {
            console.log('🎙️ Using screen capture with WASAPI-style processing (raw PCM)');
            setBidiUseWasapiWav(true);
            setBidiMimeType('audio/wav');
        } else {
            console.log('🎙️ Using raw PCM capture for audio');
            setBidiUseWasapiWav(false);
        }
        // Disable MediaRecorder to avoid WebM/Opus encoding issues
        setBidiRecorder(null);
        // Raw PCM capture active - MediaRecorder disabled
        console.log('🎙️ Raw PCM capture active - MediaRecorder disabled');
    }
    
    // Initialize Bidirectional TTS Processor
    try {
        setBidirectionalTTSProcessor(new BidirectionalTTSProcessor((window as any).electronAPI));
        
        // Set up UI update callback
        bidirectionalTTSProcessor.setUIUpdateCallback((stats: { queued: number; processing: number; ready: number; playing: number }) => {
            updateBidirectionalUI();
        });
        
        // Set up chunk complete callback
        bidirectionalTTSProcessor.setChunkCompleteCallback((chunk: any) => {
            console.log(`[Bidi] Chunk ${chunk.id} completed: ${chunk.status}`);
            updateBidirectionalUI();
        });
        
        // Set up playback handler to use playAudioToDevice with sink routing
        // macOS: TTS plays to default output ONLY (CoreAudio tap filters out our PID from capture)
        //        - User hears TTS from default output (volume keys work normally)
        //        - CoreAudio tap inspects metadata and excludes buffers from our PID
        //        - No BlackHole routing needed - tap sees individual app streams before mixing
        // Windows: TTS goes to VB-Cable output (user enables "Listen to this device" to hear it)
        bidirectionalTTSProcessor.setPlaybackHandler(async (audioData: number[], sinkId?: string, text?: string) => {
            // Caption is already shown during translation phase (in BidirectionalProcessor)
            // Just play the audio here
            if (playAudioToDevice) {
                // On macOS, play TTS to default output ONLY
                // CoreAudio tap will filter out our PID from capture, so TTS won't be captured
                if (isMacOS) {
                    console.log('🍎 macOS: Playing TTS to default output (CoreAudio tap filters out our PID from capture)');
                    
                    // Play to default output - CoreAudio tap will exclude our PID
                    await playAudioToDevice(audioData, undefined); // undefined = default output
                } else {
                    // Windows: Use normal routing
                    const finalSinkId = sinkId || bidirectionalOutputDeviceId || undefined;
                    await playAudioToDevice(audioData, finalSinkId);
                }
            }
        });

        setBidiLastTranscription(''); // Reset deduplication state
        setBidiLastAudioChunkTime(0); // Reset pause tracking

        // Initialize Translation Context Manager for coherent translations
        setBidirectionalContextManager(new TranslationContextManager({
            enabled: true,
            maxChunks: 3,
            maxTokens: 60,
            includeSource: false,
            resetOnLanguageChange: true
        }));
        console.log('[Bidi] Translation context manager initialized');

        // Initialize processor module with DOM elements and accent state
        const domElements = getBidirectionalDOMElements();
        initializeProcessorModule(
            domElements.bidirectionalStatusText,
            domElements.bidirectionalDetectedText,
            domElements.bidirectionalRespokenText,
            {
                enabled: getAccentEnabled ? getAccentEnabled() : false,
                selected: '', // TODO: Need to inject selectedAccent getter
                customValue: '' // TODO: Need to inject customAccentValue getter
            }
        );
        console.log('[Bidi] Processor module initialized with DOM elements');

        console.log('✅ Bidirectional TTS Processor initialized with 1-second chunks, 200ms overlap, auto-flush, and deduplication');
    } catch (error) {
        console.error('❌ Failed to initialize Bidirectional TTS Processor:', error);
        throw error;
    }

    setIsBidirectionalActive(true);
    setBidirectionalStatus(true);

    // Notify mini-overlay about bidirectional state change
    console.log('[Main Renderer] Sending bidirectional state change (started) to mini-overlay');
    (window as any).electronAPI?.invoke?.('mini-overlay:voice-translation', { isActive: true });
    console.log('👂 Bidirectional is listening for target language speech...');
    try { await (window as any).electronAPI.invoke('bidirectional:log', { id: Date.now().toString(), timestamp: Date.now(), payload: { level: 'info', message: 'Listening', data: { targetLanguage: getBidirectionalTargetLanguage() } } }); } catch { }

    // Start timer to show mini overlay after 30 seconds
    if (bidirectionalMiniOverlayTimer) {
        clearTimeout(bidirectionalMiniOverlayTimer);
    }
    setBidirectionalMiniOverlayTimer(setTimeout(async () => {
        console.log('⏰ Bidirectional running for 10+ seconds - auto-showing mini overlay');
        try {
            await (window as any).electronAPI?.invoke?.('overlay:show-minimal', {
                id: Date.now().toString(),
                timestamp: Date.now(),
                payload: null
            });
            setBidirectionalAutoOpenedOverlay(true); // Mark that we auto-opened it
            console.log('✅ Mini overlay auto-opened by bidirectional');
        } catch (error) {
            console.error('Failed to show mini overlay:', error);
        }
    }, 10000)); // 10 seconds
}

/**
 * Stop bidirectional translation mode
 */
export async function stopBidirectional(): Promise<void> {
    setIsBidirectionalActive(false);
    setBidirectionalStatus(false);

    // Hide bidirectional audio level overlay
    if (bidirectionalOverlay) {
        bidirectionalOverlay.hide();
        console.log('📊 Bidirectional audio level overlay hidden');
    }

    // Clear mini overlay timer if it exists
    if (bidirectionalMiniOverlayTimer) {
        clearTimeout(bidirectionalMiniOverlayTimer);
        setBidirectionalMiniOverlayTimer(null);
    }

    // Close mini overlay if it was auto-opened by bidirectional
    if (bidirectionalAutoOpenedOverlay) {
        console.log('🔽 Closing auto-opened mini overlay');
        try {
            await (window as any).electronAPI?.invoke?.('overlay:hide-minimal', {
                id: Date.now().toString(),
                timestamp: Date.now(),
                payload: null
            });
        } catch (error) {
            console.error('Failed to hide mini overlay:', error);
        }
        setBidirectionalAutoOpenedOverlay(false); // Reset flag
    }

    // Notify mini-overlay about bidirectional state change
    console.log('[Main Renderer] Sending bidirectional state change (stopped) to mini-overlay');
    (window as any).electronAPI?.invoke?.('mini-overlay:voice-translation', { isActive: false });
    // Clear captions overlay
    await clearCaptions();
    try {
        if (bidiRecorder && bidiRecorder.state !== 'inactive') bidiRecorder.stop();
    } catch { }
    setBidiRecorder(null);
    // Stop raw PCM capture
    await stopPcmCapture();

    // Stop WASAPI capture if it's running (Windows) or screen capture (macOS)
    try {
        if (navigator.platform.includes('Mac')) {
            // @ts-ignore - defined in renderer.ts
            if (typeof stopMacOSScreenCaptureAudio === 'function') {
                // @ts-ignore
                stopMacOSScreenCaptureAudio();
                console.log('✅ macOS screen capture audio stopped');
            }
        } else {
            await (window as any).electronAPI.stopPerAppCapture();
            console.log('✅ WASAPI capture stopped');
        }
    } catch (error) {
        console.error('❌ Error stopping WASAPI capture:', error);
    }

    // Clean up WASAPI audio context and worklet
    try {
        if (wasapiWorkletNode) {
            wasapiWorkletNode.disconnect();
            setWasapiWorkletNode(null);
        }
        if (wasapiDest) {
            wasapiDest.disconnect();
            setWasapiDest(null);
        }
        if (wasapiCtx && wasapiCtx.state !== 'closed') {
            await wasapiCtx.close();
        }
        setWasapiCtx(null);
        setWasapiPcmQueue([]);
        console.log('✅ WASAPI audio context cleaned up');
    } catch (error) {
        console.error('❌ Error cleaning up WASAPI audio context:', error);
    }

    // Note: We don't stop the main mic passthrough here since bidirectional mode
    // doesn't interfere with it - it only captures game/system audio
    try {
        if (bidiAudioStream) {
            bidiAudioStream.getTracks().forEach(t => t.stop());
        }
    } catch { }
    setBidiAudioStream(null);
    if (bidiVadInterval) {
        clearInterval(bidiVadInterval);
        setBidiVadInterval(null);
    }
    // Clean up enhancement nodes
    try {
        if (bidiEnhancementNodes) {
            bidiEnhancementNodes.highpassFilter.disconnect();
            bidiEnhancementNodes.lowpassFilter.disconnect();
            bidiEnhancementNodes.compressor.disconnect();
            bidiEnhancementNodes.gainNode.disconnect();
            bidiEnhancementNodes.makeupGainNode?.disconnect();
            bidiEnhancementNodes.limiter?.disconnect();
            bidiEnhancementNodes.outputNode.disconnect?.();
        }
    } catch (error) {
        console.warn('⚠️ Error disconnecting enhancement nodes:', error);
    }
    setBidiEnhancementNodes(null);
    
    try {
        if (bidiAnalyzerCtx && bidiAnalyzerCtx.state !== 'closed') await bidiAnalyzerCtx.close();
    } catch { }
    setBidiAnalyzerCtx(null);
    setBidiAnalyzerNode(null);
    setBidiSourceNode(null);
    setPendingFinalize(false);
    setBidiSectionActive(false);
    setBidiCurrentBlobs([]);
    // Reset playback queue to avoid stale items
    setBidiPlaybackQueue([]);
    setBidiIsPlayingTts(false);
    
    // Stop WASAPI capture if using process capture
    if (selectedProcessName) {
        try {
            await (window as any).electronAPI.stopPerAppCapture();
            console.log('✅ WASAPI process capture stopped');
        } catch (error) {
            console.warn('[Bidi] Failed to stop WASAPI capture:', error);
        }
    }
    
    // Stop and cleanup Bidirectional TTS Processor
    if (bidirectionalTTSProcessor) {
        bidirectionalTTSProcessor.stop();
        setBidirectionalTTSProcessor(null);
        console.log('✅ Bidirectional TTS Processor stopped');
    }

    // Clear translation context manager
    if (bidirectionalContextManager) {
        bidirectionalContextManager.clearContext();
        setBidirectionalContextManager(null);
        console.log('✅ Translation context manager cleared');
    }

    // Clear chunk queue and deduplication state
    setBidiChunkQueue([]);
    setIsProcessingBidiChunk(false);
    setBidiLastTranscription('');
    setBidiLastAudioChunkTime(0); // Reset pause tracking
    
    // macOS: No need to restore system output - we never changed it
    // We use CoreAudio loopback which captures without changing the output device
    
    // Clean up desktop stream
    try {
        if (bidiDesktopStream) {
            bidiDesktopStream.getTracks().forEach(t => t.stop());
        }
    } catch (error) {
        console.error('❌ Error stopping desktop stream:', error);
    }
    setBidiDesktopStream(null);
    
    // Clean up mixer context
    try {
        if (bidiMixerCtx && bidiMixerCtx.state !== 'closed') {
            await bidiMixerCtx.close();
        }
    } catch (error) {
        console.error('❌ Error closing mixer context:', error);
    }
    setBidiMixerCtx(null);
    setBidiMixerDestination(null);
    setBidiMixedStream(null);
    
    // Reset VAD state
    setBidiCalibrating(false);
    setBidiCalibSamples(0);
    setBidiCalibAccum(0);
    setBidiBaseline(0);
    setBidiConsecutiveActiveFrames(0);
    setBidiInSpeech(false);
    setBidiLastVoiceTs(0);
    setBidiNeedsProbe(false);
    setBidiLastProbeAttemptTs(0);
    setBidiSectionBlocked(false);
    
    // Reset macOS state
    setMacosRealOutputDeviceId(null);
    
    // Reset processing flags
    setBidiProcessing(false);
    setBidiUseWasapiWav(false);
    setBidiMimeType('audio/wav');
    setBidiStartTs(0);
    
    logToDebug?.('Bidirectional stopped');
    try { await (window as any).electronAPI.invoke('bidirectional:state', { id: Date.now().toString(), timestamp: Date.now(), payload: { action: 'stop' } }); } catch { }
}

/**
 * Finalize bidirectional section
 */
export async function finalizeBidirectionalSection(): Promise<void> {
    if (!bidiSectionActive || bidiProcessing) return;
    setBidiProcessing(true);
    setPendingFinalize(false);
    try {
        // Combine blobs
        const combined = new Blob(bidiCurrentBlobs, { type: bidiMimeType });
        // Convert to WAV for best Whisper compatibility
        const wavBlob = await float32ToWavBlob([], 16000); // TODO: Need proper implementation
        const arrBuf = await wavBlob.arrayBuffer();
        const audioData = Array.from(new Uint8Array(arrBuf));
        const selectedLanguage = getBidirectionalSourceLanguage();
        const targetLanguage = getBidirectionalTargetLanguage();
        const resp = await (window as any).electronAPI.invoke('speech:transcribe', {
            id: Date.now().toString(), timestamp: Date.now(), payload: { audioData, language: selectedLanguage, targetLanguage: targetLanguage, contentType: 'audio/wav' }
        });
        if (resp.success) {
            const text = (resp.payload.text || '').trim();
            const detectedLang = String(resp.payload.language || '').toLowerCase();
            try { await (window as any).electronAPI.invoke('bidirectional:log', { id: Date.now().toString(), timestamp: Date.now(), payload: { level: 'info', message: 'Final section transcribed', data: { len: text.length } } }); } catch { }
            const domElements = getBidirectionalDOMElements();
            if (domElements.bidirectionalDetectedText) {
                domElements.bidirectionalDetectedText.textContent = text ? text : 'No speech detected';
                domElements.bidirectionalDetectedText.classList.toggle('empty', !text);
            }
            if (text && incomingVoiceId) {
                // Synthesize in incoming voice and play via selected sink
                const processedText = applyAccentTag ? applyAccentTag(text) : text;
                const ttsPayload: any = {
                    text: processedText,
                    voiceId: incomingVoiceId
                };
                // Force ElevenLabs v3 model when accent is enabled
                if (getAccentEnabled && getAccentEnabled()) {
                    ttsPayload.modelId = 'eleven_v3';
                }
                const tts = await (window as any).electronAPI.invoke('tts:synthesize', {
                    id: Date.now().toString(),
                    timestamp: Date.now(),
                    payload: ttsPayload
                });
                if (tts.success && tts.payload?.audioBuffer) {
                    try { await (window as any).electronAPI.invoke('bidirectional:log', { id: Date.now().toString(), timestamp: Date.now(), payload: { level: 'info', message: 'TTS ready', data: { bytes: tts.payload.audioBuffer.length } } }); } catch { }
                    if (domElements.bidirectionalRespokenText) {
                        domElements.bidirectionalRespokenText.textContent = text;
                        domElements.bidirectionalRespokenText.classList.remove('empty');
                    }

                    // Update captions overlay
                    await updateCaptions(text);
                    if (playAudioToDevice) {
                        await playAudioToDevice(tts.payload.audioBuffer, bidirectionalOutputDeviceId || undefined);
                    }
                }
            } else {
                try { await (window as any).electronAPI.invoke('bidirectional:log', { id: Date.now().toString(), timestamp: Date.now(), payload: { level: 'warn', message: 'No text or voice for TTS' } }); } catch { }
            }
        } else {
            try { await (window as any).electronAPI.invoke('bidirectional:log', { id: Date.now().toString(), timestamp: Date.now(), payload: { level: 'warn', message: 'Final STT failed', data: { error: resp.error } } }); } catch { }
        }
    } catch (e) {
        // ignore
    } finally {
        // Reset for next section
        setBidiSectionActive(false);
        setBidiCurrentBlobs([]);
        setBidiProcessing(false);
    }
}