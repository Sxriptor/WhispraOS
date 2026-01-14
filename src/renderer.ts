// Renderer process entry point
console.log('Renderer process starting...');

// Import settings integration
import { mountInteractiveCharacter, type InteractiveCharacterHandle } from './components/ui/interactive-3d-character.js';
import { openSettings as openSettingsModal, SettingsIntegration } from './ui/settings/SettingsIntegration.js';
import { BidirectionalTTSProcessor } from './services/BidirectionalTTSProcessor.js';
import { StreamingAudioPlayer } from './services/StreamingAudioPlayer.js';
import { TranslationContextManager } from './services/TranslationContextManager.js';
import { initializeEventListeners } from './renderer/eventListeners.js';

import {
    getTranslatedButtonText,
    getTranslatedBidirectionalButtonText,
    updatePTTKeybindDisplay,
    updateBidirectionalKeybindDisplay,
    updateScreenTranslationKeybindDisplay,
    updateLabelText
} from './renderer/translationHelpers.js';
import { getTranslations } from './renderer/i18n.js';
import {
    showPTTKeybindModal as showWhispraPTTKeybindModal,
    showBidirectionalKeybindModal as showWhispraBidirectionalKeybindModal
} from './renderer/modals/TranslateKeybindModal.js';
import {
    initializeUpdateNotification,
    initializeUpdatePage,
    manualCheckForUpdates,
    manualDownloadUpdate,
    manualInstallUpdate,
    openReleaseNotes,
    openUpdateSettings,
    handleUpdateStatusChange
} from './renderer/updateNotification.js';
import {
    SoundboardManager,
    initializeSoundboardManager,
    setupSoundboardOverlayListeners,
    injectSoundboardCSS
} from './renderer/soundboard.js';

// Bidirectional imports
import {
    startBidirectional,
    stopBidirectional,
    finalizeBidirectionalSection,
    injectSharedFunctions,
    toggleBidirectional,
    initializeBidirectionalTab,
    updateSpeedSelectText
} from './renderer/bidirectional/BidirectionalControls.js';
import {
    initializeBidirectionalUI,
    updateUILanguage,
    getBidirectionalDOMElements
} from './renderer/bidirectional/BidirectionalUI.js';
import {
    processBidirectionalAudioChunk as processBidirectionalAudioChunkModule
} from './renderer/bidirectional/BidirectionalProcessor.js';
import { initializeQuickTranslatePanel } from './renderer/quicktrans/QuickTranslatePanel.js';
import { getModifierKeyName } from './utils/platformUtils-renderer.js';
import {
    getBidirectionalSourceLanguage as getBidirectionalSourceLanguageFromUI,
    getBidirectionalTargetLanguage as getBidirectionalTargetLanguageFromUI
} from './renderer/bidirectional/BidirectionalUI.js';

// Screen translation imports
import { setupPaddleWarmupToggle, setupWhispraScreenPaddleWarmupToggle } from './renderer/screentrans/PaddleWarmup.js';
import { setupMainGPUModeToggle, setupWhispraScreenGPUModeToggle } from './renderer/screentrans/PaddleGPU.js';
import {
    performScreenOCRDirect,
    triggerScreenTranslation,
    triggerScreenTranslationBoxSelect,
    updateScreenTranslationButton,
    updateScreenTranslationStats,
    showPythonCheckOverlay,
    updateScreenTranslationStatus,
    initializeOCRForCurrentLanguage,
    initializeOCRForLanguage,
    updateScreenTranslationConfig,
    handleScreenTranslationKeyDown,
    showScreenTranslationKeybindModal
} from './renderer/screentrans/PaddleTriggerConfig.js';
import { initializeScreenTranslationTab } from './renderer/screentrans/ScreenTranslationInit.js';
import './renderer/screentrans/LoadDisplays.js'; // Load display functions and expose to __screenTransCtx

import {
    isBidirectionalActive,
    setIncomingVoiceId,
    setBidirectionalOutputDeviceId,
    setBidirectionalSourceLanguage,
    setBidirectionalTargetLanguage,
    bidirectionalCaptionsEnabled,
    setBidirectionalCaptionsEnabled,
    setCaptionsSettings as setBidiCaptionsSettings,
    setSelectedProcessName as setBidiSelectedProcessName,
    setBidirectionalUseDisplayAudio,
    setBidirectionalInputDeviceId
} from './renderer/bidirectional/BidirectionalState.js';

// Configuration types - helper functions implemented inline to avoid import issues

// Extracted modals
import { showApiKeyModal } from './renderer/apiKeyModelFunction.js';
import { showAddVoiceModal } from './renderer/modals/AddVoiceModal.js';
import { 
    showCaptionsSettingsModal,
    toggleBidirectionalCaptions,
    updateBidirectionalCaptionsToggle,
    updateCaptions,
    clearCaptions,
    initializeCaptionsModule
} from './renderer/bidirectional/BidirectionalCaptions.js';
import { showKeybindModal } from './renderer/modals/KeybindModal.js';

// PTT Overlay
import { PTTOverlay } from './ui/PTTOverlay.js';
import type { PushToTalkTranscription } from './types/PushToTalkTranscription.js';

// Extracted audio functions
import { playAudioInRenderer as playAudioInRendererModule } from './renderer/audio/PlayAudioInRenderer.js';
import { restartPassthroughClean as restartPassthroughCleanModule } from './renderer/audio/RestartPassthroughClean.js';

// Extracted translation functions
import { toggleTranslation as toggleTranslationModule } from './renderer/translation/ToggleTranslation.js';
import { checkTranslationConfig } from './renderer/translation/checkTranslationConfig.js';

// Audio processing imports
import {
    initializeAudioProcessing,
    startRecording as startRecordingModule,
    stopRecording as stopRecordingModule,
    processAudioChunk as processAudioChunkModule,
    processTTSQueue as processTTSQueueModule,
    checkAudioLevel as checkAudioLevelModule,
    processRecordedAudio as processRecordedAudioModule,
    stopTTSProcessor
} from './renderer/audioProcessing.js';

// Audio passthrough imports
import {
    initializeAudioPassthrough,
    detectVirtualOutputDevice,
    startPassThrough,
    stopPassThrough,
    initializeAutomaticPassthrough,
    retryPassthroughOnInteraction,
    startPassthroughHealthCheck,
    stopPassthroughHealthCheck,
    setupDesktopAudioPassthrough,
    requestDisplayAudioWithOverlay,
    fallbackToVBCableIfAvailable
} from './renderer/audioPassVirtualDetect.js';

// Bidirectional state variables

// DOM elements
const startButton = document.getElementById('start-button') as HTMLButtonElement;
const refreshVoicesButton = document.getElementById('refresh-voices-button') as HTMLButtonElement;
const outputToggleButton = document.getElementById('output-toggle-button') as HTMLButtonElement;

// Live translation elements
const liveTranslationPanel = document.getElementById('live-translation-panel') as HTMLDivElement;
const currentKeybindSpan = document.getElementById('current-keybind') as HTMLSpanElement | null;
const translationKeybindDisplay = document.getElementById('translation-keybind-display') as HTMLElement | null;
const changeKeybindBtn = document.getElementById('change-keybind-btn') as HTMLButtonElement | null;
const recordingIndicator = document.getElementById('recording-indicator') as HTMLDivElement;
const recordingText = document.getElementById('recording-text') as HTMLSpanElement;
const originalTextDiv = document.getElementById('original-text') as HTMLDivElement;
const translatedTextDiv = document.getElementById('translated-text') as HTMLDivElement;

// Whispra Translate page keybind containers (clickable)
const whispraTranslatePTTKeybindContainer = document.getElementById('whispra-translate-ptt-keybind-container') as HTMLElement | null;
const whispraTranslateBidiKeybindContainer = document.getElementById('whispra-translate-bidi-keybind-container') as HTMLElement | null;

// Global variables for language system
let currentLanguage = 'en';
let languageToggle: HTMLSelectElement | null = null;

// Expose currentLanguage on window for other modules
(window as any).currentLanguage = currentLanguage;

const microphoneSelect = document.getElementById('microphone-select') as HTMLSelectElement;
const languageSelect = document.getElementById('language-select') as HTMLSelectElement;
const voiceSelect = document.getElementById('voice-select') as HTMLSelectElement;

// Accent controls
const accentPreset = document.getElementById('accent-preset') as HTMLSelectElement;
const customAccentText = document.getElementById('custom-accent-text') as HTMLInputElement;
const accentToggle = document.getElementById('accent-toggle') as HTMLButtonElement;
const accentSelectorGroup = accentPreset.closest('.control-group') as HTMLElement;
const debugToggle = document.getElementById('debug-toggle') as HTMLButtonElement | null;
const affiliateButton = document.getElementById('affiliate-button') as HTMLButtonElement | null;
const feedbackButton = document.getElementById('feedback-button') as HTMLButtonElement | null;

const debugConsole = document.getElementById('debug-console') as HTMLDivElement;
const debugOutput = document.getElementById('debug-output') as HTMLDivElement;
const connectionStatus = document.getElementById('connection-status') as HTMLSpanElement;
const processingStatus = document.getElementById('processing-status') as HTMLSpanElement;
const statusIndicator = document.getElementById('status-indicator') as HTMLElement;
// Sidebar elements
const sidebarToggleButton = document.getElementById('sidebar-toggle') as HTMLButtonElement | null;
const appSidebar = document.getElementById('app-sidebar') as HTMLDivElement | null;
const sidebarSettingsButton = document.getElementById('sidebar-settings-button') as HTMLButtonElement | null;
// Update tab removed; keep null to avoid ref errors if lingering HTML exists
const sidebarUpdateButton = null as unknown as HTMLButtonElement | null;
const sidebarTranslateButton = document.getElementById('sidebar-translate-button') as HTMLButtonElement | null;
const sidebarBidirectionalButton = document.getElementById('sidebar-bidirectional-button') as HTMLButtonElement | null;

// Pages
const translatePage = document.getElementById('translate-page') as HTMLDivElement | null;
const bidirectionalPanel = document.getElementById('bidirectional-panel') as HTMLDivElement | null;
// Update panel removed
const updatePanel = null as unknown as HTMLDivElement | null;

// Bidirectional elements
const bidirectionalToggleButton = document.getElementById('bidirectional-toggle-button') as HTMLButtonElement | null;
const bidirectionalStatusIndicator = document.getElementById('bidirectional-status-indicator') as HTMLElement | null;
const bidirectionalKeybindSpan = document.getElementById('bidirectional-current-keybind') as HTMLSpanElement | null;
const bidirectionalKeybindDisplay = document.getElementById('bidirectional-keybind-display') as HTMLElement | null;
const bidirectionalChangeKeybindBtn = document.getElementById('bidirectional-change-keybind-btn') as HTMLButtonElement | null;

const bidirectionalOutputSelect = document.getElementById('bidirectional-output-select') as HTMLSelectElement | null;
// bidirectionalInputSelect removed - now hardcoded to Display/System Audio
const DISPLAY_AUDIO_VALUE = '__DISPLAY_AUDIO__';
let bidirectionalUseDisplayAudio: boolean = false;
const bidirectionalProcessSelect = document.getElementById('bidirectional-process-select') as HTMLSelectElement | null;
const bidirectionalRefreshProcessesBtn = document.getElementById('bidirectional-refresh-processes') as HTMLButtonElement | null;
let selectedProcessName: string | null = null;
const incomingVoiceSelect = document.getElementById('incoming-voice-select') as HTMLSelectElement | null;
const bidirectionalSourceLanguageSelect = document.getElementById('bidirectional-source-language') as HTMLSelectElement | null;
const bidirectionalTargetLanguageSelect = document.getElementById('bidirectional-target-language') as HTMLSelectElement | null;
const bidirectionalRecordingDot = document.getElementById('bidirectional-recording-dot') as HTMLElement | null;
const bidirectionalCaptionsToggle = document.getElementById('bidirectional-captions-toggle') as HTMLButtonElement | null;
const bidirectionalCaptionsSettings = document.getElementById('bidirectional-captions-settings') as HTMLButtonElement | null;
const bidirectionalStatusText = document.getElementById('bidirectional-status') as HTMLSpanElement | null;
const bidirectionalDetectedText = document.getElementById('bidirectional-detected-text') as HTMLDivElement | null;
const bidirectionalRespokenText = document.getElementById('bidirectional-respoken-text') as HTMLDivElement | null;

// Screen Translation elements
const screenTranslationPanel = document.getElementById('screen-translation-panel') as HTMLDivElement | null;
const screenTranslationButton = document.getElementById('sidebar-screen-translation-button') as HTMLButtonElement | null;
const screenTranslationTriggerButton = document.getElementById('screen-translation-trigger-button') as HTMLButtonElement | null;
const screenTranslationStatusIndicator = document.getElementById('screen-translation-status-indicator') as HTMLElement | null;
const screenTranslationKeybindSpan = document.getElementById('screen-translation-current-keybind') as HTMLSpanElement | null;
const screenTranslationKeybindDisplay = document.getElementById('screen-translation-keybind-display') as HTMLElement | null;
const screenTranslationChangeKeybindBtn = document.getElementById('screen-translation-change-keybind-btn') as HTMLButtonElement | null;
const screenTranslationTargetLang = document.getElementById('screen-translation-target-lang') as HTMLSelectElement | null;
const screenTranslationSourceLang = document.getElementById('screen-translation-source-lang') as HTMLSelectElement | null;
let isInitializingScreenTranslation = false; // Flag to prevent saving during initialization
let isInitializingTranslatePage = false; // Flag to prevent saving during translate page initialization
let isInitializingBidirectional = false; // Flag to prevent saving during bidirectional initialization

// Flags to prevent circular updates between bidirectional and whispra translate language selectors
let isUpdatingFromBidirectional = false;
let isUpdatingFromWhispra = false;
let isSyncingWhispraScreenLanguages = false;
let hasInitializedWhispraScreenLanguageSync = false;

let interactiveCharacterHandle: InteractiveCharacterHandle | null = null;

// Sound Board elements
const soundBoardPanel = document.getElementById('sound-board-panel') as HTMLDivElement | null;
const soundBoardButton = document.getElementById('sidebar-sound-board-button') as HTMLButtonElement | null;

// Voice Filter elements
const voiceFilterPanel = document.getElementById('voice-filter-panel') as HTMLDivElement | null;
const voiceFilterButton = document.getElementById('sidebar-voice-filter-button') as HTMLButtonElement | null;

// Quick Translate elements
const quickTranslatePanel = document.getElementById('quick-translate-panel') as HTMLDivElement | null;
const quickTranslateButton = document.getElementById('sidebar-quick-translate-button') as HTMLButtonElement | null;
const quickTranslateProvider = document.getElementById('quick-translate-provider') as HTMLSelectElement | null;
const quickTranslateTargetLang = document.getElementById('quick-translate-target-lang') as HTMLSelectElement | null;
const quickTranslateInput = document.getElementById('quick-translate-input') as HTMLTextAreaElement | null;
const quickTranslateBtn = document.getElementById('quick-translate-btn') as HTMLButtonElement | null;
const quickTranslateBtnText = document.getElementById('quick-translate-btn-text') as HTMLSpanElement | null;
const quickTranslateSpinner = document.getElementById('quick-translate-spinner') as HTMLDivElement | null;
const quickTranslateClearBtn = document.getElementById('quick-translate-clear-btn') as HTMLButtonElement | null;
const quickTranslateCopyBtn = document.getElementById('quick-translate-copy-btn') as HTMLButtonElement | null;
const quickTranslateOutput = document.getElementById('quick-translate-output') as HTMLTextAreaElement | null;
const quickTranslateInfo = document.getElementById('quick-translate-info') as HTMLDivElement | null;
const quickTranslateCacheSize = document.getElementById('quick-translate-cache-size') as HTMLSpanElement | null;
const quickTranslateClearCacheBtn = document.getElementById('quick-translate-clear-cache-btn') as HTMLButtonElement | null;
const screenTranslationDisplaySelect = document.getElementById('screen-translation-display-select') as HTMLSelectElement | null;
const screenTranslationDisplaySelector = document.getElementById('screen-translation-display-selector') as HTMLDivElement | null;
const whispraScreenDisplaySelector = document.getElementById('whispra-screen-display-selector') as HTMLDivElement | null;
const screenTranslationProcessingDot = document.getElementById('screen-translation-processing-dot') as HTMLElement | null;
const screenTranslationStatus = document.getElementById('screen-translation-status') as HTMLSpanElement | null;
const totalTextBlocksSpan = document.getElementById('total-text-blocks') as HTMLSpanElement | null;
const successfulTranslationsSpan = document.getElementById('successful-translations') as HTMLSpanElement | null;
const processingTimeSpan = document.getElementById('processing-time') as HTMLSpanElement | null;

// Whispra Translate elements
const whispraTranslatePanel = document.getElementById('whispra-translate-panel') as HTMLDivElement | null;
const whispraTranslateButton = document.getElementById('sidebar-whispra-translate-button') as HTMLButtonElement | null;
const whispraTranslateStatus = document.getElementById('whispra-translate-status') as HTMLSpanElement | null;
const whispraBidirectionalStatus = document.getElementById('whispra-bidirectional-status') as HTMLSpanElement | null;

// Screen Translate elements
const whispraScreenPanel = document.getElementById('whispra-screen-panel') as HTMLDivElement | null;
const whispraScreenButton = document.getElementById('sidebar-whispra-screen-button') as HTMLButtonElement | null;
const whispraScreenStatus = document.getElementById('whispra-screen-status') as HTMLSpanElement | null;
const whispraScreenProcessingDot = document.getElementById('whispra-screen-processing-dot') as HTMLElement | null;

// MASTER VOLUME CONTROL - Change this one value to adjust all audio output
// Load from localStorage or default to 20% (0.2)
let MASTER_AUDIO_VOLUME = 0.2; // Default: 20% volume (0.01 = 1%, 0.1 = 10%, 1.0 = 100%)
try {
    const savedVolume = localStorage.getItem('whispra-tts-volume');
    if (savedVolume !== null) {
        const volumeValue = parseFloat(savedVolume);
        if (!isNaN(volumeValue) && volumeValue >= 0 && volumeValue <= 1) {
            MASTER_AUDIO_VOLUME = volumeValue;
        }
    }
} catch (error) {
    console.warn('Failed to load TTS volume from localStorage:', error);
}

// Expose screen translation context to screentrans modules via window (initialized early so functions can be assigned)
(window as any).__screenTransCtx = {
    // Mutable variables - will be populated below
    isInitializingScreenTranslation: false,
    isScreenTranslationProcessing: false,
    screenTranslationKeybind: 'KeyT',
    isPaddleWarmupEnabled: false,

    // DOM elements - will be populated below
    screenTranslationTriggerButton: null,
    screenTranslationSourceLang: null,
    screenTranslationTargetLang: null,
    screenTranslationDisplaySelect: null,
    screenTranslationDisplaySelector: null,
    screenTranslationProcessingDot: null,
    screenTranslationStatus: null,
    totalTextBlocksSpan: null,
    successfulTranslationsSpan: null,
    processingTimeSpan: null,
    screenTranslationKeybindSpan: null,
    screenTranslationKeybindDisplay: null,

    // Functions - will be assigned as they're defined
    logToDebug: null as any,
    checkPaddlePaddleBeforeScreenTranslation: null as any,
    loadAvailableDisplays: null as any,
    updateScreenTranslationKeybindDisplay: null as any
};

// Application state
let isTranslating = false;
let isDebugVisible = false;
let isRecording = false;
let recordingStartTime: number | null = null; // Track when recording started
let translationStartTime: number | null = null; // Track when translation mode was enabled (to prevent immediate PTT triggers)
let currentKeybind = 'Space';
let mediaRecorder: MediaRecorder | null = null;
let audioStream: MediaStream | null = null;
let audioChunks: Blob[] = [];
let isProcessingAudio = false; // Prevent concurrent audio processing
let isProcessingChunk = false; // Flag to track if we're currently processing a streaming chunk
let chunkQueue: Blob[] = []; // Queue for streaming audio chunks
let streamingAudioPlayer: StreamingAudioPlayer | null = null; // Streaming audio player for TTS chunks
let ttsQueue: string[] = []; // Queue for translated text waiting to be spoken
let isPlayingTTS = false; // Flag to track if TTS is currently playing
let pttOverlay: PTTOverlay | null = null; // PTT overlay for audio visualization
let streamingInterval: ReturnType<typeof setInterval> | null = null; // Interval for restarting recorder every 2s
let currentChunkData: Blob[] = []; // Current chunk being collected
let virtualOutputDeviceId: string | null = null; // AudioOutput sink for VB-CABLE
let passThroughAudioEl: HTMLAudioElement | null = null; // Default/headphones passthrough
let passThroughAudioElVirtual: HTMLAudioElement | null = null; // VB-CABLE passthrough
let outputToVirtualDevice = true; // user toggle for routing output
let isTogglingOutput = false; // Prevent multiple simultaneous toggles

// Audio level monitoring for silence detection
let audioContext: AudioContext | null = null;
let analyserNode: AnalyserNode | null = null;
let audioLevelCheckInterval: ReturnType<typeof setInterval> | null = null;
let hasDetectedAudio = false; // Track if we've detected any audio above threshold
let audioDetectedThisSession = false; // Track if audio was detected at all during this PTT session
let ctrlPressed = false;
let altPressed = false;
let pttMainKeyHeld = false;
let pendingPTTStart = false;

const isFunctionKeyCode = (key: string): boolean => /^F\d{1,2}$/.test(key);

type InteractiveAudioAnalyser = {
    getVolume: () => number;
};

async function createInteractiveCharacterAnalyser(): Promise<InteractiveAudioAnalyser | null> {
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const MAX_ATTEMPTS = 20;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        if (analyserNode) {
            let buffer = new Uint8Array(analyserNode.fftSize || 2048);

            return {
                getVolume: () => {
                    const node = analyserNode;
                    if (!node) {
                        buffer = new Uint8Array(0);
                        return 0;
                    }

                    const fftSize = node.fftSize || 2048;
                    if (buffer.length !== fftSize) {
                        buffer = new Uint8Array(fftSize);
                    }

                    try {
                        node.getByteTimeDomainData(buffer);
                    } catch {
                        return 0;
                    }

                    let sumSquares = 0;
                    for (let i = 0; i < fftSize; i++) {
                        const centered = (buffer[i] - 128) / 128;
                        sumSquares += centered * centered;
                    }

                    return Math.sqrt(sumSquares / fftSize);
                },
            };
        }

        await wait(200);
    }

    return null;
}

const interactiveBridge = (window as any).__whispraInteractive || {};
interactiveBridge.createAudioAnalyser = createInteractiveCharacterAnalyser;
interactiveBridge.isPTTActive = () => isRecording;
(window as any).__whispraInteractive = interactiveBridge;
(window as any).createAudioAnalyser = createInteractiveCharacterAnalyser;
(window as any).isPTTActive = () => isRecording;

/**
 * Show fallback notification when managed API fails and personal API is used
 */
function showFallbackNotification(service: 'openai' | 'elevenlabs', serviceName: string, message: string): void {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #FF9800;
        color: white;
        padding: 12px 16px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        z-index: 10000;
        font-size: 14px;
        font-weight: 500;
        max-width: 300px;
        line-height: 1.4;
        display: flex;
        align-items: flex-start;
        gap: 8px;
    `;

    notification.innerHTML = `
        <span style="font-size: 16px;">🔄</span>
        <div>
            <div style="font-weight: 600; margin-bottom: 4px;">Using Personal API Key</div>
            <div style="font-size: 13px; opacity: 0.9;">
                ${message}
            </div>
        </div>
    `;

    document.body.appendChild(notification);

    // Auto-remove after 4 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 4000);
}

/**
 * Check PaddlePaddle installation before allowing screen translation
 */
async function checkPaddlePaddleBeforeScreenTranslation(): Promise<void> {
    try {
        console.log('🏓 Checking PaddlePaddle installation before screen translation...');

        // Check if PaddlePaddle is already installed
        const result = await (window as any).electronAPI.paddle.checkInstallation();

        if (result.success && result.isInstalled && result.hasLanguagePacks) {
            console.log('🏓 PaddlePaddle is already installed with language packs, proceeding with screen translation');
            return;
        }

        console.log('🏓 PaddlePaddle missing or incomplete, showing installation overlay');

        // Show the PaddlePaddle installation overlay
        (window as any).electronAPI.paddle.showOverlay();

    } catch (error) {
        console.error('❌ Error checking PaddlePaddle before screen translation:', error);

        // Show a fallback error message
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        alert(`Failed to check PaddlePaddle installation: ${errorMessage}`);
    }
}

// Expose checkPaddlePaddleBeforeScreenTranslation to screentrans modules
(window as any).__screenTransCtx.checkPaddlePaddleBeforeScreenTranslation = checkPaddlePaddleBeforeScreenTranslation;

// WebAudio-based passthrough for headphones/default output (avoids autoplay issues)
let passthroughCtx: AudioContext | null = null;
let passthroughSourceNode: MediaStreamAudioSourceNode | null = null;
let passthroughGainNode: GainNode | null = null;

// WebAudio-based passthrough for virtual cable (better volume control)
let passthroughCtxVirtual: AudioContext | null = null;
let passthroughSourceNodeVirtual: MediaStreamAudioSourceNode | null = null;
let passthroughGainNodeVirtual: GainNode | null = null;
let passthroughDestinationVirtual: MediaStreamAudioDestinationNode | null = null;

// Accent state
let accentEnabled = false;
let selectedAccent = '';
let customAccentValue = '';

// Bidirectional state - now imported from BidirectionalState module
// let isBidirectionalActive = false; // REMOVED - use module state instead
let bidirectionalKeybind = 'KeyB'; // Will be updated from config
let bidirectionalOutputDeviceId: string | null = null;
let bidirectionalInputDeviceId: string | null = null;
let incomingVoiceId: string | null = 'pNInz6obpgDQGcFmaJgB'; // Default to Adam voice, will be updated from config
let bidirectionalSourceLanguage: string = 'auto'; // Will be updated from config
let bidirectionalTargetLanguage: string = 'en'; // Will be updated from config
let bidiAudioStream: MediaStream | null = null; // selected input device stream (optional)
let bidirectionalMiniOverlayTimer: NodeJS.Timeout | null = null; // Timer to show mini overlay after 30s
let bidirectionalAutoOpenedOverlay = false; // Track if bidirectional auto-opened the overlay
// bidirectionalCaptionsEnabled is now imported from BidirectionalState
let captionsSettings = {
    enabled: false,
    textColor: 'white' as 'white' | 'black',
    background: 'none' as 'none' | 'white' | 'black',
    fontSize: 'medium' as 'small' | 'medium' | 'large' | 'xlarge',
    captionsOnly: false // When true, skip TTS and only show captions
};

// Screen translation variables
let screenTranslationKeybind = 'KeyT'; // Will be updated from config
let isPaddleWarmingUp = false; // Track if Paddle is warming up
let isPaddleWarmupEnabled = false; // Track if user has warmup enabled
let isScreenTranslationProcessing = false;

// Update __screenTransCtx with getters/setters for mutable variables and populate DOM elements
Object.assign((window as any).__screenTransCtx, {
    // Mutable variables - use getters/setters to always get current value
    get isInitializingScreenTranslation() { return isInitializingScreenTranslation; },
    set isInitializingScreenTranslation(v) { isInitializingScreenTranslation = v; },
    get isScreenTranslationProcessing() { return isScreenTranslationProcessing; },
    set isScreenTranslationProcessing(v) { isScreenTranslationProcessing = v; },
    get screenTranslationKeybind() { return screenTranslationKeybind; },
    set screenTranslationKeybind(v) { screenTranslationKeybind = v; },
    get isPaddleWarmupEnabled() { return isPaddleWarmupEnabled; },
    set isPaddleWarmupEnabled(v) { isPaddleWarmupEnabled = v; },

    // DOM elements (populated now that they're defined)
    screenTranslationTriggerButton,
    screenTranslationSourceLang,
    screenTranslationTargetLang,
    screenTranslationDisplaySelect,
    screenTranslationDisplaySelector,
    whispraScreenDisplaySelector,
    screenTranslationProcessingDot,
    screenTranslationStatus,
    whispraScreenProcessingDot,
    whispraScreenStatus,
    totalTextBlocksSpan,
    successfulTranslationsSpan,
    processingTimeSpan,
    screenTranslationKeybindSpan,
    screenTranslationKeybindDisplay
});

// Helper function to get the selected source language for bidirectional mode
function getBidirectionalSourceLanguage(): string {
    if (!bidirectionalSourceLanguageSelect) return bidirectionalSourceLanguage;
    const selectedValue = bidirectionalSourceLanguageSelect.value;
    return selectedValue === 'auto' ? 'auto' : selectedValue;
}

// Helper function to get the selected target language for bidirectional mode
function getBidirectionalTargetLanguage(): string {
    if (!bidirectionalTargetLanguageSelect) return bidirectionalTargetLanguage;
    return bidirectionalTargetLanguageSelect.value || bidirectionalTargetLanguage;
}
let bidiDesktopStream: MediaStream | null = null; // system/desktop audio stream (optional)
let bidiMixedStream: MediaStream | null = null; // mixed stream used for analysis, recording, passthrough
let bidiMixerCtx: AudioContext | null = null;
let bidiMixerDestination: MediaStreamAudioDestinationNode | null = null;
let bidiVadThreshold = 0.0035; // adaptive threshold for system input
let bidiCalibrating = false;
let bidiCalibSamples = 0;
let bidiCalibAccum = 0;
// Serialize TTS playback for bidirectional to avoid overlaps
let bidiPlaybackQueue: Array<{ text: string; voiceId: string; sinkId?: string }> = [];
let bidiIsPlayingTts = false;
// Rolling aggregator for 1s chunks
let bidiRollingText: string = '';
let bidiLastChunkAt: number = 0;
let bidiSpeakTimer: number | null = null;
// Prepared audio queue to make playback instant
let bidiPreparedQueue: Array<{ audioBuffer: number[]; sinkId?: string; text: string }> = [];

// Bidirectional TTS Processor for parallel queue-based processing
let bidirectionalTTSProcessor: any = null; // BidirectionalTTSProcessor instance
let bidiChunkQueue: Array<{ audioData: Buffer; timestamp: number }> = []; // Queue for audio chunks waiting to be processed
let isProcessingBidiChunk = false; // Flag to prevent concurrent chunk processing
let bidiLastTranscription = ''; // Track last transcription for deduplication
let bidirectionalContextManager: TranslationContextManager | null = null; // Context manager for coherent translations
let bidiLastAudioChunkTime = 0; // Track last audio chunk time for context clearing
const CONTEXT_CLEAR_PAUSE_MS = 1500; // Clear context after 2 seconds of silence

function scheduleChunkSpeak(detectedLang: string): void {
    // Wait brief gap before speaking accumulated phrase
    if (bidiSpeakTimer) {
        clearTimeout(bidiSpeakTimer);
        bidiSpeakTimer = null;
    }
    // If English, do not speak but still reset buffer after gap
    const gapMs = 450; // brief silence window to consider phrase ended
    bidiSpeakTimer = window.setTimeout(async () => {
        const textToSpeak = (bidiRollingText || '').trim();
        bidiRollingText = '';
        if (!textToSpeak) return;
        // Check if we should skip English TTS based on source/target language settings
        const sourceLanguage = getBidirectionalSourceLanguage();
        const targetLanguage = getBidirectionalTargetLanguage();

        if (detectedLang === 'en' || detectedLang === 'english') {
            // If source language is set to English, ALLOW English TTS (user wants to translate FROM English)
            if (sourceLanguage === 'en' || sourceLanguage === 'english') {
                console.log('✅ English TTS allowed - source is English');
                // Continue with TTS
            }
            // Skip English TTS if target is English (no translation needed)
            else if (targetLanguage === 'en') {
                console.log('🚫 Skipping English TTS - English to English (no translation needed)');
                return;
            }
            // Skip English TTS if source language is set to non-English (user expects different language)
            else if (sourceLanguage !== 'auto' && sourceLanguage !== 'en' && sourceLanguage !== 'english') {
                console.log(`🚫 Skipping English TTS - expecting ${sourceLanguage} but got English`);
                return;
            }
            // If we get here: English detected, target is not English, and source is auto/English
            // This means we should play English TTS - continue processing
            console.log(`✅ English TTS allowed - will play English audio`);
        }
        if (incomingVoiceId) {
            await requestTranslatedTtsPlay(textToSpeak, incomingVoiceId, bidirectionalOutputDeviceId || undefined);
        }
    }, gapMs);
}
let bidiLastProbeAttemptTs = 0;
let bidiBaseline = 0;
let bidiConsecutiveActiveFrames = 0;
let bidiStartTs = 0;
let bidiRecorder: MediaRecorder | null = null;
let bidiAnalyzerCtx: AudioContext | null = null;
let bidiAnalyzerNode: AnalyserNode | null = null;
let bidiSourceNode: MediaStreamAudioSourceNode | null = null;
let bidiVadInterval: number | null = null;
let bidiInSpeech = false;
let bidiProcessing = false;
let bidiCurrentBlobs: Blob[] = [];
let bidiFirstTargetIndex = -1;
let bidiSectionActive = false;
let bidiMimeType = 'audio/wav'; // Prefer WAV for Whisper compatibility
let bidiUseWasapiWav = false; // Flag to track if we're using WASAPI WAV instead of MediaRecorder

// Audio rolling buffer for bidirectional mode (works with both WASAPI WAV and screen capture)
let wasapiRollingBuffer: (Buffer | Blob)[] = [];
let wasapiBufferStartTime = 0;
let wasapiCurrentSegment: (Buffer | Blob)[] = [];
let wasapiSegmentStartTime = 0;
let wasapiIsRecording = false;
const WASAPI_PREROLL_MS = 2000; // 2 seconds pre-roll
const WASAPI_MAX_SEGMENT_MS = 30000; // 30 seconds max segment
const WASAPI_SILENCE_TIMEOUT_MS = 2000; // 2 seconds of silence to end segment
let bidiNeedsProbe = false;
let bidiSectionBlocked = false;

// ============================================================================
// Wrapper functions for extracted modules
// ============================================================================

/**
 * Wrapper for restartPassthroughClean - restarts audio passthrough cleanly
 */
async function restartPassthroughClean(): Promise<void> {
    return restartPassthroughCleanModule(
        audioStream,
        logToDebug,
        passThroughAudioElVirtual,
        passthroughGainNode,
        passthroughSourceNode,
        passthroughCtx,
        passThroughAudioEl,
        outputToVirtualDevice,
        virtualOutputDeviceId,
        passthroughGainNodeVirtual,
        passthroughSourceNodeVirtual,
        passthroughDestinationVirtual,
        passthroughCtxVirtual,
        MASTER_AUDIO_VOLUME,
        (val) => { passThroughAudioElVirtual = val; },
        (val) => { passthroughGainNode = val; },
        (val) => { passthroughSourceNode = val; },
        (val) => { passthroughCtx = val; },
        (val) => { passThroughAudioEl = val; },
        (val) => { passthroughGainNodeVirtual = val; },
        (val) => { passthroughSourceNodeVirtual = val; },
        (val) => { passthroughDestinationVirtual = val; },
        (val) => { passthroughCtxVirtual = val; }
    );
}

/**
 * Wrapper for playAudioInRenderer - plays audio buffer in renderer
 */
async function playAudioInRenderer(audioBufferArray: number[]): Promise<void> {
    return playAudioInRendererModule(
        audioBufferArray,
        passThroughAudioEl,
        passThroughAudioElVirtual,
        MASTER_AUDIO_VOLUME,
        outputToVirtualDevice,
        virtualOutputDeviceId,
        isTranslating,
        isRecording,
        audioStream,
        restartPassthroughClean
    );
}

/**
 * Wrapper for toggleTranslation - toggles push-to-talk mode
 */
async function toggleTranslation(): Promise<void> {
    return toggleTranslationModule(
        isTranslating,
        startButton!,
        currentLanguage,
        getTranslatedButtonText,
        processingStatus!,
        logToDebug,
        liveTranslationPanel!,
        isRecording,
        stopRecordingModule,
        mediaRecorder,
        updateRecordingUI,
        recordingText,
        originalTextDiv,
        translatedTextDiv,
        microphoneSelect!,
        languageSelect!,
        voiceSelect!,
        audioStream,
        initializeAudioStream,
        restartPassthroughClean,
        updateStatusIndicator,
        (val) => {
            isTranslating = val;
        },
        (val) => { translationStartTime = val; },
        (val) => {
            isRecording = val;
            const statusEl = document.getElementById('whispra-translate-status') as HTMLSpanElement | null;
            if (statusEl) {
                statusEl.textContent = val ? 'Running' : 'Idle';
            }
        },
        (val) => { recordingStartTime = val; },
        (val) => { mediaRecorder = val; },
        (val) => { audioChunks = val; }
    );
}
let bidiLastVoiceTs = 0;
let pendingFinalize = false;

let wasapiPcmQueue: Float32Array[] = [];
let wasapiWorkletNode: AudioWorkletNode | null = null;
let wasapiCtx: AudioContext | null = null;
let wasapiDest: MediaStreamAudioDestinationNode | null = null;

// Raw PCM capture (ScriptProcessor) for bidirectional mode
let pcmCaptureCtx: AudioContext | null = null;
let pcmCaptureSource: MediaStreamAudioSourceNode | null = null;
let pcmProcessorNode: ScriptProcessorNode | null = null;
let pcmRollingBuffer: Float32Array[] = [];
let pcmRollingDurationMs = 0;
let pcmIsRecording = false;
let pcmCurrentFrames: Float32Array[] = [];
let pcmSegmentDurationMs = 0;
const PCM_PREROLL_MS = 2000;
const PCM_MAX_SEGMENT_MS = 30000;
const PCM_MIN_SEGMENT_MS = 3000;

function resampleFloat32(input: Float32Array, inRate: number, outRate: number): Float32Array {
    if (inRate === outRate) return input;
    const ratio = inRate / outRate;
    const outLen = Math.floor(input.length / ratio);
    const output = new Float32Array(outLen);
    for (let i = 0; i < outLen; i++) {
        const sourceIndex = i * ratio;
        const idx = Math.floor(sourceIndex);
        const frac = sourceIndex - idx;
        const s0 = input[idx] ?? 0;
        const s1 = input[idx + 1] ?? s0;
        output[i] = s0 * (1 - frac) + s1 * frac;
    }
    return output;
}

function float32ToWavBlob(frames: Float32Array[], sampleRate: number): Blob {
    // Combine
    let total = 0;
    for (const f of frames) total += f.length;
    const combined = new Float32Array(total);
    let off = 0;
    for (const f of frames) { combined.set(f, off); off += f.length; }

    // Downsample to 16kHz mono
    const targetRate = 16000;
    const mono = resampleFloat32(combined, sampleRate, targetRate);

    // Build WAV (16-bit PCM)
    const length = mono.length;
    const buffer = new ArrayBuffer(44 + length * 2);
    const view = new DataView(buffer);
    const writeString = (offset: number, str: string) => { for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i)); };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + length * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, 1, true); // mono
    view.setUint32(24, targetRate, true);
    view.setUint32(28, targetRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, length * 2, true);

    let ptr = 44;
    for (let i = 0; i < length; i++) {
        const s = Math.max(-1, Math.min(1, mono[i]));
        view.setInt16(ptr, s * 0x7FFF, true);
        ptr += 2;
    }

    return new Blob([buffer], { type: 'audio/wav' });
}

async function finalizePcmCaptureSegment(): Promise<void> {
    if (!pcmIsRecording || pcmCurrentFrames.length === 0 || !pcmCaptureCtx) return;
    pcmIsRecording = false;
    const frames = [...pcmCurrentFrames];
    pcmCurrentFrames = [];
    try {
        console.log('[renderer] 🔄 PCM Capture: Processing', frames.length, 'frames for Whisper');
        const wavBlob = float32ToWavBlob(frames, pcmCaptureCtx.sampleRate);
        const arrBuf = await wavBlob.arrayBuffer();
        const audioData = Array.from(new Uint8Array(arrBuf));
        console.log('[renderer] 📤 PCM Capture: Sending', audioData.length, 'bytes to Whisper API as audio/wav');
        const selectedLanguage = getBidirectionalSourceLanguage();
        const targetLanguage = getBidirectionalTargetLanguage();
        const response = await (window as any).electronAPI.invoke('speech:transcribe', {
            id: Date.now().toString(),
            timestamp: Date.now(),
            payload: { audioData, language: selectedLanguage, targetLanguage: targetLanguage, contentType: 'audio/wav' }
        });
        if (!response.success) {
            console.warn('[renderer] PCM Capture transcription failed:', response.error);
        } else {
            console.log('[Bidirectional] PCM Whisper result:', (response.payload.text || '').trim());
        }
    } catch (e) {
        console.warn('[renderer] PCM Capture finalize error:', e);
    }
}

async function startPcmCapture(stream: MediaStream): Promise<void> {
    // Skip raw PCM capture to avoid renderer stability issues
    console.log('🎙️ Raw PCM capture disabled for stability');
}

async function stopPcmCapture(): Promise<void> {
    try { if (pcmProcessorNode) pcmProcessorNode.disconnect(); } catch { }
    try { if (pcmCaptureSource) pcmCaptureSource.disconnect(); } catch { }
    try { if (pcmCaptureCtx && pcmCaptureCtx.state !== 'closed') await pcmCaptureCtx.close(); } catch { }
    pcmProcessorNode = null;
    pcmCaptureSource = null;
    pcmCaptureCtx = null;
    pcmIsRecording = false;
    pcmCurrentFrames = [];
    pcmRollingBuffer = [];
    pcmRollingDurationMs = 0;
}

async function ensureWasapiWorklet(): Promise<void> {
    if (wasapiCtx) return;
    wasapiCtx = new AudioContext({ sampleRate: 16000 });
    const workletCode = `
    class PcmIn16ToAudio extends AudioWorkletProcessor {
      constructor() {
        super();
        this.buffer = [];
        this.index = 0;
        this.port.onmessage = (e) => {
          const buf = e.data;
          this.buffer.push(buf);
        };
      }
      process(inputs, outputs) {
        const output = outputs[0][0];
        let i = 0;
        while (i < output.length) {
          if (this.buffer.length === 0) break;
          const chunk = this.buffer[0];
          const take = Math.min(output.length - i, chunk.length - this.index);
          output.set(chunk.subarray(this.index, this.index + take), i);
          i += take;
          this.index += take;
          if (this.index >= chunk.length) { this.buffer.shift(); this.index = 0; }
        }
        if (i < output.length) {
          output.fill(0, i);
        }
        return true;
      }
    }
    registerProcessor('pcm-in16-to-audio', PcmIn16ToAudio);
    `;
    const blob = new Blob([workletCode], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    await wasapiCtx.audioWorklet.addModule(url);
    URL.revokeObjectURL(url);
    wasapiWorkletNode = new AudioWorkletNode(wasapiCtx, 'pcm-in16-to-audio', { numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [1] });
    wasapiDest = wasapiCtx.createMediaStreamDestination();
    wasapiWorkletNode.connect(wasapiDest);
}

function feedWasapiPcmToWorklet(pcm: ArrayBuffer): void {
    if (!wasapiCtx || !wasapiWorkletNode) {
        console.warn('[renderer] WASAPI worklet not ready, dropping PCM data');
        return;
    }
    // Assume int16 little-endian mono at 16kHz
    // This is for the audio level visualization only - VAD uses the MediaStream path
    const view = new Int16Array(pcm);
    const f32 = new Float32Array(view.length);
    for (let i = 0; i < view.length; i++) {
        f32[i] = Math.max(-1, Math.min(1, view[i] / 32768));
    }
    wasapiWorkletNode.port.postMessage(f32);
}

// Subscribe to WASAPI PCM stream
(function setupWasapiPcmListener() {
    try {
        (window as any).electronAPI.on && (window as any).electronAPI.on('wasapi:pcm', (_e: any, pcm: ArrayBuffer) => {
            console.log('[renderer] Received WASAPI PCM data:', pcm.byteLength, 'bytes');
            feedWasapiPcmToWorklet(pcm);
        });
    } catch { }
})();

// Subscribe to WASAPI WAV stream for direct transcription
(function setupWasapiWavListener() {
    try {
        (window as any).electronAPI.setupWasapiWavCapture && (window as any).electronAPI.setupWasapiWavCapture((_wavData: Buffer) => {
            if (!isBidirectionalActive) return;
            // Renderer no longer manages WASAPI WAV chunks; handled by main VAD
        });
    } catch (e) {
        console.warn('[renderer] Failed to setup WASAPI WAV listener:', e);
    }
})();

// Subscribe to VAD-segmented WASAPI utterances for direct transcription
(function setupWasapiUtteranceListener() {
    try {
        (window as any).electronAPI.setupWasapiChunkWav && (window as any).electronAPI.setupWasapiChunkWav(async (wavData: Buffer) => {
            if (!isBidirectionalActive) return;
            try {
                // Process this chunk asynchronously (don't wait for previous chunks to finish TTS)
                // This allows transcription/translation to happen in background while TTS plays
                await processBidirectionalAudioChunkModule(
                    wavData,
                    getBidirectionalSourceLanguageFromUI,
                    getBidirectionalTargetLanguageFromUI
                );
            } catch (err) {
                console.warn('[renderer] Utterance transcription failed:', err);
            }
        });
    } catch (e) {
        console.warn('[renderer] Failed to setup WASAPI utterance listener:', e);
    }
})();

// Process bidirectional audio chunks asynchronously (similar to translate page processAudioChunk)

// Remove duplicate words at chunk boundaries
function removeDuplicateWords(previousText: string, currentText: string): string {
    const prevWords = previousText.trim().split(/\s+/);
    const currWords = currentText.trim().split(/\s+/);

    if (prevWords.length === 0 || currWords.length === 0) {
        return currentText;
    }

    // Find how many words match at the boundary
    // Check last N words of previous chunk against first N words of current chunk
    // With 200ms overlap, we might get 2-5 words duplicated depending on speech speed
    let maxOverlap = Math.min(prevWords.length, currWords.length, 7); // Check up to 7 words for 200ms overlap
    let overlapCount = 0;

    for (let i = 1; i <= maxOverlap; i++) {
        // Check if last i words of prev match first i words of curr
        const prevSlice = prevWords.slice(-i);
        const currSlice = currWords.slice(0, i);

        if (prevSlice.join(' ').toLowerCase() === currSlice.join(' ').toLowerCase()) {
            overlapCount = i;
        }
    }

    if (overlapCount > 0) {
        // Remove the duplicate words from the start of current text
        const deduplicated = currWords.slice(overlapCount).join(' ');
        console.log(`[Bidi] Removed ${overlapCount} duplicate word(s): "${currWords.slice(0, overlapCount).join(' ')}"`);
        return deduplicated;
    }

    return currentText;
}

// Update bidirectional UI based on processing status
function updateBidirectionalUI(): void {
    if (!bidirectionalStatusText || !bidirectionalTTSProcessor) return;

    const stats = bidirectionalTTSProcessor.getStats();
    const remaining = bidirectionalTTSProcessor.getRemainingCount();

    if (remaining > 0) {
        bidirectionalStatusText.textContent = `Processing... (${remaining} remaining)`;
    } else if (stats.playing > 0) {
        bidirectionalStatusText.textContent = 'Playing...';
    } else {
        bidirectionalStatusText.textContent = 'Listening...';
    }
}

// Helper: always translate to English in main, then play to chosen sink
async function requestTranslatedTtsPlay(text: string, voiceId: string, sinkId?: string): Promise<void> {
    // Stage 1: pre-synthesize and enqueue prepared audio for instant playback
    bidiPlaybackQueue.push({ text, voiceId, sinkId });
    // If not already preparing/playing, kick the pipeline
    if (bidiIsPlayingTts) return;
    bidiIsPlayingTts = true;
    try {
        // Pre-synthesis loop to fill prepared queue quickly
        while (bidiPlaybackQueue.length > 0) {
            const next = bidiPlaybackQueue.shift()!;
            try {
                const resp = await (window as any).electronAPI.invoke('pipeline:test', {
                    id: Date.now().toString(),
                    timestamp: Date.now(),
                    payload: { text: next.text, targetLanguage: getBidirectionalTargetLanguage(), voiceId: next.voiceId, outputToHeadphones: true }
                });
                if (resp?.success && resp.payload?.audioBuffer) {
                    bidiPreparedQueue.push({ audioBuffer: resp.payload.audioBuffer, sinkId: next.sinkId, text: next.text });
                } else {
                    console.warn('[renderer] requestTranslatedTtsPlay: no audio returned');
                }
            } catch (e) {
                console.warn('[renderer] requestTranslatedTtsPlay failed (prepare):', e);
            }
            // If we have enough prepared items, break to start playback
            if (bidiPreparedQueue.length >= 1) break;
        }
        // Stage 2: drain prepared queue with gapless sequential playback
        while (bidiPreparedQueue.length > 0) {
            const prepared = bidiPreparedQueue.shift()!;
            
            // Show captions for the text being played
            console.log('🎬 DEBUG: About to play audio, showing captions for:', prepared.text);
            await updateCaptions(prepared.text);
            
            await playAudioToDevice(prepared.audioBuffer, prepared.sinkId);
            // After playing one, try to pre-synthesize the next if any pending
            if (bidiPlaybackQueue.length > 0) {
                const next = bidiPlaybackQueue.shift()!;
                try {
                    const resp = await (window as any).electronAPI.invoke('pipeline:test', {
                        id: Date.now().toString(),
                        timestamp: Date.now(),
                        payload: { text: next.text, targetLanguage: getBidirectionalTargetLanguage(), voiceId: next.voiceId, outputToHeadphones: true }
                    });
                    if (resp?.success && resp.payload?.audioBuffer) {
                        bidiPreparedQueue.push({ audioBuffer: resp.payload.audioBuffer, sinkId: next.sinkId, text: next.text });
                    }
                } catch { }
            }
        }
    } finally {
        bidiIsPlayingTts = false;
        // If more items arrived while we were playing, recurse to continue
        if (bidiPlaybackQueue.length > 0 || bidiPreparedQueue.length > 0) {
            // Kick again without duplicating synthesis
            void requestTranslatedTtsPlay('', voiceId, sinkId);
        }
    }
}

// Function to finalize screen capture audio segment and send to Whisper

// Function to finalize WASAPI audio segment and send to Whisper (for real WASAPI WAV data)

// Helper to start per-app capture and return a MediaStream
async function startPerAppMediaStream(pid: number): Promise<MediaStream> {
    // On macOS, use screen capture audio instead of WASAPI
    if (navigator.platform.includes('Mac')) {
        console.log('[renderer] 🍎 macOS detected - using screen capture audio');
        try {
            return await startMacOSScreenCaptureAudio();
        } catch (error) {
            console.error('[renderer] ❌ Screen capture failed:', error);
            throw error;
        }
    }
    
    // Windows: Use WASAPI
    await ensureWasapiWorklet();
    console.log('[renderer] 🔊 Invoking WASAPI start for PID:', pid);
    const result = await (window as any).electronAPI.startPerAppCapture(pid);
    if (!result || result.success !== true) {
        const errMsg = result?.error || 'Unknown startPerAppCapture failure';
        console.warn('[renderer] ❌ WASAPI start failed for PID', pid, ':', errMsg);
        throw new Error(errMsg);
    }
    console.log('[renderer] ✅ WASAPI start acknowledged by main for PID:', pid);
    return wasapiDest!.stream;
}

// macOS screen capture audio
let macScreenCaptureStream: MediaStream | null = null;

async function startMacOSScreenCaptureAudio(): Promise<MediaStream> {
    try {
        console.log('[renderer] 🎬 Starting macOS screen capture audio...');
        
        // Get desktop sources
        const sources = await (window as any).electronAPI.getDesktopSources(['screen']);
        if (!sources || sources.length === 0) {
            throw new Error('No screen sources available for audio capture');
        }
        
        const source = sources[0];
        console.log('[renderer] Using screen source:', source.name);
        
        // Request screen capture with audio
        // @ts-ignore - Electron-specific constraints
        macScreenCaptureStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                mandatory: {
                    chromeMediaSource: 'desktop',
                    chromeMediaSourceId: source.id
                }
            } as any,
            video: {
                mandatory: {
                    chromeMediaSource: 'desktop',
                    chromeMediaSourceId: source.id,
                    maxWidth: 1,
                    maxHeight: 1,
                    maxFrameRate: 1
                }
            } as any
        });
        
        // Stop video track (we only need audio)
        const videoTracks = macScreenCaptureStream.getVideoTracks();
        videoTracks.forEach(track => track.stop());
        
        const audioTracks = macScreenCaptureStream.getAudioTracks();
        if (audioTracks.length === 0) {
            throw new Error('No audio track available from screen capture');
        }
        
        console.log('[renderer] ✅ Screen capture audio started:', audioTracks[0].label);
        return macScreenCaptureStream;
        
    } catch (error) {
        console.error('[renderer] ❌ Failed to start screen capture audio:', error);
        throw error;
    }
}

function stopMacOSScreenCaptureAudio(): void {
    if (macScreenCaptureStream) {
        console.log('[renderer] Stopping macOS screen capture audio...');
        macScreenCaptureStream.getTracks().forEach(track => track.stop());
        macScreenCaptureStream = null;
    }
}

// Global error handlers
window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    logToDebug(`❌ Global error: ${event.error?.message || 'Unknown error'}`);
    logToDebug(`   File: ${event.filename}:${event.lineno}:${event.colno}`);
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    logToDebug(`❌ Unhandled promise rejection: ${event.reason}`);
    event.preventDefault(); // Prevent the default behavior (logging to console)
});

/**
 * Initialize WebSocket status indicator in header
 */
async function initializeWebSocketStatus(): Promise<void> {
    const indicator = document.getElementById('websocket-status-indicator');
    if (!indicator) {
        console.warn('WebSocket status indicator not found in DOM');
        return;
    }

    // Update status display
    const updateStatus = async () => {
        try {
            const stats = await (window as any).electronAPI.websocket.getStats();
            const state = stats.wsState;
            const mode = stats.mode;

            // Only show indicator in managed mode
            if (mode === 'managed') {
                indicator.style.display = 'flex';
                
                // Remove all state classes
                indicator.classList.remove('connected', 'connecting', 'reconnecting', 'disconnected', 'failed');
                
                // Add current state class
                indicator.classList.add(state);

                // Update tooltip
                const tooltips: Record<string, string> = {
                    'connected': '🔌 WebSocket Connected (Faster Performance)',
                    'connecting': '🔄 Connecting to WebSocket...',
                    'reconnecting': '🔄 Reconnecting to WebSocket...',
                    'disconnected': '⚠️ Using REST API (WebSocket Disconnected)',
                    'failed': '❌ WebSocket Failed - Using REST Fallback'
                };
                indicator.title = tooltips[state] || 'WebSocket Status';
            } else {
                // Hide in personal mode
                indicator.style.display = 'none';
            }
        } catch (error) {
            console.error('Failed to update WebSocket status:', error);
            indicator.style.display = 'none';
        }
    };

    // Initial update
    await updateStatus();

    // Listen for state changes
    (window as any).electronAPI.websocket.onStateChange(() => {
        updateStatus();
    });

    // Listen for mode changes
    // Expose loadVoices globally so settings can trigger voice refresh
    (window as any).loadVoices = loadVoices;
    (window as any).refreshVoices = loadVoices;

    // Listen for API keys updated event to refresh voices
    window.addEventListener('api-keys-updated', async () => {
        console.log('🔑 API keys updated, refreshing voices...');
        // Add a small delay to ensure secure storage write completes
        setTimeout(async () => {
            await loadVoices();
            await loadIncomingVoices();
            await loadWhispraBidirectionalIncomingVoices();
            console.log('✅ Voices refreshed after API key update');
        }, 500);
    });

    // Listen for model config changes to refresh voices
    window.addEventListener('model-config-changed', async () => {
        console.log('🔧 Model config changed, refreshing voices...');
        await loadVoices();
        await loadIncomingVoices();
        await loadWhispraBidirectionalIncomingVoices();
    });

    // Listen for managed API mode changes to refresh voices
    window.addEventListener('managed-api-mode-changed', async () => {
        console.log('🔄 Managed API mode changed, refreshing voices...');
        await loadVoices();
        await loadIncomingVoices();
        await loadWhispraBidirectionalIncomingVoices();
    });

    // Original managed-api-mode-changed listener (keep for other functionality)
    window.addEventListener('managed-api-mode-changed', () => {
        updateStatus();
    });

    // Click to show details
    indicator.addEventListener('click', async () => {
        try {
            const stats = await (window as any).electronAPI.websocket.getStats();
            const message = `WebSocket Status:
• State: ${stats.wsState}
• Mode: ${stats.mode}
• Connected: ${stats.wsConnected ? 'Yes' : 'No'}
• Reconnect Attempts: ${stats.wsStats.reconnectAttempts}
• Pending Requests: ${stats.wsStats.pendingRequests}`;
            
            alert(message);
        } catch (error) {
            console.error('Failed to get WebSocket stats:', error);
        }
    });

    console.log('✅ WebSocket status indicator initialized');
}

// Initialize application
document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOM loaded, initializing application...');

    try {
        // Initialize Lucide icons after they load from CDN
        // Icons will be initialized by the script in index.html

        // Ensure debug console is hidden by default
        debugConsole.classList.remove('visible');
        if (debugToggle) {
            debugToggle.textContent = 'Show Debug Console';
        }

        const interactiveCharacterContainer = document.getElementById('interactive-character-root');
        if (interactiveCharacterContainer && !interactiveCharacterHandle) {
            try {
                interactiveCharacterHandle = mountInteractiveCharacter(interactiveCharacterContainer);
            } catch (error) {
                console.error('Failed to mount interactive character:', error);
            }
        }

        // Initialize audio passthrough module FIRST (needed for detectVirtualOutputDevice)
        initializeAudioPassthrough({
            // State variables
            get audioStream() { return audioStream; },
            get virtualOutputDeviceId() { return virtualOutputDeviceId; },
            set virtualOutputDeviceId(value: string | null) { virtualOutputDeviceId = value; },
            get outputToVirtualDevice() { return outputToVirtualDevice; },
            get isRecording() { return isRecording; },
            get microphoneSelect() { return microphoneSelect; },
            
            // Audio nodes and elements
            get passThroughAudioEl() { return passThroughAudioEl; },
            set passThroughAudioEl(value: HTMLAudioElement | null) { passThroughAudioEl = value; },
            get passThroughAudioElVirtual() { return passThroughAudioElVirtual; },
            set passThroughAudioElVirtual(value: HTMLAudioElement | null) { passThroughAudioElVirtual = value; },
            get passthroughCtx() { return passthroughCtx; },
            set passthroughCtx(value: AudioContext | null) { passthroughCtx = value; },
            get passthroughSourceNode() { return passthroughSourceNode; },
            set passthroughSourceNode(value: MediaStreamAudioSourceNode | null) { passthroughSourceNode = value; },
            get passthroughGainNode() { return passthroughGainNode; },
            set passthroughGainNode(value: GainNode | null) { passthroughGainNode = value; },
            get passthroughCtxVirtual() { return passthroughCtxVirtual; },
            set passthroughCtxVirtual(value: AudioContext | null) { passthroughCtxVirtual = value; },
            get passthroughSourceNodeVirtual() { return passthroughSourceNodeVirtual; },
            set passthroughSourceNodeVirtual(value: MediaStreamAudioSourceNode | null) { passthroughSourceNodeVirtual = value; },
            get passthroughGainNodeVirtual() { return passthroughGainNodeVirtual; },
            set passthroughGainNodeVirtual(value: GainNode | null) { passthroughGainNodeVirtual = value; },
            get passthroughDestinationVirtual() { return passthroughDestinationVirtual; },
            set passthroughDestinationVirtual(value: MediaStreamAudioDestinationNode | null) { passthroughDestinationVirtual = value; },
            
            // Bidirectional state
            get bidirectionalInputDeviceId() { return bidirectionalInputDeviceId; },
            set bidirectionalInputDeviceId(value: string | null) { bidirectionalInputDeviceId = value; },
            get bidirectionalUseDisplayAudio() { return bidirectionalUseDisplayAudio; },
            set bidirectionalUseDisplayAudio(value: boolean) { bidirectionalUseDisplayAudio = value; },
            
            // Functions
            logToDebug,
            initializeAudioStream,
            restartPassthroughClean,
            startPerAppMediaStream,
            setBidirectionalInputDeviceId,
            setBidirectionalUseDisplayAudio
        });

        // Initialize PTT overlay
        pttOverlay = new PTTOverlay();
        console.log('✅ PTT overlay initialized');

        await loadMicrophoneDevices();
        await detectVirtualOutputDevice();
        await initializeLanguageSelector();
        await loadPTTHotkey(); // Load PTT hotkey from config
        
        // Initialize bidirectional UI FIRST (sets up DOM element references)
        initializeBidirectionalUI(currentLanguage);

        // Initialize captions module with DOM elements from renderer.ts
        // (these are the same elements used by event listeners)
        initializeCaptionsModule(
            bidirectionalCaptionsToggle,
            bidirectionalCaptionsSettings
        );

        // Inject shared functions into BidirectionalControls module
        injectSharedFunctions(
            playAudioToDevice,
            requestDisplayAudioWithOverlay,
            fallbackToVBCableIfAvailable,
            logToDebug,
            applyAccentTag,
            () => accentEnabled
        );

        // Then initialize bidirectional tab (loads config, devices, etc.)
        await initializeBidirectionalTab();

        // Expose voice loading functions globally so they can be called from UI buttons
        (window as any).loadIncomingVoices = loadIncomingVoices;
        (window as any).refreshIncomingVoices = loadIncomingVoices;
        (window as any).loadWhispraBidirectionalIncomingVoices = loadWhispraBidirectionalIncomingVoices;
        (window as any).refreshWhispraBidirectionalVoices = loadWhispraBidirectionalIncomingVoices;

        await initializeScreenTranslationTab();
        await initializeSoundboardTab();
        await restoreAccentSettings();

        // Initialize audio processing module
        // Create wrapper object with getters/setters for primitives to ensure reactivity
        initializeAudioProcessing({
            // State flags - using getters/setters for primitives
            get isTranslating() { return isTranslating; },
            set isTranslating(value: boolean) {
                isTranslating = value;
            },
            get isRecording() { return isRecording; },
            set isRecording(value: boolean) {
                isRecording = value;
                const statusEl = document.getElementById('whispra-translate-status') as HTMLSpanElement | null;
                if (statusEl) {
                    statusEl.textContent = value ? 'Running' : 'Idle';
                }
            },
            get recordingStartTime() { return recordingStartTime; },
            set recordingStartTime(value: number | null) { recordingStartTime = value; },
            get audioStream() { return audioStream; },
            set audioStream(value: MediaStream | null) { audioStream = value; },
            audioChunks,
            currentChunkData,
            chunkQueue,
            ttsQueue,
            get isPlayingTTS() { return isPlayingTTS; },
            set isPlayingTTS(value: boolean) { isPlayingTTS = value; },
            get streamingInterval() { return streamingInterval; },
            set streamingInterval(value: ReturnType<typeof setInterval> | null) { streamingInterval = value; },
            get mediaRecorder() { return mediaRecorder; },
            set mediaRecorder(value: MediaRecorder | null) { mediaRecorder = value; },
            get audioContext() { return audioContext; },
            set audioContext(value: AudioContext | null) { audioContext = value; },
            get analyserNode() { return analyserNode; },
            set analyserNode(value: AnalyserNode | null) { analyserNode = value; },
            get audioLevelCheckInterval() { return audioLevelCheckInterval; },
            set audioLevelCheckInterval(value: ReturnType<typeof setInterval> | null) { audioLevelCheckInterval = value; },
            get hasDetectedAudio() { return hasDetectedAudio; },
            set hasDetectedAudio(value: boolean) { hasDetectedAudio = value; },
            get audioDetectedThisSession() { return audioDetectedThisSession; },
            set audioDetectedThisSession(value: boolean) { audioDetectedThisSession = value; },
            get accentEnabled() { return accentEnabled; },
            get selectedAccent() { return selectedAccent; },
            get customAccentValue() { return customAccentValue; },

            // DOM elements
            recordingText,
            originalTextDiv,
            translatedTextDiv,
            voiceSelect,
            languageSelect,

            // PTT Overlay
            get pttOverlay() { return pttOverlay; },

            // Functions
            logToDebug,
            stopPassThrough,
            restartPassthroughClean,
            updateRecordingUI,
            speechToTextPushToTalk,
            translateText,
            applyAccentTag,
            synthesizeAndPlay,
            playAudioBuffer: async (audioBuffer: ArrayBuffer) => {
                // Convert ArrayBuffer to number array for playAudioInRenderer
                const uint8Array = new Uint8Array(audioBuffer);
                const numberArray = Array.from(uint8Array);
                await playAudioInRenderer(numberArray);
            }
        });

        // Initialize new settings modal
        const settingsIntegration = SettingsIntegration.getInstance();
        settingsIntegration.initializeSettings();

        await checkApiKeysConfiguration();
        setupRealTimeAudioPlayback();
        setupTestAudioPlayback();
        setupRealTimeTranslationAudio();
        setupRealTimeTTSChunks();
        setupRealTimeTTSComplete();
        setupClearAudioCapture();

        // Initialize update notification
        initializeUpdateNotification();

        // Initialize global hotkeys in main process
        await initializeGlobalHotkeys();

        // Setup update status listener for update page
        if ((window as any).electronAPI) {
            (window as any).electronAPI.onUpdateStatus((data: any) => {
                handleUpdateStatusChange(data);
            });
        }

        // Wire global hotkey events to existing handlers
        (window as any).electronAPI.setupGlobalHotkeys({
            onPttPress: async () => {
                try {
                    const isConfigured = await checkTranslationConfig();
                    if (!isConfigured) {
                        return; // Overlay shown by checkTranslationConfig
                    }
                    startRecordingModule();
                } catch (error) {
                    console.error('Error in onPttPress:', error);
                }
            },
            onPttRelease: () => { try { stopRecordingModule(); } catch { } },
            onToggleBidirectional: async () => {
                try {
                    const isConfigured = await checkTranslationConfig();
                    if (!isConfigured) {
                        return; // Overlay shown by checkTranslationConfig
                    }
                    toggleBidirectional();
                } catch (error) {
                    console.error('Error in onToggleBidirectional:', error);
                }
            },
            onToggleScreenTranslation: async () => {
                // Check warmup state dynamically
                try {
                    const response = await (window as any).electronAPI.invoke('config:get', {
                        id: Date.now().toString(),
                        timestamp: Date.now(),
                        payload: null
                    });
                    const warmupEnabled = response?.payload?.uiSettings?.paddleWarmupOnStartup !== false; // Default to true
                    
                    console.log(`🏓 Keybind check: warmupEnabled=${warmupEnabled}, isWarmingUp=${isPaddleWarmingUp}`);
                    
                    // Block if warmup is enabled and still warming up
                    if (warmupEnabled && isPaddleWarmingUp) {
                        console.log('🏓 Screen translation blocked - Paddle is warming up');
                        logToDebug('🏓 Screen translation blocked - Paddle is warming up');
                        return;
                    }
                } catch (error) {
                    console.error('⚠️ Error checking warmup state:', error);
                }
                
                // Check translation configuration
                try {
                    const isConfigured = await checkTranslationConfig();
                    if (!isConfigured) {
                        return; // Overlay shown by checkTranslationConfig
                    }
                    triggerScreenTranslation();
                } catch (error) {
                    console.error('Error in onToggleScreenTranslation:', error);
                }
            },
            onScreenTranslationBoxSelect: async () => {
                // Check warmup state dynamically
                try {
                    const response = await (window as any).electronAPI.invoke('config:get', {
                        id: Date.now().toString(),
                        timestamp: Date.now(),
                        payload: null
                    });
                    const warmupEnabled = response?.payload?.uiSettings?.paddleWarmupOnStartup !== false; // Default to true
                    
                    console.log(`🏓 Keybind check: warmupEnabled=${warmupEnabled}, isWarmingUp=${isPaddleWarmingUp}`);
                    
                    // Block if warmup is enabled and still warming up
                    if (warmupEnabled && isPaddleWarmingUp) {
                        console.log('🏓 Box selection blocked - Paddle is warming up');
                        logToDebug('🏓 Box selection blocked - Paddle is warming up');
                        return;
                    }
                } catch (error) {
                    console.error('⚠️ Error checking warmup state:', error);
                }
                console.log('📦 Box select hotkey event received in renderer!');
                try {
                    triggerScreenTranslationBoxSelect();
                } catch (e) {
                    console.error('Box select error:', e);
                }
            },
            onScreenTranslationWatchBoxSelect: async () => {
                // Check warmup state dynamically
                try {
                    const response = await (window as any).electronAPI.invoke('config:get', {
                        id: Date.now().toString(),
                        timestamp: Date.now(),
                        payload: null
                    });
                    const warmupEnabled = response?.payload?.uiSettings?.paddleWarmupOnStartup !== false; // Default to true
                    
                    console.log(`🏓 Keybind check: warmupEnabled=${warmupEnabled}, isWarmingUp=${isPaddleWarmingUp}`);
                    
                    // Block if warmup is enabled and still warming up
                    if (warmupEnabled && isPaddleWarmingUp) {
                        console.log('🏓 Watch box selection blocked - Paddle is warming up');
                        logToDebug('🏓 Watch box selection blocked - Paddle is warming up');
                        return;
                    }
                } catch (error) {
                    console.error('⚠️ Error checking warmup state:', error);
                }
                console.log('👁️ Watch box select hotkey event received in renderer!');
                try {
                    const { triggerScreenTranslationWatchBoxSelect } = await import('./renderer/screentrans/PaddleTriggerConfig.js');
                    triggerScreenTranslationWatchBoxSelect();
                } catch (e) {
                    console.error('Error in onScreenTranslationWatchBoxSelect:', e);
                }
            }
        });

        // Listen for Paddle warmup events
        console.log('🏓 Setting up Paddle warmup event listeners...');
        console.log(`🏓 Current warmup state: enabled=${isPaddleWarmupEnabled}, warmingUp=${isPaddleWarmingUp}`);
        
        if ((window as any).electronAPI.onPaddleWarmupStarted) {
            (window as any).electronAPI.onPaddleWarmupStarted(() => {
                console.log('🏓 [RENDERER] Paddle warmup started event received');
                isPaddleWarmingUp = true;
                console.log(`🏓 Updated state: isWarmingUp=${isPaddleWarmingUp}`);
                updateScreenTranslationStatus('warmup');
                // Update bidirectional status to show warmup
                if (bidirectionalStatusText) {
                    bidirectionalStatusText.textContent = 'Paddle warming...';
                    console.log('🏓 Updated bidirectional status to: Paddle warming...');
                }
                // Update footer processing status to show warmup
                if (processingStatus) {
                    processingStatus.textContent = 'Paddle warming...';
                    console.log('🏓 Updated footer processing status to: Paddle warming...');
                }
            });
            console.log('✅ onPaddleWarmupStarted listener registered');
        } else {
            console.warn('⚠️ onPaddleWarmupStarted not available on electronAPI');
        }

        if ((window as any).electronAPI.onPaddleWarmupCompleted) {
            (window as any).electronAPI.onPaddleWarmupCompleted(() => {
                console.log('🏓 [RENDERER] Paddle warmup completed event received');
                isPaddleWarmingUp = false;
                updateScreenTranslationStatus('ready');
                // Reset bidirectional status to Idle
                if (bidirectionalStatusText) {
                    const translations = {
                        'en': { idle: 'Idle' },
                        'es': { idle: 'Inactivo' },
                        'ru': { idle: 'Ожидание' },
                        'zh': { idle: '空闲' },
                        'ja': { idle: '待機中' }
                    };
                    const langTranslations = translations[currentLanguage as keyof typeof translations] || translations['en'];
                    bidirectionalStatusText.textContent = langTranslations.idle;
                }
                // Reset footer processing status to Idle
                if (processingStatus) {
                    processingStatus.textContent = 'Idle';
                }
            });
            console.log('🏓 onPaddleWarmupCompleted listener registered');
        } else {
            console.warn('⚠️ onPaddleWarmupCompleted not available on electronAPI');
        }

        // Listen for config updates from overlay
        setupConfigUpdateListener();

        // Listen for overlay control commands
        setupOverlayControlListeners();

        // Listen for subscription required errors
        setupSubscriptionErrorListener();

        // Listen for subscription expired events
        setupSubscriptionExpiredListener();

        // Listen for API errors
        setupApiErrorListeners();

        // Check and display trial status
        await checkAndDisplayTrialStatus();

        // Listen for screen translation stopped events
        (window as any).electronAPI?.onScreenTranslationStopped?.(() => {
            logToDebug('📺 Received screen translation stopped event, updating UI');
            updateScreenTranslationStatus('ready');
        });

        // Always set output to virtual device on startup (users can change it if needed)
        outputToVirtualDevice = true;
        updateOutputToggleButton();

        await restoreSidebarPreference();

        // Check if whispra-translate panel is visible on initial load and initialize it
        // This ensures the UI loads properly even if it's the default tab
        const isWhispraTranslateVisible = whispraTranslatePanel && 
            whispraTranslatePanel.style.display !== 'none' && 
            window.getComputedStyle(whispraTranslatePanel).display !== 'none';
        const isWhispraTranslateActive = whispraTranslateButton && whispraTranslateButton.classList.contains('active');
        
        if (isWhispraTranslateVisible || isWhispraTranslateActive) {
            console.log('🔄 Whispra translate panel is visible on load, initializing...');
            // Initialize lucide icons for the whispra translate panel
            if (typeof (window as any).lucide !== 'undefined' && (window as any).lucide.createIcons) {
                (window as any).lucide.createIcons();
            }
            // Initialize settings dropdowns
            initializeWhispraTranslateDropdowns();
            // Initialize language selectors
            initializeWhispraTranslateLanguages();
            // Initialize output toggle
            initializeWhispraTranslateOutputToggle();
            // Initialize translate settings (microphone, voice, accent)
            initializeWhispraTranslateSettings();
            // Initialize keybind displays
            initializeWhispraTranslateKeybinds();
            // Initialize captions
            initializeWhispraTranslateCaptions();
            // Initialize bidirectional incoming voices
            loadWhispraBidirectionalIncomingVoices();
            // Initialize status texts (get elements dynamically)
            const translateStatusEl = document.getElementById('whispra-translate-status') as HTMLSpanElement | null;
            if (translateStatusEl) {
                translateStatusEl.textContent = isRecording ? 'Running' : 'Idle';
            }
            const bidirectionalStatusEl = document.getElementById('whispra-bidirectional-status') as HTMLSpanElement | null;
            if (bidirectionalStatusEl) {
                bidirectionalStatusEl.textContent = isBidirectionalActive ? 'Running' : 'Idle';
            }
        }

        logToDebug('Application initialized successfully');

        // Auto-start translation so users only need to hold down keys
        if (!isTranslating) {
            console.log('🚀 Auto-starting translation on app load...');
            await toggleTranslation();
        }

        // Initialize automatic microphone passthrough AFTER preferences are restored
        await initializeAutomaticPassthrough();

        // Add global click listener to retry blocked passthrough
        document.addEventListener('click', retryPassthroughOnInteraction, { once: true });

        // Start periodic health check to ensure passthrough stays active
        startPassthroughHealthCheck();

        // Set output to virtual device on app close
        window.addEventListener('beforeunload', saveVirtualDevicePreference);
        window.addEventListener('beforeunload', () => {
            if (interactiveCharacterHandle) {
                interactiveCharacterHandle.dispose();
                interactiveCharacterHandle = null;
            }
        });

        // NOTE: bidirectional-toggle listener is already set up in setupGlobalHotkeys()
        // Do NOT add a duplicate listener here - it causes double-toggle issues

        // Set up IPC listener for tab switching
        window.electronAPI.on('switch-to-tab', (tabName: string) => {
            console.log('Received switch-to-tab request:', tabName);
            if (tabName === 'translation') {
                switchTab('translate');
            }
        });

        // Set up IPC listener for tutorial start
        window.electronAPI.on('tutorial:start', async () => {
            try {
                const { TutorialOverlay } = await import('./ui/TutorialOverlay.js');
                const tutorial = TutorialOverlay.getInstance();
                await tutorial.start();
            } catch (error) {
                console.error('Failed to start tutorial:', error);
            }
        });

        // Set up tutorial completion monitoring for VB Audio overlay coordination
        const monitorTutorialCompletion = () => {
            const checkInterval = setInterval(async () => {
                try {
                    const { TutorialOverlay } = await import('./ui/TutorialOverlay.js');
                    const tutorial = TutorialOverlay.getInstance();
                    
                    // If tutorial was active but is no longer active, it completed
                    if (!tutorial.isCurrentlyActive() && tutorial.hasCompleted()) {
                        clearInterval(checkInterval);
                        // Notify main process that tutorial completed
                        window.electronAPI.send('tutorial:completed');
                        console.log('🎓 Tutorial completion detected and notified to main process');
                    }
                } catch (error) {
                    // Silently continue - tutorial might not be loaded yet
                }
            }, 1000); // Check every second
            
            // Stop monitoring after 10 minutes (tutorial should be done by then)
            setTimeout(() => {
                clearInterval(checkInterval);
            }, 600000);
        };
        
        // Start monitoring after a short delay
        setTimeout(monitorTutorialCompletion, 2000);

        // Set up IPC listener for opening settings from system tray
        window.electronAPI.on('open-settings', () => {
            console.log('Received open-settings request from system tray');
            try {
                const settingsIntegration = SettingsIntegration.getInstance();
                settingsIntegration.showSettings('api-keys');
            } catch (error) {
                console.error('Failed to open settings from system tray:', error);
            }
        });

        // Set up IPC listener for opening settings from menu
        window.electronAPI.on('menu:open-settings', () => {
            console.log('Received menu:open-settings request from menu');
            try {
                const settingsIntegration = SettingsIntegration.getInstance();
                settingsIntegration.showSettings('api-keys');
            } catch (error) {
                console.error('Failed to open settings from menu:', error);
            }
        });

        // Set up IPC listener for fallback notifications
        window.electronAPI.on('show-fallback-notification', (data: { service: string; serviceName: string; message: string }) => {
            console.log('Received fallback notification:', data);
            try {
                showFallbackNotification(data.service as 'openai' | 'elevenlabs', data.serviceName, data.message);
            } catch (error) {
                console.error('Failed to show fallback notification:', error);
            }
        });

        // Check if tutorial should be shown automatically on first sign-in
        // This should run before VB Audio overlay and other first-time dialogs
        setTimeout(async () => {
            try {
                // Check if user is signed in (by checking if we can get user ID)
                const userIdResponse = await (window as any).electronAPI.invoke('subscription:get-user-id', {
                    id: Date.now().toString(),
                    timestamp: Date.now(),
                    payload: null
                });

                if (userIdResponse && userIdResponse.success && userIdResponse.payload) {
                    // User is signed in, check if tutorial has been completed
                    const { TutorialOverlay } = await import('./ui/TutorialOverlay.js');
                    const tutorial = TutorialOverlay.getInstance();

                    if (!tutorial.hasCompleted()) {
                        console.log('🎓 First-time user detected, showing tutorial...');
                        await tutorial.start();
                    }
                }
            } catch (error) {
                // Silently fail - user might not be signed in yet or tutorial system unavailable
                console.log('Tutorial auto-check skipped:', error);
            }
        }, 500); // Small delay to ensure everything is initialized, but before VB Audio overlay (2s delay)

        // Initialize GPU Paddle button
        await initializeGPUPaddleButton();

        // Initialize all event listeners
        console.log('Initializing event listeners...');
        initializeEventListeners({
            // DOM elements
            startButton,
            refreshVoicesButton,
            outputToggleButton,
            debugToggle,
            affiliateButton,
            feedbackButton,
            sidebarToggleButton,
            appSidebar,
            sidebarSettingsButton,
            sidebarTranslateButton,
            sidebarBidirectionalButton,
            soundBoardButton,
            voiceFilterButton,
            quickTranslateButton,
            whispraTranslateButton,
            microphoneSelect,
            languageSelect,
            voiceSelect,
            accentPreset,
            accentToggle,
            customAccentText,
            changeKeybindBtn,
            whispraTranslatePTTKeybindContainer,
            whispraTranslateBidiKeybindContainer,
            bidirectionalToggleButton,
            bidirectionalChangeKeybindBtn,
            bidirectionalOutputSelect,
            incomingVoiceSelect,
            bidirectionalProcessSelect,
            bidirectionalRefreshProcessesBtn,
            bidirectionalSourceLanguageSelect,
            bidirectionalTargetLanguageSelect,
            bidirectionalCaptionsToggle,
            bidirectionalCaptionsSettings,
            screenTranslationButton,
            screenTranslationTriggerButton,
            screenTranslationChangeKeybindBtn,
            screenTranslationTargetLang,
            screenTranslationSourceLang,
            screenTranslationDisplaySelect,
            bidirectionalPanel,
            bidirectionalStatusText,
            bidirectionalDetectedText,
            currentKeybindSpan,
            translationKeybindDisplay,
            bidirectionalKeybindSpan,
            bidirectionalKeybindDisplay,
            screenTranslationKeybindSpan,
            screenTranslationKeybindDisplay,

            // Functions
            toggleTranslation,
            logToDebug,
            loadVoices,
            toggleOutputTarget,
            toggleDebugConsole,
            toggleSidebar,
            switchTab,
            onMicrophoneChange,
            onLanguageChange,
            onVoiceChange,
            onAccentPresetChange,
            onAccentToggleClick,
            onCustomAccentInput,
            onCustomAccentKeydown,
            onCustomAccentBlur,
            showKeybindModal,
            handleKeyDown,
            handleKeyUp,
            showBidirectionalKeybindModal,
            showWhispraPTTKeybindModal,
            showWhispraBidirectionalKeybindModal,
            onBidirectionalOutputChange,
            onIncomingVoiceChange,
            onBidirectionalProcessChange,
            loadBidirectionalProcesses,
            onBidirectionalSourceLanguageChange,
            onBidirectionalTargetLanguageChange,
            toggleBidirectionalCaptions,
            showCaptionsSettingsModal,
            startRecording: startRecordingModule,
            stopRecording: stopRecordingModule,
            isTranslating,
            setBidirectionalStatus,
            isBidirectionalActive,
            bidirectionalKeybind,
            screenTranslationKeybind,

            // Global variables
            languageToggle,
            currentLanguage
        });
        console.log('Event listeners initialized successfully');

        // Initialize WebSocket status indicator
        initializeWebSocketStatus();

    } catch (error) {
        console.error('Initialization error:', error);
        logToDebug(`Initialization error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
});

// Set up real-time audio playback listener
function setupRealTimeAudioPlayback(): void {
    // Keep listener available but do nothing to avoid duplicate playback
    (window as any).electronAPI.setupRealTimeAudioPlayback(() => { });
}

// Set up test audio playback listener
function setupTestAudioPlayback(): void {
    // No-op: we now play test audio from invoke response to avoid double-playback
}

// Set up real-time translation audio playback listener
function setupRealTimeTranslationAudio(): void {
    (window as any).electronAPI.setupRealTimeTranslationAudio((data: any) => {
        try {
            const { audioData, originalText, translatedText, outputToVirtualMic, isRealTime } = data;

            logToDebug(`🔄 Real-time translation: "${originalText}" → "${translatedText}"`);

            // Update UI with the translation
            if (originalTextDiv && translatedTextDiv) {
                originalTextDiv.textContent = originalText;
                originalTextDiv.classList.remove('processing', 'empty');

                translatedTextDiv.textContent = translatedText;
                translatedTextDiv.classList.remove('empty');
            }
            // If Bidirectional tab is active, mirror content there when applicable
            if (bidirectionalDetectedText && bidirectionalRespokenText && isBidirectionalActive) {
                bidirectionalDetectedText.textContent = originalText;
                bidirectionalDetectedText.classList.remove('empty');
                bidirectionalRespokenText.textContent = translatedText;
                bidirectionalRespokenText.classList.remove('empty');
            }
            // Always update whispra translate panel (right side - bidirectional source)
            const whispraRightSourceText = document.getElementById('whispra-right-source-text') as HTMLDivElement;
            if (whispraRightSourceText) {
                whispraRightSourceText.textContent = originalText;
                whispraRightSourceText.classList.remove('processing', 'empty');
            }
            // Always update whispra translate panel (right side - bidirectional)
            const whispraRightTargetText = document.getElementById('whispra-right-target-text') as HTMLDivElement;
            if (whispraRightTargetText) {
                whispraRightTargetText.textContent = translatedText;
                whispraRightTargetText.classList.remove('processing', 'empty');
            }
            // Always update Whispra Translate panel glasscards (live panel logic)
            const whispraLeftSourceText = document.getElementById('whispra-left-source-text') as HTMLDivElement;
            const whispraLeftTargetText = document.getElementById('whispra-left-target-text') as HTMLDivElement;
            if (whispraLeftSourceText) {
                whispraLeftSourceText.textContent = originalText;
                whispraLeftSourceText.classList.remove('processing', 'empty');
            }
            if (whispraLeftTargetText) {
                whispraLeftTargetText.textContent = translatedText;
                whispraLeftTargetText.classList.remove('processing', 'empty');
            }

            // Play the translated audio
            playRealTimeTranslationAudio(audioData, outputToVirtualMic);

        } catch (error) {
            console.error('Error handling real-time translation audio:', error);
            logToDebug(`❌ Real-time translation audio error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    });
}

// Chunk sequencing buffer to ensure chunks are processed in order
let chunkSequenceBuffer: Map<number, { audioBuffer: ArrayBuffer, isFinal: boolean }> = new Map();
let nextExpectedChunkIndex: number = 0;
let isProcessingChunks: boolean = false;

/**
 * Process buffered chunks in sequence
 */
async function processSequencedChunks(): Promise<void> {
    if (isProcessingChunks) {
        return; // Already processing
    }

    isProcessingChunks = true;

    try {
        // Process chunks in order while we have the next expected chunk
        while (chunkSequenceBuffer.has(nextExpectedChunkIndex)) {
            const chunkData = chunkSequenceBuffer.get(nextExpectedChunkIndex)!;
            chunkSequenceBuffer.delete(nextExpectedChunkIndex);

            console.log(`📤 Processing chunk ${nextExpectedChunkIndex} in sequence`);

            // Add chunk to streaming player
            if (streamingAudioPlayer) {
                await streamingAudioPlayer.addChunk(
                    chunkData.audioBuffer,
                    nextExpectedChunkIndex,
                    chunkData.isFinal
                );
            }

            nextExpectedChunkIndex++;
        }

        // Log if we have buffered out-of-order chunks waiting
        if (chunkSequenceBuffer.size > 0) {
            const waitingIndices = Array.from(chunkSequenceBuffer.keys()).sort((a, b) => a - b);
            console.log(`⏸️ Waiting for chunk ${nextExpectedChunkIndex}, have buffered: ${waitingIndices.join(', ')}`);
        }
    } finally {
        isProcessingChunks = false;
    }
}

// Set up real-time TTS chunk playback listener
function setupRealTimeTTSChunks(): void {
    (window as any).electronAPI.on('realtime-tts-chunk', async (data: any) => {
        try {
            // Validate data
            if (!data) {
                console.warn('⚠️ Received undefined TTS chunk data');
                return;
            }

            const { audioData, chunkIndex, isFirstChunk, isFinal, bufferSize, originalText, translatedText } = data;

            // Validate audioData
            if (!audioData || !Array.isArray(audioData) || audioData.length === 0) {
                console.warn('⚠️ Received invalid or empty audioData in TTS chunk');
                return;
            }

            console.log(`🎵 Received TTS chunk ${chunkIndex}: ${bufferSize || audioData.length} bytes${isFinal ? ' (FINAL)' : ''}`);

            // Convert array back to ArrayBuffer
            const audioBuffer = new Uint8Array(audioData).buffer;

            // Initialize streaming player if this is the first chunk
            if (isFirstChunk || !streamingAudioPlayer) {
                if (streamingAudioPlayer) {
                    streamingAudioPlayer.stop();
                    streamingAudioPlayer.cleanup();
                }
                // Pass bidirectionalOutputDeviceId to route audio to VB-Audio Cable (prevents feedback loop)
                streamingAudioPlayer = new StreamingAudioPlayer(MASTER_AUDIO_VOLUME, bidirectionalOutputDeviceId || undefined);
                console.log('🎵 Initialized streaming audio player for new TTS stream');

                // Reset sequence tracking for new stream
                chunkSequenceBuffer.clear();
                nextExpectedChunkIndex = 0;
            }

            // Add chunk to sequence buffer
            chunkSequenceBuffer.set(chunkIndex, { audioBuffer, isFinal: isFinal || false });

            // Process chunks in sequence
            await processSequencedChunks();

        } catch (error) {
            console.error('Error handling real-time TTS chunk:', error);
        }
    });
}

// Set up real-time TTS completion listener
function setupRealTimeTTSComplete(): void {
    (window as any).electronAPI.on('realtime-tts-complete', async (data: any) => {
        try {
            console.log('🏁 Received TTS streaming completion signal');

            // Force the streaming player to flush any remaining chunks
            if (streamingAudioPlayer) {
                console.log('🔊 Flushing remaining audio chunks...');
                streamingAudioPlayer.flush();

                // Verify playback is happening
                if (streamingAudioPlayer.isCurrentlyPlaying()) {
                    console.log('✅ Audio playback is active');
                } else {
                    console.warn('⚠️ Audio playback not active after flush');
                }
            } else {
                console.warn('⚠️ No streaming audio player available for flush');
            }
        } catch (error) {
            console.error('Error handling TTS completion signal:', error);
        }
    });
}

// Set up clear audio capture listener
function setupClearAudioCapture(): void {
    (window as any).electronAPI.setupClearAudioCapture(async (data: any) => {
        try {
            const { reason } = data;
            logToDebug(`🧹 Clearing audio capture - reason: ${reason}`);

            // Clear the audio chunks to prevent re-processing
            audioChunks = [];

            // Reset processing flag
            isProcessingAudio = false;

            // Stop and restart the MediaRecorder to prevent corrupted audio
            if (mediaRecorder && isTranslating) {
                logToDebug('🔄 Restarting MediaRecorder to prevent audio corruption');
                try {
                    // Stop the current recorder
                    if (mediaRecorder.state === 'recording' || mediaRecorder.state === 'paused') {
                        mediaRecorder.stop();
                    }

                    // Wait a moment for it to fully stop
                    await new Promise(resolve => setTimeout(resolve, 100));

                    // Restart the recorder with fresh audio stream
                    await restartRealTimeAudioCapture();

                } catch (restartError) {
                    console.error('Failed to restart MediaRecorder:', restartError);
                    logToDebug(`❌ MediaRecorder restart failed: ${restartError instanceof Error ? restartError.message : 'Unknown error'}`);
                }
            }

            // Clear UI text after a short delay to let user see the result
            setTimeout(() => {
                if (originalTextDiv && translatedTextDiv) {
                    originalTextDiv.textContent = '';
                    originalTextDiv.classList.add('empty');
                    translatedTextDiv.textContent = '';
                    translatedTextDiv.classList.add('empty');
                }
                // Also clear whispra translate panel (live panel logic)
                const whispraLeftSourceText = document.getElementById('whispra-left-source-text') as HTMLDivElement;
                const whispraLeftTargetText = document.getElementById('whispra-left-target-text') as HTMLDivElement;
                if (whispraLeftSourceText) {
                    whispraLeftSourceText.textContent = '';
                    whispraLeftSourceText.classList.add('empty');
                }
                if (whispraLeftTargetText) {
                    whispraLeftTargetText.textContent = '';
                    whispraLeftTargetText.classList.add('empty');
                }

                if (recordingText) {
                    recordingText.textContent = 'Listening continuously...';
                }

                logToDebug('🧹 UI cleared after translation');
            }, 2000); // Show result for 2 seconds before clearing

        } catch (error) {
            console.error('Error handling clear audio capture:', error);
            logToDebug(`❌ Clear audio capture error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    });
}

// Play test translated audio
async function playTestAudio(audioData: number[], outputToHeadphones: boolean): Promise<void> {
    try {
        // Convert array back to ArrayBuffer
        const audioBuffer = new Uint8Array(audioData).buffer;
        const audioBlob = new Blob([audioBuffer], { type: 'audio/mpeg' });

        // Create audio element and play
        const audio = new Audio();
        const url = URL.createObjectURL(audioBlob);

        audio.onended = () => {
            URL.revokeObjectURL(url);
        };

        audio.onerror = (error) => {
            URL.revokeObjectURL(url);
            console.error('Test audio playback error:', error);
        };

        audio.src = url;
        audio.volume = MASTER_AUDIO_VOLUME;
        if (!outputToHeadphones && outputToVirtualDevice && virtualOutputDeviceId && 'setSinkId' in audio) {
            try {
                await (audio as any).setSinkId(virtualOutputDeviceId);
                logToDebug(`🔌 Routed test audio to virtual output: ${virtualOutputDeviceId}`);
            } catch (e) {
                logToDebug('⚠️ Failed to route test audio to virtual output, using default output');
            }
        }

        await audio.play();

        logToDebug(`🔊 Test audio played successfully (headphones: ${outputToHeadphones})`);

    } catch (error) {
        console.error('Failed to play test audio:', error);
        logToDebug(`❌ Test audio playback failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

// Play real-time translated audio
async function playRealTimeAudio(audioData: number[], outputToVirtualMic: boolean): Promise<void> {
    try {
        // Convert array back to ArrayBuffer
        const audioBuffer = new Uint8Array(audioData).buffer;
        const audioBlob = new Blob([audioBuffer], { type: 'audio/mpeg' });

        // Create audio element and play
        const audio = new Audio();
        const url = URL.createObjectURL(audioBlob);

        audio.onended = () => {
            URL.revokeObjectURL(url);
        };

        audio.onerror = (error) => {
            URL.revokeObjectURL(url);
            console.error('Audio playback error:', error);
        };

        audio.src = url;

        audio.volume = MASTER_AUDIO_VOLUME;

        if (outputToVirtualMic && outputToVirtualDevice) {
            if (virtualOutputDeviceId && 'setSinkId' in audio) {
                try {
                    await (audio as any).setSinkId(virtualOutputDeviceId);
                    logToDebug(`🔌 Routed real-time audio to virtual output: ${virtualOutputDeviceId} (1% volume)`);
                } catch (e) {
                    logToDebug('⚠️ Failed to route real-time audio to virtual output, using default output');
                }
            }
            logToDebug('🎤 Playing translated audio (virtual microphone mode, 1% volume)');
        } else {
            logToDebug('🔊 Playing translated audio (headphone mode, 1% volume)');
        }

        await audio.play();

    } catch (error) {
        console.error('Failed to play real-time audio:', error);
        logToDebug(`❌ Audio playback failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

// Play real-time translation audio with feedback prevention
async function playRealTimeTranslationAudio(audioData: number[], outputToVirtualMic: boolean): Promise<void> {
    try {
        // Temporarily pause audio capture to prevent feedback
        const wasCapturing = mediaRecorder && mediaRecorder.state === 'recording' && isTranslating;
        if (wasCapturing) {
            logToDebug('⏸️ Temporarily pausing audio capture to prevent feedback');
            try {
                mediaRecorder!.pause();
            } catch (pauseError) {
                console.warn('⚠️ Failed to pause MediaRecorder:', pauseError);
            }
        }

        // Convert array back to ArrayBuffer
        const audioBuffer = new Uint8Array(audioData).buffer;
        const audioBlob = new Blob([audioBuffer], { type: 'audio/mpeg' });

        // Create audio element and play
        const audio = new Audio();
        const url = URL.createObjectURL(audioBlob);

        audio.onended = () => {
            URL.revokeObjectURL(url);
            // Resume audio capture after playback ends
            if (wasCapturing && mediaRecorder && mediaRecorder.state === 'paused' && isTranslating) {
                setTimeout(() => {
                    if (mediaRecorder && mediaRecorder.state === 'paused' && isTranslating) {
                        logToDebug('Resuming audio capture after playback');
                        try {
                            mediaRecorder.resume();
                        } catch (resumeError) {
                            console.warn('⚠️ Failed to resume MediaRecorder:', resumeError);
                        }
                    }
                }, 500); // Small delay to ensure audio has finished
            }
        };

        audio.onerror = (error) => {
            URL.revokeObjectURL(url);
            console.error('Real-time audio playback error:', error);
            // Resume capture even on error
            if (wasCapturing && mediaRecorder && mediaRecorder.state === 'paused' && isTranslating) {
                try {
                    mediaRecorder.resume();
                } catch (resumeError) {
                    console.warn('⚠️ Failed to resume MediaRecorder after error:', resumeError);
                }
            }
        };

        audio.src = url;

        audio.volume = MASTER_AUDIO_VOLUME;

        if (outputToVirtualMic && outputToVirtualDevice) {
            if (virtualOutputDeviceId && 'setSinkId' in audio) {
                try {
                    await (audio as any).setSinkId(virtualOutputDeviceId);
                    logToDebug(`🔌 Routed real-time translation audio to virtual output: ${virtualOutputDeviceId} (1% volume)`);
                } catch (e) {
                    logToDebug('⚠️ Failed to route real-time translation audio to virtual output, using default output');
                }
            }
            logToDebug('🎤 Playing real-time translated audio (virtual microphone mode, 1% volume)');
        } else {
            logToDebug('🔊 Playing real-time translated audio (headphone mode, 1% volume)');
        }

        await audio.play();

    } catch (error) {
        console.error('Failed to play real-time translation audio:', error);
        logToDebug(`❌ Real-time translation audio playback failed: ${error instanceof Error ? error.message : 'Unknown error'}`);

        // Resume capture on error
        if (mediaRecorder && mediaRecorder.state === 'paused') {
            mediaRecorder.resume();
        }
    }
}




async function openSettings(): Promise<void> {
    logToDebug('Opening settings...');

    try {
        // Use the new settings modal with API Keys as default tab
        const settingsIntegration = SettingsIntegration.getInstance();
        settingsIntegration.showSettings('api-keys');
    } catch (error) {
        logToDebug(`Error opening settings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

//removed function of api keymodal

async function toggleDebugConsole(): Promise<void> {
    isDebugVisible = !isDebugVisible;

    if (isDebugVisible) {
        debugConsole.classList.add('visible');
                    if (debugToggle) {
            debugToggle.textContent = 'Hide Debug Console';
        }
    } else {
        debugConsole.classList.remove('visible');
        if (debugToggle) {
            debugToggle.textContent = 'Show Debug Console';
        }
    }

    // Save the preference
    try {
        await (window as any).electronAPI.invoke('config:set', {
            id: Date.now().toString(),
            timestamp: Date.now(),
            payload: {
                uiSettings: {
                    showDebugConsole: isDebugVisible
                }
            }
        });
    } catch (error) {
        logToDebug(`Error saving debug console preference: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

// Make toggleDebugConsole globally accessible for the SideButton component
(window as any).toggleDebugConsole = toggleDebugConsole;

// Sidebar state persistence
async function restoreSidebarPreference(): Promise<void> {
    try {
        const response = await (window as any).electronAPI.invoke('config:get', {
            id: Date.now().toString(),
            timestamp: Date.now(),
            payload: null
        });
        if (response.success && response.payload?.uiSettings?.sidebarCollapsed !== undefined) {
            const collapsed = !!response.payload.uiSettings.sidebarCollapsed;
            setSidebarCollapsed(collapsed);
        }
    } catch {
        // ignore
    }
}

function setupConfigUpdateListener(): void {
    if (!(window as any).electronAPI?.onConfigUpdated) return;

    (window as any).electronAPI.onConfigUpdated(async (config: any) => {
        try {
            console.log('Received config update from overlay:', config);

            // Update target language dropdown
            if (config.targetLanguage && languageSelect && languageSelect.value !== config.targetLanguage) {
                languageSelect.value = config.targetLanguage;
                console.log('Updated main app target language to:', config.targetLanguage);
            }

            // Update whispra translate target language
            const whispraLeftTargetLang = document.getElementById('whispra-left-target-lang') as HTMLSelectElement;
            if (config.targetLanguage && whispraLeftTargetLang && whispraLeftTargetLang.value !== config.targetLanguage) {
                whispraLeftTargetLang.value = config.targetLanguage;
                console.log('Updated whispra translate target language to:', config.targetLanguage);
            }

            // Update voice selection dropdown
            if (config.voiceId && voiceSelect && voiceSelect.value !== config.voiceId) {
                voiceSelect.value = config.voiceId;
                console.log('Updated main app voice selection to:', config.voiceId);
            }

            // Update whispra translate voice
            const whispraVoiceSelect = document.getElementById('whispra-translate-voice') as HTMLSelectElement;
            if (config.voiceId && whispraVoiceSelect && whispraVoiceSelect.value !== config.voiceId) {
                whispraVoiceSelect.value = config.voiceId;
                console.log('Updated whispra translate voice to:', config.voiceId);
            }

            // Update microphone selection dropdown from saved config
            if (config.selectedMicrophone && microphoneSelect && microphoneSelect.value !== config.selectedMicrophone) {
                microphoneSelect.value = config.selectedMicrophone;
                console.log('Updated main app microphone selection to:', config.selectedMicrophone);
            }

            // Update whispra translate microphone
            const whispraMicSelect = document.getElementById('whispra-translate-microphone') as HTMLSelectElement;
            if (config.selectedMicrophone && whispraMicSelect && whispraMicSelect.value !== config.selectedMicrophone) {
                whispraMicSelect.value = config.selectedMicrophone;
                console.log('Updated whispra translate microphone to:', config.selectedMicrophone);
            }

            // bidirectionalInputDevice config update removed - now hardcoded to Display/System Audio

            // Bidirectional output device is now locked to default device - no need to update from config
            // The output dropdown is disabled and shows the default device only

            // Update incoming voice if it exists
            if (config.uiSettings?.incomingVoiceId && incomingVoiceSelect && incomingVoiceSelect.value !== config.uiSettings.incomingVoiceId) {
                incomingVoiceSelect.value = config.uiSettings.incomingVoiceId;
                console.log('Updated main app incoming voice to:', config.uiSettings.incomingVoiceId);
            }

            // Update whispra translate bidirectional incoming voice if it exists
            const whispraBidiVoiceSelect = document.getElementById('whispra-bidirectional-incoming-voice') as HTMLSelectElement;
            if (config.uiSettings?.incomingVoiceId && whispraBidiVoiceSelect && whispraBidiVoiceSelect.value !== config.uiSettings.incomingVoiceId) {
                whispraBidiVoiceSelect.value = config.uiSettings.incomingVoiceId;
                console.log('Updated whispra translate bidirectional incoming voice to:', config.uiSettings.incomingVoiceId);
            }

            // Update bidirectional source language if it exists
            if (config.uiSettings?.bidirectionalSourceLanguage !== undefined) {
                bidirectionalSourceLanguage = config.uiSettings.bidirectionalSourceLanguage;
                if (bidirectionalSourceLanguageSelect && bidirectionalSourceLanguageSelect.value !== bidirectionalSourceLanguage) {
                    bidirectionalSourceLanguageSelect.value = bidirectionalSourceLanguage;
                    console.log('Updated main app bidirectional source language to:', bidirectionalSourceLanguage);
                }

                // Update whispra translate right side source language (bidirectional side)
                const whispraRightSourceLang = document.getElementById('whispra-right-source-lang') as HTMLSelectElement;
                if (whispraRightSourceLang && whispraRightSourceLang.querySelector(`option[value="${bidirectionalSourceLanguage}"]`)) {
                    whispraRightSourceLang.value = bidirectionalSourceLanguage;
                    console.log('Updated whispra translate right source language to:', bidirectionalSourceLanguage);
                } else if (whispraRightSourceLang && bidirectionalSourceLanguage === 'auto') {
                    // For 'auto', try to get spoken language from config
                    try {
                        const configResponse = await (window as any).electronAPI.invoke('config:get', {
                            id: Date.now().toString(),
                            timestamp: Date.now(),
                            payload: null
                        });
                        if (configResponse.success && configResponse.payload?.userPreferences?.spokenLanguage) {
                            const spokenLang = configResponse.payload.userPreferences.spokenLanguage;
                            if (whispraRightSourceLang.querySelector(`option[value="${spokenLang}"]`)) {
                                whispraRightSourceLang.value = spokenLang;
                                console.log('Updated whispra translate right source language to spoken language:', spokenLang);
                            }
                        }
                    } catch (e) {
                        // Ignore errors
                    }
                }
            }

            // Update bidirectional target language if it exists
            if (config.uiSettings?.bidirectionalTargetLanguage !== undefined) {
                bidirectionalTargetLanguage = config.uiSettings.bidirectionalTargetLanguage;
                if (bidirectionalTargetLanguageSelect && bidirectionalTargetLanguageSelect.value !== bidirectionalTargetLanguage) {
                    bidirectionalTargetLanguageSelect.value = bidirectionalTargetLanguage;
                    console.log('Updated main app bidirectional target language to:', bidirectionalTargetLanguage);
                }

                // Update whispra translate right side target language (bidirectional side)
                const whispraRightTargetLang = document.getElementById('whispra-right-target-lang') as HTMLSelectElement;
                if (whispraRightTargetLang && whispraRightTargetLang.querySelector(`option[value="${bidirectionalTargetLanguage}"]`)) {
                    whispraRightTargetLang.value = bidirectionalTargetLanguage;
                    console.log('Updated whispra translate right target language to:', bidirectionalTargetLanguage);
                }
            }

            // Capture source removed - main app uses visual overlay selection instead of dropdown

            // Update output toggle if it exists (skip if we're currently toggling to avoid conflicts)
            if (config.uiSettings?.outputToVirtualDevice !== undefined && outputToggleButton && !isTogglingOutput) {
                outputToVirtualDevice = !!config.uiSettings.outputToVirtualDevice;
                updateOutputToggleButton();
                console.log('Updated main app output preference to:', outputToVirtualDevice ? 'Virtual Device' : 'App/Headphones');
            }

            // Update whispra translate output toggle (skip if we're currently toggling to avoid conflicts)
            const whispraOutputToggleBtn = document.getElementById('whispra-translate-output-toggle-btn') as HTMLButtonElement;
            if (config.uiSettings?.outputToVirtualDevice !== undefined && whispraOutputToggleBtn && !isTogglingOutput) {
                outputToVirtualDevice = !!config.uiSettings.outputToVirtualDevice;
                const iconName = outputToVirtualDevice ? 'arrow-left-right' : 'headphones';
                const text = outputToVirtualDevice ? 'Output: Virtual Device' : 'Output: App/Headphones';
                whispraOutputToggleBtn.innerHTML = `<i data-lucide="${iconName}" style="width: 16px; height: 16px; margin-right: 0.5rem;"></i>${text}`;
                const whispraOutputToggleIcon = document.getElementById('whispra-translate-output-toggle') as HTMLButtonElement;
                if (whispraOutputToggleIcon) {
                    const iconElement = whispraOutputToggleIcon.querySelector('i[data-lucide], svg[data-lucide]') as HTMLElement;
                    if (iconElement) {
                        if (iconElement.tagName === 'SVG') {
                            iconElement.outerHTML = `<i data-lucide="${iconName}" style="width: 18px; height: 18px;"></i>`;
                        } else {
                            iconElement.setAttribute('data-lucide', iconName);
                        }
                    }
                }
                if (typeof (window as any).lucide !== 'undefined' && (window as any).lucide.createIcons) {
                    (window as any).lucide.createIcons();
                }
                console.log('Updated whispra translate output preference to:', outputToVirtualDevice ? 'Virtual Device' : 'App/Headphones');
            }

            // Update PTT hotkey if it exists
            if (config.uiSettings?.pttHotkey) {
                const pttHotkey = config.uiSettings.pttHotkey;
                let pttKey = pttHotkey.key;
                if (pttKey.startsWith('Key') && pttKey.length === 4) {
                    currentKeybind = pttKey;
                } else if (pttKey === 'Space') {
                    currentKeybind = 'Space';
                } else if (/^[A-Z]$/i.test(pttKey)) {
                    currentKeybind = `Key${pttKey.toUpperCase()}`;
                } else {
                    currentKeybind = pttKey;
                }
                // Update UI display
                updatePTTKeybindDisplay(currentKeybind, currentKeybindSpan, translationKeybindDisplay);
                
                // Update whispra translate PTT keybind display
                const whispraPTTKeybind = document.getElementById('whispra-translate-ptt-keybind') as HTMLElement;
                if (whispraPTTKeybind) {
                    const displayKey = currentKeybind === 'Space' ? 'Space' :
                        currentKeybind.startsWith('Key') ? currentKeybind.substring(3) :
                            currentKeybind;
                    const modifiers = [];
                    if (pttHotkey.ctrl) modifiers.push('Ctrl');
                    if (pttHotkey.alt) modifiers.push('Alt');
                    if (pttHotkey.shift) modifiers.push('Shift');
                    const displayText = modifiers.length > 0 ? `${modifiers.join(' + ')} + ${displayKey}` : displayKey;
                    whispraPTTKeybind.textContent = displayText;
                }
                
                console.log('PTT hotkey updated:', { config: pttHotkey, currentKeybind });
            }

            // Update bidirectional hotkey if it exists
            if (config.uiSettings?.bidirectionalHotkey) {
                const bidiHotkey = config.uiSettings.bidirectionalHotkey;
                let bidiKey = bidiHotkey.key;
                if (bidiKey.startsWith('Key') && bidiKey.length === 4) {
                    bidirectionalKeybind = bidiKey;
                } else if (bidiKey === 'Space') {
                    bidirectionalKeybind = 'Space';
                } else if (/^[A-Z]$/i.test(bidiKey)) {
                    bidirectionalKeybind = `Key${bidiKey.toUpperCase()}`;
                } else {
                    bidirectionalKeybind = bidiKey;
                }
                updateBidirectionalKeybindDisplay(bidirectionalKeybind, bidirectionalKeybindSpan, bidirectionalKeybindDisplay);
                
                // Update whispra translate bidirectional keybind display
                const whispraBidiKeybind = document.getElementById('whispra-translate-bidi-keybind') as HTMLElement;
                if (whispraBidiKeybind) {
                    const displayKey = bidirectionalKeybind.startsWith('Key') ? bidirectionalKeybind.substring(3) : bidirectionalKeybind;
                    const modifiers = [];
                    if (bidiHotkey.ctrl) modifiers.push('Ctrl');
                    if (bidiHotkey.alt) modifiers.push('Alt');
                    if (bidiHotkey.shift) modifiers.push('Shift');
                    const displayText = modifiers.length > 0 ? `${modifiers.join(' + ')} + ${displayKey}` : displayKey;
                    whispraBidiKeybind.textContent = displayText;
                }
                
                console.log('Bidirectional hotkey updated:', { config: bidiHotkey, bidirectionalKeybind });
            }

        } catch (error) {
            console.error('Error updating main app UI from config update:', error);
        }
    });

    console.log('Config update listener setup complete');
}

function setupOverlayControlListeners(): void {
    if (!(window as any).electronAPI?.onOverlayControlTranslation || !(window as any).electronAPI?.onOverlayControlBidirectional) return;

    // Listen for translation control commands from overlay
    (window as any).electronAPI.onOverlayControlTranslation((data: any) => {
        try {
            console.log('[Main Renderer] Received translation control from overlay:', data);
            console.log('[Main Renderer] Current isTranslating state:', isTranslating);

            if (data.action === 'start') {
                if (!isTranslating) {
                    console.log('[Main Renderer] Starting translation from overlay');
                    // Apply configuration from overlay before starting
                    if (data.config) {
                        const { microphoneId, targetLanguage, voiceId } = data.config;
                        if (microphoneId && microphoneSelect) {
                            microphoneSelect.value = microphoneId;
                            console.log('[Main Renderer] Applied microphone:', microphoneId);
                        }
                        if (targetLanguage && languageSelect) {
                            languageSelect.value = targetLanguage;
                            console.log('[Main Renderer] Applied language:', targetLanguage);
                        }
                        if (voiceId && voiceSelect) {
                            voiceSelect.value = voiceId;
                            console.log('[Main Renderer] Applied voice:', voiceId);
                        }
                    }
                    toggleTranslation();
                } else {
                    console.log('[Main Renderer] Translation already running, ignoring start command');
                }
            } else if (data.action === 'stop') {
                if (isTranslating) {
                    console.log('[Main Renderer] Stopping translation from overlay');
                    toggleTranslation();
                } else {
                    console.log('[Main Renderer] Translation not running, ignoring stop command');
                }
            }
        } catch (error) {
            console.error('Error handling overlay translation control:', error);
        }
    });

    // Listen for bidirectional control commands from overlay
    (window as any).electronAPI.onOverlayControlBidirectional((data: any) => {
        try {
            console.log('Received bidirectional control from overlay:', data);
            if (data.action === 'start' && !isBidirectionalActive) {
                // If a source was selected in the overlay, store it for the main app to use
                if (data.selectedSource) {
                    console.log('Using selected source from overlay:', data.selectedSource);
                    // Store the selected source globally so the main app can use it
                    (window as any).overlaySelectedSource = data.selectedSource;
                    console.log('Stored overlay selected source:', (window as any).overlaySelectedSource);
                } else {
                    console.log('No selected source provided from overlay');
                }
                toggleBidirectional();
            } else if (data.action === 'stop' && isBidirectionalActive) {
                toggleBidirectional();
            }
        } catch (error) {
            console.error('Error handling overlay bidirectional control:', error);
        }
    });

    console.log('Overlay control listeners setup complete');
}

function setupSubscriptionErrorListener(): void {
    // Listen for subscription required errors
    (window as any).electronAPI.onSubscriptionRequired((data: { message: string; subscriptionStatus?: string }) => {
        console.log('Subscription required:', data);
        logToDebug(`❌ Subscription required: ${data.message}`);

        // Check if auth is enabled before redirecting
        (window as any).electronAPI.invoke('auth:is-enabled').then((authStatus: any) => {
            if (!authStatus?.enabled) {
                // Auth disabled - just log and ignore (open-source mode)
                console.log('Auth disabled - ignoring subscription requirement in open-source mode');
                return;
            }

            // Show error message to user
            alert(`Subscription Required: ${data.message}\n\nPlease sign in again with an active subscription.`);

            // Sign out and redirect to sign-in page
            (window as any).electronAPI.signOut().then(() => {
                window.location.href = 'signin.html';
            }).catch((error: any) => {
                console.error('Failed to sign out after subscription error:', error);
                // Force redirect anyway
                window.location.href = 'signin.html';
            });
        }).catch(() => {
            // If check fails, assume auth is disabled
            console.log('Could not check auth status - assuming open-source mode');
        });
    });

    console.log('Subscription error listener setup complete');
}

function setupSubscriptionExpiredListener(): void {
    // Listen for subscription expired events
    (window as any).electronAPI.onSubscriptionExpired((data: { message: string; reason: string }) => {
        console.log('Subscription expired:', data);
        logToDebug(`❌ Subscription expired: ${data.message}`);

        // Check if auth is enabled before redirecting
        (window as any).electronAPI.invoke('auth:is-enabled').then((authStatus: any) => {
            if (!authStatus?.enabled) {
                // Auth disabled - just log and ignore (open-source mode)
                console.log('Auth disabled - ignoring subscription expiration in open-source mode');
                return;
            }

            // Show error message to user
            alert(`Subscription Expired: ${data.message}\n\nYour subscription is no longer active. Please sign in again with an active subscription.`);

            // Sign out and redirect to sign-in page
            (window as any).electronAPI.signOut().then(() => {
                window.location.href = 'signin.html';
            }).catch((error: any) => {
                console.error('Failed to sign out after subscription expiration:', error);
                // Force redirect anyway
                window.location.href = 'signin.html';
            });
        }).catch(() => {
            console.log('Could not check auth status - assuming open-source mode');
        });
    });

    // Listen for access expired events (trial + subscription)
    if ((window as any).electronAPI.onAccessExpired) {
        (window as any).electronAPI.onAccessExpired((data: {
            message: string;
            reason: string;
            isTrialActive?: boolean;
            hasActiveSubscription?: boolean;
            trialDaysRemaining?: number;
        }) => {
            console.log('Access expired:', data);
            logToDebug(`❌ Access expired: ${data.message}`);

            // Check if auth is enabled before redirecting
            (window as any).electronAPI.invoke('auth:is-enabled').then((authStatus: any) => {
                if (!authStatus?.enabled) {
                    // Auth disabled - just log and ignore (open-source mode)
                    console.log('Auth disabled - ignoring access expiration in open-source mode');
                    return;
                }

                // Show error message to user
                alert(`Access Expired: ${data.message}\n\nPlease subscribe or renew your subscription to continue using the app.`);

                // Sign out and redirect to sign-in page
                (window as any).electronAPI.signOut().then(() => {
                    window.location.href = 'signin.html';
                }).catch((error: any) => {
                    console.error('Failed to sign out after access expiration:', error);
                    // Force redirect anyway
                    window.location.href = 'signin.html';
                });
            }).catch(() => {
                console.log('Could not check auth status - assuming open-source mode');
            });
        });
    }

    console.log('Subscription expired listener setup complete');
}

function setupApiErrorListeners(): void {
    // Listen for ElevenLabs API setup error
    if ((window as any).electronAPI.onElevenLabsSetupError) {
        (window as any).electronAPI.onElevenLabsSetupError(() => {
            console.log('ElevenLabs API setup error detected');
            showElevenLabsSetupErrorOverlay();
        });
    }

    // Listen for OpenAI quota exceeded error
    if ((window as any).electronAPI.onOpenAIQuotaError) {
        (window as any).electronAPI.onOpenAIQuotaError(() => {
            console.log('OpenAI quota exceeded error detected');
            showOpenAIQuotaErrorOverlay();
        });
    }

    console.log('API error listeners setup complete');
}

function showElevenLabsSetupErrorOverlay(): void {
    // Create modal overlay
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
    `;

    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
        background: var(--panel);
        border: 1px solid var(--border);
        border-radius: 12px;
        padding: 2rem;
        max-width: 500px;
        width: 90%;
        color: var(--text);
    `;

    modalContent.innerHTML = `
        <h3 style="margin: 0 0 1.5rem 0; color: var(--text); display: flex; align-items: center; gap: 0.5rem;">
            <span style="font-size: 24px;">⚠️</span>
            ElevenLabs API Setup Error
        </h3>
        <p style="margin: 0 0 1.5rem 0; line-height: 1.6; color: var(--text);">
            The ElevenLabs API you're using is not correctly set up. Please check your API key configuration in the settings.
        </p>
        <div style="display: flex; gap: 1rem; justify-content: flex-end;">
            <button id="elevenlabs-error-close" style="padding: 0.5rem 1rem; border: 1px solid var(--border); border-radius: 6px; background: var(--panel); color: var(--text); cursor: pointer;">
                Close
            </button>
            <button id="elevenlabs-error-settings" style="padding: 0.5rem 1rem; border: 1px solid var(--focus); border-radius: 6px; background: var(--focus); color: var(--text-on-focus); cursor: pointer;">
                Open Settings
            </button>
        </div>
    `;

    modal.appendChild(modalContent);
    document.body.appendChild(modal);

    // Handle close button
    const closeButton = modal.querySelector('#elevenlabs-error-close') as HTMLButtonElement;
    closeButton?.addEventListener('click', () => {
        document.body.removeChild(modal);
    });

    // Handle settings button
    const settingsButton = modal.querySelector('#elevenlabs-error-settings') as HTMLButtonElement;
    settingsButton?.addEventListener('click', () => {
        // Open settings modal (you may need to adjust this based on your settings implementation)
        if ((window as any).openSettings) {
            (window as any).openSettings();
        } else if ((window as any).electronAPI?.invoke) {
            // Try to open settings via IPC if available
            (window as any).electronAPI.invoke('config:get').then(() => {
                // Settings should be accessible, try to show settings UI
                const settingsTab = document.querySelector('[data-tab="settings"]') as HTMLElement;
                if (settingsTab) {
                    settingsTab.click();
                }
            });
        }
        document.body.removeChild(modal);
    });

    // Handle click outside
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            document.body.removeChild(modal);
        }
    });
}

function showOpenAIQuotaErrorOverlay(): void {
    // Create modal overlay
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
    `;

    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
        background: var(--panel);
        border: 1px solid var(--border);
        border-radius: 12px;
        padding: 2rem;
        max-width: 500px;
        width: 90%;
        color: var(--text);
    `;

    modalContent.innerHTML = `
        <h3 style="margin: 0 0 1.5rem 0; color: var(--text); display: flex; align-items: center; gap: 0.5rem;">
            <span style="font-size: 24px;">⚠️</span>
            OpenAI API Quota Exceeded
        </h3>
        <p style="margin: 0 0 1.5rem 0; line-height: 1.6; color: var(--text);">
            You have exceeded your current OpenAI API quota. Please add credits to your OpenAI API account or switch to managed API mode.
        </p>
        <div style="display: flex; gap: 1rem; justify-content: flex-end;">
            <button id="openai-quota-error-close" style="padding: 0.5rem 1rem; border: 1px solid var(--border); border-radius: 6px; background: var(--panel); color: var(--text); cursor: pointer;">
                Close
            </button>
            <button id="openai-quota-error-settings" style="padding: 0.5rem 1rem; border: 1px solid var(--focus); border-radius: 6px; background: var(--focus); color: var(--text-on-focus); cursor: pointer;">
                Open Settings
            </button>
        </div>
    `;

    modal.appendChild(modalContent);
    document.body.appendChild(modal);

    // Handle close button
    const closeButton = modal.querySelector('#openai-quota-error-close') as HTMLButtonElement;
    closeButton?.addEventListener('click', () => {
        document.body.removeChild(modal);
    });

    // Handle settings button
    const settingsButton = modal.querySelector('#openai-quota-error-settings') as HTMLButtonElement;
    settingsButton?.addEventListener('click', () => {
        // Open settings modal (you may need to adjust this based on your settings implementation)
        if ((window as any).openSettings) {
            (window as any).openSettings();
        } else if ((window as any).electronAPI?.invoke) {
            // Try to open settings via IPC if available
            (window as any).electronAPI.invoke('config:get').then(() => {
                // Settings should be accessible, try to show settings UI
                const settingsTab = document.querySelector('[data-tab="settings"]') as HTMLElement;
                if (settingsTab) {
                    settingsTab.click();
                }
            });
        }
        document.body.removeChild(modal);
    });

    // Handle click outside
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            document.body.removeChild(modal);
        }
    });
}

async function checkAndDisplayTrialStatus(): Promise<void> {
    try {
        const trialBanner = document.getElementById('trial-banner');
        const trialBannerText = document.getElementById('trial-banner-text');
        const trialBannerLink = document.getElementById('trial-banner-link');

        if (!trialBanner || !trialBannerText || !trialBannerLink) {
            console.log('Trial banner elements not found');
            return;
        }

        // Get cached user access data (no fresh API call needed for UI)
        if (!(window as any).electronAPI.checkUserAccess) {
            console.log('checkUserAccess not available');
            return;
        }

        const result = await (window as any).electronAPI.checkUserAccess();

        if (!result.success) {
            console.error('Failed to check user access:', result.error);
            return;
        }

        console.log('User access status:', result);

        // Hide banner if user has active subscription
        if (result.hasActiveSubscription) {
            trialBanner.classList.remove('show', 'warning', 'expired');
            return;
        }

        // Show trial status if user is on trial
        if (result.isTrialActive && result.trialDaysRemaining !== undefined) {
            trialBanner.classList.add('show');
            trialBanner.classList.remove('expired');

            // Show warning style if less than 3 days remaining
            if (result.trialDaysRemaining <= 3) {
                trialBanner.classList.add('warning');
                trialBannerText.textContent = `⚠️ Trial expires in ${result.trialDaysRemaining} day${result.trialDaysRemaining !== 1 ? 's' : ''}`;
            } else {
                trialBanner.classList.remove('warning');
                trialBannerText.textContent = `✨ Trial Active: ${result.trialDaysRemaining} days remaining`;
            }

            trialBannerLink.style.display = 'inline';
            trialBannerLink.onclick = (e) => {
                e.preventDefault();
                (window as any).electronAPI.openExternal('https://account.whispra.xyz/dashboard');
            };
        } else {
            // Trial expired and no subscription
            trialBanner.classList.add('show', 'expired');
            trialBanner.classList.remove('warning');
            trialBannerText.textContent = '🔒 Trial expired. Subscribe to continue using Whispra.';
            trialBannerLink.style.display = 'inline';
            trialBannerLink.onclick = (e) => {
                e.preventDefault();
                (window as any).electronAPI.openExternal('https://account.whispra.xyz/dashboard');
            };
        }
    } catch (error) {
        console.error('Error checking trial status:', error);
    }
}

function setSidebarCollapsed(collapsed: boolean): void {
    if (!appSidebar) return;
    if (collapsed) {
        appSidebar.classList.add('collapsed');
    } else {
        appSidebar.classList.remove('collapsed');
    }
}

async function toggleSidebar(): Promise<void> {
    if (!appSidebar) return;
    const collapsed = !appSidebar.classList.contains('collapsed');
    setSidebarCollapsed(collapsed);
    try {
        await (window as any).electronAPI.invoke('config:set', {
            id: Date.now().toString(),
            timestamp: Date.now(),
            payload: { uiSettings: { sidebarCollapsed: collapsed } }
        });
    } catch { }
}

function switchTab(tab: 'translate' | 'bidirectional' | 'screen-translation' | 'sound-board' | 'voice-filter' | 'quick-translate' | 'whispra-translate' | 'whispra-screen'): void {
    if (!translatePage || !bidirectionalPanel || !screenTranslationPanel || !soundBoardPanel || !voiceFilterPanel || !quickTranslatePanel || !whispraTranslatePanel || !whispraScreenPanel) return;

    const resolvedTab: 'translate' | 'bidirectional' | 'sound-board' | 'voice-filter' | 'quick-translate' | 'whispra-translate' | 'whispra-screen' =
        tab === 'screen-translation' ? 'whispra-screen' : tab;
    const cameFromLegacyScreenTab = tab === 'screen-translation';

    // Update sidebar button active states
    const sidebarButtons = document.querySelectorAll('.sidebar .nav button');
    sidebarButtons.forEach(button => button.classList.remove('active'));

    // Set active state for current tab
    const activeButtonMap = {
        'translate': '#sidebar-translate-button',
        'bidirectional': '#sidebar-bidirectional-button',
        'sound-board': '#sidebar-sound-board-button',
        'voice-filter': '#sidebar-voice-filter-button',
        'quick-translate': '#sidebar-quick-translate-button',
        'whispra-translate': '#sidebar-whispra-translate-button',
        'whispra-screen': '#sidebar-whispra-screen-button'
    };

    const activeButtonSelector = activeButtonMap[resolvedTab as keyof typeof activeButtonMap];
    const activeButton = activeButtonSelector ? document.querySelector(activeButtonSelector) : null;
    if (activeButton) {
        activeButton.classList.add('active');
    }

    // Hide all panels
    translatePage.style.display = 'none';
    bidirectionalPanel.style.display = 'none';
    screenTranslationPanel.style.display = 'none';
    soundBoardPanel.style.display = 'none';
    voiceFilterPanel.style.display = 'none';
    quickTranslatePanel.style.display = 'none';
    whispraTranslatePanel.style.display = 'none';
    whispraScreenPanel.style.display = 'none';

    // Show selected panel
    if (resolvedTab === 'translate') {
        translatePage.style.display = '';
    } else if (resolvedTab === 'bidirectional') {
        bidirectionalPanel.style.display = '';
        // Refresh bidirectional status text when panel becomes visible
        const isActive = bidirectionalToggleButton?.classList.contains('active') || isBidirectionalActive;
        setBidirectionalStatus(isActive);
        // Refresh speed select text based on current translation model
        (async () => {
            try {
                const response = await (window as any).electronAPI.invoke('config:get', {
                    id: Date.now().toString(),
                    timestamp: Date.now(),
                    payload: null
                });
                if (response.success) {
                    updateSpeedSelectText(response.payload);
                }
            } catch (error) {
                console.error('Failed to refresh speed select text:', error);
            }
        })();
    } else if (resolvedTab === 'sound-board') {
        soundBoardPanel.style.display = '';
        // Initialize soundboard manager when panel becomes visible
        if (!soundboardManager) {
            console.log('🎵 Initializing soundboard manager on tab switch');
            soundboardManager = initializeSoundboardManager();
        }
    } else if (resolvedTab === 'voice-filter') {
        voiceFilterPanel.style.display = '';
    } else if (resolvedTab === 'quick-translate') {
        quickTranslatePanel.style.display = '';
    } else if (resolvedTab === 'whispra-translate') {
        whispraTranslatePanel.style.display = '';
        // Initialize lucide icons for the whispra translate panel
        if (typeof (window as any).lucide !== 'undefined' && (window as any).lucide.createIcons) {
            (window as any).lucide.createIcons();
        }
        // Initialize settings dropdowns
        initializeWhispraTranslateDropdowns();
        // Initialize language selectors
        initializeWhispraTranslateLanguages();
        // Initialize output toggle
        initializeWhispraTranslateOutputToggle();
        // Initialize translate settings (microphone, voice, accent)
        initializeWhispraTranslateSettings();
        // Initialize keybind displays
        initializeWhispraTranslateKeybinds();
        // Initialize captions
        initializeWhispraTranslateCaptions();
        // Initialize bidirectional incoming voices
        loadWhispraBidirectionalIncomingVoices();
        // Initialize status texts (get elements dynamically)
        const translateStatusEl = document.getElementById('whispra-translate-status') as HTMLSpanElement | null;
        if (translateStatusEl) {
            translateStatusEl.textContent = isRecording ? 'Running' : 'Idle';
        }
        const bidirectionalStatusEl = document.getElementById('whispra-bidirectional-status') as HTMLSpanElement | null;
        if (bidirectionalStatusEl) {
            bidirectionalStatusEl.textContent = isBidirectionalActive ? 'Running' : 'Idle';
        }
    } else if (resolvedTab === 'whispra-screen') {
        whispraScreenPanel.style.display = '';
        // Initialize lucide icons for the Screen Translate panel
        if (typeof (window as any).lucide !== 'undefined' && (window as any).lucide.createIcons) {
            (window as any).lucide.createIcons();
        }
        // Initialize settings dropdowns
        initializeWhispraScreenDropdowns();
        // Initialize language selectors
        initializeWhispraScreenLanguages();
        // Initialize GPU and preload toggles (await since it's async)
        (async () => {
            await initializeWhispraScreenSettings();
        })();
        // Initialize keybind displays (full screen, box select, and watch box)
        initializeWhispraScreenKeybind();
        initializeWhispraScreenBoxKeybind();
        initializeWhispraScreenWatchBoxKeybind();
        // Mirror legacy screen translation initialization so programmatic calls still work
        console.log('🔄 Switching to Screen Translate tab', { viaLegacyScreenTab: cameFromLegacyScreenTab, keybind: screenTranslationKeybind });
        updateScreenTranslationKeybindDisplay(screenTranslationKeybind, screenTranslationKeybindSpan, screenTranslationKeybindDisplay);
        checkPaddlePaddleBeforeScreenTranslation();
        initializeOCRForCurrentLanguage();
    }
}

function initializeWhispraTranslateDropdowns(): void {
    // Only initialize once
    if ((window as any).whispraDropdownsInitialized) {
        // Re-setup icon handlers in case DOM was recreated
        setupWhispraIconHandlers();
        return;
    }
    (window as any).whispraDropdownsInitialized = true;

    // Close all dropdowns when clicking outside
    document.addEventListener('click', (e: Event) => {
        const mouseEvent = e as MouseEvent;
        const target = mouseEvent.target as HTMLElement;
        if (!target.closest('.whispra-settings-icon') && !target.closest('.whispra-settings-dropdown')) {
            document.querySelectorAll('.whispra-settings-dropdown').forEach(dropdown => {
                (dropdown as HTMLElement).style.display = 'none';
            });
            document.querySelectorAll('.whispra-settings-icon').forEach(icon => {
                icon.classList.remove('active');
            });
        }
    });

    setupWhispraIconHandlers();
    setupWhispraSpeedSelectHandler();
}

function setupWhispraSpeedSelectHandler(): void {
    const speedSelect = document.getElementById('whispra-bidirectional-speed') as HTMLSelectElement;
    if (!speedSelect) return;
    
    // Check if already has handler
    if ((speedSelect as any).hasSpeedHandler) return;
    (speedSelect as any).hasSpeedHandler = true;
    
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

function setupWhispraIconHandlers(): void {
    document.querySelectorAll('.whispra-settings-icon').forEach(icon => {
        // Check if already has handler
        if ((icon as any).hasWhispraHandler) return;
        (icon as any).hasWhispraHandler = true;
        
        icon.addEventListener('click', (e: Event) => {
            const mouseEvent = e as MouseEvent;
            mouseEvent.stopPropagation();
            const setting = (icon as HTMLElement).getAttribute('data-setting');
            
            // Skip dropdown for output setting - it's handled separately
            if (setting === 'output') {
                return;
            }
            
            const dropdown = document.querySelector(`[data-dropdown="${setting}"]`) as HTMLElement;
            
            // Close all other dropdowns
            document.querySelectorAll('.whispra-settings-dropdown').forEach(d => {
                if (d !== dropdown) {
                    (d as HTMLElement).style.display = 'none';
                }
            });
            document.querySelectorAll('.whispra-settings-icon').forEach(i => {
                if (i !== icon) {
                    i.classList.remove('active');
                }
            });

            // Toggle current dropdown
            if (dropdown) {
                const isVisible = dropdown.style.display === 'block';
                dropdown.style.display = isVisible ? 'none' : 'block';
                icon.classList.toggle('active', !isVisible);
                
                // If opening the voice dropdown, refresh voices to check API key status
                if (setting === 'voice' && !isVisible) {
                    loadWhispraVoices().catch(error => {
                        console.error('Error refreshing voices:', error);
                    });
                }
            }
        });
    });
}

async function initializeWhispraTranslateLanguages(): Promise<void> {
    const languages = [
        { code: 'en', name: 'English', flag: '🇺🇸' },
        { code: 'es', name: 'Spanish', flag: '🇪🇸' },
        { code: 'fr', name: 'French', flag: '🇫🇷' },
        { code: 'de', name: 'German', flag: '🇩🇪' },
        { code: 'it', name: 'Italian', flag: '🇮🇹' },
        { code: 'pt', name: 'Portuguese', flag: '🇵🇹' },
        { code: 'ru', name: 'Russian', flag: '🇷🇺' },
        { code: 'ja', name: 'Japanese', flag: '🇯🇵' },
        { code: 'ko', name: 'Korean', flag: '🇰🇷' },
        { code: 'zh', name: 'Chinese', flag: '🇨🇳' },
        { code: 'ar', name: 'Arabic', flag: '🇸🇦' },
        { code: 'hi', name: 'Hindi', flag: '🇮🇳' },
        { code: 'th', name: 'Thai', flag: '🇹🇭' },
        { code: 'vi', name: 'Vietnamese', flag: '🇻🇳' },
        { code: 'tr', name: 'Turkish', flag: '🇹🇷' },
        { code: 'pl', name: 'Polish', flag: '🇵🇱' },
        { code: 'nl', name: 'Dutch', flag: '🇳🇱' },
        { code: 'sv', name: 'Swedish', flag: '🇸🇪' },
        { code: 'da', name: 'Danish', flag: '🇩🇰' },
        { code: 'no', name: 'Norwegian', flag: '🇳🇴' }
    ];

    // Get all 4 language selectors
    const leftSourceLang = document.getElementById('whispra-left-source-lang') as HTMLSelectElement;
    const leftTargetLang = document.getElementById('whispra-left-target-lang') as HTMLSelectElement;
    const rightSourceLang = document.getElementById('whispra-right-source-lang') as HTMLSelectElement;
    const rightTargetLang = document.getElementById('whispra-right-target-lang') as HTMLSelectElement;

    if (!leftSourceLang || !leftTargetLang || !rightSourceLang || !rightTargetLang) {
        console.error('Language selectors not found');
        return;
    }

    // Populate all selectors with languages
    const populateSelector = (select: HTMLSelectElement) => {
        select.innerHTML = '';
        languages.forEach(language => {
            const option = document.createElement('option');
            option.value = language.code;
            option.textContent = `${language.flag} ${language.name}`;
            select.appendChild(option);
        });
    };

    populateSelector(leftSourceLang);
    populateSelector(leftTargetLang);
    populateSelector(rightSourceLang);
    populateSelector(rightTargetLang);

    // Apply Mac restrictions to bidirectional section
    applyMacBidirectionalRestrictionsToWhispraTranslate();
    
    // Apply Mac restrictions to screen translate section
    applyMacScreenTranslateRestrictionsToWhispraScreen();

    // Load account preferences and config
    try {
        const configResponse = await (window as any).electronAPI.invoke('config:get', {
            id: Date.now().toString(),
            timestamp: Date.now(),
            payload: null
        });

        if (configResponse.success && configResponse.payload) {
            const cfg = configResponse.payload;
            
            // Set translation source language from account preferences (defaults to 'en' if not set)
            const spokenLanguage = cfg.userPreferences?.spokenLanguage || 'en';
            if (leftSourceLang.querySelector(`option[value="${spokenLanguage}"]`)) {
                leftSourceLang.value = spokenLanguage;
            } else {
                leftSourceLang.value = 'en'; // Fallback to English
            }

            // Set target language from config (same as translate tab) - defaults to 'es' if not set
            if (cfg.targetLanguage && leftTargetLang.querySelector(`option[value="${cfg.targetLanguage}"]`)) {
                leftTargetLang.value = cfg.targetLanguage;
            } else {
                leftTargetLang.value = 'es'; // Default to Spanish (same as translate tab)
            }

            // Set bidirectional languages from bidirectional tab
            const bidiSourceLang = getBidirectionalSourceLanguageFromUI();
            const bidiTargetLang = getBidirectionalTargetLanguageFromUI();
            
            // Use bidirectional source language (skip 'auto' and use user's spoken language or fallback)
            const sourceLangValue = bidiSourceLang === 'auto' 
                ? (spokenLanguage || 'sv') 
                : bidiSourceLang;
            if (rightSourceLang.querySelector(`option[value="${sourceLangValue}"]`)) {
                rightSourceLang.value = sourceLangValue;
            } else {
                rightSourceLang.value = 'sv'; // Fallback to Swedish
            }
            
            // Use bidirectional target language
            if (rightTargetLang.querySelector(`option[value="${bidiTargetLang}"]`)) {
                rightTargetLang.value = bidiTargetLang;
            } else {
                rightTargetLang.value = 'en'; // Fallback to English
            }
        }
    } catch (error) {
        console.error('Error loading account preferences:', error);
        // Set defaults
        leftSourceLang.value = 'en';
        leftTargetLang.value = 'es'; // Default to Spanish (same as translate tab)
        
        // Use bidirectional languages from bidirectional tab as fallback
        const bidiSourceLang = getBidirectionalSourceLanguageFromUI();
        const bidiTargetLang = getBidirectionalTargetLanguageFromUI();
        // For 'auto', try to get spoken language from config, otherwise default to 'sv'
        let sourceLangValue = bidiSourceLang === 'auto' ? 'sv' : bidiSourceLang;
        try {
            const configResponse = await (window as any).electronAPI.invoke('config:get', {
                id: Date.now().toString(),
                timestamp: Date.now(),
                payload: null
            });
            if (configResponse.success && configResponse.payload?.userPreferences?.spokenLanguage) {
                const spokenLang = configResponse.payload.userPreferences.spokenLanguage;
                if (bidiSourceLang === 'auto' && rightSourceLang.querySelector(`option[value="${spokenLang}"]`)) {
                    sourceLangValue = spokenLang;
                }
            }
        } catch (e) {
            // Ignore errors, use default
        }
        rightSourceLang.value = rightSourceLang.querySelector(`option[value="${sourceLangValue}"]`) ? sourceLangValue : 'sv';
        rightTargetLang.value = rightTargetLang.querySelector(`option[value="${bidiTargetLang}"]`) ? bidiTargetLang : 'en';
    }

    // Connect target language selector to same handler as translate tab
    leftTargetLang.addEventListener('change', async () => {
        await onWhispraTargetLanguageChange();
    });
    
    // Track if we're syncing to prevent circular updates
    let isSyncingSpokenLanguage = false;
    
    // Connect source language selector to sync with profile dropdown and settings
    leftSourceLang.addEventListener('change', async () => {
        if (isSyncingSpokenLanguage) return;
        
        isSyncingSpokenLanguage = true;
        const selectedLanguage = leftSourceLang.value;
        
        // Save the spoken language preference
        try {
            await (window as any).electronAPI.invoke('config:set', {
                id: Date.now().toString(),
                timestamp: Date.now(),
                payload: {
                    userPreferences: {
                        spokenLanguage: selectedLanguage
                    }
                }
            });
            console.log(`🌐 Saved spoken language from whispra translate: ${selectedLanguage}`);
        } catch (error) {
            console.error('Failed to save spoken language:', error);
        }
        
        // Sync with profile dropdown
        const profileLanguageToggle = document.getElementById('profile-language-toggle') as HTMLSelectElement;
        if (profileLanguageToggle && profileLanguageToggle.value !== selectedLanguage) {
            profileLanguageToggle.value = selectedLanguage;
        }
        
        // Sync with settings language selector (if open)
        const settingsSpokenLanguage = document.getElementById('settings-spoken-language') as HTMLSelectElement;
        if (settingsSpokenLanguage && settingsSpokenLanguage.value !== selectedLanguage) {
            settingsSpokenLanguage.value = selectedLanguage;
        }
        
        // Dispatch event for any other listeners
        window.dispatchEvent(new CustomEvent('spoken-language-changed', { 
            detail: { language: selectedLanguage, source: 'whispra-translate' } 
        }));
        
        isSyncingSpokenLanguage = false;
    });
    
    // Listen for spoken language changes from other sources (profile dropdown, settings)
    window.addEventListener('spoken-language-changed', (event: Event) => {
        if (isSyncingSpokenLanguage) return;
        
        const customEvent = event as CustomEvent;
        const { language, source } = customEvent.detail;
        
        // Don't update if this selector was the source
        if (source === 'whispra-translate') return;
        
        isSyncingSpokenLanguage = true;
        
        // Update this selector if the language exists
        if (leftSourceLang.querySelector(`option[value="${language}"]`)) {
            leftSourceLang.value = language;
        }
        
        isSyncingSpokenLanguage = false;
    });
    
    // Sync right side languages with bidirectional tab when they change (bidirectional → whispra)
    if (bidirectionalSourceLanguageSelect) {
        bidirectionalSourceLanguageSelect.addEventListener('change', async () => {
            if (isUpdatingFromWhispra) return; // Prevent circular update
            
            isUpdatingFromBidirectional = true;
            const bidiSourceLang = getBidirectionalSourceLanguageFromUI();
            let sourceLangValue = bidiSourceLang === 'auto' ? 'sv' : bidiSourceLang;
            
            // For 'auto', try to get user's spoken language preference
            if (bidiSourceLang === 'auto') {
                try {
                    const configResponse = await (window as any).electronAPI.invoke('config:get', {
                        id: Date.now().toString(),
                        timestamp: Date.now(),
                        payload: null
                    });
                    if (configResponse.success && configResponse.payload?.userPreferences?.spokenLanguage) {
                        const spokenLang = configResponse.payload.userPreferences.spokenLanguage;
                        if (rightSourceLang.querySelector(`option[value="${spokenLang}"]`)) {
                            sourceLangValue = spokenLang;
                        }
                    }
                } catch (e) {
                    // Ignore errors, use default 'sv'
                }
            }
            
            if (rightSourceLang.querySelector(`option[value="${sourceLangValue}"]`)) {
                rightSourceLang.value = sourceLangValue;
            }
            isUpdatingFromBidirectional = false;
        });
    }
    
    if (bidirectionalTargetLanguageSelect) {
        bidirectionalTargetLanguageSelect.addEventListener('change', () => {
            if (isUpdatingFromWhispra) return; // Prevent circular update
            
            isUpdatingFromBidirectional = true;
            const bidiTargetLang = getBidirectionalTargetLanguageFromUI();
            if (rightTargetLang.querySelector(`option[value="${bidiTargetLang}"]`)) {
                rightTargetLang.value = bidiTargetLang;
            }
            isUpdatingFromBidirectional = false;
        });
    }
    
    // Sync bidirectional tab languages when right side languages change (whispra → bidirectional)
    rightSourceLang.addEventListener('change', async () => {
        if (isUpdatingFromBidirectional) return; // Prevent circular update
        
        if (!bidirectionalSourceLanguageSelect) return;
        
        isUpdatingFromWhispra = true;
        const selectedLanguage = rightSourceLang.value;
        
        // Update bidirectional selector if the value exists
        if (bidirectionalSourceLanguageSelect.querySelector(`option[value="${selectedLanguage}"]`)) {
            bidirectionalSourceLanguageSelect.value = selectedLanguage;
        } else {
            // If the language doesn't exist in bidirectional selector, set to 'auto'
            bidirectionalSourceLanguageSelect.value = 'auto';
        }
        
        // Update state and save config (same logic as onBidirectionalSourceLanguageChange)
        if (!isInitializingBidirectional) {
            const finalLanguage = bidirectionalSourceLanguageSelect.value || 'auto';
            bidirectionalSourceLanguage = finalLanguage;
            setBidirectionalSourceLanguage(finalLanguage);
            
            await restartArgosIfNeeded(`Whispra translate right source language change: ${finalLanguage}`);
            
            try {
                await (window as any).electronAPI.invoke('config:set', {
                    id: Date.now().toString(),
                    timestamp: Date.now(),
                    payload: { uiSettings: { bidirectionalSourceLanguage: finalLanguage } }
                });
                console.log('🌐 Bidirectional source language changed from whispra translate to:', finalLanguage);
            } catch (error) {
                console.error('Failed to save bidirectional source language:', error);
            }
        }
        
        isUpdatingFromWhispra = false;
    });
    
    rightTargetLang.addEventListener('change', async () => {
        if (isUpdatingFromBidirectional) return; // Prevent circular update
        
        if (!bidirectionalTargetLanguageSelect) return;
        
        isUpdatingFromWhispra = true;
        const selectedLanguage = rightTargetLang.value;
        
        // Update bidirectional selector if the value exists
        if (bidirectionalTargetLanguageSelect.querySelector(`option[value="${selectedLanguage}"]`)) {
            bidirectionalTargetLanguageSelect.value = selectedLanguage;
        } else {
            // Fallback to English if language doesn't exist
            bidirectionalTargetLanguageSelect.value = 'en';
        }
        
        // Update state and save config (same logic as onBidirectionalTargetLanguageChange)
        if (!isInitializingBidirectional) {
            const finalLanguage = bidirectionalTargetLanguageSelect.value || 'en';
            bidirectionalTargetLanguage = finalLanguage;
            setBidirectionalTargetLanguage(finalLanguage);
            
            await restartArgosIfNeeded(`Whispra translate right target language change: ${finalLanguage}`);
            
            try {
                await (window as any).electronAPI.invoke('config:set', {
                    id: Date.now().toString(),
                    timestamp: Date.now(),
                    payload: { uiSettings: { bidirectionalTargetLanguage: finalLanguage } }
                });
                console.log('🎯 Bidirectional target language changed from whispra translate to:', finalLanguage);
            } catch (error) {
                console.error('Failed to save bidirectional target language:', error);
            }
        }
        
        isUpdatingFromWhispra = false;
    });
}

async function onWhispraTargetLanguageChange(): Promise<void> {
    const leftTargetLang = document.getElementById('whispra-left-target-lang') as HTMLSelectElement;
    if (!leftTargetLang) return;

    const selectedLanguage = leftTargetLang.value;
    
    // Update main language select to keep them in sync
    if (languageSelect && languageSelect.value !== selectedLanguage) {
        languageSelect.value = selectedLanguage;
    }

    // Use the same save logic as main translate page
    await onLanguageChange();
}

async function initializeWhispraTranslateOutputToggle(): Promise<void> {
    const outputToggleBtn = document.getElementById('whispra-translate-output-toggle-btn') as HTMLButtonElement;
    const outputToggleIcon = document.getElementById('whispra-translate-output-toggle') as HTMLButtonElement;
    
    if (!outputToggleBtn || !outputToggleIcon) {
        console.error('Output toggle elements not found');
        return;
    }

    // Load current preference
    try {
        const configResponse = await (window as any).electronAPI.invoke('config:get', {
            id: Date.now().toString(),
            timestamp: Date.now(),
            payload: null
        });

        if (configResponse.success && configResponse.payload?.uiSettings?.outputToVirtualDevice !== undefined) {
            outputToVirtualDevice = !!configResponse.payload.uiSettings.outputToVirtualDevice;
        }
    } catch (error) {
        console.error('Error loading output preference:', error);
    }

    // Update button text and icon
    const updateOutputToggleText = () => {
        // Update dropdown button text with icon
        const iconName = outputToVirtualDevice ? 'arrow-left-right' : 'headphones';
        const text = outputToVirtualDevice
            ? 'Output: Virtual Device'
            : 'Output: App/Headphones';
        
        // Update dropdown button with icon
        outputToggleBtn.innerHTML = `<i data-lucide="${iconName}" style="width: 16px; height: 16px; margin-right: 0.5rem;"></i>${text}`;
        
        // Update icon button - handle both <i> tags and Lucide-converted <svg> elements
        const iconElement = outputToggleIcon.querySelector('i[data-lucide], svg[data-lucide]') as HTMLElement;
        if (iconElement) {
            // If it's an SVG (already converted by Lucide), replace it with a new <i> tag
            if (iconElement.tagName === 'SVG') {
                iconElement.outerHTML = `<i data-lucide="${iconName}" style="width: 18px; height: 18px;"></i>`;
            } else {
                // If it's still an <i> tag, just update the attribute
                iconElement.setAttribute('data-lucide', iconName);
            }
        } else {
            // If no icon found, create one
            outputToggleIcon.innerHTML = `<i data-lucide="${iconName}" style="width: 18px; height: 18px;"></i>`;
        }
        
        // Refresh Lucide icons
        if (typeof (window as any).lucide !== 'undefined' && (window as any).lucide.createIcons) {
            (window as any).lucide.createIcons();
        }
    };

    updateOutputToggleText();

    // Toggle function
    const toggleOutput = async () => {
        // Prevent multiple simultaneous toggles
        if (isTogglingOutput) {
            console.log('⏳ Output toggle already in progress, ignoring click');
            return;
        }
        
        isTogglingOutput = true;
        try {
            outputToVirtualDevice = !outputToVirtualDevice;
            updateOutputToggleText();

            // Save preference
            try {
                await (window as any).electronAPI.invoke('config:set', {
                    id: Date.now().toString(),
                    timestamp: Date.now(),
                    payload: { uiSettings: { outputToVirtualDevice } }
                });
                console.log('Updated output preference:', outputToVirtualDevice ? 'Virtual Device' : 'App/Headphones');
            } catch (error) {
                console.error('Error saving output preference:', error);
                // Revert on error
                outputToVirtualDevice = !outputToVirtualDevice;
                updateOutputToggleText();
                // Don't continue with passthrough restart if save failed
                return;
            }

            // Restart passthrough if translation is active to apply the new output setting
            if (isTranslating && audioStream) {
                try {
                    await restartPassthroughClean();
                    logToDebug(`🔄 Restarted passthrough with output: ${outputToVirtualDevice ? 'Virtual Device' : 'App/Headphones'}`);
                } catch (error) {
                    console.error('Error restarting passthrough after output toggle:', error);
                    logToDebug(`⚠️ Failed to restart passthrough: ${error instanceof Error ? error.message : 'Unknown error'}`);
                }
            }
        } finally {
            isTogglingOutput = false;
        }
    };

    // Setup click handler for icon (toggle directly)
    outputToggleIcon.addEventListener('click', async (e: Event) => {
        e.stopPropagation();
        await toggleOutput();
    });

    // Setup click handler for button in dropdown
    outputToggleBtn.addEventListener('click', async (e: Event) => {
        e.stopPropagation();
        await toggleOutput();
    });
}

async function initializeWhispraTranslateSettings(): Promise<void> {
    // Initialize microphone selector
    const whispraMicSelect = document.getElementById('whispra-translate-microphone') as HTMLSelectElement;
    if (whispraMicSelect) {
        // Load microphones
        await loadWhispraMicrophones();
        
        // Set up change handler
        whispraMicSelect.addEventListener('change', async () => {
            await onWhispraMicrophoneChange();
        });
    }

    // Initialize voice selector
    const whispraVoiceSelect = document.getElementById('whispra-translate-voice') as HTMLSelectElement;
    if (whispraVoiceSelect) {
        // Load voices
        await loadWhispraVoices();
        
        // Set up change handler
        whispraVoiceSelect.addEventListener('change', async () => {
            await onWhispraVoiceChange();
        });
    }

    // Initialize accent selector
    const whispraAccentSelect = document.getElementById('whispra-translate-accent') as HTMLSelectElement;
    if (whispraAccentSelect) {
        // Restore accent settings
        await restoreWhispraAccentSettings();
        
        // Set up change handler
        whispraAccentSelect.addEventListener('change', async () => {
            await onWhispraAccentChange();
        });
    }

    // Initialize volume control (Translation panel)
    const volumeSlider = document.getElementById('whispra-translate-volume-slider') as HTMLInputElement;
    const volumeValue = document.getElementById('whispra-translate-volume-value') as HTMLSpanElement;
    const volumeTestBtn = document.getElementById('whispra-translate-volume-test') as HTMLButtonElement;
    
    if (volumeSlider && volumeValue) {
        // Set initial slider value from current volume (convert 0-1 to 0-100)
        volumeSlider.value = (MASTER_AUDIO_VOLUME * 100).toString();
        volumeValue.textContent = `${Math.round(MASTER_AUDIO_VOLUME * 100)}%`;
        
        // Update volume icon based on volume level
        updateVolumeIcon(MASTER_AUDIO_VOLUME);
        
        // Handle slider changes
        volumeSlider.addEventListener('input', () => {
            const sliderValue = parseFloat(volumeSlider.value);
            const newVolume = sliderValue / 100;
            updateTTSVolume(newVolume);
            volumeValue.textContent = `${Math.round(sliderValue)}%`;
            updateVolumeIcon(newVolume);
            // Sync bidirectional volume slider
            syncBidirectionalVolumeSlider(newVolume);
        });
        
        // Handle test button
        if (volumeTestBtn) {
            volumeTestBtn.addEventListener('click', async () => {
                await testTTSVolume();
            });
        }
    }

    // Initialize volume control (Bidirectional panel)
    const bidirectionalVolumeSlider = document.getElementById('whispra-bidirectional-volume-slider') as HTMLInputElement;
    const bidirectionalVolumeValue = document.getElementById('whispra-bidirectional-volume-value') as HTMLSpanElement;
    const bidirectionalVolumeTestBtn = document.getElementById('whispra-bidirectional-volume-test') as HTMLButtonElement;
    
    if (bidirectionalVolumeSlider && bidirectionalVolumeValue) {
        // Set initial slider value from current volume (convert 0-1 to 0-100)
        bidirectionalVolumeSlider.value = (MASTER_AUDIO_VOLUME * 100).toString();
        bidirectionalVolumeValue.textContent = `${Math.round(MASTER_AUDIO_VOLUME * 100)}%`;
        
        // Update bidirectional volume icon based on volume level
        updateBidirectionalVolumeIcon(MASTER_AUDIO_VOLUME);
        
        // Handle slider changes
        bidirectionalVolumeSlider.addEventListener('input', () => {
            const sliderValue = parseFloat(bidirectionalVolumeSlider.value);
            const newVolume = sliderValue / 100;
            updateTTSVolume(newVolume);
            bidirectionalVolumeValue.textContent = `${Math.round(sliderValue)}%`;
            updateBidirectionalVolumeIcon(newVolume);
            // Sync translation volume slider
            syncTranslationVolumeSlider(newVolume);
        });
        
        // Handle test button
        if (bidirectionalVolumeTestBtn) {
            bidirectionalVolumeTestBtn.addEventListener('click', async () => {
                await testTTSVolume();
            });
        }
    }

    // Initialize speed selector
    const whispraSpeedSelect = document.getElementById('whispra-bidirectional-speed') as HTMLSelectElement;
    if (whispraSpeedSelect) {
        // Load current speed setting
        try {
            const configResponse = await (window as any).electronAPI.invoke('config:get', {
                id: Date.now().toString(),
                timestamp: Date.now(),
                payload: null
            });

            if (configResponse.success && configResponse.payload) {
                const cfg = configResponse.payload;
                const speed = cfg.uiSettings?.bidirectionalOptimization?.translationSpeed || 'normal';
                whispraSpeedSelect.value = speed;
                console.log(`✅ Loaded translation speed: ${speed}`);
            }
        } catch (error) {
            console.error('Failed to load translation speed setting:', error);
        }
    }
}

/**
 * Update TTS volume and persist to localStorage
 */
function updateTTSVolume(newVolume: number): void {
    // Clamp volume between 0 and 1
    const clampedVolume = Math.max(0, Math.min(1, newVolume));
    MASTER_AUDIO_VOLUME = clampedVolume;
    
    // Save to localStorage
    try {
        localStorage.setItem('whispra-tts-volume', clampedVolume.toString());
        console.log(`🔊 TTS volume updated to ${Math.round(clampedVolume * 100)}%`);
    } catch (error) {
        console.warn('Failed to save TTS volume to localStorage:', error);
    }
    
    // Update streaming audio player if it exists
    if (streamingAudioPlayer) {
        streamingAudioPlayer.setVolume(clampedVolume);
    }
    
    // Update both volume icons
    updateVolumeIcon(clampedVolume);
    updateBidirectionalVolumeIcon(clampedVolume);
}

/**
 * Update volume icon based on volume level (Translation panel)
 */
function updateVolumeIcon(volume: number): void {
    const volumeIcon = document.querySelector('[data-setting="volume"] i[data-lucide]') as HTMLElement;
    if (!volumeIcon) return;
    
    let iconName: string;
    if (volume === 0) {
        iconName = 'volume-x';
    } else if (volume < 0.3) {
        iconName = 'volume-1';
    } else {
        iconName = 'volume-2';
    }
    
    // Update icon using lucide
    if (typeof (window as any).lucide !== 'undefined' && (window as any).lucide.createIcons) {
        volumeIcon.setAttribute('data-lucide', iconName);
        (window as any).lucide.createIcons();
    }
}

/**
 * Update volume icon based on volume level (Bidirectional panel)
 */
function updateBidirectionalVolumeIcon(volume: number): void {
    const volumeIcon = document.querySelector('[data-setting="bidirectional-volume"] i[data-lucide]') as HTMLElement;
    if (!volumeIcon) return;
    
    let iconName: string;
    if (volume === 0) {
        iconName = 'volume-x';
    } else if (volume < 0.3) {
        iconName = 'volume-1';
    } else {
        iconName = 'volume-2';
    }
    
    // Update icon using lucide
    if (typeof (window as any).lucide !== 'undefined' && (window as any).lucide.createIcons) {
        volumeIcon.setAttribute('data-lucide', iconName);
        (window as any).lucide.createIcons();
    }
}

/**
 * Sync bidirectional volume slider when translation slider changes
 */
function syncBidirectionalVolumeSlider(volume: number): void {
    const bidirectionalSlider = document.getElementById('whispra-bidirectional-volume-slider') as HTMLInputElement;
    const bidirectionalValue = document.getElementById('whispra-bidirectional-volume-value') as HTMLSpanElement;
    
    if (bidirectionalSlider && bidirectionalValue) {
        bidirectionalSlider.value = (volume * 100).toString();
        bidirectionalValue.textContent = `${Math.round(volume * 100)}%`;
        updateBidirectionalVolumeIcon(volume);
    }
}

/**
 * Sync translation volume slider when bidirectional slider changes
 */
function syncTranslationVolumeSlider(volume: number): void {
    const translationSlider = document.getElementById('whispra-translate-volume-slider') as HTMLInputElement;
    const translationValue = document.getElementById('whispra-translate-volume-value') as HTMLSpanElement;
    
    if (translationSlider && translationValue) {
        translationSlider.value = (volume * 100).toString();
        translationValue.textContent = `${Math.round(volume * 100)}%`;
        updateVolumeIcon(volume);
    }
}

/**
 * Test TTS volume by playing a sample
 */
async function testTTSVolume(): Promise<void> {
    try {
        const testText = 'Volume test';
        console.log(`🔊 Testing TTS volume at ${Math.round(MASTER_AUDIO_VOLUME * 100)}%`);
        
        // Get current voice ID
        const voiceSelect = document.getElementById('whispra-translate-voice') as HTMLSelectElement;
        const voiceId = voiceSelect?.value || '';
        
        if (!voiceId) {
            console.warn('⚠️ No voice selected for volume test');
            return;
        }
        
        // Request TTS synthesis
        const ttsResponse = await (window as any).electronAPI.invoke('tts:synthesize', {
            text: testText,
            voiceId: voiceId,
            modelId: 'eleven_multilingual_v2'
        });
        
        if (ttsResponse && ttsResponse.audioData) {
            // Play the audio with current volume
            await playAudioToDevice(ttsResponse.audioData);
        }
    } catch (error) {
        console.error('❌ Failed to test TTS volume:', error);
    }
}

async function loadWhispraMicrophones(): Promise<void> {
    const whispraMicSelect = document.getElementById('whispra-translate-microphone') as HTMLSelectElement;
    if (!whispraMicSelect) return;

    try {
        // Use the same function as the main translate page
        await loadMicrophoneDevices();
        
        // Copy options from main microphone select to whispra select
        if (microphoneSelect) {
            whispraMicSelect.innerHTML = microphoneSelect.innerHTML;
            
            // Set the selected value from config
            try {
                const configResponse = await (window as any).electronAPI.invoke('config:get', {
                    id: Date.now().toString(),
                    timestamp: Date.now(),
                    payload: null
                });

                if (configResponse.success && configResponse.payload?.selectedMicrophone) {
                    whispraMicSelect.value = configResponse.payload.selectedMicrophone;
                }
            } catch (error) {
                console.error('Error loading microphone preference:', error);
            }
        }
    } catch (error) {
        console.error('Error loading microphones:', error);
        whispraMicSelect.innerHTML = '<option value="">Error loading microphones</option>';
    }
}

async function onWhispraMicrophoneChange(): Promise<void> {
    const whispraMicSelect = document.getElementById('whispra-translate-microphone') as HTMLSelectElement;
    if (!whispraMicSelect) return;

    const selectedDevice = whispraMicSelect.value;
    
    // Update main microphone select to keep them in sync
    if (microphoneSelect && microphoneSelect.value !== selectedDevice) {
        microphoneSelect.value = selectedDevice;
    }

    // Use the same save logic as main translate page
    await onMicrophoneChange();
}

async function loadWhispraVoices(): Promise<void> {
    const whispraVoiceSelect = document.getElementById('whispra-translate-voice') as HTMLSelectElement;
    if (!whispraVoiceSelect) return;

    try {
        // Check if user is in managed mode or has ElevenLabs API key
        const configResponse = await (window as any).electronAPI.invoke('config:get', {
            id: Date.now().toString(),
            timestamp: Date.now(),
            payload: null
        });

        const config = configResponse?.payload;
        const currentMode = config?.managedApiConfig?.mode || 'personal';
        const isManaged = currentMode === 'managed';

        // Check for ElevenLabs API key if in personal mode
        let hasElevenLabsKey = false;
        if (!isManaged) {
            try {
                const apiKeyResponse = await (window as any).electronAPI.invoke('secure-api-keys:get', {
                    id: Date.now().toString(),
                    timestamp: Date.now(),
                    payload: null
                });
                const apiKeys = apiKeyResponse?.payload || {};
                hasElevenLabsKey = !!(apiKeys.elevenlabs && apiKeys.elevenlabs.trim().length > 0);
            } catch (error) {
                console.error('Error checking API keys:', error);
            }
        }

        // Clear the select
        whispraVoiceSelect.innerHTML = '<option value="">Loading voices...</option>';

        // If in managed mode or has ElevenLabs key, load voices from API
        if (isManaged || hasElevenLabsKey) {
            try {
                const response = await (window as any).electronAPI.invoke('voice:get-voices', {
                    id: Date.now().toString(),
                    timestamp: Date.now(),
                    payload: null
                });

                whispraVoiceSelect.innerHTML = '<option value="">Select voice...</option>';

                if (response.success && response.payload && response.payload.length > 0) {
                    // Add voices from API
                    response.payload.forEach((voice: any) => {
                        const option = document.createElement('option');
                        option.value = voice.id;
                        option.textContent = voice.name;
                        whispraVoiceSelect.appendChild(option);
                    });
                } else {
                    // Fallback voices if API returns empty
                    const fallbackVoices = [
                        { id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam (Male, English)' },
                        { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella (Female, English)' },
                        { id: 'IKne3meq5aSn9XLyUdCD', name: 'Charlie (Male, English)' },
                        { id: 'onwK4e9ZLuTAKqWW03F9', name: 'Daniel (Male, English)' }
                    ];
                    fallbackVoices.forEach(voice => {
                        const option = document.createElement('option');
                        option.value = voice.id;
                        option.textContent = voice.name;
                        whispraVoiceSelect.appendChild(option);
                    });
                }
            } catch (error) {
                console.error('Error loading voices from API:', error);
                whispraVoiceSelect.innerHTML = '<option value="">Error loading voices</option>';
            }
        } else {
            // No API key and not in managed mode - show message
            whispraVoiceSelect.innerHTML = '<option value="">No API key configured</option>';
            whispraVoiceSelect.disabled = true;
            
            // Add a message or link to add API key
            const dropdown = whispraVoiceSelect.closest('.whispra-settings-dropdown') as HTMLElement | null;
            if (dropdown) {
                // Check if message already exists
                let messageEl = dropdown.querySelector('.voice-api-key-message') as HTMLElement | null;
                if (!messageEl) {
                    messageEl = document.createElement('div');
                    messageEl.className = 'voice-api-key-message';
                    messageEl.style.cssText = `
                        margin-top: 0.5rem;
                        padding: 0.5rem;
                        background: rgba(255, 200, 0, 0.1);
                        border: 1px solid rgba(255, 200, 0, 0.3);
                        border-radius: 4px;
                        font-size: 0.8rem;
                        color: rgba(255, 255, 255, 0.8);
                        text-align: center;
                    `;
                    messageEl.innerHTML = `
                        <div>Add an ElevenLabs API key in Settings to use voices</div>
                        <button style="margin-top: 0.5rem; padding: 0.25rem 0.75rem; background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 4px; color: var(--text); cursor: pointer; font-size: 0.75rem;" onclick="window.electronAPI.send('open-settings')">Open Settings</button>
                    `;
                    dropdown.appendChild(messageEl);
                }
            }
            return;
        }

        // Re-enable select if it was disabled
        whispraVoiceSelect.disabled = false;
        
        // Remove any API key message if it exists
        const dropdown = whispraVoiceSelect.closest('.whispra-settings-dropdown');
        if (dropdown) {
            const messageEl = dropdown.querySelector('.voice-api-key-message');
            if (messageEl) {
                messageEl.remove();
            }
        }

        // Set the selected value from config
        try {
            if (configResponse.success && configResponse.payload?.voiceId) {
                const voiceExists = Array.from(whispraVoiceSelect.options).some(
                    option => option.value === configResponse.payload.voiceId
                );
                if (voiceExists) {
                    whispraVoiceSelect.value = configResponse.payload.voiceId;
                    // Update accent availability based on restored voice
                    updateAccentAvailability(configResponse.payload.voiceId);
                }
            }
        } catch (error) {
            console.error('Error loading voice preference:', error);
        }
        
        // Also check accent availability for current selection
        if (whispraVoiceSelect.value) {
            updateAccentAvailability(whispraVoiceSelect.value);
        }
    } catch (error) {
        console.error('Error loading voices:', error);
        whispraVoiceSelect.innerHTML = '<option value="">Error loading voices</option>';
    }
}

async function onWhispraVoiceChange(): Promise<void> {
    const whispraVoiceSelect = document.getElementById('whispra-translate-voice') as HTMLSelectElement;
    if (!whispraVoiceSelect) return;

    const selectedVoice = whispraVoiceSelect.value;
    
    // Update main voice select to keep them in sync
    if (voiceSelect && voiceSelect.value !== selectedVoice) {
        voiceSelect.value = selectedVoice;
    }

    // Use the same save logic as main translate page
    await onVoiceChange();
    
    // Update accent control availability based on voice type
    updateAccentAvailability(selectedVoice);
}

/**
 * Check if a voice ID is an ElevenLabs voice
 * ElevenLabs voice IDs are long alphanumeric strings (20+ chars)
 * OpenAI voices are short names like 'alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'
 */
function isElevenLabsVoice(voiceId: string): boolean {
    if (!voiceId) return false;
    const openAIVoices = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];
    return !openAIVoices.includes(voiceId.toLowerCase()) && voiceId.length > 10;
}

/**
 * Update accent control availability based on selected voice
 * Accent feature only works with ElevenLabs voices
 */
function updateAccentAvailability(voiceId: string): void {
    const whispraAccentButton = document.querySelector('[data-setting="accent"]') as HTMLButtonElement;
    const whispraAccentSelect = document.getElementById('whispra-translate-accent') as HTMLSelectElement;
    const accentDropdown = document.querySelector('[data-dropdown="accent"]') as HTMLElement;
    
    const isElevenLabs = isElevenLabsVoice(voiceId);
    
    if (whispraAccentButton) {
        if (isElevenLabs) {
            whispraAccentButton.style.opacity = '1';
            whispraAccentButton.style.cursor = 'pointer';
            whispraAccentButton.title = 'Accent';
            whispraAccentButton.disabled = false;
        } else {
            whispraAccentButton.style.opacity = '0.5';
            whispraAccentButton.style.cursor = 'not-allowed';
            whispraAccentButton.title = 'Accent requires ElevenLabs voice';
            whispraAccentButton.disabled = true;
        }
    }
    
    if (whispraAccentSelect) {
        whispraAccentSelect.disabled = !isElevenLabs;
        whispraAccentSelect.style.opacity = isElevenLabs ? '1' : '0.5';
        whispraAccentSelect.style.cursor = isElevenLabs ? 'pointer' : 'not-allowed';
    }
    
    // Add/update message in dropdown
    if (accentDropdown) {
        let messageEl = accentDropdown.querySelector('.accent-elevenlabs-message') as HTMLElement | null;
        
        if (!isElevenLabs) {
            if (!messageEl) {
                messageEl = document.createElement('div');
                messageEl.className = 'accent-elevenlabs-message';
                messageEl.style.cssText = `
                    margin-top: 0.5rem;
                    padding: 0.5rem;
                    background: rgba(255, 165, 0, 0.1);
                    border: 1px solid rgba(255, 165, 0, 0.3);
                    border-radius: 4px;
                    font-size: 0.8rem;
                    color: rgba(255, 255, 255, 0.8);
                    text-align: center;
                `;
                accentDropdown.appendChild(messageEl);
            }
            messageEl.textContent = 'Accent requires an ElevenLabs voice';
            messageEl.style.display = 'block';
        } else if (messageEl) {
            messageEl.style.display = 'none';
        }
    }
}

async function restoreWhispraAccentSettings(): Promise<void> {
    const whispraAccentSelect = document.getElementById('whispra-translate-accent') as HTMLSelectElement;
    if (!whispraAccentSelect) return;

    try {
        const response = await (window as any).electronAPI.invoke('config:get', {
            id: Date.now().toString(),
            timestamp: Date.now(),
            payload: null
        });

        if (response.success && response.payload?.accentSettings) {
            const settings = response.payload.accentSettings;
            const preset = settings.preset || '';
            whispraAccentSelect.value = preset;
            
            // Update global accent state
            selectedAccent = preset;
            customAccentValue = settings.customValue || '';
            
            // Auto-toggle accent: enabled if accent is selected (not empty), disabled if "No Accent"
            accentEnabled = selectedAccent !== '' && selectedAccent !== null;
        }
    } catch (error) {
        console.error('Error restoring accent settings:', error);
    }
}

async function onWhispraAccentChange(): Promise<void> {
    const whispraAccentSelect = document.getElementById('whispra-translate-accent') as HTMLSelectElement;
    if (!whispraAccentSelect) return;

    const newSelectedAccent = whispraAccentSelect.value;
    
    // Update main accent select to keep them in sync
    if (accentPreset && accentPreset.value !== newSelectedAccent) {
        accentPreset.value = newSelectedAccent;
    }

    // Update the global accent state
    selectedAccent = newSelectedAccent;
    
    // Auto-toggle accent: enabled if accent is selected (not empty), disabled if "No Accent"
    accentEnabled = selectedAccent !== '' && selectedAccent !== null;
    
    // Update accent toggle button UI if it exists
    if (accentToggle) {
        accentToggle.textContent = accentEnabled ? '🎭 Accent: ON' : '🎭 Accent: OFF';
        accentToggle.style.background = accentEnabled ? 'var(--focus)' : 'var(--panel)';
        accentToggle.style.color = accentEnabled ? '#000' : 'var(--text)';
    }

    // Show/hide custom accent text field
    if (selectedAccent === 'custom') {
        customAccentText.style.display = 'block';
    } else {
        customAccentText.style.display = 'none';
    }

    // Update accent selector visibility
    updateAccentSelectorVisibility();

    // Save the selection
    await saveAccentSettings();
}

async function initializeWhispraTranslateKeybinds(): Promise<void> {
    // Load PTT keybind
    await loadWhispraPTTKeybind();
    
    // Load bidirectional keybind
    await loadWhispraBidirectionalKeybind();
}

async function loadWhispraPTTKeybind(): Promise<void> {
    const whispraPTTKeybind = document.getElementById('whispra-translate-ptt-keybind') as HTMLElement;
    if (!whispraPTTKeybind) return;

    try {
        const response = await (window as any).electronAPI.invoke('config:get', {
            id: Date.now().toString(),
            timestamp: Date.now(),
            payload: null
        });

        if (response.success) {
            const cfg = response.payload;
            // Default to Ctrl+Space for Windows, Space for other platforms
            const isWindows = (window as any).electronAPI?.platform === 'win32';
            const defaultPTTHotkey = isWindows 
                ? { ctrl: true, alt: false, shift: false, key: 'Space' }
                : { ctrl: false, alt: false, shift: false, key: 'Space' };
            let pttHotkey = cfg.uiSettings?.pttHotkey || defaultPTTHotkey;
            
            // Migrate existing configs: if no modifiers, update based on key
            const hasNoModifiers = !pttHotkey.ctrl && !pttHotkey.alt && !pttHotkey.shift;
            if (hasNoModifiers && cfg.uiSettings?.pttHotkey) {
                let needsUpdate = false;
                if (pttHotkey.key === 'Space') {
                    // Space bar without modifiers -> Ctrl+Space
                    pttHotkey = { ctrl: true, alt: false, shift: false, key: 'Space' };
                    needsUpdate = true;
                    console.log('🔄 Migrating PTT hotkey: Space -> Ctrl+Space');
                } else if (pttHotkey.key && pttHotkey.key !== 'Space') {
                    // Any other key without modifiers -> add Alt
                    pttHotkey = { ctrl: false, alt: true, shift: false, key: pttHotkey.key };
                    needsUpdate = true;
                    console.log(`🔄 Migrating PTT hotkey: ${pttHotkey.key} -> Alt+${pttHotkey.key}`);
                }
                
                if (needsUpdate) {
                    try {
                        await (window as any).electronAPI.invoke('config:set', {
                            id: Date.now().toString(),
                            timestamp: Date.now(),
                            payload: { uiSettings: { pttHotkey } }
                        });
                        console.log('✅ PTT hotkey migrated successfully');
                    } catch (error) {
                        console.warn('Failed to migrate PTT hotkey config:', error);
                    }
                }
            }

            // Convert from hotkey object to display format
            let pttKey = pttHotkey.key;
            let displayKey = pttKey === 'Space' ? 'Space' :
                pttKey.startsWith('Key') ? pttKey.substring(3) :
                    pttKey;

            // Add modifiers if any
            const modifiers = [];
            if (pttHotkey.ctrl) modifiers.push('Ctrl');
            if (pttHotkey.alt) modifiers.push('Alt');
            if (pttHotkey.shift) modifiers.push('Shift');
            
            const displayText = modifiers.length > 0 ? `${modifiers.join(' + ')} + ${displayKey}` : displayKey;
            whispraPTTKeybind.textContent = displayText;
        }
    } catch (error) {
        console.error('Failed to load PTT hotkey:', error);
        // Default to Ctrl+Space for Windows, Space for other platforms
        const isWindows = (window as any).electronAPI?.platform === 'win32';
        whispraPTTKeybind.textContent = isWindows ? 'Ctrl + Space' : 'Space';
    }
}

async function initializeWhispraTranslateCaptions(): Promise<void> {
    // Only initialize once to prevent duplicate event listeners
    if ((window as any).whispraCaptionsInitialized) {
        // Just update the UI state, don't add listeners again
        updateWhispraCaptionsToggle();
        return;
    }
    (window as any).whispraCaptionsInitialized = true;
    
    const whispraCaptionsToggle = document.getElementById('whispra-bidirectional-captions-toggle') as HTMLButtonElement;
    const whispraCaptionsSettings = document.getElementById('whispra-bidirectional-captions-settings') as HTMLButtonElement;
    
    if (!whispraCaptionsToggle) {
        console.error('Whispra captions toggle not found');
        return;
    }
    
    // Update toggle UI based on current state
    updateWhispraCaptionsToggle();
    
    // Wire up toggle button (only once)
    whispraCaptionsToggle.addEventListener('click', async (e) => {
        e.stopPropagation(); // Prevent event bubbling
        e.preventDefault(); // Prevent default behavior
        await toggleBidirectionalCaptions();
        // updateBidirectionalCaptionsToggle() is called inside toggleBidirectionalCaptions(),
        // which already updates the whispra toggle via the code in BidirectionalCaptions.ts
        // No need to call updateWhispraCaptionsToggle() again
    });
    
    // Wire up settings button (only once)
    if (whispraCaptionsSettings) {
        whispraCaptionsSettings.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent event bubbling
            e.preventDefault(); // Prevent default behavior
            showCaptionsSettingsModal();
        });
    }
}

function updateWhispraCaptionsToggle(): void {
    const whispraCaptionsToggle = document.getElementById('whispra-bidirectional-captions-toggle') as HTMLButtonElement;
    const whispraCaptionsSettings = document.getElementById('whispra-bidirectional-captions-settings') as HTMLButtonElement;
    
    if (!whispraCaptionsToggle) return;
    
    // Import the current state value - need to re-import to get latest value
    // Since bidirectionalCaptionsEnabled is exported as let, we need to access it fresh
    // We'll use a getter function pattern or access it directly from the module
    // For now, we'll rely on updateBidirectionalCaptionsToggle() which is called from toggleBidirectionalCaptions()
    // But we'll also read it directly here to ensure we have the latest value
    
    // Read the current state - the imported bidirectionalCaptionsEnabled should be reactive
    // but to be safe, we'll also check if updateBidirectionalCaptionsToggle was just called
    const currentState = bidirectionalCaptionsEnabled;
    
    // Update button text
    whispraCaptionsToggle.textContent = `Captions: ${currentState ? 'ON' : 'OFF'}`;
    
    // Update button styling based on state
    if (currentState) {
        whispraCaptionsToggle.style.background = 'var(--focus)';
        whispraCaptionsToggle.style.color = 'var(--text-on-focus)';
    } else {
        whispraCaptionsToggle.style.background = 'rgba(255, 255, 255, 0.05)';
        whispraCaptionsToggle.style.color = 'var(--text)';
    }
    
    // Show/hide settings button
    if (whispraCaptionsSettings) {
        whispraCaptionsSettings.style.display = currentState ? 'flex' : 'none';
        
        // Re-initialize Lucide icons
        if ((window as any).lucide) {
            (window as any).lucide.createIcons();
        }
    }
}

/**
 * Apply Mac-specific restrictions to the whispra translate bidirectional section
 */
function applyMacBidirectionalRestrictionsToWhispraTranslate(): void {
    const isMac = (window as any).electronAPI?.platform === 'darwin';
    if (!isMac) return;

    console.log('🍎 Applying Mac bidirectional restrictions to Whispra Translate');

    // Find the bidirectional glass card
    const bidirectionalGlassCard = document.querySelector('.glasscard:has(#whispra-bidirectional-status)') as HTMLElement;
    if (!bidirectionalGlassCard) {
        console.warn('Bidirectional glass card not found');
        return;
    }

    // Grey out the entire card
    bidirectionalGlassCard.style.opacity = '0.5';
    bidirectionalGlassCard.style.pointerEvents = 'none';
    bidirectionalGlassCard.style.position = 'relative';

    // Add coming soon overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: absolute;
        inset: 0;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        z-index: 100;
        border-radius: inherit;
        backdrop-filter: blur(4px);
        pointer-events: auto;
    `;
    overlay.innerHTML = `
        <div style="text-align: center; color: white; padding: 2rem;">
            <div style="font-size: 48px; margin-bottom: 1rem;">🚧</div>
            <h2 style="margin: 0 0 0.5rem; font-size: 1.5rem; font-weight: 600;">Coming Soon on macOS</h2>
            <p style="margin: 0; opacity: 0.8; font-size: 0.95rem; max-width: 300px;">
                Bidirectional translation is currently only available on Windows. 
                macOS support is in development.
            </p>
        </div>
    `;

    bidirectionalGlassCard.appendChild(overlay);

    // Update the title to show it's coming soon
    const titleElement = bidirectionalGlassCard.querySelector('h3');
    if (titleElement) {
        titleElement.innerHTML = 'Bidirectional <span style="font-size: 0.7em; background: rgba(255,165,0,0.3); padding: 2px 6px; border-radius: 4px; margin-left: 8px;">Soon</span>';
    }

    // Also disable the bidirectional keybind container
    const whispraTranslateBidiKeybindContainer = document.getElementById('whispra-translate-bidi-keybind-container') as HTMLElement | null;
    if (whispraTranslateBidiKeybindContainer) {
        whispraTranslateBidiKeybindContainer.style.opacity = '0.5';
        whispraTranslateBidiKeybindContainer.style.pointerEvents = 'none';
        whispraTranslateBidiKeybindContainer.style.cursor = 'not-allowed';
        whispraTranslateBidiKeybindContainer.title = 'Coming Soon on macOS';
    }

    console.log('✅ Mac bidirectional restrictions applied to Whispra Translate');
}

/**
 * Apply Mac-specific restrictions to the whispra screen translate section
 */
function applyMacScreenTranslateRestrictionsToWhispraScreen(): void {
    const isMac = (window as any).electronAPI?.platform === 'darwin';
    if (!isMac) return;

    console.log('🍎 Applying Mac screen translate restrictions to Whispra Screen');

    // Grey out and disable the sidebar button
    const whispraScreenButton = document.getElementById('sidebar-whispra-screen-button') as HTMLButtonElement | null;
    if (whispraScreenButton) {
        whispraScreenButton.style.opacity = '0.5';
        whispraScreenButton.style.cursor = 'not-allowed';
        whispraScreenButton.title = 'Screen Translate - Coming Soon on macOS';
        
        // Add "Coming Soon" badge to the button
        const label = whispraScreenButton.querySelector('.label');
        if (label) {
            label.innerHTML = 'Screen Translate <span style="font-size: 9px; background: rgba(255,165,0,0.3); padding: 1px 4px; border-radius: 3px; margin-left: 4px;">Soon</span>';
        }
    }

    // Find the screen translate panel
    const whispraScreenPanel = document.getElementById('whispra-screen-panel') as HTMLElement | null;
    if (whispraScreenPanel) {
        // Make panel position relative for overlay positioning
        whispraScreenPanel.style.position = 'relative';
        
        // Add coming soon overlay to the panel
        const overlay = document.createElement('div');
        overlay.id = 'screen-translate-mac-overlay';
        overlay.style.cssText = `
            position: absolute;
            inset: 0;
            background: rgba(0, 0, 0, 0.7);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            z-index: 100;
            border-radius: inherit;
            backdrop-filter: blur(4px);
        `;
        overlay.innerHTML = `
            <div style="text-align: center; color: white; padding: 2rem;">
                <div style="font-size: 48px; margin-bottom: 1rem;">🚧</div>
                <h2 style="margin: 0 0 0.5rem; font-size: 1.5rem; font-weight: 600;">Coming Soon on macOS</h2>
                <p style="margin: 0; opacity: 0.8; font-size: 0.95rem; max-width: 300px;">
                    Screen translation is currently only available on Windows. 
                    macOS support is in development.
                </p>
            </div>
        `;

        whispraScreenPanel.appendChild(overlay);
    }

    console.log('✅ Mac screen translate restrictions applied to Whispra Screen');
}

async function loadWhispraBidirectionalKeybind(): Promise<void> {
    const whispraBidiKeybind = document.getElementById('whispra-translate-bidi-keybind') as HTMLElement;
    if (!whispraBidiKeybind) return;

    try {
        const response = await (window as any).electronAPI.invoke('config:get', {
            id: Date.now().toString(),
            timestamp: Date.now(),
            payload: null
        });

        if (response.success) {
            const cfg = response.payload;
            const defaultBidiHotkey = { ctrl: false, alt: true, shift: false, key: 'B' };
            const bidiHotkey = cfg.uiSettings?.bidirectionalHotkey || defaultBidiHotkey;

            // Convert from hotkey object to display format
            let bidiKey = bidiHotkey.key;
            let displayKey = bidiKey.startsWith('Key') ? bidiKey.substring(3) : bidiKey;

            // Add modifiers if any
            const modifiers = [];
            if (bidiHotkey.ctrl) modifiers.push('Ctrl');
            if (bidiHotkey.alt) modifiers.push('Alt');
            if (bidiHotkey.shift) modifiers.push('Shift');
            
            const displayText = modifiers.length > 0 ? `${modifiers.join(' + ')} + ${displayKey}` : displayKey;
            whispraBidiKeybind.textContent = displayText;
        }
    } catch (error) {
        console.error('Failed to load bidirectional hotkey:', error);
        whispraBidiKeybind.textContent = 'Alt + B';
    }
}

async function loadPTTHotkey(): Promise<void> {
    try {
        const response = await (window as any).electronAPI.invoke('config:get', {
            id: Date.now().toString(),
            timestamp: Date.now(),
            payload: null
        });

        if (response.success) {
            const cfg = response.payload;
            // Default to Ctrl+Space for Windows, Space for other platforms
            const isWindows = (window as any).electronAPI?.platform === 'win32';
            const defaultPTTHotkey = isWindows 
                ? { ctrl: true, alt: false, shift: false, key: 'Space' }
                : { ctrl: false, alt: false, shift: false, key: 'Space' };
            let pttHotkey = cfg.uiSettings?.pttHotkey || defaultPTTHotkey;
            
            // Migrate existing configs: if no modifiers, update based on key
            const hasNoModifiers = !pttHotkey.ctrl && !pttHotkey.alt && !pttHotkey.shift;
            if (hasNoModifiers && cfg.uiSettings?.pttHotkey) {
                let needsUpdate = false;
                if (pttHotkey.key === 'Space') {
                    // Space bar without modifiers -> Ctrl+Space
                    pttHotkey = { ctrl: true, alt: false, shift: false, key: 'Space' };
                    needsUpdate = true;
                    console.log('🔄 Migrating PTT hotkey: Space -> Ctrl+Space');
                } else if (pttHotkey.key && pttHotkey.key !== 'Space') {
                    // Any other key without modifiers -> add Alt
                    pttHotkey = { ctrl: false, alt: true, shift: false, key: pttHotkey.key };
                    needsUpdate = true;
                    console.log(`🔄 Migrating PTT hotkey: ${pttHotkey.key} -> Alt+${pttHotkey.key}`);
                }
                
                if (needsUpdate) {
                    try {
                        await (window as any).electronAPI.invoke('config:set', {
                            id: Date.now().toString(),
                            timestamp: Date.now(),
                            payload: { uiSettings: { pttHotkey } }
                        });
                        console.log('✅ PTT hotkey migrated successfully');
                    } catch (error) {
                        console.warn('Failed to migrate PTT hotkey config:', error);
                    }
                }
            }

            // Convert from hotkey object to event.code format
            let pttKey = pttHotkey.key;
            if (pttKey.startsWith('Key') && pttKey.length === 4) {
                currentKeybind = pttKey; // Already in KeyB format
            } else if (pttKey === 'Space') {
                currentKeybind = 'Space';
            } else if (/^[A-Z]$/i.test(pttKey)) {
                currentKeybind = `Key${pttKey.toUpperCase()}`; // Convert B to KeyB
            } else {
                currentKeybind = pttKey; // Use as-is for function keys, etc.
            }

            // Update UI display
            updatePTTKeybindDisplay(currentKeybind, currentKeybindSpan, translationKeybindDisplay);
            
            // Update whispra translate PTT keybind display
            const whispraPTTKeybind = document.getElementById('whispra-translate-ptt-keybind') as HTMLElement;
            if (whispraPTTKeybind) {
                const displayKey = currentKeybind === 'Space' ? 'Space' :
                    currentKeybind.startsWith('Key') ? currentKeybind.substring(3) :
                        currentKeybind;
                const modifiers = [];
                if (pttHotkey.ctrl) modifiers.push('Ctrl');
                if (pttHotkey.alt) modifiers.push('Alt');
                if (pttHotkey.shift) modifiers.push('Shift');
                const displayText = modifiers.length > 0 ? `${modifiers.join(' + ')} + ${displayKey}` : displayKey;
                whispraPTTKeybind.textContent = displayText;
            }

            console.log('PTT hotkey loaded:', { config: pttHotkey, currentKeybind });
        }
    } catch (error) {
        console.error('Failed to load PTT hotkey:', error);
    }
}


async function loadBidirectionalOutputDevices(): Promise<void> {
    if (!bidirectionalOutputSelect) return;
    try {
        logToDebug('Loading bidirectional output devices...');

        const devices = await navigator.mediaDevices.enumerateDevices();
        const outputs = devices.filter(d => d.kind === 'audiooutput');

        // Clear existing options
        bidirectionalOutputSelect.innerHTML = '<option value="">Select output device...</option>';

        // Add device options
        outputs.forEach((device) => {
            const option = document.createElement('option');
            option.value = device.deviceId;
            option.textContent = device.label || 'Output Device';

            if (device.deviceId === 'default') {
                option.textContent += ' (Default)';
            }

            bidirectionalOutputSelect.appendChild(option);
        });

        // Auto-detect VB-Audio Cable Input for bidirectional mode
        // This allows WASAPI to capture system audio while excluding Whispra's TTS
        const vbCableDevice = outputs.find(device => {
            const label = (device.label || '').toLowerCase();
            return label.includes('cable input') ||
                   label.includes('vb-audio cable') ||
                   label.includes('cable-a input') ||
                   label.includes('cable-b input');
        });

        let selectedDevice: MediaDeviceInfo | null = null;

        if (vbCableDevice) {
            // VB-Audio Cable found - auto-select it
            selectedDevice = vbCableDevice;
            bidirectionalOutputSelect.value = vbCableDevice.deviceId;
            bidirectionalOutputDeviceId = vbCableDevice.deviceId;
            logToDebug(`✅ Auto-detected VB-Audio Cable: ${vbCableDevice.label}`);
            logToDebug(`💡 TIP: Enable "Listen to this device" in Windows Sound Settings → ${vbCableDevice.label} → Listen tab`);
        } else {
            // VB-Audio Cable not found - use default device
            const defaultDevice = outputs.find(device => device.deviceId === 'default') || outputs[0];
            if (defaultDevice) {
                selectedDevice = defaultDevice;
                bidirectionalOutputSelect.value = defaultDevice.deviceId;
                bidirectionalOutputDeviceId = defaultDevice.deviceId;
                logToDebug(`⚠️ VB-Audio Cable not found, using default output: ${defaultDevice.label || 'Default Output Device'}`);
                logToDebug(`💡 RECOMMENDATION: Install VB-Audio Cable (https://vb-audio.com/Cable/) to prevent TTS echo in bidirectional mode`);
            } else {
                // No devices found
                bidirectionalOutputSelect.innerHTML = '<option value="">No output devices found</option>';
                logToDebug('❌ No output devices found');
                return;
            }
        }

        // Save the selected device
        if (selectedDevice) {
            try {
                await (window as any).electronAPI.invoke('config:set', {
                    id: Date.now().toString(),
                    timestamp: Date.now(),
                    payload: {
                        uiSettings: {
                            bidirectionalOutputDeviceId: selectedDevice.deviceId
                        }
                    }
                });
                logToDebug(`✅ Auto-configured bidirectional output: ${selectedDevice.label || 'Output Device'}`);
            } catch (error) {
                logToDebug(`Error saving output device selection: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }

        logToDebug(`Found ${outputs.length} audio output devices for bidirectional mode`);
    } catch (error) {
        console.error('Error loading bidirectional output devices:', error);
        logToDebug(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        bidirectionalOutputSelect.innerHTML = '<option value="">🚫 Output device access denied</option>';
    }
}

async function loadBidirectionalProcesses(): Promise<void> {
    if (!bidirectionalProcessSelect) return;
    try {
        bidirectionalProcessSelect.innerHTML = '<option value="">Loading processes...</option>';

        console.log('[Bidi] Requesting all processes from WASAPI addon...');
        const sessions = await (window as any).electronAPI.enumerateAudioSessions();
        console.log('[Bidi] Received sessions:', sessions);

        if (!sessions || sessions.length === 0) {
            bidirectionalProcessSelect.innerHTML = '<option value="">No processes found</option>';
            console.warn('[Bidi] No processes found');
            return;
        }

        // Group processes by name and track which have active audio
        // Session structure: { pid: number; processName: string; hasActiveAudio?: boolean }
        const processMap = new Map<string, { count: number; hasActiveAudio: boolean }>();
        sessions.forEach((session: { pid: number; processName: string; hasActiveAudio?: boolean }) => {
            const name = session.processName.toLowerCase();
            const existing = processMap.get(name);
            if (existing) {
                existing.count++;
                // Mark as having active audio if ANY instance has it
                if (session.hasActiveAudio) {
                    existing.hasActiveAudio = true;
                }
            } else {
                processMap.set(name, {
                    count: 1,
                    hasActiveAudio: session.hasActiveAudio || false
                });
            }
        });

        // Sort by name for better UX
        const sortedProcesses = Array.from(processMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));

        bidirectionalProcessSelect.innerHTML = '<option value="">Select a process...</option>';

        sortedProcesses.forEach(([processName, info]) => {
            const option = document.createElement('option');
            option.value = processName;

            // Build display name with indicators
            let displayName = processName;
            if (info.count > 1) {
                displayName += ` (${info.count} instances)`;
            }
            if (info.hasActiveAudio) {
                displayName = '🔊 ' + displayName;
            }

            option.textContent = displayName;
            bidirectionalProcessSelect.appendChild(option);
        });

        // Restore saved selection if available
        if (selectedProcessName) {
            bidirectionalProcessSelect.value = selectedProcessName;
        }

        console.log(`[Bidi] Loaded ${sortedProcesses.length} processes (${Array.from(processMap.values()).filter(p => p.hasActiveAudio).length} with active audio)`);
    } catch (error) {
        console.error('[Bidi] Error loading processes:', error);
        bidirectionalProcessSelect.innerHTML = '<option value="">Error loading processes</option>';
    }
}

async function onBidirectionalProcessChange(): Promise<void> {
    if (!bidirectionalProcessSelect) return;
    const newProcessName = bidirectionalProcessSelect.value || null;
    
    // Update both local and shared state
    selectedProcessName = newProcessName;
    setBidiSelectedProcessName(newProcessName);
    
    try {
        await (window as any).electronAPI.invoke('config:set', {
            id: Date.now().toString(),
            timestamp: Date.now(),
            payload: { uiSettings: { bidirectionalProcessName: newProcessName } }
        });
        console.log(`[Bidi] Selected process: ${newProcessName}`);
    } catch (error) {
        console.warn('[Bidi] Failed to save process selection:', error);
    }
}

// loadBidirectionalInputDevices function removed - now hardcoded to Display/System Audio

async function loadIncomingVoices(): Promise<void> {
    if (!incomingVoiceSelect) return;
    try {
        incomingVoiceSelect.innerHTML = '<option value="">Loading voices...</option>';

        // Check if user is in managed mode or has ElevenLabs API key
        const configResponse = await (window as any).electronAPI.invoke('config:get', {
            id: Date.now().toString(),
            timestamp: Date.now(),
            payload: null
        });

        const config = configResponse?.payload;
        const currentMode = config?.managedApiConfig?.mode || 'personal';
        const isManaged = currentMode === 'managed';

        // Check for ElevenLabs API key if in personal mode
        let hasElevenLabsKey = false;
        if (!isManaged) {
            try {
                const apiKeyResponse = await (window as any).electronAPI.invoke('secure-api-keys:get', {
                    id: Date.now().toString(),
                    timestamp: Date.now(),
                    payload: null
                });
                const apiKeys = apiKeyResponse?.payload || {};
                hasElevenLabsKey = !!(apiKeys.elevenlabs && apiKeys.elevenlabs.trim().length > 0);
            } catch (error) {
                console.error('Error checking API keys:', error);
            }
        }

        // Try to load voices from ElevenLabs API (only if in managed mode or has API key)
        let voices = [];
        if (isManaged || hasElevenLabsKey) {
            try {
                const response = await (window as any).electronAPI.invoke('voice:get-voices', {
                    id: Date.now().toString(),
                    timestamp: Date.now(),
                    payload: null
                });

                if (response.success && response.payload) {
                    voices = response.payload;
                }
            } catch (error) {
                console.log('Failed to load voices from API, using defaults');
            }
        } else {
            console.log('No ElevenLabs API key found and not in managed mode - no voices available');
        }

        // If no voices from API and we have access, use fallback voices
        if (voices.length === 0 && (isManaged || hasElevenLabsKey)) {
            voices = [
                { id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam (Male, English)' },
                { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella (Female, English)' }
            ];
        }

        incomingVoiceSelect.innerHTML = '';

        // Only add voices if we have access (managed mode or API key)
        if (isManaged || hasElevenLabsKey) {
            if (voices.length === 0) {
                // Add a fallback option if no voices found
                const fallbackOpt = document.createElement('option');
                fallbackOpt.value = 'pNInz6obpgDQGcFmaJgB';
                fallbackOpt.textContent = 'Adam (Male, English) - Default';
                incomingVoiceSelect.appendChild(fallbackOpt);
                console.log('No voices found, using fallback voice');
                
                if (!incomingVoiceId) {
                    const fallbackVoice = 'pNInz6obpgDQGcFmaJgB';
                    incomingVoiceId = fallbackVoice;
                    setIncomingVoiceId(fallbackVoice);
                    incomingVoiceSelect.value = fallbackVoice;
                }
            } else {
                voices.forEach((v: any) => {
                    const opt = document.createElement('option');
                    opt.value = v.id;
                    opt.textContent = v.name;
                    incomingVoiceSelect.appendChild(opt);
                });

                // Always ensure we have a voice selected
                if (!incomingVoiceId || incomingVoiceId === 'null') {
                    const defaultVoice = voices[0].id;
                    incomingVoiceId = defaultVoice;
                    setIncomingVoiceId(defaultVoice);
                    console.log(`Auto-selected incoming voice: ${voices[0].name} (${defaultVoice})`);
                }
                
                // Update the dropdown to match the current voice
                if (incomingVoiceId) {
                    incomingVoiceSelect.value = incomingVoiceId;
                }
            }
        } else {
            // No API key and not in managed mode - show message
            incomingVoiceSelect.innerHTML = '<option value="">No API key configured</option>';
            incomingVoiceSelect.disabled = true;
            console.log('No ElevenLabs API key found - incoming voices disabled');
            
            // Add a message or link to add API key
            const controlGroup = incomingVoiceSelect.closest('.control-group') as HTMLElement | null;
            if (controlGroup) {
                // Check if message already exists
                let messageEl = controlGroup.querySelector('.voice-api-key-message') as HTMLElement | null;
                if (!messageEl) {
                    messageEl = document.createElement('div');
                    messageEl.className = 'voice-api-key-message';
                    messageEl.style.cssText = `
                        margin-top: 0.5rem;
                        padding: 0.5rem;
                        background: rgba(255, 200, 0, 0.1);
                        border: 1px solid rgba(255, 200, 0, 0.3);
                        border-radius: 4px;
                        font-size: 0.8rem;
                        color: rgba(255, 255, 255, 0.8);
                        text-align: center;
                    `;
                    messageEl.innerHTML = `
                        <div>Add an ElevenLabs API key in Settings to use voices</div>
                        <button style="margin-top: 0.5rem; padding: 0.25rem 0.75rem; background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 4px; color: var(--text); cursor: pointer; font-size: 0.75rem;">Open Settings</button>
                    `;
                    const settingsBtn = messageEl.querySelector('button') as HTMLButtonElement;
                    if (settingsBtn) {
                        settingsBtn.addEventListener('click', async () => {
                            try {
                                const { SettingsIntegration } = await import('./ui/settings/SettingsIntegration.js');
                                const settingsIntegration = SettingsIntegration.getInstance();
                                settingsIntegration.showSettings('api-keys');
                            } catch (error) {
                                console.error('Failed to open settings:', error);
                            }
                        });
                    }
                    controlGroup.appendChild(messageEl);
                }
            }
            return;
        }

        // Re-enable select if it was disabled
        incomingVoiceSelect.disabled = false;
        
        // Remove any API key message if it exists
        const controlGroup = incomingVoiceSelect.closest('.control-group');
        if (controlGroup) {
            const messageEl = controlGroup.querySelector('.voice-api-key-message');
            if (messageEl) {
                messageEl.remove();
            }
        }

        console.log(`Loaded ${voices.length} voices for bidirectional mode (selected: ${incomingVoiceId})`);
    } catch (error) {
        console.error('Error loading incoming voices:', error);
        incomingVoiceSelect.innerHTML = '<option value="">Error loading voices</option>';
    }
}

async function loadWhispraBidirectionalIncomingVoices(): Promise<void> {
    const whispraBidiVoiceSelect = document.getElementById('whispra-bidirectional-incoming-voice') as HTMLSelectElement;
    if (!whispraBidiVoiceSelect) return;

    try {
        whispraBidiVoiceSelect.innerHTML = '<option value="">Loading voices...</option>';

        // Check if user is in managed mode or has ElevenLabs API key
        const configResponse = await (window as any).electronAPI.invoke('config:get', {
            id: Date.now().toString(),
            timestamp: Date.now(),
            payload: null
        });

        const config = configResponse?.payload;
        const currentMode = config?.managedApiConfig?.mode || 'personal';
        const isManaged = currentMode === 'managed';

        // Check for ElevenLabs API key if in personal mode
        let hasElevenLabsKey = false;
        if (!isManaged) {
            try {
                const apiKeyResponse = await (window as any).electronAPI.invoke('secure-api-keys:get', {
                    id: Date.now().toString(),
                    timestamp: Date.now(),
                    payload: null
                });
                const apiKeys = apiKeyResponse?.payload || {};
                hasElevenLabsKey = !!(apiKeys.elevenlabs && apiKeys.elevenlabs.trim().length > 0);
            } catch (error) {
                console.error('Error checking API keys:', error);
            }
        }

        // Try to load voices from ElevenLabs API (only if in managed mode or has API key)
        let voices = [];
        if (isManaged || hasElevenLabsKey) {
            try {
                const response = await (window as any).electronAPI.invoke('voice:get-voices', {
                    id: Date.now().toString(),
                    timestamp: Date.now(),
                    payload: null
                });

                if (response.success && response.payload) {
                    voices = response.payload;
                }
            } catch (error) {
                console.log('Failed to load voices from API, using defaults');
            }
        } else {
            console.log('No ElevenLabs API key found and not in managed mode - no voices available');
        }

        // If no voices from API and we have access, use fallback voices
        if (voices.length === 0 && (isManaged || hasElevenLabsKey)) {
            voices = [
                { id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam (Male, English)' },
                { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella (Female, English)' }
            ];
        }

        whispraBidiVoiceSelect.innerHTML = '';

        // Only add voices if we have access (managed mode or API key)
        if (isManaged || hasElevenLabsKey) {
            if (voices.length === 0) {
                const fallbackOpt = document.createElement('option');
                fallbackOpt.value = 'pNInz6obpgDQGcFmaJgB';
                fallbackOpt.textContent = 'Adam (Male, English) - Default';
                whispraBidiVoiceSelect.appendChild(fallbackOpt);
            } else {
                voices.forEach((v: any) => {
                    const opt = document.createElement('option');
                    opt.value = v.id;
                    opt.textContent = v.name;
                    whispraBidiVoiceSelect.appendChild(opt);
                });
            }

            // Set the selected value from config or use default
            if (incomingVoiceId) {
                whispraBidiVoiceSelect.value = incomingVoiceId;
            } else if (voices.length > 0) {
                whispraBidiVoiceSelect.value = voices[0].id;
            }

            // Set up change handler
            whispraBidiVoiceSelect.addEventListener('change', async () => {
                const newVoiceId = whispraBidiVoiceSelect.value || null;
                if (newVoiceId && newVoiceId !== incomingVoiceId) {
                    incomingVoiceId = newVoiceId;
                    setIncomingVoiceId(newVoiceId);
                    try {
                        await (window as any).electronAPI.invoke('config:set', {
                            id: Date.now().toString(),
                            timestamp: Date.now(),
                            payload: { uiSettings: { incomingVoiceId: newVoiceId } }
                        });
                        console.log('Updated whispra bidirectional incoming voice to:', newVoiceId);
                    } catch (error) {
                        console.error('Error saving whispra bidirectional incoming voice:', error);
                    }
                }
            });
        } else {
            // No API key and not in managed mode - show message
            whispraBidiVoiceSelect.innerHTML = '<option value="">No API key configured</option>';
            whispraBidiVoiceSelect.disabled = true;
            console.log('No ElevenLabs API key found - whispra bidirectional voices disabled');
            
            // Add a message or link to add API key
            const dropdown = whispraBidiVoiceSelect.closest('.whispra-settings-dropdown') as HTMLElement | null;
            if (dropdown) {
                // Check if message already exists
                let messageEl = dropdown.querySelector('.voice-api-key-message') as HTMLElement | null;
                if (!messageEl) {
                    messageEl = document.createElement('div');
                    messageEl.className = 'voice-api-key-message';
                    messageEl.style.cssText = `
                        margin-top: 0.5rem;
                        padding: 0.5rem;
                        background: rgba(255, 200, 0, 0.1);
                        border: 1px solid rgba(255, 200, 0, 0.3);
                        border-radius: 4px;
                        font-size: 0.8rem;
                        color: rgba(255, 255, 255, 0.8);
                        text-align: center;
                    `;
                    messageEl.innerHTML = `
                        <div>Add an ElevenLabs API key in Settings to use voices</div>
                        <button style="margin-top: 0.5rem; padding: 0.25rem 0.75rem; background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 4px; color: var(--text); cursor: pointer; font-size: 0.75rem;">Open Settings</button>
                    `;
                    const settingsBtn = messageEl.querySelector('button') as HTMLButtonElement;
                    if (settingsBtn) {
                        settingsBtn.addEventListener('click', async () => {
                            try {
                                const { SettingsIntegration } = await import('./ui/settings/SettingsIntegration.js');
                                const settingsIntegration = SettingsIntegration.getInstance();
                                settingsIntegration.showSettings('api-keys');
                            } catch (error) {
                                console.error('Failed to open settings:', error);
                            }
                        });
                    }
                    dropdown.appendChild(messageEl);
                }
            }
            return;
        }

        // Re-enable select if it was disabled
        whispraBidiVoiceSelect.disabled = false;
        
        // Remove any API key message if it exists
        const dropdown = whispraBidiVoiceSelect.closest('.whispra-settings-dropdown');
        if (dropdown) {
            const messageEl = dropdown.querySelector('.voice-api-key-message');
            if (messageEl) {
                messageEl.remove();
            }
        }

        console.log(`Loaded ${voices.length} voices for whispra bidirectional mode`);
    } catch (error) {
        console.error('Error loading whispra bidirectional incoming voices:', error);
        whispraBidiVoiceSelect.innerHTML = '<option value="">Error loading voices</option>';
    }
}

async function onBidirectionalOutputChange(): Promise<void> {
    if (!bidirectionalOutputSelect) return;
    const newOutputId = bidirectionalOutputSelect.value || null;
    
    // Update both local and shared state
    bidirectionalOutputDeviceId = newOutputId;
    setBidirectionalOutputDeviceId(newOutputId);
    
    try {
        await (window as any).electronAPI.invoke('config:set', {
            id: Date.now().toString(),
            timestamp: Date.now(),
            payload: { uiSettings: { bidirectionalOutputDeviceId: newOutputId } }
        });
    } catch { }
    // If capturing display/system audio, restart WASAPI capture to follow new default output route
    try {
        if (isBidirectionalActive && bidirectionalUseDisplayAudio) {
            console.log('[renderer] 🔁 Output device changed; restarting WASAPI system capture');
            await (window as any).electronAPI.stopPerAppCapture();
            await (window as any).electronAPI.startPerAppCapture(0); // System-wide capture (will filter out our own audio)
        }
    } catch (e) {
        console.warn('[renderer] Failed to restart WASAPI after output change:', e);
    }
}

async function onBidirectionalSourceLanguageChange(): Promise<void> {
    if (!bidirectionalSourceLanguageSelect) return;
    
    // Skip saving during initialization
    if (isInitializingBidirectional) {
        console.log('🌐 Skipping bidirectional source language save during initialization');
        return;
    }
    
    const selectedLanguage = bidirectionalSourceLanguageSelect.value || 'auto';
    
    // Update both local and shared state
    bidirectionalSourceLanguage = selectedLanguage;
    setBidirectionalSourceLanguage(selectedLanguage);

    // Restart Argos if needed when source language changes (Argos uses both source and target)
    await restartArgosIfNeeded(`Bidirectional source language change: ${selectedLanguage}`);

    try {
        await (window as any).electronAPI.invoke('config:set', {
            id: Date.now().toString(),
            timestamp: Date.now(),
            payload: { uiSettings: { bidirectionalSourceLanguage: selectedLanguage } }
        });
        console.log('🌐 Bidirectional source language changed to:', selectedLanguage);
    } catch (error) {
        console.error('Failed to save bidirectional source language:', error);
    }
}

async function onBidirectionalTargetLanguageChange(): Promise<void> {
    if (!bidirectionalTargetLanguageSelect) return;
    
    // Skip saving during initialization
    if (isInitializingBidirectional) {
        console.log('🎯 Skipping bidirectional target language save during initialization');
        return;
    }
    
    const selectedLanguage = bidirectionalTargetLanguageSelect.value || 'en';
    
    // Update both local and shared state
    bidirectionalTargetLanguage = selectedLanguage;
    setBidirectionalTargetLanguage(selectedLanguage);

    // Restart Argos if needed when language changes
    await restartArgosIfNeeded(`Bidirectional target language change: ${selectedLanguage}`);

    try {
        await (window as any).electronAPI.invoke('config:set', {
            id: Date.now().toString(),
            timestamp: Date.now(),
            payload: { uiSettings: { bidirectionalTargetLanguage: selectedLanguage } }
        });
        console.log('🎯 Bidirectional target language changed to:', selectedLanguage);
    } catch (error) {
        console.error('Failed to save bidirectional target language:', error);
    }
}

// onBidirectionalInputChange function removed - now hardcoded to Display/System Audio

async function onIncomingVoiceChange(): Promise<void> {
    if (!incomingVoiceSelect) return;
    const newVoiceId = incomingVoiceSelect.value || null;
    
    // Update both local and shared state
    incomingVoiceId = newVoiceId;
    setIncomingVoiceId(newVoiceId);
    
    try {
        await (window as any).electronAPI.invoke('config:set', {
            id: Date.now().toString(),
            timestamp: Date.now(),
            payload: { uiSettings: { incomingVoiceId: newVoiceId } }
        });
    } catch { }
}

function setBidirectionalStatus(active: boolean): void {
    console.log('🔄 Setting bidirectional status:', active, 'Language:', currentLanguage);

    if (bidirectionalStatusIndicator) {
        bidirectionalStatusIndicator.classList.toggle('active', active);
    }
    if (bidirectionalRecordingDot) {
        bidirectionalRecordingDot.classList.toggle('active', active);
    }
    if (bidirectionalStatusText) {
        // Use translated status messages
        const translations = {
            'en': { status: { listening: 'Listening...', idle: 'Idle' } },
            'es': { status: { listening: 'Escuchando...', idle: 'Inactivo' } },
            'ru': { status: { listening: 'Прослушивание...', idle: 'Ожидание' } },
            'zh': { status: { listening: '正在监听...', idle: '空闲' } },
            'ja': { status: { listening: '聴取中...', idle: '待機中' } }
        };
        const langTranslations = translations[currentLanguage as keyof typeof translations] || translations['en'];
        const newStatusText = active ? langTranslations.status.listening : langTranslations.status.idle;
        console.log('📝 Setting status text to:', newStatusText);
        bidirectionalStatusText.textContent = newStatusText;
    }
    // Update whispra bidirectional status on glass card (get element dynamically)
    const bidirectionalStatusEl = document.getElementById('whispra-bidirectional-status') as HTMLSpanElement | null;
    if (bidirectionalStatusEl) {
        bidirectionalStatusEl.textContent = active ? 'Running' : 'Idle';
    }
    if (bidirectionalToggleButton) {
        bidirectionalToggleButton.textContent = getTranslatedBidirectionalButtonText(currentLanguage, active);
        if (!active) bidirectionalToggleButton.classList.remove('active');
        else bidirectionalToggleButton.classList.add('active');
    }
}

// handleBidirectionalKeyDown function removed - global handler now works everywhere

function showBidirectionalKeybindModal(): void {
    const modal = document.createElement('div');
    modal.style.cssText = `position: fixed; inset: 0; background: rgba(0,0,0,0.5); display:flex;align-items:center;justify-content:center; z-index:1000;`;
    const content = document.createElement('div');
    content.style.cssText = 'background:white;padding:1.5rem;border-radius:8px;max-width:90%;width:380px;text-align:center;color:black;';
    const modifierKey = getModifierKeyName();
    content.innerHTML = `
        <h3>Change Bidirectional Toggle Key</h3>
        <p>Press ${modifierKey} + any key to set it as the toggle</p>
        <div style="margin:1rem 0;">Current: <kbd>${modifierKey} + ${bidirectionalKeybind.startsWith('Key') ? bidirectionalKeybind.substring(3) : bidirectionalKeybind}</kbd></div>
        <button id="bidi-cancel" style="padding:0.5rem 1rem;">Cancel</button>
    `;
    modal.appendChild(content);
    document.body.appendChild(modal);
    let set = false;
    const listener = (e: KeyboardEvent) => {
        if (set) return;

        // Ignore modifier keys (Alt, Ctrl, Shift) when pressed alone
        if (e.code === 'AltLeft' || e.code === 'AltRight' ||
            e.code === 'ControlLeft' || e.code === 'ControlRight' ||
            e.code === 'ShiftLeft' || e.code === 'ShiftRight' ||
            e.code === 'MetaLeft' || e.code === 'MetaRight') {
            return; // Don't capture modifier keys alone
        }

        if (!e.altKey) return; // Only accept Alt + key combinations
        set = true;
        bidirectionalKeybind = e.code;

        // Update all display elements using helper function
        updateBidirectionalKeybindDisplay(bidirectionalKeybind, bidirectionalKeybindSpan, bidirectionalKeybindDisplay);
        // Convert to hotkey object format for config
        const keyForConfig = e.code.startsWith('Key') ? e.code.substring(3) : e.code;
        (window as any).electronAPI.invoke('config:set', {
            id: Date.now().toString(), timestamp: Date.now(), payload: {
                uiSettings: {
                    bidirectionalHotkey: {
                        ctrl: false,
                        alt: true,
                        shift: false,
                        key: keyForConfig
                    }
                }
            }
        }).catch(() => { });
        // Send hotkey update to main process with alt: true
        // Convert e.code (KeyB) to just the letter (B) for global listener
        const keyForGlobal = e.code.startsWith('Key') ? e.code.substring(3) : e.code;
        (window as any).electronAPI.invoke('hotkeys:update', {
            bidirectionalHotkey: {
                ctrl: false,
                alt: true,
                shift: false,
                key: keyForGlobal
            }
        }).catch(() => { });
        document.removeEventListener('keydown', listener);
        document.body.removeChild(modal);
    };
    document.addEventListener('keydown', listener);
    content.querySelector('#bidi-cancel')?.addEventListener('click', () => {
        document.removeEventListener('keydown', listener);
        document.body.removeChild(modal);
    });
}

// toggleBidirectional is now imported from BidirectionalControls module
// toggleBidirectionalCaptions, updateBidirectionalCaptionsToggle, updateCaptions, and clearCaptions
// are now imported from BidirectionalCaptions module - use the imported ones instead



async function playAudioToDevice(audioBufferArray: number[], sinkId?: string): Promise<void> {
    const audioBuffer = new Uint8Array(audioBufferArray).buffer;
    const audioBlob = new Blob([audioBuffer], { type: 'audio/mpeg' });
    const audio = new Audio();

    // Estimate audio duration (rough estimate based on typical MP3 compression)
    const estimatedDurationMs = (audioBufferArray.length / 1000) * 8; // Rough estimate

    // Notify main process that TTS playback is starting
    try {
        await (window as any).electronAPI.notifyTtsPlaybackStart(estimatedDurationMs);
    } catch (e) {
        console.warn('[renderer] Failed to notify TTS playback start:', e);
    }

    return new Promise<void>(async (resolve) => {
        try {
            const url = URL.createObjectURL(audioBlob);
            audio.onended = async () => {
                URL.revokeObjectURL(url);
                // Notify main process that TTS playback has ended
                try {
                    await (window as any).electronAPI.notifyTtsPlaybackEnd();
                } catch (e) {
                    console.warn('[renderer] Failed to notify TTS playback end:', e);
                }
                resolve(undefined);
            };
            audio.onerror = async () => {
                URL.revokeObjectURL(url);
                // Notify main process that TTS playback has ended (even on error)
                try {
                    await (window as any).electronAPI.notifyTtsPlaybackEnd();
                } catch (e) {
                    console.warn('[renderer] Failed to notify TTS playback end:', e);
                }
                resolve(undefined);
            };
            // Prefer explicit sink → selected bidirectional output → default
            const preferred = sinkId || bidirectionalOutputDeviceId || null;
            if (preferred && 'setSinkId' in audio) {
                try {
                    await (audio as any).setSinkId(preferred);
                    console.log(`[renderer] 🔈 setSinkId → ${preferred}`);
                } catch (e) {
                    console.warn('[renderer] ⚠️ setSinkId failed; using default', e);
                }
            }
            audio.src = url;
            audio.volume = MASTER_AUDIO_VOLUME;
            console.log(`[renderer] 🔊 Playing TTS at ${MASTER_AUDIO_VOLUME * 100}% volume`);
            await audio.play().catch((error) => {
                console.warn('[renderer] ⚠️ Audio play failed:', error);
                resolve(undefined);
            });
        } catch {
            // Notify main process that TTS playback has ended (even on error)
            try {
                await (window as any).electronAPI.notifyTtsPlaybackEnd();
            } catch (e) {
                console.warn('[renderer] Failed to notify TTS playback end:', e);
            }
            resolve(undefined);
        }
    });
}

async function onMicrophoneChange(): Promise<void> {
    const selectedDevice = microphoneSelect.value;
    logToDebug(`Microphone changed to: ${selectedDevice || 'None'}`);

    // Save the selection
    try {
        await (window as any).electronAPI.invoke('config:set', {
            id: Date.now().toString(),
            timestamp: Date.now(),
            payload: { selectedMicrophone: selectedDevice }
        });
    } catch (error) {
        logToDebug(`Error saving microphone selection: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // If passthrough is currently active (audioStream exists), restart with new microphone
    if (audioStream && selectedDevice) {
        try {
            logToDebug('🔄 Switching microphone passthrough to new device...');

            // Clean up current audio stream
            audioStream.getTracks().forEach(track => track.stop());
            audioStream = null;

            // Quickly initialize with new microphone and restart passthrough
            await initializeAudioStream();
            await restartPassthroughClean();

            logToDebug('✅ Microphone passthrough switched to new device');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logToDebug(`⚠️ Failed to switch passthrough to new microphone: ${errorMessage}`);
        }
    } else if (!audioStream && selectedDevice) {
        // No current stream, but microphone selected - start automatic passthrough
        await initializeAutomaticPassthrough();
    }
}

// Helper function to check if Argos is selected and restart it
async function restartArgosIfNeeded(reason: string): Promise<void> {
    try {
        // Check if Argos is selected as translation provider
        const configResponse = await (window as any).electronAPI.invoke('config:get', {
            id: Date.now().toString(),
            timestamp: Date.now(),
            payload: null
        });
        
        if (!configResponse.success || !configResponse.payload) {
            return;
        }
        
        const config = configResponse.payload;
        const processingMode = config.processingConfig?.mode 
            || config.processingMode 
            || (config.localModelConfig?.gptModel === 'argos' ? 'local' : 'cloud')
            || 'cloud';
        
        const localProvider = config.localModelConfig?.gptModel;
        
        // Check if Argos is selected
        let isArgosSelected = false;
        if (localProvider === 'argos') {
            isArgosSelected = true;
        } else {
            const modelConfig = processingMode === 'local'
                ? config.localModelConfig
                : config.cloudModelConfig;
            const mainProvider = modelConfig?.gptModel;
            isArgosSelected = processingMode === 'local' && mainProvider === 'argos';
        }
        
        if (isArgosSelected) {
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
        }
    } catch (error) {
        console.error('❌ Failed to restart Argos service:', error);
        // Don't throw - allow translation to proceed, it will fallback if needed
    }
}

async function onLanguageChange(): Promise<void> {
    // Skip saving during initialization
    if (isInitializingTranslatePage) {
        console.log('🌐 Skipping translate page language save during initialization');
        return;
    }
    
    const selectedLanguage = languageSelect.value;
    const languageName = languageSelect.options[languageSelect.selectedIndex].text;
    logToDebug(`Target language changed to: ${languageName} (${selectedLanguage})`);

    // Sync with whispra translate page target language selector
    const whispraTargetLang = document.getElementById('whispra-left-target-lang') as HTMLSelectElement;
    if (whispraTargetLang && whispraTargetLang.value !== selectedLanguage) {
        whispraTargetLang.value = selectedLanguage;
    }

    // Restart Argos if needed when language changes
    await restartArgosIfNeeded(`Main translate page target language change: ${selectedLanguage}`);

    // Save the selection
    try {
        await (window as any).electronAPI.invoke('config:set', {
            id: Date.now().toString(),
            timestamp: Date.now(),
            payload: { targetLanguage: selectedLanguage }
        });
    } catch (error) {
        logToDebug(`Error saving language selection: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

async function onVoiceChange(): Promise<void> {
    const selectedVoice = voiceSelect.value;
    logToDebug(`Voice changed to: ${selectedVoice}`);

    // Save the selection
    try {
        await (window as any).electronAPI.invoke('config:set', {
            id: Date.now().toString(),
            timestamp: Date.now(),
            payload: { voiceId: selectedVoice }
        });
    } catch (error) {
        logToDebug(`Error saving voice selection: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

async function onAccentPresetChange(): Promise<void> {
    selectedAccent = accentPreset.value;
    logToDebug(`Accent preset changed to: ${selectedAccent}`);

    // Auto-toggle accent: enabled if accent is selected (not empty), disabled if "No Accent"
    accentEnabled = selectedAccent !== '' && selectedAccent !== null;
    
    // Update accent toggle button UI if it exists
    if (accentToggle) {
        accentToggle.textContent = accentEnabled ? '🎭 Accent: ON' : '🎭 Accent: OFF';
        accentToggle.style.background = accentEnabled ? 'var(--focus)' : 'var(--panel)';
        accentToggle.style.color = accentEnabled ? '#000' : 'var(--text)';
    }

    // Show/hide custom accent text field
    if (selectedAccent === 'custom') {
        customAccentText.style.display = 'block';
    } else {
        customAccentText.style.display = 'none';
    }

    // Update accent selector visibility
    updateAccentSelectorVisibility();

    // Save the selection
    await saveAccentSettings();
}

function updateAccentSelectorVisibility(): void {
    if (accentSelectorGroup) {
        accentSelectorGroup.style.display = accentEnabled ? 'block' : 'none';
    }
}

function onAccentToggleClick(): void {
    accentEnabled = !accentEnabled;
    accentToggle.textContent = accentEnabled ? '🎭 Accent: ON' : '🎭 Accent: OFF';
    accentToggle.style.background = accentEnabled ? 'var(--focus)' : 'var(--panel)';
    accentToggle.style.color = accentEnabled ? '#000' : 'var(--text)';

    updateAccentSelectorVisibility();
    logToDebug(`Accent ${accentEnabled ? 'enabled' : 'disabled'}`);
    saveAccentSettings();
}

function onCustomAccentInput(): void {
    customAccentValue = customAccentText.value;
    saveAccentSettings();
}

function onCustomAccentKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
        // Go back to preset dropdown
        selectedAccent = '';
        accentPreset.value = '';
        accentPreset.style.display = 'block';
        customAccentText.style.display = 'none';
        saveAccentSettings();
    }
}

function onCustomAccentBlur(): void {
    // Optional: could auto-save and go back on blur, or just save
    // For now, just save the current value
    saveAccentSettings();
}

async function saveAccentSettings(): Promise<void> {
    try {
        await (window as any).electronAPI.invoke('config:set', {
            id: Date.now().toString(),
            timestamp: Date.now(),
            payload: {
                accentSettings: {
                    enabled: accentEnabled,
                    preset: selectedAccent,
                    customValue: customAccentValue
                }
            }
        });
    } catch (error) {
        logToDebug(`Error saving accent settings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

async function restoreAccentSettings(): Promise<void> {
    try {
        const response = await (window as any).electronAPI.invoke('config:get', {
            id: Date.now().toString(),
            timestamp: Date.now(),
            payload: null
        });

        if (response.success && response.payload?.accentSettings) {
            const settings = response.payload.accentSettings;
            selectedAccent = settings.preset || '';
            customAccentValue = settings.customValue || '';
            
            // Auto-toggle accent: enabled if accent is selected (not empty), disabled if "No Accent"
            accentEnabled = selectedAccent !== '' && selectedAccent !== null;

            // Update UI
            accentPreset.value = selectedAccent;
            customAccentText.value = customAccentValue;
            accentToggle.textContent = accentEnabled ? '🎭 Accent: ON' : '🎭 Accent: OFF';
            accentToggle.style.background = accentEnabled ? 'var(--focus)' : 'var(--panel)';
            accentToggle.style.color = accentEnabled ? '#000' : 'var(--text)';

            // Show/hide accent selector based on enabled state
            updateAccentSelectorVisibility();

            // Show/hide custom text field
            if (selectedAccent === 'custom') {
                customAccentText.style.display = 'block';
            } else {
                customAccentText.style.display = 'none';
            }
        }
    } catch (error) {
        logToDebug(`Error restoring accent settings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/* REMOVED - Button no longer exists
async function refreshDevicesAndVoices(): Promise<void> {
    try {
        refreshButton.disabled = true;
        refreshButton.textContent = '🔄 Refreshing...';
        
        logToDebug('Refreshing devices and voices...');
        
        await Promise.all([
            loadMicrophoneDevices(),
            loadVoices()
        ]);
        
        logToDebug('✅ Devices and voices refreshed successfully');
        
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logToDebug(`❌ Refresh failed: ${errorMessage}`);
    } finally {
        refreshButton.disabled = false;
        refreshButton.textContent = '🔄 Refresh Devices';
    }
}
*/

async function loadVoices(): Promise<void> {
    try {
        logToDebug('Loading available voices...');

        // Clear existing options
        voiceSelect.innerHTML = '<option value="">Select voice...</option>';

        // Check if user is in managed mode or has ElevenLabs API key
        const configResponse = await (window as any).electronAPI.invoke('config:get', {
            id: Date.now().toString(),
            timestamp: Date.now(),
            payload: null
        });

        const config = configResponse?.payload;
        const currentMode = config?.managedApiConfig?.mode || 'personal';
        const isManaged = currentMode === 'managed';

        // Check for ElevenLabs API key if in personal mode
        let hasElevenLabsKey = false;
        if (!isManaged) {
            try {
                const apiKeyResponse = await (window as any).electronAPI.invoke('secure-api-keys:get', {
                    id: Date.now().toString(),
                    timestamp: Date.now(),
                    payload: null
                });
                const apiKeys = apiKeyResponse?.payload || {};
                hasElevenLabsKey = !!(apiKeys.elevenlabs && apiKeys.elevenlabs.trim().length > 0);
            } catch (error) {
                console.error('Error checking API keys:', error);
            }
        }

        // Try to load voices from ElevenLabs API (only if in managed mode or has API key)
        let voices = [];
        if (isManaged || hasElevenLabsKey) {
            try {
                const response = await (window as any).electronAPI.invoke('voice:get-voices', {
                    id: Date.now().toString(),
                    timestamp: Date.now(),
                    payload: null
                });

                if (response.success && response.payload) {
                    voices = response.payload;
                    logToDebug(`Loaded ${voices.length} voices from ElevenLabs`);
                }
            } catch (error) {
                logToDebug('Failed to load voices from API, using defaults');
            }
        } else {
            logToDebug('No ElevenLabs API key found and not in managed mode - no voices available');
        }

        // If no voices from API and we have access, use fallback voices
        if (voices.length === 0 && (isManaged || hasElevenLabsKey)) {
            voices = [
                { id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam (Male, English)', isCloned: false },
                { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella (Female, English)', isCloned: false },
                { id: 'IKne3meq5aSn9XLyUdCD', name: 'Charlie (Male, English)', isCloned: false },
                { id: 'onwK4e9ZLuTAKqWW03F9', name: 'Daniel (Male, English)', isCloned: false }
            ];
        }

        // Only add voices if we have access (managed mode or API key)
        if (isManaged || hasElevenLabsKey) {
            // Add standard voices
            voices.forEach((voice: any) => {
                const option = document.createElement('option');
                option.value = voice.id;
                option.textContent = voice.name;
                voiceSelect.appendChild(option);
            });
        } else {
            // No API key and not in managed mode - show message
            voiceSelect.innerHTML = '<option value="">No API key configured</option>';
            voiceSelect.disabled = true;
            logToDebug('No ElevenLabs API key found - voices disabled');
        }

        // Load and add custom voices (only if we have access)
        if (isManaged || hasElevenLabsKey) {
            await loadCustomVoices();
        }

        // Set the selected voice from config after loading all voices
        if (voiceSelect && !voiceSelect.disabled) {
            try {
                if (configResponse.success && configResponse.payload?.voiceId) {
                    // Check if the voice exists in the dropdown
                    const voiceExists = Array.from(voiceSelect.options).some(option => option.value === configResponse.payload.voiceId);
                    if (voiceExists) {
                        voiceSelect.value = configResponse.payload.voiceId;
                        logToDebug(`Set voice selection to: ${configResponse.payload.voiceId}`);
                    } else {
                        logToDebug(`Voice ${configResponse.payload.voiceId} not found in available voices`);
                    }
                }
            } catch (error) {
                logToDebug('Error setting voice selection from config');
            }

            logToDebug(`Total voices available: ${voiceSelect.options.length - 1}`); // -1 for the "Select voice..." option
        }

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logToDebug(`Error loading voices: ${errorMessage}`);
        voiceSelect.innerHTML = '<option value="">Error loading voices</option>';
    }
}

async function loadCustomVoices(): Promise<void> {
    try {
        // Get custom voices from configuration
        const response = await (window as any).electronAPI.invoke('config:get', {
            id: Date.now().toString(),
            timestamp: Date.now(),
            payload: null
        });

        if (response.success && response.payload.customVoices) {
            const customVoices = response.payload.customVoices;

            if (customVoices.length > 0) {
                // Add separator
                const separator = document.createElement('option');
                separator.disabled = true;
                separator.textContent = '── Custom Voices ──';
                voiceSelect.appendChild(separator);

                // Add custom voices
                customVoices.forEach((voice: any) => {
                    const option = document.createElement('option');
                    option.value = voice.id;
                    option.textContent = `${voice.name} (Custom)`;
                    option.dataset.custom = 'true';
                    voiceSelect.appendChild(option);
                });

                logToDebug(`Loaded ${customVoices.length} custom voices`);
            }
        }
    } catch (error) {
        logToDebug('No custom voices found or error loading them');
    }
}

async function initializeLanguageSelector(): Promise<void> {
    try {
        // Set flag to prevent config saving during initialization
        isInitializingTranslatePage = true;
        
        console.log('🌐 ====== initializeLanguageSelector() called ======');
        
        const languages = [
            { code: 'en', name: 'English', flag: '🇺🇸' },
            { code: 'es', name: 'Spanish', flag: '🇪🇸' },
            { code: 'fr', name: 'French', flag: '🇫🇷' },
            { code: 'de', name: 'German', flag: '🇩🇪' },
            { code: 'it', name: 'Italian', flag: '🇮🇹' },
            { code: 'pt', name: 'Portuguese', flag: '🇵🇹' },
            { code: 'ru', name: 'Russian', flag: '🇷🇺' },
            { code: 'ja', name: 'Japanese', flag: '🇯🇵' },
            { code: 'ko', name: 'Korean', flag: '🇰🇷' },
            { code: 'zh', name: 'Chinese', flag: '🇨🇳' },
            { code: 'ar', name: 'Arabic', flag: '🇸🇦' },
            { code: 'hi', name: 'Hindi', flag: '🇮🇳' },
            { code: 'th', name: 'Thai', flag: '🇹🇭' },
            { code: 'vi', name: 'Vietnamese', flag: '🇻🇳' },
            { code: 'tr', name: 'Turkish', flag: '🇹🇷' },
            { code: 'pl', name: 'Polish', flag: '🇵🇱' },
            { code: 'nl', name: 'Dutch', flag: '🇳🇱' },
            { code: 'sv', name: 'Swedish', flag: '🇸🇪' },
            { code: 'da', name: 'Danish', flag: '🇩🇰' },
            { code: 'no', name: 'Norwegian', flag: '🇳🇴' }
        ];

        // Clear existing options
        languageSelect.innerHTML = '';

        // Add language options
        languages.forEach(language => {
            const option = document.createElement('option');
            option.value = language.code;
            option.textContent = `${language.flag} ${language.name}`;
            languageSelect.appendChild(option);
        });

        // Load saved target language from config FIRST
        try {
            const response = await (window as any).electronAPI.invoke('config:get', {
                id: Date.now().toString(),
                timestamp: Date.now(),
                payload: null
            });

            if (response.success && response.payload?.targetLanguage) {
                console.log(`🌐 Loading saved target language: ${response.payload.targetLanguage}`);
                languageSelect.value = response.payload.targetLanguage;
            } else {
                // Only set default if no saved config
                console.log('🌐 No saved target language, using default: es');
                languageSelect.value = 'es';
            }
        } catch (error) {
            console.log('⚠️ Failed to load target language, using default: es');
            languageSelect.value = 'es';
        }

        // Load voices after language selector is ready
        await loadVoices();
        
    } finally {
        // Clear initialization flag to allow normal config saving
        isInitializingTranslatePage = false;
        console.log('🌐 Translate page initialization complete, config saving re-enabled');
    }
}

async function loadMicrophoneDevices(): Promise<void> {
    try {
        logToDebug('Loading microphone devices...');

        // Preserve current selection
        const currentSelection = microphoneSelect.value;

        // Request microphone permission first
        await navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
            // Stop the stream immediately, we just needed permission
            stream.getTracks().forEach(track => track.stop());
        });

        // Get available devices directly from Web API
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = devices.filter(device => device.kind === 'audioinput');

        // Clear existing options
        microphoneSelect.innerHTML = '<option value="">Select microphone...</option>';

        // Add device options
        audioInputs.forEach((device, index) => {
            const option = document.createElement('option');
            option.value = device.deviceId;
            option.textContent = device.label || `Microphone ${index + 1}`;

            if (device.deviceId === 'default') {
                option.textContent += ' (Default)';
            }

            microphoneSelect.appendChild(option);
        });

        // Restore previous selection if the device is still available
        if (currentSelection && audioInputs.some(device => device.deviceId === currentSelection)) {
            microphoneSelect.value = currentSelection;
            logToDebug(`Restored microphone selection: ${currentSelection}`);
        } else if (currentSelection) {
            logToDebug(`Previous microphone selection no longer available: ${currentSelection}`);
        }

        logToDebug(`Found ${audioInputs.length} audio input devices`);
        connectionStatus.textContent = 'Ready';

    } catch (error) {
        console.error('Error loading microphone devices:', error);
        logToDebug(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        connectionStatus.textContent = 'Microphone access denied';

        // Add a message option when permission is denied
        microphoneSelect.innerHTML = '<option value="">Microphone access denied - please allow microphone access</option>';
    }
}

function updateStatusIndicator(status?: string): void {
    const indicator = document.getElementById('status-indicator') as HTMLElement;

    if (indicator) {
        // Clear all status classes
        indicator.classList.remove('active', 'error');

        // Set appropriate status
        if (status === 'error') {
            indicator.classList.add('error');
        } else if (status === 'active' || isTranslating) {
            indicator.classList.add('active');
        }
    }
}

function logToDebug(message: string): void {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = document.createElement('div');
    logEntry.textContent = `[${timestamp}] ${message}`;
    debugOutput.appendChild(logEntry);

    // Auto-scroll to bottom
    debugConsole.scrollTop = debugConsole.scrollHeight;

    // Keep only last 100 entries
    while (debugOutput.children.length > 100) {
        debugOutput.removeChild(debugOutput.firstChild!);
    }
}

// Expose logToDebug to screentrans modules
(window as any).__screenTransCtx.logToDebug = logToDebug;

// Handle device changes
if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) {
    navigator.mediaDevices.addEventListener('devicechange', () => {
        logToDebug('Audio devices changed, refreshing lists...');
        loadMicrophoneDevices();
        loadBidirectionalOutputDevices();
        // loadBidirectionalInputDevices call removed - now hardcoded
    });
}

async function updateApiKeys(apiKeys: any): Promise<void> {
    try {
        // Use new secure API key storage
        const response = await (window as any).electronAPI.invoke('secure-api-keys:set', {
            id: Date.now().toString(),
            timestamp: Date.now(),
            payload: { apiKeys }
        });

        if (response.success) {
            logToDebug('API keys updated successfully and stored securely');
            checkApiKeysConfiguration();
        } else {
            logToDebug('Error updating API keys');
        }
    } catch (error) {
        logToDebug(`Error updating API keys: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

async function checkApiKeysConfiguration(): Promise<void> {
    try {
        // Use secure API to get API key status
        const response = await (window as any).electronAPI.invoke('secure-api-keys:get', {
            id: Date.now().toString(),
            timestamp: Date.now(),
            payload: null
        });

        if (response.success) {
            const apiKeys = response.payload;
            const hasOpenAI = apiKeys.openai === '***';
            const hasElevenLabs = apiKeys.elevenlabs === '***';

            // Get other configuration settings
            const configResponse = await (window as any).electronAPI.invoke('config:get', {
                id: Date.now().toString(),
                timestamp: Date.now(),
                payload: null
            });

            if (configResponse.success) {
                const config = configResponse.payload;

                // Restore UI state from configuration
                if (config.selectedMicrophone && microphoneSelect) {
                    microphoneSelect.value = config.selectedMicrophone;
                }

                if (config.targetLanguage && languageSelect) {
                    languageSelect.value = config.targetLanguage;
                }

                if (config.voiceId && voiceSelect) {
                    voiceSelect.value = config.voiceId;
                }

                if (config.uiSettings?.showDebugConsole !== undefined) {
                    isDebugVisible = config.uiSettings.showDebugConsole;
                    if (isDebugVisible) {
                        debugConsole.classList.add('visible');
                        if (debugToggle) {
                            debugToggle.textContent = 'Hide Debug Console';
                        }
                    } else {
                        debugConsole.classList.remove('visible');
                        if (debugToggle) {
                            debugToggle.textContent = 'Show Debug Console';
                        }
                    }
                }

                // Check which API keys are actually required based on configuration
                const hasDeepInfra = apiKeys.deepinfra === '***';
                
                // Determine processing mode and model config
                // Helper function to determine processing mode (inline to avoid import issues)
                let processingMode: 'cloud' | 'local' = 'cloud';
                const modelConfig = config.modelConfig;
                
                if (modelConfig) {
                    const whisperModel = modelConfig.whisperModel;
                    const gptModel = modelConfig.gptModel;
                    
                    // If translation model is Argos, it's local mode
                    if (gptModel === 'argos') {
                        processingMode = 'local';
                    } else {
                        // Check whisper model - local Faster Whisper models
                        const localWhisperModels = ['tiny', 'small', 'medium', 'large'];
                        if (localWhisperModels.includes(whisperModel)) {
                            processingMode = 'local';
                        } else {
                            // Cloud models: whisper-1, deepinfra
                            const cloudWhisperModels = ['whisper-1', 'deepinfra'];
                            if (cloudWhisperModels.includes(whisperModel)) {
                                processingMode = 'cloud';
                            }
                        }
                    }
                } else {
                    // Fallback to old processingConfig.mode or processingMode
                    if (config?.processingConfig?.mode) {
                        processingMode = config.processingConfig.mode;
                    } else if (config?.processingMode) {
                        processingMode = config.processingMode;
                    } else if (config?.localModelConfig?.gptModel === 'argos') {
                        processingMode = 'local';
                    }
                }
                
                // Get model config - prefer unified modelConfig, fallback to cloud/local configs
                const effectiveModelConfig = modelConfig || 
                    (processingMode === 'local' ? config.localModelConfig : config.cloudModelConfig) || 
                    {};
                const whisperModel = effectiveModelConfig?.whisperModel;
                const gptModel = effectiveModelConfig?.gptModel;
                const voiceModel = effectiveModelConfig?.voiceModel || 'elevenlabs';

                // OpenAI is only required if using cloud Whisper models (whisper-1, deepinfra) for transcription
                // Local Whisper models (tiny, small, medium, large) handle transcription without API calls,
                // so no OpenAI key is needed when using local Whisper
                const isUsingCloudWhisper = whisperModel === 'whisper-1' || whisperModel === 'deepinfra';
                const needsOpenAI = isUsingCloudWhisper;
                
                // For TTS: either ElevenLabs OR DeepInfra (Chatterbox) is required
                const hasTTSProvider = hasElevenLabs || (voiceModel === 'chatterbox' && hasDeepInfra);
                const missingKeys: string[] = [];

                if (needsOpenAI && !hasOpenAI) {
                    missingKeys.push('OpenAI (for translation/transcription)');
                }
                if (!hasTTSProvider) {
                    missingKeys.push('ElevenLabs or DeepInfra (for TTS)');
                }

                if (missingKeys.length > 0) {
                    connectionStatus.textContent = 'API keys required';
                    logToDebug(`Missing required API keys: ${missingKeys.join(', ')} - please configure in settings`);
                    // Auto-open settings overlay once when API keys are missing
                    try {
                        const settingsIntegration = SettingsIntegration.getInstance();
                        if (!settingsIntegration.isSettingsOpen()) {
                            openSettingsModal();
                        }
                    } catch { }
                } else {
                    connectionStatus.textContent = 'Ready';
                    logToDebug('API keys configured');
                }
            }
        }
    } catch (error) {
        logToDebug(`Error checking API keys: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

function setupTranslationStatusUpdates(): void {
    // Set up periodic status checks while translation is active
    const statusInterval = setInterval(async () => {
        if (!isTranslating) {
            clearInterval(statusInterval);
            return;
        }

        try {
            const response = await (window as any).electronAPI.invoke('pipeline:get-status', {
                id: Date.now().toString(),
                timestamp: Date.now(),
                payload: null
            });

            if (response.success && response.payload) {
                const status = response.payload;
                processingStatus.textContent = status.currentStep || 'Active';

                if (status.error) {
                    logToDebug(`⚠️ Processing error: ${status.error}`);
                    updateStatusIndicator('error');
                } else if (status.isActive) {
                    updateStatusIndicator('active');
                }

                // Log performance metrics if available
                if (status.performance && status.performance.totalLatency > 0) {
                    logToDebug(`⚡ Processing latency: ${status.performance.totalLatency}ms`);
                }
            }
        } catch (error) {
            // Silently handle status check errors to avoid spam
        }
    }, 1000); // Check every second
}




function isValidVoiceId(voiceId: string): boolean {
    // ElevenLabs voice IDs are typically 20-character alphanumeric strings
    return /^[a-zA-Z0-9]{20}$/.test(voiceId);
}

async function addCustomVoiceToList(voiceId: string, displayName: string): Promise<void> {
    // Check if voice already exists
    const existingOption = Array.from(voiceSelect.options).find(option => option.value === voiceId);
    if (existingOption) {
        throw new Error('This voice ID is already in your list');
    }

    // Add the voice to the dropdown
    const option = document.createElement('option');
    option.value = voiceId;
    option.textContent = `${displayName} (Custom)`;
    option.dataset.custom = 'true';

    // Insert before the last option (which might be "Add Custom Voice")
    const lastOption = voiceSelect.options[voiceSelect.options.length - 1];
    voiceSelect.insertBefore(option, lastOption);

    // Save custom voices to configuration
    await saveCustomVoice(voiceId, displayName);
}

async function saveCustomVoice(voiceId: string, displayName: string): Promise<void> {
    try {
        // Get current config
        const response = await (window as any).electronAPI.invoke('config:get', {
            id: Date.now().toString(),
            timestamp: Date.now(),
            payload: null
        });

        if (response.success) {
            const config = response.payload;

            // Initialize custom voices array if it doesn't exist
            if (!config.customVoices) {
                config.customVoices = [];
            }

            // Add the new voice
            config.customVoices.push({
                id: voiceId,
                name: displayName,
                dateAdded: new Date().toISOString()
            });

            // Save updated config
            await (window as any).electronAPI.invoke('config:set', {
                id: Date.now().toString(),
                timestamp: Date.now(),
                payload: { customVoices: config.customVoices }
            });
        }
    } catch (error) {
        console.warn('Failed to save custom voice to config:', error);
        // Don't throw error as the voice is still added to the UI
    }
}

// ===== LIVE TRANSLATION FUNCTIONS =====

async function initializeRealTimeAudioStream(): Promise<void> {
    try {
        if (!microphoneSelect.value) {
            throw new Error('No microphone device available');
        }

        // Get audio stream with optimal settings for real-time processing
        audioStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                deviceId: microphoneSelect.value,
                sampleRate: 16000,
                channelCount: 1,
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            }
        });

        // Use MediaRecorder for simple continuous audio capture
        // Try different formats for better Whisper compatibility
        let mimeType = 'audio/webm;codecs=opus';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = 'audio/webm';
        }
        if (!MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = 'audio/mp4';
        }

        mediaRecorder = new MediaRecorder(audioStream, { mimeType });

        // Clear any existing onstop handler to prevent conflicts with push-to-talk
        mediaRecorder.onstop = null;

        // Process audio chunks as they become available
        mediaRecorder.ondataavailable = async (event) => {
            if (!isTranslating || event.data.size === 0) return;

            // Prevent concurrent audio processing
            if (isProcessingAudio) {
                logToDebug('🔒 Skipping audio chunk - already processing another chunk');
                return;
            }

            // Skip very small audio chunks (likely silence)
            if (event.data.size < 10000) { // Less than ~10KB is likely silence
                logToDebug('🔇 Skipping small audio chunk (likely silence)');
                return;
            }

            isProcessingAudio = true;

            try {
                // Convert blob to array buffer
                const arrayBuffer = await event.data.arrayBuffer();
                const audioData = Array.from(new Uint8Array(arrayBuffer));

                logToDebug(`🎤 Processing audio chunk: ${event.data.size} bytes`);

                // Send to main process for transcription and translation
                await (window as any).electronAPI.invoke('speech:transcribe', {
                    id: Date.now().toString(),
                    timestamp: Date.now(),
                    payload: {
                        audioData: audioData,
                        language: 'auto'
                    }
                });

            } catch (error) {
                console.error('Error processing audio chunk:', error);
                logToDebug(`❌ Audio processing error: ${error instanceof Error ? error.message : 'Unknown error'}`);
            } finally {
                // Always clear the processing flag
                isProcessingAudio = false;
            }
        };

        // Start recording in chunks (every 10 seconds for real-time processing)
        mediaRecorder.start(10000);

        logToDebug('✅ Real-time audio stream initialized with MediaRecorder');
        recordingText.textContent = 'Listening continuously...';

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logToDebug(`❌ Failed to initialize real-time audio stream: ${errorMessage}`);
        throw error;
    }
}

// Restart real-time audio capture to prevent corruption
async function restartRealTimeAudioCapture(): Promise<void> {
    try {
        if (!isTranslating) {
            logToDebug('⚠️ Not restarting audio capture - translation not active');
            return;
        }

        logToDebug('🔄 Restarting real-time audio capture...');

        // Use the existing audio stream if it's still active
        if (!audioStream || audioStream.getTracks().some(track => track.readyState === 'ended')) {
            // Get fresh audio stream
            audioStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    deviceId: microphoneSelect.value,
                    sampleRate: 16000,
                    channelCount: 1,
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });
        }

        // Create new MediaRecorder
        let mimeType = 'audio/webm;codecs=opus';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = 'audio/webm';
        }
        if (!MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = 'audio/mp4';
        }

        mediaRecorder = new MediaRecorder(audioStream, { mimeType });

        // Clear any existing onstop handler to prevent conflicts with push-to-talk
        mediaRecorder.onstop = null;

        // Set up the data handler again
        mediaRecorder.ondataavailable = async (event) => {
            if (!isTranslating || event.data.size === 0) return;

            // Prevent concurrent audio processing
            if (isProcessingAudio) {
                logToDebug('🔒 Skipping audio chunk - already processing another chunk');
                return;
            }

            // Skip very small audio chunks (likely silence)
            if (event.data.size < 10000) { // Less than ~10KB is likely silence
                logToDebug('🔇 Skipping small audio chunk (likely silence)');
                return;
            }

            isProcessingAudio = true;

            try {
                // Convert blob to array buffer
                const arrayBuffer = await event.data.arrayBuffer();
                const audioData = Array.from(new Uint8Array(arrayBuffer));

                logToDebug(`🎤 Processing audio chunk: ${event.data.size} bytes`);

                // Send to main process for transcription and translation
                await (window as any).electronAPI.invoke('speech:transcribe', {
                    id: Date.now().toString(),
                    timestamp: Date.now(),
                    payload: {
                        audioData: audioData,
                        language: 'auto'
                    }
                });

            } catch (error) {
                console.error('Error processing audio chunk:', error);
                logToDebug(`❌ Audio processing error: ${error instanceof Error ? error.message : 'Unknown error'}`);
            } finally {
                // Always clear the processing flag
                isProcessingAudio = false;
            }
        };

        // Start recording in chunks
        mediaRecorder.start(10000);

        logToDebug('✅ Real-time audio capture restarted successfully');

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logToDebug(`❌ Failed to restart real-time audio capture: ${errorMessage}`);
        console.error('Restart audio capture error:', error);
    }
}

async function initializeAudioStream(): Promise<void> {
    try {
        if (!microphoneSelect.value) {
            throw new Error('No microphone device available');
        }

        audioStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                deviceId: microphoneSelect.value,
                sampleRate: 16000,
                channelCount: 1,
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            }
        });

        // Add listeners to automatically restart passthrough if microphone stream ends
        audioStream.getTracks().forEach(track => {
            track.addEventListener('ended', async () => {
                logToDebug('⚠️ Microphone track ended, attempting to restart passthrough...');
                try {
                    // Small delay before attempting restart
                    setTimeout(async () => {
                        if (microphoneSelect.value) {
                            await initializeAutomaticPassthrough();
                        }
                    }, 1000);
                } catch (error) {
                    logToDebug(`⚠️ Failed to auto-restart passthrough: ${error instanceof Error ? error.message : 'Unknown error'}`);
                }
            });
            track.addEventListener('mute', () => {
                logToDebug('⚠️ Microphone track muted');
            });
            track.addEventListener('unmute', () => {
                logToDebug('🔊 Microphone track unmuted');
            });
        });

        logToDebug('✅ Audio stream initialized for live translation');
        recordingText.textContent = 'Audio being held quiet';

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logToDebug(`❌ Failed to initialize audio stream: ${errorMessage}`);
        throw error;
    }
}

async function cleanupAudioStream(): Promise<void> {
    try {
        if (isRecording) {
            await stopRecordingModule();
        }

        // Stop the TTS processor to cancel any ongoing synthesis/playback
        stopTTSProcessor();

        await stopPassThrough();

        // Safety reset for recording start time
        recordingStartTime = null;

        // Clean up MediaRecorder
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
            mediaRecorder = null;
        }

        if (audioStream) {
            audioStream.getTracks().forEach(track => track.stop());
            audioStream = null;
        }

        logToDebug('✅ Audio stream cleaned up');

    } catch (error) {
        logToDebug(`⚠️ Error during audio cleanup: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

function handleKeyDown(event: KeyboardEvent): void {
    const keyPressed = event.code;
    const isControlKey = keyPressed === 'ControlLeft' || keyPressed === 'ControlRight';
    const isAltKey = keyPressed === 'AltLeft' || keyPressed === 'AltRight';

    let actualKey = currentKeybind;
    if (currentKeybind.startsWith('Key') && currentKeybind.length === 4) {
        actualKey = currentKeybind.substring(3);
    }

    const requiresCtrl = currentKeybind === 'Space';
    const requiresAlt = currentKeybind !== 'Space' && !isFunctionKeyCode(actualKey);

    if (isControlKey) {
        ctrlPressed = true;
        if (isTranslating && !isRecording && pendingPTTStart && requiresCtrl && pttMainKeyHeld) {
            // Check translation config before starting recording
            checkTranslationConfig().then((isConfigured) => {
                if (isConfigured) {
                    startRecordingModule();
                    pendingPTTStart = false;
                }
                // If not configured, overlay is shown by checkTranslationConfig
            }).catch((error) => {
                console.error('Error checking translation config:', error);
            });
        }
        return;
    }

    if (isAltKey) {
        altPressed = true;
        if (isTranslating && !isRecording && pendingPTTStart && requiresAlt && pttMainKeyHeld) {
            // Check translation config before starting recording
            checkTranslationConfig().then((isConfigured) => {
                if (isConfigured) {
                    startRecordingModule();
                    pendingPTTStart = false;
                }
                // If not configured, overlay is shown by checkTranslationConfig
            }).catch((error) => {
                console.error('Error checking translation config:', error);
            });
        }
        return;
    }

    if (!isTranslating) return;

    if (translationStartTime && (Date.now() - translationStartTime) < 300) {
        console.log('Ignoring keydown event - translation mode just started');
        return;
    }

    if (event.repeat) return;

    if (keyPressed !== currentKeybind) return;

    // Don't capture PTT key when user is typing in an input field or textarea
    const activeElement = document.activeElement;
    const isTypingInInput = activeElement && (
        activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA' ||
        (activeElement as HTMLElement).isContentEditable
    );
    
    if (isTypingInInput) {
        return; // Let the key event go through to the input field
    }

    pttMainKeyHeld = true;
    event.preventDefault();

    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        console.warn('Attempted to start recording but MediaRecorder is already active');
        return;
    }

    const ctrlSatisfied = !requiresCtrl || ctrlPressed || event.ctrlKey;
    const altSatisfied = !requiresAlt || altPressed || event.altKey;

    if (ctrlSatisfied && altSatisfied) {
        // Check translation config before starting recording
        checkTranslationConfig().then((isConfigured) => {
            if (isConfigured) {
                startRecordingModule();
                pendingPTTStart = false;
            }
            // If not configured, overlay is shown by checkTranslationConfig
        }).catch((error) => {
            console.error('Error checking translation config:', error);
        });
    } else {
        pendingPTTStart = true;
    }
}

function handleKeyUp(event: KeyboardEvent): void {
    const keyPressed = event.code;
    const isControlKey = keyPressed === 'ControlLeft' || keyPressed === 'ControlRight';
    const isAltKey = keyPressed === 'AltLeft' || keyPressed === 'AltRight';

    let actualKey = currentKeybind;
    if (currentKeybind.startsWith('Key') && currentKeybind.length === 4) {
        actualKey = currentKeybind.substring(3);
    }

    const requiresCtrl = currentKeybind === 'Space';
    const requiresAlt = currentKeybind !== 'Space' && !isFunctionKeyCode(actualKey);

    if (isControlKey) {
        ctrlPressed = false;
        if (requiresCtrl && pttMainKeyHeld) {
            pendingPTTStart = true;
            if (isRecording) {
                stopRecordingModule();
            }
        }
        return;
    }

    if (isAltKey) {
        altPressed = false;
        if (requiresAlt && pttMainKeyHeld) {
            pendingPTTStart = true;
            if (isRecording) {
                stopRecordingModule();
            }
        }
        return;
    }

    if (keyPressed === currentKeybind) {
        pttMainKeyHeld = false;
        pendingPTTStart = false;
        
        // Don't prevent default when user is typing in an input field
        const activeElement = document.activeElement;
        const isTypingInInput = activeElement && (
            activeElement.tagName === 'INPUT' ||
            activeElement.tagName === 'TEXTAREA' ||
            (activeElement as HTMLElement).isContentEditable
        );
        
        if (!isTypingInInput) {
            event.preventDefault();
        }
        
        if (isRecording) {
            stopRecordingModule();
        }
    }
}


// Push-to-talk speech-to-text (separate from real-time)
async function speechToTextPushToTalk(audioBuffer: ArrayBuffer): Promise<PushToTalkTranscription> {
    try {
        console.log('🎤 Starting push-to-talk speech-to-text...');
        console.log(`📊 Input audio buffer: ${audioBuffer.byteLength} bytes`);

        // Convert directly to array for IPC transfer
        const audioDataArray = Array.from(new Uint8Array(audioBuffer));
        console.log(`📊 Audio data array: ${audioDataArray.length} bytes`);

        // Get spoken language from user preferences
        let spokenLanguage = 'auto';
        try {
            const configResponse = await (window as any).electronAPI.invoke('config:get', {
                id: Date.now().toString(),
                timestamp: Date.now()
            });
            if (configResponse?.payload?.userPreferences?.spokenLanguage) {
                spokenLanguage = configResponse.payload.userPreferences.spokenLanguage;
                console.log(`🌐 Using spoken language from preferences: ${spokenLanguage}`);
            }
        } catch (error) {
            console.warn('⚠️ Failed to load spoken language preference, using auto-detect');
        }

        // Send to main process for Whisper transcription (separate endpoint)
        console.log('📡 Sending to main process for push-to-talk transcription...');
        const response = await (window as any).electronAPI.invoke('speech:transcribe-push-to-talk', {
            id: Date.now().toString(),
            timestamp: Date.now(),
            payload: {
                audioData: audioDataArray,
                language: spokenLanguage
            }
        });

        console.log('📡 Received response from main process:', response.success);

        if (response.success) {
            const payload = response.payload || {};
            const text = payload.text || '';
            
            // Handle empty transcription gracefully (silence or noise)
            if (!text || !text.trim()) {
                if (response.payload.skipped) {
                    console.log('⚠️ Transcription skipped (empty result - likely silence or noise)');
                } else {
                    console.log('⚠️ Empty transcription result (likely silence or noise)');
                }
                // Return empty transcription object instead of throwing error
                return {
                    text: '',
                    skipped: true,
                    reason: 'Empty transcription (silence or noise)',
                    expectedLanguage: spokenLanguage
                };
            }
            
            console.log(`✅ Push-to-talk transcription successful: "${text}" (detected=${payload.language || 'unknown'})`);
            return {
                text,
                language: payload.language,
                duration: payload.duration,
                skipped: payload.skipped,
                reason: payload.reason,
                expectedLanguage: spokenLanguage
            };
        } else {
            console.error('❌ Push-to-talk transcription failed:', response.error);
            throw new Error(response.error || 'Speech-to-text failed');
        }
    } catch (error) {
        console.error('❌ Push-to-talk speech-to-text error:', error);
        console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
        throw new Error(`Speech recognition failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

async function speechToText(audioBuffer: ArrayBuffer): Promise<string> {
    try {
        console.log('🎤 Starting simplified speech-to-text...');
        console.log(`📊 Input audio buffer: ${audioBuffer.byteLength} bytes`);

        // For now, let's skip the complex audio conversion and just use the original audio
        // Convert directly to array for IPC transfer
        const audioDataArray = Array.from(new Uint8Array(audioBuffer));
        console.log(`📊 Audio data array: ${audioDataArray.length} bytes`);

        // Send to main process for Whisper transcription
        console.log('📡 Sending to main process for transcription...');
        const response = await (window as any).electronAPI.invoke('speech:transcribe', {
            id: Date.now().toString(),
            timestamp: Date.now(),
            payload: {
                audioData: audioDataArray,
                language: 'auto' // Auto-detect language
            }
        });

        console.log('📡 Received response from main process:', response.success);

        if (response.success) {
            const text = response.payload.text || '';
            console.log(`✅ Transcription successful: "${text}"`);
            return text;
        } else {
            console.error('❌ Transcription failed:', response.error);
            throw new Error(response.error || 'Speech-to-text failed');
        }
    } catch (error) {
        console.error('❌ Speech-to-text error:', error);
        console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
        throw new Error(`Speech recognition failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

async function convertToWav(audioBlob: Blob): Promise<Blob> {
    try {
        console.log('🔄 Starting audio conversion...');
        console.log(`📊 Input blob: ${audioBlob.size} bytes, type: ${audioBlob.type}`);

        // Create audio context for conversion
        const audioContext = new AudioContext({ sampleRate: 16000 });
        console.log('✅ Audio context created');

        // Decode the audio data
        const arrayBuffer = await audioBlob.arrayBuffer();
        console.log(`📊 Array buffer: ${arrayBuffer.byteLength} bytes`);

        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        console.log(`📊 Audio buffer: ${audioBuffer.length} samples, ${audioBuffer.sampleRate}Hz, ${audioBuffer.numberOfChannels} channels`);

        // Convert to 16kHz mono WAV (optimal for Whisper)
        const length = audioBuffer.length;
        const sampleRate = 16000;
        const buffer = new ArrayBuffer(44 + length * 2);
        const view = new DataView(buffer);

        // WAV header
        const writeString = (offset: number, string: string) => {
            for (let i = 0; i < string.length; i++) {
                view.setUint8(offset + i, string.charCodeAt(i));
            }
        };

        writeString(0, 'RIFF');
        view.setUint32(4, 36 + length * 2, true);
        writeString(8, 'WAVE');
        writeString(12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, 1, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * 2, true);
        view.setUint16(32, 2, true);
        view.setUint16(34, 16, true);
        writeString(36, 'data');
        view.setUint32(40, length * 2, true);

        // Convert audio data to 16-bit PCM
        const channelData = audioBuffer.getChannelData(0);
        let offset = 44;
        for (let i = 0; i < length; i++) {
            const sample = Math.max(-1, Math.min(1, channelData[i]));
            view.setInt16(offset, sample * 0x7FFF, true);
            offset += 2;
        }

        await audioContext.close();
        console.log(`✅ Audio conversion complete: ${buffer.byteLength} bytes`);
        return new Blob([buffer], { type: 'audio/wav' });

    } catch (error) {
        console.error('❌ Audio conversion error:', error);
        console.error('Error details:', error instanceof Error ? error.stack : 'No stack trace');
        // Fallback: return original blob
        console.log('🔄 Using original blob as fallback');
        return audioBlob;
    }
}

async function translateText(text: string): Promise<string> {
    try {
        // Get source language from whispra translate panel (left side) or fallback to 'auto'
        const leftSourceLangSelect = document.getElementById('whispra-left-source-lang') as HTMLSelectElement | null;
        const sourceLanguage = leftSourceLangSelect?.value || 'auto';
        
        const response = await (window as any).electronAPI.invoke('translation:translate', {
            id: Date.now().toString(),
            timestamp: Date.now(),
            payload: {
                text,
                targetLanguage: languageSelect.value || 'es',
                sourceLanguage: sourceLanguage
            }
        });

        if (response.success && response.payload?.translatedText) {
            return response.payload.translatedText;
        }
        throw new Error(response.error || 'Translation failed');
    } catch (error) {
        throw new Error(`Translation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

// Accent tag middleware - runs before any TTS call
function applyAccentTag(text: string): string {
    if (!accentEnabled || !text || text.trim() === '') {
        return text;
    }

    // Get the accent label
    let accentLabel = '';
    if (selectedAccent === 'custom') {
        // Sanitize custom accent to safe whitelist (letters, spaces, hyphens)
        const sanitized = customAccentValue.replace(/[^a-zA-Z\s-]/g, '').trim();
        if (sanitized) {
            accentLabel = sanitized.toLowerCase();
        }
    } else if (selectedAccent) {
        accentLabel = selectedAccent;
    }

    // If no valid accent, return text unchanged
    if (!accentLabel) {
        return text;
    }

    // Build the accent tag
    const accentTag = `[${accentLabel} accent] `;

    // If text already starts with a [...] bracketed tag, replace it
    const existingTagMatch = text.match(/^\[.*?\]\s*/);
    if (existingTagMatch) {
        return accentTag + text.substring(existingTagMatch[0].length);
    }

    // Otherwise, prepend the accent tag
    return accentTag + text;
}

async function synthesizeAndPlay(text: string): Promise<void> {
    try {
        // Apply accent tag middleware
        const processedText = applyAccentTag(text);

        const response = await (window as any).electronAPI.invoke('tts:synthesize', {
            id: Date.now().toString(),
            timestamp: Date.now(),
            payload: {
                text: processedText,
                voiceId: voiceSelect.value || 'pNInz6obpgDQGcFmaJgB',
                // Force ElevenLabs v3 model when accent is enabled
                ...(accentEnabled && { modelId: 'eleven_v3' })
            }
        });

        if (response.success && response.payload?.audioBuffer) {
            await playAudioInRenderer(response.payload.audioBuffer);
            logToDebug('🔊 Translated audio played');
            return;
        }
        throw new Error(response.error || 'TTS synthesis failed');
    } catch (error) {
        logToDebug(`⚠️ Audio synthesis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

function updateRecordingUI(isActive: boolean): void {
    const recordingDot = document.querySelector('.recording-dot') as HTMLElement;

    if (isActive) {
        recordingDot.classList.add('active');
        recordingText.textContent = 'Recording...';
    } else {
        recordingDot.classList.remove('active');
        recordingText.textContent = 'Audio being held quiet';
    }
}

// ===== Output preference toggle =====

async function restoreOutputPreference(): Promise<void> {
    try {
        const response = await (window as any).electronAPI.invoke('config:get', {
            id: Date.now().toString(),
            timestamp: Date.now(),
            payload: null
        });
        if (response.success && response.payload?.uiSettings?.outputToVirtualDevice !== undefined) {
            outputToVirtualDevice = !!response.payload.uiSettings.outputToVirtualDevice;
        }
    } catch { }
    updateOutputToggleButton();
}

function updateOutputToggleButton(): void {
    if (!outputToggleButton) return;
    outputToggleButton.textContent = outputToVirtualDevice
        ? '🔀 Output: Virtual Device'
        : '🔀 Output: App/Headphones';
}

// Save virtual device preference on app close
async function saveVirtualDevicePreference(): Promise<void> {
    try {
        await (window as any).electronAPI.invoke('config:set', {
            id: Date.now().toString(),
            timestamp: Date.now(),
            payload: { uiSettings: { outputToVirtualDevice: true } }
        });
        logToDebug('💾 Saved virtual device preference for next startup');

        // Stop health check when app is closing
        stopPassthroughHealthCheck();
    } catch (error) {
        console.warn('Failed to save virtual device preference:', error);
    }
}

async function toggleOutputTarget(): Promise<void> {
    // Prevent multiple simultaneous toggles
    if (isTogglingOutput) {
        console.log('⏳ Output toggle already in progress, ignoring click');
        return;
    }
    
    isTogglingOutput = true;
    try {
        outputToVirtualDevice = !outputToVirtualDevice;
        updateOutputToggleButton();
        // Persist preference
        try {
            await (window as any).electronAPI.invoke('config:set', {
                id: Date.now().toString(),
                timestamp: Date.now(),
                payload: { uiSettings: { outputToVirtualDevice } }
            });
        } catch (error) {
            console.error('Error saving output preference:', error);
            // Revert on error
            outputToVirtualDevice = !outputToVirtualDevice;
            updateOutputToggleButton();
        }
        // Switch passthrough routing if active (no need to stop first)
        if (audioStream && !isRecording) {
            await restartPassthroughClean();
        }
    } finally {
        isTogglingOutput = false;
    }
}



async function initializeSoundboardTab(): Promise<void> {
    try {
        console.log('🎵 Initializing soundboard tab...');

        // Initialize the soundboard manager if it doesn't exist
        if (!soundboardManager) {
            console.log('🎵 Creating soundboard manager');
            soundboardManager = new SoundboardManager();
        } else {
            console.log('🎵 Soundboard manager already exists');
        }

        logToDebug('✅ Soundboard tab initialized');
    } catch (error) {
        logToDebug(`❌ Error initializing Soundboard tab: ${error}`);
    }
}

// LoadDisplays functions moved to src/renderer/screentrans/LoadDisplays.ts

async function initializeGlobalHotkeys(): Promise<void> {
    try {
        // Send bidirectional hotkey configuration to main process
        // Convert bidirectionalKeybind (KeyB format) to just the letter (B) for global listener
        const bidirectionalKeyForGlobal = bidirectionalKeybind.startsWith('Key') ? bidirectionalKeybind.substring(3) : bidirectionalKeybind;

        // Send screen translation hotkey configuration to main process
        // Convert screenTranslationKeybind (KeyT format) to just the letter (T) for global listener
        const screenTranslationKeyForGlobal = screenTranslationKeybind.startsWith('Key') ? screenTranslationKeybind.substring(3) : screenTranslationKeybind;

        await (window as any).electronAPI.invoke('hotkeys:update', {
            bidirectionalHotkey: {
                ctrl: false,
                alt: true,
                shift: false,
                key: bidirectionalKeyForGlobal
            },
            screenTranslationHotkey: {
                ctrl: false,
                alt: true,
                shift: false,
                key: screenTranslationKeyForGlobal
            }
        });

        console.log('Global hotkeys initialized:', {
            bidirectionalHotkey: `Alt+${bidirectionalKeyForGlobal}`,
            screenTranslationHotkey: `Alt+${screenTranslationKeyForGlobal}`
        });
    } catch (error) {
        console.warn('Failed to initialize global hotkeys:', error);
    }
}

// Initialize soundboard manager when needed
let soundboardManager: SoundboardManager | null = null;

// Initialize soundboard when soundboard button is clicked
if (soundBoardButton) {
    soundBoardButton.addEventListener('click', () => {
        if (!soundboardManager) {
            soundboardManager = initializeSoundboardManager();
        }
    });
}

// Setup soundboard overlay listeners
setupSoundboardOverlayListeners(soundboardManager);

// Inject soundboard CSS
injectSoundboardCSS();

// GPU Paddle Button Functions
async function initializeGPUPaddleButton(): Promise<void> {
    console.log('🎮 Initializing GPU Paddle button...');

    try {
        const gpuPaddleButton = document.getElementById('gpu-paddle-button') as HTMLButtonElement;

        if (!gpuPaddleButton) {
            console.warn('🎮 GPU Paddle button not found in DOM');
            return;
        }

        // Check GPU Paddle status (use quick check for header button)
        const quickStatus = await (window as any).electronAPI.gpuPaddle.quickStatus();
        const hasGPUPaddle = quickStatus?.success && quickStatus.hasGPUPaddle;

        // For the header button, we need to check CUDA availability too
        // If we don't have GPU Paddle, do a quick CUDA check
        let showButton = false;
        if (!hasGPUPaddle) {
            try {
                const cudaInfo = await (window as any).electronAPI.gpuPaddle.detectCUDA();
                showButton = cudaInfo?.success && cudaInfo.hasCUDA;
            } catch (error) {
                console.log('🎮 CUDA detection failed for header button:', error);
                showButton = false;
            }
        }

        console.log('🎮 GPU Paddle header button status:', { hasGPUPaddle, showButton, fromCache: quickStatus?.fromCache });

        // Show button only if GPU is available but GPU Paddle is not installed
        if (showButton) {
            console.log('🎮 GPU available without GPU Paddle - showing button');
            gpuPaddleButton.style.display = 'inline-block';

            // Add click handler
            gpuPaddleButton.addEventListener('click', async () => {
                console.log('🎮 GPU Paddle button clicked');
                try {
                    await (window as any).electronAPI.gpuPaddle.showOverlay();
                } catch (error) {
                    console.error('🎮 Error showing GPU Paddle overlay:', error);
                }
            });
        } else {
            console.log('🎮 GPU not available or GPU Paddle already installed - hiding button');
            gpuPaddleButton.style.display = 'none';
        }
    } catch (error) {
        console.error('🎮 Error initializing GPU Paddle button:', error);
    }
}

// Expose for debugging
(window as any).checkGPUPaddleStatus = async () => {
    try {
        const status = await (window as any).electronAPI.gpuPaddle.checkStatus();
        const quickStatus = await (window as any).electronAPI.gpuPaddle.quickStatus();
        console.log('🎮 GPU Paddle Full Status:', status);
        console.log('🎮 GPU Paddle Quick Status:', quickStatus);
        return { fullStatus: status, quickStatus };
    } catch (error) {
        console.error('🎮 Error checking GPU Paddle status:', error);
        return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
};

(window as any).showGPUPaddleOverlay = async () => {
    try {
        await (window as any).electronAPI.gpuPaddle.showOverlay();
    } catch (error) {
        console.error('🎮 Error showing GPU Paddle overlay:', error);
    }
};

// Initialize quick translate panel when quick translate button is clicked
if (quickTranslateButton) {
    quickTranslateButton.addEventListener('click', initializeQuickTranslatePanel);
}

// Also initialize when the panel becomes visible
const originalSwitchTab = switchTab;
function switchTabWithQuickTranslate(tab: 'translate' | 'bidirectional' | 'screen-translation' | 'sound-board' | 'voice-filter' | 'quick-translate'): void {
    originalSwitchTab(tab);

    if (tab === 'quick-translate') {
        initializeQuickTranslatePanel();
    }
}

// Replace the switchTab function
(window as any).switchTab = switchTabWithQuickTranslate;

// Background Mode Overlay Logic
const backgroundModeOverlay = document.getElementById('background-mode-overlay') as HTMLDivElement;
const backgroundModeAllowBtn = document.getElementById('background-mode-allow') as HTMLButtonElement;
const backgroundModeCancelBtn = document.getElementById('background-mode-cancel') as HTMLButtonElement;

let backgroundOverlayShown = false;

function showBackgroundModeOverlay(): void {
    if (backgroundModeOverlay && !backgroundOverlayShown) {
        backgroundModeOverlay.style.display = 'flex';
        backgroundOverlayShown = true;

        // Initialize Lucide icons for the overlay
        if (typeof (window as any).lucide !== 'undefined' && (window as any).lucide.createIcons) {
            (window as any).lucide.createIcons();
        }
    }
}

function hideBackgroundModeOverlay(): void {
    if (backgroundModeOverlay) {
        backgroundModeOverlay.style.display = 'none';
    }
}

// Listen for window close attempt from main process
(window as any).electronAPI.on('window-close-attempt', () => {
    showBackgroundModeOverlay();
});

// Handle "Run in Background" button
if (backgroundModeAllowBtn) {
    backgroundModeAllowBtn.addEventListener('click', async () => {
        hideBackgroundModeOverlay();

        // Save the user's preference: run in background = true
        try {
            await (window as any).electronAPI.invoke('config:set', {
                id: Date.now().toString(),
                timestamp: Date.now(),
                payload: {
                    uiSettings: {
                        runInBackground: true
                    }
                }
            });
            console.log('[BackgroundDialog] Saved runInBackground: true');
        } catch (error) {
            console.error('[BackgroundDialog] Failed to save background preference:', error);
        }

        // Let the app minimize to tray (existing functionality will handle this)
        await (window as any).electronAPI.invoke('app:minimize-to-tray');
    });
}

// Handle "Exit App" button
if (backgroundModeCancelBtn) {
    backgroundModeCancelBtn.addEventListener('click', async () => {
        hideBackgroundModeOverlay();

        // Save the user's preference: run in background = false
        try {
            await (window as any).electronAPI.invoke('config:set', {
                id: Date.now().toString(),
                timestamp: Date.now(),
                payload: {
                    uiSettings: {
                        runInBackground: false
                    }
                }
            });
            console.log('[BackgroundDialog] Saved runInBackground: false');
        } catch (error) {
            console.error('[BackgroundDialog] Failed to save background preference:', error);
        }

        // Actually quit the app
        await (window as any).electronAPI.invoke('app:quit');
    });
}

// Screen Translate initialization functions
function initializeWhispraScreenDropdowns(): void {
    // Reuse the existing dropdown initialization from whispra-translate
    // The dropdowns are already set up by initializeWhispraTranslateDropdowns
    if (!(window as any).whispraDropdownsInitialized) {
        initializeWhispraTranslateDropdowns();
    }
}

function initializeWhispraScreenLanguages(): void {
    const sourceSelect = document.getElementById('whispra-screen-source-lang') as HTMLSelectElement | null;
    const targetSelect = document.getElementById('whispra-screen-target-lang') as HTMLSelectElement | null;

    if (sourceSelect && targetSelect) {
        // Load saved settings from config (use sourceLanguage and targetLanguage to match screen translation)
        (async () => {
            try {
                const response = await (window as any).electronAPI.invoke('config:get', {
                    id: Date.now().toString(),
                    timestamp: Date.now(),
                    payload: null
                });

                if (response.success && response.payload.screenTranslation) {
                    const { sourceLanguage, targetLanguage } = response.payload.screenTranslation;
                    if (sourceLanguage) sourceSelect.value = sourceLanguage;
                    if (targetLanguage) targetSelect.value = targetLanguage;
                }
            } catch (error) {
                console.error('Failed to load Screen Translate language settings:', error);
            }
        })();

        // Set up sync with screen translation page
        setupWhispraScreenLanguageSync(sourceSelect, targetSelect);
    }
}

function setupWhispraScreenLanguageSync(whispraSource: HTMLSelectElement, whispraTarget: HTMLSelectElement): void {
    if (hasInitializedWhispraScreenLanguageSync) {
        return;
    }

    if (!screenTranslationSourceLang || !screenTranslationTargetLang) {
        return;
    }

    const syncFromScreenTranslationToWhispra = (): void => {
        if (isSyncingWhispraScreenLanguages) return;
        isSyncingWhispraScreenLanguages = true;
        whispraSource.value = screenTranslationSourceLang.value;
        whispraTarget.value = screenTranslationTargetLang.value;
        isSyncingWhispraScreenLanguages = false;
    };

    const syncFromWhispraToScreenTranslation = async (): Promise<void> => {
        if (isSyncingWhispraScreenLanguages) return;
        isSyncingWhispraScreenLanguages = true;
        screenTranslationSourceLang.value = whispraSource.value;
        screenTranslationTargetLang.value = whispraTarget.value;
        try {
            await updateScreenTranslationConfig();
        } catch (error) {
            console.error('Failed to sync Screen Translate languages with screen translation:', error);
        } finally {
            isSyncingWhispraScreenLanguages = false;
        }
    };

    whispraSource.addEventListener('change', () => {
        syncFromWhispraToScreenTranslation();
    });
    whispraTarget.addEventListener('change', () => {
        syncFromWhispraToScreenTranslation();
    });
    screenTranslationSourceLang.addEventListener('change', syncFromScreenTranslationToWhispra);
    screenTranslationTargetLang.addEventListener('change', syncFromScreenTranslationToWhispra);

    syncFromScreenTranslationToWhispra();

    hasInitializedWhispraScreenLanguageSync = true;
}

async function initializeWhispraScreenSettings(): Promise<void> {
    // Initialize GPU toggle switch using the shared logic from PaddleGPU.ts
    await setupWhispraScreenGPUModeToggle();

    // Initialize Paddle warmup toggle switch using the shared logic from PaddleWarmup.ts
    await setupWhispraScreenPaddleWarmupToggle();
}

function initializeWhispraScreenKeybind(): void {
    const keybindDisplay = document.getElementById('whispra-screen-keybind') as HTMLElement | null;
    const keybindContainer = document.getElementById('whispra-screen-keybind-container') as HTMLElement | null;

    if (keybindDisplay && keybindContainer) {
        // Load current keybind from config
        (async () => {
            try {
                const response = await (window as any).electronAPI.invoke('config:get', {
                    id: Date.now().toString(),
                    timestamp: Date.now(),
                    payload: null
                });

                if (response.success && response.payload.keybinds?.screenTranslation) {
                    const keybind = response.payload.keybinds.screenTranslation;
                    keybindDisplay.textContent = keybind.replace('Key', '').replace('Digit', '') || 'Alt + T';
                }
            } catch (error) {
                console.error('Failed to load screen translation keybind:', error);
            }
        })();

        // Make keybind clickable to open modal for changing keybind
        keybindContainer.addEventListener('click', async () => {
            const { showScreenTranslationKeybindModal } = await import('./renderer/screentrans/PaddleTriggerConfig.js');
            showScreenTranslationKeybindModal();
        });
    }
}

function initializeWhispraScreenBoxKeybind(): void {
    const keybindDisplay = document.getElementById('whispra-screen-box-keybind') as HTMLElement | null;
    const keybindContainer = document.getElementById('whispra-screen-box-keybind-container') as HTMLElement | null;

    if (keybindDisplay && keybindContainer) {
        // Load current keybind from config
        (async () => {
            try {
                const response = await (window as any).electronAPI.invoke('config:get', {
                    id: Date.now().toString(),
                    timestamp: Date.now(),
                    payload: null
                });

                if (response.success && response.payload.uiSettings?.screenTranslationBoxHotkey) {
                    const keybind = response.payload.uiSettings.screenTranslationBoxHotkey;
                    // Format keybind display
                    const parts = [];
                    if (keybind.ctrl) parts.push('Ctrl');
                    if (keybind.alt) parts.push('Alt');
                    if (keybind.shift) parts.push('Shift');
                    parts.push(keybind.key);
                    keybindDisplay.textContent = parts.join(' + ');
                }
            } catch (error) {
                console.error('Failed to load box select keybind:', error);
            }
        })();

        // Make keybind clickable to open modal for changing keybind
        keybindContainer.addEventListener('click', async () => {
            const { showScreenTranslationBoxSelectKeybindModal } = await import('./renderer/screentrans/PaddleTriggerConfig.js');
            showScreenTranslationBoxSelectKeybindModal();
        });
    }
}

function initializeWhispraScreenWatchBoxKeybind(): void {
    const keybindDisplay = document.getElementById('whispra-screen-watch-box-keybind') as HTMLElement | null;
    const keybindContainer = document.getElementById('whispra-screen-watch-box-keybind-container') as HTMLElement | null;

    if (keybindDisplay && keybindContainer) {
        // Load current keybind from config
        (async () => {
            try {
                const response = await (window as any).electronAPI.invoke('config:get', {
                    id: Date.now().toString(),
                    timestamp: Date.now(),
                    payload: null
                });

                if (response.success && response.payload.uiSettings?.screenTranslationWatchBoxHotkey) {
                    const keybind = response.payload.uiSettings.screenTranslationWatchBoxHotkey;
                    // Format keybind display
                    const parts = [];
                    if (keybind.ctrl) parts.push('Ctrl');
                    if (keybind.alt) parts.push('Alt');
                    if (keybind.shift) parts.push('Shift');
                    parts.push(keybind.key);
                    keybindDisplay.textContent = parts.join(' + ');
                }
            } catch (error) {
                console.error('Failed to load watch box keybind:', error);
            }
        })();

        // Make keybind clickable to open modal for changing keybind
        keybindContainer.addEventListener('click', async () => {
            const { showScreenTranslationWatchBoxKeybindModal } = await import('./renderer/screentrans/PaddleTriggerConfig.js');
            showScreenTranslationWatchBoxKeybindModal();
        });
    }
}