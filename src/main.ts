import { app, BrowserWindow, nativeImage } from 'electron';
import * as path from 'path';
import { registerIPCHandlers, unregisterIPCHandlers } from './ipc/handlers';
import { setupScreenTranslationDisplayListeners } from './ipc/handlers/screenTranslationHandlers';
import { initializeSoundboardIPC } from './soundboard/soundboard-ipc';
import { initializeSoundboardOverlayIPC } from './soundboard/soundboard-overlay-ipc';
import { OverlayStateManager } from './services/OverlayStateManager';
import { AuthManager } from './services/AuthManager';
import { AutoUpdaterService } from './services/AutoUpdaterService';
import { MenuService } from './services/MenuService';
import { SystemTrayService } from './services/SystemTrayService';
import { SupabaseService } from './services/SupabaseService';
import { ErrorReportingService } from './services/ErrorReportingService';
import { ErrorCategory, ErrorSeverity } from './types/ErrorTypes';

let mainWindow: BrowserWindow | null = null;

// Add flag to track if app is quitting to prevent minimize to tray on quit
declare global {
  namespace Electron {
    interface App {
      isQuitting?: boolean;
    }
  }
}

// MULTI-INSTANCE MODE: Allow multiple instances to run simultaneously
// Comment out or remove the single instance lock to enable multiple instances
//
// const gotTheLock = app.requestSingleInstanceLock();
//
// if (!gotTheLock) {
//   // Another instance is already running, quit this one
//   app.quit();
// } else {
//   // Handle second instance - focus the existing window
//   app.on('second-instance', (event, commandLine, workingDirectory) => {
//     // Someone tried to run a second instance, we should focus our window instead
//     if (mainWindow) {
//       const systemTray = SystemTrayService.getInstance();
//       if (systemTray.isWindowHiddenInTray()) {
//         // If window is hidden in tray, show it
//         systemTray.showWindowFromTray();
//       } else if (mainWindow.isMinimized()) {
//         // If window is minimized, restore it
//         mainWindow.restore();
//         mainWindow.focus();
//       } else {
//         // If window is already visible, just focus it
//         mainWindow.focus();
//       }
//     }
//   });
// }

// Force userData path to lowercase 'whispra' for consistency
// This ensures the app uses C:\Users\<username>\AppData\Roaming\whispra
// instead of C:\Users\<username>\AppData\Roaming\Whispra
app.setPath('userData', path.join(app.getPath('appData'), 'whispra'));

// Enable system audio capture for screen sharing in Chromium
// Must be set BEFORE app.whenReady()
try {
  app.commandLine.appendSwitch('enable-features', 'WebRTCScreenAudioCapture');
  // Allow screen capture from file:// origins
  app.commandLine.appendSwitch('allow-http-screen-capture');
} catch {}

async function createWindow(): Promise<void> {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    resizable: true,
    maximizable: true,
    frame: false, // Remove native window frame
    titleBarStyle: 'hidden', // Hide title bar on macOS
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      // In packaged builds, app contents live under app.asar. app.getAppPath()
      // points to that root, where our compiled files are under "dist".
      preload: app.isPackaged 
        ? path.join(app.getAppPath(), 'dist', 'preload.js')
        : path.join(__dirname, 'preload.js')
    },
    show: false, // Don't show until ready
    title: 'Whispra',
    icon: (() => {
      // Use platform-specific icon extension
      const iconExt = process.platform === 'darwin' ? 'icns' : 'ico';
      const iconName = `Whispra.${iconExt}`;
      
      // Try multiple paths and loading methods
      const iconPaths = app.isPackaged ? [
        path.join(process.resourcesPath, 'logos', 'electron', iconName)
      ] : [
        path.join(__dirname, '..', 'logos', 'electron', iconName),
        path.join(process.cwd(), 'logos', 'electron', iconName),
        path.join(__dirname, '..', '..', 'logos', 'electron', iconName)
      ];
      
      const fs = require('fs');
      for (const iconPath of iconPaths) {
        try {
          if (fs.existsSync(iconPath)) {
            // Try loading from buffer first (more reliable for .icns)
            try {
              const fileBuffer = fs.readFileSync(iconPath);
              const icon = nativeImage.createFromBuffer(fileBuffer);
              if (!icon.isEmpty()) {
                return iconPath; // Return path, Electron will load it
              }
            } catch (e) {
              // Try path method
              const icon = nativeImage.createFromPath(iconPath);
              if (!icon.isEmpty()) {
                return iconPath;
              }
            }
          }
        } catch (e) {
          // Continue to next path
        }
      }
      
      // Fallback: return first path even if we couldn't verify it
      return iconPaths[0];
    })()
  });

  // Show window when ready to prevent visual flash
  const showIfReady = () => { 
    if (mainWindow && !mainWindow.isVisible() && !app.isQuitting) {
      mainWindow.show(); 
    }
  };
  mainWindow.once('ready-to-show', showIfReady);
  mainWindow.webContents.once('did-finish-load', showIfReady);
  
  // Use a more conservative timeout and check if app is quitting
  const fallbackShow = setTimeout(() => {
    if (mainWindow && !mainWindow.isVisible() && !app.isQuitting) {
      mainWindow.show();
    }
  }, 3000);
  
  // Clear the timeout if window is shown earlier
  mainWindow.once('show', () => {
    clearTimeout(fallbackShow);
  });

  // Decide which page to load based on auth state
  try {
    const { OpenSourceFeatures } = await import('./services/OpenSourceConfig');
    const auth = AuthManager.getInstance();
    
    // In open-source mode without auth, skip sign-in and go straight to app
    let entry: string;
    if (!OpenSourceFeatures.AUTH_ENABLED) {
      console.log('ℹ️ Auth disabled - skipping sign-in, loading main app directly');
      entry = 'index.html';
    } else {
      const hasValidToken = await auth.hasValidToken();
      entry = hasValidToken ? 'index.html' : 'signin.html';
    }

    // If user has a valid token (or auth is disabled), initialize services
    if (entry === 'index.html') {
      // Only initialize subscription cache if auth is enabled
      if (OpenSourceFeatures.AUTH_ENABLED) {
        try {
          const { SubscriptionCacheService } = await import('./services/SubscriptionCacheService');
          const subscriptionCache = SubscriptionCacheService.getInstance();
          await subscriptionCache.initialize();
          console.log('✅ Subscription cache initialized on app startup');
        } catch (error) {
          console.error('Failed to initialize subscription cache on startup:', error);
        }

        // Set user info for error reporting
        try {
          const { ErrorReportingService } = await import('./services/ErrorReportingService');
          await ErrorReportingService.getInstance().setUserFromToken();
          console.log('📊 User info set for error reporting on startup');
        } catch (error) {
          console.warn('⚠️ Could not set user info for error reporting:', error);
        }
      }
    }

    // Handle both development and packaged environments
    // In packaged builds, compiled assets are inside app.asar under "dist/"
    const htmlPath = app.isPackaged
      ? path.join(app.getAppPath(), 'dist', entry)
      : path.join(__dirname, entry);

    await mainWindow.loadFile(htmlPath);
  } catch {
    const fallbackPath = app.isPackaged
      ? path.join(app.getAppPath(), 'dist', 'index.html')
      : path.join(__dirname, 'index.html');
    await mainWindow.loadFile(fallbackPath);
  }

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Refresh subscription status when window regains focus (user may have updated plan in browser)
  mainWindow.on('focus', async () => {
    try {
      const auth = AuthManager.getInstance();
      const hasValidToken = await auth.hasValidToken();
      if (hasValidToken) {
        const supabaseService = SupabaseService.getInstance();
        const userToken = await auth.getToken();
        if (userToken) {
          // Get refresh token from stored token data
          const keytar = await import('keytar');
          const stored = await keytar.getPassword('VoiceTranslationVoiceMod', 'auth_token');
          let refreshToken: string | undefined;
          if (stored) {
            try {
              const tokenData = JSON.parse(stored);
              refreshToken = tokenData.refreshToken;
            } catch {
              // Ignore parse errors
            }
          }

          await supabaseService.setUserToken(userToken, refreshToken);
          // Refresh subscription status (will detect plan changes)
          await supabaseService.refreshSubscriptionStatus();
        }
      }
    } catch (error) {
      // Silently fail - this is just a convenience check
      console.log('Could not refresh subscription on window focus:', error);
    }
  });

  // Open DevTools in development
  if (process.env.NODE_ENV === 'development' || process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }

  // Enable Ctrl+Shift+I to toggle DevTools in production (for debugging)
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.control && input.shift && input.key.toLowerCase() === 'i') {
      if (mainWindow?.webContents.isDevToolsOpened()) {
        mainWindow.webContents.closeDevTools();
      } else {
        mainWindow?.webContents.openDevTools();
      }
      event.preventDefault();
    }
  });
}

// App event handlers
app.whenReady().then(async () => {
  // Log open-source configuration status
  const { logConfigurationStatus } = await import('./services/OpenSourceConfig');
  console.log('');
  logConfigurationStatus();
  console.log('');

  // Initialize error reporting service first
  const errorReporter = ErrorReportingService.getInstance();
  await errorReporter.initialize();

  // Set macOS dock icon explicitly (required for macOS)
  if (process.platform === 'darwin') {
    try {
      const iconExt = 'icns';
      const iconName = `Whispra.${iconExt}`;
      const dockIconPath = app.isPackaged
        ? path.join(process.resourcesPath, 'logos', 'electron', iconName)
        : path.join(__dirname, '..', 'logos', 'electron', iconName);
      
      // Try multiple path resolutions for development
      // Try .icns first, fallback to PNG if .icns doesn't work
      // npm start: runs from dist/, so __dirname is dist/
      // npm run dev: nodemon may run from dist/ or src/, so try both
      let dockIcon: Electron.NativeImage | null = null;
      const dockIconPaths = app.isPackaged
        ? [
            path.join(process.resourcesPath, 'logos', 'electron', 'Whispra.icns'),
            path.join(process.resourcesPath, 'logos', 'electron', 'Whispra-tray.png')
          ]
        : [
            // Try .icns first, then PNG fallback
            path.join(__dirname, '..', 'logos', 'electron', 'Whispra.icns'),
            path.join(__dirname, '..', 'logos', 'electron', 'Whispra-tray.png'),
            path.join(process.cwd(), 'logos', 'electron', 'Whispra.icns'),
            path.join(process.cwd(), 'logos', 'electron', 'Whispra-tray.png'),
            path.join(__dirname, '..', '..', 'logos', 'electron', 'Whispra.icns'),
            path.join(__dirname, '..', '..', 'logos', 'electron', 'Whispra-tray.png'),
            path.resolve(process.cwd(), 'logos', 'electron', 'Whispra.icns'),
            path.resolve(process.cwd(), 'logos', 'electron', 'Whispra-tray.png')
          ];
      
      console.log('🔍 Attempting to load dock icon...');
      console.log('🔍 Dock icon paths to try:', dockIconPaths);
      console.log('🔍 __dirname:', __dirname);
      console.log('🔍 process.cwd():', process.cwd());
      
      for (const iconPath of dockIconPaths) {
        try {
          const fs = require('fs');
          const exists = fs.existsSync(iconPath);
          console.log(`🔍 Checking path: ${iconPath}`);
          console.log(`🔍 File exists: ${exists}`);
          
          if (exists) {
            // Try loading from path first (works better for .icns files)
            try {
              dockIcon = nativeImage.createFromPath(iconPath);
              const isEmpty = dockIcon.isEmpty();
              const size = dockIcon.getSize();
              console.log(`🔍 Image from path - empty: ${isEmpty}, size: ${size.width}x${size.height}`);
              
              if (!isEmpty) {
                console.log('✅ Loaded dock icon from path:', iconPath);
                break;
              } else {
                console.log('⚠️ Image from path is empty');
              }
            } catch (e) {
              console.log('❌ createFromPath failed:', e instanceof Error ? e.message : String(e));
            }
            
            // Fallback: Try loading from buffer
            if (!dockIcon || dockIcon.isEmpty()) {
              try {
                const fileBuffer = fs.readFileSync(iconPath);
                console.log(`🔍 File buffer size: ${fileBuffer.length} bytes`);
                dockIcon = nativeImage.createFromBuffer(fileBuffer);
                const isEmpty = dockIcon.isEmpty();
                const size = dockIcon.getSize();
                console.log(`🔍 Image from buffer - empty: ${isEmpty}, size: ${size.width}x${size.height}`);
                
                if (!isEmpty) {
                  console.log('✅ Loaded dock icon from buffer:', iconPath);
                  break;
                } else {
                  console.log('⚠️ Image from buffer is empty');
                }
              } catch (e) {
                console.log('❌ createFromBuffer failed:', e instanceof Error ? e.message : String(e));
              }
            }
          }
        } catch (e) {
          console.log('❌ Error processing path:', iconPath, e instanceof Error ? e.message : String(e));
        }
      }
      
      if (dockIcon && !dockIcon.isEmpty() && app.dock) {
        app.dock.setIcon(dockIcon);
        console.log('✅ macOS dock icon set successfully');
      } else {
        console.warn('⚠️ Could not load dock icon, using default');
        if (!app.dock) {
          console.warn('⚠️ app.dock is not available');
        }
        if (!dockIcon) {
          console.warn('⚠️ dockIcon is null');
        } else if (dockIcon.isEmpty()) {
          console.warn('⚠️ dockIcon is empty');
        }
      }
    } catch (error) {
      console.error('❌ Failed to set macOS dock icon:', error);
    }
  }

  // Register IPC handlers
  await registerIPCHandlers();
  
  // Initialize soundboard IPC
  try {
    await initializeSoundboardIPC();
    initializeSoundboardOverlayIPC();
    console.log('Soundboard IPC initialized successfully');
  } catch (error) {
    console.error('Failed to initialize soundboard IPC:', error);
  }
  
  // Initialize overlay health monitoring
  const overlayStateManager = OverlayStateManager.getInstance();
  overlayStateManager.initialize();
  overlayStateManager.startHealthMonitoring();
  
  // Initialize auto-updater
  const autoUpdater = AutoUpdaterService.getInstance();
  autoUpdater.initialize();
  
  // Initialize Supabase service
  const supabaseService = SupabaseService.getInstance();

  // Initialize Quick Translate Hotkey Service
  try {
    const { QuickTranslateHotkeyService } = await import('./services/QuickTranslateHotkeyService');
    const hotkeyService = QuickTranslateHotkeyService.getInstance();
    console.log('⚡ Quick Translate Hotkey Service initialized');
  } catch (error) {
    console.error('Failed to initialize Quick Translate Hotkey Service:', error);
  }

  // Setup screen translation display listeners
  setupScreenTranslationDisplayListeners();

  createWindow().then(async () => {
    // Set the main window for services
    if (mainWindow) {
      autoUpdater.setMainWindow(mainWindow);
      
      // Initialize menu service
      const menuService = MenuService.getInstance();
      menuService.setMainWindow(mainWindow);
      menuService.createApplicationMenu();
      
      // Initialize system tray
      const systemTray = SystemTrayService.getInstance();
      systemTray.initialize(mainWindow);
      
      // Start subscription checking if user is signed in (only once at startup)
      // Initialize subscription cache if user is signed in
      const auth = AuthManager.getInstance();
      const hasValidToken = await auth.hasValidToken();
      if (hasValidToken) {
        // Get the user's token and set it for Supabase authentication
        const userToken = await auth.getToken();
        if (userToken) {
          // Get refresh token from stored token data
          const keytar = await import('keytar');
          const stored = await keytar.getPassword('VoiceTranslationVoiceMod', 'auth_token');
          let refreshToken: string | undefined;
          if (stored) {
            try {
              const tokenData = JSON.parse(stored);
              refreshToken = tokenData.refreshToken;
            } catch {
              // Ignore parse errors
            }
          }

          await supabaseService.setUserToken(userToken, refreshToken);

          // Update user's app version in the database
          try {
            const packageJson = require('../package.json');
            const appVersion = packageJson.version || 'unknown';
            await supabaseService.updateUserVersion(appVersion);
            console.log(`📱 User app version updated to: ${appVersion}`);
          } catch (error) {
            console.warn('⚠️ Could not update user app version:', error);
          }
          
          // Start periodic check every 10 minutes (don't check immediately - let user use the app)
          // Subscription will be checked when they use keybinds or after the first 10 minute interval
          supabaseService.startPeriodicCheck(10, false); // Don't check immediately on startup
          console.log('🔄 Started subscription monitoring (checks every 10 minutes)');
        }

        // Show platform-specific virtual audio setup overlay for first-time users
        // Tutorial shows at 500ms, so we delay overlay to give tutorial time to complete or be skipped
        setTimeout(async () => {
          try {
            if (process.platform === 'darwin') {
              // macOS: Show BlackHole setup overlay
              const { BlackHoleSetupOverlayManager } = await import('./services/BlackHoleSetupOverlayManager');
              const blackHoleSetupManager = BlackHoleSetupOverlayManager.getInstance();
              await blackHoleSetupManager.showBlackHoleSetupOverlay(false); // Don't force, check if user has seen it
              console.log('🔊 BlackHole setup overlay check completed on app startup');
            } else {
              // Windows: Show VB-Audio setup overlay
              const { VbAudioSetupOverlayManager } = await import('./services/VbAudioSetupOverlayManager');
              const vbAudioSetupManager = VbAudioSetupOverlayManager.getInstance();
              await vbAudioSetupManager.showVbAudioSetupOverlay(false); // Don't force, check if user has seen it
              console.log('🔊 VB Audio setup overlay check completed on app startup');
            }
          } catch (error) {
            console.warn('⚠️ Could not show audio setup overlay:', error);
          }
        });
        
        // Variables for tutorial completion listener and overlay state
        let tutorialCompletionListener: ((event: any) => void) | null = null;
        let audioOverlayShown = false;
        
        // Function to show platform-specific audio setup overlay
        const showAudioSetupOverlay = async () => {
          if (audioOverlayShown) {
            return;
          }
          try {
            if (process.platform === 'darwin') {
              // macOS: Show BlackHole setup overlay
              const { BlackHoleSetupOverlayManager } = await import('./services/BlackHoleSetupOverlayManager');
              const blackHoleSetupManager = BlackHoleSetupOverlayManager.getInstance();
              await blackHoleSetupManager.showBlackHoleSetupOverlay(false); // Don't force, check if user has seen it
              audioOverlayShown = true;
              console.log('🔊 BlackHole setup overlay shown');
            } else {
              // Windows: Show VB-Audio setup overlay
              const { VbAudioSetupOverlayManager } = await import('./services/VbAudioSetupOverlayManager');
              const vbAudioSetupManager = VbAudioSetupOverlayManager.getInstance();
              await vbAudioSetupManager.showVbAudioSetupOverlay(false); // Don't force, check if user has seen it
              audioOverlayShown = true;
              console.log('🔊 VB Audio setup overlay shown');
            }
          } catch (error) {
            console.warn('⚠️ Could not show audio setup overlay:', error);
          }
        };
        
        const checkAndShowAudioSetupOverlay = async () => {
          try {
            const platformName = process.platform === 'darwin' ? 'BlackHole' : 'VB Audio';
            console.log(`🔊 Checking tutorial status before showing ${platformName} overlay...`);
            
            // Check if tutorial is currently active
            const isTutorialActive = await mainWindow?.webContents.executeJavaScript(`
              (async () => {
                try {
                  const { TutorialOverlay } = await import('./ui/TutorialOverlay.js');
                  const tutorial = TutorialOverlay.getInstance();
                  return tutorial.isCurrentlyActive();
                } catch (error) {
                  console.error('Error checking tutorial status:', error);
                  return false;
                }
              })()
            `);
            
            if (isTutorialActive) {
              console.log(`🔊 Tutorial is active, waiting for it to complete before showing ${platformName} overlay...`);
              
              // Set up a one-time listener for tutorial completion
              tutorialCompletionListener = (event: any) => {
                console.log(`🔊 Tutorial completed event received, showing ${platformName} overlay...`);
                showAudioSetupOverlay();
                if (tutorialCompletionListener && mainWindow) {
                  mainWindow.webContents.removeListener('ipc-message', tutorialCompletionListener);
                  tutorialCompletionListener = null;
                }
              };
              
              // Listen for tutorial completion message from renderer
              mainWindow?.webContents.on('ipc-message', (event, channel) => {
                if (channel === 'tutorial:completed' && tutorialCompletionListener) {
                  tutorialCompletionListener(event);
                }
              });
              
              // Failsafe: show overlay after 5 minutes regardless
              setTimeout(() => {
                if (!audioOverlayShown) {
                  console.log(`🔊 Tutorial completion timeout, showing ${platformName} overlay anyway...`);
                  showAudioSetupOverlay();
                  if (tutorialCompletionListener && mainWindow) {
                    mainWindow.webContents.removeListener('ipc-message', tutorialCompletionListener);
                    tutorialCompletionListener = null;
                  }
                }
              }, 300000); // 5 minutes
              
            } else {
              console.log(`🔊 Tutorial is not active, showing ${platformName} overlay immediately...`);
              await showAudioSetupOverlay();
            }
          } catch (error) {
            console.warn('⚠️ Could not show virtual audio setup overlay on startup:', error);
          }
        };
        
        setTimeout(checkAndShowAudioSetupOverlay, 3000); // 3 second delay to check tutorial status

        // Warm up Paddle service on startup if installed (non-blocking background task)
        setTimeout(async () => {
          try {
            console.log('🏓 Checking if Paddle should be warmed up on startup...');
            
            // Get user's warmup preference from config
            const { ConfigurationManager } = await import('./services/ConfigurationManager');
            const configManager = ConfigurationManager.getInstance();
            const warmupOnStartup = configManager.getValue('uiSettings.paddleWarmupOnStartup');
            
            // Default to true if not set, but respect false if explicitly set
            if (warmupOnStartup === false) {
              console.log('🏓 Paddle startup warmup is disabled by user, skipping');
              return;
            }
            
            console.log(`🏓 Paddle startup warmup setting: ${warmupOnStartup} (will proceed with warmup)`);
            
            // Check if Paddle is installed (using cache)
            const { PaddlePaddleOverlayManager } = await import('./paddle/PaddlePaddleOverlayManager');
            const paddleManager = PaddlePaddleOverlayManager.getInstance();
            const paddleCheck = await paddleManager.checkPaddlePaddleInstallation(true); // Use cache
            
            if (!paddleCheck.isInstalled || !paddleCheck.hasLanguagePacks) {
              console.log('🏓 Paddle not installed or missing language packs, skipping warmup');
              return;
            }
            
            console.log('🏓 Paddle is installed and warmup is enabled, starting warmup in background...');
            
            // Get source language from config (default to 'en' if not set)
            // Access screenTranslation config which is stored separately
            let sourceLanguage = configManager.getValue('screenTranslation.sourceLanguage');
            
            // Ensure sourceLanguage is a valid string
            if (!sourceLanguage || typeof sourceLanguage !== 'string') {
              sourceLanguage = 'en';
            }
            
            console.log(`🏓 Warming up Paddle with user settings (language: ${sourceLanguage})...`);
            
            // Get Paddle service and trigger warmup
            const { PaddleOCRService } = await import('./services/PaddleOCRService');
            const paddleService = PaddleOCRService.getInstance();
            
            // Warmup in background - don't await, don't block startup
            paddleService.warmupService(sourceLanguage as string).then(() => {
              console.log('🏓 Paddle warmup completed on startup');
            }).catch((error) => {
              console.log('⚠️ Paddle warmup failed on startup (will retry when needed):', error.message);
            });
            
          } catch (error) {
            console.log('⚠️ Could not warm up Paddle on startup:', error);
          }
        }, 5000); // 5 second delay to let UI finish loading first - give renderer time to set up listeners

        // Preload Argos service on startup if Argos is selected (non-blocking background task)
        // Note: This is a best-effort preload. If it fails, TranslationServiceManager will handle initialization normally.
        setTimeout(async () => {
          try {
            console.log('🌐 Checking if Argos should be preloaded on startup...');
            
            // Get configuration to check if Argos is selected
            const { ConfigurationManager } = await import('./services/ConfigurationManager');
            const configManager = ConfigurationManager.getInstance();
            const config = configManager.getConfig();
            
            // Check if Argos is selected as translation provider
            const processingMode = (config as any).processingConfig?.mode || (config as any).processingMode || 'cloud';
            const modelConfig = processingMode === 'cloud'
              ? (config as any).cloudModelConfig
              : (config as any).localModelConfig;
            const translationProvider = modelConfig?.gptModel || (processingMode === 'local' ? 'argos' : 'openai');
            
            if (translationProvider !== 'argos') {
              console.log(`🌐 Argos not selected (provider: ${translationProvider}), skipping preload`);
              return;
            }
            
            console.log('🌐 Argos is selected, attempting preload in background...');
            
            // Preload Argos by initializing LocalProcessingManager (which will initialize Argos)
            // This uses the same instance that TranslationServiceManager will use
            // Since initialize() is idempotent, calling it here won't interfere with TranslationServiceManager
            const { LocalProcessingManager } = await import('./services/LocalProcessingManager');
            const localProcessingManager = LocalProcessingManager.getInstance();
            
            // Initialize in background - don't await, don't block startup
            // If this fails, TranslationServiceManager will handle initialization when needed
            // We catch all errors to ensure this never interferes with app startup
            localProcessingManager.initialize().then(() => {
              // Check if Argos actually initialized successfully
              try {
                const status = localProcessingManager.getLocalModelStatus();
                if (status.argosAvailable) {
                  console.log('🌐 Argos preload completed successfully on startup');
                } else {
                  console.log('🌐 Argos preload attempted but service is not available (TranslationServiceManager will handle initialization)');
                }
              } catch (statusError) {
                console.log('🌐 Could not check Argos preload status (non-critical):', statusError);
              }
            }).catch((error) => {
              // Silently catch errors - this is just a preload, not critical
              console.log('⚠️ Argos preload failed (non-critical, will retry when needed):', error.message || error);
            });
            
          } catch (error) {
            // Silently catch all errors - preload should never interfere with app startup
            console.log('⚠️ Could not preload Argos on startup (non-critical):', error);
          }
        }, 6000); // 6 second delay (slightly after Paddle warmup) to let UI finish loading first
      }
    }
  });

  app.on('activate', () => {
    // On macOS, re-create window when dock icon is clicked
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow().then(() => {
        if (mainWindow) {
          autoUpdater.setMainWindow(mainWindow);
          
          // Re-initialize menu service for new window
          const menuService = MenuService.getInstance();
          menuService.setMainWindow(mainWindow);
          menuService.createApplicationMenu();
          
          // Re-initialize system tray for new window
          const systemTray = SystemTrayService.getInstance();
          systemTray.setMainWindow(mainWindow);
        }
      });
    }
  });
});

// Quit when all windows are closed
app.on('window-all-closed', () => {
  // On macOS, apps typically stay running even when all windows are closed
  // But if app.isQuitting is true, we should actually quit
  if (app.isQuitting) {
    console.log('All windows closed - final cleanup and termination...');
    
    // Stop subscription cache service (but keep user signed in)
    try {
      const { SubscriptionCacheService } = require('./services/SubscriptionCacheService');
      const subscriptionCache = SubscriptionCacheService.getInstance();
      subscriptionCache.cleanup();
      console.log('🛑 Subscription cache service stopped for window close');
    } catch (error) {
      console.error('Error stopping subscription cache service on window close:', error);
    }
    
    // Perform cleanup and force exit
    (async () => { 
      await performEmergencyCleanup();
      // Force terminate immediately after cleanup
      console.log('Force terminating process...');
      process.exit(0);
    })();
  } else if (process.platform !== 'darwin') {
    // On Windows/Linux, quit when all windows are closed (unless running in background)
    // macOS apps stay running even when windows are closed
    app.quit();
  }
});

// Ensure all processes are cleaned up when app is quitting
app.on('before-quit', (event) => {
  console.log('🚨 BEFORE-QUIT: Starting cleanup...');
  
  // Check if we're installing an update - if so, skip aggressive cleanup
  if (AutoUpdaterService.isInstallingUpdate) {
    console.log('🔄 UPDATE: Skipping aggressive cleanup - update is being installed');
    app.isQuitting = true;
    
    // Only stop subscription cache service, don't kill processes
    try {
      const { SubscriptionCacheService } = require('./services/SubscriptionCacheService');
      const subscriptionCache = SubscriptionCacheService.getInstance();
      subscriptionCache.cleanup();
      console.log('🛑 Subscription cache service stopped for update');
    } catch (error) {
      console.error('Error stopping subscription cache service:', error);
    }
    return; // Exit early - let the updater handle the restart
  }
  
  app.isQuitting = true;

  // IMMEDIATE aggressive process killing for Windows (only when NOT updating)
  if (process.platform === 'win32') {
    console.log('🗡️ Windows before-quit: KILLING ALL PROCESSES...');

    try {
      const { execSync } = require('child_process');

      // Kill ALL Python and related processes immediately
      const processesToKill = [
        'python.exe',
        'python3.exe',
        'java.exe',
        'Whispra.exe'
      ];

      processesToKill.forEach(proc => {
        try {
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

  // Stop subscription cache service immediately
  try {
    const { SubscriptionCacheService } = require('./services/SubscriptionCacheService');
    const subscriptionCache = SubscriptionCacheService.getInstance();
    subscriptionCache.cleanup();
    console.log('🛑 Subscription cache service stopped for app quit');
  } catch (error) {
    console.error('Error stopping subscription cache service:', error);
  }

  // Perform aggressive cleanup
  performEmergencyCleanup().catch(console.error);
  
  // macOS: Ensure we actually exit (don't let app stay in dock)
  if (process.platform === 'darwin') {
    // Set a timeout to force exit if app.quit() doesn't work
    setTimeout(() => {
      console.log('🍎 macOS: Force exiting process to ensure dock icon disappears');
      process.exit(0);
    }, 500);
  }
});

// Handle process termination signals
process.on('SIGINT', () => {
  console.log('Received SIGINT, cleaning up...');
  (async () => { await performEmergencyCleanup(); })();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Received SIGTERM, cleaning up...');
  (async () => { await performEmergencyCleanup(); })();
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);

  // Report the error to the backend
  try {
    const errorReporter = ErrorReportingService.getInstance();
    errorReporter.captureError(error, {
      category: ErrorCategory.UNKNOWN,
      severity: ErrorSeverity.CRITICAL,
      component: 'main-process',
      context: { type: 'uncaughtException' }
    });
  } catch {}

  (async () => { await performEmergencyCleanup(); })();
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled promise rejection:', reason);

  // Report the error to the backend
  try {
    const errorReporter = ErrorReportingService.getInstance();
    const error = reason instanceof Error ? reason : new Error(String(reason));
    errorReporter.captureError(error, {
      category: ErrorCategory.UNKNOWN,
      severity: ErrorSeverity.CRITICAL,
      component: 'main-process',
      context: { type: 'unhandledRejection' }
    });
  } catch {}

  (async () => { await performEmergencyCleanup(); })();
  process.exit(1);
});

// Emergency cleanup function for critical situations
async function performEmergencyCleanup(): Promise<void> {
  try {
    console.log('🔥 Starting EMERGENCY cleanup...');

    // Check if we're installing an update - if so, skip process killing
    if (AutoUpdaterService.isInstallingUpdate) {
      console.log('🔄 UPDATE: Skipping emergency process killing - update is being installed');
      // Still do service cleanup below, but skip process killing
    } else {
      // IMMEDIATE Windows process killing - NO WAITING (only when NOT updating)
      if (process.platform === 'win32') {
        console.log('🗡️ EMERGENCY: KILLING ALL PYTHON PROCESSES...');

        try {
          const { execSync } = require('child_process');

          // Kill ALL Python processes immediately - multiple times for good measure
          const processesToKill = ['python.exe', 'python3.exe', 'java.exe', 'Whispra.exe'];

          for (let attempt = 0; attempt < 3; attempt++) {
            processesToKill.forEach(proc => {
              try {
                execSync(`taskkill /f /im "${proc}" /t`, { stdio: 'pipe' });
                console.log(`🗡️ Killed: ${proc} (attempt ${attempt + 1})`);
              } catch (e) {
                // Process might not exist, ignore
              }
            });

            // Small delay between attempts
            await new Promise(resolve => setTimeout(resolve, 100));
          }

          console.log('🗡️ EMERGENCY Windows process termination completed');
        } catch (error) {
          console.error('❌ EMERGENCY Windows taskkill failed:', error);
        }
      }
    }

    // Step 1: Immediately destroy overlay window
    console.log('💥 EMERGENCY: Destroying overlay window...');
    const overlayStateManager = OverlayStateManager.getInstance();
    overlayStateManager.forceCleanup();

    // Step 2: Cleanup all other services - NO WAITING
    console.log('💥 EMERGENCY: Cleaning up all services...');

    const autoUpdater = AutoUpdaterService.getInstance();
    autoUpdater.cleanup();

    const supabaseService = SupabaseService.getInstance();
    supabaseService.cleanup();

    // Cleanup error reporting service (flush remaining errors)
    const errorReporter = ErrorReportingService.getInstance();
    errorReporter.cleanup();

    // Cleanup Python OCR processes with force kill
    try {
      const { PaddleOCRService } = require('./services/PaddleOCRService');
      const paddleOCRService = PaddleOCRService.getInstance();
      paddleOCRService.cleanup();
      console.log('💥 EMERGENCY PaddleOCR Python processes cleaned up');
    } catch (error) {
      console.error('Error cleaning up PaddleOCR:', error);
    }

    // Cleanup Screen Translation Manager
    try {
      const { ScreenTranslationManager } = require('./services/ScreenTranslationManager');
      const screenTranslationManager = ScreenTranslationManager.getInstance();
      await screenTranslationManager.cleanup();
      console.log('💥 EMERGENCY ScreenTranslationManager cleaned up');
    } catch (error) {
      console.error('Error cleaning up ScreenTranslationManager:', error);
    }

    // Force clear any remaining intervals IMMEDIATELY
    console.log('💥 EMERGENCY: Clearing all remaining intervals...');
    const highestIntervalId = setInterval(() => {}, 0);
    const intervalId = highestIntervalId as unknown as number;
    for (let i = 0; i < intervalId; i++) {
      clearInterval(i);
    }
    clearInterval(highestIntervalId);

    const menuService = MenuService.getInstance();
    menuService.cleanup();

    const systemTray = SystemTrayService.getInstance();
    systemTray.cleanup();

    try {
      await unregisterIPCHandlers();
      console.log('💥 EMERGENCY IPC handlers unregistered');
    } catch (error) {
      console.error('Error unregistering IPC handlers:', error);
    }

    console.log('💥 EMERGENCY cleanup completed - ALL PROCESSES SHOULD BE DEAD');
  } catch (error) {
    console.error('Error during emergency cleanup:', error);
  }
}

// FAILSAFE: Force kill the entire process after 1 second to prevent zombie processes
function activateFailsafe(): void {
  console.log('🚨 ACTIVATING FAILSAFE - will force-kill process in 1 second...');

  // IMMEDIATE failsafe - NO WAITING
  setTimeout(() => {
    console.log('🚨 FAILSAFE ACTIVATED: FORCE TERMINATING ALL PROCESSES...');

    // Kill ALL processes immediately on Windows
    if (process.platform === 'win32') {
      try {
        const { execSync } = require('child_process');
        const processesToKill = ['python.exe', 'python3.exe', 'java.exe', 'Whispra.exe'];

        processesToKill.forEach(proc => {
          try {
            execSync(`taskkill /f /im "${proc}" /t`, { stdio: 'pipe' });
            console.log(`🚨 FAILSAFE Killed: ${proc}`);
          } catch (e) {
            // Ignore
          }
        });

        console.log('🚨 FAILSAFE Windows process termination completed');
      } catch (error) {
        console.error('🚨 FAILSAFE Windows taskkill failed:', error);
      }
    }

    // Force exit immediately - NO MORE WAITING
    console.log('🚨 FORCED TERMINATION: process.exit(0)');
    process.exit(0);
  }, 1000); // Reduced from 3 seconds to 1 second
}

// Ensure complete process termination when app quits
app.on('quit', () => {
  console.log('🚨 APP QUIT EVENT: Starting final cleanup...');

  // Check if we're installing an update - if so, skip aggressive cleanup
  if (AutoUpdaterService.isInstallingUpdate) {
    console.log('🔄 UPDATE: Skipping final aggressive termination - update is being installed');
    // Don't force exit or kill processes - let the updater do its job
    return;
  }

  // IMMEDIATE Windows process killing - NO WAITING (only when NOT updating)
  if (process.platform === 'win32') {
    console.log('🗡️ FINAL QUIT: KILLING ALL REMAINING PROCESSES...');

    try {
      const { execSync } = require('child_process');

      // Kill ALL processes immediately - multiple times
      const processesToKill = ['python.exe', 'python3.exe', 'java.exe', 'Whispra.exe'];

      for (let attempt = 0; attempt < 5; attempt++) {
        processesToKill.forEach(proc => {
          try {
            execSync(`taskkill /f /im "${proc}" /t`, { stdio: 'pipe' });
            console.log(`💀 FINAL Killed: ${proc} (attempt ${attempt + 1})`);
          } catch (e) {
            // Process might not exist, ignore
          }
        });

        // Very short delay between attempts
        const delay = Math.min(50 * (attempt + 1), 200);
        if (attempt < 4) {
          // Sleep for a very short time between attempts
          const start = Date.now();
          while (Date.now() - start < delay) {
            // Busy wait for precise timing
          }
        }
      }

      console.log('💀 FINAL Windows process termination completed');
    } catch (error) {
      console.error('❌ FINAL Windows taskkill failed:', error);
    }
  }

  // Final force exit - NO WAITING
  // macOS: Even more aggressive to ensure dock icon disappears
  const exitDelay = process.platform === 'darwin' ? 50 : 50;
  setTimeout(() => {
    console.log('💀 FINAL TERMINATION: process.exit(0)');
    process.exit(0);
  }, exitDelay);
  
  // macOS: Additional fallback to ensure process dies
  if (process.platform === 'darwin') {
    setTimeout(() => {
      console.log('🍎 macOS: FORCE KILL - Process should be dead by now');
      // If we're still here, something is wrong - force exit again
      process.exit(0);
    }, 200);
  }
});

// Handle any remaining process cleanup
process.on('exit', (code) => {
  console.log(`Process exiting with code ${code}`);
});

// Security: Prevent new window creation
app.on('web-contents-created', (event, contents) => {
  contents.setWindowOpenHandler(() => {
    return { action: 'deny' };
  });
  // Enable Inspect Element via context menu in development
  if (process.env.NODE_ENV === 'development' || process.argv.includes('--dev')) {
    try {
      contents.on('context-menu', (_event: any, params: any) => {
        try { if (!contents.isDestroyed()) contents.inspectElement(params.x, params.y); } catch {}
      });
    } catch {}
  }
});