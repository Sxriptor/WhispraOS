import { EventEmitter } from 'events';
import { AudioSegment } from '../interfaces/AudioCaptureService';

export interface ProcessingStage {
  name: string;
  process(segment: AudioSegment): Promise<AudioSegment>;
}

export interface PipelineConfig {
  enableNoiseReduction: boolean;
  enableVolumeNormalization: boolean;
  enableHighPassFilter: boolean;
  enableLowPassFilter: boolean;
  enableDynamicRangeCompression: boolean;
  highPassFrequency: number;
  lowPassFrequency: number;
  volumeThreshold: number;
  compressionRatio: number;
  noiseGateThreshold: number;
}

export class AudioProcessingPipeline extends EventEmitter {
  private stages: ProcessingStage[] = [];
  private config: PipelineConfig;
  private audioContext: AudioContext | null = null;

  constructor(config: Partial<PipelineConfig> = {}) {
    super();
    this.config = {
      enableNoiseReduction: true,
      enableVolumeNormalization: true,
      enableHighPassFilter: true,
      enableLowPassFilter: true,           // Add low-pass filter for high-freq noise
      enableDynamicRangeCompression: true, // Add compression for low volumes
      highPassFrequency: 80,               // Remove low-frequency noise
      lowPassFrequency: 8000,              // Remove high-frequency noise above voice range
      volumeThreshold: 0.005,              // Lower threshold for quiet voices
      compressionRatio: 3.0,               // Compression ratio for dynamic range
      noiseGateThreshold: 0.002,           // Noise gate threshold
      ...config
    };

    this.initializeStages();
  }

  private initializeStages(): void {
    this.stages = [];

    // First stage: Noise gate to remove very low-level noise
    if (this.config.noiseGateThreshold > 0) {
      this.stages.push(new NoiseGateStage(this.config.noiseGateThreshold));
    }

    // Second stage: High-pass filter to remove low-frequency noise
    if (this.config.enableHighPassFilter) {
      this.stages.push(new HighPassFilterStage(this.config.highPassFrequency));
    }

    // Third stage: Low-pass filter to remove high-frequency noise
    if (this.config.enableLowPassFilter) {
      this.stages.push(new LowPassFilterStage(this.config.lowPassFrequency));
    }

    // Fourth stage: Dynamic range compression for low volumes
    if (this.config.enableDynamicRangeCompression) {
      this.stages.push(new DynamicRangeCompressionStage(this.config.compressionRatio));
    }

    // Fifth stage: Noise reduction
    if (this.config.enableNoiseReduction) {
      this.stages.push(new EnhancedNoiseReductionStage());
    }

    // Final stage: Volume normalization
    if (this.config.enableVolumeNormalization) {
      this.stages.push(new VolumeNormalizationStage());
    }
  }

  async processSegment(segment: AudioSegment): Promise<AudioSegment> {
    let processedSegment = segment;

    try {
      // Process through each stage
      for (const stage of this.stages) {
        this.emit('stageStarted', stage.name, processedSegment.id);
        processedSegment = await stage.process(processedSegment);
        this.emit('stageCompleted', stage.name, processedSegment.id);
      }

      this.emit('processingCompleted', processedSegment);
      return processedSegment;
    } catch (error) {
      this.emit('processingError', error, segment.id);
      throw error;
    }
  }

  updateConfig(newConfig: Partial<PipelineConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.initializeStages();
  }

  getConfig(): PipelineConfig {
    return { ...this.config };
  }

  dispose(): void {
    this.removeAllListeners();
  }
}

// High-pass filter to remove low-frequency noise
class HighPassFilterStage implements ProcessingStage {
  name = 'HighPassFilter';
  private cutoffFrequency: number;

  constructor(cutoffFrequency: number) {
    this.cutoffFrequency = cutoffFrequency;
  }

  async process(segment: AudioSegment): Promise<AudioSegment> {
    const filteredData = this.applyHighPassFilter(segment.data, segment.sampleRate);
    
    return {
      ...segment,
      data: filteredData
    };
  }

  private applyHighPassFilter(data: Float32Array, sampleRate: number): Float32Array {
    const filtered = new Float32Array(data.length);
    const rc = 1.0 / (2 * Math.PI * this.cutoffFrequency);
    const dt = 1.0 / sampleRate;
    const alpha = rc / (rc + dt);

    filtered[0] = data[0];
    for (let i = 1; i < data.length; i++) {
      filtered[i] = alpha * (filtered[i - 1] + data[i] - data[i - 1]);
    }

    return filtered;
  }
}

// Noise gate to remove very low-level noise
class NoiseGateStage implements ProcessingStage {
  name = 'NoiseGate';
  private threshold: number;

  constructor(threshold: number) {
    this.threshold = threshold;
  }

  async process(segment: AudioSegment): Promise<AudioSegment> {
    const gatedData = new Float32Array(segment.data.length);
    
    for (let i = 0; i < segment.data.length; i++) {
      const amplitude = Math.abs(segment.data[i]);
      if (amplitude > this.threshold) {
        gatedData[i] = segment.data[i];
      } else {
        gatedData[i] = 0; // Gate the signal
      }
    }
    
    return {
      ...segment,
      data: gatedData
    };
  }
}

// Low-pass filter to remove high-frequency noise
class LowPassFilterStage implements ProcessingStage {
  name = 'LowPassFilter';
  private cutoffFrequency: number;

  constructor(cutoffFrequency: number) {
    this.cutoffFrequency = cutoffFrequency;
  }

  async process(segment: AudioSegment): Promise<AudioSegment> {
    const filteredData = this.applyLowPassFilter(segment.data, segment.sampleRate);
    
    return {
      ...segment,
      data: filteredData
    };
  }

  private applyLowPassFilter(data: Float32Array, sampleRate: number): Float32Array {
    const filtered = new Float32Array(data.length);
    const rc = 1.0 / (2 * Math.PI * this.cutoffFrequency);
    const dt = 1.0 / sampleRate;
    const alpha = dt / (rc + dt);

    filtered[0] = data[0];
    for (let i = 1; i < data.length; i++) {
      filtered[i] = filtered[i - 1] + alpha * (data[i] - filtered[i - 1]);
    }

    return filtered;
  }
}

// Dynamic range compression to boost low volumes
class DynamicRangeCompressionStage implements ProcessingStage {
  name = 'DynamicRangeCompression';
  private ratio: number;
  private threshold = 0.1;

  constructor(ratio: number) {
    this.ratio = ratio;
  }

  async process(segment: AudioSegment): Promise<AudioSegment> {
    const compressed = new Float32Array(segment.data.length);
    
    for (let i = 0; i < segment.data.length; i++) {
      const amplitude = Math.abs(segment.data[i]);
      const sign = segment.data[i] >= 0 ? 1 : -1;
      
      if (amplitude > this.threshold) {
        // Apply compression above threshold
        const excess = amplitude - this.threshold;
        const compressedExcess = excess / this.ratio;
        compressed[i] = sign * (this.threshold + compressedExcess);
      } else {
        // Boost signals below threshold
        const boost = Math.min(2.0, this.threshold / Math.max(amplitude, 0.001));
        compressed[i] = segment.data[i] * boost;
      }
    }
    
    return {
      ...segment,
      data: compressed
    };
  }
}

// Enhanced noise reduction with better voice preservation
class EnhancedNoiseReductionStage implements ProcessingStage {
  name = 'EnhancedNoiseReduction';
  private noiseProfile: Float32Array | null = null;
  private isLearningNoise = true;
  private noiseSamples = 0;
  private readonly noiseLearningDuration = 4000; // Learn noise for first 0.25 seconds
  private voiceFreqBands: number[] = []; // Track voice-like frequency bands

  async process(segment: AudioSegment): Promise<AudioSegment> {
    // Learn noise profile from initial quiet segments
    if (this.isLearningNoise && this.noiseSamples < this.noiseLearningDuration) {
      this.updateNoiseProfile(segment.data);
      this.noiseSamples += segment.data.length;
      
      if (this.noiseSamples >= this.noiseLearningDuration) {
        this.isLearningNoise = false;
        console.log('[VAD] Noise learning complete, noise floor:', this.getAverageNoiseLevel());
      }
      
      return segment; // Return original during noise learning
    }

    // Apply enhanced noise reduction
    if (this.noiseProfile) {
      const reducedData = this.enhancedNoiseReduction(segment.data);
      return {
        ...segment,
        data: reducedData
      };
    }

    return segment;
  }

  private updateNoiseProfile(data: Float32Array): void {
    if (!this.noiseProfile) {
      this.noiseProfile = new Float32Array(Math.min(512, data.length));
    }

    // Only update noise profile if signal is quiet (likely noise)
    const rms = this.calculateRMS(data);
    if (rms < 0.01) { // Only learn from quiet segments
      for (let i = 0; i < Math.min(data.length, this.noiseProfile.length); i++) {
        this.noiseProfile[i] = (this.noiseProfile[i] * 0.9) + (Math.abs(data[i]) * 0.1);
      }
    }
  }

  private enhancedNoiseReduction(data: Float32Array): Float32Array {
    if (!this.noiseProfile) return data;

    const reduced = new Float32Array(data.length);
    const spectralSubtractionFactor = 2.0; // More aggressive noise reduction
    
    for (let i = 0; i < data.length; i++) {
      const noiseLevel = this.noiseProfile[i % this.noiseProfile.length];
      const signalLevel = Math.abs(data[i]);
      
      // Calculate spectral subtraction
      const noisySignal = signalLevel;
      const estimatedNoise = noiseLevel * spectralSubtractionFactor;
      const cleanSignal = Math.max(0.1 * noisySignal, noisySignal - estimatedNoise);
      
      // Preserve sign and apply reduction
      const reductionFactor = cleanSignal / Math.max(noisySignal, 0.001);
      reduced[i] = data[i] * reductionFactor;
    }

    return reduced;
  }

  private calculateRMS(data: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      sum += data[i] * data[i];
    }
    return Math.sqrt(sum / data.length);
  }

  private getAverageNoiseLevel(): number {
    if (!this.noiseProfile) return 0;
    let sum = 0;
    for (let i = 0; i < this.noiseProfile.length; i++) {
      sum += this.noiseProfile[i];
    }
    return sum / this.noiseProfile.length;
  }
}

// Volume normalization to ensure consistent levels while preserving dynamics
class VolumeNormalizationStage implements ProcessingStage {
  name = 'VolumeNormalization';
  private targetRMS = 0.15; // Higher target for better voice detection
  private maxGain = 4.0;    // Maximum gain to prevent over-amplification

  async process(segment: AudioSegment): Promise<AudioSegment> {
    const normalizedData = this.normalizeVolume(segment.data);
    
    return {
      ...segment,
      data: normalizedData
    };
  }

  private normalizeVolume(data: Float32Array): Float32Array {
    // Calculate RMS
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      sum += data[i] * data[i];
    }
    const rms = Math.sqrt(sum / data.length);

    // Avoid division by zero and very quiet signals
    if (rms < 0.001) {
      return data;
    }

    // Calculate gain with limiting
    let gain = this.targetRMS / rms;
    gain = Math.min(gain, this.maxGain); // Limit maximum gain
    
    // Apply gain with soft limiting to prevent clipping
    const normalized = new Float32Array(data.length);
    for (let i = 0; i < data.length; i++) {
      let sample = data[i] * gain;
      
      // Soft limiting using tanh function
      if (Math.abs(sample) > 0.8) {
        sample = Math.sign(sample) * Math.tanh(Math.abs(sample));
      }
      
      normalized[i] = Math.max(-1, Math.min(1, sample));
    }

    return normalized;
  }
}