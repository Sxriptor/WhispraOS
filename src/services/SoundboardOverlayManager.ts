import { BrowserWindow, BrowserView, screen, session, IpcMainEvent } from 'electron';
import * as path from 'path';
import { ConfigurationManager } from './ConfigurationManager';

/**
 * Manages the soundboard overlay window with web browsing capabilities
 */
export class SoundboardOverlayManager {
  private static instance: SoundboardOverlayManager;
  private overlayWindow: BrowserWindow | null = null;
  private browserView: BrowserView | null = null;
  private isViewAttached: boolean = false;
  private configManager: ConfigurationManager;
  private isVisible: boolean = false;
  private isAudioRoutingSetup: boolean = false;
  private audioSetupTimeout: NodeJS.Timeout | null = null;

  private constructor() {
    this.configManager = ConfigurationManager.getInstance();
    this.setupVolumeListeners();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): SoundboardOverlayManager {
    if (!SoundboardOverlayManager.instance) {
      SoundboardOverlayManager.instance = new SoundboardOverlayManager();
    }
    return SoundboardOverlayManager.instance;
  }

  /**
   * Create soundboard overlay window
   */
  public async createOverlay(): Promise<BrowserWindow> {
    if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
      return this.overlayWindow;
    }

    // Get primary display bounds for positioning
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

    // Position overlay in center-right of screen (Steam-like positioning)
    const overlayWidth = 800;
    const overlayHeight = 600;
    const x = screenWidth - overlayWidth - 50;
    const y = Math.floor((screenHeight - overlayHeight) / 2);

    this.overlayWindow = new BrowserWindow({
      width: overlayWidth,
      height: overlayHeight,
      x: x,
      y: y,
      frame: false,
      transparent: false,
      backgroundColor: '#1a1a1a',
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: true,
      minimizable: false,
      maximizable: false,
      closable: true,
      focusable: true,
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, '..', 'soundboard-overlay-preload.js'),
        webSecurity: false, // Allow loading external content
        allowRunningInsecureContent: true,
        experimentalFeatures: true,
        webviewTag: true // Enable webview tag support (not used with BrowserView, but harmless)
      }
    });

    // Configure session for persistent storage (like Chrome)
    const overlaySession = this.overlayWindow.webContents.session;
    
    // Enable persistent storage for login sessions
    overlaySession.setPermissionRequestHandler((webContents, permission, callback) => {
      // Allow common permissions needed for web browsing
      const allowedPermissions = [
        'media',
        'geolocation',
        'notifications',
        'fullscreen',
        'pointerLock'
      ];
      callback(allowedPermissions.includes(permission));
    });

    // Set user agent to appear as Chrome
    overlaySession.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    // Load overlay HTML
    await this.overlayWindow.loadFile(path.join(__dirname, '..', 'soundboard-overlay.html'));

    // Create and attach a BrowserView that fills the overlay window
    this.browserView = new BrowserView({
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: false,
        allowRunningInsecureContent: true,
        experimentalFeatures: true,
        preload: path.join(__dirname, '..', 'soundboard-overlay-preload.js')
      }
    });

    const fitViewToWindow = () => {
      if (!this.overlayWindow || !this.browserView || !this.isViewAttached) return;
      const [contentWidth, contentHeight] = this.overlayWindow.getContentSize();
      // Leave room for header and padding from HTML layout (simple fixed offsets)
      const headerHeight = 80; // approximate header + margins
      const sidePadding = 16;
      const bottomPadding = 16;
      const width = Math.max(0, contentWidth - sidePadding * 2);
      const height = Math.max(0, contentHeight - headerHeight - bottomPadding);
      this.browserView.setBounds({ x: sidePadding, y: headerHeight, width, height });
      this.browserView.setAutoResize({ width: true, height: true });
    };

    fitViewToWindow();
    this.overlayWindow.on('resize', fitViewToWindow);
    this.overlayWindow.on('maximize', fitViewToWindow);
    this.overlayWindow.on('unmaximize', fitViewToWindow);

    // Emit initial navigation state and on navigation events
    const emitNav = () => this.sendNavigationUpdate();
    this.browserView.webContents.on('did-navigate', emitNav);
    this.browserView.webContents.on('did-navigate-in-page', emitNav);
    this.browserView.webContents.on('did-stop-loading', emitNav);
    this.browserView.webContents.on('page-title-updated', emitNav);

    // Match Chrome-like UA on the BrowserView session as well
    try {
      this.browserView.webContents.session.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      );
    } catch {}

    // Handle window events
    this.overlayWindow.on('closed', () => {
      console.log('[SoundboardOverlayManager] Window closed event - cleaning up audio');

      // Stop audio routing when window is closed
      this.stopAudioRouting();

      try {
        if (this.overlayWindow && this.browserView) {
          this.overlayWindow.removeBrowserView(this.browserView);
        }
      } catch {}
      this.browserView = null;
      this.overlayWindow = null;
      this.isVisible = false;
      this.isAudioRoutingSetup = false;
      if (this.audioSetupTimeout) {
        clearTimeout(this.audioSetupTimeout);
        this.audioSetupTimeout = null;
      }
    });

    this.overlayWindow.on('show', () => {
      this.isVisible = true;
    });

    this.overlayWindow.on('hide', () => {
      this.isVisible = false;
    });

    // Setup audio routing when overlay is created
    this.setupAudioRouting();

    // Initial state: show UI homescreen, keep BrowserView detached until navigation
    this.isViewAttached = false;
    this.sendNavigationUpdate();

    return this.overlayWindow;
  }

  /**
   * Show the overlay
   */
  public async show(): Promise<void> {
    if (!this.overlayWindow || this.overlayWindow.isDestroyed()) {
      await this.createOverlay();
    }

    if (this.overlayWindow) {
      this.overlayWindow.show();
      this.overlayWindow.focus();
      this.isVisible = true;
      
      // Ensure audio routing is active when showing overlay
      this.setupAudioRouting();
    }
  }

  /**
   * Hide the overlay
   */
  public hide(): void {
    if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
      // Keep audio routing active when hiding (minimizing) overlay
      console.log('[SoundboardOverlayManager] Hiding overlay - keeping audio routing active');

      this.overlayWindow.hide();
      this.isVisible = false;
    }
  }

  /**
   * Toggle overlay visibility
   */
  public async toggle(): Promise<void> {
    if (this.isVisible) {
      // When toggling off, just hide (keep audio routing active)
      console.log('[SoundboardOverlayManager] Toggling overlay off - keeping audio routing active');
      this.hide();
    } else {
      await this.show();
    }
  }

  /**
   * Close and destroy the overlay
   */
  public close(): void {
    console.log('[SoundboardOverlayManager] Close method called');
    console.log('[SoundboardOverlayManager] overlayWindow exists:', !!this.overlayWindow);
    console.log('[SoundboardOverlayManager] overlayWindow destroyed:', this.overlayWindow?.isDestroyed());

    // CRITICAL: Stop audio routing BEFORE closing the window
    try { this.browserView?.webContents?.setAudioMuted?.(true); } catch {}
    this.stopAudioRouting();

    if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
      console.log('[SoundboardOverlayManager] Closing overlay window');

      // Remove all event listeners to prevent interference
      this.overlayWindow.removeAllListeners();
      try {
        if (this.browserView) {
          this.overlayWindow.removeBrowserView(this.browserView);
        }
      } catch {}

      try {
        // First try to hide the window
        this.overlayWindow.hide();
        console.log('[SoundboardOverlayManager] Window hidden');

        // Then force destroy
        this.overlayWindow.destroy();
        console.log('[SoundboardOverlayManager] Window destroyed successfully');
      } catch (error) {
        console.error('[SoundboardOverlayManager] Error destroying window:', error);

        // Fallback methods
        try {
          console.log('[SoundboardOverlayManager] Trying setClosable(true) and close()');
          this.overlayWindow.setClosable(true);
          this.overlayWindow.close();
          console.log('[SoundboardOverlayManager] Window closed with fallback method');
        } catch (fallbackError) {
          console.error('[SoundboardOverlayManager] Fallback close also failed:', fallbackError);

          // Last resort: force null the reference
          console.log('[SoundboardOverlayManager] Force nulling window reference');
        }
      }
    } else if (this.overlayWindow?.isDestroyed()) {
      console.log('[SoundboardOverlayManager] Window already destroyed');
    } else {
      console.log('[SoundboardOverlayManager] No window to close');
    }

    // Always clean up state
    this.browserView = null;
    this.overlayWindow = null;
    this.isVisible = false;
    this.isAudioRoutingSetup = false;
    if (this.audioSetupTimeout) {
      clearTimeout(this.audioSetupTimeout);
      this.audioSetupTimeout = null;
    }
    console.log('[SoundboardOverlayManager] Close method completed');
  }

  /**
   * Check if overlay is visible
   */
  public isOverlayVisible(): boolean {
    return this.isVisible && this.overlayWindow !== null && !this.overlayWindow.isDestroyed();
  }

  /**
   * Get the overlay window instance
   */
  public getWindow(): BrowserWindow | null {
    return this.overlayWindow;
  }

  /**
   * Get the browser view for direct access to web content
   */
  public getBrowserView(): BrowserView | null {
    return this.browserView;
  }

  /**
   * Navigate to a URL in the overlay
   */
  public async navigateToUrl(url: string): Promise<void> {
    if ((!this.overlayWindow || this.overlayWindow.isDestroyed()) || !this.browserView) {
      await this.createOverlay();
    }

    if (this.browserView && this.overlayWindow) {
      // Ensure view is attached before navigating
      if (!this.isViewAttached) this.attachView();
      // Ensure URL has protocol
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
      }
      
      await this.browserView.webContents.loadURL(url);
      this.sendNavigationUpdate();
    }
  }

  /**
   * Navigate back in BrowserView history
   */
  public navigateBack(): void {
    if (this.browserView && this.browserView.webContents.canGoBack()) {
      this.browserView.webContents.goBack();
    }
  }

  /**
   * Navigate forward in BrowserView history
   */
  public navigateForward(): void {
    if (this.browserView && this.browserView.webContents.canGoForward()) {
      this.browserView.webContents.goForward();
    }
  }

  /**
   * Refresh the current page in the BrowserView
   */
  public refresh(): void {
    if (this.browserView) {
      this.browserView.webContents.reload();
      this.sendNavigationUpdate();
    }
  }

  /**
   * Attach the BrowserView to the overlay window
   */
  public attachView(): void {
    if (!this.overlayWindow || !this.browserView || this.isViewAttached) return;
    try {
      this.overlayWindow.setBrowserView(this.browserView);
      this.isViewAttached = true;
      // Fit after attaching
      const [contentWidth, contentHeight] = this.overlayWindow.getContentSize();
      const headerHeight = 80;
      const sidePadding = 16;
      const bottomPadding = 16;
      const width = Math.max(0, contentWidth - sidePadding * 2);
      const height = Math.max(0, contentHeight - headerHeight - bottomPadding);
      this.browserView.setBounds({ x: sidePadding, y: headerHeight, width, height });
      this.browserView.setAutoResize({ width: true, height: true });
    } catch {}
  }

  /**
   * Detach the BrowserView so overlay UI remains fully interactive
   */
  public detachView(): void {
    if (!this.overlayWindow || !this.browserView || !this.isViewAttached) return;
    try {
      this.overlayWindow.removeBrowserView(this.browserView);
      this.isViewAttached = false;
    } catch {}
  }

  /**
   * Emit current navigation state to the renderer overlay UI
   */
  private sendNavigationUpdate(): void {
    try {
      const overlay = this.overlayWindow;
      const view = this.browserView;
      if (!overlay || !view) return;

      const canGoBack = view.webContents.canGoBack();
      const canGoForward = view.webContents.canGoForward();
      const url = view.webContents.getURL?.() || '';

      overlay.webContents.send('soundboard-overlay:navigation-updated', {
        canGoBack,
        canGoForward,
        url
      });
    } catch {}
  }

  /**
   * Setup audio routing for the overlay - always active when overlay is open
   */
  private setupAudioRouting(): void {
    if (!this.browserView) return;

    if (this.isAudioRoutingSetup) {
      console.log('[SoundboardOverlay] Audio routing already setup, skipping');
      return;
    }

    console.log('[SoundboardOverlay] Setting up audio routing for overlay');
    this.captureBrowserViewAudio();
  }

  /**
   * Capture audio directly from the BrowserView and route it through the soundboard system
   */
  private async captureBrowserViewAudio(): Promise<void> {
    if (!this.browserView) {
      console.error('[SoundboardOverlay] No BrowserView available for audio capture');
      return;
    }

    // Check if we already have audio routing setup
    if (this.isAudioRoutingSetup) {
      console.log('[SoundboardOverlay] Audio routing already setup, skipping');
      return;
    }

    try {
      console.log('[SoundboardOverlay] Setting up direct audio routing in BrowserView...');

      // Get soundboard settings from the main process
      const { getSoundboardService } = require('../soundboard/soundboard-ipc');
      const service = getSoundboardService();
      const settings = service ? service.getSettings() : {
        masterVolume: 0.7,
        headphonesVolume: 0.5,
        outputDevice: ''
      };
      console.log('[SoundboardOverlay] Current settings:', settings);

      // Execute JavaScript to set up direct audio routing in the BrowserView (singleton mixer)
      const result = await this.browserView.webContents.executeJavaScript(`
        (async () => {
          try {
            console.log('🎵 Setting up direct audio routing in BrowserView...');
            const parsedSettings = ${JSON.stringify(settings)};
            
            // Find VB-Audio device directly in this context
            async function findVBAudioDevice() {
              try {
                const devices = await navigator.mediaDevices.enumerateDevices();
                const audioOutputs = devices.filter(d => d.kind === 'audiooutput');
                console.log('🎵 Available audio outputs:', audioOutputs.map(d => d.label));
                
                const vbDevice = audioOutputs.find(device => 
                  device.label.includes('CABLE Input') ||
                  device.label.toLowerCase().includes('cable input (vb-audio virtual cable)') ||
                  device.label.toLowerCase().includes('vb-audio cable input') ||
                  device.label.toLowerCase().includes('virtual cable input')
                );
                
                if (vbDevice) {
                  console.log('🎵 Found VB-Audio device:', vbDevice.label, vbDevice.deviceId);
                  return vbDevice.deviceId;
                }
                console.warn('🎵 VB-Audio device not found, using passed deviceId:', parsedSettings.outputDevice);
                return parsedSettings.outputDevice;
              } catch (e) {
                console.warn('🎵 Failed to enumerate devices:', e);
                return parsedSettings.outputDevice;
              }
            }
            
            const vbDeviceId = await findVBAudioDevice();
            
            if (window.__soundboardMixer) {
              const { vbAudio, headphonesAudio, vbGainNode, headphonesGainNode, resumePlayback } = window.__soundboardMixer;
              try { if (vbDeviceId && vbAudio.setSinkId) await vbAudio.setSinkId(vbDeviceId); } catch (e) { console.warn('🎵 Failed to re-apply VB sink:', e?.message || e); }
              // Headphones uses default device (no setSinkId needed)
              vbGainNode.gain.value = typeof parsedSettings.masterVolume === 'number' ? parsedSettings.masterVolume : 0.7;
              headphonesGainNode.gain.value = typeof parsedSettings.headphonesVolume === 'number' ? parsedSettings.headphonesVolume : 0.5;
              // Mute headphones if volume is 0
              headphonesAudio.muted = parsedSettings.headphonesVolume === 0;
              headphonesAudio.volume = parsedSettings.headphonesVolume === 0 ? 0 : 1.0;
              await resumePlayback();
              return { success: true, connectedSources: window.__soundboardMixer.attachedCount || 0, vbDeviceId };
            }
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const vbGainNode = audioContext.createGain();
            const headphonesGainNode = audioContext.createGain();
            vbGainNode.gain.value = typeof parsedSettings.masterVolume === 'number' ? parsedSettings.masterVolume : 0.7;
            headphonesGainNode.gain.value = typeof parsedSettings.headphonesVolume === 'number' ? parsedSettings.headphonesVolume : 0.5;
            const vbDestination = audioContext.createMediaStreamDestination();
            const headphonesDestination = audioContext.createMediaStreamDestination();
            vbGainNode.connect(vbDestination);
            headphonesGainNode.connect(headphonesDestination);
            const vbAudio = new Audio();
            vbAudio.srcObject = vbDestination.stream;
            vbAudio.volume = 1.0;
            const headphonesAudio = new Audio();
            headphonesAudio.srcObject = headphonesDestination.stream;
            // Set headphones audio volume to 0 if headphonesVolume is 0 to prevent any audio leakage
            headphonesAudio.volume = (typeof parsedSettings.headphonesVolume === 'number' && parsedSettings.headphonesVolume === 0) ? 0 : 1.0;
            headphonesAudio.muted = (typeof parsedSettings.headphonesVolume === 'number' && parsedSettings.headphonesVolume === 0);
            
            // Set VB-Audio device for virtual mic output
            async function applySinkWithRetry(audio, deviceId, label) {
              if (!deviceId || !audio.setSinkId) {
                console.warn('🎵 No deviceId or setSinkId not available for', label);
                return false;
              }
              const maxAttempts = 3;
              for (let attempt = 1; attempt <= maxAttempts; attempt++) {
                try { 
                  await audio.setSinkId(deviceId); 
                  console.log('🎵', label, 'device set successfully:', deviceId); 
                  return true; 
                }
                catch (e) { 
                  console.warn('🎵 Failed to set', label, 'device (attempt', attempt, '):', e?.message || e); 
                  await new Promise(r => setTimeout(r, 300 * attempt)); 
                }
              }
              return false;
            }
            
            // Apply VB-Audio to vbAudio element
            const vbSuccess = await applySinkWithRetry(vbAudio, vbDeviceId, 'VB-Audio');
            console.log('🎵 VB-Audio setSinkId result:', vbSuccess);
            
            // Headphones uses default output device - no setSinkId needed
            let attachedCount = 0;
            const attachedElements = new WeakSet();
            function attachMediaElement(element) {
              try {
                if (attachedElements.has(element)) return;
                element.muted = true;
                element.volume = 0;
                const source = audioContext.createMediaElementSource(element);
                source.connect(vbGainNode);
                source.connect(headphonesGainNode);
                attachedElements.add(element);
                attachedCount++;
              } catch (e) { console.warn('🎵 Failed to attach media element:', e?.message || e); }
            }
            document.querySelectorAll('audio, video').forEach((el) => attachMediaElement(el));
            const observer = new MutationObserver(mutations => {
              for (const mutation of mutations) {
                for (const node of mutation.addedNodes) {
                  if (node.nodeType === Node.ELEMENT_NODE) {
                    const el = node;
                    if (el.tagName === 'AUDIO' || el.tagName === 'VIDEO') { attachMediaElement(el); }
                    else { el.querySelectorAll?.('audio, video')?.forEach((m) => attachMediaElement(m)); }
                  }
                }
              }
            });
            observer.observe(document.body, { childList: true, subtree: true });
            async function resumePlayback() {
              try { if (audioContext.state === 'suspended') await audioContext.resume(); } catch {}
              try { await vbAudio.play(); } catch {}
              try { await headphonesAudio.play(); } catch {}
            }
            const unlockOnce = () => { document.removeEventListener('pointerdown', unlockOnce); document.removeEventListener('keydown', unlockOnce); resumePlayback(); };
            document.addEventListener('pointerdown', unlockOnce, { once: true });
            document.addEventListener('keydown', unlockOnce, { once: true });
            navigator.mediaDevices?.addEventListener?.('devicechange', async () => {
              // Re-find VB-Audio device on device change
              const newVbDeviceId = await findVBAudioDevice();
              await applySinkWithRetry(vbAudio, newVbDeviceId, 'VB-Audio');
              // Headphones uses default device - no action needed
            });
            // Handle live control messages from preload via postMessage
            window.addEventListener('message', (event) => {
              const data = event?.data || {};
              if (data?.type === 'overlay:set-volumes') {
                if (typeof data.vb === 'number') vbGainNode.gain.value = data.vb;
                if (typeof data.hp === 'number') {
                  headphonesGainNode.gain.value = data.hp;
                  // Mute/unmute headphones audio element when volume is 0 to prevent audio leakage
                  headphonesAudio.muted = data.hp === 0;
                  headphonesAudio.volume = data.hp === 0 ? 0 : 1.0;
                }
              }
              if (data?.type === 'overlay:shutdown') {
                try { observer.disconnect(); } catch {}
                try { vbAudio.pause(); vbAudio.srcObject = null; } catch {}
                try { headphonesAudio.pause(); headphonesAudio.srcObject = null; } catch {}
                try { audioContext.close(); } catch {}
              }
            }, false);
            // WebAudio bridge: mirror any connection to destination into our mixer and skip default dest
            (function installWebAudioBridge(){
              try {
                if (window.__soundboardPatchedConnect) return;
                const OriginalConnect = AudioNode.prototype.connect;
                const tappedNodes = new WeakSet();
                AudioNode.prototype.connect = function(...args) {
                  try {
                    const dest = args[0];
                    if (dest && dest instanceof AudioDestinationNode && !tappedNodes.has(this)) {
                      try { OriginalConnect.call(this, vbGainNode); } catch {}
                      try { OriginalConnect.call(this, headphonesGainNode); } catch {}
                      tappedNodes.add(this);
                      // Return destination to preserve chaining semantics
                      return dest;
                    }
                  } catch {}
                  return OriginalConnect.apply(this, args);
                };
                window.__soundboardPatchedConnect = { OriginalConnect };
              } catch (e) { console.warn('🎵 Failed to install WebAudio bridge:', e?.message || e); }
            })();
            window.__soundboardMixer = { audioContext, vbGainNode, headphonesGainNode, vbAudio, headphonesAudio, observer, resumePlayback, vbDeviceId, get attachedCount() { return attachedCount; } };
            await resumePlayback();
            console.log('🎵 Direct audio routing setup complete. Connected', attachedCount, 'media sources. VB Device:', vbDeviceId);
            try { window.electronAPI?.sendToMain?.('soundboard-overlay:status', { type: 'ready', attachedCount, vbDeviceId }); } catch {}
            return { success: true, connectedSources: attachedCount, vbDeviceId };
          } catch (error) {
            console.error('🎵 Failed to setup direct audio routing:', error);
            return { success: false, error: error.message };
          }
        })();
      `);

      if (result.success) {
        console.log('[SoundboardOverlay] Direct audio routing setup successful, connected sources:', result.connectedSources, 'VB Device:', result.vbDeviceId);
        this.isAudioRoutingSetup = true;
        
        // Force sync current volume values after setup
        console.log('[SoundboardOverlay] Syncing current volume values...');
        this.syncCurrentVolumeValues();
      } else {
        console.error('[SoundboardOverlay] Audio routing failed:', result.error);
      }

    } catch (error) {
      console.error('[SoundboardOverlay] Failed to setup BrowserView audio routing:', error);
    }
  }

  /**
   * Stop audio routing and clean up audio connections
   */
  private stopAudioRouting(): void {
    if (!this.browserView) return;

    console.log('[SoundboardOverlay] Stopping audio routing...');

    // Execute JavaScript to stop audio capture and clean up resources
    this.browserView.webContents.executeJavaScript(`
      (async () => {
        try {
          console.log('🎵 Stopping BrowserView audio capture...');
          if (window.__soundboardMixer) {
            try { window.__soundboardMixer.observer?.disconnect?.(); } catch {}
            try { window.__soundboardMixer.vbAudio.pause(); window.__soundboardMixer.vbAudio.srcObject = null; } catch {}
            try { window.__soundboardMixer.headphonesAudio.pause(); window.__soundboardMixer.headphonesAudio.srcObject = null; } catch {}
            try { window.__soundboardMixer.audioContext.close(); } catch {}
            window.__soundboardMixer = null;
          }
          // Restore any patched connect
          try { if (window.__soundboardPatchedConnect?.OriginalConnect) { AudioNode.prototype.connect = window.__soundboardPatchedConnect.OriginalConnect; } } catch {}
          try { window.__soundboardPatchedConnect = null; } catch {}
          console.log('🎵 BrowserView audio cleanup completed');
          return { success: true };
        } catch (error) {
          console.error('🎵 Failed to stop BrowserView audio:', error);
          return { success: false, error: error.message };
        }
      })();
    `).catch(error => {
      console.warn('[SoundboardOverlay] Failed to execute audio cleanup script:', error);
    });
    
    // Reset audio routing state
    this.isAudioRoutingSetup = false;
  }

  /**
   * Update overlay settings
   */
  public updateSettings(settings: {
    alwaysOnTop?: boolean;
    opacity?: number;
    width?: number;
    height?: number;
  }): void {
    if (!this.overlayWindow || this.overlayWindow.isDestroyed()) return;

    if (settings.alwaysOnTop !== undefined) {
      this.overlayWindow.setAlwaysOnTop(settings.alwaysOnTop);
    }

    if (settings.opacity !== undefined) {
      this.overlayWindow.setOpacity(Math.max(0.1, Math.min(1.0, settings.opacity)));
    }

    if (settings.width !== undefined || settings.height !== undefined) {
      const [currentWidth, currentHeight] = this.overlayWindow.getSize();
      this.overlayWindow.setSize(
        settings.width || currentWidth,
        settings.height || currentHeight
      );
    }
  }

  /**
   * Setup volume change listeners
   */
  private setupVolumeListeners(): void {
    const { ipcMain } = require('electron');
    
    ipcMain.on('soundboard:volume-changed', (event: IpcMainEvent, volume: number) => {
      console.log('[SoundboardOverlay] Received VB volume change:', volume);
      this.updateBrowserOverlayVolume('vb', volume);
    });

    ipcMain.on('soundboard:headphones-volume-changed', (event: IpcMainEvent, volume: number) => {
      console.log('[SoundboardOverlay] Received headphones volume change:', volume);
      this.updateBrowserOverlayVolume('headphones', volume);
    });
  }

  /**
   * Update browser overlay volume
   */
  private updateBrowserOverlayVolume(type: 'vb' | 'headphones', volume: number): void {
    if (!this.browserView || !this.isAudioRoutingSetup) return;

    console.log(`[SoundboardOverlay] Updating ${type} volume to: ${volume}`);

    const gainNodeName = type === 'vb' ? 'vbGainNode' : 'headphonesGainNode';

    // For headphones, also mute/unmute the audio element to prevent any audio leakage when volume is 0
    const muteScript = type === 'headphones' ? `
      if (mixer && mixer.headphonesAudio) {
        mixer.headphonesAudio.muted = ${volume === 0};
        mixer.headphonesAudio.volume = ${volume === 0 ? 0 : 1.0};
        console.log('🔊 Headphones audio muted:', ${volume === 0});
      }
    ` : '';

    this.browserView.webContents.executeJavaScript(`
      (async () => {
        try {
          const mixer = window.__soundboardMixer;
          const node = mixer ? mixer['${gainNodeName}'] : window['${gainNodeName}'];
          if (node) { node.gain.value = ${volume}; console.log('🔊 Updated ${type} volume to:', ${volume}); }
          else { console.warn('🔊 ${gainNodeName} not found'); }
          ${muteScript}
        } catch (error) {
          console.error('🔊 Failed to update ${type} volume:', error);
        }
      })();
    `).catch(error => {
      console.error(`[SoundboardOverlay] Failed to update ${type} volume:`, error);
    });
  }

  /**
   * Sync current volume values from soundboard settings to browser overlay
   */
  private syncCurrentVolumeValues(): void {
    if (!this.browserView || !this.isAudioRoutingSetup) return;

    try {
      // Get current soundboard settings
      const { getSoundboardService } = require('../soundboard/soundboard-ipc');
      const service = getSoundboardService();
      const settings = service ? service.getSettings() : null;
      
      if (settings) {
        console.log('[SoundboardOverlay] Syncing volumes - VB:', settings.masterVolume, 'Headphones:', settings.headphonesVolume);
        
        // Update both gain nodes with current values
        this.updateBrowserOverlayVolume('vb', settings.masterVolume);
        this.updateBrowserOverlayVolume('headphones', settings.headphonesVolume);
      } else {
        console.warn('[SoundboardOverlay] No settings available for volume sync');
      }
    } catch (error) {
      console.error('[SoundboardOverlay] Failed to sync current volume values:', error);
    }
  }
}