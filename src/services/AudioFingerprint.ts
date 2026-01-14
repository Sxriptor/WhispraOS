/**
 * Audio Fingerprinting Service
 * Generates fingerprints for audio segments to enable cache optimization
 */

import { AudioFormatConverter } from './AudioFormatConverter';

export interface AudioFingerprint {
  hash: string;
  duration: number;
  sampleRate: number;
  channels: number;
  features: {
    energy: number;
    zeroCrossingRate: number;
    spectralCentroid: number;
  };
}

export class AudioFingerprintService {
  /**
   * Generate a fingerprint for audio data
   */
  static async generateFingerprint(
    audioData: Float32Array,
    sampleRate: number
  ): Promise<AudioFingerprint> {
    // Calculate audio features
    const features = this.calculateFeatures(audioData, sampleRate);
    
    // Generate hash from features and audio characteristics
    const hash = this.generateHash(audioData, features, sampleRate);
    
    return {
      hash,
      duration: audioData.length / sampleRate,
      sampleRate,
      channels: 1, // Assuming mono
      features
    };
  }

  /**
   * Generate fingerprint from ArrayBuffer
   */
  static async generateFingerprintFromBuffer(
    audioBuffer: ArrayBuffer,
    sampleRate: number
  ): Promise<AudioFingerprint> {
    // Convert ArrayBuffer to Float32Array
    const audioData = new Float32Array(audioBuffer);
    return this.generateFingerprint(audioData, sampleRate);
  }

  /**
   * Calculate audio features for fingerprinting
   */
  private static calculateFeatures(
    audioData: Float32Array,
    sampleRate: number
  ): AudioFingerprint['features'] {
    // Energy (RMS)
    let energy = 0;
    for (let i = 0; i < audioData.length; i++) {
      energy += audioData[i] * audioData[i];
    }
    energy = Math.sqrt(energy / audioData.length);

    // Zero Crossing Rate
    let zeroCrossings = 0;
    for (let i = 1; i < audioData.length; i++) {
      if ((audioData[i - 1] >= 0 && audioData[i] < 0) ||
          (audioData[i - 1] < 0 && audioData[i] >= 0)) {
        zeroCrossings++;
      }
    }
    const zeroCrossingRate = zeroCrossings / audioData.length;

    // Spectral Centroid (simplified)
    const spectralCentroid = this.calculateSpectralCentroid(audioData, sampleRate);

    return {
      energy,
      zeroCrossingRate,
      spectralCentroid
    };
  }

  /**
   * Calculate spectral centroid (simplified FFT-based)
   */
  private static calculateSpectralCentroid(
    audioData: Float32Array,
    sampleRate: number
  ): number {
    // Use a simplified approach - sample key points
    const step = Math.max(1, Math.floor(audioData.length / 100));
    let weightedSum = 0;
    let magnitudeSum = 0;

    for (let i = 0; i < audioData.length; i += step) {
      const magnitude = Math.abs(audioData[i]);
      const frequency = (i / audioData.length) * sampleRate;
      weightedSum += frequency * magnitude;
      magnitudeSum += magnitude;
    }

    return magnitudeSum > 0 ? weightedSum / magnitudeSum : 0;
  }

  /**
   * Generate hash from audio data and features
   */
  private static generateHash(
    audioData: Float32Array,
    features: AudioFingerprint['features'],
    sampleRate: number
  ): string {
    // Create hash from features and sampled audio data
    let hash = 0;
    const step = Math.max(1, Math.floor(audioData.length / 200)); // Sample 200 points
    
    // Hash features
    hash = this.combineHash(hash, features.energy);
    hash = this.combineHash(hash, features.zeroCrossingRate);
    hash = this.combineHash(hash, features.spectralCentroid);
    hash = this.combineHash(hash, sampleRate);

    // Hash sampled audio data
    for (let i = 0; i < audioData.length; i += step) {
      const sample = Math.floor(audioData[i] * 10000);
      hash = this.combineHash(hash, sample);
    }

    return Math.abs(hash).toString(36);
  }

  /**
   * Combine hash values
   */
  private static combineHash(hash: number, value: number): number {
    return ((hash << 5) - hash + Math.floor(value * 1000)) & 0xffffffff;
  }

  /**
   * Compare two fingerprints for similarity
   */
  static compareFingerprints(
    fp1: AudioFingerprint,
    fp2: AudioFingerprint
  ): number {
    // Compare hash first (exact match)
    if (fp1.hash === fp2.hash) {
      return 1.0;
    }

    // Compare features (similarity score 0-1)
    const energyDiff = Math.abs(fp1.features.energy - fp2.features.energy);
    const zcrDiff = Math.abs(fp1.features.zeroCrossingRate - fp2.features.zeroCrossingRate);
    const centroidDiff = Math.abs(fp1.features.spectralCentroid - fp2.features.spectralCentroid);

    // Normalize differences
    const maxEnergy = Math.max(fp1.features.energy, fp2.features.energy, 0.001);
    const energySimilarity = 1 - Math.min(1, energyDiff / maxEnergy);
    
    const zcrSimilarity = 1 - Math.min(1, zcrDiff);
    
    const maxCentroid = Math.max(fp1.features.spectralCentroid, fp2.features.spectralCentroid, 1);
    const centroidSimilarity = 1 - Math.min(1, centroidDiff / maxCentroid);

    // Weighted average
    return (energySimilarity * 0.4 + zcrSimilarity * 0.3 + centroidSimilarity * 0.3);
  }
}

