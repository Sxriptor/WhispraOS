/**
 * Bidirectional TTS Processor
 * Processes multiple text chunks concurrently for lower latency in bidirectional mode
 * While chunk 1 is playing, chunk 2 is being synthesized in the background
 * Separate from ParallelTTSProcessor to avoid conflicts between translate and bidirectional modes
 * 
 * NOTE: This runs in RENDERER process via IPC, not main process
 */

interface BidiTTSChunk {
    id: number;
    text: string;
    voiceId: string;
    modelId?: string;
    originalText?: string;
    detectedLanguage?: string;
    sinkId?: string;
}

interface BidiProcessingChunk extends BidiTTSChunk {
    status: 'queued' | 'processing' | 'ready' | 'playing' | 'complete' | 'error';
    audioData?: ArrayBuffer;
    error?: string;
    startTime?: number;
    endTime?: number;
    transcriptionTime?: number;
    translationTime?: number;
    ttsTime?: number;
}

export class BidirectionalTTSProcessor {
    private chunks: Map<number, BidiProcessingChunk> = new Map();
    private processingQueue: number[] = [];
    private playbackQueue: number[] = [];
    private maxConcurrentProcessing: number = 3; // ElevenLabs allows 3 concurrent TTS API calls (playback doesn't count as API call)
    private currentlyProcessing: number = 0;
    private currentlyPlaying: number | null = null;
    private isActive: boolean = false;
    private onChunkComplete?: (chunk: BidiProcessingChunk) => void;
    private onUIUpdate?: (stats: { queued: number; processing: number; ready: number; playing: number }) => void;
    private playbackHandler?: (audioData: number[], sinkId?: string, text?: string) => Promise<void>;
    private electronAPI: any;
    private ttsQueue: Array<() => Promise<void>> = []; // Queue for serializing TTS API calls
    private isTTSProcessing: boolean = false;

    constructor(electronAPI: any) {
        this.electronAPI = electronAPI;
    }

    /**
     * Set callback for when a chunk completes processing
     */
    setChunkCompleteCallback(callback: (chunk: BidiProcessingChunk) => void): void {
        this.onChunkComplete = callback;
    }

    /**
     * Set callback for UI updates
     */
    setUIUpdateCallback(callback: (stats: { queued: number; processing: number; ready: number; playing: number }) => void): void {
        this.onUIUpdate = callback;
    }

    /**
     * Set playback handler for audio output
     */
    setPlaybackHandler(handler: (audioData: number[], sinkId?: string, text?: string) => Promise<void>): void {
        this.playbackHandler = handler;
    }

    /**
     * Add a text chunk to be processed
     */
    addChunk(text: string, voiceId: string, modelId?: string, originalText?: string, detectedLanguage?: string, sinkId?: string): number {
        const id = this.chunks.size;
        const chunk: BidiProcessingChunk = {
            id,
            text,
            voiceId,
            modelId,
            originalText,
            detectedLanguage,
            sinkId,
            status: 'queued'
        };

        this.chunks.set(id, chunk);
        this.processingQueue.push(id);
        this.playbackQueue.push(id);

        console.log(`📝 [Bidi] Chunk ${id} queued: "${text.substring(0, 50)}..."`);

        // Start processing if not already active
        if (!this.isActive) {
            this.isActive = true;
            this.startProcessing();
            this.startPlayback();
        } else {
            // Trigger processing for new chunk immediately
            this.processNextChunks();
            // Also ensure TTS queue continues processing
            this.processTTSQueue();
        }

        this.updateUI();
        return id;
    }

    /**
     * Start processing chunks in parallel
     */
    private async startProcessing(): Promise<void> {
        console.log('🚀 [Bidi] Starting parallel TTS processing');
        
        // Keep processing until explicitly stopped (isActive = false)
        while (this.isActive) {
            await this.processNextChunks();
            
            // Also ensure TTS queue is being processed
            // This handles cases where processTTSQueue exits prematurely
            if (this.ttsQueue.length > 0 && this.currentlyProcessing < this.maxConcurrentProcessing) {
                console.log(`[Bidi] Restarting TTS queue processing: ${this.ttsQueue.length} queued, ${this.currentlyProcessing}/3 active`);
                this.processTTSQueue();
            }
            
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Don't break even if queues are empty - wait for more chunks
            // Only stop when isActive becomes false
        }
        
        console.log('✅ [Bidi] Processing loop ended (bidirectional stopped)');
    }

    /**
     * Process next chunks - add to TTS queue
     */
    private async processNextChunks(): Promise<void> {
        let addedChunks = 0;
        while (this.processingQueue.length > 0) {
            const chunkId = this.processingQueue.shift();
            if (chunkId === undefined) break;

            const chunk = this.chunks.get(chunkId);
            if (!chunk || chunk.status !== 'queued') continue;

            // Add to processing (will be queued in TTS queue)
            this.processChunk(chunk);
            addedChunks++;
        }
        
        // Kick off TTS queue processing after adding chunks
        if (addedChunks > 0) {
            console.log(`[Bidi] Added ${addedChunks} chunks to TTS queue, starting processing...`);
            this.processTTSQueue();
        }
    }

    /**
     * Process TTS queue with limited concurrency (2 at a time: 1 playing, 1 synthesizing)
     */
    private async processTTSQueue(): Promise<void> {
        console.log(`[Bidi] processTTSQueue called: active=${this.isActive}, queue=${this.ttsQueue.length}, slots=${this.currentlyProcessing}/${this.maxConcurrentProcessing}`);
        
        // Process tasks while we have slots and tasks in queue
        while (this.isActive && this.ttsQueue.length > 0 && this.currentlyProcessing < this.maxConcurrentProcessing) {
            const task = this.ttsQueue.shift();
            if (task) {
                // Increment counter BEFORE starting task
                this.currentlyProcessing++;
                console.log(`[Bidi] 🚀 Starting TTS task: ${this.currentlyProcessing}/3 active, ${this.ttsQueue.length} queued`);
                
                // Fire and forget - allow concurrent processing
                task()
                    .catch(error => {
                        console.error('[Bidi] TTS queue task failed:', error);
                    })
                    .finally(() => {
                        // Decrement counter FIRST
                        this.currentlyProcessing--;
                        console.log(`[Bidi] ✅ TTS task complete: ${this.currentlyProcessing}/3 active, ${this.ttsQueue.length} in queue, ${this.processingQueue.length} in processing`);
                        
                        // Immediately trigger next processing cycle
                        // Use setTimeout 0 for browser compatibility (renderer process)
                        setTimeout(() => {
                            if (!this.isActive) {
                                console.log(`[Bidi] Not active, skipping queue continuation`);
                                return;
                            }
                            
                            console.log(`[Bidi] 🔍 Checking for more work: ttsQueue=${this.ttsQueue.length}, processingQueue=${this.processingQueue.length}, slots=${this.currentlyProcessing}/3`);
                            
                            // Check if there are more chunks in processingQueue to add
                            if (this.processingQueue.length > 0) {
                                console.log(`[Bidi] 📝 Processing ${this.processingQueue.length} chunks from processing queue`);
                                this.processNextChunks();
                            }
                            
                            // Continue processing TTS queue if we have capacity and tasks
                            if (this.ttsQueue.length > 0 && this.currentlyProcessing < this.maxConcurrentProcessing) {
                                console.log(`[Bidi] 🔄 Restarting TTS queue: ${this.ttsQueue.length} tasks, ${this.currentlyProcessing}/3 slots`);
                                this.processTTSQueue();
                            }
                        }, 0);
                    });
            } else {
                break;
            }
        }
        
        console.log(`[Bidi] processTTSQueue finished: active=${this.currentlyProcessing}, queued=${this.ttsQueue.length}`);
    }

    /**
     * Process a single chunk via IPC (queued to prevent concurrent API calls)
     */
    private processChunk(chunk: BidiProcessingChunk): void {
        // Add to TTS queue to serialize API calls
        this.ttsQueue.push(async () => {
            try {
                chunk.status = 'processing';
                chunk.startTime = Date.now();
                
                console.log(`🔄 [Bidi] Synthesizing chunk ${chunk.id} (active: ${this.currentlyProcessing}/3, queued: ${this.ttsQueue.length})`);
                console.log(`   Text: "${chunk.text.substring(0, 80)}..."`);

                // Use IPC to synthesize TTS
                // Note: This respects ElevenLabs rate limits by limiting concurrent calls
                const response = await this.electronAPI.invoke('tts:synthesize', {
                    id: Date.now().toString(),
                    timestamp: Date.now(),
                    payload: {
                        text: chunk.text,
                        voiceId: chunk.voiceId,
                        modelId: chunk.modelId || 'eleven_v3'
                    }
                });

                // Log detailed response for debugging
                if (!response) {
                    throw new Error('TTS synthesis returned no response');
                }

                if (!response.success) {
                    const errorMsg = response.error || 'Unknown error';
                    console.error(`❌ [Bidi] TTS synthesis failed for chunk ${chunk.id}:`, {
                        error: errorMsg,
                        text: chunk.text.substring(0, 50) + '...',
                        voiceId: chunk.voiceId,
                        modelId: chunk.modelId,
                        response: response
                    });
                    throw new Error(`TTS synthesis failed: ${errorMsg}`);
                }

                if (!response.payload?.audioBuffer) {
                    console.error(`❌ [Bidi] TTS synthesis returned empty payload for chunk ${chunk.id}:`, {
                        response: response,
                        text: chunk.text.substring(0, 50) + '...'
                    });
                    throw new Error('TTS synthesis returned empty audio buffer');
                }

                // Convert number array to ArrayBuffer
                const audioArray = new Uint8Array(response.payload.audioBuffer);

                // Check if audio is empty (captions-only mode)
                if (audioArray.length === 0) {
                    console.log(`ℹ️ [Bidi] TTS returned empty audio for chunk ${chunk.id} (captions-only mode): "${chunk.text.substring(0, 50)}..."`);
                    chunk.status = 'complete'; // Mark as complete to skip playback
                    chunk.endTime = Date.now();
                    chunk.ttsTime = chunk.endTime - chunk.startTime;
                    return;
                }

                chunk.audioData = audioArray.buffer;
                chunk.status = 'ready';
                chunk.endTime = Date.now();
                chunk.ttsTime = chunk.endTime - chunk.startTime;

                console.log(`✅ [Bidi] Chunk ${chunk.id} ready (${chunk.ttsTime}ms, ${audioArray.byteLength} bytes): "${chunk.text.substring(0, 50)}..."`);

                if (this.onChunkComplete) {
                    this.onChunkComplete(chunk);
                }

            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';

                // Check if this is a captions-only mode error (no TTS provider available)
                if (errorMessage === 'CAPTIONS_ONLY_MODE') {
                    // In captions-only mode, skip TTS silently and mark as complete
                    console.log(`ℹ️ [Bidi] Skipping TTS for chunk ${chunk.id} (captions-only mode): "${chunk.text.substring(0, 50)}..."`);
                    chunk.status = 'complete'; // Mark as complete to skip playback
                    chunk.endTime = Date.now();
                    return;
                }

                chunk.status = 'error';
                chunk.error = errorMessage;
                chunk.endTime = Date.now();

                // Log detailed error information
                console.error(`❌ [Bidi] Chunk ${chunk.id} failed:`, {
                    error: chunk.error,
                    text: chunk.text.substring(0, 100),
                    voiceId: chunk.voiceId,
                    modelId: chunk.modelId,
                    originalText: chunk.originalText?.substring(0, 50),
                    stack: error instanceof Error ? error.stack : undefined
                });
            }
        });
    }

    /**
     * Start playback queue
     */
    private async startPlayback(): Promise<void> {
        console.log('🔊 [Bidi] Starting playback queue');

        // Keep playing until explicitly stopped (isActive = false)
        while (this.isActive) {
            if (this.playbackQueue.length === 0) {
                // Wait for more chunks to be added
                await new Promise(resolve => setTimeout(resolve, 100));
                this.updateUI();
                continue;
            }

            const chunkId = this.playbackQueue[0];
            const chunk = this.chunks.get(chunkId);

            if (!chunk) {
                this.playbackQueue.shift();
                continue;
            }

            if (chunk.status === 'queued' || chunk.status === 'processing') {
                // Wait for chunk to be synthesized
                await new Promise(resolve => setTimeout(resolve, 50));
                this.updateUI();
                continue;
            }

            if (chunk.status === 'error') {
                console.warn(`⚠️ [Bidi] Skipping failed chunk ${chunk.id}: ${chunk.error || 'Unknown error'}`);
                console.warn(`   Text: "${chunk.text.substring(0, 100)}..."`);
                this.playbackQueue.shift();
                continue;
            }

            if (chunk.status === 'ready' && chunk.audioData) {
                this.playbackQueue.shift();
                await this.playChunk(chunk);
            }
        }

        console.log('✅ [Bidi] Playback loop ended (bidirectional stopped)');
    }

    /**
     * Play a single chunk
     */
    private async playChunk(chunk: BidiProcessingChunk): Promise<void> {
        if (!chunk.audioData) {
            console.error(`❌ [Bidi] Chunk ${chunk.id} has no audio data`);
            return;
        }

        try {
            this.currentlyPlaying = chunk.id;
            chunk.status = 'playing';
            this.updateUI();
            
            console.log(`🔊 [Bidi] Playing chunk ${chunk.id}...`);

            const audioArray = Array.from(new Uint8Array(chunk.audioData));

            if (this.playbackHandler) {
                await this.playbackHandler(audioArray, chunk.sinkId, chunk.text);
            }

            chunk.status = 'complete';
            this.currentlyPlaying = null;
            this.updateUI();
            
            console.log(`✅ [Bidi] Chunk ${chunk.id} playback complete`);

        } catch (error) {
            chunk.status = 'error';
            chunk.error = error instanceof Error ? error.message : 'Playback error';
            console.error(`❌ [Bidi] Chunk ${chunk.id} playback failed:`, error);
            this.currentlyPlaying = null;
            this.updateUI();
        }
    }

    /**
     * Update UI with current stats
     */
    private updateUI(): void {
        if (!this.onUIUpdate) return;

        const stats = {
            queued: 0,
            processing: 0,
            ready: 0,
            playing: 0
        };

        this.chunks.forEach(chunk => {
            switch (chunk.status) {
                case 'queued': stats.queued++; break;
                case 'processing': stats.processing++; break;
                case 'ready': stats.ready++; break;
                case 'playing': stats.playing++; break;
            }
        });

        this.onUIUpdate(stats);
    }

    /**
     * Stop all processing and playback
     */
    stop(): void {
        console.log('🛑 [Bidi] Stopping bidirectional TTS processor');
        
        this.isActive = false;
        this.processingQueue = [];
        this.playbackQueue = [];
        this.ttsQueue = []; // Clear TTS queue
        this.isTTSProcessing = false;
        this.currentlyProcessing = 0;
        this.currentlyPlaying = null;
        this.chunks.clear();
        this.updateUI();
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

    /**
     * Get total remaining chunks
     */
    getRemainingCount(): number {
        let count = 0;
        this.chunks.forEach(chunk => {
            if (chunk.status === 'queued' || chunk.status === 'processing' || chunk.status === 'ready') {
                count++;
            }
        });
        return count;
    }
}

