import { EventEmitter } from 'events';
import { AudioSegment } from '../interfaces/AudioCaptureService';

export interface VoiceActivityConfig {
  volumeThreshold: number;
  silenceThreshold: number;
  minSpeechDuration: number;
  minSilenceDuration: number;
  energyThreshold: number;
  zeroCrossingThreshold: number;
  // Enhanced detection parameters
  adaptiveThreshold: boolean;
  noiseFloorEstimation: boolean;
  spectralCentroidThreshold: number;
  highFreqNoiseReduction: boolean;
  lowVolumeBoost: number;
}

export interface VoiceActivity {
  isVoiceActive: boolean;
  confidence: number;
  volume: number;
  energy: number;
  zeroCrossingRate: number;
  spectralCentroid: number;
  noiseFloor: number;
  snr: number; // Signal-to-noise ratio
  timestamp: number;
}

export class VoiceActivityDetector extends EventEmitter {
  private config: VoiceActivityConfig;
  private isVoiceActive = false;
  private speechStartTime = 0;
  private silenceStartTime = 0;
  private recentActivity: VoiceActivity[] = [];
  private readonly activityHistorySize = 20;
  
  // Enhanced detection state
  private noiseFloor = 0.001;
  private adaptiveVolumeThreshold = 0.01;
  private noiseHistory: number[] = [];
  private readonly noiseHistorySize = 50;

  constructor(config: Partial<VoiceActivityConfig> = {}) {
    super();
    this.config = {
      volumeThreshold: 0.005,           // Lower threshold for quiet voices
      silenceThreshold: 0.002,          // Lower silence threshold
      minSpeechDuration: 200,           // Shorter minimum speech duration
      minSilenceDuration: 300,          // Shorter silence duration for responsiveness
      energyThreshold: 0.0005,          // Lower energy threshold
      zeroCrossingThreshold: 0.05,      // Lower ZCR threshold
      // Enhanced parameters
      adaptiveThreshold: true,          // Enable adaptive thresholding
      noiseFloorEstimation: true,       // Enable noise floor estimation
      spectralCentroidThreshold: 1000,  // Hz - typical voice range
      highFreqNoiseReduction: true,     // Filter high-frequency noise
      lowVolumeBoost: 2.0,             // Boost factor for low volumes
      ...config
    };
  }

  analyzeSegment(segment: AudioSegment): VoiceActivity {
    // Preprocess audio for better detection
    const processedData = this.preprocessAudio(segment.data);
    
    const volume = this.calculateVolume(processedData);
    const energy = this.calculateEnergy(processedData);
    const zeroCrossingRate = this.calculateZeroCrossingRate(processedData);
    const spectralCentroid = this.calculateSpectralCentroid(processedData, segment.sampleRate);
    
    // Update noise floor estimation
    if (this.config.noiseFloorEstimation) {
      this.updateNoiseFloor(volume);
    }
    
    // Calculate adaptive threshold
    if (this.config.adaptiveThreshold) {
      this.updateAdaptiveThreshold();
    }
    
    // Calculate signal-to-noise ratio
    const snr = this.noiseFloor > 0 ? volume / this.noiseFloor : volume / 0.001;
    
    // Determine if voice is active based on multiple enhanced features
    const isVoiceActive = this.detectVoiceActivity(volume, energy, zeroCrossingRate, spectralCentroid, snr);
    
    // Calculate confidence based on how well the signal matches voice characteristics
    const confidence = this.calculateConfidence(volume, energy, zeroCrossingRate, spectralCentroid, snr);

    const activity: VoiceActivity = {
      isVoiceActive,
      confidence,
      volume,
      energy,
      zeroCrossingRate,
      spectralCentroid,
      noiseFloor: this.noiseFloor,
      snr,
      timestamp: segment.timestamp
    };

    // Update activity history
    this.updateActivityHistory(activity);
    
    // Process state changes
    this.processStateChange(activity, segment);

    return activity;
  }

  private preprocessAudio(data: Float32Array): Float32Array {
    const processed = new Float32Array(data.length);
    processed.set(data);
    
    // Apply low-volume boost for quiet voices
    if (this.config.lowVolumeBoost > 1.0) {
      const avgVolume = this.calculateVolume(processed);
      if (avgVolume < this.config.volumeThreshold * 2) {
        const boost = Math.min(this.config.lowVolumeBoost, 1.0 / Math.max(avgVolume, 0.001));
        for (let i = 0; i < processed.length; i++) {
          processed[i] *= boost;
        }
      }
    }
    
    // High-frequency noise reduction
    if (this.config.highFreqNoiseReduction) {
      return this.applyHighFreqFilter(processed);
    }
    
    return processed;
  }

  private applyHighFreqFilter(data: Float32Array): Float32Array {
    // Simple high-frequency noise reduction using moving average
    const filtered = new Float32Array(data.length);
    const windowSize = 3;
    
    for (let i = 0; i < data.length; i++) {
      let sum = 0;
      let count = 0;
      
      for (let j = Math.max(0, i - windowSize); j <= Math.min(data.length - 1, i + windowSize); j++) {
        sum += data[j];
        count++;
      }
      
      filtered[i] = sum / count;
    }
    
    return filtered;
  }

  private updateNoiseFloor(volume: number): void {
    this.noiseHistory.push(volume);
    if (this.noiseHistory.length > this.noiseHistorySize) {
      this.noiseHistory.shift();
    }
    
    // Use 25th percentile as noise floor estimate
    if (this.noiseHistory.length >= 10) {
      const sorted = [...this.noiseHistory].sort((a, b) => a - b);
      const index = Math.floor(sorted.length * 0.25);
      this.noiseFloor = Math.max(0.0001, sorted[index]);
    }
  }

  private updateAdaptiveThreshold(): void {
    // Adjust volume threshold based on recent noise floor
    this.adaptiveVolumeThreshold = Math.max(
      this.config.volumeThreshold,
      this.noiseFloor * 3.0 // Threshold should be at least 3x noise floor
    );
  }

  private calculateSpectralCentroid(data: Float32Array, sampleRate: number): number {
    // Simple spectral centroid calculation using FFT approximation
    // This helps distinguish voice (lower centroid) from high-pitch noise (higher centroid)
    
    const fftSize = Math.min(1024, data.length);
    const halfSize = fftSize / 2;
    
    // Simple magnitude spectrum calculation
    let weightedSum = 0;
    let magnitudeSum = 0;
    
    for (let i = 1; i < halfSize; i++) {
      const frequency = (i * sampleRate) / fftSize;
      const magnitude = Math.abs(data[i] || 0);
      
      weightedSum += frequency * magnitude;
      magnitudeSum += magnitude;
    }
    
    return magnitudeSum > 0 ? weightedSum / magnitudeSum : 0;
  }
  private calculateVolume(data: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      sum += Math.abs(data[i]);
    }
    return sum / data.length;
  }

  private calculateEnergy(data: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      sum += data[i] * data[i];
    }
    return sum / data.length;
  }

  private calculateZeroCrossingRate(data: Float32Array): number {
    let crossings = 0;
    for (let i = 1; i < data.length; i++) {
      if ((data[i] >= 0) !== (data[i - 1] >= 0)) {
        crossings++;
      }
    }
    return crossings / data.length;
  }

  private detectVoiceActivity(
    volume: number, 
    energy: number, 
    zeroCrossingRate: number, 
    spectralCentroid: number, 
    snr: number
  ): boolean {
    // Use adaptive threshold if enabled
    const volumeThreshold = this.config.adaptiveThreshold 
      ? this.adaptiveVolumeThreshold 
      : this.config.volumeThreshold;
    
    // Primary check: volume above adaptive threshold
    const volumeCheck = volume > volumeThreshold;
    
    // Secondary check: energy above threshold
    const energyCheck = energy > this.config.energyThreshold;
    
    // Tertiary check: zero crossing rate indicates speech-like signal
    const zcrCheck = zeroCrossingRate > this.config.zeroCrossingThreshold && zeroCrossingRate < 0.5;
    
    // Quaternary check: spectral centroid in voice range (not high-pitch noise)
    const spectralCheck = spectralCentroid > 200 && spectralCentroid < this.config.spectralCentroidThreshold;
    
    // Quinary check: good signal-to-noise ratio
    const snrCheck = snr > 2.0; // Signal should be at least 2x noise floor
    
    // Voice is active if at least 3 out of 5 checks pass, with volume being mandatory
    const checks = [energyCheck, zcrCheck, spectralCheck, snrCheck].filter(Boolean).length;
    return volumeCheck && checks >= 2;
  }

  private calculateConfidence(
    volume: number, 
    energy: number, 
    zeroCrossingRate: number, 
    spectralCentroid: number, 
    snr: number
  ): number {
    let confidence = 0;
    
    // Volume confidence (0-0.3) - use adaptive threshold
    const volumeThreshold = this.config.adaptiveThreshold 
      ? this.adaptiveVolumeThreshold 
      : this.config.volumeThreshold;
    
    if (volume > volumeThreshold) {
      confidence += Math.min(0.3, (volume / volumeThreshold) * 0.15);
    }
    
    // Energy confidence (0-0.2)
    if (energy > this.config.energyThreshold) {
      confidence += Math.min(0.2, (energy / this.config.energyThreshold) * 0.1);
    }
    
    // Zero crossing rate confidence (0-0.2)
    if (zeroCrossingRate > this.config.zeroCrossingThreshold && zeroCrossingRate < 0.5) {
      const optimal = 0.15; // Optimal ZCR for speech
      const deviation = Math.abs(zeroCrossingRate - optimal);
      confidence += Math.max(0, 0.2 - deviation * 4);
    }
    
    // Spectral centroid confidence (0-0.15) - prefer voice-like frequencies
    if (spectralCentroid > 200 && spectralCentroid < this.config.spectralCentroidThreshold) {
      const optimal = 500; // Optimal centroid for voice
      const deviation = Math.abs(spectralCentroid - optimal) / optimal;
      confidence += Math.max(0, 0.15 - deviation * 0.15);
    }
    
    // SNR confidence (0-0.15)
    if (snr > 1.0) {
      confidence += Math.min(0.15, Math.log10(snr) * 0.1);
    }
    
    return Math.min(1, confidence);
  }

  private updateActivityHistory(activity: VoiceActivity): void {
    this.recentActivity.push(activity);
    if (this.recentActivity.length > this.activityHistorySize) {
      this.recentActivity.shift();
    }
  }

  private processStateChange(activity: VoiceActivity, segment: AudioSegment): void {
    const now = segment.timestamp;
    const wasVoiceActive = this.isVoiceActive;
    
    if (activity.isVoiceActive && !wasVoiceActive) {
      // Potential start of speech
      if (this.speechStartTime === 0) {
        this.speechStartTime = now;
      }
      
      // Check if we've had enough continuous speech
      if (now - this.speechStartTime >= this.config.minSpeechDuration) {
        this.isVoiceActive = true;
        this.silenceStartTime = 0;
        this.emit('voiceStarted', {
          timestamp: now,
          confidence: activity.confidence,
          segment
        });
      }
    } else if (!activity.isVoiceActive && wasVoiceActive) {
      // Potential end of speech
      if (this.silenceStartTime === 0) {
        this.silenceStartTime = now;
      }
      
      // Check if we've had enough continuous silence
      if (now - this.silenceStartTime >= this.config.minSilenceDuration) {
        this.isVoiceActive = false;
        this.speechStartTime = 0;
        this.emit('voiceEnded', {
          timestamp: now,
          confidence: activity.confidence,
          segment
        });
      }
    } else if (activity.isVoiceActive && wasVoiceActive) {
      // Continuing speech - reset silence timer
      this.silenceStartTime = 0;
    } else if (!activity.isVoiceActive && !wasVoiceActive) {
      // Continuing silence - reset speech timer
      this.speechStartTime = 0;
    }

    // Emit activity update
    this.emit('activityUpdate', activity);
  }

  getCurrentState(): {
    isVoiceActive: boolean;
    speechDuration: number;
    silenceDuration: number;
    averageConfidence: number;
  } {
    const now = Date.now();
    const speechDuration = this.speechStartTime > 0 ? now - this.speechStartTime : 0;
    const silenceDuration = this.silenceStartTime > 0 ? now - this.silenceStartTime : 0;
    
    const averageConfidence = this.recentActivity.length > 0
      ? this.recentActivity.reduce((sum, activity) => sum + activity.confidence, 0) / this.recentActivity.length
      : 0;

    return {
      isVoiceActive: this.isVoiceActive,
      speechDuration,
      silenceDuration,
      averageConfidence
    };
  }

  updateConfig(newConfig: Partial<VoiceActivityConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  getConfig(): VoiceActivityConfig {
    return { ...this.config };
  }

  reset(): void {
    this.isVoiceActive = false;
    this.speechStartTime = 0;
    this.silenceStartTime = 0;
    this.recentActivity = [];
  }

  dispose(): void {
    this.reset();
    this.removeAllListeners();
  }
}