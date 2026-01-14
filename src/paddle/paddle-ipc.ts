import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { PaddlePaddleOverlayManager } from './PaddlePaddleOverlayManager';
import { resolveEmbeddedPythonExecutable } from '../utils/pythonPath';

/**
 * Initialize PaddlePaddle IPC handlers
 */
export function initializePaddleIPC(): void {
  console.log('🏓 Initializing PaddlePaddle IPC handlers...');

  // Check installation handler
  try {
    ipcMain.removeHandler('paddlepaddle-check:check-installation');
  } catch {}

  ipcMain.handle('paddlepaddle-check:check-installation', async () => {
    try {
      console.log('🏓 Checking PaddlePaddle installation...');

      const paddlePaddleManager = PaddlePaddleOverlayManager.getInstance();
      const result = await paddlePaddleManager.checkPaddlePaddleInstallation();

      console.log('🏓 PaddlePaddle check result:', result);
      return { success: true, ...result };
    } catch (error) {
      console.error('❌ Error in paddlepaddle-check:check-installation handler:', error);
      return {
        success: false,
        isInstalled: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  // Install handler
  try {
    ipcMain.removeHandler('paddlepaddle-check:install');
  } catch {}

  ipcMain.handle('paddlepaddle-check:install', async () => {
    try {
      console.log('🏓 Starting PaddlePaddle installation...');

      const paddlePaddleManager = PaddlePaddleOverlayManager.getInstance();
      const result = await paddlePaddleManager.installPaddlePaddle();

      console.log('🏓 PaddlePaddle installation result:', result);

      // If installation was successful, close the overlay and switch to screen translation tab
      if (result.success) {
        console.log('🏓 Installation successful, closing overlay and switching to screen translation tab');
        paddlePaddleManager.closePaddlePaddleCheckOverlay();

        // Switch to screen translation tab
        const { BrowserWindow } = require('electron');
        const mainWindow = BrowserWindow.getAllWindows().find((win: any) =>
          !win.isDestroyed() && win.getTitle() === 'Whispra'
        );

        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('switch-to-tab', 'screen-translation');
        }
      }

      return result;
    } catch (error) {
      console.error('❌ Error in paddlepaddle-check:install handler:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  // Complete handler
  try {
    ipcMain.removeHandler('paddlepaddle-check:complete');
  } catch {}

  ipcMain.handle('paddlepaddle-check:complete', async (event: IpcMainInvokeEvent, data: { cancelled: boolean }) => {
    try {
      console.log('🏓 PaddlePaddle check completed:', data);

      const paddlePaddleManager = PaddlePaddleOverlayManager.getInstance();
      paddlePaddleManager.closePaddlePaddleCheckOverlay();

      // If user cancelled, switch back to translation tab
      if (data.cancelled) {
        console.log('🏓 User cancelled, switching back to translation tab');
        const { BrowserWindow } = require('electron');
        const mainWindow = BrowserWindow.getAllWindows().find((win: any) =>
          !win.isDestroyed() && win.getTitle() === 'Whispra'
        );

        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('switch-to-tab', 'translation');
        }
      }

      console.log('🏓 PaddlePaddle check complete handler finished');
      return { success: true, cancelled: data.cancelled };
    } catch (error) {
      console.error('❌ Error in paddlepaddle-check:complete handler:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  // Show overlay handler
  try {
    ipcMain.removeAllListeners('paddlepaddle-check:show-overlay');
  } catch {}

  ipcMain.on('paddlepaddle-check:show-overlay', async () => {
    try {
      console.log('🏓 Received request to show PaddlePaddle check overlay');

      const paddlePaddleManager = PaddlePaddleOverlayManager.getInstance();
      await paddlePaddleManager.showPaddlePaddleCheckOverlay();

    } catch (error) {
      console.error('❌ Error showing PaddlePaddle check overlay:', error);
    }
  });

  // Screenshot handler
  try {
    ipcMain.removeHandler('paddle:take-screenshot');
  } catch {}

  ipcMain.handle('paddle:take-screenshot', async (event: IpcMainInvokeEvent, data: { displayId: string }) => {
    try {
      console.log(`📸 Taking screenshot for display: ${data.displayId}`);

      const { ScreenCaptureService } = await import('../services/ScreenCaptureService');
      const captureService = ScreenCaptureService.getInstance();

      // Take screenshot
      const captureResult = await captureService.captureDisplay(data.displayId, { format: 'png' });

      // Save to temporary file
      const { app } = require('electron');
      const path = require('path');
      const fs = require('fs');

      const tempDir = path.join(app.getPath('temp'), 'whispra-screenshots');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const timestamp = Date.now();
      const imagePath = path.join(tempDir, `screenshot_${timestamp}.png`);

      fs.writeFileSync(imagePath, captureResult.buffer);

      console.log(`✅ Screenshot saved: ${imagePath}`);

      return {
        success: true,
        imagePath,
        width: captureResult.width,
        height: captureResult.height
      };

    } catch (error) {
      console.error('❌ Error taking screenshot:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  // OCR handler
  try {
    ipcMain.removeHandler('paddle:run-ocr');
  } catch {}

  ipcMain.handle('paddle:run-ocr', async (event: IpcMainInvokeEvent, data: { imagePath: string, language: string }) => {
    try {
      console.log(`🔍 Running OCR on: ${data.imagePath} (language: ${data.language})`);

      const { spawn } = require('child_process');
      const path = require('path');

      // Find Python executable (bundled with project)
      const fs = require('fs');
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

      // OCR script path - try multiple locations
      const possiblePaths = [
        path.join(__dirname, '../paddle/ocr_screen.py'),
        path.join(__dirname, 'ocr_screen.py'),
        path.join(process.cwd(), 'dist', 'paddle', 'ocr_screen.py'),
        path.join(process.cwd(), 'src', 'paddle', 'ocr_screen.py')
      ];

      let ocrScriptPath = '';
      for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
          ocrScriptPath = p;
          break;
        }
      }

      if (!ocrScriptPath) {
        console.error('❌ OCR script not found in any of these paths:', possiblePaths);
        return {
          success: false,
          error: 'OCR script not found',
          text_boxes: []
        };
      }

      console.log(`🐍 Using Python: ${pythonPath}`);
      console.log(`📄 Using OCR script: ${ocrScriptPath}`);

      // Setup environment for bundled Python
      const env = { ...process.env };
      const { app } = require('electron');

      // Add bundled Python paths
      const pythonDir = path.dirname(pythonPath);

      // PaddleOCR is installed in AppData/Local/whispra/models/paddle
      const appDataPath = app.getPath('appData');
      const paddleModelsPath = path.join(appDataPath, 'whispra', 'models', 'Paddle');
      const gpuPaddleModelsPath = path.join(paddleModelsPath, 'gpu');

      // Get GPU mode setting from config FIRST
      const ConfigurationManager = require('../services/ConfigurationManager').ConfigurationManager;
      const configManager = ConfigurationManager.getInstance();
      
      // Debug: Log the full config to see what's stored
      const fullConfig = configManager.getConfig();
      console.log(`🔍 Full config uiSettings:`, JSON.stringify(fullConfig.uiSettings, null, 2));
      
      const ocrGpuMode = configManager.getValue('uiSettings.ocrGpuMode') || 'normal';
      const useGpu = ocrGpuMode === 'fast' ? 'true' : 'false';

      console.log(`⚡ OCR GPU mode from config: "${ocrGpuMode}" (use_gpu=${useGpu})`);

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
        console.log(`🎮 Using GPU PaddlePaddle path (priority): ${gpuPaddleModelsPath}`);
      } else {
        // Normal mode: use regular PaddlePaddle path
        env.PYTHONPATH = paddleModelsPath;
        if (process.env.PYTHONPATH) {
          env.PYTHONPATH += path.delimiter + process.env.PYTHONPATH;
        }
        console.log(`💻 Using CPU PaddlePaddle path: ${paddleModelsPath}`);
      }

      // Ensure Python can find its bundled modules
      env.PYTHONHOME = pythonDir;

      console.log(`🐍 About to spawn Python process with args: [${ocrScriptPath}, ${data.imagePath}, ${data.language}, ${useGpu}]`);

      return new Promise((resolve) => {
        const pythonProcess = spawn(pythonPath, [ocrScriptPath, data.imagePath, data.language, useGpu], {
          stdio: ['pipe', 'pipe', 'pipe'],
          env: env
        });

        let stdout = '';
        let stderr = '';

        pythonProcess.stdout.on('data', (data: Buffer) => {
          stdout += data.toString();
        });

        pythonProcess.stderr.on('data', (data: Buffer) => {
          stderr += data.toString();
        });

        pythonProcess.on('close', (code: number) => {
          if (stderr) {
            console.log('🔍 OCR stderr:', stderr);
          }

          if (code === 0 && stdout) {
            try {
              const result = JSON.parse(stdout);
              console.log(`✅ OCR completed: ${result.total_boxes || 0} text boxes found`);
              resolve(result);
            } catch (parseError) {
              console.error('❌ Failed to parse OCR output:', parseError);
              resolve({
                success: false,
                error: 'Failed to parse OCR output',
                text_boxes: []
              });
            }
          } else {
            console.error(`❌ OCR process failed with code ${code}`);
            resolve({
              success: false,
              error: `OCR process failed with code ${code}. Error: ${stderr}`,
              text_boxes: []
            });
          }
        });

        pythonProcess.on('error', (error: Error) => {
          console.error('❌ Failed to start OCR process:', error);
          resolve({
            success: false,
            error: `Failed to start OCR process: ${error.message}`,
            text_boxes: []
          });
        });

        // Timeout after 30 seconds
        setTimeout(() => {
          pythonProcess.kill();
          resolve({
            success: false,
            error: 'OCR process timed out after 30 seconds',
            text_boxes: []
          });
        }, 30000);
      });

    } catch (error) {
      console.error('❌ Error in OCR handler:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        text_boxes: []
      };
    }
  });


  // Test PaddleOCR import handler
  try {
    ipcMain.removeHandler('paddle:test-import');
  } catch {}

  ipcMain.handle('paddle:test-import', async () => {
    try {
      console.log('🧪 Testing PaddleOCR import...');

      const { spawn } = require('child_process');
      const path = require('path');

      // Find Python executable (bundled with project)
      const fs = require('fs');
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

      // Test script path
      const possibleTestPaths = [
        path.join(__dirname, '../paddle/test_paddle.py'),
        path.join(__dirname, 'test_paddle.py'),
        path.join(process.cwd(), 'dist', 'paddle', 'test_paddle.py'),
        path.join(process.cwd(), 'src', 'paddle', 'test_paddle.py')
      ];

      let testScriptPath = '';
      for (const p of possibleTestPaths) {
        if (fs.existsSync(p)) {
          testScriptPath = p;
          break;
        }
      }

      if (!testScriptPath) {
        return {
          success: false,
          error: 'Test script not found',
          paths_checked: possibleTestPaths
        };
      }

      // Setup environment for bundled Python
      const env = { ...process.env };
      const { app } = require('electron');
      const pythonDir = path.dirname(pythonPath);

      // PaddleOCR is installed in AppData/Local/whispra/models/paddle
      const appDataPath = app.getPath('appData');
      const paddleModelsPath = path.join(appDataPath, 'whispra', 'models', 'Paddle');

      env.PYTHONPATH = paddleModelsPath;
      if (process.env.PYTHONPATH) {
        env.PYTHONPATH += path.delimiter + process.env.PYTHONPATH;
      }
      env.PYTHONHOME = pythonDir;

      console.log(`🧪 Testing with Python: ${pythonPath}`);
      console.log(`🧪 Test script: ${testScriptPath}`);

      return new Promise((resolve) => {
        const pythonProcess = spawn(pythonPath, [testScriptPath], {
          stdio: ['pipe', 'pipe', 'pipe'],
          env: env
        });

        let stdout = '';
        let stderr = '';

        pythonProcess.stdout.on('data', (data: Buffer) => {
          stdout += data.toString();
        });

        pythonProcess.stderr.on('data', (data: Buffer) => {
          stderr += data.toString();
        });

        pythonProcess.on('close', (code: number) => {
          console.log('🧪 Test stderr:', stderr);

          if (code === 0 && stdout) {
            try {
              const result = JSON.parse(stdout);
              console.log(`🧪 Test completed: ${result.success ? 'success' : 'failed'}`);
              resolve(result);
            } catch (parseError) {
              resolve({
                success: false,
                error: 'Failed to parse test output',
                stdout,
                stderr
              });
            }
          } else {
            resolve({
              success: false,
              error: `Test process failed with code ${code}`,
              stdout,
              stderr
            });
          }
        });

        pythonProcess.on('error', (error: Error) => {
          resolve({
            success: false,
            error: `Failed to start test process: ${error.message}`
          });
        });

        // Timeout after 30 seconds
        setTimeout(() => {
          pythonProcess.kill();
          resolve({
            success: false,
            error: 'Test process timed out'
          });
        }, 30000);
      });

    } catch (error) {
      console.error('❌ Error in test import handler:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  // Paddle warmup trigger handler
  try {
    ipcMain.removeHandler('paddle:trigger-warmup');
  } catch {}

  ipcMain.handle('paddle:trigger-warmup', async (event: IpcMainInvokeEvent, data: { language: string }) => {
    try {
      console.log(`🏓 Triggering Paddle warmup for language: ${data.language}`);

      const { PaddleOCRService } = await import('../services/PaddleOCRService');
      const paddleService = PaddleOCRService.getInstance();

      // Trigger warmup in background - don't await to avoid blocking
      paddleService.warmupService(data.language).then(() => {
        console.log(`🏓 Paddle warmup completed for language: ${data.language}`);
      }).catch((error) => {
        console.log(`⚠️ Paddle warmup failed for language ${data.language}:`, error.message);
      });

      return { success: true, language: data.language };
    } catch (error) {
      console.error('❌ Error in paddle:trigger-warmup handler:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  console.log('🏓 PaddlePaddle IPC handlers initialized successfully');
}

/**
 * Cleanup PaddlePaddle IPC handlers
 */
export function cleanupPaddleIPC(): void {
  try {
    console.log('🏓 Cleaning up PaddlePaddle IPC handlers...');

    ipcMain.removeHandler('paddlepaddle-check:check-installation');
    ipcMain.removeHandler('paddlepaddle-check:install');
    ipcMain.removeHandler('paddlepaddle-check:complete');
    ipcMain.removeAllListeners('paddlepaddle-check:show-overlay');

    console.log('🏓 PaddlePaddle IPC handlers cleaned up successfully');
  } catch (error) {
    console.error('❌ Error cleaning up PaddlePaddle IPC handlers:', error);
  }
}

/**
 * Get PaddlePaddle overlay manager instance
 */
export function getPaddleOverlayManager(): PaddlePaddleOverlayManager {
  return PaddlePaddleOverlayManager.getInstance();
}