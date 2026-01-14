import { BrowserWindow, shell } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { spawn } from 'child_process';
import { resolveEmbeddedPythonExecutable } from '../utils/pythonPath';

export class PaddlePaddleOverlayManager {
  private static instance: PaddlePaddleOverlayManager;
  private overlayWindow: BrowserWindow | null = null;
  private installationCheckCache: { isInstalled: boolean; error?: string; details?: string; timestamp: number } | null = null;
  private readonly CACHE_DURATION_MS = 60000; // Cache for 60 seconds

  public static getInstance(): PaddlePaddleOverlayManager {
    if (!PaddlePaddleOverlayManager.instance) {
      PaddlePaddleOverlayManager.instance = new PaddlePaddleOverlayManager();
    }

    return PaddlePaddleOverlayManager.instance;
  }

  /**
   * Show the PaddlePaddle check overlay only if PaddlePaddle is missing
   */
  public async showPaddlePaddleCheckOverlay(): Promise<void> {
    if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
      this.overlayWindow.focus();
      return;
    }

    console.log('🏓 Checking for PaddlePaddle before showing overlay...');

    // Check PaddlePaddle first before creating overlay
    const paddlePaddleCheck = await this.checkPaddlePaddleInstallation();

    if (paddlePaddleCheck.isInstalled) {
      console.log('🏓 PaddlePaddle already detected, skipping overlay');
      return;
    }

    console.log('🏓 PaddlePaddle missing, creating overlay...');

    // Find the main window to set as parent
    const mainWindow = BrowserWindow.getAllWindows().find(win =>
      !win.isDestroyed() && win.getTitle() === 'Whispra'
    );

    // Create the overlay window
    this.overlayWindow = new BrowserWindow({
      width: 600,
      height: 500,
      minWidth: 500,
      minHeight: 400,
      title: 'PaddlePaddle Required - Whispra',
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
      alwaysOnTop: true,
      modal: true,
      skipTaskbar: false,
      focusable: true,
      parent: mainWindow || undefined,
      backgroundColor: '#000000'
    });

    // Load the PaddlePaddle check overlay HTML
    const overlayPath = path.join(__dirname, '../paddlepaddle-overlay.html');
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

    console.log('🏓 PaddlePaddle check overlay displayed');
  }

  /**
   * Close the PaddlePaddle check overlay
   */
  public closePaddlePaddleCheckOverlay(): void {
    if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
      console.log('🏓 Closing PaddlePaddle check overlay...');
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
   * Invalidate the installation check cache (e.g., after installation completes)
   */
  public invalidateCache(): void {
    console.log('🏓 Invalidating Paddle installation check cache');
    this.installationCheckCache = null;
  }

  /**
   * Check if PaddlePaddle and PaddleOCR are installed
   */
  public async checkPaddlePaddleInstallation(useCache: boolean = true): Promise<{ isInstalled: boolean; error?: string; details?: string }> {
    // Check cache first if enabled
    if (useCache && this.installationCheckCache) {
      const now = Date.now();
      const age = now - this.installationCheckCache.timestamp;
      
      if (age < this.CACHE_DURATION_MS) {
        console.log(`🏓 Using cached installation check result (age: ${Math.round(age / 1000)}s)`);
        const { timestamp, ...result } = this.installationCheckCache;
        return result;
      } else {
        console.log(`🏓 Cache expired (age: ${Math.round(age / 1000)}s), performing fresh check`);
      }
    }

    try {
      // Check if the OCR dependencies directory exists first
      const ocrDepPath = path.join(process.cwd(), 'whispra', 'whispra_dep', 'OCR');

      if (fs.existsSync(ocrDepPath)) {
        console.log('🏓 Found OCR dependencies directory, checking packages...');

        // Check for PaddlePaddle and PaddleOCR packages
        const paddlePaddleExists = await this.checkPythonPackage('paddlepaddle', ocrDepPath);
        const paddleOCRExists = await this.checkPythonPackage('paddleocr', ocrDepPath);

        if (paddlePaddleExists && paddleOCRExists) {
          const result = {
            isInstalled: true,
            details: 'PaddlePaddle and PaddleOCR found in local OCR dependencies'
          };
          
          // Cache the successful result
          this.installationCheckCache = { ...result, timestamp: Date.now() };
          
          return result;
        }
      }

      // Check system-wide installation
      console.log('🏓 Checking system-wide PaddlePaddle installation...');
      const systemInstalled = await this.checkSystemPaddlePaddle();

      if (systemInstalled) {
        const result = {
          isInstalled: true,
          details: 'PaddlePaddle found in system Python environment'
        };
        
        // Cache the successful result
        this.installationCheckCache = { ...result, timestamp: Date.now() };
        
        return result;
      }

      const result = {
        isInstalled: false,
        error: 'PaddlePaddle and PaddleOCR not found in local dependencies or system installation'
      };
      
      // Cache the failure result (but with shorter duration via timestamp check)
      this.installationCheckCache = { ...result, timestamp: Date.now() };
      
      return result;

    } catch (error) {
      console.error('🏓 Error checking PaddlePaddle installation:', error);
      const result = {
        isInstalled: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
      
      // Don't cache errors for as long
      return result;
    }
  }

  /**
   * Check if a Python package exists in the specified directory
   */
  private async checkPythonPackage(packageName: string, targetPath: string): Promise<boolean> {
    try {
      // Look for package directories or .dist-info directories
      const packageDirs = fs.readdirSync(targetPath).filter(dir =>
        dir.toLowerCase().includes(packageName.toLowerCase()) ||
        dir.toLowerCase().includes(packageName.toLowerCase().replace('paddle', ''))
      );

      return packageDirs.length > 0;
    } catch (error) {
      console.error(`🏓 Error checking package ${packageName}:`, error);
      return false;
    }
  }

  /**
   * Get the best available Python path (embedded first, then system)
   */
  private getPythonPath(): string {
    const embeddedPythonPath = resolveEmbeddedPythonExecutable();

    if (embeddedPythonPath && fs.existsSync(embeddedPythonPath)) {
      console.log('🏓 Using embedded Python:', embeddedPythonPath);
      return embeddedPythonPath;
    }

    console.log('🏓 Using system Python');
    return 'python';
  }

  /**
   * Check if pip is available for the given Python path
   */
  private async checkPipAvailability(pythonPath: string): Promise<{ hasPip: boolean; error?: string }> {
    return new Promise((resolve) => {
      const pipProcess = spawn(pythonPath, ['-m', 'pip', '--version'], {
        shell: true,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let output = '';
      let errorOutput = '';

      pipProcess.stdout.on('data', (data) => {
        output += data.toString();
      });

      pipProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      pipProcess.on('close', (code) => {
        if (code === 0) {
          console.log('🏓 Pip is available:', output.trim());
          resolve({ hasPip: true });
        } else {
          console.log('🏓 Pip not available:', errorOutput.trim());
          resolve({ hasPip: false, error: errorOutput.trim() });
        }
      });

      // Timeout after 10 seconds
      setTimeout(() => {
        pipProcess.kill();
        resolve({ hasPip: false, error: 'Pip check timeout' });
      }, 10000);
    });
  }

  /**
   * Download and install pip for embedded Python
   */
  private async installPipForEmbeddedPython(pythonPath: string): Promise<{ success: boolean; error?: string }> {
    return new Promise(async (resolve) => {
      try {
        console.log('🏓 Downloading get-pip.py...');
        
        // Download get-pip.py
        const https = require('https');
        const getPipUrl = 'https://bootstrap.pypa.io/get-pip.py';
        const getPipPath = path.join(path.dirname(pythonPath), 'get-pip.py');

        const file = fs.createWriteStream(getPipPath);
        
        https.get(getPipUrl, (response: any) => {
          response.pipe(file);
          
          file.on('finish', () => {
            file.close();
            console.log('🏓 get-pip.py downloaded successfully');
            
            // Run get-pip.py
            console.log('🏓 Installing pip...');
            const pipInstallProcess = spawn(pythonPath, [getPipPath], {
              shell: true,
              stdio: ['pipe', 'pipe', 'pipe']
            });

            let output = '';
            let errorOutput = '';

            pipInstallProcess.stdout.on('data', (data) => {
              const text = data.toString();
              output += text;
              console.log('🏓 PIP INSTALL OUTPUT:', text.trim());
            });

            pipInstallProcess.stderr.on('data', (data) => {
              const text = data.toString();
              errorOutput += text;
              console.log('🏓 PIP INSTALL STDERR:', text.trim());
            });

            pipInstallProcess.on('close', (code) => {
              // Clean up get-pip.py
              try {
                fs.unlinkSync(getPipPath);
              } catch (e) {
                console.log('🏓 Could not clean up get-pip.py:', e);
              }

              if (code === 0) {
                console.log('🏓 Pip installed successfully');
                resolve({ success: true });
              } else {
                console.log('🏓 Pip installation failed with code:', code);
                resolve({ success: false, error: errorOutput || 'Pip installation failed' });
              }
            });

            // Timeout after 5 minutes
            setTimeout(() => {
              pipInstallProcess.kill();
              resolve({ success: false, error: 'Pip installation timeout' });
            }, 300000);
          });
        }).on('error', (err: any) => {
          console.error('🏓 Error downloading get-pip.py:', err);
          resolve({ success: false, error: `Failed to download get-pip.py: ${err.message}` });
        });

      } catch (error) {
        console.error('🏓 Error in installPipForEmbeddedPython:', error);
        resolve({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
      }
    });
  }

  /**
   * Try to use system pip as fallback
   */
  private async trySystemPip(): Promise<{ pythonPath: string; hasPip: boolean }> {
    const systemPythonPaths = ['python', 'python3', 'py'];
    
    for (const pythonCmd of systemPythonPaths) {
      try {
        const pipCheck = await this.checkPipAvailability(pythonCmd);
        if (pipCheck.hasPip) {
          console.log(`🏓 Found system Python with pip: ${pythonCmd}`);
          return { pythonPath: pythonCmd, hasPip: true };
        }
      } catch (error) {
        console.log(`🏓 System Python ${pythonCmd} not available:`, error);
      }
    }
    
    return { pythonPath: 'python', hasPip: false };
  }

  /**
   * Ensure pip is available, installing it if necessary
   */
  private async ensurePipAvailable(): Promise<{ pythonPath: string; success: boolean; error?: string }> {
    const embeddedPythonPath = resolveEmbeddedPythonExecutable();
    
    // First, try embedded Python
    if (embeddedPythonPath && fs.existsSync(embeddedPythonPath)) {
      console.log('🏓 Checking pip availability for embedded Python...');
      const pipCheck = await this.checkPipAvailability(embeddedPythonPath);
      
      if (pipCheck.hasPip) {
        return { pythonPath: embeddedPythonPath, success: true };
      }
      
      console.log('🏓 Embedded Python found but pip missing, attempting to install pip...');
      const pipInstall = await this.installPipForEmbeddedPython(embeddedPythonPath);
      
      if (pipInstall.success) {
        return { pythonPath: embeddedPythonPath, success: true };
      }
      
      console.log('🏓 Failed to install pip for embedded Python, trying system Python...');
    }
    
    // Fallback to system Python
    console.log('🏓 Trying system Python as fallback...');
    const systemPython = await this.trySystemPip();
    
    if (systemPython.hasPip) {
      return { pythonPath: systemPython.pythonPath, success: true };
    }
    
    return { 
      pythonPath: embeddedPythonPath || 'python', 
      success: false, 
      error: 'No Python installation with pip found. Please install pip manually or use system Python with pip.' 
    };
  }

  /**
   * Check system-wide PaddlePaddle installation
   */
  private async checkSystemPaddlePaddle(): Promise<boolean> {
    return new Promise((resolve) => {
      const pythonPath = this.getPythonPath();
      const pythonProcess = spawn(pythonPath, ['-c', 'import paddle; print("PaddlePaddle found")'], {
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
        if (code === 0 && output.includes('PaddlePaddle found')) {
          resolve(true);
        } else {
          resolve(false);
        }
      });

      pythonProcess.on('error', () => {
        resolve(false);
      });

      // Timeout after 10 seconds
      setTimeout(() => {
        pythonProcess.kill();
        resolve(false);
      }, 10000);
    });
  }

  /**
   * Install PaddlePaddle and PaddleOCR to the local dependencies directory
   */
  public async installPaddlePaddle(): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('🏓 Starting PaddlePaddle and PaddleOCR installation...');

      const appRoot = process.cwd();
      const targetPath = path.join(appRoot, 'whispra', 'whispra_dep', 'OCR');

      // Create target directory if it doesn't exist
      if (!fs.existsSync(targetPath)) {
        fs.mkdirSync(targetPath, { recursive: true });
        console.log('🏓 Created OCR dependencies directory');
      }

      // Install PaddlePaddle and PaddleOCR
      console.log('🏓 Installing PaddlePaddle and PaddleOCR...');
      const installResult = await this.runPipInstall(targetPath);

      if (!installResult.success) {
        return installResult;
      }

      // Invalidate cache so verification gets fresh result
      this.invalidateCache();

      // Verify installation
      const verificationResult = await this.checkPaddlePaddleInstallation(false); // Force fresh check

      if (verificationResult.isInstalled) {
        console.log('🏓 PaddlePaddle and PaddleOCR installed successfully');
        return { success: true };
      } else {
        return {
          success: false,
          error: 'Installation verification failed: ' + (verificationResult.error || 'Unknown error')
        };
      }

    } catch (error) {
      console.error('🏓 Error installing PaddlePaddle:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Run pip install command for PaddlePaddle and PaddleOCR
   */
  private async runPipInstall(targetPath: string): Promise<{ success: boolean; error?: string }> {
    return new Promise(async (resolve) => {
      try {
        // First ensure pip is available
        const pipAvailability = await this.ensurePipAvailable();
        if (!pipAvailability.success) {
          resolve({ success: false, error: pipAvailability.error });
          return;
        }

        // Use the Python path that has pip available
        const actualPythonPath = pipAvailability.pythonPath;
        console.log('🏓 Using Python with pip:', actualPythonPath);

        const pipCommand = [
          '-m',
          'pip',
          'install',
          'paddlepaddle',
          'paddleocr',
          '--target',
          targetPath
        ];

        console.log('🏓 Running pip install command:', actualPythonPath, pipCommand.join(' '));

        const pipProcess = spawn(actualPythonPath, pipCommand, {
          shell: true,
          stdio: ['pipe', 'pipe', 'pipe']
        });

        let output = '';
        let errorOutput = '';

        pipProcess.stdout.on('data', (data) => {
          output += data.toString();
          console.log('🏓 PIP OUTPUT:', data.toString().trim());
        });

        pipProcess.stderr.on('data', (data) => {
          errorOutput += data.toString();
          console.log('🏓 PIP ERROR:', data.toString().trim());
        });

        pipProcess.on('close', (code) => {
          console.log('🏓 PIP process exited with code:', code);

          if (code === 0) {
            resolve({ success: true });
          } else {
            resolve({
              success: false,
              error: `pip install failed with code ${code}. Error: ${errorOutput || 'Unknown error'}`
            });
          }
        });

        pipProcess.on('error', (error) => {
          console.error('🏓 PIP process error:', error);
          resolve({
            success: false,
            error: `Failed to start pip: ${error.message}`
          });
        });

        // Timeout after 5 minutes (pip installs can take a while)
        setTimeout(() => {
          pipProcess.kill();
          resolve({
            success: false,
            error: 'Installation timeout after 5 minutes'
          });
        }, 300000);

      } catch (error) {
        console.error('🏓 Error in runPipInstall:', error);
        resolve({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });
  }
}