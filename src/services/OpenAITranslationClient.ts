import { TranslationService, TranslationResult, TranslationProvider, TranslationContext } from '../interfaces/TranslationService';
import { ErrorInfo, ErrorCategory, ErrorSeverity } from '../types/ErrorTypes';
import { ManagedApiRouter } from './ManagedApiRouter';
import { ConfigurationManager } from './ConfigurationManager';
import { ErrorReportingService } from './ErrorReportingService';

/**
 * OpenAI-based translation service using GPT models
 */
export class OpenAITranslationClient implements TranslationService {
    private apiKey: string;
    private baseUrl: string = 'https://api.openai.com/v1';
    private model: string = 'gpt-3.5-turbo';
    private managedApiRouter: ManagedApiRouter;

    constructor(apiKey: string) {
        this.apiKey = apiKey;
        this.managedApiRouter = ManagedApiRouter.getInstance();
    }

    /**
     * Get the remember responses preference for managed API calls
     */
    private getRememberPreference(): boolean {
        try {
            const config = ConfigurationManager.getInstance().getConfig();
            return (config as any).userPreferences?.rememberResponses !== false; // Default to true
        } catch (error) {
            console.warn('Failed to get remember preference, defaulting to true:', error);
            return true; // Default to true
        }
    }

    async translate(text: string, targetLanguage: string, sourceLanguage?: string, context?: TranslationContext): Promise<TranslationResult> {
        const currentMode = this.managedApiRouter.getMode();
        
        if (currentMode === 'managed') {
            return await this.translateWithManagedApi(text, targetLanguage, sourceLanguage, context);
        } else {
            return await this.translateWithPersonalApi(text, targetLanguage, sourceLanguage, context);
        }
    }

    /**
     * Translate using managed API
     */
    private async translateWithManagedApi(text: string, targetLanguage: string, sourceLanguage?: string, context?: TranslationContext): Promise<TranslationResult> {
        const startTime = Date.now();

        try {
            const detectedSourceLanguage = sourceLanguage || await this.detectLanguage(text);
            const prompt = this.buildTranslationPrompt(text, detectedSourceLanguage, targetLanguage, context);

            console.log(`🌐 OpenAI Translation Request (Managed):`, {
                text: text.substring(0, 100),
                sourceLanguage: detectedSourceLanguage,
                targetLanguage,
                hasContext: !!context,
                contextPreview: context?.previousTranslation?.substring(0, 50)
            });

            // Use the dedicated translation endpoint with the correct format
            // Backend expects: text, sourceLanguage, targetLanguage
            // Only include hasContext and contextPreview if there's actual context
            const requestBody: any = {
                text: text,
                sourceLanguage: detectedSourceLanguage,
                targetLanguage: targetLanguage,
                prompt: prompt
            };

            // Only set hasContext: true if there's actual context text
            if (context?.previousTranslation || context?.fullContext) {
                requestBody.hasContext = true;
                requestBody.contextPreview = context.previousTranslation || context.fullContext;
            }

            // Use the dedicated translate endpoint
            const response = await this.managedApiRouter.routeOpenAIRequest({
                endpoint: '/translate',
                method: 'POST',
                body: requestBody,
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            // If response is null, it means we're in personal mode - use personal API
            if (response === null) {
                console.log('🔑 Managed API router returned null, using personal API key for translation');
                return await this.translateWithPersonalApi(text, targetLanguage, sourceLanguage, context);
            }

            if (!response.success) {
                throw new Error(response?.error || 'Managed API request failed');
            }

            const data = response.data;
            let translatedText = data.translatedText;

            if (!translatedText) {
                throw new Error('No translation received from managed API');
            }

            // Remove surrounding quotes if present
            if ((translatedText.startsWith('"') && translatedText.endsWith('"')) ||
                (translatedText.startsWith("'") && translatedText.endsWith("'"))) {
                translatedText = translatedText.slice(1, -1);
            }

            console.log(`✅ OpenAI Translation Response (Managed):`, {
                original: text.substring(0, 50),
                translated: translatedText.substring(0, 100),
                sourceLanguage: detectedSourceLanguage,
                targetLanguage
            });

            return {
                translatedText,
                sourceLanguage: detectedSourceLanguage,
                targetLanguage,
                confidence: 0.9,
                processingTime: Date.now() - startTime,
                provider: 'openai' as TranslationProvider
            };

        } catch (error) {
            console.error('Managed API translation failed:', error);
            throw new Error(`Translation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Translate using personal API key
     */
    private async translateWithPersonalApi(text: string, targetLanguage: string, sourceLanguage?: string, context?: TranslationContext): Promise<TranslationResult> {
        const startTime = Date.now();

        try {
            const detectedSourceLanguage = sourceLanguage || await this.detectLanguage(text);
            const prompt = this.buildTranslationPrompt(text, detectedSourceLanguage, targetLanguage, context);

            console.log(`🌐 OpenAI Translation Request:`, {
                text: text.substring(0, 100),
                sourceLanguage: detectedSourceLanguage,
                targetLanguage,
                hasContext: !!context,
                contextPreview: context?.previousTranslation?.substring(0, 50),
                prompt: prompt.substring(0, 150)
            });

            const response = await fetch(`${this.baseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: this.model,
                    messages: [
                        {
                            role: 'system',
                            content: context
                                ? 'You are a real-time translation assistant. When provided with previous context, use it to improve translation coherence and maintain consistent tone, pronouns, verb tenses, and sentence flow across chunks. Translate the text accurately and keep the same meaning and tone. Only keep curse words if they are in the original. Don\'t add any new ones. Return ONLY the translation of the CURRENT text, not the context. No notes, quotes, or formatting. If there\'s HTML, translate only the text inside the tags and keep the HTML structure. If it\'s already in the target language, return it unchanged.'
                                : 'You are a translator. Translate the text accurately and keep the same meaning and tone. Only keep curse words if they are in the original. Don\'t add any new ones. Return only the translated text — no notes, quotes, or formatting. If there\'s HTML, translate only the text inside the tags and keep the HTML structure. If it\'s already in the target language, return it unchanged.'
                        },
                        {
                            role: 'user',
                            content: prompt
                        }
                    ],
                    max_tokens: 1000,
                    temperature: 0.3
                })
            });

            if (!response.ok) {
                throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            let translatedText = data.choices[0]?.message?.content?.trim();

            if (!translatedText) {
                throw new Error('No translation received from OpenAI');
            }

            // Remove surrounding quotes if OpenAI added them
            if ((translatedText.startsWith('"') && translatedText.endsWith('"')) ||
                (translatedText.startsWith("'") && translatedText.endsWith("'"))) {
                translatedText = translatedText.slice(1, -1);
            }

            console.log(`✅ OpenAI Translation Response:`, {
                original: text.substring(0, 50),
                translated: translatedText.substring(0, 100),
                sourceLanguage: detectedSourceLanguage,
                targetLanguage
            });

            return {
                translatedText,
                sourceLanguage: detectedSourceLanguage,
                targetLanguage,
                confidence: 0.9, // OpenAI doesn't provide confidence scores
                processingTime: Date.now() - startTime,
                provider: 'openai' as TranslationProvider
            };

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            ErrorReportingService.getInstance().captureError(error instanceof Error ? error : new Error(errorMessage), {
                category: ErrorCategory.API,
                severity: ErrorSeverity.HIGH,
                component: 'OpenAITranslationClient',
                context: { action: 'translate', targetLanguage, sourceLanguage, textLength: text.length }
            });
            throw new Error(`Translation failed: ${errorMessage}`);
        }
    }

    async detectLanguage(text: string): Promise<string> {
        const currentMode = this.managedApiRouter.getMode();
        
        try {
            if (currentMode === 'managed') {
                // Use managed API for language detection
                const requestBody = {
                    model: this.model,
                    messages: [
                        {
                            role: 'system',
                            content: 'Detect the language of the given text and return only the ISO 639-1 language code (e.g., "en", "es", "fr").'
                        },
                        {
                            role: 'user',
                            content: text
                        }
                    ],
                    max_tokens: 10,
                    temperature: 0,
                    remember: this.getRememberPreference()
                };

                const response = await this.managedApiRouter.routeOpenAIRequest({
                    endpoint: '/chat/completions',
                    method: 'POST',
                    body: requestBody,
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });

                // If response is null, fall back to personal API (handled in else block below)
                if (response === null) {
                    console.log('🔑 Managed API router returned null for language detection, using personal API key');
                    // Fall through to personal API code below
                } else if (response && response.success) {
                    const languageCode = response.data.choices[0]?.message?.content?.trim().toLowerCase();
                    return languageCode || 'en';
                } else {
                    console.warn('Managed API language detection failed, falling back to personal API');
                    // Fall through to personal API code below
                }
            } else {
                // Use personal API key
                const response = await fetch(`${this.baseUrl}/chat/completions`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        model: this.model,
                        messages: [
                            {
                                role: 'system',
                                content: 'Detect the language of the given text and return only the ISO 639-1 language code (e.g., "en", "es", "fr").'
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

                if (response.ok) {
                    const data = await response.json();
                    const languageCode = data.choices[0]?.message?.content?.trim().toLowerCase();
                    return languageCode || 'en';
                }
            }

            return 'en';

        } catch (error) {
            console.warn('Language detection failed, defaulting to English:', error);
            ErrorReportingService.getInstance().captureError(error instanceof Error ? error : new Error(String(error)), {
                category: ErrorCategory.API,
                severity: ErrorSeverity.LOW,
                component: 'OpenAITranslationClient',
                context: { action: 'detectLanguage', textLength: text.length }
            });
            return 'en';
        }
    }

    getSupportedLanguages(): string[] {
        // OpenAI supports most major languages
        return [
            'en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ja', 'ko', 'zh',
            'ar', 'hi', 'th', 'vi', 'tr', 'pl', 'nl', 'sv', 'da', 'no'
        ];
    }

    setProvider(provider: TranslationProvider): void {
        // This implementation only supports OpenAI
    }

    getCurrentProvider(): TranslationProvider {
        return 'openai';
    }

    isAvailable(): boolean {
        const currentMode = this.managedApiRouter.getMode();
        
        if (currentMode === 'managed') {
            // For managed mode, assume available and let actual calls handle validation
            return true;
        } else {
            return !!this.apiKey;
        }
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
            'no': 'Norwegian'
        };
        
        return languageNames[code] || code.toUpperCase();
    }
}