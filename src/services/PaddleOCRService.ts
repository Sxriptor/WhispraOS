import * as path from 'path';
import * as fs from 'fs';
import { spawn } from 'child_process';
import { app } from 'electron';
import { resolveEmbeddedPythonExecutable } from '../utils/pythonPath';
import { ErrorReportingService } from './ErrorReportingService';
import { ErrorCategory, ErrorSeverity } from '../types/ErrorTypes';

// Import for additional cleanup
import type { App } from 'electron';

export interface OCRModelConfig {
  det: string;
  rec: string;
  cls?: string;
  language: string;
  languageGroup: string;
}

export interface OCRResult {
  text: string;
  boundingBoxes: Array<{
    text: string;
    x: number;
    y: number;
    width: number;
    height: number;
    confidence: number;
  }>;
  confidence: number;
}

export interface ModelDownloadStatus {
  isDownloading: boolean;
  progress: number;
  currentModel: string;
  error?: string;
  // Note: Since we're using pre-downloaded models, isDownloading will always be false
}

export class PaddleOCRService {
  private static instance: PaddleOCRService;
  private modelConfigs: Map<string, OCRModelConfig> = new Map();
  private cachedModels: Map<string, boolean> = new Map();
  private initializedLanguages: Set<string> = new Set();
  private modelsPath: string;
  private activePythonProcesses: Set<any> = new Set(); // Track active Python processes
  private persistentPythonProcess: any = null; // Persistent Python service process
  private persistentProcessLanguage: string = '';
  private persistentProcessUseGpu: boolean = false;
  private persistentProcessRequestQueue: Array<{
    resolve: (result: OCRResult) => void;
    reject: (error: Error) => void;
    imagePath: string;
    language: string;
    useGpu: boolean;
  }> = [];
  private activeOCRRequests: Map<string, { process: any; reject: (error: Error) => void }> = new Map(); // Track active OCR requests
  private downloadStatus: ModelDownloadStatus = {
    isDownloading: false, // Always false since we use pre-downloaded models
    progress: 0,
    currentModel: ''
  };

  private constructor() {
    // Use the same models path where PaddlePaddle downloaded the models
    this.modelsPath = path.join(app.getPath('appData'), 'whispra', 'models', 'Paddle', 'PaddlePack');
    this.initializeLanguageConfigs();
  }

  public static getInstance(): PaddleOCRService {
    if (!PaddleOCRService.instance) {
      PaddleOCRService.instance = new PaddleOCRService();
    }
    return PaddleOCRService.instance;
  }

  /**
   * Warm up the Paddle service by pre-starting the persistent Python process AND loading models
   * This should be called when the user triggers screen translation to reduce latency
   */
  public async warmupService(language: string = 'en'): Promise<void> {
    try {
      // Get GPU mode setting
      const ConfigurationManager = require('./ConfigurationManager').ConfigurationManager;
      const configManager = ConfigurationManager.getInstance();
      const ocrGpuMode = configManager.getValue('uiSettings.ocrGpuMode') || 'normal';
      const useGpu = ocrGpuMode === 'fast';

      // Map language
      const languageMapping: { [key: string]: string } = {
        'japan': 'ja',
        'en': 'en',
        'ch': 'zh',
        'korean': 'ko',
        'cyrillic': 'ru',
        'ukrainian': 'uk',
        'arabic': 'ar',
        'devanagari': 'hi',
        'ja': 'ja',
        'zh': 'zh',
        'ko': 'ko',
        'ru': 'ru',  // Add direct Russian mapping
        'uk': 'uk',  // Add direct Ukrainian mapping
        'ar': 'ar',  // Add direct Arabic mapping
        'hi': 'hi',  // Add direct Hindi mapping
        'auto': 'en'
      };
      const inputLanguage = languageMapping[language] || 'en';

      console.log(`🏓 Warming up Paddle service (language=${inputLanguage}, useGpu=${useGpu})...`);
      
      // Send warmup started event IMMEDIATELY when warmup is initiated
      try {
        const { BrowserWindow } = require('electron');
        const allWindows = BrowserWindow.getAllWindows();
        console.log(`🏓 [IMMEDIATE] Found ${allWindows.length} windows to send warmup-started event`);
        // Send to ALL windows to ensure renderer gets it
        for (const win of allWindows) {
          if (!win.isDestroyed()) {
            const webContents = win.webContents;
            if (webContents && !webContents.isDestroyed()) {
              webContents.send('paddle-warmup-started');
              console.log(`🏓 [IMMEDIATE] Sent paddle-warmup-started event to window ${win.id}`);
            }
          }
        }
      } catch (error) {
        console.error('⚠️ [IMMEDIATE] Failed to send warmup-started event:', error);
      }
      
      // Start the persistent service in background (don't await - this is non-blocking warmup)
      // Use setTimeout to ensure this doesn't block the caller
      setTimeout(async () => {
        
        try {
          await this.startPersistentService(inputLanguage, useGpu);
          
          // Wait a bit for process to be ready
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Create a tiny test image to trigger actual model loading
          const fs = require('fs');
          const path = require('path');
          const { app } = require('electron');
          
          // Create a minimal test image (1x1 white pixel PNG)
          const warmupImagePath = path.join(app.getPath('temp'), `warmup_${Date.now()}.png`);
          const minimalPNG = Buffer.from([
            0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
            0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
            0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, // 1x1 dimensions
            0x08, 0x00, 0x00, 0x00, 0x00, 0x3A, 0x7E, 0x9B,
            0x55, 0x00, 0x00, 0x00, 0x0A, 0x49, 0x44, 0x41, // IDAT chunk
            0x54, 0x08, 0x1D, 0x01, 0xFF, 0x00, 0x00, 0xFF,
            0x00, 0x00, 0x00, 0x02, 0x00, 0x01, 0xE2, 0x21,
            0xBC, 0x33, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, // IEND chunk
            0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
          ]);
          
          fs.writeFileSync(warmupImagePath, minimalPNG);
          
          console.log(`🔥 Sending warmup request to trigger model loading...`);
          
          // Send warmup OCR request through persistent service - this triggers actual PaddleOCR initialization
          if (this.persistentPythonProcess && !this.persistentPythonProcess.killed) {
            await new Promise((resolve) => {
              const warmupTimeout = setTimeout(() => {
                console.log(`⚠️ Warmup timed out after 15s, but service is running`);
                resolve(null);
              }, 15000);
              
              // Queue warmup request
              this.persistentProcessRequestQueue.push({
                resolve: (result) => {
                  clearTimeout(warmupTimeout);
                  console.log(`✅ Paddle models loaded and cached, service ready`);
                  resolve(result);
                },
                reject: (error) => {
                  clearTimeout(warmupTimeout);
                  console.log(`⚠️ Warmup failed but service is running:`, error.message);
                  resolve(null);
                },
                imagePath: warmupImagePath,
                language: inputLanguage,
                useGpu
              });
              
              // Send warmup command
              try {
                const command = JSON.stringify({
                  type: 'ocr',
                  image_path: warmupImagePath,
                  language: inputLanguage,
                  use_gpu: useGpu
                }) + '\n';
                
                this.persistentPythonProcess.stdin.write(command);
              } catch (error) {
                clearTimeout(warmupTimeout);
                console.error('⚠️ Failed to send warmup command:', error);
                resolve(null);
              }
            });
          } else {
            // Process not ready - log and continue (service will start on first OCR request)
            console.log(`⚠️ Python process not ready yet for warmup, will start on first OCR request`);
          }
          
          // Clean up warmup image
          try {
            if (fs.existsSync(warmupImagePath)) {
              fs.unlinkSync(warmupImagePath);
            }
          } catch (e) {
            // Ignore cleanup errors
          }
          
          console.log(`✅ Paddle service warmed up and ready`);
          
          // Send warmup completed event to renderer AFTER actual warmup completes
          try {
            const { BrowserWindow } = require('electron');
            const allWindows = BrowserWindow.getAllWindows();
            console.log(`🏓 [AFTER WARMUP] Found ${allWindows.length} windows to send warmup-completed event`);
            // Send to ALL windows to ensure renderer gets it
            for (const win of allWindows) {
              if (!win.isDestroyed()) {
                const webContents = win.webContents;
                if (webContents && !webContents.isDestroyed()) {
                  webContents.send('paddle-warmup-completed');
                  console.log(`🏓 [AFTER WARMUP] Sent paddle-warmup-completed event to window ${win.id}`);
                }
              }
            }
          } catch (error) {
            console.error('⚠️ [AFTER WARMUP] Failed to send warmup-completed event:', error);
          }
        } catch (error) {
          console.error('⚠️ Failed to warm up Paddle service in background:', error);
          
          // Send warmup completed event even on error (so UI isn't stuck)
          try {
            const { BrowserWindow } = require('electron');
            const allWindows = BrowserWindow.getAllWindows();
            // Send to ALL windows
            for (const win of allWindows) {
              if (!win.isDestroyed()) {
                const webContents = win.webContents;
                if (webContents && !webContents.isDestroyed()) {
                  webContents.send('paddle-warmup-completed');
                  console.log(`🏓 Sent paddle-warmup-completed event after error to window ${win.id}`);
                }
              }
            }
          } catch (sendError) {
            console.error('⚠️ Failed to send warmup-completed event after error:', sendError);
          }
        }
      }, 0);
      
      // Return immediately - warmup runs in background
      console.log(`🏓 Warmup initiated in background, returning immediately`);
    } catch (error) {
      console.error('⚠️ Failed to initiate warmup:', error);
      // Don't throw - warmup failure shouldn't block the UI
    }
  }

  private initializeLanguageConfigs(): void {
    // Use PP-OCRv5 models that are already downloaded with PaddlePaddle
    this.modelConfigs.set('en', {
      det: 'ch_PP-OCRv5_det_infer',
      rec: 'latin_PP-OCRv5_mobile_rec_infer',
      language: 'en',
      languageGroup: 'latin'
    });

    this.modelConfigs.set('zh', {
      det: 'ch_PP-OCRv5_det_infer',
      rec: 'ch_PP-OCRv5_rec_infer',
      language: 'ch',
      languageGroup: 'chinese'
    });

    this.modelConfigs.set('ja', {
      det: 'ch_PP-OCRv5_det_infer',
      rec: 'ch_PP-OCRv5_rec_infer',
      language: 'japan',
      languageGroup: 'japanese'
    });

    this.modelConfigs.set('ko', {
      det: 'ch_PP-OCRv5_det_infer',
      rec: 'korean_PP-OCRv5_mobile_rec_infer',
      language: 'korean',
      languageGroup: 'korean'
    });

    // Note: Only configuring languages that we have v5 models for
    // Other languages would need their models downloaded separately
    this.modelConfigs.set('ru', {
      det: 'PP-OCRv5_mobile_det',
      rec: 'eslav_PP-OCRv5_mobile_rec',
      language: 'cyrillic',
      languageGroup: 'slavic'
    });

    this.modelConfigs.set('uk', {
      det: 'PP-OCRv5_mobile_det',
      rec: 'eslav_PP-OCRv5_mobile_rec',
      language: 'ukrainian',
      languageGroup: 'slavic'
    });

    this.modelConfigs.set('ar', {
      det: 'ch_PP-OCRv5_det_infer',
      rec: 'ch_PP-OCRv5_rec_infer', // Using Chinese rec as fallback for now
      language: 'arabic',
      languageGroup: 'arabic'
    });

    this.modelConfigs.set('hi', {
      det: 'ch_PP-OCRv5_det_infer',
      rec: 'ch_PP-OCRv5_rec_infer', // Using Chinese rec as fallback for now
      language: 'devanagari',
      languageGroup: 'indic'
    });

    // Note: Thai and other languages not in our v5 model set
    // These would need separate model downloads if needed
    this.modelConfigs.set('th', {
      det: 'ch_PP-OCRv5_det_infer',
      rec: 'ch_PP-OCRv5_rec_infer', // Using Chinese rec as fallback for now
      language: 'thai',
      languageGroup: 'thai'
    });

    // Default Latin languages use English models (which we have)
    const latinLanguages = ['es', 'fr', 'de', 'it', 'pt', 'tr', 'pl', 'nl', 'sv', 'da', 'no'];
    latinLanguages.forEach(lang => {
      this.modelConfigs.set(lang, {
        det: 'ch_PP-OCRv5_det_infer',
        rec: 'latin_PP-OCRv5_mobile_rec_infer',
        language: 'en',
        languageGroup: 'latin'
      });
    });
  }

  public async initializeForLanguage(targetLanguage: string): Promise<void> {
    if (this.initializedLanguages.has(targetLanguage)) {
      console.log(`📖 OCR already initialized for language: ${targetLanguage}`);
      return;
    }

    const config = this.modelConfigs.get(targetLanguage);
    if (!config) {
      throw new Error(`Unsupported OCR language: ${targetLanguage}`);
    }

    console.log(`📖 Initializing OCR for language: ${targetLanguage} (${config.languageGroup})`);

    // Ensure models directory exists
    if (!fs.existsSync(this.modelsPath)) {
      fs.mkdirSync(this.modelsPath, { recursive: true });
    }

    // Pre-populate cache with existing models
    const requiredModels = [config.det, config.rec];
    if (config.cls) {
      requiredModels.push(config.cls);
    }

    for (const modelName of requiredModels) {
      const modelPath = path.join(this.modelsPath, modelName);
      if (fs.existsSync(modelPath) && !this.cachedModels.get(modelName)) {
        console.log(`📖 Found existing model: ${modelName}`);
        this.cachedModels.set(modelName, true);
      }
    }

    // Verify models exist (don't download)
    await this.ensureModelsDownloaded(config);

    this.initializedLanguages.add(targetLanguage);
    console.log(`📖 OCR initialized successfully for language: ${targetLanguage}`);
  }

  private async ensureModelsDownloaded(config: OCRModelConfig): Promise<void> {
    const requiredModels = [config.det, config.rec];
    if (config.cls) {
      requiredModels.push(config.cls);
    }

    for (const modelName of requiredModels) {
      if (!this.cachedModels.get(modelName)) {
        // Check if model already exists locally before downloading
        const modelPath = path.join(this.modelsPath, modelName);
        if (fs.existsSync(modelPath)) {
          console.log(`📖 Model ${modelName} already exists locally, skipping download`);
          this.cachedModels.set(modelName, true);
        } else {
          console.log(`📖 Model ${modelName} not found locally, would need to download (currently disabled)`);
          // For now, we'll mark it as cached to prevent download attempts
          // TODO: Implement actual model downloading if needed for unsupported languages
          this.cachedModels.set(modelName, true);
        }
      }
    }
  }

  private async downloadModel(modelName: string): Promise<void> {
    // Since we're using pre-downloaded models, this method just verifies they exist
    console.log(`📖 Verifying OCR model: ${modelName}`);

    const modelPath = path.join(this.modelsPath, modelName);
    if (fs.existsSync(modelPath)) {
      console.log(`✅ Model ${modelName} found locally`);
    } else {
      console.warn(`⚠️ Model ${modelName} not found locally - OCR may not work for this language`);
    }
  }

  private async simulateModelDownload(modelName: string): Promise<void> {
    // Since we're using pre-downloaded models, this method just verifies the model exists
    console.log(`📖 Verifying model ${modelName}...`);

    const modelPath = path.join(this.modelsPath, modelName);
    if (fs.existsSync(modelPath)) {
      console.log(`✅ Model ${modelName} found locally`);
    } else {
      console.warn(`⚠️ Model ${modelName} not found locally`);
    }
  }


  public async extractText(imageBuffer: Buffer, targetLanguage: string): Promise<OCRResult> {
    const config = this.modelConfigs.get(targetLanguage);
    if (!config) {
      throw new Error(`Unsupported OCR language: ${targetLanguage}`);
    }

    // Ensure language is initialized
    await this.initializeForLanguage(targetLanguage);

    // Save buffer to temporary file
    const tempImagePath = path.join(this.modelsPath, `temp_${Date.now()}.jpg`);
    fs.writeFileSync(tempImagePath, imageBuffer);

    try {
      const result = await this.performOCR(tempImagePath, config);
      return result;
    } finally {
      // Clean up temporary file
      if (fs.existsSync(tempImagePath)) {
        fs.unlinkSync(tempImagePath);
      }
    }
  }

  private async performOCR(imagePath: string, config: OCRModelConfig): Promise<OCRResult> {
    // Get GPU mode setting
    const ConfigurationManager = require('./ConfigurationManager').ConfigurationManager;
    const configManager = ConfigurationManager.getInstance();
    const ocrGpuMode = configManager.getValue('uiSettings.ocrGpuMode') || 'normal';
    const useGpu = ocrGpuMode === 'fast';

    // Map language
    const languageMapping: { [key: string]: string } = {
      'japan': 'ja',
      'en': 'en',
      'ch': 'zh',
      'korean': 'ko',
      'cyrillic': 'ru',
      'ukrainian': 'uk',
      'arabic': 'ar',
      'devanagari': 'hi',
      'ja': 'ja',
      'zh': 'zh',
      'ko': 'ko',
      'ru': 'ru',  // Add direct Russian mapping
      'uk': 'uk',  // Add direct Ukrainian mapping
      'ar': 'ar',  // Add direct Arabic mapping
      'hi': 'hi'   // Add direct Hindi mapping
    };
    const inputLanguage = languageMapping[config.language] || 'ja';

    // Generate unique request ID
    const requestId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Try to use persistent service
    try {
      await this.startPersistentService(inputLanguage, useGpu);
      
      if (this.persistentPythonProcess && !this.persistentPythonProcess.killed) {
        return new Promise((resolve, reject) => {
          // Queue request
          this.persistentProcessRequestQueue.push({
            resolve,
            reject,
            imagePath,
            language: inputLanguage,
            useGpu
          });

          // Send OCR command
          try {
            const command = JSON.stringify({
              type: 'ocr',
              image_path: imagePath,
              language: inputLanguage,
              use_gpu: useGpu
            }) + '\n';
            
            this.persistentPythonProcess.stdin.write(command);
            
            // Timeout after 30 seconds
            setTimeout(() => {
              const index = this.persistentProcessRequestQueue.findIndex(r => r.resolve === resolve);
              if (index >= 0) {
                this.persistentProcessRequestQueue.splice(index, 1);
                reject(new Error('OCR request timeout'));
              }
            }, 30000);
          } catch (error) {
            const index = this.persistentProcessRequestQueue.findIndex(r => r.resolve === resolve);
            if (index >= 0) {
              this.persistentProcessRequestQueue.splice(index, 1);
            }
            reject(error);
          }
        });
      }
    } catch (error) {
      console.log('⚠️ Failed to use persistent service, falling back to one-shot:', error);
    }

    // Fallback to one-shot process
    return new Promise((resolve, reject) => {
      const { spawn } = require('child_process');
      const path = require('path');
      const fs = require('fs');
      const { app } = require('electron');

      // Find Python executable
      const embeddedPythonExe = resolveEmbeddedPythonExecutable();
      const pythonCandidates = [
        embeddedPythonExe,
        path.join(process.cwd(), 'python', 'python.exe'),
        path.join(process.cwd(), 'resources', 'python', 'python.exe')
      ].filter(Boolean) as string[];

      let pythonPath = embeddedPythonExe || 'python';
      for (const candidate of pythonCandidates) {
        if (candidate && fs.existsSync(candidate)) {
          pythonPath = candidate;
          break;
        }
      }

      // OCR script path - check multiple locations for dev and packaged app
      const possiblePaths = [
        // Packaged app paths (ASAR unpacked) - MUST check unpacked first
        path.join(process.resourcesPath || '', 'app.asar.unpacked', 'dist', 'paddle', 'ocr_screen.py'),
        path.join(process.resourcesPath || '', 'python', 'ocr_screen.py'),
        // Development paths
        path.join(__dirname, '..', 'paddle', 'ocr_screen.py'),
        path.join(__dirname, 'ocr_screen.py'),
        path.join(process.cwd(), 'dist', 'paddle', 'ocr_screen.py'),
        path.join(process.cwd(), 'src', 'paddle', 'ocr_screen.py'),
        // Fallback - if app.asar is directly accessible (shouldn't happen)
        path.join(app ? app.getAppPath() : process.cwd(), 'dist', 'paddle', 'ocr_screen.py')
      ];

      let ocrScriptPath = '';
      console.log('🔍 Searching for OCR script in the following locations:');
      for (const p of possiblePaths) {
        console.log(`  Checking: ${p}`);
        if (fs.existsSync(p)) {
          ocrScriptPath = p;
          console.log(`  ✅ Found at: ${p}`);
          break;
        }
      }

      if (!ocrScriptPath) {
        console.error('❌ OCR script not found in any of the checked locations');
        console.error('Checked paths:', possiblePaths);
        const error = new Error('OCR script not found');
        ErrorReportingService.getInstance().captureError(error, {
          category: ErrorCategory.CONFIGURATION,
          severity: ErrorSeverity.HIGH,
          component: 'PaddleOCRService',
          context: { action: 'performOCR', checkedPaths: possiblePaths.length }
        });
        reject(error);
        return;
      }

      // Map config language back to input language code for Python script
      const languageMapping: { [key: string]: string } = {
        'japan': 'ja',
        'en': 'en',
        'ch': 'zh',
        'korean': 'ko',
        'cyrillic': 'ru',
        'ukrainian': 'uk',
        'arabic': 'ar',
        'devanagari': 'hi',
        'ja': 'ja',
        'zh': 'zh',
        'ko': 'ko',
        'ru': 'ru',  // Add direct Russian mapping
        'uk': 'uk',  // Add direct Ukrainian mapping
        'ar': 'ar',  // Add direct Arabic mapping
        'hi': 'hi'   // Add direct Hindi mapping
      };

      const inputLanguage = languageMapping[config.language] || 'ja';
      console.log(`📖 Using Python OCR: ${pythonPath} ${ocrScriptPath} ${inputLanguage} (from ${config.language})`);

      // Get GPU mode setting from config
      const ConfigurationManager = require('./ConfigurationManager').ConfigurationManager;
      const configManager = ConfigurationManager.getInstance();
      const ocrGpuMode = configManager.getValue('uiSettings.ocrGpuMode') || 'normal';
      const useGpu = ocrGpuMode === 'fast' ? 'true' : 'false';
      
      console.log(`⚡ PaddleOCRService GPU mode: ${ocrGpuMode} (use_gpu=${useGpu})`);

      // Set up environment
      const env = { ...process.env };
      const appDataPath = app.getPath('appData');
      const paddleModelsPath = path.join(appDataPath, 'whispra', 'models', 'Paddle');
      const gpuPaddleModelsPath = path.join(paddleModelsPath, 'gpu');

      // Set PYTHONPATH to prioritize GPU PaddlePaddle when GPU mode is enabled
      if (useGpu === 'true' && fs.existsSync(gpuPaddleModelsPath)) {
        // GPU mode: prioritize GPU PaddlePaddle path first
        env.PYTHONPATH = gpuPaddleModelsPath;
        if (paddleModelsPath !== gpuPaddleModelsPath) {
          env.PYTHONPATH += path.delimiter + paddleModelsPath;
        }
        if (process.env.PYTHONPATH) {
          env.PYTHONPATH += path.delimiter + process.env.PYTHONPATH;
        }
        console.log(`🎮 PaddleOCRService using GPU PaddlePaddle path (priority): ${gpuPaddleModelsPath}`);
      } else {
        // Normal mode: use regular PaddlePaddle path
        env.PYTHONPATH = paddleModelsPath;
        if (process.env.PYTHONPATH) {
          env.PYTHONPATH += path.delimiter + process.env.PYTHONPATH;
        }
        console.log(`💻 PaddleOCRService using CPU PaddlePaddle path: ${paddleModelsPath}`);
      }

      console.log(`🐍 About to spawn Python process with args: [${ocrScriptPath}, ${imagePath}, ${inputLanguage}, ${useGpu}]`);

      const pythonProcess = spawn(pythonPath, [ocrScriptPath, imagePath, inputLanguage, useGpu], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: env
      });

      // Track this process for cleanup
      this.activePythonProcesses.add(pythonProcess);

      let stdout = '';
      let stderr = '';

      pythonProcess.stdout.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      pythonProcess.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      pythonProcess.on('close', (code: number) => {
        // Remove from active processes
        this.activePythonProcesses.delete(pythonProcess);

        if (stderr) {
          console.log('📖 OCR stderr:', stderr);
        }

        if (code === 0 && stdout) {
          try {
            const pythonResult = JSON.parse(stdout);

            if (pythonResult.success) {
              // Convert Python OCR result to our format
              const boundingBoxes = pythonResult.text_boxes.map((box: any) => ({
                text: box.text,
                x: box.x,
                y: box.y,
                width: box.width,
                height: box.height,
                confidence: box.confidence
              }));

              const result: OCRResult = {
                text: pythonResult.full_text || '',
                boundingBoxes: boundingBoxes,
                confidence: boundingBoxes.length > 0 ? boundingBoxes[0].confidence : 0
              };

              console.log(`📖 Real OCR completed: ${boundingBoxes.length} text boxes found`);
              resolve(result);
            } else {
              reject(new Error(pythonResult.error || 'OCR failed'));
            }
          } catch (parseError) {
            console.error('📖 Failed to parse OCR output:', parseError);
            reject(new Error('Failed to parse OCR output'));
          }
        } else {
          console.error(`📖 OCR process failed with code ${code}`);
          reject(new Error(`OCR process failed with code ${code}. Error: ${stderr}`));
        }
      });

      pythonProcess.on('error', (error: Error) => {
        // Remove from active requests
        this.activeOCRRequests.delete(requestId);

        console.error('📖 Failed to start OCR process:', error);
        ErrorReportingService.getInstance().captureError(error, {
          category: ErrorCategory.PROCESSING,
          severity: ErrorSeverity.HIGH,
          component: 'PaddleOCRService',
          context: { action: 'performOCR', pythonPath, language: inputLanguage, useGpu }
        });
        reject(error);
      });
    });
  }

  public getSupportedLanguages(): string[] {
    return Array.from(this.modelConfigs.keys());
  }

  public getDownloadStatus(): ModelDownloadStatus {
    // Since we use pre-downloaded models, always return not downloading
    return {
      isDownloading: false,
      progress: 100, // Consider it 100% complete since models are pre-downloaded
      currentModel: '',
      error: undefined
    };
  }

  public isLanguageInitialized(language: string): boolean {
    return this.initializedLanguages.has(language);
  }

  public getLanguageConfig(language: string): OCRModelConfig | undefined {
    return this.modelConfigs.get(language);
  }

  public clearCache(): void {
    this.cachedModels.clear();
    this.initializedLanguages.clear();
    console.log('📖 OCR initialization state cleared');
  }

  /**
   * Cancel all active OCR requests and kill their processes
   */
  public cancelAllActiveRequests(): void {
    console.log(`🛑 Cancelling ${this.activeOCRRequests.size} active OCR requests`);
    
    // Reject all pending requests
    for (const [requestId, request] of this.activeOCRRequests.entries()) {
      try {
        request.reject(new Error('OCR request cancelled'));
        // Kill the process
        if (request.process && !request.process.killed) {
          request.process.kill('SIGKILL');
        }
      } catch (error) {
        console.error(`Error cancelling request ${requestId}:`, error);
      }
    }
    
    // Clear active requests
    this.activeOCRRequests.clear();
    
    // Reject all pending persistent service requests
    for (const req of this.persistentProcessRequestQueue) {
      req.reject(new Error('OCR request cancelled'));
    }
    this.persistentProcessRequestQueue = [];
  }

  /**
   * Start persistent Python OCR service if not already running with matching settings
   */
  private async startPersistentService(language: string, useGpu: boolean): Promise<void> {
    // Check if we need to restart the service
    if (this.persistentPythonProcess && 
        !this.persistentPythonProcess.killed &&
        this.persistentProcessLanguage === language &&
        this.persistentProcessUseGpu === useGpu) {
      // Service is already running with correct settings
      console.log(`♻️ Reusing existing persistent OCR service (language=${language}, useGpu=${useGpu})`);
      return;
    }

    // Log why we're restarting
    if (this.persistentPythonProcess) {
      const isKilled = this.persistentPythonProcess.killed;
      console.log(`🔍 Checking persistent service state:`, {
        exists: !!this.persistentPythonProcess,
        killed: isKilled,
        currentLanguage: this.persistentProcessLanguage,
        requestedLanguage: language,
        currentUseGpu: this.persistentProcessUseGpu,
        requestedUseGpu: useGpu
      });
      
      if (isKilled) {
        console.log(`🔄 Persistent service was killed, restarting...`);
      } else if (this.persistentProcessLanguage !== language) {
        console.log(`🔄 Language changed from ${this.persistentProcessLanguage} to ${language}, restarting...`);
      } else if (this.persistentProcessUseGpu !== useGpu) {
        console.log(`🔄 GPU mode changed from ${this.persistentProcessUseGpu} to ${useGpu}, restarting...`);
      } else {
        console.log(`⚠️ Service exists but check failed - restarting anyway`);
      }
    } else {
      console.log(`🆕 No existing persistent service, starting new one...`);
    }

    // Stop existing service if settings changed
    if (this.persistentPythonProcess && !this.persistentPythonProcess.killed) {
      console.log('🔄 Restarting persistent OCR service due to settings change...');
      await this.stopPersistentService();
      // Wait a bit to ensure process is fully stopped
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    const { spawn } = require('child_process');
    const path = require('path');
    const fs = require('fs');
    const { app } = require('electron');

    // Find Python executable
    const embeddedPythonExe = resolveEmbeddedPythonExecutable();
    const pythonCandidates = [
      embeddedPythonExe,
      path.join(process.cwd(), 'python', 'python.exe'),
      path.join(process.cwd(), 'resources', 'python', 'python.exe')
    ].filter(Boolean) as string[];

    let pythonPath = embeddedPythonExe || 'python';
    for (const candidate of pythonCandidates) {
      if (candidate && fs.existsSync(candidate)) {
        pythonPath = candidate;
        break;
      }
    }

    // Find OCR service script - prioritize packaged app paths first
    const serviceScriptPaths = [
      // Packaged app paths (ASAR unpacked) - MUST check first
      path.join(process.resourcesPath || '', 'app.asar.unpacked', 'dist', 'paddle', 'ocr_service.py'),
      path.join(process.resourcesPath || '', 'app', 'dist', 'paddle', 'ocr_service.py'),
      // Development paths
      path.join(__dirname, '..', 'paddle', 'ocr_service.py'),
      path.join(__dirname, 'paddle', 'ocr_service.py'),
      path.join(__dirname, 'ocr_service.py'),
      path.join(process.cwd(), 'dist', 'paddle', 'ocr_service.py'),
      path.join(process.cwd(), 'src', 'paddle', 'ocr_service.py'),
      // Fallback - if app.asar is directly accessible (shouldn't happen)
      path.join(app ? app.getAppPath() : process.cwd(), 'dist', 'paddle', 'ocr_service.py')
    ];

    console.log(`🔍 Looking for ocr_service.py in ${serviceScriptPaths.length} possible locations...`);
    console.log(`🔍 __dirname: ${__dirname}`);
    console.log(`🔍 process.cwd(): ${process.cwd()}`);
    console.log(`🔍 process.resourcesPath: ${process.resourcesPath || 'undefined'}`);
    console.log(`🔍 app.isPackaged: ${app ? app.isPackaged : 'undefined'}`);

    let serviceScriptPath = '';
    for (const p of serviceScriptPaths) {
      console.log(`🔍 Checking: ${p} - exists: ${fs.existsSync(p)}`);
      if (fs.existsSync(p)) {
        serviceScriptPath = p;
        console.log(`✅ Found ocr_service.py at: ${serviceScriptPath}`);
        break;
      }
    }

    // Fallback to ocr_screen.py if service script not found
    if (!serviceScriptPath) {
      console.log('⚠️ OCR service script not found, checking for ocr_screen.py fallback...');
      const fallbackPaths = [
        path.join(process.resourcesPath || '', 'app.asar.unpacked', 'dist', 'paddle', 'ocr_screen.py'),
        path.join(process.resourcesPath || '', 'app', 'dist', 'paddle', 'ocr_screen.py'),
        path.join(__dirname, '..', 'paddle', 'ocr_screen.py'),
        path.join(process.cwd(), 'dist', 'paddle', 'ocr_screen.py'),
        path.join(process.cwd(), 'src', 'paddle', 'ocr_screen.py')
      ];
      
      for (const p of fallbackPaths) {
        console.log(`🔍 Checking fallback: ${p} - exists: ${fs.existsSync(p)}`);
        if (fs.existsSync(p)) {
          serviceScriptPath = p;
          console.log(`✅ Found ocr_screen.py fallback at: ${serviceScriptPath}`);
          break;
        }
      }
      
      if (!serviceScriptPath) {
        console.log('⚠️ OCR service script not found, using fallback ocr_screen.py');
        return; // Will use old method
      }
    }

    // Set up environment
    const env = { ...process.env };
    const appDataPath = app.getPath('appData');
    const paddleModelsPath = path.join(appDataPath, 'whispra', 'models', 'Paddle');
    const gpuPaddleModelsPath = path.join(paddleModelsPath, 'gpu');

    if (useGpu && fs.existsSync(gpuPaddleModelsPath)) {
      env.PYTHONPATH = gpuPaddleModelsPath;
      if (paddleModelsPath !== gpuPaddleModelsPath) {
        env.PYTHONPATH += path.delimiter + paddleModelsPath;
      }
      if (process.env.PYTHONPATH) {
        env.PYTHONPATH += path.delimiter + process.env.PYTHONPATH;
      }
    } else {
      env.PYTHONPATH = paddleModelsPath;
      if (process.env.PYTHONPATH) {
        env.PYTHONPATH += path.delimiter + process.env.PYTHONPATH;
      }
    }

    console.log(`🚀 Starting persistent OCR service (language=${language}, useGpu=${useGpu})...`);

    const pythonProcess = spawn(pythonPath, [serviceScriptPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: env
    });

    this.persistentPythonProcess = pythonProcess;
    this.persistentProcessLanguage = language;
    this.persistentProcessUseGpu = useGpu;
    this.activePythonProcesses.add(pythonProcess);

    let buffer = '';

    pythonProcess.stdout.on('data', (data: Buffer) => {
      buffer += data.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.trim()) {
          try {
            const result = JSON.parse(line.trim());
            console.log('📖 OCR service response:', JSON.stringify(result).substring(0, 200));
            this.handleServiceResponse(result);
          } catch (e) {
            console.error('Failed to parse service response:', e);
            console.error('Raw line:', line.substring(0, 200));
          }
        }
      }
    });

    pythonProcess.stderr.on('data', (data: Buffer) => {
      console.log('📖 OCR service stderr:', data.toString().trim());
    });

    pythonProcess.on('close', (code: number) => {
      console.log(`📖 Persistent OCR service exited with code ${code}`);
      this.activePythonProcesses.delete(pythonProcess);
      if (this.persistentPythonProcess === pythonProcess) {
        console.log(`⚠️ Persistent service process died - will restart on next request`);
        this.persistentPythonProcess = null;
        this.persistentProcessLanguage = '';
        this.persistentProcessUseGpu = false;
        // Process requests in queue with error
        this.persistentProcessRequestQueue.forEach(req => {
          req.reject(new Error('OCR service process exited'));
        });
        this.persistentProcessRequestQueue = [];
      }
    });

    pythonProcess.on('error', (error: Error) => {
      console.error('📖 Failed to start persistent OCR service:', error);
      if (this.persistentPythonProcess === pythonProcess) {
        this.persistentPythonProcess = null;
      }
      // Process requests in queue with error
      this.persistentProcessRequestQueue.forEach(req => {
        req.reject(error);
      });
      this.persistentProcessRequestQueue = [];
    });

    // Wait for service to initialize and verify it's alive
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Verify service is alive with a ping (use a separate check, don't interfere with main handler)
    try {
      const pingSent = Date.now();
      pythonProcess.stdin.write(JSON.stringify({ type: 'ping' }) + '\n');
      
      // Wait a bit to see if we get a response
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Check if process is still alive
      if (pythonProcess.killed || !pythonProcess.stdin.writable) {
        throw new Error('Process died during initialization');
      }
      
      console.log('✅ Persistent OCR service initialized');
    } catch (error) {
      console.warn('⚠️ Service initialization check failed:', error);
    }
  }

  /**
   * Stop persistent Python OCR service
   */
  private async stopPersistentService(): Promise<void> {
    return new Promise((resolve) => {
      const processToKill = this.persistentPythonProcess;
      
      if (processToKill && !processToKill.killed) {
        console.log('🛑 Stopping persistent OCR service...');
        try {
          // Send shutdown command
          processToKill.stdin.write(JSON.stringify({ type: 'shutdown' }) + '\n');
          processToKill.stdin.end();
        } catch (e) {
          // Process might already be dead
        }
        
        // Wait for process to exit gracefully, then kill if needed
        const killTimeout = setTimeout(() => {
          if (processToKill && !processToKill.killed) {
            console.log('💀 Force killing persistent service...');
            processToKill.kill('SIGKILL');
          }
          // Only clear if this is still the active process
          if (this.persistentPythonProcess === processToKill) {
            this.persistentPythonProcess = null;
            this.persistentProcessLanguage = '';
            this.persistentProcessUseGpu = false;
          }
          resolve();
        }, 2000);
        
        // Clear timeout if process exits naturally
        const closeHandler = () => {
          clearTimeout(killTimeout);
          processToKill.removeListener('close', closeHandler);
          if (this.persistentPythonProcess === processToKill) {
            this.persistentPythonProcess = null;
            this.persistentProcessLanguage = '';
            this.persistentProcessUseGpu = false;
          }
          resolve();
        };
        
        processToKill.once('close', closeHandler);
      } else {
        this.persistentPythonProcess = null;
        this.persistentProcessLanguage = '';
        this.persistentProcessUseGpu = false;
        resolve();
      }
    });
  }

  /**
   * Handle response from persistent service
   */
  private handleServiceResponse(result: any): void {
    if (this.persistentProcessRequestQueue.length === 0) {
      return;
    }

    const request = this.persistentProcessRequestQueue.shift();
    if (!request) return;

    if (result.success) {
      // Defensive check: ensure text_boxes exists and is an array
      const textBoxes = Array.isArray(result.text_boxes) ? result.text_boxes : [];

      const boundingBoxes = textBoxes.map((box: any) => ({
        text: box.text || '',
        x: box.x || 0,
        y: box.y || 0,
        width: box.width || 0,
        height: box.height || 0,
        confidence: box.confidence || 0
      }));

      const ocrResult: OCRResult = {
        text: result.full_text || '',
        boundingBoxes: boundingBoxes,
        confidence: boundingBoxes.length > 0 ? boundingBoxes[0].confidence : 0
      };

      request.resolve(ocrResult);
    } else {
      request.reject(new Error(result.error || 'OCR failed'));
    }
  }

  /**
   * Cleanup method to kill all active Python processes IMMEDIATELY
   * Preserves persistent service if keepPersistent is true
   */
  public cleanup(keepPersistent: boolean = false): void {
    console.log(`🧹 IMMEDIATE cleanup of ${this.activePythonProcesses.size} active Python OCR processes (keepPersistent=${keepPersistent})`);

    // Cancel all active OCR requests first
    this.cancelAllActiveRequests();

    // Stop persistent service first if not keeping it
    if (!keepPersistent) {
      this.stopPersistentService();
    }

    // IMMEDIATE force kill - no graceful termination, no waiting
    for (const process of this.activePythonProcesses) {
      try {
        // Skip persistent process if we're keeping it
        if (keepPersistent && process === this.persistentPythonProcess) {
          console.log('♻️ Preserving persistent OCR service');
          continue;
        }
        
        if (process && !process.killed) {
          console.log('💀 FORCE KILLING Python OCR process IMMEDIATELY...');
          
          // IMMEDIATE force kill - no SIGTERM, straight to SIGKILL
          process.kill('SIGKILL');
          console.log('💀 Python OCR process killed');
        }
      } catch (error) {
        console.error('Error force killing Python process:', error);
      }
    }

    // Remove killed processes from set (except persistent if keeping it)
    if (!keepPersistent) {
      this.activePythonProcesses.clear();
    } else {
      // Only keep persistent process in the set
      const persistent = this.persistentPythonProcess;
      this.activePythonProcesses.clear();
      if (persistent && !persistent.killed) {
        this.activePythonProcesses.add(persistent);
      }
    }

    // IMMEDIATE Windows process termination - don't kill persistent service if keeping it
    if (process.platform === 'win32' && !keepPersistent) {
      try {
        console.log('💀 IMMEDIATE Windows taskkill for all Python processes...');
        const { execSync } = require('child_process');
        
        // Kill ALL Python processes - multiple attempts with no delay
        for (let i = 0; i < 3; i++) {
          try {
            execSync('taskkill /f /im python.exe /t', { stdio: 'pipe' });
          } catch (e) { /* Process might not exist */ }
          try {
            execSync('taskkill /f /im python3.exe /t', { stdio: 'pipe' });
          } catch (e) { /* Process might not exist */ }
        }
        
        console.log('💀 Completed immediate Python process termination');
      } catch (e) {
        console.error('Error in Windows taskkill:', e);
      }
    } else if (keepPersistent) {
      console.log('♻️ Skipping Windows taskkill to preserve persistent OCR service');
    }
  }
}