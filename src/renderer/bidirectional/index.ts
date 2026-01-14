/**
 * Bidirectional Mode - Main Entry Point
 * Re-exports all bidirectional functionality
 */

// Re-export from BidirectionalState
export * from './BidirectionalState.js';

// Re-export from BidirectionalCaptions
export {
    toggleBidirectionalCaptions,
    updateBidirectionalCaptionsToggle,
    showCaptionsSettingsModal,
    updateCaptions,
    clearCaptions,
    initializeCaptionsModule
} from './BidirectionalCaptions.js';

// Re-export from BidirectionalAudioHelpers
export {
    resampleFloat32,
    float32ToWavBlob,
    finalizePcmCaptureSegment,
    startPcmCapture,
    stopPcmCapture,
    removeDuplicateWords
} from './BidirectionalAudioHelpers.js';

// Re-export from BidirectionalProcessor
export {
    processBidirectionalAudioChunk,
    updateBidirectionalUI,
    initializeProcessorModule,
    updateAccentState
} from './BidirectionalProcessor.js';

// Re-export from BidirectionalUI
export {
    initializeBidirectionalUI,
    updateUILanguage,
    getBidirectionalDOMElements,
    getBidirectionalSourceLanguage,
    getBidirectionalTargetLanguage,
    setBidirectionalStatus,
    showBidirectionalKeybindModal,
    onBidirectionalProcessChange,
    onBidirectionalOutputChange,
    onBidirectionalSourceLanguageChange,
    onBidirectionalTargetLanguageChange,
    onIncomingVoiceChange,
    setupBidirectionalEventListeners
} from './BidirectionalUI.js';

// Re-export from BidirectionalControls
export {
    injectSharedFunctions,
    initializeBidirectionalTab,
    loadBidirectionalOutputDevices,
    loadBidirectionalProcesses,
    loadIncomingVoices,
    toggleBidirectional,
    startBidirectional,
    stopBidirectional,
    finalizeBidirectionalSection
} from './BidirectionalControls.js';

/**
 * Convenience function to initialize all bidirectional modules
 */
export async function initializeBidirectionalMode(
    currentLanguage: string = 'en',
    playAudioFn: (audioData: number[], sinkId?: string) => Promise<void>,
    requestDisplayFn: () => Promise<{ stream: MediaStream | null; processName: string | null }>,
    fallbackVBFn: (currentDeviceId: string | null) => Promise<string | null>,
    logDebugFn: (message: string) => void,
    applyAccentFn: (text: string) => string,
    getAccentFn: () => boolean
): Promise<void> {
    console.log('🎯 Initializing Bidirectional Mode...');

    // Import and inject shared functions
    const { injectSharedFunctions } = await import('./BidirectionalControls.js');
    injectSharedFunctions(playAudioFn, requestDisplayFn, fallbackVBFn, logDebugFn, applyAccentFn, getAccentFn);

    // Initialize UI
    const { initializeBidirectionalUI } = await import('./BidirectionalUI.js');
    initializeBidirectionalUI(currentLanguage);

    // Initialize bidirectional tab (loads config, devices, etc.)
    const { initializeBidirectionalTab } = await import('./BidirectionalControls.js');
    await initializeBidirectionalTab();

    console.log('✅ Bidirectional Mode initialized');
}
