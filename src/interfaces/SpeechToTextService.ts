import { AudioSegment } from './AudioCaptureService';

/**
 * Service interface for converting speech to text using various providers
 */
export interface SpeechToTextService {
  /**
   * Transcribe audio segment to text
   * @param segment - Audio segment to transcribe
   * @returns Promise resolving to transcription result
   */
  transcribe(segment: AudioSegment): Promise<TranscriptionResult>;

  /**
   * Set the source language for transcription
   * @param language - Language code (e.g., 'en', 'es', 'fr')
   */
  setLanguage(language: string): void;

  /**
   * Get supported languages for transcription
   * @returns Array of supported language codes
   */
  getSupportedLanguages(): string[];

  /**
   * Check if the service is available and configured
   * @returns True if service is ready to use
   */
  isAvailable(): boolean;
}

/**
 * Result of a speech-to-text transcription
 */
export interface TranscriptionResult {
  /** Unique identifier for the transcription */
  id?: string;
  /** The transcribed text */
  text: string;
  /** Confidence score (0-1) */
  confidence: number;
  /** Detected or specified language */
  language: string;
  /** Duration of the audio segment in seconds */
  duration?: number;
  /** Processing time in milliseconds */
  processingTime?: number;
  /** Timestamp when transcription was completed */
  timestamp?: number;
  /** Transcription segments with timing information */
  segments?: Array<{
    text: string;
    start: number;
    end: number;
    confidence?: number;
  }>;
  /** Additional metadata from the provider */
  metadata?: Record<string, any>;
  /** Provider used for transcription */
  provider?: string;
}