import { TranslationService, TranslationResult, TranslationProvider, TranslationContext } from '../interfaces/TranslationService';
import { ApiKeyManager } from './ApiKeyManager';
import { ErrorReportingService } from './ErrorReportingService';
import { ErrorCategory, ErrorSeverity } from '../types/ErrorTypes';

/**
 * DeepInfra-based translation service using Meta-Llama models
 * Uses DeepInfra's OpenAI-compatible chat completions API
 */
export class DeepInfraTranslationClient implements TranslationService {
    private apiKeyManager: ApiKeyManager;
    private baseUrl: string = 'https://api.deepinfra.com/v1/openai';
    private model: string = 'meta-llama/Meta-Llama-3.1-70B-Instruct';

    constructor(apiKeyManager: ApiKeyManager) {
        this.apiKeyManager = apiKeyManager;
    }

    async translate(text: string, targetLanguage: string, sourceLanguage?: string, context?: TranslationContext): Promise<TranslationResult> {
        const startTime = Date.now();

        try {
            const apiKey = await this.apiKeyManager.getApiKey('deepinfra');
            if (!apiKey) {
                throw new Error('DeepInfra API key not found. Please configure your API key.');
            }

            const detectedSourceLanguage = sourceLanguage || await this.detectLanguage(text, apiKey);
            const prompt = this.buildTranslationPrompt(text, detectedSourceLanguage, targetLanguage, context);

            console.log(`🌐 DeepInfra Translation Request:`, {
                text: text.substring(0, 100),
                sourceLanguage: detectedSourceLanguage,
                targetLanguage,
                model: this.model,
                hasContext: !!context,
                contextPreview: context?.previousTranslation?.substring(0, 50)
            });

            const response = await fetch(`${this.baseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: this.model,
                    messages: [
                        {
                            role: 'system',
                            content: context
                                ? 'You are a real-time translation assistant. When provided with previous context, use it to improve translation coherence and maintain consistent tone, pronouns, verb tenses, and sentence flow across chunks. Translate the given text accurately while preserving the original meaning and tone. Return ONLY the translation of the CURRENT text, not the context. No quotes, commentary, explanations, or additional formatting. If the input contains HTML tags, translate only the text content and keep the HTML structure intact.'
                                : 'You are a professional translator. Translate the given text accurately while preserving the original meaning and tone. Return ONLY the translated text without quotes, commentary, explanations, or additional formatting. If the input contains HTML tags, translate only the text content and keep the HTML structure intact.'
                        },
                        {
                            role: 'user',
                            content: prompt
                        }
                    ],
                    max_tokens: 1000,
                    temperature: 0.3,
                    top_p: 0.9
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`DeepInfra API error: ${response.status} ${response.statusText} - ${errorText}`);
            }

            const data = await response.json();
            let translatedText = data.choices[0]?.message?.content?.trim();

            if (!translatedText) {
                throw new Error('No translation received from DeepInfra');
            }

            // Remove surrounding quotes if the model added them
            if ((translatedText.startsWith('"') && translatedText.endsWith('"')) ||
                (translatedText.startsWith("'") && translatedText.endsWith("'"))) {
                translatedText = translatedText.slice(1, -1);
            }

            console.log(`✅ DeepInfra Translation Response:`, {
                original: text.substring(0, 50),
                translated: translatedText.substring(0, 100),
                sourceLanguage: detectedSourceLanguage,
                targetLanguage
            });

            return {
                translatedText,
                sourceLanguage: detectedSourceLanguage,
                targetLanguage,
                confidence: 0.9, // DeepInfra doesn't provide confidence scores
                processingTime: Date.now() - startTime,
                provider: 'deepinfra' as TranslationProvider,
                metadata: {
                    model: this.model
                }
            };

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            ErrorReportingService.getInstance().captureError(error instanceof Error ? error : new Error(errorMessage), {
                category: ErrorCategory.API,
                severity: ErrorSeverity.HIGH,
                component: 'DeepInfraTranslationClient',
                context: { action: 'translate', targetLanguage, sourceLanguage, textLength: text.length, model: this.model }
            });
            throw new Error(`DeepInfra translation failed: ${errorMessage}`);
        }
    }

    async detectLanguage(text: string, apiKey: string): Promise<string> {
        try {
            const response = await fetch(`${this.baseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: this.model,
                    messages: [
                        {
                            role: 'system',
                            content: 'Detect the language of the given text and return only the ISO 639-1 language code (e.g., "en", "es", "fr"). No explanations, just the code.'
                        },
                        {
                            role: 'user',
                            content: text
                        }
                    ],
                    max_tokens: 10,
                    temperature: 0
                })
            });

            if (!response.ok) {
                throw new Error(`DeepInfra API error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            const languageCode = data.choices[0]?.message?.content?.trim().toLowerCase();

            return languageCode || 'en';

        } catch (error) {
            console.warn('Language detection failed, defaulting to English:', error);
            ErrorReportingService.getInstance().captureError(error instanceof Error ? error : new Error(String(error)), {
                category: ErrorCategory.API,
                severity: ErrorSeverity.LOW,
                component: 'DeepInfraTranslationClient',
                context: { action: 'detectLanguage', textLength: text.length }
            });
            return 'en';
        }
    }

    getSupportedLanguages(): string[] {
        // Meta-Llama models support a wide range of languages
        return [
            'en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ja', 'ko', 'zh',
            'ar', 'hi', 'th', 'vi', 'tr', 'pl', 'nl', 'sv', 'da', 'no',
            'fi', 'cs', 'el', 'he', 'id', 'ms', 'ro', 'uk', 'bn', 'ta'
        ];
    }

    setProvider(provider: TranslationProvider): void {
        // This implementation only supports DeepInfra
    }

    getCurrentProvider(): TranslationProvider {
        return 'deepinfra';
    }

    isAvailable(): boolean {
        // Note: This is a synchronous check, actual API key validation happens during translate()
        return true;
    }

    isLanguagePairSupported(sourceLanguage: string, targetLanguage: string): boolean {
        const supported = this.getSupportedLanguages();
        return supported.includes(sourceLanguage) && supported.includes(targetLanguage);
    }

    private buildTranslationPrompt(text: string, sourceLanguage: string, targetLanguage: string, context?: TranslationContext): string {
        const sourceLanguageName = this.getLanguageName(sourceLanguage);
        const targetLanguageName = this.getLanguageName(targetLanguage);

        if (context && (context.previousTranslation || context.fullContext)) {
            // Build contextual prompt
            const contextText = context.fullContext || context.previousTranslation || '';
            return `Previous translated context: "${contextText}"\n\nNow translate the following ${sourceLanguageName} text to ${targetLanguageName} (maintain coherence with the context above):\n\n"${text}"`;
        }

        return `Translate the following ${sourceLanguageName} text to ${targetLanguageName}:\n\n"${text}"`;
    }

    private getLanguageName(code: string): string {
        const languageNames: { [key: string]: string } = {
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
            'ar': 'Arabic',
            'hi': 'Hindi',
            'th': 'Thai',
            'vi': 'Vietnamese',
            'tr': 'Turkish',
            'pl': 'Polish',
            'nl': 'Dutch',
            'sv': 'Swedish',
            'da': 'Danish',
            'no': 'Norwegian',
            'fi': 'Finnish',
            'cs': 'Czech',
            'el': 'Greek',
            'he': 'Hebrew',
            'id': 'Indonesian',
            'ms': 'Malay',
            'ro': 'Romanian',
            'uk': 'Ukrainian',
            'bn': 'Bengali',
            'ta': 'Tamil'
        };
        
        return languageNames[code] || code.toUpperCase();
    }
}

