import { BrowserWindow } from 'electron';
import * as path from 'path';

export class ApiSetupOverlayManager {
  private static instance: ApiSetupOverlayManager;
  private overlayWindow: BrowserWindow | null = null;

  public static getInstance(): ApiSetupOverlayManager {
    if (!ApiSetupOverlayManager.instance) {
      ApiSetupOverlayManager.instance = new ApiSetupOverlayManager();
    }
    return ApiSetupOverlayManager.instance;
  }

  constructor() {}

  /**
   * Show the API setup overlay
   */
  public async showApiSetupOverlay(): Promise<void> {
    if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
      this.overlayWindow.focus();
      return;
    }

    console.log('🔑 Creating API setup overlay window');

    this.overlayWindow = new BrowserWindow({
      width: 750,
      height: 650,
      minWidth: 600,
      minHeight: 500,
      title: 'API Setup Guide - Whispra',
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

    // Load the API setup overlay HTML
    const overlayPath = path.join(__dirname, '../api-setup-overlay.html');
    await this.overlayWindow.loadFile(overlayPath);

    // Show window when ready
    this.overlayWindow.once('ready-to-show', () => {
      if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
        this.overlayWindow.show();
        console.log('🔑 API setup overlay window shown');
      }
    });

    // Handle window closed
    this.overlayWindow.on('closed', () => {
      console.log('🔑 API setup overlay window closed');
      this.overlayWindow = null;
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
   * Close the API setup overlay
   */
  public closeApiSetupOverlay(): void {
    console.log('🔑 ApiSetupOverlayManager.closeApiSetupOverlay() called');

    if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
      console.log('🔑 Closing API setup overlay window...');
      this.overlayWindow.close();
      this.overlayWindow = null;
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
