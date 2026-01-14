export interface AudioConversionOptions {
  targetSampleRate?: number;
  targetChannels?: number;
  targetFormat?: 'wav' | 'mp3' | 'flac';
  quality?: number; // 0-1 for lossy formats
}

export interface ConversionResult {
  blob: Blob;
  format: string;
  sampleRate: number;
  channels: number;
  duration: number;
  size: number;
}

export class AudioFormatConverter {
  private static readonly WHISPER_OPTIMAL_SAMPLE_RATE = 16000;
  private static readonly WHISPER_OPTIMAL_CHANNELS = 1;

  static async convertForWhisper(
    audioData: Float32Array,
    originalSampleRate: number,
    options: Partial<AudioConversionOptions> = {}
  ): Promise<ConversionResult> {
    const config = {
      targetSampleRate: this.WHISPER_OPTIMAL_SAMPLE_RATE,
      targetChannels: this.WHISPER_OPTIMAL_CHANNELS,
      targetFormat: 'wav' as const,
      ...options
    };

    // Resample if necessary
    let processedData = audioData;
    let currentSampleRate = originalSampleRate;

    if (originalSampleRate !== config.targetSampleRate) {
      processedData = this.resample(audioData, originalSampleRate, config.targetSampleRate!);
      currentSampleRate = config.targetSampleRate!;
    }

    // Convert to target format
    const blob = await this.convertToFormat(
      processedData,
      currentSampleRate,
      config.targetChannels!,
      config.targetFormat!,
      config.quality
    );

    return {
      blob,
      format: config.targetFormat!,
      sampleRate: currentSampleRate,
      channels: config.targetChannels!,
      duration: processedData.length / currentSampleRate,
      size: blob.size
    };
  }

  private static resample(
    inputData: Float32Array,
    inputSampleRate: number,
    outputSampleRate: number
  ): Float32Array {
    if (inputSampleRate === outputSampleRate) {
      return inputData;
    }

    const ratio = inputSampleRate / outputSampleRate;
    const outputLength = Math.floor(inputData.length / ratio);
    const output = new Float32Array(outputLength);

    // Simple linear interpolation resampling
    for (let i = 0; i < outputLength; i++) {
      const sourceIndex = i * ratio;
      const index = Math.floor(sourceIndex);
      const fraction = sourceIndex - index;

      if (index + 1 < inputData.length) {
        // Linear interpolation
        output[i] = inputData[index] * (1 - fraction) + inputData[index + 1] * fraction;
      } else {
        output[i] = inputData[index] || 0;
      }
    }

    return output;
  }

  private static async convertToFormat(
    audioData: Float32Array,
    sampleRate: number,
    channels: number,
    format: 'wav' | 'mp3' | 'flac',
    quality?: number
  ): Promise<Blob> {
    switch (format) {
      case 'wav':
        return this.convertToWav(audioData, sampleRate, channels);
      case 'mp3':
        return this.convertToMp3(audioData, sampleRate, channels, quality);
      case 'flac':
        return this.convertToFlac(audioData, sampleRate, channels);
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  private static convertToWav(
    audioData: Float32Array,
    sampleRate: number,
    channels: number
  ): Blob {
    const length = audioData.length;
    const buffer = new ArrayBuffer(44 + length * 2);
    const view = new DataView(buffer);

    // WAV header
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    // RIFF chunk descriptor
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + length * 2, true); // File size - 8
    writeString(8, 'WAVE');

    // fmt sub-chunk
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true); // Sub-chunk size
    view.setUint16(20, 1, true); // Audio format (PCM)
    view.setUint16(22, channels, true); // Number of channels
    view.setUint32(24, sampleRate, true); // Sample rate
    view.setUint32(28, sampleRate * channels * 2, true); // Byte rate
    view.setUint16(32, channels * 2, true); // Block align
    view.setUint16(34, 16, true); // Bits per sample

    // data sub-chunk
    writeString(36, 'data');
    view.setUint32(40, length * 2, true); // Sub-chunk size

    // Convert float samples to 16-bit PCM
    let offset = 44;
    for (let i = 0; i < length; i++) {
      const sample = Math.max(-1, Math.min(1, audioData[i]));
      view.setInt16(offset, sample * 0x7FFF, true);
      offset += 2;
    }

    return new Blob([buffer], { type: 'audio/wav' });
  }

  private static async convertToMp3(
    audioData: Float32Array,
    sampleRate: number,
    channels: number,
    quality: number = 0.7
  ): Promise<Blob> {
    // For MP3 conversion, we would typically use a library like lamejs
    // For now, we'll convert to WAV as a fallback since MP3 encoding is complex
    console.warn('MP3 encoding not implemented, falling back to WAV');
    return this.convertToWav(audioData, sampleRate, channels);
  }

  private static async convertToFlac(
    audioData: Float32Array,
    sampleRate: number,
    channels: number
  ): Promise<Blob> {
    // FLAC encoding would require a specialized library
    // For now, we'll convert to WAV as a fallback
    console.warn('FLAC encoding not implemented, falling back to WAV');
    return this.convertToWav(audioData, sampleRate, channels);
  }

  static async optimizeForWhisper(
    audioData: Float32Array,
    originalSampleRate: number
  ): Promise<ConversionResult> {
    // Apply audio preprocessing optimizations for better Whisper accuracy
    let processedData = audioData;

    // 1. Normalize audio levels
    processedData = this.normalizeAudio(processedData);

    // 2. Apply noise gate to remove very quiet sections
    processedData = this.applyNoiseGate(processedData, 0.01);

    // 3. Apply gentle high-pass filter to remove low-frequency noise
    processedData = this.applyHighPassFilter(processedData, originalSampleRate, 80);

    // 4. Convert to Whisper's preferred format
    return this.convertForWhisper(processedData, originalSampleRate);
  }

  private static normalizeAudio(audioData: Float32Array): Float32Array {
    // Find peak amplitude
    let peak = 0;
    for (let i = 0; i < audioData.length; i++) {
      peak = Math.max(peak, Math.abs(audioData[i]));
    }

    if (peak === 0) return audioData;

    // Normalize to 90% of maximum to avoid clipping
    const targetPeak = 0.9;
    const gain = targetPeak / peak;

    const normalized = new Float32Array(audioData.length);
    for (let i = 0; i < audioData.length; i++) {
      normalized[i] = audioData[i] * gain;
    }

    return normalized;
  }

  private static applyNoiseGate(audioData: Float32Array, threshold: number): Float32Array {
    const gated = new Float32Array(audioData.length);
    
    for (let i = 0; i < audioData.length; i++) {
      if (Math.abs(audioData[i]) > threshold) {
        gated[i] = audioData[i];
      } else {
        gated[i] = 0;
      }
    }

    return gated;
  }

  private static applyHighPassFilter(
    audioData: Float32Array,
    sampleRate: number,
    cutoffFrequency: number
  ): Float32Array {
    const filtered = new Float32Array(audioData.length);
    const rc = 1.0 / (2 * Math.PI * cutoffFrequency);
    const dt = 1.0 / sampleRate;
    const alpha = rc / (rc + dt);

    filtered[0] = audioData[0];
    for (let i = 1; i < audioData.length; i++) {
      filtered[i] = alpha * (filtered[i - 1] + audioData[i] - audioData[i - 1]);
    }

    return filtered;
  }

  static validateAudioForWhisper(blob: Blob): { valid: boolean; issues: string[] } {
    const issues: string[] = [];
    
    // Check file size (Whisper has a 25MB limit)
    if (blob.size > 25 * 1024 * 1024) {
      issues.push('File size exceeds 25MB limit');
    }

    // Check if file is too small (less than 100ms might not be useful)
    if (blob.size < 1000) {
      issues.push('Audio file is too small, might not contain meaningful content');
    }

    return {
      valid: issues.length === 0,
      issues
    };
  }

  static estimateTranscriptionCost(audioData: Float32Array, sampleRate: number): number {
    const durationMinutes = audioData.length / sampleRate / 60;
    // OpenAI Whisper pricing is $0.006 per minute (as of 2024)
    return durationMinutes * 0.006;
  }
}