/**
 * Base error class for application errors
 */
export abstract class AppError extends Error {
  /** Error code for programmatic handling */
  public readonly code: string;
  /** Timestamp when error occurred */
  public readonly timestamp: number;
  /** Additional error context */
  public readonly context?: Record<string, any>;

  constructor(message: string, code: string, context?: Record<string, any>) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.timestamp = Date.now();
    this.context = context;
    
    // Maintains proper stack trace for where our error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Audio-related errors
 */
export class AudioError extends AppError {
  constructor(message: string, code: string, context?: Record<string, any>) {
    super(message, code, context);
  }
}

/**
 * API-related errors
 */
export class ApiError extends AppError {
  /** HTTP status code if applicable */
  public readonly statusCode?: number;
  /** Rate limit information if applicable */
  public readonly rateLimit?: RateLimitInfo;

  constructor(
    message: string, 
    code: string, 
    statusCode?: number, 
    context?: Record<string, any>,
    rateLimit?: RateLimitInfo
  ) {
    super(message, code, context);
    this.statusCode = statusCode;
    this.rateLimit = rateLimit;
  }
}

/**
 * Configuration-related errors
 */
export class ConfigError extends AppError {
  constructor(message: string, code: string, context?: Record<string, any>) {
    super(message, code, context);
  }
}

/**
 * Device-related errors
 */
export class DeviceError extends AppError {
  /** Device ID that caused the error */
  public readonly deviceId?: string;

  constructor(message: string, code: string, deviceId?: string, context?: Record<string, any>) {
    super(message, code, context);
    this.deviceId = deviceId;
  }
}

/**
 * Network-related errors
 */
export class NetworkError extends AppError {
  /** Whether this is a temporary network issue */
  public readonly isTemporary: boolean;

  constructor(message: string, code: string, isTemporary: boolean = true, context?: Record<string, any>) {
    super(message, code, context);
    this.isTemporary = isTemporary;
  }
}

/**
 * Rate limit information
 */
export interface RateLimitInfo {
  /** Requests remaining in current window */
  remaining: number;
  /** Total requests allowed in window */
  limit: number;
  /** When the rate limit resets (timestamp) */
  resetTime: number;
  /** Rate limit window duration in seconds */
  windowDuration: number;
}

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

/**
 * Error categories for handling and reporting
 */
export enum ErrorCategory {
  AUDIO = 'audio',
  API = 'api',
  NETWORK = 'network',
  DEVICE = 'device',
  CONFIGURATION = 'configuration',
  PROCESSING = 'processing',
  UI = 'ui',
  UNKNOWN = 'unknown'
}

/**
 * Structured error information for logging and reporting
 */
export interface ErrorInfo {
  /** Error instance */
  error: Error;
  /** Error category */
  category: ErrorCategory;
  /** Error severity */
  severity: ErrorSeverity;
  /** Whether error is recoverable */
  recoverable: boolean;
  /** Suggested recovery actions */
  recoveryActions?: string[];
  /** User-friendly error message */
  userMessage?: string;
  /** Additional context for debugging */
  debugContext?: Record<string, any>;
}

/**
 * Common error codes used throughout the application
 */
export const ErrorCodes = {
  // Audio errors
  MICROPHONE_ACCESS_DENIED: 'MICROPHONE_ACCESS_DENIED',
  MICROPHONE_NOT_FOUND: 'MICROPHONE_NOT_FOUND',
  AUDIO_CAPTURE_FAILED: 'AUDIO_CAPTURE_FAILED',
  VIRTUAL_MIC_UNAVAILABLE: 'VIRTUAL_MIC_UNAVAILABLE',
  
  // API errors
  API_KEY_INVALID: 'API_KEY_INVALID',
  API_RATE_LIMITED: 'API_RATE_LIMITED',
  API_QUOTA_EXCEEDED: 'API_QUOTA_EXCEEDED',
  API_SERVICE_UNAVAILABLE: 'API_SERVICE_UNAVAILABLE',
  
  // Network errors
  NETWORK_OFFLINE: 'NETWORK_OFFLINE',
  NETWORK_TIMEOUT: 'NETWORK_TIMEOUT',
  NETWORK_CONNECTION_FAILED: 'NETWORK_CONNECTION_FAILED',
  
  // Processing errors
  TRANSCRIPTION_FAILED: 'TRANSCRIPTION_FAILED',
  TRANSLATION_FAILED: 'TRANSLATION_FAILED',
  TTS_SYNTHESIS_FAILED: 'TTS_SYNTHESIS_FAILED',
  VOICE_CLONING_FAILED: 'VOICE_CLONING_FAILED',
  
  // Configuration errors
  CONFIG_INVALID: 'CONFIG_INVALID',
  CONFIG_MISSING: 'CONFIG_MISSING',
  CONFIG_SAVE_FAILED: 'CONFIG_SAVE_FAILED',
  
  // General errors
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
  INITIALIZATION_FAILED: 'INITIALIZATION_FAILED'
} as const;