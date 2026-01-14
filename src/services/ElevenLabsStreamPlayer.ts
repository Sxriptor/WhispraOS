const Speaker = require('speaker');

/**
 * Real-time audio player for ElevenLabs streaming TTS
 * Plays raw PCM chunks directly without decoding
 */
export class ElevenLabsStreamPlayer {
	private speaker: any = null;
	private isPlaying: boolean = false;
	private sampleRate: number = 44100;
	private channels: number = 1; // ElevenLabs PCM is mono
	private bitDepth: number = 16;
	private buffer: Buffer[] = [];
	private isInitializing: boolean = false;
	private writeQueue: Buffer[] = [];
	private isWriting: boolean = false;

	constructor() {
		// Will be initialized when playback starts
	}

	/**
	 * Initialize the audio pipeline for streaming playback
	 */
	private initializePipeline(): void {
		if (this.isPlaying || this.isInitializing) {
			console.warn('Audio pipeline already initialized or initializing');
			return;
		}

		this.isInitializing = true;

		try {
			// Create speaker for direct PCM output
			// ElevenLabs PCM format: 16-bit signed little-endian, mono, 44.1kHz
			const SpeakerConstructor = Speaker as any;
			this.speaker = new SpeakerConstructor({
				channels: this.channels,
				bitDepth: this.bitDepth,
				sampleRate: this.sampleRate,
			});

			// Handle errors
			this.speaker.on('error', (err: Error) => {
				console.error('Speaker error:', err);
				this.cleanup();
			});

			// Handle completion
			this.speaker.on('close', () => {
				console.log('Speaker closed');
				this.isPlaying = false;
			});

			// Handle drain event to process queued writes
			this.speaker.on('drain', () => {
				this.processWriteQueue();
			});

			this.isPlaying = true;
			this.isInitializing = false;
			console.log('✅ Audio pipeline initialized for PCM streaming playback');
			console.log(`   Format: ${this.bitDepth}-bit, ${this.channels} channel(s), ${this.sampleRate}Hz`);

			// Process any buffered chunks
			if (this.buffer.length > 0) {
				console.log(`   Processing ${this.buffer.length} buffered chunks`);
				const bufferedChunks = [...this.buffer];
				this.buffer = [];
				bufferedChunks.forEach((chunk) => this.writeChunk(chunk));
			}
		} catch (error) {
			console.error('Failed to initialize audio pipeline:', error);
			this.isInitializing = false;
			this.cleanup();
			throw error;
		}
	}

	/**
	 * Process the write queue
	 */
	private processWriteQueue(): void {
		if (this.isWriting || this.writeQueue.length === 0 || !this.speaker) {
			return;
		}

		this.isWriting = true;
		const chunk = this.writeQueue.shift();

		if (chunk) {
			const canContinue = this.speaker.write(chunk);
			this.isWriting = false;

			if (canContinue && this.writeQueue.length > 0) {
				// Continue writing if buffer is not full
				setImmediate(() => this.processWriteQueue());
			}
		} else {
			this.isWriting = false;
		}
	}

	/**
	 * Write a chunk to the speaker
	 */
	private writeChunk(buffer: Buffer): void {
		if (!this.speaker) {
			console.error('Speaker not initialized');
			return;
		}

		this.writeQueue.push(buffer);
		if (!this.isWriting) {
			this.processWriteQueue();
		}
	}

	/**
	 * Append a PCM audio chunk to the stream for immediate playback
	 * @param chunk - Raw PCM audio chunk from ElevenLabs
	 */
	appendChunk(chunk: ArrayBuffer | Uint8Array | Buffer): void {
		try {
			// Convert to Buffer if needed
			const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as any);

			if (!this.isPlaying && !this.isInitializing) {
				// Buffer chunks until speaker is ready
				this.buffer.push(buffer);
				this.initializePipeline();
			} else if (this.isInitializing) {
				// Still initializing, buffer the chunk
				this.buffer.push(buffer);
			} else {
				// Speaker is ready, write directly
				this.writeChunk(buffer);
			}
		} catch (err) {
			console.error('Error appending chunk:', err);
		}
	}

	/**
	 * Signal end of stream and flush remaining audio
	 */
	end(): void {
		if (!this.isPlaying) {
			return;
		}

		try {
			// Wait for write queue to empty and speaker to drain
			const waitForQueue = () => {
				if (this.writeQueue.length > 0 || this.isWriting) {
					// Still processing chunks, check again soon
					setTimeout(waitForQueue, 10);
				} else if (this.speaker) {
					// Queue is empty, end the speaker stream
					this.speaker.end();
					console.log('✅ PCM stream ended, flushing audio...');
				}
			};

			waitForQueue();
		} catch (err) {
			console.error('Error ending stream:', err);
		}
	}

	/**
	 * Stop playback and clean up resources
	 */
	stop(): void {
		this.cleanup();
	}

	/**
	 * Clean up resources
	 */
	private cleanup(): void {
		try {
			this.writeQueue = [];
			this.buffer = [];
			this.isWriting = false;

			if (this.speaker) {
				this.speaker.removeAllListeners();
				this.speaker.end();
				this.speaker = null;
			}

			this.isPlaying = false;
			this.isInitializing = false;
			console.log('🧹 Audio pipeline cleaned up');
		} catch (err) {
			console.error('Error during cleanup:', err);
		}
	}

	/**
	 * Check if currently playing
	 */
	isCurrentlyPlaying(): boolean {
		return this.isPlaying;
	}
}

// Ensure this file is treated as a module
export {};
