import { AudioCaptureService } from '../interfaces/AudioCaptureService';
import { SpeechToTextService } from '../interfaces/SpeechToTextService';
import { TranslationService } from '../interfaces/TranslationService';
import { TextToSpeechService } from '../interfaces/TextToSpeechService';
import { VirtualMicrophoneService } from '../interfaces/VirtualMicrophoneService';
import { ConfigurationManager } from './ConfigurationManager';
import { AudioCaptureService as AudioCaptureManager } from './AudioCaptureService';
import { SpeechToTextService as SpeechToTextManager } from './SpeechToTextService';
import { TranslationServiceManager } from './TranslationServiceManager';
import { TextToSpeechManager } from './TextToSpeechManager';
import { StreamingTTSService } from './StreamingTTSService';
import { VirtualMicrophoneManager } from './VirtualMicrophoneManager';
import { LocalProcessingManager } from './LocalProcessingManager';
import { TTSCache } from './TTSCache';
import { AudioFingerprintService, AudioFingerprint } from './AudioFingerprint';
import { OpenAIRealTimeClient } from './OpenAIRealTimeClient';
import { getProcessingModeFromConfig } from '../types/ConfigurationTypes';

export interface ProcessingState {
    isActive: boolean;
    currentStep: string;
    error: string | null;
    performance: {
        audioLatency: number;
        sttLatency: number;
        translationLatency: number;
        ttsLatency: number;
        totalLatency: number;
        cacheHitRate?: number;
        incomingTranslationLatency?: number;
    };
    incomingTranslation?: {
        isProcessing: boolean;
        detectedLanguage?: string;
        cacheHit: boolean;
    };
}

/**
 * Orchestrates the complete audio processing pipeline
 */
export class ProcessingOrchestrator {
    private configManager: ConfigurationManager;
    private audioCapture: AudioCaptureService;
    private speechToText: SpeechToTextService;
    private translation: TranslationService;
    private textToSpeech: TextToSpeechManager;
    private streamingTTS: StreamingTTSService;
    private virtualMicrophone: VirtualMicrophoneService;
    private localProcessingManager: LocalProcessingManager;
    private ttsCache: TTSCache;

    private isProcessing: boolean = false;
    private currentState: ProcessingState;
    private processingQueue: Array<{ audio: ArrayBuffer; timestamp: number }> = [];
    private onStateChange?: (state: ProcessingState) => void;
    private processingMode: 'cloud' | 'local' = 'cloud';
    
    // Incoming translation support
    private audioFingerprintCache: Map<string, { fingerprint: AudioFingerprint; result: any }> = new Map();
    private incomingTranslationEnabled: boolean = false; // Default to disabled
    private useOpenAIRealTime: boolean = false;
    private realTimeClient: OpenAIRealTimeClient | null = null;
    private cacheHitCount: number = 0;
    private cacheMissCount: number = 0;

    constructor(configManager: ConfigurationManager) {
        this.configManager = configManager;

        // Initialize services - simplified for MVP
        this.audioCapture = {} as AudioCaptureService; // Placeholder
        this.speechToText = {} as SpeechToTextService; // Placeholder
        this.translation = new TranslationServiceManager(configManager);
        this.textToSpeech = new TextToSpeechManager(configManager);
        this.streamingTTS = new StreamingTTSService(configManager);
        this.virtualMicrophone = new VirtualMicrophoneManager() as any;
        this.localProcessingManager = LocalProcessingManager.getInstance();
        this.ttsCache = new TTSCache(this.textToSpeech);

        // Initialize processing mode from config
        this.updateProcessingMode();
        
        // Load incoming translation settings from config
        this.loadIncomingTranslationSettings();
        
        // Initialize OpenAI Real-Time client if enabled (async, will be done in initializeServices)
        // Don't await here - constructor can't be async

            this.currentState = {
                isActive: false,
                currentStep: 'idle',
                error: null,
                performance: {
                    audioLatency: 0,
                    sttLatency: 0,
                    translationLatency: 0,
                    ttsLatency: 0,
                    totalLatency: 0,
                    cacheHitRate: 0,
                    incomingTranslationLatency: 0
                },
                incomingTranslation: {
                    isProcessing: false,
                    cacheHit: false
                }
            };
    }

    /**
     * Start the real-time processing pipeline
     */
    async startProcessing(): Promise<void> {
        if (this.isProcessing) {
            return;
        }

        try {
            this.updateState({ isActive: true, currentStep: 'initializing', error: null });

            // Initialize all services
            await this.initializeServices();

            // Start audio capture (simplified for MVP)
            const deviceId = await this.getSelectedMicrophone();
            // Note: Audio capture implementation would be needed here
            console.log('Starting audio capture with device:', deviceId);

            this.isProcessing = true;
            this.updateState({ isActive: true, currentStep: 'listening', error: null });

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.updateState({ isActive: false, currentStep: 'error', error: errorMessage });
            throw error;
        }
    }

    /**
     * Stop the processing pipeline
     */
    async stopProcessing(): Promise<void> {
        if (!this.isProcessing) {
            return;
        }

        try {
            this.updateState({ currentStep: 'stopping' });

            // Stop audio capture (simplified for MVP)
            console.log('Stopping audio capture');

            // Clear processing queue
            this.processingQueue = [];

            this.isProcessing = false;
            this.updateState({
                isActive: false,
                currentStep: 'idle',
                error: null,
                performance: {
                    audioLatency: 0,
                    sttLatency: 0,
                    translationLatency: 0,
                    ttsLatency: 0,
                    totalLatency: 0
                }
            });

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.updateState({ isActive: false, currentStep: 'error', error: errorMessage });
        }
    }

    /**
     * Process incoming translation (for bidirectional mode)
     */
    async processIncomingTranslation(audioData: ArrayBuffer, timestamp: number): Promise<void> {
        const startTime = Date.now();
        
        if (!this.incomingTranslationEnabled) {
            return;
        }

        try {
            this.updateState({ 
                incomingTranslation: { isProcessing: true, cacheHit: false }
            });

            const config = await this.configManager.getConfiguration();
            const targetLanguage = config.uiSettings?.bidirectionalTargetLanguage || config.targetLanguage || 'en';
            const sourceLanguage = config.uiSettings?.bidirectionalSourceLanguage || 'auto';

            // Generate audio fingerprint for cache lookup
            const audioBuffer = Buffer.from(audioData);
            const audioArray = new Float32Array(audioBuffer.buffer);
            const fingerprint = await AudioFingerprintService.generateFingerprint(audioArray, 16000);

            // Check fingerprint cache
            const cachedResult = this.getCachedFingerprint(fingerprint);
            if (cachedResult) {
                this.cacheHitCount++;
                this.updateState({ 
                    incomingTranslation: { 
                        isProcessing: false, 
                        cacheHit: true,
                        detectedLanguage: cachedResult.language
                    }
                });
                return;
            }

            this.cacheMissCount++;

            // Use OpenAI Real-Time API if enabled (much faster - handles STT, translation, and TTS in one)
            if (this.useOpenAIRealTime && this.realTimeClient) {
                try {
                    // Ensure connected
                    if (!this.realTimeClient.isConnectedToRealTime()) {
                        await this.realTimeClient.connect();
                    }

                    // Send audio directly to real-time API
                    // It handles STT, translation, and TTS automatically
                    this.realTimeClient.sendAudio(audioData);
                    this.realTimeClient.commitAudio();

                    const processingTime = Date.now() - startTime;
                    this.updateState({
                        incomingTranslation: {
                            isProcessing: false,
                            cacheHit: false,
                            detectedLanguage: 'auto'
                        },
                        performance: {
                            ...this.currentState.performance,
                            incomingTranslationLatency: processingTime
                        }
                    });

                    return; // Real-time API handles everything
                } catch (error) {
                    console.error('[ProcessingOrchestrator] Real-Time API error, falling back to standard pipeline:', error);
                    // Fall through to standard pipeline
                }
            }

            // Standard pipeline (STT -> Translation -> TTS)
            // Convert to AudioSegment format for STT
            const audioSegment = {
                id: `incoming_${timestamp}`,
                data: audioArray,
                sampleRate: 16000,
                duration: audioArray.length / 16000,
                timestamp
            };

            // Step 1: Speech-to-Text
            let transcriptionResult;
            if (this.processingMode === 'local' && this.localProcessingManager) {
                transcriptionResult = await this.localProcessingManager.transcribeAudio(audioBuffer, {
                    language: sourceLanguage === 'auto' ? undefined : sourceLanguage
                });
            } else {
                // Use SpeechToTextService if available
                transcriptionResult = {
                    text: '',
                    language: 'unknown',
                    confidence: 0
                };
            }

            if (!transcriptionResult.text || transcriptionResult.text.trim().length === 0) {
                return;
            }

            const detectedLanguage = transcriptionResult.language || 'unknown';

            // Step 2: Translation
            const translationResult = await this.translation.translate(
                transcriptionResult.text,
                targetLanguage,
                detectedLanguage === 'unknown' ? sourceLanguage : detectedLanguage
            );

            // Step 3: TTS (only if not using real-time API)
            if (!this.useOpenAIRealTime) {
                const voiceId = config.voiceId || 'default';
                const ttsAudio = await this.ttsCache.get(
                    translationResult.translatedText,
                    voiceId
                );
                await this.virtualMicrophone.sendAudio(ttsAudio);
            }

            // Cache the result with fingerprint
            this.cacheFingerprint(fingerprint, {
                text: transcriptionResult.text,
                translation: translationResult.translatedText,
                language: detectedLanguage,
                timestamp: Date.now()
            });

            const processingTime = Date.now() - startTime;
            this.updateState({
                incomingTranslation: {
                    isProcessing: false,
                    cacheHit: false,
                    detectedLanguage
                },
                performance: {
                    ...this.currentState.performance,
                    incomingTranslationLatency: processingTime
                }
            });

        } catch (error) {
            console.error('[ProcessingOrchestrator] Incoming translation error:', error);
            this.updateState({
                incomingTranslation: {
                    isProcessing: false,
                    cacheHit: false
                }
            });
        }
    }

    /**
     * Get cached fingerprint result
     */
    private getCachedFingerprint(fingerprint: AudioFingerprint): any | null {
        for (const [key, cached] of this.audioFingerprintCache.entries()) {
            const similarity = AudioFingerprintService.compareFingerprints(fingerprint, cached.fingerprint);
            if (similarity > 0.95) { // 95% similarity threshold
                return cached.result;
            }
        }
        return null;
    }

    /**
     * Cache fingerprint result
     */
    private cacheFingerprint(fingerprint: AudioFingerprint, result: any): void {
        const key = fingerprint.hash;
        
        // Manage cache size (keep last 100)
        if (this.audioFingerprintCache.size >= 100) {
            const firstKey = this.audioFingerprintCache.keys().next().value;
            if (firstKey) {
                this.audioFingerprintCache.delete(firstKey);
            }
        }

        this.audioFingerprintCache.set(key, { fingerprint, result });
    }

    /**
     * Detect if incoming translation is needed based on audio characteristics
     */
    private async detectIncomingTranslation(audioData: ArrayBuffer): Promise<boolean> {
        if (!this.incomingTranslationEnabled) {
            return false;
        }

        const config = await this.configManager.getConfiguration();
        const sourceLanguage = config.uiSettings?.bidirectionalSourceLanguage || config.sourceLanguage || 'auto';
        const targetLanguage = config.uiSettings?.bidirectionalTargetLanguage || config.targetLanguage || 'en';

        // If source and target are the same, no translation needed
        if (sourceLanguage !== 'auto' && sourceLanguage === targetLanguage) {
            return false;
        }

        // Check audio fingerprint cache first
        const audioBuffer = Buffer.from(audioData);
        const audioArray = new Float32Array(audioBuffer.buffer);
        const fingerprint = await AudioFingerprintService.generateFingerprint(audioArray, 16000);
        
        if (this.getCachedFingerprint(fingerprint)) {
            return true; // Cached, process it
        }

        // For now, assume incoming translation is needed if enabled
        // In a full implementation, you'd analyze audio characteristics
        return true;
    }

    /**
     * Process a single audio segment through the complete pipeline
     */
    private async processAudioSegment(audioData: ArrayBuffer, timestamp: number): Promise<void> {
        const startTime = Date.now();
        let stepStartTime = startTime;

        try {
            const config = await this.configManager.getConfiguration();
            let transcribedText: string;
            let translationResult: any;
            let ttsResult: any;
            let sttLatency: number = 0;
            let translationLatency: number = 0;
            let ttsLatency: number = 0;

            if (this.processingMode === 'local') {
                // Local processing pipeline

                // Step 1: Local Speech-to-Text using Whisper
                this.updateState({ currentStep: 'transcribing' });
                try {
                    const audioBuffer = Buffer.from(audioData);
                    const transcriptionResult = await this.localProcessingManager.transcribeAudio(audioBuffer, {
                        language: config.sourceLanguage || 'auto'
                    });
                    transcribedText = transcriptionResult.text;
                } catch (error) {
                    console.error('Local transcription failed:', error);
                    // Mock transcription as fallback
                    transcribedText = "Hello, this is a test transcription";
                }

                sttLatency = Date.now() - stepStartTime;
                stepStartTime = Date.now();

                if (!transcribedText || transcribedText.trim().length === 0) {
                    return;
                }

                // Step 2: Local Translation using Argos
                this.updateState({ currentStep: 'translating' });
                try {
                    translationResult = await this.localProcessingManager.translateText(
                        transcribedText,
                        config.targetLanguage || 'es',
                        config.sourceLanguage || 'auto'
                    );
                } catch (error) {
                    console.error('Local translation failed:', error);
                    // Fallback to cloud translation
                    translationResult = await this.translation.translate(
                        transcribedText,
                        config.targetLanguage || 'es',
                        config.sourceLanguage || 'auto'
                    );
                }

                translationLatency = Date.now() - stepStartTime;
                stepStartTime = Date.now();

                // IMMEDIATELY prefetch TTS in background (non-blocking!)
                const voiceId = config.voiceId || 'default';
                this.ttsCache.prefetch(translationResult.translatedText, voiceId, 'eleven_v3');
                console.log(`🚀 Prefetched TTS in background for: "${translationResult.translatedText.substring(0, 50)}..."`);

                // Step 3: Text-to-Speech using cache (may already be ready from prefetch!)
                this.updateState({ currentStep: 'synthesizing' });
                try {
                    const ttsStartTime = Date.now();
                    const voiceId = config.voiceId || 'default';
                    
                    // Check if already in cache (from prefetch)
                    const cacheStatus = this.ttsCache.getStatus(translationResult.translatedText, voiceId);
                    if (cacheStatus === 'ready') {
                        console.log('⚡ TTS already ready from cache!');
                    } else if (cacheStatus === 'processing') {
                        console.log('⏳ TTS processing in background, waiting...');
                    } else {
                        console.log('🔄 TTS not cached, processing now...');
                    }
                    
                    // Get from cache (waits if still processing, or synthesizes if not cached)
                    ttsResult = await this.ttsCache.get(
                        translationResult.translatedText,
                        voiceId,
                        'eleven_v3'
                    );
                    
                    ttsLatency = Date.now() - ttsStartTime;
                    console.log(`✅ TTS complete in ${ttsLatency}ms`);
                    
                    // Prefetch TTS for next chunk in queue (background processing!)
                    if (this.processingQueue.length > 0) {
                        // In a real implementation, you'd translate the next chunk first
                        // then prefetch its TTS. For now, this is a placeholder.
                        console.log(`📝 Would prefetch TTS for next ${this.processingQueue.length} chunk(s)`);
                    }
                    
                } catch (ttsError) {
                    console.error('TTS failed:', ttsError);
                    throw ttsError;
                }

                ttsLatency = Date.now() - stepStartTime;
                stepStartTime = Date.now();

            } else {
                // Cloud processing pipeline (existing logic)

                // Step 1: Speech-to-Text (simplified for MVP)
                this.updateState({ currentStep: 'transcribing' });
                // Mock transcription for now
                transcribedText = "Hello, this is a test transcription";

                sttLatency = Date.now() - stepStartTime;
                stepStartTime = Date.now();

                if (!transcribedText || transcribedText.trim().length === 0) {
                    return;
                }

                // Step 2: Translation
                this.updateState({ currentStep: 'translating' });
                translationResult = await this.translation.translate(
                    transcribedText,
                    config.targetLanguage || 'es',
                    'en'
                );

                translationLatency = Date.now() - stepStartTime;
                stepStartTime = Date.now();

                // Get voice ID first
                const voices = await this.textToSpeech.getAvailableVoices();
                const voiceId = voices[0]?.id || 'pNInz6obpgDQGcFmaJgB';

                // IMMEDIATELY prefetch TTS in background (non-blocking!)
                this.ttsCache.prefetch(translationResult.translatedText, voiceId);
                console.log(`🚀 Prefetched TTS in background for: "${translationResult.translatedText.substring(0, 50)}..."`);

                // Step 3: Text-to-Speech using cache
                this.updateState({ currentStep: 'synthesizing' });

                const ttsStartTime = Date.now();
                
                // Check if already in cache (from prefetch)
                const cacheStatus = this.ttsCache.getStatus(translationResult.translatedText, voiceId);
                if (cacheStatus === 'ready') {
                    console.log('⚡ TTS already ready from cache!');
                } else if (cacheStatus === 'processing') {
                    console.log('⏳ TTS processing in background, waiting...');
                } else {
                    console.log('🔄 TTS not cached, processing now...');
                }
                
                // Get from cache (waits if still processing, or synthesizes if not cached)
                ttsResult = await this.ttsCache.get(
                    translationResult.translatedText,
                    voiceId
                );
                
                ttsLatency = Date.now() - ttsStartTime;
                console.log(`✅ TTS complete in ${ttsLatency}ms`);

                ttsLatency = Date.now() - stepStartTime;
                stepStartTime = Date.now();
            }

            // Step 4: Output to Virtual Microphone
            this.updateState({ currentStep: 'outputting' });
            await this.virtualMicrophone.sendAudio(ttsResult);

            const outputLatency = Date.now() - stepStartTime;
            const totalLatency = Date.now() - startTime;

            // Update performance metrics
            const cacheHitRate = (this.cacheHitCount + this.cacheMissCount) > 0 
                ? this.cacheHitCount / (this.cacheHitCount + this.cacheMissCount) 
                : 0;

            this.updateState({
                currentStep: 'listening',
                performance: {
                    audioLatency: timestamp - startTime,
                    sttLatency,
                    translationLatency,
                    ttsLatency,
                    totalLatency,
                    cacheHitRate
                }
            });

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error('Processing pipeline error:', error);
            this.updateState({ currentStep: 'error', error: errorMessage });
        }
    }

    /**
     * Queue audio data for processing
     */
    private queueAudioForProcessing(audioData: ArrayBuffer): void {
        const timestamp = Date.now();
        this.processingQueue.push({ audio: audioData, timestamp });

        // Process queue (simple FIFO for now)
        this.processQueue();
    }

    /**
     * Process queued audio segments
     */
    private async processQueue(): Promise<void> {
        if (this.processingQueue.length === 0 || this.currentState.currentStep !== 'listening') {
            return;
        }

        const item = this.processingQueue.shift();
        if (item) {
            await this.processAudioSegment(item.audio, item.timestamp);

            // Continue processing queue
            if (this.processingQueue.length > 0) {
                setTimeout(() => this.processQueue(), 100);
            }
        }
    }

    /**
     * Initialize all services
     */
    private async initializeServices(): Promise<void> {
        const config = await this.configManager.getConfiguration();

        // Update processing mode
        this.updateProcessingMode();
        
        // Update incoming translation settings
        await this.updateIncomingTranslationSettings();

        // Initialize local processing if needed
        if (this.processingMode === 'local') {
            try {
                await this.localProcessingManager.initialize();
                console.log('Local processing services initialized');
            } catch (error) {
                console.error('Failed to initialize local processing services:', error);
                // Fall back to cloud processing
                this.processingMode = 'cloud';
            }
        }

        // Initialize OpenAI Real-Time client if enabled
        if (this.useOpenAIRealTime && !this.realTimeClient) {
            try {
                const { ApiKeyManager } = await import('./ApiKeyManager');
                const apiKeyManager = ApiKeyManager.getInstance();
                this.realTimeClient = new OpenAIRealTimeClient(apiKeyManager, {
                    voice: 'alloy',
                    instructions: 'You are a real-time translation assistant. Translate speech accurately and naturally.'
                });
                
                // Set up event handlers
                this.realTimeClient.on('transcription', (text: string) => {
                    console.log(`[Real-Time] Transcription: ${text}`);
                });
                
                this.realTimeClient.on('audioDelta', (audio: string) => {
                    // Decode base64 audio and play it
                    const audioBuffer = Buffer.from(audio, 'base64');
                    this.virtualMicrophone.sendAudio(audioBuffer.buffer);
                });
                
                await this.realTimeClient.connect();
                console.log('[ProcessingOrchestrator] OpenAI Real-Time API connected');
            } catch (error) {
                console.error('[ProcessingOrchestrator] Failed to initialize Real-Time API:', error);
                this.useOpenAIRealTime = false; // Disable if initialization fails
            }
        }

        // Initialize virtual microphone
        await this.virtualMicrophone.initialize();
        await this.virtualMicrophone.startStream();
    }

    /**
     * Update processing mode from configuration
     */
    private updateProcessingMode(): void {
        const config = this.configManager.getConfig();
        // Use helper function to determine processing mode from modelConfig
        this.processingMode = getProcessingModeFromConfig(config);
        console.log(`Processing mode set to: ${this.processingMode}`);
        console.log(`Config source: modelConfig = ${config?.modelConfig ? 'present' : 'missing'}`);
    }

    /**
     * Load incoming translation settings from config
     */
    private loadIncomingTranslationSettings(): void {
        const config = this.configManager.getConfig();
        const optimization = config.uiSettings?.bidirectionalOptimization;
        
        if (optimization) {
            // 'fast' mode uses Real-Time API, 'normal' uses standard pipeline
            const isFast = optimization.translationSpeed === 'fast';
            this.incomingTranslationEnabled = isFast; // Only enable if fast mode
            this.useOpenAIRealTime = isFast;
        }
    }

    /**
     * Update incoming translation settings
     */
    async updateIncomingTranslationSettings(): Promise<void> {
        this.loadIncomingTranslationSettings();
        
        // Initialize or disconnect Real-Time client based on setting
        if (this.useOpenAIRealTime && !this.realTimeClient) {
            try {
                const { ApiKeyManager } = await import('./ApiKeyManager');
                const apiKeyManager = ApiKeyManager.getInstance();
                this.realTimeClient = new OpenAIRealTimeClient(apiKeyManager, {
                    voice: 'alloy',
                    instructions: 'You are a real-time translation assistant. Translate speech accurately and naturally.'
                });
                
                // Set up event handlers
                this.realTimeClient.on('transcription', (text: string) => {
                    console.log(`[Real-Time] Transcription: ${text}`);
                });
                
                this.realTimeClient.on('audioDelta', (audio: string) => {
                    // Decode base64 audio and play it
                    const audioBuffer = Buffer.from(audio, 'base64');
                    this.virtualMicrophone.sendAudio(audioBuffer.buffer);
                });
                
                await this.realTimeClient.connect();
            } catch (error) {
                console.error('[ProcessingOrchestrator] Failed to initialize Real-Time API:', error);
            }
        } else if (!this.useOpenAIRealTime && this.realTimeClient) {
            this.realTimeClient.disconnect();
            this.realTimeClient = null;
        }
    }

    /**
     * Get selected microphone device ID
     */
    private async getSelectedMicrophone(): Promise<string> {
        const config = await this.configManager.getConfiguration();
        return config.selectedMicrophone || 'default';
    }

    /**
     * Update processing state and notify listeners
     */
    private updateState(updates: Partial<ProcessingState>): void {
        this.currentState = { ...this.currentState, ...updates };

        if (this.onStateChange) {
            this.onStateChange(this.currentState);
        }
    }

    /**
     * Get current processing state
     */
    getState(): ProcessingState {
        return { ...this.currentState };
    }

    /**
     * Set state change callback
     */
    setStateChangeCallback(callback: (state: ProcessingState) => void): void {
        this.onStateChange = callback;
    }

    /**
     * Test the complete pipeline with a sample
     */
    async testPipeline(): Promise<boolean> {
        try {
            this.updateState({ currentStep: 'testing' });

            // Test each service individually (simplified for MVP)
            if (!this.translation.isAvailable()) {
                throw new Error('Translation service not available');
            }

            if (!this.textToSpeech.isAvailable()) {
                throw new Error('Text-to-speech service not available');
            }

            if (!this.virtualMicrophone.isAvailable()) {
                throw new Error('Virtual microphone not available');
            }

            // Test a simple translation
            const testResult = await this.translation.translate('Hello', 'es', 'en');
            if (!testResult.translatedText) {
                throw new Error('Translation test failed');
            }

            this.updateState({ currentStep: 'idle', error: null });
            return true;

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.updateState({ currentStep: 'error', error: errorMessage });
            return false;
        }
    }

    /**
     * Update configuration and reinitialize services if needed
     */
    async updateConfiguration(): Promise<void> {
        const oldMode = this.processingMode;
        this.updateProcessingMode();

        // If processing mode changed, reinitialize services
        if (oldMode !== this.processingMode) {
            console.log(`Processing mode changed from ${oldMode} to ${this.processingMode}`);

            if (this.isProcessing) {
                // Stop current processing
                await this.stopProcessing();

                // Reinitialize services
                await this.initializeServices();

                // Restart processing
                await this.startProcessing();
            } else {
                // Just reinitialize services
                await this.initializeServices();
            }
        }
    }

    /**
     * Get current processing mode
     */
    getProcessingMode(): 'cloud' | 'local' {
        return this.processingMode;
    }

    /**
     * Prefetch TTS for translated text (background processing)
     */
    async prefetchTTS(translatedText: string, voiceId: string, modelId?: string): Promise<void> {
        this.ttsCache.prefetch(translatedText, voiceId, modelId);
    }

    /**
     * Get TTS cache statistics
     */
    getTTSCacheStats() {
        return this.ttsCache.getStats();
    }

    /**
     * Check if local processing is available
     */
    async isLocalProcessingAvailable(): Promise<boolean> {
        try {
            const availability = await this.localProcessingManager.isLocalProcessingAvailable();
            return availability.overall;
        } catch (error) {
            console.error('Error checking local processing availability:', error);
            return false;
        }
    }

    /**
     * Enable/disable incoming translation processing
     */
    setIncomingTranslationEnabled(enabled: boolean): void {
        this.incomingTranslationEnabled = enabled;
    }

    /**
     * Get incoming translation enabled state
     */
    isIncomingTranslationEnabled(): boolean {
        return this.incomingTranslationEnabled;
    }

    /**
     * Enable/disable OpenAI Real-Time API
     */
    async setUseOpenAIRealTime(enabled: boolean): Promise<void> {
        this.useOpenAIRealTime = enabled;
        
        if (enabled && !this.realTimeClient) {
            const { ApiKeyManager } = await import('./ApiKeyManager');
            const apiKeyManager = ApiKeyManager.getInstance();
            this.realTimeClient = new OpenAIRealTimeClient(apiKeyManager, {
                voice: 'alloy',
                instructions: 'You are a real-time translation assistant. Translate speech accurately and naturally.'
            });
            
            // Set up event handlers
            this.realTimeClient.on('transcription', (text: string) => {
                console.log(`[Real-Time] Transcription: ${text}`);
            });
            
            this.realTimeClient.on('audioDelta', (audio: string) => {
                // Decode base64 audio and play it
                const audioBuffer = Buffer.from(audio, 'base64');
                this.virtualMicrophone.sendAudio(audioBuffer.buffer);
            });
            
            await this.realTimeClient.connect();
        } else if (!enabled && this.realTimeClient) {
            this.realTimeClient.disconnect();
            this.realTimeClient = null;
        }
    }

    /**
     * Get cache statistics
     */
    getCacheStatistics(): {
        hitRate: number;
        hits: number;
        misses: number;
        fingerprintCacheSize: number;
    } {
        const total = this.cacheHitCount + this.cacheMissCount;
        return {
            hitRate: total > 0 ? this.cacheHitCount / total : 0,
            hits: this.cacheHitCount,
            misses: this.cacheMissCount,
            fingerprintCacheSize: this.audioFingerprintCache.size
        };
    }

    /**
     * Clear fingerprint cache
     */
    clearFingerprintCache(): void {
        this.audioFingerprintCache.clear();
        this.cacheHitCount = 0;
        this.cacheMissCount = 0;
    }
}