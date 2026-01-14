import { Voice } from '../interfaces/TextToSpeechService';

/**
 * Voice selector UI component for TTS voice selection
 */
export class VoiceSelector {
    private selectElement: HTMLSelectElement;
    private voices: Voice[] = [];
    private onChangeCallback?: (voiceId: string) => void;

    constructor(selectElement: HTMLSelectElement) {
        this.selectElement = selectElement;
        this.setupEventListeners();
    }

    private setupEventListeners(): void {
        this.selectElement.addEventListener('change', () => {
            const selectedVoice = this.selectElement.value;
            if (this.onChangeCallback) {
                this.onChangeCallback(selectedVoice);
            }
        });
    }

    /**
     * Update the voice list
     */
    updateVoices(voices: Voice[]): void {
        this.voices = voices;
        this.renderVoices();
    }

    private renderVoices(): void {
        // Clear existing options
        this.selectElement.innerHTML = '<option value="">Select voice...</option>';

        // Add voice options
        this.voices.forEach(voice => {
            const option = document.createElement('option');
            option.value = voice.id;
            
            let displayName = voice.name;
            if (voice.isCloned) {
                displayName += ' (Cloned)';
            }
            if (voice.language) {
                displayName += ` - ${voice.language.toUpperCase()}`;
            }
            if (voice.gender) {
                displayName += ` (${voice.gender})`;
            }
            
            option.textContent = displayName;
            this.selectElement.appendChild(option);
        });
    }

    /**
     * Set callback for voice changes
     */
    onChange(callback: (voiceId: string) => void): void {
        this.onChangeCallback = callback;
    }

    /**
     * Get currently selected voice ID
     */
    getSelectedVoice(): string {
        return this.selectElement.value;
    }

    /**
     * Set selected voice
     */
    setSelectedVoice(voiceId: string): void {
        this.selectElement.value = voiceId;
    }

    /**
     * Enable or disable the selector
     */
    setEnabled(enabled: boolean): void {
        this.selectElement.disabled = !enabled;
    }

    /**
     * Show loading state
     */
    showLoading(): void {
        this.selectElement.innerHTML = '<option value="">Loading voices...</option>';
        this.selectElement.disabled = true;
    }

    /**
     * Show error state
     */
    showError(message: string): void {
        this.selectElement.innerHTML = `<option value="">Error: ${message}</option>`;
        this.selectElement.disabled = true;
    }
}