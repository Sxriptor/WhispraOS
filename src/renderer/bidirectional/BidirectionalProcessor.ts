/**
 * Bidirectional Processor
 * Main transcription, translation, and TTS processing for bidirectional mode
 */

import {
    isBidirectionalActive,
    bidirectionalTTSProcessor,
    bidiLastAudioChunkTime,
    bidirectionalContextManager,
    CONTEXT_CLEAR_PAUSE_MS,
    bidiLastTranscription,
    incomingVoiceId,
    bidirectionalOutputDeviceId,
    captionsSettings,
    setBidiLastAudioChunkTime,
    setBidiLastTranscription,
    getNextChunkSeq,
    resetChunkSeq
} from './BidirectionalState.js';

import { removeDuplicateWords } from './BidirectionalAudioHelpers.js';
import { updateCaptions } from './BidirectionalCaptions.js';

// DOM element references (injected from UI module)
let bidirectionalStatusText: HTMLElement | null = null;
let bidirectionalDetectedText: HTMLElement | null = null;
let bidirectionalRespokenText: HTMLElement | null = null;

// Shared state references (will be injected)
let accentEnabled: boolean = false;
let selectedAccent: string = '';
let customAccentValue: string = '';

/**
 * Initialize processor module with DOM element references and shared state
 */
export function initializeProcessorModule(
    statusText: HTMLElement | null,
    detectedText: HTMLElement | null,
    respokenText: HTMLElement | null,
    accentState: { enabled: boolean; selected: string; customValue: string }
): void {
    bidirectionalStatusText = statusText;
    bidirectionalDetectedText = detectedText;
    bidirectionalRespokenText = respokenText;
    accentEnabled = accentState.enabled;
    selectedAccent = accentState.selected;
    customAccentValue = accentState.customValue;
}

/**
 * Update accent state (called when user changes settings)
 */
export function updateAccentState(enabled: boolean, selected: string, customValue: string): void {
    accentEnabled = enabled;
    selectedAccent = selected;
    customAccentValue = customValue;
}

/**
 * Apply accent tag to text for TTS
 */
function applyAccentTag(text: string): string {
    if (!accentEnabled || !text || text.trim() === '') {
        return text;
    }

    // Get the accent label
    let accentLabel = '';
    if (selectedAccent === 'custom') {
        // Sanitize custom accent to safe whitelist (letters, spaces, hyphens)
        const sanitized = customAccentValue.replace(/[^a-zA-Z\s-]/g, '').trim();
        if (sanitized) {
            accentLabel = sanitized.toLowerCase();
        }
    } else if (selectedAccent) {
        accentLabel = selectedAccent;
    }

    // If no valid accent, return text unchanged
    if (!accentLabel) {
        return text;
    }

    // Build the accent tag
    const accentTag = `[${accentLabel} accent] `;

    // If text already starts with a [...] bracketed tag, replace it
    const existingTagMatch = text.match(/^\[.*?\]\s*/);
    if (existingTagMatch) {
        return accentTag + text.substring(existingTagMatch[0].length);
    }

    // Otherwise prepend the accent tag
    return accentTag + text;
}

/**
 * Process bidirectional audio chunk:
 * 1. Transcribe audio to text
 * 2. Translate text to target language
 * 3. Queue TTS for playback
 */
export async function processBidirectionalAudioChunk(
    wavData: Buffer,
    getBidirectionalSourceLanguage: () => string,
    getBidirectionalTargetLanguage: () => string
): Promise<void> {
    // Process this chunk asynchronously (don't wait for previous chunks to finish TTS)
    // This allows transcription/translation to happen in background while TTS plays

    if (!isBidirectionalActive || !bidirectionalTTSProcessor) {
        console.warn('[Bidi] Skipping chunk - bidirectional not active or processor not initialized');
        return;
    }

    // Clear translation context AND deduplication state if there's been a long pause (>2 seconds)
    const now = Date.now();
    if (bidiLastAudioChunkTime > 0 && bidirectionalContextManager) {
        const pauseDuration = now - bidiLastAudioChunkTime;
        if (pauseDuration > CONTEXT_CLEAR_PAUSE_MS) {
            console.log(`[Bidi] 🧹 Clearing context AND deduplication after ${pauseDuration}ms pause`);
            bidirectionalContextManager.clearContext();
            setBidiLastTranscription(''); // Also clear deduplication to prevent false matches across pauses
            resetChunkSeq(); // Reset sequence numbers for fresh start
        }
    }
    setBidiLastAudioChunkTime(now);

    // Don't prevent concurrent - allow parallel processing of multiple chunks
    // isProcessingBidiChunk removed to enable true parallel processing
    
    // Get sequence number NOW (before any async calls) to preserve chunk order
    // This ensures deduplication works correctly even when chunks complete out of order
    const chunkSeq = getNextChunkSeq();

    try {
        const audioArray = Array.from(new Uint8Array(wavData as unknown as ArrayBuffer));
        const selectedLanguage = getBidirectionalSourceLanguage();
        const targetLanguage = getBidirectionalTargetLanguage();
        
        // Get whispra translate panel elements once for reuse
        const whispraRightTargetText = document.getElementById('whispra-right-target-text') as HTMLDivElement;
        const whispraRightSourceText = document.getElementById('whispra-right-source-text') as HTMLDivElement;

        // Update UI to show we're processing
        if (bidirectionalStatusText) {
            bidirectionalStatusText.textContent = 'Transcribing...';
        }
        if (bidirectionalDetectedText) {
            bidirectionalDetectedText.textContent = 'Converting speech to text...';
            bidirectionalDetectedText.classList.add('processing');
            bidirectionalDetectedText.classList.remove('empty');
        }
        // Also update whispra translate panel (right side - bidirectional)
        if (whispraRightSourceText) {
            whispraRightSourceText.textContent = 'Converting speech to text...';
            whispraRightSourceText.classList.add('processing');
            whispraRightSourceText.classList.remove('empty');
        }

        // Step 1: Transcribe audio chunk
        const transcriptionStartTime = Date.now();
        const response = await (window as any).electronAPI.invoke('speech:transcribe', {
            id: Date.now().toString(),
            timestamp: Date.now(),
            payload: { audioData: audioArray, language: selectedLanguage, targetLanguage: targetLanguage, contentType: 'audio/wav' }
        });

        if (!isBidirectionalActive) {
            console.log('[Bidi] Translation stopped during STT, aborting');
            return;
        }

        if (!response.success || !response.payload?.text) {
            console.log('[Bidi] No transcription result');
            return;
        }

        let transcription = String(response.payload.text || '').trim();
        const detectedLang = String(response.payload.language || '').toLowerCase();
        const transcriptionTime = Date.now() - transcriptionStartTime;

        if (!transcription || transcription.length === 0) {
            console.log('[Bidi] No speech detected in chunk');
            return;
        }

        // Store the ORIGINAL transcription for next chunk's deduplication BEFORE any modification
        // This is critical: the audio overlap contains the original words, not deduplicated ones
        const originalTranscription = transcription;

        // Remove duplicate words at chunk boundaries (from 200ms overlap)
        if (bidiLastTranscription) {
            const deduplicated = removeDuplicateWords(bidiLastTranscription, transcription);
            if (deduplicated !== transcription) {
                console.log(`[Bidi] Deduplication: "${transcription}" → "${deduplicated}"`);
                transcription = deduplicated;
            }
        }

        // Save the ORIGINAL transcription (before deduplication) for next chunk's comparison
        // This ensures we compare against what was actually in the audio overlap
        // Use sequence number to prevent out-of-order updates from corrupting state
        setBidiLastTranscription(originalTranscription, chunkSeq);

        if (!transcription || transcription.length === 0) {
            console.log('[Bidi] Empty transcription after deduplication');
            return;
        }

        // Update UI with transcription (no language indicator)
        if (bidirectionalDetectedText) {
            bidirectionalDetectedText.textContent = transcription;
            bidirectionalDetectedText.classList.remove('processing', 'empty');
        }
        // Also update whispra translate panel (right side - bidirectional)
        if (whispraRightSourceText) {
            whispraRightSourceText.textContent = transcription;
            whispraRightSourceText.classList.remove('processing', 'empty');
        }

        // Check if source and target languages are the same
        const normalizedDetectedLang = detectedLang.toLowerCase();
        const normalizedTargetLang = targetLanguage.toLowerCase();

        let translated: string;
        let translationTime: number;

        // Normalize language codes (en/english, es/spanish, etc.)
        const isSameLanguage =
            normalizedDetectedLang === normalizedTargetLang ||
            (normalizedDetectedLang === 'en' && normalizedTargetLang === 'english') ||
            (normalizedDetectedLang === 'english' && normalizedTargetLang === 'en');

        if (isSameLanguage) {
            // Same language - skip translation and use original transcription
            console.log(`[Bidi] 🚫 Same language detected (${detectedLang} = ${targetLanguage}), skipping translation`);
            translated = transcription;
            translationTime = 0;

            if (bidirectionalRespokenText) {
                bidirectionalRespokenText.textContent = transcription;
                bidirectionalRespokenText.classList.remove('processing', 'empty');
            }
            // Also update whispra translate panel (right side - bidirectional)
            if (whispraRightTargetText) {
                whispraRightTargetText.textContent = transcription;
                whispraRightTargetText.classList.remove('processing', 'empty');
            }

            // Show caption immediately (before TTS synthesis)
            if (transcription && transcription.length > 0) {
                console.log('🎬 Updating captions immediately (same language):', transcription);
                await updateCaptions(transcription);
            }
        } else {
            // Different language - translate
            // Step 2: Translate the transcribed text
            if (bidirectionalStatusText) {
                bidirectionalStatusText.textContent = 'Translating...';
            }
            if (bidirectionalRespokenText) {
                bidirectionalRespokenText.textContent = 'Translating...';
                bidirectionalRespokenText.classList.add('processing');
                bidirectionalRespokenText.classList.remove('empty');
            }
            // Also update whispra translate panel (right side - bidirectional)
            if (whispraRightTargetText) {
                whispraRightTargetText.textContent = 'Translating...';
                whispraRightTargetText.classList.add('processing');
                whispraRightTargetText.classList.remove('empty');
            }

            // Get context from context manager (if enabled)
            const context = bidirectionalContextManager?.isEnabled()
                ? bidirectionalContextManager.getContextString(true)
                : null;

            const translationStartTime = Date.now();
            const translationResponse = await (window as any).electronAPI.invoke('translation:translate', {
                id: Date.now().toString(),
                timestamp: Date.now(),
                payload: {
                    text: transcription,
                    targetLanguage: targetLanguage,
                    sourceLanguage: detectedLang === 'auto' ? 'auto' : detectedLang,
                    context: context ? { previousTranslation: context } : undefined
                }
            });

            if (!isBidirectionalActive) {
                console.log('[Bidi] Translation stopped during translation step, aborting');
                return;
            }

            if (!translationResponse.success || !translationResponse.payload?.translatedText) {
                console.log('[Bidi] Translation failed');
                if (bidirectionalRespokenText) {
                    bidirectionalRespokenText.textContent = 'Translation failed';
                    bidirectionalRespokenText.classList.remove('processing');
                }
                // Also update whispra translate panel (right side - bidirectional)
                if (whispraRightTargetText) {
                    whispraRightTargetText.textContent = 'Translation failed';
                    whispraRightTargetText.classList.remove('processing');
                }
                return;
            }

            translated = String(translationResponse.payload.translatedText || '').trim();
            translationTime = Date.now() - translationStartTime;

            // Add to context manager for future translations
            if (bidirectionalContextManager && translated && translated.length > 0) {
                bidirectionalContextManager.addChunk({
                    sourceText: transcription,
                    translatedText: translated,
                    timestamp: Date.now(),
                    sourceLanguage: detectedLang,
                    targetLanguage: targetLanguage
                });
            }

            // Update UI with translation
            if (bidirectionalRespokenText) {
                bidirectionalRespokenText.textContent = translated;
                bidirectionalRespokenText.classList.remove('processing', 'empty');
            }
            // Also update whispra translate panel (right side - bidirectional)
            if (whispraRightTargetText) {
                whispraRightTargetText.textContent = translated;
                whispraRightTargetText.classList.remove('processing', 'empty');
            }

            // Show caption immediately after translation (before TTS synthesis)
            if (translated && translated.length > 0) {
                console.log('🎬 Updating captions immediately after translation:', translated);
                await updateCaptions(translated);
            }
        }

        if (translated && translated.length > 0) {
            // Step 3: Add to TTS processor queue (skip if captions-only mode is enabled)
            if (captionsSettings.captionsOnly) {
                console.log(`[Bidi] 📝 Captions-only mode enabled - skipping TTS for: "${translated}"`);
                console.log(`[Bidi] ✅ Caption displayed (no TTS) - STT: ${transcriptionTime}ms, Trans: ${translationTime}ms`);
            } else {
                const voiceId = incomingVoiceId || 'pNInz6obpgDQGcFmaJgB';
                const processedText = applyAccentTag(translated);
                const modelId = accentEnabled ? 'eleven_v3' : undefined;

                // Add to parallel TTS processor queue (handles rate limiting internally)
                const chunkId = bidirectionalTTSProcessor.addChunk(
                    processedText,
                    voiceId,
                    modelId,
                    transcription,
                    detectedLang,
                    bidirectionalOutputDeviceId || undefined
                );

                console.log(`[Bidi] 🎯 Chunk ${chunkId} queued (max 3 concurrent TTS) - STT: ${transcriptionTime}ms, Trans: ${translationTime}ms`);
            }
        } else {
            console.log('[Bidi] Translation returned empty result');
            if (bidirectionalRespokenText) {
                bidirectionalRespokenText.textContent = 'Translation failed';
                bidirectionalRespokenText.classList.remove('processing');
            }
            // Also update whispra translate panel (right side - bidirectional)
            if (whispraRightTargetText) {
                whispraRightTargetText.textContent = 'Translation failed';
                whispraRightTargetText.classList.remove('processing');
            }
        }

    } catch (error) {
        if (isBidirectionalActive) {
            console.error('[Bidi] Chunk processing failed:', error);
            if (bidirectionalDetectedText) {
                bidirectionalDetectedText.textContent = `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
                bidirectionalDetectedText.classList.remove('processing');
            }
            // Also update whispra translate panel (right side - bidirectional)
            const whispraRightSourceText = document.getElementById('whispra-right-source-text') as HTMLDivElement;
            if (whispraRightSourceText) {
                whispraRightSourceText.textContent = `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
                whispraRightSourceText.classList.remove('processing');
            }
        }
    }
}

/**
 * Update bidirectional UI based on TTS processor status
 */
export function updateBidirectionalUI(): void {
    if (!bidirectionalStatusText || !bidirectionalTTSProcessor) return;

    const stats = bidirectionalTTSProcessor.getStats();
    const remaining = bidirectionalTTSProcessor.getRemainingCount();

    if (remaining > 0) {
        bidirectionalStatusText.textContent = `Processing... (${remaining} remaining)`;
    } else if (stats.playing > 0) {
        bidirectionalStatusText.textContent = 'Playing...';
    } else {
        bidirectionalStatusText.textContent = 'Listening...';
    }
}
