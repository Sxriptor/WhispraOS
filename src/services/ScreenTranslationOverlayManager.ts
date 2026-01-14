import { BrowserWindow, screen, Display } from 'electron';
import * as path from 'path';

interface OCRTextBox {
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  translatedText?: string;
  confidence?: number;
  sourceLanguage?: string;
  targetLanguage?: string;
}

interface OverlayData {
  textBoxes: OCRTextBox[];
  displayId: string;
  captureDPR: number;
  displayDPR: number;
  displayBounds: { x: number; y: number; width: number; height: number };
}

interface OverlayWindow {
  window: BrowserWindow;
  displayId: string;
  bounds: { x: number; y: number; width: number; height: number }; // workArea bounds
}

export class ScreenTranslationOverlayManager {
  private static instance: ScreenTranslationOverlayManager;
  private overlayWindows: Map<string, OverlayWindow> = new Map();
  private isActive: boolean = false;
  private levelRefreshInterval: NodeJS.Timeout | null = null;

  public static getInstance(): ScreenTranslationOverlayManager {
    if (!ScreenTranslationOverlayManager.instance) {
      ScreenTranslationOverlayManager.instance = new ScreenTranslationOverlayManager();
    }
    return ScreenTranslationOverlayManager.instance;
  }

  /**
   * Check if there are any overlay windows currently open
   */
  public hasOverlayWindows(): boolean {
    return this.overlayWindows.size > 0;
  }

  /**
   * Start the screen translation overlay system
   */
  public async startOverlay(): Promise<void> {
    if (this.isActive) {
      console.log('📺 Screen translation overlay already active');
      return;
    }

    console.log('📺 Starting screen translation overlay system...');
    await this.createOverlayWindows();
    this.isActive = true;
    
    // Start periodic refresh to ensure overlays stay above fullscreen apps
    this.startLevelRefresh();
    
    console.log('📺 Screen translation overlay system started');
  }

  /**
   * Stop the screen translation overlay system
   */
  public async stopOverlay(): Promise<void> {
    if (!this.isActive) {
      console.log('📺 Screen translation overlay already inactive');
      return;
    }

    console.log('📺 Stopping screen translation overlay system...');

    // Force immediate hide of all overlay windows first
    for (const [displayId, overlay] of this.overlayWindows) {
      try {
        if (!overlay.window.isDestroyed()) {
          console.log(`📺 Immediately hiding overlay for display ${displayId}`);
          overlay.window.hide();
          // Also clear any content to ensure it's not visible
          await overlay.window.webContents.executeJavaScript(`
            if (window.clearAllText) {
              window.clearAllText();
            }
            // Hide all elements
            document.body.style.display = 'none';
          `).catch(() => {});
        }
      } catch (error) {
        console.error(`📺 Error hiding overlay for display ${displayId}:`, error);
      }
    }

    // Stop level refresh
    this.stopLevelRefresh();
    
    // Then destroy the windows
    await this.destroyOverlayWindows();
    this.isActive = false;
    console.log('📺 Screen translation overlay system stopped');
  }

  /**
   * Update overlay with new OCR results
   */
  public async updateOverlay(data: OverlayData): Promise<void> {
    if (!this.isActive) {
      console.warn('📺 Cannot update overlay - system not active');
      return;
    }

    let overlay = this.overlayWindows.get(data.displayId);
    if (!overlay) {
      console.log(`📺 No overlay found for display ${data.displayId}, creating one...`);
      // Create overlay for this specific display if it doesn't exist
      await this.createOverlayForDisplay(data.displayId);
      overlay = this.overlayWindows.get(data.displayId);

      if (!overlay) {
        console.error(`📺 Failed to create overlay for display ${data.displayId}`);
        return;
      }

      // Wait for the overlay to be fully ready
      console.log(`📺 Waiting for overlay ${data.displayId} to be ready...`);
      await this.waitForOverlayReady(overlay.window);
    }

    // Log translation data for debugging
    const translatedCount = data.textBoxes.filter(box => box.translatedText && box.translatedText !== box.text).length;
    console.log(`📺 Updating overlay ${data.displayId} with ${data.textBoxes.length} text boxes (${translatedCount} translated)`);

    // CRITICAL: Force window to be visible and shown BEFORE sending data
    console.log(`📺 Checking overlay window ${data.displayId} visibility...`);
    const wasVisible = overlay.window.isVisible();
    console.log(`📺 Window was visible: ${wasVisible}`);
    
    if (!wasVisible) {
      console.log(`📺 Overlay window ${data.displayId} not visible, showing it...`);
      overlay.window.show();
      // Wait for window to be ready
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    // Force window to be on top
    try {
      overlay.window.setAlwaysOnTop(true, 'screen-saver', 1);
    } catch {
      overlay.window.setAlwaysOnTop(true);
    }

    // Log window state for debugging
    console.log(`📺 Overlay window ${data.displayId} final state:`, {
      isVisible: overlay.window.isVisible(),
      isDestroyed: overlay.window.isDestroyed(),
      bounds: overlay.window.getBounds(),
      alwaysOnTop: overlay.window.isAlwaysOnTop(),
      webContentsReady: overlay.window.webContents.isLoading() ? 'loading' : 'ready'
    });

    // Send the OCR data to the overlay renderer via IPC
    console.log(`📺 Sending IPC message 'screen-translation:update-text-boxes' to overlay ${data.displayId} with ${data.textBoxes.length} text boxes`);
    console.log(`📺 Data being sent:`, JSON.stringify(data, null, 2));
    
    try {
      overlay.window.webContents.send('screen-translation:update-text-boxes', data);
      console.log(`✅ IPC message sent successfully to overlay ${data.displayId}`);
      
      // Also try direct function call as backup to ensure it works
      try {
        console.log(`📺 Attempting direct function call as backup...`);
        const result = await overlay.window.webContents.executeJavaScript(`
          (function() {
            console.log('📺 Direct function call executing...');
            if (window.updateOCRResults) {
              const data = ${JSON.stringify(data)};
              console.log('📺 Calling updateOCRResults with data:', data);
              window.updateOCRResults(data);
              return 'success - updateOCRResults called';
            } else {
              console.error('📺 window.updateOCRResults not found!');
              return 'error - updateOCRResults not found';
            }
          })();
        `);
        console.log(`📺 Direct function call result:`, result);
      } catch (jsError) {
        console.error(`📺 Direct function call failed:`, jsError);
      }
    } catch (error) {
      console.error('📺 Error sending via IPC, trying executeJavaScript fallback:', error);
      // Fallback to direct function call
      try {
        await overlay.window.webContents.executeJavaScript(`
          if (window.updateOCRResults) {
            window.updateOCRResults(${JSON.stringify(data)});
          } else {
            console.error('📺 updateOCRResults function not found');
          }
        `);
        console.log(`📺 Sent data via executeJavaScript to overlay ${data.displayId}`);
      } catch (fallbackError) {
        console.error('📺 Both IPC and executeJavaScript failed:', fallbackError);
      }
    }
  }

  /**
   * Wait for overlay window to be ready
   */
  private async waitForOverlayReady(window: BrowserWindow): Promise<void> {
    return new Promise((resolve) => {
      if (window.webContents.isLoading()) {
        window.webContents.once('did-finish-load', () => {
          console.log('📺 Overlay window finished loading');
          // Give it a small delay to ensure everything is initialized
          setTimeout(resolve, 100);
        });
      } else {
        // Already loaded, just wait a bit
        setTimeout(resolve, 100);
      }
    });
  }

  /**
   * Create overlay for a specific display
   */
  public async createOverlayForDisplay(displayId: string): Promise<void> {
    const { screen } = require('electron');
    const allDisplays = screen.getAllDisplays();
    // Sort displays consistently with UI ordering
    const displays = allDisplays.sort((a: any, b: any) => {
      if (a.bounds.x !== b.bounds.x) return a.bounds.x - b.bounds.x;
      return a.bounds.y - b.bounds.y;
    });

    console.log(`📺 Looking for display ${displayId} in sorted displays:`, displays.map((d: Display) => ({ id: d.id, bounds: d.bounds })));
    const targetDisplay = displays.find((d: Display) => d.id.toString() === displayId);

    if (!targetDisplay) {
      console.error(`📺 Display ${displayId} not found`);
      return;
    }

    // Skip if overlay already exists for this display
    if (this.overlayWindows.has(displayId)) {
      console.log(`📺 Overlay already exists for display ${displayId}`);
      return;
    }

    console.log(`📺 Creating overlay for display ${displayId}:`, {
      id: targetDisplay.id,
      bounds: targetDisplay.bounds,
      workArea: targetDisplay.workArea,
      primary: targetDisplay.primary,
      label: targetDisplay.label
    });

    const overlayWindow = new BrowserWindow({
      x: targetDisplay.workArea.x,
      y: targetDisplay.workArea.y,
      width: targetDisplay.workArea.width,
      height: targetDisplay.workArea.height,
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      closable: false,
      focusable: false,
      hasShadow: false,
      enableLargerThanScreen: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, '../screen-translation-overlay-preload.js'),
        webSecurity: false,
        allowRunningInsecureContent: true
      },
      show: false
    });

    // Make window click-through
    // Note: On Windows 11, { forward: true } can cause input lag issues with DWM
    // Using simple click-through without forwarding is more stable
    overlayWindow.setIgnoreMouseEvents(true);

    // Load the overlay HTML
    const overlayPath = path.join(__dirname, '../screen-translation-overlay.html');
    await overlayWindow.loadFile(overlayPath);

    // Show the window
    overlayWindow.show();

    // Force maximum window level for fullscreen app compatibility
    try {
      overlayWindow.setAlwaysOnTop(true, 'screen-saver', 1);
    } catch (error) {
      console.warn('📺 Could not set screen-saver level, using normal alwaysOnTop');
      overlayWindow.setAlwaysOnTop(true);
    }

    // Verify window is visible
    console.log(`📺 Overlay window properties:`, {
      isVisible: overlayWindow.isVisible(),
      isDestroyed: overlayWindow.isDestroyed(),
      bounds: overlayWindow.getBounds(),
      alwaysOnTop: overlayWindow.isAlwaysOnTop()
    });

    // Store the overlay
    this.overlayWindows.set(displayId, {
      window: overlayWindow,
      displayId: displayId,
      bounds: targetDisplay.workArea
    });

    // Handle window events
    overlayWindow.on('closed', () => {
      this.overlayWindows.delete(displayId);
    });

    // Open DevTools in development
    if (process.env.NODE_ENV === 'development') {
      overlayWindow.webContents.openDevTools();
    }

    console.log(`📺 Overlay created for display ${displayId}`);
  }

  /**
   * Create overlay windows for all displays
   */
  private async createOverlayWindows(): Promise<void> {
    const allDisplays = screen.getAllDisplays();
    const displays = allDisplays.sort((a, b) => {
      if (a.bounds.x !== b.bounds.x) return a.bounds.x - b.bounds.x;
      return a.bounds.y - b.bounds.y;
    });

    for (const display of displays as Display[]) {
      const displayId = display.id.toString();

      // Skip if overlay already exists for this display
      if (this.overlayWindows.has(displayId)) {
        continue;
      }

      console.log(`📺 Creating overlay for display ${displayId}:`, display.bounds);

      const overlayWindow = new BrowserWindow({
        x: display.workArea.x,
        y: display.workArea.y,
        width: display.workArea.width,
        height: display.workArea.height,
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        skipTaskbar: true,
        resizable: false,
        movable: false,
        minimizable: false,
        maximizable: false,
        closable: false,
        focusable: false,
        hasShadow: false,
        enableLargerThanScreen: true,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          preload: path.join(__dirname, '../screen-translation-overlay-preload.js'),
          webSecurity: false,
          allowRunningInsecureContent: true
        },
        show: false
      });

      // Make window click-through
      // Note: On Windows 11, { forward: true } can cause input lag issues with DWM
      // Using simple click-through without forwarding is more stable
      overlayWindow.setIgnoreMouseEvents(true);

      // Load the overlay HTML
      const overlayPath = path.join(__dirname, '../screen-translation-overlay.html');
      await overlayWindow.loadFile(overlayPath);

      // Show the window
      overlayWindow.show();

      // Force maximum window level for fullscreen app compatibility
      try {
        overlayWindow.setAlwaysOnTop(true, 'screen-saver', 1);
      } catch (error) {
        console.warn('📺 Could not set screen-saver level, using normal alwaysOnTop');
        overlayWindow.setAlwaysOnTop(true);
      }

      // Store the overlay
      this.overlayWindows.set(displayId, {
        window: overlayWindow,
        displayId: displayId,
        bounds: display.workArea
      });

      // Handle window events
      overlayWindow.on('closed', () => {
        this.overlayWindows.delete(displayId);
      });

      // Open DevTools in development
      if (process.env.NODE_ENV === 'development') {
        overlayWindow.webContents.openDevTools({ mode: 'detach' });
      }
    }
  }

  /**
   * Destroy all overlay windows
   */
  private async destroyOverlayWindows(): Promise<void> {
    console.log(`📺 Destroying ${this.overlayWindows.size} overlay windows...`);

    for (const [displayId, overlay] of this.overlayWindows) {
      try {
        if (!overlay.window.isDestroyed()) {
          console.log(`📺 Destroying overlay window for display ${displayId}`);

          // Force hide before closing
          overlay.window.hide();

          // Clear all content immediately
          await overlay.window.webContents.executeJavaScript(`
            try {
              if (window.clearAllText) {
                window.clearAllText();
              }
              // Hide everything
              document.body.innerHTML = '';
              document.body.style.display = 'none';
            } catch (e) {
              console.error('Error clearing overlay content:', e);
            }
          `).catch(() => {});

          // Close the window
          overlay.window.close();

          console.log(`📺 Overlay window for display ${displayId} destroyed`);
        }
      } catch (error) {
        console.error(`📺 Error closing overlay for display ${displayId}:`, error);
      }
    }
    this.overlayWindows.clear();
    console.log('📺 All overlay windows destroyed');
  }

  /**
   * Handle display changes (monitor connected/disconnected)
   */
  public async handleDisplayChange(): Promise<void> {
    if (!this.isActive) {
      return;
    }

    console.log('📺 Display configuration changed, updating overlays...');

    // Get current displays and sort them consistently
    const allCurrentDisplays = screen.getAllDisplays();
    const currentDisplays = allCurrentDisplays.sort((a, b) => {
      if (a.bounds.x !== b.bounds.x) return a.bounds.x - b.bounds.x;
      return a.bounds.y - b.bounds.y;
    });
    const currentDisplayIds = new Set(currentDisplays.map(d => d.id.toString()));

    // Remove overlays for disconnected displays
    for (const [displayId, overlay] of this.overlayWindows) {
      if (!currentDisplayIds.has(displayId)) {
        console.log(`📺 Removing overlay for disconnected display ${displayId}`);
        try {
          if (!overlay.window.isDestroyed()) {
            overlay.window.close();
          }
        } catch (error) {
          console.error(`📺 Error removing overlay for display ${displayId}:`, error);
        }
        this.overlayWindows.delete(displayId);
      }
    }

    // Create overlays for new displays
    await this.createOverlayWindows();
  }

  /**
   * Check if overlay system is active
   */
  public isOverlayActive(): boolean {
    return this.isActive;
  }

  /**
   * Get overlay window for a specific display
   */
  public getOverlayForDisplay(displayId: string): OverlayWindow | undefined {
    return this.overlayWindows.get(displayId);
  }

  /**
   * Clear all text from overlays
   */
  public async clearAllOverlays(): Promise<void> {
    console.log('📺 Clearing all overlay content...');
    for (const overlay of this.overlayWindows.values()) {
      try {
        // Ensure window is still visible and ready
        if (overlay.window.isDestroyed()) {
          console.warn(`📺 Overlay window destroyed, skipping clear`);
          continue;
        }
        
        // Make sure window is visible before clearing
        if (!overlay.window.isVisible()) {
          overlay.window.show();
        }
        
        await overlay.window.webContents.executeJavaScript(`
          if (window.clearAllText) {
            window.clearAllText();
          }
          // DO NOT hide the body - we need it visible for next update!
          // Just clear the text content, keep body visible
        `);
        console.log('📺 Overlay content cleared');
      } catch (error) {
        console.error('📺 Error clearing overlay:', error);
      }
    }
  }

  /**
   * Force immediate cleanup of all overlays
   */
  public async forceCleanup(): Promise<void> {
    console.log('📺 Force cleaning up all overlays immediately...');

    // Stop level refresh
    this.stopLevelRefresh();

    // Hide all overlays first
    for (const [displayId, overlay] of this.overlayWindows) {
      try {
        if (!overlay.window.isDestroyed()) {
          overlay.window.hide();
          console.log(`📺 Force hid overlay for display ${displayId}`);
        }
      } catch (error) {
        console.error(`📺 Error force hiding overlay for display ${displayId}:`, error);
      }
    }

    // Clear all content
    await this.clearAllOverlays();

    // Then destroy windows
    await this.destroyOverlayWindows();

    this.isActive = false;
    console.log('📺 Force cleanup completed');
  }

  /**
   * Update overlay language settings
   */
  public async updateLanguageSettings(sourceLanguage: string, targetLanguage: string): Promise<void> {
    console.log(`📺 Updating overlay language settings: ${sourceLanguage} → ${targetLanguage}`);

    for (const overlay of this.overlayWindows.values()) {
      try {
        await overlay.window.webContents.executeJavaScript(`
          if (window.updateLanguageSettings) {
            window.updateLanguageSettings('${sourceLanguage}', '${targetLanguage}');
          }
        `);
      } catch (error) {
        console.error('📺 Error updating language settings in overlay:', error);
      }
    }
  }

  /**
   * Toggle debug mode in overlays
   */
  public async toggleDebugMode(): Promise<void> {
    for (const overlay of this.overlayWindows.values()) {
      try {
        await overlay.window.webContents.executeJavaScript(`
          if (window.toggleDebugMode) {
            window.toggleDebugMode();
          }
        `);
      } catch (error) {
        console.error('📺 Error toggling debug mode in overlay:', error);
      }
    }
  }

  /**
   * Set overlay theme
   */
  public async setTheme(theme: 'light' | 'dark' | 'auto'): Promise<void> {
    for (const overlay of this.overlayWindows.values()) {
      try {
        await overlay.window.webContents.executeJavaScript(`
          if (window.setTheme) {
            window.setTheme('${theme}');
          }
        `);
      } catch (error) {
        console.error('📺 Error setting theme in overlay:', error);
      }
    }
  }

  /**
   * Force all overlays to maximum z-index level
   * Call this periodically to ensure overlays stay above fullscreen apps
   */
  public forceMaximumLevel(): void {
    for (const [displayId, overlay] of this.overlayWindows) {
      try {
        if (!overlay.window.isDestroyed()) {
          // Force maximum window level
          overlay.window.setAlwaysOnTop(true, 'screen-saver', 1);
        }
      } catch (error) {
        console.warn(`📺 Could not force maximum level for overlay ${displayId}:`, error);
        try {
          overlay.window.setAlwaysOnTop(true);
        } catch (fallbackError) {
          console.error(`📺 Failed to set alwaysOnTop for overlay ${displayId}:`, fallbackError);
        }
      }
    }
  }

  /**
   * Start periodic refresh to keep overlays at maximum level
   */
  private startLevelRefresh(): void {
    if (this.levelRefreshInterval) {
      clearInterval(this.levelRefreshInterval);
    }
    
    // Refresh every 5 seconds to ensure overlays stay above fullscreen apps
    this.levelRefreshInterval = setInterval(() => {
      if (this.isActive && this.overlayWindows.size > 0) {
        this.forceMaximumLevel();
      }
    }, 5000);
    
    console.log('📺 Started level refresh interval');
  }

  /**
   * Stop periodic level refresh
   */
  private stopLevelRefresh(): void {
    if (this.levelRefreshInterval) {
      clearInterval(this.levelRefreshInterval);
      this.levelRefreshInterval = null;
      console.log('📺 Stopped level refresh interval');
    }
  }
}