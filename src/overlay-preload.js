const { contextBridge, ipcRenderer } = require('electron');

/**
 * Overlay preload script for secure IPC communication
 */

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Send messages to main process (wrap as IPCRequest)
  sendToMain: (channel, data) => {
    const request = {
      id: Date.now().toString(),
      timestamp: Date.now(),
      payload: data
    };
    ipcRenderer.send(channel, request);
  },

  // Listen for mode changes
  onModeChange: (callback) => {
    ipcRenderer.on('overlay:mode-change', (_event, mode) => callback(mode));
  },

  // Listen for state updates
  onStateUpdate: (callback) => {
    ipcRenderer.on('overlay:state-update', (_event, state) => callback(state));
  },

  // Listen for microphone state updates
  onMicStateUpdate: (callback) => {
    ipcRenderer.on('overlay:mic-state-update', (_event, micState) => callback(micState));
  },

  // Listen for bidirectional state updates
  onBidirectionalStateUpdate: (callback) => {
    ipcRenderer.on('overlay:bidirectional-state-update', (_event, bidiState) => callback(bidiState));
  },

  // Listen for translation results
  onTranslationResult: (callback) => {
    ipcRenderer.on('overlay:translation-result', (_event, result) => callback(result));
  },

  // Listen for config updates from main
  onConfigUpdated: (callback) => {
    ipcRenderer.on('config:updated', (_event, cfg) => callback(cfg));
  },

  // Listen for cleanup requests
  onCleanupResources: (callback) => {
    ipcRenderer.on('overlay:cleanup-resources', (_event) => callback());
  },

  // Listen for screen translation data
  onScreenTranslationData: (callback) => {
    ipcRenderer.on('screen-translation-data', (_event, data) => callback(data));
  },

  // Invoke helper for overlay IPC
  invoke: (channel, data) => ipcRenderer.invoke(channel, data),

  // Remove listeners
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  }
});

// Log that preload script has loaded
console.log('Overlay preload script loaded');