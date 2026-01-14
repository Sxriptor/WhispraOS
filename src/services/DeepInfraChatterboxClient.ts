import { TextToSpeechService, Voice, VoiceCloningStatus, VoiceSettings } from '../interfaces/TextToSpeechService';
import { ApiKeyManager } from './ApiKeyManager';
import { ErrorReportingService } from './ErrorReportingService';
import { ErrorCategory, ErrorSeverity } from '../types/ErrorTypes';

/**
 * Deep Infra Chatterbox text-to-speech service client
 * Uses ResembleAI/chatterbox model via Deep Infra API
 */
export class DeepInfraChatterboxClient implements TextToSpeechService {
    private apiKeyManager: ApiKeyManager;
    private baseUrl: string = 'https://api.deepinfra.com/v1/inference';
    private modelId: string = 'ResembleAI/chatterbox';
    private voiceSettings: VoiceSettings = {
        stability: 0.5,
        similarityBoost: 0.5,
        speed: 1.0,
        quality: 'medium'
    };

    // Default voice presets based on Chatterbox capabilities
    private defaultVoices: Voice[] = [
        { id: 'default', name: 'Default Voice', isCloned: false, language: 'en', gender: 'neutral' },
        { id: 'male_1', name: 'Male Voice 1', isCloned: false, language: 'en', gender: 'male' },
        { id: 'female_1', name: 'Female Voice 1', isCloned: false, language: 'en', gender: 'female' }
    ];

    constructor(apiKeyManager: ApiKeyManager) {
        this.apiKeyManager = apiKeyManager;
    }

    async synthesize(text: string, voiceId: string = 'default', modelId?: string): Promise<ArrayBuffer> {
        try {
            const apiKey = await this.apiKeyManager.getApiKey('deepinfra');
            if (!apiKey) {
                throw new Error('Deep Infra API key not found. Please configure your API key.');
            }

            // Validate text for ASCII-only (Chatterbox limitation)
            // Chatterbox doesn't handle non-ASCII characters well
            const hasNonAscii = /[^\x00-\x7F]/.test(text);
            if (hasNonAscii) {
                console.warn('Chatterbox does not support non-ASCII characters. Text contains:', text);
                throw new Error('Chatterbox only supports ASCII text. For multilingual TTS, please use ElevenLabs.');
            }

            console.log(`🎤 Chatterbox synthesizing: "${text}" with voice: ${voiceId}`);

            const response = await fetch(`${this.baseUrl}/${this.modelId}`, {
                method: 'POST',
                headers: {
                    'Accept': 'audio/mpeg',
                    'Content-Type': 'application/json; charset=utf-8',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    text: text,
                    speed: this.voiceSettings.speed || 1.0
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Chatterbox API error:', response.status, errorText);
                throw new Error(`Deep Infra Chatterbox API error: ${response.status} ${response.statusText} - ${errorText}`);
            }

            // Check content type to determine response format
            const contentType = response.headers.get('content-type');
            console.log('Response content-type:', contentType);

            if (contentType && contentType.includes('audio')) {
                // Direct audio response (binary)
                console.log('Received direct audio response');
                return await response.arrayBuffer();
            } else {
                // JSON response with base64 audio
                const data = await response.json();
                console.log('Received JSON response with keys:', Object.keys(data));
                console.log('Audio format:', data.output_format);
                console.log('Inference status:', data.inference_status);

                if (data.audio) {
                    // Decode base64 to ArrayBuffer
                    console.log('Decoding audio data, base64 length:', data.audio.length);
                    try {
                        // Use Buffer for better base64 handling in Node.js
                        const buffer = Buffer.from(data.audio, 'base64');
                        console.log('Decoded audio buffer size:', buffer.length, 'bytes');

                        // Log first few bytes to check audio format (magic bytes)
                        const header = buffer.slice(0, 12);
                        const headerHex = Array.from(header).map(b => b.toString(16).padStart(2, '0')).join(' ');
                        console.log('Audio header bytes:', headerHex);

                        // Check if this is a valid WAV file (should start with "RIFF")
                        const isValidWav = buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46;
                        console.log('Is valid WAV file:', isValidWav);

                        if (!isValidWav && data.output_format === 'wav') {
                            console.error('❌ Deep Infra Chatterbox returned invalid WAV data without proper header.');
                            console.error('This is likely a limitation of the Chatterbox model via Deep Infra.');
                            console.error('The raw PCM format cannot be reliably decoded without knowing the exact sample rate and format.');

                            // Log words data for debugging
                            if (data.words && data.words.length > 0) {
                                console.log('Sample words data:', data.words.slice(0, 2));
                            }

                            throw new Error('Chatterbox returned invalid WAV format. Please use ElevenLabs for reliable TTS. Chatterbox via Deep Infra appears to have audio format issues.');
                        }

                        const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
                        return arrayBuffer;
                    } catch (decodeError) {
                        console.error('Failed to decode base64 audio:', decodeError);
                        console.log('Audio data preview:', data.audio.substring(0, 100));
                        throw new Error(`Failed to decode audio data: ${decodeError instanceof Error ? decodeError.message : 'Unknown error'}`);
                    }
                } else if (data.output) {
                    // Alternative response format
                    console.log('Decoding output data, length:', data.output.length);
                    try {
                        const buffer = Buffer.from(data.output, 'base64');
                        const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
                        return arrayBuffer;
                    } catch (decodeError) {
                        console.error('Failed to decode base64 output:', decodeError);
                        throw new Error(`Failed to decode output data: ${decodeError instanceof Error ? decodeError.message : 'Unknown error'}`);
                    }
                } else {
                    console.error('Unknown response format:', data);
                    throw new Error('No audio data in response');
                }
            }

        } catch (error) {
            const errorObj = error instanceof Error ? error : new Error(String(error));
            ErrorReportingService.getInstance().captureError(errorObj, {
                category: ErrorCategory.API,
                severity: ErrorSeverity.HIGH,
                component: 'DeepInfraChatterboxClient',
                context: { action: 'synthesize', voiceId, textLength: text.length }
            });
            throw new Error(`Text-to-speech synthesis failed: ${errorObj.message}`);
        }
    }

    async getAvailableVoices(): Promise<Voice[]> {
        // Chatterbox has predefined voices
        // For now, return default voice presets
        // In the future, this could be extended to fetch voices from Deep Infra API
        return this.defaultVoices;
    }

    async cloneVoice(audioSamples: ArrayBuffer[], voiceName: string): Promise<string> {
        // Voice cloning is not currently supported by Chatterbox via Deep Infra
        // This would require a different endpoint or service
        throw new Error('Voice cloning is not currently supported by Deep Infra Chatterbox. Please use ElevenLabs for voice cloning.');
    }

    async deleteVoice(voiceId: string): Promise<void> {
        // Voice deletion not supported for default voices
        throw new Error('Voice deletion is not supported for default Chatterbox voices.');
    }

    async getVoiceCloningStatus(voiceId: string): Promise<VoiceCloningStatus> {
        // Voice cloning not supported
        return {
            status: 'failed',
            progress: 0,
            error: 'Voice cloning not supported by Deep Infra Chatterbox'
        };
    }

    setVoiceSettings(settings: VoiceSettings): void {
        this.voiceSettings = { ...this.voiceSettings, ...settings };
    }

    isAvailable(): boolean {
        // This is synchronous per the interface
        // We'll assume availability if the client is constructed
        return true;
    }

    /**
     * Validate Deep Infra API key by making a test request
     */
    async validateApiKey(): Promise<boolean> {
        try {
            const apiKey = await this.apiKeyManager.getApiKey('deepinfra');
            if (!apiKey) return false;

            // Make a minimal test request
            const response = await fetch(`${this.baseUrl}/${this.modelId}`, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    text: 'test',
                    voice: 'default',
                    output_format: 'mp3'
                })
            });

            return response.ok || response.status === 400; // 400 might be due to minimal test data, but key is valid
        } catch (error) {
            console.error('Deep Infra API key validation failed:', error);
            ErrorReportingService.getInstance().captureError(error instanceof Error ? error : new Error(String(error)), {
                category: ErrorCategory.API,
                severity: ErrorSeverity.MEDIUM,
                component: 'DeepInfraChatterboxClient',
                context: { action: 'validateApiKey' }
            });
            return false;
        }
    }

    /**
     * Wrap raw PCM data with a WAV header
     * Assumes 16-bit PCM, mono
     */
    private wrapRawPCMWithWAVHeader(rawPCM: Buffer, sampleRate: number = 22050): Buffer {
        const numChannels = 1;
        const bitsPerSample = 16;
        const byteRate = sampleRate * numChannels * bitsPerSample / 8;
        const blockAlign = numChannels * bitsPerSample / 8;
        const dataSize = rawPCM.length;
        const fileSize = 36 + dataSize;

        const header = Buffer.alloc(44);

        // RIFF header
        header.write('RIFF', 0);
        header.writeUInt32LE(fileSize, 4);
        header.write('WAVE', 8);

        // fmt chunk
        header.write('fmt ', 12);
        header.writeUInt32LE(16, 16); // fmt chunk size
        header.writeUInt16LE(1, 20); // audio format (1 = PCM)
        header.writeUInt16LE(numChannels, 22);
        header.writeUInt32LE(sampleRate, 24);
        header.writeUInt32LE(byteRate, 28);
        header.writeUInt16LE(blockAlign, 32);
        header.writeUInt16LE(bitsPerSample, 34);

        // data chunk
        header.write('data', 36);
        header.writeUInt32LE(dataSize, 40);

        return Buffer.concat([header, rawPCM]);
    }

    /**
     * Get supported languages for Chatterbox
     */
    getSupportedLanguages(): { code: string; name: string }[] {
        return [
            { code: 'en', name: 'English' },
            { code: 'es', name: 'Spanish' },
            { code: 'fr', name: 'French' },
            { code: 'de', name: 'German' },
            { code: 'it', name: 'Italian' },
            { code: 'pt', name: 'Portuguese' },
            { code: 'ru', name: 'Russian' },
            { code: 'ja', name: 'Japanese' },
            { code: 'ko', name: 'Korean' },
            { code: 'zh', name: 'Chinese' }
        ];
    }
}
