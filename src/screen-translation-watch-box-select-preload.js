const { contextBridge, ipcRenderer } = require('electron');

// Expose safe IPC methods to the renderer
contextBridge.exposeInMainWorld('electronAPI', {
    send: (channel, data) => {
        // Whitelist allowed channels
        const validChannels = [
            'screen-translation-watch-box-selected',
            'screen-translation-watch-box-close'
        ];
        if (validChannels.includes(channel)) {
            ipcRenderer.send(channel, data);
        }
    }
});

console.log('Watch box selection preload script loaded');

