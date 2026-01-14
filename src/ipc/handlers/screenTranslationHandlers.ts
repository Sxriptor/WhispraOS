import { ipcMain, IpcMainInvokeEvent, BrowserWindow } from 'electron';

// ============================================================================
// SCREEN TRANSLATION HANDLERS
// ============================================================================

export function registerScreenTranslationHandlers(): void {
  // New integrated screen translation system handlers
  try { ipcMain.removeHandler('screen-translation:start-system'); } catch {}
  ipcMain.handle('screen-translation:start-system', async () => {
    try {
      console.log('📺 Starting integrated screen translation system...');
      const { ScreenTranslationManager } = await import('../../services/ScreenTranslationManager');
      const translationManager = ScreenTranslationManager.getInstance();

      await translationManager.startScreenTranslation();

      return { success: true };
    } catch (error) {
      console.error('❌ Error starting screen translation system:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  try { ipcMain.removeHandler('screen-translation:stop-system'); } catch {}
  ipcMain.handle('screen-translation:stop-system', async () => {
    try {
      console.log('📺 Stopping integrated screen translation system...');
      const { ScreenTranslationManager } = await import('../../services/ScreenTranslationManager');
      const translationManager = ScreenTranslationManager.getInstance();

      await translationManager.stopScreenTranslation();

      // Notify all renderer processes that screen translation has been stopped
      for (const win of BrowserWindow.getAllWindows()) {
        if (!win.isDestroyed()) win.webContents.send('screen-translation:stopped');
      }

      return { success: true };
    } catch (error) {
      console.error('❌ Error stopping screen translation system:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  try { ipcMain.removeHandler('screen-translation:cancel-processing'); } catch {}
  ipcMain.handle('screen-translation:cancel-processing', async () => {
    try {
      console.log('📺 Cancelling screen translation processing...');
      const { ScreenTranslationManager } = await import('../../services/ScreenTranslationManager');
      const translationManager = ScreenTranslationManager.getInstance();

      translationManager.cancelProcessing();

      return { success: true };
    } catch (error) {
      console.error('❌ Error cancelling screen translation processing:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  try { ipcMain.removeHandler('screen-translation:update-settings'); } catch {}
  ipcMain.handle('screen-translation:update-settings', async (event: IpcMainInvokeEvent, settings: any) => {
    try {
      console.log('📺 Updating screen translation settings:', settings);
      const { ScreenTranslationManager } = await import('../../services/ScreenTranslationManager');
      const translationManager = ScreenTranslationManager.getInstance();

      await translationManager.updateSettings(settings);

      return { success: true };
    } catch (error) {
      console.error('❌ Error updating screen translation settings:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  try { ipcMain.removeHandler('screen-translation:reload-settings'); } catch {}
  ipcMain.handle('screen-translation:reload-settings', async () => {
    try {
      console.log('📺 Reloading screen translation settings from config...');
      const { ScreenTranslationManager } = await import('../../services/ScreenTranslationManager');
      const translationManager = ScreenTranslationManager.getInstance();

      translationManager.reloadSettings();

      return { success: true };
    } catch (error) {
      console.error('❌ Error reloading screen translation settings:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  try { ipcMain.removeHandler('screen-translation:debug-config'); } catch {}
  ipcMain.handle('screen-translation:debug-config', async () => {
    try {
      const { ScreenTranslationManager } = await import('../../services/ScreenTranslationManager');
      const translationManager = ScreenTranslationManager.getInstance();

      const debugInfo = translationManager.debugConfiguration();
      return { success: true, debugInfo };
    } catch (error) {
      console.error('❌ Error debugging screen translation config:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  try { ipcMain.removeHandler('screen-translation:get-status'); } catch {}
  ipcMain.handle('screen-translation:get-status', async () => {
    try {
      console.log('📺 Getting screen translation status...');
      const { ScreenTranslationManager } = await import('../../services/ScreenTranslationManager');
      const translationManager = ScreenTranslationManager.getInstance();

      const isActive = translationManager.isScreenTranslationActive();
      const isProcessing = translationManager.isCurrentlyProcessing();
      const settings = translationManager.getSettings();
      const supportedOCRLanguages = translationManager.getSupportedOCRLanguages();
      const supportedTranslationLanguages = translationManager.getSupportedTranslationLanguages();

      return {
        success: true,
        isActive,
        isProcessing,
        settings,
        supportedOCRLanguages,
        supportedTranslationLanguages
      };
    } catch (error) {
      console.error('❌ Error getting screen translation status:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  try { ipcMain.removeHandler('screen-translation:process-capture'); } catch {}
  ipcMain.handle('screen-translation:process-capture', async (event: IpcMainInvokeEvent, displayId: string) => {
    try {
      console.log('📺 Processing screen capture for display:', displayId);
      const { ScreenTranslationManager } = await import('../../services/ScreenTranslationManager');
      const translationManager = ScreenTranslationManager.getInstance();

      const translatedBoxes = await translationManager.processScreenCapture(displayId);

      return {
        success: true,
        translatedBoxes,
        count: translatedBoxes.length
      };
    } catch (error) {
      console.error('❌ Error processing screen capture:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        translatedBoxes: []
      };
    }
  });

  try { ipcMain.removeHandler('screen-translation:process-source'); } catch {}
  ipcMain.handle('screen-translation:process-source', async (event: IpcMainInvokeEvent, params: { sourceId: string, displayId: string }) => {
    try {
      console.log('📺 [DEBUG] Processing screen capture from source:', params);
      console.log(`📺 [DEBUG] Capturing from display ID: ${params.displayId}`);

      // Import and use the screen translation manager for OCR and overlay management
      const { ScreenTranslationManager } = await import('../../services/ScreenTranslationManager');
      const translationManager = ScreenTranslationManager.getInstance();

      console.log(`📺 [DEBUG] About to call processScreenCapture with displayId: ${params.displayId}`);

      // Use the existing processScreenCapture method - it handles both OCR and overlay updates
      const translatedBoxes = await translationManager.processScreenCapture(params.displayId);

      console.log(`📺 [DEBUG] processScreenCapture completed. Found ${translatedBoxes.length} text boxes`);
      console.log(`📺 [SUCCESS] Screen translation completed for display ${params.displayId}`);

      return {
        success: true,
        translatedBoxes,
        count: translatedBoxes.length
      };
    } catch (error) {
      console.error('❌ [ERROR] Error processing screen source:', error);
      console.error('❌ [ERROR] Stack trace:', error instanceof Error ? error.stack : 'No stack trace');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        translatedBoxes: []
      };
    }
  });

  try { ipcMain.removeHandler('screen-translation:get-status'); } catch {}
  ipcMain.handle('screen-translation:get-system-status', async () => {
    try {
      const { ScreenTranslationManager } = await import('../../services/ScreenTranslationManager');
      const translationManager = ScreenTranslationManager.getInstance();

      const settings = translationManager.getSettings();
      const isActive = translationManager.isScreenTranslationActive();
      const supportedOCRLanguages = translationManager.getSupportedOCRLanguages();
      const supportedTranslationLanguages = translationManager.getSupportedTranslationLanguages();

      return {
        success: true,
        isActive,
        settings,
        supportedOCRLanguages,
        supportedTranslationLanguages
      };
    } catch (error) {
      console.error('❌ Error getting screen translation system status:', error);
      return {
        success: false,
        isActive: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  // Legacy overlay handlers (kept for compatibility)
  try { ipcMain.removeHandler('screen-translation:start'); } catch {}
  ipcMain.handle('screen-translation:start', async () => {
    try {
      console.log('📺 Starting screen translation overlay...');
      const { ScreenTranslationOverlayManager } = await import('../../services/ScreenTranslationOverlayManager');
      const overlayManager = ScreenTranslationOverlayManager.getInstance();

      await overlayManager.startOverlay();

      return { success: true };
    } catch (error) {
      console.error('❌ Error starting screen translation overlay:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  try { ipcMain.removeHandler('screen-translation:stop'); } catch {}
  ipcMain.handle('screen-translation:stop', async () => {
    try {
      console.log('📺 Stopping screen translation overlay...');
      const { ScreenTranslationOverlayManager } = await import('../../services/ScreenTranslationOverlayManager');
      const overlayManager = ScreenTranslationOverlayManager.getInstance();

      await overlayManager.stopOverlay();

      return { success: true };
    } catch (error) {
      console.error('❌ Error stopping screen translation overlay:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  try { ipcMain.removeHandler('screen-translation:update-ocr'); } catch {}
  ipcMain.handle('screen-translation:update-ocr', async (event: IpcMainInvokeEvent, data: any) => {
    try {
      const { ScreenTranslationOverlayManager } = await import('../../services/ScreenTranslationOverlayManager');
      const overlayManager = ScreenTranslationOverlayManager.getInstance();

      await overlayManager.updateOverlay(data);

      return { success: true };
    } catch (error) {
      console.error('❌ Error updating screen translation overlay:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  try { ipcMain.removeHandler('screen-translation:clear-all'); } catch {}
  ipcMain.handle('screen-translation:clear-all', async () => {
    try {
      const { ScreenTranslationOverlayManager } = await import('../../services/ScreenTranslationOverlayManager');
      const overlayManager = ScreenTranslationOverlayManager.getInstance();

      await overlayManager.clearAllOverlays();

      return { success: true };
    } catch (error) {
      console.error('❌ Error clearing screen translation overlay:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  try { ipcMain.removeHandler('screen-translation:force-cleanup'); } catch {}
  ipcMain.handle('screen-translation:force-cleanup', async () => {
    try {
      const { ScreenTranslationOverlayManager } = await import('../../services/ScreenTranslationOverlayManager');
      const overlayManager = ScreenTranslationOverlayManager.getInstance();

      await overlayManager.forceCleanup();

      return { success: true };
    } catch (error) {
      console.error('❌ Error force cleaning up screen translation overlay:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  try { ipcMain.removeHandler('screen-translation:has-overlays'); } catch {}
  ipcMain.handle('screen-translation:has-overlays', async () => {
    try {
      const { ScreenTranslationOverlayManager } = await import('../../services/ScreenTranslationOverlayManager');
      const overlayManager = ScreenTranslationOverlayManager.getInstance();

      const hasOverlays = overlayManager.hasOverlayWindows();
      return { success: true, hasOverlays };
    } catch (error) {
      console.error('❌ Error checking overlay status:', error);
      return {
        success: false,
        hasOverlays: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  try { ipcMain.removeHandler('screen-translation:get-status'); } catch {}
  ipcMain.handle('screen-translation:get-status', async () => {
    try {
      const { ScreenTranslationOverlayManager } = await import('../../services/ScreenTranslationOverlayManager');
      const overlayManager = ScreenTranslationOverlayManager.getInstance();

      return {
        success: true,
        isActive: overlayManager.isOverlayActive()
      };
    } catch (error) {
      console.error('❌ Error getting screen translation overlay status:', error);
      return {
        success: false,
        isActive: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  // Update overlay with text boxes
  try { ipcMain.removeHandler('screen-translation:update-overlay'); } catch {}
  ipcMain.handle('screen-translation:update-overlay', async (event: IpcMainInvokeEvent, data: { displayId: string; textBoxes: any[] }) => {
    try {
      console.log('📺 Updating screen translation overlay:', data.displayId, `${data.textBoxes.length} text boxes`);

      // Get the overlay manager and find the specific overlay for this display
      const { ScreenTranslationOverlayManager } = await import('../../services/ScreenTranslationOverlayManager');
      const overlayManager = ScreenTranslationOverlayManager.getInstance();

      const overlay = overlayManager.getOverlayForDisplay(data.displayId);
      if (!overlay || overlay.window.isDestroyed()) {
        console.log(`📺 No overlay found for display ${data.displayId}`);
        return { success: false, error: `No overlay window found for display ${data.displayId}` };
      }

      // Send text boxes to the specific overlay window
      overlay.window.webContents.send('screen-translation:update-text-boxes', data);

      return { success: true };
    } catch (error) {
      console.error('❌ Error updating screen translation overlay:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // Listen for overlay ready events
  ipcMain.on('screen-translation:overlay-ready', (event, data) => {
    console.log('📺 Screen translation overlay ready:', data);
  });

  ipcMain.on('screen-translation:overlay-error', (event, data) => {
    console.error('📺 Screen translation overlay error:', data);
  });

  // ============================================================================
  // SCREEN TRANSLATION BOX SELECTION HANDLERS
  // ============================================================================

  try { ipcMain.removeHandler('screen-translation:show-box-selector'); } catch {}
  ipcMain.handle('screen-translation:show-box-selector', async (_event, params: { sourceLanguage: string; targetLanguage: string }) => {
    try {
      console.log('📦 [IPC] Opening box selector with languages:', params);
      const { ScreenTranslationBoxSelectManager } = await import('../../services/ScreenTranslationBoxSelectManager');
      console.log('📦 [IPC] ScreenTranslationBoxSelectManager imported');
      const boxSelectManager = ScreenTranslationBoxSelectManager.getInstance();
      console.log('📦 [IPC] BoxSelectManager instance obtained, calling showBoxSelector...');

      await boxSelectManager.showBoxSelector(params.sourceLanguage, params.targetLanguage);

      console.log('📦 [IPC] showBoxSelector completed successfully');
      return { success: true };
    } catch (error) {
      console.error('❌ Error showing box selector:', error);
      console.error('❌ Stack trace:', error instanceof Error ? error.stack : 'No stack trace');
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  try { ipcMain.removeHandler('screen-translation:is-box-selector-open'); } catch {}
  ipcMain.handle('screen-translation:is-box-selector-open', async () => {
    try {
      const { ScreenTranslationBoxSelectManager } = await import('../../services/ScreenTranslationBoxSelectManager');
      const boxSelectManager = ScreenTranslationBoxSelectManager.getInstance();
      return boxSelectManager.isBoxSelectorOpen();
    } catch (error) {
      console.error('❌ Error checking box selector status:', error);
      return false;
    }
  });

  try { ipcMain.removeHandler('screen-translation:close-box-selector'); } catch {}
  ipcMain.handle('screen-translation:close-box-selector', async () => {
    try {
      const { ScreenTranslationBoxSelectManager } = await import('../../services/ScreenTranslationBoxSelectManager');
      const boxSelectManager = ScreenTranslationBoxSelectManager.getInstance();
      boxSelectManager.closeBoxSelector();
      return { success: true };
    } catch (error) {
      console.error('❌ Error closing box selector:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // ============================================================================
  // SCREEN TRANSLATION WATCH BOX HANDLERS
  // ============================================================================

  try { ipcMain.removeHandler('screen-translation:show-watch-box-selector'); } catch {}
  ipcMain.handle('screen-translation:show-watch-box-selector', async (_event, params: { sourceLanguage: string; targetLanguage: string }) => {
    try {
      console.log('👁️ [IPC] Opening watch box selector with languages:', params);
      const { ScreenTranslationWatchBoxManager } = await import('../../services/ScreenTranslationWatchBoxManager');
      const watchBoxManager = ScreenTranslationWatchBoxManager.getInstance();
      await watchBoxManager.showBoxSelector(params.sourceLanguage, params.targetLanguage);
      return { success: true };
    } catch (error) {
      console.error('❌ Error showing watch box selector:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  try { ipcMain.removeHandler('screen-translation:is-watch-box-selector-open'); } catch {}
  ipcMain.handle('screen-translation:is-watch-box-selector-open', async () => {
    try {
      const { ScreenTranslationWatchBoxManager } = await import('../../services/ScreenTranslationWatchBoxManager');
      const watchBoxManager = ScreenTranslationWatchBoxManager.getInstance();
      return watchBoxManager.isBoxSelectorOpen();
    } catch (error) {
      console.error('❌ Error checking watch box selector status:', error);
      return false;
    }
  });

  try { ipcMain.removeHandler('screen-translation:close-watch-box-selector'); } catch {}
  ipcMain.handle('screen-translation:close-watch-box-selector', async () => {
    try {
      const { ScreenTranslationWatchBoxManager } = await import('../../services/ScreenTranslationWatchBoxManager');
      const watchBoxManager = ScreenTranslationWatchBoxManager.getInstance();
      watchBoxManager.closeBoxSelector();
      return { success: true };
    } catch (error) {
      console.error('❌ Error closing watch box selector:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  try { ipcMain.removeHandler('screen-translation:stop-watch-box'); } catch {}
  ipcMain.handle('screen-translation:stop-watch-box', async () => {
    try {
      const { ScreenTranslationWatchBoxManager } = await import('../../services/ScreenTranslationWatchBoxManager');
      const watchBoxManager = ScreenTranslationWatchBoxManager.getInstance();
      await watchBoxManager.stopWatching();
      return { success: true };
    } catch (error) {
      console.error('❌ Error stopping watch box:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  try { ipcMain.removeHandler('screen-translation:is-watch-box-active'); } catch {}
  ipcMain.handle('screen-translation:is-watch-box-active', async () => {
    try {
      const { ScreenTranslationWatchBoxManager } = await import('../../services/ScreenTranslationWatchBoxManager');
      const watchBoxManager = ScreenTranslationWatchBoxManager.getInstance();
      return watchBoxManager.isWatchingActive();
    } catch (error) {
      console.error('❌ Error checking watch box status:', error);
      return false;
    }
  });

  // ============================================================================
  // SCREEN TRANSLATION REMOTE CONTROL HANDLERS (Overlay -> Main App)
  // ============================================================================

  // Handler for overlay to set target language in main app
  try { ipcMain.removeHandler('screen-translation:set-target-language'); } catch {}
  ipcMain.handle('screen-translation:set-target-language', async (event: IpcMainInvokeEvent, data: { targetLanguage: string }) => {
    try {
      console.log('📺 [Overlay Remote] Setting target language to:', data.targetLanguage);

      // Get the main window
      const mainWindow = BrowserWindow.getAllWindows().find(win =>
        !win.isDestroyed() && win.webContents.getURL().includes('index.html')
      );

      if (mainWindow) {
        // Execute script to update the DOM element and trigger change event
        const targetLang = data.targetLanguage.replace(/'/g, "\\'");
        await mainWindow.webContents.executeJavaScript(`
          (function() {
            const select = document.getElementById('screen-translation-target-lang');
            const newValue = '${targetLang}';
            if (select && select.value !== newValue) {
              select.value = newValue;
              select.dispatchEvent(new Event('change', { bubbles: true }));
              console.log('📺 [Main App] Target language updated to:', newValue);
            }
          })();
        `);

        // Broadcast to all overlays to sync
        for (const win of BrowserWindow.getAllWindows()) {
          if (!win.isDestroyed() && win.webContents !== event.sender) {
            win.webContents.send('screen-translation:update', { targetLanguage: data.targetLanguage });
          }
        }
      }

      return { success: true };
    } catch (error) {
      console.error('❌ Error setting target language:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // Handler for overlay to set source language in main app
  try { ipcMain.removeHandler('screen-translation:set-source-language'); } catch {}
  ipcMain.handle('screen-translation:set-source-language', async (event: IpcMainInvokeEvent, data: { sourceLanguage: string }) => {
    try {
      console.log('📺 [Overlay Remote] Setting source language to:', data.sourceLanguage);

      // Get the main window
      const mainWindow = BrowserWindow.getAllWindows().find(win =>
        !win.isDestroyed() && win.webContents.getURL().includes('index.html')
      );

      if (mainWindow) {
        // Execute script to update the DOM element and trigger change event
        const sourceLang = data.sourceLanguage.replace(/'/g, "\\'");
        await mainWindow.webContents.executeJavaScript(`
          (function() {
            const select = document.getElementById('screen-translation-source-lang');
            const newValue = '${sourceLang}';
            if (select && select.value !== newValue) {
              select.value = newValue;
              select.dispatchEvent(new Event('change', { bubbles: true }));
              console.log('📺 [Main App] Source language updated to:', newValue);
            }
          })();
        `);

        // Broadcast to all overlays to sync
        for (const win of BrowserWindow.getAllWindows()) {
          if (!win.isDestroyed() && win.webContents !== event.sender) {
            win.webContents.send('screen-translation:update', { sourceLanguage: data.sourceLanguage });
          }
        }
      }

      return { success: true };
    } catch (error) {
      console.error('❌ Error setting source language:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // Handler for overlay to set screen source in main app
  try { ipcMain.removeHandler('screen-translation:set-screen-source'); } catch {}
  ipcMain.handle('screen-translation:set-screen-source', async (event: IpcMainInvokeEvent, data: { screenSource: string }) => {
    try {
      console.log('📺 [Overlay Remote] Setting screen source to:', data.screenSource);

      // Get the main window
      const mainWindow = BrowserWindow.getAllWindows().find(win =>
        !win.isDestroyed() && win.webContents.getURL().includes('index.html')
      );

      if (mainWindow) {
        // Execute script to update both visual selector and hidden select
        const screenSrc = data.screenSource.replace(/'/g, "\\'");
        await mainWindow.webContents.executeJavaScript(`
          (function() {
            // Update visual selector (like selectDisplay function does)
            const displaySelector = document.getElementById('screen-translation-display-selector');
            if (displaySelector) {
              // Remove selected class from all rectangles
              const rectangles = displaySelector.querySelectorAll('.display-rectangle');
              rectangles.forEach(rect => rect.classList.remove('selected'));

              // Add selected class to the matching rectangle
              const targetRect = displaySelector.querySelector('[data-display-id="' + '${screenSrc}' + '"]');
              if (targetRect) {
                targetRect.classList.add('selected');
                console.log('📺 [Main App] Visual selector updated to:', '${screenSrc}');
              }
            }

            // Update hidden select and trigger change event for config update
            const select = document.getElementById('screen-translation-display-select');
            const newValue = '${screenSrc}';
            if (select && select.value !== newValue) {
              select.value = newValue;
              select.dispatchEvent(new Event('change', { bubbles: true }));
              console.log('📺 [Main App] Hidden select updated to:', newValue);
            }
          })();
        `);

        // Broadcast to all overlays to sync
        for (const win of BrowserWindow.getAllWindows()) {
          if (!win.isDestroyed() && win.webContents !== event.sender) {
            win.webContents.send('screen-translation:update', { displayId: data.screenSource });
          }
        }
      }

      return { success: true };
    } catch (error) {
      console.error('❌ Error setting screen source:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // Handler for overlay to set keybind in main app
  try { ipcMain.removeHandler('screen-translation:set-keybind'); } catch {}
  ipcMain.handle('screen-translation:set-keybind', async (event: IpcMainInvokeEvent, data: { keybind: string }) => {
    try {
      console.log('📺 [Overlay Remote] Setting keybind to:', data.keybind);

      // Get the main window
      const mainWindow = BrowserWindow.getAllWindows().find(win =>
        !win.isDestroyed() && win.webContents.getURL().includes('index.html')
      );

      if (mainWindow) {
        // Execute script to update the DOM element
        const keybind = data.keybind.replace(/'/g, "\\'");
        await mainWindow.webContents.executeJavaScript(`
          (function() {
            const keybindSpan = document.getElementById('screen-translation-current-keybind');
            const newValue = '${keybind}';
            if (keybindSpan && keybindSpan.textContent !== newValue) {
              keybindSpan.textContent = newValue;
              console.log('📺 [Main App] Keybind display updated to:', newValue);
            }
          })();
        `);

        // Update config
        const ConfigurationManager = (await import('../../services/ConfigurationManager')).ConfigurationManager;
        const configManager = ConfigurationManager.getInstance();
        const config = configManager.getConfig() as any;
        config.screenTranslation = config.screenTranslation || {};
        config.screenTranslation.keybind = data.keybind;
        await configManager.updateConfig(config);

        // Broadcast to all overlays to sync
        for (const win of BrowserWindow.getAllWindows()) {
          if (!win.isDestroyed() && win.webContents !== event.sender) {
            win.webContents.send('screen-translation:update', { keybind: data.keybind });
          }
        }
      }

      return { success: true };
    } catch (error) {
      console.error('❌ Error setting keybind:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // Handler for main app notifying overlays of config changes (Main App -> Overlay)
  ipcMain.on('screen-translation:main-app-changed', (event, data) => {
    console.log('📺 [Main App] Screen translation settings changed, broadcasting to overlays:', data);

    // Broadcast to all overlays (exclude main window)
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed() && !win.webContents.getURL().includes('index.html')) {
        win.webContents.send('screen-translation:update', data);
      }
    }
  });

  // Handler for overlay to click the main app's change keybind button
  try { ipcMain.removeHandler('screen-translation:click-change-keybind'); } catch {}
  ipcMain.handle('screen-translation:click-change-keybind', async (event: IpcMainInvokeEvent) => {
    try {
      console.log('📺 [Overlay Remote] Clicking main app change keybind button');

      // Get the main window
      const mainWindow = BrowserWindow.getAllWindows().find(win =>
        !win.isDestroyed() && win.webContents.getURL().includes('index.html')
      );

      if (mainWindow) {
        // Execute script to click the change keybind button
        await mainWindow.webContents.executeJavaScript(`
          (function() {
            const changeKeybindBtn = document.getElementById('screen-translation-change-keybind-btn');
            if (changeKeybindBtn) {
              changeKeybindBtn.click();
              console.log('📺 [Main App] Change keybind button clicked');
            }
          })();
        `);
      }

      return { success: true };
    } catch (error) {
      console.error('❌ Error clicking change keybind button:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // Handle keybind key set from overlay
  try { ipcMain.removeHandler('screen-translation:set-keybind-key'); } catch {}
  ipcMain.handle('screen-translation:set-keybind-key', async (event: IpcMainInvokeEvent, data: { key: string, code: string }) => {
    try {
      console.log('🔑 Setting screen translation keybind from overlay:', data);

      const mainWindow = BrowserWindow.getAllWindows().find(win =>
        !win.isDestroyed() && win.webContents.getURL().includes('index.html')
      );

      if (!mainWindow) {
        console.warn('⚠️ Main window not found');
        return { success: false, error: 'Main window not found' };
      }

      const keyForStorage = data.key;
      const keyEscaped = keyForStorage.replace(/'/g, "\\'");

      // Update the main app's keybind display and save to config
      await mainWindow.webContents.executeJavaScript(`
        (function() {
          const keybindSpan = document.getElementById('screen-translation-current-keybind');
          const modal = document.getElementById('screen-translation-keybind-modal');
          const newKey = '${keyEscaped}';

          if (keybindSpan) {
            keybindSpan.textContent = 'Alt + ' + newKey;
          }

          // Remove modal and its event listeners
          if (modal && modal.parentNode) {
            // The modal's keydown listener is on the document, but it checks a 'set' variable
            // which will be true after one key is pressed. The listener also removes itself.
            // We just need to remove the modal element.
            document.body.removeChild(modal);
          }

          // Save to config using the same method as main app
          if (window.electronAPI && window.electronAPI.invoke) {
            const hotkey = {
              ctrl: false,
              alt: true,
              shift: false,
              key: newKey
            };

            window.electronAPI.invoke('config:set', {
              id: Date.now().toString(),
              timestamp: Date.now(),
              payload: {
                uiSettings: {
                  screenTranslationHotkey: hotkey
                }
              }
            }).then(() => {
              // Update in-memory hotkey
              window.electronAPI.invoke('hotkeys:update', {
                screenTranslationHotkey: hotkey
              }).catch(() => {});
              console.log('✅ Screen translation hotkey saved:', hotkey);
            }).catch(() => {});
          }
        })();
      `);

      // Broadcast to all overlays
      const hotkeyData = {
        keybind: {
          ctrl: false,
          alt: true,
          shift: false,
          key: keyForStorage
        }
      };

      for (const win of BrowserWindow.getAllWindows()) {
        if (!win.isDestroyed() && !win.webContents.getURL().includes('index.html')) {
          win.webContents.send('screen-translation:update', hotkeyData);
        }
      }

      console.log('✅ Screen translation keybind set successfully');
      return { success: true };
    } catch (error) {
      console.error('❌ Error setting keybind:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // ============================================================================
  // SCREEN TRANSLATION LOADING OVERLAY HANDLERS
  // ============================================================================

  try { ipcMain.removeHandler('screen-translation-loading:show'); } catch {}
  ipcMain.handle('screen-translation-loading:show', async (_event, message: string = 'Processing...') => {
    try {
      const { ScreenTranslationLoadingOverlayManager } = await import('../../services/ScreenTranslationLoadingOverlayManager');
      const overlayManager = ScreenTranslationLoadingOverlayManager.getInstance();
      await overlayManager.show(message);
      return { success: true };
    } catch (error) {
      console.error('❌ Error showing screen translation loading overlay:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  try { ipcMain.removeHandler('screen-translation-loading:hide'); } catch {}
  ipcMain.handle('screen-translation-loading:hide', async () => {
    try {
      const { ScreenTranslationLoadingOverlayManager } = await import('../../services/ScreenTranslationLoadingOverlayManager');
      const overlayManager = ScreenTranslationLoadingOverlayManager.getInstance();
      overlayManager.hide();
      return { success: true };
    } catch (error) {
      console.error('❌ Error hiding screen translation loading overlay:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  try { ipcMain.removeHandler('screen-translation-loading:update-message'); } catch {}
  ipcMain.handle('screen-translation-loading:update-message', async (_event, message: string) => {
    try {
      const { ScreenTranslationLoadingOverlayManager } = await import('../../services/ScreenTranslationLoadingOverlayManager');
      const overlayManager = ScreenTranslationLoadingOverlayManager.getInstance();
      overlayManager.updateMessage(message);
      return { success: true };
    } catch (error) {
      console.error('❌ Error updating screen translation loading overlay message:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  console.log('✅ Screen translation IPC handlers registered');
}

// Function to setup display change listeners (call after app is ready)
export function setupScreenTranslationDisplayListeners(): void {
  const { screen } = require('electron');

  screen.on('display-added', async () => {
    console.log('📺 Display added, updating screen translation overlays...');
    try {
      const { ScreenTranslationOverlayManager } = await import('../../services/ScreenTranslationOverlayManager');
      const overlayManager = ScreenTranslationOverlayManager.getInstance();
      await overlayManager.handleDisplayChange();
    } catch (error) {
      console.error('❌ Error handling display addition:', error);
    }
  });

  screen.on('display-removed', async () => {
    console.log('📺 Display removed, updating screen translation overlays...');
    try {
      const { ScreenTranslationOverlayManager } = await import('../../services/ScreenTranslationOverlayManager');
      const overlayManager = ScreenTranslationOverlayManager.getInstance();
      await overlayManager.handleDisplayChange();
    } catch (error) {
      console.error('❌ Error handling display removal:', error);
    }
  });

  screen.on('display-metrics-changed', async () => {
    console.log('📺 Display metrics changed, updating screen translation overlays...');
    try {
      const { ScreenTranslationOverlayManager } = await import('../../services/ScreenTranslationOverlayManager');
      const overlayManager = ScreenTranslationOverlayManager.getInstance();
      await overlayManager.handleDisplayChange();
    } catch (error) {
      console.error('❌ Error handling display metrics change:', error);
    }
  });

  console.log('📺 Screen translation display listeners setup complete');
}
