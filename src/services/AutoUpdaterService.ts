import { autoUpdater, UpdateInfo } from 'electron-updater';
import { app, BrowserWindow } from 'electron';
import { EventEmitter } from 'events';

export interface UpdateStatus {
  updateAvailable: boolean;
  updateInfo?: UpdateInfo;
  downloadProgress?: number;
  downloadTotal?: number;
  error?: string;
  downloaded?: boolean;
}

export class AutoUpdaterService extends EventEmitter {
  private static instance: AutoUpdaterService;
  private mainWindow: BrowserWindow | null = null;
  private updateStatus: UpdateStatus = { updateAvailable: false };
  private isCheckingForUpdates = false;
  private updateCheckInterval: NodeJS.Timeout | null = null;
  public static isInstallingUpdate = false; // Flag to prevent aggressive cleanup during update

  private constructor() {
    super();
    this.setupAutoUpdater();
  }

  public static getInstance(): AutoUpdaterService {
    if (!AutoUpdaterService.instance) {
      AutoUpdaterService.instance = new AutoUpdaterService();
    }
    return AutoUpdaterService.instance;
  }

  public setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
  }

  private setupAutoUpdater(): void {
    // Configure auto-updater
    autoUpdater.autoDownload = false; // We'll control when to download
    autoUpdater.autoInstallOnAppQuit = true;

    // Set up event listeners
    autoUpdater.on('checking-for-update', () => {
      console.log('Checking for update...');
      this.isCheckingForUpdates = true;
    });

    autoUpdater.on('update-available', (info: UpdateInfo) => {
      console.log('Update available:', info);
      this.isCheckingForUpdates = false;
      this.updateStatus = {
        updateAvailable: true,
        updateInfo: info,
        downloaded: false
      };
      this.notifyRenderer('update-available', this.updateStatus);
    });

    autoUpdater.on('update-not-available', (info: UpdateInfo) => {
      console.log('Update not available:', info);
      this.isCheckingForUpdates = false;
      this.updateStatus = { updateAvailable: false };
      this.notifyRenderer('update-not-available', this.updateStatus);
    });

    autoUpdater.on('error', (err: Error) => {
      console.error('Error in auto-updater:', err);
      this.isCheckingForUpdates = false;
      this.updateStatus = {
        updateAvailable: false,
        error: err.message
      };
      this.notifyRenderer('update-error', this.updateStatus);
    });

    autoUpdater.on('download-progress', (progressObj: any) => {
      const progressPercent = Math.round(progressObj.percent);
      console.log(`Download progress: ${progressPercent}%`);
      
      this.updateStatus = {
        ...this.updateStatus,
        downloadProgress: progressPercent,
        downloadTotal: progressObj.total
      };
      this.notifyRenderer('download-progress', this.updateStatus);
    });

    autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
      console.log('Update downloaded:', info);
      this.updateStatus = {
        ...this.updateStatus,
        downloaded: true,
        downloadProgress: 100
      };
      this.notifyRenderer('update-downloaded', this.updateStatus);
    });
  }

  private notifyRenderer(event: string, data: any): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('updater:status-changed', {
        event,
        data
      });
    }
    this.emit(event, data);
  }

  /**
   * Check for updates manually
   */
  public async checkForUpdates(): Promise<void> {
    if (this.isCheckingForUpdates) {
      console.log('Already checking for updates...');
      return;
    }

    // Don't check for updates in development
    if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
      console.log('Skipping update check in development mode');
      return;
    }

    try {
      await autoUpdater.checkForUpdates();
    } catch (error) {
      console.error('Failed to check for updates:', error);
      this.updateStatus = {
        updateAvailable: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
      this.notifyRenderer('update-error', this.updateStatus);
    }
  }

  /**
   * Download the available update
   */
  public async downloadUpdate(): Promise<void> {
    if (!this.updateStatus.updateAvailable || this.updateStatus.downloaded) {
      console.log('No update available to download or already downloaded');
      return;
    }

    try {
      await autoUpdater.downloadUpdate();
    } catch (error) {
      console.error('Failed to download update:', error);
      this.updateStatus = {
        ...this.updateStatus,
        error: error instanceof Error ? error.message : 'Download failed'
      };
      this.notifyRenderer('update-error', this.updateStatus);
    }
  }

  /**
   * Install the downloaded update and restart the app
   */
  public quitAndInstall(): void {
    if (!this.updateStatus.downloaded) {
      console.log('No update downloaded to install');
      return;
    }

    console.log('🔄 UPDATE: Setting isInstallingUpdate flag to prevent aggressive cleanup');
    AutoUpdaterService.isInstallingUpdate = true;
    
    // Give the flag time to propagate before quitting
    setTimeout(() => {
      console.log('🔄 UPDATE: Starting quitAndInstall...');
      autoUpdater.quitAndInstall();
    }, 100);
  }

  /**
   * Get current update status
   */
  public getUpdateStatus(): UpdateStatus {
    return { ...this.updateStatus };
  }

  /**
   * Initialize auto-updater (call this when app is ready)
   */
  public initialize(): void {
    // Check for updates on app startup (after a delay)
    setTimeout(() => {
      this.checkForUpdates();
    }, 5000); // 5 second delay to let the app finish loading

    // Check for updates every 6 hours
    this.updateCheckInterval = setInterval(() => {
      this.checkForUpdates();
    }, 6 * 60 * 60 * 1000);
  }

  /**
   * Clean up resources
   */
  public cleanup(): void {
    // Clear the update check interval
    if (this.updateCheckInterval) {
      clearInterval(this.updateCheckInterval);
      this.updateCheckInterval = null;
    }

    this.removeAllListeners();
    autoUpdater.removeAllListeners();
  }
}
