/**
 * Service interface for outputting audio to virtual microphone devices
 */
export interface VirtualMicrophoneService {
  /**
   * Initialize the virtual microphone service
   * @returns Promise that resolves when service is ready
   */
  initialize(): Promise<void>;

  /**
   * Send audio data to the virtual microphone
   * @param audioBuffer - Audio data to send
   * @returns Promise that resolves when audio is sent
   */
  sendAudio(audioBuffer: ArrayBuffer): Promise<void>;

  /**
   * Check if virtual microphone is available
   * @returns True if virtual microphone is available
   */
  isAvailable(): boolean;

  /**
   * Get information about the virtual device
   * @returns Virtual device information
   */
  getDeviceInfo(): VirtualDeviceInfo;

  /**
   * Start the virtual microphone stream
   * @returns Promise that resolves when stream starts
   */
  startStream(): Promise<void>;

  /**
   * Stop the virtual microphone stream
   */
  stopStream(): void;

  /**
   * Check if the stream is currently active
   * @returns True if stream is active
   */
  isStreaming(): boolean;

  /**
   * Set audio format for the virtual microphone
   * @param format - Audio format configuration
   */
  setAudioFormat(format: AudioFormat): void;

  /**
   * Get current audio format
   * @returns Current audio format
   */
  getAudioFormat(): AudioFormat;
}

/**
 * Information about the virtual microphone device
 */
export interface VirtualDeviceInfo {
  /** Device name */
  name: string;
  /** Device ID if available */
  id?: string;
  /** Whether the device is currently connected */
  connected: boolean;
  /** Device status */
  status: 'ready' | 'busy' | 'error' | 'unavailable';
  /** Error message if status is 'error' */
  error?: string;
  /** Supported audio formats */
  supportedFormats: AudioFormat[];
}

/**
 * Audio format configuration
 */
export interface AudioFormat {
  /** Sample rate in Hz */
  sampleRate: number;
  /** Number of audio channels */
  channels: number;
  /** Bit depth */
  bitDepth: 16 | 24 | 32;
  /** Audio encoding format */
  encoding: 'pcm' | 'float';
}