const { contextBridge, ipcRenderer } = require('electron');

// Expose safe APIs to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // Screen translation overlay APIs
  onUpdateOCRResults: (callback) => {
    ipcRenderer.on('screen-translation:update-ocr', (event, data) => {
      callback(data);
    });
  },

  onUpdateTextBoxes: (callback) => {
    ipcRenderer.on('screen-translation:update-text-boxes', (event, data) => {
      callback(data);
    });
  },

  onClearAllText: (callback) => {
    ipcRenderer.on('screen-translation:clear-all', () => {
      callback();
    });
  },

  onToggleDebugMode: (callback) => {
    ipcRenderer.on('screen-translation:toggle-debug', () => {
      callback();
    });
  },

  // Send messages to main process
  sendToMain: (channel, data) => {
    const validChannels = [
      'screen-translation:overlay-ready',
      'screen-translation:overlay-error'
    ];

    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    }
  },

  // Development utilities
  openDevTools: () => {
    if (process.env.NODE_ENV === 'development') {
      ipcRenderer.send('screen-translation:open-devtools');
    }
  }
});

// Handle overlay ready event
window.addEventListener('DOMContentLoaded', () => {
  console.log('📺 Screen translation overlay preload script loaded');

  // Notify main process that overlay is ready
  ipcRenderer.send('screen-translation:overlay-ready', {
    timestamp: Date.now(),
    userAgent: navigator.userAgent,
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight
    }
  });
});