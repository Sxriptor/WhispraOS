import { EventEmitter } from 'events';
import { SoundEntry, SoundboardConfig, SoundboardSettings, SoundboardEvents, SoundboardError } from './types';
import { SoundboardConfigManager } from './SoundboardConfigManager';
import { SoundboardFileManager } from './SoundboardFileManager';

export class SoundboardBackendService extends EventEmitter {
  private configManager: SoundboardConfigManager;
  private fileManager: SoundboardFileManager;
  private isInitialized: boolean = false;

  constructor() {
    super();
    this.configManager = new SoundboardConfigManager();
    this.fileManager = new SoundboardFileManager();
  }

  async initialize(): Promise<void> {
    try {
      await this.configManager.loadConfig();
      this.isInitialized = true;
      
      // Validate existing sounds and check for missing files
      const config = this.configManager.getConfig();
      for (const sound of config.sounds) {
        await this.validateSoundFile(sound);
      }
    } catch (error) {
      console.error('Failed to initialize soundboard backend:', error);
      throw error;
    }
  }

  async addSound(filePath: string, slot: number): Promise<SoundEntry> {
    if (!this.isInitialized) {
      throw new Error('Soundboard backend not initialized');
    }

    if (slot < 1 || slot > 1000) {
      throw new Error('Invalid slot number. Must be between 1 and 1000.');
    }

    // Check if slot is already occupied
    const existingSound = this.getSoundBySlot(slot);
    if (existingSound) {
      throw new Error(`Slot ${slot} is already occupied by "${existingSound.label}"`);
    }

    try {
      // Validate file
      const isValid = await this.fileManager.validateAudioFile(filePath);
      if (!isValid) {
        throw new Error('Invalid audio file format');
      }

      // Extract metadata
      const metadata = await this.fileManager.extractMetadata(filePath);
      
      // Create sound entry
      const soundEntry: SoundEntry = {
        id: this.generateSoundId(),
        path: filePath,
        label: this.fileManager.getFileName(filePath),
        hotkey: this.getDefaultHotkey(slot),
        duration: metadata.duration,
        addedAt: Date.now(),
        slot
      };

      // Add to config
      this.configManager.addSound(soundEntry);
      await this.configManager.saveConfig();

      this.emit(SoundboardEvents.SOUND_LOADED, soundEntry);
      return soundEntry;
    } catch (error) {
      const soundError: SoundboardError = {
        type: 'decode-error',
        message: (error as Error).message,
        path: filePath
      };
      this.emit(SoundboardEvents.SOUND_ERROR, soundError);
      throw error;
    }
  }

  async removeSound(slot: number): Promise<void> {
    const sound = this.getSoundBySlot(slot);
    if (!sound) return;

    // Remove from config
    this.configManager.removeSound(sound.id);
    await this.configManager.saveConfig();
  }

  async renameSound(slot: number, newLabel: string): Promise<void> {
    const sound = this.getSoundBySlot(slot);
    if (!sound) return;

    sound.label = newLabel;
    this.configManager.updateSound(sound);
    await this.configManager.saveConfig();
  }

  async updateSoundHotkey(slot: number, hotkey: string): Promise<void> {
    const sound = this.getSoundBySlot(slot);
    if (!sound) return;

    sound.hotkey = hotkey;
    this.configManager.updateSound(sound);
    await this.configManager.saveConfig();
  }

  getSoundBySlot(slot: number): SoundEntry | undefined {
    return this.configManager.getConfig().sounds.find(s => s.slot === slot);
  }

  getAllSounds(): SoundEntry[] {
    return this.configManager.getConfig().sounds;
  }

  getSettings(): SoundboardSettings {
    return this.configManager.getSettings();
  }

  async updateSettings(settings: Partial<SoundboardSettings>): Promise<void> {
    const currentSettings = this.configManager.getSettings();
    const newSettings = { ...currentSettings, ...settings };
    
    this.configManager.updateSettings(newSettings);
    await this.configManager.saveConfig();

    if (settings.outputDevice) {
      this.emit(SoundboardEvents.DEVICE_CHANGED, settings.outputDevice);
    }

    if (settings.masterVolume !== undefined) {
      this.emit(SoundboardEvents.VOLUME_CHANGED, settings.masterVolume);
    }

    if (settings.headphonesVolume !== undefined) {
      this.emit(SoundboardEvents.HEADPHONES_VOLUME_CHANGED, settings.headphonesVolume);
    }
  }

  private async validateSoundFile(sound: SoundEntry): Promise<void> {
    try {
      const exists = await this.fileManager.fileExists(sound.path);
      if (!exists) {
        const error: SoundboardError = {
          type: 'file-not-found',
          message: `Sound file not found: ${sound.path}`,
          soundId: sound.id,
          path: sound.path
        };
        this.emit(SoundboardEvents.SOUND_ERROR, error);
      }
    } catch (error) {
      console.error('Error validating sound file:', error);
    }
  }

  private generateSoundId(): string {
    return `sound_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getDefaultHotkey(slot: number): string {
    const keyMap: { [key: number]: string } = {
      1: '1', 2: '2', 3: '3', 4: '4',
      5: 'Q', 6: 'W', 7: 'E', 8: 'R',
      9: 'A', 10: 'S', 11: 'D', 12: 'F'
    };
    return keyMap[slot] || '';
  }

}