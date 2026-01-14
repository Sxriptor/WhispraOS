import { contextBridge, ipcRenderer } from 'electron';

/**
 * PaddlePaddle API bridge for renderer process
 */
const paddleAPI = {
  // Check if PaddlePaddle and PaddleOCR are installed
  checkInstallation: (): Promise<{
    success: boolean;
    isInstalled: boolean;
    hasLanguagePacks?: boolean;
    error?: string;
    details?: string;
  }> => ipcRenderer.invoke('paddlepaddle-check:check-installation'),

  // Install PaddlePaddle and PaddleOCR
  install: (): Promise<{
    success: boolean;
    error?: string;
  }> => ipcRenderer.invoke('paddlepaddle-check:install'),

  // Complete the PaddlePaddle check process
  complete: (data: { cancelled: boolean }): Promise<{
    success: boolean;
    cancelled: boolean;
    error?: string;
  }> => ipcRenderer.invoke('paddlepaddle-check:complete', data),

  // Show the PaddlePaddle check overlay
  showOverlay: (): void => ipcRenderer.send('paddlepaddle-check:show-overlay'),

  // Event listeners for PaddlePaddle status updates
  onInstallationProgress: (callback: (progress: {
    stage: string;
    progress: number;
    message: string;
  }) => void): void => {
    ipcRenderer.on('paddlepaddle:installation-progress', (_, progress) => callback(progress));
  },

  onInstallationComplete: (callback: (result: {
    success: boolean;
    error?: string;
  }) => void): void => {
    ipcRenderer.on('paddlepaddle:installation-complete', (_, result) => callback(result));
  },

  // Remove event listeners
  removeAllListeners: (): void => {
    ipcRenderer.removeAllListeners('paddlepaddle:installation-progress');
    ipcRenderer.removeAllListeners('paddlepaddle:installation-complete');
  }
};

// Expose the paddle API to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  paddle: paddleAPI
});