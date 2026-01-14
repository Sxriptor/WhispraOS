import { TextToSpeechManager } from './TextToSpeechManager';
import { ConfigurationManager } from './ConfigurationManager';

/**
 * Service for handling streaming text-to-speech with real-time audio chunk processing
 */
export class StreamingTTSService {
    private ttsManager: TextToSpeechManager;
    private configManager: ConfigurationManager;
    private audioChunks: ArrayBuffer[] = [];
    private isStreaming: boolean = false;

    constructor(configManager: ConfigurationManager) {
        this.configManager = configManager;
        this.ttsManager = new TextToSpeechManager(configManager);
    }

    /**
     * Synthesize text using streaming API with real-time chunk processing
     * @param text - Text to synthesize
     * @param voiceId - Voice ID to use
     * @param modelId - Optional model ID
     * @param onAudioChunk - Callback for each audio chunk (for real-time playback)
     * @param onProgress - Optional progress callback
     * @param onComplete - Optional callback when streaming completes
     * @returns Promise that resolves when streaming is complete
     */
    async synthesizeWithStreaming(
        text: string,
        voiceId: string,
        modelId?: string,
        onAudioChunk?: (chunk: ArrayBuffer, chunkIndex: number, isFinal: boolean) => void,
        onProgress?: (progress: { chunksReceived: number, totalBytes: number }) => void,
        onComplete?: () => void
    ): Promise<ArrayBuffer> {
        return new Promise((resolve, reject) => {
            this.audioChunks = [];
            this.isStreaming = true;
            let chunkIndex = 0;
            let totalBytes = 0;
            let lastChunkIndex = -1;

            const handleChunk = (chunk: ArrayBuffer) => {
                if (!this.isStreaming) return;

                this.audioChunks.push(chunk);
                totalBytes += chunk.byteLength;
                const currentIndex = chunkIndex;
                chunkIndex++;
                lastChunkIndex = currentIndex;

                console.log(`📦 Received TTS chunk ${chunkIndex}: ${chunk.byteLength} bytes`);

                // Call the real-time chunk handler (for immediate playback)
                // Pass false for isFinal since we're still receiving chunks
                onAudioChunk?.(chunk, currentIndex, false);

                // Call progress callback
                onProgress?.({
                    chunksReceived: chunkIndex,
                    totalBytes: totalBytes
                });
            };

            const handleComplete = () => {
                this.isStreaming = false;
                console.log(`✅ TTS streaming complete: ${chunkIndex} chunks, ${totalBytes} total bytes`);

                // Call completion callback to signal streaming is done
                // The completion callback will handle sending the final signal to renderer
                onComplete?.();

                // Combine all chunks into a single ArrayBuffer
                const combinedBuffer = this.combineAudioChunks(this.audioChunks);
                resolve(combinedBuffer);
            };

            const handleError = (error: Error) => {
                this.isStreaming = false;
                console.error('❌ TTS streaming error:', error);
                reject(error);
            };

            // Start streaming synthesis
            this.ttsManager.synthesizeStream(
                text,
                voiceId,
                modelId,
                handleChunk,
                handleComplete,
                handleError
            ).catch(reject);
        });
    }

    /**
     * Synthesize text with streaming and immediate audio playback
     * This method plays audio chunks as they arrive for the lowest latency
     */
    async synthesizeWithRealTimePlayback(
        text: string,
        voiceId: string,
        modelId?: string,
        audioContext?: AudioContext,
        onFirstChunk?: () => void
    ): Promise<ArrayBuffer> {
        let firstChunkReceived = false;

        return this.synthesizeWithStreaming(
            text,
            voiceId,
            modelId,
            async (chunk, chunkIndex) => {
                // Handle first chunk callback
                if (!firstChunkReceived) {
                    firstChunkReceived = true;
                    onFirstChunk?.();
                }

                // Play chunk immediately if audio context is provided
                if (audioContext) {
                    try {
                        await this.playAudioChunk(chunk, audioContext);
                    } catch (error) {
                        console.warn(`Failed to play audio chunk ${chunkIndex}:`, error);
                    }
                }
            },
            (progress) => {
                console.log(`🎵 Streaming progress: ${progress.chunksReceived} chunks, ${progress.totalBytes} bytes`);
            }
        );
    }

    /**
     * Play an audio chunk immediately using Web Audio API
     */
    private async playAudioChunk(chunk: ArrayBuffer, audioContext: AudioContext): Promise<void> {
        try {
            const audioBuffer = await audioContext.decodeAudioData(chunk.slice(0));
            const source = audioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(audioContext.destination);
            source.start();
        } catch (error) {
            console.warn('Failed to decode/play audio chunk:', error);
            // This might happen if the chunk is not a complete audio frame
            // In a production implementation, you might want to buffer incomplete chunks
        }
    }

    /**
     * Combine multiple audio chunks into a single ArrayBuffer
     */
    private combineAudioChunks(chunks: ArrayBuffer[]): ArrayBuffer {
        if (chunks.length === 0) {
            return new ArrayBuffer(0);
        }

        if (chunks.length === 1) {
            return chunks[0];
        }

        // Calculate total size
        const totalSize = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);

        // Create combined buffer
        const combined = new ArrayBuffer(totalSize);
        const combinedView = new Uint8Array(combined);

        let offset = 0;
        for (const chunk of chunks) {
            const chunkView = new Uint8Array(chunk);
            combinedView.set(chunkView, offset);
            offset += chunk.byteLength;
        }

        return combined;
    }

    /**
     * Stop current streaming operation
     */
    stopStreaming(): void {
        this.isStreaming = false;
        this.audioChunks = [];
    }

    /**
     * Check if streaming is currently active
     */
    isCurrentlyStreaming(): boolean {
        return this.isStreaming;
    }

    /**
     * Get the current TTS provider type
     */
    async getCurrentProvider(): Promise<'elevenlabs' | 'deepinfra' | null> {
        return await this.ttsManager.getCurrentProvider();
    }

    /**
     * Check if streaming is supported by the current provider
     */
    async isStreamingSupported(): Promise<boolean> {
        const provider = await this.getCurrentProvider();
        // Currently only ElevenLabs supports streaming
        return provider === 'elevenlabs';
    }

    /**
     * Get available voices
     */
    async getAvailableVoices() {
        return await this.ttsManager.getAvailableVoices();
    }

    /**
     * Example usage method showing how to integrate streaming TTS
     */
    async exampleStreamingUsage(text: string): Promise<void> {
        try {
            console.log('🎤 Starting streaming TTS example...');

            // Check if streaming is supported
            const streamingSupported = await this.isStreamingSupported();
            if (!streamingSupported) {
                console.log('⚠️ Streaming not supported by current provider, using regular synthesis');
                const voices = await this.getAvailableVoices();
                const voiceId = voices[0]?.id || 'pNInz6obpgDQGcFmaJgB';
                const result = await this.ttsManager.synthesize(text, voiceId);
                console.log(`✅ Regular synthesis complete: ${result.byteLength} bytes`);
                return;
            }

            // Get available voices
            const voices = await this.getAvailableVoices();
            const voiceId = voices[0]?.id || 'pNInz6obpgDQGcFmaJgB';

            console.log(`🎵 Using voice: ${voices[0]?.name || 'Default'} (${voiceId})`);

            // Create audio context for real-time playback (optional)
            const audioContext = new AudioContext();

            // Start streaming synthesis with real-time playback
            const startTime = Date.now();
            const result = await this.synthesizeWithRealTimePlayback(
                text,
                voiceId,
                'eleven_v3', // Use latest model
                audioContext,
                () => {
                    const firstChunkTime = Date.now() - startTime;
                    console.log(`🚀 First audio chunk received in ${firstChunkTime}ms (Time to First Byte)`);
                }
            );

            const totalTime = Date.now() - startTime;
            console.log(`✅ Streaming synthesis complete: ${result.byteLength} bytes in ${totalTime}ms`);

            // Close audio context
            await audioContext.close();

        } catch (error) {
            console.error('❌ Streaming TTS example failed:', error);
        }
    }
}