import { TextToSpeechService, Voice, VoiceCloningStatus, VoiceSettings } from '../interfaces/TextToSpeechService';
import { ErrorReportingService } from './ErrorReportingService';
import { ErrorCategory, ErrorSeverity } from '../types/ErrorTypes';
import { BrowserWindow } from 'electron';

/**
 * ElevenLabs text-to-speech service client
 * Note: Managed mode uses OpenAI TTS instead of ElevenLabs
 */
export class ElevenLabsClient implements TextToSpeechService {
    private apiKey: string;
    private baseUrl: string = 'https://api.elevenlabs.io/v1';
    private defaultVoiceId: string = 'pNInz6obpgDQGcFmaJgB'; // Adam voice
    private voiceSettings: VoiceSettings = {
        stability: 0.5,
        similarityBoost: 0.5,
        speed: 1.0,
        quality: 'medium'
    };

    constructor(apiKey: string) {
        this.apiKey = apiKey;
    }

    async synthesize(text: string, voiceId: string, modelId?: string): Promise<ArrayBuffer> {
        // ElevenLabs always uses personal API key (managed mode uses OpenAI TTS instead)
        return await this.synthesizeWithRetry(text, voiceId, modelId, false);
    }



    private async synthesizeWithRetry(
        text: string,
        voiceId: string,
        modelId?: string,
        isStreaming: boolean = false,
        maxRetries: number = 3
    ): Promise<ArrayBuffer> {
        let lastError: Error | null = null;

        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                const endpoint = isStreaming
                    ? `${this.baseUrl}/text-to-speech/${voiceId}/stream`
                    : `${this.baseUrl}/text-to-speech/${voiceId}`;

                const requestBody: any = {
                    text,
                    model_id: modelId || 'eleven_v3',
                    voice_settings: {
                        stability: this.voiceSettings.stability || 0.5,
                        similarity_boost: this.voiceSettings.similarityBoost || 0.5,
                        style: 0.0,
                        use_speaker_boost: true
                    }
                };

                if (isStreaming) {
                    requestBody.optimize_streaming_latency = 4;
                    requestBody.output_format = 'mp3_44100_128';
                }

                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: {
                        'Accept': 'audio/mpeg',
                        'Content-Type': 'application/json',
                        'xi-api-key': this.apiKey
                    },
                    body: JSON.stringify(requestBody)
                });

                // Handle rate limiting (429 Too Many Requests)
                if (response.status === 429) {
                    const retryAfter = response.headers.get('retry-after');
                    const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : Math.min(2000 * Math.pow(2, attempt), 10000);

                    console.warn(`⏱️ ElevenLabs rate limit hit, waiting ${Math.round(waitTime / 1000)}s before retry (attempt ${attempt + 1}/${maxRetries})...`);

                    if (attempt < maxRetries - 1) {
                        await new Promise(resolve => setTimeout(resolve, waitTime));
                        continue; // Retry
                    } else {
                        throw new Error(`ElevenLabs rate limit exceeded after ${maxRetries} attempts. Please wait a moment and try again.`);
                    }
                }

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`ElevenLabs API error: ${response.status} ${response.statusText} - ${errorText}`);
                }

                return await response.arrayBuffer();

            } catch (error) {
                lastError = error instanceof Error ? error : new Error('Unknown error');

                // If it's not a rate limit error, don't retry
                if (!lastError.message.includes('rate limit') && !lastError.message.includes('429')) {
                    throw new Error(`Text-to-speech synthesis failed: ${lastError.message}`);
                }

                // If we've exhausted retries, throw the error
                if (attempt >= maxRetries - 1) {
                    throw new Error(`Text-to-speech synthesis failed: ${lastError.message}`);
                }
            }
        }

        const finalError = new Error(`Text-to-speech synthesis failed: ${lastError?.message || 'Unknown error'}`);
        ErrorReportingService.getInstance().captureError(finalError, {
            category: ErrorCategory.API,
            severity: ErrorSeverity.HIGH,
            component: 'ElevenLabsClient',
            context: { action: 'synthesize', voiceId, isStreaming, textLength: text.length }
        });
        throw finalError;
    }

    async synthesizeStream(
        text: string,
        voiceId: string,
        modelId?: string,
        onChunk?: (chunk: ArrayBuffer) => void,
        onComplete?: () => void,
        onError?: (error: Error) => void
    ): Promise<void> {
        return await this.synthesizeStreamWithRetry(text, voiceId, modelId, onChunk, onComplete, onError);
    }

    private async synthesizeStreamWithRetry(
        text: string,
        voiceId: string,
        modelId?: string,
        onChunk?: (chunk: ArrayBuffer) => void,
        onComplete?: () => void,
        onError?: (error: Error) => void,
        maxRetries: number = 3
    ): Promise<void> {
        let lastError: Error | null = null;

        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                const response = await fetch(`${this.baseUrl}/text-to-speech/${voiceId}/stream`, {
                    method: 'POST',
                    headers: {
                        'Accept': 'audio/mpeg',
                        'Content-Type': 'application/json',
                        'xi-api-key': this.apiKey
                    },
                    body: JSON.stringify({
                        text,
                        model_id: modelId || 'eleven_v3',
                        voice_settings: {
                            stability: this.voiceSettings.stability || 0.5,
                            similarity_boost: this.voiceSettings.similarityBoost || 0.5,
                            style: 0.0,
                            use_speaker_boost: true
                        },
                        // Enable streaming optimizations
                        optimize_streaming_latency: 4, // Max optimization for lowest latency
                        output_format: 'mp3_44100_128' // MP3 format - will combine chunks before playback
                    })
                });

                // Handle rate limiting (429 Too Many Requests)
                if (response.status === 429) {
                    const retryAfter = response.headers.get('retry-after');
                    const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : Math.min(2000 * Math.pow(2, attempt), 10000);

                    console.warn(`⏱️ ElevenLabs streaming rate limit hit, waiting ${Math.round(waitTime / 1000)}s before retry (attempt ${attempt + 1}/${maxRetries})...`);

                    if (attempt < maxRetries - 1) {
                        await new Promise(resolve => setTimeout(resolve, waitTime));
                        continue; // Retry
                    } else {
                        const error = new Error(`ElevenLabs rate limit exceeded after ${maxRetries} attempts. Please wait a moment and try again.`);
                        onError?.(error);
                        throw error;
                    }
                }

                if (!response.ok) {
                    const errorText = await response.text();
                    const error = new Error(`ElevenLabs streaming API error: ${response.status} ${response.statusText} - ${errorText}`);

                    // Don't retry non-rate-limit errors
                    onError?.(error);
                    throw error;
                }

                if (!response.body) {
                    const error = new Error('No response body received from ElevenLabs streaming API');
                    onError?.(error);
                    throw error;
                }

                const reader = response.body.getReader();

                try {
                    while (true) {
                        const { done, value } = await reader.read();

                        if (done) {
                            console.log('ElevenLabs streaming completed');
                            onComplete?.();
                            break;
                        }

                        if (value && value.length > 0) {
                            // Convert Uint8Array to ArrayBuffer for consistency with existing interface
                            const chunk = value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength);
                            onChunk?.(chunk);
                        }
                    }
                } finally {
                    reader.releaseLock();
                }

                // Successfully completed, exit retry loop
                return;

            } catch (error) {
                lastError = error instanceof Error ? error : new Error(`Streaming synthesis failed: ${error}`);

                // Check if it's a rate limit error
                const isRateLimitError = lastError.message.includes('rate limit') ||
                    lastError.message.includes('429') ||
                    lastError.message.includes('Too Many Requests');

                // If it's not a rate limit error, don't retry
                if (!isRateLimitError) {
                    const errorObj = error instanceof Error ? error : new Error(`Streaming synthesis failed: ${error}`);
                    onError?.(errorObj);
                    throw errorObj;
                }

                // If we've exhausted retries for rate limit, throw
                if (attempt >= maxRetries - 1) {
                    const errorObj = error instanceof Error ? error : new Error(`Streaming synthesis failed: ${error}`);
                    onError?.(errorObj);
                    throw errorObj;
                }

                // Wait before retrying
                const waitTime = Math.min(2000 * Math.pow(2, attempt), 10000);
                console.warn(`⏱️ Retrying streaming after error, waiting ${Math.round(waitTime / 1000)}s (attempt ${attempt + 1}/${maxRetries})...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
        }

        // If we get here, all retries failed
        const finalError = lastError || new Error('Streaming synthesis failed after all retries');
        ErrorReportingService.getInstance().captureError(finalError, {
            category: ErrorCategory.API,
            severity: ErrorSeverity.HIGH,
            component: 'ElevenLabsClient',
            context: { action: 'synthesizeStream', voiceId, textLength: text.length }
        });
        onError?.(finalError);
        throw finalError;
    }

    async getAvailableVoices(): Promise<Voice[]> {
        try {
            const response = await fetch(`${this.baseUrl}/voices`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'xi-api-key': this.apiKey
                }
            });

            if (!response.ok) {
                throw new Error(`ElevenLabs API error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            
            return data.voices.map((voice: any) => ({
                id: voice.voice_id,
                name: voice.name,
                isCloned: voice.category === 'cloned',
                language: voice.language,
                gender: voice.gender,
                previewUrl: voice.preview_url
            }));

        } catch (error) {
            console.warn('Failed to fetch voices, using default:', error);
            
            // Check if it's a fetch failed error (network/connection issue)
            const isFetchFailed = error instanceof TypeError && error.message.includes('fetch failed');
            
            if (isFetchFailed) {
                // Send IPC message to renderer to show error overlay
                try {
                    const mainWindow = BrowserWindow.getAllWindows().find(win => {
                        const url = win.webContents.getURL();
                        return url.includes('index.html') || url.includes('signin.html');
                    });
                    if (mainWindow && !mainWindow.isDestroyed()) {
                        mainWindow.webContents.send('api-error:elevenlabs-setup');
                    }
                } catch (ipcError) {
                    console.error('Failed to send ElevenLabs error message to renderer:', ipcError);
                }
            }
            
            ErrorReportingService.getInstance().captureError(error instanceof Error ? error : new Error(String(error)), {
                category: ErrorCategory.API,
                severity: ErrorSeverity.LOW,
                component: 'ElevenLabsClient',
                context: { action: 'getAvailableVoices' }
            });
            return [{
                id: this.defaultVoiceId,
                name: 'Adam',
                isCloned: false,
                language: 'en',
                gender: 'male',
                previewUrl: ''
            }];
        }
    }

    async cloneVoice(audioSamples: ArrayBuffer[], voiceName: string): Promise<string> {
        try {
            const formData = new FormData();
            formData.append('name', voiceName);
            formData.append('description', `Cloned voice: ${voiceName}`);

            // Add audio samples
            audioSamples.forEach((sample, index) => {
                const blob = new Blob([sample], { type: 'audio/wav' });
                formData.append('files', blob, `sample_${index}.wav`);
            });

            const response = await fetch(`${this.baseUrl}/voices/add`, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'xi-api-key': this.apiKey
                },
                body: formData
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Voice cloning failed: ${response.status} ${response.statusText} - ${errorText}`);
            }

            const data = await response.json();
            return data.voice_id;

        } catch (error) {
            const errorObj = error instanceof Error ? error : new Error(String(error));
            ErrorReportingService.getInstance().captureError(errorObj, {
                category: ErrorCategory.API,
                severity: ErrorSeverity.HIGH,
                component: 'ElevenLabsClient',
                context: { action: 'cloneVoice', voiceName, sampleCount: audioSamples.length }
            });
            throw new Error(`Voice cloning failed: ${errorObj.message}`);
        }
    }

    async deleteVoice(voiceId: string): Promise<void> {
        try {
            const response = await fetch(`${this.baseUrl}/voices/${voiceId}`, {
                method: 'DELETE',
                headers: {
                    'Accept': 'application/json',
                    'xi-api-key': this.apiKey
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to delete voice: ${response.status} ${response.statusText}`);
            }

        } catch (error) {
            const errorObj = error instanceof Error ? error : new Error(String(error));
            ErrorReportingService.getInstance().captureError(errorObj, {
                category: ErrorCategory.API,
                severity: ErrorSeverity.MEDIUM,
                component: 'ElevenLabsClient',
                context: { action: 'deleteVoice', voiceId }
            });
            throw new Error(`Voice deletion failed: ${errorObj.message}`);
        }
    }

    async getVoiceCloningStatus(voiceId: string): Promise<VoiceCloningStatus> {
        try {
            const response = await fetch(`${this.baseUrl}/voices/${voiceId}`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'xi-api-key': this.apiKey
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to get voice status: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            
            return {
                status: data.status || 'completed',
                progress: 100,
                estimatedTimeRemaining: 0
            };

        } catch (error) {
            console.warn('Failed to get voice status:', error);
            return {
                status: 'failed',
                progress: 0,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    setVoiceSettings(settings: VoiceSettings): void {
        this.voiceSettings = { ...this.voiceSettings, ...settings };
    }

    isAvailable(): boolean {
        // ElevenLabs requires personal API key (managed mode uses OpenAI TTS)
        return !!this.apiKey;
    }
}