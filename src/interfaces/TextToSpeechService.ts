/**
 * Service interface for converting text to speech with voice cloning
 */
export interface TextToSpeechService {
  /**
   * Synthesize text to speech using specified voice
   * @param text - Text to convert to speech
   * @param voiceId - ID of the voice to use
   * @param modelId - Optional model ID to use (e.g., eleven_multilingual_v3 for accent support)
   * @returns Promise resolving to audio buffer
   */
  synthesize(text: string, voiceId: string, modelId?: string): Promise<ArrayBuffer>;

  /**
   * Synthesize text to speech using streaming API for real-time audio chunks
   * @param text - Text to convert to speech
   * @param voiceId - ID of the voice to use
   * @param modelId - Optional model ID to use
   * @param onChunk - Callback function to handle audio chunks as they arrive
   * @param onComplete - Optional callback when synthesis is complete
   * @param onError - Optional callback for error handling
   * @returns Promise resolving when streaming starts
   */
  synthesizeStream?(
    text: string, 
    voiceId: string, 
    modelId?: string,
    onChunk?: (chunk: ArrayBuffer) => void,
    onComplete?: () => void,
    onError?: (error: Error) => void
  ): Promise<void>;

  /**
   * Get list of available voices
   * @returns Promise resolving to array of available voices
   */
  getAvailableVoices(): Promise<Voice[]>;

  /**
   * Clone a voice from audio samples
   * @param audioSamples - Array of audio samples for voice cloning
   * @param voiceName - Name for the cloned voice
   * @returns Promise resolving to the new voice ID
   */
  cloneVoice(audioSamples: ArrayBuffer[], voiceName: string): Promise<string>;

  /**
   * Get voice cloning status
   * @param voiceId - ID of the voice being cloned
   * @returns Promise resolving to cloning status
   */
  getVoiceCloningStatus(voiceId: string): Promise<VoiceCloningStatus>;

  /**
   * Set voice synthesis settings
   * @param settings - Voice synthesis configuration
   */
  setVoiceSettings(settings: VoiceSettings): void;

  /**
   * Check if the service is available and configured
   * @returns True if service is ready to use
   */
  isAvailable(): boolean;

  /**
   * Delete a cloned voice
   * @param voiceId - ID of the voice to delete
   * @returns Promise that resolves when voice is deleted
   */
  deleteVoice(voiceId: string): Promise<void>;
}

/**
 * Represents a voice profile
 */
export interface Voice {
  /** Unique voice identifier */
  id: string;
  /** Human-readable voice name */
  name: string;
  /** Whether this is a cloned voice */
  isCloned?: boolean;
  /** Language/accent of the voice */
  language?: string;
  /** Gender of the voice */
  gender?: 'male' | 'female' | 'neutral';
  /** Voice preview URL if available */
  previewUrl?: string;
  /** Provider of the voice */
  provider?: string;
}

/**
 * TTS synthesis result
 */
export interface TTSResult {
  /** Audio buffer containing the synthesized speech */
  audioBuffer: Buffer;
  /** Audio format */
  format: string;
  /** Sample rate in Hz */
  sampleRate: number;
  /** Number of audio channels */
  channels: number;
  /** Duration in seconds */
  duration: number;
  /** Provider used for synthesis */
  provider: string;
}

/**
 * Voice cloning status information
 */
export interface VoiceCloningStatus {
  /** Current status of the cloning process */
  status: 'pending' | 'processing' | 'completed' | 'failed';
  /** Progress percentage (0-100) */
  progress: number;
  /** Error message if cloning failed */
  error?: string;
  /** Estimated time remaining in seconds */
  estimatedTimeRemaining?: number;
}

/**
 * Voice synthesis settings
 */
export interface VoiceSettings {
  /** Stability setting (0-1) */
  stability?: number;
  /** Similarity boost (0-1) */
  similarityBoost?: number;
  /** Speaking rate multiplier */
  speed?: number;
  /** Audio quality setting */
  quality?: 'low' | 'medium' | 'high';
}