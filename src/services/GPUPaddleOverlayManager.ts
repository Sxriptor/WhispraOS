import { BrowserWindow } from 'electron';
import * as path from 'path';

export class GPUPaddleOverlayManager {
  private static instance: GPUPaddleOverlayManager;
  private overlayWindow: BrowserWindow | null = null;

  private constructor() {}

  public static getInstance(): GPUPaddleOverlayManager {
    if (!GPUPaddleOverlayManager.instance) {
      GPUPaddleOverlayManager.instance = new GPUPaddleOverlayManager();
    }
    return GPUPaddleOverlayManager.instance;
  }

  /**
   * Show the GPU Paddle installation overlay
   */
  public async showGPUPaddleOverlay(): Promise<void> {
    if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
      this.overlayWindow.focus();
      return;
    }

    console.log('🎮 Creating GPU Paddle overlay...');

    // Find the main window to set as parent
    const mainWindow = BrowserWindow.getAllWindows().find(win =>
      !win.isDestroyed() && win.getTitle() === 'Whispra'
    );

    // Create the overlay window
    this.overlayWindow = new BrowserWindow({
      width: 600,
      height: 650,
      minWidth: 500,
      minHeight: 550,
      title: 'GPU Acceleration - Whispra',
      icon: path.join(__dirname, '../assets/favicon.ico'),
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, '../preload.js')
      },
      show: false,
      resizable: true,
      maximizable: false,
      fullscreenable: false,
      alwaysOnTop: true,
      modal: true,
      skipTaskbar: false,
      focusable: true,
      parent: mainWindow || undefined,
      backgroundColor: '#000000'
    });

    // Load the GPU Paddle overlay HTML
    const overlayPath = path.join(__dirname, '../gpu-paddle-overlay.html');
    await this.overlayWindow.loadFile(overlayPath);

    // Open DevTools in development
    if (process.env.NODE_ENV === 'development') {
      this.overlayWindow.webContents.openDevTools();
    }

    // Show the window
    this.overlayWindow.show();

    // Handle window closed
    this.overlayWindow.on('closed', () => {
      this.overlayWindow = null;
    });

    console.log('🎮 GPU Paddle overlay displayed');
  }

  /**
   * Close the GPU Paddle overlay
   */
  public closeGPUPaddleOverlay(): void {
    if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
      console.log('🎮 Closing GPU Paddle overlay...');
      this.overlayWindow.close();
      this.overlayWindow = null;
    }
  }

  /**
   * Check if overlay is currently shown
   */
  public isOverlayShown(): boolean {
    return this.overlayWindow !== null && !this.overlayWindow.isDestroyed();
  }
}
