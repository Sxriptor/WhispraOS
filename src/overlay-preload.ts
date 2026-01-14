import { contextBridge, ipcRenderer } from 'electron';

/**
 * Overlay preload script for secure IPC communication
 */

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Send messages to main process
  sendToMain: (channel: string, data?: any) => {
    ipcRenderer.invoke(channel, data);
  },
  invoke: (channel: string, data?: any) => ipcRenderer.invoke(channel, data),

  // Listen for mode changes
  onModeChange: (callback: (mode: string) => void) => {
    ipcRenderer.on('overlay:mode-change', (_event, mode) => callback(mode));
  },

  // Listen for state updates
  onStateUpdate: (callback: (state: any) => void) => {
    ipcRenderer.on('overlay:state-update', (_event, state) => callback(state));
  },

  // Listen for microphone state updates
  onMicStateUpdate: (callback: (micState: any) => void) => {
    ipcRenderer.on('overlay:mic-state-update', (_event, micState) => callback(micState));
  },

  // Listen for bidirectional state updates
  onBidirectionalStateUpdate: (callback: (bidiState: any) => void) => {
    ipcRenderer.on('overlay:bidirectional-state-update', (_event, bidiState) => callback(bidiState));
  },

  // Listen for translation results
  onTranslationResult: (callback: (result: any) => void) => {
    ipcRenderer.on('overlay:translation-result', (_event, result) => callback(result));
  },

  // Listen for translation state changes
  onTranslationStateChanged: (callback: (state: any) => void) => {
    ipcRenderer.on('translation:state-changed', (_event, state) => callback(state));
  },

  // Listen for config updates
  onConfigUpdated: (callback: (config: any) => void) => {
    ipcRenderer.on('config:updated', (_event, config) => callback(config));
  },

  // Listen for ping health checks
  onPing: (callback: () => void) => {
    ipcRenderer.on('overlay:ping', () => {
      // Send pong back to main process
      ipcRenderer.send('overlay:pong');
      callback();
    });
  },

  // Listen for cleanup requests
  onCleanupResources: (callback: () => void) => {
    ipcRenderer.on('overlay:cleanup-resources', () => callback());
  },

  // Get desktop sources for screen capture
  getDesktopSources: (types: Array<'screen' | 'window'>) => {
    return ipcRenderer.invoke('get-desktop-sources', types);
  },

  // Remove listeners
  removeAllListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel);
  },

  // Error recovery
  reportError: (error: string) => {
    ipcRenderer.invoke('overlay:report-error', { error, timestamp: Date.now() });
  }
});

// Log that preload script has loaded
console.log('Overlay preload script loaded');