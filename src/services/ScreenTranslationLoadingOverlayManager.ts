import { BrowserWindow, screen } from 'electron';
import * as path from 'path';

export class ScreenTranslationLoadingOverlayManager {
    private static instance: ScreenTranslationLoadingOverlayManager;
    private overlayWindow: BrowserWindow | null = null;
    private isShowing = false;

    private constructor() {}

    public static getInstance(): ScreenTranslationLoadingOverlayManager {
        if (!ScreenTranslationLoadingOverlayManager.instance) {
            ScreenTranslationLoadingOverlayManager.instance = new ScreenTranslationLoadingOverlayManager();
        }
        return ScreenTranslationLoadingOverlayManager.instance;
    }

    /**
     * Create the loading overlay window - EXACTLY like PTT overlay
     */
    public async createOverlay(): Promise<BrowserWindow> {
        if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
            return this.overlayWindow;
        }

        // Get primary display bounds for positioning - EXACTLY like PTT overlay
        const primaryDisplay = screen.getPrimaryDisplay();
        const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

        // Calculate position for top-center of screen - EXACTLY like PTT overlay
        const overlayWidth = 200;
        const overlayHeight = 50;
        const x = Math.floor((screenWidth - overlayWidth) / 2);
        const y = 8; // 8px from top - EXACTLY like PTT overlay

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
                preload: path.join(__dirname, '..', 'screen-translation-loading-overlay-preload.js'),
                backgroundThrottling: false
            }
        });

        // Make it click-through
        this.overlayWindow.setIgnoreMouseEvents(true);
        
        // Set always on top - EXACTLY like PTT overlay
        try { this.overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true }); } catch {}
        try { this.overlayWindow.setAlwaysOnTop(true, 'screen-saver'); } catch {}
        try { this.overlayWindow.setOpacity(1.0); } catch {}

        // Load the overlay HTML
        await this.overlayWindow.loadFile(path.join(__dirname, '..', 'screen-translation-loading-overlay.html'));

        // Handle window events
        this.overlayWindow.on('closed', () => {
            this.overlayWindow = null;
            this.isShowing = false;
        });

        console.log('Screen translation loading overlay window created');
        return this.overlayWindow;
    }

    /**
     * Show the loading overlay with a message
     */
    public async show(message: string = 'Processing...'): Promise<void> {
        if (!this.overlayWindow || this.overlayWindow.isDestroyed()) {
            await this.createOverlay();
        }

        if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
            // Send message to overlay
            this.overlayWindow.webContents.send('screen-translation-loading:update-message', message);
            this.overlayWindow.show();
            try { this.overlayWindow.moveTop(); } catch {}
            this.isShowing = true;
            console.log('Screen translation loading overlay shown:', message);
        }
    }

    /**
     * Hide the loading overlay
     */
    public hide(): void {
        if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
            this.overlayWindow.hide();
            this.isShowing = false;
            console.log('Screen translation loading overlay hidden');
        }
    }

    /**
     * Update the message shown in the overlay
     */
    public updateMessage(message: string): void {
        if (this.overlayWindow && !this.overlayWindow.isDestroyed() && this.isShowing) {
            this.overlayWindow.webContents.send('screen-translation-loading:update-message', message);
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

