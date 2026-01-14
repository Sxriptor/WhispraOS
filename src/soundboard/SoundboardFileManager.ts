import * as fs from 'fs';
import * as path from 'path';

export interface AudioMetadata {
  duration?: number;
  format?: string;
  sampleRate?: number;
  channels?: number;
}

export class SoundboardFileManager {
  private supportedFormats = ['.mp3', '.wav', '.ogg', '.aac', '.flac', '.m4a'];

  async validateAudioFile(filePath: string): Promise<boolean> {
    try {
      // Check if file exists
      const exists = await this.fileExists(filePath);
      if (!exists) return false;

      // Check file extension
      const ext = path.extname(filePath).toLowerCase();
      if (!this.supportedFormats.includes(ext)) {
        return false;
      }

      // Check if file is readable
      await fs.promises.access(filePath, fs.constants.R_OK);
      
      // Basic file size check (not empty, not too large - 100MB limit)
      const stats = await fs.promises.stat(filePath);
      if (stats.size === 0 || stats.size > 100 * 1024 * 1024) {
        return false;
      }

      return true;
    } catch (error) {
      console.error('File validation error:', error);
      return false;
    }
  }

  async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.promises.access(filePath, fs.constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  getFileName(filePath: string): string {
    return path.basename(filePath, path.extname(filePath));
  }

  getFileExtension(filePath: string): string {
    return path.extname(filePath).toLowerCase();
  }

  async extractMetadata(filePath: string): Promise<AudioMetadata> {
    try {
      // For now, we'll use basic file system info
      // In a full implementation, you might use a library like node-ffmpeg or music-metadata
      const stats = await fs.promises.stat(filePath);
      
      return {
        format: this.getFileExtension(filePath),
        // Duration will be extracted when the audio is decoded
        duration: undefined
      };
    } catch (error) {
      console.error('Error extracting metadata:', error);
      return {};
    }
  }

  sanitizeFileName(fileName: string): string {
    // Remove or replace invalid characters
    return fileName.replace(/[<>:"/\\|?*]/g, '_').trim();
  }

  validateFilePath(filePath: string): boolean {
    try {
      // Basic path validation
      const normalizedPath = path.normalize(filePath);
      return normalizedPath.length > 0 && !normalizedPath.includes('..');
    } catch {
      return false;
    }
  }

  async getFileSize(filePath: string): Promise<number> {
    try {
      const stats = await fs.promises.stat(filePath);
      return stats.size;
    } catch {
      return 0;
    }
  }

  async getFileModifiedTime(filePath: string): Promise<Date | null> {
    try {
      const stats = await fs.promises.stat(filePath);
      return stats.mtime;
    } catch {
      return null;
    }
  }

  formatFileSize(bytes: number): string {
    const sizes = ['B', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 B';
    
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    const size = (bytes / Math.pow(1024, i)).toFixed(1);
    return `${size} ${sizes[i]}`;
  }

  formatDuration(seconds: number): string {
    if (!seconds || seconds < 0) return '0:00';
    
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }

  getSupportedFormats(): string[] {
    return [...this.supportedFormats];
  }

  isSupportedFormat(filePath: string): boolean {
    const ext = this.getFileExtension(filePath);
    return this.supportedFormats.includes(ext);
  }

  async copyFileToUserData(sourcePath: string, userDataPath: string, fileName?: string): Promise<string> {
    try {
      const soundsDir = path.join(userDataPath, 'soundboard-sounds');
      if (!fs.existsSync(soundsDir)) {
        await fs.promises.mkdir(soundsDir, { recursive: true });
      }

      const targetFileName = fileName || path.basename(sourcePath);
      const targetPath = path.join(soundsDir, this.sanitizeFileName(targetFileName));

      // Check if file already exists and create unique name if needed
      let finalPath = targetPath;
      let counter = 1;
      while (await this.fileExists(finalPath)) {
        const ext = path.extname(targetFileName);
        const nameWithoutExt = path.basename(targetFileName, ext);
        finalPath = path.join(soundsDir, `${nameWithoutExt}_${counter}${ext}`);
        counter++;
      }

      await fs.promises.copyFile(sourcePath, finalPath);
      return finalPath;
    } catch (error) {
      console.error('Error copying file to user data:', error);
      throw error;
    }
  }

  async deleteFile(filePath: string): Promise<void> {
    try {
      if (await this.fileExists(filePath)) {
        await fs.promises.unlink(filePath);
      }
    } catch (error) {
      console.error('Error deleting file:', error);
      throw error;
    }
  }

  createFileFilter(): Electron.FileFilter[] {
    return [
      {
        name: 'Audio Files',
        extensions: this.supportedFormats.map(fmt => fmt.substring(1)) // Remove the dot
      },
      {
        name: 'All Files',
        extensions: ['*']
      }
    ];
  }
}