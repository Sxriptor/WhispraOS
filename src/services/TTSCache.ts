/**
 * TTS Cache with Background Processing
 * Caches TTS results and processes them in the background
 * Enhanced with translation caching and fuzzy matching
 */

import { TextToSpeechManager } from './TextToSpeechManager';
import { TranslationResult } from '../interfaces/TranslationService';
import { FuzzyMatcher } from '../utils/FuzzyMatcher';

interface CacheEntry {
    text: string;
    voiceId: string;
    modelId?: string;
    audioData?: ArrayBuffer;
    status: 'pending' | 'processing' | 'ready' | 'error';
    error?: string;
    timestamp: number;
}

interface TranslationCacheEntry {
    sourceText: string;
    targetLanguage: string;
    sourceLanguage?: string;
    provider: string;
    result: TranslationResult;
    timestamp: number;
    accessCount: number;
}

export class TTSCache {
    private cache: Map<string, CacheEntry> = new Map();
    private translationCache: Map<string, TranslationCacheEntry> = new Map();
    private ttsManager: TextToSpeechManager;
    private processingQueue: string[] = [];
    private isProcessing: boolean = false;
    private maxConcurrent: number = 3;
    private currentlyProcessing: number = 0;
    private maxCacheSize: number = 500;
    private maxTranslationCacheSize: number = 1000;
    private fuzzyMatchThreshold: number = 0.8;

    constructor(ttsManager: TextToSpeechManager) {
        this.ttsManager = ttsManager;
    }

    /**
     * Generate cache key from text and voice
     */
    private getCacheKey(text: string, voiceId: string, modelId?: string): string {
        return `${text}|${voiceId}|${modelId || 'default'}`;
    }

    /**
     * Prefetch TTS in background (non-blocking)
     * Returns immediately, TTS happens in background
     */
    prefetch(text: string, voiceId: string, modelId?: string): void {
        const key = this.getCacheKey(text, voiceId, modelId);

        // Skip if already cached or processing
        if (this.cache.has(key)) {
            return;
        }

        // Add to cache as pending
        const entry: CacheEntry = {
            text,
            voiceId,
            modelId,
            status: 'pending',
            timestamp: Date.now()
        };

        this.cache.set(key, entry);
        this.processingQueue.push(key);

        console.log(`📝 Prefetching TTS for: "${text.substring(0, 50)}..."`);

        // Start background processing if not already running
        if (!this.isProcessing) {
            // Don't await - let it run in background!
            this.startBackgroundProcessing().catch(err => {
                console.error('Background TTS processing error:', err);
            });
        } else {
            // Already processing, but trigger processing of new items
            this.processNextItems();
        }
    }

    /**
     * Get TTS audio (waits if still processing)
     */
    async get(text: string, voiceId: string, modelId?: string): Promise<ArrayBuffer> {
        const key = this.getCacheKey(text, voiceId, modelId);
        const entry = this.cache.get(key);

        if (!entry) {
            // Not in cache, synthesize immediately
            console.log(`⚡ Cache miss, synthesizing immediately: "${text.substring(0, 50)}..."`);
            return await this.ttsManager.synthesize(text, voiceId, modelId);
        }

        // Wait for processing to complete
        while (entry.status === 'pending' || entry.status === 'processing') {
            await new Promise(resolve => setTimeout(resolve, 50));
        }

        if (entry.status === 'error') {
            console.warn(`❌ Cached TTS failed, retrying: ${entry.error}`);
            return await this.ttsManager.synthesize(text, voiceId, modelId);
        }

        if (entry.audioData) {
            console.log(`✅ Cache hit: "${text.substring(0, 50)}..."`);
            return entry.audioData;
        }

        // Fallback
        return await this.ttsManager.synthesize(text, voiceId, modelId);
    }

    /**
     * Check if TTS is ready in cache
     */
    isReady(text: string, voiceId: string, modelId?: string): boolean {
        const key = this.getCacheKey(text, voiceId, modelId);
        const entry = this.cache.get(key);
        return entry?.status === 'ready' && !!entry.audioData;
    }

    /**
     * Get cache status
     */
    getStatus(text: string, voiceId: string, modelId?: string): 'pending' | 'processing' | 'ready' | 'error' | 'not-cached' {
        const key = this.getCacheKey(text, voiceId, modelId);
        const entry = this.cache.get(key);
        return entry?.status || 'not-cached';
    }

    /**
     * Process next items in queue (called when new items added)
     */
    private processNextItems(): void {
        // Process up to maxConcurrent items
        while (this.currentlyProcessing < this.maxConcurrent && this.processingQueue.length > 0) {
            const key = this.processingQueue.shift();
            if (!key) break;

            const entry = this.cache.get(key);
            if (!entry || entry.status !== 'pending') continue;

            this.currentlyProcessing++;
            this.processEntry(key, entry).finally(() => {
                this.currentlyProcessing--;
            });
        }
    }

    /**
     * Start background processing
     */
    private async startBackgroundProcessing(): Promise<void> {
        if (this.isProcessing) return;

        this.isProcessing = true;
        console.log('🚀 Starting background TTS processing');

        while (this.processingQueue.length > 0 || this.currentlyProcessing > 0) {
            this.processNextItems();
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        this.isProcessing = false;
        console.log('✅ Background TTS processing complete');
    }

    /**
     * Process a single cache entry
     */
    private async processEntry(key: string, entry: CacheEntry): Promise<void> {
        try {
            entry.status = 'processing';
            console.log(`🔄 Processing TTS in background: "${entry.text.substring(0, 50)}..."`);

            const startTime = Date.now();
            const audioData = await this.ttsManager.synthesize(
                entry.text,
                entry.voiceId,
                entry.modelId
            );

            entry.audioData = audioData;
            entry.status = 'ready';

            const duration = Date.now() - startTime;
            console.log(`✅ TTS ready (${duration}ms): "${entry.text.substring(0, 50)}..."`);

        } catch (error) {
            entry.status = 'error';
            entry.error = error instanceof Error ? error.message : 'Unknown error';
            console.error(`❌ TTS failed: "${entry.text.substring(0, 50)}..."`, error);
        }
    }

    /**
     * Clear old cache entries
     */
    clearOld(maxAge: number = 300000): void {
        const now = Date.now();
        const keysToDelete: string[] = [];

        this.cache.forEach((entry, key) => {
            if (now - entry.timestamp > maxAge) {
                keysToDelete.push(key);
            }
        });

        keysToDelete.forEach(key => this.cache.delete(key));

        if (keysToDelete.length > 0) {
            console.log(`🧹 Cleared ${keysToDelete.length} old TTS cache entries`);
        }
    }

    /**
     * Clear all cache
     */
    clear(): void {
        this.cache.clear();
        this.processingQueue = [];
        console.log('🧹 TTS cache cleared');
    }

    /**
     * Get cache statistics
     */
    getStats(): {
        total: number;
        pending: number;
        processing: number;
        ready: number;
        errors: number;
        translationCacheSize: number;
        translationCacheHits: number;
    } {
        const stats = {
            total: this.cache.size,
            pending: 0,
            processing: 0,
            ready: 0,
            errors: 0,
            translationCacheSize: this.translationCache.size,
            translationCacheHits: 0
        };

        this.cache.forEach(entry => {
            switch (entry.status) {
                case 'pending': stats.pending++; break;
                case 'processing': stats.processing++; break;
                case 'ready': stats.ready++; break;
                case 'error': stats.errors++; break;
            }
        });

        // Count translation cache hits (entries with accessCount > 1)
        this.translationCache.forEach(entry => {
            if (entry.accessCount > 1) {
                stats.translationCacheHits++;
            }
        });

        return stats;
    }

    /**
     * Cache translation result
     */
    cacheTranslation(
        sourceText: string,
        targetLanguage: string,
        sourceLanguage: string | undefined,
        provider: string,
        result: TranslationResult
    ): void {
        const key = this.getTranslationCacheKey(sourceText, targetLanguage, sourceLanguage, provider);
        
        // Manage cache size
        if (this.translationCache.size >= this.maxTranslationCacheSize) {
            this.evictOldestTranslation();
        }

        const entry: TranslationCacheEntry = {
            sourceText,
            targetLanguage,
            sourceLanguage,
            provider,
            result,
            timestamp: Date.now(),
            accessCount: 1
        };

        this.translationCache.set(key, entry);
    }

    /**
     * Get cached translation with fuzzy matching
     */
    getCachedTranslation(
        sourceText: string,
        targetLanguage: string,
        sourceLanguage?: string,
        provider?: string
    ): TranslationResult | null {
        // First try exact match
        const exactKey = this.getTranslationCacheKey(sourceText, targetLanguage, sourceLanguage, provider);
        const exactMatch = this.translationCache.get(exactKey);
        if (exactMatch) {
            exactMatch.accessCount++;
            exactMatch.timestamp = Date.now();
            return exactMatch.result;
        }

        // Try fuzzy matching if no exact match
        const candidates: Array<{ key: string; entry: TranslationCacheEntry; similarity: number }> = [];
        
        this.translationCache.forEach((entry, key) => {
            // Match target language and provider
            if (entry.targetLanguage === targetLanguage &&
                (!provider || entry.provider === provider)) {
                const similarity = FuzzyMatcher.normalizedSimilarity(sourceText, entry.sourceText);
                if (similarity >= this.fuzzyMatchThreshold) {
                    candidates.push({ key, entry, similarity });
                }
            }
        });

        if (candidates.length > 0) {
            // Sort by similarity and access count
            candidates.sort((a, b) => {
                const scoreA = a.similarity * 0.7 + (a.entry.accessCount / 100) * 0.3;
                const scoreB = b.similarity * 0.7 + (b.entry.accessCount / 100) * 0.3;
                return scoreB - scoreA;
            });

            const bestMatch = candidates[0];
            bestMatch.entry.accessCount++;
            bestMatch.entry.timestamp = Date.now();
            return bestMatch.entry.result;
        }

        return null;
    }

    /**
     * Generate translation cache key
     */
    private getTranslationCacheKey(
        sourceText: string,
        targetLanguage: string,
        sourceLanguage?: string,
        provider?: string
    ): string {
        const normalizedText = FuzzyMatcher.normalize(sourceText);
        return `${sourceLanguage || 'auto'}-${targetLanguage}-${provider || 'default'}-${normalizedText}`;
    }

    /**
     * Evict oldest translation cache entry
     */
    private evictOldestTranslation(): void {
        let oldestKey: string | null = null;
        let oldestTime = Date.now();

        this.translationCache.forEach((entry, key) => {
            if (entry.timestamp < oldestTime) {
                oldestTime = entry.timestamp;
                oldestKey = key;
            }
        });

        if (oldestKey) {
            this.translationCache.delete(oldestKey);
        }
    }

    /**
     * Clear translation cache
     */
    clearTranslationCache(): void {
        this.translationCache.clear();
    }

    /**
     * Preload translations for common phrases
     */
    async preloadTranslations(
        phrases: string[],
        targetLanguage: string,
        sourceLanguage: string,
        provider: string,
        translationService: any
    ): Promise<void> {
        for (const phrase of phrases) {
            // Check if already cached
            if (!this.getCachedTranslation(phrase, targetLanguage, sourceLanguage, provider)) {
                try {
                    const result = await translationService.translate(
                        phrase,
                        targetLanguage,
                        sourceLanguage
                    );
                    this.cacheTranslation(phrase, targetLanguage, sourceLanguage, provider, result);
                } catch (error) {
                    console.warn(`Failed to preload translation for: "${phrase}"`, error);
                }
            }
        }
    }
}
