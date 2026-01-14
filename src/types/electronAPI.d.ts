/**
 * Type definitions for the electronAPI exposed in the preload script
 */

interface ElectronAPI {
  platform: string;
  versions: NodeJS.ProcessVersions;
  invoke: (channel: string, request: any) => Promise<any>;
  on: (channel: string, callback: (...args: any[]) => void) => void;
  off: (channel: string, callback: (...args: any[]) => void) => void;
  send: (channel: string, ...args: any[]) => void;

  // Audio playback setup methods
  setupRealTimeAudioPlayback: (callback: (data: any) => void) => void;
  setupTestAudioPlayback: (callback: (data: any) => void) => void;
  setupRealTimeTranslationAudio: (callback: (data: any) => void) => void;
  setupClearAudioCapture: (callback: (data: any) => void) => void;
  setupWasapiWavCapture: (callback: (data: Buffer) => void) => void;
  setupWasapiUtteranceWav: (callback: (data: Buffer) => void) => void;
  setupWasapiChunkWav: (callback: (data: Buffer) => void) => void;

  // Desktop capture
  getDesktopSources: (types: Array<'screen' | 'window'>) => Promise<Array<{ id: string; name: string }>>;

  // WASAPI loopback methods
  startPerAppCapture: (pid: number) => Promise<any>;
  startCaptureByProcess: (processName: string) => Promise<any>;
  startCaptureExcludeCurrent: () => Promise<any>;
  stopPerAppCapture: () => Promise<any>;
  findAudioPidForProcess: (processName: string) => Promise<any>;
  enumerateAudioSessions: () => Promise<any>;

  // Voice boost for whisper-level speech detection
  setVoiceBoostEnabled: (enabled: boolean) => Promise<{ success: boolean; enabled: boolean }>;
  setVoiceBoostLevel: (level: number) => Promise<{ success: boolean; level: number }>;
  getVoiceBoostSettings: () => Promise<{ enabled: boolean; level: number }>;

  // TTS playback tracking
  notifyTtsPlaybackStart: (duration?: number) => Promise<any>;
  notifyTtsPlaybackEnd: () => Promise<any>;

  // Global hotkeys
  setupGlobalHotkeys: (handlers: {
    onPttPress?: () => void;
    onPttRelease?: () => void;
    onToggleBidirectional?: () => void;
    onToggleScreenTranslation?: () => void;
    onScreenTranslationBoxSelect?: () => void;
    onScreenTranslationWatchBoxSelect?: () => void;
  }) => void;

  // Screen translation events
  onScreenTranslationStopped: (callback: () => void) => void;
  onPaddleWarmupStarted?: (callback: () => void) => void;
  onPaddleWarmupCompleted?: (callback: () => void) => void;

  // Auth
  startSignIn: () => Promise<any>;
  signOut: () => Promise<any>;
  onSignedIn: (cb: () => void) => void;
  onSubscriptionRequired: (cb: (data: { message: string; subscriptionStatus?: string }) => void) => void;
  onSignInError: (cb: (data: { message: string }) => void) => void;

  // Device check
  deviceCheckComplete: () => Promise<any>;
  openExternal: (url: string) => Promise<any>;
  openSoundSettings: () => Promise<any>;
  openAudioMIDISetup: () => Promise<any>;
  runDiagnostic: () => Promise<any>;

  // VB Audio setup
  closeVbAudioSetup: () => Promise<any>;
  setVbAudioSetupShown: (shown: boolean) => Promise<any>;
  showVbAudioSetup: () => Promise<any>;

  // API setup
  closeApiSetup: () => Promise<any>;
  showApiSetup: () => Promise<any>;

  // Config
  onConfigUpdated: (callback: (config: any) => void) => void;

  // Overlay control
  onOverlayControlTranslation: (callback: (data: any) => void) => void;
  onOverlayControlBidirectional: (callback: (data: any) => void) => void;

  // Update API
  checkForUpdates: () => Promise<{ success: boolean; error?: string }>;
  downloadUpdate: () => Promise<{ success: boolean; error?: string }>;
  installUpdate: () => Promise<{ success: boolean; error?: string }>;
  getUpdateStatus: () => Promise<{ success: boolean; data?: any; error?: string }>;
  onUpdateStatus: (callback: (data: any) => void) => void;

  // What's New API
  showWhatsNew: (version?: string) => Promise<{ success: boolean; error?: string }>;
  closeWhatsNew: () => Promise<{ success: boolean; error?: string }>;
  onWhatsNewReleaseInfo: (callback: (data: any) => void) => void;

  // Soundboard API
  soundboard: {
    addSound: (filePath: string, slot: number) => Promise<any>;
    removeSound: (slot: number) => Promise<any>;
    renameSound: (slot: number, newLabel: string) => Promise<any>;
    getAllSounds: () => Promise<any>;
    getSoundBySlot: (slot: number) => Promise<any>;
    playSound: (slot: number) => Promise<any>;
    stopSound: (slot: number) => Promise<any>;
    stopAllSounds: () => Promise<any>;
    isPlaying: (slot: number) => Promise<any>;
    getSettings: () => Promise<any>;
    updateSettings: (settings: any) => Promise<any>;
    getAudioDevices: () => Promise<any>;
    showFilePicker: () => Promise<any>;
    addSoundsFromPicker: (filePaths: string[]) => Promise<any>;
    validateAudioFile: (filePath: string) => Promise<any>;
    loadAudioBuffer: (filePath: string) => Promise<any>;
    onSoundLoaded: (callback: (sound: any) => void) => void;
    onSoundPlayed: (callback: (data: any) => void) => void;
    onSoundStopped: (callback: (data: any) => void) => void;
    onSoundError: (callback: (error: any) => void) => void;
    onDeviceChanged: (callback: (deviceId: string) => void) => void;
    onVolumeChanged: (callback: (volume: number) => void) => void;
    onHeadphonesVolumeChanged: (callback: (volume: number) => void) => void;
  };

  // PaddlePaddle API
  paddle: {
    checkInstallation: () => Promise<{
      success: boolean;
      isInstalled: boolean;
      hasLanguagePacks?: boolean;
      error?: string;
      details?: string;
    }>;
    install: () => Promise<{
      success: boolean;
      error?: string;
    }>;
    complete: (data: { cancelled: boolean }) => Promise<{
      success: boolean;
      cancelled: boolean;
      error?: string;
    }>;
    showOverlay: () => void;
    onInstallationProgress: (callback: (progress: {
      stage: string;
      progress: number;
      message: string;
    }) => void) => void;
    onInstallationComplete: (callback: (result: {
      success: boolean;
      error?: string;
    }) => void) => void;
    removeAllListeners: () => void;
  };

  // GPU Paddle API
  gpuPaddle: {
    showOverlay: () => Promise<{
      success: boolean;
      error?: string;
    }>;
    close: () => Promise<{
      success: boolean;
      error?: string;
    }>;
    detectCUDA: () => Promise<{
      success: boolean;
      hasCUDA: boolean;
      cudaVersion?: string;
      error?: string;
    }>;
    checkStatus: () => Promise<{
      success: boolean;
      isGPUAvailable?: boolean;
      hasGPUPaddle?: boolean;
      canRunOnGPU?: boolean;
      error?: string;
    }>;
    install: (cudaVersion: string) => Promise<{
      success: boolean;
      error?: string;
    }>;
    getGpuMode: () => Promise<{
      success: boolean;
      mode: 'normal' | 'fast';
      error?: string;
    }>;
    setGpuMode: (mode: 'normal' | 'fast') => Promise<{
      success: boolean;
      mode?: 'normal' | 'fast';
      error?: string;
    }>;
  };
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
