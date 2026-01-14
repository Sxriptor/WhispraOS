import { BrowserWindow, screen } from 'electron';
import * as path from 'path';

export class PTTOverlayManager {
    private static instance: PTTOverlayManager;
    private overlayWindow: BrowserWindow | null = null;
    private isShowing = false;

    private constructor() {}

    public static getInstance(): PTTOverlayManager {
        if (!PTTOverlayManager.instance) {
            PTTOverlayManager.instance = new PTTOverlayManager();
        }
        return PTTOverlayManager.instance;
    }

    /**
     * Create the PTT overlay window - EXACTLY like mini overlay
     */
    public async createOverlay(): Promise<BrowserWindow> {
        if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
            return this.overlayWindow;
        }

        // Get primary display bounds for positioning
        const primaryDisplay = screen.getPrimaryDisplay();
        const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

        // Calculate position for top-center of screen
        const overlayWidth = 200;
        const overlayHeight = 50;
        const x = Math.floor((screenWidth - overlayWidth) / 2);
        const y = 8; // 8px from top

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
                preload: path.join(__dirname, '..', 'ptt-overlay-preload.js'),
                backgroundThrottling: false
            }
        });

        // Make it click-through
        this.overlayWindow.setIgnoreMouseEvents(true);
        
        // Set always on top - EXACTLY like mini overlay
        try { this.overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true }); } catch {}
        try { this.overlayWindow.setAlwaysOnTop(true, 'screen-saver'); } catch {}
        try { this.overlayWindow.setOpacity(1.0); } catch {}

        // Load the overlay HTML
        await this.overlayWindow.loadFile(path.join(__dirname, '..', 'ptt-overlay-window.html'));

        // Handle window events
        this.overlayWindow.on('closed', () => {
            this.overlayWindow = null;
            this.isShowing = false;
        });

        // Open DevTools in development
        if (process.env.NODE_ENV === 'development' || process.argv.includes('--dev')) {
            this.overlayWindow.webContents.openDevTools();
        }

        console.log('PTT overlay window created');
        return this.overlayWindow;
    }

    /**
     * Show the PTT overlay - EXACTLY like mini overlay
     */
    public async show(): Promise<void> {
        if (!this.overlayWindow || this.overlayWindow.isDestroyed()) {
            await this.createOverlay();
        }

        if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
            this.overlayWindow.show();
            try { this.overlayWindow.moveTop(); } catch {}
            this.isShowing = true;
            console.log('PTT overlay shown');
        }
    }

    /**
     * Hide the PTT overlay
     */
    public hide(): void {
        if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
            this.overlayWindow.hide();
            this.isShowing = false;
            console.log('PTT overlay hidden');
        }
    }

    /**
     * Send audio data to the overlay for visualization
     */
    public updateAudioData(audioData: number[]): void {
        if (this.overlayWindow && !this.overlayWindow.isDestroyed() && this.isShowing) {
            this.overlayWindow.webContents.send('ptt-audio-data', audioData);
        }
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
            this.isShowing = false;
        }
    }
}
