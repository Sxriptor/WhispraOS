import { BrowserWindow } from 'electron';
import * as path from 'path';
import { ConfigurationManager } from './ConfigurationManager';

export class BlackHoleSetupOverlayManager {
  private static instance: BlackHoleSetupOverlayManager;
  private overlayWindow: BrowserWindow | null = null;
  private configManager: ConfigurationManager;

  public static getInstance(): BlackHoleSetupOverlayManager {
    if (!BlackHoleSetupOverlayManager.instance) {
      BlackHoleSetupOverlayManager.instance = new BlackHoleSetupOverlayManager();
    }
    return BlackHoleSetupOverlayManager.instance;
  }

  constructor() {
    this.configManager = ConfigurationManager.getInstance();
  }

  /**
   * Show the BlackHole setup overlay if it hasn't been shown before
   * Note: BlackHole is macOS-only. On Windows, use VB-Audio instead.
   */
  public async showBlackHoleSetupOverlay(force: boolean = false): Promise<void> {
    // Skip on non-macOS platforms
    if (process.platform !== 'darwin') {
      console.log('🔊 BlackHole setup overlay skipped on non-macOS platform');
      return;
    }

    // Check if user has already seen this overlay
    if (!force && this.hasUserSeenSetup()) {
      console.log('🔊 BlackHole setup overlay already shown to user, skipping');
      return;
    }

    if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
      this.overlayWindow.focus();
      return;
    }

    console.log('🔊 Creating BlackHole setup overlay window');

    this.overlayWindow = new BrowserWindow({
      width: 750,
      height: 550,
      minWidth: 600,
      minHeight: 450,
      title: 'BlackHole Setup Guide - Whispra',
      resizable: true,
      minimizable: false,
      maximizable: false,
      alwaysOnTop: true,
      center: true,
      show: false,
      icon: path.join(__dirname, '../assets/favicon.ico'),
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, '../preload.js'),
        webSecurity: true,
        allowRunningInsecureContent: false,
        experimentalFeatures: false
      }
    });

    // Load the BlackHole setup overlay HTML
    const overlayPath = path.join(__dirname, '../blackhole-setup-overlay.html');
    await this.overlayWindow.loadFile(overlayPath);

    // Show window when ready
    this.overlayWindow.once('ready-to-show', () => {
      if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
        this.overlayWindow.show();
        console.log('🔊 BlackHole setup overlay window shown');
      }
    });

    // Handle window closed
    this.overlayWindow.on('closed', () => {
      console.log('🔊 BlackHole setup overlay window closed');
      this.overlayWindow = null;
    });

    // Handle window close event - always mark as shown when closed
    this.overlayWindow.on('close', async () => {
      console.log('🔊 BlackHole setup overlay window closing - marking as shown');
      try {
        await this.setUserHasSeenSetup(true);
      } catch (error) {
        console.warn('Could not save BlackHole setup shown status:', error);
      }
    });

    // Prevent navigation
    this.overlayWindow.webContents.on('will-navigate', (event) => {
      event.preventDefault();
    });

    // Prevent new window creation
    this.overlayWindow.webContents.setWindowOpenHandler(() => {
      return { action: 'deny' };
    });
  }

  /**
   * Close the BlackHole setup overlay
   */
  public closeBlackHoleSetupOverlay(): void {
    console.log('🔊 BlackHoleSetupOverlayManager.closeBlackHoleSetupOverlay() called');

    if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
      console.log('🔊 Closing BlackHole setup overlay window...');
      this.overlayWindow.close();
      this.overlayWindow = null;
    }
  }

  /**
   * Check if user has already seen the BlackHole setup overlay
   */
  public hasUserSeenSetup(): boolean {
    try {
      const config = this.configManager.getConfig();
      return config.blackHoleSetupShown === true;
    } catch (error) {
      console.warn('Error checking BlackHole setup status:', error);
      return false;
    }
  }

  /**
   * Mark that user has seen the BlackHole setup overlay
   */
  public async setUserHasSeenSetup(shown: boolean = true): Promise<void> {
    try {
      await this.configManager.updateConfig({ blackHoleSetupShown: shown });
      console.log(`🔊 BlackHole setup shown status set to: ${shown}`);
    } catch (error) {
      console.error('Error saving BlackHole setup status:', error);
      throw error;
    }
  }

  /**
   * Check if the overlay window is currently open
   */
  public isOverlayOpen(): boolean {
    return this.overlayWindow !== null && !this.overlayWindow.isDestroyed();
  }

  /**
   * Get the overlay window instance (for testing purposes)
   */
  public getOverlayWindow(): BrowserWindow | null {
    return this.overlayWindow;
  }
}
