import { contextBridge, ipcRenderer } from 'electron';
import type { DesktopCapturerSource } from 'electron';
console.log('[preload] Preload script initializing...');
console.log('[preload] Preload script loaded');

contextBridge.exposeInMainWorld('electronAPI', {
	platform: process.platform,
	versions: process.versions,
	invoke: (channel: string, request: any): Promise<any> => ipcRenderer.invoke(channel, request),
	on: (channel: string, callback: (...args: any[]) => void) => ipcRenderer.on(channel, callback),
	off: (channel: string, callback: (...args: any[]) => void) => ipcRenderer.off(channel, callback),
	send: (channel: string, ...args: any[]) => ipcRenderer.send(channel, ...args),
	sendToMain: (channel: string, data: any) => ipcRenderer.send(channel, data),

	// Soundboard API
	soundboard: {
		addSound: (filePath: string, slot: number) => ipcRenderer.invoke('soundboard:add-sound', filePath, slot),
		removeSound: (slot: number) => ipcRenderer.invoke('soundboard:remove-sound', slot),
		renameSound: (slot: number, newLabel: string) => ipcRenderer.invoke('soundboard:rename-sound', slot, newLabel),
		getAllSounds: () => ipcRenderer.invoke('soundboard:get-all-sounds'),
		getSoundBySlot: (slot: number) => ipcRenderer.invoke('soundboard:get-sound-by-slot', slot),
		playSound: (slot: number) => ipcRenderer.invoke('soundboard:play-sound', slot),
		stopSound: (slot: number) => ipcRenderer.invoke('soundboard:stop-sound', slot),
		stopAllSounds: () => ipcRenderer.invoke('soundboard:stop-all-sounds'),
		isPlaying: (slot: number) => ipcRenderer.invoke('soundboard:is-playing', slot),
		getSettings: () => ipcRenderer.invoke('soundboard:get-settings'),
		updateSettings: (settings: any) => ipcRenderer.invoke('soundboard:update-settings', settings),
		getAudioDevices: () => ipcRenderer.invoke('soundboard:get-audio-devices'),
		showFilePicker: () => ipcRenderer.invoke('soundboard:show-file-picker'),
		addSoundsFromPicker: (filePaths: string[]) => ipcRenderer.invoke('soundboard:add-sounds-from-picker', filePaths),
		validateAudioFile: (filePath: string) => ipcRenderer.invoke('soundboard:validate-audio-file', filePath),
		loadAudioBuffer: (filePath: string) => ipcRenderer.invoke('soundboard:load-audio-buffer', filePath),
		updateHotkey: (slot: number, hotkey: string) => ipcRenderer.invoke('soundboard:update-hotkey', slot, hotkey),
		onSoundLoaded: (callback: (sound: any) => void) => ipcRenderer.on('soundboard:sound-loaded', (_, sound) => callback(sound)),
		onSoundPlayed: (callback: (data: any) => void) => ipcRenderer.on('soundboard:sound-played', (_, data) => callback(data)),
		onSoundStopped: (callback: (data: any) => void) => ipcRenderer.on('soundboard:sound-stopped', (_, data) => callback(data)),
		onSoundError: (callback: (error: any) => void) => ipcRenderer.on('soundboard:sound-error', (_, error) => callback(error)),
		onDeviceChanged: (callback: (deviceId: string) => void) => ipcRenderer.on('soundboard:device-changed', (_, deviceId) => callback(deviceId)),
		onVolumeChanged: (callback: (volume: number) => void) => ipcRenderer.on('soundboard:volume-changed', (_, volume) => callback(volume)),
		onHeadphonesVolumeChanged: (callback: (volume: number) => void) => ipcRenderer.on('soundboard:headphones-volume-changed', (_, volume) => callback(volume))
	},

	setupRealTimeAudioPlayback: (callback: (data: any) => void) => {
		ipcRenderer.on('realtime-audio-playback', (_event, data) => callback(data));
	},
	setupTestAudioPlayback: (callback: (data: any) => void) => {
		ipcRenderer.on('test-audio-playback', (_event, data) => callback(data));
	},
	setupRealTimeTranslationAudio: (callback: (data: any) => void) => {
		ipcRenderer.on('realtime-translation-audio', (_event, data) => callback(data));
	},
	setupClearAudioCapture: (callback: (data: any) => void) => {
		ipcRenderer.on('clear-audio-capture', (_event, data) => callback(data));
	},
	setupWasapiWavCapture: (callback: (data: Buffer) => void) => {
		ipcRenderer.on('wasapi:wav', (_event, data) => callback(data));
	},
	setupWasapiUtteranceWav: (callback: (data: Buffer) => void) => {
		ipcRenderer.on('wasapi:utterance-wav', (_event, data) => callback(data));
	},
	// Fixed-size chunked WASAPI capture for streaming transcription
	setupWasapiChunkWav: (callback: (data: Buffer) => void) => {
		ipcRenderer.on('wasapi:chunk-wav', (_event, data) => callback(data));
	},

	getDesktopSources: async (types: Array<'screen' | 'window'>) => {
		const sources = await ipcRenderer.invoke('get-desktop-sources', types);
		return sources.map((s: DesktopCapturerSource) => ({ id: s.id, name: s.name }));
	},

	getDisplays: async () => {
		return ipcRenderer.invoke('get-displays');
	},

	// Enhanced WASAPI loopback (Windows only) with VAD and process targeting
	startPerAppCapture: (pid: number) => {
		return ipcRenderer.invoke('wasapi:start-capture', pid);
	},
	startCaptureByProcess: (processName: string) => {
		return ipcRenderer.invoke('wasapi:start-capture-by-process', processName);
	},
	startCaptureExcludeCurrent: () => {
		return ipcRenderer.invoke('wasapi:start-capture-exclude-current');
	},
	stopPerAppCapture: () => {
		return ipcRenderer.invoke('wasapi:stop-capture');
	},
	findAudioPidForProcess: (processName: string) => {
		return ipcRenderer.invoke('find-audio-pid-for-process', processName);
	},
	enumerateAudioSessions: () => {
		return ipcRenderer.invoke('enumerate-audio-sessions');
	},

	// Voice boost for whisper-level speech detection
	setVoiceBoostEnabled: (enabled: boolean) => {
		return ipcRenderer.invoke('voice-boost:set-enabled', enabled);
	},
	setVoiceBoostLevel: (level: number) => {
		return ipcRenderer.invoke('voice-boost:set-level', level);
	},
	getVoiceBoostSettings: () => {
		return ipcRenderer.invoke('voice-boost:get-settings');
	},

	// TTS playback tracking for audio filtering
	notifyTtsPlaybackStart: (duration?: number) => {
		return ipcRenderer.invoke('tts:playback-start', {
			id: Date.now().toString(),
			timestamp: Date.now(),
			payload: { duration }
		});
	},
	notifyTtsPlaybackEnd: () => {
		return ipcRenderer.invoke('tts:playback-end', {
			id: Date.now().toString(),
			timestamp: Date.now(),
			payload: {}
		});
	},

	// Global hotkeys bridge
	setupGlobalHotkeys: (handlers: { onPttPress?: () => void; onPttRelease?: () => void; onToggleBidirectional?: () => void; onToggleScreenTranslation?: () => void; onScreenTranslationBoxSelect?: () => void; onScreenTranslationWatchBoxSelect?: () => void }) => {
		if (handlers?.onPttPress) ipcRenderer.on('translation-start', handlers.onPttPress);
		if (handlers?.onPttRelease) ipcRenderer.on('translation-stop', handlers.onPttRelease);
		if (handlers?.onToggleBidirectional) ipcRenderer.on('bidirectional-toggle', handlers.onToggleBidirectional);
		if (handlers?.onToggleScreenTranslation) ipcRenderer.on('screen-translation-toggle', handlers.onToggleScreenTranslation);
		if (handlers?.onScreenTranslationBoxSelect) ipcRenderer.on('screen-translation-box-select', handlers.onScreenTranslationBoxSelect);
		if (handlers?.onScreenTranslationWatchBoxSelect) ipcRenderer.on('screen-translation-watch-box-select', handlers.onScreenTranslationWatchBoxSelect);
	},

	// Screen translation events
	onScreenTranslationStopped: (callback: () => void) => ipcRenderer.on('screen-translation:stopped', callback),
	onPaddleWarmupStarted: (callback: () => void) => ipcRenderer.on('paddle-warmup-started', callback),
	onPaddleWarmupCompleted: (callback: () => void) => ipcRenderer.on('paddle-warmup-completed', callback),

	// Auth bridge
	startSignIn: () => ipcRenderer.invoke('auth:start-sign-in'),
	signOut: () => ipcRenderer.invoke('auth:sign-out'),
	onSignedIn: (cb: () => void) => ipcRenderer.on('auth:signed-in', cb),
	onSubscriptionRequired: (cb: (data: { message: string; subscriptionStatus?: string }) => void) => ipcRenderer.on('auth:subscription-required', (_event, data) => cb(data)),
	onSignInError: (cb: (data: { message: string }) => void) => ipcRenderer.on('auth:sign-in-error', (_event, data) => cb(data)),
	onSubscriptionExpired: (cb: (data: { message: string; reason: string }) => void) => ipcRenderer.on('subscription-expired', (_event, data) => cb(data)),
	onAccessExpired: (cb: (data: { message: string; reason: string; isTrialActive?: boolean; hasActiveSubscription?: boolean; trialDaysRemaining?: number }) => void) => ipcRenderer.on('access-expired', (_event, data) => cb(data)),
	checkSubscriptionStatus: () => ipcRenderer.invoke('subscription:check-status'),
	checkUserAccess: () => ipcRenderer.invoke('subscription:check-access'),
	forceRefreshSubscription: (reason: string) => ipcRenderer.invoke('subscription:force-refresh', reason),
	notifyTokenChanged: (newToken: string | null) => ipcRenderer.invoke('subscription:token-changed', newToken),
	notifyApiKeysChanged: () => ipcRenderer.invoke('subscription:api-keys-changed'),
	notifyManagedModeChanged: () => ipcRenderer.invoke('subscription:managed-mode-changed'),
	refreshSubscriptionStatus: () => ipcRenderer.invoke('subscription:refresh'),
	forceSubscriptionCheck: () => ipcRenderer.invoke('subscription:force-check'),
	getTrialInfo: () => ipcRenderer.invoke('auth:get-trial-info'),
	getCurrentUserId: () => ipcRenderer.invoke('subscription:get-user-id'),
	onSubscriptionPlanUpdated: (cb: (data: { oldPlan: string | null; newPlan: string; subscriptionEndsAt?: string; subscriptionDaysRemaining?: number }) => void) => ipcRenderer.on('subscription:plan-updated', (_event, data) => cb(data)),

	// Device check bridge
	deviceCheckComplete: (result?: { hasCableInput: boolean; hasCableOutput: boolean; isComplete: boolean }) => ipcRenderer.invoke('device-check:complete', result),
	openExternal: (url: string) => ipcRenderer.invoke('open-external', url),
	openSoundSettings: () => ipcRenderer.invoke('open-sound-settings'),
	openAudioMIDISetup: () => ipcRenderer.invoke('open-audio-midi-setup'),
	runDiagnostic: () => ipcRenderer.invoke('run-diagnostic'),

	// VB Audio setup bridge (Windows)
	closeVbAudioSetup: () => ipcRenderer.invoke('vb-audio-setup:close'),
	setVbAudioSetupShown: (shown: boolean) => ipcRenderer.invoke('vb-audio-setup:set-shown', shown),
	showVbAudioSetup: () => ipcRenderer.invoke('vb-audio-setup:show'),

	// BlackHole setup bridge (macOS)
	closeBlackHoleSetup: () => ipcRenderer.invoke('blackhole-setup:close'),
	setBlackHoleSetupShown: (shown: boolean) => ipcRenderer.invoke('blackhole-setup:set-shown', shown),
	showBlackHoleSetup: () => ipcRenderer.invoke('blackhole-setup:show'),

	// API setup bridge
	closeApiSetup: () => ipcRenderer.invoke('api-setup:close'),
	showApiSetup: () => ipcRenderer.invoke('api-setup:show'),

	// Python check bridge
	checkPythonVersion: () => ipcRenderer.invoke('python-check:check-version'),
	downloadAndInstallPython: () => ipcRenderer.invoke('python-check:download-install'),
	pythonCheckComplete: (data: { cancelled: boolean }) => ipcRenderer.invoke('python-check:complete', data),

	// PaddlePaddle API
	paddle: {
		checkInstallation: () => ipcRenderer.invoke('paddlepaddle-check:check-installation'),
		install: () => ipcRenderer.invoke('paddlepaddle-check:install'),
		complete: (data: { cancelled: boolean }) => ipcRenderer.invoke('paddlepaddle-check:complete', data),
		triggerWarmup: (language: string) => ipcRenderer.invoke('paddle:trigger-warmup', { language }),
		showOverlay: () => ipcRenderer.send('paddlepaddle-check:show-overlay'),
		onInstallationProgress: (callback: (progress: any) => void) => {
			ipcRenderer.on('paddlepaddle:installation-progress', (_, progress) => callback(progress));
		},
		onInstallationComplete: (callback: (result: any) => void) => {
			ipcRenderer.on('paddlepaddle:installation-complete', (_, result) => callback(result));
		},
		removeAllListeners: () => {
			ipcRenderer.removeAllListeners('paddlepaddle:installation-progress');
			ipcRenderer.removeAllListeners('paddlepaddle:installation-complete');
		}
	},

	// GPU Paddle API
	gpuPaddle: {
		showOverlay: () => ipcRenderer.invoke('gpu-paddle:show-overlay'),
		close: () => ipcRenderer.invoke('gpu-paddle:close-overlay'),
		detectCUDA: () => ipcRenderer.invoke('gpu-paddle:detect-cuda'),
		checkStatus: () => ipcRenderer.invoke('gpu-paddle:check-status'),
		quickStatus: () => ipcRenderer.invoke('gpu-paddle:quick-status'),
		install: (cudaVersion: string) => ipcRenderer.invoke('gpu-paddle:install', cudaVersion),
		getGpuMode: () => ipcRenderer.invoke('gpu-paddle:get-gpu-mode'),
		setGpuMode: (mode: 'normal' | 'fast') => ipcRenderer.invoke('gpu-paddle:set-gpu-mode', mode)
	},

	// Listen for GPU mode changes
	onGpuModeChanged: (callback: (mode: string) => void) => {
		ipcRenderer.on('gpu-mode-changed', (_event, mode) => callback(mode));
	},

	// Config update listener
	onConfigUpdated: (callback: (config: any) => void) => {
		ipcRenderer.on('config:updated', (_event, config) => callback(config));
	},

	// Overlay control listeners
	onOverlayControlTranslation: (callback: (data: any) => void) => {
		ipcRenderer.on('overlay:control-translation', (_event, data) => callback(data));
	},

	onOverlayControlBidirectional: (callback: (data: any) => void) => {
		ipcRenderer.on('overlay:control-bidirectional', (_event, data) => callback(data));
	},

	// Quick translate hotkey listener
	onQuickTranslateHotkeyResult: (callback: (data: any) => void) => {
		ipcRenderer.on('quick-translate:hotkey-result', (_event, data) => callback(data));
	},

	// Error reporting API
	reportError: (errorData: {
		message: string;
		code?: string;
		stack?: string;
		category?: string;
		severity?: string;
		component?: string;
		context?: Record<string, any>;
		processType?: string;
	}) => ipcRenderer.invoke('error:report', errorData),

	// Update API
	checkForUpdates: () => ipcRenderer.invoke('updater:check-for-updates'),
	downloadUpdate: () => ipcRenderer.invoke('updater:download-update'),
	installUpdate: () => ipcRenderer.invoke('updater:install-update'),
	getUpdateStatus: () => ipcRenderer.invoke('updater:get-status'),
	onUpdateStatus: (callback: (data: any) => void) => {
		ipcRenderer.on('updater:status-changed', (_event, data) => callback(data));
	},

	// What's New API
	showWhatsNew: (version?: string) => ipcRenderer.invoke('whats-new:show', version),
	closeWhatsNew: () => ipcRenderer.invoke('whats-new:close'),
	onWhatsNewReleaseInfo: (callback: (data: any) => void) => {
		ipcRenderer.on('whats-new:release-info', (_event, data) => callback(data));
	},

	// Screen Translation Overlay API
	screenTranslation: {
		start: () => ipcRenderer.invoke('screen-translation:start'),
		stop: () => ipcRenderer.invoke('screen-translation:stop'),
		updateOCR: (data: any) => ipcRenderer.invoke('screen-translation:update-ocr', data),
		clearAll: () => ipcRenderer.invoke('screen-translation:clear-all'),
		getStatus: () => ipcRenderer.invoke('screen-translation:get-status'),
		cancelProcessing: () => ipcRenderer.invoke('screen-translation:cancel-processing')
	},

	// WebSocket connection status API
	websocket: {
		getConnectionState: () => ipcRenderer.invoke('websocket:get-state'),
		isConnected: () => ipcRenderer.invoke('websocket:is-connected'),
		getStats: () => ipcRenderer.invoke('websocket:get-stats'),
		reconnect: () => ipcRenderer.invoke('websocket:reconnect'),
		onStateChange: (callback: (state: string) => void) => {
			ipcRenderer.on('websocket:state-changed', (_event, state) => callback(state));
		}
	},

	// API error listeners
	onElevenLabsSetupError: (callback: () => void) => ipcRenderer.on('api-error:elevenlabs-setup', callback),
	onOpenAIQuotaError: (callback: () => void) => ipcRenderer.on('api-error:openai-quota', callback)
});