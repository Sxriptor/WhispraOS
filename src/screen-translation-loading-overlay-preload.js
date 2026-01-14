const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    onScreenTranslationLoadingMessage: (callback) => {
        ipcRenderer.on('screen-translation-loading:update-message', (_event, message) => callback(message));
    }
});

console.log('Screen translation loading overlay preload script loaded');

