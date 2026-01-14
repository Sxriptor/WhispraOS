/**
 * Translation Context Manager
 * Manages a sliding window of translation context to improve coherence across chunks
 * Stores previous chunks (both source and translated text) to provide context for ongoing translations
 */

export interface ContextChunk {
    sourceText: string;
    translatedText: string;
    timestamp: number;
    sourceLanguage: string;
    targetLanguage: string;
}

export interface ContextConfig {
    enabled: boolean;              // Toggle context feature on/off
    maxChunks: number;             // Maximum number of chunks to keep (default: 3)
    maxTokens: number;             // Maximum tokens to include in context (default: 60)
    includeSource: boolean;        // Include source text in context (default: false, use translated only)
    resetOnLanguageChange: boolean; // Clear context when language changes (default: true)
}

export class TranslationContextManager {
    private contextWindow: ContextChunk[] = [];
    private config: ContextConfig;
    private lastLanguagePair: string = '';

    constructor(config?: Partial<ContextConfig>) {
        // Default configuration
        this.config = {
            enabled: true,
            maxChunks: 3,
            maxTokens: 60,
            includeSource: false,
            resetOnLanguageChange: true,
            ...config
        };

        console.log('[ContextManager] Initialized with config:', this.config);
    }

    /**
     * Add a new chunk to the context window
     */
    addChunk(chunk: ContextChunk): void {
        if (!this.config.enabled) {
            return;
        }

        // Check if language pair changed
        const currentLanguagePair = `${chunk.sourceLanguage}-${chunk.targetLanguage}`;
        if (this.config.resetOnLanguageChange &&
            this.lastLanguagePair &&
            this.lastLanguagePair !== currentLanguagePair) {
            console.log(`[ContextManager] Language pair changed (${this.lastLanguagePair} → ${currentLanguagePair}), clearing context`);
            this.clearContext();
        }
        this.lastLanguagePair = currentLanguagePair;

        // Add chunk to window
        this.contextWindow.push(chunk);

        // Trim window to max chunks
        if (this.contextWindow.length > this.config.maxChunks) {
            const removed = this.contextWindow.shift();
            console.log(`[ContextManager] Window full, removed oldest chunk: "${removed?.translatedText.substring(0, 30)}..."`);
        }

        console.log(`[ContextManager] Added chunk (${this.contextWindow.length}/${this.config.maxChunks}): "${chunk.translatedText.substring(0, 50)}..."`);
    }

    /**
     * Get context string for the next translation
     * Returns a formatted string with previous translations
     */
    getContextString(useTranslated: boolean = true): string | null {
        if (!this.config.enabled || this.contextWindow.length === 0) {
            return null;
        }

        // Build context from window
        const contextParts: string[] = [];
        let totalTokens = 0;

        // Iterate through chunks (newest to oldest to respect token limit)
        for (let i = this.contextWindow.length - 1; i >= 0; i--) {
            const chunk = this.contextWindow[i];
            const text = useTranslated ? chunk.translatedText : chunk.sourceText;

            // Rough token estimation (1 token ≈ 4 characters)
            const estimatedTokens = Math.ceil(text.length / 4);

            if (totalTokens + estimatedTokens > this.config.maxTokens) {
                console.log(`[ContextManager] Token limit reached (${totalTokens}/${this.config.maxTokens}), stopping context build`);
                break;
            }

            contextParts.unshift(text); // Add to beginning to maintain order
            totalTokens += estimatedTokens;
        }

        const contextString = contextParts.join(' ');
        console.log(`[ContextManager] Generated context (${totalTokens} tokens, ${contextParts.length} chunks): "${contextString.substring(0, 80)}..."`);

        return contextString;
    }

    /**
     * Get structured context for advanced use cases
     */
    getStructuredContext(): ContextChunk[] {
        if (!this.config.enabled) {
            return [];
        }
        return [...this.contextWindow]; // Return copy to prevent mutation
    }

    /**
     * Clear all context
     */
    clearContext(): void {
        const previousCount = this.contextWindow.length;
        this.contextWindow = [];
        this.lastLanguagePair = '';
        console.log(`[ContextManager] Context cleared (removed ${previousCount} chunks)`);
    }

    /**
     * Update configuration
     */
    updateConfig(newConfig: Partial<ContextConfig>): void {
        const oldConfig = { ...this.config };
        this.config = { ...this.config, ...newConfig };

        console.log('[ContextManager] Configuration updated:', {
            old: oldConfig,
            new: this.config
        });

        // If disabled, clear context
        if (!this.config.enabled) {
            this.clearContext();
        }

        // If max chunks reduced, trim window
        if (this.config.maxChunks < this.contextWindow.length) {
            const toRemove = this.contextWindow.length - this.config.maxChunks;
            this.contextWindow.splice(0, toRemove);
            console.log(`[ContextManager] Trimmed ${toRemove} chunks to fit new maxChunks limit`);
        }
    }

    /**
     * Get current configuration
     */
    getConfig(): ContextConfig {
        return { ...this.config };
    }

    /**
     * Get context window size
     */
    getWindowSize(): number {
        return this.contextWindow.length;
    }

    /**
     * Check if context is enabled
     */
    isEnabled(): boolean {
        return this.config.enabled;
    }

    /**
     * Get statistics about current context
     */
    getStats(): {
        enabled: boolean;
        windowSize: number;
        maxChunks: number;
        totalCharacters: number;
        estimatedTokens: number;
        languagePair: string;
    } {
        const totalChars = this.contextWindow.reduce((sum, chunk) => sum + chunk.translatedText.length, 0);
        const estimatedTokens = Math.ceil(totalChars / 4);

        return {
            enabled: this.config.enabled,
            windowSize: this.contextWindow.length,
            maxChunks: this.config.maxChunks,
            totalCharacters: totalChars,
            estimatedTokens,
            languagePair: this.lastLanguagePair
        };
    }
}
