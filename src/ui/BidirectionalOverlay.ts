/**
 * Bidirectional Overlay - Audio visualization that appears when bidirectional translation is active
 * Shows at the top of the screen alongside PTT overlay (if active)
 * Audio levels are sent directly from the VAD interval in BidirectionalControls
 */

export class BidirectionalOverlay {
    private isActive = false;

    constructor() {}

    /**
     * Show the overlay
     */
    public show(): void {
        if (this.isActive) return;
        this.isActive = true;
        (window as any).electronAPI.invoke('bidi-overlay:show', {});
        console.log('[BidirectionalOverlay] Shown');
    }

    /**
     * Hide the overlay
     */
    public hide(): void {
        if (!this.isActive) return;
        this.isActive = false;
        (window as any).electronAPI.invoke('bidi-overlay:hide', {});
        console.log('[BidirectionalOverlay] Hidden');
    }

    /**
     * Check if overlay is currently active
     */
    public isShowing(): boolean {
        return this.isActive;
    }

    /**
     * Clean up resources
     */
    public dispose(): void {
        this.hide();
    }
}
