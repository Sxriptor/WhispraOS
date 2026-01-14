import { contextBridge, ipcRenderer } from 'electron';

/**
 * Mini overlay preload script - handles IPC communication for status indicators
 */

contextBridge.exposeInMainWorld('electronAPI', {
  // Listen for audio detection state
  onAudioDetected: (callback: (isDetected: boolean) => void) => {
    ipcRenderer.on('mini-overlay:audio-detected', (_event, isDetected) => callback(isDetected));
  },

  // Listen for voice translation state
  onVoiceTranslation: (callback: (isActive: boolean) => void) => {
    ipcRenderer.on('mini-overlay:voice-translation', (_event, isActive) => callback(isActive));
  },

  // Listen for screen translation state
  onScreenTranslation: (callback: (state: 'off' | 'processing' | 'showing') => void) => {
    ipcRenderer.on('mini-overlay:screen-translation', (_event, state) => callback(state));
  },

  // Listen for status text updates
  onStatusUpdate: (callback: (status: string) => void) => {
    ipcRenderer.on('mini-overlay:status-update', (_event, status) => callback(status));
  },

  // Listen for ping health checks
  onPing: (callback: () => void) => {
    ipcRenderer.on('mini-overlay:ping', () => {
      // Send pong back to main process
      ipcRenderer.send('mini-overlay:pong');
      callback();
    });
  },

  // Listen for cleanup requests
  onCleanupResources: (callback: () => void) => {
    ipcRenderer.on('mini-overlay:cleanup-resources', () => callback());
  },

  // Error recovery
  reportError: (error: string) => {
    ipcRenderer.invoke('mini-overlay:report-error', { error, timestamp: Date.now() });
  },

  // Send events back to main process
  sendToMain: (channel: string, data: any) => {
    ipcRenderer.send(channel, data);
  },

  // Request data from main process
  requestFromMain: (channel: string, data: any) => {
    return ipcRenderer.invoke(channel, data);
  }
});

// Log that preload script has loaded
console.log('Mini overlay preload script loaded');
