/**
 * Streaming audio player for ElevenLabs TTS chunks
 * Uses MediaSource API for seamless MP3 streaming
 */
export class StreamingAudioPlayer {
    private mediaSource: MediaSource | null = null;
    private sourceBuffer: SourceBuffer | null = null;
    private audioElement: HTMLAudioElement | null = null;
    private chunkQueue: ArrayBuffer[] = [];
    private isPlaying: boolean = false;
    private isInitialized: boolean = false;
    private volume: number = 1.0;
    private mimeType: string = 'audio/mpeg';
    private outputDeviceId: string | null = null;

    constructor(volume: number = 1.0, outputDeviceId?: string) {
        this.volume = volume;
        this.outputDeviceId = outputDeviceId || null;
    }

    /**
     * Initialize the audio player with MediaSource
     */
    private initialize(): void {
        if (this.isInitialized) {
            return;
        }

        try {
            // Check if MediaSource is supported
            if (!window.MediaSource || !MediaSource.isTypeSupported(this.mimeType)) {
                console.warn('⚠️ MediaSource API not supported, falling back to simple player');
                this.initializeSimplePlayer();
                return;
            }

            this.audioElement = new Audio();
            this.audioElement.volume = this.volume;
            this.mediaSource = new MediaSource();
            const url = URL.createObjectURL(this.mediaSource);
            this.audioElement.src = url;

            this.mediaSource.addEventListener('sourceopen', () => {
                try {
                    if (this.mediaSource && this.mediaSource.readyState === 'open') {
                        this.sourceBuffer = this.mediaSource.addSourceBuffer(this.mimeType);
                        this.sourceBuffer.mode = 'sequence';
                        
                        this.sourceBuffer.addEventListener('updateend', () => {
                            if (this.chunkQueue.length > 0 && !this.sourceBuffer?.updating) {
                                this.processChunkQueue();
                            }
                        });

                        // Process any queued chunks
                        if (this.chunkQueue.length > 0) {
                            this.processChunkQueue();
                        }
                    }
                } catch (error) {
                    console.error('❌ Error setting up source buffer:', error);
                    this.initializeSimplePlayer();
                }
            });

            this.mediaSource.addEventListener('error', (error) => {
                console.warn('⚠️ MediaSource error:', error);
                this.initializeSimplePlayer();
            });

            this.isInitialized = true;
            console.log('✅ Streaming audio player initialized with MediaSource');
        } catch (error) {
            console.error('❌ Failed to initialize MediaSource player:', error);
            this.initializeSimplePlayer();
        }
    }

    /**
     * Fallback simple player (buffers chunks and plays when ready)
     */
    private initializeSimplePlayer(): void {
        this.audioElement = new Audio();
        this.audioElement.volume = this.volume;
        this.audioElement.preload = 'auto';
        
        this.audioElement.onended = () => {
            this.isPlaying = false;
            console.log('✅ Streaming audio playback completed');
        };

        this.audioElement.onerror = (error) => {
            console.warn('⚠️ Audio playback error:', error);
        };

        this.isInitialized = true;
        console.log('✅ Streaming audio player initialized (simple mode)');
    }

    /**
     * Process the chunk queue
     */
    private processChunkQueue(): void {
        if (!this.sourceBuffer || this.sourceBuffer.updating || this.chunkQueue.length === 0) {
            return;
        }

        try {
            const chunk = this.chunkQueue.shift();
            if (chunk) {
                this.sourceBuffer.appendBuffer(chunk);
                console.log(`📦 Appended chunk to source buffer, ${this.chunkQueue.length} remaining`);
            }
        } catch (error) {
            console.error('❌ Error appending buffer:', error);
        }
    }

    /**
     * Add an audio chunk to the queue for playback
     * Strategy: Buffer all chunks, only play when complete to avoid MP3 fragmentation issues
     */
    async addChunk(chunk: ArrayBuffer, chunkIndex: number = 0, isFinal: boolean = false): Promise<void> {
        try {
            // Just buffer the chunk - don't try to play yet
            this.chunkQueue.push(chunk);

            console.log(`📦 Buffered chunk ${chunkIndex}, total: ${this.chunkQueue.length}${isFinal ? ' (FINAL)' : ''}`);

            // Only initialize and play when we have all chunks (isFinal=true or explicit flush())
            if (!isFinal) {
                return; // Wait for more chunks
            }

            // isFinal is true - we have all chunks, now combine and play
            console.log(`🎵 All chunks received, combining ${this.chunkQueue.length} chunks...`);

            if (!this.isInitialized) {
                this.initialize();
            }

            if (!this.audioElement) {
                console.warn('⚠️ Audio player not initialized, skipping playback');
                return;
            }

            // Combine all chunks into one complete MP3 file
            const totalSize = this.chunkQueue.reduce((sum, c) => sum + c.byteLength, 0);
            const combinedBuffer = new ArrayBuffer(totalSize);
            const combinedView = new Uint8Array(combinedBuffer);

            let offset = 0;
            for (const c of this.chunkQueue) {
                const chunkView = new Uint8Array(c);
                combinedView.set(chunkView, offset);
                offset += c.byteLength;
            }

            // Create blob from complete MP3
            const blob = new Blob([combinedBuffer], { type: 'audio/mpeg' });
            const url = URL.createObjectURL(blob);

            // Clean up old URL if exists
            if (this.audioElement.src && this.audioElement.src.startsWith('blob:')) {
                URL.revokeObjectURL(this.audioElement.src);
            }

            // Set source and play
            this.audioElement.src = url;
            this.audioElement.load();

            try {
                this.isPlaying = true;
                await this.audioElement.play();
                console.log(`🔊 Playing complete MP3 (${totalSize} bytes, ${this.chunkQueue.length} chunks combined)`);
            } catch (error) {
                console.error('❌ Failed to play combined audio:', error);
                this.isPlaying = false;
            }

        } catch (error) {
            console.error(`❌ Error adding chunk ${chunkIndex}:`, error);
        }
    }

    /**
     * Update simple player source with all current chunks
     */
    private updateSimplePlayerSource(): void {
        if (this.chunkQueue.length === 0 || !this.audioElement) {
            return;
        }

        try {
            // Combine all chunks
            const totalSize = this.chunkQueue.reduce((sum, c) => sum + c.byteLength, 0);
            const combinedBuffer = new ArrayBuffer(totalSize);
            const combinedView = new Uint8Array(combinedBuffer);

            let offset = 0;
            for (const chunk of this.chunkQueue) {
                const chunkView = new Uint8Array(chunk);
                combinedView.set(chunkView, offset);
                offset += chunk.byteLength;
            }

            // Create blob and update source
            const blob = new Blob([combinedBuffer], { type: 'audio/mpeg' });
            const url = URL.createObjectURL(blob);

            const wasPlaying = this.isPlaying && !this.audioElement.paused;
            const currentTime = wasPlaying ? this.audioElement.currentTime : 0;

            // Clean up old URL
            if (this.audioElement.src && this.audioElement.src.startsWith('blob:')) {
                URL.revokeObjectURL(this.audioElement.src);
            }

            this.audioElement.src = url;
            this.audioElement.load();

            // Resume playback
            if (wasPlaying) {
                this.audioElement.currentTime = Math.min(currentTime, this.audioElement.duration || 0);
                this.audioElement.play().catch(e => {
                    console.warn('⚠️ Play error:', e);
                    this.isPlaying = false;
                });
            } else if (!this.isPlaying && this.chunkQueue.length > 0) {
                this.startPlayback();
            }
        } catch (error) {
            console.error('❌ Error updating simple player source:', error);
        }
    }

    /**
     * Start playback
     */
    private async startPlayback(): Promise<void> {
        if (this.isPlaying || !this.audioElement || this.chunkQueue.length === 0) {
            return;
        }

        try {
            // For simple player, make sure source is updated
            if (!this.mediaSource && this.chunkQueue.length > 0) {
                this.updateSimplePlayerSource();
            }

            this.isPlaying = true;
            await this.audioElement.play();
            console.log('🔊 Started streaming audio playback');
        } catch (error) {
            console.error('❌ Failed to start playback:', error);
            this.isPlaying = false;
            
            // Retry after a short delay
            setTimeout(() => {
                if (!this.isPlaying && this.chunkQueue.length > 0) {
                    this.startPlayback();
                }
            }, 100);
        }
    }

    /**
     * Flush all remaining chunks in the queue
     * Call this when streaming is complete to combine and play all buffered chunks
     */
    async flush(): Promise<void> {
        console.log(`🔄 Flushing ${this.chunkQueue.length} buffered chunks...`);

        if (this.chunkQueue.length === 0) {
            console.log('✅ No chunks to flush');
            return;
        }

        if (!this.isInitialized) {
            this.initialize();
        }

        if (!this.audioElement) {
            console.warn('⚠️ Audio player not initialized, skipping flush');
            return;
        }

        // Combine all chunks into one complete MP3 file
        const totalSize = this.chunkQueue.reduce((sum, c) => sum + c.byteLength, 0);
        const combinedBuffer = new ArrayBuffer(totalSize);
        const combinedView = new Uint8Array(combinedBuffer);

        let offset = 0;
        for (const c of this.chunkQueue) {
            const chunkView = new Uint8Array(c);
            combinedView.set(chunkView, offset);
            offset += c.byteLength;
        }

        console.log(`🎵 Combined ${this.chunkQueue.length} chunks into ${totalSize} bytes`);

        // Create blob from complete MP3
        const blob = new Blob([combinedBuffer], { type: 'audio/mpeg' });
        const url = URL.createObjectURL(blob);

        // Clean up old URL if exists
        if (this.audioElement.src && this.audioElement.src.startsWith('blob:')) {
            URL.revokeObjectURL(this.audioElement.src);
        }

        // Set source and play
        this.audioElement.src = url;
        this.audioElement.load();

        // Route to specific output device if specified (e.g., VB-Audio Cable to avoid feedback loop)
        if (this.outputDeviceId && 'setSinkId' in this.audioElement) {
            try {
                await (this.audioElement as any).setSinkId(this.outputDeviceId);
                console.log(`🔊 Routed audio to device: ${this.outputDeviceId}`);
            } catch (e) {
                console.warn('⚠️ Failed to set audio output device:', e);
            }
        }

        try {
            this.isPlaying = true;
            await this.audioElement.play();
            console.log(`🔊 Playing complete MP3 (${totalSize} bytes, ${this.chunkQueue.length} chunks combined)`);
        } catch (error) {
            console.error('❌ Failed to play combined audio:', error);
            this.isPlaying = false;
        }
    }

    /**
     * Stop playback and clear queue
     */
    stop(): void {
        this.isPlaying = false;

        if (this.audioElement) {
            this.audioElement.pause();
            this.audioElement.currentTime = 0;
        }

        if (this.sourceBuffer && this.mediaSource && this.mediaSource.readyState === 'open') {
            try {
                this.mediaSource.endOfStream();
            } catch (e) {
                // Ignore errors
            }
        }

        this.chunkQueue = [];
        console.log('🛑 Streaming audio player stopped');
    }

    /**
     * Set volume (0.0 to 1.0)
     */
    setVolume(volume: number): void {
        this.volume = Math.max(0, Math.min(1, volume));
        if (this.audioElement) {
            this.audioElement.volume = this.volume;
        }
    }

    /**
     * Check if currently playing
     */
    isCurrentlyPlaying(): boolean {
        return this.isPlaying && this.audioElement !== null && !this.audioElement.paused;
    }

    /**
     * Clean up resources
     */
    cleanup(): void {
        this.stop();

        if (this.audioElement) {
            if (this.audioElement.src && this.audioElement.src.startsWith('blob:')) {
                URL.revokeObjectURL(this.audioElement.src);
            }
            this.audioElement.src = '';
            this.audioElement = null;
        }

        if (this.mediaSource) {
            if (this.mediaSource.readyState === 'open') {
                try {
                    this.mediaSource.endOfStream();
                } catch (e) {
                    // Ignore errors
                }
            }
            this.mediaSource = null;
        }

        this.sourceBuffer = null;
        this.isInitialized = false;
        console.log('🧹 Streaming audio player cleaned up');
    }
}

