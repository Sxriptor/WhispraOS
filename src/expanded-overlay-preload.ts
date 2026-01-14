import { contextBridge, ipcRenderer } from 'electron';

/**
 * Expanded overlay preload script for secure IPC communication
 */

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Send messages to main process
  sendToMain: (channel: string, data?: any) => {
    ipcRenderer.invoke(channel, data);
  },
  invoke: (channel: string, data?: any) => ipcRenderer.invoke(channel, data),

  // Listen for state updates
  onStateUpdate: (callback: (state: any) => void) => {
    ipcRenderer.on('expanded-overlay:state-update', (_event, state) => callback(state));
  },

  // Listen for translation results
  onTranslationResult: (callback: (result: any) => void) => {
    ipcRenderer.on('expanded-overlay:translation-result', (_event, result) => callback(result));
  },

  // Listen for translation state changes
  onTranslationStateChanged: (callback: (state: any) => void) => {
    ipcRenderer.on('translation:state-changed', (_event, state) => {
      console.log('[Expanded Overlay Preload] Received translation:state-changed:', state);
      callback(state);
    });
  },

  // Listen for config updates
  onConfigUpdated: (callback: (config: any) => void) => {
    ipcRenderer.on('config:updated', (_event, config) => callback(config));
  },

  // Listen for mode changes
  onModeChange: (callback: (mode: string) => void) => {
    ipcRenderer.on('expanded-overlay:mode-change', (_event, mode) => callback(mode));
  },

  // Listen for microphone state updates
  onMicStateUpdate: (callback: (micState: any) => void) => {
    ipcRenderer.on('expanded-overlay:mic-state-update', (_event, micState) => callback(micState));
  },

  // Listen for bidirectional state updates
  onBidirectionalStateUpdate: (callback: (bidiState: any) => void) => {
    ipcRenderer.on('overlay:bidirectional-state-update', (_event, bidiState) => callback(bidiState));
  },

  // Listen for ping health checks
  onPing: (callback: () => void) => {
    ipcRenderer.on('expanded-overlay:ping', () => {
      // Send pong back to main process
      ipcRenderer.send('expanded-overlay:pong');
      callback();
    });
  },

  // Listen for cleanup requests
  onCleanupResources: (callback: () => void) => {
    ipcRenderer.on('expanded-overlay:cleanup-resources', () => callback());
  },

  // Listen for language changes
  onLanguageChange: (callback: (languageCode: string) => void) => {
    ipcRenderer.on('onLanguageChange', (_event, languageCode) => {
      console.log('[Expanded Overlay Preload] Received language change:', languageCode);
      callback(languageCode);
    });
  },

  // Get desktop sources for screen capture
  getDesktopSources: (types: Array<'screen' | 'window'>) => {
    return ipcRenderer.invoke('get-desktop-sources', types);
  },

  // Remove listeners
  removeAllListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel);
  },

  // Generic listener for additional channels
  on: (channel: string, callback: (data: any) => void) => {
    ipcRenderer.on(channel, (_event, data) => callback(data));
  },

  // Error recovery
  reportError: (error: string) => {
    ipcRenderer.invoke('expanded-overlay:report-error', { error, timestamp: Date.now() });
  },

  // GPU Paddle API
  gpuPaddle: {
    showOverlay: () => ipcRenderer.invoke('gpu-paddle:show-overlay'),
    close: () => ipcRenderer.invoke('gpu-paddle:close-overlay'),
    detectCUDA: () => ipcRenderer.invoke('gpu-paddle:detect-cuda'),
    checkStatus: () => ipcRenderer.invoke('gpu-paddle:check-status'),
    quickStatus: () => ipcRenderer.invoke('gpu-paddle:quick-status'),
    install: (cudaVersion: string) => ipcRenderer.invoke('gpu-paddle:install', cudaVersion),
    getGpuMode: () => ipcRenderer.invoke('gpu-paddle:get-gpu-mode'),
    setGpuMode: (mode: 'normal' | 'fast') => ipcRenderer.invoke('gpu-paddle:set-gpu-mode', mode)
  },

  // Listen for GPU mode changes
  onGpuModeChanged: (callback: (mode: string) => void) => {
    ipcRenderer.on('gpu-mode-changed', (_event, mode) => callback(mode));
  },

  // Send generic messages
  send: (channel: string, data?: any) => {
    ipcRenderer.send(channel, data);
  },

  // Soundboard API - same as main preload
  soundboard: {
    addSound: (filePath: string, slot: number) => ipcRenderer.invoke('soundboard:add-sound', filePath, slot),
    removeSound: (slot: number) => ipcRenderer.invoke('soundboard:remove-sound', slot),
    renameSound: (slot: number, newLabel: string) => ipcRenderer.invoke('soundboard:rename-sound', slot, newLabel),
    getAllSounds: () => ipcRenderer.invoke('soundboard:get-all-sounds'),
    getSoundBySlot: (slot: number) => ipcRenderer.invoke('soundboard:get-sound-by-slot', slot),
    playSound: (slot: number) => ipcRenderer.invoke('soundboard:play-sound', slot),
    stopSound: (slot: number) => ipcRenderer.invoke('soundboard:stop-sound', slot),
    stopAllSounds: () => ipcRenderer.invoke('soundboard:stop-all-sounds'),
    isPlaying: (slot: number) => ipcRenderer.invoke('soundboard:is-playing', slot),
    getSettings: () => ipcRenderer.invoke('soundboard:get-settings'),
    updateSettings: (settings: any) => ipcRenderer.invoke('soundboard:update-settings', settings),
    getAudioDevices: () => ipcRenderer.invoke('soundboard:get-audio-devices'),
    showFilePicker: () => ipcRenderer.invoke('soundboard:show-file-picker'),
    addSoundsFromPicker: (filePaths: string[]) => ipcRenderer.invoke('soundboard:add-sounds-from-picker', filePaths),
    validateAudioFile: (filePath: string) => ipcRenderer.invoke('soundboard:validate-audio-file', filePath),
    loadAudioBuffer: (filePath: string) => ipcRenderer.invoke('soundboard:load-audio-buffer', filePath),
    updateHotkey: (slot: number, hotkey: string) => ipcRenderer.invoke('soundboard:update-hotkey', slot, hotkey),
    onSoundLoaded: (callback: (sound: any) => void) => ipcRenderer.on('soundboard:sound-loaded', (_, sound) => callback(sound)),
    onSoundPlayed: (callback: (data: any) => void) => ipcRenderer.on('soundboard:sound-played', (_, data) => callback(data)),
    onSoundStopped: (callback: (data: any) => void) => ipcRenderer.on('soundboard:sound-stopped', (_, data) => callback(data)),
    onVolumeChanged: (callback: (volume: number) => void) => ipcRenderer.on('soundboard:volume-changed', (_, volume) => callback(volume)),
    onHeadphonesVolumeChanged: (callback: (volume: number) => void) => ipcRenderer.on('soundboard:headphones-volume-changed', (_, volume) => callback(volume))
  }
});

// Log that preload script has loaded
console.log('Expanded overlay preload script loaded');