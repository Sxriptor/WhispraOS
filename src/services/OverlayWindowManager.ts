import { BrowserWindow, screen } from 'electron';
import * as path from 'path';
import { OverlayMode, OverlaySettings } from '../types/ConfigurationTypes';
import { ConfigurationManager } from './ConfigurationManager';

/**
 * Manages the overlay window lifecycle and positioning
 */
export class OverlayWindowManager {
  private static instance: OverlayWindowManager;
  private overlayWindow: BrowserWindow | null = null;
  private configManager: ConfigurationManager;
  private currentMode: OverlayMode = OverlayMode.CLOSED;
  private recoveryTimeout: NodeJS.Timeout | null = null;

  private constructor() {
    this.configManager = ConfigurationManager.getInstance();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): OverlayWindowManager {
    if (!OverlayWindowManager.instance) {
      OverlayWindowManager.instance = new OverlayWindowManager();
    }
    return OverlayWindowManager.instance;
  }

  /**
   * Create overlay window
   */
  public async createOverlay(): Promise<BrowserWindow> {
    if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
      return this.overlayWindow;
    }

    const config = this.configManager.getConfig();
    const overlaySettings = config.uiSettings.overlaySettings;

    if (!overlaySettings) {
      throw new Error('Overlay settings not found in configuration');
    }

    // Get primary display bounds for positioning validation
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

    // Validate and adjust position if needed
    let { x, y } = overlaySettings.position;
    if (x < 0 || x > screenWidth - 200) x = 100;
    if (y < 0 || y > screenHeight - 100) y = 100;

    this.overlayWindow = new BrowserWindow({
      width: 200,
      height: 60,
      x: x,
      y: y,
      frame: false,
      transparent: true,
      backgroundColor: '#00000000',
      alwaysOnTop: overlaySettings.alwaysOnTop,
      skipTaskbar: true,
      resizable: true,
      minimizable: false,
      maximizable: false,
      closable: false,
      focusable: false,
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, '..', 'overlay-preload.js'),
        backgroundThrottling: false
      }
    });

    // Set initial click-through behavior
    // Note: On Windows 11, { forward: true } can cause input lag issues with DWM
    this.overlayWindow.setIgnoreMouseEvents(overlaySettings.clickThrough);
    try { this.overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true }); } catch {}
    try { this.overlayWindow.setAlwaysOnTop(overlaySettings.alwaysOnTop, 'screen-saver'); } catch {}
    try { this.overlayWindow.setOpacity(Math.max(0.1, Math.min(1.0, overlaySettings.opacity || 0.9))); } catch {}

    // Load overlay HTML
    await this.overlayWindow.loadFile(path.join(__dirname, '..', 'overlay.html'));

    // Handle window events
    this.overlayWindow.on('closed', () => {
      this.overlayWindow = null;
      this.currentMode = OverlayMode.CLOSED;
    });

    // Open DevTools in development
    if (process.env.NODE_ENV === 'development' || process.argv.includes('--dev')) {
      this.overlayWindow.webContents.openDevTools();
    }

    this.overlayWindow.on('moved', () => {
      if (this.overlayWindow) {
        const [x, y] = this.overlayWindow.getPosition();
        this.updatePosition(x, y);
      }
    });

    console.log('Overlay window created');
    return this.overlayWindow;
  }

  /**
   * Destroy overlay window
   */
  public destroyOverlay(): void {
    // Clear any pending recovery timeout
    if (this.recoveryTimeout) {
      clearTimeout(this.recoveryTimeout);
      this.recoveryTimeout = null;
    }

    if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
      try {
        // Remove all event listeners to prevent memory leaks
        this.overlayWindow.removeAllListeners();

        // Force close the window immediately
        this.overlayWindow.destroy();
        console.log('Overlay window destroyed');
      } catch (error) {
        console.error('Error destroying overlay window:', error);
        // If destroy fails, try force close
        try {
          this.overlayWindow.close();
        } catch (closeError) {
          console.error('Error force closing overlay window:', closeError);
        }
      }
    }

    // Always clear the reference and reset state
    this.overlayWindow = null;
    this.currentMode = OverlayMode.CLOSED;
  }

  /**
   * Force destroy overlay window (for emergency cleanup)
   */
  public forceDestroyOverlay(): void {
    console.log('Force destroying overlay window...');

    // Clear any pending recovery timeout
    if (this.recoveryTimeout) {
      clearTimeout(this.recoveryTimeout);
      this.recoveryTimeout = null;
    }

    if (this.overlayWindow) {
      try {
        // Remove all listeners first
        this.overlayWindow.removeAllListeners();

        // Force destroy the window completely
        if (!this.overlayWindow.isDestroyed()) {
          console.log('Calling window.destroy()...');
          this.overlayWindow.destroy();
        } else {
          console.log('Window already destroyed');
        }
      } catch (error) {
        console.error('Error during force destroy:', error);
        // If destroy fails, try to force close
        try {
          if (!this.overlayWindow.isDestroyed()) {
            this.overlayWindow.close();
          }
        } catch (closeError) {
          console.error('Force close also failed:', closeError);
        }
      } finally {
        // Always clear reference and reset state
        this.overlayWindow = null;
        this.currentMode = OverlayMode.CLOSED;
        console.log('Overlay window force destroy completed');
      }
    } else {
      console.log('No overlay window to destroy');
    }
  }

  /**
   * Show overlay in specified mode
   */
  public showOverlay(mode: OverlayMode): void {
    if (!this.overlayWindow || this.overlayWindow.isDestroyed()) {
      console.error('Cannot show overlay: window not created');
      return;
    }

    this.currentMode = mode;

    try {
      // Adjust window size and interactivity based on mode
      if (mode === OverlayMode.MINIMAL) {
        this.overlayWindow.setSize(200, 60);
        // Minimal: allow moving, no resize
        try { this.overlayWindow.setResizable(false); } catch {}
        // Enable hit testing so the user can drag the HUD by grabbing it
        this.overlayWindow.setIgnoreMouseEvents(false);
        // Ensure the window is focusable in minimal mode for better interaction
        try { this.overlayWindow.setFocusable(true); } catch {}
      } else if (mode === OverlayMode.EXPANDED) {
        // Static size; use a bit larger than CSS to account for borders/margins
        this.overlayWindow.setSize(520, 420);
        try { this.overlayWindow.setResizable(false); } catch {}
        this.overlayWindow.setIgnoreMouseEvents(false);
        // Ensure the window is focusable in expanded mode for controls to work
        try { this.overlayWindow.setFocusable(true); } catch {}
      }

      // Ensure on top and opacity
      const cfg = this.configManager.getConfig();
      const os = cfg.uiSettings.overlaySettings;
      try { this.overlayWindow.setAlwaysOnTop(!!os?.alwaysOnTop, 'screen-saver'); } catch {}
      try { this.overlayWindow.setOpacity(Math.max(0.1, Math.min(1.0, os?.opacity || 0.9))); } catch {}
      try { this.overlayWindow.setBackgroundColor('#00000000'); } catch {}

      // Send mode change immediately, no delay needed
      try {
        if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
          console.log(`📤 Sending mode change to overlay: ${mode}`);
          this.overlayWindow.webContents.send('overlay:mode-change', mode);
        } else {
          console.warn('Cannot send mode change: overlay window not available');
        }
      } catch (error) {
        console.error('Error sending mode change to overlay:', error);
      }

      // Show window
      this.overlayWindow.show();
      try { this.overlayWindow.moveTop(); } catch {}
      
      // Quick verification without delay
      if (this.overlayWindow && !this.overlayWindow.isDestroyed() && !this.overlayWindow.isVisible()) {
        console.warn('Overlay window failed to show, attempting to force show');
        try {
          this.overlayWindow.show();
          this.overlayWindow.focus();
        } catch {}
      }
      
      console.log(`Overlay shown in ${mode} mode`);
    } catch (error) {
      console.error('Error showing overlay:', error);
      this.recoverFromError();
    }
  }

  /**
   * Hide overlay window
   */
  public hideOverlay(): void {
    if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
      this.overlayWindow.hide();
      this.currentMode = OverlayMode.CLOSED;
      console.log('Overlay hidden');
    }
  }

  /**
   * Update overlay position and save to config
   */
  public updatePosition(x: number, y: number): void {
    const config = this.configManager.getConfig();
    if (config.uiSettings.overlaySettings) {
      config.uiSettings.overlaySettings.position = { x, y };
      this.configManager.updateConfig(config);
    }
  }

  /**
   * Get current overlay window
   */
  public getOverlayWindow(): BrowserWindow | null {
    return this.overlayWindow;
  }

  /**
   * Get current overlay mode
   */
  public getCurrentMode(): OverlayMode {
    return this.currentMode;
  }

  /**
   * Check if overlay is visible
   */
  public isVisible(): boolean {
    return !!(this.overlayWindow && !this.overlayWindow.isDestroyed() && this.overlayWindow.isVisible());
  }

  /**
   * Send data to overlay renderer
   */
  public sendToOverlay(channel: string, data: any): void {
    if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
      this.overlayWindow.webContents.send(channel, data);
    }
  }

  /**
   * Update overlay opacity
   */
  public setOpacity(opacity: number): void {
    if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
      this.overlayWindow.setOpacity(Math.max(0.1, Math.min(1.0, opacity)));
    }
  }

  /**
   * Toggle always on top
   */
  public setAlwaysOnTop(alwaysOnTop: boolean): void {
    if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
      this.overlayWindow.setAlwaysOnTop(alwaysOnTop);
    }
  }

  /**
   * Get overlay performance metrics
   */
  public getPerformanceMetrics(): any {
    if (!this.overlayWindow || this.overlayWindow.isDestroyed()) {
      return null;
    }

    try {
      const webContents = this.overlayWindow.webContents;
      return {
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage(),
        isVisible: this.overlayWindow.isVisible(),
        bounds: this.overlayWindow.getBounds(),
        mode: this.currentMode
      };
    } catch (error) {
      console.error('Error getting overlay performance metrics:', error);
      return null;
    }
  }

  /**
   * Optimize overlay for performance
   */
  public optimizePerformance(): void {
    if (!this.overlayWindow || this.overlayWindow.isDestroyed()) {
      return;
    }

    try {
      // Reduce resource usage when overlay is not visible
      if (!this.overlayWindow.isVisible()) {
        // Throttle background processes
        this.overlayWindow.webContents.setBackgroundThrottling(true);
      } else {
        // Ensure smooth performance when visible
        this.overlayWindow.webContents.setBackgroundThrottling(false);
      }

      // Limit frame rate for minimal mode
      if (this.currentMode === OverlayMode.MINIMAL) {
        this.overlayWindow.webContents.setFrameRate(30);
      } else {
        this.overlayWindow.webContents.setFrameRate(60);
      }
    } catch (error) {
      console.error('Error optimizing overlay performance:', error);
    }
  }

  /**
   * Clean up resources when overlay is hidden
   */
  public cleanupResources(): void {
    if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
      // Enable background throttling to reduce resource usage
      this.overlayWindow.webContents.setBackgroundThrottling(true);
      
      // Clear any cached data in the renderer
      this.overlayWindow.webContents.send('overlay:cleanup-resources');
    }
  }

  /**
   * Reset overlay to working state when it becomes unresponsive
   */
  public resetOverlay(): void {
    try {
      if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
        // Reset mouse events and focus state
        this.overlayWindow.setIgnoreMouseEvents(false);
        this.overlayWindow.setFocusable(true);
        
        // Refresh the overlay content
        this.overlayWindow.webContents.reload();
        
        console.log('Overlay reset completed');
      }
    } catch (error) {
      console.error('Error resetting overlay:', error);
      this.recoverFromError();
    }
  }

  /**
   * Recover from overlay errors by recreating the window
   */
  public recoverFromError(): void {
    console.log('Attempting overlay error recovery...');
    try {
      // Destroy current overlay
      this.destroyOverlay();

      // Check if app is quitting before attempting recovery
      const { app } = require('electron');
      if (app.isQuitting && app.isQuitting()) {
        console.log('App is quitting, skipping overlay recovery');
        return;
      }

      // Wait a bit then recreate
      const recoveryTimeout = setTimeout(async () => {
        try {
          // Double-check app isn't quitting before recreating
          if (app.isQuitting && app.isQuitting()) {
            console.log('App is quitting during recovery, aborting');
            return;
          }

          await this.createOverlay();
          console.log('Overlay recovered successfully');
        } catch (error) {
          console.error('Failed to recover overlay:', error);
        }
      }, 1000);

      // Store timeout reference for cleanup if needed
      this.recoveryTimeout = recoveryTimeout;
    } catch (error) {
      console.error('Error during overlay recovery:', error);
    }
  }

  /**
   * Check if overlay is responsive
   */
  public async checkResponsiveness(): Promise<boolean> {
    if (!this.overlayWindow || this.overlayWindow.isDestroyed()) {
      return false;
    }

    try {
      // Send a ping and wait for response using IPC
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          resolve(false);
        }, 2000);

        // Use ipcMain to listen for the pong response
        const { ipcMain } = require('electron');
        const pongHandler = () => {
          clearTimeout(timeout);
          ipcMain.removeListener('overlay:pong', pongHandler);
          resolve(true);
        };
        
        ipcMain.once('overlay:pong', pongHandler);

        // Send ping to overlay renderer
        if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
          this.overlayWindow.webContents.send('overlay:ping');
        } else {
          clearTimeout(timeout);
          ipcMain.removeListener('overlay:pong', pongHandler);
          resolve(false);
        }
      });
    } catch (error) {
      console.error('Error checking overlay responsiveness:', error);
      return false;
    }
  }

  /**
   * Force focus overlay window
   */
  public forceActivate(): void {
    if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
      try {
        this.overlayWindow.setAlwaysOnTop(false);
        this.overlayWindow.setAlwaysOnTop(true);
        this.overlayWindow.show();
        this.overlayWindow.focus();
        this.overlayWindow.moveTop();
      } catch (error) {
        console.error('Error force activating overlay:', error);
      }
    }
  }

  /**
   * Toggle dev tools for overlay window
   */
  public toggleDevTools(): void {
    if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
      if (this.overlayWindow.webContents.isDevToolsOpened()) {
        this.overlayWindow.webContents.closeDevTools();
        console.log('Overlay dev tools closed');
      } else {
        this.overlayWindow.webContents.openDevTools();
        console.log('Overlay dev tools opened');
      }
    } else {
      console.log('No overlay window available for dev tools');
    }
  }
}