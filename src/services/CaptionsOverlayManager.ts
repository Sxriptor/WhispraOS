import { BrowserWindow, screen } from 'electron';
import * as path from 'path';

export interface CaptionsSettings {
  enabled: boolean;
  textColor: 'white' | 'black';
  background: 'none' | 'white' | 'black';
  fontSize: 'small' | 'medium' | 'large' | 'xlarge';
  position?: { x: number; y: number };
}

export class CaptionsOverlayManager {
  private static instance: CaptionsOverlayManager | null = null;
  private overlayWindow: BrowserWindow | null = null;
  private isVisible: boolean = false;
  private hideTimeout: NodeJS.Timeout | null = null;
  private showDelayTimeout: NodeJS.Timeout | null = null;
  private pendingText: string | null = null;
  private settings: CaptionsSettings = {
    enabled: false,
    textColor: 'white',
    background: 'none',
    fontSize: 'medium'
  };
  private textChunks: string[] = [];
  private maxChunks: number = 3;
  private captionDelayMs: number = 250; // Delay before showing captions (in milliseconds)

  private constructor() {
    // Settings will be loaded via updateSettings from the renderer
  }

  public static getInstance(): CaptionsOverlayManager {
    if (!CaptionsOverlayManager.instance) {
      CaptionsOverlayManager.instance = new CaptionsOverlayManager();
    }
    return CaptionsOverlayManager.instance;
  }

  public async createOverlay(): Promise<void> {
    if (this.overlayWindow) {
      return;
    }

    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize;

    // Use saved position or default position
    const x = this.settings.position?.x ?? Math.floor(width * 0.1);
    const y = this.settings.position?.y ?? Math.floor(height * 0.8);

    this.overlayWindow = new BrowserWindow({
      width: Math.floor(width * 0.8),
      height: 120,
      x,
      y,
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      movable: true,
      minimizable: false,
      maximizable: false,
      closable: false,
      focusable: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: true
      }
    });

    // Load the captions overlay HTML
    const htmlPath = path.join(__dirname, '..', 'captions-overlay.html');
    await this.overlayWindow.loadFile(htmlPath);

    // Apply current settings
    await this.applySettings();

    // Handle window events
    this.overlayWindow.on('closed', () => {
      this.overlayWindow = null;
      this.isVisible = false;
    });

    // Save position when moved and persist to config
    this.overlayWindow.on('moved', () => {
      if (this.overlayWindow) {
        const [x, y] = this.overlayWindow.getPosition();
        this.settings.position = { x, y };
        this.savePositionToConfig();
      }
    });

    // Initially hide the window until captions are actually shown
    this.overlayWindow.hide();
    this.isVisible = false;

    console.log('📺 Captions overlay created');
  }

  public async destroyOverlay(): Promise<void> {
    if (this.overlayWindow) {
      this.overlayWindow.destroy();
      this.overlayWindow = null;
      console.log('📺 Captions overlay destroyed');
    }
  }

  public async updateSettings(newSettings: Partial<CaptionsSettings>): Promise<void> {
    console.log('📺 CaptionsOverlayManager.updateSettings called with:', newSettings);
    console.log('📺 Current settings before update:', this.settings);

    this.settings = { ...this.settings, ...newSettings };

    // Check if captions should be enabled (either explicitly enabled in newSettings or already enabled in current settings)
    const shouldBeEnabled = this.settings.enabled;

    console.log('📺 Should be enabled:', shouldBeEnabled);
    console.log('📺 Overlay window exists:', !!this.overlayWindow);

    if (shouldBeEnabled && !this.overlayWindow) {
      console.log('📺 Creating overlay window because captions should be enabled');
      // Create overlay but keep it hidden until captions are actually shown
      await this.createOverlay();
    } else if (!shouldBeEnabled && this.overlayWindow) {
      console.log('📺 Destroying overlay window because captions should be disabled');
      await this.destroyOverlay();
      this.isVisible = false;
    } else if (this.overlayWindow) {
      console.log('📺 Applying settings to existing overlay window');
      await this.applySettings();
    } else {
      console.log('📺 No action needed - overlay window state matches enabled state');
    }

    console.log('📺 Final settings after update:', this.settings);
  }

  private async applySettings(): Promise<void> {
    if (!this.overlayWindow) return;

    try {
      await this.overlayWindow.webContents.executeJavaScript(`
        if (window.captionsAPI && window.captionsAPI.applySettings) {
          window.captionsAPI.applySettings(${JSON.stringify(this.settings)});
        }
      `);
    } catch (error) {
      console.error('Failed to apply captions settings:', error);
    }
  }

  public async updateCaptions(text: string): Promise<void> {
    console.log('📺 CaptionsOverlayManager.updateCaptions called with:', text);
    console.log('📺 overlayWindow exists:', !!this.overlayWindow);
    console.log('📺 settings.enabled:', this.settings.enabled);
    console.log('📺 isVisible:', this.isVisible);

    if (!this.overlayWindow) {
      console.log('📺 ERROR: No overlay window!');
      return;
    }

    if (!this.settings.enabled) {
      console.log('📺 ERROR: Captions not enabled!');
      return;
    }

    const trimmedText = text.trim();

    // Add new text chunk to the array
    this.textChunks.push(trimmedText);

    // Keep only the last 3 chunks
    if (this.textChunks.length > this.maxChunks) {
      this.textChunks = this.textChunks.slice(-this.maxChunks);
    }

    // Smart text combination: if chunks are progressive (each contains the previous), 
    // just show the longest one. Otherwise, concatenate them.
    let displayText = '';

    if (this.textChunks.length === 1) {
      displayText = this.textChunks[0];
    } else {
      // Check if chunks are progressive (each chunk contains the previous one)
      let isProgressive = true;
      for (let i = 1; i < this.textChunks.length; i++) {
        if (!this.textChunks[i].startsWith(this.textChunks[i - 1])) {
          isProgressive = false;
          break;
        }
      }

      if (isProgressive) {
        // If progressive, just show the longest (last) chunk
        displayText = this.textChunks[this.textChunks.length - 1];
      } else {
        // If not progressive, concatenate all chunks
        displayText = this.textChunks.join(' ');
      }
    }

    console.log('📺 Text chunks:', this.textChunks);
    console.log('📺 Display text:', displayText);
    console.log('📺 About to show captions with display text:', displayText);

    // Store the text to show
    this.pendingText = displayText;

    // Clear any existing delay timeout
    if (this.showDelayTimeout) {
      clearTimeout(this.showDelayTimeout);
      this.showDelayTimeout = null;
    }

    // Add a delay before showing captions to make them feel less instant
    this.showDelayTimeout = setTimeout(async () => {
      if (this.pendingText) {
        await this.showCaptionsWithText(this.pendingText);
        this.pendingText = null;
        console.log('📺 showCaptionsWithText completed');
      }
      this.showDelayTimeout = null;
    }, this.captionDelayMs);
  }

  private async showCaptionsWithText(text: string): Promise<void> {
    console.log('📺 showCaptionsWithText called with:', text);

    if (!this.overlayWindow) {
      console.log('📺 ERROR: No overlay window in showCaptionsWithText');
      return;
    }

    try {
      console.log('📺 Current isVisible:', this.isVisible);

      // Show window if hidden
      if (!this.isVisible) {
        console.log('📺 Showing overlay window...');
        this.overlayWindow.show();
        this.isVisible = true;
        console.log('📺 Captions overlay window shown');
      }

      console.log('📺 Executing JavaScript to update captions...');
      await this.overlayWindow.webContents.executeJavaScript(`
        console.log('📺 [Overlay] JavaScript executing with text:', ${JSON.stringify(text)});
        if (window.captionsAPI && window.captionsAPI.updateCaptions) {
          console.log('📺 [Overlay] captionsAPI found, calling updateCaptions');
          window.captionsAPI.updateCaptions(${JSON.stringify(text)});
        } else {
          console.log('📺 [Overlay] ERROR: captionsAPI not found!');
        }
      `);
      console.log('📺 JavaScript execution completed');

      // Clear existing hide timeout
      if (this.hideTimeout) {
        clearTimeout(this.hideTimeout);
      }

      // Auto-hide after 3 seconds of no new captions
      this.hideTimeout = setTimeout(() => {
        if (this.overlayWindow && this.isVisible) {
          this.overlayWindow.hide();
          this.isVisible = false;
          // Reset text chunks when auto-hiding due to timeout
          this.textChunks = [];
          console.log('📺 Captions overlay auto-hidden after timeout, chunks reset');
        }
      }, 3000);

    } catch (error) {
      console.error('📺 ERROR in showCaptionsWithText:', error);
    }
  }



  public async clearCaptions(): Promise<void> {
    console.log('📺 Clearing captions');

    // Clear the text chunks array
    this.textChunks = [];

    // Clear any pending show delay
    if (this.showDelayTimeout) {
      clearTimeout(this.showDelayTimeout);
      this.showDelayTimeout = null;
      this.pendingText = null;
    }

    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
      this.hideTimeout = null;
    }

    if (!this.overlayWindow) return;

    try {
      await this.overlayWindow.webContents.executeJavaScript(`
        if (window.captionsAPI && window.captionsAPI.clearCaptions) {
          window.captionsAPI.clearCaptions();
        }
      `);

      this.overlayWindow.hide();
      this.isVisible = false;
      console.log('📺 Captions cleared and hidden');
    } catch (error) {
      console.error('Failed to clear captions:', error);
    }
  }

  private async savePositionToConfig(): Promise<void> {
    try {
      // Import ConfigurationManager dynamically to avoid circular dependencies
      const { ConfigurationManager } = await import('./ConfigurationManager');
      const configManager = ConfigurationManager.getInstance();

      const currentConfig = configManager.getConfiguration();
      const existingSettings = currentConfig.uiSettings?.captionsSettings;
      if (existingSettings) {
        // ONLY update the position, don't overwrite other caption settings
        configManager.saveConfiguration({
          ...currentConfig,
          uiSettings: {
            ...currentConfig.uiSettings,
            captionsSettings: {
              ...existingSettings,
              position: this.settings.position
            }
          }
        });
        console.log('📺 Saved caption position to config:', this.settings.position);
      }
    } catch (error) {
      console.error('Failed to save captions position to config:', error);
    }
  }

  public getSettings(): CaptionsSettings {
    return { ...this.settings };
  }

  public isEnabled(): boolean {
    return this.settings.enabled;
  }

  public async setPosition(x: number, y: number): Promise<void> {
    if (this.overlayWindow) {
      this.overlayWindow.setPosition(x, y);
      this.settings.position = { x, y };
    }
  }

  public async restorePosition(): Promise<void> {
    if (this.overlayWindow && this.settings.position) {
      this.overlayWindow.setPosition(this.settings.position.x, this.settings.position.y);
    }
  }

  public resetTextChunks(): void {
    console.log('📺 Resetting text chunks');
    this.textChunks = [];
  }

  private async loadInitialSettings(): Promise<void> {
    try {
      // Import ConfigurationManager dynamically to avoid circular dependencies
      const { ConfigurationManager } = await import('./ConfigurationManager');
      const configManager = ConfigurationManager.getInstance();

      const currentConfig = configManager.getConfiguration();
      if (currentConfig.uiSettings?.captionsSettings) {
        this.settings = { ...this.settings, ...currentConfig.uiSettings.captionsSettings };
        console.log('📺 Loaded initial captions settings from config:', this.settings);
      }
    } catch (error) {
      console.error('Failed to load initial captions settings:', error);
    }
  }

  public async showForSettings(): Promise<void> {
    if (!this.overlayWindow) {
      await this.createOverlay();
    }

    if (this.overlayWindow && !this.isVisible) {
      this.overlayWindow.show();
      this.isVisible = true;

      // Show preview text
      await this.showCaptionsWithText('This is a preview of how captions will look - you can drag this window to reposition it');

      // Hide after 5 seconds
      setTimeout(async () => {
        if (this.overlayWindow && this.isVisible) {
          this.overlayWindow.hide();
          this.isVisible = false;
        }
      }, 5000);
    }
  }
}