/**
 * Local Model IPC Handlers
 *
 * Handles all local model functionality including:
 * - Local model download and installation
 * - Model availability checks
 * - Local processing configuration
 * - Argos translation service management
 */

import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { IPCRequest, IPCResponse } from '../messages';
// Don't import platformUtils at top level - import it lazily inside functions that need it
// import { getEmbeddedPythonPath } from '../../utils/platformUtils';
import { resolveEmbeddedPythonExecutable } from '../../utils/pythonPath';

type ArgosInstallCallbacks = {
  onProgress?: (currentIndex: number, total: number, message: string) => void;
  onOutput?: (message: string) => void;
};

/**
 * Install Argos language models from .argosmodel files
 */
async function installArgosLanguageModels(
  modelDir: string,
  event: any,
  modelKey: string,
  callbacks?: ArgosInstallCallbacks
): Promise<void> {
  const path = require('path');
  const fs = require('fs').promises;
  const { spawn } = require('child_process');

  // Get paths
  // For argos-extra, modelDir is argos/extrapack, but we need base argos for Python path
  const argosBasePath = modelKey === 'argos-extra' 
    ? path.dirname(modelDir) // Go up from argos/extrapack to argos
    : modelDir;
  
  // For argos-extra, check both extrapack/extrapack and extrapack/packages
  let packagesPath: string;
  if (modelKey === 'argos-extra') {
    const extrapackPath1 = path.join(modelDir, 'extrapack');
    const extrapackPath2 = path.join(modelDir, 'packages');
    // Check which one exists
    const path1Exists = await fs.access(extrapackPath1).then(() => true).catch(() => false);
    const path2Exists = await fs.access(extrapackPath2).then(() => true).catch(() => false);
    
    if (path1Exists) {
      packagesPath = extrapackPath1;
    } else if (path2Exists) {
      packagesPath = extrapackPath2;
    } else {
      packagesPath = extrapackPath1; // Default to extrapack/extrapack
    }
  } else {
    packagesPath = path.join(modelDir, 'packages');
  }
   
  // Get platform-specific Python executable (lazy import to avoid module loading issues)
  const { getEmbeddedPythonPath } = await import('../../utils/platformUtils');
  const embeddedPythonExe = getEmbeddedPythonPath();
  if (!embeddedPythonExe) {
    throw new Error('Embedded Python runtime not found');
  }

  // Check if packages directory exists
  if (!(await fs.access(packagesPath).then(() => true).catch(() => false))) {
    console.log(`No packages directory found at ${packagesPath}, skipping model installation`);
    return;
  }

  // Get all .argosmodel files
  const files = await fs.readdir(packagesPath);
  const modelFiles = files.filter((file: string) => file.endsWith('.argosmodel'));

  if (modelFiles.length === 0) {
    console.log('No .argosmodel files found, skipping model installation');
    return;
  }

  console.log(`Found ${modelFiles.length} .argosmodel files to install`);
  console.log(`Using Python executable: ${embeddedPythonExe}`);

  // First, check what's already installed
  const checkInstalledScript = `
import sys
import os

# Add Argos packages to Python path
argos_path = r"${argosBasePath.replace(/\\/g, '\\\\')}"
if argos_path not in sys.path:
    sys.path.insert(0, argos_path)

try:
    import argostranslate.package as package
    package.update_package_index()
    installed_packages = package.get_installed_packages()
    installed_pairs = [(p.from_code, p.to_code) for p in installed_packages]
    print("INSTALLED_PAIRS:" + ",".join([f"{f}-{t}" for f, t in installed_pairs]))
except Exception as e:
    print("INSTALLED_PAIRS:")
    print(f"Error checking installed packages: {e}", file=sys.stderr)
`;

  let installedPairs = new Set<string>();
  try {
    const checkResult = await new Promise<string>((resolve, reject) => {
      const tempCheckPath = path.join(process.cwd(), `temp_check_installed_${Date.now()}.py`);
      require('fs').writeFileSync(tempCheckPath, checkInstalledScript);
      
      const checkProcess = spawn(embeddedPythonExe, [tempCheckPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: false,
        env: {
          ...process.env,
          PYTHONPATH: argosBasePath,
          ...(process.platform === 'darwin' && embeddedPythonExe.includes('macpython') ? {
            PYTHONHOME: path.join(process.cwd(), 'macpython')
          } : {})
        }
      });

      let checkOutput = '';
      checkProcess.stdout.on('data', (data: any) => {
        checkOutput += data.toString();
      });
      
      checkProcess.on('close', (code: number) => {
        try {
          require('fs').unlinkSync(tempCheckPath);
        } catch (e) {}
        
        if (code === 0) {
          const pairsLine = checkOutput.split('\n').find((line: string) => line.startsWith('INSTALLED_PAIRS:'));
          if (pairsLine) {
            const pairsStr = pairsLine.replace('INSTALLED_PAIRS:', '').trim();
            if (pairsStr) {
              pairsStr.split(',').forEach((pair: string) => {
                if (pair) installedPairs.add(pair);
              });
            }
          }
          resolve(checkOutput);
        } else {
          resolve(''); // If check fails, just proceed with installation
        }
      });
      
      checkProcess.on('error', () => {
        try {
          require('fs').unlinkSync(tempCheckPath);
        } catch (e) {}
        resolve(''); // If check fails, just proceed with installation
      });
    });
    
    if (installedPairs.size > 0) {
      console.log(`Found ${installedPairs.size} already installed language pairs`);
    }
  } catch (error) {
    console.log('Could not check installed packages, proceeding with installation:', error);
  }

  // Install each model file
  const totalModels = modelFiles.length;
  let installedCount = 0;
  let skippedCount = 0;

  for (let i = 0; i < totalModels; i++) {
    const modelFile = modelFiles[i];
    const modelPath = path.join(packagesPath, modelFile);
    
    // Extract language pair from filename (e.g., "translate-en_de-1_9.argosmodel" -> "en-de")
    const match = modelFile.match(/translate-([a-z]+)_([a-z]+)-/);
    if (match) {
      const [, fromCode, toCode] = match;
      const pairKey = `${fromCode}-${toCode}`;
      
      if (installedPairs.has(pairKey)) {
        console.log(`Model ${modelFile} (${fromCode}->${toCode}) is already installed, skipping`);
        skippedCount++;
        if (callbacks?.onProgress) {
          callbacks.onProgress(i + 1, totalModels, `Skipped ${modelFile} (already installed)`);
        }
        continue;
      }
    }
    
    console.log(`Installing ${modelFile} (${i + 1}/${modelFiles.length})...`);
    
    // Send progress update
    const progressMessage = `Installing language models... (${i + 1}/${modelFiles.length})`;
    if (callbacks?.onProgress) {
      callbacks.onProgress(i, totalModels, progressMessage);
    } else {
      event.sender.send('local-models:download-progress', {
        modelKey,
        progress: 100,
        downloaded: 0,
        total: 0,
        status: progressMessage
      });
    }

    const script = `
import sys
import os

# Add Argos packages to Python path (use base argos directory, not extrapack)
argos_path = r"${argosBasePath.replace(/\\/g, '\\\\')}"
if argos_path not in sys.path:
    sys.path.insert(0, argos_path)

try:
    import argostranslate.package as package
    
    # Install the model
    model_path = r"${modelPath.replace(/\\/g, '\\\\')}"
    print(f"Installing model from: {model_path}")
    
    try:
        package.install_from_path(model_path)
        print(f"Successfully installed {model_path}")
    except Exception as install_error:
        # Check if error is "File exists" - that means it's already installed, which is fine
        error_str = str(install_error)
        if "File exists" in error_str or "Errno 17" in error_str:
            print(f"Model already installed (File exists): {model_path}")
        else:
            raise install_error
    
except Exception as e:
    print(f"Failed to install model: {e}", file=sys.stderr)
    import traceback
    traceback.print_exc(file=sys.stderr)
    sys.exit(1)
`;

    await new Promise<void>((resolve, reject) => {
      const tempScriptPath = path.join(process.cwd(), `temp_install_${Date.now()}.py`);
      
      // Write script to temporary file
      require('fs').writeFileSync(tempScriptPath, script);
      
      const childProcess = spawn(embeddedPythonExe, [tempScriptPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: false,
        env: {
          ...process.env,
          PYTHONPATH: argosBasePath,
          ARGOS_TRANSLATE_PACKAGE_DIR: packagesPath,
          // Set PYTHONHOME for macOS Python if using macpython
          ...(process.platform === 'darwin' && embeddedPythonExe.includes('macpython') ? {
            PYTHONHOME: path.join(process.cwd(), 'macpython')
          } : {})
          }
      });

      let output = '';
      let errorOutput = '';

      childProcess.stdout.on('data', (data: any) => {
        output += data.toString();
        const message = data.toString().trim();
        if (message) {
          callbacks?.onOutput?.(message);
        }
      });

      childProcess.stderr.on('data', (data: any) => {
        errorOutput += data.toString();
        const message = data.toString().trim();
        if (message) {
          callbacks?.onOutput?.(message);
        }
      });

      childProcess.on('close', (code: number) => {
        // Clean up temp file
        try {
          require('fs').unlinkSync(tempScriptPath);
        } catch (e) {
          // Ignore cleanup errors
        }
        
        if (code === 0) {
          console.log(`Successfully installed ${modelFile}`);
          installedCount++;
          if (callbacks?.onProgress) {
            callbacks.onProgress(i + 1, totalModels, `Installed ${modelFile}`);
          }
          resolve();
        } else {
          // Check if the error is "File exists" - that means it's already installed
          const errorMsg = errorOutput.trim() || output.trim() || `Process exited with code ${code}`;
          if (errorMsg.includes('File exists') || errorMsg.includes('Errno 17')) {
            console.log(`Model ${modelFile} is already installed (File exists), skipping`);
            skippedCount++;
            if (callbacks?.onProgress) {
              callbacks.onProgress(i + 1, totalModels, `Skipped ${modelFile} (already installed)`);
            }
            resolve(); // Treat as success
          } else {
            console.error(`Failed to install ${modelFile}:`, errorMsg);
            console.error(`Python executable used: ${embeddedPythonExe}`);
            console.error(`Script path: ${tempScriptPath}`);
            reject(new Error(`Model installation failed: ${errorMsg}`));
          }
        }
      });

      childProcess.on('error', (error: Error) => {
        // Clean up temp file
        try {
          require('fs').unlinkSync(tempScriptPath);
        } catch (e) {
          // Ignore cleanup errors
        }
        console.error(`Process error installing ${modelFile}:`, error);
        console.error(`Python executable used: ${embeddedPythonExe}`);
        console.error(`Script path: ${tempScriptPath}`);
        reject(error);
      });
    });
  }

  console.log(`Installation complete: ${installedCount} installed, ${skippedCount} skipped (already installed), ${totalModels} total`);
}

/**
 * Local models download handler function
 */
export async function handleDownloadLocalModel(
  event: IpcMainInvokeEvent,
  request: IPCRequest<{ modelKey: string, config: any }>
): Promise<IPCResponse<{ modelKey: string; installPath: string }>> {
  try {
    const { modelKey, config } = request.payload;
    console.log('Downloading local model:', modelKey, config);

    const path = require('path');
    const fs = require('fs').promises;
    const { createWriteStream } = require('fs');
    const { Transform } = require('stream');
    const os = require('os');
    const https = require('https');
    const http = require('http');
    const extractZip = require('extract-zip');

    type DownloadStage = 'downloading' | 'extracting' | 'installing' | 'finalizing';

    const isArgosModel = modelKey === 'argos' || modelKey === 'argos-extra';
    const stageWeights = {
      downloading: 0.7,
      extracting: isArgosModel ? 0.2 : 0.3,
      installing: isArgosModel ? 0.1 : 0
    } as const;

    const clamp = (value: number): number => {
      if (Number.isNaN(value)) return 0;
      return Math.min(1, Math.max(0, value));
    };

    const computeOverallProgress = (stage: DownloadStage, stageProgress = 0): number => {
      const clampedProgress = clamp(stageProgress);

      switch (stage) {
        case 'downloading':
          return Math.round(stageWeights.downloading * clampedProgress * 100);
        case 'extracting':
          return Math.round((stageWeights.downloading + stageWeights.extracting * clampedProgress) * 100);
        case 'installing':
          return Math.round((stageWeights.downloading + stageWeights.extracting + stageWeights.installing * clampedProgress) * 100);
        case 'finalizing':
        default:
          return 100;
      }
    };

    const sendProgressUpdate = (
      stage: DownloadStage,
      stageProgress: number,
      payload: Partial<{ status: string; downloaded: number; total: number }> = {}
    ): void => {
      const overallProgress = computeOverallProgress(stage, stageProgress);
      event.sender.send('local-models:download-progress', {
        modelKey,
        progress: overallProgress,
        overallProgress,
        phase: stage,
        phaseProgress: clamp(stageProgress),
        downloaded: payload.downloaded ?? 0,
        total: payload.total ?? 0,
        status: payload.status
      });
    };

    // Create the models directory structure (platform-specific)
    // On Mac, use Windows-style path since that's where models are stored
    let modelsDir: string;
    if (process.platform === 'win32') {
      const appDataPath = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
      modelsDir = path.join(appDataPath, 'whispra', 'models');
    } else if (process.platform === 'darwin') {
      // On Mac, use Windows-style path: ~/AppData/Roaming/whispra/models
      modelsDir = path.join(os.homedir(), 'AppData', 'Roaming', 'whispra', 'models');
    } else {
      const appDataPath = process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share');
      modelsDir = path.join(appDataPath, 'whispra', 'models');
    }

    // Ensure models directory exists
    await fs.mkdir(modelsDir, { recursive: true });

    // Download the zip file with retry logic
    const zipFilePath = path.join(modelsDir, `${modelKey}.zip`);
    let totalSize = 0;
    const maxRetries = 3;
    let retryCount = 0;

    const downloadWithRetry = async (): Promise<void> => {
      while (retryCount < maxRetries) {
        try {
          await downloadFile();
          return; // Success
        } catch (error) {
          retryCount++;
          console.error(`Download attempt ${retryCount} failed:`, error);

          if (retryCount < maxRetries) {
            console.log(`Retrying in ${retryCount * 2} seconds...`);
            sendProgressUpdate('downloading', 0, {
              status: `Retrying download (attempt ${retryCount + 1}/${maxRetries})...`,
              downloaded: 0,
              total: 0
            });
            await new Promise(resolve => setTimeout(resolve, retryCount * 2000));
          } else {
            throw error; // Max retries reached
          }
        }
      }
    };

    const downloadFile = async (): Promise<void> => {
      const downloadFromUrl = async (url: string, redirectCount = 0): Promise<void> => {
        if (redirectCount > 5) {
          throw new Error('Too many redirects');
        }

        // Choose http or https based on URL
        const protocol = url.startsWith('https') ? https : http;

        // Parse URL to extract hostname and path
        const urlObj = new URL(url);
        
        const requestOptions = {
          hostname: urlObj.hostname,
          port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
          path: urlObj.pathname + urlObj.search,
          method: 'GET',
          headers: {
            'User-Agent': 'Whispra-Model-Downloader/1.0',
            'Connection': 'keep-alive',
            'Accept': '*/*',
            'Accept-Encoding': 'gzip, deflate, br'
          },
          timeout: 300000, // 5 minutes timeout for initial connection
          agent: false // Disable agent pooling
        };

        return new Promise<void>((resolve, reject) => {
          const req = protocol.request(requestOptions, async (response: any) => {
            // Handle redirects
            if (response.statusCode === 301 || response.statusCode === 302 || response.statusCode === 307 || response.statusCode === 308) {
              const redirectUrl = response.headers.location;
              if (redirectUrl) {
                // Handle relative redirects
                const fullRedirectUrl = redirectUrl.startsWith('http') 
                  ? redirectUrl 
                  : `${urlObj.protocol}//${urlObj.hostname}${redirectUrl}`;
                console.log(`Redirecting to: ${fullRedirectUrl}`);
                response.destroy();
                try {
                  await downloadFromUrl(fullRedirectUrl, redirectCount + 1);
                  resolve();
                } catch (err) {
                  reject(err);
                }
                return;
              }
            }

            if (response.statusCode !== 200) {
              reject(new Error(`Failed to download: ${response.statusCode} ${response.statusMessage}`));
              return;
            }

            totalSize = parseInt(response.headers['content-length'] || '0', 10);

            // Send initial progress update
            sendProgressUpdate('downloading', 0, {
              status: 'Starting download...',
              downloaded: 0,
              total: totalSize
            });

            // Set socket timeout for the entire download (30 minutes max)
            if (response.socket) {
              response.socket.setTimeout(30 * 60 * 1000);
            }

            // Create a Transform stream to track progress while piping
            // This allows us to track progress AND pipe data efficiently
            let downloadedSize = 0;
            let lastProgressUpdate = Date.now();
            let lastProgressPercentage = -1;

            const progressTracker = new Transform({
              transform(chunk: Buffer, encoding: any, callback: any) {
                downloadedSize += chunk.length;
                
                const now = Date.now();
                const progress = totalSize > 0 ? Math.round((downloadedSize / totalSize) * 100) : 0;

                // Update progress: every 0.5% change OR every 200ms (more frequent updates)
                if (totalSize > 0 && (Math.abs(progress - lastProgressPercentage) >= 0.5 || now - lastProgressUpdate > 200)) {
                  const progressRatio = downloadedSize / totalSize;
                  console.log(`[Download Progress] ${modelKey}: ${progress}% (${Math.round(downloadedSize / 1024 / 1024)}MB / ${Math.round(totalSize / 1024 / 1024)}MB)`);
                  sendProgressUpdate('downloading', progressRatio, {
                    status: `Downloading... ${Math.round(downloadedSize / 1024 / 1024)}MB / ${Math.round(totalSize / 1024 / 1024)}MB`,
                    downloaded: downloadedSize,
                    total: totalSize
                  });
                  lastProgressUpdate = now;
                  lastProgressPercentage = progress;
                }

                // Pass chunk through immediately
                callback(null, chunk);
              }
            });

            // Create file stream with large buffer for better performance
            const file = createWriteStream(zipFilePath, { 
              highWaterMark: 16 * 1024 * 1024 // 16MB buffer
            });

            // Pipe: response -> progressTracker -> file
            // Progress is tracked in the Transform stream above
            response.pipe(progressTracker).pipe(file);

            file.on('finish', () => {
              // Send final 100% update
              sendProgressUpdate('downloading', 1, {
                status: 'Download complete',
                downloaded: totalSize || downloadedSize,
                total: totalSize || downloadedSize
              });
              console.log(`Download completed: ${downloadedSize} bytes`);
              resolve();
            });

            file.on('error', (err: Error) => {
              response.destroy();
              fs.unlink(zipFilePath).catch(() => {});
              reject(err);
            });

            response.on('error', (err: Error) => {
              file.destroy();
              fs.unlink(zipFilePath).catch(() => {});
              reject(err);
            });
          });

          req.on('error', (err: Error) => {
            fs.unlink(zipFilePath).catch(() => {});
            reject(err);
          });

          req.on('timeout', () => {
            req.destroy();
            fs.unlink(zipFilePath).catch(() => {});
            reject(new Error('Download timeout'));
          });

          // Start the request
          req.end();
        });
      };

      await downloadFromUrl(config.url);
    };

    // Start download with retry logic
    await downloadWithRetry();

    // Send extraction start notification
    let extractionProgress = 0;
    const extractionStatus = 'Extracting archive... this may take a few minutes for large models';
    sendProgressUpdate('extracting', extractionProgress, {
      status: extractionStatus,
      downloaded: totalSize,
      total: totalSize
    });

    // Determine extraction directory - argos-extra goes to argos/extrapack subdirectory
    const extractionDir = modelKey === 'argos-extra' 
      ? path.join(modelsDir, 'argos', 'extrapack')
      : modelsDir;
    
    // Ensure extraction directory exists
    await fs.mkdir(extractionDir, { recursive: true });
    
    // Extract the zip file directly to extraction directory
    console.log(`Extracting ${zipFilePath} to ${extractionDir}`);
    try {
      // Add timeout for extraction (10 minutes for large files)
      const extractionPromise = extractZip(zipFilePath, { dir: extractionDir });
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Extraction timeout after 10 minutes')), 10 * 60 * 1000);
      });

      // Send periodic extraction progress updates
      const progressInterval = setInterval(() => {
        extractionProgress = Math.min(0.95, extractionProgress + 0.05);
        sendProgressUpdate('extracting', extractionProgress, {
          status: extractionStatus,
          downloaded: totalSize,
          total: totalSize
        });
      }, 2500);

      await Promise.race([extractionPromise, timeoutPromise]);
      clearInterval(progressInterval);

      sendProgressUpdate('extracting', 1, {
        status: 'Extraction complete',
        downloaded: totalSize,
        total: totalSize
      });

      console.log(`Successfully extracted ${modelKey} to ${extractionDir}`);
    } catch (extractError) {
      console.error(`Error extracting ${modelKey}:`, extractError);
      // Clean up zip file on extraction failure
      await fs.unlink(zipFilePath).catch(() => {});
      throw new Error(`Failed to extract ${modelKey}: ${extractError instanceof Error ? extractError.message : 'Unknown error'}`);
    }

    // Clean up the zip file
    await fs.unlink(zipFilePath);

    // Determine model directory & ensure it exists prior to marker creation
    // For argos-extra, use the extraction directory (argos/extrapack), otherwise use modelKey subdirectory
    const targetModelDir = modelKey === 'argos-extra' 
      ? path.join(modelsDir, 'argos', 'extrapack')
      : path.join(modelsDir, modelKey);
    await fs.mkdir(targetModelDir, { recursive: true });

    // On Mac, remove broken Windows-specific modules from whisper folder
    // The ZIP contains Windows-specific modules (av, numpy, tokenizers) that don't work on Mac
    // Users should install these via: npm run install:pyav-mac
    if (modelKey === 'whisper' && process.platform === 'darwin') {
      const modulesToRemove = ['av', 'numpy', 'tokenizers', 'ctranslate2'];
      for (const moduleName of modulesToRemove) {
        const modulePath = path.join(targetModelDir, moduleName);
        try {
          const moduleStats = await fs.stat(modulePath).catch(() => null);
          if (moduleStats && moduleStats.isDirectory()) {
            console.log(`🗑️  Removing broken Windows-specific ${moduleName} module from whisper folder on Mac...`);
            await fs.rm(modulePath, { recursive: true, force: true });
            console.log(`✅ Removed broken ${moduleName} module. Use npm run install:pyav-mac to install from site-packages.`);
          }
        } catch (error) {
          console.warn(`⚠️  Could not remove broken ${moduleName} module: ${error instanceof Error ? error.message : 'Unknown error'}`);
          // Don't fail the installation if we can't remove modules
        }
      }
    }


    const markerFileName = modelKey === 'argos-extra' ? 'argos-extra_installed.txt' : `${modelKey}_installed.txt`;
    const markerFile = path.join(targetModelDir, markerFileName);
    await fs.writeFile(
      markerFile,
      `Model ${modelKey} installed at ${new Date().toISOString()}\nSource: ${config.url}\nExtracted to: ${targetModelDir}`
    );

    // Special handling for Argos models - install .argosmodel files
    if (modelKey === 'argos' || modelKey === 'argos-extra') {
      try {
        console.log(`Installing Argos language models for ${modelKey}...`);
        
        // Send progress update for model installation
        sendProgressUpdate('installing', 0, {
          status: 'Installing language models... preparing packages',
          downloaded: totalSize,
          total: totalSize
        });

        let lastInstallStageProgress = 0;

        await installArgosLanguageModels(targetModelDir, event, modelKey, {
          onProgress: (current, total, message) => {
            const normalizedTotal = total > 0 ? total : 1;
            const isCompletionMessage = message.toLowerCase().startsWith('installed ');
            const stageProgressRaw = isCompletionMessage
              ? (current + 1) / normalizedTotal
              : current / normalizedTotal;
            const stageProgress = Math.max(0, Math.min(1, stageProgressRaw));
            lastInstallStageProgress = stageProgress;
            sendProgressUpdate('installing', stageProgress, {
              status: message,
              downloaded: totalSize,
              total: totalSize
            });
          },
          onOutput: (message) => {
            if (message) {
              sendProgressUpdate('installing', lastInstallStageProgress || 0.05, {
                status: message,
                downloaded: totalSize,
                total: totalSize
              });
            }
          }
        });
        
        console.log(`Argos language models installed successfully for ${modelKey}`);
      } catch (error) {
        console.error(`Failed to install Argos language models for ${modelKey}:`, error);
        // Don't fail the entire download, just log the error
        // The base Argos packages are still installed
      }
    }

    // Send completion notification
    sendProgressUpdate('finalizing', 1, {
      status: 'Installation complete!',
      downloaded: totalSize,
      total: totalSize
    });

    return {
      id: request.id,
      timestamp: Date.now(),
      success: true,
      payload: { modelKey, installPath: targetModelDir }
    };
  } catch (error) {
    console.error('Error downloading local model:', error);

    // Send error notification to UI
    event.sender.send('local-models:download-error', {
      modelKey: request.payload.modelKey,
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    return {
      id: request.id,
      timestamp: Date.now(),
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Register local-models:download handler at module level (for Mac compatibility)
 * Only register if ipcMain is available (it might not be when module first loads)
 */
try {
  if (typeof ipcMain !== 'undefined' && typeof ipcMain.handle === 'function') {
    console.log('🔧 Registering local-models:download handler at module level...');
    ipcMain.handle('local-models:download', handleDownloadLocalModel);
    console.log('✅ Successfully registered local-models:download at module level');
  } else {
    console.warn('⚠️ ipcMain not available at module load time, handler will be registered later');
  }
} catch (regError) {
  console.error('❌ Failed to register local-models:download at module level:', regError);
}



/**
 * Check which local Whisper models are actually available
 */
try {
  console.log('🔧 Registering whisper:get-available-models handler at module level...');
  ipcMain.handle('whisper:get-available-models', async (event, request: IPCRequest<void>) => {
    console.log('🔍 whisper:get-available-models handler called');
  try {
    const path = require('path');
    const fs = require('fs');
    const os = require('os');
    const { spawn } = require('child_process');

    // Get the whisper installation path (platform-specific)
    // On Mac, also check Windows-style path for compatibility
    let whisperPath: string;
    if (process.platform === 'win32') {
      const appDataPath = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
      whisperPath = path.join(appDataPath, 'whispra', 'models', 'whisper');
    } else if (process.platform === 'darwin') {
      // On Mac, use Windows-style path: ~/AppData/Roaming/whispra/models/whisper
      whisperPath = path.join(os.homedir(), 'AppData', 'Roaming', 'whispra', 'models', 'whisper');
    } else {
      const appDataPath = process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share');
      whisperPath = path.join(appDataPath, 'whispra', 'models', 'whisper');
    }

    console.log('🔍 whisper:get-available-models handler - whisperPath:', whisperPath);
    console.log('🔍 whisper:get-available-models handler - whisperPath exists:', fs.existsSync(whisperPath));

    // Check if whisper is installed
    const markerFile = path.join(whisperPath, 'whisper_installed.txt');
    console.log('🔍 markerFile:', markerFile);
    console.log('🔍 markerFile exists:', fs.existsSync(markerFile));
    if (!fs.existsSync(markerFile)) {
      return {
        id: request.id,
        timestamp: Date.now(),
        success: true,
        payload: [] // No whisper installed, return empty array
      };
    }
    
    // Get embedded Python path using the robust resolution
    const { getEmbeddedPythonPath } = await import('../../utils/platformUtils');
    const embeddedPythonExe = getEmbeddedPythonPath();
    console.log('🔍 embeddedPythonExe:', embeddedPythonExe);
    console.log('🔍 embeddedPythonExe exists:', fs.existsSync(embeddedPythonExe));
    if (!fs.existsSync(embeddedPythonExe)) {
      console.log('❌ Python executable not found, returning empty array');
      return {
        id: request.id,
        timestamp: Date.now(),
        success: true,
        payload: [] // Python not found, return empty array
      };
    }
    
    // Possible whisper model names
    const possibleModels = ['tiny', 'base', 'small', 'medium', 'large', 'large-v2', 'large-v3'];
    const availableModels: string[] = [];
    
    // Only check the Whispra models directory where we set download_root
    // Do not check HuggingFace cache directories - models must be installed in whispra directory
    if (fs.existsSync(whisperPath)) {
      try {
        const cacheDirs = fs.readdirSync(whisperPath);
        console.log(`🔍 Checking for models in: ${whisperPath}`);
        console.log(`🔍 Found ${cacheDirs.length} items in directory`);
        
        for (const model of possibleModels) {
          // Faster-whisper stores models with different repository names
          // Check both guillaumekln (old) and Systran (new) repositories
          const modelDirPatterns = [
            `models--guillaumekln--faster-whisper-${model}`,
            `models--Systran--faster-whisper-${model}`
          ];
          
          const found = modelDirPatterns.some(pattern => {
            const match = cacheDirs.some((dir: string) => {
              const isDir = fs.statSync(path.join(whisperPath, dir)).isDirectory();
              const matches = dir.startsWith(pattern);
              if (matches) {
                console.log(`✅ Found matching directory: ${dir} (isDirectory: ${isDir})`);
              }
              return matches && isDir;
            });
            return match;
          });
          
          if (found && !availableModels.includes(model)) {
            availableModels.push(model);
            console.log(`✅ Found Whisper model '${model}' in ${whisperPath}`);
          }
        }
      } catch (error) {
        console.warn('Error reading Whispra models directory:', whisperPath, error);
      }
    } else {
      console.log(`⚠️  Whispra models path does not exist: ${whisperPath}`);
    }
    
    console.log(`📋 Total available models found: ${availableModels.length} - ${availableModels.join(', ')}`);
    
    // Return found models immediately if any were found
    if (availableModels.length > 0) {
      return {
        id: request.id,
        timestamp: Date.now(),
        success: true,
        payload: availableModels
      };
    }
    
    // If no models found in cache, try to check using Python directly
    if (availableModels.length === 0) {
      return new Promise((resolve) => {
        const script = `import sys
import os
import platform

# On Mac/Linux, ensure we don't try to use Windows-specific functions
# This must be done BEFORE importing faster_whisper or its dependencies
if platform.system() != 'Windows':
    # Monkey-patch os.add_dll_directory if it doesn't exist (for compatibility)
    if not hasattr(os, 'add_dll_directory'):
        def add_dll_directory(path):
            pass
        os.add_dll_directory = add_dll_directory

# Add Whisper packages to Python path
whisper_path = r"${whisperPath.replace(/\\/g, '\\\\')}"
if whisper_path not in sys.path:
    sys.path.insert(0, whisper_path)

try:
    import faster_whisper
    import json
    
    # Try to get available models by checking cache
    # Faster-whisper uses HuggingFace cache - check multiple locations
    from pathlib import Path
    import os
    
    available = []
    cache_paths = [
        Path.home() / '.cache' / 'huggingface' / 'hub',
        Path(os.getenv('LOCALAPPDATA', Path.home() / 'AppData' / 'Local')) / 'huggingface' / 'hub',
        Path(whisper_path)  # Also check the Whispra models directory
    ]
    
    for cache_dir in cache_paths:
        if cache_dir.exists():
            for model_name in ['tiny', 'base', 'small', 'medium', 'large', 'large-v2', 'large-v3']:
                # Check both old (guillaumekln) and new (Systran) repository names
                model_dir_patterns = [
                    f'models--guillaumekln--faster-whisper-{model_name}',
                    f'models--Systran--faster-whisper-{model_name}'
                ]
                found = any(
                    any(d.name.startswith(pattern) for d in cache_dir.iterdir())
                    for pattern in model_dir_patterns
                )
                if found and model_name not in available:
                    available.append(model_name)
    
    print(json.dumps(available))
except Exception as e:
    print(json.dumps([]))`;
        
        const tempScriptPath = path.join(process.cwd(), `temp_check_models_${Date.now()}.py`);
        fs.writeFileSync(tempScriptPath, script);
        
        const childProcess = spawn(embeddedPythonExe, [tempScriptPath], {
          stdio: ['pipe', 'pipe', 'pipe'],
          shell: true,
          env: {
            ...process.env,
            PYTHONPATH: whisperPath
          }
        });
        
        let output = '';
        let errorOutput = '';
        
        childProcess.stdout.on('data', (data: any) => {
          output += data.toString();
        });
        
        childProcess.stderr.on('data', (data: any) => {
          errorOutput += data.toString();
        });
        
        childProcess.on('close', (code: number) => {
          // Clean up temp file
          try {
            fs.unlinkSync(tempScriptPath);
          } catch (e) {
            // Ignore cleanup errors
          }
          
          try {
            const models = JSON.parse(output.trim() || '[]');
            resolve({
              id: request.id,
              timestamp: Date.now(),
              success: true,
              payload: Array.isArray(models) ? models : []
            });
          } catch (parseError) {
            resolve({
              id: request.id,
              timestamp: Date.now(),
              success: true,
              payload: availableModels // Return what we found from file system check
            });
          }
        });
        
        childProcess.on('error', () => {
          try {
            fs.unlinkSync(tempScriptPath);
          } catch (e) {
            // Ignore cleanup errors
          }
          resolve({
            id: request.id,
            timestamp: Date.now(),
            success: true,
            payload: availableModels // Return what we found from file system check
          });
        });
      });
    }
    
    return {
      id: request.id,
      timestamp: Date.now(),
      success: true,
      payload: availableModels
    };
  } catch (error) {
    console.error('Error checking available whisper models:', error);
    return {
      id: request.id,
      timestamp: Date.now(),
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      payload: []
    };
  }
});
} catch (regError) {
  console.error('❌ Failed to register whisper:get-available-models at module level:', regError);
}

/**
 * Download a specific Whisper model function
 */
async function handleDownloadWhisperModel(
  event: IpcMainInvokeEvent,
  request: IPCRequest<{ modelId: string }>
): Promise<IPCResponse<{ modelId: string; message: string }>> {
  console.log('🔍 handleDownloadWhisperModel called with request:', request);
  try {
    const path = require('path');
    const fs = require('fs');
    const os = require('os');
    const { spawn } = require('child_process');
    
    const modelId = request.payload?.modelId;
    if (!modelId) {
      return {
        id: request.id,
        timestamp: Date.now(),
        success: false,
        error: 'Model ID is required'
      };
    }
    
    // Get the whisper installation path (platform-specific)
    // On Mac, also check Windows-style path for compatibility
    let whisperPath: string;
    if (process.platform === 'win32') {
      const appDataPath = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
      whisperPath = path.join(appDataPath, 'whispra', 'models', 'whisper');
    } else if (process.platform === 'darwin') {
      // On Mac, use Windows-style path: ~/AppData/Roaming/whispra/models/whisper
      whisperPath = path.join(os.homedir(), 'AppData', 'Roaming', 'whispra', 'models', 'whisper');
    } else {
      const appDataPath = process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share');
      whisperPath = path.join(appDataPath, 'whispra', 'models', 'whisper');
    }
    
    // Check if whisper is installed
    const markerFile = path.join(whisperPath, 'whisper_installed.txt');
    if (!fs.existsSync(markerFile)) {
      return {
        id: request.id,
        timestamp: Date.now(),
        success: false,
        error: 'Faster Whisper is not installed. Please download it from the Local Models downloader first.'
      };
    }
    
    // Use Python to download the model
    // Lazy import to avoid module loading issues
    const { getEmbeddedPythonPath } = await import('../../utils/platformUtils');
    const embeddedPythonExe = getEmbeddedPythonPath();
    if (!fs.existsSync(embeddedPythonExe)) {
      return {
        id: request.id,
        timestamp: Date.now(),
        success: false,
        error: 'Python executable not found'
      };
    }
    
    return new Promise((resolve) => {
      const script = `import sys
import os
import platform

# Set HuggingFace cache directory to whispra directory BEFORE importing faster_whisper
# This ensures models are downloaded to the correct location
whisper_path = r"${whisperPath.replace(/\\/g, '\\\\')}"
os.environ['HF_HOME'] = whisper_path
os.environ['HF_HUB_CACHE'] = whisper_path
os.environ['HUGGINGFACE_HUB_CACHE'] = whisper_path

# On Mac/Linux, ensure we don't try to use Windows-specific functions
# This must be done BEFORE importing faster_whisper or its dependencies
if platform.system() != 'Windows':
    # Monkey-patch os.add_dll_directory if it doesn't exist (for compatibility)
    if not hasattr(os, 'add_dll_directory'):
        def add_dll_directory(path):
            pass
        os.add_dll_directory = add_dll_directory

# Add Whisper packages to Python path - be very explicit about this
print(f"Original Python path: {sys.path[:3]}...")
print(f"Whisper path: {whisper_path}")

# Clear and rebuild sys.path to prioritize whisper packages
original_path = sys.path.copy()
sys.path.clear()

# Add whisper path first (highest priority)
sys.path.append(whisper_path)

# Add standard library paths back
for path in original_path:
    if path and path not in sys.path:
        # Skip user site-packages to avoid conflicts
        if 'site-packages' not in path or whisper_path in path:
            sys.path.append(path)

print(f"Updated Python path: {sys.path[:5]}...")

# Verify packages can be found
try:
    import huggingface_hub
    print(f"SUCCESS: huggingface_hub found at: {huggingface_hub.__file__}")
    
    # Test the specific utils import that's failing
    from huggingface_hub import utils
    print(f"SUCCESS: huggingface_hub.utils found at: {utils.__file__}")
    
    # Check for httpx dependency and try to work around it
    try:
        import httpx
        print("SUCCESS: httpx found")
    except ImportError:
        print("WARNING: httpx not found, trying to use requests as fallback")
        # Try to monkey-patch httpx with requests for basic functionality
        try:
            import requests
            import sys
            
            # Create a minimal httpx-like interface using requests
            class MockHttpx:
                def __init__(self):
                    pass
                    
                def get(self, *args, **kwargs):
                    return requests.get(*args, **kwargs)
                    
                def post(self, *args, **kwargs):
                    return requests.post(*args, **kwargs)
            
            # Add mock httpx to sys.modules
            sys.modules['httpx'] = MockHttpx()
            print("SUCCESS: Created httpx fallback using requests")
        except Exception as e:
            print(f"ERROR: Could not create httpx fallback: {e}")
            # Continue anyway - maybe huggingface_hub will work without httpx for model downloads
    
except ImportError as e:
    print(f"ERROR: Import error: {e}")
    # List what's actually in the whisper path
    if os.path.exists(whisper_path):
        print(f"Contents of {whisper_path}:")
        for item in sorted(os.listdir(whisper_path))[:10]:  # Show first 10 items
            print(f"  - {item}")
    sys.exit(1)

try:
    # Import faster_whisper directly - it might work even with the httpx issue
    import faster_whisper
    import json
    
    print("SUCCESS: faster_whisper imported successfully")
    print("Downloading Whisper model: ${modelId}")
    print("This may take a few minutes depending on your internet connection...")
    print(f"Using cache directory: {whisper_path}")
    
    # Initialize WhisperModel with the specified model
    # This will trigger the download if the model is not already cached
    # download_root is set, but we also set environment variables above to ensure it works
    model = faster_whisper.WhisperModel(
        "${modelId}", 
        device="cpu", 
        compute_type="int8",
        download_root=whisper_path
    )
    
    print(json.dumps({"success": True, "message": "Model downloaded successfully"}))
    
except ImportError as import_error:
    print(f"ERROR: Import error when importing faster_whisper: {import_error}")
    print(json.dumps({"success": False, "error": f"Import error: {str(import_error)}"}))
except Exception as e:
    print(f"ERROR: General error: {e}")
    print(json.dumps({"success": False, "error": str(e)}))`;
      
      const tempScriptPath = path.join(process.cwd(), `temp_download_whisper_${Date.now()}.py`);
      fs.writeFileSync(tempScriptPath, script);
      
      // On Mac, PyAV needs FFmpeg libraries at runtime via DYLD_LIBRARY_PATH
      const env: Record<string, string> = { 
        ...Object.fromEntries(
          Object.entries(process.env).filter(([_, value]) => value !== undefined)
        ) as Record<string, string>
      };
      
      // Set up comprehensive Python path
      const pythonPaths = [
        whisperPath,
        path.join(whisperPath, 'site-packages'),
        path.join(whisperPath, 'Lib', 'site-packages')
      ].filter(p => fs.existsSync(p));
      
      if (pythonPaths.length > 0) {
        env.PYTHONPATH = pythonPaths.join(path.delimiter) + 
          (env.PYTHONPATH ? path.delimiter + env.PYTHONPATH : '');
      }
      
      // Set Python to use UTF-8 encoding to avoid Unicode issues
      env.PYTHONIOENCODING = 'utf-8';
      env.PYTHONLEGACYWINDOWSSTDIO = '1';
      
      if (process.platform === 'darwin') {
        const ffmpegMacLibPath = path.join(process.cwd(), 'ffmpeg', 'mac', 'lib');
        env.DYLD_LIBRARY_PATH = env.DYLD_LIBRARY_PATH 
          ? `${ffmpegMacLibPath}:${env.DYLD_LIBRARY_PATH}`
          : ffmpegMacLibPath;
      }
      
      const childProcess = spawn(embeddedPythonExe, [tempScriptPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true,
        env: env
      });
      
      let output = '';
      let errorOutput = '';
      
      childProcess.stdout.on('data', (data: any) => {
        const text = data.toString();
        output += text;
        console.log('[Whisper Download]', text.trim());
        
        // Send progress updates to renderer
        event.sender.send('whisper:download-progress', {
          modelId,
          message: text.trim()
        });
      });
      
      childProcess.stderr.on('data', (data: any) => {
        const text = data.toString();
        errorOutput += text;
        console.log('[Whisper Download Error]', text.trim());
      });
      
      childProcess.on('close', (code: number) => {
        // Clean up temp file
        try {
          fs.unlinkSync(tempScriptPath);
        } catch (e) {
          // Ignore cleanup errors
        }
        
        try {
          // Try to parse JSON output
          const lines = output.split('\n');
          const jsonLine = lines.find(line => line.trim().startsWith('{'));
          
          if (jsonLine) {
            const result = JSON.parse(jsonLine);
            if (result.success) {
              resolve({
                id: request.id,
                timestamp: Date.now(),
                success: true,
                payload: { modelId, message: 'Model downloaded successfully' }
              });
            } else {
              resolve({
                id: request.id,
                timestamp: Date.now(),
                success: false,
                error: result.error || 'Download failed'
              });
            }
          } else if (code === 0) {
            resolve({
              id: request.id,
              timestamp: Date.now(),
              success: true,
              payload: { modelId, message: 'Model downloaded successfully' }
            });
          } else {
            resolve({
              id: request.id,
              timestamp: Date.now(),
              success: false,
              error: `Download failed with code ${code}: ${errorOutput || output}`
            });
          }
        } catch (parseError) {
          resolve({
            id: request.id,
            timestamp: Date.now(),
            success: false,
            error: 'Failed to parse download result'
          });
        }
      });
      
      childProcess.on('error', (error: Error) => {
        try {
          fs.unlinkSync(tempScriptPath);
        } catch (e) {
          // Ignore cleanup errors
        }
        resolve({
          id: request.id,
          timestamp: Date.now(),
          success: false,
          error: `Failed to start download: ${error.message}`
        });
      });
    });
  } catch (error) {
    console.error('Error downloading whisper model:', error);
    return {
      id: request.id,
      timestamp: Date.now(),
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Register whisper:download-model handler at module level (for Mac compatibility)
 */
try {
  console.log('🔧 Registering whisper:download-model handler at module level...');
  ipcMain.handle('whisper:download-model', handleDownloadWhisperModel);
  console.log('✅ Successfully registered whisper:download-model at module level');
} catch (regError) {
  console.error('❌ Failed to register whisper:download-model at module level:', regError);
}

/**
 * Check local processing availability
 */
async function handleCheckLocalAvailability(
  event: IpcMainInvokeEvent,
  request: IPCRequest
): Promise<IPCResponse<{
  whisper: boolean;
  argos: boolean;
  overall: boolean;
}>> {
  try {
    const { LocalProcessingManager } = await import('../../services/LocalProcessingManager');
    const localManager = LocalProcessingManager.getInstance();
    
    const availability = await localManager.isLocalProcessingAvailable();

    return {
      id: request.id,
      timestamp: Date.now(),
      success: true,
      payload: availability
    };
  } catch (error) {
    console.error('Error checking local processing availability:', error);
    return {
      id: request.id,
      timestamp: Date.now(),
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Get available local voices
 */
async function handleGetLocalVoices(
  event: IpcMainInvokeEvent,
  request: IPCRequest<{ language?: string }>
): Promise<IPCResponse<any[]>> {
  try {
    // Local TTS (Piper) is no longer supported - return empty array
    // TTS will fall back to cloud services (ElevenLabs)
    console.log('Local TTS not supported - returning empty voices array');

    return {
      id: request.id,
      timestamp: Date.now(),
      success: true,
      payload: []
    };
  } catch (error) {
    console.error('Error getting local voices:', error);
    return {
      id: request.id,
      timestamp: Date.now(),
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Get supported languages for local processing
 */
async function handleGetLocalSupportedLanguages(
  event: IpcMainInvokeEvent,
  request: IPCRequest
): Promise<IPCResponse<{
  whisper: string[];
  argos: string[];
  common: string[];
}>> {
  try {
    const { LocalProcessingManager } = await import('../../services/LocalProcessingManager');
    const localManager = LocalProcessingManager.getInstance();
    
    const languages = localManager.getSupportedLanguages();

    return {
      id: request.id,
      timestamp: Date.now(),
      success: true,
      payload: languages
    };
  } catch (error) {
    console.error('Error getting local supported languages:', error);
    return {
      id: request.id,
      timestamp: Date.now(),
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Update local model configuration
 */
async function handleUpdateLocalModelConfig(
  event: IpcMainInvokeEvent,
  request: IPCRequest<{
    whisperModel?: string;
    voiceModel?: string;
    modelParameters?: {
      temperature?: number;
      speed?: number;
    };
  }>
): Promise<IPCResponse<void>> {
  try {
    const { LocalProcessingManager } = await import('../../services/LocalProcessingManager');
    const localManager = LocalProcessingManager.getInstance();
    
    await localManager.updateLocalModelConfig(request.payload);

    return {
      id: request.id,
      timestamp: Date.now(),
      success: true
    };
  } catch (error) {
    console.error('Error updating local model config:', error);
    return {
      id: request.id,
      timestamp: Date.now(),
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Initialize local processing manager
 */
async function handleInitializeLocal(
  event: IpcMainInvokeEvent,
  request: IPCRequest
): Promise<IPCResponse<{ success: boolean; message?: string }>> {
  try {
    console.log('[LocalModelHandlers] Initializing local processing manager...');
    
    const { LocalProcessingManager } = await import('../../services/LocalProcessingManager');
    const localManager = LocalProcessingManager.getInstance();
    
    // Initialize the local processing manager
    await localManager.initialize();
    
    console.log('[LocalModelHandlers] ✅ Local processing manager initialized successfully');
    
    return {
      id: request.id,
      timestamp: Date.now(),
      success: true,
      payload: { success: true, message: 'Local processing manager initialized' }
    };
  } catch (error) {
    console.error('[LocalModelHandlers] ❌ Failed to initialize local processing manager:', error);
    return {
      id: request.id,
      timestamp: Date.now(),
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during local initialization'
    };
  }
}

/**
 * Get local model status
 */
async function handleGetLocalModelStatus(
  event: IpcMainInvokeEvent,
  request: IPCRequest
): Promise<IPCResponse<{
  whisperModel: string;
  whisperAvailable: boolean;
  argosAvailable: boolean;
}>> {
  try {
    const { LocalProcessingManager } = await import('../../services/LocalProcessingManager');
    const localManager = LocalProcessingManager.getInstance();
    
    const status = localManager.getLocalModelStatus();

    return {
      id: request.id,
      timestamp: Date.now(),
      success: true,
      payload: status
    };
  } catch (error) {
    console.error('Error getting local model status:', error);
    return {
      id: request.id,
      timestamp: Date.now(),
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Restart Argos service
 */
async function handleArgosRestart(
  event: IpcMainInvokeEvent,
  request: IPCRequest | undefined
): Promise<IPCResponse<{ success: boolean }>> {
  try {
    // Use LocalProcessingManager to restart Argos, which uses the same instance
    // that TranslationServiceManager uses
    const { LocalProcessingManager } = await import('../../services/LocalProcessingManager');
    const localManager = LocalProcessingManager.getInstance();
    
    // Restart Argos service through LocalProcessingManager
    await localManager.restartArgos();
    
    return {
      id: request?.id || Date.now().toString(),
      timestamp: Date.now(),
      success: true,
      payload: { success: true }
    };
  } catch (error) {
    console.error('Error restarting Argos service:', error);
    return {
      id: request?.id || Date.now().toString(),
      timestamp: Date.now(),
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Handler function for checking local model installations
 */
async function handleCheckLocalModelsInstallations(
  event: IpcMainInvokeEvent,
  request: IPCRequest<void>
): Promise<IPCResponse<{ argos: boolean; 'argos-extra': boolean; whisper: boolean }>> {
  console.log('🔍 local-models:check-installations handler called with request:', request);
  try {
    const path = require('path');
    const fs = require('fs').promises;
    const os = require('os');

    // Get the models directory (platform-specific)
    // On Mac, use Windows-style path since that's where models are stored
    let modelsDir: string;
    if (process.platform === 'win32') {
      const appDataPath = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
      modelsDir = path.join(appDataPath, 'whispra', 'models');
    } else if (process.platform === 'darwin') {
      // On Mac, use Windows-style path: ~/AppData/Roaming/whispra/models
      modelsDir = path.join(os.homedir(), 'AppData', 'Roaming', 'whispra', 'models');
    } else {
      const appDataPath = process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share');
      modelsDir = path.join(appDataPath, 'whispra', 'models');
    }

    // Check each model for installation marker files
    const modelStatuses = {
      argos: false,
      'argos-extra': false,
      whisper: false
    };

    try {
      // Check if models directory exists
      await fs.access(modelsDir);

      // Check for marker files
      for (const modelKey of Object.keys(modelStatuses)) {
        // Handle argos-extra specially - it installs to argos/extrapack subdirectory
        if (modelKey === 'argos-extra') {
          const modelDir = path.join(modelsDir, 'argos', 'extrapack');
          const markerFile = path.join(modelDir, 'argos-extra_installed.txt');

          try {
            await fs.access(markerFile);
            modelStatuses[modelKey as keyof typeof modelStatuses] = true;
          } catch {
            // Marker file doesn't exist, extra pack not installed
            modelStatuses[modelKey as keyof typeof modelStatuses] = false;
          }
        } else {
          const modelDir = path.join(modelsDir, modelKey);
          const markerFile = path.join(modelDir, `${modelKey}_installed.txt`);

          try {
            await fs.access(markerFile);
            modelStatuses[modelKey as keyof typeof modelStatuses] = true;
          } catch {
            // Marker file doesn't exist
            modelStatuses[modelKey as keyof typeof modelStatuses] = false;
          }
        }
      }
    } catch (dirError) {
      // Models directory doesn't exist, all models are not installed
      console.log('Models directory does not exist:', modelsDir);
    }

    return {
      id: request.id,
      timestamp: Date.now(),
      success: true,
      payload: modelStatuses
    };
  } catch (error) {
    console.error('Error checking model installations:', error);
    return {
      id: request.id,
      timestamp: Date.now(),
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Register local-models:check-installations handler at module level (for Mac compatibility)
 */
try {
  console.log('🔧 Registering local-models:check-installations handler at module level...');
  ipcMain.handle('local-models:check-installations', handleCheckLocalModelsInstallations);
  console.log('✅ Successfully registered local-models:check-installations at module level');
} catch (regError) {
  console.error('❌ Failed to register local-models:check-installations at module level:', regError);
}

/**
 * Register all local model IPC handlers
 */
export function registerLocalModelHandlers(): void {
  try {
    console.log('🔄 Registering Local Model IPC handlers...');
    console.log('🔍 ipcMain available:', typeof ipcMain !== 'undefined');
    console.log('🔍 ipcMain.handle available:', typeof ipcMain?.handle === 'function');
    
    // Local processing handlers
    // Note: We don't remove local-models:download here because it's registered at module level
    // and we want to keep it available. We'll only re-register if needed.
    try { ipcMain.removeHandler('local:check-availability'); } catch {}
    try { ipcMain.removeHandler('local:get-voices'); } catch {}
    try { ipcMain.removeHandler('local:get-supported-languages'); } catch {}
    try { ipcMain.removeHandler('local:update-model-config'); } catch {}
    try { ipcMain.removeHandler('local:get-model-status'); } catch {}
    try { ipcMain.removeHandler('argos:restart'); } catch {}
    try { ipcMain.removeHandler('local-models:check-installations'); } catch {}
    // Don't remove local-models:download - it's registered at module level and we want to keep it
    // try { ipcMain.removeHandler('local-models:download'); } catch {}
    try { ipcMain.removeHandler('whisper:download-model'); } catch {}

    // Register the local-models:check-installations handler
    try {
      console.log('🔄 Registering local-models:check-installations handler...');
      if (!ipcMain || typeof ipcMain.handle !== 'function') {
        throw new Error('ipcMain.handle is not available');
      }
      ipcMain.handle('local-models:check-installations', handleCheckLocalModelsInstallations);
      console.log('✅ Successfully registered local-models:check-installations');
    } catch (e) {
      console.error('❌ Failed to register local-models:check-installations:', e);
      if (e instanceof Error) {
        console.error('❌ Error details:', e.message, e.stack);
      }
    }

    // Register handlers with individual error handling
    try {
      ipcMain.handle('local:check-availability', handleCheckLocalAvailability);
    } catch (e) {
      console.error('Failed to register local:check-availability:', e);
    }
    
    try {
      ipcMain.handle('local:get-voices', handleGetLocalVoices);
    } catch (e) {
      console.error('Failed to register local:get-voices:', e);
    }
    
    try {
      ipcMain.handle('local:get-supported-languages', handleGetLocalSupportedLanguages);
    } catch (e) {
      console.error('Failed to register local:get-supported-languages:', e);
    }
    
    try {
      ipcMain.handle('local:update-model-config', handleUpdateLocalModelConfig);
    } catch (e) {
      console.error('Failed to register local:update-model-config:', e);
    }
    
    try {
      ipcMain.handle('local:get-model-status', handleGetLocalModelStatus);
    } catch (e) {
      console.error('Failed to register local:get-model-status:', e);
    }
    
    try {
      ipcMain.handle('local:initialize', handleInitializeLocal);
    } catch (e) {
      console.error('Failed to register local:initialize:', e);
    }
    
    try {
      ipcMain.handle('argos:restart', handleArgosRestart);
    } catch (e) {
      console.error('Failed to register argos:restart:', e);
    }
    
    // Note: local-models:check-installations is now registered directly above

    // Register whisper:download-model handler
    try {
      console.log('🔄 Registering whisper:download-model handler...');
      ipcMain.handle('whisper:download-model', handleDownloadWhisperModel);
      console.log('✅ Successfully registered whisper:download-model');
    } catch (e) {
      console.error('❌ Failed to register whisper:download-model:', e);
    }

    // Register local-models:download handler
    // This handler is already registered at module level, so we only register if it doesn't exist
    try {
      console.log('🔄 Ensuring local-models:download handler is registered...');
      // Check if handler already exists - if so, skip registration
      try {
        ipcMain.removeHandler('local-models:download');
      } catch {
        // Handler doesn't exist, that's fine
      }
      ipcMain.handle('local-models:download', handleDownloadLocalModel);
      console.log('✅ Successfully registered local-models:download');
    } catch (e) {
      console.error('❌ Failed to register local-models:download:', e);
      if (e instanceof Error) {
        console.error('❌ Error details:', e.message, e.stack);
      }
    }

    // Note: local-models:download and whisper:get-available-models
    // are also registered at module level for early availability (Mac compatibility).
    // They are re-registered here to ensure they're available after any removal.

    console.log('✅ Local Model IPC handlers registration completed');
    console.log('📋 Registered handlers: local-models:check-installations, local-models:download, whisper:download-model, whisper:get-available-models, local:*, argos:restart');
  } catch (error) {
    console.error('❌ Failed to register Local Model IPC handlers:', error);
    if (error instanceof Error) {
      console.error('❌ Error details:', error.message, error.stack);
    }
  }
}

