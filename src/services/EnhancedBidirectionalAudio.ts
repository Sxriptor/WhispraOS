import { EventEmitter } from 'events';
import { AudioSegment } from '../interfaces/AudioCaptureService';
import { VoiceActivityDetector, VoiceActivity } from './VoiceActivityDetector';
import { AudioProcessingPipeline } from './AudioProcessingPipeline';
import { WhisperPreFilter, AudioAnalysis } from './WhisperPreFilter';
import { BidirectionalAudioConfig } from './BidirectionalAudioConfig';

export interface ProcessingResult {
  shouldTranscribe: boolean;
  processedAudio?: AudioSegment;
  vadActivity?: VoiceActivity;
  preFilterAnalysis?: AudioAnalysis;
  blockReason?: string;
  confidence: number;
}

export interface ProcessingStats {
  totalSegments: number;
  voiceDetected: number;
  sentToWhisper: number;
  blockedByPreFilter: number;
  blockedByVAD: number;
  avgConfidence: number;
  hallucinationsPrevented: number;
}

export class EnhancedBidirectionalAudio extends EventEmitter {
  private config: BidirectionalAudioConfig;
  private vad: VoiceActivityDetector;
  private pipeline: AudioProcessingPipeline;
  private preFilter: WhisperPreFilter;
  
  private stats: ProcessingStats = {
    totalSegments: 0,
    voiceDetected: 0,
    sentToWhisper: 0,
    blockedByPreFilter: 0,
    blockedByVAD: 0,
    avgConfidence: 0,
    hallucinationsPrevented: 0
  };

  constructor() {
    super();
    
    // Initialize configuration
    this.config = new BidirectionalAudioConfig();
    
    // Apply anti-hallucination preset by default
    this.config.applyPreset('quiet-voices');
    
    const settings = this.config.getSettings();
    
    // Initialize components
    this.vad = new VoiceActivityDetector(settings.vad);
    this.pipeline = new AudioProcessingPipeline(settings.pipeline);
    this.preFilter = new WhisperPreFilter(settings.preFilter);
    
    // Set up event listeners
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Configuration changes
    this.config.on('vadSettingsChanged', (vadConfig) => {
      this.vad.updateConfig(vadConfig);
    });
    
    this.config.on('pipelineSettingsChanged', (pipelineConfig) => {
      this.pipeline.updateConfig(pipelineConfig);
    });
    
    this.config.on('preFilterSettingsChanged', (preFilterConfig) => {
      this.preFilter.updateConfig(preFilterConfig);
    });
    
    // Pre-filter events
    this.preFilter.on('audioBlocked', (event) => {
      this.stats.hallucinationsPrevented++;
      this.emit('hallucinationPrevented', {
        reason: event.reason,
        analysis: event.analysis,
        timestamp: Date.now()
      });
    });
    
    // VAD events
    this.vad.on('voiceStarted', (event) => {
      this.emit('voiceStarted', event);
    });
    
    this.vad.on('voiceEnded', (event) => {
      this.emit('voiceEnded', event);
    });
  }

  async processAudioSegment(segment: AudioSegment): Promise<ProcessingResult> {
    this.stats.totalSegments++;
    
    try {
      // Step 1: Process through audio pipeline (noise reduction, etc.)
      const processedSegment = await this.pipeline.processSegment(segment);
      
      // Step 2: Voice Activity Detection
      const vadActivity = this.vad.analyzeSegment(processedSegment);
      
      if (!vadActivity.isVoiceActive) {
        this.stats.blockedByVAD++;
        return {
          shouldTranscribe: false,
          processedAudio: processedSegment,
          vadActivity,
          blockReason: 'No voice activity detected',
          confidence: vadActivity.confidence
        };
      }
      
      this.stats.voiceDetected++;
      
      // Step 3: Pre-filter analysis (prevent Whisper hallucinations)
      const preFilterAnalysis = this.preFilter.analyzeAudio(processedSegment);
      
      if (!preFilterAnalysis.shouldSendToWhisper) {
        this.stats.blockedByPreFilter++;
        return {
          shouldTranscribe: false,
          processedAudio: processedSegment,
          vadActivity,
          preFilterAnalysis,
          blockReason: 'Pre-filter blocked: likely noise or non-speech',
          confidence: Math.min(vadActivity.confidence, preFilterAnalysis.confidence)
        };
      }
      
      // All checks passed - send to Whisper
      this.stats.sentToWhisper++;
      this.updateAverageConfidence(preFilterAnalysis.confidence);
      
      this.emit('audioReadyForTranscription', {
        segment: processedSegment,
        vadActivity,
        preFilterAnalysis,
        confidence: preFilterAnalysis.confidence
      });
      
      return {
        shouldTranscribe: true,
        processedAudio: processedSegment,
        vadActivity,
        preFilterAnalysis,
        confidence: preFilterAnalysis.confidence
      };
      
    } catch (error) {
      this.emit('processingError', error);
      return {
        shouldTranscribe: false,
        blockReason: `Processing error: ${error instanceof Error ? error.message : String(error)}`,
        confidence: 0
      };
    }
  }

  private updateAverageConfidence(newConfidence: number): void {
    const totalProcessed = this.stats.sentToWhisper;
    this.stats.avgConfidence = ((this.stats.avgConfidence * (totalProcessed - 1)) + newConfidence) / totalProcessed;
  }

  // Preset management
  applyPreset(preset: 'quiet-voices' | 'noisy-environment' | 'gaming' | 'default' | 'anti-hallucination'): void {
    if (preset === 'anti-hallucination') {
      // Special preset focused on preventing hallucinations
      this.config.updateSettings({
        preFilter: {
          ...this.config.getSettings().preFilter,
          minConfidenceToSend: 0.85,        // Very strict
          blockPureNoise: true,
          minVoiceLikelihood: 0.8,          // High voice likelihood required
          maxNoiseRatio: 0.3,               // Low noise tolerance
          harmonicThreshold: 0.4,           // Strong harmonic requirement
          minModulationDepth: 0.12,         // Clear speech modulation required
        }
      });
    } else {
      this.config.applyPreset(preset);
    }
  }

  // Auto-calibration
  async autoCalibrate(audioSamples: Float32Array[], sampleRate: number): Promise<void> {
    await this.config.autoCalibrate(audioSamples, sampleRate);
    
    // Additional calibration based on processing results
    const settings = this.config.getSettings();
    
    // If we're blocking too much, relax the pre-filter
    const blockRate = this.getBlockRate();
    if (blockRate > 0.8) { // Blocking more than 80%
      this.config.updatePreFilterSettings({
        minConfidenceToSend: Math.max(0.5, settings.preFilter.minConfidenceToSend - 0.1),
        minVoiceLikelihood: Math.max(0.4, settings.preFilter.minVoiceLikelihood - 0.1)
      });
      
      console.log('[EnhancedBidirectionalAudio] Relaxed pre-filter due to high block rate:', blockRate);
    }
    
    // If we're not blocking enough and getting hallucinations, tighten the filter
    if (blockRate < 0.2) { // Blocking less than 20%
      this.config.updatePreFilterSettings({
        minConfidenceToSend: Math.min(0.9, settings.preFilter.minConfidenceToSend + 0.05),
        minVoiceLikelihood: Math.min(0.9, settings.preFilter.minVoiceLikelihood + 0.05)
      });
      
      console.log('[EnhancedBidirectionalAudio] Tightened pre-filter due to low block rate:', blockRate);
    }
  }

  // Statistics and monitoring
  getStats(): ProcessingStats {
    return { ...this.stats };
  }

  getBlockRate(): number {
    const totalBlocked = this.stats.blockedByVAD + this.stats.blockedByPreFilter;
    return this.stats.totalSegments > 0 ? totalBlocked / this.stats.totalSegments : 0;
  }

  getHallucinationPreventionRate(): number {
    return this.stats.totalSegments > 0 ? this.stats.hallucinationsPrevented / this.stats.totalSegments : 0;
  }

  resetStats(): void {
    this.stats = {
      totalSegments: 0,
      voiceDetected: 0,
      sentToWhisper: 0,
      blockedByPreFilter: 0,
      blockedByVAD: 0,
      avgConfidence: 0,
      hallucinationsPrevented: 0
    };
  }

  // Configuration access
  getConfig(): BidirectionalAudioConfig {
    return this.config;
  }

  // Manual overrides for testing
  setStrictMode(enabled: boolean): void {
    if (enabled) {
      this.applyPreset('anti-hallucination');
    } else {
      this.applyPreset('balanced' as any); // Will fall back to default
    }
  }

  // Debug information
  getDebugInfo(): any {
    return {
      stats: this.getStats(),
      blockRate: this.getBlockRate(),
      hallucinationPreventionRate: this.getHallucinationPreventionRate(),
      vadConfig: this.vad.getConfig(),
      pipelineConfig: this.pipeline.getConfig(),
      preFilterConfig: this.preFilter.getConfig(),
      recentPreFilterStats: this.preFilter.getRecentStats()
    };
  }

  dispose(): void {
    this.vad.dispose();
    this.pipeline.dispose();
    this.removeAllListeners();
  }
}

export default EnhancedBidirectionalAudio;