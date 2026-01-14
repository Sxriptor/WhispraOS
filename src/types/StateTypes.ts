import { AppConfig } from './ConfigurationTypes';
import { AudioSegment, ProcessingResult, ProcessingStep } from './AudioTypes';
import { ErrorInfo } from './ErrorTypes';
import { AudioDevice } from '../interfaces/AudioCaptureService';

/**
 * Overall application state
 */
export interface AppState {
  /** Current application status */
  status: AppStatus;
  /** Whether translation is currently active */
  isTranslating: boolean;
  /** Current configuration */
  config: AppConfig;
  /** Audio capture state */
  audioCapture: AudioCaptureState;
  /** Processing pipeline state */
  processing: ProcessingState;
  /** Service availability status */
  services: ServiceStatus;
  /** Current errors */
  errors: ErrorState[];
  /** Performance metrics */
  performance: PerformanceMetrics;
}

/**
 * Application status enumeration
 */
export enum AppStatus {
  INITIALIZING = 'initializing',
  READY = 'ready',
  ACTIVE = 'active',
  ERROR = 'error',
  SHUTTING_DOWN = 'shutting_down'
}

/**
 * Audio capture state information
 */
export interface AudioCaptureState {
  /** Whether audio capture is active */
  isCapturing: boolean;
  /** Currently selected device */
  selectedDevice?: AudioDevice;
  /** Available audio devices */
  availableDevices: AudioDevice[];
  /** Current audio level (0-100) */
  currentLevel: number;
  /** Voice activity detection status */
  voiceDetected: boolean;
  /** Last audio segment timestamp */
  lastSegmentTime?: number;
}

/**
 * Processing pipeline state
 */
export interface ProcessingState {
  /** Number of segments in processing queue */
  queueLength: number;
  /** Currently processing segment */
  currentSegment?: AudioSegment;
  /** Processing step for current segment */
  currentStep?: ProcessingStep;
  /** Recent processing results */
  recentResults: ProcessingResult[];
  /** Processing statistics */
  statistics: ProcessingStatistics;
}

/**
 * Processing statistics
 */
export interface ProcessingStatistics {
  /** Total segments processed */
  totalProcessed: number;
  /** Total processing time */
  totalProcessingTime: number;
  /** Average processing time per segment */
  averageProcessingTime: number;
  /** Success rate (0-1) */
  successRate: number;
  /** Error count by type */
  errorCounts: Record<string, number>;
}

/**
 * Service availability status
 */
export interface ServiceStatus {
  /** Speech-to-text service status */
  speechToText: ServiceState;
  /** Translation service status */
  translation: ServiceState;
  /** Text-to-speech service status */
  textToSpeech: ServiceState;
  /** Virtual microphone service status */
  virtualMicrophone: ServiceState;
  /** Audio capture service status */
  audioCapture: ServiceState;
}

/**
 * Individual service state
 */
export interface ServiceState {
  /** Whether service is available */
  available: boolean;
  /** Service status */
  status: 'ready' | 'busy' | 'error' | 'unavailable';
  /** Last successful operation timestamp */
  lastSuccess?: number;
  /** Last error if any */
  lastError?: string;
  /** Service-specific metadata */
  metadata?: Record<string, any>;
}

/**
 * Error state information
 */
export interface ErrorState {
  /** Unique error ID */
  id: string;
  /** Error information */
  error: ErrorInfo;
  /** When error occurred */
  timestamp: number;
  /** Whether error has been acknowledged by user */
  acknowledged: boolean;
  /** Whether error is currently being retried */
  retrying: boolean;
  /** Number of retry attempts */
  retryCount: number;
}

/**
 * Performance metrics
 */
export interface PerformanceMetrics {
  /** Memory usage information */
  memory: MemoryUsage;
  /** CPU usage percentage */
  cpuUsage: number;
  /** Network usage statistics */
  network: NetworkUsage;
  /** Audio processing latency */
  audioLatency: LatencyMetrics;
  /** API response times */
  apiResponseTimes: Record<string, number>;
}

/**
 * Memory usage information
 */
export interface MemoryUsage {
  /** Used memory in MB */
  used: number;
  /** Total available memory in MB */
  total: number;
  /** Memory usage percentage */
  percentage: number;
  /** Heap usage for renderer process */
  heapUsed?: number;
  /** Heap total for renderer process */
  heapTotal?: number;
}

/**
 * Network usage statistics
 */
export interface NetworkUsage {
  /** Bytes sent */
  bytesSent: number;
  /** Bytes received */
  bytesReceived: number;
  /** Current upload speed in bytes/sec */
  uploadSpeed: number;
  /** Current download speed in bytes/sec */
  downloadSpeed: number;
  /** Whether currently online */
  online: boolean;
}

/**
 * Latency metrics for audio processing
 */
export interface LatencyMetrics {
  /** End-to-end processing latency in ms */
  endToEnd: number;
  /** Speech-to-text latency in ms */
  speechToText: number;
  /** Translation latency in ms */
  translation: number;
  /** Text-to-speech latency in ms */
  textToSpeech: number;
  /** Audio output latency in ms */
  audioOutput: number;
}

// Re-export types from other files for convenience
export type { AppConfig } from './ConfigurationTypes';
export type { AudioSegment, ProcessingResult, ProcessingStep } from './AudioTypes';
export type { ErrorInfo } from './ErrorTypes';
export type { AudioDevice } from '../interfaces/AudioCaptureService';