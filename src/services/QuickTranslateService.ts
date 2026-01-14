/**
 * Quick Translate Service
 * Adapted from standalone translator for Electron integration
 */

import { ApiKeyManager } from './ApiKeyManager';
import { ManagedApiRouter } from './ManagedApiRouter';

interface TranslationOptions {
  to?: string;
  from?: string;
  provider?: 'openai' | 'deepinfra';
}

interface TranslationResult {
  originalText: string;
  translatedText: string | null;
  sourceLanguage: string;
  targetLanguage: string;
  provider: string;
  success: boolean;
  cached?: boolean;
  timestamp: number;
  error?: string;
}

export class QuickTranslateService {
  private currentProvider: 'openai' | 'deepinfra' = 'openai';
  private providers: Map<string, TranslationProvider>;
  private rateLimiter: RateLimiter;
  private cache: TranslationCache;
  private apiKeyManager: ApiKeyManager;
  private managedApiRouter: ManagedApiRouter;

  constructor() {
    this.providers = new Map();
    this.rateLimiter = new RateLimiter();
    this.cache = new TranslationCache();
    this.apiKeyManager = ApiKeyManager.getInstance();
    this.managedApiRouter = ManagedApiRouter.getInstance();
    // Initialize providers AFTER managedApiRouter is set
    this.initializeProviders();
  }

  private initializeProviders(): void {
    this.providers.set('openai', new OpenAIProvider(this.managedApiRouter));
    this.providers.set('deepinfra', new DeepInfraProvider(this.managedApiRouter));
  }

  setProvider(provider: 'openai' | 'deepinfra'): void {
    if (!this.providers.has(provider)) {
      throw new Error(`Unknown provider: ${provider}`);
    }
    this.currentProvider = provider;
  }

  async translate(text: string, options: TranslationOptions = {}): Promise<TranslationResult> {
    try {
      // Validate input
      if (!text || typeof text !== 'string' || text.trim().length === 0) {
        throw new Error('Invalid text input: text must be a non-empty string');
      }

      // Clean and normalize the text
      const cleanText = text.trim().replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      
      if (cleanText.length > 5000) {
        throw new Error('Text too long: maximum 5000 characters allowed');
      }

      // Set options - always use 'auto' for source language detection
      const provider = options.provider || this.currentProvider;
      const config = {
        to: options.to || 'en',
        from: 'auto', // Always auto-detect source language
        ...options
      };

      // Get API key (not required in managed mode)
      const apiKey = await this.getApiKey(provider);
      const currentMode = this.managedApiRouter.getMode();

      if (!apiKey && currentMode !== 'managed') {
        throw new Error(`API key not set for provider: ${provider}`);
      }

      // Check cache first
      const cacheKey = this.cache.generateKey(cleanText, config.to, provider);
      const cachedResult = this.cache.get(cacheKey);

      if (cachedResult) {
        return {
          ...cachedResult,
          cached: true,
          timestamp: Date.now()
        };
      }

      // Check rate limiting
      await this.rateLimiter.checkLimit(provider);

      // Get provider
      const providerInstance = this.providers.get(provider);
      if (!providerInstance) {
        throw new Error(`Unknown provider: ${provider}`);
      }

      // Detect language first to check if translation is needed
      const detectedLang = await providerInstance.detectLanguage(cleanText, { apiKey });
      console.log(`🔍 Detected language: "${detectedLang}", target: "${config.to}"`);

      // Normalize language codes for comparison (lowercase, trim whitespace)
      const normalizedDetected = (detectedLang || '').toLowerCase().trim();
      const normalizedTarget = (config.to || '').toLowerCase().trim();

      // If source language matches target language, return original text
      if (normalizedDetected === normalizedTarget && normalizedDetected !== 'auto') {
        console.log(`✅ Source and target language are the same (${normalizedDetected}), returning original text`);
        const sameLanguageResult: TranslationResult = {
          originalText: cleanText,
          translatedText: cleanText,
          sourceLanguage: detectedLang,
          targetLanguage: config.to,
          provider: provider,
          success: true,
          cached: false,
          timestamp: Date.now()
        };
        this.cache.set(cacheKey, sameLanguageResult);
        return sameLanguageResult;
      }
      
      console.log(`🌐 Languages differ, proceeding with translation (${normalizedDetected} → ${normalizedTarget})`);

      // Proceed with translation
      const result = await providerInstance.translate(cleanText, { ...config, apiKey });

      // Cache the successful result
      const translationResult: TranslationResult = {
        originalText: cleanText,
        translatedText: result.translatedText,
        sourceLanguage: result.sourceLanguage || config.from,
        targetLanguage: config.to,
        provider: provider,
        success: true,
        cached: false,
        timestamp: Date.now()
      };

      this.cache.set(cacheKey, translationResult);
      return translationResult;

    } catch (error: any) {
      return {
        originalText: text,
        translatedText: null,
        sourceLanguage: options.from || 'auto',
        targetLanguage: options.to || 'en',
        provider: this.currentProvider,
        success: false,
        error: error.message,
        timestamp: Date.now()
      };
    }
  }

  private async getApiKey(provider: 'openai' | 'deepinfra'): Promise<string | null> {
    try {
      return await this.apiKeyManager.getApiKey(provider);
    } catch (error) {
      console.error(`Failed to get API key for ${provider}:`, error);
      return null;
    }
  }

  async testApiKey(provider: 'openai' | 'deepinfra', apiKey?: string): Promise<boolean> {
    try {
      const providerInstance = this.providers.get(provider);
      if (!providerInstance) {
        throw new Error(`Unknown provider: ${provider}`);
      }

      const keyToTest = apiKey || await this.getApiKey(provider);
      if (!keyToTest) {
        throw new Error('No API key provided');
      }

      // Test with a simple translation
      const result = await providerInstance.translate('Hello', {
        to: 'es',
        apiKey: keyToTest
      });

      return !!(result && result.translatedText);
    } catch (error) {
      return false;
    }
  }

  clearCache(): void {
    this.cache.clear();
  }

  getCacheSize(): number {
    return this.cache.size();
  }
}

interface TranslationProvider {
  translate(text: string, options: any): Promise<{ translatedText: string; sourceLanguage?: string }>;
  detectLanguage(text: string, options: any): Promise<string>;
}

class OpenAIProvider implements TranslationProvider {
  private baseURL = 'https://api.openai.com/v1/chat/completions';
  private model = 'gpt-3.5-turbo';
  private timeout = 30000;
  private managedApiRouter: ManagedApiRouter;

  constructor(managedApiRouter: ManagedApiRouter) {
    this.managedApiRouter = managedApiRouter;
  }

  async translate(text: string, options: any): Promise<{ translatedText: string; sourceLanguage?: string }> {
    try {
      const currentMode = this.managedApiRouter.getMode();

      if (currentMode === 'managed') {
        // Use managed API
        const response = await this.managedApiRouter.routeOpenAIRequest({
          endpoint: '/translate',
          method: 'POST',
          body: {
            text: text,
            sourceLanguage: options.from || 'auto',
            targetLanguage: options.to,
            prompt: this.buildPrompt(text, options.from, options.to)
          },
          headers: {
            'Content-Type': 'application/json'
          }
        });

        if (response === null) {
          console.log('🔑 Managed API router returned null, using personal API key for quick translate');
          // Fall through to personal API code below
        } else if (response && response.success) {
          const translatedText = response.data.translatedText;
          if (!translatedText) {
            throw new Error('No translation received from managed API');
          }
          return {
            translatedText: translatedText,
            sourceLanguage: options.from
          };
        } else {
          throw new Error(response?.error || 'Managed API request failed');
        }
      }

      // Personal mode - use personal API key
      const prompt = this.buildPrompt(text, options.from, options.to);

      const requestData = {
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'You are a professional translator. Translate the given text accurately and return only the translation without any additional text or explanations.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 1000,
        temperature: 0.1
      };

      const response = await fetch(this.baseURL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${options.apiKey}`,
          'Content-Type': 'application/json; charset=utf-8'
        },
        body: JSON.stringify(requestData)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();

      if (!data.choices || data.choices.length === 0) {
        throw new Error('No translation received from OpenAI');
      }

      const translatedText = data.choices[0].message.content.trim();

      return {
        translatedText: translatedText,
        sourceLanguage: options.from
      };
    } catch (error: any) {
      console.error('OpenAI translation error:', error);
      throw new Error(`Translation failed: ${error.message}`);
    }
  }

  async detectLanguage(text: string, options: any): Promise<string> {
    try {
      const currentMode = this.managedApiRouter.getMode();

      if (currentMode === 'managed') {
        // Use managed API for language detection
        const requestData = {
          model: this.model,
          messages: [
            {
              role: 'system',
              content: 'You are a language detection assistant. Detect the language of the given text and return ONLY the ISO 639-1 language code (e.g., "en", "es", "fr", "zh", "ja"). Return nothing else.'
            },
            {
              role: 'user',
              content: `Detect the language of this text: ${text.substring(0, 200)}`
            }
          ],
          max_tokens: 10,
          temperature: 0
        };

        const response = await this.managedApiRouter.routeOpenAIRequest({
          endpoint: '/chat/completions',
          method: 'POST',
          body: requestData,
          headers: {
            'Content-Type': 'application/json'
          }
        });

        if (response === null) {
          console.log('🔑 Managed API router returned null for language detection, using personal API key');
          // Fall through to personal API code below
        } else if (response && response.success) {
          const detectedLang = response.data.choices?.[0]?.message?.content?.trim().toLowerCase();
          return detectedLang || 'auto';
        } else {
          console.warn('Managed API language detection failed, defaulting to auto');
          return 'auto';
        }
      }

      // Personal mode - use personal API key
      const requestData = {
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'You are a language detection assistant. Detect the language of the given text and return ONLY the ISO 639-1 language code (e.g., "en", "es", "fr", "zh", "ja"). Return nothing else.'
          },
          {
            role: 'user',
            content: `Detect the language of this text: ${text.substring(0, 200)}`
          }
        ],
        max_tokens: 10,
        temperature: 0
      };

      const response = await fetch(this.baseURL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${options.apiKey}`,
          'Content-Type': 'application/json; charset=utf-8'
        },
        body: JSON.stringify(requestData)
      });

      if (!response.ok) {
        console.warn('Language detection failed, defaulting to auto');
        return 'auto';
      }

      const data = await response.json();
      const detectedLang = data.choices?.[0]?.message?.content?.trim().toLowerCase();
      return detectedLang || 'auto';
    } catch (error) {
      console.warn('Language detection error:', error);
      return 'auto';
    }
  }

  private buildPrompt(text: string, from: string, to: string): string {
    const languageNames: Record<string, string> = {
      'en': 'English',
      'es': 'Spanish',
      'fr': 'French',
      'de': 'German',
      'it': 'Italian',
      'pt': 'Portuguese',
      'ru': 'Russian',
      'ja': 'Japanese',
      'ko': 'Korean',
      'zh': 'Chinese',
      'ar': 'Arabic'
    };

    const targetLang = languageNames[to] || to;

    if (from === 'auto') {
      return `Translate the following text to ${targetLang}:\n\n${text}`;
    } else {
      const sourceLang = languageNames[from] || from;
      return `Translate the following text from ${sourceLang} to ${targetLang}:\n\n${text}`;
    }
  }
}

class DeepInfraProvider implements TranslationProvider {
  private baseURL = 'https://api.deepinfra.com/v1/openai/chat/completions';
  private model = 'meta-llama/Llama-2-70b-chat-hf';
  private timeout = 30000;
  private managedApiRouter: ManagedApiRouter;

  constructor(managedApiRouter: ManagedApiRouter) {
    this.managedApiRouter = managedApiRouter;
    // Note: DeepInfra currently only supports personal mode
  }

  async translate(text: string, options: any): Promise<{ translatedText: string; sourceLanguage?: string }> {
    try {
      const prompt = this.buildPrompt(text, options.from, options.to);

      const requestData = {
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'You are a professional translator. Translate the given text accurately and return only the translation without any additional text or explanations.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 1000,
        temperature: 0.1
      };

      const response = await fetch(this.baseURL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${options.apiKey}`,
          'Content-Type': 'application/json; charset=utf-8'
        },
        body: JSON.stringify(requestData)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`DeepInfra API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();

      if (!data.choices || data.choices.length === 0) {
        throw new Error('No translation received from DeepInfra');
      }

      const translatedText = data.choices[0].message.content.trim();

      return {
        translatedText: translatedText,
        sourceLanguage: options.from
      };
    } catch (error: any) {
      console.error('DeepInfra translation error:', error);
      throw new Error(`Translation failed: ${error.message}`);
    }
  }

  async detectLanguage(text: string, options: any): Promise<string> {
    try {
      const requestData = {
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'You are a language detection assistant. Detect the language of the given text and return ONLY the ISO 639-1 language code (e.g., "en", "es", "fr", "zh", "ja"). Return nothing else.'
          },
          {
            role: 'user',
            content: `Detect the language of this text: ${text.substring(0, 200)}`
          }
        ],
        max_tokens: 10,
        temperature: 0
      };

      const response = await fetch(this.baseURL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${options.apiKey}`,
          'Content-Type': 'application/json; charset=utf-8'
        },
        body: JSON.stringify(requestData)
      });

      if (!response.ok) {
        console.warn('Language detection failed, defaulting to auto');
        return 'auto';
      }

      const data = await response.json();
      const detectedLang = data.choices?.[0]?.message?.content?.trim().toLowerCase();
      return detectedLang || 'auto';
    } catch (error) {
      console.warn('Language detection error:', error);
      return 'auto';
    }
  }

  private buildPrompt(text: string, from: string, to: string): string {
    const languageNames: Record<string, string> = {
      'en': 'English',
      'es': 'Spanish',
      'fr': 'French',
      'de': 'German',
      'it': 'Italian',
      'pt': 'Portuguese',
      'ru': 'Russian',
      'ja': 'Japanese',
      'ko': 'Korean',
      'zh': 'Chinese',
      'ar': 'Arabic'
    };

    const targetLang = languageNames[to] || to;

    if (from === 'auto') {
      return `Translate the following text to ${targetLang}:\n\n${text}`;
    } else {
      const sourceLang = languageNames[from] || from;
      return `Translate the following text from ${sourceLang} to ${targetLang}:\n\n${text}`;
    }
  }
}

class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  private limits = {
    openai: { requests: 60, window: 60000 },
    deepinfra: { requests: 100, window: 60000 }
  };

  async checkLimit(provider: string): Promise<void> {
    const now = Date.now();
    const limit = this.limits[provider as keyof typeof this.limits];

    if (!limit) return;

    if (!this.requests.has(provider)) {
      this.requests.set(provider, []);
    }

    const requests = this.requests.get(provider)!;
    const validRequests = requests.filter(timestamp => now - timestamp < limit.window);

    if (validRequests.length >= limit.requests) {
      const oldestRequest = Math.min(...validRequests);
      const waitTime = limit.window - (now - oldestRequest);
      throw new Error(`Rate limit exceeded. Please wait ${Math.ceil(waitTime / 1000)} seconds.`);
    }

    validRequests.push(now);
    this.requests.set(provider, validRequests);
  }
}

class TranslationCache {
  private cache: Map<string, TranslationResult> = new Map();
  private maxSize: number;

  constructor(maxSize = 100) {
    this.maxSize = maxSize;
  }

  generateKey(text: string, targetLang: string, provider: string): string {
    const input = `${text}|${targetLang}|${provider}`;
    // Use a safer encoding method that handles Unicode characters properly
    try {
      // Convert to UTF-8 bytes then to base64
      const encoder = new TextEncoder();
      const data = encoder.encode(input);
      const base64 = btoa(String.fromCharCode(...data));
      return base64.substring(0, 32);
    } catch (error) {
      // Fallback: create a simple hash from the input
      let hash = 0;
      for (let i = 0; i < input.length; i++) {
        const char = input.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
      }
      return Math.abs(hash).toString(36).substring(0, 32);
    }
  }

  get(key: string): TranslationResult | null {
    if (this.cache.has(key)) {
      const value = this.cache.get(key)!;
      this.cache.delete(key);
      this.cache.set(key, value);
      return value;
    }
    return null;
  }

  set(key: string, value: TranslationResult): void {
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(key, value);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}