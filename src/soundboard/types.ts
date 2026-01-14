export interface SoundEntry {
  id: string;
  path: string;
  label: string;
  hotkey: string;
  duration?: number;
  addedAt: number;
  slot: number; // 1-12 for the predefined slots
}

export interface SoundboardConfig {
  sounds: SoundEntry[];
  settings: SoundboardSettings;
  version: string;
}

export interface SoundboardSettings {
  outputDevice: string;
  masterVolume: number;
  headphonesVolume: number;
  polyphonyMode: boolean;
  hotkeysEnabled: boolean;
}

export interface AudioDeviceInfo {
  deviceId: string;
  label: string;
  kind: MediaDeviceKind;
}

export interface PlaybackState {
  soundId: string;
  slot: number;
  isPlaying: boolean;
  audioBuffer?: AudioBuffer;
  source?: AudioBufferSourceNode;
}

export enum SoundboardEvents {
  SOUND_LOADED = 'sound-loaded',
  SOUND_PLAYED = 'sound-played',
  SOUND_STOPPED = 'sound-stopped',
  SOUND_ERROR = 'sound-error',
  DEVICE_CHANGED = 'device-changed',
  VOLUME_CHANGED = 'volume-changed',
  HEADPHONES_VOLUME_CHANGED = 'headphones-volume-changed'
}

export interface SoundboardError {
  type: 'file-not-found' | 'decode-error' | 'device-error' | 'permission-error';
  message: string;
  soundId?: string;
  path?: string;
}