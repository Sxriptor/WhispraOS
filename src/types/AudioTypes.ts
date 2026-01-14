/**
 * Represents a segment of captured audio for processing
 */
export interface AudioSegment {
  /** Unique identifier for this audio segment */
  id: string;
  /** Raw audio data */
  audioData: ArrayBuffer;
  /** Timestamp when audio was captured */
  timestamp: number;
  /** Duration of the audio segment in milliseconds */
  duration: number;
  /** Whether this segment has been processed */
  processed: boolean;
  /** Audio format information */
  format: AudioSegmentFormat;
  /** Audio level/volume (0-100) */
  level?: number;
}

/**
 * Audio format information for a segment
 */
export interface AudioSegmentFormat {
  /** Sample rate in Hz */
  sampleRate: number;
  /** Number of channels */
  channels: number;
  /** Bit depth */
  bitDepth: number;
  /** Audio encoding */
  encoding: 'pcm' | 'float' | 'wav' | 'mp3';
}

/**
 * Result of processing an audio segment through the complete pipeline
 */
export interface ProcessingResult {
  /** ID of the original audio segment */
  segmentId: string;
  /** Original transcribed text */
  originalText: string;
  /** Translated text */
  translatedText: string;
  /** Final synthesized audio output */
  audioOutput: ArrayBuffer;
  /** Total processing time in milliseconds */
  processingTime: number;
  /** Individual step timings */
  stepTimings: ProcessingStepTimings;
  /** Any errors that occurred during processing */
  errors?: ProcessingError[];
  /** Processing status */
  status: ProcessingStatus;
}

/**
 * Timing information for each processing step
 */
export interface ProcessingStepTimings {
  /** Time spent on speech-to-text */
  speechToText: number;
  /** Time spent on translation */
  translation: number;
  /** Time spent on text-to-speech */
  textToSpeech: number;
  /** Time spent on audio output */
  audioOutput: number;
}

/**
 * Processing status enumeration
 */
export enum ProcessingStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

/**
 * Error information for processing failures
 */
export interface ProcessingError {
  /** Error code */
  code: string;
  /** Human-readable error message */
  message: string;
  /** Processing step where error occurred */
  step: ProcessingStep;
  /** Timestamp when error occurred */
  timestamp: number;
  /** Additional error details */
  details?: Record<string, any>;
}

/**
 * Processing pipeline steps
 */
export enum ProcessingStep {
  AUDIO_CAPTURE = 'audio_capture',
  SPEECH_TO_TEXT = 'speech_to_text',
  TRANSLATION = 'translation',
  TEXT_TO_SPEECH = 'text_to_speech',
  AUDIO_OUTPUT = 'audio_output'
}