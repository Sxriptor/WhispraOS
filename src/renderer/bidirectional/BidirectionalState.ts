/**
 * Bidirectional State Management
 * Centralized state for bidirectional translation mode
 */

import { TranslationContextManager } from '../../services/TranslationContextManager.js';

// ============================================================================
// CORE BIDIRECTIONAL STATE
// ============================================================================

/** Main active flag for bidirectional mode */
export let isBidirectionalActive = false;

/** Hotkey binding (e.g., 'KeyB' for Alt+B) */
export let bidirectionalKeybind = 'KeyB';

/** Selected output audio device ID */
export let bidirectionalOutputDeviceId: string | null = null;

/** Selected input audio device ID (deprecated, now hardcoded to display audio) */
export let bidirectionalInputDeviceId: string | null = null;

/** Flag indicating if display/system audio is being used */
export let bidirectionalUseDisplayAudio: boolean = false;

/** Source language for translation (e.g., 'auto', 'en', 'es') */
export let bidirectionalSourceLanguage: string = 'auto';

/** Target language for translation (e.g., 'en', 'es', 'fr') */
export let bidirectionalTargetLanguage: string = 'en';

/** ElevenLabs voice ID for TTS output */
export let incomingVoiceId: string | null = 'pNInz6obpgDQGcFmaJgB'; // Default to Adam voice

/** Selected process name for WASAPI audio capture */
export let selectedProcessName: string | null = null;

/** macOS: Real output device ID (for TTS playback when system is routed to BlackHole) */
export let macosRealOutputDeviceId: string | null = null;

/** Timer for auto-showing mini overlay after 30 seconds */
export let bidirectionalMiniOverlayTimer: NodeJS.Timeout | null = null;

/** Flag tracking if bidirectional mode auto-opened the overlay */
export let bidirectionalAutoOpenedOverlay = false;

/** Flag to prevent config saves during initialization */
export let isInitializingBidirectional = false;

// ============================================================================
// CAPTIONS SETTINGS
// ============================================================================

/** Captions enabled/disabled flag */
export let bidirectionalCaptionsEnabled = false;

/** Captions appearance settings */
export let captionsSettings = {
    enabled: false,
    textColor: 'white' as 'white' | 'black',
    background: 'none' as 'none' | 'white' | 'black',
    fontSize: 'medium' as 'small' | 'medium' | 'large' | 'xlarge',
    captionsOnly: true // Always true - TTS for bidirectional is coming soon (audio looping issue)
};

// ============================================================================
// AUDIO STREAM MANAGEMENT
// ============================================================================

/** Selected input device stream (optional, for microphone input) */
export let bidiAudioStream: MediaStream | null = null;

/** System/desktop audio stream (for screen capture) */
export let bidiDesktopStream: MediaStream | null = null;

/** Mixed stream combining input and desktop audio */
export let bidiMixedStream: MediaStream | null = null;

/** Audio context for mixing streams */
export let bidiMixerCtx: AudioContext | null = null;

/** Destination node for mixed audio */
export let bidiMixerDestination: MediaStreamAudioDestinationNode | null = null;

// ============================================================================
// VOICE ACTIVITY DETECTION (VAD)
// ============================================================================

/** Adaptive threshold for VAD */
export let bidiVadThreshold = 0.0035;

/** VAD calibration in progress flag */
export let bidiCalibrating = false;

/** Number of samples collected during calibration */
export let bidiCalibSamples = 0;

/** Accumulated volume during calibration */
export let bidiCalibAccum = 0;

/** Baseline audio level after calibration */
export let bidiBaseline = 0;

/** Count of consecutive active (voice detected) frames */
export let bidiConsecutiveActiveFrames = 0;

/** Currently in speech (voice detected) */
export let bidiInSpeech = false;

/** Timestamp of last voice detection */
export let bidiLastVoiceTs = 0;

/** Flag indicating probe/detection is needed */
export let bidiNeedsProbe = false;

/** Timestamp of last probe attempt */
export let bidiLastProbeAttemptTs = 0;

/** Flag to temporarily block new sections */
export let bidiSectionBlocked = false;

// ============================================================================
// AUDIO ANALYSIS
// ============================================================================

/** Audio context for analysis */
export let bidiAnalyzerCtx: AudioContext | null = null;

/** Analyser node for VAD */
export let bidiAnalyzerNode: AnalyserNode | null = null;

/** Source node for analysis */
export let bidiSourceNode: MediaStreamAudioSourceNode | null = null;

/** Audio enhancement nodes (gain + noise removal + limiting) */
export let bidiEnhancementNodes: {
    highpassFilter: BiquadFilterNode;
    lowpassFilter: BiquadFilterNode;
    compressor: DynamicsCompressorNode;
    gainNode: GainNode;
    makeupGainNode: GainNode;
    limiter: DynamicsCompressorNode;
    outputNode: AudioNode;
} | null = null;

/** VAD polling interval */
export let bidiVadInterval: number | null = null;

// ============================================================================
// AUDIO RECORDING & PROCESSING
// ============================================================================

/** MediaRecorder instance (deprecated, now uses PCM) */
export let bidiRecorder: MediaRecorder | null = null;

/** Processing lock to prevent concurrent processing */
export let bidiProcessing = false;

/** Accumulated audio blobs for current section */
export let bidiCurrentBlobs: Blob[] = [];

/** Current section is active (accumulating audio) */
export let bidiSectionActive = false;

/** Flag indicating WASAPI WAV mode is in use */
export let bidiUseWasapiWav = false;

/** Audio MIME type */
export let bidiMimeType = 'audio/wav';

/** Timestamp when section started */
export let bidiStartTs = 0;

/** Index of first target language detection */
export let bidiFirstTargetIndex = -1;

/** Pending finalize flag */
export let pendingFinalize = false;

// ============================================================================
// TTS PROCESSING
// ============================================================================

/** BidirectionalTTSProcessor instance for parallel queue-based processing */
export let bidirectionalTTSProcessor: any = null;

/** Queue of audio chunks waiting to be processed */
export let bidiChunkQueue: Array<{ audioData: Buffer; timestamp: number }> = [];

/** Flag to prevent concurrent chunk processing */
export let isProcessingBidiChunk = false;

/** Last transcription text for deduplication */
export let bidiLastTranscription = '';

/** Sequence number of the last transcription (for ordering parallel chunks) */
export let bidiLastTranscriptionSeq = 0;

/** Next sequence number to assign to incoming chunks */
export let bidiNextChunkSeq = 0;

/** Context manager for coherent translations */
export let bidirectionalContextManager: TranslationContextManager | null = null;

/** Timestamp of last audio chunk (for context clearing) */
export let bidiLastAudioChunkTime = 0;

/** Clear context after this many MS of silence */
export const CONTEXT_CLEAR_PAUSE_MS = 1500;

// ============================================================================
// LEGACY TTS PLAYBACK (kept for backward compatibility)
// ============================================================================

/** Legacy: TTS playback queue to serialize playback */
export let bidiPlaybackQueue: Array<{ text: string; voiceId: string; sinkId?: string }> = [];

/** Legacy: Flag indicating TTS is currently playing */
export let bidiIsPlayingTts = false;

/** Legacy: Rolling text accumulator for 1s chunks */
export let bidiRollingText: string = '';

/** Legacy: Timestamp of last chunk */
export let bidiLastChunkAt: number = 0;

/** Legacy: Timer for delayed speech */
export let bidiSpeakTimer: number | null = null;

/** Legacy: Prepared audio queue for instant playback */
export let bidiPreparedQueue: Array<{ audioBuffer: number[]; sinkId?: string; text: string }> = [];

// ============================================================================
// WASAPI AUDIO CAPTURE
// ============================================================================

/** Rolling buffer for WASAPI audio data */
export let wasapiRollingBuffer: (Buffer | Blob)[] = [];

/** Start time of rolling buffer */
export let wasapiBufferStartTime = 0;

/** Current segment being accumulated */
export let wasapiCurrentSegment: (Buffer | Blob)[] = [];

/** Start time of current segment */
export let wasapiSegmentStartTime = 0;

/** WASAPI is currently recording */
export let wasapiIsRecording = false;

/** WASAPI pre-roll duration in MS */
export const WASAPI_PREROLL_MS = 2000;

/** WASAPI max segment duration in MS */
export const WASAPI_MAX_SEGMENT_MS = 30000;

/** WASAPI silence timeout in MS */
export const WASAPI_SILENCE_TIMEOUT_MS = 2000;

/** WASAPI PCM queue for AudioWorklet */
export let wasapiPcmQueue: Float32Array[] = [];

/** WASAPI AudioWorklet node */
export let wasapiWorkletNode: AudioWorkletNode | null = null;

/** WASAPI audio context */
export let wasapiCtx: AudioContext | null = null;

/** WASAPI destination node */
export let wasapiDest: MediaStreamAudioDestinationNode | null = null;

// ============================================================================
// PCM CAPTURE (for screen capture audio)
// ============================================================================

/** PCM capture audio context */
export let pcmCaptureCtx: AudioContext | null = null;

/** PCM capture source node */
export let pcmCaptureSource: MediaStreamAudioSourceNode | null = null;

/** PCM processor node (ScriptProcessor) */
export let pcmProcessorNode: ScriptProcessorNode | null = null;

/** PCM rolling buffer (pre-roll) */
export let pcmRollingBuffer: Float32Array[] = [];

/** Duration of PCM rolling buffer in MS */
export let pcmRollingDurationMs = 0;

/** PCM is currently recording */
export let pcmIsRecording = false;

/** Current frames being accumulated */
export let pcmCurrentFrames: Float32Array[] = [];

/** Duration of current segment in MS */
export let pcmSegmentDurationMs = 0;

/** PCM pre-roll duration in MS */
export const PCM_PREROLL_MS = 2000;

/** PCM max segment duration in MS */
export const PCM_MAX_SEGMENT_MS = 30000;

/** PCM min segment duration in MS */
export const PCM_MIN_SEGMENT_MS = 3000;

// ============================================================================
// SETTERS (for controlled state updates)
// ============================================================================

export function setIsBidirectionalActive(value: boolean): void {
    isBidirectionalActive = value;
}

export function setBidirectionalKeybind(value: string): void {
    bidirectionalKeybind = value;
}

export function setBidirectionalOutputDeviceId(value: string | null): void {
    bidirectionalOutputDeviceId = value;
}

export function setBidirectionalInputDeviceId(value: string | null): void {
    bidirectionalInputDeviceId = value;
}

export function setBidirectionalUseDisplayAudio(value: boolean): void {
    bidirectionalUseDisplayAudio = value;
}

export function setBidirectionalSourceLanguage(value: string): void {
    bidirectionalSourceLanguage = value;
}

export function setBidirectionalTargetLanguage(value: string): void {
    bidirectionalTargetLanguage = value;
}

export function setIncomingVoiceId(value: string | null): void {
    incomingVoiceId = value;
}

export function setSelectedProcessName(value: string | null): void {
    selectedProcessName = value;
}

export function setMacosRealOutputDeviceId(value: string | null): void {
    macosRealOutputDeviceId = value;
}

export function setBidirectionalMiniOverlayTimer(value: NodeJS.Timeout | null): void {
    bidirectionalMiniOverlayTimer = value;
}

export function setBidirectionalAutoOpenedOverlay(value: boolean): void {
    bidirectionalAutoOpenedOverlay = value;
}

export function setIsInitializingBidirectional(value: boolean): void {
    isInitializingBidirectional = value;
}

export function setBidirectionalCaptionsEnabled(value: boolean): void {
    bidirectionalCaptionsEnabled = value;
}

export function setCaptionsSettings(value: typeof captionsSettings): void {
    // Update properties instead of reassigning to maintain object reference
    // This ensures that imports of captionsSettings get the updated values
    // Only update properties that are actually defined to avoid setting undefined values
    if ('enabled' in value) captionsSettings.enabled = value.enabled;
    if ('textColor' in value) captionsSettings.textColor = value.textColor;
    if ('background' in value) captionsSettings.background = value.background;
    if ('fontSize' in value) captionsSettings.fontSize = value.fontSize;
    if ('captionsOnly' in value) captionsSettings.captionsOnly = value.captionsOnly;

    // Log for debugging
    console.log('✅ setCaptionsSettings updated:', JSON.stringify(captionsSettings, null, 2));
}

export function setBidiAudioStream(value: MediaStream | null): void {
    bidiAudioStream = value;
}

export function setBidiDesktopStream(value: MediaStream | null): void {
    bidiDesktopStream = value;
}

export function setBidiMixedStream(value: MediaStream | null): void {
    bidiMixedStream = value;
}

export function setBidiMixerCtx(value: AudioContext | null): void {
    bidiMixerCtx = value;
}

export function setBidiMixerDestination(value: MediaStreamAudioDestinationNode | null): void {
    bidiMixerDestination = value;
}

export function setBidiVadThreshold(value: number): void {
    bidiVadThreshold = value;
}

export function setBidiCalibrating(value: boolean): void {
    bidiCalibrating = value;
}

export function setBidiCalibSamples(value: number): void {
    bidiCalibSamples = value;
}

export function setBidiCalibAccum(value: number): void {
    bidiCalibAccum = value;
}

export function setBidiBaseline(value: number): void {
    bidiBaseline = value;
}

export function setBidiConsecutiveActiveFrames(value: number): void {
    bidiConsecutiveActiveFrames = value;
}

export function setBidiInSpeech(value: boolean): void {
    bidiInSpeech = value;
}

export function setBidiLastVoiceTs(value: number): void {
    bidiLastVoiceTs = value;
}

export function setBidiNeedsProbe(value: boolean): void {
    bidiNeedsProbe = value;
}

export function setBidiLastProbeAttemptTs(value: number): void {
    bidiLastProbeAttemptTs = value;
}

export function setBidiSectionBlocked(value: boolean): void {
    bidiSectionBlocked = value;
}

export function setBidiAnalyzerCtx(value: AudioContext | null): void {
    bidiAnalyzerCtx = value;
}

export function setBidiAnalyzerNode(value: AnalyserNode | null): void {
    bidiAnalyzerNode = value;
}

export function setBidiSourceNode(value: MediaStreamAudioSourceNode | null): void {
    bidiSourceNode = value;
}

export function setBidiEnhancementNodes(value: {
    highpassFilter: BiquadFilterNode;
    lowpassFilter: BiquadFilterNode;
    compressor: DynamicsCompressorNode;
    gainNode: GainNode;
    makeupGainNode: GainNode;
    limiter: DynamicsCompressorNode;
    outputNode: AudioNode;
} | null): void {
    bidiEnhancementNodes = value;
}

export function setBidiVadInterval(value: number | null): void {
    bidiVadInterval = value;
}

export function setBidiRecorder(value: MediaRecorder | null): void {
    bidiRecorder = value;
}

export function setBidiProcessing(value: boolean): void {
    bidiProcessing = value;
}

export function setBidiCurrentBlobs(value: Blob[]): void {
    bidiCurrentBlobs = value;
}

export function setBidiSectionActive(value: boolean): void {
    bidiSectionActive = value;
}

export function setBidiUseWasapiWav(value: boolean): void {
    bidiUseWasapiWav = value;
}

export function setBidiMimeType(value: string): void {
    bidiMimeType = value;
}

export function setBidiStartTs(value: number): void {
    bidiStartTs = value;
}

export function setBidiFirstTargetIndex(value: number): void {
    bidiFirstTargetIndex = value;
}

export function setPendingFinalize(value: boolean): void {
    pendingFinalize = value;
}

export function setBidirectionalTTSProcessor(value: any): void {
    bidirectionalTTSProcessor = value;
}

export function setBidiChunkQueue(value: Array<{ audioData: Buffer; timestamp: number }>): void {
    bidiChunkQueue = value;
}

export function setIsProcessingBidiChunk(value: boolean): void {
    isProcessingBidiChunk = value;
}

export function setBidiLastTranscription(value: string, seq?: number): void {
    // If sequence number provided, only update if this is a newer chunk
    if (seq !== undefined) {
        if (seq > bidiLastTranscriptionSeq) {
            bidiLastTranscription = value;
            bidiLastTranscriptionSeq = seq;
        }
        // If seq <= bidiLastTranscriptionSeq, this chunk is stale - don't update
    } else {
        // Legacy call without sequence - always update
        bidiLastTranscription = value;
    }
}

export function getNextChunkSeq(): number {
    return ++bidiNextChunkSeq;
}

export function resetChunkSeq(): void {
    bidiNextChunkSeq = 0;
    bidiLastTranscriptionSeq = 0;
}

export function setBidirectionalContextManager(value: TranslationContextManager | null): void {
    bidirectionalContextManager = value;
}

export function setBidiLastAudioChunkTime(value: number): void {
    bidiLastAudioChunkTime = value;
}

export function setBidiPlaybackQueue(value: Array<{ text: string; voiceId: string; sinkId?: string }>): void {
    bidiPlaybackQueue = value;
}

export function setBidiIsPlayingTts(value: boolean): void {
    bidiIsPlayingTts = value;
}

export function setBidiRollingText(value: string): void {
    bidiRollingText = value;
}

export function setBidiLastChunkAt(value: number): void {
    bidiLastChunkAt = value;
}

export function setBidiSpeakTimer(value: number | null): void {
    bidiSpeakTimer = value;
}

export function setBidiPreparedQueue(value: Array<{ audioBuffer: number[]; sinkId?: string; text: string }>): void {
    bidiPreparedQueue = value;
}

export function setWasapiRollingBuffer(value: (Buffer | Blob)[]): void {
    wasapiRollingBuffer = value;
}

export function setWasapiBufferStartTime(value: number): void {
    wasapiBufferStartTime = value;
}

export function setWasapiCurrentSegment(value: (Buffer | Blob)[]): void {
    wasapiCurrentSegment = value;
}

export function setWasapiSegmentStartTime(value: number): void {
    wasapiSegmentStartTime = value;
}

export function setWasapiIsRecording(value: boolean): void {
    wasapiIsRecording = value;
}

export function setWasapiPcmQueue(value: Float32Array[]): void {
    wasapiPcmQueue = value;
}

export function setWasapiWorkletNode(value: AudioWorkletNode | null): void {
    wasapiWorkletNode = value;
}

export function setWasapiCtx(value: AudioContext | null): void {
    wasapiCtx = value;
}

export function setWasapiDest(value: MediaStreamAudioDestinationNode | null): void {
    wasapiDest = value;
}

export function setPcmCaptureCtx(value: AudioContext | null): void {
    pcmCaptureCtx = value;
}

export function setPcmCaptureSource(value: MediaStreamAudioSourceNode | null): void {
    pcmCaptureSource = value;
}

export function setPcmProcessorNode(value: ScriptProcessorNode | null): void {
    pcmProcessorNode = value;
}

export function setPcmRollingBuffer(value: Float32Array[]): void {
    pcmRollingBuffer = value;
}

export function setPcmRollingDurationMs(value: number): void {
    pcmRollingDurationMs = value;
}

export function setPcmIsRecording(value: boolean): void {
    pcmIsRecording = value;
}

export function setPcmCurrentFrames(value: Float32Array[]): void {
    pcmCurrentFrames = value;
}

export function setPcmSegmentDurationMs(value: number): void {
    pcmSegmentDurationMs = value;
}

// ============================================================================
// STATE RESET FUNCTIONS
// ============================================================================

/**
 * Reset all audio-related state when stopping bidirectional mode
 */
export function resetAudioState(): void {
    bidiAudioStream = null;
    bidiDesktopStream = null;
    bidiMixedStream = null;
    bidiMixerCtx = null;
    bidiMixerDestination = null;
    bidiAnalyzerCtx = null;
    bidiAnalyzerNode = null;
    bidiSourceNode = null;
    bidiEnhancementNodes = null;
    bidiVadInterval = null;
    bidiRecorder = null;
    wasapiWorkletNode = null;
    wasapiCtx = null;
    wasapiDest = null;
    pcmCaptureCtx = null;
    pcmCaptureSource = null;
    pcmProcessorNode = null;
}

/**
 * Reset VAD-related state
 */
export function resetVADState(): void {
    bidiCalibrating = false;
    bidiCalibSamples = 0;
    bidiCalibAccum = 0;
    bidiBaseline = 0;
    bidiConsecutiveActiveFrames = 0;
    bidiInSpeech = false;
    bidiLastVoiceTs = 0;
    bidiNeedsProbe = false;
    bidiLastProbeAttemptTs = 0;
}

/**
 * Reset processing state
 */
export function resetProcessingState(): void {
    bidiProcessing = false;
    bidiCurrentBlobs = [];
    bidiSectionActive = false;
    bidiStartTs = 0;
    bidiFirstTargetIndex = -1;
    pendingFinalize = false;
    bidiChunkQueue = [];
    isProcessingBidiChunk = false;
    bidiLastTranscription = '';
    bidiLastTranscriptionSeq = 0;
    bidiNextChunkSeq = 0;
    bidiLastAudioChunkTime = 0;
}

/**
 * Reset buffer state
 */
export function resetBufferState(): void {
    wasapiRollingBuffer = [];
    wasapiBufferStartTime = 0;
    wasapiCurrentSegment = [];
    wasapiSegmentStartTime = 0;
    wasapiIsRecording = false;
    wasapiPcmQueue = [];
    pcmRollingBuffer = [];
    pcmRollingDurationMs = 0;
    pcmIsRecording = false;
    pcmCurrentFrames = [];
    pcmSegmentDurationMs = 0;
}

/**
 * Reset all bidirectional state (called when stopping)
 */
export function resetAllBidirectionalState(): void {
    resetAudioState();
    resetVADState();
    resetProcessingState();
    resetBufferState();
    bidiSectionBlocked = false;
    bidiUseWasapiWav = false;
    macosRealOutputDeviceId = null;
}
