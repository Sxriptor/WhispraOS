/**
 * Main application configuration
 */
export interface AppConfig {
  /** Selected microphone device ID */
  selectedMicrophone: string;
  /** Target language for translation */
  targetLanguage: string;
  /** Source language (auto-detect if empty) */
  sourceLanguage?: string;
  /** Candidate source languages to bias detection (e.g., ['en','ru']) */
  languageCandidates?: string[];
  /** Preferred translation provider */
  translationProvider: TranslationProvider;
  /** Preferred speech-to-text provider */
  sttProvider?: 'openai' | 'deepinfra';
  /** Preferred text-to-speech provider */
  ttsProvider?: 'elevenlabs' | 'deepinfra';
  /** Selected voice ID for TTS */
  voiceId: string;
  /** Whether debug mode is enabled */
  debugMode: boolean;
  /** API keys for various services */
  apiKeys: ApiKeys;
  /** Audio processing settings */
  audioSettings: AudioSettings;
  /** Voice synthesis settings */
  voiceSettings: VoiceSettings;
  /** UI preferences */
  uiSettings: UISettings;
  /** Custom voices added by user */
  customVoices?: CustomVoice[];
  /** Processing mode: cloud or local */
  processingMode?: 'cloud' | 'local';
  /** Cloud model configuration */
  cloudModelConfig?: ModelConfig;
  /** Local model configuration */
  localModelConfig?: ModelConfig;
  /** Unified model configuration (replaces cloud/local configs) */
  modelConfig?: ModelConfig;
  /** Whether user has seen the VB Audio setup overlay (Windows) */
  vbAudioSetupShown?: boolean;
  /** Whether user has seen the BlackHole setup overlay (macOS) */
  blackHoleSetupShown?: boolean;
  /** Quick translate hotkey configuration */
  quickTranslate?: QuickTranslateConfig;
  /** Managed API service configuration */
  managedApiConfig?: ManagedApiConfig;
}

/**
 * Quick translate configuration
 */
export interface QuickTranslateConfig {
  /** Whether quick translate hotkey is enabled */
  enabled: boolean;
  /** Hotkey combination (e.g., 'Alt+C') */
  hotkey: string;
  /** Target language for translation */
  targetLanguage: string;
  /** Source language for translation (optional, used for Argos which doesn't support auto-detection) */
  sourceLanguage?: string;
  /** Translation provider to use */
  provider: 'openai' | 'deepinfra' | 'argos-translate';
  /** Whether to show overlay with translation result */
  showOverlay: boolean;
}

/**
 * API keys for external services
 */
export interface ApiKeys {
  /** OpenAI API key */
  openai: string;
  /** ElevenLabs API key */
  elevenlabs: string;
  /** DeepInfra API key (optional) */
  deepinfra?: string;
  /** Google Translate API key (optional) */
  google?: string;
  /** DeepL API key (optional) */
  deepl?: string;
}

/**
 * Audio processing configuration
 */
export interface AudioSettings {
  /** Voice activity detection sensitivity (0-100) */
  vadSensitivity: number;
  /** Minimum audio segment duration in ms */
  minSegmentDuration: number;
  /** Maximum audio segment duration in ms */
  maxSegmentDuration: number;
  /** Audio quality setting */
  quality: AudioQuality;
  /** Noise reduction enabled */
  noiseReduction: boolean;
  /** Auto gain control enabled */
  autoGainControl: boolean;
  /** Echo cancellation enabled */
  echoCancellation: boolean;
}

/**
 * Voice synthesis configuration
 */
export interface VoiceSettings {
  /** Voice stability (0-1) */
  stability: number;
  /** Similarity boost (0-1) */
  similarityBoost: number;
  /** Speaking rate multiplier */
  speed: number;
  /** Audio quality for TTS */
  quality: TTSQuality;
}

/**
 * UI preferences and settings
 */
export interface UISettings {
  /** Application theme */
  theme: 'default' | 'neo-brutalism' | 'hacker' | 'corporate' | 'light' | 'dark' | 'auto';
  /** Window size and position */
  windowBounds: WindowBounds;
  /** Whether to show debug console by default */
  showDebugConsole: boolean;
  /** Language for UI text */
  uiLanguage: string;
  /** Whether to show notifications */
  showNotifications: boolean;
  /** Global push-to-talk hotkey (e.g. { ctrl: true, alt: false, shift: true, key: 'Space' }) */
  pttHotkey?: {
    ctrl: boolean;
    alt: boolean;
    shift: boolean;
    key: string;
  };
  /** Global bidirectional toggle hotkey (e.g. { ctrl:false, alt:false, shift:false, key:'B' }) */
  bidirectionalHotkey?: {
    ctrl: boolean;
    alt: boolean;
    shift: boolean;
    key: string;
  };
  /** Screen translation toggle hotkey (e.g. { ctrl:false, alt:true, shift:false, key:'T' }) */
  screenTranslationHotkey?: {
    ctrl: boolean;
    alt: boolean;
    shift: boolean;
    key: string;
  };
  /** Screen translation box selection hotkey (e.g. { ctrl:false, alt:true, shift:false, key:'Y' }) */
  screenTranslationBoxHotkey?: {
    ctrl: boolean;
    alt: boolean;
    shift: boolean;
    key: string;
  };
  /** Screen translation watch box hotkey (e.g. { ctrl:false, alt:true, shift:false, key:'W' }) */
  screenTranslationWatchBoxHotkey?: {
    ctrl: boolean;
    alt: boolean;
    shift: boolean;
    key: string;
  };
  /** Overlay settings */
  overlaySettings?: OverlaySettings;
  /** Bidirectional output device ID */
  bidirectionalOutputDevice?: string;
  /** Bidirectional output device ID (new consistent naming) */
  bidirectionalOutputDeviceId?: string;
  /** Incoming voice ID for bidirectional mode */
  incomingVoiceId?: string;
  /** Source language for bidirectional mode Whisper transcription */
  bidirectionalSourceLanguage?: string;
  /** Target language for bidirectional mode translation */
  bidirectionalTargetLanguage?: string;
  /** Whether captions are enabled in bidirectional mode */
  bidirectionalCaptionsEnabled?: boolean;
  /** Captions overlay settings */
  captionsSettings?: {
    enabled: boolean;
    textColor: 'white' | 'black';
    background: 'none' | 'white' | 'black';
    fontSize: 'small' | 'medium' | 'large' | 'xlarge';
    position?: { x: number; y: number };
  };
  /** Capture source for screen/window capture */
  captureSource?: string;
  /** Secure storage configuration for API keys */
  storageConfig?: StorageSettings;
  /** GPU acceleration mode for PaddleOCR (requires CUDA GPU) */
  ocrGpuMode?: 'normal' | 'fast';
  /** Whether to pre-load Paddle OCR models on app startup for faster screen translation */
  paddleWarmupOnStartup?: boolean;
  /** Whether to run Whispra in the background (minimize to tray instead of quitting) */
  runInBackground?: boolean;
  /** Bidirectional translation optimization settings */
  bidirectionalOptimization?: {
    /** Translation speed mode: 'normal' uses standard pipeline, 'fast' uses OpenAI Real-Time API */
    translationSpeed: 'normal' | 'fast';
    /** Cache size for translation results */
    translationCacheSize: number;
    /** Cache size for audio fingerprints */
    fingerprintCacheSize: number;
    /** Fuzzy matching threshold (0-1) */
    fuzzyMatchThreshold: number;
    /** Enable intelligent cache preloading */
    enableCachePreloading: boolean;
    /** Enable performance-based provider selection */
    enablePerformanceSelection: boolean;
    /** Enable batch processing */
    enableBatchProcessing: boolean;
    /** Batch size for processing multiple requests */
    batchSize: number;
  };
}

/**
 * Window bounds information
 */
export interface WindowBounds {
  /** Window width */
  width: number;
  /** Window height */
  height: number;
  /** Window x position */
  x?: number;
  /** Window y position */
  y?: number;
  /** Whether window is maximized */
  maximized: boolean;
}

/**
 * Audio quality levels
 */
export enum AudioQuality {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high'
}

/**
 * Text-to-speech quality levels
 */
export enum TTSQuality {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  ULTRA = 'ultra'
}

/**
 * Available translation providers
 */
export enum TranslationProvider {
  OPENAI = 'openai',
  GOOGLE = 'google',
  DEEPL = 'deepl',
  ARGOS = 'argos'
}

/**
 * Language information
 */
export interface LanguageInfo {
  /** Language code (ISO 639-1) */
  code: string;
  /** Human-readable language name */
  name: string;
  /** Native language name */
  nativeName: string;
  /** Whether this language is supported for STT */
  supportsSpeechToText: boolean;
  /** Whether this language is supported for translation */
  supportsTranslation: boolean;
  /** Whether this language is supported for TTS */
  supportsTextToSpeech: boolean;
}

/**
 * Custom voice added by user
 */
export interface CustomVoice {
  /** Voice ID from ElevenLabs */
  id: string;
  /** Display name for the voice */
  name: string;
  /** When the voice was added */
  dateAdded: string;
  /** Optional description */
  description?: string;
}

/**
 * Overlay configuration
 */
export interface OverlaySettings {
  /** Whether overlay is enabled */
  enabled: boolean;
  /** Overlay toggle hotkey (default: F11) */
  toggleHotkey: {
    ctrl: boolean;
    alt: boolean;
    shift: boolean;
    key: string;
  };
  /** Overlay position */
  position: {
    x: number;
    y: number;
  };
  /** Overlay opacity (0-1) */
  opacity: number;
  /** Whether overlay should auto-hide */
  autoHide: boolean;
  /** Always on top */
  alwaysOnTop: boolean;
  /** Click through when in minimal mode */
  clickThrough: boolean;
}

/**
 * Overlay mode enumeration
 */
export enum OverlayMode {
  CLOSED = 'closed',
  MINIMAL = 'minimal',
  EXPANDED = 'expanded'
}

/**
 * Secure storage settings for API keys
 */
export interface StorageSettings {
  /** Storage type for API keys */
  type: 'keychain' | 'passphrase' | 'none';
  /** Whether a passphrase has been configured (for passphrase type) */
  hasPassphrase: boolean;
  /** Last migration timestamp */
  lastMigration?: string;
}

/**
 * Model configuration for cloud and local processing
 */
export interface ModelConfig {
  /** Whisper model for speech-to-text */
  whisperModel: string;
  /** GPT/Translation model */
  gptModel: string;
  /** Voice model for text-to-speech */
  voiceModel: string;
  /** Model parameters */
  modelParameters: {
    temperature: number;
    maxTokens?: number;
    stability?: number;
    similarityBoost?: number;
    speed?: number;
    quality?: string;
  };
}

/**
 * Determine processing mode from model configuration
 * Cloud models: whisper-1, deepinfra
 * Local models: tiny, small, medium, large (Faster Whisper)
 * If gptModel is 'argos', it's local mode
 * Defaults to 'cloud' if modelConfig is not provided
 */
export function getProcessingModeFromConfig(config: any): 'cloud' | 'local' {
  // First check if modelConfig exists (new unified config)
  const modelConfig = config?.modelConfig;
  
  if (modelConfig) {
    const whisperModel = modelConfig.whisperModel;
    const gptModel = modelConfig.gptModel;
    
    // If translation model is Argos, it's local mode
    if (gptModel === 'argos') {
      return 'local';
    }
    
    // Check whisper model - local Faster Whisper models
    const localWhisperModels = ['tiny', 'small', 'medium', 'large'];
    if (localWhisperModels.includes(whisperModel)) {
      return 'local';
    }
    
    // Cloud models: whisper-1, deepinfra
    const cloudWhisperModels = ['whisper-1', 'deepinfra'];
    if (cloudWhisperModels.includes(whisperModel)) {
      return 'cloud';
    }
    
    // Default to cloud if model is not recognized
    return 'cloud';
  }
  
  // Fallback to old processingConfig.mode or processingMode
  if (config?.processingConfig?.mode) {
    return config.processingConfig.mode;
  }
  
  if (config?.processingMode) {
    return config.processingMode;
  }
  
  // Final fallback: check old cloud/local configs
  if (config?.localModelConfig?.gptModel === 'argos') {
    return 'local';
  }
  
  // Default to cloud
  return 'cloud';
}

/**
 * Get model configuration from config object
 * Prefers modelConfig, falls back to cloudModelConfig or localModelConfig based on processing mode
 */
export function getModelConfigFromConfig(config: any): ModelConfig | undefined {
  // First check for unified modelConfig
  if (config?.modelConfig) {
    return config.modelConfig;
  }
  
  // Fallback to old cloud/local configs based on processing mode
  const processingMode = getProcessingModeFromConfig(config);
  if (processingMode === 'local' && config?.localModelConfig) {
    return config.localModelConfig;
  }
  if (processingMode === 'cloud' && config?.cloudModelConfig) {
    return config.cloudModelConfig;
  }
  
  return undefined;
}

/**
 * Managed API service configuration
 */
export interface ManagedApiConfig {
  /** Current API mode */
  mode: 'managed' | 'personal';
  /** Timestamp of last mode switch */
  lastModeSwitch: string;
  /** Whether usage warnings are enabled */
  usageWarningsEnabled: boolean;
  /** Whether to automatically switch to personal keys when limit exceeded */
  autoSwitchOnLimit: boolean;
}

/**
 * Overlay state interface
 */
export interface OverlayState {
  mode: OverlayMode;
  position: { x: number; y: number };
  microphoneState: {
    isActive: boolean;
    isRecording: boolean;
    deviceId: string;
    level: number;
  };
  bidirectionalState: {
    isEnabled: boolean;
    inputDevice: string;
    outputDevice: string;
    isProcessingAudio: boolean;
  };
  translationResult: {
    originalText: string;
    translatedText: string;
    sourceLanguage: string;
    targetLanguage: string;
  } | null;
  connectionStatus: 'connected' | 'disconnected' | 'reconnecting';
}
