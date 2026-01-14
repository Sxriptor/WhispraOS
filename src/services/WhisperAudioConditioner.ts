import { EventEmitter } from 'events';
import { AudioSegment } from '../interfaces/AudioCaptureService';

export interface AudioConditioningConfig {
  // Sample rate and format
  targetSampleRate: number;        // 16kHz for Whisper
  targetChannels: number;          // Mono for Whisper
  
  // Filtering
  highPassFreq: number;            // 80-100Hz to remove rumble
  lowPassFreq: number;             // 7-8kHz to cut hiss
  
  // Noise gate
  noiseGateThreshold: number;      // LUFS threshold for gate
  noiseGateAttack: number;         // Gate attack time (ms)
  noiseGateRelease: number;        // Gate release time (ms)
  
  // Level management
  targetLUFS: number;              // -16 to -12 LUFS target
  maxPeakLevel: number;            // Prevent clipping (-1 dBFS)
  
  // Chunk management
  minChunkDuration: number;        // Minimum chunk size (ms)
  maxChunkDuration: number;        // Maximum chunk size (ms)
  silenceThreshold: number;        // Silence detection threshold
  
  // VAD integration
  vadEnabled: boolean;             // Enable voice activity detection
  speechOnlyMode: boolean;         // Only send speech chunks to Whisper
}

export interface ConditionedAudio {
  audioData: Float32Array;
  sampleRate: number;
  channels: number;
  lufs: number;
  peakLevel: number;
  duration: number;
  containsSpeech: boolean;
  isClean: boolean;
  shouldSendToWhisper: boolean;
}

export class WhisperAudioConditioner extends EventEmitter {
  private config: AudioConditioningConfig;
  private audioBuffer: Float32Array[] = [];
  private bufferStartTime = 0;
  private noiseGateState = false;
  private gateEnvelope = 0;
  private recentLUFS: number[] = [];
  private readonly lufsHistorySize = 20;

  constructor(config: Partial<AudioConditioningConfig> = {}) {
    super();
    
    this.config = {
      // Whisper optimal settings
      targetSampleRate: 16000,       // Whisper's native sample rate
      targetChannels: 1,             // Mono
      
      // Professional filtering
      highPassFreq: 85,              // Remove rumble and low-freq noise
      lowPassFreq: 7500,             // Remove hiss and high-freq artifacts
      
      // Aggressive noise gate
      noiseGateThreshold: -45,       // LUFS threshold (quite aggressive)
      noiseGateAttack: 5,            // Fast attack (5ms)
      noiseGateRelease: 100,         // Moderate release (100ms)
      
      // Broadcast-quality levels
      targetLUFS: -14,               // Target loudness (-16 to -12 range)
      maxPeakLevel: -1,              // Prevent clipping
      
      // Optimal chunk sizes for Whisper
      minChunkDuration: 1000,        // 1 second minimum
      maxChunkDuration: 4000,        // 4 seconds maximum
      silenceThreshold: -50,         // LUFS for silence detection
      
      // Speech-only mode
      vadEnabled: true,
      speechOnlyMode: true,
      
      ...config
    };
  }

  async processAudioSegment(segment: AudioSegment): Promise<ConditionedAudio | null> {
    // Step 1: Resample to 16kHz mono if needed
    let processedAudio = this.resampleToTarget(segment.data, segment.sampleRate, segment.channelCount);
    
    // Step 2: Apply high-pass filter (remove rumble)
    processedAudio = this.applyHighPassFilter(processedAudio, this.config.targetSampleRate);
    
    // Step 3: Apply low-pass filter (remove hiss)
    processedAudio = this.applyLowPassFilter(processedAudio, this.config.targetSampleRate);
    
    // Step 4: Calculate LUFS and peak levels
    const lufs = this.calculateLUFS(processedAudio, this.config.targetSampleRate);
    const peakLevel = this.calculatePeakLevel(processedAudio);
    
    // Step 5: Apply noise gate
    const gatedAudio = this.applyNoiseGate(processedAudio, lufs);
    
    // Step 6: Normalize to target LUFS
    const normalizedAudio = this.normalizeToLUFS(gatedAudio, lufs);
    
    // Step 7: Prevent clipping
    const finalAudio = this.preventClipping(normalizedAudio);
    
    // Step 8: Add to buffer and check if we should emit a chunk
    this.addToBuffer(finalAudio, segment.timestamp);
    
    // Step 9: Check if we have a complete chunk ready
    return this.checkForCompleteChunk();
  }

  private resampleToTarget(data: Float32Array, sourceSampleRate: number, sourceChannels: number): Float32Array {
    let processed = data;
    
    // Convert to mono if needed
    if (sourceChannels > 1) {
      processed = this.convertToMono(processed, sourceChannels);
    }
    
    // Resample if needed
    if (sourceSampleRate !== this.config.targetSampleRate) {
      processed = this.resample(processed, sourceSampleRate, this.config.targetSampleRate);
    }
    
    return processed;
  }

  private convertToMono(data: Float32Array, channels: number): Float32Array {
    if (channels === 1) return data;
    
    const monoLength = Math.floor(data.length / channels);
    const mono = new Float32Array(monoLength);
    
    for (let i = 0; i < monoLength; i++) {
      let sum = 0;
      for (let ch = 0; ch < channels; ch++) {
        sum += data[i * channels + ch];
      }
      mono[i] = sum / channels;
    }
    
    return mono;
  }

  private resample(data: Float32Array, sourceRate: number, targetRate: number): Float32Array {
    if (sourceRate === targetRate) return data;
    
    const ratio = sourceRate / targetRate;
    const outputLength = Math.floor(data.length / ratio);
    const output = new Float32Array(outputLength);
    
    // High-quality resampling with anti-aliasing
    for (let i = 0; i < outputLength; i++) {
      const sourceIndex = i * ratio;
      const index = Math.floor(sourceIndex);
      const fraction = sourceIndex - index;
      
      const sample1 = data[index] || 0;
      const sample2 = data[index + 1] || sample1;
      
      // Linear interpolation
      output[i] = sample1 * (1 - fraction) + sample2 * fraction;
    }
    
    return output;
  }

  private applyHighPassFilter(data: Float32Array, sampleRate: number): Float32Array {
    const filtered = new Float32Array(data.length);
    const rc = 1.0 / (2 * Math.PI * this.config.highPassFreq);
    const dt = 1.0 / sampleRate;
    const alpha = rc / (rc + dt);
    
    filtered[0] = data[0];
    for (let i = 1; i < data.length; i++) {
      filtered[i] = alpha * (filtered[i - 1] + data[i] - data[i - 1]);
    }
    
    return filtered;
  }

  private applyLowPassFilter(data: Float32Array, sampleRate: number): Float32Array {
    const filtered = new Float32Array(data.length);
    const rc = 1.0 / (2 * Math.PI * this.config.lowPassFreq);
    const dt = 1.0 / sampleRate;
    const alpha = dt / (rc + dt);
    
    filtered[0] = data[0];
    for (let i = 1; i < data.length; i++) {
      filtered[i] = filtered[i - 1] + alpha * (data[i] - filtered[i - 1]);
    }
    
    return filtered;
  }

  private calculateLUFS(data: Float32Array, sampleRate: number): number {
    // Simplified LUFS calculation (EBU R128 approximation)
    // This is a basic implementation - for production, use a proper LUFS library
    
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      sum += data[i] * data[i];
    }
    
    const rms = Math.sqrt(sum / data.length);
    const lufs = -0.691 + 10 * Math.log10(rms + 1e-10); // Approximate LUFS conversion
    
    return lufs;
  }

  private calculatePeakLevel(data: Float32Array): number {
    let peak = 0;
    for (let i = 0; i < data.length; i++) {
      peak = Math.max(peak, Math.abs(data[i]));
    }
    return 20 * Math.log10(peak + 1e-10); // Convert to dBFS
  }

  private applyNoiseGate(data: Float32Array, lufs: number): Float32Array {
    const gated = new Float32Array(data.length);
    const attackCoeff = Math.exp(-1 / (this.config.noiseGateAttack * this.config.targetSampleRate / 1000));
    const releaseCoeff = Math.exp(-1 / (this.config.noiseGateRelease * this.config.targetSampleRate / 1000));
    
    for (let i = 0; i < data.length; i++) {
      // Determine if gate should be open
      const shouldOpen = lufs > this.config.noiseGateThreshold;
      
      // Update gate envelope
      if (shouldOpen && this.gateEnvelope < 1) {
        this.gateEnvelope += (1 - this.gateEnvelope) * (1 - attackCoeff);
      } else if (!shouldOpen && this.gateEnvelope > 0) {
        this.gateEnvelope *= releaseCoeff;
      }
      
      // Apply gate
      gated[i] = data[i] * this.gateEnvelope;
    }
    
    this.noiseGateState = this.gateEnvelope > 0.1;
    return gated;
  }

  private normalizeToLUFS(data: Float32Array, currentLUFS: number): Float32Array {
    if (currentLUFS <= this.config.silenceThreshold) {
      return data; // Don't normalize silence
    }
    
    const targetGain = this.config.targetLUFS - currentLUFS;
    const linearGain = Math.pow(10, targetGain / 20);
    
    // Limit gain to prevent excessive amplification
    const maxGain = 6; // 6dB max boost
    const limitedGain = Math.min(linearGain, Math.pow(10, maxGain / 20));
    
    const normalized = new Float32Array(data.length);
    for (let i = 0; i < data.length; i++) {
      normalized[i] = data[i] * limitedGain;
    }
    
    return normalized;
  }

  private preventClipping(data: Float32Array): Float32Array {
    const maxAllowed = Math.pow(10, this.config.maxPeakLevel / 20);
    let peak = 0;
    
    // Find peak
    for (let i = 0; i < data.length; i++) {
      peak = Math.max(peak, Math.abs(data[i]));
    }
    
    if (peak <= maxAllowed) {
      return data; // No clipping risk
    }
    
    // Apply soft limiting
    const ratio = maxAllowed / peak;
    const limited = new Float32Array(data.length);
    
    for (let i = 0; i < data.length; i++) {
      const sample = data[i] * ratio;
      // Soft limiting using tanh
      limited[i] = Math.tanh(sample * 0.9) * 0.95;
    }
    
    return limited;
  }

  private addToBuffer(data: Float32Array, timestamp: number): void {
    if (this.audioBuffer.length === 0) {
      this.bufferStartTime = timestamp;
    }
    
    this.audioBuffer.push(data);
  }

  private checkForCompleteChunk(): ConditionedAudio | null {
    if (this.audioBuffer.length === 0) return null;
    
    // Calculate total duration
    const totalSamples = this.audioBuffer.reduce((sum, chunk) => sum + chunk.length, 0);
    const duration = (totalSamples / this.config.targetSampleRate) * 1000; // ms
    
    // Check if we should emit a chunk
    const shouldEmit = 
      duration >= this.config.maxChunkDuration || // Max duration reached
      (duration >= this.config.minChunkDuration && !this.noiseGateState); // Min duration + silence
    
    if (!shouldEmit) return null;
    
    // Combine buffer into single array
    const combinedAudio = new Float32Array(totalSamples);
    let offset = 0;
    
    for (const chunk of this.audioBuffer) {
      combinedAudio.set(chunk, offset);
      offset += chunk.length;
    }
    
    // Analyze the combined audio
    const lufs = this.calculateLUFS(combinedAudio, this.config.targetSampleRate);
    const peakLevel = this.calculatePeakLevel(combinedAudio);
    const containsSpeech = this.detectSpeech(combinedAudio, lufs);
    const isClean = this.isAudioClean(combinedAudio, lufs, peakLevel);
    
    // Determine if this should go to Whisper
    const shouldSendToWhisper = this.shouldSendToWhisper(containsSpeech, isClean, lufs, duration);
    
    // Clear buffer
    this.audioBuffer = [];
    this.bufferStartTime = 0;
    
    const result: ConditionedAudio = {
      audioData: combinedAudio,
      sampleRate: this.config.targetSampleRate,
      channels: this.config.targetChannels,
      lufs,
      peakLevel,
      duration,
      containsSpeech,
      isClean,
      shouldSendToWhisper
    };
    
    // Emit events for monitoring
    if (shouldSendToWhisper) {
      this.emit('audioReadyForWhisper', result);
    } else {
      this.emit('audioRejected', {
        reason: this.getRejectReason(containsSpeech, isClean, lufs, duration),
        analysis: result
      });
    }
    
    return result;
  }

  private detectSpeech(data: Float32Array, lufs: number): boolean {
    if (!this.config.vadEnabled) return true;
    
    // Basic speech detection based on LUFS and spectral characteristics
    if (lufs <= this.config.silenceThreshold) return false;
    
    // Check for speech-like modulation
    const windowSize = Math.floor(this.config.targetSampleRate * 0.1); // 100ms windows
    const windows = Math.floor(data.length / windowSize);
    
    if (windows < 3) return lufs > this.config.noiseGateThreshold; // Too short, use gate threshold
    
    const windowEnergies: number[] = [];
    for (let i = 0; i < windows; i++) {
      let energy = 0;
      const start = i * windowSize;
      const end = Math.min(start + windowSize, data.length);
      
      for (let j = start; j < end; j++) {
        energy += data[j] * data[j];
      }
      
      windowEnergies.push(energy / (end - start));
    }
    
    // Calculate modulation (variation in energy)
    const meanEnergy = windowEnergies.reduce((sum, e) => sum + e, 0) / windowEnergies.length;
    const variance = windowEnergies.reduce((sum, e) => sum + Math.pow(e - meanEnergy, 2), 0) / windowEnergies.length;
    const modulation = meanEnergy > 0 ? Math.sqrt(variance) / meanEnergy : 0;
    
    // Speech typically has modulation between 0.1 and 0.8
    return modulation > 0.05 && modulation < 1.0;
  }

  private isAudioClean(data: Float32Array, lufs: number, peakLevel: number): boolean {
    // Check for clipping
    if (peakLevel > -0.1) return false; // Too close to clipping
    
    // Check for extreme silence
    if (lufs < -60) return false; // Too quiet
    
    // Check for reasonable level
    if (lufs > -6) return false; // Too loud
    
    // Check for DC offset
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      sum += data[i];
    }
    const dcOffset = Math.abs(sum / data.length);
    if (dcOffset > 0.01) return false; // Significant DC offset
    
    return true;
  }

  private shouldSendToWhisper(containsSpeech: boolean, isClean: boolean, lufs: number, duration: number): boolean {
    // Must be clean audio
    if (!isClean) return false;
    
    // Must be within duration limits
    if (duration < this.config.minChunkDuration || duration > this.config.maxChunkDuration) return false;
    
    // Must be above silence threshold
    if (lufs <= this.config.silenceThreshold) return false;
    
    // If speech-only mode is enabled, must contain speech
    if (this.config.speechOnlyMode && !containsSpeech) return false;
    
    return true;
  }

  private getRejectReason(containsSpeech: boolean, isClean: boolean, lufs: number, duration: number): string {
    if (!isClean) return 'Audio quality issues (clipping, DC offset, or extreme levels)';
    if (lufs <= this.config.silenceThreshold) return 'Below silence threshold';
    if (duration < this.config.minChunkDuration) return 'Too short';
    if (duration > this.config.maxChunkDuration) return 'Too long';
    if (this.config.speechOnlyMode && !containsSpeech) return 'No speech detected';
    return 'Unknown reason';
  }

  updateConfig(newConfig: Partial<AudioConditioningConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.emit('configUpdated', this.config);
  }

  getConfig(): AudioConditioningConfig {
    return { ...this.config };
  }

  getStats(): {
    bufferLength: number;
    gateState: boolean;
    recentLUFS: number[];
  } {
    return {
      bufferLength: this.audioBuffer.length,
      gateState: this.noiseGateState,
      recentLUFS: [...this.recentLUFS]
    };
  }

  reset(): void {
    this.audioBuffer = [];
    this.bufferStartTime = 0;
    this.noiseGateState = false;
    this.gateEnvelope = 0;
    this.recentLUFS = [];
  }

  dispose(): void {
    this.reset();
    this.removeAllListeners();
  }
}

export default WhisperAudioConditioner;