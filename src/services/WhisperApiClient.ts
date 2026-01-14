import { ApiKeyManager } from './ApiKeyManager';
import { ManagedApiRouter } from './ManagedApiRouter';
import { ManagedApiFallbackService } from './ManagedApiFallbackService';
import { ConfigurationManager } from './ConfigurationManager';
import { ErrorReportingService } from './ErrorReportingService';
import { ErrorCategory, ErrorSeverity } from '../types/ErrorTypes';
import { BrowserWindow } from 'electron';

export interface WhisperTranscriptionRequest {
  audio: Blob;
  model?: string;
  language?: string;
  prompt?: string;
  response_format?: 'json' | 'text' | 'srt' | 'verbose_json' | 'vtt';
  temperature?: number;
}

export interface WhisperTranscriptionResponse {
  text: string;
  language?: string;
  duration?: number;
  segments?: WhisperSegment[];
}

export interface WhisperSegment {
  id: number;
  seek: number;
  start: number;
  end: number;
  text: string;
  tokens: number[];
  temperature: number;
  avg_logprob: number;
  compression_ratio: number;
  no_speech_prob: number;
}

export interface WhisperApiConfig {
  baseUrl: string;
  model: string;
  temperature: number;
  maxRetries: number;
  timeout: number;
}

export class WhisperApiClient {
  private apiKeyManager: ApiKeyManager;
  private config: WhisperApiConfig;
  private managedApiRouter: ManagedApiRouter;
  private fallbackService: ManagedApiFallbackService;

  constructor(apiKeyManager: ApiKeyManager, config: Partial<WhisperApiConfig> = {}) {
    this.apiKeyManager = apiKeyManager;
    this.managedApiRouter = ManagedApiRouter.getInstance();
    this.fallbackService = ManagedApiFallbackService.getInstance();
    this.config = {
      baseUrl: 'https://api.openai.com/v1',
      model: 'whisper-1',
      temperature: 0,
      maxRetries: 3,
      timeout: 30000,
      ...config
    };
  }

  /**
   * Get the remember responses preference for managed API calls
   */
  private getRememberPreference(): boolean {
    try {
      const config = ConfigurationManager.getInstance().getConfig();
      return (config as any).userPreferences?.rememberResponses !== false; // Default to true
    } catch (error) {
      console.warn('Failed to get remember preference, defaulting to true:', error);
      return true; // Default to true
    }
  }

  async transcribe(request: WhisperTranscriptionRequest): Promise<WhisperTranscriptionResponse> {
    const currentMode = this.managedApiRouter.getMode();
    
    console.log(`🔍 WhisperApiClient: Current mode is '${currentMode}'`);
    console.log(`🔍 WhisperApiClient: User token present: ${!!(this.managedApiRouter as any).userToken}`);
    
    if (currentMode === 'managed') {
      console.log('🔄 Using managed API mode for transcription');
      // Use fallback service for automatic recovery
      return await this.fallbackService.executeWithFallback(
        'openai',
        () => this.transcribeWithManagedApi(request),
        () => this.transcribeWithPersonalApi(request),
        'whisper-transcription'
      );
    } else {
      console.log('🔄 Using personal API mode for transcription');
      return await this.transcribeWithPersonalApi(request);
    }
  }

  /**
   * Transcribe using managed API
   */
  private async transcribeWithManagedApi(request: WhisperTranscriptionRequest): Promise<WhisperTranscriptionResponse> {
    try {
      // Prepare form data for managed API
      const formData = new FormData();
      formData.append('file', request.audio, 'audio.wav');
      formData.append('model', request.model || this.config.model);
      
      if (request.language) {
        formData.append('language', request.language);
      }
      
      if (request.prompt) {
        formData.append('prompt', request.prompt);
      }
      
      formData.append('response_format', request.response_format || 'verbose_json');
      formData.append('temperature', (request.temperature ?? this.config.temperature).toString());
      formData.append('remember', this.getRememberPreference().toString());

      // Route through managed API
      const response = await this.managedApiRouter.routeOpenAIRequest({
        endpoint: '/audio/transcriptions',
        method: 'POST',
        body: formData,
        headers: {
          // Don't set Content-Type for FormData - let browser set it with boundary
        }
      });

      // If response is null, it means we're in personal mode - use personal API
      if (response === null) {
        console.log('🔑 Managed API router returned null, using personal API key for transcription');
        return await this.transcribeWithPersonalApi(request);
      }

      if (!response.success) {
        throw new Error(response?.error || 'Managed API request failed');
      }

      const result = response.data;
      
      // Handle different response formats
      if (request.response_format === 'text') {
        return { text: result };
      } else if (request.response_format === 'verbose_json') {
        return {
          text: result.text,
          language: result.language,
          duration: result.duration,
          segments: result.segments
        };
      } else {
        return { text: result.text };
      }

    } catch (error) {
      console.error('Managed API transcription failed:', error);
      throw new Error(`Transcription failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Transcribe using personal API key
   */
  private async transcribeWithPersonalApi(request: WhisperTranscriptionRequest): Promise<WhisperTranscriptionResponse> {
    const apiKey = await this.apiKeyManager.getApiKey('openai');
    if (!apiKey) {
      throw new Error('OpenAI API key not found. Please configure your API key.');
    }

    const formData = new FormData();
    formData.append('file', request.audio, 'audio.wav');
    formData.append('model', request.model || this.config.model);
    
    if (request.language) {
      formData.append('language', request.language);
    }
    
    if (request.prompt) {
      formData.append('prompt', request.prompt);
    }
    
    formData.append('response_format', request.response_format || 'verbose_json');
    formData.append('temperature', (request.temperature ?? this.config.temperature).toString());

    const requestOptions: RequestInit = {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      body: formData,
      signal: AbortSignal.timeout(this.config.timeout)
    };

    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        const response = await fetch(`${this.config.baseUrl}/audio/transcriptions`, requestOptions);
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const errorMessage = errorData.error?.message || response.statusText;
          
          // Check if it's a quota exceeded error (429)
          if (response.status === 429 && (errorMessage.includes('quota') || errorMessage.includes('exceeded'))) {
            // Send IPC message to renderer to show error overlay
            try {
              const mainWindow = BrowserWindow.getAllWindows().find(win => {
                const url = win.webContents.getURL();
                return url.includes('index.html') || url.includes('signin.html');
              });
              if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('api-error:openai-quota');
              }
            } catch (ipcError) {
              console.error('Failed to send OpenAI quota error message to renderer:', ipcError);
            }
          }
          
          throw new Error(
            `Whisper API error (${response.status}): ${errorMessage}`
          );
        }

        const result = await response.json();
        
        // Handle different response formats
        if (request.response_format === 'text') {
          return { text: result };
        } else if (request.response_format === 'verbose_json') {
          return {
            text: result.text,
            language: result.language,
            duration: result.duration,
            segments: result.segments
          };
        } else {
          return { text: result.text };
        }

      } catch (error) {
        lastError = error as Error;
        
        // Don't retry on certain errors
        if (error instanceof Error && error.name === 'AbortError') {
          throw new Error('Transcription request timed out');
        }
        
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage.includes('401') || errorMessage.includes('403')) {
          throw new Error('Invalid API key or insufficient permissions');
        }
        
        if (errorMessage.includes('429')) {
          // Rate limit - wait before retry
          const waitTime = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }
        
        // For other errors, wait briefly before retry
        if (attempt < this.config.maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }
      }
    }

    const finalError = lastError || new Error('Transcription failed after all retry attempts');
    ErrorReportingService.getInstance().captureError(finalError, {
      category: ErrorCategory.API,
      severity: ErrorSeverity.HIGH,
      component: 'WhisperApiClient',
      context: { action: 'transcribe', language: request.language, attempts: this.config.maxRetries }
    });
    throw finalError;
  }

  async validateApiKey(): Promise<boolean> {
    const currentMode = this.managedApiRouter.getMode();
    
    if (currentMode === 'managed') {
      // For managed mode, validate access through managed API router
      return await this.managedApiRouter.validateManagedAccess();
    }

    try {
      const apiKey = await this.apiKeyManager.getApiKey('openai');
      if (!apiKey) return false;

      // Create a minimal test audio file (silence)
      const testAudio = this.createTestAudioBlob();
      
      const response = await fetch(`${this.config.baseUrl}/audio/transcriptions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
        body: (() => {
          const formData = new FormData();
          formData.append('file', testAudio, 'test.wav');
          formData.append('model', this.config.model);
          return formData;
        })(),
        signal: AbortSignal.timeout(10000)
      });

      return response.ok || response.status === 400; // 400 might be due to invalid audio, but key is valid
    } catch (error) {
      console.error('API key validation failed:', error);
      ErrorReportingService.getInstance().captureError(error instanceof Error ? error : new Error(String(error)), {
        category: ErrorCategory.API,
        severity: ErrorSeverity.MEDIUM,
        component: 'WhisperApiClient',
        context: { action: 'validateApiKey' }
      });
      return false;
    }
  }

  private createTestAudioBlob(): Blob {
    // Create a minimal WAV file with silence (44 bytes header + 1 second of silence at 16kHz)
    const sampleRate = 16000;
    const duration = 0.1; // 100ms
    const numSamples = Math.floor(sampleRate * duration);
    const buffer = new ArrayBuffer(44 + numSamples * 2);
    const view = new DataView(buffer);

    // WAV header
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + numSamples * 2, true);
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
    view.setUint32(40, numSamples * 2, true);

    // Silent audio data (all zeros)
    for (let i = 0; i < numSamples; i++) {
      view.setInt16(44 + i * 2, 0, true);
    }

    return new Blob([buffer], { type: 'audio/wav' });
  }

  updateConfig(newConfig: Partial<WhisperApiConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  getConfig(): WhisperApiConfig {
    return { ...this.config };
  }

  getSupportedLanguages(): { code: string; name: string }[] {
    return [
      { code: 'auto', name: 'Auto-detect' },
      { code: 'en', name: 'English' },
      { code: 'es', name: 'Spanish' },
      { code: 'fr', name: 'French' },
      { code: 'de', name: 'German' },
      { code: 'it', name: 'Italian' },
      { code: 'pt', name: 'Portuguese' },
      { code: 'ru', name: 'Russian' },
      { code: 'ja', name: 'Japanese' },
      { code: 'ko', name: 'Korean' },
      { code: 'zh', name: 'Chinese' },
      { code: 'ar', name: 'Arabic' },
      { code: 'hi', name: 'Hindi' },
      { code: 'nl', name: 'Dutch' },
      { code: 'sv', name: 'Swedish' },
      { code: 'no', name: 'Norwegian' },
      { code: 'da', name: 'Danish' },
      { code: 'fi', name: 'Finnish' },
      { code: 'pl', name: 'Polish' },
      { code: 'tr', name: 'Turkish' }
    ];
  }
}