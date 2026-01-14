import { EventEmitter } from 'events';
import { AudioSegment } from '../interfaces/AudioCaptureService';
import { WhisperAudioConditioner, ConditionedAudio } from './WhisperAudioConditioner';

export interface ProcessingStats {
  totalSegments: number;
  audioConditioned: number;
  sentToWhisper: number;
  rejectedByGate: number;
  rejectedByVAD: number;
  rejectedByQuality: number;
  avgLUFS: number;
  avgDuration: number;
  hallucinationsPrevented: number;
}

export interface WhisperReadyAudio {
  audioBuffer: ArrayBuffer;
  sampleRate: number;
  channels: number;
  duration: number;
  lufs: number;
  confidence: number;
}

export class ProfessionalBidirectionalAudio extends EventEmitter {
  private conditioner: WhisperAudioConditioner;
  private stats: ProcessingStats = {
    totalSegments: 0,
    audioConditioned: 0,
    sentToWhisper: 0,
    rejectedByGate: 0,
    rejectedByVAD: 0,
    rejectedByQuality: 0,
    avgLUFS: 0,
    avgDuration: 0,
    hallucinationsPrevented: 0
  };

  constructor() {
    super();
    
    // Initialize with professional broadcast-quality settings
    this.conditioner = new WhisperAudioConditioner({
      // Whisper-optimized format
      targetSampleRate: 16000,
      targetChannels: 1,
      
      // Professional filtering (based on your specs)
      highPassFreq: 85,              // Remove rumble (80-100Hz range)
      lowPassFreq: 7500,             // Cut hiss (7-8kHz range)
      
      // Aggressive noise gate (fully closes when no speech)
      noiseGateThreshold: -42,       // LUFS threshold
      noiseGateAttack: 3,            // Very fast attack
      noiseGateRelease: 80,          // Quick release
      
      // Broadcast-standard levels (-16 to -12 LUFS)
      targetLUFS: -14,               // Target loudness
      maxPeakLevel: -1,              // Prevent clipping
      
      // Optimal chunk sizes (1-5 seconds as specified)
      minChunkDuration: 1000,        // 1 second minimum
      maxChunkDuration: 4000,        // 4 seconds maximum
      silenceThreshold: -50,         // Silence detection
      
      // Speech-only mode (only send speech to Whisper)
      vadEnabled: true,
      speechOnlyMode: true
    });
    
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.conditioner.on('audioReadyForWhisper', (conditioned: ConditionedAudio) => {
      this.stats.sentToWhisper++;
      this.updateAverages(conditioned);
      
      // Convert to Whisper-ready format
      const whisperAudio = this.prepareForWhisper(conditioned);
      
      this.emit('whisperReady', whisperAudio);
      this.emit('audioProcessed', {
        type: 'sent_to_whisper',
        conditioned,
        whisperAudio
      });
    });
    
    this.conditioner.on('audioRejected', (event) => {
      this.stats.hallucinationsPrevented++;
      
      // Categorize rejection reason
      if (event.reason.includes('silence')) {
        this.stats.rejectedByGate++;
      } else if (event.reason.includes('speech')) {
        this.stats.rejectedByVAD++;
      } else {
        this.stats.rejectedByQuality++;
      }
      
      this.emit('audioRejected', {
        reason: event.reason,
        analysis: event.analysis,
        timestamp: Date.now()
      });
      
      console.log(`[ProfessionalAudio] Rejected: ${event.reason}`);
    });
  }

  async processWASAPIChunk(audioData: Buffer | Float32Array, timestamp?: number): Promise<void> {
    this.stats.totalSegments++;
    
    try {
      // Convert Buffer to Float32Array if needed
      let floatData: Float32Array;
      if (audioData instanceof Buffer) {
        // Assume 16-bit PCM data in buffer
        const int16Array = new Int16Array(audioData.buffer, audioData.byteOffset, audioData.byteLength / 2);
        floatData = new Float32Array(int16Array.length);
        for (let i = 0; i < int16Array.length; i++) {
          floatData[i] = int16Array[i] / 32768.0; // Convert to float [-1, 1]
        }
      } else {
        floatData = new Float32Array(audioData.length);
        floatData.set(audioData);
      }
      
      // Create audio segment
      const segment: AudioSegment = {
        id: `wasapi-${Date.now()}`,
        data: floatData,
        sampleRate: 48000, // Typical WASAPI sample rate
        channelCount: 2,   // Typical WASAPI channels
        duration: (floatData.length / 48000 / 2) * 1000, // Calculate duration in ms
        timestamp: timestamp || Date.now()
      };
      
      // Process through conditioner
      const conditioned = await this.conditioner.processAudioSegment(segment);
      
      if (conditioned) {
        this.stats.audioConditioned++;
      }
      
    } catch (error) {
      this.emit('processingError', {
        error: error instanceof Error ? error.message : String(error),
        timestamp: Date.now()
      });
    }
  }

  private prepareForWhisper(conditioned: ConditionedAudio): WhisperReadyAudio {
    // Convert Float32Array to WAV format for Whisper
    const wavBuffer = this.createWAVBuffer(
      conditioned.audioData,
      conditioned.sampleRate,
      conditioned.channels
    );
    
    return {
      audioBuffer: wavBuffer,
      sampleRate: conditioned.sampleRate,
      channels: conditioned.channels,
      duration: conditioned.duration,
      lufs: conditioned.lufs,
      confidence: this.calculateConfidence(conditioned)
    };
  }

  private createWAVBuffer(data: Float32Array, sampleRate: number, channels: number): ArrayBuffer {
    const length = data.length;
    const buffer = new ArrayBuffer(44 + length * 2);
    const view = new DataView(buffer);
    
    // WAV header
    const writeString = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    };
    
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + length * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, channels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * channels * 2, true);
    view.setUint16(32, channels * 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, length * 2, true);
    
    // Convert float samples to 16-bit PCM
    let offset = 44;
    for (let i = 0; i < length; i++) {
      const sample = Math.max(-1, Math.min(1, data[i]));
      view.setInt16(offset, sample * 0x7FFF, true);
      offset += 2;
    }
    
    return buffer;
  }

  private calculateConfidence(conditioned: ConditionedAudio): number {
    let confidence = 0;
    
    // LUFS confidence (0-0.4)
    const lufsRange = [-20, -8]; // Acceptable LUFS range
    if (conditioned.lufs >= lufsRange[0] && conditioned.lufs <= lufsRange[1]) {
      const lufsScore = 1 - Math.abs(conditioned.lufs - (-14)) / 6; // Distance from -14 LUFS
      confidence += Math.max(0, lufsScore * 0.4);
    }
    
    // Peak level confidence (0-0.2)
    if (conditioned.peakLevel < -1 && conditioned.peakLevel > -20) {
      confidence += 0.2;
    }
    
    // Duration confidence (0-0.2)
    const optimalDuration = 2500; // 2.5 seconds
    const durationScore = 1 - Math.abs(conditioned.duration - optimalDuration) / optimalDuration;
    confidence += Math.max(0, durationScore * 0.2);
    
    // Speech detection confidence (0-0.2)
    if (conditioned.containsSpeech) {
      confidence += 0.2;
    }
    
    return Math.min(1, confidence);
  }

  private updateAverages(conditioned: ConditionedAudio): void {
    const count = this.stats.sentToWhisper;
    
    // Update average LUFS
    this.stats.avgLUFS = ((this.stats.avgLUFS * (count - 1)) + conditioned.lufs) / count;
    
    // Update average duration
    this.stats.avgDuration = ((this.stats.avgDuration * (count - 1)) + conditioned.duration) / count;
  }

  // Configuration presets for different scenarios
  applyPreset(preset: 'broadcast' | 'gaming' | 'quiet' | 'noisy' | 'music-rejection'): void {
    switch (preset) {
      case 'broadcast':
        // Professional broadcast standards
        this.conditioner.updateConfig({
          targetLUFS: -16,
          noiseGateThreshold: -40,
          highPassFreq: 80,
          lowPassFreq: 8000,
          speechOnlyMode: true
        });
        break;
        
      case 'gaming':
        // Optimized for gaming audio with quick response
        this.conditioner.updateConfig({
          targetLUFS: -12,
          noiseGateThreshold: -38,
          noiseGateAttack: 2,
          noiseGateRelease: 50,
          minChunkDuration: 800,
          maxChunkDuration: 3000
        });
        break;
        
      case 'quiet':
        // For very quiet environments
        this.conditioner.updateConfig({
          targetLUFS: -10,
          noiseGateThreshold: -45,
          highPassFreq: 60,
          speechOnlyMode: false // Allow more audio through
        });
        break;
        
      case 'noisy':
        // For noisy environments - very aggressive filtering
        this.conditioner.updateConfig({
          targetLUFS: -14,
          noiseGateThreshold: -35,
          highPassFreq: 100,
          lowPassFreq: 6000,
          speechOnlyMode: true
        });
        break;
        
      case 'music-rejection':
        // Specifically tuned to reject music and keep only speech
        this.conditioner.updateConfig({
          targetLUFS: -14,
          noiseGateThreshold: -40,
          speechOnlyMode: true,
          minChunkDuration: 1200, // Longer chunks to better detect speech patterns
          maxChunkDuration: 3500
        });
        break;
    }
    
    this.emit('presetApplied', preset);
  }

  // Real-time monitoring
  getStats(): ProcessingStats {
    return { ...this.stats };
  }

  getRealtimeInfo(): {
    stats: ProcessingStats;
    conditionerStats: any;
    rejectionRate: number;
    whisperRate: number;
  } {
    const total = this.stats.totalSegments;
    return {
      stats: this.getStats(),
      conditionerStats: this.conditioner.getStats(),
      rejectionRate: total > 0 ? (this.stats.hallucinationsPrevented / total) : 0,
      whisperRate: total > 0 ? (this.stats.sentToWhisper / total) : 0
    };
  }

  resetStats(): void {
    this.stats = {
      totalSegments: 0,
      audioConditioned: 0,
      sentToWhisper: 0,
      rejectedByGate: 0,
      rejectedByVAD: 0,
      rejectedByQuality: 0,
      avgLUFS: 0,
      avgDuration: 0,
      hallucinationsPrevented: 0
    };
  }

  // Manual controls for testing
  setAggressiveFiltering(enabled: boolean): void {
    if (enabled) {
      this.conditioner.updateConfig({
        noiseGateThreshold: -35,
        speechOnlyMode: true,
        minChunkDuration: 1500
      });
    } else {
      this.conditioner.updateConfig({
        noiseGateThreshold: -45,
        speechOnlyMode: false,
        minChunkDuration: 800
      });
    }
  }

  // Integration with existing WASAPI handlers
  async handleWASAPIData(wavData: Buffer): Promise<boolean> {
    await this.processWASAPIChunk(wavData);
    return true; // Always return true, let the conditioner decide what to send
  }

  dispose(): void {
    this.conditioner.dispose();
    this.removeAllListeners();
  }
}

export default ProfessionalBidirectionalAudio;