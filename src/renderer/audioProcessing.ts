/**
 * Audio Processing Module
 * Handles recording, audio level detection, chunk processing, and TTS queue management
 * for push-to-talk translation mode
 */

import { TranslateTTSProcessor } from '../services/TranslateTTSProcessor.js';
import type { PushToTalkTranscription } from '../types/PushToTalkTranscription.js';

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

export interface AudioProcessingContext {
    // State flags
    isTranslating: boolean;
    isRecording: boolean;
    recordingStartTime: number | null;
    audioStream: MediaStream | null;
    audioChunks: Blob[];
    currentChunkData: Blob[];
    chunkQueue: Blob[];
    ttsQueue: string[];
    isPlayingTTS: boolean;
    streamingInterval: ReturnType<typeof setInterval> | null;
    mediaRecorder: MediaRecorder | null;
    audioContext: AudioContext | null;
    analyserNode: AnalyserNode | null;
    audioLevelCheckInterval: ReturnType<typeof setInterval> | null;
    hasDetectedAudio: boolean;
    audioDetectedThisSession: boolean;
    accentEnabled: boolean;
    selectedAccent: string;
    customAccentValue: string;

    // DOM elements
    recordingText: HTMLSpanElement;
    originalTextDiv: HTMLDivElement;
    translatedTextDiv: HTMLDivElement;
    voiceSelect: HTMLSelectElement;
    languageSelect: HTMLSelectElement;

    // PTT Overlay
    pttOverlay: any | null; // PTTOverlay instance

    // Functions
    logToDebug: (message: string) => void;
    stopPassThrough: () => Promise<void>;
    restartPassthroughClean: () => Promise<void>;
    updateRecordingUI: (isActive: boolean) => void;
    speechToTextPushToTalk: (audioBuffer: ArrayBuffer) => Promise<PushToTalkTranscription>;
    translateText: (text: string) => Promise<string>;
    applyAccentTag: (text: string) => string;
    synthesizeAndPlay: (text: string) => Promise<void>;
    playAudioBuffer: (audioBuffer: ArrayBuffer) => Promise<void>;
}

// ============================================================================
// MODULE STATE (injected via initialize)
// ============================================================================

let ctx: AudioProcessingContext | null = null;
let translateTTSProcessor: TranslateTTSProcessor | null = null;
function normalizeLanguageCode(lang?: string | null): string | undefined {
    if (!lang) return undefined;
    const lower = lang.toLowerCase();
    const map: Record<string, string> = {
        english: 'en',
        en: 'en',
        spanish: 'es',
        espanol: 'es',
        español: 'es',
        es: 'es',
        french: 'fr',
        fr: 'fr',
        german: 'de',
        de: 'de',
        italian: 'it',
        it: 'it',
        portuguese: 'pt',
        pt: 'pt',
        japanese: 'ja',
        ja: 'ja',
        korean: 'ko',
        ko: 'ko',
        chinese: 'zh',
        mandarin: 'zh',
        zh: 'zh'
    };
    return map[lower] || lower;
}

// Track when sustained voice was last detected to avoid hallucinating during long pauses
const SILENT_CHUNK_GRACE_PERIOD_MS = 1500; // Allow silent chunks for 1.5s after voice detection
let lastAudioDetectedTimestamp: number | null = null;

/**
 * Initialize the audio processing module with context
 */
export function initializeAudioProcessing(context: AudioProcessingContext): void {
    ctx = context;

    // Initialize TranslateTTSProcessor with electronAPI
    if (!translateTTSProcessor) {
        translateTTSProcessor = new TranslateTTSProcessor((window as any).electronAPI);

        // Set playback handler to use the context's playAudioBuffer function
        translateTTSProcessor.setPlaybackHandler(async (audioData: ArrayBuffer, sinkId?: string, text?: string) => {
            await context.playAudioBuffer(audioData);
        });

        // Set UI update callback
        translateTTSProcessor.setUIUpdateCallback((stats) => {
            const totalRemaining = stats.queued + stats.processing + stats.ready;
            if (context.isRecording) {
                context.recordingText.textContent = 'Recording... (release key to stop)';
            } else if (totalRemaining > 0) {
                context.recordingText.textContent = `Processing... (${totalRemaining} remaining)`;
            } else if (context.isTranslating) {
                context.recordingText.textContent = 'Audio staying quiet';
            }
        });

        console.log('[Translate] TTS Processor initialized with 3 concurrent slots');
    }
}

/**
 * Get the current context (throws if not initialized)
 */
function getContext(): AudioProcessingContext {
    if (!ctx) {
        throw new Error('AudioProcessing module not initialized. Call initializeAudioProcessing() first.');
    }
    return ctx;
}

// ============================================================================
// RECORDING FUNCTIONS
// ============================================================================

/**
 * Start recording audio for push-to-talk translation
 */
export async function startRecording(): Promise<void> {
    const c = getContext();
    
    // Only allow recording if translation mode is active
    if (!c.isTranslating || !c.audioStream || c.isRecording) return;

    try {
        c.isRecording = true;
        c.recordingStartTime = Date.now(); // Track when recording started
        c.audioChunks = [];
        c.currentChunkData = [];
        c.hasDetectedAudio = false; // Reset audio detection flag for this PTT session
        c.audioDetectedThisSession = false; // Reset session flag - no audio detected yet
        audioDetectionHistory = []; // Reset audio detection history for clean state
        lastAudioDetectedTimestamp = null; // Reset last detected timestamp for clean state
        
        // Reset captions chunks when starting a new recording session
        try {
            await (window as any).electronAPI.invoke('captions:resetChunks', {
                id: Date.now().toString(),
                timestamp: Date.now(),
                payload: {}
            });
            console.log('📺 Captions chunks reset for new recording session');
        } catch (error) {
            console.error('❌ Failed to reset captions chunks:', error);
        }
        
        await c.stopPassThrough();

        // Set up audio level monitoring
        try {
            c.audioContext = new AudioContext();
            const source = c.audioContext.createMediaStreamSource(c.audioStream);
            c.analyserNode = c.audioContext.createAnalyser();
            c.analyserNode.fftSize = 2048;
            source.connect(c.analyserNode);

            console.log('🎚️ Audio level monitoring initialized', { analyserNode: !!c.analyserNode });
            c.logToDebug('🎚️ Audio level monitoring initialized');
        } catch (error) {
            console.error('⚠️ Audio monitoring setup failed:', error);
            c.logToDebug(`⚠️ Could not set up audio monitoring: ${error instanceof Error ? error.message : 'Unknown'}`);
        }

        // Update UI
        const recordingDot = document.querySelector('.recording-dot') as HTMLElement;
        recordingDot.classList.add('active');
        c.recordingText.textContent = 'Recording... (release key to translate)';
        c.originalTextDiv.textContent = 'Listening...';
        c.originalTextDiv.classList.add('processing');
        c.translatedTextDiv.textContent = 'Waiting for speech...';
        c.translatedTextDiv.classList.add('empty');

        // Always update whispra translate panel (live panel logic)
        const whispraLeftSourceText = document.getElementById('whispra-left-source-text') as HTMLDivElement;
        const whispraLeftTargetText = document.getElementById('whispra-left-target-text') as HTMLDivElement;
        if (whispraLeftSourceText) {
            whispraLeftSourceText.textContent = 'Listening...';
            whispraLeftSourceText.classList.add('processing');
            whispraLeftSourceText.classList.remove('empty');
        }
        if (whispraLeftTargetText) {
            whispraLeftTargetText.textContent = 'Waiting for speech...';
            whispraLeftTargetText.classList.add('empty');
        }

        // Show PTT overlay with audio visualization
        if (c.pttOverlay) {
            c.pttOverlay.show(c.analyserNode);
        }

        // Monitor audio levels continuously (check every 100ms) - START BEFORE first chunk
        console.log('🎚️ Starting audio level check interval');
        let checkCount = 0;
        c.audioLevelCheckInterval = setInterval(() => {
            if (!c.isRecording || !c.isTranslating) {
                if (c.audioLevelCheckInterval) clearInterval(c.audioLevelCheckInterval);
                c.audioLevelCheckInterval = null;
                return;
            }

            // Check if audio is above threshold
            const hasAudio = checkAudioLevel();
            checkCount++;

            // Log every 10 checks (~1 second) to show it's working
            if (checkCount % 10 === 0) {
                console.log(`🎚️ Audio check #${checkCount}: hasAudio=${hasAudio}, hasDetectedAudio=${c.hasDetectedAudio}`);
            }

            if (hasAudio) {
                c.hasDetectedAudio = true;
                if (!c.audioDetectedThisSession) {
                    c.audioDetectedThisSession = true;
                    console.log('🔊 First audio detected in this PTT session - will now process all chunks until key release');
                }
            }
        }, 100);

        // Start first recording chunk AFTER audio monitoring is set up
        await startNewRecordingChunk();

        // Set up interval to restart recorder every 1 second for streaming
        // (1 second is a good balance: fast response + good transcription quality)
        c.streamingInterval = setInterval(async () => {
            if (!c.isRecording || !c.isTranslating) {
                if (c.streamingInterval) clearInterval(c.streamingInterval);
                c.streamingInterval = null;
                return;
            }

            try {
                // Only create new chunks if we've detected audio at some point during this PTT session
                // This prevents Whisper from hallucinating when mic is muted or silent
                if (!c.hasDetectedAudio) {
                    c.logToDebug('🔇 No audio detected yet, skipping chunk creation to prevent hallucination');
                    console.log('🔇 Skipping chunk - no audio detected (hasDetectedAudio=false)');
                    return;
                }

                // Stop current chunk and process it
                if (c.mediaRecorder && c.mediaRecorder.state === 'recording') {
                    c.logToDebug('⏸️ Stopping chunk for processing...');
                    c.mediaRecorder.stop(); // This will trigger ondataavailable with complete WebM file

                    // Wait a bit for ondataavailable to fire and process
                    await new Promise(resolve => setTimeout(resolve, 100));

                    // Start new chunk immediately
                    if (c.isRecording && c.isTranslating) {
                        await startNewRecordingChunk();
                    }
                } else if (c.mediaRecorder && c.mediaRecorder.state === 'inactive' && c.isRecording && c.isTranslating) {
                    // If recorder is inactive but we're still recording, restart it
                    // This can happen if user pauses and resumes speaking
                    console.log('🔄 MediaRecorder inactive but still recording - restarting chunk');
                    c.logToDebug('🔄 Restarting chunk after pause');
                    await startNewRecordingChunk();
                }
            } catch (error) {
                c.logToDebug(`❌ Error during chunk restart: ${error instanceof Error ? error.message : 'Unknown'}`);
            }
        }, 1000);

        c.logToDebug('🎤 Streaming recording started (1-second restart intervals)');

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        c.logToDebug(`❌ Failed to start recording: ${errorMessage}`);
        c.isRecording = false;
        c.updateRecordingUI(false);
    }
}

/**
 * Helper function to start a new recording chunk
 */
async function startNewRecordingChunk(): Promise<void> {
    const c = getContext();
    
    // Check BOTH isRecording and isTranslating - don't start new chunk if user released key
    if (!c.audioStream || !c.isTranslating || !c.isRecording) return;

    c.currentChunkData = [];

    c.mediaRecorder = new MediaRecorder(c.audioStream, {
        mimeType: 'audio/webm;codecs=opus'
    });

    c.mediaRecorder.ondataavailable = (event) => {
        // Collect all data for this chunk
        if (event.data.size > 0) {
            c.currentChunkData.push(event.data);
        }
    };

    c.mediaRecorder.onstop = async () => {
        // When chunk recording stops, we have a complete WebM file
        // Always process if we have data and translation is active
        // (Don't check isRecording here - we want the final chunk even after release)
        if (c.currentChunkData.length > 0 && c.isTranslating) {
            const completeChunk = new Blob(c.currentChunkData, { type: 'audio/webm;codecs=opus' });

            if (c.isRecording) {
                c.logToDebug(`📦 Complete chunk ready: ${completeChunk.size} bytes`);
            } else {
                c.logToDebug(`📦 Final chunk ready: ${completeChunk.size} bytes`);
            }

            // Process this complete, valid audio file
            await processAudioChunk(completeChunk);
        }
        c.currentChunkData = [];
    };

    c.mediaRecorder.start();
    c.logToDebug('🎙️ Started new recording chunk');
}

/**
 * Stop recording audio
 */
export async function stopRecording(): Promise<void> {
    const c = getContext();
    
    // Check if we're actually recording (don't rely on mediaRecorder since it gets recreated)
    if (!c.isRecording) return;

    try {
        c.isRecording = false;
        lastAudioDetectedTimestamp = null;

        // Clear streaming interval FIRST to prevent new chunks from starting
        if (c.streamingInterval) {
            clearInterval(c.streamingInterval);
            c.streamingInterval = null;
            c.logToDebug('⏹️ Cleared streaming interval - no new chunks will be created');
        }

        // Clear audio level monitoring
        if (c.audioLevelCheckInterval) {
            clearInterval(c.audioLevelCheckInterval);
            c.audioLevelCheckInterval = null;
        }

        // Clean up audio context
        if (c.audioContext) {
            await c.audioContext.close();
            c.audioContext = null;
            c.analyserNode = null;
            c.logToDebug('🎚️ Audio monitoring cleaned up');
        }

        // Don't clear the queue - let all captured chunks be processed
        // They represent the user's speech while they were holding the key
        if (c.chunkQueue.length > 0) {
            c.logToDebug(`📋 ${c.chunkQueue.length} chunk(s) in queue will be processed`);
        }

        // Calculate recording duration
        const recordingDuration = c.recordingStartTime ? Date.now() - c.recordingStartTime : 0;
        c.recordingStartTime = null; // Reset the start time

        // Check if recording was too short (< 500ms)
        if (recordingDuration < 800) {
            c.logToDebug('🎤 Recording too short, skipping translation');

            // Stop the recorder without processing if it exists
            if (c.mediaRecorder && c.mediaRecorder.state !== 'inactive') {
                c.mediaRecorder.stop();
            }

            c.updateRecordingUI(false);

            // Hide PTT overlay
            if (c.pttOverlay) {
                c.pttOverlay.hide();
            }

            // Update UI to show "audio too short"
            const recordingDot = document.querySelector('.recording-dot') as HTMLElement;
            recordingDot.classList.remove('active');
            c.recordingText.textContent = 'Audio too short';
            c.originalTextDiv.textContent = 'Audio too short';
            c.originalTextDiv.classList.remove('processing');
            c.originalTextDiv.classList.add('empty');
            c.translatedTextDiv.textContent = '';
            c.translatedTextDiv.classList.remove('processing');
            c.translatedTextDiv.classList.add('empty');
            // Always update whispra translate panel (live panel logic)
            const whispraLeftSourceText = document.getElementById('whispra-left-source-text') as HTMLDivElement;
            if (whispraLeftSourceText) {
                whispraLeftSourceText.textContent = 'Audio too short';
                whispraLeftSourceText.classList.remove('processing');
                whispraLeftSourceText.classList.add('empty');
            }

            // Clear audio chunks since we're not processing
            c.audioChunks = [];
            c.currentChunkData = [];

            // Restart passthrough
            if (c.audioStream) {
                await c.restartPassthroughClean();
            }

            return;
        }

        // Update UI
        const recordingDot = document.querySelector('.recording-dot') as HTMLElement;
        recordingDot.classList.remove('active');
        c.recordingText.textContent = 'Processing final chunk...';

        // Hide PTT overlay
        if (c.pttOverlay) {
            c.pttOverlay.hide();
        }

        c.logToDebug('🎤 Stopping streaming recording...');

        // Stop current recorder if it exists - this will trigger one final ondataavailable with remaining audio
        if (c.mediaRecorder && c.mediaRecorder.state !== 'inactive') {
            c.mediaRecorder.stop();
        }
        c.logToDebug('🎤 Recording stopped, final chunk will be processed');

        // Immediately restart passthrough so user can hear their mic
        if (c.audioStream) {
            await c.restartPassthroughClean();
        }

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        c.logToDebug(`❌ Failed to stop recording: ${errorMessage}`);
        console.error('Stop recording error:', error);
        c.updateRecordingUI(false);
    }
}

// ============================================================================
// AUDIO LEVEL DETECTION
// ============================================================================

// Audio detection state for sustained audio check
let audioDetectionHistory: boolean[] = [];
const AUDIO_HISTORY_SIZE = 5; // Track last 5 checks (500ms of history)
const SUSTAINED_AUDIO_THRESHOLD = 3; // Need 3 out of 5 checks to be positive

/**
 * Analyze frequency spectrum to detect if audio contains voice frequencies
 * Human voice fundamental: 85-255Hz (male: 85-180Hz, female: 165-255Hz)
 * Voice harmonics: 300Hz-4kHz (most speech energy is here)
 * This filters out non-voice sounds like clicks, pops, keyboard noise
 */
function detectVoiceFrequencies(analyserNode: AnalyserNode): boolean {
    const frequencyData = new Uint8Array(analyserNode.frequencyBinCount);
    analyserNode.getByteFrequencyData(frequencyData);
    
    // Calculate frequency bin size (sample rate / FFT size)
    // Typical: 48000 Hz / 2048 = 23.4 Hz per bin
    const sampleRate = 48000; // Assuming 48kHz sample rate
    const binSize = sampleRate / (analyserNode.fftSize * 2);
    
    // Define voice frequency ranges in Hz
    const fundamentalStart = 85;   // 85 Hz - lowest male voice
    const fundamentalEnd = 300;    // 300 Hz - upper fundamental range
    const harmonicsStart = 300;    // 300 Hz - start of harmonics
    const harmonicsEnd = 4000;     // 4000 Hz - end of speech range
    
    // Convert Hz to bin indices
    const fundamentalStartBin = Math.floor(fundamentalStart / binSize);
    const fundamentalEndBin = Math.floor(fundamentalEnd / binSize);
    const harmonicsStartBin = Math.floor(harmonicsStart / binSize);
    const harmonicsEndBin = Math.floor(harmonicsEnd / binSize);
    
    // Calculate average energy in fundamental range (85-300Hz)
    let fundamentalEnergy = 0;
    for (let i = fundamentalStartBin; i < fundamentalEndBin && i < frequencyData.length; i++) {
        fundamentalEnergy += frequencyData[i];
    }
    fundamentalEnergy /= (fundamentalEndBin - fundamentalStartBin);
    
    // Calculate average energy in harmonics range (300Hz-4kHz)
    let harmonicsEnergy = 0;
    for (let i = harmonicsStartBin; i < harmonicsEndBin && i < frequencyData.length; i++) {
        harmonicsEnergy += frequencyData[i];
    }
    harmonicsEnergy /= (harmonicsEndBin - harmonicsStartBin);
    
    // Calculate average energy in non-voice range (above 4kHz)
    const nonVoiceStartBin = harmonicsEndBin;
    const nonVoiceEndBin = Math.min(frequencyData.length, Math.floor(8000 / binSize));
    let nonVoiceEnergy = 0;
    if (nonVoiceEndBin > nonVoiceStartBin) {
        for (let i = nonVoiceStartBin; i < nonVoiceEndBin; i++) {
            nonVoiceEnergy += frequencyData[i];
        }
        nonVoiceEnergy /= (nonVoiceEndBin - nonVoiceStartBin);
    }
    
    // Voice detection criteria:
    // 1. Must have energy in fundamental range (85-300Hz)
    // 2. Must have energy in harmonics range (300Hz-4kHz)
    // 3. Voice range energy should be higher than non-voice range
    const hasFundamental = fundamentalEnergy > 30; // Threshold for fundamental presence
    const hasHarmonics = harmonicsEnergy > 25; // Threshold for harmonics presence
    const voiceRatio = (fundamentalEnergy + harmonicsEnergy) / (nonVoiceEnergy + 1); // Avoid division by zero
    const isVoiceLike = voiceRatio > 1.5; // Voice energy should be 1.5x higher than noise
    
    const isVoice = hasFundamental && hasHarmonics && isVoiceLike;
    
    // Debug logging (5% of the time)
    if (Math.random() < 0.05) {
        console.log(`🎵 Voice freq check: fund=${fundamentalEnergy.toFixed(1)} (${hasFundamental}), harm=${harmonicsEnergy.toFixed(1)} (${hasHarmonics}), ratio=${voiceRatio.toFixed(2)} (${isVoiceLike}) => ${isVoice ? '✅ VOICE' : '❌ NOT VOICE'}`);
    }
    
    return isVoice;
}

/**
 * Check if audio level is above silence threshold AND contains voice frequencies
 * This function is called every 100ms to detect if there's actual speech in the audio
 * It ONLY affects whether we send audio to Whisper API - it does NOT stop TTS playback
 */
export function checkAudioLevel(): boolean {
    const c = getContext();
    
    if (!c.analyserNode) {
        console.warn('⚠️ No analyser node available for audio detection');
        return false; // If no analyser, treat as silence to be safe
    }

    const dataArray = new Uint8Array(c.analyserNode.frequencyBinCount);
    c.analyserNode.getByteTimeDomainData(dataArray);

    // Calculate RMS (Root Mean Square) from time domain data
    let sumSquares = 0;
    for (let i = 0; i < dataArray.length; i++) {
        const normalized = (dataArray[i] - 128) / 128; // Normalize to -1 to 1
        sumSquares += normalized * normalized;
    }
    const rms = Math.sqrt(sumSquares / dataArray.length);

    // Lower threshold to catch quiet speech (voice freq check will filter noise)
    // 0.003 = -50dB (catches very quiet speech)
    // 0.005 = -46dB (catches quiet speech)
    // 0.01 = -40dB (catches normal speech)
    const silenceThreshold = 0.005; // Sensitive threshold - voice freq check filters noise

    const hasVolume = rms > silenceThreshold;
    
    // Check for voice frequencies (only if volume is present)
    const hasVoiceFreq = hasVolume ? detectVoiceFrequencies(c.analyserNode) : false;
    
    // Both volume AND voice frequencies must be present
    const instantAudio = hasVolume && hasVoiceFreq;

    // Add to history
    audioDetectionHistory.push(instantAudio);
    if (audioDetectionHistory.length > AUDIO_HISTORY_SIZE) {
        audioDetectionHistory.shift();
    }

    // Count how many recent checks detected audio
    const recentAudioCount = audioDetectionHistory.filter(x => x).length;
    
    // Require sustained audio to filter out brief noise spikes
    // This prevents single frame noise from triggering, but allows quiet sustained speech
    const hasAudio = recentAudioCount >= SUSTAINED_AUDIO_THRESHOLD;

    // Log audio levels for debugging (every 20th check to avoid spam)
    if (Math.random() < 0.05) { // ~5% of the time
        console.log(`🎚️ Audio level: RMS=${rms.toFixed(4)}, threshold=${silenceThreshold}, volume=${hasVolume}, voice=${hasVoiceFreq}, instant=${instantAudio}, sustained=${hasAudio} (${recentAudioCount}/${AUDIO_HISTORY_SIZE}), hasDetectedAudio=${c.hasDetectedAudio}, sessionDetected=${c.audioDetectedThisSession}`);
    }

    // Log when audio is first detected in a chunk period
    if (hasAudio && !c.hasDetectedAudio) {
        console.log(`🔊 Voice detected! RMS: ${rms.toFixed(4)} (threshold: ${silenceThreshold}) - Sustained voice confirmed (${recentAudioCount}/${AUDIO_HISTORY_SIZE}) - This chunk will be sent to Whisper`);
        c.logToDebug(`🔊 Voice detected! RMS: ${rms.toFixed(4)} - Sustained`);
        lastAudioDetectedTimestamp = Date.now();
    } else if (hasAudio) {
        // Even if we've already marked audio for this chunk, refresh the timestamp to extend grace period
        lastAudioDetectedTimestamp = Date.now();
    }

    return hasAudio;
}

// ============================================================================
// AUDIO CHUNK PROCESSING
// ============================================================================

/**
 * Process individual audio chunks in streaming mode (transcribe + translate in parallel)
 */
export async function processAudioChunk(chunk: Blob): Promise<void> {
    const c = getContext();
    
    // Process this chunk asynchronously (don't wait for previous chunks to finish TTS)
    // This allows transcription/translation to happen in background while TTS plays
    // NOTE: This function ONLY processes NEW chunks - it does NOT affect already-playing TTS

    try {
        c.logToDebug(`🔄 Processing audio chunk: ${chunk.size} bytes`);

        // Check if translation is still active
        if (!c.isTranslating) {
            c.logToDebug('⚠️ Translation stopped, skipping chunk');
            return;
        }

        // Check if we've detected any audio above threshold during this chunk
        // OR if we've already detected audio once in this PTT session
        const hadAudio = c.hasDetectedAudio;
        c.hasDetectedAudio = false; // Reset for next chunk period
        const now = Date.now();
        const timeSinceLastAudio = lastAudioDetectedTimestamp ? now - lastAudioDetectedTimestamp : Infinity;
        const allowSilentChunk = c.audioDetectedThisSession && timeSinceLastAudio <= SILENT_CHUNK_GRACE_PERIOD_MS;

        console.log(`🎚️ CHUNK PROCESSING: hadAudio=${hadAudio}, sessionDetected=${c.audioDetectedThisSession}, chunkSize=${chunk.size}`);

        // If no audio in this chunk AND we haven't detected any audio in this session yet, skip
        if (!hadAudio && !c.audioDetectedThisSession) {
            console.log('🔇 SKIPPING CHUNK: No audio detected yet in this PTT session, skipping Whisper API call');
            c.logToDebug('🔇 No audio detected yet in this PTT session, skipping Whisper API call');
            return;
        }

        if (!hadAudio && !allowSilentChunk) {
            console.log(`🤫 SKIPPING SILENT CHUNK: No recent voice detected (last=${timeSinceLastAudio}ms ago)`);
            c.logToDebug('🤫 Skipping silent chunk - no recent voice detected');
            return;
        }

        console.log('✅ PROCESSING CHUNK: Audio detected or recent speech activity');

        if (hadAudio) {
            console.log('🔊 Audio detected in this chunk, sending to Whisper...');
        } else {
            console.log(`🔊 No audio in this chunk, but allowed because voice was detected ${timeSinceLastAudio}ms ago`);
        }

        c.logToDebug('🔊 Processing chunk (audio detected in session)');

        // Update UI to show we're processing
        c.recordingText.textContent = 'Transcribing...';
        c.originalTextDiv.textContent = 'Converting speech to text...';

        // Convert chunk to ArrayBuffer for IPC
        const arrayBuffer = await chunk.arrayBuffer();

        // Send chunk to speech-to-text
        const transcriptionResult = await c.speechToTextPushToTalk(arrayBuffer);

        // Check if translation was stopped during processing
        if (!c.isTranslating) {
            c.logToDebug('⚠️ Translation stopped during chunk STT, aborting');
            return;
        }

        if (transcriptionResult.skipped) {
            c.logToDebug(`⏭️ Chunk skipped by STT: ${transcriptionResult.reason || 'filtered upstream'}`);
            c.recordingText.textContent = 'Background audio ignored';
            c.originalTextDiv.textContent = 'Background audio ignored';
            c.originalTextDiv.classList.add('empty');
            const whispraLeftSourceText = document.getElementById('whispra-left-source-text') as HTMLDivElement;
            if (whispraLeftSourceText) {
                whispraLeftSourceText.textContent = 'Background audio ignored';
                whispraLeftSourceText.classList.add('empty');
            }
            return;
        }

        const transcription = transcriptionResult.text;
        const detectedLanguage = normalizeLanguageCode(transcriptionResult.language);
        const expectedLanguage = normalizeLanguageCode(transcriptionResult.expectedLanguage);

        c.logToDebug(`📝 Chunk transcription result: "${transcription}" (detected=${detectedLanguage || 'unknown'}, expected=${expectedLanguage || 'auto'})`);

        if (!transcription || transcription.trim().length === 0) {
            c.logToDebug('⚠️ No speech detected in chunk');
            return;
        }

        if (expectedLanguage && expectedLanguage !== 'auto' && detectedLanguage && detectedLanguage !== expectedLanguage) {
            c.logToDebug(`🚫 Language mismatch (expected ${expectedLanguage}, got ${detectedLanguage}) - dropping chunk as likely background audio`);
            c.recordingText.textContent = 'Background audio ignored';
            c.originalTextDiv.textContent = 'Background audio ignored';
            c.originalTextDiv.classList.add('empty');
            const whispraLeftSourceText = document.getElementById('whispra-left-source-text') as HTMLDivElement;
            if (whispraLeftSourceText) {
                whispraLeftSourceText.textContent = 'Background audio ignored';
                whispraLeftSourceText.classList.add('empty');
            }
            return;
        }

        // Note: Hallucination filter removed - let all transcriptions through
        // The audio detection gate should prevent most false positives

        // Update UI with transcription
        c.originalTextDiv.textContent = transcription;
        c.originalTextDiv.classList.remove('processing', 'empty');

        // Always update whispra translate panel for PTT (user's spoken text)
        const whispraLeftSourceText = document.getElementById('whispra-left-source-text') as HTMLDivElement;
        if (whispraLeftSourceText) {
            whispraLeftSourceText.textContent = transcription;
            whispraLeftSourceText.classList.remove('processing', 'empty');
        }

        // Now translate the transcribed text
        c.recordingText.textContent = 'Translating...';
        c.translatedTextDiv.textContent = 'Translating...';
        c.translatedTextDiv.classList.add('processing');
        c.translatedTextDiv.classList.remove('empty');

        // Also update whispra translate panel translation status
        const whispraLeftTargetText = document.getElementById('whispra-left-target-text') as HTMLDivElement;
        if (whispraLeftTargetText) {
            whispraLeftTargetText.textContent = 'Translating...';
            whispraLeftTargetText.classList.add('processing');
            whispraLeftTargetText.classList.remove('empty');
        }

        // Translate using the existing translation function
        const translated = await c.translateText(transcription);

        // Check again if translation is still active
        if (!c.isTranslating) {
            c.logToDebug('⚠️ Translation stopped during translation step, aborting');
            return;
        }

        if (translated && translated.trim().length > 0) {
            c.logToDebug(`🌐 Translation result: "${translated}"`);
            c.translatedTextDiv.textContent = translated;
            c.translatedTextDiv.classList.remove('processing', 'empty');

            // Always update whispra translate panel (live panel logic)
            const whispraLeftTargetText = document.getElementById('whispra-left-target-text') as HTMLDivElement;
            if (whispraLeftTargetText) {
                whispraLeftTargetText.textContent = translated;
                whispraLeftTargetText.classList.remove('processing', 'empty');
            }

            // Add to parallel TTS processor queue (handles synthesis + playback concurrently)
            const voiceId = c.voiceSelect.value || 'pNInz6obpgDQGcFmaJgB';
            const processedText = c.applyAccentTag(translated);
            const modelId = c.accentEnabled ? 'eleven_v3' : undefined;

            if (translateTTSProcessor) {
                const chunkId = translateTTSProcessor.addChunk(
                    processedText,
                    voiceId,
                    modelId
                );
                c.logToDebug(`🎯 Chunk ${chunkId} queued (max 3 concurrent TTS) for: "${translated.substring(0, 50)}..."`);
            } else {
                c.logToDebug('⚠️ TTS Processor not initialized');
            }
        } else {
            c.logToDebug('⚠️ Translation returned empty result');
            c.translatedTextDiv.textContent = 'Translation failed';
            c.translatedTextDiv.classList.remove('processing');

            // Always update whispra translate panel (live panel logic)
            const whispraLeftTargetText = document.getElementById('whispra-left-target-text') as HTMLDivElement;
            if (whispraLeftTargetText) {
                whispraLeftTargetText.textContent = 'Translation failed';
                whispraLeftTargetText.classList.remove('processing');
            }
        }

        // Update UI based on recording state
        const totalRemaining = c.chunkQueue.length + c.ttsQueue.length;
        if (c.isRecording) {
            c.recordingText.textContent = 'Recording... (release key to stop)';
        } else if (totalRemaining > 0) {
            c.recordingText.textContent = `Processing... (${totalRemaining} remaining)`;
        }

    } catch (error) {
        const c = getContext();
        if (c.isTranslating) {
            c.logToDebug(`❌ Chunk processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            console.error('Chunk processing error:', error);
            c.originalTextDiv.textContent = `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
            c.originalTextDiv.classList.remove('processing');
            // Always update whispra translate panel (live panel logic)
            const whispraLeftSourceText = document.getElementById('whispra-left-source-text') as HTMLDivElement;
            if (whispraLeftSourceText) {
                whispraLeftSourceText.textContent = `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
                whispraLeftSourceText.classList.remove('processing');
            }
        }
    }
}

// ============================================================================
// TTS QUEUE PROCESSING
// ============================================================================

/**
 * Stop TTS processor (called when translation mode is stopped)
 */
export function stopTTSProcessor(): void {
    if (translateTTSProcessor) {
        translateTTSProcessor.stop();
        console.log('[Translate] TTS Processor stopped');
    }
}

/**
 * Get TTS processor stats for UI updates
 */
export function getTTSProcessorStats() {
    if (translateTTSProcessor) {
        return translateTTSProcessor.getStats();
    }
    return null;
}

/**
 * Legacy process TTS queue function (deprecated - now using TranslateTTSProcessor)
 * Keeping for backward compatibility but it's no longer used
 */
export async function processTTSQueue(): Promise<void> {
    const c = getContext();

    // This function is deprecated - the new TranslateTTSProcessor handles everything automatically
    c.logToDebug('⚠️ processTTSQueue called but TranslateTTSProcessor is now handling TTS');
}

// ============================================================================
// LEGACY PROCESS RECORDED AUDIO (for non-streaming mode)
// ============================================================================

/**
 * Process recorded audio (legacy function for non-streaming push-to-talk mode)
 */
export async function processRecordedAudio(): Promise<void> {
    const c = getContext();
    
    try {
        // CRITICAL: Check if translation is still active before processing
        // This prevents processing from continuing after user stops translation
        if (!c.isTranslating) {
            c.logToDebug('⚠️ Translation stopped, aborting audio processing');
            c.audioChunks = [];
            c.updateRecordingUI(false);
            return;
        }

        // Only process if we have recorded audio chunks (push-to-talk mode)
        // isTranslating just means push-to-talk is enabled, not that we're in continuous mode

        c.logToDebug('🔄 Starting audio processing...');

        if (c.audioChunks.length === 0) {
            c.logToDebug('⚠️ No audio data recorded');
            c.updateRecordingUI(false);
            return;
        }

        // Double-check: if translation was stopped while we were processing, abort
        if (!c.isTranslating) {
            c.logToDebug('⚠️ Translation stopped during processing, aborting');
            c.audioChunks = [];
            c.updateRecordingUI(false);
            return;
        }

        // Create audio blob
        const audioBlob = new Blob(c.audioChunks, { type: 'audio/webm;codecs=opus' });
        c.logToDebug(`📊 Audio recorded: ${audioBlob.size} bytes`);

        // Update UI
        c.recordingText.textContent = 'Transcribing...';
        c.originalTextDiv.textContent = 'Converting speech to text...';

        // Always update whispra translate panel for PTT
        const whispraLeftSourceText = document.getElementById('whispra-left-source-text') as HTMLDivElement;
        if (whispraLeftSourceText) {
            whispraLeftSourceText.textContent = 'Converting speech to text...';
            whispraLeftSourceText.classList.add('processing');
            whispraLeftSourceText.classList.remove('empty');
        }

        try {
            // Send to speech-to-text using a separate push-to-talk endpoint
            c.logToDebug('🎤 Starting push-to-talk speech-to-text...');
            const transcriptionResult = await c.speechToTextPushToTalk(await audioBlob.arrayBuffer());

            // Check again if translation was stopped during STT
            if (!c.isTranslating) {
                c.logToDebug('⚠️ Translation stopped during STT, aborting');
                c.audioChunks = [];
                c.updateRecordingUI(false);
                return;
            }

            if (transcriptionResult.skipped) {
                c.logToDebug(`⏭️ Recorded audio skipped by STT: ${transcriptionResult.reason || 'filtered upstream'}`);
                c.originalTextDiv.textContent = 'Background audio ignored';
                c.originalTextDiv.classList.add('empty');
                const whispraLeftSourceText = document.getElementById('whispra-left-source-text') as HTMLDivElement;
                if (whispraLeftSourceText) {
                    whispraLeftSourceText.textContent = 'Background audio ignored';
                    whispraLeftSourceText.classList.add('empty');
                }
                return;
            }

            const transcription = transcriptionResult.text;
            const detectedLanguage = normalizeLanguageCode(transcriptionResult.language);
            const expectedLanguage = normalizeLanguageCode(transcriptionResult.expectedLanguage);

            c.logToDebug(`📝 Transcription result: "${transcription}" (detected=${detectedLanguage || 'unknown'}, expected=${expectedLanguage || 'auto'})`);

            if (!transcription || transcription.trim().length === 0) {
                c.logToDebug('⚠️ No speech detected in recording');
                c.originalTextDiv.textContent = 'No speech detected';
                c.originalTextDiv.classList.remove('processing');
                c.originalTextDiv.classList.add('empty');
                // Always update whispra translate panel (live panel logic)
                const whispraLeftSourceText = document.getElementById('whispra-left-source-text') as HTMLDivElement;
                if (whispraLeftSourceText) {
                    whispraLeftSourceText.textContent = 'No speech detected';
                    whispraLeftSourceText.classList.remove('processing');
                    whispraLeftSourceText.classList.add('empty');
                }
                c.updateRecordingUI(false);
                return;
            }

            if (expectedLanguage && expectedLanguage !== 'auto' && detectedLanguage && detectedLanguage !== expectedLanguage) {
                c.logToDebug(`🚫 Language mismatch (expected ${expectedLanguage}, got ${detectedLanguage}) in recorded audio - skipping to avoid background capture`);
                c.originalTextDiv.textContent = 'Background audio ignored';
                c.originalTextDiv.classList.remove('processing');
                c.originalTextDiv.classList.add('empty');
                const whispraLeftSourceText = document.getElementById('whispra-left-source-text') as HTMLDivElement;
                if (whispraLeftSourceText) {
                    whispraLeftSourceText.textContent = 'Background audio ignored';
                    whispraLeftSourceText.classList.add('empty');
                }
                return;
            }

            // Update UI with transcription
            c.originalTextDiv.textContent = transcription;
            c.originalTextDiv.classList.remove('processing', 'empty');

            // Always update whispra translate panel for PTT (user's spoken text)
            const whispraLeftSourceText = document.getElementById('whispra-left-source-text') as HTMLDivElement;
            if (whispraLeftSourceText) {
                whispraLeftSourceText.textContent = transcription;
                whispraLeftSourceText.classList.remove('processing', 'empty');
            }

        } catch (sttError) {
            // Only show error if translation is still active
            if (c.isTranslating) {
                c.logToDebug(`❌ Speech-to-text failed: ${sttError instanceof Error ? sttError.message : 'Unknown error'}`);
                console.error('STT Error:', sttError);
                c.originalTextDiv.textContent = `STT Error: ${sttError instanceof Error ? sttError.message : 'Unknown error'}`;
                c.originalTextDiv.classList.remove('processing');
                // Always update whispra translate panel (live panel logic)
                const whispraLeftSourceText = document.getElementById('whispra-left-source-text') as HTMLDivElement;
                if (whispraLeftSourceText) {
                    whispraLeftSourceText.textContent = `STT Error: ${sttError instanceof Error ? sttError.message : 'Unknown error'}`;
                    whispraLeftSourceText.classList.remove('processing');
                }
                c.updateRecordingUI(false);
            }
            return;
        }

        // Final check before translation
        if (!c.isTranslating) {
            c.logToDebug('⚠️ Translation stopped before translation step, aborting');
            c.audioChunks = [];
            c.updateRecordingUI(false);
            return;
        }

        try {
            // Translate the text
            c.recordingText.textContent = 'Translating...';
            c.translatedTextDiv.textContent = 'Translating to target language...';
            c.translatedTextDiv.classList.add('processing');

            // Always update whispra translate panel (live panel logic)
            const whispraLeftTargetText = document.getElementById('whispra-left-target-text') as HTMLDivElement;
            if (whispraLeftTargetText) {
                whispraLeftTargetText.textContent = 'Translating to target language...';
                whispraLeftTargetText.classList.add('processing');
                whispraLeftTargetText.classList.remove('empty');
            }

            c.logToDebug('🌍 Starting translation...');
            const transcription = c.originalTextDiv.textContent;
            const translationResult = await c.translateText(transcription);

            // Check again if translation was stopped during translation
            if (!c.isTranslating) {
                c.logToDebug('⚠️ Translation stopped during translation step, aborting');
                c.audioChunks = [];
                c.updateRecordingUI(false);
                return;
            }

            c.logToDebug(`🌍 Translation result: "${translationResult}"`);

            // Update UI with translation
            c.translatedTextDiv.textContent = translationResult;
            c.translatedTextDiv.classList.remove('processing', 'empty');

            // Update whispra translate panel with translation result
            if (whispraLeftTargetText) {
                whispraLeftTargetText.textContent = translationResult;
                whispraLeftTargetText.classList.remove('processing', 'empty');
            }

        } catch (translationError) {
            // Only show error if translation is still active
            if (c.isTranslating) {
                c.logToDebug(`❌ Translation failed: ${translationError instanceof Error ? translationError.message : 'Unknown error'}`);
                console.error('Translation Error:', translationError);
                c.translatedTextDiv.textContent = `Translation Error: ${translationError instanceof Error ? translationError.message : 'Unknown error'}`;
                c.translatedTextDiv.classList.remove('processing');

                // Always update whispra translate panel (live panel logic)
                const whispraLeftTargetText = document.getElementById('whispra-left-target-text') as HTMLDivElement;
                if (whispraLeftTargetText) {
                    whispraLeftTargetText.textContent = `Translation Error: ${translationError instanceof Error ? translationError.message : 'Unknown error'}`;
                    whispraLeftTargetText.classList.remove('processing');
                }

                c.updateRecordingUI(false);
            }
            return;
        }

        // Final check before synthesis
        if (!c.isTranslating) {
            c.logToDebug('⚠️ Translation stopped before synthesis step, aborting');
            c.audioChunks = [];
            c.updateRecordingUI(false);
            return;
        }

        try {
            // Synthesize and play audio
            c.recordingText.textContent = 'Speaking...';
            c.logToDebug('🔊 Starting audio synthesis...');
            const translationResult = c.translatedTextDiv.textContent;
            await c.synthesizeAndPlay(translationResult);

            // Final check after synthesis
            if (!c.isTranslating) {
                c.logToDebug('⚠️ Translation stopped after synthesis, cleaning up');
                c.audioChunks = [];
                c.updateRecordingUI(false);
                return;
            }

            c.logToDebug('🔊 Audio synthesis completed');

        } catch (ttsError) {
            c.logToDebug(`❌ TTS failed: ${ttsError instanceof Error ? ttsError.message : 'Unknown error'}`);
            console.error('TTS Error:', ttsError);
            // Don't return here - the translation was successful even if TTS failed
        }

        // Reset UI
        c.updateRecordingUI(false);
        c.logToDebug('✅ Live translation completed successfully');
        await c.restartPassthroughClean();

    } catch (error) {
        const c = getContext();
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        c.logToDebug(`❌ Failed to process recorded audio: ${errorMessage}`);
        console.error('Process audio error:', error);
        console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');

        c.originalTextDiv.textContent = `Error: ${errorMessage}`;
        c.originalTextDiv.classList.remove('processing');
        c.translatedTextDiv.textContent = 'Processing failed';
        c.translatedTextDiv.classList.remove('processing');
        c.updateRecordingUI(false);
    }
}
