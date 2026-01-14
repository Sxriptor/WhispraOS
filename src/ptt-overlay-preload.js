const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    onPTTAudioData: (callback) => {
        ipcRenderer.on('ptt-audio-data', (event, data) => callback(data));
    }
});
