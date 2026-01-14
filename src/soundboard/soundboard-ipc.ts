import { ipcMain, dialog, IpcMainInvokeEvent } from 'electron';
import { SoundboardBackendService } from './SoundboardBackendService';
import { SoundEntry, SoundboardSettings } from './types';

let soundboardService: SoundboardBackendService | null = null;

export async function initializeSoundboardIPC(): Promise<void> {
  soundboardService = new SoundboardBackendService();
  await soundboardService.initialize();

  // Sound management
  ipcMain.handle('soundboard:add-sound', async (event: IpcMainInvokeEvent, filePath: string, slot: number) => {
    if (!soundboardService) throw new Error('Soundboard service not initialized');
    return await soundboardService.addSound(filePath, slot);
  });

  ipcMain.handle('soundboard:remove-sound', async (event: IpcMainInvokeEvent, slot: number) => {
    if (!soundboardService) throw new Error('Soundboard service not initialized');
    return await soundboardService.removeSound(slot);
  });

  ipcMain.handle('soundboard:rename-sound', async (event: IpcMainInvokeEvent, slot: number, newLabel: string) => {
    if (!soundboardService) throw new Error('Soundboard service not initialized');
    return await soundboardService.renameSound(slot, newLabel);
  });

  ipcMain.handle('soundboard:update-hotkey', async (event: IpcMainInvokeEvent, slot: number, hotkey: string) => {
    if (!soundboardService) throw new Error('Soundboard service not initialized');
    return await soundboardService.updateSoundHotkey(slot, hotkey);
  });

  ipcMain.handle('soundboard:get-all-sounds', async (event: IpcMainInvokeEvent) => {
    if (!soundboardService) throw new Error('Soundboard service not initialized');
    return soundboardService.getAllSounds();
  });

  ipcMain.handle('soundboard:get-sound-by-slot', async (event: IpcMainInvokeEvent, slot: number) => {
    if (!soundboardService) throw new Error('Soundboard service not initialized');
    return soundboardService.getSoundBySlot(slot);
  });

  // Playback controls - these will be handled in the renderer process
  ipcMain.handle('soundboard:play-sound', async (event: IpcMainInvokeEvent, slot: number) => {
    // Just return the sound data, actual playback happens in renderer
    if (!soundboardService) throw new Error('Soundboard service not initialized');
    return soundboardService.getSoundBySlot(slot);
  });

  ipcMain.handle('soundboard:stop-sound', async (event: IpcMainInvokeEvent, slot: number) => {
    // Playback control handled in renderer
    return { success: true };
  });

  ipcMain.handle('soundboard:stop-all-sounds', async (event: IpcMainInvokeEvent) => {
    // Playback control handled in renderer
    return { success: true };
  });

  ipcMain.handle('soundboard:is-playing', async (event: IpcMainInvokeEvent, slot: number) => {
    // Playback state handled in renderer
    return false;
  });

  // Settings management
  ipcMain.handle('soundboard:get-settings', async (event: IpcMainInvokeEvent) => {
    if (!soundboardService) throw new Error('Soundboard service not initialized');
    return soundboardService.getSettings();
  });

  ipcMain.handle('soundboard:update-settings', async (event: IpcMainInvokeEvent, settings: Partial<SoundboardSettings>) => {
    if (!soundboardService) throw new Error('Soundboard service not initialized');
    return await soundboardService.updateSettings(settings);
  });

  // Device management - handled in renderer
  ipcMain.handle('soundboard:get-audio-devices', async (event: IpcMainInvokeEvent) => {
    // Audio device enumeration happens in renderer process
    return [];
  });

  // File operations
  ipcMain.handle('soundboard:show-file-picker', async (event: IpcMainInvokeEvent) => {
    const result = await dialog.showOpenDialog({
      title: 'Select Audio Files',
      filters: [
        {
          name: 'Audio Files',
          extensions: ['mp3', 'wav', 'ogg', 'aac', 'flac', 'm4a']
        },
        {
          name: 'All Files',
          extensions: ['*']
        }
      ],
      properties: ['openFile', 'multiSelections']
    });

    return result;
  });

  // Add sounds from file picker
  ipcMain.handle('soundboard:add-sounds-from-picker', async (event: IpcMainInvokeEvent, filePaths: string[]) => {
    if (!soundboardService) throw new Error('Soundboard service not initialized');
    
    const results = [];
    const errors = [];
    
    for (const filePath of filePaths) {
      // Find next available slot
      let slot = 1;
      while (slot <= 12 && soundboardService.getSoundBySlot(slot)) {
        slot++;
      }
      
      if (slot > 12) {
        errors.push({ filePath, error: 'No available slots' });
        continue;
      }
      
      try {
        const sound = await soundboardService.addSound(filePath, slot);
        results.push(sound);
      } catch (error) {
        errors.push({ filePath, error: (error as Error).message });
      }
    }
    
    return { results, errors };
  });

  // Validation helper
  ipcMain.handle('soundboard:validate-audio-file', async (event: IpcMainInvokeEvent, filePath: string) => {
    if (!soundboardService) throw new Error('Soundboard service not initialized');
    
    try {
      // Access the file manager through the service
      const fileManager = (soundboardService as any).fileManager;
      return await fileManager.validateAudioFile(filePath);
    } catch (error) {
      console.error('Error validating audio file:', error);
      return false;
    }
  });

  // Load audio file as array buffer for renderer
  ipcMain.handle('soundboard:load-audio-buffer', async (event: IpcMainInvokeEvent, filePath: string) => {
    try {
      const fs = require('fs');
      const buffer = await fs.promises.readFile(filePath);
      return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
    } catch (error) {
      console.error('Error loading audio buffer:', error);
      throw error;
    }
  });

  // Event forwarding from service to renderer
  if (soundboardService) {
    soundboardService.on('sound-loaded', (sound: SoundEntry) => {
      const windows = require('electron').BrowserWindow.getAllWindows();
      windows.forEach((win: any) => win.webContents.send('soundboard:sound-loaded', sound));
    });

    soundboardService.on('sound-played', (data: { sound: SoundEntry, slot: number }) => {
      const windows = require('electron').BrowserWindow.getAllWindows();
      windows.forEach((win: any) => win.webContents.send('soundboard:sound-played', data));
    });

    soundboardService.on('sound-stopped', (data: { slot?: number, all?: boolean }) => {
      const windows = require('electron').BrowserWindow.getAllWindows();
      windows.forEach((win: any) => win.webContents.send('soundboard:sound-stopped', data));
    });

    soundboardService.on('sound-error', (error: any) => {
      const windows = require('electron').BrowserWindow.getAllWindows();
      windows.forEach((win: any) => win.webContents.send('soundboard:sound-error', error));
    });

    soundboardService.on('device-changed', (deviceId: string) => {
      const windows = require('electron').BrowserWindow.getAllWindows();
      windows.forEach((win: any) => win.webContents.send('soundboard:device-changed', deviceId));
    });

    soundboardService.on('volume-changed', (volume: number) => {
      console.log('[SoundboardIPC] Broadcasting volume change:', volume);
      const { webContents } = require('electron');
      webContents.getAllWebContents().forEach((contents: any) => {
        contents.send('soundboard:volume-changed', volume);
      });
    });

    soundboardService.on('headphones-volume-changed', (volume: number) => {
      console.log('[SoundboardIPC] Broadcasting headphones volume change:', volume);
      const { webContents } = require('electron');
      webContents.getAllWebContents().forEach((contents: any) => {
        contents.send('soundboard:headphones-volume-changed', volume);
      });
    });
  }
}

export function getSoundboardService(): SoundboardBackendService | null {
  return soundboardService;
}