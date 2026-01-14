import { Menu, MenuItemConstructorOptions, app, shell, BrowserWindow, dialog } from 'electron';
import { SplitOverlayWindowManager } from './SplitOverlayWindowManager';
import { AutoUpdaterService } from './AutoUpdaterService';
import { BackendConfig, getServiceUrl } from './OpenSourceConfig';

export class MenuService {
  private static instance: MenuService;
  private mainWindow: BrowserWindow | null = null;

  private constructor() { }

  public static getInstance(): MenuService {
    if (!MenuService.instance) {
      MenuService.instance = new MenuService();
    }
    return MenuService.instance;
  }

  public setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
  }

  public createApplicationMenu(): void {
    // Remove the native menu bar entirely - all menu items are now in the UI
    Menu.setApplicationMenu(null);
  }

  public sendToRenderer(channel: string, ...args: any[]): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, ...args);
    }
  }

  // Public methods for renderer to call via IPC
  public showAboutDialogPublic(): void {
    this.showAboutDialog();
  }

  public checkForUpdatesPublic(): void {
    this.checkForUpdates();
  }

  public zoomInPublic(): void {
    this.zoomIn();
  }

  public zoomOutPublic(): void {
    this.zoomOut();
  }

  public resetZoomPublic(): void {
    this.resetZoom();
  }

  public toggleFullscreenPublic(): void {
    this.toggleFullscreen();
  }

  public toggleAlwaysOnTopPublic(checked: boolean): void {
    this.toggleAlwaysOnTop(checked);
  }

  public minimizeWindow(): void {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) return;
    this.mainWindow.minimize();
  }

  public closeWindow(): void {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) return;
    this.mainWindow.close();
  }

  public quitApp(): void {
    app.quit();
  }

  public maximizeWindow(): void {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) return;
    if (this.mainWindow.isMaximized()) {
      this.mainWindow.unmaximize();
    } else {
      this.mainWindow.maximize();
    }
  }

  private async checkForUpdates(): Promise<void> {
    try {
      const updaterService = AutoUpdaterService.getInstance();
      await updaterService.checkForUpdates();

      // Show a dialog if no updates are available
      setTimeout(() => {
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
          const status = updaterService.getUpdateStatus();
          if (!status.updateAvailable && !status.error) {
            dialog.showMessageBox(this.mainWindow, {
              type: 'info',
              title: 'No Updates Available',
              message: 'You are running the latest version of Whispra.',
              detail: `Current version: ${app.getVersion()}`,
              buttons: ['OK']
            });
          }
        }
      }, 2000);
    } catch (error) {
      console.error('Failed to check for updates:', error);
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        dialog.showErrorBox('Update Check Failed', 'Failed to check for updates. Please try again later.');
      }
    }
  }

  private showAboutDialog(): void {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) return;

    dialog.showMessageBox(this.mainWindow, {
      type: 'info',
      title: 'About Whispra',
      message: 'Whispra',
      detail: `Version: ${app.getVersion()}\n\nReal-time voice translation for seamless communication across languages.\n\nCopyright © 2025 Whispra. All rights reserved.`,
      buttons: ['OK'],
      icon: undefined
    });
  }

  private openSettings(): void {
    this.sendToRenderer('menu:open-settings');
  }

  private zoomIn(): void {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) return;
    const currentZoom = this.mainWindow.webContents.getZoomFactor();
    this.mainWindow.webContents.setZoomFactor(Math.min(currentZoom + 0.1, 3.0));
  }

  private zoomOut(): void {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) return;
    const currentZoom = this.mainWindow.webContents.getZoomFactor();
    this.mainWindow.webContents.setZoomFactor(Math.max(currentZoom - 0.1, 0.25));
  }

  private resetZoom(): void {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) return;
    this.mainWindow.webContents.setZoomFactor(1.0);
  }

  private toggleFullscreen(): void {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) return;
    this.mainWindow.setFullScreen(!this.mainWindow.isFullScreen());
  }

  private reloadWindow(): void {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) return;
    this.mainWindow.reload();
  }

  private forceReloadWindow(): void {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) return;
    // Bypass cache similar to role: forceReload
    this.mainWindow.webContents.reloadIgnoringCache();
  }

  private toggleDevTools(): void {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) return;
    if (this.mainWindow.webContents.isDevToolsOpened()) {
      this.mainWindow.webContents.closeDevTools();
    } else {
      this.mainWindow.webContents.openDevTools();
    }
  }

  private toggleOverlayDevTools(): void {
    try {
      const overlayManager = SplitOverlayWindowManager.getInstance();
      overlayManager.toggleDevTools();
    } catch { }
  }

  private toggleAlwaysOnTop(checked: boolean): void {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) return;
    this.mainWindow.setAlwaysOnTop(checked);
  }

  private openUserGuide(): void {
    const accountUrl = getServiceUrl('account');
    if (accountUrl) {
      shell.openExternal(accountUrl.endsWith('/') ? `${accountUrl}user-guide` : `${accountUrl}/user-guide`);
    } else {
      shell.openExternal(BackendConfig.WEBSITE_URL || 'https://github.com');
    }
  }

  private showKeyboardShortcuts(): void {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) return;

    const shortcuts = `
Keyboard Shortcuts:

Window:
  ${process.platform === 'darwin' ? 'Cmd+M' : 'Ctrl+M'} - Minimize
  ${process.platform === 'darwin' ? 'Cmd+W' : 'Ctrl+W'} - Close
  ${process.platform === 'darwin' ? 'Cmd+Plus' : 'Ctrl+Plus'} - Zoom In
  ${process.platform === 'darwin' ? 'Cmd+-' : 'Ctrl+-'} - Zoom Out
  ${process.platform === 'darwin' ? 'Cmd+0' : 'Ctrl+0'} - Reset Zoom
  ${process.platform === 'darwin' ? 'Ctrl+Cmd+F' : 'F11'} - Toggle Fullscreen

General:
  ${process.platform === 'darwin' ? 'Cmd+,' : 'Ctrl+,'} - Preferences
  ${process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q'} - Quit
  ${process.platform === 'darwin' ? 'Cmd+?' : 'Ctrl+?'} - Show this help
    `.trim();

    dialog.showMessageBox(this.mainWindow, {
      type: 'info',
      title: 'Keyboard Shortcuts',
      message: 'Whispra Keyboard Shortcuts',
      detail: shortcuts,
      buttons: ['OK']
    });
  }

  private reportIssue(): void {
    const accountUrl = getServiceUrl('account');
    if (accountUrl) {
      shell.openExternal(accountUrl.endsWith('/') ? `${accountUrl}report` : `${accountUrl}/report`);
    } else {
      shell.openExternal(BackendConfig.WEBSITE_URL || 'https://github.com');
    }
  }

  private contactSupport(): void {
    const accountUrl = getServiceUrl('account');
    if (accountUrl) {
      shell.openExternal(accountUrl.endsWith('/') ? `${accountUrl}support` : `${accountUrl}/support`);
    } else {
      shell.openExternal(BackendConfig.WEBSITE_URL || 'https://github.com');
    }
  }

  private openReleaseNotes(): void {
    shell.openExternal('https://github.com/whispra/whispra/releases');
  }

  private openWebsite(): void {
    shell.openExternal(BackendConfig.WEBSITE_URL || 'https://github.com');
  }

  private async openSoundboardOverlay(): Promise<void> {
    try {
      const { getSoundboardOverlayManager } = await import('../soundboard/soundboard-overlay-ipc');
      const overlayManager = getSoundboardOverlayManager();
      if (overlayManager) {
        await overlayManager.show();
      } else {
        console.error('Soundboard overlay manager not available');
      }
    } catch (error) {
      console.error('Failed to open soundboard overlay:', error);
    }
  }

  private showGetStarted(): void {
    // Send message to renderer to start tutorial
    console.log('Get Started clicked from Help menu');
    this.sendToRenderer('tutorial:start');
  }

  private async showVbAudioSetup(): Promise<void> {
    try {
      const { VbAudioSetupOverlayManager } = await import('./VbAudioSetupOverlayManager');
      const overlayManager = VbAudioSetupOverlayManager.getInstance();
      await overlayManager.showVbAudioSetupOverlay(true); // Force show when called from menu
    } catch (error) {
      console.error('Failed to show VB Audio setup overlay:', error);
    }
  }

  private async showApiSetup(): Promise<void> {
    try {
      const { ApiSetupOverlayManager } = await import('./ApiSetupOverlayManager');
      const overlayManager = ApiSetupOverlayManager.getInstance();
      await overlayManager.showApiSetupOverlay();
    } catch (error) {
      console.error('Failed to show API setup overlay:', error);
    }
  }

  private toggleSoundboardOverlayDevTools(): void {
    try {
      const { getSoundboardOverlayManager } = require('../soundboard/soundboard-overlay-ipc');
      const overlayManager = getSoundboardOverlayManager();
      if (overlayManager) {
        const window = overlayManager.getWindow();
        if (window && !window.isDestroyed()) {
          if (window.webContents.isDevToolsOpened()) {
            window.webContents.closeDevTools();
          } else {
            window.webContents.openDevTools();
          }
        }
      }
    } catch (error) {
      console.error('Failed to toggle soundboard overlay dev tools:', error);
    }
  }

  /**
   * Cleanup resources when the app is shutting down
   */
  public cleanup(): void {
    // Clear main window reference to prevent memory leaks
    this.mainWindow = null;
  }
}
