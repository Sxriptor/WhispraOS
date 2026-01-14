import { BrowserWindow, screen } from 'electron';
import * as path from 'path';
import { OverlayMode, OverlaySettings } from '../types/ConfigurationTypes';
import { ConfigurationManager } from './ConfigurationManager';

/**
 * Manages separate mini and expanded overlay windows that can be shown simultaneously
 */
export class SplitOverlayWindowManager {
  private static instance: SplitOverlayWindowManager;
  private miniOverlayWindow: BrowserWindow | null = null;
  private expandedOverlayWindow: BrowserWindow | null = null;
  private configManager: ConfigurationManager;
  private showMini: boolean = false;
  private showExpanded: boolean = false;
  private recoveryTimeout: NodeJS.Timeout | null = null;

  private constructor() {
    this.configManager = ConfigurationManager.getInstance();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): SplitOverlayWindowManager {
    if (!SplitOverlayWindowManager.instance) {
      SplitOverlayWindowManager.instance = new SplitOverlayWindowManager();
    }
    return SplitOverlayWindowManager.instance;
  }

  /**
   * Create mini overlay window
   */
  public async createMiniOverlay(): Promise<BrowserWindow> {
    if (this.miniOverlayWindow && !this.miniOverlayWindow.isDestroyed()) {
      return this.miniOverlayWindow;
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

    this.miniOverlayWindow = new BrowserWindow({
      width: 200,
      height: 60,
      x: x,
      y: y,
      frame: false,
      transparent: true,
      backgroundColor: '#00000000',
      alwaysOnTop: overlaySettings.alwaysOnTop,
      skipTaskbar: true,
      resizable: false,
      minimizable: false,
      maximizable: false,
      closable: false,
      focusable: true,
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, '..', 'mini-overlay-preload.js'),
        backgroundThrottling: false
      }
    });

    // Mini overlay should always be interactive (never click-through)
    this.miniOverlayWindow.setIgnoreMouseEvents(false);
    try { this.miniOverlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true }); } catch {}
    try { this.miniOverlayWindow.setAlwaysOnTop(overlaySettings.alwaysOnTop, 'screen-saver'); } catch {}
    try { this.miniOverlayWindow.setOpacity(Math.max(0.1, Math.min(1.0, overlaySettings.opacity || 0.9))); } catch {}

    // Load mini overlay HTML
    await this.miniOverlayWindow.loadFile(path.join(__dirname, '..', 'mini-overlay.html'));

    // Handle window events
    this.miniOverlayWindow.on('closed', () => {
      this.miniOverlayWindow = null;
      this.showMini = false;
    });

    // Open DevTools in development
    if (process.env.NODE_ENV === 'development' || process.argv.includes('--dev')) {
      this.miniOverlayWindow.webContents.openDevTools();
    }

    this.miniOverlayWindow.on('moved', () => {
      if (this.miniOverlayWindow) {
        const [x, y] = this.miniOverlayWindow.getPosition();
        this.updatePosition(x, y);
      }
    });

    console.log('Mini overlay window created');
    return this.miniOverlayWindow;
  }

  /**
   * Create expanded overlay window
   */
  public async createExpandedOverlay(): Promise<BrowserWindow> {
    if (this.expandedOverlayWindow && !this.expandedOverlayWindow.isDestroyed()) {
      return this.expandedOverlayWindow;
    }

    const config = this.configManager.getConfig();
    const overlaySettings = config.uiSettings.overlaySettings;

    if (!overlaySettings) {
      throw new Error('Overlay settings not found in configuration');
    }

    // Get primary display bounds for positioning validation
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

    // Position expanded overlay offset from mini overlay
    let { x, y } = overlaySettings.position;
    x += 250; // Offset to the right of mini overlay
    if (x < 0 || x > screenWidth - 520) x = Math.max(0, screenWidth - 520);
    if (y < 0 || y > screenHeight - 420) y = Math.max(0, screenHeight - 420);

    this.expandedOverlayWindow = new BrowserWindow({
      width: 670,
      height: 470,
      minWidth: 670,
      maxWidth: 670,
      minHeight: 370,
      maxHeight: 820,
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
      focusable: true,
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, '..', 'expanded-overlay-preload.js'),
        backgroundThrottling: false
      }
    });

    try { this.expandedOverlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true }); } catch {}
    try { this.expandedOverlayWindow.setAlwaysOnTop(overlaySettings.alwaysOnTop, 'screen-saver'); } catch {}
    try { this.expandedOverlayWindow.setOpacity(Math.max(0.1, Math.min(1.0, overlaySettings.opacity || 0.9))); } catch {}

    // Load expanded overlay HTML
    await this.expandedOverlayWindow.loadFile(path.join(__dirname, '..', 'expanded-overlay.html'));

    // Handle window events
    this.expandedOverlayWindow.on('closed', () => {
      this.expandedOverlayWindow = null;
      this.showExpanded = false;
    });

    // Open DevTools in development
    if (process.env.NODE_ENV === 'development' || process.argv.includes('--dev')) {
      this.expandedOverlayWindow.webContents.openDevTools();
    }

    console.log('Expanded overlay window created');
    return this.expandedOverlayWindow;
  }

  /**
   * Show mini overlay
   */
  public showMiniOverlay(): void {
    if (!this.miniOverlayWindow || this.miniOverlayWindow.isDestroyed()) {
      console.error('Cannot show mini overlay: window not created');
      return;
    }

    try {
      this.showMini = true;

      // Mini overlay should always be interactive (never ignore mouse events)
      // This allows it to be draggable whether expanded is open or not
      this.miniOverlayWindow.setIgnoreMouseEvents(false);
      this.miniOverlayWindow.show();
      try { this.miniOverlayWindow.moveTop(); } catch {}

      console.log('Mini overlay shown');
    } catch (error) {
      console.error('Error showing mini overlay:', error);
    }
  }

  /**
   * Show expanded overlay
   */
  public showExpandedOverlay(): void {
    if (!this.expandedOverlayWindow || this.expandedOverlayWindow.isDestroyed()) {
      console.error('Cannot show expanded overlay: window not created');
      return;
    }

    try {
      this.showExpanded = true;
      this.expandedOverlayWindow.show();
      try { this.expandedOverlayWindow.moveTop(); } catch {}
      
      console.log('Expanded overlay shown');
    } catch (error) {
      console.error('Error showing expanded overlay:', error);
    }
  }

  /**
   * Show both overlays simultaneously
   */
  public showBothOverlays(): void {
    this.showMiniOverlay();
    this.showExpandedOverlay();
    
    // Ensure mini overlay is interactive when both are shown
    if (this.miniOverlayWindow && !this.miniOverlayWindow.isDestroyed()) {
      try {
        this.miniOverlayWindow.setIgnoreMouseEvents(false);
        this.miniOverlayWindow.setFocusable(true);
      } catch (error) {
        console.error('Error making mini overlay interactive:', error);
      }
    }
  }

  /**
   * Hide mini overlay
   */
  public hideMiniOverlay(): void {
    if (this.miniOverlayWindow && !this.miniOverlayWindow.isDestroyed()) {
      this.miniOverlayWindow.hide();
      this.showMini = false;
      console.log('Mini overlay hidden');
    }
  }

  /**
   * Hide expanded overlay
   */
  public hideExpandedOverlay(): void {
    if (this.expandedOverlayWindow && !this.expandedOverlayWindow.isDestroyed()) {
      this.expandedOverlayWindow.hide();
      this.showExpanded = false;
      console.log('Expanded overlay hidden');
    }
  }

  /**
   * Hide both overlays
   */
  public hideBothOverlays(): void {
    this.hideMiniOverlay();
    this.hideExpandedOverlay();
  }

  /**
   * Toggle overlay visibility based on mode
   */
  public toggleOverlay(mode: OverlayMode): void {
    switch (mode) {
      case OverlayMode.MINIMAL:
        if (this.showMini) {
          this.hideBothOverlays();
        } else {
          this.hideBothOverlays();
          this.showMiniOverlay();
        }
        break;

      case OverlayMode.EXPANDED:
        if (this.showExpanded) {
          this.hideBothOverlays();
        } else {
          this.showBothOverlays();
        }
        break;

      case OverlayMode.CLOSED:
      default:
        this.hideBothOverlays();
        break;
    }
  }

  /**
   * Destroy both overlay windows
   */
  public destroyOverlays(): void {
    // Clear any pending recovery timeout
    if (this.recoveryTimeout) {
      clearTimeout(this.recoveryTimeout);
      this.recoveryTimeout = null;
    }

    // Destroy mini overlay
    if (this.miniOverlayWindow && !this.miniOverlayWindow.isDestroyed()) {
      try {
        this.miniOverlayWindow.removeAllListeners();
        this.miniOverlayWindow.destroy();
        console.log('Mini overlay window destroyed');
      } catch (error) {
        console.error('Error destroying mini overlay window:', error);
      }
    }

    // Destroy expanded overlay
    if (this.expandedOverlayWindow && !this.expandedOverlayWindow.isDestroyed()) {
      try {
        this.expandedOverlayWindow.removeAllListeners();
        this.expandedOverlayWindow.destroy();
        console.log('Expanded overlay window destroyed');
      } catch (error) {
        console.error('Error destroying expanded overlay window:', error);
      }
    }

    // Always clear references and reset state
    this.miniOverlayWindow = null;
    this.expandedOverlayWindow = null;
    this.showMini = false;
    this.showExpanded = false;
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
   * Send data to mini overlay renderer
   */
  public sendToMiniOverlay(channel: string, data: any): void {
    if (this.miniOverlayWindow && !this.miniOverlayWindow.isDestroyed()) {
      this.miniOverlayWindow.webContents.send(`mini-overlay:${channel}`, data);
    }
  }

  /**
   * Send data to expanded overlay renderer
   */
  public sendToExpandedOverlay(channel: string, data: any): void {
    if (this.expandedOverlayWindow && !this.expandedOverlayWindow.isDestroyed()) {
      this.expandedOverlayWindow.webContents.send(`expanded-overlay:${channel}`, data);
    }
  }

  /**
   * Send data to both overlays
   */
  public sendToBothOverlays(channel: string, data: any): void {
    this.sendToMiniOverlay(channel, data);
    this.sendToExpandedOverlay(channel, data);
  }

  /**
   * Update overlay opacity for both windows
   */
  public setOpacity(opacity: number): void {
    const validOpacity = Math.max(0.1, Math.min(1.0, opacity));
    
    if (this.miniOverlayWindow && !this.miniOverlayWindow.isDestroyed()) {
      this.miniOverlayWindow.setOpacity(validOpacity);
    }
    
    if (this.expandedOverlayWindow && !this.expandedOverlayWindow.isDestroyed()) {
      this.expandedOverlayWindow.setOpacity(validOpacity);
    }
  }

  /**
   * Toggle always on top for both windows
   */
  public setAlwaysOnTop(alwaysOnTop: boolean): void {
    if (this.miniOverlayWindow && !this.miniOverlayWindow.isDestroyed()) {
      this.miniOverlayWindow.setAlwaysOnTop(alwaysOnTop);
    }
    
    if (this.expandedOverlayWindow && !this.expandedOverlayWindow.isDestroyed()) {
      this.expandedOverlayWindow.setAlwaysOnTop(alwaysOnTop);
    }
  }

  /**
   * Get current overlay windows
   */
  public getMiniOverlayWindow(): BrowserWindow | null {
    return this.miniOverlayWindow;
  }

  public getExpandedOverlayWindow(): BrowserWindow | null {
    return this.expandedOverlayWindow;
  }

  /**
   * Resize expanded overlay window to fit content (height only)
   */
  public resizeExpandedOverlay(width: number, height: number): void {
    if (!this.expandedOverlayWindow || this.expandedOverlayWindow.isDestroyed()) {
      return;
    }

    try {
      // Get current window position
      const [currentX, currentY] = this.expandedOverlayWindow.getPosition();

      // Fixed width, variable height only
      const fixedWidth = 670;
      const constrainedHeight = Math.max(370, Math.min(820, height));

      // Resize the window with fixed width
      this.expandedOverlayWindow.setBounds({
        x: currentX,
        y: currentY,
        width: fixedWidth, // Always use fixed width
        height: constrainedHeight // Constrained height
      });

      console.log(`Expanded overlay resized to ${fixedWidth}x${constrainedHeight} (requested: ${width}x${height})`);
    } catch (error) {
      console.error('Error resizing expanded overlay:', error);
    }
  }

  /**
   * Check if overlays are visible
   */
  public isMiniVisible(): boolean {
    return !!(this.miniOverlayWindow && !this.miniOverlayWindow.isDestroyed() && this.miniOverlayWindow.isVisible());
  }

  public isExpandedVisible(): boolean {
    return !!(this.expandedOverlayWindow && !this.expandedOverlayWindow.isDestroyed() && this.expandedOverlayWindow.isVisible());
  }

  public areBothVisible(): boolean {
    return this.isMiniVisible() && this.isExpandedVisible();
  }

  /**
   * Clean up resources when overlays are hidden
   */
  public cleanupResources(): void {
    if (this.miniOverlayWindow && !this.miniOverlayWindow.isDestroyed()) {
      this.miniOverlayWindow.webContents.setBackgroundThrottling(true);
      this.miniOverlayWindow.webContents.send('mini-overlay:cleanup-resources');
    }
    
    if (this.expandedOverlayWindow && !this.expandedOverlayWindow.isDestroyed()) {
      this.expandedOverlayWindow.webContents.setBackgroundThrottling(true);
      this.expandedOverlayWindow.webContents.send('expanded-overlay:cleanup-resources');
    }
  }

  /**
   * Check if both overlays are responsive
   */
  public async checkResponsiveness(): Promise<{ mini: boolean; expanded: boolean }> {
    const checkMini = this.checkMiniResponsiveness();
    const checkExpanded = this.checkExpandedResponsiveness();
    
    const [mini, expanded] = await Promise.all([checkMini, checkExpanded]);
    
    return { mini, expanded };
  }

  private async checkMiniResponsiveness(): Promise<boolean> {
    if (!this.miniOverlayWindow || this.miniOverlayWindow.isDestroyed()) {
      return false;
    }

    try {
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          resolve(false);
        }, 2000);

        const { ipcMain } = require('electron');
        const pongHandler = () => {
          clearTimeout(timeout);
          ipcMain.removeListener('mini-overlay:pong', pongHandler);
          resolve(true);
        };
        
        ipcMain.once('mini-overlay:pong', pongHandler);

        if (this.miniOverlayWindow && !this.miniOverlayWindow.isDestroyed()) {
          this.miniOverlayWindow.webContents.send('mini-overlay:ping');
        } else {
          clearTimeout(timeout);
          ipcMain.removeListener('mini-overlay:pong', pongHandler);
          resolve(false);
        }
      });
    } catch (error) {
      console.error('Error checking mini overlay responsiveness:', error);
      return false;
    }
  }

  private async checkExpandedResponsiveness(): Promise<boolean> {
    if (!this.expandedOverlayWindow || this.expandedOverlayWindow.isDestroyed()) {
      return false;
    }

    try {
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          resolve(false);
        }, 2000);

        const { ipcMain } = require('electron');
        const pongHandler = () => {
          clearTimeout(timeout);
          ipcMain.removeListener('expanded-overlay:pong', pongHandler);
          resolve(true);
        };
        
        ipcMain.once('expanded-overlay:pong', pongHandler);

        if (this.expandedOverlayWindow && !this.expandedOverlayWindow.isDestroyed()) {
          this.expandedOverlayWindow.webContents.send('expanded-overlay:ping');
        } else {
          clearTimeout(timeout);
          ipcMain.removeListener('expanded-overlay:pong', pongHandler);
          resolve(false);
        }
      });
    } catch (error) {
      console.error('Error checking expanded overlay responsiveness:', error);
      return false;
    }
  }

  /**
   * Toggle dev tools for both overlay windows
   */
  public toggleDevTools(): void {
    if (this.miniOverlayWindow && !this.miniOverlayWindow.isDestroyed()) {
      if (this.miniOverlayWindow.webContents.isDevToolsOpened()) {
        this.miniOverlayWindow.webContents.closeDevTools();
      } else {
        this.miniOverlayWindow.webContents.openDevTools();
      }
    }

    if (this.expandedOverlayWindow && !this.expandedOverlayWindow.isDestroyed()) {
      if (this.expandedOverlayWindow.webContents.isDevToolsOpened()) {
        this.expandedOverlayWindow.webContents.closeDevTools();
      } else {
        this.expandedOverlayWindow.webContents.openDevTools();
      }
    }
  }

  /**
   * Update mini overlay audio detection indicator
   */
  public updateAudioDetected(isDetected: boolean): void {
    this.sendToMiniOverlay('audio-detected', isDetected);
  }

  /**
   * Update mini overlay voice translation indicator
   */
  public updateVoiceTranslation(isActive: boolean): void {
    this.sendToMiniOverlay('voice-translation', isActive);
  }

  /**
   * Update mini overlay screen translation indicator
   * @param state 'off' | 'processing' | 'showing'
   */
  public updateScreenTranslation(state: 'off' | 'processing' | 'showing'): void {
    this.sendToMiniOverlay('screen-translation', state);
  }

  /**
   * Update mini overlay status text
   */
  public updateMiniOverlayStatus(status: string): void {
    this.sendToMiniOverlay('status-update', status);
  }
}