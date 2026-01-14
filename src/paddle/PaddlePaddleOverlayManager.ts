import { BrowserWindow, shell } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { spawn } from 'child_process';
import { IncomingMessage } from 'http';
import { resolveEmbeddedPythonExecutable } from '../utils/pythonPath';

export class PaddlePaddleOverlayManager {
  private static instance: PaddlePaddleOverlayManager;
  private overlayWindow: BrowserWindow | null = null;
  private installationCheckCache: { isInstalled: boolean; hasLanguagePacks?: boolean; error?: string; details?: string; timestamp: number } | null = null;
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

    // Check PaddlePaddle and language packs before creating overlay
    const paddlePaddleCheck = await this.checkPaddlePaddleInstallation();

    // Only skip overlay if PaddlePaddle is properly installed in AppData location with language packs
    if (paddlePaddleCheck.isInstalled && paddlePaddleCheck.hasLanguagePacks &&
        paddlePaddleCheck.details?.includes('AppData models directory')) {
      console.log('🏓 PaddlePaddle and language packs already detected in AppData, skipping overlay');
      return;
    }

    // Show overlay if:
    // - PaddlePaddle is not installed at all
    // - PaddlePaddle is installed but missing language packs
    // - PaddlePaddle is installed in legacy or system locations (not in AppData)
    if (paddlePaddleCheck.isInstalled && !paddlePaddleCheck.hasLanguagePacks) {
      console.log('🏓 PaddlePaddle found but language packs missing, showing overlay...');
    } else if (paddlePaddleCheck.isInstalled && !paddlePaddleCheck.details?.includes('AppData models directory')) {
      console.log('🏓 PaddlePaddle found in legacy/system location, showing overlay to migrate to AppData...');
    } else {
      console.log('🏓 PaddlePaddle missing, showing overlay...');
    }

    // Find the main window to set as parent
    const mainWindow = BrowserWindow.getAllWindows().find(win =>
      !win.isDestroyed() && win.getTitle() === 'Whispra'
    );

    // Get the main window dimensions for full app overlay
    let width = 1200;
    let height = 800;
    let x = 0;
    let y = 0;

    if (mainWindow && !mainWindow.isDestroyed()) {
      const bounds = mainWindow.getBounds();
      width = bounds.width;
      height = bounds.height;
      x = bounds.x;
      y = bounds.y;
    }

    // Create the overlay window as full app overlay
    this.overlayWindow = new BrowserWindow({
      width: width,
      height: height,
      x: x,
      y: y,
      title: 'PaddlePaddle Required - Whispra',
      icon: path.join(__dirname, '../assets/favicon.ico'),
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, '../preload.js')
      },
      show: false,
      resizable: false,
      maximizable: false,
      minimizable: false,
      fullscreenable: false,
      alwaysOnTop: true,
      modal: true,
      skipTaskbar: true,
      focusable: true,
      frame: false,
      transparent: true,
      parent: mainWindow || undefined,
      backgroundColor: '#00000000'
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
   * Check if PaddlePaddle, PaddleOCR and PP-OCRv5 language packs are installed
   */
  public async checkPaddlePaddleInstallation(useCache: boolean = true): Promise<{ isInstalled: boolean; hasLanguagePacks?: boolean; error?: string; details?: string }> {
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
      // First check the new AppData location where we download files
      const { app } = require('electron');
      const appDataPath = app.getPath('appData');
      const newPaddlePath = path.join(appDataPath, 'whispra', 'models');

      console.log('🏓 Checking new AppData location:', newPaddlePath);
      if (fs.existsSync(newPaddlePath)) {
        // Check specifically for paddle-related files/folders
        const files = fs.readdirSync(newPaddlePath);
        console.log('🏓 Files in models directory:', files);

        // Look for paddle-specific files or folders
        const paddleFiles = files.filter(file =>
          file.toLowerCase().includes('paddle') ||
          file.toLowerCase().includes('ocr') ||
          file === 'paddle' ||
          file === 'paddlepaddle'
        );

        console.log('🏓 Paddle-specific files found:', paddleFiles);

        if (paddleFiles.length > 0) {
          // Check for PP-OCRv5 language packs
          const hasLanguagePacks = await this.checkLanguagePacks(appDataPath);

          const result = {
            isInstalled: true,
            hasLanguagePacks,
            details: hasLanguagePacks
              ? 'PaddlePaddle and PP-OCRv5 language packs found in AppData models directory'
              : 'PaddlePaddle found in AppData models directory, but PP-OCRv5 language packs missing'
          };
          
          // Cache the result
          this.installationCheckCache = { ...result, timestamp: Date.now() };
          
          return result;
        }
      }

      // Check if the old OCR dependencies directory exists (legacy)
      const ocrDepPath = path.join(process.cwd(), 'whispra', 'whispra_dep', 'OCR');

      if (fs.existsSync(ocrDepPath)) {
        console.log('🏓 Found legacy OCR dependencies directory, checking packages...');

        // Check for PaddlePaddle and PaddleOCR packages
        const paddlePaddleExists = await this.checkPythonPackage('paddlepaddle', ocrDepPath);
        const paddleOCRExists = await this.checkPythonPackage('paddleocr', ocrDepPath);

        if (paddlePaddleExists && paddleOCRExists) {
          const result = {
            isInstalled: true,
            hasLanguagePacks: false, // Legacy installations don't have language packs, need to download them
            details: 'PaddlePaddle and PaddleOCR found in legacy OCR dependencies, but language packs missing'
          };
          
          // Cache the result
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
          hasLanguagePacks: false, // System installations don't have language packs, need to download them
          details: 'PaddlePaddle found in system Python environment, but language packs missing'
        };
        
        // Cache the result
        this.installationCheckCache = { ...result, timestamp: Date.now() };
        
        return result;
      }

      const result = {
        isInstalled: false,
        error: 'PaddlePaddle not found in AppData, legacy location, or system installation'
      };
      
      // Cache the failure result
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
   * Check if PP-OCRv5 language packs are installed
   */
  private async checkLanguagePacks(appDataPath: string): Promise<boolean> {
    try {
      const paddlePath = path.join(appDataPath, 'whispra', 'models', 'Paddle');
      const paddlePackPath = path.join(paddlePath, 'PaddlePack');

      // Check for v5 model files that should be present after downloading PaddlePack.zip
      const v5ModelFiles = [
        'PP-OCRv5_mobile_det',      // Maps to ch_PP-OCRv5_det_infer
        'PP-OCRv5_mobile_rec',      // Maps to ch_PP-OCRv5_rec_infer
        'latin_PP-OCRv5_mobile_rec', // Maps to latin_PP-OCRv5_mobile_rec_infer
        'korean_PP-OCRv5_mobile_rec' // Maps to korean_PP-OCRv5_mobile_rec_infer
      ];

      if (!fs.existsSync(paddlePackPath)) {
        console.log('🏓 PaddlePack directory does not exist:', paddlePackPath);
        return false;
      }

      let foundModels = 0;
      for (const modelFile of v5ModelFiles) {
        const modelPath = path.join(paddlePackPath, modelFile);
        if (fs.existsSync(modelPath)) {
          foundModels++;
          console.log('🏓 Found v5 model:', modelFile);
        } else {
          console.log('🏓 Missing v5 model:', modelFile);
        }
      }

      // Consider language packs installed if we have at least the main models
      const hasRequiredModels = foundModels >= 2;
      console.log(`🏓 Language pack check: ${foundModels}/${v5ModelFiles.length} models found in PaddlePack`);

      return hasRequiredModels;
    } catch (error) {
      console.error('❌ Error checking language packs:', error);
      return false;
    }
  }

  /**
   * Download PaddlePack.zip with PP-OCRv5 language models
   */
  private async downloadLanguagePacks(appDataPath: string): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('🏓 Downloading PP-OCRv5 language packs from GitHub...');

      const https = require('https');
      const { createWriteStream } = require('fs');
      const { promisify } = require('util');
      const pipeline = promisify(require('stream').pipeline);

      const downloadUrl = 'https://github.com/Sxriptor/Whispra-Download/releases/download/Paddle/PaddlePack.zip';
      const paddlePath = path.join(appDataPath, 'whispra', 'models', 'Paddle');
      const zipPath = path.join(paddlePath, 'PaddlePack.zip');

      // Ensure directory exists
      if (!fs.existsSync(paddlePath)) {
        fs.mkdirSync(paddlePath, { recursive: true });
      }

      // Download the zip file
      await new Promise((resolve, reject) => {
        https.get(downloadUrl, (response: IncomingMessage) => {
          if (response.statusCode === 302 || response.statusCode === 301) {
            // Follow redirect
            https.get(response.headers.location, (redirectResponse: IncomingMessage) => {
              const fileStream = createWriteStream(zipPath);
              pipeline(redirectResponse, fileStream).then(resolve).catch(reject);
            }).on('error', reject);
          } else {
            const fileStream = createWriteStream(zipPath);
            pipeline(response, fileStream).then(resolve).catch(reject);
          }
        }).on('error', reject);
      });

      // Extract the zip file
      const extract = require('extract-zip');

      try {
        await extract(zipPath, { dir: paddlePath });
        console.log('🏓 Language packs extracted successfully');
      } catch (error) {
        throw new Error(`Failed to extract language packs: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      // Clean up zip file
      fs.unlinkSync(zipPath);

      console.log('✅ PP-OCRv5 language packs downloaded and extracted successfully');
      return { success: true };

    } catch (error) {
      console.error('❌ Error downloading language packs:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error downloading language packs'
      };
    }
  }

  /**
   * Download PaddlePaddle from GitHub release or just language packs if PaddlePaddle is already installed
   */
  public async installPaddlePaddle(): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('🏓 Starting PaddlePaddle installation process...');

      // Use C:\Users\{user}\AppData\Roaming\whispra\models as target directory
      const { app } = require('electron');
      const appDataPath = app.getPath('appData');
      const targetPath = path.join(appDataPath, 'whispra', 'models');

      console.log('🏓 AppData path:', appDataPath);
      console.log('🏓 Target installation path:', targetPath);

      // Create target directory if it doesn't exist
      if (!fs.existsSync(targetPath)) {
        fs.mkdirSync(targetPath, { recursive: true });
        console.log('🏓 Created models directory:', targetPath);
      }

      // Check if PaddlePaddle is already installed in AppData
      const existingInstallation = await this.checkPaddlePaddleInstallation();
      const hasPaddleInAppData = existingInstallation.isInstalled &&
        existingInstallation.details?.includes('AppData models directory');

      if (hasPaddleInAppData) {
        console.log('🏓 PaddlePaddle already installed in AppData, skipping PaddlePaddle download...');

        // Only download language packs
        console.log('🏓 Downloading PP-OCRv5 language packs...');
        const languagePackResult = await this.downloadLanguagePacks(appDataPath);

        if (!languagePackResult.success) {
          console.error('❌ Language pack download failed:', languagePackResult.error);
          return languagePackResult;
        }

        console.log('✅ Language packs downloaded and extracted successfully');
        return { success: true };

      } else {
        // Download PaddlePaddle from GitHub release
        console.log('🏓 Downloading PaddlePaddle from GitHub release...');
        const downloadResult = await this.downloadFromGitHub(targetPath);

        if (!downloadResult.success) {
          return downloadResult;
        }

        console.log('🏓 PaddlePaddle downloaded and extracted successfully');

        // Also download PP-OCRv5 language packs
        console.log('🏓 Downloading PP-OCRv5 language packs...');
        const languagePackResult = await this.downloadLanguagePacks(appDataPath);

        if (!languagePackResult.success) {
          console.log('⚠️ Language pack download failed, but PaddlePaddle is installed:', languagePackResult.error);
          // Don't fail the entire installation if just language packs fail
        }

        return { success: true };
      }

    } catch (error) {
      console.error('🏓 Error in PaddlePaddle installation process:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Download PaddlePaddle from GitHub release and extract
   */
  private async downloadFromGitHub(targetPath: string): Promise<{ success: boolean; error?: string }> {
    const https = require('https');
    const extract = require('extract-zip');

    return new Promise((resolve) => {
      const downloadUrl = 'https://github.com/Sxriptor/Whispra-Download/releases/download/Paddle/paddle.zip';
      const zipPath = path.join(targetPath, 'paddle.zip');

      console.log('🏓 Downloading from:', downloadUrl);
      console.log('🏓 Saving to:', zipPath);

      const file = fs.createWriteStream(zipPath);

      const request = https.get(downloadUrl, (response: IncomingMessage) => {
        if (response.statusCode === 302 || response.statusCode === 301) {
          // Handle redirect
          const redirectUrl = response.headers.location;
          console.log('🏓 Redirecting to:', redirectUrl);
          https.get(redirectUrl!, (redirectResponse: IncomingMessage) => {
            redirectResponse.pipe(file);
            this.handleDownloadResponse(redirectResponse, file, zipPath, targetPath, resolve, extract);
          }).on('error', (error: any) => {
            resolve({ success: false, error: `Download redirect failed: ${error.message}` });
          });
        } else if (response.statusCode === 200) {
          response.pipe(file);
          this.handleDownloadResponse(response, file, zipPath, targetPath, resolve, extract);
        } else {
          resolve({ success: false, error: `Download failed with status: ${response.statusCode}` });
        }
      }).on('error', (error: any) => {
        resolve({ success: false, error: `Download failed: ${error.message}` });
      });

      // Timeout after 10 minutes
      setTimeout(() => {
        request.abort();
        resolve({ success: false, error: 'Download timeout after 10 minutes' });
      }, 600000);
    });
  }

  private handleDownloadResponse(response: any, file: any, zipPath: string, targetPath: string, resolve: any, extract: any): void {
    file.on('finish', () => {
      file.close(async () => {
        console.log('🏓 Download completed, extracting...');
        try {
          // Extract the zip file using extract-zip with progress logging and timeout
          console.log('🏓 Starting extraction, this may take a moment...');
          const startTime = Date.now();

          // Create a timeout promise
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => {
              reject(new Error('Extraction timeout after 5 minutes'));
            }, 300000); // 5 minutes timeout
          });

          // Race between extraction and timeout
          await Promise.race([
            extract(zipPath, {
              dir: targetPath,
              onEntry: (entry: any, zipfile: any) => {
                // Log progress for larger files
                if (entry.uncompressedSize > 1000000) { // > 1MB
                  console.log(`🏓 Extracting: ${entry.fileName} (${Math.round(entry.uncompressedSize / 1024 / 1024)}MB)`);
                }
              }
            }),
            timeoutPromise
          ]);

          const extractTime = Date.now() - startTime;
          console.log(`🏓 Extraction completed in ${extractTime}ms`);

          // Remove the zip file after extraction
          fs.unlinkSync(zipPath);

          console.log('🏓 Extraction completed successfully');
          resolve({ success: true });
        } catch (error) {
          console.error('🏓 Extraction failed:', error);
          resolve({ success: false, error: `Extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}` });
        }
      });
    });

    file.on('error', (error: Error) => {
      resolve({ success: false, error: `File write failed: ${error.message}` });
    });
  }
}