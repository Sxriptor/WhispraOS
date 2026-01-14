import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { SoundboardOverlayManager } from '../services/SoundboardOverlayManager';

let overlayManager: SoundboardOverlayManager | null = null;

export function initializeSoundboardOverlayIPC(): void {
  overlayManager = SoundboardOverlayManager.getInstance();

  // Window management
  ipcMain.handle('soundboard-overlay:show', async (event: IpcMainInvokeEvent) => {
    if (!overlayManager) throw new Error('Soundboard overlay manager not initialized');
    await overlayManager.show();
    return { success: true };
  });

  ipcMain.handle('soundboard-overlay:hide', async (event: IpcMainInvokeEvent) => {
    if (!overlayManager) throw new Error('Soundboard overlay manager not initialized');
    overlayManager.hide();
    return { success: true };
  });

  ipcMain.handle('soundboard-overlay:toggle', async (event: IpcMainInvokeEvent) => {
    if (!overlayManager) throw new Error('Soundboard overlay manager not initialized');
    await overlayManager.toggle();
    return { success: true };
  });

  ipcMain.handle('soundboard-overlay:close', async (event: IpcMainInvokeEvent) => {
    console.log('[SoundboardOverlay] Close IPC handler called');
    if (!overlayManager) {
      console.error('[SoundboardOverlay] Overlay manager not initialized');
      throw new Error('Soundboard overlay manager not initialized');
    }
    console.log('[SoundboardOverlay] Calling overlayManager.close()');
    overlayManager.close();
    console.log('[SoundboardOverlay] Close completed');
    return { success: true };
  });

  ipcMain.handle('soundboard-overlay:minimize', async (event: IpcMainInvokeEvent) => {
    if (!overlayManager) throw new Error('Soundboard overlay manager not initialized');
    const window = overlayManager.getWindow();
    if (window && !window.isDestroyed()) {
      window.minimize();
    }
    return { success: true };
  });

  // Navigation
  ipcMain.handle('soundboard-overlay:navigate-to-url', async (event: IpcMainInvokeEvent, url: string) => {
    if (!overlayManager) throw new Error('Soundboard overlay manager not initialized');
    await overlayManager.navigateToUrl(url);
    return { success: true };
  });

  ipcMain.handle('soundboard-overlay:navigate-back', async (event: IpcMainInvokeEvent) => {
    if (!overlayManager) throw new Error('Soundboard overlay manager not initialized');
    overlayManager.navigateBack();
    return { success: true };
  });

  ipcMain.handle('soundboard-overlay:navigate-forward', async (event: IpcMainInvokeEvent) => {
    if (!overlayManager) throw new Error('Soundboard overlay manager not initialized');
    overlayManager.navigateForward();
    return { success: true };
  });

  ipcMain.handle('soundboard-overlay:refresh', async (event: IpcMainInvokeEvent) => {
    if (!overlayManager) throw new Error('Soundboard overlay manager not initialized');
    overlayManager.refresh();
    return { success: true };
  });

  // Attach/Detach BrowserView
  ipcMain.handle('soundboard-overlay:attach-view', async () => {
    if (!overlayManager) throw new Error('Soundboard overlay manager not initialized');
    overlayManager.attachView();
    return { success: true };
  });

  ipcMain.handle('soundboard-overlay:detach-view', async () => {
    if (!overlayManager) throw new Error('Soundboard overlay manager not initialized');
    overlayManager.detachView();
    return { success: true };
  });

  // Query current navigation state
  ipcMain.handle('soundboard-overlay:get-navigation-state', async (_event: IpcMainInvokeEvent) => {
    if (!overlayManager) throw new Error('Soundboard overlay manager not initialized');
    const window = overlayManager.getWindow();
    // No direct access here; state is pushed via events. Return basic success.
    return { success: true };
  });

  // Audio routing
  ipcMain.handle('soundboard-overlay:route-audio', async (event: IpcMainInvokeEvent, audioData?: any) => {
    if (!overlayManager) throw new Error('Soundboard overlay manager not initialized');

    // Send signal to main window that overlay audio is playing
    console.log('[SoundboardOverlay] Overlay audio started, signaling main window');

    // Send event to main window to handle audio routing
    const windows = require('electron').BrowserWindow.getAllWindows();
    const mainWindow = windows.find((win: any) => win.webContents.getURL().includes('index.html'));

    if (mainWindow) {
      mainWindow.webContents.send('soundboard:overlay-audio-started');
    }

    return { success: true };
  });

  // Setup audio bridge for direct routing
  ipcMain.handle('soundboard-overlay:setup-audio-bridge', async (event: IpcMainInvokeEvent) => {
    if (!overlayManager) {
      const error = 'Soundboard overlay manager not initialized';
      console.error('[SoundboardOverlay]', error);
      throw new Error(error);
    }

    console.log('[SoundboardOverlay] Setting up audio bridge for direct routing');

    try {
      // Validate that we have a BrowserView available
      const browserView = overlayManager.getBrowserView();
      if (!browserView || !browserView.webContents) {
        const error = 'BrowserView not available for audio bridge setup';
        console.error('[SoundboardOverlay]', error);
        return { success: false, error };
      }
      // Get audio settings first
      let settings;
      try {
        const { getSoundboardService } = require('../soundboard/soundboard-ipc');
        const service = getSoundboardService();
        settings = service ? service.getSettings() : null;
      } catch (settingsError) {
        console.warn('[SoundboardOverlay] Failed to get soundboard service settings:', settingsError);
        settings = null;
      }

      // Use default settings if service settings are not available
      if (!settings) {
        settings = {
          masterVolume: 0.7,
          headphonesVolume: 0.5,
          outputDevice: ''
        };
        console.log('[SoundboardOverlay] Using default audio settings');
      }

      // Tell the overlay to set up its own audio routing directly to both VB-Audio and headphones
      let settingsJson;
      try {
        settingsJson = JSON.stringify(settings);
        console.log('[SoundboardOverlay] Settings serialized successfully:', settingsJson.length, 'characters');
      } catch (serializeError) {
        console.error('[SoundboardOverlay] Failed to serialize settings:', serializeError);
        return { success: false, error: 'Settings serialization failed: ' + String(serializeError) };
      }

		const result = await browserView.webContents.executeJavaScript(`
			(async () => {
				try {
					console.log('🎵 Setting up direct audio routing in overlay...');
					const parsedSettings = ${settingsJson};
					
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
							element.muted = true; element.volume = 0;
							const source = audioContext.createMediaElementSource(element);
							source.connect(vbGainNode); source.connect(headphonesGainNode);
							attachedElements.add(element); attachedCount++;
						} catch (e) { console.warn('🎵 Failed to attach media element:', e?.message || e); }
					}
					document.querySelectorAll('audio, video').forEach((el) => attachMediaElement(el));
					const observer = new MutationObserver(mutations => {
						for (const mutation of mutations) {
							for (const node of mutation.addedNodes) {
								if (node.nodeType === Node.ELEMENT_NODE) {
									const el = node as Element;
									if ((el as any).tagName === 'AUDIO' || (el as any).tagName === 'VIDEO') { attachMediaElement(el); }
									else { (el as any).querySelectorAll?.('audio, video')?.forEach((m: any) => attachMediaElement(m)); }
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
					window.__soundboardMixer = { audioContext, vbGainNode, headphonesGainNode, vbAudio, headphonesAudio, observer, resumePlayback, vbDeviceId, get attachedCount() { return attachedCount; } };
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

        console.log('[SoundboardOverlay] Audio bridge setup result:', result);
        return result;
    } catch (error) {
      console.error('[SoundboardOverlay] Error setting up audio bridge:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMessage };
    }
  });

  // Stop audio bridge
  ipcMain.handle('soundboard-overlay:stop-audio-bridge', async (event: IpcMainInvokeEvent) => {
    if (!overlayManager) throw new Error('Soundboard overlay manager not initialized');

    console.log('[SoundboardOverlay] Stopping audio bridge');

    try {
      const browserView = overlayManager.getBrowserView();
      if (browserView && browserView.webContents) {
        const result = await browserView.webContents.executeJavaScript(`
          (async () => {
            try {
              console.log('🎵 Stopping direct audio routing in overlay...');
              
              // Stop and clean up audio elements
              if (window.overlayAudioElements) {
                window.overlayAudioElements.forEach(audio => {
                  try {
                    audio.pause();
                    if (audio.srcObject) {
                      audio.srcObject = null;
                    }
                  } catch (e) {
                    console.warn('Failed to stop overlay audio element:', e);
                  }
                });
                window.overlayAudioElements = [];
              }

              // Stop the mutation observer
              if (window.mediaObserverForSoundboard) {
                window.mediaObserverForSoundboard.disconnect();
                window.mediaObserverForSoundboard = null;
              }

              // Stop any audio contexts we created
              if (window.audioContextsForSoundboard) {
                window.audioContextsForSoundboard.forEach(ctx => {
                  try {
                    ctx.close();
                  } catch (e) {
                    console.warn('Failed to close audio context:', e);
                  }
                });
                window.audioContextsForSoundboard = [];
              }

              // Disconnect any media sources we created
              if (window.mediaSourcesForSoundboard) {
                window.mediaSourcesForSoundboard.forEach(source => {
                  try {
                    source.disconnect();
                  } catch (e) {
                    console.warn('Failed to disconnect media source:', e);
                  }
                });
                window.mediaSourcesForSoundboard = [];
              }

              console.log('🎵 Direct audio routing stopped successfully');
              return { success: true };
              
            } catch (error) {
              console.error('🎵 Failed to stop direct audio routing:', error);
              return { success: false, error: error.message };
            }
          })();
        `);

        console.log('[SoundboardOverlay] Audio bridge stop result:', result);
        return result;
      } else {
        return { success: false, error: 'Browser view not available' };
      }
    } catch (error) {
      console.error('[SoundboardOverlay] Error stopping audio bridge:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMessage };
    }
  });

  ipcMain.handle('soundboard-overlay:toggle-audio', async (event: IpcMainInvokeEvent) => {
    if (!overlayManager) throw new Error('Soundboard overlay manager not initialized');

    // Toggle audio routing state
    console.log('[SoundboardOverlay] Toggling audio routing');

    return { success: true };
  });

  // Handle overlay audio stop signal
  ipcMain.handle('soundboard-overlay:stop-audio', async (event: IpcMainInvokeEvent) => {
    if (!overlayManager) throw new Error('Soundboard overlay manager not initialized');

    // Send signal to main window that overlay audio has stopped
    console.log('[SoundboardOverlay] Overlay audio stopped, signaling main window');

    const windows = require('electron').BrowserWindow.getAllWindows();
    const mainWindow = windows.find((win: any) => win.webContents.getURL().includes('index.html'));

    if (mainWindow) {
      mainWindow.webContents.send('soundboard:overlay-audio-stopped');
    }

    return { success: true };
  });

  // Note: Audio routing is now handled directly in the BrowserView context
  // No need for IPC stream forwarding since MediaStream objects cannot be serialized

  // Settings
  ipcMain.handle('soundboard-overlay:update-settings', async (event: IpcMainInvokeEvent, settings: any) => {
    if (!overlayManager) throw new Error('Soundboard overlay manager not initialized');
    overlayManager.updateSettings(settings);
    return { success: true };
  });

  ipcMain.handle('soundboard-overlay:get-state', async (event: IpcMainInvokeEvent) => {
    if (!overlayManager) throw new Error('Soundboard overlay manager not initialized');
    return {
      isVisible: overlayManager.isOverlayVisible(),
      window: overlayManager.getWindow() ? {
        bounds: overlayManager.getWindow()?.getBounds(),
        isDestroyed: overlayManager.getWindow()?.isDestroyed()
      } : null
    };
  });
}

export function getSoundboardOverlayManager(): SoundboardOverlayManager | null {
  return overlayManager;
}