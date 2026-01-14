import { BrowserWindow, shell } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { spawn } from 'child_process';
import * as https from 'https';
import * as http from 'http';
import { resolveEmbeddedPythonExecutable, resolveEmbeddedPythonDirectory } from '../utils/pythonPath';

export class PythonCheckOverlayManager {
  private static instance: PythonCheckOverlayManager;
  private overlayWindow: BrowserWindow | null = null;

  public static getInstance(): PythonCheckOverlayManager {
    if (!PythonCheckOverlayManager.instance) {
      PythonCheckOverlayManager.instance = new PythonCheckOverlayManager();
    }

    return PythonCheckOverlayManager.instance;
  }

  /**
   * Show the Python check overlay only if Python 3.10.11 is missing
   */
  public async showPythonCheckOverlay(): Promise<void> {
    if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
      this.overlayWindow.focus();
      return;
    }

    console.log('🐍 Checking for Python 3.10.11 before showing overlay...');
    
    // Check Python first before creating overlay
    const pythonCheck = await this.checkPythonVersion();
    
    if (pythonCheck.hasCorrectVersion) {
      console.log('🐍 Python 3.10.11 already detected, skipping overlay');
      return;
    }

    console.log('🐍 Python 3.10.11 missing, creating overlay...');

    // Find the main window to set as parent
    const mainWindow = BrowserWindow.getAllWindows().find(win => 
      !win.isDestroyed() && win.getTitle() === 'Whispra'
    );

    // Create the overlay window
    this.overlayWindow = new BrowserWindow({
      width: 800,
      height: 700,
      minWidth: 600,
      minHeight: 500,
      title: 'Python Check - Whispra',
      icon: path.join(__dirname, '../assets/favicon.ico'),
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, '../preload.js')
      },
      show: false,
      resizable: true,
      maximizable: false,
      fullscreenable: false,
      alwaysOnTop: false,
      modal: false,
      skipTaskbar: false,
      focusable: true,
      parent: mainWindow || undefined
    });

    // Load the Python check overlay HTML
    const overlayPath = path.join(__dirname, '../python-check-overlay.html');
    await this.overlayWindow.loadFile(overlayPath);

    // Open DevTools in development
    if (process.env.NODE_ENV === 'development') {
      this.overlayWindow.webContents.openDevTools();
    }

    // Show the window
    this.overlayWindow.show();

    // Handle window closed
    this.overlayWindow.on('closed', () => {
      this.overlayWindow = null;
    });

    console.log('🐍 Python check overlay displayed');
  }

  /**
   * Close the Python check overlay
   */
  public closePythonCheckOverlay(): void {
    if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
      console.log('🐍 Closing Python check overlay...');
      this.overlayWindow.close();
      this.overlayWindow = null;
    }
  }

  /**
   * Check if overlay is currently shown
   */
  public isOverlayShown(): boolean {
    return this.overlayWindow !== null && !this.overlayWindow.isDestroyed();
  }

  /**
   * Get the platform-specific embedded Python path
   */
  private getEmbeddedPythonPath(): string {
    if (process.platform === 'win32') {
      const pythonDir = path.join(process.cwd(), 'python');
      return path.join(pythonDir, 'python.exe');
    } else if (process.platform === 'darwin') {
      // macOS: check macpython/bin folder first (executables), then python folder
      const macPython3Path = path.join(process.cwd(), 'macpython', 'bin', 'python3');
      if (fs.existsSync(macPython3Path)) {
        return macPython3Path;
      }
      const macPython310Path = path.join(process.cwd(), 'macpython', 'bin', 'python3.10');
      if (fs.existsSync(macPython310Path)) {
        return macPython310Path;
      }
      // Fallback to python folder
      const pythonDir = path.join(process.cwd(), 'python');
      const python3Path = path.join(pythonDir, 'python3');
      if (fs.existsSync(python3Path)) {
        return python3Path;
      }
      const pythonPath = path.join(pythonDir, 'python');
      if (fs.existsSync(pythonPath)) {
        return pythonPath;
      }
      // Return path even if it doesn't exist yet (for checking)
      return macPython3Path;
    } else {
      // Linux: try python3 first, then python
      const pythonDir = path.join(process.cwd(), 'python');
      const python3Path = path.join(pythonDir, 'python3');
      if (fs.existsSync(python3Path)) {
        return python3Path;
      }
      const pythonPath = path.join(pythonDir, 'python');
      if (fs.existsSync(pythonPath)) {
        return pythonPath;
      }
      return python3Path;
    }
  }

  /**
   * Check if Python 3.10.11 is available
   */
  public async checkPythonVersion(): Promise<{ hasCorrectVersion: boolean; currentVersion?: string; error?: string }> {
    try {
      // First check for embedded Python in Whispra directory (platform-specific)
      const embeddedPythonPath = this.getEmbeddedPythonPath();
      
      if (embeddedPythonPath && fs.existsSync(embeddedPythonPath)) {
        console.log(`🐍 Found embedded Python at ${embeddedPythonPath}, checking version...`);
        const embeddedVersion = await this.getPythonVersionFromPath(embeddedPythonPath);
        if (embeddedVersion && embeddedVersion.startsWith('3.10.11')) {
          return { hasCorrectVersion: true, currentVersion: embeddedVersion };
        }
      }

      // Check system Python
      console.log('🐍 Checking system Python...');
      const systemVersion = await this.getPythonVersionFromPath('python');
      
      if (systemVersion && systemVersion.startsWith('3.10.11')) {
        return { hasCorrectVersion: true, currentVersion: systemVersion };
      }

      // Try python3 command as well
      const python3Version = await this.getPythonVersionFromPath('python3');
      
      if (python3Version && python3Version.startsWith('3.10.11')) {
        return { hasCorrectVersion: true, currentVersion: python3Version };
      }

      return { 
        hasCorrectVersion: false, 
        currentVersion: systemVersion || python3Version || 'Not found',
        error: 'Python 3.10.11 not found'
      };

    } catch (error) {
      console.error('🐍 Error checking Python version:', error);
      return { 
        hasCorrectVersion: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Get Python version from a specific path/command
   */
  private async getPythonVersionFromPath(pythonPath: string): Promise<string | null> {
    return new Promise((resolve) => {
      const pythonProcess = spawn(pythonPath, ['--version'], { 
        shell: true,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let output = '';
      let errorOutput = '';

      pythonProcess.stdout.on('data', (data) => {
        output += data.toString();
      });

      pythonProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      pythonProcess.on('close', (code) => {
        if (code === 0) {
          // Python version is usually in format "Python 3.10.11"
          const versionMatch = (output + errorOutput).match(/Python (\d+\.\d+\.\d+)/);
          if (versionMatch) {
            resolve(versionMatch[1]);
          } else {
            resolve(null);
          }
        } else {
          resolve(null);
        }
      });

      pythonProcess.on('error', () => {
        resolve(null);
      });

      // Timeout after 5 seconds
      setTimeout(() => {
        pythonProcess.kill();
        resolve(null);
      }, 5000);
    });
  }

  /**
   * Download and install Python 3.10.11 embedded version
   */
  public async downloadAndInstallPython(): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('🐍 Starting Python 3.10.11 download and installation...');
      
      const pythonUrl = 'https://www.python.org/ftp/python/3.10.11/python-3.10.11-embed-amd64.zip';
      const pythonDir = resolveEmbeddedPythonDirectory() || path.join(process.cwd(), 'python');
      const downloadPath = path.join(pythonDir, 'python-3.10.11-embed-amd64.zip');

      // Create python directory if it doesn't exist
      if (!fs.existsSync(pythonDir)) {
        fs.mkdirSync(pythonDir, { recursive: true });
      }

      // Download Python
      console.log('🐍 Downloading Python 3.10.11...');
      await this.downloadFile(pythonUrl, downloadPath);

      // Extract the ZIP file
      console.log('🐍 Extracting Python...');
      await this.extractZip(downloadPath, pythonDir);

      // Clean up ZIP file
      fs.unlinkSync(downloadPath);

      // Verify installation
      const embeddedPythonPath = path.join(pythonDir, 'python.exe');
      if (fs.existsSync(embeddedPythonPath)) {
        const version = await this.getPythonVersionFromPath(embeddedPythonPath);
        if (version && version.startsWith('3.10.11')) {
          console.log('🐍 Python 3.10.11 installed successfully');
          return { success: true };
        }
      }

      return { success: false, error: 'Python installation verification failed' };

    } catch (error) {
      console.error('🐍 Error installing Python:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Download a file from URL to local path
   */
  private async downloadFile(url: string, filePath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(filePath);
      const protocol = url.startsWith('https:') ? https : http;
      
      const request = protocol.get(url, (response) => {
        // Handle redirects
        if (response.statusCode === 301 || response.statusCode === 302) {
          if (response.headers.location) {
            this.downloadFile(response.headers.location, filePath).then(resolve).catch(reject);
            return;
          }
        }
        
        if (response.statusCode !== 200) {
          reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
          return;
        }
        
        response.pipe(file);
        
        file.on('finish', () => {
          file.close();
          resolve();
        });
        
        file.on('error', (error) => {
          fs.unlink(filePath, () => {}); // Delete the file if error
          reject(error);
        });
      });
      
      request.on('error', (error) => {
        fs.unlink(filePath, () => {}); // Delete the file if error
        reject(error);
      });
      
      request.setTimeout(30000, () => {
        request.destroy();
        fs.unlink(filePath, () => {}); // Delete the file if timeout
        reject(new Error('Download timeout'));
      });
    });
  }

  /**
   * Extract ZIP file using built-in Node.js methods
   */
  private async extractZip(zipPath: string, extractPath: string): Promise<void> {
    // For Windows, we'll use PowerShell to extract the ZIP
    return new Promise((resolve, reject) => {
      const powershellCommand = `Expand-Archive -Path "${zipPath}" -DestinationPath "${extractPath}" -Force`;
      
      const powershell = spawn('powershell.exe', ['-Command', powershellCommand], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let errorOutput = '';

      powershell.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      powershell.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`PowerShell extraction failed: ${errorOutput}`));
        }
      });

      powershell.on('error', (error) => {
        reject(error);
      });
    });
  }
}
