import { TranscriptionResult } from '../interfaces/SpeechToTextService';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { resolveEmbeddedPythonExecutable } from '../utils/pythonPath';

/**
 * Local speech-to-text service using Whisper (faster-whisper)
 */
export class LocalWhisperService {
  private whisperPath: string;
  private modelPath: string;
  private isInitialized: boolean = false;
  private currentModel: string = 'tiny';
  private supportedLanguages: string[] = [];

  constructor() {
    // Use the correct path where models are actually installed (platform-specific)
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
    
    this.whisperPath = whisperPath;
    this.modelPath = path.join(this.whisperPath, 'models');
  }

  /**
   * Initialize local Whisper service
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Check if faster-whisper is installed
      await this.checkWhisperInstallation();

      // Load supported languages
      this.loadSupportedLanguages();

      this.isInitialized = true;
      console.log('Local Whisper Service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Local Whisper Service:', error);
      throw error;
    }
  }

  /**
   * Transcribe audio using local Whisper
   */
  async transcribe(audioBuffer: Buffer, options?: {
    language?: string;
    model?: string;
    temperature?: number;
  }): Promise<TranscriptionResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const model = options?.model || this.currentModel;
      const language = options?.language || 'auto';
      const temperature = options?.temperature || 0.0;

      console.log(`Transcribing with local Whisper: model=${model}, language=${language}`);

      // Save audio buffer to temporary file
      const tempAudioPath = await this.saveAudioToTemp(audioBuffer);

      try {
        const transcription = await this.executeWhisperTranscription(
          tempAudioPath,
          model,
          language,
          temperature
        );

        return {
          text: transcription.text,
          language: transcription.language || language,
          confidence: transcription.confidence || 0.9,
          duration: transcription.duration || 0,
          provider: 'whisper-local'
        };
      } finally {
        // Clean up temporary file
        try {
          fs.unlinkSync(tempAudioPath);
        } catch (error) {
          console.warn('Failed to clean up temp audio file:', error);
        }
      }
    } catch (error) {
      console.error('Local Whisper transcription failed:', error);
      throw new Error(`Local Whisper transcription failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get supported languages
   */
  getSupportedLanguages(): string[] {
    return this.supportedLanguages;
  }

  /**
   * Check if language is supported
   */
  isLanguageSupported(language: string): boolean {
    return this.supportedLanguages.includes(language) || language === 'auto';
  }

  /**
   * Check if service is available
   */
  isAvailable(): boolean {
    if (!this.isInitialized) {
      console.log('🔍 Whisper service not initialized yet');
      return false;
    }

    console.log(`🔍 Checking Whisper availability at: ${this.whisperPath}`);
    console.log(`🔍 Path exists: ${fs.existsSync(this.whisperPath)}`);

    // Check for the installation marker file
    const markerFile = path.join(this.whisperPath, 'whisper_installed.txt');
    console.log(`🔍 Marker file: ${markerFile}`);
    console.log(`🔍 Marker file exists: ${fs.existsSync(markerFile)}`);
    
    if (fs.existsSync(markerFile)) {
      console.log('✅ Whisper marker file found');
      return true;
    }

    // Fallback: Check if model directories exist (for cases where marker file might be missing)
    // Models are stored in directories like: models--Systran--faster-whisper-small
    try {
      if (fs.existsSync(this.whisperPath)) {
        const dirContents = fs.readdirSync(this.whisperPath);
        console.log(`🔍 Directory contents (${dirContents.length} items):`, dirContents);
        
        // Check if any model directories exist (they start with "models--")
        const hasModelDirs = dirContents.some((item: string) => {
          const itemPath = path.join(this.whisperPath, item);
          try {
            const isDir = fs.statSync(itemPath).isDirectory();
            const matches = item.startsWith('models--');
            if (matches) {
              console.log(`✅ Found model directory: ${item} (isDirectory: ${isDir})`);
            }
            return matches && isDir;
          } catch (statError) {
            console.warn(`⚠️ Error checking ${item}:`, statError);
            return false;
          }
        });
        
        if (hasModelDirs) {
          console.log('✅ Whisper models found in directory (marker file missing but models present)');
          return true;
        } else {
          console.log('❌ No model directories found starting with "models--"');
        }
      } else {
        console.log(`❌ Whisper path does not exist: ${this.whisperPath}`);
      }
    } catch (error) {
      console.error('❌ Error checking for model directories:', error);
    }

    console.log('❌ Whisper service is not available');
    return false;
  }

  /**
   * Get the platform-specific embedded Python executable path
   * Uses robust path resolution that works in packaged apps
   */
  private getEmbeddedPythonPath(): string {
    // Use the robust resolution from pythonPath.ts (handles packaged apps correctly)
    const embeddedPython = resolveEmbeddedPythonExecutable();
    if (embeddedPython && fs.existsSync(embeddedPython)) {
      console.log(`🐍 LocalWhisper using embedded Python: ${embeddedPython}`);
      return embeddedPython;
    }
    
    // Fallback: try common locations (for development)
    const fallbackPaths = [
      path.join(process.cwd(), 'python', 'python.exe'),
      path.join(__dirname, '..', '..', 'python', 'python.exe'),
      path.join(__dirname, '..', 'python', 'python.exe'),
    ];
    
    for (const fallback of fallbackPaths) {
      if (fs.existsSync(fallback)) {
        console.log(`🐍 LocalWhisper using fallback Python: ${fallback}`);
        return fallback;
      }
    }
    
    // No embedded Python found - throw error instead of using system Python
    console.error('❌ Embedded Python not found! Checked paths:', fallbackPaths);
    throw new Error('Embedded Python executable not found. Please reinstall the application.');
  }

  /**
   * Set Whisper model
   */
  setModel(model: string): void {
    this.currentModel = model;
  }

  /**
   * Get current model
   */
  getCurrentModel(): string {
    return this.currentModel;
  }

  /**
   * Get available models
   */
  getAvailableModels(): string[] {
    return ['tiny', 'base', 'small', 'medium', 'large', 'large-v2', 'large-v3'];
  }

  /**
   * Execute Whisper transcription
   */
  private async executeWhisperTranscription(
    audioPath: string,
    model: string,
    language: string,
    temperature: number
  ): Promise<{
    text: string;
    language?: string;
    confidence?: number;
    duration?: number;
  }> {
    return new Promise((resolve, reject) => {
      try {
        // Use embedded Python to run faster-whisper (platform-specific)
        const embeddedPythonExe = this.getEmbeddedPythonPath();
        const script = `import sys
import os

# Set HuggingFace cache directory to whispra directory BEFORE importing faster_whisper
# This ensures models are loaded from the correct location
whisper_path = r"${this.whisperPath.replace(/\\/g, '\\\\')}"
os.environ['HF_HOME'] = whisper_path
os.environ['HF_HUB_CACHE'] = whisper_path
os.environ['HUGGINGFACE_HUB_CACHE'] = whisper_path

# Add Whisper packages to Python path
if whisper_path not in sys.path:
    sys.path.insert(0, whisper_path)

try:
    import faster_whisper
    import json
    
    # Initialize WhisperModel with custom cache directory
    # This ensures models are downloaded to the Whispra models directory
    model = faster_whisper.WhisperModel(
        "${model}", 
        device="cpu", 
        compute_type="int8",
        download_root=whisper_path
    )
    
    result = model.transcribe("${audioPath.replace(/\\/g, '\\\\')}", language="${language === 'auto' ? 'None' : language}", temperature=${temperature})
    
    segments = list(result[0])
    if segments:
        text = " ".join([segment.text for segment in segments])
        output = {
            "text": text,
            "language": "${language}",
            "confidence": 0.9
        }
        print(json.dumps(output))
    else:
        print(json.dumps({"text": "", "language": "${language}", "confidence": 0.0}))
        
except ImportError as e:
    print(json.dumps({"error": f"Import error: {e}"}))
except Exception as e:
    print(json.dumps({"error": f"Transcription error: {e}"}))`;

        // Write script to temporary file to avoid command line issues
        // Use os.tmpdir() for better Windows 11 permission handling
        const tempScriptPath = path.join(os.tmpdir(), `temp_whisper_${Date.now()}.py`);
        fs.writeFileSync(tempScriptPath, script);

        // On Mac, PyAV needs FFmpeg libraries at runtime via DYLD_LIBRARY_PATH
        const env: Record<string, string> = { ...process.env, PYTHONPATH: this.whisperPath };
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

          if (code === 0) {
            try {
              // Try to extract JSON from output (might have extra print statements)
              let jsonOutput = output.trim();
              
              // Find JSON object in output (handle cases where there's extra output)
              const jsonMatch = jsonOutput.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                jsonOutput = jsonMatch[0];
              }
              
              console.log('🔍 Whisper output (raw):', output);
              console.log('🔍 Whisper output (extracted JSON):', jsonOutput);
              
              const result = JSON.parse(jsonOutput);
              
              // Check for error in result
              if (result.error) {
                console.error('❌ Whisper returned error:', result.error);
                reject(new Error(result.error));
                return;
              }

              const text = result.text || result.transcription || '';
              console.log('🔍 Extracted text:', text);
              console.log('🔍 Text after trim:', text.trim());
              console.log('🔍 Text length:', text.trim().length);
              
              if (text && text.trim()) {
                resolve({
                  text: text.trim(),
                  language: result.language,
                  confidence: result.confidence || 0.9,
                  duration: result.duration
                });
              } else {
                // Empty transcription result - return empty text instead of error
                // This can happen with silence, background noise, or very short audio
                console.log('⚠️ Empty transcription result (likely silence or noise), returning empty text');
                resolve({
                  text: '',
                  language: result.language,
                  confidence: 0.0,
                  duration: result.duration || 0
                });
              }
            } catch (parseError) {
              console.error('❌ Failed to parse Whisper JSON output:', parseError);
              console.error('❌ Raw output:', output);
              console.error('❌ Error output:', errorOutput);
              
              // Fallback: treat output as plain text
              const text = output.trim();
              if (text) {
                console.log('✅ Using plain text fallback:', text);
                resolve({
                  text,
                  language: language !== 'auto' ? language : undefined,
                  confidence: 0.8
                });
              } else {
                reject(new Error(`Failed to parse Whisper output: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`));
              }
            }
          } else {
            console.error('❌ Whisper process exited with code:', code);
            console.error('❌ Error output:', errorOutput);
            console.error('❌ Standard output:', output);
            reject(new Error(`Whisper process exited with code ${code}: ${errorOutput || output}`));
          }
        });

        childProcess.on('error', (error: Error) => {
          // Clean up temp file
          try {
            fs.unlinkSync(tempScriptPath);
          } catch (e) {
            // Ignore cleanup errors
          }
          reject(new Error(`Failed to start Whisper process: ${error.message}`));
        });

        // Set timeout for transcription
        setTimeout(() => {
          if (!childProcess.killed) {
            childProcess.kill();
            reject(new Error('Whisper transcription timeout'));
          }
        }, 60000); // 60 second timeout

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Save audio buffer to temporary file
   */
  private async saveAudioToTemp(audioBuffer: Buffer): Promise<string> {
    const tempDir = os.tmpdir();
    const tempFileName = `whisper_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.wav`;
    const tempPath = path.join(tempDir, tempFileName);

    return new Promise((resolve, reject) => {
      fs.writeFile(tempPath, audioBuffer, (error) => {
        if (error) {
          reject(new Error(`Failed to save audio to temp file: ${error.message}`));
        } else {
          resolve(tempPath);
        }
      });
    });
  }

  /**
   * Check if faster-whisper is installed
   */
  private async checkWhisperInstallation(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Use embedded Python to check Whisper installation (platform-specific)
      const embeddedPythonExe = this.getEmbeddedPythonPath();
      
      if (!embeddedPythonExe || !fs.existsSync(embeddedPythonExe)) {
        reject(new Error('Embedded Python executable not found'));
        return;
      }

      // Test if faster-whisper module is available with proper path setup
      const script = `# -*- coding: utf-8 -*-
import sys
import os

# Ensure UTF-8 output on Windows
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')

# Add Whisper packages to Python path
whisper_path = r"${this.whisperPath.replace(/\\/g, '\\\\')}"
if whisper_path not in sys.path:
    sys.path.insert(0, whisper_path)

try:
    import faster_whisper
    print("faster-whisper available")
except ImportError as e:
    print(f"faster-whisper not available: {e}")
    sys.exit(1)`;

      // Write script to temporary file
      // Use os.tmpdir() for better Windows 11 permission handling
      const tempScriptPath = path.join(os.tmpdir(), `temp_whisper_check_${Date.now()}.py`);

      try {
        fs.writeFileSync(tempScriptPath, script);

        const childProcess = spawn(embeddedPythonExe, [tempScriptPath], {
          stdio: ['pipe', 'pipe', 'pipe'],
          shell: true,
          env: {
            ...process.env,
            PYTHONPATH: this.whisperPath,
            PYTHONIOENCODING: 'utf-8',
            PYTHONUTF8: '1'
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

          if (code === 0) {
            console.log('Faster-Whisper available:', output.trim());
            resolve();
          } else {
            reject(new Error(`Faster-Whisper not found or not working: ${output.trim() || errorOutput}`));
          }
        });

        childProcess.on('error', (error: Error) => {
          // Clean up temp file
          try {
            fs.unlinkSync(tempScriptPath);
          } catch (e) {
            // Ignore cleanup errors
          }
          reject(new Error(`Faster-Whisper check failed: ${error.message}`));
        });
      } catch (error) {
        reject(new Error(`Failed to create temp script: ${error}`));
      }
    });
  }

  /**
   * Load supported languages
   */
  private loadSupportedLanguages(): void {
    // Whisper supports these languages
    this.supportedLanguages = [
      'en', 'zh', 'de', 'es', 'ru', 'ko', 'fr', 'ja', 'pt', 'tr', 'pl', 'ca', 'nl', 'ar', 'sv', 'it', 'id', 'hi', 'fi', 'vi', 'he', 'uk', 'el', 'ms', 'cs', 'ro', 'da', 'hu', 'ta', 'no', 'th', 'ur', 'hr', 'bg', 'lt', 'la', 'mi', 'ml', 'cy', 'sk', 'te', 'fa', 'lv', 'bn', 'sr', 'az', 'sl', 'kn', 'et', 'mk', 'br', 'eu', 'is', 'hy', 'ne', 'mn', 'bs', 'kk', 'sq', 'sw', 'gl', 'mr', 'pa', 'si', 'km', 'sn', 'yo', 'so', 'af', 'oc', 'ka', 'be', 'tg', 'sd', 'gu', 'am', 'yi', 'lo', 'uz', 'fo', 'ht', 'ps', 'tk', 'nn', 'mt', 'sa', 'lb', 'my', 'bo', 'tl', 'mg', 'as', 'tt', 'haw', 'ln', 'ha', 'ba', 'jw', 'su'
    ];

    console.log('Loaded Whisper supported languages:', this.supportedLanguages.length);
  }

  /**
   * Set custom Whisper installation path
   */
  setWhisperPath(customPath: string): void {
    this.whisperPath = customPath;
    this.modelPath = path.join(customPath, 'models');
    this.isInitialized = false;
  }

  /**
   * Get current Whisper installation path
   */
  getWhisperPath(): string {
    return this.whisperPath;
  }
}