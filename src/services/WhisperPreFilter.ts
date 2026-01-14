import { EventEmitter } from 'events';
import { AudioSegment } from '../interfaces/AudioCaptureService';

export interface WhisperPreFilterConfig {
  // Voice characteristics validation
  minVoiceLikelihood: number;        // Minimum likelihood that audio contains speech
  maxNoiseRatio: number;             // Maximum acceptable noise-to-signal ratio
  minSpeechDuration: number;         // Minimum duration to consider as speech
  
  // Frequency analysis
  voiceFreqMin: number;              // Minimum voice frequency (Hz)
  voiceFreqMax: number;              // Maximum voice frequency (Hz)
  harmonicThreshold: number;         // Minimum harmonic content for voice
  
  // Temporal analysis
  minModulationDepth: number;        // Minimum amplitude modulation (speech characteristic)
  maxZeroCrossingRate: number;       // Maximum zero-crossing rate (filters out noise)
  
  // Confidence thresholds
  minConfidenceToSend: number;       // Minimum confidence to send to Whisper
  blockPureNoise: boolean;           // Block audio that's clearly just noise
}

export interface AudioAnalysis {
  isVoiceLike: boolean;
  confidence: number;
  noiseRatio: number;
  dominantFrequency: number;
  harmonicContent: number;
  modulationDepth: number;
  zeroCrossingRate: number;
  spectralFlatness: number;          // Measure of how noise-like the signal is
  shouldSendToWhisper: boolean;
}

export class WhisperPreFilter extends EventEmitter {
  private config: WhisperPreFilterConfig;
  private recentAnalyses: AudioAnalysis[] = [];
  private readonly analysisHistorySize = 10;

  constructor(config: Partial<WhisperPreFilterConfig> = {}) {
    super();
    this.config = {
      minVoiceLikelihood: 0.6,         // 60% confidence required
      maxNoiseRatio: 0.7,              // Max 70% noise
      minSpeechDuration: 300,          // 300ms minimum
      
      voiceFreqMin: 80,                // Human voice starts around 80Hz
      voiceFreqMax: 3400,              // Human voice rarely goes above 3.4kHz
      harmonicThreshold: 0.3,          // Minimum harmonic structure
      
      minModulationDepth: 0.1,         // Speech has amplitude variation
      maxZeroCrossingRate: 0.3,        // Too many zero crossings = noise
      
      minConfidenceToSend: 0.7,        // 70% confidence to send to Whisper
      blockPureNoise: true,            // Block obvious noise
      ...config
    };
  }

  analyzeAudio(segment: AudioSegment): AudioAnalysis {
    const data = segment.data;
    const sampleRate = segment.sampleRate;

    // Perform comprehensive audio analysis
    const dominantFrequency = this.findDominantFrequency(data, sampleRate);
    const harmonicContent = this.calculateHarmonicContent(data, sampleRate);
    const modulationDepth = this.calculateModulationDepth(data);
    const zeroCrossingRate = this.calculateZeroCrossingRate(data);
    const spectralFlatness = this.calculateSpectralFlatness(data);
    const noiseRatio = this.estimateNoiseRatio(data);

    // Determine if this looks like voice
    const isVoiceLike = this.isVoiceLikeSignal(
      dominantFrequency,
      harmonicContent,
      modulationDepth,
      zeroCrossingRate,
      spectralFlatness,
      noiseRatio
    );

    // Calculate overall confidence
    const confidence = this.calculateVoiceConfidence(
      dominantFrequency,
      harmonicContent,
      modulationDepth,
      zeroCrossingRate,
      spectralFlatness,
      noiseRatio
    );

    // Decide whether to send to Whisper
    const shouldSendToWhisper = this.shouldSendToWhisper(
      isVoiceLike,
      confidence,
      noiseRatio,
      segment.timestamp
    );

    const analysis: AudioAnalysis = {
      isVoiceLike,
      confidence,
      noiseRatio,
      dominantFrequency,
      harmonicContent,
      modulationDepth,
      zeroCrossingRate,
      spectralFlatness,
      shouldSendToWhisper
    };

    // Update history
    this.updateAnalysisHistory(analysis);

    // Emit events for debugging
    this.emit('audioAnalyzed', analysis);
    
    if (!shouldSendToWhisper) {
      this.emit('audioBlocked', {
        reason: this.getBlockReason(analysis),
        analysis
      });
    }

    return analysis;
  }

  private findDominantFrequency(data: Float32Array, sampleRate: number): number {
    // Simple frequency analysis using autocorrelation
    const maxLag = Math.min(Math.floor(sampleRate / 50), data.length / 2); // 50Hz minimum
    let maxCorrelation = 0;
    let bestLag = 0;

    for (let lag = Math.floor(sampleRate / 800); lag < maxLag; lag++) { // 800Hz maximum
      let correlation = 0;
      let count = 0;

      for (let i = 0; i < data.length - lag; i++) {
        correlation += data[i] * data[i + lag];
        count++;
      }

      correlation /= count;
      if (correlation > maxCorrelation) {
        maxCorrelation = correlation;
        bestLag = lag;
      }
    }

    return bestLag > 0 ? sampleRate / bestLag : 0;
  }

  private calculateHarmonicContent(data: Float32Array, sampleRate: number): number {
    // Measure how much harmonic structure exists (voice has harmonics, noise doesn't)
    const fundamental = this.findDominantFrequency(data, sampleRate);
    if (fundamental < this.config.voiceFreqMin || fundamental > this.config.voiceFreqMax) {
      return 0;
    }

    // Look for harmonics at 2x, 3x, 4x fundamental frequency
    const harmonics = [2, 3, 4].map(mult => {
      const targetFreq = fundamental * mult;
      if (targetFreq > sampleRate / 2) return 0;
      
      // Simple harmonic detection using correlation
      const period = Math.floor(sampleRate / targetFreq);
      let correlation = 0;
      let count = 0;

      for (let i = 0; i < data.length - period; i++) {
        correlation += Math.abs(data[i] * data[i + period]);
        count++;
      }

      return count > 0 ? correlation / count : 0;
    });

    return harmonics.reduce((sum, h) => sum + h, 0) / harmonics.length;
  }

  private calculateModulationDepth(data: Float32Array): number {
    // Speech has natural amplitude modulation, noise typically doesn't
    const windowSize = Math.floor(data.length / 10);
    const amplitudes: number[] = [];

    for (let i = 0; i < data.length - windowSize; i += windowSize) {
      let sum = 0;
      for (let j = 0; j < windowSize; j++) {
        sum += Math.abs(data[i + j]);
      }
      amplitudes.push(sum / windowSize);
    }

    if (amplitudes.length < 2) return 0;

    // Calculate variation in amplitude
    const mean = amplitudes.reduce((sum, amp) => sum + amp, 0) / amplitudes.length;
    const variance = amplitudes.reduce((sum, amp) => sum + Math.pow(amp - mean, 2), 0) / amplitudes.length;
    
    return mean > 0 ? Math.sqrt(variance) / mean : 0;
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

  private calculateSpectralFlatness(data: Float32Array): number {
    // Spectral flatness: geometric mean / arithmetic mean of power spectrum
    // High flatness = noise-like, low flatness = tonal (voice-like)
    
    const fftSize = Math.min(512, data.length);
    const spectrum: number[] = [];
    
    // Simple magnitude spectrum calculation
    for (let i = 0; i < fftSize / 2; i++) {
      const real = data[i * 2] || 0;
      const imag = data[i * 2 + 1] || 0;
      spectrum.push(real * real + imag * imag);
    }

    // Calculate geometric and arithmetic means
    let geometricMean = 1;
    let arithmeticMean = 0;
    let validBins = 0;

    for (const power of spectrum) {
      if (power > 0) {
        geometricMean *= Math.pow(power, 1 / spectrum.length);
        arithmeticMean += power;
        validBins++;
      }
    }

    if (validBins === 0) return 1; // Pure silence = flat

    arithmeticMean /= validBins;
    return arithmeticMean > 0 ? geometricMean / arithmeticMean : 0;
  }

  private estimateNoiseRatio(data: Float32Array): number {
    // Estimate what portion of the signal is noise vs signal
    const sortedAmplitudes = Array.from(data)
      .map(Math.abs)
      .sort((a, b) => a - b);
    
    // Use 25th percentile as noise floor estimate
    const noiseFloor = sortedAmplitudes[Math.floor(sortedAmplitudes.length * 0.25)];
    
    // Count samples below 3x noise floor as "noise"
    const noiseThreshold = noiseFloor * 3;
    let noiseSamples = 0;
    
    for (const sample of data) {
      if (Math.abs(sample) <= noiseThreshold) {
        noiseSamples++;
      }
    }
    
    return noiseSamples / data.length;
  }

  private isVoiceLikeSignal(
    dominantFreq: number,
    harmonicContent: number,
    modulationDepth: number,
    zeroCrossingRate: number,
    spectralFlatness: number,
    noiseRatio: number
  ): boolean {
    // Check if frequency is in voice range
    const freqCheck = dominantFreq >= this.config.voiceFreqMin && 
                     dominantFreq <= this.config.voiceFreqMax;
    
    // Check for harmonic structure (voice has harmonics)
    const harmonicCheck = harmonicContent >= this.config.harmonicThreshold;
    
    // Check for speech-like modulation
    const modulationCheck = modulationDepth >= this.config.minModulationDepth;
    
    // Check zero crossing rate (too high = noise)
    const zcrCheck = zeroCrossingRate <= this.config.maxZeroCrossingRate;
    
    // Check spectral flatness (too flat = noise)
    const flatnessCheck = spectralFlatness < 0.8; // Voice should be less flat than noise
    
    // Check noise ratio
    const noiseCheck = noiseRatio <= this.config.maxNoiseRatio;
    
    // Need at least 4 out of 6 checks to pass
    const passedChecks = [freqCheck, harmonicCheck, modulationCheck, zcrCheck, flatnessCheck, noiseCheck]
      .filter(Boolean).length;
    
    return passedChecks >= 4;
  }

  private calculateVoiceConfidence(
    dominantFreq: number,
    harmonicContent: number,
    modulationDepth: number,
    zeroCrossingRate: number,
    spectralFlatness: number,
    noiseRatio: number
  ): number {
    let confidence = 0;

    // Frequency confidence (0-0.2)
    if (dominantFreq >= this.config.voiceFreqMin && dominantFreq <= this.config.voiceFreqMax) {
      // Optimal voice frequency is around 150-300Hz for fundamental
      const optimal = 200;
      const deviation = Math.abs(dominantFreq - optimal) / optimal;
      confidence += Math.max(0, 0.2 - deviation * 0.2);
    }

    // Harmonic confidence (0-0.25)
    confidence += Math.min(0.25, harmonicContent * 0.8);

    // Modulation confidence (0-0.2)
    confidence += Math.min(0.2, modulationDepth * 2);

    // Zero crossing confidence (0-0.15)
    const optimalZCR = 0.1;
    const zcrDeviation = Math.abs(zeroCrossingRate - optimalZCR);
    confidence += Math.max(0, 0.15 - zcrDeviation * 1.5);

    // Spectral flatness confidence (0-0.1)
    confidence += Math.max(0, 0.1 - spectralFlatness * 0.125);

    // Noise ratio confidence (0-0.1)
    confidence += Math.max(0, 0.1 - noiseRatio * 0.1);

    return Math.min(1, confidence);
  }

  private shouldSendToWhisper(
    isVoiceLike: boolean,
    confidence: number,
    noiseRatio: number,
    timestamp: number
  ): boolean {
    // Block if pure noise blocking is enabled and this doesn't look like voice
    if (this.config.blockPureNoise && !isVoiceLike) {
      return false;
    }

    // Block if confidence is too low
    if (confidence < this.config.minConfidenceToSend) {
      return false;
    }

    // Block if too much noise
    if (noiseRatio > this.config.maxNoiseRatio) {
      return false;
    }

    // Check recent history - if we've been blocking a lot, be more permissive
    const recentBlocks = this.recentAnalyses
      .filter(a => timestamp - (a as any).timestamp < 5000) // Last 5 seconds
      .filter(a => !a.shouldSendToWhisper).length;
    
    if (recentBlocks > 8) { // If we've blocked 8+ in last 5 seconds, be more lenient
      return confidence > this.config.minConfidenceToSend * 0.7;
    }

    return true;
  }

  private updateAnalysisHistory(analysis: AudioAnalysis): void {
    this.recentAnalyses.push(analysis);
    if (this.recentAnalyses.length > this.analysisHistorySize) {
      this.recentAnalyses.shift();
    }
  }

  private getBlockReason(analysis: AudioAnalysis): string {
    if (!analysis.isVoiceLike) return 'Not voice-like signal';
    if (analysis.confidence < this.config.minConfidenceToSend) return 'Low confidence';
    if (analysis.noiseRatio > this.config.maxNoiseRatio) return 'Too much noise';
    return 'Unknown reason';
  }

  updateConfig(newConfig: Partial<WhisperPreFilterConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.emit('configUpdated', this.config);
  }

  getConfig(): WhisperPreFilterConfig {
    return { ...this.config };
  }

  getRecentStats(): {
    totalAnalyzed: number;
    blocked: number;
    blockRate: number;
    avgConfidence: number;
  } {
    const total = this.recentAnalyses.length;
    const blocked = this.recentAnalyses.filter(a => !a.shouldSendToWhisper).length;
    const avgConfidence = total > 0 
      ? this.recentAnalyses.reduce((sum, a) => sum + a.confidence, 0) / total 
      : 0;

    return {
      totalAnalyzed: total,
      blocked,
      blockRate: total > 0 ? blocked / total : 0,
      avgConfidence
    };
  }
}

export default WhisperPreFilter;