import { BrowserWindow, screen } from 'electron';
import * as path from 'path';

/**
 * Unified Audio Level Overlay Manager
 * Shows PTT audio levels on the left and Bidirectional audio levels on the right
 * When both are active, they appear side by side with a divider
 */
export class AudioLevelOverlayManager {
    private static instance: AudioLevelOverlayManager;
    private overlayWindow: BrowserWindow | null = null;
    private pttActive = false;
    private bidiActive = false;

    private constructor() {}

    public static getInstance(): AudioLevelOverlayManager {
        if (!AudioLevelOverlayManager.instance) {
            AudioLevelOverlayManager.instance = new AudioLevelOverlayManager();
        }
        return AudioLevelOverlayManager.instance;
    }

    /**
     * Create the unified audio level overlay window
     */
    public async createOverlay(): Promise<BrowserWindow> {
        if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
            return this.overlayWindow;
        }

        const primaryDisplay = screen.getPrimaryDisplay();
        const { width: screenWidth } = primaryDisplay.workAreaSize;

        // Wider to accommodate both sections when active
        const overlayWidth = 400;
        const overlayHeight = 50;
        const x = Math.floor((screenWidth - overlayWidth) / 2);
        const y = 8;

        this.overlayWindow = new BrowserWindow({
            width: overlayWidth,
            height: overlayHeight,
            x: x,
            y: y,
            frame: false,
            transparent: true,
            backgroundColor: '#00000000',
            alwaysOnTop: true,
            skipTaskbar: true,
            resizable: false,
            minimizable: false,
            maximizable: false,
            closable: false,
            focusable: false,
            show: false,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                preload: path.join(__dirname, '..', 'audio-level-overlay-preload.js'),
                backgroundThrottling: false
            }
        });

        // Make it click-through
        this.overlayWindow.setIgnoreMouseEvents(true);
        
        // Set always on top
        try { this.overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true }); } catch {}
        try { this.overlayWindow.setAlwaysOnTop(true, 'screen-saver'); } catch {}
        try { this.overlayWindow.setOpacity(1.0); } catch {}

        // Load the overlay HTML
        await this.overlayWindow.loadFile(path.join(__dirname, '..', 'audio-level-overlay-window.html'));

        this.overlayWindow.on('closed', () => {
            this.overlayWindow = null;
            this.pttActive = false;
            this.bidiActive = false;
        });

        console.log('[AudioLevelOverlay] Window created');
        return this.overlayWindow;
    }

    /**
     * Ensure overlay window exists and is visible
     */
    private async ensureVisible(): Promise<void> {
        if (!this.overlayWindow || this.overlayWindow.isDestroyed()) {
            await this.createOverlay();
        }

        if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
            if (!this.overlayWindow.isVisible()) {
                this.overlayWindow.show();
            }
            try { this.overlayWindow.moveTop(); } catch {}
        }
    }

    /**
     * Hide overlay if neither PTT nor Bidi is active
     */
    private checkAndHide(): void {
        if (!this.pttActive && !this.bidiActive) {
            if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
                this.overlayWindow.hide();
                console.log('[AudioLevelOverlay] Hidden (no active sources)');
            }
        }
    }

    // ==================== PTT Methods ====================

    /**
     * Show PTT section
     */
    public async showPTT(): Promise<void> {
        await this.ensureVisible();
        this.pttActive = true;
        
        if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
            this.overlayWindow.webContents.send('ptt-show');
            console.log('[AudioLevelOverlay] PTT shown');
        }
    }

    /**
     * Hide PTT section
     */
    public hidePTT(): void {
        this.pttActive = false;
        
        if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
            this.overlayWindow.webContents.send('ptt-hide');
            console.log('[AudioLevelOverlay] PTT hidden');
        }
        
        this.checkAndHide();
    }

    /**
     * Update PTT audio levels
     */
    public updatePTTAudio(audioData: number[]): void {
        if (this.overlayWindow && !this.overlayWindow.isDestroyed() && this.pttActive) {
            this.overlayWindow.webContents.send('ptt-audio-data', audioData);
        }
    }

    // ==================== Bidirectional Methods ====================

    /**
     * Show Bidirectional section
     */
    public async showBidi(): Promise<void> {
        await this.ensureVisible();
        this.bidiActive = true;
        
        if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
            this.overlayWindow.webContents.send('bidi-show');
            console.log('[AudioLevelOverlay] Bidi shown');
        }
    }

    /**
     * Hide Bidirectional section
     */
    public hideBidi(): void {
        this.bidiActive = false;
        
        if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
            this.overlayWindow.webContents.send('bidi-hide');
            console.log('[AudioLevelOverlay] Bidi hidden');
        }
        
        this.checkAndHide();
    }

    /**
     * Update Bidirectional audio levels
     */
    public updateBidiAudio(audioData: number[]): void {
        if (this.overlayWindow && !this.overlayWindow.isDestroyed() && this.bidiActive) {
            this.overlayWindow.webContents.send('bidi-audio-data', audioData);
        }
    }

    // ==================== Utility Methods ====================

    /**
     * Check if PTT is active
     */
    public isPTTActive(): boolean {
        return this.pttActive;
    }

    /**
     * Check if Bidirectional is active
     */
    public isBidiActive(): boolean {
        return this.bidiActive;
    }

    /**
     * Get the overlay window
     */
    public getOverlayWindow(): BrowserWindow | null {
        return this.overlayWindow;
    }

    /**
     * Destroy the overlay window
     */
    public destroy(): void {
        if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
            this.overlayWindow.destroy();
            this.overlayWindow = null;
            this.pttActive = false;
            this.bidiActive = false;
            console.log('[AudioLevelOverlay] Destroyed');
        }
    }
}
