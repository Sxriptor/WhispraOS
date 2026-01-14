/**
 * Status indicator UI component for showing processing state
 */
export class StatusIndicator {
    private indicatorElement: HTMLElement;
    private statusTextElement: HTMLElement;

    constructor(indicatorElement: HTMLElement, statusTextElement: HTMLElement) {
        this.indicatorElement = indicatorElement;
        this.statusTextElement = statusTextElement;
    }

    /**
     * Update status with visual indicator
     */
    updateStatus(status: 'idle' | 'active' | 'error' | 'warning', text: string): void {
        // Clear all status classes
        this.indicatorElement.classList.remove('idle', 'active', 'error', 'warning');
        
        // Add appropriate status class
        this.indicatorElement.classList.add(status);
        
        // Update status text
        this.statusTextElement.textContent = text;
    }

    /**
     * Show processing step
     */
    showProcessingStep(step: string): void {
        this.updateStatus('active', this.getStepDisplayName(step));
    }

    /**
     * Show error with message
     */
    showError(message: string): void {
        this.updateStatus('error', `Error: ${message}`);
    }

    /**
     * Show idle state
     */
    showIdle(): void {
        this.updateStatus('idle', 'Ready');
    }

    /**
     * Show warning
     */
    showWarning(message: string): void {
        this.updateStatus('warning', message);
    }

    private getStepDisplayName(step: string): string {
        const stepNames: { [key: string]: string } = {
            'idle': 'Ready',
            'initializing': 'Initializing...',
            'listening': 'Listening',
            'transcribing': 'Converting speech to text...',
            'translating': 'Translating...',
            'synthesizing': 'Generating speech...',
            'outputting': 'Playing audio...',
            'stopping': 'Stopping...',
            'testing': 'Testing...',
            'error': 'Error'
        };

        return stepNames[step] || step;
    }

    /**
     * Add pulsing animation
     */
    startPulsing(): void {
        this.indicatorElement.classList.add('pulsing');
    }

    /**
     * Stop pulsing animation
     */
    stopPulsing(): void {
        this.indicatorElement.classList.remove('pulsing');
    }
}