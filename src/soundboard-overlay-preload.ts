import { contextBridge, ipcRenderer } from 'electron';

console.log('[soundboard-overlay-preload] Preload script initializing...');

contextBridge.exposeInMainWorld('electronAPI', {
	// Send messages to main process (same pattern as expanded overlay)
	sendToMain: (channel: string, data?: any) => {
		ipcRenderer.invoke(channel, data);
	},
	invoke: (channel: string, data?: any) => ipcRenderer.invoke(channel, data),

	// Window management
	close: () => ipcRenderer.invoke('soundboard-overlay:close'),
	minimize: () => ipcRenderer.invoke('soundboard-overlay:minimize'),
	hide: () => ipcRenderer.invoke('soundboard-overlay:hide'),
	show: () => ipcRenderer.invoke('soundboard-overlay:show'),
	toggle: () => ipcRenderer.invoke('soundboard-overlay:toggle'),

	// Navigation
	navigateToUrl: (url: string) => ipcRenderer.invoke('soundboard-overlay:navigate-to-url', url),
	navigateBack: () => ipcRenderer.invoke('soundboard-overlay:navigate-back'),
	navigateForward: () => ipcRenderer.invoke('soundboard-overlay:navigate-forward'),
	refresh: () => ipcRenderer.invoke('soundboard-overlay:refresh'),
	attachView: () => ipcRenderer.invoke('soundboard-overlay:attach-view'),
	detachView: () => ipcRenderer.invoke('soundboard-overlay:detach-view'),

	// Audio routing
	routeAudio: (audioData?: any) => ipcRenderer.invoke('soundboard-overlay:route-audio', audioData),
	stopAudio: () => ipcRenderer.invoke('soundboard-overlay:stop-audio'),
	toggleAudio: () => ipcRenderer.invoke('soundboard-overlay:toggle-audio'),

	// Settings
	updateSettings: (settings: any) => ipcRenderer.invoke('soundboard-overlay:update-settings', settings),
	getState: () => ipcRenderer.invoke('soundboard-overlay:get-state'),

	// Event listeners
	on: (channel: string, callback: (...args: any[]) => void) => {
		ipcRenderer.on(channel, callback);
	},
	off: (channel: string, callback: (...args: any[]) => void) => {
		ipcRenderer.off(channel, callback);
	}
});

// Live volume updates for the BrowserView mixer (direct + postMessage fallback)
function postVolumes(vb?: number, hp?: number): void {
	try { window.postMessage({ type: 'overlay:set-volumes', vb, hp }, '*'); } catch {}
}

ipcRenderer.on('soundboard:volume-changed', (_event, volume: number) => {
	try {
		const mixer = (window as any).__soundboardMixer;
		if (mixer?.vbGainNode) {
			mixer.vbGainNode.gain.value = volume;
			console.log('[overlay-preload] VB volume updated:', volume);
		}
	} catch {}
	postVolumes(volume, undefined);
});

ipcRenderer.on('soundboard:headphones-volume-changed', (_event, volume: number) => {
	try {
		const mixer = (window as any).__soundboardMixer;
		if (mixer?.headphonesGainNode) {
			mixer.headphonesGainNode.gain.value = volume;
			console.log('[overlay-preload] Headphones volume updated:', volume);
		}
	} catch {}
	postVolumes(undefined, volume);
});

// Ensure shutdown message is sent on close to stop any remaining playback fast
ipcRenderer.on('soundboard-overlay:audio-stopped', () => {
	try { window.postMessage({ type: 'overlay:shutdown' }, '*'); } catch {}
});

console.log('[soundboard-overlay-preload] Preload script initialized');