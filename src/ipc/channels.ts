/**
 * IPC channel definitions for communication between main and renderer processes
 */

// Audio-related channels
export const AUDIO_CHANNELS = {
  GET_DEVICES: 'audio:get-devices',
  GET_DEVICES_RESPONSE: 'audio:get-devices-response',
  START_CAPTURE: 'audio:start-capture',
  STOP_CAPTURE: 'audio:stop-capture',
  AUDIO_DATA: 'audio:data',
  AUDIO_LEVEL: 'audio:level',
  DEVICE_CHANGED: 'audio:device-changed',
  STREAM: 'audio:stream'
} as const;

// Configuration channels
export const CONFIG_CHANNELS = {
  GET_CONFIG: 'config:get',
  GET_CONFIG_RESPONSE: 'config:get-response',
  SET_CONFIG: 'config:set',
  CONFIG_UPDATED: 'config:updated',
  VALIDATE_API_KEY: 'config:validate-api-key',
  API_KEY_VALIDATION_RESPONSE: 'config:api-key-validation-response'
} as const;

// Translation pipeline channels
export const PIPELINE_CHANNELS = {
  START_TRANSLATION: 'pipeline:start',
  STOP_TRANSLATION: 'pipeline:stop',
  TEST_TRANSLATION: 'pipeline:test',
  GET_STATUS: 'pipeline:get-status',
  PROCESS_AUDIO: 'pipeline:process-audio',
  PROCESSING_UPDATE: 'pipeline:processing-update',
  PROCESSING_RESULT: 'pipeline:processing-result',
  PROCESSING_ERROR: 'pipeline:processing-error'
} as const;

// Speech-to-text channels
export const SPEECH_CHANNELS = {
  TRANSCRIBE: 'speech:transcribe',
  TRANSCRIBE_RESPONSE: 'speech:transcribe-response',
  TRANSCRIBE_PUSH_TO_TALK: 'speech:transcribe-push-to-talk'
} as const;

// Translation-only and TTS-only channels
export const TRANSLATION_TTS_CHANNELS = {
  TRANSLATE_ONLY: 'translation:translate',
  SYNTHESIZE_ONLY: 'tts:synthesize',
  START_TRANSLATION: 'translation:start',
  STOP_TRANSLATION: 'translation:stop'
} as const;

// Translation-only and TTS-only channels

// Service status channels
export const SERVICE_CHANNELS = {
  GET_SERVICE_STATUS: 'service:get-status',
  SERVICE_STATUS_RESPONSE: 'service:status-response',
  SERVICE_STATUS_CHANGED: 'service:status-changed'
} as const;

// Error handling channels
export const ERROR_CHANNELS = {
  ERROR_OCCURRED: 'error:occurred',
  ACKNOWLEDGE_ERROR: 'error:acknowledge',
  RETRY_OPERATION: 'error:retry',
  REPORT_ERROR: 'error:report'
} as const;

// Debug and logging channels
export const DEBUG_CHANNELS = {
  LOG_MESSAGE: 'debug:log',
  GET_LOGS: 'debug:get-logs',
  LOGS_RESPONSE: 'debug:logs-response',
  CLEAR_LOGS: 'debug:clear-logs'
} as const;

// Performance monitoring channels
export const PERFORMANCE_CHANNELS = {
  GET_METRICS: 'performance:get-metrics',
  METRICS_RESPONSE: 'performance:metrics-response',
  METRICS_UPDATE: 'performance:metrics-update'
} as const;

// Voice cloning channels
export const VOICE_CHANNELS = {
  GET_VOICES: 'voice:get-voices',
  VOICES_RESPONSE: 'voice:voices-response',
  START_VOICE_CLONING: 'voice:start-cloning',
  VOICE_CLONING_STATUS: 'voice:cloning-status',
  VOICE_CLONING_COMPLETE: 'voice:cloning-complete'
} as const;

// Bidirectional channels
export const BIDIRECTIONAL_CHANNELS = {
  START_BIDIRECTIONAL: 'bidirectional:start',
  STOP_BIDIRECTIONAL: 'bidirectional:stop',
  BIDIRECTIONAL_STATE: 'bidirectional:state'
} as const;

// Overlay channels
export const OVERLAY_CHANNELS = {
  TOGGLE: 'overlay:toggle',
  CLOSE: 'overlay:close',
  HOLD_CLOSE: 'overlay:hold-close',
  KEY_DOWN: 'overlay:key-down',
  KEY_UP: 'overlay:key-up',
  MODE_CHANGE: 'overlay:mode-change',
  STATE_UPDATE: 'overlay:state-update',
  MIC_STATE_UPDATE: 'overlay:mic-state-update',
  BIDIRECTIONAL_STATE_UPDATE: 'overlay:bidirectional-state-update',
  TRANSLATION_RESULT: 'overlay:translation-result',
  SETTING_CHANGE: 'overlay:setting-change',
  GET_CURRENT_STATE: 'overlay:get-current-state',
  UPDATE_HOTKEY: 'overlay:update-hotkey',
  SAVE_POSITION: 'overlay:save-position',
  GET_CONFIG: 'overlay:get-config',
  GET_GAMEOVERLAY: 'overlay:get-gameoverlay',
  REPORT_ERROR: 'overlay:report-error',
  PING: 'overlay:ping',
  PONG: 'overlay:pong',
  CLEANUP_RESOURCES: 'overlay:cleanup-resources'
} as const;

// Mini overlay channels
export const MINI_OVERLAY_CHANNELS = {
  AUDIO_DETECTED: 'mini-overlay:audio-detected',
  VOICE_TRANSLATION: 'mini-overlay:voice-translation',
  SCREEN_TRANSLATION: 'mini-overlay:screen-translation',
  STATUS_UPDATE: 'mini-overlay:status-update',
  PING: 'mini-overlay:ping',
  PONG: 'mini-overlay:pong',
  CLEANUP_RESOURCES: 'mini-overlay:cleanup-resources',
  REPORT_ERROR: 'mini-overlay:report-error'
} as const;

// Auth channels
export const AUTH_CHANNELS = {
  START_SIGN_IN: 'auth:start-sign-in',
  SIGN_OUT: 'auth:sign-out'
} as const;

// Update channels
export const UPDATE_CHANNELS = {
  CHECK_FOR_UPDATES: 'updater:check-for-updates',
  DOWNLOAD_UPDATE: 'updater:download-update',
  INSTALL_UPDATE: 'updater:install-update',
  GET_UPDATE_STATUS: 'updater:get-status',
  STATUS_CHANGED: 'updater:status-changed',
  DISMISS_UPDATE: 'updater:dismiss-update'
} as const;

// GPU Paddle channels
export const GPU_PADDLE_CHANNELS = {
  SHOW_OVERLAY: 'gpu-paddle:show-overlay',
  CLOSE_OVERLAY: 'gpu-paddle:close-overlay',
  DETECT_CUDA: 'gpu-paddle:detect-cuda',
  CHECK_STATUS: 'gpu-paddle:check-status',
  INSTALL: 'gpu-paddle:install',
  GET_GPU_MODE: 'gpu-paddle:get-gpu-mode',
  SET_GPU_MODE: 'gpu-paddle:set-gpu-mode',
  FIX_NUMPY: 'gpu-paddle:fix-numpy'
} as const;

// All channels combined for type safety
export const IPC_CHANNELS = {
  ...AUDIO_CHANNELS,
  ...CONFIG_CHANNELS,
  ...PIPELINE_CHANNELS,
  ...SPEECH_CHANNELS,
  ...TRANSLATION_TTS_CHANNELS,
  ...SERVICE_CHANNELS,
  ...ERROR_CHANNELS,
  ...DEBUG_CHANNELS,
  ...PERFORMANCE_CHANNELS,
  ...VOICE_CHANNELS,
  ...BIDIRECTIONAL_CHANNELS,
  ...OVERLAY_CHANNELS,
  ...AUTH_CHANNELS,
  ...UPDATE_CHANNELS,
  ...GPU_PADDLE_CHANNELS
} as const;

// Type for all channel names
export type IPCChannel = typeof IPC_CHANNELS[keyof typeof IPC_CHANNELS];