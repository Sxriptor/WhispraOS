/**
 * Language selector UI component
 */
export class LanguageSelector {
    private selectElement: HTMLSelectElement;
    private onChangeCallback?: (languageCode: string) => void;

    constructor(selectElement: HTMLSelectElement) {
        this.selectElement = selectElement;
        this.initializeLanguages();
        this.setupEventListeners();
    }

    private initializeLanguages(): void {
        const languages = [
            { code: 'en', name: 'English', flag: '🇺🇸' },
            { code: 'es', name: 'Spanish', flag: '🇪🇸' },
            { code: 'fr', name: 'French', flag: '🇫🇷' },
            { code: 'de', name: 'German', flag: '🇩🇪' },
            { code: 'it', name: 'Italian', flag: '🇮🇹' },
            { code: 'pt', name: 'Portuguese', flag: '🇵🇹' },
            { code: 'ru', name: 'Russian', flag: '🇷🇺' },
            { code: 'ja', name: 'Japanese', flag: '🇯🇵' },
            { code: 'ko', name: 'Korean', flag: '🇰🇷' },
            { code: 'zh', name: 'Chinese', flag: '🇨🇳' },
            { code: 'ar', name: 'Arabic', flag: '🇸🇦' },
            { code: 'hi', name: 'Hindi', flag: '🇮🇳' },
            { code: 'th', name: 'Thai', flag: '🇹🇭' },
            { code: 'vi', name: 'Vietnamese', flag: '🇻🇳' },
            { code: 'tr', name: 'Turkish', flag: '🇹🇷' },
            { code: 'pl', name: 'Polish', flag: '🇵🇱' },
            { code: 'nl', name: 'Dutch', flag: '🇳🇱' },
            { code: 'sv', name: 'Swedish', flag: '🇸🇪' },
            { code: 'da', name: 'Danish', flag: '🇩🇰' },
            { code: 'no', name: 'Norwegian', flag: '🇳🇴' }
        ];

        // Clear existing options
        this.selectElement.innerHTML = '';

        // Add language options
        languages.forEach(language => {
            const option = document.createElement('option');
            option.value = language.code;
            option.textContent = `${language.flag} ${language.name}`;
            this.selectElement.appendChild(option);
        });

        // Set default to Spanish
        this.selectElement.value = 'es';
    }

    private setupEventListeners(): void {
        this.selectElement.addEventListener('change', () => {
            const selectedLanguage = this.selectElement.value;
            if (this.onChangeCallback) {
                this.onChangeCallback(selectedLanguage);
            }
        });
    }

    /**
     * Set callback for language changes
     */
    onChange(callback: (languageCode: string) => void): void {
        this.onChangeCallback = callback;
    }

    /**
     * Get currently selected language
     */
    getSelectedLanguage(): string {
        return this.selectElement.value;
    }

    /**
     * Set selected language
     */
    setSelectedLanguage(languageCode: string): void {
        this.selectElement.value = languageCode;
    }

    /**
     * Get language name from code
     */
    getLanguageName(code: string): string {
        const option = this.selectElement.querySelector(`option[value="${code}"]`) as HTMLOptionElement;
        return option ? option.textContent || code : code;
    }

    /**
     * Enable or disable the selector
     */
    setEnabled(enabled: boolean): void {
        this.selectElement.disabled = !enabled;
    }
}