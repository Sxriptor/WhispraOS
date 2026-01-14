const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // PTT events
    onPTTAudioData: (callback) => {
        ipcRenderer.on('ptt-audio-data', (event, data) => callback(data));
    },
    onPTTShow: (callback) => {
        ipcRenderer.on('ptt-show', () => callback());
    },
    onPTTHide: (callback) => {
        ipcRenderer.on('ptt-hide', () => callback());
    },
    
    // Bidirectional events
    onBidiAudioData: (callback) => {
        ipcRenderer.on('bidi-audio-data', (event, data) => callback(data));
    },
    onBidiShow: (callback) => {
        ipcRenderer.on('bidi-show', () => callback());
    },
    onBidiHide: (callback) => {
        ipcRenderer.on('bidi-hide', () => callback());
    }
});
