import { TranslationService, TranslationResult, TranslationProvider, TranslationContext } from '../interfaces/TranslationService';
import { OpenAITranslationClient } from './OpenAITranslationClient';
import { DeepInfraTranslationClient } from './DeepInfraTranslationClient';
import { ArgosTranslationService } from './ArgosTranslationService';
import { LocalProcessingManager } from './LocalProcessingManager';
import { ConfigurationManager } from './ConfigurationManager';
import { ApiKeyManager } from './ApiKeyManager';
import { getProcessingModeFromConfig, getModelConfigFromConfig } from '../types/ConfigurationTypes';
import { ErrorReportingService } from './ErrorReportingService';
import { ErrorCategory, ErrorSeverity } from '../types/ErrorTypes';

/**
 * Manages translation services with provider selection and failover
 */
export interface TranslationPerformanceMetrics {
    provider: TranslationProvider;
    averageLatency: number;
    successRate: number;
    totalRequests: number;
    totalFailures: number;
    lastUsed: number;
}

export interface BatchTranslationRequest {
    text: string;
    targetLanguage: string;
    sourceLanguage?: string;
    context?: TranslationContext;
}

export class TranslationServiceManager implements TranslationService {
    private configManager: ConfigurationManager;
    private primaryProvider: TranslationService | null = null;
    private fallbackProviders: TranslationService[] = [];
    private translationCache: Map<string, TranslationResult> = new Map();
    private currentProvider: TranslationProvider = 'openai';
    private initialized: boolean = false;
    private performanceMetrics: Map<TranslationProvider, TranslationPerformanceMetrics> = new Map();
    private batchQueue: BatchTranslationRequest[] = [];
    private batchProcessingInterval: number = 100; // ms
    private batchSize: number = 5;
    private isBatchProcessing: boolean = false;
    private conversationHistory: Array<{ source: string; target: string; timestamp: number }> = [];
    private maxHistorySize: number = 10;
    private circuitBreakers: Map<TranslationProvider, { failures: number; lastFailure: number; isOpen: boolean }> = new Map();

    constructor(configManager: ConfigurationManager) {
        this.configManager = configManager;
        // Don't call async method in constructor
    }

    private async ensureInitialized(): Promise<void> {
        if (!this.initialized) {
            await this.initializeProviders();
            this.initialized = true;
        }
    }

    private async initializeProviders(): Promise<void> {
        // Check config for processing mode and translation provider selection
        const config = this.configManager.getConfig();
        
        // Use helper function to determine processing mode from modelConfig
        const processingMode = getProcessingModeFromConfig(config);
        const modelConfig = getModelConfigFromConfig(config);
        // gptModel is used for translation provider in the UI
        const translationProvider = modelConfig?.gptModel || (processingMode === 'local' ? 'argos' : 'openai');

        console.log(`[TranslationServiceManager] Initializing translation provider: ${translationProvider} (${processingMode} mode)`);
        console.log(`[TranslationServiceManager] Config source: modelConfig = ${modelConfig ? 'present' : 'missing'}, processingMode = ${processingMode}`);
        console.log(`[TranslationServiceManager] modelConfig.gptModel = ${modelConfig?.gptModel}`);

        // Initialize local processing if selected
        if (processingMode === 'local' && translationProvider === 'argos') {
            console.log(`[TranslationServiceManager] Attempting to initialize Argos translation provider...`);
            try {
                const localManager = LocalProcessingManager.getInstance();
                await localManager.initialize();
                
                // Verify Argos is actually available before using it
                const argosAvailable = localManager.getLocalModelStatus().argosAvailable;
                console.log(`[TranslationServiceManager] Argos availability check: ${argosAvailable}`);
                if (!argosAvailable) {
                    console.error('[TranslationServiceManager] ❌ Argos is configured but not available. Check if models are installed.');
                    throw new Error('Argos Translate is not installed. Please install it through Local Models Setup.');
                }
                
                // Create a wrapper that uses the local processing manager
                this.primaryProvider = {
                    translate: async (text: string, targetLanguage: string, sourceLanguage?: string, context?: TranslationContext) => {
                        // Note: Argos doesn't support context, so we ignore it
                        console.log(`[TranslationServiceManager] Calling Argos translation via LocalProcessingManager`);
                        return await localManager.translateText(text, targetLanguage, sourceLanguage);
                    },
                    getSupportedLanguages: () => {
                        const languages = localManager.getSupportedLanguages();
                        return languages.argos;
                    },
                    isLanguagePairSupported: (sourceLanguage: string, targetLanguage: string) => {
                        const languages = localManager.getSupportedLanguages();
                        return languages.argos.includes(sourceLanguage) && languages.argos.includes(targetLanguage);
                    },
                    isAvailable: () => {
                        return localManager.getLocalModelStatus().argosAvailable;
                    },
                    setProvider: (provider: TranslationProvider) => {
                        // Not applicable for local processing
                    },
                    getCurrentProvider: () => {
                        return 'argos' as TranslationProvider;
                    }
                };
                this.currentProvider = 'argos' as TranslationProvider;
                console.log('[TranslationServiceManager] ✅ Local Argos translation provider initialized successfully');
                return;
            } catch (error) {
                console.error('[TranslationServiceManager] ❌ Failed to initialize local translation provider:', error);
                console.error('[TranslationServiceManager] Error details:', error instanceof Error ? error.message : String(error));
                // If Argos initialization fails, we'll fall back to cloud providers below
                // But log a clear warning that Argos was selected but failed
                console.warn('[TranslationServiceManager] ⚠️ Argos was selected but initialization failed. Will attempt cloud fallback.');
            }
        }

        // Initialize cloud providers
        // If Argos was selected and successfully initialized, we already returned above
        // If Argos was selected but failed, we'll initialize cloud providers as fallback
        if (translationProvider !== 'argos' || this.primaryProvider === null) {
            if (translationProvider === 'argos' && this.primaryProvider === null) {
                console.warn('[TranslationServiceManager] ⚠️ Argos was selected but initialization failed. User explicitly selected Argos, so not using cloud fallback.');
                // If user explicitly selected Argos and it failed, don't fallback to cloud providers
                // This respects the user's choice to use local processing only
                return;
            }

            // Check if we should use managed API mode (only for cloud providers)
            const { ManagedApiRouter } = await import('./ManagedApiRouter');
            const managedApiRouter = ManagedApiRouter.getInstance();
            const currentMode = managedApiRouter.getMode();
            
            if (currentMode === 'managed') {
                // Use managed API - initialize OpenAI client without requiring personal API key
                console.log('[TranslationServiceManager] Using managed API mode for translation');
                this.primaryProvider = new OpenAITranslationClient(''); // Empty key for managed mode
                this.currentProvider = 'openai';
                console.log('[TranslationServiceManager] ✅ Managed API translation provider initialized');
                return;
            }

            // Personal mode - check for API keys
            const apiKeyManager = ApiKeyManager.getInstance();
            const openaiKey = await apiKeyManager.getApiKey('openai');
            const deepinfraKey = await apiKeyManager.getApiKey('deepinfra');

            // Initialize the selected cloud provider based on user preference
            if (translationProvider === 'deepinfra') {
                if (deepinfraKey && deepinfraKey.trim().length > 0) {
                    this.primaryProvider = new DeepInfraTranslationClient(apiKeyManager);
                    this.currentProvider = 'deepinfra';
                    console.log('[TranslationServiceManager] DeepInfra translation provider initialized (selected in settings)');
                } else {
                    console.warn('[TranslationServiceManager] DeepInfra selected but no API key found, falling back to OpenAI');
                    if (openaiKey && openaiKey.trim().length > 0) {
                        this.primaryProvider = new OpenAITranslationClient(openaiKey);
                        this.currentProvider = 'openai';
                        console.log('[TranslationServiceManager] OpenAI translation provider initialized (fallback from DeepInfra)');
                    } else {
                        console.warn('[TranslationServiceManager] No translation API key found (OpenAI or DeepInfra)');
                    }
                }
            } else if (translationProvider === 'openai') {
                if (openaiKey && openaiKey.trim().length > 0) {
                    this.primaryProvider = new OpenAITranslationClient(openaiKey);
                    this.currentProvider = 'openai';
                    console.log('[TranslationServiceManager] OpenAI translation provider initialized (selected in settings)');
                } else {
                    console.warn('[TranslationServiceManager] OpenAI selected but no API key found, falling back to DeepInfra');
                    if (deepinfraKey && deepinfraKey.trim().length > 0) {
                        this.primaryProvider = new DeepInfraTranslationClient(apiKeyManager);
                        this.currentProvider = 'deepinfra';
                        console.log('[TranslationServiceManager] DeepInfra translation provider initialized (fallback from OpenAI)');
                    } else {
                        console.warn('[TranslationServiceManager] No translation API key found (OpenAI or DeepInfra)');
                    }
                }
            } else {
                // Default behavior - prefer OpenAI, then DeepInfra
                if (openaiKey && openaiKey.trim().length > 0) {
                    this.primaryProvider = new OpenAITranslationClient(openaiKey);
                    this.currentProvider = 'openai';
                    console.log('[TranslationServiceManager] OpenAI translation provider initialized (default)');
                } else if (deepinfraKey && deepinfraKey.trim().length > 0) {
                    this.primaryProvider = new DeepInfraTranslationClient(apiKeyManager);
                    this.currentProvider = 'deepinfra';
                    console.log('[TranslationServiceManager] DeepInfra translation provider initialized (default fallback)');
                } else {
                    console.warn('[TranslationServiceManager] No translation API key found (OpenAI or DeepInfra)');
                }
            }
        }
    }

    async translate(text: string, targetLanguage: string, sourceLanguage?: string, context?: TranslationContext): Promise<TranslationResult> {
        const startTime = Date.now();
        
        await this.ensureInitialized();

        // Log current provider state
        console.log(`[TranslationServiceManager] translate() called - currentProvider=${this.currentProvider}, primaryProvider=${this.primaryProvider ? 'set' : 'null'}`);

        // Check cache first (skip cache if context is provided to ensure fresh contextual translation)
        const cacheKey = this.getCacheKey(text, targetLanguage, sourceLanguage);
        if (!context) {
            const cachedResult = this.translationCache.get(cacheKey);
            if (cachedResult) {
                console.log(`✅ Using cached translation for "${text.substring(0, 50)}..."`);
                this.recordMetrics(this.currentProvider, Date.now() - startTime, true);
                return cachedResult;
            }
        }

        // Enhance context with conversation history
        const enhancedContext = this.enhanceContext(context);

        // Select best provider based on performance
        const selectedProvider = this.selectBestProvider();

        // Try selected provider first
        if (this.primaryProvider && selectedProvider === this.currentProvider) {
            try {
                // Check circuit breaker
                if (this.isCircuitBreakerOpen(this.currentProvider)) {
                    throw new Error(`Circuit breaker open for ${this.currentProvider}`);
                }

                console.log(`[TranslationServiceManager] Using primary provider (${this.currentProvider}) to translate "${text.substring(0, 50)}..." from ${sourceLanguage || 'auto'} to ${targetLanguage}`, {
                    hasContext: !!enhancedContext,
                    contextPreview: enhancedContext?.previousTranslation?.substring(0, 50)
                });
                
                const result = await this.primaryProvider.translate(text, targetLanguage, sourceLanguage, enhancedContext);
                const processingTime = Date.now() - startTime;

                // Record success metrics
                this.recordMetrics(this.currentProvider, processingTime, true);
                this.resetCircuitBreaker(this.currentProvider);

                // Update conversation history
                this.addToHistory(text, result.translatedText);

                // Only cache non-contextual translations
                if (!context) {
                    this.translationCache.set(cacheKey, result);
                }

                console.log(`[TranslationServiceManager] Translation successful (${processingTime}ms): "${result.translatedText.substring(0, 50)}..."`);
                return { ...result, processingTime };
            } catch (error) {
                console.error(`[TranslationServiceManager] Primary translation provider (${this.currentProvider}) failed:`, error);
                
                // Record failure metrics
                this.recordMetrics(this.currentProvider, Date.now() - startTime, false);
                this.recordCircuitBreakerFailure(this.currentProvider);

                // If primary provider is local (Argos) and fails, check if user wants cloud fallback
                // Only initialize cloud fallback if the selected provider is NOT Argos (i.e., Argos was used as a default)
                // If user explicitly selected Argos, don't fallback to cloud providers
                const config = this.configManager.getConfig();
                const modelConfig = getModelConfigFromConfig(config);
                const selectedTranslationProvider = modelConfig?.gptModel || 'openai';
                
                if (this.currentProvider === 'argos' && selectedTranslationProvider !== 'argos') {
                    // Argos was used as a default/fallback, but user selected a different provider
                    // In this case, don't initialize cloud fallback since user didn't select Argos
                    console.warn('[TranslationServiceManager] ⚠️ Local Argos translation failed, but Argos was not explicitly selected. Not using cloud fallback.');
                } else if (this.currentProvider === 'argos' && selectedTranslationProvider === 'argos') {
                    // User explicitly selected Argos - don't fallback to cloud providers
                    console.warn('[TranslationServiceManager] ⚠️ Local Argos translation failed. User selected Argos, so not using cloud fallback.');
                }
            }
        } else {
            console.error('[TranslationServiceManager] ❌ No primary translation provider available');
        }

        // Try fallback providers
        for (const provider of this.fallbackProviders) {
            try {
                const providerType = this.getProviderType(provider);
                
                // Check circuit breaker
                if (this.isCircuitBreakerOpen(providerType)) {
                    continue;
                }

                console.log(`[TranslationServiceManager] Trying fallback translation provider: ${providerType}...`);
                const result = await provider.translate(text, targetLanguage, sourceLanguage, enhancedContext);
                const processingTime = Date.now() - startTime;

                // Record success metrics
                this.recordMetrics(providerType, processingTime, true);
                this.resetCircuitBreaker(providerType);

                // Update conversation history
                this.addToHistory(text, result.translatedText);

                // Only cache non-contextual translations
                if (!context) {
                    this.translationCache.set(cacheKey, result);
                }

                console.log(`[TranslationServiceManager] Fallback translation successful (${processingTime}ms): "${result.translatedText}"`);
                return { ...result, processingTime };
            } catch (error) {
                console.warn(`[TranslationServiceManager] Fallback translation provider failed:`, error);
                const providerType = this.getProviderType(provider);
                this.recordMetrics(providerType, Date.now() - startTime, false);
                this.recordCircuitBreakerFailure(providerType);
            }
        }

        const error = new Error('All translation providers failed');
        ErrorReportingService.getInstance().captureError(error, {
            category: ErrorCategory.PROCESSING,
            severity: ErrorSeverity.HIGH,
            component: 'TranslationServiceManager',
            context: { action: 'translate', targetLanguage, sourceLanguage, textLength: text.length, provider: this.currentProvider }
        });
        throw error;
    }

    /**
     * Batch translate multiple texts
     */
    async batchTranslate(requests: BatchTranslationRequest[]): Promise<TranslationResult[]> {
        const results: TranslationResult[] = [];
        const batchSize = this.batchSize;

        // Process in batches
        for (let i = 0; i < requests.length; i += batchSize) {
            const batch = requests.slice(i, i + batchSize);
            const batchPromises = batch.map(req => 
                this.translate(req.text, req.targetLanguage, req.sourceLanguage, req.context)
            );
            
            try {
                const batchResults = await Promise.all(batchPromises);
                results.push(...batchResults);
            } catch (error) {
                console.error(`[TranslationServiceManager] Batch translation failed for batch ${i / batchSize}:`, error);
                // Continue with next batch
            }
        }

        return results;
    }

    /**
     * Queue translation for batch processing
     */
    queueTranslation(request: BatchTranslationRequest): void {
        this.batchQueue.push(request);
        
        if (!this.isBatchProcessing) {
            this.processBatchQueue();
        }
    }

    /**
     * Process batch queue
     */
    private async processBatchQueue(): Promise<void> {
        if (this.isBatchProcessing || this.batchQueue.length === 0) {
            return;
        }

        this.isBatchProcessing = true;

        while (this.batchQueue.length > 0) {
            const batch = this.batchQueue.splice(0, this.batchSize);
            
            try {
                await this.batchTranslate(batch);
            } catch (error) {
                console.error('[TranslationServiceManager] Batch processing error:', error);
            }
        }

        this.isBatchProcessing = false;
    }

    getSupportedLanguages(): string[] {
        if (this.primaryProvider) {
            try {
                return this.primaryProvider.getSupportedLanguages();
            } catch (error) {
                console.warn('Failed to get supported languages:', error);
            }
        }

        // Return basic language set as fallback
        return ['en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ja', 'ko', 'zh'];
    }

    setProvider(provider: TranslationProvider): void {
        this.currentProvider = provider;
        // In a full implementation, this would switch the active provider
    }

    getCurrentProvider(): TranslationProvider {
        return this.currentProvider;
    }

    isAvailable(): boolean {
        // Available if provider has been initialized
        return !!this.primaryProvider;
    }

    isLanguagePairSupported(sourceLanguage: string, targetLanguage: string): boolean {
        return this.primaryProvider?.isLanguagePairSupported(sourceLanguage, targetLanguage) || false;
    }

    private getCacheKey(text: string, targetLanguage: string, sourceLanguage?: string): string {
        return `${sourceLanguage || 'auto'}-${targetLanguage}-${text}`;
    }

    /**
     * Clear translation cache
     */
    clearCache(): void {
        this.translationCache.clear();
    }

    /**
     * Initialize cloud fallback when local processing fails
     * Only called when user has NOT explicitly selected Argos (i.e., Argos was a default/fallback)
     */
    private async initializeCloudFallback(): Promise<void> {
        try {
            // Check if user explicitly selected Argos - if so, don't initialize cloud fallback
            const config = this.configManager.getConfig();
            const modelConfig = getModelConfigFromConfig(config);
            const selectedTranslationProvider = modelConfig?.gptModel || 'openai';
            
            if (selectedTranslationProvider === 'argos') {
                // User explicitly selected Argos - don't use cloud fallback
                console.log('[TranslationServiceManager] User selected Argos, skipping cloud fallback initialization');
                return;
            }
            
            const apiKeyManager = ApiKeyManager.getInstance();
            const openaiKey = await apiKeyManager.getApiKey('openai');
            const deepinfraKey = await apiKeyManager.getApiKey('deepinfra');

            // Clear existing fallback providers
            this.fallbackProviders = [];

            // Add available cloud providers as fallbacks (silently skip if keys not found)
            if (openaiKey && openaiKey.trim().length > 0) {
                const openaiProvider = new OpenAITranslationClient(openaiKey);
                this.fallbackProviders.push(openaiProvider);
                console.log('[TranslationServiceManager] Added OpenAI as fallback translation provider');
            }

            if (deepinfraKey && deepinfraKey.trim().length > 0) {
                const deepinfraProvider = new DeepInfraTranslationClient(apiKeyManager);
                this.fallbackProviders.push(deepinfraProvider);
                console.log('[TranslationServiceManager] Added DeepInfra as fallback translation provider');
            }

            if (this.fallbackProviders.length === 0) {
                // Silently log - don't warn since user might not have selected cloud providers
                console.log('[TranslationServiceManager] No cloud fallback providers available - API keys not configured');
            }
        } catch (error) {
            // Fail silently - don't show errors if cloud fallback initialization fails
            console.log('[TranslationServiceManager] Cloud fallback initialization skipped:', error instanceof Error ? error.message : 'Unknown error');
        }
    }

    /**
     * Update providers when configuration changes
     */
    async updateProviders(): Promise<void> {
        this.initialized = false;
        this.primaryProvider = null;
        await this.initializeProviders();
        this.initialized = true;
        this.clearCache();
    }

    /**
     * Select best provider based on performance metrics
     */
    private selectBestProvider(): TranslationProvider {
        // If no metrics, use current provider
        if (this.performanceMetrics.size === 0) {
            return this.currentProvider;
        }

        let bestProvider = this.currentProvider;
        let bestScore = -1;

        this.performanceMetrics.forEach((metrics, provider) => {
            // Skip if circuit breaker is open
            if (this.isCircuitBreakerOpen(provider)) {
                return;
            }

            // Calculate score: lower latency and higher success rate = better
            const latencyScore = 1 / (1 + metrics.averageLatency / 1000); // Normalize to 0-1
            const successScore = metrics.successRate;
            const recencyScore = Math.exp(-(Date.now() - metrics.lastUsed) / 3600000); // Decay over 1 hour
            
            const score = latencyScore * 0.4 + successScore * 0.4 + recencyScore * 0.2;

            if (score > bestScore) {
                bestScore = score;
                bestProvider = provider;
            }
        });

        return bestProvider;
    }

    /**
     * Record performance metrics
     */
    private recordMetrics(provider: TranslationProvider, latency: number, success: boolean): void {
        if (!this.performanceMetrics.has(provider)) {
            this.performanceMetrics.set(provider, {
                provider,
                averageLatency: latency,
                successRate: success ? 1 : 0,
                totalRequests: 1,
                totalFailures: success ? 0 : 1,
                lastUsed: Date.now()
            });
        } else {
            const metrics = this.performanceMetrics.get(provider)!;
            metrics.totalRequests++;
            if (!success) {
                metrics.totalFailures++;
            }
            
            // Update average latency (exponential moving average)
            metrics.averageLatency = metrics.averageLatency * 0.8 + latency * 0.2;
            
            // Update success rate
            metrics.successRate = (metrics.totalRequests - metrics.totalFailures) / metrics.totalRequests;
            metrics.lastUsed = Date.now();
        }
    }

    /**
     * Get provider type from service instance
     */
    private getProviderType(provider: TranslationService): TranslationProvider {
        if ('getCurrentProvider' in provider) {
            return provider.getCurrentProvider();
        }
        return 'openai'; // Default
    }

    /**
     * Enhance context with conversation history
     */
    private enhanceContext(context?: TranslationContext): TranslationContext {
        if (this.conversationHistory.length === 0) {
            return context || {};
        }

        const recentHistory = this.conversationHistory.slice(-this.maxHistorySize);
        const previousSource = recentHistory.map(h => h.source).join(' ');
        const previousTranslation = recentHistory.map(h => h.target).join(' ');

        return {
            ...context,
            previousSource: context?.previousSource 
                ? `${context.previousSource} ${previousSource}` 
                : previousSource,
            previousTranslation: context?.previousTranslation 
                ? `${context.previousTranslation} ${previousTranslation}` 
                : previousTranslation
        };
    }

    /**
     * Add to conversation history
     */
    private addToHistory(source: string, target: string): void {
        this.conversationHistory.push({
            source,
            target,
            timestamp: Date.now()
        });

        // Keep only recent history
        if (this.conversationHistory.length > this.maxHistorySize) {
            this.conversationHistory.shift();
        }
    }

    /**
     * Check if circuit breaker is open
     */
    private isCircuitBreakerOpen(provider: TranslationProvider): boolean {
        const breaker = this.circuitBreakers.get(provider);
        if (!breaker) {
            return false;
        }

        // Auto-reset after 30 seconds
        if (breaker.isOpen && Date.now() - breaker.lastFailure > 30000) {
            breaker.isOpen = false;
            breaker.failures = 0;
        }

        return breaker.isOpen;
    }

    /**
     * Record circuit breaker failure
     */
    private recordCircuitBreakerFailure(provider: TranslationProvider): void {
        if (!this.circuitBreakers.has(provider)) {
            this.circuitBreakers.set(provider, {
                failures: 0,
                lastFailure: 0,
                isOpen: false
            });
        }

        const breaker = this.circuitBreakers.get(provider)!;
        breaker.failures++;
        breaker.lastFailure = Date.now();

        // Open circuit breaker after 3 consecutive failures
        if (breaker.failures >= 3) {
            breaker.isOpen = true;
            console.warn(`[TranslationServiceManager] Circuit breaker opened for ${provider}`);
        }
    }

    /**
     * Reset circuit breaker
     */
    private resetCircuitBreaker(provider: TranslationProvider): void {
        const breaker = this.circuitBreakers.get(provider);
        if (breaker) {
            breaker.failures = 0;
            breaker.isOpen = false;
        }
    }

    /**
     * Get performance metrics
     */
    getPerformanceMetrics(): Map<TranslationProvider, TranslationPerformanceMetrics> {
        return new Map(this.performanceMetrics);
    }

    /**
     * Clear conversation history
     */
    clearConversationHistory(): void {
        this.conversationHistory = [];
    }
}