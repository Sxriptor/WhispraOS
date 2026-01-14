import { BrowserWindow } from 'electron';
import * as path from 'path';
import { ConfigurationManager } from './ConfigurationManager';

export class VbAudioSetupOverlayManager {
  private static instance: VbAudioSetupOverlayManager;
  private overlayWindow: BrowserWindow | null = null;
  private configManager: ConfigurationManager;

  public static getInstance(): VbAudioSetupOverlayManager {
    if (!VbAudioSetupOverlayManager.instance) {
      VbAudioSetupOverlayManager.instance = new VbAudioSetupOverlayManager();
    }
    return VbAudioSetupOverlayManager.instance;
  }

  constructor() {
    this.configManager = ConfigurationManager.getInstance();
  }

  /**
   * Show the VB Audio setup overlay if it hasn't been shown before
   * Note: VB-Audio is Windows-only. On macOS, use BlackHole instead.
   */
  public async showVbAudioSetupOverlay(force: boolean = false): Promise<void> {
    // Skip on macOS - use BlackHole overlay instead
    if (process.platform === 'darwin') {
      console.log('🔊 VB Audio setup overlay skipped on macOS (use BlackHole instead)');
      return;
    }

    // Check if user has already seen this overlay
    if (!force && this.hasUserSeenSetup()) {
      console.log('🔊 VB Audio setup overlay already shown to user, skipping');
      return;
    }

    if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
      this.overlayWindow.focus();
      return;
    }

    console.log('🔊 Creating VB Audio setup overlay window');

    this.overlayWindow = new BrowserWindow({
      width: 750,
      height: 550,
      minWidth: 600,
      minHeight: 450,
      title: 'VB-Audio Setup Guide - Whispra',
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

    // Load the VB Audio setup overlay HTML
    const overlayPath = path.join(__dirname, '../vb-audio-setup-overlay.html');
    await this.overlayWindow.loadFile(overlayPath);

    // Show window when ready
    this.overlayWindow.once('ready-to-show', () => {
      if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
        this.overlayWindow.show();
        console.log('🔊 VB Audio setup overlay window shown');
      }
    });

    // Handle window closed
    this.overlayWindow.on('closed', () => {
      console.log('🔊 VB Audio setup overlay window closed');
      this.overlayWindow = null;
    });

    // Handle window close event - always mark as shown when closed
    this.overlayWindow.on('close', async () => {
      console.log('🔊 VB Audio setup overlay window closing - marking as shown');
      try {
        await this.setUserHasSeenSetup(true);
      } catch (error) {
        console.warn('Could not save VB Audio setup shown status:', error);
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
   * Close the VB Audio setup overlay
   */
  public closeVbAudioSetupOverlay(): void {
    console.log('🔊 VbAudioSetupOverlayManager.closeVbAudioSetupOverlay() called');

    if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
      console.log('🔊 Closing VB Audio setup overlay window...');
      this.overlayWindow.close();
      this.overlayWindow = null;
    }
  }

  /**
   * Check if user has already seen the VB Audio setup overlay
   */
  public hasUserSeenSetup(): boolean {
    try {
      const config = this.configManager.getConfig();
      return config.vbAudioSetupShown === true;
    } catch (error) {
      console.warn('Error checking VB Audio setup status:', error);
      return false;
    }
  }

  /**
   * Mark that user has seen the VB Audio setup overlay
   */
  public async setUserHasSeenSetup(shown: boolean = true): Promise<void> {
    try {
      await this.configManager.updateConfig({ vbAudioSetupShown: shown });
      console.log(`🔊 VB Audio setup shown status set to: ${shown}`);
    } catch (error) {
      console.error('Error saving VB Audio setup status:', error);
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