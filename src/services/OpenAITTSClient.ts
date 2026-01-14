import { TextToSpeechService, Voice, VoiceCloningStatus, VoiceSettings } from '../interfaces/TextToSpeechService';
import { ManagedApiRouter } from './ManagedApiRouter';
import { ConfigurationManager } from './ConfigurationManager';

/**
 * OpenAI text-to-speech service client
 * Provides TTS fallback when ElevenLabs is not available
 */
export class OpenAITTSClient implements TextToSpeechService {
    private apiKey: string | null;
    private baseUrl: string = 'https://api.openai.com/v1';
    private managedApiRouter: ManagedApiRouter;
    private voiceSettings: VoiceSettings = {
        stability: 0.5,
        similarityBoost: 0.5,
        speed: 1.0,
        quality: 'medium'
    };

    constructor(apiKey?: string) {
        this.apiKey = apiKey || null;
        this.managedApiRouter = ManagedApiRouter.getInstance();
    }

    /**
     * Get the remember responses preference for managed API calls
     */
    private getRememberPreference(): boolean {
        try {
            const config = ConfigurationManager.getInstance().getConfig();
            return (config as any).userPreferences?.rememberResponses !== false;
        } catch (error) {
            console.warn('Failed to get remember preference, defaulting to true:', error);
            return true;
        }
    }

    /**
     * Map ElevenLabs model IDs to OpenAI TTS model IDs
     */
    private mapToOpenAIModel(modelId?: string): string {
        // If no model specified or it's an ElevenLabs model, use OpenAI default
        if (!modelId || modelId.startsWith('eleven_')) {
            return 'tts-1'; // Standard quality, faster
        }
        
        // If already an OpenAI model, use it
        if (modelId === 'tts-1' || modelId === 'tts-1-hd') {
            return modelId;
        }
        
        // Default to tts-1
        return 'tts-1';
    }

    /**
     * Synthesize with optional translation (uses combined endpoint if translation is needed)
     */
    async synthesize(text: string, voiceId: string, modelId?: string): Promise<ArrayBuffer> {
        const currentMode = this.managedApiRouter.getMode();
        const openaiModel = this.mapToOpenAIModel(modelId);
        
        if (currentMode === 'managed') {
            return await this.synthesizeWithManagedApi(text, voiceId, openaiModel);
        } else if (this.apiKey) {
            return await this.synthesizeWithPersonalKey(text, voiceId, openaiModel);
        } else {
            throw new Error('No OpenAI API key available and not in managed mode');
        }
    }

    /**
     * Combined translation + TTS synthesis (optimized single call)
     * This is more efficient than separate translation and TTS calls
     */
    async synthesizeWithTranslation(
        text: string,
        voiceId: string,
        sourceLang: string,
        targetLang: string,
        modelId?: string
    ): Promise<{ audio: ArrayBuffer; translatedText: string }> {
        const currentMode = this.managedApiRouter.getMode();
        const openaiModel = this.mapToOpenAIModel(modelId);
        
        if (currentMode === 'managed') {
            return await this.synthesizeWithTranslationManaged(text, voiceId, sourceLang, targetLang, openaiModel);
        } else if (this.apiKey) {
            // For personal mode, fall back to separate calls (combined endpoint not available)
            throw new Error('Combined translation+TTS not available in personal mode. Use separate translation and TTS calls.');
        } else {
            throw new Error('No OpenAI API key available and not in managed mode');
        }
    }

    /**
     * Combined translation + TTS using managed API (optimized)
     */
    private async synthesizeWithTranslationManaged(
        text: string,
        voiceId: string,
        sourceLang: string,
        targetLang: string,
        modelId: string
    ): Promise<{ audio: ArrayBuffer; translatedText: string }> {
        try {
            console.log(`🎤 OpenAI Translation+TTS (managed): text="${text.substring(0, 50)}...", ${sourceLang}->${targetLang}, voice=${voiceId}, model=${modelId}`);
            
            const requestBody = {
                text: text,
                sourceLang: sourceLang,
                targetLang: targetLang,
                model: modelId,
                voice: voiceId,
                response_format: 'mp3',
                speed: this.voiceSettings.speed || 1.0
            };

            // Route through managed API using combined endpoint
            const response = await this.managedApiRouter.routeOpenAIRequest({
                endpoint: '/translate/speak',
                method: 'POST',
                body: requestBody,
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            // If response is null, managed mode not available
            if (response === null) {
                throw new Error('Managed API not available for combined translation+TTS');
            }

            if (!response.success) {
                throw new Error(response?.error || 'Managed API request failed');
            }

            // Extract audio data
            let audio: ArrayBuffer;
            if (response.data instanceof ArrayBuffer) {
                audio = response.data;
            } else if (typeof response.data === 'string') {
                const binaryString = atob(response.data);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }
                audio = bytes.buffer;
            } else {
                throw new Error('Invalid audio data format received from managed API');
            }

            // Extract translated text from response metadata (if available)
            const translatedText = response.translatedText || text;

            return { audio, translatedText };

        } catch (error) {
            console.error('Managed API combined translation+TTS failed:', error);
            throw new Error(`Combined translation+TTS failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Synthesize using managed API
     */
    private async synthesizeWithManagedApi(text: string, voiceId: string, modelId: string): Promise<ArrayBuffer> {
        try {
            console.log(`🎤 OpenAI TTS (managed): text="${text.substring(0, 50)}...", voice=${voiceId}, model=${modelId}`);
            
            const requestBody = {
                input: text,
                model: modelId,
                voice: voiceId,
                response_format: 'mp3',
                speed: this.voiceSettings.speed || 1.0
            };

            // Route through managed API
            const response = await this.managedApiRouter.routeOpenAIRequest({
                endpoint: '/audio/speech',
                method: 'POST',
                body: requestBody,
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            // If response is null, it means we're in personal mode - use personal API
            if (response === null) {
                console.log('🔑 Managed API router returned null, using personal API key for OpenAI TTS');
                if (!this.apiKey) {
                    throw new Error('No OpenAI API key available for personal mode');
                }
                return await this.synthesizeWithPersonalKey(text, voiceId, modelId);
            }

            if (!response.success) {
                // If managed API TTS endpoint is not implemented, try personal key as fallback
                const errorMsg = response?.error || 'Managed API request failed';
                if (errorMsg.includes('Invalid request') || errorMsg.includes('not found')) {
                    console.warn('⚠️ Managed API TTS endpoint not available, attempting fallback to personal key');
                    if (this.apiKey) {
                        return await this.synthesizeWithPersonalKey(text, voiceId, modelId);
                    } else {
                        throw new Error('TTS service temporarily unavailable. Please add an OpenAI or ElevenLabs API key in Settings > API Keys.');
                    }
                }
                throw new Error(errorMsg);
            }

            // The response data should be the audio buffer
            if (response.data instanceof ArrayBuffer) {
                return response.data;
            } else if (typeof response.data === 'string') {
                // If it's base64 encoded, decode it
                const binaryString = atob(response.data);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }
                return bytes.buffer;
            } else {
                throw new Error('Invalid audio data format received from managed API');
            }

        } catch (error) {
            console.error('Managed API OpenAI TTS synthesis failed:', error);
            
            // Try personal key as last resort fallback
            if (this.apiKey && error instanceof Error && 
                (error.message.includes('Invalid request') || error.message.includes('not found'))) {
                console.warn('⚠️ Attempting personal OpenAI key as fallback for TTS');
                try {
                    return await this.synthesizeWithPersonalKey(text, voiceId, modelId);
                } catch (fallbackError) {
                    console.error('Personal key fallback also failed:', fallbackError);
                }
            }
            
            throw new Error(`OpenAI text-to-speech synthesis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Synthesize using personal API key
     */
    private async synthesizeWithPersonalKey(text: string, voiceId: string, modelId: string): Promise<ArrayBuffer> {
        if (!this.apiKey) {
            throw new Error('No OpenAI API key available');
        }

        try {
            console.log(`🎤 OpenAI TTS (personal): text="${text.substring(0, 50)}...", voice=${voiceId}, model=${modelId}`);
            
            const response = await fetch(`${this.baseUrl}/audio/speech`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    input: text,
                    model: modelId,
                    voice: voiceId,
                    response_format: 'mp3',
                    speed: this.voiceSettings.speed || 1.0
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`OpenAI API error: ${response.status} ${response.statusText} - ${errorText}`);
            }

            return await response.arrayBuffer();

        } catch (error) {
            throw new Error(`OpenAI text-to-speech synthesis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    async getAvailableVoices(): Promise<Voice[]> {
        // OpenAI has a fixed set of voices
        return [
            { id: 'alloy', name: 'Alloy (OpenAI)', isCloned: false },
            { id: 'echo', name: 'Echo (OpenAI)', isCloned: false },
            { id: 'fable', name: 'Fable (OpenAI)', isCloned: false },
            { id: 'onyx', name: 'Onyx (OpenAI)', isCloned: false },
            { id: 'nova', name: 'Nova (OpenAI)', isCloned: false },
            { id: 'shimmer', name: 'Shimmer (OpenAI)', isCloned: false }
        ];
    }

    async cloneVoice(audioSamples: ArrayBuffer[], voiceName: string): Promise<string> {
        throw new Error('Voice cloning is not supported by OpenAI TTS');
    }

    async deleteVoice(voiceId: string): Promise<void> {
        throw new Error('Voice deletion is not supported by OpenAI TTS');
    }

    async getVoiceCloningStatus(voiceId: string): Promise<VoiceCloningStatus> {
        return {
            status: 'failed',
            progress: 0,
            error: 'Voice cloning is not supported by OpenAI TTS'
        };
    }

    setVoiceSettings(settings: VoiceSettings): void {
        this.voiceSettings = { ...this.voiceSettings, ...settings };
    }

    isAvailable(): boolean {
        const currentMode = this.managedApiRouter.getMode();
        
        if (currentMode === 'managed') {
            // For managed mode, OpenAI TTS is available
            return true;
        } else {
            // For personal mode, need an API key
            return !!this.apiKey;
        }
    }
}
