/**
 * Translation Pipeline IPC Handlers
 *
 * Handles all translation pipeline functionality including:
 * - Real-time audio processing and translation
 * - Speech-to-text transcription
 * - Translation services
 * - Text-to-speech synthesis
 * - Pipeline state management
 */

import { ipcMain, IpcMainInvokeEvent, BrowserWindow } from 'electron';
import { IPCRequest, IPCResponse } from '../messages';
import { IPC_CHANNELS } from '../channels';
import { ConfigurationManager } from '../../services/ConfigurationManager';
import { OverlayStateManager } from '../../services/OverlayStateManager';
import { getModelConfigFromConfig, getProcessingModeFromConfig } from '../../types/ConfigurationTypes';
import { WhisperPreFilter } from '../../services/WhisperPreFilter';
import { AudioSegment } from '../../interfaces/AudioCaptureService';

// Global WhisperPreFilter instance for anti-hallucination
let whisperPreFilter: WhisperPreFilter | null = null;

function getWhisperPreFilter(): WhisperPreFilter {
  if (!whisperPreFilter) {
    whisperPreFilter = new WhisperPreFilter({
      minVoiceLikelihood: 0.5,       // 50% - be somewhat permissive
      maxNoiseRatio: 0.8,            // Allow up to 80% noise
      minConfidenceToSend: 0.4,      // 40% confidence minimum
      blockPureNoise: true           // Block obvious noise
    });
    console.log('🛡️ [AntiHallucination] WhisperPreFilter initialized');
  }
  return whisperPreFilter;
}

// Global processing orchestrator instance
let processingOrchestrator: any = null;

// Global Real-Time API client for bidirectional mode
let bidirectionalRealTimeClient: any = null;

// Global overlay state manager instance for efficient reuse
let globalOverlayStateManager: OverlayStateManager | null = null;

/**
 * Get overlay state manager instance (cached for performance)
 */
function getOverlayStateManager(): OverlayStateManager {
  if (!globalOverlayStateManager) {
    globalOverlayStateManager = OverlayStateManager.getInstance();
  }
  return globalOverlayStateManager;
}

// Prevent feedback loops and concurrent processing
let lastTranslatedText = '';
let lastInputText = '';
let lastTranslationTime = 0;
let isProcessingTranslation = false; // Lock to prevent concurrent processing
const TRANSLATION_COOLDOWN = 10000; // 10 seconds cooldown (increased)
const MIN_TEXT_LENGTH = 5; // Minimum text length to process
let recentTranscriptions: string[] = []; // Track recent transcriptions to prevent loops
let lastProcessingTime = 0; // Track when we last processed audio

const LOCAL_WHISPER_MODELS = ['tiny', 'base', 'small', 'medium', 'large', 'large-v2', 'large-v3'];

/**
 * Convert Float32 PCM data to a mono 16-bit WAV buffer
 */
function float32ToWavBuffer(audioData: Float32Array, sampleRate: number = 16000): Buffer {
  const clampedSampleRate = Number.isFinite(sampleRate) && sampleRate > 0 ? Math.floor(sampleRate) : 16000;
  const numFrames = audioData.length;
  const dataSize = numFrames * 2; // 16-bit mono
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeString = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) {
      view.setUint8(offset + i, text.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 1, true); // channels
  view.setUint32(24, clampedSampleRate, true);
  const byteRate = clampedSampleRate * 2;
  view.setUint32(28, byteRate, true);
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < numFrames; i++) {
    const sample = Math.max(-1, Math.min(1, audioData[i]));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    offset += 2;
  }

  return Buffer.from(buffer);
}

// Normalize Whisper language output to ISO-639-1 codes for translators (e.g., 'russian' -> 'ru')
function normalizeLanguageCode(lang: string | undefined | null): string | undefined {
  if (!lang) return undefined;
  const lower = String(lang).toLowerCase();
  const map: Record<string, string> = {
    english: 'en',
    en: 'en',
    russian: 'ru',
    ru: 'ru',
    spanish: 'es',
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
    zh: 'zh',
    'simplified chinese': 'zh',
    'traditional chinese': 'zh',
    arabic: 'ar',
    ar: 'ar',
    hindi: 'hi',
    hi: 'hi',
    turkish: 'tr',
    tr: 'tr',
    polish: 'pl',
    pl: 'pl',
    dutch: 'nl',
    nl: 'nl'
  };
  return map[lower] || lower;
}

// Audio stream handler for real-time processing
async function handleAudioStream(
  event: IpcMainInvokeEvent,
  request: IPCRequest<{ audioData: number[]; sampleRate: number; timestamp: number }>
): Promise<IPCResponse<void>> {
  try {
    if (!processingOrchestrator || !processingOrchestrator.isActive) {
      // Not actively translating, ignore audio
      return {
        id: request.id,
        timestamp: Date.now(),
        success: true
      };
    }

    const { audioData, sampleRate, timestamp } = request.payload;

    // Convert audio data to the format expected by our services
    const audioBuffer = new Float32Array(audioData);

    // Create audio segment
    const audioSegment = {
      id: `stream_${Date.now()}`,
      data: audioBuffer,
      sampleRate: sampleRate || 16000,
      channelCount: 1,
      duration: audioBuffer.length / (sampleRate || 16000),
      timestamp: timestamp
    };

    // Calculate voice activity and microphone level for overlay updates
    const { updateOverlayWithAudioActivity } = await import('../handlers');
    await updateOverlayWithAudioActivity(audioSegment);

    // Process the audio segment through the pipeline
    await processRealTimeAudio(audioSegment);

    return {
      id: request.id,
      timestamp: Date.now(),
      success: true
    };

  } catch (error) {
    console.error('❌ Audio stream processing error:', error);
    return {
      id: request.id,
      timestamp: Date.now(),
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Process real-time audio with existing transcription
async function processRealTimeAudioWithTranscription(audioSegment: any, transcriptionText: string): Promise<void> {
  if (!processingOrchestrator || !processingOrchestrator.isActive) {
    return;
  }

  try {
    const config = processingOrchestrator.config;

    // Initialize services if not already done
    if (!processingOrchestrator.services) {
      const configManager = ConfigurationManager.getInstance();
      const { TranslationServiceManager } = await import('../../services/TranslationServiceManager');
      const { TextToSpeechManager } = await import('../../services/TextToSpeechManager');
      const { StreamingTTSService } = await import('../../services/StreamingTTSService');

      processingOrchestrator.services = {
        translation: new TranslationServiceManager(configManager),
        textToSpeech: new TextToSpeechManager(configManager),
        streamingTTS: new StreamingTTSService(configManager)
      };
    }

    const services = processingOrchestrator.services;

    console.log(`📝 Using transcription: "${transcriptionText}"`);

    // Step 1: Translation (always to English)
    console.log('🎯 Post-transcription policy: translate non-English to English, skip English');

    const translationResult = await services.translation.translate(
      transcriptionText,
      'en',
      'auto'
    );
    console.log(`🌐 Translated -> EN: "${translationResult.translatedText}"`)

    // Update feedback prevention tracking
    lastTranslatedText = translationResult.translatedText.replace(/["""]/g, '').trim();
    lastTranslationTime = Date.now();

    // Broadcast translation result to overlay
    getOverlayStateManager().updateTranslationResult({
      originalText: transcriptionText,
      translatedText: translationResult.translatedText,
      sourceLanguage: translationResult.sourceLanguage || 'auto',
      targetLanguage: 'en'
    });

    // Step 2: Text-to-Speech (ENGLISH only)
    const ttsInput = (translationResult.translatedText || '').trim();
    if (!ttsInput) {
      console.log('🛑 Empty translation result after post-transcription step; skipping TTS');
      return;
    }
    // Use streaming TTS for lower latency
    const streamingSupported = await services.streamingTTS.isStreamingSupported();
    let audioBuffer: ArrayBuffer;

    if (streamingSupported) {
      console.log(`🎵 Streaming TTS synthesis with voice: ${config.voiceId}`);
      const ttsStartTime = Date.now();
      let firstChunkTime: number | null = null;

      audioBuffer = await services.streamingTTS.synthesizeWithStreaming(
        ttsInput,
        config.voiceId,
        'eleven_v3', // Use latest model
        (chunk: ArrayBuffer, chunkIndex: number) => {
          if (firstChunkTime === null) {
            firstChunkTime = Date.now() - ttsStartTime;
            console.log(`🚀 First TTS chunk received in ${firstChunkTime}ms (TTFB)`);
          }
          console.log(`📦 TTS chunk ${chunkIndex + 1}: ${chunk.byteLength} bytes`);
        },
        (progress: { chunksReceived: number; totalBytes: number }) => {
          console.log(`📊 TTS streaming progress: ${progress.chunksReceived} chunks, ${progress.totalBytes} bytes`);
        }
      );

      const totalTime = Date.now() - ttsStartTime;
      console.log(`✅ Streaming TTS complete: ${totalTime}ms total, ${firstChunkTime}ms to first chunk, ${audioBuffer.byteLength} bytes`);
    } else {
      console.log(`🎤 Regular TTS synthesis with voice: ${config.voiceId} (streaming not supported)`);
      audioBuffer = await services.textToSpeech.synthesize(ttsInput, config.voiceId);
      console.log(`🎵 Generated audio: ${audioBuffer.byteLength} bytes`);
    }

    // Step 3: Output audio - send back to renderer for playback
    console.log('🔊 Sending translated audio to renderer for playback');

    // Send the audio back to the renderer process for playback
    // This allows the user to hear the translation in the app
    try {
      // Convert ArrayBuffer to regular array for IPC transmission
      const audioArray = Array.from(new Uint8Array(audioBuffer));

      // Send to all renderer processes (in case there are multiple windows)
      const { BrowserWindow } = await import('electron');
      const windows = BrowserWindow.getAllWindows();

      for (const window of windows) {
        if (!window.isDestroyed()) {
          window.webContents.send('realtime-audio-playback', {
            audioData: audioArray,
            originalText: transcriptionText,
            translatedText: translationResult.translatedText,
            outputToVirtualMic: config.outputToVirtualMic
          });
        }
      }

      console.log('✅ Audio sent to renderer for playback');
    } catch (error) {
      console.error('❌ Failed to send audio to renderer:', error);
    }

    console.log('✅ Real-time translation complete');

  } catch (error) {
    console.error('❌ Real-time translation error:', error);
  }
}

// Process real-time audio through the complete pipeline
async function processRealTimeAudio(audioSegment: any): Promise<void> {
  if (!processingOrchestrator || !processingOrchestrator.isActive) {
    return;
  }

  try {
    const config = processingOrchestrator.config;
    const configManager = ConfigurationManager.getInstance();
    const appCfg = configManager.getConfig();
    const processingMode = getProcessingModeFromConfig(appCfg);
    const modelConfig =
      getModelConfigFromConfig(appCfg) ||
      (appCfg as any).modelConfig ||
      (appCfg as any).cloudModelConfig ||
      {};
    const whisperModel = modelConfig?.whisperModel || 'whisper-1';
    const translationProvider = modelConfig?.gptModel || 'openai';
    const preferLocalWhisper = processingMode === 'local' || LOCAL_WHISPER_MODELS.includes(whisperModel);

    console.log(`[Pipeline] Whisper model=${whisperModel} (${preferLocalWhisper ? 'local' : 'cloud'}) | Translation provider=${translationProvider}`);

    // Initialize services if not already done
    if (!processingOrchestrator.services) {
      const { WhisperApiClient } = await import('../../services/WhisperApiClient');
      const { DeepInfraWhisperClient } = await import('../../services/DeepInfraWhisperClient');
      const { ApiKeyManager } = await import('../../services/ApiKeyManager');
      const { SpeechToTextService } = await import('../../services/SpeechToTextService');
      const { TranslationServiceManager } = await import('../../services/TranslationServiceManager');
      const { TextToSpeechManager } = await import('../../services/TextToSpeechManager');
      const { StreamingTTSService } = await import('../../services/StreamingTTSService');

      const apiKeyManager = ApiKeyManager.getInstance();
      const whisperClient = new WhisperApiClient(apiKeyManager);
      const deepInfraClient = new DeepInfraWhisperClient(apiKeyManager);

      processingOrchestrator.services = {
        speechToText: new SpeechToTextService(whisperClient, deepInfraClient, apiKeyManager),
        translation: new TranslationServiceManager(configManager),
        textToSpeech: new TextToSpeechManager(configManager),
        streamingTTS: new StreamingTTSService(configManager),
        virtualMic: null // Will be created when needed
      };

      // Bias STT language and provider from app config if provided
      try {
        const appCfg = configManager.getConfig();
        const srcLang = (appCfg.sourceLanguage || '').trim().toLowerCase();
        const normalized = (!srcLang || srcLang === 'auto') ? 'auto' : srcLang;
        const langCands = Array.isArray(appCfg.languageCandidates) ? appCfg.languageCandidates : undefined;
        // Get whisper model from unified config (with backward compatibility)
        const modelConfig = (appCfg as any).modelConfig
          || (appCfg as any).cloudModelConfig
          || {};
        const whisperModel = modelConfig?.whisperModel || 'whisper-1';
        // Only use OpenAI when whisper-1 (OpenAI Whisper) is selected
        const sttProvider = whisperModel === 'deepinfra' ? 'deepinfra' : 
                           whisperModel === 'whisper-1' ? 'openai' : 'deepinfra';
        (processingOrchestrator.services.speechToText as any).updateConfig({
          language: normalized,
          languageCandidates: langCands,
          provider: sttProvider,
          model: whisperModel
        });
      } catch {}
    }

    const services = processingOrchestrator.services;

    // Step 1: Speech-to-Text
    console.log('🎤 Processing real-time audio segment...');

    // Update overlay with processing state
    const overlayStateManager = getOverlayStateManager();
    overlayStateManager.updateMicrophoneState({
      isActive: true,
      isRecording: true,
      deviceId: '',
      level: 50
    });

    let transcriptionResult: any = null;

    if (preferLocalWhisper) {
      try {
        const { LocalProcessingManager } = await import('../../services/LocalProcessingManager');
        const localManager = LocalProcessingManager.getInstance();
        await localManager.initialize();
        const availability = await localManager.isLocalProcessingAvailable();
        if (!availability.whisper) {
          throw new Error('Local Whisper service is not available');
        }

        const wavBuffer = float32ToWavBuffer(audioSegment.data, audioSegment.sampleRate || 16000);
        transcriptionResult = await localManager.transcribeAudio(wavBuffer, {
          language: (appCfg.sourceLanguage || '').trim().toLowerCase() === 'auto'
            ? undefined
            : appCfg.sourceLanguage,
          model: whisperModel
        });
        console.log(`🎤 Using LOCAL Whisper (${whisperModel}) for real-time transcription`);
      } catch (localError) {
        console.warn('⚠️ Local Whisper requested but unavailable, falling back to cloud STT:', localError);
      }
    }

    if (!transcriptionResult) {
      transcriptionResult = await services.speechToText.transcribe(audioSegment);
    }

    if (!transcriptionResult.text || transcriptionResult.text.trim().length === 0) {
      // No speech detected, skip processing
      return;
    }

    console.log(`📝 Transcribed: "${transcriptionResult.text}"`);

    // Update overlay with recording state (reuse same instance)
    overlayStateManager.updateMicrophoneState({
      isActive: true,
      isRecording: false,
      deviceId: '',
      level: 0
    });

    // Post-transcription policy: If English, skip; else translate to EN
    const srcLang = normalizeLanguageCode(transcriptionResult.language) || 'auto';
    if (srcLang === 'en') {
      console.log('🚫 Detected English in post-transcription step; skipping translation and TTS');
      return;
    }

    const translationResult = await services.translation.translate(
      transcriptionResult.text,
      'en',
      srcLang
    );
    console.log(`🌐 Translated -> EN: "${translationResult.translatedText}"`);

    // Step 3: Text-to-Speech (EN ONLY)
    const ttsInput2 = (translationResult.translatedText || '').trim();
    if (!ttsInput2) {
      console.log('🛑 Empty translation result; skipping TTS');
      return;
    }
    // Use streaming TTS for lower latency
    const streamingSupported = await services.streamingTTS.isStreamingSupported();
    let audioBuffer: ArrayBuffer;

    if (streamingSupported) {
      console.log(`🎵 Streaming TTS synthesis with voice: ${config.voiceId}`);
      const ttsStartTime = Date.now();
      let firstChunkTime: number | null = null;

      audioBuffer = await services.streamingTTS.synthesizeWithStreaming(
        ttsInput2,
        config.voiceId,
        'eleven_v3', // Use latest model
        (chunk: ArrayBuffer, chunkIndex: number) => {
          if (firstChunkTime === null) {
            firstChunkTime = Date.now() - ttsStartTime;
            console.log(`🚀 First TTS chunk received in ${firstChunkTime}ms (TTFB)`);
          }
          console.log(`📦 TTS chunk ${chunkIndex + 1}: ${chunk.byteLength} bytes`);
        },
        (progress: { chunksReceived: number; totalBytes: number }) => {
          console.log(`📊 TTS streaming progress: ${progress.chunksReceived} chunks, ${progress.totalBytes} bytes`);
        }
      );

      const totalTime = Date.now() - ttsStartTime;
      console.log(`✅ Streaming TTS complete: ${totalTime}ms total, ${firstChunkTime}ms to first chunk, ${audioBuffer.byteLength} bytes`);
    } else {
      console.log(`🎤 Regular TTS synthesis with voice: ${config.voiceId} (streaming not supported)`);
      audioBuffer = await services.textToSpeech.synthesize(ttsInput2, config.voiceId);
      console.log(`🎵 Generated audio: ${audioBuffer.byteLength} bytes`);
    }

    // Step 4: Output audio
    console.log('🔊 Playing audio in main process (simulated virtual microphone)');

    // In the main process, we can't use AudioContext, so we'll just log the audio output
    // In a full implementation, this would be handled by the renderer process
    if (config.outputToVirtualMic) {
      console.log('🎤 Audio would be sent to virtual microphone');
    } else {
      console.log('🔊 Audio would be played to headphones');
    }

    console.log('✅ Real-time audio processing complete');

  } catch (error) {
    console.error('❌ Real-time audio processing error:', error);
  }
}

async function handleStartTranslation(
  event: IpcMainInvokeEvent,
  request: IPCRequest<{ microphoneId: string; targetLanguage: string; voiceId: string; outputToVirtualMic: boolean }>
): Promise<IPCResponse<{ status: string }>> {
  console.log('🚀 Handling start translation request', request.payload);

  try {
    const { microphoneId, targetLanguage, voiceId, outputToVirtualMic } = request.payload;

    // Initialize services
    console.log('📋 Initializing real-time translation services...');
    const configManager = ConfigurationManager.getInstance();
    const config = configManager.getConfig();

    // Keys will be looked up via secure storage by the services

    // Don't initialize services here - they will be created lazily when needed
    // This prevents AudioContext errors in the main process

    // Store configuration for processing
    const processingConfig = {
      microphoneId,
      targetLanguage,
      voiceId,
      outputToVirtualMic
    };

    // Initialize the processing orchestrator for real-time audio
    console.log(`🎤 Starting real-time translation: ${microphoneId} -> ${targetLanguage}`);
    console.log('🔊 Audio will be captured from renderer process and streamed to main process');

    // Store the processing orchestrator
    processingOrchestrator = {
      config: processingConfig,
      isActive: true,
      services: null // Will be initialized when first audio arrives
    };

    console.log('✅ Real-time translation started successfully');

    // Update mini overlay red indicator - voice translation is running
    try {
      const { SplitOverlayWindowManager } = await import('../../services/SplitOverlayWindowManager');
      SplitOverlayWindowManager.getInstance().updateAudioDetected(true);
    } catch (error) {
      console.error('Failed to update mini overlay voice translation indicator:', error);
    }

    // Broadcast microphone state to overlay
    getOverlayStateManager().updateMicrophoneState({
      isActive: true,
      isRecording: false,
      deviceId: microphoneId,
      level: 0
    });

    // Broadcast translation state change to overlay
    const windows = BrowserWindow.getAllWindows();
    console.log(`📡 [Main Process] Broadcasting translation start to ${windows.length} windows`);
    for (const win of windows) {
      if (!win.isDestroyed()) {
        const url = win.webContents.getURL();
        console.log(`📤 [Main Process] Sending translation:state-changed (start) to window: ${url}`);
        win.webContents.send('translation:state-changed', { isActive: true, isRunning: true });
      }
    }

    return {
      id: request.id,
      timestamp: Date.now(),
      success: true,
      payload: { status: 'started' }
    };

  } catch (error) {
    console.error('❌ Error starting translation:', error);
    return {
      id: request.id,
      timestamp: Date.now(),
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

async function handleStopTranslation(
  event: IpcMainInvokeEvent,
  request: IPCRequest<void>
): Promise<IPCResponse<{ status: string }>> {
  console.log('🛑 Handling stop translation request');

  try {
    // Stop the real-time processing
    if (processingOrchestrator && processingOrchestrator.isActive) {
      console.log('🔄 Stopping real-time translation...');

      processingOrchestrator.isActive = false;
      processingOrchestrator = null;

      // Update mini overlay red indicator - voice translation stopped
      try {
        const { SplitOverlayWindowManager } = await import('../../services/SplitOverlayWindowManager');
        SplitOverlayWindowManager.getInstance().updateAudioDetected(false);
      } catch (error) {
        console.error('Failed to update mini overlay voice translation indicator:', error);
      }

      // Clear feedback prevention tracking
      lastTranslatedText = '';
      lastInputText = '';
      lastTranslationTime = 0;
      isProcessingTranslation = false;
      recentTranscriptions = [];

      console.log('✅ Real-time translation stopped and tracking cleared');

      // Broadcast microphone state to overlay
      getOverlayStateManager().updateMicrophoneState({
        isActive: false,
        isRecording: false,
        deviceId: '',
        level: 0
      });

      // Broadcast translation state change to overlay
      const windows = BrowserWindow.getAllWindows();
      console.log(`📡 [Main Process] Broadcasting translation stop to ${windows.length} windows`);
      for (const win of windows) {
        if (!win.isDestroyed()) {
          const url = win.webContents.getURL();
          console.log(`📤 [Main Process] Sending translation:state-changed (stop) to window: ${url}`);
          win.webContents.send('translation:state-changed', { isActive: false, isRunning: false });
        }
      }
    } else {
      console.log('⚠️ No active translation to stop');
    }

    return {
      id: request.id,
      timestamp: Date.now(),
      success: true,
      payload: { status: 'stopped' }
    };
  } catch (error) {
    console.error('❌ Error stopping translation:', error);
    return {
      id: request.id,
      timestamp: Date.now(),
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

async function handleGetServiceStatus(
  event: IpcMainInvokeEvent,
  request: IPCRequest<void>
): Promise<IPCResponse<any>> {
  console.log('Handling get service status request');

  // Placeholder implementation
  return {
    id: request.id,
    timestamp: Date.now(),
    success: true,
    payload: {
      speechToText: { available: false, status: 'unavailable' },
      translation: { available: false, status: 'unavailable' },
      textToSpeech: { available: false, status: 'unavailable' },
      virtualMicrophone: { available: false, status: 'unavailable' },
      audioCapture: { available: false, status: 'unavailable' }
    }
  };
}

async function handleGetLogs(
  event: IpcMainInvokeEvent,
  request: IPCRequest<any>
): Promise<IPCResponse<any[]>> {
  console.log('Handling get logs request');

  // Placeholder implementation
  return {
    id: request.id,
    timestamp: Date.now(),
    success: true,
    payload: []
  };
}

async function handleClearLogs(
  event: IpcMainInvokeEvent,
  request: IPCRequest<void>
): Promise<IPCResponse<void>> {
  console.log('Handling clear logs request');

  // Placeholder implementation
  return {
    id: request.id,
    timestamp: Date.now(),
    success: true
  };
}

async function handleGetMetrics(
  event: IpcMainInvokeEvent,
  request: IPCRequest<void>
): Promise<IPCResponse<any>> {
  console.log('Handling get metrics request');

  // Placeholder implementation
  return {
    id: request.id,
    timestamp: Date.now(),
    success: true,
    payload: {
      memory: { used: 0, total: 0, percentage: 0 },
      cpuUsage: 0,
      network: { bytesSent: 0, bytesReceived: 0, uploadSpeed: 0, downloadSpeed: 0, online: true },
      audioLatency: { endToEnd: 0, speechToText: 0, translation: 0, textToSpeech: 0, audioOutput: 0 },
      apiResponseTimes: {}
    }
  };
}

async function handleGetVoices(
  event: IpcMainInvokeEvent,
  request: IPCRequest<void>
): Promise<IPCResponse<any[]>> {
  console.log('🎤 Handling get voices request');

  try {
    const configManager = ConfigurationManager.getInstance();
    const { TextToSpeechManager } = await import('../../services/TextToSpeechManager');

    const ttsService = new TextToSpeechManager(configManager);
    // Always attempt to initialize and fetch voices; availability is determined lazily
    const voices = await ttsService.getAvailableVoices();
    const hasRealProvider = ttsService.isAvailable();

    if (hasRealProvider) {
      console.log(`✅ Found ${voices.length} voices from ElevenLabs`);
    } else {
      console.log('⚠️ TTS service not available; returning empty list');
      return {
        id: request.id,
        timestamp: Date.now(),
        success: true,
        payload: []
      };
    }

    return {
      id: request.id,
      timestamp: Date.now(),
      success: true,
      payload: voices
    };
  } catch (error) {
    console.error('❌ Error getting voices:', error);
    return {
      id: request.id,
      timestamp: Date.now(),
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      payload: []
    };
  }
}

async function handleStartVoiceCloning(
  event: IpcMainInvokeEvent,
  request: IPCRequest<any>
): Promise<IPCResponse<void>> {
  console.log('Handling start voice cloning request');

  // Placeholder implementation
  return {
    id: request.id,
    timestamp: Date.now(),
    success: true
  };
}

async function handleTestTranslation(
  event: IpcMainInvokeEvent,
  request: IPCRequest<{ text: string; targetLanguage: string; voiceId: string; outputToHeadphones: boolean }>
): Promise<IPCResponse<{ originalText: string; translatedText: string; audioGenerated: boolean; audioBuffer?: number[] | null }>> {
  console.log('🧪 Handling test translation request:', request.payload);

  // Add stack trace to debug where this is being called from
  const stack = new Error().stack;
  console.log('📍 Test translation call stack:', stack?.split('\n').slice(1, 4).join('\n'));

  // Allow test translation to work - it's used by push-to-talk functionality

  try {
    const { text, targetLanguage, voiceId, outputToHeadphones } = request.payload;

    // Initialize services
    console.log('📋 Initializing services...');
    const configManager = ConfigurationManager.getInstance();
    const config = configManager.getConfig();

    // Keys are resolved by services from secure storage

    const { TranslationServiceManager } = await import('../../services/TranslationServiceManager');
    const { TextToSpeechManager } = await import('../../services/TextToSpeechManager');
    const { StreamingTTSService } = await import('../../services/StreamingTTSService');

    const translationService = new TranslationServiceManager(configManager);
    const ttsService = new TextToSpeechManager(configManager);
    const streamingTTS = new StreamingTTSService(configManager);

    // Use the provided target language for translation
    const detectedSrc = 'auto';
    const finalTargetLanguage = targetLanguage || 'en';
    console.log(`🔄 Test translating to ${finalTargetLanguage} | src=${detectedSrc} | text="${text}"`);
    const translationResult = await translationService.translate(text, finalTargetLanguage, detectedSrc);
    console.log(`✅ Translation result: "${translationResult.translatedText}"`);

    // Synthesize the translated text using streaming for lower latency
    const ttsInput = translationResult.translatedText;
    const streamingSupported = await streamingTTS.isStreamingSupported();
    let audioBuffer: ArrayBuffer;

    if (streamingSupported) {
      console.log(`🎵 Streaming TTS synthesis for ${finalTargetLanguage} with voice: ${voiceId}`);
      const ttsStartTime = Date.now();
      let firstChunkTime: number | null = null;

      audioBuffer = await streamingTTS.synthesizeWithStreaming(
        ttsInput,
        voiceId,
        'eleven_v3', // Use latest model
        (chunk: ArrayBuffer, chunkIndex: number) => {
          if (firstChunkTime === null) {
            firstChunkTime = Date.now() - ttsStartTime;
            console.log(`🚀 First TTS chunk received in ${firstChunkTime}ms (TTFB)`);
          }
          console.log(`📦 TTS chunk ${chunkIndex + 1}: ${chunk.byteLength} bytes`);
        },
        (progress: { chunksReceived: number; totalBytes: number }) => {
          console.log(`📊 TTS streaming progress: ${progress.chunksReceived} chunks, ${progress.totalBytes} bytes`);
        }
      );

      const totalTime = Date.now() - ttsStartTime;
      console.log(`✅ Streaming TTS complete: ${totalTime}ms total, ${firstChunkTime}ms to first chunk, ${audioBuffer.byteLength} bytes`);
    } else {
      console.log(`🎤 Regular TTS synthesis for ${finalTargetLanguage} with voice: ${voiceId} (streaming not supported)`);
      audioBuffer = await ttsService.synthesize(ttsInput, voiceId);
      console.log(`✅ TTS synthesis complete: ${audioBuffer.byteLength} bytes`);
    }

    // Do NOT push playback events from main. Return audio buffer and let renderer decide routing.
    // This avoids duplicate playback and potential feedback loops.

    return {
      id: request.id,
      timestamp: Date.now(),
      success: true,
      payload: {
        originalText: text,
        translatedText: translationResult.translatedText,
        audioGenerated: true,
        audioBuffer: Array.from(new Uint8Array(audioBuffer))
      }
    };
  } catch (error) {
    console.error('❌ Test translation failed:', error);
    return {
      id: request.id,
      timestamp: Date.now(),
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

async function handleGetTranslationStatus(
  event: IpcMainInvokeEvent,
  request: IPCRequest<void>
): Promise<IPCResponse<any>> {
  console.log('📊 Handling get translation status request');

  try {
    // Return actual status based on processing orchestrator
    const status = {
      isActive: processingOrchestrator ? processingOrchestrator.isActive : false,
      currentStep: processingOrchestrator ? 'listening' : 'idle',
      error: null,
      performance: {
        audioLatency: 0,
        sttLatency: 0,
        translationLatency: 0,
        ttsLatency: 0,
        totalLatency: 0
      },
      config: processingOrchestrator ? processingOrchestrator.config : null
    };

    console.log('📊 Returning translation status:', JSON.stringify(status, null, 2));
    return {
      id: request.id,
      timestamp: Date.now(),
      success: true,
      payload: status
    };
  } catch (error) {
    console.error('❌ Error getting translation status:', error);
    return {
      id: request.id,
      timestamp: Date.now(),
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

async function handleSpeechTranscription(
  event: IpcMainInvokeEvent,
  request: IPCRequest<{ audioData: number[]; language?: string; targetLanguage?: string; contentType?: string }>
): Promise<IPCResponse<{ text: string; language?: string; duration?: number; skipped?: boolean; reason?: string }>> {
  console.log('🎤 Handling speech transcription request');

  try {
    const { audioData, language, targetLanguage, contentType } = request.payload;
    
    // Check if incoming translation optimization is enabled
    const configManager = ConfigurationManager.getInstance();
    const config = configManager.getConfig();
    const optimization = config.uiSettings?.bidirectionalOptimization;
    
    // If fast mode is enabled and using OpenAI, route audio directly to Real-Time API
    const modelConfig = getModelConfigFromConfig(config);
    const gptModel = modelConfig?.gptModel || 'openai';
    const whisperModel = modelConfig?.whisperModel || 'whisper-1';
    const processingMode = getProcessingModeFromConfig(config);
    const preferLocalWhisper = processingMode === 'local' || LOCAL_WHISPER_MODELS.includes(whisperModel);
    
    // Only use OpenAI Real-Time API when OpenAI GPT model is actually selected
    if (optimization?.translationSpeed === 'fast' && gptModel === 'openai') {
      console.log('⚡ Using OpenAI Real-Time API for incoming translation');
      
      // Try bidirectional Real-Time client first, then ProcessingOrchestrator
      const realTimeClient = bidirectionalRealTimeClient || (processingOrchestrator?.realTimeClient);
      
      if (realTimeClient) {
        try {
          const audioBuffer = new Uint8Array(audioData).buffer;
          
          // Send audio to Real-Time API
          if (realTimeClient.isConnectedToRealTime()) {
            realTimeClient.sendAudio(audioBuffer);
            realTimeClient.commitAudio();
            
            console.log('⚡ Audio sent to Real-Time API');
            
            // Real-Time API handles everything, return empty result (audio will come through events)
            return {
              id: request.id,
              timestamp: Date.now(),
              success: true,
              payload: {
                text: '',
                language: 'auto',
                skipped: true,
                reason: 'Using OpenAI Real-Time API - processing in background'
              }
            };
          } else {
            console.warn('⚠️ Real-Time API not connected, falling back to standard pipeline');
          }
        } catch (error) {
          console.error('❌ Real-Time API error, falling back to standard pipeline:', error);
        }
      } else {
        console.warn('⚠️ Real-Time API client not initialized, falling back to standard pipeline');
      }
    }
    
    // Standard transcription pipeline
    // Initialize services
    console.log('📋 Initializing Whisper service...');

    const audioUint8Array = new Uint8Array(audioData);
    const sourceLanguageSetting = language || 'auto';
    let languageDetectionResult: any = null;
    let transcriptionResult: any = null;
    let audioBuffer: ArrayBuffer | null = null;

    // ============================================
    // ANTI-HALLUCINATION PRE-FILTER
    // Analyze audio BEFORE sending to Whisper to reject noise/silence
    // ============================================
    try {
      const preFilter = getWhisperPreFilter();
      
      // Convert audio to Float32Array for analysis
      // WAV format: skip 44-byte header, then convert 16-bit PCM to float
      let audioFloat32: Float32Array;
      let sampleRate = 16000;
      
      if (audioUint8Array.length > 44) {
        // Try to read sample rate from WAV header
        const headerView = new DataView(audioUint8Array.buffer, audioUint8Array.byteOffset, audioUint8Array.byteLength);
        try {
          sampleRate = headerView.getUint32(24, true);
        } catch { sampleRate = 16000; }
        
        // Find data chunk offset
        let dataOffset = 44;
        for (let i = 0; i < Math.min(audioUint8Array.length - 4, 100); i++) {
          if (audioUint8Array[i] === 0x64 && audioUint8Array[i + 1] === 0x61 && 
              audioUint8Array[i + 2] === 0x74 && audioUint8Array[i + 3] === 0x61) {
            dataOffset = i + 8;
            break;
          }
        }
        
        // Convert 16-bit PCM to Float32
        const pcmData = audioUint8Array.slice(dataOffset);
        const numSamples = Math.floor(pcmData.length / 2);
        audioFloat32 = new Float32Array(numSamples);
        const pcmView = new DataView(pcmData.buffer, pcmData.byteOffset, pcmData.byteLength);
        
        for (let i = 0; i < numSamples; i++) {
          const int16 = pcmView.getInt16(i * 2, true);
          audioFloat32[i] = int16 / 32768;
        }
      } else {
        // Too short, create empty array
        audioFloat32 = new Float32Array(0);
      }
      
      // Create AudioSegment for the pre-filter
      const audioSegment: AudioSegment = {
        id: `prefilter_${Date.now()}`,
        data: audioFloat32,
        sampleRate: sampleRate,
        channelCount: 1,
        duration: audioFloat32.length / sampleRate,
        timestamp: Date.now()
      };
      
      // Run pre-filter analysis
      const analysis = preFilter.analyzeAudio(audioSegment);
      
      console.log(`🛡️ [AntiHallucination] Pre-filter: confidence=${analysis.confidence.toFixed(2)}, ` +
                  `voiceLike=${analysis.isVoiceLike}, noise=${(analysis.noiseRatio * 100).toFixed(1)}%, ` +
                  `shouldSend=${analysis.shouldSendToWhisper}`);
      
      // If pre-filter says don't send, skip Whisper entirely
      if (!analysis.shouldSendToWhisper) {
        console.log(`🔇 [AntiHallucination] Pre-filter BLOCKED audio - not voice-like or too noisy`);
        return {
          id: request.id,
          timestamp: Date.now(),
          success: true,
          payload: {
            text: '',
            language: 'auto',
            skipped: true,
            reason: `Pre-filter blocked: confidence=${analysis.confidence.toFixed(2)}, noise=${(analysis.noiseRatio * 100).toFixed(0)}%`
          }
        };
      }
    } catch (preFilterError) {
      // If pre-filter fails, continue with transcription (don't block on filter errors)
      console.warn('⚠️ [AntiHallucination] Pre-filter error, continuing:', preFilterError);
    }
    // ============================================
    // END ANTI-HALLUCINATION PRE-FILTER
    // ============================================

    if (preferLocalWhisper) {
      try {
        const { LocalProcessingManager } = await import('../../services/LocalProcessingManager');
        const localManager = LocalProcessingManager.getInstance();
        await localManager.initialize();
        const availability = await localManager.isLocalProcessingAvailable();
        if (!availability.whisper) {
          throw new Error('Local Whisper service is not available');
        }

        const localTranscription = await localManager.transcribeAudio(Buffer.from(audioUint8Array), {
          language: sourceLanguageSetting === 'auto' ? undefined : sourceLanguageSetting,
          model: whisperModel
        });

        languageDetectionResult = {
          text: localTranscription.text || '',
          language: localTranscription.language || sourceLanguageSetting,
          duration: localTranscription.duration || 0,
          segments: localTranscription.segments || []
        };
        transcriptionResult = languageDetectionResult;
        console.log(`🎤 Using LOCAL Whisper (${whisperModel}) for transcription`);
      } catch (localError) {
        // Don't fallback to cloud providers when local model is selected
        console.error('❌ Local Whisper transcription failed:', localError);
        throw new Error(`Local Whisper transcription failed: ${localError instanceof Error ? localError.message : 'Unknown error'}`);
      }
    }

    // Only use cloud providers if a cloud model is explicitly selected (not a local fallback)
    if (!languageDetectionResult && !preferLocalWhisper) {
      // Keys are resolved by Whisper client from secure storage
      const { WhisperApiClient } = await import('../../services/WhisperApiClient');
      const { DeepInfraWhisperClient } = await import('../../services/DeepInfraWhisperClient');
      const { ApiKeyManager } = await import('../../services/ApiKeyManager');

      const apiKeyManager = ApiKeyManager.getInstance();
      // Only use OpenAI WhisperApiClient when whisper-1 (OpenAI Whisper) is selected
      // Local models should have been handled above, so this should only be for cloud models
      const sttProvider = whisperModel === 'deepinfra' ? 'deepinfra' : 
                         whisperModel === 'whisper-1' ? 'openai' : 'deepinfra';
      const whisperClient = sttProvider === 'deepinfra'
        ? new DeepInfraWhisperClient(apiKeyManager)
        : new WhisperApiClient(apiKeyManager);
      console.log(`🎤 Using ${sttProvider.toUpperCase()} (${whisperModel}) for transcription`);

      // Convert audio data back to blob
      audioBuffer = audioUint8Array.buffer;
      const originalBlob = new Blob([audioBuffer], { type: contentType || 'audio/wav' });

      console.log(`🎵 Processing audio: ${originalBlob.size} bytes (${contentType || 'audio/wav'})`);

      // Enhanced audio handling - prioritize WAV format from VAD processing
      let audioBlob: Blob;

      if (contentType === 'audio/wav' || contentType === 'audio/wave' || !contentType) {
        // WAV format from WASAPI/VAD - use directly
        audioBlob = originalBlob;
        console.log('🎵 Audio in WAV format from VAD processing, using directly');

        // Log WAV format for cost tracking
        if (audioBuffer && audioBuffer.byteLength > 44) {
          const view = new DataView(audioBuffer);
          const sampleRate = view.getUint32(24, true);
          const channels = view.getUint16(22, true);
          const dataSize = view.getUint32(40, true);
          const durationSeconds = dataSize / (sampleRate * channels * 2);
          console.log(`📊 VAD Audio: ${sampleRate}Hz, ${channels}ch, ${durationSeconds.toFixed(2)}s, ${Math.round(dataSize / 1024)}KB`);
        }
      } else {
        // Legacy format handling (should rarely occur with VAD integration)
        console.warn('⚠️ Received non-WAV audio format:', contentType);
        console.warn('⚠️ This indicates audio not processed through VAD. Consider using WASAPI VAD capture.');
        audioBlob = originalBlob;
      }

      // Validate audio for Whisper
      const { AudioFormatConverter } = await import('../../services/AudioFormatConverter');
      const validation = AudioFormatConverter.validateAudioForWhisper(audioBlob);
      if (!validation.valid) {
        console.warn('⚠️ Audio validation issues:', validation.issues);
      }

      console.log(`🎵 Transcribing audio: ${audioBlob.size} bytes`);
      console.log(`🔍 Transcribing with source language: ${sourceLanguageSetting}`);

      // Note: Whisper prompt removed - it can cause Whisper to echo the prompt back as transcription
      // Relying on pre-filter and post-filter instead for anti-hallucination

      try {
        languageDetectionResult = await whisperClient.transcribe({
          audio: audioBlob,
          response_format: 'verbose_json',
          temperature: 0,
          language: sourceLanguageSetting === 'auto' ? undefined : sourceLanguageSetting
        });
        transcriptionResult = languageDetectionResult;
      } catch (detectionError) {
        console.warn('⚠️ Language detection failed, falling back to full transcription:', detectionError);
        transcriptionResult = await whisperClient.transcribe({
          audio: audioBlob,
          response_format: 'verbose_json',
          temperature: 0,
          language: language === 'auto' ? undefined : language
        });
        languageDetectionResult = transcriptionResult;
      }
    } else {
      console.log(`🔍 Using existing local transcription with source language setting: ${sourceLanguageSetting}`);
    }

    if (!transcriptionResult) {
      throw new Error('Failed to obtain transcription result');
    }

    // ============================================
    // ANTI-HALLUCINATION POST-FILTER
    // Validate Whisper response to catch hallucinations
    // ============================================
    const detectedLanguage = languageDetectionResult.language;
    let transcribedText = transcriptionResult.text?.trim() || '';

    // Check Whisper's confidence metrics
    try {
      const segments = transcriptionResult.segments || [];
      let avgNoSpeechProb = 0;
      let avgLogProb = 0;
      let avgCompressionRatio = 0;
      let segmentCount = 0;

      for (const seg of segments) {
        if (typeof seg.no_speech_prob === 'number') avgNoSpeechProb += seg.no_speech_prob;
        if (typeof seg.avg_logprob === 'number') avgLogProb += seg.avg_logprob;
        if (typeof seg.compression_ratio === 'number') avgCompressionRatio += seg.compression_ratio;
        segmentCount++;
      }

      if (segmentCount > 0) {
        avgNoSpeechProb /= segmentCount;
        avgLogProb /= segmentCount;
        avgCompressionRatio /= segmentCount;
      }

      console.log(`🛡️ [AntiHallucination] Post-filter: no_speech=${avgNoSpeechProb.toFixed(3)}, ` +
                  `logprob=${avgLogProb.toFixed(3)}, compression=${avgCompressionRatio.toFixed(2)}, text="${transcribedText.substring(0, 50)}"`);

      // Reject high no_speech probability (Whisper thinks it's not speech)
      if (avgNoSpeechProb > 0.7) {
        console.log(`🔇 [AntiHallucination] Post-filter BLOCKED: High no_speech_prob (${avgNoSpeechProb.toFixed(3)} > 0.7)`);
        return {
          id: request.id,
          timestamp: Date.now(),
          success: true,
          payload: {
            text: transcribedText,
            language: detectedLanguage,
            duration: languageDetectionResult.duration,
            skipped: true,
            reason: `Post-filter: high no_speech_prob (${avgNoSpeechProb.toFixed(2)})`
          }
        };
      }

      // Reject very low confidence
      if (avgLogProb < -1.0 && avgLogProb !== 0) {
        console.log(`🔇 [AntiHallucination] Post-filter BLOCKED: Low confidence (avg_logprob ${avgLogProb.toFixed(3)} < -1.0)`);
        return {
          id: request.id,
          timestamp: Date.now(),
          success: true,
          payload: {
            text: transcribedText,
            language: detectedLanguage,
            duration: languageDetectionResult.duration,
            skipped: true,
            reason: `Post-filter: low confidence (logprob=${avgLogProb.toFixed(2)})`
          }
        };
      }

      // Reject high compression ratio (repetitive hallucination)
      if (avgCompressionRatio > 2.4 && avgCompressionRatio !== 0) {
        console.log(`🔇 [AntiHallucination] Post-filter BLOCKED: High compression ratio (${avgCompressionRatio.toFixed(2)} > 2.4)`);
        return {
          id: request.id,
          timestamp: Date.now(),
          success: true,
          payload: {
            text: transcribedText,
            language: detectedLanguage,
            duration: languageDetectionResult.duration,
            skipped: true,
            reason: `Post-filter: high compression ratio (${avgCompressionRatio.toFixed(2)})`
          }
        };
      }

      // Check for common hallucination patterns
      const hallucinationPatterns = [
        /^(\.+|,+|!+|\?+|\s+)$/,                    // Just punctuation
        /^(um+|uh+|ah+|oh+|hmm+)\.?$/i,             // Just filler words
        /^(music|♪|♫|🎵|🎶|\[.*\]|\(.*\))$/i,       // Music/sound indicators
        /^thanks for watching\.?$/i,                 // YouTube outro
        /^subscribe.*channel/i,                      // YouTube CTA
        /^please like and subscribe/i,               // YouTube CTA
        /(.)\1{4,}/,                                 // Repeated characters (aaaaa)
        /if there is silence.*output nothing/i,     // Prompt echo hallucination
        /transcribe only.*human speech/i,           // Prompt echo hallucination
        /do not guess words/i,                      // Prompt echo hallucination
        /background noise/i,                        // Prompt echo hallucination
      ];

      for (const pattern of hallucinationPatterns) {
        if (pattern.test(transcribedText)) {
          console.log(`🔇 [AntiHallucination] Post-filter BLOCKED: Hallucination pattern: "${transcribedText}"`);
          return {
            id: request.id,
            timestamp: Date.now(),
            success: true,
            payload: {
              text: transcribedText,
              language: detectedLanguage,
              duration: languageDetectionResult.duration,
              skipped: true,
              reason: `Post-filter: hallucination pattern detected`
            }
          };
        }
      }
    } catch (postFilterError) {
      console.warn('⚠️ [AntiHallucination] Post-filter error, continuing:', postFilterError);
    }
    // ============================================
    // END ANTI-HALLUCINATION POST-FILTER
    // ============================================

    console.log(`🌐 Detected language: ${detectedLanguage} | Text: "${transcribedText}"`);

    // CRITICAL: Skip English audio to prevent feedback loops
    // Check if we should skip English audio based on source/target language settings
    const finalTargetLanguage = targetLanguage || 'en';

		if (detectedLanguage === 'en' || detectedLanguage === 'english') {
			// If source language is set to English, ALLOW English processing (user wants to translate FROM English)
			if (sourceLanguageSetting === 'en' || sourceLanguageSetting === 'english') {
				console.log(`✅ English detected and source is English - will process: "${transcribedText}"`);
				// Continue processing - don't skip
			}
			// Skip English if target is English (no translation needed)
			else if (finalTargetLanguage === 'en') {
				console.log(`🚫 Ignoring English to English (no translation needed): "${transcribedText}"`);
				console.log(`💰 API Cost: Language detection only (~$${(audioBuffer?.byteLength ? (audioBuffer.byteLength * 0.0001).toFixed(4) : '0.0000')}) - Translation/TTS skipped`);

				return {
					id: request.id,
					timestamp: Date.now(),
					success: true,
					payload: {
						text: transcribedText,
						language: detectedLanguage,
						duration: languageDetectionResult.duration,
						skipped: true,
						reason: 'English to English - no translation needed'
					}
				};
			}
			// Skip English if source language is set to non-English (user expects different language)
			else if (sourceLanguageSetting !== 'auto' && sourceLanguageSetting !== 'en' && sourceLanguageSetting !== 'english') {
				console.log(`🚫 Ignoring English audio - expecting ${sourceLanguageSetting}: "${transcribedText}"`);
				console.log(`💰 API Cost: Language detection only (~${(audioBuffer?.byteLength ? (audioBuffer.byteLength * 0.0001).toFixed(4) : '0.0000')}) - Translation/TTS skipped`);

        return {
          id: request.id,
          timestamp: Date.now(),
          success: true,
          payload: {
            text: transcribedText,
            language: detectedLanguage,
            duration: languageDetectionResult.duration,
            skipped: true,
            reason: `English detected but expecting ${sourceLanguageSetting}`
          }
        };
      }
      // If we get here: English detected, target is not English, and source is auto/English
      // This means we should translate English to the target language - continue processing
      console.log(`✅ English detected, will translate to ${finalTargetLanguage}: "${transcribedText}"`);
    }

		// Check if source and target are the same language (for all languages, not just English)
		if (detectedLanguage === finalTargetLanguage ||
		    (sourceLanguageSetting !== 'auto' && sourceLanguageSetting === finalTargetLanguage)) {
			console.log(`🚫 Same language detected (${detectedLanguage}) - source and target are both ${finalTargetLanguage}, no translation needed: "${transcribedText}"`);
			return {
				id: request.id,
				timestamp: Date.now(),
				success: true,
				payload: {
					text: transcribedText,
					language: detectedLanguage,
					duration: languageDetectionResult.duration,
					skipped: true,
					reason: `Same language (${detectedLanguage}) - no translation needed`
				}
			};
		}

    // Additional non-speech filtering (sound effects / music)
    try {
      // Heuristic 1: Whisper no_speech probability across segments
      let avgNoSpeech = 0;
      let segCount = 0;
      if (Array.isArray(languageDetectionResult.segments) && languageDetectionResult.segments.length > 0) {
        for (const seg of languageDetectionResult.segments) {
          if (typeof seg.no_speech_prob === 'number') {
            avgNoSpeech += seg.no_speech_prob;
            segCount++;
          }
        }
      }
      avgNoSpeech = segCount > 0 ? avgNoSpeech / segCount : (typeof (languageDetectionResult as any).no_speech_prob === 'number' ? (languageDetectionResult as any).no_speech_prob : 0);

      // Heuristic 2: Text looks speech-like (letters/punctuation ratio)
      const letters = transcribedText.match(/[A-Za-z\u00C0-\u024F\u0400-\u04FF]+/g);
      const numLetters = letters ? letters.join('').length : 0;
      const nonWhitespaceLen = transcribedText.replace(/\s+/g, '').length;
      const letterRatio = nonWhitespaceLen > 0 ? numLetters / nonWhitespaceLen : 0;

      const MIN_CHARS = 4;

      if ((avgNoSpeech > 0.6) || (letterRatio < 0.3) || (numLetters < MIN_CHARS)) {
        console.log(`🛑 Non-speech filtered (avg_no_speech=${avgNoSpeech.toFixed(2)}, letter_ratio=${letterRatio.toFixed(2)}, letters=${numLetters}): "${transcribedText}"`);
        return {
          id: request.id,
          timestamp: Date.now(),
          success: true,
          payload: {
            text: transcribedText,
            language: detectedLanguage,
            duration: languageDetectionResult.duration,
            skipped: true,
            reason: 'Filtered probable non-speech (sound effect/music/noise)'
          }
        };
      }
    } catch (_) {
      // If heuristics fail, continue
    }

    // CRITICAL: Always translate non-English TO English (not to target language)
    // The target language setting is for the app's target, but we always want English output
    console.log(`✅ Non-English language (${detectedLanguage}) detected, proceeding with translation TO ENGLISH`);

    console.log(`✅ Transcription successful: "${transcriptionResult.text}"`);

	// Log API usage for cost tracking (VAD filtering reduces costs)
	if (audioBuffer && audioBuffer.byteLength > 44) {
		const view = new DataView(audioBuffer);
		const dataSize = view.getUint32(40, true);
		const durationSeconds = dataSize / (view.getUint32(24, true) * view.getUint16(22, true) * 2);
		const estimatedCost = durationSeconds * 0.006; // $0.006 per minute
		console.log(`💰 API Cost: ~$${estimatedCost.toFixed(4)} for ${durationSeconds.toFixed(2)}s utterance (VAD filtered)`);
	}

		// If we're in real-time translation mode, continue with the full pipeline
	// IMPORTANT: Do not call handleTestTranslation here to avoid recursion/looping
	// ALSO IMPORTANT: Only continue if the audio was not skipped due to language filtering
	if (processingOrchestrator && processingOrchestrator.isActive && transcriptionResult.text.trim().length > 0) {

		// Check if we should skip English audio
		const finalTargetLanguage = targetLanguage || 'en';
		const detectedLang = transcriptionResult.language;

		// Skip English if:
		// 1. English detected AND target is English (no translation needed), OR
		// 2. English detected BUT source language is set to non-English (user expects different language)
		if (detectedLang === 'en' || detectedLang === 'english') {
			// If source language is set to English, ALLOW English processing (user wants to translate FROM English)
			if (sourceLanguageSetting === 'en' || sourceLanguageSetting === 'english') {
				console.log(`✅ English detected and source is English - continuing with translation pipeline: "${transcriptionResult.text}"`);
				// Continue processing - don't skip
			}
			else if (finalTargetLanguage === 'en') {
				console.log('🚫 Skipping - English to English (no translation needed)');
				return {
					id: request.id,
					timestamp: Date.now(),
					success: true,
					payload: {
						text: transcriptionResult.text,
						language: transcriptionResult.language,
						duration: transcriptionResult.duration,
					}
				};
			} else if (sourceLanguageSetting !== 'auto' && sourceLanguageSetting !== 'en' && sourceLanguageSetting !== 'english') {
				console.log(`🚫 Skipping English audio - expecting ${sourceLanguageSetting} but got English`);
				return {
					id: request.id,
					timestamp: Date.now(),
					success: true,
					payload: {
						text: transcriptionResult.text,
						language: transcriptionResult.language,
						duration: transcriptionResult.duration,
						skipped: true,
						reason: 'English audio filtered to prevent feedback'
					}
				};
			}
		}

		// Allow same-language processing for audio generation
		// (Backend can now handle same-language requests for TTS generation)
		if (detectedLang === finalTargetLanguage ||
		    (sourceLanguageSetting !== 'auto' && sourceLanguageSetting === finalTargetLanguage)) {
			console.log(`✅ Same language in pipeline (${detectedLang}) - will process for audio generation: "${transcriptionResult.text}"`);
			// Continue processing - don't skip (useful for audio generation)
		}

      // Check if we're already processing a translation
      if (isProcessingTranslation) {
        console.log('🔒 Skipping processing - another translation is already in progress');
        return {
          id: request.id,
          timestamp: Date.now(),
          success: true,
          payload: {
            text: transcriptionResult.text,
            language: transcriptionResult.language,
            duration: transcriptionResult.duration
          }
        };
      }

      // Prevent feedback loops
      const currentTime = Date.now();
      const transcribedText = transcriptionResult.text.trim();

      // Skip very short utterances that are likely noise
      if (transcribedText.length < MIN_TEXT_LENGTH) {
        console.log(`🔇 Skipping short transcription (${transcribedText.length} chars): "${transcribedText}"`);
        return {
          id: request.id,
          timestamp: Date.now(),
          success: true,
          payload: {
            text: transcriptionResult.text,
            language: transcriptionResult.language,
            duration: transcriptionResult.duration
          }
        };
      }

      // Check if we're in cooldown period (more aggressive)
      const timeSinceLastTranslation = currentTime - lastTranslationTime;
      const timeSinceLastProcessing = currentTime - lastProcessingTime;

      if (lastTranslationTime > 0 && timeSinceLastTranslation < TRANSLATION_COOLDOWN) {
        console.log(`🔇 Skipping processing - translation cooldown active (${Math.round((TRANSLATION_COOLDOWN - timeSinceLastTranslation) / 1000)}s remaining)`);
        return {
          id: request.id,
          timestamp: Date.now(),
          success: true,
          payload: {
            text: transcriptionResult.text,
            language: transcriptionResult.language,
            duration: transcriptionResult.duration
          }
        };
      }

      // Also check for rapid processing attempts
      if (lastProcessingTime > 0 && timeSinceLastProcessing < 3000) {
        console.log(`🔇 Skipping processing - too soon since last processing (${Math.round((3000 - timeSinceLastProcessing) / 1000)}s remaining)`);
        return {
          id: request.id,
          timestamp: Date.now(),
          success: true,
          payload: {
            text: transcriptionResult.text,
            language: transcriptionResult.language,
            duration: transcriptionResult.duration
          }
        };
      }

      // Check if it's the same input text as last time
      if (lastInputText && transcribedText === lastInputText) {
        console.log('🔇 Skipping processing - same input text as last translation');
        return {
          id: request.id,
          timestamp: Date.now(),
          success: true,
          payload: {
            text: transcriptionResult.text,
            language: transcriptionResult.language,
            duration: transcriptionResult.duration
          }
        };
      }

      // Check if this text was recently processed (prevent loops)
      if (recentTranscriptions.includes(transcribedText)) {
        console.log('🔇 Skipping processing - text was recently processed');
        return {
          id: request.id,
          timestamp: Date.now(),
          success: true,
          payload: {
            text: transcriptionResult.text,
            language: transcriptionResult.language,
            duration: transcriptionResult.duration
          }
        };
      }

      // Check if this looks like our own translated output
      if (lastTranslatedText) {
        const cleanTranslated = lastTranslatedText.replace(/["""]/g, '').trim().toLowerCase();
        const cleanTranscribed = transcribedText.replace(/["""]/g, '').trim().toLowerCase();

        if (cleanTranscribed === cleanTranslated ||
            cleanTranscribed.includes(cleanTranslated) ||
            cleanTranslated.includes(cleanTranscribed)) {
          console.log('🔇 Skipping processing - likely feedback from our own output');
          return {
            id: request.id,
            timestamp: Date.now(),
            success: true,
            payload: {
              text: transcriptionResult.text,
              language: transcriptionResult.language,
              duration: transcriptionResult.duration
            }
          };
        }
      }

      		console.log(`🔄 Continuing with real-time translation pipeline for ${transcriptionResult.language} audio...`);
		console.log(`📝 Original (${transcriptionResult.language}): "${transcriptionResult.text}"`);
		console.log(`🎯 TARGET: Translate to ${targetLanguage || 'en'} (from bidirectional settings)`);

		// Set processing lock and update processing time
		isProcessingTranslation = true;
		lastProcessingTime = currentTime;

      try {
        // Process translation directly without calling test translation path
        console.log('🔄 Processing real-time translation directly (no test path)...');

        const { text, targetLanguage, voiceId } = {
          text: transcriptionResult.text,
          targetLanguage: processingOrchestrator.config.targetLanguage,
          voiceId: processingOrchestrator.config.voiceId
        };

        // Initialize services
        const configManager = ConfigurationManager.getInstance();
        const { TranslationServiceManager } = await import('../../services/TranslationServiceManager');
        const { TextToSpeechManager } = await import('../../services/TextToSpeechManager');
        const { StreamingTTSService } = await import('../../services/StreamingTTSService');

        const translationService = new TranslationServiceManager(configManager);
        const ttsService = new TextToSpeechManager(configManager);
        const streamingTTS = new StreamingTTSService(configManager);

        // Use the target language from bidirectional settings, fallback to English
        const finalTargetLanguage = targetLanguage || 'en';
        const sourceLang = normalizeLanguageCode(transcriptionResult.language) || 'auto';
        console.log(`🔄 Translating to ${finalTargetLanguage} | src=${sourceLang} | text="${text}"`);
        const translationResult = await translationService.translate(text, finalTargetLanguage, sourceLang);
        console.log(`✅ Translation result: "${translationResult.translatedText}"`);

        // Synthesize speech using the translated text (guard against empty text)
        const ttsInputRaw = translationResult.translatedText || '';
        const ttsInput = ttsInputRaw.trim();
        if (!ttsInput) {
          console.log('🛑 Empty translation result, skipping TTS');
          return {
            id: request.id,
            timestamp: Date.now(),
            success: true,
            payload: {
              text: translationResult.translatedText,
              language: finalTargetLanguage,
              duration: transcriptionResult.duration,
              skipped: true,
              reason: 'Empty translation; TTS skipped'
            }
          };
        }
        // Use streaming TTS for lower latency
        const streamingSupported = await streamingTTS.isStreamingSupported();
        let audioBuffer: ArrayBuffer;

        if (streamingSupported) {
          console.log(`🎵 Streaming TTS synthesis with voice: ${voiceId}`);
          const ttsStartTime = Date.now();
          let firstChunkTime: number | null = null;
          let audioChunks: ArrayBuffer[] = [];

          audioBuffer = await streamingTTS.synthesizeWithStreaming(
            ttsInput,
            voiceId,
            'eleven_v3', // Use latest model for best quality
            (chunk: ArrayBuffer, chunkIndex: number, isFinal: boolean) => {
              if (firstChunkTime === null) {
                firstChunkTime = Date.now() - ttsStartTime;
                console.log(`🚀 First TTS chunk received in ${firstChunkTime}ms (TTFB)`);
              }
              console.log(`📦 TTS chunk ${chunkIndex + 1}: ${chunk.byteLength} bytes${isFinal ? ' (FINAL)' : ''}`);
              audioChunks.push(chunk);

              // Send each chunk immediately to renderer for real-time playback
              try {
                const chunkArray = Array.from(new Uint8Array(chunk));

                if (chunkArray.length > 0) {
                  const { BrowserWindow } = require('electron');
                  const windows = BrowserWindow.getAllWindows();

                  for (const window of windows) {
                    if (!window.isDestroyed()) {
                      window.webContents.send('realtime-tts-chunk', {
                        audioData: chunkArray,
                        chunkIndex: chunkIndex,
                        isFirstChunk: chunkIndex === 0,
                        isFinal: isFinal,
                        bufferSize: chunk.byteLength,
                        originalText: text,
                        translatedText: translationResult.translatedText
                      });
                    }
                  }

                  console.log(`🔊 Sent ${chunk.byteLength} bytes for real-time playback (chunk ${chunkIndex + 1}${isFinal ? ', FINAL' : ''})`);
                }
              } catch (chunkError) {
                console.warn('Failed to send TTS chunk to renderer:', chunkError);
              }
            },
            (progress: { chunksReceived: number; totalBytes: number }) => {
              console.log(`📊 TTS streaming progress: ${progress.chunksReceived} chunks, ${progress.totalBytes} bytes`);
            },
            () => {
              // Streaming complete callback - send final signal to renderer
              console.log('✅ TTS streaming completed, sending final signal to renderer');
              try {
                const { BrowserWindow } = require('electron');
                const windows = BrowserWindow.getAllWindows();

                for (const window of windows) {
                  if (!window.isDestroyed()) {
                    window.webContents.send('realtime-tts-complete', {
                      originalText: text,
                      translatedText: translationResult.translatedText
                    });
                  }
                }
                console.log('🏁 Sent TTS completion signal to renderer');
              } catch (error) {
                console.warn('Failed to send TTS completion signal:', error);
              }
            }
          );

          const totalTime = Date.now() - ttsStartTime;
          console.log(`✅ Streaming TTS complete: ${totalTime}ms total, ${firstChunkTime}ms to first chunk, ${audioBuffer.byteLength} bytes`);
        } else {
          console.log(`🎤 Regular TTS synthesis with voice: ${voiceId} (streaming not supported)`);
          audioBuffer = await ttsService.synthesize(ttsInput, voiceId);
          console.log(`✅ TTS synthesis complete: ${audioBuffer.byteLength} bytes`);
        }

        // Send audio to renderer for playback - but mark it as real-time to prevent re-capture
        console.log(`🔊 Sending audio to renderer for playback (real-time mode)`);
        try {
          const audioArray = Array.from(new Uint8Array(audioBuffer));

          const { BrowserWindow } = await import('electron');
          const windows = BrowserWindow.getAllWindows();

          for (const window of windows) {
            if (!window.isDestroyed()) {
              // Use a different event name to distinguish from test playback
              window.webContents.send('realtime-translation-audio', {
                audioData: audioArray,
                originalText: text,
                translatedText: translationResult.translatedText,
                outputToVirtualMic: processingOrchestrator.config.outputToVirtualMic,
                isRealTime: true // Flag to prevent re-capture
              });
            }
          }

          console.log('✅ Audio sent to renderer for playback');
        } catch (audioError) {
          console.warn('⚠️ Audio sending failed:', audioError);
        }

        // Update feedback prevention tracking
        lastInputText = transcriptionResult.text.trim();
        lastTranslatedText = translationResult.translatedText.replace(/["""]/g, '').trim();
        lastTranslationTime = Date.now();

        // Add to recent transcriptions list (keep last 5)
        recentTranscriptions.push(lastInputText);
        if (recentTranscriptions.length > 5) {
          recentTranscriptions.shift();
        }

        console.log(`📝 Tracking - Input: "${lastInputText}" | Output: "${lastTranslatedText}"`);
        console.log('✅ Real-time translation completed successfully');

        // Add a longer pause before allowing new audio processing
        console.log('⏸️ Adding processing pause to prevent immediate re-processing');
        setTimeout(async () => {
          // Clear the audio capture to prevent re-processing
          console.log('🧹 Clearing audio capture to prevent re-processing');
          try {
            const { BrowserWindow } = await import('electron');
            const windows = BrowserWindow.getAllWindows();

            for (const window of windows) {
              if (!window.isDestroyed()) {
                // Tell renderer to clear its audio buffer and reset UI
                window.webContents.send('clear-audio-capture', {
                  reason: 'translation-completed'
                });
              }
            }
          } catch (clearError) {
            console.warn('⚠️ Failed to clear audio capture:', clearError);
          }
        }, 1000); // Wait 1 second before clearing to let audio finish playing

      } catch (translationError) {
        console.error('❌ Real-time translation error:', translationError);
      } finally {
        // Always clear the processing lock
        isProcessingTranslation = false;
      }
    }

    return {
      id: request.id,
      timestamp: Date.now(),
      success: true,
      payload: {
        text: transcriptionResult.text,
        language: transcriptionResult.language,
        duration: transcriptionResult.duration
      }
    };

  } catch (error) {
    console.error('❌ Speech transcription failed:', error);
    return {
      id: request.id,
      timestamp: Date.now(),
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

async function handlePushToTalkTranscription(
  event: IpcMainInvokeEvent,
  request: IPCRequest<{ audioData: number[]; language?: string }>
): Promise<IPCResponse<{ text: string; language?: string; duration?: number; skipped?: boolean; reason?: string }>> {
  console.log('🎤 Handling push-to-talk transcription request');

  try {
    const { audioData, language } = request.payload;
    const audioUint8Array = new Uint8Array(audioData);
    const nodeAudioBuffer = Buffer.from(audioUint8Array);

    // Initialize services
    console.log('📋 Preparing Whisper service for push-to-talk...');
    const configManager = ConfigurationManager.getInstance();
    const config = configManager.getConfig();
    const processingMode = getProcessingModeFromConfig(config);
    const modelConfig =
      getModelConfigFromConfig(config) ||
      (config as any).modelConfig ||
      (config as any).cloudModelConfig ||
      {};
    const whisperModel = modelConfig?.whisperModel || 'whisper-1';
    const preferLocalWhisper = processingMode === 'local' || LOCAL_WHISPER_MODELS.includes(whisperModel);

    let transcriptionResult: any = null;

    if (preferLocalWhisper) {
      try {
        const { LocalProcessingManager } = await import('../../services/LocalProcessingManager');
        const localManager = LocalProcessingManager.getInstance();
        await localManager.initialize();
        const availability = await localManager.isLocalProcessingAvailable();

        if (!availability.whisper) {
          throw new Error('Local Whisper service is not available');
        }

        console.log(`🎤 Using LOCAL Whisper (${whisperModel}) for push-to-talk transcription`);
        transcriptionResult = await localManager.transcribeAudio(nodeAudioBuffer, {
          language: language === 'auto' ? undefined : language,
          model: whisperModel
        });
      } catch (localError) {
        // Don't fallback to cloud providers when local model is selected
        console.error('❌ Local Whisper transcription failed:', localError);
        throw new Error(`Local Whisper transcription failed: ${localError instanceof Error ? localError.message : 'Unknown error'}`);
      }
    }

    // Only use cloud providers if a cloud model is explicitly selected (not a local fallback)
    if (!transcriptionResult && !preferLocalWhisper) {
      const { WhisperApiClient } = await import('../../services/WhisperApiClient');
      const { DeepInfraWhisperClient } = await import('../../services/DeepInfraWhisperClient');
      const { ApiKeyManager } = await import('../../services/ApiKeyManager');

      const apiKeyManager = ApiKeyManager.getInstance();

      // Only use OpenAI WhisperApiClient when whisper-1 (OpenAI Whisper) is selected
      // Local models should have been handled above, so this should only be for cloud models
      // Check if we should use managed API mode
    const { ManagedApiRouter } = await import('../../services/ManagedApiRouter');
    const managedApiRouter = ManagedApiRouter.getInstance();
    const currentMode = managedApiRouter.getMode();
    
    let sttProvider: string;
    let whisperClient: any;
    
    if (currentMode === 'managed') {
      // Use managed API via WhisperApiClient
      sttProvider = 'managed-openai';
      whisperClient = new WhisperApiClient(apiKeyManager);
      console.log(`🎤 Using MANAGED API (${whisperModel}) for push-to-talk transcription`);
    } else {
      // Use personal API based on model selection
      sttProvider = whisperModel === 'deepinfra' ? 'deepinfra' : 
                         whisperModel === 'whisper-1' ? 'openai' : 'deepinfra';
        whisperClient = sttProvider === 'deepinfra'
          ? new DeepInfraWhisperClient(apiKeyManager)
          : new WhisperApiClient(apiKeyManager);
        console.log(`🎤 Using ${sttProvider.toUpperCase()} (${whisperModel}) for push-to-talk transcription`);
    }

      // Convert audio data back to blob
      const audioBuffer = new Uint8Array(audioData).buffer;
      const audioBlob = new Blob([audioBuffer], { type: 'audio/webm' });

      console.log(`🎵 Transcribing push-to-talk audio: ${audioBlob.size} bytes`);

      // Use real Whisper API for transcription
      console.log('🔄 Sending audio to Whisper API...');
      transcriptionResult = await whisperClient.transcribe({
        audio: audioBlob,
        language: language === 'auto' ? undefined : language,
        response_format: 'verbose_json',
        temperature: 0
      });
    }

    // Handle empty transcription gracefully (silence or noise)
    if (!transcriptionResult.text || !transcriptionResult.text.trim()) {
      console.log('⚠️ Empty transcription result, returning empty text gracefully');
      return {
        id: request.id,
        timestamp: Date.now(),
        success: true,
        payload: {
          text: '',
          language: transcriptionResult.language,
          duration: transcriptionResult.duration || 0,
          skipped: true,
          reason: 'Empty transcription (likely silence or noise)'
        }
      };
    }

    console.log(`✅ Push-to-talk transcription successful: "${transcriptionResult.text}"`);

    // Return only the transcription - no real-time translation processing
    return {
      id: request.id,
      timestamp: Date.now(),
      success: true,
      payload: {
        text: transcriptionResult.text,
        language: transcriptionResult.language,
        duration: transcriptionResult.duration
      }
    };

  } catch (error) {
    console.error('❌ Push-to-talk transcription failed:', error);
    return {
      id: request.id,
      timestamp: Date.now(),
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Register all Translation Pipeline IPC handlers
 */
export function registerTranslationPipelineHandlers(): void {
  try {
    // Pipeline handlers
    try { ipcMain.removeHandler('pipeline:start'); } catch {}
    ipcMain.handle('pipeline:start', handleStartTranslation);

    try { ipcMain.removeHandler('pipeline:stop'); } catch {}
    ipcMain.handle('pipeline:stop', handleStopTranslation);

    try { ipcMain.removeHandler('pipeline:test'); } catch {}
    ipcMain.handle('pipeline:test', handleTestTranslation);

    try { ipcMain.removeHandler('pipeline:get-status'); } catch {}
    ipcMain.handle('pipeline:get-status', handleGetTranslationStatus);

    try { ipcMain.removeHandler(IPC_CHANNELS.GET_SERVICE_STATUS); } catch {}
    ipcMain.handle(IPC_CHANNELS.GET_SERVICE_STATUS, handleGetServiceStatus);

    try { ipcMain.removeHandler(IPC_CHANNELS.GET_LOGS); } catch {}
    ipcMain.handle(IPC_CHANNELS.GET_LOGS, handleGetLogs);

    try { ipcMain.removeHandler(IPC_CHANNELS.CLEAR_LOGS); } catch {}
    ipcMain.handle(IPC_CHANNELS.CLEAR_LOGS, handleClearLogs);

    try { ipcMain.removeHandler(IPC_CHANNELS.GET_METRICS); } catch {}
    ipcMain.handle(IPC_CHANNELS.GET_METRICS, handleGetMetrics);

    try { ipcMain.removeHandler(IPC_CHANNELS.GET_VOICES); } catch {}
    ipcMain.handle(IPC_CHANNELS.GET_VOICES, handleGetVoices);

    try { ipcMain.removeHandler(IPC_CHANNELS.START_VOICE_CLONING); } catch {}
    ipcMain.handle(IPC_CHANNELS.START_VOICE_CLONING, handleStartVoiceCloning);

    // Audio/Speech handlers
    try { ipcMain.removeHandler(IPC_CHANNELS.TRANSCRIBE); } catch {}
    ipcMain.handle(IPC_CHANNELS.TRANSCRIBE, handleSpeechTranscription);

    try { ipcMain.removeHandler(IPC_CHANNELS.TRANSCRIBE_PUSH_TO_TALK); } catch {}
    ipcMain.handle(IPC_CHANNELS.TRANSCRIBE_PUSH_TO_TALK, handlePushToTalkTranscription);

    try { ipcMain.removeHandler('audio:stream'); } catch {}
    ipcMain.handle('audio:stream', handleAudioStream);

    console.log('✅ Translation Pipeline IPC handlers registered');
  } catch (error) {
    console.error('❌ Failed to register Translation Pipeline IPC handlers:', error);
  }
}

/**
 * Export processing orchestrator state for external access
 */
export function getProcessingOrchestratorState() {
  return {
    isActive: processingOrchestrator ? processingOrchestrator.isActive : false,
    config: processingOrchestrator ? processingOrchestrator.config : null
  };
}
