import { TranslationService, TranslationResult, TranslationProvider } from '../interfaces/TranslationService';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { app } from 'electron';
import { resolveEmbeddedPythonExecutable } from '../utils/pythonPath';

/**
 * Local translation service using Argos Translate
 */
export class ArgosTranslationService implements TranslationService {
  private argosPath: string;
  private packagesPath: string;
  private isInitialized: boolean = false;
  private supportedLanguages: string[] = [];

  constructor() {
    // Use Electron's cross-platform app data path
    const electronAppDataPath = app.getPath('appData');
    
    // Check if Windows-style path exists (for compatibility with existing installations)
    const windowsStylePath = path.join(require('os').homedir(), 'AppData', 'Roaming', 'whispra', 'models', 'argos');
    const electronPath = path.join(electronAppDataPath, 'whispra', 'models', 'argos');
    
    // Prefer Windows-style path if it exists (for backward compatibility), otherwise use Electron's path
    if (fs.existsSync(windowsStylePath)) {
      console.log(`[Argos] Using Windows-style path: ${windowsStylePath}`);
      this.argosPath = windowsStylePath;
    } else {
      console.log(`[Argos] Using Electron app data path: ${electronPath}`);
      this.argosPath = electronPath;
    }

    // Language packages are in the main packages directory
    // Extra pack models are in extrapack/packages but should be installed via package.install_from_path()
    this.packagesPath = path.join(this.argosPath, 'packages');
  }

  /**
   * Get the platform-specific Python executable path
   */
  private getPythonExecutable(): string {
    // First try to use the proper embedded Python resolution
    const embeddedPython = resolveEmbeddedPythonExecutable();
    if (embeddedPython && fs.existsSync(embeddedPython)) {
      console.log(`[Argos] Using embedded Python: ${embeddedPython}`);
      return embeddedPython;
    }

    // Fallback to legacy path resolution for backward compatibility
    console.log(`[Argos] Embedded Python not found, using legacy path resolution`);
    
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
      // Final fallback: use system Python3
      return '/usr/bin/python3';
    } else {
      // Linux
      const pythonDir = path.join(process.cwd(), 'python');
      const python3Path = path.join(pythonDir, 'python3');
      if (fs.existsSync(python3Path)) {
        return python3Path;
      }
      const pythonPath = path.join(pythonDir, 'python');
      if (fs.existsSync(pythonPath)) {
        return pythonPath;
      }
      // Fallback to system python3
      return '/usr/bin/python3';
    }
  }

  /**
   * Initialize Argos Translate service
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Check if Argos is installed
      await this.checkArgosInstallation();
      
      // Install any .argosmodel files from packages directory that aren't installed yet
      await this.installPackagesDirectoryModelsIfNeeded();

      // Check for and install any uninstalled models from extrapack
      await this.installExtraPackModelsIfNeeded();

      // Load supported languages
      await this.loadSupportedLanguages();

      this.isInitialized = true;
      console.log('Argos Translation Service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Argos Translation Service:', error);
      throw error;
    }
  }

  /**
   * Restart/reinitialize Argos Translate service
   * Useful when language settings change
   */
  async restart(): Promise<void> {
    console.log('🔄 Restarting Argos Translation Service...');
    this.isInitialized = false;
    try {
      await this.initialize();
      // Verify initialization was successful
      if (!this.isInitialized) {
        throw new Error('Argos initialization completed but isInitialized flag is still false');
      }
      console.log('✅ Argos Translation Service restarted successfully and is ready for translations');
    } catch (error) {
      console.error('❌ Failed to restart Argos Translation Service:', error);
      throw error;
    }
  }

  /**
   * Translate text using Argos Translate
   */
  async translate(text: string, targetLanguage: string, sourceLanguage?: string): Promise<TranslationResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    // Check if Argos is available before attempting translation
    if (!this.isAvailable()) {
      throw new Error('Local Argos translation service is not available. Please install Argos Translate models or switch to cloud processing mode.');
    }

    try {
      // Argos doesn't support 'auto' - only convert if explicitly 'auto' or undefined
      // If a specific source language is provided, use it
      let fromLang: string;
      if (!sourceLanguage || sourceLanguage === 'auto') {
        fromLang = 'en'; // Default to English when auto-detection is requested or not specified
        console.log(`🌐 Argos doesn't support 'auto', defaulting to 'en' for translation`);
      } else {
        fromLang = sourceLanguage; // Use the provided source language
        console.log(`🌐 Using provided source language: ${fromLang}`);
      }
      const toLang = targetLanguage;

      // If source and target languages are the same, return original text
      if (fromLang === toLang) {
        console.log(`🌐 Source and target languages are the same (${fromLang}), returning original text`);
        return {
          translatedText: text,
          sourceLanguage: fromLang,
          targetLanguage: toLang,
          confidence: 1.0,
          provider: 'argos' as TranslationProvider
        };
      }

      console.log(`Translating with Argos: "${text}" from ${fromLang} to ${toLang}`);

      const translatedText = await this.executeArgosTranslation(text, fromLang, toLang);

      return {
        translatedText,
        sourceLanguage: fromLang,
        targetLanguage: toLang,
        confidence: 0.9, // Argos doesn't provide confidence scores
        provider: 'argos' as TranslationProvider
      };
    } catch (error) {
      console.error('Argos translation failed:', error);
      throw new Error(`Argos translation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get supported languages
   */
  getSupportedLanguages(): string[] {
    return this.supportedLanguages;
  }

  /**
   * Check if language pair is supported
   */
  isLanguagePairSupported(sourceLanguage: string, targetLanguage: string): boolean {
    // For simplicity, assume all combinations are supported if both languages are in the list
    return this.supportedLanguages.includes(sourceLanguage) &&
      this.supportedLanguages.includes(targetLanguage);
  }

  /**
   * Check if Argos is available
   */
  isAvailable(): boolean {
    // Check for the installation marker file, embedded Python, and language packages
    const markerFile = path.join(this.argosPath, 'argos_installed.txt');
    const embeddedPythonExe = this.getPythonExecutable();
    
    const markerExists = fs.existsSync(markerFile);
    // For system Python paths, don't check existence (they're system commands)
    // Only check existence for local paths
    const isSystemPython = embeddedPythonExe.startsWith('/usr/bin/') || embeddedPythonExe.startsWith('/usr/local/bin/');
    const embeddedPythonExists = isSystemPython || !!(embeddedPythonExe && fs.existsSync(embeddedPythonExe));
    const packagesExist = this.hasLanguagePackages();

    const isAvailable = this.isInitialized && markerExists && embeddedPythonExists && packagesExist;

    if (!isAvailable) {
      console.log(`Argos Translate not available. Initialized: ${this.isInitialized}, Marker file exists: ${markerExists}, Embedded Python exists: ${embeddedPythonExists} (${isSystemPython ? 'system' : 'local'}), Language packages exist: ${packagesExist}`);
      console.log(`Expected marker file path: ${markerFile}`);
      console.log(`Expected embedded Python path: ${embeddedPythonExe || '(not found)'}`);
      console.log(`Expected packages path: ${this.packagesPath}`);
    }

    return isAvailable;
  }

  /**
   * Execute Argos translation command
   */
  private async executeArgosTranslation(text: string, fromLang: string, toLang: string): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        // Use embedded Python to run argos-translate
        const embeddedPythonExe = this.getPythonExecutable();

        // Use base64 encoding to safely pass text with any content (newlines, quotes, etc.)
        // This is the safest method as it avoids all escaping issues
        const textBase64 = Buffer.from(text, 'utf8').toString('base64');

        const script = `# -*- coding: utf-8 -*-
import sys
import os
import base64

# Ensure UTF-8 output on Windows
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')

# Add Argos packages to Python path
argos_path = r"${this.argosPath.replace(/\\/g, '\\\\')}"
if argos_path not in sys.path:
    sys.path.insert(0, argos_path)

try:
    import argostranslate.package
    import argostranslate.translate
    
    # Load installed packages
    argostranslate.package.update_package_index()
    installed_packages = argostranslate.package.get_installed_packages()
    
    # Find the translation package
    from_code = "${fromLang}"
    to_code = "${toLang}"
    
    # Decode text from base64 to handle any content safely
    text_to_translate = base64.b64decode("${textBase64}").decode('utf-8')
    
    # Check if translation package exists in installed packages
    package_found = None
    for package in installed_packages:
        if package.from_code == from_code and package.to_code == to_code:
            package_found = package
            break
    
    # If not found in installed packages, check packages directory for .argosmodel files
    if package_found is None:
        import os
        packages_dir = r"${this.packagesPath.replace(/\\/g, '\\\\')}"
        extrapack_dir1 = os.path.join(r"${this.argosPath.replace(/\\/g, '\\\\')}", "extrapack", "extrapack")
        extrapack_dir2 = os.path.join(r"${this.argosPath.replace(/\\/g, '\\\\')}", "extrapack", "packages")
        
        # Check packages directory first
        directories_to_check = [packages_dir]
        if os.path.exists(extrapack_dir1):
            directories_to_check.append(extrapack_dir1)
        if os.path.exists(extrapack_dir2):
            directories_to_check.append(extrapack_dir2)
        
        for check_dir in directories_to_check:
            if os.path.exists(check_dir):
                # Look for matching .argosmodel file
                model_file_prefix = f"translate-{from_code}_{to_code}-"
                for file in os.listdir(check_dir):
                    if file.endswith('.argosmodel') and file.startswith(model_file_prefix):
                        model_path = os.path.join(check_dir, file)
                        print(f"Found model file: {model_path}, installing...")
                        argostranslate.package.install_from_path(model_path)
                        # Reload installed packages after installation
                        argostranslate.package.update_package_index()
                        installed_packages = argostranslate.package.get_installed_packages()
                        # Check again
                        for package in installed_packages:
                            if package.from_code == from_code and package.to_code == to_code:
                                package_found = package
                                break
                        if package_found:
                            break
                if package_found:
                    break
    
    if package_found is None:
        installed_pairs = [(p.from_code, p.to_code) for p in installed_packages]
        raise Exception(f"No translation package found for {from_code} -> {to_code}. Installed packages: {installed_pairs}")
    
    # Try to translate
    translated_text = argostranslate.translate.translate(text_to_translate, from_code, to_code)
    print(translated_text)
    
except ImportError as e:
    print(f"Import error: {e}")
except Exception as e:
    print(f"Translation error: {e}")`;

        // Write script to temporary file to avoid command line issues
        // Use os.tmpdir() for better Windows 11 permission handling
        const tempScriptPath = path.join(os.tmpdir(), `temp_argos_translate_${Date.now()}.py`);

        fs.writeFileSync(tempScriptPath, script);

        const childProcess = spawn(embeddedPythonExe, [tempScriptPath], {
          stdio: ['pipe', 'pipe', 'pipe'],
          shell: false,
          env: {
            ...process.env,
            PYTHONPATH: this.argosPath,
            ARGOS_TRANSLATE_PACKAGE_DIR: this.packagesPath,
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
            const translatedText = output.trim();
            if (translatedText && !translatedText.startsWith('Translation error:') && !translatedText.startsWith('Import error:')) {
              resolve(translatedText);
            } else {
              // Log the actual error for debugging
              console.error(`[Argos] Translation failed. Output: ${output.trim()}, Error: ${errorOutput.trim()}`);
              reject(new Error(`Translation failed: ${translatedText || errorOutput || 'Empty result'}`));
            }
          } else {
            // Log detailed error information
            console.error(`[Argos] Process exited with code ${code}`);
            console.error(`[Argos] stdout: ${output.trim()}`);
            console.error(`[Argos] stderr: ${errorOutput.trim()}`);
            reject(new Error(`Argos process exited with code ${code}: ${errorOutput || output || 'Unknown error'}`));
          }
        });

        childProcess.on('error', (error: Error) => {
          // Clean up temp file
          try {
            fs.unlinkSync(tempScriptPath);
          } catch (e) {
            // Ignore cleanup errors
          }
          reject(new Error(`Failed to start Argos process: ${error.message}`));
        });

        // Set timeout for translation
        setTimeout(() => {
          if (!childProcess.killed) {
            childProcess.kill();
            reject(new Error('Argos translation timeout'));
          }
        }, 30000); // 30 second timeout

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Check if Argos Translate is installed
   */
  private async checkArgosInstallation(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Use embedded Python to check Argos installation
      const embeddedPythonExe = this.getPythonExecutable();
      
      console.log(`[Argos] Checking installation with Python: ${embeddedPythonExe}`);
      
      // For system Python, we don't need to check if it exists (it's a system command)
      // Only check if it's a local path
      if (!embeddedPythonExe.startsWith('/usr/bin/') && !embeddedPythonExe.startsWith('/usr/local/bin/') && !fs.existsSync(embeddedPythonExe)) {
        reject(new Error(`Python executable not found at: ${embeddedPythonExe}`));
        return;
      }

      // Test if argostranslate module is available with proper path setup
      const script = `# -*- coding: utf-8 -*-
import sys
import os

# Ensure UTF-8 output on Windows
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')

# Add Argos packages to Python path
argos_path = r"${this.argosPath.replace(/\\/g, '\\\\')}"
if argos_path not in sys.path:
    sys.path.insert(0, argos_path)

# Debug: print path information
print(f"Argos path: {argos_path}", file=sys.stderr)
print(f"Python path (first 3): {sys.path[:3]}", file=sys.stderr)
print(f"PYTHONPATH env: {os.environ.get('PYTHONPATH', 'NOT SET')}", file=sys.stderr)
print(f"Argos path exists: {os.path.exists(argos_path)}", file=sys.stderr)
print(f"Argostranslate dir exists: {os.path.exists(os.path.join(argos_path, 'argostranslate'))}", file=sys.stderr)

try:
    import argostranslate
    print("argos-translate available")
except ImportError as e:
    print(f"argos-translate not available: {e}", file=sys.stderr)
    import traceback
    traceback.print_exc(file=sys.stderr)
    sys.exit(1)`;

      // Write script to temporary file to avoid command line issues
      // Use os.tmpdir() for better Windows 11 permission handling
      const tempScriptPath = path.join(os.tmpdir(), `temp_argos_check_${Date.now()}.py`);

      try {
        fs.writeFileSync(tempScriptPath, script);

        const childProcess = spawn(embeddedPythonExe, [tempScriptPath], {
          stdio: ['pipe', 'pipe', 'pipe'],
          shell: false,
          env: {
            ...process.env,
            PYTHONPATH: this.argosPath,
            ARGOS_TRANSLATE_PACKAGE_DIR: this.packagesPath,
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
          // Also log stdout for debugging
          console.log(`[Argos Check stdout]: ${data.toString().trim()}`);
        });

        childProcess.stderr.on('data', (data: any) => {
          errorOutput += data.toString();
          // Also log stderr for debugging
          console.log(`[Argos Check stderr]: ${data.toString().trim()}`);
        });

        childProcess.on('close', (code: number) => {
          // Clean up temp file
          try {
            fs.unlinkSync(tempScriptPath);
          } catch (e) {
            // Ignore cleanup errors
          }

          if (code === 0) {
            console.log('Argos Translate available:', output.trim());
            resolve();
          } else {
            reject(new Error(`Argos Translate not found or not working: ${output.trim() || errorOutput}`));
          }
        });

        childProcess.on('error', (error: Error) => {
          // Clean up temp file
          try {
            fs.unlinkSync(tempScriptPath);
          } catch (e) {
            // Ignore cleanup errors
          }
          reject(new Error(`Argos Translate check failed: ${error.message}`));
        });
      } catch (error) {
        reject(new Error(`Failed to create temp script: ${error}`));
      }
    });
  }

  /**
   * Load supported languages from Argos
   */
  private async loadSupportedLanguages(): Promise<void> {
    try {
      // Default supported languages for Argos Translate
      // In a real implementation, you would query Argos for available language packages
      this.supportedLanguages = [
        'en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ja', 'ko', 'zh',
        'ar', 'hi', 'tr', 'pl', 'nl', 'sv', 'da', 'no', 'fi', 'cs',
        'sk', 'hu', 'ro', 'bg', 'hr', 'sl', 'et', 'lv', 'lt', 'mt'
      ];

      console.log('Loaded Argos supported languages:', this.supportedLanguages.length);
    } catch (error) {
      console.warn('Failed to load Argos supported languages:', error);
      // Fallback to basic language set
      this.supportedLanguages = ['en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ja', 'ko', 'zh'];
    }
  }

  /**
   * Set custom Argos installation path
   */
  setArgosPath(customPath: string): void {
    this.argosPath = customPath;
    this.isInitialized = false;
  }

  /**
   * Get current Argos installation path
   */
  getArgosPath(): string {
    return this.argosPath;
  }

  /**
   * Install any .argosmodel files from packages directory that aren't installed yet
   */
  private async installPackagesDirectoryModelsIfNeeded(): Promise<void> {
    try {
      // Check if packages directory exists
      if (!fs.existsSync(this.packagesPath)) {
        console.log('No packages directory found, skipping model installation');
        return;
      }

      // Get list of .argosmodel files in packages directory
      const files = fs.readdirSync(this.packagesPath);
      const modelFiles = files.filter((file: string) => file.endsWith('.argosmodel'));
      
      if (modelFiles.length === 0) {
        console.log('No .argosmodel files found in packages directory');
        return;
      }

      console.log(`Found ${modelFiles.length} model files in packages directory, checking if they need to be installed...`);

      // Get currently installed packages to see what's missing
      const installedPackages = await this.getInstalledPackages();
      const installedPairs = new Set(installedPackages.map((p: any) => `${p.from_code}-${p.to_code}`));

      // Install any models that aren't already installed
      const embeddedPythonExe = this.getPythonExecutable();
      let installedCount = 0;

      for (const modelFile of modelFiles) {
        // Extract language pair from filename (e.g., "translate-en_de-1_9.argosmodel" -> "en-de")
        const match = modelFile.match(/translate-([a-z]+)_([a-z]+)-/);
        if (!match) {
          console.warn(`Could not parse language pair from filename: ${modelFile}`);
          continue;
        }

        const [, fromCode, toCode] = match;
        const pairKey = `${fromCode}-${toCode}`;

        if (installedPairs.has(pairKey)) {
          console.log(`Model ${modelFile} (${fromCode}->${toCode}) is already installed, skipping`);
          continue;
        }

        // Install the model
        console.log(`Installing model ${modelFile} (${fromCode}->${toCode}) from packages directory...`);
        const modelPath = path.join(this.packagesPath, modelFile);
        
        try {
          await this.installModelFromPath(modelPath);
          installedCount++;
          console.log(`Successfully installed ${modelFile}`);
        } catch (error) {
          console.error(`Failed to install ${modelFile}:`, error);
          // Continue with other models even if one fails
        }
      }

      if (installedCount > 0) {
        console.log(`Installed ${installedCount} model(s) from packages directory`);
      } else {
        console.log('All packages directory models are already installed');
      }
    } catch (error) {
      console.error('Error checking/installing packages directory models:', error);
      // Don't throw - this is a best-effort operation
    }
  }

  /**
   * Check for and install any uninstalled models from extrapack directory
   */
  private async installExtraPackModelsIfNeeded(): Promise<void> {
    try {
      // Check both possible extrapack locations
      const extrapackPath1 = path.join(this.argosPath, 'extrapack', 'extrapack');
      const extrapackPath2 = path.join(this.argosPath, 'extrapack', 'packages');
      const extrapackPath = fs.existsSync(extrapackPath1) ? extrapackPath1 : extrapackPath2;
      
      // Check if extrapack directory exists
      if (!fs.existsSync(extrapackPath)) {
        console.log('No extrapack directory found, skipping extra pack model installation');
        return;
      }

      // Get list of .argosmodel files in extrapack
      const files = fs.readdirSync(extrapackPath);
      const modelFiles = files.filter((file: string) => file.endsWith('.argosmodel'));

      if (modelFiles.length === 0) {
        console.log('No .argosmodel files found in extrapack directory');
        return;
      }

      console.log(`Found ${modelFiles.length} model files in extrapack, checking if they need to be installed...`);

      // Get currently installed packages to see what's missing
      const installedPackages = await this.getInstalledPackages();
      const installedPairs = new Set(installedPackages.map((p: any) => `${p.from_code}-${p.to_code}`));

      // Install any models that aren't already installed
      const embeddedPythonExe = this.getPythonExecutable();
      let installedCount = 0;

      for (const modelFile of modelFiles) {
        // Extract language pair from filename (e.g., "translate-en_de-1_9.argosmodel" -> "en-de")
        const match = modelFile.match(/translate-([a-z]+)_([a-z]+)-/);
        if (!match) {
          console.warn(`Could not parse language pair from filename: ${modelFile}`);
          continue;
        }

        const [, fromCode, toCode] = match;
        const pairKey = `${fromCode}-${toCode}`;

        if (installedPairs.has(pairKey)) {
          console.log(`Model ${modelFile} (${fromCode}->${toCode}) is already installed, skipping`);
          continue;
        }

        // Install the model
        console.log(`Installing model ${modelFile} (${fromCode}->${toCode}) from extrapack...`);
        const modelPath = path.join(extrapackPath, modelFile);

        try {
          await this.installModelFromPath(modelPath);
          installedCount++;
          console.log(`Successfully installed ${modelFile}`);
        } catch (error) {
          console.error(`Failed to install ${modelFile}:`, error);
          // Continue with other models even if one fails
        }
      }

      if (installedCount > 0) {
        console.log(`Installed ${installedCount} model(s) from extrapack`);
      } else {
        console.log('All extrapack models are already installed');
      }
    } catch (error) {
      console.error('Error checking/installing extrapack models:', error);
      // Don't throw - this is a best-effort operation
    }
  }

  /**
   * Get list of currently installed Argos packages
   */
  private async getInstalledPackages(): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const embeddedPythonExe = this.getPythonExecutable();
      
      const script = `import sys
import os
import json

# Ensure UTF-8 output on Windows
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')

# Add Argos packages to Python path
argos_path = r"${this.argosPath.replace(/\\/g, '\\\\')}"
if argos_path not in sys.path:
    sys.path.insert(0, argos_path)

try:
    import argostranslate.package as package
    
    # Update package index and get installed packages
    package.update_package_index()
    installed_packages = package.get_installed_packages()
    
    # Convert to JSON-serializable format
    packages_list = [{"from_code": p.from_code, "to_code": p.to_code} for p in installed_packages]
    print(json.dumps(packages_list))
    
except Exception as e:
    print(json.dumps([]))
    sys.exit(0)`;

      // Use os.tmpdir() for better Windows 11 permission handling
      const tempScriptPath = path.join(os.tmpdir(), `temp_get_packages_${Date.now()}.py`);

      try {
        fs.writeFileSync(tempScriptPath, script);

        const childProcess = spawn(embeddedPythonExe, [tempScriptPath], {
          stdio: ['pipe', 'pipe', 'pipe'],
          shell: false,
          env: {
            ...process.env,
            PYTHONPATH: this.argosPath,
            ARGOS_TRANSLATE_PACKAGE_DIR: this.packagesPath,
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
        });

        childProcess.stderr.on('data', (data: any) => {
          errorOutput += data.toString();
        });

        childProcess.on('close', (code: number) => {
          try {
            fs.unlinkSync(tempScriptPath);
          } catch (e) {
            // Ignore cleanup errors
          }

          if (code === 0) {
            try {
              const packages = JSON.parse(output.trim());
              resolve(packages || []);
            } catch (e) {
              resolve([]);
            }
          } else {
            resolve([]);
          }
        });

        childProcess.on('error', (error: Error) => {
          try {
            fs.unlinkSync(tempScriptPath);
          } catch (e) {
            // Ignore cleanup errors
          }
          resolve([]);
        });
      } catch (error) {
        resolve([]);
      }
    });
  }

  /**
   * Install a single model from a file path
   */
  private async installModelFromPath(modelPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const embeddedPythonExe = this.getPythonExecutable();
      
      const script = `import sys
import os

# Ensure UTF-8 output on Windows
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')

# Add Argos packages to Python path
argos_path = r"${this.argosPath.replace(/\\/g, '\\\\')}"
if argos_path not in sys.path:
    sys.path.insert(0, argos_path)

try:
    import argostranslate.package as package
    
    # Install the model
    model_path = r"${modelPath.replace(/\\/g, '\\\\')}"
    package.install_from_path(model_path)
    print("Successfully installed")
    
except Exception as e:
    print(f"Installation error: {e}")
    sys.exit(1)`;

      // Use os.tmpdir() for better Windows 11 permission handling
      const tempScriptPath = path.join(os.tmpdir(), `temp_install_model_${Date.now()}.py`);

      try {
        fs.writeFileSync(tempScriptPath, script);

        const childProcess = spawn(embeddedPythonExe, [tempScriptPath], {
          stdio: ['pipe', 'pipe', 'pipe'],
          shell: false,
          env: {
            ...process.env,
            PYTHONPATH: this.argosPath,
            ARGOS_TRANSLATE_PACKAGE_DIR: this.packagesPath,
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
        });

        childProcess.stderr.on('data', (data: any) => {
          errorOutput += data.toString();
        });

        childProcess.on('close', (code: number) => {
          try {
            fs.unlinkSync(tempScriptPath);
          } catch (e) {
            // Ignore cleanup errors
          }

          if (code === 0 && output.includes('Successfully installed')) {
            resolve();
          } else {
            reject(new Error(`Installation failed: ${errorOutput || output}`));
          }
        });

        childProcess.on('error', (error: Error) => {
          try {
            fs.unlinkSync(tempScriptPath);
          } catch (e) {
            // Ignore cleanup errors
          }
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Check if language packages (.argosmodel files) exist
   */
  private hasLanguagePackages(): boolean {
    try {
      if (!fs.existsSync(this.packagesPath)) {
        console.log(`Argos packages directory does not exist: ${this.packagesPath}`);
        return false;
      }

      const files = fs.readdirSync(this.packagesPath);
      const argosModelFiles = files.filter(file => file.endsWith('.argosmodel'));

      console.log(`Found ${argosModelFiles.length} .argosmodel files in ${this.packagesPath}`);
      if (argosModelFiles.length > 0) {
        console.log(`Language model files: ${argosModelFiles.join(', ')}`);
      }

      return argosModelFiles.length > 0;
    } catch (error) {
      console.error(`Error checking for language packages: ${error}`);
      return false;
    }
  }

  /**
   * Get packages directory path
   */
  getPackagesPath(): string {
    return this.packagesPath;
  }

  /**
   * Set the preferred translation provider (not applicable for Argos)
   */
  setProvider(provider: TranslationProvider): void {
    // Argos is always the provider for this service
    console.log('setProvider called on ArgosTranslationService, ignoring');
  }

  /**
   * Get current translation provider
   */
  getCurrentProvider(): TranslationProvider {
    return 'argos';
  }
}