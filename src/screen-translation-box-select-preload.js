const { contextBridge, ipcRenderer } = require('electron');

// Expose safe IPC methods to the renderer
contextBridge.exposeInMainWorld('electronAPI', {
    send: (channel, data) => {
        // Whitelist allowed channels
        const validChannels = [
            'screen-translation-box-selected',
            'screen-translation-box-close'
        ];
        if (validChannels.includes(channel)) {
            ipcRenderer.send(channel, data);
        }
    }
});

console.log('Box selection preload script loaded');
