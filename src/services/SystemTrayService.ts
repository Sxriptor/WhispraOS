import { Tray, Menu, BrowserWindow, app, nativeImage, Event } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

// Import services for cleanup
import { OverlayStateManager } from './OverlayStateManager';
import { AutoUpdaterService } from './AutoUpdaterService';
import { MenuService } from './MenuService';
import { ConfigurationManager } from './ConfigurationManager';
import { BackendConfig, getServiceUrl } from './OpenSourceConfig';

export class SystemTrayService {
  private static instance: SystemTrayService | null = null;
  private tray: Tray | null = null;
  private mainWindow: BrowserWindow | null = null;
  private isHiddenInTray: boolean = false;

  private constructor() {}

  public static getInstance(): SystemTrayService {
    if (!SystemTrayService.instance) {
      SystemTrayService.instance = new SystemTrayService();
    }
    return SystemTrayService.instance;
  }

  public async initialize(mainWindow: BrowserWindow): Promise<void> {
    this.mainWindow = mainWindow;
    
    // Check if background mode is enabled
    const config = ConfigurationManager.getInstance().getConfig();
    const runInBackground = config.uiSettings.runInBackground;
    
    // On macOS, only create tray if background mode is enabled
    // On Windows/Linux, always create tray (it's needed for minimize functionality)
    if (process.platform === 'darwin' && runInBackground !== true) {
      console.log('macOS: Background mode not enabled, skipping tray creation');
      this.setupWindowEvents(); // Still set up window events for proper close handling
      return;
    }
    
    // Only create tray if it doesn't exist
    if (!this.tray) {
      await this.createTray();
    }
    this.setupWindowEvents();
  }

  private async createTray(): Promise<void> {
    // macOS uses menu bar (Tray API) - create tray for all platforms including macOS

    // Prevent creating multiple tray instances
    if (this.tray) {
      console.log('Tray already exists, skipping creation');
      return;
    }

    try {
      // Platform-specific icon setup
      const iconExt = process.platform === 'darwin' ? 'png' : 'ico';
      const iconName = process.platform === 'darwin' ? 'Whispra-tray.png' : `Whispra.${iconExt}`;
      
      // Try multiple icon paths to ensure compatibility
      const iconPaths = app.isPackaged ? [
        path.join(process.resourcesPath, 'logos', 'electron', iconName),
        path.join(process.resourcesPath, 'app.asar.unpacked', 'dist', 'assets', iconName),
        path.join(process.resourcesPath, 'app', 'dist', 'assets', iconName),
        path.join(process.resourcesPath, 'dist', 'assets', iconName),
        path.join(__dirname, '..', 'assets', iconName)
      ] : [
        // Development mode: try multiple path resolutions
        path.join(__dirname, '..', '..', 'logos', 'electron', iconName),
        path.join(process.cwd(), 'logos', 'electron', iconName),
        path.join(__dirname, '..', '..', 'dist', 'assets', iconName),
        path.join(process.cwd(), 'dist', 'assets', iconName),
        // macOS-specific fallbacks
        ...(process.platform === 'darwin' ? [
          path.join(__dirname, '..', '..', 'logos', 'electron', 'Whispra.icns'),
          path.join(process.cwd(), 'logos', 'electron', 'Whispra.icns')
        ] : [])
      ];

      console.log('App is packaged:', app.isPackaged);
      console.log('Platform:', process.platform);
      console.log('Icon extension:', iconExt);
      console.log('Trying icon paths:', iconPaths);

      let icon = nativeImage.createEmpty();

      // Try each path until we find a working icon
      for (const iconPath of iconPaths) {
        try {
          // Check if file exists first
          if (fs.existsSync(iconPath)) {
            // Try multiple methods to load the icon
            let testIcon: Electron.NativeImage | null = null;
            
            // Method 1: Read file as buffer and create from buffer (works better for PNG)
            try {
              const fileBuffer = fs.readFileSync(iconPath);
              testIcon = nativeImage.createFromBuffer(fileBuffer);
              if (testIcon.isEmpty()) {
                testIcon = null;
              } else {
                console.log('Loaded icon using createFromBuffer from:', iconPath);
              }
            } catch (e) {
              console.log('createFromBuffer failed for', iconPath, ':', e instanceof Error ? e.message : String(e));
            }
            
            // Method 2: Try createFromPath with resolved absolute path
            if (!testIcon || testIcon.isEmpty()) {
              try {
                const resolvedPath = path.resolve(iconPath);
                testIcon = nativeImage.createFromPath(resolvedPath);
                if (testIcon.isEmpty()) {
                  testIcon = null;
                } else {
                  console.log('Loaded icon using createFromPath (resolved) from:', resolvedPath);
                }
              } catch (e) {
                const resolvedPath = path.resolve(iconPath);
                console.log('createFromPath (resolved) failed for', resolvedPath, ':', e instanceof Error ? e.message : String(e));
              }
            }
            
            // Method 3: Try createFromPath with original path (fallback)
            if (!testIcon || testIcon.isEmpty()) {
              try {
                testIcon = nativeImage.createFromPath(iconPath);
                if (testIcon.isEmpty()) {
                  testIcon = null;
                } else {
                  console.log('Loaded icon using createFromPath (original) from:', iconPath);
                }
              } catch (e) {
                console.log('createFromPath (original) failed for', iconPath, ':', e instanceof Error ? e.message : String(e));
              }
            }
            
            if (testIcon && !testIcon.isEmpty()) {
              icon = testIcon;
              console.log('Successfully loaded tray icon from:', iconPath);
              break;
            } else {
              console.log('Icon file exists but could not be loaded:', iconPath);
            }
          } else {
            console.log('Icon file does not exist:', iconPath);
          }
        } catch (error) {
          console.log('Failed to load icon from:', iconPath, error instanceof Error ? error.message : String(error));
        }
      }

      if (icon.isEmpty()) {
        console.warn('Could not load any tray icon, using empty icon');
        // Create a simple icon programmatically as fallback
        const canvas = nativeImage.createEmpty();
        this.tray = new Tray(canvas);
      } else {
        // Resize icon to appropriate size for tray
        // macOS menu bar icons are typically 22x22 (but can be up to 22pt @2x = 44px)
        // Windows/Linux tray icons are typically 16x16
        const iconSize = process.platform === 'darwin' ? 22 : 16;
        const trayIcon = icon.resize({ width: iconSize, height: iconSize });
        this.tray = new Tray(trayIcon);
      }

      this.tray.setToolTip('Whispra - Real-time Voice Translator');
      
      await this.createContextMenu();
      
      // macOS menu bar: click shows context menu, no double-click
      // Windows/Linux: click shows window, double-click toggles
      if (process.platform === 'darwin') {
        // macOS menu bar icons show context menu on click
        this.tray.on('click', () => {
          // On macOS, clicking the menu bar icon typically shows the context menu
          // But we can also toggle the window if it's hidden
          if (this.mainWindow && this.isHiddenInTray) {
            this.showWindow();
          }
        });
      } else {
        // Left-click to open/show window (Windows/Linux)
        this.tray.on('click', () => {
          this.showWindow();
        });
        
        // Double-click to show/hide window (Windows/Linux)
        this.tray.on('double-click', () => {
          this.toggleWindow();
        });
      }

      console.log('System tray created successfully');
    } catch (error) {
      console.error('Failed to create system tray:', error);
    }
  }

  private async createContextMenu(): Promise<void> {
    if (!this.tray) return;

    // Get current user language
    const userLanguage = await this.getUserLanguage();
    const languageName = this.getLanguageName(userLanguage);

    // Get available languages
    const languages = this.getAvailableLanguages();

    // Build language submenu
    const languageSubmenu = languages.map(lang => ({
      label: lang.name,
      type: 'radio' as const,
      checked: lang.code === userLanguage,
      click: () => {
        this.setUserLanguage(lang.code);
      }
    }));

    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Show Whispra',
        click: () => {
          this.showWindow();
        }
      },
      {
        type: 'separator'
      },
      {
        label: `Speaking: ${languageName}`,
        submenu: languageSubmenu
      },
      {
        type: 'separator'
      },
      {
        label: 'Settings',
        click: () => {
          this.openSettings();
        }
      },
      {
        label: 'Account',
        click: () => {
          this.openAccount();
        }
      },
      {
        label: 'Report Issue',
        click: () => {
          this.reportIssue();
        }
      },
      {
        type: 'separator'
      },
      {
        label: 'Quit',
        click: () => {
          this.quitApplication();
        }
      }
    ]);

    this.tray.setContextMenu(contextMenu);
  }

  /**
   * Get user's spoken language preference
   */
  private async getUserLanguage(): Promise<string> {
    try {
      const config = ConfigurationManager.getInstance().getConfig();
      return (config as any).userPreferences?.spokenLanguage || 'en';
    } catch (error) {
      console.error('Failed to get user language:', error);
      return 'en';
    }
  }

  /**
   * Set user's spoken language preference
   */
  private async setUserLanguage(language: string): Promise<void> {
    try {
      const configManager = ConfigurationManager.getInstance();
      
      // Update the configuration using setValue (which automatically saves)
      configManager.setValue('userPreferences.spokenLanguage', language);
      
      console.log(`Updated user language to: ${language}`);
      
      // Refresh the context menu to show the new selection
      await this.createContextMenu();
      
      // Notify the renderer process if window exists
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('language-changed', language);
      }
    } catch (error) {
      console.error('Failed to set user language:', error);
    }
  }

  /**
   * Get available languages
   */
  private getAvailableLanguages(): Array<{ code: string; name: string }> {
    return [
      { code: 'en', name: 'English' },
      { code: 'es', name: 'Spanish' },
      { code: 'fr', name: 'French' },
      { code: 'de', name: 'German' },
      { code: 'it', name: 'Italian' },
      { code: 'pt', name: 'Portuguese' },
      { code: 'ru', name: 'Russian' },
      { code: 'ja', name: 'Japanese' },
      { code: 'ko', name: 'Korean' },
      { code: 'zh', name: 'Chinese' },
      { code: 'ar', name: 'Arabic' },
      { code: 'hi', name: 'Hindi' },
      { code: 'th', name: 'Thai' },
      { code: 'vi', name: 'Vietnamese' },
      { code: 'tr', name: 'Turkish' },
      { code: 'pl', name: 'Polish' },
      { code: 'nl', name: 'Dutch' },
      { code: 'sv', name: 'Swedish' },
      { code: 'da', name: 'Danish' },
      { code: 'no', name: 'Norwegian' }
    ];
  }

  /**
   * Get language name from code
   */
  private getLanguageName(code: string): string {
    const languages = this.getAvailableLanguages();
    const language = languages.find(lang => lang.code === code);
    return language ? language.name : 'English';
  }

  /**
   * Open settings tab in the main window
   */
  private openSettings(): void {
    if (this.mainWindow) {
      this.showWindow();
      // Send event to renderer to open settings
      this.mainWindow.webContents.send('open-settings');
    }
  }

  /**
   * Open account dashboard in browser
   */
  private async openAccount(): Promise<void> {
    try {
      const { shell } = require('electron');
      const accountUrl = getServiceUrl('account');
      if (accountUrl) {
        await shell.openExternal(accountUrl);
      } else {
        await shell.openExternal(BackendConfig.WEBSITE_URL || 'https://github.com');
      }
    } catch (error) {
      console.error('Failed to open account dashboard:', error);
    }
  }

  /**
   * Open report issue page in browser
   */
  private async reportIssue(): Promise<void> {
    try {
      const { shell } = require('electron');
      const accountUrl = getServiceUrl('account');
      if (accountUrl) {
        await shell.openExternal(accountUrl.endsWith('/') ? `${accountUrl}report` : `${accountUrl}/report`);
      } else {
        await shell.openExternal(BackendConfig.WEBSITE_URL || 'https://github.com');
      }
    } catch (error) {
      console.error('Failed to open report issue page:', error);
    }
  }

  private setupWindowEvents(): void {
    if (!this.mainWindow) return;

    // Handle window events for all platforms including macOS

    // Handle minimize to tray (Windows/Linux only - macOS doesn't minimize to tray)
    if (process.platform !== 'darwin') {
      (this.mainWindow as any).on('minimize', (event: any) => {
        const config = ConfigurationManager.getInstance().getConfig();
        const runInBackground = config.uiSettings.runInBackground;
        
        // Only minimize to tray if user has explicitly chosen to run in background
        if (runInBackground === true) {
          event.preventDefault();
          this.hideWindow();
        }
      });
    }

    // Handle close to tray instead of quitting (all platforms including macOS)
    this.mainWindow.on('close', (event: Event) => {
      if (!app.isQuitting) {
        event.preventDefault();
        
        const config = ConfigurationManager.getInstance().getConfig();
        const runInBackground = config.uiSettings.runInBackground;
        
        // If preference is not set (undefined), show the first-run dialog
        if (runInBackground === undefined) {
          // Send event to renderer to show background overlay (first-run experience)
          if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send('window-close-attempt');
          }
        } else if (runInBackground === true) {
          // User has chosen to run in background - hide window (tray icon remains visible)
          this.hideWindow();
        } else {
          // User has chosen to exit app (runInBackground === false)
          // Allow the app to quit - ensure proper cleanup
          app.isQuitting = true;
          // Destroy tray before quitting (if it exists)
          if (this.tray) {
            this.tray.destroy();
            this.tray = null;
          }
          // Close all windows first
          if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.destroy();
          }
          // Force quit immediately
          setTimeout(() => {
            app.quit();
            // Fallback: force exit if quit doesn't work (especially important for macOS)
            setTimeout(() => {
              console.log('Force exiting process as fallback');
              process.exit(0);
            }, 200);
          }, 50);
        }
      }
    });

    // Prevent the window from being shown by other services when hidden in tray
    this.mainWindow.on('show', () => {
      if (this.isHiddenInTray && !app.isQuitting) {
        // If the window is supposed to be hidden in tray, hide it again
        setTimeout(() => {
          if (this.mainWindow && !this.mainWindow.isDestroyed() && this.isHiddenInTray) {
            this.mainWindow.hide();
          }
        }, 50);
      }
    });
  }

  public hideWindowToTray(): void {
    this.hideWindow();
    
    // Add a small delay to ensure the window is properly hidden
    // and prevent any services from trying to restore it
    setTimeout(() => {
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.hide();
      }
    }, 100);
  }

  private showWindow(): void {
    if (this.mainWindow) {
      this.isHiddenInTray = false;
      this.mainWindow.show();
      this.mainWindow.focus();
    }
  }

  private hideWindow(): void {
    if (this.mainWindow) {
      this.isHiddenInTray = true;
      this.mainWindow.hide();
    }
  }

  private toggleWindow(): void {
    if (this.mainWindow) {
      if (this.mainWindow.isVisible()) {
        this.hideWindow();
      } else {
        this.showWindow();
      }
    }
  }

  public ensureTrayForBackgroundMode(): void {
    // Create tray if it doesn't exist and background mode is enabled
    const config = ConfigurationManager.getInstance().getConfig();
    const runInBackground = config.uiSettings.runInBackground;
    
    if (runInBackground === true && !this.tray) {
      console.log('Background mode enabled - creating tray icon');
      this.createTray();
    } else if (runInBackground === false && this.tray) {
      // If background mode is disabled, destroy the tray
      console.log('Background mode disabled - destroying tray icon');
      this.tray.destroy();
      this.tray = null;
    }
  }

  private quitApplication(): void {
    console.log('🛑 System tray quit requested - starting cleanup...');
    this.isHiddenInTray = false;

    // Set the quitting flag immediately
    app.isQuitting = true;

    // Destroy tray immediately
    if (this.tray) {
      this.tray.destroy();
      this.tray = null;
    }

    // Close all windows first
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.destroy();
    }

    // Check if we're installing an update - if so, skip aggressive cleanup
    if (AutoUpdaterService.isInstallingUpdate) {
      console.log('🔄 UPDATE: Skipping aggressive cleanup from system tray - update is being installed');
      // Don't perform aggressive cleanup, just quit normally
      setTimeout(() => {
        try {
          app.quit();
        } catch (error) {
          console.error('❌ app.quit() failed:', error);
        }
      }, 100);
      return;
    }

    // Perform IMMEDIATE and AGGRESSIVE cleanup (only when not updating)
    this.performAggressiveCleanup();

    // Force quit immediately after cleanup starts - don't wait
    setTimeout(() => {
      console.log('🚨 FORCE QUIT: Executing emergency termination...');
      try {
        app.quit();
      } catch (error) {
        console.error('❌ app.quit() failed, using process.exit(0):', error);
        process.exit(0);
      }
      // Fallback: force exit if quit doesn't work (especially important for macOS)
      setTimeout(() => {
        console.log('🚨 FORCE EXIT: Process still running, forcing exit...');
        process.exit(0);
      }, 200);
    }, 100); // Very short delay to allow cleanup to start
  }

  /**
   * Perform aggressive immediate cleanup of all processes - NO WAITING
   */
  private performAggressiveCleanup(): void {
    console.log('🔥 Starting AGGRESSIVE IMMEDIATE cleanup - NO MERCY...');

    // IMMEDIATE PROCESS KILLING - Windows taskkill approach
    if (process.platform === 'win32') {
      console.log('🗡️ Using Windows taskkill for IMMEDIATE process termination...');

      try {
        const { execSync } = require('child_process');

        // Kill ALL Python processes immediately - no waiting
        const processesToKill = [
          'python.exe',
          'python3.exe',
          'Whispra.exe' // Kill any other Whispra instances
        ];

        processesToKill.forEach(proc => {
          try {
            console.log(`🗡️ Killing process: ${proc}`);
            execSync(`taskkill /f /im "${proc}" /t`, { stdio: 'pipe' });
            console.log(`✅ Killed: ${proc}`);
          } catch (e) {
            // Process might not exist, ignore
          }
        });

        console.log('🗡️ Windows process termination completed');
      } catch (error) {
        console.error('❌ Windows taskkill failed:', error);
      }
    }

    // Force destroy overlay windows immediately
    try {
      console.log('💥 Force destroying overlay windows...');
      const overlayStateManager = OverlayStateManager.getInstance();
      overlayStateManager.forceCleanup();
    } catch (error) {
      console.error('❌ Error destroying overlays:', error);
    }

    // Clear ALL intervals and timers immediately
    console.log('🧹 Clearing ALL intervals and timers...');
    try {
      const highestIntervalId = setInterval(() => {}, 0);
      const intervalId = highestIntervalId as unknown as number;
      for (let i = 0; i < intervalId; i++) {
        clearInterval(i);
      }
      clearInterval(highestIntervalId);
      console.log('✅ All intervals cleared');
    } catch (error) {
      console.error('❌ Error clearing intervals:', error);
    }

    // Cleanup services that might be holding references
    try {
      const menuService = MenuService.getInstance();
      menuService.cleanup();
      console.log('✅ Menu service cleaned up');
    } catch (error) {
      console.error('❌ Error cleaning up menu service:', error);
    }

    // Clean up system tray
    this.cleanup();
    console.log('✅ System tray cleaned up');

    console.log('🔥 AGGRESSIVE cleanup completed - processes should be dead');
  }

  public cleanup(): void {
    this.isHiddenInTray = false;
    if (this.tray) {
      this.tray.destroy();
      this.tray = null;
    }
  }

  public updateTooltip(text: string): void {
    if (this.tray) {
      this.tray.setToolTip(text);
    }
  }

  public setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
    // Re-setup window events for the new window
    this.setupWindowEvents();
  }

  public isWindowHiddenInTray(): boolean {
    return this.isHiddenInTray;
  }

  public showWindowFromTray(): void {
    this.showWindow();
  }
}