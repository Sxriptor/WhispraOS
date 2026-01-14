/**
 * PTT Overlay - Minimal audio visualization that appears when PTT button is held
 * Shows at the top of the screen with simple audio level bars
 */

export class PTTOverlay {
    private analyserNode: AnalyserNode | null = null;
    private animationFrame: number | null = null;
    private readonly BAR_COUNT = 8; // Simple, minimal bar count

    constructor() {
        // No DOM elements needed - using separate window
    }

    /**
     * Show the overlay and start audio visualization
     */
    public show(analyserNode: AnalyserNode | null): void {
        this.analyserNode = analyserNode;
        
        // Show system overlay via IPC
        (window as any).electronAPI.invoke('ptt-overlay:show', {});
        
        if (analyserNode) {
            this.startVisualization();
        }
    }

    /**
     * Hide the overlay and stop visualization
     */
    public hide(): void {
        this.stopVisualization();
        
        // Hide system overlay via IPC
        (window as any).electronAPI.invoke('ptt-overlay:hide', {});
    }

    /**
     * Start audio visualization animation
     */
    private startVisualization(): void {
        if (!this.analyserNode) return;

        const dataArray = new Uint8Array(this.analyserNode.frequencyBinCount);

        const animate = () => {
            if (!this.analyserNode) return;

            this.analyserNode.getByteFrequencyData(dataArray);

            // Calculate average volume across all frequencies for sensitivity
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
                sum += dataArray[i];
            }
            const average = sum / dataArray.length;

            // Create a symmetric pattern with center being loudest
            const centerIndex = Math.floor(this.BAR_COUNT / 2);
            
            const audioLevels: number[] = [];
            
            for (let index = 0; index < this.BAR_COUNT; index++) {
                // Calculate distance from center (0 = center, higher = edges)
                const distanceFromCenter = Math.abs(index - (this.BAR_COUNT - 1) / 2);
                
                // Sample different frequency ranges, with lower frequencies at edges
                const freqRangeStart = Math.floor((distanceFromCenter / centerIndex) * (dataArray.length / 4));
                const freqRangeEnd = Math.min(freqRangeStart + 20, dataArray.length);
                
                // Get average for this frequency range
                let rangeSum = 0;
                for (let i = freqRangeStart; i < freqRangeEnd; i++) {
                    rangeSum += dataArray[i];
                }
                const rangeAverage = rangeSum / (freqRangeEnd - freqRangeStart);
                
                // Normalize and apply sensitivity boost (3x multiplier for more sensitivity)
                let value = (rangeAverage / 255) * 3;
                
                // Add some of the overall average to make it more responsive
                value = (value * 0.7) + (average / 255) * 0.3 * 3;
                
                // Clamp to 0-1 range
                value = Math.min(1, Math.max(0, value));
                
                // Apply inverse distance from center (center bars are tallest)
                const centerBoost = 1 - (distanceFromCenter / centerIndex) * 0.3;
                value *= centerBoost;
                
                // Set bar height (minimum 15% for visual consistency)
                const height = Math.max(0.15, value);
                audioLevels.push(height);
            }

            // Send audio data to system overlay via IPC
            (window as any).electronAPI.invoke('ptt-overlay:update-audio', audioLevels);

            this.animationFrame = requestAnimationFrame(animate);
        };

        animate();
    }

    /**
     * Stop audio visualization
     */
    private stopVisualization(): void {
        if (this.animationFrame !== null) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }
    }

    /**
     * Clean up resources
     */
    public dispose(): void {
        this.stopVisualization();
        this.analyserNode = null;
    }
}
