import { EventEmitter } from 'events';
import { AudioCaptureService as IAudioCaptureService, AudioSegment } from '../interfaces/AudioCaptureService';

export interface AudioCaptureConfig {
  sampleRate: number;
  channelCount: number;
  bufferSize: number;
  deviceId?: string;
}

export class AudioCaptureService extends EventEmitter implements IAudioCaptureService {
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private processorNode: ScriptProcessorNode | null = null;
  private isCapturing = false;
  private config: AudioCaptureConfig;
  private audioBuffer: Float32Array[] = [];
  private segmentCounter = 0;

  constructor(config: Partial<AudioCaptureConfig> = {}) {
    super();
    this.config = {
      sampleRate: 16000, // Optimal for speech recognition
      channelCount: 1,   // Mono audio
      bufferSize: 4096,  // Buffer size for processing
      ...config
    };
  }

  async startCapture(deviceId?: string): Promise<void> {
    if (this.isCapturing) {
      throw new Error('Audio capture is already active');
    }

    try {
      // Create audio context
      this.audioContext = new AudioContext({
        sampleRate: this.config.sampleRate
      });

      // Get media stream
      const constraints: MediaStreamConstraints = {
        audio: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          sampleRate: this.config.sampleRate,
          channelCount: this.config.channelCount,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      };

      this.mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      
      // Create audio nodes
      this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.processorNode = this.audioContext.createScriptProcessor(
        this.config.bufferSize,
        this.config.channelCount,
        this.config.channelCount
      );

      // Set up audio processing
      this.processorNode.onaudioprocess = (event) => {
        this.processAudioData(event);
      };

      // Connect nodes
      this.sourceNode.connect(this.processorNode);
      this.processorNode.connect(this.audioContext.destination);

      this.isCapturing = true;
      this.emit('captureStarted');
      
    } catch (error) {
      await this.cleanup();
      throw new Error(`Failed to start audio capture: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async stopCapture(): Promise<void> {
    if (!this.isCapturing) {
      return;
    }

    this.isCapturing = false;
    await this.cleanup();
    this.emit('captureStopped');
  }

  isActive(): boolean {
    return this.isCapturing;
  }

  getAudioContext(): AudioContext | null {
    return this.audioContext;
  }

  private processAudioData(event: AudioProcessingEvent): void {
    if (!this.isCapturing) return;

    const inputBuffer = event.inputBuffer;
    const channelData = inputBuffer.getChannelData(0); // Get mono channel
    
    // Convert to regular array for easier handling
    const audioData = new Float32Array(channelData);
    
    // Add to buffer
    this.audioBuffer.push(audioData);
    
    // Emit raw audio data event
    this.emit('audioData', {
      data: audioData,
      sampleRate: this.config.sampleRate,
      timestamp: Date.now()
    });

    // Check if we have enough data for a segment (e.g., 1 second of audio)
    const segmentSamples = this.config.sampleRate; // 1 second
    const totalSamples = this.audioBuffer.reduce((sum, buffer) => sum + buffer.length, 0);
    
    if (totalSamples >= segmentSamples) {
      this.createAudioSegment();
    }
  }

  private createAudioSegment(): void {
    if (this.audioBuffer.length === 0) return;

    // Combine all buffered audio data
    const totalLength = this.audioBuffer.reduce((sum, buffer) => sum + buffer.length, 0);
    const combinedBuffer = new Float32Array(totalLength);
    
    let offset = 0;
    for (const buffer of this.audioBuffer) {
      combinedBuffer.set(buffer, offset);
      offset += buffer.length;
    }

    // Create audio segment
    const segment: AudioSegment = {
      id: `segment_${++this.segmentCounter}`,
      data: combinedBuffer,
      sampleRate: this.config.sampleRate,
      channelCount: this.config.channelCount,
      duration: combinedBuffer.length / this.config.sampleRate,
      timestamp: Date.now()
    };

    // Clear buffer
    this.audioBuffer = [];

    // Emit segment
    this.emit('audioSegment', segment);
  }

  private async cleanup(): Promise<void> {
    // Disconnect audio nodes
    if (this.processorNode) {
      this.processorNode.disconnect();
      this.processorNode = null;
    }

    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }

    // Stop media stream
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }

    // Close audio context
    if (this.audioContext && this.audioContext.state !== 'closed') {
      await this.audioContext.close();
      this.audioContext = null;
    }

    // Clear buffer
    this.audioBuffer = [];
  }

  // Utility methods for audio format conversion
  convertToWav(audioData: Float32Array, sampleRate: number): ArrayBuffer {
    const length = audioData.length;
    const buffer = new ArrayBuffer(44 + length * 2);
    const view = new DataView(buffer);
    
    // WAV header
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + length * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, length * 2, true);

    // Convert float samples to 16-bit PCM
    let offset = 44;
    for (let i = 0; i < length; i++) {
      const sample = Math.max(-1, Math.min(1, audioData[i]));
      view.setInt16(offset, sample * 0x7FFF, true);
      offset += 2;
    }

    return buffer;
  }

  getConfig(): AudioCaptureConfig {
    return { ...this.config };
  }

  updateConfig(newConfig: Partial<AudioCaptureConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  dispose(): void {
    this.stopCapture();
    this.removeAllListeners();
  }
}