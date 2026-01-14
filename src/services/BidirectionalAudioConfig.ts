import { EventEmitter } from 'events';
import { VoiceActivityConfig } from './VoiceActivityDetector';
import { PipelineConfig } from './AudioProcessingPipeline';
import { WhisperPreFilterConfig } from './WhisperPreFilter';

export interface BidirectionalAudioSettings {
  // Voice Activity Detection
  vad: VoiceActivityConfig;
  
  // Audio Processing Pipeline
  pipeline: PipelineConfig;
  
  // Whisper Pre-Filter (prevents hallucinations)
  preFilter: WhisperPreFilterConfig;
  
  // System-specific settings
  systemAudioBoost: number;
  microphoneSuppressionLevel: number;
  adaptiveNoiseReduction: boolean;
  voiceEnhancementMode: 'balanced' | 'aggressive' | 'gentle';
}

export class BidirectionalAudioConfig extends EventEmitter {
  private settings: BidirectionalAudioSettings;

  constructor() {
    super();
    
    // Default settings optimized for low-volume voice detection
    this.settings = {
      vad: {
        volumeThreshold: 0.003,           // Very sensitive for quiet voices
        silenceThreshold: 0.001,          // Low silence threshold
        minSpeechDuration: 150,           // Quick response
        minSilenceDuration: 250,          // Short silence gaps
        energyThreshold: 0.0003,          // Low energy threshold
        zeroCrossingThreshold: 0.03,      // Low ZCR threshold
        adaptiveThreshold: true,          // Enable adaptive thresholding
        noiseFloorEstimation: true,       // Enable noise floor estimation
        spectralCentroidThreshold: 1200,  // Voice frequency range
        highFreqNoiseReduction: true,     // Filter high-frequency noise
        lowVolumeBoost: 2.5,             // Boost quiet voices
      },
      
      pipeline: {
        enableNoiseReduction: true,
        enableVolumeNormalization: true,
        enableHighPassFilter: true,
        enableLowPassFilter: true,
        enableDynamicRangeCompression: true,
        highPassFrequency: 85,            // Remove low-frequency noise
        lowPassFrequency: 7000,           // Remove high-frequency noise
        volumeThreshold: 0.003,           // Match VAD threshold
        compressionRatio: 2.5,            // Moderate compression
        noiseGateThreshold: 0.001,        // Very low noise gate
      },
      
      preFilter: {
        minVoiceLikelihood: 0.7,          // 70% confidence required for voice
        maxNoiseRatio: 0.6,               // Max 60% noise content
        minSpeechDuration: 300,           // 300ms minimum for speech
        voiceFreqMin: 80,                 // Human voice range
        voiceFreqMax: 3400,               // Human voice range
        harmonicThreshold: 0.25,          // Minimum harmonic content
        minModulationDepth: 0.08,         // Speech amplitude variation
        maxZeroCrossingRate: 0.25,        // Max zero crossings (filters noise)
        minConfidenceToSend: 0.75,        // 75% confidence to send to Whisper
        blockPureNoise: true,             // Block obvious noise
      },
      
      systemAudioBoost: 1.5,              // Boost system audio capture
      microphoneSuppressionLevel: 0.8,     // Suppress microphone bleed
      adaptiveNoiseReduction: true,        // Enable adaptive noise reduction
      voiceEnhancementMode: 'balanced',    // Default enhancement mode
    };
  }

  getSettings(): BidirectionalAudioSettings {
    return { ...this.settings };
  }

  updateSettings(newSettings: Partial<BidirectionalAudioSettings>): void {
    this.settings = { ...this.settings, ...newSettings };
    this.emit('settingsChanged', this.settings);
  }

  updateVADSettings(vadSettings: Partial<VoiceActivityConfig>): void {
    this.settings.vad = { ...this.settings.vad, ...vadSettings };
    this.emit('vadSettingsChanged', this.settings.vad);
  }

  updatePipelineSettings(pipelineSettings: Partial<PipelineConfig>): void {
    this.settings.pipeline = { ...this.settings.pipeline, ...pipelineSettings };
    this.emit('pipelineSettingsChanged', this.settings.pipeline);
  }

  updatePreFilterSettings(preFilterSettings: Partial<WhisperPreFilterConfig>): void {
    this.settings.preFilter = { ...this.settings.preFilter, ...preFilterSettings };
    this.emit('preFilterSettingsChanged', this.settings.preFilter);
  }

  // Preset configurations for different scenarios
  applyPreset(preset: 'quiet-voices' | 'noisy-environment' | 'gaming' | 'default'): void {
    switch (preset) {
      case 'quiet-voices':
        this.updateSettings({
          vad: {
            ...this.settings.vad,
            volumeThreshold: 0.002,
            lowVolumeBoost: 3.0,
            adaptiveThreshold: true,
          },
          pipeline: {
            ...this.settings.pipeline,
            compressionRatio: 3.0,
          },
          preFilter: {
            ...this.settings.preFilter,
            minConfidenceToSend: 0.8,     // Higher confidence for quiet voices
            blockPureNoise: true,
            minVoiceLikelihood: 0.75,     // Stricter voice detection
          },
          systemAudioBoost: 2.0,
          voiceEnhancementMode: 'aggressive',
        });
        break;

      case 'noisy-environment':
        this.updateSettings({
          vad: {
            ...this.settings.vad,
            volumeThreshold: 0.008,
            highFreqNoiseReduction: true,
            spectralCentroidThreshold: 1000,
          },
          pipeline: {
            ...this.settings.pipeline,
            enableNoiseReduction: true,
            lowPassFrequency: 6000,
          },
          preFilter: {
            ...this.settings.preFilter,
            minConfidenceToSend: 0.85,    // Very strict in noisy environments
            maxNoiseRatio: 0.4,           // Lower noise tolerance
            blockPureNoise: true,
          },
          voiceEnhancementMode: 'aggressive',
        });
        break;

      case 'gaming':
        this.updateSettings({
          vad: {
            ...this.settings.vad,
            minSpeechDuration: 100,
            minSilenceDuration: 200,
            lowVolumeBoost: 2.0,
          },
          pipeline: {
            ...this.settings.pipeline,
            compressionRatio: 2.0,
            enableDynamicRangeCompression: true,
          },
          preFilter: {
            ...this.settings.preFilter,
            minConfidenceToSend: 0.7,     // Balanced for gaming
            blockPureNoise: true,
            minVoiceLikelihood: 0.65,
          },
          systemAudioBoost: 1.8,
          voiceEnhancementMode: 'balanced',
        });
        break;

      case 'default':
        // Reset to default settings
        this.settings = new BidirectionalAudioConfig().getSettings();
        break;
    }

    this.emit('presetApplied', preset, this.settings);
  }

  // Auto-calibration based on audio environment
  async autoCalibrate(audioSamples: Float32Array[], sampleRate: number): Promise<void> {
    console.log('[AudioConfig] Starting auto-calibration...');
    
    // Analyze audio samples to determine optimal settings
    let totalVolume = 0;
    let maxVolume = 0;
    let noiseFloor = Infinity;
    
    for (const sample of audioSamples) {
      for (let i = 0; i < sample.length; i++) {
        const amplitude = Math.abs(sample[i]);
        totalVolume += amplitude;
        maxVolume = Math.max(maxVolume, amplitude);
        if (amplitude > 0) {
          noiseFloor = Math.min(noiseFloor, amplitude);
        }
      }
    }
    
    const avgVolume = totalVolume / (audioSamples.length * audioSamples[0].length);
    const dynamicRange = maxVolume / Math.max(noiseFloor, 0.001);
    
    console.log('[AudioConfig] Calibration results:', {
      avgVolume,
      maxVolume,
      noiseFloor,
      dynamicRange
    });
    
    // Adjust settings based on analysis
    const calibratedSettings: Partial<BidirectionalAudioSettings> = {};
    
    // Adjust volume threshold based on noise floor
    if (noiseFloor < 0.002) {
      calibratedSettings.vad = {
        ...this.settings.vad,
        volumeThreshold: Math.max(0.002, noiseFloor * 3),
      };
      calibratedSettings.pipeline = {
        ...this.settings.pipeline,
        noiseGateThreshold: noiseFloor * 1.5,
      };
    }
    
    // Adjust boost based on average volume
    if (avgVolume < 0.01) {
      calibratedSettings.systemAudioBoost = Math.min(3.0, 0.01 / avgVolume);
    }
    
    // Adjust compression based on dynamic range
    if (dynamicRange > 50) {
      calibratedSettings.pipeline = {
        ...this.settings.pipeline,
        compressionRatio: Math.min(4.0, dynamicRange / 20),
      };
    }
    
    this.updateSettings(calibratedSettings);
    this.emit('calibrationComplete', calibratedSettings);
    
    console.log('[AudioConfig] Auto-calibration complete');
  }

  // Export/import settings for user customization
  exportSettings(): string {
    return JSON.stringify(this.settings, null, 2);
  }

  importSettings(settingsJson: string): boolean {
    try {
      const imported = JSON.parse(settingsJson);
      this.updateSettings(imported);
      return true;
    } catch (error) {
      console.error('[AudioConfig] Failed to import settings:', error);
      return false;
    }
  }
}

export default BidirectionalAudioConfig;