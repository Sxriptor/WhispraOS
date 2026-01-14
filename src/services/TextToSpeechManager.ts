import { TextToSpeechService, Voice, VoiceCloningStatus, VoiceSettings } from '../interfaces/TextToSpeechService';
import { ElevenLabsClient } from './ElevenLabsClient';
import { DeepInfraChatterboxClient } from './DeepInfraChatterboxClient';
import { OpenAITTSClient } from './OpenAITTSClient';
import { ConfigurationManager } from './ConfigurationManager';
import { ApiKeyManager } from './ApiKeyManager';
import { ManagedApiRouter } from './ManagedApiRouter';
import { getProcessingModeFromConfig, getModelConfigFromConfig } from '../types/ConfigurationTypes';
import { ErrorReportingService } from './ErrorReportingService';
import { ErrorCategory, ErrorSeverity } from '../types/ErrorTypes';

/**
 * Manages text-to-speech services with caching and fallback
 */
export class TextToSpeechManager implements TextToSpeechService {
    private configManager: ConfigurationManager;
    private primaryProvider: TextToSpeechService | null = null;
    private currentProviderType: 'elevenlabs' | 'deepinfra' | null = null;
    private synthesisCache: Map<string, ArrayBuffer> = new Map();
    private voiceCache: Voice[] = [];
    private initialized: boolean = false;

    constructor(configManager: ConfigurationManager) {
        this.configManager = configManager;
        // Don't call async method in constructor
    }

    private async ensureInitialized(): Promise<void> {
        if (!this.initialized) {
            await this.initializeProviders();
            this.initialized = true;
        }
    }

    private async initializeProviders(): Promise<void> {
        // Fetch API keys from secure storage
        const apiKeyManager = ApiKeyManager.getInstance();
        const deepInfraKey = await apiKeyManager.getApiKey('deepinfra');
        const elevenKey = await apiKeyManager.getApiKey('elevenlabs');
        const openaiKey = await apiKeyManager.getApiKey('openai');

        // Check config for voice model selection
        const config = this.configManager.getConfig();
        // Use helper function to get modelConfig
        const modelConfig = getModelConfigFromConfig(config);
        const voiceModel = modelConfig?.voiceModel || 'elevenlabs'; // Default to ElevenLabs

        // Check if we're in managed mode
        const managedApiRouter = ManagedApiRouter.getInstance();
        const currentMode = managedApiRouter.getMode();
        const isManaged = currentMode === 'managed';

        if (voiceModel === 'chatterbox' && deepInfraKey && deepInfraKey.trim().length > 0) {
            // User selected Chatterbox and has Deep Infra API key
            this.primaryProvider = new DeepInfraChatterboxClient(apiKeyManager);
            this.currentProviderType = 'deepinfra';
            console.log('Deep Infra Chatterbox TTS provider initialized (selected in settings)');
        } else if (elevenKey && elevenKey.trim().length > 0) {
            // Default to ElevenLabs if available
            this.primaryProvider = new ElevenLabsClient(elevenKey);
            this.currentProviderType = 'elevenlabs';
            console.log('ElevenLabs TTS provider initialized');
        } else if (deepInfraKey && deepInfraKey.trim().length > 0) {
            // Fallback to Deep Infra if ElevenLabs not available
            this.primaryProvider = new DeepInfraChatterboxClient(apiKeyManager);
            this.currentProviderType = 'deepinfra';
            console.log('Deep Infra Chatterbox TTS provider initialized (fallback)');
        } else if (isManaged || (openaiKey && openaiKey.trim().length > 0)) {
            // Use OpenAI TTS if in managed mode OR if user has OpenAI key
            this.primaryProvider = new OpenAITTSClient(openaiKey);
            this.currentProviderType = 'elevenlabs'; // Keep as 'elevenlabs' for compatibility
            console.log(`OpenAI TTS provider initialized (${isManaged ? 'managed mode' : 'personal key'})`);
        } else {
            console.warn('No TTS API key found and not in managed mode');
        }
    }

    async synthesize(text: string, voiceId: string, modelId?: string): Promise<ArrayBuffer> {
        // Ensure providers are initialized
        await this.ensureInitialized();

        // Check cache first (include modelId in cache key)
        const cacheKey = this.getCacheKey(text, voiceId, modelId);
        const cachedResult = this.synthesisCache.get(cacheKey);
        if (cachedResult) {
            console.log('Using cached TTS result');
            return cachedResult;
        }

        // Check if this is an OpenAI voice - route to OpenAI TTS directly
        const openAIVoices = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];
        if (openAIVoices.includes(voiceId)) {
            console.log(`🎤 Detected OpenAI voice '${voiceId}', routing to OpenAI TTS`);
            try {
                const apiKeyManager = ApiKeyManager.getInstance();
                const openaiKey = await apiKeyManager.getApiKey('openai');
                const openaiProvider = new OpenAITTSClient(openaiKey);
                const result = await openaiProvider.synthesize(text, voiceId, modelId);
                
                // Cache the result
                if (this.synthesisCache.size > 50) {
                    const firstKey = this.synthesisCache.keys().next().value;
                    if (firstKey) {
                        this.synthesisCache.delete(firstKey);
                    }
                }
                this.synthesisCache.set(cacheKey, result);
                console.log(`✅ OpenAI TTS synthesis successful: ${result.byteLength} bytes`);
                return result;
            } catch (error) {
                console.error('❌ OpenAI TTS synthesis failed:', error);
                throw error;
            }
        }

        if (!this.primaryProvider) {
            // Check if we're in managed mode
            const managedApiRouter = ManagedApiRouter.getInstance();
            const currentMode = managedApiRouter.getMode();

            if (currentMode === 'personal') {
                // In personal mode without API key, return null to signal captions-only mode
                // This prevents the app from crashing and allows captions to still work
                console.warn('⚠️ No TTS provider available in personal mode - falling back to captions-only');
                throw new Error('CAPTIONS_ONLY_MODE');
            } else {
                // In managed mode, this shouldn't happen as we should have OpenAI TTS
                throw new Error('No text-to-speech provider available');
            }
        }

        try {
            console.log(`Synthesizing speech: "${text}" with voice ${voiceId}${modelId ? ` using model ${modelId}` : ''}`);
            const result = await this.primaryProvider.synthesize(text, voiceId, modelId);

            // Cache the result (limit cache size)
            if (this.synthesisCache.size > 50) {
                const firstKey = this.synthesisCache.keys().next().value;
                if (firstKey) {
                    this.synthesisCache.delete(firstKey);
                }
            }

            this.synthesisCache.set(cacheKey, result);
            console.log(`TTS synthesis successful: ${result.byteLength} bytes`);
            return result;

        } catch (error) {
            console.error('TTS synthesis failed:', error);

            const errorMessage = error instanceof Error ? error.message : '';

            // If Chatterbox failed due to non-ASCII and ElevenLabs is available, fallback
            if (this.currentProviderType === 'deepinfra' && errorMessage.includes('ASCII')) {
                console.warn('Chatterbox failed with non-ASCII text, attempting fallback to ElevenLabs...');
                const apiKeyManager = ApiKeyManager.getInstance();
                const elevenKey = await apiKeyManager.getApiKey('elevenlabs');

                if (elevenKey && elevenKey.trim().length > 0) {
                    try {
                        const { ElevenLabsClient } = await import('./ElevenLabsClient');
                        const fallbackProvider = new ElevenLabsClient(elevenKey);
                        console.log('Using ElevenLabs as fallback for non-ASCII text');
                        const result = await fallbackProvider.synthesize(text, voiceId, modelId);
                        this.synthesisCache.set(cacheKey, result);
                        console.log(`Fallback TTS synthesis successful: ${result.byteLength} bytes`);
                        return result;
                    } catch (fallbackError) {
                        console.error('Fallback to ElevenLabs also failed:', fallbackError);
                        throw new Error(`Text-to-speech synthesis failed: ${errorMessage}`);
                    }
                } else {
                    throw new Error(`Chatterbox doesn't support non-ASCII characters. Please configure ElevenLabs API key for multilingual TTS.`);
                }
            }

            // Check if we're in managed mode and if ElevenLabs failed
            const managedApiRouter = ManagedApiRouter.getInstance();
            const currentMode = managedApiRouter.getMode();

            if (currentMode === 'managed' && this.currentProviderType === 'elevenlabs') {
                // In managed mode, if ElevenLabs fails, fallback to OpenAI TTS
                console.warn('⚠️ ElevenLabs failed in managed mode, attempting fallback to OpenAI TTS...');
                try {
                    const apiKeyManager = ApiKeyManager.getInstance();
                    const openaiKey = await apiKeyManager.getApiKey('openai');
                    const fallbackProvider = new OpenAITTSClient(openaiKey);
                    console.log('Using OpenAI TTS as fallback in managed mode');

                    // Map ElevenLabs voice to OpenAI voice if needed
                    const openaiVoiceId = this.mapToOpenAIVoice(voiceId);
                    const result = await fallbackProvider.synthesize(text, openaiVoiceId, modelId);
                    this.synthesisCache.set(cacheKey, result);
                    console.log(`✅ Fallback to OpenAI TTS successful: ${result.byteLength} bytes`);
                    return result;
                } catch (fallbackError) {
                    console.error('❌ Fallback to OpenAI TTS also failed:', fallbackError);
                    // Continue to throw the original error
                }
            }

            // In personal mode, if we get here without API keys, suggest captions-only mode
            if (currentMode === 'personal') {
                console.warn('⚠️ TTS failed in personal mode - user should use captions-only mode');
                throw new Error('CAPTIONS_ONLY_MODE');
            }

            const finalError = new Error(`Text-to-speech synthesis failed: ${errorMessage}`);
            ErrorReportingService.getInstance().captureError(finalError, {
                category: ErrorCategory.API,
                severity: ErrorSeverity.HIGH,
                component: 'TextToSpeechManager',
                context: { action: 'synthesize', voiceId, provider: this.currentProviderType, textLength: text.length }
            });
            throw finalError;
        }
    }

    async synthesizeStream(
        text: string,
        voiceId: string,
        modelId?: string,
        onChunk?: (chunk: ArrayBuffer) => void,
        onComplete?: () => void,
        onError?: (error: Error) => void
    ): Promise<void> {
        // Ensure providers are initialized
        await this.ensureInitialized();

        // Check if this is an OpenAI voice - route to OpenAI TTS directly
        // OpenAI TTS doesn't support streaming, so use regular synthesis
        const openAIVoices = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];
        if (openAIVoices.includes(voiceId)) {
            console.log(`🎤 Detected OpenAI voice '${voiceId}' for streaming, routing to OpenAI TTS (non-streaming)`);
            try {
                const apiKeyManager = ApiKeyManager.getInstance();
                const openaiKey = await apiKeyManager.getApiKey('openai');
                const openaiProvider = new OpenAITTSClient(openaiKey);
                const result = await openaiProvider.synthesize(text, voiceId, modelId);
                onChunk?.(result);
                onComplete?.();
                console.log(`✅ OpenAI TTS synthesis successful: ${result.byteLength} bytes`);
                return;
            } catch (error) {
                console.error('❌ OpenAI TTS synthesis failed:', error);
                const errorObj = error instanceof Error ? error : new Error(`OpenAI TTS failed: ${error}`);
                onError?.(errorObj);
                throw errorObj;
            }
        }

        if (!this.primaryProvider) {
            // Check if we're in managed mode
            const managedApiRouter = ManagedApiRouter.getInstance();
            const currentMode = managedApiRouter.getMode();

            if (currentMode === 'personal') {
                // In personal mode without API key, signal captions-only mode
                console.warn('⚠️ No TTS provider available in personal mode - falling back to captions-only');
                const error = new Error('CAPTIONS_ONLY_MODE');
                onError?.(error);
                throw error;
            } else {
                // In managed mode, this shouldn't happen as we should have OpenAI TTS
                const error = new Error('No text-to-speech provider available');
                onError?.(error);
                throw error;
            }
        }

        // Check if the provider supports streaming
        if (!this.primaryProvider.synthesizeStream) {
            console.warn('Current TTS provider does not support streaming, falling back to regular synthesis');
            try {
                const result = await this.synthesize(text, voiceId, modelId);
                onChunk?.(result);
                onComplete?.();
            } catch (error) {
                const errorObj = error instanceof Error ? error : new Error(`Synthesis failed: ${error}`);
                onError?.(errorObj);
                throw errorObj;
            }
            return;
        }

        try {
            console.log(`Streaming TTS synthesis: "${text}" with voice ${voiceId}${modelId ? ` using model ${modelId}` : ''}`);
            
            await this.primaryProvider.synthesizeStream(
                text, 
                voiceId, 
                modelId,
                onChunk,
                onComplete,
                onError
            );

        } catch (error) {
            console.error('TTS streaming failed:', error);
            const errorObj = error instanceof Error ? error : new Error(`Streaming synthesis failed: ${error}`);
            const errorMessage = errorObj.message;

            // Check if we're in managed mode and if ElevenLabs failed
            const managedApiRouter = ManagedApiRouter.getInstance();
            const currentMode = managedApiRouter.getMode();

            // If in managed mode and ElevenLabs fails, try OpenAI TTS
            if (currentMode === 'managed' && this.currentProviderType === 'elevenlabs') {
                console.warn('⚠️ ElevenLabs streaming failed in managed mode, attempting fallback to OpenAI TTS...');
                try {
                    const apiKeyManager = ApiKeyManager.getInstance();
                    const openaiKey = await apiKeyManager.getApiKey('openai');
                    const fallbackProvider = new OpenAITTSClient(openaiKey);
                    console.log('Using OpenAI TTS as fallback for streaming in managed mode');

                    // Map ElevenLabs voice to OpenAI voice if needed
                    const openaiVoiceId = this.mapToOpenAIVoice(voiceId);

                    // OpenAI TTS doesn't support streaming, so use regular synthesis
                    const result = await fallbackProvider.synthesize(text, openaiVoiceId, modelId);
                    onChunk?.(result);
                    onComplete?.();
                    console.log(`✅ Fallback to OpenAI TTS successful for streaming: ${result.byteLength} bytes`);
                    return;
                } catch (fallbackError) {
                    console.error('❌ Fallback to OpenAI TTS also failed:', fallbackError);
                    // Continue to throw the original error
                }
            }

            // If primary provider streaming fails and it's ElevenLabs, try fallback to regular synthesis
            if (this.currentProviderType === 'elevenlabs') {
                console.warn('ElevenLabs streaming failed, attempting fallback to regular synthesis...');
                try {
                    const result = await this.synthesize(text, voiceId, modelId);
                    onChunk?.(result);
                    onComplete?.();
                    return;
                } catch (fallbackError) {
                    console.error('Fallback synthesis also failed:', fallbackError);
                }
            }

            // In personal mode, if we get here without API keys, suggest captions-only mode
            if (currentMode === 'personal' && !this.primaryProvider) {
                console.warn('⚠️ TTS streaming failed in personal mode - user should use captions-only mode');
                const captionsError = new Error('CAPTIONS_ONLY_MODE');
                onError?.(captionsError);
                throw captionsError;
            }

            onError?.(errorObj);
            throw errorObj;
        }
    }

    async getAvailableVoices(): Promise<Voice[]> {
        // Ensure providers are initialized
        await this.ensureInitialized();

        // Return cached voices if available
        if (this.voiceCache.length > 0) {
            return this.voiceCache;
        }

        if (!this.primaryProvider) {
            // Check if user has managed API access or is in managed mode
            const config = this.configManager.getConfig();
            const managedApiConfig = config.managedApiConfig;
            const isInManagedMode = managedApiConfig?.mode === 'managed';
            
            if (isInManagedMode) {
                // Return OpenAI voices for managed mode
                console.log('🎤 No provider, returning OpenAI voices for managed mode');
                return [
                    { id: 'alloy', name: 'Alloy (OpenAI)', isCloned: false },
                    { id: 'echo', name: 'Echo (OpenAI)', isCloned: false },
                    { id: 'fable', name: 'Fable (OpenAI)', isCloned: false },
                    { id: 'onyx', name: 'Onyx (OpenAI)', isCloned: false },
                    { id: 'nova', name: 'Nova (OpenAI)', isCloned: false },
                    { id: 'shimmer', name: 'Shimmer (OpenAI)', isCloned: false }
                ];
            } else {
                // Return mock voices if no provider is available and not in managed mode
                console.warn('No TTS provider available, returning mock voices');
                return [
                    { id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam (Male, English)', isCloned: false },
                    { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella (Female, English)', isCloned: false },
                    { id: 'IKne3meq5aSn9XLyUdCD', name: 'Charlie (Male, English)', isCloned: false },
                    { id: 'onwK4e9ZLuTAKqWW03F9', name: 'Daniel (Male, English)', isCloned: false }
                ];
            }
        }

        try {
            this.voiceCache = await this.primaryProvider.getAvailableVoices();
            
            // If we have ElevenLabs or DeepInfra voices, also add OpenAI voices as options
            if (this.currentProviderType === 'elevenlabs' || this.currentProviderType === 'deepinfra') {
                const openAIVoices = [
                    { id: 'alloy', name: 'Alloy (OpenAI)', isCloned: false },
                    { id: 'echo', name: 'Echo (OpenAI)', isCloned: false },
                    { id: 'fable', name: 'Fable (OpenAI)', isCloned: false },
                    { id: 'onyx', name: 'Onyx (OpenAI)', isCloned: false },
                    { id: 'nova', name: 'Nova (OpenAI)', isCloned: false },
                    { id: 'shimmer', name: 'Shimmer (OpenAI)', isCloned: false }
                ];
                
                // Combine provider voices with OpenAI voices
                const combinedVoices = [...this.voiceCache, ...openAIVoices];
                console.log(`🎤 Returning ${this.voiceCache.length} ${this.currentProviderType} voices + ${openAIVoices.length} OpenAI voices`);
                
                return combinedVoices;
            }
            
            // For OpenAI TTS provider, just return the voices directly
            return this.voiceCache;

        } catch (error) {
            console.error('Failed to get available voices:', error);
            
            // Check if user is in managed mode for fallback voices
            const config = this.configManager.getConfig();
            const managedApiConfig = config.managedApiConfig;
            const isInManagedMode = managedApiConfig?.mode === 'managed';
            
            if (isInManagedMode) {
                // Return OpenAI voices as fallback for managed mode
                console.log('🎤 Error getting voices, returning OpenAI voices for managed mode');
                return [
                    { id: 'alloy', name: 'Alloy (OpenAI)', isCloned: false },
                    { id: 'echo', name: 'Echo (OpenAI)', isCloned: false },
                    { id: 'fable', name: 'Fable (OpenAI)', isCloned: false },
                    { id: 'onyx', name: 'Onyx (OpenAI)', isCloned: false },
                    { id: 'nova', name: 'Nova (OpenAI)', isCloned: false },
                    { id: 'shimmer', name: 'Shimmer (OpenAI)', isCloned: false }
                ];
            } else {
                // Return mock voices as fallback
                return [
                    { id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam (Male, English)', isCloned: false },
                    { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella (Female, English)', isCloned: false },
                    { id: 'IKne3meq5aSn9XLyUdCD', name: 'Charlie (Male, English)', isCloned: false },
                    { id: 'onwK4e9ZLuTAKqWW03F9', name: 'Daniel (Male, English)', isCloned: false }
                ];
            }
        }
    }

    async cloneVoice(audioSamples: ArrayBuffer[], voiceName: string): Promise<string> {
        await this.ensureInitialized();

        if (!this.primaryProvider) {
            throw new Error('No text-to-speech provider available');
        }

        try {
            const voiceId = await this.primaryProvider.cloneVoice(audioSamples, voiceName);
            
            // Refresh voice cache
            this.voiceCache = [];
            await this.getAvailableVoices();
            
            return voiceId;

        } catch (error) {
            throw new Error(`Voice cloning failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    async deleteVoice(voiceId: string): Promise<void> {
        if (!this.primaryProvider) {
            throw new Error('No text-to-speech provider available');
        }

        try {
            await this.primaryProvider.deleteVoice(voiceId);
            
            // Refresh voice cache
            this.voiceCache = [];
            await this.getAvailableVoices();

        } catch (error) {
            throw new Error(`Voice deletion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private getCacheKey(text: string, voiceId: string, modelId?: string): string {
        return `${text}-${voiceId}${modelId ? `-${modelId}` : ''}`;
    }

    async getVoiceCloningStatus(voiceId: string): Promise<VoiceCloningStatus> {
        if (!this.primaryProvider) {
            throw new Error('No text-to-speech provider available');
        }

        return await this.primaryProvider.getVoiceCloningStatus(voiceId);
    }

    setVoiceSettings(settings: VoiceSettings): void {
        if (this.primaryProvider) {
            this.primaryProvider.setVoiceSettings(settings);
        }
    }

    isAvailable(): boolean {
        // Available if provider has been initialized
        return !!this.primaryProvider;
    }

    /**
     * Clear synthesis cache
     */
    clearCache(): void {
        this.synthesisCache.clear();
        this.voiceCache = [];
    }

    /**
     * Update providers when configuration changes
     */
    async updateProviders(): Promise<void> {
        this.initialized = false;
        this.primaryProvider = null;
        await this.initializeProviders();
        this.initialized = true;
        this.clearCache();
    }

    /**
     * Get default voice for quick synthesis
     */
    async getDefaultVoice(): Promise<Voice | null> {
        try {
            const voices = await this.getAvailableVoices();
            return voices.find(voice => !voice.isCloned) || voices[0] || null;
        } catch (error) {
            console.warn('Failed to get default voice:', error);
            return null;
        }
    }

    /**
     * Get current TTS provider type
     */
    async getCurrentProvider(): Promise<'elevenlabs' | 'deepinfra' | null> {
        await this.ensureInitialized();
        return this.currentProviderType;
    }

    /**
     * Map ElevenLabs voice ID to OpenAI voice ID
     * If the voice is already an OpenAI voice, return it as-is
     * Otherwise, return a default OpenAI voice
     */
    private mapToOpenAIVoice(voiceId: string): string {
        // Check if it's already an OpenAI voice
        const openAIVoices = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];
        if (openAIVoices.includes(voiceId)) {
            return voiceId;
        }

        // Default to 'alloy' for unknown voices
        console.log(`Mapping ElevenLabs voice '${voiceId}' to OpenAI voice 'alloy'`);
        return 'alloy';
    }
}