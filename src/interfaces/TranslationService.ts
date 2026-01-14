/**
 * Context information for translation
 */
export interface TranslationContext {
  /** Previous source text chunks (for reference) */
  previousSource?: string;
  /** Previous translated text chunks (for coherence) */
  previousTranslation?: string;
  /** Full context string (pre-formatted) */
  fullContext?: string;
}

/**
 * Service interface for translating text between languages
 */
export interface TranslationService {
  /**
   * Translate text to target language
   * @param text - Text to translate
   * @param targetLanguage - Target language code
   * @param sourceLanguage - Source language code (optional, auto-detect if not provided)
   * @param context - Optional context from previous translations to improve coherence
   * @returns Promise resolving to translation result
   */
  translate(text: string, targetLanguage: string, sourceLanguage?: string, context?: TranslationContext): Promise<TranslationResult>;

  /**
   * Get list of supported languages
   * @returns Array of supported language codes
   */
  getSupportedLanguages(): string[];

  /**
   * Set the preferred translation provider
   * @param provider - Provider to use ('openai', 'google', 'deepl')
   */
  setProvider(provider: TranslationProvider): void;

  /**
   * Get current translation provider
   * @returns Current provider
   */
  getCurrentProvider(): TranslationProvider;

  /**
   * Check if the service is available and configured
   * @returns True if service is ready to use
   */
  isAvailable(): boolean;

  /**
   * Validate if a language pair is supported
   * @param sourceLanguage - Source language code
   * @param targetLanguage - Target language code
   * @returns True if translation is supported
   */
  isLanguagePairSupported(sourceLanguage: string, targetLanguage: string): boolean;
}

/**
 * Result of a text translation
 */
export interface TranslationResult {
  /** The translated text */
  translatedText: string;
  /** Source language (detected or specified) */
  sourceLanguage: string;
  /** Target language */
  targetLanguage: string;
  /** Confidence score (0-1) if available */
  confidence?: number;
  /** Processing time in milliseconds */
  processingTime?: number;
  /** Provider used for translation */
  provider: TranslationProvider;
  /** Additional metadata from the provider */
  metadata?: Record<string, any>;
}

/**
 * Available translation providers
 */
export type TranslationProvider = 'openai' | 'google' | 'deepl' | 'deepinfra' | 'argos';