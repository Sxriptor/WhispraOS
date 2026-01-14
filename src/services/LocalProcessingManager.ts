import { ConfigurationManager } from './ConfigurationManager';
import { ArgosTranslationService } from './ArgosTranslationService';
import { LocalWhisperService } from './LocalWhisperService';
import { TranslationResult } from '../interfaces/TranslationService';
import { TranscriptionResult } from '../interfaces/SpeechToTextService';

/**
 * Manages local processing services (Argos, Whisper)
 * Note: TTS falls back to cloud services (ElevenLabs)
 */
export class LocalProcessingManager {
  private static instance: LocalProcessingManager;
  private configManager: ConfigurationManager;
  private argosService: ArgosTranslationService;
  private whisperService: LocalWhisperService;
  private isInitialized: boolean = false;

  private constructor() {
    this.configManager = ConfigurationManager.getInstance();
    this.argosService = new ArgosTranslationService();
    this.whisperService = new LocalWhisperService();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): LocalProcessingManager {
    if (!LocalProcessingManager.instance) {
      LocalProcessingManager.instance = new LocalProcessingManager();
    }
    return LocalProcessingManager.instance;
  }

  /**
   * Initialize all local processing services
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      console.log('Initializing local processing services...');

      // Get local model configuration (prefer unified modelConfig, fallback to localModelConfig)
      const config = this.configManager.getConfig();
      const modelConfig = (config as any).modelConfig || (config as any).localModelConfig;

      if (modelConfig) {
        // Configure Whisper model
        if (modelConfig.whisperModel) {
          console.log(`🔧 Setting Whisper model to: ${modelConfig.whisperModel}`);
          this.whisperService.setModel(modelConfig.whisperModel);
        } else {
          console.log('⚠️ No whisperModel found in config, using default');
        }
      } else {
        console.log('⚠️ No model config found');
      }

      // Initialize services in parallel
      const initPromises = [
        this.initializeWhisper(),
        this.initializeArgos()
      ];

      await Promise.allSettled(initPromises);

      this.isInitialized = true;
      console.log('Local processing services initialized');
    } catch (error) {
      console.error('Failed to initialize local processing services:', error);
      throw error;
    }
  }

  /**
   * Check if local processing is available
   */
  async isLocalProcessingAvailable(): Promise<{
    whisper: boolean;
    argos: boolean;
    overall: boolean;
  }> {
    const status = {
      whisper: false,
      argos: false,
      overall: false
    };

    try {
      // Check each service availability
      status.whisper = this.whisperService.isAvailable();
      status.argos = this.argosService.isAvailable();

      // Overall availability requires core services (TTS falls back to cloud)
      status.overall = status.whisper && status.argos;

      console.log('Local processing availability:', status);
      return status;
    } catch (error) {
      console.error('Error checking local processing availability:', error);
      return status;
    }
  }

  /**
   * Transcribe audio using local Whisper
   */
  async transcribeAudio(audioBuffer: Buffer, options?: {
    language?: string;
    model?: string;
  }): Promise<TranscriptionResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.whisperService.isAvailable()) {
      throw new Error('Local Whisper service is not available');
    }

    try {
      const config = this.configManager.getConfig();
      const localModelConfig = (config as any).localModelConfig;
      
      const transcriptionOptions = {
        language: options?.language,
        model: options?.model || localModelConfig?.whisperModel || 'tiny',
        temperature: localModelConfig?.modelParameters?.temperature || 0.0
      };

      return await this.whisperService.transcribe(audioBuffer, transcriptionOptions);
    } catch (error) {
      console.error('Local transcription failed:', error);
      throw error;
    }
  }

  /**
   * Translate text using local Argos
   */
  async translateText(text: string, targetLanguage: string, sourceLanguage?: string): Promise<TranslationResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.argosService.isAvailable()) {
      const appDataPath = process.env.APPDATA || require('path').join(require('os').homedir(), 'AppData', 'Roaming');
      const argosPath = require('path').join(appDataPath, 'whispra', 'models', 'argos');
      const markerFile = require('path').join(argosPath, 'argos_installed.txt');
      
      throw new Error(`Local Argos translation service is not available. Expected installation marker at: ${markerFile}. Please install Argos Translate models through the Local Models Setup or switch to cloud processing mode.`);
    }

    try {
      return await this.argosService.translate(text, targetLanguage, sourceLanguage);
    } catch (error) {
      console.error('Local translation failed:', error);
      throw error;
    }
  }



  /**
   * Get supported languages for each service
   */
  getSupportedLanguages(): {
    whisper: string[];
    argos: string[];
    common: string[];
  } {
    const whisperLangs = this.whisperService.getSupportedLanguages();
    const argosLangs = this.argosService.getSupportedLanguages();

    // Find common languages supported by core services
    const commonLangs = whisperLangs.filter(lang => 
      argosLangs.includes(lang)
    );

    return {
      whisper: whisperLangs,
      argos: argosLangs,
      common: commonLangs
    };
  }

  /**
   * Update local model configuration
   */
  async updateLocalModelConfig(config: {
    whisperModel?: string;
    voiceModel?: string;
    modelParameters?: {
      temperature?: number;
      speed?: number;
    };
  }): Promise<void> {
    try {
      // Update Whisper model
      if (config.whisperModel) {
        this.whisperService.setModel(config.whisperModel);
      }



      console.log('Local model configuration updated:', config);
    } catch (error) {
      console.error('Failed to update local model configuration:', error);
      throw error;
    }
  }

  /**
   * Get current local model status
   */
  getLocalModelStatus(): {
    whisperModel: string;
    whisperAvailable: boolean;
    argosAvailable: boolean;
  } {
    // Get the actual model from config, not just the service's current model
    const config = this.configManager.getConfig();
    const modelConfig = (config as any).modelConfig || (config as any).localModelConfig || {};
    const whisperModelFromConfig = modelConfig?.whisperModel || this.whisperService.getCurrentModel();
    
    return {
      whisperModel: whisperModelFromConfig,
      whisperAvailable: this.whisperService.isAvailable(),
      argosAvailable: this.argosService.isAvailable()
    };
  }

  /**
   * Initialize Whisper service
   */
  private async initializeWhisper(): Promise<void> {
    try {
      await this.whisperService.initialize();
      console.log('✓ Local Whisper service initialized');
    } catch (error) {
      console.error('✗ Failed to initialize Whisper service:', error);
    }
  }

  /**
   * Initialize Argos service
   */
  private async initializeArgos(): Promise<void> {
    try {
      await this.argosService.initialize();
      console.log('✓ Argos translation service initialized');
    } catch (error) {
      console.error('✗ Failed to initialize Argos service:', error);
    }
  }



  /**
   * Restart Argos service
   * Useful when language settings change
   */
  async restartArgos(): Promise<void> {
    console.log('🔄 Restarting Argos service through LocalProcessingManager...');
    try {
      await this.argosService.restart();
      
      // Verify Argos is available after restart
      const isAvailable = this.argosService.isAvailable();
      if (!isAvailable) {
        console.warn('⚠️ Argos restarted but is not available. This may indicate an initialization issue.');
        // Try to initialize again
        await this.argosService.initialize();
      }
      
      console.log('✅ Argos service restarted successfully and is ready');
    } catch (error) {
      console.error('❌ Failed to restart Argos service:', error);
      throw error;
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    try {
      // Add any cleanup logic here if needed
      console.log('Local processing services cleaned up');
    } catch (error) {
      console.error('Error during local processing cleanup:', error);
    }
  }
}