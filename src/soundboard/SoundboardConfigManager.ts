import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { SoundEntry, SoundboardConfig, SoundboardSettings } from './types';

export class SoundboardConfigManager {
  private config: SoundboardConfig;
  private configPath: string = '';
  private saveLock: Promise<void> = Promise.resolve();

  constructor() {
    this.config = this.getDefaultConfig();
  }

  private getConfigPath(): string {
    if (!this.configPath) {
      this.configPath = path.join(app.getPath('userData'), 'soundboard-config.json');
    }
    return this.configPath;
  }

  async loadConfig(): Promise<void> {
    try {
      const configPath = this.getConfigPath();
      if (fs.existsSync(configPath)) {
        const data = await fs.promises.readFile(configPath, 'utf-8');
        const loadedConfig = JSON.parse(data) as SoundboardConfig;
        
        // Validate and migrate config if needed
        this.config = this.validateConfig(loadedConfig);
      } else {
        // First time setup - create default config
        await this.saveConfig();
      }
    } catch (error) {
      console.error('Failed to load soundboard config:', error);
      this.config = this.getDefaultConfig();
      await this.saveConfig();
    }
  }

  async saveConfig(): Promise<void> {
    // Queue saves to prevent concurrent writes
    this.saveLock = this.saveLock.then(async () => {
      let tempPath: string | null = null;
      try {
        const configPath = this.getConfigPath();
        const configDir = path.dirname(configPath);
        if (!fs.existsSync(configDir)) {
          await fs.promises.mkdir(configDir, { recursive: true });
        }

        const data = JSON.stringify(this.config, null, 2);
        
        // Atomic write operation with unique temp file to avoid race conditions
        tempPath = `${configPath}.tmp.${Date.now()}`;
        await fs.promises.writeFile(tempPath, data, 'utf-8');
        
        // Check if temp file exists before renaming (in case of race condition)
        if (fs.existsSync(tempPath)) {
          await fs.promises.rename(tempPath, configPath);
          tempPath = null; // Mark as successfully renamed
        } else {
          console.warn('Temp file was removed before rename, skipping save');
        }
      } catch (error) {
        console.error('Failed to save soundboard config:', error);
        // Clean up temp file if rename failed
        if (tempPath && fs.existsSync(tempPath)) {
          try {
            await fs.promises.unlink(tempPath);
          } catch (unlinkError) {
            console.warn('Failed to clean up temp file:', unlinkError);
          }
        }
        // Don't throw - allow the app to continue functioning
        // The error is logged but doesn't break the volume slider functionality
      }
    }).catch((error) => {
      console.error('Error in save queue:', error);
    });
    
    return this.saveLock;
  }

  getConfig(): SoundboardConfig {
    return this.config;
  }

  getSettings(): SoundboardSettings {
    return this.config.settings;
  }

  updateSettings(settings: SoundboardSettings): void {
    this.config.settings = { ...this.config.settings, ...settings };
  }

  addSound(sound: SoundEntry): void {
    // Remove any existing sound in the same slot
    this.config.sounds = this.config.sounds.filter(s => s.slot !== sound.slot);
    this.config.sounds.push(sound);
  }

  removeSound(soundId: string): void {
    this.config.sounds = this.config.sounds.filter(s => s.id !== soundId);
  }

  updateSound(updatedSound: SoundEntry): void {
    const index = this.config.sounds.findIndex(s => s.id === updatedSound.id);
    if (index !== -1) {
      this.config.sounds[index] = updatedSound;
    }
  }

  getSoundBySlot(slot: number): SoundEntry | undefined {
    return this.config.sounds.find(s => s.slot === slot);
  }

  getSoundById(id: string): SoundEntry | undefined {
    return this.config.sounds.find(s => s.id === id);
  }

  getAllSounds(): SoundEntry[] {
    return this.config.sounds;
  }

  private getDefaultConfig(): SoundboardConfig {
    return {
      sounds: [],
      settings: {
        outputDevice: 'CABLE Input (VB-Audio Virtual Cable)', // Hardcoded to VB Audio INPUT Cable
        masterVolume: 0.75,
        headphonesVolume: 0.75,
        polyphonyMode: true,
        hotkeysEnabled: true
      },
      version: '1.0.0'
    };
  }

  private validateConfig(config: any): SoundboardConfig {
    // Validate config structure and provide defaults for missing properties
    const validConfig: SoundboardConfig = {
      sounds: [],
      settings: {
        outputDevice: 'CABLE Input (VB-Audio Virtual Cable)', // Force VB Audio INPUT Cable
        masterVolume: 0.75,
        headphonesVolume: 0.75,
        polyphonyMode: true,
        hotkeysEnabled: true
      },
      version: '1.0.0'
    };

    if (config.sounds && Array.isArray(config.sounds)) {
      validConfig.sounds = config.sounds.filter(this.validateSoundEntry);
    }

    if (config.settings && typeof config.settings === 'object') {
      // Force VB Audio Virtual Cable - ignore any user-provided outputDevice setting
      // validConfig.settings.outputDevice remains as 'VB-Audio Virtual Cable'

      if (typeof config.settings.masterVolume === 'number' &&
          config.settings.masterVolume >= 0 &&
          config.settings.masterVolume <= 1) {
        validConfig.settings.masterVolume = config.settings.masterVolume;
      }
      if (typeof config.settings.headphonesVolume === 'number' &&
          config.settings.headphonesVolume >= 0 &&
          config.settings.headphonesVolume <= 1) {
        validConfig.settings.headphonesVolume = config.settings.headphonesVolume;
      }
      if (typeof config.settings.polyphonyMode === 'boolean') {
        validConfig.settings.polyphonyMode = config.settings.polyphonyMode;
      }
      if (typeof config.settings.hotkeysEnabled === 'boolean') {
        validConfig.settings.hotkeysEnabled = config.settings.hotkeysEnabled;
      }
    }

    if (typeof config.version === 'string') {
      validConfig.version = config.version;
    }

    return validConfig;
  }

  private validateSoundEntry(sound: any): boolean {
    return (
      sound &&
      typeof sound.id === 'string' &&
      typeof sound.path === 'string' &&
      typeof sound.label === 'string' &&
      typeof sound.hotkey === 'string' &&
      typeof sound.addedAt === 'number' &&
      typeof sound.slot === 'number' &&
      sound.slot >= 1 &&
      sound.slot <= 1000
    );
  }

  async backupConfig(): Promise<string> {
    const configPath = this.getConfigPath();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = `${configPath}.backup.${timestamp}`;
    
    try {
      await fs.promises.copyFile(configPath, backupPath);
      return backupPath;
    } catch (error) {
      console.error('Failed to backup config:', error);
      throw error;
    }
  }

  async restoreConfig(backupPath: string): Promise<void> {
    try {
      const configPath = this.getConfigPath();
      await fs.promises.copyFile(backupPath, configPath);
      await this.loadConfig();
    } catch (error) {
      console.error('Failed to restore config:', error);
      throw error;
    }
  }
}