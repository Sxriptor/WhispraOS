import { ipcMain, IpcMainInvokeEvent, IpcMainEvent, desktopCapturer, BrowserWindow, app, shell } from 'electron';
import { getSoundboardService } from '../soundboard/soundboard-ipc';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { GlobalKeyboardListener } = require('node-global-key-listener');
import * as fs from 'fs';
import * as path from 'path';
import { IPC_CHANNELS, OVERLAY_CHANNELS, MINI_OVERLAY_CHANNELS } from './channels';
import { 
  IPCRequest, 
  IPCResponse, 
  GetAudioDevicesRequest,
  GetAudioDevicesResponse,
  GetConfigRequest,
  GetConfigResponse,
  SetConfigRequest,
  ValidateApiKeyRequest,
  ValidateApiKeyResponse,
  OverlayToggleRequest,
  OverlayCloseRequest,
  OverlayHoldCloseRequest,
  OverlaySettingChangeRequest,
  GetOverlayStateRequest,
  OverlayStateResponse,
  UpdateOverlayHotkeyRequest,
  SaveOverlayPositionRequest,
  GetOverlayConfigRequest,
  OverlayConfigResponse
} from './messages';
import { AudioQuality, TTSQuality, TranslationProvider, getModelConfigFromConfig } from '../types/ConfigurationTypes';
import { ConfigurationManager } from '../services/ConfigurationManager';
import { ApiKeyManager } from '../services/ApiKeyManager';
import { ApiKeyMigrationService } from '../services/ApiKeyMigrationService';
import { AudioDeviceService } from '../services/AudioDeviceService';
import { OverlayStateManager } from '../services/OverlayStateManager';
import { SplitOverlayWindowManager } from '../services/SplitOverlayWindowManager';
import { AutoUpdaterService } from '../services/AutoUpdaterService';
import { AuthManager } from '../services/AuthManager';
import { TextToSpeechManager } from '../services/TextToSpeechManager';
import { CaptionsOverlayManager } from '../services/CaptionsOverlayManager';
import { PTTOverlayManager } from '../services/PTTOverlayManager';
import { AudioLevelOverlayManager } from '../services/AudioLevelOverlayManager';
import { WhatsNewOverlayManager } from '../services/WhatsNewOverlayManager';

// Global state for tracking TTS playback to filter out from WASAPI capture
let isTtsPlaying = false;
let ttsPlaybackStartTime = 0;
let ttsPlaybackEndTime = 0;

// Global processing orchestrator instance
let processingOrchestrator: any = null;

// Global Real-Time API client for bidirectional mode
let bidirectionalRealTimeClient: any = null;

// PTT overlay manager (singleton) - now using unified AudioLevelOverlayManager
const getPTTOverlayManager = () => PTTOverlayManager.getInstance();
const getAudioLevelOverlayManager = () => AudioLevelOverlayManager.getInstance();

/**
 * Get current TTS playback state
 */
export function getTtsPlaybackState(): {
  isPlaying: boolean;
  playbackStartTime: number;
  playbackEndTime: number;
} {
  return {
    isPlaying: isTtsPlaying,
    playbackStartTime: ttsPlaybackStartTime,
    playbackEndTime: ttsPlaybackEndTime
  };
}

// Lightweight language stickiness (helps keep Russian stable when detected)
let __ruStickyUntil: number = 0;

// Global overlay state manager instance for efficient reuse
let globalOverlayStateManager: OverlayStateManager | null = null;

/**
 * Get overlay state manager instance (cached for performance)
 */
function getOverlayStateManager(): OverlayStateManager {
  if (!globalOverlayStateManager) {
    globalOverlayStateManager = OverlayStateManager.getInstance();
  }
  return globalOverlayStateManager;
}

/**
 * Type-safe IPC handler function
 */
export type IPCHandler<TRequest extends IPCRequest, TResponse extends IPCResponse> = 
  (event: IpcMainInvokeEvent, request: TRequest) => Promise<TResponse> | TResponse;

/**
 * Register all IPC handlers in the main process
 */
export async function registerIPCHandlers(): Promise<void> {
  console.log('Registering IPC handlers...');

  // Import handleDownloadLocalModel at the top level to avoid dynamic import issues
  let handleDownloadLocalModel: any = null;
  try {
    const localModelHandlersModule = await import('./handlers/localModelHandlers');
    handleDownloadLocalModel = localModelHandlersModule.handleDownloadLocalModel;
    if (handleDownloadLocalModel) {
      console.log('✅ handleDownloadLocalModel imported successfully, type:', typeof handleDownloadLocalModel);
    } else {
      console.error('❌ handleDownloadLocalModel is null/undefined after import');
    }
  } catch (importError) {
    console.error('❌ Failed to import handleDownloadLocalModel:', importError);
    if (importError instanceof Error) {
      console.error('❌ Import error message:', importError.message);
      console.error('❌ Import error stack:', importError.stack);
    }
  }

  // Initialize Local Model IPC handlers FIRST to ensure they're available early
  // This is critical for Mac compatibility
  // NOTE: local-models:download is registered directly inline later in this file
  // We just need to call registerLocalModelHandlers for other handlers
  try {
    console.log('🔄 [EARLY] Importing Local Model handlers...');
    console.log('🔍 Platform:', process.platform);
    const localModelHandlersModule = await import('./handlers/localModelHandlers');
    console.log('🔍 Module imported:', Object.keys(localModelHandlersModule));
    
    // Ensure handleDownloadLocalModel is available
    if (!handleDownloadLocalModel && localModelHandlersModule.handleDownloadLocalModel) {
      handleDownloadLocalModel = localModelHandlersModule.handleDownloadLocalModel;
      console.log('✅ handleDownloadLocalModel obtained from second import');
    }
    
    // Now call registerLocalModelHandlers (but DON'T register local-models:download here - it's inline below)
    if (localModelHandlersModule.registerLocalModelHandlers) {
      console.log('🔍 registerLocalModelHandlers function:', typeof localModelHandlersModule.registerLocalModelHandlers);
      localModelHandlersModule.registerLocalModelHandlers();
      console.log('🔄 [EARLY] Local Model IPC handlers initialized');
    } else {
      console.error('❌ [EARLY] registerLocalModelHandlers not found in module');
    }
  } catch (error) {
    console.error('❌ [EARLY] Failed to initialize Local Model IPC handlers:', error);
    if (error instanceof Error) {
      console.error('❌ Error message:', error.message);
      console.error('❌ Error stack:', error.stack);
    }
  }

  // Register local-models:check-installations handler directly as fallback
  // This ensures it's always available even if the module import fails
  try {
    console.log('🔧 [FALLBACK] Registering local-models:check-installations directly...');
    // Remove any existing handler first
    try { ipcMain.removeHandler('local-models:check-installations'); } catch {}
    ipcMain.handle('local-models:check-installations', async (event, request: IPCRequest<void>) => {
      console.log('🔍 [DIRECT HANDLER] local-models:check-installations called');
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

        const modelStatuses = {
          argos: false,
          'argos-extra': false,
          whisper: false
        };

        try {
          await fs.access(modelsDir);
          for (const modelKey of Object.keys(modelStatuses)) {
            if (modelKey === 'argos-extra') {
              const modelDir = path.join(modelsDir, 'argos', 'extrapack');
              const markerFile = path.join(modelDir, 'argos-extra_installed.txt');
              try {
                await fs.access(markerFile);
                modelStatuses[modelKey as keyof typeof modelStatuses] = true;
              } catch {
                modelStatuses[modelKey as keyof typeof modelStatuses] = false;
              }
            } else {
              const modelDir = path.join(modelsDir, modelKey);
              const markerFile = path.join(modelDir, `${modelKey}_installed.txt`);
              try {
                await fs.access(markerFile);
                modelStatuses[modelKey as keyof typeof modelStatuses] = true;
              } catch {
                modelStatuses[modelKey as keyof typeof modelStatuses] = false;
              }
            }
          }
        } catch (dirError) {
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
    });
    console.log('✅ [FALLBACK] Successfully registered local-models:check-installations directly');
  } catch (fallbackError) {
    console.error('❌ [FALLBACK] Failed to register handler directly:', fallbackError);
  }

  // Register whisper:download-model handler directly as fallback
  try {
    console.log('🔧 [FALLBACK] Registering whisper:download-model directly...');
    // Remove any existing handler first
    try { ipcMain.removeHandler('whisper:download-model'); } catch {}

    ipcMain.handle('whisper:download-model', async (event, request: IPCRequest<{ modelId: string }>) => {
      console.log('🔍 [DIRECT HANDLER] whisper:download-model called with:', request.payload);
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
        // On Mac, use Windows-style path since that's where models are stored
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
        
        // Get embedded Python path (use same logic as platformUtils)
        // On Mac, prioritize bin/python3 over Python file
        let embeddedPythonExe: string;
        if (process.platform === 'win32') {
          const pythonDir = path.join(process.cwd(), 'python');
          embeddedPythonExe = path.join(pythonDir, 'python.exe');
        } else if (process.platform === 'darwin') {
          // macOS: check bin folder first (actual executables)
          const macPython3Path = path.join(process.cwd(), 'macpython', 'bin', 'python3');
          if (fs.existsSync(macPython3Path)) {
            embeddedPythonExe = macPython3Path;
          } else {
            const macPython310Path = path.join(process.cwd(), 'macpython', 'bin', 'python3.10');
            if (fs.existsSync(macPython310Path)) {
              embeddedPythonExe = macPython310Path;
            } else {
              // Fallback to system Python3
              embeddedPythonExe = '/usr/bin/python3';
            }
          }
        } else {
          const pythonDir = path.join(process.cwd(), 'python');
          const python3Path = path.join(pythonDir, 'python3');
          embeddedPythonExe = fs.existsSync(python3Path) ? python3Path : '/usr/bin/python3';
        }
        
        if (!fs.existsSync(embeddedPythonExe)) {
          console.error('❌ Python executable not found at:', embeddedPythonExe);
          return {
            id: request.id,
            timestamp: Date.now(),
            success: false,
            error: `Python executable not found at: ${embeddedPythonExe}`
          };
        }
        
        console.log('🔍 Using Python:', embeddedPythonExe);
        console.log('🔍 Whisper path:', whisperPath);
        console.log('🔍 Model ID:', modelId);
        
        return new Promise((resolve) => {
          const script = `import sys
import os
import json
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

# Add whisper to path
if whisper_path not in sys.path:
    sys.path.insert(0, whisper_path)

try:
    from faster_whisper import WhisperModel
    
    model_name = "${modelId}"
    print(f"Downloading model: {model_name}", file=sys.stderr)
    print(f"Using cache directory: {whisper_path}", file=sys.stderr)
    
    # Download the model (this will cache it)
    # download_root is set, but we also set environment variables above to ensure it works
    model = WhisperModel(model_name, device="cpu", compute_type="int8", download_root=whisper_path)
    
    result = {"success": True, "message": f"Model {model_name} downloaded successfully"}
    print(json.dumps(result))
    sys.exit(0)
except Exception as e:
    import traceback
    error_msg = str(e)
    traceback.print_exc(file=sys.stderr)
    result = {"success": False, "error": error_msg}
    print(json.dumps(result))
    sys.exit(1)`;
          
          const tempScriptPath = path.join(process.cwd(), `temp_download_model_${Date.now()}.py`);
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
            const text = data.toString();
            output += text;
            console.log('[Python stdout]', text);
          });
          
          childProcess.stderr.on('data', (data: any) => {
            const text = data.toString();
            errorOutput += text;
            console.log('[Python stderr]', text);
          });
          
          childProcess.on('close', (code: number) => {
            console.log(`[Python process] Exited with code ${code}`);
            console.log(`[Python output] stdout: ${output}`);
            console.log(`[Python output] stderr: ${errorOutput}`);
            
            try {
              fs.unlinkSync(tempScriptPath);
            } catch (e) {
              // Ignore cleanup errors
            }
            
            // Try to parse JSON from output
            let result: any = null;
            const outputLines = output.trim().split('\n');
            for (const line of outputLines) {
              if (line.trim().startsWith('{')) {
                try {
                  result = JSON.parse(line.trim());
                  break;
                } catch (e) {
                  // Continue to next line
                }
              }
            }
            
            if (result) {
              if (result.success) {
                console.log('✅ Model download succeeded:', result.message);
                resolve({
                  id: request.id,
                  timestamp: Date.now(),
                  success: true,
                  payload: { modelId, message: result.message || 'Model downloaded successfully' }
                });
              } else {
                console.error('❌ Model download failed:', result.error);
                resolve({
                  id: request.id,
                  timestamp: Date.now(),
                  success: false,
                  error: result.error || 'Download failed'
                });
              }
            } else {
              // No JSON found, check exit code and error output
              if (code === 0) {
                // Process exited successfully but no JSON - might have succeeded
                console.log('⚠️ Process exited successfully but no JSON output');
                resolve({
                  id: request.id,
                  timestamp: Date.now(),
                  success: true,
                  payload: { modelId, message: 'Model download completed' }
                });
              } else {
                // Process failed
                const errorMsg = errorOutput || output || 'Unknown error';
                console.error('❌ Model download failed - exit code:', code, 'error:', errorMsg);
                resolve({
                  id: request.id,
                  timestamp: Date.now(),
                  success: false,
                  error: `Download failed (exit code ${code}): ${errorMsg}`
                });
              }
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
    });
    console.log('✅ [FALLBACK] Successfully registered whisper:download-model directly');
  } catch (fallbackError) {
    console.error('❌ [FALLBACK] Failed to register whisper:download-model directly:', fallbackError);
  }

  // NOTE: local-models:download is registered directly inline later in this file (line ~6091)
  // No need for fallback registration here - the inline registration is sufficient


  // Utility functions for sending messages to all windows
  const sendAll = (channel: string) => {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) win.webContents.send(channel);
    }
  };

  const sendAllData = (channel: string, data: any) => {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) win.webContents.send(channel, data);
    }
  };

  // Initialize PaddlePaddle IPC handlers
  try {
    console.log('🏓 Attempting to import paddle-ipc...');
    const paddleModule = await import('../paddle/paddle-ipc');
    console.log('🏓 Paddle module imported:', Object.keys(paddleModule));
    const { initializePaddleIPC } = paddleModule;
    console.log('🏓 About to call initializePaddleIPC...');
    initializePaddleIPC();
    console.log('🏓 PaddlePaddle IPC initialization completed');
  } catch (error) {
    console.error('Failed to initialize PaddlePaddle IPC:', error);
  }

  // Initialize secure API key handlers
  try {
    const { registerSecureApiKeyHandlers } = await import('./handlers/secureApiKeysHandlers');
    registerSecureApiKeyHandlers();
  } catch (error) {
    console.error('Failed to initialize secure API key handlers:', error);
  }

  // Initialize Quick Translate handlers
  try {
    const { registerQuickTranslateHandlers } = await import('./handlers/quickTranslateHandlers');
    registerQuickTranslateHandlers();
  } catch (error) {
    console.error('Failed to initialize Quick Translate handlers:', error);
  }

  // Initialize WASAPI IPC handlers
  try {
    console.log('🎤 Attempting to import WASAPI handlers...');
    const wasapiModule = await import('./handlers/wasapi-handlers.js');
    const { registerWasapiHandlers } = wasapiModule;
    registerWasapiHandlers();
    console.log('🎤 WASAPI IPC handlers initialized');
  } catch (error) {
    console.error('Failed to initialize WASAPI IPC handlers:', error);
  }

  // Initialize Screen Translation handlers
  try {
    console.log('📺 Attempting to import Screen Translation handlers...');
    const { registerScreenTranslationHandlers, setupScreenTranslationDisplayListeners } = await import('./handlers/screenTranslationHandlers');
    registerScreenTranslationHandlers();
    setupScreenTranslationDisplayListeners();
    console.log('📺 Screen Translation IPC handlers initialized');
  } catch (error) {
    console.error('Failed to initialize Screen Translation IPC handlers:', error);
  }

  // Initialize Hotkey handlers
  try {
    console.log('⌨️  Attempting to import Hotkey handlers...');
    const { registerHotkeyHandlers } = await import('./handlers/hotkeyHandlers');
    registerHotkeyHandlers();
    console.log('⌨️  Hotkey handlers initialized');
  } catch (error) {
    console.error('Failed to initialize Hotkey handlers:', error);
  }

  // Initialize Translation Pipeline handlers
  try {
    console.log('🔄 Attempting to import Translation Pipeline handlers...');
    const { registerTranslationPipelineHandlers } = await import('./handlers/translationPipelineHandlers');
    registerTranslationPipelineHandlers();
    console.log('🔄 Translation Pipeline IPC handlers initialized');
  } catch (error) {
    console.error('Failed to initialize Translation Pipeline IPC handlers:', error);
  }

  // Initialize Local Model IPC handlers
  try {
    console.log('🔄 Attempting to import Local Model handlers...');
    const { registerLocalModelHandlers } = await import('./handlers/localModelHandlers');
    registerLocalModelHandlers();
    console.log('🔄 Local Model IPC handlers initialized');
  } catch (error) {
    console.error('Failed to initialize Local Model IPC handlers:', error);
  }

  // Initialize WebSocket IPC handlers
  try {
    console.log('🔌 Attempting to import WebSocket handlers...');
    const { registerWebSocketHandlers } = await import('./handlers/websocketHandlers');
    registerWebSocketHandlers();
    console.log('🔌 WebSocket IPC handlers initialized');
  } catch (error) {
    console.error('Failed to initialize WebSocket IPC handlers:', error);
  }

  // Initialize GPU Paddle IPC handlers
  try {
    const { GPUPaddleService } = await import('../services/GPUPaddleService');
    const { GPUPaddleOverlayManager } = await import('../services/GPUPaddleOverlayManager');
    const { GPU_PADDLE_CHANNELS } = await import('./channels');

    const gpuPaddleService = GPUPaddleService.getInstance();
    const gpuPaddleOverlayManager = GPUPaddleOverlayManager.getInstance();

    // Show GPU Paddle overlay
    try { ipcMain.removeHandler(GPU_PADDLE_CHANNELS.SHOW_OVERLAY); } catch {}
    ipcMain.handle(GPU_PADDLE_CHANNELS.SHOW_OVERLAY, async () => {
      try {
        await gpuPaddleOverlayManager.showGPUPaddleOverlay();
        return { success: true };
      } catch (error) {
        console.error('🎮 Error showing GPU Paddle overlay:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    // Close GPU Paddle overlay
    try { ipcMain.removeHandler(GPU_PADDLE_CHANNELS.CLOSE_OVERLAY); } catch {}
    ipcMain.handle(GPU_PADDLE_CHANNELS.CLOSE_OVERLAY, async () => {
      try {
        gpuPaddleOverlayManager.closeGPUPaddleOverlay();
        return { success: true };
      } catch (error) {
        console.error('🎮 Error closing GPU Paddle overlay:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    // Detect CUDA
    try { ipcMain.removeHandler(GPU_PADDLE_CHANNELS.DETECT_CUDA); } catch {}
    ipcMain.handle(GPU_PADDLE_CHANNELS.DETECT_CUDA, async () => {
      try {
        const cudaInfo = await gpuPaddleService.detectCUDA();
        return { success: true, ...cudaInfo };
      } catch (error) {
        console.error('🎮 Error detecting CUDA:', error);
        return { success: false, hasCUDA: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    // Check GPU Paddle status
    try { ipcMain.removeHandler(GPU_PADDLE_CHANNELS.CHECK_STATUS); } catch {}
    ipcMain.handle(GPU_PADDLE_CHANNELS.CHECK_STATUS, async () => {
      try {
        const status = await gpuPaddleService.getGPUPaddleStatus();
        return { success: true, ...status };
      } catch (error) {
        console.error('🎮 Error checking GPU Paddle status:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    // Quick GPU Paddle status check (for UI interactions)
    try { ipcMain.removeHandler('gpu-paddle:quick-status'); } catch {}
    ipcMain.handle('gpu-paddle:quick-status', async () => {
      try {
        const quickStatus = gpuPaddleService.getQuickGPUPaddleStatus();
        return { success: true, hasGPUPaddle: quickStatus.hasGPUPaddle, fromCache: quickStatus.fromCache };
      } catch (error) {
        console.error('🎮 Error checking quick GPU Paddle status:', error);
        return { success: false, hasGPUPaddle: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    // Install GPU Paddle
    try { ipcMain.removeHandler(GPU_PADDLE_CHANNELS.INSTALL); } catch {}
    ipcMain.handle(GPU_PADDLE_CHANNELS.INSTALL, async (_event, cudaVersion: string) => {
      try {
        const result = await gpuPaddleService.installGPUPaddle(cudaVersion);
        return result;
      } catch (error) {
        console.error('🎮 Error installing GPU Paddle:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    // Get GPU mode setting
    try { ipcMain.removeHandler(GPU_PADDLE_CHANNELS.GET_GPU_MODE); } catch {}
    ipcMain.handle(GPU_PADDLE_CHANNELS.GET_GPU_MODE, async () => {
      try {
        const ConfigurationManager = (await import('../services/ConfigurationManager')).ConfigurationManager;
        const configManager = ConfigurationManager.getInstance();
        const ocrGpuMode = configManager.getValue('uiSettings.ocrGpuMode') || 'normal';
        return { success: true, mode: ocrGpuMode };
      } catch (error) {
        console.error('🎮 Error getting GPU mode:', error);
        return { success: false, mode: 'normal', error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    // Set GPU mode setting
    try { ipcMain.removeHandler(GPU_PADDLE_CHANNELS.SET_GPU_MODE); } catch {}
    ipcMain.handle(GPU_PADDLE_CHANNELS.SET_GPU_MODE, async (_event, mode: 'normal' | 'fast') => {
      try {
        const ConfigurationManager = (await import('../services/ConfigurationManager')).ConfigurationManager;
        const configManager = ConfigurationManager.getInstance();
        
        console.log(`🎮 Setting GPU mode to: ${mode}`);
        configManager.setValue('uiSettings.ocrGpuMode', mode);
        
        // Verify it was saved
        const savedValue = configManager.getValue('uiSettings.ocrGpuMode');
        console.log(`🎮 Verified saved GPU mode: ${savedValue}`);
        
        console.log(`🎮 GPU mode set to: ${mode}`);
        return { success: true, mode };
      } catch (error) {
        console.error('🎮 Error setting GPU mode:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    // Fix NumPy compatibility for GPU PaddlePaddle
    try { ipcMain.removeHandler(GPU_PADDLE_CHANNELS.FIX_NUMPY); } catch {}
    ipcMain.handle(GPU_PADDLE_CHANNELS.FIX_NUMPY, async () => {
      try {
        const result = await gpuPaddleService.fixNumPyCompatibility();
        return result;
      } catch (error) {
        console.error('🎮 Error fixing NumPy compatibility:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    console.log('🎮 GPU Paddle IPC handlers initialized');
  } catch (error) {
    console.error('Failed to initialize GPU Paddle IPC:', error);
  }

  // Guarded registrations to avoid duplicate handler errors on reload/hot-start
  try { ipcMain.removeHandler('get-displays'); } catch {}
  ipcMain.handle('get-displays', async () => {
    const { screen } = require('electron');
    return screen.getAllDisplays();
  });

  // Audio device handlers
  ipcMain.handle(IPC_CHANNELS.GET_DEVICES, handleGetAudioDevices);
  ipcMain.handle(IPC_CHANNELS.START_CAPTURE, handleStartAudioCapture);
  ipcMain.handle(IPC_CHANNELS.STOP_CAPTURE, handleStopAudioCapture);

  // Configuration handlers
  // Defensive re-registration to avoid "No handler registered" issues
  try { ipcMain.removeHandler('config:get'); } catch {}
  try { ipcMain.removeHandler('config:set'); } catch {}
  try { ipcMain.removeHandler('config:validate-api-key'); } catch {}
  try { ipcMain.removeHandler('managed-api:set-mode'); } catch {}

  ipcMain.handle('config:get', handleGetConfig);
  ipcMain.handle('config:set', handleSetConfig);
  ipcMain.handle('config:validate-api-key', handleValidateApiKey);
  ipcMain.handle('managed-api:set-mode', handleManagedApiSetMode);
  
  // Enhanced API key management handlers
  try { ipcMain.removeHandler('config:get-api-key'); } catch {}
  try { ipcMain.removeHandler('config:remove-api-key'); } catch {}
  try { ipcMain.removeHandler('config:clear-all-api-keys'); } catch {}
  
  ipcMain.handle('config:get-api-key', handleGetApiKey);
  ipcMain.handle('config:remove-api-key', handleRemoveApiKey);
  ipcMain.handle('config:clear-all-api-keys', handleClearAllApiKeys);

  // Pipeline handlers - moved to handlers/translationPipelineHandlers.ts

  // Local processing handlers - moved to handlers/localModelHandlers.ts

  // TTS playback tracking for audio filtering
  ipcMain.handle('tts:playback-start', handleTtsPlaybackStart);
  ipcMain.handle('tts:playback-end', handleTtsPlaybackEnd);

  // PTT Overlay handlers - using unified AudioLevelOverlayManager
  try { ipcMain.removeHandler('ptt-overlay:show'); } catch {}
  try { ipcMain.removeHandler('ptt-overlay:hide'); } catch {}
  try { ipcMain.removeHandler('ptt-overlay:update-audio'); } catch {}
  
  ipcMain.handle('ptt-overlay:show', async () => {
    try {
      // Use unified overlay manager for PTT
      await getAudioLevelOverlayManager().showPTT();
      return { success: true };
    } catch (error) {
      console.error('Error showing PTT overlay:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });
  
  ipcMain.handle('ptt-overlay:hide', async () => {
    try {
      getAudioLevelOverlayManager().hidePTT();
      return { success: true };
    } catch (error) {
      console.error('Error hiding PTT overlay:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });
  
  ipcMain.handle('ptt-overlay:update-audio', async (event, audioData: number[]) => {
    try {
      getAudioLevelOverlayManager().updatePTTAudio(audioData);
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // Bidirectional Audio Level Overlay handlers
  try { ipcMain.removeHandler('bidi-overlay:show'); } catch {}
  try { ipcMain.removeHandler('bidi-overlay:hide'); } catch {}
  try { ipcMain.removeHandler('bidi-overlay:update-audio'); } catch {}
  
  ipcMain.handle('bidi-overlay:show', async () => {
    try {
      await getAudioLevelOverlayManager().showBidi();
      return { success: true };
    } catch (error) {
      console.error('Error showing Bidi overlay:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });
  
  ipcMain.handle('bidi-overlay:hide', async () => {
    try {
      getAudioLevelOverlayManager().hideBidi();
      return { success: true };
    } catch (error) {
      console.error('Error hiding Bidi overlay:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });
  
  ipcMain.handle('bidi-overlay:update-audio', async (event, audioData: number[]) => {
    try {
      getAudioLevelOverlayManager().updateBidiAudio(audioData);
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // Speech-to-text handlers - moved to handlers/translationPipelineHandlers.ts

  // Translation-only and TTS-only handlers
  ipcMain.handle(IPC_CHANNELS.TRANSLATE_ONLY, handleTranslateOnly);
  ipcMain.handle(IPC_CHANNELS.SYNTHESIZE_ONLY, handleSynthesizeOnly);
  ipcMain.handle('tts:prefetch', handleTtsPrefetch);

  // Quick translate handlers - moved to handlers/quickTranslateHandlers.ts
  // Quick translate hotkey handlers - moved to handlers/quickTranslateHandlers.ts

  // Service status, debug, performance, and voice handlers - moved to handlers/translationPipelineHandlers.ts

  // Overlay handlers (with cleanup to prevent duplicates)
  try { ipcMain.removeHandler(OVERLAY_CHANNELS.TOGGLE); } catch {}
  try { ipcMain.removeHandler(OVERLAY_CHANNELS.CLOSE); } catch {}
  try { ipcMain.removeHandler(OVERLAY_CHANNELS.HOLD_CLOSE); } catch {}
  try { ipcMain.removeHandler(OVERLAY_CHANNELS.SETTING_CHANGE); } catch {}
  try { ipcMain.removeHandler(OVERLAY_CHANNELS.GET_CURRENT_STATE); } catch {}
  try { ipcMain.removeHandler(OVERLAY_CHANNELS.UPDATE_HOTKEY); } catch {}
  try { ipcMain.removeHandler(OVERLAY_CHANNELS.SAVE_POSITION); } catch {}
  try { ipcMain.removeHandler(OVERLAY_CHANNELS.GET_CONFIG); } catch {}
  try { ipcMain.removeHandler(OVERLAY_CHANNELS.GET_GAMEOVERLAY); } catch {}
  try { ipcMain.removeHandler(OVERLAY_CHANNELS.REPORT_ERROR); } catch {}
  try { ipcMain.removeHandler('overlay:control-translation'); } catch {}
  try { ipcMain.removeHandler('overlay:control-bidirectional'); } catch {}
  
  ipcMain.handle(OVERLAY_CHANNELS.TOGGLE, handleOverlayToggle);
  ipcMain.handle(OVERLAY_CHANNELS.CLOSE, handleOverlayClose);
  ipcMain.handle(OVERLAY_CHANNELS.HOLD_CLOSE, handleOverlayHoldClose);
  ipcMain.handle(OVERLAY_CHANNELS.SETTING_CHANGE, handleOverlaySettingChange);
  
  // Soundboard overlay remote control commands
  ipcMain.handle('soundboard:overlay-play-sound', async (event, data) => {
    console.log('🎵 IPC: Received overlay play sound request:', data);
    console.log('🎵 IPC: Sound ID type:', typeof data?.soundId, 'value:', data?.soundId);

    // Forward to main renderer window to trigger sound playback
    const mainWindow = BrowserWindow.getAllWindows().find(win => {
      if (win.webContents === event.sender) return false;
      const url = win.webContents.getURL();
      return url.includes('index.html') || url.includes('signin.html');
    });
    if (mainWindow && !mainWindow.isDestroyed()) {
      console.log('🎵 IPC: Forwarding to main window');
      mainWindow.webContents.send('soundboard:play-sound-from-overlay', data);
    } else {
      console.warn('🎵 IPC: Could not find main window to forward to');
    }
    return { success: true };
  });

  ipcMain.handle('soundboard:overlay-show-file-picker', async (event) => {
    console.log('🎵 IPC: Received overlay show file picker request');
    // Forward to main renderer window to show file picker
    const mainWindow = BrowserWindow.getAllWindows().find(win => {
      if (win.webContents === event.sender) return false;
      const url = win.webContents.getURL();
      return url.includes('index.html') || url.includes('signin.html');
    });
    if (mainWindow && !mainWindow.isDestroyed()) {
      console.log('🎵 IPC: Forwarding file picker request to main window');
      mainWindow.webContents.send('soundboard:show-file-picker-from-overlay');
    }
    return { success: true };
  });

  ipcMain.handle('soundboard:overlay-stop-all-sounds', async (event) => {
    console.log('🎵 IPC: Received overlay stop all sounds request');
    // Forward to main renderer window to stop all sounds
    const mainWindow = BrowserWindow.getAllWindows().find(win => {
      if (win.webContents === event.sender) return false;
      const url = win.webContents.getURL();
      return url.includes('index.html') || url.includes('signin.html');
    });
    if (mainWindow && !mainWindow.isDestroyed()) {
      console.log('🎵 IPC: Forwarding stop all request to main window');
      mainWindow.webContents.send('soundboard:stop-all-sounds-from-overlay');
    }
    return { success: true };
  });
  ipcMain.handle(OVERLAY_CHANNELS.GET_CURRENT_STATE, handleGetOverlayState);
  ipcMain.handle(OVERLAY_CHANNELS.UPDATE_HOTKEY, handleUpdateOverlayHotkey);
  ipcMain.handle(OVERLAY_CHANNELS.SAVE_POSITION, handleSaveOverlayPosition);
  ipcMain.handle(OVERLAY_CHANNELS.GET_CONFIG, handleGetOverlayConfig);
  ipcMain.handle(OVERLAY_CHANNELS.GET_GAMEOVERLAY, handleGetGameOverlayMarkdown);
  ipcMain.handle(OVERLAY_CHANNELS.REPORT_ERROR, handleOverlayReportError);
  
  // Overlay control handlers
  ipcMain.handle('overlay:control-translation', handleOverlayControlTranslation);
  ipcMain.handle('overlay:control-bidirectional', handleOverlayControlBidirectional);
  ipcMain.handle('overlay:resize-expanded', handleResizeExpandedOverlay);

  // Mini overlay handlers
  try { ipcMain.removeHandler(MINI_OVERLAY_CHANNELS.AUDIO_DETECTED); } catch {}
  try { ipcMain.removeHandler(MINI_OVERLAY_CHANNELS.VOICE_TRANSLATION); } catch {}
  try { ipcMain.removeHandler(MINI_OVERLAY_CHANNELS.SCREEN_TRANSLATION); } catch {}
  try { ipcMain.removeHandler(MINI_OVERLAY_CHANNELS.STATUS_UPDATE); } catch {}
  try { ipcMain.removeHandler(MINI_OVERLAY_CHANNELS.REPORT_ERROR); } catch {}

  ipcMain.handle(MINI_OVERLAY_CHANNELS.AUDIO_DETECTED, handleMiniOverlayAudioDetected);
  ipcMain.handle(MINI_OVERLAY_CHANNELS.VOICE_TRANSLATION, handleMiniOverlayVoiceTranslation);
  ipcMain.handle(MINI_OVERLAY_CHANNELS.SCREEN_TRANSLATION, handleMiniOverlayScreenTranslation);
  ipcMain.handle(MINI_OVERLAY_CHANNELS.STATUS_UPDATE, handleMiniOverlayStatusUpdate);
  ipcMain.handle(MINI_OVERLAY_CHANNELS.REPORT_ERROR, handleMiniOverlayReportError);

  // Tutorial status handler
  try { ipcMain.removeHandler('tutorial:is-active'); } catch {}
  ipcMain.handle('tutorial:is-active', async () => {
    try {
      // Send message to renderer to check tutorial status
      const mainWindow = BrowserWindow.getAllWindows().find(win => 
        !win.isDestroyed() && win.getTitle() === 'Whispra'
      );
      
      if (mainWindow) {
        return await mainWindow.webContents.executeJavaScript(`
          (async () => {
            try {
              const { TutorialOverlay } = await import('./ui/TutorialOverlay.js');
              const tutorial = TutorialOverlay.getInstance();
              return tutorial.isCurrentlyActive();
            } catch (error) {
              console.error('Error checking tutorial status:', error);
              return false;
            }
          })()
        `);
      }
      return false;
    } catch (error) {
      console.error('Error checking tutorial status from main process:', error);
      return false;
    }
  });

  // Tutorial completion handler
  try { ipcMain.removeHandler('tutorial:completed'); } catch {}
  ipcMain.handle('tutorial:completed', async () => {
    console.log('🎓 Tutorial completed notification received in main process');
    // This is just for logging - the polling mechanism will detect the change
    return { success: true };
  });

  // Audio and voice handlers for overlay
  ipcMain.handle('audio:get-output-devices', handleGetOutputDevices);
  ipcMain.handle('voices:get-available', handleGetAvailableVoices);

  // Voice activity handlers for real-time overlay updates
  ipcMain.on('overlay:voice-activity', handleVoiceActivityUpdate);
  ipcMain.on('overlay:mic-level-update', handleMicLevelUpdate);
  ipcMain.on('overlay:recording-state', handleRecordingStateUpdate);


  // Forward translation state changes from renderer to overlay windows and mini-overlay
  try { ipcMain.removeAllListeners('translation:state-changed'); } catch {}
  ipcMain.on('translation:state-changed', async (event, data) => {
    console.log('[Main Process] Received translation:state-changed from renderer, forwarding to overlays:', data);

    try {
      // Update mini-overlay indicators based on translation state
      const { SplitOverlayWindowManager } = await import('../services/SplitOverlayWindowManager');
      const windowManager = SplitOverlayWindowManager.getInstance();

      // Update audio detection indicator (red) based on translation state
      windowManager.updateAudioDetected(data.isActive || false);

      // Note: Voice translation indicator (blue) is only controlled by bidirectional state changes
      console.log(`🎯 [Main Process] Updated mini-overlay indicators - Audio: ${data.isActive}`);
    } catch (error) {
      console.error('[Main Process] Error updating mini-overlay indicators:', error);
    }

    // Forward to all overlay windows
    const windows = BrowserWindow.getAllWindows();
    for (const win of windows) {
      if (!win.isDestroyed() && win.webContents !== event.sender) {
        const url = win.webContents.getURL();
        console.log(`📤 [Main Process] Forwarding translation:state-changed to overlay: ${url}`);
        win.webContents.send('translation:state-changed', data);
      }
    }
  });

  // Forward GPU mode changes from overlay to main window
  try { ipcMain.removeAllListeners('overlay:gpu-mode-changed'); } catch {}
  ipcMain.on('overlay:gpu-mode-changed', (event, data) => {
    console.log('⚡ [Main Process] Received GPU mode change from overlay, forwarding to main window:', data);

    // Forward to all windows except sender
    const windows = BrowserWindow.getAllWindows();
    for (const win of windows) {
      if (!win.isDestroyed() && win.webContents !== event.sender) {
        win.webContents.send('gpu-mode-changed', data.mode);
      }
    }
  });

  // Forward GPU mode changes from main window to overlays
  try { ipcMain.removeAllListeners('main:gpu-mode-changed'); } catch {}
  ipcMain.on('main:gpu-mode-changed', (event, data) => {
    console.log('⚡ [Main Process] Received GPU mode change from main window, forwarding to overlays:', data);

    // Forward to all windows except sender
    const windows = BrowserWindow.getAllWindows();
    for (const win of windows) {
      if (!win.isDestroyed() && win.webContents !== event.sender) {
        win.webContents.send('gpu-mode-changed', data.mode);
      }
    }
  });

  // Initialize overlay state manager
  globalOverlayStateManager = OverlayStateManager.getInstance();
  globalOverlayStateManager.initialize();

  // Auth status check - tells renderer if auth is enabled
  try { ipcMain.removeHandler('auth:is-enabled'); } catch {}
  ipcMain.handle('auth:is-enabled', async () => {
    try {
      const { OpenSourceFeatures } = await import('../services/OpenSourceConfig');
      return { 
        success: true, 
        enabled: OpenSourceFeatures.AUTH_ENABLED,
        managedModeEnabled: OpenSourceFeatures.MANAGED_MODE_ENABLED,
        subscriptionCheckingEnabled: OpenSourceFeatures.SUBSCRIPTION_CHECKING_ENABLED
      };
    } catch (error) {
      return { success: false, enabled: false };
    }
  });

  // Auth handlers
  try { ipcMain.removeHandler('auth:start-sign-in'); } catch {}
  try { ipcMain.removeHandler('auth:sign-out'); } catch {}
  ipcMain.handle('auth:start-sign-in', async () => {
    try {
      // Check if auth is enabled first
      const { OpenSourceFeatures } = await import('../services/OpenSourceConfig');
      if (!OpenSourceFeatures.AUTH_ENABLED) {
        return { success: false, error: 'Authentication is disabled in open-source mode' };
      }

      const mgr = AuthManager.getInstance();
      const result = await mgr.beginExternalSignIn();
      return { success: true, port: result.port };
    } catch (error) {
      const { ErrorReportingService } = await import('../services/ErrorReportingService');
      const { ErrorCategory, ErrorSeverity } = await import('../types/ErrorTypes');
      ErrorReportingService.getInstance().captureError(error as Error, {
        category: ErrorCategory.API,
        severity: ErrorSeverity.HIGH,
        component: 'IPC-auth',
        context: { action: 'startSignIn' }
      });
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });
  ipcMain.handle('auth:sign-out', async () => {
    try {
      const mgr = AuthManager.getInstance();
      await mgr.clearToken();
      return { success: true };
    } catch (error) {
      const { ErrorReportingService } = await import('../services/ErrorReportingService');
      const { ErrorCategory, ErrorSeverity } = await import('../types/ErrorTypes');
      ErrorReportingService.getInstance().captureError(error as Error, {
        category: ErrorCategory.API,
        severity: ErrorSeverity.HIGH,
        component: 'IPC-auth',
        context: { action: 'signOut' }
      });
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // Get auth token handler
  try { ipcMain.removeHandler('auth:get-token'); } catch {}
  ipcMain.handle('auth:get-token', async () => {
    try {
      const mgr = AuthManager.getInstance();
      const token = await mgr.getToken();
      return token || null;
    } catch (error) {
      console.error('Failed to get auth token:', error);
      return null;
    }
  });

  // Subscription check handlers - now uses cached data
  try { ipcMain.removeHandler('subscription:check-status'); } catch {}
  ipcMain.handle('subscription:check-status', async () => {
    try {
      const { SubscriptionCacheService } = await import('../services/SubscriptionCacheService');
      const { AuthManager } = await import('../services/AuthManager');

      const subscriptionCache = SubscriptionCacheService.getInstance();
      const cachedData = subscriptionCache.getCachedData();

      if (!cachedData) {
        return {
          success: false,
          error: 'Subscription data not available - cache not initialized'
        };
      }

      // Get user ID from Supabase service
      const { SupabaseService } = await import('../services/SupabaseService');
      const supabaseService = SupabaseService.getInstance();
      const userId = await supabaseService.getCurrentUserId();

      return {
        success: true,
        hasActiveSubscription: cachedData.hasActiveSubscription,
        userId
      };
    } catch (error) {
      console.error('Error getting cached subscription status:', error);
      const { ErrorReportingService } = await import('../services/ErrorReportingService');
      const { ErrorCategory, ErrorSeverity } = await import('../types/ErrorTypes');
      ErrorReportingService.getInstance().captureError(error as Error, {
        category: ErrorCategory.API,
        severity: ErrorSeverity.MEDIUM,
        component: 'IPC-subscription',
        context: { action: 'checkStatus' }
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  // Check user access (trial + subscription) - now uses cached data
  try { ipcMain.removeHandler('subscription:check-access'); } catch {}
  ipcMain.handle('subscription:check-access', async () => {
    try {
      const { SubscriptionCacheService } = await import('../services/SubscriptionCacheService');
      
      const subscriptionCache = SubscriptionCacheService.getInstance();
      const cachedData = subscriptionCache.getCachedData();

      if (!cachedData) {
        return {
          success: false,
          error: 'Subscription data not available - cache not initialized'
        };
      }

      return {
        success: true,
        hasAccess: cachedData.hasAccess,
        hasActiveSubscription: cachedData.hasActiveSubscription,
        hasManagedAPI: cachedData.hasManagedAPI,
        subscriptionPlan: cachedData.subscriptionPlan,
        subscriptionStatus: cachedData.subscriptionStatus,
        planTier: cachedData.planTier, // Add planTier for compatibility
        expiresAt: cachedData.expiresAt,
        isTrialActive: cachedData.isTrialActive,
        trialDaysRemaining: cachedData.trialDaysRemaining
      };
    } catch (error) {
      console.error('Error getting cached user access:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  // Force refresh subscription cache - for specific scenarios only
  try { ipcMain.removeHandler('subscription:force-refresh'); } catch {}
  ipcMain.handle('subscription:force-refresh', async (event, reason: string) => {
    try {
      const { SubscriptionCacheService } = await import('../services/SubscriptionCacheService');
      
      const subscriptionCache = SubscriptionCacheService.getInstance();
      const refreshedData = await subscriptionCache.forceRefresh(reason);

      if (!refreshedData) {
        return {
          success: false,
          error: 'Failed to refresh subscription data'
        };
      }

      return {
        success: true,
        ...refreshedData
      };
    } catch (error) {
      console.error('Error force refreshing subscription cache:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  // Handle token changes
  try { ipcMain.removeHandler('subscription:token-changed'); } catch {}
  ipcMain.handle('subscription:token-changed', async (event, newToken: string | null) => {
    try {
      const { SubscriptionCacheService } = await import('../services/SubscriptionCacheService');
      
      const subscriptionCache = SubscriptionCacheService.getInstance();
      await subscriptionCache.onTokenChange(newToken);

      return { success: true };
    } catch (error) {
      console.error('Error handling token change:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  // Handle API key changes
  try { ipcMain.removeHandler('subscription:api-keys-changed'); } catch {}
  ipcMain.handle('subscription:api-keys-changed', async () => {
    try {
      const { SubscriptionCacheService } = await import('../services/SubscriptionCacheService');
      
      const subscriptionCache = SubscriptionCacheService.getInstance();
      await subscriptionCache.onApiKeysChanged();

      return { success: true };
    } catch (error) {
      console.error('Error handling API keys change:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  // Handle managed mode changes
  try { ipcMain.removeHandler('subscription:managed-mode-changed'); } catch {}
  ipcMain.handle('subscription:managed-mode-changed', async () => {
    try {
      const { SubscriptionCacheService } = await import('../services/SubscriptionCacheService');
      
      const subscriptionCache = SubscriptionCacheService.getInstance();
      await subscriptionCache.onManagedModeChanged();

      return { success: true };
    } catch (error) {
      console.error('Error handling managed mode change:', error);
      const { ErrorReportingService } = await import('../services/ErrorReportingService');
      const { ErrorCategory, ErrorSeverity } = await import('../types/ErrorTypes');
      ErrorReportingService.getInstance().captureError(error as Error, {
        category: ErrorCategory.API,
        severity: ErrorSeverity.MEDIUM,
        component: 'IPC-subscription',
        context: { action: 'checkAccess' }
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  // Refresh subscription status (for plan updates)
  try { ipcMain.removeHandler('subscription:refresh'); } catch {}
  ipcMain.handle('subscription:refresh', async () => {
    try {
      const { SupabaseService } = await import('../services/SupabaseService');
      const { AuthManager } = await import('../services/AuthManager');

      const authManager = AuthManager.getInstance();
      const userToken = await authManager.getToken();

      if (!userToken) {
        return {
          success: false,
          error: 'No authentication token found'
        };
      }

      const supabaseService = SupabaseService.getInstance();
      await supabaseService.setUserToken(userToken);

      // Refresh subscription status (this will detect plan changes)
      const accessStatus = await supabaseService.refreshSubscriptionStatus();

      if (!accessStatus) {
        return {
          success: false,
          error: 'Failed to refresh subscription status'
        };
      }

      return {
        success: true,
        ...accessStatus
      };
    } catch (error) {
      console.error('Error refreshing subscription status:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  // Force subscription check (will sign out if expired)
  try { ipcMain.removeHandler('subscription:force-check'); } catch {}
  ipcMain.handle('subscription:force-check', async () => {
    try {
      console.log('🔍 [IPC] Force subscription check requested');
      const { SupabaseService } = await import('../services/SupabaseService');
      const { AuthManager } = await import('../services/AuthManager');

      const authManager = AuthManager.getInstance();
      const userToken = await authManager.getToken();

      if (!userToken) {
        return {
          success: false,
          error: 'No authentication token found'
        };
      }

      const supabaseService = SupabaseService.getInstance();
      await supabaseService.setUserToken(userToken);

      // Force check - this will sign out if expired
      const accessStatus = await supabaseService.forceSubscriptionCheck();

      if (!accessStatus) {
        return {
          success: false,
          error: 'Failed to force subscription check'
        };
      }

      return {
        success: true,
        ...accessStatus
      };
    } catch (error) {
      console.error('❌ [IPC] Error forcing subscription check:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  // Get trial info from stored token
  try { ipcMain.removeHandler('auth:get-trial-info'); } catch {}
  ipcMain.handle('auth:get-trial-info', async () => {
    try {
      const { AuthManager } = await import('../services/AuthManager');
      const authManager = AuthManager.getInstance();
      const trialInfo = await authManager.getTrialInfo();

      return {
        success: true,
        trialInfo
      };
    } catch (error) {
      console.error('Error getting trial info:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  // Get current user ID for debugging
  try { ipcMain.removeHandler('subscription:get-user-id'); } catch {}
  ipcMain.handle('subscription:get-user-id', async () => {
    try {
      const { SupabaseService } = await import('../services/SupabaseService');
      const { AuthManager } = await import('../services/AuthManager');
      
      const authManager = AuthManager.getInstance();
      const userToken = await authManager.getToken();
      
      if (!userToken) {
        return { 
          success: false, 
          error: 'No authentication token found' 
        };
      }
      
      const supabaseService = SupabaseService.getInstance();
      await supabaseService.setUserToken(userToken);
      
      // Initialize managed API services with user token
      try {
        const { ManagedApiSubscriptionService } = await import('../services/ManagedApiSubscriptionService');
        const managedApiService = ManagedApiSubscriptionService.getInstance();
        await managedApiService.initialize(userToken);
        console.log('✅ Managed API services initialized with user token');
      } catch (error) {
        console.warn('⚠️ Failed to initialize managed API services:', error);
      }
      
      const userId = await supabaseService.getCurrentUserId();
      
      return { 
        success: true, 
        userId
      };
    } catch (error) {
      console.error('Error getting user ID:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  });

  // Get managed API usage
  try { ipcMain.removeHandler('subscription:get-usage'); } catch {}
  ipcMain.handle('subscription:get-usage', async () => {
    try {
      const { BackendConfig, isManagedModeConfigured } = await import('../services/OpenSourceConfig');
      
      // Check if managed mode is configured
      if (!isManagedModeConfigured() || !BackendConfig.MANAGED_API_URL) {
        return { 
          success: true,
          usage: {
            totalCost: 0,
            remainingBalance: Infinity,
            usageLimit: Infinity,
            isLimitExceeded: false,
            message: 'Usage tracking not available in open-source mode'
          }
        };
      }

      const { AuthManager } = await import('../services/AuthManager');
      
      const authManager = AuthManager.getInstance();
      const userToken = await authManager.getToken();
      
      if (!userToken) {
        return { 
          success: false, 
          error: 'No authentication token found' 
        };
      }

      // Call backend API to get usage
      const response = await fetch(`${BackendConfig.MANAGED_API_URL}/usage/current`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${userToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      return { 
        success: true,
        usage: data
      };
    } catch (error) {
      console.error('Error getting usage:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        // Return mock data for development
        usage: {
          totalCost: 0,
          remainingBalance: 10.00,
          usageLimit: 10.00,
          isLimitExceeded: false
        }
      };
    }
  });

  // Device check handlers
  try { ipcMain.removeHandler('device-check:complete'); } catch {}
  ipcMain.handle('device-check:complete', async (event: IpcMainInvokeEvent, deviceCheckResult?: { hasCableInput: boolean; hasCableOutput: boolean; isComplete: boolean }) => {
    console.log('🔍 Device check complete handler called with result:', deviceCheckResult);
    try {
      console.log('✅ Device check completed successfully');
      console.log('🔍 Importing DeviceCheckOverlayManager...');
      
      // Import and use the device check overlay manager
      const { DeviceCheckOverlayManager } = await import('../services/DeviceCheckOverlayManager');
      const deviceCheckManager = DeviceCheckOverlayManager.getInstance();
      
      console.log('🔍 Calling deviceCheckManager.closeDeviceCheckOverlay()...');
      // Close the device check overlay
      deviceCheckManager.closeDeviceCheckOverlay();
      
      // Only show platform-specific audio setup overlay if virtual audio device is NOT detected and user hasn't seen it yet
      const shouldShowAudioSetup = deviceCheckResult && !deviceCheckResult.isComplete;
      console.log('🔊 Should show audio setup overlay:', shouldShowAudioSetup, 'Device check result:', deviceCheckResult);

      if (shouldShowAudioSetup) {
        // Small delay to ensure device check overlay is fully closed
        setTimeout(async () => {
          try {
            if (process.platform === 'darwin') {
              // macOS: Show BlackHole setup overlay
              const { BlackHoleSetupOverlayManager } = await import('../services/BlackHoleSetupOverlayManager');
              const blackHoleSetupManager = BlackHoleSetupOverlayManager.getInstance();
              await blackHoleSetupManager.showBlackHoleSetupOverlay(false); // Don't force, check if user has seen it
              console.log('🔊 BlackHole setup overlay shown because BlackHole not detected');
            } else {
              // Windows: Show VB-Audio setup overlay
              const { VbAudioSetupOverlayManager } = await import('../services/VbAudioSetupOverlayManager');
              const vbAudioSetupManager = VbAudioSetupOverlayManager.getInstance();
              await vbAudioSetupManager.showVbAudioSetupOverlay(false); // Don't force, check if user has seen it
              console.log('🔊 VB Audio setup overlay shown because VB Cable not detected');
            }
          } catch (error) {
            console.warn('⚠️ Could not show audio setup overlay:', error);
          }
        }, 500);
      } else {
        console.log('🔊 Audio setup overlay not needed - Virtual audio device detected or no result provided');
      }
      
      console.log('🔍 Device check complete handler finished');
      return { success: true };
    } catch (error) {
      console.error('❌ Error in device-check:complete handler:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  try { ipcMain.removeHandler('open-external'); } catch {}
  ipcMain.handle('open-external', async (event: IpcMainInvokeEvent, url: string) => {
    try {
      await shell.openExternal(url);
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // Get configured URLs for renderer processes
  try { ipcMain.removeHandler('config:get-urls'); } catch {}
  ipcMain.handle('config:get-urls', async () => {
    try {
      const { BackendConfig, getServiceUrl, OpenSourceFeatures } = await import('../services/OpenSourceConfig');
      return {
        success: true,
        urls: {
          account: getServiceUrl('account'),
          website: getServiceUrl('website'),
          api: getServiceUrl('api'),
        },
        features: {
          authEnabled: OpenSourceFeatures.AUTH_ENABLED,
          managedModeEnabled: OpenSourceFeatures.MANAGED_MODE_ENABLED,
        }
      };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  try { ipcMain.removeHandler('open-sound-settings'); } catch {}
  ipcMain.handle('open-sound-settings', async () => {
    try {
      if (process.platform === 'darwin') {
        // Open macOS Sound Settings
        // Use AppleScript to open System Settings > Sound
        const { exec } = require('child_process');
        exec('open "x-apple.systempreferences:com.apple.Sound-Settings.extension"');
      } else {
        // Open Windows Sound Settings
        await shell.openExternal('ms-settings:sound');
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  try { ipcMain.removeHandler('open-audio-midi-setup'); } catch {}
  ipcMain.handle('open-audio-midi-setup', async () => {
    try {
      if (process.platform === 'darwin') {
        // Open Audio MIDI Setup app on macOS
        const { exec } = require('child_process');
        exec('open -a "Audio MIDI Setup"');
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  try { ipcMain.removeHandler('run-diagnostic'); } catch {}
  ipcMain.handle('run-diagnostic', async () => {
    try {
      const { spawn } = require('child_process');
      const path = require('path');
      
      // Run the Windows 11 diagnostic script
      const scriptPath = path.join(__dirname, '../debug-windows11-audio-devices.js');
      
      return new Promise((resolve, reject) => {
        const diagnostic = spawn('node', [scriptPath], {
          stdio: 'inherit', // This will show output in the console
          shell: true
        });
        
        diagnostic.on('close', (code: number | null) => {
          if (code === 0) {
            resolve({ success: true, message: 'Diagnostic completed successfully' });
          } else {
            reject(new Error(`Diagnostic failed with exit code ${code}`));
          }
        });
        
        diagnostic.on('error', (error: Error) => {
          reject(error);
        });
      });
    } catch (error) {
      console.error('Error running diagnostic:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // VB Audio setup handlers
  try { ipcMain.removeHandler('vb-audio-setup:close'); } catch {}
  ipcMain.handle('vb-audio-setup:close', async () => {
    try {
      const { VbAudioSetupOverlayManager } = require('../services/VbAudioSetupOverlayManager');
      const overlayManager = VbAudioSetupOverlayManager.getInstance();
      overlayManager.closeVbAudioSetupOverlay();
      return { success: true };
    } catch (error) {
      console.error('Error closing VB Audio setup overlay:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  try { ipcMain.removeHandler('vb-audio-setup:set-shown'); } catch {}
  ipcMain.handle('vb-audio-setup:set-shown', async (event: IpcMainInvokeEvent, shown: boolean) => {
    try {
      const { VbAudioSetupOverlayManager } = require('../services/VbAudioSetupOverlayManager');
      const overlayManager = VbAudioSetupOverlayManager.getInstance();
      overlayManager.setUserHasSeenSetup(shown);
      return { success: true };
    } catch (error) {
      console.error('Error setting VB Audio setup shown status:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  try { ipcMain.removeHandler('vb-audio-setup:show'); } catch {}
  ipcMain.handle('vb-audio-setup:show', async () => {
    try {
      // Show platform-specific audio setup overlay
      if (process.platform === 'darwin') {
        // macOS: Show BlackHole setup overlay
        const { BlackHoleSetupOverlayManager } = require('../services/BlackHoleSetupOverlayManager');
        const overlayManager = BlackHoleSetupOverlayManager.getInstance();
        await overlayManager.showBlackHoleSetupOverlay(true); // Force show when called from menu
      } else {
        // Windows: Show VB-Audio setup overlay
        const { VbAudioSetupOverlayManager } = require('../services/VbAudioSetupOverlayManager');
        const overlayManager = VbAudioSetupOverlayManager.getInstance();
        await overlayManager.showVbAudioSetupOverlay(true); // Force show when called from menu
      }
      return { success: true };
    } catch (error) {
      console.error('Error showing VB Audio setup overlay:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // API setup handlers
  try { ipcMain.removeHandler('api-setup:close'); } catch {}
  ipcMain.handle('api-setup:close', async () => {
    try {
      const { ApiSetupOverlayManager } = require('../services/ApiSetupOverlayManager');
      const overlayManager = ApiSetupOverlayManager.getInstance();
      overlayManager.closeApiSetupOverlay();
      return { success: true };
    } catch (error) {
      console.error('Error closing API setup overlay:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  try { ipcMain.removeHandler('api-setup:show'); } catch {}
  ipcMain.handle('api-setup:show', async () => {
    try {
      const { ApiSetupOverlayManager } = require('../services/ApiSetupOverlayManager');
      const overlayManager = ApiSetupOverlayManager.getInstance();
      await overlayManager.showApiSetupOverlay();
      return { success: true };
    } catch (error) {
      console.error('Error showing API setup overlay:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // Python check handlers
  try { ipcMain.removeHandler('python-check:check-version'); } catch {}
  ipcMain.handle('python-check:check-version', async () => {
    try {
      console.log('🐍 Checking Python version...');
      
      // Import and use the Python check overlay manager
      const { PythonCheckOverlayManager } = await import('../services/PythonCheckOverlayManager');
      const pythonCheckManager = PythonCheckOverlayManager.getInstance();
      
      const result = await pythonCheckManager.checkPythonVersion();
      console.log('🐍 Python check result:', result);
      
      return { success: true, ...result };
    } catch (error) {
      console.error('❌ Error in python-check:check-version handler:', error);
      return { 
        success: false, 
        hasCorrectVersion: false,
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  });

  try { ipcMain.removeHandler('python-check:download-install'); } catch {}
  ipcMain.handle('python-check:download-install', async () => {
    try {
      console.log('🐍 Starting Python download and installation...');
      
      // Import and use the Python check overlay manager
      const { PythonCheckOverlayManager } = await import('../services/PythonCheckOverlayManager');
      const pythonCheckManager = PythonCheckOverlayManager.getInstance();
      
      const result = await pythonCheckManager.downloadAndInstallPython();
      console.log('🐍 Python installation result:', result);
      
      return result;
    } catch (error) {
      console.error('❌ Error in python-check:download-install handler:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  });

  try { ipcMain.removeHandler('python-check:complete'); } catch {}
  ipcMain.handle('python-check:complete', async (event: IpcMainInvokeEvent, data: { cancelled: boolean }) => {
    try {
      console.log('🐍 Python check completed:', data);
      
      // Import and use the Python check overlay manager
      const { PythonCheckOverlayManager } = await import('../services/PythonCheckOverlayManager');
      const pythonCheckManager = PythonCheckOverlayManager.getInstance();
      
      // Close the Python check overlay
      pythonCheckManager.closePythonCheckOverlay();
      
      console.log('🐍 Python check complete handler finished');
      return { success: true, cancelled: data.cancelled };
    } catch (error) {
      console.error('❌ Error in python-check:complete handler:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // Listen for python check overlay show requests
  ipcMain.on('python-check:show-overlay', async () => {
    try {
      console.log('🐍 Received request to show Python check overlay');
      
      // Import and use the Python check overlay manager
      const { PythonCheckOverlayManager } = await import('../services/PythonCheckOverlayManager');
      const pythonCheckManager = PythonCheckOverlayManager.getInstance();
      
      // Show the Python check overlay
      await pythonCheckManager.showPythonCheckOverlay();
      
    } catch (error) {
      console.error('❌ Error showing Python check overlay:', error);
    }
  });

  // Get audio settings for soundboard overlay
  try { ipcMain.removeHandler('get-audio-settings'); } catch {}
  ipcMain.handle('get-audio-settings', async () => {
    try {
      // Use the existing soundboard service to get settings
      const { getSoundboardService } = require('../soundboard/soundboard-ipc');
      const service = getSoundboardService();
      
      if (!service) {
        throw new Error('Soundboard service not available');
      }
      
      const settings = service.getSettings();
      
      return {
        masterVolume: settings.masterVolume || 0.7,
        headphonesVolume: settings.headphonesVolume || 0.5,
        outputDevice: settings.outputDevice || '',
        success: true
      };
    } catch (error) {
      console.warn('Failed to get audio settings from soundboard service:', error);
      // Return default settings if unable to get from backend
      return {
        masterVolume: 0.7,
        headphonesVolume: 0.5,
        outputDevice: '',
        success: true
      };
    }
  });

  // Bidirectional logging and state (renderer → main for terminal visibility)
  ipcMain.handle('bidirectional:state', async (event: IpcMainInvokeEvent, request: IPCRequest<{ action: string; details?: any }>) => {
    try {
      const { action, details } = request.payload || { action: 'unknown' };
      
      if (action === 'get-status') {
        // Return current bidirectional status
        return { 
          id: request.id, 
          timestamp: Date.now(), 
          success: true,
          payload: {
            isActive: false, // For now, bidirectional is not implemented
            currentStep: 'idle'
          }
        };
      }
      
      console.log(`[Bidirectional] ${action}`, details || '');
      return { id: request.id, timestamp: Date.now(), success: true };
    } catch (error) {
      return { id: request.id, timestamp: Date.now(), success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });
  ipcMain.handle('bidirectional:log', async (event: IpcMainInvokeEvent, request: IPCRequest<{ level?: 'info'|'warn'|'error'; message: string; data?: any }>) => {
    try {
      const { level = 'info', message, data } = request.payload || { message: '' };
      const tag = level.toUpperCase();
      if (level === 'error') console.error(`[Bidirectional][${tag}] ${message}`, data || '');
      else if (level === 'warn') console.warn(`[Bidirectional][${tag}] ${message}`, data || '');
      else console.log(`[Bidirectional][${tag}] ${message}`, data || '');
      return { id: request.id, timestamp: Date.now(), success: true };
    } catch (error) {
      return { id: request.id, timestamp: Date.now(), success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });



  // Bidirectional start handler for overlay
  try { ipcMain.removeHandler('bidirectional:start'); } catch {}
  ipcMain.handle('bidirectional:start', async (event: IpcMainInvokeEvent, request: IPCRequest<{ outputDevice?: string; incomingVoiceId?: string; captureSource?: string; autoDetectLanguage?: boolean }>) => {
    try {
      console.log('🔄 [Main Process] Starting bidirectional from overlay...', request.payload);
      
      // Initialize Real-Time API client if fast mode is enabled
      const configManager = ConfigurationManager.getInstance();
      const config = configManager.getConfig();
      const optimization = config.uiSettings?.bidirectionalOptimization;
      const modelConfig = getModelConfigFromConfig(config);
      const gptModel = modelConfig?.gptModel || 'openai';
      
      // Only enable Real-Time API if fast mode AND not using Argos (Argos doesn't support Real-Time API)
      if (optimization?.translationSpeed === 'fast' && gptModel !== 'argos') {
        try {
          const { OpenAIRealTimeClient } = await import('../services/OpenAIRealTimeClient');
          const { ApiKeyManager } = await import('../services/ApiKeyManager');
          const apiKeyManager = ApiKeyManager.getInstance();
          
          bidirectionalRealTimeClient = new OpenAIRealTimeClient(apiKeyManager, {
            voice: 'alloy',
            instructions: 'You are a real-time translation assistant. Translate speech accurately and naturally.'
          });
          
          // Set up event handlers
          bidirectionalRealTimeClient.on('transcription', (text: string) => {
            console.log(`[Real-Time] Transcription: ${text}`);
          });
          
          bidirectionalRealTimeClient.on('audioDelta', (audio: string) => {
            // Decode base64 audio and send to renderer for playback
            const audioBuffer = Buffer.from(audio, 'base64');
            const audioArray = Array.from(new Uint8Array(audioBuffer));
            
            // Send to renderer for playback
            const mainWindow = BrowserWindow.getAllWindows().find(w => !w.isDestroyed());
            if (mainWindow) {
              mainWindow.webContents.send('realtime-translation-audio', {
                audioData: audioArray,
                isRealTime: true
              });
            }
          });
          
          await bidirectionalRealTimeClient.connect();
          console.log('✅ OpenAI Real-Time API connected for bidirectional mode');
        } catch (error) {
          console.error('❌ Failed to initialize Real-Time API:', error);
        }
      }
      
      // Update bidirectional state
      getOverlayStateManager().updateBidirectionalState({
        isEnabled: true,
        isProcessingAudio: false,
        outputDevice: request.payload?.outputDevice || ''
      });

      // Update mini overlay blue indicator - bidirectional is running
      try {
        const { SplitOverlayWindowManager } = await import('../services/SplitOverlayWindowManager');
        SplitOverlayWindowManager.getInstance().updateVoiceTranslation(true);
      } catch (error) {
        console.error('Failed to update mini overlay bidirectional indicator:', error);
      }

      // Broadcast bidirectional state change to all overlay windows
      const windows = BrowserWindow.getAllWindows();
      for (const win of windows) {
        if (!win.isDestroyed()) {
          win.webContents.send('overlay:bidirectional-state-update', {
            isEnabled: true,
            isProcessingAudio: false
          });
        }
      }
      
      // Forward to main renderer for actual bidirectional implementation
      const mainWindow = windows.find(win => !win.isDestroyed() && win.webContents.getURL().includes('index.html'));
      if (mainWindow) {
        mainWindow.webContents.send('overlay:control-bidirectional', {
          action: 'start',
          config: request.payload
        });
      }
      
      console.log('✅ Bidirectional started successfully from overlay');
      return { id: request.id, timestamp: Date.now(), success: true };
    } catch (error) {
      console.error('❌ Failed to start bidirectional from overlay:', error);
      return { id: request.id, timestamp: Date.now(), success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // Audio detection handler from renderer
  try { ipcMain.removeHandler('overlay:audio-detected'); } catch {}
  ipcMain.handle('overlay:audio-detected', async (event: IpcMainInvokeEvent, request: IPCRequest<{ isDetected: boolean }>) => {
    try {
      const { SplitOverlayWindowManager } = await import('../services/SplitOverlayWindowManager');
      SplitOverlayWindowManager.getInstance().updateAudioDetected(request.payload?.isDetected ?? false);
      return { id: request.id, timestamp: Date.now(), success: true };
    } catch (error) {
      console.error('Failed to update audio detection indicator:', error);
      return { id: request.id, timestamp: Date.now(), success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // Show mini overlay handler
  try { ipcMain.removeHandler('overlay:show-minimal'); } catch {}
  ipcMain.handle('overlay:show-minimal', async (event: IpcMainInvokeEvent, request: IPCRequest<void>) => {
    try {
      console.log('📱 [Main Process] Showing mini overlay...');
      const { SplitOverlayWindowManager } = await import('../services/SplitOverlayWindowManager');
      const manager = SplitOverlayWindowManager.getInstance();

      // Create mini overlay if it doesn't exist
      if (!manager.getMiniOverlayWindow() || manager.getMiniOverlayWindow()?.isDestroyed()) {
        console.log('📱 Creating mini overlay window first...');
        await manager.createMiniOverlay();
      }

      // Now show it
      manager.showMiniOverlay();

      // Synchronize current state to the mini overlay after showing it
      // This ensures the overlay displays the correct indicator states even when
      // it's auto-opened (e.g., after bidirectional runs for 10 seconds)
      const overlayState = getOverlayStateManager().getCurrentState();
      console.log('📱 Syncing bidirectional state to mini overlay:', overlayState.bidirectionalState.isEnabled);
      manager.updateVoiceTranslation(overlayState.bidirectionalState.isEnabled);

      console.log('✅ Mini overlay shown successfully');
      return { id: request.id, timestamp: Date.now(), success: true };
    } catch (error) {
      console.error('Failed to show mini overlay:', error);
      return { id: request.id, timestamp: Date.now(), success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // Hide mini overlay handler
  try { ipcMain.removeHandler('overlay:hide-minimal'); } catch {}
  ipcMain.handle('overlay:hide-minimal', async (event: IpcMainInvokeEvent, request: IPCRequest<void>) => {
    try {
      console.log('📱 [Main Process] Hiding mini overlay...');
      const { SplitOverlayWindowManager } = await import('../services/SplitOverlayWindowManager');
      const manager = SplitOverlayWindowManager.getInstance();
      manager.hideMiniOverlay();
      console.log('✅ Mini overlay hidden successfully');
      return { id: request.id, timestamp: Date.now(), success: true };
    } catch (error) {
      console.error('Failed to hide mini overlay:', error);
      return { id: request.id, timestamp: Date.now(), success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // Bidirectional stop handler for overlay
  try { ipcMain.removeHandler('bidirectional:stop'); } catch {}
  ipcMain.handle('bidirectional:stop', async (event: IpcMainInvokeEvent, request: IPCRequest<void>) => {
    try {
      console.log('🛑 [Main Process] Stopping bidirectional from overlay...');
      
      // Disconnect Real-Time API client if active
      if (bidirectionalRealTimeClient) {
        try {
          bidirectionalRealTimeClient.disconnect();
          bidirectionalRealTimeClient = null;
          console.log('✅ Real-Time API disconnected');
        } catch (error) {
          console.error('❌ Error disconnecting Real-Time API:', error);
        }
      }
      
      // Update bidirectional state
      getOverlayStateManager().updateBidirectionalState({
        isEnabled: false,
        isProcessingAudio: false,
        outputDevice: ''
      });

      // Update mini overlay blue indicator - bidirectional stopped
      try {
        const { SplitOverlayWindowManager } = await import('../services/SplitOverlayWindowManager');
        SplitOverlayWindowManager.getInstance().updateVoiceTranslation(false);
      } catch (error) {
        console.error('Failed to update mini overlay bidirectional indicator:', error);
      }

      // Broadcast bidirectional state change to all overlay windows
      const windows = BrowserWindow.getAllWindows();
      for (const win of windows) {
        if (!win.isDestroyed()) {
          win.webContents.send('overlay:bidirectional-state-update', {
            isEnabled: false,
            isProcessingAudio: false
          });
        }
      }
      
      // Forward to main renderer for actual bidirectional implementation
      const mainWindow = windows.find(win => !win.isDestroyed() && win.webContents.getURL().includes('index.html'));
      if (mainWindow) {
        mainWindow.webContents.send('overlay:control-bidirectional', {
          action: 'stop'
        });
      }
      
      console.log('✅ Bidirectional stopped successfully from overlay');
      return { id: request.id, timestamp: Date.now(), success: true };
    } catch (error) {
      console.error('❌ Failed to stop bidirectional from overlay:', error);
      return { id: request.id, timestamp: Date.now(), success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // Overlay control handlers
  async function handleOverlayControlTranslation(event: IpcMainInvokeEvent, request: IPCRequest<{ action: string; config?: any }>) {
    try {
      const { action, config } = request.payload || { action: 'unknown' };
      console.log(`🎮 [Main Process] Overlay control translation: ${action}`, config ? 'with config' : '');
      
      // Send the control command to the main app's renderer process
      const windows = BrowserWindow.getAllWindows();
      let sentToWindow = false;
      for (const win of windows) {
        if (!win.isDestroyed() && win.webContents.getURL().includes('index.html')) {
          console.log(`📤 [Main Process] Sending ${action} to main renderer window`);
          win.webContents.send('overlay:control-translation', { action, config });
          sentToWindow = true;
        }
      }
      
      if (!sentToWindow) {
        console.warn('⚠️ [Main Process] No main renderer window found to send translation control to');
      }
      
      return { id: request.id, timestamp: Date.now(), success: true };
    } catch (error) {
      console.error('❌ Error handling overlay translation control:', error);
      return { id: request.id, timestamp: Date.now(), success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async function handleOverlayControlBidirectional(event: IpcMainInvokeEvent, request: IPCRequest<{ action: string; selectedSource?: any }>) {
    try {
      const { action, selectedSource } = request.payload || { action: 'unknown' };
      console.log(`🎮 Overlay control bidirectional: ${action}`, selectedSource ? `with source: ${selectedSource.name}` : '');

      // Send the control command to the main app's renderer process
      const windows = BrowserWindow.getAllWindows();
      for (const win of windows) {
        if (!win.isDestroyed()) {
          win.webContents.send('overlay:control-bidirectional', { action, selectedSource });
        }
      }

      return { id: request.id, timestamp: Date.now(), success: true };
    } catch (error) {
      console.error('❌ Error handling overlay bidirectional control:', error);
      return { id: request.id, timestamp: Date.now(), success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async function handleResizeExpandedOverlay(event: IpcMainInvokeEvent, request: IPCRequest<{ width: number; height: number }>) {
    try {
      const { width, height } = request.payload || { width: 520, height: 420 };
      console.log(`📏 [Main Process] Resizing expanded overlay to ${width}x${height}`);

      // Get the SplitOverlayWindowManager instance and resize the expanded overlay
      const { SplitOverlayWindowManager } = await import('../services/SplitOverlayWindowManager');
      const overlayManager = SplitOverlayWindowManager.getInstance();
      overlayManager.resizeExpandedOverlay(width, height);

      return { id: request.id, timestamp: Date.now(), success: true };
    } catch (error) {
      console.error('❌ Error resizing expanded overlay:', error);
      return { id: request.id, timestamp: Date.now(), success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }



  // Update handlers
  const updaterService = AutoUpdaterService.getInstance();
  
  try { ipcMain.removeHandler('updater:check-for-updates'); } catch {}
  ipcMain.handle('updater:check-for-updates', async () => {
    try {
      await updaterService.checkForUpdates();
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  try { ipcMain.removeHandler('updater:download-update'); } catch {}
  ipcMain.handle('updater:download-update', async () => {
    try {
      await updaterService.downloadUpdate();
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  try { ipcMain.removeHandler('updater:install-update'); } catch {}
  ipcMain.handle('updater:install-update', async () => {
    try {
      updaterService.quitAndInstall();
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  try { ipcMain.removeHandler('updater:get-status'); } catch {}
  ipcMain.handle('updater:get-status', async () => {
    try {
      const status = updaterService.getUpdateStatus();
      return { success: true, data: status };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // What's New overlay handlers
  const whatsNewManager = WhatsNewOverlayManager.getInstance();

  try { ipcMain.removeHandler('whats-new:show'); } catch {}
  ipcMain.handle('whats-new:show', async (_event, version?: string) => {
    try {
      await whatsNewManager.showWhatsNewOverlay(version);
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  try { ipcMain.removeHandler('whats-new:close'); } catch {}
  ipcMain.handle('whats-new:close', async () => {
    try {
      whatsNewManager.closeWhatsNewOverlay();
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // File system read handler for localization
  try { ipcMain.removeHandler('fs:read-file'); } catch {}
  ipcMain.handle('fs:read-file', async (_event, request: IPCRequest<{ path: string }>) => {
    try {
      console.log('[Main] ===== fs:read-file IPC handler called =====');
      console.log('[Main] fs:read-file IPC handler called with request:', request);
      const { path: filePath } = request.payload;
      if (!filePath) {
        return { success: false, error: 'No file path provided' };
      }

      console.log('[Main] fs:read-file - File path requested:', filePath);

      // Security: Only allow reading files from the app's directory and subdirectories
      const appPath = app.getAppPath();
      console.log('[Main] fs:read-file - App path:', appPath);

      // In development, look in the source directory; in production, look in the app directory
      let basePath: string;
      if (appPath.includes('dist')) {
        // Development mode - look in the parent directory's src folder
        basePath = path.resolve(appPath, '..', 'src');
      } else {
        // Production mode - look in the app directory
        basePath = path.resolve(appPath, 'src');
      }
      
      // Always look in locales directory for translation files
      const resolvedPath = path.resolve(basePath, 'locales', filePath);
      console.log('[Main] fs:read-file - Resolved path:', resolvedPath);

      // Ensure the resolved path is within the project directory (allow parent access in development)
      const projectRoot = appPath.includes('dist') ? path.resolve(appPath, '..') : appPath;
      if (!resolvedPath.startsWith(projectRoot)) {
        return { success: false, error: 'Access denied: File path outside project directory' };
      }

      if (!fs.existsSync(resolvedPath)) {
        console.log('[Main] fs:read-file - File does not exist at:', resolvedPath);

        // Try to list the directory to see what's available
        const dirPath = path.dirname(resolvedPath);
        console.log('[Main] fs:read-file - Checking directory:', dirPath);

        if (fs.existsSync(dirPath)) {
          try {
            const files = fs.readdirSync(dirPath);
            console.log('[Main] fs:read-file - Files in directory:', files);
            console.log('[Main] fs:read-file - Looking for file:', path.basename(resolvedPath));
          } catch (dirError) {
            console.log('[Main] fs:read-file - Could not read directory:', dirError);
          }
        } else {
          console.log('[Main] fs:read-file - Directory does not exist:', dirPath);
        }
        return { success: false, error: 'File not found' };
      }

      console.log('[Main] fs:read-file - File exists, reading content...');
      const content = fs.readFileSync(resolvedPath, 'utf8');
      console.log('[Main] fs:read-file - Successfully read file, length:', content.length);
      return { success: true, payload: content };
    } catch (error) {
      console.error('[Main] fs:read-file - Error reading file:', error);
      return { success: false, error: (error as Error).message };
    }
  });

  // Language change notification handler
  try { ipcMain.removeAllListeners('language:changed'); } catch {}
  ipcMain.on('language:changed', async (event, data) => {
    try {
      const { language } = data;
      console.log('[Main] Language change notification received:', language);
      console.log('[Main] Event details:', { sender: event.sender.id, data });

      // Broadcast language change to all windows except the sender
      const windows = BrowserWindow.getAllWindows();
      console.log(`[Main] Found ${windows.length} windows to notify`);

      for (const window of windows) {
        // Send to all windows (including main window) - let the renderer handle filtering
        if (window.webContents) {
          try {
            console.log(`[Main] Sending language change to window:`, window.webContents.id);
            window.webContents.send('onLanguageChange', language);
            console.log('[Main] Sent language change to window successfully');
          } catch (sendError) {
            console.error('[Main] Error sending language change to window:', sendError);
          }
        }
      }
    } catch (error) {
      console.error('[Main] Error handling language change:', error);
    }
  });

  // Background mode handlers
  try { ipcMain.removeHandler('app:minimize-to-tray'); } catch {}
  ipcMain.handle('app:minimize-to-tray', async () => {
    try {
      const { SystemTrayService } = await import('../services/SystemTrayService');
      const trayService = SystemTrayService.getInstance();
      trayService.hideWindowToTray();
      return { success: true };
    } catch (error) {
      console.error('Error minimizing to tray:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  try { ipcMain.removeHandler('app:quit'); } catch {}
  ipcMain.handle('app:quit', async () => {
    try {
      app.isQuitting = true;
      app.quit();
      return { success: true };
    } catch (error) {
      console.error('Error quitting app:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // Captions overlay handlers
  try { ipcMain.removeHandler('captions:updateSettings'); } catch {}
  ipcMain.handle('captions:updateSettings', async (event: IpcMainInvokeEvent, request: IPCRequest<any>) => {
    try {
      const captionsManager = CaptionsOverlayManager.getInstance();
      await captionsManager.updateSettings(request.payload);
      return { success: true };
    } catch (error) {
      console.error('❌ Failed to update captions settings:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  try { ipcMain.removeHandler('captions:updateText'); } catch {}
  ipcMain.handle('captions:updateText', async (event: IpcMainInvokeEvent, request: IPCRequest<{ text: string }>) => {
    try {
      const captionsManager = CaptionsOverlayManager.getInstance();
      await captionsManager.updateCaptions(request.payload.text);
      return { success: true };
    } catch (error) {
      console.error('❌ Failed to update captions text:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  try { ipcMain.removeHandler('captions:clear'); } catch {}
  ipcMain.handle('captions:clear', async (event: IpcMainInvokeEvent, request: IPCRequest<void>) => {
    try {
      const captionsManager = CaptionsOverlayManager.getInstance();
      await captionsManager.clearCaptions();
      return { success: true };
    } catch (error) {
      console.error('❌ Failed to clear captions:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  try { ipcMain.removeHandler('captions:showForSettings'); } catch {}
  ipcMain.handle('captions:showForSettings', async (event: IpcMainInvokeEvent, request: IPCRequest<void>) => {
    try {
      const captionsManager = CaptionsOverlayManager.getInstance();
      await captionsManager.showForSettings();
      return { success: true };
    } catch (error) {
      console.error('❌ Failed to show captions for settings:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  try { ipcMain.removeHandler('captions:resetChunks'); } catch {}
  ipcMain.handle('captions:resetChunks', async (event: IpcMainInvokeEvent, request: IPCRequest<void>) => {
    try {
      const captionsManager = CaptionsOverlayManager.getInstance();
      captionsManager.resetTextChunks();
      return { success: true };
    } catch (error) {
      console.error('❌ Failed to reset captions chunks:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // Menu action handlers
  try { ipcMain.removeHandler('menu:about'); } catch {}
  ipcMain.handle('menu:about', async () => {
    const { MenuService } = await import('../services/MenuService');
    const menuService = MenuService.getInstance();
    menuService.showAboutDialogPublic();
    return { success: true };
  });

  try { ipcMain.removeHandler('menu:check-updates'); } catch {}
  ipcMain.handle('menu:check-updates', async () => {
    const { MenuService } = await import('../services/MenuService');
    const menuService = MenuService.getInstance();
    menuService.checkForUpdatesPublic();
    return { success: true };
  });

  

  try { ipcMain.removeHandler('menu:always-on-top'); } catch {}
  ipcMain.handle('menu:always-on-top', async (_event, checked: boolean) => {
    const { MenuService } = await import('../services/MenuService');
    const menuService = MenuService.getInstance();
    menuService.toggleAlwaysOnTopPublic(checked);
    return { success: true };
  });

  try { ipcMain.removeHandler('menu:quit'); } catch {}
  ipcMain.handle('menu:quit', async () => {
    const { MenuService } = await import('../services/MenuService');
    const menuService = MenuService.getInstance();
    menuService.quitApp();
    return { success: true };
  });

  try { ipcMain.removeHandler('menu:maximize'); } catch {}
  ipcMain.handle('menu:maximize', async () => {
    const { MenuService } = await import('../services/MenuService');
    const menuService = MenuService.getInstance();
    menuService.maximizeWindow();
    return { success: true };
  });

  try { ipcMain.removeHandler('menu:minimize'); } catch {}
  ipcMain.handle('menu:minimize', async () => {
    const { MenuService } = await import('../services/MenuService');
    const menuService = MenuService.getInstance();
    menuService.minimizeWindow();
    return { success: true };
  });

  try { ipcMain.removeHandler('menu:close'); } catch {}
  ipcMain.handle('menu:close', async () => {
    const { MenuService } = await import('../services/MenuService');
    const menuService = MenuService.getInstance();
    menuService.closeWindow();
    return { success: true };
  });

  try { ipcMain.removeHandler('menu:is-maximized'); } catch {}
  ipcMain.handle('menu:is-maximized', async () => {
    const focusedWindow = BrowserWindow.getFocusedWindow();
    return { success: true, payload: { isMaximized: focusedWindow?.isMaximized() || false } };
  });

   // Help menu handlers - Platform-specific audio setup
   try { ipcMain.removeHandler('help:vb-audio-setup'); } catch {}
   ipcMain.handle('help:vb-audio-setup', async () => {
     try {
       // Show platform-specific audio setup overlay
       if (process.platform === 'darwin') {
         // macOS: Show BlackHole setup overlay
         const { BlackHoleSetupOverlayManager } = await import('../services/BlackHoleSetupOverlayManager');
         const overlayManager = BlackHoleSetupOverlayManager.getInstance();
         await overlayManager.showBlackHoleSetupOverlay(true);
       } else {
         // Windows: Show VB-Audio setup overlay
         const { VbAudioSetupOverlayManager } = await import('../services/VbAudioSetupOverlayManager');
         const overlayManager = VbAudioSetupOverlayManager.getInstance();
         await overlayManager.showVbAudioSetupOverlay(true);
       }
       return { success: true };
     } catch (error) {
       console.error('Failed to show audio setup overlay:', error);
       return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
     }
   });
 
   // BlackHole setup handler (macOS-specific)
   try { ipcMain.removeHandler('help:blackhole-setup'); } catch {}
   ipcMain.handle('help:blackhole-setup', async () => {
     try {
       const { BlackHoleSetupOverlayManager } = await import('../services/BlackHoleSetupOverlayManager');
       const overlayManager = BlackHoleSetupOverlayManager.getInstance();
       await overlayManager.showBlackHoleSetupOverlay(true);
       return { success: true };
     } catch (error) {
       console.error('Failed to show BlackHole setup overlay:', error);
       return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
     }
   });

  try { ipcMain.removeHandler('help:report-issue'); } catch {}
  ipcMain.handle('help:report-issue', async () => {
    const { BackendConfig, getServiceUrl } = await import('../services/OpenSourceConfig');
    const url = getServiceUrl('account');
    if (url) {
      shell.openExternal(url.endsWith('/') ? `${url}report` : `${url}/report`);
    } else {
      shell.openExternal(BackendConfig.WEBSITE_URL || 'https://github.com');
    }
    return { success: true };
  });

  try { ipcMain.removeHandler('help:contact-support'); } catch {}
  ipcMain.handle('help:contact-support', async () => {
    const { BackendConfig, getServiceUrl } = await import('../services/OpenSourceConfig');
    const url = getServiceUrl('account');
    if (url) {
      shell.openExternal(url.endsWith('/') ? `${url}support` : `${url}/support`);
    } else {
      shell.openExternal(BackendConfig.WEBSITE_URL || 'https://github.com');
    }
    return { success: true };
  });

  try { ipcMain.removeHandler('help:visit-website'); } catch {}
  ipcMain.handle('help:visit-website', async () => {
    const { BackendConfig } = await import('../services/OpenSourceConfig');
    shell.openExternal(BackendConfig.WEBSITE_URL || 'https://github.com');
    return { success: true };
  });

  // Error reporting handler - receives errors from renderer and forwards to backend
  try { ipcMain.removeHandler('error:report'); } catch {}
  ipcMain.handle('error:report', async (_event, errorData: {
    message: string;
    code?: string;
    stack?: string;
    category?: string;
    severity?: string;
    component?: string;
    context?: Record<string, any>;
    processType?: string;
  }) => {
    try {
      const { ErrorReportingService } = await import('../services/ErrorReportingService');
      const errorReporter = ErrorReportingService.getInstance();
      errorReporter.captureRendererError(errorData);
      return { success: true };
    } catch (error) {
      console.error('Failed to report error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  console.log('IPC handlers registered successfully');
  
  // Local models download handler - registered directly inline (like macmain branch)
  // This ensures it's always available without import/export issues
  // IMPORTANT: Register this AFTER registerLocalModelHandlers() to ensure it's not removed
  console.log('🔧 Registering local-models:download handler directly inline...');
  console.log('🔍 handleDownloadLocalModel available:', !!handleDownloadLocalModel, typeof handleDownloadLocalModel);
  
  try {
    ipcMain.removeHandler('local-models:download');
  } catch {}
  
  if (!handleDownloadLocalModel) {
    console.error('❌ handleDownloadLocalModel not available, attempting emergency import...');
    try {
      const emergencyImport = await import('./handlers/localModelHandlers');
      handleDownloadLocalModel = emergencyImport.handleDownloadLocalModel;
      console.log('✅ Emergency import successful, handleDownloadLocalModel:', typeof handleDownloadLocalModel);
    } catch (emergencyError) {
      console.error('❌ Emergency import failed:', emergencyError);
      if (emergencyError instanceof Error) {
        console.error('❌ Emergency error message:', emergencyError.message);
        console.error('❌ Emergency error stack:', emergencyError.stack);
      }
    }
  }
  
  if (handleDownloadLocalModel && typeof handleDownloadLocalModel === 'function') {
    try {
      ipcMain.handle('local-models:download', handleDownloadLocalModel);
      console.log('✅ local-models:download handler registered directly inline');
      
      // Verify registration
      try {
        // Try to check if it's registered (best effort)
        const testCall = ipcMain.listenerCount('local-models:download');
        console.log('🔍 Handler registration check (listenerCount):', testCall);
      } catch (verifyError) {
        // Ignore verification errors
      }
    } catch (registerError) {
      console.error('❌ Failed to register handler:', registerError);
      if (registerError instanceof Error) {
        console.error('❌ Register error message:', registerError.message);
        console.error('❌ Register error stack:', registerError.stack);
      }
    }
  } else {
    console.error('❌ CRITICAL: Cannot register local-models:download - handleDownloadLocalModel is not a function');
    console.error('❌ handleDownloadLocalModel value:', handleDownloadLocalModel);
  }
}

/**
 * Unregister all IPC handlers
 */
export async function unregisterIPCHandlers(): Promise<void> {
  console.log('Unregistering IPC handlers...');

  // Cleanup PaddlePaddle IPC handlers
  try {
    const { cleanupPaddleIPC } = await import('../paddle/paddle-ipc');
    cleanupPaddleIPC();
  } catch (error) {
    console.error('Failed to cleanup PaddlePaddle IPC:', error);
  }

  // Remove all handlers
  Object.values(IPC_CHANNELS).forEach(channel => {
    ipcMain.removeHandler(channel as any);
    ipcMain.removeAllListeners(channel);
  });

  // Remove overlay handlers
  Object.values(OVERLAY_CHANNELS).forEach(channel => {
    ipcMain.removeHandler(channel as any);
    ipcMain.removeAllListeners(channel);
  });

  // Remove mini overlay handlers
  Object.values(MINI_OVERLAY_CHANNELS).forEach(channel => {
    ipcMain.removeHandler(channel as any);
    ipcMain.removeAllListeners(channel);
  });

  // Unregister global hotkeys
  // No Electron globalShortcut here; using node-global-key-listener instead

  console.log('IPC handlers unregistered');
}

// Minimal translate-only handler to ensure only translated text is returned
async function handleTranslateOnly(
  event: IpcMainInvokeEvent,
  request: IPCRequest<{ text: string; targetLanguage: string; sourceLanguage?: string }>
): Promise<IPCResponse<{ translatedText: string }>> {
  try {
    const configManager = ConfigurationManager.getInstance();
    const { TranslationServiceManager } = await import('../services/TranslationServiceManager');
    const translationService = new TranslationServiceManager(configManager);
    const result = await translationService.translate(
      request.payload.text,
      request.payload.targetLanguage,
      request.payload.sourceLanguage || 'en'
    );
    return {
      id: request.id,
      timestamp: Date.now(),
      success: true,
      payload: { translatedText: result.translatedText }
    };
  } catch (error) {
    return {
      id: request.id,
      timestamp: Date.now(),
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// TTS Cache for background processing
let ttsCache: any = null;

async function getTTSCache() {
  if (!ttsCache) {
    const configManager = ConfigurationManager.getInstance();
    const { TextToSpeechManager } = await import('../services/TextToSpeechManager');
    const { TTSCache } = await import('../services/TTSCache');
    const ttsManager = new TextToSpeechManager(configManager);
    ttsCache = new TTSCache(ttsManager);
  }
  return ttsCache;
}

// Prefetch TTS in background (non-blocking)
async function handleTtsPrefetch(
  event: IpcMainInvokeEvent,
  request: IPCRequest<{ text: string; voiceId: string; modelId?: string }>
): Promise<IPCResponse<{ success: boolean }>> {
  try {
    const cache = await getTTSCache();
    
    // Prefetch in background (non-blocking)
    cache.prefetch(request.payload.text, request.payload.voiceId, request.payload.modelId);
    
    console.log(`🚀 Prefetching TTS in background: "${request.payload.text.substring(0, 50)}..."`);
    
    return {
      id: request.id,
      timestamp: Date.now(),
      success: true,
      payload: { success: true }
    };
  } catch (error) {
    console.error('TTS prefetch error:', error);
    return {
      id: request.id,
      timestamp: Date.now(),
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Minimal synthesize-only handler that speaks exactly the provided text
async function handleSynthesizeOnly(
  event: IpcMainInvokeEvent,
  request: IPCRequest<{ text: string; voiceId: string; modelId?: string }>
): Promise<IPCResponse<{ audioBuffer: number[] }>> {
  try {
    // Validate input
    if (!request.payload?.text || typeof request.payload.text !== 'string' || request.payload.text.trim().length === 0) {
      const error = 'Empty or invalid text provided to TTS synthesis';
      console.error(`❌ [TTS] ${error}`, request.payload);
      return {
        id: request.id,
        timestamp: Date.now(),
        success: false,
        error: error
      };
    }

    if (!request.payload?.voiceId || typeof request.payload.voiceId !== 'string') {
      const error = 'Invalid voiceId provided to TTS synthesis';
      console.error(`❌ [TTS] ${error}`, request.payload);
      return {
        id: request.id,
        timestamp: Date.now(),
        success: false,
        error: error
      };
    }

    const text = request.payload.text.trim();
    const voiceId = request.payload.voiceId;
    const modelId = request.payload.modelId || 'eleven_v3';

    console.log(`🎤 [TTS] Synthesizing: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}" (voice: ${voiceId}, model: ${modelId})`);

    const configManager = ConfigurationManager.getInstance();
    const { StreamingTTSService } = await import('../services/StreamingTTSService');
    const streamingTTS = new StreamingTTSService(configManager);
    
    // Check if streaming is supported
    const streamingSupported = await streamingTTS.isStreamingSupported();
    
    let audioBuffer: ArrayBuffer;
    
    if (streamingSupported) {
      // Use streaming TTS with real-time chunk delivery
      console.log(`🎵 [TTS] Using streaming synthesis for "${text.substring(0, 50)}..."`);
      const ttsStartTime = Date.now();
      let firstChunkTime: number | null = null;
      let audioChunks: ArrayBuffer[] = [];
      const { BrowserWindow } = require('electron');
      const windows = BrowserWindow.getAllWindows();
      
      audioBuffer = await streamingTTS.synthesizeWithStreaming(
        text,
        voiceId,
        modelId,
        (chunk: ArrayBuffer, chunkIndex: number) => {
          if (firstChunkTime === null) {
            firstChunkTime = Date.now() - ttsStartTime;
            console.log(`🚀 [TTS] First chunk received in ${firstChunkTime}ms (TTFB)`);
          }
          console.log(`📦 [TTS] Chunk ${chunkIndex + 1}: ${chunk.byteLength} bytes`);
          audioChunks.push(chunk);
          
          // Send each chunk immediately to renderer for real-time playback
          try {
            const chunkArray = Array.from(new Uint8Array(chunk));
            
            if (chunkArray.length > 0) {
              for (const window of windows) {
                if (!window.isDestroyed()) {
                  window.webContents.send('realtime-tts-chunk', {
                    audioData: chunkArray,
                    chunkIndex: chunkIndex,
                    isFirstChunk: chunkIndex === 0,
                    bufferSize: chunk.byteLength,
                    originalText: text,
                    translatedText: text // For synthesize-only, translated text is same as original
                  });
                }
              }
              
              console.log(`🔊 [TTS] Sent ${chunk.byteLength} bytes for real-time playback (chunk ${chunkIndex + 1})`);
            }
          } catch (chunkError) {
            console.warn('⚠️ [TTS] Failed to send chunk to renderer:', chunkError);
          }
        },
        (progress: { chunksReceived: number; totalBytes: number }) => {
          console.log(`📊 [TTS] Streaming progress: ${progress.chunksReceived} chunks, ${progress.totalBytes} bytes`);
        }
      );
      
      const totalTime = Date.now() - ttsStartTime;
      console.log(`✅ [TTS] Streaming synthesis complete: ${totalTime}ms total, ${firstChunkTime}ms to first chunk, ${audioBuffer.byteLength} bytes`);
    } else {
      // Fall back to regular TTS with cache
      console.log(`🎤 [TTS] Streaming not supported, using cache: "${text.substring(0, 50)}..."`);
      const cache = await getTTSCache();
      
      // Try to get from cache first (will wait if processing, or synthesize if not cached)
      const cacheStatus = cache.getStatus(text, voiceId, modelId);
      if (cacheStatus === 'ready') {
        console.log(`⚡ [TTS] Already ready from cache: "${text.substring(0, 50)}..."`);
      } else if (cacheStatus === 'processing') {
        console.log(`⏳ [TTS] Processing in background, waiting: "${text.substring(0, 50)}..."`);
      } else {
        console.log(`🔄 [TTS] Not cached, processing now: "${text.substring(0, 50)}..."`);
      }
      
      audioBuffer = await cache.get(text, voiceId, modelId);
    }
    
    if (!audioBuffer || audioBuffer.byteLength === 0) {
      const error = 'TTS synthesis returned empty audio buffer';
      console.error(`❌ [TTS] ${error}: "${text.substring(0, 50)}..."`);
      return {
        id: request.id,
        timestamp: Date.now(),
        success: false,
        error: error
      };
    }
    
    console.log(`✅ [TTS] Retrieved: ${audioBuffer.byteLength} bytes for "${text.substring(0, 50)}..."`);
    
    return {
      id: request.id,
      timestamp: Date.now(),
      success: true,
      payload: { audioBuffer: Array.from(new Uint8Array(audioBuffer)) }
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;

    // Check if this is a captions-only mode error (no TTS provider available in personal mode)
    if (errorMessage === 'CAPTIONS_ONLY_MODE') {
      console.log(`ℹ️ [TTS] Skipping TTS synthesis (captions-only mode): "${request.payload?.text?.substring(0, 50) || 'unknown'}..."`);
      return {
        id: request.id,
        timestamp: Date.now(),
        success: true,
        payload: { audioBuffer: [] } // Return empty audio buffer to signal captions-only mode
      };
    }

    console.error(`❌ [TTS] Synthesis failed:`, {
      error: errorMessage,
      stack: errorStack,
      payload: request.payload,
      text: request.payload?.text?.substring(0, 100)
    });

    return {
      id: request.id,
      timestamp: Date.now(),
      success: false,
      error: errorMessage
    };
  }
}

// Handler implementations (placeholder implementations for now)

async function handleGetAudioDevices(
  event: IpcMainInvokeEvent, 
  request: GetAudioDevicesRequest
): Promise<GetAudioDevicesResponse> {
  console.log('Handling get audio devices request');
  
  try {
    const audioDeviceService = new AudioDeviceService();
    const deviceInfos = await audioDeviceService.getAvailableDevices();
    
    // Convert AudioDeviceInfo to AudioDevice format
    const devices = deviceInfos
      .filter(device => device.kind === 'audioinput' || device.kind === 'audiooutput')
      .map(device => ({
        deviceId: device.deviceId,
        label: device.label,
        kind: device.kind as 'audioinput' | 'audiooutput',
        groupId: device.groupId
      }));
    
    return {
      id: request.id,
      timestamp: Date.now(),
      success: true,
      payload: devices
    };
  } catch (error) {
    console.error('Error getting audio devices:', error);
    return {
      id: request.id,
      timestamp: Date.now(),
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      payload: []
    };
  }
}

async function handleStartAudioCapture(
  event: IpcMainInvokeEvent, 
  request: IPCRequest<{ deviceId: string }>
): Promise<IPCResponse<void>> {
  console.log('Handling start audio capture request', request.payload);
  
  // Placeholder implementation
  return {
    id: request.id,
    timestamp: Date.now(),
    success: true
  };
}

async function handleStopAudioCapture(
  event: IpcMainInvokeEvent, 
  request: IPCRequest<void>
): Promise<IPCResponse<void>> {
  console.log('Handling stop audio capture request');
  
  // Placeholder implementation
  return {
    id: request.id,
    timestamp: Date.now(),
    success: true
  };
}

async function handleGetConfig(
  event: IpcMainInvokeEvent, 
  request: GetConfigRequest
): Promise<GetConfigResponse> {
  console.log('Handling get config request');
  
  try {
    const configManager = ConfigurationManager.getInstance();
    const config = configManager.getConfig();

    return {
      id: request.id,
      timestamp: Date.now(),
      success: true,
      payload: config
    };
  } catch (error) {
    console.error('Error getting configuration:', error);
    return {
      id: request.id,
      timestamp: Date.now(),
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

async function handleSetConfig(
  event: IpcMainInvokeEvent,
  request: SetConfigRequest
): Promise<IPCResponse<void>> {
  console.log('Handling set config request', request.payload);

  try {
    const configManager = ConfigurationManager.getInstance();

    // ENFORCE: Space bar MUST have Ctrl for PTT - hardcode it before saving
    if (request.payload.uiSettings?.pttHotkey) {
      const pttHotkey = request.payload.uiSettings.pttHotkey;
      const isFunctionKey = (key: string): boolean => {
        return /^F\d{1,2}$/.test(key);
      };
      
      if (pttHotkey.key === 'Space' && !pttHotkey.ctrl) {
        console.log('🚫 Space bar requires Ctrl for PTT - enforcing Ctrl+Space in config:set');
        request.payload.uiSettings.pttHotkey.ctrl = true;
        request.payload.uiSettings.pttHotkey.alt = false;
        request.payload.uiSettings.pttHotkey.shift = false;
      } else if (pttHotkey.key !== 'Space' && !isFunctionKey(pttHotkey.key) && !pttHotkey.alt) {
        // ENFORCE: Non-function keys (except Space) MUST have Alt
        console.log(`🚫 ${pttHotkey.key} requires Alt for PTT - enforcing Alt+${pttHotkey.key} in config:set`);
        request.payload.uiSettings.pttHotkey.alt = true;
        request.payload.uiSettings.pttHotkey.ctrl = false;
        request.payload.uiSettings.pttHotkey.shift = false;
      }
    }

    // Use secure update to prevent saving API keys
    configManager.updateConfigSecure(request.payload);

    // Update processing orchestrator if processing mode changed
    try {
      if (request.payload.processingMode || request.payload.localModelConfig || request.payload.cloudModelConfig) {
        const { ProcessingOrchestrator } = await import('../services/ProcessingOrchestrator');
        // Note: In a full implementation, you'd get the orchestrator instance from a service manager
        console.log('Configuration change detected, updating processing services...');
      }
      
      // Update incoming translation settings if bidirectional optimization changed
      if (request.payload.uiSettings?.bidirectionalOptimization) {
        if (processingOrchestrator && typeof processingOrchestrator.updateIncomingTranslationSettings === 'function') {
          await processingOrchestrator.updateIncomingTranslationSettings();
          console.log('✅ Updated incoming translation settings in ProcessingOrchestrator');
        }
        
        // Notify ManagedApiRouter about fast mode change for WebSocket management
        const translationSpeed = request.payload.uiSettings.bidirectionalOptimization.translationSpeed;
        if (translationSpeed) {
          const isFastMode = translationSpeed === 'fast';
          const { ManagedApiRouter } = await import('../services/ManagedApiRouter');
          const router = ManagedApiRouter.getInstance();
          await router.onFastModeChanged(isFastMode);
          console.log(`✅ Notified ManagedApiRouter of fast mode change: ${isFastMode}`);
        }
      }
    } catch (error) {
      console.warn('Failed to update processing orchestrator:', error);
    }

    // If runInBackground setting changed, update tray accordingly (macOS)
    if (request.payload.uiSettings?.runInBackground !== undefined) {
      try {
        const { SystemTrayService } = await import('../services/SystemTrayService');
        const trayService = SystemTrayService.getInstance();
        trayService.ensureTrayForBackgroundMode();
      } catch (error) {
        console.error('Error updating tray for background mode:', error);
      }
    }


    // Broadcast updated config to all renderer windows (main + overlay)
    try {
      const cfg = configManager.getConfig();
      const windows = BrowserWindow.getAllWindows();
      for (const win of windows) {
        if (!win.isDestroyed()) {
          win.webContents.send('config:updated', cfg);
        }
      }
    } catch {}

    return {
      id: request.id,
      timestamp: Date.now(),
      success: true
    };
  } catch (error) {
    console.error('Error setting configuration:', error);
    return {
      id: request.id,
      timestamp: Date.now(),
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

async function handleValidateApiKey(
  event: IpcMainInvokeEvent, 
  request: ValidateApiKeyRequest
): Promise<ValidateApiKeyResponse> {
  console.log('Handling validate API key request', request.payload.service);
  
  try {
    const apiKeyManager = ApiKeyManager.getInstance();
    const result = await apiKeyManager.validateApiKey(request.payload.service, request.payload.apiKey);

    return {
      id: request.id,
      timestamp: Date.now(),
      success: true,
      payload: result
    };
  } catch (error) {
    console.error('Error validating API key:', error);
    return {
      id: request.id,
      timestamp: Date.now(),
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

async function handleGetApiKey(
  event: IpcMainInvokeEvent,
  request: IPCRequest<{ keyType: 'openai' | 'elevenlabs' }>
): Promise<IPCResponse<{ key: string }>> {
  console.log('Handling get API key request for:', request.payload.keyType);
  
  try {
    const apiKeyManager = ApiKeyManager.getInstance();
    const key = await apiKeyManager.getApiKey(request.payload.keyType);

    return {
      id: request.id,
      timestamp: Date.now(),
      success: true,
      payload: { key }
    };
  } catch (error) {
    console.error('Error getting API key:', error);
    return {
      id: request.id,
      timestamp: Date.now(),
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

async function handleRemoveApiKey(
  event: IpcMainInvokeEvent,
  request: IPCRequest<{ keyType: 'openai' | 'elevenlabs' }>
): Promise<IPCResponse<{}>> {
  console.log('Handling remove API key request for:', request.payload.keyType);
  
  try {
    const apiKeyManager = ApiKeyManager.getInstance();
    await apiKeyManager.removeApiKey(request.payload.keyType);

    return {
      id: request.id,
      timestamp: Date.now(),
      success: true,
      payload: {}
    };
  } catch (error) {
    console.error('Error removing API key:', error);
    return {
      id: request.id,
      timestamp: Date.now(),
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

async function handleClearAllApiKeys(
  event: IpcMainInvokeEvent,
  request: IPCRequest<{}>
): Promise<IPCResponse<{}>> {
  console.log('Handling clear all API keys request');
  
  try {
    const apiKeyManager = ApiKeyManager.getInstance();
    await apiKeyManager.clearAllApiKeys();

    return {
      id: request.id,
      timestamp: Date.now(),
      success: true,
      payload: {}
    };
  } catch (error) {
    console.error('❌ Clear all API keys failed:', error);
    return {
      id: request.id,
      timestamp: Date.now(),
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Overlay handler implementations
async function handleOverlayToggle(
  event: IpcMainInvokeEvent,
  request: OverlayToggleRequest
): Promise<IPCResponse<void>> {
  console.log('Handling overlay toggle request');
  
  try {
    await getOverlayStateManager().handleToggle();
    
    return {
      id: request.id,
      timestamp: Date.now(),
      success: true
    };
  } catch (error) {
    console.error('Error toggling overlay:', error);
    return {
      id: request.id,
      timestamp: Date.now(),
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

async function handleOverlayClose(
  event: IpcMainInvokeEvent,
  request: OverlayCloseRequest
): Promise<IPCResponse<void>> {
  console.log('Handling overlay close request');
  
  try {
    await getOverlayStateManager().close();
    
    return {
      id: request.id,
      timestamp: Date.now(),
      success: true
    };
  } catch (error) {
    console.error('Error closing overlay:', error);
    return {
      id: request.id,
      timestamp: Date.now(),
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

async function handleOverlayHoldClose(
  event: IpcMainInvokeEvent,
  request: OverlayHoldCloseRequest
): Promise<IPCResponse<void>> {
  console.log('Handling overlay hold close request');
  
  try {
    await getOverlayStateManager().handleHoldClose();
    
    return {
      id: request.id,
      timestamp: Date.now(),
      success: true
    };
  } catch (error) {
    console.error('Error handling overlay hold close:', error);
    return {
      id: request.id,
      timestamp: Date.now(),
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

async function handleOverlaySettingChange(
  event: IpcMainInvokeEvent,
  request: OverlaySettingChangeRequest
): Promise<IPCResponse<void>> {
  console.log('Handling overlay setting change:', request);

  try {
    // Handle both payload formats - direct payload or wrapped payload
    let payloadData;
    if (request.payload && typeof request.payload === 'object' && 'setting' in request.payload) {
      // Payload is properly structured
      payloadData = request.payload;
    } else if (request && typeof request === 'object' && 'setting' in request) {
      // Payload is sent directly (current overlay behavior)
      payloadData = request as any;
    } else {
      throw new Error('Invalid payload structure for overlay setting change');
    }

    const { setting, value } = payloadData;
    const configManager = ConfigurationManager.getInstance();
    
    // Update the setting in the main app configuration
    const config = configManager.getConfig();
    
    // Handle different setting types
    switch (setting) {
      case 'sourceLanguage':
        config.sourceLanguage = value;
        break;
      case 'targetLanguage':
        config.targetLanguage = value;
        break;
      case 'voiceId':
        config.voiceId = value;
        break;
      case 'pttEnabled':
        // This would be handled by the main app's PTT system
        break;
      case 'bidirectionalEnabled':
        // This would be handled by the main app's bidirectional system
        break;
      case 'bidirectionalOutputDevice':
      case 'bidirectionalOutputDeviceId':
        if (!config.uiSettings) {
          config.uiSettings = {
            theme: 'dark',
            windowBounds: { width: 800, height: 600, maximized: false },
            showDebugConsole: false,
            uiLanguage: 'en',
            showNotifications: true
          };
        }
        (config.uiSettings as any).bidirectionalOutputDeviceId = value;
        // Also set the non-Id version for backward compatibility
        config.uiSettings.bidirectionalOutputDevice = value;
        break;
      case 'incomingVoiceId':
        if (!config.uiSettings) {
          config.uiSettings = {
            theme: 'dark',
            windowBounds: { width: 800, height: 600, maximized: false },
            showDebugConsole: false,
            uiLanguage: 'en',
            showNotifications: true
          };
        }
        config.uiSettings.incomingVoiceId = value;
        break;
      case 'bidirectionalSourceLanguage':
        if (!config.uiSettings) {
          config.uiSettings = {
            theme: 'dark',
            windowBounds: { width: 800, height: 600, maximized: false },
            showDebugConsole: false,
            uiLanguage: 'en',
            showNotifications: true
          };
        }
        config.uiSettings.bidirectionalSourceLanguage = value;
        console.log('🌐 IPC: Processing bidirectional source language change to:', value);
        break;
      case 'bidirectionalTargetLanguage':
        if (!config.uiSettings) {
          config.uiSettings = {
            theme: 'dark',
            windowBounds: { width: 800, height: 600, maximized: false },
            showDebugConsole: false,
            uiLanguage: 'en',
            showNotifications: true
          };
        }
        config.uiSettings.bidirectionalTargetLanguage = value;
        console.log('🎯 IPC: Processing bidirectional target language change to:', value);
        break;
      case 'captureSource':
        if (!config.uiSettings) {
          config.uiSettings = {
            theme: 'dark',
            windowBounds: { width: 800, height: 600, maximized: false },
            showDebugConsole: false,
            uiLanguage: 'en',
            showNotifications: true
          };
        }
        config.uiSettings.captureSource = value;
        break;
      case 'inputDevice':
      case 'selectedMicrophone':
        console.log('🎤 IPC: Processing microphone change to:', value);
        config.selectedMicrophone = value;
        break;
      case 'outputDevice':
        // This would be handled by the main app's audio output system
        break;
      case 'autoDetectLanguage':
        // This would be handled by the main app's language detection
        break;
      case 'overlayClickThrough': {
        if (config.uiSettings.overlaySettings) {
          config.uiSettings.overlaySettings.clickThrough = !!value;
          try {
            const wm = SplitOverlayWindowManager.getInstance();
            const miniWin = wm.getMiniOverlayWindow();
            if (miniWin && !miniWin.isDestroyed()) {
              // Note: On Windows 11, { forward: true } can cause input lag issues with DWM
              miniWin.setIgnoreMouseEvents(!!value);
            }
          } catch {}
        }
        break;
      }
      case 'overlayAlwaysOnTop': {
        if (config.uiSettings.overlaySettings) {
          config.uiSettings.overlaySettings.alwaysOnTop = !!value;
          try {
            const wm = SplitOverlayWindowManager.getInstance();
            wm.setAlwaysOnTop(!!value);
          } catch {}
        }
        break;
      }
      case 'overlayOpacity': {
        if (config.uiSettings.overlaySettings) {
          const op = Math.max(0.1, Math.min(1.0, Number(value) || 0.9));
          config.uiSettings.overlaySettings.opacity = op;
          try {
            const wm = SplitOverlayWindowManager.getInstance();
            wm.setOpacity(op);
          } catch {}
        }
        break;
      }
      default:
        console.warn('Unknown overlay setting:', setting);
    }
    
    configManager.updateConfig(config);

    // Broadcast updated config to all renderer windows (main + overlay)
    try {
      const cfg = configManager.getConfig();
      const windows = BrowserWindow.getAllWindows();
      for (const win of windows) {
        if (!win.isDestroyed()) {
          win.webContents.send('config:updated', cfg);
        }
      }
    } catch (broadcastError) {
      console.warn('Error broadcasting config update:', broadcastError);
    }

    return {
      id: request.id,
      timestamp: Date.now(),
      success: true
    };
  } catch (error) {
    console.error('Error changing overlay setting:', error);
    return {
      id: request.id,
      timestamp: Date.now(),
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

async function handleGetOverlayState(
  event: IpcMainInvokeEvent,
  request: GetOverlayStateRequest
): Promise<OverlayStateResponse> {
  console.log('Handling get overlay state request');
  
  try {
    const state = getOverlayStateManager().getCurrentState();
    console.log('📊 Returning overlay state:', JSON.stringify(state, null, 2));

    return {
      id: request.id,
      timestamp: Date.now(),
      success: true,
      payload: state
    };
  } catch (error) {
    console.error('Error getting overlay state:', error);
    return {
      id: request.id,
      timestamp: Date.now(),
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

async function handleUpdateOverlayHotkey(
  event: IpcMainInvokeEvent,
  request: UpdateOverlayHotkeyRequest
): Promise<IPCResponse<void>> {
  console.log('Handling update overlay hotkey request:', request.payload);
  
  try {
    const { hotkey } = request.payload;
    const configManager = ConfigurationManager.getInstance();
    
    // Update overlay hotkey in configuration
    const config = configManager.getConfig();
    if (!config.uiSettings.overlaySettings) {
      (config.uiSettings as any).overlaySettings = {
        enabled: true,
        toggleHotkey: hotkey,
        position: { x: 100, y: 100 },
        opacity: 0.9,
        autoHide: false,
        alwaysOnTop: true,
        clickThrough: true
      };
    } else {
      config.uiSettings.overlaySettings.toggleHotkey = hotkey;
    }
    configManager.updateConfig(config);
    return {
      id: request.id,
      timestamp: Date.now(),
      success: true
    };
  } catch (error) {
    console.error('Error updating overlay hotkey:', error);
    return {
      id: request.id,
      timestamp: Date.now(),
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

async function handleSaveOverlayPosition(
  event: IpcMainInvokeEvent,
  request: SaveOverlayPositionRequest
): Promise<IPCResponse<void>> {
  console.log('Handling save overlay position request:', request.payload);
  
  try {
    const { x, y } = request.payload;
    const overlayWindowManager = SplitOverlayWindowManager.getInstance();
    overlayWindowManager.updatePosition(x, y);
    
    return {
      id: request.id,
      timestamp: Date.now(),
      success: true
    };
  } catch (error) {
    console.error('Error saving overlay position:', error);
    return {
      id: request.id,
      timestamp: Date.now(),
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

async function handleGetOverlayConfig(
  event: IpcMainInvokeEvent,
  request: GetOverlayConfigRequest
): Promise<OverlayConfigResponse> {
  console.log('Handling get overlay config request');
  
  try {
    const configManager = ConfigurationManager.getInstance();
    const config = configManager.getConfig();
    const overlaySettings = config.uiSettings.overlaySettings;
    
    if (!overlaySettings) {
      throw new Error('Overlay settings not found');
    }
    
    return {
      id: request.id,
      timestamp: Date.now(),
      success: true,
      payload: overlaySettings
    };
  } catch (error) {
    console.error('Error getting overlay config:', error);
    return {
      id: request.id,
      timestamp: Date.now(),
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Serve gameoverlay.md content for overlay rendering
async function handleGetGameOverlayMarkdown(
  event: IpcMainInvokeEvent,
  request: IPCRequest<void>
): Promise<IPCResponse<{ markdown: string }>> {
  try {
    const here = __dirname;
    const pathCandidates = [
      require('path').join(here, '..', '..', 'gameoverlay.md'),
      require('path').join(process.cwd(), 'gameoverlay.md')
    ];
    const fs = require('fs');
    let markdown = '';
    for (const p of pathCandidates) {
      try {
        if (fs.existsSync(p)) {
          markdown = fs.readFileSync(p, 'utf8');
          break;
        }
      } catch {}
    }
    return {
      id: request.id,
      timestamp: Date.now(),
      success: true,
      payload: { markdown }
    };
  } catch (error) {
    return {
      id: request.id,
      timestamp: Date.now(),
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

async function handleOverlayReportError(
  event: IpcMainInvokeEvent,
  request: any
): Promise<IPCResponse<void>> {
  console.error('Overlay error reported:', request.error, 'at', new Date(request.timestamp));
  
  try {
    // Attempt to recover the overlay
    const overlayStateManager = getOverlayStateManager();
    await overlayStateManager.handleError(new Error(request.error));
    
    return {
      id: request.id || Date.now().toString(),
      timestamp: Date.now(),
      success: true
    };
  } catch (error) {
    console.error('Error handling overlay error report:', error);
    return {
      id: request.id || Date.now().toString(),
      timestamp: Date.now(),
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Mini overlay handler implementations
async function handleMiniOverlayAudioDetected(
  event: IpcMainInvokeEvent,
  request: { isDetected: boolean }
): Promise<IPCResponse<void>> {
  console.log('🎯 [Main Process] Mini overlay audio detected:', request.isDetected);

  try {
    // Get the mini overlay window manager and update the indicator
    const { SplitOverlayWindowManager } = await import('../services/SplitOverlayWindowManager');
    const windowManager = SplitOverlayWindowManager.getInstance();
    windowManager.updateAudioDetected(request.isDetected);

    return {
      id: Date.now().toString(),
      timestamp: Date.now(),
      success: true
    };
  } catch (error) {
    console.error('Error handling mini overlay audio detected:', error);
    return {
      id: Date.now().toString(),
      timestamp: Date.now(),
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

async function handleMiniOverlayVoiceTranslation(
  event: IpcMainInvokeEvent,
  request: { isActive: boolean }
): Promise<IPCResponse<void>> {
  console.log('🎯 [Main Process] Mini overlay voice translation:', request.isActive);

  try {
    // Update the overlay state manager with the bidirectional state
    // This ensures the state is tracked in the main process
    getOverlayStateManager().updateBidirectionalState({
      isEnabled: request.isActive
    });

    // Get the mini overlay window manager and update the indicator
    const { SplitOverlayWindowManager } = await import('../services/SplitOverlayWindowManager');
    const windowManager = SplitOverlayWindowManager.getInstance();
    windowManager.updateVoiceTranslation(request.isActive);

    return {
      id: Date.now().toString(),
      timestamp: Date.now(),
      success: true
    };
  } catch (error) {
    console.error('Error handling mini overlay voice translation:', error);
    return {
      id: Date.now().toString(),
      timestamp: Date.now(),
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

async function handleMiniOverlayScreenTranslation(
  event: IpcMainInvokeEvent,
  request: { state: 'off' | 'processing' | 'showing' }
): Promise<IPCResponse<void>> {
  console.log('🎯 [Main Process] Mini overlay screen translation:', request.state);

  try {
    // Get the mini overlay window manager and update the indicator
    const { SplitOverlayWindowManager } = await import('../services/SplitOverlayWindowManager');
    const windowManager = SplitOverlayWindowManager.getInstance();
    windowManager.updateScreenTranslation(request.state);

    return {
      id: Date.now().toString(),
      timestamp: Date.now(),
      success: true
    };
  } catch (error) {
    console.error('Error handling mini overlay screen translation:', error);
    return {
      id: Date.now().toString(),
      timestamp: Date.now(),
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

async function handleMiniOverlayStatusUpdate(
  event: IpcMainInvokeEvent,
  request: { status: string }
): Promise<IPCResponse<void>> {
  console.log('🎯 [Main Process] Mini overlay status update:', request.status);

  try {
    // Get the mini overlay window manager and update the status
    const { SplitOverlayWindowManager } = await import('../services/SplitOverlayWindowManager');
    const windowManager = SplitOverlayWindowManager.getInstance();
    windowManager.updateMiniOverlayStatus(request.status);

    return {
      id: Date.now().toString(),
      timestamp: Date.now(),
      success: true
    };
  } catch (error) {
    console.error('Error handling mini overlay status update:', error);
    return {
      id: Date.now().toString(),
      timestamp: Date.now(),
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

async function handleMiniOverlayReportError(
  event: IpcMainInvokeEvent,
  request: { error: string; timestamp: number }
): Promise<IPCResponse<void>> {
  console.error('Mini overlay error reported:', request.error, 'at', new Date(request.timestamp));

  try {
    // Attempt to recover the mini overlay
    const { SplitOverlayWindowManager } = await import('../services/SplitOverlayWindowManager');
    const windowManager = SplitOverlayWindowManager.getInstance();

    // Send cleanup command to mini overlay
    windowManager.cleanupResources();

    return {
      id: Date.now().toString(),
      timestamp: Date.now(),
      success: true
    };
  } catch (error) {
    console.error('Error handling mini overlay error report:', error);
    return {
      id: Date.now().toString(),
      timestamp: Date.now(),
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

//WAS
//WASAPI IPC handlers// Secure API Key Storage Handlers - moved to handlers/secureApiKeysHandlers.ts
// Local models handlers - moved to handlers/localModelHandlers.ts

// Secure API Key Storage Handlers (get-config, set-config, migrate, get-migration-status) - moved to handlers/secureApiKeysHandlers.ts

/**
 * Handle getting output devices for overlay
 */
async function handleGetOutputDevices(
  event: IpcMainInvokeEvent,
  request: IPCRequest<void>
): Promise<IPCResponse<{ devices: Array<{ deviceId: string; label: string; kind: string }> }>> {
  try {
    const audioDeviceService = new AudioDeviceService();
    const deviceInfos = await audioDeviceService.getAvailableDevices();
    
    // Filter for output devices only
    const outputDevices = deviceInfos
      .filter(device => device.kind === 'audiooutput')
      .map(device => ({
        deviceId: device.deviceId,
        label: device.label,
        kind: device.kind
      }));
    
    return {
      id: request.id,
      timestamp: Date.now(),
      success: true,
      payload: { devices: outputDevices }
    };
  } catch (error) {
    console.error('Error getting output devices:', error);
    return {
      id: request.id,
      timestamp: Date.now(),
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      payload: { devices: [] }
    };
  }
}

/**
 * Handle getting available voices for overlay
 */
async function handleGetAvailableVoices(
  event: IpcMainInvokeEvent,
  request: IPCRequest<void>
): Promise<IPCResponse<{ voices: Array<{ voice_id: string; name: string }> }>> {
  try {
    const configManager = ConfigurationManager.getInstance();
    const textToSpeechManager = new TextToSpeechManager(configManager);
    const voices = await textToSpeechManager.getAvailableVoices();
    
    // Convert Voice[] to the expected format
    const formattedVoices = voices.map(voice => ({
      voice_id: voice.id,
      name: voice.name
    }));
    
    return {
      id: request.id,
      timestamp: Date.now(),
      success: true,
      payload: { voices: formattedVoices }
    };
  } catch (error) {
    console.error('Error getting available voices:', error);
    return {
      id: request.id,
      timestamp: Date.now(),
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      payload: { voices: [] }
    };
  }
}

// TTS playback tracking handlers for audio filtering
async function handleTtsPlaybackStart(
  event: IpcMainInvokeEvent,
  request: IPCRequest<{ duration?: number }>
): Promise<IPCResponse<{}>> {
  try {
    isTtsPlaying = true;
    ttsPlaybackStartTime = Date.now();
    ttsPlaybackEndTime = request.payload.duration ? 
      ttsPlaybackStartTime + request.payload.duration : 
      ttsPlaybackStartTime + 5000; // Default 5 second duration if not provided
    
    console.log(`[TTS] Playback started, filtering WASAPI audio for ${ttsPlaybackEndTime - ttsPlaybackStartTime}ms`);
    
    return {
      id: request.id,
      timestamp: Date.now(),
      success: true,
      payload: {}
    };
  } catch (error) {
    console.error('Error handling TTS playback start:', error);
    return {
      id: request.id,
      timestamp: Date.now(),
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      payload: {}
    };
  }
}

async function handleTtsPlaybackEnd(
  event: IpcMainInvokeEvent,
  request: IPCRequest<{}>
): Promise<IPCResponse<{}>> {
  try {
    isTtsPlaying = false;
    ttsPlaybackEndTime = Date.now();
    
    console.log('[TTS] Playback ended, resuming normal WASAPI audio capture');
    
    return {
      id: request.id,
      timestamp: Date.now(),
      success: true,
      payload: {}
    };
  } catch (error) {
    console.error('Error handling TTS playback end:', error);
    return {
      id: request.id,
      timestamp: Date.now(),
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      payload: {}
    };
  }
}

// Secure API Key Storage Handlers (get-config, set-config, migrate, get-migration-status) - moved to handlers/secureApiKeysHandlers.ts

// Voice activity handlers for real-time overlay updates
function handleVoiceActivityUpdate(event: IpcMainEvent, data: { isActive: boolean; timestamp: number }): void {
  try {
    // Update overlay state with voice activity
    const overlayStateManager = getOverlayStateManager();
    overlayStateManager.updateMicrophoneState({
      isActive: data.isActive,
      isRecording: data.isActive, // Consider voice activity as recording state
      level: data.isActive ? 50 : 0 // Basic level indication
    });
    
    console.log(`Voice activity: ${data.isActive ? 'started' : 'stopped'}`);
  } catch (error) {
    console.error('Error handling voice activity update:', error);
  }
}

function handleMicLevelUpdate(event: IpcMainEvent, data: { 
  isActive: boolean; 
  level: number; 
  confidence: number; 
  energy: number; 
  timestamp: number 
}): void {
  try {
    // Update overlay state with detailed microphone information
    const overlayStateManager = getOverlayStateManager();
    overlayStateManager.updateMicrophoneState({
      isActive: data.isActive,
      isRecording: data.isActive && data.level > 10, // Recording when voice is active and above threshold
      level: data.level,
      deviceId: '' // Would need to be passed from AudioCaptureControls if needed
    });
    
    // Optional: Log high-activity events for debugging
    if (data.isActive && data.level > 50) {
      console.log(`High mic activity: level=${data.level}, confidence=${Math.round(data.confidence * 100)}%`);
    }
  } catch (error) {
    console.error('Error handling mic level update:', error);
  }
}

function handleRecordingStateUpdate(event: IpcMainEvent, data: { isRecording: boolean; timestamp: number }): void {
  try {
    // Update overlay state with recording state
    const overlayStateManager = getOverlayStateManager();
    overlayStateManager.updateMicrophoneState({
      isRecording: data.isRecording,
      isActive: data.isRecording, // If recording, microphone is active
      level: data.isRecording ? 25 : 0 // Basic level when recording starts/stops
    });
    
    console.log(`Recording state: ${data.isRecording ? 'started' : 'stopped'}`);
  } catch (error) {
    console.error('Error handling recording state update:', error);
  }
}

// Real-time audio activity analysis for overlay updates
export async function updateOverlayWithAudioActivity(audioSegment: { data: Float32Array; timestamp: number }): Promise<void> {
  try {
    // Calculate volume level
    let sum = 0;
    for (let i = 0; i < audioSegment.data.length; i++) {
      sum += Math.abs(audioSegment.data[i]);
    }
    const volume = sum / audioSegment.data.length;
    const volumePercent = Math.min(100, volume * 1000); // Scale for display

    // Calculate energy
    let energySum = 0;
    for (let i = 0; i < audioSegment.data.length; i++) {
      energySum += audioSegment.data[i] * audioSegment.data[i];
    }
    const energy = energySum / audioSegment.data.length;

    // Simple voice activity detection thresholds
    const volumeThreshold = 0.01;
    const energyThreshold = 0.001;
    const isVoiceActive = volume > volumeThreshold && energy > energyThreshold;

    // Get processing orchestrator state from translation pipeline
    const { getProcessingOrchestratorState } = await import('./handlers/translationPipelineHandlers');
    const orchestratorState = getProcessingOrchestratorState();

    // Create microphone state object
    const micState = {
      isActive: orchestratorState.isActive,
      isRecording: isVoiceActive, // Recording when voice is detected
      level: volumePercent,
      deviceId: orchestratorState.config?.microphoneId || ''
    };
    
    // Update overlay state through OverlayStateManager
    const overlayStateManager = getOverlayStateManager();
    overlayStateManager.updateMicrophoneState(micState);
    
    // ALSO send direct microphone state update to overlay window
    const overlayWindowManager = SplitOverlayWindowManager.getInstance();
    overlayWindowManager.sendToBothOverlays('mic-state-update', micState);
    
    // Debug: Log every few updates to confirm they're being sent
    if (Math.random() < 0.1) { // Log ~10% of updates
      console.log(`📊 Overlay mic state: active=${micState.isActive}, recording=${micState.isRecording}, level=${Math.round(volumePercent)}`);
    }
  } catch (error) {
    console.error('Error updating overlay with audio activity:', error);
  }
}

// Quick Translate IPC Handlers - moved to handlers/quickTranslateHandlers.ts

/**
 * Handle managed API mode change
 */
async function handleManagedApiSetMode(
  event: IpcMainInvokeEvent,
  request: IPCRequest<{ mode: 'managed' | 'personal' }>
): Promise<IPCResponse<void>> {
  console.log('🔄 Handling managed API mode change request:', request.payload);

  try {
    const { mode } = request.payload;
    
    // Import and update the ManagedApiRouter
    const { ManagedApiRouter } = await import('../services/ManagedApiRouter');
    const router = ManagedApiRouter.getInstance();
    
    // Set the new mode
    await router.setMode(mode);
    
    console.log(`✅ Successfully set managed API mode to: ${mode}`);
    
    return {
      id: request.id,
      timestamp: Date.now(),
      success: true,
      payload: undefined,
      error: undefined
    };
  } catch (error) {
    console.error('❌ Failed to set managed API mode:', error);
    
    return {
      id: request.id,
      timestamp: Date.now(),
      success: false,
      payload: undefined,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}