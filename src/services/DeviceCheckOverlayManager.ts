import { BrowserWindow, app } from 'electron';
import * as path from 'path';

export class DeviceCheckOverlayManager {
  private static instance: DeviceCheckOverlayManager;
  private overlayWindow: BrowserWindow | null = null;

  public static getInstance(): DeviceCheckOverlayManager {
    if (!DeviceCheckOverlayManager.instance) {
      DeviceCheckOverlayManager.instance = new DeviceCheckOverlayManager();
    }
    return DeviceCheckOverlayManager.instance;
  }

  /**
   * Show the device check overlay only if devices are missing
   * Note: On macOS, this overlay is skipped - use BlackHole setup overlay instead
   */
  public async showDeviceCheckOverlay(): Promise<void> {
    // Skip on macOS - use BlackHole setup overlay instead
    if (process.platform === 'darwin') {
      console.log('🔍 Device check overlay skipped on macOS (use BlackHole setup overlay instead)');
      return;
    }

    if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
      this.overlayWindow.focus();
      return;
    }

    console.log('🔍 Checking for VB-Audio devices before showing overlay...');
    
    // Check devices first before creating overlay
    const devices = await this.checkDevicesFromRenderer();
    
    if (devices.hasCableInput && devices.hasCableOutput) {
      console.log('🔍 VB-Audio devices already detected, skipping overlay');
      return;
    }

    console.log('🔍 VB-Audio devices missing, creating overlay...');

    // Find the main window to set as parent
    const mainWindow = BrowserWindow.getAllWindows().find(win => 
      !win.isDestroyed() && win.getTitle() === 'Whispra'
    );

    // Create the overlay window
    this.overlayWindow = new BrowserWindow({
      width: 800,
      height: 700,
      minWidth: 600,
      minHeight: 500,
      title: 'Device Check - Whispra',
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
      alwaysOnTop: false, // Changed: Don't stay on top of ALL windows
      modal: false, // Not modal so main window can still be accessed
      skipTaskbar: false, // Changed: Show in taskbar so users can find it
      focusable: true,
      parent: mainWindow || undefined // Set main window as parent if available
    });

    // Load the device check overlay HTML
    const overlayPath = path.join(__dirname, '../device-check-overlay.html');
    await this.overlayWindow.loadFile(overlayPath);

    // Open DevTools in development
    if (process.env.NODE_ENV === 'development' || process.argv.includes('--dev')) {
      try { this.overlayWindow.webContents.openDevTools(); } catch {}
    }

    // Center the overlay over the main window if it exists
    if (mainWindow && !mainWindow.isDestroyed()) {
      const mainBounds = mainWindow.getBounds();
      const overlayBounds = this.overlayWindow.getBounds();
      
      const x = mainBounds.x + (mainBounds.width - overlayBounds.width) / 2;
      const y = mainBounds.y + (mainBounds.height - overlayBounds.height) / 2;
      
      this.overlayWindow.setPosition(x, y);
    }

    // Show the window when ready
    this.overlayWindow.once('ready-to-show', () => {
      if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
        this.overlayWindow.show();
        this.overlayWindow.focus();
      }
    });

    // Handle window close
    this.overlayWindow.on('closed', () => {
      this.overlayWindow = null;
    });
  }

  /**
   * Close the device check overlay
   */
  public closeDeviceCheckOverlay(): void {
    console.log('🔍 DeviceCheckOverlayManager.closeDeviceCheckOverlay() called');
    if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
      console.log('🔍 Closing overlay window...');
      this.overlayWindow.destroy(); // Use destroy() instead of close() for immediate cleanup
      this.overlayWindow = null;
      console.log('🔍 Overlay window closed successfully');
    } else {
      console.log('🔍 No overlay window to close or window already destroyed');
    }
  }

  /**
   * Check if the overlay is currently shown
   */
  public isOverlayShown(): boolean {
    return this.overlayWindow !== null && !this.overlayWindow.isDestroyed();
  }

  /**
   * Check devices from renderer process using the main window
   */
  private async checkDevicesFromRenderer(): Promise<{ hasCableInput: boolean; hasCableOutput: boolean }> {
    try {
      // Find the main window
      const mainWindow = BrowserWindow.getAllWindows().find(win => 
        !win.isDestroyed() && win.getTitle() === 'Whispra'
      );
      
      if (!mainWindow || mainWindow.isDestroyed()) {
        console.log('🔍 Main window not found, assuming devices missing');
        return { hasCableInput: false, hasCableOutput: false };
      }

      const isMac = process.platform === 'darwin';

      // Send a message to the renderer to check devices
      const result = await mainWindow.webContents.executeJavaScript(`
        (async () => {
          try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const audioInputDevices = devices.filter(device => device.kind === 'audioinput');
            const audioOutputDevices = devices.filter(device => device.kind === 'audiooutput');
            
            const isMac = ${isMac};
            
            // Platform-specific detection patterns
            const inputPatterns = isMac ? [
              'blackhole',
              'black hole',
              'blackhole 2ch',
              'blackhole 16ch',
              'blackhole 64ch'
            ] : [
              'cable input',
              'vb-audio virtual cable',
              'vb-cable',
              'vb audio cable',
              'virtual cable input',
              'cable-input',
              'vbaudio cable',
              'cable input (vb-audio virtual cable)',
              'vb-audio cable input',
              'virtual audio cable input'
            ];
            
            const outputPatterns = isMac ? [
              'blackhole',
              'black hole',
              'blackhole 2ch',
              'blackhole 16ch',
              'blackhole 64ch'
            ] : [
              'cable output',
              'vb-audio virtual cable',
              'vb-cable',
              'vb audio cable',
              'virtual cable output',
              'cable-output',
              'vbaudio cable',
              'cable output (vb-audio virtual cable)',
              'vb-audio cable output',
              'virtual audio cable output'
            ];
            
            const hasCableInput = audioInputDevices.some(device => {
              const label = device.label.toLowerCase().trim();
              return inputPatterns.some(pattern => label.includes(pattern));
            });
            
            const hasCableOutput = audioOutputDevices.some(device => {
              const label = device.label.toLowerCase().trim();
              return outputPatterns.some(pattern => label.includes(pattern));
            });
            
            return { hasCableInput, hasCableOutput };
          } catch (error) {
            console.error('Error checking devices:', error);
            return { hasCableInput: false, hasCableOutput: false };
          }
        })()
      `);

      console.log('🔍 Device check result:', result);
      return result;
      
    } catch (error) {
      console.log('🔍 Error checking devices from renderer:', error);
      return { hasCableInput: false, hasCableOutput: false };
    }
  }
}
