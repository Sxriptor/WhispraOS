/**
 * Parallel TTS Processor
 * Processes multiple text chunks concurrently for lower latency
 * While chunk 1 is playing, chunk 2 is being synthesized in the background
 */

import { StreamingTTSService } from './StreamingTTSService';
import { ConfigurationManager } from './ConfigurationManager';

interface TTSChunk {
    id: number;
    text: string;
    voiceId: string;
    modelId?: string;
}

interface ProcessingChunk extends TTSChunk {
    status: 'queued' | 'processing' | 'ready' | 'playing' | 'complete' | 'error';
    audioData?: ArrayBuffer;
    player?: any; // ElevenLabsStreamPlayer
    error?: string;
    startTime?: number;
    endTime?: number;
}

export class ParallelTTSProcessor {
    private streamingTTS: StreamingTTSService;
    private chunks: Map<number, ProcessingChunk> = new Map();
    private processingQueue: number[] = [];
    private playbackQueue: number[] = [];
    private maxConcurrentProcessing: number = 3; // Process up to 3 chunks simultaneously
    private currentlyProcessing: number = 0;
    private currentlyPlaying: number | null = null;
    private isActive: boolean = false;

    constructor(configManager: ConfigurationManager) {
        this.streamingTTS = new StreamingTTSService(configManager);
    }

    /**
     * Add a text chunk to be processed
     */
    addChunk(text: string, voiceId: string, modelId?: string): number {
        const id = this.chunks.size;
        const chunk: ProcessingChunk = {
            id,
            text,
            voiceId,
            modelId,
            status: 'queued'
        };

        this.chunks.set(id, chunk);
        this.processingQueue.push(id);
        this.playbackQueue.push(id);

        console.log(`📝 Chunk ${id} queued: "${text.substring(0, 50)}..."`);

        // Start processing if not already active
        if (!this.isActive) {
            this.isActive = true;
            this.startProcessing();
            this.startPlayback();
        } else {
            // Trigger processing for new chunk
            this.processNextChunks();
        }

        return id;
    }

    /**
     * Start processing chunks in parallel
     */
    private async startProcessing(): Promise<void> {
        console.log('🚀 Starting parallel TTS processing');
        
        while (this.isActive) {
            await this.processNextChunks();
            
            // Wait a bit before checking again
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Stop if no more chunks to process
            if (this.processingQueue.length === 0 && this.currentlyProcessing === 0) {
                break;
            }
        }
        
        console.log('✅ Processing complete');
    }

    /**
     * Process next chunks up to max concurrent limit
     */
    private async processNextChunks(): Promise<void> {
        while (
            this.currentlyProcessing < this.maxConcurrentProcessing &&
            this.processingQueue.length > 0
        ) {
            const chunkId = this.processingQueue.shift();
            if (chunkId === undefined) break;

            const chunk = this.chunks.get(chunkId);
            if (!chunk || chunk.status !== 'queued') continue;

            // Start processing this chunk
            this.currentlyProcessing++;
            this.processChunk(chunk).finally(() => {
                this.currentlyProcessing--;
            });
        }
    }

    /**
     * Process a single chunk (convert text to speech)
     */
    private async processChunk(chunk: ProcessingChunk): Promise<void> {
        try {
            chunk.status = 'processing';
            chunk.startTime = Date.now();
            
            console.log(`🔄 Processing chunk ${chunk.id} in background...`);

            // Use streaming TTS with real-time playback disabled (we'll handle playback separately)
            const audioData = await this.streamingTTS.synthesizeWithStreaming(
                chunk.text,
                chunk.voiceId,
                chunk.modelId
            );

            chunk.audioData = audioData;
            chunk.status = 'ready';
            chunk.endTime = Date.now();

            const processingTime = chunk.endTime - chunk.startTime;
            console.log(`✅ Chunk ${chunk.id} ready (${processingTime}ms, ${audioData.byteLength} bytes)`);

        } catch (error) {
            chunk.status = 'error';
            chunk.error = error instanceof Error ? error.message : 'Unknown error';
            console.error(`❌ Chunk ${chunk.id} failed:`, error);
        }
    }

    /**
     * Start playback queue (plays chunks in order as they become ready)
     */
    private async startPlayback(): Promise<void> {
        console.log('🔊 Starting playback queue');

        while (this.isActive) {
            // Get next chunk to play
            if (this.playbackQueue.length === 0) {
                // No more chunks to play
                if (this.currentlyPlaying === null && this.processingQueue.length === 0) {
                    break;
                }
                await new Promise(resolve => setTimeout(resolve, 100));
                continue;
            }

            const chunkId = this.playbackQueue[0];
            const chunk = this.chunks.get(chunkId);

            if (!chunk) {
                this.playbackQueue.shift();
                continue;
            }

            // Wait for chunk to be ready
            if (chunk.status === 'queued' || chunk.status === 'processing') {
                await new Promise(resolve => setTimeout(resolve, 50));
                continue;
            }

            // Skip failed chunks
            if (chunk.status === 'error') {
                console.warn(`⚠️ Skipping failed chunk ${chunk.id}`);
                this.playbackQueue.shift();
                continue;
            }

            // Play the chunk
            if (chunk.status === 'ready' && chunk.audioData) {
                this.playbackQueue.shift();
                await this.playChunk(chunk);
            }
        }

        console.log('✅ Playback complete');
    }

    /**
     * Play a single chunk
     */
    private async playChunk(chunk: ProcessingChunk): Promise<void> {
        if (!chunk.audioData) {
            console.error(`❌ Chunk ${chunk.id} has no audio data`);
            return;
        }

        try {
            this.currentlyPlaying = chunk.id;
            chunk.status = 'playing';
            
            console.log(`🔊 Playing chunk ${chunk.id}...`);

            // Create player for this chunk
            const { ElevenLabsStreamPlayer } = require('./ElevenLabsStreamPlayer');
            const player = new ElevenLabsStreamPlayer();
            chunk.player = player;

            // Append all audio data at once (it's already complete from streaming)
            player.appendChunk(chunk.audioData);
            player.end();

            // Estimate playback duration (PCM 44.1kHz, 16-bit, mono)
            const bytesPerSecond = 44100 * 2; // 16-bit = 2 bytes per sample
            const durationMs = (chunk.audioData.byteLength / bytesPerSecond) * 1000;

            // Wait for playback to complete (with a small buffer)
            await new Promise(resolve => setTimeout(resolve, durationMs + 500));

            chunk.status = 'complete';
            this.currentlyPlaying = null;
            
            console.log(`✅ Chunk ${chunk.id} playback complete`);

        } catch (error) {
            chunk.status = 'error';
            chunk.error = error instanceof Error ? error.message : 'Playback error';
            console.error(`❌ Chunk ${chunk.id} playback failed:`, error);
            this.currentlyPlaying = null;
        }
    }

    /**
     * Stop all processing and playback
     */
    stop(): void {
        console.log('🛑 Stopping parallel TTS processor');
        
        this.isActive = false;
        this.processingQueue = [];
        this.playbackQueue = [];
        this.currentlyProcessing = 0;

        // Stop any currently playing chunk
        if (this.currentlyPlaying !== null) {
            const chunk = this.chunks.get(this.currentlyPlaying);
            if (chunk?.player) {
                chunk.player.stop();
            }
            this.currentlyPlaying = null;
        }

        // Stop all players
        this.chunks.forEach(chunk => {
            if (chunk.player) {
                chunk.player.stop();
            }
        });

        this.chunks.clear();
    }

    /**
     * Get status of all chunks
     */
    getStatus(): { id: number; status: string; text: string }[] {
        return Array.from(this.chunks.values()).map(chunk => ({
            id: chunk.id,
            status: chunk.status,
            text: chunk.text.substring(0, 50) + (chunk.text.length > 50 ? '...' : '')
        }));
    }

    /**
     * Check if processor is currently active
     */
    isProcessing(): boolean {
        return this.isActive;
    }

    /**
     * Get statistics
     */
    getStats(): {
        totalChunks: number;
        queued: number;
        processing: number;
        ready: number;
        playing: number;
        complete: number;
        errors: number;
    } {
        const stats = {
            totalChunks: this.chunks.size,
            queued: 0,
            processing: 0,
            ready: 0,
            playing: 0,
            complete: 0,
            errors: 0
        };

        this.chunks.forEach(chunk => {
            switch (chunk.status) {
                case 'queued': stats.queued++; break;
                case 'processing': stats.processing++; break;
                case 'ready': stats.ready++; break;
                case 'playing': stats.playing++; break;
                case 'complete': stats.complete++; break;
                case 'error': stats.errors++; break;
            }
        });

        return stats;
    }
}
